import React, { useState, useRef, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Download,
  FileSpreadsheet,
  Layers,
  Printer,
  Calendar,
  FileText,
  MinusCircle,
  PlusCircle,
  Scale,
  X,
} from 'lucide-react';
import { computeLedgerBalances, computeTabTotals, formatNumber } from '../utils/calculations.js';
import { exportSingleTabToExcel, exportAllTabsToExcel } from '../services/excelExport.js';

function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y.slice(-2)}`;
  }
  return dateStr;
}

export default function SharedMobileViewer({
  tabs,
  activeTabId,
  setActiveTabId,
  activeTab,
  tabRows,
  activeRows,
  searchQuery,
  setSearchQuery,
  decimalPrecision,
}) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute live balances
  const computedRows = computeLedgerBalances(activeRows);
  const totals = computeTabTotals(computedRows);

  // Search filtering
  const displayRows = searchQuery.trim()
    ? computedRows.filter(
        (r) =>
          r.narration?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.date?.includes(searchQuery) ||
          String(r.debit).includes(searchQuery) ||
          String(r.credit).includes(searchQuery)
      )
    : computedRows;

  const activeTabName = activeTab.name || activeTab.defaultName || 'Ledger';

  const handleExportCurrent = () => {
    setShowExportMenu(false);
    exportSingleTabToExcel(activeTab, tabRows[activeTab.id] || [], decimalPrecision);
  };

  const handleExportAll = () => {
    setShowExportMenu(false);
    exportAllTabsToExcel(tabs, tabRows, decimalPrecision);
  };

  const handlePrint = () => {
    setShowExportMenu(false);
    window.print();
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-[#f3f6fb] text-slate-800 flex flex-col font-sans overflow-hidden p-2 sm:p-4 select-none">
      {/* 1. Header: Logo, Title, Live Badge, Search & Export */}
      <header className="shrink-0 flex items-center justify-between gap-2 pb-1.5">
        {!showSearch ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#1b253b] text-white flex items-center justify-center shadow-xs shrink-0">
              <BookOpen className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none m-0">
                  Reliable Jewellery
                </h1>
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-md text-[10px] font-bold shadow-2xs">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span>Live</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 font-semibold tracking-wide m-0 mt-0.5">
                Gold Loss
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 w-full bg-white border border-blue-500 rounded-lg px-2.5 py-1 shadow-xs">
            <Search className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search narration, amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs text-slate-800 outline-none bg-transparent"
            />
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
              className="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Action Buttons */}
        {!showSearch && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowSearch(true)}
              title="Search records"
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-2xs cursor-pointer relative"
            >
              <Search className="w-4 h-4" />
              {searchQuery && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-600" />
              )}
            </button>

            {/* Export Dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export or Print"
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 shadow-2xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 z-50 text-slate-700 text-xs">
                  <button
                    onClick={handleExportCurrent}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 text-slate-700 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Export {activeTabName} (.xlsx)</span>
                  </button>
                  <button
                    onClick={handleExportAll}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 text-slate-700 cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Export All Categories</span>
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    onClick={handlePrint}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 text-slate-600 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-slate-500" />
                    <span>Print Ledger</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* 2. Two Tabs Displayed Side-by-Side (Single Screen Fit, Zero Horizontal Scroll) */}
      <div className="shrink-0 mb-1.5">
        <div
          className={`w-full ${
            tabs.length === 2 ? 'grid grid-cols-2 gap-1' : 'flex items-center gap-1 overflow-x-auto pb-0.5'
          } bg-slate-200/80 p-0.5 rounded-xl`}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isActive
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 bg-transparent'
                }`}
              >
                <span className="truncate">{tab.name || tab.defaultName}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Main 5-Column Ledger Card */}
      <main className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-slate-200/90 shadow-xs p-2 sm:p-3 overflow-hidden">
        {/* Card Header: Category & Balance Box */}
        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight m-0 truncate">
              {activeTabName} Ledger
            </h2>
            <span className="text-[10px] text-slate-400 font-medium">
              ({displayRows.length})
            </span>
          </div>

          {/* Current Balance Box */}
          <div
            className={`flex items-center gap-1 border rounded-lg px-2 py-0.5 shrink-0 font-mono ${
              totals.finalBalance > 0.000001
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : totals.finalBalance < -0.000001
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}
          >
            <span className="text-[10px] font-bold uppercase">Bal:</span>
            <span className="text-xs font-extrabold">
              {totals.finalBalance > 0.000001
                ? formatNumber(totals.finalBalance, 2)
                : totals.finalBalance < -0.000001
                ? `-${formatNumber(Math.abs(totals.finalBalance), 2)}`
                : '0.00'}
            </span>
          </div>
        </div>

        {/* Table: All 5 Columns visible, zero horizontal scroll, internal vertical scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden border border-slate-200/80 rounded-lg my-1.5 scrollbar-thin">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] font-semibold select-none shadow-2xs">
              <tr>
                <th className="w-[20%] py-1.5 px-1 sm:px-2">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                    <span>Date</span>
                  </div>
                </th>
                <th className="w-[32%] py-1.5 px-1 sm:px-2">
                  <div className="flex items-center gap-1">
                    <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                    <span>Narration</span>
                  </div>
                </th>
                <th className="w-[16%] py-1.5 px-1 sm:px-2 text-right">
                  <div className="flex items-center justify-end gap-1 text-emerald-700 font-bold">
                    <PlusCircle className="w-3 h-3 text-emerald-500 shrink-0 hidden sm:inline" />
                    <span>Debit</span>
                  </div>
                </th>
                <th className="w-[16%] py-1.5 px-1 sm:px-2 text-right">
                  <div className="flex items-center justify-end gap-1 text-rose-700 font-bold">
                    <MinusCircle className="w-3 h-3 text-rose-500 shrink-0 hidden sm:inline" />
                    <span>Credit (-)</span>
                  </div>
                </th>
                <th className="w-[16%] py-1.5 px-1 sm:px-2 text-right">
                  <div className="flex items-center justify-end gap-1 text-slate-700 font-bold">
                    <Scale className="w-3 h-3 text-slate-600 shrink-0 hidden sm:inline" />
                    <span>Balance</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                    No transactions recorded.
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => (
                  <tr
                    key={row.id || row.rowIndex}
                    className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors"
                  >
                    {/* 1. Date */}
                    <td className="w-[20%] py-1 px-1 sm:px-2">
                      <span
                        className="block font-mono text-[10px] sm:text-xs text-slate-700 truncate"
                        title={row.date || ''}
                      >
                        {formatShortDate(row.date)}
                      </span>
                    </td>

                    {/* 2. Narration */}
                    <td className="w-[32%] py-1 px-1 sm:px-2">
                      <div
                        className="text-[10px] sm:text-xs text-slate-800 truncate"
                        title={row.narration || ''}
                      >
                        {row.narration || '—'}
                      </div>
                    </td>

                    {/* 3. Debit (Green, normal digits without plus sign) */}
                    <td className="w-[16%] py-1 px-1 sm:px-2 text-right">
                      <span
                        className="block font-mono text-[10px] sm:text-xs font-semibold text-emerald-600 truncate"
                        title={row.debit ? formatNumber(row.debit, 2) : ''}
                      >
                        {row.debit ? formatNumber(row.debit, 2) : '—'}
                      </span>
                    </td>

                    {/* 4. Credit (Red with - sign) */}
                    <td className="w-[16%] py-1 px-1 sm:px-2 text-right">
                      <span
                        className="block font-mono text-[10px] sm:text-xs font-semibold text-rose-600 truncate"
                        title={row.credit && Number(row.credit) !== 0 ? `-${formatNumber(row.credit, 2)}` : ''}
                      >
                        {row.credit && Number(row.credit) !== 0
                          ? `-${formatNumber(row.credit, 2)}`
                          : row.credit
                          ? formatNumber(row.credit, 2)
                          : '—'}
                      </span>
                    </td>

                    {/* 5. Balance (Dynamic sign & color, normal digits for positive) */}
                    <td className="w-[16%] py-1 px-1 sm:px-2 text-right">
                      <span
                        className={`block font-mono text-[10px] sm:text-xs font-bold truncate ${
                          row.balance > 0.000001
                            ? 'text-emerald-700'
                            : row.balance < -0.000001
                            ? 'text-rose-700'
                            : 'text-slate-800'
                        }`}
                        title={formatNumber(row.balance, 2)}
                      >
                        {row.balance > 0.000001
                          ? formatNumber(row.balance, 2)
                          : row.balance < -0.000001
                          ? `-${formatNumber(Math.abs(row.balance), 2)}`
                          : '0.00'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Card Footer: Real-time sync status and totals */}
        <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-semibold">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span>Real-time Synced</span>
          </div>

          {/* Totals Summary */}
          <div className="flex items-center gap-1.5 sm:gap-4 font-mono text-[10px] sm:text-xs">
            <div className="text-right">
              <span className="text-slate-400 mr-0.5">Dr:</span>
              <span className="font-bold text-emerald-600">
                {formatNumber(totals.totalDebit, 2)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 mr-0.5">Cr:</span>
              <span className="font-bold text-rose-600">
                -{formatNumber(totals.totalCredit, 2)}
              </span>
            </div>
            <div
              className={`border rounded px-1.5 py-0.5 text-center font-bold ${
                totals.finalBalance > 0.000001
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : totals.finalBalance < -0.000001
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-[#f0f6fe] border-blue-100 text-[#1d4ed8]'
              }`}
            >
              <span>
                {totals.finalBalance > 0.000001
                  ? formatNumber(totals.finalBalance, 2)
                  : totals.finalBalance < -0.000001
                  ? `-${formatNumber(Math.abs(totals.finalBalance), 2)}`
                  : '0.00'}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
