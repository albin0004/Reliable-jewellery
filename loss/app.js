// ═══════════════════════════════════════════════════
// LOSS CALCULATION — REALTIME DATABASE & APP LOGIC
// ═══════════════════════════════════════════════════

// Global Firebase Realtime Database Configuration
const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyA7d3DYJSVRBgr6ZEWwOvARrpCQjVH15fg",
    authDomain: "losscalc-app.firebaseapp.com",
    databaseURL: "https://losscalc-app-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "losscalc-app",
    storageBucket: "losscalc-app.firebasestorage.app",
    messagingSenderId: "1066986355290",
    appId: "1:1066986355290:web:4fe06ef52c77d59fccb663"
};

// Global State
let state = {
    clients: [],
    firebaseConfig: DEFAULT_FIREBASE_CONFIG,
    pendingSyncQueue: [],
    isOnline: navigator.onLine,
    syncPingMs: 0,
    selectedClientIds: new Set(),
    imageOptimizationSettings: {
        maxDim: 800,
        quality: 0.75
    }
};

// UI State
let activeTab = 'workspace';
let selectedRowForPhoto = null; // { clientId, rowId }
let broadcastChannel = null;
let firebaseApp = null;
let firebaseDb = null;
let cropperInstance = null;
let isRemoteUpdateInProgress = false;
let isInitialCloudLoadComplete = false; // Flag to prevent pushing empty state before cloud snapshot completes

// DOM Elements
const sidebar = document.getElementById('sidebar');
const workspace = document.getElementById('workspace');
const pageTitle = document.getElementById('page-title');
const globalSearch = document.getElementById('global-search');
const statClients = document.getElementById('stat-clients');
const syncStatusBadge = document.getElementById('sync-status');
const cloudSyncStatusText = document.getElementById('cloud-sync-status-text');

// Modals
const addClientModal = document.getElementById('add-client-modal');
const clientNameInput = document.getElementById('client-name');
const clientSuggestions = document.getElementById('client-suggestions');
const clientMatchStatus = document.getElementById('client-match-status');
const btnSaveClient = document.getElementById('btn-save-client');
const btnCancelClient = document.getElementById('btn-cancel-client');
const btnCloseModal = document.getElementById('close-modal');

const syncSettingsModal = document.getElementById('sync-settings-modal');
const btnSyncSettings = document.getElementById('btn-sync-settings');
const firebaseConfigInput = document.getElementById('firebase-config');
const btnSaveSync = document.getElementById('btn-save-sync');
const btnCancelSync = document.getElementById('btn-cancel-sync');
const btnCloseSyncModal = document.getElementById('close-sync-modal');

const imageLightboxModal = document.getElementById('image-lightbox-modal');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxTitle = document.getElementById('lightbox-title');
const btnCloseLightbox = document.getElementById('close-lightbox');

// Image Cropper Modal Elements
const imageCropModal = document.getElementById('image-crop-modal');
const cropTargetImg = document.getElementById('crop-target-img');
const btnCloseCropModal = document.getElementById('close-crop-modal');
const btnCancelCrop = document.getElementById('btn-cancel-crop');
const btnApplyCrop = document.getElementById('btn-apply-crop');
const btnRotateLeft = document.getElementById('btn-rotate-left');
const btnRotateRight = document.getElementById('btn-rotate-right');
const btnResetCrop = document.getElementById('btn-reset-crop');

const itemPhotoInput = document.getElementById('item-photo-input');

// Dashboard Elements
const dashFromDate = document.getElementById('dash-from-date');
const dashToDate = document.getElementById('dash-to-date');
const dashClientSelect = document.getElementById('dash-client-select');
const btnResetFilters = document.getElementById('btn-reset-filters');

const dashTotalCol2 = document.getElementById('dash-total-col2');
const dashTotalCol3 = document.getElementById('dash-total-col3');
const dashTotalCol4 = document.getElementById('dash-total-col4');
const dashTotalRecd = document.getElementById('dash-total-recd');
const dashTotalLoss = document.getElementById('dash-total-loss');
const masterTableBody = document.getElementById('master-table-body');
const masterSheetCount = document.getElementById('master-sheet-count');

// ═══════════════════════════════════════════════════
// INITIALIZATION & REAL-TIME DATABASE ENGINE
// ═══════════════════════════════════════════════════
function init() {
    initBroadcastChannel();
    loadState();
    setupEventListeners();
    setupTabNavigation();
    initFirebaseIfConfigured();
    setupNetworkListeners();
    render();
}

// Real-Time Animated Toast Notification System
function showToastNotification(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const toastClass = (type === 'danger' || type.includes('http')) ? 'toast-danger' : (type === 'sync' ? 'toast-sync' : 'toast-success');
    toast.className = `toast ${toastClass}`;

    toast.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            ${toastClass === 'toast-danger' 
                ? '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>' 
                : toastClass === 'toast-sync' 
                ? '<polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>' 
                : '<polyline points="20 6 9 17 4 12"></polyline>'}
        </svg>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s forwards';
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
    }, 3500);
}

// Asynchronous Canvas Image Compression & Storage Optimizer
function compressImage(dataUrl, maxDim = 800, quality = 0.75) {
    return new Promise((resolve) => {
        if (!dataUrl || !dataUrl.startsWith('data:image')) {
            return resolve(dataUrl);
        }
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            try {
                const webpData = canvas.toDataURL('image/webp', quality);
                if (webpData && webpData.startsWith('data:image/webp')) {
                    return resolve(webpData);
                }
            } catch (e) {}
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

// Real-time Multi-Tab Broadcast Sync Engine
function initBroadcastChannel() {
    if ('BroadcastChannel' in window) {
        broadcastChannel = new BroadcastChannel('loss_calc_sync_channel');
        broadcastChannel.onmessage = (event) => {
            if (event.data && event.data.type === 'STATE_UPDATED') {
                console.log('⚡ Real-time local update received from another tab/window');
                state.clients = event.data.clients || [];
                render();
            }
        };
    }
}

function broadcastStateChange() {
    if (broadcastChannel) {
        broadcastChannel.postMessage({
            type: 'STATE_UPDATED',
            clients: state.clients
        });
    }
    syncToFirebase();
}

// Local Storage Loader & Auto Recovery
function loadState() {
    const saved = localStorage.getItem('lossCalcState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed.clients)) {
                state.clients = parsed.clients;
            } else if (Array.isArray(parsed)) {
                state.clients = parsed;
            }
            if (parsed.firebaseConfig) {
                state.firebaseConfig = parsed.firebaseConfig;
            }
            if (!state.firebaseConfig) {
                state.firebaseConfig = DEFAULT_FIREBASE_CONFIG;
            }
            if (firebaseConfigInput) {
                firebaseConfigInput.value = JSON.stringify(state.firebaseConfig, null, 2);
            }

            const today = new Date().toISOString().split('T')[0];
            state.clients.forEach(c => {
                if (!c.date) {
                    const rowDate = c.rows && c.rows.find(r => r.date)?.date;
                    c.date = rowDate || today;
                }
                if (c.rows) {
                    c.rows.forEach(r => {
                        if (!r.image) r.image = null;
                    });
                }
            });
        } catch (e) {
            console.error("Failed to parse state from storage", e);
        }
    }

    // Auto-recovery check: if state.clients is empty, scan local storage for any backup datasets
    if (!state.clients || state.clients.length === 0) {
        try {
            const backups = getAutoBackups();
            if (backups.length > 0 && backups[0].dataStr) {
                const restored = JSON.parse(backups[0].dataStr);
                if (Array.isArray(restored) && restored.length > 0) {
                    state.clients = restored;
                    console.log('🔄 Auto-restored data from local backup snapshot');
                }
            }
        } catch (e) {}
    }
}

// ═══════════════════════════════════════════════════
// AUTOMATIC BACKUP & DATA RECOVERY SYSTEM
// ═══════════════════════════════════════════════════

function createAutoBackup(label = 'Auto Save') {
    if (!state.clients || state.clients.length === 0) return;
    try {
        const backupsRaw = localStorage.getItem('lossCalcBackups');
        let backups = backupsRaw ? JSON.parse(backupsRaw) : [];
        if (!Array.isArray(backups)) backups = [];

        const currentDataStr = JSON.stringify(state.clients);
        if (backups.length > 0 && backups[0].dataStr === currentDataStr) {
            return;
        }

        const newBackup = {
            id: 'backup_' + Date.now(),
            timestamp: new Date().toISOString(),
            label: label,
            clientCount: state.clients.length,
            rowCount: state.clients.reduce((sum, c) => sum + (c.rows ? c.rows.length : 0), 0),
            dataStr: currentDataStr
        };

        backups.unshift(newBackup);
        if (backups.length > 10) backups = backups.slice(0, 10);

        localStorage.setItem('lossCalcBackups', JSON.stringify(backups));
        updateBackupUI();
    } catch (e) {
        console.warn('Could not save auto-backup', e);
    }
}

function getAutoBackups() {
    try {
        const backupsRaw = localStorage.getItem('lossCalcBackups');
        if (!backupsRaw) return [];
        const backups = JSON.parse(backupsRaw);
        return Array.isArray(backups) ? backups : [];
    } catch (e) {
        return [];
    }
}

function restoreBackup(backupId) {
    const backups = getAutoBackups();
    const target = backups.find(b => b.id === backupId);
    if (!target) return false;

    try {
        const restoredClients = JSON.parse(target.dataStr);
        if (Array.isArray(restoredClients)) {
            state.clients = mergeClientData(state.clients, restoredClients);
            saveState(true, true);
            render();
            showToastNotification(`Restored backup from ${new Date(target.timestamp).toLocaleString()}!`, 'sync');
            return true;
        }
    } catch (e) {
        console.error('Failed to restore backup', e);
    }
    return false;
}

function scanAndRecoverLostData() {
    const foundClients = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('loss') || key.includes('state') || key.includes('backup') || key.includes('client'))) {
            try {
                const val = localStorage.getItem(key);
                if (!val) continue;
                const parsed = JSON.parse(val);
                let candClients = null;
                if (Array.isArray(parsed)) candClients = parsed;
                else if (parsed && Array.isArray(parsed.clients)) candClients = parsed.clients;
                else if (parsed && parsed.dataStr) candClients = JSON.parse(parsed.dataStr);

                if (Array.isArray(candClients) && candClients.length > 0) {
                    candClients.forEach(c => {
                        if (c && c.id && c.name) foundClients.push(c);
                    });
                }
            } catch (e) {}
        }
    }

    if (foundClients.length > 0) {
        const beforeCount = state.clients.length;
        state.clients = mergeClientData(state.clients, foundClients);
        saveState(true, true);
        render();
        showToastNotification(`Scan complete! Recovered ${foundClients.length} client record(s) into your workspace!`, 'sync');
    } else {
        showToastNotification('Scan complete: No additional lost backups found in local storage.', 'sync');
    }
}

