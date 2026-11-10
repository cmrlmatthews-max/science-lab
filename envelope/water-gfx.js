// envelope/water-gfx.js  Shared 3D toolkit for Water mode: soft daylight, realistic materials and geometry helpers.
// 1 unit = 1 inch. x along the wall, y up, z through the wall (room at low z, outside at high z).
// Matches the Assembly wall: ACES tone mapping, soft shadows, a neutral floor that only receives shadow.
// Texture coordinates are measured in inches from world position, so patterns keep their real size and neighbours line up.

import * as THREE from 'three';
import { getLook } from './material-look.js';
import { RoomEnvironment } from '../vendor/addons/RoomEnvironment.js';

// ---------------------------------------------------------------------------------------------- uv in inches
const _n = new THREE.Vector3();
/**
 * Rewrite the uv of a geometry from its world positions and face normals (planar projection, inches).
 * o.du / o.dv: offset in inches. o.grain 'x': swap u and v on faces that face +/-z and +/-x so the grain runs along x.
 */
export function inchUV(geo, o = {}) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  if (!nor) geo.computeVertexNormals();
  const nn = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const du = o.du || 0; const dv = o.dv || 0;
  const gx = o.grain === 'x';
  for (let i = 0; i < pos.count; i += 1) {
    _n.set(nn.getX(i), nn.getY(i), nn.getZ(i));
    const ax = Math.abs(_n.x); const ay = Math.abs(_n.y); const az = Math.abs(_n.z);
    const x = pos.getX(i); const y = pos.getY(i); const z = pos.getZ(i);
    let u; let v;
    if (az >= ax && az >= ay) { u = x; v = y; if (gx) { u = y; v = x; } } else if (ax >= ay) { u = z; v = y; if (gx) { u = y; v = z; } } else { u = x; v = z; }
    uv[i * 2] = u + du; uv[i * 2 + 1] = v + dv;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** Sutherland-Hodgman clip of a polygon [[x,y]...] against the half plane a*x + b*y >= c. */
export function clipHalf(poly, a, b, c) {
  const out = [];
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i]; const q = poly[(i + 1) % poly.length];
    const dp = a * p[0] + b * p[1] - c; const dq = a * q[0] + b * q[1] - c;
    if (dp >= 0) out.push(p);
    if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- gfx
export function createGfx(stage) {
  const T = THREE;
  const R = stage.renderer;
  const theme = stage.theme;
  const looks = [];
  const mats = new Map();
  const variants = new Map();
  const geoCache = new Map();
  let envRT = null;
  let key = null; let hemi = null; let fill = null;
  let disposed = false;

  // ---- renderer, light, environment
  if (R) {
    R.toneMapping = T.ACESFilmicToneMapping;
    R.toneMappingExposure = theme.dark ? 0.96 : 0.9;
    R.outputColorSpace = T.SRGBColorSpace;
    R.shadowMap.enabled = true;
    R.shadowMap.type = T.PCFSoftShadowMap;
    R.shadowMap.autoUpdate = false;
    const pm = new T.PMREMGenerator(R);
    const room = new RoomEnvironment();
    envRT = pm.fromScene(room, 0.04);
    room.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    pm.dispose();
    stage.scene.environment = envRT.texture;
    stage.scene.environmentIntensity = theme.dark ? 0.55 : 0.5;
  }
  stage.scene.traverse((o) => {
    if (o.isHemisphereLight) hemi = o;
    else if (o.isDirectionalLight) { if (!key) key = o; else if (!fill) fill = o; }
  });
  if (hemi) { hemi.intensity = theme.dark ? 0.5 : 0.42; hemi.color.set('#f2f6ff'); hemi.groundColor.set('#a9a393'); }
  if (fill) { fill.intensity = 0.34; fill.color.set('#fff3e2'); }
  if (key) { key.color.set('#fff6e8'); key.intensity = 3.3; key.castShadow = !!R; stage.scene.add(key.target); }
  const floorMat = new T.ShadowMaterial({ opacity: theme.dark ? 0.5 : 0.24, color: 0x101216, depthWrite: false });
  const floor = new T.Mesh(new T.PlaneGeometry(900, 900), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.raycast = () => {};
  stage.scene.add(floor);
  const _c = new T.Vector3();
  const _s = new T.Sphere();
  /** Fit the sun and its shadow to a Box3 and drop the floor under it. dir: where the light comes from. */
  function fitLight(box, dir = [-0.55, 0.7, 0.75], floorY = null) {
    box.getBoundingSphere(_s);
    _c.copy(_s.center);
    const r = _s.radius * 1.08;
    if (key) {
      _c.set(_s.center.x, _s.center.y, _s.center.z);
      const d = new T.Vector3(...dir).normalize();
      key.position.copy(_c).addScaledVector(d, r * 3);
      key.target.position.copy(_c);
      const s = key.shadow;
      const MS = stage.camera && window.matchMedia('(max-width: 899px)').matches ? 1024 : 2048;
      s.mapSize.set(MS, MS);
      s.camera.left = -r; s.camera.right = r; s.camera.top = r; s.camera.bottom = -r;
      s.camera.near = r * 0.4; s.camera.far = r * 6;
      s.bias = -0.0003; s.normalBias = 0.04 * Math.max(1, r / 40);
      s.camera.updateProjectionMatrix();
      key.target.updateMatrixWorld();
      if (s.map) { s.map.dispose(); s.map = null; }
    }
    floor.position.y = floorY == null ? box.min.y - 0.05 : floorY;
    floor.position.x = _s.center.x; floor.position.z = _s.center.z;
    shadowDirty();
  }
  function shadowDirty() { if (R) R.shadowMap.needsUpdate = true; stage.requestRender(); }

  // ---- looks and materials
  function look(id, o = {}) {
    const l = getLook(id, { onUpdate: () => stage.requestRender(), ...o });
    looks.push(l);
    return l.material;
  }
  function std(o) {
    const m = new T.MeshStandardMaterial(o);
    return m;
  }
  const FACTORY = {
    brick: () => look('brick'),
    cmu8: () => look('cmu8'),
    concrete: () => look('concrete'),
    osb: () => look('osb'),
    plywood: () => look('plywood'),
    softwood: () => look('softwood'),
    gyp_sheath: () => look('gyp_sheath'),
    gyp_050: () => look('gyp_050'),
    gyp_063: () => look('gyp_063'),
    minwool: () => look('minwool'),
    xps: () => look('xps'),
    eps: () => look('eps'),
    polyiso: () => look('polyiso'),
    batt_r13: () => look('batt_r13'),
    batt_r19: () => look('batt_r19'),
    batt_r21: () => look('batt_r21'),
    ccspf: () => look('ccspf'),
    fibercement: () => look('fibercement'),
    vinyl: () => look('vinyl'),
    steel: () => look('steel'),
    aluminum: () => look('aluminum'),
    stucco: () => look('stucco'),
    eifs: () => { const m = look('stucco'); m.color.set('#f1ebdd'); m.roughness = 0.92; m.bumpScale = 0.7; return m; },
    // housewrap: white, printed, sheet thin enough to be seen from both sides
    wrb: () => { const m = look('wrb'); m.side = T.DoubleSide; m.roughness = 0.62; return m; },
    // seam tape on housewrap: bright foil
    tape: () => std({ color: '#d9dde1', metalness: 0.55, roughness: 0.34, envMapIntensity: 1.2, side: T.DoubleSide }),
    // sheet metal
    galv: () => std({ color: '#b3bbc3', metalness: 0.88, roughness: 0.34, envMapIntensity: 1.25, side: T.DoubleSide }),
    bronze: () => std({ color: '#5a4636', metalness: 0.78, roughness: 0.38, envMapIntensity: 1.1, side: T.DoubleSide }),
    // self-adhered membrane, dark and slightly glossy
    membrane: () => std({ color: '#2b2e33', metalness: 0, roughness: 0.52, side: T.DoubleSide }),
    sealant: () => std({ color: '#3a3c40', metalness: 0, roughness: 0.4 }),
    // window
    frame: () => std({ color: '#2d3034', metalness: 0.55, roughness: 0.42, envMapIntensity: 1 }),
    glass: () => std({
      color: '#cfe6f1', metalness: 0.0, roughness: 0.03, envMapIntensity: 2.0, transparent: true, opacity: 0.26, depthWrite: false, side: T.DoubleSide,
    }),
    vent: () => std({ color: '#24262a', metalness: 0, roughness: 0.55 }),
    ventSlat: () => std({ color: '#43464b', metalness: 0.1, roughness: 0.5 }),
    tie: () => std({ color: '#9aa3ab', metalness: 0.85, roughness: 0.45, envMapIntensity: 1.1 }),
    mortar: () => std({ color: '#a9a69d', metalness: 0, roughness: 0.95 }),
    mat: () => std({ color: '#e1b04a', metalness: 0, roughness: 0.7 }),
    pvc: () => std({ color: '#e9ebee', metalness: 0, roughness: 0.5 }),
    crack: () => std({ color: '#0e0f11', metalness: 0, roughness: 0.9 }),
    gray: () => std({ color: '#9a9ea4', metalness: 0, roughness: 0.8 }),
    air: () => std({
      color: '#cfe6ef', metalness: 0, roughness: 0.05, transparent: true, opacity: 0.1, depthWrite: false, side: T.DoubleSide, envMapIntensity: 1.4,
    }),
  };
  /** Shared material by key. Looks load photo textures lazily and redraw when they arrive. */
  function M(k) {
    let m = mats.get(k);
    if (!m) {
      const f = FACTORY[k];
      if (!f) throw new Error(`Unknown material ${k}`);
      m = f();
      m.userData.key = k;
      mats.set(k, m);
    }
    return m;
  }
  /**
   * A variant of a shared material: desaturate (0 = gray, 1 = as is) and/or glow with an emissive color.
   * Cached by its parameters.
   */
  function variant(k, o = {}) {
    const id = `${k}|${o.sat == null ? 1 : o.sat}|${o.glow || ''}|${o.glowK || 0}|${o.dim || 1}`;
    let m = variants.get(id);
    if (m) return m;
    m = M(k).clone();
    m.userData.key = k;
    const sat = o.sat == null ? 1 : o.sat;
    const dim = o.dim == null ? 1 : o.dim;
    if (sat < 1 || dim < 1) {
      const u = { uSat: { value: sat }, uDim: { value: dim } };
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uSat = u.uSat; sh.uniforms.uDim = u.uDim;
        sh.fragmentShader = sh.fragmentShader
          .replace('void main() {', 'uniform float uSat;\nuniform float uDim;\nvoid main() {')
          .replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), diffuseColor.rgb, uSat) * uDim;');
      };
      m.customProgramCacheKey = () => `watersat${sat}${dim}`;
    }
    if (o.glow) { m.emissive = new T.Color(o.glow); m.emissiveIntensity = o.glowK || 0.4; }
    variants.set(id, m);
    return m;
  }

  // ---- geometry helpers: each adds a mesh to `g`
  function finish(g, geo, mat, o = {}) {
    const m = new T.Mesh(geo, mat);
    m.castShadow = o.cast !== false && !mat.transparent;
    m.receiveShadow = o.receive !== false && !mat.transparent;
    if (o.id) m.userData.infoId = o.id;
    if (o.name) m.name = o.name;
    if (o.order != null) m.renderOrder = o.order;
    g.add(m);
    return m;
  }
  /** Axis aligned box [x0,x1,y0,y1,z0,z1]. */
  function box(g, b, mat, o = {}) {
    const [x0, x1, y0, y1, z0, z1] = b;
    const geo = new T.BoxGeometry(Math.max(1e-3, x1 - x0), Math.max(1e-3, y1 - y0), Math.max(1e-3, z1 - z0));
    geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    inchUV(geo, o);
    return finish(g, geo, mat, o);
  }
  /** Polygon [[x,y]...] with optional holes ([[x,y]...] each), extruded from z0 to z1. */
  function slab(g, poly, z0, z1, mat, o = {}) {
    const sh = new T.Shape();
    poly.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
    sh.closePath();
    (o.holes || []).forEach((h) => {
      const p = new T.Path();
      h.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])));
      p.closePath();
      sh.holes.push(p);
    });
    const geo = new T.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, z0);
    inchUV(geo, o);
    return finish(g, geo, mat, o);
  }
  /** Polygon in (u = z, v = y) extruded along x from x0 to x1 (a profile seen from the side). */
  function prism(g, pts, x0, x1, mat, o = {}) {
    const sh = new T.Shape();
    pts.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
    sh.closePath();
    const geo = new T.ExtrudeGeometry(sh, { depth: x1 - x0, bevelEnabled: false, curveSegments: 1 });
    // shape x -> z, shape y -> y, extrusion z -> x
    geo.rotateY(-Math.PI / 2);
    geo.translate(x1, 0, 0);
    inchUV(geo, o);
    return finish(g, geo, mat, o);
  }
  /**
   * A bent sheet (flashing) from a (y, z) polyline, spanning x0..x1, thickness th. Corners are mitered by overlap.
   */
  function ribbon(g, pts, x0, x1, th, mat, o = {}) {
    const grp = new T.Group();
    if (o.id) grp.userData.infoId = o.id;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const [ya, za] = pts[i]; const [yb, zb] = pts[i + 1];
      const len = Math.hypot(yb - ya, zb - za);
      if (len < 1e-4) continue;
      const geo = new T.BoxGeometry(x1 - x0, th, len + th * 0.9);
      const m = new T.Mesh(geo, mat);
      m.position.set((x0 + x1) / 2, (ya + yb) / 2, (za + zb) / 2);
      // box local +z runs along the segment: rotate about x so +z points along (dy, dz)
      m.rotation.x = Math.atan2(-(yb - ya), (zb - za));
      m.castShadow = true; m.receiveShadow = true;
      grp.add(m);
    }
    g.add(grp);
    return grp;
  }
  function cachedGeo(name, make) {
    let g = geoCache.get(name);
    if (!g) { g = make(); geoCache.set(name, g); }
    return g;
  }
  function disposeTree(root) {
    root.traverse((o) => {
      if (o.geometry && !o.userData.keepGeo && !geoCacheHas(o.geometry) && o.geometry.dispose) o.geometry.dispose();
    });
  }
  const geoCacheHas = (geo) => { for (const v of geoCache.values()) if (v === geo) return true; return false; };

  function dispose() {
    if (disposed) return;
    disposed = true;
    mats.forEach((m) => m.dispose());
    variants.forEach((m) => m.dispose());
    looks.forEach((l) => { try { l.dispose(); } catch (e) { /* ignore */ } });
    geoCache.forEach((g) => g.dispose());
    floor.geometry.dispose(); floorMat.dispose();
    stage.scene.remove(floor);
    if (envRT) { envRT.dispose(); stage.scene.environment = null; }
  }

  return {
    T, M, variant, box, slab, prism, ribbon, finish, cachedGeo, disposeTree, fitLight, shadowDirty, dispose, floor, key,
  };
}
