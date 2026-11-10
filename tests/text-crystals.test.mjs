// Reading level and structure checks for molecules/content-crystals.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEXT, INFO, getInfo } from '../molecules/content-crystals.js';
import { CRYSTALS, CRYSTAL_ORDER } from '../molecules/crystal-data.js';
import { ELEMENTS } from '../molecules/elements.js';
import { gradeOf, strings, longestSentence } from './helpers/readability.mjs';

/** Call function-valued fields with a typical value so they can be graded. */
function resolved(v) {
  if (typeof v === 'function') return resolved(v(12));
  if (Array.isArray(v)) return v.map(resolved);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolved(x)]));
  return v;
}
const wordsIn = (s) => s.split(/\s+/).filter(Boolean).length;
// choices ids and crystal ids are keys, not prose
const SKIP = ['id'];

for (const level of ['l1', 'l2', 'l3']) {
  test(`${level}: joined grade at most 6.0`, () => {
    const all = strings(resolved(TEXT[level]), SKIP);
    const g = gradeOf(all.join(' '));
    assert.ok(g <= 6.0, `${level} grade ${g.toFixed(2)}`);
  });
  test(`${level}: every string readable, no sentence over 20 words`, () => {
    for (const s of strings(resolved(TEXT[level]), SKIP)) {
      if (wordsIn(s) >= 8) assert.ok(gradeOf(s) <= 8.0, `grade ${gradeOf(s).toFixed(1)}: ${s}`);
      assert.ok(longestSentence(s) <= 20, `long sentence: ${s}`);
    }
  });
}

test('l1: no digits', () => {
  for (const s of strings(TEXT.l1, SKIP)) assert.ok(!/\d/.test(s), s);
});

test('l1: at most four choices, each with an answer and a real crystal', () => {
  assert.ok(TEXT.l1.choices.length <= 4);
  for (const c of TEXT.l1.choices) {
    assert.ok(CRYSTALS[c.id], c.id);
    assert.ok(TEXT.l1.answers[c.id].title && TEXT.l1.answers[c.id].text);
  }
});

test('l2: four to six steps with an In your life line', () => {
  assert.ok(TEXT.l2.steps.length >= 4 && TEXT.l2.steps.length <= 6);
  for (const s of TEXT.l2.steps) assert.ok(s.title && s.text && s.life);
});

test('l3: plain text for every crystal in the library', () => {
  for (const id of CRYSTAL_ORDER) {
    const p = TEXT.l3.crystals[id];
    assert.ok(p && p.name && p.tag && p.shape && p.text, id);
  }
});

test('l4: tiles have labels and comparisons', () => {
  for (const k of ['neighbors', 'block', 'packing', 'density']) assert.ok(TEXT.l4.tiles[k].label, k);
  for (const id of CRYSTAL_ORDER) assert.ok(TEXT.l4.tiles.density.perCrystal[id], id);
});

test('INFO: short, what, why, life joined grade at most 7.0', () => {
  const all = [];
  for (const e of Object.values(INFO)) for (const k of ['short', 'what', 'why', 'life']) if (e[k]) all.push(e[k]);
  const g = gradeOf(all.join(' '));
  assert.ok(g <= 7.0, `INFO grade ${g.toFixed(2)}`);
});

test('INFO: every entry has title and short; every related id resolves', () => {
  for (const [id, e] of Object.entries(INFO)) {
    assert.equal(e.id, id);
    assert.ok(e.title && e.short, id);
    for (const r of e.related || []) assert.ok(getInfo(r), `${id} -> ${r}`);
  }
});

test('INFO: every element and every crystal has a card, plus the ideas and objects', () => {
  const used = new Set(CRYSTAL_ORDER.flatMap((id) => CRYSTALS[id].basis.map((b) => b.el)));
  for (const sym of used) assert.ok(getInfo(`el_${sym}`), sym);
  for (const id of CRYSTAL_ORDER) assert.ok(getInfo(id), id);
  for (const id of ['crystal', 'cell', 'neighbors', 'packing', 'slip', 'cleavage', 'grain', 'bcc', 'fcc', 'hcp', 'plane', 'bond', 'hbond']) assert.ok(getInfo(id), id);
  assert.equal(getInfo('nope'), null);
});

test('INFO: crystal facts match crystal-data.js', () => {
  for (const id of CRYSTAL_ORDER) {
    const c = CRYSTALS[id];
    const f = Object.fromEntries(INFO[id].facts.map((x) => [x.label, x.value]));
    assert.ok(f['Density'].startsWith(`${c.expect.density} g/cm³`), id);
    assert.equal(f['Atoms in the repeating block'], String(c.expect.atomsPerCell));
    assert.equal(f['Nearest distance'], `${c.expect.nearest} Å`);
  }
});
