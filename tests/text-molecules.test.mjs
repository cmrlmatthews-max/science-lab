// Reading-level and structure tests for molecules/content-molecules.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeOf, strings, longestSentence } from './helpers/readability.mjs';
import { TEXT, CHOICE_MOLECULE, INFO, getInfo, trustOf, chargeStrength } from '../molecules/content-molecules.js';
import { ELEMENTS } from '../molecules/elements.js';
import { MOLECULES, MOLECULE_ORDER } from '../molecules/molecule-data.js';
import { molarMass } from '../molecules/chem.js';

/** Call function-valued fields with typical values, then collect strings. */
function resolve(v, key = '') {
  if (typeof v === 'function') {
    const samples = key === 'atoms' ? [3, 10] : key === 'mass' ? [18.015] : key === 'bondLength' ? [0.957] : key === 'bondAngle' ? [104.5, 180] : key === 'charged' ? ['strong', 'none'] : [1];
    return samples.map((s) => v(s));
  }
  if (Array.isArray(v)) return v.map((x) => resolve(x, key));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x, k)]));
  return v;
}
const level = (n) => strings(resolve(TEXT[`l${n}`]));

for (const n of [1, 2, 3]) {
  test(`level ${n} text reads at grade 6 or lower`, () => {
    const all = level(n);
    const g = gradeOf(all.join('. ').replace(/\.\.+/g, '.'));
    assert.ok(g <= 6.0, `grade ${g.toFixed(2)}`);
  });
  test(`level ${n}: every string is short and plain`, () => {
    for (const s of level(n)) {
      const words = s.trim().split(/\s+/).length;
      if (words >= 8) assert.ok(gradeOf(s) <= 8.0, `grade ${gradeOf(s).toFixed(2)}: ${s}`);
      assert.ok(longestSentence(s) <= 20, `long sentence: ${s}`);
    }
  });
}

test('level 1 has no digits', () => {
  for (const s of level(1)) assert.ok(!/\d/.test(s), s);
});
test('level 1 has at most four choices and each has an answer', () => {
  assert.ok(TEXT.l1.choices.length <= 4);
  for (const c of TEXT.l1.choices) {
    assert.ok(TEXT.l1.answers[c.id], c.id);
    assert.ok(MOLECULES[CHOICE_MOLECULE[c.id]], `${c.id} is a molecule`);
  }
});
test('level 2 has 4 to 6 steps with an in-your-life line', () => {
  assert.ok(TEXT.l2.steps.length >= 4 && TEXT.l2.steps.length <= 6);
  for (const s of TEXT.l2.steps) { assert.ok(s.title && s.text && s.life); }
});
test('every molecule has plain words', () => {
  for (const id of MOLECULE_ORDER) {
    const t = TEXT.l3.molecules[id];
    assert.ok(t && t.name && t.tag && t.text && t.shape, id);
  }
});

test('INFO short, what, why, life read at grade 7 or lower', () => {
  const parts = [];
  for (const e of Object.values(INFO)) for (const k of ['short', 'what', 'why', 'life']) if (e[k]) parts.push(e[k]);
  const g = gradeOf(parts.join(' '));
  assert.ok(g <= 7.0, `grade ${g.toFixed(2)}`);
  for (const p of parts) assert.ok(longestSentence(p) <= 20, p);
});
test('INFO entries are complete and related ids resolve', () => {
  for (const [id, e] of Object.entries(INFO)) {
    assert.equal(e.id, id);
    assert.ok(e.title && e.short, id);
    for (const r of e.related || []) assert.ok(getInfo(r), `${id} -> ${r}`);
  }
});
test('INFO covers every element, bond type, molecule and enough ideas', () => {
  const used = new Set();
  for (const id of MOLECULE_ORDER) for (const a of MOLECULES[id].atoms) used.add(a.el);
  for (const sym of used) assert.ok(INFO[`el_${sym}`], sym);
  for (const id of ['bond_single', 'bond_double', 'bond_triple', 'bond_shared', 'hydrogen_bond', 'dipole_arrow', 'charged_side']) assert.ok(INFO[id], id);
  for (const id of MOLECULE_ORDER) assert.ok(INFO[`mol_${id}`], id);
  const ideas = Object.values(INFO).filter((e) => e.kind === 'Idea').length;
  assert.ok(ideas >= 6);
  for (const id of ['atom', 'molecule', 'bond', 'shape', 'charged_side', 'hydrogen_bond', 'greenhouse_gas', 'refrigerant', 'polymer']) assert.ok(INFO[id], id);
});
test('facts match the data files', () => {
  for (const id of MOLECULE_ORDER) {
    const m = MOLECULES[id];
    const f = Object.fromEntries(INFO[`mol_${id}`].facts.map((x) => [x.label, x.value]));
    assert.equal(f.Atoms, String(m.atoms.length));
    assert.equal(f['Weight of one molecule'], `${molarMass(m.atoms).toFixed(2)} g/mol`);
    assert.ok(f['Charged side'].includes(`${m.dipole} debye`));
  }
  const h = Object.fromEntries(INFO.el_H.facts.map((x) => [x.label, x.value]));
  assert.equal(h['Atomic mass'], `${ELEMENTS.H.mass} g/mol`);
});
test('level 4 compare functions and trust tags work', () => {
  assert.match(TEXT.l4.tiles.bondLength.compare(0.957), /hair/);
  assert.equal(chargeStrength(1.85), 'strong');
  assert.equal(chargeStrength(0), 'none');
  assert.equal(trustOf('water'), 'reference');
  assert.equal(trustOf('r134a'), 'schematic');
  assert.equal(trustOf('propane'), 'approximate');
});
