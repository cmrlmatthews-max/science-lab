// orbital/space.js  shared 3D and time helpers for the three Orbital Mechanics modes.
//
// CONVENTIONS
//   Orbit plane = scene XZ plane, y is up. A km point [x, y] maps to scene (x / kmPerUnit, 0, -y / kmPerUnit),
//   so +y on the orbit diagram points away from the camera in the default view (up on screen).
//   sceneScale(extentKm) returns kmPerUnit so that extentKm becomes about 100 scene units.
//   Stage lines are 1 px (WebGL), so path `width` is accepted but only changes opacity-free appearance on
//   platforms that support it; paths stay crisp hairlines on purpose.
//   Everything created here has dispose(). Markers, craft, stars and paths follow the light and dark
//   theme by themselves (they listen to prefers-color-scheme); call stage.requestRender() is NOT needed
//   because the stage already re-renders on a scheme change.
//   The stage draws no floor grid unless asked (createStage opts.grid). The .stage CSS box has a faint
//   square grid background; orbital/index.html switches that off. Use createRings() for a polar reference.

import { THREE } from '../shared/scene.js';
import { el, button, segmented, select as selectCtl, row } from '../shared/ui.js';

const FONT = '-apple-system, "SF Pro Text", system-ui, "Helvetica Neue", Arial, sans-serif';

// ---------- theme ----------
const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

/**
 * Current colors for space drawing, read from the CSS tokens.
 * @returns {{dark:boolean, bg:string, ink:string, ink2:string, paper:string, line:string, accent:string, craft:string}}
 */
export function spaceTheme() {
  const cs = getComputedStyle(document.documentElement);
  const get = (n, f) => cs.getPropertyValue(n).trim() || f;
  const dark = !!(mq && mq.matches);
  return {
    dark,
    bg: get('--stage-bg', dark ? '#1b1e22' : '#eceef1'),
    ink: get('--ink', dark ? '#e4e7eb' : '#1c1f23'),
    ink2: get('--ink-2', dark ? '#9aa4b0' : '#5b6470'),
    paper: get('--paper-2', dark ? '#22262b' : '#ffffff'),
    line: get('--line-strong', dark ? '#4a515a' : '#bcc2cb'),
    accent: get('--accent', dark ? '#58a6e0' : '#1f5fa8'),
    craft: dark ? '#ff9a5c' : '#c4491f',
  };
}

// Run fn on every theme change; returns an unsubscribe function.
function onScheme(fn) {
  if (!mq) return () => {};
  const h = () => fn();
  if (mq.addEventListener) mq.addEventListener('change', h); else mq.addListener(h);
  return () => { if (mq.removeEventListener) mq.removeEventListener('change', h); else mq.removeListener(h); };
}

function disposeMaterial(m) {
  if (!m) return;
  for (const k of Object.keys(m)) { const v = m[k]; if (v && v.isTexture) v.dispose(); }
  m.dispose();
}
function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry && o.geometry.dispose) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(disposeMaterial);
  });
}

// Sprite whose on-screen size stays wPx x hPx whatever the camera distance (sizeAttenuation off).
function constSprite(mat, wPx, hPx) {
  const sprite = new THREE.Sprite(mat);
  const size = new THREE.Vector2();
  const px = { w: wPx, h: hPx };
  sprite.userData.setPx = (w, h) => { px.w = w; px.h = h; };
  sprite.onBeforeRender = (renderer, scene, camera) => {
    renderer.getSize(size);
    if (!size.y || !camera.isPerspectiveCamera) return;
    const k = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / size.y;
    const sx = px.w * k;
    const sy = px.h * k;
    if (Math.abs(sprite.scale.x - sx) > 1e-9 || Math.abs(sprite.scale.y - sy) > 1e-9) {
      sprite.scale.set(sx, sy, 1);
      sprite.updateMatrixWorld(true);
    }
  };
  sprite.frustumCulled = false;
  return sprite;
}

