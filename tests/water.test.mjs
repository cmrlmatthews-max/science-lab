import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FORCES, STRATEGIES, ERRORS, CONTROL_LAYERS, DIMENSIONS, WALL, STRAT, JOINT,
  traceForce, traceStrategy, traceErrors, layerRoles,
} from '../envelope/water.js';
import { MATERIALS } from '../envelope/materials.js';
import { cloneWall } from '../envelope/walls.js';

const ERR_IDS = ['reverse_lap', 'no_end_dam', 'no_weeps', 'no_gap', 'no_head_flashing'];
const finite = (p) => p.every((n) => Number.isFinite(n));
const in3d = (p) => p.length === 3 && finite(p) && p[0] >= -20 && p[0] <= 100 && p[1] >= -20 && p[1] <= 100 && p[2] >= -10 && p[2] <= 30;
const in2d = (p) => p.length === 2 && finite(p) && Math.abs(p[0]) <= 20 && Math.abs(p[1]) <= 20;

test('content ids and counts', () => {
  assert.deepEqual(FORCES.map((f) => f.id), ['momentum', 'gravity', 'tension', 'capillary', 'pressure']);
  assert.deepEqual(STRATEGIES.map((s) => s.id), ['mass', 'barrier', 'drainage', 'rainscreen']);
  assert.deepEqual(ERRORS.map((e) => e.id), ERR_IDS);
  assert.deepEqual(CONTROL_LAYERS.map((c) => c.id), ['water', 'air', 'vapor', 'thermal']);
  assert.ok(FORCES.every((f) => f.source === 'BCI 7.23' && f.defenseName && f.defense && f.problem && f.short));
  assert.deepEqual(DIMENSIONS, { weepSpacingBrick: 24, weepSpacingCmu: 32, headFlashingTurnUp: 2, flashingProjection: 0.75, flashingDripAngle: 45, minAirSpace: 2 });
  assert.ok(WALL.width === 60 && WALL.height === 60 && JOINT && STRAT.size === 48);
});

test('no errors: ok, no leaks, shed and drain paths', () => {
  const r = traceErrors([]);
  assert.equal(r.ok, true);
  assert.equal(r.leaks.length, 0);
  assert.ok(r.paths.some((p) => p.kind === 'shed'));
  assert.ok(r.paths.some((p) => p.kind === 'drain'));
  assert.ok(r.paths.every((p) => p.kind !== 'leak'));
  assert.ok(r.steps.length >= 4);
});

test('each single error gives exactly one distinct leak', () => {
  const wheres = new Set();
  const sigs = new Set();
  for (const id of ERR_IDS) {
    const r = traceErrors([id]);
    assert.equal(r.ok, false, id);
    assert.equal(r.leaks.length, 1, id);
    assert.equal(r.leaks[0].errorId, id);
    const leakPaths = r.paths.filter((p) => p.kind === 'leak');
    assert.equal(leakPaths.length, 1, id);
    assert.equal(leakPaths[0].errorId, id);
    wheres.add(r.leaks[0].where);
    sigs.add(JSON.stringify(leakPaths[0].points));
  }
  assert.equal(wheres.size, 5);
  assert.equal(sigs.size, 5);
});

test('all five errors give five leaks', () => {
  const r = traceErrors(ERR_IDS);
  assert.equal(r.ok, false);
  assert.equal(r.leaks.length, 5);
  assert.equal(r.paths.filter((p) => p.kind === 'leak').length, 5);
  assert.equal(new Set(r.leaks.map((l) => l.where)).size, 5);
});

test('every error path point is finite and inside the model', () => {
  const sets = [[], ...ERR_IDS.map((e) => [e]), ERR_IDS];
  for (const s of sets) {
    const r = traceErrors(s);
    for (const p of r.paths) {
      assert.ok(p.points.length >= 2, p.id);
      assert.ok(p.points.every(in3d), `${p.id} ${JSON.stringify(p.points)}`);
    }
    for (const l of r.leaks) {
      const q = l.patch;
      assert.ok([q.x0, q.x1, q.y0, q.y1, q.z].every(Number.isFinite));
      assert.ok(q.x0 >= 0 && q.x1 <= WALL.width && q.y0 >= 0 && q.y1 <= WALL.height);
    }
  }
});

