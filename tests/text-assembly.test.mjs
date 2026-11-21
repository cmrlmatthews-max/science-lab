// Reading level checks for envelope/content-assembly.js (part A of the Envelope layers pass).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEXT } from '../envelope/content-assembly.js';
import { gradeOf, longestSentence } from './helpers/readability.mjs';
import { WALLS } from '../envelope/walls.js';
import { CLIMATE_PRESETS } from '../envelope/physics.js';

// Function-valued fields are called with typical numbers (R total, Btu/h, degrees F) before grading.
const TYPICAL = [16.54, 302, 22, 60];
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
  test(`assembly ${level}: grade 6 or lower when joined`, () => {
    const g = gradeOf(allStrings(TEXT[level]).join(' '));
    assert.ok(g <= 6.0, `${level} grade ${g.toFixed(2)}`);
  });
  test(`assembly ${level}: every string is readable and sentences stay short`, () => {
    for (const s of allStrings(TEXT[level])) {
      const words = s.split(/\s+/).filter(Boolean).length;
      if (words >= 8) assert.ok(gradeOf(s) <= 8.0, `grade ${gradeOf(s).toFixed(2)}: ${s}`);
      assert.ok(longestSentence(s) <= 20, `sentence too long: ${s}`);
      assert.ok(!/[’']t\b|\b(it|that|there|here|what|let)[’']s\b/i.test(s), `contraction: ${s}`);
    }
  });
}

test('assembly l1: no digit characters', () => {
  for (const s of allStrings(TEXT.l1)) assert.ok(!/\d/.test(s), `digit in: ${s}`);
});

test('assembly l1: three picture choices, each with an answer', () => {
  assert.ok(TEXT.l1.choices.length >= 3 && TEXT.l1.choices.length <= 4);
  for (const c of TEXT.l1.choices) assert.ok(TEXT.l1.answers[c.id], `answer for ${c.id}`);
  for (const k of ['wet', 'dry', 'dryOutside', 'outsideSome']) assert.ok(TEXT.l1.answers[k], `answer ${k}`);
  for (const a of Object.values(TEXT.l1.answers)) assert.ok(a.title && a.text);
});

test('assembly l2: four to six steps, each with title, text and life', () => {
  assert.ok(TEXT.l2.steps.length >= 4 && TEXT.l2.steps.length <= 6);
  for (const s of TEXT.l2.steps) {
    assert.ok(s.title && s.text && s.life);
    assert.ok(s.text.split(/[.!?]+\s*/).filter(Boolean).length <= 3, `more than three sentences: ${s.text}`);
  }
});

test('assembly l3: names cover every wall and climate preset', () => {
  for (const id of Object.keys(WALLS)) assert.ok(TEXT.l3.wallNames[id], `wall ${id}`);
  for (const id of Object.keys(CLIMATE_PRESETS)) assert.ok(TEXT.l3.weatherNames[id], `climate ${id}`);
  assert.ok(TEXT.l3.weatherNames.custom);
  assert.ok(TEXT.l3.tries.length >= 3 && TEXT.l3.tries.length <= 4);
});

test('assembly l4: six tiles, each with a compare line', () => {
  assert.deepEqual(Object.keys(TEXT.l4.tiles).sort(), ['cond', 'dew', 'q', 'r', 'sheathing', 'u']);
  for (const [k, t] of Object.entries(TEXT.l4.tiles)) {
    assert.ok(t.label, k);
    const lines = k === 'cond' ? Object.values(t.compare) : TYPICAL.map((n) => (typeof t.compare === 'function' ? t.compare(n) : t.compare));
    for (const c of lines) { assert.equal(typeof c, 'string'); assert.ok(c.length > 0); }
  }
  for (const g of Object.values(TEXT.l4.glosses)) assert.ok(g.length > 10);
});
