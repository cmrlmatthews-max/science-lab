// Geometry and formula helpers for molecules. Pure functions: no DOM, no Three.js.
// Lengths in angstrom, angles in degrees, masses in g/mol.

import { ELEMENTS } from './elements.js';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => {
  const n = norm(a);
  return n === 0 ? [0, 0, 0] : [a[0] / n, a[1] / n, a[2] / n];
};

/**
 * Pick a unit vector perpendicular to u. The axis least aligned with u is projected out of,
 * so the result is stable even when u is exactly along x, y or z (ties prefer x, then y, then z).
 * @param {number[]} u unit vector
 * @returns {number[]} unit vector perpendicular to u
 */
function perpendicular(u) {
  const ax = Math.abs(u[0]), ay = Math.abs(u[1]), az = Math.abs(u[2]);
  let axis;
  if (ax <= ay && ax <= az) axis = [1, 0, 0];
  else if (ay <= az) axis = [0, 1, 0];
  else axis = [0, 0, 1];
  const proj = dot(axis, u);
  return unit(sub(axis, scale(u, proj)));
}

/**
 * Distance between two points.
 * @param {number[]} p first point [x,y,z] in angstrom
 * @param {number[]} q second point [x,y,z] in angstrom
 * @returns {number} distance in angstrom
 */
