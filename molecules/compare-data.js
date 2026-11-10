// molecules/compare-data.js  Compare mode data: the six pairs and the schematic generators (pure module).
// No DOM, no Three.js. Runs in Node. Lengths in angstrom (Å), angles in degrees, density in g/cm3.
//
// A "side" is the structure of CONTRACT-MOLECULES.md section 2 plus a few optional fields the Compare mode uses:
//   side = {
//     atoms:[{ el, pos, tag? }],  bonds:[{ a, b, order }],  hbonds?:[{ a, b }],
//     boxes:{ name:[{ origin, a, b, c }] },  planes:{ name:[{ points, label?, color? }] },  arrows:{ name:[{ from, to, label? }] },
//     groups:{ name:[atomIndex, ...] },      numbers:{ key:value }   (real numbers shown inside "Show numbers")
//   }
// Every pair has a left and a right side. PAIRS[id].left.build() and .right.build() return a fresh side each time
// and are deterministic (seeded generators). combine() puts one or two sides next to each other for one 3D view.

import { CRYSTALS } from './crystal-data.js';
import { buildBlock, cellVolume, density, coordination, neighbors, packingFraction, planePolygon } from './lattice.js';
import { MOLECULES } from './molecule-data.js';
import { fromZMatrix } from './chem.js';
import { GLASS_NET } from './compare-glass-data.js';

const AVOGADRO_E24 = 0.602214076;   // (g/mol) per (Å^3) to g/cm3 is 1 / this
const MASS = { H: 1.008, C: 12.011, O: 15.999, Si: 28.085 };
const WATER_MASS = 2 * MASS.H + MASS.O;

// ---------- small vector helpers ----------
const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const mul = (p, s) => [p[0] * s, p[1] * s, p[2] * s];
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
const norm = (p) => Math.hypot(p[0], p[1], p[2]);
const unit = (p) => { const n = norm(p); return n < 1e-12 ? [0, 0, 0] : [p[0] / n, p[1] / n, p[2] / n]; };
const lin = (...terms) => terms.reduce((acc, [s, v]) => add(acc, mul(v, s)), [0, 0, 0]);
const dist = (p, q) => norm(sub(p, q));

/** Small seeded random number generator (mulberry32). Same seed, same numbers. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- side transforms ----------
const mapGroups = (g, fn) => { const o = {}; for (const k of Object.keys(g || {})) o[k] = g[k].map(fn); return o; };

/** Map every point of a side with pf and every edge vector with vf. */
function mapSide(side, pf, vf) {
  return {
    ...side,
    atoms: side.atoms.map((a) => ({ ...a, pos: pf(a.pos) })),
    boxes: mapGroups(side.boxes, (b) => ({ ...b, origin: pf(b.origin), a: vf(b.a), b: vf(b.b), c: vf(b.c) })),
    planes: mapGroups(side.planes, (pl) => ({ ...pl, points: pl.points.map(pf) })),
    arrows: mapGroups(side.arrows, (ar) => ({ ...ar, from: pf(ar.from), to: pf(ar.to) })),
  };
}
/** Turn "z is up" data (crystal blocks) into "y is up" data, which is what the 3D view shows upright. */
const rotUp = (side) => mapSide(side, (p) => [p[0], p[2], -p[1]], (v) => [v[0], v[2], -v[1]]);
function rotY(side, deg) {
  const c = Math.cos((deg * Math.PI) / 180); const s = Math.sin((deg * Math.PI) / 180);
  const f = (p) => [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
  return mapSide(side, f, f);
}
const shiftSide = (side, d) => mapSide(side, (p) => add(p, d), (v) => v);

/** Bounding box of the atoms and every box of a side. */
export function sideBounds(side) {
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  const eat = (p) => { for (let i = 0; i < 3; i++) { if (p[i] < min[i]) min[i] = p[i]; if (p[i] > max[i]) max[i] = p[i]; } };
  side.atoms.forEach((a) => eat(a.pos));
  Object.values(side.boxes || {}).forEach((list) => list.forEach((b) => {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) eat(lin([1, b.origin], [i, b.a], [j, b.b], [k, b.c]));
  }));
  return { min, max };
}

/** Rotate about the vertical axis so the block is as narrow as possible from the front (hexagonal blocks are skewed). */
function narrowest(side) {
  let best = { deg: 0, width: Infinity };
  for (let deg = 0; deg < 180; deg += 5) {
    const b = sideBounds(rotY(side, deg));
    const w = b.max[0] - b.min[0];
    if (w < best.width - 1e-6) best = { deg, width: w };
  }
  return best.deg;
}

// ---------- crystal blocks ----------
function crystalSide(id, { n, rotate = true, boundary = true, narrow = true, keep = null }) {
  const crystal = CRYSTALS[id];
  const blk = buildBlock(crystal, { nx: n[0], ny: n[1], nz: n[2], includeBoundary: boundary });
  let atoms = blk.atoms.map((a) => ({ el: a.el, pos: a.pos }));
  let bonds = blk.bonds.map((b) => ({ a: b.a, b: b.b, order: b.order || 1 }));
  let hbonds = (blk.hbonds || []).map((h) => ({ a: h.a, b: h.b }));
  const origin = blk.cell.origin;
  const cells = [];
  for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) {
    cells.push({ origin: lin([i, blk.unitCell.a], [j, blk.unitCell.b], [k, blk.unitCell.c]), a: blk.unitCell.a, b: blk.unitCell.b, c: blk.unitCell.c });
  }
  let side = { id, atoms, bonds, hbonds, boxes: { block: [{ origin, a: blk.cell.a, b: blk.cell.b, c: blk.cell.c }], cells }, planes: {}, arrows: {}, groups: {}, numbers: {} };
  if (keep) side = keepAtoms(side, keep);
  side.crystal = crystal;
  side.block = blk;
  return side;
}

