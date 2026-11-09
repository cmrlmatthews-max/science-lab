// envelope/mode-bridge.js  Thermal Bridge mode (Part E).
// A 2D heat-flow solution of a detail, shown as a 3D cut model with a temperature map.
// 3D lives in envelope/bridge-scene.js. The solver is envelope/bridge.js.

import { el, slider, segmented, toggle, stat, stats, banner, legend, section, thermalBar, button, fmt } from '../shared/ui.js';
import { solveBridge, describeResult, DETAILS } from './bridge.js';
import { createBridgeScene } from './bridge-scene.js';

const SHORT = {
  'stud:wood': 'Wood', 'stud:steel': 'Steel', 'stud:steel_ci': 'Steel + CI',
  'slab:through': 'Through', 'slab:break': 'Thermal break',
  'shelf:continuous': 'Continuous', 'shelf:standoff': 'Standoff',
};
const FULL = {
  'stud:wood': 'Wood stud', 'stud:steel': 'Steel stud', 'stud:steel_ci': 'Steel stud + 2" continuous insulation',
  'slab:through': 'Slab through the insulation', 'slab:break': 'Slab with a thermal break',
  'shelf:continuous': 'Continuous steel angle', 'shelf:standoff': 'Angle on standoff brackets',
};
const SUMMARY_NAME = {
  'stud:wood': 'Wood stud', 'stud:steel': 'Steel stud', 'stud:steel_ci': 'Steel stud + CI',
  'slab:through': 'Slab through', 'slab:break': 'Slab with break',
  'shelf:continuous': 'Continuous angle', 'shelf:standoff': 'Standoff angle',
};
const DETAIL_SHORT = { stud: 'Stud', slab: 'Slab edge', shelf: 'Shelf angle' };
const LESSON = {
  stud: 'Continuous insulation outside the studs covers the bridge.',
  slab: 'A thermal break keeps the slab edge out of the cold.',
  shelf: 'Standoff brackets let the insulation run past the angle.',
};
const SRC_SOLVER = '2D steady-state heat flow, finite-volume grid. Material values: BCI 7.40.';
const SRC_DEW = 'Magnus formula. BCI 7.45';

const CSS = `
.bt-wrap{display:flex;flex-direction:column;gap:6px}
.bt-head,.bt-row{display:grid;grid-template-columns:minmax(0,1fr) 52px 58px 52px;column-gap:6px;align-items:center}
.bt-head{padding:0 10px;font:500 11px var(--font-body);color:var(--ink-2)}
.bt-head span:not(:first-child),.bt-row span:not(:first-child){text-align:right}
.bt-row{width:100%;min-height:calc(var(--ctl) + 4px);padding:4px 10px;text-align:left;background:var(--paper-3);color:var(--ink);border:1px solid var(--line);border-radius:var(--radius);font:500 12.5px var(--font-body)}
.bt-row .m{font-family:var(--font-mono);font-variant-numeric:tabular-nums;font-size:12.5px}
.bt-row[aria-pressed="true"]{border-color:var(--accent-edge);background:var(--accent-soft);color:var(--ink);box-shadow:inset 2px 0 0 var(--accent)}
.bt-row[data-warn="true"] .m.low{color:var(--warn);font-weight:600}
.bt-note{margin:0;font-size:12px;line-height:1.4;color:var(--ink-2)}
.bt-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.bt-list li{font-size:13px;line-height:1.45;padding-left:10px;border-left:1px solid var(--line-strong)}
.bt-graph{display:block;width:100%;max-width:560px;height:auto;max-height:230px;color:var(--ink)}
.bt-graph text{font-family:var(--font-mono);font-size:10px;fill:var(--ink-2)}
.bt-graph .cap{font-family:var(--font-body);font-weight:500;font-size:11px}
.bt-reset{position:absolute;top:10px;right:10px;z-index:3;min-height:var(--ctl);padding:0 12px;font-size:13px}
.bt-sub{margin:0;font-size:12px;color:var(--ink-2)}
`;

function clampv(v, a, b) { return Math.min(b, Math.max(a, v)); }