// ---------- scale ----------
/**
 * Kilometres per scene unit so that extentKm maps to about 100 scene units.
 * @param {number} extentKm
 * @returns {number}
 */
export function sceneScale(extentKm) {
  return Math.max(1e-9, extentKm) / 100;
}

/**
 * Orbit-plane km point to scene position. [x, y] -> (x/k, 0, -y/k).
 * @param {number[]} p [x, y] km
 * @param {number} kmPerUnit
 * @returns {THREE.Vector3}
 */
export function toScene([x, y], kmPerUnit) {
  return new THREE.Vector3(x / kmPerUnit, 0, -y / kmPerUnit);
}

/**
 * Point the camera down at the orbit plane from an oblique angle (about 55 degrees up).
 * Call once at mount and when the central body or preset scale changes a lot, never on selection.
 * @param {object} stage from createStage
 * @param {number} [extentUnits=100] half-width of what must fit, in scene units
 * @param {{elevationDeg?:number, azimuthDeg?:number, padding?:number}} [o]
 */
export function frameSpace(stage, extentUnits = 100, o = {}) {
  const e = extentUnits;
  const box = new THREE.Box3(new THREE.Vector3(-e, -e * 0.04, -e * 0.72), new THREE.Vector3(e, e * 0.04, e * 0.72));
  const el_ = THREE.MathUtils.degToRad(o.elevationDeg ?? 55);
  const az = THREE.MathUtils.degToRad(o.azimuthDeg ?? 10);
  const dir = [Math.sin(az) * Math.cos(el_), Math.sin(el_), Math.cos(az) * Math.cos(el_)];
  stage.frame(box, { dir, padding: o.padding ?? 1.0 });
}

// ---------- body ----------
function mixHex(hex, to, k) {
  const c = new THREE.Color(hex);
  return c.lerp(new THREE.Color(to), k);
}