function updateBackupUI() {
    const container = document.getElementById('backup-list-container');
    if (!container) return;

    const backups = getAutoBackups();
    if (backups.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">No local backups stored yet.</p>`;
        return;
    }

    container.innerHTML = backups.map(b => {
        const timeStr = new Date(b.timestamp).toLocaleString();
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0; border-bottom: 1px dashed #cbd5e1; font-size: 0.82rem;">
                <div>
                    <strong>${b.label || 'Backup'}</strong> — <span style="color:var(--text-secondary);">${timeStr}</span>
                    <span style="display:block; font-size:0.75rem; color:var(--text-muted);">${b.clientCount} clients, ${b.rowCount} rows</span>
                </div>
                <button type="button" class="btn btn-secondary btn-restore-backup" data-backup-id="${b.id}" style="padding: 2px 8px; font-size: 0.75rem;">Restore</button>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.btn-restore-backup').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const bId = e.target.dataset.backupId;
            if (confirm('Restore this backup version? Current data will be safely merged with restored data.')) {
                restoreBackup(bId);
            }
        });
    });
}

function mergeClientData(localClients = [], remoteClients = []) {
    const mergedMap = new Map();

    const processClient = (c) => {
        if (!c || !c.id) return;
        const normName = normalizeClientName(c.name);

        let existingKey = null;
        for (let [key, existing] of mergedMap.entries()) {
            if (existing.id === c.id || (normName && normalizeClientName(existing.name) === normName)) {
                existingKey = key;
                break;
            }
        }

        if (!existingKey) {
            const clone = JSON.parse(JSON.stringify(c));
            if (!Array.isArray(clone.rows)) clone.rows = [];
            mergedMap.set(c.id, clone);
        } else {
            const target = mergedMap.get(existingKey);
            if (!target.date && c.date) target.date = c.date;

            const existingRowMap = new Map();
            target.rows.forEach(r => { if (r && r.id) existingRowMap.set(r.id, r); });

            (c.rows || []).forEach(r => {
                if (!r) return;
                if (r.id && existingRowMap.has(r.id)) {
                    const existingRow = existingRowMap.get(r.id);
                    if (r.item && (!existingRow.item || r.item.length > existingRow.item.length)) {
                        existingRow.item = r.item;
                    }
                    if (r.col3 !== undefined && r.col3 !== '') existingRow.col3 = r.col3;
                    if (r.col4 !== undefined && r.col4 !== '') existingRow.col4 = r.col4;
                    if (r.col5 !== undefined && r.col5 !== '') existingRow.col5 = r.col5;
                    if (r.image) existingRow.image = r.image;
                } else {
                    target.rows.push(JSON.parse(JSON.stringify(r)));
                    if (r.id) existingRowMap.set(r.id, r);
                }
            });
        }
    };

    (localClients || []).forEach(processClient);
    (remoteClients || []).forEach(processClient);

    return Array.from(mergedMap.values());
}

function saveState(notifyBroadcast = true, syncCloud = true) {
    localStorage.setItem('lossCalcState', JSON.stringify({
        clients: state.clients,
        firebaseConfig: state.firebaseConfig
    }));
    createAutoBackup('Auto Save');
    updateGlobalStats();
    if (notifyBroadcast && broadcastChannel) {
        broadcastChannel.postMessage({
            type: 'STATE_UPDATED',
            clients: state.clients
        });
    }
    if (syncCloud) {
        syncToFirebase();
    }
}

// Cloud Firebase Granular Real-time Synchronization & Deletion Engine
function initFirebaseIfConfigured() {
    if (state.firebaseConfig && window.firebase) {
        try {
            if (!firebaseApp) {
                firebaseApp = firebase.initializeApp(state.firebaseConfig);
                firebaseDb = firebase.database();
            }

            const clientsRef = firebaseDb.ref('loss_calc/clients');
            
            // Initial snapshot listener with bidirectional merging & overwrite prevention
            clientsRef.on('value', (snapshot) => {
                const data = snapshot.val();
                isRemoteUpdateInProgress = true;
                
                let remoteClients = [];
                if (data) {
                    remoteClients = Array.isArray(data) 
                        ? data.filter(Boolean) 
                        : Object.values(data);
                }

                // Smart bidirectional merge of local storage and cloud database
                const mergedClients = mergeClientData(state.clients, remoteClients);
                const isIdentical = JSON.stringify(mergedClients) === JSON.stringify(state.clients);
                
                state.clients = mergedClients;
                saveState(false, false);
                
                if (!isIdentical) {
                    render();
                }

                isInitialCloudLoadComplete = true;

                // Push back to Cloud if local had new data that Cloud missed
                if (JSON.stringify(mergedClients) !== JSON.stringify(remoteClients)) {
                    syncToFirebase(true);
                }

                updateSyncBadge(true, 'Cloud Sync Active');
                isRemoteUpdateInProgress = false;
            });

            // Granular Child Changed Listener for instant single-client node updates
            clientsRef.on('child_changed', (snapshot) => {
                const updatedClient = snapshot.val();
                if (updatedClient && updatedClient.id) {
                    isRemoteUpdateInProgress = true;
                    createAutoBackup('Before Remote Update');
                    const idx = state.clients.findIndex(c => c.id === updatedClient.id);
                    let hasChanged = false;

                    if (idx !== -1) {
                        const mergedClient = mergeClientData([state.clients[idx]], [updatedClient])[0];
                        if (JSON.stringify(state.clients[idx]) !== JSON.stringify(mergedClient)) {
                            state.clients[idx] = mergedClient;
                            hasChanged = true;
                        }
                    } else {
                        state.clients.push(updatedClient);
                        hasChanged = true;
                    }

                    if (hasChanged) {
                        saveState(false, false);
                        render();
                    }
                    isRemoteUpdateInProgress = false;
                }
            });

            // Instant Granular Remote Deletion Listener
            clientsRef.on('child_removed', (snapshot) => {
                if (!isInitialCloudLoadComplete) return;
                const deletedKey = snapshot.key;
                const deletedVal = snapshot.val();
                const deletedId = deletedKey || (deletedVal && deletedVal.id);
                
                if (deletedId) {
                    const beforeCount = state.clients.length;
                    createAutoBackup('Before Remote Deletion');
                    state.clients = state.clients.filter(c => c.id !== deletedId);
                    if (state.clients.length < beforeCount) {
                        saveState(false, false);
                        render();
                        showToastNotification('Remote sync: Client deleted instantly from server', 'sync');
                    }
                }
            });

            const cloudBadge = document.getElementById('cloud-sync-status-badge');
            if (cloudBadge) {
                cloudBadge.textContent = 'Active (Firebase Realtime DB)';
                cloudBadge.className = 'telemetry-value active';
            }
            if (cloudSyncStatusText) {
                cloudSyncStatusText.textContent = '☁️ Cloud Realtime DB: Connected & Synced! Multi-device changes merge and sync instantly.';
            }
            testFirebaseConnection();
            updateSyncBadge(true, 'Realtime Cloud Active');
        } catch (e) {
            console.error('Firebase init error:', e);
            updateSyncBadge(false, 'Local Mode');
        }
    } else {
        const cloudBadge = document.getElementById('cloud-sync-status-badge');
        if (cloudBadge) {
            cloudBadge.textContent = 'Local Standalone';
            cloudBadge.className = 'telemetry-value';
        }
        updateSyncBadge(true, 'Local Realtime Active');
    }
}

function syncToFirebase(force = false) {
    if (isRemoteUpdateInProgress || !firebaseDb) return;
    if (!force && !isInitialCloudLoadComplete) {
        console.log('⏳ Cloud sync deferred until initial remote load completes');
        return;
    }
    try {
        const clientMap = {};
        state.clients.forEach(c => {
            if (c && c.id) clientMap[c.id] = c;
        });
        firebaseDb.ref('loss_calc/clients').set(clientMap);
    } catch (e) {
        console.error('Firebase push error:', e);
    }
}

function deleteClientFromCloud(clientId) {
    if (firebaseDb && clientId) {
        try {
            firebaseDb.ref(`loss_calc/clients/${clientId}`).remove();
        } catch (e) {
            console.error('Firebase delete error:', e);
        }
    }
}

function testFirebaseConnection() {
    const pingSpan = document.getElementById('sync-ping');
    const broadcastStatus = document.getElementById('broadcast-status');
    if (broadcastStatus) {
        broadcastStatus.textContent = 'Active (Instant local tab relay)';
        broadcastStatus.className = 'telemetry-value active';
    }

    if (firebaseDb) {
        const start = Date.now();
        const testRef = firebaseDb.ref('loss_calc/_telemetry/ping');
        testRef.set(start).then(() => {
            const rtt = Date.now() - start;
            state.syncPingMs = rtt;
            if (pingSpan) pingSpan.textContent = `${rtt}ms`;
            showToastNotification(`Database ping test: ${rtt}ms latency`, 'sync');
        }).catch(err => {
            if (pingSpan) pingSpan.textContent = 'Offline';
            showToastNotification(`Cloud ping failed: ${err.message}`, 'danger');
        });
    } else {
        if (pingSpan) pingSpan.textContent = 'Local 0ms';
        showToastNotification('Running in local offline realtime mode', 'sync');
    }
}

function setupNetworkListeners() {
    window.addEventListener('online', () => {
        state.isOnline = true;
        updateSyncBadge(true, 'Reconnected');
        showToastNotification('Network connection restored! Resyncing database...', 'sync');
        if (firebaseDb) syncToFirebase();
    });

    window.addEventListener('offline', () => {
        state.isOnline = false;
        updateSyncBadge(false, 'Offline Mode');
        showToastNotification('Network offline. Changes saved in local queue.', 'danger');
    });
}

function updateSyncBadge(online, text) {
    if (syncStatusBadge) {
        const dot = syncStatusBadge.querySelector('.status-dot');
        const txt = syncStatusBadge.querySelector('.status-text');
        if (dot) dot.className = online ? 'status-dot online' : 'status-dot';
        if (txt) txt.textContent = text;
    }
}

