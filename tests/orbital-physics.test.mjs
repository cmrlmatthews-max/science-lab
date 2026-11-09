import test from 'node:test';
import assert from 'node:assert/strict';
import { BODIES, BODY_ORDER, AU, G0, ORBIT_PRESETS, TRANSFER_PRESETS } from '../orbital/bodies.js';
import * as P from '../orbital/physics.js';

const { earth, moon, mars, sun } = BODIES;

function near(actual, expected, rel = 1e-3, label = '') {
  const err = Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-300);
  assert.ok(err <= rel, `${label} expected ${expected}, got ${actual} (rel err ${err})`);
}

function energyOf(mu, r, v) {
  return (v[0] * v[0] + v[1] * v[1]) / 2 - mu / Math.hypot(r[0], r[1]);
}

function launchElements(body, alt, speed, angle = 0) {
  const s = P.launchState(body, alt, speed, angle);
  return { s, el: P.elementsFromState(body.mu, s.r, s.v) };
}

test('bodies data', () => {
  assert.equal(G0, 9.80665e-3);
  assert.equal(AU, 149597870.7);
  assert.deepEqual(BODY_ORDER, ['earth', 'moon', 'mars', 'sun']);
  for (const id of BODY_ORDER) {
    assert.equal(BODIES[id].id, id);
    assert.ok(ORBIT_PRESETS[id].length > 0 && TRANSFER_PRESETS[id].length > 0);
  }
  assert.equal(earth.mu, 398600.4418);
  assert.equal(sun.parent, null);
  assert.equal(moon.parent, 'earth');
});

test('surface speeds', () => {
  near(P.circularSpeed(earth.mu, earth.radius), 7.9054, 1e-3, 'earth circ');
  near(P.escapeSpeed(earth.mu, earth.radius), 11.1799, 1e-3, 'earth esc');
  near(P.circularSpeed(moon.mu, moon.radius), 1.6799, 1e-3, 'moon circ');
  near(P.escapeSpeed(moon.mu, moon.radius), 2.3757, 1e-3, 'moon esc');
  near(P.circularSpeed(mars.mu, mars.radius), 3.5512, 1e-3, 'mars circ');
  near(P.escapeSpeed(mars.mu, mars.radius), 5.0221, 1e-3, 'mars esc');
  near(P.escapeSpeed(sun.mu, sun.radius), 617.67, 1e-3, 'sun esc');
});

test('Earth at 400 km', () => {
  const r = earth.radius + 400;
  near(P.circularSpeed(earth.mu, r), 7.6686, 1e-3, 'circ');
  near(P.period(earth.mu, r), 5553.6, 1e-3, 'period');
  near(P.period(earth.mu, r) / 60, 92.56, 1e-3, 'period min');
  near(P.escapeSpeed(earth.mu, r), 10.845, 1e-3, 'esc');
  near(P.visViva(earth.mu, r, r), 7.6686, 1e-3, 'vis-viva circular');
  near(P.visViva(earth.mu, r, Infinity), 10.845, 1e-3, 'vis-viva parabola');
  assert.equal(P.period(earth.mu, -5), Infinity);
});

test('geostationary', () => {
  near(P.circularSpeed(earth.mu, 42164), 3.0747, 1e-3, 'speed');
  near(P.period(earth.mu, 42164) / 3600, 23.934, 1e-3, 'period h');
});

test('Molniya ellipse from apsides', () => {
  const el = P.elementsFromApsides(earth.mu, earth.radius + 500, earth.radius + 39873);
  near(el.a, 26564.6, 1e-3, 'a');
  near(el.e, 0.7411, 1e-3, 'e');
  near(el.period / 3600, 11.969, 1e-3, 'period h');
  near(el.vp, 10.0448, 1e-3, 'vp');
  near(el.va, 1.4938, 1e-3, 'va');
  near(el.h, el.rp * el.vp, 1e-12, 'h');
  near(el.energy, -earth.mu / (2 * el.a), 1e-12, 'energy');
});

