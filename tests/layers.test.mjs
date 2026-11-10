import test from 'node:test';
import assert from 'node:assert/strict';
import { createLayers, LEVELS } from '../shared/layers.js';

function make(start = 1) {
  const store = { level: start };
  const layers = createLayers({ get: () => store.level, set: (n) => { store.level = n; } });
  return { store, layers };
}

test('LEVELS has five named steps', () => {
  assert.equal(LEVELS.length, 5);
  assert.deepEqual(LEVELS.map((l) => l.n), [1, 2, 3, 4, 5]);
  assert.deepEqual(LEVELS.map((l) => l.name), ['Start', 'Story', 'Explore', 'Numbers', 'Deep']);
});

test('setLevel clamps to 1–5 and stores', () => {
  const { store, layers } = make();
  layers.setLevel(0); assert.equal(layers.level(), 1);
  layers.setLevel(9); assert.equal(layers.level(), 5); assert.equal(store.level, 5);
  layers.setLevel(-3); assert.equal(layers.level(), 1);
  layers.setLevel(2.6); assert.equal(layers.level(), 3);
  layers.setLevel(NaN); assert.equal(layers.level(), 1);
});

test('level() clamps a bad stored value', () => {
  const { store, layers } = make();
  store.level = 12; assert.equal(layers.level(), 5);
  store.level = undefined; assert.equal(layers.level(), 1);
});

test('gate: min and max on fake elements', () => {
  const { layers } = make();
  const a = layers.gate({ hidden: false }, 3);
  const b = layers.gate({ hidden: false }, 1, 2);
  const c = layers.gate({ hidden: false });
  const d = layers.gate({ hidden: false }, 2, 4);
  assert.deepEqual([a.hidden, b.hidden, c.hidden, d.hidden], [true, false, false, true]);
  layers.setLevel(2);
  assert.deepEqual([a.hidden, b.hidden, c.hidden, d.hidden], [true, false, false, false]);
  layers.setLevel(3);
  assert.deepEqual([a.hidden, b.hidden, c.hidden, d.hidden], [false, true, false, false]);
  layers.setLevel(5);
  assert.deepEqual([a.hidden, b.hidden, c.hidden, d.hidden], [false, true, false, true]);
  assert.equal(layers.gate(a, 1), a, 'gate returns the element');
});

test('gate keeps hidden true even if the mode un-hides it, after the next change', () => {
  const { layers } = make();
  const a = layers.gate({ hidden: false }, 4);
  a.hidden = false;
  layers.setLevel(2);
  assert.equal(a.hidden, true);
});

test('is(min, max)', () => {
  const { layers } = make(3);
  assert.equal(layers.is(3), true);
  assert.equal(layers.is(4), false);
  assert.equal(layers.is(1, 2), false);
  assert.equal(layers.is(2, 3), true);
});

test('gateFn runs now and on each change', () => {
  const { layers } = make();
  const calls = [];
  layers.gateFn((on) => calls.push(on), 3, 4);
  assert.deepEqual(calls, [false]);
  layers.setLevel(3);
  layers.setLevel(4);
  layers.setLevel(5);
  assert.deepEqual(calls, [false, true, true, false]);
  layers.setLevel(5); // no change, no call
  assert.equal(calls.length, 4);
});

test('onChange gets (level, prev), unsubscribe works, no call without change', () => {
  const { layers } = make();
  const seen = [];
  const off = layers.onChange((lv, prev) => seen.push([lv, prev]));
  layers.setLevel(3);
  layers.setLevel(3);
  layers.setLevel(1);
  assert.deepEqual(seen, [[3, 1], [1, 3]]);
  off();
  layers.setLevel(2);
  assert.equal(seen.length, 2);
});

test('sync picks up a level changed in the store from outside', () => {
  const { store, layers } = make();
  const el = layers.gate({ hidden: false }, 4);
  const seen = [];
  layers.onChange((lv) => seen.push(lv));
  store.level = 4;
  layers.sync();
  assert.equal(el.hidden, false);
  assert.deepEqual(seen, [4]);
});

test('reset forgets gates, gateFns and listeners but not watchers', () => {
  const { layers } = make();
  const el = layers.gate({ hidden: false }, 3);
  const seen = []; const fnCalls = []; const watched = [];
  layers.onChange((lv) => seen.push(lv));
  layers.gateFn((on) => fnCalls.push(on), 2);
  layers.watch((lv) => watched.push(lv));
  layers.reset();
  const before = fnCalls.length;
  layers.setLevel(4);
  assert.equal(el.hidden, true, 'forgotten gate is left alone');
  assert.deepEqual(seen, []);
  assert.equal(fnCalls.length, before);
  assert.deepEqual(watched, [4]);
});

test('a throwing listener does not stop the others', () => {
  const { layers } = make();
  const origErr = console.error; console.error = () => {};
  const seen = [];
  layers.onChange(() => { throw new Error('x'); });
  layers.onChange((lv) => seen.push(lv));
  layers.setLevel(2);
  console.error = origErr;
  assert.deepEqual(seen, [2]);
});

test('importing layers.js and card.js needs no document', async () => {
  assert.equal(typeof document, 'undefined');
  const card = await import('../shared/card.js');
  assert.equal(typeof card.createCard, 'function');
});
