// Tests for molecules/lattice.js and molecules/crystal-data.js.
// Run: node --test tests/mol-lattice.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cellVectors, cellVolume, fracToCart, buildBlock, neighbors, coordination, neighborShells,
  density, atomsPerCell, packingFraction, planePolygon,
} from '../molecules/lattice.js';
import { CRYSTALS, CRYSTAL_ORDER, CRYSTAL_GROUPS } from '../molecules/crystal-data.js';

// ---------- helpers ----------

const near = (actual, expected, tol, label = '') =>
  assert.ok(Math.abs(actual - expected) <= tol, `${label} expected ${expected} +- ${tol}, got ${actual}`);
const norm = (v) => Math.hypot(v[0], v[1], v[2]);
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
const angle = (u, v) => (Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (norm(u) * norm(v))))) * 180) / Math.PI;
const indexOfEl = (crystal, el) => crystal.basis.map((b, i) => (b.el === el ? i : -1)).filter((i) => i >= 0);
const within = (list, lo, hi, el) => list.filter((n) => n.d >= lo && n.d <= hi && (!el || n.el === el));
const pairAngles = (vecs) => {
  const out = [];
  for (let i = 0; i < vecs.length; i++) for (let j = i + 1; j < vecs.length; j++) out.push(angle(vecs[i], vecs[j]));
  return out;
};
const cubic = (a) => ({ a, b: a, c: a, alpha: 90, beta: 90, gamma: 90 });

/** Independent copy of the contract table (section 4.2): the data file may not drift from it. */
const TABLE = {
  fe_bcc: { density: 7.874, atoms: 2, coord: 8, nearest: 2.4825, packing: 0.680 },
  fe_fcc: { density: 7.647, atoms: 4, coord: 12, nearest: 2.5788, packing: 0.740 },
  al_fcc: { density: 2.699, atoms: 4, coord: 12, nearest: 2.8634, packing: 0.740 },
  cu_fcc: { density: 8.935, atoms: 4, coord: 12, nearest: 2.5561, packing: 0.740 },
  zn_hcp: { density: 7.137, atoms: 2, coord: 6, nearest: 2.6649, packing: null },
  ti_hcp: { density: 4.499, atoms: 2, coord: 6, nearest: 2.8967, packing: null },
  mg_hcp: { density: 1.737, atoms: 2, coord: 6, nearest: 3.1971, packing: null },
  nacl: { density: 2.164, atoms: 8, coord: 6, nearest: 2.8201, packing: null },
  cscl: { density: 3.989, atoms: 2, coord: 8, nearest: 3.5706, packing: null },
  diamond: { density: 3.516, atoms: 8, coord: 4, nearest: 1.5445, packing: 0.340 },
  silicon: { density: 2.329, atoms: 8, coord: 4, nearest: 2.3517, packing: 0.340 },
  graphite: { density: 2.267, atoms: 4, coord: 3, nearest: 1.4209, packing: null },
  ice_ih: { density: 0.920, atoms: 12, coord: 4, nearest: 2.76, packing: null, nearestTol: 0.02 },
  quartz: { density: 2.649, atoms: 9, coord: 4, nearest: 1.61, packing: null, nearestTol: 0.02 },
  calcite: { density: 2.711, atoms: 30, coord: 6, nearest: 2.36, packing: null, nearestTol: 0.03 },
};

/** Nearest-shell neighbors of one basis atom, optionally restricted to one element. */
function nearestShell(crystal, index, tol = 0.08, el = null) {
  const list = neighbors(crystal, index, 6).filter((n) => !el || n.el === el);
  const d0 = list[0].d;
  return { d0, shell: list.filter((n) => n.d <= d0 * (1 + tol)) };
}

// ---------- cell geometry ----------

test('cellVectors: cubic, hexagonal and triclinic cells', () => {
  const c = cellVectors(cubic(4));
  assert.deepEqual(c.a, [4, 0, 0]);
  assert.deepEqual(c.b, [0, 4, 0]);
  assert.deepEqual(c.c, [0, 0, 4]);
  assert.equal(cellVolume(c), 64);

  const h = cellVectors({ a: 2.461, b: 2.461, c: 6.708, alpha: 90, beta: 90, gamma: 120 });
  near(h.b[0], -2.461 / 2, 1e-9);
  near(h.b[1], (2.461 * Math.sqrt(3)) / 2, 1e-9);
  near(cellVolume(h), 2.461 * 2.461 * (Math.sqrt(3) / 2) * 6.708, 1e-9);
  near(angle(h.a, h.b), 120, 1e-9);

  const t = cellVectors({ a: 3, b: 4, c: 5, alpha: 80, beta: 95, gamma: 105 });
  near(norm(t.a), 3, 1e-9); near(norm(t.b), 4, 1e-9); near(norm(t.c), 5, 1e-9);
  near(angle(t.b, t.c), 80, 1e-9); near(angle(t.a, t.c), 95, 1e-9); near(angle(t.a, t.b), 105, 1e-9);
  assert.equal(t.b[2], 0);
});

