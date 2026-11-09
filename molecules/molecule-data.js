// Molecule library for Science Lab, Stage 3.
// Pure data: no DOM, no Three.js. Imports only elements.js and chem.js.
//
// Every geometry is built from internal coordinates (fromZMatrix) and then centered on its centroid.
// Atom order in each molecule is documented next to its Z-matrix. Dipole directions point from the
// positive end toward the negative end (the convention of the contract), and are computed from the
// built coordinates, not typed in.

import { centerStructure, fromZMatrix, formula, formulaHtml, dihedralDeg } from './chem.js';

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

// ---------- small vector helpers (local) ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const unit = (a) => { const n = Math.hypot(a[0], a[1], a[2]); return [a[0] / n, a[1] / n, a[2] / n]; };
const meanOf = (pts) => pts.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map((v) => v / pts.length);

/** Direction from point `from` toward point `to` as a unit vector. */
const dirTo = (from, to) => unit(sub(to, from));

/**
 * For a carbon with two heavy neighbors X1 and X2 (angle beta between them) and two equal substituents H
 * (angle phi between them), return the Z-matrix angle and dihedral that place each H:
 *   angle (H-C-X1) = a, dihedral (H-C-X1-X2) = +t for one H and -t for the other.
 * Both H atoms are mirror images through the plane of X1, C, X2, so the molecule keeps C2v symmetry.
 * @param {number} beta angle X1-C-X2 in degrees
 * @param {number} phi angle H-C-H in degrees
 */
function pairParams(beta, phi) {
  const hb = (beta / 2) * RAD, hp = (phi / 2) * RAD;
  const C = [0, 0, 0];
  const X1 = [Math.sin(hb), 0, Math.cos(hb)];
  const X2 = [-Math.sin(hb), 0, Math.cos(hb)];
  const H = [0, Math.sin(hp), -Math.cos(hp)];
  const a = Math.acos(-Math.cos(hp) * Math.cos(hb)) * DEG;
  const t = Math.abs(dihedralDeg(H, C, X1, X2));
  return { a, t };
}

/**
 * Crude bond-polarity estimate of the dipole direction for molecules without symmetry-fixed axes.
 * Each C-F, C-Cl bond moves a little charge onto the halogen; each C-H bond moves a little onto carbon.
 * Returns a unit vector from the positive end toward the negative end. Direction only, not a magnitude.
 */
function bondPolarityDirection(atoms, bonds) {
  const transfer = { F: 0.25, Cl: 0.18 };
  const q = atoms.map(() => 0);
  for (const { a, b } of bonds) {
    const [ea, eb] = [atoms[a].el, atoms[b].el];
    const pair = (x, y) => (ea === x && eb === y ? [a, b] : ea === y && eb === x ? [b, a] : null);
    for (const hal of ['F', 'Cl']) {
      const p = pair('C', hal);
      if (p) { q[p[0]] += transfer[hal]; q[p[1]] -= transfer[hal]; }
    }
    const h = pair('C', 'H');
    if (h) { q[h[0]] -= 0.05; q[h[1]] += 0.05; }
  }
  // p = sum q r points from the negative to the positive end, so the + to - direction is -p.
  const p = [0, 0, 0];
  atoms.forEach((at, i) => { for (let k = 0; k < 3; k++) p[k] += q[i] * at.pos[k]; });
  return unit([-p[0], -p[1], -p[2]]);
}

/** Build a centered structure from Z-matrix rows and a bond list [a, b, order]. */
function build(rows, bondList) {
  const raw = fromZMatrix(rows);
  const structure = centerStructure({
    atoms: raw,
    bonds: bondList.map(([a, b, order]) => ({ a, b, order })),
  });
  return structure;
}

// ammonia: H-N-H dihedral that makes a regular pyramid, cos t = cos(alpha) / (1 + cos(alpha))
const NH3_ANGLE = 106.7;
const NH3_T = Math.acos(Math.cos(NH3_ANGLE * RAD) / (1 + Math.cos(NH3_ANGLE * RAD))) * DEG;

const TET = Math.acos(-1 / 3) * DEG; // 109.4712...

// ---------- Z-matrices ----------
// Each entry: rows, bonds, then the dipole direction as a function of the raw coordinates.

