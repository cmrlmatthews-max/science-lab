// envelope/mode-water.js  Water mode: how rain moves on and in a wall, and what happens when a detail is wrong.
// Rule-based animation, not a fluid simulation. Rules and dimensions live in water.js; the 3D views live in
// water-build.js (geometry and materials), water-gfx.js (light and materials) and water-fx.js (rain, streams, stains).
// State lives in ctx.store under `water` so it survives a mode switch.

import {
  el, slider, segmented, toggle, stat, stats, banner, legend, section, card, button, select, sourceTag,
} from '../shared/ui.js';
import { MATERIALS } from './materials.js';
import { cloneWall } from './walls.js';
import * as W from './water.js';
import { createInfoCard, infoChip, infoButton } from './info-card.js';
import { infoForMaterial } from './info-data.js';
import { createCallout, createSideMarker, pickCallout, layoutCallouts } from './labels3d.js';
import { createGfx } from './water-gfx.js';
import { createFx } from './water-fx.js';
import { buildForces, buildWalls, buildErrors, buildLayers } from './water-build.js';

const DEFAULTS = {
  view: 'forces', forceId: 'momentum', defenseOn: false, strategyId: 'mass', fault: false,
  errors: [], layer: 'water', layerWall: null, rain: 60, wind: 30, labels: true,
};
const VIEWS = [
  { value: 'forces', label: 'Forces' }, { value: 'walls', label: 'Walls' },
  { value: 'errors', label: 'Errors' }, { value: 'layers', label: 'Layers' },
];
const LAYER_ORDER = ['water', 'air', 'vapor', 'thermal'];

// info card ids for each item in the panels
const FORCE_INFO = { momentum: 'rainscreen', gravity: 'lap_joint', tension: 'drip_edge', capillary: 'capillary_break', pressure: 'air_barrier' };
const STRAT_INFO = { mass: 'brick', barrier: 'eps', drainage: 'wrb_concept', rainscreen: 'rainscreen' };
const ERROR_INFO = { reverse_lap: 'lap_joint', no_end_dam: 'end_dam', no_weeps: 'weep_holes', no_gap: 'drainage_gap', no_head_flashing: 'head_flashing' };
const CONTROL_INFO = { water: 'wrb_concept', air: 'air_barrier', vapor: 'vapor_retarder', thermal: 'continuous_insulation' };
const ERROR_WHY = {
  reverse_lap: 'Water that gets behind the wrap has no way out. The sheathing stays wet and rots.',
  no_end_dam: 'Water that spills off the end of the pan runs into the wall beside the window. It rots the framing at the jamb.',
  no_weeps: 'Water that cannot leave the cavity piles up at the base. The bottom of the wall stays wet.',
  no_gap: 'With no gap, water stays pressed against the wrap by capillary action. The wall cannot drain or dry.',
  no_head_flashing: 'Water running down behind the brick lands on the window head. Without flashing it goes straight into the opening.',
};
const ERROR_LEAK_SPOT = { reverse_lap: [14, 44, 4.1], no_end_dam: [17, 16, 4.1], no_weeps: [51, 4.6, 4.1], no_gap: [50, 40, 4.1], no_head_flashing: [30, 46, 4.4] };

