// Reading level and structure of orbital/content-transfer.js (Travel mode).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEXT, INFO, getInfo } from '../orbital/content-transfer.js';
import { gradeOf, strings, longestSentence } from './helpers/readability.mjs';

const TYPICAL = { push1: 2.43, push2: 1.47, total: 3.89, time: 19000, fuel: 0.69, tripLine: 19000 };

// Call function-valued fields with a typical value so they can be graded.
function resolve(value, key = '') {
  if (typeof value === 'function') return resolve(value(TYPICAL[key] ?? 1));
  if (Array.isArray(value)) return value.map((v) => resolve(v, key));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, k === 'compare' ? key : k)]));
  return value;
}
const level = (n) => {
  const l = TEXT[`l${n}`];
  if (n !== 4) return resolve(l);
  // level 4 compare lines are resolved per tile
  return { ...resolve({ glosses: l.glosses }), tiles: Object.fromEntries(Object.entries(l.tiles).map(([k, t]) => [k, { label: t.label, compare: t.compare(TYPICAL[k]) }])) };
};

for (const n of [1, 2, 3]) {
  test(`level ${n} text reads at grade 6 or lower`, () => {
    const all = strings(level(n));
    const joined = all.join(' ');
    assert.ok(gradeOf(joined) <= 6.0, `grade ${gradeOf(joined).toFixed(2)}`);
    for (const s of all) {
      assert.ok(longestSentence(s) <= 20, `sentence too long: ${s}`);
      if (s.split(/\s+/).length >= 8) assert.ok(gradeOf(s) <= 8.0, `grade ${gradeOf(s).toFixed(2)}: ${s}`);
    }
  });
}

test('level 1 has no digits', () => {
  for (const s of strings(TEXT.l1)) assert.ok(!/\d/.test(s), `digit in: ${s}`);
});

test('level 1 has at most three choices', () => {
  assert.ok(TEXT.l1.choices.length >= 2 && TEXT.l1.choices.length <= 3);
});

test('story has 4 to 6 steps, each with title, text and life', () => {
  const s = TEXT.l2.steps;
  assert.ok(s.length >= 4 && s.length <= 6);
  for (const st of s) assert.ok(st.title && st.text && st.life);
});

test('level 4 tiles and compare lines', () => {
  const t = TEXT.l4.tiles;
  for (const k of ['push1', 'push2', 'total', 'time', 'fuel']) {
    assert.ok(t[k].label);
    assert.equal(typeof t[k].compare(TYPICAL[k]), 'string');
  }
  assert.match(t.fuel.compare(0.69), /7/);
});

test('INFO structure', () => {
  const need = ['earth', 'moon', 'mars', 'sun', 'craft', 'lowOrbit', 'highOrbit', 'transferPath', 'push1', 'push2', 'flame', 'speedArrow',
    'orbit', 'push', 'coast', 'speedChange', 'fuelShare', 'launchWindow'];
  for (const id of need) assert.ok(INFO[id], `missing ${id}`);
  assert.ok(Object.keys(INFO).length >= 18);
  for (const [id, e] of Object.entries(INFO)) {
    assert.equal(e.id, id);
    assert.ok(e.title && e.short, `${id} needs title and short`);
    for (const r of e.related || []) assert.ok(INFO[r], `${id}: related ${r} does not resolve`);
  }
  assert.equal(getInfo('earth'), INFO.earth);
  assert.equal(getInfo('nope'), null);
});

test('INFO title, short, what, why and life have no digits (cards can open at level 1)', () => {
  for (const e of Object.values(INFO)) for (const f of ['title', 'short', 'what', 'why', 'life']) assert.ok(!/\d/.test(e[f] || ''), `${e.id}.${f}`);
});

test('INFO prose reads at grade 7 or lower', () => {
  const text = Object.values(INFO).flatMap((e) => [e.short, e.what, e.why, e.life].filter(Boolean)).join(' ');
  assert.ok(gradeOf(text) <= 7.0, `grade ${gradeOf(text).toFixed(2)}`);
});