const defs = {};

// nitrogen: atoms 0 N, 1 N
defs.n2 = {
  rows: [{ el: 'N' }, { el: 'N', ref: [0], d: 1.098 }],
  bonds: [[0, 1, 3]],
};

// oxygen: atoms 0 O, 1 O
defs.o2 = {
  rows: [{ el: 'O' }, { el: 'O', ref: [0], d: 1.208 }],
  bonds: [[0, 1, 2]],
};

// carbon dioxide: atoms 0 C, 1 O, 2 O
defs.co2 = {
  rows: [{ el: 'C' }, { el: 'O', ref: [0], d: 1.160 }, { el: 'O', ref: [0, 1], d: 1.160, a: 180 }],
  bonds: [[0, 1, 2], [0, 2, 2]],
};

// water: atoms 0 O, 1 H, 2 H
defs.water = {
  rows: [{ el: 'O' }, { el: 'H', ref: [0], d: 0.957 }, { el: 'H', ref: [0, 1], d: 0.957, a: 104.5 }],
  bonds: [[0, 1, 1], [0, 2, 1]],
  dipoleDir: (p) => dirTo(mid(p[1], p[2]), p[0]), // toward oxygen
};

// methane: atoms 0 C, 1-4 H
defs.methane = {
  rows: [
    { el: 'C' },
    { el: 'H', ref: [0], d: 1.087 },
    { el: 'H', ref: [0, 1], d: 1.087, a: TET },
    { el: 'H', ref: [0, 1, 2], d: 1.087, a: TET, t: 120 },
    { el: 'H', ref: [0, 1, 2], d: 1.087, a: TET, t: -120 },
  ],
  bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]],
};

// propane: atoms 0 C (middle), 1 C, 2 C (methyls), 3-4 H on the middle carbon, 5-7 H on C1, 8-10 H on C2
const PROPANE_CH = 1.09;
const propaneMid = pairParams(112.4, 106.0);
defs.propane = {
  rows: [
    { el: 'C' },
    { el: 'C', ref: [0], d: 1.526 },
    { el: 'C', ref: [0, 1], d: 1.526, a: 112.4 },
    { el: 'H', ref: [0, 1, 2], d: PROPANE_CH, a: propaneMid.a, t: propaneMid.t },
    { el: 'H', ref: [0, 1, 2], d: PROPANE_CH, a: propaneMid.a, t: -propaneMid.t },
    { el: 'H', ref: [1, 0, 2], d: PROPANE_CH, a: 111, t: 180 },
    { el: 'H', ref: [1, 0, 2], d: PROPANE_CH, a: 111, t: 60 },
    { el: 'H', ref: [1, 0, 2], d: PROPANE_CH, a: 111, t: -60 },
    { el: 'H', ref: [2, 0, 1], d: PROPANE_CH, a: 111, t: 180 },
    { el: 'H', ref: [2, 0, 1], d: PROPANE_CH, a: 111, t: 60 },
    { el: 'H', ref: [2, 0, 1], d: PROPANE_CH, a: 111, t: -60 },
  ],
  bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [1, 5, 1], [1, 6, 1], [1, 7, 1], [2, 8, 1], [2, 9, 1], [2, 10, 1]],
};

// formaldehyde: atoms 0 C, 1 O, 2 H, 3 H (planar; H-C-O = (360 - 116.5) / 2)
const CH2O_HCO = (360 - 116.5) / 2;
defs.formaldehyde = {
  rows: [
    { el: 'C' },
    { el: 'O', ref: [0], d: 1.208 },
    { el: 'H', ref: [0, 1], d: 1.116, a: CH2O_HCO },
    { el: 'H', ref: [0, 1, 2], d: 1.116, a: CH2O_HCO, t: 180 },
  ],
  bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 1]],
  dipoleDir: (p) => dirTo(mid(p[2], p[3]), p[1]), // toward oxygen, along the C2 axis
};

