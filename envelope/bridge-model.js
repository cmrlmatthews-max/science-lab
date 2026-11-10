// envelope/bridge-model.js  Geometry of the three Thermal Bridge mock-ups (Envelope Lab).
// Turns a solveBridge() result into real parts (boxes with getLook materials) that line up cell for cell with the
// solved temperature grid.
//
// Local axes (1 unit = 1 inch): x along the wall, y up, z through the wall. Interior face at z = 0, exterior +z.
//   plan detail (stud):    the cut plane is the TOP of the slice (y = H). Grid cell (i, j) is x = (i - nx/2) * cell, z = j * cell.
//   section detail:        the cut plane is the END of the slice at x = 0 and the part runs on to x = LX.
//                          Grid cell (i, j) is y = i * cell (i = 0 at the bottom), z = j * cell.

import * as THREE from 'three';
import { Mesher } from './bridge-parts.js';

export const PLAN_H = 18;      // inches of wall below the plan cut
export const LX = 12;          // inches the section parts run behind the cut
export const S_IN = 12;        // room-side stub (floor slab) in inches
export const S_OUT = 10;       // balcony stub in inches

// What each solver material is, as a real part. look = body look id, cut = look of the cut face.
const PART = {
  gyp: { look: 'gyp_063', cut: 'gypcore', info: 'gyp_063', name: 'Gypsum board' },
  sheath: { look: 'gyp_sheath', cut: 'gypcore', info: 'gyp_sheath', name: 'Gypsum sheathing' },
  batt: { look: 'batt_r19', cut: 'batt_r19', info: 'batt', name: 'Fiberglass batt' },
  softwood: { look: 'softwood', cut: 'woodend', info: 'wood_stud', name: 'Wood stud' },
  steel: { look: 'steel', cut: 'steel', info: 'steel_stud', name: 'Steel stud' },
  minwool: { look: 'minwool', cut: 'minwool', info: 'minwool', name: 'Mineral wool' },
  air: { look: 'airspace', cut: 'airspace', info: 'cavity', name: 'Air space' },
  brick: { look: 'brick', cut: 'brick', info: 'brick', name: 'Brick veneer' },
  concrete: { look: 'concrete', cut: 'concrete', info: 'slab_edge', name: 'Concrete slab' },
  clad: { look: 'fibercement', cut: 'fibercement', info: 'fibercement', name: 'Cladding' },
  studzone: { look: 'batt_r19', cut: 'batt_r19', info: 'steel_stud', name: 'Steel stud wall with batt' },
  break: { look: '__break', cut: '__break', info: 'thermal_break_unit', name: 'Thermal break' },
};

/** Part facts for a palette entry of a result. */
export function partFor(r, paletteIndex) {
  const id = r.palette[paletteIndex].id;
  const base = { ...(PART[id] || { look: 'gypcore', cut: 'gypcore', info: null, name: id }), mat: id };
  if (id === 'steel' && r.detailId === 'shelf') {
    base.info = r.variantId === 'standoff' ? 'standoff_bracket' : 'shelf_angle';
    base.name = r.variantId === 'standoff' ? 'Standoff bracket' : 'Steel shelf angle';
  }
  if (id === 'minwool' && r.detailId === 'stud') base.name = 'Continuous mineral wool';
  if (id === 'clad') base.name = 'Cladding';
  return base;
}

// Greedy rectangle merge of equal-material cells. Returns [{m, i0, i1, j0, j1}] (half open).
export function mergeRects(mats, nx, ny) {
  const seen = new Uint8Array(nx * ny);
  const out = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = j * nx + i;
      if (seen[p]) continue;
      const m = mats[p];
      let i1 = i + 1;
      while (i1 < nx && !seen[j * nx + i1] && mats[j * nx + i1] === m) i1++;
      let j1 = j + 1;
      for (; j1 < ny; j1++) {
        let ok = true;
        for (let ii = i; ii < i1; ii++) {
          const q = j1 * nx + ii;
          if (seen[q] || mats[q] !== m) { ok = false; break; }
        }
        if (!ok) break;
      }
      for (let jj = j; jj < j1; jj++) for (let ii = i; ii < i1; ii++) seen[jj * nx + ii] = 1;
      out.push({ m, i0: i, i1, j0: j, j1 });
    }
  }
  return out;
}

