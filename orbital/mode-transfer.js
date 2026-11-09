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
//     showBoth, showArrow            display toggles
//     sim      { ang, s, alpha, missed, auto }  live flight state, mutated in place so it survives a mode switch
//   }
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
import { el, select, slider, segmented, toggle, button, stat, stats, section, banner, sourceTag, fmt } from '../shared/ui.js';
import { BODIES, BODY_ORDER, TRANSFER_PRESETS } from './bodies.js';
import { hohmann, elementsFromApsides, samplePath, positionAtTime, propellantFraction, formatDuration } from './physics.js';
import { sceneScale, createBody, createPath, createCraft, createArrow, createMarker, createStars, timeControl, frameSpace, spaceTheme } from './space.js';

const TWO_PI = Math.PI * 2;
const ENGINES = [
  { value: '280', label: 'Solid rocket' },
  { value: '340', label: 'Kerosene' },
  { value: '450', label: 'Hydrogen' },
];
const SLIDER_RANGE = { earth: [200, 400000], moon: [20, 20000], mars: [100, 50000], sun: [40e6, 400e6] };
const FUEL_SOURCE = 'Fuel share from the rocket equation. Higher engine efficiency needs less fuel.';
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
.tf-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.tf-actions .btn:disabled { opacity: 0.4; cursor: default; }
.tf-status { font-size: 12.5px; line-height: 1.4; color: var(--ink-2); min-height: 2.8em; }
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
.tf-sw-dot { flex: none; width: 9px; height: 9px; border-radius: 50%; background: var(--ink); border: 2px solid var(--paper-2); box-shadow: 0 0 0 1px var(--ink); margin: 0 6px; }
.tf-3d-note { position: absolute; left: 10px; bottom: 8px; font-size: 11.5px; color: var(--ink-2); pointer-events: none; }
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

function dur(seconds) {
  const d = formatDuration(seconds);
  return `${fmt(d.value, d.unit === 's' || d.unit === 'min' ? 0 : 1)} ${d.unit}`;
}