test('fracToCart maps the cell corners and the center', () => {
  const v = cellVectors({ a: 2, b: 3, c: 4, alpha: 90, beta: 90, gamma: 120 });
  assert.deepEqual(fracToCart([0, 0, 0], v), [0, 0, 0]);
  const p = fracToCart([1, 1, 1], v);
  near(p[0], v.a[0] + v.b[0], 1e-12); near(p[1], v.b[1], 1e-12); near(p[2], 4, 1e-12);
});

// ---------- library-wide checks against the contract table ----------

test('library lists every contract crystal, and the order covers all of them', () => {
  assert.deepEqual([...CRYSTAL_ORDER].sort(), Object.keys(TABLE).sort());
  assert.deepEqual(Object.keys(CRYSTALS).sort(), Object.keys(TABLE).sort());
  for (const id of CRYSTAL_ORDER) assert.equal(CRYSTALS[id].id, id);
});

for (const id of Object.keys(TABLE)) {
  test(`${id}: density, atoms per cell, nearest distance, coordination, packing`, () => {
    const c = CRYSTALS[id];
    const t = TABLE[id];
    // density within 1 percent of the contract table AND of the stored expectation
    near(density(c) / t.density, 1, 0.01, 'density vs contract table');
    near(density(c) / c.expect.density, 1, 0.01, 'density vs expect');
    near(c.expect.density, t.density, 1e-9, 'expect.density matches table');
    // atoms per cell
    assert.equal(atomsPerCell(c), t.atoms);
    assert.equal(c.expect.atomsPerCell, t.atoms);
    // nearest distance and coordination, from the periodic neighbor search
    const tol = c.expect.coordinationTol ?? 0.08;
    const { d0, shell } = nearestShell(c, 0, tol, c.expect.neighborEl ?? null);
    near(d0, t.nearest, t.nearestTol ?? 0.005, 'nearest distance');
    near(d0, c.expect.nearest, t.nearestTol ?? 0.005, 'expect.nearest');
    assert.equal(shell.length, t.coord, 'coordination number');
    assert.equal(c.expect.coordination, t.coord);
    // coordination() agrees with the direct count when no element filter is needed
    if (!c.expect.neighborEl) {
      const co = coordination(c, 0, tol);
      assert.equal(co.number, t.coord);
      near(co.distance, d0, 1e-9);
    }
    // packing fraction
    const pf = packingFraction(c);
    if (t.packing !== null) near(pf, t.packing, 0.002, 'packing fraction');
    if (new Set(c.basis.map((b) => b.el)).size > 1) assert.equal(pf, null);
  });

  test(`${id}: every site matches its stated coordination`, () => {
    const c = CRYSTALS[id];
    for (const site of c.expect.sites ?? []) {
      for (const idx of indexOfEl(c, site.el)) {
        const co = coordination(c, idx);
        assert.equal(co.number, site.coordination, `${site.el} #${idx} coordination`);
        near(co.distance, site.nearest, 0.005, `${site.el} #${idx} nearest`);
      }
    }
  });

  test(`${id}: metadata, facts, planes and bond rules are well formed`, () => {
    const c = CRYSTALS[id];
    assert.ok(c.name && c.short && c.lattice && c.system);
    assert.ok(CRYSTAL_GROUPS[c.group], 'group is known');
    assert.ok(c.facts.length >= 2 && c.facts.length <= 4, 'two to four facts');
    for (const f of c.facts) {
      assert.ok(f.length > 20 && /[.]$/.test(f), `fact is a sentence: ${f}`);
      assert.ok(!/n't|'s\b|'re\b|'ll\b|'ve\b|'d\b|'m\b/.test(f), `no contractions: ${f}`);
    }
    assert.ok(c.source && ['reference', 'approximate', 'schematic'].includes(c.quality));
    assert.ok(Array.isArray(c.planes));
    for (const p of c.planes) {
      assert.equal(p.hkl.length, 3);
      assert.ok(p.label && p.note);
      const poly = planePolygon(cellVectors(c.params), p.hkl, p.d ?? 1);
      assert.ok(poly.length >= 3, `plane ${p.hkl} cuts the cell`);
    }
    assert.ok(c.bondRule && c.bondRule.pairs.length && c.bondRule.max > 0);
    // basis elements are known to the mass table (density() would throw otherwise)
    assert.ok(Number.isFinite(density(c)));
  });

  test(`${id}: buildBlock gives complete, duplicate-free, correctly bonded blocks`, () => {
    const c = CRYSTALS[id];
    for (const opts of [{ nx: 1, ny: 1, nz: 1 }, { nx: 2, ny: 2, nz: 2 }, { nx: 2, ny: 1, nz: 3, includeBoundary: false }]) {
      const s = buildBlock(c, opts);
      const n = (opts.nx ?? 1) * (opts.ny ?? 1) * (opts.nz ?? 1);
      if (opts.includeBoundary === false) {
        assert.equal(s.atoms.length, n * c.basis.length);
        assert.ok(s.atoms.every((a) => a.tag !== 'boundary'));
      } else {
        assert.ok(s.atoms.length >= n * c.basis.length);
        assert.equal(s.atoms.filter((a) => a.tag !== 'boundary').length, n * c.basis.length);
      }
      // no duplicate positions
      let minSep = Infinity;
      for (let i = 0; i < s.atoms.length; i++) {
        for (let j = i + 1; j < s.atoms.length; j++) minSep = Math.min(minSep, norm(sub(s.atoms[i].pos, s.atoms[j].pos)));
      }
      assert.ok(minSep > 0.5, `minimum separation ${minSep}`);
      // bonds: valid indices, obey the rule, join only atoms of the block
      for (const b of s.bonds) {
        assert.ok(b.a >= 0 && b.b >= 0 && b.a < s.atoms.length && b.b < s.atoms.length && b.a !== b.b);
        const A = s.atoms[b.a]; const B = s.atoms[b.b];
        assert.ok(c.bondRule.pairs.some(([p, q]) => (p === A.el && q === B.el) || (p === B.el && q === A.el)));
        assert.ok(norm(sub(A.pos, B.pos)) <= c.bondRule.max + 1e-9);
        assert.equal(b.order, 1);
      }
      // cells
      const u = cellVectors(c.params);
      assert.deepEqual(s.unitCell.a, u.a);
      near(norm(s.cell.a), (opts.nx ?? 1) * norm(u.a), 1e-9);
      near(norm(s.cell.b), (opts.ny ?? 1) * norm(u.b), 1e-9);
      near(norm(s.cell.c), (opts.nz ?? 1) * norm(u.c), 1e-9);
      near(cellVolume(s.cell), n * cellVolume(u), 1e-6);
    }
  });
}

// ---------- neighbor search ----------

test('neighbors: image range is large enough for skewed cells (against a brute-force count)', () => {
  const skew = {
    params: { a: 3, b: 4, c: 5, alpha: 70, beta: 100, gamma: 65 },
    basis: [{ el: 'X', frac: [0.1, 0.2, 0.3] }, { el: 'Y', frac: [0.6, 0.7, 0.8] }],
  };
  const v = cellVectors(skew.params);
  for (const cutoff of [4, 7, 11]) {
    for (const idx of [0, 1]) {
      let expected = 0;
      const o = fracToCart(skew.basis[idx].frac, v);
      for (let i = -12; i <= 12; i++) for (let j = -12; j <= 12; j++) for (let k = -12; k <= 12; k++) {
        for (const at of skew.basis) {
          const p = fracToCart([at.frac[0] + i, at.frac[1] + j, at.frac[2] + k], v);
          const d = norm(sub(p, o));
          if (d > 1e-9 && d <= cutoff) expected++;
        }
      }
      assert.equal(neighbors(skew, idx, cutoff).length, expected, `cutoff ${cutoff} atom ${idx}`);
    }
  }
});

test('neighbors: hexagonal and trigonal library cells match brute force at a long cutoff', () => {
  for (const id of ['ice_ih', 'quartz', 'calcite', 'graphite']) {
    const c = CRYSTALS[id];
    const v = cellVectors(c.params);
    const cutoff = 7;
    const o = fracToCart(c.basis[0].frac, v);
    let expected = 0;
    for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) for (let k = -8; k <= 8; k++) {
      for (const at of c.basis) {
        const d = norm(sub(fracToCart([at.frac[0] + i, at.frac[1] + j, at.frac[2] + k], v), o));
        if (d > 1e-9 && d <= cutoff) expected++;
      }
    }
    assert.equal(neighbors(c, 0, cutoff).length, expected, id);
  }
});

