// molecules/viewer.js  shared 3D atom and bond renderer for Molecules and Crystals.
//
// WHAT IT DRAWS
//   One structure (see CONTRACT-MOLECULES.md section 2) at a time: atoms as instanced spheres (one InstancedMesh
//   per element and opacity level), bonds as instanced cylinders (one InstancedMesh per opacity level), an
//   inverted-hull rim on every atom so white H reads on the light stage and dark C reads on the dark stage,
//   plus optional cell box, translucent planes, arrows (dipoles), element labels, highlights and a measure tool.
//   Bonds are always given by the structure. The viewer never guesses bonds.
//
// UNITS AND SCALE
//   Scene units are ångström. Every on-screen thickness (rim, halo, dashes, arrows, arcs) is derived from the
//   structure size S so it looks the same in pixels for a 3-atom molecule and a 2,000-atom crystal block.
//   The viewer assumes the viewer.group keeps an identity transform (it never moves it).
//
// RADII (Å, before radiusScale)
//   ball-stick : 0.1 + 0.34 x covalent radius            (H 0.21, C 0.36, O 0.32, Fe 0.55)   x radiusScale
//   space-fill : van der Waals radius                      x radiusScale
//                (opts.spaceRadius 'metallic' | 'covalent' picks another table for metals and salts)
//   sticks     : 0.19 x bond-size factor (small joints; radiusScale is ignored)
//
// CAMERA
//   createViewer sets the stage camera FOV to 25 degrees (nearly orthographic look). frame() fits the
//   bounding sphere once. Nothing else in this file ever moves the camera except the turntable spin.
//
// THEME
//   Rim, bond gray, cell lines, planes, labels and measure marks follow the CSS tokens and redraw on
//   prefers-color-scheme change (through stage.onTheme).

import { THREE } from '../shared/scene.js';
import { section, segmented, toggle, button } from '../shared/ui.js';
import { ELEMENTS } from './elements.js';

export const STYLE_OPTIONS = [
  { value: 'ball-stick', label: 'Ball and stick' },
  { value: 'space-fill', label: 'Space filling' },
  { value: 'sticks', label: 'Sticks' },
];

const FONT = '-apple-system, "SF Pro Text", system-ui, "Helvetica Neue", Arial, sans-serif';
const FOV = 25;
const SPIN_RATE = 0.2;        // rad per second, about 11 degrees per second
const TEXT_SCALE = 3;         // label canvas pixels per CSS pixel
const LABEL_MAX_ATOMS = 150;
const TAP_PICK_PX = 16;       // screen-space pick tolerance when the ray misses

// Built-in element table used for any element missing from ELEMENTS (CPK-style colors, radii in Å).
const FALLBACK = {
  H: { color: '#f2f2f2', cov: 0.31, vdw: 1.2 },
  C: { color: '#555a60', cov: 0.76, vdw: 1.7 },
  N: { color: '#3050f8', cov: 0.71, vdw: 1.55 },
  O: { color: '#e8312f', cov: 0.66, vdw: 1.52 },
  F: { color: '#90e050', cov: 0.57, vdw: 1.47 },
  Na: { color: '#ab5cf2', cov: 1.66, vdw: 2.27, met: 1.86 },
  Mg: { color: '#2f9e2f', cov: 1.41, vdw: 1.73, met: 1.6 },
  Al: { color: '#bfa6a6', cov: 1.21, vdw: 1.84, met: 1.43 },
  Si: { color: '#dab88b', cov: 1.11, vdw: 2.1 },
  S: { color: '#f2d22e', cov: 1.05, vdw: 1.8 },
  Cl: { color: '#2bd02b', cov: 1.02, vdw: 1.75 },
  Ca: { color: '#8fa68f', cov: 1.76, vdw: 2.31, met: 1.97 },
  Ti: { color: '#a0a4aa', cov: 1.6, vdw: 2.15, met: 1.47 },
  Fe: { color: '#e06633', cov: 1.32, vdw: 2.04, met: 1.26 },
  Cu: { color: '#c88033', cov: 1.32, vdw: 1.4, met: 1.28 },
  Zn: { color: '#7d80b0', cov: 1.22, vdw: 1.39, met: 1.34 },
  Cs: { color: '#57178f', cov: 2.44, vdw: 3.43, met: 2.65 },
};
const FALLBACK_DEFAULT = { color: '#b0b6bd', cov: 0.8, vdw: 1.8 };

const infoCache = new Map();
/** Element data used for drawing: { color, cov, vdw, met }. */
function elemInfo(sym) {
  let r = infoCache.get(sym);
  if (r) return r;
  const e = (ELEMENTS && ELEMENTS[sym]) || null;
  const fb = FALLBACK[sym] || FALLBACK_DEFAULT;
  r = {
    color: (e && e.color) || fb.color,
    cov: (e && e.covalent) || fb.cov,
    vdw: (e && e.vdw) || fb.vdw,
    met: (e && e.metallic) || fb.met || null,
  };
  const c = new THREE.Color(r.color);
  r.lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;   // linear luminance
  infoCache.set(sym, r);
  return r;
}

// ---------- theme ----------
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const get = (n, f) => cs.getPropertyValue(n).trim() || f;
  const dark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const ink = get('--ink', dark ? '#e4e7eb' : '#1c1f23');
  const bg = get('--stage-bg', dark ? '#1b1e22' : '#eceef1');
  return {
    dark,
    bg,
    ink,
    ink2: get('--ink-2', dark ? '#9aa4b0' : '#5b6470'),
    paper: get('--paper-2', dark ? '#22262b' : '#ffffff'),
    line: get('--line-strong', dark ? '#4a515a' : '#bcc2cb'),
    accent: get('--accent', dark ? '#58a6e0' : '#1f5fa8'),
    hot: get('--hot', dark ? '#ff9a5c' : '#c4491f'),
    // rim: ink pulled toward the stage background so it reads as an outline, not a black ring
    rim: new THREE.Color(ink).lerp(new THREE.Color(bg), dark ? 0.38 : 0.12).getStyle(),
    bond: dark ? '#a3abb5' : '#7b838d',
  };
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

