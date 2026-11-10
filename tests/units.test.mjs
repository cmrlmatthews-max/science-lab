import test from 'node:test';
import assert from 'node:assert/strict';
import { dual, friendlyDuration, nice } from '../shared/units.js';

test('nice: 3 significant figures with separators', () => {
  assert.equal(nice(17155.8), '17,200');
  assert.equal(nice(7.6712), '7.67');
  assert.equal(nice(248.55), '249');
  assert.equal(nice(0.3107), '0.311');
  assert.equal(nice(0), '0');
  assert.equal(nice(1234567), '1,230,000');
  assert.equal(nice(NaN), '—');
});

test('dual.kmps: LEO speed', () => {
  const d = dual.kmps(7.67);
  assert.equal(d.us, '17,200 mph');
  assert.equal(d.si, '7.67 km/s');
  assert.equal(d.text, '17,200 mph (7.67 km/s)');
});

test('dual.km: 400 km is 249 mi (3 significant figures)', () => {
  const d = dual.km(400);
  assert.equal(d.us, '249 mi');
  assert.equal(d.si, '400 km');
  assert.equal(d.text, '249 mi (400 km)');
  assert.equal(dual.km(35786).us, '22,200 mi');
  assert.equal(dual.km(1.609344).us, '1 mi');
});

test('dual.km: digits sets metric decimals', () => {
  assert.equal(dual.km(6371, 0).si, '6,371 km');
  assert.equal(dual.km(2.5, 1).si, '2.5 km');
});

test('dual.mps, kg, celsius, gcc', () => {
  assert.equal(dual.mps(100).us, '224 mph');
  assert.equal(dual.mps(100).si, '100 m/s');
  assert.equal(dual.kg(1000).us, '2,200 lb');
  assert.equal(dual.kg(1000).si, '1,000 kg');
  assert.equal(dual.celsius(100).us, '212°F');
  assert.equal(dual.celsius(100).si, '100°C');
  assert.equal(dual.celsius(-18).us, '−0.4°F');
  assert.equal(dual.celsius(0).text, '32°F (0°C)');
  assert.equal(dual.gcc(1).us, '62.4 lb/ft³');
  assert.equal(dual.gcc(7.87).us, '491 lb/ft³');
  assert.equal(dual.gcc(7.87).text, '491 lb/ft³ (7.87 g/cm³)');
});

test('dual.angstrom has no US value', () => {
  const d = dual.angstrom(0.96);
  assert.equal(d.us, null);
  assert.equal(d.si, '0.96 Å');
  assert.equal(d.alt, '0.096 nm');
  assert.equal(d.text, '0.96 Å (0.096 nm)');
});

test('friendlyDuration', () => {
  assert.equal(friendlyDuration(45), '45 seconds');
  assert.equal(friendlyDuration(92.6 * 60), '93 minutes');
  assert.equal(friendlyDuration(60), '60 seconds');
  assert.equal(friendlyDuration(5.3 * 3600), '5.3 hours');
  assert.equal(friendlyDuration(86400 * 12), '12 days');
  assert.equal(friendlyDuration(8.5 * 30.4375 * 86400), '8.5 months');
  assert.equal(friendlyDuration(86400 * 365 * 3), '3 years');
  assert.equal(friendlyDuration(3600 * 1.0 + 7200), '3 hours');
  assert.equal(friendlyDuration(Infinity), '—');
});
