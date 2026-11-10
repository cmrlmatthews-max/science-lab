// envelope/assembly-3d.js  3D stepped cutaway wall for the Assembly mode, with realistic materials.
// 1 unit = 1 inch. x along the wall, y up, z through the wall (interior face at z = 0).
// Rebuild meshes only when the wall structure changes; colors, dew plane and
// condensation marker update cheaply through update().
//
// Materials view: PBR looks from material-look.js, real thickness detail (puffy batts, eased studs, C-shaped steel
// studs, lap siding boards, lapped housewrap), soft sunlight with shadows, image based fill light.
// Temperature and Control views: flat data colors (exactly on the tempToColor scale, no tone mapping) shaded only
// by shadow and facing so the layers still read as objects.

import * as THREE from 'three';
import { MATERIALS } from './materials.js';
import { tempToColor, makeLabelSprite } from '../shared/scene.js';
import { getLook } from './material-look.js';
import { LineSegments2 } from '../vendor/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from '../vendor/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from '../vendor/addons/lines/LineMaterial.js';
import { RoomEnvironment } from '../vendor/addons/RoomEnvironment.js';

const W = 48; // sample width, inches
const H = 36; // sample height, inches
const MIN_T = 0.15; // drawn minimum thickness for very thin layers
const X0 = -W / 2;

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

