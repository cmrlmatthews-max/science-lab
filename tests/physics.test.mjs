import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MATERIALS, FILMS, materialR, materialPerms } from '../envelope/materials.js';
import { WALLS, cloneWall } from '../envelope/walls.js';
import {
  dewPoint, conductionLoss, infiltrationLoss, CLIMATE_PRESETS, analyzeWall,
} from '../envelope/physics.js';

const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} expected ${expected} +/- ${tol}, got ${actual}`);

/** Walk any value and fail on NaN or Infinity. */
function assertFinite(value, path = 'result') {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `${path} is ${value}`);
  else if (Array.isArray(value)) value.forEach((v, i) => assertFinite(v, `${path}[${i}]`));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => assertFinite(v, `${path}.${k}`));
}

const MIXED = CLIMATE_PRESETS.mixed;
const faceOf = (a, materialId) => a.faces[a.layers.find((l) => l.materialId === materialId).index];

test('dew point matches check values', () => {
  near(dewPoint(70, 50), 50.5, 0.1);
  near(dewPoint(95, 55), 76.3, 0.1);
  near(dewPoint(70, 35), 41.1, 0.1);
  near(dewPoint(70, 30), 37.1, 0.1);
});

test('heat loss helpers', () => {
  near(conductionLoss(1 / 16.54, 100, 50), 302, 1);
  assert.equal(infiltrationLoss(10, 50), 540);
});

test('material helpers', () => {
  assert.equal(materialR('xps', 2), 10);
  near(materialR('xps', 4), 20, 1e-9);
  assert.equal(materialR('batt_r21', 5.5), 21);
  near(materialR('softwood', 5.5), 6.875, 1e-9);
  near(materialPerms('xps', 2), 0.6, 1e-9);
  near(materialPerms('xps', 4), 0.3, 1e-9);
  near(materialPerms('concrete', 8), 0.4, 1e-9);
  assert.equal(materialPerms('osb'), 2);
  assert.equal(materialPerms('airspace'), null);
  assert.equal(materialPerms('softwood', 5.5), null);
  assert.equal(materialR('nope', 1), 0);
  assert.equal(materialPerms('nope', 1), null);
  assert.deepEqual([FILMS.interior.r, FILMS.exteriorWinter.r, FILMS.exteriorSummer.r], [0.68, 0.17, 0.25]);
});

test('every material is complete and has a distinct hex color', () => {
  const colors = new Set();
  for (const [key, m] of Object.entries(MATERIALS)) {
    assert.equal(m.id, key);
    assert.match(m.color, /^#[0-9a-f]{6}$/i, key);
    assert.ok(!colors.has(m.color.toLowerCase()), `duplicate color ${m.color} on ${key}`);
    colors.add(m.color.toLowerCase());
    assert.ok(m.rFixed != null || m.rPerInch != null, `${key} has no R`);
    assert.ok(m.control && m.category && m.source, key);
  }
  assert.equal(Object.keys(MATERIALS).length, 24);
});

test('cloneWall returns an independent deep copy', () => {
  const a = cloneWall('W1');
  a.layers[1].framing.spacing = 24;
  a.layers.pop();
  assert.equal(WALLS.W1.layers.length, 5);
  assert.equal(WALLS.W1.layers[1].framing.spacing, 16);
  assert.throws(() => cloneWall('W9'));
});

test('mixed winter check values', () => {
  const expected = {
    W1: { r: 16.54, u: 0.0605, q: 3.02 },
    W2: { r: 27.87, u: 0.0359, q: 1.79 },
    W3: { r: 18.44, u: 0.0542, q: 2.71 },
    W4: { r: 13.78, u: 0.0726, q: 3.63 },
  };
  for (const [id, e] of Object.entries(expected)) {
    const a = analyzeWall(cloneWall(id), MIXED);
    near(a.rTotal, e.r, 0.01, `${id} rTotal`);
    near(a.uFactor, e.u, 0.0001, `${id} U`);
    near(a.q, e.q, 0.01, `${id} q`);
    near(a.dewPointF, 41.1, 0.1, `${id} dew`);
    assert.equal(a.season, 'winter');
    assert.equal(a.warmSide, 'interior');
  }
});

test('mixed winter face temperatures and condensation', () => {
  const w1 = analyzeWall(cloneWall('W1'), MIXED);
  near(faceOf(w1, 'osb').tempF, 22.0, 0.1);
  assert.equal(w1.condensation.materialId, 'osb');
  assert.equal(w1.condensation.outsideWrb, false);
  assert.equal(w1.risk, true);

  const w2 = analyzeWall(cloneWall('W2'), MIXED);
  near(faceOf(w2, 'osb').tempF, 36.5, 0.1);
  assert.equal(w2.condensation.materialId, 'osb');
  assert.equal(w2.risk, true);

  const w3 = analyzeWall(cloneWall('W3'), MIXED);
  near(faceOf(w3, 'gyp_sheath').tempF, 47.4, 0.1);
  assert.equal(faceOf(w3, 'gyp_sheath').belowDew, false);
  assert.equal(w3.risk, false);
  assert.equal(w3.condensation.outsideWrb, true);

  const w4 = analyzeWall(cloneWall('W4'), MIXED);
  near(faceOf(w4, 'cmu8').tempF, 65.9, 0.1);
  assert.equal(w4.risk, false);
});

test('path resistances', () => {
  const w1 = analyzeWall(cloneWall('W1'), MIXED);
  near(w1.rCavityPath, 23.07, 0.01);
  near(w1.rFramePath, 8.945, 0.01);
  near(w1.rNominal, 23.07, 0.01);
  const w3 = analyzeWall(cloneWall('W3'), MIXED);
  near(w3.rNominal, 30.34, 0.01);
  near(w3.framingLossPct, 39.2, 0.1);
  assert.equal(w3.rFramePath, null);
  near(w3.rCavityPath, w3.rTotal, 1e-9);
  const stud = w3.layers[1];
  assert.equal(stud.r, 7.1);
  assert.match(stud.rSource, /table/);
});

test('BCI preset check values', () => {
  const bci = CLIMATE_PRESETS.bci;
  const w1 = analyzeWall(cloneWall('W1'), bci);
  near(w1.dewPointF, 37.1, 0.1);
  near(faceOf(w1, 'osb').tempF, 2.9, 0.1);
  const w2 = analyzeWall(cloneWall('W2'), bci);
  near(faceOf(w2, 'osb').tempF, 23.2, 0.1);
});

test('layer, face and profile geometry', () => {
  const a = analyzeWall(cloneWall('W1'), MIXED);
  assert.equal(a.faces.length, a.layers.length + 1);
  near(a.totalThickness, 0.5 + 5.5 + 0.4375 + 0.03 + 0.3125, 1e-9);
  assert.equal(a.faces[0].label, 'Interior surface');
  assert.equal(a.faces.at(-1).label, 'Exterior surface');
  assert.equal(a.faces[0].z, 0);
  assert.equal(a.faces.at(-1).z, a.totalThickness);
  assert.equal(a.profile[0].z, -1);
  assert.equal(a.profile[0].tempF, 70);
  assert.equal(a.profile.at(-1).z, a.totalThickness + 1);
  assert.equal(a.profile.at(-1).tempF, 20);
  a.layers.forEach((l, i) => {
    assert.equal(l.tIn, a.faces[i].tempF);
    assert.equal(l.tOut, a.faces[i + 1].tempF);
  });
  const batt = a.layers[1];
  assert.ok(a.dewPlane.z > batt.zIn && a.dewPlane.z < batt.zOut, 'dew plane is inside the cavity');
  assert.equal(a.dewPlane.layerIndex, 1);
});

test('summer hot-humid has the warm side outside', () => {
  const a = analyzeWall(cloneWall('W1'), CLIMATE_PRESETS.hothumid);
  assert.equal(a.season, 'summer');
  assert.equal(a.warmSide, 'exterior');
  near(a.dewPointF, 76.3, 0.1);
  near(a.rCavityPath, 0.68 + 0.45 + 21 + 0.62 + 0.15 + 0.25, 1e-9);
  assert.equal(a.profile[0].tempF, 75);
  assert.equal(a.profile.at(-1).tempF, 95);
  assert.equal(a.condensation.outsideWrb, false);
  assert.equal(a.condensation.materialId, 'gyp_050');
  assert.equal(a.risk, true);
  assertFinite(a);
});

test('edit: reorder layers', () => {
  const wall = cloneWall('W1');
  wall.layers.reverse();
  for (const climate of Object.values(CLIMATE_PRESETS)) {
    const a = analyzeWall(wall, climate);
    assertFinite(a);
    assert.equal(a.faces.length, 6);
    assert.ok(a.rTotal > 0);
  }
});

test('edit: change thickness of an rPerInch material', () => {
  const wall = cloneWall('W2');
  const xps = wall.layers.find((l) => l.materialId === 'xps');
  const before = analyzeWall(wall, MIXED);
  xps.thickness = 4;
  const after = analyzeWall(wall, MIXED);
  near(after.rCavityPath - before.rCavityPath, 10, 1e-9);
  assert.ok(after.rTotal > before.rTotal);
  assert.ok(faceOf(after, 'osb').tempF > faceOf(before, 'osb').tempF);
  near(after.totalThickness - before.totalThickness, 2, 1e-9);
  assertFinite(after);
  xps.thickness = 0;
  assertFinite(analyzeWall(wall, MIXED));
});

test('edit: remove the WRB', () => {
  const w3 = cloneWall('W3');
  assert.equal(analyzeWall(w3, MIXED).risk, false);
  w3.layers = w3.layers.filter((l) => l.materialId !== 'wrb');
  const a = analyzeWall(w3, MIXED);
  assertFinite(a);
  assert.equal(a.condensation.outsideWrb, false);
  assert.equal(a.risk, true);
  const w1 = cloneWall('W1');
  w1.layers = w1.layers.filter((l) => l.materialId !== 'wrb');
  assertFinite(analyzeWall(w1, MIXED));
});

test('edit: wall with no framed layer, and empty walls', () => {
  const wall = {
    id: 'X', name: 'Custom', short: 'Custom',
    layers: [
      { materialId: 'gyp_050', thickness: 0.5 },
      { materialId: 'concrete', thickness: 8 },
      { materialId: 'xps', thickness: 3 },
      { materialId: 'stucco', thickness: 0.875 },
    ],
  };
  const a = analyzeWall(wall, MIXED);
  assertFinite(a);
  assert.equal(a.rFramePath, null);
  near(a.rTotal, 0.68 + 0.45 + 0.64 + 15 + 0.18 + 0.17, 1e-9);
  assert.equal(a.rTotal, a.rCavityPath);
  assert.equal(a.framingLossPct, 0);
  const empty = analyzeWall({ layers: [] }, MIXED);
  assertFinite(empty);
  near(empty.rTotal, 0.85, 1e-9);
  assert.equal(empty.dewPlane, null);
  assert.equal(empty.condensation, null);
  assert.equal(empty.risk, false);
  assertFinite(analyzeWall({}, MIXED));
});

test('edit: steel framing without a table entry uses the fallback factor', () => {
  const wall = cloneWall('W3');
  wall.layers[1].framing = { type: 'steel', spacing: 24, depth: 4, nominalR: 15 };
  const a = analyzeWall(wall, MIXED);
  near(a.layers[1].r, 0.47 * 15, 1e-9);
  assert.match(a.layers[1].rSource, /fallback/);
  wall.layers[1].framing.spacing = 16;
  near(analyzeWall(wall, MIXED).layers[1].r, 0.40 * 15, 1e-9);
});

test('edit: summer climate on every preset wall, and a cold interior', () => {
  for (const id of Object.keys(WALLS)) {
    const a = analyzeWall(cloneWall(id), CLIMATE_PRESETS.hothumid);
    assertFinite(a);
    assert.equal(a.warmSide, 'exterior');
    assert.equal(a.risk, a.condensation !== null);
  }
  const equal = analyzeWall(cloneWall('W1'), { tIn: 60, rhIn: 100, tOut: 60, rhOut: 100 });
  assertFinite(equal);
  assert.equal(equal.q, 0);
});

test('fuzz: random layer lists never throw or give NaN', () => {
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const ids = Object.keys(MATERIALS);
  const climates = Object.values(CLIMATE_PRESETS);
  for (let n = 0; n < 300; n += 1) {
    const layers = Array.from({ length: Math.floor(rand() * 9) }, () => {
      const materialId = ids[Math.floor(rand() * ids.length)];
      const layer = { materialId, thickness: Math.round(rand() * 80) / 10 };
      if (rand() < 0.2) layer.framing = { type: rand() < 0.5 ? 'wood' : 'steel', spacing: rand() < 0.5 ? 16 : 24, depth: 3.5, nominalR: 13 };
      return layer;
    });
    const a = analyzeWall({ layers }, climates[n % climates.length]);
    assertFinite(a);
    assert.equal(a.faces.length, layers.length + 1);
  }
});
