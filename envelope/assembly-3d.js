// envelope/assembly-3d.js  3D stepped cutaway wall for the Assembly mode.
// 1 unit = 1 inch. x along the wall, y up, z through the wall (interior face at z = 0).
// Rebuild meshes only when the wall structure changes; colors, dew plane and
// condensation marker update cheaply through setAnalysis().

import { MATERIALS } from './materials.js';
import { tempToColor, makeLabelSprite } from '../shared/scene.js';

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

const TEX_KIND = { brick: 'brick', cmu8: 'cmu', fibercement: 'siding', vinyl: 'siding' };

/** Draw a tiling pattern canvas. Returns {canvas, tileW, tileH} where tile sizes are in inches. */
function patternCanvas(kind, base) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  if (kind === 'brick') {
    c.width = 256; c.height = 129; // 16" x 8": two bricks wide, three courses
    g.fillStyle = '#d9d0bf'; g.fillRect(0, 0, 256, 129);
    g.fillStyle = base;
    for (let r = 0; r < 3; r += 1) {
      const off = r % 2 ? 64 : 0;
      for (let k = -1; k < 3; k += 1) g.fillRect(off + k * 128 + 2, r * 43 + 2, 124, 39);
    }
    return { canvas: c, tileW: 16, tileH: 8 };
  }
  if (kind === 'cmu') {
    c.width = 256; c.height = 256; // 16" x 16": two courses
    g.fillStyle = '#c9c9c9'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = base;
    for (let r = 0; r < 2; r += 1) {
      const off = r ? 128 : 0;
      for (let k = -1; k < 3; k += 1) g.fillRect(off + k * 256 + 3, r * 128 + 3, 250, 122);
    }
    return { canvas: c, tileW: 32, tileH: 16 };
  }
  c.width = 16; c.height = 96; // siding: 6" lap
  g.fillStyle = base; g.fillRect(0, 0, 16, 96);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 90, 16, 6);
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 0, 16, 3);
  return { canvas: c, tileW: 0, tileH: 6 };
}

