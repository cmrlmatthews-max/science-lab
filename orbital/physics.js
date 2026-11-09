// Two-body orbital mechanics. Pure functions, no DOM, no Three.js.
//
// Conventions
//  - State vectors are 2D [x, y] in the orbit plane, km and km/s.
//  - Angles are radians unless a name ends in Deg.
//  - h = x*vy - y*vx is signed (+ counter-clockwise). Launches that start on the
//    +y axis and move toward +x are clockwise (h < 0).
//  - True anomaly nu is measured from periapsis IN THE DIRECTION OF MOTION, so
//    nu increases with time for both senses of rotation. The angle of a
//    position on the plane is argPeri + sign(h) * nu.
//  - Radial trajectories (h = 0) are degenerate: e = 1, rp = 0, periapsis lies
//    at the body center, argPeri points opposite to the outward direction and
//    nu = pi everywhere on the line.

import { G0 } from './bodies.js';

const TWO_PI = 2 * Math.PI;
const RADIAL_TOL = 1e-9;     // |h| below this fraction of r*speed counts as radial
const CIRCULAR_TOL = 1e-10;  // e below this counts as exactly circular
const PARABOLA_TOL = 1e-9;   // |e - 1| below this counts as a parabola
const ENERGY_TOL = 1e-12;    // radial energy tolerance, relative to mu / r
const MAX_RK4_STEPS = 200000; // sub-step budget of the radial fallback

/** Wrap an angle into [-pi, pi). */
function wrapPi(x) {
  return x - TWO_PI * Math.floor((x + Math.PI) / TWO_PI);
}

/** +1 for counter-clockwise (or radial) motion, -1 for clockwise. */
function direction(el) {
  return el.h < 0 ? -1 : 1;
}

/** Circular orbit speed at distance r from the center, km/s. */
export function circularSpeed(mu, r) {
  return Math.sqrt(mu / r);
}

/** Escape speed at distance r from the center, km/s. */
export function escapeSpeed(mu, r) {
  return Math.sqrt(2 * mu / r);
}

/** Speed at distance r on an orbit with semi-major axis a (a < 0 or Infinity allowed), km/s. */
export function visViva(mu, r, a) {
  const inverseA = Number.isFinite(a) ? 1 / a : 0;
  return Math.sqrt(Math.max(0, mu * (2 / r - inverseA)));
}

/** Orbital period in seconds for semi-major axis a; Infinity when a is not a positive finite number. */
export function period(mu, a) {
  return a > 0 && Number.isFinite(a) ? TWO_PI * Math.sqrt(a * a * a / mu) : Infinity;
}

/** Elements of a counter-clockwise ellipse (periapsis on +x) from periapsis and apoapsis distances (km from the center). */
export function elementsFromApsides(mu, rp, ra) {
  const lo = Math.min(rp, ra);
  const hi = Math.max(rp, ra);
  const a = (lo + hi) / 2;
  const e = (hi - lo) / (hi + lo);
  const vp = visViva(mu, lo, a);
  const va = visViva(mu, hi, a);
  return {
    a, e, rp: lo, ra: hi, period: period(mu, a), vp, va,
    energy: -mu / (2 * a), h: lo * vp, argPeri: 0, type: 'ellipse',
  };
}

/** Elements for a radial (h = 0) state: a line through the body center. */
function radialElements(mu, r, v, rMag, speed) {
  const energy = speed * speed / 2 - mu / rMag;
  const tol = ENERGY_TOL * mu / rMag;
  const type = energy < -tol ? 'ellipse' : energy > tol ? 'hyperbola' : 'parabola';
  const a = type === 'parabola' ? Infinity : -mu / (2 * energy);
  const bound = type === 'ellipse';
  return {
    a, e: 1, rp: 0, ra: bound ? 2 * a : Infinity, period: bound ? period(mu, a) : Infinity,
    energy, h: 0, argPeri: wrapPi(Math.atan2(r[1], r[0]) + Math.PI), nu: Math.PI, type,
    rMag, inbound: r[0] * v[0] + r[1] * v[1] < 0,
  };
}

