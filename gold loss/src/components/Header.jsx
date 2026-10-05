import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  Search, 
  Settings, 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Download, 
  FileSpreadsheet, 
  Layers, 
  Printer,
  Share2,
  Eye,
  X,
} from 'lucide-react';
import { exportSingleTabToExcel, exportAllTabsToExcel } from '../services/excelExport.js';

export default function Header({
  activeTab,
  tabs,
  tabRows,
  syncStatus,
  firebaseConnected,
  offlineQueueCount = 0,
  onOpenSettingsModal,
  onOpenShareModal,
  isReadOnlyViewer = false,
  searchQuery,
  setSearchQuery,
  decimalPrecision,
}) {
  const [showExportMenu, setShowExportMenu] = useState(false);
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
    <header className="w-full bg-transparent pt-4 pb-2 px-4 sm:px-8 max-w-[1400px] mx-auto no-print">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: App Logo & Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1b253b] text-white flex items-center justify-center shadow-xs shrink-0">
            <BookOpen className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none m-0">
              Reliable Jewellery
            </h1>
            <p className="text-xs text-slate-500 font-semibold tracking-wide m-0 mt-1">
              Gold Loss
            </p>
          </div>
        </div>

        {/* Right: Search, Export, Settings, Cloud Status */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search narration, amount, date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-44 sm:w-60 bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-slate-800 text-xs rounded-lg pl-8 pr-3 py-2 outline-none shadow-2xs transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Export Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              title="Export to Excel / Print"
              className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600 transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 z-50 text-slate-700">
                <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Excel Export (.xlsx)
                </div>
                <button
                  onClick={handleExportCurrent}
                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="font-semibold text-slate-800">Export Current Sheet</div>
                    <div className="text-[10px] text-slate-400">{activeTab.name || activeTab.defaultName}</div>
                  </div>
                </button>

                <button
                  onClick={handleExportAll}
                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="font-semibold text-slate-800">Export All Tabs (Sheets)</div>
                    <div className="text-[10px] text-slate-400">{tabs.length} categories</div>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-100" />

                <button
                  onClick={handlePrint}
                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="font-medium text-slate-700">Print Statement</div>
                    <div className="text-[10px] text-slate-400">Print or Save as PDF</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Live Read-Only Viewer Status Badge */}
          {isReadOnlyViewer ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-semibold shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Live Read-Only View</span>
              <span className="sm:hidden">Live View</span>
            </div>
          ) : (
            <>
              {/* Share Live Ledger Button (Owner) */}
              {onOpenShareModal && (
                <button
                  onClick={onOpenShareModal}
                  title="Share Real-Time Read-Only Ledger"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 text-blue-700 transition-colors shadow-2xs cursor-pointer text-xs font-bold"
                >
                  <Share2 className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Share Live</span>
                </button>
              )}

              {/* Settings Button (Owner) */}
              <button
                onClick={() => onOpenSettingsModal('tabs')}
                title="Settings & Tab Management"
                className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600 transition-colors shadow-2xs cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Cloud Sync / Connection Status Button (Owner) */}
              <button
                onClick={() => onOpenSettingsModal('database')}
                title={
                  offlineQueueCount > 0
                    ? `${offlineQueueCount} offline write(s) queued for sync`
                    : firebaseConnected
                    ? 'Firebase Real-time Connected (Click to configure)'
                    : 'Local Storage Mode (Click to configure cloud)'
                }
                className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600 transition-colors shadow-2xs relative cursor-pointer"
              >
                {syncStatus === 'syncing' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                ) : firebaseConnected ? (
                  <Cloud className="w-4 h-4 text-blue-600" />
                ) : (
                  <CloudOff className="w-4 h-4 text-slate-400" />
                )}
                <span
                  className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full border border-white ${
                    offlineQueueCount > 0
                      ? 'bg-amber-500 animate-ping'
                      : firebaseConnected
                      ? 'bg-emerald-500'
                      : 'bg-amber-400'
                  }`}
                />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
