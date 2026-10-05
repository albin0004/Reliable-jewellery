import React from 'react';
import { Trash2 } from 'lucide-react';
import { formatNumber } from '../utils/calculations.js';

export default function LedgerRow({
  row,
  index,
  tabId,
  onUpdateField,
  onDeleteRow,
}) {
  const handleDebitChange = (e) => {
    let val = e.target.value;
    if (val.startsWith('+')) {
      val = val.substring(1);
    }
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      onUpdateField(tabId, index, 'debit', val);
    }
  };

  const handleCreditChange = (e) => {
    let val = e.target.value;
    if (val.startsWith('-')) {
      val = val.substring(1);
    }
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      onUpdateField(tabId, index, 'credit', val);
    }
  };

  const handleDateChange = (e) => {
    onUpdateField(tabId, index, 'date', e.target.value);
  };

  const handleNarrationChange = (e) => {
    onUpdateField(tabId, index, 'narration', e.target.value);
  };

  const hasDebit = row.debit !== '' && row.debit !== undefined && row.debit !== null && Number(row.debit) !== 0;
  const hasCredit = row.credit !== '' && row.credit !== undefined && row.credit !== null && Number(row.credit) !== 0;
  const isPositiveBalance = row.balance > 0.000001;
  const isNegativeBalance = row.balance < -0.000001;

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
      {/* 1. # Column */}
      <td className="py-1.5 px-2 text-center text-xs text-slate-500 font-mono w-10 select-none">
        {index + 1}
      </td>

      {/* 2. Date Column */}
      <td className="py-1 px-2 w-36 sm:w-40">
        <div className="relative flex items-center">
          <input
            type="date"
            value={row.date || ''}
            onChange={handleDateChange}
            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 font-mono outline-none transition-colors"
          />
        </div>
      </td>

      {/* 3. Narration Column */}
      <td className="py-1 px-2 min-w-[200px]">
        <input
          type="text"
          value={row.narration || ''}
          onChange={handleNarrationChange}
          placeholder="Narration"
          className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-slate-800 text-xs rounded-lg px-3 py-1.5 outline-none transition-colors placeholder:text-slate-400"
        />
      </td>

      {/* 4. Debit Column (Green, normal digits without plus sign) */}
      <td className="py-1 px-2 w-28 sm:w-36">
        <input
          type="text"
          inputMode="decimal"
          value={row.debit ?? ''}
          onChange={handleDebitChange}
          placeholder="0.00"
          className={`w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 text-xs rounded-lg px-3 py-1.5 font-mono text-right outline-none transition-colors placeholder:text-slate-400 ${
            hasDebit ? 'text-emerald-600 font-bold' : 'text-slate-800'
          }`}
        />
      </td>

      {/* 5. Credit Column (Red with - sign clearly indicated) */}
      <td className="py-1 px-2 w-28 sm:w-36">
        <div className="relative flex items-center">
          {hasCredit && (
            <span className="absolute left-2.5 text-xs font-bold text-rose-600 pointer-events-none select-none">
              -
            </span>
          )}
          <input
            type="text"
            inputMode="decimal"
            value={row.credit ?? ''}
            onChange={handleCreditChange}
            placeholder="0.00"
            className={`w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 text-xs rounded-lg pr-3 py-1.5 font-mono text-right outline-none transition-colors placeholder:text-slate-400 ${
              hasCredit ? 'text-rose-600 font-bold pl-6' : 'text-slate-800'
            }`}
          />
        </div>
      </td>

      {/* 6. Balance Column (Positive as normal digits without plus sign, negative clearly indicated) */}
      <td
        className={`py-1.5 px-3 w-32 sm:w-36 text-right font-mono text-xs font-bold select-all ${
          isPositiveBalance
            ? 'text-emerald-600'
            : isNegativeBalance
            ? 'text-rose-600'
            : 'text-slate-800'
        }`}
      >
        {isPositiveBalance
          ? formatNumber(row.balance, 2)
          : isNegativeBalance
          ? `-${formatNumber(Math.abs(row.balance), 2)}`
          : '0.00'}
      </td>

      {/* 7. Delete Action Column */}
      <td className="py-1 px-1.5 text-center w-10">
        <button
          onClick={() => onDeleteRow(tabId, index)}
          title="Delete row"
          className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