function graticuleGeometry() {
  const pts = [];
  const seg = 72;
  // meridians every 30 degrees (12 half circles drawn as 6 full circles, in segments)
  for (let m = 0; m < 12; m++) {
    const lon = (m * Math.PI) / 6;
    const cl = Math.cos(lon); const sl = Math.sin(lon);
    for (let i = 0; i < seg / 2; i++) {
      const a0 = -Math.PI / 2 + (i * Math.PI) / (seg / 2);
      const a1 = -Math.PI / 2 + ((i + 1) * Math.PI) / (seg / 2);
      pts.push(Math.cos(a0) * cl, Math.sin(a0), Math.cos(a0) * sl, Math.cos(a1) * cl, Math.sin(a1), Math.cos(a1) * sl);
    }
  }
  // parallels at -60, -30, 0, 30, 60
  for (const latDeg of [-60, -30, 0, 30, 60]) {
    const lat = (latDeg * Math.PI) / 180;
    const r = Math.cos(lat); const y = Math.sin(lat);
    for (let i = 0; i < seg; i++) {
      const a0 = (i * 2 * Math.PI) / seg; const a1 = ((i + 1) * 2 * Math.PI) / seg;
      pts.push(r * Math.cos(a0), y, r * Math.sin(a0), r * Math.cos(a1), y, r * Math.sin(a1));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

/**
 * A shaded sphere for a body from bodies.js with a thin graticule and an optional atmosphere shell.
 * No textures. The Sun is unlit. group.userData.spin(dt) turns the sphere slowly (visual only).
 * @param {object} body entry of BODIES
 * @param {number} kmPerUnit
 * @param {{minRadiusUnits?:number, graticule?:boolean}} [opts] minRadiusUnits draws the body at least this big (exaggerated: true)
 * @returns {{group:THREE.Group, radiusUnits:number, exaggerated:boolean, setScale:(kmPerUnit:number)=>void, dispose:()=>void}}
 */
export function createBody(body, kmPerUnit, opts = {}) {
  const group = new THREE.Group();
  group.name = `body-${body.id}`;
  const spinGroup = new THREE.Group();
  group.add(spinGroup);
  const isSun = body.id === 'sun';
  const sphereGeo = new THREE.SphereGeometry(1, 64, 40);
  const mat = isSun
    ? new THREE.MeshBasicMaterial({ color: body.color })
    : new THREE.MeshStandardMaterial({ color: body.color, roughness: 0.95, metalness: 0 });
  const sphere = new THREE.Mesh(sphereGeo, mat);
  spinGroup.add(sphere);

  let lines = null;
  if (opts.graticule !== false) {
    const lum = new THREE.Color(body.color).getHSL({}).l;
    const lineCol = isSun ? mixHex(body.color, '#ffffff', 0.35) : (lum > 0.55 ? mixHex(body.color, '#000000', 0.28) : mixHex(body.color, '#ffffff', 0.3));
    lines = new THREE.LineSegments(graticuleGeometry(), new THREE.LineBasicMaterial({ color: lineCol, transparent: true, opacity: 0.55, depthWrite: false }));
    lines.scale.setScalar(1.002);
    spinGroup.add(lines);
  }

  let shell = null;
  const atmRatio = body.atmosphere > 0 ? Math.max(1.012, 1 + body.atmosphere / body.radius) : 0;
  if (atmRatio) {
    shell = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 32),
      new THREE.MeshBasicMaterial({ color: mixHex(body.color, '#ffffff', 0.45), transparent: true, opacity: 0.16, depthWrite: false }),
    );
    shell.scale.setScalar(atmRatio);
    group.add(shell);
  }

  const api = { group, radiusUnits: 0, exaggerated: false };
  api.setScale = (k) => {
    const real = body.radius / k;
    const r = Math.max(real, opts.minRadiusUnits || 0);
    api.radiusUnits = r;
    api.exaggerated = r > real * 1.0001;
    group.scale.setScalar(r);
  };
  group.userData.spin = (dt) => { spinGroup.rotation.y += dt * 0.08; };
  api.dispose = () => {
    disposeTree(group);
    group.removeFromParent();
  };
  api.setScale(kmPerUnit);
  return api;
}

// ---------- path ----------
/**
 * An orbit line in the XZ plane.
 * @param {number[][]} points [[x, y], ...] km
 * @param {number} kmPerUnit
 * @param {{color?:string, dashed?:boolean, opacity?:number, closed?:boolean, width?:number, dashSize?:number}} [opts] default color follows the theme accent
 * @returns {{object:THREE.Line, setPoints:(points:number[][], kmPerUnit?:number)=>void, setScale:(kmPerUnit:number)=>void, setColor:(css:string)=>void, dispose:()=>void}}
 */
export function createPath(points, kmPerUnit, opts = {}) {
  const dashed = !!opts.dashed;
  const mat = dashed
    ? new THREE.LineDashedMaterial({ color: opts.color || spaceTheme().accent, dashSize: opts.dashSize || 1.6, gapSize: (opts.dashSize || 1.6) * 0.75, transparent: true, opacity: opts.opacity ?? 0.9 })
    : new THREE.LineBasicMaterial({ color: opts.color || spaceTheme().accent, transparent: true, opacity: opts.opacity ?? 0.95 });
  let geo = new THREE.BufferGeometry();
  const object = opts.closed ? new THREE.LineLoop(geo, mat) : new THREE.Line(geo, mat);
  object.frustumCulled = false;
  let pts = points;
  let k = kmPerUnit;
  function rebuild() {
    const arr = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) { arr[i * 3] = pts[i][0] / k; arr[i * 3 + 1] = 0; arr[i * 3 + 2] = -pts[i][1] / k; }
    geo.dispose();
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    object.geometry = geo;
    if (dashed) object.computeLineDistances();
  }
  rebuild();
  const off = opts.color ? () => {} : onScheme(() => mat.color.set(spaceTheme().accent));
  return {
    object,
    setPoints(p, kk) { pts = p; if (kk) k = kk; rebuild(); },
    setScale(kk) { k = kk; rebuild(); },
    setColor(css) { mat.color.set(css); },
    dispose() { off(); geo.dispose(); mat.dispose(); object.removeFromParent(); },
  };
}

