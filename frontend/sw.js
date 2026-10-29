const CACHE_NAME = 'trueshift-v2';
const CACHE_URLS = [
  '/pages/login.html',
  '/css/main.css',
  '/css/forms.css',
  '/css/components.css',
  '/js/api.js',
  '/js/utils.js',
  '/js/components/toast.js',
  '/js/components/modal.js',
  '/js/components/sidebar.js',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_URLS)));
});

self.addEventListener('fetch', event => {
  // Network first for API calls, cache first for static assets
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request).catch(() => new Response('Offline', {status: 503})));
  } else {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
  }
});
