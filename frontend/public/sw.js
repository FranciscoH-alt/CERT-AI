/**
 * CertAI Service Worker
 *
 * Provides:
 * - Offline fallback page
 * - App shell caching for faster loads
 * - Network-first strategy for API calls
 */

const CACHE_NAME = "certai-v1";
const OFFLINE_URL = "/offline.html";

// Files to cache for offline app shell
const PRECACHE_URLS = [OFFLINE_URL];

// Install: cache offline page
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first with offline fallback
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  // Skip API calls — let them fail naturally
  if (event.request.url.includes("/api/") || event.request.url.includes("supabase")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful page loads
        if (response.status === 200 && event.request.mode === "navigate") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Serve cached version or offline page for navigation requests
        if (event.request.mode === "navigate") {
          return caches.match(event.request).then(
            (cached) => cached || caches.match(OFFLINE_URL)
          );
        }
        return caches.match(event.request);
      })
  );
});
