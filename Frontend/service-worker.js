const CACHE_NAME = 'roster-cache-v2';
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
      .then(cache => cache.addAll(urlsToCache))
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
  const url = new URL(event.request.url);

  // 1) Ignorar peticiones que no sean http/https (extensiones, data:, blob:, etc.)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return; // Dejamos que el navegador las maneje normalmente
  }

  // 2) No interceptar llamadas a la API
  if (url.pathname.includes('/api/')) return;

  // 3) Solo cachear peticiones GET (la API Cache no soporta POST/PUT)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Solo cachear respuestas válidas
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          // Usamos waitUntil para asegurar que el guardado se complete
          event.waitUntil(
            caches.open(CACHE_NAME).then(cache => {
              return cache.put(event.request, responseClone);
            })
          );
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, buscar en caché
        return caches.match(event.request);
      })
  );
});