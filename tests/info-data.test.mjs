// Tests for envelope/info-data.js: structure, plain-language rules, and numbers that must match materials.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INFO, LAYER_IDS, CONCEPT_IDS, PART_IDS, getInfo, infoForMaterial,
} from '../envelope/info-data.js';
import {
  MATERIALS, materialR, materialPerms, STEEL_STUD_EFFECTIVE_R,
} from '../envelope/materials.js';

const REQUIRED_LAYERS = [
  'gyp_050', 'gyp_063', 'gyp_sheath', 'osb', 'plywood', 'batt', 'minwool', 'xps', 'eps', 'polyiso',
  'ccspf', 'airspace', 'wrb', 'brick', 'cmu8', 'concrete', 'fibercement', 'vinyl', 'stucco',
  'softwood', 'steel', 'aluminum',
];
const REQUIRED_CONCEPTS = [
  'dew_point', 'condensation', 'r_value', 'u_factor', 'heat_flow', 'heat_loss_q', 'vapor_retarder',
  'vapor_classes', 'air_leakage', 'air_barrier', 'control_layers', 'thermal_bridge',
  'continuous_insulation', 'framing_effect', 'thermal_break', 'drainage_gap', 'rainscreen',
  'wrb_concept', 'flashing', 'weep_holes', 'capillary_break', 'climate_zone', 'relative_humidity',
  'interior_surface_temp', 'parallel_path', 'steady_state', 'drying', 'exploded_view', 'section_cut',
];
const REQUIRED_PARTS = [
  'wood_stud', 'steel_stud', 'slab_edge', 'balcony_slab', 'shelf_angle', 'standoff_bracket',
  'thermal_break_unit', 'brick_tie', 'head_flashing', 'sill_pan', 'end_dam', 'base_flashing',
  'drip_edge', 'lap_joint', 'window_opening', 'mortar_joint', 'cavity',
];

const CONTROLS = ['water', 'air', 'vapor', 'thermal', 'structure', 'finish', 'cladding', 'airspace'];
const SOURCE_KINDS = ['ching', 'mixed', 'general'];
const ABBREVIATIONS = ['OSB', 'XPS', 'EPS', 'CMU', 'WRB', 'ARE', 'PPD', 'PDD', 'BCI', 'HVAC', 'EIFS', 'CCSPF', 'IECC', 'IBC'];
const BRANDS = [
  'Tyvek', 'Typar', 'Zip', 'Styrofoam', 'Dow', 'Owens', 'Rockwool', 'Roxul', 'Hardie', 'DensGlass',
  'Blueskin', 'Grace', 'Henry', 'Huber', 'Kingspan', 'Thermax',
];
const PROSE_FIELDS = ['what', 'job', 'ifWrong', 'doThis'];

/** Every string in an entry, with its field name. */
function strings(entry) {
  const out = [];
  const walk = (v, name) => {
    if (typeof v === 'string') out.push([name, v]);
    else if (Array.isArray(v)) v.forEach((x) => walk(x, name));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, `${name}.${k}`));
  };
  Object.entries(entry).forEach(([k, v]) => walk(v, k));
  return out;
}

/** Split on end punctuation followed by a capital, so "24 in. o.c." stays in one sentence. */
function sentences(text) {
  return text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
}
function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
function decimals(str) {
  const m = /\.(\d+)/.exec(str);
  return m ? m[1].length : 0;
}
function nearlyEqual(shown, actual) {
  const tol = 0.5 * 10 ** -decimals(String(shown)) + 1e-9;
  return Math.abs(Number(shown) - actual) <= tol;
}

test('every required id exists with the right kind', () => {
  for (const [ids, kind] of [[REQUIRED_LAYERS, 'layer'], [REQUIRED_CONCEPTS, 'concept'], [REQUIRED_PARTS, 'part']]) {
    for (const id of ids) {
      const e = INFO[id];
      assert.ok(e, `missing entry ${id}`);
      assert.equal(e.id, id, `id mismatch for ${id}`);
      assert.equal(e.kind, kind, `${id} should be a ${kind}`);
      assert.equal(getInfo(id), e);
    }
  }
  assert.deepEqual([...LAYER_IDS].sort(), [...REQUIRED_LAYERS].sort());
  assert.deepEqual([...CONCEPT_IDS].sort(), [...REQUIRED_CONCEPTS].sort());
  assert.deepEqual([...PART_IDS].sort(), [...REQUIRED_PARTS].sort());
  assert.equal(Object.keys(INFO).length, REQUIRED_LAYERS.length + REQUIRED_CONCEPTS.length + REQUIRED_PARTS.length);
  assert.equal(getInfo('nope'), null);
  assert.equal(getInfo('toString'), null);
});

