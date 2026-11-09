// Tests for molecules/elements.js, chem.js and molecule-data.js.
// Geometry is MEASURED from the built coordinates and compared with reference values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENTS } from '../molecules/elements.js';
import {
  dist, angleDeg, dihedralDeg, centroid, centerStructure, molarMass, formula, formulaHtml,
  guessBonds, boundingRadius, fromZMatrix,
} from '../molecules/chem.js';
import { MOLECULES, MOLECULE_ORDER, MOLECULE_GROUPS } from '../molecules/molecule-data.js';

const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg || ''} expected ${expected} +/- ${tol}, got ${actual}`);

const mol = (id) => MOLECULES[id];
const P = (m, i) => m.atoms[i].pos;

// ---- helpers that measure a molecule from its bond list ----
function neighbors(m, i) {
  const out = [];
  for (const b of m.bonds) { if (b.a === i) out.push(b.b); else if (b.b === i) out.push(b.a); }
  return out;
}
/** All measured bond lengths between elements e1 and e2 (order-independent). */
function lengths(m, e1, e2) {
  return m.bonds
    .filter((b) => {
      const x = m.atoms[b.a].el, y = m.atoms[b.b].el;
      return (x === e1 && y === e2) || (x === e2 && y === e1);
    })
    .map((b) => dist(P(m, b.a), P(m, b.b)));
}
/** All measured angles e1 - center - e2 over every atom of element `center`. */
function angles(m, e1, center, e2) {
  const out = [];
  m.atoms.forEach((at, c) => {
    if (at.el !== center) return;
    const nb = neighbors(m, c);
    for (let i = 0; i < nb.length; i++) {
      for (let j = i + 1; j < nb.length; j++) {
        const x = m.atoms[nb[i]].el, y = m.atoms[nb[j]].el;
        if ((x === e1 && y === e2) || (x === e2 && y === e1)) out.push(angleDeg(P(m, nb[i]), P(m, c), P(m, nb[j])));
      }
    }
  });
  return out;
}
function expectLengths(id, e1, e2, expected, count, tol = 0.01) {
  const ls = lengths(mol(id), e1, e2);
  if (count !== undefined) assert.equal(ls.length, count, `${id} ${e1}-${e2} count`);
  assert.ok(ls.length > 0, `${id} has no ${e1}-${e2} bonds`);
  for (const l of ls) near(l, expected, tol, `${id} ${e1}-${e2} length`);
}
function expectAngles(id, e1, c, e2, expected, count, tol = 0.5) {
  const as = angles(mol(id), e1, c, e2);
  if (count !== undefined) assert.equal(as.length, count, `${id} ${e1}-${c}-${e2} count`);
  assert.ok(as.length > 0, `${id} has no ${e1}-${c}-${e2} angles`);
  for (const a of as) near(a, expected, tol, `${id} ${e1}-${c}-${e2} angle`);
}
function planeResidual(atoms) {
  // fit a plane through the first three non-collinear atoms and report the max out-of-plane distance
  const p0 = atoms[0].pos;
  let n = null;
  for (let i = 1; i < atoms.length && !n; i++) {
    for (let j = i + 1; j < atoms.length && !n; j++) {
      const u = atoms[i].pos.map((v, k) => v - p0[k]);
      const w = atoms[j].pos.map((v, k) => v - p0[k]);
      const c = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const len = Math.hypot(...c);
      if (len > 1e-3) n = c.map((v) => v / len);
    }
  }
  assert.ok(n, 'no plane found');
  return Math.max(...atoms.map((a) => Math.abs(a.pos.reduce((s, v, k) => s + (v - p0[k]) * n[k], 0))));
}
const unitDot = (u, v) => {
  const nu = Math.hypot(...u), nv = Math.hypot(...v);
  return (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (nu * nv);
};
const vec = (a, b) => b.map((v, k) => v - a[k]);
const midpoint = (a, b) => a.map((v, k) => (v + b[k]) / 2);

// ---------------------------------------------------------------- elements
test('elements: the 17 required elements are present with the contract fields', () => {
  const required = ['H', 'C', 'N', 'O', 'F', 'Na', 'Mg', 'Al', 'Si', 'S', 'Cl', 'Ca', 'Ti', 'Fe', 'Cu', 'Zn', 'Cs'];
  const Z = { H: 1, C: 6, N: 7, O: 8, F: 9, Na: 11, Mg: 12, Al: 13, Si: 14, S: 16, Cl: 17, Ca: 20, Ti: 22, Fe: 26, Cu: 29, Zn: 30, Cs: 55 };
  for (const s of required) {
    const e = ELEMENTS[s];
    assert.ok(e, `${s} missing`);
    assert.equal(e.symbol, s);
    assert.equal(e.Z, Z[s], `${s} atomic number`);
    assert.ok(typeof e.name === 'string' && e.name.length > 0);
    assert.ok(e.mass > 0);
    assert.match(e.color, /^#[0-9a-f]{6}$/i);
    assert.ok(e.covalent > 0.2 && e.covalent < 3);
    assert.ok(e.vdw > e.covalent * 0.9 && e.vdw < 4);
  }
  assert.equal(Object.keys(ELEMENTS).length, required.length);
});

test('elements: metallic radii match the contract and non-metals are null', () => {
  const metallic = { Fe: 1.26, Al: 1.43, Cu: 1.28, Zn: 1.34, Ti: 1.47, Mg: 1.60, Na: 1.86, Ca: 1.97, Cs: 2.65 };
  for (const [s, r] of Object.entries(metallic)) assert.equal(ELEMENTS[s].metallic, r, s);
  for (const s of ['H', 'C', 'N', 'O', 'F', 'Si', 'S', 'Cl']) assert.equal(ELEMENTS[s].metallic, null, s);
});

test('elements: standard atomic weights', () => {
  near(ELEMENTS.H.mass, 1.008, 0.001);
  near(ELEMENTS.C.mass, 12.011, 0.001);
  near(ELEMENTS.O.mass, 15.999, 0.001);
  near(ELEMENTS.Fe.mass, 55.845, 0.001);
  near(ELEMENTS.Si.mass, 28.085, 0.001);
});

// ---------------------------------------------------------------- chem.js helpers
test('chem: dist, angleDeg and dihedralDeg on known points', () => {
  near(dist([0, 0, 0], [3, 4, 0]), 5, 1e-12);
  near(angleDeg([1, 0, 0], [0, 0, 0], [0, 1, 0]), 90, 1e-9);
  near(angleDeg([1, 0, 0], [0, 0, 0], [-1, 0, 0]), 180, 1e-9);
  near(angleDeg([1, 0, 0], [0, 0, 0], [1, 1, 0]), 45, 1e-9);
  // trans = 180, cis = 0, and the sign follows the IUPAC rule
  near(Math.abs(dihedralDeg([1, 1, 0], [0, 1, 0], [0, 0, 0], [-1, 0, 0])), 180, 1e-9);
  near(dihedralDeg([1, 1, 0], [0, 1, 0], [0, 0, 0], [1, 0, 0]), 0, 1e-9);
  near(dihedralDeg([1, 1, 0], [0, 1, 0], [0, 0, 0], [0, 0, 1]), 90, 1e-9);
  near(dihedralDeg([1, 1, 0], [0, 1, 0], [0, 0, 0], [0, 0, -1]), -90, 1e-9);
});

test('chem: centroid, centerStructure and boundingRadius', () => {
  const s = {
    atoms: [{ el: 'H', pos: [2, 0, 0] }, { el: 'H', pos: [4, 0, 0] }],
    bonds: [{ a: 0, b: 1, order: 1 }],
    cell: { origin: [2, 0, 0], a: [1, 0, 0], b: [0, 1, 0], c: [0, 0, 1] },
  };
  assert.deepEqual(centroid(s.atoms), [3, 0, 0]);
  const c = centerStructure(s);
  assert.deepEqual(c.atoms[0].pos, [-1, 0, 0]);
  assert.deepEqual(c.cell.origin, [-1, 0, 0]);
  assert.deepEqual(s.atoms[0].pos, [2, 0, 0], 'input is not modified');
  assert.deepEqual(c.bonds, s.bonds);
  near(boundingRadius(c), 1, 1e-12);
});

test('chem: formula uses Hill order and formulaHtml adds subscripts', () => {
  const at = (...els) => els.map((el) => ({ el, pos: [0, 0, 0] }));
  assert.equal(formula(at('C', 'C', 'O', 'H', 'H', 'H', 'H', 'H', 'H')), 'C2H6O');
  assert.equal(formula(at('O', 'H', 'H')), 'H2O');
  assert.equal(formula(at('N', 'H', 'H', 'H')), 'H3N');
  assert.equal(formula(at('C', 'O', 'O')), 'CO2');
  assert.equal(formula(at('C', 'Cl', 'H', 'H', 'H')), 'CH3Cl');
  assert.equal(formula(at('Na', 'Cl')), 'ClNa');
  assert.equal(formula(at('C', 'F', 'F', 'F', 'F')), 'CF4');
  assert.equal(formula(at('O', 'O', 'O')), 'O3');
  assert.equal(formulaHtml(at('O', 'H', 'H')), 'H<sub>2</sub>O');
  assert.equal(formulaHtml(at('C', 'O', 'O')), 'CO<sub>2</sub>');
});

test('chem: molarMass of listed molecules', () => {
  const expected = {
    water: 18.015, co2: 44.009, methane: 16.043, ammonia: 17.031, formaldehyde: 30.026,
    benzene: 78.114, r32: 52.023, propane: 44.097,
  };
  for (const [id, m] of Object.entries(expected)) near(molarMass(mol(id).atoms), m, 0.01, id);
});

test('chem: fromZMatrix places atoms exactly and with the right dihedral sign', () => {
  const atoms = fromZMatrix([
    { el: 'C' },
    { el: 'C', ref: [0], d: 1.5 },
    { el: 'C', ref: [1, 0], d: 1.4, a: 110 },
    { el: 'C', ref: [2, 1, 0], d: 1.3, a: 120, t: 60 },
    { el: 'C', ref: [2, 1, 0], d: 1.3, a: 120, t: -75 },
  ]);
  const p = atoms.map((a) => a.pos);
  near(dist(p[0], p[1]), 1.5, 1e-12);
  near(dist(p[1], p[2]), 1.4, 1e-12);
  near(angleDeg(p[0], p[1], p[2]), 110, 1e-9);
  near(dist(p[2], p[3]), 1.3, 1e-12);
  near(angleDeg(p[1], p[2], p[3]), 120, 1e-9);
  near(dihedralDeg(p[3], p[2], p[1], p[0]), 60, 1e-9);
  near(dihedralDeg(p[0], p[1], p[2], p[3]), 60, 1e-9);
  near(dihedralDeg(p[4], p[2], p[1], p[0]), -75, 1e-9);
  assert.deepEqual(p[0], [0, 0, 0]);
  assert.equal(atoms[3].el, 'C');
});

test('chem: fromZMatrix is stable for linear reference triples', () => {
  // O=C=O then an atom referenced to the collinear triple: no NaN, correct distance and angle
  const atoms = fromZMatrix([
    { el: 'O' },
    { el: 'C', ref: [0], d: 1.16 },
    { el: 'O', ref: [1, 0], d: 1.16, a: 180 },
    { el: 'H', ref: [2, 1, 0], d: 1.0, a: 90, t: 33 },
    { el: 'H', ref: [2, 1, 0], d: 1.0, a: 109, t: 0 },
  ]);
  for (const a of atoms) for (const v of a.pos) assert.ok(Number.isFinite(v));
  near(dist(atoms[2].pos, atoms[3].pos), 1.0, 1e-9);
  near(angleDeg(atoms[1].pos, atoms[2].pos, atoms[3].pos), 90, 1e-9);
  near(angleDeg(atoms[1].pos, atoms[2].pos, atoms[4].pos), 109, 1e-9);
  near(angleDeg(atoms[0].pos, atoms[1].pos, atoms[2].pos), 180, 1e-6);
  // an exactly 180 degree angle gives exactly collinear atoms
  near(dist(atoms[0].pos, atoms[2].pos), 2.32, 1e-9);
});

test('chem: guessBonds finds bonded pairs and respects the tolerance', () => {
  const water = mol('water').atoms;
  assert.equal(guessBonds(water).length, 2);
  assert.equal(guessBonds(water, 0).length, 2);
  assert.equal(guessBonds([{ el: 'H', pos: [0, 0, 0] }, { el: 'H', pos: [3, 0, 0] }]).length, 0);
  const g = guessBonds([{ el: 'C', pos: [0, 0, 0] }, { el: 'C', pos: [1.5, 0, 0] }]);
  assert.deepEqual(g, [{ a: 0, b: 1, order: 1 }]);
});

// ---------------------------------------------------------------- library structure
test('library: order list, groups and required ids', () => {
  const ids = Object.keys(MOLECULES);
  assert.equal(new Set(MOLECULE_ORDER).size, MOLECULE_ORDER.length, 'no duplicates in order');
  assert.deepEqual([...MOLECULE_ORDER].sort(), [...ids].sort());
  assert.equal(ids.length, 16);
  assert.deepEqual(MOLECULE_GROUPS, { air: 'Air', fuel: 'Fuels', indoor: 'Indoor air', refrigerant: 'Refrigerants', building: 'Building plastics' });
  const byGroup = {};
  for (const m of Object.values(MOLECULES)) (byGroup[m.group] ||= []).push(m.id);
  assert.deepEqual(new Set(byGroup.air), new Set(['water', 'n2', 'o2', 'co2']));
  assert.deepEqual(new Set(byGroup.fuel), new Set(['methane', 'propane']));
  assert.deepEqual(new Set(byGroup.indoor), new Set(['formaldehyde', 'ammonia', 'co', 'ozone']));
  assert.deepEqual(new Set(byGroup.refrigerant), new Set(['r32', 'r134a']));
  assert.deepEqual(new Set(byGroup.building), new Set(['ethylene', 'vinyl_chloride', 'styrene', 'benzene']));
});

test('library: required fields and sensible types on every molecule', () => {
  for (const m of Object.values(MOLECULES)) {
    const ctx = m.id;
    assert.equal(MOLECULES[m.id], m);
    assert.ok(m.name && m.formula && m.shape && m.shapeWhy && m.source, ctx);
    assert.ok(m.group in MOLECULE_GROUPS, ctx);
    assert.ok(['reference', 'approximate', 'schematic'].includes(m.quality), ctx);
    assert.equal(typeof m.polar, 'boolean', ctx);
    assert.ok(typeof m.dipole === 'number' && m.dipole >= 0, ctx);
    assert.ok(Array.isArray(m.keyBonds) && Array.isArray(m.keyAngles), ctx);
    assert.ok(typeof m.formulaHtml === 'string' && m.formulaHtml.length > 0, ctx);
    assert.ok(typeof m.formulaDisplay === 'string' && typeof m.formulaDisplayHtml === 'string', ctx);
  }
});

test('library: formula matches formula(atoms) in Hill order', () => {
  for (const m of Object.values(MOLECULES)) {
    assert.equal(m.formula, formula(m.atoms), m.id);
    assert.equal(m.formulaHtml, formulaHtml(m.atoms), m.id);
  }
  const expected = {
    water: 'H2O', n2: 'N2', o2: 'O2', co2: 'CO2', methane: 'CH4', propane: 'C3H8', formaldehyde: 'CH2O',
    ammonia: 'H3N', co: 'CO', ozone: 'O3', r32: 'CH2F2', r134a: 'C2H2F4', ethylene: 'C2H4',
    vinyl_chloride: 'C2H3Cl', styrene: 'C8H8', benzene: 'C6H6',
  };
  for (const [id, f] of Object.entries(expected)) assert.equal(mol(id).formula, f, id);
  assert.equal(mol('ammonia').formulaDisplay, 'NH3');
  assert.equal(mol('water').formulaDisplayHtml, 'H<sub>2</sub>O');
});

test('library: bonds have valid indices, orders and no duplicates', () => {
  for (const m of Object.values(MOLECULES)) {
    const seen = new Set();
    for (const b of m.bonds) {
      assert.ok(Number.isInteger(b.a) && Number.isInteger(b.b), m.id);
      assert.ok(b.a >= 0 && b.a < m.atoms.length && b.b >= 0 && b.b < m.atoms.length, `${m.id} bond index`);
      assert.notEqual(b.a, b.b, `${m.id} self bond`);
      assert.ok([1, 1.5, 2, 3].includes(b.order), `${m.id} bond order`);
      const key = b.a < b.b ? `${b.a}-${b.b}` : `${b.b}-${b.a}`;
      assert.ok(!seen.has(key), `${m.id} duplicate bond ${key}`);
      seen.add(key);
    }
    for (const kb of m.keyBonds) {
      assert.ok(kb.a >= 0 && kb.a < m.atoms.length && kb.b >= 0 && kb.b < m.atoms.length, `${m.id} keyBond index`);
    }
    for (const ka of m.keyAngles) {
      for (const i of [ka.a, ka.b, ka.c]) assert.ok(i >= 0 && i < m.atoms.length, `${m.id} keyAngle index`);
    }
  }
});

test('library: bond orders give the usual valences', () => {
  const valence = { H: 1, C: 4, N: 3, O: 2, F: 1, Cl: 1 };
  const exceptions = new Set(['ozone', 'co']); // ozone (resonance, central O shows 3) and CO (triple bond, O shows 3)
  for (const m of Object.values(MOLECULES)) {
    if (exceptions.has(m.id)) continue;
    const sum = m.atoms.map(() => 0);
    for (const b of m.bonds) { sum[b.a] += b.order; sum[b.b] += b.order; }
    m.atoms.forEach((a, i) => near(sum[i], valence[a.el], 1e-9, `${m.id} atom ${i} (${a.el}) valence`));
  }
  // the specific orders from the contract
  const orderOf = (id, a, b) => mol(id).bonds.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a)).order;
  assert.equal(orderOf('n2', 0, 1), 3);
  assert.equal(orderOf('o2', 0, 1), 2);
  assert.equal(orderOf('co2', 0, 1), 2);
  assert.equal(orderOf('co2', 0, 2), 2);
  assert.equal(orderOf('co', 0, 1), 3);
  assert.equal(orderOf('formaldehyde', 0, 1), 2);
  assert.equal(orderOf('ethylene', 0, 1), 2);
  assert.equal(orderOf('ozone', 0, 1), 1.5);
  assert.ok(mol('benzene').bonds.filter((b) => b.order === 1.5).length === 6);
});

test('library: every structure is centered on its centroid', () => {
  for (const m of Object.values(MOLECULES)) {
    const c = centroid(m.atoms);
    for (let k = 0; k < 3; k++) near(c[k], 0, 1e-6, `${m.id} centroid`);
  }
});

test('library: no two atoms are closer than 0.6 angstrom', () => {
  for (const m of Object.values(MOLECULES)) {
    for (let i = 0; i < m.atoms.length; i++) {
      for (let j = i + 1; j < m.atoms.length; j++) {
        assert.ok(dist(P(m, i), P(m, j)) >= 0.6, `${m.id} atoms ${i},${j} too close`);
      }
    }
  }
});

test('library: guessBonds reproduces the listed bond pairs for every molecule', () => {
  const pairs = (bonds) => bonds.map((b) => (b.a < b.b ? `${b.a}-${b.b}` : `${b.b}-${b.a}`)).sort();
  for (const m of Object.values(MOLECULES)) {
    assert.deepEqual(pairs(guessBonds(m.atoms)), pairs(m.bonds), m.id);
  }
});

test('library: elements used are in the element table', () => {
  for (const m of Object.values(MOLECULES)) for (const a of m.atoms) assert.ok(ELEMENTS[a.el], `${m.id} ${a.el}`);
});

// ---------------------------------------------------------------- measured geometry versus the contract
test('geometry: water', () => {
  expectLengths('water', 'O', 'H', 0.957, 2);
  expectAngles('water', 'H', 'O', 'H', 104.5, 1);
});

test('geometry: nitrogen, oxygen, carbon monoxide', () => {
  near(dist(P(mol('n2'), 0), P(mol('n2'), 1)), 1.098, 0.01);
  near(dist(P(mol('o2'), 0), P(mol('o2'), 1)), 1.208, 0.01);
  near(dist(P(mol('co'), 0), P(mol('co'), 1)), 1.128, 0.01);
});

test('geometry: carbon dioxide is linear', () => {
  expectLengths('co2', 'C', 'O', 1.160, 2);
  expectAngles('co2', 'O', 'C', 'O', 180, 1, 0.01);
});

test('geometry: diatomics and CO2 are exactly linear', () => {
  for (const id of ['n2', 'o2', 'co', 'co2']) {
    const m = mol(id);
    const [a, b] = [m.atoms[0].pos, m.atoms[m.atoms.length - 1].pos];
    const axis = vec(a, b);
    for (const at of m.atoms) {
      const w = vec(a, at.pos);
      const cross = [
        axis[1] * w[2] - axis[2] * w[1], axis[2] * w[0] - axis[0] * w[2], axis[0] * w[1] - axis[1] * w[0],
      ];
      near(Math.hypot(...cross) / Math.hypot(...axis), 0, 1e-9, `${id} off-axis distance`);
    }
  }
});

test('geometry: methane has four equal C-H bonds and six H-C-H angles of 109.47', () => {
  const m = mol('methane');
  const ls = lengths(m, 'C', 'H');
  assert.equal(ls.length, 4);
  for (const l of ls) near(l, 1.087, 0.01);
  near(Math.max(...ls) - Math.min(...ls), 0, 1e-9, 'equal C-H lengths');
  const as = angles(m, 'H', 'C', 'H');
  assert.equal(as.length, 6);
  for (const a of as) near(a, 109.47, 0.5);
  near(Math.max(...as) - Math.min(...as), 0, 1e-9, 'equal angles');
});

test('geometry: propane', () => {
  expectLengths('propane', 'C', 'C', 1.526, 2);
  expectLengths('propane', 'C', 'H', 1.09, 8);
  expectAngles('propane', 'C', 'C', 'C', 112.4, 1);
  // hydrogens are sensible: every H-C-H and H-C-C angle is close to tetrahedral
  for (const a of angles(mol('propane'), 'H', 'C', 'H')) assert.ok(a > 105 && a < 110, `H-C-H ${a}`);
  for (const a of angles(mol('propane'), 'H', 'C', 'C')) assert.ok(a > 108 && a < 112, `H-C-C ${a}`);
});

test('geometry: formaldehyde is planar with the contract values', () => {
  expectLengths('formaldehyde', 'C', 'O', 1.208, 1);
  expectLengths('formaldehyde', 'C', 'H', 1.116, 2);
  expectAngles('formaldehyde', 'H', 'C', 'H', 116.5, 1);
  near(planeResidual(mol('formaldehyde').atoms), 0, 1e-6);
});

test('geometry: ammonia', () => {
  expectLengths('ammonia', 'N', 'H', 1.012, 3);
  expectAngles('ammonia', 'H', 'N', 'H', 106.7, 3);
  // the three hydrogens sit on one side of nitrogen (a pyramid, not a flat molecule)
  const m = mol('ammonia');
  const hc = centroid(m.atoms.slice(1));
  assert.ok(dist(hc, P(m, 0)) > 0.3, 'nitrogen is above the hydrogen plane');
});

test('geometry: ozone', () => {
  expectLengths('ozone', 'O', 'O', 1.272, 2);
  expectAngles('ozone', 'O', 'O', 'O', 116.8, 1);
});

test('geometry: R-32', () => {
  expectLengths('r32', 'C', 'F', 1.357, 2);
  expectLengths('r32', 'C', 'H', 1.093, 2);
  expectAngles('r32', 'F', 'C', 'F', 108.3, 1);
  expectAngles('r32', 'H', 'C', 'H', 113.7, 1);
  for (const a of angles(mol('r32'), 'H', 'C', 'F')) assert.ok(a > 107 && a < 110, `H-C-F ${a}`);
});

test('geometry: R-134a is approximate with plausible geometry', () => {
  const m = mol('r134a');
  assert.equal(m.quality, 'approximate');
  expectLengths('r134a', 'C', 'C', 1.516, 1, 0.02);
  assert.equal(lengths(m, 'C', 'F').length, 4);
  assert.equal(lengths(m, 'C', 'H').length, 2);
  for (const a of [...angles(m, 'F', 'C', 'F'), ...angles(m, 'H', 'C', 'H'), ...angles(m, 'F', 'C', 'C'), ...angles(m, 'H', 'C', 'C')]) {
    near(a, 109.47, 0.5, 'R-134a angle');
  }
});

test('geometry: ethylene is planar', () => {
  const m = mol('ethylene');
  expectLengths('ethylene', 'C', 'C', 1.339, 1);
  expectLengths('ethylene', 'C', 'H', 1.087, 4);
  expectAngles('ethylene', 'H', 'C', 'H', 117.4, 2);
  near(planeResidual(m.atoms), 0, 1e-6);
});

test('geometry: vinyl chloride is planar and approximate', () => {
  const m = mol('vinyl_chloride');
  assert.equal(m.quality, 'approximate');
  expectLengths('vinyl_chloride', 'C', 'Cl', 1.73, 1);
  near(planeResidual(m.atoms), 0, 1e-6);
  const cc = lengths(m, 'C', 'C');
  assert.equal(cc.length, 1);
  near(cc[0], 1.34, 0.02);
  near(angleDeg(P(m, 1), P(m, 0), P(m, 2)), 122.6, 0.5);
});

test('geometry: benzene is a flat hexagon with six equal C-C bonds', () => {
  const m = mol('benzene');
  const cc = lengths(m, 'C', 'C');
  assert.equal(cc.length, 6);
  for (const l of cc) near(l, 1.397, 0.01);
  near(Math.max(...cc) - Math.min(...cc), 0, 1e-9, 'equal C-C');
  expectLengths('benzene', 'C', 'H', 1.087, 6);
  expectAngles('benzene', 'C', 'C', 'C', 120, 6, 0.01);
  near(planeResidual(m.atoms), 0, 1e-6, 'planar');
  // hydrogens point straight out from the ring center
  for (let i = 0; i < 6; i++) {
    const out = vec(centroid(m.atoms), P(m, i));
    const h = vec(P(m, i), P(m, 6 + i));
    near(unitDot(out, h), 1, 1e-9, 'C-H radial');
  }
});

test('geometry: styrene is a benzene ring plus a vinyl tail, all in one plane', () => {
  const m = mol('styrene');
  assert.equal(m.quality, 'approximate');
  assert.equal(m.atoms.filter((a) => a.el === 'C').length, 8);
  assert.equal(m.atoms.filter((a) => a.el === 'H').length, 8);
  const ringBonds = m.bonds.filter((b) => b.a < 6 && b.b < 6);
  assert.equal(ringBonds.length, 6);
  for (const b of ringBonds) near(dist(P(m, b.a), P(m, b.b)), 1.397, 0.01, 'ring C-C');
  near(planeResidual(m.atoms), 0, 1e-6, 'planar');
  // ring angles are 120
  for (let i = 0; i < 6; i++) near(angleDeg(P(m, (i + 5) % 6), P(m, i), P(m, (i + 1) % 6)), 120, 0.01);
});

test('geometry: key bonds and angles are the values the structure was built from', () => {
  for (const m of Object.values(MOLECULES)) {
    for (const kb of m.keyBonds) {
      near(dist(P(m, kb.a), P(m, kb.b)), kb.length, 0.005, `${m.id} ${kb.label}`);
    }
    for (const ka of m.keyAngles) {
      near(angleDeg(P(m, ka.a), P(m, ka.b), P(m, ka.c)), ka.angle, 0.1, `${m.id} ${ka.label}`);
    }
  }
});

test('geometry: contract reference values, measured from the built coordinates', () => {
  // [id, key bond label, expected length]
  const bondChecks = [
    ['n2', 'N≡N', 1.098], ['o2', 'O=O', 1.208], ['co2', 'C=O', 1.160], ['water', 'O–H', 0.957],
    ['methane', 'C–H', 1.087], ['propane', 'C–C', 1.526], ['formaldehyde', 'C=O', 1.208],
    ['formaldehyde', 'C–H', 1.116], ['ammonia', 'N–H', 1.012], ['co', 'C≡O', 1.128], ['ozone', 'O–O', 1.272],
    ['r32', 'C–F', 1.357], ['r32', 'C–H', 1.093], ['ethylene', 'C=C', 1.339], ['ethylene', 'C–H', 1.087],
    ['vinyl_chloride', 'C–Cl', 1.73], ['benzene', 'C–C', 1.397], ['benzene', 'C–H', 1.087],
  ];
  for (const [id, label, len] of bondChecks) {
    const kb = mol(id).keyBonds.find((k) => k.label === label);
    assert.ok(kb, `${id} has key bond ${label}`);
    near(dist(P(mol(id), kb.a), P(mol(id), kb.b)), len, 0.01, `${id} ${label}`);
  }
  const angleChecks = [
    ['water', 'H–O–H', 104.5], ['co2', 'O=C=O', 180], ['methane', 'H–C–H', 109.47], ['propane', 'C–C–C', 112.4],
    ['formaldehyde', 'H–C–H', 116.5], ['ammonia', 'H–N–H', 106.7], ['ozone', 'O–O–O', 116.8],
    ['r32', 'F–C–F', 108.3], ['ethylene', 'H–C–H', 117.4],
  ];
  for (const [id, label, ang] of angleChecks) {
    const ka = mol(id).keyAngles.find((k) => k.label === label);
    assert.ok(ka, `${id} has key angle ${label}`);
    near(angleDeg(P(mol(id), ka.a), P(mol(id), ka.b), P(mol(id), ka.c)), ang, 0.5, `${id} ${label}`);
  }
});

// ---------------------------------------------------------------- polarity and dipoles
test('dipoles: non-polar molecules have dipoleDir null, polar ones a unit vector', () => {
  const nonPolar = new Set(['n2', 'o2', 'co2', 'methane', 'ethylene', 'benzene', 'propane']);
  // styrene (0.13 D) is also treated as non-polar, like propane: the dipole is too small to give a direction
  nonPolar.add('styrene');
  for (const m of Object.values(MOLECULES)) {
    if (nonPolar.has(m.id)) {
      assert.equal(m.polar, false, `${m.id} should be non-polar`);
      assert.equal(m.dipoleDir, null, `${m.id} dipoleDir`);
    } else {
      assert.equal(m.polar, true, `${m.id} should be polar`);
      assert.ok(Array.isArray(m.dipoleDir) && m.dipoleDir.length === 3, `${m.id} dipoleDir`);
      near(Math.hypot(...m.dipoleDir), 1, 1e-9, `${m.id} dipoleDir length`);
      assert.ok(m.dipole > 0, `${m.id} dipole`);
    }
  }
  for (const id of ['n2', 'o2', 'co2', 'methane', 'ethylene', 'benzene']) assert.equal(mol(id).dipole, 0, id);
  assert.equal(mol('propane').dipole, 0.08);
});

test('dipoles: magnitudes match the contract', () => {
  const d = { water: 1.85, formaldehyde: 2.33, ammonia: 1.47, co: 0.11, ozone: 0.53, r32: 1.98 };
  for (const [id, v] of Object.entries(d)) assert.equal(mol(id).dipole, v, id);
});

test('dipoles: directions point from the positive end toward the negative end', () => {
  const dir = (id) => mol(id).dipoleDir;
  let m = mol('water'); // toward oxygen
  near(unitDot(dir('water'), vec(midpoint(P(m, 1), P(m, 2)), P(m, 0))), 1, 1e-9, 'water');
  m = mol('formaldehyde'); // toward oxygen
  near(unitDot(dir('formaldehyde'), vec(P(m, 0), P(m, 1))), 1, 1e-9, 'formaldehyde C to O');
  m = mol('ammonia'); // from the hydrogen face toward nitrogen and its lone pair
  near(unitDot(dir('ammonia'), vec(centroid(m.atoms.slice(1)), P(m, 0))), 1, 1e-9, 'ammonia');
  m = mol('co'); // fact: the small dipole of carbon monoxide points toward carbon
  near(unitDot(dir('co'), vec(P(m, 1), P(m, 0))), 1, 1e-9, 'CO toward C');
  m = mol('ozone'); // from the central oxygen toward the outer oxygens
  near(unitDot(dir('ozone'), vec(P(m, 0), midpoint(P(m, 1), P(m, 2)))), 1, 1e-9, 'ozone');
  m = mol('r32'); // toward the fluorine side
  near(unitDot(dir('r32'), vec(midpoint(P(m, 3), P(m, 4)), midpoint(P(m, 1), P(m, 2)))), 1, 1e-9, 'R-32');
  // R-134a and vinyl chloride: bond-polarity estimates, so only the sense (toward the halogens) is checked
  m = mol('r134a');
  const f = centroid(m.atoms.filter((a) => a.el === 'F'));
  assert.ok(unitDot(dir('r134a'), vec(centroid(m.atoms), f)) > 0.5, 'R-134a toward fluorine');
  m = mol('vinyl_chloride');
  assert.ok(unitDot(dir('vinyl_chloride'), vec(centroid(m.atoms), P(m, 2))) > 0.3, 'vinyl chloride toward chlorine');
});

// ---------------------------------------------------------------- text content
test('facts: 2 to 4 short plain sentences, no contractions, ending in a period', () => {
  for (const m of Object.values(MOLECULES)) {
    assert.ok(m.facts.length >= 2 && m.facts.length <= 4, `${m.id} fact count`);
    for (const f of m.facts) {
      assert.ok(f.length >= 15 && f.length <= 200, `${m.id} fact length: ${f}`);
      assert.ok(/[.]$/.test(f), `${m.id} fact should end with a period: ${f}`);
      assert.ok(!/['’]/.test(f), `${m.id} fact has an apostrophe or contraction: ${f}`);
      assert.equal((f.match(/[.!?](\s|$)/g) || []).length, 1, `${m.id} fact should be one sentence: ${f}`);
    }
    assert.ok(!/['’]/.test(m.shapeWhy), `${m.id} shapeWhy`);
  }
});

test('facts: building and indoor-air links are present', () => {
  const text = (id) => mol(id).facts.join(' ').toLowerCase();
  assert.match(text('water'), /condens/);
  assert.match(text('co2'), /ventilation/);
  assert.match(text('co2'), /greenhouse/);
  assert.match(text('formaldehyde'), /pressed-wood|plywood|particleboard/);
  assert.match(text('co'), /combustion|fuel burns|furnace|stove/);
  assert.match(text('ozone'), /air cleaner|ground level|indoors/);
  assert.match(text('methane'), /heating/);
  assert.match(text('propane'), /heating/);
  assert.match(text('r32'), /heat pump/);
  assert.match(text('r134a'), /phased down/);
  assert.match(text('ethylene'), /polyethylene/);
  assert.match(text('ethylene'), /vapor retarder/);
  assert.match(text('vinyl_chloride'), /pvc/);
  assert.match(text('vinyl_chloride'), /pipe/);
  assert.match(text('styrene'), /polystyrene/);
  assert.match(text('styrene'), /insulation/);
  assert.match(text('benzene'), /styrene/);
  assert.ok(mol('co').facts.join(' ').toLowerCase().includes('carbon atom'), 'CO dipole fact noted');
});

test('facts: no unqualified numeric global warming potentials', () => {
  for (const m of Object.values(MOLECULES)) {
    for (const f of m.facts) assert.ok(!/GWP\s*\d|potential of \d/i.test(f), `${m.id}: ${f}`);
  }
});

test('quality and source labels', () => {
  for (const id of ['r134a', 'vinyl_chloride', 'styrene', 'propane']) assert.equal(mol(id).quality, 'approximate', id);
  for (const id of ['water', 'n2', 'o2', 'co2', 'methane', 'formaldehyde', 'ammonia', 'co', 'ozone', 'r32', 'ethylene', 'benzene']) {
    assert.equal(mol(id).quality, 'reference', id);
  }
});
