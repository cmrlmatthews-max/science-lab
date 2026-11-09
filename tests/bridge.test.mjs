import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { solveBridge, solveClearWall, describeResult, DETAILS, BRIDGE_MATERIALS } from '../envelope/bridge.js';

const CLIMATE = { tIn: 70, tOut: 20, rhIn: 35 };
const ALL = [];
for (const [d, det] of Object.entries(DETAILS)) for (const v of det.variants) ALL.push([d, v.id]);
const cache = {};
const get = (d, v) => cache[d + ':' + v] || (cache[d + ':' + v] = solveBridge(d, v, CLIMATE));

test('1. no bridge: uniform layered wall gives q within 1% of dT / sum R', () => {
  const layers = [
    { k: 1.11, thickness: 0.625 },     // gypsum
    { k: 6 / 19, thickness: 6 },       // batt
    { k: 1.11, thickness: 0.625 },     // sheathing
    { k: 0.25, thickness: 2 },         // mineral wool
    { k: 2 / 0.97, thickness: 2 },     // air space
    { k: 9.09, thickness: 3.625 },     // brick
  ];
  for (const cell of [0.25, 0.125]) {
    const r = solveClearWall(layers, CLIMATE, { cell });
    assert.ok(r.converged);
    const rSum = layers.reduce((a, L) => a + L.thickness / L.k, 0) + 0.68 + 0.17;
    const qExpect = (CLIMATE.tIn - CLIMATE.tOut) / rSum;
    assert.ok(Math.abs(r.q - qExpect) / qExpect < 0.01, `cell ${cell}: q ${r.q} vs ${qExpect}`);
    assert.ok(Math.abs(r.rEffective - rSum) / rSum < 0.01);
  }
  // two-point wall with a very conductive layer still balances
  const r2 = solveClearWall([{ k: 0.25, thickness: 4 }, { k: 312.5, thickness: 0.25 }, { k: 1.11, thickness: 0.5 }], CLIMATE);
  assert.ok(Math.abs(r2.q - r2.qExpected) / r2.qExpected < 0.01);
});

test('2. steel stud q > wood stud q > clear', () => {
  const wood = get('stud', 'wood'), steel = get('stud', 'steel');
  assert.ok(steel.q > wood.q, `${steel.q} > ${wood.q}`);
  assert.ok(wood.q > wood.qClear, `${wood.q} > ${wood.qClear}`);
  assert.ok(steel.q > steel.qClear);
  assert.ok(steel.increasePct > wood.increasePct && wood.increasePct > 0);
});

test('3. steel_ci minInteriorT > steel minInteriorT', () => {
  assert.ok(get('stud', 'steel_ci').minInteriorT > get('stud', 'steel').minInteriorT);
});

test('4. thermal break q < slab through q', () => {
  assert.ok(get('slab', 'break').q < get('slab', 'through').q);
});

test('5. standoff q < continuous angle q', () => {
  assert.ok(get('shelf', 'standoff').q < get('shelf', 'continuous').q);
});