// ----------------------------------------------------------------- graph
function graphSvg(r, climate) {
  const W = 360, H = 190, ml = 36, mr = 12, mt = 12, mb = 38;
  const pw = W - ml - mr, ph = H - mt - mb;
  const surf = r.interiorSurface;
  const clearT = climate.tIn - 0.68 * r.qClear;
  const dew = r.dewPointF;
  let lo = Math.min(r.minInteriorT, dew, clearT);
  let hi = Math.max(clearT, r.minInteriorT, r.avgInteriorT, dew);
  let sMax = -Infinity;
  for (let i = 0; i < surf.length; i++) if (surf[i] > sMax) sMax = surf[i];
  hi = Math.max(hi, sMax);
  const pad = Math.max(2, (hi - lo) * 0.12);
  lo = Math.floor(lo - pad); hi = Math.ceil(hi + pad);
  if (hi - lo < 10) { const m = (hi + lo) / 2; lo = Math.floor(m - 5); hi = Math.ceil(m + 5); }
  const xs = (inch) => ml + (inch / r.widthIn) * pw;
  const ys = (t) => mt + (1 - (t - lo) / (hi - lo)) * ph;
  // ticks
  const step = (hi - lo) <= 14 ? 2 : (hi - lo) <= 30 ? 5 : 10;
  let g = '';
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) {
    g += `<line x1="${ml}" x2="${W - mr}" y1="${ys(t).toFixed(1)}" y2="${ys(t).toFixed(1)}" style="stroke:var(--line)" stroke-width="1"/>`;
    g += `<text x="${ml - 4}" y="${(ys(t) + 3.2).toFixed(1)}" text-anchor="end">${t}</text>`;
  }
  const xt = r.widthIn <= 20 ? 4 : r.widthIn <= 34 ? 8 : 10;
  for (let x = 0; x <= r.widthIn + 0.01; x += xt) {
    g += `<line x1="${xs(x).toFixed(1)}" x2="${xs(x).toFixed(1)}" y1="${mt + ph}" y2="${mt + ph + 4}" style="stroke:var(--line-strong)" stroke-width="1"/>`;
    g += `<text x="${xs(x).toFixed(1)}" y="${mt + ph + 14}" text-anchor="middle">${x}</text>`;
  }
  // axes
  g += `<path d="M${ml} ${mt}V${mt + ph}H${W - mr}" fill="none" style="stroke:var(--line-strong)" stroke-width="1"/>`;
  const axisLabel = r.orientation === 'section' ? 'Height (in)' : 'Along wall (in)';
  g += `<text class="cap" x="${ml + pw / 2}" y="${H - 6}" text-anchor="middle">${axisLabel}</text>`;
  g += `<text class="cap" x="10" y="${mt + ph / 2}" text-anchor="middle" transform="rotate(-90 10 ${mt + ph / 2})">Surface °F</text>`;
  // dew point (dashed)
  const yd = ys(dew);
  g += `<line x1="${ml}" x2="${W - mr}" y1="${yd.toFixed(1)}" y2="${yd.toFixed(1)}" style="stroke:var(--cold)" stroke-width="1.25" stroke-dasharray="5 4"/>`;
  const dewAbove = yd > mt + ph * 0.5;   // put the label on the roomier side
  g += `<text class="cap" x="${W - mr - 3}" y="${(dewAbove ? yd - 4 : yd + 11).toFixed(1)}" text-anchor="end" style="fill:var(--cold)">Dew point ${fmt(dew, 1)}</text>`;
  // clear wall reference
  const yc = ys(clearT);
  g += `<line x1="${ml}" x2="${W - mr}" y1="${yc.toFixed(1)}" y2="${yc.toFixed(1)}" style="stroke:var(--ink-2)" stroke-width="1" stroke-dasharray="1 3"/>`;
  g += `<text class="cap" x="${ml + 4}" y="${(yc - 4).toFixed(1)}" style="fill:var(--ink-2)">Clear wall</text>`;
  // surface line
  let d = '';
  for (let i = 0; i < surf.length; i++) {
    const x = xs((i + 0.5) * r.cell);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${ys(surf[i]).toFixed(1)}`;
  }
  g += `<path d="${d}" fill="none" style="stroke:var(--ink)" stroke-width="1.5" stroke-linejoin="round"/>`;
  // minimum
  const mx = xs((r.minInteriorAt + 0.5) * r.cell), my = ys(r.minInteriorT);
  const col = r.condensationRisk ? 'var(--warn)' : 'var(--ink)';
  g += `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="4" style="fill:${col};stroke:var(--paper-2)" stroke-width="1.5"/>`;
  const right = mx > ml + pw * 0.62;
  const tx = right ? mx - 8 : mx + 8;
  const below = my < mt + ph * 0.8;
  g += `<text class="cap" x="${tx.toFixed(1)}" y="${(below ? my + 13 : my - 8).toFixed(1)}" text-anchor="${right ? 'end' : 'start'}" style="fill:${col}">Min ${fmt(r.minInteriorT, 1)}</text>`;
  return `<svg class="bt-graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="Interior surface temperature along the detail. Lowest ${fmt(r.minInteriorT, 1)} degrees F, dew point ${fmt(dew, 1)} degrees F.">${g}</svg>`;
}

