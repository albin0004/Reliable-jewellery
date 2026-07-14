/**
 * Reliable Jewellery — Catalog Manager
 * Full Real-Time Sync | Supabase + Local Fallback
 */

// ==========================================
// 🔴 SUPABASE CONFIG
// ==========================================
const SUPABASE_URL = 'https://rjkzwnlaplvpoamsvhih.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqa3p3bmxhcGx2cG9hbXN2aGloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NzMwNTAsImV4cCI6MjA5MDM0OTA1MH0.akoIqwmaqbgLF7YiQjeXHXCYzvCF5aMgbpQmlU7bKK4';

// ==========================================
// App State
// ==========================================
let supabaseClient = null;
let isConnected = false;
let catalogItems = [];
let materialsItems = [];
let currentPerGram = 0;
let calcRowIdCounter = 0;
let realtimeChannel = null;
let reconnectTimer = null;
let lastSyncTime = null;
let heartbeatInterval = null;

// ==========================================
// Viewport Height Fix (for Tablet/BAH4-L09)
// ==========================================
function updateVh() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}
window.addEventListener('resize', updateVh);
window.addEventListener('orientationchange', updateVh);
updateVh();

// ==========================================
// Auth State
// ==========================================
let isManagerUnlocked = false;
let pendingNavTarget = null;

// ==========================================
// DOM References
// ==========================================
const toastEl          = document.getElementById('toast');

// Nav
const navCatalog       = document.getElementById('nav-catalog');
const navManager       = document.getElementById('nav-manager');
const navCalculator    = document.getElementById('nav-calculator');
const viewCatalog      = document.getElementById('view-catalog');
const viewManager      = document.getElementById('view-manager');
const viewCalculator   = document.getElementById('view-calculator');
const tabBadgeCatalog  = document.getElementById('tab-badge-catalog');
const tabBadgeManager  = document.getElementById('tab-badge-manager');
const matCountBadge    = document.getElementById('mat-count-badge');

// Status
const statusDot        = document.querySelector('.status-dot');
const connectionText   = document.getElementById('connection-text');

// Password Gate
const pwOverlay        = document.getElementById('pw-overlay');
const pwInput          = document.getElementById('pw-input');
const pwCancelBtn      = document.getElementById('pw-cancel-btn');
const pwSubmitBtn      = document.getElementById('pw-submit-btn');
const pwErrorText      = document.getElementById('pw-error-text');

// Catalog (Cat 1)
const uploadForm       = document.getElementById('upload-form');
const dropZone         = document.getElementById('drop-zone');
const imageInput       = document.getElementById('image-input');
const imagePreview     = document.getElementById('image-preview');
const uploadPlaceholder = document.querySelector('.upload-placeholder');
const productCodeInput = document.getElementById('product-code');
const productNoteInput = document.getElementById('product-note');
const submitBtn        = document.getElementById('submit-btn');
const catalogList      = document.getElementById('catalog-list');
const emptyState       = document.getElementById('empty-state');

// Mat (Cat 2)
const matForm          = document.getElementById('material-form');
const matCodeInput     = document.getElementById('mat-code');
const matGoldInput     = document.getElementById('mat-gold');
const matDiamondInput  = document.getElementById('mat-diamond');
const matOtherInput    = document.getElementById('mat-other');
const matMakingInput   = document.getElementById('mat-making');
const matEditId        = document.getElementById('mat-edit-id');
const matList          = document.getElementById('material-list');
const matEmptyState    = document.getElementById('mat-empty-state');
const matExcludeBtn     = document.getElementById('mat-exclude-btn');

// Calculator (Cat 3)
const calcDollarInput  = document.getElementById('calc-dollar');
const calcOunceInput   = document.getElementById('calc-ounce');
const calcDirhamInput  = document.getElementById('calc-dirham');
const calcPurityInput  = document.getElementById('calc-purity');
const calcPerGramDisplay = document.getElementById('calc-per-gram');
const addCalcRowBtn    = document.getElementById('add-calc-row-btn');
const calcProductList  = document.getElementById('calc-product-list');
const calcEmptyState   = document.getElementById('calc-empty-state');

let selectedFile = null;

// ==========================================
// Toast Notification System
// ==========================================
function showToast(message, type = 'default', duration = 3000) {
    toastEl.textContent = message;
    toastEl.className = `toast show ${type}`;
    setTimeout(() => {
        toastEl.classList.remove('show');
    }, duration);
}

// ==========================================
// Initialization
// ==========================================
function init() {
    setupNavigation();
    setupCatalogForm();
    setupMaterialForm();
    setupCalculator();
    setupPasswordGate();
    initSupabase();
    injectRealtimeStyles();
}

function injectRealtimeStyles() {
    const s = document.createElement('style');
    s.textContent = `
        @keyframes liveFlash {
            0%   { box-shadow: 0 0 0 0 rgba(102,126,234,0); background: var(--surface-2); }
            25%  { box-shadow: 0 0 0 6px rgba(102,126,234,0.35); background: rgba(102,126,234,0.08); }
            100% { box-shadow: 0 0 0 0 rgba(102,126,234,0); background: var(--surface-2); }
        }
        .live-flash { animation: liveFlash 1.1s ease forwards !important; }
        tr.live-flash td { background: rgba(102,126,234,0.06) !important; }
        @keyframes liveToastIn {
            from { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.94); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        .status-dot.reconnecting {
            background: #f59e0b;
            animation: pulse-dot 1s infinite;
            box-shadow: 0 0 0 3px rgba(245,158,11,0.25);
        }
        @keyframes rowFadeOut { to { opacity:0; transform:translateX(12px); } }
        @keyframes liveInsertPulse {
            0%   { background: rgba(34,197,94,0.15); }
            100% { background: transparent; }
        }
        .live-insert { animation: liveInsertPulse 1.5s ease forwards; }
        @keyframes liveUpdatePulse {
            0%   { background: rgba(102,126,234,0.15); }
            100% { background: transparent; }
        }
        .live-update { animation: liveUpdatePulse 1.5s ease forwards; }
    `;
    document.head.appendChild(s);
}

// ==========================================
// Navigation (Smooth Transitions)
// ==========================================
const VIEWS = {
    'nav-catalog':    { view: viewCatalog,    label: 'Product Catalog' },
    'nav-manager':    { view: viewManager,    label: 'Material Details' },
    'nav-calculator': { view: viewCalculator, label: 'Price Calculator' },
};