test('6. all temperatures lie between tOut and tIn', () => {
  for (const [d, v] of ALL) {
    const r = get(d, v);
    let lo = Infinity, hi = -Infinity;
    for (const t of r.temps) { if (t < lo) lo = t; if (t > hi) hi = t; }
    assert.ok(lo >= CLIMATE.tOut - 1e-3 && hi <= CLIMATE.tIn + 1e-3, `${d}/${v}: ${lo}..${hi}`);
    assert.equal(r.temps.length, r.nx * r.ny);
    assert.equal(r.mats.length, r.nx * r.ny);
    for (const m of r.mats) assert.ok(m < r.palette.length);
    for (const p of r.palette) assert.match(p.color, /^#[0-9a-f]{6}$/i);
  }
});

test('7. each solve takes under 150 ms (after a warm-up call)', () => {
  for (const [d, v] of ALL) {
    solveBridge(d, v, CLIMATE);                                // warm-up
    let worst = 0;
    for (let n = 0; n < 3; n++) {
      const t0 = performance.now();
      solveBridge(d, v, CLIMATE);
      worst = Math.max(worst, performance.now() - t0);
    }
    assert.ok(worst < 150, `${d}/${v} took ${worst.toFixed(1)} ms`);
  }
});

test('8. flux balance: interior and exterior flux agree within 1% and every solve converged', () => {
  for (const [d, v] of ALL) {
    const r = get(d, v);
    assert.ok(r.converged, `${d}/${v} did not converge`);
    assert.ok(Math.abs(r.q - r.qExterior) / r.q < 0.01, `${d}/${v}: ${r.q} vs ${r.qExterior}`);
  }
});

test('9. converged answer matches a much tighter solve (0.1%)', () => {
  for (const [d, v] of ALL) {
    const tight = solveBridge(d, v, CLIMATE, { tol: 1e-10, maxIter: 20000 });
    assert.ok(Math.abs(get(d, v).q - tight.q) / tight.q < 0.001, `${d}/${v}`);
  }
});

test('10. SOR agrees with the conjugate gradient solver on the wood stud', () => {
  const sor = solveBridge('stud', 'wood', CLIMATE, { method: 'sor', tol: 1e-5, maxIter: 400000 });
  assert.ok(sor.converged);
  assert.ok(Math.abs(sor.q - get('stud', 'wood').q) / sor.q < 0.005);
});

test('11. sanity: steel stud whole-wall R is near the ASHRAE neighbourhood', () => {
  const r = get('stud', 'steel');
  assert.ok(r.rEffective > 6 && r.rEffective < 14, `R ${r.rEffective}`);
  // wood and steel clear fields are close to the 1D series sum of the layers
  const series = 0.68 + 0.625 / 1.11 + 19 + 0.625 / 1.11 + 0.5 / 3.3333 + 0.17;
  assert.ok(Math.abs(get('stud', 'wood').rClear - series) / series < 0.01);
  assert.ok(Math.abs(r.rClear - series) / series < 0.01);
});

test('12. orientation, geometry and dew point fields', () => {
  assert.equal(get('stud', 'wood').orientation, 'plan');
  assert.equal(get('slab', 'break').orientation, 'section');
  assert.equal(get('shelf', 'standoff').orientation, 'section');
  const r = get('stud', 'wood');
  assert.equal(r.widthIn, 16);
  assert.ok(Math.abs(r.dewPointF - 41.1) < 0.1, `dew point ${r.dewPointF}`);
  assert.equal(r.interiorSurface.length, r.nx);
  assert.ok(Math.abs(r.minInteriorT - r.interiorSurface[r.minInteriorAt]) < 1e-3);
  // the coldest interior spot of a steel stud sits over the stud, near the middle
  const s = get('stud', 'steel');
  assert.ok(Math.abs(s.minInteriorAt - s.nx / 2) < 12);
  // a very cold, humid case should flag condensation risk
  const cold = solveBridge('stud', 'steel', { tIn: 70, tOut: -10, rhIn: 70 });
  assert.equal(cold.condensationRisk, true);
});

test('13. describeResult gives 2 to 4 plain sentences with no contractions', () => {
  for (const [d, v] of ALL) {
    const lines = describeResult(get(d, v));
    assert.ok(lines.length >= 2 && lines.length <= 4);
    for (const s of lines) { assert.ok(!/['’]/.test(s), s); assert.ok(/\.$/.test(s)); }
  }
  assert.match(describeResult(get('stud', 'steel'))[0], /^The steel stud raises heat loss by \d+% against the same wall with no stud\.$/);
});

test('14. materials table is complete', () => {
  for (const m of Object.values(BRIDGE_MATERIALS)) {
    assert.ok(m.k > 0 && /^#[0-9a-f]{6}$/i.test(m.color) && m.name);
  }
});
