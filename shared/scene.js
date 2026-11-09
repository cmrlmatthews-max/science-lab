// shared/scene.js  Three.js stage helper for Science Lab.
// Requires the page import map for "three" and "three/addons/controls/OrbitControls.js".
// Scene convention: 1 unit = 1 inch, x along the wall, y up, z through the wall.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export { THREE };

/**
 * Cold-blue to hot-red scale stops, position 0..1 then CSS hex color.
 * The middle is a warm off-white so it reads on both paper and dark stages.
 * @type {Array<[number, string]>}
 */
export const TEMP_STOPS = [
  [0.0, '#1b44c8'],
  [0.25, '#4f9be8'],
  [0.5, '#f1ecde'],
  [0.75, '#f2a03d'],
  [1.0, '#c4181f'],
];

const STOP_RGB = TEMP_STOPS.map(([p, hex]) => {
  const n = parseInt(hex.slice(1), 16);
  return [p, (n >> 16) & 255, (n >> 8) & 255, n & 255];
});

function scaleRgb(tF, tMin, tMax) {
  let u = tMax === tMin ? 0.5 : (tF - tMin) / (tMax - tMin);
  if (!Number.isFinite(u)) u = 0.5;
  u = Math.min(1, Math.max(0, u));
  for (let i = 1; i < STOP_RGB.length; i++) {
    const a = STOP_RGB[i - 1];
    const b = STOP_RGB[i];
    if (u <= b[0]) {
      const k = (u - a[0]) / (b[0] - a[0] || 1);
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
    }
  }
  const last = STOP_RGB[STOP_RGB.length - 1];
  return [last[1], last[2], last[3]];
}

/**
 * Map a temperature to a THREE.Color on the cold-blue to hot-red scale.
 * @param {number} tF temperature in degrees F
 * @param {number} tMin temperature drawn as full cold
 * @param {number} tMax temperature drawn as full hot
 * @returns {THREE.Color}
 */
export function tempToColor(tF, tMin, tMax) {
  const [r, g, b] = scaleRgb(tF, tMin, tMax);
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}

/**
 * Same scale as tempToColor, returned as a CSS rgb() string for DOM use.
 * @param {number} tF
 * @param {number} tMin
 * @param {number} tMax
 * @returns {string}
 */
export function tempToCss(tF, tMin, tMax) {
  const [r, g, b] = scaleRgb(tF, tMin, tMax);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const get = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  const dark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return {
    bg: get('--stage-bg', dark ? '#1b1e22' : '#eceef1'),
    ink: get('--ink', dark ? '#e4e7eb' : '#1c1f23'),
    paper: get('--paper-2', dark ? '#22262b' : '#ffffff'),
    grid: get('--grid-line', dark ? '#2b3036' : '#e1e4e8'),
    accent: get('--accent', dark ? '#58a6e0' : '#1f5fa8'),
    dark,
  };
}

function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry && o.geometry.dispose) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      for (const k of Object.keys(m)) {
        const v = m[k];
        if (v && v.isTexture) v.dispose();
      }
      m.dispose();
    }
  });
}

/**
 * Create a 3D stage inside a container element.
 * Renders on demand: call requestRender() after any change. While any onFrame
 * callback is subscribed it renders every animation frame.
 * Selection must never move the camera; call frame() only once at mount.
 *
 * @param {HTMLElement} containerEl element that will receive the canvas
 * @param {object} [opts]
 * @param {number} [opts.fov=35] camera field of view in degrees
 * @param {boolean} [opts.grid=false] draw a ground grid at y = 0
 * @param {number} [opts.maxPixelRatio=2]
 * @returns {{
 *  THREE: typeof THREE, scene: THREE.Scene, camera: THREE.PerspectiveCamera,
 *  renderer: THREE.WebGLRenderer|null, controls: OrbitControls|null, supported: boolean,
 *  theme: {bg:string, ink:string, paper:string, grid:string, accent:string, dark:boolean},
 *  requestRender: () => void,
 *  onFrame: (fn: (dt:number, t:number) => void) => (() => void),
 *  frame: (target: THREE.Box3|THREE.Object3D, opts?: {dir?: number[]|THREE.Vector3, padding?: number}) => void,
 *  pick: (clientX:number, clientY:number, objects: THREE.Object3D[]) => (THREE.Intersection|null),
 *  onTap: (fn: (e:{clientX:number, clientY:number}) => void) => (() => void),
 *  onTheme: (fn: (theme:object) => void) => (() => void),
 *  setClipping: (plane: THREE.Plane|null) => void,
 *  dispose: () => void
 * }}
 */
