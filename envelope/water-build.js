// envelope/water-build.js  The four 3D views of Water mode, built with realistic materials.
// Each builder fills `env.g` (a Group) and returns { calls, frame, light, hot }:
//   calls: label specs { text, anchor:[x,y,z], offset:[dx,dy,dz], id (INFO id), warn?, narrow? }
//   frame: { box:[x0,y0,z0,x1,y1,z1], dir, pad }  one fixed framing per view
//   light: { dir, floorY }   hot: per error { c:[x,y,z], dir, dist }
// Rules, paths and dimensions come from water.js. This file only decides how things look.

import * as W from './water.js';
import { MATERIALS } from './materials.js';
import { clipHalf } from './water-gfx.js';

const D = W.DIMENSIONS;

// ============================================================================ shared bits
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const V = (T, p) => new T.Vector3(p[0], p[1], p[2]);

/** Real overlapping lap boards: a prism per board, profile in (z, y). Returns the top y. */
function lapSiding(env, mat, id, x0, x1, y0, y1, zBase, o = {}) {
  const { gfx, g } = env;
  const n = o.n || 8;
  const ex = (y1 - y0 - 1.25) / n; // exposure
  const hb = ex + 1.25;
  const k = o.k || 1; // depth scale
  const tIn = 0.47 * k; const tOut = 0.78 * k; const th = 0.31 * k;
  for (let i = 0; i < n; i += 1) {
    const yb = y0 + i * ex;
    gfx.prism(g, [[zBase + tIn, yb], [zBase + tOut, yb], [zBase + th, yb + hb], [zBase, yb + hb]], x0, x1, mat, { id, grain: 'x' });
  }
  return { face: zBase + tOut, top: y0 + n * ex + 1.25 };
}

/** Warp the z of a flat extruded slab by a function of y (used for the sloped housewrap lap). */
function warpZ(mesh, fn) {
  const pos = mesh.geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) pos.setZ(i, pos.getZ(i) + fn(pos.getY(i)));
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingSphere();
  mesh.geometry.computeBoundingBox();
}

/** Steel stud as a C channel (cross section in x, z) running along y. */
function steelStud(env, x, z0, depth, y0, y1, id) {
  const { T, gfx, g } = env;
  const w = 1.625; const t = 0.06;
  const pts = [[0, 0], [w, 0], [w, 0.5], [w - t, 0.5], [w - t, t], [t, t], [t, depth - t], [w - t, depth - t], [w - t, depth - 0.5], [w, depth - 0.5], [w, depth], [0, depth]];
  const sh = new T.Shape();
  pts.forEach((p, i) => (i ? sh.lineTo(p[0], -p[1]) : sh.moveTo(p[0], -p[1])));
  sh.closePath();
  const geo = new T.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(x - w / 2, y0, z0 + depth);
  const m = gfx.finish(g, geo, env.mat('steel'), { id });
  return m;
}

// ============================================================================ ERRORS
const Wl = W.WALL;
const win = Wl.window;
const ZB = { s0: 4.06, s1: 4.14, f0: 4.3, f1: 4.38 }; // housewrap planes: back (on the sheathing) and front (lapped over)
const CAV0 = ZB.f1; // face of the front plane, start of the drainage gap
const SHIFT = 0.47; // water.js z beyond the wrap minus mine
const mz = (z) => (z <= 4.1 ? z : z >= 4.85 ? z - SHIFT : 4.1 + (z - 4.1) * ((CAV0 - 4.1) / (4.85 - 4.1)));
const A0 = 46; const A1 = 17; const A2 = 13; // corner peel legs: brick, housewrap, sheathing
const BASE = 3.8; // top of the foundation
const GLASS_Z = 6.2;

function peelPoly(yA, yB, a) {
  return clipHalf(rect(0, yA, 60, yB), 1, -1, a - 60);
}
function brickPoly(y0) {
  const c = 60 - A0;
  const yA = win.x0 + c; const xB = win.y1 - c;
  return [[0, y0], [60, y0], [60, 60], [A0, 60], [xB, win.y1], [win.x1, win.y1], [win.x1, win.y0], [win.x0, win.y0], [win.x0, yA], [0, c]];
}