// ammonia: atoms 0 N, 1-3 H
defs.ammonia = {
  rows: [
    { el: 'N' },
    { el: 'H', ref: [0], d: 1.012 },
    { el: 'H', ref: [0, 1], d: 1.012, a: NH3_ANGLE },
    { el: 'H', ref: [0, 1, 2], d: 1.012, a: NH3_ANGLE, t: NH3_T },
  ],
  bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]],
  dipoleDir: (p) => dirTo(meanOf([p[1], p[2], p[3]]), p[0]), // from the hydrogen face toward nitrogen and its lone pair
};

// carbon monoxide: atoms 0 C, 1 O
defs.co = {
  rows: [{ el: 'C' }, { el: 'O', ref: [0], d: 1.128 }],
  bonds: [[0, 1, 3]],
  dipoleDir: (p) => dirTo(p[1], p[0]), // the small dipole has its negative end on carbon
};

// ozone: atoms 0 O (central), 1 O, 2 O
defs.ozone = {
  rows: [{ el: 'O' }, { el: 'O', ref: [0], d: 1.272 }, { el: 'O', ref: [0, 1], d: 1.272, a: 116.8 }],
  bonds: [[0, 1, 1.5], [0, 2, 1.5]],
  dipoleDir: (p) => dirTo(p[0], mid(p[1], p[2])), // central O is the positive end, the two outer O atoms the negative end
};

// difluoromethane R-32: atoms 0 C, 1 F, 2 F, 3 H, 4 H
const R32_HCH = 113.7;
const r32 = pairParams(108.3, R32_HCH);
defs.r32 = {
  rows: [
    { el: 'C' },
    { el: 'F', ref: [0], d: 1.357 },
    { el: 'F', ref: [0, 1], d: 1.357, a: 108.3 },
    { el: 'H', ref: [0, 1, 2], d: 1.093, a: r32.a, t: r32.t },
    { el: 'H', ref: [0, 1, 2], d: 1.093, a: r32.a, t: -r32.t },
  ],
  bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]],
  dipoleDir: (p) => dirTo(mid(p[3], p[4]), mid(p[1], p[2])), // toward the fluorine side
};

// R-134a, CH2F-CF3 (approximate): atoms 0 C (CH2F), 1 C (CF3), 2 F on C0, 3-4 H on C0, 5-7 F on C1
defs.r134a = {
  rows: [
    { el: 'C' },
    { el: 'C', ref: [0], d: 1.516 },
    { el: 'F', ref: [0, 1], d: 1.38, a: TET },
    { el: 'H', ref: [0, 1, 2], d: 1.09, a: TET, t: 120 },
    { el: 'H', ref: [0, 1, 2], d: 1.09, a: TET, t: -120 },
    { el: 'F', ref: [1, 0, 2], d: 1.34, a: TET, t: 180 },
    { el: 'F', ref: [1, 0, 2], d: 1.34, a: TET, t: 60 },
    { el: 'F', ref: [1, 0, 2], d: 1.34, a: TET, t: -60 },
  ],
  bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [1, 5, 1], [1, 6, 1], [1, 7, 1]],
  dipoleDir: (P, bonds, atoms) => bondPolarityDirection(atoms, bonds),
};

// ethylene: atoms 0 C, 1 C, 2-3 H on C0, 4-5 H on C1 (planar; H-C=C = (360 - 117.4) / 2)
const C2H4_HCC = (360 - 117.4) / 2;
defs.ethylene = {
  rows: [
    { el: 'C' },
    { el: 'C', ref: [0], d: 1.339 },
    { el: 'H', ref: [0, 1], d: 1.087, a: C2H4_HCC },
    { el: 'H', ref: [0, 1, 2], d: 1.087, a: C2H4_HCC, t: 180 },
    { el: 'H', ref: [1, 0, 2], d: 1.087, a: C2H4_HCC, t: 0 },
    { el: 'H', ref: [1, 0, 2], d: 1.087, a: C2H4_HCC, t: 180 },
  ],
  bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1]],
};

// vinyl chloride CH2=CHCl (approximate): atoms 0 C (CHCl), 1 C (CH2), 2 Cl, 3 H on C0, 4-5 H on C1 (planar)
defs.vinyl_chloride = {
  rows: [
    { el: 'C' },
    { el: 'C', ref: [0], d: 1.34 },
    { el: 'Cl', ref: [0, 1], d: 1.73, a: 122.6 },
    { el: 'H', ref: [0, 1, 2], d: 1.09, a: 124.0, t: 180 },
    { el: 'H', ref: [1, 0, 2], d: 1.09, a: 120, t: 0 },
    { el: 'H', ref: [1, 0, 2], d: 1.09, a: 120, t: 180 },
  ],
  bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1]],
  dipoleDir: (P, bonds, atoms) => bondPolarityDirection(atoms, bonds),
};