const CSS = `
.water-row { cursor: pointer; align-items: flex-start; }
.water-row .layer-name, .water-row .layer-sub { white-space: normal; overflow: visible; }
.water-row .swatch { margin-top: 2px; }
.water-row .ic-btn { margin-left: auto; align-self: flex-start; margin-top: 1px; }
.water-row:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.water-list { display: flex; flex-direction: column; gap: 8px; }
.water-list .layer-row + .layer-row { margin-top: 0; }
.water-steps { margin: 0; padding: 0; list-style: none; counter-reset: ws; display: flex; flex-direction: column; gap: 9px; }
.water-steps li { counter-increment: ws; display: grid; grid-template-columns: 22px 1fr; gap: 8px; font-size: 13px; line-height: 1.38; align-items: start; }
.water-steps li::before { content: counter(ws); width: 20px; height: 20px; border: 1px solid var(--line-strong); border-radius: 50%; display: grid; place-items: center; font: 500 11px var(--font-mono); background: var(--paper-3); color: var(--ink-2); }
.water-steps li[data-leak="true"] { color: var(--warn); font-weight: 500; }
.water-steps li[data-leak="true"]::before { background: var(--warn-soft); border-color: var(--warn-edge); color: var(--warn); }
.water-err { display: flex; flex-direction: column; gap: 4px; }
.water-err .layer-sub { white-space: normal; padding: 0 2px 0 2px; }
.water-err .water-chips { padding: 0 2px; }
.water-block { display: flex; flex-direction: column; gap: 6px; font-size: 13px; line-height: 1.38; }
.water-block .water-h { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 600; font-size: 13px; }
.water-block .water-h .water-hl { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.water-block b { font-weight: 500; font-size: 11.5px; color: var(--ink-2); margin-right: 6px; }
.water-block .water-why { color: var(--ink); }
.water-block .water-acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 2px; }
.water-block .water-acts .btn { min-height: 34px; padding: 0 12px; font-size: 13px; }
.panel-wrap[data-panel="c"] .panel > .water-dims { flex: 3 1 520px; }
.water-dims .stats { grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)); }
.water-dims .stat-head { flex-wrap: wrap; }
.water-dims .stat-head .ic-btn { margin-left: auto; }
.water-block[data-kind="leak"] { border-color: var(--warn-edge); }
.water-block[data-kind="leak"] .water-h { color: var(--warn); }
.water-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.water-act { display: flex; flex-wrap: wrap; gap: 8px; }
.water-act .btn { flex: 1 1 auto; }
`;

