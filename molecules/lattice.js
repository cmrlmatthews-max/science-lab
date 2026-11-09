/**
 * Crystal math for the Molecules and Crystals explorer (pure module).
 * No DOM, no Three.js. All lengths are in angstrom (A), angles in degrees,
 * density in g/cm3.
 *
 * A "crystal" is the object described in CONTRACT-MOLECULES.md section 4.2:
 *   { params:{a,b,c,alpha,beta,gamma}, basis:[{el, frac:[u,v,w]}], bondRule, hbondRule, ... }
 * The basis lists every atom of ONE conventional cell exactly once.
 */

/**
 * Atomic masses in g/mol for the elements used by the crystal library.
 * A small private copy so this module does not depend on elements.js.
 * @type {Record<string, number>}
 */
export const ATOMIC_MASS = {
  H: 1.008, C: 12.011, O: 15.999, Na: 22.990, Mg: 24.305, Al: 26.982,
  Si: 28.086, Cl: 35.45, Ca: 40.078, Ti: 47.867, Fe: 55.845, Cu: 63.546,
  Zn: 65.38, Cs: 132.905,
};

/** (g/mol) / (A^3) -> g/cm3 conversion: 1 / (Avogadro number * 1e-24). */
const MASS_PER_VOLUME = 1 / 0.602214076;
const EPS = 1e-6;
const DEG = Math.PI / 180;

// ---------- small vector helpers ----------

const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const scale = (p, s) => [p[0] * s, p[1] * s, p[2] * s];
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const cross = (p, q) => [
  p[1] * q[2] - p[2] * q[1],
  p[2] * q[0] - p[0] * q[2],
  p[0] * q[1] - p[1] * q[0],
];
const norm = (p) => Math.hypot(p[0], p[1], p[2]);

/** Cosine of an angle in degrees, snapped to exact zero near 90 degrees. */
function cosDeg(deg) {
  const x = Math.cos(deg * DEG);
  return Math.abs(x) < 1e-12 ? 0 : x;
}

// ---------- cell geometry ----------

/**
 * Edge vectors of a unit cell from its lengths and angles.
 * Vector a lies along +x and b lies in the xy plane.
 * @param {{a:number,b?:number,c?:number,alpha?:number,beta?:number,gamma?:number}} params
 * @returns {{a:number[], b:number[], c:number[]}} vectors in A
 */
export function cellVectors({ a, b = a, c = a, alpha = 90, beta = 90, gamma = 90 }) {
  const ca = cosDeg(alpha);
  const cb = cosDeg(beta);
  const cg = cosDeg(gamma);
  const sg = Math.abs(cg) < 1e-12 ? 1 : Math.sin(gamma * DEG);
  const cx = c * cb;
  const cy = (c * (ca - cb * cg)) / sg;
  const cz = Math.sqrt(Math.max(0, c * c - cx * cx - cy * cy));
  return { a: [a, 0, 0], b: [b * cg, b * sg, 0], c: [cx, cy, cz] };
}

/**
 * Volume of a cell.
 * @param {{a:number[], b:number[], c:number[]}} cell
 * @returns {number} A^3
 */
export function cellVolume(cell) {
  return Math.abs(dot(cell.a, cross(cell.b, cell.c)));
}

/**
 * Convert fractional coordinates to Cartesian coordinates.
 * @param {number[]} frac [u,v,w]
 * @param {{a:number[], b:number[], c:number[]}} vectors
 * @returns {number[]} [x,y,z] in A
 */
export function fracToCart(frac, vectors) {
  const { a, b, c } = vectors;
  return [
    frac[0] * a[0] + frac[1] * b[0] + frac[2] * c[0],
    frac[0] * a[1] + frac[1] * b[1] + frac[2] * c[1],
    frac[0] * a[2] + frac[1] * b[2] + frac[2] * c[2],
  ];
}

/**
 * Spacing between opposite faces of the cell, one value per axis.
 * @param {{a:number[], b:number[], c:number[]}} v
 * @returns {number[]} [ha, hb, hc] in A
 */
function faceSpacings(v) {
  const vol = cellVolume(v);
  return [vol / norm(cross(v.b, v.c)), vol / norm(cross(v.c, v.a)), vol / norm(cross(v.a, v.b))];
}