export function buildErrors(env) {
  const { T, gfx, fx, g, S, narrow } = env;
  const M = (k) => gfx.M(k);
  env.mat = M;
  const E = new Set(S.errors);
  const tr = W.traceErrors(S.errors);
  const calls = [];
  const rev = E.has('reverse_lap');
  const noGap = E.has('no_gap');
  const noEnd = E.has('no_end_dam');
  const noWeep = E.has('no_weeps');
  const noHead = E.has('no_head_flashing');
  const brick0 = noGap ? CAV0 : CAV0 + 2.0;
  const face = brick0 + 3.625;
  const zl = face + 0.4; // flashing leg reaches this far, then the drip hem turns down 45 degrees
  const holeWin = [[win.x0, win.y0], [win.x0, win.y1], [win.x1, win.y1], [win.x1, win.y0]];
  const hot = {};

  // ---- foundation and brick ledge
  gfx.box(g, [0, 60, -5, BASE, 0, face], M('concrete'), { id: 'concrete' });

  // ---- framing: studs, plates, window framing, batts
  const studs = [[0, 1.5], [9.25, 10.75], [18.5, 20], [40, 41.5], [49.25, 50.75], [58.5, 60]];
  const wood = M('softwood');
  studs.forEach(([a, b]) => gfx.box(g, [a, b, BASE + 1.5, 58.5, 0, 3.5], wood, { id: 'softwood' }));
  gfx.box(g, [0, 60, BASE, BASE + 1.5, 0, 3.5], wood, { id: 'softwood', grain: 'x' });
  gfx.box(g, [0, 60, 58.5, 60, 0, 3.5], wood, { id: 'softwood', grain: 'x' });
  gfx.box(g, [20, 40, 42, 44.5, 0, 3.5], wood, { id: 'softwood', grain: 'x' });
  gfx.box(g, [20, 40, 21.5, 24, 0, 3.5], wood, { id: 'softwood', grain: 'x' });
  const batt = M('batt_r13');
  [[1.5, 9.25, BASE + 1.5, 58.5], [10.75, 18.5, BASE + 1.5, 58.5], [20, 40, BASE + 1.5, 21.5], [20, 40, 44.5, 58.5], [41.5, 49.25, BASE + 1.5, 58.5], [50.75, 58.5, BASE + 1.5, 58.5]]
    .forEach(([a, b, c, d]) => gfx.box(g, [a + 0.05, b - 0.05, c, d, 0.2, 3.4], batt, { id: 'batt' }));

  // ---- sheathing, peeled back along a diagonal
  gfx.slab(g, peelPoly(BASE, 60, A2), 3.5, 4.0, M('osb'), { holes: [holeWin], id: 'osb' });

  // ---- housewrap: two lapped courses (thin sheets), peeled back, with seam tape
  const wrb = M('wrb');
  const lowZ = rev ? [ZB.f0, ZB.f1] : [ZB.s0, ZB.s1];
  const upZ = rev ? [ZB.s0, ZB.s1] : [ZB.f0, ZB.f1];
  gfx.slab(g, peelPoly(BASE + 0.15, 53, A1), lowZ[0], lowZ[1], wrb, { holes: [holeWin], id: 'wrb' });
  if (rev) {
    gfx.slab(g, peelPoly(50, 60, A1), upZ[0], upZ[1], wrb, { id: 'wrb' });
  } else {
    gfx.slab(g, peelPoly(53, 60, A1), upZ[0], upZ[1], wrb, { id: 'wrb' });
    // head flap: the upper course comes down over the head flashing turn-up
    gfx.slab(g, rect(16, 44.5, 44, 53), upZ[0], upZ[1], wrb, { id: 'wrb' });
    // the lap: the upper course drapes down onto the lower course (a short ramp), taped
    const zb = (y) => (y <= 50 ? 0 : y >= 53 ? ZB.f0 - ZB.s1 : ((y - 50) / 3) * (ZB.f0 - ZB.s1));
    const ramps = [clipHalf(peelPoly(50, 53, A1), -1, 0, -16), clipHalf(peelPoly(50, 53, A1), 1, 0, 44)];
    ramps.forEach((poly) => {
      if (poly.length < 3) return;
      const m = gfx.slab(g, poly, ZB.s1, ZB.s1 + 0.07, wrb, { id: 'lap_joint' });
      warpZ(m, zb);
    });
    const tapes = [clipHalf(peelPoly(50.5, 52.6, A1), -1, 0, -16), clipHalf(peelPoly(50.5, 52.6, A1), 1, 0, 44)];
    tapes.forEach((poly) => {
      if (poly.length < 3) return;
      const m = gfx.slab(g, poly, ZB.s1 + 0.07, ZB.s1 + 0.1, M('tape'), { id: 'lap_joint' });
      warpZ(m, zb);
    });
    // seam tape along the flap bottom edge and the vertical seam
    gfx.box(g, [16, 44, 44.3, 45.6, upZ[1], upZ[1] + 0.03], M('tape'), { id: 'wrb' });
  }
  // jamb flashing: self-adhered membrane strips beside the window, under the wrap lap
  const jamb = M('membrane');
  gfx.box(g, [17.6, 20, 22, 43.4, ZB.s1 + 0.01, ZB.s1 + 0.08], jamb, { id: 'window_opening' });
  gfx.box(g, [40, 42.4, 22, 43.4, ZB.s1 + 0.01, ZB.s1 + 0.08], jamb, { id: 'window_opening' });

  // ---- cladding: brick, peeled back along a diagonal, with the window opening
  const brickHoleMat = M('brick');
  gfx.slab(g, brickPoly(BASE + 0.12), brick0, face, brickHoleMat, { id: 'brick', dv: -(BASE + 0.12) });
  fx.addFilm(g, brickPoly(BASE + 0.12), face + 0.03, []);

  // ---- brick ties across the gap
  const tie = M('tie');
  [[10, 12], [10, 28], [10, 44], [10, 56], [30, 12], [30, 50], [50, 12], [50, 28], [50, 44], [50, 56]].forEach(([x, y]) => {
    if (x > win.x0 - 1.2 && x < win.x1 + 1.2 && y > win.y0 - 2 && y < win.y1 + 2) return;
    gfx.box(g, [x - 0.45, x + 0.45, y - 0.05, y + 0.05, 3.9, brick0 + 1.6], tie, { id: 'brick_tie' });
    gfx.box(g, [x - 0.18, x + 0.18, y - 0.18, y + 0.18, 3.95, 4.05], tie, { id: 'brick_tie' });
  });

  // ---- base flashing with a drip hem
  const gal = M('galv');
  const BY = BASE + 0.06;
  gfx.ribbon(g, [[BY + 2.0, 4.18], [BY, 4.18], [BY, zl], [BY - 0.4, zl + 0.4]], 0, 60, 0.12, gal, { id: 'base_flashing' });
  gfx.box(g, [0, 60, BY + 2.0, BY + 2.12, 4.14, 4.3], M('sealant'), { id: 'base_flashing' }); // sealed top edge

  // ---- weep vents: louvered inserts in the head joints just above the flashing
  if (!noWeep) {
    Wl.weepX.forEach((x) => {
      gfx.box(g, [x - 0.55, x + 0.55, 4.0, 6.4, face - 0.02, face + 0.04], M('vent'), { id: 'weep_holes' });
      [4.3, 4.9, 5.5, 6.1].forEach((y) => gfx.box(g, [x - 0.5, x + 0.5, y - 0.12, y + 0.12, face + 0.04, face + 0.12], M('ventSlat'), { id: 'weep_holes' }));
    });
  }

  // ---- head flashing: 2 in. turn-up under the upper course, sloped leg, 45 degree drip
  if (!noHead) {
    const y0 = 43.42;
    const yAt = (z) => y0 - 0.0565 * (z - 4.18);
    gfx.ribbon(g, [[y0 + D.headFlashingTurnUp, 4.18], [y0, 4.18], [yAt(zl), zl], [yAt(zl) - 0.4, zl + 0.4]], 18, 42, 0.12, gal, { id: 'head_flashing' });
    fx.addDrip(g, V(T, [30, yAt(zl) - 0.5, zl + 0.45]), { r: 0.22, fall: 5, speed: 0.6 });
  }

  // ---- window: dark aluminum frame, glass, sealant around the opening
  const frame = M('frame');
  const fz = [5.2, 7.8];
  gfx.box(g, [20.5, 22, 24.5, 41.5, fz[0], fz[1]], frame, { id: 'window_opening' });
  gfx.box(g, [38, 39.5, 24.5, 41.5, fz[0], fz[1]], frame, { id: 'window_opening' });
  gfx.box(g, [22, 38, 40, 41.5, fz[0], fz[1]], frame, { id: 'window_opening' });
  gfx.box(g, [22, 38, 24.5, 26, fz[0], fz[1]], frame, { id: 'window_opening' });
  const glass = gfx.box(g, [22, 38, 26, 40, GLASS_Z - 0.06, GLASS_Z + 0.06], M('glass'), { id: 'window_opening', receive: false });
  glass.renderOrder = 6;
  [[20, 20.5, 24.1, 42], [39.5, 40, 24.1, 42], [20, 40, 41.5, 42]].forEach(([a, b, c, d]) => gfx.box(g, [a, b, c, d, 7.5, 7.95], M('sealant'), { id: 'window_opening' }));

  // ---- sill pan: sloped to the outside, back dam, end dams, 45 degree drip
  const pt = (z) => 24.3 - 0.03 * (z - 5) - 0.06;
  gfx.ribbon(g, [[25.15, 3.1], [pt(3.1), 3.1], [pt(zl), zl], [pt(zl) - 0.4, zl + 0.4]], 20, 40, 0.12, M('bronze'), { id: 'sill_pan' });
  if (!noEnd) {
    [[20, 20.14], [39.86, 40]].forEach(([a, b]) => gfx.box(g, [a, b, 24.2, 26.4, 3.1, face - 0.3], M('bronze'), { id: 'end_dam' }));
  }
  fx.addDrip(g, V(T, [30, pt(zl) - 0.5, zl + 0.45]), { r: 0.22, fall: 5, speed: 0.55 });

  // ---- base flashing drips at the weeps
  if (!noWeep && !noGap) Wl.weepX.forEach((x, i) => fx.addDrip(g, V(T, [x, BY - 0.5, zl + 0.45]), { r: 0.2, fall: 3, speed: 0.5 + i * 0.07 }));

  // ---- water: streams, pool, stains, outlines
  const mapPt = (p, id) => {
    let z = p[2];
    if (id === 'shed_window') return null;
    if (Math.abs(z - 3.9) < 1e-6) z = GLASS_Z;
    else z = mz(z);
    if (noGap && z > 9.5) z -= 2.0;
    return [p[0], p[1], z];
  };
  tr.paths.forEach((p) => {
    let pts = p.points.map((q) => mapPt(q, p.id));
    if (p.id === 'shed_window') {
      const yy = pt(zl) + 0.06;
      pts = [[30, 40.5, GLASS_Z + 0.12], [30, 26.3, GLASS_Z + 0.12], [30, 26.05, fz[1] + 0.05], [30, 25.9, fz[1] + 0.3], [30, 24.5, fz[1] + 0.45], [30, pt(8.5) + 0.08, 8.9], [30, yy + 0.04, zl - 0.2], [30, yy - 0.4, zl + 0.4]];
    }
    if (p.errorId === 'no_gap') pts = pts.map((q) => [q[0], q[1], Math.min(q[2], CAV0 + 0.05)]);
    fx.addStream(g, pts.map((q) => V(T, q)), p.kind, { r: 0.6, speed: p.kind === 'shed' ? 1.25 : 1, unit: 22 });
  });
  if (noWeep) fx.addPool(g, [0.6, 59.4, BASE + 0.15, 6.4, CAV0 + 0.1, brick0 - 0.05]);
  tr.leaks.forEach((l) => {
    const z = mz(l.patch.z);
    fx.addStain(g, l.patch, noGap && l.errorId === 'no_gap' ? CAV0 + 0.02 : z);
    fx.addWarnOutline(g, l.patch, z + 0.04);
    const cx = (l.patch.x0 + l.patch.x1) / 2; const cy = (l.patch.y0 + l.patch.y1) / 2;
    calls.push({ text: 'Leak', anchor: [cx, cy, z + 0.05], offset: [0, 0, 0], leak: true, id: { reverse_lap: 'lap_joint', no_end_dam: 'end_dam', no_weeps: 'weep_holes', no_gap: 'drainage_gap', no_head_flashing: 'head_flashing' }[l.errorId], err: l.errorId });
  });
  // rain and wet face
  const rb = { x0: -2, x1: 64, y0: 0, y1: 68, z0: face + 1.5, z1: face + 26 };
  if (env.reduce) fx.addStaticArrows(g, rb);
  fx.addRain(g, rb, { n: 450, k: 1 });

  // ---- camera close-ups, one per error (used only when the person asks)
  hot.reverse_lap = { c: [14, 51.5, 4.3], dir: [0.45, 0.2, 1], dist: 21 };
  hot.no_end_dam = { c: [21, 25, 7.5], dir: [0.7, 0.4, 1], dist: 20 };
  hot.no_weeps = { c: [30, 5.3, face], dir: [0.3, 0.35, 1], dist: 24 };
  hot.no_gap = { c: [26, 40, 5.5], dir: [-0.55, 0.15, 1], dist: 24 };
  hot.no_head_flashing = { c: [30, 43.5, 8], dir: [0.5, 0.45, 1], dist: 24 };

  // ---- labels
  const L = (text, anchor, offset, id, o = {}) => calls.push({ text, anchor, offset, id, ...o });
  L('Brick cladding', [52, 34, face], [10, 4, 3], 'brick', { n: 1 });
  L(noGap ? 'No gap: brick touches the wrap' : 'Drainage gap, 2 in.', [36, 49, noGap ? CAV0 + 0.2 : 5.4], [-24, 8, 2], 'drainage_gap', { n: 1, warn: noGap });
  L('Housewrap (WRB)', [8, 38, ZB.s1], [-14, -6, 3], 'wrb', { n: 1 });
  L(rev ? 'Reverse lap' : 'Housewrap lap', [30, 52, rev ? 4.38 : 4.25], [-25, 9, 4], 'lap_joint', { warn: rev });
  L('Sheathing', [9, 54, 4.0], [-14, 6, 4], 'osb');
  L('Wood framing', [0.8, 56, 3.5], [-12, 3, 4], 'softwood');
  L(noHead ? 'No head flashing' : 'Head flashing, 2 in. turn-up', [35, 43.2, face + 0.3], [14, 12, 3], 'head_flashing', { n: 1, warn: noHead });
  if (!noHead) L('Drip edge, 3/4 in. out', [38, 42.7, zl + 0.3], [12, 6, 4], 'drip_edge');
  L('Window', [29, 33, GLASS_Z], [20, 4, 6], 'window_opening');
  L('Sealant joint', [39.8, 31, 7.9], [14, -2, 4], 'window_opening');
  L(noEnd ? 'No end dam' : 'End dam', [noEnd ? 20.05 : 20.07, 25.4, 8.6], [-14, -7, 4], 'end_dam', { warn: noEnd });
  L('Sill pan', [33, pt(9) , 9.2], [13, -9, 4], 'sill_pan', { n: 1 });
  L(noWeep ? 'No weep holes' : 'Weep holes, 24 in. apart', [54, 5.2, face + 0.1], [8, -9, 5], 'weep_holes', { n: 1, warn: noWeep });
  L('Base flashing', [14, BY - 0.2, zl + 0.2], [-10, -10, 5], 'base_flashing', { n: 1 });
  if (!noGap) L('Air cavity', [3, 28, 6.3], [-14, 0, 5], 'cavity');

  return {
    calls, hot,
    frame: { box: [-3, -10, 0, 66, 72, 12], dir: [0.82, 0.22, 1.1], pad: 0.98 },
    light: { dir: [-0.6, 0.7, 0.75], floorY: -5.05 },
    markers: [{ text: 'Outside · rain', pos: [58, 71, face + 6], tone: 'cold' }, { text: 'Inside · dry', pos: [6, 71, -3], tone: 'warm' }],
    rainBox: rb,
  };
}