/** Keep atoms for which pred(atom, index) is true and fix the bond indices. */
function keepAtoms(side, pred) {
  const map = new Map(); const atoms = [];
  side.atoms.forEach((a, i) => { if (pred(a, i)) { map.set(i, atoms.length); atoms.push(a); } });
  const bonds = side.bonds.filter((b) => map.has(b.a) && map.has(b.b)).map((b) => ({ ...b, a: map.get(b.a), b: map.get(b.b) }));
  const hbonds = (side.hbonds || []).filter((b) => map.has(b.a) && map.has(b.b)).map((b) => ({ a: map.get(b.a), b: map.get(b.b) }));
  const groups = {};
  for (const k of Object.keys(side.groups || {})) groups[k] = side.groups[k].filter((i) => map.has(i)).map((i) => map.get(i));
  return { ...side, atoms, bonds, hbonds, groups };
}

/** Real numbers of a crystal: density, nearest neighbors, space filled. */
function crystalNumbers(crystal, extra = {}) {
  const ex = crystal.expect || {};
  let neighborsCount; let nearest;
  if (ex.neighborEl) {
    const list = neighbors(crystal, 0, 3.6).filter((n) => n.el === ex.neighborEl);
    nearest = list[0].d;
    neighborsCount = list.filter((n) => n.d <= nearest * 1.08).length;
  } else {
    const c = coordination(crystal, 0, ex.coordinationTol != null ? ex.coordinationTol : 0.08);
    neighborsCount = c.number; nearest = c.distance;
  }
  const pf = packingFraction(crystal);
  return { density: density(crystal), neighbors: neighborsCount, nearest, packing: pf == null ? null : pf * 100, ...extra };
}

const blockVolume = (side) => cellVolume(side.boxes.block[0]);

// ---------- pair 1: iron ----------
function ironSide(id, interstitial, gapOf) {
  const side = crystalSide(id, { n: [2, 2, 2] });
  const a = side.crystal.params.a;
  const carbon = { el: 'C', pos: mul(interstitial, a), tag: 'interstitial' };
  side.atoms.push(carbon);
  side.groups = { carbon: [side.atoms.length - 1] };
  side.numbers = crystalNumbers(side.crystal, { gap: gapOf(a), atoms: side.atoms.length, volume: blockVolume(side) });
  return side;
}
/** Radius of the biggest gap in a lattice of touching spheres, in angstrom. */
const FCC_GAP = (a) => a / 2 - (a * Math.SQRT2) / 4;      // octahedral hole of FCC, 0.146 a
const BCC_GAP = (a) => a / 2 - (a * Math.sqrt(3)) / 4;    // octahedral hole of BCC, 0.067 a
export const CARBON_RADIUS = 0.77;                        // covalent radius of carbon, angstrom