test('neighbors: sorted by distance and carry vec lengths equal to d', () => {
  const list = neighbors(CRYSTALS.fe_bcc, 0, 5);
  for (let i = 1; i < list.length; i++) assert.ok(list[i].d >= list[i - 1].d);
  for (const n of list) near(norm(n.vec), n.d, 1e-9);
  assert.equal(list[0].el, 'Fe');
});

// ---------- structure-specific checks ----------

test('HCP metals: two shells of 6, the shorter one is the nearest shell', () => {
  for (const id of ['zn_hcp', 'ti_hcp', 'mg_hcp']) {
    const c = CRYSTALS[id];
    const { a, c: cc } = c.params;
    const basal = a;
    const oblique = Math.sqrt((a * a) / 3 + (cc * cc) / 4);
    const shells = neighborShells(c, 0, Math.max(basal, oblique) + 0.05);
    assert.equal(shells.length, 2, `${id} has two shells within the cutoff`);
    assert.deepEqual(shells.map((s) => s.n), [6, 6]);
    near(shells[0].d, Math.min(basal, oblique), 1e-6, `${id} shorter shell`);
    near(shells[1].d, Math.max(basal, oblique), 1e-6, `${id} longer shell`);
    for (let i = 0; i < 2; i++) {
      near(shells[i].d, c.expect.shells[i].d, 0.005, `${id} expect.shells[${i}]`);
      assert.equal(shells[i].n, c.expect.shells[i].n);
    }
    // both basis atoms are equivalent
    const other = neighborShells(c, 1, Math.max(basal, oblique) + 0.05);
    assert.deepEqual(other.map((s) => s.n), [6, 6]);
  }
  // zinc: basal is the nearest shell (stretched), titanium and magnesium: oblique is nearest
  assert.ok(neighborShells(CRYSTALS.zn_hcp, 0, 3.1)[0].d < 2.7);
  assert.ok(neighborShells(CRYSTALS.ti_hcp, 0, 3.1)[0].d < CRYSTALS.ti_hcp.params.a);
  assert.ok(neighborShells(CRYSTALS.mg_hcp, 0, 3.4)[0].d < CRYSTALS.mg_hcp.params.a);
  // the nearest shell of the in-plane (basal) neighbors lies in a layer, vec z = 0
  const zn = neighbors(CRYSTALS.zn_hcp, 0, 2.7);
  assert.equal(zn.length, 6);
  for (const n of zn) near(n.vec[2], 0, 1e-9);
});

