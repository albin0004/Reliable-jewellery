import React, { useState } from 'react';
import Header from './components/Header.jsx';
import CategoryTabs from './components/CategoryTabs.jsx';
import LedgerTable from './components/LedgerTable.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import PasswordPromptModal from './components/PasswordPromptModal.jsx';
import ShareModal from './components/ShareModal.jsx';
import ViewerAuthModal from './components/ViewerAuthModal.jsx';
import SharedMobileViewer from './components/SharedMobileViewer.jsx';
import { useLedgerData } from './hooks/useLedgerData.js';

export default function App() {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    tabRows,
    activeRows,
    updateRow,
    addRows,
    deleteRowAt,
    renameTab,
    addNewTab,
    deleteTab,
    createManualBackup,
    restoreBackup,
    exportBackupFile,
    importBackupFromJson,
    decimalPrecision,
    syncStatus,
    firebaseConnected,
    offlineQueueCount,
    isReadOnlyViewer,
    shareMetadata,
    shareAuthStatus,
    authenticateSharePin,
  } = useLedgerData();

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('tabs');
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for direct tab deletion from CategoryTabs strip
  const [tabToDeleteDirect, setTabToDeleteDirect] = useState(null);
  const [isDirectPasswordModalOpen, setIsDirectPasswordModalOpen] = useState(false);

  const activeTabName = activeTab.name || activeTab.defaultName || 'Ledger';

  const handleOpenSettings = (initialSection = 'tabs') => {
    setSettingsInitialTab(initialSection);
    setIsSettingsModalOpen(true);
  };

  const handleDeleteTabRequestFromBar = (tab) => {
    setTabToDeleteDirect(tab);
    setIsDirectPasswordModalOpen(true);
  };

  const handleConfirmDirectDelete = async (tabId, password) => {
    const res = await deleteTab(tabId, password);
    if (!res.success) {
      throw new Error(res.error);
    }
  };

  // 1. DEDICATED MOBILE VIEW FOR THE REAL-TIME READ-ONLY SHARED LINK
  if (isReadOnlyViewer) {
    return (
      <>
        <SharedMobileViewer
          tabs={tabs}
          activeTabId={activeTabId}
          setActiveTabId={setActiveTabId}
          activeTab={activeTab}
          tabRows={tabRows}
          activeRows={activeRows}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          decimalPrecision={decimalPrecision}
        />

        {/* Viewer PIN Auth or Lockout Modal */}
        <ViewerAuthModal
          status={shareAuthStatus}
          shareMetadata={shareMetadata}
          onAuthenticatePin={authenticateSharePin}
        />
      </>
    );
  }

  // 2. MAIN WEBSITE / DESKTOP VIEW (RESTORED TO ORIGINAL LAYOUT & POSITION)
  return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-800 flex flex-col font-sans selection:bg-blue-500 selection:text-white pb-12">
      {/* Top Navbar */}
      <Header
        activeTab={activeTab}
        tabs={tabs}
        tabRows={tabRows}
        syncStatus={syncStatus}
        firebaseConnected={firebaseConnected}
        offlineQueueCount={offlineQueueCount}
        onOpenSettingsModal={handleOpenSettings}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        decimalPrecision={decimalPrecision}
      />

      {/* Category Tabs Strip */}
      <CategoryTabs
        tabs={tabs}
        activeTabId={activeTabId}
        setActiveTabId={setActiveTabId}
        renameTab={renameTab}
        onAddNewTab={addNewTab}
        onDeleteTabRequest={handleDeleteTabRequestFromBar}
        onOpenSettings={handleOpenSettings}
      />

      {/* Main White Card Container */}
      <main className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 mt-1 flex-1">
        {/* Printable Header (Visible only when printing) */}
        <div className="hidden print-only mb-6 text-black border-b-2 border-black pb-3">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold text-black m-0">Reliable Jewellery</h1>
              <h2 className="text-base font-semibold text-gray-700 m-0">
                {activeTabName.toUpperCase()} LEDGER
              </h2>
            </div>
            <div className="text-right text-xs text-gray-600">
              <p>Generated: {new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Ledger Table Card */}
        <LedgerTable
          tabId={activeTabId}
          tabName={activeTabName}
          rows={activeRows}
          onUpdateField={updateRow}
          onAddRows={addRows}
          onDeleteRow={deleteRowAt}
          searchQuery={searchQuery}
        />
      </main>

      {/* Comprehensive Settings & Database Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        initialTab={settingsInitialTab}
        tabs={tabs}
        tabRows={tabRows}
        activeTabId={activeTabId}
        setActiveTabId={setActiveTabId}
        renameTab={renameTab}
        addNewTab={addNewTab}
        deleteTab={deleteTab}
        createManualBackup={createManualBackup}
        restoreBackup={restoreBackup}
        exportBackupFile={exportBackupFile}
        importBackupFromJson={importBackupFromJson}
        firebaseConnected={firebaseConnected}
        syncStatus={syncStatus}
        offlineQueueCount={offlineQueueCount}
      />

      {/* Password Prompt Modal for direct tab deletion from tab strip */}
      <PasswordPromptModal
        isOpen={isDirectPasswordModalOpen}
        tab={tabToDeleteDirect}
        onClose={() => {
          setIsDirectPasswordModalOpen(false);
          setTabToDeleteDirect(null);
        }}
        onConfirmDelete={handleConfirmDirectDelete}
      />

      {/* Real-Time Share Link Modal (Owner) */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onOpenSettings={() => handleOpenSettings('database')}
      />
    </div>
  );
}