test('launch from Earth at 400 km, horizontal', () => {
  const R = earth.radius;
  let { s, el } = launchElements(earth, 400, 7.0);
  near(el.a, 5809.4, 1e-3, 'a 7.0');
  near(el.e, 0.1668, 1e-3, 'e 7.0');
  near(el.rp - R, -1537.6, 1e-3, 'pe alt 7.0');
  assert.equal(P.classifyTrajectory(earth, el), 'impact');
  assert.ok(el.h < 0, 'launch is clockwise');
  near(el.h, s.r[0] * s.v[1] - s.r[1] * s.v[0], 1e-12, 'signed h');

  ({ el } = launchElements(earth, 400, 9.0));
  near(el.a, 10886.7, 1e-3, 'a 9.0');
  near(el.e, 0.3774, 1e-3, 'e 9.0');
  near(el.rp - R, 400.0, 1e-3, 'pe alt 9.0');
  near(el.ra - R, 8617.1, 1e-3, 'ap alt 9.0');
  near(el.period / 3600, 3.140, 1e-3, 'period 9.0');
  assert.equal(P.classifyTrajectory(earth, el), 'orbit');
  assert.ok(Math.abs(el.nu) < 1e-9, 'horizontal launch at 9.0 starts at periapsis');

  ({ el } = launchElements(earth, 400, 10.9));
  assert.equal(el.type, 'hyperbola');
  assert.equal(P.classifyTrajectory(earth, el), 'escape');
  assert.equal(el.ra, Infinity);
  assert.equal(el.period, Infinity);

  ({ el } = launchElements(earth, 400, 7.6686));
  assert.ok(el.e < 1e-3, 'circular');
  assert.equal(P.classifyTrajectory(earth, el), 'orbit');
});

test('classify: decay and atmosphere', () => {
  const el = P.elementsFromApsides(earth.mu, earth.radius + 50, earth.radius + 500);
  assert.equal(P.classifyTrajectory(earth, el), 'decay');
  const moonEl = P.elementsFromApsides(moon.mu, moon.radius + 1, moon.radius + 100);
  assert.equal(P.classifyTrajectory(moon, moonEl), 'orbit');
});

test('Hohmann transfers', () => {
  let h = P.hohmann(earth.mu, earth.radius + 300, 42164);
  near(h.dv1, 2.4257, 1e-3, 'dv1'); near(h.dv2, 1.4668, 1e-3, 'dv2');
  near(h.total, 3.8926, 1e-3, 'total'); near(h.time / 3600, 5.275, 1e-3, 'time h');
  assert.equal(h.direction, 'up');

  h = P.hohmann(earth.mu, earth.radius + 300, 384400);
  near(h.dv1, 3.1064, 1e-3, 'dv1'); near(h.dv2, 0.8301, 1e-3, 'dv2');
  near(h.total, 3.9365, 1e-3, 'total'); near(h.time / 86400, 4.98, 1e-3, 'time days');

  h = P.hohmann(sun.mu, AU, 227939366);
  near(h.dv1, 2.9447, 1e-3, 'dv1'); near(h.dv2, 2.6489, 1e-3, 'dv2');
  near(h.total, 5.5936, 1e-3, 'total'); near(h.time / 86400, 258.9, 1e-3, 'time days');
  near(P.period(sun.mu, AU) / 86400, 365.257, 1e-3, 'earth year');
  near(P.circularSpeed(sun.mu, AU), 29.785, 1e-3, 'earth speed');
});

test('Hohmann downward', () => {
  const up = P.hohmann(earth.mu, 7000, 42164);
  const down = P.hohmann(earth.mu, 42164, 7000);
  assert.equal(down.direction, 'down');
  assert.ok(down.dv1 > 0 && down.dv2 > 0);
  near(down.total, up.total, 1e-12, 'symmetric total');
  near(down.dv1, up.dv2, 1e-12, 'dv swap');
  const same = P.hohmann(earth.mu, 7000, 7000);
  assert.ok(same.total < 1e-12);
});