// ============================================================================ WALLS
export function buildWalls(env) {
  const { T, gfx, fx, g, S, narrow } = env;
  const M = (k) => gfx.M(k);
  env.mat = M;
  const sid = S.strategyId;
  const tr = W.traceStrategy(sid, S.fault);
  const layers = W.STRAT.layers[sid];
  const n = layers.length;
  const fzOld = W.STRAT.faceZ[sid];
  const sz = W.STRAT.size;
  const STEP = 4;
  const tops = layers.map((l, i) => sz + STEP * (n - 1 - i));
  const calls = [];
  const mkTop = (i) => tops[i];
  let faceNew = fzOld;
  let filmPoly = null;
  const xp = W.STRAT.xp;
  const gal = M('galv');
  const slabBox = (l, i, mat, id, o = {}) => gfx.box(g, [0, sz, 0, tops[i], l.z0, l.z1], mat, { id, ...o });
  const byId = (id) => layers.findIndex((l) => l.id === id);

  if (sid === 'mass') {
    const l = layers[0];
    slabBox(l, 0, M('brick'), 'brick');
    filmPoly = [rect(0, 0, sz, tops[0]), l.z1 + 0.03];
    calls.push({ text: 'Solid masonry, 12 in.', anchor: [0, tops[0], 6], offset: [-9, 5, 0], id: 'brick', n: 1 });
  } else if (sid === 'barrier') {
    const [sh, foam, coat] = layers;
    slabBox(sh, 0, M('gyp_sheath'), 'gyp_sheath');
    slabBox(foam, 1, M('eps'), 'eps');
    slabBox(coat, 2, M('eifs'), 'stucco');
    filmPoly = [rect(0, 0, sz, tops[2]), coat.z1 + 0.03];
    calls.push({ text: 'Sheathing', anchor: [0, tops[0], 0.5], offset: [-10, 5, 0], id: 'gyp_sheath', n: 1 });
    calls.push({ text: 'Foam insulation', anchor: [0, tops[1], 2.5], offset: [-10, 5, 1], id: 'eps' });
    calls.push({ text: 'Sealed finish coat', anchor: [0, tops[2], 4.4], offset: [-10, 5, 2], id: 'stucco', n: 1 });
  } else if (sid === 'drainage') {
    const [sh, wrb, cl] = layers;
    slabBox(sh, 0, M('osb'), 'osb');
    slabBox(wrb, 1, M('wrb'), 'wrb', { cast: false });
    const sd = lapSiding(env, M('fibercement'), 'fibercement', 0, sz, 0.6, tops[2], cl.z0, { n: 8, k: 1.9 });
    faceNew = sd.face;
    // furring-free: siding sits tight to the wrap, so the section face needs a closing strip
    calls.push({ text: 'Sheathing', anchor: [0, tops[0], 0.5], offset: [-10, 5, 0], id: 'osb', n: 1 });
    calls.push({ text: 'Housewrap (WRB)', anchor: [0, tops[1], 1.1], offset: [-10, 4, 2], id: 'wrb', n: 1 });
    calls.push({ text: 'Lap siding', anchor: [10, 36, faceNew - 0.2], offset: [-8, 6, 4], id: 'fibercement', n: 1 });
    calls.push({ text: 'Lap joint', anchor: [30, 24.5, faceNew - 0.3], offset: [10, -6, 4], id: 'lap_joint' });
  } else {
    const [bk, ins, wrb, cav, br] = layers;
    const fy = W.STRAT.flashY;
    slabBox(bk, 0, M('cmu8'), 'cmu8');
    slabBox(ins, 1, M('minwool'), 'minwool');
    slabBox(wrb, 2, M('wrb'), 'wrb', { cast: false });
    // ledge under the brick, flashing on top of it, brick above
    gfx.box(g, [0, sz, 0, fy, cav.z0, br.z1], M('concrete'), { id: 'concrete' });
    gfx.box(g, [0, sz, fy, tops[4], br.z0, br.z1], M('brick'), { id: 'brick', dv: -fy });
    const zf = br.z1 + 0.4;
    gfx.ribbon(g, [[fy + 2.2, 6.28], [fy + 0.06, 6.28], [fy + 0.06, zf], [fy - 0.34, zf + 0.4]], 0, sz, 0.12, gal, { id: 'base_flashing' });
    W.STRAT.weepX.forEach((x) => {
      gfx.box(g, [x - 0.6, x + 0.6, fy + 0.2, fy + 2.6, br.z1 - 0.02, br.z1 + 0.04], M('vent'), { id: 'weep_holes' });
      [0.5, 1.1, 1.7, 2.3].forEach((dy) => gfx.box(g, [x - 0.55, x + 0.55, fy + dy - 0.12, fy + dy + 0.12, br.z1 + 0.04, br.z1 + 0.12], M('ventSlat'), { id: 'weep_holes' }));
    });
    fx.addDrip(g, V(T, [W.STRAT.weepX[0], fy - 0.8, zf + 0.45]), { r: 0.28, fall: 5, speed: 0.55 });
    fx.addDrip(g, V(T, [W.STRAT.weepX[1], fy - 0.8, zf + 0.45]), { r: 0.28, fall: 5, speed: 0.62 });
    // brick ties across the cavity
    [[8, 20], [8, 38], [28, 28], [40, 14], [40, 40]].forEach(([x, y]) => gfx.box(g, [x - 0.6, x + 0.6, y - 0.07, y + 0.07, 5.9, br.z0 + 1.8], M('tie'), { id: 'brick_tie' }));
    filmPoly = [rect(0, fy, sz, tops[4]), br.z1 + 0.03];
    calls.push({ text: 'Airtight backup wall', anchor: [0, tops[0], 2], offset: [-9, 5, 0], id: 'cmu8', n: 1 });
    calls.push({ text: 'Insulation', anchor: [0, tops[1], 5], offset: [-9, 5, 1], id: 'minwool' });
    calls.push({ text: 'Housewrap (WRB)', anchor: [0, tops[2], 6.1], offset: [-9, 5, 3], id: 'wrb' });
    calls.push({ text: 'Air cavity, 2 in.', anchor: [sz, 36, 7.3], offset: [8, 4, 4], id: 'cavity', n: 1 });
    calls.push({ text: 'Brick', anchor: [0, tops[4], 10], offset: [-8, 6, 4], id: 'brick', n: 1 });
    calls.push({ text: 'Base flashing', anchor: [sz, fy - 0.1, zf + 0.3], offset: [8, -7, 5], id: 'base_flashing', n: 1 });
    if (!narrow) calls.push({ text: `Weep holes, ${D.weepSpacingBrick} in. apart`, anchor: [W.STRAT.weepX[1], fy + 1.4, br.z1 + 0.1], offset: [3, -14, 8], id: 'weep_holes' });
  }

  if (filmPoly) fx.addFilm(g, filmPoly[0], filmPoly[1], []);
  // crack in the face
  if (S.fault) {
    const zc = (sid === 'drainage' ? faceNew : fzOld) + 0.03;
    const pts = [[0, 3.4], [0.9, 1.6], [-0.5, 0.2], [0.8, -1.4], [0, -3.4]];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i]; const b = pts[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const m = gfx.box(g, [-0.2, 0.2, -len / 2, len / 2, -0.12, 0.12], M('crack'), { cast: false });
      m.position.set(xp + (a[0] + b[0]) / 2, W.STRAT.crackY + (a[1] + b[1]) / 2, zc);
      m.rotation.z = -Math.atan2(b[0] - a[0], b[1] - a[1]);
    }
    calls.push({ text: sid === 'barrier' ? 'Crack: no way out' : 'Crack in the face', anchor: [xp, W.STRAT.crackY + 3.2, zc], offset: [8, 8, 6], id: sid === 'mass' ? 'brick' : sid === 'barrier' ? 'stucco' : sid === 'drainage' ? 'fibercement' : 'brick', warn: sid === 'barrier' });
  }

  // water: map the shed path onto the real face of the siding
  tr.paths.forEach((p) => {
    const pts = p.points.map((q) => {
      let z = q[2];
      if (sid === 'drainage' && z >= fzOld - 1e-6) z = faceNew + (z - fzOld);
      return V(T, [q[0], q[1], z]);
    });
    fx.addStream(g, pts, p.kind, { r: 0.42, speed: p.kind === 'shed' ? 1.25 : p.kind === 'absorb' ? 0.4 : 1, unit: 22 });
    if (p.patch) {
      // stain on the sheathing, seen through the section face too
      const pa = p.patch;
      fx.addStain(g, pa, pa.z);
      fx.addWarnOutline(g, pa, pa.z + 0.04);
      fx.addStain(g, { x0: 0.5, x1: 3.6, y0: pa.y0, y1: pa.y1 }, sz + 0.04, { facing: 'x' });
      calls.push({ text: 'Leak', anchor: [sz, (pa.y0 + pa.y1) / 2, 2], offset: [7, -4, 4], leak: true, id: 'gyp_sheath' });
    }
    if (p.kind === 'absorb') {
      const q = p.points[p.points.length - 1];
      fx.addStain(g, { x0: Math.max(0.5, q[2] - 3), x1: fzOld - 0.4, y0: q[1] - 5, y1: q[1] + 5 }, sz + 0.04, { facing: 'x' });
    }
  });
  const rb = { x0: 0, x1: sz + 2, y0: 0, y1: 58, z0: faceNew + 1.5, z1: faceNew + 24 };
  if (env.reduce) fx.addStaticArrows(g, rb);
  fx.addRain(g, rb, { n: 380, k: 1 });
  calls.push({ text: 'Water path', anchor: [xp, 40, faceNew + 0.4], offset: [10, 12, 6], id: sid === 'rainscreen' ? 'rainscreen' : sid === 'drainage' ? 'drainage_gap' : sid === 'barrier' ? 'eps' : 'brick', narrow: false, hide: true });
  void mkTop; void byId;
  return {
    calls: calls.filter((c) => !c.hide), hot: {},
    frame: { box: [-9, 0, 0, sz + 4, sz + STEP * 4 + 6, 12], dir: [1.45, 0.55, 0.9], pad: 1.0 },
    light: { dir: [-0.5, 0.75, 0.8], floorY: -0.05 },
    markers: [{ text: 'Outside · rain', pos: [sz / 2, 0.5, 22], tone: 'cold' }, { text: 'Inside · dry', pos: [sz / 2, 0.5, -5], tone: 'warm' }],
    rainBox: rb,
  };
}

