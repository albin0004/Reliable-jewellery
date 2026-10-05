import { generateDefaultRows, getPolishingInitialRows } from '../utils/calculations.js';

const STORAGE_PREFIX = 'gold_loss_app_';
const CHANNEL_NAME = 'gold_loss_broadcast_channel';

// Default Tab Structure
export const DEFAULT_TABS = [
  { id: 'polishing', defaultName: 'Polishing', name: 'Polishing', isDefault: true },
  { id: 'workers_loose', defaultName: 'Workers Loss', name: 'Workers Loss', isDefault: true },
];

let broadcastChannel = null;
try {
  if (typeof window !== 'undefined' && window.BroadcastChannel) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch (e) {
  console.warn('BroadcastChannel not supported in this environment');
}

/**
 * Get Tab metadata from LocalStorage
 */
export const getLocalTabMetadata = () => {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}tabs_meta`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((tab) => {
          if (tab.name === 'Workers Loose' || tab.defaultName === 'Workers Loose') {
            return {
              ...tab,
              name: tab.name === 'Workers Loose' ? 'Workers Loss' : tab.name,
              defaultName: 'Workers Loss',
            };
          }
          return tab;
        });
      }
    }
  } catch (e) {
    console.error('Error reading tabs metadata from localStorage:', e);
  }
  return DEFAULT_TABS;
};

/**
 * Save Tab metadata to LocalStorage
 */
export const saveLocalTabMetadata = (tabs) => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}tabs_meta`, JSON.stringify(tabs));
    notifyTabsUpdated(tabs);
  } catch (e) {
    console.error('Error saving tabs metadata to localStorage:', e);
  }
};

/**
 * Get Tab rows from LocalStorage (initializes with clean default rows)
 */
export const getLocalTabRows = (tabId) => {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}tab_rows_${tabId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        let hasDemoTracking = false;
        const cleaned = parsed.map((row) => {
          const lower = (row.narration || '').toLowerCase();
          if (
            lower.includes('polishing') ||
            lower.includes('opening balance') ||
            lower.includes('paid for') ||
            lower.includes('paid to worker') ||
            lower.includes('batch') ||
            lower.includes('miscellaneous expenses')
          ) {
            hasDemoTracking = true;
            return { ...row, narration: '', debit: '', credit: '', date: '' };
          }
          return row;
        });
        if (hasDemoTracking) {
          saveLocalTabRows(tabId, cleaned);
        }
        return cleaned;
      }
    }
  } catch (e) {
    console.error(`Error reading rows for tab ${tabId} from localStorage:`, e);
  }

  // Initialize with clean empty rows
  const initialRows = generateDefaultRows(20);
  saveLocalTabRows(tabId, initialRows);
  return initialRows;
};

/**
 * Get all tab rows for a given list of tabs
 */
export const getAllLocalTabRows = (tabs) => {
  const result = {};
  tabs.forEach((tab) => {
    result[tab.id] = getLocalTabRows(tab.id);
  });
  return result;
};

const storageErrorListeners = new Set();

export const subscribeToStorageError = (callback) => {
  storageErrorListeners.add(callback);
  return () => storageErrorListeners.delete(callback);
};

export const notifyStorageError = (error, context = '') => {
  storageErrorListeners.forEach((fn) => {
    try {
      fn(error, context);
    } catch (e) {
      // ignore
    }
  });
};

/**
 * Save Tab rows to LocalStorage
 */
export const saveLocalTabRows = (tabId, rows) => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}tab_rows_${tabId}`, JSON.stringify(rows));
    notifyRowsUpdated(tabId, rows);
    return { success: true };
  } catch (e) {
    console.error(`Error saving rows for tab ${tabId} to localStorage:`, e);
    notifyStorageError(e, `Failed to save rows for ${tabId}`);
    return { success: false, error: e };
  }
};

/**
 * Delete a Tab and its row storage locally
 */
export const deleteLocalTab = (tabId) => {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}tab_rows_${tabId}`);
    const tabs = getLocalTabMetadata().filter((t) => t.id !== tabId);
    localStorage.setItem(`${STORAGE_PREFIX}tabs_meta`, JSON.stringify(tabs));
    notifyTabDeleted(tabId, tabs);
    return tabs;
  } catch (e) {
    console.error(`Error deleting tab ${tabId} from localStorage:`, e);
    throw e;
  }
};

/**
 * Atomically restore all tabs and rows locally
 */
export const restoreAllLocalData = (tabs, tabRows) => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}tabs_meta`, JSON.stringify(tabs));
    tabs.forEach((tab) => {
      const rows = tabRows[tab.id] || [];
      localStorage.setItem(`${STORAGE_PREFIX}tab_rows_${tab.id}`, JSON.stringify(rows));
    });
    notifyBackupRestored(tabs, tabRows);
  } catch (e) {
    console.error('Error restoring all data in localStorage:', e);
    throw e;
  }
};

/**
 * Broadcast notifications for multi-window local sync
 */
export const notifyRowsUpdated = (tabId, rows) => {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: 'ROWS_UPDATED', tabId, rows, timestamp: Date.now() });
    } catch (e) {
      // ignore
    }
  }
};

export const notifyTabsUpdated = (tabs) => {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: 'TABS_UPDATED', tabs, timestamp: Date.now() });
    } catch (e) {
      // ignore
    }
  }
};

export const notifyTabDeleted = (tabId, remainingTabs) => {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: 'TAB_DELETED', tabId, remainingTabs, timestamp: Date.now() });
    } catch (e) {
      // ignore
    }
  }
};

export const notifyBackupRestored = (tabs, tabRows) => {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: 'BACKUP_RESTORED', tabs, tabRows, timestamp: Date.now() });
    } catch (e) {
      // ignore
    }
  }
};

/**
 * Subscribe to local BroadcastChannel events
 */
export const subscribeToLocalSync = (onMessage) => {
  if (!broadcastChannel) return () => {};
  
  const handler = (event) => {
    if (event.data) {
      onMessage(event.data);
    }
  };

  broadcastChannel.addEventListener('message', handler);
  return () => {
    broadcastChannel.removeEventListener('message', handler);
  };
};