function switchView(targetNavId) {
    const target = VIEWS[targetNavId];
    if (!target) return;

    // Update nav tab states
    Object.keys(VIEWS).forEach(id => {
        const tab = document.getElementById(id);
        if (tab) tab.classList.toggle('active', id === targetNavId);
    });

    // Hide all views instantly, then show target with animation
    Object.values(VIEWS).forEach(({ view }) => {
        view.classList.add('hidden');
        view.classList.remove('active', 'entering');
    });

    target.view.classList.remove('hidden');
    void target.view.offsetWidth;
    target.view.classList.add('active', 'entering');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupPasswordGate() {
    if (!pwSubmitBtn) return;
    
    const attemptUnlock = () => {
        if (pwInput.value === '7722') {
            isManagerUnlocked = true;
            pwOverlay.classList.add('hidden');
            pwInput.value = '';
            pwErrorText.classList.add('hidden');
            pwInput.classList.remove('shake');
            if (pendingNavTarget) switchView(pendingNavTarget);
        } else {
            pwInput.classList.remove('shake');
            void pwInput.offsetWidth; // trigger reflow
            pwInput.classList.add('shake');
            pwErrorText.classList.remove('hidden');
            pwInput.value = '';
        }
    };

    pwSubmitBtn.addEventListener('click', attemptUnlock);
    pwInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') attemptUnlock();
    });
    
    pwCancelBtn.addEventListener('click', () => {
        pwOverlay.classList.add('hidden');
        pwInput.value = '';
        pwErrorText.classList.add('hidden');
        pwInput.classList.remove('shake');
        pendingNavTarget = null;
    });
}

function showPasswordGate(navTarget) {
    pendingNavTarget = navTarget;
    pwOverlay.classList.remove('hidden');
    pwInput.focus();
}

function setupNavigation() {
    // Top nav tabs — includes password gate logic for Materials tab
    Object.keys(VIEWS).forEach(navId => {
        const tab = document.getElementById(navId);
        if (tab) {
            tab.addEventListener('click', e => {
                e.preventDefault();
                if (navId === 'nav-manager' && !isManagerUnlocked) {
                    showPasswordGate(navId);
                } else {
                    switchView(navId);
                }
            });
        }
    });

    // Category quick-links (inside each view)
    document.querySelectorAll('.cat-link[data-nav]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const navId = link.dataset.nav;
            if (navId === 'nav-manager' && !isManagerUnlocked) {
                showPasswordGate(navId);
            } else {
                switchView(navId);
            }
        });
    });
}

// ==========================================
// Supabase Setup
// ==========================================
function initSupabase() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                realtime: { params: { eventsPerSecond: 10 } }
            });
            isConnected = true;
            updateConnectionStatus(false, 'Connecting…');

            fetchCatalog();
            fetchMaterials();
            subscribeRealtime();
            setupVisibilityReconnect();
            startHeartbeat();

        } catch (err) {
            console.error('Supabase error:', err);
            setupLocalMock();
        }
    } else {
        setupLocalMock();
    }
}

function updateConnectionStatus(connected, label) {
    if (connected) {
        statusDot.className = 'status-dot online';
        connectionText.textContent = label || 'Live';
    } else {
        statusDot.className = 'status-dot offline';
        connectionText.textContent = label || 'Local Demo';
    }
}

function setupLocalMock() {
    updateConnectionStatus(false);
    const saved    = localStorage.getItem('rj_mock_catalog');
    const savedMat = localStorage.getItem('rj_mock_materials');
    if (saved)    { catalogItems   = JSON.parse(saved);    renderCatalog(); }
    else showEmptyState();
    if (savedMat) { materialsItems = JSON.parse(savedMat); renderMaterials(); }
    else showMatEmptyState();
}

// ==========================================
// Real-Time Channel Setup (with auto-reconnect)
// ==========================================
function subscribeRealtime() {
    if (!supabaseClient) return;

    // Remove stale channel first
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }

    realtimeChannel = supabaseClient
        .channel(`rj-realtime-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog' }, payload => {
            handleCatalogChange(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, payload => {
            handleMaterialsChange(payload);
        })
        .subscribe((status, err) => {
            console.log('[Realtime] Channel status:', status);
            if (status === 'SUBSCRIBED') {
                updateConnectionStatus(true, 'Live');
                updateLastSync();
                clearTimeout(reconnectTimer);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                updateConnectionStatus(false, 'Reconnecting…');
                statusDot.className = 'status-dot reconnecting';
                clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(() => {
                    console.log('[Realtime] Auto-reconnecting…');
                    subscribeRealtime();
                }, 4000);
            }
        });
}

// ─── Catalog real-time handler ───
function handleCatalogChange(payload) {
    console.log('[RT] Catalog event:', payload.eventType, payload);

    if (payload.eventType === 'INSERT') {
        // Deduplicate — only add if not already present
        if (!catalogItems.find(i => i.id === payload.new.id)) {
            catalogItems.unshift(payload.new);
            renderCatalog();
            setTimeout(() => {
                flashElement(`item-${payload.new.id}`);
                highlightElement(`item-${payload.new.id}`, 'live-insert');
            }, 50);
            showLiveToast('📡 New product added live!');
            updateLastSync();
        }
    }

    if (payload.eventType === 'DELETE') {
        const existing = catalogItems.find(i => i.id === payload.old.id);
        if (existing) addNotification('DELETE', 'catalog', { ...existing }, null);

        const el = document.getElementById(`item-${payload.old.id}`);
        if (el) {
            el.style.animation = 'slideOut 0.25s ease forwards';
            setTimeout(() => el.remove(), 250);
        }
        catalogItems = catalogItems.filter(i => i.id !== payload.old.id);
        updateBadge(tabBadgeCatalog, catalogItems.length);
        if (catalogItems.length === 0) showEmptyState();
        showLiveToast('🗑️ Product removed live');
        updateLastSync();
    }

    if (payload.eventType === 'UPDATE') {
        const existing = catalogItems.find(i => i.id === payload.new.id);
        if (existing) addNotification('UPDATE', 'catalog', { ...existing }, { ...payload.new });

        const idx = catalogItems.findIndex(i => i.id === payload.new.id);
        if (idx !== -1) {
            catalogItems[idx] = payload.new;
        } else {
            catalogItems.unshift(payload.new);
        }
        renderCatalog();
        setTimeout(() => {
            flashElement(`item-${payload.new.id}`);
            highlightElement(`item-${payload.new.id}`, 'live-update');
        }, 50);
        showLiveToast('✏️ Product updated live!');
        updateLastSync();
        // Reactively update calculator rows that reference this product
        recalculateAllCalcRows();
    }
}

// ─── Materials real-time handler ───
function handleMaterialsChange(payload) {
    console.log('[RT] Materials event:', payload.eventType, payload);

    if (payload.eventType === 'INSERT') {
        if (!materialsItems.find(i => i.id === payload.new.id)) {
            materialsItems.unshift(payload.new);
            renderMaterials();
            setTimeout(() => {
                flashElement(`mat-item-${payload.new.id}`);
                highlightElement(`mat-item-${payload.new.id}`, 'live-insert');
            }, 50);
            showLiveToast('📡 New material added live!');
            updateLastSync();
            // Reactively update calculator
            recalculateAllCalcRows();
        }
    }

    if (payload.eventType === 'DELETE') {
        const existing = materialsItems.find(i => i.id === payload.old.id);
        if (existing) addNotification('DELETE', 'materials', { ...existing }, null);

        const el = document.getElementById(`mat-item-${payload.old.id}`);
        if (el) {
            el.style.animation = 'rowFadeOut 0.2s ease forwards';
            setTimeout(() => el.remove(), 200);
        }
        materialsItems = materialsItems.filter(i => i.id !== payload.old.id);
        renderMaterials();
        updateBadge(tabBadgeManager, materialsItems.length);
        showLiveToast('🗑️ Material removed live');
        updateLastSync();
        recalculateAllCalcRows();
    }

    if (payload.eventType === 'UPDATE') {
        const existing = materialsItems.find(i => i.id === payload.new.id);
        if (existing) addNotification('UPDATE', 'materials', { ...existing }, { ...payload.new });

        const idx = materialsItems.findIndex(i => i.id === payload.new.id);
        if (idx !== -1) {
            materialsItems[idx] = payload.new;
        } else {
            materialsItems.unshift(payload.new);
        }
        renderMaterials();
        setTimeout(() => {
            flashElement(`mat-item-${payload.new.id}`);
            highlightElement(`mat-item-${payload.new.id}`, 'live-update');
        }, 50);
        showLiveToast('✏️ Material updated live!');
        updateLastSync();
        // Reactively update calculator when material values change
        recalculateAllCalcRows();
    }
}

// ─── Flash & Highlight helpers ───
function flashElement(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('live-flash');
    void el.offsetWidth;
    el.classList.add('live-flash');
    setTimeout(() => el.classList.remove('live-flash'), 1200);
}

function highlightElement(id, className) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    setTimeout(() => el.classList.remove(className), 1500);
}

// ─── Live toast ───
function showLiveToast(message) {
    const liveToast = document.getElementById('live-toast');
    if (!liveToast) return;
    liveToast.textContent = message;
    liveToast.classList.add('show');
    clearTimeout(liveToast._timer);
    liveToast._timer = setTimeout(() => liveToast.classList.remove('show'), 3000);
}

// ─── Sync timestamp ───
function updateLastSync() {
    lastSyncTime = new Date();
    const el = document.getElementById('last-sync-time');
    if (el) {
        el.textContent = `Synced ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }
}