export function createWall3D(stage) {
  const { THREE } = stage;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = new THREE.Group();
  stage.scene.add(root);

  let parts = []; // {mesh, edges, mat, li, base, ctrl, tex, z0, z1}
  let groups = []; // per layer Group
  let labels = []; // per layer sprite
  let extents = []; // per layer {xmid, w, h}
  let cur = { an: null };
  let show = 'materials';
  let explode = 0;
  let sel = null;
  let section = false;
  let onSelect = null;
  let stopPulse = null;
  let lastMode = null;
  let tRange = [0, 70];

  // dew plane
  const dewMat = new THREE.MeshBasicMaterial({ color: '#3b8bff', transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  const dewMesh = new THREE.Mesh(new THREE.PlaneGeometry(W + 4, H + 4), dewMat);
  dewMesh.position.set(0, H / 2, 0);
  dewMesh.renderOrder = 5;
  const dewEdge = new THREE.LineSegments(new THREE.EdgesGeometry(dewMesh.geometry), new THREE.LineBasicMaterial({ color: '#3b8bff' }));
  dewMesh.add(dewEdge);
  const dewLabel = makeLabelSprite('Dew point', { height: 2.6, fontPx: 30, color: '#ffffff', bg: '#2a6fd8', border: '#2a6fd8' });
  dewLabel.position.set(-W / 2 + 7, H / 2 + 0.5, 0); // relative to the plane center
  dewMesh.add(dewLabel);
  dewLabel.raycast = () => {};
  root.add(dewMesh);
  dewMesh.raycast = () => {};
  dewEdge.raycast = () => {};

  // condensation marker
  const condGroup = new THREE.Group();
  const condMat = new THREE.MeshBasicMaterial({ color: '#ff2a1a', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, depthTest: false });
  const condPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), condMat);
  condPlane.renderOrder = 10;
  condPlane.raycast = () => {};
  condGroup.add(condPlane);
  const dropMat = new THREE.MeshStandardMaterial({ color: '#7cc4ff', emissive: '#2a6fd8', emissiveIntensity: 0.6, roughness: 0.2, depthTest: false });
  const dropGeo = new THREE.SphereGeometry(0.38, 12, 10);
  const DROPS = [[0.15, 0.82], [0.33, 0.55], [0.5, 0.78], [0.62, 0.4], [0.78, 0.7], [0.88, 0.3], [0.25, 0.25]];
  const drops = DROPS.map(() => { const m = new THREE.Mesh(dropGeo, dropMat); m.renderOrder = 11; m.raycast = () => {}; condGroup.add(m); return m; });
  condGroup.visible = false;
  root.add(condGroup);

  function gap() { return (6 * explode) / 100; }

  function clearParts() {
    for (const p of parts) {
      p.mesh.geometry.dispose(); p.edges.geometry.dispose(); p.edges.material.dispose();
      p.mat.dispose(); if (p.tex) p.tex.dispose();
    }
    for (const s of labels) { s.material.map.dispose(); s.material.dispose(); }
    for (const g of groups) root.remove(g);
    parts = []; groups = []; labels = []; extents = [];
  }

  function addPart(group, li, size, center, base, ctrl, o = {}) {
    const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const n = geo.attributes.position.count;
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    const mat = new THREE.MeshStandardMaterial({
      color: base, roughness: 0.82, metalness: 0.02, side: THREE.DoubleSide, vertexColors: true,
      transparent: !!o.opacity, opacity: o.opacity ?? 1, depthWrite: !o.opacity,
    });
    let tex = null;
    if (o.texKind) {
      const pc = patternCanvas(o.texKind, base);
      tex = new THREE.CanvasTexture(pc.canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(pc.tileW ? size[0] / pc.tileW : 1, size[1] / pc.tileH);
      tex.anisotropy = 4;
      mat.map = tex; mat.color.set('#ffffff');
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(center[0], center[1], center[2]);
    mesh.userData.layerIndex = li;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: stage.theme.ink, transparent: true, opacity: 0.85 }));
    edges.raycast = () => {};
    mesh.add(edges);
    group.add(mesh);
    parts.push({ mesh, edges, mat, li, base, ctrl, tex, z0: center[2] - size[2] / 2, z1: center[2] + size[2] / 2, mode: null });
  }

  function framed(group, li, L, w, h, xmid, zc, tz, batt) {
    const f = L.framing;
    const xmax = X0 + w;
    const wood = f.type === 'wood';
    const sw = wood ? 1.5 : 1.625;
    const base = wood ? MATERIALS.softwood.color : MATERIALS.steel.color;
    const ctrl = CONTROL_COLORS.structure;
    const studs = [];
    for (let s = X0; s < xmax - 0.2; s += f.spacing) studs.push([s, Math.min(s + sw, xmax)]);
    if (wood) {
      studs.forEach(([a, b]) => addPart(group, li, [b - a, h - 3, tz], [(a + b) / 2, h / 2, zc], base, ctrl));
      addPart(group, li, [w, 1.5, tz], [xmid, 0.75, zc], base, ctrl);
      addPart(group, li, [w, 1.5, tz], [xmid, h - 0.75, zc], base, ctrl);
    } else {
      const t = 0.12;
      const zf = tz / 2 - t / 2;
      studs.forEach(([a, b]) => {
        addPart(group, li, [t, h - 2 * t, tz], [a + t / 2, h / 2, zc], base, ctrl);
        addPart(group, li, [b - a, h - 2 * t, t], [(a + b) / 2, h / 2, zc - zf], base, ctrl);
        addPart(group, li, [b - a, h - 2 * t, t], [(a + b) / 2, h / 2, zc + zf], base, ctrl);
      });
      [0, 1].forEach((top) => {
        const yWeb = top ? h - t / 2 : t / 2;
        const yFl = top ? h - 0.625 : 0.625;
        addPart(group, li, [w, t, tz], [xmid, yWeb, zc], base, ctrl);
        addPart(group, li, [w, 1.25, t], [xmid, yFl, zc - zf], base, ctrl);
        addPart(group, li, [w, 1.25, t], [xmid, yFl, zc + zf], base, ctrl);
      });
    }
    // batt blocks between the studs, slightly inset
    const edgesX = [];
    studs.forEach(([a, b], k) => {
      const next = studs[k + 1] ? studs[k + 1][0] : xmax;
      edgesX.push([b, next]);
    });
    const yPad = wood ? 1.5 : 1.25;
    edgesX.forEach(([a, b]) => {
      const gx = b - a - 0.3;
      if (gx < 0.5) return;
      addPart(group, li, [gx, h - 2 * yPad - 0.2, tz - 0.4], [(a + b) / 2, h / 2, zc], batt.color, CONTROL_COLORS.thermal);
    });
  }

  function build(an) {
    clearParts();
    const n = an.layers.length;
    const step = n > 1 ? Math.min(3.5, 22 / (n - 1)) : 0;
    an.layers.forEach((L, i) => {
      const mat = MATERIALS[L.materialId];
      const w = W - step * i;
      const h = H - step * i;
      const xmid = X0 + w / 2;
      const zc = (L.zIn + L.zOut) / 2;
      const t = Math.max(L.thickness, MIN_T);
      const inset = t > 0.1 ? 0.015 : 0;
      const tz = t - 2 * inset;
      extents.push({ xmid, w, h });
      const g = new THREE.Group();
      g.userData.layerIndex = i;
      root.add(g);
      groups.push(g);
      const ctrl = CONTROL_COLORS[mat?.control] || CONTROL_COLORS.structure;
      if (L.framing && (L.framing.type === 'wood' || L.framing.type === 'steel')) {
        framed(g, i, L, w, h, xmid, zc, tz, mat);
      } else {
        const air = mat?.category === 'airspace';
        addPart(g, i, [w, h, tz], [xmid, h / 2, zc], mat?.color || '#999999', ctrl, { opacity: air ? 0.3 : 0, texKind: TEX_KIND[L.materialId] });
      }
      const name = (mat?.name || L.materialId).split(',')[0];
      const s = makeLabelSprite(name, { height: 2.6, fontPx: 30 });
      s.position.set(Math.min(X0 + w + 4, W / 2 - 2), h - 1.5, zc);
      s.visible = false;
      s.raycast = () => {};
      g.add(s);
      labels.push(s);
    });
    lastMode = null;
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
      drops.forEach((d, k) => d.position.set(X0 + DROPS[k][0] * e.w, DROPS[k][1] * e.h, 0.2));
    } else condGroup.visible = false;
    stage.requestRender();
  }

  function applyColors() {
    const an = cur.an;
    if (!an) return;
    const [tmin, tmax] = tRange;
    const modeChanged = lastMode !== show;
    for (const p of parts) {
      const L = an.layers[p.li];
      if (!L) continue;
      if (show === 'temp') {
        p.mat.color.set('#ffffff');
        if (p.mat.map) { p.mat.map = null; p.mat.needsUpdate = true; }
        const pos = p.mesh.geometry.attributes.position;
        const col = p.mesh.geometry.attributes.color;
        const span = L.zOut - L.zIn || 1;
        const cz = p.mesh.position.z;
        for (let v = 0; v < pos.count; v += 1) {
          const f = Math.min(1, Math.max(0, (cz + pos.getZ(v) - L.zIn) / span));
          const c = tempToColor(L.tIn + (L.tOut - L.tIn) * f, tmin, tmax);
          col.setXYZ(v, c.r, c.g, c.b);
        }
        col.needsUpdate = true;
      } else if (modeChanged) {
        const col = p.mesh.geometry.attributes.color;
        col.array.fill(1); col.needsUpdate = true;
        if (show === 'control') {
          p.mat.color.set(p.ctrl);
          if (p.mat.map) { p.mat.map = null; p.mat.needsUpdate = true; }
        } else if (p.tex) {
          p.mat.color.set('#ffffff'); p.mat.map = p.tex; p.mat.needsUpdate = true;
        } else p.mat.color.set(p.base);
      }
    }
    lastMode = show;
    stage.requestRender();
  }

  function applySelection() {
    for (const p of parts) {
      const on = p.li === sel;
      p.mat.emissive.set(on ? stage.theme.accent : '#000000');
      p.mat.emissiveIntensity = on ? 0.55 : 0;
      p.edges.material.color.set(on ? stage.theme.accent : stage.theme.ink);
      p.edges.material.opacity = on ? 1 : 0.85;
    }
    stage.requestRender();
  }

  function setPulse(on) {
    if (on && !reduce) {
      if (!stopPulse) {
        stopPulse = stage.onFrame((dt, t) => {
          condMat.opacity = 0.2 + 0.12 * Math.sin(t * 4);
          dropMat.emissiveIntensity = 0.5 + 0.3 * Math.sin(t * 4);
        });
      }
    } else {
      if (stopPulse) { stopPulse(); stopPulse = null; }
      condMat.opacity = 0.26;
    }
  }

  const offTap = stage.onTap((e) => {
    const hit = stage.pick(e.clientX, e.clientY, parts.map((p) => p.mesh));
    const li = hit ? hit.object.userData.layerIndex : null;
    if (onSelect) onSelect(li == null ? null : li);
  });
  const offTheme = stage.onTheme(() => applySelection());

  const api = {
    /** an = analyzeWall result, climate = store climate. Rebuilds meshes only if structure changed. */
    update(an, climate) {
      cur = { an };
      const key = structureKey(an);
      if (key !== builtKey) { builtKey = key; build(an); }
      tRange = [Math.min(climate.tIn, climate.tOut), Math.max(climate.tIn, climate.tOut)];
      applyColors();
      layout();
      applySelection();
      setPulse(!!(an.risk && an.condensation));
    },
    setShow(v) { show = v; applyColors(); },
    setExplode(v) { explode = v; layout(); },
    setSection(on) {
      section = on;
      stage.setClipping(on ? new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0) : null);
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
      clearParts();
      dewMesh.geometry.dispose(); dewMat.dispose(); dewEdge.geometry.dispose(); dewEdge.material.dispose();
      dewLabel.material.map.dispose(); dewLabel.material.dispose();
      condPlane.geometry.dispose(); condMat.dispose(); dropGeo.dispose(); dropMat.dispose();
      stage.scene.remove(root);
    },
  };
  return api;
}
