import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getDatabase, ref, set, remove, onValue, off, get } from 'firebase/database';
import { 
  encryptSensitivePayload, 
  decryptSensitivePayload,
  hashApiKey,
  maskApiKey 
} from './security.js';
import { enqueueMutation, processOfflineQueue } from './syncQueue.js';
import { BUNDLED_FIREBASE_CONFIG, hasBundledFirebaseConfig } from '../config/firebaseConfig.js';

const FIREBASE_CONFIG_STORAGE_KEY = 'gold_loss_firebase_config_secure';
const LEGACY_STORAGE_KEY = 'gold_loss_firebase_config';

let currentApp = null;
let currentDb = null;
let activeListeners = new Map();
let connectionListenerRef = null;
const connectionStateListeners = new Set();
let isOnline = false;

/**
 * Check if the active configuration is custom (user-entered in localStorage)
 */
export const isCustomConfigActive = () => {
  try {
    const custom = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return Boolean(custom);
  } catch {
    return false;
  }
};

/**
 * Check if a host-bundled configuration is available
 */
export const isBundledConfigAvailable = () => {
  return hasBundledFirebaseConfig();
};

/**
 * Get active Firebase config (checks custom encrypted storage first, then falls back to host-bundled config)
 */
export const getStoredFirebaseConfig = () => {
  try {
    // 1. Try custom secure encrypted storage
    const encrypted = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (encrypted) {
      const decrypted = decryptSensitivePayload(encrypted);
      if (
        decrypted && 
        typeof decrypted === 'object' && 
        decrypted.databaseURL && 
        decrypted.apiKey &&
        !decrypted.apiKey.includes('...')
      ) {
        return {
          ...decrypted,
          isCustom: true,
        };
      }
    }

    // 2. Try legacy unencrypted storage and auto-migrate to encrypted
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (
        parsed && 
        typeof parsed === 'object' && 
        parsed.databaseURL && 
        parsed.apiKey &&
        !parsed.apiKey.includes('...')
      ) {
        saveFirebaseConfig(parsed);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return {
          ...parsed,
          isCustom: true,
        };
      }
    }
  } catch (e) {
    console.warn('Failed to parse custom stored Firebase config:', e);
  }

  // 3. Fall back to host-bundled build-time default configuration
  if (hasBundledFirebaseConfig()) {
    return {
      ...BUNDLED_FIREBASE_CONFIG,
      isCustom: false,
      isBundled: true,
    };
  }

  return null;
};

/**
 * Save custom Firebase config (encrypts API keys and secrets)
 */
export const saveFirebaseConfig = (config) => {
  try {
    if (!config || !config.databaseURL || !config.apiKey) {
      localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } else {
      // Encrypt config payload before storing
      const cleanConfig = {
        apiKey: config.apiKey.trim(),
        authDomain: (config.authDomain || '').trim(),
        databaseURL: config.databaseURL.trim(),
        projectId: (config.projectId || '').trim(),
        storageBucket: (config.storageBucket || '').trim(),
        messagingSenderId: (config.messagingSenderId || '').trim(),
        appId: (config.appId || '').trim(),
      };
      const encrypted = encryptSensitivePayload(cleanConfig);
      localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, encrypted);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    // Re-initialize Firebase service
    return initFirebaseService();
  } catch (e) {
    console.error('Error saving encrypted Firebase config:', e);
    throw e;
  }
};

/**
 * Reset configuration to host-bundled defaults
 */
export const resetToBundledConfig = () => {
  try {
    localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return initFirebaseService();
  } catch (e) {
    console.error('Error resetting to bundled config:', e);
    throw e;
  }
};

let isReadOnlyMode = false;

export const setReadOnlySession = (readOnly = true) => {
  isReadOnlyMode = Boolean(readOnly);
};

export const getIsReadOnlySession = () => isReadOnlyMode;

/**
 * Initialize Firebase service & connection monitors
 */
