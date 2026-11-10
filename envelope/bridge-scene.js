// envelope/bridge-scene.js  3D side-by-side mock-ups for the Thermal Bridge mode (Envelope Lab).
// Two true-to-scale details (the problem and the better version) built from real parts, both cut open, with the
// solved temperature field drawn on the cut face, heat-flow arrows, names on every part and a coldest-surface marker.
//
// Scene axes (1 unit = 1 inch): x along the wall, y up, z through the wall; interior face at z = 0, exterior at +z.
// Parts are built by envelope/bridge-model.js, arrows by envelope/bridge-flow.js, callouts by envelope/labels3d.js.
//
// Camera moves only in frame() (mount, detail change, layout change, reset). Hover, select and toggles never move it.

import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/addons/RoomEnvironment.js';
import { tempToCss } from '../shared/scene.js';
import { createCallout, createSideMarker, pickCallout, worldToClient } from './labels3d.js';
import { createLookBank } from './bridge-parts.js';
import { buildModel, boundarySegments, PLAN_H, LX, S_IN, S_OUT } from './bridge-model.js';
import { createArrows } from './bridge-flow.js';

const EPS_FACE = 0.05;
const EPS_LINE = 0.09;
const EPS_IFACE = 0.05;
const GAP_PLAN = 14;
const GAP_SECTION = 9;
const SEC_DIR = new THREE.Vector3(-1, 0.5, -0.14);

const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

function disposeObject(o) {
  o.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    const ms = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : [];
    ms.forEach((m) => { if (m.map && m.map.userData && m.map.userData.own) m.map.dispose(); m.dispose(); });
  });
}

function canvasTexture(w, h, linear = true) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  t.generateMipmaps = false;
  t.minFilter = linear ? THREE.LinearFilter : THREE.NearestFilter;
  t.magFilter = linear ? THREE.LinearFilter : THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.userData.own = true;
  return t;
}

function makeColorizer(lo, hi) {
  const cache = new Map();
  return (t) => {
    const key = Math.round(t * 4);
    let rgb = cache.get(key);
    if (!rgb) {
      const m = /(\d+), (\d+), (\d+)/.exec(tempToCss(key / 4, lo, hi));
      rgb = [+m[1], +m[2], +m[3]];
      cache.set(key, rgb);
    }
    return rgb;
  };
}

function quad(p00, p10, p01, p11, uv) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...p00.toArray(), ...p10.toArray(), ...p01.toArray(), ...p11.toArray()], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv || [0, 0, 1, 0, 0, 1, 1, 1], 2));
  g.setIndex([0, 1, 2, 1, 3, 2]);
  return g;
}

/**
 * @param {object} stage from createStage()
 * @param {HTMLElement} stageEl element that holds the canvas (overlays are added to it)
 */
