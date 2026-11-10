// envelope/labels3d.js  Quiet 3D callouts for Envelope Lab (Assembly, Thermal Bridge, Water).
// A callout is a small pill label with a thin leader line and an anchor dot. Text is sentence case, system sans,
// regular weight. The label keeps a constant on-screen size (CSS pixels), is drawn on top of the scene
// (depth test off), is re-drawn when the theme changes, and is sharp on retina screens (canvas at devicePixelRatio x 2).
//
// Placement rule: the callout group sits at the anchor (a point on the object); the label sits at `offset`
// from the anchor (scene units, inches). The group must have a parent with no transform (a scene or a plain group).
// Use layoutCallouts(callouts, stage) after the camera settles to push overlapping labels apart on screen.

import * as THREE from 'three';
import { TEMP_STOPS } from '../shared/scene.js';

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif';
const WARM = TEMP_STOPS[TEMP_STOPS.length - 1][1];
const COLD = TEMP_STOPS[0][1];

const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const pixelScale = () => Math.min(4, Math.max(2, Math.ceil((window.devicePixelRatio || 1) * 2)));

function rgba(hex, a) {
  const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16);
  if (Number.isNaN(n)) return hex;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Draw a pill into `canvas`. Returns the CSS-pixel size of the pill.
 * lines: array of strings. The first line is the title, the rest are muted.
 */
