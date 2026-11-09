// orbital/mode-launch.js  Launch mode: Newton's cannon.
// A craft starts at a height above a real body and is fired with a speed and an angle.
// Too slow: it falls back (impact). Fast enough: it goes around (orbit). Faster still: it leaves (escape).
//
// The store is the single source of truth: every control writes store.launch / store.bodyId / store.time and a
// store subscriber redraws. Pure numbers come from launch-model.js (Node-testable); drawing uses space.js.

import { THREE } from '../shared/scene.js';
import {
  el, fmt, select, slider, button, toggle, section, stats, stat, legend, row, segmented,
} from '../shared/ui.js';
import { question, answer, tryThis, numbersSwitch } from '../shared/simple.js';
import { BODIES, BODY_ORDER } from './bodies.js';
import { propagate, formatDuration } from './physics.js';
import {
  sceneScale, createBody, createPath, createCraft, createArrow, createMarker, createStars, createRings,
  timeControl, createClock, frameSpace, spaceTheme,
} from './space.js';
import { ALT_RANGE, defaultLaunch, maxSpeed, computeLaunch, describe } from './launch-model.js';

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
const snap3 = (v) => Number(v.toPrecision(3));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

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
.launch-more[hidden] { display: none; }
.launch-speed-hint { margin-top: -4px; font-size: 13px; line-height: 1.4; color: var(--ink-2); }
.launch-gauge { display: flex; flex-direction: column; gap: 4px; padding: 2px 4px 0; }
.launch-gauge-title { font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 0 -4px 2px; }
.launch-gauge-top, .launch-gauge-bot { position: relative; height: 16px; font-size: 12px; line-height: 16px; color: var(--ink); white-space: nowrap; }
.launch-gauge-top span, .launch-gauge-bot span { position: absolute; top: 0; }
.launch-gauge-you { transform: translateX(-50%); font-weight: 600; }
.launch-gauge-bar { position: relative; height: 10px; border-radius: 5px; background: var(--paper-3); border: 1px solid var(--line-strong); }
.launch-gauge-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: var(--accent); opacity: 0.35; }
.launch-gauge-tick { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; background: var(--ink); }
.launch-gauge-dot { position: absolute; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: var(--accent); border: 2px solid var(--paper-2); box-shadow: 0 0 0 1px var(--ink); }
.launch-gauge-lbl-orbit { transform: translateX(-100%); padding-right: 5px; }
.launch-gauge-lbl-escape { padding-left: 5px; }
.launch-gauge-lbl-orbit::after { content: ''; }
`;

export default {
  id: 'launch',
  label: 'Launch',
  panelTitles: { a: 'Launch', b: 'What happens', c: 'Time' },
  _cleanup: [],

  mount(ctx) {
    const { stageEl, panelA, panelB, panelC, summaryEl, store, stage } = ctx;
    const cleanup = this._cleanup;
    let dead = false;

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
      const body = BODIES[s.bodyId] || BODIES.earth;
      let L = { showPath: true, showArrow: true, warp: 0, showNumbers: false, ...s.launch };
      L.showNumbers = !!L.showNumbers;
      const [lo, hi] = ALT_RANGE[body.id];
      if ((L.forBody ?? 'earth') !== body.id || !(L.alt >= lo && L.alt <= hi)) {
        const d = defaultLaunch(body);
        L = { ...L, alt: d.alt, speed: d.speed };
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

    // ---------- live readout (stage overlay and panel B) ----------
    const liveAlt = el('span', {}, el('span', { text: 'Altitude' }), el('b', { text: '' }));
    const liveSpd = el('span', {}, el('span', { text: 'Speed' }), el('b', { text: '' }));
    const liveTim = el('span', {}, el('span', { text: 'Time' }), el('b', { text: '' }));
    const liveSimple = el('span', {}, el('b', { text: '' }));
    const overlay = el('div', { class: 'launch-live', 'aria-hidden': 'true' }, liveSimple, liveAlt, liveSpd, liveTim);
    const paintOverlayMode = () => {
      const on = !!getL().showNumbers;
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

    function paintLive() {
      if (!model) return;
      const R = model.body.radius;
      const gone = sim.ended === 'gone';
      const alt = Math.max(0, Math.hypot(sim.r[0], sim.r[1]) - R);
      const spd = sim.ended === 'impact' ? model.stats.vImpact : Math.hypot(sim.v[0], sim.v[1]);
      const altS = gone ? 'Gone' : `${fmt(alt, alt >= 100 ? 0 : 1)} km`;
      const spdS = `${fmt(spd, 2)} km/s`;
      const timS = durText(sim.t);
      const plainS = sim.ended === 'impact' ? `Landed after ${plainTime(sim.t)}`
        : gone ? `Gone after ${plainTime(sim.t)}`
          : sim.t < 1 ? 'At launch' : `${plainTime(sim.t)} after launch`;
      if (plainS !== txt.plain) { txt.plain = plainS; liveSimple.lastChild.textContent = plainS; }
      if (altS !== txt.alt) { txt.alt = altS; liveAlt.lastChild.textContent = altS; sAlt.update(gone ? { value: 'Gone', unit: '' } : { value: alt, unit: 'km', digits: alt >= 100 ? 0 : 1 }); }
      if (spdS !== txt.spd) { txt.spd = spdS; liveSpd.lastChild.textContent = spdS; sSpd.update({ value: spd, unit: 'km/s', digits: 2 }); }
      if (timS !== txt.tim) { txt.tim = timS; liveTim.lastChild.textContent = timS; const d = durParts(sim.t); sTim.update({ value: d.value, unit: d.unit, digits: d.digits }); }
    }

    // ---------- panel A: Launch ----------
    const bodySel = select({
      label: 'World',
      options: BODY_ORDER.map((id) => ({ value: id, label: BODIES[id].name })),
      value: store.get().bodyId,
      onChange: (id) => {
        const b = BODIES[id];
        const d = defaultLaunch(b);
        const L = getL();
        const warp = L.warp === 0 || warpsFor(id).some((w) => w.value === L.warp) ? L.warp : 0;
        store.set({ bodyId: id, launch: { ...L, alt: d.alt, speed: d.speed, forBody: id, warp } });
      },
    });

    function physicsHere() {
      const b = bodyOf();
      const r0 = b.radius + getL().alt;
      return { b, vc: Math.sqrt(b.mu / r0), ve: Math.sqrt((2 * b.mu) / r0) };
    }
    // Plain words for a speed, compared with orbit speed and escape speed at the start height.
    function speedWords(speed) {
      const { vc, ve } = physicsHere();
      const r = speed / vc;
      if (speed < 1e-6) return 'no speed, just let go';
      if (r < 0.95) return 'slower than orbit speed';
      if (r <= 1.05) return 'as fast as an orbit needs';
      if (speed < ve * 0.999) return 'faster than orbit speed';
      return 'fast enough to escape';
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

    let busy = null; // the slider the person is dragging right now
    const speedS = slider({
      label: 'Speed', min: 0, max: SPEED_STEPS, step: 1, value: 0, unit: '',
      format: () => `${fmt((getL().speed / physicsHere().vc) * 100, 0)}% of orbit speed`,
      onInput: (pos) => {
        const b = bodyOf();
        busy = 'speed';
        setL({ speed: (pos / SPEED_STEPS) * maxSpeed(b, getL().alt) });
        busy = null;
        speedS.set(speedS.get());
      },
    });
    const speedHint = el('div', { class: 'launch-speed-hint' });

    const DIRS = [
      { value: '0', label: 'Sideways', deg: 0 },
      { value: '45', label: 'Up at an angle', deg: 45 },
      { value: '90', label: 'Straight up', deg: 90 },
    ];
    const dirSeg = segmented({
      label: 'Direction',
      options: DIRS.map((d) => ({ value: d.value, label: d.label })),
      value: '0',
      onChange: (v) => setL({ angleDeg: Number(v) }),
    });

    // More controls, shown with the numbers.
    const altS = slider({
      label: 'Start height above the surface', min: 0, max: ALT_STEPS, step: 0.5, value: 0, unit: 'km',
      format: () => fmt(getL().alt, 0),
      onInput: (pos) => {
        const b = bodyOf();
        const alt = snap3(altOfPos(b, pos));
        busy = 'alt';
        setL({ alt, speed: Math.min(getL().speed, maxSpeed(b, alt)) });
        busy = null;
        altS.set(altS.get());
      },
    });
    const angleS = slider({
      label: 'Launch angle', min: -30, max: 90, step: 1, value: 0, unit: '°',
      format: () => fmt(getL().angleDeg, 0),
      onInput: (v) => {
        busy = 'angle';
        setL({ angleDeg: v });
        busy = null;
        angleS.set(angleS.get());
      },
    });
    const angleHint = el('div', { class: 'launch-hint', text: '0° is level with the ground. 90° is straight up.' });
    const exactSpeedHint = el('div', { class: 'launch-hint' });
    const bDrop = button({ label: 'Drop', onClick: () => setL({ speed: 0 }) });
    const bCirc = button({ label: 'Circular speed', onClick: () => setL({ speed: physicsHere().vc, angleDeg: 0 }) });
    const bEsc = button({ label: 'Escape speed', onClick: () => setL({ speed: physicsHere().ve, angleDeg: 0 }) });
    const moreA = el('div', { class: 'launch-more' },
      altS.el, exactSpeedHint, angleS.el, angleHint,
      section('Quick settings', el('div', { class: 'launch-btns' }, bDrop, bCirc, bEsc)));

    // "Try this" steps set the controls and start the flight again.
    let playNext = false;
    function goStep(patch) {
      const before = getL();
      const b = bodyOf();
      const { vc, ve } = physicsHere();
      const p = typeof patch === 'function' ? patch(vc, ve) : patch;
      const speed = clamp(p.speed, 0, maxSpeed(b, before.alt));
      const angleDeg = p.angleDeg;
      const same = Math.abs(before.speed - speed) < 1e-12 && before.angleDeg === angleDeg;
      playNext = true;
      if (same) { restartSim(true); playNext = false; } else setL({ speed, angleDeg });
    }
    const tryBox = tryThis([
      { label: 'Drop it', hint: 'No speed at all', run: () => goStep({ speed: 0, angleDeg: 0 }) },
      { label: 'Throw it sideways, slowly', hint: 'About 60% of orbit speed', run: () => goStep((vc) => ({ speed: 0.6 * vc, angleDeg: 0 })) },
      { label: 'Throw it at orbit speed', hint: 'Just right', run: () => goStep((vc) => ({ speed: vc, angleDeg: 0 })) },
      { label: 'Throw it very fast', hint: 'A little over escape speed', run: () => goStep((vc, ve) => ({ speed: ve * 1.02, angleDeg: 0 })) },
    ]);

    panelA.append(el('div', { class: 'launch-stack' },
      question('How fast must you throw something so it never comes down?', 'Pick a world and a speed. Watch what happens.'),
      bodySel.el,
      el('div', { class: 'launch-stack', style: { gap: '8px' } }, speedS.el, speedHint),
      dirSeg.el,
      tryBox,
      moreA,
    ));

    // ---------- panel C: Time ----------
    const timeBox = el('div');
    const autoHint = el('div', { class: 'launch-hint' });
    const togPath = toggle({ label: 'Show the full path', value: getL().showPath, onChange: (v) => setL({ showPath: v }) });
    const togArrow = toggle({ label: 'Show speed arrow', value: getL().showArrow, onChange: (v) => setL({ showArrow: v }) });
    const key = legend([
      { color: 'var(--ink)', label: 'Predicted path' },
      { color: 'var(--hot)', label: 'Craft' },
      { color: 'var(--paper-2)', label: 'Launch point' },
    ]);
    key.lastChild.querySelector('.swatch').style.border = '2px solid var(--ink)';
    const exagNote = el('div', { class: 'launch-hint' });
    const moreC = el('div', { class: 'launch-more' }, autoHint, row(togPath.el), row(togArrow.el), key, exagNote);
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
      autoHint.textContent = getL().warp === 0 ? `Auto speed: ${flightPerSecond(w)}.` : `${flightPerSecond(w)}.`;
    }

    // ---------- panel B: What happens ----------
    const ans = answer({ kind: 'info', title: '' });

    // speed gauge: a bar from 0 to the top of the slider, ticks for orbit speed and escape speed, a marker for now
    const gTop = el('div', { class: 'launch-gauge-top' });
    const gYou = el('span', { class: 'launch-gauge-you', text: 'Your speed' });
    gTop.append(gYou);
    const gFill = el('div', { class: 'launch-gauge-fill' });
    const gTickO = el('div', { class: 'launch-gauge-tick' });
    const gTickE = el('div', { class: 'launch-gauge-tick' });
    const gDot = el('div', { class: 'launch-gauge-dot' });
    const gBar = el('div', { class: 'launch-gauge-bar' }, gFill, gTickO, gTickE, gDot);
    const gLblO = el('span', { class: 'launch-gauge-lbl-orbit', text: 'Orbit speed' });
    const gLblE = el('span', { class: 'launch-gauge-lbl-escape', text: 'Escape speed' });
    const gBot = el('div', { class: 'launch-gauge-bot' }, gLblO, gLblE);
    const gauge = el('div', { class: 'launch-gauge', role: 'img' },
      el('div', { class: 'launch-gauge-title', text: 'Speed gauge' }), gTop, gBar, gBot);
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
      gauge.setAttribute('aria-label', `Your speed is ${speedShort(m.speed)}. Orbit speed and escape speed are marked on the bar.`);
    }

    const tilesBox = stats();
    let tileSig = '';
    let tiles = {};
    const whyBox = el('div', { class: 'launch-why' });
    const numbers = numbersSwitch({
      value: !!getL().showNumbers,
      onChange: (v) => { if (getL().showNumbers !== v) setL({ showNumbers: v }); },
    },
    section('Numbers', tilesBox),
    section('Why', whyBox),
    section('Right now', stats(sAlt.el, sSpd.el, sTim.el)));
    panelB.append(el('div', { class: 'launch-stack' }, ans.el, gauge, numbers.el));

    function applyNumbers() {
      const on = !!getL().showNumbers;
      moreA.hidden = !on;
      moreC.hidden = !on;
      if (numbers.get() !== on) numbers.set(on);
      paintOverlayMode();
    }

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

    function paintResults() {
      const m = model;
      const d = describe(m, fmt);
      ans.update({ kind: d.kind, title: d.title, text: d.text });
      paintGauge(m);
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
      const tail = m.outcome === 'orbit' ? 'stays in orbit'
        : m.outcome === 'decay' ? 'skims the air and comes down'
          : m.outcome === 'impact' ? 'falls back' : 'escapes';
      summaryEl.textContent = `${b.name} · ${speedShort(m.speed)} · ${tail}`;
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
      dirSeg.set(DIRS.some((d) => d.deg === L.angleDeg) ? String(L.angleDeg) : '');
      speedHint.textContent = `${fmt(L.speed, 1)} km/s, ${speedWords(L.speed)}`;
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
      const idx = Math.ceil(Math.log(model.extent) / Math.log(1.5) - 1e-9);
      let rescaled = false;
      if (kIdx === null || bodyChanged || idx > kIdx || idx <= kIdx - 2) { kIdx = idx; rescaled = true; }
      k = sceneScale(Math.pow(1.5, kIdx));

      if (bodyChanged) {
        if (bodyObj) bodyObj.dispose();
        bodyObj = createBody(body, k, { minRadiusUnits: 1.2, graticule: true });
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
      const showImp = model.outcome === 'impact' && !!model.imp;
      const mImpact = marker('impact', 'Impact', steep ? 'left' : 'right');
      mImpact.object.visible = showImp;
      if (showImp) mImpact.setPosition(model.imp.r, k);
      const showAp = !!model.apsides;
      const mLow = marker('low', 'Lowest point', 'left');
      const mHigh = marker('high', 'Highest point', 'right');
      mLow.object.visible = showAp && model.startAt !== 'lowest';
      mHigh.object.visible = showAp && model.startAt !== 'highest';
      if (showAp) { mLow.setPosition(model.apsides.peri, k); mHigh.setPosition(model.apsides.apo, k); }
      launchArrow.set(r0v, model.start.v, k, 12);
      recolorArrow();

      const exag = bodyObj.exaggerated;
      const msg = exag ? `${body.name} is not to scale here. It is drawn larger so that it stays visible.` : '';
      exagNote.textContent = msg;
      exagNote.style.display = msg ? '' : 'none';
      note.textContent = exag ? `${body.name} not to scale` : '';

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
      if (a.showNumbers !== b.showNumbers) applyNumbers();
    });
    cleanup.push(unsub);

    // first build
    applyNumbers();
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
