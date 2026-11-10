// orbital/mode-launch.js  Launch mode: Newton's cannon, in five information layers.
// A craft starts at a height above a real body and is fired with a speed and an angle.
// Too slow: it falls back (impact). Fast enough: it goes around (orbit). Faster still: it leaves (escape).
//
// Layers (ctx.layers): 1 Start (question, three big choices, answer), 2 Story, 3 Explore (speed, height, aim, Try this, gauge),
// 4 Numbers (tiles with both unit formats), 5 Deep (formulas, other worlds, every number, every control).
// Words live in content-launch.js. Hover or tap on the 3D view opens an information card (ctx.card).
//
// The store is the single source of truth: every control writes store.launch / store.bodyId / store.time and a
// store subscriber redraws. Pure numbers come from launch-model.js (Node-testable); drawing uses space.js.

import { THREE } from '../shared/scene.js';
import {
  el, fmt, select, slider, button, toggle, section, stats, stat, legend, row, sourceTag,
} from '../shared/ui.js';
import { tryThis } from '../shared/simple.js';
import { story as makeStory, tile, moreLink } from '../shared/layers.js';
import { infoChip, infoButton } from '../shared/card.js';
import { dual, friendlyDuration } from '../shared/units.js';
import { BODIES, BODY_ORDER } from './bodies.js';
import { propagate, formatDuration, circularSpeed, escapeSpeed } from './physics.js';
import {
  sceneScale, setOrbitLift, liftRadius, toScene, createBody, createPath, createCraft, createArrow, createMarker, createStars, createRings,
  timeControl, createClock, frameSpace, spaceTheme,
} from './space.js';
import { ALT_RANGE, defaultLaunch, maxSpeed, computeLaunch, describe } from './launch-model.js';
import { TEXT, getInfo } from './content-launch.js';

// ---------- time warps ----------
// value 0 means "Auto": the mode picks a warp so the main event lasts 10 to 15 seconds on screen.
const WARPS_PLANET = [
  { value: 0, label: 'Auto' }, { value: 1, label: '×1' }, { value: 60, label: '×60' },
  { value: 600, label: '×600' }, { value: 3600, label: '×3600' },
];
const WARPS_SUN = [
  { value: 0, label: 'Auto' }, { value: 3600, label: '×3600' }, { value: 21600, label: '×21600' },
  { value: 86400, label: '×86400' }, { value: 604800, label: '×604800' },
];
const warpsFor = (bodyId) => (bodyId === 'sun' ? WARPS_SUN : WARPS_PLANET);

// ---------- small helpers ----------
const SPEED_STEPS = 2000;   // speed slider resolution (positions 0..2000 map to 0..1.5 x escape speed)
const ALT_STEPS = 1000;     // height slider positions (log scale)
const REPLAY_MS = 2400;     // levels 1 and 2: a finished flight starts again after this long
const snap3 = (v) => Number(v.toPrecision(3));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const T = TEXT;

function altOfPos(body, pos) {
  const [lo, hi] = ALT_RANGE[body.id];
  return lo * Math.pow(hi / lo, pos / ALT_STEPS);
}
function posOfAlt(body, alt) {
  const [lo, hi] = ALT_RANGE[body.id];
  return (Math.log(alt / lo) / Math.log(hi / lo)) * ALT_STEPS;
}

function durText(seconds) {
  const d = formatDuration(seconds);
  const v = Math.abs(d.value);
  return `${fmt(d.value, v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${d.unit}`;
}
function durParts(seconds) {
  const d = formatDuration(seconds);
  const v = Math.abs(d.value);
  return { value: d.value, unit: d.unit, digits: v >= 100 ? 0 : v >= 10 ? 1 : 2 };
}
function plainTime(seconds) {
  const d = formatDuration(seconds);
  const v = Math.abs(d.value);
  const unit = { s: 'seconds', min: 'minutes', h: 'hours', days: 'days' }[d.unit];
  const digits = v >= 10 ? 0 : 1;
  const shown = Number(v.toFixed(digits));
  return `${fmt(d.value, digits)} ${shown === 1 ? unit.replace(/s$/, '') : unit}`;
}
function flightPerSecond(warp) {
  const d = formatDuration(warp);
  const v = Math.abs(d.value);
  return `${fmt(d.value, v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${d.unit} of flight per second`;
}
const bigNum = (n) => Math.round(n).toLocaleString('en-US');
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** Large numbers as 1.33 × 10¹¹ so that table columns stay narrow. */
function sci(n) {
  if (n < 1e6) return bigNum(n);
  const e = Math.floor(Math.log10(n));
  return `${(n / Math.pow(10, e)).toFixed(2)} × 10${String(e).split('').map((c) => SUP[c]).join('')}`;
}

/** Which plain answer fits this result: drop, slow, up, skim, orbit, oval or escape. */
function outcomeKey(m) {
  if (m.outcome === 'escape') return 'escape';
  if (m.outcome === 'decay') return 'skim';
  if (m.outcome === 'orbit') return m.stats.circular ? 'orbit' : 'oval';
  if (m.speed < 1e-6) return 'drop';
  if (m.radial || (m.angleDeg > 30 && m.stats.climbs)) return 'up';
  return 'slow';
}
const KIND_OF = { drop: 'warn', slow: 'warn', up: 'warn', skim: 'warn', orbit: 'ok', oval: 'ok', escape: 'info' };
/** The three big choices use these groups. */
const CHOICE_OF = { drop: 'slow', slow: 'slow', up: 'slow', skim: 'slow', orbit: 'orbit', oval: 'orbit', escape: 'escape' };

const SVG_NS = 'http://www.w3.org/2000/svg';
function icon(kind) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 44 28');
  svg.setAttribute('aria-hidden', 'true');
  const add = (tag, attrs) => {
    const n = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    svg.append(n);
  };
  if (kind === 'slow') {
    add('path', { d: 'M3 26 L41 26' });
    add('path', { d: 'M5 6 C16 4 28 8 33 24' });
    add('path', { d: 'M29 20 L33 25 L37 20' });
  } else if (kind === 'orbit') {
    add('circle', { cx: 22, cy: 14, r: 12 });
    add('circle', { cx: 22, cy: 14, r: 4, fill: 'currentColor' });
    add('circle', { cx: 34, cy: 14, r: 2.6, fill: 'currentColor' });
  } else {
    add('circle', { cx: 8, cy: 20, r: 4 });
    add('path', { d: 'M14 16 L38 5' });
    add('path', { d: 'M31 4 L39 5 L35 12' });
  }
  return svg;
}

