// orbital/launch-model.js  Pure model for Launch mode (no DOM, no Three.js; runs in Node).
// One call, computeLaunch(), turns (body, start height, speed, angle) into everything the mode draws and shows:
// outcome, path points, impact data, extent for the 3D view, tile numbers and a good automatic time warp.
//
// Conventions come from physics.js: the craft starts at [0, R + alt], angle 0 is level (toward +x), 90 is straight up.

import {
  circularSpeed, escapeSpeed, elementsFromState, classifyTrajectory, launchState,
  samplePath, impactPoint, visViva, timeSincePeriapsis,
} from './physics.js';

const TWO_PI = 2 * Math.PI;

/** Start height range in km above the surface, per body (slider range). */
export const ALT_RANGE = {
  earth: [100, 40000],
  moon: [10, 10000],
  mars: [50, 30000],
  sun: [1e6, 3e8],
};

/** Default start height in km per body. */
export const ALT_DEFAULT = { earth: 400, moon: 100, mars: 300, sun: 5e6 };

/** Highest launch speed offered, as a multiple of the escape speed. */
export const SPEED_MAX_FACTOR = 1.5;

/** Default start for a body: its usual height and the circular speed there. */
export function defaultLaunch(body) {
  const alt = ALT_DEFAULT[body.id] ?? 400;
  return { alt, speed: circularSpeed(body.mu, body.radius + alt) };
}

/** Largest speed on the speed slider at this height, km/s. */
export function maxSpeed(body, alt) {
  return SPEED_MAX_FACTOR * escapeSpeed(body.mu, body.radius + alt);
}

/** Unwrap an angle so that it is above `from`. */
function above(angle, from) {
  let a = angle;
  while (a <= from + 1e-12) a += TWO_PI;
  return a;
}

/** Longest path drawn for an ellipse, as a multiple of the start radius. */
const ELLIPSE_CAP = 40;
/** An escaping craft is followed out to this multiple of the start radius. */
const ESCAPE_REACH = 7.2;

/**
 * @param {object} body entry of BODIES
 * @param {number} alt start height above the surface, km
 * @param {number} speed launch speed, km/s
 * @param {number} angleDeg 0 = level, 90 = straight up
 */
export function computeLaunch(body, alt, speed, angleDeg) {
  const R = body.radius;
  const mu = body.mu;
  const r0 = R + alt;
  const start = launchState(body, alt, speed, angleDeg);
  const vc = circularSpeed(mu, r0);
  const ve = escapeSpeed(mu, r0);
  const el = elementsFromState(mu, start.r, start.v);
  let outcome = classifyTrajectory(body, el);
  if (el.type !== 'ellipse' && outcome === 'orbit') outcome = 'escape';
  const radial = el.h === 0;
  const open = el.type !== 'ellipse';

  const m = {
    body, alt, speed, angleDeg, r0, vc, ve, start, el, outcome, radial, open,
    imp: null, fromNu: el.nu, toNu: el.nu, pts: [], closed: false, extent: r0, leaveR: Infinity,
    stats: {}, apsides: null, startAt: null,
  };

  if (outcome === 'impact') {
    m.imp = impactPoint(body, el, el.nu);
    if (radial) {
      const top = el.type === 'ellipse' ? Math.max(r0, el.ra) : r0;
      m.pts = [[0, R], [0, top]];
      m.toNu = m.fromNu;
    } else if (m.imp) {
      m.toNu = above(m.imp.nu, m.fromNu);
      m.pts = samplePath(mu, el, 220, { fromNu: m.fromNu, toNu: m.toNu, rMax: r0 * 2 });
    }
    let ext = r0;
    for (const p of m.pts) ext = Math.max(ext, Math.hypot(p[0], p[1]));
    m.extent = ext;
    // Highest point on the way down (only when the craft climbs first).
    let top = r0;
    if (radial) top = el.type === 'ellipse' ? Math.max(r0, el.ra) : r0;
    else if (el.type === 'ellipse' && m.imp && m.toNu > Math.PI) top = el.ra;
    m.stats.highAlt = top - R;
    m.stats.climbs = top - r0 > 1;
    m.stats.tImpact = m.imp ? m.imp.t : NaN;
    m.stats.vImpact = visViva(mu, R, el.a);
    m.stats.ground = m.imp ? R * (m.toNu - m.fromNu) : NaN;
  } else if (outcome === 'escape') {
    const L = ESCAPE_REACH * r0;
    m.leaveR = L;
    m.extent = L;
    if (radial) m.pts = [[0, r0], [0, L]];
    else m.pts = samplePath(mu, el, 240, { fromNu: el.nu, rMax: L });
    m.stats.vInf = Math.sqrt(Math.max(0, 2 * el.energy));
  } else {
    // orbit or decay: a closed ellipse
    m.closed = true;
    m.pts = samplePath(mu, el, 400);
    m.extent = Math.min(Math.max(r0, el.ra), ELLIPSE_CAP * r0);
    m.stats.lowAlt = el.rp - R;
    m.stats.highAlt = el.ra - R;
    m.stats.period = el.period;
    m.stats.vFast = visViva(mu, el.rp, el.a);
    m.stats.vSlow = visViva(mu, el.ra, el.a);
    m.stats.circular = el.e < 0.002;
    if (el.e > 0.02) {
      const th = el.argPeri;
      m.apsides = {
        peri: [el.rp * Math.cos(th), el.rp * Math.sin(th)],
        apo: [el.ra * Math.cos(th + Math.PI), el.ra * Math.sin(th + Math.PI)],
      };
      const near = (p) => Math.hypot(p[0] - start.r[0], p[1] - start.r[1]) < 0.035 * m.extent;
      m.startAt = near(m.apsides.peri) ? 'lowest' : near(m.apsides.apo) ? 'highest' : null;
    }
  }
  m.autoWarp = autoWarp(m);
  return m;
}

