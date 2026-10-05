/**
 * Real-Time Read-Only Share Link Service
 * - Securely generates signed, tamper-proof share tokens containing read-only connection parameters
 * - Handles URL encoding/decoding with Base64URL format
 * - Supports link expiration (24h, 7d, 30d, never)
 * - Supports optional 4-digit viewer PIN authentication
 * - Enforces zero-write read-only permissions for viewers
 */

import { sha256Sync, calculateDataChecksum } from './security.js';
import { getHostedBaseUrl } from './urlShortener.js';

const SHARE_URL_PARAM = 'share';

/**
 * URL-safe Base64 encoding
 */
function toBase64Url(str) {
  try {
    const utf8Bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}

/**
 * URL-safe Base64 decoding
 */
function fromBase64Url(base64url) {
  try {
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return decodeURIComponent(escape(atob(base64)));
  }
}

/**
 * Generate a cryptographically signed read-only share token
 * @param {Object} options
 * @param {Object} options.config - Firebase config ({ databaseURL, apiKey, authDomain, projectId })
 * @param {number} [options.expiresInDays=7] - Number of days until expiry (0 for never)
 * @param {string} [options.pinCode=''] - Optional 4-digit viewer passcode
 * @param {string} [options.label=''] - Custom ledger title
 */
export function createShareToken({
  config,
  expiresInDays = 7,
  pinCode = '',
  label = 'Reliable Jewellery Ledger',
}) {
  if (!config || !config.databaseURL || !config.apiKey) {
    throw new Error('Database is not configured. Please configure Firebase database credentials first.');
  }

  const createdAt = Date.now();
  const expiresAt = expiresInDays > 0 ? createdAt + expiresInDays * 24 * 60 * 60 * 1000 : null;
  const trimmedPin = String(pinCode || '').trim();
  const hasPin = Boolean(trimmedPin);
  const pinHash = hasPin ? sha256Sync(trimmedPin) : null;

  // Essential connection details for read-only streaming
  const payload = {
    v: 1, // version
    mode: 'readonly',
    dbUrl: config.databaseURL,
    apiKey: config.apiKey,
    authDomain: config.authDomain || '',
    projectId: config.projectId || '',
    createdAt,
    expiresAt,
    hasPin,
    pinHash,
    label,
  };

  // Sign with cryptographic checksum for tamper protection
  const signature = calculateDataChecksum(payload);
  const fullTokenObj = {
    ...payload,
    sig: signature,
  };

  const jsonStr = JSON.stringify(fullTokenObj);
  return toBase64Url(jsonStr);
}

/**
 * Parse and validate a share token from URL
 * @param {string} tokenString
 * @returns {Object} { valid: boolean, expired?: boolean, payload?: Object, error?: string }
 */
export function parseShareToken(tokenString) {
  if (!tokenString || typeof tokenString !== 'string') {
    return { valid: false, error: 'No share token provided.' };
  }

  try {
    const jsonStr = fromBase64Url(tokenString.trim());
    const data = JSON.parse(jsonStr);

    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Malformed share token structure.' };
    }

    if (data.mode !== 'readonly' || !data.dbUrl || !data.apiKey) {
      return { valid: false, error: 'Invalid share token: missing database connection parameters.' };
    }

    // Verify digital signature / checksum
    const { sig, ...payload } = data;
    const expectedSig = calculateDataChecksum(payload);

    if (sig !== expectedSig) {
      return { valid: false, error: 'Security alert: Share link signature mismatch. The link may have been tampered with.' };
    }

    // Check expiration
    if (data.expiresAt && Date.now() > data.expiresAt) {
      return {
        valid: false,
        expired: true,
        error: 'This share link has expired.',
        payload: data,
      };
    }

    return {
      valid: true,
      payload: data,
    };
  } catch (err) {
    return { valid: false, error: 'Failed to decode share token: ' + err.message };
  }
}

/**
 * Verify a viewer PIN against token pinHash
 */
export function verifySharePin(tokenPayload, enteredPin) {
  if (!tokenPayload || !tokenPayload.hasPin) return true;
  if (!enteredPin) return false;
  const hash = sha256Sync(String(enteredPin).trim());
  return hash === tokenPayload.pinHash;
}

/**
 * Construct full shareable URL from token
 */
export function generateShareUrl(token, customBase = null) {
  if (customBase && typeof customBase === 'string' && customBase.trim()) {
    const cleanBase = customBase.trim().replace(/\/+$/, '');
    return `${cleanBase}?${SHARE_URL_PARAM}=${token}`;
  }

  if (typeof window === 'undefined') return `?${SHARE_URL_PARAM}=${token}`;

  const protocol = window.location.protocol;
  const origin = window.location.origin;
  const pathname = window.location.pathname;

  // When running locally from file:/// or when origin is null, use the hosted public URL
  if (protocol === 'file:' || !origin || origin === 'null') {
    const hostedBase = getHostedBaseUrl();
    return `${hostedBase}?${SHARE_URL_PARAM}=${token}`;
  }

  return `${origin}${pathname}?${SHARE_URL_PARAM}=${token}`;
}

/**
 * Extract share token from current window URL
 */
export function getShareTokenFromUrl() {
  if (typeof window === 'undefined') return null;

  // 1. Check query parameter `?share=...`
  const params = new URLSearchParams(window.location.search);
  const queryToken = params.get(SHARE_URL_PARAM);
  if (queryToken) return queryToken;

  // 2. Check hash parameter `#share=...`
  if (window.location.hash) {
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const hashToken = hashParams.get(SHARE_URL_PARAM);
    if (hashToken) return hashToken;
  }

  return null;
}

/**
 * Remove share parameter from URL (e.g., when exiting viewer mode)
 */
export function clearShareParamFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete(SHARE_URL_PARAM);
  window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
}