// ---------- polar reference rings ----------
/**
 * A very faint polar reference: a few concentric circles (and two crossing axes) in the orbit plane.
 * @param {{radiusUnits?:number, count?:number, axes?:boolean}} [opts] outermost ring radius in scene units (default 100)
 * @returns {{object:THREE.Group, dispose:()=>void}}
 */
export function createRings(opts = {}) {
  const R = opts.radiusUnits || 100;
  const count = opts.count || 4;
  const group = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: spaceTheme().line, transparent: true, opacity: 0.42, depthWrite: false });
  for (let i = 1; i <= count; i++) {
    const r = (R * i) / count;
    const n = 160;
    const arr = new Float32Array(n * 3);
    for (let j = 0; j < n; j++) { const a = (j / n) * Math.PI * 2; arr[j * 3] = r * Math.cos(a); arr[j * 3 + 2] = r * Math.sin(a); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    group.add(new THREE.LineLoop(g, mat));
  }
  if (opts.axes !== false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-R, 0, 0, R, 0, 0, 0, 0, -R, 0, 0, R], 3));
    group.add(new THREE.LineSegments(g, mat));
  }
  group.renderOrder = -1;
  const off = onScheme(() => mat.color.set(spaceTheme().line));
  return { object: group, dispose() { off(); disposeTree(group); group.removeFromParent(); } };
}

// ---------- craft ----------
function dotTexture(canvas, color, ring, px) {
  const s = 2;
  canvas.width = canvas.height = px * s;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);
  const m = canvas.width / 2;
  c.beginPath(); c.arc(m, m, m - 1, 0, Math.PI * 2); c.fillStyle = ring; c.fill();
  c.beginPath(); c.arc(m, m, m * 0.68, 0, Math.PI * 2); c.fillStyle = color; c.fill();
}

/**
 * A craft marker with constant on-screen size and an optional fading trail.
 * @param {{color?:string, size?:number, trail?:number}} [opts] size in px (default 13), trail = number of remembered positions (default 0 = none)
 * @returns {{object:THREE.Group, setPosition:(posKm:number[], kmPerUnit:number)=>void, clearTrail:()=>void, setColor:(css:string)=>void, dispose:()=>void}}
 */