/**
 * Orbital elements from a 2D state. Also reports rMag (current distance) and inbound
 * (moving toward the body). Robust for circular, radial, parabolic and zero-speed states.
 */
export function elementsFromState(mu, r, v) {
  const rMag = Math.hypot(r[0], r[1]);
  const speed = Math.hypot(v[0], v[1]);
  const h = r[0] * v[1] - r[1] * v[0];
  if (speed === 0 || Math.abs(h) <= RADIAL_TOL * rMag * speed) {
    return radialElements(mu, r, v, rMag, speed);
  }
  const rv = r[0] * v[0] + r[1] * v[1];
  const k = speed * speed - mu / rMag;
  const ex = (k * r[0] - rv * v[0]) / mu;
  const ey = (k * r[1] - rv * v[1]) / mu;
  const e = Math.hypot(ex, ey);
  const energy = speed * speed / 2 - mu / rMag;
  const type = Math.abs(e - 1) < PARABOLA_TOL ? 'parabola' : e < 1 ? 'ellipse' : 'hyperbola';
  const p = h * h / mu;
  const a = type === 'parabola' ? Infinity : -mu / (2 * energy);
  const circular = e < CIRCULAR_TOL;
  const argPeri = circular ? Math.atan2(r[1], r[0]) : Math.atan2(ey, ex);
  const nu = circular ? 0 : Math.atan2(Math.sign(h) * (ex * r[1] - ey * r[0]), ex * r[0] + ey * r[1]) + 0;
  return {
    a, e, rp: p / (1 + e), ra: type === 'ellipse' ? p / (1 - e) : Infinity,
    period: type === 'ellipse' ? period(mu, a) : Infinity,
    energy, h, argPeri, nu, type, rMag, inbound: rv < 0,
  };
}

/**
 * Classify a trajectory around a body: 'impact' (periapsis below the surface, or an inbound
 * path that reaches it), 'decay' (periapsis inside the atmosphere), 'escape' or 'orbit'.
 * An outbound open path with periapsis below the surface counts as 'escape'.
 */
export function classifyTrajectory(body, el) {
  if (el.rp < body.radius) {
    return el.energy >= 0 && !el.inbound ? 'escape' : 'impact';
  }
  if (el.rp < body.radius + body.atmosphere) return 'decay';
  return el.e >= 1 ? 'escape' : 'orbit';
}

/** Start on the +y axis at radius R + alt; angleDeg 0 is horizontal (toward +x), 90 is straight up. */
export function launchState(body, altKm, speed, angleDeg) {
  const angle = angleDeg * Math.PI / 180;
  return {
    r: [0, body.radius + altKm],
    v: [speed * Math.cos(angle), speed * Math.sin(angle)],
  };
}

/** Eccentric anomaly E for an elliptic orbit with mean anomaly M (Newton, |err| < 1e-12). */
export function solveKepler(M, e) {
  const reduced = wrapPi(M);
  const sign = reduced < 0 ? -1 : 1;
  const target = Math.abs(reduced);
  let E = Math.PI; // Newton from pi converges monotonically for 0 <= M <= pi
  for (let i = 0; i < 100; i++) {
    const step = (E - e * Math.sin(E) - target) / (1 - e * Math.cos(E));
    E -= step;
    if (Math.abs(step) < 1e-15) break;
  }
  return sign * E + (M - reduced);
}

// Conic anomaly helpers. The anomaly u is E (ellipse), F (hyperbola) or tan(nu/2) (parabola).

function nuToAnomaly(el, nu) {
  if (el.type === 'ellipse') {
    return 2 * Math.atan2(Math.sqrt(1 - el.e) * Math.sin(nu / 2), Math.sqrt(1 + el.e) * Math.cos(nu / 2));
  }
  if (el.type === 'hyperbola') {
    return 2 * Math.atanh(Math.sqrt((el.e - 1) / (el.e + 1)) * Math.tan(nu / 2));
  }
  return Math.tan(nu / 2);
}

