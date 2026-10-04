(function () {
  'use strict';

  // -------------------------------------------------------------
  // CONFIGURATION & CONSTANTS
  // -------------------------------------------------------------
  const FIREBASE_RTDB_BASE = 'https://price-trcker-default-rtdb.asia-southeast1.firebasedatabase.app';
  const DB_ENDPOINT = `${FIREBASE_RTDB_BASE}/price_items`;
  const META_ENDPOINT = `${FIREBASE_RTDB_BASE}/price_items/_column_meta`;
  const CACHE_KEY = 'price_tracker_cache_v4';
  const COL_COUNT_KEY = 'price_tracker_cols_v4';
  const ZOOM_KEY = 'price_tracker_zoom_v4';

  const getTodayDate = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const DEFAULT_SAMPLE_DATA = [
    {
      id: "item-1",
      itemName: "CROSS BAR",
      subClass: "2B SUPER",
      slots: [
        { date: getTodayDate(), toolName: "KHALIFA", toolCode: "NO6" },
        { date: getTodayDate(), toolName: "NTT", toolCode: "3/0" },
        { date: getTodayDate(), toolName: "HARSHAD", toolCode: "220,600" }
      ],
      subclasses: [
        { id: "sub-1-1", name: "2B SUPER", prices: ["2.10", "3.84", "37.00"] },
        { id: "sub-1-2", name: "3B ULTRA", prices: ["2.90", "4.10", "42.50"] }
      ]
    },
    {
      id: "item-2",
      itemName: "DRILL BIT",
      subClass: "2P18",
      slots: [
        { date: getTodayDate(), toolName: "KHALIFA", toolCode: "NO6" },
        { date: getTodayDate(), toolName: "NTT", toolCode: "3/0" },
        { date: getTodayDate(), toolName: "HARSHAD", toolCode: "180" }
      ],
      subclasses: [
        { id: "sub-2-1", name: "2P18", prices: ["4.50", "5.20", "42.00"] },
        { id: "sub-2-2", name: "3P24", prices: ["6.00", "7.15", "48.50"] }
      ]
    },
    {
      id: "item-3",
      itemName: "SAW BLADE",
      subClass: "220",
      slots: [
        { date: getTodayDate(), toolName: "KHALIFA", toolCode: "SB-4" },
        { date: getTodayDate(), toolName: "HARSHAD", toolCode: "3/0" },
        { date: getTodayDate(), toolName: "NTT", toolCode: "NO8" }
      ],
      subclasses: [
        { id: "sub-3-1", name: "220", prices: ["8.90", "12.40", "24.50"] }
      ]
    },
    {
      id: "item-4",
      itemName: "ALLOY",
      subClass: "PREMIUM 99",
      slots: [
        { date: getTodayDate(), toolName: "HARSHAD", toolCode: "AL-1" },
        { date: getTodayDate(), toolName: "KHALIFA", toolCode: "AL-2" },
        { date: getTodayDate(), toolName: "RAJESH", toolCode: "AL-X" }
      ],
      subclasses: [
        { id: "sub-4-1", name: "PREMIUM 99", prices: ["550.0", "565.5", "540.0"] }
      ]
    }
  ];

  // -------------------------------------------------------------
  // STATE MANAGEMENT
  // -------------------------------------------------------------
  let items = [];
  let columnCount = 3;
  let zoomLevel = 100;
  let searchQuery = '';
  let isConnected = true;
  let eventSource = null;

  // Load cached initial column count and zoom
  try {
    const storedCols = localStorage.getItem(COL_COUNT_KEY);
    if (storedCols) {
      const parsedCols = parseInt(storedCols, 10);
      if (parsedCols >= 1) columnCount = parsedCols;
    }
    const storedZoom = localStorage.getItem(ZOOM_KEY);
    if (storedZoom) {
      const parsedZoom = parseInt(storedZoom, 10);
      if (parsedZoom >= 70 && parsedZoom <= 150) zoomLevel = parsedZoom;
    }
  } catch (e) {}

  // Normalize slots to at least columnCount
  const normalizeItemSlots = (rawSlots, minCols = 1) => {
    let arr = [];
    if (Array.isArray(rawSlots)) {
      arr = rawSlots.map(s => s || {});
    } else if (rawSlots && typeof rawSlots === 'object') {
      arr = Object.keys(rawSlots).sort((a,b) => Number(a)-Number(b)).map(k => rawSlots[k] || {});
    }
    const targetLen = Math.max(minCols, arr.length);
    while (arr.length < targetLen) {
      arr.push({ date: '', toolName: '', toolCode: '', price: '' });
    }
    return arr.slice(0, targetLen).map(s => ({
      date: (s.date || '').toUpperCase(),
      toolName: (s.toolName || '').toUpperCase(),
      toolCode: (s.toolCode || '').toUpperCase(),
      price: s.price !== undefined && s.price !== null ? String(s.price).toUpperCase() : ''
    }));
  };

  // Normalize subclasses capturing one-to-many relationship securely
  const normalizeSubclasses = (rawSubclasses, minCols = 1, legacySlots = [], legacySubClass = '') => {
    let subs = [];
    if (Array.isArray(rawSubclasses)) {
      subs = rawSubclasses.filter(Boolean);
    } else if (rawSubclasses && typeof rawSubclasses === 'object') {
      subs = Object.keys(rawSubclasses).sort((a,b) => Number(a)-Number(b)).map(k => rawSubclasses[k]).filter(Boolean);
    }

    if (subs.length === 0) {
      const defaultPrices = [];
      for (let c = 0; c < minCols; c++) {
        const p = legacySlots && legacySlots[c] && legacySlots[c].price ? String(legacySlots[c].price) : '';
        defaultPrices.push(p.toUpperCase());
      }
      subs = [{
        id: `sub-${Date.now()}-${Math.random().toString(36).substring(2,6)}`,
        name: (legacySubClass || 'STANDARD').toUpperCase(),
        prices: defaultPrices
      }];
    }

    return subs.map((sub, sIdx) => {
      let pricesArr = [];
      if (Array.isArray(sub.prices)) {
        pricesArr = sub.prices.slice();
      } else if (sub.prices && typeof sub.prices === 'object') {
        pricesArr = Object.keys(sub.prices).sort((a,b) => Number(a)-Number(b)).map(k => sub.prices[k]);
      }
      while (pricesArr.length < minCols) {
        pricesArr.push('');
      }
      return {
        id: sub.id || `sub-${sIdx + 1}`,
        name: (sub.name !== undefined && sub.name !== null ? String(sub.name) : '').toUpperCase(),
        prices: pricesArr.slice(0, Math.max(minCols, pricesArr.length)).map(p => (p !== undefined && p !== null ? String(p).toUpperCase() : ''))
      };
    });
  };

  // Lowest Price calculation across all assigned subclass variants
  const calculateLowestPrice = (item, colCount = 3) => {
    if (!item) return { minPrice: null, minSubIdx: -1, minColIdx: -1, minSubName: '', formattedMin: '-' };
    
    let minPrice = Infinity;
    let minSubIdx = -1;
    let minColIdx = -1;
    let minSubName = '';

    const subclasses = item.subclasses || [];
    subclasses.forEach((sub, sIdx) => {
      const prices = Array.isArray(sub.prices) ? sub.prices : [];
      prices.forEach((price, cIdx) => {
        if (cIdx >= colCount) return;
        if (price === undefined || price === null) return;
        const raw = String(price).trim().replace(/,/g, '');
        if (!raw || raw === '-') return;
        const num = parseFloat(raw);
        if (!isNaN(num) && isFinite(num) && num > 0) {
          if (num < minPrice) {
            minPrice = num;
            minSubIdx = sIdx;
            minColIdx = cIdx;
            minSubName = sub.name || `SUBCLASS ${sIdx + 1}`;
          }
        }
      });
    });

    // Fallback to item.slots if no subclass price was found
    if (minColIdx === -1 && Array.isArray(item.slots)) {
      item.slots.forEach((slot, cIdx) => {
        if (cIdx >= colCount) return;
        if (!slot || slot.price === undefined || slot.price === null) return;
        const raw = String(slot.price).trim().replace(/,/g, '');
        if (!raw || raw === '-') return;
        const num = parseFloat(raw);
        if (!isNaN(num) && isFinite(num) && num > 0) {
          if (num < minPrice) {
            minPrice = num;
            minSubIdx = 0;
            minColIdx = cIdx;
            minSubName = 'STANDARD';
          }
        }
      });
    }

    if (minColIdx === -1) {
      return { minPrice: null, minSubIdx: -1, minColIdx: -1, minSubName: '', formattedMin: '-' };
    }
    return {
      minPrice,
      minSubIdx,
      minColIdx,
      minSubName,
      formattedMin: String(minPrice)
    };
  };

  // Toast Notification System
  const showToast = (message, isAlert = false) => {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-msg ${isAlert ? 'toast-alert' : ''}`;
    toast.textContent = String(message).toUpperCase();
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  // Cache state locally
  const saveLocalCache = () => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(items));
      localStorage.setItem(COL_COUNT_KEY, String(columnCount));
      localStorage.setItem(ZOOM_KEY, String(zoomLevel));
    } catch (e) {}
  };

  // -------------------------------------------------------------
  // SEAMLESS DATABASE SYNC (Firebase RTDB REST & EventSource)
  // -------------------------------------------------------------
  const updateConnectionStatus = (online) => {
    isConnected = online;
    const liveDot = document.getElementById('liveDot');
    const liveText = document.getElementById('liveText');
    const indicator = document.getElementById('liveIndicator');
    if (!liveDot || !liveText || !indicator) return;
    if (online) {
      liveDot.style.background = '#10B981';
      liveText.style.color = '#047857';
      liveText.textContent = 'LIVE';
      indicator.title = 'FIREBASE REALTIME DATABASE CONNECTED';
    } else {
      liveDot.style.background = '#EF4444';
      liveText.style.color = '#B91C1C';
      liveText.textContent = 'OFFLINE';
      indicator.title = 'RECONNECTING TO DATABASE...';
    }
  };

  // Fetch items from Firebase
  let lastFetchedHash = '';
  const fetchDatabaseItems = async (forceRender = true) => {
    try {
      const res = await fetch(`${DB_ENDPOINT}.json`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const val = await res.json();

      if (val && typeof val === 'object' && Object.keys(val).length > 0) {
        // Read metadata if available
        if (val['_column_meta'] && val['_column_meta'].columnCount) {
          const metaCols = parseInt(val['_column_meta'].columnCount, 10);
          if (metaCols >= 1 && metaCols !== columnCount) {
            columnCount = metaCols;
          }
        }

        // Filter out internal metadata keys (starting with '_')
        const itemKeys = Object.keys(val).filter(k => !k.startsWith('_'));
        const list = itemKeys.map(k => {
          const item = val[k] || {};
          const normSlots = normalizeItemSlots(item.slots, columnCount);
          const normSubs = normalizeSubclasses(item.subclasses, columnCount, item.slots, item.subClass);
          return {
            id: item.id || k,
            itemName: (item.itemName || '').toUpperCase(),
            subClass: (item.subClass || (normSubs[0]?.name || '')).toUpperCase(),
            createdAt: item.createdAt || Date.now(),
            updatedAt: item.updatedAt || Date.now(),
            slots: normSlots,
            subclasses: normSubs
          };
        });
        list.sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0));
        
        const currentHash = JSON.stringify(list) + `::cols=${columnCount}`;
        if (currentHash !== lastFetchedHash || forceRender) {
          lastFetchedHash = currentHash;
          items = list;
          // Adjust columnCount dynamically if items have more slots
          const maxSlots = Math.max(...items.map(it => (it.slots || []).length), 1);
          if (maxSlots > columnCount) {
            columnCount = maxSlots;
          }
          saveLocalCache();
          renderTable();
        }
      } else {
        // Database is cleared or empty: DO NOT bring back old entries!
        if (lastFetchedHash !== 'empty' || forceRender) {
          lastFetchedHash = 'empty';
          items = [];
          saveLocalCache();
          renderTable();
        }
      }
      updateConnectionStatus(true);
    } catch (err) {
      console.warn('[DB] Sync error:', err);
      updateConnectionStatus(false);
      if (items.length === 0) {
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            items = JSON.parse(cached);
            renderTable();
          }
        } catch (e) {}
      }
    }
  };

  const syncColumnMeta = async (count) => {
    try {
      await fetch(`${META_ENDPOINT}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnCount: count, updatedAt: Date.now() })
      });
    } catch (e) {}
  };

  const syncInitialDataToCloud = async () => {
    try {
      const payload = {};
      items.forEach((it, idx) => {
        const normSlots = normalizeItemSlots(it.slots, columnCount);
        const normSubs = normalizeSubclasses(it.subclasses, columnCount, it.slots, it.subClass);
        payload[it.id] = {
          id: it.id,
          itemName: it.itemName,
          subClass: it.subClass || (normSubs[0]?.name || ''),
          slots: normSlots,
          subclasses: normSubs,
          createdAt: it.createdAt || Date.now() + idx,
          updatedAt: Date.now()
        };
      });
      payload['_column_meta'] = { columnCount, updatedAt: Date.now() };

      await fetch(`${DB_ENDPOINT}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      updateConnectionStatus(true);
    } catch (e) {
      updateConnectionStatus(false);
    }
  };

  const CLIENT_SESSION_ID = 'client_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

  const saveItemToDatabase = async (item) => {
    try {
      const normSlots = normalizeItemSlots(item.slots, columnCount);
      const normSubs = normalizeSubclasses(item.subclasses, columnCount, item.slots, item.subClass);
      const payload = {
        id: item.id,
        itemName: item.itemName,
        subClass: item.subClass || (normSubs[0]?.name || ''),
        createdAt: item.createdAt || Date.now(),
        slots: normSlots,
        subclasses: normSubs,
        updatedAt: Date.now(),
        _clientSessionId: CLIENT_SESSION_ID
      };
      await fetch(`${DB_ENDPOINT}/${item.id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      updateConnectionStatus(true);
    } catch (err) {
      console.warn('[DB] Save error:', err);
      updateConnectionStatus(false);
    }
  };

  const deleteItemFromDatabase = async (itemId) => {
    try {
      await fetch(`${DB_ENDPOINT}/${itemId}.json`, { method: 'DELETE' });
      updateConnectionStatus(true);
    } catch (err) {
      updateConnectionStatus(false);
    }
  };

  // Live Real-Time Server-Sent Events (SSE) Listener with Granular Low-Latency Sync
  const setupRealtimeListener = () => {
    try {
      if (eventSource) {
        try { eventSource.close(); } catch(e) {}
      }
      eventSource = new EventSource(`${DB_ENDPOINT}.json`);

      eventSource.addEventListener('put', (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (!parsed) return;
          const { path: eventPath, data: eventData } = parsed;

          // Ignore own update echo to eliminate unnecessary re-renders
          if (eventData && typeof eventData === 'object' && eventData._clientSessionId === CLIENT_SESSION_ID) {
            return;
          }

          if (eventPath === '/') {
            if (!eventData || typeof eventData !== 'object') {
              items = [];
            } else {
              if (eventData['_column_meta'] && eventData['_column_meta'].columnCount) {
                const metaCols = parseInt(eventData['_column_meta'].columnCount, 10);
                if (metaCols >= 1) columnCount = metaCols;
              }
              const itemKeys = Object.keys(eventData).filter(k => !k.startsWith('_'));
              const list = itemKeys.map(k => {
                const raw = eventData[k] || {};
                const normSlots = normalizeItemSlots(raw.slots, columnCount);
                const normSubs = normalizeSubclasses(raw.subclasses, columnCount, raw.slots, raw.subClass);
                return {
                  ...raw,
                  id: raw.id || k,
                  slots: normSlots,
                  subclasses: normSubs
                };
              });
              list.sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0));
              items = list;
              const maxSlots = Math.max(...items.map(it => (it.slots || []).length), 1);
              if (maxSlots > columnCount) columnCount = maxSlots;
            }
            saveLocalCache();
            renderTable();
            updateConnectionStatus(true);
          } else if (eventPath.startsWith('/')) {
            const parts = eventPath.split('/').filter(Boolean);
            const itemId = parts[0];

            if (itemId === '_column_meta') {
              if (eventData && eventData.columnCount) {
                const newCols = parseInt(eventData.columnCount, 10);
                if (newCols >= 1 && newCols !== columnCount) {
                  columnCount = newCols;
                  saveLocalCache();
                  renderTable();
                }
              }
              return;
            }

            const existingItem = items.find(it => it.id === itemId);

            if (parts.length === 1) {
              if (eventData === null) {
                items = items.filter(it => it.id !== itemId);
              } else {
                const normSlots = normalizeItemSlots(eventData.slots, columnCount);
                const normSubs = normalizeSubclasses(eventData.subclasses, columnCount, eventData.slots, eventData.subClass);
                const updated = {
                  ...eventData,
                  id: eventData.id || itemId,
                  slots: normSlots,
                  subclasses: normSubs
                };
                const existingIdx = items.findIndex(it => it.id === itemId);
                if (existingIdx !== -1) {
                  items[existingIdx] = updated;
                } else {
                  items.push(updated);
                  items.sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0));
                }
              }
              saveLocalCache();
              renderTable();
              updateConnectionStatus(true);
            } else if (existingItem) {
              // Direct in-memory property update: ZERO LATENCY sync
              if (parts[1] === 'subclasses' && parts[3] === 'prices') {
                const subIdx = parseInt(parts[2], 10);
                const colIdx = parseInt(parts[4], 10);
                if (existingItem.subclasses?.[subIdx]?.prices) {
                  existingItem.subclasses[subIdx].prices[colIdx] = eventData || '';
                }
                const cell = document.getElementById(`price-cell-${itemId}-${subIdx}-${colIdx}`);
                const inp = cell ? cell.querySelector('input') : null;
                if (inp && document.activeElement !== inp) {
                  inp.value = eventData || '';
                }
                refreshLowestPriceDisplay(existingItem);
              } else if (parts[1] === 'slots') {
                const sIdx = parseInt(parts[2], 10);
                const field = parts[3];
                if (existingItem.slots?.[sIdx] && field) {
                  existingItem.slots[sIdx][field] = eventData || '';
                }
                if (field === 'date') {
                  const dInp = document.getElementById(`date-input-${itemId}-${sIdx}`);
                  if (dInp && document.activeElement !== dInp) dInp.value = eventData || '';
                }
              } else if (parts[1] === 'itemName') {
                existingItem.itemName = eventData || '';
                const nInp = document.querySelector(`.row-block[data-id="${itemId}"] .item-name-input`);
                if (nInp && document.activeElement !== nInp) nInp.value = eventData || '';
              } else {
                fetchDatabaseItems(false);
              }
              saveLocalCache();
              updateConnectionStatus(true);
            } else {
              fetchDatabaseItems(false);
            }
          }
        } catch (err) {
          console.warn('[SSE put error]:', err);
        }
      });

      eventSource.addEventListener('patch', (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed && parsed.data && parsed.data._clientSessionId === CLIENT_SESSION_ID) return;
          fetchDatabaseItems(false);
        } catch(e) {
          fetchDatabaseItems(false);
        }
      });

      eventSource.onopen = () => {
        updateConnectionStatus(true);
      };

      eventSource.onerror = () => {
        updateConnectionStatus(false);
      };
    } catch (err) {
      updateConnectionStatus(false);
    }
  };

  const ensureSSEConnected = () => {
    if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
      setupRealtimeListener();
    }
  };

  // Helper to dynamically refresh lowest price indicator for a tool
  const refreshLowestPriceDisplay = (item) => {
    const updatedLowest = calculateLowestPrice(item, columnCount);
    const lBtn = document.getElementById(`lowest-btn-${item.id}`);
    if (lBtn) {
      lBtn.title = updatedLowest.minColIdx !== -1 
        ? `CLICK TO HIGHLIGHT LOWEST PRICE FOR EACH SUBCLASS (3 SECONDS)` 
        : 'NO VALID PRICES ENTERED';
      lBtn.innerHTML = `
        <span>LOWEST:</span>
        <span style="font-family: monospace; color: #047857; font-weight: 700;">
          ${updatedLowest.formattedMin}
        </span>
      `;
    }
  };

  // Periodic heartbeat and watchdog (every 2.5s)
  setInterval(() => {
    ensureSSEConnected();
    if (document.visibilityState === 'visible' && !document.activeElement?.classList?.contains('cell-input')) {
      fetchDatabaseItems(false);
    }
  }, 2500);

  // Instant synchronization on focus, mobile wake, visibilitychange, online
  window.addEventListener('pageshow', () => {
    ensureSSEConnected();
    fetchDatabaseItems(true);
  });
  window.addEventListener('focus', () => {
    ensureSSEConnected();
    fetchDatabaseItems(false);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      ensureSSEConnected();
      fetchDatabaseItems(false);
    }
  });
  window.addEventListener('online', () => {
    ensureSSEConnected();
    fetchDatabaseItems(true);
  });

  // Mobile Pull-to-Refresh Gesture Implementation
  const setupPullToRefresh = () => {
    const scrollCont = document.getElementById('scrollContainer');
    const ptr = document.getElementById('pullToRefresh');
    const ptrIcon = document.getElementById('ptrIcon');
    const ptrSpinner = document.getElementById('ptrSpinner');
    const ptrText = document.getElementById('ptrText');
    if (!scrollCont || !ptr) return;

    let startY = 0;
    let isPulling = false;
    let isRefreshing = false;
    const THRESHOLD = 65;

    scrollCont.addEventListener('touchstart', (e) => {
      if (isRefreshing) return;
      if (scrollCont.scrollTop <= 2) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    }, { passive: true });

    scrollCont.addEventListener('touchmove', (e) => {
      if (!isPulling || isRefreshing) return;
      const currentY = e.touches[0].clientY;
      const pullDiff = currentY - startY;

      if (pullDiff > 0 && scrollCont.scrollTop <= 2) {
        const pullHeight = Math.min(75, pullDiff * 0.42);
        ptr.style.height = `${pullHeight}px`;
        ptr.style.opacity = Math.min(1, pullHeight / 35);

        if (pullHeight >= THRESHOLD * 0.42) {
          ptrIcon.style.transform = 'rotate(180deg)';
          ptrText.textContent = 'RELEASE TO REFRESH';
        } else {
          ptrIcon.style.transform = 'rotate(0deg)';
          ptrText.textContent = 'PULL TO REFRESH';
        }
      }
    }, { passive: true });

    const finishPull = async (e) => {
      if (!isPulling || isRefreshing) return;
      isPulling = false;
      const endY = e.changedTouches ? e.changedTouches[0].clientY : 0;
      const pullDiff = endY - startY;
      const pullHeight = pullDiff * 0.42;

      if (pullHeight >= THRESHOLD * 0.42 && scrollCont.scrollTop <= 2) {
        isRefreshing = true;
        ptr.style.height = '44px';
        ptrIcon.style.display = 'none';
        ptrSpinner.style.display = 'inline-block';
        ptrText.textContent = 'REFRESHING...';

        if (navigator.vibrate) {
          try { navigator.vibrate(40); } catch(err) {}
        }

        try {
          ensureSSEConnected();
          await fetchDatabaseItems(true);
          showToast('DATABASE REFRESHED');
        } catch (err) {
          showToast('REFRESH COMPLETE');
        } finally {
          setTimeout(() => {
            ptr.style.transition = 'height 0.25s ease, opacity 0.25s ease';
            ptr.style.height = '0px';
            ptr.style.opacity = '0';
            setTimeout(() => {
              ptr.style.transition = '';
              ptrIcon.style.display = 'inline-block';
              ptrIcon.style.transform = 'rotate(0deg)';
              ptrSpinner.style.display = 'none';
              ptrText.textContent = 'PULL TO REFRESH';
              isRefreshing = false;
            }, 250);
          }, 400);
        }
      } else {
        ptr.style.transition = 'height 0.2s ease, opacity 0.2s ease';
        ptr.style.height = '0px';
        ptr.style.opacity = '0';
        setTimeout(() => {
          ptr.style.transition = '';
        }, 200);
      }
    };

    scrollCont.addEventListener('touchend', finishPull, { passive: true });
    scrollCont.addEventListener('touchcancel', finishPull, { passive: true });
  };

  // -------------------------------------------------------------
  // SPREADSHEET RENDERING
  // -------------------------------------------------------------
  const renderTable = () => {
    // Render Column Headers
    const detailHeadersContainer = document.getElementById('detailHeadersContainer');
    if (!detailHeadersContainer) return;
    detailHeadersContainer.innerHTML = '';
    for (let idx = 0; idx < columnCount; idx++) {
      const colHeader = document.createElement('div');
      colHeader.className = 'col-detail header-col col-border';
      colHeader.style.borderRight = '1px solid #334155';
      colHeader.style.padding = '8px 10px';
      colHeader.style.fontSize = '14px';
      colHeader.style.fontWeight = '600';
      colHeader.style.color = '#FFFFFF';
      colHeader.style.backgroundColor = '#0F172A';
      colHeader.style.display = 'flex';
      colHeader.style.alignItems = 'center';
      colHeader.style.justifyContent = 'space-between';
      colHeader.style.gap = '6px';

      // Left invisible spacer to keep title centered
      const leftSpacer = document.createElement('span');
      leftSpacer.style.width = '18px';
      leftSpacer.style.flexShrink = '0';
      colHeader.appendChild(leftSpacer);

      const colLabel = document.createElement('span');
      colLabel.style.flex = '1';
      colLabel.style.textAlign = 'center';
      colLabel.style.whiteSpace = 'nowrap';
      colLabel.textContent = `COLUMN ${idx + 1}`;
      colHeader.appendChild(colLabel);

      // Delete Column '✕' mark aligned to right
      const delColBtn = document.createElement('button');
      delColBtn.className = 'delete-col-header-btn';
      delColBtn.title = `DELETE COLUMN ${idx + 1}`;
      delColBtn.textContent = '✕';
      delColBtn.style.flexShrink = '0';
      delColBtn.onclick = (e) => {
        e.stopPropagation();
        deleteSpecificColumn(idx);
      };
      colHeader.appendChild(delColBtn);

      detailHeadersContainer.appendChild(colHeader);
    }

    // Filter items based on search query
    const q = searchQuery.trim().toUpperCase();
    const filtered = items.filter(it => {
      if (!q) return true;
      if ((it.itemName || '').includes(q)) return true;
      if ((it.subClass || '').includes(q)) return true;
      if ((it.subclasses || []).some(sub => (sub.name || '').includes(q) || (sub.prices || []).some(p => String(p).includes(q)))) return true;
      return (it.slots || []).some(s => 
        (s.toolName || '').includes(q) ||
        (s.toolCode || '').includes(q) ||
        (s.price || '').includes(q) ||
        (s.date || '').includes(q)
      );
    });

    // Update counts in footer
    const totalRowsElem = document.getElementById('totalRowsCount');
    if (totalRowsElem) totalRowsElem.textContent = items.length;
    const totalColsElem = document.getElementById('totalColsCount');
    if (totalColsElem) totalColsElem.textContent = columnCount + 1;
    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus) {
      if (q) {
        filterStatus.style.display = 'inline';
        filterStatus.textContent = `FILTERED: ${filtered.length}`;
      } else {
        filterStatus.style.display = 'none';
      }
    }

    // Render Item Row Blocks
    const rowsContainer = document.getElementById('rowsContainer');
    if (!rowsContainer) return;
    rowsContainer.innerHTML = '';

    if (filtered.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.padding = '48px 16px';
      emptyDiv.style.textAlign = 'center';
      emptyDiv.style.background = '#FFFFFF';
      emptyDiv.style.color = '#64748B';

      // Secure DOM creation: XSS-safe
      const emptyTitle = document.createElement('div');
      emptyTitle.style.cssText = 'font-size: 15px; font-weight: 600; color: #000000; margin-bottom: 8px;';
      emptyTitle.textContent = q ? `NO ITEMS FOUND MATCHING "${q}"` : 'NO ITEMS RECORDED';
      emptyDiv.appendChild(emptyTitle);

      const emptySub = document.createElement('div');
      emptySub.style.cssText = 'font-size: 13px; color: #64748B;';
      emptySub.textContent = 'CLICK "+ ADD ROW" ABOVE TO INSERT A NEW ITEM';
      emptyDiv.appendChild(emptySub);

      rowsContainer.appendChild(emptyDiv);
      return;
    }

    filtered.forEach((item, rowIndex) => {
      const isEven = rowIndex % 2 === 0;
      const slots = normalizeItemSlots(item.slots, columnCount);
      const subclasses = normalizeSubclasses(item.subclasses, columnCount, item.slots, item.subClass);
      item.slots = slots;
      item.subclasses = subclasses;
      const lowestInfo = calculateLowestPrice(item, columnCount);

      // Entire tool group block container with alternating background striping
      const rowBlock = document.createElement('div');
      rowBlock.className = `row-block ${isEven ? 'block-even' : 'block-odd'}`;
      rowBlock.setAttribute('data-id', item.id);
      rowBlock.style.display = 'flex';
      rowBlock.style.minWidth = '100%';
      rowBlock.style.width = 'max-content';
      rowBlock.style.backgroundColor = isEven ? '#FFFFFF' : '#E0F2FE';

      // ---------------------------------------------------------
      // SPECIFICATIONS COLUMN (Column 1)
      // 1. Tool Number
      // 2. Item Name
      // 3. Lowest Value
      // 4. Subclasses + Add Subclass Button
      // ---------------------------------------------------------
      const col1 = document.createElement('div');
      col1.className = 'col-item';

      // Row 1: Tool Number (TOOL 1, TOOL 2...)
      const r1 = document.createElement('div');
      r1.className = 'row-cell sub-row justify-between';
      
      const r1Label = document.createElement('span');
      r1Label.className = 'cell-text';
      r1Label.textContent = `TOOL ${rowIndex + 1}`;
      r1.appendChild(r1Label);

      const delToolBtn = document.createElement('button');
      delToolBtn.className = 'delete-row-btn';
      delToolBtn.title = 'DELETE TOOL';
      delToolBtn.style.cssText = 'background: transparent; border: none; cursor: pointer; color: #94A3B8; font-size: 14px; padding: 2px 4px;';
      delToolBtn.textContent = '✕';
      delToolBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`DELETE TOOL "${item.itemName || 'TOOL ' + (rowIndex + 1)}"?`)) {
          deleteItem(item.id);
        }
      };
      r1.appendChild(delToolBtn);
      col1.appendChild(r1);

      // Row 2: Item Name
      const r2 = document.createElement('div');
      r2.className = 'row-cell sub-row';
      const itemNameInput = document.createElement('input');
      itemNameInput.className = 'cell-input text-left cell-text item-name-input';
      itemNameInput.value = item.itemName || '';
      itemNameInput.placeholder = 'ITEM NAME';
      itemNameInput.onchange = (e) => {
        const val = e.target.value.toUpperCase();
        item.itemName = val;
        saveLocalCache();
        saveItemToDatabase(item);
      };
      r2.appendChild(itemNameInput);
      col1.appendChild(r2);

      // Row 3: Lowest Value Button
      const r3 = document.createElement('div');
      r3.className = 'row-cell sub-row';
      const lowestBtn = document.createElement('button');
      lowestBtn.className = 'lowest-price-btn';
      lowestBtn.id = `lowest-btn-${item.id}`;
      lowestBtn.title = lowestInfo.minColIdx !== -1 
        ? `CLICK TO FIND & HIGHLIGHT LOWEST PRICE (${lowestInfo.formattedMin} IN ${lowestInfo.minSubName})` 
        : 'NO VALID PRICES ENTERED';
      lowestBtn.innerHTML = `
        <span>LOWEST:</span>
        <span style="font-family: monospace; color: #047857; font-weight: 700;">
          ${lowestInfo.formattedMin}
        </span>
      `;
      lowestBtn.onclick = () => {
        handleLowestPriceAction(item.id);
      };
      r3.appendChild(lowestBtn);
      col1.appendChild(r3);

      // Row 4+: Subclasses
      subclasses.forEach((sub, subIdx) => {
        const rSub = document.createElement('div');
        rSub.className = 'row-cell sub-row justify-between';
        
        const subInput = document.createElement('input');
        subInput.className = 'cell-input text-left cell-text';
        subInput.value = sub.name || '';
        subInput.placeholder = `SUBCLASS ${subIdx + 1}`;
        subInput.style.flex = '1';
        subInput.onchange = (e) => {
          const val = e.target.value.toUpperCase();
          sub.name = val;
          if (subIdx === 0) item.subClass = val;
          saveLocalCache();
          saveItemToDatabase(item);
        };
        rSub.appendChild(subInput);

        if (subclasses.length > 1) {
          const delSubBtn = document.createElement('button');
          delSubBtn.className = 'delete-sub-btn';
          delSubBtn.title = 'DELETE THIS SUBCLASS';
          delSubBtn.textContent = '✕';
          delSubBtn.onclick = (e) => {
            e.stopPropagation();
            deleteSubclass(item.id, subIdx);
          };
          rSub.appendChild(delSubBtn);
        }
        col1.appendChild(rSub);
      });

      // Add Subclass Button
      const rAddSub = document.createElement('div');
      rAddSub.className = 'row-cell';
      rAddSub.style.padding = '4px 8px';
      const addSubBtn = document.createElement('button');
      addSubBtn.className = 'add-subclass-btn';
      addSubBtn.title = 'ADD NEW SUBCLASS VARIANT TO THIS TOOL';
      addSubBtn.innerHTML = `<span>+ ADD SUBCLASS</span>`;
      addSubBtn.onclick = () => {
        addNewSubclass(item.id);
      };
      rAddSub.appendChild(addSubBtn);
      col1.appendChild(rAddSub);

      rowBlock.appendChild(col1);

      // ---------------------------------------------------------
      // DETAIL COLUMNS
      // Row 1: Date (DD/MM/YYYY)
      // Row 2: Tool Name
      // Row 3: Tool Code
      // Row 4+: Price Entry Fields
      // Spacer row matching '+ ADD SUBCLASS'
      // ---------------------------------------------------------
      const detailColsWrapper = document.createElement('div');
      detailColsWrapper.className = 'detail-cols-wrapper';
      detailColsWrapper.style.flex = '1 0 auto';
      detailColsWrapper.style.display = 'flex';
      detailColsWrapper.style.minWidth = 'max-content';
      detailColsWrapper.style.backgroundColor = isEven ? '#FFFFFF' : '#E0F2FE';

      for (let sIdx = 0; sIdx < columnCount; sIdx++) {
        const slot = slots[sIdx] || { date: '', toolName: '', toolCode: '' };
        
        const detailCol = document.createElement('div');
        detailCol.className = 'col-detail col-border';
        detailCol.style.backgroundColor = isEven ? '#FFFFFF' : '#E0F2FE';

        // Row 1: Date (DD/MM/YYYY)
        const dRow1 = document.createElement('div');
        dRow1.className = 'row-cell sub-row';
        dRow1.style.backgroundColor = isEven ? '#FFFFFF' : '#E0F2FE';
        const dateInput = document.createElement('input');
        dateInput.className = 'cell-input cell-text';
        dateInput.id = `date-input-${item.id}-${sIdx}`;
        dateInput.value = slot.date || '';
        dateInput.placeholder = '-';
        dateInput.onchange = (e) => {
          slot.date = e.target.value.toUpperCase();
          item.slots = slots;
          saveLocalCache();
          saveItemToDatabase(item);
        };
        dRow1.appendChild(dateInput);
        detailCol.appendChild(dRow1);

        // Row 2: Tool Name
        const dRow2 = document.createElement('div');
        dRow2.className = 'row-cell sub-row';
        dRow2.style.backgroundColor = isEven ? '#FFFFFF' : '#E0F2FE';
        const toolNameInput = document.createElement('input');
        toolNameInput.className = 'cell-input cell-text';
        toolNameInput.value = slot.toolName || '';
        toolNameInput.placeholder = '-';
        toolNameInput.onchange = (e) => {
          slot.toolName = e.target.value.toUpperCase();
          item.slots = slots;
          saveLocalCache();
          saveItemToDatabase(item);
        };
        dRow2.appendChild(toolNameInput);
        detailCol.appendChild(dRow2);

        // Row 3: Tool Code
        const dRow3 = document.createElement('div');
        dRow3.className = 'row-cell sub-row';
        dRow3.style.backgroundColor = isEven ? '#FFFFFF' : '#E0F2FE';
        const toolCodeInput = document.createElement('input');
        toolCodeInput.className = 'cell-input cell-text';
        toolCodeInput.value = slot.toolCode || '';
        toolCodeInput.placeholder = '-';
        toolCodeInput.onchange = (e) => {
          slot.toolCode = e.target.value.toUpperCase();
          item.slots = slots;
          saveLocalCache();
          saveItemToDatabase(item);
        };
        dRow3.appendChild(toolCodeInput);
        detailCol.appendChild(dRow3);

        // Row 4+: Corresponding Price Entry Field for each Subclass
        subclasses.forEach((sub, subIdx) => {
          const dRowSub = document.createElement('div');
          dRowSub.className = 'row-cell sub-row';
          dRowSub.id = `price-cell-${item.id}-${subIdx}-${sIdx}`;
          dRowSub.style.backgroundColor = isEven ? '#FFFFFF' : '#E0F2FE';

          const priceInput = document.createElement('input');
          priceInput.className = 'cell-input cell-text';
          priceInput.value = sub.prices[sIdx] || '';
          priceInput.placeholder = '-';
          priceInput.inputMode = 'decimal';

          let prevPriceValue = (sub.prices[sIdx] || '').toUpperCase().trim();
          priceInput.onfocus = () => {
            prevPriceValue = priceInput.value.toUpperCase().trim();
          };

          const handlePriceChange = () => {
            const val = priceInput.value.toUpperCase().trim();
            if (val !== prevPriceValue) {
              sub.prices[sIdx] = val;
              // If price changed to a valid value, auto-update date
              if (val && val !== '-') {
                const today = getTodayDate();
                slot.date = today;
                const dInput = document.getElementById(`date-input-${item.id}-${sIdx}`);
                if (dInput) dInput.value = today;
                showToast(`PRICE UPDATED -> DATE SET TO ${today}`);
              }
              prevPriceValue = val;
              item.slots = slots;
              item.subclasses = subclasses;
              saveLocalCache();
              saveItemToDatabase(item);

              refreshLowestPriceDisplay(item);
            }
          };

          priceInput.onchange = handlePriceChange;
          priceInput.onblur = handlePriceChange;
          priceInput.onkeydown = (e) => {
            if (e.key === 'Enter') priceInput.blur();
          };

          dRowSub.appendChild(priceInput);
          detailCol.appendChild(dRowSub);
        });

        // Add Subclass Spacer Row
        const dRowSpacer = document.createElement('div');
        dRowSpacer.className = 'row-cell';
        dRowSpacer.style.height = '40px';
        dRowSpacer.style.minHeight = '40px';
        dRowSpacer.style.backgroundColor = isEven ? '#FFFFFF' : '#E0F2FE';
        detailCol.appendChild(dRowSpacer);

        detailColsWrapper.appendChild(detailCol);
      }

      rowBlock.appendChild(detailColsWrapper);
      rowsContainer.appendChild(rowBlock);
    });
  };

  // -------------------------------------------------------------
  // LOWEST PRICE HIGHLIGHT FEATURE
  // -------------------------------------------------------------
  const handleLowestPriceAction = (itemId) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const subclasses = item.subclasses || [];
    const targetsToHighlight = [];
    const summary = [];

    subclasses.forEach((sub, sIdx) => {
      let minPrice = Infinity;
      let minColIdx = -1;
      const prices = Array.isArray(sub.prices) ? sub.prices : [];

      prices.forEach((price, cIdx) => {
        if (cIdx >= columnCount) return;
        if (price === undefined || price === null) return;
        const raw = String(price).trim().replace(/,/g, '');
        if (!raw || raw === '-') return;
        const num = parseFloat(raw);
        if (!isNaN(num) && isFinite(num) && num > 0) {
          if (num < minPrice) {
            minPrice = num;
            minColIdx = cIdx;
          }
        }
      });

      if (minColIdx !== -1) {
        targetsToHighlight.push({
          subIdx: sIdx,
          colIdx: minColIdx,
          price: minPrice,
          subName: sub.name || `SUBCLASS ${sIdx + 1}`
        });
        summary.push(`${sub.name || 'SUB ' + (sIdx + 1)}: ${minPrice} (COL ${minColIdx + 1})`);
      }
    });

    // Fallback to item.slots if no subclass price was found
    if (targetsToHighlight.length === 0 && Array.isArray(item.slots)) {
      let minPrice = Infinity;
      let minColIdx = -1;
      item.slots.forEach((slot, cIdx) => {
        if (cIdx >= columnCount) return;
        if (!slot || slot.price === undefined || slot.price === null) return;
        const raw = String(slot.price).trim().replace(/,/g, '');
        if (!raw || raw === '-') return;
        const num = parseFloat(raw);
        if (!isNaN(num) && isFinite(num) && num > 0) {
          if (num < minPrice) {
            minPrice = num;
            minColIdx = cIdx;
          }
        }
      });
      if (minColIdx !== -1) {
        targetsToHighlight.push({
          subIdx: 0,
          colIdx: minColIdx,
          price: minPrice,
          subName: 'STANDARD'
        });
        summary.push(`STANDARD: ${minPrice} (COL ${minColIdx + 1})`);
      }
    }

    if (targetsToHighlight.length === 0) {
      showToast('NO VALID PRICES RECORDED FOR THIS TOOL', true);
      return;
    }

    // Auto-scroll the first lowest price cell into viewport
    const firstTarget = targetsToHighlight[0];
    const firstCell = document.getElementById(`price-cell-${itemId}-${firstTarget.subIdx}-${firstTarget.colIdx}`);
    if (firstCell) {
      firstCell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // Highlight the lowest price cell for EACH individual subclass for 3 SECONDS
    targetsToHighlight.forEach((target) => {
      const targetCell = document.getElementById(`price-cell-${itemId}-${target.subIdx}-${target.colIdx}`);
      if (targetCell) {
        targetCell.classList.remove('highlight-lowest-3s', 'blink-4-times');
        void targetCell.offsetWidth; // Force reflow
        targetCell.classList.add('highlight-lowest-3s');

        setTimeout(() => {
          targetCell.classList.remove('highlight-lowest-3s');
        }, 3000);
      }
    });

    showToast(`LOWEST PRICE FOR EACH SUBCLASS HIGHLIGHTED (3 SECONDS): ${summary.join(' | ')}`);
  };

  // -------------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------------
  const addNewRow = () => {
    if (searchQuery) {
      searchQuery = '';
      const sInp = document.getElementById('searchInput');
      if (sInp) sInp.value = '';
    }

    const newId = `item-${Date.now()}-${Math.random().toString(36).substring(2,6)}`;
    const emptySlots = [];
    for (let i = 0; i < columnCount; i++) {
      emptySlots.push({ date: '', toolName: '', toolCode: '' });
    }
    const newRow = {
      id: newId,
      itemName: '',
      subClass: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      slots: emptySlots,
      subclasses: [
        {
          id: `sub-${Date.now()}-${Math.random().toString(36).substring(2,6)}`,
          name: '',
          prices: new Array(columnCount).fill('')
        }
      ]
    };
    items.push(newRow);
    saveLocalCache();
    saveItemToDatabase(newRow);
    renderTable();
    showToast('NEW ITEM ROW ADDED');

    setTimeout(() => {
      const scrollCont = document.getElementById('scrollContainer');
      if (scrollCont) {
        scrollCont.scrollTo({ top: scrollCont.scrollHeight, behavior: 'smooth' });
      }
    }, 100);
  };

  const addNewSubclass = (itemId) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    if (!item.subclasses) item.subclasses = [];
    const newSub = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2,6)}`,
      name: '',
      prices: new Array(columnCount).fill('')
    };
    item.subclasses.push(newSub);

    saveLocalCache();
    saveItemToDatabase(item);
    renderTable();
    showToast(`NEW SUBCLASS ADDED TO ${item.itemName || 'TOOL'}`);
  };

  const deleteSubclass = (itemId, subIdx) => {
    const item = items.find(i => i.id === itemId);
    if (!item || !item.subclasses || item.subclasses.length <= 1) {
      showToast('MINIMUM 1 SUBCLASS REQUIRED PER TOOL', true);
      return;
    }
    const subName = item.subclasses[subIdx]?.name || `SUBCLASS ${subIdx + 1}`;
    if (!confirm(`ARE YOU SURE YOU WANT TO DELETE "${subName}" AND ITS ASSIGNED PRICES?`)) {
      return;
    }
    item.subclasses.splice(subIdx, 1);
    if (item.subclasses.length > 0) {
      item.subClass = item.subclasses[0].name;
    }
    saveLocalCache();
    saveItemToDatabase(item);
    renderTable();
    showToast('SUBCLASS DELETED');
  };

  const addNewColumn = () => {
    columnCount += 1;
    items.forEach(it => {
      it.slots = normalizeItemSlots(it.slots, columnCount);
      it.subclasses = normalizeSubclasses(it.subclasses, columnCount, it.slots, it.subClass);
    });
    saveLocalCache();
    syncColumnMeta(columnCount);
    items.forEach(it => saveItemToDatabase(it));
    renderTable();
    showToast(`COLUMN ${columnCount} ADDED`);
  };

  // Delete specific column (Cryptographic PIN check via SecurityUtils)
  const deleteSpecificColumn = (slotIdx) => {
    if (columnCount <= 1) {
      showToast('MINIMUM 1 DETAIL COLUMN REQUIRED', true);
      return;
    }
    const colNum = slotIdx + 1;
    const enteredPin = prompt(`ENTER PIN TO CONFIRM DELETION OF COLUMN ${colNum}:`);
    if (enteredPin === null) {
      return;
    }

    const isAuthorized = (typeof SecurityUtils !== 'undefined' && SecurityUtils.verifyPin)
      ? SecurityUtils.verifyPin(enteredPin)
      : (enteredPin.trim() === '7722');

    if (!isAuthorized) {
      showToast('INCORRECT PIN - DELETION CANCELLED', true);
      return;
    }

    items.forEach(it => {
      if (Array.isArray(it.slots) && it.slots.length > slotIdx) {
        it.slots.splice(slotIdx, 1);
      }
      (it.subclasses || []).forEach(sub => {
        if (Array.isArray(sub.prices) && sub.prices.length > slotIdx) {
          sub.prices.splice(slotIdx, 1);
        }
      });
    });
    columnCount = Math.max(1, columnCount - 1);
    saveLocalCache();
    syncColumnMeta(columnCount);
    items.forEach(it => saveItemToDatabase(it));
    renderTable();
    showToast(`COLUMN ${colNum} DELETED`);
  };

  const deleteItem = (itemId) => {
    items = items.filter(it => it.id !== itemId);
    saveLocalCache();
    deleteItemFromDatabase(itemId);
    renderTable();
    showToast('ITEM ROW DELETED');
  };

  // Zoom Controls (70% to 150%)
  const setZoom = (val) => {
    zoomLevel = Math.max(70, Math.min(150, val));
    document.documentElement.style.setProperty('--app-zoom', `${zoomLevel}%`);
    const zoomDisp = document.getElementById('zoomDisplay');
    if (zoomDisp) zoomDisp.textContent = `${zoomLevel}%`;
    saveLocalCache();
  };

  // CSV Export
  const exportCSV = () => {
    let csv = 'SPECIFICATIONS,SUB CLASS';
    for (let c = 0; c < columnCount; c++) {
      csv += `,COLUMN ${c + 1}`;
    }
    csv += '\n';

    items.forEach((it, idx) => {
      const slots = normalizeItemSlots(it.slots, columnCount);
      const subclasses = normalizeSubclasses(it.subclasses, columnCount, it.slots, it.subClass);
      const lowest = calculateLowestPrice(it, columnCount);

      // Row 1: Tool Number & Date
      csv += `"TOOL ${idx + 1}","DATE"`;
      slots.forEach(s => csv += `,"${s.date || '-'}"`);
      csv += '\n';

      // Row 2: Item Name & Tool Name
      csv += `"${it.itemName || ''}","TOOL NAME"`;
      slots.forEach(s => csv += `,"${s.toolName || '-'}"`);
      csv += '\n';

      // Row 3: Lowest Value & Tool Code
      csv += `"LOWEST: ${lowest.formattedMin}","TOOL CODE"`;
      slots.forEach(s => csv += `,"${s.toolCode || '-'}"`);
      csv += '\n';

      // Subclass rows: Subclass Name & Prices
      subclasses.forEach((sub, sIdx) => {
        csv += `"${sub.name || 'SUBCLASS ' + (sIdx + 1)}","PRICE"`;
        for (let c = 0; c < columnCount; c++) {
          csv += `,"${sub.prices[c] || '-'}"`;
        }
        csv += '\n';
      });

      csv += '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PRICE_TRACKER_${getTodayDate().replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('EXPORTED CSV SPREADSHEET');
  };

  // -------------------------------------------------------------
  // EVENT LISTENERS & INITIALIZATION
  // -------------------------------------------------------------
  const addRowBtn = document.getElementById('addRowBtn');
  if (addRowBtn) addRowBtn.onclick = addNewRow;

  const bottomAddRowBtn = document.getElementById('bottomAddRowBtn');
  if (bottomAddRowBtn) bottomAddRowBtn.onclick = addNewRow;

  const addColumnBtn = document.getElementById('addColumnBtn');
  if (addColumnBtn) addColumnBtn.onclick = addNewColumn;

  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) exportBtn.onclick = exportCSV;

  // Zoom Buttons
  const zoomInBtn = document.getElementById('zoomInBtn');
  if (zoomInBtn) zoomInBtn.onclick = () => setZoom(zoomLevel + 10);

  const zoomOutBtn = document.getElementById('zoomOutBtn');
  if (zoomOutBtn) zoomOutBtn.onclick = () => setZoom(zoomLevel - 10);

  const zoomResetBtn = document.getElementById('zoomResetBtn');
  if (zoomResetBtn) zoomResetBtn.onclick = () => setZoom(100);

  // Search Filtering
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.oninput = (e) => {
      searchQuery = e.target.value.toUpperCase();
      renderTable();
    };
  }

  // Clear Modal Management with Security PIN Check
  const clearModal = document.getElementById('clearModal');
  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn && clearModal) {
    clearBtn.onclick = () => {
      clearModal.classList.add('active');
    };
  }

  const modalCancelClear = document.getElementById('modalCancelClear');
  if (modalCancelClear && clearModal) {
    modalCancelClear.onclick = () => {
      clearModal.classList.remove('active');
    };
  }

  const modalClearAll = document.getElementById('modalClearAll');
  if (modalClearAll && clearModal) {
    modalClearAll.onclick = async () => {
      const enteredPin = prompt('ENTER PIN TO CONFIRM CLEARING ALL SPREADSHEET DATA:');
      if (enteredPin === null) return;

      const isAuthorized = (typeof SecurityUtils !== 'undefined' && SecurityUtils.verifyPin)
        ? SecurityUtils.verifyPin(enteredPin)
        : (enteredPin.trim() === '7722');

      if (!isAuthorized) {
        showToast('INCORRECT PIN - CLEAR CANCELLED', true);
        return;
      }

      items = [];
      saveLocalCache();
      try {
        await fetch(`${DB_ENDPOINT}.json`, { method: 'DELETE' });
      } catch(e) {}
      renderTable();
      clearModal.classList.remove('active');
      showToast('SPREADSHEET CLEARED');
    };
  }

  const modalResetTemplate = document.getElementById('modalResetTemplate');
  if (modalResetTemplate && clearModal) {
    modalResetTemplate.onclick = async () => {
      const enteredPin = prompt('ENTER PIN TO CONFIRM RESETTING TEMPLATE:');
      if (enteredPin === null) return;

      const isAuthorized = (typeof SecurityUtils !== 'undefined' && SecurityUtils.verifyPin)
        ? SecurityUtils.verifyPin(enteredPin)
        : (enteredPin.trim() === '7722');

      if (!isAuthorized) {
        showToast('INCORRECT PIN - RESET CANCELLED', true);
        return;
      }

      items = JSON.parse(JSON.stringify(DEFAULT_SAMPLE_DATA));
      columnCount = 3;
      saveLocalCache();
      await syncInitialDataToCloud();
      renderTable();
      clearModal.classList.remove('active');
      showToast('RESET TO DEFAULT TEMPLATE');
    };
  }

  // Initialize
  setZoom(zoomLevel);
  fetchDatabaseItems(true);
  setupRealtimeListener();
  setupPullToRefresh();

})();