// ─── Visibility reconnect ───
function setupVisibilityReconnect() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && isConnected && supabaseClient) {
            // Always re-fetch on visibility to catch missed events
            console.log('[Visibility] Tab active — re-fetching all data');
            fetchCatalog();
            fetchMaterials();
            updateLastSync();

            // Re-check channel state and re-sub if needed
            if (!realtimeChannel || realtimeChannel.state === 'closed' || realtimeChannel.state === 'errored') {
                subscribeRealtime();
            }
        }
    });
}

// ─── Heartbeat: periodic full re-fetch as safety net ───
function startHeartbeat() {
    clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
        if (isConnected && supabaseClient && document.visibilityState === 'visible') {
            console.log('[Heartbeat] Periodic re-fetch');
            fetchCatalog();
            fetchMaterials();
        }
    }, 30000); // every 30 seconds
}

// ==========================================
// Badge Helper
// ==========================================
function updateBadge(el, count) {
    if (!el) return;
    el.textContent = count;
    el.classList.toggle('has-items', count > 0);
}

// ==========================================
// Catalog Form (Category 1)
// ==========================================
function setupCatalogForm() {
    dropZone.addEventListener('click', () => imageInput.click());

    imageInput.addEventListener('change', e => {
        if (e.target.files?.[0]) handleFile(e.target.files[0]);
    });

    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files?.[0];
        if (file?.type.startsWith('image/')) handleFile(file);
        else showToast('Please drop an image file.', 'error');
    });

    uploadForm.addEventListener('submit', async e => {
        e.preventDefault();
        await publishProduct();
    });
}

function handleFile(file) {
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = e => {
        imagePreview.src = e.target.result;
        imagePreview.classList.remove('hidden');
        uploadPlaceholder.classList.add('hidden');
        dropZone.style.borderStyle = 'solid';
        dropZone.style.borderColor = '#667eea';
    };
    reader.readAsDataURL(file);
}

async function publishProduct() {
    setLoading(true);
    const productCode = productCodeInput.value.trim();
    const note        = productNoteInput.value.trim();

    try {
        const existing = catalogItems.find(i => (i.product_code || '').toLowerCase() === productCode.toLowerCase());
        const isCurrentlyHidden = existing && (existing.is_private === true || (existing.note && existing.note.includes('[HIDDEN]')));

        if (existing && !isCurrentlyHidden) {
             showToast('Product code already exists! Please choose a different one.', 'warning');
             setLoading(false);
             return;
        }

        let imageUrl = '';

        if (isConnected && supabaseClient) {
            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop();
                const filePath = `products/${Math.random()}.${fileExt}`;

                const { error: uploadError } = await supabaseClient.storage
                    .from('catalog-images')
                    .upload(filePath, selectedFile);
                if (uploadError) throw uploadError;

                const { data: pub } = supabaseClient.storage.from('catalog-images').getPublicUrl(filePath);
                imageUrl = pub.publicUrl;
            }

            let dbError;
            if (existing && isCurrentlyHidden) {
                // Update existing private item to be public
                const updatePayload = { 
                    image_url: imageUrl || existing.image_url || null, 
                    note: note.replace(' [HIDDEN]', ''),
                    is_private: false 
                };
                const { error } = await supabaseClient.from('catalog').update(updatePayload).eq('id', existing.id);
                // Fallback for missing column during update
                if (error) { 
                    delete updatePayload.is_private; 
                    const { error: retryError } = await supabaseClient.from('catalog').update(updatePayload).eq('id', existing.id);
                    dbError = retryError;
                } else {
                    dbError = error;
                }
            } else {
                // Insert new public item
                const insertPayload = { 
                    product_code: productCode, 
                    note: note || null, 
                    image_url: imageUrl || null, 
                    is_private: false 
                };
                const { error } = await supabaseClient.from('catalog').insert([insertPayload]);
                
                // Fallback for missing column during insert
                if (error) {
                    delete insertPayload.is_private;
                    const { error: retryError } = await supabaseClient.from('catalog').insert([insertPayload]);
                    dbError = retryError;
                } else {
                    dbError = error;
                }
            }
            if (dbError) throw dbError;
        } else {
            // Local fallback logic
            imageUrl = selectedFile ? imagePreview.src : null;
            if (existing && isCurrentlyHidden) {
                existing.image_url = imageUrl || existing.image_url || null;
                existing.note = note || null;
                existing.is_private = false;
            } else {
                const newItem = {
                    id: Date.now(), product_code: productCode,
                    note: note || null, image_url: imageUrl || null, created_at: new Date().toISOString(), is_private: false
                };
                catalogItems.unshift(newItem);
            }
            localStorage.setItem('rj_mock_catalog', JSON.stringify(catalogItems));
            renderCatalog();
        }

        showToast('✦ Product published successfully!', 'success');
        resetForm();
        renderCatalog(); // Ensure UI reflects the change (hidden -> visible)
    } catch (err) {
        console.error('Publish error:', err);
        showToast('Failed to publish. Check console.', 'error');
    } finally {
        setLoading(false);
    }
}

