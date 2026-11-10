// envelope/assembly-3d.js  3D peel-back wall mock-up for the Assembly mode, with realistic materials and named layers.
// 1 unit = 1 inch. x along the wall, y up, z through the wall (interior face at z = 0, exterior toward the camera).
// Every layer is a full-height, full-width sheet at its true depth; each layer toward the exterior is cut back by the same step
// (a clean diagonal staircase), so the cladding is the smallest piece at the lower left and every layer shows in turn.
// Rebuild meshes only when the wall structure changes; colors, dew plane and
// condensation marker update cheaply through update().
//
// Materials view: PBR looks from material-look.js, real thickness detail (puffy batts, eased studs, C-shaped steel
// studs, lap siding boards, lapped housewrap), soft sunlight with shadows, image based fill light.
// Temperature and Control views: flat data colors (exactly on the tempToColor scale, no tone mapping) shaded only
// by shadow and facing so the layers still read as objects.

import * as THREE from 'three';
import { MATERIALS } from './materials.js';
import { tempToColor } from '../shared/scene.js';
import { createCallout, createSideMarker, pickCallout, layoutCallouts, worldToClient } from './labels3d.js';
import { getLook } from './material-look.js';
import { LineSegments2 } from '../vendor/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from '../vendor/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from '../vendor/addons/lines/LineMaterial.js';
import { RoomEnvironment } from '../vendor/addons/RoomEnvironment.js';

const MIN_T = 0.2; // drawn minimum thickness for very thin layers (the housewrap is exaggerated on purpose)

export const CONTROL_COLORS = {
  water: '#2f7de1', air: '#14b8a6', airspace: '#14b8a6', vapor: '#8e44ad',
  thermal: '#f08a24', structure: '#6e6a62', finish: '#b9b4a8', cladding: '#948f84',
};
export const CONTROL_LEGEND = [
  { color: CONTROL_COLORS.water, label: 'Water' },
  { color: CONTROL_COLORS.air, label: 'Air' },
  { color: CONTROL_COLORS.vapor, label: 'Vapor' },
  { color: CONTROL_COLORS.thermal, label: 'Thermal' },
  { color: CONTROL_COLORS.structure, label: 'Structure' },
  { color: CONTROL_COLORS.finish, label: 'Finish' },
  { color: CONTROL_COLORS.cladding, label: 'Cladding' },
];

// data views: lit/albedo ratio at (or above) which a face shows its exact data color, and the darkest shade
const DATA_REF = 0.34;
const DATA_MIN = 0.58;

// ---------------------------------------------------------------------------------------------- geometry helpers
const FACES = [
  { tu: [0, 1, 0], tv: [0, 0, 1], n: [1, 0, 0] }, // +x
  { tu: [0, 0, 1], tv: [0, 1, 0], n: [-1, 0, 0] }, // -x
  { tu: [0, 0, 1], tv: [1, 0, 0], n: [0, 1, 0] }, // +y
  { tu: [1, 0, 0], tv: [0, 0, 1], n: [0, -1, 0] }, // -y
  { tu: [1, 0, 0], tv: [0, 1, 0], n: [0, 0, 1] }, // +z
  { tu: [0, 1, 0], tv: [1, 0, 0], n: [0, 0, -1] }, // -z
];

function puffAt(u, v) {
  const b = Math.pow(Math.sin(Math.PI * u), 0.55) * Math.pow(Math.sin(Math.PI * v), 0.55);
  const n = 0.78 + 0.22 * Math.sin(u * 11 + 1.3) * Math.cos(v * 7.3 + 0.4) + 0.1 * Math.sin(u * 5.3 + v * 9.1);
  return b * n;
}

/**
 * Box centered at `at` with uv in inches (measured from world coordinates, so neighbours line up).
 * o.mat: material index per face [+x,-x,+y,-y,+z,-z] (groups are merged), o.grain: 'y' (default) or 'x',
 * o.uv0: [du, dv] offset, o.seg: [n, m] segments on the +/-z faces, o.puff: { pz, nz } bulge amplitudes in inches.
 */
