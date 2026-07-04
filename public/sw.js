const CACHE_NAME = 'scanme-pwa-v3';
const APP_SHELL = [
  '/ScanMe/',
  '/ScanMe/index.html',
  '/ScanMe/manifest.webmanifest',
  '/ScanMe/favicon.svg',
  '/ScanMe/icons/icon-192.png',
  '/ScanMe/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

function profileManifest(url) {
  const fileName = url.pathname.split('/').pop() || '';
  const slug = decodeURIComponent(fileName.replace(/\.webmanifest$/, ''));
  const name = url.searchParams.get('name') || 'ScanMe';
  const shortName = name.length > 24 ? `${name.slice(0, 23)}…` : name;
  return {
    name,
    short_name: shortName,
    description: url.searchParams.get('description') || 'Digital business card',
    lang: url.searchParams.get('lang') || 'ru',
    id: `/ScanMe/pwa/profile/${encodeURIComponent(slug)}`,
    start_url: `/ScanMe/#/p/${encodeURIComponent(slug)}`,
    scope: '/ScanMe/',
    display: 'standalone',
    background_color: '#090b10',
    theme_color: '#090b10',
    icons: [
      { src: '/ScanMe/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/ScanMe/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/ScanMe/pwa-manifest/')) {
    event.respondWith(new Response(JSON.stringify(profileManifest(url)), {
      headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'no-store' },
    }));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put('/ScanMe/index.html', copy));
      return response;
    }).catch(() => caches.match('/ScanMe/index.html')));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    }
    return response;
  })));
});