async function fetchCatalog() {
    try {
        const { data, error } = await supabaseClient.from('catalog').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        // Smart diff — only re-render if data actually changed
        const newJson = JSON.stringify(data);
        const oldJson = JSON.stringify(catalogItems);
        if (newJson !== oldJson) {
            catalogItems = data || [];
            renderCatalog();
            console.log('[Fetch] Catalog updated, items:', catalogItems.length);
        }
    } catch (err) {
        console.error('Fetch catalog error:', err);
    }
}

// ─── Delete & Edit ──
window.deleteProduct = async function(id) {
    if (!confirm('Delete this product? It will also be removed from materials.')) return;
    const prod = catalogItems.find(i => i.id === id);
    try {
        if (isConnected && supabaseClient) {
            const { error } = await supabaseClient.from('catalog').delete().eq('id', id);
            if (error) throw error;
            if (prod) await supabaseClient.from('materials').delete().ilike('product_code', prod.product_code);
        } else {
            catalogItems = catalogItems.filter(i => i.id !== id);
            localStorage.setItem('rj_mock_catalog', JSON.stringify(catalogItems));
            if (prod) {
                materialsItems = materialsItems.filter(i => (i.product_code || '').toLowerCase() !== (prod.product_code || '').toLowerCase());
                localStorage.setItem('rj_mock_materials', JSON.stringify(materialsItems));
                renderMaterials();
            }
            const el = document.getElementById(`item-${id}`);
            if (el) { el.style.animation = 'itemSlideOut 0.2s ease forwards'; setTimeout(() => el.remove(), 200); }
        }
        updateBadge(tabBadgeCatalog, catalogItems.length);
        showToast('Product deleted.', 'warning');
    } catch (err) {
        console.error('Delete error:', err);
        showToast('Failed to delete.', 'error');
    }
};

window.editProduct = async function(id, currentCode, currentNote) {
    const newCode = prompt('Edit Product Code:', currentCode);
    if (newCode === null) return;
    
    if (newCode.toLowerCase() !== currentCode.toLowerCase() && catalogItems.some(i => (i.product_code || '').toLowerCase() === newCode.toLowerCase())) {
        alert('Warning: Product code already exists! Please choose a different one.');
        return;
    }

    const newNote = prompt('Edit Product Name/Note:', currentNote);
    if (newNote === null) return;
    try {
        if (isConnected && supabaseClient) {
            const { error } = await supabaseClient.from('catalog').update({ product_code: newCode, note: newNote }).eq('id', id);
            if (error) throw error;
            if (newCode !== currentCode) {
                await supabaseClient.from('materials').update({ product_code: newCode }).ilike('product_code', currentCode);
            }
        } else {
            const item = catalogItems.find(i => i.id === id);
            if (item) { item.product_code = newCode; item.note = newNote; }
            localStorage.setItem('rj_mock_catalog', JSON.stringify(catalogItems));
            
            // Cascade in memory
            if (newCode !== currentCode) {
                materialsItems.forEach(m => { if ((m.product_code || '').toLowerCase() === currentCode.toLowerCase()) m.product_code = newCode; });
                localStorage.setItem('rj_mock_materials', JSON.stringify(materialsItems));
                renderMaterials();
            }
            renderCatalog();
        }
        showToast('Product updated!', 'success');
    } catch (err) {
        console.error('Edit error:', err);
        showToast('Failed to update.', 'error');
    }
};

// ─── Rendering ──

function renderCatalog() {
    const visibleItems = catalogItems.filter(item => {
        const isHidden = item.is_private === true || (item.note && item.note.includes('[HIDDEN]'));
        return !isHidden;
    });
    if (visibleItems.length === 0) { showEmptyState(); return; }
    emptyState.classList.add('hidden');
    catalogList.innerHTML = visibleItems.map(generateItemHTML).join('');
    updateBadge(tabBadgeCatalog, visibleItems.length);
    updateCatalogDatalist();
}

function updateCatalogDatalist() {
    const datalist = document.getElementById('catalog-codes');
    if (!datalist) return;
    datalist.innerHTML = catalogItems.map(item => `<option value="${item.product_code}">`).join('');
}