// ---------- pair 2: diamond and graphite ----------
function diamondSide() {
  const side = rotUp(crystalSide('diamond', { n: [2, 2, 2] }));
  side.numbers = crystalNumbers(side.crystal, { sheetGap: null, atoms: side.atoms.length, volume: blockVolume(side) });
  return side;
}
function graphiteSide() {
  const raw = crystalSide('graphite', { n: [3, 3, 2], keep: null });
  const c = raw.crystal.params.c;
  // keep three sheets (the fourth, top one is dropped) so the block is about as tall as the diamond block
  let side = keepAtoms(raw, (a) => a.pos[2] < 1.5 * c);
  const box = side.boxes.block[0];
  side.boxes = { block: [{ ...box, c: mul(box.c, 0.75) }] };
  side.atoms = side.atoms.map((a) => ({ ...a, tag: `sheet${Math.min(3, Math.max(1, Math.round((a.pos[2] / c - 0.25) / 0.5) + 1))}` }));
  side = rotUp(side);
  side = rotY(side, narrowest(side));
  // an arrow along the middle sheet shows the sliding direction
  const mid = side.atoms.filter((a) => a.tag === 'sheet2');
  const ys = mid.reduce((s, a) => s + a.pos[1], 0) / mid.length;
  const xs = side.atoms.map((a) => a.pos[0]); const zs = side.atoms.map((a) => a.pos[2]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2; const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const half = (Math.max(...xs) - Math.min(...xs)) * 0.62;
  side.arrows = { sheets: [{ from: [cx - half, ys, cz], to: [cx + half, ys, cz], label: 'slides' }] };
  side.numbers = crystalNumbers(side.crystal, { sheetGap: 3.354, atoms: side.atoms.length, volume: blockVolume(side) });
  return side;
}

// ---------- pair 3: quartz and glass ----------
function quartzSide() {
  let side = crystalSide('quartz', { n: [2, 2, 2] });
  side = rotUp(side);
  side = rotY(side, narrowest(side));
  side.numbers = { density: density(side.crystal), neighbors: 4, nearest: 1.604, repeat: 'Yes, every 4.9 × 5.4 Å', atoms: side.atoms.length, volume: blockVolume(side) };
  return side;
}

const SI_O = 1.61;       // silicon-oxygen bond length in silica, angstrom
const GLASS_CROP = 12.5; // edge of the cube of glass that is shown, angstrom

/**
 * Glass: a piece cut from a continuous random network of SiO4 units (silicon sits at the nodes of a random tetrahedral network, an
 * oxygen atom bridges every pair of linked silicon atoms). The network is data (compare-glass-data.js, made by compare-glass-gen.js).
 * Every silicon keeps 4 oxygen neighbors and every oxygen joins 2 silicon atoms, but no block repeats.
 * @param {{L:number, si:number[]}} [net]
 * @param {{crop?:number, seed?:number}} [opts]
 */
export function glassFromNetwork(net = GLASS_NET, { crop = GLASS_CROP, seed = 4093 } = {}) {
  const L = net.L; const n = net.si.length / 3;
  const P = (i) => [net.si[3 * i], net.si[3 * i + 1], net.si[3 * i + 2]];
  const mi = (v) => v.map((x) => x - L * Math.round(x / L));
  // neighbor list: 4 nearest silicon atoms (minimum image)
  const nbr = [];
  for (let i = 0; i < n; i++) {
    const list = [];
    for (let j = 0; j < n; j++) if (j !== i) list.push({ j, d: norm(mi(sub(P(j), P(i)))) });
    list.sort((p, q) => p.d - q.d);
    nbr.push(list.slice(0, 4).map((e) => e.j));
  }
  // cube around the middle of the network
  const center = [L / 2, L / 2, L / 2];
  const half = crop / 2;
  const sel = []; const spos = new Map();
  for (let i = 0; i < n; i++) {
    const p = add(center, mi(sub(P(i), center)));
    if (p.every((x, k) => Math.abs(x - center[k]) <= half)) { sel.push(i); spos.set(i, p); }
  }
  const atoms = []; const bonds = [];
  const siIndex = new Map();
  sel.forEach((i) => { siIndex.set(i, atoms.length); atoms.push({ el: 'Si', pos: spos.get(i) }); });
  const oKey = new Map();
  for (const i of sel) {
    for (const j of nbr[i]) {
      const d = mi(sub(P(j), P(i)));
      const lo = Math.min(i, j); const hi = Math.max(i, j);
      const rnd = seededRandom(seed + lo * 7919 + hi * 104729);
      const dir = unit(d);
      let w = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
      w = unit(sub(w, mul(dir, dot(w, dir))));
      const h = Math.sqrt(Math.max(0, SI_O * SI_O - (norm(d) / 2) ** 2));
      const o = add(add(spos.get(i), mul(d, 0.5)), mul(w, h));
      const key = `${lo}-${hi}`;
      const known = oKey.get(key) || [];
      let oi = known.find((k) => dist(atoms[k].pos, o) < 0.05);
      if (oi == null) { oi = atoms.length; atoms.push({ el: 'O', pos: o }); known.push(oi); oKey.set(key, known); }
      bonds.push({ a: siIndex.get(i), b: oi, order: 1 });
    }
  }
  const vol = L ** 3;
  const dens = (n * (MASS.Si + 2 * MASS.O)) / (AVOGADRO_E24 * vol);
  return {
    id: 'glass', atoms, bonds, hbonds: [], boxes: {}, planes: {}, arrows: {}, groups: {},
    numbers: { density: dens, neighbors: 4, nearest: SI_O, repeat: 'None', atoms: atoms.length, volume: null },
    network: { L, silicon: n, shownSilicon: sel.length },
  };
}
function glassSide() { return glassFromNetwork(GLASS_NET); }

// ---------- pair 4: ice and liquid water ----------
const WATER_SHAPE = fromZMatrix([
  { el: 'O' },
  { el: 'H', ref: [0], d: 0.957 },
  { el: 'H', ref: [0, 1], d: 0.957, a: 104.5 },
]).map((a) => a.pos);   // O at the origin, two H atoms

function iceRaw() {
  const side = crystalSide('ice_ih', { n: [2, 2, 2], boundary: false });
  const box = side.boxes.block[0];
  const molecules = side.atoms.filter((a) => a.el === 'O').length;
  const vol = cellVolume(box);
  side.numbers = {
    density: (molecules * WATER_MASS) / (AVOGADRO_E24 * vol), molecules, volume: vol, nearest: 2.76, neighbors: 4, atoms: side.atoms.length,
  };
  side.molecules = molecules;
  return side;
}
function iceSide() {
  const raw = iceRaw();
  const up = rotUp(raw);
  const psi = narrowest(up);
  return rotY(up, psi);
}

function randomRotation(rnd) {
  // uniform random unit quaternion -> rotation matrix
  const u1 = rnd(); const u2 = rnd() * 2 * Math.PI; const u3 = rnd() * 2 * Math.PI;
  const s1 = Math.sqrt(1 - u1); const s2 = Math.sqrt(u1);
  const q = [s1 * Math.sin(u2), s1 * Math.cos(u2), s2 * Math.sin(u3), s2 * Math.cos(u3)];
  const [x, y, z, w] = q;
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
}
const applyRot = (R, v) => [dot(R[0], v), dot(R[1], v), dot(R[2], v)];

/**
 * Liquid water: N molecules (correct O-H length and H-O-H angle) in a periodic box of the given edge vectors, at 1.00 g/cm3.
 * Oxygen positions come from a seeded best-candidate search plus a few push-apart steps (no two O closer than 2.6 Å);
 * each molecule then takes the random orientation (best of many) that keeps its hydrogen atoms away from its neighbors.
 * A schematic: it shows how closely liquid water packs, not measured positions.
 * @param {number} N number of molecules
 * @param {number[]} A box edge vector a
 * @param {number[]} B box edge vector b
 * @param {number} height box height in angstrom (c is straight up the z axis)
 * @param {number} seed
 */
export function liquidWater(N, A, B, height, seed = 20260) {
  const rnd = seededRandom(seed);
  const C = [0, 0, height];
  const M = [A, B, C];                                       // rows are the edge vectors
  const toCart = (f) => lin([f[0], A], [f[1], B], [f[2], C]);
  const det = dot(A, cross(B, C));
  const inv = [cross(B, C), cross(C, A), cross(A, B)].map((r) => mul(r, 1 / det)); // columns of M^-1 as rows
  const toFrac = (p) => [dot(inv[0], p), dot(inv[1], p), dot(inv[2], p)];
  const shifts = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) shifts.push(lin([i, A], [j, B], [k, C]));
  const hmin = Math.min(det / norm(cross(B, C)), det / norm(cross(C, A)), det / norm(cross(A, B)));
  const minImage = (p, q) => {
    const f = toFrac(sub(p, q)).map((x) => x - Math.round(x));
    const d0 = toCart(f);
    const l0 = norm(d0);
    if (l0 < hmin / 2) return { vec: d0, d: l0 };      // closer than half the thinnest box height: already the nearest image
    let best = null; let bd = Infinity;
    for (const s of shifts) { const d = add(d0, s); const l = dot(d, d); if (l < bd) { bd = l; best = d; } }
    return { vec: best, d: Math.sqrt(bd) };
  };
  // oxygen positions
  const O = [];
  for (let m = 0; m < N; m++) {
    let best = null; let score = -1;
    for (let t = 0; t < 40; t++) {
      const p = toCart([rnd(), rnd(), rnd()]);
      let s = Infinity;
      for (const q of O) s = Math.min(s, minImage(p, q).d);
      if (O.length === 0 || s > score) { best = p; score = s; if (!O.length) break; }
    }
    O.push(best);
  }
  const DMIN = 2.75;
  for (let it = 0; it < 150; it++) {
    let worst = Infinity;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const { vec, d } = minImage(O[j], O[i]);
        worst = Math.min(worst, d);
        if (d < DMIN && d > 1e-9) {
          const push = mul(vec, ((DMIN - d) / d) * 0.25);
          O[j] = add(O[j], push); O[i] = sub(O[i], push);
        }
      }
    }
    if (worst >= DMIN - 0.1) break;
  }
  for (let i = 0; i < N; i++) O[i] = toCart(toFrac(O[i]).map((x) => x - Math.floor(x)));
  // orientations
  const atoms = []; const bonds = [];
  const placed = [];   // { O, H1, H2 }
  for (let m = 0; m < N; m++) {
    // neighbors of molecule m as plain vectors from its oxygen (minimum image), so the orientation search needs no wrapping
    const near = [];
    for (let k = 0; k < N; k++) {
      if (k === m) continue;
      const rel = minImage(O[k], O[m]).vec;
      if (norm(rel) < 6.5) near.push({ rel, pk: placed[k] ? placed[k] : null });
    }
    let best = null; let bestScore = -Infinity;
    for (let t = 0; t < 160; t++) {
      const R = randomRotation(rnd);
      const h1 = applyRot(R, WATER_SHAPE[1]); const h2 = applyRot(R, WATER_SHAPE[2]);
      let s = Infinity;
      for (const { rel, pk } of near) {
        s = Math.min(s, dist(h1, rel), dist(h2, rel));
        if (pk) {
          const r1 = add(rel, sub(pk.H1, pk.O)); const r2 = add(rel, sub(pk.H2, pk.O));
          s = Math.min(s, dist(h1, r1) * 0.95, dist(h1, r2) * 0.95, dist(h2, r1) * 0.95, dist(h2, r2) * 0.95, norm(r1), norm(r2));
        }
      }
      if (s > bestScore) { bestScore = s; best = { O: O[m], H1: add(O[m], h1), H2: add(O[m], h2) }; }
    }
    placed[m] = best;
  }
  for (let m = 0; m < N; m++) {
    const base = atoms.length;
    atoms.push({ el: 'O', pos: placed[m].O }, { el: 'H', pos: placed[m].H1 }, { el: 'H', pos: placed[m].H2 });
    bonds.push({ a: base, b: base + 1, order: 1 }, { a: base, b: base + 2, order: 1 });
  }
  const volume = Math.abs(det);
  return { atoms, bonds, volume, density: (N * WATER_MASS) / (AVOGADRO_E24 * volume), box: { origin: [0, 0, 0], a: A, b: B, c: C } };
}

