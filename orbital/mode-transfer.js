// orbital/mode-transfer.js  STUB. Another worker replaces this file with the real Transfer mode.
// It proves every space.js helper: body, path, craft with trail, arrow, marker, rings, stars, time control.
// mode default export: { id, label, panelTitles, mount(ctx), unmount() }

import { THREE } from '../shared/scene.js';
import { select, stat, stats, section, fmt } from '../shared/ui.js';
import { BODIES, BODY_ORDER } from './bodies.js';
import { elementsFromApsides, samplePath, positionAtTime, formatDuration } from './physics.js';
import {
  sceneScale, createBody, createPath, createCraft, createArrow, createMarker, createStars, createRings,
  timeControl, createClock, frameSpace,
} from './space.js';

const WARPS = [{ value: 0.5, label: '0.5x' }, { value: 1, label: '1x' }, { value: 2, label: '2x' }, { value: 5, label: '5x' }, { value: 10, label: '10x' }];

// Circular demo orbit: 400 km up, or Earth's distance from the Sun.
function demoRadius(body) { return body.id === 'sun' ? 149597870.7 : body.radius + 400; }

export default {
  id: 'transfer',
  label: 'Transfer',
  panelTitles: { a: 'Setup', b: 'Results', c: 'Time' },
  _cleanup: [],

  mount(ctx) {
    const { panelA, panelB, panelC, summaryEl, store, stage } = ctx;
    const cleanup = this._cleanup;
    const world = new THREE.Group();
    stage.scene.add(world);
    const stars = createStars(260);
    const rings = createRings({ radiusUnits: 100 });
    stage.scene.add(stars, rings.object);

    const clock = createClock();
    let parts = null; // everything that depends on the body
    let periodS = 1;

    function build() {
      if (parts) { parts.dispose(); parts = null; }
      const body = BODIES[store.get().bodyId] || BODIES.earth;
      const r = demoRadius(body);
      const k = sceneScale(r * 1.2);
      const el = { ...elementsFromApsides(body.mu, r, r), argPeri: 0 };
      periodS = el.period;
      const bodyObj = createBody(body, k, { minRadiusUnits: body.id === 'sun' ? 3 : 0 });
      const path = createPath(samplePath(body.mu, el, 180), k, { closed: true });
      const craft = createCraft({ trail: 90 });
      const arrow = createArrow();
      const marker = createMarker('Orbit start', { side: 'right' });
      marker.setPosition([r, 0], k);
      world.add(bodyObj.group, path.object, craft.object, arrow.object, marker.object);
      parts = {
        body, k, el, r, bodyObj, path, craft, arrow, marker,
        dispose() { [arrow, craft, marker, path, bodyObj].forEach((p) => p.dispose()); },
      };
      clock.reset(0);
      update(0);
      frameSpace(stage, 100); // the body changed a lot: frame once
      paintStats();
      stage.requestRender();
    }

    function update(dt) {
      if (!parts) return;
      const { body, el, k, craft, arrow, bodyObj } = parts;
      const { playing, warp } = store.get().time;
      // one orbit takes 40 s at 1x
      clock.tick(dt, warp * (periodS / 40), playing);
      const s = positionAtTime(body.mu, el, clock.t);
      craft.setPosition(s.r, k);
      arrow.set(s.r, s.v, k, 11);
      if (bodyObj.group.userData.spin) bodyObj.group.userData.spin(dt * (playing ? warp : 0));
    }

    // ----- panels -----
    const bodySel = select({
      label: 'Central body',
      options: BODY_ORDER.map((id) => ({ value: id, label: BODIES[id].name })),
      value: store.get().bodyId,
      onChange: (v) => { store.set({ bodyId: v }); build(); },
    });
    panelA.append(section('Body', bodySel.el));

    const sSpeed = stat({ label: 'Speed', value: 0, unit: 'km/s', digits: 2 });
    const sPeriod = stat({ label: 'Period', value: 0, unit: 'min', digits: 1 });
    const sAlt = stat({ label: 'Altitude', value: 0, unit: 'km', digits: 0 });
    panelB.append(section('Demo orbit', stats(sSpeed.el, sPeriod.el, sAlt.el)));

    function paintStats() {
      const { body, el, r } = parts;
      const d = formatDuration(el.period);
      sSpeed.update({ value: el.vp, digits: 2 });
      sPeriod.update({ value: d.value, unit: d.unit });
      sAlt.update({ value: r - body.radius });
      summaryEl.textContent = `${body.name} · ${fmt(r - body.radius, 0)} km · ${fmt(el.vp, 2)} km/s`;
    }

    const tc = timeControl({
      warps: WARPS,
      value: store.get().time.warp,
      playing: store.get().time.playing,
      onChange: ({ playing, warp }) => { store.set({ time: { playing, warp } }); },
      onReset: () => { clock.reset(0); parts.craft.clearTrail(); update(0); stage.requestRender(); },
    });
    panelC.append(section('Playback', tc.el));

    build();
    cleanup.push(stage.onFrame((dt) => update(dt)));
    cleanup.push(() => {
      if (parts) parts.dispose();
      parts = null;
      stars.dispose();
      rings.dispose();
      stage.scene.remove(world);
    });
  },

  unmount() {
    this._cleanup.splice(0).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  },
};
