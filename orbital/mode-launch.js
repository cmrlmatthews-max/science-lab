// orbital/mode-launch.js  Launch mode: Newton's cannon.
// A craft starts at a height above a real body and is fired with a speed and an angle.
// Too slow: it falls back (impact). Fast enough: it goes around (orbit). Faster still: it leaves (escape).
//
// The store is the single source of truth: every control writes store.launch / store.bodyId / store.time and a
// store subscriber redraws. Pure numbers come from launch-model.js (Node-testable); drawing uses space.js.

import { THREE } from '../shared/scene.js';
import {
  el, fmt, select, slider, button, toggle, section, stats, stat, banner, legend, row,
} from '../shared/ui.js';
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
`;

export default {
  id: 'launch',
  label: 'Launch',
  panelTitles: { a: 'Launch', b: 'Result', c: 'Time' },
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
      let L = { showPath: true, showArrow: true, warp: 0, ...s.launch };
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
    const launchArrow = createArrow({ radius: 0.3 });
    const speedArrow = createArrow({ color: spaceTheme().craft, radius: 0.3 });
    const recolorArrow = () => speedArrow.object.traverse((o) => { if (o.material && o.material.color) o.material.color.set(spaceTheme().craft); });
    cleanup.push(stage.onTheme(() => { recolorArrow(); if (pathObj) pathObj.setColor(spaceTheme().ink); }));
    let mStart = createMarker('Start', { side: 'right' });
    let startLabel = 'Start';
    const mImpact = createMarker('Impact', { side: 'left' });
    const mLow = createMarker('Lowest point', { side: 'left' });
    const mHigh = createMarker('Highest point', { side: 'right' });
    world.add(craft.object, launchArrow.object, speedArrow.object, mStart.object, mImpact.object, mLow.object, mHigh.object);

    const clock = createClock();
    const sim = { r: [0, 0], v: [0, 0], t: 0, ended: null, autoPaused: false };
    let model = null;
    let kIdx = null;
    let k = 1;

    // ---------- live readout (stage overlay and panel B) ----------
    const liveAlt = el('span', {}, el('span', { text: 'Altitude' }), el('b', { text: '' }));
    const liveSpd = el('span', {}, el('span', { text: 'Speed' }), el('b', { text: '' }));
    const liveTim = el('span', {}, el('span', { text: 'Time' }), el('b', { text: '' }));
    const overlay = el('div', { class: 'launch-live', 'aria-hidden': 'true' }, liveAlt, liveSpd, liveTim);
    const note = el('div', { class: 'launch-note' });
    stageEl.append(overlay, note);
    cleanup.push(() => { overlay.remove(); note.remove(); });
    const txt = { alt: '', spd: '', tim: '' };

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
      if (altS !== txt.alt) { txt.alt = altS; liveAlt.lastChild.textContent = altS; sAlt.update(gone ? { value: 'Gone', unit: '' } : { value: alt, unit: 'km', digits: alt >= 100 ? 0 : 1 }); }
      if (spdS !== txt.spd) { txt.spd = spdS; liveSpd.lastChild.textContent = spdS; sSpd.update({ value: spd, unit: 'km/s', digits: 2 }); }
      if (timS !== txt.tim) { txt.tim = timS; liveTim.lastChild.textContent = timS; const d = durParts(sim.t); sTim.update({ value: d.value, unit: d.unit, digits: d.digits }); }
    }

    // ---------- panel A: Launch ----------
    const bodySel = select({
      label: 'Central body',
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

    let busy = null; // the slider the person is dragging right now
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
    const speedS = slider({
      label: 'Launch speed', min: 0, max: SPEED_STEPS, step: 1, value: 0, unit: 'km/s',
      format: () => fmt(getL().speed, 2),
      onInput: (pos) => {
        const b = bodyOf();
        busy = 'speed';
        setL({ speed: (pos / SPEED_STEPS) * maxSpeed(b, getL().alt) });
        busy = null;
        speedS.set(speedS.get());
      },
    });
    const speedHint = el('div', { class: 'launch-hint' });
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

    function physicsHere() {
      const b = bodyOf();
      const r0 = b.radius + getL().alt;
      return { b, vc: Math.sqrt(b.mu / r0), ve: Math.sqrt((2 * b.mu) / r0) };
    }
    const bDrop = button({ label: 'Drop', onClick: () => setL({ speed: 0 }) });
    const bCirc = button({ label: 'Circular speed', onClick: () => setL({ speed: physicsHere().vc, angleDeg: 0 }) });
    const bEsc = button({ label: 'Escape speed', onClick: () => setL({ speed: physicsHere().ve, angleDeg: 0 }) });

    panelA.append(
      section('Body', bodySel.el),
      section('Launch', altS.el, speedS.el, speedHint, angleS.el, angleHint),
      section('Quick settings', el('div', { class: 'launch-btns' }, bDrop, bCirc, bEsc)),
    );

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
    panelC.append(
      section('Playback', timeBox, autoHint),
      section('Show', row(togPath.el), row(togArrow.el)),
      section('Key', key, exagNote),
    );

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

    // ---------- panel B: Result ----------
    const bannerBox = el('div');
    let bannerKey = '';
    const tilesBox = stats();
    let tileSig = '';
    let tiles = {};
    const whyBox = el('div', { class: 'launch-why' });
    panelB.append(
      bannerBox,
      section('Right now', stats(sAlt.el, sSpd.el, sTim.el)),
      section('Numbers', tilesBox),
      section('Why', whyBox),
    );

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
      const bk = `${d.kind}|${d.title}`;
      if (bk !== bannerKey) {
        bannerKey = bk;
        bannerBox.replaceChildren(banner({ kind: d.kind, title: d.title, text: d.text }));
      }
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
      const S = m.stats;
      const tail = m.outcome === 'orbit' ? `orbit, ${durText(S.period)}`
        : m.outcome === 'decay' ? 'orbit too low'
          : m.outcome === 'impact' ? `impact in ${durText(S.tImpact)}` : 'escape';
      summaryEl.textContent = `${b.name} · ${fmt(m.speed, 2)} km/s at ${fmt(m.alt, 0)} km · ${tail}`;
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
      speedHint.textContent = `Circular speed here is ${fmt(vc, 2)} km/s. Escape speed is ${fmt(ve, 2)} km/s.`;
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
      // space.js setLabel can grow the label canvas, which a GPU texture cannot follow, so a new label means a new marker
      const wantLabel = model.startAt === 'lowest' ? 'Start, lowest point' : model.startAt === 'highest' ? 'Start, highest point' : 'Start';
      if (wantLabel !== startLabel) {
        mStart.dispose();
        mStart = createMarker(wantLabel, { side: 'right' });
        world.add(mStart.object);
        startLabel = wantLabel;
      }
      mStart.setPosition(r0v, k);
      mImpact.object.visible = model.outcome === 'impact' && !!model.imp;
      if (mImpact.object.visible) mImpact.setPosition(model.imp.r, k);
      const showAp = !!model.apsides;
      mLow.object.visible = showAp && model.startAt !== 'lowest';
      mHigh.object.visible = showAp && model.startAt !== 'highest';
      if (showAp) { mLow.setPosition(model.apsides.peri, k); mHigh.setPosition(model.apsides.apo, k); }
      launchArrow.set(r0v, model.start.v, k, 10);
      recolorArrow();

      const exag = bodyObj.exaggerated;
      const msg = exag ? `${body.name} is not to scale here. It is drawn larger so that it stays visible.` : '';
      exagNote.textContent = msg;
      exagNote.style.display = msg ? '' : 'none';
      note.textContent = exag ? `${body.name} not to scale` : '';

      // Look almost straight down on the orbit plane: from a lower angle the body hides the far half of a low path.
      if (rescaled) frameSpace(stage, 100, { elevationDeg: 82, azimuthDeg: 0 });
      applyWarp();
      restartSim();
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

    // first build
    syncControls();
    recompute();
    cleanup.push(stage.onFrame((dt) => { frameDt = dt; update(); }));

    cleanup.push(() => {
      // hand shared time state back in a neutral shape for the other modes
      const t = store.get().time;
      store.set({ time: { playing: sim.autoPaused ? true : t.playing, warp: 1 } });
      [pathObj, craft, launchArrow, speedArrow, mStart, mImpact, mLow, mHigh, bodyObj].forEach((p) => { if (p) p.dispose(); });
      stars.dispose();
      rings.dispose();
      stage.scene.remove(world);
    });
  },

  unmount() {
    this._cleanup.splice(0).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  },
};