function disposeMaterial(m) {
  if (!m) return;
  for (const k of Object.keys(m)) { const v = m[k]; if (v && v.isTexture) v.dispose(); }
  m.dispose();
}
function disposeObject(o) {
  o.traverse((c) => {
    if (c.isInstancedMesh && c.dispose) c.dispose();
    if (c.geometry && c.geometry.dispose && !c.userData.sharedGeometry) c.geometry.dispose();
    if (c.material && !c.userData.sharedMaterial) (Array.isArray(c.material) ? c.material : [c.material]).forEach(disposeMaterial);
  });
}
function emptyGroup(g) {
  for (const c of g.children.slice()) { g.remove(c); disposeObject(c); }
}

// ---------- label textures (canvas) ----------
// kind: 'on' (text color picked from the atom color, no halo), 'halo' (ink text with paper halo), 'pill' (quiet boxed text),
// 'quiet' (accent text with paper halo, used for plane and arrow labels).
function createLabelRec(text, kind, themeRef, extra = {}) {
  const canvas = document.createElement('canvas');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const mat = new THREE.SpriteMaterial({
    map: tex, transparent: true, sizeAttenuation: false, depthWrite: false, depthTest: !!extra.depthTest,
  });
  const rec = { tex, mat, w: 10, h: 10, text, kind };
  const px = extra.px || 12;
  const weight = kind === 'pill' ? 600 : 650;
  function draw() {
    const th = themeRef();
    const ctx = canvas.getContext('2d');
    const S = TEXT_SCALE;
    ctx.font = `${weight} ${px * S}px ${FONT}`;
    const tw = ctx.measureText(text).width;
    const padX = (kind === 'pill' ? 7 : 4) * S;
    const padY = (kind === 'pill' ? 3.5 : 3) * S;
    const w = Math.ceil(tw + padX * 2);
    const h = Math.ceil(px * S * 1.2 + padY * 2);
    canvas.width = w;
    canvas.height = h;
    ctx.font = `${weight} ${px * S}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const cy = h / 2 + px * S * 0.04;
    if (kind === 'pill') {
      const r = 5 * S;
      ctx.fillStyle = hexA(th.paper, 0.9);
      ctx.strokeStyle = hexA(th.line, 1);
      ctx.lineWidth = 1 * S;
      ctx.beginPath();
      ctx.moveTo(r, S * 0.5); ctx.arcTo(w - S * 0.5, S * 0.5, w - S * 0.5, h - S * 0.5, r);
      ctx.arcTo(w - S * 0.5, h - S * 0.5, S * 0.5, h - S * 0.5, r); ctx.arcTo(S * 0.5, h - S * 0.5, S * 0.5, S * 0.5, r);
      ctx.arcTo(S * 0.5, S * 0.5, w - S * 0.5, S * 0.5, r); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = th.ink;
      ctx.fillText(text, w / 2, cy);
    } else if (kind === 'on') {
      const dark = extra.lum != null && extra.lum < 0.3;
      const fill = dark ? '#ffffff' : '#14171a';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.2 * S;
      ctx.strokeStyle = dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.65)';
      ctx.strokeText(text, w / 2, cy);
      ctx.fillStyle = fill;
      ctx.fillText(text, w / 2, cy);
    } else {
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3 * S;
      ctx.strokeStyle = hexA(th.paper, 0.92);
      ctx.strokeText(text, w / 2, cy);
      ctx.fillStyle = kind === 'quiet' ? (extra.color || th.accent) : th.ink;
      ctx.fillText(text, w / 2, cy);
    }
    rec.w = w / S;
    rec.h = h / S;
    tex.needsUpdate = true;
  }
  rec.draw = draw;
  rec.dispose = () => { tex.dispose(); mat.dispose(); };
  draw();
  return rec;
}

function hexA(css, a) {
  const c = new THREE.Color(css);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

// Camera-facing sprite that keeps a constant on-screen size (CSS px). `follow` pushes it from an atom center
// toward the camera so the atom's own surface (and nearer atoms) can hide it correctly.
function pxSprite(rec, follow) {
  const sprite = new THREE.Sprite(rec.mat);
  sprite.frustumCulled = false;
  sprite.userData.sharedMaterial = true;
  const size = new THREE.Vector2();
  const v = new THREE.Vector3();
  sprite.onBeforeRender = (renderer, scene, camera) => {
    renderer.getSize(size);
    if (!size.y || !camera.isPerspectiveCamera) return;
    const k = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / size.y;
    const sx = rec.w * k;
    const sy = rec.h * k;
    let dirty = Math.abs(sprite.scale.x - sx) > 1e-9 || Math.abs(sprite.scale.y - sy) > 1e-9;
    if (dirty) sprite.scale.set(sx, sy, 1);
    if (follow) {
      v.copy(camera.position).sub(follow.pos);
      const l = v.length() || 1;
      v.multiplyScalar(follow.off / l).add(follow.pos);
      if (!sprite.position.equals(v)) { sprite.position.copy(v); dirty = true; }
    }
    if (dirty) sprite.updateMatrixWorld(true);
  };
  return sprite;
}

// ---------- the viewer ----------
/**
 * Create a viewer on a stage from shared/scene.js.
 * @param {object} stage
 * @param {{style?:string}} [opts]
 */
export function createViewer(stage, opts = {}) {
  const THREE_ = THREE;
  const camera = stage.camera;
  camera.fov = FOV;
  camera.updateProjectionMatrix();

  let theme = readTheme();
  const themeRef = () => theme;
  let disposed = false;
  const disposers = [];

  const group = new THREE.Group();
  group.name = 'molecule-viewer';
  stage.scene.add(group);
  const gAtoms = new THREE.Group();
  const gRims = new THREE.Group();
  const gBonds = new THREE.Group();
  const gLabels = new THREE.Group();
  const gCell = new THREE.Group();
  const gPlanes = new THREE.Group();
  const gArrows = new THREE.Group();
  const gHalo = new THREE.Group();
  const gMeasure = new THREE.Group();
  group.add(gRims, gAtoms, gBonds, gCell, gPlanes, gHalo, gLabels, gArrows, gMeasure);

  const state = {
    structure: null,
    opts: {},
    style: STYLE_OPTIONS.some((s) => s.value === opts.style) ? opts.style : 'ball-stick',
    labels: false,
    spin: false,
  };

  // derived geometry data
  let atomPos = [];                 // THREE.Vector3 per atom (Å)
  let radii = new Float32Array(0);  // per atom, current style
  let visible = new Uint8Array(0);  // 0 when faded to nothing
  let S = 1;                        // structure size scale (Å), style independent
  let center = new THREE.Vector3();
  let frameRadius = 1;
  const atomMeshes = [];
  const rimMats = [];
  let bondMat = [];
  let sphereGeo = null;
  let rimGeo = null;
  let cylGeo = null;
  const haloGeo = new THREE.SphereGeometry(1, 20, 14);
  const dashGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);
  const arrowShaftGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false);
  const arrowHeadGeo = new THREE.ConeGeometry(1, 1, 16, 1, false);

  // overlay specs
  let cellSpec = null;
  let planeSpecs = [];
  let arrowSpecs = [];
  const hl = { indices: [], color: null };
  const ms = { indices: [] };
  const labelCache = new Map();

  // scratch objects (no per-instance allocation in the build loops)
  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpP = new THREE.Vector3();
  const tmpS = new THREE.Vector3();
  const tmpD = new THREE.Vector3();
  const tmpO = new THREE.Vector3();
  const tmpE = new THREE.Vector3();
  const tmpC = new THREE.Color();
  const Y = new THREE.Vector3(0, 1, 0);
  const IDQ = new THREE.Quaternion();

  const px = () => S / 134;   // Å per CSS pixel at the default zoom on a ~300 px high stage
  const bondK = () => clamp(Math.pow(S / 4, 0.7), 1, 2);

  function requestRender() { if (!disposed) stage.requestRender(); }

  // ---------- atoms and bonds ----------
  function opacityOf(i) {
    const f = state.opts.fade;
    const tag = state.structure.atoms[i].tag;
    if (!f || tag == null || f[tag] == null) return 1;
    return Math.round(clamp(f[tag], 0, 1) * 100) / 100;
  }

  function atomRadius(sym) {
    const e = elemInfo(sym);
    const sc = state.opts.radiusScale || 1;
    if (state.style === 'space-fill') {
      const mode = state.opts.spaceRadius;
      const base = mode === 'metallic' ? (e.met || e.cov) : mode === 'covalent' ? e.cov : e.vdw;
      return base * sc;
    }
    if (state.style === 'sticks') return 0.19 * bondK();
    return (0.1 + 0.34 * e.cov) * sc;
  }

  function clearBuilt() {
    atomMeshes.length = 0;
    rimMats.length = 0;
    bondMat = [];
    emptyGroup(gAtoms); emptyGroup(gRims); emptyGroup(gBonds); emptyGroup(gLabels);
    if (sphereGeo) { sphereGeo.dispose(); sphereGeo = null; }
    if (rimGeo) { rimGeo.dispose(); rimGeo = null; }
    if (cylGeo) { cylGeo.dispose(); cylGeo = null; }
  }

  function rebuild() {
    clearBuilt();
    const st = state.structure;
    if (!st || !st.atoms || !st.atoms.length) { drawHalos(); drawMeasure(); requestRender(); return; }
    const atoms = st.atoms;
    const n = atoms.length;
    const bonds = Array.isArray(st.bonds) ? st.bonds : [];
    const style = state.style;
    const byTag = state.opts.colorBy === 'tag';
    const tagColors = state.opts.tagColors || {};
    const rimT = clamp(px() * 2.2, 0.02, 0.25);

    // geometry detail by atom count
    const seg = n <= 150 ? 32 : n <= 800 ? 24 : 16;
    sphereGeo = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
    const rseg = n <= 800 ? 20 : 12;
    rimGeo = new THREE.SphereGeometry(1, rseg, Math.round(rseg * 0.7));

    radii = new Float32Array(n);
    visible = new Uint8Array(n);
    for (let i = 0; i < n; i++) radii[i] = atomRadius(atoms[i].el);

    // group atoms by element and opacity
    const groups = new Map();
    for (let i = 0; i < n; i++) {
      const op = opacityOf(i);
      if (op <= 0.01) continue;
      visible[i] = 1;
      const key = `${atoms[i].el}|${op}`;
      let g = groups.get(key);
      if (!g) { g = { el: atoms[i].el, op, idx: [] }; groups.set(key, g); }
      g.idx.push(i);
    }
    for (const g of groups.values()) {
      const info = elemInfo(g.el);
      const cnt = g.idx.length;
      const mat = new THREE.MeshStandardMaterial({
        color: byTag ? 0xffffff : info.color, roughness: 0.42, metalness: 0,
        transparent: g.op < 1, opacity: g.op, depthWrite: g.op >= 1,
      });
      const mesh = new THREE.InstancedMesh(sphereGeo, mat, cnt);
      mesh.userData.sharedGeometry = true;
      mesh.userData.indices = g.idx;
      mesh.frustumCulled = false;
      if (g.op < 1) mesh.renderOrder = 1;
      const rmat = new THREE.MeshBasicMaterial({
        color: theme.rim, side: THREE.BackSide, transparent: g.op < 1, opacity: g.op, depthWrite: g.op >= 1,
      });
      rimMats.push(rmat);
      const rim = new THREE.InstancedMesh(rimGeo, rmat, cnt);
      rim.userData.sharedGeometry = true;
      rim.frustumCulled = false;
      for (let k = 0; k < cnt; k++) {
        const i = g.idx[k];
        const p = atomPos[i];
        const r = radii[i];
        tmpM.makeScale(r, r, r).setPosition(p.x, p.y, p.z);
        mesh.setMatrixAt(k, tmpM);
        const rr = r + rimT;
        tmpM.makeScale(rr, rr, rr).setPosition(p.x, p.y, p.z);
        rim.setMatrixAt(k, tmpM);
        if (byTag) {
          const tc = atoms[i].tag != null ? tagColors[atoms[i].tag] : null;
          mesh.setColorAt(k, tmpC.set(tc || info.color));
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      rim.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      gAtoms.add(mesh);
      gRims.add(rim);
      atomMeshes.push(mesh);
    }

    if (style !== 'space-fill' && bonds.length) buildBonds(atoms, bonds, style);
    buildLabels();
    drawHalos();
    drawMeasure();
    requestRender();
  }

  // adjacency (only built when a multiple bond needs a plane)
  function buildAdj(n, bonds) {
    const adj = new Array(n);
    for (let i = 0; i < n; i++) adj[i] = [];
    for (const b of bonds) { adj[b.a].push(b.b); adj[b.b].push(b.a); }
    return adj;
  }

  // Unit vector (into `out`) perpendicular to bond a-b, lying in the local molecular plane when one exists.
  // Returns +1 when it points toward the neighbor used to define the plane (the ring side), else 0.
  function offsetDirection(a, b, adj, out) {
    const pa = atomPos[a];
    const pb = atomPos[b];
    tmpD.subVectors(pb, pa).normalize();
    for (const [o, other] of [[a, b], [b, a]]) {
      const cand = adj[o].filter((c) => c !== other).sort((x, y) => adj[y].length - adj[x].length);
      for (const c of cand) {
        tmpE.subVectors(atomPos[c], atomPos[o]);
        const len = tmpE.length();
        if (len < 1e-6) continue;
        tmpO.crossVectors(tmpD, tmpE);                     // plane normal
        if (tmpO.length() < 0.25 * len) continue;          // nearly collinear
        out.crossVectors(tmpO, tmpD).normalize();          // in-plane, perpendicular to the bond
        if (out.dot(tmpE) < 0) out.negate();
        return 1;
      }
    }
    const ref = Math.abs(tmpD.y) < 0.9 ? Y : tmpE.set(1, 0, 0);
    out.crossVectors(tmpD, ref).normalize();
    if (out.x + out.y * 1.1 + out.z * 1.3 < 0) out.negate();   // same sign for both directions of a collinear bond
    return 0;
  }

  function cylinderCount(order) { return order === 2 || order === 1.5 ? 2 : order === 3 ? 3 : 1; }

  function buildBonds(atoms, bonds, style) {
    const sticks = style === 'sticks';
    const k = bondK();
    const rs = sticks ? 1.3 : 1;
    const nb = bonds.length;
    cylGeo = new THREE.CylinderGeometry(1, 1, 1, nb > 1500 ? 8 : 12, 1, false);
    // pass 1: count cylinders per opacity group
    const counts = new Map();
    let needAdj = false;
    for (let j = 0; j < nb; j++) {
      const b = bonds[j];
      if (!visible[b.a] || !visible[b.b]) continue;
      const op = Math.min(opacityOf(b.a), opacityOf(b.b));
      const c = cylinderCount(b.order) * (sticks ? 2 : 1);
      counts.set(op, (counts.get(op) || 0) + c);
      if (b.order > 1) needAdj = true;
    }
    const adj = needAdj ? buildAdj(atoms.length, bonds) : null;
    const meshes = new Map();
    for (const [op, c] of counts) {
      const mat = new THREE.MeshStandardMaterial({
        color: sticks ? 0xffffff : theme.bond, roughness: 0.5, metalness: 0,
        transparent: op < 1, opacity: op, depthWrite: op >= 1,
      });
      bondMat.push(mat);
      const mesh = new THREE.InstancedMesh(cylGeo, mat, c);
      mesh.userData.sharedGeometry = true;
      mesh.frustumCulled = false;
      if (op < 1) mesh.renderOrder = 1;
      meshes.set(op, { mesh, i: 0 });
      gBonds.add(mesh);
    }
    const off = new THREE.Vector3();
    const emit = (rec, ax, ay, az, bx, by, bz, rad, col) => {
      const dx = bx - ax; const dy = by - ay; const dz = bz - az;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-6) return;
      tmpQ.setFromUnitVectors(Y, tmpD.set(dx / len, dy / len, dz / len));
      tmpM.compose(tmpP.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), tmpQ, tmpS.set(rad, len, rad));
      rec.mesh.setMatrixAt(rec.i, tmpM);
      if (col) rec.mesh.setColorAt(rec.i, col);
      rec.i++;
    };
    // a cylinder from A to B shifted by `o` along `off`; in sticks style it is split into two colored halves
    const line = (rec, pa, pb, o, rad, ca, cb) => {
      const ax = pa.x + off.x * o; const ay = pa.y + off.y * o; const az = pa.z + off.z * o;
      const bx = pb.x + off.x * o; const by = pb.y + off.y * o; const bz = pb.z + off.z * o;
      if (sticks) {
        const mx = (ax + bx) / 2; const my = (ay + by) / 2; const mz = (az + bz) / 2;
        emit(rec, ax, ay, az, mx, my, mz, rad, ca);
        emit(rec, mx, my, mz, bx, by, bz, rad, cb);
      } else emit(rec, ax, ay, az, bx, by, bz, rad, null);
    };
    const colA = new THREE.Color();
    const colB = new THREE.Color();
    for (let j = 0; j < nb; j++) {
      const b = bonds[j];
      if (!visible[b.a] || !visible[b.b]) continue;
      const rec = meshes.get(Math.min(opacityOf(b.a), opacityOf(b.b)));
      const pa = atomPos[b.a];
      const pb = atomPos[b.b];
      if (sticks) { colA.set(elemInfo(atoms[b.a].el).color); colB.set(elemInfo(atoms[b.b].el).color); }
      const order = b.order;
      if (order === 2 || order === 3 || order === 1.5) offsetDirection(b.a, b.b, adj, off);
      if (order === 2) {
        const o = 0.082 * rs * k; const r = 0.058 * rs * k;
        line(rec, pa, pb, o, r, colA, colB); line(rec, pa, pb, -o, r, colA, colB);
      } else if (order === 3) {
        const o = 0.125 * rs * k; const r = 0.05 * rs * k;
        line(rec, pa, pb, 0, r, colA, colB); line(rec, pa, pb, o, r, colA, colB); line(rec, pa, pb, -o, r, colA, colB);
      } else if (order === 1.5) {
        line(rec, pa, pb, -0.05 * rs * k, 0.068 * rs * k, colA, colB);
        line(rec, pa, pb, 0.085 * rs * k, 0.04 * rs * k, colA, colB);
      } else {
        off.set(0, 0, 0);
        line(rec, pa, pb, 0, 0.1 * rs * k, colA, colB);
      }
    }
    for (const rec of meshes.values()) {
      rec.mesh.count = rec.i;
      rec.mesh.instanceMatrix.needsUpdate = true;
      if (rec.mesh.instanceColor) rec.mesh.instanceColor.needsUpdate = true;
    }
  }

  // ---------- element labels ----------
  function labelRec(sym, kind, lum) {
    const key = `${sym}|${kind}`;
    let r = labelCache.get(key);
    if (!r) {
      r = createLabelRec(sym, kind, themeRef, { depthTest: true, lum, px: 12 });
      labelCache.set(key, r);
    }
    return r;
  }
  function buildLabels() {
    emptyGroup(gLabels);
    const st = state.structure;
    if (!st || !state.labels || st.atoms.length > LABEL_MAX_ATOMS) return;
    const kind = state.style === 'sticks' ? 'halo' : 'on';
    for (let i = 0; i < st.atoms.length; i++) {
      if (!visible[i] || opacityOf(i) < 0.4) continue;
      const a = st.atoms[i];
      const rec = labelRec(a.el, kind, elemInfo(a.el).lum);
      const rimT = clamp(px() * 2.2, 0.02, 0.25);
      const sprite = pxSprite(rec, { pos: atomPos[i], off: radii[i] + rimT + 0.01 * S });
      sprite.position.copy(atomPos[i]);
      sprite.renderOrder = 10;
      gLabels.add(sprite);
    }
  }

  // ---------- cell, planes, arrows ----------
  function drawCell() {
    emptyGroup(gCell);
    if (!cellSpec) { requestRender(); return; }
    const o = new THREE.Vector3(...cellSpec.origin);
    const a = new THREE.Vector3(...cellSpec.a);
    const b = new THREE.Vector3(...cellSpec.b);
    const c = new THREE.Vector3(...cellSpec.c);
    const corner = (i, j, k) => o.clone().addScaledVector(a, i).addScaledVector(b, j).addScaledVector(c, k);
    const P = [];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) P.push(corner(i, j, k));
    // corner index = i*4 + j*2 + k; edges join corners that differ in one bit
    const pts = [];
    for (let m = 0; m < 8; m++) for (const bit of [1, 2, 4]) if (!(m & bit)) { pts.push(P[m], P[m | bit]); }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: theme.ink2, transparent: true, opacity: theme.dark ? 0.85 : 0.8, depthWrite: false });
    const lines = new THREE.LineSegments(geo, mat);
    lines.frustumCulled = false;
    lines.renderOrder = 3;
    gCell.add(lines);
    requestRender();
  }

  function orderPolygon(points) {
    const P = points.map((p) => new THREE.Vector3(...p));
    const c = new THREE.Vector3();
    P.forEach((p) => c.add(p));
    c.multiplyScalar(1 / P.length);
    // robust normal: largest cross product among the first few points
    let best = new THREE.Vector3();
    const m = Math.min(P.length, 8);
    for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) {
      const n = new THREE.Vector3().crossVectors(P[i].clone().sub(c), P[j].clone().sub(c));
      if (n.length() > best.length()) best = n;
    }
    if (best.length() < 1e-9) return { P, c };
    best.normalize();
    const u = P[0].clone().sub(c).normalize();
    const w = new THREE.Vector3().crossVectors(best, u);
    const ang = (p) => Math.atan2(p.clone().sub(c).dot(w), p.clone().sub(c).dot(u));
    P.sort((p, q) => ang(p) - ang(q));
    return { P, c };
  }

  function drawPlanes() {
    emptyGroup(gPlanes);
    for (const spec of planeSpecs) {
      if (!spec || !spec.points || spec.points.length < 3) continue;
      const { P, c } = orderPolygon(spec.points);
      const col = spec.color || theme.accent;
      const pos = [c.x, c.y, c.z];
      P.forEach((p) => pos.push(p.x, p.y, p.z));
      const idx = [];
      const m = P.length;
      for (let i = 0; i < m; i++) idx.push(0, 1 + i, 1 + ((i + 1) % m));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 4;
      mesh.frustumCulled = false;
      gPlanes.add(mesh);
      const lg = new THREE.BufferGeometry().setFromPoints(P);
      const loop = new THREE.LineLoop(lg, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false }));
      loop.renderOrder = 5;
      loop.frustumCulled = false;
      gPlanes.add(loop);
      if (spec.label) {
        const rec = createLabelRec(String(spec.label), 'quiet', themeRef, { px: 12, color: col, depthTest: false });
        const s = pxSprite(rec, null);
        s.userData.sharedMaterial = false;
        s.userData.ownRec = rec;
        s.position.copy(c);
        s.renderOrder = 30;
        gPlanes.add(s);
      }
    }
    requestRender();
  }

  function drawArrows() {
    emptyGroup(gArrows);
    for (const spec of arrowSpecs) {
      if (!spec || !spec.from || !spec.to) continue;
      const col = spec.color || theme.accent;
      const from = new THREE.Vector3(...spec.from);
      const to = new THREE.Vector3(...spec.to);
      const dir = to.clone().sub(from);
      const L = dir.length();
      if (L < 1e-6) continue;
      dir.multiplyScalar(1 / L);
      const headLen = Math.min(px() * 17, L * 0.45);
      const headR = px() * 6.5;
      const shaftR = px() * 2.1;
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false });
      const shaft = new THREE.Mesh(arrowShaftGeo, mat);
      shaft.userData.sharedGeometry = true;
      const shaftLen = L - headLen;
      shaft.scale.set(shaftR, shaftLen, shaftR);
      shaft.position.copy(from).addScaledVector(dir, shaftLen / 2);
      shaft.quaternion.setFromUnitVectors(Y, dir);
      shaft.renderOrder = 25;
      const head = new THREE.Mesh(arrowHeadGeo, mat);
      head.userData.sharedGeometry = true;
      head.userData.sharedMaterial = true;
      head.scale.set(headR, headLen, headR);
      head.position.copy(from).addScaledVector(dir, shaftLen + headLen / 2);
      head.quaternion.setFromUnitVectors(Y, dir);
      head.renderOrder = 25;
      gArrows.add(shaft, head);
      if (spec.label) {
        const rec = createLabelRec(String(spec.label), 'quiet', themeRef, { px: 12, color: col, depthTest: false });
        const s = pxSprite(rec, null);
        s.userData.sharedMaterial = false;
        s.position.copy(to).addScaledVector(dir, px() * 14);
        s.renderOrder = 30;
        gArrows.add(s);
      }
    }
    requestRender();
  }

  // ---------- halos (highlight and measure marks) ----------
  const haloGroups = { hl: new THREE.Group(), ms: new THREE.Group() };
  gHalo.add(haloGroups.hl, haloGroups.ms);

  function drawHalo(owner, indices, color) {
    const g = haloGroups[owner];
    emptyGroup(g);
    if (!indices.length || !state.structure) return;
    const list = indices.filter((i) => i >= 0 && i < atomPos.length && visible[i]);
    if (!list.length) return;
    const t = clamp(px() * 4.5, 0.05, 0.6);
    const shell = new THREE.InstancedMesh(haloGeo, new THREE.MeshBasicMaterial({
      color, side: THREE.BackSide, transparent: true, opacity: owner === 'ms' ? 0.95 : 0.9, depthWrite: false,
    }), list.length);
    const fill = new THREE.InstancedMesh(haloGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.2, depthWrite: false,
    }), list.length);
    for (const m of [shell, fill]) { m.userData.sharedGeometry = true; m.frustumCulled = false; m.renderOrder = 6; }
    const extra = owner === 'ms' ? 0 : t * 0.0;
    list.forEach((i, k) => {
      const r = radii[i] + (owner === 'ms' ? t * 0.8 : t * 1.4) + extra;
      const p = atomPos[i];
      tmpM.makeScale(r, r, r).setPosition(p.x, p.y, p.z);
      shell.setMatrixAt(k, tmpM);
      fill.setMatrixAt(k, tmpM);
    });
    shell.instanceMatrix.needsUpdate = true;
    fill.instanceMatrix.needsUpdate = true;
    g.add(shell, fill);
  }
  function drawHalos() {
    drawHalo('hl', hl.indices, hl.color || theme.hot);
    drawHalo('ms', ms.indices, theme.accent);
    requestRender();
  }

  // ---------- measure ----------
  function measureResult() {
    const idx = ms.indices.slice();
    if (idx.length === 2) {
      return { type: 'distance', value: atomPos[idx[0]].distanceTo(atomPos[idx[1]]), indices: idx };
    }
    if (idx.length === 3) {
      const u = atomPos[idx[0]].clone().sub(atomPos[idx[1]]).normalize();
      const v = atomPos[idx[2]].clone().sub(atomPos[idx[1]]).normalize();
      return { type: 'angle', value: THREE.MathUtils.radToDeg(Math.acos(clamp(u.dot(v), -1, 1))), indices: idx };
    }
    return { type: 'none', value: null, indices: idx };
  }

  function addDashes(a, b) {
    const len = a.distanceTo(b);
    if (len < 1e-6) return;
    const dash = px() * 7;
    const gap = px() * 5;
    const rad = Math.max(0.012, px() * 1.5);
    const dir = b.clone().sub(a).normalize();
    const n = clamp(Math.round(len / (dash + gap)), 1, 120);
    const pitch = len / n;
    const dl = Math.min(dash, pitch * 0.62);
    const mesh = new THREE.InstancedMesh(dashGeo, new THREE.MeshBasicMaterial({
      color: theme.accent, transparent: true, depthTest: false, depthWrite: false,
    }), n);
    mesh.userData.sharedGeometry = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = 28;
    const q = new THREE.Quaternion().setFromUnitVectors(Y, dir);
    for (let i = 0; i < n; i++) {
      const p = a.clone().addScaledVector(dir, pitch * (i + 0.5));
      tmpM.compose(p, q, new THREE.Vector3(rad, dl, rad));
      mesh.setMatrixAt(i, tmpM);
    }
    mesh.instanceMatrix.needsUpdate = true;
    gMeasure.add(mesh);
  }

  function addPill(text, pos) {
    const rec = createLabelRec(text, 'pill', themeRef, { px: 12, depthTest: false });
    const s = pxSprite(rec, null);
    s.userData.sharedMaterial = false;
    s.center.set(0.5, -0.25);
    s.position.copy(pos);
    s.renderOrder = 40;
    gMeasure.add(s);
  }

  function drawMeasure() {
    emptyGroup(gMeasure);
    drawHalo('ms', ms.indices, theme.accent);
    const res = state.structure ? measureResult() : { type: 'none' };
    if (res.type === 'distance') {
      const a = atomPos[res.indices[0]];
      const b = atomPos[res.indices[1]];
      addDashes(a, b);
      addPill(`${res.value.toFixed(2)} Å`, a.clone().add(b).multiplyScalar(0.5));
    } else if (res.type === 'angle') {
      const [i0, i1, i2] = res.indices;
      const a = atomPos[i0]; const m = atomPos[i1]; const c = atomPos[i2];
      addDashes(a, m);
      addDashes(m, c);
      const u = a.clone().sub(m); const v = c.clone().sub(m);
      const lu = u.length(); const lv = v.length();
      u.normalize(); v.normalize();
      const theta = THREE.MathUtils.degToRad(res.value);
      let axis = new THREE.Vector3().crossVectors(u, v);
      if (axis.length() < 1e-6) {
        axis = new THREE.Vector3().crossVectors(u, Math.abs(u.y) < 0.9 ? Y : new THREE.Vector3(1, 0, 0));
      }
      axis.normalize();
      const w = new THREE.Vector3().crossVectors(axis, u);
      const ra = clamp(radii[i1] * 1.45 + px() * 4, 0.1, Math.max(0.1, 0.75 * Math.min(lu, lv)));
      const pts = [];
      const N = 28;
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * theta;
        pts.push(m.clone().addScaledVector(u, Math.cos(t) * ra).addScaledVector(w, Math.sin(t) * ra));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 32, Math.max(0.012, px() * 1.5), 6, false),
        new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, depthTest: false, depthWrite: false }),
      );
      tube.renderOrder = 28;
      tube.frustumCulled = false;
      gMeasure.add(tube);
      const mid = m.clone().addScaledVector(u, Math.cos(theta / 2) * (ra + px() * 6)).addScaledVector(w, Math.sin(theta / 2) * (ra + px() * 6));
      addPill(`${res.value.toFixed(1)}°`, mid);
    }
    requestRender();
  }

  const measure = {
    add(index) {
      if (!state.structure || !(index >= 0 && index < atomPos.length)) return measureResult();
      if (ms.indices.length >= 3) ms.indices = [];
      if (ms.indices[ms.indices.length - 1] !== index) ms.indices.push(index);
      drawMeasure();
      return measureResult();
    },
    clear() { ms.indices = []; if (state.structure || gMeasure.children.length) drawMeasure(); },
    get() { return state.structure ? measureResult() : { type: 'none', value: null, indices: [] }; },
  };

  // ---------- bounds ----------
  function computeBounds() {
    const atoms = state.structure ? state.structure.atoms : [];
    const box = new THREE.Box3();
    atomPos.forEach((p) => box.expandByPoint(p));
    const cell = state.structure && state.structure.cell;
    const cellPts = [];
    if (cell && cell.a && cell.b && cell.c) {
      const o = cell.origin || [0, 0, 0];
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
        cellPts.push(new THREE.Vector3(o[0] + i * cell.a[0] + j * cell.b[0] + k * cell.c[0], o[1] + i * cell.a[1] + j * cell.b[1] + k * cell.c[1], o[2] + i * cell.a[2] + j * cell.b[2] + k * cell.c[2]));
      }
    }
    cellPts.forEach((p) => box.expandByPoint(p));
    if (box.isEmpty()) { center.set(0, 0, 0); S = 1; frameRadius = 1; return; }
    box.getCenter(center);
    let rc = 0;
    atomPos.forEach((p) => { rc = Math.max(rc, p.distanceTo(center)); });
    cellPts.forEach((p) => { rc = Math.max(rc, p.distanceTo(center)); });
    S = Math.max(1.2, rc + 0.6);
    let rf = 0;
    atoms.forEach((a, i) => { rf = Math.max(rf, atomPos[i].distanceTo(center) + atomRadius(a.el)); });
    cellPts.forEach((p) => { rf = Math.max(rf, p.distanceTo(center)); });
    frameRadius = Math.max(0.5, rf);
  }

  // ---------- public API ----------
  function setStructure(structure, o = {}) {
    const same = structure === state.structure;
    state.structure = structure || null;
    state.opts = { ...o };
    const atoms = structure && structure.atoms ? structure.atoms : [];
    atomPos = atoms.map((a) => new THREE.Vector3(a.pos[0], a.pos[1], a.pos[2]));
    computeBounds();
    if (!same) {
      ms.indices = [];
      hl.indices = [];
    }
    rebuild();
  }

  function setStyle(style) {
    if (!STYLE_OPTIONS.some((s) => s.value === style) || style === state.style) return;
    state.style = style;
    if (state.structure) rebuild();
    else requestRender();
  }

  function setFade(fade) {
    state.opts = { ...state.opts, fade };
    if (state.structure) rebuild();
  }

  function setLabels(on) {
    on = !!on;
    if (on === state.labels) return;
    state.labels = on;
    buildLabels();
    requestRender();
  }

  function setCell(cell) {
    cellSpec = cell && cell.a && cell.b && cell.c ? { origin: cell.origin || [0, 0, 0], a: cell.a, b: cell.b, c: cell.c } : null;
    drawCell();
  }
  function setPlanes(planes) { planeSpecs = Array.isArray(planes) ? planes.slice() : []; drawPlanes(); }
  function setArrows(arrows) { arrowSpecs = Array.isArray(arrows) ? arrows.slice() : []; drawArrows(); }

  function highlight(indices, o = {}) {
    hl.indices = Array.isArray(indices) ? indices.slice() : [];
    hl.color = o.color || null;
    drawHalo('hl', hl.indices, hl.color || theme.hot);
    requestRender();
  }
  function clearHighlight() {
    if (!hl.indices.length) return;
    hl.indices = [];
    drawHalo('hl', [], null);
    requestRender();
  }

  const rayRect = () => (stage.renderer ? stage.renderer.domElement.getBoundingClientRect() : null);
  const proj = new THREE.Vector3();
  function screenOf(i) {
    const r = rayRect();
    if (!r || !r.width) return null;
    proj.copy(atomPos[i]).applyMatrix4(group.matrixWorld).project(camera);
    return { x: r.left + ((proj.x + 1) / 2) * r.width, y: r.top + ((1 - proj.y) / 2) * r.height, z: proj.z };
  }

  function pickAtom(clientX, clientY) {
    if (!state.structure || !atomMeshes.length) return null;
    const hit = stage.pick(clientX, clientY, atomMeshes);
    if (hit && hit.instanceId != null && hit.object.userData.indices) {
      const index = hit.object.userData.indices[hit.instanceId];
      return { index, atom: state.structure.atoms[index] };
    }
    // The ray missed: take the nearest atom center within a finger-sized distance (helps with thin sticks).
    if (!stage.renderer) return null;
    let best = -1; let bd = TAP_PICK_PX; let bz = Infinity;
    for (let i = 0; i < atomPos.length; i++) {
      if (!visible[i]) continue;
      const s = screenOf(i);
      if (!s) return null;
      const d = Math.hypot(s.x - clientX, s.y - clientY);
      if (d < bd || (d < TAP_PICK_PX && Math.abs(d - bd) < 1.5 && s.z < bz)) { bd = d; best = i; bz = s.z; }
    }
    return best >= 0 ? { index: best, atom: state.structure.atoms[best] } : null;
  }

  function frame(o = {}) {
    if (!state.structure || !stage.supported) return;
    const h = frameRadius / Math.sqrt(3);
    const box = new THREE.Box3(
      new THREE.Vector3(center.x - h, center.y - h, center.z - h),
      new THREE.Vector3(center.x + h, center.y + h, center.z + h),
    );
    camera.fov = FOV;
    camera.updateProjectionMatrix();
    stage.frame(box, { dir: o.dir || [0.55, 0.38, 1], padding: o.padding || 1.12 });
  }

  let unSpin = null;
  function setSpin(on) {
    on = !!on && !reducedMotion();
    state.spin = on;
    if (on && !unSpin && stage.controls) {
      const Yaxis = new THREE.Vector3(0, 1, 0);
      const off = new THREE.Vector3();
      unSpin = stage.onFrame((dt) => {
        const t = stage.controls.target;
        off.copy(camera.position).sub(t).applyAxisAngle(Yaxis, SPIN_RATE * dt);
        camera.position.copy(t).add(off);
      });
    } else if (!on && unSpin) {
      unSpin(); unSpin = null;
      requestRender();
    }
  }

  // ---------- theme ----------
  const offTheme = stage.onTheme(() => {
    theme = readTheme();
    for (const m of rimMats) m.color.set(theme.rim);
    for (const m of bondMat) if (state.style !== 'sticks') m.color.set(theme.bond);
    for (const r of labelCache.values()) r.draw();
    drawCell(); drawPlanes(); drawArrows(); drawHalos(); drawMeasure();
    requestRender();
  });
  disposers.push(offTheme);

  function dispose() {
    if (disposed) return;
    setSpin(false);
    disposed = true;
    disposers.splice(0).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    clearBuilt();
    for (const g of [gCell, gPlanes, gArrows, gHalo, gMeasure]) emptyGroup(g);
    for (const g of Object.values(haloGroups)) emptyGroup(g);
    labelCache.forEach((r) => r.dispose());
    labelCache.clear();
    haloGeo.dispose(); dashGeo.dispose(); arrowShaftGeo.dispose(); arrowHeadGeo.dispose();
    stage.scene.remove(group);
    atomPos = [];
  }

  return {
    group,
    setStructure,
    setStyle,
    setFade,
    setLabels,
    setCell,
    setPlanes,
    setArrows,
    highlight,
    clearHighlight,
    pickAtom,
    measure,
    frame,
    setSpin,
    boundingRadius: () => frameRadius,
    dispose,
    // read-only state for controls and tests
    get style() { return state.style; },
    get labels() { return state.labels; },
    get spinning() { return !!unSpin; },
    _onDispose(fn) { disposers.push(fn); },
    _project(index) { const s = screenOf(index); return s ? { x: s.x, y: s.y } : null; },
    _stats() {
      let atomsDrawn = 0; let bondInst = 0;
      atomMeshes.forEach((m) => { atomsDrawn += m.count; });
      gBonds.children.forEach((m) => { bondInst += m.count; });
      return { atoms: atomPos.length, atomsDrawn, bondInstances: bondInst, meshes: atomMeshes.length + gBonds.children.length, S, frameRadius, labels: gLabels.children.length };
    },
  };
}

// ---------- controls ----------
/**
 * Compact "View" section bound to store.view: Style, Labels, Spin, Clear measure, Reset view.
 * Changes are applied to the viewer here and written to store.view. The element has .dispose().
 * @param {{get:()=>any, set:(p:any)=>void, subscribe:(fn:any)=>(()=>void)}} store
 * @param {ReturnType<typeof createViewer>} viewer
 * @returns {HTMLElement}
 */
export function viewControls(store, viewer) {
  const cur = () => store.get().view || {};
  const setView = (patch) => store.set({ view: { ...cur(), ...patch } });
  const v0 = cur();

  const style = segmented({
    label: 'Style', options: STYLE_OPTIONS, value: v0.style || 'ball-stick',
    onChange: (val) => { viewer.setStyle(val); setView({ style: val }); },
  });
  const labels = toggle({
    label: 'Labels', value: !!v0.labels,
    onChange: (val) => { viewer.setLabels(val); setView({ labels: val }); },
  });
  const spin = toggle({
    label: 'Spin', value: !!v0.spin && !reducedMotion(),
    onChange: (val) => { viewer.setSpin(val); setView({ spin: val }); },
  });
  if (reducedMotion()) { spin.el.disabled = true; spin.el.title = 'Spin is off because the device asks for less motion.'; spin.set(false); }
  const clear = button({ label: 'Clear measure', onClick: () => { viewer.measure.clear(); viewer.clearHighlight(); } });
  const reset = button({ label: 'Reset view', onClick: () => viewer.frame() });

  viewer.setStyle(style.get());
  viewer.setLabels(labels.get());
  viewer.setSpin(spin.get());

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px 16px';
  grid.append(labels.el, spin.el);
  const btns = document.createElement('div');
  btns.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px';
  btns.append(clear, reset);

  const root = section('View', style.el, grid, btns);
  const unsub = store.subscribe((s) => {
    const vw = s.view || {};
    if (vw.style && vw.style !== style.get()) { style.set(vw.style); viewer.setStyle(vw.style); }
    if (vw.labels != null && !!vw.labels !== labels.get()) { labels.set(vw.labels); viewer.setLabels(vw.labels); }
    const wantSpin = !!vw.spin && !reducedMotion();
    if (wantSpin !== spin.get()) { spin.set(wantSpin); viewer.setSpin(wantSpin); }
  });
  viewer._onDispose(unsub);
  root.dispose = unsub;
  return root;
}