// ============================================================================ FORCES
const J = W.JOINT;
const FD = 9;
export function buildForces(env) {
  const { T, gfx, fx, g, S } = env;
  const M = (k) => gfx.M(k);
  env.mat = M;
  const id = S.forceId;
  const on = S.defenseOn;
  const t = W.traceForce(id, on);
  const calls = [];
  const clad = M('fibercement');
  const back = M('concrete');
  const gal = M('galv');
  const X = 0.7;
  const P = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  const pr = (pts, mat, mid) => gfx.prism(g, pts, -FD, 0, mat, { id: mid });
  const cl = (pts) => pr(pts, clad, 'fibercement');
  gfx.box(g, [-FD, 0, -J.half, J.half, -J.backDepth, J.backU], back, { id: 'concrete' });
  const plain = (gap) => { cl(P(J.cladInner, J.cladOuter, gap, J.panelH)); cl(P(J.cladInner, J.cladOuter, -J.panelH, -gap)); };
  const L = (text, anchor, offset, mid, o = {}) => calls.push({ text, anchor, offset, id: mid, ...o });
  let key = null;
  if (id === 'momentum') {
    plain(J.halfGap);
    if (on) { gfx.box(g, [-FD, 0, -3.5, 1.6, 0.6, 1.0], gal, { id: 'rainscreen' }); key = ['Baffle strip', [0, -3, 0.9], [0, -6, 6], 'rainscreen']; } else key = ['Open joint', [0, 0, 3], [0, 4, 6], 'rainscreen', { warn: true }];
  } else if (id === 'gravity') {
    if (on) {
      cl(P(J.cladInner, J.cladOuter, 0.25, J.panelH));
      cl([[1.5, -10], [4, -10], [4, -0.6], [1.5, 0]]);
      cl(P(4, 4.9, -2, J.panelH));
      key = ['Lap joint, like shingles', [0, -1.2, 4.9], [0, -6, 7], 'lap_joint'];
      L('Ledge slopes out', [0, -0.3, 3], [0, 3.2, 6.5], 'lap_joint');
    } else {
      cl(P(J.cladInner, J.cladOuter, 0.25, J.panelH));
      cl([[1.5, -10], [4, -10], [4, 0], [1.5, -0.9]]);
      key = ['Ledge slopes in', [0, -0.4, 3], [0, -5, 8], 'lap_joint', { warn: true }];
    }
  } else if (id === 'tension') {
    if (on) {
      cl([[1.5, 0.25], [3.0, 0.25], [3.0, 0.9], [3.45, 0.9], [3.45, 0.25], [4, 0.25], [4, J.panelH], [1.5, J.panelH]]);
      cl(P(1.5, 2.6, -J.panelH, -0.25));
      key = ['Drip edge groove', [0, 0.6, 3.2], [0, 5, 7], 'drip_edge'];
      fx.addDrip(g, V(T, [X, 0.1, 3.5]), { r: 0.16, fall: 5, speed: 0.6 });
    } else {
      cl(P(J.cladInner, J.cladOuter, 0.25, J.panelH));
      cl(P(1.5, 2.6, -J.panelH, -0.25));
      key = ['Level underside', [0, 0.2, 3.2], [0, 4, 8], 'drip_edge', { warn: true }];
    }
  } else if (id === 'capillary') {
    if (on) {
      cl([[1.5, 0.12], [2.3, 0.12], [2.3, 0.9], [3.2, 0.9], [3.2, 0.12], [4, 0.12], [4, J.panelH], [1.5, J.panelH]]);
      cl([[1.5, -J.panelH], [4, -J.panelH], [4, -0.12], [3.2, -0.12], [3.2, -0.9], [2.3, -0.9], [2.3, -0.12], [1.5, -0.12]]);
      key = ['Capillary break', [0, 0, 2.75], [0, 5, 7], 'capillary_break'];
    } else {
      plain(0.1);
      key = ['Narrow gap', [0, 0.05, 3], [0, 4, 8], 'capillary_break', { warn: true }];
    }
  } else {
    plain(J.halfGap);
    if (on) {
      [1, -1].forEach((sg) => {
        const v = sg * 8.2;
        gfx.box(g, [-FD, -0.05, v - 0.55, v + 0.55, J.cladInner, J.cladOuter], M('vent'), { id: 'rainscreen' });
        [-0.3, 0.3].forEach((d) => gfx.box(g, [-FD, -0.05, v + d - 0.1, v + d + 0.1, J.cladOuter, J.cladOuter + 0.1], M('ventSlat'), { id: 'rainscreen' }));
      });
      gfx.box(g, [-FD, 0, -J.half, J.half, -4.35, -4.0], M('membrane'), { id: 'air_barrier' });
      key = ['Vent equalizes pressure', [0, 8.2, 3], [0, 3.5, 7], 'rainscreen'];
      L('Air barrier', [0, -6, -4.2], [0, -4, -6], 'air_barrier');
    } else {
      [1, -1].forEach((sg) => gfx.box(g, [-FD, 0, sg * 9.2 - 0.4, sg * 9.2 + 0.4, 0, J.cladInner], M('sealant'), { id: 'rainscreen' }));
      key = ['Sealed cavity', [0, 9.2, 0.8], [0, 3.2, 7], 'rainscreen', { warn: true }];
    }
  }
  if (key) L(key[0], key[1], key[2], key[3], key[4] || {});
  L('Cladding panel', [0, 7, 4], [0, 4, 8], 'fibercement', { n: 1 });
  L('Backup wall', [0, -10, -2], [0, -2, -5], 'concrete', { n: 1 });
  if (id !== 'pressure') calls.find((c) => c.text === 'Cladding panel').offset = [0, 3, 7.5];

  // water paths in front of the section face
  const wind = (id === 'momentum' || id === 'pressure') ? 1 + S.wind / 60 : 1;
  t.path.forEach((p) => {
    const pts = p.points.map((q) => V(T, [X, q[1], q[0]]));
    fx.addStream(g, pts, p.kind === 'blocked' ? 'blocked' : p.kind, { r: 0.11, speed: 0.22 * wind, unit: 5 });
  });
  const lk = t.path.find((p) => p.kind === 'leak');
  if (lk) {
    const e = lk.points[lk.points.length - 1];
    // stain on the section face of the backup wall (horizontal extent is u)
    if (id === 'pressure') fx.addStain(g, { x0: -4, x1: 0.2, y0: -2, y1: 2.2 }, 0.04, { facing: 'x' });
    else fx.addStain(g, { x0: -3.4, x1: 0.2, y0: e[1] - 1.6, y1: e[1] + 1.6 }, 0.04, { facing: 'x' });
    calls.push({ text: 'Leak', anchor: [X, e[1], Math.max(0.05, e[0])], offset: [0, -3, -4], leak: true, id: key ? key[3] : 'rainscreen' });
  }
  if (id === 'momentum' || id === 'pressure') fx.addWindArrows(g, [-5, -2.4, 0.4, 3, 5.6], X, 13, 5);
  // a little rain in front of the panel
  const rb = { x0: -8, x1: 0, y0: -12, y1: 12, z0: 5.5, z1: 15 };
  if (env.reduce) { /* arrows for wind are static enough */ } else fx.addRain(g, rb, { n: 160, k: 0.32 });
  return {
    calls, hot: {},
    frame: { box: [-5, -9.5, -9, 3, 9.5, 12], dir: [2.4, 0.3, 0.5], pad: 0.92 },
    light: { dir: [0.7, 0.6, 0.55], floorY: -12.05 },
    markers: [],
    rainBox: rb,
  };
}

