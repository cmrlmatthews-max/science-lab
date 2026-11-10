// Reading level and fact checks for molecules/content-compare.js. Run: node --test tests/text-compare.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEXT, INFO, getInfo, PAIR_IDS, STRUCTURE_IDS } from '../molecules/content-compare.js';
import { PAIRS, PAIR_ORDER } from '../molecules/compare-data.js';
import { gradeOf, strings, longestSentence } from './helpers/readability.mjs';

const LEVELS = ['l1', 'l2', 'l3'];

for (const lv of LEVELS) {
  test(`${lv}: joined text is grade 6.0 or lower`, () => {
    const all = strings(TEXT[lv]);
    assert.ok(all.length > 5);
    const g = gradeOf(all.join(' '));
    assert.ok(g <= 6.0, `${lv} grade ${g.toFixed(2)}`);
  });
  test(`${lv}: every string is short and plain`, () => {
    for (const s of strings(TEXT[lv])) {
      const words = s.split(/\s+/).filter(Boolean).length;
      if (words >= 8) assert.ok(gradeOf(s) <= 8.0, `grade ${gradeOf(s).toFixed(2)}: ${s}`);
      assert.ok(longestSentence(s) <= 20, `sentence too long: ${s}`);
    }
  });
}

test('l2: every pair has a story of 4 to 6 steps, and each step is graded', () => {
  assert.deepEqual(Object.keys(TEXT.l2.pairs).sort(), [...PAIR_IDS].sort());
  for (const id of PAIR_IDS) {
    const steps = TEXT.l2.pairs[id].steps;
    assert.ok(steps.length >= 4 && steps.length <= 6, id);
    for (const s of steps) {
      assert.ok(s.title && s.text && s.life, `${id} step fields`);
      const g = gradeOf([s.title, s.text, s.life].join('. '));
      assert.ok(g <= 8.0, `${id} "${s.title}" grade ${g.toFixed(2)}`);
    }
    const g = gradeOf(strings(TEXT.l2.pairs[id]).join(' '));
    assert.ok(g <= 6.0, `${id} story grade ${g.toFixed(2)}`);
  }
});

test('l1: no digit characters, at most four choices, every pair has a name and an answer', () => {
  for (const s of strings(TEXT.l1)) assert.ok(!/\d/.test(s), `digit in: ${s}`);
  assert.ok(TEXT.l1.choices.length <= 4);
  for (const c of TEXT.l1.choices) assert.ok(PAIR_IDS.includes(c.id));
  for (const id of PAIR_IDS) {
    assert.ok(TEXT.l1.answers[id] && TEXT.l1.labels[id].left && TEXT.l1.labels[id].right && TEXT.l1.summary[id], id);
  }
  assert.equal(TEXT.l1.choices[0].label, 'Diamond and pencil lead');
});

test('l3: every pair has three tries that match the data steps, and plain notes', () => {
  for (const id of PAIR_IDS) {
    const p = TEXT.l3.pairs[id];
    assert.equal(p.tries.length, PAIRS[id].steps.length, id);
    assert.ok(p.notice.length >= 2 && p.building);
  }
});

test('l4: rows use known kinds and the keys exist in the data', () => {
  const kinds = ['count', 'gcc', 'angstrom', 'plain', 'text'];
  for (const id of PAIR_IDS) {
    const rows = TEXT.l4.pairs[id].rows;
    assert.ok(rows.length >= 3 && rows.length <= 4, id);
    const L = PAIRS[id].left.build().numbers; const R = PAIRS[id].right.build().numbers;
    for (const r of rows) {
      assert.ok(kinds.includes(r.kind) && r.label && r.compare, `${id} ${r.id}`);
      if (r.kind === 'text') assert.ok(r.left && r.right);
      else assert.ok(r.id in L || r.id in R, `${id} has no ${r.id}`);
    }
  }
});

test('INFO: short, what, why, life are grade 7.0 or lower', () => {
  const text = [];
  for (const e of Object.values(INFO)) for (const k of ['short', 'what', 'why', 'life']) if (e[k]) text.push(e[k]);
  const g = gradeOf(text.join(' '));
  assert.ok(g <= 7.0, `INFO grade ${g.toFixed(2)}`);
});

test('INFO: every entry has title and short, related ids resolve, getInfo works', () => {
  for (const [id, e] of Object.entries(INFO)) {
    assert.equal(e.id, id);
    assert.ok(e.title && e.short, id);
    for (const r of e.related || []) assert.ok(INFO[r], `${id} -> ${r}`);
    assert.equal(getInfo(id), e);
  }
  assert.equal(getInfo('nope'), null);
});