export function createCraft(opts = {}) {
  const size = opts.size || 13;
  const trailN = opts.trail || 0;
  const fixedColor = opts.color || null;
  let color = fixedColor || spaceTheme().craft;
  const canvas = document.createElement('canvas');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const paint = () => dotTexture(canvas, color, spaceTheme().paper, size * 2);
  paint();
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, sizeAttenuation: false, depthWrite: false });
  const sprite = constSprite(mat, size, size);
  sprite.renderOrder = 12;
  const object = new THREE.Group();
  object.add(sprite);

  let trailLine = null; let trailGeo = null; let trailMat = null;
  const hist = []; // km points, oldest first
  let lastK = 1;
  function writeTrail() {
    const n = hist.length;
    const pos = new Float32Array(trailN * 3);
    const col = new Float32Array(trailN * 4);
    const c = new THREE.Color(color);
    for (let i = 0; i < trailN; i++) {
      const h = hist[Math.min(i, n - 1)] || [0, 0];
      pos[i * 3] = h[0] / lastK; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = -h[1] / lastK;
      const u = n > 1 ? Math.min(i, n - 1) / (n - 1) : 1;
      col[i * 4] = c.r; col[i * 4 + 1] = c.g; col[i * 4 + 2] = c.b; col[i * 4 + 3] = u * u * 0.9;
    }
    trailGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    trailGeo.setDrawRange(0, Math.max(0, n));
  }
  if (trailN > 1) {
    trailGeo = new THREE.BufferGeometry();
    trailMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
    trailLine = new THREE.Line(trailGeo, trailMat);
    trailLine.frustumCulled = false;
    trailLine.renderOrder = 11;
    object.add(trailLine);
  }

  const off = onScheme(() => { if (!fixedColor) color = spaceTheme().craft; paint(); tex.needsUpdate = true; if (trailLine) writeTrail(); });
  return {
    object,
    setPosition(posKm, kmPerUnit) {
      sprite.position.set(posKm[0] / kmPerUnit, 0, -posKm[1] / kmPerUnit);
      if (!trailLine) return;
      lastK = kmPerUnit;
      const step = 0.4 * kmPerUnit; // ignore moves smaller than 0.4 scene units
      const last = hist[hist.length - 1];
      if (last) {
        const d = Math.hypot(posKm[0] - last[0], posKm[1] - last[1]);
        if (d > 40 * step) hist.length = 0; // a jump (restart): drop the trail
        else if (d < step) return;
      }
      hist.push([posKm[0], posKm[1]]);
      if (hist.length > trailN) hist.shift();
      writeTrail();
    },
    clearTrail() { hist.length = 0; if (trailLine) writeTrail(); },
    setColor(css) { color = css; paint(); tex.needsUpdate = true; if (trailLine) writeTrail(); },
    dispose() { off(); tex.dispose(); mat.dispose(); if (trailGeo) trailGeo.dispose(); if (trailMat) trailMat.dispose(); object.removeFromParent(); },
  };
}

// ---------- arrow ----------
/**
 * A vector arrow (shaft and head, unlit). Its length is fixed in scene units; only the direction follows the vector.
 * @param {{color?:string, radius?:number}} [opts] radius = shaft radius in scene units (default 0.32)
 * @returns {{object:THREE.Group, set:(originKm:number[], vectorKm:number[], kmPerUnit:number, lengthUnits?:number)=>void, setVisible:(v:boolean)=>void, dispose:()=>void}}
 */
export function createArrow(opts = {}) {
  const rad = opts.radius || 0.32;
  const mat = new THREE.MeshBasicMaterial({ color: opts.color || spaceTheme().accent, depthWrite: true });
  const shaftGeo = new THREE.CylinderGeometry(rad, rad, 1, 10, 1);
  shaftGeo.translate(0, 0.5, 0);
  const headGeo = new THREE.ConeGeometry(rad * 2.8, 1, 16, 1);
  headGeo.translate(0, 0.5, 0);
  const shaft = new THREE.Mesh(shaftGeo, mat);
  const head = new THREE.Mesh(headGeo, mat);
  const object = new THREE.Group();
  object.add(shaft, head);
  object.visible = false;
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const off = opts.color ? () => {} : onScheme(() => mat.color.set(spaceTheme().accent));
  return {
    object,
    set(originKm, vectorKm, kmPerUnit, lengthUnits = 12) {
      dir.set(vectorKm[0], 0, -vectorKm[1]);
      if (dir.lengthSq() < 1e-30) { object.visible = false; return; }
      dir.normalize();
      const L = lengthUnits;
      const hl = Math.min(L * 0.35, rad * 7);
      object.visible = true;
      object.position.set(originKm[0] / kmPerUnit, 0, -originKm[1] / kmPerUnit);
      object.quaternion.setFromUnitVectors(up, dir);
      shaft.scale.set(1, Math.max(0.001, L - hl), 1);
      head.position.set(0, L - hl, 0);
      head.scale.set(1, hl, 1);
    },
    setVisible(v) { object.visible = !!v; },
    dispose() { off(); shaftGeo.dispose(); headGeo.dispose(); mat.dispose(); object.removeFromParent(); },
  };
}