// ============================================================================ LAYERS
const LAYER_ORDER = ['water', 'air', 'vapor', 'thermal'];
const SHORT = {
  gyp_050: 'Gypsum board', gyp_063: 'Gypsum board', gyp_sheath: 'Gypsum sheathing', osb: 'OSB sheathing', plywood: 'Plywood sheathing',
  batt_r13: 'Fiberglass batt', batt_r19: 'Fiberglass batt', batt_r21: 'Fiberglass batt', minwool: 'Mineral wool board', xps: 'XPS foam board',
  eps: 'EPS foam board', polyiso: 'Polyiso board', ccspf: 'Spray foam', airspace: 'Air space', wrb: 'Housewrap (WRB)', brick: 'Brick',
  cmu8: 'Concrete block', concrete: 'Concrete', fibercement: 'Lap siding', vinyl: 'Vinyl siding', stucco: 'Stucco', softwood: 'Wood framing',
  steel: 'Steel framing', aluminum: 'Aluminum',
};
export function buildLayers(env) {
  const { T, gfx, g, S, narrow, cloneWall, infoForMaterial } = env;
  const M = (k) => gfx.M(k);
  env.mat = M;
  const wall = cloneWall(S.layerWall || 'W1');
  const roles = W.layerRoles(wall, MATERIALS);
  const sz = 48;
  const n = wall.layers.length;
  const colOf = Object.fromEntries(W.CONTROL_LAYERS.map((c) => [c.id, c.color]));
  const nameOf = Object.fromEntries(W.CONTROL_LAYERS.map((c) => [c.id, c.name]));
  const focus = S.layer;
  const calls = [];
  let z = 0;
  const infoId = (mid) => { const e = infoForMaterial ? infoForMaterial(mid) : null; return e ? e.id : mid; };
  const tops = wall.layers.map((l, i) => sz + 2.8 * (n - 1 - i));
  wall.layers.forEach((l, i) => {
    const m = MATERIALS[l.materialId];
    const th = Math.max(l.thickness || 0.5, 0.5);
    const z0 = z; const z1 = z + th; z = z1;
    const r = roles[i];
    const active = focus === 'all' ? LAYER_ORDER.find((rid) => r.roles.includes(rid)) : (r.roles.includes(focus) ? focus : null);
    const top = tops[i];
    const mk = (key) => {
      if (active) return gfx.variant(key, { glow: colOf[active], glowK: 0.42 });
      return gfx.variant(key, { sat: r.cladding ? 0.55 : 0.12, dim: r.cladding ? 0.92 : 0.8 });
    };
    const mid = l.materialId;
    const key = mid === 'airspace' ? 'air' : mid;
    const iid = infoId(mid);
    if (l.framing) {
      const d = Math.min(l.framing.depth, th);
      const steel = l.framing.type === 'steel';
      const studMat = steel ? gfx.variant('steel', { sat: active ? 1 : 0.1, dim: active ? 1 : 0.8 }) : gfx.variant('softwood', { sat: 0.12, dim: 0.8 });
      let xa = 0;
      [8, 24, 40].forEach((x) => {
        if (x - 0.75 > xa) gfx.box(g, [xa, x - 0.75, 0, top, z0, z1], mk(key), { id: iid });
        if (steel) steelStud(env, x, z0, d, 0, top, 'steel');
        else gfx.box(g, [x - 0.75, x + 0.75, 0, top, z0, z0 + d], studMat, { id: 'softwood' });
        xa = x + 0.75;
      });
      gfx.box(g, [xa, sz, 0, top, z0, z1], mk(key), { id: iid });
    } else if ((mid === 'fibercement' || mid === 'vinyl') && !active) {
      lapSiding(env, mk(key), iid, 0, sz, 0, top, z0, { n: 8, k: Math.max(1, th * 2.2) });
    } else if (mid === 'fibercement' || mid === 'vinyl') {
      lapSiding(env, mk(key), iid, 0, sz, 0, top, z0, { n: 8, k: Math.max(1, th * 2.2) });
    } else if (mid === 'brick') {
      gfx.box(g, [0, sz, 0, top, z0, z1], mk(key), { id: iid });
    } else {
      gfx.box(g, [0, sz, 0, top, z0, z1], mk(key), { id: iid, cast: mid !== 'airspace' });
    }
    // name tags: the control layer it plays, or cladding
    let txt = null;
    if (active) txt = `${SHORT[mid] || m.name}\n${nameOf[active]} control layer`;
    else if (r.cladding) txt = SHORT[mid] || m.name;
    else if (focus === 'all') txt = SHORT[mid] || m.name;
    if (txt && !(narrow && r.cladding && focus !== 'all') && !(narrow && !active && !r.cladding)) {
      calls.push({ text: txt, anchor: [0, top, (z0 + z1) / 2], offset: [-8, 3.2, -1], id: iid, active: !!active, n: 1 });
    }
  });
  const total = z;
  return {
    calls, hot: {},
    frame: null,
    light: { dir: [-0.55, 0.7, 0.8], floorY: -0.05 },
    markers: [{ text: 'Inside · dry', pos: [sz / 2, 0.6, -5.5], tone: 'warm' }, { text: 'Outside · rain', pos: [sz / 2, 0.6, total + 5.5], tone: 'cold' }],
    total, top: sz + 2.8 * (n - 1),
    rainBox: null,
  };
}
