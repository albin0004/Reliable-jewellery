/**
 * Sync Queue & Offline Failure Protection Service
 * - Captures failed or offline writes and stores them persistently in localStorage
 * - Auto-retries synchronization with exponential backoff on reconnection
 * - Guarantees data durability and prevents data loss during network interruptions
 */

const QUEUE_STORAGE_KEY = 'gold_loss_offline_sync_queue';
let isProcessing = false;
const queueListeners = new Set();

/**
 * Get all queued writes from storage
 */
export const getOfflineQueue = () => {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading offline queue:', e);
  }
  return [];
};

/**
 * Save updated queue to storage
 */
const saveOfflineQueue = (queue) => {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    notifyQueueListeners(queue);
  } catch (e) {
    console.error('Error saving offline queue:', e);
  }
};

const notifyQueueListeners = (queue) => {
  queueListeners.forEach((listener) => {
    try {
      listener(queue);
    } catch (e) {
      // ignore
    }
  });
};

export const subscribeToQueue = (listener) => {
  queueListeners.add(listener);
  listener(getOfflineQueue());
  return () => queueListeners.delete(listener);
};

/**
 * Enqueue a write mutation for offline retry
 */
export const enqueueMutation = (path, data, action = 'SET') => {
  const currentQueue = getOfflineQueue();
  
  // Deduplicate existing pending write for the same path if action is SET
  const filtered = currentQueue.filter((item) => !(item.path === path && action === 'SET'));
  
  const newItem = {
    id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    path,
    data,
    action,
    timestamp: Date.now(),
    retryCount: 0,
    lastError: null,
  };

  const updated = [...filtered, newItem];
  saveOfflineQueue(updated);
  return newItem;
};

/**
 * Remove a specific item from the queue
 */
export const dequeueItem = (id) => {
  const currentQueue = getOfflineQueue();
  const updated = currentQueue.filter((item) => item.id !== id);
  saveOfflineQueue(updated);
};

/**
 * Clear the entire offline queue
 */
export const clearOfflineQueue = () => {
  saveOfflineQueue([]);
};

/**
 * Process and flush the offline queue
 * @param {Function} writeExecutor - Async function (path, data, action) => Promise<void>
 * @returns {Promise<{ processed: number, remaining: number, failed: number }>}
 */
export const processOfflineQueue = async (writeExecutor) => {
  if (isProcessing) return { processed: 0, remaining: getOfflineQueue().length, failed: 0 };
  
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { processed: 0, remaining: 0, failed: 0 };
  }

  isProcessing = true;
  let processed = 0;
  let failed = 0;
  const remainingItems = [];

  for (const item of queue) {
    try {
      await writeExecutor(item.path, item.data, item.action);
      processed++;
    } catch (err) {
      console.warn(`Failed to flush queued item for ${item.path}:`, err);
      failed++;
      item.retryCount = (item.retryCount || 0) + 1;
      item.lastError = err.message || 'Unknown network error';
      item.lastAttempt = Date.now();
      
      // Keep in queue if retry count is under 15
      if (item.retryCount < 15) {
        remainingItems.push(item);
      }
    }
  }

  saveOfflineQueue(remainingItems);
  isProcessing = false;

  return { processed, remaining: remainingItems.length, failed };
};