// ---------- counting and bulk properties ----------

/**
 * Number of atoms in the conventional cell (each basis atom counted once).
 * @param {object} crystal
 * @returns {number}
 */
export function atomsPerCell(crystal) {
  return crystal.basis.length;
}

/**
 * Density from the basis masses and the cell volume.
 * @param {object} crystal
 * @returns {number} g/cm3
 */
export function density(crystal) {
  const mass = crystal.basis.reduce((sum, at) => {
    const m = ATOMIC_MASS[at.el];
    if (m === undefined) throw new Error(`No atomic mass for element ${at.el}`);
    return sum + m;
  }, 0);
  return (mass * MASS_PER_VOLUME) / cellVolume(cellVectors(crystal.params));
}

// ---------- periodic neighbor search ----------

/**
 * All atoms within a cutoff of one basis atom, searching periodic images.
 * The image range is derived from the face spacings of the cell, so skewed
 * (hexagonal, trigonal) cells are covered.
 * @param {object} crystal
 * @param {number} basisIndex index into crystal.basis
 * @param {number} cutoff A
 * @returns {{el:string, d:number, vec:number[], basisIndex:number, image:number[]}[]}
 *   sorted by distance; vec points from the chosen atom to the neighbor
 */
export function neighbors(crystal, basisIndex, cutoff) {
  const v = cellVectors(crystal.params);
  const spacing = faceSpacings(v);
  const self = crystal.basis[basisIndex].frac;
  // Basis fractions may lie outside [0,1); widen the range by their spread.
  const spread = [0, 1, 2].map((ax) =>
    Math.max(...crystal.basis.map((at) => Math.abs(at.frac[ax] - self[ax]))));
  const range = spacing.map((h, ax) => Math.ceil(cutoff / h) + Math.ceil(spread[ax]));
  const origin = fracToCart(self, v);
  const found = [];
  for (let i = -range[0]; i <= range[0]; i++) {
    for (let j = -range[1]; j <= range[1]; j++) {
      for (let k = -range[2]; k <= range[2]; k++) {
        crystal.basis.forEach((at, idx) => {
          const frac = [at.frac[0] + i, at.frac[1] + j, at.frac[2] + k];
          const vec = sub(fracToCart(frac, v), origin);
          const d = norm(vec);
          if (d > 1e-9 && d <= cutoff) found.push({ el: at.el, d, vec, basisIndex: idx, image: [i, j, k] });
        });
      }
    }
  }
  return found.sort((p, q) => p.d - q.d);
}

/** Longest cell edge of a crystal, A. */
function longestEdge(crystal) {
  const v = cellVectors(crystal.params);
  return Math.max(norm(v.a), norm(v.b), norm(v.c));
}

/**
 * Neighbor list wide enough to contain at least one atom.
 * @param {object} crystal
 * @param {number} basisIndex
 * @returns {{el:string, d:number, vec:number[]}[]}
 */
function firstShellList(crystal, basisIndex) {
  let cutoff = longestEdge(crystal);
  for (let tries = 0; tries < 6; tries++, cutoff *= 1.5) {
    const list = neighbors(crystal, basisIndex, cutoff);
    if (list.length) return list;
  }
  return [];
}

/**
 * Coordination number: how many neighbors sit in the nearest shell.
 * @param {object} crystal
 * @param {number} basisIndex
 * @param {number} [tol=0.08] shell width as a fraction of the nearest distance
 * @returns {{number:number, distance:number}} distance is the nearest-neighbor distance in A
 */
export function coordination(crystal, basisIndex, tol = 0.08) {
  const list = firstShellList(crystal, basisIndex);
  if (!list.length) return { number: 0, distance: 0 };
  const d0 = list[0].d;
  return { number: list.filter((n) => n.d <= d0 * (1 + tol)).length, distance: d0 };
}

/**
 * Neighbor shells of one atom, grouped by distance.
 * @param {object} crystal
 * @param {number} basisIndex
 * @param {number} cutoff A
 * @param {number} [groupTol=0.002] distances closer than this (A) share a shell
 * @returns {{n:number, d:number}[]} shells in order of distance (d is the mean distance)
 */
