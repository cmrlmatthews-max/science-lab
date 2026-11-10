// orbital/mode-orbits.js  Orbits mode of Orbital Mechanics, built on the five information layers.
// One plain question: why do some satellites circle fast and others slow?
//   Level 1 Start    the question, four big picture choices (Space Station, GPS, TV satellite, Moon), one plain answer.
//   Level 2 Story    a five step guided story with an "In your life" line on every step.
//   Level 3 Explore  orbit presets, lowest point and highest point controls, "Try this", playback.
//   Level 4 Numbers  five stat tiles (US first, then metric) with an everyday comparison each.
//   Level 5 Deep     other worlds, key numbers with sources, formulas, speed arrow, equal slices, compare table, speed graph.
// Words and card entries live in content-orbits.js. Cards open on the world, the craft, the path, the lowest and highest
// points and the speed arrow (hover on a fine pointer, tap on touch).
//
// State lives in ctx.store: bodyId, level, time {playing, warp}, orbits {pe, ap, presetId, showVelocity, showAreas}.
// pe and ap are altitudes above the surface in km. For the Sun the presets give distances from the center
// (peR, apR); they are converted to altitudes here.
// mode default export: { id, label, panelTitles, mount(ctx), unmount() }

import { THREE } from '../shared/scene.js';
import { el, fmt, select, slider, toggle, button, section, stats, stat, banner } from '../shared/ui.js';
import { question, answer, tryThis } from '../shared/simple.js';
import { story, tile, moreLink } from '../shared/layers.js';
import { infoChip, infoButton } from '../shared/card.js';
import { dual, friendlyDuration, nice } from '../shared/units.js';
import { TEXT, getInfo } from './content-orbits.js';
import { BODIES, BODY_ORDER, ORBIT_PRESETS } from './bodies.js';
import { elementsFromApsides, positionAtTime, samplePath, formatDuration } from './physics.js';
import {
  sceneScale, createBody, createPath, createCraft, createArrow, createMarker, createStars, createRings,
  timeControl, createClock, frameSpace, spaceTheme,
} from './space.js';

// ---------- constants ----------
const SLICES = 8;                 // equal-time wedges
const TARGET_ORBIT_SECONDS = 20;  // one orbit should take about this long on screen at the default warp
const BUCKET = 1.5;               // kmPerUnit is quantized in steps of this factor
const ARROW_MAX = 15;             // scene units, arrow length at the fastest speed
const ARROW_MIN = 4;              // scene units, arrow length floor (slowest speed)
const FRAME_EXTENT = 50;          // half width framed, scene units (the orbit spans 37 to 56 units)
const ELEVATION = 66;             // camera elevation for this mode, degrees

// Slider ranges, altitude above the surface in km.
const RANGES = {
  earth: [80, 500000],
  moon: [20, 60000],
  mars: [60, 100000],
  sun: [1e7, 4e8],
};

// Speeds of the time control, simulation seconds per real second.
const WARP_LADDER = [
  [1, 'Real time'], [10, '10 s per second'], [60, '1 min per second'], [300, '5 min per second'],
  [600, '10 min per second'], [1800, '30 min per second'], [3600, '1 hour per second'],
  [10800, '3 hours per second'], [21600, '6 hours per second'], [43200, '12 hours per second'],
  [86400, '1 day per second'], [259200, '3 days per second'], [604800, '1 week per second'],
  [2592000, '30 days per second'], [7776000, '90 days per second'], [31557600, '1 year per second'],
].map(([value, label]) => ({ value, label }));

const STYLE = `
.orb-stack { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.orb-list { display: flex; flex-direction: column; gap: 6px; }
.orb-list .layer-row { cursor: pointer; flex-wrap: nowrap; }
.orb-list .layer-row:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.orb-list .layer-sub { white-space: normal; overflow: visible; text-overflow: clip; font-size: 12px; line-height: 1.35; }
.orb-note { margin: 0; font-size: 13px; line-height: 1.45; color: var(--ink); }
.orb-note + .orb-note { margin-top: 6px; }
.orb-cap { margin: 0; font-size: 12px; line-height: 1.4; color: var(--ink-2); }
.orb-live { margin: 0; font-size: 15px; line-height: 1.4; color: var(--ink); font-variant-numeric: tabular-nums; }
.orb-facts { display: flex; flex-direction: column; gap: 3px; }
.orb-fact { margin: 0; font-size: 13px; line-height: 1.4; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.orb-fact strong { color: var(--ink); font-weight: 600; }
.orb-bar { display: flex; flex-direction: column; gap: 4px; }
.orb-bar[hidden] { display: none; }
.orb-bar-track { position: relative; height: 10px; border-radius: 2px; background: var(--track); border: 1px solid var(--line-strong); }
.orb-bar-fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--accent-soft); box-shadow: inset 0 0 0 1px var(--accent-edge); border-radius: 1px; }
.orb-bar-tick { position: absolute; top: -5px; bottom: -5px; width: 3px; margin-left: -1.5px; background: var(--ink); border-radius: 1px; }
.orb-bar-labels { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--ink-2); }
.orb-bar-labels .mono { font-variant-numeric: tabular-nums; }
.orb-bar[data-numbers="false"] .mono { display: none; }
.orb-table { display: flex; flex-direction: column; gap: 4px; }
.orb-tr { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1.25fr) minmax(0, 0.85fr) minmax(0, 0.85fr); gap: 4px 8px; align-items: center; padding: 6px 8px; min-height: 44px; font-size: 12px; line-height: 1.3; background: var(--paper-3); border: 1px solid var(--line); border-radius: var(--radius); cursor: pointer; text-align: left; color: var(--ink); font-family: var(--font-body); width: 100%; }
.orb-tr:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.orb-tr[data-selected="true"] { background: var(--accent-soft); border-color: var(--accent-edge); box-shadow: inset 2px 0 0 var(--accent); }
.orb-tr .nm { font-weight: 600; overflow-wrap: anywhere; }
.orb-tr .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.orb-th { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1.25fr) minmax(0, 0.85fr) minmax(0, 0.85fr); gap: 4px 8px; padding: 0 8px; font-size: 11px; color: var(--ink-2); }
.orb-graph { width: 100%; min-width: 0; }
.orb-graph svg { display: block; width: 100%; height: 160px; overflow: visible; }
.orb-graph text { font: 11px var(--font-body); fill: var(--ink-2); }
.orb-graph .ax { stroke: var(--line-strong); stroke-width: 1; fill: none; shape-rendering: crispEdges; }
.orb-graph .gl { stroke: var(--line); stroke-width: 1; stroke-dasharray: 2 3; fill: none; shape-rendering: crispEdges; }
.orb-graph .cv { stroke: var(--accent); stroke-width: 2; fill: none; stroke-linejoin: round; }
.orb-graph .mk { fill: var(--hot); stroke: var(--paper-2); stroke-width: 2; }
.orb-graph .mkl { stroke: var(--hot); stroke-width: 1; opacity: 0.5; }
.orb-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.orb-choice { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 84px; padding: 10px 8px; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--paper-2); color: var(--ink); font: 600 15px/1.25 var(--font-body); cursor: pointer; text-align: center; }
.orb-choice:hover { border-color: var(--ink-2); }
.orb-choice:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.orb-choice[data-selected="true"] { background: var(--accent-soft); border-color: var(--accent-edge); box-shadow: inset 0 0 0 1px var(--accent-edge); color: var(--accent); }
.orb-choice-ico { display: block; width: 40px; height: 40px; }
.orb-choice-ico svg { display: block; width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.orb-ideas { display: flex; flex-wrap: wrap; gap: 8px 8px; align-items: center; }
.orb-row { display: flex; align-items: center; gap: 10px; }
.orb-formula { color: var(--ink-2); font-size: 12.5px; }
.orb-bar-labels { flex-wrap: wrap; }
.orb-stage-note { position: absolute; left: 10px; bottom: 8px; font: 11px var(--font-body); color: rgba(255, 255, 255, 0.72); pointer-events: none; }
`;