// benzene: atoms 0-5 C (ring), 6-11 H (H i+6 is on C i). Flat regular hexagon.
const BENZENE_RING = [
  { el: 'C' },
  { el: 'C', ref: [0], d: 1.397 },
  { el: 'C', ref: [1, 0], d: 1.397, a: 120 },
  { el: 'C', ref: [2, 1, 0], d: 1.397, a: 120, t: 0 },
  { el: 'C', ref: [3, 2, 1], d: 1.397, a: 120, t: 0 },
  { el: 'C', ref: [4, 3, 2], d: 1.397, a: 120, t: 0 },
];
const ringBonds = [[0, 1, 1.5], [1, 2, 1.5], [2, 3, 1.5], [3, 4, 1.5], [4, 5, 1.5], [5, 0, 1.5]];
defs.benzene = {
  rows: [
    ...BENZENE_RING,
    { el: 'H', ref: [0, 1, 2], d: 1.087, a: 120, t: 180 },
    { el: 'H', ref: [1, 0, 5], d: 1.087, a: 120, t: 180 },
    { el: 'H', ref: [2, 1, 0], d: 1.087, a: 120, t: 180 },
    { el: 'H', ref: [3, 2, 1], d: 1.087, a: 120, t: 180 },
    { el: 'H', ref: [4, 3, 2], d: 1.087, a: 120, t: 180 },
    { el: 'H', ref: [5, 4, 3], d: 1.087, a: 120, t: 180 },
  ],
  bonds: [...ringBonds, [0, 6, 1], [1, 7, 1], [2, 8, 1], [3, 9, 1], [4, 10, 1], [5, 11, 1]],
};

// styrene C6H5-CH=CH2 (approximate): atoms 0-5 ring C, 6 C (alpha, on the ring), 7 C (beta, CH2),
// 8-12 ring H on C1..C5, 13 H on C6, 14-15 H on C7. All atoms in one plane.
defs.styrene = {
  rows: [
    ...BENZENE_RING,
    { el: 'C', ref: [0, 1, 2], d: 1.47, a: 120, t: 180 },
    { el: 'C', ref: [6, 0, 1], d: 1.34, a: 127, t: 0 },
    { el: 'H', ref: [1, 0, 5], d: 1.087, a: 120, t: 180 },
    { el: 'H', ref: [2, 1, 0], d: 1.087, a: 120, t: 180 },
    { el: 'H', ref: [3, 2, 1], d: 1.087, a: 120, t: 180 },
    { el: 'H', ref: [4, 3, 2], d: 1.087, a: 120, t: 180 },
    { el: 'H', ref: [5, 4, 3], d: 1.087, a: 120, t: 180 },
    { el: 'H', ref: [6, 0, 7], d: 1.09, a: 116, t: 180 },
    { el: 'H', ref: [7, 6, 0], d: 1.09, a: 120, t: 0 },
    { el: 'H', ref: [7, 6, 0], d: 1.09, a: 120, t: 180 },
  ],
  bonds: [...ringBonds, [0, 6, 1], [6, 7, 2],
    [1, 8, 1], [2, 9, 1], [3, 10, 1], [4, 11, 1], [5, 12, 1], [6, 13, 1], [7, 14, 1], [7, 15, 1]],
};

// ---------- records ----------
const FORMULA_DISPLAY = { H3N: 'NH3' }; // the common way to write ammonia; Hill order gives H3N

function htmlOf(text) { return text.replace(/(\d+)/g, '<sub>$1</sub>'); }