export function createStage(containerEl, opts = {}) {
  const fov = opts.fov || 35;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 1, 5000);
  camera.position.set(80, 60, 120);
  const theme = readTheme();
  const frameSubs = new Set();
  const tapSubs = new Set();
  const themeSubs = new Set();

  if (getComputedStyle(containerEl).position === 'static') containerEl.style.position = 'relative';

  // Lights: soft key + fill + hemisphere so flat colored boxes read well.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8372, 1.35));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(120, 220, 260);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff1dc, 0.8);
  fill.position.set(-200, 60, -120);
  scene.add(fill);

  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!renderer.getContext()) throw new Error('no context');
  } catch (err) {
    renderer = null;
  }

  if (!renderer) {
    const msg = document.createElement('div');
    msg.className = 'stage-fallback';
    msg.textContent = 'This browser could not start 3D graphics. The numbers still work.';
    containerEl.appendChild(msg);
    const noop = () => {};
    const unsub = () => noop;
    return {
      THREE, scene, camera, renderer: null, controls: null, supported: false, theme,
      requestRender: noop, onFrame: unsub, frame: noop, pick: () => null, onTap: unsub, onTheme: unsub,
      setClipping: noop, dispose() { msg.remove(); },
    };
  }

  const canvas = renderer.domElement;
  canvas.classList.add('stage-canvas');
  canvas.style.touchAction = 'none';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '3D view. Drag to rotate, pinch to zoom.');
  containerEl.appendChild(canvas);
  renderer.setClearColor(0x000000, 0);
  renderer.localClippingEnabled = true;

  let grid = null;
  if (opts.grid) {
    grid = new THREE.GridHelper(400, 40, theme.grid, theme.grid);
    grid.material.transparent = true;
    grid.material.opacity = 0.6;
    scene.add(grid);
  }

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.screenSpacePanning = true;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  // ----- render loop (on demand) -----
  let dirty = true;
  let running = false;
  let rafId = 0;
  let last = performance.now();
  let disposed = false;
  const t0 = last;

  function tick(now) {
    rafId = 0;
    if (disposed) { running = false; return; }
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const fn of Array.from(frameSubs)) {
      try { fn(dt, (now - t0) / 1000); } catch (e) { console.error(e); }
    }
    const moved = controls.update();
    if (dirty || moved || frameSubs.size) {
      renderer.render(scene, camera);
      dirty = false;
    }
    if (frameSubs.size || moved || dirty) {
      rafId = requestAnimationFrame(tick);
    } else {
      running = false;
    }
  }
  function requestRender() {
    if (disposed) return;
    dirty = true;
    if (!running) {
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(tick);
    }
  }
  controls.addEventListener('change', requestRender);

  // ----- sizing -----
  function resize() {
    const w = containerEl.clientWidth;
    const h = containerEl.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxPixelRatio || 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(containerEl);
  else window.addEventListener('resize', resize);
  resize();

  // ----- theme -----
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function onScheme() {
    Object.assign(theme, readTheme());
    if (grid) {
      grid.material.dispose();
      scene.remove(grid);
      grid.geometry.dispose();
      grid = new THREE.GridHelper(400, 40, theme.grid, theme.grid);
      grid.material.transparent = true;
      grid.material.opacity = 0.6;
      scene.add(grid);
    }
    for (const fn of Array.from(themeSubs)) {
      try { fn(theme); } catch (e) { console.error(e); }
    }
    requestRender();
  }
  if (mq) (mq.addEventListener ? mq.addEventListener('change', onScheme) : mq.addListener(onScheme));

  // ----- tap detection (a press that moved less than 6 px) -----
  let down = null;
  let multi = false;
  const activePointers = new Set();
  function onDown(e) {
    activePointers.add(e.pointerId);
    if (activePointers.size > 1) { multi = true; down = null; return; }
    multi = false;
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }
  function onMove(e) {
    if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) >= 6) down = null;
  }
  function onUp(e) {
    activePointers.delete(e.pointerId);
    if (down && e.pointerId === down.id && !multi && e.type === 'pointerup') {
      const info = { clientX: e.clientX, clientY: e.clientY };
      down = null;
      for (const fn of Array.from(tapSubs)) {
        try { fn(info); } catch (err) { console.error(err); }
      }
    }
    if (!activePointers.size) multi = false;
  }
  function onCancel(e) { activePointers.delete(e.pointerId); down = null; }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);

  canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
  canvas.addEventListener('webglcontextrestored', requestRender);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function visibleChain(o) {
    for (let p = o; p; p = p.parent) if (p.visible === false) return false;
    return true;
  }

  const stage = {
    THREE, scene, camera, renderer, controls, supported: true, theme,
    requestRender,
    onFrame(fn) {
      frameSubs.add(fn);
      requestRender();
      return () => { frameSubs.delete(fn); };
    },
    frame(target, o = {}) {
      const box = target && target.isBox3 ? target : new THREE.Box3().setFromObject(target);
      if (box.isEmpty()) return;
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const d = o.dir ? (Array.isArray(o.dir) ? new THREE.Vector3(...o.dir) : o.dir.clone()) : new THREE.Vector3(0.7, 0.45, 1.4);
      d.normalize();
      const vf = THREE.MathUtils.degToRad(camera.fov);
      const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
      const dist = (sphere.radius * (o.padding || 1.15)) / Math.sin(Math.min(vf, hf) / 2);
      camera.position.copy(sphere.center).addScaledVector(d, dist);
      camera.near = Math.max(0.1, dist / 200);
      camera.far = Math.max(1000, dist * 30);
      camera.updateProjectionMatrix();
      controls.target.copy(sphere.center);
      controls.minDistance = sphere.radius * 0.35;
      controls.maxDistance = dist * 4;
      controls.update();
      requestRender();
    },
    pick(clientX, clientY, objects) {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(objects, true);
      return hits.find((h) => visibleChain(h.object)) || null;
    },
    onTap(fn) {
      tapSubs.add(fn);
      return () => { tapSubs.delete(fn); };
    },
    onTheme(fn) {
      themeSubs.add(fn);
      return () => { themeSubs.delete(fn); };
    },
    setClipping(plane) {
      renderer.clippingPlanes = plane ? [plane] : [];
      requestRender();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      frameSubs.clear(); tapSubs.clear(); themeSubs.clear();
      if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
      if (mq) (mq.removeEventListener ? mq.removeEventListener('change', onScheme) : mq.removeListener(onScheme));
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      controls.dispose();
      disposeTree(scene);
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (e) { /* ignore */ }
      canvas.remove();
    },
  };
  return stage;
}