// ---------- helpers ----------
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** Round to 3 significant figures, never finer than 1 km. */
function round3(km) {
  if (!(km > 0)) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(km)) - 2);
  return Math.max(1, Math.round(Math.round(km / p) * p));
}

const posToKm = (pos, [lo, hi]) => lo * Math.pow(hi / lo, pos / 1000);
const kmToPos = (km, [lo, hi]) => clamp(Math.round((1000 * Math.log(Math.max(km, lo) / lo)) / Math.log(hi / lo)), 0, 1000);

/** Altitudes (km above the surface) of a preset on a body. */
function presetAlts(body, p) {
  if (p.pe != null) return { pe: p.pe, ap: p.ap };
  return { pe: Math.max(1, p.peR - body.radius), ap: Math.max(1, p.apR - body.radius) };
}

const MILLION = 1e6;
/** A height in both unit formats, miles first: { us: '249 mi', si: '400 km', text: '249 mi (400 km)' }. Millions stay short. */
function altParts(km) {
  if (km < MILLION) return dual.km(km, 0);
  const us = `${nice(km / 1.609344 / MILLION)} million mi`;
  const si = `${nice(km / MILLION)} million km`;
  return { us, si, text: `${us} (${si})` };
}

// Simple line drawings for the four picture choices (stroke only, drawn in the text color).
const ICONS = {
  iss: '<svg viewBox="0 0 48 48"><rect x="19" y="19" width="10" height="10" rx="1.5"/><rect x="2" y="21" width="14" height="6"/><rect x="32" y="21" width="14" height="6"/><path d="M16 24h3M29 24h3M24 19v-9M24 29v9"/></svg>',
  gps: '<svg viewBox="0 0 48 48"><g transform="rotate(-35 20 28)"><rect x="14" y="22" width="12" height="12" rx="1.5"/><rect x="0" y="25" width="11" height="6"/><rect x="29" y="25" width="11" height="6"/></g><path d="M32 36a10 10 0 0 0 10-10M30 43a17 17 0 0 0 15-17"/></svg>',
  geo: '<svg viewBox="0 0 48 48"><path d="M8 14c0 14 10 24 24 24L8 14z"/><path d="M20 26l9-9"/><circle cx="31" cy="15" r="2.5"/><path d="M26 40v5M19 45h14"/></svg>',
  moon: '<svg viewBox="0 0 48 48"><path d="M30 6a18 18 0 1 0 12 30A15 15 0 0 1 30 6z"/></svg>',
};
function kmText(x) { return x >= MILLION ? `${fmt(x / MILLION, 1)} million km` : `${fmt(x, 0)} km`; }
function rangeText(pe, ap) {
  if (Math.round(pe) === Math.round(ap)) return kmText(pe);
  if (pe >= MILLION && ap >= MILLION) return `${fmt(pe / MILLION, 1)} to ${fmt(ap / MILLION, 1)} million km`;
  if (pe < MILLION && ap < MILLION) return `${fmt(pe, 0)} to ${fmt(ap, 0)} km`;
  return `${kmText(pe)} to ${kmText(ap)}`;
}
function durText(s) { const d = formatDuration(s); return `${fmt(d.value, 1)} ${d.unit}`; }
function shapeWord(e) { return e < 0.01 ? 'circle' : e < 0.2 ? 'slightly oval' : e < 0.6 ? 'oval' : 'long oval'; }

const trimZero = (s) => s.replace(/\.0$/, '');
/** Trip time in everyday words: "93 minutes", "23.9 hours", "365 days". */
function tripText(s) {
  const min = s / 60;
  if (min < 120) return `${Math.round(min)} minutes`;
  const h = s / 3600;
  if (h < 48) return `${trimZero(fmt(h, 1))} hours`;
  const d = s / 86400;
  if (d < 730) return `${d < 100 ? trimZero(fmt(d, 1)) : fmt(d, 0)} days`;
  return `${trimZero(fmt(d / 365.25, 1))} years`;
}
/** Short trip time for the one-line summary: "93 min", "12 h", "365 days". */
function shortTrip(s) {
  const min = s / 60;
  if (min < 120) return `${Math.round(min)} min`;
  const h = s / 3600;
  if (h < 48) return `${trimZero(fmt(h, 1))} h`;
  const d = s / 86400;
  if (d < 730) return `${d < 100 ? trimZero(fmt(d, 1)) : fmt(d, 0)} days`;
  return `${trimZero(fmt(d / 365.25, 1))} years`;
}
function elementsFor(body, pe, ap) {
  return { ...elementsFromApsides(body.mu, body.radius + Math.min(pe, ap), body.radius + Math.max(pe, ap)), argPeri: 0 };
}

/** Plain one-line description of a preset orbit. */
function presetSub(body, p) {
  const a = presetAlts(body, p);
  const e = elementsFor(body, a.pe, a.ap);
  const near = body.id === 'sun' ? 'close' : 'low';
  const far = body.id === 'sun' ? 'far' : 'high';
  if (e.e >= 0.6) return `A long oval. Fast when ${near}, slow when ${far}.`;
  if (e.e >= 0.2) return `An oval. Fast when ${near}, slow when ${far}.`;
  if (e.e >= 0.02) return `A slight oval. A little faster when ${near}.`;
  const day = body.rotationHours * 3600;
  if (body.id !== 'sun' && Math.abs(e.period - day) / day < 0.02) return 'Very far. Circles once a day and stays over one spot.';
  if (body.id === 'sun') return `A round path. Circles the Sun in ${tripText(e.period)}.`;
  const ratio = a.pe / body.radius;
  const lead = ratio < 0.2 ? `Close to ${body.name}` : ratio < 1.5 ? 'Fairly high' : ratio < 10 ? 'High up' : 'Very far';
  return `${lead}. Circles in ${tripText(e.period)}.`;
}

/** Short plain description of an orbit for the one-line summary. */
function orbitWord(body, e, a) {
  if (e.e >= 0.5) return 'long oval orbit';
  if (e.e >= 0.02) return 'oval orbit';
  if (body.id === 'sun') return 'round orbit';
  const ratio = a.pe / body.radius;
  return ratio < 0.2 ? 'low orbit' : ratio < 10 ? 'high orbit' : 'very far orbit';
}