function generateItemHTML(item) {
    const date = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const safeCode = (item.product_code || '').replace(/'/g, "\\'");
    const safeNote = (item.note || '').replace(/'/g, "\\'");
    const imgHtml = item.image_url 
        ? `<img class="item-thumb" src="${item.image_url}" alt="${safeCode}" loading="lazy" 
                onmousedown="this.classList.add('zoomed')" 
                onmouseup="this.classList.remove('zoomed')" 
                onmouseleave="this.classList.remove('zoomed')" 
                ontouchstart="this.classList.add('zoomed')" 
                ontouchend="this.classList.remove('zoomed')" 
                ontouchcancel="this.classList.remove('zoomed')">`
        : `<div class="item-thumb" style="display:flex;align-items:center;justify-content:center;background:var(--surface-2);color:var(--text-3);font-size:0.65rem;border:1px dashed var(--border);">No Image</div>`;

    return `
        <div class="catalog-item" id="item-${item.id}">
            <div class="thumb-wrap">
                ${imgHtml}
            </div>
            <div class="item-info">
                <div class="item-code-label">
                    <span>${item.product_code}</span>
                </div>
                ${item.note && item.note.trim() !== '' ? `<div class="item-note-text" style="font-weight:600; color:var(--text);">${item.note}</div>` : ''}
                <div class="item-timestamp">${date}</div>
            </div>
            <div class="item-actions-row">
                <button class="btn-sm edit" onclick="editProduct(${item.id},'${safeCode}','${safeNote}')">Edit</button>
                <button class="btn-sm delete" onclick="deleteProduct(${item.id})">Delete</button>
            </div>
        </div>`;
}

function showEmptyState() {
    catalogList.innerHTML = '';
    catalogList.appendChild(emptyState);
    emptyState.classList.remove('hidden');
}

function resetForm() {
    selectedFile = null;
    imagePreview.src = '';
    imagePreview.classList.add('hidden');
    uploadPlaceholder.classList.remove('hidden');
    uploadForm.reset();
    dropZone.style.borderStyle = 'dashed';
    dropZone.style.borderColor = 'var(--border)';
}

function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    const btnText = submitBtn.querySelector('.btn-text');
    const loader  = submitBtn.querySelector('.loader');
    btnText.classList.toggle('hidden', isLoading);
    loader.classList.toggle('hidden', !isLoading);
}

// ==========================================
// Material Form (Category 2)
// ==========================================
function setupMaterialForm() {
    if (!matForm) return;
    matForm.addEventListener('submit', async e => {
        e.preventDefault();
        await saveMaterial(false);
    });
    matExcludeBtn?.addEventListener('click', async e => {
        e.preventDefault();
        await saveMaterial(true);
    });
}

async function fetchMaterials() {
    try {
        const { data, error } = await supabaseClient.from('materials').select('*').order('created_at', { ascending: false });
        if (error) {
            console.warn('Materials table error:', error);
            const saved = localStorage.getItem('rj_mock_materials');
            if (saved) { materialsItems = JSON.parse(saved); renderMaterials(); }
            else showMatEmptyState();
            return;
        }

        // Smart diff — only re-render if data actually changed
        const newJson = JSON.stringify(data);
        const oldJson = JSON.stringify(materialsItems);
        if (newJson !== oldJson) {
            materialsItems = data || [];
            renderMaterials();
            // Reactively recalculate all calculator rows with new material data
            recalculateAllCalcRows();
            console.log('[Fetch] Materials updated, items:', materialsItems.length);
        }
    } catch (err) {
        console.error('Fetch materials error:', err);
    }
}

async function saveMaterial(isPrivateForce = null) {
    const code    = matCodeInput.value.trim();
    const gold    = matGoldInput.value.trim();
    const diamond = matDiamondInput.value.trim();
    const other   = matOtherInput.value.trim();
    const making  = matMakingInput.value.trim();
    const editId  = matEditId.value;

    if (!code || !gold || !diamond || !other || !making) {
        showToast('All fields are required.', 'error');
        return;
    }

    // Determine privacy: use the forced value from button click if provided
    let isPrivate = isPrivateForce !== null ? isPrivateForce : false;

    let existsInCat1 = catalogItems.find(i => (i.product_code || '').toLowerCase() === code.toLowerCase());
    
    // If not private and doesn't exist in catalog, error out
    if (!isPrivate && !existsInCat1) {
        showToast('❌ Code not found in Catalog (Category 1)', 'error');
        matCodeInput.focus();
        return;
    }

    const existingMat = materialsItems.find(i => (i.product_code || '').toLowerCase() === code.toLowerCase());
    if (existingMat && existingMat.id.toString() !== editId) {
        showToast('❌ Materials already assigned for this code.', 'error');
        matCodeInput.focus();
        return;
    }

    const payload = { product_code: code, gold, diamond, other_making: other, making };

    try {
        if (isConnected && supabaseClient) {
            // Ensure product exists in Catalog if being saved as private but missing
            if (isPrivate && !existsInCat1) {
                let catPayload = { product_code: code, is_private: true, note: 'Private Code [HIDDEN]' };
                let { data: newProd, error: prodErr } = await supabaseClient
                    .from('catalog')
                    .insert([catPayload])
                    .select();
                
                // Fallback if is_private column doesn't exist
                if (prodErr) {
                    delete catPayload.is_private;
                    const { data: retryData, error: retryErr } = await supabaseClient.from('catalog').insert([catPayload]).select();
                    if (retryErr) throw retryErr;
                    newProd = retryData;
                }

                if (newProd && newProd[0]) {
                    if (!catalogItems.find(i => i.id === newProd[0].id)) {
                        catalogItems.unshift(newProd[0]);
                    }
                    existsInCat1 = newProd[0];
                }
            } else if (existsInCat1) {
                // Update privacy status if it changed
                const isCurrentlyPrivate = existsInCat1.is_private === true || (existsInCat1.note && existsInCat1.note.includes('[HIDDEN]'));
                if (isPrivate !== isCurrentlyPrivate) {
                    let updatePayload = { is_private: isPrivate };
                    if (isPrivate) {
                         if (!existsInCat1.note || !existsInCat1.note.includes('[HIDDEN]')) {
                             updatePayload.note = (existsInCat1.note || '') + ' [HIDDEN]';
                         }
                    } else {
                         updatePayload.note = (existsInCat1.note || '').replace(' [HIDDEN]', '').trim();
                    }

                    const { error: updErr } = await supabaseClient.from('catalog').update(updatePayload).eq('id', existsInCat1.id);
                    if (updErr) {
                        // Fallback retry without is_private column
                        delete updatePayload.is_private;
                        await supabaseClient.from('catalog').update(updatePayload).eq('id', existsInCat1.id);
                    }
                }
            }

            if (editId) {
                const { error } = await supabaseClient.from('materials').update(payload).eq('id', editId);
                if (error) throw error;
                showToast('✦ Material updated!', 'success');
            } else {
                const { error } = await supabaseClient.from('materials').insert([payload]);
                if (error) throw error;
                showToast('✦ Material saved!', 'success');
            }
        } else {
            // Local Mock behavior
            if (isPrivate && !existsInCat1) {
                const newItem = { id: Date.now() + 1, product_code: code, is_private: true, note: 'Private Code [HIDDEN]', created_at: new Date().toISOString() };
                catalogItems.unshift(newItem);
                localStorage.setItem('rj_mock_catalog', JSON.stringify(catalogItems));
            } else if (existsInCat1) {
                existsInCat1.is_private = isPrivate;
                if (isPrivate) {
                   if (!existsInCat1.note.includes('[HIDDEN]')) existsInCat1.note += ' [HIDDEN]';
                } else {
                   existsInCat1.note = existsInCat1.note.replace(' [HIDDEN]', '');
                }
                localStorage.setItem('rj_mock_catalog', JSON.stringify(catalogItems));
            }
            saveMaterialMock(payload, editId);
        }
        resetMatForm();
        renderMaterials(); // Refresh materials list immediately
        renderCatalog();   // Refresh catalog to hide/show items based on privacy
    } catch (err) {
        console.error('Save material error:', err);
        // Ensure UI updates even on partial failure
        saveMaterialMock(payload, editId);
        resetMatForm();
        renderMaterials();
    }
}

function saveMaterialMock(payload, editId) {
    if (editId) {
        const idx = materialsItems.findIndex(i => i.id.toString() === editId);
        if (idx !== -1) materialsItems[idx] = { ...materialsItems[idx], ...payload };
        showToast('✦ Material updated!', 'success');
    } else {
        materialsItems.unshift({ id: Date.now(), ...payload, created_at: new Date().toISOString() });
        showToast('✦ Material saved!', 'success');
    }
    localStorage.setItem('rj_mock_materials', JSON.stringify(materialsItems));
    renderMaterials();
    recalculateAllCalcRows();
}

function renderMaterials() {
    if (materialsItems.length === 0) { showMatEmptyState(); return; }
    matEmptyState?.classList.add('hidden');
    if (matList) matList.innerHTML = materialsItems.map(generateMatItemHTML).join('');
    updateBadge(tabBadgeManager, materialsItems.length);
    updateBadge(matCountBadge, materialsItems.length);
}

function generateMatItemHTML(item) {
    const sc = (s) => (s || '').replace(/'/g, "\\'");
    return `
        <tr id="mat-item-${item.id}">
            <td><span class="code-tag">${item.product_code}</span></td>
            <td>${item.gold}</td>
            <td>${item.diamond}</td>
            <td>${item.other_making}</td>
            <td>${item.making}</td>
            <td>
                <div class="tbl-actions">
                    <button class="btn-icon edit" onclick="editMaterial(${item.id},'${sc(item.product_code)}','${sc(item.gold)}','${sc(item.diamond)}','${sc(item.other_making)}','${sc(item.making)}')" title="Edit">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                    </button>
                    <button class="btn-icon delete" onclick="deleteMaterial(${item.id})" title="Delete">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </td>
        </tr>`;
}

function showMatEmptyState() {
    if (matList) matList.innerHTML = '';
    matEmptyState?.classList.remove('hidden');
}

function resetMatForm() {
    matForm?.reset();
    matEditId.value = '';
    const btn = document.querySelector('#mat-submit-btn .btn-text');
    if (btn) btn.textContent = '💾 Save Details';
}

window.editMaterial = function(id, code, gold, diamond, other, making) {
    matEditId.value      = id;
    matCodeInput.value   = code;
    matGoldInput.value   = gold;
    matDiamondInput.value = diamond;
    matOtherInput.value  = other;
    matMakingInput.value = making;
    
    const btn = document.querySelector('#mat-submit-btn .btn-text');
    if (btn) btn.textContent = '✏️ Update Details';
    switchView('nav-manager');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteMaterial = async function(id) {
    if (!confirm('Delete this material? The matching product in the Catalog will also be removed.')) return;
    const mat = materialsItems.find(i => i.id === id);
    try {
        if (isConnected && supabaseClient) {
            const { error } = await supabaseClient.from('materials').delete().eq('id', id);
            if (error) throw error;
            // Also delete the matched product from catalog
            if (mat) {
                const { error: catErr } = await supabaseClient.from('catalog').delete().ilike('product_code', mat.product_code);
                if (catErr) console.error('Catalog cascade delete error:', catErr);
            }
        } else {
            materialsItems = materialsItems.filter(i => i.id !== id);
            localStorage.setItem('rj_mock_materials', JSON.stringify(materialsItems));
            renderMaterials();
            // Cascade to catalog in local mode
            if (mat) {
                catalogItems = catalogItems.filter(i => (i.product_code || '').toLowerCase() !== (mat.product_code || '').toLowerCase());
                localStorage.setItem('rj_mock_catalog', JSON.stringify(catalogItems));
                renderCatalog();
            }
        }
        updateBadge(tabBadgeManager, materialsItems.length);
        showToast('Material & catalog entry deleted.', 'warning');
    } catch (err) {
        console.error('Delete material error:', err);
        materialsItems = materialsItems.filter(i => i.id !== id);
        localStorage.setItem('rj_mock_materials', JSON.stringify(materialsItems));
        renderMaterials();
    }
};

// ==========================================
// Calculator (Category 3)
// ==========================================
function setupCalculator() {
    [calcDollarInput, calcOunceInput, calcDirhamInput, calcPurityInput].forEach(input => {
        input?.addEventListener('input', calculatePerGram);
    });
    addCalcRowBtn?.addEventListener('click', addCalcRow);

    // Sync Dollar Rate via Firebase Firestore
    try {
        const db = firebase.firestore();
        db.collection('settings').doc('global').onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                if (data.dollarRate !== undefined && document.activeElement !== calcDollarInput) {
                    calcDollarInput.value = data.dollarRate;
                    calculatePerGram(false);
                }
            } else {
                const savedRate = localStorage.getItem('rj_price_list_dollar');
                if (savedRate && savedRate !== "0" && calcDollarInput) {
                    calcDollarInput.value = savedRate;
                    calculatePerGram(true);
                }
            }
        }, err => {
            console.error("Firestore sync error:", err);
            const savedRate = localStorage.getItem('rj_price_list_dollar');
            if (savedRate && savedRate !== "0" && calcDollarInput && !calcDollarInput.value) {
                calcDollarInput.value = savedRate;
                calculatePerGram(false);
            }
        });
    } catch(e) {
        console.error("Firebase not initialized for settings", e);
    }
}