function drawPill(canvas, lines, th, o) {
  const S = pixelScale();
  const fs = o.fontPx;
  const padX = o.padX;
  const padY = o.padY;
  const lh = Math.round(fs * 1.28);
  const dotW = o.dot ? 14 : 0;
  const ctx = canvas.getContext('2d');
  const font = (k) => `${k === 0 ? 500 : 400} ${(k === 0 ? fs : fs - 1) * S}px ${FONT}`;
  let tw = 0;
  lines.forEach((t, k) => { ctx.font = font(k); tw = Math.max(tw, ctx.measureText(t).width / S); });
  const w = Math.ceil(tw + padX * 2 + dotW) + 2;
  const h = Math.ceil(lh * lines.length + padY * 2) + 2;
  canvas.width = Math.ceil(w * S);
  canvas.height = Math.ceil(h * S);
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const x = 1; const y = 1; const bw = w - 2; const bh = h - 2;
  // soft lift so the pill reads over a busy wall
  ctx.save();
  ctx.shadowColor = th.dark ? 'rgba(0,0,0,0.45)' : 'rgba(20,30,45,0.14)';
  ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
  roundRect(ctx, x, y, bw, bh, 7);
  ctx.fillStyle = rgba(th.paper, o.active ? 1 : 0.95);
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x, y, bw, bh, 7);
  if (o.active) { ctx.fillStyle = rgba(th.accent, th.dark ? 0.16 : 0.08); ctx.fill(); }
  ctx.lineWidth = o.active ? 1.5 : 1;
  ctx.strokeStyle = o.active ? th.accent : rgba(th.ink, th.dark ? 0.32 : 0.24);
  ctx.stroke();
  if (o.dot) {
    ctx.beginPath(); ctx.arc(x + padX + 4, y + bh / 2, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = o.dot; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = rgba(th.ink, 0.35); ctx.stroke();
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  lines.forEach((t, k) => {
    ctx.font = font(k);
    ctx.fillStyle = k === 0 ? th.ink : rgba(th.ink, 0.72);
    ctx.fillText(t, x + padX + dotW, y + padY + lh * k + lh / 2 + 0.5);
  });
  return { w, h };
}

function dotTexture(color, ring) {
  const S = 4; const N = 16;
  const c = document.createElement('canvas');
  c.width = c.height = N * S;
  const g = c.getContext('2d');
  g.setTransform(S, 0, 0, S, 0, 0);
  g.beginPath(); g.arc(N / 2, N / 2, 6.2, 0, Math.PI * 2); g.fillStyle = ring; g.fill();
  g.beginPath(); g.arc(N / 2, N / 2, 4.4, 0, Math.PI * 2); g.fillStyle = color; g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const _sz = new THREE.Vector2();
/** Keep a sprite at a constant CSS pixel size (sizeAttenuation off) whatever the camera does. */
function pixelSprite(map, order) {
  const mat = new THREE.SpriteMaterial({
    map, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false, toneMapped: false,
  });
  const sp = new THREE.Sprite(mat);
  sp.renderOrder = order;
  sp.userData.px = { w: 10, h: 10, k: 1 };
  sp.onBeforeRender = (renderer, scene, camera) => {
    renderer.getSize(_sz);
    if (!_sz.y) return;
    const f = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / _sz.y;
    const p = sp.userData.px;
    sp.scale.set(p.w * f * p.k, p.h * f * p.k, 1);
    sp.updateMatrixWorld(true);
  };
  return sp;
}

function themeOf(stage) { return stage.theme; }

/** World point to client (page) coordinates. Returns { x, y, visible } (visible: in front of the camera and in the canvas). */
export function worldToClient(stage, v) {
  const r = stage.renderer.domElement.getBoundingClientRect();
  const p = v.clone().project(stage.camera);
  const x = r.left + ((p.x + 1) / 2) * r.width;
  const y = r.top + ((1 - p.y) / 2) * r.height;
  return { x, y, visible: p.z > -1 && p.z < 1 && p.x > -1 && p.x < 1 && p.y > -1 && p.y < 1 };
}

/**
 * A callout: label + leader line + anchor dot.
 * @param {object} stage the Science Lab stage
 * @param {object} opts { text (use \n for a muted second line), anchor: Vector3, offset: Vector3, id (INFO id), side: 'left'|'right'|'auto',
 *   fontPx?, dotColor?, layerIndex?, parent? (default stage.scene) }
 */
export function createCallout(stage, opts = {}) {
  const parent = opts.parent || stage.scene;
  const object = new THREE.Group();
  object.name = 'callout';
  object.userData.infoId = opts.id || null;
  if (opts.layerIndex != null) object.userData.layerIndex = opts.layerIndex;
  object.position.copy(opts.anchor || new THREE.Vector3());
  parent.add(object);

  let text = String(opts.text || '');
  let active = false;
  let side = opts.side || 'auto';
  const offset = (opts.offset || new THREE.Vector3(10, 6, 0)).clone();
  let size = { w: 60, h: 22 };
  let pulse = 0;
  let stopPulse = null;
  const fontPx = opts.fontPx || 12.5;
  let dotColor = opts.dotColor || null;

  const canvas = document.createElement('canvas');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  const label = pixelSprite(tex, 32);
  label.userData.callout = true;
  object.add(label);

  let dotTex = null;
  const dot = pixelSprite(null, 31);
  object.add(dot);
  dot.userData.px = { w: 12, h: 12, k: 1 };

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0], 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false, toneMapped: false });
  const line = new THREE.Line(lineGeo, lineMat);
  line.renderOrder = 30; line.frustumCarried = false; line.frustumCulled = false;
  line.raycast = () => {};
  object.add(line);

  function resolvedSide() {
    if (side !== 'auto') return side;
    return offset.x >= 0 ? 'right' : 'left';
  }

  function paint() {
    const th = themeOf(stage);
    const lines = text.split('\n');
    const dims = drawPill(canvas, lines, th, { fontPx, padX: 8, padY: 4.5, active });
    tex.needsUpdate = true;
    size = dims;
    label.userData.px.w = dims.w; label.userData.px.h = dims.h;
    // dot
    if (dotTex) dotTex.dispose();
    dotTex = dotTexture(dotColor || (th.dark ? '#e4e7eb' : '#1c1f23'), th.paper);
    dot.material.map = dotTex; dot.material.needsUpdate = true;
    lineMat.color.set(th.ink);
    lineMat.opacity = th.dark ? 0.62 : 0.55;
    place();
  }

  function place() {
    const s = resolvedSide();
    label.center.set(s === 'left' ? 1 : 0, 0.5);
    label.position.copy(offset);
    const a = lineGeo.attributes.position;
    a.setXYZ(1, offset.x, offset.y, offset.z);
    a.needsUpdate = true;
    lineGeo.computeBoundingSphere();
    stage.requestRender();
  }

  function startPulse(on) {
    if (on && !reduceMotion()) {
      if (!stopPulse) {
        stopPulse = stage.onFrame((dt, t) => {
          dot.userData.px.k = 1 + 0.28 * (0.5 + 0.5 * Math.sin(t * 3.2));
        });
      }
    } else if (stopPulse) { stopPulse(); stopPulse = null; dot.userData.px.k = 1; stage.requestRender(); }
  }

  const offTheme = stage.onTheme ? stage.onTheme(() => paint()) : () => {};
  paint();

  const api = {
    object,
    userData: object.userData,
    get size() { return size; },
    get anchor() { return object.position; },
    get offset() { return offset; },
    get text() { return text; },
    setText(t) { text = String(t); paint(); },
    setAnchor(v) { object.position.copy(v); stage.requestRender(); },
    setOffset(v) { offset.copy(v); place(); },
    setVisible(b) { object.visible = !!b; stage.requestRender(); },
    setActive(b) { if (!!b === active) return; active = !!b; paint(); },
    setSide(s) { side = s; place(); },
    setDotColor(c) { dotColor = c; paint(); },
    /** Gentle pulse of the anchor dot (skipped when the person prefers reduced motion). */
    setPulse(on) { pulse = on ? 1 : 0; startPulse(!!pulse); },
    /** World position of the label attach point (the label edge nearest the anchor). */
    labelWorld() { return object.position.clone().add(offset); },
    /** Client-pixel rectangle of the label: { left, top, right, bottom }. */
    clientRect() {
      const p = worldToClient(stage, api.labelWorld());
      const s = resolvedSide();
      const left = s === 'left' ? p.x - size.w : p.x;
      return { left, top: p.y - size.h / 2, right: left + size.w, bottom: p.y + size.h / 2, visible: p.visible };
    },
    dispose() {
      offTheme();
      startPulse(false);
      if (object.parent) object.parent.remove(object);
      tex.dispose(); label.material.dispose();
      if (dotTex) dotTex.dispose();
      dot.material.dispose(); lineGeo.dispose(); lineMat.dispose();
    },
  };
  return api;
}

