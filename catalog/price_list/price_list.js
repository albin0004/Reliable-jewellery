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

// Preview DOM
const hoverPreview = document.getElementById('hover-preview');
const hoverPreviewImg = document.getElementById('hover-preview-img');

// Constants for hidden logic
const OUNCE_RATE = 31.1;
const DIRHAM_RATE = 3.675;
const PURITY = 0.75;

// ==========================================
// DOM References
// ==========================================
const toastEl = document.getElementById('toast');
const statusDot = document.querySelector('.status-dot');
const connectionText = document.getElementById('connection-text');

const calcDollarInput = document.getElementById('calc-dollar');
const calcPerGramDisplay = document.getElementById('calc-per-gram');
const addItemBtn = document.getElementById('add-item-btn');
const priceListTbody = document.getElementById('price-list-tbody');
const listEmptyState = document.getElementById('list-empty-state');

// ==========================================
// Init & Supabase Setup
// ==========================================
function init() {
    setupInputs();
    initSupabase();
    
    // Load local dollar rate
    const savedRate = localStorage.getItem('rj_price_list_dollar');
    if (savedRate) {
        calcDollarInput.value = savedRate;
        calculatePerGram();
    }
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
        statusDot.className = 'status-dot offline';
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
        // Reset percentage to 0 on every fresh fetch as requested
        priceListItems = (data || []).map(item => ({ ...item, margin_percentage: 0 }));
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
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                updateConnectionStatus(false, 'Reconnecting…');
                statusDot.className = 'status-dot reconnecting';
                clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(subscribeRealtime, 4000);
            }
        });
}

function handleChanges(payload) {
    if (payload.eventType === 'INSERT') {
        if (!priceListItems.find(i => i.id === payload.new.id)) {
            priceListItems.push(payload.new);
            renderTable();
        }
    }
    if (payload.eventType === 'DELETE') {
        priceListItems = priceListItems.filter(i => i.id !== payload.old.id);
        renderTable();
    }
    if (payload.eventType === 'UPDATE') {
        const idx = priceListItems.findIndex(i => i.id === payload.new.id);
        if (idx !== -1) {
            // Keep local percentage if it was edited, or default to 0
            const localPercent = priceListItems[idx].margin_percentage || 0;
            priceListItems[idx] = { ...payload.new, margin_percentage: localPercent };
        } else {
            priceListItems.push({ ...payload.new, margin_percentage: 0 });
        }
        renderTable();
    }
}

// ==========================================
// Logic
// ==========================================

function setupInputs() {
    calcDollarInput.addEventListener('input', calculatePerGram);
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
    currentDollarRate = parseFloat(calcDollarInput.value) || 0;
    currentPerGram = (currentDollarRate / OUNCE_RATE) * DIRHAM_RATE * PURITY;
    calcPerGramDisplay.textContent = currentPerGram.toFixed(2);
    localStorage.setItem('rj_price_list_dollar', currentDollarRate);
    renderTable(); // Update derived values in table
}

async function addNewItemRow() {
    const newItem = {
        item_name: 'New Product',
        gold_weight: 0,
        diamond_cost: 0,
        other_cost: 0,
        making_charges: 0,
        margin_percentage: 0
    };

    if (isConnected && supabaseClient) {
        try {
            const { data, error } = await supabaseClient.from('price_list').insert([newItem]).select('*');
            if (error) throw error;
            // The realtime listener handles UI adding, but let's push locally to avoid lag
            const insertedRow = data[0];
            if (!priceListItems.find(i => i.id === insertedRow.id)) {
                priceListItems.push(insertedRow);
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
        } catch (err) {
            console.error('Update error:', err);
            showToast('Failed to sync change', 'error');
        }
    } else {
        localStorage.setItem('rj_mock_price_list', JSON.stringify(priceListItems));
    }
}

async function uploadImage(id, file) {
    if (!isUnlocked) {
        const pin = prompt("Enter PIN to upload image:");
        if (pin !== "7722") { return showToast("Incorrect PIN", "error"); }
        isUnlocked = true;
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
function renderTable() {
    listEmptyState.classList.toggle('hidden', priceListItems.length > 0);
    
    const rows = priceListItems.map(item => {
        // Calculations
        const goldPrice = currentPerGram * (parseFloat(item.gold_weight) || 0);
        const cost = goldPrice + (parseFloat(item.diamond_cost) || 0) + (parseFloat(item.other_cost) || 0) + (parseFloat(item.making_charges) || 0);
        const percentage = parseFloat(item.margin_percentage) || 0;
        let price = cost;
        if (percentage < 100 && percentage !== 0) {
            price = (cost / (100 - percentage)) * 100;
        }

        return `
            <tr id="row-${item.id}">
                <td class="item-img-cell">
                    <div class="item-thumb-container" onclick="document.getElementById('file-${item.id}').click()">
                        ${item.image_url 
                            ? `<img src="${item.image_url}" class="item-thumb" alt="Product" 
                                    onmouseenter="showPreview('${item.image_url}')" 
                                    onmouseleave="hidePreview()">`
                            : `<svg class="upload-icon" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m14-7l-5-5-5 5m5-5v12"/></svg>`}
                    </div>
                    <input type="file" id="file-${item.id}" hidden accept="image/*" 
                           onchange="uploadImage(${item.id}, this.files[0])">
                </td>
                <td>
                    <input type="text" class="table-input" value="${item.item_name}" 
                           onfocus="requirePin(this)" onchange="updateItem(${item.id}, 'item_name', this.value)" placeholder="Item Name">
                </td>
                <td>
                    <input type="number" class="table-input" value="${item.gold_weight || ''}" step="0.01" 
                           onfocus="requirePin(this)" oninput="updateItem(${item.id}, 'gold_weight', this.value)" placeholder="0.00">
                </td>
                <td>
                    <input type="number" class="table-input" value="${item.diamond_cost || ''}" step="0.01" 
                           onfocus="requirePin(this)" oninput="updateItem(${item.id}, 'diamond_cost', this.value)" placeholder="0.00">
                </td>
                <td>
                    <input type="number" class="table-input" value="${item.other_cost || ''}" step="0.01" 
                           onfocus="requirePin(this)" oninput="updateItem(${item.id}, 'other_cost', this.value)" placeholder="0.00">
                </td>
                <td>
                    <input type="number" class="table-input" value="${item.making_charges || ''}" step="0.01" 
                           onfocus="requirePin(this)" oninput="updateItem(${item.id}, 'making_charges', this.value)" placeholder="0.00">
                </td>
                <td class="font-bold summary-val" id="cost-${item.id}">${cost.toFixed(2)}</td>
                <td>
                    <div style="display:flex;align-items:center;">
                        <input type="number" class="table-input percentage-input" value="${item.margin_percentage || ''}" step="0.1" 
                               oninput="updateItem(${item.id}, 'margin_percentage', this.value)" placeholder="0" style="width:60px;">
                        <span style="color:var(--text-3);margin-left:4px;">%</span>
                    </div>
                </td>
                <td class="font-bold summary-val success-text" id="price-${item.id}">${price.toFixed(2)}</td>
                <td>
                    <button class="action-btn delete-btn" onclick="deleteItemRow(${item.id})" title="Delete Item">
                        <svg width="16" height="16" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
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
