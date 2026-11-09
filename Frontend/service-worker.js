const CACHE_NAME = 'roster-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './app.html',
  './CSS/variables.css',
  './CSS/reset.css',
  './CSS/layout.css',
  './CSS/components.css',
  './CSS/pages.css',
  './assets/images/Logotipo_deportivo_Roster-removebg-preview2.png',
  './JS/main.js'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Activación y limpieza de cachés viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Estrategia: Network First (Intenta red, si falla usa caché)
self.addEventListener('fetch', event => {
  // No interceptar llamadas a la API (para no servir datos viejos)
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Actualizar caché con la respuesta nueva
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Si falla la red, buscar en caché
        return caches.match(event.request);
      })
  );
});