export default {
  id: 'transfer',
  label: 'Transfer',
  panelTitles: { a: 'Transfer', b: 'Result', c: 'Time' },
  get _debug() { return dbg; },

  mount(ctx) {
    const { stageEl, panelA, panelB, panelC, summaryEl, store, stage } = ctx;
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

    let theme = spaceTheme();
    const dummy = [[0, 0], [1, 0]];
    const noDepth = (p, order) => { p.object.material.depthTest = false; p.object.renderOrder = order; return p; };
    let bodyObj = null;
    const bodyOpts = { minRadiusUnits: 0 };
    let k = 1;
    let ek = 0; // radial display offset, km
    let lastBucket = null;
    let lastBodyId = null;

    const startPath = noDepth(createPath(dummy, 1, { closed: true, color: theme.ink2, opacity: 0.85 }), 4);
    const targetDash = noDepth(createPath(dummy, 1, { closed: true, dashed: true, opacity: 0.8 }), 3);
    const targetSolid = noDepth(createPath(dummy, 1, { closed: true, opacity: 0.95 }), 4);
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
      theme = spaceTheme();
      startPath.setColor(theme.ink2);
      previewPath.setColor(theme.craft);
      livePath.setColor(theme.craft);
      fullPath.setColor(theme.craft);
      flashArrow.dispose();
      flashArrow = createArrow({ color: theme.craft, radius: 0.42 });
      world.add(flashArrow.object);
      legendEl.style.setProperty('--tf-craft', theme.craft);
      stage.requestRender();
    }

    function placeMarkers() {
      if (marker1) { marker1.dispose(); marker1 = null; }
      if (marker2) { marker2.dispose(); marker2 = null; }
      if (sim.phase === 'orbit1' || g.same) return;
      const a = pol(sim.alpha, g.r1);
      const b = pol(sim.alpha + Math.PI, g.r2);
      marker1 = createMarker('Burn 1', { side: a[0] >= 0 ? 'right' : 'left' });
      marker2 = createMarker('Burn 2', { side: b[0] >= 0 ? 'right' : 'left' });
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
      const bucket = Math.ceil(Math.log(raw) / Math.log(1.5) - 1e-9);
      k = Math.pow(1.5, bucket);

      // body size and radial offset: keep a small visible gap between the body and the start orbit
      const GAP = 0.9;
      const realUnits = body.radius / k;
      const minR = body.id === 'sun' ? 3 : (realUnits < 1.6 ? 1.6 : 0);
      bodyOpts.minRadiusUnits = minR;
      const drawnR = Math.max(realUnits, minR);
      ek = Math.max(0, drawnR + GAP - g.r1 / k) * k;
      if (!bodyObj || lastBodyId !== body.id) rebuildBody(); else bodyObj.setScale(k);
      note3d.textContent = bodyObj.exaggerated ? `${body.name} not to scale` : '';

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
        frameSpace(stage, 44, { elevationDeg: lowHug ? 68 : 55, padding: 1.05 });
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
    const fly1 = button({ label: 'Burn 1', kind: 'primary', onClick: () => fireBurn1() });
    const fly2 = button({ label: 'Burn 2', onClick: () => { if (windowOpen()) fireBurn2(); } });
    const flyAuto = button({ label: 'Run it for me', onClick: () => runForMe() });
    const flyReset = button({ label: 'Start over', kind: 'ghost', onClick: () => startOver() });
    const statusEl = el('p', { class: 'tf-status', 'aria-live': 'polite' });
    panelA.append(section('Fly the transfer',
      el('div', { class: 'tf-actions' }, fly1, fly2, flyAuto, flyReset),
      statusEl,
      el('p', { class: 'tf-caption', text: 'Run it for me fires burn 1 at once and burn 2 at exactly the far end.' })));

    const bodySel = select({
      label: 'Central body',
      options: BODY_ORDER.map((id) => ({ value: id, label: BODIES[id].name })),
      value: store.get().bodyId,
      onChange: onBodyChange,
    });
    panelA.append(section('Central body', bodySel.el));

    const presetsEl = el('div', { class: 'tf-presets', role: 'group', 'aria-label': 'Route' });
    panelA.append(section('Route', presetsEl));

    const sameBanner = banner({ kind: 'info', text: 'The orbits are the same. No burn is needed.' });

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
    const fmtVal = (body, v) => (body.id === 'sun' ? `${fmt(v / 1e6, 1)} million km` : `${fmt(v, 0)} km`);
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
    const sStart = makeOrbitSlider('Start orbit height', () => toVal(bodyOf(), getT().alt1 + bodyOf().radius), (v) => {
      setT({ alt1: bodyOf().id === 'sun' ? v - bodyOf().radius : v, presetId: 'custom' });
      configChanged({ keepAng: true });
    });
    const sTarget = makeOrbitSlider('Target orbit height', () => toVal(bodyOf(), getT().r2), (v) => {
      setT({ r2: toR(bodyOf(), v), presetId: 'custom' });
      configChanged({ keepAng: true });
    });
    const swapBtn = button({ label: 'Swap start and target', kind: 'ghost', onClick: () => {
      const b = bodyOf();
      const T = getT();
      const r1 = b.radius + T.alt1;
      setT({ alt1: T.r2 - b.radius, r2: r1, presetId: 'custom' });
      configChanged({ keepAng: false });
    } });
    panelA.append(section('Orbit heights', sStart.el, sTarget.el, swapBtn, sameBanner));

    const engineSeg = segmented({
      label: 'Engine type', options: ENGINES, value: String(getT().isp),
      onChange: (v) => { setT({ isp: Number(v) }); g = geometry(); paintStatic(); },
    });
    panelA.append(section('Engine', engineSeg.el, el('div', { class: 'row' }, sourceTag(FUEL_SOURCE))));

    function paintPresets() {
      const b = bodyOf();
      const T = getT();
      presetsEl.replaceChildren(...(TRANSFER_PRESETS[b.id] || []).map((p) => {
        const a1 = p.alt1 != null ? p.alt1 : p.r1 - b.radius;
        const r2 = p.r2 != null ? p.r2 : b.radius + p.alt2;
        const sub = b.id === 'sun'
          ? `${fmt((a1 + b.radius) / 1e6, 1)} to ${fmt(r2 / 1e6, 1)} million km from the Sun`
          : `${fmt(a1, 0)} km to ${fmt(r2 - b.radius, 0)} km above the surface`;
        const btn = el('button', { type: 'button', class: 'tf-preset', 'aria-pressed': T.presetId === p.id ? 'true' : 'false' },
          el('span', { class: 'tf-preset-name', text: p.name }),
          el('span', { class: 'tf-preset-sub', text: p.approx ? `${sub} · approximate` : sub }));
        btn.addEventListener('click', () => {
          loadPreset(b, p);
          configChanged({ keepAng: false, reframe: true, resetWarp: true });
        });
        return btn;
      }));
    }

    // ----- panel B -----
    const stepsEl = el('ol', { class: 'tf-steps', 'aria-label': 'Flight stage' },
      ['Start orbit', 'Coast', 'Target orbit'].map((t, i) => el('li', { class: 'tf-step', 'data-state': 'todo' }, el('span', { class: 'tf-dot', text: String(i + 1) }), el('span', { class: 'tf-step-label', text: t }))));
    const liveHeight = stat({ label: 'Height above the surface', value: 0, unit: 'km', digits: 0 });
    const liveSpeed = stat({ label: 'Speed now', value: 0, unit: 'km/s', digits: 2 });
    const liveLeft = stat({ label: 'Coast time left', value: '—', digits: 1 });
    liveHeight.el.dataset.key = 'height'; liveSpeed.el.dataset.key = 'speed'; liveLeft.el.dataset.key = 'left';
    const missedBanner = banner({ kind: 'info', text: 'Burn 2 was not made. The craft stays on the oval path.' });
    missedBanner.style.display = 'none';
    panelB.append(section('Where the craft is', stepsEl, stats(liveHeight.el, liveSpeed.el, liveLeft.el), missedBanner));

    const tBurn1 = stat({ label: 'Burn 1 speed change', value: 0, unit: 'km/s', digits: 2 });
    const tBurn2 = stat({ label: 'Burn 2 speed change', value: 0, unit: 'km/s', digits: 2 });
    const tTotal = stat({ label: 'Total speed change', value: 0, unit: 'km/s', digits: 2 });
    const tCoast = stat({ label: 'Coast time', value: 0, unit: 'h', digits: 1 });
    const tFuel = stat({ label: 'Fuel share of the craft mass', value: 0, unit: '%', digits: 1, source: FUEL_SOURCE });
    const tV1 = stat({ label: 'Speed in the start orbit', value: 0, unit: 'km/s', digits: 2 });
    const tV2 = stat({ label: 'Speed in the target orbit', value: 0, unit: 'km/s', digits: 2 });
    [['burn1', tBurn1], ['burn2', tBurn2], ['total', tTotal], ['coast', tCoast], ['fuel', tFuel], ['v1', tV1], ['v2', tV2]].forEach(([key, t]) => { t.el.dataset.key = key; });
    panelB.append(section('The plan', stats(tBurn1.el, tBurn2.el, tTotal.el, tCoast.el, tFuel.el, tV1.el, tV2.el)));

    const barFuel = el('div', { class: 'tf-bar-fuel' });
    const barRest = el('div', { class: 'tf-bar-rest' });
    const bar = el('div', { class: 'tf-bar', role: 'img' }, barFuel, barRest);
    const keyFuel = el('span', { text: '' });
    const keyRest = el('span', { text: '' });
    const keyEl = el('ul', { class: 'tf-key' },
      el('li', {}, el('span', { class: 'tf-key-sw', style: 'background: var(--accent-soft); background: color-mix(in srgb, var(--accent) 38%, transparent); border-color: var(--accent-edge)' }), keyFuel),
      el('li', {}, el('span', { class: 'tf-key-sw', style: 'background: var(--track)' }), keyRest));
    panelB.append(section('What the craft is made of at the start', bar, keyEl));

    const notesEl = el('div', { class: 'tf-notes' });
    panelB.append(section('What is happening', notesEl));

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
    panelC.append(section('Playback', tcWrap));
    panelC.append(section('Show',
      toggle({ label: 'Show both orbits', value: getT().showBoth !== false, onChange: (v) => { setT({ showBoth: v }); syncVisibility(); } }).el,
      toggle({ label: 'Show speed arrow', value: !!getT().showArrow, onChange: (v) => { setT({ showArrow: v }); if (!v) speedArrow.setVisible(false); stage.requestRender(); } }).el));
    const legendEl = el('ul', { class: 'legend' },
      el('li', { class: 'legend-item' }, el('span', { class: 'tf-sw-line', style: 'border-top-color: var(--ink-2)' }), 'Start orbit'),
      el('li', { class: 'legend-item' }, el('span', { class: 'tf-sw-line', 'data-dash': 'true', style: 'border-top-color: var(--accent)' }), 'Target orbit'),
      el('li', { class: 'legend-item' }, el('span', { class: 'tf-sw-line', style: 'border-top-color: var(--tf-craft)' }), 'Transfer path'),
      el('li', { class: 'legend-item' }, el('span', { class: 'tf-sw-dot' }), 'Burn points'));
    legendEl.style.setProperty('--tf-craft', theme.craft);
    panelC.append(section('Legend', legendEl));

    // ----- painting -----
    function paintStatic() {
      const b = g.body;
      const T = getT();
      // controls
      bodySel.set(b.id);
      sStart.el.querySelector('.field-label').textContent = b.id === 'sun' ? 'Start orbit distance from the Sun' : 'Start orbit height';
      sTarget.el.querySelector('.field-label').textContent = b.id === 'sun' ? 'Target orbit distance from the Sun' : 'Target orbit height';
      sStart.set(posOf(toVal(b, g.r1), b));
      sTarget.set(posOf(toVal(b, g.r2), b));
      engineSeg.set(String(T.isp));
      paintPresets();
      sameBanner.style.display = g.same ? '' : 'none';
      // tiles
      const word = (up) => (g.same ? 'No burn needed' : up ? 'Speed up' : 'Slow down');
      tBurn1.update({ value: g.dv1, hint: word(g.up) });
      tBurn2.update({ value: g.dv2, hint: word(g.up) });
      tTotal.update({ value: g.total });
      const d = formatDuration(g.tCoast);
      tCoast.update({ value: g.same ? '—' : d.value, unit: g.same ? '' : d.unit, digits: d.unit === 'days' && d.value < 10 ? 2 : 1 });
      tFuel.update({ value: g.frac * 100 });
      tV1.update({ value: g.v1 });
      tV2.update({ value: g.v2 });
      const fuelPct = g.frac * 100;
      barFuel.style.width = `${fuelPct}%`;
      barFuel.textContent = fuelPct >= 14 ? `${fmt(fuelPct, 1)}%` : '';
      barFuel.style.borderRight = fuelPct > 0.05 ? '' : '0';
      barRest.textContent = 100 - fuelPct >= 14 ? `${fmt(100 - fuelPct, 1)}%` : '';
      keyFuel.textContent = `Fuel ${fmt(fuelPct, 1)}%`;
      keyRest.textContent = `Everything else ${fmt(100 - fuelPct, 1)}%`;
      bar.setAttribute('aria-label', `Fuel ${fmt(fuelPct, 1)} percent, everything else ${fmt(100 - fuelPct, 1)} percent`);
      liveHeight.el.querySelector('.stat-label').textContent = b.id === 'sun' ? 'Distance from the Sun' : 'Height above the surface';
      liveHeight.update({ unit: b.id === 'sun' ? 'million km' : 'km', digits: b.id === 'sun' ? 1 : 0 });
      // notes
      const notes = [];
      if (g.same) notes.push(el('p', { class: 'tf-note', text: 'The start orbit and the target orbit are the same, so the craft just keeps circling.' }));
      else if (g.up) {
        notes.push(el('p', { class: 'tf-note', text: 'Burn 1 adds speed, so the far side of the path rises to the target orbit. The craft slows as it climbs.' }));
        notes.push(el('p', { class: 'tf-note', text: 'Burn 2 adds speed again to make the path round.' }));
        notes.push(el('p', { class: 'tf-note', text: 'The craft ends in a higher orbit moving slower than it started, even though both burns added speed.' }));
      } else {
        notes.push(el('p', { class: 'tf-note', text: 'Burn 1 slows the craft, so the far side of the path dips down to the target orbit. The craft speeds up as it falls.' }));
        notes.push(el('p', { class: 'tf-note', text: 'Burn 2 slows the craft again to make the path round.' }));
        notes.push(el('p', { class: 'tf-note', text: 'The craft ends in a lower orbit moving faster than it started, even though both burns slowed it.' }));
      }
      if (b.id === 'sun' && T.presetId === 'earth-mars') {
        notes.push(el('p', { class: 'tf-note' }, 'A real trip must leave when Mars will be at the meeting point. That launch window comes about every 26 months. ', sourceTag('Synodic period of Earth and Mars, about 780 days')));
      }
      notesEl.replaceChildren(...notes);
      // summary
      const h1 = b.id === 'sun' ? `${fmt(g.r1 / 1e6, 1)} million km` : `${fmt(T.alt1, 0)} km`;
      const h2 = b.id === 'sun' ? `${fmt(g.r2 / 1e6, 1)} million km` : `${fmt(g.r2 - b.radius, 0)} km`;
      summaryEl.textContent = g.same
        ? `${b.name} · ${h1} · same orbit, no burn needed`
        : `${b.name} · ${h1} to ${h2} · ${fmt(g.total, 2)} km/s · ${fmt(d.value, d.unit === 'days' && d.value < 10 ? 2 : 1)} ${d.unit} · fuel ${fmt(fuelPct, 0)}%`;
      paintLive(true);
    }

    let liveClock = 1;
    function paintLive(force) {
      if (!g) return;
      const b = g.body;
      const pv = posVel();
      const ph = sim.phase;
      // buttons
      fly1.disabled = g.same || ph !== 'orbit1';
      fly2.disabled = g.same || !windowOpen();
      flyAuto.disabled = g.same;
      // stepper
      const order = ['orbit1', 'coast', 'orbit2'];
      const cur = order.indexOf(ph);
      Array.from(stepsEl.children).forEach((li, i) => {
        li.dataset.state = i < cur ? 'done' : i === cur ? 'current' : 'todo';
        li.setAttribute('aria-current', i === cur ? 'step' : 'false');
        li.querySelector('.tf-dot').textContent = i < cur ? '✓' : String(i + 1);
      });
      panelB.dataset.phase = ph;
      // readouts
      liveHeight.update({ value: b.id === 'sun' ? pv.rMag / 1e6 : pv.rMag - b.radius });
      liveHeight.el.dataset.rKm = pv.rMag.toFixed(1);
      liveSpeed.update({ value: pv.speed });
      let left = null;
      if (ph === 'coast' && !g.same) left = farInfo().toNext;
      if (left == null) liveLeft.update({ value: '—', unit: '', hint: ph === 'orbit1' ? 'After burn 1' : 'Coast is over' });
      else { const d = formatDuration(left); liveLeft.update({ value: d.value, unit: d.unit, digits: 1, hint: windowOpen() ? 'Burn 2 is ready' : sim.missed ? 'To the next pass' : '' }); }
      missedBanner.style.display = ph === 'coast' && sim.missed ? '' : 'none';
      // status line
      let msg;
      if (g.same) msg = 'No burn is needed.';
      else if (ph === 'orbit1') msg = 'In the start orbit. Press Burn 1 when ready.';
      else if (ph === 'orbit2') msg = 'In the target orbit. The transfer is complete.';
      else if (sim.missed) msg = `Burn 2 was not made. The craft stays on the oval path. The next pass is in ${dur(left)}.`;
      else if (windowOpen()) msg = 'Near the far end. Burn 2 is ready.';
      else msg = `Coasting to the far end. ${dur(left)} to go.`;
      if (statusEl.textContent !== msg) statusEl.textContent = msg;
    }

    // ----- change handlers -----
    function configChanged({ keepAng = false, reframe = false, resetWarp = false } = {}) {
      g = geometry();
      const ang = sim.ang;
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
        }
      }
      if (sim.phase === 'coast' && !sim.missed && !g.same && sim.s > g.tCoast * (1 + WINDOW_FRAC)) { sim.missed = true; syncVisibility(); }
      const pv = posVel();
      if (sim.phase === 'orbit1') tfGroup.rotation.y = rotFor(sim.ang);
      craft.setPosition(disp(pv.r), k);
      if (getT().showArrow) speedArrow.set(disp(pv.r), pv.v, k, 9);
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

    dbg = {
      burn1: null,
      burn2: null,
      get: () => ({ phase: sim.phase, s: sim.s, ang: sim.ang, alpha: sim.alpha, missed: sim.missed, auto: sim.auto, r1: g.r1, r2: g.r2, k, ek, tCoast: g.tCoast, pos: posVel(), geo: { dv1: g.dv1, dv2: g.dv2, total: g.total, frac: g.frac, up: g.up } }),
      fire1: () => fireBurn1(),
      fire2: () => fireBurn2(),
      windowOpen: () => windowOpen(),
      setS: (s) => { sim.s = s; },
      posVel: () => posVel(),
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
