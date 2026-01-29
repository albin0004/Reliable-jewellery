// reliable-jewellery-rate-convention/quotation-rate-app/script.js

document.addEventListener('DOMContentLoaded', () => {

    // --- State ---
    const state = {
        usd: 0,
        purity: 0,
        omsRate: 31.1,
        dirhamRate: 3.67, // Fixed default for verification
        baseRate: 0, // Calculated Section 1

        // Table Values
        goldWeight: 0,
        goldCost: 0,

        diamondWeight: 0, // Input only
        diamondCost: 0,
        stoneCost: 0,
        otherCost: 0,
        makingCost: 0,

        totalCost: 0,

        // Pricing
        marginPercent: 0,
        finalPrice: 0
    };

    // --- Elements ---

    // Section 1
    const usdInput = document.getElementById('usd-input');
    const purityInput = document.getElementById('purity-input');
    const baseRateDisplay = document.getElementById('base-rate-result');
    const omsRateInput = document.getElementById('oms-rate'); // Hidden
    const dirhamRateInput = document.getElementById('dirham-rate'); // Hidden
    // const liveStatusDot = document.getElementById('live-dot'); // Removed live logic for strict verification
    // const rateStatusText = document.getElementById('rate-status');

    // Section 2
    const goldWeightInput = document.getElementById('gold-weight');
    const goldCostDisplay = document.getElementById('gold-cost');

    // Diamond Col 2 & 3
    const diamondWeightInput = document.getElementById('diamond-weight');
    const diamondCostInput = document.getElementById('diamond-cost');

    const stoneCostInput = document.getElementById('stone-cost');
    const otherCostInput = document.getElementById('other-cost');
    const makingCostInput = document.getElementById('making-cost');

    const totalCostDisplay = document.getElementById('total-cost-display');

    // Section 3
    // Section 3
    const price15 = document.getElementById('price-15');
    const price20 = document.getElementById('price-20');
    const price25 = document.getElementById('price-25');
    const price30 = document.getElementById('price-30');
    const price35 = document.getElementById('price-35');
    const priceCustom = document.getElementById('price-custom');
    const customMarginInput = document.getElementById('custom-margin-input');

    // Section 4
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const imagePreview = document.getElementById('image-preview');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    const removeImageBtn = document.getElementById('remove-image-btn');

    // --- Logic ---

    // 1. Fetch Live AED Rate (Disabled for Strict Verification Compliance)
    /* 
    async function fetchRate() {
        ...
    } 
    */

    // 2. Calculations
    function calculateAll() {
        // --- Section 1: Rate Converter ---
        state.usd = parseFloat(usdInput.value) || 0;
        state.purity = parseFloat(purityInput.value) || 0;
        state.omsRate = parseFloat(omsRateInput.value) || 31.1;
        state.dirhamRate = parseFloat(dirhamRateInput.value) || 3.67;

        // Formula: Result = (USD / Ounce Rate) * Dirham * Purity
        // Requirement: Absolutely no rounding during calculation, show exactly 4 decimals.
        if (state.omsRate > 0) {
            state.baseRate = (state.usd / state.omsRate) * state.dirhamRate * state.purity;
        } else {
            state.baseRate = 0;
        }

        // Display: Exactly 4 decimal places
        baseRateDisplay.textContent = state.baseRate.toFixed(4);

        // --- Section 2: Table ---
        state.goldWeight = parseFloat(goldWeightInput.value) || 0;

        // Gold Cost = Base Rate * Gold Weight
        // Note: Base Rate used here is the full precision value (state.baseRate), not the rounded display.
        state.goldCost = state.baseRate * state.goldWeight;
        goldCostDisplay.textContent = state.goldCost.toFixed(2);

        // Parse Inputs
        // (Clean diamond input "1.5 ct" -> 1.5)
        const diamondValStr = diamondWeightInput.value.replace(/[^0-9.]/g, '');
        state.diamondWeight = parseFloat(diamondValStr) || 0;

        state.diamondCostPerCarat = parseFloat(diamondCostInput.value) || 0;
        state.stoneCost = parseFloat(stoneCostInput.value) || 0;
        state.otherCost = parseFloat(otherCostInput.value) || 0;
        state.makingCost = parseFloat(makingCostInput.value) || 0;
        state.customMargin = parseFloat(customMarginInput.value) || 0;

        calcRate();
        calcCosts();
        calcProfit();
    }

    // New functions for modular calculation
    function calcRate() {
        // This function is already mostly done in calculateAll for baseRate
        // If there were other rate-related calculations, they would go here.
    }

    function calcCosts() {
        // Diamond Cost = Direct Input (Amount)
        state.diamondCost = parseFloat(diamondCostInput.value) || 0;

        // Dynamic Items Sum
        let dynamicTotal = 0;
        document.querySelectorAll('.dynamic-cost-input').forEach(input => {
            dynamicTotal += parseFloat(input.value) || 0;
        });
        state.dynamicItemsTotal = dynamicTotal;

        // Total Cost
        state.totalCost = state.goldCost + state.diamondCost + state.stoneCost + state.otherCost + state.makingCost + state.dynamicItemsTotal;
        totalCostDisplay.textContent = state.totalCost.toFixed(2);
    }

    function calcProfit() {
        // --- Section 3: Pricing Table ---
        // Formula: Final Price = (Total Cost / (100 - Margin)) * 100

        updatePriceRow(price15, 15);
        updatePriceRow(price20, 20);
        updatePriceRow(price25, 25);
        updatePriceRow(price30, 30);
        updatePriceRow(price35, 35);

        // Custom
        const customInputStr = customMarginInput.value;
        if (customInputStr === '' || customInputStr === null) {
            priceCustom.textContent = '';
        } else {
            const customVal = parseFloat(customInputStr) || 0;
            updatePriceRow(priceCustom, customVal);
        }
    }

    function updatePriceRow(element, margin) {
        let final = 0;
        if (state.totalCost > 0) {
            if (margin >= 0 && margin < 100) {
                final = (state.totalCost / (100 - margin)) * 100;
            } else {
                final = state.totalCost;
            }
        }
        element.textContent = final.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // --- Event Listeners ---

    // Inputs (Added diamondWeightInput)
    [usdInput, purityInput, goldWeightInput, diamondWeightInput, diamondCostInput, stoneCostInput, otherCostInput, makingCostInput, customMarginInput].forEach(input => {
        input.addEventListener('input', calculateAll);
    });

    // Diamond Input Specific Logic (Auto append ' ct')
    diamondWeightInput.addEventListener('blur', function () {
        if (this.value && !this.value.toLowerCase().includes('ct')) {
            this.value = this.value + ' ct';
        }
    });

    diamondWeightInput.addEventListener('focus', function () {
        if (this.value) {
            this.value = this.value.replace(/ ct/gi, '').replace(/ct/gi, '').trim();
        }
    });

    // Image Upload
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent-color)';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });

    function handleFileSelect(e) {
        if (e.target.files.length) handleFiles(e.target.files);
    }

    function handleFiles(files) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.classList.remove('hidden');
                uploadPlaceholder.classList.add('hidden');
                removeImageBtn.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    }

    // Actions
    const saveBtn = document.getElementById('save-btn');
    const shareBtn = document.getElementById('share-btn');
    const historySection = document.getElementById('history-section');
    const historyList = document.getElementById('history-list');

    // Share
    const shareContainer = document.getElementById('share-export-container');
    const shareTime = document.getElementById('share-time');

    // --- History State ---
    let history = JSON.parse(localStorage.getItem('quotation_history')) || [];

    function saveHistory() {
        const record = {
            id: Date.now(),
            time: new Date().toLocaleString(),
            data: { ...state } // Clone state
        };
        // Ensure diamond weight string is saved as visible in UI
        record.data.diamondDisplay = diamondWeightInput.value;
        record.data.refNumber = document.getElementById('ref-input').value; // Save Ref
        record.data.goldUnit = document.getElementById('gold-unit').value; // Save Gold Unit
        record.data.stoneDetails = document.getElementById('stone-details').value;
        record.data.otherDetails = document.getElementById('other-details').value;
        record.data.otherName = document.getElementById('other-name').value; // Save Other Name
        record.data.makingDetails = document.getElementById('making-details').value;

        history.unshift(record);
        if (history.length > 10) history.pop(); // Max 10

        localStorage.setItem('quotation_history', JSON.stringify(history));
        renderHistory();
    }

    function deleteHistory(id) {
        if (confirm('Delete this record?')) {
            history = history.filter(item => item.id !== id);
            localStorage.setItem('quotation_history', JSON.stringify(history));
            renderHistory();
        }
    }

    function renderHistory() {
        historyList.innerHTML = '';
        if (history.length === 0) {
            historySection.style.display = 'none';
            return;
        }

        historySection.style.display = 'block';
        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-info">
                    <strong>${item.time}</strong>
                    <span>${item.data.refNumber ? 'Ref: ' + item.data.refNumber : 'Quotation'}</span>
                </div>
                <div class="history-actions">
                    <button class="view-btn" data-id="${item.id}">View</button>
                    <button class="delete-btn" data-id="${item.id}"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;

            div.querySelector('.view-btn').addEventListener('click', () => loadHistory(item.id));
            div.querySelector('.delete-btn').addEventListener('click', () => deleteHistory(item.id));

            historyList.appendChild(div);
        });
    }

    function loadHistory(id) {
        const record = history.find(i => i.id === id);
        if (!record) return;

        const d = record.data;

        // Populate inputs
        usdInput.value = d.usd || '';
        purityInput.value = d.purity || '';
        goldWeightInput.value = d.goldWeight || '';

        // Restore diamond with suffix if saved, else formatted
        if (record.data.diamondDisplay) {
            diamondWeightInput.value = record.data.diamondDisplay;
        } else {
            diamondWeightInput.value = d.diamondWeight || '';
        }

        diamondCostInput.value = d.diamondCostPerCarat || '';
        stoneCostInput.value = d.stoneCost || '';
        otherCostInput.value = d.otherCost || '';
        makingCostInput.value = d.makingCost || '';
        customMarginInput.value = d.customMargin || '';
        document.getElementById('ref-input').value = d.refNumber || ''; // Restore Ref
        document.getElementById('gold-unit').value = d.goldUnit || 'g'; // Restore Gold Unit
        document.getElementById('stone-details').value = d.stoneDetails || '';
        document.getElementById('other-details').value = d.otherDetails || '';
        document.getElementById('other-name').value = d.otherName || 'Other'; // Restore Other Name
        document.getElementById('making-details').value = d.makingDetails || '';

        // Trigger Calc
        calculateAll();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // --- Share Logic ---
    // --- Share Logic ---
    async function shareResult() {
        console.log("Share button clicked");
        const shareBtnIcon = shareBtn.querySelector('i');
        const originalIcon = shareBtnIcon.className;

        try {
            // Feedback
            shareBtnIcon.className = "fa-solid fa-spinner fa-spin";
            shareBtn.childNodes[1].textContent = " Generating...";

            // 1. Prepare Data & Time
            const date = new Date();
            const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
            const timeStr = date.toLocaleTimeString('en-US', { timeZone: "Asia/Dubai", hour: '2-digit', minute: '2-digit', hour12: true });
            document.getElementById('share-time').textContent = `${dateStr} | ${timeStr}`;

            // 2. Populate Rate Conversion
            document.getElementById('ex-usd').textContent = usdInput.value || "-";
            document.getElementById('ex-purity').textContent = purityInput.value || "-";
            document.getElementById('ex-rate').textContent = baseRateDisplay.textContent;

            // 3. Populate Cost Analysis
            const gUnit = document.getElementById('gold-unit').value || '';
            const gWt = goldWeightInput.value || '';
            document.getElementById('ex-gold-wt').textContent = gWt ? (gWt + ' ' + gUnit) : "-";
            document.getElementById('ex-gold-cost').textContent = goldCostDisplay.textContent;

            document.getElementById('ex-diamond-wt').textContent = diamondWeightInput.value || "-";
            document.getElementById('ex-diamond-cost').textContent = diamondCostInput.value || "-";

            document.getElementById('ex-stone-details').textContent = document.getElementById('stone-details').value || '';
            document.getElementById('ex-stone-cost').textContent = stoneCostInput.value || "-";

            const otherNameVal = document.getElementById('other-name').value || 'OTHER';
            document.getElementById('ex-other-name').textContent = otherNameVal.toUpperCase();
            document.getElementById('ex-other-details').textContent = document.getElementById('other-details').value || '';
            document.getElementById('ex-other-cost').textContent = otherCostInput.value || "-";

            document.getElementById('ex-making-details').textContent = document.getElementById('making-details').value || '';
            document.getElementById('ex-making-cost').textContent = makingCostInput.value || "-";

            // Dynamic Items Export
            const exCostBody = document.querySelector('.cost-table-compact tbody');
            const exTotalRow = document.querySelector('.cost-table-compact .total-row-compact');

            // Clear previous dynamic rows in export
            if (exCostBody) {
                exCostBody.querySelectorAll('.ex-dynamic-row').forEach(r => r.remove());

                document.querySelectorAll('.dynamic-row').forEach(row => {
                    const name = row.querySelector('.dynamic-name').value || 'ITEM';
                    const details = row.querySelector('.dynamic-details').value || '';
                    const cost = row.querySelector('.dynamic-cost-input').value || '-';

                    const tr = document.createElement('tr');
                    tr.className = "ex-dynamic-row";
                    tr.innerHTML = `
                        <td style="text-align: center;">${name.toUpperCase()}</td>
                        <td style="text-align: center;">${details}</td>
                        <td style="text-align: center;">${cost}</td>
                    `;
                    exTotalRow ? exCostBody.insertBefore(tr, exTotalRow) : exCostBody.appendChild(tr);
                });
            }

            document.getElementById('ex-total-cost').textContent = totalCostDisplay.textContent;

            // 4. Populate Profit Table
            const profitBody = document.getElementById('ex-profit-body');
            profitBody.innerHTML = '';

            const createProfitRow = (margin, priceElId) => {
                const tr = document.createElement('tr');
                const pEl = document.getElementById(priceElId);
                const price = pEl ? pEl.textContent : "0.00";
                tr.innerHTML = `<td style="text-align: center;">${margin}%</td><td style="text-align: right;">${price}</td>`;
                profitBody.appendChild(tr);
            };

            createProfitRow(15, 'price-15');
            createProfitRow(20, 'price-20');
            createProfitRow(25, 'price-25');
            createProfitRow(30, 'price-30');
            createProfitRow(35, 'price-35');

            if (customMarginInput.value) {
                const tr = document.createElement('tr');
                const price = document.getElementById('price-custom').textContent;
                tr.innerHTML = `<td style="text-align: center;">${customMarginInput.value}%</td><td style="text-align: right;">${price}</td>`;
                profitBody.appendChild(tr);
            }

            // 5. Image & Reference
            const imgContent = document.getElementById('image-preview');
            const shareImgContainer = document.getElementById('share-image-container');
            const refOutput = document.getElementById('ex-ref-no');
            const refInput = document.getElementById('ref-input');

            shareImgContainer.innerHTML = '';
            if (imgContent && !imgContent.classList.contains('hidden') && imgContent.src) {
                const imgClone = imgContent.cloneNode(true);
                shareImgContainer.appendChild(imgClone);
            } else {
                shareImgContainer.innerHTML = '<span style="color:#ccc; font-size:0.8rem;">No Image</span>';
            }

            // Reference Logic
            if (refInput && refInput.value.trim()) {
                refOutput.textContent = "Ref: " + refInput.value;
                refOutput.style.display = 'block';
            } else {
                refOutput.style.display = 'none';
            }

            // 6. Notes
            const noteInput = document.getElementById('note-input');
            const noteOutput = document.getElementById('ex-note-content');
            if (noteInput && noteInput.value.trim()) {
                noteOutput.textContent = noteInput.value;
                noteOutput.style.display = 'block';
            } else {
                noteOutput.textContent = 'No notes provided.';
                noteOutput.style.color = '#777';
                noteOutput.style.padding = '5px';
            }

            // 7. Capture (Seamless)
            const container = document.getElementById('share-export-container');

            const canvas = await html2canvas(container, {
                scale: 3, // Increased scale for HD (approx 2400px width)
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: 800,
                windowWidth: 800,
                onclone: (clonedDoc) => {
                    const clonedContainer = clonedDoc.getElementById('share-export-container');
                    if (clonedContainer) {
                        clonedContainer.style.left = "0px";
                        clonedContainer.style.top = "0px";
                        clonedContainer.style.visibility = "visible";
                    }
                }
            });

            // 7. Download
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            link.download = `Quotation_${timestamp}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 1.0); // Max quality
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Restore Button
            shareBtnIcon.className = originalIcon;
            shareBtn.childNodes[1].textContent = " Download Result (JPG)";

        } catch (err) {
            console.error("Export Error:", err);
            alert('Failed to generate image. Please check console.');
            shareBtnIcon.className = originalIcon;
            shareBtn.childNodes[1].textContent = " Download Result (JPG)";
        }
    }

    saveBtn.addEventListener('click', saveHistory);
    shareBtn.addEventListener('click', shareResult);

    // Init History
    renderHistory();

    // --- Init ---
    // fetchRate(); // Disabled for verification
    const rateStatus = document.getElementById('rate-status');
    if (rateStatus) rateStatus.textContent = "AED: 3.6700 (Fixed)";

    const liveDot = document.getElementById('live-dot');
    if (liveDot) liveDot.style.backgroundColor = 'var(--text-secondary)';

    // --- Dynamic Items ---
    const addItemBtn = document.getElementById('add-item-btn');
    const addItemRow = document.getElementById('add-item-row');

    if (addItemBtn) {
        addItemBtn.addEventListener('click', () => {
            const tr = document.createElement('tr');
            tr.className = "dynamic-row";
            tr.innerHTML = `
                <td><div class="table-input"><input type="text" class="dynamic-name" placeholder="Item Name"></div></td>
                <td><div class="table-input"><input type="text" class="dynamic-details" placeholder="-"></div></td>
                <td>
                    <div class="table-input" style="display:flex; align-items:center;">
                        <input type="number" class="dynamic-cost-input" placeholder="0.00" style="width: 80px;">
                        <button class="delete-item-btn" style="background:none; border:none; color:#ef4444; cursor:pointer; margin-left:5px; font-size:1rem;">&times;</button>
                    </div>
                </td>
            `;

            // Delete Logic
            tr.querySelector('.delete-item-btn').addEventListener('click', () => {
                tr.remove();
                calculateAll();
            });

            // Input Logic
            tr.querySelectorAll('input').forEach(input => {
                input.addEventListener('input', calculateAll);
            });

            addItemRow.parentNode.insertBefore(tr, addItemRow);
        });
    }

    // Initial Calc
    calculateAll();
});
