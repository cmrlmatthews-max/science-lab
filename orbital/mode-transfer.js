// orbital/mode-transfer.js  Transfer mode (the two-burn Hohmann transfer between two circular orbits).
//
// STATE (ctx.store)
//   bodyId                         central body (shared with the other modes)
//   time {playing, warp}           warp = simulated seconds per real second (chosen from the coast time)
//   transfer {
//     alt1     start orbit height above the surface, km (for the Sun: distance from the Sun's center minus the Sun's radius)
//     r2       target orbit radius, km from the body's CENTER
//     presetId id from TRANSFER_PRESETS, or 'custom' after a slider or swap
//     isp      engine efficiency in seconds (280 solid, 340 kerosene, 450 hydrogen)
//     phase    'orbit1' | 'coast' | 'orbit2'
//     forBody  body the numbers belong to (so a body change made in another mode reloads a preset)
//     showBoth, showArrow            display toggles (level 5)
//     sim      { ang, s, alpha, missed, auto }  live flight state, mutated in place so it survives a mode switch
//   }
//
// INFORMATION LAYERS (ctx.layers, level 1-5 in store.level; see orbital/content-transfer.js for every word)
//   1 Start    question, answer, flight stages, three picture buttons (TV satellite height, Moon, Mars); the trip loops by itself. No digits.
//   2 Story    guided story (6 steps), fuel bar, idea chips with info cards.
//   3 Explore  world, trip presets, start and end height, push buttons, Try this, time control.
//   4 Numbers  five stat tiles (mph and km/s, miles and km, friendly time) with comparison lines.
//   5 Deep     live readouts, the plan, fuel numbers, formulas, engine type, display toggles, sources.
//   Cards: hover (Mac) or tap (phone) on the planet, craft, both orbits, the transfer path and the push markers.
//
// FLIGHT MODEL
//   Circles: the craft moves at a constant angular rate, counter-clockwise (same sense as positionAtTime).
//   Burn 1 fires where the craft is (angle alpha). The transfer ellipse is rotated so that its periapsis (going up) or
//   apoapsis (going down) sits at alpha. "Run it for me" fires burn 1 at once (wherever the craft is) and burn 2 at exactly the far end.
//   Burn 2 can be made by hand within +/- 6 % of the coast time from a far-end pass; on burn 2 the craft joins the target circle at the same
//   angle (a radial snap of under 1 % of the radius).
//   If the far end passes without burn 2 the craft stays on the oval and burn 2 is offered again at the next pass.
//   Display only: when the start orbit would sit on top of the body (low orbit at a large scale), every orbit is pushed outward by the
//   same small distance (under 1 scene unit) so the start orbit stays visible. When the body would be under 2 px, it is drawn larger
//   and labelled "not to scale".

import { THREE } from '../shared/scene.js';
import { el, select, slider, segmented, toggle, button, stat, stats, section, sourceTag, fmt } from '../shared/ui.js';
import { question, answer, tryThis } from '../shared/simple.js';
import { story, tile } from '../shared/layers.js';
import { infoChip, infoButton } from '../shared/card.js';
import { dual, friendlyDuration, nice } from '../shared/units.js';
import { TEXT, getInfo } from './content-transfer.js';
import { BODIES, BODY_ORDER, TRANSFER_PRESETS } from './bodies.js';
import { hohmann, elementsFromApsides, samplePath, positionAtTime, propellantFraction, formatDuration } from './physics.js';
import { sceneScale, setOrbitLift, createBody, createPath, createCraft, createArrow, createMarker, createStars, timeControl, frameSpace, spaceTheme } from './space.js';

const TWO_PI = Math.PI * 2;
const ENGINES = TEXT.l5.engines;
const SLIDER_RANGE = { earth: [200, 400000], moon: [20, 20000], mars: [100, 50000], sun: [40e6, 400e6] };
const FUEL_SOURCE = TEXT.l5.sources.fuel;
const WINDOW_FRAC = 0.06;
const FLASH_S = 0.9;
const LADDER = [
  [10, '10 s'], [20, '20 s'], [30, '30 s'], [60, '1 min'], [120, '2 min'], [300, '5 min'], [600, '10 min'], [1200, '20 min'],
  [1800, '30 min'], [3600, '1 h'], [7200, '2 h'], [10800, '3 h'], [21600, '6 h'], [43200, '12 h'], [86400, '1 day'],
  [172800, '2 days'], [259200, '3 days'], [432000, '5 days'], [864000, '10 days'], [1296000, '15 days'], [2592000, '30 days'],
  [5184000, '60 days'], [7776000, '90 days'],
];

const CSS = `
.tf-presets { display: flex; flex-direction: column; gap: 6px; }
.tf-preset { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; width: 100%; min-height: var(--ctl); padding: 7px 10px; text-align: left; border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper-3); color: var(--ink); }
.tf-preset:hover { border-color: var(--line-strong); }
.tf-preset[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent-edge); box-shadow: inset 2px 0 0 var(--accent); }
.tf-preset-name { font-weight: 600; font-size: 13px; line-height: 1.25; }
.tf-preset-sub { font-size: 11.5px; line-height: 1.3; color: var(--ink-2); }
.tf-flow { display: flex; flex-direction: column; gap: 8px; }
.tf-primary { width: 100%; min-height: 56px; font-size: 17px; font-weight: 600; }
.tf-primary:disabled { opacity: 0.4; cursor: default; }
.tf-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.tf-status { margin: 0; font-size: 13.5px; line-height: 1.4; color: var(--ink-2); min-height: 2.8em; }
.tf-label { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.tf-trip { margin: 0; font-size: 15px; font-weight: 600; color: var(--ink); }
.tf-fuel-text { margin: 0; font-size: 14px; line-height: 1.4; color: var(--ink); }
.tf-caption { font-size: 11.5px; line-height: 1.4; color: var(--ink-2); }
.tf-steps { display: flex; list-style: none; margin: 0; padding: 0; }
.tf-step { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; position: relative; text-align: center; }
.tf-step + .tf-step::before { content: ""; position: absolute; top: 13px; right: 50%; width: 100%; height: 2px; background: var(--line-strong); z-index: 0; }
.tf-step[data-state="done"] + .tf-step::before, .tf-step[data-state="current"]::before { background: var(--accent); }
.tf-dot { position: relative; z-index: 1; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; border: 2px solid var(--line-strong); background: var(--paper-2); color: var(--ink-2); font: 600 12px var(--font-mono); }
.tf-step[data-state="done"] .tf-dot { border-color: var(--accent); color: var(--accent); }
.tf-step[data-state="current"] .tf-dot { border-color: var(--accent); background: var(--accent); color: var(--accent-ink); }
.tf-step-label { font-size: 12px; line-height: 1.25; color: var(--ink-2); }
.tf-step[data-state="current"] .tf-step-label { color: var(--ink); font-weight: 600; }
.tf-bar { display: flex; height: 30px; border: 1px solid var(--line-strong); border-radius: var(--radius); overflow: hidden; background: var(--track); }
.tf-bar-fuel { background: var(--accent-soft); background: color-mix(in srgb, var(--accent) 38%, transparent); border-right: 1px solid var(--accent-edge); min-width: 0; display: flex; align-items: center; justify-content: center; font: 500 12px var(--font-mono); overflow: hidden; white-space: nowrap; }
.tf-bar-rest { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; justify-content: center; font: 500 12px var(--font-mono); color: var(--ink-2); overflow: hidden; white-space: nowrap; }
.tf-key { display: flex; flex-wrap: wrap; gap: 4px 16px; list-style: none; margin: 0; padding: 0; font-size: 12px; font-weight: 500; }
.tf-key li { display: flex; align-items: center; gap: 7px; min-height: 22px; }
.tf-key-sw { flex: none; width: 14px; height: 14px; border: 1px solid var(--line-strong); border-radius: 3px; }
.tf-note { font-size: 13px; line-height: 1.5; color: var(--ink); }
.tf-notes { display: flex; flex-direction: column; gap: 8px; }
.tf-time .seg-btn { white-space: normal; line-height: 1.2; padding: 6px 4px; font-size: 12.5px; }
.tf-sw-line { flex: none; width: 22px; height: 0; border-top: 2px solid var(--tf-c, var(--ink-2)); }
.tf-sw-line[data-dash="true"] { border-top-style: dashed; }
.tf-sw-dot { flex: none; width: 9px; height: 9px; border-radius: 50%; background: #fff; border: 2px solid #000; box-shadow: 0 0 0 1px #fff; margin: 0 6px; }
.tf-choices { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.tf-choice { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 6px; min-height: 104px; padding: 10px 6px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper-3); color: var(--ink-2); text-align: center; }
.tf-choice:hover { border-color: var(--line-strong); color: var(--ink); }
.tf-choice[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent-edge); box-shadow: inset 0 -2px 0 var(--accent); color: var(--ink); }
.tf-choice svg { flex: none; background: #000; border-radius: 50%; }
.tf-choice-label { font-size: 13.5px; font-weight: 600; line-height: 1.25; color: var(--ink); }
.tf-ideas { display: flex; flex-direction: column; gap: 6px; }
.tf-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.tf-explore { display: flex; flex-direction: column; gap: 12px; }
.tf-deep { display: flex; flex-direction: column; gap: 12px; }
.tf-formula { font-family: var(--font-mono); font-size: 12px; }
.section-title .sl-ibtn { margin-left: 6px; vertical-align: middle; }
.tf-3d-note { position: absolute; left: 10px; bottom: 8px; font-size: 11.5px; color: rgba(255,255,255,0.7); pointer-events: none; }
`;