function liquidSide() {
  const raw = iceRaw();
  const ibox = raw.boxes.block[0];
  const N = raw.molecules;
  const area = norm(cross(ibox.a, ibox.b));
  const volume = (N * WATER_MASS) / (AVOGADRO_E24 * 1.0);          // 1.00 g/cm3
  const liq = liquidWater(N, ibox.a, ibox.b, volume / area);
  let side = {
    id: 'liquid', atoms: liq.atoms, bonds: liq.bonds, hbonds: [], boxes: { block: [liq.box] }, planes: {}, arrows: {}, groups: {},
    numbers: { density: liq.density, molecules: N, volume: liq.volume, nearest: null, neighbors: null, atoms: liq.atoms.length },
  };
  side = rotUp(side);
  return rotY(side, narrowest(rotUp(raw)));    // same turn as the ice block, so both boxes have the same footprint
}

// ---------- pair 5: copper and zinc ----------
function copperSide() {
  const side = crystalSide('cu_fcc', { n: [2, 2, 2] });
  const a = side.crystal.params.a;
  const blockV = { a: [2 * a, 0, 0], b: [0, 2 * a, 0], c: [0, 0, 2 * a] };
  // the four directions of closely packed layers, each cut through the middle of the block (a hexagon)
  const colors = ['#2f7fd6', '#e08a1e', '#2fa36b', '#a45bd1'];
  const dirs = [[1, 1, 1, 1.5], [-1, 1, 1, 0.5], [1, -1, 1, 0.5], [1, 1, -1, 0.5]];
  side.planes = { layers: dirs.map(([h, k, l, d], i) => ({ points: planePolygon(blockV, [h, k, l], d), color: colors[i] })) };
  side.numbers = crystalNumbers(side.crystal, { slide: 4, atoms: side.atoms.length, volume: blockVolume(side) });
  return side;
}
function zincSide() {
  let side = crystalSide('zn_hcp', { n: [3, 3, 2] });
  const v = side.boxes.block[0];
  const planes = [];
  const nz = 2;
  for (let k = 0; k < 2 * nz; k++) {
    const d = (k * 0.5 + 0.25) / nz;
    planes.push({ points: planePolygon({ a: v.a, b: v.b, c: v.c }, [0, 0, 1], d), color: '#2f7fd6' });
  }
  side.planes = { layers: planes };
  side = rotUp(side);
  side = rotY(side, narrowest(side));
  side.numbers = crystalNumbers(side.crystal, { slide: 1, atoms: side.atoms.length, volume: blockVolume(side) });
  return side;
}

// ---------- pair 6: ethylene and plastic chains ----------
function ethyleneSide() {
  const m = MOLECULES.ethylene;
  const atoms = m.atoms.map((a) => ({ el: a.el, pos: [a.pos[0], a.pos[2], -a.pos[1]] }));   // the flat molecule faces the viewer
  const bonds = m.bonds.map((b) => ({ a: b.a, b: b.b, order: b.order }));
  const lengthShown = Math.max(...atoms.flatMap((a, i) => atoms.map((b, j) => (j > i ? dist(a.pos, b.pos) : 0))));
  return {
    id: 'ethylene', atoms, bonds, hbonds: [], boxes: {}, planes: {}, arrows: {}, groups: { unit: atoms.map((_, i) => i) },
    numbers: { nearest: 1.339, length: lengthShown, atoms: atoms.length, carbons: 2 },
  };
}

const CC = 1.54; const CH = 1.09; const HCH = 107; const CCC = 112; const CCl = 1.77; const C_RING = 1.51; const RING = 1.397; const RING_H = 1.087;

/**
 * An all-trans zig-zag chain of n carbon atoms, ends capped with hydrogen. Backbone from fromZMatrix:
 * C-C 1.54 Å, C-C-C 112 degrees. kind 'pe' = polyethylene (CH2 units), 'pvc' = a chlorine atom on every second carbon,
 * 'ps' = a benzene ring on every second carbon (alternating sides). A schematic: the real chains coil and tangle.
 * The chain runs straight up (y) and its zig-zag plane faces the viewer (xy plane).
 */
