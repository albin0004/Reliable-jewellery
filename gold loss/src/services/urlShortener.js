/**
 * URL Shortener Service
 * - Integrates resilient URL shortener providers (spoo.me, clck.ru, TinyURL)
 * - Automatically generates compact, user-friendly share links
 * - Implements smart fallback and caching
 * - Resolves hosted domain for file:/// and web environments
 */

const SHORTENER_CACHE_KEY = 'gold_loss_short_url_cache';
const HOSTED_BASE_URL_KEY = 'gold_loss_hosted_base_url';
const DEFAULT_HOSTED_URL = 'https://albin0004.github.io/Reliable-jewellery/gold%20loss/';

const memoryCache = new Map();

/**
 * Get the target base URL for hosted access
 * - Uses current origin and path if running over http/https
 * - Falls back to configured or default public domain if running from file:///
 */
export function getHostedBaseUrl() {
  try {
    const saved = localStorage.getItem(HOSTED_BASE_URL_KEY);
    if (saved && saved.trim() && !saved.includes('gold-loss.firebaseapp.com')) {
      return saved.trim().replace(/\/+$/, '');
    }
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const origin = window.location.origin;
    const pathname = window.location.pathname;

    if (protocol === 'http:' || protocol === 'https:') {
      if (origin && origin !== 'null') {
        return `${origin}${pathname}`.replace(/\/+$/, '');
      }
    }
  }

  return DEFAULT_HOSTED_URL;
}

/**
 * Set custom hosted base URL
 */
export function setHostedBaseUrl(url) {
  try {
    if (!url || !url.trim() || url.trim() === DEFAULT_HOSTED_URL) {
      localStorage.removeItem(HOSTED_BASE_URL_KEY);
    } else {
      localStorage.setItem(HOSTED_BASE_URL_KEY, url.trim().replace(/\/+$/, ''));
    }
  } catch {
    // ignore
  }
}

/**
 * Retrieve cached short URL for a given long URL
 */
function getCachedShortUrl(longUrl) {
  if (memoryCache.has(longUrl)) {
    return memoryCache.get(longUrl);
  }
  try {
    const raw = localStorage.getItem(SHORTENER_CACHE_KEY);
    if (raw) {
      const cache = JSON.parse(raw);
      const entry = cache[longUrl];
      if (entry && entry.shortUrl) {
        // Cache valid for 14 days
        if (!entry.timestamp || Date.now() - entry.timestamp < 14 * 24 * 60 * 60 * 1000) {
          memoryCache.set(longUrl, entry);
          return entry;
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Store shortened URL in cache
 */
function setCachedShortUrl(longUrl, result) {
  const entry = {
    ...result,
    timestamp: Date.now(),
  };
  memoryCache.set(longUrl, entry);
  try {
    const raw = localStorage.getItem(SHORTENER_CACHE_KEY);
    const cache = raw ? JSON.parse(raw) : {};
    cache[longUrl] = entry;

    // Prune cache to max 50 entries
    const keys = Object.keys(cache);
    if (keys.length > 50) {
      delete cache[keys[0]];
    }
    localStorage.setItem(SHORTENER_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

/**
 * Provider 1: spoo.me
 * High speed, HTTPS, CORS enabled, clean short slug
 */
async function shortenWithSpooMe(longUrl, signal) {
  const response = await fetch('https://spoo.me/', {
    method: 'POST',
    signal,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ url: longUrl }),
  });

  if (!response.ok) {
    throw new Error(`spoo.me error: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data || !data.short_url) {
    throw new Error('spoo.me returned an invalid payload');
  }

  // Ensure HTTPS
  const shortUrl = data.short_url.replace(/^http:\/\//i, 'https://');
  return {
    shortUrl,
    provider: 'spoo.me',
  };
}

/**
 * Provider 2: clck.ru
 * Proven reliability, CORS enabled
 */
async function shortenWithClckRu(longUrl, signal) {
  const response = await fetch(`https://clck.ru/--?url=${encodeURIComponent(longUrl)}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`clck.ru error: HTTP ${response.status}`);
  }

  const text = (await response.text()).trim();
  if (!text || !text.startsWith('http')) {
    throw new Error('clck.ru returned invalid output');
  }

  return {
    shortUrl: text,
    provider: 'clck.ru',
  };
}

/**
 * Provider 3: TinyURL fallback via api-create.php
 */
async function shortenWithTinyUrl(longUrl, signal) {
  const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`TinyURL error: HTTP ${response.status}`);
  }

  const text = (await response.text()).trim();
  if (!text || !text.startsWith('http')) {
    throw new Error('TinyURL returned invalid output');
  }

  return {
    shortUrl: text,
    provider: 'tinyurl.com',
  };
}

/**
 * Shorten a URL using provider fallback chain
 * @param {string} longUrl - The full destination URL
 * @param {Object} options
 * @param {boolean} [options.forceRefresh=false] - Bypass local cache
 * @param {number} [options.timeoutMs=8000] - Timeout per attempt
 * @returns {Promise<{ success: boolean, shortUrl: string, provider?: string, error?: string }>}
 */
export async function shortenUrl(longUrl, options = {}) {
  const { forceRefresh = false, timeoutMs = 8000 } = options;

  if (!longUrl || typeof longUrl !== 'string' || !longUrl.startsWith('http')) {
    return {
      success: false,
      shortUrl: longUrl,
      error: 'Cannot shorten non-HTTP/HTTPS URLs.',
    };
  }

  // 1. Check cache first
  if (!forceRefresh) {
    const cached = getCachedShortUrl(longUrl);
    if (cached) {
      return {
        success: true,
        shortUrl: cached.shortUrl,
        provider: cached.provider,
        cached: true,
      };
    }
  }

  // List of providers to attempt in order
  const providers = [
    { name: 'spoo.me', fn: shortenWithSpooMe },
    { name: 'clck.ru', fn: shortenWithClckRu },
    { name: 'tinyurl.com', fn: shortenWithTinyUrl },
  ];

  let lastError = null;

  for (const provider of providers) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const result = await provider.fn(longUrl, controller.signal);
      clearTimeout(timer);

      if (result && result.shortUrl) {
        setCachedShortUrl(longUrl, result);
        return {
          success: true,
          shortUrl: result.shortUrl,
          provider: result.provider,
          cached: false,
        };
      }
    } catch (err) {
      lastError = err;
      console.warn(`[URLShortener] Provider ${provider.name} failed:`, err.message);
    }
  }

  return {
    success: false,
    shortUrl: longUrl,
    error: lastError ? lastError.message : 'All URL shortener services timed out.',
  };
}

/**
 * Clear the URL shortener local cache
 */
export function clearShortenerCache() {
  memoryCache.clear();
  try {
    localStorage.removeItem(SHORTENER_CACHE_KEY);
  } catch {
    // ignore
  }
}