/** Index in WARP_LADDER whose period-on-screen is closest to the target. */
function idealWarpIndex(periodS) {
  const want = periodS / TARGET_ORBIT_SECONDS;
  let best = 0;
  let bestD = Infinity;
  WARP_LADDER.forEach((w, i) => {
    const d = Math.abs(Math.log(w.value / want));
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}
/** Six warps around the ideal one (shifted to stay inside the ladder). */
function warpWindow(idx) {
  let start = clamp(idx - 2, 0, WARP_LADDER.length - 6);
  return WARP_LADDER.slice(start, start + 6);
}

// ---------- the speed graph ----------
function createSpeedGraph() {
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs = {}) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  const wrap = el('div', { class: 'orb-graph' });
  const svg = mk('svg', { role: 'img', 'aria-label': 'Speed around one orbit' });
  wrap.appendChild(svg);
  const H = 160;
  const M = { l: 36, r: 12, t: 22, b: 40 };
  let data = null; // { body, el }
  let geo = null;
  let marker = null;
  let markerLine = null;

  function speedAt(t) { return positionAtTime(data.body.mu, data.el, t).speed; }

  function draw() {
    const W = wrap.clientWidth;
    svg.replaceChildren();
    marker = null; markerLine = null; geo = null;
    if (!data || W < 60) return;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const T = data.el.period;
    const yMax = data.el.vp * 1.12;
    const x0 = M.l; const x1 = W - M.r; const y0 = H - M.b; const y1 = M.t;
    const X = (f) => x0 + f * (x1 - x0);
    const Y = (v) => y0 - (v / yMax) * (y0 - y1);
    geo = { X, Y, T };
    const eccentric = data.el.e > 0.02;

    // reference lines at lowest and highest point times
    if (eccentric) {
      for (const f of [0.5]) svg.appendChild(mk('line', { class: 'gl', x1: X(f), x2: X(f), y1: y1, y2: y0 }));
    }
    // axes
    svg.appendChild(mk('path', { class: 'ax', d: `M${x0} ${y1 - 4}V${y0}H${x1 + 4}` }));
    // y labels
    const yTop = mk('text', { x: x0 - 6, y: Y(data.el.vp) + 4, 'text-anchor': 'end' });
    yTop.textContent = fmt(data.el.vp, data.el.vp >= 100 ? 0 : 1);
    svg.appendChild(yTop);
    svg.appendChild(mk('line', { class: 'gl', x1: x0, x2: x1, y1: Y(data.el.vp), y2: Y(data.el.vp) }));
    const yZero = mk('text', { x: x0 - 6, y: y0 + 4, 'text-anchor': 'end' });
    yZero.textContent = '0';
    svg.appendChild(yZero);
    const yTitle = mk('text', { x: x0, y: 11, 'text-anchor': 'start' });
    yTitle.textContent = 'Speed (km/s)';
    svg.appendChild(yTitle);
    // x labels
    const xl = mk('text', { x: x0, y: y0 + 15, 'text-anchor': 'start' });
    xl.textContent = eccentric ? 'Lowest point' : '0';
    svg.appendChild(xl);
    if (eccentric) {
      const xm = mk('text', { x: X(0.5), y: y0 + 15, 'text-anchor': 'middle' });
      xm.textContent = 'Highest point';
      svg.appendChild(xm);
    }
    const xr = mk('text', { x: x1, y: y0 + 15, 'text-anchor': 'end' });
    xr.textContent = durText(T);
    svg.appendChild(xr);
    const xt = mk('text', { x: (x0 + x1) / 2, y: y0 + 32, 'text-anchor': 'middle' });
    xt.textContent = 'Time through one orbit';
    svg.appendChild(xt);
    // the curve
    const N = 120;
    let d = '';
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      d += `${i ? 'L' : 'M'}${X(f).toFixed(1)} ${Y(speedAt(f * T)).toFixed(1)}`;
    }
    svg.appendChild(mk('path', { class: 'cv', d }));
    markerLine = mk('line', { class: 'mkl', x1: x0, x2: x0, y1: y1, y2: y0 });
    marker = mk('circle', { class: 'mk', r: 5, cx: x0, cy: y0 });
    svg.append(markerLine, marker);
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { draw(); }) : null;
  if (ro) ro.observe(wrap);

  return {
    el: wrap,
    setData(body, elements) { data = { body, el: elements }; draw(); },
    setMarker(frac, speed) {
      if (!marker || !geo) return;
      const x = geo.X(frac);
      marker.setAttribute('cx', x.toFixed(1));
      marker.setAttribute('cy', geo.Y(speed).toFixed(1));
      markerLine.setAttribute('x1', x.toFixed(1));
      markerLine.setAttribute('x2', x.toFixed(1));
    },
    dispose() { if (ro) ro.disconnect(); },
  };
}

