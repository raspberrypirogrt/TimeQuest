const CACHE_NAME = 'timequest-v4';
const ASSETS = [
  '/',
  '/index.html',
  '/css/index.css',
  '/css/components.css',
  '/css/timeline.css',
  '/css/tasks.css',
  '/css/habits.css',
  '/css/animations.css',
  '/js/app.js',
  '/js/db.js',
  '/js/swipe.js',
  '/js/pages/home.js',
  '/js/pages/schedule.js',
  '/js/pages/habits.js',
  '/js/components/timeline.js',
  '/js/components/taskList.js',
  '/js/components/weekSelector.js',
  '/js/components/calendar.js',
  '/js/components/modal.js',
  '/js/utils/date.js',
  '/js/utils/icons.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