export default {
  id: 'water',
  label: 'Water',
  panelTitles: { a: 'View', b: 'Water path', c: 'Rules' },
  _cleanup: [],
  mount(ctx) {
    const { stage, panelA, panelB, panelC, summaryEl, store } = ctx;
    const T = stage.THREE;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cleanup = this._cleanup;

    // ---------- style ----------
    const styleEl = el('style', { id: 'water-style', text: CSS });
    document.head.appendChild(styleEl);
    cleanup.push(() => styleEl.remove());

    // ---------- state ----------
    const cur = store.get();
    store.set({ water: { ...DEFAULTS, layerWall: cur.wallId || 'W1', ...(cur.water || {}) } });
    const S = () => store.get().water;
    const setS = (patch) => store.set({ water: { ...S(), ...patch } });

    // ---------- 3D ----------
    const gfx = createGfx(stage);
    cleanup.push(() => gfx.dispose());
    const fx = createFx(gfx, stage, { reduce });
    cleanup.push(() => fx.dispose());
    fx.state.rain = S().rain; fx.state.wind = S().wind;
    const stageWrap = ctx.stageEl.parentElement || ctx.stageEl;
    const card_ = createInfoCard(stageWrap);
    cleanup.push(() => card_.dispose());

    let content = new T.Group();
    stage.scene.add(content);
    let callouts = [];
    let baseOffsets = [];
    let markers = [];
    let lastRes = null;
    let narrow = ctx.isNarrow();
    let layerFrame = null;

    function layersFrame() {
      if (layerFrame) return layerFrame;
      let depth = 0; let n = 0;
      ['W1', 'W2', 'W3', 'W4'].forEach((id) => {
        const w = cloneWall(id);
        depth = Math.max(depth, w.layers.reduce((a, l) => a + Math.max(l.thickness || 0.5, 0.5), 0));
        n = Math.max(n, w.layers.length);
      });
      layerFrame = { box: [-10, 0, -7, 52, 48 + 2.8 * (n - 1) + 4, depth + 7], dir: [1.05, 0.55, 0.95], pad: 1.0 };
      return layerFrame;
    }

    function disposeContent() {
      callouts.forEach((c) => c.dispose());
      markers.forEach((m) => m.dispose());
      callouts = []; baseOffsets = []; markers = [];
      content.traverse((o) => { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); });
      stage.scene.remove(content);
      fx.reset();
    }

    function makeLabels(res) {
      const wantAll = !narrow;
      (res.calls || []).forEach((c) => {
        if (!wantAll && !c.n && !c.leak) return;
        const off = c.offset && (c.offset[0] || c.offset[1] || c.offset[2]) ? c.offset : [9, 7, 3];
        const co = createCallout(stage, {
          text: c.text, anchor: new T.Vector3(...c.anchor), offset: new T.Vector3(...off), id: c.id,
          fontPx: narrow ? 11.5 : 12.5,
        });
        if (c.warn || c.leak) co.setDotColor(fx.colors().warn);
        co.userData.err = c.err || null;
        co.setVisible(S().labels);
        callouts.push(co);
        baseOffsets.push(new T.Vector3(...off));
      });
      (res.markers || []).forEach((m) => {
        const mk = createSideMarker(stage, { text: m.text, position: new T.Vector3(...m.pos), tone: m.tone });
        mk.setVisible(S().labels);
        markers.push(mk);
      });
    }

    // keep every callout inside the canvas horizontally (layoutCallouts only moves them vertically)
    function clampX() {
      const dom = stage.renderer && stage.renderer.domElement;
      if (!dom) return;
      const r = dom.getBoundingClientRect();
      if (!r.width) return;
      const cam = stage.camera;
      callouts.forEach((c) => {
        if (!c.object.visible) return;
        const cr = c.clientRect();
        let dx = 0;
        if (cr.left < r.left + 4) dx = r.left + 4 - cr.left;
        else if (cr.right > r.right - 4) dx = r.right - 4 - cr.right;
        if (!dx) return;
        const w = c.labelWorld();
        const pr = w.clone().project(cam);
        pr.x += (dx / r.width) * 2;
        const tgt = pr.unproject(cam);
        c.setOffset(tgt.sub(c.object.position));
      });
      stage.requestRender();
    }

    let layoutRaf = 0;
    function relayout() {
      if (layoutRaf) return;
      layoutRaf = requestAnimationFrame(() => {
        layoutRaf = requestAnimationFrame(() => {
          layoutRaf = 0;
          if (!callouts.length || !S().labels) return;
          callouts.forEach((c, i) => c.setOffset(baseOffsets[i]));
          layoutCallouts(callouts, stage);
          clampX();
        });
      });
    }
    cleanup.push(() => { if (layoutRaf) cancelAnimationFrame(layoutRaf); });

    function build() {
      narrow = ctx.isNarrow();
      disposeContent();
      content = new T.Group();
      stage.scene.add(content);
      const s = S();
      const env = {
        T, gfx, fx, g: content, S: s, narrow, reduce, cloneWall, infoForMaterial,
      };
      let res;
      if (s.view === 'forces') res = buildForces(env);
      else if (s.view === 'walls') res = buildWalls(env);
      else if (s.view === 'errors') res = buildErrors(env);
      else { res = buildLayers(env); res.frame = layersFrame(); }
      lastRes = res;
      const f = res.frame.box;
      gfx.fitLight(new T.Box3(new T.Vector3(f[0], f[1], f[2]), new T.Vector3(f[3], f[4], f[5])), res.light.dir, res.light.floorY);
      gfx.setWet(s.view === 'layers' ? 0 : s.rain / 100);
      fx.setRain(s.rain);
      makeLabels(res);
      stage.requestRender();
      relayout();
    }
    function frameView() {
      if (!lastRes) return;
      const f = lastRes.frame;
      stage.frame(new T.Box3(new T.Vector3(f.box[0], f.box[1], f.box[2]), new T.Vector3(f.box[3], f.box[4], f.box[5])), { dir: f.dir, padding: f.pad });
      relayout();
    }

    // ---------- animation ----------
    const offFrame = stage.onFrame((dt, t) => fx.update(dt, t));
    cleanup.push(offFrame);
    const offTheme = stage.onTheme ? stage.onTheme(() => { fx.recolor(); build(); renderAll(); }) : null;
    if (offTheme) cleanup.push(offTheme);
    if (stage.controls) {
      const onEnd = () => relayout();
      stage.controls.addEventListener('end', onEnd);
      cleanup.push(() => stage.controls.removeEventListener('end', onEnd));
    }
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => relayout());
      ro.observe(ctx.stageEl);
      cleanup.push(() => ro.disconnect());
    }

    // ---------- pointer: hover (mouse) and tap (touch and click) open the info card ----------
    const canvas = stage.renderer ? stage.renderer.domElement : null;
    const ray = new T.Raycaster();
    const ndc = new T.Vector2();
    function partAt(cx, cy) {
      if (!canvas) return null;
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, stage.camera);
      const hits = ray.intersectObjects(content.children, true);
      for (const h of hits) {
        let o = h.object; let vis = true;
        for (let p = h.object; p; p = p.parent) if (p.visible === false) { vis = false; break; }
        if (!vis) continue;
        while (o) { if (o.userData && o.userData.infoId) return o.userData.infoId; o = o.parent; }
      }
      return null;
    }
    function hitAt(cx, cy) {
      const c = S().labels ? pickCallout(stage, cx, cy, callouts) : null;
      if (c && c.userData.infoId) return c.userData.infoId;
      return partAt(cx, cy);
    }
    let hoverId = null;
    function setHover(id) {
      if (id === hoverId) return;
      hoverId = id;
      callouts.forEach((c) => c.setActive(!!id && c.userData.infoId === id));
    }
    let lastPtr = null; let ptrRaf = 0;
    const onMove = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      lastPtr = { x: e.clientX, y: e.clientY };
      if (ptrRaf) return;
      ptrRaf = requestAnimationFrame(() => {
        ptrRaf = 0;
        if (!lastPtr || e.buttons) return;
        const id = hitAt(lastPtr.x, lastPtr.y);
        canvas.style.cursor = id ? 'pointer' : '';
        setHover(id);
        if (id) card_.show(id, { x: lastPtr.x, y: lastPtr.y });
        else card_.hideHover();
      });
    };
    const onLeave = () => { lastPtr = null; setHover(null); card_.hideHover(); };
    if (canvas) {
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerleave', onLeave);
      cleanup.push(() => { canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerleave', onLeave); if (ptrRaf) cancelAnimationFrame(ptrRaf); });
    }
    const offTap = stage.onTap((e) => {
      const id = hitAt(e.clientX, e.clientY);
      if (id) card_.show(id, { pinned: true, x: e.clientX, y: e.clientY });
      else if (card_.isPinned()) card_.hide();
    });
    cleanup.push(offTap);

    // ---------- camera: only when asked ----------
    function zoomTo(errId) {
      const h = lastRes && lastRes.hot && lastRes.hot[errId];
      if (!h) return;
      const c = new T.Vector3(...h.c);
      const d = new T.Vector3(...h.dir).normalize();
      fx.flyTo(c.clone().addScaledVector(d, h.dist), c, 0.7);
      relayout();
    }
    function attention(errId) {
      const l = W.traceErrors([errId]).leaks[0];
      if (!l) return;
      const p = l.patch;
      const z = ERROR_LEAK_SPOT[errId][2];
      fx.pulse(new T.Vector3((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, z + 5), 6);
    }

    // =====================================================================
    // PANEL A
    // =====================================================================
    function selRow({ name, sub, color, selected, onSelect, info }) {
      const row = el('div', {
        class: 'layer-row water-row', role: 'button', tabindex: '0', 'data-clickable': 'true', 'aria-pressed': selected ? 'true' : 'false',
        on: {
          click: () => onSelect(),
          keydown: (e) => { if (e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(); } },
        },
      }, el('span', { class: 'swatch', style: { background: color } }),
      el('div', { class: 'layer-main' }, el('div', { class: 'layer-name', text: name }), sub ? el('div', { class: 'layer-sub', text: sub }) : null),
      info ? infoButton(info, { label: name }) : null);
      row.dataset.selected = selected ? 'true' : 'false';
      return row;
    }
    const setSel = (row, on) => { row.dataset.selected = on ? 'true' : 'false'; row.setAttribute('aria-pressed', on ? 'true' : 'false'); };

    const viewSeg = segmented({ options: VIEWS, value: S().view, onChange: (v) => { setS({ view: v }); card_.hide(); buildControls(); build(); frameView(); renderB(); renderSummary(); } });
    const viewBox = el('div', { class: 'water-view', style: 'display:flex;flex-direction:column;gap:18px' });
    panelA.append(viewSeg.el, viewBox);

    const refs = {};
    function cameraSection() {
      const labelsTg = toggle({ label: 'Labels', value: S().labels, onChange: (v) => { setS({ labels: v }); callouts.forEach((c) => c.setVisible(v)); markers.forEach((m) => m.setVisible(v)); if (v) relayout(); } });
      const reset = button({ label: 'Reset view', kind: 'ghost', onClick: () => frameView() });
      return section('Labels and camera', labelsTg.el, el('div', { class: 'water-act' }, reset));
    }
    function buildControls() {
      viewBox.replaceChildren();
      for (const k of Object.keys(refs)) delete refs[k];
      const s = S();
      const pal = fx.colors();
      if (s.view === 'forces') {
        refs.rows = {};
        const list = el('div', { class: 'water-list' });
        W.FORCES.forEach((f, i) => {
          const row = selRow({
            name: `${i + 1}. ${f.name}`, sub: f.problem, color: pal.water, selected: s.forceId === f.id, info: FORCE_INFO[f.id],
            onSelect: () => {
              if (S().forceId === f.id) return;
              setS({ forceId: f.id });
              W.FORCES.forEach((g) => setSel(refs.rows[g.id], g.id === f.id));
              makeDefToggle();
              build(); renderB(); renderSummary();
            },
          });
          refs.rows[f.id] = row;
          list.appendChild(row);
        });
        refs.defHolder = el('div');
        viewBox.append(section('Five forces', list), section('Defense', refs.defHolder));
        makeDefToggle();
      } else if (s.view === 'walls') {
        refs.rows = {};
        const list = el('div', { class: 'water-list' });
        W.STRATEGIES.forEach((st) => {
          const row = selRow({
            name: st.name, sub: st.examples, color: { mass: '#a65a45', barrier: '#e9e3d4', drainage: '#d8d3c4', rainscreen: '#b5584a' }[st.id], selected: s.strategyId === st.id, info: STRAT_INFO[st.id],
            onSelect: () => {
              if (S().strategyId === st.id) return;
              setS({ strategyId: st.id });
              W.STRATEGIES.forEach((g) => setSel(refs.rows[g.id], g.id === st.id));
              build(); renderB(); renderSummary();
            },
          });
          refs.rows[st.id] = row;
          list.appendChild(row);
        });
        refs.crack = toggle({ label: 'Add a crack in the face', value: s.fault, onChange: (v) => { setS({ fault: v }); build(); renderB(); renderSummary(); } });
        viewBox.append(section('Wall type', list), section('Fault', refs.crack.el));
      } else if (s.view === 'errors') {
        refs.tg = {};
        const wrap = el('div', { class: 'water-list' });
        W.ERRORS.forEach((e) => {
          const t = toggle({
            label: e.name, value: s.errors.includes(e.id),
            onChange: (v) => {
              const set = new Set(S().errors);
              if (v) set.add(e.id); else set.delete(e.id);
              setS({ errors: W.ERRORS.map((x) => x.id).filter((id) => set.has(id)) });
              build(); renderB(); renderSummary();
              if (v) attention(e.id);
            },
          });
          refs.tg[e.id] = t;
          wrap.appendChild(el('div', { class: 'water-err' }, t.el, el('div', { class: 'layer-sub', text: e.what }), el('div', { class: 'water-chips' }, infoChip(ERROR_INFO[e.id]))));
        });
        const clear = button({
          label: 'Clear all', kind: 'ghost',
          onClick: () => { setS({ errors: [] }); Object.values(refs.tg).forEach((t) => t.set(false)); build(); renderB(); renderSummary(); },
        });
        viewBox.append(section('Five errors', wrap), clear);
      } else {
        refs.rows = {};
        const sel = select({
          label: 'Wall', value: s.layerWall,
          options: ['W1', 'W2', 'W3', 'W4'].map((id) => ({ value: id, label: `${id} · ${cloneWall(id).short}` })),
          onChange: (v) => { setS({ layerWall: v }); build(); renderB(); renderSummary(); },
        });
        const list = el('div', { class: 'water-list' });
        const items = [...W.CONTROL_LAYERS.map((c) => ({ id: c.id, name: `${c.name} layer`, sub: c.job, color: c.color, info: CONTROL_INFO[c.id] })),
          { id: 'all', name: 'All four', sub: 'Show every control layer at once.', color: 'linear-gradient(90deg,#0aa6a0,#7a4fd6,#d19a00,#e8590c)', info: 'control_layers' }];
        items.forEach((it) => {
          const row = selRow({
            name: it.name, sub: it.sub, color: it.color, selected: S().layer === it.id, info: it.info,
            onSelect: () => {
              setS({ layer: it.id });
              items.forEach((g) => setSel(refs.rows[g.id], g.id === it.id));
              build(); renderB(); renderSummary();
            },
          });
          refs.rows[it.id] = row;
          list.appendChild(row);
        });
        viewBox.append(section('Wall', sel.el), section('Control layers', list));
      }
      viewBox.appendChild(cameraSection());
    }
    function makeDefToggle() {
      const f = W.FORCES.find((x) => x.id === S().forceId);
      refs.defTg = toggle({ label: `Defense: ${f.defenseName}`, value: S().defenseOn, onChange: (v) => { setS({ defenseOn: v }); build(); renderB(); renderSummary(); } });
      refs.defHolder.replaceChildren(refs.defTg.el, el('p', { class: 'layer-sub', style: 'white-space:normal;margin-top:8px;font-size:13px', text: f.defense }));
    }

    // =====================================================================
    // PANEL B
    // =====================================================================
    function stepsList(steps) {
      return el('ol', { class: 'water-steps' }, steps.map((t) => el('li', { 'data-leak': t.startsWith('Leak:') ? 'true' : 'false', text: t.replace(/^Leak:\s*/, '') })));
    }
    function renderB() {
      const s = S();
      const out = [];
      if (s.view === 'forces') {
        const f = W.FORCES.find((x) => x.id === s.forceId);
        const t = W.traceForce(f.id, s.defenseOn);
        out.push(banner({ kind: t.ok ? 'ok' : 'warn', title: t.ok ? 'The wall stays dry.' : 'Water gets into the wall.', text: `${f.name}${s.defenseOn ? ` with ${f.defenseName.toLowerCase()}` : ' with no defense'}` }));
        out.push(section('Where the water goes', stepsList(t.steps)));
        out.push(card(el('div', { class: 'water-block' },
          el('div', { class: 'water-h' }, el('span', { class: 'water-hl' }, el('span', { text: f.name }), infoButton(FORCE_INFO[f.id], { label: f.name })), sourceTag(f.source)),
          el('div', {}, el('b', { text: 'Problem' }), f.problem),
          el('div', {}, el('b', { text: 'Defense' }), f.defense))));
      } else if (s.view === 'walls') {
        const st = W.STRATEGIES.find((x) => x.id === s.strategyId);
        const t = W.traceStrategy(st.id, s.fault);
        out.push(banner({ kind: t.ok ? 'ok' : 'warn', title: t.ok ? 'The wall stays dry.' : 'Water gets into the wall.', text: `${st.name}${s.fault ? ' with a crack in the face' : ''}` }));
        out.push(section('Where the water goes', stepsList(t.steps)));
        out.push(card(el('div', { class: 'water-block' },
          el('div', { class: 'water-h' }, el('span', { class: 'water-hl' }, el('span', { text: st.name }), infoButton(STRAT_INFO[st.id], { label: st.name })), sourceTag(st.source)),
          el('div', {}, el('b', { text: 'Examples' }), st.examples),
          el('div', {}, el('b', { text: 'How it works' }), st.how),
          el('div', {}, el('b', { text: 'Weakness' }), st.weakness))));
      } else if (s.view === 'errors') {
        const t = W.traceErrors(s.errors);
        out.push(banner({
          kind: t.ok ? 'ok' : 'warn', title: t.ok ? 'The wall stays dry.' : 'Water gets into the wall.',
          text: t.ok ? 'Every detail is right. Turn on an error to see what changes.' : `${t.leaks.length} ${t.leaks.length === 1 ? 'leak' : 'leaks'} found.`,
        }));
        out.push(section('Where the water goes', stepsList(t.steps)));
        s.errors.forEach((id) => {
          const e = W.ERRORS.find((x) => x.id === id);
          const zoom = button({ label: 'Zoom to it', kind: 'ghost', onClick: () => zoomTo(id) });
          const reset = button({ label: 'Reset view', kind: 'ghost', onClick: () => frameView() });
          out.push(card(el('div', { class: 'water-block', 'data-kind': 'leak' },
            el('div', { class: 'water-h' }, el('span', { class: 'water-hl' }, el('span', { text: e.name }), infoButton(ERROR_INFO[id], { label: e.name })), sourceTag(e.source)),
            el('div', {}, el('b', { text: 'What' }), e.what),
            el('div', {}, el('b', { text: 'Result' }), e.result),
            el('div', { class: 'water-why' }, el('b', { text: 'Why it matters' }), ERROR_WHY[id]),
            el('div', {}, el('b', { text: 'Fix' }), e.fix),
            el('div', { class: 'water-acts' }, zoom, reset))));
        });
      } else {
        const wall = cloneWall(s.layerWall);
        const roles = W.layerRoles(wall, MATERIALS);
        out.push(banner({ kind: 'info', title: `Wall ${wall.id}`, text: `${wall.name}. Pick a control layer to see which layer does the job.` }));
        const shown = s.layer === 'all' ? W.CONTROL_LAYERS : W.CONTROL_LAYERS.filter((c) => c.id === s.layer);
        shown.forEach((c) => {
          const mine = roles.filter((r) => r.roles.includes(c.id));
          const chips = mine.map((r) => { const e = infoForMaterial(r.materialId); return infoChip(e ? e.id : r.materialId, MATERIALS[r.materialId].name); });
          out.push(card(el('div', { class: 'water-block' },
            el('div', { class: 'water-h' }, el('span', { class: 'water-hl' }, el('span', { class: 'swatch', style: { background: c.color } }), el('span', { text: `${c.name} layer` }), infoButton(CONTROL_INFO[c.id], { label: `${c.name} layer` })), sourceTag(c.source)),
            el('div', {}, el('b', { text: 'Job' }), c.job),
            el('div', {}, el('b', { text: 'Rule' }), c.rule),
            el('div', {}, el('b', { text: 'In this wall' }), mine.length ? el('span', { class: 'water-chips', style: { display: 'inline-flex', verticalAlign: 'middle' } }, chips) : 'Not drawn in this preset. Add one in Assembly mode.'))));
        });
        const clad = roles.filter((r) => r.cladding).map((r) => MATERIALS[r.materialId].name);
        out.push(el('p', { class: 'layer-sub', style: 'white-space:normal', text: `Cladding is the weather surface${clad.length ? `: ${clad.join(', ')}` : ''}.` }));
      }
      panelB.replaceChildren(...out);
    }

    // =====================================================================
    // PANEL C
    // =====================================================================
    const rainS = slider({ label: 'Rain', min: 0, max: 100, step: 5, value: S().rain, unit: '%', onInput: (v) => { setS({ rain: v }); fx.setRain(v); gfx.setWet(S().view === 'layers' ? 0 : v / 100); } });
    const windS = slider({ label: 'Wind', min: 0, max: 100, step: 5, value: S().wind, unit: '%', onInput: (v) => { setS({ wind: v }); fx.setWind(v); if (reduce && lastRes && lastRes.rainBox) build(); } });
    const D = W.DIMENSIONS;
    const tile = (p, id) => { const s = stat(p); s.el.querySelector('.stat-head').appendChild(infoButton(id, { label: p.label })); return s.el; };
    const pal0 = fx.colors();
    panelC.append(
      section('Rain and wind', rainS.el, windS.el),
      (() => {
        const sec = section('BCI dimensions', stats(
          tile({ label: 'Weep holes', value: `${D.weepSpacingBrick}`, unit: 'in o.c.', source: 'BCI 7.22', hint: `Brick. Concrete masonry is ${D.weepSpacingCmu} in.` }, 'weep_holes'),
          tile({ label: 'Head flashing', value: `${D.headFlashingTurnUp}`, unit: 'in turn-up', source: 'BCI 7.22' }, 'head_flashing'),
          tile({ label: 'Flashing drip', value: '3/4', unit: 'in, 45°', source: 'BCI 7.22', hint: 'Past the wall face' }, 'drip_edge'),
          tile({ label: 'Air space', value: `${D.minAirSpace}`, unit: 'in min', source: 'BCI 7.44', hint: 'With insulation in the cavity' }, 'drainage_gap'),
        ));
        sec.classList.add('water-dims');
        return sec;
      })(),
      section('Path colors', legend([
        { color: pal0.water, label: 'Shed or drain' },
        { color: pal0.absorb, label: 'Absorb' },
        { color: pal0.dry, label: 'Dry (vapor)' },
        { color: '#16273b', label: 'Leak: wet stain' },
      ])),
    );

    // ---------- summary ----------
    function renderSummary() {
      const s = S();
      let txt = '';
      if (s.view === 'forces') {
        const f = W.FORCES.find((x) => x.id === s.forceId);
        txt = `${f.name} · ${s.defenseOn ? f.defenseName.toLowerCase() : 'no defense'} · ${s.defenseOn ? 'dry' : 'leak'}`;
      } else if (s.view === 'walls') {
        const st = W.STRATEGIES.find((x) => x.id === s.strategyId);
        const t = W.traceStrategy(st.id, s.fault);
        txt = `${st.name}${s.fault ? ' + crack' : ''} · ${t.ok ? 'dry' : 'leak'}`;
      } else if (s.view === 'errors') {
        const t = W.traceErrors(s.errors);
        txt = t.ok ? 'Errors: none · dry' : `Errors: ${t.leaks.length} ${t.leaks.length === 1 ? 'leak' : 'leaks'} · ${s.errors.map((id) => W.ERRORS.find((e) => e.id === id).name.toLowerCase()).join(', ')}`;
      } else {
        txt = `Layers · ${s.layerWall} · ${s.layer === 'all' ? 'all four' : `${s.layer} layer`}`;
      }
      summaryEl.textContent = txt;
    }
    function renderAll() { renderB(); renderSummary(); }

    // ---------- go ----------
    buildControls();
    build();
    frameView();
    renderAll();
    void LAYER_ORDER;
  },
  unmount() {
    this._cleanup.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    this._cleanup = [];
  },
};