// ═══════════════════════════════════════════════════
// CASE-INSENSITIVE CLIENT MATCHING & AUTO-SUGGEST
// ═══════════════════════════════════════════════════

function normalizeClientName(name) {
    return (name || '').trim().toLowerCase();
}

function findExistingClient(name) {
    const norm = normalizeClientName(name);
    if (!norm) return null;
    return state.clients.find(c => normalizeClientName(c.name) === norm);
}

function getUniqueClientNames() {
    const map = new Map();
    state.clients.forEach(c => {
        const norm = normalizeClientName(c.name);
        if (norm && !map.has(norm)) {
            map.set(norm, c.name);
        }
    });
    return Array.from(map.values());
}

function handleClientNameInput() {
    const val = clientNameInput.value.trim();
    const normVal = normalizeClientName(val);
    const uniqueNames = getUniqueClientNames();

    const matches = uniqueNames.filter(n => normalizeClientName(n).includes(normVal));

    if (val.length > 0 && matches.length > 0) {
        clientSuggestions.innerHTML = matches.map(name => `
            <div class="suggestion-item" data-name="${name}">
                <span>${name}</span>
                <span class="suggestion-tag">Existing Client</span>
            </div>
        `).join('');
        clientSuggestions.classList.add('active');
    } else {
        clientSuggestions.innerHTML = '';
        clientSuggestions.classList.remove('active');
    }

    const existing = findExistingClient(val);
    if (existing) {
        clientMatchStatus.innerHTML = `
            <span class="match-badge existing">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Matches existing client: "${existing.name}"
            </span>
        `;
    } else if (val.length > 0) {
        clientMatchStatus.innerHTML = `
            <span class="match-badge new">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                New custom client: "${val}"
            </span>
        `;
    } else {
        clientMatchStatus.innerHTML = '';
    }
}

// ═══════════════════════════════════════════════════
// TAB NAVIGATION
// ═══════════════════════════════════════════════════
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const activeContent = document.getElementById(`tab-${targetTab}`);
            if (activeContent) activeContent.classList.add('active');

            activeTab = targetTab;
            if (pageTitle) {
                if (targetTab === 'dashboard') pageTitle.textContent = 'Dashboard & Analytics';
                else if (targetTab === 'deletion') pageTitle.textContent = 'Data Deletion Interface';
                else pageTitle.textContent = 'Clients Workspace';
            }

            // Close mobile menu drawer on tab switch
            if (sidebar) sidebar.classList.remove('mobile-open');
            if (sidebarOverlay) sidebarOverlay.classList.remove('mobile-open');

            render();
        });
    });
}

// ═══════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════
function setupEventListeners() {
    // Mobile Navigation Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (mobileMenuBtn && sidebar && sidebarOverlay) {
        const toggleMobileMenu = () => {
            sidebar.classList.toggle('mobile-open');
            sidebarOverlay.classList.toggle('mobile-open');
        };
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
        sidebarOverlay.addEventListener('click', toggleMobileMenu);
    }
    document.getElementById('btn-add-client').addEventListener('click', () => {
        addClientModal.classList.add('active');
        clientNameInput.value = '';
        clientSuggestions.innerHTML = '';
        clientSuggestions.classList.remove('active');
        clientMatchStatus.innerHTML = '';
        clientNameInput.focus();
    });

    const closeModal = () => addClientModal.classList.remove('active');
    btnCloseModal.addEventListener('click', closeModal);
    btnCancelClient.addEventListener('click', closeModal);

    clientNameInput.addEventListener('input', handleClientNameInput);

    clientSuggestions.addEventListener('click', (e) => {
        const item = e.target.closest('.suggestion-item');
        if (item) {
            clientNameInput.value = item.dataset.name;
            handleClientNameInput();
            clientSuggestions.classList.remove('active');
        }
    });

    btnSaveClient.addEventListener('click', () => {
        const name = clientNameInput.value.trim();
        if (name) {
            createNewClient(name);
            closeModal();
        }
    });

    clientNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnSaveClient.click();
    });

    btnSyncSettings.addEventListener('click', () => {
        syncSettingsModal.classList.add('active');
        // Always reset to hidden by default for security when opening the modal
        const configTextarea = document.getElementById('firebase-config');
        const configNotice = document.getElementById('firebase-config-obscured-notice');
        const btnToggleConfig = document.getElementById('btn-toggle-config-visibility');
        if (configTextarea && configNotice && btnToggleConfig) {
            configTextarea.style.display = 'none';
            configNotice.style.display = 'block';
            btnToggleConfig.textContent = 'Show Config';
        }
        testFirebaseConnection();
        updateBackupUI();
    });

    const btnScanRecover = document.getElementById('btn-scan-recover');
    if (btnScanRecover) {
        btnScanRecover.addEventListener('click', scanAndRecoverLostData);
    }
    const closeSyncModal = () => {
        syncSettingsModal.classList.remove('active');
        // Reset to hidden on close
        const configTextarea = document.getElementById('firebase-config');
        const configNotice = document.getElementById('firebase-config-obscured-notice');
        const btnToggleConfig = document.getElementById('btn-toggle-config-visibility');
        if (configTextarea && configNotice && btnToggleConfig) {
            configTextarea.style.display = 'none';
            configNotice.style.display = 'block';
            btnToggleConfig.textContent = 'Show Config';
        }
    };
    btnCloseSyncModal.addEventListener('click', closeSyncModal);
    btnCancelSync.addEventListener('click', closeSyncModal);

    // Visibility toggle handler
    const btnToggleConfig = document.getElementById('btn-toggle-config-visibility');
    if (btnToggleConfig) {
        btnToggleConfig.addEventListener('click', () => {
            const configTextarea = document.getElementById('firebase-config');
            const configNotice = document.getElementById('firebase-config-obscured-notice');
            if (configTextarea && configNotice) {
                const isHidden = configTextarea.style.display === 'none';
                if (isHidden) {
                    configTextarea.style.display = 'block';
                    configNotice.style.display = 'none';
                    btnToggleConfig.textContent = 'Hide Config';
                } else {
                    configTextarea.style.display = 'none';
                    configNotice.style.display = 'block';
                    btnToggleConfig.textContent = 'Show Config';
                }
            }
        });
    }

    const btnTestSync = document.getElementById('btn-test-sync');
    if (btnTestSync) {
        btnTestSync.addEventListener('click', testFirebaseConnection);
    }

    btnSaveSync.addEventListener('click', () => {
        const raw = firebaseConfigInput.value.trim();
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                state.firebaseConfig = parsed;
                saveState();
                initFirebaseIfConfigured();
                showToastNotification('Cloud Database config saved & connected!');
                closeSyncModal();
            } catch (e) {
                alert('Invalid JSON config. Please check syntax.');
            }
        } else {
            state.firebaseConfig = null;
            saveState();
            closeSyncModal();
        }
    });

    const closeLightbox = () => imageLightboxModal.classList.remove('active');
    btnCloseLightbox.addEventListener('click', closeLightbox);
    imageLightboxModal.addEventListener('click', (e) => {
        if (e.target === imageLightboxModal) closeLightbox();
    });

    const closeCropModal = () => {
        imageCropModal.classList.remove('active');
        if (cropperInstance) {
            cropperInstance.destroy();
            cropperInstance = null;
        }
    };
    btnCloseCropModal.addEventListener('click', closeCropModal);
    btnCancelCrop.addEventListener('click', closeCropModal);

    btnRotateLeft.addEventListener('click', () => {
        if (cropperInstance) cropperInstance.rotate(-90);
    });
    btnRotateRight.addEventListener('click', () => {
        if (cropperInstance) cropperInstance.rotate(90);
    });
    btnResetCrop.addEventListener('click', () => {
        if (cropperInstance) cropperInstance.reset();
    });

    btnApplyCrop.addEventListener('click', applyCroppedImage);

    if (globalSearch) globalSearch.addEventListener('input', () => render());
    if (itemPhotoInput) itemPhotoInput.addEventListener('change', handleItemPhotoSelected);

    if (dashFromDate) dashFromDate.addEventListener('change', renderDashboard);
    if (dashToDate) dashToDate.addEventListener('change', renderDashboard);
    if (dashClientSelect) dashClientSelect.addEventListener('change', renderDashboard);
    if (btnResetFilters) {
        btnResetFilters.addEventListener('click', () => {
            if (dashFromDate) dashFromDate.value = '';
            if (dashToDate) dashToDate.value = '';
            if (dashClientSelect) dashClientSelect.value = 'ALL';
            renderDashboard();
        });
    }

    const btnDashDownloadReport = document.getElementById('btn-dash-download-report');
    if (btnDashDownloadReport) {
        btnDashDownloadReport.addEventListener('click', exportDashboardImage);
    }

    // ── Data Deletion Tab listeners ──────────────────
    const delClientScope = document.getElementById('del-client-scope');
    const delSpecificWrapper = document.getElementById('del-specific-client-wrapper');
    if (delClientScope) {
        delClientScope.addEventListener('change', (e) => {
            delFilterApplied = false;
            if (delSpecificWrapper) {
                delSpecificWrapper.style.display = e.target.value === 'SPECIFIC' ? 'flex' : 'none';
            }
            if (e.target.value === 'SPECIFIC') populateDelClientDropdown();
            renderDeletionTab();
        });
    }

    const btnDelApply = document.getElementById('btn-del-apply');
    if (btnDelApply) {
        btnDelApply.addEventListener('click', () => {
            delFilterApplied = true;
            renderDeletionTab();
        });
    }

    const btnDelExecute = document.getElementById('btn-del-execute');
    if (btnDelExecute) {
        btnDelExecute.addEventListener('click', executePermanentDeletion);
    }

    const delChkAll = document.getElementById('del-chk-all');
    if (delChkAll) {
        delChkAll.addEventListener('change', (e) => {
            document.querySelectorAll('.del-row-chk').forEach(c => { c.checked = e.target.checked; });
            updateDelSelectionUI();
        });
    }

    window.addEventListener('beforeunload', () => saveState());
    window.addEventListener('pagehide', () => saveState());
}

// ═══════════════════════════════════════════════════
// LOGIC & CLIENT FUNCTIONS
// ═══════════════════════════════════════════════════

function createNewClient(inputName) {
    const today = new Date().toISOString().split('T')[0];
    const existing = findExistingClient(inputName);
    const canonicalName = existing ? existing.name : inputName;

    const newClient = {
        id: 'client_' + Date.now().toString(),
        name: canonicalName,
        date: today,
        rows: [createEmptyRow()]
    };

    state.clients.unshift(newClient);
    saveState();
    render();

    if (existing) {
        showToastNotification(`Added record under existing client: "${canonicalName}"`);
    } else {
        showToastNotification(`Created new client: "${canonicalName}"`);
    }
}