export function polymerChain(kind = 'pe', n = 14) {
  const rows = [{ el: 'C' }, { el: 'C', ref: [0], d: CC }, { el: 'C', ref: [1, 0], d: CC, a: CCC }];
  for (let i = 3; i < n; i++) rows.push({ el: 'C', ref: [i - 1, i - 2, i - 3], d: CC, a: CCC, t: 180 });
  let C = fromZMatrix(rows).map((a) => [a.pos[0], a.pos[2], -a.pos[1]]);
  {
    // turn the chain in its own plane so that the line from the first to the last carbon is vertical
    const ax = C[n - 1][0] - C[0][0]; const ay = C[n - 1][1] - C[0][1]; const r = Math.hypot(ax, ay);
    const c = ay / r; const s = ax / r;
    C = C.map((p) => [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]);
  }
  const atoms = C.map((p) => ({ el: 'C', pos: p })); const bonds = [];
  for (let i = 1; i < n; i++) bonds.push({ a: i - 1, b: i, order: 1 });
  const owner = new Array(n).fill(0).map((_, i) => i);   // which carbon each atom belongs to (for the repeat unit)
  const push = (el, pos, own) => { atoms.push({ el, pos }); owner.push(own); return atoms.length - 1; };
  const nz = [0, 0, 1];
  const phi = (HCH / 2) * (Math.PI / 180);
  let nSub = 0;
  for (let i = 0; i < n; i++) {
    const p = C[i];
    // candidate directions for the two or three non-chain positions
    let dirs;
    if (i > 0 && i < n - 1) {
      const u1 = unit(sub(C[i - 1], p)); const u2 = unit(sub(C[i + 1], p));
      const b = mul(unit(add(u1, u2)), -1);
      dirs = [add(mul(b, Math.cos(phi)), mul(nz, Math.sin(phi))), add(mul(b, Math.cos(phi)), mul(nz, -Math.sin(phi)))];
    } else {
      const u = unit(sub(C[i === 0 ? 1 : n - 2], p));
      const m = unit(cross(u, nz));
      const th = (109.5 * Math.PI) / 180;
      dirs = [0, 120, 240].map((az) => {
        const r = (az * Math.PI) / 180;
        return add(mul(u, Math.cos(th)), mul(add(mul(m, Math.cos(r)), mul(nz, Math.sin(r))), Math.sin(th)));
      });
      dirs = dirs.map(unit);
    }
    const substituted = kind !== 'pe' && i % 2 === 1;
    let subIndex = -1;
    if (substituted) {
      const side = nSub % 2 === 0 ? 1 : -1; nSub++;
      let bestDot = -Infinity;
      dirs.forEach((d, k) => { const s = d[2] * side; if (s > bestDot) { bestDot = s; subIndex = k; } });
    }
    dirs.forEach((d, k) => {
      if (k === subIndex) return;
      const hi = push('H', add(p, mul(d, CH)), i);
      bonds.push({ a: i, b: hi, order: 1 });
    });
    if (subIndex >= 0) {
      const u = dirs[subIndex];
      if (kind === 'pvc') {
        const cl = push('Cl', add(p, mul(u, CCl)), i);
        bonds.push({ a: i, b: cl, order: 1 });
      } else {
        // benzene ring: plane contains the bond, turned so that neighboring rings do not touch
        const tilt = (35 * Math.PI) / 180;
        let nuv = add(mul([0, 1, 0], Math.cos(tilt)), mul([1, 0, 0], Math.sin(tilt)));
        nuv = unit(sub(nuv, mul(u, dot(nuv, u))));
        const w = unit(cross(u, nuv));
        const ipso = add(p, mul(u, C_RING));
        const centerR = add(ipso, mul(u, RING));
        const ringIdx = [];
        for (let k = 0; k < 6; k++) {
          const th = (k * Math.PI) / 3;
          const dirR = add(mul(u, -Math.cos(th)), mul(w, Math.sin(th)));
          const pc = add(centerR, mul(dirR, RING));
          ringIdx.push(push('C', pc, i));
          if (k > 0) {
            const ph = add(centerR, mul(dirR, RING + RING_H));
            const hi = push('H', ph, i);
            bonds.push({ a: ringIdx[k], b: hi, order: 1 });
          }
        }
        bonds.push({ a: i, b: ringIdx[0], order: 1 });
        for (let k = 0; k < 6; k++) bonds.push({ a: ringIdx[k], b: ringIdx[(k + 1) % 6], order: k % 2 === 0 ? 2 : 1 });
      }
    }
  }
  const mid = Math.floor(n / 2) - 1;
  const unitAtoms = atoms.map((_, i) => i).filter((i) => owner[i] === mid || owner[i] === mid + 1);
  const ys = atoms.map((a) => a.pos[1]);
  const length = Math.max(...ys) - Math.min(...ys);
  return {
    id: `chain-${kind}`, atoms, bonds, hbonds: [], boxes: {}, planes: {}, arrows: {}, groups: { unit: unitAtoms },
    numbers: { nearest: CC, length, atoms: atoms.length, carbons: n },
  };
}

const CHAIN_LENGTH = 14;

// ---------- combining two sides for one view ----------
const KEYS = ['left', 'right'];

/**
 * Put one or two sides next to each other (left side on the left, bottoms level, centered on x).
 * Atoms get the tag 'left' or 'right' (plus ':name' when the side tagged them, for example 'left:interstitial').
 * @param {{key:'left'|'right', side:object}[]} parts
 * @returns {{atoms:object[], bonds:object[], hbonds:object[], boxes:Record<string,object[]>, planes:Record<string,object[]>, arrows:Record<string,object[]>,
 *   groups:Record<string,Record<string,number[]>>, sides:Record<string,{bounds:object, width:number, height:number}>, bounds:object}}
 */