test('propellant fraction and durations', () => {
  near(P.propellantFraction(3.8933, 450), 0.5861, 1e-3, '450 s');
  near(P.propellantFraction(3.8933, 300), 0.7338, 1e-3, '300 s');
  assert.equal(P.propellantFraction(0, 300), 0);
  assert.deepEqual(P.formatDuration(90), { value: 90, unit: 's' });
  assert.deepEqual(P.formatDuration(120), { value: 2, unit: 'min' });
  assert.equal(P.formatDuration(179 * 60).unit, 'min');
  assert.deepEqual(P.formatDuration(180 * 60), { value: 3, unit: 'h' });
  assert.equal(P.formatDuration(71 * 3600).unit, 'h');
  assert.deepEqual(P.formatDuration(72 * 3600), { value: 3, unit: 'days' });
  assert.equal(P.formatDuration(Infinity).unit, 'days');
});

test('solveKepler', () => {
  for (const e of [0, 0.1, 0.5, 0.9, 0.999]) {
    for (const M of [-7, -3, -1, -1e-9, 0, 1e-9, 0.5, 2, 3.1, 4, 10, 100]) {
      const E = P.solveKepler(M, e);
      assert.ok(Math.abs(E - e * Math.sin(E) - M) < 1e-12, `e=${e} M=${M}`);
    }
  }
});

test('positionAtTime returns to periapsis and reaches apoapsis, both senses', () => {
  for (const sense of [1, -1]) {
    const el = P.elementsFromApsides(earth.mu, 7000, 30000);
    el.argPeri = 0.7;
    el.h *= sense;
    const T = el.period;
    const peri = [7000 * Math.cos(0.7), 7000 * Math.sin(0.7)];
    const back = P.positionAtTime(earth.mu, el, T);
    near(back.r[0], peri[0], 1e-6, 'x'); near(back.r[1], peri[1], 1e-6, 'y');
    near(back.speed, el.vp, 1e-6, 'speed');
    const half = P.positionAtTime(earth.mu, el, T / 2);
    near(half.rMag, 30000, 1e-6, 'apoapsis distance');
    near(Math.hypot(...half.r), 30000, 1e-6, 'apoapsis vector');
    near(half.speed, el.va, 1e-6, 'va');
    const quarter = P.positionAtTime(earth.mu, el, T / 4);
    const cross = quarter.r[0] * quarter.v[1] - quarter.r[1] * quarter.v[0];
    assert.equal(Math.sign(cross), sense, 'direction of motion');
  }
});

test('positionAtTime matches propagate and timeSincePeriapsis', () => {
  const { s, el } = launchElements(earth, 400, 8.5, 20);
  const t0 = P.timeSincePeriapsis(earth.mu, el, el.nu);
  for (const dt of [100, 1500, 4000, 9000, 25000]) {
    const a = P.positionAtTime(earth.mu, el, t0 + dt);
    const b = P.propagate(earth.mu, s.r, s.v, dt);
    assert.ok(Math.hypot(a.r[0] - b.r[0], a.r[1] - b.r[1]) < 1e-3, `r dt=${dt}`);
    assert.ok(Math.hypot(a.v[0] - b.v[0], a.v[1] - b.v[1]) < 1e-6, `v dt=${dt}`);
  }
});

test('propagate: one LEO period in 1000 steps', () => {
  const r0 = earth.radius + 400;
  const v0 = P.circularSpeed(earth.mu, r0);
  const T = P.period(earth.mu, r0);
  let r = [r0, 0], v = [0, v0];
  const e0 = energyOf(earth.mu, r, v);
  for (let i = 0; i < 1000; i++) ({ r, v } = P.propagate(earth.mu, r, v, T / 1000));
  assert.ok(Math.hypot(r[0] - r0, r[1]) < 1, 'returns to start');
  near(energyOf(earth.mu, r, v), e0, 1e-6, 'energy');
});

