// Tests for molecules/compare-data.js. Run: node --test tests/mol-compare.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PAIRS, PAIR_ORDER, combine, polymerChain, glassFromNetwork } from '../molecules/compare-data.js';
import { generateGlassNetwork } from '../molecules/compare-glass-gen.js';

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const ang = (p, q, r) => {
  const u = p.map((x, i) => x - q[i]); const v = r.map((x, i) => x - q[i]);
  return (Math.acos((u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v))) * 180) / Math.PI;
};
const near = (a, b, t, m = '') => assert.ok(Math.abs(a - b) <= t, `${m} expected ${b} +- ${t}, got ${a}`);
const minDist = (atoms, skip = () => false) => {
  let m = Infinity;
  for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) if (!skip(atoms[i], atoms[j])) m = Math.min(m, dist(atoms[i].pos, atoms[j].pos));
  return m;
};
const sides = (id) => [PAIRS[id].left.build(), PAIRS[id].right.build()];
const volume = (b) => Math.abs(b.a[0] * (b.b[1] * b.c[2] - b.b[2] * b.c[1]) - b.a[1] * (b.b[0] * b.c[2] - b.b[2] * b.c[0]) + b.a[2] * (b.b[0] * b.c[1] - b.b[1] * b.c[0]));

test('six pairs with the required fields', () => {
  assert.deepEqual(PAIR_ORDER, ['iron', 'carbon', 'glass', 'water', 'metals', 'plastic']);
  for (const id of PAIR_ORDER) {
    const p = PAIRS[id];
    for (const k of ['name', 'question', 'lesson', 'buildingLink', 'summary']) assert.ok(typeof p[k] === 'string' && p[k].length > 5, `${id} ${k}`);
    assert.ok(p.points.length >= 1 && p.points.length <= 3);
    assert.equal(p.steps.length, 3);
    for (const side of [p.left, p.right]) {
      assert.ok(side.title && side.tag && typeof side.build === 'function');
      assert.ok(['reference', 'approximate', 'schematic'].includes(side.quality));
    }
    assert.ok(p.look && p.look.style);
  }
});

test('no contractions in any text', () => {
  const texts = [];
  for (const id of PAIR_ORDER) {
    const p = PAIRS[id];
    texts.push(p.name, p.question, p.summary, p.lesson, p.buildingLink, ...p.points);
    for (const s of [p.left, p.right, ...(p.right.variants || [])]) texts.push(s.title, s.tag, s.short || '', s.source || '');
    p.steps.forEach((s) => texts.push(s.label, s.hint));
    p.helpers.forEach((h) => texts.push(h.label));
    p.rows.forEach((r) => texts.push(r.label, r.hint || ''));
  }
  for (const t of texts) assert.ok(!/['’]/.test(t), `apostrophe in: ${t}`);
});

test('every pair builds both sides deterministically with finite positions and no overlaps', () => {
  for (const id of PAIR_ORDER) {
    const a = sides(id); const b = sides(id);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), `${id} deterministic`);
    for (const s of a) {
      assert.ok(s.atoms.length > 0 && s.atoms.length <= 700);
      s.atoms.forEach((at) => at.pos.forEach((x) => assert.ok(Number.isFinite(x))));
      s.bonds.forEach((bd) => { assert.ok(bd.a < s.atoms.length && bd.b < s.atoms.length); });
      assert.ok(minDist(s.atoms) >= 0.6, `${id} min distance ${minDist(s.atoms)}`);
    }
    const c = combine([{ key: 'left', side: a[0] }, { key: 'right', side: a[1] }]);
    assert.ok(c.atoms.length <= 1500);
    assert.ok(c.atoms.every((x) => x.tag.startsWith('left') || x.tag.startsWith('right')));
    assert.ok(c.sides.left.bounds.max[0] < c.sides.right.bounds.min[0], `${id} sides do not overlap in x`);
  }
});