const CSS = `
.launch-hint { font-size: 12.5px; line-height: 1.4; color: var(--ink-2); }
.launch-why { display: flex; flex-direction: column; gap: 8px; font-size: 13px; line-height: 1.45; color: var(--ink); }
.launch-why p { margin: 0; }
.launch-live {
  position: absolute; left: 8px; top: 8px; z-index: 2; pointer-events: none;
  display: flex; flex-wrap: wrap; gap: 2px 12px; max-width: calc(100% - 16px);
  padding: 5px 8px; background: var(--paper-2); border: 1px solid var(--line); border-radius: var(--radius);
  font: 500 11.5px/1.3 var(--font-mono); font-variant-numeric: tabular-nums; color: var(--ink); opacity: 0.94;
}
.launch-live b { font-weight: 500; }
.launch-live span span { color: var(--ink-2); font-family: var(--font-body); margin-right: 4px; }
.launch-note {
  position: absolute; left: 8px; bottom: 6px; z-index: 2; pointer-events: none;
  font-size: 11.5px; color: var(--ink-2);
}
.launch-btns { display: flex; flex-wrap: wrap; gap: 8px; }
.launch-btns .btn { flex: 1 1 auto; }
.launch-stack { display: flex; flex-direction: column; gap: 16px; }
.launch-more { display: flex; flex-direction: column; gap: 14px; border-top: 1px solid var(--line); padding-top: 12px; }
.launch-speed-hint { margin-top: -4px; font-size: 13px; line-height: 1.4; color: var(--ink-2); }
.launch-choices { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.launch-choice {
  min-height: 76px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 4px; border: 1px solid var(--line-strong); border-radius: var(--radius);
  background: var(--paper-2); color: var(--ink); font: 500 14px/1.2 var(--font-body); cursor: pointer;
}
.launch-choice:hover { border-color: var(--ink-2); }
.launch-choice:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.launch-choice[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.launch-choice svg { width: 44px; height: 28px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; }
.launch-ideas { display: flex; flex-direction: column; gap: 6px; }
.launch-ideas-title { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.launch-ideas-row { display: flex; flex-wrap: wrap; gap: 8px 6px; }
.launch-head-i { display: inline-flex; align-items: center; gap: 6px; }
.launch-gauge { display: flex; flex-direction: column; gap: 4px; padding: 2px 4px 0; }
.launch-gauge-title { font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 0 -4px 2px; }
.launch-gauge-top, .launch-gauge-bot, .launch-gauge-zones { position: relative; height: 16px; font-size: 12px; line-height: 16px; color: var(--ink); white-space: nowrap; }
.launch-gauge-top span, .launch-gauge-bot span, .launch-gauge-zones span { position: absolute; top: 0; }
.launch-gauge-zones span { transform: translateX(-50%); color: var(--ink-2); }
.launch-gauge-you { transform: translateX(-50%); font-weight: 600; }
.launch-gauge-bar { position: relative; height: 10px; border-radius: 5px; background: var(--paper-3); border: 1px solid var(--line-strong); }
.launch-gauge-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: var(--accent); opacity: 0.35; }
.launch-gauge-tick { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; background: var(--ink); }
.launch-gauge-dot { position: absolute; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: var(--accent); border: 2px solid var(--paper-2); box-shadow: 0 0 0 1px var(--ink); }
.launch-gauge-lbl-orbit { transform: translateX(-100%); padding-right: 5px; }
.launch-gauge-lbl-escape { padding-left: 5px; }
.launch-gloss { display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.4; color: var(--ink-2); }
.launch-gloss p { margin: 0; }
.launch-gloss b { font-weight: 600; color: var(--ink); }
.launch-formula { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper-3); }
.launch-formula-name { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.launch-formula-eq { font: 500 13px/1.4 var(--font-mono); color: var(--ink); overflow-wrap: anywhere; }
.launch-formula-live { font: 500 12.5px/1.4 var(--font-mono); color: var(--ink-2); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.launch-formula-gloss { font-size: 12.5px; color: var(--ink-2); }
.launch-table-wrap { overflow-x: auto; }
.launch-table { width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
.launch-table th { text-align: left; font-weight: 600; color: var(--ink-2); padding: 4px 6px; border-bottom: 1px solid var(--line-strong); }
.launch-table td { padding: 4px 6px; border-bottom: 1px solid var(--line); white-space: nowrap; vertical-align: top; }
.launch-table td .launch-hint { font-size: 11px; }
.launch-table tr[data-now="true"] td { background: var(--accent-soft); }
`;