function make(id, info) {
  const def = defs[info.defKey || id];
  const structure = build(def.rows, def.bonds);
  const raw = fromZMatrix(def.rows);
  const hill = formula(structure.atoms);
  const display = FORMULA_DISPLAY[hill] || hill;
  let dipoleDir = null;
  if (info.polar) {
    if (!def.dipoleDir) throw new Error(`${id}: polar molecule needs a dipole direction`);
    dipoleDir = def.dipoleDir(raw.map((a) => a.pos), structure.bonds, raw);
  }
  return {
    id,
    name: info.name,
    formula: hill,
    formulaHtml: formulaHtml(structure.atoms),
    formulaDisplay: display,
    formulaDisplayHtml: htmlOf(display),
    group: info.group,
    atoms: structure.atoms,
    bonds: structure.bonds,
    shape: info.shape,
    shapeWhy: info.shapeWhy,
    polar: info.polar,
    dipole: info.dipole,
    dipoleDir,
    facts: info.facts,
    keyBonds: info.keyBonds,
    keyAngles: info.keyAngles,
    source: info.source,
    quality: info.quality,
  };
}

export const MOLECULES = {};
const add = (id, info) => { MOLECULES[id] = make(id, info); };

add('water', {
  name: 'Water', group: 'air',
  shape: 'Bent', shapeWhy: 'Two lone pairs on oxygen push the two O–H bonds together.',
  polar: true, dipole: 1.85,
  facts: [
    'Water vapor is an invisible gas in the air, and it condenses into liquid when it meets a surface colder than its dew point.',
    'Condensation on a window or inside a wall cavity is this same molecule changing state, which is why vapor control matters in building envelopes.',
    'The bent shape and the uneven charge make water molecules cling to each other, so water stays liquid at room temperature.',
  ],
  keyBonds: [{ label: 'O–H', a: 0, b: 1, length: 0.957 }],
  keyAngles: [{ label: 'H–O–H', a: 1, b: 0, c: 2, angle: 104.5 }],
  source: 'CRC Handbook / NIST CCCBDB values', quality: 'reference',
});

add('n2', {
  name: 'Nitrogen', group: 'air',
  shape: 'Linear', shapeWhy: 'Two atoms always lie on a straight line.',
  polar: false, dipole: 0,
  facts: [
    'Nitrogen makes up about 78 percent of dry air.',
    'Its triple bond is very strong, so nitrogen gas is chemically calm and does not react with building materials.',
    'Most of the air that ventilation moves through a building is nitrogen, but it has no effect on comfort or health.',
  ],
  keyBonds: [{ label: 'N≡N', a: 0, b: 1, length: 1.098 }],
  keyAngles: [],
  source: 'CRC Handbook / NIST CCCBDB values', quality: 'reference',
});

add('o2', {
  name: 'Oxygen', group: 'air',
  shape: 'Linear', shapeWhy: 'Two atoms always lie on a straight line.',
  polar: false, dipole: 0,
  facts: [
    'Oxygen makes up about 21 percent of dry air.',
    'People need it to breathe, and fuel needs it to burn, so every combustion appliance must have a supply of air.',
    'Oxygen also takes part in rust, which is why steel is protected with coatings or galvanizing and is kept dry.',
  ],
  keyBonds: [{ label: 'O=O', a: 0, b: 1, length: 1.208 }],
  keyAngles: [],
  source: 'CRC Handbook / NIST CCCBDB values', quality: 'reference',
});

add('co2', {
  name: 'Carbon dioxide', group: 'air',
  shape: 'Linear', shapeWhy: 'Carbon has no lone pairs, so its two double bonds spread as far apart as possible.',
  polar: false, dipole: 0,
  facts: [
    'People breathe out carbon dioxide, so its level indoors rises when many people share a room with little fresh air.',
    'That makes carbon dioxide a common indicator of ventilation: readings well above outdoor air suggest stale air.',
    'It is also a greenhouse gas, released when fuels burn, including the gas and oil used to heat buildings.',
    'The molecule is straight, so its two polar C=O bonds cancel and it has no overall dipole.',
  ],
  keyBonds: [
    { label: 'C=O', a: 0, b: 1, length: 1.160 },
    { label: 'C=O', a: 0, b: 2, length: 1.160 },
  ],
  keyAngles: [{ label: 'O=C=O', a: 1, b: 0, c: 2, angle: 180 }],
  source: 'CRC Handbook / NIST CCCBDB values', quality: 'reference',
});