test('iron: one carbon atom in the largest gap of each lattice', () => {
  const [bcc, fcc] = sides('iron');
  for (const [s, gap, half] of [[bcc, 0.192, 1.4333], [fcc, 0.534, 1.8235]]) {
    const c = s.atoms.filter((a) => a.tag === 'interstitial');
    assert.equal(c.length, 1); assert.equal(c[0].el, 'C');
    const d = Math.min(...s.atoms.filter((a) => a.el === 'Fe').map((a) => dist(a.pos, c[0].pos)));
    near(d, half, 0.01, 'carbon to nearest iron');
    near(s.numbers.gap, gap, 0.005, 'gap radius');
  }
  assert.ok(fcc.numbers.gap > 2.5 * bcc.numbers.gap);
});

test('carbon: diamond has 4 neighbors, graphite 3 and separate sheets', () => {
  const [d, g] = sides('carbon');
  near(d.numbers.density, 3.516, 0.04); near(g.numbers.density, 2.267, 0.03);
  assert.equal(d.numbers.neighbors, 4); assert.equal(g.numbers.neighbors, 3);
  const sheets = new Set(g.atoms.map((a) => a.tag));
  assert.equal(sheets.size, 3);
  const ys = [...sheets].map((t) => g.atoms.filter((a) => a.tag === t).map((a) => a.pos[1]));
  ys.forEach((l) => assert.ok(Math.max(...l) - Math.min(...l) < 0.01, 'sheets are flat and level'));
});

test('glass: every interior silicon has 4 oxygen, no order, unlike quartz', () => {
  const [q, g] = sides('glass');
  const near4 = (s) => {
    const si = s.atoms.map((a, i) => (a.el === 'Si' ? i : -1)).filter((i) => i >= 0);
    const xs = s.atoms.map((a) => a.pos); const lo = [0, 1, 2].map((k) => Math.min(...xs.map((p) => p[k]))); const hi = [0, 1, 2].map((k) => Math.max(...xs.map((p) => p[k])));
    const inner = si.filter((i) => s.atoms[i].pos.every((x, k) => x > lo[k] + 1.8 && x < hi[k] - 1.8));
    const ok = inner.filter((i) => s.atoms.filter((a) => a.el === 'O' && dist(a.pos, s.atoms[i].pos) <= 1.9).length === 4);
    return { n: inner.length, ok: ok.length };
  };
  const rg = near4(g); assert.ok(rg.n >= 10 && rg.ok / rg.n >= 0.9, JSON.stringify(rg));
  // quartz block is a cut crystal: Si near a cut face may lose oxygen, but none has more than 4
  const rq = near4(q); assert.ok(rq.n >= 2 && rq.ok / rq.n >= 0.6, JSON.stringify(rq));
  // silicon atoms of glass bridge through oxygen: each oxygen has at most 2 silicon neighbors
  g.atoms.filter((a) => a.el === 'O').forEach((o) => assert.ok(g.atoms.filter((a) => a.el === 'Si' && dist(a.pos, o.pos) <= 1.9).length <= 2));
  // pair distance histogram beyond 5 angstrom: glass is smoother (fewer empty bins) than quartz
  const empty = (s) => {
    const si = s.atoms.filter((a) => a.el === 'Si'); const bins = new Array(24).fill(0);
    for (let i = 0; i < si.length; i++) for (let j = i + 1; j < si.length; j++) { const d = dist(si[i].pos, si[j].pos); if (d >= 5 && d < 11) bins[Math.floor((d - 5) / 0.25)]++; }
    return bins.filter((c) => c === 0).length;
  };
  assert.ok(empty(g) < empty(q), `empty bins glass ${empty(g)} quartz ${empty(q)}`);
  near(g.numbers.density, 2.2, 0.2);
});

test('glass generator is deterministic and keeps 4 neighbors', () => {
  const a = generateGlassNetwork(5, { tries: 6, anneal: 2, nc: 2 }); const b = generateGlassNetwork(5, { tries: 6, anneal: 2, nc: 2 });
  assert.deepEqual(Array.from(a.X), Array.from(b.X));
  assert.ok(a.nbr.every((l) => l.length === 4));
  assert.ok(glassFromNetwork().atoms.length > 100);
});

