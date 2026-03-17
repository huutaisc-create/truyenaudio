const CACHE_NAME = 'tts-models-v1';
const SHELL_CACHE = 'app-shell-v1';

// File TTS model cần cache lâu dài
const CACHEABLE_PATTERNS = [
  /\/models\/custom\/.*\.onnx$/,
  /\/models\/custom\/.*\.onnx\.json$/,
  /\/piper-wasm\//,
];

// App shell — cache offline
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

const shouldCacheModel = (url) => CACHEABLE_PATTERNS.some(p => p.test(url));

// Install — pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        // Không fail install nếu một số shell file chưa có
        console.warn('[SW] Shell cache partial fail:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate — xóa cache cũ
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== SHELL_CACHE)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // TTS model files — cache-first (lưu vĩnh viễn)
  if (shouldCacheModel(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) {
          console.log('[SW] Model from cache:', url.pathname);
          return cached;
        }
        console.log('[SW] Fetching & caching model:', url.pathname);
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (err) {
          console.error('[SW] Model fetch failed:', err);
          throw err;
        }
      })
    );
    return;
  }

  // App shell — stale-while-revalidate
  if (event.request.mode === 'navigate' || APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        }).catch(() => null);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Còn lại — không intercept, browser tự xử lý
});