add('methane', {
  name: 'Methane', group: 'fuel',
  shape: 'Tetrahedral', shapeWhy: 'Four bonds spread as far apart as possible in three dimensions, about 109.5 degrees from each other.',
  polar: false, dipole: 0,
  facts: [
    'Methane is the main part of natural gas, which many buildings burn for heating, hot water, and cooking.',
    'Its four equal C–H bonds point to the corners of a tetrahedron, so the molecule is non-polar.',
    'Natural gas has almost no smell of its own, so utilities add a strong odor to make leaks noticeable.',
    'Methane that leaks without burning is a strong greenhouse gas.',
  ],
  keyBonds: [{ label: 'C–H', a: 0, b: 1, length: 1.087 }],
  keyAngles: [{ label: 'H–C–H', a: 1, b: 0, c: 2, angle: 109.47 }],
  source: 'CRC Handbook / NIST CCCBDB values', quality: 'reference',
});

add('propane', {
  name: 'Propane', group: 'fuel',
  shape: 'Chain of three carbons', shapeWhy: 'Each carbon is tetrahedral, so the three-carbon chain bends in a zigzag rather than lying straight.',
  polar: false, dipole: 0.08,
  facts: [
    'Propane is stored as a liquid under modest pressure, so it can be delivered in tanks to buildings that have no gas main.',
    'It is used for heating, cooking, and backup generators.',
    'Propane is heavier than air, so a leak tends to collect low in a basement or crawlspace.',
    'Its dipole is tiny, so propane is treated as non-polar.',
  ],
  keyBonds: [
    { label: 'C–C', a: 0, b: 1, length: 1.526 },
    { label: 'C–H', a: 0, b: 3, length: 1.09 },
  ],
  keyAngles: [{ label: 'C–C–C', a: 1, b: 0, c: 2, angle: 112.4 }],
  source: 'C–C and C–C–C from the experimental structure; C–H set to 1.09 Å and the hydrogens placed at idealized angles',
  quality: 'approximate',
});

add('formaldehyde', {
  name: 'Formaldehyde', group: 'indoor',
  shape: 'Trigonal planar', shapeWhy: 'Carbon has three neighbors, which spread flat about 120 degrees apart.',
  polar: true, dipole: 2.33,
  facts: [
    'Formaldehyde is a colorless gas with a sharp smell that can irritate the eyes and nose at low levels.',
    'Adhesives in some pressed-wood products, such as particleboard, plywood, and cabinets, can release it slowly into indoor air.',
    'Ventilation, low-emitting products, and time all help bring the level down.',
    'Its carbon is double-bonded to oxygen, which makes the molecule strongly polar.',
  ],
  keyBonds: [
    { label: 'C=O', a: 0, b: 1, length: 1.208 },
    { label: 'C–H', a: 0, b: 2, length: 1.116 },
  ],
  keyAngles: [{ label: 'H–C–H', a: 2, b: 0, c: 3, angle: 116.5 }],
  source: 'CRC Handbook / NIST CCCBDB values', quality: 'reference',
});

add('ammonia', {
  name: 'Ammonia', group: 'indoor',
  shape: 'Trigonal pyramidal', shapeWhy: 'The lone pair on nitrogen pushes the three N–H bonds down into a shallow pyramid.',
  polar: true, dipole: 1.47,
  facts: [
    'Ammonia is a gas with a sharp smell that dissolves easily in water, and household ammonia cleaner is that solution.',
    'Mixing ammonia cleaners with bleach releases harmful gases, so the two should never be combined indoors.',
    'Ammonia is also used as a refrigerant in large industrial cooling plants and cold storage buildings.',
  ],
  keyBonds: [{ label: 'N–H', a: 0, b: 1, length: 1.012 }],
  keyAngles: [{ label: 'H–N–H', a: 1, b: 0, c: 2, angle: 106.7 }],
  source: 'CRC Handbook / NIST CCCBDB values', quality: 'reference',
});