export default {
  id: 'launch',
  label: 'Launch',
  panelTitles: { a: 'Launch', b: 'What happens', c: 'Time' },
  _cleanup: [],

  mount(ctx) {
    const { stageEl, panelA, panelB, panelC, summaryEl, store, stage, layers, card, setPanelMin } = ctx;
    const cleanup = this._cleanup;
    let dead = false;
    const lv = () => layers.level();
    card.setSource(getInfo);
    setPanelMin('c', 3);   // the time controls appear with the first controls

    const styleEl = document.createElement('style');
    styleEl.id = 'launch-style';
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
    cleanup.push(() => styleEl.remove());

    // ---------- state ----------
    const bodyOf = () => BODIES[store.get().bodyId] || BODIES.earth;
    const getL = () => store.get().launch;
    function setL(patch) { store.set({ launch: { ...getL(), ...patch } }); }

    (function ensureState() {
      const s = store.get();
      // The world picker is a level 5 control, so lower levels always show Earth.
      const body = lv() < 5 ? BODIES.earth : (BODIES[s.bodyId] || BODIES.earth);
      let L = { showPath: true, showArrow: true, warp: 0, ...s.launch };
      delete L.showNumbers;
      const [lo, hi] = ALT_RANGE[body.id];
      if ((L.forBody ?? 'earth') !== body.id || !(L.alt >= lo && L.alt <= hi)) {
        const d = defaultLaunch(body);
        L = { ...L, alt: d.alt, speed: d.speed, warp: 0 };
      }
      L.forBody = body.id;
      L.alt = clamp(L.alt, lo, hi);
      L.speed = clamp(L.speed, 0, maxSpeed(body, L.alt));
      L.angleDeg = clamp(L.angleDeg ?? 0, -30, 90);
      if (L.warp !== 0 && !warpsFor(body.id).some((w) => w.value === L.warp)) L.warp = 0;
      store.set({ bodyId: body.id, launch: L });
    })();

    // ---------- 3D scene ----------
    const world = new THREE.Group();
    stage.scene.add(world);
    const stars = createStars(260);
    const rings = createRings({ radiusUnits: 100, count: 4, axes: false });
    stage.scene.add(stars, rings.object);

    let bodyObj = null;
    let bodyIdBuilt = null;
    let pathObj = null;
    let pathClosed = null;
    const craft = createCraft({ trail: 140 });
    const launchArrow = createArrow({ radius: 0.4 });
    const speedArrow = createArrow({ color: spaceTheme().craft, radius: 0.4 });
    const recolorArrow = () => speedArrow.object.traverse((o) => { if (o.material && o.material.color) o.material.color.set(spaceTheme().craft); });
    cleanup.push(stage.onTheme(() => { recolorArrow(); if (pathObj) pathObj.setColor(spaceTheme().ink); }));
    // The craft must stay visible when it sits on the surface at the impact point.
    craft.object.traverse((o) => { if (o.material) o.material.depthTest = false; });
    world.add(craft.object, launchArrow.object, speedArrow.object);
    // space.js setLabel can grow the label canvas, which a GPU texture cannot follow, so a new label or side means a new marker.
    const markers = {};
    const markerKm = {};   // marker name -> [x, y] km, used for picking
    function marker(name, label, side) {
      const key = `${label}|${side}`;
      if (!markers[name] || markers[name].key !== key) {
        if (markers[name]) markers[name].m.dispose();
        const m = createMarker(label, { side });
        world.add(m.object);
        markers[name] = { key, m };
      }
      return markers[name].m;
    }

    const clock = createClock();
    const sim = { r: [0, 0], v: [0, 0], t: 0, ended: null, autoPaused: false };
    let model = null;
    let kIdx = null;
    let k = 1;
    let endedAt = 0;
    const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    // ---------- unit text for the current level ----------
    const spText = (v, digits = 2) => (lv() >= 4 ? dual.kmps(v, digits).text : dual.kmps(v, digits).us);
    const lenText = (km) => {
      const digits = km >= 100 ? 0 : 1;
      return lv() >= 4 ? dual.km(km, digits).text : dual.km(km, digits).us;
    };

    // ---------- live readout (stage overlay and panel B) ----------
    const liveAlt = el('span', {}, el('span', { text: T.l5.live.altitude }), el('b', { text: '' }));
    const liveSpd = el('span', {}, el('span', { text: T.l5.live.speed }), el('b', { text: '' }));
    const liveTim = el('span', {}, el('span', { text: T.l5.live.time }), el('b', { text: '' }));
    const liveSimple = el('span', {}, el('b', { text: '' }));
    const overlay = el('div', { class: 'launch-live', 'aria-hidden': 'true' }, liveSimple, liveAlt, liveSpd, liveTim);
    const paintOverlayMode = () => {
      const on = lv() >= 4;
      liveAlt.style.display = liveSpd.style.display = liveTim.style.display = on ? '' : 'none';
      liveSimple.style.display = on ? 'none' : '';
    };
    const note = el('div', { class: 'launch-note' });
    stageEl.append(overlay, note);
    cleanup.push(() => { overlay.remove(); note.remove(); });
    const txt = { alt: '', spd: '', tim: '', plain: '' };

    const sAlt = stat({ label: 'Altitude', value: '—', unit: 'km' });
    const sSpd = stat({ label: 'Speed', value: '—', unit: 'km/s' });
    const sTim = stat({ label: 'Elapsed time', value: '—' });

    function plainLive() {
      const L = T.l1.live;
      if (sim.ended === 'impact') return L.landed;
      if (sim.ended === 'gone') return L.gone;
      if (sim.t < 1) return L.start;
      if (model.outcome === 'escape') return L.flying;
      if (model.outcome === 'impact') return L.falling;
      return L.orbiting;
    }
    function paintLive() {
      if (!model) return;
      const R = model.body.radius;
      const gone = sim.ended === 'gone';
      const alt = Math.max(0, Math.hypot(sim.r[0], sim.r[1]) - R);
      const spd = sim.ended === 'impact' ? model.stats.vImpact : Math.hypot(sim.v[0], sim.v[1]);
      const altS = gone ? 'Gone' : lenText(alt);
      const spdS = spText(spd, 2);
      const timS = durText(sim.t);
      let plainS;
      if (lv() <= 2) plainS = plainLive();
      else {
        plainS = sim.ended === 'impact' ? `Landed after ${plainTime(sim.t)}`
          : gone ? `Gone after ${plainTime(sim.t)}`
            : sim.t < 1 ? 'At launch' : `${plainTime(sim.t)} after launch`;
      }
      if (plainS !== txt.plain) { txt.plain = plainS; liveSimple.lastChild.textContent = plainS; }
      if (altS !== txt.alt) { txt.alt = altS; liveAlt.lastChild.textContent = altS; sAlt.update(gone ? { value: 'Gone', unit: '' } : { value: alt, unit: 'km', digits: alt >= 100 ? 0 : 1 }); }
      if (spdS !== txt.spd) { txt.spd = spdS; liveSpd.lastChild.textContent = spdS; sSpd.update({ value: spd, unit: 'km/s', digits: 2 }); }
      if (timS !== txt.tim) { txt.tim = timS; liveTim.lastChild.textContent = timS; const d = durParts(sim.t); sTim.update({ value: d.value, unit: d.unit, digits: d.digits }); }
    }

    // ---------- panel A: Launch ----------
    const bodySel = select({
      label: T.l5.world,
      options: BODY_ORDER.map((id) => ({ value: id, label: BODIES[id].name })),
      value: store.get().bodyId,
      onChange: (id) => switchBody(id),
    });
    function switchBody(id) {
      const b = BODIES[id];
      const d = defaultLaunch(b);
      const L = getL();
      const warp = L.warp === 0 || warpsFor(id).some((w) => w.value === L.warp) ? L.warp : 0;
      store.set({ bodyId: id, launch: { ...L, alt: d.alt, speed: d.speed, forBody: id, warp } });
    }

    function physicsHere() {
      const b = bodyOf();
      const r0 = b.radius + getL().alt;
      return { b, vc: Math.sqrt(b.mu / r0), ve: Math.sqrt((2 * b.mu) / r0) };
    }
    // Plain words for a speed, compared with orbit speed and escape speed at the start height.
    function speedWords(speed) {
      const { vc, ve } = physicsHere();
      const r = speed / vc;
      const W = T.l3.speedWords;
      if (speed < 1e-6) return W.none;
      if (r < 0.95) return W.slow;
      if (r <= 1.05) return W.orbit;
      if (speed < ve * 0.999) return W.fast;
      return W.escape;
    }
    function speedShort(speed) {
      const { vc, ve } = physicsHere();
      const r = speed / vc;
      if (speed < 1e-6) return 'no speed';
      if (r < 0.95) return `${fmt(r * 100, 0)}% of orbit speed`;
      if (r <= 1.05) return 'orbit speed';
      if (speed < ve * 0.999) return 'faster than orbit speed';
      return 'escape speed or more';
    }
    function angleWord(deg) {
      const W = T.l3.angleWords;
      if (deg < -0.5) return W.down;
      if (Math.abs(deg) < 0.5) return W.level;
      if (deg >= 89.5) return W.straight;
      return W.up;
    }
    const withInfo = (ctl, id, label) => {
      const head = ctl.el.querySelector('.field-head');
      const lab = ctl.el.querySelector('.field-label');
      if (head && lab) {
        const wrap = el('span', { class: 'launch-head-i' });
        lab.replaceWith(wrap);
        wrap.append(lab, infoButton(card, id, { label }));
      }
      return ctl;
    };

    let busy = null; // the slider the person is dragging right now
    const speedS = withInfo(slider({
      label: T.l3.controls.speed, min: 0, max: SPEED_STEPS, step: 1, value: 0, unit: '',
      format: () => spText(getL().speed, 2),
      onInput: (pos) => {
        const b = bodyOf();
        busy = 'speed';
        setL({ speed: (pos / SPEED_STEPS) * maxSpeed(b, getL().alt) });
        busy = null;
        speedS.set(speedS.get());
      },
    }), 'orbit_speed', T.l3.controls.speed);
    const speedHint = el('div', { class: 'launch-speed-hint' });

    const altS = withInfo(slider({
      label: T.l3.controls.height, min: 0, max: ALT_STEPS, step: 0.5, value: 0, unit: '',
      format: () => lenText(getL().alt),
      onInput: (pos) => {
        const b = bodyOf();
        const alt = snap3(altOfPos(b, pos));
        busy = 'alt';
        setL({ alt, speed: Math.min(getL().speed, maxSpeed(b, alt)) });
        busy = null;
        altS.set(altS.get());
      },
    }), 'speed_vs_height', T.l3.controls.height);
    const heightHint = el('div', { class: 'launch-hint', text: T.l3.heightHint });
    const angleS = withInfo(slider({
      label: T.l3.controls.angle, min: -30, max: 90, step: 1, value: 0, unit: '',
      format: () => (lv() >= 4 ? `${fmt(getL().angleDeg, 0)}° · ${angleWord(getL().angleDeg)}` : angleWord(getL().angleDeg)),
      onInput: (v) => {
        busy = 'angle';
        setL({ angleDeg: v });
        busy = null;
        angleS.set(angleS.get());
      },
    }), 'launch_angle', T.l3.controls.angle);
    const angleHint = el('div', { class: 'launch-hint', text: T.l3.angleHint });
    const angleHint5 = el('div', { class: 'launch-hint', text: T.l5.angleHint });
    const exactSpeedHint = el('div', { class: 'launch-hint' });
    const bDrop = button({ label: T.l5.quick.drop, onClick: () => setL({ speed: 0 }) });
    const bCirc = button({ label: T.l5.quick.circular, onClick: () => setL({ speed: physicsHere().vc, angleDeg: 0 }) });
    const bEsc = button({ label: T.l5.quick.escape, onClick: () => setL({ speed: physicsHere().ve, angleDeg: 0 }) });
    const quickBox = section(T.l5.sections.quick, el('div', { class: 'launch-btns' }, bDrop, bCirc, bEsc));

    // Every "play" sets the controls and starts the flight again.
    let playNext = false;
    function play(patch) {
      const before = getL();
      const b = bodyOf();
      const { vc, ve } = physicsHere();
      const p = typeof patch === 'function' ? patch(vc, ve) : patch;
      const alt = p.alt != null ? p.alt : before.alt;
      const speed = clamp(p.speed, 0, maxSpeed(b, alt));
      const angleDeg = p.angleDeg != null ? p.angleDeg : 0;
      const same = Math.abs(before.speed - speed) < 1e-12 && before.angleDeg === angleDeg && before.alt === alt;
      playNext = true;
      if (same) { restartSim(true); playNext = false; } else setL({ speed, angleDeg, alt });
    }
    // For the big choices and the story the start is always the usual height.
    const usual = () => defaultLaunch(bodyOf());
    const playRatio = (fn) => () => {
      const d = usual();
      const b = bodyOf();
      const vc = circularSpeed(b.mu, b.radius + d.alt);
      const ve = escapeSpeed(b.mu, b.radius + d.alt);
      play({ alt: d.alt, angleDeg: 0, speed: fn(vc, ve) });
    };
    const RUNS = [
      playRatio(() => 0),
      playRatio((vc) => 0.6 * vc),
      playRatio((vc) => 0.9 * vc),
      playRatio((vc) => vc),
      playRatio((vc) => 1.15 * vc),
      playRatio((vc, ve) => 1.02 * ve),
    ];
    const tryRuns = [
      () => play({ speed: 0, angleDeg: 0 }),
      () => play((vc) => ({ speed: 0.6 * vc, angleDeg: 0 })),
      () => play((vc) => ({ speed: vc, angleDeg: 0 })),
      () => play((vc, ve) => ({ speed: ve * 1.02, angleDeg: 0 })),
    ];
    const tryBox = tryThis(T.l3.tries.map((t, i) => ({ label: t.label, hint: t.hint, run: tryRuns[i] })));

    // level 1 and 2: three big choices
    const CHOICE_RUN = {
      slow: playRatio((vc) => 0.6 * vc),
      orbit: playRatio((vc) => vc),
      escape: playRatio((vc, ve) => 1.02 * ve),
    };
    const choiceBtns = {};
    const choicesBox = el('div', { class: 'launch-choices', role: 'group', 'aria-label': 'What speed do you pick?' },
      ...T.l1.choices.map((c) => {
        const b = el('button', { type: 'button', class: 'launch-choice', 'aria-pressed': 'false' }, icon(c.id === 'slow' ? 'slow' : c.id === 'orbit' ? 'orbit' : 'fast'), el('span', { text: c.label }));
        b.addEventListener('click', () => CHOICE_RUN[c.id]());
        choiceBtns[c.id] = b;
        return b;
      }));

    // level 2: the story
    // The story shows its current step in the 3D view when level 2 opens. If the person never pressed Back or Next,
    // the launch they had before comes back when they leave level 2.
    let storyTouched = false;
    let storyAuto = false;
    let beforeStory = null;
    const storyW = makeStory(T.l2.steps.map((s, i) => ({ ...s, run: RUNS[i] })), {
      title: 'The story',
      onStep: () => { if (!storyAuto) storyTouched = true; },
    });

    const speedBlock = el('div', { class: 'launch-stack', style: { gap: '8px' } }, speedS.el, speedHint);
    const altBlock = el('div', { class: 'launch-stack', style: { gap: '8px' } }, altS.el, heightHint);
    const angleBlock = el('div', { class: 'launch-stack', style: { gap: '8px' } }, angleS.el, angleHint, angleHint5);
    const moreA = el('div', { class: 'launch-more' }, exactSpeedHint, quickBox);

    layers.gate(choicesBox, 1, 1);
    layers.gate(storyW.el, 2, 2);
    layers.gate(bodySel.el, 5, 5);
    layers.gate(speedBlock, 3, 5);
    layers.gate(altBlock, 3, 5);
    layers.gate(angleBlock, 3, 5);
    layers.gate(angleHint, 3, 4);
    layers.gate(angleHint5, 5, 5);
    layers.gate(tryBox, 3, 5);
    layers.gate(moreA, 5, 5);

    const questionBox = el('div', { class: 'simple-q' }, el('h3', { class: 'simple-q-text', text: T.l1.question }), el('p', { class: 'simple-q-sub', text: T.l1.sub }));
    panelA.append(el('div', { class: 'launch-stack' },
      questionBox,
      choicesBox,
      storyW.el,
      bodySel.el,
      speedBlock,
      altBlock,
      angleBlock,
      tryBox,
      moreA,
    ));

    // ---------- panel C: Time ----------
    const timeBox = el('div');
    const autoHint = el('div', { class: 'launch-hint' });
    const togPath = toggle({ label: T.l5.toggles.path, value: getL().showPath, onChange: (v) => setL({ showPath: v }) });
    const togArrow = toggle({ label: T.l5.toggles.arrow, value: getL().showArrow, onChange: (v) => setL({ showArrow: v }) });
    const key = legend([
      { color: 'var(--ink)', label: T.l5.legend.path },
      { color: 'var(--hot)', label: T.l5.legend.craft },
      { color: 'var(--paper-2)', label: T.l5.legend.start },
    ]);
    key.lastChild.querySelector('.swatch').style.border = '2px solid var(--ink)';
    const exagNote = el('div', { class: 'launch-hint' });
    const moreC = el('div', { class: 'launch-more' }, autoHint, row(togPath.el), row(togArrow.el), key, exagNote);
    layers.gate(moreC, 5, 5);
    panelC.append(el('div', { class: 'launch-stack' }, timeBox, moreC));

    let tc = null;
    function buildTime() {
      const body = bodyOf();
      const list = warpsFor(body.id);
      const t = store.get().time;
      tc = timeControl({
        warps: list,
        value: getL().warp,
        playing: t.playing,
        onChange: ({ playing, warp }) => {
          const wasPlaying = store.get().time.playing;
          if (warp !== getL().warp) {
            setL({ warp });
            applyWarp();
          }
          if (playing !== wasPlaying) {
            store.set({ time: { ...store.get().time, playing } });
            if (playing && sim.ended) restartSim();
            sim.autoPaused = false;
          }
        },
        onReset: () => { restartSim(true); },
      });
      timeBox.replaceChildren(tc.el);
    }

    function applyWarp() {
      if (!model) return;
      const w = getL().warp === 0 ? model.autoWarp : getL().warp;
      const t = store.get().time;
      if (t.warp !== w) store.set({ time: { ...t, warp: w } });
      autoHint.textContent = getL().warp === 0 ? `${T.l5.autoSpeed}: ${flightPerSecond(w)}.` : `${flightPerSecond(w)}.`;
    }

    // ---------- panel B: What happens ----------
    const ans = (() => {
      const titleEl = el('div', { class: 'simple-answer-title' });
      const textEl = el('p', { class: 'simple-answer-text' });
      const box = el('div', { class: 'simple-answer', role: 'status', 'aria-live': 'polite' }, titleEl, textEl);
      return {
        el: box,
        update(p) {
          box.dataset.kind = p.kind || 'info';
          titleEl.textContent = p.title || '';
          textEl.textContent = p.text || '';
          textEl.hidden = !p.text;
        },
      };
    })();
    const more = moreLink(layers);

    const ideas = el('div', { class: 'launch-ideas' },
      el('div', { class: 'launch-ideas-title', text: 'Ideas' }),
      el('div', { class: 'launch-ideas-row' },
        infoChip(card, 'orbit', 'Orbit'),
        infoChip(card, 'gravity', 'Gravity'),
        infoChip(card, 'free_fall', 'Free fall'),
        infoChip(card, 'escape_speed', 'Escape speed'),
        infoChip(card, 'speed_vs_height', 'Speed and height')));
    layers.gate(ideas, 2, 5);

    // speed gauge: a bar from 0 to the top of the slider, zones (too slow, orbit, leaves), ticks, a marker for now
    const G = T.l3.gauge;
    const gTop = el('div', { class: 'launch-gauge-top' });
    const gYou = el('span', { class: 'launch-gauge-you', text: G.you });
    gTop.append(gYou);
    const gFill = el('div', { class: 'launch-gauge-fill' });
    const gTickO = el('div', { class: 'launch-gauge-tick' });
    const gTickE = el('div', { class: 'launch-gauge-tick' });
    const gDot = el('div', { class: 'launch-gauge-dot' });
    const gBar = el('div', { class: 'launch-gauge-bar' }, gFill, gTickO, gTickE, gDot);
    const gZ1 = el('span', { text: G.slowZone });
    const gZ2 = el('span', { text: G.orbitZone });
    const gZ3 = el('span', { text: G.escapeZone });
    const gZones = el('div', { class: 'launch-gauge-zones' }, gZ1, gZ2, gZ3);
    const gLblO = el('span', { class: 'launch-gauge-lbl-orbit', text: G.orbit });
    const gLblE = el('span', { class: 'launch-gauge-lbl-escape', text: G.escape });
    const gBot = el('div', { class: 'launch-gauge-bot' }, gLblO, gLblE);
    layers.gate(gBot, 4, 5);
    const gauge = el('div', { class: 'launch-gauge', role: 'img' },
      el('div', { class: 'launch-gauge-title', text: G.title }), gTop, gBar, gZones, gBot);
    layers.gate(gauge, 3, 5);
    function paintGauge(m) {
      const top = maxSpeed(m.body, m.alt);
      const pOrbit = (m.vc / top) * 100;
      const pEsc = (m.ve / top) * 100;
      const pNow = clamp((m.speed / top) * 100, 0, 100);
      gTickO.style.left = `${pOrbit}%`;
      gTickE.style.left = `${pEsc}%`;
      gLblO.style.left = `${pOrbit}%`;
      gLblE.style.left = `${pEsc}%`;
      gDot.style.left = `${pNow}%`;
      gFill.style.width = `${pNow}%`;
      gYou.style.left = `${clamp(pNow, 14, 86)}%`;
      gZ1.style.left = `${pOrbit / 2}%`;
      gZ2.style.left = `${(pOrbit + pEsc) / 2}%`;
      gZ3.style.left = `${(pEsc + 100) / 2}%`;
      gBar.style.background = `linear-gradient(to right, color-mix(in srgb, var(--warn) 22%, transparent) 0 ${pOrbit}%, color-mix(in srgb, var(--ok) 28%, transparent) ${pOrbit}% ${pEsc}%, color-mix(in srgb, var(--accent) 22%, transparent) ${pEsc}% 100%)`;
      gauge.setAttribute('aria-label', `Your speed is ${speedShort(m.speed)}. The bar shows too slow, orbit, and leaves.`);
    }

    // level 4: tiles with both unit formats and a comparison line
    const T4 = T.l4.tiles;
    const t4 = {
      speed: tile({ label: T4.speed.label, infoId: 'orbit_speed' }),
      height: tile({ label: T4.height.label, infoId: 'speed_vs_height' }),
      orbit: tile({ label: T4.orbit.label, infoId: 'orbit_speed' }),
      escape: tile({ label: T4.escape.label, infoId: 'escape_speed' }),
      period: tile({ label: T4.period.label, infoId: 'orbit' }),
      landing: tile({ label: T4.landing.label, infoId: 'gravity' }),
      far: tile({ label: T4.far.label, infoId: 'escape_speed' }),
    };
    const tiles4 = el('div', { class: 'sl-tiles' }, ...Object.values(t4).map((t) => t.el));
    const glossBox = el('div', { class: 'launch-gloss' },
      el('div', { class: 'launch-gauge-title', text: T.l4.glossTitle }),
      ...Object.entries(T.l4.glosses).map(([w, g]) => el('p', {}, el('b', { text: w }), ` means ${g}.`)));
    const level4Box = el('div', { class: 'launch-stack', style: { gap: '12px' } }, tiles4, glossBox);
    layers.gate(level4Box, 4, 4);

    // level 5: every number, why, right now, formulas, other worlds
    const tilesBox = stats();
    let tileSig = '';
    let tiles = {};
    const whyBox = el('div', { class: 'launch-why' });
    const formulaBox = el('div', { class: 'launch-stack', style: { gap: '8px' } });
    const formulaLive = {};
    for (const f of T.l5.formulas) {
      const live = el('div', { class: 'launch-formula-live' });
      formulaLive[f.id] = live;
      formulaBox.append(el('div', { class: 'launch-formula' },
        el('div', { class: 'launch-formula-name', text: f.name }),
        el('div', { class: 'launch-formula-eq', text: f.formula }),
        live,
        el('div', { class: 'launch-formula-gloss', text: f.gloss })));
    }
    const table = el('table', { class: 'launch-table' },
      el('thead', {}, el('tr', {}, ...T.l5.bodiesCols.map((c) => el('th', { scope: 'col', text: c })))),
      el('tbody', {}, ...BODY_ORDER.map((id) => {
        const b = BODIES[id];
        const two = (kmps) => { const d = dual.kmps(kmps, 2); return el('td', {}, el('div', { text: d.si }), el('div', { class: 'launch-hint', text: d.us })); };
        const tr = el('tr', { 'data-body': id },
          el('td', { text: b.name }),
          el('td', { text: sci(b.mu) }),
          el('td', {}, el('div', { text: `${bigNum(b.radius)} km` }), el('div', { class: 'launch-hint', text: dual.km(b.radius, 0).us })),
          two(circularSpeed(b.mu, b.radius)),
          two(escapeSpeed(b.mu, b.radius)));
        return tr;
      })));
    const tableBox = el('div', { class: 'launch-stack', style: { gap: '8px' } },
      el('div', { class: 'launch-table-wrap' }, table),
      el('div', { class: 'launch-hint' }, T.l5.bodiesTitle, ' ', sourceTag(T.l5.source)));
    const deepBox = el('div', { class: 'launch-stack' },
      section(T.l5.sections.numbers, tilesBox),
      section(T.l5.sections.why, whyBox),
      section(T.l5.sections.right, stats(sAlt.el, sSpd.el, sTim.el)),
      section(T.l5.sections.formulas, formulaBox),
      section(T.l5.sections.bodies, tableBox));
    layers.gate(deepBox, 5, 5);

    panelB.append(el('div', { class: 'launch-stack' }, ans.el, more, ideas, gauge, level4Box, deepBox));

    function tileDefs(m) {
      const defs = [
        { key: 'vc', label: 'Circular speed here', value: m.vc, unit: 'km/s', digits: 2, source: 'Speed that balances gravity at this height' },
        { key: 've', label: 'Escape speed here', value: m.ve, unit: 'km/s', digits: 2, source: 'Speed needed to leave and never come back' },
        { key: 'pct', label: 'Launch speed vs circular', value: (m.speed / m.vc) * 100, unit: '%', digits: 0, source: 'Your launch speed divided by circular speed', hint: `${fmt(m.speed, 2)} km/s launch speed` },
      ];
      const S = m.stats;
      if (m.outcome === 'orbit' || m.outcome === 'decay') {
        defs.push(
          { key: 'low', label: 'Lowest point', value: S.lowAlt, unit: 'km', digits: 0, source: 'Closest the path comes to the surface (altitude)' },
          { key: 'high', label: 'Highest point', value: S.highAlt, unit: 'km', digits: 0, source: 'Farthest the path gets from the surface (altitude)' },
          { key: 'per', label: 'Time for one orbit', ...durParts(S.period), source: 'How long one full loop takes' },
        );
        if (S.circular) defs.push({ key: 'fast', label: 'Orbit speed', value: S.vFast, unit: 'km/s', digits: 2, source: 'Almost constant on a round orbit' });
        else {
          defs.push(
            { key: 'slow', label: 'Slowest speed', value: S.vSlow, unit: 'km/s', digits: 2, source: 'Reached at the highest point' },
            { key: 'fast', label: 'Fastest speed', value: S.vFast, unit: 'km/s', digits: 2, source: 'Reached at the lowest point' },
          );
        }
      } else if (m.outcome === 'impact') {
        defs.push(
          { key: 'tim', label: 'Time to impact', ...durParts(S.tImpact), source: 'Flight time from launch to the ground' },
          { key: 'gnd', label: 'Distance over the ground', value: S.ground, unit: 'km', digits: 0, source: 'Distance along the surface from the start point below the craft to the impact point' },
          { key: 'vimp', label: 'Impact speed', value: S.vImpact, unit: 'km/s', digits: 2, source: 'Speed when the craft reaches the ground' },
        );
        if (S.climbs) defs.push({ key: 'high', label: 'Highest point', value: S.highAlt, unit: 'km', digits: 0, source: 'Highest altitude reached before falling back' });
      } else {
        defs.push({ key: 'vinf', label: 'Speed far away', value: S.vInf, unit: 'km/s', digits: 2, source: 'Speed left over after gravity has done its pulling' });
      }
      return defs;
    }

    function paintTiles4(m) {
      const S = m.stats;
      const sp = dual.kmps(m.speed, 2);
      t4.speed.update({ us: sp.us, si: sp.si, compare: T4.speed.compare(m.speed) });
      const h = dual.km(m.alt, m.alt >= 100 ? 0 : 1);
      t4.height.update({ us: h.us, si: h.si, compare: T4.height.compare(m.alt) });
      const o = dual.kmps(m.vc, 2);
      t4.orbit.update({ us: o.us, si: o.si, compare: T4.orbit.compare(m.vc) });
      const e = dual.kmps(m.ve, 2);
      t4.escape.update({ us: e.us, si: e.si, compare: T4.escape.compare(m.ve) });
      const looping = m.outcome === 'orbit' || m.outcome === 'decay';
      t4.period.el.hidden = !looping;
      t4.landing.el.hidden = m.outcome !== 'impact';
      t4.far.el.hidden = m.outcome !== 'escape';
      if (looping) t4.period.update({ us: friendlyDuration(S.period), si: durText(S.period), compare: T4.period.compare(S.period) });
      if (m.outcome === 'impact') t4.landing.update({ us: friendlyDuration(S.tImpact), si: durText(S.tImpact), compare: T4.landing.compare(S.tImpact) });
      if (m.outcome === 'escape') {
        const f = dual.kmps(S.vInf, 2);
        t4.far.update({ us: f.us, si: f.si, compare: T4.far.compare(S.vInf) });
      }
    }

    function paintFormulas(m) {
      const b = m.body;
      formulaLive.vc.textContent = `√(${bigNum(b.mu)} / ${bigNum(m.r0)}) = ${fmt(m.vc, 2)} km/s`;
      formulaLive.ve.textContent = `√(2 × ${bigNum(b.mu)} / ${bigNum(m.r0)}) = ${fmt(m.ve, 2)} km/s`;
      if (m.outcome === 'orbit' || m.outcome === 'decay') {
        formulaLive.T.textContent = `a = ${bigNum(m.el.a)} km, so T = ${durText(m.stats.period)}`;
        formulaLive.vv.textContent = `Lowest point ${fmt(m.stats.vFast, 2)} km/s, highest point ${fmt(m.stats.vSlow, 2)} km/s`;
      } else {
        formulaLive.T.textContent = 'This path does not repeat.';
        formulaLive.vv.textContent = m.outcome === 'escape' ? `Far away ${fmt(m.stats.vInf, 2)} km/s` : `At the ground ${fmt(m.stats.vImpact, 2)} km/s`;
      }
      table.querySelectorAll('tr[data-body]').forEach((tr) => { tr.dataset.now = tr.dataset.body === b.id ? 'true' : 'false'; });
    }

    function paintAnswer(m) {
      const keyName = outcomeKey(m);
      if (lv() <= 3) {
        const a = T.l1.answers[keyName];
        ans.update({ kind: KIND_OF[keyName], title: a.title, text: a.text });
      } else {
        const d = describe(m, fmt);
        ans.update({ kind: d.kind, title: d.title, text: d.text });
      }
      const grp = CHOICE_OF[keyName];
      for (const [id, b] of Object.entries(choiceBtns)) b.setAttribute('aria-pressed', id === grp ? 'true' : 'false');
    }

    function paintResults() {
      const m = model;
      const d = describe(m, fmt);
      paintAnswer(m);
      paintGauge(m);
      paintTiles4(m);
      paintFormulas(m);
      const defs = tileDefs(m);
      const sig = defs.map((x) => x.key).join(',');
      if (sig !== tileSig) {
        tileSig = sig;
        tiles = {};
        tilesBox.replaceChildren(...defs.map((x) => {
          const t = stat({ label: x.label, value: x.value, unit: x.unit, digits: x.digits, source: x.source, hint: x.hint });
          tiles[x.key] = t;
          return t.el;
        }));
      } else {
        defs.forEach((x) => tiles[x.key].update({ value: x.value, unit: x.unit, digits: x.digits, hint: x.hint }));
      }
      const wk = d.why.join('|');
      if (whyBox.dataset.k !== wk) {
        whyBox.dataset.k = wk;
        whyBox.replaceChildren(...d.why.map((t) => el('p', { text: t })));
      }
      const b = m.body;
      if (lv() <= 2) {
        summaryEl.textContent = `${b.name} · ${T.l1.summary[outcomeKey(m)]}`;
      } else {
        const tail = m.outcome === 'orbit' ? 'stays in orbit'
          : m.outcome === 'decay' ? 'skims the air and comes down'
            : m.outcome === 'impact' ? 'falls back' : 'escapes';
        summaryEl.textContent = `${b.name} · ${speedShort(m.speed)} · ${tail}`;
      }
    }

    // ---------- controls follow the store ----------
    function syncControls() {
      const L = getL();
      const b = bodyOf();
      const { vc, ve } = physicsHere();
      bodySel.set(b.id);
      if (busy !== 'alt') altS.set(posOfAlt(b, L.alt)); else altS.set(altS.get());
      if (busy !== 'speed') speedS.set((L.speed / maxSpeed(b, L.alt)) * SPEED_STEPS); else speedS.set(speedS.get());
      if (busy !== 'angle') angleS.set(L.angleDeg); else angleS.set(angleS.get());
      speedHint.textContent = lv() >= 4 ? `${cap(speedWords(L.speed))}. That is ${fmt((L.speed / vc) * 100, 0)}% of orbit speed.` : `${cap(speedWords(L.speed))}.`;
      exactSpeedHint.textContent = `Circular speed here is ${fmt(vc, 2)} km/s. Escape speed is ${fmt(ve, 2)} km/s. Launch speed is ${fmt(L.speed, 2)} km/s.`;
      togPath.set(L.showPath);
      togArrow.set(L.showArrow);
    }

    // ---------- simulation ----------
    function pauseAuto() {
      const t = store.get().time;
      if (t.playing) store.set({ time: { ...t, playing: false } });
      if (tc) tc.set({ playing: false });
      sim.autoPaused = true;
    }
    function resumeIfAuto() {
      if (!sim.autoPaused) return;
      sim.autoPaused = false;
      const t = store.get().time;
      store.set({ time: { ...t, playing: true } });
      if (tc) tc.set({ playing: true });
    }
    function restartSim(forcePlay = false) {
      if (!model) return;
      clock.reset(0);
      sim.r = model.start.r.slice();
      sim.v = model.start.v.slice();
      sim.t = 0;
      sim.ended = null;
      endedAt = 0;
      craft.clearTrail();
      if (forcePlay && !store.get().time.playing) {
        sim.autoPaused = false;
        store.set({ time: { ...store.get().time, playing: true } });
        if (tc) tc.set({ playing: true });
      } else resumeIfAuto();
      txt.alt = txt.spd = txt.tim = '';
      placeCraft();
    }
    function placeCraft() {
      craft.setPosition(sim.r, k);
      if (craft.setHeading && sim.v) craft.setHeading(sim.v);
      if (getL().showArrow && model) speedArrow.set(sim.r, sim.v, k, 8);
      else speedArrow.setVisible(false);
      paintLive();
    }
    function advance(target) {
      const mu = model.body.mu;
      let t = target;
      let hit = false;
      if (model.outcome === 'impact' && model.imp && t >= model.imp.t) { t = model.imp.t; hit = true; }
      const step = t - sim.t;
      if (step > 0) {
        const s = propagate(mu, sim.r, sim.v, step);
        sim.r = s.r; sim.v = s.v; sim.t = t;
      }
      if (hit) {
        sim.r = model.imp.r.slice();
        sim.ended = 'impact';
        clock.t = t;
        pauseAuto();
      } else if (model.outcome === 'escape' && Math.hypot(sim.r[0], sim.r[1]) >= model.leaveR) {
        sim.ended = 'gone';
        pauseAuto();
      }
    }
    function update() {
      if (!model || dead) return;
      const { playing, warp } = store.get().time;
      if (playing && !sim.ended) {
        const dt = frameDt;
        clock.tick(dt, warp, true);
        advance(clock.t);
      }
      placeCraft();
      // Levels 1 and 2: a finished flight starts again, so the view is never still.
      if (sim.ended && lv() <= 2 && !reduceMotion) {
        const now = performance.now();
        if (!endedAt) endedAt = now;
        else if (now - endedAt > REPLAY_MS) restartSim(true);
      } else endedAt = 0;
    }
    let frameDt = 0;

    // ---------- (re)build everything that depends on the inputs ----------
    function recompute() {
      const s = store.get();
      const body = BODIES[s.bodyId] || BODIES.earth;
      const L = s.launch;
      model = computeLaunch(body, L.alt, L.speed, L.angleDeg);
      const bodyChanged = bodyIdBuilt !== body.id;

      // extent bucket (x1.5 steps): rescale and reframe only when the path no longer fits or got much smaller
      setOrbitLift(body.id === 'sun' ? 0 : body.radius);
      const idx = Math.ceil(Math.log(liftRadius(model.extent)) / Math.log(1.5) - 1e-9);
      let rescaled = false;
      if (kIdx === null || bodyChanged || idx > kIdx || idx <= kIdx - 2) { kIdx = idx; rescaled = true; }
      k = sceneScale(Math.pow(1.5, kIdx));

      if (bodyChanged) {
        if (bodyObj) bodyObj.dispose();
        bodyObj = createBody(body, k, { minRadiusUnits: 1.2 });
        world.add(bodyObj.group);
        bodyIdBuilt = body.id;
        buildTime();
      } else if (rescaled) bodyObj.setScale(k);

      if (!pathObj || pathClosed !== model.closed) {
        if (pathObj) pathObj.dispose();
        pathObj = createPath(model.pts, k, { closed: model.closed, color: spaceTheme().ink, opacity: 0.9 });
        pathClosed = model.closed;
        world.add(pathObj.object);
      } else pathObj.setPoints(model.pts, k);
      pathObj.object.visible = L.showPath;

      // markers and launch arrow
      const r0v = [0, model.r0];
      // The arrow points along the launch direction, so the labels go on the other side of the dots.
      const steep = model.angleDeg >= 45;
      const wantLabel = model.startAt === 'lowest' ? 'Start, lowest point' : model.startAt === 'highest' ? 'Start, highest point' : 'Start';
      const mStart = marker('start', wantLabel, steep ? 'right' : 'left');
      mStart.setPosition(r0v, k);
      markerKm.start = r0v;
      const showImp = model.outcome === 'impact' && !!model.imp;
      const mImpact = marker('impact', 'Impact', steep ? 'left' : 'right');
      mImpact.object.visible = showImp;
      if (showImp) { mImpact.setPosition(model.imp.r, k); markerKm.impact = model.imp.r; }
      const showAp = !!model.apsides;
      const mLow = marker('low', 'Lowest point', 'left');
      const mHigh = marker('high', 'Highest point', 'right');
      mLow.object.visible = showAp && model.startAt !== 'lowest';
      mHigh.object.visible = showAp && model.startAt !== 'highest';
      if (showAp) { mLow.setPosition(model.apsides.peri, k); mHigh.setPosition(model.apsides.apo, k); markerKm.low = model.apsides.peri; markerKm.high = model.apsides.apo; }
      launchArrow.set(r0v, model.start.v, k, 12);
      recolorArrow();

      const exag = bodyObj.exaggerated;
      const msg = exag ? `${body.name} is not to scale here. It is drawn larger so that it stays visible.` : '';
      exagNote.textContent = msg;
      exagNote.style.display = msg ? '' : 'none';
      note.textContent = exag ? `${body.name} ${T.l1.notToScale}` : '';

      // Look almost straight down on the orbit plane: from a lower angle the body hides the far half of a low path.
      if (rescaled) frameSpace(stage, 100, { elevationDeg: 82, azimuthDeg: 0 });
      applyWarp();
      restartSim(playNext);
      playNext = false;
      paintResults();
      stage.requestRender();
    }

    function applyFlags() {
      if (pathObj) pathObj.object.visible = getL().showPath;
      placeCraft();
      stage.requestRender();
    }

    // coalesce rapid slider changes to one rebuild per animation frame
    let queued = 0;
    function schedule() {
      if (queued || dead) return;
      queued = requestAnimationFrame(() => { queued = 0; if (!dead) recompute(); });
    }
    cleanup.push(() => { dead = true; if (queued) cancelAnimationFrame(queued); });

    const unsub = store.subscribe((s, prev) => {
      if (dead || s.mode !== 'launch') return;
      if (s.bodyId !== prev.bodyId && getL().forBody !== s.bodyId) {
        const d = defaultLaunch(BODIES[s.bodyId]);
        setL({ alt: d.alt, speed: d.speed, forBody: s.bodyId, warp: 0 });
        return;
      }
      const a = s.launch;
      const b = prev.launch;
      const physics = s.bodyId !== prev.bodyId || a.alt !== b.alt || a.speed !== b.speed || a.angleDeg !== b.angleDeg;
      if (physics) { syncControls(); schedule(); }
      else if (a.showPath !== b.showPath || a.showArrow !== b.showArrow) { syncControls(); applyFlags(); }
    });
    cleanup.push(unsub);

    // ---------- the level changed: repaint every piece of text that depends on it ----------
    function repaintAll() {
      txt.alt = txt.spd = txt.tim = txt.plain = '';
      paintOverlayMode();
      syncControls();
      if (model) { paintResults(); paintLive(); }
      card.refresh();
      stage.requestRender();
    }
    cleanup.push(layers.onChange((now, prev) => {
      // Below level 5 the world picker is hidden, so go back to Earth.
      if (now < 5 && store.get().bodyId !== 'earth') switchBody('earth');
      repaintAll();
      // The story always starts by showing its current step in the 3D view.
      if (now === 2 && prev !== 2) {
        const { alt, speed, angleDeg } = getL();
        beforeStory = { alt, speed, angleDeg };
        storyAuto = true;
        storyW.go(storyW.index());
        storyAuto = false;
      } else if (prev === 2 && now !== 2 && !storyTouched && beforeStory) {
        const b = beforeStory;
        beforeStory = null;
        play({ alt: b.alt, speed: b.speed, angleDeg: b.angleDeg });
      }
    }));

    // ---------- information cards: hover (Mac) and tap (iPhone, iPad) on the 3D view ----------
    const canvas = stage.renderer ? stage.renderer.domElement : null;
    const proj = new THREE.Vector3();
    function screenOf(wp) {
      const r = canvas.getBoundingClientRect();
      proj.copy(wp).project(stage.camera);
      if (proj.z > 1) return null;
      return { x: r.left + ((proj.x + 1) / 2) * r.width, y: r.top + ((1 - proj.y) / 2) * r.height };
    }
    function distToSegment(px, py, a, b) {
      const dx = b.x - a.x; const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 ? clamp(((px - a.x) * dx + (py - a.y) * dy) / len2, 0, 1) : 0;
      return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
    }
    function arrowSegment(originKm, vec, len) {
      const o = toScene(originKm, k);
      const d = new THREE.Vector3(vec[0], 0, -vec[1]);
      if (d.lengthSq() < 1e-30) return null;
      d.normalize();
      const a = screenOf(o);
      const b = screenOf(o.clone().addScaledVector(d, len));
      return a && b ? [a, b] : null;
    }
    function visibleChain(o) {
      for (let p = o; p; p = p.parent) if (p.visible === false) return false;
      return true;
    }
    /** Returns the card id under the pointer, or null. The camera is never moved. */
    function pickId(cx, cy) {
      if (!model || !canvas) return null;
      const c = screenOf(toScene(sim.r, k));
      if (c && Math.hypot(cx - c.x, cy - c.y) < 22) return 'craft';
      for (const name of ['start', 'impact', 'low', 'high']) {
        const m = markers[name];
        if (!m || !visibleChain(m.m.object) || !markerKm[name]) continue;
        const p = screenOf(toScene(markerKm[name], k));
        if (p && Math.hypot(cx - p.x, cy - p.y) < 14) return name;
      }
      if (visibleChain(launchArrow.object)) {
        const seg = arrowSegment([0, model.r0], model.start.v, 12);
        if (seg && distToSegment(cx, cy, seg[0], seg[1]) < 12) return 'launch_arrow';
      }
      if (visibleChain(speedArrow.object)) {
        const seg = arrowSegment(sim.r, sim.v, 8);
        if (seg && distToSegment(cx, cy, seg[0], seg[1]) < 12) return 'speed_arrow';
      }
      if (pathObj && visibleChain(pathObj.object)) {
        let best = Infinity;
        let prev = null;
        for (const p of model.pts) {
          const s = screenOf(toScene(p, k));
          if (s && prev) best = Math.min(best, distToSegment(cx, cy, prev, s));
          prev = s;
        }
        if (best < 10) return 'path';
      }
      if (bodyObj && stage.pick(cx, cy, [bodyObj.group])) return model.body.id;
      return null;
    }
    function extraFor(id) {
      if (!model || lv() < 3) return undefined;
      const R = model.body.radius;
      const S = model.stats;
      const alt = (p) => Math.max(0, Math.hypot(p[0], p[1]) - R);
      switch (id) {
        case 'craft':
          return [
            { label: 'Speed now', value: spText(sim.ended === 'impact' ? S.vImpact : Math.hypot(sim.v[0], sim.v[1]), 2) },
            { label: 'Height now', value: sim.ended === 'gone' ? 'Gone' : lenText(alt(sim.r)) },
          ];
        case 'start': return [{ label: 'Start height', value: lenText(model.alt) }, { label: 'Launch speed', value: spText(model.speed, 2) }];
        case 'impact': return [{ label: 'Time to land', value: friendlyDuration(S.tImpact) }, { label: 'Speed at impact', value: spText(S.vImpact, 2) }];
        case 'low': return markerKm.low ? [{ label: 'Height', value: lenText(alt(markerKm.low)) }, { label: 'Speed here', value: spText(S.vFast, 2) }] : undefined;
        case 'high': return markerKm.high ? [{ label: 'Height', value: lenText(alt(markerKm.high)) }, { label: 'Speed here', value: spText(S.vSlow, 2) }] : undefined;
        case 'launch_arrow': return [{ label: 'Launch speed', value: spText(model.speed, 2) }];
        case 'speed_arrow': return [{ label: 'Speed now', value: spText(Math.hypot(sim.v[0], sim.v[1]), 2) }];
        case 'path':
          return (model.outcome === 'orbit' || model.outcome === 'decay')
            ? [{ label: 'Time for one trip', value: friendlyDuration(S.period) }] : undefined;
        default: return undefined;
      }
    }
    if (canvas) {
      let hoverRaf = 0;
      let hx = 0; let hy = 0;
      const onMove = (e) => {
        if (e.pointerType === 'touch' || e.buttons) { if (e.buttons) card.hideHover(); return; }
        hx = e.clientX; hy = e.clientY;
        if (hoverRaf) return;
        hoverRaf = requestAnimationFrame(() => {
          hoverRaf = 0;
          if (dead) return;
          const id = pickId(hx, hy);
          canvas.style.cursor = id ? 'help' : '';
          if (id) card.show(id, { x: hx, y: hy, extra: () => extraFor(id) }); else card.hideHover();
        });
      };
      const onLeave = () => { canvas.style.cursor = ''; card.hideHover(); };
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerleave', onLeave);
      cleanup.push(() => {
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerleave', onLeave);
        if (hoverRaf) cancelAnimationFrame(hoverRaf);
      });
    }
    cleanup.push(stage.onTap(({ clientX, clientY }) => {
      if (dead) return;
      const id = pickId(clientX, clientY);
      if (id) card.show(id, { x: clientX, y: clientY, pinned: true, extra: () => extraFor(id) });
      else if (card.isPinned()) card.hide();
    }));

    // first build
    paintOverlayMode();
    syncControls();
    recompute();
    cleanup.push(stage.onFrame((dt) => { frameDt = dt; update(); }));

    cleanup.push(() => {
      // hand shared time state back in a neutral shape for the other modes
      const t = store.get().time;
      store.set({ time: { playing: sim.autoPaused ? true : t.playing, warp: 1 } });
      [pathObj, craft, launchArrow, speedArrow, bodyObj, ...Object.values(markers).map((x) => x.m)].forEach((p) => { if (p) p.dispose(); });
      stars.dispose();
      rings.dispose();
      stage.scene.remove(world);
    });
  },

  unmount() {
    this._cleanup.splice(0).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  },
};
