import React from 'react';
import LedgerRow from './LedgerRow.jsx';
import { 
  Calendar, 
  FileText, 
  MinusCircle, 
  PlusCircle, 
  Scale, 
  Plus 
} from 'lucide-react';
import { computeLedgerBalances, computeTabTotals, formatNumber } from '../utils/calculations.js';

export default function LedgerTable({
  tabId,
  tabName,
  rows,
  onUpdateField,
  onAddRows,
  onDeleteRow,
  searchQuery = '',
}) {
  // Compute live cumulative balances
  const computedRows = computeLedgerBalances(rows);
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

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-7 space-y-5">
      {/* 1. Main Card Header: Category Title & Current Balance Box */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight m-0">
            {tabName} Ledger
          </h2>
        </div>

        {/* Current Balance Box */}
        <div
          className={`border rounded-xl px-7 py-3 text-center self-start sm:self-auto min-w-[200px] transition-colors ${
            totals.finalBalance > 0.000001
              ? 'bg-emerald-50/80 border-emerald-200'
              : totals.finalBalance < -0.000001
              ? 'bg-rose-50/80 border-rose-200'
              : 'bg-[#f0f6fe] border-blue-100'
          }`}
        >
          <div
            className={`text-xs font-semibold uppercase tracking-wide ${
              totals.finalBalance > 0.000001
                ? 'text-emerald-700'
                : totals.finalBalance < -0.000001
                ? 'text-rose-700'
                : 'text-blue-600'
            }`}
          >
            Current Balance
          </div>
          <div
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5 ${
              totals.finalBalance > 0.000001
                ? 'text-emerald-700'
                : totals.finalBalance < -0.000001
                ? 'text-rose-700'
                : 'text-[#1d4ed8]'
            }`}
          >
            {totals.finalBalance > 0.000001
              ? formatNumber(totals.finalBalance, 2)
              : totals.finalBalance < -0.000001
              ? `-${formatNumber(Math.abs(totals.finalBalance), 2)}`
              : '0.00'}
          </div>
        </div>
      </div>

      {/* 2. Main 5-Column Ledger Table */}
      <div className="overflow-x-auto -mx-5 sm:mx-0">
        <table className="w-full text-left border-collapse table-fixed min-w-[760px]">
          <thead>
            <tr className="border-y border-slate-200/80 bg-slate-50/50 text-slate-700 text-xs font-semibold select-none">
              <th className="py-2.5 px-2 text-center w-10 text-slate-500">
                #
              </th>
              <th className="py-2.5 px-2 w-36 sm:w-40">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Date</span>
                </div>
              </th>
              <th className="py-2.5 px-2 min-w-[200px]">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Narration</span>
                </div>
              </th>
              <th className="py-2.5 px-2 text-right w-28 sm:w-36">
                <div className="flex items-center justify-end gap-1.5 text-emerald-700">
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500 text-white" />
                  <span className="font-bold">Debit</span>
                </div>
              </th>
              <th className="py-2.5 px-2 text-right w-28 sm:w-36">
                <div className="flex items-center justify-end gap-1.5 text-rose-700">
                  <MinusCircle className="w-3.5 h-3.5 text-rose-500 fill-rose-500 text-white" />
                  <span className="font-bold">Credit (-)</span>
                </div>
              </th>
              <th className="py-2.5 px-3 text-right w-32 sm:w-36">
                <div className="flex items-center justify-end gap-1.5 text-slate-700">
                  <Scale className="w-3.5 h-3.5 text-slate-600" />
                  <span>Balance</span>
                </div>
              </th>
              <th className="py-2.5 px-1.5 w-10 text-center"></th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                  No records found.
                </td>
              </tr>
            ) : (
              displayRows.map((row) => (
                <LedgerRow
                  key={row.id || row.rowIndex}
                  row={row}
                  index={row.rowIndex - 1}
                  tabId={tabId}
                  onUpdateField={onUpdateField}
                  onDeleteRow={onDeleteRow}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 3. Card Footer: + Add Row Button on Left, Totals on Right */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t border-slate-100 no-print">
        {/* + Add Row Button */}
        <div>
          <button
            onClick={() => onAddRows(tabId, 1)}
            className="flex items-center gap-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Row</span>
          </button>
        </div>

        {/* Totals Summary */}
        <div className="flex items-center gap-6 sm:gap-8 self-end md:self-auto flex-wrap">
          {/* Total Debit (Green, normal digits without plus sign) */}
          <div className="text-right">
            <div className="text-xs font-semibold text-emerald-700">
              Total Debit
            </div>
            <div className="text-sm sm:text-base font-bold text-emerald-600 font-mono mt-0.5">
              {formatNumber(totals.totalDebit, 2)}
            </div>
          </div>

          {/* Total Credit (Red with - sign) */}
          <div className="text-right">
            <div className="text-xs font-semibold text-rose-700">
              Total Credit (-)
            </div>
            <div className="text-sm sm:text-base font-bold text-rose-600 font-mono mt-0.5">
              -{formatNumber(totals.totalCredit, 2)}
            </div>
          </div>

          {/* Final Balance Box */}
          <div
            className={`border rounded-xl px-6 py-2 text-center min-w-[150px] transition-colors ${
              totals.finalBalance > 0.000001
                ? 'bg-emerald-50/80 border-emerald-200'
                : totals.finalBalance < -0.000001
                ? 'bg-rose-50/80 border-rose-200'
                : 'bg-[#f0f6fe] border-blue-100'
            }`}
          >
            <div
              className={`text-xs font-semibold uppercase tracking-wide ${
                totals.finalBalance > 0.000001
                  ? 'text-emerald-700'
                  : totals.finalBalance < -0.000001
                  ? 'text-rose-700'
                  : 'text-blue-600'
              }`}
            >
              Final Balance
            </div>
            <div
              className={`text-base sm:text-lg font-bold font-mono mt-0.5 ${
                totals.finalBalance > 0.000001
                  ? 'text-emerald-700'
                  : totals.finalBalance < -0.000001
                  ? 'text-rose-700'
                  : 'text-[#1d4ed8]'
              }`}
            >
              {totals.finalBalance > 0.000001
                ? formatNumber(totals.finalBalance, 2)
                : totals.finalBalance < -0.000001
                ? `-${formatNumber(Math.abs(totals.finalBalance), 2)}`
                : '0.00'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