add('co', {
  name: 'Carbon monoxide', group: 'indoor',
  shape: 'Linear', shapeWhy: 'Two atoms always lie on a straight line.',
  polar: true, dipole: 0.11,
  facts: [
    'Carbon monoxide is a colorless, odorless gas made when fuel burns without enough air, for example in a faulty furnace, water heater, stove, or fireplace.',
    'It is toxic because it binds to blood and keeps oxygen from reaching the body, so homes with fuel-burning appliances or an attached garage need carbon monoxide alarms.',
    'Its triple bond is similar to the one in nitrogen gas.',
    'Its dipole is small, and its negative end is on the carbon atom even though oxygen pulls electrons more strongly.',
  ],
  keyBonds: [{ label: 'C≡O', a: 0, b: 1, length: 1.128 }],
  keyAngles: [],
  source: 'CRC Handbook / NIST CCCBDB values', quality: 'reference',
});

add('ozone', {
  name: 'Ozone', group: 'indoor',
  shape: 'Bent', shapeWhy: 'The central oxygen has a lone pair, so the three atoms form a V rather than a straight line.',
  polar: true, dipole: 0.53,
  facts: [
    'Ozone is a bent molecule of three oxygen atoms and is a strong oxidizer.',
    'High in the atmosphere it shields the earth from ultraviolet light, but at ground level it is a lung irritant.',
    'Indoors, ozone can come from some air cleaners and copy machines, and it attacks rubber and some other materials.',
  ],
  keyBonds: [
    { label: 'O–O', a: 0, b: 1, length: 1.272 },
    { label: 'O–O', a: 0, b: 2, length: 1.272 },
  ],
  keyAngles: [{ label: 'O–O–O', a: 1, b: 0, c: 2, angle: 116.8 }],
  source: 'CRC Handbook / NIST CCCBDB values', quality: 'reference',
});

add('r32', {
  name: 'Difluoromethane (R-32)', group: 'refrigerant',
  shape: 'Tetrahedral', shapeWhy: 'Carbon has four bonds arranged around a tetrahedron, slightly stretched because fluorine is bigger than hydrogen.',
  polar: true, dipole: 1.98,
  facts: [
    'R-32 is difluoromethane, a refrigerant used in many modern heat pumps and air conditioners.',
    'A refrigerant picks up heat as it evaporates in one coil and gives it off as it condenses in another, which moves heat into or out of a building.',
    'R-32 has a lower global warming potential than older refrigerants such as R-410A, and it is mildly flammable.',
  ],
  keyBonds: [
    { label: 'C–F', a: 0, b: 1, length: 1.357 },
    { label: 'C–H', a: 0, b: 3, length: 1.093 },
  ],
  keyAngles: [
    { label: 'F–C–F', a: 1, b: 0, c: 2, angle: 108.3 },
    { label: 'H–C–H', a: 3, b: 0, c: 4, angle: R32_HCH },
  ],
  source: 'Experimental (microwave) geometry as tabulated by NIST CCCBDB; the H–C–H angle is from memory',
  quality: 'reference',
});

add('r134a', {
  name: '1,1,1,2-Tetrafluoroethane (R-134a)', group: 'refrigerant',
  shape: 'Two linked tetrahedral carbons', shapeWhy: 'Each carbon has four neighbors arranged around a tetrahedron.',
  polar: true, dipole: 2.06,
  facts: [
    'R-134a is a refrigerant that has long been used in chillers, refrigerators, and car air conditioning.',
    'Its global warming potential is high, so it is being phased down in favor of other refrigerants.',
    'The fluorine atoms are concentrated on one side of the molecule, which makes it strongly polar.',
  ],
  keyBonds: [
    { label: 'C–C', a: 0, b: 1, length: 1.516 },
    { label: 'C–F (CH2F end)', a: 0, b: 2, length: 1.38 },
    { label: 'C–F (CF3 end)', a: 1, b: 5, length: 1.34 },
  ],
  keyAngles: [{ label: 'F–C–C (CH2F end)', a: 2, b: 0, c: 1, angle: 109.47 }],
  source: 'Typical bond lengths with ideal tetrahedral angles; a drawing of the idea, not a measured structure',
  quality: 'approximate',
});