export function combine(parts) {
  const gap = (() => {
    const widths = parts.map(({ side }) => { const b = sideBounds(side); return b.max[0] - b.min[0]; });
    return parts.length > 1 ? Math.max(3, 0.4 * Math.max(...widths)) : 0;
  })();
  const widths = parts.map(({ side }) => { const b = sideBounds(side); return b.max[0] - b.min[0]; });
  const total = widths.reduce((s, w) => s + w, 0) + gap * (parts.length - 1);
  let cursor = -total / 2;
  const out = { atoms: [], bonds: [], hbonds: [], boxes: {}, planes: {}, arrows: {}, groups: {}, sides: {} };
  parts.forEach(({ key, side }, pi) => {
    const b = sideBounds(side);
    const d = [cursor - b.min[0], -b.min[1], -(b.min[2] + b.max[2]) / 2];
    cursor += widths[pi] + gap;
    const s = shiftSide(side, d);
    const base = out.atoms.length;
    s.atoms.forEach((a) => out.atoms.push({ el: a.el, pos: a.pos, tag: a.tag ? `${key}:${a.tag}` : key }));
    s.bonds.forEach((bd) => out.bonds.push({ a: bd.a + base, b: bd.b + base, order: bd.order }));
    (s.hbonds || []).forEach((h) => out.hbonds.push({ a: h.a + base, b: h.b + base }));
    for (const kind of ['boxes', 'planes', 'arrows']) {
      for (const name of Object.keys(s[kind] || {})) {
        out[kind][name] = (out[kind][name] || []).concat(s[kind][name].map((o) => ({ ...o, side: key })));
      }
    }
    out.groups[key] = {};
    for (const name of Object.keys(s.groups || {})) out.groups[key][name] = s.groups[name].map((i) => i + base);
    const nb = sideBounds(s);
    out.sides[key] = { bounds: nb, width: nb.max[0] - nb.min[0], height: nb.max[1] - nb.min[1], numbers: s.numbers };
  });
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (const k of KEYS) {
    if (!out.sides[k]) continue;
    const bb = out.sides[k].bounds;
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], bb.min[i]); max[i] = Math.max(max[i], bb.max[i]); }
  }
  out.bounds = { min, max };
  return out;
}

// ---------- the pairs ----------
const SIDE_ROWS_ATOMS = { key: 'atoms', label: 'Atoms shown', unit: '', digits: 0 };

/**
 * helper effects (see mode-compare.js):
 *   highlight:'group'  halo around a group of atoms          fadeBase:0.2    fade the plain atoms of each side
 *   boxes:'name'       draw those boxes                      planes:'name'   draw those translucent planes
 *   arrows:'name'      draw those arrows                     links:true      draw dashed hydrogen bonds
 *   colors:{tag:css}   color atoms by tag (tags are per side, for example 'sheet1')
 */