test('every material id maps to an entry', () => {
  for (const id of Object.keys(MATERIALS)) {
    const e = infoForMaterial(id);
    assert.ok(e, `no entry for material ${id}`);
    assert.equal(e.kind, 'layer');
  }
  assert.equal(infoForMaterial('batt_r13'), infoForMaterial('batt_r19'));
  assert.equal(infoForMaterial('batt_r19'), infoForMaterial('batt_r21'));
  assert.equal(infoForMaterial('batt_r13').id, 'batt');
  assert.equal(infoForMaterial('unknown_material'), null);
});

test('layer control tags match the app tags in materials.js', () => {
  for (const [id, mat] of Object.entries(MATERIALS)) {
    const e = infoForMaterial(id);
    assert.ok(CONTROLS.includes(e.control), `${e.id} control ${e.control}`);
    assert.equal(e.control, mat.control, `${id}: control should match materials.js`);
  }
});

test('required fields are filled for each kind', () => {
  const filled = (v) => typeof v === 'string' && v.trim().length > 0;
  for (const e of Object.values(INFO)) {
    for (const f of ['id', 'title', 'short', 'what', 'job', 'ifWrong', 'doThis', 'are', 'source']) {
      assert.ok(filled(e[f]), `${e.id}.${f} is empty`);
    }
    assert.ok(SOURCE_KINDS.includes(e.sourceKind), `${e.id} sourceKind ${e.sourceKind}`);
    assert.ok(Array.isArray(e.more) && e.more.length >= 1 && e.more.length <= 4, `${e.id}.more needs 1 to 4 paragraphs`);
    e.more.forEach((p) => assert.ok(filled(p), `${e.id}.more has an empty paragraph`));
    assert.ok(Array.isArray(e.related) && e.related.length >= 2 && e.related.length <= 5, `${e.id}.related needs 2 to 5 ids`);
    if (e.kind === 'layer') assert.ok(CONTROLS.includes(e.control), `${e.id} needs control`);
    else assert.equal(e.control, undefined, `${e.id} should not have control`);
    if (e.kind === 'layer' || e.kind === 'part') {
      assert.ok(filled(e.mistake), `${e.id}.mistake is empty`);
      assert.ok(Array.isArray(e.products) && e.products.length >= 1 && e.products.length <= 4, `${e.id}.products needs 1 to 4`);
      assert.ok(Array.isArray(e.facts) && e.facts.length >= 1 && e.facts.length <= 4 + (e.id === 'batt' ? 0 : 0), `${e.id}.facts needs 1 to 4`);
    }
    if (e.products) e.products.forEach((p) => assert.ok(filled(p)));
    if (e.facts) {
      assert.ok(e.facts.length <= 4, `${e.id} has more than 4 facts`);
      e.facts.forEach((f) => { assert.ok(filled(f.label) && filled(f.value), `${e.id} has an empty fact`); });
    }
    if (e.mistake !== undefined) assert.ok(filled(e.mistake), `${e.id}.mistake is empty`);
  }
});

test('short is 12 words or fewer', () => {
  for (const e of Object.values(INFO)) {
    assert.ok(wordCount(e.short) <= 12, `${e.id}.short has ${wordCount(e.short)} words: ${e.short}`);
  }
});

test('no sentence over 28 words in what, job, ifWrong, doThis', () => {
  for (const e of Object.values(INFO)) {
    for (const f of PROSE_FIELDS) {
      for (const s of sentences(e[f])) {
        assert.ok(wordCount(s) <= 28, `${e.id}.${f} sentence has ${wordCount(s)} words: ${s}`);
      }
    }
  }
});

test('field lengths stay short', () => {
  for (const e of Object.values(INFO)) {
    for (const f of [...PROSE_FIELDS, 'mistake', 'are']) {
      if (e[f] === undefined) continue;
      const n = sentences(e[f]).length;
      assert.ok(n >= 1 && n <= 3, `${e.id}.${f} has ${n} sentences`);
    }
    e.more.forEach((p, i) => {
      const n = sentences(p).length;
      assert.ok(n >= 1 && n <= 3, `${e.id}.more[${i}] has ${n} sentences`);
    });
  }
});