test('propagate: eccentric clockwise ellipse and negative dt', () => {
  const { s, el } = launchElements(earth, 400, 9.0);
  const fwd = P.propagate(earth.mu, s.r, s.v, el.period * 2.37);
  const back = P.propagate(earth.mu, fwd.r, fwd.v, -el.period * 2.37);
  assert.ok(Math.hypot(back.r[0] - s.r[0], back.r[1] - s.r[1]) < 1e-3);
  near(energyOf(earth.mu, fwd.r, fwd.v), energyOf(earth.mu, s.r, s.v), 1e-9, 'energy');
});

test('propagate: hyperbola keeps energy and r grows after periapsis', () => {
  const { s } = launchElements(earth, 400, 10.9);
  const e0 = energyOf(earth.mu, s.r, s.v);
  let r = s.r, v = s.v, last = Math.hypot(...r);
  for (let i = 0; i < 200; i++) {
    ({ r, v } = P.propagate(earth.mu, r, v, 600));
    const d = Math.hypot(...r);
    assert.ok(d > last, `r grows at step ${i}`);
    last = d;
  }
  near(energyOf(earth.mu, r, v), e0, 1e-6, 'energy');
  const big = P.propagate(earth.mu, s.r, s.v, 1e7);
  near(energyOf(earth.mu, big.r, big.v), e0, 1e-6, 'energy for a huge step');
});

test('propagate: parabola, inbound hyperbola and zero dt', () => {
  const r = [7000, 0];
  const v = [0, P.escapeSpeed(earth.mu, 7000)];
  const out = P.propagate(earth.mu, r, v, 5000);
  assert.ok(Math.abs(energyOf(earth.mu, out.r, out.v)) < 1e-6);
  const inbound = P.propagate(earth.mu, [1e5, 1e5], [-5, -1], 20000);
  assert.ok(Number.isFinite(inbound.r[0]) && Number.isFinite(inbound.v[0]));
  assert.deepEqual(P.propagate(earth.mu, r, v, 0), { r, v });
});

test('propagate: radial fall stays finite and matches energy before the center', () => {
  const s = P.launchState(earth, 400, 3, 90);
  const out = P.propagate(earth.mu, s.r, s.v, 600);
  assert.ok(out.r.every(Number.isFinite) && out.v.every(Number.isFinite));
  near(energyOf(earth.mu, out.r, out.v), energyOf(earth.mu, s.r, s.v), 1e-6, 'energy');
  const rest = P.propagate(earth.mu, [7000, 0], [0, 0], 2000);
  assert.ok(rest.r.every(Number.isFinite) && rest.v.every(Number.isFinite));
  const through = P.propagate(earth.mu, [7000, 0], [0, 0], 1e5);
  assert.ok(through.r.every(Number.isFinite) && through.v.every(Number.isFinite));
});

test('samplePath: ellipse satisfies the conic equation, both senses, closed and ordered', () => {
  for (const alt of [[500, 39873], [400, 400], [100, 6000]]) {
    for (const sense of [1, -1]) {
      const el = P.elementsFromApsides(earth.mu, earth.radius + alt[0], earth.radius + alt[1]);
      el.argPeri = 2.1;
      el.h *= sense;
      const pts = P.samplePath(earth.mu, el, 360);
      assert.equal(pts.length, 360);
      let prev = null;
      let turn = 0;
      pts.forEach((p) => {
        const r = Math.hypot(...p);
        const nu = sense * (Math.atan2(p[1], p[0]) - el.argPeri);
        near(r, el.a * (1 - el.e * el.e) / (1 + el.e * Math.cos(nu)), 1e-6, 'conic');
        if (prev) turn += sense * Math.asin(Math.max(-1, Math.min(1, (prev[0] * p[1] - prev[1] * p[0]) / (Math.hypot(...prev) * r))));
        prev = p;
      });
      assert.ok(turn > 0 && turn < 2 * Math.PI, 'advances in the direction of motion');
      const first = pts[0];
      near(Math.hypot(...first), el.rp, 1e-9, 'starts at periapsis');
    }
  }
});