test('closest-packed metals: the touching-sphere packing is the textbook value', () => {
  near(packingFraction(CRYSTALS.fe_bcc), (Math.PI * Math.sqrt(3)) / 8, 1e-6);
  for (const id of ['fe_fcc', 'al_fcc', 'cu_fcc']) near(packingFraction(CRYSTALS[id]), Math.PI / Math.sqrt(18), 1e-6);
  near(packingFraction(CRYSTALS.diamond), (Math.PI * Math.sqrt(3)) / 16, 1e-6);
});

test('nacl: each Na has 6 Cl at 2.8201 and 12 Na at 3.988; each Cl mirrors this', () => {
  const c = CRYSTALS.nacl;
  for (const idx of indexOfEl(c, 'Na')) {
    const list = neighbors(c, idx, 4.2);
    const cl = within(list, 2.80, 2.84, 'Cl');
    assert.equal(cl.length, 6);
    for (const n of cl) near(n.d, 2.8201, 0.005);
    const na = within(list, 3.95, 4.03, 'Na');
    assert.equal(na.length, 12);
    for (const n of na) near(n.d, 3.988, 0.005);
    // the six Cl lie along the three axes, +- (octahedron)
    const angles = pairAngles(cl.map((n) => n.vec));
    assert.equal(angles.filter((x) => Math.abs(x - 90) < 1e-6).length, 12);
    assert.equal(angles.filter((x) => Math.abs(x - 180) < 1e-6).length, 3);
  }
  for (const idx of indexOfEl(c, 'Cl')) {
    const list = neighbors(c, idx, 4.2);
    assert.equal(within(list, 2.80, 2.84, 'Na').length, 6);
    assert.equal(within(list, 3.95, 4.03, 'Cl').length, 12);
  }
});

test('cscl: each ion has 8 unlike neighbors at 3.5706 and 6 like neighbors at a', () => {
  const c = CRYSTALS.cscl;
  for (let idx = 0; idx < 2; idx++) {
    const list = neighbors(c, idx, 4.3);
    const unlike = list.filter((n) => n.el !== c.basis[idx].el);
    assert.equal(unlike.length, 8);
    for (const n of unlike) near(n.d, 3.5706, 0.005);
    const like = list.filter((n) => n.el === c.basis[idx].el);
    assert.equal(like.length, 6);
    for (const n of like) near(n.d, 4.123, 1e-9);
  }
});

test('diamond and silicon: 4 neighbors with tetrahedral angles of 109.47 degrees', () => {
  for (const id of ['diamond', 'silicon']) {
    const c = CRYSTALS[id];
    c.basis.forEach((_, idx) => {
      const { shell } = nearestShell(c, idx);
      assert.equal(shell.length, 4, `${id} atom ${idx}`);
      const angles = pairAngles(shell.map((n) => n.vec));
      assert.equal(angles.length, 6);
      for (const a of angles) near(a, 109.4712, 0.01, `${id} angle`);
    });
    // bond length is a * sqrt(3) / 4
    near(nearestShell(c, 0).d0, (c.params.a * Math.sqrt(3)) / 4, 1e-9);
  }
});