add('ethylene', {
  name: 'Ethylene', group: 'building',
  shape: 'Planar', shapeWhy: 'Each carbon has three neighbors, so all six atoms lie in one flat plane.',
  polar: false, dipole: 0,
  facts: [
    'Ethylene molecules link end to end to form polyethylene, the most widely made plastic.',
    'Polyethylene sheet is used as a vapor retarder under slabs and in walls, and cross-linked polyethylene is used for PEX pipe.',
    'The double bond is the reactive part: it opens up so that the molecules can join into long chains.',
  ],
  keyBonds: [
    { label: 'C=C', a: 0, b: 1, length: 1.339 },
    { label: 'C–H', a: 0, b: 2, length: 1.087 },
  ],
  keyAngles: [{ label: 'H–C–H', a: 2, b: 0, c: 3, angle: 117.4 }],
  source: 'CRC Handbook / NIST CCCBDB values', quality: 'reference',
});

add('vinyl_chloride', {
  name: 'Vinyl chloride', group: 'building',
  shape: 'Planar', shapeWhy: 'Each carbon has three neighbors, so all the atoms lie in one flat plane.',
  polar: true, dipole: 1.45,
  facts: [
    'Vinyl chloride molecules join into polyvinyl chloride, known as PVC or vinyl.',
    'PVC is used for drain and water pipe, siding, window frames, and roofing membranes.',
    'Vinyl chloride itself is a gas handled only in factories, and the finished plastic is a stable solid.',
  ],
  keyBonds: [
    { label: 'C=C', a: 0, b: 1, length: 1.34 },
    { label: 'C–Cl', a: 0, b: 2, length: 1.73 },
  ],
  keyAngles: [{ label: 'C=C–Cl', a: 1, b: 0, c: 2, angle: 122.6 }],
  source: 'Typical bond lengths and angles; the dipole direction is a bond-polarity estimate',
  quality: 'approximate',
});

add('styrene', {
  name: 'Styrene', group: 'building',
  shape: 'Planar ring with a two-carbon tail', shapeWhy: 'The ring and the vinyl tail are both flat, and they sit in the same plane.',
  polar: false, dipole: 0.13,
  facts: [
    'Styrene joins into polystyrene, the plastic used for expanded polystyrene (EPS) and extruded polystyrene (XPS) foam insulation boards.',
    'Both foams trap air or gas in tiny cells, which slows heat flow through walls, roofs, and under slabs.',
    'Styrene is a benzene ring with a short vinyl tail, and the tail is the part that links into chains.',
    'Foam plastic insulation can burn, so building codes require it to be protected by a thermal barrier in many places.',
  ],
  keyBonds: [
    { label: 'C–C (ring)', a: 0, b: 1, length: 1.397 },
    { label: 'C=C (tail)', a: 6, b: 7, length: 1.34 },
  ],
  keyAngles: [],
  source: 'Ring from benzene values, tail from typical bond lengths; the real molecule has a slightly distorted ring',
  quality: 'approximate',
});

add('benzene', {
  name: 'Benzene', group: 'building',
  shape: 'Planar ring', shapeWhy: 'Six carbons form a flat hexagon with 120 degree angles, and the electrons are shared around the whole ring.',
  polar: false, dipole: 0,
  facts: [
    'Benzene is a flat ring of six carbon atoms, each carrying one hydrogen.',
    'All six carbon-carbon bonds have the same length, between a single and a double bond, because the electrons are shared around the ring.',
    'The same ring is part of styrene and of many other plastics and resins.',
    'Benzene itself is a liquid that evaporates easily and is harmful to breathe, so it is kept out of indoor air.',
  ],
  keyBonds: [
    { label: 'C–C', a: 0, b: 1, length: 1.397 },
    { label: 'C–H', a: 0, b: 6, length: 1.087 },
  ],
  keyAngles: [{ label: 'C–C–C', a: 0, b: 1, c: 2, angle: 120 }],
  source: 'CRC Handbook / NIST CCCBDB values', quality: 'reference',
});

export const MOLECULE_ORDER = [
  'water', 'n2', 'o2', 'co2',
  'methane', 'propane',
  'formaldehyde', 'ammonia', 'co', 'ozone',
  'r32', 'r134a',
  'ethylene', 'vinyl_chloride', 'styrene', 'benzene',
];

export const MOLECULE_GROUPS = {
  air: 'Air',
  fuel: 'Fuels',
  indoor: 'Indoor air',
  refrigerant: 'Refrigerants',
  building: 'Building plastics',
};