test('samplePath: arcs and open conics', () => {
  const el = P.elementsFromApsides(earth.mu, 7000, 30000);
  const arc = P.samplePath(earth.mu, el, 50, { fromNu: 0, toNu: Math.PI });
  assert.equal(arc.length, 50);
  near(Math.hypot(...arc[0]), 7000, 1e-9, 'arc start');
  near(Math.hypot(...arc[49]), 30000, 1e-9, 'arc end');
  const wrapArc = P.samplePath(earth.mu, el, 20, { fromNu: 3, toNu: -3 });
  near(Math.hypot(...wrapArc[0]), Math.hypot(...P.samplePath(earth.mu, el, 2, { fromNu: 3, toNu: 3.1 })[0]), 1e-9, 'wrap start');
  near(Math.hypot(...wrapArc[19]), Math.hypot(...P.samplePath(earth.mu, el, 2, { fromNu: -3, toNu: -2.9 })[0]), 1e-9, 'wrap end');

  const { el: hyp } = launchElements(earth, 400, 10.9);
  const pts = P.samplePath(earth.mu, hyp, 101, { rMax: 500000 });
  assert.equal(pts.length, 101);
  near(Math.hypot(...pts[0]), 500000, 1e-6, 'start at rMax');
  near(Math.hypot(...pts[100]), 500000, 1e-6, 'end at rMax');
  const mid = pts[50];
  near(Math.hypot(...mid), hyp.rp, 1e-6, 'periapsis in the middle');
  const p = hyp.rp * (1 + hyp.e);
  pts.forEach((q) => {
    const nu = -Math.sign(hyp.h) * (Math.atan2(q[1], q[0]) - hyp.argPeri);
    const wrapped = Math.atan2(Math.sin(nu), Math.cos(nu));
    near(Math.hypot(...q), p / (1 + hyp.e * Math.cos(wrapped)), 1e-6, 'hyperbola conic');
  });
  const sub = P.samplePath(earth.mu, hyp, 10, { rMax: 500000, fromNu: 0, toNu: 1 });
  near(Math.hypot(...sub[0]), hyp.rp, 1e-9, 'sub arc start');

  const parab = P.elementsFromState(earth.mu, [7000, 0], [0, P.escapeSpeed(earth.mu, 7000)]);
  assert.equal(parab.type, 'parabola');
  const pp = P.samplePath(earth.mu, parab, 21, { rMax: 100000 });
  near(Math.hypot(...pp[0]), 100000, 1e-6, 'parabola start');
  near(Math.hypot(...pp[10]), 7000, 1e-6, 'parabola periapsis');
});

test('impactPoint: first crossing, direction of motion, time agrees with propagate', () => {
  const { s, el } = launchElements(earth, 400, 7.0);
  const hit = P.impactPoint(earth, el, el.nu);
  assert.ok(hit);
  near(Math.hypot(...hit.r), earth.radius, 1e-9, 'on the surface');
  assert.ok(hit.t > 0 && hit.t < el.period / 2);
  const end = P.propagate(earth.mu, s.r, s.v, hit.t);
  assert.ok(Math.hypot(end.r[0] - hit.r[0], end.r[1] - hit.r[1]) < 1e-3, 'same place as propagate');
  near(Math.hypot(...end.r), earth.radius, 1e-9, 'propagated radius');
  assert.ok(end.r[0] > 0, 'clockwise from +y: lands at positive x');

  assert.equal(P.impactPoint(earth, P.elementsFromApsides(earth.mu, 7000, 9000), 0), null);

  const { s: s2, el: el2 } = launchElements(earth, 400, 8.0, 30);
  const hit2 = P.impactPoint(earth, el2, el2.nu);
  const end2 = P.propagate(earth.mu, s2.r, s2.v, hit2.t);
  assert.ok(Math.hypot(end2.r[0] - hit2.r[0], end2.r[1] - hit2.r[1]) < 1e-3, 'angled launch');
  assert.ok(Math.abs(hit2.nu) < Math.PI + 1e-9);
  assert.ok(P.classifyTrajectory(earth, el2) !== 'escape');

  const { s: s3, el: el3 } = launchElements(earth, 400, 8.0, -10);
  assert.equal(el3.inbound, true);
  const hit3 = P.impactPoint(earth, el3, el3.nu);
  const end3 = P.propagate(earth.mu, s3.r, s3.v, hit3.t);
  assert.ok(Math.hypot(end3.r[0] - hit3.r[0], end3.r[1] - hit3.r[1]) < 1e-3, 'downward launch');
});