// Boundary segments between different materials and the outer rim, merged into straight runs: [a0, b0, a1, b1].
export function boundarySegments(mats, nx, ny) {
  const segs = [];
  for (let i = 0; i <= nx; i++) {
    let start = -1;
    for (let j = 0; j <= ny; j++) {
      let edge = false;
      if (j < ny) {
        const l = i > 0 ? mats[j * nx + i - 1] : -1;
        const rr = i < nx ? mats[j * nx + i] : -1;
        edge = l !== rr;
      }
      if (edge && start < 0) start = j;
      if (!edge && start >= 0) { segs.push([i, start, i, j]); start = -1; }
    }
  }
  for (let j = 0; j <= ny; j++) {
    let start = -1;
    for (let i = 0; i <= nx; i++) {
      let edge = false;
      if (i < nx) {
        const u = j > 0 ? mats[(j - 1) * nx + i] : -1;
        const d = j < ny ? mats[j * nx + i] : -1;
        edge = u !== d;
      }
      if (edge && start < 0) start = i;
      if (!edge && start >= 0) { segs.push([start, j, i, j]); start = -1; }
    }
  }
  return segs;
}

/** Layer stack of column 0: [{m, j0, j1}] interior to exterior. */
function column(r, i) {
  const out = [];
  for (let j = 0; j < r.ny; j++) {
    const m = r.mats[j * r.nx + i];
    const last = out[out.length - 1];
    if (last && last.m === m) last.j1 = j + 1; else out.push({ m, j0: j, j1: j + 1 });
  }
  return out;
}

/** Bounding box (cells) of a palette index. */
function cellBounds(r, m) {
  let i0 = 1e9; let i1 = -1; let j0 = 1e9; let j1 = -1;
  for (let j = 0; j < r.ny; j++) for (let i = 0; i < r.nx; i++) {
    if (r.mats[j * r.nx + i] !== m) continue;
    if (i < i0) i0 = i; if (i + 1 > i1) i1 = i + 1;
    if (j < j0) j0 = j; if (j + 1 > j1) j1 = j + 1;
  }
  return i1 < 0 ? null : { i0, i1, j0, j1 };
}

/**
 * Build the geometry description of one mock-up.
 * @param {object} r solveBridge result
 * @returns {object} model
 */
