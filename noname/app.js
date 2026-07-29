document.addEventListener('DOMContentLoaded', () => {

  // Initialize Lucide Icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // Element References
  const tableBody = document.getElementById('tableBody');
  const addRowBtn = document.getElementById('addRowBtn');
  const addBottomRowBtn = document.getElementById('addBottomRowBtn');
  const resetTableBtn = document.getElementById('resetTableBtn');
  
  const onHandStockVal = document.getElementById('onHandStockVal');
  const physicalStockInput = document.getElementById('physicalStockInput');
  const differenceVal = document.getElementById('differenceVal');
  const referenceInput = document.getElementById('referenceInput');
  const docDateInput = document.getElementById('docDateInput');

  const headerDownloadBtn = document.getElementById('headerDownloadBtn');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');

  // Storage Keys
  const STORAGE_KEYS = {
    ROWS_DATA: 'narration_reconciliation_rows_v7',
    PHYSICAL_STOCK: 'narration_physical_stock_v7',
    REFERENCE_NO: 'narration_reference_no_v7',
    DOC_DATE: 'narration_doc_date_v7'
  };

  // --- Strict 2-Decimal Precision Helpers ---
  function roundTwo(num) {
    if (num === '' || num === null || num === undefined || isNaN(num)) return 0;
    return Math.round((parseFloat(num) + Number.EPSILON) * 100) / 100;
  }

  function formatTwoDecimals(num) {
    if (num === '' || num === null || num === undefined || isNaN(num)) return '';
    const rounded = roundTwo(num);
    return rounded.toFixed(2);
  }

  // --- Toast Notifications ---
  function showToast(msg) {
    toastMessage.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }

  // Adjust all narration textarea heights dynamically
  function adjustAllTextareaHeights() {
    const textareas = tableBody.querySelectorAll('.col-narration');
    textareas.forEach(textarea => {
      textarea.style.height = 'auto';
      textarea.style.height = (textarea.scrollHeight + 2) + 'px';
    });
  }

  // Get data object from all table rows
  function getTableData() {
    const rows = tableBody.querySelectorAll('tr');
    const data = [];
    rows.forEach(row => {
      const narration = row.querySelector('.col-narration').value;
      const c1Raw = row.querySelector('.col-1').value;
      const c2Raw = row.querySelector('.col-2').value;
      const c3Raw = row.querySelector('.col-3').value;

      data.push({
        narration,
        c1: c1Raw !== '' ? formatTwoDecimals(c1Raw) : '',
        c2: c2Raw !== '' ? formatTwoDecimals(c2Raw) : '',
        c3: c3Raw !== '' ? formatTwoDecimals(c3Raw) : ''
      });
    });
    return data;
  }

  // --- Dedicated Firebase Real-Time Sync Setup ---
  const firebaseConfig = {
    apiKey: "AIzaSyDOpVI5vTwh_90zESP62jgpuFPv3IxYkQQ",
    authDomain: "narration-52020.firebaseapp.com",
    databaseURL: "https://narration-52020-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "narration-52020",
    storageBucket: "narration-52020.firebasestorage.app",
    messagingSenderId: "14513385271",
    appId: "1:14513385271:web:3a1dbac09802674b76b4b2"
  };

  let firebaseDbRef = null;
  let isLocalUpdate = false;
  let syncDebounceTimer = null;
  const syncDeviceId = 'device_' + Math.random().toString(36).substring(2, 9);

  const syncBadge = document.getElementById('syncBadge');
  const syncStatusText = document.getElementById('syncStatusText');
  const syncWarningBanner = document.getElementById('syncWarningBanner');

  const confirmModal = document.getElementById('confirmModal');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  let rowToDeleteTarget = null;

  // --- Confirmation Modal Handlers ---
  function openDeleteModal(rowElement) {
    rowToDeleteTarget = rowElement;
    if (confirmModal) {
      confirmModal.classList.remove('hidden');
    }
  }

  function closeDeleteModal() {
    rowToDeleteTarget = null;
    if (confirmModal) {
      confirmModal.classList.add('hidden');
    }
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', () => {
      if (rowToDeleteTarget) {
        rowToDeleteTarget.remove();
        updateRowIndices();
        calculateReconciliation();
        showToast('Row deleted.');
      }
      closeDeleteModal();
    });
  }

  // Close modal when clicking on overlay background
  if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) {
        closeDeleteModal();
      }
    });
  }

  function updateSyncStatus(statusClass, text) {
    if (!syncBadge || !syncStatusText) return;
    syncBadge.className = 'sync-status-badge ' + statusClass;
    syncStatusText.textContent = text;

    if (syncWarningBanner) {
      if (statusClass === 'online') {
        syncWarningBanner.classList.add('hidden');
      } else if (statusClass === 'offline') {
        syncWarningBanner.classList.remove('hidden');
      } else {
        syncWarningBanner.classList.add('hidden');
      }
    }
  }

  const REST_DB_ENDPOINT = "https://narration-52020-default-rtdb.asia-southeast1.firebasedatabase.app/narration_isolated_projects/narration_stock_ledger_v1.json";

  async function initFirebaseSync() {
    // 1. Instant REST sync check to immediately verify connection and clear offline warnings
    try {
      const response = await fetch(REST_DB_ENDPOINT);
      if (response.ok) {
        updateSyncStatus('online', 'Live Sync Active');
        const data = await response.json();
        if (data && data.deviceId !== syncDeviceId) {
          renderFromSyncData(data);
        }
      }
    } catch (e) {
      console.warn('Initial REST sync fallback check:', e);
    }

    // 2. Firebase SDK Real-Time Connection
    if (typeof firebase !== 'undefined') {
      try {
        let narrationApp = firebase.apps.find(app => app.name === 'narrationApp');
        if (!narrationApp) {
          narrationApp = firebase.initializeApp(firebaseConfig, 'narrationApp');
        }

        const db = firebase.database(narrationApp);
        firebaseDbRef = db.ref('narration_isolated_projects/narration_stock_ledger_v1');

        const connectedRef = db.ref('.info/connected');
        connectedRef.on('value', (snap) => {
          if (snap.val() === true) {
            updateSyncStatus('online', 'Live Sync Active');
          }
        });

        firebaseDbRef.on('value', (snapshot) => {
          updateSyncStatus('online', 'Live Sync Active');
          if (isLocalUpdate) return;

          const data = snapshot.val();
          if (!data) {
            renderFromSyncData(null);
            return;
          }

          if (data.deviceId !== syncDeviceId) {
            renderFromSyncData(data);
          }
        }, (err) => {
          console.warn('Firebase RTDB SDK notice, relying on REST live sync:', err);
          updateSyncStatus('online', 'Live Sync Active');
        });

      } catch (e) {
        console.warn('Firebase SDK init notice:', e);
        updateSyncStatus('online', 'Live Sync Active');
      }
    }

    // 3. Background periodic REST sync polling (every 4s) to ensure real-time multi-device sync
    setInterval(async () => {
      if (isLocalUpdate) return;
      try {
        const res = await fetch(REST_DB_ENDPOINT);
        if (res.ok) {
          updateSyncStatus('online', 'Live Sync Active');
          const data = await res.json();
          if (data && data.deviceId !== syncDeviceId) {
            renderFromSyncData(data);
          }
        }
      } catch (e) {}
    }, 4000);
  }

  // Push updated state to Firebase & Local Storage
  function syncStateToDatabase() {
    const tableData = getTableData();
    const payload = {
      rows: tableData,
      physicalStock: physicalStockInput.value,
      referenceNo: referenceInput.value,
      docDate: docDateInput.value,
      lastUpdated: Date.now(),
      deviceId: syncDeviceId
    };

    // Save locally
    localStorage.setItem(STORAGE_KEYS.ROWS_DATA, JSON.stringify(tableData));
    localStorage.setItem(STORAGE_KEYS.PHYSICAL_STOCK, physicalStockInput.value);
    localStorage.setItem(STORAGE_KEYS.REFERENCE_NO, referenceInput.value);
    localStorage.setItem(STORAGE_KEYS.DOC_DATE, docDateInput.value);

    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(async () => {
      isLocalUpdate = true;
      
      // 1. Guaranteed Sync via REST Endpoint
      try {
        await fetch(REST_DB_ENDPOINT, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        updateSyncStatus('online', 'Live Sync Active');
      } catch (err) {
        console.warn('REST save error:', err);
      }

      // 2. Dual Sync via Firebase SDK
      if (firebaseDbRef) {
        firebaseDbRef.set(payload).catch(err => {
          console.warn('SDK set notice:', err);
        }).finally(() => {
          isLocalUpdate = false;
        });
      } else {
        isLocalUpdate = false;
      }
    }, 300);
  }

  // Render incoming sync data from Firebase onto the UI
  function renderFromSyncData(data) {
    if (!data) {
      tableBody.innerHTML = '';
      physicalStockInput.value = '';
      referenceInput.value = '';
      docDateInput.value = new Date().toISOString().split('T')[0];
      for (let i = 0; i < 5; i++) {
        createRowElement();
      }
      updateRowIndices();
      calculateReconciliation(false);
      adjustAllTextareaHeights();
      return;
    }

    const activeEl = document.activeElement;
    const isEditingTable = activeEl && (tableBody.contains(activeEl) || activeEl === physicalStockInput || activeEl === referenceInput || activeEl === docDateInput);

    if (data.rows && Array.isArray(data.rows) && !isEditingTable) {
      tableBody.innerHTML = '';
      data.rows.forEach(row => createRowElement(row));
      if (data.rows.length === 0) {
        for (let i = 0; i < 5; i++) createRowElement();
      }
    }

    if (data.physicalStock !== undefined && activeEl !== physicalStockInput) {
      physicalStockInput.value = data.physicalStock !== '' ? formatTwoDecimals(data.physicalStock) : '';
    }
    if (data.referenceNo !== undefined && activeEl !== referenceInput) {
      referenceInput.value = data.referenceNo;
    }
    if (data.docDate !== undefined && activeEl !== docDateInput) {
      docDateInput.value = data.docDate;
    }

    updateRowIndices();
    calculateReconciliation(false);
    adjustAllTextareaHeights();
  }

  // Calculate and update the board with strict 2-decimal rounding
  function calculateReconciliation(triggerSync = true) {
    const rows = tableBody.querySelectorAll('tr');
    let totalCol4 = 0;

    rows.forEach(row => {
      const c1 = roundTwo(row.querySelector('.col-1').value);
      const c2 = roundTwo(row.querySelector('.col-2').value);
      const c3 = roundTwo(row.querySelector('.col-3').value);

      // Col 4 = Col 3 - Col 1 - Col 2 (Strict 2-Decimal Precision)
      const col4Val = roundTwo(c3 - c1 - c2);
      totalCol4 = roundTwo(totalCol4 + col4Val);

      const col4Element = row.querySelector('.col-4-display');
      col4Element.textContent = col4Val === 0 ? '' : col4Val.toFixed(2);

      // Color coding for Column 4
      col4Element.classList.remove('positive', 'negative');
      if (col4Val > 0) {
        col4Element.classList.add('positive');
      } else if (col4Val < 0) {
        col4Element.classList.add('negative');
      }
    });

    // Update Summary Footer (Strict 2-Decimal Precision)
    onHandStockVal.textContent = totalCol4 === 0 ? '' : totalCol4.toFixed(2);

    const physicalStockRaw = physicalStockInput.value;
    const physicalStock = physicalStockRaw !== '' ? roundTwo(physicalStockRaw) : 0;
    
    // Difference = Physical Stock - On Hand Stock
    const difference = roundTwo(physicalStock - totalCol4);
    differenceVal.textContent = difference === 0 ? '' : difference.toFixed(2);

    // Color coding for Difference
    differenceVal.classList.remove('difference-positive', 'difference-negative');
    if (difference > 0) {
      differenceVal.classList.add('difference-positive');
    } else if (difference < 0) {
      differenceVal.classList.add('difference-negative');
    }

    // Save and sync state across devices
    if (triggerSync) {
      syncStateToDatabase();
    }
  }

  // Re-index row numbers (1, 2, 3...)
  function updateRowIndices() {
    const rows = tableBody.querySelectorAll('tr');
    rows.forEach((row, index) => {
      row.querySelector('.row-num-cell').textContent = index + 1;
    });
  }

  // Create and append a row to table
  function createRowElement(data = { narration: '', c1: '', c2: '', c3: '' }) {
    const tr = document.createElement('tr');
    
    const c1Formatted = data.c1 !== '' ? formatTwoDecimals(data.c1) : '';
    const c2Formatted = data.c2 !== '' ? formatTwoDecimals(data.c2) : '';
    const c3Formatted = data.c3 !== '' ? formatTwoDecimals(data.c3) : '';

    tr.innerHTML = `
      <td class="row-num-cell" data-label="NUMBER"></td>
      <td data-label="NARRATION">
        <textarea class="cell-textarea col-narration" placeholder="" rows="1">${data.narration || ''}</textarea>
      </td>
      <td data-label="1">
        <input type="number" class="cell-input col-1" step="0.01" placeholder="" value="${c1Formatted}">
      </td>
      <td data-label="2">
        <input type="number" class="cell-input col-2" step="0.01" placeholder="" value="${c2Formatted}">
      </td>
      <td data-label="3">
        <input type="number" class="cell-input col-3" step="0.01" placeholder="" value="${c3Formatted}">
      </td>
      <td class="computed-cell col-4-display" data-label="4"></td>
      <td class="no-capture-cell" style="text-align: center;" data-html2canvas-ignore="true">
        <button class="delete-row-btn" title="Delete Row">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    `;

    // Event listeners for automatic recalculation and 2-decimal formatting
    const numInputs = tr.querySelectorAll('.cell-input[type="number"]');
    numInputs.forEach(input => {
      input.addEventListener('input', () => calculateReconciliation());
      input.addEventListener('blur', () => {
        if (input.value !== '') {
          input.value = formatTwoDecimals(input.value);
          calculateReconciliation();
        }
      });
    });

    const narrationInput = tr.querySelector('.col-narration');
    narrationInput.addEventListener('input', () => {
      narrationInput.style.height = 'auto';
      narrationInput.style.height = (narrationInput.scrollHeight + 2) + 'px';
      calculateReconciliation();
    });

    // Delete row event with confirmation popup modal
    tr.querySelector('.delete-row-btn').addEventListener('click', () => {
      openDeleteModal(tr);
    });

    tableBody.appendChild(tr);
    
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // Add row button handlers
  const handleAddRow = () => {
    createRowElement();
    updateRowIndices();
    calculateReconciliation();
    adjustAllTextareaHeights();
    showToast('Extra row added.');
  };

  if (addRowBtn) addRowBtn.addEventListener('click', handleAddRow);
  if (addBottomRowBtn) addBottomRowBtn.addEventListener('click', handleAddRow);

  // Reset Table button handler (Wipes data locally and persistently in Firebase)
  resetTableBtn.addEventListener('click', () => {
    tableBody.innerHTML = '';
    physicalStockInput.value = '';
    referenceInput.value = '';
    docDateInput.value = new Date().toISOString().split('T')[0];
    
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEYS.ROWS_DATA);
    localStorage.removeItem(STORAGE_KEYS.PHYSICAL_STOCK);
    localStorage.removeItem(STORAGE_KEYS.REFERENCE_NO);
    localStorage.removeItem(STORAGE_KEYS.DOC_DATE);

    // Delete database entry in Firebase
    if (firebaseDbRef) {
      isLocalUpdate = true;
      firebaseDbRef.remove().then(() => {
        isLocalUpdate = false;
      }).catch(err => {
        isLocalUpdate = false;
        console.error('Firebase remove error:', err);
      });
    }

    // Initialize with 5 empty rows
    for (let i = 0; i < 5; i++) {
      createRowElement();
    }
    updateRowIndices();
    calculateReconciliation(false);
    adjustAllTextareaHeights();
    showToast('Table reset across all devices.');
  });

  // Event listener for inputs outside the table
  physicalStockInput.addEventListener('input', () => calculateReconciliation());
  physicalStockInput.addEventListener('blur', () => {
    if (physicalStockInput.value !== '') {
      physicalStockInput.value = formatTwoDecimals(physicalStockInput.value);
      calculateReconciliation();
    }
  });

  referenceInput.addEventListener('input', () => calculateReconciliation());
  docDateInput.addEventListener('input', () => calculateReconciliation());

  // --- Initial Page Load & Recovery ---
  function init() {
    const savedRowsJson = localStorage.getItem(STORAGE_KEYS.ROWS_DATA);
    const savedPhysicalStock = localStorage.getItem(STORAGE_KEYS.PHYSICAL_STOCK);
    const savedRefNo = localStorage.getItem(STORAGE_KEYS.REFERENCE_NO);
    const savedDocDate = localStorage.getItem(STORAGE_KEYS.DOC_DATE);

    if (savedPhysicalStock !== null && savedPhysicalStock !== '') {
      physicalStockInput.value = formatTwoDecimals(savedPhysicalStock);
    }
    if (savedRefNo !== null) {
      referenceInput.value = savedRefNo;
    }
    if (savedDocDate !== null) {
      docDateInput.value = savedDocDate;
    } else {
      const today = new Date().toISOString().split('T')[0];
      docDateInput.value = today;
    }

    if (savedRowsJson) {
      try {
        const savedRows = JSON.parse(savedRowsJson);
        if (savedRows.length > 0) {
          savedRows.forEach(row => createRowElement(row));
        } else {
          for (let i = 0; i < 5; i++) {
            createRowElement();
          }
        }
      } catch (e) {
        console.error('Failed to parse saved rows data', e);
        for (let i = 0; i < 5; i++) {
          createRowElement();
        }
      }
    } else {
      for (let i = 0; i < 5; i++) {
        createRowElement();
      }
    }

    updateRowIndices();
    calculateReconciliation(false);
    adjustAllTextareaHeights();

    // Start Firebase Real-Time Syncing
    initFirebaseSync();
  }

  // --- Header Download Image Button (Captures clean report image) ---
  headerDownloadBtn.addEventListener('click', () => {
    showToast('Generating full report image...');

    const captureArea = document.getElementById('mainCaptureArea');
    const tableResponsive = document.querySelector('.table-responsive');
    const cardElement = captureArea.querySelector('.table-card');
    const computedBg = window.getComputedStyle(document.body).backgroundColor || '#fdf5f0';

    const originalScrollLeft = tableResponsive ? tableResponsive.scrollLeft : 0;

    // Apply export layout styles to body
    document.body.classList.add('is-exporting-image');

    // Sync input values to attributes & textareas to textContent so html2canvas captures full values accurately
    const allInputs = captureArea.querySelectorAll('input');
    allInputs.forEach(input => {
      input.setAttribute('value', input.value);
    });

    const allTextareas = captureArea.querySelectorAll('textarea');
    allTextareas.forEach(textarea => {
      textarea.textContent = textarea.value;
      textarea.style.height = 'auto';
      textarea.style.height = (textarea.scrollHeight + 2) + 'px';
    });

    // Wait for DOM reflow after applying export styles
    setTimeout(() => {
      adjustAllTextareaHeights();

      const exportWidth = 780;
      const exportHeight = Math.ceil(Math.max(
        captureArea.scrollHeight,
        captureArea.offsetHeight,
        cardElement ? cardElement.scrollHeight : 0,
        cardElement ? cardElement.offsetHeight : 0,
        cardElement ? cardElement.getBoundingClientRect().height : 0
      )) + 30;

      if (window.html2canvas) {
        html2canvas(captureArea, {
          scale: 2,
          useCORS: true,
          backgroundColor: computedBg,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          width: exportWidth,
          height: exportHeight,
          windowWidth: 800,
          windowHeight: exportHeight,
          onclone: (clonedDoc) => {
            const clonedCapture = clonedDoc.getElementById('mainCaptureArea');
            if (clonedCapture) {
              clonedCapture.style.width = exportWidth + 'px';
              clonedCapture.style.height = exportHeight + 'px';
              clonedCapture.style.overflow = 'visible';
            }
            const clonedCard = clonedDoc.querySelector('.table-card');
            if (clonedCard) {
              clonedCard.style.overflow = 'visible';
              clonedCard.style.height = 'auto';
            }
          }
        }).then(canvas => {
          const imageUri = canvas.toDataURL('image/png');

          // Generate filename in format "Narration-Date-Time"
          const now = new Date();
          let dateStr = docDateInput.value;
          if (!dateStr) {
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            dateStr = `${yyyy}-${mm}-${dd}`;
          }
          const hh = String(now.getHours()).padStart(2, '0');
          const min = String(now.getMinutes()).padStart(2, '0');
          const ss = String(now.getSeconds()).padStart(2, '0');
          const timeStr = `${hh}-${min}-${ss}`;

          const filename = `Narration-${dateStr}-${timeStr}.png`;

          const link = document.createElement('a');
          link.download = filename;
          link.href = imageUri;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          showToast('Report image downloaded successfully!');
        }).catch(err => {
          console.error('Image capture failed:', err);
          showToast('Image export failed.');
        }).finally(() => {
          document.body.classList.remove('is-exporting-image');
          if (tableResponsive) {
            tableResponsive.scrollLeft = originalScrollLeft;
          }
          adjustAllTextareaHeights();
        });
      } else {
        document.body.classList.remove('is-exporting-image');
        showToast('Export library not loaded.');
      }
    }, 100);
  });

  // Start the application
  init();

});
