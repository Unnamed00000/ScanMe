const CACHE_NAME = 'scanme-pwa-v11';
const APP_SHELL = [
  '/ScanMe/',
  '/ScanMe/index.html',
  '/ScanMe/manifest.webmanifest',
  '/ScanMe/pwa-bootstrap.js',
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
  const iconSource = url.searchParams.get('icon') || '';
  const iconUrl = iconSource
    ? `/ScanMe/pwa-icon/${encodeURIComponent(slug)}.png?src=${encodeURIComponent(iconSource)}`
    : '/ScanMe/icons/icon-512.png';
  return {
    name,
    short_name: shortName,
    description: url.searchParams.get('description') || 'Digital business card',
    lang: url.searchParams.get('lang') || 'ru',
    id: `/ScanMe/pwa/profile/${encodeURIComponent(slug)}`,
    start_url: `/ScanMe/?installed-profile=${encodeURIComponent(slug)}#/p/${encodeURIComponent(slug)}`,
    scope: '/ScanMe/',
    display: 'standalone',
    background_color: '#090b10',
    theme_color: '#090b10',
    icons: [
      { src: iconUrl, sizes: '192x192', purpose: 'any' },
      { src: iconUrl, sizes: '512x512', purpose: 'any' },
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

  if (url.pathname.startsWith('/ScanMe/pwa-icon/')) {
    const source = url.searchParams.get('src') || '';
    let sourceUrl = null;
    try {
      sourceUrl = new URL(source);
      if (!['http:', 'https:'].includes(sourceUrl.protocol)) sourceUrl = null;
    } catch {
      sourceUrl = null;
    }
    event.respondWith((sourceUrl
      ? fetch(sourceUrl.href, { cache: 'no-store' }).then((response) => {
        if (!response.ok) throw new Error('Profile icon is unavailable');
        return response;
      })
      : Promise.reject(new Error('Profile icon is missing'))
    ).catch(() => fetch('/ScanMe/icons/icon-512.png')));
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