function calculatePerGram(eventOrSync = true) {
    const shouldSync = eventOrSync !== false;
    const dollar = parseFloat(calcDollarInput?.value) || 0;
    const ounce  = parseFloat(calcOunceInput?.value)  || 31.1;
    const dirham = parseFloat(calcDirhamInput?.value) || 3.675;
    const purity = parseFloat(calcPurityInput?.value) || 0.75;

    if (dollar <= 0) {
        currentPerGram = 0;
        calcPerGramDisplay.textContent = '0.00';
    } else {
        currentPerGram = (dollar / ounce) * dirham * purity;
        calcPerGramDisplay.textContent = currentPerGram.toFixed(2);
        calcPerGramDisplay.classList.remove('updated');
        void calcPerGramDisplay.offsetWidth;
        calcPerGramDisplay.classList.add('updated');
    }

    if (shouldSync && calcDollarInput) {
        localStorage.setItem('rj_price_list_dollar', dollar || "");
        try {
            firebase.firestore().collection('settings').doc('global').set({ dollarRate: dollar || "" }, { merge: true }).catch(console.error);
        } catch(e) {}
    }

    recalculateAllCalcRows();
}

// Reactively recalculate ALL calculator rows — called on rate change, material update, or catalog update
function recalculateAllCalcRows() {
    document.querySelectorAll('#calc-product-list tr').forEach(tr => {
        const input = tr.querySelector('.calc-code-input');
        if (input?.value.trim()) validateAndCalculateRow(tr);
    });
}

function addCalcRow() {
    calcEmptyState?.classList.add('hidden');
    calcRowIdCounter++;

    const tr = document.createElement('tr');
    tr.id = `calc-row-${calcRowIdCounter}`;
    tr.innerHTML = `
        <td>
            <input type="text" class="calc-code-input">
            <div class="calc-status"></div>
        </td>
        <td class="c-gold">—</td>
        <td class="c-gold-price">—</td>
        <td class="c-diamond">—</td>
        <td class="c-other">—</td>
        <td class="c-making">—</td>
        <td class="c-total">—</td>
        <td>
            <input type="number" class="calc-pct-input" placeholder="%" min="0" step="0.1">
        </td>
        <td class="c-final-val">—</td>
        <td>
            <button class="btn-icon delete" onclick="removeCalcRow('calc-row-${calcRowIdCounter}')" title="Remove">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
        </td>`;

    calcProductList.appendChild(tr);

    const input = tr.querySelector('.calc-code-input');
    const pctInput = tr.querySelector('.calc-pct-input');
    input.addEventListener('change',  () => validateAndCalculateRow(tr));
    input.addEventListener('keypress', e => { if (e.key === 'Enter') validateAndCalculateRow(tr); });
    pctInput.addEventListener('input', () => validateAndCalculateRow(tr));
    input.focus();
}

window.removeCalcRow = function(id) {
    const el = document.getElementById(id);
    if (el) { el.style.animation = 'rowFadeOut 0.2s ease forwards'; setTimeout(() => el.remove(), 200); }
    setTimeout(() => {
        if (calcProductList?.children.length === 0) calcEmptyState?.classList.remove('hidden');
    }, 250);
};