test('INFO: has atoms, every structure, bonds and six or more ideas', () => {
  for (const el of ['C', 'Fe', 'Cu', 'Zn', 'Si', 'O', 'H', 'Cl']) assert.ok(INFO[`el-${el}`], el);
  for (const id of PAIR_IDS) {
    const s = STRUCTURE_IDS[id];
    for (const side of [s.left, ...(typeof s.right === 'string' ? [s.right] : Object.values(s.right))]) assert.ok(INFO[side], side);
  }
  for (const id of ['hydrogen-link', 'covalent-bond', 'metal-bond', 'carbon-gap', 'repeating-block', 'slip-plane', 'sheet-arrow']) assert.ok(INFO[id], id);
  assert.ok(Object.values(INFO).filter((e) => e.kind === 'Idea').length >= 6);
});

test('INFO facts match compare-data.js', () => {
  assert.deepEqual(PAIR_IDS, PAIR_ORDER);
  const LB = 62.428;
  const sideOf = (pid, which, variant) => {
    const p = PAIRS[pid];
    return which === 'left' ? p.left.build() : (variant ? p.right.variants.find((v) => v.id === variant).build() : p.right.build());
  };
  const fact = (e, label) => (e.facts.find((f) => f.label === label) || {}).value;
  const num = (s) => parseFloat(String(s).replace(/,/g, ''));
  for (const pid of PAIR_IDS) {
    for (const which of ['left', 'right']) {
      const sid = which === 'left' ? STRUCTURE_IDS[pid].left : (typeof STRUCTURE_IDS[pid].right === 'string' ? STRUCTURE_IDS[pid].right : STRUCTURE_IDS[pid].right.pe);
      const n = sideOf(pid, which).numbers; const e = INFO[sid];
      const d = fact(e, 'Density');
      if (d) {
        const lb = num(d.split(' lb')[0]); const gcc = num(d.match(/\(([\d.]+) g/)[1]);
        assert.ok(Math.abs(gcc - n.density) < 0.006, `${sid} g/cm3 ${gcc} vs ${n.density}`);
        assert.ok(Math.abs(lb - n.density * LB) < 0.6, `${sid} lb/ft3 ${lb} vs ${n.density * LB}`);
      }
      const nb = fact(e, 'Touching neighbors') || fact(e, 'Closest neighbors') || fact(e, 'Oxygen around each silicon') || fact(e, 'Links per water piece');
      if (nb) assert.equal(num(nb), n.neighbors, `${sid} neighbors`);
      const bl = fact(e, 'Bond length') || fact(e, 'Nearest distance') || fact(e, 'Silicon to oxygen distance') || fact(e, 'Distance between oxygen atoms') || fact(e, 'Carbon to carbon bond');
      if (bl) assert.ok(Math.abs(num(bl) - n.nearest) < 0.011, `${sid} bond ${bl} vs ${n.nearest}`);
      const gap = fact(e, 'Widest gap (radius)');
      if (gap) assert.ok(Math.abs(num(gap) - n.gap) < 0.006, `${sid} gap`);
      const pk = fact(e, 'Space filled by atoms');
      if (pk) assert.ok(Math.abs(num(pk) - n.packing) < 0.6, `${sid} packing`);
      const sg = fact(e, 'Distance between sheets');
      if (sg) assert.ok(Math.abs(num(sg) - n.sheetGap) < 0.006, `${sid} sheet gap`);
      const sl = fact(e, 'Directions of sliding layers');
      if (sl) assert.equal(num(sl), n.slide, `${sid} slide`);
      const ca = fact(e, 'Carbon atoms in this chain');
      if (ca) assert.equal(num(ca), n.carbons, `${sid} carbons`);
    }
  }
  // water box volumes, ice vs liquid
  const ice = PAIRS.water.left.build().numbers; const liq = PAIRS.water.right.build().numbers;
  assert.ok(String(fact(INFO.ice, 'Box volume')).startsWith(String(Math.round(ice.volume))));
  assert.ok(String(fact(INFO.liquid, 'Box volume')).startsWith(String(Math.round(liq.volume))));
  assert.ok(Math.abs((ice.volume / liq.volume - 1) * 100 - 9) < 1);
  // element facts
  const { ELEMENTS } = awaitedElements;
  for (const sym of ['C', 'Fe', 'Cu', 'Zn', 'Si', 'O', 'H', 'Cl']) {
    const e = INFO[`el-${sym}`];
    assert.equal(num(fact(e, 'Atomic number')), ELEMENTS[sym].Z, sym);
    assert.ok(Math.abs(num(fact(e, 'Mass')) - ELEMENTS[sym].mass) < 0.001, sym);
  }
});

const awaitedElements = await import('../molecules/elements.js');