// ---------- module state (survives only while mounted; the flight state itself lives in the store) ----------
let cleanup = [];
let dbg = { burn1: null, burn2: null, get: null };

const wrap2pi = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;
const pol = (ang, r) => [r * Math.cos(ang), r * Math.sin(ang)];
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function niceRound(v, body) {
  if (body.id === 'sun') return Math.round(v / 1e5) * 1e5;
  const mag = Math.pow(10, Math.floor(Math.log10(v)) - 2);
  return Math.max(1, Math.round(v / mag) * mag);
}

function pickWarps(refSeconds) {
  const target = Math.log(Math.max(refSeconds, 1) / 12);
  let best = 0;
  LADDER.forEach(([v], i) => { if (Math.abs(Math.log(v) - target) < Math.abs(Math.log(LADDER[best][0]) - target)) best = i; });
  const start = Math.min(Math.max(best - 1, 0), LADDER.length - 4);
  const warps = LADDER.slice(start, start + 4).map(([value, label]) => ({ value, label: `${label} per second` }));
  return { warps, def: LADDER[best][0] };
}

const FALLBACK_THEME = { ink: '#e4e7eb', ink2: '#aeb7c2', accent: '#58a6e0', craft: '#ff9a5c' };
const getTheme = () => ({ ...FALLBACK_THEME, ...spaceTheme() });

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const trimNum = (v, dp) => parseFloat(v.toFixed(dp));
// Plain-word duration: "40 minutes", "5 hours", "5 days", "8.5 months (259 days)".
function plainDur(seconds, both = false) {
  const s = Math.abs(seconds);
  if (s < 90) return plural(Math.max(1, Math.round(s)), 'second');
  if (s < 5400) return plural(Math.round(s / 60), 'minute');
  if (s < 172800) { const h = s / 3600; return plural(h < 10 ? trimNum(h, 1) : Math.round(h), 'hour'); }
  const d = s / 86400;
  if (d <= 60) return plural(d < 10 ? trimNum(d, 1) : Math.round(d), 'day');
  const m = trimNum(d / 30.44, 1);
  return both ? `${plural(m, 'month')} (${Math.round(d)} days)` : plural(m, 'month');
}

// How much of the craft is fuel, in plain words.
function fuelWords(f) {
  if (f < 0.12) return { head: 'A small part', short: 'a small part of the craft is fuel' };
  if (f < 0.37) return { head: 'About a quarter', short: 'about a quarter of the craft is fuel' };
  if (f < 0.54) return { head: 'About half', short: 'about half the craft is fuel' };
  if (f < 0.68) return { head: 'More than half', short: 'more than half the craft is fuel' };
  if (f < 0.87) return { head: 'About three quarters', short: 'about three quarters of the craft is fuel' };
  return { head: 'Almost all', short: 'almost all of the craft is fuel' };
}

const PLAIN = {
  'leo-geo': { name: 'To TV-satellite height', sub: 'From just above Earth to the height where TV satellites sit.', route: 'low orbit to TV-satellite height' },
  'leo-gps': { name: 'To GPS height', sub: 'From just above Earth to the height where GPS satellites fly.', route: 'low orbit to GPS height' },
  'leo-moon': { name: 'To the Moon\'s distance', sub: 'From just above Earth out to the Moon\'s distance.', route: 'low orbit to the Moon\'s distance' },
  'llo-high': { name: 'To a high orbit', sub: 'From just above the Moon up to a much higher orbit.', route: 'low orbit to high orbit' },
  'lmo-phobos': { name: 'To Phobos\'s height', sub: 'From just above Mars out to the height of its moon Phobos.', route: 'low orbit to Phobos\'s height' },
  'lmo-deimos': { name: 'To Deimos\'s height', sub: 'From just above Mars out to the height of its moon Deimos.', route: 'low orbit to Deimos\'s height' },
  'earth-mars': { name: 'Earth to Mars', sub: 'From Earth\'s path around the Sun to Mars\'s path.', route: 'Earth\'s path to Mars\'s path' },
  'earth-venus': { name: 'Earth to Venus', sub: 'From Earth\'s path around the Sun to Venus\'s path.', route: 'Earth\'s path to Venus\'s path' },
};