test('impactPoint: counter-clockwise motion and hyperbola', () => {
  const r = [0, earth.radius + 400];
  const ccw = P.elementsFromState(earth.mu, r, [-7, 0]);
  assert.ok(ccw.h > 0);
  const hit = P.impactPoint(earth, ccw, ccw.nu);
  const end = P.propagate(earth.mu, r, [-7, 0], hit.t);
  assert.ok(Math.hypot(end.r[0] - hit.r[0], end.r[1] - hit.r[1]) < 1e-3);
  assert.ok(end.r[0] < 0);

  const inbound = P.elementsFromState(earth.mu, [60000, 20000], [-9, -2]);
  assert.equal(inbound.type, 'hyperbola');
  assert.ok(inbound.rp < earth.radius);
  assert.equal(P.classifyTrajectory(earth, inbound), 'impact');
  const h2 = P.impactPoint(earth, inbound, inbound.nu);
  const e2 = P.propagate(earth.mu, [60000, 20000], [-9, -2], h2.t);
  assert.ok(Math.hypot(e2.r[0] - h2.r[0], e2.r[1] - h2.r[1]) < 1e-2);
  assert.ok(h2.nu < 0, 'inbound crossing comes first');
  const exit = P.impactPoint(earth, inbound, h2.nu);
  near(exit.nu, -h2.nu, 1e-9, 'exit crossing is symmetric');
  assert.equal(P.impactPoint(earth, inbound, exit.nu), null, 'nothing after the exit on an open conic');
});

test('degenerate states', () => {
  // exactly circular
  const circ = P.elementsFromState(earth.mu, [7000, 0], [0, P.circularSpeed(earth.mu, 7000)]);
  assert.ok(circ.e < 1e-10);
  assert.equal(circ.nu, 0);
  near(circ.argPeri, 0, 1, 'argPeri'); assert.ok(Math.abs(circ.argPeri) < 1e-12);
  assert.ok(circ.h > 0);
  // radial up
  const up = launchElements(earth, 400, 5, 90).el;
  assert.equal(up.rp, 0); assert.equal(up.h, 0); assert.equal(up.type, 'ellipse');
  assert.equal(P.classifyTrajectory(earth, up), 'impact');
  assert.ok(Number.isFinite(up.ra) && up.ra > earth.radius);
  const upHit = P.impactPoint(earth, up, up.nu);
  assert.ok(upHit && upHit.t > 0);
  near(Math.hypot(...upHit.r), earth.radius, 1e-9, 'radial impact on surface');
  assert.ok(Math.abs(upHit.r[0]) < 1e-6 && upHit.r[1] > 0, 'lands straight below');
  const stateAtHit = P.propagate(earth.mu, ...(() => { const s = P.launchState(earth, 400, 5, 90); return [s.r, s.v]; })(), upHit.t);
  near(Math.hypot(...stateAtHit.r), earth.radius, 5e-3, 'RK4 agrees on radial impact time');
  // radial escape
  const out = launchElements(earth, 400, 11, 90).el;
  assert.equal(out.type, 'hyperbola');
  assert.equal(P.classifyTrajectory(earth, out), 'escape');
  assert.equal(P.impactPoint(earth, out, out.nu), null);
  // radial inbound hyperbola reaches the surface
  const falling = P.elementsFromState(earth.mu, [0, 20000], [0, -11]);
  assert.equal(P.classifyTrajectory(earth, falling), 'impact');
  assert.ok(P.impactPoint(earth, falling, falling.nu).t > 0);
  // speed 0
  const rest = P.elementsFromState(earth.mu, [0, 8000], [0, 0]);
  assert.equal(rest.type, 'ellipse');
  near(rest.a, 4000, 1e-12, 'a'); near(rest.ra, 8000, 1e-12, 'ra');
  assert.equal(P.classifyTrajectory(earth, rest), 'impact');
  assert.ok(P.impactPoint(earth, rest, rest.nu).t > 0);
  // near parabolic
  const v = P.escapeSpeed(earth.mu, 7000);
  for (const f of [1, 1 + 1e-12, 1 - 1e-12]) {
    const el = P.elementsFromState(earth.mu, [7000, 0], [0, v * f]);
    assert.equal(el.type, 'parabola');
    assert.equal(el.a, Infinity); assert.equal(el.ra, Infinity); assert.equal(el.period, Infinity);
    assert.ok(Number.isFinite(el.rp));
  }
  // radial samplePath
  const line = P.samplePath(earth.mu, up, 5);
  assert.equal(line.length, 5);
  assert.ok(line.flat().every(Number.isFinite));
});