function anomalyToNu(el, u) {
  if (el.type === 'ellipse') {
    return 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(u / 2), Math.sqrt(1 - el.e) * Math.cos(u / 2));
  }
  if (el.type === 'hyperbola') {
    return 2 * Math.atan(Math.sqrt((el.e + 1) / (el.e - 1)) * Math.tanh(u / 2));
  }
  return 2 * Math.atan(u);
}

function radiusAtAnomaly(el, u) {
  if (el.type === 'ellipse') return el.a * (1 - el.e * Math.cos(u));
  if (el.type === 'hyperbola') return -el.a * (el.e * Math.cosh(u) - 1);
  return el.rp * (1 + u * u);
}

/** Time since periapsis (s) at anomaly u: Kepler's equation for each conic. */
function timeAtAnomaly(mu, el, u) {
  if (el.type === 'ellipse') return (u - el.e * Math.sin(u)) / Math.sqrt(mu / (el.a * el.a * el.a));
  if (el.type === 'hyperbola') return (el.e * Math.sinh(u) - u) / Math.sqrt(mu / (-el.a * -el.a * -el.a));
  return Math.sqrt(8 * el.rp * el.rp * el.rp / mu) * (u + u * u * u / 3) / 2;
}

/** Seconds since periapsis passage at true anomaly nu (any conic; negative before periapsis). */
export function timeSincePeriapsis(mu, el, nu) {
  return timeAtAnomaly(mu, el, nuToAnomaly(el, nu));
}

// Stumpff functions C(z) and S(z): power series for small |z|, closed forms otherwise.
function stumpffC(z) {
  if (Math.abs(z) < 1) {
    let term = 0.5, sum = 0.5;
    for (let k = 1; k < 14; k++) {
      term *= -z / ((2 * k + 1) * (2 * k + 2));
      sum += term;
    }
    return sum;
  }
  return z > 0 ? (1 - Math.cos(Math.sqrt(z))) / z : (Math.cosh(Math.sqrt(-z)) - 1) / -z;
}

function stumpffS(z) {
  if (Math.abs(z) < 1) {
    let term = 1 / 6, sum = 1 / 6;
    for (let k = 1; k < 14; k++) {
      term *= -z / ((2 * k + 2) * (2 * k + 3));
      sum += term;
    }
    return sum;
  }
  const s = Math.sqrt(Math.abs(z));
  return z > 0 ? (s - Math.sin(s)) / (s * s * s) : (Math.sinh(s) - s) / (s * s * s);
}

/** Universal Kepler function F(chi) - sqrt(mu) dt and its derivative (the distance at chi). */
function universalKepler(chi, dt, sqrtMu, r0, vr0, alpha) {
  const z = alpha * chi * chi;
  const C = stumpffC(z);
  const S = stumpffS(z);
  const f = r0 * vr0 / sqrtMu * chi * chi * C + (1 - alpha * r0) * chi * chi * chi * S + r0 * chi - sqrtMu * dt;
  const df = chi * chi * C + r0 * vr0 / sqrtMu * chi * (1 - z * S) + r0 * (1 - z * C);
  return { f, df, C, S, z };
}

/** Solve the universal Kepler equation for chi with Newton steps safeguarded by a bracket (F is monotonic). */
function solveUniversal(dt, sqrtMu, r0, vr0, alpha) {
  const sign = dt < 0 ? -1 : 1;
  let lo = 0;
  let hi = Math.min(1, Math.max(sign * sqrtMu * dt / r0, 1e-9)); // grow from small: huge chi overflows cosh
  for (let i = 0; i < 200 && sign * universalKepler(sign * hi, dt, sqrtMu, r0, vr0, alpha).f < 0; i++) {
    lo = hi;
    hi *= 2;
  }
  let chi = (lo + hi) / 2;
  for (let i = 0; i < 200; i++) {
    const { f, df } = universalKepler(sign * chi, dt, sqrtMu, r0, vr0, alpha);
    if (sign * f > 0) hi = chi; else lo = chi;
    let next = chi - sign * f / df;
    if (!(next > lo && next < hi)) next = (lo + hi) / 2;
    if (Math.abs(next - chi) <= 1e-14 * Math.max(1, chi)) { chi = next; break; }
    chi = next;
  }
  return sign * chi;
}