/** The callout under the pointer (topmost first), or null. A small margin makes it easy to hit with a finger. */
export function pickCallout(stage, clientX, clientY, callouts) {
  const m = 3;
  for (let i = callouts.length - 1; i >= 0; i -= 1) {
    const c = callouts[i];
    if (!c || !c.object.visible) continue;
    let p = c.object.parent; let shown = true;
    while (p) { if (p.visible === false) { shown = false; break; } p = p.parent; }
    if (!shown) continue;
    const r = c.clientRect();
    if (clientX >= r.left - m && clientX <= r.right + m && clientY >= r.top - m && clientY <= r.bottom + m) return c;
  }
  return null;
}

/**
 * A slightly larger quiet tag with a small colored dot, used for "Inside" and "Outside".
 * opts: { text, position: Vector3, tone: 'warm'|'cold', align?: 'center'|'left'|'right', parent? }
 */
export function createSideMarker(stage, opts = {}) {
  const parent = opts.parent || stage.scene;
  const canvas = document.createElement('canvas');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  const sp = pixelSprite(tex, 33);
  sp.position.copy(opts.position || new THREE.Vector3());
  sp.userData.marker = true;
  sp.raycast = () => {};
  let text = String(opts.text || '');
  let tone = opts.tone || 'warm';
  let align = opts.align || 'center';
  function paint() {
    const th = themeOf(stage);
    const dims = drawPill(canvas, [text], th, { fontPx: 13.5, padX: 10, padY: 6, dot: tone === 'warm' ? WARM : COLD });
    tex.needsUpdate = true;
    sp.userData.px.w = dims.w; sp.userData.px.h = dims.h;
    sp.center.set(align === 'left' ? 0 : align === 'right' ? 1 : 0.5, 0.5);
    stage.requestRender();
  }
  const offTheme = stage.onTheme ? stage.onTheme(() => paint()) : () => {};
  parent.add(sp);
  paint();
  return {
    object: sp,
    userData: sp.userData,
    setText(t) { text = String(t); paint(); },
    setTone(t) { tone = t; paint(); },
    setPosition(v) { sp.position.copy(v); stage.requestRender(); },
    setVisible(b) { sp.visible = !!b; stage.requestRender(); },
    dispose() {
      offTheme();
      if (sp.parent) sp.parent.remove(sp);
      tex.dispose(); sp.material.dispose();
    },
  };
}

const _ray = new THREE.Vector3();
const _fwd = new THREE.Vector3();

/**
 * Nudge label offsets so labels do not overlap on screen (vertical push; the sideways position is kept).
 * Call after the camera has settled or the layout changed, not every frame.
 * opts: { gap = 4 (px between labels), margin = 6 (px from the canvas edge) }
 */
export function layoutCallouts(callouts, stage, opts = {}) {
  const gap = opts.gap ?? 4;
  const margin = opts.margin ?? 6;
  const cam = stage.camera;
  const dom = stage.renderer && stage.renderer.domElement;
  if (!dom) return;
  const r = dom.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const items = [];
  callouts.forEach((c) => {
    if (!c || !c.object.visible) return;
    const w = c.labelWorld();
    const p = worldToClient(stage, w);
    items.push({ c, world: w, x: p.x - r.left, y: p.y - r.top, h: c.size.h, w: c.size.w, y0: p.y - r.top });
  });
  items.sort((a, b) => a.y - b.y);
  const overlapX = (a, b) => {
    const sa = a.c.clientRect(); const sb = b.c.clientRect();
    return sa.left < sb.right + 4 && sb.left < sa.right + 4;
  };
  for (let k = 1; k < items.length; k += 1) {
    for (let j = k - 1; j >= 0; j -= 1) {
      if (!overlapX(items[j], items[k])) continue;
      const min = items[j].y + (items[j].h + items[k].h) / 2 + gap;
      if (items[k].y < min) items[k].y = min;
    }
  }
  // keep inside the canvas: shift the whole bottom group up if it overflows
  const bottom = r.height - margin;
  for (let k = items.length - 1; k >= 0; k -= 1) {
    const maxY = (k === items.length - 1 ? bottom : items[k + 1].y - (items[k].h + items[k + 1].h) / 2 - gap) - items[k].h / 2;
    if (items[k].y > maxY) items[k].y = maxY;
  }
  items.forEach((it) => { if (it.y < margin + it.h / 2) it.y = margin + it.h / 2; });
  cam.getWorldDirection(_fwd);
  items.forEach((it) => {
    if (Math.abs(it.y - it.y0) < 0.5) return;
    const ndc = new THREE.Vector3((it.x / r.width) * 2 - 1, -((it.y / r.height) * 2 - 1), 0.5).unproject(cam);
    _ray.copy(ndc).sub(cam.position);
    const den = _ray.dot(_fwd);
    if (Math.abs(den) < 1e-6) return;
    const t = it.world.clone().sub(cam.position).dot(_fwd) / den;
    const target = cam.position.clone().addScaledVector(_ray, t);
    it.c.setOffset(target.sub(it.c.object.position));
  });
  stage.requestRender();
}
