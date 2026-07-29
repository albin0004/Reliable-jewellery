const CACHE_NAME = 'reliable-jewellery-v9';
const ASSETS = [
    './',
    './index.html',
    './landing.css',
    './manifest.json',
    './icon-192.jpg',
    './icon-512.jpg',
    './firebase-config.js',
    './auth-shield.js',
    './login.html',
    './access-denied.html',
    './quotation/index.html',
    './quotation/style.css',
    './quotation/script.js',
    './diamond/index.html',
    './diamond/style.css',
    './diamond/script.js',
    './loss/index.html',
    './loss/style.css',
    './loss/app.js',
    './NARRATION/index.html',
    './NARRATION/styles.css',
    './NARRATION/app.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Only apply network-first with no-cache for GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request, { cache: 'no-cache' })
            .then((response) => {
                // Check if we received a valid response
                if (!response || response.status !== 200 || response.type !== 'basic' || !event.request.url.startsWith('http')) {
                    return response;
                }

                // Clone the response
                const responseToCache = response.clone();

                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                return response;
            })
            .catch(() => {
                // Network failed, try to serve from cache
                return caches.match(event.request);
            })
    );
});