// ---------- marker / label ----------
/**
 * A small dot with a quiet text label (sentence case as given, system sans, regular weight). Constant on-screen size.
 * @param {string} label
 * @param {{color?:string, fontPx?:number, boxed?:boolean, dot?:boolean, side?:'right'|'left'|'above'}} [opts] boxed draws a hairline box
 * @returns {{object:THREE.Group, setPosition:(posKm:number[], kmPerUnit:number)=>void, setLabel:(text:string)=>void, dispose:()=>void}}
 */
export function createMarker(label, opts = {}) {
  const fontPx = opts.fontPx || 12;
  const side = opts.side || 'right';
  const S = 3; // texture oversampling
  const object = new THREE.Group();
  let text = String(label ?? '');

  const labelCanvas = document.createElement('canvas');
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  labelTex.anisotropy = 4;
  const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, sizeAttenuation: false, depthTest: false, depthWrite: false });
  const labelSprite = constSprite(labelMat, 10, 10);
  labelSprite.renderOrder = 30;
  object.add(labelSprite);

  const showDot = opts.dot !== false;
  let dotCanvas = null; let dotTex = null; let dotMat = null; let dotSprite = null;
  if (showDot) {
    dotCanvas = document.createElement('canvas');
    dotTex = new THREE.CanvasTexture(dotCanvas);
    dotTex.colorSpace = THREE.SRGBColorSpace;
    dotMat = new THREE.SpriteMaterial({ map: dotTex, transparent: true, sizeAttenuation: false, depthTest: false, depthWrite: false });
    dotSprite = constSprite(dotMat, 7, 7);
    dotSprite.renderOrder = 29;
    object.add(dotSprite);
  }

  function draw() {
    const th = spaceTheme();
    const ink = opts.color || th.ink;
    const pad = 4;
    const ctx = labelCanvas.getContext('2d');
    const font = `400 ${fontPx * S}px ${FONT}`;
    ctx.font = font;
    const tw = Math.ceil(ctx.measureText(text).width);
    const wPx = Math.ceil(tw / S) + pad * 2 + 6;
    const hPx = Math.ceil(fontPx * 1.5) + 2;
    labelCanvas.width = wPx * S;
    labelCanvas.height = hPx * S;
    const c = labelCanvas.getContext('2d');
    c.font = font;
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    const x0 = (side === 'left' ? pad : 6 + pad) * S;
    if (opts.boxed) {
      c.fillStyle = th.paper; c.globalAlpha = 0.85;
      c.fillRect((side === 'left' ? 0 : 6) * S + 1, 1, (wPx - 6) * S - 2, hPx * S - 2);
      c.globalAlpha = 1;
      c.strokeStyle = th.line; c.lineWidth = 1;
      c.strokeRect((side === 'left' ? 0 : 6) * S + 1, 1, (wPx - 6) * S - 2, hPx * S - 2);
    } else {
      c.lineJoin = 'round'; c.lineWidth = 2.5 * S; c.strokeStyle = th.bg; c.globalAlpha = 0.7;
      c.strokeText(text, x0, (hPx * S) / 2 + 1);
      c.globalAlpha = 1;
    }
    c.fillStyle = ink;
    c.fillText(text, x0, (hPx * S) / 2 + 1);
    labelTex.needsUpdate = true;
    labelSprite.userData.setPx(wPx, hPx);
    if (side === 'right') labelSprite.center.set(0, 0.5);
    else if (side === 'left') labelSprite.center.set(1, 0.5);
    else labelSprite.center.set(0.5, -0.1);
    if (dotCanvas) {
      dotTexture(dotCanvas, ink, th.paper, 14);
      dotTex.needsUpdate = true;
    }
  }
  draw();
  const off = onScheme(draw);
  return {
    object,
    setPosition(posKm, kmPerUnit) { object.position.set(posKm[0] / kmPerUnit, 0, -posKm[1] / kmPerUnit); },
    setLabel(t) { const n = String(t ?? ''); if (n !== text) { text = n; draw(); } },
    dispose() {
      off(); labelTex.dispose(); labelMat.dispose();
      if (dotTex) { dotTex.dispose(); dotMat.dispose(); }
      object.removeFromParent();
    },
  };
}