test('forces: defense on is ok, off leaks', () => {
  for (const f of FORCES) {
    const on = traceForce(f.id, true);
    const off = traceForce(f.id, false);
    assert.equal(on.ok, true, f.id);
    assert.ok(on.path.every((p) => p.kind !== 'leak'), f.id);
    assert.equal(off.ok, false, f.id);
    assert.ok(off.path.some((p) => p.kind === 'leak'), f.id);
    assert.ok(on.steps.length >= 3 && off.steps.length >= 3);
    for (const p of [...on.path, ...off.path]) {
      assert.ok(['water', 'blocked', 'leak'].includes(p.kind));
      assert.ok(p.points.length >= 2 && p.points.every(in2d), `${f.id} ${JSON.stringify(p.points)}`);
    }
  }
});

test('strategies', () => {
  for (const s of STRATEGIES) {
    const r = traceStrategy(s.id, false);
    assert.equal(r.ok, true, s.id);
    assert.ok(r.paths.length >= 1 && r.paths.some((p) => p.kind === 'shed'));
    for (const fault of [false, true]) {
      for (const p of traceStrategy(s.id, fault).paths) {
        assert.ok(['shed', 'absorb', 'dry', 'drain', 'leak'].includes(p.kind));
        assert.ok(p.points.length >= 2 && p.points.every(in3d), `${s.id} ${p.id}`);
      }
    }
  }
  const mass = traceStrategy('mass', false);
  assert.ok(mass.paths.some((p) => p.kind === 'absorb') && mass.paths.some((p) => p.kind === 'dry'));
  assert.ok(traceStrategy('drainage', false).paths.some((p) => p.kind === 'drain'));
  assert.ok(traceStrategy('rainscreen', false).paths.some((p) => p.kind === 'drain'));
  const b = traceStrategy('barrier', true);
  assert.equal(b.ok, false);
  assert.ok(b.paths.some((p) => p.kind === 'leak'));
  assert.ok(b.paths.find((p) => p.kind === 'leak').patch);
  const rs = traceStrategy('rainscreen', true);
  assert.equal(rs.ok, true);
  assert.ok(rs.paths.every((p) => p.kind !== 'leak'));
  assert.equal(traceStrategy('drainage', true).ok, true);
  assert.equal(traceStrategy('mass', true).ok, true);
});

test('layer roles read the wall presets', () => {
  const r = layerRoles(cloneWall('W3'), MATERIALS);
  assert.equal(r.length, 7);
  for (const c of CONTROL_LAYERS) assert.ok(r.some((l) => l.roles.includes(c.id)), c.id);
  assert.ok(r.find((l) => l.materialId === 'brick').cladding);
});

test('no contractions in any text', () => {
  const strings = [];
  const walk = (v) => {
    if (typeof v === 'string') strings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk([FORCES, STRATEGIES, ERRORS, CONTROL_LAYERS]);
  for (const f of FORCES) { walk(traceForce(f.id, true).steps); walk(traceForce(f.id, false).steps); }
  for (const s of STRATEGIES) for (const fl of [true, false]) { const r = traceStrategy(s.id, fl); walk(r.steps); r.paths.forEach((p) => walk(p.label)); }
  for (const sel of [[], ...ERR_IDS.map((e) => [e]), ERR_IDS]) { const r = traceErrors(sel); walk(r.steps); r.leaks.forEach((l) => walk(l.text)); r.paths.forEach((p) => walk(p.label)); }
  assert.ok(strings.length > 60);
  for (const s of strings) {
    assert.doesNotMatch(s, /\b\w+'(t|re|ve|ll|d|s|m)\b/i, s);
    assert.ok(!s.includes("'"), s);
  }
});