export function buildModel(r) {
  const plan = r.orientation === 'plan';
  const c = r.cell;
  const { nx, ny } = r;
  const D = ny * c;
  const mesher = new Mesher();
  const pal = r.palette.map((_, k) => partFor(r, k));
  const idxOf = (id) => r.palette.findIndex((p) => p.id === id);

  // ---- layout helpers: cell-edge coordinates (a along i, b along j) to a local point
  const P = plan
    ? (a, b, off = 0) => new THREE.Vector3((a - nx / 2) * c, PLAN_H + off, b * c)
    : (a, b, off = 0) => new THREE.Vector3(-off, a * c, b * c);
  const cellCenter = (i, j, off = 0) => P(i + 0.5, j + 0.5, off);
  const dirVec = plan ? (qi, qj) => new THREE.Vector3(qi, 0, qj) : (qi, qj) => new THREE.Vector3(0, qi, qj);
  const cutFace = plan ? 2 : 1;
  const normalOut = plan ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(-1, 0, 0);

  // ---- body from the solver grid
  const rects = mergeRects(r.mats, nx, ny);
  rects.forEach((q) => {
    const part = pal[q.m];
    if (plan) {
      mesher.box(part.look, [(q.i0 - nx / 2) * c, 0, q.j0 * c], [(q.i1 - nx / 2) * c, PLAN_H, q.j1 * c], { cut: { face: cutFace, look: part.cut } });
    } else {
      mesher.box(part.look, [0, q.i0 * c, q.j0 * c], [LX, q.i1 * c, q.j1 * c], { cut: { face: cutFace, look: part.cut } });
    }
  });

  // ---- context (not solved): room-side floor slab, floor, ceiling, balcony stub
  const contexts = [];
  const decor = { floorTop: null };
  if (!plan) {
    const cm = idxOf('concrete');
    const cb = cellBounds(r, cm);
    const y0 = cb.i0 * c; const y1 = cb.i1 * c;
    const FLOOR = 0.75; const CEIL = 0.625;
    const slabCut = { cut: { face: cutFace, look: 'concrete' } };
    mesher.box('concrete', [0, y0, -S_IN], [LX, y1, 0], slabCut);
    mesher.box('plywood', [0, y1, -S_IN], [LX, y1 + FLOOR, 0], { cut: { face: cutFace, look: 'plywood' } });
    mesher.box('gyp_063', [0, y0 - CEIL, -S_IN], [LX, y0, 0], { cut: { face: cutFace, look: 'gypcore' } });
    contexts.push({
      side: 'in', info: 'slab_edge', yLo: y0 - CEIL, yHi: y1 + FLOOR, z0: -S_IN, z1: 0, far: 'tIn',
    });
    decor.floorTop = y1 + FLOOR;
    decor.slab = { y0, y1 };
    if (r.detailId === 'slab') {
      mesher.box('concrete', [0, y0, D], [LX, y1, D + S_OUT], slabCut);
      contexts.push({
        side: 'out', info: 'balcony_slab', yLo: y0, yHi: y1, z0: D, z1: D + S_OUT, far: 'tOut',
      });
    }
  }

  const bm = idxOf('break');
  const breakInfo = bm >= 0 ? cellBounds(r, bm) : null;

  // ---- part lookup for picking and hovering
  const partAt = (i, j) => {
    const k = Math.max(0, Math.min(nx - 1, i)) + Math.max(0, Math.min(ny - 1, j)) * nx;
    return pal[r.mats[k]];
  };

  // ---- labels: { text, id, anchor (local), tier, group }
  const labels = [];
  const stack = column(r, 0);
  const rowOf = (mid) => stack.find((s) => s.m === idxOf(mid));
  const zMid = (s) => ((s.j0 + s.j1) / 2) * c;
  if (plan) {
    const xs = (nx / 2 - 1.2) * c;       // anchor near the model edge, on the cut
    const add = (m, text, id, zc) => {
      const s = rowOf(m);
      if (!s) return;
      labels.push({ text, id, anchor: new THREE.Vector3(0, PLAN_H, zc != null ? zc : zMid(s)), key: m });
    };
    add('gyp', 'Gypsum board', 'gyp_063');
    const bat = rowOf('batt');
    // stud: label it at the stud itself (centre of the slice)
    if (idxOf('softwood') >= 0) labels.push({ text: 'Wood stud', id: 'wood_stud', anchor: new THREE.Vector3(0, PLAN_H, zMid(bat)), key: 'softwood', center: true });
    if (idxOf('steel') >= 0) labels.push({ text: 'Steel stud', id: 'steel_stud', anchor: new THREE.Vector3(0, PLAN_H, zMid(bat)), key: 'steel', center: true });
    labels.push({ text: 'Fiberglass batt', id: 'batt', anchor: new THREE.Vector3(-xs + 1.0, PLAN_H, zMid(bat) + 1.2), key: 'batt' });
    add('sheath', 'Gypsum sheathing', 'gyp_sheath');
    if (idxOf('minwool') >= 0) add('minwool', 'Continuous insulation', 'continuous_insulation');
    add('clad', 'Cladding', 'fibercement');
  } else {
    const add = (m, text, id, anchorY, key) => {
      const s = rowOf(m);
      if (!s) return;
      labels.push({ text, id, anchor: new THREE.Vector3(0, anchorY, zMid(s)), key: key || m });
    };
    const top = ny > 0 ? r.nx * c : 0;      // wall height
    add('gyp', 'Gypsum board', 'gyp_063', top - 2);
    add('studzone', 'Steel stud wall with batt', 'steel_stud', top - 2);
    add('sheath', 'Gypsum sheathing', 'gyp_sheath', top - 5);
    add('minwool', 'Mineral wool', 'minwool', top - 2);
    add('air', 'Air space', 'cavity', top - 5);
    add('brick', 'Brick veneer', 'brick', top - 2);
  }

  // ---- anchors for the "coldest inside surface" marker (on the interior face, cell edge z = 0)
  const coldAnchor = P(r.minInteriorAt + 0.5, 0, 0);

  // ---- bounds of the whole mock-up (local)
  const box = new THREE.Box3();
  if (plan) {
    box.set(new THREE.Vector3(-nx * c / 2, 0, 0), new THREE.Vector3(nx * c / 2, PLAN_H, D));
  } else {
    box.set(new THREE.Vector3(0, 0, -S_IN), new THREE.Vector3(LX, nx * c, D + (r.detailId === 'slab' ? S_OUT : 0)));
  }

  return {
    plan, c, nx, ny, D, P, cellCenter, dirVec, cutFace, normalOut, mesher, rects, pal, contexts, decor,
    labels, coldAnchor, box, partAt, breakInfo, stack, idxOf, cellBounds: (id) => cellBounds(r, idxOf(id)),
  };
}
