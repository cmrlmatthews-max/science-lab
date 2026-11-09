// envelope/mode-water.js  Water mode (Part F): how rain moves on and in a wall, and what happens when a detail is wrong.
// Rule-based animation, not a fluid simulation. Rules and dimensions live in water.js.
// State lives in ctx.store under `water` so it survives a mode switch.

import {
  el, slider, segmented, toggle, stat, stats, banner, legend, section, card, button, select, sourceTag, fmt,
} from '../shared/ui.js';
import { makeLabelSprite } from '../shared/scene.js';
import { MATERIALS } from './materials.js';
import { cloneWall } from './walls.js';
import * as W from './water.js';

const DEFAULTS = {
  view: 'forces', forceId: 'momentum', defenseOn: false, strategyId: 'mass', fault: false,
  errors: [], layer: 'water', layerWall: null, rain: 60, wind: 30,
};
const VIEWS = [
  { value: 'forces', label: 'Forces' }, { value: 'walls', label: 'Walls' },
  { value: 'errors', label: 'Errors' }, { value: 'layers', label: 'Layers' },
];
const LAYER_ORDER = ['water', 'air', 'vapor', 'thermal'];

const CSS = `
.water-row { cursor: pointer; align-items: flex-start; }
.water-row .layer-name, .water-row .layer-sub { white-space: normal; overflow: visible; }
.water-row .swatch { margin-top: 2px; }
.water-row:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.water-list { display: flex; flex-direction: column; gap: 8px; }
.water-list .layer-row + .layer-row { margin-top: 0; }
.water-steps { margin: 0; padding: 0; list-style: none; counter-reset: ws; display: flex; flex-direction: column; gap: 9px; }
.water-steps li { counter-increment: ws; display: grid; grid-template-columns: 26px 1fr; gap: 9px; font-size: 14px; line-height: 1.38; align-items: start; }
.water-steps li::before { content: counter(ws); width: 24px; height: 24px; border: 1.5px solid var(--ink); border-radius: 50%; display: grid; place-items: center; font: 700 12px var(--font-mono); background: var(--paper-2); }
.water-steps li[data-leak="true"] { color: var(--warn); font-weight: 600; }
.water-steps li[data-leak="true"]::before { background: var(--warn); border-color: var(--warn); color: #fff; }
.water-err { display: flex; flex-direction: column; gap: 2px; }
.water-err .layer-sub { white-space: normal; padding: 0 2px 0 2px; }
.water-block { display: flex; flex-direction: column; gap: 6px; font-size: 14px; line-height: 1.38; }
.water-block .water-h { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-family: var(--font-display); font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; font-size: 15px; }
.water-block b { font-family: var(--font-display); font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; font-size: 12px; color: var(--ink-2); margin-right: 6px; }
.panel-wrap[data-panel="c"] .panel > .water-dims { flex: 3 1 520px; }
.water-dims .stats { grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)); }
.water-block[data-kind="leak"] { border-color: var(--warn); }
.water-block[data-kind="leak"] .water-h { color: var(--warn); }
`;

const ROT_Y = -Math.PI / 2;