// ----------------------------------------------------------------- mode
export default {
  id: 'bridge',
  label: 'Thermal Bridge',
  panelTitles: { a: 'Detail', b: 'Results', c: 'Climate' },
  _cleanup: [],

  mount(ctx) {
    const { stage, stageEl, panelA, panelB, panelC, summaryEl, store } = ctx;
    const cleanup = this._cleanup = [];

    // ---------- state
    const defaults = { detailId: 'stud', variantId: 'wood', show: 'temp', arrows: false };
    const saved = store.get().bridge || {};
    const b = { ...defaults, ...saved };
    if (!DETAILS[b.detailId]) b.detailId = defaults.detailId;
    if (!DETAILS[b.detailId].variants.some((v) => v.id === b.variantId)) b.variantId = DETAILS[b.detailId].variants[0].id;
    const saveBridge = () => store.set({ bridge: { ...b } });
    saveBridge();

    const climate = (() => {
      const c = store.get().climate || {};
      return {
        tIn: clampv(Number.isFinite(c.tIn) ? c.tIn : 70, 60, 80),
        rhIn: clampv(Number.isFinite(c.rhIn) ? c.rhIn : 35, 20, 70),
        tOut: clampv(Number.isFinite(c.tOut) ? c.tOut : 20, -20, 110),
        rhOut: Number.isFinite(c.rhOut) ? c.rhOut : 70,
      };
    })();
    const writeClimate = () => store.set({ climate: { ...store.get().climate, tIn: climate.tIn, rhIn: climate.rhIn, tOut: climate.tOut }, climatePreset: null });
    const solve = (detailId, variantId) => solveBridge(detailId, variantId, { tIn: climate.tIn, tOut: climate.tOut, rhIn: climate.rhIn });

    // style
    const styleEl = el('style', { id: 'bridge-style' });
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
    cleanup.push(() => styleEl.remove());

    // 3D
    const scene3d = createBridgeScene(stage);
    cleanup.push(() => scene3d.dispose());
    const offTheme = stage.onTheme ? stage.onTheme(() => scene3d.onTheme()) : null;
    if (offTheme) cleanup.push(offTheme);

    const resetBtn = button({ label: 'Reset view', kind: 'ghost', onClick: () => scene3d.frame() });
    resetBtn.classList.add('bt-reset');
    resetBtn.style.background = 'var(--paper-3)';
    stageEl.appendChild(resetBtn);
    cleanup.push(() => resetBtn.remove());

    let result = null;
    let rows = {};          // variantId -> result for the compare table

    // ---------- Panel A
    const detailSeg = segmented({
      options: Object.values(DETAILS).map((d) => ({ value: d.id, label: DETAIL_SHORT[d.id] || d.name })),
      value: b.detailId,
      onChange: (v) => { b.detailId = v; b.variantId = DETAILS[v].variants[0].id; saveBridge(); refreshAll({ rebuild: true, frame: true }); },
    });
    const blurb = el('p', { class: 'bt-note' });
    const variantHolder = el('div');
    const variantFull = el('p', { class: 'bt-sub' });
    function buildVariantSeg() {
      const d = DETAILS[b.detailId];
      const seg = segmented({
        options: d.variants.map((v) => ({ value: v.id, label: SHORT[`${d.id}:${v.id}`] || v.name })),
        value: b.variantId,
        onChange: (v) => { b.variantId = v; saveBridge(); refreshAll({ rebuild: true }); },
      });
      variantHolder.replaceChildren(seg.el);
      return seg;
    }
    let vSeg = buildVariantSeg();

    const showSeg = segmented({
      options: [{ value: 'temp', label: 'Temperature' }, { value: 'mats', label: 'Materials' }],
      value: b.show,
      onChange: (v) => { b.show = v; saveBridge(); scene3d.setView(v); },
    });
    const arrowTg = toggle({ label: 'Heat flow arrows', value: b.arrows, onChange: (v) => { b.arrows = v; saveBridge(); scene3d.setArrows(v); } });

    const tableHolder = el('div', { class: 'bt-wrap' });
    const legendHolder = el('div');
    panelA.append(
      section('Detail', detailSeg.el, blurb),
      section('Variant', variantHolder, variantFull),
      section('View', showSeg.el, arrowTg.el),
      section('Compare', tableHolder, el('p', { class: 'bt-note', text: 'R eff is whole-wall R. +Loss is extra heat loss against a wall with no bridge. Min is the coldest inside surface in °F. Tap a row to pick it.' })),
      section('Materials', legendHolder),
    );

    // ---------- Panel B
    const sLoss = stat({ label: 'Heat loss increase', value: '—', unit: '%', source: SRC_SOLVER });
    sLoss.el.style.gridColumn = '1 / -1';
    sLoss.el.dataset.key = 'loss';
    const sRb = stat({ label: 'R with bridge', value: 0, digits: 2, source: SRC_SOLVER });
    sRb.el.dataset.key = 'reff';
    const sRc = stat({ label: 'R with no bridge', value: 0, digits: 2, source: SRC_SOLVER });
    sRc.el.dataset.key = 'rclear';
    const sMin = stat({ label: 'Lowest surface', value: 0, unit: '°F', source: SRC_SOLVER, hint: 'Coldest spot inside' });
    sMin.el.dataset.key = 'min';
    const sDew = stat({ label: 'Inside dew point', value: 0, unit: '°F', source: SRC_DEW });
    sDew.el.dataset.key = 'dew';
    const sQ = stat({ label: 'Heat flow', value: 0, unit: 'Btu/h·ft²', digits: 2, source: SRC_SOLVER });
    sQ.el.dataset.key = 'q';
    const condHolder = el('div', { dataset: { key: 'cond' } });
    const meaning = el('ul', { class: 'bt-list' });
    const lessonHolder = el('div');
    panelB.append(
      section('Numbers', stats(sLoss.el, sRb.el, sRc.el, sMin.el, sDew.el, sQ.el)),
      section('Condensation', condHolder),
      section('What it means', meaning),
      section('Design lesson', lessonHolder),
    );

    // ---------- Panel C
    const graphHolder = el('div');
    const barHolder = el('div');
    const sIn = slider({ label: 'Inside temperature', min: 60, max: 80, step: 1, value: climate.tIn, unit: '°F', onInput: (v) => onClimate('tIn', v) });
    const sRh = slider({ label: 'Inside humidity', min: 20, max: 70, step: 1, value: climate.rhIn, unit: '%', onInput: (v) => onClimate('rhIn', v) });
    const sOut = slider({ label: 'Outside temperature', min: -20, max: 110, step: 1, value: climate.tOut, unit: '°F', onInput: (v) => onClimate('tOut', v) });
    [sIn, sRh, sOut].forEach((s) => {
      const inp = s.el.querySelector('input');
      inp.addEventListener('change', () => { clearTimeout(debounce); refreshTable(); });
    });
    panelC.append(
      section('Inside surface temperature', graphHolder),
      section('Climate', sIn.el, sRh.el, sOut.el, el('p', { class: 'bt-note', text: 'Humidity only moves the dew point.' })),
      section('Temperature scale', barHolder),
    );

    // ---------- updates
    function paintLegend() {
      legendHolder.replaceChildren(legend(result.palette.map((p) => ({ color: p.color, label: p.name }))));
    }
    function paintTable() {
      const d = DETAILS[b.detailId];
      const head = el('div', { class: 'bt-head', 'aria-hidden': 'true' }, el('span', { text: 'Variant' }), el('span', { text: 'R eff' }), el('span', { text: '+Loss' }), el('span', { text: 'Min °F' }));
      const btns = d.variants.map((v) => {
        const r = rows[v.id];
        const key = `${d.id}:${v.id}`;
        const lossTxt = r ? `${r.increasePct >= 0 ? '+' : ''}${fmt(r.increasePct, 1)}%` : '—';
        const bt = el('button', {
          type: 'button', class: 'bt-row', dataset: { variant: v.id, warn: r && r.condensationRisk ? 'true' : 'false' },
          'aria-pressed': v.id === b.variantId ? 'true' : 'false',
          on: { click: () => { if (b.variantId !== v.id) { b.variantId = v.id; saveBridge(); vSeg.set(v.id); refreshAll({ rebuild: true }); } } },
        },
        el('span', { text: SHORT[key] || v.name }),
        el('span', { class: 'm', text: r ? fmt(r.rEffective, 2) : '—' }),
        el('span', { class: 'm', text: lossTxt }),
        el('span', { class: `m${r && r.condensationRisk ? ' low' : ''}`, text: r ? fmt(r.minInteriorT, 1) : '—' }));
        return bt;
      });
      tableHolder.replaceChildren(head, ...btns);
    }
    function refreshTable() {
      const d = DETAILS[b.detailId];
      d.variants.forEach((v) => { rows[v.id] = v.id === b.variantId && result ? result : solve(d.id, v.id); });
      paintTable();
    }

    function paintResults() {
      const r = result;
      const dT = Math.abs(climate.tIn - climate.tOut);
      const hasFlow = dT >= 1 && Number.isFinite(r.rEffective);
      sLoss.update({ value: hasFlow ? `${r.increasePct >= 0 ? '+' : ''}${fmt(r.increasePct, 1)}` : '—', warn: hasFlow && r.increasePct > 25 });
      sRb.update({ value: hasFlow ? r.rEffective : '—' });
      sRc.update({ value: hasFlow ? r.rClear : '—' });
      sMin.update({ value: r.minInteriorT });
      sDew.update({ value: r.dewPointF });
      sQ.update({ value: Math.abs(r.q) });
      const unit = `${fmt(r.minInteriorT, 1)} °F`;
      condHolder.replaceChildren(r.condensationRisk
        ? banner({ kind: 'warn', title: 'Condensation risk', text: `The interior surface is ${unit} at the bridge. Dew point is ${fmt(r.dewPointF, 1)} °F. Water can form on the room side.` })
        : banner({ kind: 'ok', title: 'No condensation', text: `The interior surface is ${unit} at its coldest. Dew point is ${fmt(r.dewPointF, 1)} °F. The room side stays dry.` }));
      meaning.replaceChildren(...(hasFlow
        ? describeResult(r).map((t) => el('li', { text: t.replace(/ F([ ,.])/g, ' °F$1') }))
        : [el('li', { text: 'There is no temperature difference, so no heat flows. Move the outside temperature away from the inside temperature.' })]));
      const key = `${r.detailId}:${r.variantId}`;
      summaryEl.textContent = `${SUMMARY_NAME[key] || key} · ${hasFlow ? `${r.increasePct >= 0 ? '+' : ''}${Math.round(r.increasePct)}% loss` : 'no flow'} · min ${fmt(r.minInteriorT, 1)} °F`;
    }
    function paintClimateViews() {
      graphHolder.innerHTML = graphSvg(result, climate);
      const lo = Math.min(climate.tIn, climate.tOut), hi = Math.max(climate.tIn, climate.tOut);
      barHolder.replaceChildren(thermalBar({ min: `${fmt(lo, 0)} °F`, max: `${fmt(hi, 0)} °F`, mid: `${fmt((lo + hi) / 2, 0)} °F` }));
    }
    function paintStatic() {
      const d = DETAILS[b.detailId];
      blurb.textContent = d.blurb;
      variantFull.textContent = FULL[`${d.id}:${b.variantId}`] || '';
      lessonHolder.replaceChildren(banner({ kind: 'info', title: 'Design lesson', text: LESSON[d.id] }));
      paintLegend();
    }

    // Everything after a detail or variant change.
    function refreshAll({ rebuild = false, frame = false } = {}) {
      if (frame || rebuild) {
        if (frame) { vSeg = buildVariantSeg(); }
        else vSeg.set(b.variantId);
        detailSeg.set(b.detailId);
      }
      result = solve(b.detailId, b.variantId);
      paintStatic();
      paintResults();
      paintClimateViews();
      scene3d.build(result, climate);
      if (frame) scene3d.frame();
      refreshTable();
    }

    // climate sliders: re-solve the current variant in rAF, table on release or after 150 ms
    let raf = 0;
    let debounce = 0;
    function onClimate(key, v) {
      climate[key] = v;
      writeClimate();
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          result = solve(b.detailId, b.variantId);
          paintResults();
          paintClimateViews();
          scene3d.update(result, climate);
        });
      }
      clearTimeout(debounce);
      debounce = setTimeout(refreshTable, 150);
    }
    cleanup.push(() => { if (raf) cancelAnimationFrame(raf); clearTimeout(debounce); });

    refreshAll({ rebuild: true, frame: true });
  },

  unmount() {
    const fns = this._cleanup || [];
    this._cleanup = [];
    fns.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  },
};
