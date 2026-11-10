// Reading level and structure checks for orbital/content-launch.js (Launch mode, layers 1 to 3 and the cards).
import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeOf, strings, longestSentence } from './helpers/readability.mjs';
import { TEXT, INFO, getInfo } from '../orbital/content-launch.js';
import { BODIES } from '../orbital/bodies.js';

// Call function-valued fields with a typical value so they are graded too.
const SAMPLE = [0.5, 7.67, 3000, 5400];
function resolve(value) {
  if (typeof value === 'function') return SAMPLE.map((v) => value(v));
  if (Array.isArray(value)) return value.map(resolve);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v)]));
  return value;
}
const flat = (value) => strings(resolve(value)).flat(Infinity);

test('layers 1 to 3: grade 6 or lower, joined per level', () => {
  for (const lvl of ['l1', 'l2', 'l3']) {
    const all = strings(TEXT[lvl]).join(' ');
    const g = gradeOf(all);
    assert.ok(g <= 6.0, `${lvl} grade ${g.toFixed(2)}`);
  }
});

test('layers 1 to 3: every string is simple and short', () => {
  for (const lvl of ['l1', 'l2', 'l3']) {
    for (const s of strings(TEXT[lvl])) {
      const words = s.split(/\s+/).filter(Boolean).length;
      if (words >= 8) assert.ok(gradeOf(s) <= 8.0, `${lvl}: "${s}" grade ${gradeOf(s).toFixed(2)}`);
      assert.ok(longestSentence(s) <= 20, `${lvl}: sentence too long in "${s}"`);
    }
  }
});

test('layer 1 has no digits', () => {
  for (const s of flat(TEXT.l1)) assert.ok(!/\d/.test(s), `digit in "${s}"`);
});

test('layer 2: four to six steps, each with title, text and an in-your-life line', () => {
  const steps = TEXT.l2.steps;
  assert.ok(steps.length >= 4 && steps.length <= 6);
  for (const s of steps) {
    assert.ok(s.title && s.text && s.life);
    assert.ok(!/\d/.test(`${s.title} ${s.text} ${s.life}`), 'no digits in the story');
  }
});

test('layer 1: at most three big choices, answers exist for every outcome', () => {
  assert.ok(TEXT.l1.choices.length <= 3);
  for (const k of ['drop', 'slow', 'up', 'skim', 'orbit', 'oval', 'escape']) {
    assert.ok(TEXT.l1.answers[k] && TEXT.l1.answers[k].title && TEXT.l1.answers[k].text, k);
    assert.ok(TEXT.l1.summary[k], `summary ${k}`);
  }
});

test('cards: short, what, why and life read at grade 7 or lower', () => {
  const parts = [];
  for (const e of Object.values(INFO)) for (const f of ['short', 'what', 'why', 'life']) if (e[f]) parts.push(e[f]);
  const g = gradeOf(parts.join(' '));
  assert.ok(g <= 7.0, `cards grade ${g.toFixed(2)}`);
});

test('cards: structure and links', () => {
  const ids = Object.keys(INFO);
  assert.ok(ids.length >= 20, `only ${ids.length} entries`);
  for (const [id, e] of Object.entries(INFO)) {
    assert.equal(e.id, id);
    assert.ok(e.title && e.short, id);
    for (const r of e.related || []) assert.ok(getInfo(r), `${id} relates to missing ${r}`);
    for (const f of e.facts || []) assert.ok(f.label && f.value, `${id} fact`);
  }
  for (const id of Object.keys(BODIES)) assert.ok(getInfo(id), `body card ${id}`);
  for (const id of ['craft', 'path', 'start', 'impact', 'low', 'high', 'launch_arrow', 'speed_arrow',
    'orbit', 'gravity', 'escape_speed', 'free_fall', 'speed_vs_height', 'orbit_speed']) assert.ok(getInfo(id), id);
  assert.equal(getInfo('nope'), null);
});

test('cards: facts match the data files', () => {
  const earth = getInfo('earth').facts;
  assert.ok(earth.find((f) => f.label === 'Radius').value.includes('6,378 km'));
  assert.ok(earth.find((f) => f.label === 'Escape speed at the surface').value.includes('11.18 km/s'));
  const orbit = getInfo('orbit').facts;
  assert.ok(orbit.find((f) => f.label === 'Station speed' || f.label === 'Station height'));
  assert.ok(getInfo('orbit').facts.some((f) => f.value.includes('7.67 km/s') || f.value.includes('92.6 min')));
  assert.ok(getInfo('craft').facts.some((f) => f.value.includes('92.6 min')));
  assert.ok(getInfo('moon').facts.find((f) => f.label === 'Radius').value.includes('1,737 km'));
});