// ---------- stars ----------
/**
 * Very subtle fixed star specks that follow the camera position (so they stay at infinity).
 * Light theme: faint dark specks. Dark theme: faint light specks. Has points.dispose().
 * @param {number} [count=260]
 * @returns {THREE.Points}
 */
export function createStars(count = 260) {
  const n = count;
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  let s = 12345;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1; const a = rnd() * Math.PI * 2; const r = Math.sqrt(1 - u * u);
    pos[i * 3] = 380 * r * Math.cos(a); pos[i * 3 + 1] = 380 * u; pos[i * 3 + 2] = 380 * r * Math.sin(a);
    seed[i] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const col = new Float32Array(n * 4);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const mat = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = -10;
  function paint() {
    const dark = spaceTheme().dark;
    const rgb = dark ? [0.82, 0.86, 0.92] : [0.1, 0.12, 0.16];
    const lo = dark ? 0.12 : 0.07; const hi = dark ? 0.5 : 0.22;
    for (let i = 0; i < n; i++) {
      col[i * 4] = rgb[0]; col[i * 4 + 1] = rgb[1]; col[i * 4 + 2] = rgb[2];
      col[i * 4 + 3] = lo + (hi - lo) * seed[i] * seed[i];
    }
    geo.attributes.color.needsUpdate = true;
  }
  paint();
  points.onBeforeRender = (renderer, scene, camera) => { points.position.copy(camera.position); points.updateMatrixWorld(); };
  const off = onScheme(paint);
  points.dispose = () => { off(); geo.dispose(); mat.dispose(); points.removeFromParent(); };
  return points;
}

// ---------- time ----------
/**
 * Compact time control: play/pause, speed and restart. Fits 340 px.
 * @param {{warps:Array<{value:number,label:string}>, value:number, playing:boolean, onChange?:(s:{playing:boolean,warp:number})=>void, onReset?:()=>void, label?:string}} p
 * @returns {{el:HTMLElement, set:(s:{playing?:boolean,warp?:number})=>void}}
 */
export function timeControl({ warps, value, playing, onChange, onReset, label = 'Speed' }) {
  let state = { playing: !!playing, warp: value };
  const fire = () => { if (onChange) onChange({ ...state }); };
  const playBtn = button({ label: state.playing ? 'Pause' : 'Play', kind: 'primary', onClick: () => { state.playing = !state.playing; paint(); fire(); } });
  playBtn.style.minWidth = '84px';
  const resetBtn = button({ label: 'Restart', onClick: () => { if (onReset) onReset(); } });
  const opts = warps.map((w) => ({ value: String(w.value), label: w.label }));
  const speed = warps.length <= 5
    ? segmented({ label, options: opts, value: String(value), onChange: (v) => { state.warp = Number(v); fire(); } })
    : selectCtl({ label, options: opts, value: String(value), onChange: (v) => { state.warp = Number(v); fire(); } });
  function paint() { playBtn.textContent = state.playing ? 'Pause' : 'Play'; }
  const root = el('div', { class: 'field', style: { gap: '10px' } }, row(playBtn, resetBtn), speed.el);
  return {
    el: root,
    set(p = {}) {
      if (p.playing != null) state.playing = !!p.playing;
      if (p.warp != null) { state.warp = p.warp; speed.set(String(p.warp)); }
      paint();
    },
  };
}

/**
 * Simulation clock. t is simulation seconds.
 * @returns {{t:number, tick:(dtReal:number, warp:number, playing:boolean)=>number, reset:(t?:number)=>void}}
 */
export function createClock() {
  const c = {
    t: 0,
    tick(dtReal, warp = 1, playing = true) { if (playing) c.t += dtReal * warp; return c.t; },
    reset(t = 0) { c.t = t; },
  };
  return c;
}
