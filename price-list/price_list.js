/**
 * Reliable Jewellery — Price List
 * Real-Time Sync | Supabase
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
let priceListItems = [];
let realtimeChannel = null;
let reconnectTimer = null;

let currentPerGram = 0;
let isUnlocked = false;
let uploadTargetId = null;
let globalFileInput = null;

// Preview DOM
const hoverPreview = document.getElementById('hover-preview');
const hoverPreviewImg = document.getElementById('hover-preview-img');

// Constants for hidden logic
const OUNCE_RATE = 31.1;
const DIRHAM_RATE = 3.675;
let PURITY = 0.75;

// ==========================================
// Item Name / With Stone Parsers
// ==========================================
function parseItemName(fullName) {
    if (!fullName) return { name: '', withStone: '' };
    const match = fullName.match(/^(.*?)\s*\[with_stone:([\d.]+)\]$/);
    if (match) {
        return { name: match[1].trim(), withStone: match[2] };
    }
    return { name: fullName.trim(), withStone: '' };
}

function serializeItemName(name, withStone) {
    const cleanName = name.trim();
    if (withStone !== undefined && withStone !== null && withStone !== '') {
        return `${cleanName} [with_stone:${withStone}]`;
    }
    return cleanName;
}

// ==========================================
// DOM References
// ==========================================
let toastEl, statusDot, connectionText, calcDollarInput, calcPerGramDisplay;
let addItemBtn, priceListTbody, listEmptyState, badgeVc, badgeMessika, badgeSilver, badgeOther;
let catTabs, masterEditBtn, puritySelect;

let currentCategory = 'VC';
let isEditingOrder = false;
let isAppEditing = false;
let sortableInstance = null;

// ==========================================
// Init & Supabase Setup
// ==========================================
function init() {
    // Initialize DOM references
    toastEl = document.getElementById('toast');
    statusDot = document.querySelector('.status-dot');
    connectionText = document.getElementById('connection-text');
    calcDollarInput = document.getElementById('calc-dollar');
    calcPerGramDisplay = document.getElementById('calc-per-gram');
    addItemBtn = document.getElementById('add-item-btn');
    priceListTbody = document.getElementById('price-list-tbody');
    listEmptyState = document.getElementById('list-empty-state');
    badgeVc = document.getElementById('badge-vc');
    badgeMessika = document.getElementById('badge-messika');
    badgeSilver = document.getElementById('badge-silver');
    badgeOther = document.getElementById('badge-other');
    catTabs = document.querySelectorAll('.cat-tab');
    masterEditBtn = document.getElementById('master-edit-btn');
    puritySelect = document.getElementById('purity-select');

    setupInputs();
    setupImageUpload();
    initSupabase();
    
    // Load local dollar rate and purity
    const savedPurity = localStorage.getItem('rj_price_list_purity');
    if (savedPurity && puritySelect) {
        puritySelect.value = savedPurity;
        PURITY = parseFloat(savedPurity) || 0.75;
    }

    const savedRate = localStorage.getItem('rj_price_list_dollar');
    if (savedRate && savedRate !== "0") {
        calcDollarInput.value = savedRate;
        calculatePerGram();
    } else {
        calcDollarInput.value = "";
        calcPerGramDisplay.textContent = "-";
    }

    // Manual Reconnect Click
    const connPill = document.querySelector('.connection-pill');
    if (connPill) {
        connPill.style.cursor = 'pointer';
        connPill.title = 'Click to reconnect';
        connPill.addEventListener('click', () => {
            showToast("Refreshing connection...");
            initSupabase();
        });
    }

    // Auto-refresh data if offline
    setInterval(() => {
        if (!isConnected) {
            console.log("Offline auto-refresh...");
            fetchData();
        }
    }, 60000); // Check every minute if offline
}

function showToast(message, type = 'default', duration = 3000) {
    toastEl.textContent = message;
    toastEl.className = `toast show ${type}`;
    setTimeout(() => toastEl.classList.remove('show'), duration);
}

function updateConnectionStatus(connected, label) {
    if (connected) {
        statusDot.className = 'status-dot online';
        connectionText.textContent = label || 'Live';
        isConnected = true;
    } else {
        if (label === 'Reconnecting…' || label === 'Connecting…') {
            statusDot.className = 'status-dot reconnecting';
        } else {
            statusDot.className = 'status-dot offline';
        }
        connectionText.textContent = label || 'Offline Local';
        isConnected = false;
    }
}

function initSupabase() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                realtime: { params: { eventsPerSecond: 10 } }
            });
            updateConnectionStatus(false, 'Connecting…');
            fetchData();
            subscribeRealtime();
        } catch (err) {
            console.error('Supabase init error:', err);
            updateConnectionStatus(false);
            setupLocalMock();
        }
    } else {
        setupLocalMock();
    }
}

function setupLocalMock() {
    const saved = localStorage.getItem('rj_mock_price_list');
    if (saved) {
        priceListItems = JSON.parse(saved);
        renderTable();
    } else {
        renderTable();
    }
}

async function fetchData() {
    try {
        const { data, error } = await supabaseClient.from('price_list').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        priceListItems = (data || []).map(item => {
            let cat = item.category || 'VC';
            if (typeof cat === 'string') {
                cat = cat.trim();
                if (cat === 'VC Jewellery' || cat === '') cat = 'VC';
            }
            return { ...item, margin_percentage: 0, category: cat };
        });
        renderTable();
        updateConnectionStatus(true, 'Live');
    } catch (err) {
        console.error('Fetch error:', err);
        setupLocalMock();
    }
}

// ==========================================
// Realtime
// ==========================================
function subscribeRealtime() {
    if (!supabaseClient) return;

    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }

    realtimeChannel = supabaseClient
        .channel(`pl-realtime-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'price_list' }, payload => {
            handleChanges(payload);
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                updateConnectionStatus(true, 'Live');
                clearTimeout(reconnectTimer);
                fetchData(); // Recover any data missed while offline
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                updateConnectionStatus(false, 'Reconnecting…');
                clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(subscribeRealtime, 4000);
            }
        });
}

function handleChanges(payload) {
    let newItem = payload.new;
    if (newItem) {
        let cat = newItem.category || 'VC';
        if (typeof cat === 'string') {
            cat = cat.trim();
            if (cat === 'VC Jewellery' || cat === '') cat = 'VC';
        }
        newItem.category = cat;
    }

    if (payload.eventType === 'INSERT') {
        if (!priceListItems.find(i => i.id === newItem.id)) {
            priceListItems.push({ ...newItem, margin_percentage: 0 });
            renderTable();
        }
    }
    if (payload.eventType === 'DELETE') {
        priceListItems = priceListItems.filter(i => i.id !== payload.old.id);
        renderTable();
    }
    if (payload.eventType === 'UPDATE') {
        const idx = priceListItems.findIndex(i => i.id === newItem.id);
        if (idx !== -1) {
            const localPercent = priceListItems[idx].margin_percentage || 0;
            priceListItems[idx] = { ...newItem, margin_percentage: localPercent };
        } else {
            priceListItems.push({ ...newItem, margin_percentage: 0 });
        }
        renderTable();
    }
}

// ==========================================
// Logic
// ==========================================

function setupInputs() {
    calcDollarInput.addEventListener('input', calculatePerGram);
    if (puritySelect) {
        puritySelect.addEventListener('change', (e) => {
            PURITY = parseFloat(e.target.value) || 0.75;
            localStorage.setItem('rj_price_list_purity', e.target.value);
            calculatePerGram();
        });
    }
    addItemBtn.addEventListener('click', () => {
        if (!isUnlocked) {
            const pin = prompt("Enter PIN to modify list:");
            if (pin === "7722") {
                isUnlocked = true;
                showToast("Editing Unlocked");
            } else {
                showToast("Incorrect PIN", "error");
                return;
            }
        }
        addNewItemRow();
    });

    catTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            catTabs.forEach(t => t.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            currentCategory = target.getAttribute('data-cat');
            renderTable();
        });
    });

    if (masterEditBtn) masterEditBtn.addEventListener('click', toggleMasterEdit);
}

function setupImageUpload() {
    globalFileInput = document.createElement('input');
    globalFileInput.type = 'file';
    globalFileInput.accept = 'image/*';
    globalFileInput.style.display = 'none';
    document.body.appendChild(globalFileInput);

    globalFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0] && uploadTargetId) {
            uploadImage(uploadTargetId, e.target.files[0]);
        }
    });
}

function triggerUpload(id) {
    uploadTargetId = id;
    globalFileInput.click();
}

function toggleMasterEdit() {
    if (!isAppEditing) {
        const pin = prompt("Enter PIN to edit table:");
        if (pin === "7722") {
            isAppEditing = true;
            isUnlocked = true;
            showToast("Edit Mode Active", "success");
        } else {
            showToast("Incorrect PIN", "error");
            return;
        }
    } else {
        isAppEditing = false;
        isEditingOrder = false; // Turn off reordering if it was on
        if (sortableInstance) {
            sortableInstance.destroy();
            sortableInstance = null;
        }
        priceListTbody.classList.remove('editing-order');
        const btn = document.getElementById('edit-order-btn');
        if (btn) {
            btn.style.color = '#667eea';
            btn.style.background = 'var(--surface-2)';
            btn.textContent = 'REORDER';
        }
        showToast("Table Locked");
    }
    
    // Update Master Edit Button UI
    const masterEditBtn = document.getElementById('master-edit-btn');
    if (isAppEditing) {
        masterEditBtn.classList.add('green');
        masterEditBtn.querySelector('span').textContent = 'Finish Editing';
    } else {
        masterEditBtn.classList.remove('green');
        masterEditBtn.querySelector('span').textContent = 'Edit Table';
    }

    renderTable();
}

function toggleEditOrder() {
    if (!isUnlocked && !isEditingOrder) {
        const pin = prompt("Enter PIN to unlock order editing:");
        if (pin === "7722") {
            isUnlocked = true;
        } else {
            showToast("Incorrect PIN", "error");
            return;
        }
    }

    isEditingOrder = !isEditingOrder;
    const btn = document.getElementById('edit-order-btn');
    
    if (isEditingOrder) {
        if (btn) {
            btn.style.color = '#fff';
            btn.style.background = '#22c55e';
            btn.style.borderColor = '#22c55e';
            btn.textContent = 'DONE';
        }
        priceListTbody.classList.add('editing-order');
        
        sortableInstance = new Sortable(priceListTbody, {
            animation: 150,
            handle: '.drag-handle',
            onEnd: async function () {
                const rows = Array.from(priceListTbody.querySelectorAll('tr:not(.sub-item-row)'));
                let updates = [];
                rows.forEach((row, index) => {
                    const id = row.id.replace('row-', '');
                    const item = priceListItems.find(i => i.id == id);
                    if (item && item.order_index !== index) {
                        item.order_index = index;
                        updates.push({ id: item.id, order_index: index });
                    }
                });
                
                if (updates.length > 0) {
                    if (isConnected && supabaseClient) {
                        try {
                            for (let u of updates) {
                                await supabaseClient.from('price_list').update({ order_index: u.order_index }).eq('id', u.id);
                            }
                        } catch (err) {
                            console.error('Order update error:', err);
                        }
                    } else {
                        localStorage.setItem('rj_mock_price_list', JSON.stringify(priceListItems));
                    }
                }
            }
        });
    } else {
        if (btn) {
            btn.style.color = '#667eea';
            btn.style.background = 'var(--surface-2)';
            btn.style.borderColor = '#667eea';
            btn.textContent = 'REORDER';
        }
        priceListTbody.classList.remove('editing-order');
        if (sortableInstance) {
            sortableInstance.destroy();
            sortableInstance = null;
        }
        renderTable();
    }
}

function requirePin(el) {
    if (!isUnlocked) {
        el.blur();
        const pin = prompt("Enter PIN to unlock editing:");
        if (pin === "7722") {
            isUnlocked = true;
            showToast("Editing Unlocked", "success");
            el.focus();
        } else {
            showToast("Incorrect PIN", "error");
        }
    }
}

function calculatePerGram() {
    const val = calcDollarInput.value;
    if (val === "" || val === null) {
        currentDollarRate = 0;
        currentPerGram = 0;
        calcPerGramDisplay.textContent = "-";
        localStorage.removeItem('rj_price_list_dollar');
        renderTable();
        return;
    }
    currentDollarRate = parseFloat(val) || 0;
    currentPerGram = (currentDollarRate / OUNCE_RATE) * DIRHAM_RATE * PURITY;
    calcPerGramDisplay.textContent = currentPerGram.toFixed(2);
    localStorage.setItem('rj_price_list_dollar', currentDollarRate);
    renderTable(); // Update derived values in table
}

async function addNewItemRow() {
    // Find the minimum order_index in current category to put new item at top
    const catItems = priceListItems.filter(i => (i.category || 'VC') === currentCategory);
    let minOrder = 0;
    if (catItems.length > 0) {
        minOrder = Math.min(...catItems.map(i => i.order_index ?? 0));
    }
    
    const newItem = {
        item_name: '',
        gold_weight: 0,
        diamond_cost: 0,
        other_cost: 0,
        making_charges: 0,
        margin_percentage: 0,
        category: currentCategory,
        order_index: minOrder - 1,
        isNew: true
    };

    if (isConnected && supabaseClient) {
        try {
            const supabaseItem = { ...newItem };
            delete supabaseItem.isNew;
            
            const { data, error } = await supabaseClient.from('price_list').insert([supabaseItem]).select('*');
            if (error) throw error;
            // The realtime listener handles UI adding, but let's push locally to avoid lag
            const insertedRow = data[0];
            if (!priceListItems.find(i => i.id === insertedRow.id)) {
                priceListItems.push({ ...insertedRow, isNew: true });
                renderTable();
            }
        } catch (err) {
            console.error('Insert error:', err);
            showToast(`Failed: ${err.message || 'Check console'}`, 'error');
        }
    } else {
        newItem.id = Date.now();
        priceListItems.push(newItem);
        localStorage.setItem('rj_mock_price_list', JSON.stringify(priceListItems));
        renderTable();
    }
}

async function updateItem(id, field, value) {
    const item = priceListItems.find(i => i.id === id);
    if (!item) return;
    
    // Optimistic local update
    let parsedVal = field === 'item_name' || field === 'image_url' ? value : (parseFloat(value) || 0);
    item[field] = parsedVal;
    
    if (field !== 'image_url') renderDerivedValues(id); // Instant visual update of calculated fields
    
    if (isConnected && supabaseClient) {
        try {
            const updates = { [field]: parsedVal };
            const { error } = await supabaseClient.from('price_list').update(updates).eq('id', id);
            if (error) throw error;
            showSaveStatus(id);
        } catch (err) {
            console.error('Update error:', err);
            showToast('Failed to sync change', 'error');
        }
    } else {
        localStorage.setItem('rj_mock_price_list', JSON.stringify(priceListItems));
        showSaveStatus(id);
    }
}

async function updateItemName(id, cleanName) {
    const item = priceListItems.find(i => i.id === id);
    if (!item) return;
    const parsed = parseItemName(item.item_name);
    const serialized = serializeItemName(cleanName, parsed.withStone);
    await updateItem(id, 'item_name', serialized);
}

async function updateItemWithStone(id, withStoneValue) {
    const item = priceListItems.find(i => i.id === id);
    if (!item) return;
    const parsed = parseItemName(item.item_name);
    const serialized = serializeItemName(parsed.name, withStoneValue);
    await updateItem(id, 'item_name', serialized);
}

function showSaveStatus(id) {
    const el = document.getElementById(`save-status-${id}`);
    if (el) {
        el.style.opacity = '1';
        setTimeout(() => { if (el) el.style.opacity = '0'; }, 2000);
    }
}

async function manualSave(id) {
    const item = priceListItems.find(i => i.id === id);
    if (item) item.isNew = false;
    showSaveStatus(id);
    renderTable();
    showToast("Item saved to list", "success");
}

async function uploadImage(id, file) {
    if (!isUnlocked) {
        const pin = prompt("Enter PIN to upload image:");
        if (pin !== "7722") { return showToast("Incorrect PIN", "error"); }
        isUnlocked = true;
    }

    if (!supabaseClient) {
        return showToast("Cannot upload image in local/mock mode", "error");
    }

    try {
        showToast("Uploading image...", "info");
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `price-list/${fileName}`;

        const { error: uploadError } = await supabaseClient.storage
            .from('catalog-images') // Reusing existing bucket
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabaseClient.storage
            .from('catalog-images')
            .getPublicUrl(filePath);

        await updateItem(id, 'image_url', publicUrl);
        renderTable(); 
        showToast("Image uploaded!", "success");
    } catch (err) {
        console.error('Upload error:', err);
        showToast(`Upload failed: ${err.message}`, "error");
    }
}

function showPreview(url) {
    if (!url) return;
    hoverPreviewImg.src = url;
    hoverPreview.style.display = 'flex';
    setTimeout(() => hoverPreview.classList.add('show'), 10);
}

function hidePreview() {
    hoverPreview.classList.remove('show');
    setTimeout(() => {
        if (!hoverPreview.classList.contains('show')) {
            hoverPreview.style.display = 'none';
        }
    }, 200);
}

async function deleteItemRow(id) {
    if (!isUnlocked) {
        const pin = prompt("Enter PIN to delete:");
        if (pin === "7722") {
            isUnlocked = true;
        } else {
            showToast("Incorrect PIN", "error");
            return;
        }
    }

    if (!confirm('Are you sure you want to delete this preset item?')) return;
    
    if (isConnected && supabaseClient) {
        try {
            const { error } = await supabaseClient.from('price_list').delete().eq('id', id);
            if (error) throw error;
            priceListItems = priceListItems.filter(i => i.id !== id);
            renderTable();
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Failed to delete item', 'error');
        }
    } else {
        priceListItems = priceListItems.filter(i => i.id !== id);
        localStorage.setItem('rj_mock_price_list', JSON.stringify(priceListItems));
        renderTable();
    }
}

// ==========================================
// Rendering
// ==========================================
function updateBadges() {
    let counts = { 'VC': 0, 'Messika': 0, 'Silver': 0, 'Other Jewellery': 0, 'per gram': 0 };
    priceListItems.forEach(i => {
        let cat = (i.category || 'VC').trim();
        if (counts[cat] !== undefined) counts[cat]++;
    });
    if (badgeVc) badgeVc.textContent = counts['VC'];
    if (badgeMessika) badgeMessika.textContent = counts['Messika'];
    if (badgeSilver) badgeSilver.textContent = counts['Silver'];
    if (badgeOther) badgeOther.textContent = counts['Other Jewellery'];
    const badgePerGram = document.getElementById('badge-per-gram');
    if (badgePerGram) badgePerGram.textContent = counts['per gram'];
}

function renderTable() {
    updateBadges();

    const filteredItems = priceListItems
        .filter(i => (i.category || 'VC').trim() === currentCategory)
        .sort((a, b) => {
            const indexA = a.order_index ?? Number.MAX_SAFE_INTEGER;
            const indexB = b.order_index ?? Number.MAX_SAFE_INTEGER;
            return indexA - indexB;
        });

    // Toggle column visibility
    const reorderHeader = document.getElementById('reorder-col-header');
    if (reorderHeader) {
        if (isAppEditing) {
            reorderHeader.innerHTML = `<button id="edit-order-btn" class="btn" style="padding: 6px 12px; font-size: 0.75rem; background: ${isEditingOrder ? '#22c55e' : 'var(--surface-2)'}; border: 1px solid ${isEditingOrder ? '#22c55e' : '#667eea'}; color: ${isEditingOrder ? '#fff' : '#667eea'}; border-radius: 20px; cursor: pointer; transition: all 0.2s; white-space: nowrap;">${isEditingOrder ? 'DONE' : 'REORDER'}</button>`;
            document.getElementById('edit-order-btn').addEventListener('click', toggleEditOrder);
        } else {
            reorderHeader.textContent = '#';
        }
    }
    
    const hasNewItems = filteredItems.some(i => i.isNew);
    const actionsHeader = document.querySelector('th:last-child');
    if (actionsHeader) actionsHeader.style.display = (isAppEditing || hasNewItems) ? '' : 'none';

    listEmptyState.classList.toggle('hidden', filteredItems.length > 0);
    
    const rows = filteredItems.map((item, index) => {
        const parsed = parseItemName(item.item_name);

        // Calculations
        const goldPrice = currentPerGram * (parseFloat(item.gold_weight) || 0);
        const cost = goldPrice + (parseFloat(item.diamond_cost) || 0) + (parseFloat(item.other_cost) || 0) + (parseFloat(item.making_charges) || 0);
        const percentage = parseFloat(item.margin_percentage) || 0;
        let price = cost;
        if (percentage < 100 && percentage !== 0) {
            price = (cost / (100 - percentage)) * 100;
        }

        const isReadOnly = (!isAppEditing && !item.isNew) ? 'readonly' : '';
        const inputClass = (!isAppEditing && !item.isNew) ? 'table-input locked' : 'table-input';

        return `
            <tr id="row-${item.id}">
                <td style="font-size: 0.8rem; font-weight: 700; color: var(--text-3); text-align: center;">
                    <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                        <span class="drag-handle" title="Drag to reorder" style="padding: 4px;">
                            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        </span>
                        <span>${index + 1}</span>
                    </div>
                </td>
                <td class="item-img-cell">
                    <div class="item-thumb-container" ${item.isNew ? `onclick="triggerUpload(${item.id})"` : 'style="cursor: default;"'}>
                        ${item.image_url 
                            ? `<img src="${item.image_url}" class="item-thumb" alt="Product" 
                                    onmouseenter="showPreview('${item.image_url}')" 
                                    onmouseleave="hidePreview()"
                                    ${item.isNew ? `onclick="event.preventDefault(); event.stopPropagation(); triggerUpload(${item.id})"` : 'style="cursor: default;"'}
                                    style="user-select:none; pointer-events:auto;">`
                            : `<svg class="upload-icon" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="${!item.isNew ? 'opacity: 0.15;' : ''}"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m14-7l-5-5-5 5m5-5v12"/></svg>`}
                    </div>
                </td>
                <td>
                    <input type="text" class="${inputClass}" value="${parsed.name}" 
                           ${isReadOnly} onchange="updateItemName(${item.id}, this.value)" placeholder="Item Name">
                </td>
                <td>
                    <input type="number" class="${inputClass}" value="${item.gold_weight || ''}" step="0.01" 
                           ${isReadOnly} oninput="updateItem(${item.id}, 'gold_weight', this.value)" placeholder="0.00">
                </td>
                <td>
                    <input type="number" class="${inputClass}" value="${parsed.withStone || ''}" step="0.01" 
                           ${isReadOnly} onchange="updateItemWithStone(${item.id}, this.value)" placeholder="0.00">
                </td>
                <td>
                    <input type="number" class="${inputClass}" value="${item.diamond_cost || ''}" step="0.01" 
                           ${isReadOnly} oninput="updateItem(${item.id}, 'diamond_cost', this.value)" placeholder="0.00">
                </td>
                <td>
                    <input type="number" class="${inputClass}" value="${item.other_cost || ''}" step="0.01" 
                           ${isReadOnly} oninput="updateItem(${item.id}, 'other_cost', this.value)" placeholder="0.00">
                </td>
                <td>
                    <input type="number" class="${inputClass}" value="${item.making_charges || ''}" step="0.01" 
                           ${isReadOnly} oninput="updateItem(${item.id}, 'making_charges', this.value)" placeholder="0.00">
                </td>
                <td class="font-bold summary-val" id="cost-${item.id}">${cost.toFixed(2)}</td>
                <td>
                    <div style="display:flex;align-items:center;">
                        <input type="number" class="table-input percentage-input" value="${item.margin_percentage || ''}" step="0.1" 
                               oninput="updateItem(${item.id}, 'margin_percentage', this.value)" placeholder="0" style="width:60px; min-width: 60px; flex-shrink: 0;">
                        <span style="color:var(--text-3);margin-left:4px;">%</span>
                    </div>
                </td>
                <td class="font-bold summary-val success-text" id="price-${item.id}">${price.toFixed(2)}</td>
                <td style="width: 100px; ${(!isAppEditing && !item.isNew) ? 'display:none;' : ''}">
                    <div style="display:flex;align-items:center;">
                        ${item.isNew ? `
                        <button class="action-btn save-btn" onclick="manualSave(${item.id})" title="Save Changes" 
                                style="padding: 6px; color: #fff; background: #3b82f6; border-radius: 6px; margin-right: 4px; display:flex; align-items:center; justify-content:center;">
                            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        </button>` : ''}
                        <button class="action-btn delete-btn" onclick="deleteItemRow(${item.id})" title="Delete Item" style="padding: 4px;">
                            <svg width="16" height="16" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                        <span class="save-status" id="save-status-${item.id}" style="opacity: 0; transition: opacity 0.3s; color: #22c55e; margin-left: 2px; display:inline-flex;" title="Saved">
                            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                        </span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    priceListTbody.innerHTML = rows;
}

// Function to purely update derived numbers without re-rendering entire table/inputs
function renderDerivedValues(id) {
    const item = priceListItems.find(i => i.id === id);
    if (!item) return;

    const goldPrice = currentPerGram * (parseFloat(item.gold_weight) || 0);
    const cost = goldPrice + (parseFloat(item.diamond_cost) || 0) + (parseFloat(item.other_cost) || 0) + (parseFloat(item.making_charges) || 0);
    const percentage = parseFloat(item.margin_percentage) || 0;
    let price = cost;
    if (percentage < 100 && percentage !== 0) {
        price = (cost / (100 - percentage)) * 100;
    }

    const costEl = document.getElementById(`cost-${id}`);
    const priceEl = document.getElementById(`price-${id}`);
    
    if (costEl && priceEl) {
        costEl.textContent = cost.toFixed(2);
        priceEl.textContent = price.toFixed(2);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
