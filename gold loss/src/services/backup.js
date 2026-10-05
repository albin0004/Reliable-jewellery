/**
 * Database Backup & Disaster Recovery Service
 * - Creates local & cloud backup snapshots
 * - Exports tamper-proof JSON backup files with SHA-256 integrity checksums
 * - Supports instant 1-click restore from snapshot history or uploaded JSON files
 * - Automatically backs up database before destructive actions (like tab deletion)
 */

import { calculateDataChecksum, verifyDataChecksum } from './security.js';
import { computeLedgerBalances, computeTabTotals } from '../utils/calculations.js';

const BACKUP_HISTORY_KEY = 'gold_loss_backup_history';
const MAX_LOCAL_SNAPSHOTS = 25;

/**
 * Calculate stats across all tabs
 */
export const calculateDatabaseStats = (tabs, tabRows) => {
  let totalRows = 0;
  let filledRows = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  tabs.forEach((tab) => {
    const rows = tabRows[tab.id] || [];
    const computed = computeLedgerBalances(rows);
    const totals = computeTabTotals(computed);
    totalRows += totals.totalRows;
    filledRows += totals.filledRowsCount;
    totalDebit += totals.totalDebit;
    totalCredit += totals.totalCredit;
  });

  return {
    tabCount: tabs.length,
    totalRows,
    filledRows,
    totalDebit,
    totalCredit,
    finalBalance: totalCredit - totalDebit,
  };
};

/**
 * Get snapshot history from local storage
 */
export const getLocalBackupHistory = () => {
  try {
    const raw = localStorage.getItem(BACKUP_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => b.timestamp - a.timestamp);
      }
    }
  } catch (e) {
    console.error('Error reading backup history:', e);
  }
  return [];
};

/**
 * Save snapshot history to local storage
 */
const saveLocalBackupHistory = (history) => {
  try {
    const trimmed = history.slice(0, MAX_LOCAL_SNAPSHOTS);
    localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Error saving backup history:', e);
  }
};

/**
 * Create a new backup snapshot
 * @param {Array} tabs - Tab list
 * @param {Object} tabRows - Map of rows by tab ID
 * @param {string} label - Human-readable label (e.g. "Pre-Deletion Polishing", "Manual Backup")
 * @param {string} source - 'auto' | 'manual' | 'pre_delete' | 'sync'
 */
export const createBackupSnapshot = (tabs, tabRows, label = 'Manual Snapshot', source = 'manual') => {
  try {
    const timestamp = Date.now();
    const stats = calculateDatabaseStats(tabs, tabRows);
    
    // Core payload for checksum calculation
    const payload = {
      tabs,
      tabRows,
    };
    
    const checksum = calculateDataChecksum(payload);

    const snapshot = {
      id: `bk_${timestamp}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp,
      isoDate: new Date(timestamp).toISOString(),
      formattedDate: new Date(timestamp).toLocaleString(),
      label,
      source,
      version: 1,
      stats,
      checksum,
      tabs: JSON.parse(JSON.stringify(tabs)),
      tabRows: JSON.parse(JSON.stringify(tabRows)),
    };

    const currentHistory = getLocalBackupHistory();
    const updated = [snapshot, ...currentHistory];
    saveLocalBackupHistory(updated);

    return snapshot;
  } catch (err) {
    console.error('Failed to create backup snapshot:', err);
    throw err;
  }
};

/**
 * Delete a specific backup snapshot
 */
export const deleteLocalBackupSnapshot = (snapshotId) => {
  const currentHistory = getLocalBackupHistory();
  const updated = currentHistory.filter((item) => item.id !== snapshotId);
  saveLocalBackupHistory(updated);
};

/**
 * Clear all snapshot history
 */
export const clearAllBackupHistory = () => {
  saveLocalBackupHistory([]);
};

/**
 * Export full database to downloadable JSON file
 */
export const exportDatabaseToJsonFile = (tabs, tabRows, label = 'Full Database Backup') => {
  const snapshot = createBackupSnapshot(tabs, tabRows, label, 'manual');
  
  const fileData = {
    appName: 'Reliable Jewellery Ledger',
    appVersion: '2.0.0',
    exportDate: snapshot.isoDate,
    backupId: snapshot.id,
    label: snapshot.label,
    checksum: snapshot.checksum,
    stats: snapshot.stats,
    tabs: snapshot.tabs,
    tabRows: snapshot.tabRows,
  };

  const jsonString = JSON.stringify(fileData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const filename = `Reliable_Jewellery_Backup_${dateStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return snapshot;
};

/**
 * Validate and parse backup JSON text
 */
export const validateBackupJson = (jsonString) => {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid JSON format.' };
    }

    if (!Array.isArray(data.tabs) || data.tabs.length === 0) {
      return { valid: false, error: 'Backup is missing valid tabs array.' };
    }

    if (!data.tabRows || typeof data.tabRows !== 'object') {
      return { valid: false, error: 'Backup is missing valid tab rows data.' };
    }

    // Verify Checksum if present
    let checksumStatus = 'missing';
    if (data.checksum) {
      const payload = { tabs: data.tabs, tabRows: data.tabRows };
      const isValidChecksum = verifyDataChecksum(payload, data.checksum);
      checksumStatus = isValidChecksum ? 'verified' : 'failed';
      if (!isValidChecksum) {
        console.warn('Backup checksum mismatch: file might have been modified');
      }
    }

    const stats = calculateDatabaseStats(data.tabs, data.tabRows);

    return {
      valid: true,
      checksumStatus,
      snapshot: {
        id: data.backupId || `bk_${Date.now()}`,
        timestamp: data.exportDate ? new Date(data.exportDate).getTime() : Date.now(),
        isoDate: data.exportDate || new Date().toISOString(),
        formattedDate: data.exportDate ? new Date(data.exportDate).toLocaleString() : new Date().toLocaleString(),
        label: data.label || 'Imported File Backup',
        source: 'imported_file',
        version: data.version || 1,
        stats,
        checksum: data.checksum,
        tabs: data.tabs,
        tabRows: data.tabRows,
      },
    };
  } catch (err) {
    return { valid: false, error: 'Failed to parse JSON file: ' + err.message };
  }
};