/** Time to fly from the start out to radius L on an escape path, s (approximate when the path is radial). */
function escapeTime(m) {
  const { body, el, r0, leaveR: L, speed } = m;
  if (!m.radial) {
    const p = el.h * el.h / body.mu;
    const c = (p / L - 1) / el.e;
    if (Math.abs(c) <= 1) {
      const t = timeSincePeriapsis(body.mu, el, Math.acos(c)) - timeSincePeriapsis(body.mu, el, el.nu);
      if (Number.isFinite(t) && t > 0) return t;
    }
  }
  const vL = Math.sqrt(Math.max(0, speed * speed - 2 * body.mu * (1 / r0 - 1 / L)));
  return (L - r0) / Math.max(1e-9, (speed + vL) / 2);
}

/** A time warp that makes the main event last about 10 to 15 seconds on screen. */
function autoWarp(m) {
  let w;
  if (m.outcome === 'impact') w = (m.stats.tImpact || 100) / 8;
  else if (m.outcome === 'escape') w = escapeTime(m) / 12;
  else w = (Number.isFinite(m.stats.period) ? m.stats.period : 5000) / 14;
  if (!Number.isFinite(w) || w < 1) w = 1;
  return w >= 100 ? Math.round(w) : Math.round(w * 10) / 10;
}

/**
 * Plain words for the result: banner and the short "why" sentences.
 * @param {ReturnType<typeof computeLaunch>} m
 * @param {(n:number, d:number)=>string} f number formatter (the ui.js fmt)
 * @returns {{kind:'warn'|'ok'|'info', title:string, text:string, why:string[]}}
 */
export function describe(m, f) {
  const slow = m.speed < m.vc * 0.999;
  const steep = m.angleDeg > 30;
  if (m.outcome === 'impact') {
    const why = [];
    if (m.speed < 1e-6) {
      why.push('With no speed at all, gravity simply pulls the craft straight down.');
    } else if (m.angleDeg < 0 && !slow) {
      why.push('The craft is aimed below level, so its path heads toward the ground.');
    } else if (slow) {
      why.push(`This speed is below the circular speed of ${f(m.vc, 2)} km/s. Gravity pulls the craft down faster than the ground curves away.`);
      if (steep) why.push('Aiming upward also spends part of the speed on climbing instead of going around the body.');
    } else {
      why.push('The speed is high enough, but this angle puts too much of it into climbing. The craft goes up, then comes back down.');
    }
    why.push('Its path dips below the surface, so the craft hits the ground before it can go around.');
    return { kind: 'warn', title: 'Falls back to the surface', text: '', why };
  }
  if (m.outcome === 'decay') {
    const why = ['The path stays above the ground but dips into the upper atmosphere.',
      'Thin air drags on the craft every time it passes through, so it loses speed and spirals down.'];
    return { kind: 'warn', title: 'Orbit is too low', text: 'The atmosphere slows the craft and it comes down.', why };
  }
  if (m.outcome === 'escape') {
    const why = [];
    if (m.stats.vInf < 0.005) {
      why.push('The craft moves at exactly the escape speed. It keeps slowing down and never quite stops.');
    } else {
      why.push(`This speed is above the escape speed of ${f(m.ve, 2)} km/s. Gravity slows the craft as it climbs, but never enough to stop it.`);
      why.push(`Far from the ${m.body.name} it still moves at ${f(m.stats.vInf, 2)} km/s.`);
    }
    why.push('The craft does not come back.');
    return { kind: 'info', title: 'Escapes', text: 'It does not come back.', why };
  }
  const why = [];
  if (m.stats.circular) {
    why.push('At this speed the ground curves away as fast as the craft falls. The craft keeps falling around the body and never reaches the surface.');
  } else if (slow) {
    why.push('This speed is below the circular speed, so the craft first drops inward. It still misses the surface, swings around, and climbs back to this height.');
  } else {
    why.push('This speed is above the circular speed, so the craft climbs away from the body, slows down, and then falls back toward it.');
    why.push('The path is a stretched circle called an ellipse. The craft moves fastest at its lowest point.');
  }
  why.push('Nothing slows the craft, so it repeats the same loop.');
  return { kind: 'ok', title: 'Stays in orbit', text: '', why };
}
