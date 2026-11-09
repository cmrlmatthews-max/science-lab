// orbital/mode-orbits.js  Orbits mode of Orbital Mechanics ("simple first" version).
// One plain question: why do some satellites circle fast and others slow?
// Main view: World, Orbit list, Height slider and Shape. Everything technical (lowest and highest point
// sliders, stat tiles, compare table, speed graph, speed arrow switch, source tags) sits behind "Show numbers".
//
// State lives in ctx.store: bodyId, time {playing, warp}, orbits {pe, ap, presetId, showVelocity, showAreas, showNumbers}.
// pe and ap are altitudes above the surface in km. For the Sun the presets give distances from the center
// (peR, apR); they are converted to altitudes here.
// mode default export: { id, label, panelTitles, mount(ctx), unmount() }

import { THREE } from '../shared/scene.js';
import { el, fmt, select, slider, segmented, toggle, button, section, stats, stat, banner } from '../shared/ui.js';
import { question, answer, tryThis, numbersSwitch } from '../shared/simple.js';
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
const SHAPE_E = { circle: 0, oval: 0.3, long: 0.7 }; // how oval each Shape choice is

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
/** km/s to km/h, three significant figures, with thousands separators. */
function kmh(v) {
  const x = v * 3600;
  const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(x)) - 2));
  return fmt(Math.round(x / p) * p, 0);
}
function speedText(e) {
  return e.e < 0.02
    ? `${kmh(e.vp)} km/h (${fmt(e.vp, 1)} km/s)`
    : `${kmh(e.va)} to ${kmh(e.vp)} km/h (${fmt(e.va, 1)} to ${fmt(e.vp, 1)} km/s)`;
}
function shapeKind(e) { return e < 0.02 ? 'circle' : e < 0.5 ? 'oval' : 'long'; }

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
    const { panelA, panelB, panelC, summaryEl, stageEl, store, stage } = ctx;
    const cleanup = this._cleanup;

    const styleEl = el('style', { id: 'orbits-style', text: STYLE });
    document.head.appendChild(styleEl);
    cleanup.push(() => styleEl.remove());

    // ----- state helpers -----
    const getBody = () => BODIES[store.get().bodyId] || BODIES.earth;
    const getOrb = () => store.get().orbits;
    const setOrb = (patch) => store.set({ orbits: { ...store.get().orbits, ...patch } });

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
      wedgeGroup.visible = !!getOrb().showAreas;
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
      const o = getOrb();
      if (o.showVelocity) {
        const rel = elements.vp > elements.va ? (s.speed - elements.va) / (elements.vp - elements.va) : 1;
        const len = elements.vp > elements.va ? ARROW_MIN + (ARROW_MAX - ARROW_MIN) * rel : ARROW_MAX;
        arrow.set(s.r, s.v, k, len);
      } else arrow.setVisible(false);
      if (o.showAreas && wedges.length) {
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
    const bodySel = select({
      label: 'World',
      options: BODY_ORDER.map((id) => ({ value: id, label: BODIES[id].name })),
      value: store.get().bodyId,
      onChange: (id) => changeBody(id),
    });

    const presetList = el('div', { class: 'orb-list', role: 'radiogroup', 'aria-label': 'Orbits' });

    const heightFormat = (km) => (km >= MILLION ? `${fmt(km / MILLION, 1)} million` : fmt(km, 0));
    /** Slider on a log scale of altitude in km. */
    function altSlider(label, onKm) {
      let override = null;
      const ctl = slider({
        label, min: 0, max: 1000, step: 1, value: 0, unit: 'km',
        format: (pos) => heightFormat(override != null ? override : round3(posToKm(pos, RANGES[getBody().id]))),
        onInput: (pos) => onKm(round3(posToKm(pos, RANGES[getBody().id]))),
      });
      return {
        el: ctl.el,
        setKm(km) { override = km; ctl.set(kmToPos(km, RANGES[getBody().id])); override = null; },
      };
    }

    // The main slider: height of the lowest point. The highest point moves with it and keeps the same shape.
    const heightSlider = altSlider('Height', (km) => setHeight(km));
    const shapeCtl = segmented({
      label: 'Shape',
      options: [{ value: 'circle', label: 'Circle' }, { value: 'oval', label: 'Oval' }, { value: 'long', label: 'Long oval' }],
      value: 'circle',
      onChange: (v) => setShape(v),
    });

    // Detail controls (inside Show numbers): lowest and highest point.
    const peSlider = altSlider('Lowest point (altitude)', (km) => {
      const o = getOrb();
      userChange({ pe: km, ap: Math.max(o.ap, km) });
    });
    const apSlider = altSlider('Highest point (altitude)', (km) => {
      const o = getOrb();
      userChange({ ap: km, pe: Math.min(o.pe, km) });
    });
    const circBtn = button({ label: 'Make circular', onClick: () => { const o = getOrb(); userChange({ ap: o.pe }); } });

    function renderPresetRows() {
      presetList.replaceChildren();
      const b = getBody();
      for (const p of ORBIT_PRESETS[b.id]) {
        const row = el('div', { class: 'layer-row', role: 'radio', tabindex: '0', 'data-preset': p.id, 'data-clickable': 'true' },
          el('div', { class: 'layer-main' }, el('div', { class: 'layer-name', text: p.name }), el('div', { class: 'layer-sub', text: presetSub(b, p) })));
        const pick = () => applyPreset(p);
        row.addEventListener('click', pick);
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
        presetList.appendChild(row);
      }
    }

    const tryEl = tryThis([
      { label: 'A low orbit', hint: 'Close in. Very fast.', run: () => goPreset('earth', 'iss', false) },
      { label: 'A high orbit', hint: 'Far out. Slow. One trip takes a day.', run: () => goPreset('earth', 'geo', false) },
      { label: 'A long oval', hint: 'It speeds up when it comes close.', run: () => goPreset('earth', 'molniya', false) },
      { label: 'See the equal slices', hint: 'Each slice takes the same time.', run: () => goPreset('earth', 'molniya', true) },
    ]);

    panelA.append(el('div', { class: 'orb-stack' },
      question('Why do some satellites circle fast and others slow?', 'Pick an orbit. Watch how its height changes its speed.'),
      bodySel.el,
      presetList,
      el('div', { class: 'orb-stack', style: { gap: '12px' } }, heightSlider.el, shapeCtl.el),
      tryEl,
    ));

    // ================= PANEL B =================
    const ans = answer({ kind: 'info', title: '', text: '' });
    const atmoBanner = banner({ kind: 'warn', text: 'Too low. The air drags it down.' });
    atmoBanner.style.display = 'none';

    const liveEl = el('p', { class: 'orb-live' });
    const barFill = el('div', { class: 'orb-bar-fill' });
    const barTick = el('div', { class: 'orb-bar-tick' });
    const barLo = el('span', { class: 'mono' });
    const barHi = el('span', { class: 'mono' });
    const speedBar = el('div', { class: 'orb-bar', 'data-numbers': 'false', role: 'img', 'aria-label': 'Current speed between the slowest and the fastest' },
      el('div', { class: 'orb-bar-track' }, barFill, barTick),
      el('div', { class: 'orb-bar-labels' }, el('span', {}, 'Slowest ', barLo), el('span', {}, 'Fastest ', barHi)));

    const tripVal = el('strong');
    const speedVal = el('strong');
    const facts = el('div', { class: 'orb-facts' },
      el('p', { class: 'orb-fact' }, 'Trip time: ', tripVal),
      el('p', { class: 'orb-fact' }, 'Speed: ', speedVal));

    // Detail: tiles, notes, compare table, speed graph, speed arrow switch.
    const sPeriod = stat({ label: 'Time for one orbit', value: 0, unit: 'min', source: "Kepler's third law", digits: 1 });
    const sVLow = stat({ label: 'Speed at the lowest point', value: 0, unit: 'km/s', source: 'Vis-viva equation', digits: 2 });
    const sVHigh = stat({ label: 'Speed at the highest point', value: 0, unit: 'km/s', source: 'Vis-viva equation', digits: 2 });
    const sAvg = stat({ label: 'Average distance', value: 0, unit: 'km', source: 'Semi-major axis', digits: 0 });
    const sShape = stat({ label: 'Shape', value: 0, unit: '', source: 'Eccentricity', digits: 2 });
    const sAlt = stat({ label: 'Altitude now', value: 0, unit: 'km', digits: 0 });
    const sSpeedNow = stat({ label: 'Speed now', value: 0, unit: 'km/s', digits: 2 });

    const note1 = el('p', { class: 'orb-note' });
    const note2 = el('p', { class: 'orb-note' });
    const note3 = el('p', { class: 'orb-note' });
    const notes = el('div', {}, note1, note2, note3);

    const tableEl = el('div', { class: 'orb-table', role: 'radiogroup', 'aria-label': 'Compare preset orbits' });

    const velToggle = toggle({ label: 'Show speed arrow', value: getOrb().showVelocity, onChange: (v) => { setOrb({ showVelocity: v }); update(0, true); stage.requestRender(); } });
    const graph = createSpeedGraph();

    const numbers = numbersSwitch(
      {
        value: !!getOrb().showNumbers,
        onChange: (v) => { setOrb({ showNumbers: v }); speedBar.dataset.numbers = v ? 'true' : 'false'; },
      },
      section('Your orbit', peSlider.el, apSlider.el, circBtn),
      section('Key numbers', stats(sPeriod.el, sVLow.el, sVHigh.el, sAvg.el, sShape.el)),
      section('Right now', stats(sAlt.el, sSpeedNow.el)),
      section('What this shows', notes),
      section('Show on the 3D view', velToggle.el),
      section('Compare orbits', tableEl),
      section('Speed around the orbit', graph.el),
    );
    speedBar.dataset.numbers = numbers.get() ? 'true' : 'false';

    panelB.append(el('div', { class: 'orb-stack' },
      ans.el,
      atmoBanner,
      el('div', { class: 'orb-stack', style: { gap: '10px' } }, liveEl, speedBar),
      facts,
      numbers.el,
    ));

    function renderTable() {
      tableEl.replaceChildren();
      const b = getBody();
      tableEl.appendChild(el('div', { class: 'orb-th', 'aria-hidden': 'true' }, el('span', { text: 'Orbit' }), el('span', { text: 'Height' }), el('span', { text: 'One orbit' }), el('span', { text: 'Speed (km/s)' })));
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

    // ================= PANEL C =================
    let tc = null;
    const tcHost = el('div', {});
    let warpWin = [];
    function buildTimeControl() {
      const t = store.get().time;
      tc = timeControl({
        warps: warpWin,
        value: t.warp,
        playing: t.playing,
        label: 'Playback speed',
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

    const areaCap = el('p', { class: 'orb-cap', text: 'Each slice takes the same time.' });
    const areaToggle = toggle({
      label: 'Show equal slices', value: getOrb().showAreas,
      onChange: (v) => setAreas(v),
    });
    areaCap.style.display = getOrb().showAreas ? '' : 'none';

    panelC.append(el('div', { class: 'orb-stack' },
      section('Playback', tcHost),
      section('Equal slices', areaToggle.el, areaCap),
    ));

    // ================= repaint =================
    function paintLive(s) {
      const alt = s.rMag - body.radius;
      const up = alt >= MILLION ? `${fmt(alt / MILLION, 1)} million km` : `${fmt(alt, 0)} km`;
      liveEl.textContent = `Right now: ${fmt(s.speed, 1)} km/s, ${up} ${body.id === 'sun' ? 'from the surface' : 'up'}.`;
      sAlt.update(alt >= MILLION ? { value: alt / MILLION, unit: 'million km', digits: 1 } : { value: alt, unit: 'km', digits: 0 });
      sSpeedNow.update({ value: s.speed, digits: 2 });
      const span = elements.vp - elements.va;
      const u = span > 1e-9 ? clamp((s.speed - elements.va) / span, 0, 1) : 0.5;
      barTick.style.left = `${(u * 100).toFixed(1)}%`;
      barFill.style.width = `${(u * 100).toFixed(1)}%`;
    }

    function paintAnswer() {
      const o = getOrb();
      const e = elements;
      if (e.e < 0.02) {
        const geo = body.id !== 'sun' && Math.abs(e.period - body.rotationHours * 3600) / (body.rotationHours * 3600) < 0.02;
        ans.update({
          kind: 'info',
          title: 'A steady circle',
          text: `It moves at the same speed all the way around. One trip takes ${tripText(e.period)}.${geo ? ` That is one day, so it stays over one spot on ${body.name}.` : ''}`,
        });
      } else if (o.showAreas) {
        ans.update({
          kind: 'info',
          title: 'Equal slices, equal time',
          text: 'Each slice takes the same time to cross. Close in it is short and wide, far out it is long and thin, but the area is the same.',
        });
      } else {
        ans.update({
          kind: 'info',
          title: 'Fast when close, slow when far',
          text: 'Gravity pulls it in and speeds it up. As it climbs away it slows down again.',
        });
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
      barLo.textContent = `${fmt(e.va, 2)} km/s`;
      barHi.textContent = `${fmt(e.vp, 2)} km/s`;
      speedBar.hidden = e.e < 0.02;

      note1.textContent = e.e < 0.01
        ? 'The speed stays the same all the way around.'
        : 'The craft moves fastest at the lowest point and slowest at the highest point.';
      note2.textContent = 'A higher orbit is slower and takes longer.';
      const geo = body.id === 'earth' && e.e < 0.01 && Math.abs(e.period - 86164) < 400;
      note3.textContent = geo ? 'One orbit takes one Earth day, so the craft stays above the same place.' : '';
      note3.style.display = geo ? '' : 'none';

      tripVal.textContent = tripText(e.period);
      speedVal.textContent = speedText(e);
      paintAnswer();

      summaryEl.textContent = `${body.name} · ${orbitWord(body, e, { pe: o.pe })} · ${shortTrip(e.period)} per trip`;

      const atmo = body.atmosphere > 0 && o.pe < body.atmosphere;
      atmoBanner.style.display = atmo ? '' : 'none';
      for (const row of presetList.children) row.dataset.selected = row.dataset.preset === o.presetId ? 'true' : 'false';
      for (const row of presetList.children) row.setAttribute('aria-checked', row.dataset.selected);
      for (const row of tableEl.querySelectorAll('.orb-tr')) { row.dataset.selected = row.dataset.preset === o.presetId ? 'true' : 'false'; row.setAttribute('aria-checked', row.dataset.selected); }
      shapeCtl.set(shapeKind(e.e));
      graph.setData(body, elements);
    }

    // ================= actions =================
    function syncSliders() {
      const o = getOrb();
      heightSlider.setKm(o.pe);
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

    /** Height slider: move the lowest point and keep the same shape (how oval). */
    function setHeight(km) {
      const e = elements ? elements.e : 0;
      const hi = RANGES[body.id][1];
      const rp = body.radius + km;
      const ra = e < 1e-6 ? rp : (rp * (1 + e)) / (1 - e);
      userChange({ pe: km, ap: Math.max(km, Math.min(hi, ra - body.radius)) });
    }

    /** Shape control: keep the lowest point, raise the highest point to match the shape. */
    function setShape(kind) {
      const o = getOrb();
      const e = SHAPE_E[kind];
      if (e === 0) { userChange({ ap: o.pe }); return; }
      const [lo, hi] = RANGES[body.id];
      const R = body.radius;
      let pe = o.pe;
      let ap = ((R + pe) * (1 + e)) / (1 - e) - R;
      if (ap > hi) { // too far for this world: lower the lowest point to keep the shape
        ap = hi;
        pe = Math.max(lo, round3(((R + hi) * (1 - e)) / (1 + e) - R));
      }
      userChange({ pe, ap });
    }

    function setAreas(v) {
      setOrb({ showAreas: !!v });
      areaToggle.set(!!v);
      wedgeGroup.visible = !!v;
      areaCap.style.display = v ? '' : 'none';
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

    /** "Try this" step: pick the world and the orbit, and set the equal slices switch. */
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

    // ----- start -----
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