export function neighborShells(crystal, basisIndex, cutoff, groupTol = 0.002) {
  const shells = [];
  for (const nb of neighbors(crystal, basisIndex, cutoff)) {
    const last = shells[shells.length - 1];
    if (last && Math.abs(nb.d - last.sum / last.n) <= groupTol) {
      last.n += 1;
      last.sum += nb.d;
    } else {
      shells.push({ n: 1, sum: nb.d });
    }
  }
  return shells.map((s) => ({ n: s.n, d: s.sum / s.n }));
}

/**
 * Packing fraction of a single-element crystal, treating atoms as hard
 * spheres that touch along the nearest-neighbor distance.
 * @param {object} crystal
 * @returns {number|null} null when the crystal has more than one element
 */
export function packingFraction(crystal) {
  const elements = new Set(crystal.basis.map((at) => at.el));
  if (elements.size !== 1) return null;
  const nearest = firstShellList(crystal, 0)[0].d;
  const r = nearest / 2;
  const volume = cellVolume(cellVectors(crystal.params));
  return (crystal.basis.length * (4 / 3) * Math.PI * r ** 3) / volume;
}

// ---------- blocks of cells ----------

/** True when a fractional coordinate sits on a cell face (value 0). */
const onFace = (f) => Math.abs(f - Math.round(f)) < EPS;

/** True when the element pair matches one of the rule's pairs in either order. */
function pairMatches(rule, elA, elB) {
  return rule.pairs.some(([p, q]) => (p === elA && q === elB) || (p === elB && q === elA));
}

/**
 * Index pairs of atoms that satisfy a distance rule (uses a spatial hash).
 * @param {{el:string,pos:number[]}[]} atoms
 * @param {{pairs:string[][], min?:number, max:number}} rule
 * @returns {{a:number, b:number}[]}
 */
function pairsByRule(atoms, rule) {
  const min = rule.min ?? 0;
  const size = rule.max;
  const key = (i, j, k) => `${i},${j},${k}`;
  const grid = new Map();
  const cellOf = (p) => p.map((x) => Math.floor(x / size));
  atoms.forEach((at, idx) => {
    const c = cellOf(at.pos);
    const kk = key(...c);
    if (!grid.has(kk)) grid.set(kk, []);
    grid.get(kk).push(idx);
  });
  const out = [];
  atoms.forEach((at, idx) => {
    const c = cellOf(at.pos);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (let k = -1; k <= 1; k++) {
          const bucket = grid.get(key(c[0] + i, c[1] + j, c[2] + k));
          if (!bucket) continue;
          for (const other of bucket) {
            if (other <= idx) continue;
            const o = atoms[other];
            if (!pairMatches(rule, at.el, o.el)) continue;
            const d = norm(sub(o.pos, at.pos));
            if (d >= min && d <= rule.max) out.push({ a: idx, b: other });
          }
        }
      }
    }
  });
  return out;
}

/**
 * Build a block of nx x ny x nz cells as a renderable structure.
 *
 * With includeBoundary, basis atoms that sit on a cell face (fractional
 * coordinate 0) are repeated on the far faces, edges and corners of the block
 * so every cell looks complete. Those extra copies carry the tag 'boundary'.
 * Fractional coordinates of basis atoms are used as given (they are not
 * wrapped), so a molecule whose hydrogen atoms lie just outside the cell
 * (ice) stays whole.
 *
 * Bonds come from crystal.bondRule and only join atoms inside the block.
 * When the crystal has an hbondRule the structure also carries
 * `hbonds: [{a, b}]` (index pairs for dashed hydrogen bonds).
 * @param {object} crystal
 * @param {{nx?:number, ny?:number, nz?:number, includeBoundary?:boolean}} [opts]
 * @returns {{atoms:object[], bonds:object[], hbonds?:object[], cell:object, unitCell:object}}
 */