function createEmptyRow() {
    return {
        id: 'row_' + Math.random().toString(36).substring(2, 9),
        item: '',
        col3: '',
        col4: '',
        col5: '',
        image: null
    };
}

function deleteClient(id) {
    if (confirm('Are you sure you want to delete this client record?')) {
        state.clients = state.clients.filter(c => c.id !== id);
        saveState();
        deleteClientFromCloud(id);
        render();
        showToastNotification('Client record deleted across all synced devices', 'danger');
    }
}

function updateClientDate(clientId, value) {
    const client = state.clients.find(c => c.id === clientId);
    if (client) {
        client.date = value;
        saveState();
        if (activeTab === 'dashboard') renderDashboard();
    }
}

// Add new entry sequentially to the end of rows (scrolling list below previous entries)
function addRow(clientId) {
    const client = state.clients.find(c => c.id === clientId);
    if (client) {
        client.rows.push(createEmptyRow());
        saveState();
        render();

        // Auto-scroll smooth focus to the newly added row
        setTimeout(() => {
            const tableElement = document.getElementById(`table_${clientId}`);
            if (tableElement) {
                const rows = tableElement.querySelectorAll('tbody tr');
                const lastRow = rows[rows.length - 1];
                if (lastRow) {
                    lastRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    const input = lastRow.querySelector('.cell-item');
                    if (input) input.focus();
                }
            }
        }, 50);
    }
}

function deleteRow(clientId, rowId) {
    const client = state.clients.find(c => c.id === clientId);
    if (client) {
        client.rows = client.rows.filter(r => r.id !== rowId);
        saveState();
        render();
    }
}

let syncDebounceTimer = null;
function debouncedSyncToFirebase() {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
        syncToFirebase();
    }, 400);
}

function updateCell(clientId, rowId, field, value) {
    const client = state.clients.find(c => c.id === clientId);
    if (client) {
        const row = client.rows.find(r => r.id === rowId);
        if (row) {
            row[field] = value;
            saveState(true, false);
            updateClientSummaryUI(client);
            updateGlobalStats();
            debouncedSyncToFirebase();
        }
    }
}

// ═══════════════════════════════════════════════════
// HIGH-QUALITY COMPRESSED IMAGE UPLOAD & CROPPER
// ═══════════════════════════════════════════════════

function triggerPhotoUpload(clientId, rowId) {
    selectedRowForPhoto = { clientId, rowId };
    itemPhotoInput.value = '';
    itemPhotoInput.click();
}

function handleItemPhotoSelected(e) {
    const file = e.target.files[0];
    if (!file || !selectedRowForPhoto) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        cropTargetImg.src = event.target.result;
        imageCropModal.classList.add('active');

        if (cropperInstance) {
            cropperInstance.destroy();
        }

        cropperInstance = new Cropper(cropTargetImg, {
            viewMode: 1,
            autoCropArea: 0.95,
            responsive: true,
            restore: false,
            background: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
        });
    };
    reader.readAsDataURL(file);
}

function applyCroppedImage() {
    if (!cropperInstance || !selectedRowForPhoto) return;

    const croppedCanvas = cropperInstance.getCroppedCanvas({
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
    });

    if (croppedCanvas) {
        const rawDataUrl = croppedCanvas.toDataURL('image/png', 1.0);
        const origBytes = Math.round(rawDataUrl.length * 0.75);

        const maxDim = parseInt(document.getElementById('img-max-dim')?.value || '800', 10);
        const quality = parseFloat(document.getElementById('img-quality')?.value || '0.75');

        compressImage(rawDataUrl, maxDim, quality).then(optimizedUrl => {
            const optBytes = Math.round(optimizedUrl.length * 0.75);
            const savings = Math.max(0, Math.round((1 - optBytes / origBytes) * 100));

            const client = state.clients.find(c => c.id === selectedRowForPhoto.clientId);
            if (client) {
                const row = client.rows.find(r => r.id === selectedRowForPhoto.rowId);
                if (row) {
                    row.image = optimizedUrl;
                    saveState();
                    render();
                    showToastNotification(
                        `Photo optimized & compressed by ${savings}% (${(origBytes / 1024).toFixed(0)}KB ➔ ${(optBytes / 1024).toFixed(0)}KB)!`,
                        'sync'
                    );
                }
            }
        });
    }

    imageCropModal.classList.remove('active');
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
}

function openImageLightbox(imageSrc, titleStr) {
    lightboxImg.src = imageSrc;
    lightboxTitle.textContent = titleStr || 'Item Photo Preview';
    imageLightboxModal.classList.add('active');
}

// ═══════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════
function calculateSummary(client) {
    let totalCol3 = 0;
    let totalCol4 = 0;
    let totalCol5 = 0;

    client.rows.forEach(r => {
        totalCol3 += parseFloat(r.col3) || 0;
        totalCol4 += parseFloat(r.col4) || 0;
        totalCol5 += parseFloat(r.col5) || 0;
    });

    const recdCol4 = totalCol3 + totalCol4;
    const recdCol5 = totalCol5;
    const lossCol3 = recdCol4 - totalCol5;

    return { totalCol3, totalCol4, totalCol5, recdCol4, recdCol5, lossCol3 };
}

function formatCurrency(num) {
    return Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFullDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const [y, m, d] = parts;
        return `${d}.${m}.${y}`;
    }
    return dateStr;
}

function updateClientSummaryUI(client) {
    const summary = calculateSummary(client);

    const total3 = document.getElementById(`total3_${client.id}`);
    const total4 = document.getElementById(`total4_${client.id}`);
    const recd4  = document.getElementById(`recd4_${client.id}`);
    const recd5  = document.getElementById(`recd5_${client.id}`);
    const loss3  = document.getElementById(`loss3_${client.id}`);

    if (total3) total3.textContent = formatCurrency(summary.totalCol3);
    if (total4) total4.textContent = formatCurrency(summary.totalCol4);
    if (recd4)  recd4.textContent  = formatCurrency(summary.recdCol4);
    if (recd5)  recd5.textContent  = formatCurrency(summary.recdCol5);
    if (loss3)  loss3.textContent  = formatCurrency(summary.lossCol3);
}

function updateGlobalStats() {
    const uniqueClientsCount = getUniqueClientNames().length;
    if (statClients) {
        statClients.textContent = uniqueClientsCount;
    }
}