test('graphite: 3 in-plane neighbors at 1.4209 with 120 degree angles, layers c/2 apart, AB stacking', () => {
  const c = CRYSTALS.graphite;
  const { a, c: cc } = c.params;
  c.basis.forEach((_, idx) => {
    const list = neighbors(c, idx, 4.0);
    const bonded = within(list, 1.40, 1.44);
    assert.equal(bonded.length, 3);
    for (const n of bonded) { near(n.d, 1.4209, 0.005); near(n.vec[2], 0, 1e-9); }
    for (const x of pairAngles(bonded.map((n) => n.vec))) near(x, 120, 0.01);
    // nearest atoms in the next layer: straight above/below at c/2 = 3.354
    const above = list.filter((n) => Math.abs(n.vec[2] - cc / 2) < 1e-9);
    const below = list.filter((n) => Math.abs(n.vec[2] + cc / 2) < 1e-9);
    assert.ok(above.length > 0 && below.length > 0);
    near(cc / 2, 3.354, 1e-9);
  });
  // AB stacking: exactly half the atoms have an atom directly above (and below);
  // the other half sit over the center of a ring of the next layer (6 atoms at 1.4209 in plane).
  let directly = 0;
  let overRing = 0;
  c.basis.forEach((_, idx) => {
    const list = neighbors(c, idx, 4.0);
    const next = list.filter((n) => Math.abs(n.vec[2] - cc / 2) < 1e-9);
    const xy = (n) => Math.hypot(n.vec[0], n.vec[1]);
    if (next.some((n) => xy(n) < 1e-6)) {
      directly++;
    } else {
      const ring = next.filter((n) => Math.abs(xy(n) - a / Math.sqrt(3)) < 1e-6);
      assert.equal(ring.length, 6, 'ring vertices of the next layer');
      assert.equal(next.filter((n) => xy(n) < a / Math.sqrt(3) - 1e-6).length, 0, 'nothing closer than the ring');
      overRing++;
    }
  });
  assert.equal(directly, 2);
  assert.equal(overRing, 2);
});

test('ice Ih: 4 O neighbors at 2.76, tetrahedral angles, ice rules for the hydrogen atoms', () => {
  const c = CRYSTALS.ice_ih;
  const oxy = indexOfEl(c, 'O');
  assert.equal(oxy.length, 4);
  assert.equal(indexOfEl(c, 'H').length, 8);
  // O positions are those of the contract
  assert.deepEqual(oxy.map((i) => c.basis[i].frac.map((x) => +x.toFixed(4))),
    [[0.3333, 0.6667, 0.0625], [0.6667, 0.3333, 0.5625], [0.3333, 0.6667, 0.4375], [0.6667, 0.3333, 0.9375]]);
  // the two kinds of O...O link named in the contract
  const { a, c: cc } = c.params;
  near(0.375 * cc, 2.7585, 1e-3);
  near(Math.sqrt((a * a) / 3 + (cc / 8) ** 2), 2.765, 1e-3);

  for (const idx of oxy) {
    const list = neighbors(c, idx, 3.2);
    const oo = list.filter((n) => n.el === 'O');
    assert.equal(oo.length, 4, `O ${idx} has 4 O neighbors`);
    for (const n of oo) near(n.d, 2.76, 0.02, 'O...O');
    for (const x of pairAngles(oo.map((n) => n.vec))) near(x, 109.5, 2, 'O-O-O angle');

    const covalent = list.filter((n) => n.el === 'H' && n.d < 1.2);
    const hbond = list.filter((n) => n.el === 'H' && n.d > 1.5 && n.d < 2.1);
    assert.equal(covalent.length, 2, 'two covalent H');
    assert.equal(hbond.length, 2, 'two hydrogen-bond H');
    for (const n of covalent) near(n.d, 0.985, 0.01, 'O-H');
    for (const n of hbond) near(n.d, 1.77, 0.05, 'H...O');
    near(angle(covalent[0].vec, covalent[1].vec), 109.5, 3, 'H-O-H');

    // every O...O link carries exactly one H (either close to this O or close to the neighbor)
    for (const link of oo) {
      const onLink = [...covalent, ...hbond].filter((h) => dot(h.vec, link.vec) / (norm(h.vec) * norm(link.vec)) > 0.999);
      assert.equal(onLink.length, 1, 'exactly one H on the link');
    }
  }
  // the whole cell is 4 water molecules
  assert.equal(c.basis.filter((b) => b.el === 'H').length, 2 * oxy.length);
  assert.ok(c.hbondRule && c.hbondRule.pairs[0].join('') === 'OH');
  assert.ok(c.cellNote.includes('4 water molecules'));
});

