// Service worker: precaches every game file so Neon Nibbler plays offline.
// Bump VERSION on each release; the new cache replaces the old one on
// activation, so a new version is running by the second launch at the latest.
const VERSION = 'v1';
const CACHE = `neon-nibbler-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'src/style.css',
  'src/main.js',
  'src/storage.js',
  'src/core/constants.js',
  'src/core/enemies.js',
  'src/core/game.js',
  'src/core/levels.js',
  'src/core/loop.js',
  'src/core/maze.js',
  'src/core/mazeData.js',
  'src/core/movement.js',
  'src/core/player.js',
  'src/core/rng.js',
  'src/core/swipe.js',
  'src/input/dpad.js',
  'src/input/keyboard.js',
  'src/input/touch.js',
  'src/render/renderer.js',
  'src/ui/layout.js',
  'src/ui/ui.js',
  'src/audio/sfx.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('neon-nibbler-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    }),
  );
});