function showToastNotification(message, waUrl = null) {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `
        <span>${message}</span>
        ${waUrl ? `<a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="toast-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-1.157 4.228 4.257-1.115z"/></svg>
            Open WhatsApp
        </a>` : ''}
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        if (document.body.contains(toast)) toast.remove();
    }, 6000);
}

// ═══════════════════════════════════════════════════
// BULK DELETION CONTROL & SELECTION ENGINE
// ═══════════════════════════════════════════════════

function updateBulkDeleteToolbarUI() {
    const selectedCountBadge = document.getElementById('selected-count-badge');
    const batchDeleteCount = document.getElementById('batch-delete-count');
    const btnBatchDelete = document.getElementById('btn-batch-delete');
    const selectAllClients = document.getElementById('select-all-clients');

    const count = state.selectedClientIds ? state.selectedClientIds.size : 0;

    if (selectedCountBadge) selectedCountBadge.textContent = `${count} selected`;
    if (batchDeleteCount) batchDeleteCount.textContent = count;
    if (btnBatchDelete) btnBatchDelete.disabled = (count === 0);

    if (selectAllClients) {
        const visibleCheckboxes = document.querySelectorAll('.client-select-checkbox');
        if (visibleCheckboxes.length > 0) {
            const allChecked = Array.from(visibleCheckboxes).every(cb => cb.checked);
            selectAllClients.checked = allChecked;
        } else {
            selectAllClients.checked = false;
        }
    }
}

function deleteSelectedClients() {
    if (!state.selectedClientIds || state.selectedClientIds.size === 0) return;

    const idsToDelete = Array.from(state.selectedClientIds);
    const count = idsToDelete.length;

    if (confirm(`Are you sure you want to delete ${count} selected client record(s)? This will delete them across all connected devices and cannot be undone.`)) {
        // 1. Remove from Cloud DB instantly for each ID
        idsToDelete.forEach(id => deleteClientFromCloud(id));

        // 2. Remove from Local State
        state.clients = state.clients.filter(c => !state.selectedClientIds.has(c.id));
        state.selectedClientIds.clear();

        // 3. Save State & Broadcast Tab Sync
        saveState();

        // 4. Update Display automatically to show only remaining entries
        render();

        // 5. Toast notification
        showToastNotification(`Deleted ${count} client entry/entries across all synced devices!`, 'danger');
    }
}

// ═══════════════════════════════════════════════════
// RENDERING WORKSPACE — SINGLE FULL-WIDTH TABLE & SCROLLING LIST
// ═══════════════════════════════════════════════════

let selectedSpecificClients = new Set();

function render() {
    updateGlobalStats();
    if (activeTab === 'workspace') {
        renderWorkspace();
    } else if (activeTab === 'dashboard') {
        renderDashboard();
    } else if (activeTab === 'deletion') {
        renderDeletionTab();
    }
}

// ═══════════════════════════════════════════════════
// DATA DELETION INTERFACE LOGIC
// ═══════════════════════════════════════════════════

let delFilterApplied = false;

function populateDelClientDropdown() {
    const sel = document.getElementById('del-specific-client');
    if (!sel) return;
    const names = getUniqueClientNames();
    const prev = sel.value;
    sel.innerHTML = names.length === 0
        ? `<option value="">No clients available</option>`
        : names.map(n => `<option value="${n}">${n}</option>`).join('');
    if (names.includes(prev)) sel.value = prev;
}

function updateDelSelectionUI() {
    const allBoxes = document.querySelectorAll('.del-row-chk');
    const checkedBoxes = document.querySelectorAll('.del-row-chk:checked');
    const count = checkedBoxes.length;
    const counterEl = document.getElementById('del-selected-count');
    const btnExecute = document.getElementById('btn-del-execute');
    const chkAll = document.getElementById('del-chk-all');
    if (counterEl) counterEl.textContent = `${count} records selected`;
    if (btnExecute) btnExecute.disabled = count === 0;
    if (chkAll) chkAll.checked = allBoxes.length > 0 && count === allBoxes.length;
}

function renderDeletionTab() {
    const fromDate = (document.getElementById('del-from-date') || {}).value || '';
    const toDate   = (document.getElementById('del-to-date')   || {}).value || '';
    const scope    = (document.getElementById('del-client-scope') || {}).value || 'ALL';
    const specific = (document.getElementById('del-specific-client') || {}).value || '';

    const tbody    = document.getElementById('del-table-body');
    const counter  = document.getElementById('del-rows-counter');
    const selCount = document.getElementById('del-selected-count');
    const btnExec  = document.getElementById('btn-del-execute');

    if (scope === 'SPECIFIC') populateDelClientDropdown();

    if (!delFilterApplied) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="del-empty-msg">Select a date range and client scope, then click <strong>Apply</strong> to preview targeted records.</td></tr>`;
        if (counter) counter.textContent = 'Rows: 0 of 0';
        if (selCount) selCount.textContent = '0 records selected';
        if (btnExec) btnExec.disabled = true;
        return;
    }

    // Build matching rows
    const rows = [];
    let seq = 1001;
    state.clients.forEach(c => {
        if (fromDate && c.date < fromDate) return;
        if (toDate   && c.date > toDate)   return;
        if (scope === 'SPECIFIC' && specific &&
            normalizeClientName(c.name) !== normalizeClientName(specific)) return;
        c.rows.forEach(r => {
            rows.push({ seq: seq++, clientId: c.id, rowId: r.id,
                clientName: c.name, date: c.date,
                type: r.image ? 'Image' : 'Order',
                details: r.item || 'Entry', image: r.image });
        });
    });

    if (counter) counter.textContent = rows.length > 0 ? `Rows: 1-${rows.length} of ${rows.length}` : 'Rows: 0 of 0';

    if (!tbody) return;
    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="del-empty-msg">No records match the selected criteria.</td></tr>`;
        if (selCount) selCount.textContent = '0 records selected';
        if (btnExec) btnExec.disabled = true;
        return;
    }

    tbody.innerHTML = rows.map(r => `
        <tr>
            <td><input type="checkbox" class="del-row-chk" data-client-id="${r.clientId}" data-row-id="${r.rowId}" checked></td>
            <td style="font-family:var(--font-mono); font-weight:700; color:#475569;">${r.seq}</td>
            <td style="font-weight:700; color:#0f2b5c;">${r.clientName}</td>
            <td style="font-family:var(--font-mono);">${formatFullDate(r.date)}</td>
            <td><span class="${r.type === 'Image' ? 'del-badge-image' : 'del-badge-order'}">${r.type}</span></td>
            <td>${r.details}</td>
            <td style="text-align:center;">${r.image
                ? `<img src="${r.image}" class="del-row-thumb" title="Click to enlarge" onclick="openImageLightbox('${r.image}', '${(r.details).replace(/'/g, "\\'")}')">` 
                : '<span class="del-no-img">—</span>'}</td>
        </tr>
    `).join('');

    // Wire per-row checkboxes
    tbody.querySelectorAll('.del-row-chk').forEach(chk => {
        chk.addEventListener('change', updateDelSelectionUI);
    });

    updateDelSelectionUI();
}

function executePermanentDeletion() {
    if (!delFilterApplied) return;
    const checked = document.querySelectorAll('.del-row-chk:checked');
    if (checked.length === 0) return;

    const clientIds = new Set();
    const rowIds = new Set();
    checked.forEach(c => { clientIds.add(c.dataset.clientId); rowIds.add(c.dataset.rowId); });

    if (!confirm(`PERMANENT DELETION\n\nDelete ${rowIds.size} record(s) and their images?\n\nThis action is IRREVERSIBLE and will sync across all devices.`)) return;

    state.clients.forEach(c => {
        if (clientIds.has(c.id)) c.rows = c.rows.filter(r => !rowIds.has(r.id));
    });
    const emptyIds = state.clients.filter(c => c.rows.length === 0).map(c => c.id);
    state.clients = state.clients.filter(c => c.rows.length > 0);
    emptyIds.forEach(id => deleteClientFromCloud(id));

    delFilterApplied = false;
    saveState();
    render();
    showToastNotification(`Permanently deleted ${rowIds.size} record(s)!`, 'danger');
}

function renderWorkspace() {
    // Preserve focus & cursor position before re-rendering DOM
    const activeEl = document.activeElement;
    let activeFocusInfo = null;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        const rowTr = activeEl.closest('tr');
        const cardPanel = activeEl.closest('.client-card');
        if (rowTr && cardPanel) {
            let fieldClass = '';
            if (activeEl.classList.contains('cell-item')) fieldClass = 'cell-item';
            else if (activeEl.classList.contains('cell-col3')) fieldClass = 'cell-col3';
            else if (activeEl.classList.contains('cell-col4')) fieldClass = 'cell-col4';
            else if (activeEl.classList.contains('cell-col5')) fieldClass = 'cell-col5';

            activeFocusInfo = {
                clientId: cardPanel.dataset.clientId,
                rowId: rowTr.dataset.rowId,
                fieldClass: fieldClass,
                selectionStart: activeEl.selectionStart,
                selectionEnd: activeEl.selectionEnd
            };
        }
    }

    workspace.innerHTML = '';
    const query = normalizeClientName(globalSearch ? globalSearch.value : '');

    const bulkFromDate = document.getElementById('bulk-from-date')?.value || '';
    const bulkToDate = document.getElementById('bulk-to-date')?.value || '';

    let filtered = state.clients.filter(c => {
        if (query && !normalizeClientName(c.name).includes(query)) return false;
        if (bulkFromDate && c.date < bulkFromDate) return false;
        if (bulkToDate && c.date > bulkToDate) return false;
        return true;
    });

    if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'width:100%; text-align:center; color:var(--text-secondary); padding:5rem; display:flex; flex-direction:column; align-items:center; gap:1rem;';
        empty.innerHTML = `
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.5;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
            </svg>
            <h2 style="font-weight:700;font-size:1.25rem;">${(query || bulkFromDate || bulkToDate) ? 'No matching clients found in selected date range' : 'No clients created yet'}</h2>
            <p>Click "+ New Client" to start recording data in real time.</p>
        `;
        workspace.appendChild(empty);
        updateBulkDeleteToolbarUI();
        return;
    }

    const sorted = [...filtered].sort((a, b) => {
        const tsA = parseInt(a.id.replace('client_', ''), 10) || 0;
        const tsB = parseInt(b.id.replace('client_', ''), 10) || 0;
        return tsB - tsA;
    });

    sorted.forEach((client) => {
        const card = document.createElement('div');
        card.className = 'glass-panel client-card';
        card.dataset.clientId = client.id;
        card.style.cssText = 'width:100%; margin-bottom:1.5rem;';

        const isChecked = state.selectedClientIds.has(client.id);

        const rowsHtml = client.rows.map((row) => `
            <tr data-row-id="${row.id}">
                <td style="width:100px; text-align:center;">
                    <div class="photo-cell-wrapper">
                        ${row.image ? `
                            <img src="${row.image}" class="item-photo-thumb" title="Click to enlarge" onclick="openImageLightbox('${row.image}', '${(row.item || 'Item').replace(/'/g, "\\'")}')">
                            <button class="btn-icon" title="Change Photo" style="padding:2px;" onclick="triggerPhotoUpload('${client.id}', '${row.id}')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                        ` : `
                            <button class="btn-photo-upload" title="Upload Item Photo" onclick="triggerPhotoUpload('${client.id}', '${row.id}')">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                            </button>
                        `}
                    </div>
                </td>
                <td style="width:40%;">
                    <textarea class="cell-item" placeholder="Enter Full Item Name..." rows="1">${row.item || ''}</textarea>
                </td>
                <td style="width:18%;"><input type="number" step="any" class="col-num col2-input cell-col3" placeholder="0" value="${row.col3 !== '' ? row.col3 : ''}"></td>
                <td style="width:18%;"><input type="number" step="any" class="col-num col3-input cell-col4" placeholder="0" value="${row.col4 !== '' ? row.col4 : ''}"></td>
                <td style="width:18%;"><input type="number" step="any" class="col-num col4-input cell-col5" placeholder="0" value="${row.col5 !== '' ? row.col5 : ''}"></td>
                <td style="width:6%; text-align: center;">
                    <button class="btn-icon delete btn-delete-row" title="Delete Row">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </td>
            </tr>
        `).join('');

        const summary = calculateSummary(client);

        card.innerHTML = `
            <div class="client-header">
                <div class="client-header-left">
                    <div class="client-select-wrapper" data-html2canvas-ignore>
                        <input type="checkbox" class="client-select-checkbox" data-client-id="${client.id}" ${isChecked ? 'checked' : ''} title="Select entry for deletion">
                    </div>
                    <h3 class="client-title">${client.name}</h3>
                    <div class="client-date-pill" data-html2canvas-ignore>
                        <span class="date-label">Date:</span>
                        <input type="date" class="client-date-input" value="${client.date || ''}" title="Unified Record Date">
                    </div>
                </div>
                <div class="client-actions" data-html2canvas-ignore>
                    <button class="btn-icon btn-export-image" title="Download Result Image">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </button>
                    <button class="btn-icon btn-share-whatsapp" title="Share Result Image on WhatsApp">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-1.157 4.228 4.257-1.115z"/></svg>
                    </button>
                    <button class="btn-icon delete btn-delete-client" title="Delete Client">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
            <div class="table-container">
                <table class="client-table" id="table_${client.id}">
                    <thead>
                        <tr>
                            <th style="width:100px; text-align:center;">Item Photo</th>
                            <th style="width:40%;">Full Item Name</th>
                            <th style="width:18%;" class="num-col text-blue">Col 2</th>
                            <th style="width:18%;" class="num-col text-green">Col 3</th>
                            <th style="width:18%;" class="num-col text-red">Col 4</th>
                            <th style="width:6%;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr class="add-row-tr">
                            <td colspan="6">
                                <button class="add-row-btn">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    Add New Row Below
                                </button>
                            </td>
                        </tr>
                        <tr class="summary-row row-total">
                            <td colspan="2"></td>
                            <td class="summary-val text-blue" id="total3_${client.id}">${formatCurrency(summary.totalCol3)}</td>
                            <td class="summary-val text-green" id="total4_${client.id}">${formatCurrency(summary.totalCol4)}</td>
                            <td class="summary-val"></td>
                            <td></td>
                        </tr>
                        <tr class="summary-row row-recd">
                            <td colspan="2" class="summary-label text-green">RECD</td>
                            <td class="summary-val text-green" id="recd4_${client.id}">${formatCurrency(summary.recdCol4)}</td>
                            <td class="summary-val text-red" id="recd5_${client.id}">${formatCurrency(summary.recdCol5)}</td>
                            <td></td>
                            <td></td>
                        </tr>
                        <tr class="summary-row row-loss">
                            <td colspan="2" class="summary-label text-gold">LOSS</td>
                            <td class="summary-val text-gold" id="loss3_${client.id}">${formatCurrency(summary.lossCol3)}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        workspace.appendChild(card);

        // Checkbox Selection Event
        const cardCheckbox = card.querySelector('.client-select-checkbox');
        if (cardCheckbox) {
            cardCheckbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    state.selectedClientIds.add(client.id);
                } else {
                    state.selectedClientIds.delete(client.id);
                }
                updateBulkDeleteToolbarUI();
            });
        }

        // Attach Card Events
        card.querySelector('.btn-delete-client').addEventListener('click', () => deleteClient(client.id));
        card.querySelector('.btn-export-image').addEventListener('click', () => exportImage(client, card, false));
        card.querySelector('.btn-share-whatsapp').addEventListener('click', () => exportImage(client, card, true));
        card.querySelector('.add-row-btn').addEventListener('click', () => addRow(client.id));
        card.querySelector('.client-date-input').addEventListener('change', (e) => updateClientDate(client.id, e.target.value));

        // Auto-expanding Textarea inputs for full item name visibility
        card.querySelectorAll('tbody textarea.cell-item').forEach(textarea => {
            const autoResize = (el) => {
                el.style.height = 'auto';
                el.style.height = (el.scrollHeight) + 'px';
            };
            autoResize(textarea);

            textarea.addEventListener('input', (e) => {
                autoResize(e.target);
                const rowTr = e.target.closest('tr');
                updateCell(client.id, rowTr.dataset.rowId, 'item', e.target.value);
            });
        });

        // Numeric Input events
        card.querySelectorAll('tbody input.col-num').forEach(input => {
            input.addEventListener('input', (e) => {
                const rowTr = e.target.closest('tr');
                const rowId = rowTr.dataset.rowId;

                let field = '';
                if (e.target.classList.contains('cell-col3')) field = 'col3';
                else if (e.target.classList.contains('cell-col4')) field = 'col4';
                else if (e.target.classList.contains('cell-col5')) field = 'col5';

                if (field) updateCell(client.id, rowId, field, e.target.value);
            });
        });

        // Delete row events
        card.querySelectorAll('.btn-delete-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const rowTr = e.target.closest('tr');
                deleteRow(client.id, rowTr.dataset.rowId);
            });
        });
    });

    // Restore focus & cursor selection position after rendering DOM
    if (activeFocusInfo && activeFocusInfo.clientId && activeFocusInfo.rowId && activeFocusInfo.fieldClass) {
        const card = workspace.querySelector(`.client-card[data-client-id="${activeFocusInfo.clientId}"]`);
        if (card) {
            const rowTr = card.querySelector(`tr[data-row-id="${activeFocusInfo.rowId}"]`);
            if (rowTr) {
                const targetEl = rowTr.querySelector('.' + activeFocusInfo.fieldClass);
                if (targetEl) {
                    targetEl.focus();
                    try {
                        if (typeof activeFocusInfo.selectionStart === 'number') {
                            targetEl.setSelectionRange(activeFocusInfo.selectionStart, activeFocusInfo.selectionEnd);
                        }
                    } catch (e) {}
                }
            }
        }
    }

    updateBulkDeleteToolbarUI();
}