function validateAndCalculateRow(tr) {
    const input     = tr.querySelector('.calc-code-input');
    const statusDiv = tr.querySelector('.calc-status');
    const code      = input.value.trim();

    const tdGold      = tr.querySelector('.c-gold');
    const tdGoldPrice = tr.querySelector('.c-gold-price');
    const tdDiamond   = tr.querySelector('.c-diamond');
    const tdOther     = tr.querySelector('.c-other');
    const tdMaking    = tr.querySelector('.c-making');
    const tdTotal     = tr.querySelector('.c-total');
    const pctInput    = tr.querySelector('.calc-pct-input');
    const tdFinal     = tr.querySelector('.c-final-val');

    const resetRow = () => {
        [tdGold, tdGoldPrice, tdDiamond, tdOther, tdMaking, tdTotal, tdFinal].forEach(td => { if (td) td.textContent = '—'; });
    };

    if (!code) {
        statusDiv.textContent = '';
        input.style.borderColor = 'var(--border)';
        resetRow();
        return;
    }

    const inCatalog    = catalogItems.find(i => (i.product_code || '').toLowerCase() === code.toLowerCase());
    const mat          = materialsItems.find(i => (i.product_code || '').toLowerCase() === code.toLowerCase());
    
    // Recognition: Code is valid if it exists in EITHER the catalog OR materials list
    if (!inCatalog && !mat) {
        statusDiv.innerHTML = '<span class="invalid-code">❌ Code not found</span>';
        input.style.borderColor = '#ef4444';
        resetRow(); return;
    }

    if (!mat) {
        statusDiv.innerHTML = '<span class="invalid-code">❌ No materials assigned</span>';
        input.style.borderColor = '#ef4444';
        resetRow(); return;
    }

    statusDiv.innerHTML = '<span class="verified">✅ Verified</span>';
    input.style.borderColor = '#22c55e';

    const goldVal    = parseFloat(mat.gold)         || 0;
    const diamondVal = parseFloat(mat.diamond)       || 0;
    const otherVal   = parseFloat(mat.other_making)  || 0;
    const makingVal  = parseFloat(mat.making)        || 0;

    tdGold.textContent    = mat.gold;
    tdDiamond.textContent = mat.diamond;
    tdOther.textContent   = mat.other_making;
    tdMaking.textContent  = mat.making;

    if (currentPerGram <= 0) {
        tdGoldPrice.innerHTML = '<span style="font-size:0.78rem;color:#f59e0b;">⚠ Set dollar rate</span>';
        tdTotal.textContent = '—';
        if (tdFinal) tdFinal.textContent = '—';
        if (!window._warnedDollar) {
            showToast('⚠️ Enter a Dollar rate in Section 1 first.', 'warning');
            window._warnedDollar = true;
        }
    } else {
        window._warnedDollar = false;
        const goldPrice = goldVal * currentPerGram;
        const total     = goldPrice + diamondVal + otherVal + makingVal;
        tdGoldPrice.textContent = goldPrice.toFixed(2);
        tdTotal.textContent = total.toFixed(2);
        
        const pct = parseFloat(pctInput.value);
        if (!isNaN(pct) && pct > 0 && pct < 100) {
            const finalVal = (total / (100 - pct)) * 100;
            const addAmount = finalVal - total;
            tdFinal.innerHTML = `<div style="display:flex;flex-direction:column;line-height:1.2"><span class="total-amount">${finalVal.toFixed(2)}</span><span style="font-size:0.7rem;color:var(--text-3); font-weight:600;">(+${addAmount.toFixed(2)})</span></div>`;
        } else {
            tdFinal.innerHTML = `<span class="total-amount">${total.toFixed(2)}</span>`;
        }
    }
}

// ==========================================
// Notifications & Activity Log
// ==========================================
let notifications = [];

// Load from local storage for persistence across reloads
try {
    const cached = localStorage.getItem('rj_activity_logs');
    if (cached) {
        let parsed = JSON.parse(cached);
        // Clean out notifications older than 7 days
        const sevenDaysLimit = 7 * 24 * 60 * 60 * 1000;
        parsed = parsed.filter(n => (Date.now() - new Date(n.time).getTime()) < sevenDaysLimit);
        notifications = parsed;
    }
} catch (e) {
    console.error('Error loading notifications', e);
}

function addNotification(type, table, oldData, newData) {
    // Only add if there is actually a difference in updates
    if (type === 'UPDATE') {
        if (table === 'catalog' && oldData.product_code === newData.product_code && oldData.note === newData.note) return;
        if (table === 'materials' && oldData.gold === newData.gold && oldData.diamond === newData.diamond && oldData.other_making === newData.other_making && oldData.making === newData.making) return;
    }

    const notif = {
        id: Date.now().toString() + Math.floor(Math.random()*1000).toString(),
        type,
        table,
        oldData,
        newData,
        time: new Date(),
        restored: false,
        read: false
    };
    notifications.unshift(notif);
    if (notifications.length > 50) notifications.pop();
    
    localStorage.setItem('rj_activity_logs', JSON.stringify(notifications));

    const badge = document.getElementById('notif-badge');
    const dropdown = document.getElementById('notif-dropdown');
    if (dropdown && dropdown.classList.contains('hidden')) {
        if (badge) badge.classList.remove('hidden');
    } else {
        notif.read = true; // if open, mark read immediately
        localStorage.setItem('rj_activity_logs', JSON.stringify(notifications));
    }
    
    renderNotifications();
}