// ---------- the mode ----------
export default {
  id: 'orbits',
  label: 'Orbits',
  panelTitles: { a: 'Orbit', b: 'What happens', c: 'Time' },
  _cleanup: [],

  mount(ctx) {
    const { panelA, panelB, panelC, summaryEl, stageEl, store, stage, layers } = ctx;
    const cleanup = this._cleanup;

    const styleEl = el('style', { id: 'orbits-style', text: STYLE });
    document.head.appendChild(styleEl);
    cleanup.push(() => styleEl.remove());

    // ----- state helpers -----
    const getBody = () => BODIES[store.get().bodyId] || BODIES.earth;
    const getOrb = () => store.get().orbits;
    const setOrb = (patch) => store.set({ orbits: { ...store.get().orbits, ...patch } });

    // Only level 5 offers other worlds: below that, always start on Earth.
    if (!layers.is(5) && store.get().bodyId !== 'earth') { store.set({ bodyId: 'earth' }); setOrb({ pe: 400, ap: 400, presetId: 'iss' }); }
    // Repair stored state that does not fit the current body (for example after another mode changed the body).
    (function validate() {
      const body = getBody();
      const o = getOrb();
      const list = ORBIT_PRESETS[body.id] || [];
      const range = RANGES[body.id];
      const preset = list.find((p) => p.id === o.presetId);
      if (preset) {
        const a = presetAlts(body, preset);
        setOrb({ pe: a.pe, ap: a.ap });
      } else if (list.length && !(o.pe >= range[0] && o.pe <= range[1] && o.ap >= range[0] && o.ap <= range[1])) {
        const a = presetAlts(body, list[0]);
        setOrb({ pe: a.pe, ap: a.ap, presetId: list[0].id });
      } else if (o.ap < o.pe) {
        setOrb({ ap: o.pe });
      }
    })();

    // ----- 3D scene -----
    const world = new THREE.Group();
    stage.scene.add(world);
    const stars = createStars(220);
    const rings = createRings({ radiusUnits: 60, count: 3, axes: false });
    stage.scene.add(stars, rings.object);

    const noteEl = el('div', { class: 'orb-stage-note', text: 'Sun not to scale' });
    noteEl.style.display = 'none';
    stageEl.appendChild(noteEl);
    cleanup.push(() => noteEl.remove());

    const clock = createClock();
    const pathObj = createPath([[1, 0], [0, 1]], 1, { closed: true });
    const axisObj = createPath([[1, 0], [-1, 0]], 1, { dashed: true, opacity: 0.55, color: spaceTheme().ink2 });
    let loSide = 'above';
    let markerLo = createMarker('Lowest point', { side: loSide });
    const markerHi = createMarker('Highest point', { side: 'above' });
    const craft = createCraft({ trail: 70 });
    // Keep the craft visible when a low orbit passes behind the body (same choice as Launch mode).
    craft.object.traverse((o) => { if (o.material) o.material.depthTest = false; });
    const arrow = createArrow();
    const wedgeGroup = new THREE.Group();
    wedgeGroup.renderOrder = 1;
    world.add(wedgeGroup, axisObj.object, pathObj.object, markerLo.object, markerHi.object, craft.object, arrow.object);

    let bodyObj = null;
    let body = getBody();
    let elements = null;
    let k = 1;
    let bucket = null;
    let wedges = []; // { mesh, mat, base }
    let deep = layers.is(5);            // level 5 shows the speed arrow and the equal slices
    let pathKm = [[1, 0], [0, 1]];     // the path as orbit-plane points, for picking
    let lastR = null; let lastV = null; let lastS = null; // craft state now
    let arrowLen = ARROW_MAX;

    function wedgeColors() {
      const th = spaceTheme();
      return [new THREE.Color(th.accent), new THREE.Color(th.ink2)];
    }
    function disposeWedges() {
      for (const w of wedges) { w.mesh.geometry.dispose(); w.mat.dispose(); w.mesh.removeFromParent(); }
      wedges = [];
    }
    function buildWedges() {
      disposeWedges();
      const T = elements.period;
      const cols = wedgeColors();
      const per = 28;
      for (let i = 0; i < SLICES; i++) {
        const pos = new Float32Array(per * 9);
        let prev = positionAtTime(body.mu, elements, (i / SLICES) * T).r;
        for (let j = 1; j <= per; j++) {
          const cur = positionAtTime(body.mu, elements, ((i + j / per) / SLICES) * T).r;
          const o = (j - 1) * 9;
          // triangle: center, previous point, current point (orbit plane [x, y] -> scene (x, 0, -y))
          pos[o + 3] = prev[0] / k; pos[o + 5] = -prev[1] / k;
          pos[o + 6] = cur[0] / k; pos[o + 8] = -cur[1] / k;
          prev = cur;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const base = 0.2;
        const mat = new THREE.MeshBasicMaterial({ color: cols[i % 2], transparent: true, opacity: base, side: THREE.DoubleSide, depthWrite: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        mesh.renderOrder = 1;
        wedgeGroup.add(mesh);
        wedges.push({ mesh, mat, base });
      }
      wedgeGroup.visible = !!getOrb().showAreas && deep;
    }
    function tintWedges() {
      const cols = wedgeColors();
      wedges.forEach((w, i) => w.mat.color.copy(cols[i % 2]));
      axisObj.setColor(spaceTheme().ink2);
    }

    function setBody() {
      body = getBody();
      if (bodyObj) { bodyObj.dispose(); bodyObj = null; }
      bodyObj = createBody(body, k, { minRadiusUnits: body.id === 'sun' ? 3 : 0 });
      world.add(bodyObj.group);
      noteEl.style.display = bodyObj.exaggerated ? '' : 'none';
    }

    /** Recompute everything that depends on the orbit and redraw the 3D parts. */
    function rebuildGeometry(frameIfNeeded, forceFrame) {
      const o = getOrb();
      const frac = elements ? ((clock.t % elements.period) + elements.period) % elements.period / elements.period : 0;
      elements = elementsFor(body, o.pe, o.ap);
      const rawK = sceneScale(2.2 * elements.ra);
      const nb = Math.round(Math.log(rawK) / Math.log(BUCKET));
      const changed = nb !== bucket;
      bucket = nb;
      k = Math.pow(BUCKET, nb);
      if (!forceFrame) clock.reset(frac * elements.period);
      if (bodyObj) { bodyObj.setScale(k); noteEl.style.display = bodyObj.exaggerated ? '' : 'none'; }
      pathObj.setPoints(samplePath(body.mu, elements, 240), k);
      pathKm = samplePath(body.mu, elements, 120);
      const eccentric = elements.e > 0.02;
      axisObj.object.visible = eccentric;
      markerLo.object.visible = eccentric;
      markerHi.object.visible = eccentric;
      const wantSide = eccentric && elements.rp / elements.ra < 0.5 ? 'right' : 'above';
      if (wantSide !== loSide) {
        markerLo.dispose();
        loSide = wantSide;
        markerLo = createMarker('Lowest point', { side: loSide });
        world.add(markerLo.object);
      }
      markerLo.object.visible = eccentric;
      if (eccentric) {
        axisObj.setPoints([[elements.rp, 0], [-elements.ra, 0]], k);
        markerLo.setPosition([elements.rp, 0], k);
        markerHi.setPosition([-elements.ra, 0], k);
      }
      buildWedges();
      craft.clearTrail();
      if (frameIfNeeded && (changed || forceFrame)) frameSpace(stage, FRAME_EXTENT, { elevationDeg: ELEVATION });
    }

    // ----- per-frame update -----
    let lastReadout = 0;
    function update(dt, force) {
      if (!elements) return;
      const { playing, warp } = store.get().time;
      const T = elements.period;
      clock.tick(dt, warp, playing);
      if (clock.t > T * 1e4 || clock.t < 0) clock.reset(((clock.t % T) + T) % T);
      const t = ((clock.t % T) + T) % T;
      const s = positionAtTime(body.mu, elements, t);
      craft.setPosition(s.r, k);
      if (craft.setHeading && s.v) craft.setHeading(s.v);
      lastR = s.r; lastV = s.v; lastS = s;
      const o = getOrb();
      if (o.showVelocity && deep) {
        const rel = elements.vp > elements.va ? (s.speed - elements.va) / (elements.vp - elements.va) : 1;
        const len = elements.vp > elements.va ? ARROW_MIN + (ARROW_MAX - ARROW_MIN) * rel : ARROW_MAX;
        arrowLen = len;
        arrow.set(s.r, s.v, k, len);
      } else arrow.setVisible(false);
      if (o.showAreas && deep && wedges.length) {
        const cur = Math.min(SLICES - 1, Math.floor((t / T) * SLICES));
        wedges.forEach((w, i) => { const v = i === cur ? 0.42 : w.base; if (w.mat.opacity !== v) w.mat.opacity = v; });
      }
      if (bodyObj && bodyObj.group.userData.spin) bodyObj.group.userData.spin(playing ? dt : 0);
      graph.setMarker(t / T, s.speed);
      const nowMs = performance.now();
      if (force || nowMs - lastReadout > 90) {
        lastReadout = nowMs;
        paintLive(s, t);
      }
    }

    // ================= PANEL A =================
    // Level 1: question, four picture choices, one answer. Level 2: the story. Level 3: presets and the two point controls.
    const bodySel = select({
      label: TEXT.l5.world,
      options: BODY_ORDER.map((id) => ({ value: id, label: BODIES[id].name })),
      value: store.get().bodyId,
      onChange: (id) => changeBody(id),
    });

    const presetList = el('div', { class: 'orb-list', role: 'radiogroup', 'aria-label': TEXT.l3.controls.orbits });

    /** Slider on a log scale of altitude in km. The value shows miles first, then kilometers. */
    function altSlider(label, onKm) {
      let override = null;
      const ctl = slider({
        label, min: 0, max: 1000, step: 1, value: 0,
        format: (pos) => altParts(override != null ? override : round3(posToKm(pos, RANGES[getBody().id]))).text,
        onInput: (pos) => onKm(round3(posToKm(pos, RANGES[getBody().id]))),
      });
      return {
        el: ctl.el,
        setKm(km) { override = km; ctl.set(kmToPos(km, RANGES[getBody().id])); override = null; },
      };
    }

    const peSlider = altSlider(TEXT.l3.controls.lowest, (km) => {
      const o = getOrb();
      userChange({ pe: km, ap: Math.max(o.ap, km) });
    });
    const apSlider = altSlider(TEXT.l3.controls.highest, (km) => {
      const o = getOrb();
      userChange({ ap: km, pe: Math.min(o.pe, km) });
    });
    const circBtn = button({ label: TEXT.l3.controls.round, onClick: () => { const o = getOrb(); userChange({ ap: o.pe }); } });

    function presetName(b, p) { return b.id === 'earth' && !layers.is(5) && TEXT.l3.presetNames[p.id] ? TEXT.l3.presetNames[p.id] : p.name; }

    function renderPresetRows() {
      presetList.replaceChildren();
      const b = getBody();
      for (const p of ORBIT_PRESETS[b.id]) {
        const row = el('div', { class: 'layer-row', role: 'radio', tabindex: '0', 'data-preset': p.id, 'data-clickable': 'true' },
          el('div', { class: 'layer-main' }, el('div', { class: 'layer-name', text: presetName(b, p) }), el('div', { class: 'layer-sub', text: presetSub(b, p) })));
        const pick = () => applyPreset(p);
        row.addEventListener('click', pick);
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
        presetList.appendChild(row);
      }
      markSelected();
    }

    // level 1: big picture choices
    const choiceRow = el('div', { class: 'orb-choices', role: 'radiogroup', 'aria-label': TEXT.l1.pick });
    for (const c of TEXT.l1.choices) {
      const b = el('button', { type: 'button', class: 'orb-choice', role: 'radio', 'aria-checked': 'false', 'data-choice': c.id },
        el('span', { class: 'orb-choice-ico', 'aria-hidden': 'true', html: ICONS[c.id] || '' }),
        el('span', { class: 'orb-choice-label', text: c.label }));
      b.addEventListener('click', () => goPreset('earth', c.id, false));
      choiceRow.appendChild(b);
    }

    // "Try this": three steps at level 3, a fourth (equal slices) at level 5
    const tries = [
      { ...TEXT.l3.tries[0], run: () => goPreset('earth', 'iss', false) },
      { ...TEXT.l3.tries[1], run: () => goPreset('earth', 'geo', false) },
      { ...TEXT.l3.tries[2], run: () => goPreset('earth', 'molniya', false) },
      { ...TEXT.l5.extraTry, run: () => goPreset('earth', 'molniya', true) },
    ];
    const tryEl = tryThis(tries);
    layers.gate(tryEl.querySelectorAll('li')[3], 5, 5);

    // the story (level 2)
    const STORY_PRESETS = ['iss', 'gps', 'geo', 'molniya', 'moon'];
    const storyBox = story(
      TEXT.l2.steps.map((s, i) => ({ ...s, run: () => goPreset('earth', STORY_PRESETS[i], false) })),
      { title: 'The story' },
    );

    // ideas: information chips beside the key ideas
    const chip = (id, label, min) => layers.gate(infoChip(ctx.card, id, label), min, 5);
    const ideas = el('div', { class: 'orb-ideas', role: 'group', 'aria-label': 'Ideas' },
      chip('orbit', TEXT.l3.ideas.orbit, 1),
      chip('gravity', TEXT.l3.ideas.gravity, 1),
      chip('oval', TEXT.l3.ideas.oval, 2),
      chip('period', TEXT.l3.ideas.period, 2),
      chip('geostationary', TEXT.l3.ideas.geostationary, 2),
      chip('lowest', TEXT.l3.ideas.lowest, 3),
      chip('highest', TEXT.l3.ideas.highest, 3),
      chip('kepler', TEXT.l5.kepler, 5));

    const ans = answer({ kind: 'info', title: '', text: '' });
    // At level 2 the story step says the same thing in more words, so the answer waits until level 3.
    layers.gateFn(() => { ans.el.hidden = layers.level() === 2; });

    panelA.append(el('div', { class: 'orb-stack' },
      question(TEXT.l1.question, TEXT.l1.sub),
      layers.gate(choiceRow, 1, 1),
      layers.gate(storyBox.el, 2, 2),
      ans.el,
      layers.gate(el('div', {}, moreLink(layers)), 1, 2),
      layers.gate(bodySel.el, 5, 5),
      layers.gate(presetList, 3, 5),
      layers.gate(el('div', { class: 'orb-stack', style: { gap: '12px' } }, peSlider.el, apSlider.el, circBtn), 3, 5),
      layers.gate(tryEl, 3, 5),
      ideas,
    ));

    // ================= PANEL B (level 3 and up) =================
    const atmoBanner = banner({ kind: 'warn', text: TEXT.l3.messages.air });
    atmoBanner.style.display = 'none';

    const liveEl = el('p', { class: 'orb-live' });
    const barFill = el('div', { class: 'orb-bar-fill' });
    const barTick = el('div', { class: 'orb-bar-tick' });
    const barLo = el('span', { class: 'mono' });
    const barHi = el('span', { class: 'mono' });
    const speedBar = el('div', { class: 'orb-bar', 'data-numbers': 'false', role: 'img', 'aria-label': TEXT.l3.messages.barLabel },
      el('div', { class: 'orb-bar-track' }, barFill, barTick),
      el('div', { class: 'orb-bar-labels' }, el('span', {}, `${TEXT.l3.messages.slowest} `, barLo), el('span', {}, `${TEXT.l3.messages.fastest} `, barHi)));

    const tripVal = el('strong');
    const speedVal = el('strong');
    const facts = el('div', { class: 'orb-facts' },
      el('p', { class: 'orb-fact' }, `${TEXT.l3.messages.tripTime}: `, tripVal),
      el('p', { class: 'orb-fact' }, `${TEXT.l3.messages.speed}: `, speedVal));

    // level 4: stat tiles, each with US first, then metric, and one comparison line
    const T4 = TEXT.l4.tiles;
    const tLow = tile({ label: T4.lowest.label, us: '', si: '', compare: '', infoId: 'lowest' });
    const tHigh = tile({ label: T4.highest.label, us: '', si: '', compare: '', infoId: 'highest' });
    const tSpeed = tile({ label: T4.speed.label, us: '', si: '', compare: '', infoId: 'speed' });
    const tPeriod = tile({ label: T4.period.label, us: '', si: '', compare: '', infoId: 'period' });
    const tShape = tile({ label: T4.shape.label, us: '', si: '', compare: '', infoId: 'oval' });
    const tilesWrap = el('div', { class: 'sl-tiles' }, tLow.el, tHigh.el, tSpeed.el, tPeriod.el, tShape.el);
    const glossEl = el('p', { class: 'orb-cap', text: `Period: ${TEXT.l4.glosses.period} Eccentricity: ${TEXT.l4.glosses.eccentricity}` });

    // level 5: the detailed tiles, notes, formulas, compare table, speed graph, speed arrow switch
    const L5 = TEXT.l5.labels;
    const sPeriod = stat({ label: L5.period, value: 0, unit: 'min', source: TEXT.l5.sources.period, digits: 1 });
    const sVLow = stat({ label: L5.vLow, value: 0, unit: 'km/s', source: TEXT.l5.sources.speed, digits: 2 });
    const sVHigh = stat({ label: L5.vHigh, value: 0, unit: 'km/s', source: TEXT.l5.sources.speed, digits: 2 });
    const sAvg = stat({ label: L5.avg, value: 0, unit: 'km', source: TEXT.l5.sources.avg, digits: 0 });
    const sShape = stat({ label: L5.shape, value: 0, unit: '', source: TEXT.l5.sources.shape, digits: 2 });
    const sAlt = stat({ label: L5.altNow, value: 0, unit: 'km', digits: 0 });
    const sSpeedNow = stat({ label: L5.speedNow, value: 0, unit: 'km/s', digits: 2 });

    const note1 = el('p', { class: 'orb-note' });
    const note2 = el('p', { class: 'orb-note' });
    const note3 = el('p', { class: 'orb-note' });
    const formulaEls = TEXT.l5.formulas.map((f) => el('p', { class: 'orb-note orb-formula', text: f }));
    const notes = el('div', {}, note1, note2, note3, ...formulaEls);

    const tableEl = el('div', { class: 'orb-table', role: 'radiogroup', 'aria-label': 'Compare preset orbits' });

    const velToggle = toggle({ label: L5.arrow, value: getOrb().showVelocity, onChange: (v) => { setOrb({ showVelocity: v }); update(0, true); stage.requestRender(); } });
    const graph = createSpeedGraph();

    const deepBox = el('div', { class: 'orb-stack' },
      section(TEXT.l5.sections.key, stats(sPeriod.el, sVLow.el, sVHigh.el, sAvg.el, sShape.el)),
      section(TEXT.l5.sections.now, stats(sAlt.el, sSpeedNow.el)),
      section(TEXT.l5.sections.shows, notes),
      section(TEXT.l5.sections.show3d, el('div', { class: 'orb-row' }, velToggle.el, infoButton(ctx.card, 'arrow', { label: 'speed arrow' }))),
      section(TEXT.l5.sections.compare, tableEl),
      section(TEXT.l5.sections.graph, graph.el),
    );

    panelB.append(el('div', { class: 'orb-stack' },
      atmoBanner,
      layers.gate(el('div', { class: 'orb-stack', style: { gap: '10px' } }, liveEl, speedBar), 3, 5),
      layers.gate(facts, 3, 3),
      layers.gate(tilesWrap, 4, 5),
      layers.gate(glossEl, 4, 4),
      layers.gate(deepBox, 5, 5),
    ));

    function renderTable() {
      tableEl.replaceChildren();
      const b = getBody();
      tableEl.appendChild(el('div', { class: 'orb-th', 'aria-hidden': 'true' }, el('span', { text: L5.tableOrbit }), el('span', { text: L5.tableHeight }), el('span', { text: L5.tableTrip }), el('span', { text: L5.tableSpeed })));
      for (const p of ORBIT_PRESETS[b.id]) {
        const a = presetAlts(b, p);
        const e = elementsFor(b, a.pe, a.ap);
        const speeds = e.e < 1e-6 ? fmt(e.vp, 2) : `${fmt(e.vp, 2)} to ${fmt(e.va, 2)}`;
        const row = el('div', { class: 'orb-tr', role: 'radio', tabindex: '0', 'data-preset': p.id },
          el('span', { class: 'nm', text: p.name }),
          el('span', { text: rangeText(a.pe, a.ap) }),
          el('span', { class: 'mono', text: durText(e.period) }),
          el('span', { class: 'mono', text: speeds }));
        const pick = () => applyPreset(p);
        row.addEventListener('click', pick);
        row.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
        tableEl.appendChild(row);
      }
    }

    // ================= PANEL C (level 3 and up) =================
    let tc = null;
    const tcHost = el('div', {});
    let warpWin = [];
    function buildTimeControl() {
      const t = store.get().time;
      tc = timeControl({
        warps: warpWin,
        value: t.warp,
        playing: t.playing,
        label: TEXT.l3.controls.playback,
        onChange: ({ playing, warp }) => { store.set({ time: { playing, warp } }); stage.requestRender(); },
        onReset: () => { clock.reset(0); craft.clearTrail(); update(0, true); stage.requestRender(); },
      });
      tcHost.replaceChildren(tc.el);
    }
    /** Pick a default warp for the current orbit and show six speeds around it. */
    function setDefaultWarp() {
      const idx = idealWarpIndex(elements.period);
      warpWin = warpWindow(idx);
      const t = store.get().time;
      store.set({ time: { ...t, warp: WARP_LADDER[idx].value } });
      buildTimeControl();
    }
    /** After a slider move keep the chosen warp unless the orbit now looks far too fast or slow. */
    function keepWarpSensible() {
      const t = store.get().time;
      const onScreen = elements.period / t.warp;
      const idx = idealWarpIndex(elements.period);
      const win = warpWindow(idx);
      const inWin = win.some((w) => w.value === t.warp);
      if (onScreen < 3 || onScreen > 120 || !inWin) {
        if (onScreen < 3 || onScreen > 120) { setDefaultWarp(); return; }
        // inside a sensible range but outside the new list: add it by moving the window
        const cur = WARP_LADDER.findIndex((w) => w.value === t.warp);
        if (cur >= 0) { warpWin = warpWindow(Math.min(WARP_LADDER.length - 1, cur + 1)); buildTimeControl(); return; }
        setDefaultWarp();
      } else {
        if (warpWin.map((w) => w.value).join() !== win.map((w) => w.value).join() && !warpWin.some((w) => w.value === t.warp)) { warpWin = win; buildTimeControl(); }
      }
    }

    const areaCap = el('p', { class: 'orb-cap', text: L5.slicesCaption });
    const areaToggle = toggle({
      label: L5.slices, value: getOrb().showAreas && layers.is(5),
      onChange: (v) => setAreas(v),
    });
    areaCap.style.display = getOrb().showAreas ? '' : 'none';

    panelC.append(el('div', { class: 'orb-stack' },
      section('Playback', tcHost),
      layers.gate(section(TEXT.l5.sections.slices, el('div', { class: 'orb-row' }, areaToggle.el, infoButton(ctx.card, 'slices', { label: 'equal slices' })), areaCap), 5, 5),
    ));

    // ================= repaint =================
    function paintLive(s) {
      const alt = s.rMag - body.radius;
      const deepNums = layers.is(4);
      const sp = dual.kmps(s.speed);
      const al = altParts(alt);
      const where = body.id === 'sun' ? 'from the surface' : TEXT.l3.messages.upText;
      liveEl.textContent = `${TEXT.l3.messages.right}: ${deepNums ? sp.text : sp.us}, ${deepNums ? al.text : al.us} ${where}.`;
      sAlt.update(alt >= MILLION ? { value: alt / MILLION, unit: 'million km', digits: 1 } : { value: alt, unit: 'km', digits: 0 });
      sSpeedNow.update({ value: s.speed, digits: 2 });
      const span = elements.vp - elements.va;
      const u = span > 1e-9 ? clamp((s.speed - elements.va) / span, 0, 1) : 0.5;
      barTick.style.left = `${(u * 100).toFixed(1)}%`;
      barFill.style.width = `${(u * 100).toFixed(1)}%`;
    }

    /** Which words of the answer fit the orbit on screen. */
    function answerKey() {
      const o = getOrb();
      const e = elements;
      const earth = body.id === 'earth';
      if (e.e < 0.02) {
        if (earth && ['iss', 'gps', 'geo', 'moon'].includes(o.presetId)) return o.presetId;
        const geo = body.id !== 'sun' && Math.abs(e.period - body.rotationHours * 3600) / (body.rotationHours * 3600) < 0.02;
        return geo ? 'geo' : 'round';
      }
      if (o.showAreas && layers.is(5)) return 'slices';
      return earth && o.presetId === 'molniya' ? 'molniya' : 'oval';
    }

    function paintAnswer() {
      const a = TEXT.l1.answers[answerKey()];
      ans.update({ kind: 'info', title: a.title, text: a.text });
    }

    function markSelected() {
      const o = getOrb();
      for (const row of presetList.children) { row.dataset.selected = row.dataset.preset === o.presetId ? 'true' : 'false'; row.setAttribute('aria-checked', row.dataset.selected); }
      for (const row of tableEl.querySelectorAll('.orb-tr')) { row.dataset.selected = row.dataset.preset === o.presetId ? 'true' : 'false'; row.setAttribute('aria-checked', row.dataset.selected); }
      for (const b of choiceRow.children) {
        const on = body.id === 'earth' && b.dataset.choice === o.presetId;
        b.dataset.selected = on ? 'true' : 'false';
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      }
    }

    function paintResults() {
      const o = getOrb();
      const e = elements;
      const d = formatDuration(e.period);
      sPeriod.update({ value: d.value, unit: d.unit, digits: 1 });
      sVLow.update({ value: e.vp, digits: 2 });
      sVHigh.update({ value: e.va, digits: 2 });
      sAvg.update(e.a >= MILLION ? { value: e.a / MILLION, unit: 'million km', digits: 1 } : { value: e.a, unit: 'km', digits: 0 });
      sShape.update({ value: e.e, unit: shapeWord(e.e), digits: 2 });
      speedBar.dataset.numbers = layers.is(4) ? 'true' : 'false';
      barLo.textContent = layers.is(5) ? dual.kmps(e.va, 2).text : dual.kmps(e.va).us;
      barHi.textContent = layers.is(5) ? dual.kmps(e.vp, 2).text : dual.kmps(e.vp).us;
      speedBar.hidden = e.e < 0.02;

      // level 4 tiles
      const lo = altParts(o.pe);
      const hi = altParts(o.ap);
      tLow.update({ us: lo.us, si: lo.si, compare: T4.lowest.compare(o.pe) });
      tHigh.update({ us: hi.us, si: hi.si, compare: T4.highest.compare(o.ap) });
      const vp = dual.kmps(e.vp, 2);
      const va = dual.kmps(e.va, 2);
      if (e.e < 0.02) tSpeed.update({ us: vp.us, si: vp.si, compare: T4.speed.compare(e.vp) });
      else tSpeed.update({
        us: `${vp.us.replace(' mph', '')} to ${va.us}`,
        si: `${vp.si.replace(' km/s', '')} to ${va.si}`,
        compare: T4.speed.compare(e.vp),
      });
      tPeriod.update({ us: friendlyDuration(e.period), si: durText(e.period), compare: T4.period.compare(e.period) });
      tShape.update({ us: shapeWord(e.e).replace(/^./, (c) => c.toUpperCase()), si: `eccentricity ${fmt(e.e, 2)}`, compare: T4.shape.compare(e.e) });

      note1.textContent = e.e < 0.01 ? TEXT.l3.notes[2] : TEXT.l3.notes[0];
      note2.textContent = TEXT.l3.notes[1];
      const geo = body.id === 'earth' && e.e < 0.01 && Math.abs(e.period - 86164) < 400;
      note3.textContent = geo ? TEXT.l3.notes[3] : '';
      note3.style.display = geo ? '' : 'none';

      const sp = dual.kmps(e.vp);
      tripVal.textContent = friendlyDuration(e.period);
      speedVal.textContent = e.e < 0.02 ? sp.us : `${sp.us.replace(' mph', '')} to ${dual.kmps(e.va).us}`;
      paintAnswer();

      const pn = body.id === 'earth' && o.presetId && TEXT.l3.presetNames[o.presetId];
      const what = pn || orbitWord(body, e, { pe: o.pe });
      summaryEl.textContent = layers.is(3) ? `${body.name} · ${what} · ${shortTrip(e.period)} per trip` : `${body.name} · ${what}`;

      const atmo = body.atmosphere > 0 && o.pe < body.atmosphere;
      atmoBanner.style.display = atmo ? '' : 'none';
      markSelected();
      graph.setData(body, elements);
    }

    // ================= actions =================
    function syncSliders() {
      const o = getOrb();
      peSlider.setKm(o.pe);
      apSlider.setKm(o.ap);
    }

    /** A slider or button changed the orbit. */
    function userChange(patch) {
      setOrb({ ...patch, presetId: null });
      syncSliders();
      rebuildGeometry(true, false);
      keepWarpSensible();
      paintResults();
      update(0, true);
      stage.requestRender();
    }

    function setAreas(v) {
      const on = !!v && layers.is(5);
      setOrb({ showAreas: on });
      areaToggle.set(on);
      wedgeGroup.visible = on;
      areaCap.style.display = on ? '' : 'none';
      wedges.forEach((w) => { w.mat.opacity = w.base; });
      if (elements) { paintAnswer(); update(0, true); }
      stage.requestRender();
    }

    function applyPreset(p) {
      const a = presetAlts(body, p);
      setOrb({ pe: a.pe, ap: a.ap, presetId: p.id });
      syncSliders();
      rebuildGeometry(true, false);
      clock.reset(0);
      setDefaultWarp();
      paintResults();
      update(0, true);
      stage.requestRender();
    }

    function changeBody(id) {
      store.set({ bodyId: id });
      const list = ORBIT_PRESETS[id];
      const a = presetAlts(BODIES[id], list[0]);
      setOrb({ pe: a.pe, ap: a.ap, presetId: list[0].id });
      bucket = null; elements = null;
      setBody();
      afterBodyChange();
    }

    /** A choice, story step or "Try this" step: pick the world and the orbit, and set the equal slices switch. */
    function goPreset(bodyId, presetId, areas) {
      if (getBody().id !== bodyId) { bodySel.set(bodyId); changeBody(bodyId); }
      const p = ORBIT_PRESETS[bodyId].find((x) => x.id === presetId);
      if (!p) return;
      applyPreset(p);
      setAreas(areas);
    }

    function afterBodyChange() {
      renderPresetRows();
      renderTable();
      syncSliders();
      rebuildGeometry(true, true);
      clock.reset(0);
      setDefaultWarp();
      paintResults();
      update(0, true);
      stage.requestRender();
    }

    // ================= layers =================
    layers.gateFn((on) => { deep = on; wedgeGroup.visible = on && !!getOrb().showAreas; if (elements) update(0, true); stage.requestRender(); }, 5, 5);
    layers.onChange((lv, prev) => {
      // Only level 5 offers other worlds, the speed arrow and the equal slices. Going down returns to the Space Station.
      if (lv < 5 && getBody().id !== 'earth') goPreset('earth', 'iss', false);
      else if (lv < 5 && getOrb().showAreas) setAreas(false);
      if (lv === 2 && prev !== 2) storyBox.go(0);
      renderPresetRows();
      if (elements) { paintResults(); update(0, true); }
      stage.requestRender();
    });
    ctx.setPanelMin('b', 3);
    ctx.setPanelMin('c', 3);

    // ================= cards on the 3D view =================
    const proj = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const canvasEl = () => (stage.renderer && stage.renderer.domElement) || null;
    function toScreen(v3, rect) {
      proj.copy(v3).project(stage.camera);
      if (proj.z > 1) return null;
      return { x: rect.left + ((proj.x + 1) / 2) * rect.width, y: rect.top + ((1 - proj.y) / 2) * rect.height };
    }
    const kmToScene = (p) => tmp.set(p[0] / k, 0, -p[1] / k);
    function distToSegment(px, py, a, b) {
      const dx = b.x - a.x; const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? clamp(((px - a.x) * dx + (py - a.y) * dy) / len2, 0, 1) : 0;
      return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
    }
    /** Which thing is under the pointer: craft, markers, arrow, path, then the world itself. */
    function hitTest(clientX, clientY) {
      const cv = canvasEl();
      if (!cv || !elements || !stage.camera) return null;
      const rect = cv.getBoundingClientRect();
      if (!rect.width) return null;
      const reach = window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 28 : 20;
      const near = (v3, r) => { const s = toScreen(v3, rect); return s && Math.hypot(clientX - s.x, clientY - s.y) <= r; };
      if (lastR && near(kmToScene(lastR), reach)) return craftInfoId();
      if (elements.e > 0.02) {
        if (near(kmToScene([elements.rp, 0]), reach - 4)) return 'lowest';
        if (near(kmToScene([-elements.ra, 0]), reach - 4)) return 'highest';
      }
      if (deep && getOrb().showVelocity && arrow.object.visible && lastR && lastV) {
        const a = toScreen(kmToScene(lastR), rect);
        const dir = new THREE.Vector3(lastV[0], 0, -lastV[1]).normalize();
        const tip = toScreen(kmToScene(lastR).add(dir.multiplyScalar(arrowLen)), rect);
        if (a && tip && distToSegment(clientX, clientY, a, tip) <= 12) return 'arrow';
      }
      // the path: nearest drawn segment in screen space
      let best = Infinity;
      let prevS = null;
      for (let i = 0; i <= pathKm.length; i++) {
        const s = toScreen(kmToScene(pathKm[i % pathKm.length]).clone(), rect);
        if (s && prevS) best = Math.min(best, distToSegment(clientX, clientY, prevS, s));
        prevS = s;
      }
      if (best <= 9) return 'path';
      if (bodyObj) {
        const hit = stage.pick(clientX, clientY, [bodyObj.group]);
        if (hit) return body.id;
      }
      return null;
    }
    /** The craft card names what the craft stands for in the preset orbits. */
    function craftInfoId() {
      const o = getOrb();
      if (body.id === 'earth' && elements.e < 0.02) {
        if (o.presetId === 'moon') return 'moon';
        if (o.presetId === 'geo') return 'geostationary';
        if (o.presetId === 'iss' || o.presetId === 'gps') return o.presetId;
      }
      if (body.id === 'earth' && o.presetId === 'molniya') return 'molniya';
      return 'craft';
    }
    /** Live values at the top of a card (level 3 and up, so levels 1 and 2 stay free of digits). */
    function cardExtra(id) {
      if (!layers.is(3) || !elements) return [];
      const nowS = lastS;
      if ((id === 'craft' || id === 'iss' || id === 'gps' || id === 'molniya' || id === 'geostationary' || (id === 'moon' && body.id === 'earth')) && nowS) {
        return [
          { label: 'Speed now', value: dual.kmps(nowS.speed).us },
          { label: 'Height now', value: altParts(nowS.rMag - body.radius).us },
        ];
      }
      if (id === 'lowest') return [{ label: 'Height', value: altParts(getOrb().pe).us }, { label: 'Speed here', value: dual.kmps(elements.vp).us }];
      if (id === 'highest') return [{ label: 'Height', value: altParts(getOrb().ap).us }, { label: 'Speed here', value: dual.kmps(elements.va).us }];
      if (id === 'path') return [{ label: 'One trip', value: friendlyDuration(elements.period) }];
      return [];
    }
    function cardAt(clientX, clientY, pinned) {
      const id = hitTest(clientX, clientY);
      if (!id) return false;
      ctx.card.show(id, { x: clientX, y: clientY, pinned, extra: () => cardExtra(id) });
      return true;
    }
    const onHover = (e) => {
      if (e.pointerType === 'touch' || e.buttons) return;
      if (!cardAt(e.clientX, e.clientY, false)) ctx.card.hideHover();
    };
    const onLeave = () => ctx.card.hideHover();
    stageEl.addEventListener('pointermove', onHover);
    stageEl.addEventListener('pointerleave', onLeave);
    cleanup.push(() => { stageEl.removeEventListener('pointermove', onHover); stageEl.removeEventListener('pointerleave', onLeave); });
    cleanup.push(stage.onTap(({ clientX, clientY }) => {
      if (!cardAt(clientX, clientY, true) && ctx.card.isPinned()) ctx.card.hide();
    }));
    // ----- start -----
    ctx.card.setSource(getInfo);
    setBody();
    renderPresetRows();
    renderTable();
    syncSliders();
    rebuildGeometry(true, true);
    clock.reset(0);
    {
      // keep the stored warp when it already suits this orbit, otherwise pick one
      const t = store.get().time;
      const onScreen = elements.period / t.warp;
      const idx = idealWarpIndex(elements.period);
      if (WARP_LADDER.some((w) => w.value === t.warp) && onScreen >= 3 && onScreen <= 120) {
        warpWin = warpWindow(Math.min(WARP_LADDER.length - 1, Math.max(idx, WARP_LADDER.findIndex((w) => w.value === t.warp))));
        if (!warpWin.some((w) => w.value === t.warp)) warpWin = warpWindow(idx);
        buildTimeControl();
      } else setDefaultWarp();
    }
    paintResults();
    update(0, true);

    cleanup.push(stage.onFrame((dt) => update(dt)));
    cleanup.push(stage.onTheme(() => { tintWedges(); stage.requestRender(); }));
    cleanup.push(() => {
      disposeWedges();
      [arrow, craft, markerHi, markerLo, axisObj, pathObj].forEach((p) => p.dispose());
      if (bodyObj) bodyObj.dispose();
      bodyObj = null;
      stars.dispose();
      rings.dispose();
      graph.dispose();
      stage.scene.remove(world);
    });
  },

  unmount() {
    this._cleanup.splice(0).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  },
};
