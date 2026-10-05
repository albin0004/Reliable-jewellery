/**
 * Normalizes data structures received from Firebase Realtime Database
 * Firebase RTDB converts arrays with deleted indices or non-contiguous keys into Objects
 * These helpers guarantee clean, sorted arrays in all scenarios.
 */

/**
 * Normalizes rows data from Firebase snapshot into a sorted JavaScript array
 */
export const normalizeRowsArray = (val) => {
  if (!val) return [];

  // If already a clean array
  if (Array.isArray(val)) {
    return val.filter((item) => item && typeof item === 'object');
  }

  // If Firebase converted array to object map: { "0": {...}, "1": {...} } or { id1: {...} }
  if (typeof val === 'object') {
    const keys = Object.keys(val);
    if (keys.length === 0) return [];

    // Sort numeric keys or string keys
    const sortedKeys = keys.sort((a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });

    return sortedKeys
      .map((k) => val[k])
      .filter((item) => item && typeof item === 'object');
  }

  return [];
};

/**
 * Normalizes tabs metadata from Firebase snapshot into a clean JavaScript array
 */
export const normalizeTabsArray = (val) => {
  if (!val) return null;

  if (Array.isArray(val)) {
    const filtered = val.filter((tab) => tab && typeof tab === 'object' && tab.id);
    return filtered.length > 0 ? filtered : null;
  }

  if (typeof val === 'object') {
    const keys = Object.keys(val);
    if (keys.length === 0) return null;

    const sortedKeys = keys.sort((a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });

    const list = sortedKeys
      .map((k) => val[k])
      .filter((tab) => tab && typeof tab === 'object' && tab.id);

    return list.length > 0 ? list : null;
  }

  return null;
};