function boxGeo(sx, sy, sz, at, o = {}) {
  const size = [sx, sy, sz];
  const pos = []; const uv = []; const idx = []; const groups = [];
  const matOf = (f) => (o.mat ? o.mat[f] : 0);
  const order = [0, 1, 2, 3, 4, 5].sort((a, b) => matOf(a) - matOf(b) || a - b);
  const [du, dv] = o.uv0 || [0, 0];
  const grainX = o.grain === 'x';
  let vbase = 0;
  let gstart = 0;
  let gmat = null;
  order.forEach((fi) => {
    const F = FACES[fi];
    const lenU = Math.abs(F.tu[0] * sx + F.tu[1] * sy + F.tu[2] * sz);
    const lenV = Math.abs(F.tv[0] * sx + F.tv[1] * sy + F.tv[2] * sz);
    const ni = fi >= 4 && o.seg ? o.seg[0] : 1;
    const nj = fi >= 4 && o.seg ? o.seg[1] : 1;
    const half = [F.n[0] * sx / 2, F.n[1] * sy / 2, F.n[2] * sz / 2];
    for (let j = 0; j <= nj; j += 1) {
      for (let i = 0; i <= ni; i += 1) {
        const a = (i / ni - 0.5) * lenU; const b = (j / nj - 0.5) * lenV;
        const p = [
          half[0] + F.tu[0] * a + F.tv[0] * b,
          half[1] + F.tu[1] * a + F.tv[1] * b,
          half[2] + F.tu[2] * a + F.tv[2] * b,
        ];
        if (o.puff) {
          if (fi === 4 && o.puff.pz) p[2] += o.puff.pz * puffAt(i / ni, j / nj);
          if (fi === 5 && o.puff.nz) p[2] -= o.puff.nz * puffAt(i / ni, j / nj);
        }
        const wx = p[0] + at[0]; const wy = p[1] + at[1]; const wz = p[2] + at[2];
        pos.push(wx, wy, wz);
        let u; let v;
        if (fi < 2) { u = wz; v = wy; } else if (fi < 4) { if (grainX) { u = wz; v = wx; } else { u = wx; v = wz; } } else if (grainX) { u = wy; v = wx; } else { u = wx; v = wy; }
        uv.push(u + du, v + dv);
      }
    }
    for (let j = 0; j < nj; j += 1) {
      for (let i = 0; i < ni; i += 1) {
        const a = vbase + j * (ni + 1) + i; const b = a + 1; const c = b + ni + 1; const d = a + ni + 1;
        idx.push(a, b, c, a, c, d);
      }
    }
    vbase += (ni + 1) * (nj + 1);
    const cnt = ni * nj * 6;
    const m = matOf(fi);
    if (groups.length && gmat === m) groups[groups.length - 1].count += cnt;
    else { groups.push({ start: gstart, count: cnt, m }); gmat = m; }
    gstart += cnt;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  groups.forEach((g) => geo.addGroup(g.start, g.count, g.m));
  geo.computeVertexNormals();
  return geo;
}

/** Extrude a Shape along +z from 0 to `len` with eased edges. uv comes out in inches. Groups: 0 = ends, 1 = sides. */
function extr(shape, len, bevel = 0) {
  const bt = Math.min(bevel, len / 3);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: len - 2 * bt, bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 2, curveSegments: 10, steps: 1,
  });
  geo.translate(0, 0, bt);
  return geo;
}
const rectShape = (x0, y0, x1, y1) => {
  const s = new THREE.Shape();
  s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.closePath();
  return s;
};
function polyShape(pts) {
  const s = new THREE.Shape();
  pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
  s.closePath();
  return s;
}
function shiftUV(geo, du, dv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv);
  return geo;
}
function mergeGeos(list) {
  const pos = []; const nor = []; const uv = [];
  list.forEach((g0) => {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    uv.push(...g.attributes.uv.array);
    if (g !== g0) g.dispose();
    g0.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

/** Prism with a polygon profile in (y, z), spanning x0..x1. Flat shaded, uv in inches. */
function prismGeo(profile, x0, x1, uv0 = [0, 0]) {
  const pos = []; const uv = []; const nor = [];
  const n = profile.length;
  const cx = (x0 + x1) / 2;
  let cy = 0; let cz = 0;
  profile.forEach((p) => { cy += p[0] / n; cz += p[1] / n; });
  let run = 0;
  for (let k = 0; k < n; k += 1) {
    const a = profile[k]; const b = profile[(k + 1) % n];
    const ey = b[0] - a[0]; const ez = b[1] - a[1];
    const len = Math.hypot(ey, ez) || 1;
    let ny = ez / len; let nz = -ey / len; // perpendicular, flipped to point away from the centroid
    if (ny * (a[0] - cy) + nz * (a[1] - cz) < 0) { ny = -ny; nz = -nz; }
    // the quad (x0,a) (x1,a) (x1,b) (x0,b); wind it so the normal is (0, ny, nz)
    const q = [[x0, a[0], a[1], 0, run], [x1, a[0], a[1], x1 - x0, run], [x1, b[0], b[1], x1 - x0, run + len], [x0, b[0], b[1], 0, run + len]];
    const e1 = [q[1][0] - q[0][0], 0, 0]; const e2 = [0, q[3][1] - q[0][1], q[3][2] - q[0][2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const flip = cr[1] * ny + cr[2] * nz < 0;
    const tri = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
    tri.forEach((t) => {
      pos.push(q[t][0], q[t][1], q[t][2]); nor.push(0, ny, nz);
      uv.push(q[t][0] + uv0[0], (a[0] === b[0] ? q[t][2] : q[t][4]) + uv0[1]);
    });
    run += len;
  }
  // end caps (fan around the first vertex)
  [[x0, -1], [x1, 1]].forEach(([x, sx]) => {
    for (let k = 1; k < n - 1; k += 1) {
      const tri = sx > 0 ? [0, k, k + 1] : [0, k + 1, k];
      tri.forEach((t) => { pos.push(x, profile[t][0], profile[t][1]); nor.push(sx, 0, 0); uv.push(profile[t][1], profile[t][0]); });
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// ---------------------------------------------------------------------------------------------- shared small textures
function makeBumpNoise() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const s = document.createElement('canvas');
  s.width = s.height = 24;
  const sg = s.getContext('2d');
  for (let y = 0; y < 24; y += 1) for (let x = 0; x < 24; x += 1) { const v = Math.floor(Math.random() * 256); sg.fillStyle = `rgb(${v},${v},${v})`; sg.fillRect(x, y, 1, 1); }
  g.imageSmoothingEnabled = true;
  g.drawImage(s, 0, 0, 128, 128);
  const f = g.getImageData(0, 0, 128, 128);
  for (let i = 0; i < f.data.length; i += 4) { const n = (Math.random() - 0.5) * 70; f.data[i] += n; f.data[i + 1] += n; f.data[i + 2] += n; }
  g.putImageData(f, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 8, 1 / 8);
  return t;
}
function makeBlobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.62)');
  gr.addColorStop(0.55, 'rgba(0,0,0,0.26)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------------------------------------- names for callouts
// [long name, short name] per material id; long names are used on wide screens, short ones on narrow screens.
const NAMES = {
  gyp_050: ['Gypsum board', 'Gypsum'], gyp_063: ['Gypsum board', 'Gypsum'], gyp_sheath: ['Gypsum sheathing', 'Gyp. sheathing'],
  osb: ['OSB sheathing', 'OSB'], plywood: ['Plywood sheathing', 'Plywood'], wrb: ['Housewrap (WRB)', 'Housewrap'],
  minwool: ['Mineral wool board', 'Mineral wool'], xps: ['XPS foam board', 'XPS foam'], eps: ['EPS foam board', 'EPS foam'],
  polyiso: ['Polyiso foam board', 'Polyiso'], ccspf: ['Spray foam, closed cell', 'Spray foam'], airspace: ['Air space', 'Air space'],
  brick: ['Brick', 'Brick'], cmu8: ['Concrete block (CMU)', 'CMU'], concrete: ['Concrete', 'Concrete'],
  fibercement: ['Fiber-cement siding', 'Siding'], vinyl: ['Vinyl siding', 'Siding'], stucco: ['Stucco', 'Stucco'], aluminum: ['Aluminum', 'Aluminum'],
};
const infoIdFor = (materialId) => (/^batt_/.test(materialId) ? 'batt' : materialId);
function layerNames(L) {
  if (/^batt_/.test(L.materialId)) {
    const nm = (MATERIALS[L.materialId]?.name || 'Fiberglass batt').split(',')[0];
    return [nm, nm.replace('Fiberglass batt', 'Batt')];
  }
  const n = NAMES[L.materialId];
  if (n) return n;
  const nm = (MATERIALS[L.materialId]?.name || L.materialId).split(',')[0];
  return [nm, nm];
}
function studNames(f) {
  if (f.type === 'steel') return [`Steel stud ${f.depth} in`, 'Steel stud', `${f.spacing} in o.c.`];
  const nom = f.depth === 3.5 ? '2x4' : f.depth === 5.5 ? '2x6' : f.depth === 7.25 ? '2x8' : `${f.depth} in`;
  return [`Wood stud ${nom}`, `Stud ${nom}`, `${f.spacing} in o.c.`];
}
const isFramedLayer = (L) => !!(L.framing && (L.framing.type === 'wood' || L.framing.type === 'steel'));

// ---------------------------------------------------------------------------------------------- small textures
function makeWetTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 256);
  const blob = (x, y, rx, ry, a) => {
    const gr = g.createRadialGradient(x, y, 1, x, y, Math.max(rx, ry));
    gr.addColorStop(0, `rgba(34,74,122,${a})`);
    gr.addColorStop(0.7, `rgba(34,74,122,${a * 0.8})`);
    gr.addColorStop(1, 'rgba(34,74,122,0)');
    g.save(); g.translate(x, y); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-x, -y);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, Math.max(rx, ry), 0, Math.PI * 2); g.fill(); g.restore();
  };
  blob(64, 96, 54, 82, 0.55);
  blob(40, 150, 30, 60, 0.5);
  blob(86, 170, 26, 66, 0.5);
  blob(62, 215, 18, 34, 0.45);
  // drip streaks
  g.strokeStyle = 'rgba(34,74,122,0.4)'; g.lineWidth = 5; g.lineCap = 'round';
  [[34, 180, 34, 238], [60, 200, 60, 250], [94, 190, 94, 232]].forEach(([x0, y0, x1, y1]) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); });
  // glossy sheen
  const sh = g.createLinearGradient(0, 30, 128, 120);
  sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(210,232,255,0.30)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = sh; g.fillRect(0, 0, 128, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const DEW_BLUE = '#1f6df0';

// ---------------------------------------------------------------------------------------------- the wall
export function createWall3D(stage) {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isNarrow = () => !!(window.matchMedia && window.matchMedia('(max-width: 899px)').matches);
  const narrowAtStart = isNarrow();
  const finePointer = !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches) && !narrowAtStart;
  const R = stage.renderer;
  const canvasEl = R ? R.domElement : null;
  const root = new THREE.Group();
  stage.scene.add(root);
  const prevFov = stage.camera.fov;
  stage.camera.fov = 30;
  stage.camera.updateProjectionMatrix();

  let D = { W: 65.5, H: 56, s: 9, X0: -32.75, n: 0 };
  let parts = []; // {mesh, li, real, ctrl, realOnly, stud?, info?}
  let groups = []; // per layer Group
  let extents = []; // per layer {xmid, w, h, x0, x1, z0, z1}
  let layerLooks = []; // per layer Map(id -> look)
  let dataMats = []; // per layer data material
  let outlines = []; // per layer subtle outline (data views)
  let framing = null; // {li, studs, bays, yb, yt, type}
  let layerCallouts = []; // {c, kind: 'layer'|'stud', li, ax, ay, az, long, short, sub}
  let cur = { an: null, climate: null };
  let show = 'materials';
  let explode = 0;
  let sel = null;
  let hov = null;
  let section = false;
  let showCallouts = true;
  let onSelect = null;
  let onHover = null;
  let stopPulse = null;
  let tRange = [0, 70];
  let totalDepth = 10;
  let sectionX = 0;
  let labelRaf = 0;
  let labelTimer = 0;
  let disposed = false;
  const clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0); // keeps x >= sectionX; the cut face looks toward the camera
  const extraGeos = new Set(); // shared geometries / materials to dispose with the parts
  const extraMats = new Set();
  const pickExtras = []; // dew ribbons, wet patch

  // ---- renderer, lights, environment, floor
  const bumpNoise = makeBumpNoise();
  const blobTex = makeBlobTexture();
  const wetTex = makeWetTexture();
  let envRT = null;
  let key = null;
  let hemi = null;
  let fill = null;
  const prevEnv = stage.scene.environment;
  if (R) {
    R.toneMapping = THREE.ACESFilmicToneMapping;
    R.toneMappingExposure = 0.92;
    R.outputColorSpace = THREE.SRGBColorSpace;
    R.shadowMap.enabled = true;
    R.shadowMap.type = THREE.PCFSoftShadowMap;
    R.shadowMap.autoUpdate = false;
    const pm = new THREE.PMREMGenerator(R);
    const room = new RoomEnvironment();
    envRT = pm.fromScene(room, 0.04);
    room.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    pm.dispose();
    stage.scene.environment = envRT.texture;
    stage.scene.environmentIntensity = 0.5;
  }
  stage.scene.traverse((o) => {
    if (o.isHemisphereLight) hemi = o;
    else if (o.isDirectionalLight) { if (!key) key = o; else if (!fill) fill = o; }
  });
  if (hemi) { hemi.intensity = 0.55; hemi.color.set('#f2f6ff'); hemi.groundColor.set('#a9a393'); }
  if (fill) { fill.intensity = 0.4; fill.position.set(170, 70, 130); fill.color.set('#fff3e2'); }
  if (key) {
    key.color.set('#fff6e8');
    key.intensity = 3.1;
    key.position.set(-60, 230, 140); // high sun from the front-left: short soft shadows behind the wall
    key.target.position.set(0, 24, 6);
    stage.scene.add(key.target);
    key.castShadow = !!R;
    const s = key.shadow;
    const MS = narrowAtStart ? 1024 : 2048;
    s.mapSize.set(MS, MS);
    s.camera.left = -90; s.camera.right = 90; s.camera.top = 90; s.camera.bottom = -90;
    s.camera.near = 40; s.camera.far = 520;
    s.bias = -0.0003; s.normalBias = narrowAtStart ? 0.09 : 0.05;
    s.radius = 4;
    s.camera.updateProjectionMatrix();
  }
  const shadowDirty = () => { if (R) R.shadowMap.needsUpdate = true; stage.requestRender(); };
  const floorOpacity = () => (stage.theme.dark ? 0.3 : 0.13);
  const blobOpacity = () => (stage.theme.dark ? 0.4 : 0.3);
  const floorMat = new THREE.ShadowMaterial({ opacity: floorOpacity(), color: 0x101216, depthWrite: false });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.05; floor.receiveShadow = true; floor.raycast = () => {};
  root.add(floor);
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: blobOpacity(), depthWrite: false, toneMapped: false });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMat);
  blob.rotation.x = -Math.PI / 2; blob.position.y = -0.03; blob.raycast = () => {}; blob.renderOrder = -1;
  root.add(blob);
  const onCtxRestored = () => shadowDirty();
  if (R) R.domElement.addEventListener('webglcontextrestored', onCtxRestored);

  // ---- dew point line: slim ribbons on the cut edges of the layer that holds the dew plane
  const dewMat = new THREE.MeshBasicMaterial({
    color: DEW_BLUE, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const ribGeo = new THREE.PlaneGeometry(1, 1);
  const mkRib = (name) => {
    const m = new THREE.Mesh(ribGeo, dewMat);
    m.name = name; m.renderOrder = 6; m.visible = false;
    m.userData.kind = 'dew_plane'; m.userData.infoId = 'dew_point';
    root.add(m);
    pickExtras.push(m);
    return m;
  };
  const haloMat = new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -1.5,
  });
  const mkHalo = (rib, thin) => {
    const h = new THREE.Mesh(ribGeo, haloMat);
    h.renderOrder = 5; h.raycast = () => {}; h.visible = false;
    h.userData.thin = thin; h.userData.rib = rib;
    root.add(h);
    return h;
  };
  const ribLeft = mkRib('dew-left');
  const ribTop = mkRib('dew-top');
  const ribRight = mkRib('dew-right');
  const ribCut = mkRib('dew-cut');
  const dewRibs = [ribLeft, ribTop, ribRight, ribCut];
  const dewHalos = [mkHalo(ribLeft, 'x'), mkHalo(ribTop, 'y'), mkHalo(ribRight, 'x'), mkHalo(ribCut, 'x')];

  // ---- wet patch (condensation): darkened, glossy, with beads
  const wetMat = new THREE.MeshStandardMaterial({
    map: wetTex, transparent: true, roughness: 0.06, metalness: 0.15, envMapIntensity: 2.2, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
  const wetPatch = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wetMat);
  wetPatch.renderOrder = 8; wetPatch.visible = false;
  wetPatch.userData.kind = 'condensation'; wetPatch.userData.infoId = 'condensation';
  pickExtras.push(wetPatch);
  const dropMat = new THREE.MeshStandardMaterial({
    color: '#bcdcff', emissive: '#2a6fd8', emissiveIntensity: 0.12, roughness: 0.04, metalness: 0, envMapIntensity: 2.6, transparent: true, opacity: 0.92,
  });
  const dropGeo = new THREE.SphereGeometry(0.34, 16, 12);
  const DROPS = [[0.2, 0.84, 1], [0.62, 0.9, 0.8], [0.4, 0.66, 1.15], [0.78, 0.62, 0.9], [0.24, 0.42, 1.0], [0.55, 0.38, 1.2], [0.8, 0.26, 0.85], [0.36, 0.16, 0.9], [0.62, 0.12, 0.8]];
  const drops = DROPS.map(([u, v, k]) => {
    const m = new THREE.Mesh(dropGeo, dropMat);
    m.userData = { u, v, k };
    m.raycast = () => {};
    m.scale.set(k, k * 1.2, k * 0.55);
    wetPatch.add(m);
    return m;
  });

  // ---- inside / outside markers, scale tick
  const inMarker = createSideMarker(stage, { text: 'Inside', tone: 'warm', align: narrowAtStart ? 'left' : 'right', parent: root });
  const outMarker = createSideMarker(stage, { text: 'Outside', tone: 'cold', align: 'left', parent: root });
  const scaleMarker = createSideMarker(stage, { text: '12 in', tone: 'none', align: 'left', parent: root });
  const scaleMat = new THREE.MeshBasicMaterial({ color: stage.theme.ink, transparent: true, opacity: 0.5, toneMapped: false, side: THREE.DoubleSide, depthWrite: false });
  const scaleGroup = new THREE.Group();
  const scaleGeo = new THREE.PlaneGeometry(1, 1);
  const sBars = [
    { w: 12, d: 0.4, x: 6, z: 0 },
    { w: 0.4, d: 12, x: 0, z: -6 },
    { w: 0.4, d: 2.4, x: 12, z: 0 },
    { w: 2.4, d: 0.4, x: 0, z: -12 },
  ];
  sBars.forEach((b) => {
    const m = new THREE.Mesh(scaleGeo, scaleMat);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(b.w, b.d, 1);
    m.position.set(b.x, 0.04, b.z);
    m.raycast = () => {};
    scaleGroup.add(m);
  });
  root.add(scaleGroup);

  // ---- dew and condensation callouts
  const dewCallout = createCallout(stage, { text: 'Dew point', id: 'dew_point', side: 'left', parent: root, dotColor: DEW_BLUE });
  dewCallout.userData.kind = 'dew_plane';
  dewCallout.setVisible(false);
  const condCallout = createCallout(stage, { text: 'Water forms here', id: 'condensation', side: 'right', parent: root, dotColor: '#2f7de1' });
  condCallout.userData.kind = 'condensation';
  condCallout.setVisible(false);

  // ---- selection outline (screen-space width)
  const selMat = new LineMaterial({ color: new THREE.Color(stage.theme.accent), linewidth: 2.6, toneMapped: false, depthTest: true, fog: false });
  let selLine = null;

  function gap() { return (6 * explode) / 100; }

  // ---------------------------------------------------------------------------------------------- materials
  function layerLook(li, id) {
    let m = layerLooks[li];
    if (!m) { m = new Map(); layerLooks[li] = m; }
    let k = m.get(id);
    if (!k) {
      k = getLook(id, { uvInches: true, onUpdate: () => shadowDirty() });
      if (section) k.setSection(true, clipPlane);
      m.set(id, k);
    }
    return k;
  }

  function makeDataMaterial(opacity) {
    const m = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.9, metalness: 0, toneMapped: false, bumpMap: bumpNoise, bumpScale: 0.45, envMapIntensity: 0.5,
      transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
    });
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
        float litL = dot(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, vec3(0.2126, 0.7152, 0.0722));
        float albL = max(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.03);
        float shade = gl_FrontFacing ? clamp(litL / albL / ${DATA_REF.toFixed(3)}, ${DATA_MIN.toFixed(3)}, 1.0) : 0.97;
        outgoingLight = diffuseColor.rgb * shade + totalEmissiveRadiance;
        #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'datashade2';
    if (section) { m.side = THREE.DoubleSide; m.clippingPlanes = [clipPlane]; m.clipShadows = true; }
    return m;
  }
  function dataMatFor(li) {
    if (!dataMats[li]) {
      const air = cur.an && MATERIALS[cur.an.layers[li].materialId]?.category === 'airspace';
      dataMats[li] = makeDataMaterial(air ? 0.34 : 1);
    }
    return dataMats[li];
  }

  // ---------------------------------------------------------------------------------------------- parts
  function clearParts() {
    for (const p of parts) {
      p.mesh.geometry.dispose();
      if (p.mesh.isInstancedMesh) p.mesh.dispose();
    }
    layerLooks.forEach((m) => m && m.forEach((k) => k.dispose()));
    dataMats.forEach((m) => m && m.dispose());
    outlines.forEach((o) => { if (o) { o.geometry.dispose(); o.material.dispose(); } });
    extraGeos.forEach((g) => g.dispose()); extraGeos.clear();
    extraMats.forEach((m) => m.dispose()); extraMats.clear();
    for (const g of groups) root.remove(g);
    if (selLine) { selLine.geometry.dispose(); selLine = null; }
    layerCallouts.forEach((o) => o.c.dispose());
    parts = []; groups = []; extents = []; layerLooks = []; dataMats = []; outlines = []; layerCallouts = []; framing = null;
  }

  /**
   * Register a mesh for layer li. `real` is a look material or an array of them (matching the geometry groups).
   * Geometry is already in group coordinates (mesh at the origin).
   */
  function addPart(group, li, geo, real, ctrl, o = {}) {
    if (!geo.attributes.color) geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3));
    const mesh = o.instanced || new THREE.Mesh(geo, real);
    mesh.userData.layerIndex = li;
    if (o.stud != null) mesh.userData.stud = o.stud;
    mesh.userData.info = o.info || null;
    mesh.castShadow = o.cast !== false;
    mesh.receiveShadow = o.receive !== false;
    group.add(mesh);
    parts.push({ mesh, li, real, ctrl, realOnly: !!o.realOnly, thin: !!o.thin });
    return mesh;
  }

  const mats = (li, id) => layerLook(li, id).material;
  const rndu = (a) => { const v = Math.sin(a * 91.7 + 3.1) * 43758.5453; return v - Math.floor(v); };

  // --- builders ------------------------------------------------------------------------------
  function buildSlab(g, li, id, ex, ctrl) {
    const geo = boxGeo(ex.w, ex.h, ex.tz, [ex.xmid, ex.h / 2, ex.zc]);
    addPart(g, li, geo, mats(li, id), ctrl);
  }
  function buildBoard(g, li, id, coreId, ex, ctrl, edgeFaces) {
    const geo = boxGeo(ex.w, ex.h, ex.tz, [ex.xmid, ex.h / 2, ex.zc], { mat: edgeFaces });
    addPart(g, li, geo, [mats(li, coreId), mats(li, id)], ctrl);
  }
  function buildAir(g, li, ex, ctrl, nextId) {
    const geo = boxGeo(ex.w, ex.h, ex.tz, [ex.xmid, ex.h / 2, ex.zc]);
    addPart(g, li, geo, mats(li, 'airspace'), ctrl, { cast: false, receive: false });
    // faint frame so the empty space still reads as a volume
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#8fb0c2', transparent: true, opacity: 0.7, toneMapped: false }));
    e.raycast = () => {};
    g.add(e);
    extraGeos.add(e.geometry); extraMats.add(e.material);
    parts.push({ mesh: e, li, real: null, ctrl, realOnly: true, frame: true });
    const z0 = ex.zc - ex.tz / 2; const z1 = ex.zc + ex.tz / 2;
    const isLast = li === D.n - 1;
    const sx = D.s;
    const steelMat = new THREE.MeshStandardMaterial({ color: '#9aa4ad', metalness: 0.85, roughness: 0.38, envMapIntensity: 1.2 });
    extraMats.add(steelMat);
    if (nextId === 'brick' || nextId === 'cmu8' || nextId === 'concrete') {
      // wire ties across the cavity, shown where the exterior leaf is cut back
      const xc = isLast ? ex.xmid : ex.x1 - sx / 2;
      [0.24, 0.5, 0.76].forEach((fy, k) => {
        const y = ex.h * fy;
        const x = xc + (k === 1 ? sx * 0.16 : -sx * 0.12);
        const len = ex.tz + 1.6;
        const rod = new THREE.CylinderGeometry(0.11, 0.11, len, 8);
        rod.rotateX(Math.PI / 2);
        rod.translate(x, y, z0 - 0.4 + len / 2);
        const hook = new THREE.CylinderGeometry(0.11, 0.11, 1.5, 8);
        hook.translate(x, y - 0.6, z1 + 1.15);
        const plate = boxGeo(1.0, 2.4, 0.07, [x, y, z0 + 0.03]);
        const geo = mergeGeos([rod, hook, plate]);
        addPart(g, li, geo, steelMat, ctrl, { realOnly: true, info: 'brick_tie' });
      });
    } else if (nextId === 'fibercement' || nextId === 'vinyl' || nextId === 'stucco') {
      // vertical furring strips make the drainage gap
      const wood = mats(li, 'softwood');
      for (let x = ex.x0 + 0.75; x < ex.x1; x += 16) {
        const geo = boxGeo(1.5, ex.h, ex.tz, [x, ex.h / 2, ex.zc], { uv0: [rndu(x) * 9, rndu(x + 3) * 9] });
        addPart(g, li, geo, wood, ctrl, { realOnly: true, info: 'softwood' });
      }
    }
  }
  function buildWrb(g, li, ex, ctrl) {
    const w = ex.w; const h = ex.h;
    const STRIP = 17; const STEP = 14;
    const tapeMat = new THREE.MeshStandardMaterial({ color: '#f1eee6', roughness: 0.5, metalness: 0, envMapIntensity: 0.6 });
    extraMats.add(tapeMat);
    for (let k = 0, y0 = 0; y0 < h - 0.4; k += 1, y0 += STEP) {
      const y1 = Math.min(y0 + STRIP, h);
      const z = ex.zc + k * 0.06 - 0.02;
      const geo = boxGeo(w, y1 - y0, 0.1, [ex.xmid, (y0 + y1) / 2, z], { uv0: [k * 7.3, k * 3.1] });
      addPart(g, li, geo, mats(li, 'wrb'), ctrl);
      if (k > 0) {
        const tg = boxGeo(w, 1.3, 0.04, [ex.xmid, y0 + 0.65, z + 0.06]);
        addPart(g, li, tg, tapeMat, ctrl, { realOnly: true, cast: false });
      }
    }
    // cap fasteners
    const xs = []; const ys = [];
    for (let x = ex.x0 + 6; x < ex.x1 - 2; x += 16) xs.push(x);
    for (let y = 6; y < h - 2; y += 14) ys.push(y);
    const n = xs.length * ys.length;
    if (n) {
      const cg = new THREE.CylinderGeometry(0.55, 0.55, 0.05, 16);
      cg.rotateX(Math.PI / 2);
      const cm = new THREE.MeshStandardMaterial({ color: '#dcd7c9', roughness: 0.4, metalness: 0, envMapIntensity: 0.8 });
      extraMats.add(cm);
      const im = new THREE.InstancedMesh(cg, cm, n);
      const m4 = new THREE.Matrix4();
      let q = 0;
      ys.forEach((y, r) => xs.forEach((x) => {
        const kk = Math.floor(y / STEP);
        m4.makeTranslation(x + (r % 2 ? 8 : 0), y, ex.zc + 0.1 + kk * 0.06);
        im.setMatrixAt(q, m4); q += 1;
      }));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = false; im.receiveShadow = true;
      cg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cg.attributes.position.count * 3).fill(1), 3));
      addPart(g, li, cg, cm, ctrl, { instanced: im, realOnly: true });
    }
  }
  function buildSiding(g, li, id, ex, ctrl) {
    const vinyl = id === 'vinyl';
    const EXP = vinyl ? 4.5 : 6; const BH = EXP + (vinyl ? 0.9 : 1.25);
    const zIn = ex.zc - ex.tz / 2; const zOut = ex.zc + ex.tz / 2;
    const look = mats(li, id);
    for (let k = 0, y0 = 0; y0 < ex.h - 0.3; k += 1, y0 += EXP) {
      const y1 = Math.min(y0 + BH, ex.h);
      const zBot = zOut + 0.25;
      const zTop = zBot - (zBot - zIn - 0.04) * ((y1 - y0) / BH);
      const prof = [[y0, zIn], [y0, zBot], [y1, zTop], [y1, zIn]];
      const geo = prismGeo(prof, ex.x0, ex.x1, [(k * 5.7) % 12, (k * 3.3) % 12]);
      addPart(g, li, geo, look, ctrl);
    }
  }
  function buildFramed(g, li, L, ex, ctrl, plan) {
    const f = L.framing;
    const { w, h, zc, tz } = ex;
    const xmax = ex.x1;
    const wood = f.type === 'wood';
    const sw = wood ? 1.5 : 1.625;
    const sCtrl = CONTROL_COLORS.structure;
    const studs = [];
    for (let s = ex.x0; s < xmax - 0.2; s += f.spacing) studs.push([s, Math.min(s + sw, xmax)]);
    const last = studs[studs.length - 1];
    if (xmax - last[1] > 3) studs.push([xmax - sw, xmax]);
    let yb; let yt; // clear bay range
    if (wood) {
      const side = mats(li, 'softwood'); const end = mats(li, 'woodend');
      const pl = 1.5;
      yb = pl; yt = h - 2 * pl;
      // studs: grain runs along the length, end grain on the cut tops; uv in inches so nothing stretches
      studs.forEach(([a, b], k) => {
        const geo = boxGeo(b - a, yt - yb, tz, [(a + b) / 2, (yb + yt) / 2, zc], { mat: [1, 1, 0, 0, 1, 1], uv0: [rndu(k + 1) * 9, rndu(k + 5) * 30] });
        addPart(g, li, geo, [end, side], sCtrl, { stud: k, info: 'softwood' });
      });
      // bottom plate and doubled top plate: grain runs along the wall, end grain on the cut ends
      [[0, 0], [h - 2 * pl, 1], [h - pl, 2]].forEach(([y0, k]) => {
        const geo = boxGeo(w, pl, tz, [ex.xmid, y0 + pl / 2, zc], { mat: [0, 0, 1, 1, 1, 1], grain: 'x', uv0: [rndu(k + 11) * 9, rndu(k + 17) * 30] });
        addPart(g, li, geo, [end, side], sCtrl, { stud: -1, info: 'softwood' });
      });
    } else {
      const steel = mats(li, 'steel');
      const t = 0.07; const F = 1.625; const LIP = 0.5;
      const z0 = zc - tz / 2; const z1 = zc + tz / 2;
      yb = t; yt = h - t;
      const len = yt - yb;
      studs.forEach(([a], k) => {
        // web with punch-outs, flanges with lips (C section), merged into one geometry
        const web = new THREE.Shape();
        web.moveTo(z0, 0); web.lineTo(z1, 0); web.lineTo(z1, len); web.lineTo(z0, len); web.closePath();
        for (let yy = 14; yy < len - 6; yy += 24) {
          const hole = new THREE.Path();
          hole.absellipse(zc, yy, 0.75, 2, 0, Math.PI * 2, false, 0);
          web.holes.push(hole);
        }
        const wg = extr(web, t, 0);
        wg.rotateY(-Math.PI / 2); // shape x -> z, shape y -> y, extrusion -> -x
        wg.translate(a + t, yb, 0);
        const mk = (zEdge, dir) => {
          const zi = (d) => zEdge + dir * d;
          const pts = [[0, zi(0)], [F, zi(0)], [F, zi(LIP)], [F - t, zi(LIP)], [F - t, zi(t)], [0, zi(t)]].map((p) => [p[0], -p[1]]);
          const geo = extr(polyShape(pts), len, 0);
          geo.rotateX(-Math.PI / 2); geo.translate(a, yb, 0);
          return geo;
        };
        const geo = mergeGeos([wg, mk(z0, 1), mk(z1, -1)]);
        shiftUV(geo, rndu(k + 3) * 9, rndu(k + 8) * 9);
        addPart(g, li, geo, steel, sCtrl, { stud: k, info: 'steel' });
      });
      [0, 1].forEach((top) => {
        const pts = [[-(z0 - t), 0], [-(z1 + t), 0], [-(z1 + t), 1.25], [-z1, 1.25], [-z1, t], [-z0, t], [-z0, 1.25], [-(z0 - t), 1.25]];
        const geo = extr(polyShape(pts), w, 0);
        geo.rotateY(Math.PI / 2); geo.translate(ex.x0, 0, 0);
        if (top) { geo.translate(-ex.xmid, -h / 2, 0); geo.rotateZ(Math.PI); geo.translate(ex.xmid, h / 2, 0); }
        addPart(g, li, geo, steel, sCtrl, { stud: -1, info: 'steel' });
      });
    }
    // batts between the studs: slightly inset, with a puffy exterior face. The last bay is cut back so the gypsum shows behind.
    const bays = [];
    studs.forEach(([, b], k) => { bays.push([b, studs[k + 1] ? studs[k + 1][0] : xmax]); });
    const battLook = mats(li, L.materialId);
    const lastBay = bays.length - 2; // the bay between the last two studs
    const cutTop = plan && plan.cutTop != null ? Math.min(yt - 2.5, Math.max(yb + 3, plan.cutTop)) : yt;
    bays.forEach(([a, b], k) => {
      const gx = b - a - 0.25;
      if (gx < 0.6) return;
      const top = k === lastBay && cutTop < yt - 2.6 ? cutTop : yt;
      const tb = tz - 0.45;
      const geo = boxGeo(gx, top - yb - 0.2, tb, [(a + b) / 2, (yb + top) / 2, zc - 0.075], {
        seg: [Math.max(3, Math.round(gx / 1.2)), 16], puff: { pz: 0.32, nz: 0.12 }, uv0: [k * 5.1, k * 2.7],
      });
      addPart(g, li, geo, battLook, CONTROL_COLORS.thermal, { info: infoIdFor(L.materialId) });
    });
    framing = { li, studs, bays: bays.filter(([a, b]) => b - a - 0.25 >= 0.6), yb, yt, type: f.type, lastBay, cutTop, zFront: zc + tz / 2 };
  }

  // ---- anchors and slots for the callouts (one label per layer, plus the stud)
  function planCallouts(an) {
    const specs = [];
    an.layers.forEach((L, i) => {
      if (isFramedLayer(L)) { specs.push({ kind: 'stud', li: i }); specs.push({ kind: 'layer', li: i, batt: true }); } else specs.push({ kind: 'layer', li: i });
    });
    const N = specs.length;
    const ymax = D.H - D.s / 2; const ymin = 6;
    specs.forEach((sp, k) => { sp.slot = N > 1 ? ymax - (k * (ymax - ymin)) / (N - 1) : ymax; });
    return specs;
  }

  function build(an) {
    clearParts();
    const n = an.layers.length;
    const fl = an.layers.find(isFramedLayer);
    const sp = fl ? fl.framing.spacing : 16;
    const W = fl ? (sp >= 24 ? 3 : 4) * sp + 1.5 : 65.5;
    const H = 56;
    let s = n > 1 ? Math.min(8.5, (H - 14) / (n - 1), (W - 18) / (n - 1)) : 0;
    if (n > 1) s = Math.max(s, 2.2);
    D = { W, H, s, X0: -W / 2, n };
    totalDepth = an.totalThickness || 10;
    const specs = planCallouts(an);
    an.layers.forEach((L, i) => {
      const mat = MATERIALS[L.materialId];
      const w = Math.max(W - s * i, 4);
      const h = Math.max(H - s * i, 4);
      const xmid = D.X0 + w / 2;
      const zc = (L.zIn + L.zOut) / 2;
      const t = Math.max(L.thickness, MIN_T);
      const inset = t > 0.1 ? 0.015 : 0;
      const tz = t - 2 * inset;
      const ex = { w, h, xmid, zc, tz, x0: D.X0, x1: D.X0 + w };
      extents.push({ xmid, w, h, x0: D.X0, x1: D.X0 + w, z0: zc - t / 2, z1: zc + t / 2 });
      const g = new THREE.Group();
      g.userData.layerIndex = i;
      root.add(g);
      groups.push(g);
      const ctrl = CONTROL_COLORS[mat?.control] || CONTROL_COLORS.structure;
      const id = L.materialId;
      const nextId = an.layers[i + 1]?.materialId || null;
      if (isFramedLayer(L)) {
        const battSpec = specs.find((q) => q.li === i && q.batt);
        buildFramed(g, i, L, ex, ctrl, { cutTop: battSpec ? battSpec.slot + 3.4 : null });
      } else if (mat?.category === 'airspace') buildAir(g, i, ex, ctrl, nextId);
      else if (id === 'wrb') buildWrb(g, i, ex, ctrl);
      else if (id === 'fibercement' || id === 'vinyl') buildSiding(g, i, id, ex, ctrl);
      else if (id === 'gyp_050' || id === 'gyp_063' || id === 'gyp_sheath') buildBoard(g, i, id, 'gypcore', ex, ctrl, [0, 0, 0, 0, 1, 1]);
      else if (id === 'polyiso') buildBoard(g, i, id, 'polycore', ex, ctrl, [0, 0, 0, 0, 1, 1]);
      else buildSlab(g, i, id, ex, ctrl);

      // subtle outline of the layer box for the data views
      const ob = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, t)),
        new THREE.LineBasicMaterial({ color: stage.theme.ink, transparent: true, opacity: 0.32, toneMapped: false }),
      );
      ob.position.set(xmid, h / 2, zc);
      ob.raycast = () => {};
      ob.visible = false;
      g.add(ob);
      outlines[i] = ob;
    });
    // section plane through the middle of a bay so the cut shows the batt profile
    sectionX = D.X0 + (fl ? sp / 2 + 0.75 : D.W / 2);
    clipPlane.constant = -sectionX;
    // callouts, one per layer plus one for the framing
    const nar = isNarrow();
    specs.forEach((spc) => {
      const L = an.layers[spc.li];
      const e = extents[spc.li];
      const last = spc.li === n - 1;
      const stripC = last ? e.xmid : e.x1 - D.s / 2;
      let ax = stripC; let ay = Math.min(Math.max(spc.slot, 2.5), e.h - 1.8); let id; let names;
      if (spc.kind === 'stud' && framing && framing.li === spc.li) {
        const st = framing.studs[framing.studs.length - 1];
        ax = (st[0] + st[1]) / 2;
        ay = Math.min(Math.max(spc.slot, framing.yb + 2), framing.yt - 1.2);
        names = studNames(L.framing);
        id = L.framing.type === 'steel' ? 'steel' : 'softwood';
      } else {
        names = layerNames(L);
        id = infoIdFor(L.materialId);
        if (spc.batt && framing && framing.bays.length) {
          const bay = framing.bays[framing.bays.length - 1];
          ax = (bay[0] + bay[1]) / 2;
          if (ax < e.x1 - D.s) ax = e.x1 - D.s / 2 - 0.5;
          ay = Math.min(ay, framing.cutTop < framing.yt - 2.6 ? framing.cutTop - 2.2 : ay);
        }
      }
      const c = createCallout(stage, { text: names[0], id, parent: root, layerIndex: spc.li, side: 'right', fontPx: nar ? 11.5 : 12.5 });
      c.userData.kind = spc.kind === 'stud' ? 'stud' : 'layer';
      layerCallouts.push({ c, kind: c.userData.kind, li: spc.li, ax, ay, az: e.z1 + (isFramedLayer(L) ? 0.4 : 0.05), long: names[0], short: names[1], sub: names[2] || null });
    });
    // ground contact shadow follows the footprint
    blob.scale.set(D.W + 30, totalDepth + 36, 1);
    blob.position.z = totalDepth / 2;
    applyShow();
  }

  function structureKey(an) {
    return JSON.stringify(an.layers.map((l) => [l.materialId, l.thickness, l.framing && [l.framing.type, l.framing.spacing, l.framing.depth]]));
  }
  let builtKey = '';

  // ---------------------------------------------------------------------------------------------- layout (positions that follow explode / data)
  const fmt0 = (v) => String(Math.round(v));

  function calloutText(o) {
    const nar = isNarrow();
    const an = cur.an;
    const name = nar ? o.short : o.long;
    let sub = null;
    if (show === 'temp' && !nar && o.kind === 'layer' && an && an.layers[o.li]) {
      const L = an.layers[o.li];
      sub = `${fmt0(L.tIn)} to ${fmt0(L.tOut)} °F`;
    } else if (o.kind === 'stud' && !nar) sub = o.sub;
    return sub ? `${name}\n${sub}` : name;
  }

  function layout() {
    const gp = gap();
    groups.forEach((g, i) => { g.position.z = i * gp; });
    const an = cur.an;
    if (!an) return;
    const n = an.layers.length;
    const climate = cur.climate;
    // layer callouts
    layerCallouts.forEach((o) => {
      o.c.setAnchor(new THREE.Vector3(o.ax, o.ay, o.az + o.li * gp));
      const t = calloutText(o);
      if (t !== o.c.text) o.c.setText(t);
      o.c.setVisible(showCallouts);
    });
    // dew point line
    const dp = an.dewPlane;
    if (dp && groups[dp.layerIndex]) {
      const k = dp.layerIndex; const e = extents[k]; const g = groups[k];
      const ext = 2.4; const th = 0.8;
      const zD = dp.z + 0.0;
      dewRibs.forEach((r) => { if (r.parent !== g) g.add(r); r.visible = true; });
      const hRib = e.h + ext;
      ribLeft.rotation.set(0, Math.PI / 2, 0); ribLeft.scale.set(th, hRib, 1); ribLeft.position.set(e.x0 - 0.07, hRib / 2, zD);
      ribRight.rotation.set(0, Math.PI / 2, 0); ribRight.scale.set(th, hRib, 1); ribRight.position.set(e.x1 + 0.07, hRib / 2, zD);
      const lx = e.w + ext;
      ribTop.rotation.set(-Math.PI / 2, 0, 0); ribTop.scale.set(lx, th, 1); ribTop.position.set(e.x0 + lx / 2 - 0.4, e.h + 0.07, zD);
      ribCut.rotation.set(0, Math.PI / 2, 0); ribCut.scale.set(th, hRib, 1); ribCut.position.set(sectionX + 0.07, hRib / 2, zD);
      ribCut.visible = section;
      ribLeft.visible = !section;
      dewHalos.forEach((h) => {
        const rb = h.userData.rib;
        if (h.parent !== g) g.add(h);
        h.position.copy(rb.position); h.rotation.copy(rb.rotation); h.scale.copy(rb.scale);
        if (h.userData.thin === 'x') h.scale.x *= 2.3; else h.scale.y *= 2.3;
        h.visible = rb.visible;
      });
      dewMat.opacity = show === 'materials' ? 0.95 : 0.7; haloMat.opacity = show === 'materials' ? 0.8 : 0.5;
      // callout: on the top end of the left ribbon, label to the left
      const warmSide = an.warmSide;
      const second = isNarrow()
        ? (warmSide === 'interior' ? 'Outside is colder' : 'Inside is colder')
        : (warmSide === 'interior' ? 'Outside of this line is colder' : 'Inside of this line is colder');
      const dewAtRight = isNarrow();
      dewCallout.setAnchor(new THREE.Vector3(dewAtRight ? e.x1 + ext - 0.6 : (section ? sectionX + 0.07 : e.x0 - 0.07), dewAtRight ? e.h + 0.3 : hRib, zD + k * gp));
      dewCallout.userData.layerIndex = k;
      const dt = `Dew point ${fmt0(an.dewPointF)} °F\n${second}`;
      if (dt !== dewCallout.text) dewCallout.setText(dt);
      dewCallout.setVisible(showCallouts);
    } else {
      dewRibs.forEach((r) => { r.visible = false; });
      dewHalos.forEach((h) => { h.visible = false; });
      dewCallout.setVisible(false);
    }
    // condensation: wet patch on the first at-risk face, which is exposed on a tread
    if (an.risk && an.condensation) {
      const c = an.condensation;
      const winter = an.season === 'winter';
      const li = winter ? Math.min(c.faceIndex, n - 1) : Math.max(c.faceIndex - 1, 0);
      const vis = winter ? li - 1 : li; // the layer whose outer face shows the cold surface
      const target = Math.max(vis, 0);
      const e = extents[target]; const g = groups[target];
      if (g && e) {
        if (wetPatch.parent !== g) g.add(wetPatch);
        const lastL = target === n - 1;
        const pw = lastL ? Math.min(e.w * 0.45, 22) : Math.max(Math.min(D.s * 0.8, 10), 2);
        const ph = Math.min(e.h * 0.6, 28);
        const cx = lastL ? e.xmid : e.x1 - D.s / 2;
        const cy = lastL ? e.h * 0.5 : Math.min(e.h * 0.5, e.h - ph / 2 - 1);
        const zf = e.z1 + (isFramedLayer(an.layers[target]) ? 0.45 : 0.06) + (vis < 0 ? -(e.z1 - e.z0) : 0);
        wetPatch.visible = vis >= 0;
        wetPatch.scale.set(pw, ph, 1);
        wetPatch.position.set(cx, cy, zf);
        wetPatch.userData.layerIndex = target;
        drops.forEach((d) => {
          const r = 0.27 * d.userData.k;
          d.position.set((d.userData.u - 0.5) * 0.86, (d.userData.v - 0.5) * 0.86, 0.1);
          d.scale.set(r / 0.34 / pw, (r * 1.25) / 0.34 / ph, (r * 0.6) / 0.34);
        });
        const tempText = `${isNarrow() ? 'Water forms' : 'Water forms here'}: ${fmt0(c.tempF)} °F`;
        condCallout.setAnchor(new THREE.Vector3(cx, cy + ph * 0.2, zf + 0.3 + target * gp));
        condCallout.userData.layerIndex = target;
        if (tempText !== condCallout.text) condCallout.setText(tempText);
        condCallout.setVisible(showCallouts);
      } else { wetPatch.visible = false; condCallout.setVisible(false); }
    } else { wetPatch.visible = false; condCallout.setVisible(false); }
    // inside / outside markers and scale
    const tIn = climate ? climate.tIn : 70; const tOut = climate ? climate.tOut : 20;
    const warmIn = tIn >= tOut;
    // The camera looks from the exterior, so say where each side is.
    inMarker.setText(isNarrow() ? `Inside · ${fmt0(tIn)} °F` : `Inside, behind the wall · ${fmt0(tIn)} °F`); inMarker.setTone(warmIn ? 'warm' : 'cold');
    outMarker.setText(isNarrow() ? `Outside · ${fmt0(tOut)} °F` : `Outside, where you stand · ${fmt0(tOut)} °F`); outMarker.setTone(warmIn ? 'cold' : 'warm');
    const zFront = totalDepth + (n - 1) * gp;
    const nar = isNarrow();
    [inMarker, outMarker, scaleMarker].forEach((m) => m.setFont(nar ? 12 : 13.5));
    inMarker.setPosition(nar ? new THREE.Vector3(D.X0 - 0.5, D.H + 6, -0.5) : new THREE.Vector3(D.X0 - 2.5, D.H * 0.46, -0.5));
    outMarker.setPosition(new THREE.Vector3(D.X0 - 2, -3.4, zFront + 4));
    scaleGroup.visible = !nar; scaleMarker.setVisible(!nar);
    scaleGroup.position.set(D.X0 + 24, 0, zFront + 14);
    scaleMarker.setPosition(new THREE.Vector3(D.X0 + 24 + 14, 0.5, zFront + 14));
    scaleMat.color.set(stage.theme.ink);
    shadowDirty();
    scheduleLabels();
  }

  // data colors per vertex
  function paintData() {
    const an = cur.an;
    if (!an) return;
    const [tmin, tmax] = tRange;
    for (const p of parts) {
      if (p.realOnly) continue;
      const L = an.layers[p.li];
      if (!L) continue;
      const geo = p.mesh.geometry;
      const pos = geo.attributes.position;
      const col = geo.attributes.color;
      if (show === 'temp') {
        const span = L.zOut - L.zIn || 1;
        for (let v = 0; v < pos.count; v += 1) {
          const f = Math.min(1, Math.max(0, (pos.getZ(v) - L.zIn) / span));
          const c = tempToColor(L.tIn + (L.tOut - L.tIn) * f, tmin, tmax);
          col.setXYZ(v, c.r, c.g, c.b);
        }
      } else if (show === 'control') {
        const c = new THREE.Color(p.ctrl);
        for (let v = 0; v < pos.count; v += 1) col.setXYZ(v, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
    }
  }

  function applyShow() {
    const data = show !== 'materials';
    parts.forEach((p) => {
      if (p.frame) { p.mesh.visible = !data; return; }
      if (p.realOnly) { p.mesh.visible = !data; return; }
      p.mesh.visible = true;
      p.mesh.material = data ? dataMatFor(p.li) : p.real;
    });
    outlines.forEach((o) => { if (o) o.visible = data; });
    paintData();
    shadowDirty();
  }

  // ---------------------------------------------------------------------------------------------- selection and hover emphasis
  function applyEmphasis() {
    const acc = new THREE.Color(stage.theme.accent);
    const k = (li) => (li === sel ? 0.32 : li === hov ? 0.13 : 0);
    const setEm = (m, v) => {
      m.emissive.copy(v ? acc : new THREE.Color(0x000000));
      m.emissiveIntensity = v;
    };
    layerLooks.forEach((m, li) => m && m.forEach((kk) => setEm(kk.material, k(li))));
    dataMats.forEach((m, li) => { if (m) { m.emissive.copy(k(li) ? acc : new THREE.Color(0)); m.emissiveIntensity = k(li) ? k(li) * 1.25 : 0; } });
    parts.forEach((p) => {
      const m = p.real && !Array.isArray(p.real) && p.real.emissive && !p.real.userData.look ? p.real : null;
      if (m) setEm(m, k(p.li));
    });
    layerCallouts.forEach((o) => o.c.setActive(o.li === sel || o.li === hov));
    shadowDirty();
  }

  function applySelection() {
    const acc = new THREE.Color(stage.theme.accent);
    if (selLine) { selLine.parent && selLine.parent.remove(selLine); selLine.geometry.dispose(); selLine = null; }
    if (sel != null && extents[sel] && groups[sel]) {
      const e = extents[sel]; const pad = 0.12;
      const x0 = e.x0 - pad; const x1 = e.x1 + pad; const y0 = -pad; const y1 = e.h + pad; const z0 = e.z0 - pad; const z1 = e.z1 + pad;
      const c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      const arr = [];
      E.forEach(([a, b]) => arr.push(...c[a], ...c[b]));
      const lg = new LineSegmentsGeometry();
      lg.setPositions(arr);
      selMat.color.copy(acc);
      selLine = new LineSegments2(lg, selMat);
      selLine.frustumCulled = false; selLine.raycast = () => {};
      groups[sel].add(selLine);
    }
    applyEmphasis();
    stage.requestRender();
  }

  function setPulse(on) {
    condCallout.setPulse(!!on);
    if (on && !reduce) {
      if (!stopPulse) {
        stopPulse = stage.onFrame((dt, t) => {
          dropMat.emissiveIntensity = 0.14 + 0.1 * Math.sin(t * 3);
        });
      }
    } else if (stopPulse) { stopPulse(); stopPulse = null; dropMat.emissiveIntensity = 0.12; stage.requestRender(); }
  }

  // ---------------------------------------------------------------------------------------------- label placement (screen space)
  const _cp = new THREE.Vector3();
  function syncCam() {
    stage.camera.updateMatrixWorld();
    stage.camera.matrixWorldInverse.copy(stage.camera.matrixWorld).invert();
  }
  function canvasRect() { return canvasEl ? canvasEl.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 }; }
  function wallCorners() {
    const gp = gap();
    const pts = [];
    extents.forEach((e, i) => {
      [e.x0, e.x1].forEach((x) => [0, e.h].forEach((y) => [e.z0, e.z1].forEach((z) => pts.push(new THREE.Vector3(x, y, z + i * gp)))));
    });
    return pts;
  }
  function silhouette() {
    syncCam();
    const r = canvasRect();
    let L = Infinity; let Rr = -Infinity; let T = Infinity; let B = -Infinity;
    const add = (x, y) => { L = Math.min(L, x); Rr = Math.max(Rr, x); T = Math.min(T, y); B = Math.max(B, y); };
    wallCorners().forEach((p) => { const c = worldToClient(stage, p); add(c.x - r.left, c.y - r.top); });
    // the markers sit in the side columns, so they only count for the vertical extent
    [inMarker, outMarker].forEach((m) => {
      const p = worldToClient(stage, m.object.position);
      const h = m.object.userData.px.h;
      T = Math.min(T, p.y - r.top - h / 2); B = Math.max(B, p.y - r.top + h / 2);
    });
    return { L, R: Rr, T, B, w: r.width, h: r.height };
  }
  function planeShift(world, sx, sy, r) {
    // point on the camera-parallel plane through `world` that projects to client (sx, sy)
    const cam = stage.camera;
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    const ndc = new THREE.Vector3(((sx - r.left) / r.width) * 2 - 1, -(((sy - r.top) / r.height) * 2 - 1), 0.5).unproject(cam);
    const ray = ndc.sub(cam.position);
    const den = ray.dot(fwd);
    if (Math.abs(den) < 1e-6) return world.clone();
    const t = world.clone().sub(cam.position).dot(fwd) / den;
    return cam.position.clone().addScaledVector(ray, t);
  }
  function visibleCallouts() {
    const out = layerCallouts.map((o) => o.c);
    out.push(dewCallout, condCallout);
    return out.filter((c) => c.object.visible);
  }
  const TOP_INSET = () => 10;
  const BOTTOM_INSET = () => {
    const h = document.querySelector('.asm-hint');
    return h ? h.offsetHeight + 16 : 12;
  };
  function placeLabels() {
    if (disposed || !canvasEl || !cur.an) return;
    const r = canvasRect();
    if (!r.width || !r.height) return;
    const sil = silhouette();
    const list = visibleCallouts();
    list.forEach((c) => {
      const anchor = c.object.position;
      const ap = worldToClient(stage, anchor);
      const roomL = sil.L - 10; const roomR = sil.w - sil.R - 10;
      let side = c === dewCallout && !isNarrow() ? 'left' : 'right';
      if (side === 'left' && roomL < c.size.w + 14) side = 'right';
      if (side === 'right' && !isNarrow() && roomR < c.size.w + 14 && roomL > roomR) side = 'left';
      const sx = side === 'right' ? r.left + sil.R + 14 : r.left + sil.L - 14;
      const target = planeShift(anchor, sx, ap.y, r);
      c.setSide(side);
      c.setOffset(target.sub(anchor));
    });
    layoutCallouts(list, stage, { gap: 3, margin: 6, top: TOP_INSET(), bottom: BOTTOM_INSET() });
    placeInsideMarker(list);
    stage.requestRender();
  }
  function markerRect(m) {
    const p = worldToClient(stage, m.object.position);
    const w = m.object.userData.px.w; const h = m.object.userData.px.h; const cx = m.object.center.x;
    return { left: p.x - cx * w, right: p.x + (1 - cx) * w, top: p.y - h / 2, bottom: p.y + h / 2 };
  }
  function placeInsideMarker(list) {
    if (isNarrow()) return;
    const rects = list.map((c) => c.clientRect());
    const cands = [0.46, 0.2, 0.72, 0.9, 0.05];
    for (const f of cands) {
      inMarker.setPosition(new THREE.Vector3(D.X0 - 2.5, D.H * f, -0.5));
      syncCam();
      const m = markerRect(inMarker);
      if (!rects.some((q) => m.left < q.right + 6 && q.left < m.right + 6 && m.top < q.bottom + 6 && q.top < m.bottom + 6)) break;
    }
  }
  function scheduleLabels() {
    if (labelRaf || disposed) return;
    labelRaf = requestAnimationFrame(() => { labelRaf = 0; placeLabels(); });
  }
  function scheduleLabelsSoon() {
    clearTimeout(labelTimer);
    labelTimer = setTimeout(() => { placeLabels(); }, 380);
  }

  function fitView() {
    if (!canvasEl) return;
    const cam = stage.camera; const ctl = stage.controls;
    cam.fov = 30; cam.updateProjectionMatrix();
    const zF = totalDepth;
    const box = new THREE.Box3(new THREE.Vector3(D.X0, 0, 0), new THREE.Vector3(D.X0 + D.W, D.H, zF));
    // from the exterior side, about 32 degrees to the left and 18 degrees above
    const az = THREE.MathUtils.degToRad(32); const el = THREE.MathUtils.degToRad(18);
    const dir = [-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
    stage.frame(box, { dir, padding: 1.0 });
    for (let it = 0; it < 4; it += 1) {
      layout();
      placeLabelsNow();
      const sil = silhouette();
      const nar = isNarrow();
      let maxR = 0; let maxL = 0;
      visibleCallouts().forEach((c) => { if (c === dewCallout && !nar) maxL = Math.max(maxL, c.size.w); else maxR = Math.max(maxR, c.size.w); });
      maxL = nar ? 0 : Math.max(maxL, inMarker.object.userData.px.w + 6);
      const needL = nar ? 10 : Math.max(maxL + 22, 12);
      const needR = maxR + (nar ? 16 : 22);
      const avail = Math.max(120, sil.w - needL - needR - 4);
      const curW = sil.R - sil.L;
      const top = TOP_INSET();
      const availH = sil.h - top - BOTTOM_INSET();
      const curH = sil.B - sil.T;
      const f = Math.max(curW / avail, curH / availH);
      // dolly so the wall (and the markers) fit with room for the labels; never dolly in past the tight fit
      const off = cam.position.clone().sub(ctl.target);
      off.multiplyScalar(f);
      cam.position.copy(ctl.target).add(off);
      cam.near = Math.max(0.1, off.length() / 200); cam.far = Math.max(1000, off.length() * 30);
      cam.updateProjectionMatrix();
      syncCam();
      const s2 = silhouette();
      // pan: left edge at needL, vertically centred
      const dxPx = needL - s2.L + (avail - (s2.R - s2.L)) / 2;
      const dyPx = top + availH / 2 - (s2.T + s2.B) / 2;
      const wpp = (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * off.length()) / sil.h;
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      const mv = right.multiplyScalar(-dxPx * wpp).addScaledVector(up, dyPx * wpp);
      cam.position.add(mv); ctl.target.add(mv);
      cam.updateMatrixWorld();
      ctl.update();
    }
    const dist = cam.position.distanceTo(ctl.target);
    ctl.minDistance = dist * 0.35; ctl.maxDistance = dist * 3.5;
    layout();
    placeLabelsNow();
    stage.requestRender();
  }
  function placeLabelsNow() {
    cancelAnimationFrame(labelRaf); labelRaf = 0;
    syncCam();
    placeLabels();
  }

  // ---------------------------------------------------------------------------------------------- picking
  function pickables() { return [...parts.map((p) => p.mesh), ...pickExtras.filter((m) => m.visible)]; }
  function allCallouts() { return [...layerCallouts.map((o) => o.c), dewCallout, condCallout]; }
  function payloadFrom(hit, cx, cy) {
    const base = { clientX: cx, clientY: cy };
    if (!hit) return { kind: null, layerIndex: null, infoId: null, ...base };
    const ud = hit.object.userData;
    if (ud.kind === 'dew_plane') return { kind: 'dew_plane', layerIndex: cur.an?.dewPlane ? cur.an.dewPlane.layerIndex : null, infoId: 'dew_point', ...base };
    if (ud.kind === 'condensation') return { kind: 'condensation', layerIndex: ud.layerIndex ?? null, infoId: 'condensation', ...base };
    const li = ud.layerIndex;
    const L = cur.an && cur.an.layers[li];
    const isStud = ud.stud != null && (ud.info === 'softwood' || ud.info === 'steel');
    const infoId = ud.info || (L ? infoIdFor(L.materialId) : null);
    return { kind: isStud ? 'stud' : 'layer', layerIndex: li ?? null, infoId, ...base };
  }
  function pointerPayload(cx, cy) {
    const c = pickCallout(stage, cx, cy, allCallouts());
    if (c) {
      const ud = c.userData;
      return { kind: 'callout', layerIndex: ud.layerIndex ?? null, infoId: ud.infoId, calloutKind: ud.kind || 'layer', clientX: cx, clientY: cy };
    }
    return payloadFrom(stage.pick(cx, cy, pickables()), cx, cy);
  }

  const offTap = stage.onTap((e) => {
    const p = pointerPayload(e.clientX, e.clientY);
    const layerish = p.kind === 'layer' || p.kind === 'stud' || (p.kind === 'callout' && (p.calloutKind === 'layer' || p.calloutKind === 'stud'));
    if (onSelect) onSelect(layerish ? p.layerIndex : null, p);
  });

  let lastMove = 0;
  let lastHoverKey = '';
  function onMove(e) {
    if (!onHover || e.buttons) return;
    const now = performance.now();
    if (now - lastMove < 45) return;
    lastMove = now;
    const p = pointerPayload(e.clientX, e.clientY);
    const k = `${p.kind}|${p.layerIndex}|${p.infoId}`;
    if (canvasEl) canvasEl.style.cursor = p.kind ? 'pointer' : '';
    if (!p.kind) { if (lastHoverKey !== '') { lastHoverKey = ''; onHover(null); } return; }
    lastHoverKey = k;
    onHover(p);
  }
  function onLeave() {
    if (canvasEl) canvasEl.style.cursor = '';
    if (lastHoverKey !== '') { lastHoverKey = ''; if (onHover) onHover(null); }
  }
  if (finePointer && canvasEl) {
    canvasEl.addEventListener('pointermove', onMove);
    canvasEl.addEventListener('pointerleave', onLeave);
  }

  const offTheme = stage.onTheme(() => {
    floorMat.opacity = floorOpacity();
    blobMat.opacity = blobOpacity();
    outlines.forEach((o) => { if (o) o.material.color.set(stage.theme.ink); });
    scaleMat.color.set(stage.theme.ink);
    applySelection();
  });
  const onCtlEnd = () => scheduleLabelsSoon();
  if (stage.controls) stage.controls.addEventListener('end', onCtlEnd);
  const ro = canvasEl && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => scheduleLabelsSoon()) : null;
  if (ro) ro.observe(canvasEl);

  function setSectionState(on) {
    const planes = on ? [clipPlane] : null;
    layerLooks.forEach((m) => m && m.forEach((k) => k.setSection(on, clipPlane)));
    dataMats.forEach((m) => {
      if (!m) return;
      m.side = on ? THREE.DoubleSide : THREE.FrontSide;
      m.clippingPlanes = planes; m.clipShadows = on;
      m.needsUpdate = true;
    });
    parts.forEach((p) => {
      const m = p.real && !Array.isArray(p.real) && !p.real.userData.look && p.real.isMaterial ? p.real : null;
      if (m) { m.side = on ? THREE.DoubleSide : THREE.FrontSide; m.clippingPlanes = planes; m.clipShadows = on; m.needsUpdate = true; }
    });
    [dewMat, haloMat, wetMat, dropMat].forEach((m) => { m.clippingPlanes = planes; m.needsUpdate = true; });
  }

  // ---------------------------------------------------------------------------------------------- test helper
  function clientOfWorld(v) { syncCam(); return worldToClient(stage, v); }
  function findVisible(cands, test) {
    for (const v of cands) {
      const c = clientOfWorld(v);
      if (!c.visible) continue;
      const hit = stage.pick(c.x, c.y, pickables());
      if (hit && test(hit)) return { x: c.x, y: c.y };
    }
    return null;
  }
  function screenPoint(kind, index = 0) {
    const an = cur.an;
    if (!an) return null;
    const gp = gap();
    if (kind === 'layer') {
      const i = index; const e = extents[i];
      if (!e) return null;
      const z = e.z1 + 0.3 + i * gp;
      const last = i === D.n - 1;
      const c = [];
      if (last) { for (let fy = 0.5; fy > 0.05; fy -= 0.15) for (let fx = 0.5; fx < 0.95; fx += 0.2) c.push(new THREE.Vector3(e.x0 + e.w * fx, e.h * fy, z)); }
      const sx = D.s;
      for (let fy = 0.9; fy > 0.04; fy -= 0.08) for (let fx = 0.3; fx < 1; fx += 0.2) c.push(new THREE.Vector3(e.x1 - sx * fx, e.h * fy, z));
      for (let fx = 0.9; fx > 0.04; fx -= 0.08) c.push(new THREE.Vector3(e.x0 + e.w * fx, e.h - sx * 0.4, z));
      return findVisible(c, (h) => h.object.userData.layerIndex === i);
    }
    if (kind === 'stud') {
      const fr = framing; if (!fr) return null;
      const st = fr.studs[Math.min(index, fr.studs.length - 1)]; const e = extents[fr.li];
      const z = e.z1 + 0.3 + fr.li * gp;
      const c = [];
      for (let y = fr.yt - 1; y > fr.yb; y -= 1.5) c.push(new THREE.Vector3((st[0] + st[1]) / 2, y, z));
      return findVisible(c, (h) => h.object.userData.stud === Math.min(index, fr.studs.length - 1));
    }
    if (kind === 'dew' || kind === 'dew_plane') {
      const dp = an.dewPlane; if (!dp) return null;
      const e = extents[dp.layerIndex];
      const z = dp.z + dp.layerIndex * gp;
      const c = [];
      for (let f = 0.5; f < 1; f += 0.05) c.push(new THREE.Vector3(e.x0 + e.w * f, e.h + 0.1, z));
      for (let f = 0.5; f > 0; f -= 0.05) c.push(new THREE.Vector3(e.x0 + e.w * f, e.h + 0.1, z));
      return findVisible(c, (h) => h.object.userData.kind === 'dew_plane');
    }
    if (kind === 'condensation') {
      if (!wetPatch.visible) return null;
      wetPatch.updateMatrixWorld(true);
      const c = [];
      [[0, 0], [0.2, 0.2], [-0.2, 0.1], [0, 0.3], [0, -0.3]].forEach(([u, v]) => c.push(new THREE.Vector3(u, v, 0.05).applyMatrix4(wetPatch.matrixWorld)));
      return findVisible(c, (h) => h.object.userData.kind === 'condensation');
    }
    if (kind === 'callout') {
      const c = allCallouts()[index];
      if (!c || !c.object.visible) return null;
      const rr = c.clientRect();
      return { x: (rr.left + rr.right) / 2, y: (rr.top + rr.bottom) / 2 };
    }
    return null;
  }

  const api = {
    /** an = analyzeWall result, climate = store climate. Rebuilds meshes only if structure changed. */
    update(an, climate) {
      cur = { an, climate };
      const k = structureKey(an);
      if (k !== builtKey) { builtKey = k; build(an); if (section) setSectionState(true); }
      tRange = [Math.min(climate.tIn, climate.tOut), Math.max(climate.tIn, climate.tOut)];
      paintData();
      layout();
      applySelection();
      setPulse(!!(an.risk && an.condensation));
    },
    setShow(v) { show = v; applyShow(); layout(); },
    setExplode(v) { explode = v; layout(); },
    setSection(on) {
      section = on;
      setSectionState(on);
      if (cur.an) layout();
      shadowDirty();
    },
    select(i) { sel = i; applySelection(); },
    onSelect(fn) { onSelect = fn; },
    onHover(fn) { onHover = fn; },
    setCallouts(on) { showCallouts = !!on; layout(); },
    setHoverLayer(i) { hov = i == null ? null : i; applyEmphasis(); },
    resetView() { fitView(); },
    _debug: { screenPoint, get callouts() { return allCallouts(); }, get dims() { return D; }, relayout: placeLabelsNow },
    dispose() {
      disposed = true;
      offTap(); offTheme(); setPulse(false);
      cancelAnimationFrame(labelRaf); clearTimeout(labelTimer);
      if (ro) ro.disconnect();
      if (stage.controls) stage.controls.removeEventListener('end', onCtlEnd);
      if (canvasEl) { canvasEl.removeEventListener('pointermove', onMove); canvasEl.removeEventListener('pointerleave', onLeave); canvasEl.style.cursor = ''; }
      if (R) R.domElement.removeEventListener('webglcontextrestored', onCtxRestored);
      clearParts();
      [dewCallout, condCallout].forEach((c) => c.dispose());
      [inMarker, outMarker, scaleMarker].forEach((m) => m.dispose());
      selMat.dispose();
      ribGeo.dispose(); dewMat.dispose(); haloMat.dispose();
      wetPatch.geometry.dispose(); wetMat.dispose(); wetTex.dispose(); dropGeo.dispose(); dropMat.dispose();
      scaleGeo.dispose(); scaleMat.dispose();
      floor.geometry.dispose(); floorMat.dispose(); blob.geometry.dispose(); blobMat.dispose(); blobTex.dispose(); bumpNoise.dispose();
      if (key) { key.castShadow = false; stage.scene.remove(key.target); }
      if (envRT) { stage.scene.environment = prevEnv; envRT.dispose(); }
      stage.camera.fov = prevFov; stage.camera.updateProjectionMatrix();
      stage.scene.remove(root);
    },
  };
  if (typeof location !== 'undefined' && /[?&]debug3d/.test(location.search)) window.__wall3d = api; // test hook, only with ?debug3d in the URL
  return api;
}
