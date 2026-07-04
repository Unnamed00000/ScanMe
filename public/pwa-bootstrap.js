(() => {
  const rawRoute = window.location.hash.replace(/^#\/?/, '');
  const [page = '', rawSlug = ''] = rawRoute.split('/');
  let href = '/ScanMe/manifest.webmanifest';
  if (page === 'p' && rawSlug) {
    const slug = decodeURIComponent(rawSlug);
    const query = new URLSearchParams({ name: slug, lang: document.documentElement.lang || 'ru' });
    href = `/ScanMe/pwa-manifest/${encodeURIComponent(slug)}.webmanifest?${query}`;
  }
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = href;
  document.head.append(link);
})();
