import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Database,
  Check,
  AlertCircle,
  RefreshCw,
  Key,
  Globe,
  Folder,
  ShieldCheck,
  ClipboardPaste,
  HardDrive,
  Layers,
  Trash2,
  Lock,
  Plus,
  Download,
  Upload,
  History,
  Shield,
  Eye,
  EyeOff,
  FileCheck,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Server,
  Undo2,
} from 'lucide-react';
import {
  getStoredFirebaseConfig,
  saveFirebaseConfig,
  testFirebaseConnection,
  isCustomConfigActive,
  isBundledConfigAvailable,
  resetToBundledConfig,
} from '../services/firebase.js';
import { hashApiKey } from '../services/security.js';
import {
  getLocalBackupHistory,
  deleteLocalBackupSnapshot,
} from '../services/backup.js';
import { computeLedgerBalances, computeTabTotals, formatNumber } from '../utils/calculations.js';
import PasswordPromptModal from './PasswordPromptModal.jsx';

export default function SettingsModal({
  isOpen,
  onClose,
  initialTab = 'tabs',
  tabs,
  tabRows,
  activeTabId,
  setActiveTabId,
  renameTab,
  addNewTab,
  deleteTab,
  createManualBackup,
  restoreBackup,
  exportBackupFile,
  importBackupFromJson,
  firebaseConnected,
  syncStatus,
  offlineQueueCount = 0,
}) {
  const [activeSection, setActiveSection] = useState(initialTab); // 'tabs' | 'database' | 'backups' | 'security'
  
  // Database Config State
  const [config, setConfig] = useState({
    apiKey: '',
    authDomain: '',
    databaseURL: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  });
  const [rawSnippet, setRawSnippet] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isCustomConfig, setIsCustomConfig] = useState(false);
  const [isBundledAvailable, setIsBundledAvailable] = useState(false);

  // Tab Management State
  const [tabToDelete, setTabToDelete] = useState(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [editingTabId, setEditingTabId] = useState(null);
  const [editTabName, setEditTabName] = useState('');
  const [newTabNameInput, setNewTabNameInput] = useState('');
  const [tabSuccessMsg, setTabSuccessMsg] = useState(null);

  // Backup State
  const [backupHistory, setBackupHistory] = useState([]);
  const [backupLabelInput, setBackupLabelInput] = useState('');
  const [backupActionMsg, setBackupActionMsg] = useState(null);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setActiveSection(initialTab);
      const stored = getStoredFirebaseConfig();
      if (stored) {
        setConfig({
          apiKey: stored.apiKey || '',
          authDomain: stored.authDomain || '',
          databaseURL: stored.databaseURL || '',
          projectId: stored.projectId || '',
          storageBucket: stored.storageBucket || '',
          messagingSenderId: stored.messagingSenderId || '',
          appId: stored.appId || '',
        });
      }
      setIsCustomConfig(isCustomConfigActive());
      setIsBundledAvailable(isBundledConfigAvailable());
      setTestResult(null);
      setSavedSuccess(false);
      setTabSuccessMsg(null);
      setBackupActionMsg(null);
      setBackupHistory(getLocalBackupHistory());
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  // Refresh backup history
  const reloadBackupHistory = () => {
    setBackupHistory(getLocalBackupHistory());
  };

  // Tab Deletion flow
  const handleDeleteTabClick = (tab) => {
    setTabToDelete(tab);
    setIsPasswordModalOpen(true);
  };

  const handleConfirmDeleteTab = async (tabId, password) => {
    const res = await deleteTab(tabId, password);
    if (res.success) {
      setTabSuccessMsg(res.message);
      reloadBackupHistory();
      setTimeout(() => setTabSuccessMsg(null), 5000);
    } else {
      throw new Error(res.error);
    }
  };

  // Tab Rename
  const handleStartRename = (tab) => {
    setEditingTabId(tab.id);
    setEditTabName(tab.name || tab.defaultName);
  };

  const handleSaveRename = (tabId) => {
    if (editTabName.trim()) {
      renameTab(tabId, editTabName.trim());
    }
    setEditingTabId(null);
  };

  // Add new tab
  const handleAddNewTabSubmit = (e) => {
    e.preventDefault();
    if (!newTabNameInput.trim()) return;
    addNewTab(newTabNameInput.trim());
    setNewTabNameInput('');
    setTabSuccessMsg(`Tab "${newTabNameInput.trim()}" created successfully.`);
    setTimeout(() => setTabSuccessMsg(null), 4000);
  };

  // Manual Backup
  const handleCreateManualBackup = () => {
    const label = backupLabelInput.trim() || `Manual Snapshot (${new Date().toLocaleTimeString()})`;
    const res = createManualBackup(label);
    if (res.success) {
      setBackupLabelInput('');
      reloadBackupHistory();
      setBackupActionMsg({ type: 'success', text: `Backup "${label}" created successfully!` });
      setTimeout(() => setBackupActionMsg(null), 4000);
    } else {
      setBackupActionMsg({ type: 'error', text: res.error || 'Failed to create backup.' });
    }
  };

  // Restore snapshot
  const handleRestoreSnapshot = async (snapshot) => {
    if (!window.confirm(`Are you sure you want to restore snapshot "${snapshot.label}" from ${snapshot.formattedDate}? Current state will be replaced.`)) {
      return;
    }
    setRestoringSnapshotId(snapshot.id);
    const res = await restoreBackup(snapshot);
    setRestoringSnapshotId(null);
    if (res.success) {
      reloadBackupHistory();
      setBackupActionMsg({ type: 'success', text: 'Database restored successfully to snapshot point!' });
      setTimeout(() => setBackupActionMsg(null), 4000);
    } else {
      setBackupActionMsg({ type: 'error', text: res.error || 'Failed to restore snapshot.' });
    }
  };

  // Delete snapshot from history
  const handleDeleteSnapshot = (snapshotId) => {
    deleteLocalBackupSnapshot(snapshotId);
    reloadBackupHistory();
  };

  // File Upload JSON restore
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonText = event.target?.result;
        const res = await importBackupFromJson(jsonText);
        if (res.success) {
          reloadBackupHistory();
          setBackupActionMsg({ 
            type: 'success', 
            text: `Imported and restored database! Integrity Checksum: ${res.checksumStatus?.toUpperCase()}` 
          });
          setTimeout(() => setBackupActionMsg(null), 5000);
        } else {
          setBackupActionMsg({ type: 'error', text: res.error || 'Invalid backup file structure.' });
        }
      } catch (err) {
        setBackupActionMsg({ type: 'error', text: 'File reading error: ' + err.message });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Database field change
  const handleFieldChange = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value.trim() }));
  };

  // Parse snippet
  const handleParseSnippet = (text) => {
    setRawSnippet(text);
    if (!text.trim()) return;

    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        setConfig((prev) => ({
          ...prev,
          apiKey: parsed.apiKey || prev.apiKey,
          authDomain: parsed.authDomain || prev.authDomain,
          databaseURL: parsed.databaseURL || prev.databaseURL,
          projectId: parsed.projectId || prev.projectId,
          storageBucket: parsed.storageBucket || prev.storageBucket,
          messagingSenderId: parsed.messagingSenderId || prev.messagingSenderId,
          appId: parsed.appId || prev.appId,
        }));
        setTestResult({ success: true, message: 'Parsed Firebase JSON successfully!' });
        return;
      }
    } catch {
      // Not JSON
    }

    const extractKey = (keyName) => {
      const regex = new RegExp(`${keyName}["']?\\s*:\\s*["']([^"']+)["']`, 'i');
      const match = text.match(regex);
      return match ? match[1] : '';
    };

    const extracted = {
      apiKey: extractKey('apiKey'),
      authDomain: extractKey('authDomain'),
      databaseURL: extractKey('databaseURL'),
      projectId: extractKey('projectId'),
      storageBucket: extractKey('storageBucket'),
      messagingSenderId: extractKey('messagingSenderId'),
      appId: extractKey('appId'),
    };

    if (extracted.apiKey || extracted.databaseURL || extracted.projectId) {
      setConfig((prev) => ({
        apiKey: extracted.apiKey || prev.apiKey,
        authDomain: extracted.authDomain || prev.authDomain,
        databaseURL: extracted.databaseURL || prev.databaseURL,
        projectId: extracted.projectId || prev.projectId,
        storageBucket: extracted.storageBucket || prev.storageBucket,
        messagingSenderId: extracted.messagingSenderId || prev.messagingSenderId,
        appId: extracted.appId || prev.appId,
      }));
      setTestResult({ success: true, message: 'Extracted configuration keys from snippet!' });
    } else {
      setTestResult({
        success: false,
        message: 'Could not extract keys. Please enter Database URL and API Key manually.',
      });
    }
  };

  // Test Firebase connection
  const handleTestConnection = async () => {
    if (!config.databaseURL || !config.apiKey) {
      setTestResult({
        success: false,
        message: 'Please provide at least a Database URL and API Key to test.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const res = await testFirebaseConnection(config);
    setTesting(false);
    setTestResult(res);
  };

  // Save config
  const handleSaveConfig = () => {
    if (!config.databaseURL && !config.apiKey) {
      saveFirebaseConfig(null);
      setSavedSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 400);
      return;
    }

    try {
      saveFirebaseConfig(config);
      setSavedSuccess(true);
      setIsCustomConfig(true);
      setTimeout(() => {
        window.location.reload();
      }, 400);
    } catch (err) {
      setTestResult({ success: false, message: 'Error saving config: ' + err.message });
    }
  };

  // Reset to host bundled default config
  const handleResetToBundled = () => {
    resetToBundledConfig();
    const bundled = getStoredFirebaseConfig();
    if (bundled) {
      setConfig({
        apiKey: bundled.apiKey || '',
        authDomain: bundled.authDomain || '',
        databaseURL: bundled.databaseURL || '',
        projectId: bundled.projectId || '',
        storageBucket: bundled.storageBucket || '',
        messagingSenderId: bundled.messagingSenderId || '',
        appId: bundled.appId || '',
      });
    }
    setIsCustomConfig(false);
    setTestResult({ success: true, message: 'Reset to host bundled configuration!' });
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  const handleClearConfig = () => {
    saveFirebaseConfig(null);
    setConfig({
      apiKey: '',
      authDomain: '',
      databaseURL: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: '',
    });
    setTestResult({ success: true, message: 'Switched to Local Storage standalone mode.' });
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Database className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 m-0">
                  Settings &amp; Database Hub
                </h3>
                <p className="text-xs text-slate-500 m-0">
                  Manage categories, cloud sync, backups, and security
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-100 bg-slate-50/40 overflow-x-auto">
            <button
              onClick={() => setActiveSection('tabs')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
                activeSection === 'tabs'
                  ? 'border-blue-600 text-blue-600 bg-white shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tabs &amp; Categories</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 font-mono text-slate-600">
                {tabs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSection('database')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
                activeSection === 'database'
                  ? 'border-blue-600 text-blue-600 bg-white shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Database &amp; Sync</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  firebaseConnected ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
              />
            </button>

            <button
              onClick={() => setActiveSection('backups')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
                activeSection === 'backups'
                  ? 'border-blue-600 text-blue-600 bg-white shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Backups &amp; Recovery</span>
            </button>

            <button
              onClick={() => setActiveSection('security')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
                activeSection === 'security'
                  ? 'border-blue-600 text-blue-600 bg-white shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Security</span>
            </button>
          </div>

          {/* Modal Body Container */}
          <div className="p-6 overflow-y-auto flex-1 space-y-5">
            {/* ---------------------------------------------------- */}
            {/* SECTION 1: TABS & CATEGORIES MANAGEMENT */}
            {/* ---------------------------------------------------- */}
            {activeSection === 'tabs' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Notification Banner */}
                {tabSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold">{tabSuccessMsg}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 m-0">
                      Manage Ledger Categories
                    </h4>
                    <p className="text-xs text-slate-500 m-0">
                      Delete created tabs with encrypted password authentication or add new categories.
                    </p>
                  </div>
                </div>

                {/* Tabs List Table */}
                <div className="border border-slate-200/90 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2.5 px-3">Category Name</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Transactions</th>
                        <th className="py-2.5 px-3 text-right">Net Balance</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tabs.map((tab) => {
                        const rows = tabRows[tab.id] || [];
                        const computed = computeLedgerBalances(rows);
                        const totals = computeTabTotals(computed);
                        const isEditing = editingTabId === tab.id;
                        const isSelected = activeTabId === tab.id;

                        return (
                          <tr
                            key={tab.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isSelected ? 'bg-blue-50/30' : ''
                            }`}
                          >
                            {/* Tab Name */}
                            <td className="py-2.5 px-3 font-medium text-slate-900">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={editTabName}
                                    onChange={(e) => setEditTabName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveRename(tab.id);
                                      if (e.key === 'Escape') setEditingTabId(null);
                                    }}
                                    className="border border-blue-500 rounded px-2 py-1 text-xs outline-none bg-white w-36"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSaveRename(tab.id)}
                                    className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => setEditingTabId(null)}
                                    className="p-1 bg-slate-100 text-slate-500 rounded hover:bg-slate-200 cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setActiveTabId && setActiveTabId(tab.id)}
                                    className="font-semibold text-slate-800 hover:text-blue-600 text-left cursor-pointer"
                                  >
                                    {tab.name || tab.defaultName}
                                  </button>
                                  {isSelected && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 font-semibold">
                                      Active
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Type */}
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  tab.isDefault
                                    ? 'bg-slate-100 text-slate-600'
                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                }`}
                              >
                                {tab.isDefault ? 'Default' : 'Custom'}
                              </span>
                            </td>

                            {/* Transactions */}
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {totals.filledRowsCount} / {totals.totalRows}
                            </td>

                            {/* Net Balance */}
                            <td
                              className={`py-2.5 px-3 text-right font-mono font-semibold ${
                                totals.finalBalance > 0.000001
                                  ? 'text-emerald-700'
                                  : totals.finalBalance < -0.000001
                                  ? 'text-rose-700'
                                  : 'text-slate-800'
                              }`}
                            >
                              {totals.finalBalance > 0.000001
                                ? formatNumber(totals.finalBalance, 2)
                                : totals.finalBalance < -0.000001
                                ? `-${formatNumber(Math.abs(totals.finalBalance), 2)}`
                                : '0.00'}
                            </td>

                            {/* Actions */}
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {!isEditing && (
                                  <button
                                    onClick={() => handleStartRename(tab)}
                                    title="Rename tab"
                                    className="px-2 py-1 rounded text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                                  >
                                    Rename
                                  </button>
                                )}

                                {/* Delete Tab Button (Requires Encrypted Password) */}
                                <button
                                  onClick={() => handleDeleteTabClick(tab)}
                                  disabled={tabs.length <= 1}
                                  title="Delete this tab (Password '7722' required)"
                                  className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  <Lock className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Create New Tab Form */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
                    Create New Category Tab
                  </h5>
                  <form onSubmit={handleAddNewTabSubmit} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Laser Soldering, Stone Setting..."
                      value={newTabNameInput}
                      onChange={(e) => setNewTabNameInput(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 focus:border-blue-500 text-slate-800 text-xs rounded-lg px-3 py-2 outline-none shadow-2xs"
                    />
                    <button
                      type="submit"
                      disabled={!newTabNameInput.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors whitespace-nowrap cursor-pointer"
                    >
                      + Add Tab
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* SECTION 2: DATABASE & REALTIME CLOUD SYNC */}
            {/* ---------------------------------------------------- */}
            {activeSection === 'database' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Live Sync Status Banner */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/90">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        firebaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <span>{firebaseConnected ? 'Firebase Realtime Cloud Database Connected' : 'Operating in Standalone Local Storage'}</span>
                        {isBundledAvailable && !isCustomConfig && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 flex items-center gap-1">
                            <Server className="w-3 h-3" /> Host Bundled
                          </span>
                        )}
                        {isCustomConfig && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                            Custom Overridden
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {firebaseConnected
                          ? 'Real-time multi-tab syncing is active. Changes update immediately across all devices.'
                          : 'Transactions are saved locally in browser storage. Configure cloud database below for cross-device sync.'}
                      </div>
                    </div>
                  </div>
                  {offlineQueueCount > 0 && (
                    <div className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                      {offlineQueueCount} Queued Writes (Auto-Syncing)
                    </div>
                  )}
                </div>

                {/* Host Bundled Notice & Reset */}
                {isBundledAvailable && isCustomConfig && (
                  <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs flex items-center justify-between gap-3 text-blue-900">
                    <div>
                      <span className="font-semibold">Host-Bundled Defaults Available:</span> You are currently using custom credentials.
                    </div>
                    <button
                      onClick={handleResetToBundled}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer whitespace-nowrap"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Use Host Default</span>
                    </button>
                  </div>
                )}

                {/* Quick Paste Snippet */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <ClipboardPaste className="w-3.5 h-3.5 text-blue-600" />
                    Paste Firebase Config Snippet (Optional Custom Override)
                  </label>
                  <textarea
                    rows={2}
                    value={rawSnippet}
                    onChange={(e) => handleParseSnippet(e.target.value)}
                    placeholder="Paste const firebaseConfig = { ... }; here..."
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-800 text-xs rounded-xl p-2.5 font-mono outline-none placeholder:text-slate-400 transition-colors"
                  />
                </div>

                {/* Configuration Fields */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Database URL <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="https://your-project-default-rtdb.firebaseio.com"
                        value={config.databaseURL}
                        onChange={(e) => handleFieldChange('databaseURL', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-800 text-xs rounded-lg pl-9 pr-3 py-2 font-mono outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-700">
                        API Key (Secured with AES Encryption &amp; Hashing) <span className="text-rose-500">*</span>
                      </label>
                      {config.apiKey && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          SHA-256: {hashApiKey(config.apiKey).slice(0, 12)}...
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="AIzaSy..."
                        value={config.apiKey}
                        onChange={(e) => handleFieldChange('apiKey', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-800 text-xs rounded-lg pl-9 pr-10 py-2 font-mono outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Project ID
                      </label>
                      <div className="relative">
                        <Folder className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="my-project-id"
                          value={config.projectId}
                          onChange={(e) => handleFieldChange('projectId', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-800 text-xs rounded-lg pl-9 pr-3 py-2 font-mono outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Auth Domain
                      </label>
                      <input
                        type="text"
                        placeholder="my-project.firebaseapp.com"
                        value={config.authDomain}
                        onChange={(e) => handleFieldChange('authDomain', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-800 text-xs rounded-lg px-3 py-2 font-mono outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Test Result Alert */}
                {testResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      testResult.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    {testResult.success ? (
                      <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <div className="font-semibold">{testResult.success ? 'Connection Verified' : 'Connection Error'}</div>
                      <div className="text-[11px]">{testResult.message}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* SECTION 3: BACKUPS & DISASTER RECOVERY */}
            {/* ---------------------------------------------------- */}
            {activeSection === 'backups' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Backup Action Banner */}
                {backupActionMsg && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      backupActionMsg.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    {backupActionMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span className="font-semibold">{backupActionMsg.text}</span>
                  </div>
                )}

                {/* Primary Backup Action Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Create Immediate Snapshot */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span>Instant Snapshot</span>
                      </div>
                      <p className="text-[11px] text-slate-500 m-0">
                        Create an immediate point-in-time recovery snapshot of all tabs and data.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Snapshot note (optional)..."
                        value={backupLabelInput}
                        onChange={(e) => setBackupLabelInput(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none"
                      />
                      <button
                        onClick={handleCreateManualBackup}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Create Snapshot Now</span>
                      </button>
                    </div>
                  </div>

                  {/* Export / Import JSON File */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1">
                        <FileCheck className="w-4 h-4 text-emerald-600" />
                        <span>Tamper-Proof File Export</span>
                      </div>
                      <p className="text-[11px] text-slate-500 m-0">
                        Download an encrypted &amp; checksum-verified JSON backup or restore from file.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => exportBackupFile('User Export')}
                        className="flex-1 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Export .json</span>
                      </button>

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-blue-600" />
                        <span>Restore File</span>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Snapshot History List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-800 m-0 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-slate-500" />
                      <span>Snapshot History ({backupHistory.length})</span>
                    </h5>
                    <span className="text-[10px] text-slate-400">
                      Auto-generated on tab deletion &amp; manual triggers
                    </span>
                  </div>

                  {backupHistory.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No snapshots created yet. Click "Create Snapshot Now" above to capture a recovery point.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto bg-white">
                      {backupHistory.map((snap) => (
                        <div
                          key={snap.id}
                          className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-800 flex items-center gap-2">
                              <span>{snap.label}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${
                                  snap.source === 'pre_delete'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {snap.source === 'pre_delete' ? 'Pre-Delete' : 'Manual'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-3">
                              <span>{snap.formattedDate}</span>
                              <span>•</span>
                              <span>{snap.stats?.tabCount || snap.tabs?.length || 0} Tabs</span>
                              <span>•</span>
                              <span>{snap.stats?.totalRows || 0} Records</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleRestoreSnapshot(snap)}
                              disabled={restoringSnapshotId === snap.id}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>{restoringSnapshotId === snap.id ? 'Restoring...' : 'Restore'}</span>
                            </button>
                            <button
                              onClick={() => handleDeleteSnapshot(snap.id)}
                              title="Delete snapshot"
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* SECTION 4: SECURITY & ENCRYPTION OVERVIEW */}
            {/* ---------------------------------------------------- */}
            {activeSection === 'security' && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 m-0">
                        System Security Architecture
                      </h4>
                      <p className="text-[11px] text-slate-500 m-0">
                        Confidential data encryption, hashing, and failure protection policies
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                    <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                      <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-rose-600" />
                        <span>Protected Tab Deletion</span>
                      </div>
                      <p className="text-[11px] text-slate-500 m-0">
                        Deleting created categories requires the encrypted master security password ("7722"). Verification is performed via cryptographic SHA-256 hash.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                      <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-blue-600" />
                        <span>Encrypted Credentials</span>
                      </div>
                      <p className="text-[11px] text-slate-500 m-0">
                        API keys and Firebase credentials are encrypted via multi-round salted cipher and SHA-256 HMAC integrity checks.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                      <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Tamper-Proof Backups</span>
                      </div>
                      <p className="text-[11px] text-slate-500 m-0">
                        Database snapshots and exports include cryptographic SHA-256 signatures to ensure data integrity during restore.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                      <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Offline Resilience &amp; Queue</span>
                      </div>
                      <p className="text-[11px] text-slate-500 m-0">
                        Transactions are always editable and durable in local storage, automatically syncing with exponential backoff on reconnection.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
            {activeSection === 'database' ? (
              <>
                <button
                  onClick={handleClearConfig}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Local Mode</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    {testing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <span>Test Connection</span>
                    )}
                  </button>

                  <button
                    onClick={handleSaveConfig}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs cursor-pointer"
                  >
                    {savedSuccess ? 'Saved & Reloading!' : 'Save & Connect'}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between w-full">
                <div className="text-[11px] text-slate-400">
                  Reliable Jewellery Ledger System
                </div>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Password Prompt Modal for Tab Deletion */}
      <PasswordPromptModal
        isOpen={isPasswordModalOpen}
        tab={tabToDelete}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setTabToDelete(null);
        }}
        onConfirmDelete={handleConfirmDeleteTab}
      />
    </>
  );
}