export const initFirebaseService = (customConfig = null) => {
  const config = customConfig || getStoredFirebaseConfig();
  if (!config || !config.databaseURL || !config.apiKey) {
    currentApp = null;
    currentDb = null;
    notifyConnectionState(false, 'No Firebase credentials configured.');
    return { initialized: false, error: 'No Firebase configuration provided.' };
  }

  // If already initialized with the exact same databaseURL, keep existing app and continuous listeners!
  if (
    currentDb &&
    currentApp &&
    currentApp.options?.databaseURL === config.databaseURL &&
    currentApp.options?.apiKey === config.apiKey
  ) {
    return { initialized: true, db: currentDb, app: currentApp };
  }

  // Clear any existing listeners ONLY when config changes or on fresh initialization
  activeListeners.forEach((listener) => {
    try {
      if (typeof listener === 'function') {
        listener();
      } else {
        off(listener);
      }
    } catch {
      // ignore
    }
  });
  activeListeners.clear();

  if (connectionListenerRef) {
    try {
      off(connectionListenerRef);
    } catch {
      // ignore
    }
    connectionListenerRef = null;
  }

  try {
    const existingApps = getApps();
    const appName = customConfig ? 'viewerRealtimeApp' : '[DEFAULT]';
    const foundApp = existingApps.find((a) => a.name === appName);

    if (foundApp) {
      if (
        foundApp.options.databaseURL === config.databaseURL &&
        foundApp.options.apiKey === config.apiKey
      ) {
        currentApp = foundApp;
      } else {
        deleteApp(foundApp).catch(() => {});
        currentApp = initializeApp(config, appName === '[DEFAULT]' ? undefined : `${appName}_${Date.now()}`);
      }
    } else {
      currentApp = initializeApp(config, appName === '[DEFAULT]' ? undefined : appName);
    }
    currentDb = getDatabase(currentApp, config.databaseURL);

    // Monitor Firebase connection state
    try {
      const connectedRef = ref(currentDb, '.info/connected');
      connectionListenerRef = connectedRef;
      onValue(connectedRef, (snap) => {
        const connected = snap.val() === true;
        isOnline = connected;
        notifyConnectionState(connected, connected ? 'Connected' : 'Offline / Reconnecting');
        
        if (connected) {
          flushPendingOfflineQueue();
        }
      });
    } catch (e) {
      console.warn('Could not attach .info/connected listener:', e);
    }

    return { initialized: true, db: currentDb, app: currentApp };
  } catch (err) {
    console.error('Firebase initialization failed:', err);
    currentApp = null;
    currentDb = null;
    notifyConnectionState(false, err.message);
    return { initialized: false, error: err.message };
  }
};

const notifyConnectionState = (connected, message) => {
  connectionStateListeners.forEach((fn) => {
    try {
      fn(connected, message);
    } catch {
      // ignore
    }
  });
};

export const subscribeToFirebaseConnectionState = (callback) => {
  connectionStateListeners.add(callback);
  callback(Boolean(currentDb && isOnline), isOnline ? 'Connected' : 'Offline');
  return () => connectionStateListeners.delete(callback);
};

/**
 * Subscribe to a Realtime Database path
 */
export const subscribeToPath = (path, callback, onError) => {
  if (!currentDb) {
    const res = initFirebaseService();
    if (!res.initialized || !currentDb) {
      if (onError) onError(new Error('Firebase Realtime Database is not configured.'));
      return () => {};
    }
  }

  try {
    const dbRef = ref(currentDb, path);
    const unsub = onValue(
      dbRef,
      (snapshot) => {
        const val = snapshot.val();
        callback(val);
      },
      (error) => {
        console.error(`Firebase error reading ${path}:`, error);
        if (onError) onError(error);
      }
    );

    activeListeners.set(path, unsub);

    return () => {
      try {
        if (typeof unsub === 'function') {
          unsub();
        } else {
          off(dbRef);
        }
      } catch {
        // ignore
      }
      activeListeners.delete(path);
    };
  } catch (err) {
    console.error('Failed to subscribe to Firebase path:', err);
    if (onError) onError(err);
    return () => {};
  }
};

/**
 * Read data once from a Firebase path (used for fallback polling and snapshot verification)
 */
export const readFromPath = async (path) => {
  if (!currentDb) {
    const res = initFirebaseService();
    if (!res.initialized || !currentDb) return null;
  }
  try {
    const dbRef = ref(currentDb, path);
    const snap = await get(dbRef);
    return snap.exists() ? snap.val() : null;
  } catch (err) {
    console.warn(`Error reading path ${path}:`, err);
    return null;
  }
};

/**
 * Write data to Firebase path with failure protection & offline queuing
 */
export const writeToPath = async (path, data) => {
  if (isReadOnlyMode) {
    console.warn(`Write to ${path} blocked: Active session is in Read-Only viewer mode.`);
    return;
  }

  if (!currentDb) {
    const res = initFirebaseService();
    if (!res.initialized || !currentDb) {
      enqueueMutation(path, data, 'SET');
      return;
    }
  }

  try {
    const dbRef = ref(currentDb, path);
    await set(dbRef, data);
  } catch (err) {
    console.warn(`Direct write to ${path} failed, enqueuing for retry:`, err);
    enqueueMutation(path, data, 'SET');
    throw err;
  }
};