test('no apostrophes or quotation marks anywhere (no contractions, feet and inch marks)', () => {
  for (const e of Object.values(INFO)) {
    for (const [name, text] of strings(e)) {
      assert.ok(!/['‘’"“”]/.test(text), `${e.id}.${name} has an apostrophe or quote: ${text}`);
      assert.ok(!/\b\w+'(t|s|re|ve|ll|d)\b/i.test(text), `${e.id}.${name} has a contraction`);
    }
  }
});

test('no long all-caps words except known abbreviations', () => {
  for (const e of Object.values(INFO)) {
    for (const [name, text] of strings(e)) {
      for (const w of text.match(/\b[A-Z]{5,}\b/g) ?? []) {
        assert.ok(ABBREVIATIONS.includes(w), `${e.id}.${name} has the all-caps word ${w}`);
      }
    }
  }
});

test('no brand names', () => {
  for (const e of Object.values(INFO)) {
    for (const [name, text] of strings(e)) {
      for (const b of BRANDS) {
        assert.ok(!new RegExp(`\\b${b}\\b`, 'i').test(text), `${e.id}.${name} names the brand ${b}`);
      }
    }
  }
});

test('every related id exists and is not the entry itself', () => {
  for (const e of Object.values(INFO)) {
    for (const r of e.related) {
      assert.ok(INFO[r], `${e.id} relates to missing id ${r}`);
      assert.notEqual(r, e.id, `${e.id} relates to itself`);
    }
    assert.equal(new Set(e.related).size, e.related.length, `${e.id} has a repeated related id`);
  }
});

test('source tags are present and consistent with sourceKind', () => {
  for (const e of Object.values(INFO)) {
    if (e.sourceKind === 'general') {
      assert.match(e.source, /^Building science practice$/, `${e.id}: general source`);
    } else {
      assert.match(e.source, /(BCI|ARE notes)/, `${e.id}: ${e.sourceKind} entries cite the notes`);
    }
    if (e.sourceKind === 'mixed') assert.match(e.source, /(building science practice|ARE notes)/i, `${e.id}: mixed entries name practice`);
    if (e.sourceKind === 'ching') assert.ok(!/practice/i.test(e.source), `${e.id}: ching entries cite only the notes`);
  }
});

// ------------------------------------------------------------------ numbers

/** Material ids that use this layer card. */
function idsFor(entryId) {
  return Object.keys(MATERIALS).filter((m) => infoForMaterial(m).id === entryId);
}

test('every R-value fact for a material matches materials.js', () => {
  let checked = 0;
  for (const e of Object.values(INFO).filter((x) => x.kind === 'layer')) {
    const ids = idsFor(e.id);
    assert.ok(ids.length >= 1, `${e.id} has no material`);
    for (const f of e.facts) {
      if (/^R-value/.test(f.label)) {
        const shown = (/^-?\d+(\.\d+)?/.exec(f.value) ?? [])[0];
        assert.ok(shown !== undefined, `${e.id} fact ${f.label} has no number`);
        const t = /\(([\d.]+) in\.\)/.exec(f.label);
        const ok = ids.some((id) => nearlyEqual(shown, materialR(id, t ? Number(t[1]) : undefined)));
        assert.ok(ok, `${e.id}: ${f.label} = ${f.value} does not match materials.js`);
        checked += 1;
      }
      if (/^R per inch/.test(f.label)) {
        const ok = ids.some((id) => nearlyEqual(f.value, MATERIALS[id].rPerInch));
        assert.ok(ok, `${e.id}: ${f.label} = ${f.value} does not match materials.js`);
        checked += 1;
      }
    }
  }
  assert.ok(checked >= 22, `only ${checked} R facts were checked`);
});

test('every permeance fact matches materials.js', () => {
  let checked = 0;
  for (const e of Object.values(INFO).filter((x) => x.kind === 'layer')) {
    const ids = idsFor(e.id);
    for (const f of e.facts.filter((x) => /^Permeance/.test(x.label))) {
      const shown = Number((/^\d+(\.\d+)?/.exec(f.value) ?? [])[0]);
      assert.ok(Number.isFinite(shown), `${e.id} permeance has no number`);
      const ok = ids.some((id) => {
        const p = materialPerms(id);
        return p != null && nearlyEqual(shown, p);
      });
      assert.ok(ok, `${e.id}: permeance ${f.value} does not match materials.js`);
      checked += 1;
    }
  }
  assert.ok(checked >= 17, `only ${checked} perm facts were checked`);
});

test('specific numbers named in the brief', () => {
  assert.equal(materialR('osb'), 0.62);
  assert.equal(INFO.osb.facts.find((f) => f.label === 'R-value').value, '0.62');
  assert.equal(INFO.xps.facts.find((f) => f.label === 'R per inch').value, '5.0');
  assert.equal(INFO.brick.facts.find((f) => f.label === 'R per inch').value, '0.11');
  assert.equal(INFO.gyp_050.facts.find((f) => f.label === 'R-value').value, '0.45');
  assert.equal(INFO.softwood.facts.find((f) => f.label === 'R per inch').value, '1.25');
  assert.equal(INFO.steel.facts.find((f) => f.label === 'R per inch').value, '0.0032');
  assert.equal(INFO.aluminum.facts.find((f) => f.label === 'R per inch').value, '0.0007');
  assert.equal(INFO.airspace.facts.find((f) => f.label === 'R-value').value, '0.97');
});

test('steel stud effective R fact matches the table', () => {
  const f = INFO.steel.facts.find((x) => /Effective R/.test(x.label));
  assert.equal(Number(f.value), STEEL_STUD_EFFECTIVE_R['6|19|16']);
  const g = INFO.steel_stud.facts.find((x) => /Effective R/.test(x.label));
  assert.equal(Number(g.value), STEEL_STUD_EFFECTIVE_R['6|19|16']);
  const h = INFO.framing_effect.facts.find((x) => /Steel/.test(x.label));
  assert.match(h.value, new RegExp(String(STEEL_STUD_EFFECTIVE_R['6|19|16'])));
});

test('R numbers written in layer text are known values', () => {
  // Numbers allowed after "R", "R-" or "R " in layer prose: every materials.js R value, plus
  // values the brief or the BCI table states (labels, the BCI per-inch table, thick-board totals).
  const allowed = new Set();
  for (const [id, m] of Object.entries(MATERIALS)) {
    if (m.rFixed != null) allowed.add(m.rFixed);
    if (m.rPerInch != null) allowed.add(m.rPerInch);
    allowed.add(Number(materialR(id).toFixed(2)));
  }
  [13, 19, 21, 7.2, 3.3, 2.0, 2, 0.6, 1.25, 0.64, 0.4].forEach((n) => allowed.add(n));
  for (const e of Object.values(INFO).filter((x) => x.kind === 'layer')) {
    for (const [name, text] of strings(e)) {
      if (name.startsWith('facts') || name === 'source') continue;
      for (const m of text.matchAll(/\bR[- ](\d+(?:\.\d+)?)/g)) {
        assert.ok(allowed.has(Number(m[1])), `${e.id}.${name} states R ${m[1]}, which is not a known value`);
      }
    }
  }
});

test('the dew point example matches the app formula', async () => {
  const { dewPoint } = await import('../envelope/physics.js');
  assert.equal(Math.round(dewPoint(70, 35)), 41);
  assert.equal(Math.round(dewPoint(90, 70)), 79);
  assert.equal(Math.round(dewPoint(70, 50)), 51);
  assert.match(INFO.dew_point.more[0], /41 °F/);
  assert.match(INFO.dew_point.more.join(' '), /79 °F/);
  assert.match(INFO.relative_humidity.facts.map((f) => f.value).join(' '), /51 °F/);
});

test('rule numbers agree with water.js and vapor.js', async () => {
  const { DIMENSIONS } = await import('../envelope/water.js');
  const { VAPOR_CLASSES } = await import('../envelope/vapor.js');
  const text = (id) => strings(INFO[id]).map(([, t]) => t).join(' ');
  assert.equal(DIMENSIONS.weepSpacingBrick, 24);
  assert.equal(DIMENSIONS.weepSpacingCmu, 32);
  assert.match(text('weep_holes'), /24 in\. o\.c\./);
  assert.match(text('weep_holes'), /32 in\. o\.c\./);
  assert.match(text('head_flashing'), /2 in\./);
  assert.match(text('head_flashing'), /3\/4 in\./);
  assert.match(text('head_flashing'), /45 degrees/);
  assert.match(text('end_dam'), /2 in\./);
  assert.match(text('airspace'), /2 in\./);
  assert.match(text('cavity'), /2 in\./);
  assert.match(INFO.vapor_classes.facts.find((f) => f.label === 'Class I').value, /0\.1 perm or less/);
  assert.match(INFO.vapor_classes.facts.find((f) => f.label === 'Class II').value, /Above 0\.1, up to 1\.0/);
  assert.match(INFO.vapor_classes.facts.find((f) => f.label === 'Class III').value, /Above 1\.0, up to 10/);
  assert.equal(VAPOR_CLASSES.I.perms, '0.1 or less');
  assert.equal(VAPOR_CLASSES.II.perms, 'Above 0.1, up to 1.0');
});

test('layer entries name a second job where a product has one', () => {
  const mentions = (id, re) => assert.match(strings(INFO[id]).map(([, t]) => t).join(' '), re, `${id} should mention the second job`);
  mentions('xps', /air barrier/i);
  mentions('polyiso', /vapor retarder/i);
  mentions('polyiso', /air barrier/i);
  mentions('ccspf', /air barrier/i);
  mentions('osb', /air barrier/i);
  mentions('wrb', /air barrier/i);
  mentions('gyp_050', /air barrier/i);
});