export function buildBlock(crystal, { nx = 1, ny = 1, nz = 1, includeBoundary = true } = {}) {
  const unit = cellVectors(crystal.params);
  const counts = [nx, ny, nz];
  const atoms = [];
  const push = (el, frac, basisIndex, boundary) => {
    const atom = { el, pos: fracToCart(frac, unit), id: atoms.length, basisIndex };
    if (boundary) atom.tag = 'boundary';
    atoms.push(atom);
  };
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      for (let k = 0; k < nz; k++) {
        const cellIdx = [i, j, k];
        crystal.basis.forEach((at, basisIndex) => {
          const base = [0, 1, 2].map((ax) => cellIdx[ax] + at.frac[ax]);
          push(at.el, base, basisIndex, false);
          if (!includeBoundary) return;
          // Axes along which this atom lies on a face of the last cell.
          const axes = [0, 1, 2].filter((ax) => cellIdx[ax] === counts[ax] - 1 && onFace(at.frac[ax]));
          for (let mask = 1; mask < 1 << axes.length; mask++) {
            const frac = base.slice();
            axes.forEach((ax, n) => { if (mask & (1 << n)) frac[ax] += 1; });
            push(at.el, frac, basisIndex, true);
          }
        });
      }
    }
  }
  const bonds = crystal.bondRule
    ? pairsByRule(atoms, crystal.bondRule).map(({ a, b }) => ({ a, b, order: 1 }))
    : [];
  const structure = {
    atoms,
    bonds,
    cell: {
      origin: [0, 0, 0],
      a: scale(unit.a, nx),
      b: scale(unit.b, ny),
      c: scale(unit.c, nz),
    },
    unitCell: { origin: [0, 0, 0], a: unit.a, b: unit.b, c: unit.c },
  };
  if (crystal.hbondRule) structure.hbonds = pairsByRule(atoms, crystal.hbondRule);
  return structure;
}

// ---------- Miller planes ----------

/**
 * Polygon where the plane h*u + k*v + l*w = d (u, v, w fractional coordinates)
 * cuts ONE unit cell. With d = 1, (100) is the face u = 1, (110) joins the
 * edges u + v = 1, and (111) cuts the three axes at 1.
 * @param {{a:number[], b:number[], c:number[]}} vectors
 * @param {number[]} hkl Miller indices [h,k,l]
 * @param {number} [d=1] plane offset in fractional units
 * @returns {number[][]} corner points [x,y,z] in A, ordered around the polygon ([] when the plane misses the cell)
 */
export function planePolygon(vectors, [h, k, l], d = 1) {
  const corners = [];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let m = 0; m < 2; m++) corners.push([i, j, m]);
  const value = (f) => h * f[0] + k * f[1] + l * f[2] - d;
  const fracPoints = [];
  const addUnique = (f) => {
    if (!fracPoints.some((q) => Math.hypot(q[0] - f[0], q[1] - f[1], q[2] - f[2]) < 1e-9)) fracPoints.push(f);
  };
  // Walk the 12 cube edges (corner pairs that differ in exactly one coordinate).
  for (const p of corners) {
    for (let ax = 0; ax < 3; ax++) {
      if (p[ax] !== 0) continue;
      const q = p.slice();
      q[ax] = 1;
      const vp = value(p);
      const vq = value(q);
      if (Math.abs(vp) < EPS) addUnique(p);
      if (Math.abs(vq) < EPS) addUnique(q);
      if (vp * vq < 0) {
        const t = vp / (vp - vq);
        addUnique([0, 1, 2].map((n) => p[n] + t * (q[n] - p[n])));
      }
    }
  }
  if (fracPoints.length < 3) return [];
  const pts = fracPoints.map((f) => fracToCart(f, vectors));
  const center = scale(pts.reduce(add, [0, 0, 0]), 1 / pts.length);
  // Plane normal from the Miller indices in reciprocal form: n = h*(b x c) + k*(c x a) + l*(a x b).
  const normal = add(add(scale(cross(vectors.b, vectors.c), h), scale(cross(vectors.c, vectors.a), k)),
    scale(cross(vectors.a, vectors.b), l));
  const n = scale(normal, 1 / norm(normal));
  const e1 = sub(pts[0], center);
  const u1 = scale(e1, 1 / norm(e1));
  const u2 = cross(n, u1);
  return pts
    .map((p) => ({ p, ang: Math.atan2(dot(sub(p, center), u2), dot(sub(p, center), u1)) }))
    .sort((s, t) => s.ang - t.ang)
    .map((s) => s.p);
}