/**
 * Remove / Delete data at Firebase path
 */
export const removePath = async (path) => {
  if (isReadOnlyMode) {
    console.warn(`Remove on ${path} blocked: Active session is in Read-Only viewer mode.`);
    return;
  }

  if (!currentDb) {
    const res = initFirebaseService();
    if (!res.initialized || !currentDb) {
      enqueueMutation(path, null, 'REMOVE');
      return;
    }
  }

  try {
    const dbRef = ref(currentDb, path);
    await remove(dbRef);
  } catch (err) {
    console.warn(`Direct remove on ${path} failed, enqueuing for retry:`, err);
    enqueueMutation(path, null, 'REMOVE');
    throw err;
  }
};

/**
 * Flush pending offline mutations
 */
export const flushPendingOfflineQueue = async () => {
  if (isReadOnlyMode || !currentDb) return;
  return processOfflineQueue(async (path, data, action) => {
    if (action === 'REMOVE') {
      const dbRef = ref(currentDb, path);
      await remove(dbRef);
    } else {
      const dbRef = ref(currentDb, path);
      await set(dbRef, data);
    }
  });
};

/**
 * Delete a tab completely from Firebase
 */
export const deleteTabFromFirebase = async (tabId) => {
  try {
    await removePath(`ledgers/${tabId}`);
  } catch (e) {
    console.error(`Error deleting tab ${tabId} from Firebase:`, e);
  }
};

/**
 * Save a backup snapshot to Firebase Realtime Database
 */
export const saveBackupToFirebase = async (snapshot) => {
  if (!currentDb) return;
  try {
    const backupSummary = {
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      isoDate: snapshot.isoDate,
      label: snapshot.label,
      checksum: snapshot.checksum,
      stats: snapshot.stats,
      tabs: snapshot.tabs,
      tabRows: snapshot.tabRows,
    };
    await writeToPath(`backups/${snapshot.id}`, backupSummary);
  } catch (e) {
    console.warn('Failed to upload backup to Firebase cloud:', e);
  }
};

/**
 * Test Firebase Connection with provided credentials
 */
export const testFirebaseConnection = async (config) => {
  let tempApp = null;
  try {
    const tempAppName = `test-app-${Date.now()}`;
    tempApp = initializeApp(config, tempAppName);
    const testDb = getDatabase(tempApp, config.databaseURL);
    
    // Attempt a quick ping test
    const pingRef = ref(testDb, '_ping_test');
    await set(pingRef, { timestamp: Date.now(), status: 'ok' });
    
    return { 
      success: true, 
      message: 'Successfully connected to Firebase Realtime Database!',
      keyFingerprint: hashApiKey(config.apiKey),
      maskedKey: maskApiKey(config.apiKey),
    };
  } catch (err) {
    return { success: false, message: err.message || 'Failed to connect to Firebase.' };
  } finally {
    if (tempApp) {
      try {
        await deleteApp(tempApp);
      } catch {
        // ignore
      }
    }
  }
};

/**
 * Actively test and reconnect to Firebase Database service
 */
export const checkAndReconnectFirebase = async () => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { 
      success: false, 
      message: 'Your computer or device has no active internet connection.' 
    };
  }

  const config = getStoredFirebaseConfig();
  if (!config || !config.databaseURL || !config.apiKey) {
    return { 
      success: false, 
      message: 'No Firebase cloud database credentials are configured.' 
    };
  }

  try {
    const testResult = await testFirebaseConnection(config);
    if (testResult.success) {
      initFirebaseService();
      await flushPendingOfflineQueue();
      return { 
        success: true, 
        message: 'Successfully connected to Firebase Realtime Database!' 
      };
    } else {
      return { 
        success: false, 
        message: testResult.message || 'Firebase database server remains unreachable.' 
      };
    }
  } catch (err) {
    return { 
      success: false, 
      message: err.message || 'Reconnection attempt timed out or failed.' 
    };
  }
};

// Listen for browser online event
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    flushPendingOfflineQueue();
  });
  window.addEventListener('offline', () => {
    isOnline = false;
    notifyConnectionState(false, 'Device is offline');
  });
}

// Initial initialization
initFirebaseService();