export function dist(p, q) {
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/**
 * Bond angle at the middle point q, formed by the points p-q-r.
 * @param {number[]} p first point
 * @param {number[]} q vertex of the angle
 * @param {number[]} r third point
 * @returns {number} angle in degrees, 0 to 180
 */
export function angleDeg(p, q, r) {
  const u = sub(p, q), v = sub(r, q);
  const nu = norm(u), nv = norm(v);
  if (nu === 0 || nv === 0) return 0;
  const c = Math.max(-1, Math.min(1, dot(u, v) / (nu * nv)));
  return Math.acos(c) * DEG;
}

/**
 * Dihedral (torsion) angle of the four points p-q-r-s, looking along q to r (IUPAC sign convention:
 * positive when the far bond is rotated clockwise from the near bond).
 * @param {number[]} p
 * @param {number[]} q
 * @param {number[]} r
 * @param {number[]} s
 * @returns {number} angle in degrees, -180 to 180
 */
export function dihedralDeg(p, q, r, s) {
  const b1 = sub(q, p), b2 = sub(r, q), b3 = sub(s, r);
  const n1 = cross(b1, b2), n2 = cross(b2, b3);
  const y = norm(b2) * dot(b1, n2);
  const x = dot(n1, n2);
  return Math.atan2(y, x) * DEG;
}

/**
 * Unweighted geometric center (mean position) of a list of atoms.
 * @param {{pos:number[]}[]} atoms
 * @returns {number[]} [x,y,z]; [0,0,0] for an empty list
 */
export function centroid(atoms) {
  if (!atoms.length) return [0, 0, 0];
  let x = 0, y = 0, z = 0;
  for (const a of atoms) { x += a.pos[0]; y += a.pos[1]; z += a.pos[2]; }
  const n = atoms.length;
  return [x / n, y / n, z / n];
}

/**
 * Return a copy of a structure translated so that the centroid of its atoms is at the origin.
 * The cell origin, plane points and arrow ends are shifted by the same amount. The input is not changed.
 * @param {object} structure structure in the shape of contract section 2
 * @returns {object} new, centered structure
 */
export function centerStructure(structure) {
  const c = centroid(structure.atoms);
  const shift = (p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  const out = { ...structure };
  out.atoms = structure.atoms.map((a) => ({ ...a, pos: shift(a.pos) }));
  out.bonds = (structure.bonds || []).map((b) => ({ ...b }));
  if (structure.cell) {
    out.cell = { ...structure.cell, origin: shift(structure.cell.origin) };
  }
  if (structure.extras) {
    out.extras = { ...structure.extras };
    if (structure.extras.planes) {
      out.extras.planes = structure.extras.planes.map((pl) => ({ ...pl, points: pl.points.map(shift) }));
    }
    if (structure.extras.arrows) {
      out.extras.arrows = structure.extras.arrows.map((ar) => ({ ...ar, from: shift(ar.from), to: shift(ar.to) }));
    }
  }
  return out;
}

/**
 * Molar mass from standard atomic weights.
 * @param {{el:string}[]} atoms
 * @returns {number} g/mol
 */
export function molarMass(atoms) {
  let m = 0;
  for (const a of atoms) {
    const e = ELEMENTS[a.el];
    if (!e) throw new Error(`Unknown element: ${a.el}`);
    m += e.mass;
  }
  return m;
}

function hillCounts(atoms) {
  const counts = new Map();
  for (const a of atoms) counts.set(a.el, (counts.get(a.el) || 0) + 1);
  const keys = [...counts.keys()];
  let order;
  if (counts.has('C')) {
    const rest = keys.filter((k) => k !== 'C' && k !== 'H').sort();
    order = ['C', ...(counts.has('H') ? ['H'] : []), ...rest];
  } else {
    order = keys.sort();
  }
  return order.map((k) => [k, counts.get(k)]);
}

/**
 * Molecular formula in Hill order: carbon first, then hydrogen, then the other elements alphabetically.
 * With no carbon, all elements are alphabetical. A count of 1 is omitted (for example 'C2H6O', 'H2O', 'H3N').
 * @param {{el:string}[]} atoms
 * @returns {string}
 */
export function formula(atoms) {
  return hillCounts(atoms).map(([el, n]) => (n === 1 ? el : `${el}${n}`)).join('');
}

/**
 * The same formula as {@link formula}, with the counts wrapped in <sub> tags for HTML display.
 * @param {{el:string}[]} atoms
 * @returns {string} for example 'H<sub>2</sub>O'
 */
export function formulaHtml(atoms) {
  return hillCounts(atoms).map(([el, n]) => (n === 1 ? el : `${el}<sub>${n}</sub>`)).join('');
}

/**
 * Guess single bonds from distances: two atoms are bonded when their distance is below
 * covalent(a) + covalent(b) + tolerance. Every bond is returned with order 1.
 * @param {{el:string,pos:number[]}[]} atoms
 * @param {number} [tolerance=0.45] extra allowance in angstrom
 * @returns {{a:number,b:number,order:number}[]} bonds with a < b
 */
export function guessBonds(atoms, tolerance = 0.45) {
  const bonds = [];
  for (let i = 0; i < atoms.length; i++) {
    const ei = ELEMENTS[atoms[i].el];
    for (let j = i + 1; j < atoms.length; j++) {
      const ej = ELEMENTS[atoms[j].el];
      const limit = ei.covalent + ej.covalent + tolerance;
      const p = atoms[i].pos, q = atoms[j].pos;
      const dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2];
      if (dx * dx + dy * dy + dz * dz < limit * limit) bonds.push({ a: i, b: j, order: 1 });
    }
  }
  return bonds;
}

/**
 * Largest distance from the centroid to any atom center.
 * @param {{atoms:{pos:number[]}[]}} structure
 * @returns {number} angstrom
 */
export function boundingRadius(structure) {
  const c = centroid(structure.atoms);
  let r = 0;
  for (const a of structure.atoms) r = Math.max(r, dist(a.pos, c));
  return r;
}

/**
 * Build Cartesian coordinates from internal coordinates (a Z-matrix).
 *
 * Row shapes (d in angstrom, a and t in degrees):
 *  - row 0:  { el }                               placed at the origin
 *  - row 1:  { el, ref:[i], d }                   placed on the +z axis at distance d from atom i
 *  - row 2+: { el, ref:[i,j], d, a }              bond to i, angle (new-i-j) = a, placed in the plane of the
 *                                                 first two atoms and the x axis (the xz plane for a first-row bond)
 *  - row 3+: { el, ref:[i,j,k], d, a, t }         bond to i, angle (new-i-j) = a, dihedral (new-i-j-k) = t
 * The dihedral uses the IUPAC sign, so dihedralDeg(new, i, j, k) equals t. If i, j, k are collinear the
 * dihedral is meaningless and a stable perpendicular direction is chosen instead.
 *
 * @param {{el:string, ref?:number[], d?:number, a?:number, t?:number}[]} rows
 * @returns {{el:string,pos:number[]}[]} atoms in row order
 */
export function fromZMatrix(rows) {
  const pos = [];
  rows.forEach((row, n) => {
    const ref = row.ref || [];
    if (n === 0) {
      pos.push([0, 0, 0]);
    } else if (ref.length === 1) {
      if (n !== 1) throw new Error(`Z-matrix row ${n}: a single reference is only valid for row 1`);
      pos.push(add(pos[ref[0]], [0, 0, row.d]));
    } else if (ref.length === 2) {
      const C = pos[ref[0]], B = pos[ref[1]];
      const u = unit(sub(B, C));
      const p = perpendicular(u);
      const a = row.a * RAD;
      pos.push(add(C, add(scale(u, row.d * Math.cos(a)), scale(p, row.d * Math.sin(a)))));
    } else if (ref.length === 3) {
      const C = pos[ref[0]], B = pos[ref[1]], A = pos[ref[2]];
      const bc = unit(sub(C, B));
      let nrm = cross(sub(B, A), bc);
      if (norm(nrm) < 1e-8 * Math.max(1, norm(sub(B, A)))) nrm = perpendicular(bc);
      nrm = unit(nrm);
      const m2 = cross(nrm, bc);
      const a = row.a * RAD, t = (row.t || 0) * RAD;
      const x = -row.d * Math.cos(a);
      const y = row.d * Math.sin(a) * Math.cos(t);
      const z = row.d * Math.sin(a) * Math.sin(t);
      pos.push([
        C[0] + bc[0] * x + m2[0] * y + nrm[0] * z,
        C[1] + bc[1] * x + m2[1] * y + nrm[1] * z,
        C[2] + bc[2] * x + m2[2] * y + nrm[2] * z,
      ]);
    } else {
      throw new Error(`Z-matrix row ${n}: ref must have 1, 2 or 3 entries`);
    }
  });
  return rows.map((row, i) => ({ el: row.el, pos: pos[i] }));
}