test('fuzz: finite outputs around every body (500 seeded cases each)', () => {
  let seed = 123456789;
  const rand = () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const finite = (x, what) => assert.ok(Number.isFinite(x), `${what} not finite: ${x}`);
  const finiteOrInf = (x, what) => assert.ok(Number.isFinite(x) || x === Infinity, `${what} bad: ${x}`);
  for (const id of BODY_ORDER) {
    const body = BODIES[id];
    for (let i = 0; i < 500; i++) {
      const r = body.radius * (1 + 0.001 * Math.pow(10, 4 * rand()));
      const esc = P.escapeSpeed(body.mu, r);
      const mode = i % 5;
      let state;
      if (mode === 0) state = P.launchState(body, r - body.radius, esc * 1.6 * rand(), 360 * rand() - 180);
      else if (mode === 1) state = P.launchState(body, r - body.radius, esc * rand(), 90 * Math.round(rand() * 4 - 2));
      else {
        const th = 2 * Math.PI * rand(), vth = 2 * Math.PI * rand(), sp = esc * 1.5 * rand();
        state = { r: [r * Math.cos(th), r * Math.sin(th)], v: [sp * Math.cos(vth), sp * Math.sin(vth)] };
      }
      const el = P.elementsFromState(body.mu, state.r, state.v);
      for (const k of ['e', 'rp', 'energy', 'h', 'argPeri', 'nu', 'rMag']) finite(el[k], k);
      for (const k of ['a', 'ra', 'period']) finiteOrInf(el[k], k);
      assert.ok(['impact', 'decay', 'orbit', 'escape'].includes(P.classifyTrajectory(body, el)));
      assert.ok(el.rp >= 0 && el.e >= 0);

      const natural = Math.sqrt(r * r * r / body.mu);
      const dt = (rand() * 2 - 1) * 40 * natural;
      const next = P.propagate(body.mu, state.r, state.v, dt);
      next.r.concat(next.v).forEach((x) => finite(x, 'propagate'));

      P.samplePath(body.mu, el, 64, { rMax: 50 * r }).flat().forEach((x) => finite(x, 'samplePath'));
      P.samplePath(body.mu, el, 16, { fromNu: -1, toNu: 2 }).flat().forEach((x) => finite(x, 'samplePath arc'));

      const hit = P.impactPoint(body, el, el.nu);
      if (hit) { finite(hit.nu, 'hit nu'); finite(hit.t, 'hit t'); hit.r.forEach((x) => finite(x, 'hit r')); assert.ok(hit.t >= 0); }
      if (el.type === 'ellipse') {
        const pos = P.positionAtTime(body.mu, el, (rand() * 3 - 1) * el.period);
        pos.r.concat(pos.v, [pos.nu, pos.rMag, pos.speed]).forEach((x) => finite(x, 'positionAtTime'));
        finite(P.timeSincePeriapsis(body.mu, el, el.nu), 'timeSincePeriapsis');
      }
      const h = P.hohmann(body.mu, r, r * (0.1 + 20 * rand()));
      for (const k of ['dv1', 'dv2', 'total', 'time', 'aT', 'eT']) finite(h[k], k);
      assert.ok(h.dv1 >= 0 && h.dv2 >= 0);
    }
  }
});
