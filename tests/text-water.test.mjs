// Reading level and structure checks for envelope/content-water.js (part W of the Envelope layers pass).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEXT, plainLabel, answerKey } from '../envelope/content-water.js';
import { gradeOf, longestSentence } from './helpers/readability.mjs';
import * as W from '../envelope/water.js';

const allStrings = (v) => {
  const out = [];
  (function walk(x) {
    if (typeof x === 'string') out.push(x);
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  })(v);
  return out;
};
// Words and ids that are not reading text (kind flags and element ids).
const readable = (level) => {
  const out = [];
  (function walk(x, key) {
    if (key === 'id' || key === 'kind') return;
    if (typeof x === 'string') out.push(x);
    else if (Array.isArray(x)) x.forEach((y) => walk(y, key));
    else if (x && typeof x === 'object') Object.entries(x).forEach(([k, y]) => walk(y, k));
  })(TEXT[level], '');
  return out;
};

for (const level of ['l1', 'l2', 'l3']) {
  test(`water ${level}: grade 6 or lower when joined`, () => {
    const g = gradeOf(readable(level).join(' '));
    assert.ok(g <= 6.0, `${level} grade ${g.toFixed(2)}`);
  });
  test(`water ${level}: every string is readable and sentences stay short`, () => {
    for (const s of readable(level)) {
      const words = s.split(/\s+/).filter(Boolean).length;
      if (words >= 8) assert.ok(gradeOf(s) <= 8.0, `grade ${gradeOf(s).toFixed(2)}: ${s}`);
      assert.ok(longestSentence(s) <= 20, `sentence too long: ${s}`);
      assert.ok(!/[’']t\b|\b(it|that|there|here|what|let)[’']s\b/i.test(s), `contraction: ${s}`);
    }
  });
}

test('water l1: no digit characters', () => {
  for (const s of allStrings(TEXT.l1)) assert.ok(!/\d/.test(s), `digit in: ${s}`);
});

test('water l1: three or four choices, each with an answer and a real error id (or the good wall)', () => {
  assert.ok(TEXT.l1.choices.length >= 3 && TEXT.l1.choices.length <= 4);
  const ids = W.ERRORS.map((e) => e.id);
  for (const c of TEXT.l1.choices) {
    assert.ok(TEXT.l1.answers[c.id], `answer for ${c.id}`);
    assert.ok(c.id === 'good' || ids.includes(c.id), `error ${c.id}`);
  }
  for (const id of [...ids, 'good', 'many']) {
    assert.ok(TEXT.l1.answers[id], `answer ${id}`);
    assert.ok(TEXT.l1.summary[id], `summary ${id}`);
  }
  assert.equal(answerKey([]), 'good');
  assert.equal(answerKey(['no_gap']), 'no_gap');
  assert.equal(answerKey(['no_gap', 'no_weeps']), 'many');
});

test('water l2: four to six steps, each with title, text and life', () => {
  assert.ok(TEXT.l2.steps.length >= 4 && TEXT.l2.steps.length <= 6);
  for (const s of TEXT.l2.steps) {
    assert.ok(s.title && s.text && s.life);
    assert.ok(s.text.split(/[.!?]+\s*/).filter(Boolean).length <= 3, `more than three sentences: ${s.text}`);
    assert.ok(!/\d/.test(s.text + s.title + s.life), `digit in step: ${s.title}`);
  }
});

test('water l3: plain names cover every force, wall style, error and control layer', () => {
  assert.deepEqual(TEXT.l3.forces.map((f) => f.id), W.FORCES.map((f) => f.id));
  assert.deepEqual(TEXT.l3.walls.map((f) => f.id), W.STRATEGIES.map((f) => f.id));
  assert.deepEqual(TEXT.l3.errors.map((f) => f.id), W.ERRORS.map((f) => f.id));
  assert.deepEqual(TEXT.l3.layers.map((f) => f.id), W.CONTROL_LAYERS.map((f) => f.id));
  for (const f of W.FORCES) assert.ok(TEXT.l3.answers.forces[f.id].on.text && TEXT.l3.answers.forces[f.id].off.text);
  for (const s of W.STRATEGIES) assert.ok(TEXT.l3.answers.walls[s.id].ok.text && TEXT.l3.answers.walls[s.id].fault.text);
  for (const id of [...W.CONTROL_LAYERS.map((c) => c.id), 'all']) assert.ok(TEXT.l3.answers.layers[id].text);
  assert.equal(TEXT.l3.tries.length, 3);
});

test('water l3: answers agree with the rules (a wall that leaks is described as leaking)', () => {
  // Forces: no defense always leaks, defense always dry.
  for (const f of W.FORCES) { assert.equal(W.traceForce(f.id, false).ok, false); assert.equal(W.traceForce(f.id, true).ok, true); }
  // Walls: only the sealed face with a crack leaks.
  for (const s of W.STRATEGIES) for (const fault of [false, true]) assert.equal(W.traceStrategy(s.id, fault).ok, !(s.id === 'barrier' && fault));
});

test('water l4: five tiles with labels and comparisons, and the glosses', () => {
  assert.deepEqual(Object.keys(TEXT.l4.tiles).sort(), ['drip', 'gap', 'lap', 'turnup', 'weep']);
  for (const t of Object.values(TEXT.l4.tiles)) assert.ok(t.label && t.compare);
  assert.ok(Object.keys(TEXT.l4.glosses).length >= 8);
  // the dimensions the tiles show exist in the rules module
  assert.equal(W.DIMENSIONS.minAirSpace, 2);
  assert.equal(W.DIMENSIONS.headFlashingTurnUp, 2);
  assert.equal(W.DIMENSIONS.flashingProjection, 0.75);
  assert.equal(W.DIMENSIONS.weepSpacingBrick, 24);
  assert.equal(W.WALL.lapOverlap, 3);
});

test('water plain 3D labels: no digits, and the errors view labels are covered', () => {
  const samples = ['Drainage gap, 2 in.', 'Head flashing, 2 in. turn-up', 'Drip edge, 3/4 in. out', 'Weep holes, 24 in. apart', 'Solid masonry, 12 in.', 'Air cavity, 2 in.',
    'Housewrap (WRB)', 'Outside · rain', 'Inside · dry', 'Fiberglass batt\nWater control layer'];
  for (const s of samples) {
    const p = plainLabel(s);
    assert.ok(!/\d/.test(p), `digit in ${p}`);
    assert.notEqual(p, s);
  }
  assert.equal(plainLabel('Something else'), 'Something else');
});
