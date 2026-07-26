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
    ROWS_DATA: 'narration_reconciliation_rows_v4',
    PHYSICAL_STOCK: 'narration_physical_stock_v4',
    REFERENCE_NO: 'narration_reference_no_v4',
    DOC_DATE: 'narration_doc_date_v4'
  };

  // --- Toast Notifications ---
  function showToast(msg) {
    toastMessage.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }

  // --- Dynamic Table Logic ---

  // Helper to format numbers to 2 decimal places
  function formatNumber(num) {
    return Number(num).toFixed(2);
  }

  // Get data object from all table rows
  function getTableData() {
    const rows = tableBody.querySelectorAll('tr');
    const data = [];
    rows.forEach(row => {
      const narration = row.querySelector('.col-narration').value;
      const c1 = row.querySelector('.col-1').value;
      const c2 = row.querySelector('.col-2').value;
      const c3 = row.querySelector('.col-3').value;
      data.push({ narration, c1, c2, c3 });
    });
    return data;
  }

  // Calculate and update the whole board
  function calculateReconciliation() {
    const rows = tableBody.querySelectorAll('tr');
    let totalCol4 = 0;

    rows.forEach(row => {
      const c1 = parseFloat(row.querySelector('.col-1').value) || 0;
      const c2 = parseFloat(row.querySelector('.col-2').value) || 0;
      const c3 = parseFloat(row.querySelector('.col-3').value) || 0;

      // Col 4 = Col 3 - Col 1 - Col 2
      const col4Val = c3 - c1 - c2;
      totalCol4 += col4Val;

      const col4Element = row.querySelector('.col-4-display');
      col4Element.textContent = col4Val === 0 ? '' : formatNumber(col4Val);

      // Color coding for Column 4
      col4Element.classList.remove('positive', 'negative');
      if (col4Val > 0) {
        col4Element.classList.add('positive');
      } else if (col4Val < 0) {
        col4Element.classList.add('negative');
      }
    });

    // Update Summary Footer
    onHandStockVal.textContent = totalCol4 === 0 ? '' : formatNumber(totalCol4);

    const physicalStock = parseFloat(physicalStockInput.value) || 0;
    
    // Difference = Physical Stock - On Hand Stock
    const difference = physicalStock - totalCol4;
    differenceVal.textContent = difference === 0 ? '' : formatNumber(difference);

    // Color coding for Difference
    differenceVal.classList.remove('difference-positive', 'difference-negative');
    if (difference > 0) {
      differenceVal.classList.add('difference-positive');
    } else if (difference < 0) {
      differenceVal.classList.add('difference-negative');
    }

    // Save state to localStorage
    const tableData = getTableData();
    localStorage.setItem(STORAGE_KEYS.ROWS_DATA, JSON.stringify(tableData));
    localStorage.setItem(STORAGE_KEYS.PHYSICAL_STOCK, physicalStockInput.value);
    localStorage.setItem(STORAGE_KEYS.REFERENCE_NO, referenceInput.value);
    localStorage.setItem(STORAGE_KEYS.DOC_DATE, docDateInput.value);
  }

  // Adjust all narration textarea heights dynamically
  function adjustAllTextareaHeights() {
    const textareas = tableBody.querySelectorAll('.col-narration');
    textareas.forEach(textarea => {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    });
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
    
    tr.innerHTML = `
      <td class="row-num-cell" data-label="NUMBER"></td>
      <td data-label="NARRATION">
        <textarea class="cell-textarea col-narration" placeholder="" rows="1">${data.narration || ''}</textarea>
      </td>
      <td data-label="1">
        <input type="number" class="cell-input col-1" step="any" placeholder="" value="${data.c1 || ''}">
      </td>
      <td data-label="2">
        <input type="number" class="cell-input col-2" step="any" placeholder="" value="${data.c2 || ''}">
      </td>
      <td data-label="3">
        <input type="number" class="cell-input col-3" step="any" placeholder="" value="${data.c3 || ''}">
      </td>
      <td class="computed-cell col-4-display" data-label="4"></td>
      <td class="no-capture-cell" style="text-align: center;" data-html2canvas-ignore="true">
        <button class="delete-row-btn" title="Delete Row">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    `;

    // Event listeners for automatic recalculation on input changes
    const inputs = tr.querySelectorAll('.cell-input, .cell-textarea');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        if (input.classList.contains('col-narration')) {
          input.style.height = 'auto';
          input.style.height = input.scrollHeight + 'px';
        }
        calculateReconciliation();
      });
    });

    // Delete row event
    tr.querySelector('.delete-row-btn').addEventListener('click', () => {
      tr.remove();
      updateRowIndices();
      calculateReconciliation();
      showToast('Row deleted.');
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

  // Reset Table button handler
  resetTableBtn.addEventListener('click', () => {
    tableBody.innerHTML = '';
    physicalStockInput.value = '';
    referenceInput.value = '';
    docDateInput.value = '';
    
    // Initialize with 5 empty rows
    for (let i = 0; i < 5; i++) {
      createRowElement();
    }
    updateRowIndices();
    calculateReconciliation();
    adjustAllTextareaHeights();
    showToast('Table reset.');
  });

  // Event listener for inputs outside the table
  physicalStockInput.addEventListener('input', calculateReconciliation);
  referenceInput.addEventListener('input', calculateReconciliation);
  docDateInput.addEventListener('input', calculateReconciliation);

  // --- Initial Page Load & Recovery ---
  function init() {
    const savedRowsJson = localStorage.getItem(STORAGE_KEYS.ROWS_DATA);
    const savedPhysicalStock = localStorage.getItem(STORAGE_KEYS.PHYSICAL_STOCK);
    const savedRefNo = localStorage.getItem(STORAGE_KEYS.REFERENCE_NO);
    const savedDocDate = localStorage.getItem(STORAGE_KEYS.DOC_DATE);

    if (savedPhysicalStock !== null) {
      physicalStockInput.value = savedPhysicalStock;
    }
    if (savedRefNo !== null) {
      referenceInput.value = savedRefNo;
    }
    if (savedDocDate !== null) {
      docDateInput.value = savedDocDate;
    } else {
      // Set to today's date by default if no saved date
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
    calculateReconciliation();
    adjustAllTextareaHeights();
  }

  // --- Header Download Image Button (Captures full unclipped dimensions) ---
  headerDownloadBtn.addEventListener('click', () => {
    showToast('Generating full report image...');

    adjustAllTextareaHeights();

    const captureArea = document.getElementById('mainCaptureArea');
    const tableResponsive = document.querySelector('.table-responsive');
    const computedBg = window.getComputedStyle(document.body).backgroundColor || '#fdf5f0';

    // Save current scroll position
    const originalScrollLeft = tableResponsive ? tableResponsive.scrollLeft : 0;

    // Temporarily add capture class to expand layout and remove viewport constraints
    document.body.classList.add('is-exporting-image');

    // Measure unclipped export dimensions tightly around card
    const exportWidth = 780;
    const cardElement = captureArea.querySelector('.table-card');
    const exportHeight = (cardElement ? cardElement.offsetHeight : captureArea.offsetHeight) + 20;

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
        windowHeight: exportHeight
      }).then(canvas => {
        const imageUri = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `NARRATION_Stock_Report_${Date.now()}.png`;
        link.href = imageUri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('Report image downloaded successfully!');
      }).catch(err => {
        console.error('Image capture failed:', err);
        showToast('Image export failed.');
      }).finally(() => {
        // Clean up temporary capture expansion styles
        document.body.classList.remove('is-exporting-image');
        if (tableResponsive) {
          tableResponsive.scrollLeft = originalScrollLeft;
        }
      });
    } else {
      document.body.classList.remove('is-exporting-image');
      showToast('Export library not loaded.');
    }
  });

  // Start the application
  init();

});