// ═══════════════════════════════════════════════════
// RENDERING DASHBOARD & MASTER DATA SHEETS
// ═══════════════════════════════════════════════════

function renderDashboard() {
    if (!dashClientSelect) return;

    const uniqueNames = getUniqueClientNames();
    const currentSelected = dashClientSelect.value;
    dashClientSelect.innerHTML = `<option value="ALL">All Clients (${uniqueNames.length})</option>` +
        uniqueNames.map(n => `<option value="${n}">${n}</option>`).join('');
    if (uniqueNames.includes(currentSelected)) {
        dashClientSelect.value = currentSelected;
    } else {
        dashClientSelect.value = 'ALL';
    }

    const fromDate = dashFromDate ? dashFromDate.value : '';
    const toDate = dashToDate ? dashToDate.value : '';
    const selectedClientName = dashClientSelect.value;
    const normSelectedClient = normalizeClientName(selectedClientName);

    let matchingClients = state.clients.filter(c => {
        if (fromDate && c.date < fromDate) return false;
        if (toDate && c.date > toDate) return false;
        if (selectedClientName !== 'ALL' && normalizeClientName(c.name) !== normSelectedClient) {
            return false;
        }
        return true;
    });

    let totalCol2Sum = 0;
    let totalCol3Sum = 0;
    let totalCol4Sum = 0;
    let totalRecdSum = 0;
    let totalLossSum = 0;

    const masterRows = [];

    matchingClients.forEach(c => {
        const summary = calculateSummary(c);

        totalCol2Sum += summary.totalCol3;
        totalCol3Sum += summary.totalCol4;
        totalCol4Sum += summary.totalCol5;
        totalRecdSum += summary.recdCol4;
        totalLossSum += summary.lossCol3;

        c.rows.forEach(r => {
            masterRows.push({
                date: c.date,
                clientName: c.name,
                item: r.item,
                image: r.image,
                col2: parseFloat(r.col3) || 0,
                col3: parseFloat(r.col4) || 0,
                col4: parseFloat(r.col5) || 0,
                recd: (parseFloat(r.col3) || 0) + (parseFloat(r.col4) || 0)
            });
        });
    });

    if (dashTotalCol2) dashTotalCol2.textContent = formatCurrency(totalCol2Sum);
    if (dashTotalCol3) dashTotalCol3.textContent = formatCurrency(totalCol3Sum);
    if (dashTotalCol4) dashTotalCol4.textContent = formatCurrency(totalCol4Sum);
    if (dashTotalRecd) dashTotalRecd.textContent = formatCurrency(totalRecdSum);
    if (dashTotalLoss) dashTotalLoss.textContent = formatCurrency(totalLossSum);

    // Master Table — PROMINENT 72px PHOTOS & UNTRUNCATED ITEM NAMES
    if (masterTableBody) masterTableBody.innerHTML = '';
    if (masterSheetCount) masterSheetCount.textContent = `${masterRows.length} item(s)`;

    if (masterTableBody) {
        if (masterRows.length === 0) {
            masterTableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 2rem; color: var(--text-muted);">No items found in selected date range.</td></tr>`;
        } else {
            masterTableBody.innerHTML = masterRows.map(r => `
                <tr>
                    <td style="font-family:var(--font-mono); font-weight:700; width:12%;">${formatFullDate(r.date)}</td>
                    <td style="font-weight:800; color:var(--accent-violet); width:16%;">${r.clientName}</td>
                    <td style="width:100px;">
                        ${r.image ? `
                            <img src="${r.image}" class="dash-photo-thumb" title="Click to enlarge" onclick="openImageLightbox('${r.image}', '${(r.item || 'Item').replace(/'/g, "\\'")}')">
                        ` : '<span style="color:var(--text-muted); font-size:0.8rem; font-style:italic;">No photo</span>'}
                    </td>
                    <td style="width:38%;">
                        <div class="master-item-name">${r.item || '—'}</div>
                    </td>
                    <td class="num-col text-blue" style="font-family:var(--font-mono); font-weight:800; width:8%;">${formatCurrency(r.col2)}</td>
                    <td class="num-col text-green" style="font-family:var(--font-mono); font-weight:800; width:8%;">${formatCurrency(r.col3)}</td>
                    <td class="num-col text-red" style="font-family:var(--font-mono); font-weight:800; width:8%;">${formatCurrency(r.col4)}</td>
                    <td class="num-col text-green" style="font-family:var(--font-mono); font-weight:800; width:8%;">${formatCurrency(r.recd)}</td>
                </tr>
            `).join('');
        }
    }
}

