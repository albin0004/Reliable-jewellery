import * as XLSX from 'xlsx';
import { computeLedgerBalances, computeTabTotals } from '../utils/calculations';

/**
 * Builds standard worksheet data array for a ledger
 */
const buildLedgerSheetData = (tabName, rows = [], precision = 3) => {
  const computedRows = computeLedgerBalances(rows);
  const totals = computeTabTotals(computedRows);

  const sheetData = [];

  // Title Block
  sheetData.push([`${tabName.toUpperCase()} - LEDGER STATEMENT`]);
  sheetData.push([`Exported on: ${new Date().toLocaleString()}`]);
  sheetData.push([]); // blank line

  // Column Headers
  sheetData.push(['#', 'Date', 'Narration', 'Debit', 'Credit (-)', 'Balance']);

  // Data Rows
  computedRows.forEach((row, idx) => {
    // Only export non-empty rows or initial rows
    const debitVal = row.debit !== '' && row.debit !== undefined ? Number(row.debit) : '';
    const creditVal = row.credit !== '' && row.credit !== undefined ? Number(row.credit) : '';
    const balanceVal = row.hasEntry || idx === 0 ? Number(row.balance.toFixed(precision)) : '';

    sheetData.push([
      idx + 1,
      row.date || '',
      row.narration || '',
      debitVal,
      creditVal,
      balanceVal,
    ]);
  });

  // Summary Footer
  sheetData.push([]); // blank line
  sheetData.push([
    '',
    'TOTALS',
    `Active Records: ${totals.filledRowsCount} / ${totals.totalRows}`,
    Number(totals.totalDebit.toFixed(precision)),
    Number(totals.totalCredit.toFixed(precision)),
    Number(totals.finalBalance.toFixed(precision)),
  ]);

  return { sheetData, totals };
};

/**
 * Export a single tab to an Excel .xlsx workbook
 */
export const exportSingleTabToExcel = (tab, rows, precision = 3) => {
  const tabName = tab.name || tab.defaultName || 'Ledger';
  const { sheetData } = buildLedgerSheetData(tabName, rows, precision);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths
  ws['!cols'] = [
    { wch: 6 },  // #
    { wch: 14 }, // Date
    { wch: 38 }, // Narration
    { wch: 16 }, // Debit
    { wch: 16 }, // Credit
    { wch: 18 }, // Balance
  ];

  // Clean sheet name (max 31 chars, no invalid characters)
  const cleanSheetName = tabName.replace(/[:\\/?*[\]]/g, '').substring(0, 31) || 'Sheet1';
  XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);

  const filename = `${tabName.replace(/\s+/g, '_')}_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
};

/**
 * Export all tabs into a single Excel workbook with Sheet 1 and Sheet 2
 */
export const exportAllTabsToExcel = (tabs, tabRowsMap, precision = 3) => {
  const wb = XLSX.utils.book_new();

  tabs.forEach((tab, index) => {
    const tabName = tab.name || tab.defaultName || `Sheet ${index + 1}`;
    const rows = tabRowsMap[tab.id] || [];
    const { sheetData } = buildLedgerSheetData(tabName, rows, precision);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    ws['!cols'] = [
      { wch: 6 },  // #
      { wch: 14 }, // Date
      { wch: 38 }, // Narration
      { wch: 16 }, // Debit
      { wch: 16 }, // Credit
      { wch: 18 }, // Balance
    ];

    const cleanSheetName = tabName.replace(/[:\\/?*[\]]/g, '').substring(0, 31) || `Sheet${index + 1}`;
    XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);
  });

  const filename = `Jewellery_Ledger_All_Sheets_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
};