export default {
  id: 'transfer',
  label: 'Travel',
  panelTitles: { a: 'Trip', b: 'Numbers', c: 'Time' },
  get _debug() { return dbg; },

  mount(ctx) {
    setOrbitLift(0);   // this mode has its own display gap (see GAP)
    const { stageEl, panelA, panelB, panelC, summaryEl, store, stage, layers, card } = ctx;
    const lvl = () => layers.level();
    card.setSource(getInfo);
    ctx.setPanelMin('b', 4);
    ctx.setPanelMin('c', 3);
    const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    const styleEl = el('style', { id: 'transfer-style', text: CSS });
    document.head.appendChild(styleEl);
    cleanup.push(() => styleEl.remove());

    // ----- state helpers -----
    const getT = () => store.get().transfer;
    const setT = (patch) => store.set({ transfer: { ...store.get().transfer, ...patch } });
    const bodyOf = () => BODIES[store.get().bodyId] || BODIES.earth;

    function loadPreset(body, preset) {
      const alt1 = preset.alt1 != null ? preset.alt1 : preset.r1 - body.radius;
      const r2 = preset.r2 != null ? preset.r2 : body.radius + preset.alt2;
      setT({ alt1, r2, presetId: preset.id, forBody: body.id });
    }

    {
      const b = bodyOf();
      const T0 = getT();
      const list = TRANSFER_PRESETS[b.id] || [];
      const fresh = T0.forBody !== b.id || !T0.sim;
      if (T0.forBody !== b.id || (T0.presetId !== 'custom' && !list.some((p) => p.id === T0.presetId))) {
        loadPreset(b, list[0]);
        setT({ phase: 'orbit1', sim: { ang: 0, s: 0, alpha: 0, missed: false, auto: false } });
      } else if (fresh) {
        setT({ forBody: b.id, sim: { ang: 0, s: 0, alpha: 0, missed: false, auto: false } });
      }
      if (getT().showBoth == null) setT({ showBoth: true });
      if (getT().showArrow == null) setT({ showArrow: false });
    }
    const sim = getT().sim; // mutated in place
    if (!sim.phase) sim.phase = getT().phase || 'orbit1';

    // ----- derived numbers -----
    let g = null;
    function geometry() {
      const T = getT();
      const body = bodyOf();
      const r1 = body.radius + T.alt1;
      const r2 = T.r2;
      const same = Math.abs(r1 - r2) / Math.min(r1, r2) < 0.005;
      const up = r2 >= r1;
      const h = hohmann(body.mu, r1, r2);
      const dv1 = same ? 0 : h.dv1;
      const dv2 = same ? 0 : h.dv2;
      const total = dv1 + dv2;
      const tCoast = same ? 0 : h.time;
      const frac = same ? 0 : propellantFraction(total, T.isp);
      const el0 = elementsFromApsides(body.mu, Math.min(r1, r2), Math.max(r1, r2));
      return {
        body, mu: body.mu, r1, r2, same, up, dv1, dv2, total, tCoast, frac, el0, per: el0.period,
        v1: h.v1, v2: h.v2, n1: Math.sqrt(body.mu / (r1 * r1 * r1)), n2: Math.sqrt(body.mu / (r2 * r2 * r2)),
        p1: TWO_PI * Math.sqrt(r1 * r1 * r1 / body.mu), p2: TWO_PI * Math.sqrt(r2 * r2 * r2 / body.mu),
      };
    }
    const rotFor = (alpha) => (g.up ? alpha : alpha - Math.PI);
    const elRot = () => ({ ...g.el0, argPeri: rotFor(sim.alpha) });

    // ----- 3D -----
    const world = new THREE.Group();
    stage.scene.add(world);
    const stars = createStars(260);
    stage.scene.add(stars);
    const tfGroup = new THREE.Group(); // holds the transfer paths, rotated to the burn 1 point
    world.add(tfGroup);

    let theme = getTheme();
    const dummy = [[0, 0], [1, 0]];
    const noDepth = (p, order) => { p.object.material.depthTest = false; p.object.renderOrder = order; return p; };
    let bodyObj = null;
    const bodyOpts = { minRadiusUnits: 0 };
    let k = 1;
    let ek = 0; // radial display offset, km
    let lastBucket = null;
    let lastBodyId = null;

    const startPath = noDepth(createPath(dummy, 1, { closed: true, color: theme.ink2, opacity: 0.85 }), 4);
    const targetDash = noDepth(createPath(dummy, 1, { closed: true, dashed: true, color: theme.accent, opacity: 0.8 }), 3);
    const targetSolid = noDepth(createPath(dummy, 1, { closed: true, color: theme.accent, opacity: 0.95 }), 4);
    const previewPath = noDepth(createPath(dummy, 1, { dashed: true, color: theme.craft, opacity: 0.6 }), 5);
    const livePath = noDepth(createPath(dummy, 1, { color: theme.craft, opacity: 0.95 }), 6);
    const fullPath = noDepth(createPath(dummy, 1, { closed: true, color: theme.craft, opacity: 0.8 }), 6);
    world.add(startPath.object, targetDash.object, targetSolid.object);
    tfGroup.add(previewPath.object, livePath.object, fullPath.object);

    const craft = createCraft({ trail: 140 });
    const speedArrow = createArrow({ radius: 0.3 });
    let flashArrow = createArrow({ color: theme.craft, radius: 0.42 });
    world.add(craft.object, speedArrow.object, flashArrow.object);
    let marker1 = null;
    let marker2 = null;
    let flash = null; // { origin:[x,y] km, dir:[x,y], t }
    let holdAt = null; // story: pause the coast when sim.s reaches this many seconds
    let dwell = 0;     // level 1: seconds spent in the high orbit before the loop starts again
    const pushLabel = (n) => (lvl() >= 5 ? `Burn ${n}` : n === 1 ? TEXT.l1.labels.push1 : TEXT.l1.labels.push2);

    const note3d = el('div', { class: 'tf-3d-note', text: '' });
    stageEl.appendChild(note3d);

    function rebuildBody() {
      if (bodyObj) bodyObj.dispose();
      const body = bodyOf();
      bodyObj = createBody(body, k, bodyOpts);
      world.add(bodyObj.group);
      lastBodyId = body.id;
    }

    // display mapping: push every point radially outward by ek km when the body is exaggerated
    const disp = (p) => {
      if (!ek) return p;
      const r = Math.hypot(p[0], p[1]);
      if (r < 1e-9) return p;
      const s = (r + ek) / r;
      return [p[0] * s, p[1] * s];
    };
    const dispAll = (pts) => (ek ? pts.map(disp) : pts);

    function applyTheme() {
      theme = getTheme();
      startPath.setColor(theme.ink2);
      targetDash.setColor(theme.accent);
      targetSolid.setColor(theme.accent);
      previewPath.setColor(theme.craft);
      livePath.setColor(theme.craft);
      fullPath.setColor(theme.craft);
      flashArrow.dispose();
      flashArrow = createArrow({ color: theme.craft, radius: 0.42 });
      world.add(flashArrow.object);
      paintLegend();
      stage.requestRender();
    }

    function placeMarkers() {
      if (marker1) { marker1.dispose(); marker1 = null; }
      if (marker2) { marker2.dispose(); marker2 = null; }
      if (sim.phase === 'orbit1' || g.same) return;
      const a = pol(sim.alpha, g.r1);
      const b = pol(sim.alpha + Math.PI, g.r2);
      marker1 = createMarker(pushLabel(1), { side: a[0] >= 0 ? 'right' : 'left' });
      marker2 = createMarker(pushLabel(2), { side: b[0] >= 0 ? 'right' : 'left' });
      marker1.setPosition(disp(a), k);
      marker2.setPosition(disp(b), k);
      world.add(marker1.object, marker2.object);
    }

    function syncVisibility() {
      const T = getT();
      const both = T.showBoth !== false;
      const ph = sim.phase;
      const same = g.same;
      startPath.object.visible = both || ph === 'orbit1';
      targetDash.object.visible = !same && ph !== 'orbit2' && both;
      targetSolid.object.visible = !same && ph === 'orbit2';
      previewPath.object.visible = !same && ph === 'orbit1';
      const coasting = ph === 'coast';
      livePath.object.visible = !same && ((coasting && !sim.missed) || (ph === 'orbit2' && both));
      livePath.object.material.opacity = ph === 'orbit2' ? 0.4 : 0.95;
      fullPath.object.visible = !same && coasting && sim.missed;
      if (marker1) marker1.object.visible = true;
      if (marker2) marker2.object.visible = true;
      stage.requestRender();
    }

    function applyScene({ reframe }) {
      const body = g.body;
      const raw = sceneScale(2.2 * Math.max(g.r1, g.r2));
      const bucket = Math.round(Math.log(raw) / Math.log(1.5));
      k = Math.pow(1.5, bucket);

      // body size and radial offset: keep a small visible gap between the body and the start orbit
      const GAP = 3;   // drawn gap between the body and the start orbit (not to scale, so that the low orbit reads)
      const realUnits = body.radius / k;
      const minR = body.id === 'sun' ? 3 : (realUnits < 1.6 ? 1.6 : 0);
      bodyOpts.minRadiusUnits = minR;
      const drawnR = Math.max(realUnits, minR);
      ek = Math.max(0, drawnR + GAP - g.r1 / k) * k;
      if (!bodyObj || lastBodyId !== body.id) rebuildBody(); else bodyObj.setScale(k);
      note3d.textContent = bodyObj.exaggerated ? `${body.name} ${TEXT.l1.labels.notToScale}` : '';

      startPath.setPoints(dispAll(samplePath(g.mu, elementsFromApsides(g.mu, g.r1, g.r1), 200)), k);
      const tgt = dispAll(samplePath(g.mu, elementsFromApsides(g.mu, g.r2, g.r2), 200));
      targetDash.setPoints(tgt, k);
      targetSolid.setPoints(tgt, k);
      if (!g.same) {
        const half = samplePath(g.mu, g.el0, 140, { fromNu: g.up ? 0 : Math.PI, toNu: g.up ? Math.PI : TWO_PI });
        previewPath.setPoints(dispAll(half), k);
        livePath.setPoints(dispAll(half), k);
        fullPath.setPoints(dispAll(samplePath(g.mu, g.el0, 200)), k);
      }
      tfGroup.rotation.y = rotFor(sim.phase === 'orbit1' ? sim.ang : sim.alpha);
      placeMarkers();

      if (reframe || bucket !== lastBucket || lastBodyId !== body.id || lastBucket === null) {
        const lowHug = g.r1 / Math.max(g.r1, g.r2) < 0.3;
        frameSpace(stage, 48, { elevationDeg: lowHug ? 68 : 55, padding: ctx.isNarrow() ? 1.3 : 1.05 });
      }
      lastBucket = bucket;
      craft.clearTrail();
      syncVisibility();
    }

    // ----- flight -----
    function posVel() {
      if (sim.phase === 'orbit1' || sim.phase === 'orbit2') {
        const r = sim.phase === 'orbit1' ? g.r1 : g.r2;
        const sp = sim.phase === 'orbit1' ? g.v1 : g.v2;
        const a = sim.ang;
        return { r: pol(a, r), v: [-Math.sin(a) * sp, Math.cos(a) * sp], rMag: r, speed: sp };
      }
      const tPeri = g.up ? sim.s : g.per / 2 + sim.s;
      const s = positionAtTime(g.mu, elRot(), tPeri);
      return { r: s.r, v: s.v, rMag: s.rMag != null ? s.rMag : Math.hypot(s.r[0], s.r[1]), speed: s.speed != null ? s.speed : Math.hypot(s.v[0], s.v[1]) };
    }

    // seconds from now to the next far-end pass, and the signed distance in time to the nearest pass
    function farInfo() {
      const x = ((sim.s - g.tCoast) % g.per + g.per) % g.per;
      const toNext = x === 0 ? 0 : g.per - x;
      const nearest = Math.min(x, g.per - x);
      return { toNext, nearest };
    }
    const windowOpen = () => sim.phase === 'coast' && !g.same && farInfo().nearest <= WINDOW_FRAC * g.tCoast;

    function startFlash(origin, v, sign) {
      if (reduceMotion) return;
      const n = Math.hypot(v[0], v[1]) || 1;
      flash = { origin, dir: [sign * v[0] / n, sign * v[1] / n], t: FLASH_S };
    }

    function setPhase(ph) {
      sim.phase = ph;
      setT({ phase: ph });
    }

    function fireBurn1() {
      if (sim.phase !== 'orbit1' || g.same) return false;
      const before = posVel();
      sim.alpha = sim.ang;
      sim.s = 0;
      sim.missed = false;
      setPhase('coast');
      const after = posVel();
      dbg.burn1 = { jumpKm: dist2(before.r, after.r), r: g.r1, frac: dist2(before.r, after.r) / g.r1, before: before.r, after: after.r };
      tfGroup.rotation.y = rotFor(sim.alpha);
      placeMarkers();
      craft.clearTrail();
      startFlash(before.r, after.v, g.up ? 1 : -1);
      syncVisibility();
      paintLive(true);
      return true;
    }

    function fireBurn2() {
      if (sim.phase !== 'coast') return false;
      const before = posVel();
      sim.ang = Math.atan2(before.r[1], before.r[0]);
      sim.missed = false;
      sim.auto = false;
      setPhase('orbit2');
      const after = posVel();
      dbg.burn2 = { jumpKm: dist2(before.r, after.r), r: g.r2, frac: dist2(before.r, after.r) / g.r2, before: before.r, after: after.r };
      startFlash(after.r, after.v, g.up ? 1 : -1);
      syncVisibility();
      paintLive(true);
      return true;
    }

    function runForMe() {
      if (g.same) return;
      if (sim.phase === 'orbit2') startOver(false);
      const t = store.get().time;
      if (!t.playing) { store.set({ time: { ...t, playing: true } }); tc.set({ playing: true }); }
      sim.auto = true;
      if (sim.phase === 'orbit1') fireBurn1();
      paintLive(true);
    }

    function startOver(keepWarp = true) {
      holdAt = null;
      sim.auto = false; sim.missed = false; sim.s = 0; sim.ang = 0;
      setPhase('orbit1');
      flash = null;
      flashArrow.object.visible = false;
      craft.clearTrail();
      tfGroup.rotation.y = rotFor(sim.ang);
      placeMarkers();
      syncVisibility();
      paintLive(true);
      stage.requestRender();
    }

    // ----- panel A -----
    const T1 = TEXT.l1;
    const T3 = TEXT.l3;
    const T4 = TEXT.l4;
    const T5 = TEXT.l5;
    const C3 = T3.controls;
    const ic = (id, label) => infoButton(card, id, { label });
    const chip = (id, label) => infoChip(card, id, label);
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const lowName = () => (g.body.id === 'sun' ? C3.inner.toLowerCase() : C3.low.toLowerCase());
    const highName = () => (g.body.id === 'sun' ? C3.outer.toLowerCase() : C3.high.toLowerCase());
    const setPlaying = (v) => {
      const t = store.get().time;
      if (t.playing !== v) store.set({ time: { ...t, playing: v } });
      if (tc) tc.set({ playing: v });
    };

    function ensureRun() {
      const def = pickWarps(g.same ? g.p1 : g.tCoast).def;
      store.set({ time: { playing: true, warp: def } });
      tc.set({ playing: true, warp: def });
    }

    function onPrimary() {
      if (sim.phase === 'orbit1') fireBurn1();
      else if (sim.phase === 'coast') { if (windowOpen()) fireBurn2(); }
      else if (sim.phase === 'orbit2') startOver();
    }

    // load a route (body + preset) and rebuild; reframe the camera only when the scale changes
    function goRoute(bodyId, presetId) {
      const body = BODIES[bodyId];
      const preset = (TRANSFER_PRESETS[bodyId] || []).find((p) => p.id === presetId) || TRANSFER_PRESETS[bodyId][0];
      const oldBody = store.get().bodyId;
      const before = [g.r1, g.r2];
      store.set({ bodyId });
      loadPreset(body, preset);
      g = geometry();
      const changed = oldBody !== bodyId || Math.abs(before[0] - g.r1) > 1 || Math.abs(before[1] - g.r2) > 1;
      configChanged({ keepAng: false, reframe: changed, resetWarp: true });
    }

    function swapRoute() {
      const b = bodyOf();
      const T = getT();
      const r1 = b.radius + T.alt1;
      setT({ alt1: T.r2 - b.radius, r2: r1, presetId: 'custom' });
      configChanged({ keepAng: false });
    }

    // level 1: three picture buttons choose the trip; the trip then plays again and again
    const DEST = { tv: ['earth', 'leo-geo'], moon: ['earth', 'leo-moon'], mars: ['sun', 'earth-mars'] };
    const destKey = () => Object.keys(DEST).find((k) => DEST[k][0] === store.get().bodyId && DEST[k][1] === getT().presetId) || null;
    function chooseDest(k) {
      goRoute(DEST[k][0], DEST[k][1]);
      runForMe();
      paintChoices();
    }
    function svgIcon(kind) {
      const NS = 'http://www.w3.org/2000/svg';
      const mk = (tag, a) => { const e = document.createElementNS(NS, tag); Object.keys(a).forEach((n) => e.setAttribute(n, a[n])); return e; };
      const svg = mk('svg', { viewBox: '0 0 64 64', width: 52, height: 52, 'aria-hidden': 'true' });
      const ring = { tv: 24, moon: 28, mars: 28 }[kind];
      const mid = { tv: ['#3f7fbf', 9], moon: ['#3f7fbf', 5], mars: ['#e8b54a', 7] }[kind];
      const dot = { tv: ['#ff9a5c', 3.5], moon: ['#9a9a96', 4.5], mars: ['#b5593a', 5] }[kind];
      svg.append(mk('circle', { cx: 32, cy: 32, r: ring, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-dasharray': '3 3', opacity: 0.7 }));
      if (kind === 'tv') svg.append(mk('circle', { cx: 32, cy: 32, r: 14, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2, opacity: 0.5 }));
      svg.append(mk('circle', { cx: 32, cy: 32, r: mid[1], fill: mid[0] }), mk('circle', { cx: 32 + ring * 0.7, cy: 32 - ring * 0.7, r: dot[1], fill: dot[0] }));
      return svg;
    }
    const choiceBtns = T1.choices.map((c) => {
      const b = el('button', { type: 'button', class: 'tf-choice', 'data-choice': c.id, 'aria-pressed': 'false' }, svgIcon(c.id), el('span', { class: 'tf-choice-label', text: c.label }));
      b.addEventListener('click', () => chooseDest(c.id));
      return b;
    });
    const choicesEl = el('div', { class: 'tf-choices', role: 'group', 'aria-label': 'Where to go' }, choiceBtns);
    function paintChoices() {
      const k = destKey();
      choiceBtns.forEach((b) => b.setAttribute('aria-pressed', b.dataset.choice === k ? 'true' : 'false'));
    }

    const primary = button({ label: C3.push1, kind: 'primary', onClick: onPrimary });
    primary.classList.add('tf-primary');
    primary.dataset.role = 'primary';
    const showMe = button({ label: C3.showMe, onClick: () => runForMe() });
    showMe.dataset.role = 'show-me';
    const startAgain = button({ label: C3.startAgain, kind: 'ghost', onClick: () => startOver() });
    startAgain.dataset.role = 'start-again';
    const statusEl = el('p', { class: 'tf-status', 'aria-live': 'polite' });
    const flowEl = el('div', { class: 'tf-flow' }, primary, statusEl, el('div', { class: 'tf-actions' }, showMe, startAgain));

    const bodySel = select({
      label: C3.world,
      options: BODY_ORDER.map((id) => ({ value: id, label: BODIES[id].name })),
      value: store.get().bodyId,
      onChange: onBodyChange,
    });
    const presetsEl = el('div', { class: 'tf-presets', role: 'group', 'aria-label': C3.trip });
    const tripEl = el('div', { class: 'field' }, el('div', { class: 'field-head' }, el('span', { class: 'field-label', text: C3.trip }), ic('transferPath', 'the transfer path')), presetsEl);

    const posOf = (v, body) => {
      const [lo, hi] = SLIDER_RANGE[body.id];
      return Math.min(1, Math.max(0, Math.log(v / lo) / Math.log(hi / lo)));
    };
    const valAt = (p, body) => {
      const [lo, hi] = SLIDER_RANGE[body.id];
      return lo * Math.pow(hi / lo, p);
    };
    const toVal = (body, r) => (body.id === 'sun' ? r : r - body.radius);
    const toR = (body, v) => (body.id === 'sun' ? v : v + body.radius);
    const fmtVal = (body, v) => (body.id === 'sun'
      ? `${nice(v / 1e6 / 1.609344, 3)} million mi (${nice(v / 1e6, 3)} million km)`
      : dual.km(v).text);
    const STEP = 0.0005;

    function makeOrbitSlider(label, getV, onValue) {
      const body = () => bodyOf();
      const s = slider({
        label, min: 0, max: 1, step: STEP, value: 0.5,
        format: (p) => {
          const b = body();
          const cur = getV();
          return fmtVal(b, Math.abs(p - posOf(cur, b)) <= STEP * 0.51 ? cur : niceRound(valAt(p, b), b));
        },
        onInput: (p) => onValue(niceRound(valAt(p, body()), body())),
      });
      return s;
    }
    const sStart = makeOrbitSlider(C3.startHeight, () => toVal(bodyOf(), getT().alt1 + bodyOf().radius), (v) => {
      setT({ alt1: bodyOf().id === 'sun' ? v - bodyOf().radius : v, presetId: 'custom' });
      configChanged({ keepAng: true });
    });
    const sTarget = makeOrbitSlider(C3.targetHeight, () => toVal(bodyOf(), getT().r2), (v) => {
      setT({ r2: toR(bodyOf(), v), presetId: 'custom' });
      configChanged({ keepAng: true });
    });
    const swapBtn = button({ label: C3.swap, kind: 'ghost', onClick: () => swapRoute() });
    const engineSeg = segmented({
      label: T5.labels.engine, options: ENGINES, value: String(getT().isp),
      onChange: (v) => { setT({ isp: Number(v) }); g = geometry(); paintStatic(); },
    });

    const trySteps = tryThis([
      { ...T3.tries[0], run: () => {
        goRoute(store.get().bodyId, (TRANSFER_PRESETS[store.get().bodyId] || [])[0].id);
        runForMe();
      } },
      { ...T3.tries[1], run: () => {
        startOver();
        ensureRun();
        fireBurn1();
      } },
      { ...T3.tries[2], run: () => {
        goRoute('earth', 'leo-moon');
        runForMe();
      } },
      { ...T3.tries[3], run: () => {
        if (g.up) swapRoute();
        runForMe();
      } },
    ]);

    // ----- the story (level 2 and 3) -----
    const tvRoute = () => { if (store.get().bodyId !== 'earth' || getT().presetId !== 'leo-geo') goRoute('earth', 'leo-geo'); };
    const intoCoast = () => { if (sim.phase !== 'coast' || g.same) { startOver(); fireBurn1(); } sim.missed = false; sim.auto = false; };
    const storyRuns = [
      () => { tvRoute(); startOver(); setPlaying(true); },
      () => { tvRoute(); startOver(); setPlaying(true); fireBurn1(); holdAt = 0.1 * g.tCoast; },
      () => { tvRoute(); intoCoast(); sim.s = Math.max(sim.s, 0.1 * g.tCoast); holdAt = 0.9 * g.tCoast; setPlaying(true); },
      () => { tvRoute(); intoCoast(); sim.s = Math.max(sim.s, 0.85 * g.tCoast); sim.auto = true; holdAt = null; setPlaying(true); },
      () => { tvRoute(); startOver(); fireBurn1(); sim.s = 0.4 * g.tCoast; holdAt = null; setPlaying(true); },
      () => { tvRoute(); startOver(); holdAt = null; runForMe(); },
    ];
    const storyW = story(TEXT.l2.steps.map((s, i) => ({ ...s, run: storyRuns[i] })), { title: 'The story' });

    // ----- the ideas (info chips) -----
    const ideasEl = el('div', { class: 'tf-ideas' },
      el('span', { class: 'tf-label', text: 'What do these words mean?' }),
      el('div', { class: 'tf-chips' },
        chip('orbit', 'Orbit'), chip('push', 'Push'), chip('coast', 'Coast'), chip('transferPath', 'Transfer path'),
        chip('speedChange', 'Speed change'), chip('fuelShare', 'Fuel share'), chip('launchWindow', 'Launch window')));

    // ----- panel B pieces -----
    const answerBox = answer({ kind: 'info', title: '', text: '' });
    let lastAnswer = '';
    const stepLabels = [C3.low, C3.coast, C3.high];
    const stepsEl = el('ol', { class: 'tf-steps', 'aria-label': C3.stage },
      stepLabels.map((t) => el('li', { class: 'tf-step', 'data-state': 'todo' }, el('span', { class: 'tf-dot', text: '' }), el('span', { class: 'tf-step-label', text: t }))));
    const tripTimeEl = el('p', { class: 'tf-trip' });
    const fuelTextEl = el('p', { class: 'tf-fuel-text' });
    const windowNote = el('p', { class: 'tf-note' });

    const liveHeight = stat({ label: T5.labels.height, value: 0, unit: 'km', digits: 0 });
    const liveSpeed = stat({ label: T5.labels.speedNow, value: 0, unit: 'km/s', digits: 2 });
    const liveLeft = stat({ label: T5.labels.coastLeft, value: '—', digits: 1 });
    liveHeight.el.dataset.key = 'height'; liveSpeed.el.dataset.key = 'speed'; liveLeft.el.dataset.key = 'left';

    const tBurn1 = stat({ label: T5.labels.burn1, value: 0, unit: 'km/s', digits: 2 });
    const tBurn2 = stat({ label: T5.labels.burn2, value: 0, unit: 'km/s', digits: 2 });
    const tTotal = stat({ label: T5.labels.total, value: 0, unit: 'km/s', digits: 2 });
    const tCoast = stat({ label: T5.labels.coastTime, value: 0, unit: 'h', digits: 1 });
    const tFuel = stat({ label: T5.labels.fuel, value: 0, unit: '%', digits: 1, source: FUEL_SOURCE });
    const tV1 = stat({ label: T5.labels.v1, value: 0, unit: 'km/s', digits: 2 });
    const tV2 = stat({ label: T5.labels.v2, value: 0, unit: 'km/s', digits: 2 });
    [['burn1', tBurn1], ['burn2', tBurn2], ['total', tTotal], ['coast', tCoast], ['fuel', tFuel], ['v1', tV1], ['v2', tV2]].forEach(([key, t]) => { t.el.dataset.key = key; });

    const barFuel = el('div', { class: 'tf-bar-fuel' });
    const barRest = el('div', { class: 'tf-bar-rest' });
    const bar = el('div', { class: 'tf-bar', role: 'img' }, barFuel, barRest);
    const fuelSection = section(C3.fuelHead, bar, fuelTextEl);
    fuelSection.querySelector('.section-title').append(ic('fuelShare', 'fuel share'));
    const keyFuel = el('span', { text: '' });
    const keyRest = el('span', { text: '' });
    const keyEl = el('ul', { class: 'tf-key' },
      el('li', {}, el('span', { class: 'tf-key-sw', style: 'background: var(--accent-soft); background: color-mix(in srgb, var(--accent) 38%, transparent); border-color: var(--accent-edge)' }), keyFuel),
      el('li', {}, el('span', { class: 'tf-key-sw', style: 'background: var(--track)' }), keyRest));
    const notesEl = el('div', { class: 'tf-notes' });
    const windowSource = el('div', { class: 'row' }, sourceTag(T5.sources.window));

    // level 4: the five tiles
    const tiles = {
      push1: tile({ label: T4.tiles.push1.label, us: '', si: '', compare: '', infoId: 'push1' }),
      push2: tile({ label: T4.tiles.push2.label, us: '', si: '', compare: '', infoId: 'push2' }),
      total: tile({ label: T4.tiles.total.label, us: '', si: '', compare: '', infoId: 'speedChange' }),
      time: tile({ label: T4.tiles.time.label, us: '', si: '', compare: '', infoId: 'coast' }),
      fuel: tile({ label: T4.tiles.fuel.label, us: '', si: '', compare: '', infoId: 'fuelShare' }),
    };
    const glossEl = el('div', { class: 'tf-notes' },
      Object.values(T4.glosses).map((t) => el('p', { class: 'tf-note', text: t })));
    const tilesSection = section(T4.headings.plan,
      el('p', { class: 'tf-caption', text: T4.headings.glossLine }),
      el('div', { class: 'sl-tiles' }, tiles.push1.el, tiles.push2.el, tiles.total.el, tiles.time.el, tiles.fuel.el),
      glossEl);

    // level 5: the full numbers
    const formulasEl = el('div', { class: 'tf-notes' }, T5.formulas.map((t) => el('p', { class: 'tf-note tf-formula', text: t })));
    const deepEl = el('div', { class: 'tf-deep' },
      section(T5.labels.where, stats(liveHeight.el, liveSpeed.el, liveLeft.el)),
      section(T5.labels.plan, stats(tBurn1.el, tBurn2.el, tTotal.el, tCoast.el, tFuel.el, tV1.el, tV2.el)),
      section(T5.labels.fuelNumbers, keyEl),
      notesEl,
      section(T5.labels.formulasTitle, formulasEl),
      windowSource,
      el('div', { class: 'row' }, sourceTag(FUEL_SOURCE)),
      el('div', { class: 'row' }, sourceTag(T5.sources.bodies)));

    // ----- panel C -----
    const tcWrap = el('div', { class: 'tf-time' });
    let tc = null;
    function buildTime(forceDefault) {
      const ref = g.same ? g.p1 : g.tCoast;
      const { warps, def } = pickWarps(ref);
      const t = store.get().time;
      let w = t.warp;
      if (forceDefault || !warps.some((x) => x.value === w)) w = def;
      if (w !== t.warp) store.set({ time: { ...t, warp: w } });
      tc = timeControl({
        warps, value: w, playing: store.get().time.playing,
        onChange: ({ playing, warp }) => store.set({ time: { playing, warp } }),
        onReset: () => startOver(),
      });
      tcWrap.replaceChildren(tc.el);
    }
    const displayEl = el('div', { class: 'section' },
      el('h3', { class: 'section-title', text: T5.labels.display }),
      el('div', { class: 'section-body' },
        toggle({ label: T5.labels.showBoth, value: getT().showBoth !== false, onChange: (v) => { setT({ showBoth: v }); syncVisibility(); } }).el,
        toggle({ label: T5.labels.showArrow, value: !!getT().showArrow, onChange: (v) => { setT({ showArrow: v }); if (!v) speedArrow.setVisible(false); stage.requestRender(); } }).el));
    const swStart = el('span', { class: 'tf-sw-line' });
    const swTarget = el('span', { class: 'tf-sw-line', 'data-dash': 'true' });
    const swPath = el('span', { class: 'tf-sw-line' });
    const legendEl = el('ul', { class: 'legend' },
      el('li', { class: 'legend-item' }, swStart, 'Where it starts'),
      el('li', { class: 'legend-item' }, swTarget, 'Where it is going'),
      el('li', { class: 'legend-item' }, swPath, 'Path of the craft'),
      el('li', { class: 'legend-item' }, el('span', { class: 'tf-sw-dot' }), 'Engine pushes'));
    function paintLegend() {
      swStart.style.borderTopColor = theme.ink2;
      swTarget.style.borderTopColor = theme.accent;
      swPath.style.borderTopColor = theme.craft;
    }
    paintLegend();

    // ----- assemble the panels and gate every piece to its layer -----
    const exploreEl = layers.gate(el('div', { class: 'tf-explore' }, bodySel.el, tripEl, flowEl, sStart.el, sTarget.el, swapBtn), 3);
    const engineEl = layers.gate(el('div', { class: 'tf-engine' }, engineSeg.el), 5);
    panelA.append(
      question(T1.question, T1.sub),
      layers.gate(choicesEl, 1, 1),
      answerBox.el,
      stepsEl,
      layers.gate(storyW.el, 2, 2),
      layers.gate(tripTimeEl, 2),
      layers.gate(fuelSection, 2),
      layers.gate(ideasEl, 2),
      exploreEl,
      layers.gate(trySteps, 3),
      engineEl,
    );
    panelB.append(layers.gate(windowNote, 4), layers.gate(tilesSection, 4), layers.gate(deepEl, 5));
    panelC.append(tcWrap, layers.gate(displayEl, 5), section('What you see', legendEl));

    // ----- painting -----
    function paintPresets() {
      const b = bodyOf();
      const T = getT();
      presetsEl.replaceChildren(...(TRANSFER_PRESETS[b.id] || []).map((p) => {
        const pl = PLAIN[p.id] || {};
        const a1 = p.alt1 != null ? p.alt1 : p.r1 - b.radius;
        const r2 = p.r2 != null ? p.r2 : b.radius + p.alt2;
        const sub = pl.sub || (b.id === 'sun'
          ? `${fmtVal(b, a1 + b.radius)} to ${fmtVal(b, r2)} from the Sun`
          : `${dual.km(a1).text} to ${dual.km(r2 - b.radius).text} above the surface`);
        const btn = el('button', { type: 'button', class: 'tf-preset', 'data-preset': p.id, 'aria-pressed': T.presetId === p.id ? 'true' : 'false' },
          el('span', { class: 'tf-preset-name', text: pl.name || p.name }),
          el('span', { class: 'tf-preset-sub', text: sub }));
        btn.addEventListener('click', () => {
          loadPreset(b, p);
          configChanged({ keepAng: false, reframe: true, resetWarp: true });
        });
        return btn;
      }));
    }

    function paintSummary() {
      const b = g.body;
      const fw = fuelWords(g.frac);
      let sumText;
      if (g.same) sumText = lvl() >= 3 ? `${b.name} · same orbit · no burn needed` : `${b.name} · same orbit · no push needed`;
      else if (lvl() <= 2) sumText = `${T1.summary[destKey() || 'other']} · ${fw.short}`;
      else {
        const route = PLAIN[getT().presetId] ? PLAIN[getT().presetId].route : (g.up ? `${lowName()} to ${highName()}` : `${highName()} to ${lowName()}`);
        sumText = `${b.name} · ${route} · ${plainDur(g.tCoast)} · ${fw.short}`;
      }
      summaryEl.replaceChildren(el('span', { style: { display: 'block', whiteSpace: 'normal' }, text: sumText }));
    }

    function paintStatic() {
      const b = g.body;
      const T = getT();
      // controls
      bodySel.set(b.id);
      sStart.el.querySelector('.field-label').textContent = b.id === 'sun' ? C3.startDistance : C3.startHeight;
      sTarget.el.querySelector('.field-label').textContent = b.id === 'sun' ? C3.targetDistance : C3.targetHeight;
      sStart.set(posOf(toVal(b, g.r1), b));
      sTarget.set(posOf(toVal(b, g.r2), b));
      engineSeg.set(String(T.isp));
      paintPresets();
      paintChoices();
      // level 5 stats
      const word = (up) => (g.same ? 'No burn needed' : up ? 'Speed up' : 'Slow down');
      tBurn1.update({ value: g.dv1, hint: word(g.up) });
      tBurn2.update({ value: g.dv2, hint: word(g.up) });
      tTotal.update({ value: g.total });
      const d = formatDuration(g.tCoast);
      tCoast.update({ value: g.same ? '—' : d.value, unit: g.same ? '' : d.unit, digits: d.unit === 'days' && d.value < 10 ? 2 : 1 });
      tFuel.update({ value: g.frac * 100 });
      tV1.update({ value: g.v1 });
      tV2.update({ value: g.v2 });
      // level 4 tiles
      const nz = !g.same;
      const dv = (v, key) => { const t = dual.kmps(v, 2); tiles[key].update({ us: nz ? t.us : '—', si: nz ? t.si : '', compare: nz ? T4.tiles[key].compare(v) : '' }); };
      dv(g.dv1, 'push1'); dv(g.dv2, 'push2'); dv(g.total, 'total');
      tiles.time.update({ us: nz ? friendlyDuration(g.tCoast) : '—', si: null, compare: nz ? T4.tiles.time.compare(g.tCoast) : '' });
      tiles.fuel.update({ us: nz ? `${nice(g.frac * 100, 2)}%` : '—', si: null, compare: nz ? T4.tiles.fuel.compare(g.frac) : '' });
      const fuelPct = g.frac * 100;
      // plain fuel bar
      const fw = fuelWords(g.frac);
      fuelSection.style.display = g.same ? 'none' : '';
      barFuel.style.width = `${fuelPct}%`;
      barFuel.textContent = fuelPct >= 12 ? C3.fuelBarFuel : '';
      barFuel.style.borderRight = fuelPct > 0.05 ? '' : '0';
      barRest.textContent = 100 - fuelPct >= 20 ? C3.fuelBarRest : '';
      fuelTextEl.textContent = `${fw.head} of the craft is fuel.`;
      keyFuel.textContent = `Fuel ${fmt(fuelPct, 1)}%`;
      keyRest.textContent = `Everything else ${fmt(100 - fuelPct, 1)}%`;
      bar.setAttribute('aria-label', `${fw.head} of the craft is fuel`);
      liveHeight.el.querySelector('.stat-label').textContent = b.id === 'sun' ? T5.labels.distance : T5.labels.height;
      liveHeight.update({ unit: b.id === 'sun' ? 'million km' : 'km', digits: b.id === 'sun' ? 1 : 0 });
      // trip time and stepper wording
      tripTimeEl.textContent = g.same ? '' : lvl() >= 3 ? `${C3.tripTime}: ${plainDur(g.tCoast, true)}` : TEXT.l2.tripLine(g.tCoast);
      tripTimeEl.style.display = g.same ? 'none' : '';
      const labels = g.up ? [lowName(), C3.coast, highName()] : [highName(), C3.coast, lowName()];
      Array.from(stepsEl.children).forEach((li, i) => {
        li.querySelector('.tf-step-label').textContent = cap(labels[i]);
      });
      // launch window and the notes that belong to level 5
      const win = b.id === 'sun' && T.presetId === 'earth-mars';
      windowNote.textContent = win ? T5.notes.window : '';
      windowNote.style.display = win ? '' : 'none';
      windowSource.style.display = win ? '' : 'none';
      const notes = [];
      if (!g.same) {
        notes.push(el('p', { class: 'tf-note', text: g.up ? T5.notes.up : T5.notes.down }));
        if (g.up) notes.push(el('p', { class: 'tf-note', text: T5.notes.paradox }));
      }
      notesEl.replaceChildren(...notes);
      paintSummary();
      lastAnswer = '';
      paintLive(true);
    }

    function answerFor() {
      const A = T1.answers;
      if (g.same) return { kind: 'info', title: 'Already there', text: T3.status.same };
      const ph = sim.phase;
      if (ph === 'orbit1') {
        const dk = destKey();
        if (dk) return { kind: 'info', ...A[dk] };
        return { kind: 'info', title: A.ready.title, text: g.up ? T3.status.ready : T3.status.readyDown };
      }
      if (ph === 'orbit2') return { kind: 'ok', ...(g.up ? A.done : A.doneDown) };
      if (sim.missed) return { kind: 'warn', ...(g.up ? A.fell : A.fellDown) };
      if (windowOpen()) return { kind: 'info', ...A.far };
      if (flash) return { kind: 'info', ...(g.up ? A.push1 : A.push1Down) };
      return { kind: 'info', ...(g.up ? A.coast : A.coastDown) };
    }

    let liveClock = 1;
    function paintLive(force) {
      if (!g) return;
      const b = g.body;
      const pv = posVel();
      const ph = sim.phase;
      const win = windowOpen();
      // buttons
      const burnWord = lvl() >= 5;
      const label = ph === 'orbit2' ? C3.again
        : ph === 'coast' ? (burnWord ? 'Fire burn 2' : C3.push2)
          : (burnWord ? 'Fire burn 1' : C3.push1);
      if (primary.textContent !== label) primary.textContent = label;
      primary.disabled = g.same || (ph === 'coast' && !win);
      showMe.disabled = g.same;
      // stepper (digits only at level 4 and up)
      const order = ['orbit1', 'coast', 'orbit2'];
      const cur = order.indexOf(ph);
      Array.from(stepsEl.children).forEach((li, i) => {
        li.dataset.state = i < cur ? 'done' : i === cur ? 'current' : 'todo';
        li.setAttribute('aria-current', i === cur ? 'step' : 'false');
        li.querySelector('.tf-dot').textContent = i < cur ? '✓' : (lvl() >= 4 ? String(i + 1) : '');
      });
      panelB.dataset.phase = ph;
      // readouts
      liveHeight.update({ value: b.id === 'sun' ? pv.rMag / 1e6 : pv.rMag - b.radius });
      liveHeight.el.dataset.rKm = pv.rMag.toFixed(1);
      liveSpeed.update({ value: pv.speed });
      let left = null;
      if (ph === 'coast' && !g.same) left = farInfo().toNext;
      if (left == null) liveLeft.update({ value: '—', unit: '', hint: ph === 'orbit1' ? 'After burn 1' : 'Coast is over' });
      else { const d = formatDuration(left); liveLeft.update({ value: d.value, unit: d.unit, digits: 1, hint: win ? 'Burn 2 is ready' : sim.missed ? 'To the next pass' : '' }); }
      // status line
      let msg;
      if (g.same) msg = T3.status.same;
      else if (ph === 'orbit1') msg = g.up ? T3.status.ready : T3.status.readyDown;
      else if (ph === 'orbit2') msg = `In the ${g.up ? highName() : lowName()}. The trip is done.`;
      else if (sim.missed) msg = win ? 'The second push was missed, but the far end is here again. Fire it now.' : `The second push was missed. The far end comes again in ${plainDur(left)}.`;
      else if (win) msg = T3.status.near;
      else msg = `Coasting. ${plainDur(left)} to go. Wait for the far end.`;
      if (statusEl.textContent !== msg) statusEl.textContent = msg;
      // answer
      const ans = answerFor();
      const key = `${ans.kind}|${ans.title}|${ans.text}`;
      if (key !== lastAnswer) { lastAnswer = key; answerBox.update(ans); }
    }

    // ----- change handlers -----
    function configChanged({ keepAng = false, reframe = false, resetWarp = false } = {}) {
      g = geometry();
      const ang = sim.ang;
      holdAt = null;
      sim.auto = false; sim.missed = false; sim.s = 0;
      sim.ang = keepAng && sim.phase === 'orbit1' ? ang : 0;
      sim.phase = 'orbit1';
      setT({ phase: 'orbit1' });
      flash = null;
      flashArrow.object.visible = false;
      applyScene({ reframe });
      buildTime(resetWarp);
      paintStatic();
    }

    function onBodyChange(id) {
      store.set({ bodyId: id });
      const b = BODIES[id];
      loadPreset(b, TRANSFER_PRESETS[id][0]);
      g = geometry();
      sim.ang = 0;
      configChanged({ keepAng: false, reframe: true, resetWarp: true });
    }

    // a level change: new words, new marker labels, and the right scene for the new layer
    layers.onChange((lv, prev) => {
      if (marker1) marker1.setLabel(pushLabel(1));
      if (marker2) marker2.setLabel(pushLabel(2));
      if (lv === 1 && prev > 1) {
        if (!destKey()) goRoute('earth', 'leo-geo');
        startOver(); setPlaying(true); runForMe();
      } else if (lv === 2 && prev < 2) {
        storyW.go(0);
      }
      paintStatic();
      stage.requestRender();
    });

    // ----- frame loop -----
    function update(dt) {
      const { playing, warp } = store.get().time;
      if (playing) {
        if (sim.phase === 'orbit1') {
          sim.ang = wrap2pi(sim.ang + g.n1 * Math.min(warp, g.p1 / 4) * dt);
        } else if (sim.phase === 'orbit2') {
          sim.ang = wrap2pi(sim.ang + g.n2 * Math.min(warp, g.p2 / 4) * dt);
        } else if (sim.phase === 'coast') {
          const ds = warp * dt;
          const far = farInfo();
          if (sim.auto && ds >= far.toNext && far.toNext < g.per) {
            sim.s += far.toNext;
            fireBurn2();
          } else {
            sim.s += ds;
          }
          if (holdAt != null && sim.s >= holdAt) { sim.s = holdAt; holdAt = null; setPlaying(false); }
        }
      }
      // level 1: when the craft has settled in the high orbit for a moment, play the trip again
      if (sim.phase === 'orbit2' && lvl() === 1 && playing) {
        dwell += dt;
        if (dwell > 3.5) { dwell = 0; startOver(); runForMe(); }
      } else dwell = 0;
      if (sim.phase === 'coast' && !sim.missed && !g.same && sim.s > g.tCoast * (1 + WINDOW_FRAC)) { sim.missed = true; syncVisibility(); }
      const pv = posVel();
      if (sim.phase === 'orbit1') tfGroup.rotation.y = rotFor(sim.ang);
      craft.setPosition(disp(pv.r), k);
      if (craft.setHeading && pv.v) craft.setHeading(pv.v);
      if (getT().showArrow && lvl() >= 5) speedArrow.set(disp(pv.r), pv.v, k, 9);
      else speedArrow.setVisible(false);
      if (flash) {
        flash.t -= dt;
        if (flash.t <= 0) { flash = null; flashArrow.object.visible = false; }
        else {
          const len = Math.min(14, Math.max(6, 0.3 * Math.max(g.r1, g.r2) / k)) * (flash.t / FLASH_S);
          flashArrow.set(disp(flash.origin), flash.dir, k, len);
        }
      }
      if (bodyObj && bodyObj.group.userData.spin) bodyObj.group.userData.spin(dt * (playing ? 0.6 : 0));
      liveClock += dt;
      if (liveClock > 0.12) { liveClock = 0; paintLive(); }
    }

    // ----- go -----
    g = geometry();
    applyScene({ reframe: true });
    buildTime(false);
    paintStatic();
    if (sim.phase !== 'orbit1') { placeMarkers(); syncVisibility(); }
    paintLive(true);

    // start on a good default: level 1 shows the TV satellite trip on a loop; level 2 starts the story
    if (lvl() === 1) {
      if (!destKey() && sim.phase === 'orbit1') goRoute('earth', 'leo-geo');
      if (sim.phase === 'orbit1') { setPlaying(true); runForMe(); }
    } else if (lvl() === 2) {
      storyW.go(0);
    }

    // ----- hover and tap cards on the 3D objects (screen-space picking; the camera never moves) -----
    const canvas = stage.renderer && stage.renderer.domElement;
    const tmpV = new THREE.Vector3();
    const worldOf = (p) => new THREE.Vector3(p[0] / k, 0, -p[1] / k);
    function screenOf(v) {
      const r = canvas.getBoundingClientRect();
      tmpV.copy(v).project(stage.camera);
      return { x: r.left + ((tmpV.x + 1) / 2) * r.width, y: r.top + ((1 - tmpV.y) / 2) * r.height, behind: tmpV.z > 1 };
    }
    function segDist(px, py, ax, ay, bx, by) {
      const dx = bx - ax; const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
      return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }
    function pathDist(pointsWorld, x, y) {
      let best = Infinity; let prev = null;
      for (const v of pointsWorld) {
        const s = screenOf(v);
        if (prev && !s.behind && !prev.behind) best = Math.min(best, segDist(x, y, prev.x, prev.y, s.x, s.y));
        prev = s;
      }
      return best;
    }
    const circleWorld = (r) => {
      const out = [];
      for (let i = 0; i <= 96; i++) out.push(worldOf(disp(pol((i / 96) * TWO_PI, r))));
      return out;
    };
    function transferWorld() {
      const nu0 = g.up ? 0 : Math.PI;
      const pts = samplePath(g.mu, g.el0, 80, { fromNu: nu0, toNu: nu0 + Math.PI });
      tfGroup.updateMatrixWorld(true);
      return dispAll(pts).map((p) => tfGroup.localToWorld(worldOf(p)));
    }
    function hit(x, y) {
      if (!canvas || !g) return null;
      const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      const near = coarse ? 30 : 16;
      const pv = posVel();
      const craftAt = worldOf(disp(pv.r));
      const cs = screenOf(craftAt);
      if (Math.hypot(x - cs.x, y - cs.y) <= near + 6) return 'craft';
      for (const [m, id] of [[marker1, 'push1'], [marker2, 'push2']]) {
        if (!m || !m.object.visible) continue;
        const ms = screenOf(m.object.position);
        if (Math.hypot(x - ms.x, y - ms.y) <= near + 4) return id;
      }
      if (flash && flashArrow.object.visible) {
        const fs = screenOf(flashArrow.object.position);
        if (Math.hypot(x - fs.x, y - fs.y) <= near + 14) return 'flame';
      }
      if (getT().showArrow && lvl() >= 5 && speedArrow.object.visible) {
        const tip = craftAt.clone().add(new THREE.Vector3(pv.v[0], 0, -pv.v[1]).normalize().multiplyScalar(9));
        const ts = screenOf(tip);
        if (segDist(x, y, cs.x, cs.y, ts.x, ts.y) <= near * 0.7) return 'speedArrow';
      }
      let bestId = null; let best = near;
      const lowId = g.up ? 'lowOrbit' : 'highOrbit';
      const highId = g.up ? 'highOrbit' : 'lowOrbit';
      const cands = [];
      if (startPath.object.visible) cands.push(['start', lowId, null]);
      if (targetDash.object.visible || targetSolid.object.visible) cands.push(['target', highId, null]);
      if (!g.same && (previewPath.object.visible || livePath.object.visible || fullPath.object.visible)) cands.push(['transfer', 'transferPath', null]);
      for (const [kind, id] of cands) {
        const pts = kind === 'start' ? circleWorld(g.r1) : kind === 'target' ? circleWorld(g.r2) : transferWorld();
        const d = pathDist(pts, x, y);
        if (d < best || (d === best && kind === 'transfer')) { best = d; bestId = id; }
      }
      if (bestId) return bestId;
      if (bodyObj && stage.pick(x, y, [bodyObj.group])) return g.body.id;
      return null;
    }
    function extraFor(id) {
      if (lvl() < 4 || !g) return undefined;
      const b = g.body;
      const pv = posVel();
      const height = (r) => (b.id === 'sun' ? `${nice(r / 1e6, 3)} million km` : dual.km(r - b.radius).text);
      if (id === 'craft') return [{ label: 'Height', value: height(pv.rMag) }, { label: 'Speed now', value: dual.kmps(pv.speed, 2).text }];
      if (id === 'push1') return [{ label: 'Speed change', value: dual.kmps(g.dv1, 2).text }];
      if (id === 'push2') return [{ label: 'Speed change', value: dual.kmps(g.dv2, 2).text }];
      if (id === 'transferPath') return [{ label: 'Trip time', value: friendlyDuration(g.tCoast) }];
      if (id === 'lowOrbit') return [{ label: 'Height', value: height(g.up ? g.r1 : g.r2) }];
      if (id === 'highOrbit') return [{ label: 'Height', value: height(g.up ? g.r2 : g.r1) }];
      return undefined;
    }
    if (canvas) {
      const onMove = (e) => {
        if (e.pointerType === 'touch' || e.buttons) return;
        const id = hit(e.clientX, e.clientY);
        if (id) { card.show(id, { x: e.clientX, y: e.clientY, extra: extraFor(id) }); canvas.style.cursor = 'pointer'; }
        else { card.hideHover(); canvas.style.cursor = ''; }
      };
      const onLeave = () => { card.hideHover(); canvas.style.cursor = ''; };
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerleave', onLeave);
      cleanup.push(() => { canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerleave', onLeave); canvas.style.cursor = ''; });
      cleanup.push(stage.onTap((e) => {
        const id = hit(e.clientX, e.clientY);
        if (id) card.show(id, { pinned: true, x: e.clientX, y: e.clientY, extra: extraFor(id) });
      }));
    }

    dbg = {
      burn1: null,
      burn2: null,
      get: () => ({ phase: sim.phase, s: sim.s, ang: sim.ang, alpha: sim.alpha, missed: sim.missed, auto: sim.auto, r1: g.r1, r2: g.r2, k, ek, tCoast: g.tCoast, pos: posVel(), geo: { dv1: g.dv1, dv2: g.dv2, total: g.total, frac: g.frac, up: g.up } }),
      fire1: () => fireBurn1(),
      fire2: () => fireBurn2(),
      windowOpen: () => windowOpen(),
      setS: (s) => { sim.s = s; },
      posVel: () => posVel(),
      hit: (x, y) => hit(x, y),
    };

    cleanup.push(stage.onFrame((dt) => update(dt)));
    const offTheme = stage.onTheme(() => applyTheme());
    cleanup.push(offTheme);
    cleanup.push(() => {
      [craft, speedArrow, flashArrow, startPath, targetDash, targetSolid, previewPath, livePath, fullPath].forEach((p) => p.dispose());
      if (marker1) marker1.dispose();
      if (marker2) marker2.dispose();
      if (bodyObj) bodyObj.dispose();
      stars.dispose();
      note3d.remove();
      stage.scene.remove(world);
      dbg = { burn1: null, burn2: null, get: null };
    });
    stage.requestRender();
  },

  unmount() {
    cleanup.splice(0).reverse().forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  },
};
