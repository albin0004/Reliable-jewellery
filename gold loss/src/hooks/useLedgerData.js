import { useState, useEffect, useRef, useCallback } from 'react';
import {
  DEFAULT_TABS,
  getLocalTabMetadata,
  saveLocalTabMetadata,
  getAllLocalTabRows,
  saveLocalTabRows,
  deleteLocalTab,
  restoreAllLocalData,
  subscribeToLocalSync,
} from '../services/storage.js';
import {
  getStoredFirebaseConfig,
  subscribeToPath,
  writeToPath,
  readFromPath,
  initFirebaseService,
  deleteTabFromFirebase,
  saveBackupToFirebase,
  subscribeToFirebaseConnectionState,
  checkAndReconnectFirebase,
  setReadOnlySession,
} from '../services/firebase.js';
import { verifyDeletionPassword } from '../services/security.js';
import {
  createBackupSnapshot,
  exportDatabaseToJsonFile,
  validateBackupJson,
} from '../services/backup.js';
import { subscribeToQueue } from '../services/syncQueue.js';
import { generateDefaultRows } from '../utils/calculations.js';
import { normalizeRowsArray, normalizeTabsArray } from '../utils/firebaseDataNormalizer.js';
import {
  getShareTokenFromUrl,
  parseShareToken,
  verifySharePin,
} from '../services/shareService.js';