/** Guarded RK4 for radial or rest states, where the universal step is singular at the center. */
function propagateRK4(mu, r, v, dt) {
  const accel = (p) => {
    const d = Math.max(Math.hypot(p[0], p[1]), 1e-3);
    const k = -mu / (d * d * d);
    return [k * p[0], k * p[1]];
  };
  let state = [r[0], r[1], v[0], v[1]];
  const deriv = (s) => { const a = accel(s); return [s[2], s[3], a[0], a[1]]; };
  const add = (s, d, k) => s.map((x, i) => x + k * d[i]);
  let remaining = dt;
  for (let count = 0; remaining !== 0; count++) {
    const d = Math.max(Math.hypot(state[0], state[1]), 1);
    const cap = 0.005 * Math.sqrt(d * d * d / mu);
    const h = count >= MAX_RK4_STEPS ? remaining : Math.sign(remaining) * Math.min(Math.abs(remaining), cap);
    const k1 = deriv(state);
    const k2 = deriv(add(state, k1, h / 2));
    const k3 = deriv(add(state, k2, h / 2));
    const k4 = deriv(add(state, k3, h));
    state = state.map((x, j) => x + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    remaining -= h;
  }
  return { r: [state[0], state[1]], v: [state[2], state[3]] };
}

/**
 * One exact step of dt seconds (either sign) for any conic, using universal variables.
 * Radial and rest states use a guarded RK4 instead. Returns { r, v }.
 */
export function propagate(mu, r, v, dt) {
  const r0 = Math.hypot(r[0], r[1]);
  const speed = Math.hypot(v[0], v[1]);
  const h = r[0] * v[1] - r[1] * v[0];
  if (dt === 0) return { r: [r[0], r[1]], v: [v[0], v[1]] };
  if (speed === 0 || Math.abs(h) <= RADIAL_TOL * r0 * speed) return propagateRK4(mu, r, v, dt);
  const sqrtMu = Math.sqrt(mu);
  const alpha = 2 / r0 - speed * speed / mu;
  const T = period(mu, 1 / alpha);
  const step = Number.isFinite(T) ? dt % T : dt;
  const vr0 = (r[0] * v[0] + r[1] * v[1]) / r0;
  const chi = solveUniversal(step, sqrtMu, r0, vr0, alpha);
  const { C, S, z } = universalKepler(chi, step, sqrtMu, r0, vr0, alpha);
  const f = 1 - chi * chi * C / r0;
  const g = step - chi * chi * chi * S / sqrtMu;
  const x = f * r[0] + g * v[0];
  const y = f * r[1] + g * v[1];
  const r1 = Math.hypot(x, y);
  const fdot = sqrtMu / (r1 * r0) * (z * S - 1) * chi;
  const gdot = 1 - chi * chi * C / r1;
  return { r: [x, y], v: [fdot * r[0] + gdot * v[0], fdot * r[1] + gdot * v[1]] };
}

/** Position and velocity from true anomaly nu and distance rMag on a conic with the element's sense of rotation. */
function stateFromPolar(el, rMag, nu, vr, vt) {
  const theta = el.argPeri + direction(el) * nu;
  const c = Math.cos(theta), s = Math.sin(theta);
  const d = direction(el);
  const vx = vr * c - d * vt * s;
  const vy = vr * s + d * vt * c;
  return { r: [rMag * c, rMag * s], v: [vx, vy], nu: wrapPi(nu), rMag, speed: Math.hypot(vx, vy) };
}

/**
 * Position, velocity, true anomaly and distance t seconds after periapsis passage.
 * Ellipses use Kepler's equation; open conics are propagated from periapsis.
 * Follows the sense of rotation of el.h.
 */
export function positionAtTime(mu, el, t) {
  if (el.type !== 'ellipse') {
    const vp = el.h / el.rp;
    const d = direction(el);
    const r0 = [el.rp * Math.cos(el.argPeri), el.rp * Math.sin(el.argPeri)];
    const v0 = [-d * Math.abs(vp) * Math.sin(el.argPeri), d * Math.abs(vp) * Math.cos(el.argPeri)];
    const end = propagate(mu, r0, v0, t);
    const after = elementsFromState(mu, end.r, end.v);
    return { r: end.r, v: end.v, nu: after.nu, rMag: after.rMag, speed: Math.hypot(end.v[0], end.v[1]) };
  }
  const n = Math.sqrt(mu / (el.a * el.a * el.a));
  const E = solveKepler(n * t, el.e);
  const rMag = el.a * (1 - el.e * Math.cos(E));
  const nu = anomalyToNu(el, E);
  const rSafe = Math.max(rMag, 1e-12);
  const vr = Math.sqrt(mu * el.a) * el.e * Math.sin(E) / rSafe;
  const vt = Math.sqrt(mu * el.a * (1 - el.e * el.e)) / rSafe;
  return stateFromPolar(el, rMag, nu, vr, vt);
}

/** True-anomaly limit of an open conic out to distance rMax (default 100 periapsis distances). */
function openLimit(el, rMax) {
  const limit = Number.isFinite(rMax) ? rMax : 100 * el.rp;
  const p = el.rp * (1 + el.e);
  const c = Math.min(1, Math.max(-1, (p / limit - 1) / el.e));
  return Math.acos(c);
}

/** Anomaly range [uFrom, uTo] for a path, and whether it is a full closed ellipse. */
function anomalyRange(el, opts) {
  if (el.type === 'ellipse') {
    const fromNu = opts.fromNu ?? 0;
    const toNu = opts.toNu ?? fromNu + TWO_PI;
    const uFrom = nuToAnomaly(el, fromNu);
    let uTo = nuToAnomaly(el, toNu);
    if (toNu - fromNu >= TWO_PI - 1e-12) uTo = uFrom + TWO_PI;
    while (uTo < uFrom) uTo += TWO_PI;
    return { uFrom, uTo, closed: opts.fromNu === undefined && opts.toNu === undefined };
  }
  const limit = openLimit(el, opts.rMax);
  const clamp = (nu) => Math.min(limit, Math.max(-limit, nu));
  return { uFrom: nuToAnomaly(el, clamp(opts.fromNu ?? -limit)), uTo: nuToAnomaly(el, clamp(opts.toNu ?? limit)), closed: false };
}

/** A straight line through the center along the radial trajectory. */
function radialPath(el, n, opts) {
  const outward = el.argPeri + Math.PI;
  const end = el.type === 'ellipse' ? Math.min(el.ra, opts.rMax ?? Infinity) : (opts.rMax ?? 2 * (el.rMag || 1));
  return Array.from({ length: n }, (_, i) => {
    const d = end * i / Math.max(n - 1, 1);
    return [d * Math.cos(outward), d * Math.sin(outward)];
  });
}

/**
 * Points [x, y] along the conic in order of motion, spaced evenly in anomaly (denser near periapsis).
 * A full ellipse returns n distinct points that close into a loop. Open conics run from -nu to +nu
 * out to opts.rMax. opts.fromNu / opts.toNu draw only that arc (n points, ends included).
 * Radial trajectories return a straight line from the center.
 */
export function samplePath(mu, el, n, opts = {}) {
  if (el.h === 0) return radialPath(el, n, opts);
  const { uFrom, uTo, closed } = anomalyRange(el, opts);
  const count = Math.max(1, Math.floor(n));
  const divisor = closed ? count : Math.max(count - 1, 1);
  return Array.from({ length: count }, (_, i) => {
    const u = uFrom + (uTo - uFrom) * i / divisor;
    const rMag = radiusAtAnomaly(el, u);
    const theta = el.argPeri + direction(el) * anomalyToNu(el, u);
    return [rMag * Math.cos(theta), rMag * Math.sin(theta)];
  });
}

/** Time measured along a radial trajectory from the center (negative while inbound), s. */
function radialClock(mu, el, r, inbound) {
  const sign = inbound ? -1 : 1;
  if (el.type === 'parabola') return sign * Math.SQRT2 * Math.pow(r, 1.5) / (3 * Math.sqrt(mu));
  if (el.type === 'hyperbola') {
    const size = -el.a;
    const H = Math.acosh(1 + r / size);
    return sign * Math.sqrt(size * size * size / mu) * (Math.sinh(H) - H);
  }
  const x = Math.acos(Math.min(1, Math.max(-1, 1 - r / el.a)));
  const E = inbound ? TWO_PI - x : x;
  return Math.sqrt(el.a * el.a * el.a / mu) * (E - Math.sin(E));
}

/** Impact on a radial trajectory, from the current distance el.rMag. */
function radialImpact(body, el) {
  const R = body.radius;
  if (!(el.rMag >= R) || (el.type === 'ellipse' && R > el.ra)) return null;
  const t = radialClock(body.mu, el, R, true) - radialClock(body.mu, el, el.rMag, el.inbound);
  if (!(t >= 0)) return null;
  const outward = el.argPeri + Math.PI;
  return { nu: Math.PI, t, r: [R * Math.cos(outward), R * Math.sin(outward)] };
}

/**
 * First point after startNu (in the direction of motion) where r = body.radius, with the time
 * to reach it: { nu, t, r } or null (periapsis above the surface, never reached, or radial data
 * without el.rMag). Radial trajectories use el.rMag and el.inbound from elementsFromState.
 */
export function impactPoint(body, el, startNu) {
  if (!(el.rp < body.radius)) return null;
  if (el.h === 0) return Number.isFinite(el.rMag) ? radialImpact(body, el) : null;
  const R = body.radius;
  const p = el.rp * (1 + el.e);
  const c = (p / R - 1) / el.e;
  if (Math.abs(c) > 1 + 1e-12) return null;
  const nuHit = Math.acos(Math.min(1, Math.max(-1, c)));
  const closed = el.type === 'ellipse';
  const start = closed ? wrapPi(startNu) : startNu;
  const candidates = closed ? [-nuHit, nuHit, TWO_PI - nuHit] : [-nuHit, nuHit];
  const nu = candidates.filter((x) => x > start + 1e-12).reduce((a, b) => Math.min(a, b), Infinity);
  if (!Number.isFinite(nu)) return null;
  let t = timeSincePeriapsis(body.mu, el, nu) - timeSincePeriapsis(body.mu, el, start);
  if (closed && t <= 0) t += el.period;
  const theta = el.argPeri + direction(el) * nu;
  return { nu: closed ? wrapPi(nu) : nu, t, r: [R * Math.cos(theta), R * Math.sin(theta)] };
}

/** Hohmann transfer between circular orbits of radius r1 and r2 (km from the center); works up or down. */
export function hohmann(mu, r1, r2) {
  const aT = (r1 + r2) / 2;
  const v1 = circularSpeed(mu, r1);
  const v2 = circularSpeed(mu, r2);
  const vT1 = visViva(mu, r1, aT);
  const vT2 = visViva(mu, r2, aT);
  const dv1 = Math.abs(vT1 - v1);
  const dv2 = Math.abs(v2 - vT2);
  return {
    dv1, dv2, total: dv1 + dv2, time: Math.PI * Math.sqrt(aT * aT * aT / mu),
    aT, eT: Math.abs(r2 - r1) / (r1 + r2), v1, v2, vT1, vT2,
    direction: r2 >= r1 ? 'up' : 'down',
  };
}

/** Fraction of the starting mass that must be propellant (rocket equation), dv in km/s. */
export function propellantFraction(dv, ispSeconds) {
  return 1 - Math.exp(-dv / (ispSeconds * G0));
}

/** Choose a readable unit: s (< 120 s), min (< 180 min), h (< 72 h), then days. */
export function formatDuration(seconds) {
  const s = Math.abs(seconds);
  if (s < 120) return { value: seconds, unit: 's' };
  if (s < 180 * 60) return { value: seconds / 60, unit: 'min' };
  if (s < 72 * 3600) return { value: seconds / 3600, unit: 'h' };
  return { value: seconds / 86400, unit: 'days' };
}