/**
 * Make a camera-facing text label (canvas texture sprite), readable in light and dark.
 * Sprite height is `height` scene units (inches); width follows the text.
 * Call sprite.userData.setText(newText) to change the text later.
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {number} [opts.height=5] sprite height in scene units
 * @param {number} [opts.fontPx=34] canvas font size
 * @param {string} [opts.color] text color (default ink)
 * @param {string} [opts.bg] pill background (default paper)
 * @param {string} [opts.border] pill border (default ink)
 * @param {boolean} [opts.depthTest=false] hide the label behind geometry when true
 * @returns {THREE.Sprite}
 */
export function makeLabelSprite(text, opts = {}) {
  const th = readTheme();
  const o = {
    height: 5, fontPx: 34, color: th.ink, bg: th.paper, border: th.ink, depthTest: false, ...opts,
  };
  const canvas = document.createElement('canvas');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: o.depthTest, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 20;
  const font = `800 ${o.fontPx}px "Avenir Next Condensed","DIN Condensed","Arial Narrow",sans-serif`;

  function draw(t) {
    const ctx = canvas.getContext('2d');
    const pad = Math.round(o.fontPx * 0.45);
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(String(t).toUpperCase()).width + pad * 2);
    const h = Math.ceil(o.fontPx * 1.0 + pad * 1.1);
    canvas.width = w;
    canvas.height = h;
    ctx.font = font;
    ctx.fillStyle = o.bg;
    ctx.strokeStyle = o.border;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const r = 6;
    ctx.moveTo(r, 1.5); ctx.arcTo(w - 1.5, 1.5, w - 1.5, h - 1.5, r); ctx.arcTo(w - 1.5, h - 1.5, 1.5, h - 1.5, r);
    ctx.arcTo(1.5, h - 1.5, 1.5, 1.5, r); ctx.arcTo(1.5, 1.5, w - 1.5, 1.5, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = o.color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(String(t).toUpperCase(), w / 2, h / 2 + 1);
    tex.needsUpdate = true;
    sprite.scale.set((o.height * w) / h, o.height, 1);
  }
  draw(text);
  sprite.userData.setText = draw;
  return sprite;
}
