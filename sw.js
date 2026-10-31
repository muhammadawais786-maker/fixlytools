// Fixlytools service worker: makes the site installable and usable offline.
// Change CACHE_VERSION whenever you deploy a new version of the site.
const CACHE_VERSION = 'fixlytools-v10';
const CDN_HOSTS = ['cdnjs.cloudflare.com'];

const PRECACHE = [
  '/', '/about', '/contact', '/privacy-policy', '/terms',
  '/tools/calculator', '/tools/scientific-calculator', '/tools/physics-solver', '/tools/chemistry-solver', '/tools/math-solver', '/tools/age-calculator', '/tools/emi-calculator', '/tools/heic-to-jpg',
  '/tools/invoice-generator', '/tools/image-compressor', '/tools/compress-image-to-50kb', '/tools/compress-image-to-100kb', '/tools/compress-image-to-200kb',
  '/tools/image-converter', '/tools/image-resizer',
  '/tools/jpg-to-pdf', '/tools/json-formatter', '/tools/merge-pdf',
  '/tools/password-generator', '/tools/pdf-compressor', '/tools/qr-code-generator',
  '/tools/pdf-to-jpg', '/tools/remove-pages', '/tools/rotate-pdf', '/tools/add-page-numbers', '/tools/add-watermark-to-pdf', '/tools/crop-pdf', '/tools/organize-pdf', '/tools/sign-pdf', '/tools/redact-pdf', '/tools/compare-pdf', '/tools/pdf-to-markdown', '/tools/scan-to-pdf', '/tools/crop-image', '/tools/rotate-image', '/tools/watermark-image', '/tools/meme-generator', '/tools/photo-editor', '/tools/blur-image', '/tools/split-pdf', '/tools/text-diff', '/tools/word-counter',
  '/assets/css/style.css', '/assets/css/math-solver.css', '/assets/css/calculator.css', '/assets/css/scientific-calculator.css', '/assets/css/physics-solver.css', '/assets/css/chemistry-solver.css',  '/assets/css/invoice.css', '/assets/css/pdf-to-jpg.css', '/assets/css/remove-pages.css', '/assets/css/rotate-pdf.css', '/assets/css/add-page-numbers.css', '/assets/css/add-watermark-to-pdf.css', '/assets/css/crop-pdf.css', '/assets/css/organize-pdf.css', '/assets/css/sign-pdf.css', '/assets/css/redact-pdf.css', '/assets/css/compare-pdf.css', '/assets/css/pdf-to-markdown.css', '/assets/css/scan-to-pdf.css', '/assets/css/crop-image.css', '/assets/css/rotate-image.css', '/assets/css/watermark-image.css', '/assets/css/meme-generator.css', '/assets/css/photo-editor.css', '/assets/css/blur-image.css',  '/assets/css/tailwind.css', '/assets/js/app.js',
  '/assets/js/tools/calculator.js', '/assets/js/tools/scientific-calculator.js', '/assets/js/tools/physics-solver.js', '/assets/js/tools/chemistry-solver.js', '/assets/js/tools/math-solver.js', '/assets/js/tools/target-compressor.js', '/assets/js/tools/invoice-generator.js', '/assets/js/tools/age-calculator.js', '/assets/js/tools/emi-calculator.js',
  '/assets/js/tools/heic-to-jpg.js', '/assets/js/tools/image-compressor.js',
  '/assets/js/tools/image-converter.js', '/assets/js/tools/image-resizer.js',
  '/assets/js/tools/jpg-to-pdf.js', '/assets/js/tools/json-formatter.js',
  '/assets/js/tools/merge-pdf.js', '/assets/js/tools/password-generator.js',
  '/assets/js/tools/pdf-compressor.js', '/assets/js/tools/qr-code-generator.js',
  '/assets/js/tools/pdf-to-jpg.js', '/assets/js/tools/remove-pages.js', '/assets/js/tools/rotate-pdf.js', '/assets/js/tools/add-page-numbers.js', '/assets/js/tools/add-watermark-to-pdf.js', '/assets/js/tools/crop-pdf.js', '/assets/js/tools/organize-pdf.js', '/assets/js/tools/sign-pdf.js', '/assets/js/tools/redact-pdf.js', '/assets/js/tools/compare-pdf.js', '/assets/js/tools/pdf-to-markdown.js', '/assets/js/tools/scan-to-pdf.js', '/assets/js/tools/crop-image.js', '/assets/js/tools/rotate-image.js', '/assets/js/tools/watermark-image.js', '/assets/js/tools/meme-generator.js', '/assets/js/tools/photo-editor.js', '/assets/js/tools/blur-image.js',  '/assets/js/tools/split-pdf.js', '/assets/js/tools/text-diff.js',
  '/assets/js/tools/word-counter.js',
  '/favicon.svg', '/manifest.json'
];

// Libraries loaded from the CDN: fetched once at install so the PDF, HEIC and QR tools also work offline.
const CDN_PRECACHE = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

async function putIfGood(cache, request, response) {
  // never store redirects or errors; opaque (no-cors) CDN responses are fine
  if (response && (response.ok || response.type === 'opaque') && !response.redirected) {
    await cache.put(request, response.clone());
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await Promise.all(PRECACHE.map(async url => {
      try {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        await putIfGood(cache, url, res);
      } catch (e) { /* offline or missing: skip, it will be cached on first visit */ }
    }));
    await Promise.all(CDN_PRECACHE.map(async url => {
      try {
        const res = await fetch(new Request(url, { mode: 'no-cors' }));
        await putIfGood(cache, url, res);
      } catch (e) { /* cached later on first use */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Online: always show the newest version. Offline (or slow network): fall back to the saved copy.
async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    await putIfGood(cache, request, res);
    return res;
  } catch (e) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

// CDN files rarely change: use the saved copy at once and refresh it quietly.
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(res => putIfGood(cache, request, res).then(() => res)).catch(() => null);
  if (cached) return cached;
  const res = await refresh;
  return res || new Response('', { status: 504 });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;            // form posts etc. always go to the network
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname === '/sw.js') return;
    event.respondWith(networkFirst(request, request.mode === 'navigate' ? '/' : null));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
});
