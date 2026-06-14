/* ============================================================
   Bora Brasil! — Service Worker (v3 CORRIGIDO)
   Cache-first para assets locais
   Network-first para Google Sheets + proxy CORS
   ============================================================ */

const CACHE_NAME = 'bora-brasil-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png'
];

/* Instalação — pré-cache dos recursos essenciais */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* Ativação — limpa caches antigos */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* Fetch — estratégia inteligente por origem */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* ========================================
     1) API ALLORIGINS (PROXY CORS) — network-first
        CRÍTICO para sincronização de placares!
     ======================================== */
  if (url.hostname.includes('api.allorigins.win')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            /* NÃO cacheia proxy — sempre quer dados frescos */
            return response;
          }
          return response;
        })
        .catch(() => {
          /* Se offline, tenta cache antigo (pode estar desatualizado) */
          return caches.match(request) || new Response('Offline — sincronização indisponível');
        })
    );
    return;
  }

  /* ========================================
     2) GOOGLE SHEETS — network-first
        (sempre tenta rede para sincronização)
     ======================================== */
  if (url.hostname.includes('docs.google.com') || 
      url.hostname.includes('sheets.google.com')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          /* Se offline, tenta cache (pode estar desatualizado mas funciona) */
          return caches.match(request) || new Response('Offline');
        })
    );
    return;
  }

  /* ========================================
     3) YOUTUBE — sempre permitir (não cacheia)
     ======================================== */
  if (url.hostname.includes('youtube.com') || 
      url.hostname.includes('youtu.be')) {
    return; /* deixa passar, não interfere */
  }

  /* ========================================
     4) WHATSAPP, INSTAGRAM etc — permitir
     ======================================== */
  if (url.hostname.includes('wa.me') || 
      url.hostname.includes('instagram.com') ||
      url.hostname.includes('globoplay.globo.com')) {
    return;
  }

  /* ========================================
     5) ASSETS LOCAIS — cache-first
        (index.html, CSS, JS locais)
     ======================================== */
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => {
          /* Offline fallback — retorna a página principal */
          if (request.destination === 'document') {
            return caches.match('/') || caches.match('/index.html');
          }
        });
      })
    );
    return;
  }

  /* Outros — deixa passar */
});