export function useLedgerData() {
  // Read-Only Share Link State
  const [shareToken] = useState(() => getShareTokenFromUrl());
  const [sharePayload, setSharePayload] = useState(null);
  const [shareAuthStatus, setShareAuthStatus] = useState(null); // 'authorized' | 'pin_required' | 'expired' | 'invalid' | null
  const [isReadOnlyViewer, setIsReadOnlyViewer] = useState(false);

  const [tabs, setTabs] = useState(() => getLocalTabMetadata());
  const [activeTabId, setActiveTabId] = useState(() => {
    const meta = getLocalTabMetadata();
    return meta[0]?.id || 'polishing';
  });

  const [tabRows, setTabRows] = useState(() => getAllLocalTabRows(getLocalTabMetadata()));

  const [decimalPrecision, setDecimalPrecision] = useState(3);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'saved' | 'offline' | 'error' | 'queued'
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [firebaseError, setFirebaseError] = useState(null);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // Debounce timers for Firebase writes
  const debounceTimers = useRef({});
  const isRemoteUpdate = useRef(false);
  const activeTabListenersRef = useRef(new Map());
  const tabRowsRef = useRef(tabRows);
  tabRowsRef.current = tabRows;

  // Evaluate Share Token on mount
  useEffect(() => {
    if (!shareToken) return;

    const parsed = parseShareToken(shareToken);
    if (!parsed.valid) {
      if (parsed.expired) {
        setShareAuthStatus('expired');
        setSharePayload(parsed.payload);
      } else {
        setShareAuthStatus('invalid');
      }
      setIsReadOnlyViewer(true);
      setReadOnlySession(true);
      return;
    }

    setSharePayload(parsed.payload);
    setIsReadOnlyViewer(true);
    setReadOnlySession(true);

    if (parsed.payload.hasPin) {
      setShareAuthStatus('pin_required');
    } else {
      setShareAuthStatus('authorized');
    }
  }, [shareToken]);

  // Authenticate PIN for protected share link
  const authenticateSharePin = useCallback((pin) => {
    if (!sharePayload) return false;
    const isValid = verifySharePin(sharePayload, pin);
    if (isValid) {
      setShareAuthStatus('authorized');
      return true;
    }
    return false;
  }, [sharePayload]);

  // Listen to Offline Queue changes
  useEffect(() => {
    const unsub = subscribeToQueue((queue) => {
      setOfflineQueueCount(queue.length);
      if (queue.length > 0 && syncStatus !== 'syncing') {
        setSyncStatus('queued');
      }
    });
    return unsub;
  }, [syncStatus]);

  // Listen to Firebase Connection State
  useEffect(() => {
    const unsub = subscribeToFirebaseConnectionState((connected) => {
      setFirebaseConnected(connected);
      if (!connected) {
        setSyncStatus('offline');
      } else {
        setSyncStatus('saved');
        setFirebaseError(null);
      }
    });
    return unsub;
  }, []);

  // Real-time Dynamic Firebase listeners for Tabs Metadata and each individual Tab's rows
  useEffect(() => {
    // In read-only viewer mode, use credentials provided by the share token
    let config = null;
    if (isReadOnlyViewer) {
      if (!sharePayload || shareAuthStatus !== 'authorized') {
        return; // Wait until viewer unlocks PIN or valid token is ready
      }
      config = {
        databaseURL: sharePayload.dbUrl,
        apiKey: sharePayload.apiKey,
        authDomain: sharePayload.authDomain,
        projectId: sharePayload.projectId,
      };
    } else {
      config = getStoredFirebaseConfig();
    }

    if (!config || !config.databaseURL || !config.apiKey) {
      setFirebaseConnected(false);
      setSyncStatus('offline');
      return;
    }

    const { initialized, error } = initFirebaseService(config);
    if (!initialized) {
      setFirebaseConnected(false);
      setFirebaseError(error);
      setSyncStatus('offline');
      return;
    }

    setFirebaseConnected(true);
    setSyncStatus('saved');

    // 1. Subscribe to tabs metadata list
    const unsubMeta = subscribeToPath(
      'ledgers_meta/tabs',
      (remoteVal) => {
        const remoteTabs = normalizeTabsArray(remoteVal);
        if (remoteTabs && remoteTabs.length > 0) {
          isRemoteUpdate.current = true;
          setTabs((prev) => {
            const hasChanged =
              prev.length !== remoteTabs.length ||
              prev.some((pt, i) => pt.id !== remoteTabs[i]?.id || pt.name !== remoteTabs[i]?.name);
            if (!hasChanged) return prev;
            return remoteTabs;
          });
          if (!isReadOnlyViewer) {
            saveLocalTabMetadata(remoteTabs);
          }
          setTimeout(() => {
            isRemoteUpdate.current = false;
          }, 60);
        } else if (remoteVal === null && !isReadOnlyViewer) {
          // If remote database is empty, seed it with current local tabs (owner only)
          const localTabs = getLocalTabMetadata();
          writeToPath('ledgers_meta/tabs', localTabs).catch(() => {});
        }
      },
      (err) => {
        console.warn('Firebase meta error:', err);
        setFirebaseError(err.message);
      }
    );

    // 2. Manage dynamic listeners for every tab in current `tabs`
    const currentListeners = activeTabListenersRef.current;
    const activeTabIds = new Set(tabs.map((t) => t.id));

    // Remove listeners for tabs that were removed
    currentListeners.forEach((unsub, tabId) => {
      if (!activeTabIds.has(tabId)) {
        try {
          unsub();
        } catch {
          // ignore
        }
        currentListeners.delete(tabId);
      }
    });

    // Add listeners for tabs
    tabs.forEach((tab) => {
      if (!currentListeners.has(tab.id)) {
        const unsub = subscribeToPath(
          `ledgers/${tab.id}/rows`,
          (remoteVal) => {
            if (remoteVal !== null && remoteVal !== undefined) {
              const remoteRows = normalizeRowsArray(remoteVal);
              isRemoteUpdate.current = true;
              setTabRows((prev) => ({
                ...prev,
                [tab.id]: remoteRows,
              }));
              if (!isReadOnlyViewer) {
                saveLocalTabRows(tab.id, remoteRows);
              }
              setTimeout(() => {
                isRemoteUpdate.current = false;
              }, 60);
            } else if (remoteVal === null && !isReadOnlyViewer) {
              // If remote tab has no rows in DB, seed with local rows if available (owner only)
              const localRows = tabRowsRef.current[tab.id] || generateDefaultRows(20);
              writeToPath(`ledgers/${tab.id}/rows`, localRows).catch(() => {});
            }
          },
          (err) => {
            console.warn(`Firebase error for tab ${tab.id}:`, err);
          }
        );
        currentListeners.set(tab.id, unsub);
      }
    });

    // In viewer mode, also subscribe to 'ledgers' root so ANY tab update instantly syncs
    let unsubLedgers = null;
    if (isReadOnlyViewer) {
      unsubLedgers = subscribeToPath(
        'ledgers',
        (remoteVal) => {
          if (remoteVal && typeof remoteVal === 'object') {
            isRemoteUpdate.current = true;
            setTabRows((prev) => {
              const next = { ...prev };
              Object.keys(remoteVal).forEach((tId) => {
                if (remoteVal[tId]?.rows) {
                  next[tId] = normalizeRowsArray(remoteVal[tId].rows);
                }
              });
              return next;
            });
            setTimeout(() => {
              isRemoteUpdate.current = false;
            }, 60);
          }
        },
        (err) => console.warn('Firebase ledgers root sync error:', err)
      );
    }

    return () => {
      if (unsubMeta) unsubMeta();
      if (unsubLedgers) unsubLedgers();
    };
  }, [tabs, isReadOnlyViewer, sharePayload, shareAuthStatus]);

  // Clean up all tab listeners on unmount
  useEffect(() => {
    const listeners = activeTabListenersRef.current;
    return () => {
      listeners.forEach((unsub) => {
        try {
          unsub();
        } catch {
          // ignore
        }
      });
      listeners.clear();
    };
  }, []);

  // Multi-tab sync listener via BroadcastChannel and window storage event (works for both owner and viewer)
  useEffect(() => {
    const unsubscribeBroadcast = subscribeToLocalSync((message) => {
      if (message.type === 'ROWS_UPDATED' && message.tabId && message.rows) {
        setTabRows((prev) => ({
          ...prev,
          [message.tabId]: message.rows,
        }));
      } else if (message.type === 'TABS_UPDATED' && message.tabs) {
        setTabs(message.tabs);
      } else if (message.type === 'TAB_DELETED' && message.tabId) {
        setTabs((prev) => prev.filter((t) => t.id !== message.tabId));
        setTabRows((prev) => {
          const next = { ...prev };
          delete next[message.tabId];
          return next;
        });
        setActiveTabId((currentActive) => {
          if (currentActive === message.tabId) {
            return message.remainingTabs?.[0]?.id || 'polishing';
          }
          return currentActive;
        });
      } else if (message.type === 'BACKUP_RESTORED' && message.tabs && message.tabRows) {
        setTabs(message.tabs);
        setTabRows(message.tabRows);
        if (!message.tabs.find((t) => t.id === activeTabId)) {
          setActiveTabId(message.tabs[0]?.id || 'polishing');
        }
      }
    });

    const handleStorageEvent = (e) => {
      if (e.key && e.key.includes('tab_rows_')) {
        const tabId = e.key.split('tab_rows_')[1];
        if (tabId && e.newValue) {
          try {
            const rows = JSON.parse(e.newValue);
            setTabRows((prev) => ({ ...prev, [tabId]: rows }));
          } catch {
            // ignore
          }
        }
      } else if (e.key && e.key.includes('tabs_meta') && e.newValue) {
        try {
          const newTabs = JSON.parse(e.newValue);
          setTabs(newTabs);
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('storage', handleStorageEvent);

    return () => {
      unsubscribeBroadcast();
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [activeTabId]);

  // Automatic real-time polling fallback for read-only viewer (guarantees real-time sync without manual refresh)
  useEffect(() => {
    if (!isReadOnlyViewer || shareAuthStatus !== 'authorized') return;

    const intervalId = setInterval(async () => {
      try {
        const [remoteMeta, remoteLedgers] = await Promise.all([
          readFromPath('ledgers_meta/tabs'),
          readFromPath('ledgers'),
        ]);

        if (remoteMeta) {
          const normTabs = normalizeTabsArray(remoteMeta);
          if (normTabs && normTabs.length > 0) {
            setTabs((prev) => {
              const changed =
                prev.length !== normTabs.length ||
                prev.some((pt, i) => pt.id !== normTabs[i]?.id || pt.name !== normTabs[i]?.name);
              return changed ? normTabs : prev;
            });
          }
        }

        if (remoteLedgers && typeof remoteLedgers === 'object') {
          setTabRows((prev) => {
            let hasChanged = false;
            const next = { ...prev };
            Object.keys(remoteLedgers).forEach((tId) => {
              if (remoteLedgers[tId]?.rows) {
                const newRows = normalizeRowsArray(remoteLedgers[tId].rows);
                const oldRows = prev[tId] || [];
                if (
                  oldRows.length !== newRows.length ||
                  JSON.stringify(oldRows) !== JSON.stringify(newRows)
                ) {
                  next[tId] = newRows;
                  hasChanged = true;
                }
              }
            });
            return hasChanged ? next : prev;
          });
        }
      } catch {
        // silent fail
      }
    }, 2500);

    return () => clearInterval(intervalId);
  }, [isReadOnlyViewer, shareAuthStatus]);

  // Push updates to Firebase with debouncing and failure protection
  const pushRowsToFirebase = useCallback((tabId, rows, immediate = false) => {
    if (isReadOnlyViewer) return;
    const config = getStoredFirebaseConfig();
    if (!config || !config.databaseURL) {
      setSyncStatus('offline');
      return;
    }

    setSyncStatus('syncing');
    if (debounceTimers.current[tabId]) {
      clearTimeout(debounceTimers.current[tabId]);
    }

    const doWrite = async () => {
      try {
        await writeToPath(`ledgers/${tabId}/rows`, rows);
        await writeToPath(`ledgers/${tabId}/updatedAt`, Date.now());
        setSyncStatus('saved');
        setFirebaseConnected(true);
      } catch (err) {
        console.warn(`Firebase push error on tab ${tabId}:`, err);
        setSyncStatus('error');
        setFirebaseError(err.message);
      }
    };

    if (immediate) {
      doWrite();
    } else {
      debounceTimers.current[tabId] = setTimeout(doWrite, 120);
    }
  }, [isReadOnlyViewer]);

  // Push tabs metadata to Firebase
  const pushTabsToFirebase = useCallback((updatedTabs) => {
    if (isReadOnlyViewer) return;
    const config = getStoredFirebaseConfig();
    if (!config || !config.databaseURL) return;

    writeToPath('ledgers_meta/tabs', updatedTabs).catch((err) => {
      console.warn('Failed to sync tabs metadata to Firebase:', err);
    });
  }, [isReadOnlyViewer]);

  // Action: Update a single row field
  const updateRow = useCallback((tabId, rowIndex, field, value) => {
    if (isReadOnlyViewer) return;
    setTabRows((prev) => {
      const currentRows = prev[tabId] ? [...prev[tabId]] : generateDefaultRows(20);
      if (rowIndex >= currentRows.length) return prev;

      const updatedRow = {
        ...currentRows[rowIndex],
        [field]: value,
      };

      const newRows = [...currentRows];
      newRows[rowIndex] = updatedRow;

      // Update local storage
      saveLocalTabRows(tabId, newRows);

      // Push to Firebase with failure protection
      pushRowsToFirebase(tabId, newRows, false);

      return {
        ...prev,
        [tabId]: newRows,
      };
    });
  }, [pushRowsToFirebase, isReadOnlyViewer]);

  // Action: Add N rows to the active tab
  const addRows = useCallback((tabId, count = 1) => {
    if (isReadOnlyViewer) return;
    setTabRows((prev) => {
      const currentRows = prev[tabId] ? [...prev[tabId]] : [];
      const newRowsToAppend = generateDefaultRows(count);
      const combined = [...currentRows, ...newRowsToAppend];

      saveLocalTabRows(tabId, combined);
      pushRowsToFirebase(tabId, combined, true);

      return {
        ...prev,
        [tabId]: combined,
      };
    });
  }, [pushRowsToFirebase, isReadOnlyViewer]);

  // Action: Insert a row at specific index
  const insertRowAt = useCallback((tabId, index) => {
    if (isReadOnlyViewer) return;
    setTabRows((prev) => {
      const currentRows = prev[tabId] ? [...prev[tabId]] : [];
      const newRow = {
        id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        date: '',
        narration: '',
        debit: '',
        credit: '',
      };
      const updated = [...currentRows];
      updated.splice(index, 0, newRow);

      saveLocalTabRows(tabId, updated);
      pushRowsToFirebase(tabId, updated, true);

      return {
        ...prev,
        [tabId]: updated,
      };
    });
  }, [pushRowsToFirebase, isReadOnlyViewer]);

  // Action: Delete row
  const deleteRowAt = useCallback((tabId, index) => {
    if (isReadOnlyViewer) return;
    setTabRows((prev) => {
      const currentRows = prev[tabId] ? [...prev[tabId]] : [];
      if (currentRows.length <= 1) {
        const empty = generateDefaultRows(1);
        saveLocalTabRows(tabId, empty);
        pushRowsToFirebase(tabId, empty, true);
        return { ...prev, [tabId]: empty };
      }

      const updated = currentRows.filter((_, i) => i !== index);
      saveLocalTabRows(tabId, updated);
      pushRowsToFirebase(tabId, updated, true);

      return {
        ...prev,
        [tabId]: updated,
      };
    });
  }, [pushRowsToFirebase, isReadOnlyViewer]);

  // Action: Clear row contents
  const clearRowAt = useCallback((tabId, index) => {
    if (isReadOnlyViewer) return;
    setTabRows((prev) => {
      const currentRows = prev[tabId] ? [...prev[tabId]] : [];
      if (!currentRows[index]) return prev;

      const updated = [...currentRows];
      updated[index] = {
        ...updated[index],
        date: '',
        narration: '',
        debit: '',
        credit: '',
      };

      saveLocalTabRows(tabId, updated);
      pushRowsToFirebase(tabId, updated);

      return {
        ...prev,
        [tabId]: updated,
      };
    });
  }, [pushRowsToFirebase, isReadOnlyViewer]);

  // Action: Reset tab to 20 empty rows
  const resetTabRows = useCallback((tabId) => {
    if (isReadOnlyViewer) return;
    const default20 = generateDefaultRows(20);
    setTabRows((prev) => ({
      ...prev,
      [tabId]: default20,
    }));
    saveLocalTabRows(tabId, default20);
    pushRowsToFirebase(tabId, default20);
  }, [pushRowsToFirebase, isReadOnlyViewer]);

  // Action: Rename tab
  const renameTab = useCallback((tabId, newName) => {
    if (isReadOnlyViewer) return;
    const trimmed = newName?.trim();
    if (!trimmed) return;

    setTabs((prev) => {
      const updated = prev.map((t) => (t.id === tabId ? { ...t, name: trimmed } : t));
      saveLocalTabMetadata(updated);
      pushTabsToFirebase(updated);
      return updated;
    });
  }, [pushTabsToFirebase, isReadOnlyViewer]);

  // Action: Add new custom tab
  const addNewTab = useCallback((customName) => {
    if (isReadOnlyViewer) return null;
    const newId = `tab_${Date.now()}`;
    const name = customName?.trim() || `Category ${tabs.length + 1}`;
    const newTab = { id: newId, defaultName: name, name, isDefault: false };
    const updatedTabs = [...tabs, newTab];
    const initialRows = generateDefaultRows(20);

    setTabs(updatedTabs);
    saveLocalTabMetadata(updatedTabs);
    pushTabsToFirebase(updatedTabs);

    setTabRows((prev) => ({
      ...prev,
      [newId]: initialRows,
    }));
    saveLocalTabRows(newId, initialRows);
    pushRowsToFirebase(newId, initialRows);

    setActiveTabId(newId);
    return newTab;
  }, [tabs, pushTabsToFirebase, pushRowsToFirebase, isReadOnlyViewer]);

  /**
   * Action: Delete Tab with Password "7722" Verification and Safety Backup
   */
  const deleteTab = useCallback(async (tabId, password) => {
    if (isReadOnlyViewer) {
      return {
        success: false,
        error: 'Read-only viewer cannot delete tabs.',
      };
    }

    // 1. Authenticate with encrypted password verification ("7722")
    if (!verifyDeletionPassword(password)) {
      return {
        success: false,
        error: 'Invalid security password. Access denied.',
      };
    }

    const tabToDelete = tabs.find((t) => t.id === tabId);
    if (!tabToDelete) {
      return {
        success: false,
        error: 'Tab not found.',
      };
    }

    // Require at least one remaining tab
    if (tabs.length <= 1) {
      return {
        success: false,
        error: 'Cannot delete the only remaining tab.',
      };
    }

    try {
      // 2. Automatically create a disaster-recovery backup snapshot before deletion
      const backupSnapshot = createBackupSnapshot(
        tabs,
        tabRows,
        `Pre-Deletion: ${tabToDelete.name || tabToDelete.id}`,
        'pre_delete'
      );
      
      // Save backup snapshot to Firebase cloud if connected
      saveBackupToFirebase(backupSnapshot).catch(() => {});

      // 3. Remove tab metadata & rows from LocalStorage
      const remainingTabs = deleteLocalTab(tabId);

      // 4. Remove tab from Firebase Realtime Database
      deleteTabFromFirebase(tabId).catch((err) => {
        console.warn(`Firebase tab delete cleanup error:`, err);
      });

      // 5. Update in-memory state
      setTabs(remainingTabs);
      setTabRows((prev) => {
        const next = { ...prev };
        delete next[tabId];
        return next;
      });

      // 6. Push remaining tabs metadata to Firebase
      pushTabsToFirebase(remainingTabs);

      // 7. If the deleted tab was active, switch active tab to an existing tab
      if (activeTabId === tabId) {
        setActiveTabId(remainingTabs[0].id);
      }

      return {
        success: true,
        message: `Tab "${tabToDelete.name || tabToDelete.defaultName}" deleted successfully. Safety backup created.`,
        backupId: backupSnapshot.id,
      };
    } catch (err) {
      console.error('Error during tab deletion:', err);
      return {
        success: false,
        error: 'Failed to delete tab: ' + err.message,
      };
    }
  }, [tabs, tabRows, activeTabId, pushTabsToFirebase, isReadOnlyViewer]);

  /**
   * Action: Create Manual Backup Snapshot
   */
  const createManualBackup = useCallback((label = 'Manual Snapshot') => {
    try {
      const snapshot = createBackupSnapshot(tabs, tabRows, label, 'manual');
      saveBackupToFirebase(snapshot).catch(() => {});
      return { success: true, snapshot };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [tabs, tabRows]);

  /**
   * Action: Restore Database from Snapshot
   */
  const restoreBackup = useCallback(async (snapshot) => {
    if (isReadOnlyViewer) {
      return { success: false, error: 'Read-only viewer cannot restore database.' };
    }

    if (!snapshot || !Array.isArray(snapshot.tabs) || !snapshot.tabRows) {
      return { success: false, error: 'Invalid snapshot data structure.' };
    }

    try {
      // Create a safety backup of current state before restoring
      createBackupSnapshot(tabs, tabRows, 'Pre-Restore Safety Rollback', 'pre_restore');

      const restoredTabs = snapshot.tabs;
      const restoredTabRows = snapshot.tabRows;

      // 1. Update LocalStorage
      restoreAllLocalData(restoredTabs, restoredTabRows);

      // 2. Update React State
      setTabs(restoredTabs);
      setTabRows(restoredTabRows);

      if (!restoredTabs.some((t) => t.id === activeTabId)) {
        setActiveTabId(restoredTabs[0]?.id || 'polishing');
      }

      // 3. Sync to Firebase Cloud if connected
      pushTabsToFirebase(restoredTabs);
      for (const tab of restoredTabs) {
        const rows = restoredTabRows[tab.id] || [];
        pushRowsToFirebase(tab.id, rows);
      }

      return { success: true, message: 'Database restored successfully!' };
    } catch (err) {
      console.error('Error restoring backup:', err);
      return { success: false, error: 'Restore failed: ' + err.message };
    }
  }, [tabs, tabRows, activeTabId, pushTabsToFirebase, pushRowsToFirebase, isReadOnlyViewer]);

  /**
   * Action: Export Database to JSON File
   */
  const exportBackupFile = useCallback((label) => {
    return exportDatabaseToJsonFile(tabs, tabRows, label);
  }, [tabs, tabRows]);

  /**
   * Action: Import and Restore from JSON String or File Content
   */
  const importBackupFromJson = useCallback(async (jsonString) => {
    const validation = validateBackupJson(jsonString);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const res = await restoreBackup(validation.snapshot);
    return {
      ...res,
      checksumStatus: validation.checksumStatus,
    };
  }, [restoreBackup]);

  /**
   * Action: Manual Reconnect attempt
   */
  const retryConnection = useCallback(async () => {
    setSyncStatus('syncing');
    const res = await checkAndReconnectFirebase();
    if (res.success) {
      setFirebaseConnected(true);
      setSyncStatus('saved');
      setFirebaseError(null);
    } else {
      setFirebaseConnected(false);
      setSyncStatus('offline');
      setFirebaseError(res.message);
    }
    return res;
  }, []);

  // Active tab object and its rows
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0] || DEFAULT_TABS[0];
  const activeRows = tabRows[activeTabId] || [];

  return {
    tabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    tabRows,
    activeRows,
    updateRow,
    addRows,
    insertRowAt,
    deleteRowAt,
    clearRowAt,
    resetTabRows,
    renameTab,
    addNewTab,
    deleteTab,
    createManualBackup,
    restoreBackup,
    exportBackupFile,
    importBackupFromJson,
    retryConnection,
    decimalPrecision,
    setDecimalPrecision,
    syncStatus,
    firebaseConnected,
    firebaseError,
    offlineQueueCount,
    isReadOnlyViewer,
    shareMetadata: sharePayload,
    shareAuthStatus,
    authenticateSharePin,
  };
}