test('ice Ih: block carries covalent bonds and dashed hydrogen bonds', () => {
  const c = CRYSTALS.ice_ih;
  const s = buildBlock(c, { nx: 2, ny: 2, nz: 2 });
  assert.equal(s.atoms.length, 8 * 12);
  assert.equal(s.bonds.length, 8 * 8, 'two O-H bonds per molecule');
  for (const b of s.bonds) {
    near(norm(sub(s.atoms[b.a].pos, s.atoms[b.b].pos)), 0.985, 0.01);
  }
  assert.ok(Array.isArray(s.hbonds) && s.hbonds.length > 0);
  for (const h of s.hbonds) {
    const A = s.atoms[h.a]; const B = s.atoms[h.b];
    assert.deepEqual([A.el, B.el].sort(), ['H', 'O']);
    near(norm(sub(A.pos, B.pos)), 1.77, 0.05);
  }
  // no hydrogen bond duplicates a covalent bond
  const covalent = new Set(s.bonds.map((b) => `${Math.min(b.a, b.b)}-${Math.max(b.a, b.b)}`));
  for (const h of s.hbonds) assert.ok(!covalent.has(`${Math.min(h.a, h.b)}-${Math.max(h.a, h.b)}`));
  // crystals without an hbondRule have no hbonds field
  assert.equal(buildBlock(CRYSTALS.nacl, {}).hbonds, undefined);
});

test('quartz: 3 Si + 6 O from P3(2)21, SiO4 tetrahedra, Si-O-Si near 144 degrees', () => {
  const c = CRYSTALS.quartz;
  assert.ok(/P3\(2\)21/.test(c.lattice), 'the space-group hand is named');
  const si = indexOfEl(c, 'Si');
  const ox = indexOfEl(c, 'O');
  assert.equal(si.length, 3);
  assert.equal(ox.length, 6);
  near(density(c) / 2.649, 1, 0.01);
  for (const idx of si) {
    const list = neighbors(c, idx, 2.0);
    assert.equal(list.length, 4, 'Si has 4 neighbors within 2 A');
    for (const n of list) { assert.equal(n.el, 'O'); near(n.d, 1.61, 0.02, 'Si-O'); }
    const angles = pairAngles(list.map((n) => n.vec));
    assert.equal(angles.length, 6);
    for (const x of angles) near(x, 109.5, 3, 'O-Si-O');
  }
  for (const idx of ox) {
    const list = neighbors(c, idx, 2.0);
    assert.equal(list.length, 2, 'O has 2 Si neighbors within 2 A');
    for (const n of list) { assert.equal(n.el, 'Si'); near(n.d, 1.61, 0.02, 'O-Si'); }
    near(angle(list[0].vec, list[1].vec), 143.6, 3, 'Si-O-Si');
  }
  // the three Si atoms are 3a sites (u,0,2/3), (0,u,1/3), (-u,-u,0): the 3(2) screw axis
  const zs = si.map((i) => c.basis[i].frac[2]).sort((p, q) => p - q);
  near(zs[0], 0, 1e-9); near(zs[1], 1 / 3, 1e-9); near(zs[2], 2 / 3, 1e-9);
  // all atoms are distinct points
  const keys = new Set(c.basis.map((b) => b.frac.map((x) => x.toFixed(5)).join(',')));
  assert.equal(keys.size, 9);
});

test('calcite: 6 Ca, 6 C, 18 O in R-3c; flat CO3 triangles; Ca in octahedra of O', () => {
  const c = CRYSTALS.calcite;
  assert.equal(indexOfEl(c, 'Ca').length, 6);
  assert.equal(indexOfEl(c, 'C').length, 6);
  assert.equal(indexOfEl(c, 'O').length, 18);
  near(density(c) / 2.711, 1, 0.01);
  for (const idx of indexOfEl(c, 'C')) {
    const o = neighbors(c, idx, 1.6);
    assert.equal(o.length, 3, 'C has 3 O');
    for (const n of o) { assert.equal(n.el, 'O'); near(n.d, 1.28, 0.02, 'C-O'); near(n.vec[2], 0, 1e-9); }
    for (const x of pairAngles(o.map((n) => n.vec))) near(x, 120, 0.5, 'O-C-O');
  }
  for (const idx of indexOfEl(c, 'Ca')) {
    const o = neighbors(c, idx, 2.9).filter((n) => n.el === 'O');
    assert.equal(o.length, 6, 'Ca has 6 O');
    for (const n of o) near(n.d, 2.36, 0.03, 'Ca-O');
    // octahedron: three pairs of opposite neighbors
    const angles = pairAngles(o.map((n) => n.vec));
    assert.equal(angles.filter((x) => Math.abs(x - 180) < 0.5).length, 3, 'opposite pairs');
  }
  for (const idx of indexOfEl(c, 'O')) {
    const list = neighbors(c, idx, 1.6);
    assert.equal(list.length, 1, 'each O is bonded to one C');
    assert.equal(list[0].el, 'C');
  }
  // rhombohedral centering: shifting every atom by (2/3,1/3,1/3) gives the same set of points
  const key = (f) => f.map((x) => ((x % 1) + 1) % 1).map((x) => Math.round(x * 1e4) % 1e4).join(',');
  const have = new Set(c.basis.map((b) => `${b.el}:${key(b.frac)}`));
  for (const b of c.basis) {
    const moved = b.frac.map((x, i) => x + [2 / 3, 1 / 3, 1 / 3][i]);
    assert.ok(have.has(`${b.el}:${key(moved)}`), 'centering translation maps the structure onto itself');
  }
});

