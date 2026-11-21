// Reading level and structure checks for envelope/content-bridge.js (part B of the Envelope layers pass).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEXT, PLAIN_NAME, PLAIN_LABEL, PLAIN_MARKER, PLAIN_COLD, lossWords, cutWords } from '../envelope/content-bridge.js';
import { gradeOf, longestSentence } from './helpers/readability.mjs';
import { DETAILS } from '../envelope/bridge.js';

// Function-valued fields are called with typical numbers (percent, degrees F, R-value) before grading.
const TYPICAL = [0, 2, 15, 30, 56, 99, 153, 250, 41, 58, 65, 3, 10, 20, 30];
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
  test(`bridge ${level}: grade 6 or lower when joined`, () => {
    const g = gradeOf(allStrings(TEXT[level]).join(' '));
    assert.ok(g <= 6.0, `${level} grade ${g.toFixed(2)}`);
  });
  test(`bridge ${level}: every string is readable and sentences stay short`, () => {
    for (const s of allStrings(TEXT[level])) {
      const words = s.split(/\s+/).filter(Boolean).length;
      if (words >= 8) assert.ok(gradeOf(s) <= 8.0, `grade ${gradeOf(s).toFixed(2)}: ${s}`);
      assert.ok(longestSentence(s) <= 20, `sentence too long: ${s}`);
      assert.ok(!/[’']t\b|\b(it|that|there|here|what|let)[’']s\b/i.test(s), `contraction: ${s}`);
    }
  });
}

test('bridge l1: no digit characters', () => {
  for (const s of allStrings(TEXT.l1)) assert.ok(!/\d/.test(s), `digit in: ${s}`);
});

test('bridge plain 3D words and names have no digits (levels 1 and 2)', () => {
  for (const s of [...Object.values(PLAIN_NAME), ...Object.values(PLAIN_LABEL), ...Object.values(PLAIN_MARKER), ...Object.values(PLAIN_COLD)]) {
    assert.ok(!/\d/.test(s), `digit in: ${s}`);
  }
  for (const p of [0, 2, 15, 30, 56, 99, 153, 250, 400]) assert.ok(!/\d/.test(lossWords(p)), `digit in lossWords(${p})`);
  for (const c of [0.05, 0.2, 0.39, 0.53, 0.63, 0.8, 0.95]) assert.ok(!/\d/.test(cutWords(c) || ''), `digit in cutWords(${c})`);
  assert.ok(Object.keys(TEXT.l3.subjects).length >= 3);
});

test('bridge l1: three picture choices map to the three details', () => {
  assert.equal(TEXT.l1.choices.length, 3);
  for (const c of TEXT.l1.choices) {
    assert.ok(TEXT.l1.answers[c.id], `answer for ${c.id}`);
    assert.ok(DETAILS[c.id], `detail ${c.id}`);
  }
  assert.deepEqual(TEXT.l1.choices.map((c) => c.label), ['Wall stud', 'Balcony floor', 'Brick shelf']);
});

test('bridge l2: four to six steps, each with title, text and life', () => {
  assert.ok(TEXT.l2.steps.length >= 4 && TEXT.l2.steps.length <= 6);
  for (const s of TEXT.l2.steps) {
    assert.ok(s.title && s.text && s.life);
    assert.ok(s.text.split(/[.!?]+\s*/).filter(Boolean).length <= 3, `more than three sentences: ${s.text}`);
  }
});

test('bridge l3: tries and notes exist', () => {
  assert.ok(TEXT.l3.tries.length >= 3);
  for (const t of TEXT.l3.tries) assert.ok(t.label && t.hint);
});

test('bridge l4: six tiles, each with a label and a compare line for any value', () => {
  assert.deepEqual(Object.keys(TEXT.l4.tiles).sort(), ['coldB', 'coldP', 'lossB', 'lossP', 'rB', 'rP']);
  for (const t of Object.values(TEXT.l4.tiles)) {
    assert.ok(t.label);
    for (const n of TYPICAL) {
      const c = typeof t.compare === 'function' ? t.compare(n) : t.compare;
      assert.equal(typeof c, 'string');
      assert.ok(c.length > 0);
    }
  }
  for (const [k, v] of Object.entries(TEXT.l4.glosses)) assert.ok(k && v);
});
