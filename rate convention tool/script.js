document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration ---
    const API_URL = 'https://open.er-api.com/v6/latest/USD';
    const FALLBACK_AED_RATE = 3.6725;
    // Standard 8 Purities
    const FIXED_PURITIES = [0.75, 0.725, 0.7, 0.68, 0.675, 0.65, 0.6, 0.55];

    // --- State ---
    let currentAedRate = 3.67;
    let isLinkedPriceOverridden = false;   // For Cat 2
    let isLinkedPriceOverriddenC3 = false; // For Cat 3
    let lastCategory1Result = 0;

    // --- DOM Elements ---

    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Category 1: Rate Converter
    const usdInput = document.getElementById('usd-input');
    const ounceRateInput = document.getElementById('ounce-rate-input');
    const purityInput = document.getElementById('purity-input');
    const aedRateInput = document.getElementById('aed-rate');
    const refreshBtn = document.getElementById('refresh-rate-btn');
    const resultDisplay = document.getElementById('result-display');
    const liveStatusText = document.getElementById('live-status-text');
    const pulseDot = document.querySelector('.pulse-dot');

    // Category 2: Sales Analysis
    const c2GoldPriceInput = document.getElementById('c2-gold-price-input');
    const c2ItemWeight = document.getElementById('c2-item-weight');
    const c2MakingCost = document.getElementById('c2-making-cost');
    const c2GoldStone = document.getElementById('c2-gold-stone');
    const c2Purity = document.getElementById('c2-purity');
    const c2Notes = document.getElementById('c2-notes');
    const c2ShareBtn = document.getElementById('share-btn');
    const c2ImageInput = document.getElementById('file-input');
    const c2DropZone = document.getElementById('drop-zone');
    const c2ImagePreview = document.getElementById('image-preview');
    const c2RemoveImgBtn = document.getElementById('remove-image-btn');
    const c2UploadPlaceholder = document.getElementById('upload-placeholder');

    const c2ResPurePrice = document.getElementById('res-pure-price');
    const c2ResPureWeight = document.getElementById('res-pure-weight');
    const c2ResSaleAmount = document.getElementById('res-sale-amount');
    const c2ResCost = document.getElementById('res-cost');
    const c2ResProfit = document.getElementById('res-profit');
    const c2ResProfitPercent = document.getElementById('res-profit-percent');

    // Category 3: Purity Analysis
    const c3GoldPriceInput = document.getElementById('c3-gold-price-input');
    const c3ItemWeight = document.getElementById('c3-item-weight');
    const c3MakingCost = document.getElementById('c3-making-cost');
    const c3GoldStone = document.getElementById('c3-gold-stone');
    const c3ManualPurity = document.getElementById('c3-manual-purity'); // Optional
    const c3PurityResultsContainer = document.getElementById('purity-results-container');

    // Cat 3 Media
    const c3DropZone = document.getElementById('purity-drop-zone');
    const c3FileInput = document.getElementById('purity-file-input');
    const c3ImagePreview = document.getElementById('purity-image-preview');
    const c3PreviewContainer = document.getElementById('purity-image-preview-container');
    const c3RemoveImgBtn = document.getElementById('purity-remove-image');
    const c3UploadPlaceholder = document.getElementById('purity-upload-placeholder');
    const c3NoteInput = document.getElementById('purity-note-input');
    const c3DownloadBtn = document.getElementById('purity-download-btn');


    // --- Initialization ---
    initTabs();
    fetchLiveRate();

    // --- Event Listeners ---

    // Cat 1 Inputs
    [usdInput, ounceRateInput, purityInput].forEach(el => {
        if (el) el.addEventListener('input', calculateCategory1);
    });
    if (aedRateInput) {
        aedRateInput.addEventListener('input', () => {
            currentAedRate = parseFloat(aedRateInput.value) || 0;
            calculateCategory1();
        });
    }
    if (refreshBtn) refreshBtn.addEventListener('click', fetchLiveRate);

    // Cat 2 Inputs
    [c2ItemWeight, c2MakingCost, c2GoldStone, c2Purity].forEach(el => {
        if (el) el.addEventListener('input', calculateCategory2);
    });
    if (c2GoldPriceInput) {
        c2GoldPriceInput.addEventListener('input', () => {
            isLinkedPriceOverridden = true;
            const badge = document.getElementById('c2-manual-badge');
            if (badge) {
                badge.textContent = 'Manual';
                badge.style.color = 'var(--text-secondary)';
            }
            calculateCategory2();
        });
    }

    // Cat 3 Inputs
    [c3ItemWeight, c3MakingCost, c3GoldStone, c3ManualPurity].forEach(el => {
        if (el) el.addEventListener('input', calculateCategory3);
    });
    if (c3GoldPriceInput) {
        c3GoldPriceInput.addEventListener('input', () => {
            isLinkedPriceOverriddenC3 = true;
            const badge = document.getElementById('c3-manual-badge');
            if (badge) {
                badge.textContent = 'Manual';
                badge.style.color = 'var(--text-secondary)';
            }
            calculateCategory3();
        });
    }

    // Cat 2 Image
    setupImageUpload(c2DropZone, c2ImageInput, c2ImagePreview, c2UploadPlaceholder, c2RemoveImgBtn, document.getElementById('upload-placeholder'));

    // Cat 3 Image
    setupImageUpload(c3DropZone, c3FileInput, c3ImagePreview, null, c3RemoveImgBtn, c3UploadPlaceholder, c3PreviewContainer);

    // Downloads
    if (c2ShareBtn) c2ShareBtn.addEventListener('click', downloadSalesAnalysis);
    if (c3DownloadBtn) c3DownloadBtn.addEventListener('click', downloadPurityReceipt);


    // --- Functions ---

    function initTabs() {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const target = document.getElementById(btn.dataset.tab);
                if (target) target.classList.add('active');
            });
        });
    }

    async function fetchLiveRate() {
        if (liveStatusText) liveStatusText.textContent = 'Updating...';
        try {
            const response = await fetch(API_URL);
            const data = await response.json();
            if (data && data.rates && data.rates.AED) {
                currentAedRate = data.rates.AED;
                if (aedRateInput) aedRateInput.value = currentAedRate.toFixed(4);
                if (liveStatusText) liveStatusText.textContent = 'Live Rate Active';
                if (pulseDot) pulseDot.style.backgroundColor = 'var(--success-color)';
                calculateCategory1();
            } else {
                throw new Error('Invalid Data');
            }
        } catch (error) {
            console.error(error);
            if (liveStatusText) liveStatusText.textContent = 'Offline (Fixed Rate)';
            if (pulseDot) pulseDot.style.backgroundColor = '#ff3b30';
            currentAedRate = parseFloat(aedRateInput.value) || FALLBACK_AED_RATE;
        }
    }

    function calculateCategory1() {
        const usd = parseFloat(usdInput.value) || 0;
        const ounce = parseFloat(ounceRateInput.value) || 31.1;
        const purity = parseFloat(purityInput.value) || 0;

        let result = 0;
        if (ounce > 0) {
            result = (usd / ounce) * currentAedRate * purity;
        }

        lastCategory1Result = result;
        if (resultDisplay) resultDisplay.textContent = result.toFixed(4);

        updateLinkedPrice();
    }

    function updateLinkedPrice() {
        const price = lastCategory1Result.toFixed(4);

        if (!isLinkedPriceOverridden && c2GoldPriceInput) {
            c2GoldPriceInput.value = price;
            calculateCategory2();
        }

        if (!isLinkedPriceOverriddenC3 && c3GoldPriceInput) {
            c3GoldPriceInput.value = price;
            calculateCategory3();
        }
    }

    function calculateCategory2() {
        if (!c2GoldPriceInput) return;
        const goldPrice18k = parseFloat(c2GoldPriceInput.value);
        const itemWeight = parseFloat(c2ItemWeight.value);
        const makingCost = parseFloat(c2MakingCost.value);
        const goldStone = parseFloat(c2GoldStone.value);
        const purity = parseFloat(c2Purity.value);

        // Required Check
        if (isNaN(goldPrice18k) || isNaN(itemWeight) || isNaN(makingCost) || isNaN(goldStone) || isNaN(purity)) {
            resetCat2Results();
            return;
        }

        const pureWeight = goldStone * purity;
        const purePrice = goldPrice18k / 0.75; // Derived 24k
        const saleAmount = pureWeight * purePrice;
        const totalCost = (itemWeight * goldPrice18k) + makingCost;
        const profit = saleAmount - totalCost;

        let profitPercent = 0;
        if (saleAmount !== 0) profitPercent = (profit / saleAmount) * 100;

        // Display
        c2ResPurePrice.textContent = purePrice.toFixed(2);
        c2ResPureWeight.textContent = pureWeight.toFixed(3);
        c2ResSaleAmount.textContent = saleAmount.toFixed(2);
        c2ResCost.textContent = totalCost.toFixed(2);
        c2ResProfit.textContent = profit.toFixed(2);
        c2ResProfitPercent.textContent = profitPercent.toFixed(2) + '%';

        const color = profit >= 0 ? 'var(--success-color)' : '#ff3b30';
        c2ResProfit.style.color = color;
        c2ResProfitPercent.style.color = color;
    }

    function resetCat2Results() {
        c2ResPurePrice.textContent = "0.00";
        c2ResPureWeight.textContent = "0.000";
        c2ResSaleAmount.textContent = "0.00";
        c2ResCost.textContent = "0.00";
        c2ResProfit.textContent = "0.00";
        c2ResProfitPercent.textContent = "0.00%";
        c2ResProfit.style.color = '#fff';
        c2ResProfitPercent.style.color = '#fff';
    }

    function calculateCategory3() {
        if (!c3GoldPriceInput) return;
        const goldPrice18k = parseFloat(c3GoldPriceInput.value);
        const itemWeight = parseFloat(c3ItemWeight.value);
        const makingCost = parseFloat(c3MakingCost.value);
        const goldStone = parseFloat(c3GoldStone.value);
        const manualPurity = parseFloat(c3ManualPurity.value);

        c3PurityResultsContainer.innerHTML = '';

        if (isNaN(goldPrice18k) || isNaN(itemWeight) || isNaN(makingCost) || isNaN(goldStone)) {
            c3PurityResultsContainer.innerHTML = '<div class="purity-placeholder">Enter all item details to see analysis</div>';
            return;
        }

        const totalCost = (itemWeight * goldPrice18k) + makingCost;
        const purePrice = goldPrice18k / 0.75;

        let purities = [...FIXED_PURITIES];
        if (!isNaN(manualPurity) && manualPurity > 0) {
            if (!purities.includes(manualPurity)) {
                // Add manual purity to the top
                purities = [manualPurity, ...purities];
            }
        }

        purities.forEach(p => {
            const pureWeight = goldStone * p;
            const saleAmount = pureWeight * purePrice;
            const profit = saleAmount - totalCost;
            let profitPercent = 0;
            if (saleAmount !== 0) profitPercent = (profit / saleAmount) * 100;

            const isManual = (p === manualPurity);
            const profitColor = profit >= 0 ? 'var(--success-color)' : '#ff3b30';

            const card = document.createElement('div');
            card.className = 'purity-card';
            card.innerHTML = `
                <div class="purity-data-point main">
                    <span class="purity-point-label">Purity</span>
                    <span class="purity-point-value purity-id">
                        ${p} ${isManual && !FIXED_PURITIES.includes(p) ? '<i class="fa-solid fa-pen" style="font-size:0.7rem; opacity:0.6;"></i>' : ''}
                    </span>
                </div>
                <div class="purity-data-point">
                     <span class="purity-point-label">Pure Wt</span>
                     <span class="purity-point-value">${pureWeight.toFixed(3)}</span>
                </div>
                <div class="purity-data-point end">
                     <span class="purity-point-label">Profit %</span>
                     <span class="purity-point-value highlight" style="color:${profitColor}">${profitPercent.toFixed(2)}%</span>
                </div>
            `;
            c3PurityResultsContainer.appendChild(card);
        });
    }

    // --- Image Handling Helper ---
    function setupImageUpload(dropEl, inputEl, previewEl, placeholderEl, removeBtnEl, placeholder2, containerEl) {
        if (!dropEl) return;

        dropEl.addEventListener('click', () => inputEl.click());
        inputEl.addEventListener('change', (e) => {
            if (e.target.files[0]) handleFile(e.target.files[0], previewEl, placeholderEl, removeBtnEl, placeholder2, containerEl);
        });

        // Drag
        dropEl.addEventListener('dragover', (e) => { e.preventDefault(); dropEl.style.borderColor = 'var(--accent-gold)'; });
        dropEl.addEventListener('dragleave', (e) => { e.preventDefault(); dropEl.style.borderColor = ''; });
        dropEl.addEventListener('drop', (e) => {
            e.preventDefault();
            dropEl.style.borderColor = '';
            if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0], previewEl, placeholderEl, removeBtnEl, placeholder2, containerEl);
        });

        // Remove
        if (removeBtnEl) {
            removeBtnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                inputEl.value = '';
                previewEl.src = '';
                previewEl.classList.add('hidden');
                removeBtnEl.classList.add('hidden');
                if (placeholderEl) placeholderEl.classList.remove('hidden');
                if (placeholder2) placeholder2.classList.remove('hidden');
                if (containerEl) containerEl.classList.add('hidden');
            });
        }
    }

    function handleFile(file, preview, placeholder, removeBtn, placeholder2, container) {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            if (removeBtn) removeBtn.classList.remove('hidden');
            if (placeholder) placeholder.classList.add('hidden');
            if (placeholder2) placeholder2.classList.add('hidden');
            if (container) container.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }


    // --- Downloads ---

    async function downloadPurityReceipt() {
        const originalText = c3DownloadBtn.innerHTML;
        c3DownloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';

        try {
            // Setup Receipt
            const now = new Date();
            // Format: "Oct 24, 2023 | 10:30 AM"
            document.getElementById('receipt-date').textContent = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            document.getElementById('receipt-time').textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            // Image
            const recImg = document.getElementById('receipt-image-container');
            if (!c3ImagePreview.classList.contains('hidden') && c3ImagePreview.src) {
                // Use Object Fit Contain for the new box
                recImg.innerHTML = `<img src="${c3ImagePreview.src}">`;
                recImg.classList.remove('hidden');
            } else {
                recImg.classList.add('hidden');
                recImg.innerHTML = '';
            }

            // Results Table
            const recBody = document.getElementById('receipt-grid-body');
            recBody.innerHTML = '';
            const cards = c3PurityResultsContainer.querySelectorAll('.purity-card');

            if (cards.length === 0) {
                recBody.innerHTML = '<div style="padding:40px; text-align:center; font-size:1.5rem; color:#666;">No Calculation Data</div>';
            } else {
                cards.forEach(card => {
                    // Create Row
                    const row = document.createElement('div');
                    row.className = 'exp-row';

                    // Extract Data
                    const p = card.querySelector('.purity-id').innerText.trim();
                    const pw = card.querySelectorAll('.purity-point-value')[1].innerText.trim();
                    const prof = card.querySelectorAll('.purity-point-value')[2].innerText.trim();

                    // Determine Color (Green/Red)
                    // The inline style in card has the color, let's parse or re-evaluate
                    const rawProfitText = prof.replace('%', '');
                    const isPositive = parseFloat(rawProfitText) >= 0;
                    const profColor = isPositive ? '#4cd964' : '#ff3b30'; // IOS Green : IOS Red

                    row.innerHTML = `
                        <div class="col-purity">${p}</div>
                        <div class="col-weight">${pw}</div>
                        <div class="col-profit" style="color: ${profColor}">${prof}</div>
                    `;
                    recBody.appendChild(row);
                });
            }

            // Notes
            const noteVal = c3NoteInput.value.trim();
            const noteSec = document.getElementById('receipt-note-section');
            if (noteVal) {
                document.getElementById('receipt-note-text').textContent = noteVal;
                noteSec.classList.remove('hidden');
            } else {
                noteSec.classList.add('hidden');
            }

            // Capture
            const container = document.getElementById('purity-download-container');

            // Note: Container is 'fixed' and 'top: -9999px' in CSS.
            // We don't need to change display property if it wasn't 'none'.
            // In CSS I removed 'display: none', so it is always rendered but off-screen.
            // Just incase, let's make sure valid visibility.

            const canvas = await html2canvas(container, {
                scale: 2, // 2x Scaling for Ultra Sharp Text (High DPI)
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
            });

            // Save
            const link = document.createElement('a');
            link.download = `Reliable_Purity_${Date.now()}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 1.0); // Max Quality JPEG
            link.click();

        } catch (err) {
            console.error(err);
            alert('Error generating receipt');
        } finally {
            c3DownloadBtn.innerHTML = originalText;
        }
    }

    async function downloadSalesAnalysis() {
        if (!c2ShareBtn) return;
        const orgHTML = c2ShareBtn.innerHTML;
        c2ShareBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const container = document.getElementById('share-export-container');
            const now = new Date();

            // Populate
            document.getElementById('share-time').innerText = now.toLocaleString();
            document.getElementById('ex-weight').innerText = c2ItemWeight.value || '-';
            document.getElementById('ex-purity').innerText = c2Purity.value || '-';
            document.getElementById('ex-sale-amt').innerText = c2ResSaleAmount.innerText;
            document.getElementById('ex-cost').innerText = c2ResCost.innerText;
            document.getElementById('ex-profit').innerText = c2ResProfit.innerText;
            document.getElementById('ex-percent').innerText = c2ResProfitPercent.innerText;

            // Image
            const shareImgBox = document.getElementById('share-image-box');
            shareImgBox.innerHTML = '';
            if (c2ImagePreview && !c2ImagePreview.classList.contains('hidden') && c2ImagePreview.src) {
                const img = c2ImagePreview.cloneNode();
                img.style.maxHeight = '300px';
                img.style.borderRadius = '8px';
                shareImgBox.appendChild(img);
                shareImgBox.style.display = 'flex';
            } else {
                shareImgBox.style.display = 'none';
            }

            // Notes
            const noteBox = document.getElementById('share-notes');
            if (c2Notes && c2Notes.value.trim()) {
                document.getElementById('ex-notes-text').innerText = c2Notes.value;
                noteBox.style.display = 'block';
            } else {
                noteBox.style.display = 'none';
            }

            // Capture
            container.style.display = 'block';
            container.style.visibility = 'visible';
            // Important: Move it on screen or handle visibility
            container.style.position = 'absolute';
            container.style.left = '0';
            container.style.top = '0';
            container.style.zIndex = '-999';

            const canvas = await html2canvas(container, {
                scale: 3, // High DPI
                backgroundColor: '#050b0e', // Dark theme matching app
                useCORS: true,
                logging: false
            });

            container.style.display = 'none';

            const link = document.createElement('a');
            link.download = `Sales_Analysis_${Date.now()}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.95);
            link.click();

        } catch (err) {
            console.error(err);
            alert('Error generating sales image');
        } finally {
            c2ShareBtn.innerHTML = orgHTML;
        }
    }

});