test('fe_fcc states that its lattice constant is the high-temperature value', () => {
  const c = CRYSTALS.fe_fcc;
  assert.ok(/high-temperature/.test(c.paramNote));
  assert.ok(c.facts.some((f) => /high-temperature/.test(f)));
  assert.ok(CRYSTALS.fe_bcc.facts.some((f) => /carbon/.test(f)) && c.facts.some((f) => /carbon/.test(f)));
});

// ---------- blocks ----------

test('buildBlock: counts of boundary-completed cubic blocks', () => {
  const bcc = buildBlock(CRYSTALS.fe_bcc, { nx: 2, ny: 2, nz: 2 });
  assert.equal(bcc.atoms.length, 3 ** 3 + 2 ** 3); // 27 corners + 8 centers = 35
  assert.equal(bcc.atoms.length, 35);
  const fcc = buildBlock(CRYSTALS.al_fcc, { nx: 2, ny: 2, nz: 2 });
  assert.equal(fcc.atoms.length, 27 + 36); // 27 corners + 36 face-center atoms
  assert.equal(fcc.atoms.length, 63);
  // one cell
  assert.equal(buildBlock(CRYSTALS.fe_bcc, {}).atoms.length, 9);
  assert.equal(buildBlock(CRYSTALS.cu_fcc, {}).atoms.length, 14);
  assert.equal(buildBlock(CRYSTALS.diamond, {}).atoms.length, 18);
  assert.equal(buildBlock(CRYSTALS.nacl, {}).atoms.length, 27);
  assert.equal(buildBlock(CRYSTALS.cscl, {}).atoms.length, 8 + 1);
  // without boundary copies: nx*ny*nz*basis
  assert.equal(buildBlock(CRYSTALS.fe_bcc, { nx: 2, ny: 2, nz: 2, includeBoundary: false }).atoms.length, 16);
  assert.equal(buildBlock(CRYSTALS.al_fcc, { nx: 2, ny: 2, nz: 2, includeBoundary: false }).atoms.length, 32);
  assert.equal(buildBlock(CRYSTALS.al_fcc, { nx: 3, ny: 2, nz: 1, includeBoundary: false }).atoms.length, 24);
  // boundary copies are tagged, original atoms are not
  assert.equal(bcc.atoms.filter((a) => a.tag === 'boundary').length, 35 - 16);
  assert.equal(fcc.atoms.filter((a) => a.tag === 'boundary').length, 63 - 32);
});

test('buildBlock: a bcc cell has 8 corner-to-center bonds and nothing else', () => {
  const s = buildBlock(CRYSTALS.fe_bcc, {});
  assert.equal(s.bonds.length, 8);
  for (const b of s.bonds) near(norm(sub(s.atoms[b.a].pos, s.atoms[b.b].pos)), 2.4825, 0.005);
});

test('buildBlock: NaCl cell bonds join only Na and Cl; diamond atoms are tetrahedrally bonded', () => {
  const nacl = buildBlock(CRYSTALS.nacl, {});
  for (const b of nacl.bonds) {
    assert.notEqual(nacl.atoms[b.a].el, nacl.atoms[b.b].el);
    near(norm(sub(nacl.atoms[b.a].pos, nacl.atoms[b.b].pos)), 2.8201, 0.005);
  }
  // 27 ions on a 3x3x3 grid: 3 directions x 9 rows x 2 gaps = 54 nearest-neighbor bonds
  assert.equal(nacl.bonds.length, 54);
  const dia = buildBlock(CRYSTALS.diamond, { nx: 2, ny: 2, nz: 2 });
  const degree = new Array(dia.atoms.length).fill(0);
  for (const b of dia.bonds) { degree[b.a]++; degree[b.b]++; }
  // atoms with all four neighbors inside the block have degree 4; none has more
  assert.ok(Math.max(...degree) === 4);
  assert.ok(degree.filter((d) => d === 4).length > 0);
});

