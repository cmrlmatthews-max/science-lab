// Science Lab service worker. Relative URLs only, so it works under a sub-path (GitHub Pages).
// Bump CACHE when any file changes. If a mode worker adds files (assembly-*.js, bridge-*.js, water-*.js),
// add them to FILES below (same for orbital/launch-*.js, orbits-*.js, transfer-*.js and molecules/molecules-*.js, crystals-*.js, compare-*.js).
const CACHE = 'science-lab-v6';
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './vendor/three.module.min.js',
  './vendor/OrbitControls.js',
  './shared/style.css',
  './shared/scene.js',
  './shared/ui.js',
  './envelope/',
  './envelope/index.html',
  './envelope/main.js',
  './envelope/materials.js',
  './envelope/walls.js',
  './envelope/physics.js',
  './envelope/vapor.js',
  './envelope/bridge.js',
  './envelope/water.js',
  './envelope/mode-assembly.js',
  './envelope/assembly-3d.js',
  './envelope/assembly-graph.js',
  './envelope/mode-bridge.js',
  './envelope/bridge-scene.js',
  './envelope/mode-water.js',
  './orbital/',
  './orbital/index.html',
  './orbital/main.js',
  './orbital/space.js',
  './orbital/bodies.js',
  './orbital/physics.js',
  './orbital/mode-launch.js',
  './orbital/launch-model.js',
  './orbital/mode-orbits.js',
  './orbital/mode-transfer.js',
  './molecules/',
  './molecules/index.html',
  './molecules/main.js',
  './molecules/viewer.js',
  './molecules/elements.js',
  './molecules/chem.js',
  './molecules/molecule-data.js',
  './molecules/lattice.js',
  './molecules/crystal-data.js',
  './molecules/compare-data.js',
  './molecules/mode-molecules.js',
  './molecules/mode-crystals.js',
  './molecules/mode-compare.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Add each file on its own so one missing file does not block the whole install.
    await Promise.all(FILES.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res.ok) await cache.put(url, res);
        else console.warn('sw: skipped', url, res.status);
      } catch (e) {
        console.warn('sw: failed', url);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Network first, fall back to the cached page.
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
        return res;
      } catch (e) {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        const dir = url.pathname.endsWith('/') ? url.pathname : url.pathname.replace(/[^/]*$/, '');
        return (await caches.match(dir + 'index.html')) || (await caches.match(dir)) || Response.error();
      }
    })());
    return;
  }

  // Cache first for the app shell and vendor files.
  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch (e) {
      return Response.error();
    }
  })());
});