test('water: same molecule count, densities, geometry', () => {
  const [ice, liq] = sides('water');
  assert.equal(ice.numbers.molecules, liq.numbers.molecules);
  assert.equal(ice.atoms.filter((a) => a.el === 'O').length, liq.atoms.filter((a) => a.el === 'O').length);
  near(liq.numbers.density, 1.0, 0.03); near(ice.numbers.density, 0.92, 0.02);
  const vi = volume(ice.boxes.block[0]); const vl = volume(liq.boxes.block[0]);
  near(vi / vl, 1.087, 0.01, 'ice box is about 9 percent bigger');
  // check the box densities from the atoms themselves
  const dens = (s, v) => (s.atoms.reduce((m, a) => m + { H: 1.008, O: 15.999 }[a.el], 0) / 0.602214076) / v;
  near(dens(liq, vl), 1.0, 0.03); near(dens(ice, vi), 0.92, 0.02);
  for (let m = 0; m < liq.atoms.length / 3; m++) {
    const O = liq.atoms[3 * m]; const H1 = liq.atoms[3 * m + 1]; const H2 = liq.atoms[3 * m + 2];
    assert.equal(O.el, 'O');
    near(dist(O.pos, H1.pos), 0.957, 0.01); near(dist(O.pos, H2.pos), 0.957, 0.01); near(ang(H1.pos, O.pos, H2.pos), 104.5, 0.5);
  }
  const Os = liq.atoms.filter((a) => a.el === 'O');
  const L = liq.boxes.block[0];
  // minimum O-O distance with periodic images
  let mo = Infinity;
  for (let i = 0; i < Os.length; i++) for (let j = i + 1; j < Os.length; j++) for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const sh = [0, 1, 2].map((k) => x * L.a[k] + y * L.b[k] + z * L.c[k]);
    mo = Math.min(mo, dist(Os[i].pos, Os[j].pos.map((v, k) => v + sh[k])));
  }
  assert.ok(mo >= 2.4, `min O-O ${mo}`);
  assert.ok(ice.hbonds.length > 0);
});

test('metals: copper has four sheet directions, zinc one', () => {
  const [cu, zn] = sides('metals');
  assert.equal(cu.planes.layers.length, 4); assert.equal(cu.numbers.slide, 4); assert.equal(zn.numbers.slide, 1);
  assert.equal(cu.numbers.neighbors, 12); assert.equal(zn.numbers.neighbors, 6);
  zn.planes.layers.forEach((pl) => { const y = pl.points[0][1]; pl.points.forEach((p) => near(p[1], y, 1e-6)); });
});

test('polymer chain geometry', () => {
  for (const kind of ['pe']) {
    const n = 14; const c = polymerChain(kind, n);
    const carbons = c.atoms.map((a, i) => (a.el === 'C' ? i : -1)).filter((i) => i >= 0);
    assert.equal(carbons.length, n);
    for (let i = 1; i < n; i++) near(dist(c.atoms[i - 1].pos, c.atoms[i].pos), 1.54, 0.01);
    for (let i = 1; i < n - 1; i++) near(ang(c.atoms[i - 1].pos, c.atoms[i].pos, c.atoms[i + 1].pos), 112, 1);
    const deg = new Array(c.atoms.length).fill(0); c.bonds.forEach((b) => { deg[b.a]++; deg[b.b]++; });
    carbons.forEach((i) => assert.equal(deg[i], 4));
    assert.equal(c.atoms.filter((a) => a.el === 'H').length, 2 * n + 2);
    const ys = c.atoms.map((a) => a.pos[1]); assert.ok(Math.max(...ys) - Math.min(...ys) > 14);
  }
  for (const kind of ['pvc', 'ps']) {
    const c = polymerChain(kind, 14);
    const heavy = c.atoms.filter((a) => a.el !== 'H');
    assert.ok(heavy.length > 14);
    assert.ok(minDist(c.atoms, (a, b) => dist(a.pos, b.pos) < 1.7) >= 1.6, `${kind} nonbonded contacts`);
  }
});