test('buildBlock: cell spans the whole block and unitCell is one cell (hexagonal example)', () => {
  const c = CRYSTALS.zn_hcp;
  const s = buildBlock(c, { nx: 3, ny: 2, nz: 2 });
  const u = cellVectors(c.params);
  assert.deepEqual(s.unitCell, { origin: [0, 0, 0], a: u.a, b: u.b, c: u.c });
  near(s.cell.a[0], 3 * u.a[0], 1e-9);
  near(s.cell.b[1], 2 * u.b[1], 1e-9);
  near(s.cell.c[2], 2 * u.c[2], 1e-9);
  assert.deepEqual(s.cell.origin, [0, 0, 0]);
  assert.equal(s.atoms.length, 3 * 2 * 2 * 2);
  assert.ok(s.atoms.every((a, i) => a.id === i));
});

// ---------- planes ----------

/** Area of an ordered planar polygon. */
function polygonArea(pts) {
  let sum = [0, 0, 0];
  for (let i = 1; i < pts.length - 1; i++) {
    const cr = cross(sub(pts[i], pts[0]), sub(pts[i + 1], pts[0]));
    sum = [sum[0] + cr[0], sum[1] + cr[1], sum[2] + cr[2]];
  }
  return norm(sum) / 2;
}
/** True when the polygon is convex and the points are ordered around it (all turns the same way). */
function isOrderedConvex(pts) {
  const turns = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]; const q = pts[(i + 1) % pts.length]; const r = pts[(i + 2) % pts.length];
    turns.push(cross(sub(q, p), sub(r, q)));
  }
  return turns.every((t) => dot(t, turns[0]) > 1e-9);
}
function isCoplanar(pts) {
  const n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
  return pts.every((p) => Math.abs(dot(sub(p, pts[0]), n)) < 1e-9 * Math.max(1, norm(n)));
}

test('planePolygon: (100) square, (110) rectangle, (111) triangle in a cubic cell', () => {
  const a = 4;
  const v = cellVectors(cubic(a));
  const p100 = planePolygon(v, [1, 0, 0]);
  assert.equal(p100.length, 4);
  near(polygonArea(p100), a * a, 1e-9);
  const p110 = planePolygon(v, [1, 1, 0]);
  assert.equal(p110.length, 4);
  near(polygonArea(p110), a * a * Math.SQRT2, 1e-9);
  const p111 = planePolygon(v, [1, 1, 1]);
  assert.equal(p111.length, 3);
  near(polygonArea(p111), (a * a * Math.sqrt(3)) / 2, 1e-9);
  for (const p of [p100, p110, p111]) {
    assert.ok(isCoplanar(p), 'coplanar');
    assert.ok(isOrderedConvex(p), 'ordered around the polygon');
  }
  // (111) triangle corners are on the three axes
  const sorted = p111.map((p) => p.map((x) => Math.round(x))).sort().map(String);
  assert.deepEqual(sorted, ['0,0,4', '0,4,0', '4,0,0']);
  // rectangle side lengths a and a*sqrt(2)
  const sides = p110.map((p, i) => norm(sub(p, p110[(i + 1) % 4]))).sort((x, y) => x - y);
  near(sides[0], a, 1e-9); near(sides[3], a * Math.SQRT2, 1e-9);
});

test('planePolygon: offsets, hexagonal section and hexagonal cells', () => {
  const v = cellVectors(cubic(2));
  near(polygonArea(planePolygon(v, [1, 1, 1], 0.5)), (4 * Math.sqrt(3)) / 2 / 4, 1e-9);
  const hex = planePolygon(v, [1, 1, 1], 1.5);
  assert.equal(hex.length, 6);
  near(polygonArea(hex), (3 * Math.sqrt(3) / 4) * 4, 1e-9);
  assert.ok(isCoplanar(hex) && isOrderedConvex(hex));
  assert.deepEqual(planePolygon(v, [1, 1, 1], 5), []);
  // basal plane of a hexagonal cell is a rhombus of area a^2 sqrt(3)/2
  const hv = cellVectors(CRYSTALS.zn_hcp.params);
  const basal = planePolygon(hv, [0, 0, 1], 0.25);
  assert.equal(basal.length, 4);
  near(polygonArea(basal), (2.6649 ** 2 * Math.sqrt(3)) / 2, 1e-9);
  for (const p of basal) near(p[2], 0.25 * 4.9468, 1e-9);
  assert.ok(isOrderedConvex(basal));
  // the (110) plane of BCC iron contains the body-center atom, the (111) plane of fcc contains face centers
  const fe = CRYSTALS.fe_bcc;
  const fv = cellVectors(fe.params);
  const poly = planePolygon(fv, [1, 1, 0], 1);
  const center = fracToCart([0.5, 0.5, 0.5], fv);
  const n = cross(sub(poly[1], poly[0]), sub(poly[2], poly[0]));
  near(dot(sub(center, poly[0]), n), 0, 1e-9);
});