export const PAIRS = {
  iron: {
    id: 'iron',
    name: 'Cold iron and hot iron',
    summary: 'Cold and hot iron · same atoms, different pattern',
    question: 'Why does heating change steel?',
    left: {
      title: 'Iron at room temperature', short: 'Cold iron', tag: 'Atoms at the corners and one in the center of each block',
      quality: 'reference', source: 'Standard lattice constant of iron at room temperature (alpha iron)',
      build: () => ironSide('fe_bcc', [1.5, 1.5, 1.0], BCC_GAP),
    },
    right: {
      title: 'Iron when red hot', short: 'Hot iron', tag: 'Atoms at the corners and in the middle of each face',
      quality: 'reference', source: 'Standard lattice constant of iron above about 912 degrees C (gamma iron)',
      build: () => ironSide('fe_fcc', [1.5, 1.5, 1.5], FCC_GAP),
    },
    lesson: 'When iron is red hot its atoms rearrange into a pattern with wider gaps, so it can soak up far more carbon. Cooling it fast traps that carbon, and that is what makes steel hard.',
    points: [
      'Cold iron has 8 touching neighbors for each atom. Hot iron has 12.',
      'The widest gap in hot iron is almost 3 times wider than in cold iron.',
      'A carbon atom is bigger than either gap, but it fits much better in the hot form.',
    ],
    buildingLink: 'Structural steel gets its hardness from heat treatment: it is heated, then cooled in a controlled way.',
    helpers: [{ key: 'carbon', label: 'Show the carbon atom', on: false, effect: { highlight: 'carbon', fadeBase: 0.2 } }],
    rows: [
      { key: 'density', label: 'Density', unit: 'g/cm³', digits: 2 },
      { key: 'neighbors', label: 'Touching neighbors', unit: '', digits: 0 },
      { key: 'nearest', label: 'Nearest distance', unit: 'Å', digits: 2 },
      { key: 'packing', label: 'Space filled by atoms', unit: '%', digits: 0 },
      { key: 'gap', label: 'Widest gap, radius', unit: 'Å', digits: 2, hint: 'A carbon atom has a radius of about 0.77 Å.' },
      SIDE_ROWS_ATOMS,
    ],
    steps: [
      { label: 'Look at room-temperature iron', hint: 'Count the neighbors around one atom.', look: 'left', helpers: { carbon: false } },
      { label: 'Now heat it', hint: 'The atoms move into a new pattern.', look: 'right', helpers: { carbon: false } },
      { label: 'Find the gap for carbon', hint: 'The iron fades so the carbon atoms stand out.', look: 'both', helpers: { carbon: true } },
    ],
    look: {
      style: 'ball-stick', radiusScale: 1.15, bonds: false, spaceRadius: 'metallic', alwaysBoxes: 'cells',
      colors: { interstitial: '#2f7fd6' },
      legend: [{ el: 'Fe', label: 'Iron atom' }, { color: '#2f7fd6', label: 'Carbon atom in a gap (colored to stand out)' }],
    },
  },

  carbon: {
    id: 'carbon',
    name: 'Diamond and graphite',
    summary: 'Diamond and graphite · same atom, different stacking',
    question: 'Same atom, opposite materials.',
    left: {
      title: 'Diamond', short: 'Diamond', tag: 'Every atom holds 4 neighbors, in all directions',
      quality: 'reference', source: 'Standard lattice constant of diamond',
      build: diamondSide,
    },
    right: {
      title: 'Graphite', short: 'Graphite', tag: 'Flat sheets. Every atom holds 3 neighbors in its sheet',
      quality: 'reference', source: 'Standard lattice constants of graphite, AB stacking',
      build: graphiteSide,
    },
    lesson: 'Diamond is hard because every atom holds four neighbors in all directions. Graphite is soft because its atoms form flat sheets that slide over each other.',
    points: [
      'Both are made of carbon atoms and nothing else.',
      'Diamond has strong bonds in every direction.',
      'Graphite has strong bonds inside each sheet, but only weak forces between sheets.',
    ],
    buildingLink: 'Diamond-tipped blades and bits cut concrete and stone. Graphite works as a dry lubricant and as pencil lead.',
    helpers: [{ key: 'sheets', label: 'Show the sheets', on: false, effect: { colors: { sheet1: '#6fa8dc', sheet2: '#e6a84a', sheet3: '#78b98f' }, arrows: 'sheets' } }],
    rows: [
      { key: 'density', label: 'Density', unit: 'g/cm³', digits: 2 },
      { key: 'neighbors', label: 'Touching neighbors', unit: '', digits: 0 },
      { key: 'nearest', label: 'Nearest distance', unit: 'Å', digits: 2 },
      { key: 'sheetGap', label: 'Distance between sheets', unit: 'Å', digits: 2 },
      SIDE_ROWS_ATOMS,
    ],
    steps: [
      { label: 'Look at diamond', hint: 'Bonds run in every direction.', look: 'left', helpers: { sheets: false } },
      { label: 'Look at graphite', hint: 'The atoms sit in flat layers.', look: 'right', helpers: { sheets: false } },
      { label: 'Show the sheets', hint: 'Each sheet has its own color.', look: 'both', helpers: { sheets: true } },
    ],
    look: { style: 'ball-stick', radiusScale: 1, bonds: true, spaceRadius: 'covalent', legend: [{ el: 'C', label: 'Carbon atom' }] },
  },

  glass: {
    id: 'glass',
    name: 'Quartz and glass',
    summary: 'Quartz and glass · same ingredients, order or jumble',
    question: 'Why is glass see-through and shapeless inside?',
    left: {
      title: 'Quartz crystal', short: 'Quartz', tag: 'Ordered: the same block repeats again and again',
      quality: 'reference', source: 'Alpha quartz at room temperature (Levien, Prewitt and Weidner, 1980)',
      build: quartzSide,
    },
    right: {
      title: 'Glass', short: 'Glass', tag: 'Frozen jumble: no block repeats',
      quality: 'schematic', source: 'A random network of silicon and oxygen, drawn to show the idea. Silicon sits in the middle of 4 oxygen atoms, as in quartz.',
      build: glassSide,
    },
    lesson: 'Quartz and glass are made of the same two kinds of atoms. In quartz the pieces repeat in a perfect pattern, and in glass they are frozen in a jumble.',
    points: [
      'In both, every silicon atom sits in the middle of 4 oxygen atoms.',
      'Glass has no grains and no grain edges, so light passes through without scattering.',
      'A crystal melts at one set temperature. Glass has no repeating pattern to break, so it softens slowly as it warms.',
    ],
    buildingLink: 'Window glass is made from sand, which is mostly quartz. It is melted and then cooled before the atoms can settle into a crystal.',
    helpers: [{ key: 'block', label: 'Show the repeating block', on: false, effect: { boxes: 'cells' } }],
    rows: [
      { key: 'density', label: 'Density', unit: 'g/cm³', digits: 2 },
      { key: 'neighbors', label: 'Oxygen around each silicon', unit: '', digits: 0 },
      { key: 'nearest', label: 'Silicon to oxygen distance', unit: 'Å', digits: 2 },
      { key: 'repeat', label: 'Repeating block' },
      SIDE_ROWS_ATOMS,
    ],
    steps: [
      { label: 'Look at quartz', hint: 'Every piece sits in a neat pattern.', look: 'left', helpers: { block: false } },
      { label: 'Look at glass', hint: 'Same pieces, no pattern.', look: 'right', helpers: { block: false } },
      { label: 'Show the repeating block', hint: 'Quartz repeats one block. Glass has none.', look: 'both', helpers: { block: true } },
    ],
    look: { style: 'ball-stick', radiusScale: 1, bonds: true, spaceRadius: 'covalent', legend: [{ el: 'Si', label: 'Silicon atom' }, { el: 'O', label: 'Oxygen atom' }] },
  },

  water: {
    id: 'water',
    name: 'Ice and liquid water',
    summary: 'Ice and liquid water · same molecules, different room',
    question: 'Why does ice float?',
    left: {
      title: 'Ice', short: 'Ice', tag: 'An open cage held together by hydrogen bonds',
      quality: 'reference', source: 'Standard lattice constants of ice Ih near 0 degrees C. The hydrogen atoms are in one orderly arrangement that obeys the ice rules.',
      build: iceSide,
    },
    right: {
      title: 'Liquid water', short: 'Liquid water', tag: 'Molecules packed closer, in a jumble',
      quality: 'schematic', source: 'Molecules with the true shape, placed at random at the density of liquid water (1.00 g/cm³). Not measured positions.',
      build: liquidSide,
    },
    lesson: 'Ice holds its molecules apart in an open cage. Liquid water packs the same molecules closer together, so ice needs about 9 percent more room.',
    points: [
      'Both boxes hold the same number of water molecules.',
      'In ice every molecule links to 4 neighbors, and the links form open six-sided rings.',
      'In liquid water the links keep breaking and forming, so they are not drawn.',
    ],
    buildingLink: 'Water expands when it freezes. That is why frozen pipes burst and why wet concrete and masonry crack and flake in winter.',
    helpers: [
      { key: 'boxes', label: 'Show the boxes', on: true, effect: { boxes: 'block' } },
      { key: 'links', label: 'Show the water links', on: true, effect: { links: true } },
    ],
    rows: [
      { key: 'molecules', label: 'Water molecules', unit: '', digits: 0 },
      { key: 'volume', label: 'Box volume', unit: 'Å³', digits: 0 },
      { key: 'density', label: 'Density', unit: 'g/cm³', digits: 2 },
      { key: 'nearest', label: 'Oxygen to oxygen distance', unit: 'Å', digits: 2 },
      SIDE_ROWS_ATOMS,
    ],
    steps: [
      { label: 'Look at ice', hint: 'The dashed links hold the molecules in open rings.', look: 'left', helpers: { boxes: true, links: true } },
      { label: 'Melt it', hint: 'The molecules pack closer.', look: 'right', helpers: { boxes: true, links: true } },
      { label: 'Compare the boxes', hint: 'Same molecules. The ice box is taller.', look: 'both', helpers: { boxes: true, links: true } },
    ],
    look: { style: 'ball-stick', radiusScale: 1.1, bonds: true, spaceRadius: 'vdw', legend: [{ el: 'O', label: 'Oxygen atom' }, { el: 'H', label: 'Hydrogen atom' }] },
  },

  metals: {
    id: 'metals',
    name: 'Copper and zinc',
    summary: 'Copper and zinc · many ways to slide, or only one',
    question: 'Why is copper easy to bend and zinc is not?',
    left: {
      title: 'Copper', short: 'Copper', tag: 'Layers of atoms can slide in many directions',
      quality: 'reference', source: 'Standard lattice constant of copper at room temperature',
      build: copperSide,
    },
    right: {
      title: 'Zinc', short: 'Zinc', tag: 'Layers of atoms can slide in only one way',
      quality: 'reference', source: 'Standard lattice constants of zinc at room temperature',
      build: zincSide,
    },
    lesson: 'Copper has many directions in which layers of atoms can slide, so it bends instead of breaking. Zinc has only one set of sliding layers, so at room temperature it is more brittle.',
    points: [
      'When a metal bends, layers of atoms slide over each other.',
      'Copper has 4 different directions of closely packed layers. Zinc has only 1.',
      'The colored sheets mark the layers that can slide.',
    ],
    buildingLink: 'Copper is rolled into roofing and drawn into tube and wire. Zinc is mostly used as a coating on steel, where it protects the steel from rust.',
    helpers: [{ key: 'layers', label: 'Show the sliding layers', on: true, effect: { planes: 'layers' } }],
    rows: [
      { key: 'density', label: 'Density', unit: 'g/cm³', digits: 2 },
      { key: 'neighbors', label: 'Closest neighbors', unit: '', digits: 0, hint: 'In zinc, 6 more neighbors sit a little farther away.' },
      { key: 'nearest', label: 'Nearest distance', unit: 'Å', digits: 2 },
      { key: 'slide', label: 'Directions of sliding layers', unit: '', digits: 0 },
      SIDE_ROWS_ATOMS,
    ],
    steps: [
      { label: 'Look at copper', hint: 'Count the sheets in different directions.', look: 'left', helpers: { layers: true } },
      { label: 'Look at zinc', hint: 'The layers all run one way.', look: 'right', helpers: { layers: true } },
      { label: 'Hide the sheets', hint: 'Can you still see the layers in the atoms?', look: 'both', helpers: { layers: false } },
    ],
    look: { style: 'ball-stick', radiusScale: 0.95, bonds: false, spaceRadius: 'metallic', legend: [{ el: 'Cu', label: 'Copper atom' }, { el: 'Zn', label: 'Zinc atom' }] },
  },

  plastic: {
    id: 'plastic',
    name: 'A small molecule and a plastic',
    summary: 'A small molecule and a plastic chain',
    question: 'What is a plastic?',
    left: {
      title: 'One small molecule', short: 'Ethylene', tag: 'Ethylene: a gas made of 2 carbon atoms and 4 hydrogen atoms',
      quality: 'reference', source: 'Ethylene bond lengths and angles from the CRC Handbook and NIST',
      build: ethyleneSide,
    },
    right: {
      title: 'A plastic chain', short: 'Plastic chain', tag: 'Polyethylene: a long chain of carbon atoms',
      quality: 'schematic', source: 'An all-trans chain drawn with standard bond lengths and angles. Real chains are much longer and coil up.',
      build: () => polymerChain('pe', CHAIN_LENGTH),
      variants: [
        { id: 'pe', label: 'Polyethylene', title: 'A plastic chain', short: 'Polyethylene', tag: 'Polyethylene: a long chain of carbon atoms', build: () => polymerChain('pe', CHAIN_LENGTH) },
        { id: 'pvc', label: 'PVC', title: 'A PVC chain', short: 'PVC', tag: 'PVC: a chlorine atom on every second carbon', build: () => polymerChain('pvc', CHAIN_LENGTH) },
        { id: 'ps', label: 'Polystyrene', title: 'A polystyrene chain', short: 'Polystyrene', tag: 'Polystyrene: a ring on every second carbon', build: () => polymerChain('ps', CHAIN_LENGTH) },
      ],
    },
    lesson: 'A plastic is made of thousands of small molecules linked into long chains. The chains tangle like cooked spaghetti, which makes plastics tough, and heat lets the chains slide apart, so most plastics soften.',
    points: [
      'Ethylene is a gas. Linked into long chains it becomes polyethylene, a solid plastic.',
      'The chain shown has only 14 carbon atoms. Real chains have thousands.',
      'Swapping some hydrogen atoms for other atoms makes other plastics, such as PVC (chlorine) and polystyrene (a ring).',
    ],
    buildingLink: 'Polyethylene is used for vapor retarders under slabs and for PEX pipe. PVC is used for pipes and window frames.',
    helpers: [{ key: 'unit', label: 'Show one repeat unit', on: false, effect: { highlight: 'unit' } }],
    rows: [
      { key: 'carbons', label: 'Carbon atoms', unit: '', digits: 0 },
      { key: 'nearest', label: 'Carbon to carbon bond', unit: 'Å', digits: 2 },
      { key: 'length', label: 'Length of the piece', unit: 'Å', digits: 1 },
      SIDE_ROWS_ATOMS,
    ],
    steps: [
      { label: 'Start with one small molecule', hint: 'A gas with only 6 atoms.', look: 'left', helpers: { unit: false } },
      { label: 'Link them into a chain', hint: 'Each unit joins the next.', look: 'right', helpers: { unit: false } },
      { label: 'Show one repeat unit', hint: 'One small molecule becomes one link.', look: 'both', helpers: { unit: true } },
    ],
    look: {
      style: 'ball-stick', radiusScale: 1, bonds: true, spaceRadius: 'vdw', padding: 1.3,
      legend: [{ el: 'C', label: 'Carbon atom' }, { el: 'H', label: 'Hydrogen atom' }, { el: 'Cl', label: 'Chlorine atom (PVC only)' }],
    },
  },
};

export const PAIR_ORDER = ['iron', 'carbon', 'glass', 'water', 'metals', 'plastic'];
