document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration & State ---
    const OMS_RATE = 31.1;

    // Initial Dataset (21 Rows)
    const initialData = [
        { usd: 420, mm: 0.9, ct: 0.005 },
        { usd: 420, mm: 1.0, ct: 0.006 },
        { usd: 420, mm: 1.1, ct: 0.007 },
        { usd: 420, mm: 1.2, ct: 0.008 },
        { usd: 395, mm: 1.3, ct: 0.010 },
        { usd: 395, mm: 1.4, ct: 0.012 },
        { usd: 395, mm: 1.5, ct: 0.014 },
        { usd: 395, mm: 1.6, ct: 0.018 },
        { usd: 395, mm: 1.7, ct: 0.021 },
        { usd: 415, mm: 1.8, ct: 0.025 },
        { usd: 415, mm: 1.9, ct: 0.029 },
        { usd: 415, mm: 2.0, ct: 0.035 },
        { usd: 450, mm: 2.10, ct: 0.039 },
        { usd: 450, mm: 2.20, ct: 0.044 },
        { usd: 450, mm: 2.30, ct: 0.052 },
        { usd: 450, mm: 2.40, ct: 0.058 },
        { usd: 450, mm: 2.50, ct: 0.069 },
        { usd: 500, mm: 2.60, ct: 0.074 },
        { usd: 500, mm: 2.70, ct: 0.078 },
        { usd: 500, mm: 2.80, ct: 0.086 },
        { usd: 500, mm: 2.90, ct: 0.095 },
        { usd: 500, mm: 3.00, ct: 0.108 },
    ];

    let rows = initialData.map((d, index) => ({
        id: Date.now() + index,
        usdRate: d.usd,
        mm: d.mm,
        ctWeight: d.ct,
        pcs: null, // Initial PCS is null/empty for logic
        totalWeight: 0,
        totalPrice: 0,
        isCustom: false
    }));

    // Header State
    const headerState = {
        usdGold: 0,
        purity: 0,
        dirham: 3.67,
        goldPrice: 0
    };

    // DOM Elements
    const usdGoldInput = document.getElementById('usd-gold-input');
    const purityInput = document.getElementById('purity-input');
    const dirhamInput = document.getElementById('dirham-input');
    const goldPriceDisplay = document.getElementById('gold-price-display');
    const liveRateDisplay = document.getElementById('live-rate-value');

    const tableBody = document.getElementById('table-body');
    const addRowBtn = document.getElementById('add-row-btn');

    const totalWeightDisplay = document.getElementById('total-weight-display');
    const totalPriceDisplay = document.getElementById('total-price-display');

    // Color Palette
    const colorPalette = [
        'rgba(56, 189, 248, 0.15)', // Sky
        'rgba(168, 85, 247, 0.15)', // Purple
        'rgba(244, 114, 182, 0.15)', // Pink
        'rgba(251, 146, 60, 0.15)',  // Orange
        'rgba(74, 222, 128, 0.15)',  // Green
        'rgba(250, 204, 21, 0.15)',  // Yellow
        'rgba(99, 102, 241, 0.15)',  // Indigo
        'rgba(239, 68, 68, 0.15)',   // Red
    ];

    // --- Core Logic ---

    function calculateHeader() {
        headerState.usdGold = parseFloat(usdGoldInput.value) || 0;
        headerState.purity = parseFloat(purityInput.value) || 0;
        headerState.dirham = parseFloat(dirhamInput.value) || 3.67;

        // Calc Gold Price: (USD / 31.1) * Dirham * Purity
        if (OMS_RATE > 0) {
            headerState.goldPrice = (headerState.usdGold / OMS_RATE) * headerState.dirham * headerState.purity;
        } else {
            headerState.goldPrice = 0;
        }

        goldPriceDisplay.textContent = headerState.goldPrice.toFixed(4);
        liveRateDisplay.textContent = headerState.dirham.toFixed(4);

        calculateAllRows();
        calculateGold(); // Sync gold tab calculations
    }

    function calculateRow(row) {
        // Weight = PCS * CT Weight
        // Parsing logic handles nulls as 0 for calc
        row.totalWeight = (row.pcs || 0) * (row.ctWeight || 0);

        // Price = USD Rate * Dirham * Total Weight
        row.totalPrice = (row.usdRate || 0) * headerState.dirham * row.totalWeight;
    }

    function calculateAllRows() {
        rows.forEach(row => calculateRow(row));
        renderTable();
        updateTotals();
    }

    function updateTotals() {
        const totalW = rows.reduce((acc, r) => acc + r.totalWeight, 0);
        const totalP = rows.reduce((acc, r) => acc + r.totalPrice, 0);

        totalWeightDisplay.textContent = totalW.toFixed(3) + ' ct';
        totalPriceDisplay.textContent = 'AED ' + totalP.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function getGroupColor(usdRate, uniqueRates) {
        if (!usdRate) return 'transparent'; // No color for empty rate
        const index = uniqueRates.indexOf(usdRate);
        if (index === -1) return 'transparent';
        return colorPalette[index % colorPalette.length];
    }

    function renderTable() {
        // Sort Logic:
        // 1. Size (mm) Ascending (Smallest to Largest).
        // 2. Empty/Null mm at the BOTTOM.
        rows.sort((a, b) => {
            const mmA = parseFloat(a.mm);
            const mmB = parseFloat(b.mm);

            const hasA = !isNaN(mmA) && mmA > 0;
            const hasB = !isNaN(mmB) && mmB > 0;

            if (hasA && hasB) {
                return mmA - mmB; // Ascending: Smallest first
            }
            if (hasA && !hasB) return -1; // A comes first (valid vs empty)
            if (!hasA && hasB) return 1;  // B comes first (empty vs valid)

            // If both no size, keep stable order
            return a.id - b.id;
        });

        // Identify Unique Rates for Color Mapping (Filter out "empty" ones)
        const validRates = rows.map(r => r.usdRate).filter(r => r && r > 0);
        const uniqueRates = [...new Set(validRates)].sort((a, b) => b - a);

        tableBody.innerHTML = '';

        rows.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'data-row';

            // Apply Color Grouping
            const color = getGroupColor(row.usdRate, uniqueRates);
            tr.style.backgroundColor = color;

            // Inputs handling for Custom or Empty Fields

            // USD Rate Input
            // If it's a new row, value is empty.
            const usdVal = (row.usdRate === null || row.usdRate === undefined || row.usdRate === 0) ? '' : row.usdRate;

            // MM & CT Inputs
            // Editable for custom rows, fixed for standard (unless we want to allow editing everything).
            // Prompt doesn't strictly forbid editing standard rows, but implies "Fixed" in spec.
            // However, "Add New Entry" has editable. Logic simplicity:
            // Custom Rows -> Editable Inputs.
            // Standard Rows -> Fixed Text (as per spec "mm (Fixed)", "CT Weight (Fixed)").

            let mmContent, ctContent;

            if (row.isCustom) {
                const mmVal = row.mm ? row.mm : '';
                const ctVal = row.ctWeight ? row.ctWeight : '';
                mmContent = `<input type="number" step="0.01" class="row-input" data-id="${row.id}" data-field="mm" value="${mmVal}" placeholder="mm">`;
                ctContent = `<input type="number" step="0.001" class="row-input" data-id="${row.id}" data-field="ctWeight" value="${ctVal}" placeholder="ct">`;
            } else {
                mmContent = `<span style="display:block; text-align:center; color:var(--text-secondary);">${row.mm.toFixed(2)}</span>`;
                ctContent = `<span style="display:block; text-align:center; color:var(--text-secondary);">${row.ctWeight.toFixed(3)}</span>`;
            }

            const pcsVal = (row.pcs === null || row.pcs === 0) ? '' : row.pcs;

            tr.innerHTML = `
                <td>
                    <input type="number" class="row-input" data-id="${row.id}" data-field="usdRate" value="${usdVal}" placeholder="Rate">
                </td>
                <td style="text-align:center;">${mmContent}</td>
                <td style="text-align:center;">${ctContent}</td>
                <td>
                    <input type="number" class="row-input" data-id="${row.id}" data-field="pcs" value="${pcsVal}" placeholder="0">
                </td>
                <td style="text-align:right; font-weight:500;">
                    ${row.totalWeight.toFixed(3)}
                </td>
                <td style="text-align:right; font-weight:600; color:var(--success-color);">
                    ${Number(row.totalPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style="text-align:center;">
                    <button class="btn-delete" data-id="${row.id}"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            `;

            tableBody.appendChild(tr);
        });

        attachTableListeners();
    }

    // --- Deletion & Undo State ---
    let rowToDeleteId = null;
    let deletedRowsStack = [];

    // Modal Elements
    const modal = document.getElementById('confirm-modal');
    const modalDetails = document.getElementById('modal-details');
    const btnCancel = document.getElementById('btn-cancel-delete');
    const btnConfirm = document.getElementById('btn-confirm-delete');

    // Undo Elements
    const undoToast = document.getElementById('undo-toast');
    const btnUndo = document.getElementById('btn-undo');
    let undoTimeout;

    function attachTableListeners() {
        // Universal Listener: 
        document.querySelectorAll('.row-input').forEach(input => {
            // Real-time calculation and state update
            input.addEventListener('input', (e) => handleTableInput(e, false));

            // Check for sorting eligibility on commit
            input.addEventListener('change', (e) => checkRowCompletionAndSort(e));
        });

        // Delete Buttons
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                initiateDelete(id);
            });
        });
    }

    // --- Deletion Logic ---

    function initiateDelete(id) {
        const row = rows.find(r => r.id === id);
        if (!row) return;

        rowToDeleteId = id;

        // Populate Modal
        const sizeInfo = row.mm ? `${row.mm.toFixed(2)} mm` : '-';
        const ctInfo = row.ctWeight ? `${row.ctWeight.toFixed(3)} ct` : '-';
        const rateInfo = row.usdRate ? `$${row.usdRate}` : '-';

        modalDetails.innerHTML = `
            <p>Are you sure you want to delete this entry?</p>
            <ul style="margin-top:10px; list-style:none;">
                <li><strong>Size:</strong> ${sizeInfo}</li>
                <li><strong>Weight:</strong> ${ctInfo}</li>
                <li><strong>Rate:</strong> ${rateInfo}</li>
            </ul>
        `;

        modal.classList.add('active');
    }

    function confirmDelete() {
        if (!rowToDeleteId) return;

        // 1. Find & Remove
        const index = rows.findIndex(r => r.id === rowToDeleteId);
        if (index > -1) {
            const deletedRow = rows[index];
            rows.splice(index, 1);

            // 2. Add to Undo Stack
            deletedRowsStack.push(deletedRow);
            showUndoToast();
        }

        // 3. UI Update
        modal.classList.remove('active');
        rowToDeleteId = null;
        renderTable();
        updateTotals();
    }

    function cancelDelete() {
        modal.classList.remove('active');
        rowToDeleteId = null;
    }

    // --- Undo Logic ---

    function showUndoToast() {
        undoToast.classList.add('active');

        // Reset timer
        if (undoTimeout) clearTimeout(undoTimeout);
        undoTimeout = setTimeout(() => {
            undoToast.classList.remove('active');
        }, 10000); // 10 seconds to undo
    }

    // Connect FAB
    const fabUndo = document.getElementById('fab-undo');
    const undoBadge = document.getElementById('undo-badge');

    function updateUndoUI() {
        const count = deletedRowsStack.length;

        // Update FAB
        if (count > 0) {
            fabUndo.classList.add('visible');
            undoBadge.textContent = count;
            undoBadge.style.display = 'flex';
        } else {
            fabUndo.classList.remove('visible');
            undoBadge.style.display = 'none';
        }
    }

    function performUndo() {
        if (deletedRowsStack.length === 0) return;

        const rowToRestore = deletedRowsStack.pop();
        rows.push(rowToRestore);

        // Re-renders and re-sorts automatically based on existing logic
        renderTable();
        updateTotals();

        // Update UIs
        updateUndoUI();

        // Hide toast if empty
        if (deletedRowsStack.length === 0) {
            undoToast.classList.remove('active');
        } else {
            // Reset timer for next undo
            showUndoToast();
        }
    }

    // --- Modal Events ---
    btnConfirm.addEventListener('click', () => {
        // Confirm Logic Update for FAB
        if (!rowToDeleteId) return;

        const index = rows.findIndex(r => r.id === rowToDeleteId);
        if (index > -1) {
            const deletedRow = rows[index];
            rows.splice(index, 1);

            // Add to Undo Stack
            deletedRowsStack.push(deletedRow);
            showUndoToast();
            updateUndoUI(); // Update FAB
        }

        modal.classList.remove('active');
        rowToDeleteId = null;
        renderTable();
        updateTotals();
    });

    btnCancel.addEventListener('click', cancelDelete);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) cancelDelete();
    });

    // --- Undo Events ---
    btnUndo.addEventListener('click', performUndo);
    fabUndo.addEventListener('click', performUndo);

    function checkRowCompletionAndSort(e) {
        const id = parseInt(e.target.dataset.id);
        const row = rows.find(r => r.id === id);
        if (!row) return;

        // Strict Rule: Only sort if ALL 4 fields are valid (> 0)
        // USD, mm, ct, pcs
        const isComplete = (row.usdRate > 0) && (row.mm > 0) && (row.ctWeight > 0) && (row.pcs > 0);

        if (isComplete) {
            renderTable(); // This performs the Sort
            updateTotals(); // Ensure totals are fresh
        }
    }

    function handleTableInput(e, triggerRender) {
        // Note: triggerRender is now unused in the main logic, 
        // but kept if we need manual force, though 'input' sends false.

        const id = parseInt(e.target.dataset.id);
        const field = e.target.dataset.field;
        let value = parseFloat(e.target.value);

        if (isNaN(value)) value = 0;
        if (e.target.value === '') value = null;

        const row = rows.find(r => r.id === id);
        if (!row) return;

        // Update State
        row[field] = value;

        // Recalc
        calculateRow(row);

        if (triggerRender) {
            renderTable();
            updateTotals();
        } else {
            // Optimization: Update DOM directly
            const tr = e.target.closest('tr');
            if (tr) {
                const fmtNum = (n, d) => n.toFixed(d);
                const fmtCur = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                // Weight Cell (Index 4)
                tr.children[4].textContent = fmtNum(row.totalWeight, 3);

                // Price Cell (Index 5)
                tr.children[5].textContent = fmtCur(row.totalPrice);

                updateTotals();
            }
        }
    }



    // --- Actions ---
    addRowBtn.addEventListener('click', () => {
        const newRow = {
            id: Date.now(),
            usdRate: null, // Empty by default
            mm: null,
            ctWeight: null,
            pcs: null,     // Empty by default
            totalWeight: 0,
            totalPrice: 0,
            isCustom: true
        };
        rows.push(newRow);
        // Do NOT need to calculateRow since it's empty (0)
        // Render will put it at the bottom because usdRate is null
        renderTable();

        // Scroll to bottom
        setTimeout(() => {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }, 50);
    });

    // --- Tabs Logic ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    const footerWeightStat = document.querySelector('.footer-stat:first-child'); // Selects the Weight stat container

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active
            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            document.getElementById(`tab-${tabId}`).classList.add('active');

            // Toggle Footer Weight Visibility & Update Price & Header Visibility
            const footerPrice = document.getElementById('total-price-display');
            const mainHeaderTitle = document.querySelector('.header-content'); // Updated selector based on recent change
            const liveRateContainer = document.querySelector('.live-rate-display');

            if (tabId === 'gold') {
                if (footerWeightStat) footerWeightStat.style.display = 'none';
                if (mainHeaderTitle) mainHeaderTitle.style.display = 'none';
                if (liveRateContainer) liveRateContainer.style.display = 'none';

                // Trigger recalc to update footer with Gold Total
                calculateGold();
            } else {
                if (footerWeightStat) footerWeightStat.style.display = 'flex';
                if (mainHeaderTitle) mainHeaderTitle.style.display = 'block';
                if (liveRateContainer) liveRateContainer.style.display = 'flex';

                // Trigger total update for Diamond
                updateTotals();
            }
        });
    });

    // --- Gold Calculation Logic ---
    const castBaseInput = document.getElementById('cast-base-input');
    const castFactorInput = document.getElementById('cast-factor-input');
    const castPlus25Display = document.getElementById('cast-plus-25');
    const resCasting = document.getElementById('res-casting');

    const campRefDisplay = document.getElementById('camp-ref-display');
    const campValInput = document.getElementById('camp-val-input');
    const resCamp = document.getElementById('res-camp');

    const makingPercentDisplay = document.getElementById('making-percent-display');
    const makingRateDisplay = document.getElementById('making-rate-display');
    const resMaking = document.getElementById('res-making');

    const goldFinalTotal = document.getElementById('gold-final-total');

    function calculateGold() {
        const base = parseFloat(castBaseInput.value) || 0;

        // --- Row 1: Casting ---
        // Col 2: Find 25% of Base, Add to Base (Base * 1.25)
        const basePlus25 = base * 1.25;
        castPlus25Display.textContent = basePlus25.toFixed(2);

        // Col 3: Factor (Default 2.5)
        const castFactor = parseFloat(castFactorInput.value) || 0;

        // Result: Col 2 * Col 3
        const castingTotal = basePlus25 * castFactor;
        resCasting.textContent = castingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });


        // --- Row 2: CAMP ---
        // Input: Uses Row 1 Col 2 (basePlus25)
        campRefDisplay.textContent = basePlus25.toFixed(2);

        // Editable (Default 20)
        const campVal = parseFloat(campValInput.value) || 0;

        // Formula: (Row1Col2 / 17) * Editable
        const campTotal = (basePlus25 / 17) * campVal;
        resCamp.textContent = campTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });


        // --- Row 3: Making ---
        // Input: 1% of Base
        const onePercentBase = base * 0.01;
        makingPercentDisplay.textContent = onePercentBase.toFixed(3); // 3 decimals for small weights

        // Rate: 18K Gold Price (from Header)
        const goldRate = headerState.goldPrice;
        makingRateDisplay.textContent = goldRate.toFixed(4);

        // Result: Calc 1 * Gold Rate
        const makingTotal = onePercentBase * goldRate;
        resMaking.textContent = makingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });


        // --- Final Total ---
        const total = castingTotal + campTotal + makingTotal;
        goldFinalTotal.textContent = 'AED ' + total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Gold Listeners
    const goldInputs = [castBaseInput, castFactorInput, campValInput];
    goldInputs.forEach(input => {
        input.addEventListener('input', calculateGold);
    });

    // --- Init ---
    usdGoldInput.addEventListener('input', calculateHeader);
    purityInput.addEventListener('input', calculateHeader);
    dirhamInput.addEventListener('input', calculateHeader);

    // --- Rate Sync & Validation Logic ---
    const btnSyncRate = document.getElementById('btn-sync-rate');
    const rateToast = document.getElementById('rate-toast');
    const rateToastMsg = document.getElementById('rate-toast-msg');
    const makingRowContainer = document.getElementById('making-row-container');

    function showRateToast(message, type = 'neutral') {
        rateToastMsg.textContent = message;
        rateToast.className = 'undo-toast active'; // Reset base classes

        if (type === 'error') rateToast.classList.add('error');
        if (type === 'success') rateToast.classList.add('success');

        // Hide Undo Toast if active to avoid overlapped mess
        undoToast.classList.remove('active');

        // Auto hide
        setTimeout(() => {
            rateToast.classList.remove('active');
        }, 4000);
    }

    function validateAndSyncGoldRate() {
        const currentRate = headerState.goldPrice;
        const validRate = currentRate > 0;

        // 1. Update Display Colors
        if (validRate) {
            makingRateDisplay.classList.remove('text-red');
            makingRateDisplay.classList.add('text-blue');
            makingRateDisplay.textContent = currentRate.toFixed(4);

            // Clear errors
            usdGoldInput.classList.remove('input-error');
            purityInput.classList.remove('input-error');

            showRateToast(`18K Gold Rate Synced: ${currentRate.toFixed(4)}`, 'success');
        } else {
            makingRateDisplay.classList.remove('text-blue');
            makingRateDisplay.classList.add('text-red');
            makingRateDisplay.textContent = "0.0000";

            // Highlight Inputs
            if (!parseFloat(usdGoldInput.value)) usdGoldInput.classList.add('input-error');
            if (!parseFloat(purityInput.value)) purityInput.classList.add('input-error');

            showRateToast('18K Gold Price Not Entered. Please fill Rate Convention fields.', 'error');
        }

        // Trigger recalc just in case
        calculateGold();
    }

    // Listeners
    btnSyncRate.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent row click
        validateAndSyncGoldRate();
    });

    makingRowContainer.addEventListener('click', () => {
        validateAndSyncGoldRate();
    });

    // Hook into existing calc to ensure color updates silently? 
    // The user asked for notification ONLY on tap/sync.
    // So for auto-updates (typing in header), we just update the text/color but NO toast.

    // Modified calculateGold is needed to support the Blue/Red text logic during auto-updates without toast.
    // I will append a patch to run this logic manually or update calculateGold?
    // Let's monkey-patch generic update logic into calculateGold for the silent color update.

    const originalCalculateGold = calculateGold;
    calculateGold = function () {
        // Run original math
        const base = parseFloat(castBaseInput.value) || 0;
        const basePlus25 = base * 1.25;
        castPlus25Display.textContent = basePlus25.toFixed(2);

        const castFactor = parseFloat(castFactorInput.value) || 0;
        const castingTotal = basePlus25 * castFactor;
        resCasting.textContent = castingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        campRefDisplay.textContent = basePlus25.toFixed(2);
        const campVal = parseFloat(campValInput.value) || 0;
        const campTotal = (basePlus25 / 17) * campVal;
        resCamp.textContent = campTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const onePercentBase = base * 0.01;
        makingPercentDisplay.textContent = onePercentBase.toFixed(3);

        const goldRate = headerState.goldPrice;

        // --- Color Logic (Silent) ---
        if (goldRate > 0) {
            makingRateDisplay.textContent = goldRate.toFixed(4);
            makingRateDisplay.classList.remove('text-red');
            makingRateDisplay.classList.add('text-blue');
            // Also remove errors if they fix it
            usdGoldInput.classList.remove('input-error');
            purityInput.classList.remove('input-error');
        } else {
            makingRateDisplay.textContent = "0.0000";
            makingRateDisplay.classList.remove('text-blue');
            makingRateDisplay.classList.add('text-red');
        }

        const makingTotal = onePercentBase * goldRate;
        resMaking.textContent = makingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const total = castingTotal + campTotal + makingTotal;
        goldFinalTotal.textContent = 'AED ' + total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Update Sticky Footer if in Gold Tab
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab && activeTab.dataset.tab === 'gold') {
            const footerPrice = document.getElementById('total-price-display');
            footerPrice.textContent = 'AED ' + total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    }

    // Initial Run
    calculateHeader();
    renderTable();
    calculateGold();
});
