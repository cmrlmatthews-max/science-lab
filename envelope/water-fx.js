// envelope/water-fx.js  Water effects for Water mode: rain streaks, flowing streams, wet film, wet stains, drips,
// attention ring and a gentle camera flight. Everything is one shared material per kind, no per-frame allocation.
// Rain is drawn as fine streaks in one LineSegments object. Under prefers-reduced-motion nothing moves:
// streaks are static and every stream keeps its direction arrows.

import * as THREE from 'three';
import { LineSegments2 } from '../vendor/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from '../vendor/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from '../vendor/addons/lines/LineMaterial.js';

const COLORS = {
  light: { water: '#2d7fe6', hi: [0.5, 0.78, 1.0], absorb: '#7c97b4', dry: '#aebccb', rain: '#3f86e8', stain: '#0f1f33', warn: '#c6431a' },
  dark: { water: '#55a8ff', hi: [0.62, 0.84, 1.0], absorb: '#9db4cf', dry: '#d3deea', rain: '#a9d2ff', stain: '#05080d', warn: '#ff8a5c' },
};

export function createFx(gfx, stage, { reduce }) {
  const T = THREE;
  let dark = !!stage.theme.dark;
  let C = COLORS[dark ? 'dark' : 'light'];
  const time = { value: 0 };
  const state = { rain: 60, wind: 30 };

  // per-build lists
  let streams = []; // ghost + tube pairs are not tracked (static); only moving things are
  let drops = []; // { mesh, curve, len, off, speed, idx, kind }
  let drips = []; // { mesh, x, y, z, fall, phase, speed, r }
  let rains = []; // rain objects
  let arrows = []; // wind arrows { mesh, y, phase }
  let stains = []; // { mesh, ghost, t0 }
  let rings = []; // active attention rings
  let lineMats = [];
  let pulseRing = null;
  let flight = null;

  // ---------------------------------------------------------------- shared materials
  function waterShader(m) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time;
      sh.uniforms.uHi = { value: new T.Vector3(...C.hi) };
      m.userData.hiU = sh.uniforms.uHi;
      sh.vertexShader = sh.vertexShader
        .replace('void main() {', 'varying float vSx;\nvoid main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvSx = uv.x;');
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', 'uniform float uTime;\nuniform vec3 uHi;\nvarying float vSx;\nvoid main() {')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\tfloat sw = sin(vSx * 0.8 - uTime * 3.2);\n\ttotalEmissiveRadiance += uHi * smoothstep(0.55, 1.0, sw) * 0.85;');
    };
    m.customProgramCacheKey = () => 'waterstream1';
    return m;
  }
  const streamMat = waterShader(new T.MeshStandardMaterial({ color: C.water, roughness: 0.05, metalness: 0, envMapIntensity: 2.4, transparent: true, opacity: 0.94, emissive: C.water, emissiveIntensity: 0.1 }));
  const ghostMat = waterShader(new T.MeshStandardMaterial({ color: C.water, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.5, depthWrite: false, depthFunc: T.GreaterDepth, emissive: C.water, emissiveIntensity: 0.25 }));
  const absorbMat = new T.MeshStandardMaterial({ color: C.absorb, roughness: 0.3, metalness: 0, transparent: true, opacity: 0.8, emissive: C.absorb, emissiveIntensity: 0.1 });
  const absorbGhost = new T.MeshStandardMaterial({ color: C.absorb, roughness: 0.4, transparent: true, opacity: 0.45, depthWrite: false, depthFunc: T.GreaterDepth, emissive: C.absorb, emissiveIntensity: 0.2 });
  const dryMat = new T.MeshStandardMaterial({ color: C.dry, roughness: 0.4, transparent: true, opacity: 0.9, emissive: C.dry, emissiveIntensity: 0.15 });
  const dryGhost = new T.MeshStandardMaterial({ color: C.dry, roughness: 0.4, transparent: true, opacity: 0.45, depthWrite: false, depthFunc: T.GreaterDepth, emissive: C.dry, emissiveIntensity: 0.25 });
  const dropMat = new T.MeshStandardMaterial({ color: C.water, roughness: 0.03, metalness: 0, envMapIntensity: 2.6, transparent: true, opacity: 0.95, emissive: C.water, emissiveIntensity: 0.15 });
  const poolMat = new T.MeshStandardMaterial({ color: C.water, roughness: 0.06, metalness: 0, envMapIntensity: 2, transparent: true, opacity: 0.55, depthWrite: false, emissive: C.water, emissiveIntensity: 0.08 });
  const poolGhost = new T.MeshStandardMaterial({ color: C.water, roughness: 0.3, transparent: true, opacity: 0.4, depthWrite: false, depthFunc: T.GreaterDepth, emissive: C.water, emissiveIntensity: 0.25 });
  const filmMat = new T.MeshStandardMaterial({ color: '#16385f', roughness: 0.04, metalness: 0, envMapIntensity: 2.4, transparent: true, opacity: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const blockMat = new T.MeshBasicMaterial({ color: C.warn, depthTest: false, transparent: true, opacity: 0.95 });
  const rainMat = new T.LineBasicMaterial({ color: C.rain, transparent: true, opacity: 0.4, depthWrite: false });
  const arrowMat = new T.MeshStandardMaterial({ color: dark ? '#cbd8e8' : '#5a6d86', roughness: 0.4, metalness: 0.1, transparent: true, opacity: 0.92 });
  const stainTex = makeStainTexture();
  const stainMat = new T.MeshBasicMaterial({ map: stainTex, color: C.stain, transparent: true, opacity: 0.66, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const stainGhost = new T.MeshBasicMaterial({ map: stainTex, color: C.stain, transparent: true, opacity: 0.42, depthWrite: false, depthFunc: T.GreaterDepth });
  const ringMat = new T.MeshBasicMaterial({ color: C.warn, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: T.DoubleSide, toneMapped: false });
  const allMats = [streamMat, ghostMat, absorbMat, absorbGhost, dryMat, dryGhost, dropMat, poolMat, poolGhost, filmMat, blockMat, rainMat, arrowMat, stainMat, stainGhost, ringMat];
  const unitPlane = new T.PlaneGeometry(1, 1);
  const dropGeo = new T.SphereGeometry(1, 12, 10);
  const coneGeo = new T.ConeGeometry(1, 2.4, 10);
  const ringGeo = new T.RingGeometry(0.86, 1, 64);

  function makeStainTexture() {
    const N = 128;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    const img = g.createImageData(N, N);
    // an irregular soft blob: radial falloff bent by smooth noise
    const ph = [1.3, 4.1, 2.2, 5.7];
    for (let y = 0; y < N; y += 1) {
      for (let x = 0; x < N; x += 1) {
        const u = (x / (N - 1)) * 2 - 1; const v = (y / (N - 1)) * 2 - 1;
        const r = Math.hypot(u, v); const a = Math.atan2(v, u);
        const edge = 0.78 + 0.1 * Math.sin(a * 3 + ph[0]) + 0.07 * Math.sin(a * 5 + ph[1]) + 0.05 * Math.sin(a * 9 + ph[2]);
        const k = Math.min(1, Math.max(0, (edge - r) / 0.34));
        const core = Math.min(1, Math.max(0, 1 - r / 0.7));
        const al = Math.min(1, k * (0.55 + 0.5 * core) + 0.04 * Math.sin(x * 0.8 + y * 0.6) * k);
        const i = (y * N + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(al * 255);
      }
    }
    g.putImageData(img, 0, 0);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  function recolor() {
    dark = !!stage.theme.dark;
    C = COLORS[dark ? 'dark' : 'light'];
    [streamMat, ghostMat, dropMat, poolMat, poolGhost].forEach((m) => { m.color.set(C.water); m.emissive.set(C.water); if (m.userData.hiU) m.userData.hiU.value.set(...C.hi); });
    [absorbMat, absorbGhost].forEach((m) => { m.color.set(C.absorb); m.emissive.set(C.absorb); });
    [dryMat, dryGhost].forEach((m) => { m.color.set(C.dry); m.emissive.set(C.dry); });
    rainMat.color.set(C.rain);
    stainMat.color.set(C.stain); stainGhost.color.set(C.stain);
    blockMat.color.set(C.warn); ringMat.color.set(C.warn);
    arrowMat.color.set(dark ? '#cbd8e8' : '#5a6d86');
    lineMats.forEach((m) => m.color.set(C.warn));
  }

  // ---------------------------------------------------------------- streams
  function twin(g, geo, main, ghost, order = 10) {
    const a = new T.Mesh(geo, main); a.renderOrder = order; a.raycast = () => {}; g.add(a);
    const b = new T.Mesh(geo, ghost); b.renderOrder = order - 1; b.raycast = () => {}; g.add(b);
    return a;
  }
  /**
   * A stream of water along a polyline of Vector3. kind: shed | drain | water | leak | absorb | dry | blocked.
   * Returns { curve, len }.
   */
  function addStream(g, points, kind, o = {}) {
    const r = o.r || 0.4;
    if (kind === 'blocked') {
      const e = points[points.length - 1];
      for (const a of [Math.PI / 4, -Math.PI / 4]) {
        const bar = new T.Mesh(cached('blockbar', () => new T.BoxGeometry(1, 0.2, 0.2)), blockMat);
        bar.scale.set(r * 6, r * 1.2, r * 1.2); bar.position.copy(e); bar.rotation.z = a; bar.renderOrder = 12; bar.raycast = () => {};
        g.add(bar);
      }
      return null;
    }
    const curve = new T.CatmullRomCurve3(points, false, 'centripetal');
    const len = curve.getLength();
    if (kind === 'dry') {
      const n = Math.max(4, Math.round(len / (r * 6)));
      const geo = cached('drysphere', () => new T.SphereGeometry(1, 8, 6));
      for (let i = 0; i <= n; i += 1) {
        const s = new T.Mesh(geo, dryMat);
        s.scale.setScalar(r * 0.8); s.position.copy(curve.getPointAt(i / n)); s.renderOrder = 10; s.raycast = () => {};
        g.add(s);
        const sg = new T.Mesh(geo, dryGhost);
        sg.scale.copy(s.scale); sg.position.copy(s.position); sg.renderOrder = 9; sg.raycast = () => {};
        g.add(sg);
      }
    } else {
      const geo = new T.TubeGeometry(curve, Math.max(12, (points.length - 1) * 9), kind === 'absorb' ? r * 1.2 : r, 8, false);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i += 1) uv.setX(i, (uv.getX(i) * len / r) * 0.55);
      if (kind === 'absorb') twin(g, geo, absorbMat, absorbGhost);
      else twin(g, geo, streamMat, ghostMat);
    }
    // direction arrows
    const col = kind === 'absorb' ? absorbMat : kind === 'dry' ? dryMat : streamMat;
    const nArrow = Math.max(1, Math.min(4, Math.floor(len / (r * 38)) + 1));
    for (let i = 0; i < nArrow; i += 1) {
      const u = nArrow === 1 ? 0.9 : 0.3 + (0.62 * i) / (nArrow - 1);
      const cone = new T.Mesh(coneGeo, col);
      cone.scale.setScalar(r * 1.9);
      cone.position.copy(curve.getPointAt(u));
      cone.quaternion.setFromUnitVectors(_up, curve.getTangentAt(u).normalize());
      cone.renderOrder = 11; cone.raycast = () => {};
      g.add(cone);
    }
    // moving drops
    if (kind === 'absorb') {
      const d = new T.Mesh(dropGeo, dropMat); d.scale.setScalar(r * 1.5); d.renderOrder = 12; d.raycast = () => {}; g.add(d);
      drops.push({ mesh: d, curve, len, idx: 0, off: 0.3, speed: (o.speed || 1) * 0.5, kind, r: r * 1.5, unit: o.unit });
    } else if (kind !== 'dry') {
      for (let i = 0; i < 3; i += 1) {
        const d = new T.Mesh(dropGeo, dropMat); d.scale.set(r * 1.6, r * 2.1, r * 1.6); d.renderOrder = 12; d.raycast = () => {}; g.add(d);
        const dd = { mesh: d, curve, len, idx: i, off: (i + 0.5) / 3, speed: o.speed || 1, kind, r, unit: o.unit };
        d.visible = i < nDrops();
        curve.getPointAt(dd.off, d.position);
        drops.push(dd);
      }
    }
    return { curve, len };
  }
  const _up = new T.Vector3(0, 1, 0);
  const nDrops = () => Math.ceil(state.rain / 34);
  const cache = new Map();
  function cached(k, f) { let v = cache.get(k); if (!v) { v = f(); cache.set(k, v); } return v; }

  /** Glossy pool of water in a box [x0,x1,y0,y1,z0,z1]. */
  function addPool(g, b) {
    const [x0, x1, y0, y1, z0, z1] = b;
    const geo = new T.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    const a = new T.Mesh(geo, poolMat); a.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); a.renderOrder = 8; a.raycast = () => {};
    const bgm = new T.Mesh(geo, poolGhost); bgm.position.copy(a.position); bgm.renderOrder = 7; bgm.raycast = () => {};
    g.add(a, bgm);
  }

  // ---------------------------------------------------------------- film and stains
  /** A thin glossy film over a polygon [[x,y]...] (with holes) at z: darkens and shines where rain lands. */
  function addFilm(g, poly, z, holes) {
    const sh = new T.Shape();
    poly.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
    sh.closePath();
    (holes || []).forEach((h) => { const p = new T.Path(); h.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); p.closePath(); sh.holes.push(p); });
    const geo = new T.ShapeGeometry(sh, 1);
    const m = new T.Mesh(geo, filmMat);
    m.position.z = z; m.renderOrder = 4; m.raycast = () => {};
    g.add(m);
    return m;
  }
  /** A dark wet stain on a surface facing +z. patch = { x0, x1, y0, y1 }. Spreads once when it appears. */
  function addStain(g, patch, z, o = {}) {
    const w = (patch.x1 - patch.x0); const h = (patch.y1 - patch.y0);
    const cx = (patch.x0 + patch.x1) / 2; const cy = (patch.y0 + patch.y1) / 2;
    const a = new T.Mesh(unitPlane, stainMat); const b = new T.Mesh(unitPlane, stainGhost);
    [a, b].forEach((m, i) => {
      if (o.facing === 'x') { m.position.set(z, cy, cx); m.rotation.y = Math.PI / 2; } else m.position.set(cx, cy, z);
      m.renderOrder = i ? 5 : 6; m.raycast = () => {}; m.scale.set(w * 1.12, h * 1.12, 1); g.add(m);
    });
    stains.push({ mesh: a, ghost: b, t0: -1, w: w * 1.12, h: h * 1.12 });
    return a;
  }
  /** A dashed warm outline around a rectangle, drawn over everything so a hidden leak can still be found. */
  function addWarnOutline(g, patch, z, pad = 0.8) {
    const x0 = patch.x0 - pad; const x1 = patch.x1 + pad; const y0 = patch.y0 - pad; const y1 = patch.y1 + pad;
    const pts = [x0, y0, z, x1, y0, z, x1, y0, z, x1, y1, z, x1, y1, z, x0, y1, z, x0, y1, z, x0, y0, z];
    const geo = new LineSegmentsGeometry();
    geo.setPositions(pts);
    const mat = new LineMaterial({ color: C.warn, linewidth: 2, dashed: true, dashSize: 1.4, gapSize: 0.9, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, toneMapped: false });
    const ln = new LineSegments2(geo, mat);
    ln.computeLineDistances();
    ln.renderOrder = 18; ln.raycast = () => {};
    g.add(ln);
    lineMats.push(mat);
    return ln;
  }

  // ---------------------------------------------------------------- drips
  /** A drop that forms at p and falls `fall` inches. */
  function addDrip(g, p, o = {}) {
    const r = o.r || 0.25;
    const m = new T.Mesh(dropGeo, dropMat);
    m.scale.set(r, r * 1.4, r); m.position.copy(p); m.renderOrder = 12; m.raycast = () => {};
    g.add(m);
    drips.push({ mesh: m, x: p.x, y: p.y, z: p.z, fall: o.fall || 4, phase: Math.random(), speed: o.speed || 0.7, r });
  }

  // ---------------------------------------------------------------- rain
  /**
   * Rain as fine streaks in one LineSegments. box: { x0,x1,y0,y1,z0,z1 } spawn and kill region, o.k: scale of speed and length.
   * Under reduced motion the streaks are still and the wind arrows stay.
   */
  function addRain(g, box, o = {}) {
    const k = o.k || 1;
    const N = o.n || 900;
    const pos = new Float32Array(N * 6);
    const vel = new Float32Array(N);
    for (let i = 0; i < N; i += 1) {
      vel[i] = 0.75 + Math.random() * 0.5;
      const x = box.x0 + Math.random() * (box.x1 - box.x0);
      const y = box.y0 + Math.random() * (box.y1 - box.y0);
      const z = box.z0 + Math.random() * (box.z1 - box.z0);
      pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const ls = new T.LineSegments(geo, rainMat);
    ls.frustumCulled = false; ls.renderOrder = 3; ls.raycast = () => {};
    g.add(ls);
    const obj = { ls, pos, vel, N, box, k };
    rains.push(obj);
    placeStreaks(obj, 0);
    if (reduce) { geo.setDrawRange(0, Math.round(N * 0.35 * 2)); }
    return obj;
  }
  function placeStreaks(r, dt) {
    const { pos, vel, N, box, k } = r;
    const cnt = reduce ? Math.round(N * 0.35) : Math.round(N * (state.rain / 100));
    const vy = (38 + 50 * (state.rain / 100)) * k;
    const wind = state.wind / 100;
    const vz = wind * vy * 0.8;
    const L = 0.034;
    for (let i = 0; i < cnt; i += 1) {
      const a = i * 6;
      if (!reduce) {
        pos[a + 1] -= vy * vel[i] * dt;
        pos[a + 2] -= vz * vel[i] * dt;
        if (pos[a + 1] < box.y0 || pos[a + 2] < box.z0) {
          pos[a] = box.x0 + Math.random() * (box.x1 - box.x0);
          pos[a + 1] = box.y1 - Math.random() * 6 * k;
          pos[a + 2] = box.z0 + Math.random() * (box.z1 - box.z0) + wind * 30 * k;
        }
      } else if (pos[a + 2] < box.z0 + 1) { pos[a + 2] = box.z0 + 1 + (i % 7); }
      pos[a + 3] = pos[a]; pos[a + 4] = pos[a + 1] + vy * vel[i] * L; pos[a + 5] = pos[a + 2] + vz * vel[i] * L;
    }
    r.ls.geometry.setDrawRange(0, cnt * 2);
    r.ls.geometry.attributes.position.needsUpdate = true;
  }
  /** Static wind-and-rain arrows for reduced motion (clear direction, no animation). */
  function addStaticArrows(g, box) {
    const wind = state.wind / 100;
    const dir = new T.Vector3(0, -1, -wind * 0.9).normalize();
    const n = 6;
    for (let i = 0; i < n; i += 1) {
      const x = box.x0 + ((i + 0.5) / n) * (box.x1 - box.x0);
      const a = new T.ArrowHelper(dir, new T.Vector3(x, box.y1 - 4, box.z0 + 8 + (i % 2) * 5), 12, dark ? 0x7fb6ff : 0x2a6fd8, 4, 2.4);
      a.renderOrder = 10; a.line.material.depthTest = false; a.cone.material.depthTest = false;
      a.raycast = () => {};
      g.add(a);
    }
  }
  /** Wind arrows for the wind driven forces (Forces view). */
  function addWindArrows(g, ys, x, z0, len = 5, k = 1) {
    const body = cached('wbody', () => new T.CylinderGeometry(0.12, 0.12, 3, 10));
    const head = cached('whead', () => new T.ConeGeometry(0.38, 0.95, 12));
    ys.forEach((y, i) => {
      const a = new T.Group();
      const b = new T.Mesh(body, arrowMat); b.rotation.x = Math.PI / 2; b.position.z = 1.5;
      const h = new T.Mesh(head, arrowMat); h.rotation.x = -Math.PI / 2; h.position.z = -0.4;
      b.raycast = () => {}; h.raycast = () => {};
      a.add(b, h); a.position.set(x, y, z0); a.renderOrder = 8;
      g.add(a);
      arrows.push({ mesh: a, z0, len, phase: i * 0.37, i });
    });
  }

  // ---------------------------------------------------------------- attention ring and flight
  function pulse(center, size = 6) {
    if (reduce || !stage.supported) return;
    if (!pulseRing) {
      pulseRing = new T.Mesh(ringGeo, ringMat);
      pulseRing.renderOrder = 40; pulseRing.raycast = () => {};
      stage.scene.add(pulseRing);
    }
    pulseRing.userData = { t: 0, dur: 1.5, size, c: center.clone() };
    pulseRing.position.copy(center);
    pulseRing.visible = true;
    stage.requestRender();
  }
  /** Fly the camera (only when asked). Jumps under reduced motion. */
  function flyTo(pos, target, dur = 0.7) {
    const cam = stage.camera; const ctl = stage.controls;
    if (!ctl) return;
    if (reduce) { cam.position.copy(pos); ctl.target.copy(target); ctl.update(); stage.requestRender(); return; }
    flight = { p0: cam.position.clone(), t0: ctl.target.clone(), p1: pos.clone(), t1: target.clone(), t: 0, dur };
    stage.requestRender();
  }

  // ---------------------------------------------------------------- per frame
  const _sz = new T.Vector2();
  let lastW = 0; let lastH = 0;
  function update(dt, t) {
    time.value = reduce ? 0.6 : t;
    if (!reduce) {
      for (const d of drops) {
        if (!d.mesh.visible) continue;
        const unit = d.unit || 22;
        const sp = (unit * (0.35 + state.rain / 100) * d.speed) / d.len;
        d.off = (d.off + dt * sp) % 1;
        d.curve.getPointAt(d.off, d.mesh.position);
      }
      for (const r of rains) placeStreaks(r, dt);
      const vis = state.rain > 4;
      for (const d of drips) {
        d.mesh.visible = vis;
        if (!vis) continue;
        const u = (t * d.speed + d.phase) % 1;
        d.mesh.position.set(d.x, d.y - d.fall * u * u, d.z);
        const s = u < 0.25 ? u / 0.25 : 1;
        d.mesh.scale.set(d.r * s, d.r * (1 + 0.8 * u) * s, d.r * s);
      }
      for (const s of stains) {
        if (s.t0 < 0) s.t0 = t;
        const k = Math.min(1, (t - s.t0) / 2.6);
        const e = 1 - (1 - k) * (1 - k);
        const sc = 0.4 + 0.6 * e;
        s.mesh.scale.set(s.w * sc, s.h * sc, 1); s.ghost.scale.copy(s.mesh.scale);
      }
    }
    if (arrows.length) {
      const wd = state.wind / 100;
      for (const a of arrows) {
        a.mesh.visible = a.i < 1 + Math.round(wd * 4) && wd > 0.01;
        const k = reduce ? 0.3 : ((t * (0.35 + wd * 0.9) + a.phase) % 1);
        a.mesh.position.z = a.z0 - k * a.len;
        a.mesh.scale.set(1, 1, 0.5 + wd * 1.2);
      }
    }
    if (pulseRing && pulseRing.visible) {
      const u = pulseRing.userData;
      u.t += dt;
      const k = Math.min(1, u.t / u.dur);
      const e = 1 - (1 - k) * (1 - k);
      pulseRing.scale.setScalar(u.size * (0.35 + 1.0 * e));
      ringMat.opacity = 0.8 * (1 - k);
      pulseRing.quaternion.copy(stage.camera.quaternion);
      if (k >= 1) pulseRing.visible = false;
    }
    if (flight) {
      flight.t += dt;
      const k = Math.min(1, flight.t / flight.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      stage.camera.position.lerpVectors(flight.p0, flight.p1, e);
      stage.controls.target.lerpVectors(flight.t0, flight.t1, e);
      if (k >= 1) flight = null;
    }
    if (lineMats.length && stage.renderer) {
      stage.renderer.getSize(_sz);
      if (_sz.x !== lastW || _sz.y !== lastH) { lastW = _sz.x; lastH = _sz.y; lineMats.forEach((m) => m.resolution.set(_sz.x, _sz.y)); }
    }
  }

  function setRain(v) {
    state.rain = v;
    filmMat.opacity = 0.03 + 0.2 * (v / 100);
    drops.forEach((d) => { d.mesh.visible = d.kind === 'absorb' ? v > 0 : d.idx < nDrops(); });
    stage.requestRender();
  }
  function setWind(v) { state.wind = v; stage.requestRender(); }

  /** Forget everything made for the previous build (geometry is disposed with the group). */
  function reset() {
    drops = []; drips = []; rains = []; arrows = []; stains = []; lineMats = [];
    if (flight) flight = null;
  }
  function dispose() {
    allMats.forEach((m) => m.dispose());
    stainTex.dispose(); unitPlane.dispose(); dropGeo.dispose(); coneGeo.dispose(); ringGeo.dispose();
    cache.forEach((g) => g.dispose());
    if (pulseRing) stage.scene.remove(pulseRing);
  }

  return {
    addStream, addPool, addFilm, addStain, addWarnOutline, addDrip, addRain, addStaticArrows, addWindArrows,
    pulse, flyTo, update, setRain, setWind, reset, recolor, dispose, state, colors: () => C,
  };
}
