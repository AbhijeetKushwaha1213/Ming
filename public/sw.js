// Service Worker - Disabled
// This service worker is currently disabled to prevent caching issues during development
// It will clean up old caches and then unregister itself

self.addEventListener('install', (event) => {
  console.log('Service Worker: Install event (disabled)');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate event (disabled)');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Service Worker: Deleting cache', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('Service Worker: All caches cleared');
      return self.clients.claim();
    })
  );
});

// No fetch handler - service worker is disabled