function exportDashboardImage() {
    const fromDate = dashFromDate.value;
    const toDate = dashToDate.value;
    const selectedClientName = dashClientSelect.value;
    const normSelectedClient = normalizeClientName(selectedClientName);

    let matchingClients = state.clients.filter(c => {
        if (fromDate && c.date < fromDate) return false;
        if (toDate && c.date > toDate) return false;
        if (selectedClientName !== 'ALL' && normalizeClientName(c.name) !== normSelectedClient) {
            return false;
        }
        return true;
    });

    let totalCol2Sum = 0;
    let totalCol3Sum = 0;
    let totalCol4Sum = 0;
    let totalRecdSum = 0;
    let totalLossSum = 0;

    const masterRows = [];

    matchingClients.forEach(c => {
        const summary = calculateSummary(c);

        totalCol2Sum += summary.totalCol3;
        totalCol3Sum += summary.totalCol4;
        totalCol4Sum += summary.totalCol5;
        totalRecdSum += summary.recdCol4;
        totalLossSum += summary.lossCol3;

        c.rows.forEach(r => {
            masterRows.push({
                date: c.date || '',
                clientName: c.name || '',
                item: r.item || '',
                image: r.image || '',
                col2: parseFloat(r.col3) || 0,
                col3: parseFloat(r.col4) || 0,
                col4: parseFloat(r.col5) || 0,
                recd: (parseFloat(r.col3) || 0) + (parseFloat(r.col4) || 0)
            });
        });
    });

    const CARD_BG        = '#ffffff';
    const HEADER_BG      = 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)';
    const TEXT_PRIMARY   = '#0f172a';
    const TEXT_MUTED     = '#64748b';
    const BORDER         = '#e2e8f0';
    const BLUE           = '#2563eb';
    const GREEN          = '#059669';
    const RED            = '#dc2626';
    const GOLD           = '#d97706';
    const FONT_UI        = "'Plus Jakarta Sans', sans-serif";
    const FONT_MONO      = "'JetBrains Mono', monospace";

    const exportDateStr = new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
    const dateRangeStr = (fromDate && toDate)
        ? `${formatFullDate(fromDate)} to ${formatFullDate(toDate)}`
        : (fromDate ? `From ${formatFullDate(fromDate)}` : (toDate ? `Up to ${formatFullDate(toDate)}` : 'All Dates'));
    const clientFilterStr = selectedClientName === 'ALL' ? 'All Clients' : selectedClientName;

    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fmtCurrency = (val) => {
        const n = parseFloat(val) || 0;
        return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const rowsHtml = masterRows.length === 0 
        ? `<tr><td colspan="8" style="padding:20px; text-align:center; color:${TEXT_MUTED}; font-size:14px;">No items match selected date range or filter.</td></tr>`
        : masterRows.map(r => {
            const photoHtml = r.image 
                ? `<img src="${r.image}" style="width:48px; height:48px; border-radius:6px; object-fit:cover; border:1px solid ${BORDER}; display:block; margin:0 auto;">`
                : `<span style="color:${TEXT_MUTED}; font-size:12px; font-style:italic;">No photo</span>`;

            return `<tr>
                <td style="padding:10px 12px; border-bottom:1px solid ${BORDER}; font-family:${FONT_MONO}; font-weight:700; font-size:13px; text-align:center; color:${TEXT_PRIMARY};">${esc(formatFullDate(r.date))}</td>
                <td style="padding:10px 12px; border-bottom:1px solid ${BORDER}; font-weight:800; font-size:14px; color:#6d28d9;">${esc(r.clientName)}</td>
                <td style="padding:8px 12px; border-bottom:1px solid ${BORDER}; text-align:center; width:64px;">${photoHtml}</td>
                <td style="padding:10px 12px; border-bottom:1px solid ${BORDER}; font-weight:700; font-size:14px; color:${TEXT_PRIMARY}; word-break:break-word;">${esc(r.item)}</td>
                <td style="padding:10px 12px; border-bottom:1px solid ${BORDER}; font-family:${FONT_MONO}; font-weight:800; font-size:14px; text-align:right; color:${BLUE}; background:#f0f9ff;">${fmtCurrency(r.col2)}</td>
                <td style="padding:10px 12px; border-bottom:1px solid ${BORDER}; font-family:${FONT_MONO}; font-weight:800; font-size:14px; text-align:right; color:${GREEN}; background:#ecfdf5;">${fmtCurrency(r.col3)}</td>
                <td style="padding:10px 12px; border-bottom:1px solid ${BORDER}; font-family:${FONT_MONO}; font-weight:800; font-size:14px; text-align:right; color:${RED}; background:#fff1f2;">${fmtCurrency(r.col4)}</td>
                <td style="padding:10px 12px; border-bottom:1px solid ${BORDER}; font-family:${FONT_MONO}; font-weight:800; font-size:14px; text-align:right; color:${GREEN}; background:#ecfdf5;">${fmtCurrency(r.recd)}</td>
            </tr>`;
        }).join('');

    const snap = document.createElement('div');
    snap.style.cssText = [
        'position:fixed', 'left:-9999px', 'top:0',
        'width:1050px',
        `background:${CARD_BG}`,
        'border-radius:16px',
        'overflow:hidden',
        `font-family:${FONT_UI}`,
        `color:${TEXT_PRIMARY}`,
        'box-sizing:border-box',
        'line-height:1.5',
        'border:2px solid #cbd5e1',
        'padding:0',
    ].join(';');

    snap.innerHTML = `
        <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color:#ffffff; padding:24px 28px; border-radius:14px 14px 0 0;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:14px; margin-bottom:14px;">
                <div>
                    <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.12em; color:#a5b4fc;">Dashboard & Analytics Summary</div>
                    <h2 style="margin:4px 0 0 0; font-size:26px; font-weight:800; letter-spacing:-0.5px; color:#ffffff;">${esc(clientFilterStr)}</h2>
                </div>
                <div style="text-align:right;">
                    <div style="font-family:${FONT_MONO}; font-size:12px; font-weight:700; color:#e0e7ff; background:rgba(255,255,255,0.15); padding:6px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.25); margin-bottom:6px;">
                        Report Exported: ${esc(exportDateStr)}
                    </div>
                    <div style="font-family:${FONT_MONO}; font-size:12px; font-weight:700; color:#cbd5e1;">
                        Date Range: ${esc(dateRangeStr)}
                    </div>
                </div>
            </div>
            <div style="display:flex; gap:24px; font-size:14px; font-weight:700;">
                <div><span style="opacity:0.8;">Client Filter:</span> ${esc(clientFilterStr)}</div>
                <div><span style="opacity:0.8;">Date Range:</span> ${esc(dateRangeStr)}</div>
                <div><span style="opacity:0.8;">Total Items:</span> ${masterRows.length}</div>
            </div>
        </div>

        <div style="padding:24px 28px;">
            <h3 style="margin:0 0 14px 0; font-size:16px; font-weight:800; color:#6d28d9; text-transform:uppercase; letter-spacing:0.05em;">Metrics Summary</h3>
            <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:12px; margin-bottom:24px;">
                <div style="background:#f0f9ff; border:1.5px solid #93c5fd; border-radius:10px; padding:12px 14px;">
                    <div style="font-size:12px; font-weight:800; color:#1d4ed8; text-transform:uppercase;">Total Col 2</div>
                    <div style="font-family:${FONT_MONO}; font-size:20px; font-weight:800; color:${BLUE}; margin-top:4px;">${fmtCurrency(totalCol2Sum)}</div>
                </div>
                <div style="background:#ecfdf5; border:1.5px solid #6ee7b7; border-radius:10px; padding:12px 14px;">
                    <div style="font-size:12px; font-weight:800; color:#047857; text-transform:uppercase;">Total Col 3</div>
                    <div style="font-family:${FONT_MONO}; font-size:20px; font-weight:800; color:${GREEN}; margin-top:4px;">${fmtCurrency(totalCol3Sum)}</div>
                </div>
                <div style="background:#fff1f2; border:1.5px solid #fca5a5; border-radius:10px; padding:12px 14px;">
                    <div style="font-size:12px; font-weight:800; color:#b91c1c; text-transform:uppercase;">Total Col 4</div>
                    <div style="font-family:${FONT_MONO}; font-size:20px; font-weight:800; color:${RED}; margin-top:4px;">${fmtCurrency(totalCol4Sum)}</div>
                </div>
                <div style="background:#ecfdf5; border:2px solid #10b981; border-radius:10px; padding:12px 14px;">
                    <div style="font-size:12px; font-weight:800; color:#047857; text-transform:uppercase;">Total RECDS</div>
                    <div style="font-family:${FONT_MONO}; font-size:20px; font-weight:800; color:${GREEN}; margin-top:4px;">${fmtCurrency(totalRecdSum)}</div>
                </div>
                <div style="background:#fffbe6; border:2px solid #f59e0b; border-radius:10px; padding:12px 14px;">
                    <div style="font-size:12px; font-weight:800; color:#b45309; text-transform:uppercase;">Total LOSS</div>
                    <div style="font-family:${FONT_MONO}; font-size:20px; font-weight:800; color:${GOLD}; margin-top:4px;">${fmtCurrency(totalLossSum)}</div>
                </div>
            </div>

            <h3 style="margin:0 0 14px 0; font-size:16px; font-weight:800; color:#6d28d9; text-transform:uppercase; letter-spacing:0.05em;">Master Data Sheet</h3>
            <div style="border:1.5px solid ${BORDER}; border-radius:10px; overflow:hidden;">
                <table style="width:100%; border-collapse:collapse; background:#ffffff;">
                    <thead>
                        <tr style="background:#f8fafc;">
                            <th style="padding:10px 12px; font-size:12px; font-weight:800; color:${TEXT_MUTED}; text-transform:uppercase; border-bottom:2px solid ${BORDER}; text-align:left; width:12%;">Date</th>
                            <th style="padding:10px 12px; font-size:12px; font-weight:800; color:${TEXT_MUTED}; text-transform:uppercase; border-bottom:2px solid ${BORDER}; text-align:left; width:15%;">Client</th>
                            <th style="padding:10px 12px; font-size:12px; font-weight:800; color:${TEXT_MUTED}; text-transform:uppercase; border-bottom:2px solid ${BORDER}; text-align:center; width:64px;">Photo</th>
                            <th style="padding:10px 12px; font-size:12px; font-weight:800; color:${TEXT_MUTED}; text-transform:uppercase; border-bottom:2px solid ${BORDER}; text-align:left;">Full Item Name</th>
                            <th style="padding:10px 12px; font-size:12px; font-weight:800; color:${BLUE}; text-transform:uppercase; border-bottom:2px solid ${BORDER}; text-align:right; width:10%;">Col 2</th>
                            <th style="padding:10px 12px; font-size:12px; font-weight:800; color:${GREEN}; text-transform:uppercase; border-bottom:2px solid ${BORDER}; text-align:right; width:10%;">Col 3</th>
                            <th style="padding:10px 12px; font-size:12px; font-weight:800; color:${RED}; text-transform:uppercase; border-bottom:2px solid ${BORDER}; text-align:right; width:10%;">Col 4</th>
                            <th style="padding:10px 12px; font-size:12px; font-weight:800; color:${GREEN}; text-transform:uppercase; border-bottom:2px solid ${BORDER}; text-align:right; width:10%;">RECD</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        </div>
    `;

    document.body.appendChild(snap);

    const doCapture = () => {
        const captureH = snap.scrollHeight;
        html2canvas(snap, {
            scale: 3,
            backgroundColor: CARD_BG,
            useCORS: true,
            allowTaint: true,
            logging: false,
            width: 1050,
            height: captureH,
            windowWidth: 1050,
            windowHeight: captureH,
            scrollX: 0,
            scrollY: 0,
        }).then(canvas => {
            if (document.body.contains(snap)) document.body.removeChild(snap);
            const dataUrl = canvas.toDataURL('image/png');

            const clientSanitized = (selectedClientName === 'ALL' ? 'AllClients' : selectedClientName).replace(/[^a-zA-Z0-9_-]/g, '_');
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `LossCalc_Report_${clientSanitized}_${dateStr}.png`;

            const link = document.createElement('a');
            link.setAttribute('href', dataUrl);
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToastNotification(`Dashboard Report image downloaded: ${fileName}`);
        }).catch(err => {
            if (document.body.contains(snap)) document.body.removeChild(snap);
            console.error('Report image export failed:', err);
            alert('Report image export failed.');
        });
    };

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(doCapture);
    } else {
        setTimeout(doCapture, 400);
    }
}

