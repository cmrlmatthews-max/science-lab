// Science Lab service worker. Relative URLs only, so it works under a sub-path (GitHub Pages).
// Bump CACHE when any file changes. If a mode worker adds files (assembly-*.js, bridge-*.js, water-*.js),
// add them to FILES below (same for orbital/launch-*.js, orbits-*.js, transfer-*.js and molecules/molecules-*.js, crystals-*.js, compare-*.js).
const CACHE = 'science-lab-v7';
const FILES = [
  './',
  './envelope/',
  './orbital/',
  './molecules/',
  './assets/materials/batt.jpg',
  './assets/materials/brick.jpg',
  './assets/materials/cmu.jpg',
  './assets/materials/concrete.jpg',
  './assets/materials/minwool.jpg',
  './assets/materials/osb.jpg',
  './assets/materials/wood.jpg',
  './assets/space/earth_clouds_1024.jpg',
  './assets/space/earth_day_2048.jpg',
  './assets/space/earth_night_2048.jpg',
  './assets/space/earth_normal_1024.jpg',
  './assets/space/earth_spec_1024.jpg',
  './assets/space/mars_1440.jpg',
  './assets/space/milkyway_2048.jpg',
  './assets/space/moon_1024.jpg',
  './envelope/assembly-3d.js',
  './envelope/assembly-graph.js',
  './envelope/bridge-scene.js',
  './envelope/bridge.js',
  './envelope/index.html',
  './envelope/main.js',
  './envelope/material-look.js',
  './envelope/materials.js',
  './envelope/mode-assembly.js',
  './envelope/mode-bridge.js',
  './envelope/mode-water.js',
  './envelope/physics.js',
  './envelope/vapor.js',
  './envelope/walls.js',
  './envelope/water.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './index.html',
  './manifest.json',
  './molecules/chem.js',
  './molecules/compare-data.js',
  './molecules/compare-glass-data.js',
  './molecules/compare-overlay.js',
  './molecules/crystal-data.js',
  './molecules/elements.js',
  './molecules/index.html',
  './molecules/lattice.js',
  './molecules/main.js',
  './molecules/mode-compare.js',
  './molecules/mode-crystals.js',
  './molecules/mode-molecules.js',
  './molecules/molecule-data.js',
  './molecules/viewer.js',
  './orbital/bodies.js',
  './orbital/index.html',
  './orbital/launch-model.js',
  './orbital/main.js',
  './orbital/mode-launch.js',
  './orbital/mode-orbits.js',
  './orbital/mode-transfer.js',
  './orbital/physics.js',
  './orbital/space.js',
  './shared/scene.js',
  './shared/simple.js',
  './shared/style.css',
  './shared/ui.js',
  './vendor/OrbitControls.js',
  './vendor/addons/RoomEnvironment.js',
  './vendor/addons/lines/Line2.js',
  './vendor/addons/lines/LineMaterial.js',
  './vendor/addons/lines/LineSegments2.js',
  './vendor/addons/lines/LineSegmentsGeometry.js',
  './vendor/three.module.min.js',
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
