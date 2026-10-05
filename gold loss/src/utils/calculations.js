/**
 * Calculations helper for 5-column ledger:
 * Date, Narration, Debit, Credit, Balance
 *
 * Formula:
 * Debit is addition / positive (+ Debit) [Green]
 * Credit is deduction / negative (- Credit) [Red]
 * Row 1: Debit - Credit
 * Row n: Previous Balance + Debit - Credit
 */

export const parseNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
};

export const formatCurrency = (val, currency = '', decimals = 2) => {
  const prefix = currency ? `${currency} ` : '';
  if (val === null || val === undefined || isNaN(val)) return `${prefix}0.00`;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num)) return `${prefix}0.00`;
  const formatted = Math.abs(num).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (num > 0) return `${prefix}${formatted}`;
  if (num < 0) return `-${prefix}${formatted}`;
  return `${prefix}${formatted}`;
};

export const formatNumber = (val, decimals = 2) => {
  if (val === null || val === undefined || val === '') return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatSignedBalance = (val, decimals = 2, showPlus = false) => {
  if (val === null || val === undefined || val === '') return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num) || Math.abs(num) < 0.000001) return (0).toFixed(decimals);
  const formatted = Math.abs(num).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return num > 0 ? (showPlus ? `+${formatted}` : formatted) : `-${formatted}`;
};

/**
 * Calculates cumulative balances for an array of rows
 * @param {Array} rows - List of row objects { id, date, narration, debit, credit }
 * @returns {Array} rows with computed `balance` and numeric values
 */
export const computeLedgerBalances = (rows = []) => {
  let runningBalance = 0;

  return rows.map((row, index) => {
    const debitNum = parseNumber(row.debit);
    const creditNum = parseNumber(row.credit);
    const hasEntry = (row.debit !== '' && row.debit !== undefined && row.debit !== null) ||
                     (row.credit !== '' && row.credit !== undefined && row.credit !== null) ||
                     Boolean(row.narration?.trim()) ||
                     Boolean(row.date);

    // Cumulative balance formula:
    // Debit is positive (+), Credit is negative (-)
    // Balance = Previous Balance + Debit - Credit
    runningBalance = runningBalance + debitNum - creditNum;

    return {
      ...row,
      rowIndex: index + 1,
      debitNum,
      creditNum,
      balance: runningBalance,
      hasEntry,
    };
  });
};

/**
 * Compute totals for a tab dataset
 */
export const computeTabTotals = (computedRows = []) => {
  let totalDebit = 0;
  let totalCredit = 0;
  let filledRowsCount = 0;

  computedRows.forEach((row) => {
    totalDebit += row.debitNum || 0;
    totalCredit += row.creditNum || 0;
    if (row.hasEntry) {
      filledRowsCount++;
    }
  });

  const finalBalance = totalDebit - totalCredit;

  return {
    totalDebit,
    totalCredit,
    finalBalance,
    filledRowsCount,
    totalRows: computedRows.length,
  };
};

/**
 * Generate default empty rows (20 rows)
 */
export const generateDefaultRows = (count = 20) => {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: `row_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 6)}`,
      date: '',
      narration: '',
      debit: '',
      credit: '',
    });
  }
  return rows;
};

/**
 * Clean initial rows for polishing without any transaction tracking descriptions
 */
export const getPolishingInitialRows = () => generateDefaultRows(20);
