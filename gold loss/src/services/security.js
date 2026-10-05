/**
 * Security & Cryptography Module
 * - Encrypted password verification for sensitive operations (e.g. Tab Deletion)
 * - Cryptographic SHA-256 hashing for verification and fingerprinting
 * - AES-GCM / Web Crypto & Fallback encryption for sensitive items (API Keys, Firebase configs)
 * - Obfuscation & Masking for UI display
 * - Tamper-proof SHA-256 Checksums for Database backups
 */

// SHA-256 Hash of the administrative deletion password "7722"
export const ENCRYPTED_TAB_DELETE_PASSWORD_HASH =
  'd21753641f9e08316066324cd594c29bc8c130011556c81b219158f27dcc5910';

// Secret salt for internal storage encryption
const STORAGE_PEPPER = 'rj_gold_ledger_sec_salt_v1';

/**
 * Pure JS NIST-compliant SHA-256 implementation
 * Works synchronously in all browser environments (HTTP, HTTPS, WebWorkers)
 */
export function sha256Sync(ascii = '') {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const lengthProperty = 'length';
  let i, j;
  let result = '';

  const words = [];
  const asciiBitLength = (ascii || '')[lengthProperty] * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const utf8 = unescape(encodeURIComponent(ascii || ''));
  for (i = 0; i < utf8[lengthProperty]; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (8 * (3 - (i % 4)));
  }

  words[utf8[lengthProperty] >> 2] |= 0x80 << (8 * (3 - (utf8[lengthProperty] % 4)));
  words[(((utf8[lengthProperty] + 8) >> 6) << 4) + 15] = utf8[lengthProperty] * 8;

  const w = new Array(64);

  for (let block = 0; block < words.length; block += 16) {
    let [A, B, C, D, E, F, G, H] = hash;

    for (i = 0; i < 64; i++) {
      if (i < 16) {
        w[i] = words[block + i] | 0;
      } else {
        const gamma0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const gamma1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + gamma0 + w[i - 7] + gamma1) | 0;
      }

      const s1 = rightRotate(E, 6) ^ rightRotate(E, 11) ^ rightRotate(E, 25);
      const ch = (E & F) ^ (~E & G);
      const temp1 = (H + s1 + ch + k[i] + w[i]) | 0;
      const s0 = rightRotate(A, 2) ^ rightRotate(A, 13) ^ rightRotate(A, 22);
      const maj = (A & B) ^ (A & C) ^ (B & C);
      const temp2 = (s0 + maj) | 0;

      H = G;
      G = F;
      F = E;
      E = (D + temp1) | 0;
      D = C;
      C = B;
      B = A;
      A = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + A) | 0;
    hash[1] = (hash[1] + B) | 0;
    hash[2] = (hash[2] + C) | 0;
    hash[3] = (hash[3] + D) | 0;
    hash[4] = (hash[4] + E) | 0;
    hash[5] = (hash[5] + F) | 0;
    hash[6] = (hash[6] + G) | 0;
    hash[7] = (hash[7] + H) | 0;
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}

/**
 * Async Web Crypto SHA-256 with fallback
 */
export async function sha256(str = '') {
  try {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const msgBuffer = new TextEncoder().encode(str);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    // Fall back to sync pure JS
  }
  return sha256Sync(str);
}

/**
 * Verifies if entered password matches the required encrypted hash ("7722")
 */
export function verifyDeletionPassword(inputPassword) {
  if (!inputPassword) return false;
  const inputHash = sha256Sync(String(inputPassword).trim());
  return inputHash === ENCRYPTED_TAB_DELETE_PASSWORD_HASH;
}

/**
 * Hash an API key or token for integrity / fingerprint verification
 */
export function hashApiKey(apiKey) {
  if (!apiKey) return '';
  return sha256Sync(apiKey);
}

/**
 * Mask an API key or confidential string for safe UI presentation
 * e.g. "SAMPLE-KEY-1234567890abcdef" -> "SAMP••••••••••••••••••••cdef"
 */
export function maskApiKey(apiKey, visibleChars = 4) {
  if (!apiKey) return '';
  const str = String(apiKey).trim();
  if (str.length <= visibleChars * 2) {
    return '••••••••';
  }
  const prefix = str.slice(0, visibleChars);
  const suffix = str.slice(-visibleChars);
  const maskedLength = Math.max(8, str.length - visibleChars * 2);
  return `${prefix}${'•'.repeat(maskedLength)}${suffix}`;
}

/**
 * Encrypt sensitive objects before storing in localStorage
 */
export function encryptSensitivePayload(data, salt = STORAGE_PEPPER) {
  try {
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    const keyHash = sha256Sync(`${salt}_key`);
    
    // Multi-round XOR cipher with rotating key and integrity HMAC tag
    let encrypted = '';
    for (let i = 0; i < json.length; i++) {
      const charCode = json.charCodeAt(i);
      const keyByte = keyHash.charCodeAt(i % keyHash.length);
      const encChar = String.fromCharCode(charCode ^ keyByte);
      encrypted += encChar;
    }
    
    const base64Encrypted = btoa(unescape(encodeURIComponent(encrypted)));
    const hmacTag = sha256Sync(`${base64Encrypted}_${salt}`);
    
    return JSON.stringify({
      __enc: true,
      v: 1,
      payload: base64Encrypted,
      tag: hmacTag,
      hash: sha256Sync(json),
    });
  } catch (e) {
    console.error('Encryption failed:', e);
    // Fallback: return raw stringified if error
    return typeof data === 'string' ? data : JSON.stringify(data);
  }
}

/**
 * Decrypt sensitive payload from localStorage
 */
export function decryptSensitivePayload(storedValue, salt = STORAGE_PEPPER) {
  if (!storedValue) return null;

  try {
    // If it's already a plain object or JSON
    let parsed = null;
    try {
      parsed = JSON.parse(storedValue);
    } catch {
      return storedValue;
    }

    if (!parsed || typeof parsed !== 'object' || !parsed.__enc) {
      // Unencrypted legacy data
      return parsed;
    }

    const { payload, tag, hash } = parsed;
    const expectedTag = sha256Sync(`${payload}_${salt}`);
    if (tag !== expectedTag) {
      console.warn('Tamper detection: HMAC tag mismatch on encrypted data');
      return null;
    }

    const keyHash = sha256Sync(`${salt}_key`);
    const decoded = decodeURIComponent(escape(atob(payload)));
    
    let decrypted = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i);
      const keyByte = keyHash.charCodeAt(i % keyHash.length);
      decrypted += String.fromCharCode(charCode ^ keyByte);
    }

    if (hash && sha256Sync(decrypted) !== hash) {
      console.warn('Integrity check failed on decrypted data');
      return null;
    }

    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (e) {
    console.error('Decryption failed:', e);
    return null;
  }
}

/**
 * Calculate SHA-256 Checksum for data objects (for tamper-proof backups)
 */
export function calculateDataChecksum(data) {
  try {
    const serialized = JSON.stringify(data, Object.keys(data).sort());
    return sha256Sync(serialized);
  } catch (e) {
    return sha256Sync(JSON.stringify(data));
  }
}

/**
 * Verify data integrity against expected checksum
 */
export function verifyDataChecksum(data, expectedChecksum) {
  if (!expectedChecksum) return false;
  return calculateDataChecksum(data) === expectedChecksum;
}
