document.addEventListener('DOMContentLoaded', () => {

  // --- Strict Exact Precision Helpers (Group A: Tabs 1 to 5 + Dynamic Group A) ---
  function cleanFloat(num) {
    if (num === '' || num === null || num === undefined || isNaN(num)) return 0;
    const n = parseFloat(num);
    if (isNaN(n)) return 0;
    return parseFloat(n.toPrecision(14));
  }

  function formatExact(num) {
    if (num === '' || num === null || num === undefined || isNaN(num)) return '';
    const cleaned = cleanFloat(num);
    return String(cleaned);
  }

  // --- Strict 2-Decimal Precision Helpers (Groups B & C) ---
  function roundTwo(num) {
    if (num === '' || num === null || num === undefined || isNaN(num)) return 0;
    return Math.round((parseFloat(num) + Number.EPSILON) * 100) / 100;
  }

  function formatTwoDecimals(num) {
    if (num === '' || num === null || num === undefined || isNaN(num)) return '';
    const rounded = roundTwo(num);
    return rounded.toFixed(2);
  }

  function parseSafeNum(val) {
    if (val === '' || val === null || val === undefined || isNaN(val)) return 0;
    return roundTwo(val);
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isValidTabKey(key) {
    if (typeof key !== 'string' || !key) return false;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return false;
    return /^tab[a-zA-Z0-9_-]+$/i.test(key);
  }

  // --- Default Initial Tab Configurations & Definitions ---
  // Group A: Tabs 1 to 5 (Metal / Loss Calculation - Exact Decimal Precision)
  // Group B: Tabs 6 to 8 (Order & Weight Tracking - 2-Decimal Precision)
  // Group C: Tabs 9 & 10 (DROM / Deduction - 2-Decimal Precision)
  const DEFAULT_TABS_CONFIG = [
    { id: 'tab1', num: 1, group: 'A', defaultName: 'Tab 1' },
    { id: 'tab2', num: 2, group: 'A', defaultName: 'Tab 2' },
    { id: 'tab3', num: 3, group: 'A', defaultName: 'Tab 3' },
    { id: 'tab4', num: 4, group: 'A', defaultName: 'Tab 4' },
    { id: 'tab5', num: 5, group: 'A', defaultName: 'Tab 5' },
    { id: 'tab6', num: 6, group: 'B', defaultName: 'Tab 6' },
    { id: 'tab7', num: 7, group: 'B', defaultName: 'Tab 7' },
    { id: 'tab8', num: 8, group: 'B', defaultName: 'Tab 8' },
    { id: 'tab9', num: 9, group: 'C', defaultName: 'DROM' },
    { id: 'tab10', num: 10, group: 'C', defaultName: 'Tab 10' },
  ];

  // Dynamic Tabs Registry
  let tabsConfig = JSON.parse(JSON.stringify(DEFAULT_TABS_CONFIG));

  // Storage Keys
  const STORAGE_KEYS = {
    TABS_CONFIG: 'narration_tabs_config_v9',
    ROWS_DATA: 'narration_reconciliation_rows_v9',
    PHYSICAL_STOCK: 'narration_physical_stock_v9',
    REFERENCE_NO: 'narration_reference_no_v9',
    DOC_DATE: 'narration_doc_date_v9',
    TABS_META: 'narration_tabs_meta_v9',
    TABS_DATA: 'narration_tabs_data_v9',
    // Fallback legacy keys
    LEGACY_ROWS_V8: 'narration_reconciliation_rows_v8',
    LEGACY_META_V8: 'narration_tabs_meta_v8',
    LEGACY_DATA_V8: 'narration_tabs_data_v8',
    LEGACY_STOCK_V8: 'narration_physical_stock_v8',
    LEGACY_REF_V8: 'narration_reference_no_v8',
    LEGACY_DATE_V8: 'narration_doc_date_v8',
    LEGACY_ROWS_V7: 'narration_reconciliation_rows_v7'
  };

  // --- Global Application State ---
  let currentView = 'narration'; // 'narration' or sub-tab ID

  const state = {
    narration: {
      physicalStock: '',
      referenceNo: '',
      docDate: new Date().toISOString().split('T')[0],
      rows11Plus: [] // Manual rows after reserved tab rows
    },
    tabsConfig: tabsConfig,
    tabsMeta: Object.create(null), // { [tabId]: { name: string, date: string, group: string } }
    tabsData: Object.create(null)  // { [tabId]: [ { col1, col2, col3, col4 } ] }
  };

  // Initialize Default Tab State
  function initDefaultTabsState() {
    tabsConfig.forEach(cfg => {
      if (!isValidTabKey(cfg.id)) return;
      if (!state.tabsMeta[cfg.id]) {
        state.tabsMeta[cfg.id] = {
          name: cfg.defaultName,
          date: new Date().toISOString().split('T')[0],
          group: cfg.group
        };
      }
      if (!state.tabsData[cfg.id]) {
        state.tabsData[cfg.id] = [
          { col1: '', col2: '', col3: '', col4: '' },
          { col1: '', col2: '', col3: '', col4: '' },
          { col1: '', col2: '', col3: '', col4: '' }
        ];
      }
    });
  }
  initDefaultTabsState();

  // --- DOM Elements ---
  // Narration View Elements
  const narrationView = document.getElementById('narrationView');
  const tableBody = document.getElementById('tableBody');
  const addRowBtn = document.getElementById('addRowBtn');
  const addBottomRowBtn = document.getElementById('addBottomRowBtn');
  const resetTableBtn = document.getElementById('resetTableBtn');
  const onHandStockVal = document.getElementById('onHandStockVal');
  const physicalStockInput = document.getElementById('physicalStockInput');
  const differenceVal = document.getElementById('differenceVal');
  const referenceInput = document.getElementById('referenceInput');
  const docDateInput = document.getElementById('docDateInput');

  // Subtab View Elements
  const subTabContentArea = document.getElementById('subTabContentArea');
  const subTabBackBtn = document.getElementById('subTabBackBtn');
  const subTabTitleDisplay = document.getElementById('subTabTitleDisplay');
  const subTabGroupBadge = document.getElementById('subTabGroupBadge');
  const editTabNameBtn = document.getElementById('editTabNameBtn');
  const subTabTitleInput = document.getElementById('subTabTitleInput');
  const subTabDateInput = document.getElementById('subTabDateInput');
  const subTabAddRowBtn = document.getElementById('subTabAddRowBtn');
  const subTabBottomAddRowBtn = document.getElementById('subTabBottomAddRowBtn');
  const subTabResetBtn = document.getElementById('subTabResetBtn');
  const subTabDeleteTabBtn = document.getElementById('subTabDeleteTabBtn');
  const subTabMetricsArea = document.getElementById('subTabMetricsArea');
  const subTabTableHead = document.getElementById('subTabTableHead');
  const subTabTableBody = document.getElementById('subTabTableBody');
  const subTabTableFoot = document.getElementById('subTabTableFoot');

  // Left Sidebar Tab Navigation
  const leftSidebarTabs = document.getElementById('leftSidebarTabs') || document.getElementById('rightSidebarTabs');
  const sidebarTabsList = document.getElementById('sidebarTabsList');
  const mobileSidebarToggleBtn = document.getElementById('mobileSidebarToggleBtn');

  // Shared Components
  const headerDownloadBtn = document.getElementById('headerDownloadBtn');
  const syncBadge = document.getElementById('syncBadge');
  const syncStatusText = document.getElementById('syncStatusText');
  const syncWarningBanner = document.getElementById('syncWarningBanner');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');

  // Confirm Modal Elements
  const confirmModal = document.getElementById('confirmModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalMessageText = document.getElementById('modalMessageText');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const confirmModalBtn = document.getElementById('confirmModalBtn');
  let modalConfirmCallback = null;

  // --- Lucide Icons Refresh Helper ---
  function refreshIcons(container = document) {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: container });
    }
  }

  // --- Toast System ---
  function showToast(msg) {
    if (!toast || !toastMessage) return;
    toastMessage.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }

  // --- Modal Helpers ---
  function showConfirmModal(title, message, onConfirm) {
    if (!confirmModal) return;
    modalTitle.textContent = title;
    modalMessageText.textContent = message;
    modalConfirmCallback = onConfirm;
    confirmModal.classList.remove('hidden');
  }

  function hideConfirmModal() {
    if (!confirmModal) return;
    confirmModal.classList.add('hidden');
    modalConfirmCallback = null;
  }

  if (cancelModalBtn) cancelModalBtn.addEventListener('click', hideConfirmModal);
  if (confirmModalBtn) {
    confirmModalBtn.addEventListener('click', () => {
      if (typeof modalConfirmCallback === 'function') {
        modalConfirmCallback();
      }
      hideConfirmModal();
    });
  }
  if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) hideConfirmModal();
    });
  }

  // Helper to determine next logical tab number
  function getNextSequentialTabNumber() {
    let highestNum = 0;
    tabsConfig.forEach(t => {
      if (t.num && t.num > highestNum) highestNum = t.num;
      const match = (state.tabsMeta[t.id]?.name || t.defaultName || '').match(/Tab\s*(\d+)/i);
      if (match && parseInt(match[1], 10) > highestNum) {
        highestNum = parseInt(match[1], 10);
      }
    });
    return Math.max(highestNum + 1, tabsConfig.length + 1);
  }

  // --- Dynamic Tab Creation Engine ---
  function createDynamicTab(group = 'A', customName = '') {
    const validGroup = (group === 'B' || group === 'C') ? group : 'A';
    const nextNum = getNextSequentialTabNumber();
    const newId = `tab_${validGroup.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const finalName = customName.trim() || `Tab ${nextNum}`;

    const newTabCfg = {
      id: newId,
      num: tabsConfig.length + 1,
      group: validGroup,
      defaultName: finalName
    };

    tabsConfig.push(newTabCfg);
    state.tabsConfig = tabsConfig;

    // Initialize Tab Metadata
    state.tabsMeta[newId] = {
      name: finalName,
      date: new Date().toISOString().split('T')[0],
      group: validGroup
    };

    // Initialize 3 standard empty rows
    state.tabsData[newId] = [
      { col1: '', col2: '', col3: '', col4: '' },
      { col1: '', col2: '', col3: '', col4: '' },
      { col1: '', col2: '', col3: '', col4: '' }
    ];

    // Invalidate sub-tab cache
    invalidateSubTab(newId);

    // Rebuild Narration reserved rows & Sidebar
    buildReservedRows();
    buildSidebar();
    updateRowIndices();
    calculateReconciliation(true);
    flushPendingSync();

    // Switch view to the new tab
    switchView(newId);
    showToast(`Added "${finalName}" to Group ${validGroup}`);

    return newTabCfg;
  }

  // --- Dynamic Tab Deletion Engine ---
  function deleteDynamicTab(tabId) {
    const tabCfg = tabsConfig.find(t => t.id === tabId);
    if (!tabCfg) return;

    const tabName = state.tabsMeta[tabId]?.name || tabCfg.defaultName;

    showConfirmModal(
      `Delete Tab "${tabName}"?`,
      `Are you sure you want to delete "${tabName}" (Group ${tabCfg.group}) and all its items? This will remove its linked row from the Narration table.`,
      () => {
        // Remove from dynamic tabs registry
        tabsConfig = tabsConfig.filter(t => t.id !== tabId);
        // Re-index tab numbers
        tabsConfig.forEach((t, idx) => { t.num = idx + 1; });
        state.tabsConfig = tabsConfig;

        // Clean up metadata & data
        delete state.tabsMeta[tabId];
        delete state.tabsData[tabId];
        delete subTabCache[tabId];
        dirtyTabs.delete(tabId);

        // Rebuild Narration reserved rows & sidebar
        buildReservedRows();
        buildSidebar();
        updateRowIndices();
        calculateReconciliation(true);
        flushPendingSync();

        // Switch to narration if deleted tab was active
        if (currentView === tabId) {
          switchView('narration');
        }

        showToast(`Tab "${tabName}" deleted.`);
      }
    );
  }

  // Subtab Delete Tab Button Listener
  if (subTabDeleteTabBtn) {
    subTabDeleteTabBtn.addEventListener('click', () => {
      if (currentView.startsWith('tab')) {
        deleteDynamicTab(currentView);
      }
    });
  }

  // --- Auto-size Narration Textareas (Performance Optimized) ---
  let textareaResizeScheduled = false;
  function adjustAllTextareaHeights() {
    if (textareaResizeScheduled) return;
    textareaResizeScheduled = true;
    requestAnimationFrame(() => {
      const textareas = document.querySelectorAll('.col-narration, .subtab-col-1');
      textareas.forEach(textarea => {
        const currentHeight = textarea.offsetHeight;
        textarea.style.height = 'auto';
        const targetHeight = textarea.scrollHeight + 2;
        if (Math.abs(currentHeight - targetHeight) > 1) {
          textarea.style.height = targetHeight + 'px';
        } else {
          textarea.style.height = currentHeight + 'px';
        }
      });
      textareaResizeScheduled = false;
    });
  }

  // --- Memoization & Caching for Subtab Calculations ---
  const subTabCache = {};
  const dirtyTabs = new Set();

  function invalidateSubTab(tabId) {
    if (tabId) {
      dirtyTabs.add(tabId);
    } else {
      tabsConfig.forEach(t => dirtyTabs.add(t.id));
    }
  }

  /**
   * Calculates sub-tab metrics with caching/memoization.
   * If the tab has no numeric data entered, narrationOutput is '' (blank).
   */
  function calculateSubTab(tabId) {
    if (!dirtyTabs.has(tabId) && subTabCache[tabId]) {
      return subTabCache[tabId];
    }

    const cfg = tabsConfig.find(t => t.id === tabId);
    if (!cfg) return { hasData: false, narrationOutput: '' };

    const rows = state.tabsData[tabId] || [];
    let result = { hasData: false, narrationOutput: '' };

    if (cfg.group === 'A') {
      // Group A: Metal / Loss Calculation - Exact Decimal Precision
      let totalCol2 = 0;
      let totalCol3 = 0;
      let totalCol4 = 0;
      let hasNumericEntry = false;

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.col2 !== '' && r.col2 !== null && r.col2 !== undefined && !isNaN(r.col2)) {
          totalCol2 = cleanFloat(totalCol2 + parseFloat(r.col2));
          hasNumericEntry = true;
        }
        if (r.col3 !== '' && r.col3 !== null && r.col3 !== undefined && !isNaN(r.col3)) {
          totalCol3 = cleanFloat(totalCol3 + parseFloat(r.col3));
          hasNumericEntry = true;
        }
        if (r.col4 !== '' && r.col4 !== null && r.col4 !== undefined && !isNaN(r.col4)) {
          totalCol4 = cleanFloat(totalCol4 + parseFloat(r.col4));
          hasNumericEntry = true;
        }
      }

      const recd = cleanFloat(totalCol2 + totalCol3);
      const netLoss = cleanFloat(recd - totalCol4);

      result = {
        hasData: hasNumericEntry,
        totalCol2,
        totalCol3,
        recd,
        totalCol4,
        netLoss,
        narrationOutput: hasNumericEntry ? formatExact(netLoss) : ''
      };

    } else if (cfg.group === 'B') {
      // Group B: Order & Weight Tracking - 2-Decimal Precision
      let totalCol2 = 0;
      let hasNumericEntry = false;

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.col2 !== '' && !isNaN(r.col2)) {
          totalCol2 = roundTwo(totalCol2 + parseSafeNum(r.col2));
          hasNumericEntry = true;
        }
      }

      result = {
        hasData: hasNumericEntry,
        totalCol2,
        narrationOutput: hasNumericEntry ? formatTwoDecimals(totalCol2) : ''
      };

    } else if (cfg.group === 'C') {
      // Group C: DROM / Deduction - 2-Decimal Precision
      let totalCol2 = 0;
      let totalCol3 = 0;
      let totalDiff = 0;
      let hasNumericEntry = false;

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const valA = r.col2 !== '' && !isNaN(r.col2) ? parseSafeNum(r.col2) : null;
        const valB = r.col3 !== '' && !isNaN(r.col3) ? parseSafeNum(r.col3) : null;

        if (valA !== null || valB !== null) {
          hasNumericEntry = true;
          const a = valA !== null ? valA : 0;
          const b = valB !== null ? valB : 0;
          totalCol2 = roundTwo(totalCol2 + a);
          totalCol3 = roundTwo(totalCol3 + b);
          totalDiff = roundTwo(totalDiff + (a - b));
        }
      }

      result = {
        hasData: hasNumericEntry,
        totalCol2,
        totalCol3,
        totalDiff,
        narrationOutput: hasNumericEntry ? formatTwoDecimals(totalDiff) : ''
      };
    }

    subTabCache[tabId] = result;
    dirtyTabs.delete(tabId);
    return result;
  }

  // --- Narration Table Reconciliation Calculations (Dynamic All Tabs) ---
  function calculateReconciliation(triggerSync = true) {
    let totalCol4 = 0;

    // All Dynamic Reserved Sub-Tab Rows
    tabsConfig.forEach((cfg, index) => {
      const tabId = cfg.id;
      const subResult = calculateSubTab(tabId);
      const rowEl = tableBody.querySelector(`tr[data-reserved-row="${index + 1}"]`);

      if (rowEl) {
        const col4Element = rowEl.querySelector('.col-4-display');
        const narrationTextarea = rowEl.querySelector('.col-narration');

        // Sync tab title if not actively focused
        if (document.activeElement !== narrationTextarea && narrationTextarea) {
          const expectedName = state.tabsMeta[tabId]?.name || cfg.defaultName;
          if (narrationTextarea.value !== expectedName) {
            narrationTextarea.value = expectedName;
          }
        }

        // Sub-tab output into Column 4
        if (subResult.hasData && subResult.narrationOutput !== '') {
          const valNum = parseFloat(subResult.narrationOutput);
          const formatted = (cfg.group === 'A') ? formatExact(subResult.narrationOutput) : formatTwoDecimals(valNum);
          if (col4Element.textContent !== formatted) {
            col4Element.textContent = formatted;
          }
          totalCol4 = cleanFloat(totalCol4 + valNum);

          col4Element.classList.remove('positive', 'negative');
          if (valNum > 0) col4Element.classList.add('positive');
          else if (valNum < 0) col4Element.classList.add('negative');
        } else {
          if (col4Element.textContent !== '') col4Element.textContent = '';
          col4Element.classList.remove('positive', 'negative');
        }
      }
    });

    // Rows after reserved tab rows (Manual rows)
    const manualRows = tableBody.querySelectorAll('tr:not([data-reserved-row])');
    manualRows.forEach(row => {
      const c1Input = row.querySelector('.col-1');
      const c2Input = row.querySelector('.col-2');
      const c3Input = row.querySelector('.col-3');
      const col4Element = row.querySelector('.col-4-display');

      const c1 = roundTwo(c1Input?.value);
      const c2 = roundTwo(c2Input?.value);
      const c3 = roundTwo(c3Input?.value);

      const hasValues = (c1Input?.value !== '' || c2Input?.value !== '' || c3Input?.value !== '');
      if (hasValues) {
        // Col 4 = Col 3 - Col 1 - Col 2
        const col4Val = roundTwo(c3 - c1 - c2);
        totalCol4 = roundTwo(totalCol4 + col4Val);
        const formatted = formatTwoDecimals(col4Val);
        if (col4Element.textContent !== formatted) {
          col4Element.textContent = formatted;
        }

        col4Element.classList.remove('positive', 'negative');
        if (col4Val > 0) col4Element.classList.add('positive');
        else if (col4Val < 0) col4Element.classList.add('negative');
      } else {
        if (col4Element.textContent !== '') col4Element.textContent = '';
        col4Element.classList.remove('positive', 'negative');
      }
    });

    // Update Narration Summary Footer
    if (onHandStockVal) {
      const onHandFormatted = totalCol4 === 0 ? '' : formatTwoDecimals(totalCol4);
      if (onHandStockVal.textContent !== onHandFormatted) {
        onHandStockVal.textContent = onHandFormatted;
      }
    }

    const physicalStockRaw = physicalStockInput.value;
    const physicalStock = physicalStockRaw !== '' ? roundTwo(physicalStockRaw) : 0;
    const difference = roundTwo(physicalStock - totalCol4);

    if (differenceVal) {
      const diffFormatted = (physicalStockRaw === '' && totalCol4 === 0) ? '' : formatTwoDecimals(difference);
      if (differenceVal.textContent !== diffFormatted) {
        differenceVal.textContent = diffFormatted;
      }
      differenceVal.classList.remove('difference-positive', 'difference-negative');
      if (difference > 0) differenceVal.classList.add('difference-positive');
      else if (difference < 0) differenceVal.classList.add('difference-negative');
    }

    // Update sidebar in-place without destroying DOM buttons
    updateSidebarValues();

    // Trigger local and cloud sync
    if (triggerSync) {
      saveStateAndSync();
    }
  }

  // --- Narration Table DOM Builders ---

  // Build all Reserved Rows in Narration Table for all configured sub-tabs
  function buildReservedRows() {
    // Collect existing manual rows before rebuilding
    const manualRowsData = [];
    const manualRowEls = tableBody.querySelectorAll('tr:not([data-reserved-row])');
    manualRowEls.forEach(row => {
      const narration = row.querySelector('.col-narration')?.value || '';
      const c1Raw = row.querySelector('.col-1')?.value || '';
      const c2Raw = row.querySelector('.col-2')?.value || '';
      const c3Raw = row.querySelector('.col-3')?.value || '';
      manualRowsData.push({
        narration,
        c1: c1Raw !== '' ? formatTwoDecimals(c1Raw) : '',
        c2: c2Raw !== '' ? formatTwoDecimals(c2Raw) : '',
        c3: c3Raw !== '' ? formatTwoDecimals(c3Raw) : ''
      });
    });

    tableBody.innerHTML = '';

    tabsConfig.forEach((cfg, index) => {
      const tabId = cfg.id;
      const rowNum = index + 1;
      const tabName = state.tabsMeta[tabId]?.name || cfg.defaultName;
      const safeTabName = escapeHtml(tabName);
      const safeDefaultName = escapeHtml(cfg.defaultName);
      const safeGroup = escapeHtml(cfg.group);
      const safeTabId = escapeHtml(tabId);

      const tr = document.createElement('tr');
      tr.setAttribute('data-reserved-row', String(rowNum));
      tr.setAttribute('data-tab-id', safeTabId);
      tr.className = 'reserved-tab-row';

      tr.innerHTML = `
        <td class="row-num-cell" data-label="NUMBER">${rowNum}</td>
        <td data-label="NARRATION" data-col-idx="1">
          <div class="reserved-narration-cell">
            <textarea class="cell-textarea col-narration" rows="1" placeholder="${safeDefaultName}...">${safeTabName}</textarea>
          </div>
        </td>
        <td data-label="1" data-col-idx="2">
          <input type="text" class="cell-input col-1 reserved-input" readonly tabindex="-1" value="—" title="Calculated in ${safeTabName} (Group ${safeGroup})">
        </td>
        <td data-label="2" data-col-idx="3">
          <input type="text" class="cell-input col-2 reserved-input" readonly tabindex="-1" value="—" title="Calculated in ${safeTabName} (Group ${safeGroup})">
        </td>
        <td data-label="3" data-col-idx="4">
          <input type="text" class="cell-input col-3 reserved-input" readonly tabindex="-1" value="—" title="Calculated in ${safeTabName} (Group ${safeGroup})">
        </td>
        <td class="computed-cell col-4-display reserved-col-4" data-label="4" data-col-idx="5" title="Direct input disabled. Auto-calculated from ${safeTabName}"></td>
        <td class="no-capture-cell" style="text-align: center;" data-html2canvas-ignore="true">
          <div class="row-actions-cell">
            <button class="delete-row-btn reserved-delete-btn" data-tab-id="${safeTabId}" title="Clear ${safeTabName} data">
              <i data-lucide="eraser"></i>
            </button>
            <button class="reserved-remove-btn" data-tab-id="${safeTabId}" title="Delete Tab ${safeTabName}">
              <i data-lucide="trash-2"></i>
            </button>
            <button class="reserved-jump-btn" data-jump-tab="${safeTabId}" title="Open ${safeTabName}">
              <i data-lucide="arrow-right"></i>
            </button>
          </div>
        </td>
      `;

      // Allow editing Narration column to rename the tab
      const narrationInput = tr.querySelector('.col-narration');
      narrationInput.addEventListener('input', () => {
        narrationInput.style.height = 'auto';
        narrationInput.style.height = (narrationInput.scrollHeight + 2) + 'px';
      });
      narrationInput.addEventListener('change', () => {
        const newName = narrationInput.value.trim() || cfg.defaultName;
        renameTab(tabId, newName);
      });

      // Jump button opens corresponding sub-tab
      tr.querySelector('.reserved-jump-btn').addEventListener('click', () => {
        switchView(tabId);
      });

      // Clear action button: resets that tab's data entries
      tr.querySelector('.reserved-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        state.tabsData[tabId] = [
          { col1: '', col2: '', col3: '', col4: '' },
          { col1: '', col2: '', col3: '', col4: '' },
          { col1: '', col2: '', col3: '', col4: '' }
        ];
        invalidateSubTab(tabId);
        calculateReconciliation(true);
        flushPendingSync();
        if (currentView === tabId) {
          renderActiveSubTabView();
        }
        showToast(`"${tabName}" data cleared.`);
      });

      // Delete Tab action button
      tr.querySelector('.reserved-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteDynamicTab(tabId);
      });

      tableBody.appendChild(tr);
    });

    // Rebuild manual rows
    manualRowsData.forEach(r => createManualRowElement(r));

    refreshIcons(tableBody);
  }

  // Build Manual Row (Row after reserved rows)
  function createManualRowElement(data = { narration: '', c1: '', c2: '', c3: '' }) {
    const tr = document.createElement('tr');
    tr.className = 'manual-row';

    const c1Formatted = data.c1 !== '' ? formatTwoDecimals(data.c1) : '';
    const c2Formatted = data.c2 !== '' ? formatTwoDecimals(data.c2) : '';
    const c3Formatted = data.c3 !== '' ? formatTwoDecimals(data.c3) : '';
    const safeNarration = escapeHtml(data.narration || '');

    tr.innerHTML = `
      <td class="row-num-cell" data-label="NUMBER"></td>
      <td data-label="NARRATION" data-col-idx="1">
        <textarea class="cell-textarea col-narration" placeholder="Enter narration..." rows="1">${safeNarration}</textarea>
      </td>
      <td data-label="1" data-col-idx="2">
        <input type="text" inputmode="decimal" class="cell-input col-1" placeholder="" value="${escapeHtml(c1Formatted)}">
      </td>
      <td data-label="2" data-col-idx="3">
        <input type="text" inputmode="decimal" class="cell-input col-2" placeholder="" value="${escapeHtml(c2Formatted)}">
      </td>
      <td data-label="3" data-col-idx="4">
        <input type="text" inputmode="decimal" class="cell-input col-3" placeholder="" value="${escapeHtml(c3Formatted)}">
      </td>
      <td class="computed-cell col-4-display" data-label="4" data-col-idx="5"></td>
      <td class="no-capture-cell" style="text-align: center;" data-html2canvas-ignore="true">
        <div class="row-actions-cell">
          <button class="delete-row-btn manual-delete-btn" title="Delete Row">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </td>
    `;

    // Event listeners
    const numInputs = tr.querySelectorAll('.cell-input.col-1, .cell-input.col-2, .cell-input.col-3');
    numInputs.forEach(input => {
      input.addEventListener('input', () => {
        input.value = input.value.replace(/[^0-9.-]/g, '');
        calculateReconciliation(true);
      });
      input.addEventListener('blur', () => {
        if (input.value !== '') {
          input.value = formatTwoDecimals(input.value);
          calculateReconciliation(true);
        }
        flushPendingSync();
      });
    });

    const narrationInput = tr.querySelector('.col-narration');
    narrationInput.addEventListener('input', () => {
      narrationInput.style.height = 'auto';
      narrationInput.style.height = (narrationInput.scrollHeight + 2) + 'px';
      saveStateAndSync();
    });
    narrationInput.addEventListener('blur', flushPendingSync);

    // Delete manual row directly
    tr.querySelector('.manual-delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      tr.remove();
      updateRowIndices();
      calculateReconciliation(true);
      flushPendingSync();
      showToast('Row deleted.');
    });

    tableBody.appendChild(tr);
    refreshIcons(tr);
  }

  // Re-index all row numbers
  function updateRowIndices() {
    const rows = tableBody.querySelectorAll('tr');
    rows.forEach((row, index) => {
      const numCell = row.querySelector('.row-num-cell');
      if (numCell) numCell.textContent = index + 1;
    });
  }

  // --- Sub-Tab View Rendering ---

  function renderActiveSubTabView() {
    if (!currentView.startsWith('tab')) return;

    const tabId = currentView;
    const cfg = tabsConfig.find(t => t.id === tabId);
    if (!cfg) {
      switchView('narration');
      return;
    }

    const meta = state.tabsMeta[tabId] || { name: cfg.defaultName, date: new Date().toISOString().split('T')[0], group: cfg.group };
    const rows = state.tabsData[tabId] || [];

    // Header Controls
    subTabTitleDisplay.textContent = meta.name;
    subTabTitleInput.value = meta.name;
    subTabDateInput.value = meta.date || new Date().toISOString().split('T')[0];

    // Group Badge
    if (subTabGroupBadge) {
      subTabGroupBadge.className = `subtab-group-badge badge-${cfg.group.toLowerCase()}`;
      subTabGroupBadge.textContent = `Group ${cfg.group}`;
    }

    // Calculate Sub-tab Metrics
    const subResult = calculateSubTab(tabId);

    // Render Metric Cards
    renderSubTabMetricCards(cfg, subResult);

    // Render Table Head
    renderSubTabTableHead(cfg);

    // Render Table Body
    renderSubTabTableBody(cfg, rows);

    // Render Table Foot
    renderSubTabTableFoot(cfg, subResult);

    refreshIcons();
    adjustAllTextareaHeights();
  }

  function renderSubTabMetricCards(cfg, subResult) {
    if (!subTabMetricsArea) return;

    if (subTabMetricsArea.getAttribute('data-tab-group') !== cfg.group) {
      subTabMetricsArea.setAttribute('data-tab-group', cfg.group);

      if (cfg.group === 'A') {
        subTabMetricsArea.innerHTML = `
          <div class="metric-card">
            <span class="metric-card-label">Gold Given</span>
            <span class="metric-card-val" id="metricGivenGoldVal">—</span>
          </div>
          <div class="metric-card">
            <span class="metric-card-label">REC'D (Col 2 + Col 3)</span>
            <span class="metric-card-val" id="metricRecdVal">—</span>
          </div>
          <div class="metric-card">
            <span class="metric-card-label">Col 4 Total</span>
            <span class="metric-card-val" id="metricCol4Val">—</span>
          </div>
          <div class="metric-card highlight loss-card">
            <span class="metric-card-label">Net Calculated Loss</span>
            <span class="metric-card-val" id="metricLossVal">—</span>
          </div>
        `;
      } else if (cfg.group === 'B') {
        subTabMetricsArea.innerHTML = `
          <div class="metric-card">
            <span class="metric-card-label">Total Item Entries</span>
            <span class="metric-card-val" id="metricItemEntriesVal">0</span>
          </div>
          <div class="metric-card highlight">
            <span class="metric-card-label">Total Col 2 (Amount / Value 1)</span>
            <span class="metric-card-val" id="metricTotalCol2Val">—</span>
          </div>
        `;
      } else if (cfg.group === 'C') {
        subTabMetricsArea.innerHTML = `
          <div class="metric-card">
            <span class="metric-card-label">Total Input Value A</span>
            <span class="metric-card-val" id="metricTotalAVal">—</span>
          </div>
          <div class="metric-card">
            <span class="metric-card-label">Total Input Value B</span>
            <span class="metric-card-val" id="metricTotalBVal">—</span>
          </div>
          <div class="metric-card highlight">
            <span class="metric-card-label">Total Net Difference</span>
            <span class="metric-card-val" id="metricNetDiffVal">—</span>
          </div>
        `;
      }
    }

    updateSubTabMetricValues(cfg, subResult);
  }

  function updateSubTabMetricValues(cfg, subResult) {
    if (cfg.group === 'A') {
      const given = document.getElementById('metricGivenGoldVal');
      const recd = document.getElementById('metricRecdVal');
      const col4 = document.getElementById('metricCol4Val');
      const loss = document.getElementById('metricLossVal');
      if (given) given.textContent = subResult.hasData ? formatExact(subResult.totalCol2) : '—';
      if (recd) recd.textContent = subResult.hasData ? formatExact(subResult.recd) : '—';
      if (col4) col4.textContent = subResult.hasData ? formatExact(subResult.totalCol4) : '—';
      if (loss) loss.textContent = subResult.hasData ? formatExact(subResult.netLoss) : '—';
    } else if (cfg.group === 'B') {
      const entries = document.getElementById('metricItemEntriesVal');
      const totalCol2 = document.getElementById('metricTotalCol2Val');
      if (entries) entries.textContent = state.tabsData[cfg.id]?.length || 0;
      if (totalCol2) totalCol2.textContent = subResult.hasData ? formatTwoDecimals(subResult.totalCol2) : '—';
    } else if (cfg.group === 'C') {
      const totalA = document.getElementById('metricTotalAVal');
      const totalB = document.getElementById('metricTotalBVal');
      const netDiff = document.getElementById('metricNetDiffVal');
      if (totalA) totalA.textContent = subResult.hasData ? formatTwoDecimals(subResult.totalCol2) : '—';
      if (totalB) totalB.textContent = subResult.hasData ? formatTwoDecimals(subResult.totalCol3) : '—';
      if (netDiff) netDiff.textContent = subResult.hasData ? formatTwoDecimals(subResult.totalDiff) : '—';
    }
  }

  function renderSubTabTableHead(cfg) {
    if (!subTabTableHead) return;
    if (subTabTableHead.getAttribute('data-tab-group') === cfg.group) return;
    subTabTableHead.setAttribute('data-tab-group', cfg.group);

    if (cfg.group === 'A') {
      subTabTableHead.innerHTML = `
        <tr>
          <th class="col-num-th">No.</th>
          <th class="col-narration-th" data-col-idx="1">Item Name</th>
          <th class="col-val-th" data-col-idx="2">2</th>
          <th class="col-val-th" data-col-idx="3">3</th>
          <th class="col-val-th" data-col-idx="4">4</th>
          <th class="col-action-th no-capture-cell" data-html2canvas-ignore="true">Action</th>
        </tr>
      `;
    } else if (cfg.group === 'B') {
      subTabTableHead.innerHTML = `
        <tr>
          <th class="col-num-th">No.</th>
          <th class="col-narration-th" data-col-idx="1">Order / Item Name</th>
          <th class="col-val-th" data-col-idx="2">Amount / Value 1</th>
          <th class="col-val-th" data-col-idx="3">Value 2 (Ref)</th>
          <th class="col-val-th" data-col-idx="4">Value 3 (Ref)</th>
          <th class="col-action-th no-capture-cell" data-html2canvas-ignore="true">Action</th>
        </tr>
      `;
    } else if (cfg.group === 'C') {
      subTabTableHead.innerHTML = `
        <tr>
          <th class="col-num-th">No.</th>
          <th class="col-narration-th" data-col-idx="1">DROM / Item Name</th>
          <th class="col-val-th" data-col-idx="2">Input Value A</th>
          <th class="col-val-th" data-col-idx="3">Input Value B</th>
          <th class="col-val-th" data-col-idx="4">Difference</th>
          <th class="col-action-th no-capture-cell" data-html2canvas-ignore="true">Action</th>
        </tr>
      `;
    }
  }

  function renderSubTabTableBody(cfg, rows) {
    if (!subTabTableBody) return;
    subTabTableBody.innerHTML = '';

    rows.forEach((r, idx) => {
      const tr = document.createElement('tr');
      const safeCol1 = escapeHtml(r.col1 || '');

      if (cfg.group === 'A') {
        const col2Val = r.col2 !== '' && r.col2 !== undefined && r.col2 !== null ? r.col2 : '';
        const col3Val = r.col3 !== '' && r.col3 !== undefined && r.col3 !== null ? r.col3 : '';
        const col4Val = r.col4 !== '' && r.col4 !== undefined && r.col4 !== null ? r.col4 : '';

        tr.innerHTML = `
          <td class="row-num-cell">${idx + 1}</td>
          <td data-col-idx="1">
            <textarea class="cell-textarea subtab-col-1" rows="1" placeholder="Item description...">${safeCol1}</textarea>
          </td>
          <td data-col-idx="2">
            <input type="text" inputmode="decimal" class="cell-input subtab-col-2" placeholder="" value="${escapeHtml(col2Val)}">
          </td>
          <td data-col-idx="3">
            <input type="text" inputmode="decimal" class="cell-input subtab-col-3" placeholder="" value="${escapeHtml(col3Val)}">
          </td>
          <td data-col-idx="4">
            <input type="text" inputmode="decimal" class="cell-input subtab-col-4" placeholder="" value="${escapeHtml(col4Val)}">
          </td>
          <td class="no-capture-cell" style="text-align: center;" data-html2canvas-ignore="true">
            <div class="row-actions-cell">
              <button class="delete-row-btn subtab-delete-row-btn" data-row-index="${idx}" title="Delete Row">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        `;
      } else if (cfg.group === 'B') {
        const col2Formatted = r.col2 !== '' ? formatTwoDecimals(r.col2) : '';
        const col3Formatted = r.col3 !== '' ? formatTwoDecimals(r.col3) : '';
        const col4Formatted = r.col4 !== '' ? formatTwoDecimals(r.col4) : '';

        tr.innerHTML = `
          <td class="row-num-cell">${idx + 1}</td>
          <td data-col-idx="1">
            <textarea class="cell-textarea subtab-col-1" rows="1" placeholder="Item description...">${safeCol1}</textarea>
          </td>
          <td data-col-idx="2">
            <input type="text" inputmode="decimal" class="cell-input subtab-col-2" placeholder="" value="${escapeHtml(col2Formatted)}">
          </td>
          <td data-col-idx="3">
            <input type="text" inputmode="decimal" class="cell-input subtab-col-3" placeholder="" value="${escapeHtml(col3Formatted)}">
          </td>
          <td data-col-idx="4">
            <input type="text" inputmode="decimal" class="cell-input subtab-col-4" placeholder="" value="${escapeHtml(col4Formatted)}">
          </td>
          <td class="no-capture-cell" style="text-align: center;" data-html2canvas-ignore="true">
            <div class="row-actions-cell">
              <button class="delete-row-btn subtab-delete-row-btn" data-row-index="${idx}" title="Delete Row">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        `;
      } else if (cfg.group === 'C') {
        const valAFormatted = r.col2 !== '' ? formatTwoDecimals(r.col2) : '';
        const valBFormatted = r.col3 !== '' ? formatTwoDecimals(r.col3) : '';

        let rowDiffFormatted = '';
        if (r.col2 !== '' || r.col3 !== '') {
          const a = parseSafeNum(r.col2);
          const b = parseSafeNum(r.col3);
          rowDiffFormatted = formatTwoDecimals(roundTwo(a - b));
        }

        tr.innerHTML = `
          <td class="row-num-cell">${idx + 1}</td>
          <td data-col-idx="1">
            <textarea class="cell-textarea subtab-col-1" rows="1" placeholder="Item description...">${safeCol1}</textarea>
          </td>
          <td data-col-idx="2">
            <input type="text" inputmode="decimal" class="cell-input subtab-col-2" placeholder="" value="${escapeHtml(valAFormatted)}">
          </td>
          <td data-col-idx="3">
            <input type="text" inputmode="decimal" class="cell-input subtab-col-3" placeholder="" value="${escapeHtml(valBFormatted)}">
          </td>
          <td class="computed-cell subtab-col-diff" data-col-idx="4">
            ${escapeHtml(rowDiffFormatted)}
          </td>
          <td class="no-capture-cell" style="text-align: center;" data-html2canvas-ignore="true">
            <div class="row-actions-cell">
              <button class="delete-row-btn subtab-delete-row-btn" data-row-index="${idx}" title="Delete Row">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        `;
      }

      // Input event listeners
      const col1Input = tr.querySelector('.subtab-col-1');
      const col2Input = tr.querySelector('.subtab-col-2');
      const col3Input = tr.querySelector('.subtab-col-3');
      const col4Input = tr.querySelector('.subtab-col-4');

      const handleCellInput = () => {
        state.tabsData[cfg.id][idx] = {
          col1: col1Input?.value || '',
          col2: col2Input?.value || '',
          col3: col3Input?.value || '',
          col4: col4Input ? col4Input.value : ''
        };

        invalidateSubTab(cfg.id);

        // If Group C, update row difference immediately
        if (cfg.group === 'C') {
          const diffCell = tr.querySelector('.subtab-col-diff');
          if (col2Input.value !== '' || col3Input.value !== '') {
            const a = parseSafeNum(col2Input.value);
            const b = parseSafeNum(col3Input.value);
            diffCell.textContent = formatTwoDecimals(roundTwo(a - b));
          } else {
            diffCell.textContent = '';
          }
        }

        // Recalculate Subtab summary in-place
        const newResult = calculateSubTab(cfg.id);
        updateSubTabMetricValues(cfg, newResult);
        updateSubTabTableFootValues(cfg, newResult);
        calculateReconciliation(true);
      };

      if (col1Input) {
        col1Input.addEventListener('input', () => {
          col1Input.style.height = 'auto';
          col1Input.style.height = (col1Input.scrollHeight + 2) + 'px';
          handleCellInput();
        });
      }

      [col2Input, col3Input, col4Input].forEach(inp => {
        if (!inp) return;
        inp.addEventListener('input', () => {
          inp.value = inp.value.replace(/[^0-9.-]/g, '');
          handleCellInput();
        });
        inp.addEventListener('blur', () => {
          if (cfg.group !== 'A' && inp.value !== '') {
            inp.value = formatTwoDecimals(inp.value);
            handleCellInput();
          }
          flushPendingSync();
        });
      });

      // Delete row button
      tr.querySelector('.subtab-delete-row-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        state.tabsData[cfg.id].splice(idx, 1);
        if (state.tabsData[cfg.id].length === 0) {
          state.tabsData[cfg.id].push({ col1: '', col2: '', col3: '', col4: '' });
        }
        invalidateSubTab(cfg.id);
        renderActiveSubTabView();
        calculateReconciliation(true);
        flushPendingSync();
        showToast('Row deleted.');
      });

      subTabTableBody.appendChild(tr);
    });

    refreshIcons(subTabTableBody);
  }

  function renderSubTabTableFoot(cfg, subResult) {
    if (!subTabTableFoot) return;

    if (subTabTableFoot.getAttribute('data-tab-group') !== cfg.group) {
      subTabTableFoot.setAttribute('data-tab-group', cfg.group);

      if (cfg.group === 'A') {
        subTabTableFoot.innerHTML = `
          <tr class="summary-tr">
            <td colspan="2" class="summary-label-cell" style="text-align: left; padding-left: 0.85rem !important;">Gold Given</td>
            <td class="summary-value-cell" id="footTotalGiven" style="text-align: right;"></td>
            <td class="summary-value-cell" id="footTotalCol3" style="text-align: right;"></td>
            <td class="summary-value-cell" style="text-align: right;"></td>
            <td class="no-capture-cell" data-html2canvas-ignore="true"></td>
          </tr>
          <tr class="summary-tr" style="background-color: rgba(214, 107, 48, 0.04);">
            <td colspan="2" class="summary-label-cell" style="text-align: left; padding-left: 0.85rem !important;">RECD</td>
            <td class="summary-value-cell" style="text-align: right;"></td>
            <td class="summary-value-cell" id="footRecd" style="text-align: right; font-weight: 800; color: var(--primary-color);"></td>
            <td class="summary-value-cell" id="footCol4" style="text-align: right; font-weight: 800;"></td>
            <td class="no-capture-cell" data-html2canvas-ignore="true"></td>
          </tr>
          <tr class="summary-tr" style="background-color: rgba(239, 68, 68, 0.06);">
            <td colspan="4" class="summary-label-cell" id="footLossLabel" style="text-align: right; color: #c2410c;">NET LOSS:</td>
            <td class="summary-value-cell" id="footLossVal" style="text-align: right; font-weight: 900; color: #c2410c; font-size: 0.95rem;"></td>
            <td class="no-capture-cell" data-html2canvas-ignore="true"></td>
          </tr>
        `;
      } else if (cfg.group === 'B') {
        subTabTableFoot.innerHTML = `
          <tr class="summary-tr">
            <td colspan="2" class="summary-label-cell" style="text-align: left; padding-left: 0.85rem !important;">TOTAL</td>
            <td class="summary-value-cell" id="footTotalCol2" style="text-align: right; font-weight: 900; color: var(--primary-color); font-size: 0.95rem;"></td>
            <td class="summary-value-cell" style="text-align: center; color: var(--text-muted);">—</td>
            <td class="summary-value-cell" style="text-align: center; color: var(--text-muted);">—</td>
            <td class="no-capture-cell" data-html2canvas-ignore="true"></td>
          </tr>
        `;
      } else if (cfg.group === 'C') {
        subTabTableFoot.innerHTML = `
          <tr class="summary-tr">
            <td colspan="2" class="summary-label-cell" style="text-align: left; padding-left: 0.85rem !important;">TOTAL</td>
            <td class="summary-value-cell" id="footTotalA" style="text-align: right;"></td>
            <td class="summary-value-cell" id="footTotalB" style="text-align: right;"></td>
            <td class="summary-value-cell" id="footTotalDiff" style="text-align: right; font-weight: 900; color: var(--primary-color); font-size: 0.95rem;"></td>
            <td class="no-capture-cell" data-html2canvas-ignore="true"></td>
          </tr>
        `;
      }
    }

    updateSubTabTableFootValues(cfg, subResult);
  }

  function updateSubTabTableFootValues(cfg, subResult) {
    if (cfg.group === 'A') {
      const g = document.getElementById('footTotalGiven');
      const c3 = document.getElementById('footTotalCol3');
      const recd = document.getElementById('footRecd');
      const c4 = document.getElementById('footCol4');
      const loss = document.getElementById('footLossVal');
      if (g) g.textContent = subResult.hasData ? formatExact(subResult.totalCol2) : '';
      if (c3) c3.textContent = '';
      if (recd) recd.textContent = subResult.hasData ? formatExact(subResult.recd) : '';
      if (c4) c4.textContent = subResult.hasData ? formatExact(subResult.totalCol4) : '';
      if (loss) loss.textContent = subResult.hasData ? formatExact(subResult.netLoss) : '';
    } else if (cfg.group === 'B') {
      const t2 = document.getElementById('footTotalCol2');
      if (t2) t2.textContent = subResult.hasData ? formatTwoDecimals(subResult.totalCol2) : '';
    } else if (cfg.group === 'C') {
      const a = document.getElementById('footTotalA');
      const b = document.getElementById('footTotalB');
      const diff = document.getElementById('footTotalDiff');
      if (a) a.textContent = subResult.hasData ? formatTwoDecimals(subResult.totalCol2) : '';
      if (b) b.textContent = subResult.hasData ? formatTwoDecimals(subResult.totalCol3) : '';
      if (diff) diff.textContent = subResult.hasData ? formatTwoDecimals(subResult.totalDiff) : '';
    }
  }

  // --- View Switching System ---

  function switchView(viewId) {
    currentView = viewId;

    if (viewId === 'narration') {
      narrationView.classList.remove('hidden');
      subTabContentArea.classList.add('hidden');
      calculateReconciliation(false);
      adjustAllTextareaHeights();
    } else {
      narrationView.classList.add('hidden');
      subTabContentArea.classList.remove('hidden');
      renderActiveSubTabView();
    }

    // Update Sidebar active state
    updateSidebarUI();

    refreshIcons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- Left Sidebar Tab Switcher (Grouped with Add Tab Buttons) ---

  function buildSidebar() {
    if (!sidebarTabsList) return;
    renderSidebarSheetList();

    if (mobileSidebarToggleBtn && leftSidebarTabs) {
      mobileSidebarToggleBtn.onclick = () => {
        leftSidebarTabs.classList.toggle('expanded-mobile');
      };
    }
  }

  function renderSidebarSheetList() {
    if (!sidebarTabsList) return;
    sidebarTabsList.innerHTML = '';

    // 1. Home Narration Tab Button
    const narrationBtn = document.createElement('button');
    narrationBtn.className = `sidebar-tab-btn ${currentView === 'narration' ? 'active' : ''}`;
    narrationBtn.setAttribute('data-sidebar-id', 'narration');
    narrationBtn.innerHTML = `
      <div class="sidebar-tab-left">
        <span class="sidebar-dot"></span>
        <span class="sidebar-tab-name">Narration</span>
      </div>
    `;
    narrationBtn.addEventListener('click', () => {
      switchView('narration');
    });
    sidebarTabsList.appendChild(narrationBtn);

    // Groups A, B, and C definitions
    const groups = [
      { key: 'A', name: 'Group A', desc: 'Metal / Loss', badgeClass: 'badge-a' },
      { key: 'B', name: 'Group B', desc: 'Order & Weight', badgeClass: 'badge-b' },
      { key: 'C', name: 'Group C', desc: 'DROM / Deduction', badgeClass: 'badge-c' }
    ];

    groups.forEach(grp => {
      const grpTabs = tabsConfig.filter(t => t.group === grp.key);

      const sectionEl = document.createElement('div');
      sectionEl.className = 'sidebar-group-section';

      // Group Header with dedicated + Add Tab button strictly aligned opposite
      const headerEl = document.createElement('div');
      headerEl.className = 'sidebar-group-header';
      headerEl.innerHTML = `
        <div class="sidebar-group-title">
          <span class="group-badge ${grp.badgeClass}">${grp.name}</span>
        </div>
        <button class="sidebar-group-add-btn btn-grp-${grp.key.toLowerCase()}" title="Add new tab to ${grp.name}" data-group-add="${grp.key}">
          <i data-lucide="plus"></i>
          <span>Add Tab</span>
        </button>
      `;

      headerEl.querySelector('.sidebar-group-add-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        createDynamicTab(grp.key);
      });

      sectionEl.appendChild(headerEl);

      // Group Tabs
      grpTabs.forEach(cfg => {
        const meta = state.tabsMeta[cfg.id] || { name: cfg.defaultName };
        const subResult = calculateSubTab(cfg.id);

        const btn = document.createElement('button');
        btn.className = `sidebar-tab-btn ${currentView === cfg.id ? 'active' : ''}`;
        btn.setAttribute('data-sidebar-id', cfg.id);

        const valHtml = subResult.narrationOutput ? `<span class="sidebar-tab-val">${escapeHtml(subResult.narrationOutput)}</span>` : '';

        btn.innerHTML = `
          <div class="sidebar-tab-left">
            <span class="sidebar-dot"></span>
            <span class="sidebar-tab-name">${escapeHtml(meta.name)}</span>
          </div>
          ${valHtml}
        `;

        btn.addEventListener('click', () => {
          switchView(cfg.id);
        });

        sectionEl.appendChild(btn);
      });

      sidebarTabsList.appendChild(sectionEl);
    });

    refreshIcons(sidebarTabsList);
  }

  // In-place update of sidebar calculated values
  function updateSidebarValues() {
    if (!sidebarTabsList) return;
    for (let i = 0; i < tabsConfig.length; i++) {
      const cfg = tabsConfig[i];
      const subResult = calculateSubTab(cfg.id);
      const btn = sidebarTabsList.querySelector(`[data-sidebar-id="${cfg.id}"]`);
      if (btn) {
        let valSpan = btn.querySelector('.sidebar-tab-val');
        const valText = subResult.narrationOutput || '';
        if (valText) {
          if (!valSpan) {
            valSpan = document.createElement('span');
            valSpan.className = 'sidebar-tab-val';
            btn.appendChild(valSpan);
          }
          if (valSpan.textContent !== valText) {
            valSpan.textContent = valText;
          }
        } else if (valSpan) {
          valSpan.remove();
        }
      }
    }
  }

  // In-place update of sidebar tab names without DOM recreation
  function updateSidebarTabNames() {
    if (!sidebarTabsList) return;
    for (let i = 0; i < tabsConfig.length; i++) {
      const cfg = tabsConfig[i];
      const btn = sidebarTabsList.querySelector(`[data-sidebar-id="${cfg.id}"]`);
      if (btn) {
        const nameSpan = btn.querySelector('.sidebar-tab-name');
        const name = state.tabsMeta[cfg.id]?.name || cfg.defaultName;
        if (nameSpan && nameSpan.textContent !== name) {
          nameSpan.textContent = name;
        }
      }
    }
  }

  function updateSidebarUI() {
    if (!sidebarTabsList) return;
    const allBtns = sidebarTabsList.querySelectorAll('.sidebar-tab-btn');
    allBtns.forEach(btn => {
      const id = btn.getAttribute('data-sidebar-id');
      if (id === currentView) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // --- Renaming Tabs (Global Sync) ---

  function renameTab(tabId, newName) {
    if (!newName || !state.tabsMeta[tabId]) return;

    state.tabsMeta[tabId].name = newName;

    // Update subtab header if active
    if (currentView === tabId) {
      subTabTitleDisplay.textContent = newName;
      subTabTitleInput.value = newName;
    }

    // Update Narration row narration textarea in-place
    const cfg = tabsConfig.find(t => t.id === tabId);
    if (cfg) {
      const rowEl = tableBody.querySelector(`tr[data-reserved-row="${cfg.num}"]`);
      if (rowEl) {
        const txt = rowEl.querySelector('.col-narration');
        if (txt && txt.value !== newName) txt.value = newName;
      }
    }

    // Update sidebar navigation list in-place
    updateSidebarTabNames();

    saveStateAndSync();
    flushPendingSync();
    showToast(`Tab renamed to "${newName}"`);
  }

  // Header Title Edit in Sub-Tab
  if (editTabNameBtn && subTabTitleInput && subTabTitleDisplay) {
    editTabNameBtn.addEventListener('click', () => {
      subTabTitleDisplay.classList.add('hidden');
      subTabTitleInput.classList.remove('hidden');
      subTabTitleInput.focus();
      subTabTitleInput.select();
    });

    const commitHeaderRename = () => {
      const newName = subTabTitleInput.value.trim() || state.tabsMeta[currentView]?.name;
      renameTab(currentView, newName);
      subTabTitleInput.classList.add('hidden');
      subTabTitleDisplay.classList.remove('hidden');
      subTabTitleDisplay.textContent = newName;
    };

    subTabTitleInput.addEventListener('blur', commitHeaderRename);
    subTabTitleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commitHeaderRename();
      else if (e.key === 'Escape') {
        subTabTitleInput.value = state.tabsMeta[currentView]?.name;
        subTabTitleInput.classList.add('hidden');
        subTabTitleDisplay.classList.remove('hidden');
      }
    });
  }

  // Subtab Date Change Listener
  if (subTabDateInput) {
    subTabDateInput.addEventListener('input', () => {
      if (currentView.startsWith('tab')) {
        state.tabsMeta[currentView].date = subTabDateInput.value;
        saveStateAndSync();
      }
    });
  }

  // Subtab Dynamic Row Management (+ Add Row / + Add Item)
  function handleAddSubTabRow() {
    if (!currentView.startsWith('tab')) return;
    const tabId = currentView;
    if (!state.tabsData[tabId]) {
      state.tabsData[tabId] = [];
    }
    state.tabsData[tabId].push({ col1: '', col2: '', col3: '', col4: '' });
    invalidateSubTab(tabId);
    renderActiveSubTabView();
    calculateReconciliation(true);
    flushPendingSync();
    showToast('New item added.');

    // Auto-focus the newly added row description input
    setTimeout(() => {
      const rows = subTabTableBody ? subTabTableBody.querySelectorAll('tr') : [];
      if (rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        const textarea = lastRow.querySelector('.subtab-col-1');
        if (textarea) {
          textarea.focus();
          textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }, 50);
  }

  if (subTabAddRowBtn) {
    subTabAddRowBtn.addEventListener('click', handleAddSubTabRow);
  }
  if (subTabBottomAddRowBtn) {
    subTabBottomAddRowBtn.addEventListener('click', handleAddSubTabRow);
  }

  // Subtab Reset (Clears only active sub-tab)
  if (subTabResetBtn) {
    subTabResetBtn.addEventListener('click', () => {
      if (!currentView.startsWith('tab')) return;
      const meta = state.tabsMeta[currentView];
      const tabName = meta?.name || 'this sub-sheet';

      showConfirmModal(
        `Reset ${tabName}?`,
        `This action will clear all row entries in "${tabName}" without affecting other tabs or the main Narration sheet.`,
        () => {
          state.tabsData[currentView] = [
            { col1: '', col2: '', col3: '', col4: '' },
            { col1: '', col2: '', col3: '', col4: '' },
            { col1: '', col2: '', col3: '', col4: '' }
          ];
          invalidateSubTab(currentView);
          renderActiveSubTabView();
          calculateReconciliation(true);
          flushPendingSync();
          showToast(`"${tabName}" data cleared.`);
        }
      );
    });
  }

  // Subtab Back to Narration
  if (subTabBackBtn) {
    subTabBackBtn.addEventListener('click', () => switchView('narration'));
  }

  // --- Narration Action Buttons ---

  // Add Manual Row
  const handleAddManualRow = () => {
    createManualRowElement();
    updateRowIndices();
    calculateReconciliation(true);
    flushPendingSync();
    adjustAllTextareaHeights();
    showToast('Extra row added.');
  };

  if (addRowBtn) addRowBtn.addEventListener('click', handleAddManualRow);
  if (addBottomRowBtn) addBottomRowBtn.addEventListener('click', handleAddManualRow);

  // Narration Reset Button
  if (resetTableBtn) {
    resetTableBtn.addEventListener('click', () => {
      showConfirmModal(
        'Reset Narration Table?',
        'This will clear manual rows and reset Document Date, Ref, and Physical Stock. Sub-sheet data will remain safe.',
        () => {
          // Remove manual rows
          const manualRows = tableBody.querySelectorAll('tr:not([data-reserved-row])');
          manualRows.forEach(r => r.remove());

          // Reset inputs
          physicalStockInput.value = '';
          referenceInput.value = '';
          docDateInput.value = new Date().toISOString().split('T')[0];

          updateRowIndices();
          calculateReconciliation(true);
          flushPendingSync();
          adjustAllTextareaHeights();
          showToast('Narration table reset.');
        }
      );
    });
  }

  // Narration Document Inputs
  physicalStockInput.addEventListener('input', () => {
    physicalStockInput.value = physicalStockInput.value.replace(/[^0-9.-]/g, '');
    calculateReconciliation(true);
  });
  physicalStockInput.addEventListener('blur', () => {
    if (physicalStockInput.value !== '') {
      physicalStockInput.value = formatTwoDecimals(physicalStockInput.value);
      calculateReconciliation(true);
    }
    flushPendingSync();
  });
  referenceInput.addEventListener('input', () => calculateReconciliation(true));
  referenceInput.addEventListener('blur', flushPendingSync);
  docDateInput.addEventListener('input', () => calculateReconciliation(true));
  docDateInput.addEventListener('blur', flushPendingSync);

  // --- Three-Tier Real-Time Synchronization Engine ---
  // Tier 1: LocalStorage + BroadcastChannel for instant same-device sync (<1ms)
  // Tier 2: Firebase Realtime Database for multi-device cloud persistence
  // Tier 3: Supabase Realtime Channel for multi-client websocket subscriptions & broadcasts

  const syncDeviceId = 'dev_' + Math.random().toString(36).substring(2, 9);
  let lastAppliedRemoteTimestamp = 0;
  let syncDebounceTimer = null;
  let isLocalUpdate = false;

  function updateSyncStatus(statusClass, text) {
    if (!syncBadge || !syncStatusText) return;
    syncBadge.className = 'sync-status-badge ' + statusClass;
    syncStatusText.textContent = text;

    if (syncWarningBanner) {
      if (statusClass === 'online') syncWarningBanner.classList.add('hidden');
      else if (statusClass === 'offline') syncWarningBanner.classList.remove('hidden');
      else syncWarningBanner.classList.add('hidden');
    }
  }

  // 1. BroadcastChannel for Instant Same-Device / Multi-Tab Synchronization (<1ms)
  let localBroadcastChannel = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      localBroadcastChannel = new BroadcastChannel('narration_realtime_sync_channel');
      localBroadcastChannel.onmessage = (event) => {
        if (event && event.data && event.data.type === 'NAR_STATE_SYNC') {
          applyIncomingState(event.data.payload);
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel not available:', e);
    }
  }

  // 2. Supabase Realtime Client & Channel
  let supabaseClient = null;
  let supabaseRealtimeChannel = null;

  function initSupabaseSync() {
    const savedConfig = localStorage.getItem('narration_supabase_config');
    let config = window.SUPABASE_CONFIG;
    if (!config && savedConfig) {
      try { config = JSON.parse(savedConfig); } catch (e) {}
    }

    if (typeof window.supabase !== 'undefined' && config && config.url && config.key) {
      try {
        supabaseClient = window.supabase.createClient(config.url, config.key);
        supabaseRealtimeChannel = supabaseClient.channel('narration_realtime_room', {
          config: { broadcast: { self: false } }
        });

        supabaseRealtimeChannel
          .on('broadcast', { event: 'state_update' }, ({ payload }) => {
            applyIncomingState(payload);
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              updateSyncStatus('online', 'Live Sync Active (Supabase)');
            }
          });
      } catch (err) {
        console.warn('Supabase Realtime initialization warning:', err);
      }
    }
  }

  // Global setup helper for Supabase
  window.configureSupabase = function(urlOrConfig, key) {
    let cfg = typeof urlOrConfig === 'object' ? urlOrConfig : { url: urlOrConfig, key };
    if (cfg.url && cfg.key) {
      localStorage.setItem('narration_supabase_config', JSON.stringify(cfg));
      window.SUPABASE_CONFIG = cfg;
      initSupabaseSync();
      return 'Supabase configured and connected.';
    }
    return 'Please provide { url, key }.';
  };

  // 3. Firebase Realtime Database Configuration
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

  function initFirebaseSync() {
    if (typeof firebase === 'undefined') {
      updateSyncStatus('offline', 'Local Storage Mode');
      return;
    }

    try {
      let narrationApp;
      const existingApp = firebase.apps.find(a => a && a.name === "narrationApp");
      if (existingApp) {
        narrationApp = existingApp;
      } else {
        narrationApp = firebase.initializeApp(firebaseConfig, "narrationApp");
      }

      const db = firebase.database(narrationApp);
      firebaseDbRef = db.ref('narration_isolated_projects/narration_stock_ledger_v1');

      const connectedRef = db.ref('.info/connected');
      connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
          updateSyncStatus('online', 'Live Sync Active');
        } else {
          updateSyncStatus('connecting', 'Connecting...');
        }
      });

      firebaseDbRef.on('value', (snapshot) => {
        if (isLocalUpdate) return;
        const data = snapshot.val();
        if (!data) return;

        if (data.deviceId !== syncDeviceId) {
          applyIncomingState(data);
        }
      }, (err) => {
        console.error('Firebase sync error:', err);
        updateSyncStatus('offline', 'Offline Mode');
      });

    } catch (e) {
      console.error('Failed to initialize Firebase:', e);
      updateSyncStatus('offline', 'Local Storage Mode');
    }
  }

  // Gather serialized payload
  function getSerializedState() {
    const manualRows = [];
    const manualRowEls = tableBody.querySelectorAll('tr:not([data-reserved-row])');
    manualRowEls.forEach(row => {
      const narration = row.querySelector('.col-narration')?.value || '';
      const c1Raw = row.querySelector('.col-1')?.value || '';
      const c2Raw = row.querySelector('.col-2')?.value || '';
      const c3Raw = row.querySelector('.col-3')?.value || '';
      manualRows.push({
        narration,
        c1: c1Raw !== '' ? formatTwoDecimals(c1Raw) : '',
        c2: c2Raw !== '' ? formatTwoDecimals(c2Raw) : '',
        c3: c3Raw !== '' ? formatTwoDecimals(c3Raw) : ''
      });
    });

    return {
      narration: {
        physicalStock: physicalStockInput.value,
        referenceNo: referenceInput.value,
        docDate: docDateInput.value,
        rows11Plus: manualRows
      },
      tabsConfig: tabsConfig,
      tabsMeta: state.tabsMeta,
      tabsData: state.tabsData,
      lastUpdated: Date.now(),
      deviceId: syncDeviceId
    };
  }

  // Save state immediately (optimistic UI) and debounce network push
  function saveStateAndSync() {
    const payload = getSerializedState();

    // 1. Instant LocalStorage Cache
    try {
      localStorage.setItem(STORAGE_KEYS.TABS_CONFIG, JSON.stringify(tabsConfig));
      localStorage.setItem(STORAGE_KEYS.PHYSICAL_STOCK, payload.narration.physicalStock);
      localStorage.setItem(STORAGE_KEYS.REFERENCE_NO, payload.narration.referenceNo);
      localStorage.setItem(STORAGE_KEYS.DOC_DATE, payload.narration.docDate);
      localStorage.setItem(STORAGE_KEYS.ROWS_DATA, JSON.stringify(payload.narration.rows11Plus));
      localStorage.setItem(STORAGE_KEYS.TABS_META, JSON.stringify(payload.tabsMeta));
      localStorage.setItem(STORAGE_KEYS.TABS_DATA, JSON.stringify(payload.tabsData));
    } catch (e) {
      console.warn('LocalStorage save warning:', e);
    }

    // 2. Instant Same-Device Cross-Tab Broadcast (<1ms)
    if (localBroadcastChannel) {
      try {
        localBroadcastChannel.postMessage({
          type: 'NAR_STATE_SYNC',
          payload
        });
      } catch (e) {}
    }

    // 3. Debounced Multi-Device Network Push (150ms debounce)
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      // Firebase Realtime DB
      if (firebaseDbRef) {
        isLocalUpdate = true;
        firebaseDbRef.set(payload).then(() => {
          isLocalUpdate = false;
        }).catch(err => {
          isLocalUpdate = false;
          console.error('Firebase save error:', err);
          updateSyncStatus('offline', 'Sync Connection Failed');
        });
      }

      // Supabase Realtime Broadcast
      if (supabaseRealtimeChannel) {
        try {
          supabaseRealtimeChannel.send({
            type: 'broadcast',
            event: 'state_update',
            payload
          });
        } catch (err) {
          console.warn('Supabase broadcast error:', err);
        }
      }
    }, 150);
  }

  // Flush any pending debounced sync immediately
  function flushPendingSync() {
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer);
      syncDebounceTimer = null;
      const payload = getSerializedState();

      if (firebaseDbRef) {
        isLocalUpdate = true;
        firebaseDbRef.set(payload).finally(() => { isLocalUpdate = false; });
      }

      if (supabaseRealtimeChannel) {
        try {
          supabaseRealtimeChannel.send({
            type: 'broadcast',
            event: 'state_update',
            payload
          });
        } catch (e) {}
      }
    }
  }

  // Synchronize manual rows DOM in-place without destroying and recreating nodes
  function syncManualRowsDOM(remoteRows) {
    const existingRows = Array.from(tableBody.querySelectorAll('tr:not([data-reserved-row])'));

    for (let i = 0; i < Math.min(existingRows.length, remoteRows.length); i++) {
      const tr = existingRows[i];
      const r = remoteRows[i];
      const narr = tr.querySelector('.col-narration');
      const c1 = tr.querySelector('.col-1');
      const c2 = tr.querySelector('.col-2');
      const c3 = tr.querySelector('.col-3');
      if (narr && document.activeElement !== narr && narr.value !== (r.narration || '')) {
        narr.value = r.narration || '';
      }
      if (c1 && document.activeElement !== c1 && c1.value !== (r.c1 || '')) {
        c1.value = r.c1 || '';
      }
      if (c2 && document.activeElement !== c2 && c2.value !== (r.c2 || '')) {
        c2.value = r.c2 || '';
      }
      if (c3 && document.activeElement !== c3 && c3.value !== (r.c3 || '')) {
        c3.value = r.c3 || '';
      }
    }

    if (remoteRows.length > existingRows.length) {
      for (let i = existingRows.length; i < remoteRows.length; i++) {
        createManualRowElement(remoteRows[i]);
      }
      updateRowIndices();
    } else if (existingRows.length > remoteRows.length) {
      for (let i = remoteRows.length; i < existingRows.length; i++) {
        existingRows[i].remove();
      }
      updateRowIndices();
    }
  }

  // Conflict-Resolution Granular State Merger
  function applyIncomingState(data) {
    if (!data) return;

    // Filter out our own echo
    if (data.deviceId === syncDeviceId) return;

    // Ignore out-of-order stale packets
    if (data.lastUpdated && data.lastUpdated < lastAppliedRemoteTimestamp) {
      return;
    }
    lastAppliedRemoteTimestamp = data.lastUpdated || Date.now();

    const activeEl = document.activeElement;

    // 1. Tab Configuration Merge (Detect dynamic tabs created or removed remotely)
    if (Array.isArray(data.tabsConfig) && data.tabsConfig.length > 0) {
      const currentIds = tabsConfig.map(t => t.id).join(',');
      const remoteIds = data.tabsConfig.map(t => t.id).join(',');
      if (currentIds !== remoteIds) {
        tabsConfig = data.tabsConfig;
        state.tabsConfig = tabsConfig;
        buildReservedRows();
        buildSidebar();
      }
    }

    // 2. Tab Metadata Merge (Names & Dates)
    if (data.tabsMeta && typeof data.tabsMeta === 'object') {
      let anyRenamed = false;
      Object.keys(data.tabsMeta).forEach(tId => {
        if (!isValidTabKey(tId)) return;
        const incoming = data.tabsMeta[tId];
        if (!incoming || typeof incoming !== 'object') return;

        if (!state.tabsMeta[tId]) {
          state.tabsMeta[tId] = {
            name: typeof incoming.name === 'string' ? incoming.name : '',
            date: typeof incoming.date === 'string' ? incoming.date : '',
            group: typeof incoming.group === 'string' ? incoming.group : 'A'
          };
          anyRenamed = true;
        } else {
          if (incoming.name && incoming.name !== state.tabsMeta[tId].name) {
            state.tabsMeta[tId].name = incoming.name;
            anyRenamed = true;
          }
          if (incoming.date) {
            state.tabsMeta[tId].date = incoming.date;
          }
          if (incoming.group) {
            state.tabsMeta[tId].group = incoming.group;
          }
        }
      });
      if (anyRenamed) {
        updateSidebarTabNames();
        if (currentView.startsWith('tab')) {
          const meta = state.tabsMeta[currentView];
          if (meta && subTabTitleDisplay && activeEl !== subTabTitleInput) {
            subTabTitleDisplay.textContent = meta.name;
            subTabTitleInput.value = meta.name;
          }
        }
      }
    }

    // 3. Sub-tabs Data Merge
    if (data.tabsData && typeof data.tabsData === 'object') {
      Object.keys(data.tabsData).forEach(tId => {
        if (!isValidTabKey(tId)) return;
        const incomingRows = data.tabsData[tId];
        if (!Array.isArray(incomingRows)) return;

        // Invalidate cache for updated tab
        invalidateSubTab(tId);

        if (tId !== currentView) {
          // Tab is not currently open: update in background
          state.tabsData[tId] = incomingRows;
        } else {
          // Tab is currently open! Check if user is actively typing in a row
          const subRows = Array.from(subTabTableBody.querySelectorAll('tr'));
          let activeRowIndex = -1;
          if (activeEl && subTabContentArea.contains(activeEl)) {
            const tr = activeEl.closest('tr');
            if (tr) activeRowIndex = subRows.indexOf(tr);
          }

          if (activeRowIndex === -1 || incomingRows.length !== subRows.length) {
            // User not typing or row count changed: full update
            state.tabsData[tId] = incomingRows;
            renderSubTabTableBody(tabsConfig.find(t => t.id === tId) || { group: 'A' }, incomingRows);
          } else {
            // User is typing in activeRowIndex: update other rows without disturbing cursor
            incomingRows.forEach((r, idx) => {
              if (idx !== activeRowIndex) {
                state.tabsData[tId][idx] = r;
                const tr = subRows[idx];
                if (tr) {
                  const c1 = tr.querySelector('.subtab-col-1');
                  const c2 = tr.querySelector('.subtab-col-2');
                  const c3 = tr.querySelector('.subtab-col-3');
                  const c4 = tr.querySelector('.subtab-col-4');
                  if (c1 && activeEl !== c1) c1.value = r.col1 || '';
                  if (c2 && activeEl !== c2) c2.value = r.col2 || '';
                  if (c3 && activeEl !== c3) c3.value = r.col3 || '';
                  if (c4 && activeEl !== c4) c4.value = r.col4 || '';
                }
              }
            });
          }
        }
      });
    }

    // 4. Narration Document & Rows Merge
    if (data.narration) {
      if (data.narration.physicalStock !== undefined && activeEl !== physicalStockInput) {
        physicalStockInput.value = data.narration.physicalStock !== '' ? formatTwoDecimals(data.narration.physicalStock) : '';
      }
      if (data.narration.referenceNo !== undefined && activeEl !== referenceInput) {
        referenceInput.value = data.narration.referenceNo;
      }
      if (data.narration.docDate !== undefined && activeEl !== docDateInput) {
        docDateInput.value = data.narration.docDate;
      }

      if (Array.isArray(data.narration.rows11Plus)) {
        syncManualRowsDOM(data.narration.rows11Plus);
      }
    }

    // 5. Update UI in-place
    if (currentView === 'narration') {
      calculateReconciliation(false);
      adjustAllTextareaHeights();
    } else {
      const cfg = tabsConfig.find(t => t.id === currentView);
      if (cfg) {
        const subResult = calculateSubTab(currentView);
        updateSubTabMetricValues(cfg, subResult);
        updateSubTabTableFootValues(cfg, subResult);
        calculateReconciliation(false);
      }
    }

    updateSidebarValues();
  }

  // --- Initial Application Load ---
  function init() {
    // 1. Recover tabsConfig from LocalStorage or legacy state
    try {
      const savedConfig = localStorage.getItem(STORAGE_KEYS.TABS_CONFIG);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (Array.isArray(parsed) && parsed.length > 0) {
          tabsConfig = parsed;
          state.tabsConfig = tabsConfig;
        }
      }

      // 2. Recover tab metadata and data
      const savedMeta = localStorage.getItem(STORAGE_KEYS.TABS_META) || localStorage.getItem(STORAGE_KEYS.LEGACY_META_V8);
      if (savedMeta) {
        const parsed = JSON.parse(savedMeta);
        if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach(k => {
            if (isValidTabKey(k) && parsed[k] && typeof parsed[k] === 'object') {
              state.tabsMeta[k] = {
                name: typeof parsed[k].name === 'string' ? parsed[k].name : '',
                date: typeof parsed[k].date === 'string' ? parsed[k].date : '',
                group: typeof parsed[k].group === 'string' ? parsed[k].group : 'A'
              };
            }
          });
        }
      }

      const savedData = localStorage.getItem(STORAGE_KEYS.TABS_DATA) || localStorage.getItem(STORAGE_KEYS.LEGACY_DATA_V8);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach(k => {
            if (isValidTabKey(k) && Array.isArray(parsed[k])) {
              state.tabsData[k] = parsed[k].map(r => ({
                col1: r && r.col1 !== undefined ? String(r.col1) : '',
                col2: r && r.col2 !== undefined ? String(r.col2) : '',
                col3: r && r.col3 !== undefined ? String(r.col3) : '',
                col4: r && r.col4 !== undefined ? String(r.col4) : ''
              }));
            }
          });
        }
      }

      // Ensure all tabs in tabsConfig have initialized meta & data
      initDefaultTabsState();

      // Invalidate calculations
      tabsConfig.forEach(t => dirtyTabs.add(t.id));

      const savedPhysicalStock = localStorage.getItem(STORAGE_KEYS.PHYSICAL_STOCK) || localStorage.getItem(STORAGE_KEYS.LEGACY_STOCK_V8);
      if (savedPhysicalStock !== null && savedPhysicalStock !== '') {
        physicalStockInput.value = formatTwoDecimals(savedPhysicalStock);
      }

      const savedRefNo = localStorage.getItem(STORAGE_KEYS.REFERENCE_NO) || localStorage.getItem(STORAGE_KEYS.LEGACY_REF_V8);
      if (savedRefNo !== null) referenceInput.value = savedRefNo;

      const savedDocDate = localStorage.getItem(STORAGE_KEYS.DOC_DATE) || localStorage.getItem(STORAGE_KEYS.LEGACY_DATE_V8);
      if (savedDocDate !== null) docDateInput.value = savedDocDate;
      else docDateInput.value = new Date().toISOString().split('T')[0];

    } catch (e) {
      console.error('Error recovering localStorage state:', e);
    }

    // 3. Build Reserved Rows in Narration Table for all configured sub-tabs
    buildReservedRows();

    // 4. Load Manual Rows
    try {
      const savedManualRows = localStorage.getItem(STORAGE_KEYS.ROWS_DATA) || localStorage.getItem(STORAGE_KEYS.LEGACY_ROWS_V8);
      if (savedManualRows) {
        const parsed = JSON.parse(savedManualRows);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach(r => createManualRowElement(r));
        }
      } else {
        const legacyRows = localStorage.getItem(STORAGE_KEYS.LEGACY_ROWS_V7);
        if (legacyRows) {
          try {
            const parsed = JSON.parse(legacyRows);
            if (Array.isArray(parsed) && parsed.length > 10) {
              parsed.slice(10).forEach(r => createManualRowElement(r));
            }
          } catch (err) { /* ignore */ }
        }
      }
    } catch (e) {
      console.error('Failed to load manual rows:', e);
    }

    updateRowIndices();

    // 5. Build Navigation Sidebar
    buildSidebar();

    // 6. Calculate reconciliation
    calculateReconciliation(false);
    adjustAllTextareaHeights();
    refreshIcons();

    // 7. Connect Multi-Device Synchronization (Firebase & Supabase)
    initSupabaseSync();
    initFirebaseSync();
  }

  // --- Report Image Export ---
  if (headerDownloadBtn) {
    headerDownloadBtn.addEventListener('click', () => {
      showToast('Generating report image...');

      const captureArea = document.getElementById('mainCaptureArea');
      const cardElement = captureArea.querySelector('.table-card:not(.hidden)');
      const tableResponsive = cardElement ? cardElement.querySelector('.table-responsive') : captureArea.querySelector('.table-responsive');
      const computedBg = window.getComputedStyle(document.body).backgroundColor || '#fdf5f0';
      const originalScrollLeft = tableResponsive ? tableResponsive.scrollLeft : 0;

      document.body.classList.add('is-exporting-image');

      // Sync input values to DOM attributes for html2canvas
      const allInputs = captureArea.querySelectorAll('input');
      allInputs.forEach(input => input.setAttribute('value', input.value));

      const allTextareas = captureArea.querySelectorAll('textarea');
      allTextareas.forEach(textarea => {
        textarea.textContent = textarea.value;
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight + 2) + 'px';
      });

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
              const clonedCard = clonedDoc.querySelector('.table-card:not(.hidden)');
              if (clonedCard) {
                clonedCard.style.overflow = 'visible';
                clonedCard.style.height = 'auto';
              }
            }
          }).then(canvas => {
            const imageUri = canvas.toDataURL('image/png');

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

            const sheetPrefix = currentView === 'narration' 
              ? 'Narration' 
              : (state.tabsMeta[currentView]?.name || currentView).replace(/[^a-zA-Z0-9_-]/g, '_');

            const filename = `${sheetPrefix}-${dateStr}-${timeStr}.png`;

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
            if (tableResponsive) tableResponsive.scrollLeft = originalScrollLeft;
            adjustAllTextareaHeights();
          });
        } else {
          document.body.classList.remove('is-exporting-image');
          showToast('Export library not loaded.');
        }
      }, 100);
    });
  }

  // ==========================================
  // EXCEL & GOOGLE SHEETS TABLE COPY ENGINE
  // ==========================================

  function getFormattedTableData(targetView) {
    if (targetView === 'narration') {
      const headers = ['No.', 'NARRATION', '1', '2', '3', '4'];
      const rows = [];

      // Reserved rows for all sub-sheets
      tabsConfig.forEach((cfg, idx) => {
        const tabId = cfg.id;
        const tabName = state.tabsMeta[tabId]?.name || cfg.defaultName;
        const subResult = calculateSubTab(tabId);
        const balance = (cfg.group === 'A')
          ? (subResult.hasData ? formatExact(subResult.narrationOutput) : '')
          : (subResult.hasData ? formatTwoDecimals(subResult.narrationOutput) : '');
        rows.push([String(idx + 1), tabName, '', '', '', balance]);
      });

      // Manual rows
      const manualRows = tableBody.querySelectorAll('tr:not([data-reserved-row])');
      manualRows.forEach((r, idx) => {
        const narr = r.querySelector('.col-narration')?.value || '';
        const c1 = r.querySelector('.col-1')?.value || '';
        const c2 = r.querySelector('.col-2')?.value || '';
        const c3 = r.querySelector('.col-3')?.value || '';
        const c4 = r.querySelector('.col-4-display')?.textContent || '';
        rows.push([
          String(tabsConfig.length + idx + 1),
          narr,
          c1,
          c2,
          c3,
          c4
        ]);
      });

      const onHandVal = document.getElementById('onHandStockVal')?.textContent || '';
      const physicalVal = physicalStockInput?.value !== '' ? formatTwoDecimals(physicalStockInput.value) : '';
      const diffVal = document.getElementById('differenceVal')?.textContent || '';

      const summary = [
        ['', 'ON HAND STOCK', '', '', '', onHandVal],
        ['', 'PHYSICAL STOCK', '', '', '', physicalVal],
        ['', 'DIFFERENCE', '', '', '', diffVal]
      ];

      return {
        title: 'Stock Reconciliation',
        headers,
        rows,
        summary
      };
    }

    // Active Sub-Tab
    const tabId = targetView;
    const cfg = tabsConfig.find(t => t.id === tabId) || tabsConfig[0];
    const meta = state.tabsMeta[tabId] || { name: cfg.defaultName, date: '' };
    const rowsData = state.tabsData[tabId] || [];
    const subResult = calculateSubTab(tabId);

    let headers = [];
    let rows = [];
    let summary = [];

    if (cfg.group === 'A') {
      headers = ['No.', 'Item Name', '2', '3', '4'];
      rows = rowsData.map((r, idx) => [
        String(idx + 1),
        r.col1 || '',
        r.col2 !== undefined && r.col2 !== null && r.col2 !== '' ? String(r.col2) : '',
        r.col3 !== undefined && r.col3 !== null && r.col3 !== '' ? String(r.col3) : '',
        r.col4 !== undefined && r.col4 !== null && r.col4 !== '' ? String(r.col4) : ''
      ]);
      summary = [
        ['', 'Gold Given', subResult.hasData ? formatExact(subResult.totalCol2) : '', '', ''],
        ['', 'RECD', '', subResult.hasData ? formatExact(subResult.recd) : '', subResult.hasData ? formatExact(subResult.totalCol4) : ''],
        ['', 'NET LOSS:', '', '', subResult.hasData ? formatExact(subResult.netLoss) : '']
      ];
    } else if (cfg.group === 'B') {
      headers = ['No.', 'Order / Item Name', 'Amount / Value 1', 'Value 2 (Ref)', 'Value 3 (Ref)'];
      rows = rowsData.map((r, idx) => [
        String(idx + 1),
        r.col1 || '',
        r.col2 !== '' && r.col2 !== undefined ? formatTwoDecimals(r.col2) : '',
        r.col3 !== '' && r.col3 !== undefined ? formatTwoDecimals(r.col3) : '',
        r.col4 !== '' && r.col4 !== undefined ? formatTwoDecimals(r.col4) : ''
      ]);
      summary = [
        ['', 'TOTAL', subResult.hasData ? formatTwoDecimals(subResult.totalCol2) : '', '', '']
      ];
    } else if (cfg.group === 'C') {
      headers = ['No.', 'DROM / Item Name', 'Input Value A', 'Input Value B', 'Difference'];
      rows = rowsData.map((r, idx) => {
        let diffStr = '';
        if (r.col2 !== '' || r.col3 !== '') {
          const a = parseSafeNum(r.col2);
          const b = parseSafeNum(r.col3);
          diffStr = formatTwoDecimals(roundTwo(a - b));
        }
        return [
          String(idx + 1),
          r.col1 || '',
          r.col2 !== '' && r.col2 !== undefined ? formatTwoDecimals(r.col2) : '',
          r.col3 !== '' && r.col3 !== undefined ? formatTwoDecimals(r.col3) : '',
          diffStr
        ];
      });
      summary = [
        ['', 'TOTAL', subResult.hasData ? formatTwoDecimals(subResult.totalCol2) : '', subResult.hasData ? formatTwoDecimals(subResult.totalCol3) : '', subResult.hasData ? formatTwoDecimals(subResult.totalDiff) : '']
      ];
    }

    return {
      title: meta.name || cfg.defaultName,
      headers,
      rows,
      summary
    };
  }

  // --- TABLE CELL RANGE SELECTION ENGINE (Excel / Sheets Multi-Column Drag) ---
  let activeRangeSelection = null;
  let isMouseDown = false;
  let dragStartCoords = null;
  let isDraggingRange = false;

  function clearCellSelection() {
    document.querySelectorAll('.ledger-table td.cell-selected').forEach(td => {
      td.classList.remove('cell-selected');
    });
    activeRangeSelection = null;
  }

  function getTableSelectableRows(table) {
    if (!table) return [];
    return Array.from(table.querySelectorAll('tbody tr, tfoot tr:not(.add-row-tr):not(.no-copy-row)'));
  }

  function getCellCoordinates(td) {
    if (!td || !td.hasAttribute('data-col-idx')) return null;
    const tr = td.closest('tr');
    if (!tr || tr.classList.contains('add-row-tr') || tr.classList.contains('no-copy-row')) return null;
    const table = tr.closest('table');
    if (!table) return null;

    const validRows = getTableSelectableRows(table);
    const rowIdx = validRows.indexOf(tr);
    const colIdx = parseInt(td.getAttribute('data-col-idx'), 10);
    if (rowIdx === -1 || isNaN(colIdx)) return null;

    return {
      table,
      tableId: table.id,
      validRows,
      rowIdx,
      colIdx,
      td,
      tr
    };
  }

  function updateRangeHighlight(start, current) {
    const minRow = Math.min(start.rowIdx, current.rowIdx);
    const maxRow = Math.max(start.rowIdx, current.rowIdx);
    const minCol = Math.min(start.colIdx, current.colIdx);
    const maxCol = Math.max(start.colIdx, current.colIdx);

    const table = start.table;
    const allSelectableTds = table.querySelectorAll('tbody td[data-col-idx], tfoot tr:not(.add-row-tr):not(.no-copy-row) td[data-col-idx]');
    const selectedCells = [];

    allSelectableTds.forEach(cell => {
      const coords = getCellCoordinates(cell);
      if (coords &&
          coords.rowIdx >= minRow && coords.rowIdx <= maxRow &&
          coords.colIdx >= minCol && coords.colIdx <= maxCol) {
        cell.classList.add('cell-selected');
        selectedCells.push(cell);
      } else {
        cell.classList.remove('cell-selected');
      }
    });

    activeRangeSelection = {
      tableId: start.tableId,
      minRow,
      maxRow,
      minCol,
      maxCol,
      cells: selectedCells
    };
  }

  // Mouse drag range listeners
  document.addEventListener('mousedown', (e) => {
    const td = e.target.closest('td[data-col-idx]');
    if (!td) {
      clearCellSelection();
      return;
    }

    const coords = getCellCoordinates(td);
    if (!coords) return;

    isMouseDown = true;
    dragStartCoords = coords;
    isDraggingRange = false;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isMouseDown || !dragStartCoords) return;

    const td = e.target.closest('td[data-col-idx]');
    if (!td) return;

    const coords = getCellCoordinates(td);
    if (!coords || coords.tableId !== dragStartCoords.tableId) return;

    if (coords.rowIdx !== dragStartCoords.rowIdx || coords.colIdx !== dragStartCoords.colIdx) {
      isDraggingRange = true;
      updateRangeHighlight(dragStartCoords, coords);
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDraggingRange && activeRangeSelection && activeRangeSelection.cells.length > 1) {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    }
    isMouseDown = false;
    dragStartCoords = null;
    isDraggingRange = false;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearCellSelection();
    }
  });

  // Multi-cell selection & Range Copy Handler (Excel / Sheets formatting)
  document.addEventListener('copy', (e) => {
    // 1. If multi-cell range selection is active
    if (activeRangeSelection && activeRangeSelection.cells.length > 0) {
      const table = document.getElementById(activeRangeSelection.tableId);
      if (table) {
        const validRows = getTableSelectableRows(table);
        const extractedRows = [];

        for (let r = activeRangeSelection.minRow; r <= activeRangeSelection.maxRow; r++) {
          const tr = validRows[r];
          if (!tr || tr.classList.contains('add-row-tr') || tr.classList.contains('no-copy-row') || tr.querySelector('#addBottomRowBtn')) continue;

          if (tr.classList.contains('summary-tr')) {
            const labelCell = tr.querySelector('.summary-label-cell');
            const valCell = tr.querySelector('.summary-value-cell');
            const label = labelCell ? labelCell.innerText.replace(/\s+/g, ' ').trim() : '';
            let val = '';
            if (valCell) {
              const input = valCell.querySelector('input');
              val = input ? input.value : valCell.innerText.replace(/\s+/g, ' ').trim();
            }
            const rowData = [];
            for (let c = activeRangeSelection.minCol; c <= activeRangeSelection.maxCol; c++) {
              if (c === 1) rowData.push(label);
              else if (c === 5) rowData.push(val);
              else rowData.push('');
            }
            extractedRows.push(rowData);
            continue;
          }

          const rowData = [];
          for (let c = activeRangeSelection.minCol; c <= activeRangeSelection.maxCol; c++) {
            const td = tr.querySelector(`td[data-col-idx="${c}"]`);
            if (td) {
              const input = td.querySelector('input, textarea');
              const val = input ? input.value : td.innerText.replace(/\s+/g, ' ').trim();
              rowData.push(val);
            } else {
              rowData.push('');
            }
          }
          extractedRows.push(rowData);
        }

        const cleanExtracted = extractedRows.filter(r => !r.join(' ').toLowerCase().includes('add extra row'));

        if (cleanExtracted.length > 0) {
          let tsv = cleanExtracted.map(r => r.join('\t')).join('\r\n');
          tsv = tsv.split(/\r?\n/).filter(line => !line.toLowerCase().includes('add extra row')).join('\r\n');

          const htmlTable = '<table border="1" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:11pt;">' +
            cleanExtracted.map(r => '<tr>' + r.map(c => `<td style="padding:5px 10px;border:1px solid #cbd5e1;">${escapeHtml(c)}</td>`).join('') + '</tr>').join('') +
            '</table>';

          if (e.clipboardData) {
            e.clipboardData.setData('text/plain', tsv);
            e.clipboardData.setData('text/html', htmlTable);
            e.preventDefault();
            const colCount = activeRangeSelection.maxCol - activeRangeSelection.minCol + 1;
            showToast(`Copied ${cleanExtracted.length} row(s) [${colCount} col(s)]! Ready to paste into Excel (Ctrl+V)`);
            return;
          }
        }
      }
    }

    // 2. Native text selection
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      if (activeEl.selectionStart !== activeEl.selectionEnd) {
        return;
      }
    }

    const recTable = document.getElementById('reconciliationTable');
    const subTable = document.getElementById('subTabTable');
    let targetTable = null;

    if (recTable && (recTable.contains(selection.anchorNode) || recTable.contains(selection.focusNode) || selection.containsNode(recTable, true))) {
      targetTable = recTable;
    } else if (subTable && (subTable.contains(selection.anchorNode) || subTable.contains(selection.focusNode) || selection.containsNode(subTable, true))) {
      targetTable = subTable;
    }

    if (!targetTable) {
      const rawText = selection.toString();
      if (rawText.toLowerCase().includes('add extra row')) {
        const cleaned = rawText.split(/\r?\n/).filter(line => !line.toLowerCase().includes('add extra row')).join('\r\n');
        if (e.clipboardData) {
          e.clipboardData.setData('text/plain', cleaned);
          e.preventDefault();
        }
      }
      return;
    }

    const tableRows = Array.from(targetTable.querySelectorAll('tr')).filter(tr => {
      if (tr.classList.contains('add-row-tr') ||
          tr.classList.contains('no-copy-row') ||
          tr.hasAttribute('data-copy-ignore') ||
          tr.querySelector('#addBottomRowBtn')) {
        return false;
      }
      return true;
    });

    const selectedRows = tableRows.filter(tr => {
      try {
        return selection.containsNode(tr, true);
      } catch (err) {
        return false;
      }
    });

    if (selectedRows.length === 0) return;

    const extractedData = selectedRows.map(tr => {
      if (tr.classList.contains('summary-tr')) {
        const labelCell = tr.querySelector('.summary-label-cell');
        const valCell = tr.querySelector('.summary-value-cell');
        const label = labelCell ? labelCell.innerText.replace(/\s+/g, ' ').trim() : '';
        let val = '';
        if (valCell) {
          const input = valCell.querySelector('input');
          val = input ? input.value : valCell.innerText.replace(/\s+/g, ' ').trim();
        }
        return [label, '', '', '', val];
      }

      const dataCells = Array.from(tr.querySelectorAll('td[data-col-idx]'));
      if (dataCells.length > 0) {
        return dataCells.map(cell => {
          const input = cell.querySelector('input, textarea');
          if (input) return input.value;
          return cell.innerText.replace(/\s+/g, ' ').trim();
        });
      }
      const genericCells = Array.from(tr.querySelectorAll('th:not(.col-num-th):not(.no-capture-cell), td:not(.row-num-cell):not(.no-capture-cell)'));
      return genericCells.map(c => c.innerText.replace(/\s+/g, ' ').trim());
    });

    const cleanRows = extractedData.filter(r => {
      if (!r || r.length === 0) return false;
      if (r.join(' ').toLowerCase().includes('add extra row')) return false;
      return true;
    });

    if (cleanRows.length > 0) {
      let tsv = cleanRows.map(r => r.join('\t')).join('\r\n');
      tsv = tsv.split(/\r?\n/).filter(line => !line.toLowerCase().includes('add extra row')).join('\r\n');

      const htmlTable = '<table border="1" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:11pt;">' +
        cleanRows.map(r => '<tr>' + r.map(c => `<td style="padding:5px 10px;border:1px solid #cbd5e1;">${escapeHtml(c)}</td>`).join('') + '</tr>').join('') +
        '</table>';

      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', tsv);
        e.clipboardData.setData('text/html', htmlTable);
        e.preventDefault();
        showToast('Selected table rows copied for Excel!');
      }
    }
  });

  // --- MULTI-LINE SPLIT-PASTE ENGINE (WhatsApp / Excel / Multi-Row Paste) ---
  document.addEventListener('paste', (e) => {
    const target = e.target;
    if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;

    const table = target.closest('.ledger-table');
    if (!table) return;

    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;
    const text = clipboardData.getData('text');
    if (!text || (!text.includes('\n') && !text.includes('\r'))) {
      return; // Single-line paste: normal browser paste
    }

    const rawLines = text.split(/\r\n|\r|\n/);
    const lines = rawLines.map(l => l.trim());
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    if (lines.length <= 1) {
      return;
    }

    e.preventDefault();

    const isSubTabView = currentView.startsWith('tab') || table.id === 'subTabTable';

    if (isSubTabView) {
      // SUB-TAB MULTI-LINE SPLIT-PASTE
      const tabId = currentView.startsWith('tab') ? currentView : (tabsConfig[0]?.id || 'tab1');
      const targetTr = target.closest('tr');
      if (!targetTr || !subTabTableBody) return;

      const allTrs = Array.from(subTabTableBody.querySelectorAll('tr'));
      const startIdx = allTrs.indexOf(targetTr);
      if (startIdx === -1) return;

      let targetKey = 'col1';
      if (target.classList.contains('subtab-col-2')) targetKey = 'col2';
      else if (target.classList.contains('subtab-col-3')) targetKey = 'col3';
      else if (target.classList.contains('subtab-col-4')) targetKey = 'col4';

      if (!state.tabsData[tabId]) {
        state.tabsData[tabId] = [];
      }

      lines.forEach((line, i) => {
        const rowIdx = startIdx + i;
        while (rowIdx >= state.tabsData[tabId].length) {
          state.tabsData[tabId].push({ col1: '', col2: '', col3: '', col4: '' });
        }

        if (line.includes('\t') && targetKey === 'col1') {
          const parts = line.split('\t').map(p => p.trim());
          if (parts[0] !== undefined) state.tabsData[tabId][rowIdx].col1 = parts[0];
          if (parts[1] !== undefined) state.tabsData[tabId][rowIdx].col2 = parts[1];
          if (parts[2] !== undefined) state.tabsData[tabId][rowIdx].col3 = parts[2];
          if (parts[3] !== undefined) state.tabsData[tabId][rowIdx].col4 = parts[3];
        } else {
          state.tabsData[tabId][rowIdx][targetKey] = line;
        }
      });

      invalidateSubTab(tabId);
      renderActiveSubTabView();
      calculateReconciliation(true);
      flushPendingSync();
      adjustAllTextareaHeights();
      showToast(`Pasted ${lines.length} items across rows.`);

    } else {
      // NARRATION TABLE MULTI-LINE SPLIT-PASTE
      const targetTr = target.closest('tr');
      if (!targetTr || !tableBody) return;

      let allTrs = Array.from(tableBody.querySelectorAll('tr'));
      const startIdx = allTrs.indexOf(targetTr);
      if (startIdx === -1) return;

      let colType = 'narration';
      if (target.classList.contains('col-1')) colType = 'col-1';
      else if (target.classList.contains('col-2')) colType = 'col-2';
      else if (target.classList.contains('col-3')) colType = 'col-3';

      let anyTabRenamed = false;

      lines.forEach((line, i) => {
        const rowIdx = startIdx + i;
        while (rowIdx >= allTrs.length) {
          createManualRowElement({ narration: '', c1: '', c2: '', c3: '' });
          allTrs = Array.from(tableBody.querySelectorAll('tr'));
        }

        const tr = allTrs[rowIdx];
        if (!tr) return;

        if (line.includes('\t') && colType === 'narration') {
          const parts = line.split('\t').map(p => p.trim());
          if (parts[0] !== undefined) {
            const narrInput = tr.querySelector('.col-narration');
            if (narrInput) {
              narrInput.value = parts[0];
              const reservedIdx = parseInt(tr.getAttribute('data-reserved-row'), 10);
              if (!isNaN(reservedIdx) && tabsConfig[reservedIdx - 1]) {
                const tabId = tabsConfig[reservedIdx - 1].id;
                if (state.tabsMeta[tabId]) {
                  state.tabsMeta[tabId].name = parts[0];
                  anyTabRenamed = true;
                }
              }
            }
          }
          if (parts[1] !== undefined) {
            const c1 = tr.querySelector('.col-1');
            if (c1 && !c1.readOnly) c1.value = parts[1];
          }
          if (parts[2] !== undefined) {
            const c2 = tr.querySelector('.col-2');
            if (c2 && !c2.readOnly) c2.value = parts[2];
          }
          if (parts[3] !== undefined) {
            const c3 = tr.querySelector('.col-3');
            if (c3 && !c3.readOnly) c3.value = parts[3];
          }
        } else {
          if (colType === 'narration') {
            const narrInput = tr.querySelector('.col-narration');
            if (narrInput) {
              narrInput.value = line;
              const reservedIdx = parseInt(tr.getAttribute('data-reserved-row'), 10);
              if (!isNaN(reservedIdx) && tabsConfig[reservedIdx - 1]) {
                const tabId = tabsConfig[reservedIdx - 1].id;
                if (state.tabsMeta[tabId]) {
                  state.tabsMeta[tabId].name = line;
                  anyTabRenamed = true;
                }
              }
            }
          } else {
            const input = tr.querySelector('.' + colType);
            if (input && !input.readOnly) {
              input.value = line;
            }
          }
        }
      });

      if (anyTabRenamed) {
        updateSidebarTabNames();
      }

      updateRowIndices();
      calculateReconciliation(true);
      saveStateAndSync();
      flushPendingSync();
      adjustAllTextareaHeights();
      showToast(`Pasted ${lines.length} items across rows.`);
    }
  });

  // Start Application
  init();

});