function renderNotifications() {
    const list = document.getElementById('notif-list');
    if (!list) return;
    if (notifications.length === 0) {
        list.innerHTML = `<div style="padding:15px; text-align:center; color:var(--text-3); font-size:0.8rem;">No recent alerts.</div>`;
        return;
    }
    
    list.innerHTML = notifications.map(n => {
        let title = '';
        let desc = '';
        const code = n.oldData.product_code || 'Unknown';
        
        if (n.type === 'DELETE') {
            title = `<span style="color:#ef4444">Deleted: ${code}</span>`;
            if (n.table === 'catalog') {
                desc = `Product removed from library.`;
            } else {
                desc = `Material assignment removed. (Gold: ${n.oldData.gold}, Dia: ${n.oldData.diamond})`;
            }
        } else if (n.type === 'UPDATE') {
            title = `<span style="color:#fde047">Edited: ${code}</span>`;
            if (n.table === 'catalog') {
                const oldNote = n.oldData.note || 'None';
                const newNote = n.newData.note || 'None';
                if (n.oldData.product_code !== n.newData.product_code) {
                    desc = `Code changed from <b>${n.oldData.product_code}</b> to <b>${n.newData.product_code}</b>.`;
                } else {
                    desc = `Note changed from "${oldNote}" to "${newNote}".`;
                }
            } else {
                desc = `Values updated for material assignment.`;
            }
        }
        
        const timeStr = new Date(n.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // Build Hidden Details Panel
        let detailedDesc = '';
        const imgUrl = n.oldData?.image_url || n.newData?.image_url;
        if (imgUrl) detailedDesc += `<img src="${imgUrl}" style="width:100%; max-height:140px; object-fit:cover; border-radius:6px; margin-bottom:10px; border:1px solid var(--border);">`;
        
        detailedDesc += `<div style="font-size:0.75rem; color:var(--text); margin-bottom:5px;"><strong>Product Code/ID:</strong> ${code}</div>`;
        
        if (n.type === 'DELETE') {
            detailedDesc += `<div style="font-size:0.75rem; color:var(--text-2); font-family:monospace; line-height:1.6;">`;
            Object.keys(n.oldData).forEach(k => {
                if (k !== 'image_url' && k !== 'id' && n.oldData[k] !== null && n.oldData[k] !== '') {
                    detailedDesc += `<div>${k}: <span style="color:var(--text);">${n.oldData[k]}</span></div>`;
                }
            });
            detailedDesc += `</div>`;
        } else if (n.type === 'UPDATE') {
            detailedDesc += `<div style="font-size:0.75rem; color:var(--text-3); font-family:monospace; line-height:1.6;">`;
            Object.keys(n.newData).forEach(k => {
                if (k !== 'image_url' && k !== 'id' && k !== 'created_at') {
                    const oldV = n.oldData[k];
                    const newV = n.newData[k];
                    if (oldV !== newV) {
                        detailedDesc += `<div>${k}: <span style="text-decoration:line-through;color:#ef4444">${oldV||'none'}</span> ➔ <span style="color:#34d399;font-weight:600;">${newV||'none'}</span></div>`;
                    }
                }
            });
            detailedDesc += `</div>`;
        }
        
        let restoreBtn = '';
        if (n.type === 'DELETE' && !n.restored) {
            restoreBtn = `<button class="btn btn-outline" style="padding:4px 8px; font-size:0.7rem; color:#34d399; border-color:#34d399;" onclick="restoreNotification('${n.id}')">Restore Item</button>`;
        } else if (n.type === 'DELETE' && n.restored) {
            restoreBtn = `<span style="font-size:0.75rem; color:#34d399; font-weight:700;">✓ Restored</span>`;
        }

        const uid = 'view-details-' + n.id;
        const bg = n.read ? 'transparent' : 'rgba(253,224,71,0.05)';
        return `
            <div style="padding:14px 15px; border-bottom:1px solid var(--border); display:flex; flex-direction:column; font-size:0.82rem; background:${bg};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
                    <strong style="color:var(--text); font-size:0.87rem;">${title}</strong>
                    <span style="font-size:0.65rem; color:var(--text-3); font-weight:600;">${timeStr}</span>
                </div>
                <div style="color:var(--text); line-height:1.4; margin-bottom:10px;">${desc}</div>
                
                <div style="display:flex; gap:8px; align-items:center;">
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.7rem; color:var(--text-2); border-color:var(--border);" onclick="document.getElementById('${uid}').classList.toggle('hidden')">View Details</button>
                    ${restoreBtn}
                </div>
                
                <div id="${uid}" class="hidden" style="margin-top:12px; padding:12px; background:var(--surface-2); border-radius:6px; border:1px solid var(--border);">
                    ${detailedDesc}
                </div>
            </div>
        `;
    }).join('');
}

window.restoreNotification = async function(id) {
    const notif = notifications.find(n => n.id === id);
    if (!notif) return;
    
    if (!confirm(`Restore ${notif.oldData.product_code}?`)) return;
    
    const toInsert = { ...notif.oldData };
    delete toInsert.id;
    delete toInsert.created_at;
    
    try {
        if (!isConnected || !supabaseClient) throw new Error("Not connected to database");
        const { error } = await supabaseClient.from(notif.table).insert([toInsert]);
        if (error) throw error;
        showToast('Item restored successfully', 'success');
        notif.restored = true;
        renderNotifications();
    } catch (err) {
        console.error('Restore error:', err);
        showToast('Failed to restore item', 'error');
    }
};

// ==========================================
// Start App
// ==========================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Ensure notification UI logic hooks up on load
document.addEventListener('DOMContentLoaded', () => {
    const wrap = document.getElementById('notif-wrap');
    const dropdown = document.getElementById('notif-dropdown');
    const badge = document.getElementById('notif-badge');
    
    // Show badge if there are unread notifications on load
    if (notifications.some(n => !n.read)) {
        badge?.classList.remove('hidden');
    }
    
    wrap?.addEventListener('click', (e) => {
        if (e.target.closest('button')) return; 
        const isHidden = dropdown.classList.contains('hidden');
        if (isHidden) {
            dropdown.classList.remove('hidden');
            badge?.classList.add('hidden');
            let needsSave = false;
            notifications.forEach(n => {
                if (!n.read) { n.read = true; needsSave = true; }
            });
            if (needsSave) localStorage.setItem('rj_activity_logs', JSON.stringify(notifications));
            renderNotifications();
        } else {
            dropdown.classList.add('hidden');
        }
    });

    document.addEventListener('click', (e) => {
        if (wrap && !wrap.contains(e.target)) {
            dropdown?.classList.add('hidden');
        }
    });
});

// Download Calculator functionality
document.getElementById('download-calc-btn')?.addEventListener('click', async function handleDownload() {
    const originalCard = document.querySelector('.calc-product-card');
    if (!originalCard) return;

    try {
        showToast('Generating clear quotation...', 'success');

        const canvas = await html2canvas(originalCard, {
            backgroundColor: '#050a08', // Force the dark background
            scale: 3,
            useCORS: true,
            onclone: (clonedDoc) => {
                const clonedCard = clonedDoc.querySelector('.calc-product-card');
                
                // 1. Force every single piece of text to be BRIGHT WHITE
                const allElements = clonedCard.querySelectorAll('*');
                allElements.forEach(el => {
                    el.style.setProperty('color', '#FFFFFF', 'important');
                    el.style.setProperty('opacity', '1', 'important');
                    el.style.setProperty('-webkit-text-fill-color', '#FFFFFF', 'important');
                });

                // 2. Find all inputs and replace them with PURE TEXT spans
                const inputs = clonedCard.querySelectorAll('input');
                inputs.forEach(input => {
                    const val = input.value || input.placeholder || "";
                    const span = clonedDoc.createElement('span');
                    span.innerText = val;
                    span.style.cssText = `
                        color: #FFFFFF !important;
                        font-weight: bold !important;
                        font-size: 14px !important;
                        display: inline-block !important;
                    `;
                    input.parentNode.replaceChild(span, input);
                });

                // 3. Hide buttons and UI clutter
                clonedCard.querySelectorAll('button, .calc-status').forEach(el => el.style.display = 'none');
            }
        });

        // 4. Create the download link
        const link = document.createElement('a');
        link.download = `RJ_Quotation_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();

    } catch (e) {
        console.error('Download error:', e);
        showToast('Download failed', 'error');
    }
});
