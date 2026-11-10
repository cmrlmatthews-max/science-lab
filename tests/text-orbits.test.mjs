// Reading level and card checks for orbital/content-orbits.js (part O of the layers pass).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEXT, INFO, getInfo } from '../orbital/content-orbits.js';
import { gradeOf, strings, longestSentence } from './helpers/readability.mjs';
import { BODIES, ORBIT_PRESETS } from '../orbital/bodies.js';
import { elementsFromApsides } from '../orbital/physics.js';

// Function-valued fields are called with typical numbers (km, km/s, seconds, how oval) before grading.
const TYPICAL = [400, 20200, 7.67, 5558, 0.3, 86164];
function resolve(value) {
  if (typeof value === 'function') return TYPICAL.map((n) => value(n));
  if (Array.isArray(value)) return value.map(resolve);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v)]));
  return value;
}
const allStrings = (v) => {
  const out = [];
  (function walk(x) {
    if (typeof x === 'string') out.push(x);
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  })(resolve(v));
  return out;
};

for (const level of ['l1', 'l2', 'l3']) {
  test(`orbits ${level}: grade 6 or lower when joined`, () => {
    const text = allStrings(TEXT[level]).join(' ');
    const g = gradeOf(text);
    assert.ok(g <= 6.0, `${level} grade ${g.toFixed(2)}`);
  });
  test(`orbits ${level}: every string is readable and sentences stay short`, () => {
    for (const s of allStrings(TEXT[level])) {
      const words = s.split(/\s+/).filter(Boolean).length;
      if (words >= 8) assert.ok(gradeOf(s) <= 8.0, `grade ${gradeOf(s).toFixed(2)}: ${s}`);
      assert.ok(longestSentence(s) <= 20, `sentence too long: ${s}`);
      assert.ok(!/[’']t\b|\b(it|that|there|here|what|let)[’']s\b/i.test(s), `contraction: ${s}`);
    }
  });
}

test('orbits l1: no digit characters', () => {
  for (const s of allStrings(TEXT.l1)) assert.ok(!/\d/.test(s), `digit in: ${s}`);
});

test('orbits l1: at most four picture choices that map to real things', () => {
  assert.ok(TEXT.l1.choices.length >= 3 && TEXT.l1.choices.length <= 4);
  for (const c of TEXT.l1.choices) {
    assert.ok(TEXT.l1.answers[c.id], `answer for ${c.id}`);
    assert.ok(ORBIT_PRESETS.earth.some((p) => p.id === c.id), `Earth preset ${c.id}`);
  }
});

test('orbits l2: four to six steps, each with title, text and life', () => {
  assert.ok(TEXT.l2.steps.length >= 4 && TEXT.l2.steps.length <= 6);
  for (const s of TEXT.l2.steps) {
    assert.ok(s.title && s.text && s.life);
    assert.ok(s.text.split(/[.!?]+\s*/).filter(Boolean).length <= 3, `more than three sentences: ${s.text}`);
  }
});

test('orbits l4: five tiles, each with a compare line', () => {
  const keys = Object.keys(TEXT.l4.tiles);
  assert.deepEqual(keys.sort(), ['highest', 'lowest', 'period', 'shape', 'speed']);
  for (const t of Object.values(TEXT.l4.tiles)) {
    assert.ok(t.label);
    for (const n of TYPICAL) {
      const c = typeof t.compare === 'function' ? t.compare(n) : t.compare;
      assert.equal(typeof c, 'string');
      assert.ok(c.length > 0);
    }
  }
});

test('orbits INFO: grade 7 or lower, no digits in the level 1-3 fields', () => {
  const parts = [];
  for (const e of Object.values(INFO)) {
    for (const f of ['short', 'what', 'why', 'life']) {
      if (e[f]) {
        parts.push(e[f]);
        assert.ok(!/\d/.test(e[f]), `digit in ${e.id}.${f}: ${e[f]}`);
        assert.ok(longestSentence(e[f]) <= 20, `long sentence in ${e.id}.${f}`);
      }
    }
  }
  const g = gradeOf(parts.join(' '));
  assert.ok(g <= 7.0, `INFO grade ${g.toFixed(2)}`);
});

test('orbits INFO: structure, related ids, getInfo', () => {
  const ids = Object.keys(INFO);
  assert.ok(ids.length >= 20, `only ${ids.length} entries`);
  for (const [id, e] of Object.entries(INFO)) {
    assert.equal(e.id, id);
    assert.ok(e.title && e.short, `${id} needs title and short`);
    for (const r of e.related || []) assert.ok(INFO[r], `${id} related ${r} does not resolve`);
    assert.equal(getInfo(id), e);
  }
  assert.equal(getInfo('nope'), null);
  for (const need of ['earth', 'moon', 'mars', 'sun', 'craft', 'path', 'lowest', 'highest', 'arrow', 'slices', 'orbit', 'oval', 'period', 'geostationary', 'kepler']) {
    assert.ok(INFO[need], `missing ${need}`);
  }
});

test('orbits INFO: numbers in facts match the physics and body data', () => {
  const e = BODIES.earth;
  const run = (pe, ap) => elementsFromApsides(e.mu, e.radius + pe, e.radius + ap);
  const iss = run(400, 400);
  assert.ok(Math.abs(iss.vp - 7.67) < 0.01);
  assert.ok(Math.abs(iss.period / 60 - 92.6) < 0.1);
  const gps = run(20200, 20200);
  assert.ok(Math.abs(gps.vp - 3.87) < 0.01 && Math.abs(gps.period / 3600 - 11.98) < 0.01);
  const geo = run(35786, 35786);
  assert.ok(Math.abs(geo.vp - 3.07) < 0.01 && Math.abs(geo.period / 3600 - 23.93) < 0.01);
  const mol = run(500, 39873);
  assert.ok(Math.abs(mol.vp - 10.04) < 0.02 && Math.abs(mol.va - 1.49) < 0.01 && Math.abs(mol.e - 0.74) < 0.01);
  assert.ok(INFO.iss.facts.some((f) => f.value.includes('7.67 km/s') && f.value.includes('17,200 mph')));
  assert.ok(INFO.earth.facts.some((f) => f.value.includes('12,756')) && Math.abs(e.radius * 2 - 12756.274) < 1);
  assert.ok(INFO.moon.facts.some((f) => f.value.includes('384,400')) && BODIES.moon.orbitRadius === 384400);
  assert.ok(INFO.mars.facts.some((f) => f.value.includes('6,792')) && Math.abs(BODIES.mars.radius * 2 - 6792.4) < 1);
});