export function createBridgeScene(stage, stageEl) {
  const R = stage.renderer;
  const root = new THREE.Group();
  stage.scene.add(root);
  const bank = createLookBank(() => stage.requestRender());
  const sides = [null, null];

  const st = {
    detailId: null,
    show: 'heat',
    arrows: true,
    labels: true,
    single: null,         // null = both, 0 or 1 = only that side (phone)
    climate: null,
    results: [null, null],
    titles: ['', ''],
    hoverInfo: null,      // { side, infoId }
    userMoved: false,
    stopArrows: null,
    t0: performance.now(),
    framedFor: '',
    gapPlan: GAP_PLAN,
    gapSec: GAP_SECTION,
  };

  // ---------------------------------------------------------------- lighting like the Assembly wall
  const prevEnv = stage.scene.environment;
  let envRT = null; let key = null; let hemi = null; let fill = null;
  if (R) {
    R.toneMapping = THREE.ACESFilmicToneMapping;
    R.toneMappingExposure = 0.9;
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
  if (hemi) { hemi.intensity = 0.45; hemi.color.set('#f2f6ff'); hemi.groundColor.set('#a9a393'); }
  if (fill) { fill.intensity = 0.4; fill.color.set('#fff3e2'); }
  if (key) {
    key.color.set('#fff6e8');
    key.intensity = 3.0;
    key.castShadow = !!R;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.05;
    stage.scene.add(key.target);
  }
  const shadowDirty = () => { if (R) R.shadowMap.needsUpdate = true; stage.requestRender(); };
  const floorMat = new THREE.ShadowMaterial({ opacity: stage.theme.dark ? 0.5 : 0.2, color: 0x101216, depthWrite: false });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.05; floor.receiveShadow = true; floor.raycast = () => {};
  root.add(floor);

  // ---------------------------------------------------------------- DOM overlays (titles)
  const overlay = document.createElement('div');
  overlay.className = 'bt-overlay';
  stageEl.appendChild(overlay);
  const titleEls = [0, 1].map((k) => {
    const d = document.createElement('div');
    d.className = 'bt-title';
    d.dataset.side = k === 0 ? 'problem' : 'better';
    const b = document.createElement('span'); b.className = 'bt-badge'; b.textContent = k === 0 ? 'Problem' : 'Better';
    const t = document.createElement('span'); t.className = 'bt-title-text';
    d.append(b, t);
    overlay.appendChild(d);
    return { root: d, text: t };
  });

  // ---------------------------------------------------------------- helpers
  const isNarrow = () => stageEl.dataset.narrow === 'true';
  const KEEP_NARROW = ['thermal_break_unit', 'shelf_angle', 'standoff_bracket', 'slab_edge', 'balcony_slab'];
  const visibleSides = () => sides.map((s, k) => (s && (st.single == null || st.single === k) ? k : -1)).filter((k) => k >= 0);

  function slotOffset(k) {
    const s = sides[k];
    if (!s) return new THREE.Vector3();
    const plan = s.model.plan;
    const both = st.single == null;
    if (plan) {
      const w = (s.r.nx * s.r.cell);
      const x = both ? (k === 0 ? 1 : -1) * (w + st.gapPlan) / 2 : 0;   // the camera looks along +z, so screen right is -x
      return new THREE.Vector3(x, 0, 0);
    }
    const zmin = -S_IN; const zmax = s.r.depthIn + (s.r.detailId === 'slab' ? S_OUT : 0);
    const w = zmax - zmin;
    const cz = (zmin + zmax) / 2;
    const z = both ? (k === 0 ? -1 : 1) * (w + st.gapSec) / 2 - cz : -cz;
    // keep both models on the same screen height: the view is slightly oblique, so a shift along z also shifts them up the screen
    const d = SEC_DIR.clone().normalize();
    const rt = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), d).normalize();
    const up = new THREE.Vector3().crossVectors(d, rt).normalize();
    return new THREE.Vector3(0, -(z * up.z) / up.y, z);
  }

  /** Anchor of a label in the group's local frame. Plan labels sit at the model edge that faces the label column. */
  function anchorFor(k, spec) {
    const a = spec.anchor.clone();
    if (spec.edge) {
      const half = sides[k].r.nx * sides[k].r.cell / 2;
      const sgn = st.single == null ? (k === 0 ? -1 : 1) : -1;     // screen right is -x (the camera looks along +z)
      a.x = sgn * (half - 1.4);
    }
    return a;
  }

  function worldBox(k) {
    const s = sides[k];
    const b = s.model.box.clone();
    b.translate(s.group.position);
    return b;
  }

  // ---------------------------------------------------------------- build one side
  function disposeSide(k) {
    const s = sides[k];
    if (!s) return;
    if (s.arrows) { s.arrows.dispose(); }
    s.callouts.forEach((c) => c.api.dispose());
    s.markers.forEach((m) => m.dispose());
    if (s.cold) s.cold.dispose();
    root.remove(s.group);
    disposeObject(s.group);
    [s.heatTex, s.ifaceTex, ...s.ctx.map((c) => c.tex)].forEach((t) => t && t.dispose());
    sides[k] = null;
  }

  function buildSide(k, r) {
    disposeSide(k);
    const model = buildModel(r);
    const group = new THREE.Group();
    root.add(group);
    const s = {
      k, r, model, group, callouts: [], markers: [], cold: null, ctx: [], pickables: [], arrows: null,
      heatTex: null, heatMat: null, heatMesh: null, ifaceTex: null, ifaceMat: null, lines: null, lineMat: null,
    };
    sides[k] = s;
    const { nx, ny } = r;

    // parts
    model.mesher.geometries().forEach(({ id, geometry }) => {
      const m = new THREE.Mesh(geometry, bank.material(id));
      m.castShadow = id !== 'airspace';
      m.receiveShadow = id !== 'airspace';
      m.raycast = () => {};
      group.add(m);
    });

    // outlines of material boundaries on the cut face
    const segs = boundarySegments(r.mats, nx, ny);
    const pts = [];
    segs.forEach(([a0, b0, a1, b1]) => {
      const p = model.P(a0, b0, EPS_LINE); const q = model.P(a1, b1, EPS_LINE);
      pts.push(p.x, p.y, p.z, q.x, q.y, q.z);
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    s.lineMat = new THREE.LineBasicMaterial({ color: 0x12151a, transparent: true, opacity: 0.5, toneMapped: false });
    s.lines = new THREE.LineSegments(lg, s.lineMat);
    s.lines.raycast = () => {};
    s.lines.renderOrder = 4;
    group.add(s.lines);

    // heat map on the cut face
    s.heatTex = canvasTexture(nx, ny, true);
    s.heatMat = new THREE.MeshBasicMaterial({ map: s.heatTex, side: THREE.DoubleSide, toneMapped: false, transparent: true, depthWrite: false });
    const cutGeo = quad(model.P(0, 0, EPS_FACE), model.P(nx, 0, EPS_FACE), model.P(0, ny, EPS_FACE), model.P(nx, ny, EPS_FACE));
    s.heatMesh = new THREE.Mesh(cutGeo, s.heatMat);
    s.heatMesh.renderOrder = 2;
    s.heatMesh.raycast = () => {};
    group.add(s.heatMesh);
    // invisible twin used for picking (works in every Show mode)
    const pick = new THREE.Mesh(cutGeo.clone(), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    pick.userData = { side: k, kind: 'cut' };
    group.add(pick);
    s.pickables.push(pick);

    // interior surface strip on the room face (z = 0)
    s.ifaceTex = canvasTexture(nx, 1, true);
    s.ifaceMat = new THREE.MeshBasicMaterial({ map: s.ifaceTex, side: THREE.DoubleSide, toneMapped: false, transparent: true, depthWrite: false });
    const ifp = (a, t) => (model.plan
      ? new THREE.Vector3((a - nx / 2) * r.cell, t * PLAN_H, -EPS_IFACE)
      : new THREE.Vector3(t * LX, a * r.cell, -EPS_IFACE));
    const ifaceGeo = quad(ifp(0, 0), ifp(nx, 0), ifp(0, 1), ifp(nx, 1), [0, 0.5, 1, 0.5, 0, 0.5, 1, 0.5]);
    const iface = new THREE.Mesh(ifaceGeo, s.ifaceMat);
    iface.renderOrder = 2; iface.raycast = () => {};
    group.add(iface);
    s.iface = iface;

    // context heat quads (not solved: fade from the edge temperature to the room or outdoor air)
    model.contexts.forEach((cx) => {
      const nz = 28;
      const ny2 = Math.max(2, Math.round((cx.yHi - cx.yLo) / r.cell));
      const tex = canvasTexture(ny2, nz, true);
      const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false, transparent: true, depthWrite: false });
      const p = (y, z) => new THREE.Vector3(-EPS_FACE, y, z);
      const g = quad(p(cx.yLo, cx.z0), p(cx.yLo, cx.z1), p(cx.yHi, cx.z0), p(cx.yHi, cx.z1), [0, 0, 0, 1, 1, 0, 1, 1]);
      const mesh = new THREE.Mesh(g, mat);
      mesh.renderOrder = 2; mesh.raycast = () => {};
      group.add(mesh);
      const pk = new THREE.Mesh(g.clone(), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
      pk.userData = { side: k, kind: 'ctx', info: cx.info, ctx: cx };
      group.add(pk);
      s.pickables.push(pk);
      // rim lines
      const rim = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints([
          p(cx.yLo, cx.z0), p(cx.yLo, cx.z1), p(cx.yLo, cx.z1), p(cx.yHi, cx.z1),
          p(cx.yHi, cx.z1), p(cx.yHi, cx.z0), p(cx.yHi, cx.z0), p(cx.yLo, cx.z0),
        ].map((v) => { v.x = -EPS_LINE; return v; })),
        s.lineMat,
      );
      rim.raycast = () => {}; rim.renderOrder = 4;
      group.add(rim);
      s.ctx.push({ cx, tex, mat, mesh, ny: ny2, nz, rim });
    });

    group.position.copy(slotOffset(k));
    return s;
  }

  // ---------------------------------------------------------------- painting
  function paintSide(s, climate) {
    const { r } = s;
    const { nx, ny } = r;
    const lo = Math.min(climate.tIn, climate.tOut); const hi = Math.max(climate.tIn, climate.tOut);
    const col = makeColorizer(lo, hi);
    // cut face
    const cv = s.heatTex.image; const ctx = cv.getContext('2d');
    const img = ctx.createImageData(nx, ny);
    for (let p = 0; p < nx * ny; p++) {
      const c = col(r.temps[p]);
      img.data[p * 4] = c[0]; img.data[p * 4 + 1] = c[1]; img.data[p * 4 + 2] = c[2]; img.data[p * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    s.heatTex.needsUpdate = true;
    // room face strip
    const ic = s.ifaceTex.image.getContext('2d');
    const ii = ic.createImageData(nx, 1);
    for (let i = 0; i < nx; i++) {
      const c = col(r.interiorSurface[i]);
      ii.data[i * 4] = c[0]; ii.data[i * 4 + 1] = c[1]; ii.data[i * 4 + 2] = c[2]; ii.data[i * 4 + 3] = 255;
    }
    ic.putImageData(ii, 0, 0);
    s.ifaceTex.needsUpdate = true;
    // context pieces
    s.ctx.forEach((q) => {
      const { cx } = q;
      const row = cx.side === 'in' ? 0 : ny - 1;
      const far = cx.side === 'in' ? climate.tIn : climate.tOut;
      const cc = q.tex.image.getContext('2d');
      const im = cc.createImageData(q.ny, q.nz);
      for (let a = 0; a < q.ny; a++) {
        const y = cx.yLo + ((a + 0.5) / q.ny) * (cx.yHi - cx.yLo);
        const fi = Math.min(nx - 1, Math.max(0, y / r.cell - 0.5));
        const i0 = Math.floor(fi); const i1 = Math.min(nx - 1, i0 + 1); const tt = fi - i0;
        const te = r.temps[row * nx + i0] * (1 - tt) + r.temps[row * nx + i1] * tt;
        for (let b = 0; b < q.nz; b++) {
          const z = cx.z0 + ((b + 0.5) / q.nz) * (cx.z1 - cx.z0);
          const sdist = cx.side === 'in' ? -z : z - r.depthIn;
          const T = far + (te - far) * Math.exp(-Math.max(0, sdist) / 4.5);
          const c = col(T);
          const o = (b * q.ny + a) * 4;
          im.data[o] = c[0]; im.data[o + 1] = c[1]; im.data[o + 2] = c[2]; im.data[o + 3] = 255;
        }
      }
      cc.putImageData(im, 0, 0);
      q.tex.needsUpdate = true;
    });
  }

  function applyShow() {
    const mode = st.show;
    sides.forEach((s) => {
      if (!s) return;
      const heat = mode !== 'mats';
      const op = mode === 'both' ? 0.55 : 1;
      s.heatMesh.visible = heat;
      s.heatMat.opacity = op;
      s.iface.visible = heat;
      s.ifaceMat.opacity = mode === 'both' ? 0.5 : 0.92;
      s.ctx.forEach((q) => { q.mesh.visible = heat; q.mat.opacity = op; });
      s.lineMat.opacity = mode === 'mats' ? 0.42 : mode === 'both' ? 0.6 : 0.5;
    });
    stage.requestRender();
  }

  // ---------------------------------------------------------------- arrows
  function periodFor(s) {
    return s.model.plan ? 2.0 : s.r.detailId === 'slab' ? 3.4 : 2.9;
  }
  function rebuildArrows(k) {
    const s = sides[k];
    if (!s) return;
    if (s.arrows) { s.group.remove(s.arrows.group); s.arrows.dispose(); s.arrows = null; }
    if (!st.arrows || !st.climate) { syncAnim(); return; }
    const count = s.model.plan ? 12 : s.r.detailId === 'slab' ? 18 : 15;
    s.arrows = createArrows(s.model, s.r, st.climate, { count, period: periodFor(s), offset: 0.14 });
    s.arrows.group.visible = true;
    s.group.add(s.arrows.group);
    syncAnim();
  }
  function syncAnim() {
    const want = st.arrows && !reduceMotion() && sides.some((s) => s && s.arrows && !s.arrows.empty);
    if (want && !st.stopArrows) {
      st.stopArrows = stage.onFrame((dt, t) => {
        sides.forEach((s) => { if (s && s.arrows) s.arrows.update(t); });
      });
    } else if (!want && st.stopArrows) { st.stopArrows(); st.stopArrows = null; }
  }

  // ---------------------------------------------------------------- labels
  const fmtF = (t) => `${t.toFixed(1).replace('-', '−')} °F`;
  const rnd = (t) => `${Math.round(t)}`.replace('-', '−');

  function coldText(r) {
    return r.condensationRisk
      ? `Coldest inside surface: ${fmtF(r.minInteriorT)}\nBelow dew point: water forms`
      : `Coldest inside surface: ${fmtF(r.minInteriorT)}`;
  }

  function buildLabels(k) {
    const s = sides[k];
    if (!s) return;
    s.callouts.forEach((c) => c.api.dispose());
    s.markers.forEach((m) => m.dispose());
    if (s.cold) s.cold.dispose();
    s.callouts = []; s.markers = []; s.cold = null;
    const off = s.group.position;
    const model = s.model; const r = s.r;
    const specs = model.labels.slice();
    // part specific labels
    const D = r.depthIn;
    const stack = model.stack;
    const zOf = (id) => { const m = model.idxOf(id); const q = stack.find((x) => x.m === m); return q ? ((q.j0 + q.j1) / 2) * r.cell : null; };
    if (!model.plan) {
      const slab = model.decor.slab;
      specs.push({ text: 'Concrete slab', id: 'slab_edge', anchor: new THREE.Vector3(0, (slab.y0 + slab.y1) / 2, -S_IN * 0.55), place: 'roomSlab' });
      if (r.detailId === 'slab') specs.push({ text: 'Balcony slab', id: 'balcony_slab', anchor: new THREE.Vector3(0, (slab.y0 + slab.y1) / 2, D + S_OUT * 0.5), place: 'balcony' });
      if (model.breakInfo) {
        const bb = model.breakInfo;
        specs.push({ text: 'Thermal break', id: 'thermal_break_unit', anchor: new THREE.Vector3(0, ((bb.i0 + bb.i1) / 2) * r.cell, ((bb.j0 + bb.j1) / 2) * r.cell), place: 'top' });
      }
      if (r.detailId === 'shelf') {
        const am = model.idxOf('steel');
        const cb = model.cellBounds('steel');
        if (am >= 0 && cb) {
          const lbl = r.variantId === 'standoff' ? 'Standoff bracket' : 'Steel shelf angle';
          specs.push({ text: lbl, id: r.variantId === 'standoff' ? 'standoff_bracket' : 'shelf_angle', anchor: new THREE.Vector3(0, (cb.i0 + 0.5) * r.cell, ((cb.j0 + cb.j1) / 2) * r.cell), place: 'top' });
        }
      }
    }
    void zOf;
    specs.forEach((sp) => {
      const api = createCallout(stage, {
        text: sp.text, id: sp.id, anchor: anchorFor(k, sp).add(off), offset: new THREE.Vector3(6, 4, 0), side: 'right', parent: root,
      });
      api.userData.place = sp.place || (model.plan ? 'side' : 'top');
      api.userData.order = sp.order;
      api.userData.side = k;
      api.userData.spec = sp;
      s.callouts.push({ api, spec: sp });
    });
    // coldest inside surface
    s.cold = createCallout(stage, {
      text: coldText(r), id: 'interior_surface_temp', anchor: model.coldAnchor.clone().add(off),
      offset: new THREE.Vector3(0, -6, -10), side: 'right', parent: root, dotColor: r.condensationRisk ? '#c8261a' : '#1b44c8',
    });
    s.cold.userData.side = k;
    s.cold.userData.cold = true;
    // side markers
    const mk = (text, tone) => createSideMarker(stage, { text, position: new THREE.Vector3(), tone, align: 'center', parent: root });
    s.markers = [mk('Inside', 'warm'), mk('Outside', 'cold')];
  }

  function updateLabelText(k) {
    const s = sides[k];
    if (!s || !st.climate) return;
    s.cold.setText(coldText(s.r));
    s.cold.setDotColor(s.r.condensationRisk ? '#c8261a' : '#1b44c8');
    s.cold.setAnchor(s.model.P(s.r.minInteriorAt + 0.5, 0, 0).add(s.group.position));
    s.markers[0].setText(`Inside · ${rnd(st.climate.tIn)} °F`);
    s.markers[1].setText(`Outside · ${rnd(st.climate.tOut)} °F`);
    s.markers[0].setTone(st.climate.tIn >= st.climate.tOut ? 'warm' : 'cold');
    s.markers[1].setTone(st.climate.tIn >= st.climate.tOut ? 'cold' : 'warm');
  }

  // screen helpers ----------------------------------------------------------
  const _v = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  function canvasRect() { return stage.renderer.domElement.getBoundingClientRect(); }
  function toPx(world) {
    const r = canvasRect();
    const p = worldToClient(stage, world);
    return { x: p.x - r.left, y: p.y - r.top };
  }
  /** World point on the camera ray through canvas pixel (px, py) at the depth of `ref`. */
  function pxToWorld(px, py, ref) {
    const r = canvasRect();
    const cam = stage.camera;
    cam.updateMatrixWorld();
    _v.set((px / r.width) * 2 - 1, -((py / r.height) * 2 - 1), 0.5).unproject(cam);
    const dir = _v.sub(cam.position);
    cam.getWorldDirection(_fwd);
    const den = dir.dot(_fwd);
    const t = ref.clone().sub(cam.position).dot(_fwd) / (den || 1e-6);
    return cam.position.clone().addScaledVector(dir, t);
  }

  /** Arrange every label on screen (pixel rules), then convert to world offsets. Called after framing and layout changes. */
  function placeLabels() {
    const rect = canvasRect();
    if (!rect.width) return;
    const vis = visibleSides();
    const bounds = [];
    vis.forEach((k) => {
      const s = sides[k];
      const corners = [];
      const b = worldBox(k);
      [b.min.x, b.max.x].forEach((x) => [b.min.y, b.max.y].forEach((y) => [b.min.z, b.max.z].forEach((z) => corners.push(toPx(new THREE.Vector3(x, y, z))))));
      const bb = {
        x0: Math.min(...corners.map((c) => c.x)), x1: Math.max(...corners.map((c) => c.x)),
        y0: Math.min(...corners.map((c) => c.y)), y1: Math.max(...corners.map((c) => c.y)),
      };
      bounds[k] = bb;
    });
    const TIER = 25;
    // plan details: ONE column of names (between the two models, or beside a single model), a leader from each pill to every model
    if (sides[vis[0]].model.plan) {
      const both = vis.length === 2;
      const names = new Map();
      vis.forEach((k) => sides[k].callouts.forEach((c) => {
        const a = toPx(c.api.object.position);
        const e = names.get(c.api.text);
        if (!e) names.set(c.api.text, { text: c.api.text, y: a.y, w: c.api.size.w, items: [c] });
        else { e.items.push(c); e.y = Math.min(e.y, a.y); }
      }));
      const list = Array.from(names.values()).sort((x, y) => x.y - y.y);
      let prev = -1e9;
      list.forEach((it) => { it.ty = Math.max(it.y, prev + TIER); prev = it.ty; });
      const shift = list.length ? list.reduce((m, it) => m + (it.y - it.ty), 0) / list.length : 0;
      list.forEach((it) => { it.ty += shift * 0.55; });
      const b0 = bounds[vis[0]]; const b1 = bounds[vis[vis.length - 1]];
      list.forEach((it) => {
        const cx = both ? (b0.x1 + b1.x0) / 2 : b0.x1 + 16 + it.w / 2;
        it.items.forEach((c, n) => {
          const ref = c.api.object.position;
          c.api.setSide('right');
          c.api.setOffset(pxToWorld(cx - it.w / 2, it.ty, ref).sub(ref));
          c.api.userData.secondary = n > 0;
        });
      });
    }
    vis.forEach((k) => {
      const s = sides[k];
      const bb = bounds[k];
      const own = s.callouts;
      const hide = !st.labels;
      own.forEach((c) => c.api.setVisible(!hide));
      s.cold.setVisible(true);
      const setPx = (api, px, py, side) => {
        const ref = api.object.position;
        api.setSide(side);
        api.setOffset(pxToWorld(px, py, ref).sub(ref));
      };
      if (s.model.plan) {
        const ca = toPx(s.cold.object.position);
        const cw = s.cold.size.w;
        setPx(s.cold, ca.x - cw / 2, bb.y1 + 20, 'right');
        const front = toPx(s.model.P(s.r.nx / 2, 0, 0).add(s.group.position));
        const back = toPx(s.model.P(s.r.nx / 2, s.r.ny, 0).add(s.group.position));
        s.markers[0].setPosition(pxToWorld(front.x, bb.y1 + 56, s.cold.object.position));
        s.markers[1].setPosition(pxToWorld(back.x, bb.y0 - 16, s.model.P(s.r.nx / 2, s.r.ny, 0).add(s.group.position)));
        s.markerPx = [{ x: front.x, y: bb.y1 + 56 }, { x: back.x, y: bb.y0 - 16 }];
        titleEls[k].anchor = { x: front.x, y: bb.y1 + 86 };
        return;
      }
      // ----- section: one staircase of names above the first model (the second shows only what is new), specials around it
      const first = sides[vis[0]];
      const narrow = isNarrow();
      own.forEach((c) => {
        const dup = (k !== vis[0] && first.callouts.some((o) => o.api.text === c.api.text)) || (narrow && !KEEP_NARROW.includes(c.api.userData.infoId));
        c.api.userData.secondary = dup;
        c.api.setVisible(!hide && !dup);
      });
      const topItems = own.filter((c) => c.api.userData.place === 'top' && !c.api.userData.secondary).map((c) => ({ api: c.api, a: toPx(c.api.object.position) }));
      topItems.push({ api: s.cold, a: toPx(s.cold.object.position) });
      // pack right to left: an item takes the lowest row where it clears its neighbours, so leaders never cross a label
      topItems.sort((u, v) => v.a.x - u.a.x);
      const rows = [];
      topItems.forEach((it) => {
        const left = it.a.x - 4; const right = left + it.api.size.w;
        let t = 0;
        for (;; t++) {
          const row = rows[t] || (rows[t] = []);
          if (row.every((q) => right + 8 < q.left)) { row.push({ left, h: it.api.size.h }); break; }
        }
        it.row = t; it.left = left;
      });
      let base = bb.y0 - 8;
      const rowY = rows.map((row) => {
        const h = Math.max(24, ...row.map((q) => q.h));
        const y = base - h / 2 - 2;
        base -= h - 2;
        return y;
      });
      topItems.forEach((it) => setPx(it.api, it.left, rowY[it.row], 'right'));
      own.forEach((c) => {
        const pl = c.api.userData.place;
        if (pl === 'roomSlab') {
          const stubTop = toPx(new THREE.Vector3(0, s.model.decor.floorTop, -S_IN * 0.2).add(s.group.position));
          setPx(c.api, stubTop.x, stubTop.y - 36, 'left');
        } else if (pl === 'balcony') {
          const stubTop = toPx(new THREE.Vector3(0, s.model.decor.slab.y1, s.r.depthIn + S_OUT * 0.15).add(s.group.position));
          setPx(c.api, stubTop.x, stubTop.y - 36, 'right');
        }
      });
      const inP = toPx(new THREE.Vector3(0, 0, -S_IN).add(s.group.position));
      const outP = toPx(new THREE.Vector3(0, 0, s.r.depthIn + (s.r.detailId === 'slab' ? S_OUT : 0)).add(s.group.position));
      const mw = 116;
      const mid = (inP.x + outP.x) / 2;
      const inX = Math.min(inP.x + 46, mid - mw / 2 - 3);
      const outX = Math.max(outP.x - 50, mid + mw / 2 + 3);
      s.markers[0].setPosition(pxToWorld(inX, bb.y1 + 16, new THREE.Vector3(0, 0, -S_IN).add(s.group.position)));
      s.markers[1].setPosition(pxToWorld(outX, bb.y1 + 16, new THREE.Vector3(0, 0, s.r.depthIn).add(s.group.position)));
      s.markerPx = [{ x: inX, y: bb.y1 + 16 }, { x: outX, y: bb.y1 + 16 }];
      titleEls[k].anchor = { x: (inP.x + outP.x) / 2, y: bb.y1 + 44 };
    });
    updateOverlays();
    stage.requestRender();
  }

  function updateOverlays() {
    const vis = visibleSides();
    const rect = canvasRect();
    [0, 1].forEach((k) => {
      const t = titleEls[k];
      const on = vis.includes(k) && t.anchor && !isNarrow();
      t.root.style.display = on ? '' : 'none';
      if (!on) return;
      t.root.style.left = `${t.anchor.x}px`;
      t.root.style.top = `${Math.min(rect.height - 30, t.anchor.y)}px`;
    });
  }

  // ---------------------------------------------------------------- camera
  function directionFor() {
    const s = sides.find(Boolean);
    return s && s.model.plan ? new THREE.Vector3(0.0, 1.0, -0.62) : SEC_DIR.clone();
  }

  function fitBox(box, dir, pad, shift) {
    const cam = stage.camera;
    const d = dir.clone().normalize();
    const target = box.getCenter(new THREE.Vector3());
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, d).normalize();   // camera right (looking along -d)
    const upv = new THREE.Vector3().crossVectors(d, right).normalize();
    const vf = THREE.MathUtils.degToRad(cam.fov);
    const tv = Math.tan(vf / 2);
    const th = tv * cam.aspect;
    let dist = 1;
    [box.min.x, box.max.x].forEach((x) => [box.min.y, box.max.y].forEach((y) => [box.min.z, box.max.z].forEach((z) => {
      const rel = new THREE.Vector3(x, y, z).sub(target);
      const back = rel.dot(d); const rr = Math.abs(rel.dot(right)); const uu = Math.abs(rel.dot(upv));
      dist = Math.max(dist, back + (rr * pad) / th, back + (uu * pad) / tv);
    })));
    if (shift) target.add(shift);
    cam.position.copy(target).addScaledVector(d, dist);
    cam.near = Math.max(0.1, dist / 200);
    cam.far = Math.max(1000, dist * 30);
    cam.updateProjectionMatrix();
    stage.controls.target.copy(target);
    stage.controls.minDistance = dist * 0.25;
    stage.controls.maxDistance = dist * 4;
    stage.controls.update();
    cam.updateMatrixWorld();
    return { target, dist, right, upv };
  }

  function layoutAll() {
    // slots and light
    [0, 1].forEach((k) => { if (sides[k]) sides[k].group.position.copy(slotOffset(k)); });
    const vis = visibleSides();
    vis.forEach((k) => { sides[k].group.visible = true; });
    [0, 1].forEach((k) => {
      if (sides[k] && !vis.includes(k)) { sides[k].group.visible = false; }
      if (sides[k]) {
        sides[k].callouts.forEach((c) => { c.api.object.visible = vis.includes(k) && st.labels; c.api.setAnchor(anchorFor(k, c.api.userData.spec).add(sides[k].group.position)); });
        sides[k].cold.object.visible = vis.includes(k);
        sides[k].markers.forEach((m) => m.setVisible(vis.includes(k)));
        sides[k].cold.setAnchor(sides[k].model.P(sides[k].r.minInteriorAt + 0.5, 0, 0).add(sides[k].group.position));
      }
    });
    if (key && vis.length) {
      const box = new THREE.Box3();
      vis.forEach((k) => box.union(worldBox(k)));
      const c = box.getCenter(new THREE.Vector3());
      const sph = box.getBoundingSphere(new THREE.Sphere());
      const plan = sides[vis[0]].model.plan;
      key.target.position.copy(c);
      key.position.copy(c).add(plan ? new THREE.Vector3(-0.5, 1.2, -0.7).multiplyScalar(sph.radius * 1.6) : new THREE.Vector3(-1.2, 1.0, -0.6).multiplyScalar(sph.radius * 1.6));
      const sc = key.shadow.camera;
      const e = sph.radius * 1.15;
      sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = 1; sc.far = sph.radius * 6;
      sc.updateProjectionMatrix();
      if (fill) fill.position.copy(c).add(new THREE.Vector3(0.9, 0.5, 0.8).multiplyScalar(sph.radius * 1.5));
    }
    shadowDirty();
  }

  function frame() {
    const vis = visibleSides();
    if (!vis.length) return;
    layoutAll();
    const dir = directionFor();
    const plan = sides[vis[0]].model.plan;
    const boxNow = () => { const bx = new THREE.Box3(); vis.forEach((k) => bx.union(worldBox(k))); return bx; };
    stage.camera.fov = plan ? 22 : 11;
    stage.camera.aspect = stage.renderer.domElement.clientWidth / Math.max(1, stage.renderer.domElement.clientHeight);
    const shift = new THREE.Vector3();
    let info = null;
    const tryPad = (pad) => {
      info = fitBox(boxNow(), dir, pad, shift);
      if (plan && vis.length === 2) {
        // the column of names between the two models needs room: size the gap from the current scale
        const a0 = toPx(new THREE.Vector3(0, 0, 0)); const a1 = toPx(new THREE.Vector3(10, 0, 0));
        const ppi = Math.abs(a1.x - a0.x) / 10 || 10;
        let wmax = 0;
        vis.forEach((k) => sides[k].callouts.forEach((c) => { wmax = Math.max(wmax, c.api.size.w); }));
        const need = Math.min(46, Math.max(5, (wmax + 34) / ppi));
        if (Math.abs(need - st.gapPlan) > 0.35) {
          st.gapPlan = need;
          layoutAll();
          info = fitBox(boxNow(), dir, pad, shift);
        }
      }
      if (!plan && vis.length === 2) {
        // the Inside and Outside tags of both models share one row: keep the models far enough apart for them
        const a0 = toPx(new THREE.Vector3(0, 0, 0)); const a1 = toPx(new THREE.Vector3(0, 0, 10));
        const ppi = Math.hypot(a1.x - a0.x, a1.y - a0.y) / 10 || 6;
        const w0 = sides[0].r.depthIn + S_IN + (sides[0].r.detailId === 'slab' ? S_OUT : 0);
        const need = Math.min(30, Math.max(8, 252 / ppi - w0));
        if (Math.abs(need - st.gapSec) > 0.35) {
          st.gapSec = need;
          layoutAll();
          info = fitBox(boxNow(), dir, pad, shift);
        }
      }
      placeLabels();
      // measure everything that has to stay inside the canvas
      const rect = canvasRect();
      let x0 = 1e9; let x1 = -1e9; let y0 = 1e9; let y1 = -1e9;
      const grow = (r2) => { x0 = Math.min(x0, r2.left); x1 = Math.max(x1, r2.right); y0 = Math.min(y0, r2.top); y1 = Math.max(y1, r2.bottom); };
      vis.forEach((k) => {
        const s2 = sides[k];
        s2.callouts.forEach((c) => { if (c.api.object.visible) { const rr = c.api.clientRect(); grow({ left: rr.left - rect.left, right: rr.right - rect.left, top: rr.top - rect.top, bottom: rr.bottom - rect.top }); } });
        { const rr = s2.cold.clientRect(); grow({ left: rr.left - rect.left, right: rr.right - rect.left, top: rr.top - rect.top, bottom: rr.bottom - rect.top }); }
        const b2 = worldBox(k);
        [b2.min.x, b2.max.x].forEach((x) => [b2.min.y, b2.max.y].forEach((y) => [b2.min.z, b2.max.z].forEach((z) => { const p = toPx(new THREE.Vector3(x, y, z)); grow({ left: p.x, right: p.x, top: p.y, bottom: p.y }); })));
        (s2.markerPx || []).forEach((q) => grow({ left: q.x - 60, right: q.x + 60, top: q.y - 17, bottom: q.y + 17 }));
        const ta = isNarrow() ? null : titleEls[k].anchor;
        if (ta) { const tw = Math.min(rect.width * 0.46, 40 + (titleEls[k].text.textContent.length * 6.6)); grow({ left: ta.x - tw / 2, right: ta.x + tw / 2, top: ta.y, bottom: ta.y + 28 }); }
      });
      const m = 10;
      const rt = isNarrow() ? 58 : 0; const rb = isNarrow() ? 60 : 0;
      const over = Math.max(0, (m - x0) / rect.width, (x1 - (rect.width - m)) / rect.width, (m + rt - y0) / rect.height, (y1 - (rect.height - m - rb)) / rect.height);
      return { over, x0, x1, y0, y1, rect, rt, rb };
    };
    const solve = () => {
      let lo = 0.4; let hi = 7;
      for (let it = 0; it < 14; it++) {
        const mid = (lo + hi) / 2;
        if (tryPad(mid).over <= 0.002) hi = mid; else lo = mid;
      }
      return tryPad(hi);
    };
    for (let round = 0; round < 2; round++) {
      const r = solve();
      // centre what is drawn in the canvas, then solve again
      const vf = THREE.MathUtils.degToRad(stage.camera.fov);
      const ppi = r.rect.height / (2 * info.dist * Math.tan(vf / 2));
      shift.addScaledVector(info.right, ((r.x0 + r.x1) / 2 - r.rect.width / 2) / ppi);
      shift.addScaledVector(info.upv, ((r.rt + (r.rect.height - r.rt - r.rb) / 2) - (r.y0 + r.y1) / 2) / ppi);
    }
    solve();
    st.userMoved = false;
    st.framedFor = `${st.detailId}|${st.single}`;
    stage.requestRender();
  }

  // ---------------------------------------------------------------- picking
  function pickables() {
    const out = [];
    visibleSides().forEach((k) => out.push(...sides[k].pickables));
    return out;
  }
  const allCallouts = () => {
    const out = [];
    visibleSides().forEach((k) => { const s = sides[k]; if (st.labels) s.callouts.forEach((c) => { if (!c.api.userData.secondary) out.push(c.api); }); out.push(s.cold); });
    return out;
  };

  /** What is under the pointer: { side, infoId, name, tempF, cell, callout } or null. */
  function pickAt(clientX, clientY) {
    const co = pickCallout(stage, clientX, clientY, allCallouts());
    if (co) {
      const side = co.userData.side;
      return { side, infoId: co.userData.infoId, name: co.text.split('\n')[0], callout: true, cold: !!co.userData.cold };
    }
    const hit = stage.pick(clientX, clientY, pickables());
    if (!hit) return null;
    const ud = hit.object.userData;
    const s = sides[ud.side];
    if (!s) return null;
    if (ud.kind === 'ctx') {
      return { side: ud.side, infoId: ud.info, name: ud.info === 'balcony_slab' ? 'Balcony slab' : 'Concrete slab', callout: false, tempF: null };
    }
    const uv = hit.uv;
    if (!uv) return null;
    const i = Math.min(s.r.nx - 1, Math.max(0, Math.floor(uv.x * s.r.nx)));
    const j = Math.min(s.r.ny - 1, Math.max(0, Math.floor(uv.y * s.r.ny)));
    const part = s.model.partAt(i, j);
    let info = part.info;
    if (info === 'slab_edge' && s.r.detailId === 'slab') info = 'balcony_slab';
    return { side: ud.side, infoId: info, name: part.name, tempF: s.r.temps[j * s.r.nx + i], callout: false, cell: { i, j } };
  }

  function setHover(h) {
    const prev = st.hoverInfo;
    const same = (!prev && !h) || (prev && h && prev.side === h.side && prev.infoId === h.infoId);
    if (same) return;
    st.hoverInfo = h ? { side: h.side, infoId: h.infoId } : null;
    sides.forEach((s, k) => {
      if (!s) return;
      s.callouts.forEach((c) => c.api.setActive(!!h && h.side === k && c.api.userData.infoId === h.infoId));
      s.cold.setActive(!!h && h.side === k && h.cold === true);
    });
  }

  // ---------------------------------------------------------------- resize
  let lastW = 0; let lastH = 0; let rzTimer = 0;
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
    const w = stageEl.clientWidth; const h = stageEl.clientHeight;
    if (!w || !h || (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2)) return;
    lastW = w; lastH = h;
    clearTimeout(rzTimer);
    rzTimer = setTimeout(() => {
      stage.camera.aspect = w / h;
      stage.camera.updateProjectionMatrix();
      if (!st.userMoved) frame(); else { placeLabels(); }
    }, 60);
  }) : null;
  if (ro) ro.observe(stageEl);
  const onControls = () => { updateOverlays(); };
  const onStart = () => { st.userMoved = true; };
  if (stage.controls) {
    stage.controls.addEventListener('change', onControls);
    stage.controls.addEventListener('start', onStart);
  }

  // ---------------------------------------------------------------- public
  const api = {
    /**
     * Rebuild both mock-ups for a detail.
     * @param {string} detailId
     * @param {object[]} results [problem, better] solveBridge results
     * @param {object} climate
     */
    setDetail(detailId, results, climate) {
      st.detailId = detailId; st.climate = { ...climate }; st.results = results;
      [0, 1].forEach((k) => { buildSide(k, results[k]); });
      [0, 1].forEach((k) => { paintSide(sides[k], st.climate); buildLabels(k); updateLabelText(k); rebuildArrows(k); });
      applyShow();
      frame();
    },
    /** Same geometry, new numbers (climate slider). */
    setResults(results, climate) {
      st.climate = { ...climate }; st.results = results;
      [0, 1].forEach((k) => {
        const s = sides[k]; if (!s) return;
        s.r = results[k];
        paintSide(s, st.climate);
        updateLabelText(k);
        rebuildArrows(k);
      });
      stage.requestRender();
    },
    setShow(v) { st.show = v; applyShow(); },
    setArrows(on) { st.arrows = !!on; [0, 1].forEach((k) => rebuildArrows(k)); stage.requestRender(); },
    setLabels(on) {
      st.labels = !!on;
      sides.forEach((s, k) => { if (s) s.callouts.forEach((c) => c.api.setVisible(st.labels && visibleSides().includes(k))); });
      if (visibleSides().length && st.framedFor) placeLabels();
      stage.requestRender();
    },
    setTitles(list) {
      st.titles = list;
      list.forEach((t, k) => { titleEls[k].text.textContent = t; });
    },
    /** Phone: show one side at a time (0 problem, 1 better) or both (null). Re-frames only when the layout changes. */
    setSingle(k) {
      if (st.single === k) return;
      const wasBoth = st.single == null;
      st.single = k;
      if (wasBoth || k == null) { frame(); return; }
      // switching between the two single views keeps the camera: only the visible model changes
      layoutAll();
      placeLabels();
      stage.requestRender();
    },
    frame() { frame(); },
    pickAt,
    setHover,
    pickCallouts: allCallouts,
    get sides() { return sides; },
    onTheme() {
      floorMat.opacity = stage.theme.dark ? 0.5 : 0.2;
      stage.requestRender();
    },
    dispose() {
      if (ro) ro.disconnect();
      clearTimeout(rzTimer);
      if (stage.controls) { stage.controls.removeEventListener('change', onControls); stage.controls.removeEventListener('start', onStart); }
      if (st.stopArrows) { st.stopArrows(); st.stopArrows = null; }
      [0, 1].forEach(disposeSide);
      overlay.remove();
      bank.dispose();
      floor.geometry.dispose(); floorMat.dispose();
      if (key) { key.castShadow = false; stage.scene.remove(key.target); }
      if (envRT) { stage.scene.environment = prevEnv; envRT.dispose(); }
      stage.scene.remove(root);
    },
  };
  return api;
}
