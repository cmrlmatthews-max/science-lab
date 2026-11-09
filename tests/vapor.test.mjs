import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloneWall } from '../envelope/walls.js';
import { VAPOR_CLASSES, CLIMATE_ZONES, checkVaporRetarder } from '../envelope/vapor.js';

const codes = (r) => r.warnings.map((w) => w.code);
const check = (id, cls, zone) => checkVaporRetarder({ cls, zone, wall: cloneWall(id) });

test('constants', () => {
  assert.deepEqual(CLIMATE_ZONES.map((z) => z.id), ['1', '2', '3', '4', '4M', '5', '6', '7', '8']);
  assert.equal(CLIMATE_ZONES.find((z) => z.id === '4M').name, 'Marine 4');
  assert.equal(VAPOR_CLASSES.I.name, 'Class I');
  assert.equal(VAPOR_CLASSES.II.perms, 'Above 0.1, up to 1.0');
  assert.ok(VAPOR_CLASSES.none && VAPOR_CLASSES.III);
});

test('W1 zone 5 with no retarder warns', () => {
  const r = check('W1', 'none', '5');
  assert.equal(r.ok, false);
  assert.deepEqual(codes(r), ['ZONE_NEEDS_I_II']);
  assert.equal(r.foam, null);
  assert.equal(r.source, 'BCI 7.46');
  assert.ok(r.notes.includes('Put the vapor retarder on the warm side of the insulation.'));
});

test('W1 zone 2 Class I or II warns', () => {
  assert.deepEqual(codes(check('W1', 'I', '2')), ['ZONE_NO_I_II']);
  assert.deepEqual(codes(check('W1', 'II', '1')), ['ZONE_NO_I_II']);
  assert.equal(check('W1', 'III', '2').ok, true);
  assert.equal(check('W1', 'none', '1').ok, true);
});

test('W1 zones 3 and 4', () => {
  assert.equal(check('W1', 'II', '3').ok, true);
  assert.deepEqual(codes(check('W1', 'I', '3')), ['ZONE_NO_I']);
  assert.deepEqual(codes(check('W1', 'I', '4')), ['ZONE_NO_I']);
  assert.equal(check('W1', 'none', '4').ok, true);
});

test('cold zones need Class I or II', () => {
  for (const zone of ['4M', '5', '6', '7', '8']) {
    assert.deepEqual(codes(check('W1', 'III', zone)), ['ZONE_NEEDS_I_II'], zone);
    assert.equal(check('W1', 'I', zone).ok, true, zone);
    assert.equal(check('W1', 'II', zone).ok, true, zone);
  }
});

test('W2 exterior XPS: Class I or II gets the foam warning in every zone', () => {
  for (const { id: zone } of CLIMATE_ZONES) {
    for (const cls of ['I', 'II']) {
      const r = check('W2', cls, zone);
      assert.ok(codes(r).includes('FOAM_CLASS_III_ONLY'), `${cls} zone ${zone}`);
      assert.equal(r.ok, false);
    }
  }
  const r = check('W2', 'I', '5');
  assert.equal(r.foam.materialId, 'xps');
  assert.ok(Math.abs(r.foam.perms - 0.6) < 1e-9);
});

test('W2 with foam: Class III is allowed in cold zones', () => {
  for (const zone of ['4M', '5', '8']) {
    const r = check('W2', 'III', zone);
    assert.deepEqual(codes(r), [], zone);
    assert.equal(r.ok, true);
  }
  assert.deepEqual(codes(check('W2', 'none', '5')), ['ZONE_NEEDS_I_II']);
});

test('W3 steel stud wall follows the frame rules and has no foam', () => {
  const r = check('W3', 'none', '6');
  assert.deepEqual(codes(r), ['ZONE_NEEDS_I_II']);
  assert.equal(r.foam, null);
  assert.equal(check('W3', 'I', '6').ok, true);
});

test('W4 is not a frame wall', () => {
  const r = check('W4', 'I', '2');
  assert.equal(r.ok, true);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.notes, ['The class rules in BCI 7.46 are for frame walls.']);
});

test('warnings carry readable text', () => {
  for (const w of check('W2', 'I', '2').warnings) assert.ok(w.text.length > 10);
});

test('numeric zone values and empty walls do not throw', () => {
  assert.equal(checkVaporRetarder({ cls: 'II', zone: 3, wall: cloneWall('W1') }).ok, true);
  assert.equal(checkVaporRetarder({ cls: 'none', zone: '5', wall: { layers: [] } }).ok, true);
});