// ---------------------------------------------------------------------------------------------- the wall
export function createWall3D(stage) {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = window.matchMedia && window.matchMedia('(max-width: 899px)').matches;
  const R = stage.renderer;
  const root = new THREE.Group();
  stage.scene.add(root);

  let parts = []; // {mesh, li, real, ctrl, realOnly, edge}
  let groups = []; // per layer Group
  let labels = []; // per layer sprite
  let extents = []; // per layer {xmid, w, h, x0, x1, z0, z1}
  let layerLooks = []; // per layer Map(id -> look)
  let dataMats = []; // per layer data material
  let outlines = []; // per layer subtle outline (data views)
  let cur = { an: null };
  let show = 'materials';
  let explode = 0;
  let sel = null;
  let section = false;
  let onSelect = null;
  let stopPulse = null;
  let tRange = [0, 70];
  let totalDepth = 10;
  const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  const extraGeos = new Set(); // shared geometries / materials to dispose with the parts
  const extraMats = new Set();

  // ---- renderer, lights, environment, floor
  const bumpNoise = makeBumpNoise();
  const blobTex = makeBlobTexture();
  let envRT = null;
  let key = null;
  let hemi = null;
  let fill = null;
  const prevEnv = stage.scene.environment;
  if (R) {
    R.toneMapping = THREE.ACESFilmicToneMapping;
    R.toneMappingExposure = 0.88;
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
    stage.scene.environmentIntensity = 0.45;
  }
  stage.scene.traverse((o) => {
    if (o.isHemisphereLight) hemi = o;
    else if (o.isDirectionalLight) { if (!key) key = o; else if (!fill) fill = o; }
  });
  if (hemi) { hemi.intensity = 0.4; hemi.color.set('#f2f6ff'); hemi.groundColor.set('#a9a393'); }
  if (fill) { fill.intensity = 0.35; fill.position.set(160, 60, 120); fill.color.set('#fff3e2'); }
  if (key) {
    key.color.set('#fff6e8');
    key.intensity = 3.4;
    key.position.set(-98, 108, 104);
    key.target.position.set(0, 12, 8);
    stage.scene.add(key.target);
    key.castShadow = !!R;
    const s = key.shadow;
    const MS = narrow ? 1024 : 2048;
    s.mapSize.set(MS, MS);
    s.camera.left = -64; s.camera.right = 64; s.camera.top = 64; s.camera.bottom = -64;
    s.camera.near = 30; s.camera.far = 340;
    s.bias = -0.0003; s.normalBias = narrow ? 0.09 : 0.05;
    s.camera.updateProjectionMatrix();
  }
  const shadowDirty = () => { if (R) R.shadowMap.needsUpdate = true; stage.requestRender(); };
  const floorMat = new THREE.ShadowMaterial({ opacity: stage.theme.dark ? 0.5 : 0.22, color: 0x101216, depthWrite: false });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.05; floor.receiveShadow = true; floor.raycast = () => {};
  root.add(floor);
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: stage.theme.dark ? 0.6 : 0.5, depthWrite: false, toneMapped: false });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMat);
  blob.rotation.x = -Math.PI / 2; blob.position.y = -0.03; blob.raycast = () => {}; blob.renderOrder = -1;
  root.add(blob);
  const onCtxRestored = () => shadowDirty();
  if (R) R.domElement.addEventListener('webglcontextrestored', onCtxRestored);

  // ---- dew plane
  const dewMat = new THREE.MeshBasicMaterial({ color: '#3b8bff', transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const dewMesh = new THREE.Mesh(new THREE.PlaneGeometry(W + 4, H + 4), dewMat);
  dewMesh.position.set(0, H / 2, 0);
  dewMesh.renderOrder = 5;
  const dewEdge = new THREE.LineSegments(new THREE.EdgesGeometry(dewMesh.geometry), new THREE.LineBasicMaterial({ color: '#3b8bff', toneMapped: false }));
  dewMesh.add(dewEdge);
  const dewLabel = makeLabelSprite('Dew point', { height: 2.6, fontPx: 30, color: '#ffffff', bg: '#2a6fd8', border: '#2a6fd8' });
  dewLabel.material.toneMapped = false;
  dewLabel.position.set(-W / 2 + 7, H / 2 + 0.5, 0); // relative to the plane center
  dewMesh.add(dewLabel);
  dewLabel.raycast = () => {};
  root.add(dewMesh);
  dewMesh.raycast = () => {};
  dewEdge.raycast = () => {};

  // ---- condensation marker: red overlay and glossy beads
  const condGroup = new THREE.Group();
  const condMat = new THREE.MeshBasicMaterial({ color: '#ff2a1a', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, depthTest: false, toneMapped: false });
  const condPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), condMat);
  condPlane.renderOrder = 10;
  condPlane.raycast = () => {};
  condGroup.add(condPlane);
  const dropMat = new THREE.MeshStandardMaterial({
    color: '#a9d4ff', emissive: '#2a6fd8', emissiveIntensity: 0.3, roughness: 0.04, metalness: 0, envMapIntensity: 2.4, transparent: true, opacity: 0.94, depthTest: false,
  });
  const dropGeo = new THREE.SphereGeometry(0.38, 18, 14);
  const DROPS = [[0.15, 0.82], [0.33, 0.55], [0.5, 0.78], [0.62, 0.4], [0.78, 0.7], [0.88, 0.3], [0.25, 0.25]];
  const drops = DROPS.map((_, k) => {
    const m = new THREE.Mesh(dropGeo, dropMat);
    m.renderOrder = 11; m.raycast = () => {};
    const sc = 0.8 + 0.5 * ((k * 37) % 7) / 7;
    m.scale.set(sc, sc * 1.18, sc * 0.7);
    condGroup.add(m);
    return m;
  });
  condGroup.visible = false;
  root.add(condGroup);

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
    for (const s of labels) { s.material.map.dispose(); s.material.dispose(); }
    for (const g of groups) root.remove(g);
    if (selLine) { selLine.geometry.dispose(); selLine = null; }
    parts = []; groups = []; labels = []; extents = []; layerLooks = []; dataMats = []; outlines = [];
  }

  /**
   * Register a mesh for layer li. `real` is a look material or an array of them (matching the geometry groups).
   * Geometry is already in group coordinates (mesh at the origin).
   */
  function addPart(group, li, geo, real, ctrl, o = {}) {
    if (!geo.attributes.color) geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3));
    const mesh = o.instanced || new THREE.Mesh(geo, real);
    mesh.userData.layerIndex = li;
    mesh.castShadow = o.cast !== false;
    mesh.receiveShadow = o.receive !== false;
    group.add(mesh);
    parts.push({ mesh, li, real, ctrl, realOnly: !!o.realOnly, thin: !!o.thin });
    return mesh;
  }

  const mats = (li, id) => layerLook(li, id).material;

  // --- builders ------------------------------------------------------------------------------
  function buildSlab(g, li, id, ex, ctrl) {
    const geo = boxGeo(ex.w, ex.h, ex.tz, [ex.xmid, ex.h / 2, ex.zc]);
    addPart(g, li, geo, mats(li, id), ctrl);
  }
  function buildBoard(g, li, id, coreId, ex, ctrl, edgeFaces) {
    const geo = boxGeo(ex.w, ex.h, ex.tz, [ex.xmid, ex.h / 2, ex.zc], { mat: edgeFaces });
    addPart(g, li, geo, [mats(li, coreId), mats(li, id)], ctrl);
  }
  function buildAir(g, li, ex, ctrl) {
    const geo = boxGeo(ex.w, ex.h, ex.tz, [ex.xmid, ex.h / 2, ex.zc]);
    addPart(g, li, geo, mats(li, 'airspace'), ctrl, { cast: false, receive: false });
    // faint frame so the empty space still reads as a volume
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#b7cbd6', transparent: true, opacity: 0.55, toneMapped: false }));
    e.raycast = () => {};
    g.add(e);
    extraGeos.add(e.geometry); extraMats.add(e.material);
    parts.push({ mesh: e, li, real: null, ctrl, realOnly: true, frame: true });
  }
  function buildWrb(g, li, ex, ctrl) {
    const w = ex.w; const h = ex.h;
    const STRIP = 18; const STEP = 15;
    const tapeMat = new THREE.MeshStandardMaterial({ color: '#efece3', roughness: 0.5, metalness: 0, envMapIntensity: 0.6 });
    extraMats.add(tapeMat);
    for (let k = 0, y0 = 0; y0 < h - 0.4; k += 1, y0 += STEP) {
      const y1 = Math.min(y0 + STRIP, h);
      const z = ex.zc + k * 0.012 - 0.01;
      const geo = boxGeo(w, y1 - y0, 0.05, [ex.xmid, (y0 + y1) / 2, z], { uv0: [k * 7.3, k * 3.1] });
      addPart(g, li, geo, mats(li, 'wrb'), ctrl);
      if (k > 0) {
        const tg = boxGeo(w, 1.5, 0.02, [ex.xmid, y0, z + 0.035]);
        addPart(g, li, tg, tapeMat, ctrl, { realOnly: true, cast: false });
      }
    }
    // cap fasteners
    const xs = []; const ys = [];
    for (let x = X0 + 6; x < X0 + w - 2; x += 16) xs.push(x);
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
      ys.forEach((y, r) => xs.forEach((x) => { m4.makeTranslation(x + (r % 2 ? 8 : 0), y, ex.zc + 0.045 + (y > 15 ? 0.012 : 0)); im.setMatrixAt(q, m4); q += 1; }));
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
      const zBot = zOut + 0.2;
      const zTop = zBot - (zBot - zIn - 0.04) * ((y1 - y0) / BH);
      const prof = [[y0, zIn], [y0, zBot], [y1, zTop], [y1, zIn]];
      const geo = prismGeo(prof, ex.x0, ex.x1, [(k * 5.7) % 12, (k * 3.3) % 12]);
      addPart(g, li, geo, look, ctrl);
    }
  }
  function buildFramed(g, li, L, ex, mat, ctrl) {
    const f = L.framing;
    const { w, h, xmid, zc, tz } = ex;
    const xmax = X0 + w;
    const wood = f.type === 'wood';
    const sw = wood ? 1.5 : 1.625;
    const sCtrl = CONTROL_COLORS.structure;
    const studs = [];
    for (let s = X0; s < xmax - 0.2; s += f.spacing) studs.push([s, Math.min(s + sw, xmax)]);
    const last = studs[studs.length - 1];
    if (xmax - last[1] > 3) studs.push([xmax - sw, xmax]);
    const rnd = (a) => (Math.sin(a * 91.7 + 3.1) * 43758.5453) % 1;
    let yb; let yt; // clear bay range
    if (wood) {
      const side = mats(li, 'softwood'); const end = mats(li, 'woodend');
      const pl = 1.5;
      yb = pl; yt = h - 2 * pl;
      studs.forEach(([a, b], k) => {
        const geo = extr(rectShape(0, -(zc + tz / 2), b - a, -(zc - tz / 2)), yt - yb, 0.06);
        geo.rotateX(-Math.PI / 2); geo.translate(a, yb, 0);
        shiftUV(geo, Math.abs(rnd(k + 1)) * 9, Math.abs(rnd(k + 5)) * 9);
        addPart(g, li, geo, [end, side], sCtrl);
      });
      [[0, 0], [h - 2 * pl, 1], [h - pl, 2]].forEach(([y0, k]) => {
        const geo = extr(rectShape(-(zc + tz / 2), y0, -(zc - tz / 2), y0 + pl), w, 0.06);
        geo.rotateY(Math.PI / 2); geo.translate(X0, 0, 0);
        shiftUV(geo, Math.abs(rnd(k + 11)) * 9, Math.abs(rnd(k + 17)) * 9);
        addPart(g, li, geo, [end, side], sCtrl);
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
        shiftUV(geo, Math.abs(rnd(k + 3)) * 9, Math.abs(rnd(k + 8)) * 9);
        addPart(g, li, geo, steel, sCtrl);
      });
      [0, 1].forEach((top) => {
        const D = tz;
        const pts = [[-(z0 - t), 0], [-(z1 + t), 0], [-(z1 + t), 1.25], [-z1, 1.25], [-z1, t], [-z0, t], [-z0, 1.25], [-(z0 - t), 1.25]];
        const geo = extr(polyShape(pts), w, 0);
        geo.rotateY(Math.PI / 2); geo.translate(X0, 0, 0);
        if (top) { geo.translate(-xmid, -h / 2, 0); geo.rotateZ(Math.PI); geo.translate(xmid, h / 2, 0); }
        addPart(g, li, geo, steel, sCtrl);
        return D;
      });
    }
    // batts between the studs: slightly inset, with a puffy exterior face
    const bays = [];
    studs.forEach(([, b], k) => { bays.push([b, studs[k + 1] ? studs[k + 1][0] : xmax]); });
    const battLook = mats(li, L.materialId);
    bays.forEach(([a, b], k) => {
      const gx = b - a - 0.25;
      if (gx < 0.6) return;
      const tb = tz - 0.45;
      const geo = boxGeo(gx, yt - yb - 0.2, tb, [(a + b) / 2, (yb + yt) / 2, zc - 0.075], {
        seg: [Math.max(3, Math.round(gx / 1.2)), 16], puff: { pz: 0.32, nz: 0.12 }, uv0: [k * 5.1, k * 2.7],
      });
      addPart(g, li, geo, battLook, CONTROL_COLORS.thermal);
    });
  }

  function build(an) {
    clearParts();
    const n = an.layers.length;
    const step = n > 1 ? Math.min(3.5, 22 / (n - 1)) : 0;
    totalDepth = an.totalThickness || 10;
    an.layers.forEach((L, i) => {
      const mat = MATERIALS[L.materialId];
      const w = W - step * i;
      const h = H - step * i;
      const xmid = X0 + w / 2;
      const zc = (L.zIn + L.zOut) / 2;
      const t = Math.max(L.thickness, MIN_T);
      const inset = t > 0.1 ? 0.015 : 0;
      const tz = t - 2 * inset;
      const ex = { w, h, xmid, zc, tz, x0: X0, x1: X0 + w };
      extents.push({ xmid, w, h, x0: X0, x1: X0 + w, z0: zc - t / 2, z1: zc + t / 2 });
      const g = new THREE.Group();
      g.userData.layerIndex = i;
      root.add(g);
      groups.push(g);
      const ctrl = CONTROL_COLORS[mat?.control] || CONTROL_COLORS.structure;
      const id = L.materialId;
      if (L.framing && (L.framing.type === 'wood' || L.framing.type === 'steel')) buildFramed(g, i, L, ex, mat, ctrl);
      else if (mat?.category === 'airspace') buildAir(g, i, ex, ctrl);
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

      const name = (mat?.name || id).split(',')[0];
      const s = makeLabelSprite(name, { height: 2.6, fontPx: 30 });
      s.material.toneMapped = false;
      s.position.set(Math.min(X0 + w + 4, W / 2 - 2), h - 1.5, zc);
      s.visible = false;
      s.raycast = () => {};
      g.add(s);
      labels.push(s);
    });
    // ground contact shadow follows the footprint
    blob.scale.set(W + 26, totalDepth + 34, 1);
    blob.position.z = totalDepth / 2;
    applyShow();
  }

  function structureKey(an) {
    return JSON.stringify(an.layers.map((l) => [l.materialId, l.thickness, l.framing && [l.framing.type, l.framing.spacing, l.framing.depth]]));
  }
  let builtKey = '';

  function layout() {
    const gp = gap();
    groups.forEach((g, i) => { g.position.z = i * gp; });
    labels.forEach((s) => { s.visible = explode > 25; });
    const an = cur.an;
    if (!an) return;
    if (an.dewPlane) {
      dewMesh.visible = true;
      dewMesh.position.z = an.dewPlane.z + an.dewPlane.layerIndex * gp;
    } else dewMesh.visible = false;
    if (an.risk && an.condensation) {
      const c = an.condensation;
      const li = an.season === 'winter' ? Math.min(c.faceIndex, an.layers.length - 1) : Math.max(c.faceIndex - 1, 0);
      const e = extents[li];
      condGroup.visible = true;
      condGroup.position.set(0, 0, c.z + li * gp);
      condPlane.scale.set(e.w, e.h, 1);
      condPlane.position.set(e.xmid, e.h / 2, 0);
      drops.forEach((d, k) => d.position.set(X0 + DROPS[k][0] * e.w, DROPS[k][1] * e.h, 0.25));
    } else condGroup.visible = false;
    shadowDirty();
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
    // lights: the data views keep the same rig (shade is normalised in the shader)
    paintData();
    shadowDirty();
  }

  function applySelection() {
    const acc = new THREE.Color(stage.theme.accent);
    const setEm = (m, on) => {
      m.emissive.copy(on ? acc : new THREE.Color(0x000000));
      m.emissiveIntensity = on ? 0.32 : 0;
    };
    layerLooks.forEach((m, li) => m && m.forEach((k) => setEm(k.material, li === sel)));
    dataMats.forEach((m, li) => { if (m) { m.emissive.copy(li === sel ? acc : new THREE.Color(0)); m.emissiveIntensity = li === sel ? 0.4 : 0; } });
    // extra part materials (tape, caps) follow the same rule
    parts.forEach((p) => {
      const m = p.real && !Array.isArray(p.real) && p.real.emissive && !p.real.userData.look ? p.real : null;
      if (m) setEm(m, p.li === sel);
    });
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
    stage.requestRender();
  }

  function setPulse(on) {
    if (on && !reduce) {
      if (!stopPulse) {
        stopPulse = stage.onFrame((dt, t) => {
          condMat.opacity = 0.2 + 0.12 * Math.sin(t * 4);
          dropMat.emissiveIntensity = 0.3 + 0.25 * Math.sin(t * 4);
        });
      }
    } else {
      if (stopPulse) { stopPulse(); stopPulse = null; }
      condMat.opacity = 0.26;
      dropMat.emissiveIntensity = 0.3;
    }
  }

  const offTap = stage.onTap((e) => {
    const hit = stage.pick(e.clientX, e.clientY, parts.map((p) => p.mesh));
    const li = hit ? hit.object.userData.layerIndex : null;
    if (onSelect) onSelect(li == null ? null : li);
  });
  const offTheme = stage.onTheme(() => {
    floorMat.opacity = stage.theme.dark ? 0.5 : 0.22;
    blobMat.opacity = stage.theme.dark ? 0.6 : 0.5;
    outlines.forEach((o) => { if (o) o.material.color.set(stage.theme.ink); });
    applySelection();
  });

  function setSectionState(on) {
    layerLooks.forEach((m) => m && m.forEach((k) => k.setSection(on, clipPlane)));
    dataMats.forEach((m) => {
      if (!m) return;
      m.side = on ? THREE.DoubleSide : THREE.FrontSide;
      m.clippingPlanes = on ? [clipPlane] : null; m.clipShadows = on;
      m.needsUpdate = true;
    });
    parts.forEach((p) => {
      const m = p.real && !Array.isArray(p.real) && !p.real.userData.look && p.real.isMaterial ? p.real : null;
      if (m) { m.side = on ? THREE.DoubleSide : THREE.FrontSide; m.clippingPlanes = on ? [clipPlane] : null; m.clipShadows = on; m.needsUpdate = true; }
    });
  }

  const api = {
    /** an = analyzeWall result, climate = store climate. Rebuilds meshes only if structure changed. */
    update(an, climate) {
      cur = { an };
      const k = structureKey(an);
      if (k !== builtKey) { builtKey = k; build(an); if (section) setSectionState(true); }
      tRange = [Math.min(climate.tIn, climate.tOut), Math.max(climate.tIn, climate.tOut)];
      paintData();
      layout();
      applySelection();
      setPulse(!!(an.risk && an.condensation));
    },
    setShow(v) { show = v; applyShow(); },
    setExplode(v) { explode = v; layout(); },
    setSection(on) {
      section = on;
      setSectionState(on);
      stage.setClipping(on ? clipPlane : null);
      shadowDirty();
    },
    select(i) { sel = i; applySelection(); },
    onSelect(fn) { onSelect = fn; },
    resetView() {
      const total = cur.an ? cur.an.totalThickness : 10;
      stage.frame(new THREE.Box3(new THREE.Vector3(X0, 0, 0), new THREE.Vector3(W / 2, H, total)), { padding: 1.0 });
    },
    dispose() {
      offTap(); offTheme(); setPulse(false);
      if (section) stage.setClipping(null);
      if (R) R.domElement.removeEventListener('webglcontextrestored', onCtxRestored);
      clearParts();
      selMat.dispose();
      dewMesh.geometry.dispose(); dewMat.dispose(); dewEdge.geometry.dispose(); dewEdge.material.dispose();
      dewLabel.material.map.dispose(); dewLabel.material.dispose();
      condPlane.geometry.dispose(); condMat.dispose(); dropGeo.dispose(); dropMat.dispose();
      floor.geometry.dispose(); floorMat.dispose(); blob.geometry.dispose(); blobMat.dispose(); blobTex.dispose(); bumpNoise.dispose();
      if (key) { key.castShadow = false; stage.scene.remove(key.target); }
      if (envRT) { stage.scene.environment = prevEnv; envRT.dispose(); }
      stage.scene.remove(root);
    },
  };
  return api;
}