export default {
  id: 'water',
  label: 'Water',
  panelTitles: { a: 'View', b: 'Water path', c: 'Rules' },
  _cleanup: [],
  mount(ctx) {
    const { stage, panelA, panelB, panelC, summaryEl, store } = ctx;
    const T = stage.THREE;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cleanup = this._cleanup;

    // ---------- style ----------
    const styleEl = el('style', { id: 'water-style', text: CSS });
    document.head.appendChild(styleEl);
    cleanup.push(() => styleEl.remove());

    // ---------- state ----------
    const cur = store.get();
    store.set({ water: { ...DEFAULTS, layerWall: cur.wallId || 'W1', ...(cur.water || {}) } });
    const S = () => store.get().water;
    const setS = (patch) => store.set({ water: { ...S(), ...patch } });

    // ---------- scene objects ----------
    let content = new T.Group();
    stage.scene.add(content);
    let rainObj = null; // { points, pos, vel, N, box }
    let droplets = []; // { mesh, curve, len, off, speed, idx, kind }
    let windArrows = []; // { mesh, base:[x,y,z], phase }
    let narrow = ctx.isNarrow();
    const palette = () => {
      const d = stage.theme.dark;
      return {
        dark: d,
        ink: stage.theme.ink,
        water: d ? '#4aa3ff' : '#1565e8',
        absorb: d ? '#8fa6c4' : '#5f7899',
        dry: d ? '#c9d6e6' : '#8497ad',
        leak: d ? '#ff5a44' : '#d81e0f',
        neutral: d ? '#7d7664' : '#cfc7b3',
        neutral2: d ? '#645e4f' : '#b9b09a',
        metal: d ? '#c3ccd6' : '#c6d0da',
        wood: '#c79a5b',
        accent: '#f2b705',
        warn: d ? '#ff6e50' : '#c8261a',
      };
    };
    let P = palette();

    function disposeObj(root) {
      root.traverse((o) => {
        if (o.geometry && o.geometry.dispose) o.geometry.dispose();
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        ms.forEach((m) => { if (m.map && !m.userData.sharedMap) m.map.dispose(); m.dispose(); });
      });
    }

    // soft red patch texture (shared)
    const patchTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)');
      gr.addColorStop(0.55, 'rgba(255,255,255,0.7)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      const t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      return t;
    })();
    cleanup.push(() => patchTex.dispose());

    // ---------- geometry helpers ----------
    const V = (p) => new T.Vector3(p[0], p[1], p[2]);
    function mat(hex, o = {}) {
      const op = o.opacity == null ? 1 : o.opacity;
      return new T.MeshStandardMaterial({
        color: hex, roughness: 0.75, metalness: o.metal ? 0.35 : 0.04, transparent: op < 1, opacity: op,
        depthWrite: op >= 1, side: op < 1 || o.double ? T.DoubleSide : T.FrontSide,
        polygonOffset: true, polygonOffsetFactor: o.po == null ? 1 : o.po, polygonOffsetUnits: 1,
      });
    }
    function outline(g, geo, o = {}) {
      const e = new T.LineSegments(new T.EdgesGeometry(geo, 25), new T.LineBasicMaterial({ color: P.ink, transparent: true, opacity: o.edge == null ? 0.5 : o.edge }));
      e.renderOrder = 2;
      g.add(e);
      return e;
    }
    // axis-aligned box [x0,x1,y0,y1,z0,z1]
    function addBox(g, b, hex, o = {}) {
      const [x0, x1, y0, y1, z0, z1] = b;
      const geo = new T.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
      const m = new T.Mesh(geo, mat(hex, o));
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      g.add(m);
      if (o.edges !== false) { const e = outline(g, geo, o); e.position.copy(m.position); }
      return m;
    }
    // slab in the xy plane from z0 to z1 with an optional rectangular hole
    function addSlab(g, r, hex, o = {}) {
      const sh = new T.Shape();
      sh.moveTo(r.x0, r.y0); sh.lineTo(r.x1, r.y0); sh.lineTo(r.x1, r.y1); sh.lineTo(r.x0, r.y1); sh.lineTo(r.x0, r.y0);
      const h = r.hole;
      if (h && h.x0 >= r.x0 && h.x1 <= r.x1 && h.y0 >= r.y0 && h.y1 <= r.y1) {
        const p = new T.Path();
        p.moveTo(h.x0, h.y0); p.lineTo(h.x0, h.y1); p.lineTo(h.x1, h.y1); p.lineTo(h.x1, h.y0); p.lineTo(h.x0, h.y0);
        sh.holes.push(p);
      }
      const geo = new T.ExtrudeGeometry(sh, { depth: r.z1 - r.z0, bevelEnabled: false });
      geo.translate(0, 0, r.z0);
      const m = new T.Mesh(geo, mat(hex, o));
      g.add(m);
      if (o.edges !== false) outline(g, geo, o);
      return m;
    }
    // prism from a (u, v) polygon, extruded along x from -depth to 0 (Forces view close-up)
    function addPrism(g, pts, hex, depth, o = {}) {
      const sh = new T.Shape();
      pts.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
      const geo = new T.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
      geo.rotateY(ROT_Y);
      const m = new T.Mesh(geo, mat(hex, o));
      g.add(m);
      if (o.edges !== false) outline(g, geo, o);
      return m;
    }
    function addLine(g, pts, color, opacity = 0.6) {
      const geo = new T.BufferGeometry().setFromPoints(pts.map(V));
      const l = new T.Line(geo, new T.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false }));
      l.renderOrder = 15;
      g.add(l);
      return l;
    }
    let LH = 3; // label sprite height
    function label(g, text, pos, target, o = {}) {
      const s = makeLabelSprite(text, o.warn
        ? { height: LH, color: '#ffffff', bg: P.leak, border: P.leak }
        : { height: LH });
      s.position.set(pos[0], pos[1], pos[2]);
      g.add(s);
      if (target) addLine(g, [pos, target], P.ink, 0.55);
      return s;
    }
    function patch(g, p) {
      const geo = new T.PlaneGeometry(p.x1 - p.x0, p.y1 - p.y0);
      const m = new T.MeshBasicMaterial({ map: patchTex, color: P.leak, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false });
      m.userData.sharedMap = true;
      const mesh = new T.Mesh(geo, m);
      mesh.position.set((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, p.z);
      mesh.renderOrder = 6;
      g.add(mesh);
      return mesh;
    }

    // ---------- water paths ----------
    const nDrops = () => Math.ceil(S().rain / 34);
    function addPath(g, points, kind, o = {}) {
      const r = o.r || 0.4;
      const color = { shed: P.water, drain: P.water, absorb: P.absorb, dry: P.dry, leak: P.leak, water: P.water, blocked: P.ink }[kind] || P.water;
      const pts = points.map(V);
      const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
      const len = curve.getLength();
      if (kind === 'dry') {
        const n = Math.max(4, Math.round(len / (r * 7)));
        const geo = new T.SphereGeometry(r * 0.85, 8, 6);
        const m = new T.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 });
        for (let i = 0; i <= n; i++) {
          const s = new T.Mesh(geo, m);
          s.position.copy(curve.getPointAt(i / n));
          s.renderOrder = 10;
          g.add(s);
        }
      } else {
        const geo = new T.TubeGeometry(curve, Math.max(10, (pts.length - 1) * 8), kind === 'blocked' ? r * 0.8 : r, 7, false);
        const m = new T.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: kind === 'absorb' ? 0.85 : 0.95 });
        const t = new T.Mesh(geo, m);
        t.renderOrder = 10;
        g.add(t);
      }
      if (kind === 'blocked') {
        // a small X at the end
        const e = pts[pts.length - 1];
        const m = new T.MeshBasicMaterial({ color: P.leak, depthTest: false });
        for (const a of [Math.PI / 4, -Math.PI / 4]) {
          const bar = new T.Mesh(new T.BoxGeometry(r * 7, r * 1.4, r * 1.4), m);
          bar.position.copy(e);
          bar.rotation.z = a;
          bar.rotateY(0);
          bar.renderOrder = 12;
          g.add(bar);
        }
        return { curve, len };
      }
      // arrowheads show the direction
      const nArrow = Math.max(1, Math.min(4, Math.floor(len / (r * 40)) + 1));
      const cg = new T.ConeGeometry(r * 2.1, r * 5, 10);
      const cm = new T.MeshBasicMaterial({ color, depthTest: false });
      for (let i = 0; i < nArrow; i++) {
        const u = nArrow === 1 ? 0.92 : 0.28 + (0.66 * i) / (nArrow - 1);
        const cone = new T.Mesh(cg, cm);
        cone.position.copy(curve.getPointAt(u));
        cone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), curve.getTangentAt(u).normalize());
        cone.renderOrder = 11;
        g.add(cone);
      }
      if (kind !== 'dry' && kind !== 'absorb') {
        const dg = new T.SphereGeometry(r * 1.75, 12, 10);
        const dm = new T.MeshBasicMaterial({ color: kind === 'leak' ? P.leak : P.water, depthTest: false });
        for (let i = 0; i < 3; i++) {
          const d = new T.Mesh(dg, dm);
          d.renderOrder = 12;
          d.visible = i < nDrops();
          g.add(d);
          droplets.push({ mesh: d, curve, len, idx: i, off: (i + 0.5) / 3, kind, speed: o.speed || 1 });
          d.position.copy(curve.getPointAt(((i + 0.5) / 3) % 1));
        }
      } else if (kind === 'absorb') {
        const dg = new T.SphereGeometry(r * 1.5, 10, 8);
        const dm = new T.MeshBasicMaterial({ color, depthTest: false });
        const d = new T.Mesh(dg, dm);
        d.renderOrder = 12;
        g.add(d);
        droplets.push({ mesh: d, curve, len, idx: 0, off: 0.3, kind, speed: (o.speed || 1) * 0.5 });
      }
      return { curve, len };
    }

    // ---------- rain ----------
    function makeRain(g, box) {
      if (reduce || !box) return null;
      const N = 1400;
      const pos = new Float32Array(N * 3);
      const vel = new Float32Array(N);
      const geo = new T.BufferGeometry();
      for (let i = 0; i < N; i++) {
        pos[i * 3] = box.x0 + Math.random() * (box.x1 - box.x0);
        pos[i * 3 + 1] = box.y0 + Math.random() * (box.y1 - box.y0);
        pos[i * 3 + 2] = box.z0 + Math.random() * (box.z1 - box.z0);
        vel[i] = 0.75 + Math.random() * 0.5;
      }
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      const m = new T.PointsMaterial({ color: P.dark ? '#9ccaff' : '#2f7bff', size: box.size || 1.1, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false });
      const pts = new T.Points(geo, m);
      pts.frustumCulled = false;
      pts.renderOrder = 3;
      g.add(pts);
      return { points: pts, pos, vel, N, box };
    }
    function staticRain(g, box) {
      if (!reduce || !box) return;
      const wind = S().wind / 100;
      const dir = new T.Vector3(0, -1, -wind * 0.9).normalize();
      for (let i = 0; i < 6; i++) {
        const x = box.x0 + ((i + 0.5) / 6) * (box.x1 - box.x0);
        const a = new T.ArrowHelper(dir, new T.Vector3(x, box.y1 - 4, box.z0 + 8 + (i % 2) * 5), 12, P.water, 4, 2.4);
        a.renderOrder = 10;
        a.line.material.depthTest = false; a.cone.material.depthTest = false;
        g.add(a);
      }
    }

    // ---------- frame ----------
    const B3 = (x0, y0, z0, x1, y1, z1) => new T.Box3(new T.Vector3(x0, y0, z0), new T.Vector3(x1, y1, z1));
    let frameBox = B3(0, 0, 0, 10, 10, 10);
    let frameDir = [0.7, 0.45, 1.4];
    let framePad = 1.12;

    // =====================================================================
    // FORCES: one cladding joint close-up
    // =====================================================================
    const FX = 0.7; // x of the path plane, just in front of the section face
    const FD = 9; // depth of the extrusion (toward -x)
    const J = W.JOINT;
    const uv = (p) => [FX, p[1], p[0]];

    function buildForces(g) {
      const s = S();
      const f = W.FORCES.find((x) => x.id === s.forceId);
      const on = s.defenseOn;
      const t = W.traceForce(f.id, on);
      LH = narrow ? 1.75 : 1.4;
      const clad = P.dark ? '#b79a6e' : '#d2b27a';
      const back = P.dark ? '#7b776c' : '#a29d90';
      const def = P.accent;
      const bx = (u0, u1, v0, v1, hex, o) => addBox(g, [-FD, 0, v0, v1, u0, u1], hex, o);
      // backup wall
      bx(-J.backDepth, J.backU, -J.half, J.half, back);
      let up = [[J.cladInner, 0.25], [J.cladOuter, 0.25], [J.cladOuter, J.panelH], [J.cladInner, J.panelH]];
      const id = f.id;
      const plain = (gap) => {
        bx(J.cladInner, J.cladOuter, gap, J.panelH, clad);
        bx(J.cladInner, J.cladOuter, -J.panelH, -gap, clad);
      };
      if (id === 'momentum') {
        plain(J.halfGap);
        if (on) bx(0.6, 1.0, -3.5, 1.6, def);
      } else if (id === 'gravity') {
        bx(J.cladInner, J.cladOuter, 0.25, J.panelH, clad);
        if (on) {
          addPrism(g, [[1.5, -10], [4, -10], [4, -0.6], [1.5, 0]], clad, FD);
          bx(4, 5, -2, J.panelH, def);
        } else {
          addPrism(g, [[1.5, -10], [4, -10], [4, 0], [1.5, -0.9]], clad, FD);
        }
      } else if (id === 'tension') {
        bx(J.cladInner, J.cladOuter, 0.25, J.panelH, clad);
        bx(J.cladInner, 2.6, -J.panelH, -0.25, clad);
        if (on) addBox(g, [-FD, 0.06, 0.2, 0.9, 3.3, 3.6], def, { edges: false });
      } else if (id === 'capillary') {
        if (on) {
          const gap = 0.12; const pk = 0.9;
          for (const sgn of [1, -1]) {
            const a = sgn > 0 ? gap : -J.panelH; const b = sgn > 0 ? J.panelH : -gap;
            const lo = sgn > 0 ? gap : -pk; const hi = sgn > 0 ? pk : -gap;
            // two outer pieces and one piece set back from the gap (the pocket)
            bx(J.cladInner, 2.3, a, b, clad);
            bx(3.2, J.cladOuter, a, b, clad);
            if (sgn > 0) bx(2.3, 3.2, pk, J.panelH, clad); else bx(2.3, 3.2, -J.panelH, -pk, clad);
            void lo; void hi;
          }
          addBox(g, [-FD, 0.06, -0.9, 0.9, 2.3, 3.2], def, { opacity: 0.22, edges: false });
        } else {
          plain(0.1);
        }
      } else if (id === 'pressure') {
        plain(J.halfGap);
        if (on) {
          // vents at the top and bottom, air barrier on the room side
          for (const sg of [1, -1]) addBox(g, [-FD, 0.06, sg * 8.2 - 0.5, sg * 8.2 + 0.5, J.cladInner, J.cladOuter], def, { edges: false });
          bx(-4.35, -4, -J.half, J.half, '#7a4fd6');
        } else {
          for (const sg of [1, -1]) bx(0, J.cladInner, sg * 9.2 - 0.4, sg * 9.2 + 0.4, '#3a362e');
        }
      }
      void up;
      // paths
      const r = 0.11;
      const windBoost = (id === 'momentum' || id === 'pressure') ? 1 + S().wind / 60 : 1;
      t.path.forEach((p, i) => addPath(g, p.points.map(uv), p.kind, { r, speed: 0.22 * windBoost + 0.0 * i }));
      const lk = t.path.find((p) => p.kind === 'leak');
      if (lk) {
        const e = lk.points[lk.points.length - 1];
        if (id === 'pressure') patch(g, { x0: -1.5, x1: 1.5, y0: -2, y1: 2.2, z: -4.1 + 0.001 });
        else patch(g, { x0: -2.8, x1: 2.6, y0: e[1] - 1.6, y1: e[1] + 1.6, z: Math.max(0.05, e[0] + 0.05) });
      }
      // wind arrows for the wind-driven forces
      if (id === 'momentum' || id === 'pressure') {
        const am = new T.MeshBasicMaterial({ color: P.dark ? '#c8d4e4' : '#51657f', transparent: true, opacity: 0.9, depthTest: false });
        const body = new T.CylinderGeometry(0.1, 0.1, 3, 8);
        const head = new T.ConeGeometry(0.34, 0.9, 10);
        [-5, -2.4, 0.4, 3, 5.6].forEach((y, i) => {
          const a = new T.Group();
          const b = new T.Mesh(body, am); b.rotation.x = Math.PI / 2; b.position.z = 1.5;
          const h = new T.Mesh(head, am); h.rotation.x = -Math.PI / 2; h.position.z = -0.4;
          a.add(b, h);
          a.renderOrder = 8; b.renderOrder = 8; h.renderOrder = 8;
          a.position.set(FX, y, 13);
          g.add(a);
          windArrows.push({ mesh: a, y, phase: i * 0.37, active: i });
        });
      }
      // labels
      const L = (txt, pos, tgt) => label(g, txt, pos, tgt);
      L('BACKUP WALL', [FX, -10.2, -2.5], null);
      L('CLADDING', [FX, 7.2, 6.8], [FX, 7.2, J.cladOuter]);
      const names = {
        momentum: on ? ['BAFFLE', [FX, -5.6, 2.2], [FX, -3, 0.9]] : ['OPEN JOINT', [FX, 3.4, 8.6], [FX, 0.1, 4]],
        gravity: on ? ['LAP', [FX, 4.2, 8.2], [FX, 2, 4.6]] : ['LEDGE SLOPES IN', [FX, -4.8, 9], [FX, -0.4, 3]],
        tension: on ? ['DRIP KERF', [FX, 3.6, 6.8], [FX, 0.5, 3.45]] : ['LEVEL UNDERSIDE', [FX, 3.6, 8.5], [FX, 0.2, 3.2]],
        capillary: on ? ['AIR GAP', [FX, 3.4, 6.2], [FX, 0.9, 2.75]] : ['NARROW GAP', [FX, 3.4, 8], [FX, 0.1, 3]],
        pressure: on ? ['VENT', [FX, 10.8, 7.2], [FX, 8.2, 3]] : ['SEALED CAVITY', [FX, 10.8, 8.6], [FX, 9.2, 0.8]],
      }[id];
      L(names[0], names[1], names[2]);
      if (id === 'pressure' && on) {
        L('P OUT = P CAVITY', [FX, -11, 6.2], [FX, -9, 1.2]);
        L('AIR BARRIER', [FX, 6, -8.6], [FX, 6, -4.3]);
      }
      if (id === 'gravity' && on) L('SLOPES OUT', [FX, -5.6, 9], [FX, -0.3, 3]);
      stage.requestRender();
      frameBox = B3(-5, -9.5, id === 'pressure' ? -9 : -5, 3, 9.5, 12);
      frameDir = [2.4, 0.3, 0.5];
      framePad = 0.9;
    }

    // =====================================================================
    // WALLS: 48 in sample, stepped cutaway
    // =====================================================================
    const STEP = 4;
    function crack(g, x, y, zFace) {
      const pts = [[0, 3.4], [0.9, 1.6], [-0.5, 0.2], [0.8, -1.4], [0, -3.4]];
      const m = new T.MeshBasicMaterial({ color: P.dark ? '#050505' : '#101010' });
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]; const b = pts[i + 1];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const bar = new T.Mesh(new T.BoxGeometry(0.45, L, 0.5), m);
        bar.position.set(x + (a[0] + b[0]) / 2, y + (a[1] + b[1]) / 2, zFace + 0.02);
        bar.rotation.z = -Math.atan2(b[0] - a[0], b[1] - a[1]);
        g.add(bar);
      }
    }
    function buildWalls(g) {
      const s = S();
      const sid = s.strategyId;
      const strat = W.STRATEGIES.find((x) => x.id === sid);
      const tr = W.traceStrategy(sid, s.fault);
      const layers = W.STRAT.layers[sid];
      const n = layers.length;
      const fz = W.STRAT.faceZ[sid];
      const sz = W.STRAT.size;
      LH = narrow ? 3.6 : 2.9;
      const COL = {
        block: P.dark ? '#8f9298' : '#9a9da3', sheathing: sid === 'barrier' ? '#7fa36b' : '#dba44f',
        foam: sid === 'barrier' ? '#d6e6f7' : '#2f7de1', coat: '#efe3c8', wrb: '#7fe0d2',
        cladding: '#cdb99a', backup: '#8a8d91', insulation: '#2f7de1', cavity: '#bfe3f2', brick: '#b5382a',
      };
      if (sid === 'rainscreen') COL.insulation = '#f0b429';
      const tops = layers.map((l, i) => sz + STEP * (n - 1 - i));
      layers.forEach((l, i) => {
        const hex = COL[l.id];
        const isCav = l.id === 'cavity';
        const thin = l.z1 - l.z0 < 0.4;
        const b = addBox(g, [0, sz, 0, tops[i], l.z0, l.z1], hex, isCav ? { opacity: 0.18, edge: 0.35 } : thin ? { edge: 0.8 } : {});
        void b;
        if (l.id === 'brick') {
          const lm = new T.LineBasicMaterial({ color: P.dark ? '#40130d' : '#6b1d14', transparent: true, opacity: 0.7 });
          for (let y = 2.67; y < tops[i]; y += 2.67) {
            const geo = new T.BufferGeometry().setFromPoints([new T.Vector3(0, y, l.z1 + 0.03), new T.Vector3(sz, y, l.z1 + 0.03)]);
            g.add(new T.Line(geo, lm));
            const geo2 = new T.BufferGeometry().setFromPoints([new T.Vector3(sz + 0.03, y, l.z0), new T.Vector3(sz + 0.03, y, l.z1)]);
            g.add(new T.Line(geo2, lm));
          }
        }
      });
      // rainscreen: flashing with a 3/4 in drip, weep holes 24 in o.c.
      if (sid === 'rainscreen') {
        const fy = W.STRAT.flashY;
        const z0 = 6.0; const zf = fz + W.DIMENSIONS.flashingProjection;
        addBox(g, [0, sz, fy, fy + 0.3, z0, zf], P.metal, { metal: true });
        const drip = addBox(g, [0, sz, -0.15, 0.15, 0, 0.9], P.metal, { metal: true, edges: false });
        drip.position.set(sz / 2, fy + 0.15 - 0.3, zf + 0.12);
        drip.rotation.x = -Math.PI / 4;
        for (const x of W.STRAT.weepX) addBox(g, [x - 0.6, x + 0.6, W.STRAT.weepY - 1.1, W.STRAT.weepY + 1.1, fz - 0.2, fz + 0.1], '#1a1a1a', { edges: false });
        if (!narrow) {
          const wl = label(g, `WEEP HOLES ${W.DIMENSIONS.weepSpacingBrick}" O.C.`, [20, -3.6, fz + 3.5], [20, W.STRAT.weepY, fz + 0.1]);
          void wl;
        }
      }
      if (s.fault) crack(g, W.STRAT.xp, W.STRAT.crackY, fz);
      // paths
      tr.paths.forEach((p) => addPath(g, p.points, p.kind, { r: 0.42, speed: p.kind === 'shed' ? 1.25 : p.kind === 'absorb' ? 0.4 : 1 }));
      tr.paths.forEach((p) => { if (p.patch) patch(g, p.patch); });
      // labels
      const names = {
        mass: { block: 'MASS WALL' },
        barrier: { sheathing: 'SHEATHING', foam: 'FOAM', coat: 'SEAL' },
        drainage: { sheathing: 'SHEATHING', wrb: 'WRB', cladding: 'CLADDING' },
        rainscreen: { backup: 'BACKUP WALL', insulation: 'INSULATION', wrb: 'WRB', cavity: '2 IN CAVITY', brick: 'BRICK' },
      }[sid];
      layers.forEach((l, i) => {
        if (!names[l.id]) return;
        if (narrow && sid === 'rainscreen' && l.id === 'insulation') return;
        const zm = (l.z0 + l.z1) / 2;
        label(g, names[l.id], [-6, tops[i] + 3.2, zm - 1], [0, tops[i], zm]);
      });
      if (sid === 'mass') label(g, 'ABSORBS, THEN DRIES', [sz + 2, 55, 8], [sz - 1, 46, 8]);
      if (sid === 'barrier') label(g, s.fault ? 'CRACK: NO WAY OUT' : 'ONE UNBROKEN SEAL', [sz + 4, 56, fz + 4], [W.STRAT.xp, s.fault ? W.STRAT.crackY + 3.4 : 44, fz], { warn: s.fault });
      if (sid === 'drainage') label(g, 'WATER DRAINS DOWN THE WRB', [sz + 6, 56, 4], [W.STRAT.xp, 20, 1.4]);
      if (sid === 'rainscreen' && !narrow) label(g, 'DRAINS AT THE BOTTOM', [sz + 6, 22, 15], [W.STRAT.xp, 7, 12]);
      const rb = { x0: 0, x1: sz + 2, y0: 0, y1: 56, z0: fz + 1.5, z1: fz + 24, size: 0.9 };
      rainObj = makeRain(g, rb);
      staticRain(g, rb);
      frameBox = B3(-8, 0, 0, sz + 2, sz + STEP * (n - 1) + 8, Math.max(fz, 8));
      frameDir = [1.6, 0.6, 0.85];
      framePad = 1.05;
    }

    // =====================================================================
    // ERRORS: drained brick wall with a window
    // =====================================================================
    function buildErrors(g) {
      const s = S();
      const E = new Set(s.errors);
      const Wl = W.WALL;
      const win = Wl.window;
      const tr = W.traceErrors(s.errors);
      LH = narrow ? 3.7 : 3.0;
      const hole = { x0: win.x0, x1: win.x1, y0: win.y0, y1: win.y1 };
      const brick = '#b5382a';
      // framed backup
      const wood = P.wood;
      const studs = [[0, 1.5], [9.25, 10.75], [49.25, 50.75], [58.5, 60], [18.5, 20], [40, 41.5]];
      studs.forEach(([a, b]) => addBox(g, [a, b, 0, Wl.height, Wl.zStud0, Wl.zStud1], wood, { edge: 0.3 }));
      addBox(g, [20, 40, 42, 44.5, Wl.zStud0, Wl.zStud1], wood, { edge: 0.3 });
      addBox(g, [20, 40, 21.5, 24, Wl.zStud0, Wl.zStud1], wood, { edge: 0.3 });
      // sheathing
      addSlab(g, { x0: 0, x1: Wl.width, y0: 0, y1: Wl.height, z0: Wl.zSheathing0, z1: Wl.zSheathing1, hole }, '#dba44f', { opacity: 0.55, edge: 0.4 });
      // WRB: two lapped courses
      const rev = E.has('reverse_lap');
      const lo = { x0: 0, x1: Wl.width, y0: 0, y1: Wl.lapY + Wl.lapOverlap, hole };
      const hi = { x0: 0, x1: Wl.width, y0: Wl.lapY, y1: Wl.height, hole };
      const back = [Wl.zWrbBack0, Wl.zWrbBack1];
      const front = [Wl.zWrbFront0, Wl.zWrbFront1];
      const zl = rev ? front : back; // lower course
      const zu = rev ? back : front; // upper course
      addSlab(g, { ...lo, z0: zl[0], z1: zl[1] }, '#35b5a8', { opacity: 0.6, edge: 0.75 });
      addSlab(g, { ...hi, z0: zu[0], z1: zu[1] }, '#8deadd', { opacity: 0.6, edge: 0.75 });
      // cladding
      const noGap = E.has('no_gap');
      const cz0 = noGap ? Wl.zCavity0 : Wl.zCladding0;
      const cz1 = cz0 + (Wl.zCladding1 - Wl.zCladding0);
      const face = cz1;
      addSlab(g, { x0: 0, x1: Wl.width, y0: Wl.baseFlashY, y1: Wl.height, z0: cz0, z1: cz1, hole }, brick, { opacity: 0.3, edge: 0.4 });
      // brick course lines on the face
      const lm = new T.LineBasicMaterial({ color: P.dark ? '#ff8c7a' : '#6b1d14', transparent: true, opacity: 0.45 });
      for (let y = Wl.baseFlashY + 2.67; y < Wl.height; y += 2.67) {
        const segs = [];
        if (y > win.y0 && y < win.y1) { segs.push([0, win.x0], [win.x1, Wl.width]); } else segs.push([0, Wl.width]);
        segs.forEach(([a, b]) => g.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(a, y, face + 0.03), new T.Vector3(b, y, face + 0.03)]), lm)));
      }
      // base: ledge below the flashing
      addBox(g, [0, Wl.width, 0, Wl.baseFlashY - 0.2, Wl.zStud0, Wl.zFlashOut - 0.8], P.dark ? '#5d5a54' : '#9b968a', { edge: 0.4 });
      // base flashing
      const fl = P.metal;
      addBox(g, [0, Wl.width, Wl.baseFlashY - 0.2, Wl.baseFlashY + 0.1, Wl.zWrb, Wl.zFlashOut], fl, { metal: true });
      addBox(g, [0, Wl.width, Wl.baseFlashY - 0.2, Wl.baseFlashY + 2, Wl.zWrb, Wl.zWrb + 0.2], fl, { metal: true, edges: false });
      const dripB = addBox(g, [0, Wl.width, -0.1, 0.1, 0, 0.8], fl, { metal: true, edges: false });
      dripB.position.set(Wl.width / 2, Wl.baseFlashY - 0.45, Wl.zFlashOut + 0.1);
      dripB.rotation.x = -Math.PI / 4;
      // weep holes
      if (!E.has('no_weeps')) {
        Wl.weepX.forEach((x) => addBox(g, [x - 0.7, x + 0.7, Wl.weepY - 1.1, Wl.weepY + 1.1, face - 0.3, face + 0.1], '#161616', { edges: false }));
      }
      // head flashing
      if (!E.has('no_head_flashing')) {
        const y = Wl.headFlashY;
        addBox(g, [win.x0 - 2, win.x1 + 2, y, y + 0.3, Wl.zWrb, Wl.zFlashOut], fl, { metal: true });
        addBox(g, [win.x0 - 2, win.x1 + 2, y, y + W.DIMENSIONS.headFlashingTurnUp, Wl.zWrb, Wl.zWrb + 0.25], fl, { metal: true, edges: false });
        const dh = addBox(g, [win.x0 - 2, win.x1 + 2, -0.1, 0.1, 0, 0.8], fl, { metal: true, edges: false });
        dh.position.set((win.x0 + win.x1) / 2, y - 0.3, Wl.zFlashOut + 0.1);
        dh.rotation.x = -Math.PI / 4;
        dh.scale.set(1, 1, 1);
      }
      // window
      const frame = P.dark ? '#d6cdb6' : '#5b5448';
      addBox(g, [win.x0, win.x1, win.y0, win.y0 + 1.5, 2.2, 5.4], frame, { edge: 0.3 });
      addBox(g, [win.x0, win.x1, win.y1 - 1.5, win.y1, 2.2, 5.4], frame, { edge: 0.3 });
      addBox(g, [win.x0, win.x0 + 1.5, win.y0, win.y1, 2.2, 5.4], frame, { edge: 0.3 });
      addBox(g, [win.x1 - 1.5, win.x1, win.y0, win.y1, 2.2, 5.4], frame, { edge: 0.3 });
      addBox(g, [win.x0 + 1.5, win.x1 - 1.5, win.y0 + 1.5, win.y1 - 1.5, Wl.zGlass - 0.1, Wl.zGlass + 0.1], '#9fd3f0', { opacity: 0.35, edges: false });
      // sill pan with end dams
      addBox(g, [win.x0, win.x1, Wl.sillY - 0.1, Wl.sillY + 0.2, 1.0, Wl.zFlashOut], fl, { metal: true });
      if (!E.has('no_end_dam')) {
        addBox(g, [win.x0, win.x0 + 0.4, Wl.sillY - 0.1, Wl.sillY + 2.2, 1.0, face + 0.3], fl, { metal: true });
        addBox(g, [win.x1 - 0.4, win.x1, Wl.sillY - 0.1, Wl.sillY + 2.2, 1.0, face + 0.3], fl, { metal: true });
      }
      // paths and patches
      tr.paths.forEach((p) => addPath(g, p.points, p.kind, { r: 0.42, speed: p.kind === 'shed' ? 1.25 : 1 }));
      tr.leaks.forEach((l) => patch(g, l.patch));
      // labels
      const fz = face;
      const Lb = (txt, pos, tgt, warn) => label(g, txt, pos, tgt, { warn });
      if (!E.has('no_head_flashing')) Lb(narrow ? 'HEAD FLASHING' : 'HEAD FLASHING, 2 IN UP', [14, 52.5, fz + 6], [20, Wl.headFlashY + 0.2, fz + 0.5]);
      else Lb('NO HEAD FLASHING', [14, 52.5, fz + 6], [24, 42.4, 4.4], true);
      if (!E.has('no_end_dam')) Lb(narrow ? 'SILL PAN' : 'SILL PAN + END DAMS', [8, 19, fz + 6], [20.4, Wl.sillY + 0.3, fz + 0.4]);
      else Lb('NO END DAM', [8, 19, fz + 6], [20.4, Wl.sillY + 0.3, fz + 0.4], true);
      if (!E.has('no_weeps')) { if (!narrow) Lb(`WEEP HOLES ${W.DIMENSIONS.weepSpacingBrick}" O.C.`, [44, -3.5, fz + 6], [54, Wl.weepY, fz + 0.2]); }
      else Lb('NO WEEP HOLES', [44, -3.5, fz + 6], [54, Wl.weepY, fz + 0.2], true);
      if (!E.has('reverse_lap')) { if (!narrow) Lb('WRB LAP', [-9, 56, 6], [0, Wl.lapY + 1.5, Wl.zWrb]); }
      else Lb('REVERSE LAP', [-9, 56, 6], [0, Wl.lapY + 1.5, Wl.zWrb], true);
      if (!E.has('no_gap')) { if (!narrow) Lb('DRAINAGE GAP', [69, 36, 5.4], [60, 36, 5.4]); }
      else Lb('NO GAP', [69, 36, 5.4], [60, 36, 5.4], true);
      if (!narrow) Lb('BRICK', [70, 54, fz], [60, 54, fz]);
      const rb = { x0: -2, x1: Wl.width + 4, y0: 0, y1: 66, z0: fz + 1.5, z1: fz + 26, size: 0.9 };
      rainObj = makeRain(g, rb);
      staticRain(g, rb);
      frameBox = B3(-3, -2, 0, 66, 62, 12);
      frameDir = [0.95, 0.38, 1.1];
      framePad = 0.98;
    }

    // =====================================================================
    // LAYERS: the chosen wall, control layers colored
    // =====================================================================
    function rolesFor(wall) { return W.layerRoles(wall, MATERIALS); }
    function buildLayers(g) {
      const s = S();
      const wall = cloneWall(s.layerWall || 'W1');
      const roles = rolesFor(wall);
      const sz = 48;
      const n = wall.layers.length;
      LH = narrow ? 3.6 : 2.9;
      const colOf = Object.fromEntries(W.CONTROL_LAYERS.map((c) => [c.id, c.color]));
      const focus = s.layer; // id or 'all'
      let z = 0;
      const info = [];
      wall.layers.forEach((l, i) => {
        const m = MATERIALS[l.materialId];
        const th = Math.max(l.thickness, 0.5);
        const z0 = z; const z1 = z + th; z = z1;
        const r = roles[i];
        const active = focus === 'all' ? LAYER_ORDER.find((id) => r.roles.includes(id)) : (r.roles.includes(focus) ? focus : null);
        const top = sz + 2.8 * (n - 1 - i);
        const isAir = m.control === 'airspace';
        let hex = active ? colOf[active] : (r.cladding ? (P.dark ? '#a39a86' : '#a89d86') : (i % 2 ? P.neutral2 : P.neutral));
        const dim = !active && !r.cladding;
        if (l.framing) {
          // studs and batt
          const d = l.framing.depth;
          const sx = [8, 24, 40];
          const stud = l.framing.type === 'steel' ? '#6b7682' : '#c79a5b';
          let xa = 0;
          sx.forEach((x) => {
            if (x - 0.75 > xa) addBox(g, [xa, x - 0.75, 0, top, z0, z1], hex, dim ? { opacity: 0.8 } : {});
            addBox(g, [x - 0.75, x + 0.75, 0, top, z0, z0 + Math.min(d, th)], stud);
            xa = x + 0.75;
          });
          addBox(g, [xa, sz, 0, top, z0, z1], hex, dim ? { opacity: 0.8 } : {});
        } else {
          addBox(g, [0, sz, 0, top, z0, z1], hex, isAir ? { opacity: 0.2, edge: 0.4 } : dim ? { opacity: 0.85 } : {});
        }
        info.push({ i, z0, z1, top, active, r, m });
      });
      const total = z;
      // labels
      const nameFor = { water: 'WATER: WRB', air: 'AIR BARRIER', vapor: 'VAPOR RETARDER', thermal: 'INSULATION' };
      info.forEach((q) => {
        let txt = null;
        if (q.active) txt = nameFor[q.active];
        else if (q.r.cladding) txt = 'CLADDING';
        if (!txt) return;
        if (narrow && q.r.cladding && focus !== 'all') return;
        label(g, txt, [-6, q.top + 3.2, (q.z0 + q.z1) / 2 - 1], [0, q.top, (q.z0 + q.z1) / 2]);
      });
      // exterior and interior markers
      label(g, 'ROOM', [sz / 2, -4, -3.2], null);
      label(g, 'OUTSIDE', [sz / 2, -4, total + 3.2], null);
      frameBox = B3(-8, 0, -2, sz + 2, sz + 2.8 * (n - 1) + 6, total + 2);
      frameDir = [1.25, 0.55, 0.8];
      framePad = 1.05;
    }

    // ---------- build ----------
    function build() {
      narrow = ctx.isNarrow();
      P = palette();
      disposeObj(content);
      stage.scene.remove(content);
      content = new T.Group();
      stage.scene.add(content);
      droplets = [];
      windArrows = [];
      rainObj = null;
      const v = S().view;
      if (v === 'forces') buildForces(content);
      else if (v === 'walls') buildWalls(content);
      else if (v === 'errors') buildErrors(content);
      else buildLayers(content);
      stage.requestRender();
    }
    function frameView() { stage.frame(frameBox, { dir: frameDir, padding: framePad }); }

    // ---------- animation ----------
    const offFrame = stage.onFrame((dt, t) => {
      const s = S();
      if (!reduce) {
        for (const d of droplets) {
          if (!d.mesh.visible) continue;
          const unit = s.view === 'forces' ? 5 : 22;
          const sp = (unit * (0.35 + s.rain / 100) * d.speed) / d.len;
          d.off = (d.off + dt * sp) % 1;
          d.mesh.position.copy(d.curve.getPointAt(d.off));
        }
        if (rainObj) {
          const { pos, vel, N, box, points } = rainObj;
          const cnt = Math.round(N * (s.rain / 100));
          points.geometry.setDrawRange(0, cnt);
          const vy = 38 + 50 * (s.rain / 100);
          const wind = s.wind / 100;
          for (let i = 0; i < cnt; i++) {
            const k = i * 3;
            pos[k + 1] -= vy * vel[i] * dt;
            pos[k + 2] -= wind * vy * 0.8 * vel[i] * dt;
            pos[k] -= wind * vy * 0.12 * vel[i] * dt * 0;
            if (pos[k + 1] < box.y0 || pos[k + 2] < box.z0) {
              pos[k] = box.x0 + Math.random() * (box.x1 - box.x0);
              pos[k + 1] = box.y1 - Math.random() * 6;
              pos[k + 2] = box.z0 + Math.random() * (box.z1 - box.z0) + wind * 30;
            }
          }
          points.geometry.attributes.position.needsUpdate = true;
        }
      }
      if (windArrows.length) {
        const wd = s.wind / 100;
        windArrows.forEach((a, i) => {
          const on = i < 1 + Math.round(wd * 4);
          a.mesh.visible = on && wd > 0.01;
          const k = reduce ? 0.3 : ((t * (0.35 + wd * 0.9) + a.phase) % 1);
          a.mesh.position.z = 13 - k * 5;
          a.mesh.scale.set(1, 1, 0.5 + wd * 1.2);
        });
      }
    });
    cleanup.push(offFrame);
    const offTheme = stage.onTheme ? stage.onTheme(() => { build(); renderAll(); }) : null;
    if (offTheme) cleanup.push(offTheme);

    // =====================================================================
    // PANEL A
    // =====================================================================
    function selRow({ name, sub, color, selected, onSelect }) {
      const row = el('div', {
        class: 'layer-row water-row', role: 'button', tabindex: '0', 'data-clickable': 'true', 'aria-pressed': selected ? 'true' : 'false',
        on: {
          click: () => onSelect(),
          keydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } },
        },
      }, el('span', { class: 'swatch', style: { background: color } }),
      el('div', { class: 'layer-main' }, el('div', { class: 'layer-name', text: name }), sub ? el('div', { class: 'layer-sub', text: sub }) : null));
      row.dataset.selected = selected ? 'true' : 'false';
      return row;
    }
    const setSel = (row, on) => { row.dataset.selected = on ? 'true' : 'false'; row.setAttribute('aria-pressed', on ? 'true' : 'false'); };

    const viewSeg = segmented({ options: VIEWS, value: S().view, onChange: (v) => { setS({ view: v }); buildControls(); build(); frameView(); renderB(); renderSummary(); } });
    const viewBox = el('div', { class: 'water-view', style: 'display:flex;flex-direction:column;gap:18px' });
    panelA.append(viewSeg.el, viewBox);

    const refs = {};
    function buildControls() {
      viewBox.replaceChildren();
      for (const k of Object.keys(refs)) delete refs[k];
      const s = S();
      if (s.view === 'forces') {
        refs.rows = {};
        const list = el('div', { class: 'water-list' });
        W.FORCES.forEach((f, i) => {
          const row = selRow({
            name: `${i + 1}. ${f.name}`, sub: f.problem, color: palette().water, selected: s.forceId === f.id,
            onSelect: () => {
              if (S().forceId === f.id) return;
              setS({ forceId: f.id });
              W.FORCES.forEach((g) => setSel(refs.rows[g.id], g.id === f.id));
              makeDefToggle();
              build(); frameView(); renderB(); renderSummary();
            },
          });
          refs.rows[f.id] = row;
          list.appendChild(row);
        });
        refs.defHolder = el('div');
        viewBox.append(section('Five forces', list), section('Defense', refs.defHolder));
        makeDefToggle();
      } else if (s.view === 'walls') {
        refs.rows = {};
        const list = el('div', { class: 'water-list' });
        W.STRATEGIES.forEach((st) => {
          const row = selRow({
            name: st.name, sub: st.examples, color: { mass: '#8d9096', barrier: '#d6e6f7', drainage: '#cdb99a', rainscreen: '#b5382a' }[st.id], selected: s.strategyId === st.id,
            onSelect: () => {
              if (S().strategyId === st.id) return;
              setS({ strategyId: st.id });
              W.STRATEGIES.forEach((g) => setSel(refs.rows[g.id], g.id === st.id));
              build(); frameView(); renderB(); renderSummary();
            },
          });
          refs.rows[st.id] = row;
          list.appendChild(row);
        });
        refs.crack = toggle({ label: 'Add a crack in the face', value: s.fault, onChange: (v) => { setS({ fault: v }); build(); renderB(); renderSummary(); } });
        viewBox.append(section('Wall type', list), section('Fault', refs.crack.el));
      } else if (s.view === 'errors') {
        refs.tg = {};
        const wrap = el('div', { class: 'water-list' });
        W.ERRORS.forEach((e) => {
          const t = toggle({
            label: e.name, value: s.errors.includes(e.id),
            onChange: (v) => {
              const set = new Set(S().errors);
              if (v) set.add(e.id); else set.delete(e.id);
              setS({ errors: W.ERRORS.map((x) => x.id).filter((id) => set.has(id)) });
              build(); renderB(); renderSummary();
            },
          });
          refs.tg[e.id] = t;
          wrap.appendChild(el('div', { class: 'water-err' }, t.el, el('div', { class: 'layer-sub', text: e.what })));
        });
        const clear = button({
          label: 'Clear all', kind: 'ghost',
          onClick: () => { setS({ errors: [] }); Object.values(refs.tg).forEach((t) => t.set(false)); build(); renderB(); renderSummary(); },
        });
        viewBox.append(section('Five errors', wrap), clear);
      } else {
        refs.rows = {};
        const sel = select({
          label: 'Wall', value: s.layerWall,
          options: ['W1', 'W2', 'W3', 'W4'].map((id) => ({ value: id, label: `${id} · ${cloneWall(id).short}` })),
          onChange: (v) => { setS({ layerWall: v }); build(); frameView(); renderB(); renderSummary(); },
        });
        const list = el('div', { class: 'water-list' });
        const items = [...W.CONTROL_LAYERS.map((c) => ({ id: c.id, name: `${c.name} layer`, sub: c.job, color: c.color })),
          { id: 'all', name: 'All four', sub: 'Show every control layer at once.', color: 'linear-gradient(90deg,#0aa6a0,#7a4fd6,#d19a00,#e8590c)' }];
        items.forEach((it) => {
          const row = selRow({
            name: it.name, sub: it.sub, color: it.color, selected: S().layer === it.id,
            onSelect: () => {
              setS({ layer: it.id });
              items.forEach((g) => setSel(refs.rows[g.id], g.id === it.id));
              build(); renderB(); renderSummary();
            },
          });
          refs.rows[it.id] = row;
          list.appendChild(row);
        });
        viewBox.append(section('Wall', sel.el), section('Control layers', list));
      }
    }
    function makeDefToggle() {
      const f = W.FORCES.find((x) => x.id === S().forceId);
      refs.defTg = toggle({ label: `Defense: ${f.defenseName}`, value: S().defenseOn, onChange: (v) => { setS({ defenseOn: v }); build(); renderB(); renderSummary(); } });
      refs.defHolder.replaceChildren(refs.defTg.el, el('p', { class: 'layer-sub', style: 'white-space:normal;margin-top:8px;font-size:13px', text: f.defense }));
    }

    // =====================================================================
    // PANEL B
    // =====================================================================
    function stepsList(steps) {
      return el('ol', { class: 'water-steps' }, steps.map((t) => el('li', { 'data-leak': t.startsWith('Leak:') ? 'true' : 'false', text: t.replace(/^Leak:\s*/, '') })));
    }
    function renderB() {
      const s = S();
      const out = [];
      if (s.view === 'forces') {
        const f = W.FORCES.find((x) => x.id === s.forceId);
        const t = W.traceForce(f.id, s.defenseOn);
        out.push(banner({ kind: t.ok ? 'ok' : 'warn', title: t.ok ? 'The wall stays dry.' : 'Water gets into the wall.', text: `${f.name}${s.defenseOn ? ` with ${f.defenseName.toLowerCase()}` : ' with no defense'}` }));
        out.push(section('Where the water goes', stepsList(t.steps)));
        out.push(card(el('div', { class: 'water-block' },
          el('div', { class: 'water-h' }, el('span', { text: f.name }), sourceTag(f.source)),
          el('div', {}, el('b', { text: 'Problem' }), f.problem),
          el('div', {}, el('b', { text: 'Defense' }), f.defense))));
      } else if (s.view === 'walls') {
        const st = W.STRATEGIES.find((x) => x.id === s.strategyId);
        const t = W.traceStrategy(st.id, s.fault);
        out.push(banner({ kind: t.ok ? 'ok' : 'warn', title: t.ok ? 'The wall stays dry.' : 'Water gets into the wall.', text: `${st.name}${s.fault ? ' with a crack in the face' : ''}` }));
        out.push(section('Where the water goes', stepsList(t.steps)));
        out.push(card(el('div', { class: 'water-block' },
          el('div', { class: 'water-h' }, el('span', { text: st.name }), sourceTag(st.source)),
          el('div', {}, el('b', { text: 'Examples' }), st.examples),
          el('div', {}, el('b', { text: 'How it works' }), st.how),
          el('div', {}, el('b', { text: 'Weakness' }), st.weakness))));
      } else if (s.view === 'errors') {
        const t = W.traceErrors(s.errors);
        out.push(banner({
          kind: t.ok ? 'ok' : 'warn', title: t.ok ? 'The wall stays dry.' : 'Water gets into the wall.',
          text: t.ok ? 'Every detail is right. Turn on an error to see what changes.' : `${t.leaks.length} ${t.leaks.length === 1 ? 'leak' : 'leaks'} found.`,
        }));
        out.push(section('Where the water goes', stepsList(t.steps)));
        s.errors.forEach((id) => {
          const e = W.ERRORS.find((x) => x.id === id);
          out.push(card(el('div', { class: 'water-block', 'data-kind': 'leak' },
            el('div', { class: 'water-h' }, el('span', { text: e.name }), sourceTag(e.source)),
            el('div', {}, el('b', { text: 'What' }), e.what),
            el('div', {}, el('b', { text: 'Result' }), e.result),
            el('div', {}, el('b', { text: 'Fix' }), e.fix))));
        });
      } else {
        const wall = cloneWall(s.layerWall);
        const roles = rolesFor(wall);
        out.push(banner({ kind: 'info', title: `Wall ${wall.id}`, text: `${wall.name}. Pick a control layer to see which layer does the job.` }));
        const shown = s.layer === 'all' ? W.CONTROL_LAYERS : W.CONTROL_LAYERS.filter((c) => c.id === s.layer);
        shown.forEach((c) => {
          const names = roles.filter((r) => r.roles.includes(c.id)).map((r) => MATERIALS[r.materialId].name);
          out.push(card(el('div', { class: 'water-block' },
            el('div', { class: 'water-h' }, el('span', { style: { color: 'var(--ink)' } }, el('span', { class: 'swatch', style: { background: c.color, verticalAlign: 'middle', marginRight: '8px' } }), `${c.name} layer`), sourceTag(c.source)),
            el('div', {}, el('b', { text: 'Job' }), c.job),
            el('div', {}, el('b', { text: 'Rule' }), c.rule),
            el('div', {}, el('b', { text: 'In this wall' }), names.length ? names.join(', ') : 'Not drawn in this preset. Add one in Assembly mode.'))));
        });
        const clad = roles.filter((r) => r.cladding).map((r) => MATERIALS[r.materialId].name);
        out.push(el('p', { class: 'layer-sub', style: 'white-space:normal', text: `Cladding is the weather surface${clad.length ? `: ${clad.join(', ')}` : ''}.` }));
      }
      panelB.replaceChildren(...out);
    }

    // =====================================================================
    // PANEL C
    // =====================================================================
    const rainS = slider({ label: 'Rain', min: 0, max: 100, step: 5, value: S().rain, unit: '%', onInput: (v) => { setS({ rain: v }); droplets.forEach((d) => { d.mesh.visible = d.kind === 'absorb' ? v > 0 : d.idx < nDrops(); }); stage.requestRender(); } });
    const windS = slider({ label: 'Wind', min: 0, max: 100, step: 5, value: S().wind, unit: '%', onInput: (v) => { setS({ wind: v }); if (reduce) { build(); } stage.requestRender(); } });
    const D = W.DIMENSIONS;
    panelC.append(
      section('Rain and wind', rainS.el, windS.el),
      (() => { const sec = section('BCI dimensions', stats(
        stat({ label: 'Weep holes', value: `${D.weepSpacingBrick}`, unit: 'in o.c.', source: 'BCI 7.22', hint: `Brick. Concrete masonry is ${D.weepSpacingCmu} in.` }).el,
        stat({ label: 'Head flashing', value: `${D.headFlashingTurnUp}`, unit: 'in turn-up', source: 'BCI 7.22' }).el,
        stat({ label: 'Flashing drip', value: '3/4', unit: 'in, 45°', source: 'BCI 7.22', hint: 'Past the wall face' }).el,
        stat({ label: 'Air space', value: `${D.minAirSpace}`, unit: 'in min', source: 'BCI 7.44', hint: 'With insulation in the cavity' }).el,
      )); sec.classList.add('water-dims'); return sec; })(),
      section('Path colors', legend([
        { color: palette().water, label: 'Shed or drain' },
        { color: palette().absorb, label: 'Absorb' },
        { color: palette().dry, label: 'Dry (vapor)' },
        { color: palette().leak, label: 'Leak' },
      ])),
    );

    // ---------- summary ----------
    function renderSummary() {
      const s = S();
      let txt = '';
      if (s.view === 'forces') {
        const f = W.FORCES.find((x) => x.id === s.forceId);
        txt = `${f.name} · ${s.defenseOn ? f.defenseName.toLowerCase() : 'no defense'} · ${s.defenseOn ? 'dry' : 'leak'}`;
      } else if (s.view === 'walls') {
        const st = W.STRATEGIES.find((x) => x.id === s.strategyId);
        const t = W.traceStrategy(st.id, s.fault);
        txt = `${st.name}${s.fault ? ' + crack' : ''} · ${t.ok ? 'dry' : 'leak'}`;
      } else if (s.view === 'errors') {
        const t = W.traceErrors(s.errors);
        txt = t.ok ? 'Errors: none · dry' : `Errors: ${t.leaks.length} ${t.leaks.length === 1 ? 'leak' : 'leaks'} · ${s.errors.map((id) => W.ERRORS.find((e) => e.id === id).name.toLowerCase()).join(', ')}`;
      } else {
        txt = `Layers · ${s.layerWall} · ${s.layer === 'all' ? 'all four' : `${s.layer} layer`}`;
      }
      summaryEl.textContent = txt;
    }
    function renderAll() { renderB(); renderSummary(); }

    // ---------- go ----------
    buildControls();
    build();
    frameView();
    renderAll();
    void fmt;
  },
  unmount() {
    this._cleanup.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    this._cleanup = [];
  },
};