// ═══════════════════════════════════════════════════
// EXPORT & WHATSAPP SHARE IMAGE LOGIC
// ═══════════════════════════════════════════════════
function exportImage(client, cardElement, openWhatsApp = false) {
    const CARD_BG        = '#ffffff';
    const TEXT_PRIMARY   = '#0f172a';
    const TEXT_SEC       = '#475568';
    const BORDER         = '#cbd5e1';
    const BLUE           = '#2563eb';
    const GREEN          = '#059669';
    const RED            = '#dc2626';
    const VIOLET         = '#6d28d9';
    const PINK_LOSS      = '#be185d';
    const FONT_UI        = "'Plus Jakarta Sans', sans-serif";
    const FONT_MONO      = "'JetBrains Mono', monospace";

    const summary = calculateSummary(client);
    const exportDateStr = new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });

    const rowDates = (client.rows || []).map(r => r.date).filter(Boolean);
    let dateRangeStr = formatFullDate(client.date);
    if (rowDates.length > 0) {
        const minD = rowDates.reduce((a, b) => a < b ? a : b);
        const maxD = rowDates.reduce((a, b) => a > b ? a : b);
        dateRangeStr = minD === maxD ? formatFullDate(minD) : `${formatFullDate(minD)} to ${formatFullDate(maxD)}`;
    }

    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fmtCell = (val) => {
        if (val === '' || val === null || val === undefined) return '';
        const n = parseFloat(val);
        return isNaN(n) ? esc(val) : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const rowsHtml = client.rows.map((row) => {
        const cell = `padding:12px 14px; border-bottom:1.5px solid ${BORDER}; font-size:14px; vertical-align:middle; font-weight:700; word-break:break-word;`;
        const mono = `${cell} font-family:${FONT_MONO}; text-align:right; font-weight:800; font-size:15px;`;

        const photoCellHtml = row.image
            ? `<img src="${row.image}" style="width:54px; height:54px; border-radius:8px; object-fit:cover; border:1.5px solid ${BORDER}; display:block; margin:0 auto;">`
            : '';

        return `<tr>
            <td style="padding:10px; border-bottom:1.5px solid ${BORDER}; text-align:center; width:80px;">${photoCellHtml}</td>
            <td style="${cell} color:${TEXT_PRIMARY}; font-weight:800;">${esc(row.item)}</td>
            <td style="${mono} background:#f0f9ff; color:${BLUE};">${fmtCell(row.col3)}</td>
            <td style="${mono} background:#ecfdf5; color:${GREEN};">${fmtCell(row.col4)}</td>
            <td style="${mono} background:#fff1f2; color:${RED};">${fmtCell(row.col5)}</td>
        </tr>`;
    }).join('');

    const thStyle = (color = TEXT_SEC, align = 'left') =>
        `style="padding:10px 14px; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:${color}; text-align:${align}; border-bottom:2px solid ${BORDER};"`;

    const snap = document.createElement('div');
    snap.style.cssText = [
        'position:fixed', 'left:-9999px', 'top:0',
        'width:950px',
        `background:${CARD_BG}`,
        'border-radius:20px',
        'overflow:hidden',
        `font-family:${FONT_UI}`,
        `color:${TEXT_PRIMARY}`,
        'box-sizing:border-box',
        'line-height:1.5',
        'border:2px solid #cbd5e1',
    ].join(';');

    snap.innerHTML = `
        <!-- Top Header Banner with Client Name, Export Date, and Date Range -->
        <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color:#ffffff; padding:24px 28px; border-radius:18px 18px 0 0;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid rgba(255,255,255,0.18); padding-bottom:16px; margin-bottom:16px;">
                <div>
                    <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; color:#c7d2fe;">Client Calculation Result Statement</div>
                    <h2 style="margin:4px 0 0 0; font-size:28px; font-weight:800; letter-spacing:-0.5px; color:#ffffff;">${esc(client.name)}</h2>
                </div>
                <div style="text-align:right;">
                    <div style="font-family:${FONT_MONO}; font-size:12px; font-weight:700; color:#e0e7ff; background:rgba(255,255,255,0.15); padding:6px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.25); margin-bottom:6px;">
                        Report Exported: ${esc(exportDateStr)}
                    </div>
                    <div style="font-family:${FONT_MONO}; font-size:12px; font-weight:700; color:#cbd5e1;">
                        Date Range: ${esc(dateRangeStr)}
                    </div>
                </div>
            </div>

            <!-- Metric Summary Section -->
            <div>
                <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#a5b4fc; margin-bottom:10px;">Metric Summary</div>
                <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:10px;">
                    <div style="background:#ffffff; border-radius:10px; padding:10px 12px; color:#0f172a; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                        <div style="font-size:11px; font-weight:800; color:#2563eb; text-transform:uppercase;">Total Col 2</div>
                        <div style="font-family:${FONT_MONO}; font-size:17px; font-weight:800; color:${BLUE}; margin-top:2px;">${formatCurrency(summary.totalCol3)}</div>
                    </div>
                    <div style="background:#ffffff; border-radius:10px; padding:10px 12px; color:#0f172a; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                        <div style="font-size:11px; font-weight:800; color:#059669; text-transform:uppercase;">Total Col 3</div>
                        <div style="font-family:${FONT_MONO}; font-size:17px; font-weight:800; color:${GREEN}; margin-top:2px;">${formatCurrency(summary.totalCol4)}</div>
                    </div>
                    <div style="background:#ffffff; border-radius:10px; padding:10px 12px; color:#0f172a; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                        <div style="font-size:11px; font-weight:800; color:#dc2626; text-transform:uppercase;">Total Col 4</div>
                        <div style="font-family:${FONT_MONO}; font-size:17px; font-weight:800; color:${RED}; margin-top:2px;">${formatCurrency(summary.totalCol5)}</div>
                    </div>
                    <div style="background:#ffffff; border-radius:10px; padding:10px 12px; color:#0f172a; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                        <div style="font-size:11px; font-weight:800; color:#059669; text-transform:uppercase;">Total RECD</div>
                        <div style="font-family:${FONT_MONO}; font-size:17px; font-weight:800; color:${GREEN}; margin-top:2px;">${formatCurrency(summary.recdCol4)}</div>
                    </div>
                    <div style="background:#ffffff; border-radius:10px; padding:10px 12px; color:#0f172a; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                        <div style="font-size:11px; font-weight:800; color:#d97706; text-transform:uppercase;">Total LOSS</div>
                        <div style="font-family:${FONT_MONO}; font-size:17px; font-weight:800; color:#b45309; margin-top:2px;">${formatCurrency(summary.lossCol3)}</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Detailed Items Table -->
        <div style="padding:20px 24px; overflow:visible;">
            <h3 style="margin:0 0 12px 0; font-size:15px; font-weight:800; color:${VIOLET}; text-transform:uppercase; letter-spacing:0.05em;">Detailed Record Items</h3>
            <div style="border:1.5px solid ${BORDER}; border-radius:10px; overflow:hidden;">
                <table style="width:100%; border-collapse:collapse; table-layout:fixed; background:#ffffff;">
                    <colgroup>
                        <col style="width:80px">
                        <col style="width:42%">
                        <col style="width:18%"> <col style="width:18%"> <col style="width:22%">
                    </colgroup>
                    <thead>
                        <tr style="background:#f8fafc;">
                            <th ${thStyle(TEXT_SEC, 'center')}>Photo</th>
                            <th ${thStyle()}>Full Item Name</th>
                            <th ${thStyle(BLUE, 'right')}>Col 2</th>
                            <th ${thStyle(GREEN, 'right')}>Col 3</th>
                            <th ${thStyle(RED, 'right')}>Col 4</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        </div>

        <!-- Summary Footer Row -->
        <div style="background:#f8fafc; border-top:2px solid ${BORDER}; padding:16px 24px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:13px; font-weight:700; color:${TEXT_SEC};">
                    Client: <span style="color:${VIOLET}; font-weight:800;">${esc(client.name)}</span> | Total Rows: <span style="font-weight:800;">${client.rows.length}</span>
                </div>
                <div style="display:flex; gap:20px; font-family:${FONT_MONO}; font-weight:800; font-size:15px;">
                    <div>RECD (Col 2 + Col 3): <span style="color:${GREEN};">${formatCurrency(summary.recdCol4)}</span></div>
                    <div>RECD Col 4: <span style="color:${RED};">${formatCurrency(summary.recdCol5)}</span></div>
                    <div>LOSS: <span style="color:${PINK_LOSS};">${formatCurrency(summary.lossCol3)}</span></div>
                </div>
            </div>
        </div>`;

    document.body.appendChild(snap);

    const doCapture = () => {
        const captureH = snap.scrollHeight;
        html2canvas(snap, {
            scale: 3,
            backgroundColor: CARD_BG,
            useCORS: true,
            allowTaint: true,
            logging: false,
            width: 950,
            height: captureH,
            windowWidth: 950,
            windowHeight: captureH,
            scrollX: 0,
            scrollY: 0,
        }).then(async canvas => {
            if (document.body.contains(snap)) document.body.removeChild(snap);
            const dataUrl = canvas.toDataURL('image/png');
            const fileName = `${client.name.replace(/\s+/g, '_')}_record.png`;

            const link = document.createElement('a');
            link.setAttribute('href', dataUrl);
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (openWhatsApp) {
                if (canvas.toBlob) {
                    canvas.toBlob(async blob => {
                        const file = new File([blob], fileName, { type: 'image/png' });
                        if (navigator.canShare && navigator.canShare({ files: [file] })) {
                            try {
                                await navigator.share({
                                    title: `${client.name} Result Image`,
                                    files: [file]
                                });
                                return;
                            } catch (e) {}
                        }

                        if (navigator.clipboard && window.ClipboardItem) {
                            try {
                                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                                showToastNotification('Result image copied! Opening WhatsApp...', 'https://web.whatsapp.com');
                                window.open('https://web.whatsapp.com', '_blank');
                                return;
                            } catch (clipErr) {}
                        }

                        showToastNotification('Result image downloaded! Opening WhatsApp...', 'https://web.whatsapp.com');
                        window.open('https://web.whatsapp.com', '_blank');
                    }, 'image/png');
                } else {
                    window.open('https://web.whatsapp.com', '_blank');
                }
            } else {
                showToastNotification('Result image downloaded!', 'https://web.whatsapp.com');
            }
        }).catch(err => {
            if (document.body.contains(snap)) document.body.removeChild(snap);
            console.error('Image export failed:', err);
            alert('Image export failed.');
        });
    };

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(doCapture);
    } else {
        setTimeout(doCapture, 400);
    }
}

window.openImageLightbox = openImageLightbox;
window.triggerPhotoUpload = triggerPhotoUpload;

document.addEventListener('DOMContentLoaded', init);
