/**
 * Host-Bundled Firebase Default Configuration
 * - Bundled with the web application at build / host time
 * - Connects out-of-the-box without requiring users to input credentials in Settings
 * - Vite environment variables (VITE_FIREBASE_*) override or fill in default credentials
 */

export const BUNDLED_FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

/**
 * Check if a valid bundled host config exists
 */
export const hasBundledFirebaseConfig = () => {
  return Boolean(
    BUNDLED_FIREBASE_CONFIG.databaseURL && 
    BUNDLED_FIREBASE_CONFIG.apiKey &&
    !BUNDLED_FIREBASE_CONFIG.apiKey.startsWith('AIzaSy...')
  );
};
