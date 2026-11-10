// envelope/mode-assembly.js  Assembly mode: layer editor, results, climate, 3D stepped cutaway.
import {
  el, slider, select, segmented, toggle, stat, stats, banner, legend, section, layerRow, thermalBar, button, fmt, sourceTag,
} from '../shared/ui.js';
import { MATERIALS } from './materials.js';
import { WALLS, cloneWall } from './walls.js';
import { analyzeWall, CLIMATE_PRESETS, conductionLoss, infiltrationLoss } from './physics.js';
import { checkVaporRetarder, CLIMATE_ZONES } from './vapor.js';
import { createWall3D, CONTROL_LEGEND, CONTROL_COLORS } from './assembly-3d.js';
import { createGraph } from './assembly-graph.js';
import { createInfoCard, infoChip, infoButton } from './info-card.js';
import { infoForMaterial } from './info-data.js';

const CSS = `
.asm-editor{display:flex;flex-direction:column;gap:12px;padding:12px;margin:-6px 0 6px 10px;background:var(--paper-2);border:1px solid var(--line);border-top:0;border-radius:0 0 var(--radius) var(--radius)}
.asm-end{font:500 11.5px var(--font-body);color:var(--ink-2);padding:2px 2px}
.asm-list{display:flex;flex-direction:column;gap:6px}
.asm-bar-row{display:flex;flex-direction:column;gap:3px}
.asm-bar-head{display:flex;justify-content:space-between;font:500 12px var(--font-body);color:var(--ink-2)}
.asm-bar-head .num{font-size:13px;color:var(--ink)}
.asm-track{height:8px;background:var(--track);border-radius:2px;overflow:hidden}
.asm-fill{height:100%;background:var(--ink-2);width:0}
.asm-fill.alt{background:var(--accent)}
.asm-note{font-size:12px;color:var(--ink-2);line-height:1.35}
.asm-graph{width:100%;min-width:0}
.asm-show .seg-btn{font-size:12px;padding:0 2px}
.asm-btns{display:flex;gap:8px;flex-wrap:wrap}
.asm-btns .btn{flex:1 1 auto;padding:0 10px}
.asm-stats{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.asm-sowhat{font-size:12px;line-height:1.35;color:var(--ink-2);margin-top:3px}
.asm-fieldtag{display:inline-flex;align-items:center;gap:6px}
.asm-togrow{display:flex;align-items:center;gap:8px}
.asm-togrow .toggle{flex:1 1 auto;min-width:0}
.asm-chips{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center}
.asm-fix{font-size:12.5px;line-height:1.4;color:var(--ink-2)}
.asm-ctl{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.asm-ctl-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;line-height:1.3}
.asm-ctl-row .swatch{flex:none}
.asm-ctl-row .asm-ctl-t{color:var(--ink-2);flex:1 1 120px;min-width:0}
.asm-hint{position:absolute;z-index:5;bottom:8px;left:8px;right:8px;margin:0 auto;width:max-content;max-width:min(560px,calc(100% - 16px));display:flex;align-items:center;gap:8px;padding:5px 6px 5px 11px;background:var(--paper-2);border:1px solid var(--line-strong);border-radius:var(--radius);box-shadow:0 2px 8px rgba(0,0,0,.14);font:400 12.5px/1.35 var(--font-body);color:var(--ink-2)}
.asm-hint button{flex:none;position:relative;width:24px;height:24px;border:1px solid var(--line-strong);border-radius:50%;background:var(--paper-3);color:var(--ink-2);padding:0;font-size:14px;line-height:1}
.asm-hint button::after{content:"";position:absolute;inset:-10px}
`;

// Module-level view state so it survives a mode switch.
const keep = { sel: null, show: 'materials', explode: 0, section: false };

const ROLE = {
  water: 'Water control', air: 'Air control', vapor: 'Vapor control', thermal: 'Thermal control',
  structure: 'Structure', finish: 'Finish', cladding: 'Cladding', airspace: 'Air space',
};
const SHORT = (n) => n.split(',')[0];
const HINT_KEY = 'envelopeLab.infoHintDismissed';
const GLASS_R = 0.88; // single clear glass pane, BCI 7.40
const BTU_PER_BULB = 341.2; // one 100 W bulb, Btu/h
const inch = (v) => `${String(Math.round(v * 1000) / 1000)}"`;
const infoIdFor = (materialId) => {
  const m = infoForMaterial(materialId);
  return m && typeof m === 'object' ? m.id : m;
};
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
// Put an info control right after a field label (sliders, selects).
function tagLabel(fieldEl, node) {
  const lab = fieldEl.querySelector('.field-label');
  if (!lab) return;
  const wrap = el('span', { class: 'asm-fieldtag' });
  lab.replaceWith(wrap);
  wrap.append(lab, node);
}
// Put an info control and a one-line "so what" under a stat tile.
function decorateStat(st, infoId, extra) {
  const head = st.el.querySelector('.stat-head');
  const lab = head.querySelector('.stat-label');
  const wrap = el('span', { class: 'asm-fieldtag' });
  lab.replaceWith(wrap);
  wrap.append(lab, infoButton(infoId, { extra }));
  const so = el('div', { class: 'asm-sowhat' });
  st.el.appendChild(so);
  return so;
}
const FRAME_DEPTH = { wood: { batt_r13: 3.5, batt_r19: 6, batt_r21: 5.5 }, steel: { batt_r13: 3.5, batt_r19: 6, batt_r21: 6 } };
const BATT_R = { batt_r13: 13, batt_r19: 19, batt_r21: 21 };
const EDIT_OPTIONS = Object.values(MATERIALS).filter((m) => m.category !== 'framing').map((m) => ({ value: m.id, label: m.name }));
const BATT_OPTIONS = Object.values(MATERIALS).filter((m) => m.category === 'batt').map((m) => ({ value: m.id, label: m.name }));

function dT(c) { return Math.abs(c.tIn - c.tOut); }

export default {
  id: 'assembly',
  label: 'Assembly',
  panelTitles: { a: 'Layers', b: 'Results', c: 'Climate' },
  _cleanup: [],
  mount(ctx) {
    const { stage, stageEl, panelA, panelB, panelC, summaryEl, store } = ctx;
    const cleanup = [];
    this._cleanup = cleanup;

    const styleEl = el('style', { id: 'assembly-style', text: CSS });
    document.head.appendChild(styleEl);
    cleanup.push(() => styleEl.remove());

    const wall3d = createWall3D(stage);
    cleanup.push(() => wall3d.dispose());
    let an = analyzeWall(store.get().wall, store.get().climate);
    const stageWrap = stageEl.parentElement || stageEl;
    const card = createInfoCard(stageWrap);
    cleanup.push(() => card.dispose());

    // live values shown at the top of a card
    const layerExtra = (i) => {
      const L = an.layers[i];
      if (!L) return [];
      return [
        { label: 'R-value used here', value: fmt(L.r, 2) },
        { label: 'Thickness', value: inch(L.thickness) },
        { label: 'Inner face now', value: `${fmt(L.tIn, 1)} °F` },
        { label: 'Outer face now', value: `${fmt(L.tOut, 1)} °F` },
      ];
    };
    const dewExtra = () => {
      const c = store.get().climate;
      const inside = an.warmSide === 'interior';
      return [
        { label: 'Dew point now', value: `${fmt(an.dewPointF, 1)} °F` },
        { label: inside ? 'Inside air' : 'Outside air', value: inside ? `${fmt(c.tIn, 0)} °F, ${fmt(c.rhIn, 0)}% RH` : `${fmt(c.tOut, 0)} °F, ${fmt(c.rhOut, 0)}% RH` },
      ];
    };
    const condExtra = () => (an.condensation
      ? [{ label: 'Surface now', value: `${fmt(an.condensation.tempF, 1)} °F` }, { label: 'Dew point now', value: `${fmt(an.dewPointF, 1)} °F` }]
      : [{ label: 'Dew point now', value: `${fmt(an.dewPointF, 1)} °F` }]);
    // 3D hit -> { id, extra } for the card
    const cardFor = (hit) => {
      if (!hit || !hit.kind) return null;
      const L = hit.layerIndex != null ? an.layers[hit.layerIndex] : null;
      if (hit.kind === 'layer') return L ? { id: infoIdFor(L.materialId), extra: layerExtra(hit.layerIndex) } : null;
      if (hit.kind === 'stud') {
        const fl = an.layers.find((l) => l.framing);
        const type = (L && L.framing ? L.framing : fl && fl.framing)?.type;
        return { id: type === 'steel' ? 'steel' : 'softwood', extra: [] };
      }
      if (hit.kind === 'dew_plane') return { id: 'dew_point', extra: dewExtra() };
      if (hit.kind === 'condensation') return { id: 'condensation', extra: condExtra() };
      if (hit.kind === 'callout' && hit.infoId) return { id: hit.infoId, extra: L && hit.infoId === infoIdFor(L.materialId) ? layerExtra(hit.layerIndex) : [] };
      return hit.infoId ? { id: hit.infoId, extra: [] } : null;
    };
    let lastPtr = { x: 0, y: 0 };

    // ---------------------------------------------------------------- helpers
    const editWall = (fn) => {
      const wall = structuredClone(store.get().wall);
      fn(wall);
      store.set({ wall });
    };
    const select_ = (i) => {
      keep.sel = i;
      wall3d.select(i);
      graph.update(an, i);
      renderList();
    };

    // ---------------------------------------------------------------- panel A
    const wallSel = select({
      label: 'Wall preset',
      options: Object.values(WALLS).map((w) => ({ value: w.id, label: `${w.id} · ${w.name}` })),
      value: store.get().wallId,
      onChange: (id) => { keep.sel = null; store.set({ wallId: id, wall: cloneWall(id) }); },
    });
    const listEl = el('div', { class: 'asm-list' });
    const addBtn = button({
      label: 'Add layer',
      onClick: () => {
        const at = Math.max(0, store.get().wall.layers.length - 1);
        keep.sel = at;
        editWall((w) => { w.layers.splice(at, 0, { materialId: 'xps', thickness: 2 }); });
      },
    });
    const resetBtn = button({
      label: 'Reset wall',
      kind: 'ghost',
      onClick: () => { keep.sel = null; store.set({ wall: cloneWall(store.get().wallId) }); },
    });
    const clsSeg = segmented({
      label: 'Vapor retarder class',
      options: [{ value: 'none', label: 'None' }, { value: 'I', label: 'I' }, { value: 'II', label: 'II' }, { value: 'III', label: 'III' }],
      value: store.get().vapor.cls,
      onChange: (v) => store.set({ vapor: { ...store.get().vapor, cls: v } }),
    });
    const zoneSel = select({
      label: 'Climate zone',
      options: CLIMATE_ZONES.map((z) => ({ value: z.id, label: z.name })),
      value: store.get().vapor.zone,
      onChange: (v) => store.set({ vapor: { ...store.get().vapor, zone: v } }),
    });
    panelA.append(
      section('Wall', wallSel.el),
      section(
        'Layers',
        el('div', { class: 'asm-end', text: 'Interior' }),
        listEl,
        el('div', { class: 'asm-end', text: 'Exterior' }),
        el('div', { class: 'asm-btns' }, addBtn, resetBtn),
      ),
      section('Vapor retarder', clsSeg.el, zoneSel.el),
    );

    function editorFor(i) {
      const wall = store.get().wall;
      const L = wall.layers[i];
      const isFramed = !!L.framing;
      const matSel = select({
        label: 'Material',
        options: isFramed ? BATT_OPTIONS : EDIT_OPTIONS,
        value: L.materialId,
        onChange: (id) => editWall((w) => {
          const ly = w.layers[i];
          const m = MATERIALS[id];
          ly.materialId = id;
          if (ly.framing) {
            ly.framing.nominalR = BATT_R[id];
            ly.framing.depth = FRAME_DEPTH[ly.framing.type][id];
            ly.thickness = ly.framing.depth;
          } else ly.thickness = m.thickness;
        }),
      });
      const kids = [matSel.el];
      {
        // Source of the R-value for this layer (plan item: each value shows its source).
        const mat = MATERIALS[L.materialId];
        const res = analyzeWall(wall, store.get().climate).layers[i];
        const src = el('div', { class: 'asm-src', style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:center' },
          el('span', { class: 'hint', text: 'R-value source' }),
          sourceTag(mat?.source && mat.source !== '—' ? mat.source : 'No R-value. Membrane.'));
        if (isFramed) {
          src.append(sourceTag(L.framing.type === 'steel'
            ? `Steel studs: effective R ${fmt(res?.r ?? 0, 1)} — ASHRAE 90.1 App. A`
            : 'Wood studs: parallel path, 25% framing at 16" o.c., 22% at 24" o.c. (ASHRAE typical, not checked)'));
        }
        kids.push(src);
      }
      if (isFramed) {
        kids.push(segmented({
          label: 'Stud spacing',
          options: [{ value: '16', label: '16" o.c.' }, { value: '24', label: '24" o.c.' }],
          value: String(L.framing.spacing),
          onChange: (v) => editWall((w) => { w.layers[i].framing.spacing = Number(v); }),
        }).el);
        kids.push(segmented({
          label: 'Framing type',
          options: [{ value: 'wood', label: 'Wood' }, { value: 'steel', label: 'Steel' }],
          value: L.framing.type,
          onChange: (v) => editWall((w) => {
            const f = w.layers[i].framing;
            f.type = v;
            f.depth = FRAME_DEPTH[v][w.layers[i].materialId] ?? f.depth;
            w.layers[i].thickness = f.depth;
          }),
        }).el);
      }
      const last = wall.layers.length - 1;
      const up = button({ label: 'Move up', onClick: () => { keep.sel = i - 1; editWall((w) => { [w.layers[i - 1], w.layers[i]] = [w.layers[i], w.layers[i - 1]]; }); } });
      const down = button({ label: 'Move down', onClick: () => { keep.sel = i + 1; editWall((w) => { [w.layers[i + 1], w.layers[i]] = [w.layers[i], w.layers[i + 1]]; }); } });
      const rem = button({ label: 'Remove', kind: 'ghost', onClick: () => { keep.sel = null; editWall((w) => { w.layers.splice(i, 1); }); } });
      up.disabled = i === 0; down.disabled = i === last; rem.disabled = wall.layers.length <= 1;
      up.setAttribute('aria-label', 'Move layer toward interior');
      down.setAttribute('aria-label', 'Move layer toward exterior');
      kids.push(el('div', { class: 'asm-btns' }, up, down, rem));
      return el('div', { class: 'asm-editor' }, kids);
    }

    function renderList() {
      const wall = store.get().wall;
      if (keep.sel != null && keep.sel >= wall.layers.length) keep.sel = null;
      listEl.replaceChildren();
      wall.layers.forEach((layer, i) => {
        const mat = MATERIALS[layer.materialId];
        const opts = mat.thicknessOptions;
        let sub = ROLE[mat.control] || mat.control;
        if (layer.framing) sub += ` · ${layer.framing.type === 'wood' ? 'wood' : 'steel'} studs ${layer.framing.spacing}" o.c.`;
        const idx = opts ? opts.indexOf(layer.thickness) : -1;
        const row = layerRow({
          color: mat.color,
          name: mat.name,
          sub,
          r: an.layers[i] ? an.layers[i].r : 0,
          thickness: opts ? layer.thickness : undefined,
          onStep: opts ? (dir) => {
            let k = idx;
            if (k < 0) k = opts.findIndex((o) => o >= layer.thickness);
            const n = Math.min(opts.length - 1, Math.max(0, k + dir));
            editWall((w) => { w.layers[i].thickness = opts[n]; });
          } : undefined,
          canDec: opts ? idx > 0 || idx < 0 : true,
          canInc: opts ? idx < opts.length - 1 : true,
          selected: keep.sel === i,
          onSelect: () => select_(keep.sel === i ? null : i),
        });
        row.el.dataset.index = String(i);
        const infoId = infoIdFor(layer.materialId);
        const ib = infoButton(infoId, { extra: () => layerExtra(i), label: SHORT(mat.name) });
        const rEl = row.el.querySelector('.layer-r');
        row.el.insertBefore(ib, rEl);
        row.el.addEventListener('pointerenter', (e) => {
          if (e.pointerType && e.pointerType !== 'mouse') return;
          if (wall3d.setHoverLayer) wall3d.setHoverLayer(i);
          card.show(infoId, { anchor: row.el, extra: layerExtra(i) });
        });
        row.el.addEventListener('pointerleave', () => {
          if (wall3d.setHoverLayer) wall3d.setHoverLayer(null);
          card.hideHover();
        });
        listEl.appendChild(row.el);
        if (keep.sel === i) listEl.appendChild(editorFor(i));
      });
    }

    // ---------------------------------------------------------------- panel B
    const sR = stat({ label: 'R total', value: 0, digits: 2, unit: 'h·ft²·°F/Btu' });
    const sU = stat({ label: 'U-factor', value: 0, digits: 4, unit: 'Btu/h·ft²·°F', source: 'U = 1 / R total' });
    const sQ = stat({ label: 'Heat flow q', value: 0, digits: 2, unit: 'Btu/h·ft²', source: 'q = ΔT / R total' });
    const sBig = stat({ label: 'Heat loss Q', value: 0, digits: 0, unit: 'Btu/h', source: 'Q = U × A × ΔT — ARE formula sheet, BCI 7.40' });
    const sDew = stat({ label: 'Dew point', value: 0, digits: 1, unit: '°F', source: 'Magnus formula. BCI 7.45' });
    const sFrame = stat({ label: 'Framing loss', value: 0, digits: 0, unit: '%' });
    const soR = decorateStat(sR, 'r_value');
    const soU = decorateStat(sU, 'u_factor');
    const soQ = decorateStat(sQ, 'heat_flow');
    const soBig = decorateStat(sBig, 'heat_loss_q');
    const soDew = decorateStat(sDew, 'dew_point', dewExtra);
    const soFrame = decorateStat(sFrame, 'framing_effect');
    const condBox = el('div', { class: 'section-body' });
    const condFix = el('div', { class: 'asm-fix' });
    const condChips = el('div', { class: 'asm-chips' }, infoChip('condensation', 'Why this matters', { extra: condExtra }));
    const vaporBox = el('div', { class: 'section-body' });
    const vaporChipEls = [infoChip('vapor_retarder'), infoChip('vapor_classes', 'Vapor classes'), infoChip('climate_zone', 'Climate zone')];
    const leakBox = el('div', { class: 'section-body' });
    const leakChipEl = infoChip('air_leakage');
    panelB.append(
      section('Numbers', Object.assign(stats(sR.el, sU.el, sQ.el, sBig.el, sDew.el, sFrame.el), { className: 'stats asm-stats' })),
      section('Condensation', condBox, condFix, condChips),
      section('Vapor retarder', vaporBox),
      section('Air leakage', leakBox),
    );

    // ---------------------------------------------------------------- panel C
    let labelsOn = store.get().labels !== false;
    const showSeg = segmented({
      label: 'Show',
      options: [{ value: 'materials', label: 'Materials' }, { value: 'temp', label: 'Temperature' }, { value: 'control', label: 'Control layers' }],
      value: keep.show,
      onChange: (v) => { keep.show = v; wall3d.setShow(v); renderLegend(); },
    });
    showSeg.el.classList.add('asm-show');
    const exSl = slider({
      label: 'Exploded view', min: 0, max: 100, step: 1, value: keep.explode, unit: '%',
      format: (v) => String(Math.round(v)),
      onInput: (v) => { keep.explode = v; wall3d.setExplode(v); },
    });
    const secTg = toggle({ label: 'Section cut', value: keep.section, onChange: (v) => { keep.section = v; wall3d.setSection(v); } });
    const lblTg = toggle({ label: 'Labels', value: labelsOn, onChange: (v) => { labelsOn = v; store.set({ labels: v }); if (wall3d.setCallouts) wall3d.setCallouts(v); } });
    tagLabel(exSl.el, infoButton('exploded_view'));
    const togRow = (tg, node) => el('div', { class: 'asm-togrow' }, tg.el, node);
    const resetView = button({ label: 'Reset view', onClick: () => wall3d.resetView() });
    const legendBox = el('div', { class: 'section-body' });

    const presetSel = select({
      label: 'Climate preset',
      options: [...Object.values(CLIMATE_PRESETS).map((p) => ({ value: p.id, label: p.name })), { value: 'custom', label: 'Custom' }],
      value: store.get().climatePreset || 'custom',
      onChange: (id) => {
        const p = CLIMATE_PRESETS[id];
        if (p) store.set({ climate: { tIn: p.tIn, rhIn: p.rhIn, tOut: p.tOut, rhOut: p.rhOut }, climatePreset: id });
      },
    });
    const climSl = (label, key, min, max, unit) => slider({
      label, min, max, step: 1, value: store.get().climate[key], unit,
      format: (v) => String(Math.round(v)),
      onInput: (v) => store.set({ climate: { ...store.get().climate, [key]: v }, climatePreset: null }),
    });
    const slTin = climSl('Inside temperature', 'tIn', 60, 80, '°F');
    const slRhIn = climSl('Inside humidity', 'rhIn', 20, 70, '%');
    const slTout = climSl('Outside temperature', 'tOut', -20, 110, '°F');
    const slRhOut = climSl('Outside humidity', 'rhOut', 20, 100, '%');
    const slLeak = slider({
      label: 'Air leakage', min: 0, max: 50, step: 1, value: store.get().leakCfm, unit: 'CFM',
      format: (v) => String(Math.round(v)), onInput: (v) => store.set({ leakCfm: v }),
    });
    const slArea = slider({
      label: 'Wall area', min: 10, max: 1000, step: 10, value: store.get().areaSf, unit: 'ft²',
      format: (v) => String(Math.round(v)), onInput: (v) => store.set({ areaSf: v }),
    });
    const graphBox = el('div', { class: 'asm-graph' });
    const graph = createGraph(graphBox);
    tagLabel(slRhIn.el, infoButton('relative_humidity', { label: 'Inside humidity' }));
    tagLabel(slLeak.el, infoButton('air_leakage'));
    const graphSec = section('Temperature through the wall', graphBox, legendBox);
    graphSec.querySelector('.section-title').insertBefore(infoButton('interior_surface_temp', { label: 'Temperature through the wall' }), null);
    cleanup.push(() => graph.dispose());
    panelC.append(
      section('View', showSeg.el, exSl.el, togRow(secTg, infoButton('section_cut')), lblTg.el, el('div', { class: 'asm-btns' }, resetView)),
      section('Climate', presetSel.el, slTin.el, slRhIn.el, slTout.el, slRhOut.el),
      section('Air and area', slLeak.el, slArea.el),
      graphSec,
    );

    function renderLegend() {
      const c = store.get().climate;
      legendBox.replaceChildren();
      if (keep.show === 'temp') {
        const lo = Math.min(c.tIn, c.tOut);
        const hi = Math.max(c.tIn, c.tOut);
        legendBox.append(thermalBar({ min: `${fmt(lo, 0)} °F`, mid: `${fmt((lo + hi) / 2, 0)} °F`, max: `${fmt(hi, 0)} °F` }));
      } else if (keep.show === 'control') {
        const lines = [
          ['water', 'Keeps liquid water out', 'wrb_concept', 'Water control'],
          ['air', 'Stops air moving through', 'air_barrier', 'Air barrier'],
          ['vapor', 'Slows water vapor', 'vapor_retarder', 'Vapor retarder'],
          ['thermal', 'Slows heat flow', 'continuous_insulation', 'Continuous insulation'],
        ];
        legendBox.append(el('div', { class: 'asm-ctl', style: 'margin-top:0' }, lines.map(([k, t, id, lab]) => el('div', { class: 'asm-ctl-row' },
          el('span', { class: 'swatch', style: { background: CONTROL_COLORS[k] } }),
          el('span', { class: 'asm-ctl-t', text: t }),
          infoChip(id, lab)))));
        legendBox.append(legend(CONTROL_LEGEND.filter((it) => ['Structure', 'Finish', 'Cladding'].includes(it.label))));
      } else {
        const seen = new Map();
        store.get().wall.layers.forEach((l) => seen.set(l.materialId, MATERIALS[l.materialId]));
        legendBox.append(legend([...seen.values()].map((m) => ({ color: m.color, label: SHORT(m.name) }))));
      }
    }

    // ---------------------------------------------------------------- refresh
    function refresh() {
      const st = store.get();
      an = analyzeWall(st.wall, st.climate);
      const d = dT(st.climate);

      // controls follow the store (set() never fires callbacks)
      wallSel.set(st.wallId);
      clsSeg.set(st.vapor.cls);
      zoneSel.set(st.vapor.zone);
      presetSel.set(st.climatePreset || 'custom');
      slTin.set(st.climate.tIn); slRhIn.set(st.climate.rhIn);
      slTout.set(st.climate.tOut); slRhOut.set(st.climate.rhOut);
      slLeak.set(st.leakCfm); slArea.set(st.areaSf);
      lblTg.set(st.labels !== false);

      // stats
      const wood = st.wall.layers.find((l) => l.framing && l.framing.type === 'wood');
      const steel = st.wall.layers.find((l) => l.framing && l.framing.type === 'steel');
      let rSrc = 'Sum of layer R-values + air films.';
      if (wood) rSrc += ` Wood studs: parallel path, ${wood.framing.spacing === 24 ? 22 : 25}% framing at ${wood.framing.spacing}" o.c. — BCI 7.40`;
      else if (steel) rSrc += ' Steel studs: effective R from a table — ASHRAE 90.1 App. A';
      else rSrc += ' — BCI 7.40';
      sR.update({ value: an.rTotal, source: rSrc });
      sU.update({ value: an.uFactor });
      sQ.update({ value: an.q });
      const Q = conductionLoss(an.uFactor, st.areaSf, d);
      sBig.update({ value: Q, hint: `${fmt(st.areaSf, 0)} ft² × ΔT ${fmt(d, 0)} °F` });
      sDew.update({ value: an.dewPointF, hint: an.warmSide === 'interior' ? 'Inside air' : 'Outside air' });
      const framedWall = !!(wood || steel);
      sFrame.el.style.display = framedWall ? '' : 'none';
      // one plain "so what" line under each key number
      const glassTimes = an.rTotal / GLASS_R;
      soR.textContent = `Higher is better. This wall resists heat about ${glassTimes >= 10 ? Math.round(glassTimes) : fmt(glassTimes, 1)} times better than one pane of glass.`;
      soU.textContent = 'Lower is better. It is 1 divided by R.';
      soQ.textContent = 'The heat that crosses each square foot of wall every hour.';
      const bulbs = Q / BTU_PER_BULB;
      soBig.textContent = bulbs < 0.5 ? 'Less than the heat of one 100-watt light bulb for this wall area.'
        : `About the heat of ${bulbs >= 10 ? Math.round(bulbs) : fmt(bulbs, 1).replace(/\.0$/, '')} 100-watt light bulbs for this wall area.`;
      soDew.textContent = `Any surface colder than this gets wet when ${an.warmSide === 'interior' ? 'indoor' : 'outdoor'} air reaches it.`;
      soFrame.textContent = 'The studs let heat go around the insulation.';
      if (framedWall) sFrame.update({ value: an.framingLossPct, hint: `Studs remove ${fmt(an.framingLossPct, 0)}% of the nominal R`, source: 'Nominal R vs effective R' });

      // condensation banner
      condBox.replaceChildren();
      const c = an.condensation;
      if (an.risk && c) {
        const nm = SHORT(MATERIALS[c.materialId].name);
        const face = an.season === 'winter' ? 'inner face' : 'outer face';
        condBox.append(banner({ kind: 'warn', title: 'Condensation risk', text: `${nm} ${face} is ${fmt(c.tempF, 1)} °F. Dew point is ${fmt(an.dewPointF, 1)} °F.` }));
        condFix.textContent = an.season === 'winter'
          ? 'Add insulation outside the sheathing, lower indoor humidity, or stop air leaks.'
          : 'Keep humid outdoor air out: stop air leaks, add a vapor control layer outside the cold surface, or raise the indoor temperature.';
      } else if (c && c.outsideWrb) {
        condBox.append(banner({ kind: 'ok', title: 'No risk inside the wall', text: 'The dew point is outside the water barrier, in the drained zone.' }));
        condFix.textContent = 'Water that forms out there can drain and dry. Keep the water barrier continuous.';
      } else {
        condBox.append(banner({ kind: 'ok', title: 'No condensation', text: 'No layer is below the dew point.' }));
        condFix.textContent = 'Keep it this way: control indoor humidity and stop air leaks.';
      }

      // vapor banners
      vaporBox.replaceChildren();
      const vr = checkVaporRetarder({ cls: st.vapor.cls, zone: st.vapor.zone, wall: st.wall });
      vr.warnings.forEach((w) => vaporBox.append(banner({ kind: 'warn', title: 'Vapor retarder', text: w.text })));
      if (vr.ok) vaporBox.append(banner({ kind: 'ok', title: 'Vapor retarder', text: 'This class works for this zone and wall.' }));
      vr.notes.forEach((n) => vaporBox.append(el('div', { class: 'asm-note', text: n })));
      vaporBox.append(el('div', { class: 'asm-chips' }, sourceTag(vr.source), ...vaporChipEls));

      // leakage bars
      const inf = infiltrationLoss(st.leakCfm, d);
      const mx = Math.max(Q, inf, 1);
      const bar = (label, val, alt, id) => el('div', { class: 'asm-bar-row' },
        el('div', { class: 'asm-bar-head' }, el('span', { text: label }), el('span', { class: 'num', 'data-bar': id, text: `${fmt(val, 0)} Btu/h` })),
        el('div', { class: 'asm-track' }, el('div', { class: `asm-fill${alt ? ' alt' : ''}`, style: { width: `${(val / mx) * 100}%` } })));
      leakBox.replaceChildren(
        bar('Conduction loss Q', Q, false, 'cond'),
        bar('Infiltration 1.08 × CFM × ΔT', inf, true, 'inf'),
        st.leakCfm === 0 ? el('div', { class: 'asm-note', text: 'Move the air leakage slider to compare.' }) : null,
        el('div', { class: 'asm-chips' }, sourceTag('Q = 1.08 × CFM × ΔT — ARE formula sheet'), leakChipEl),
      );

      // summary
      const tail = an.risk && c ? `! ${SHORT(MATERIALS[c.materialId].name).replace(/ sheathing$/, '')} ${fmt(c.tempF, 1)} °F` : 'OK';
      summaryEl.textContent = `R ${fmt(an.rTotal, 2)} · U ${fmt(an.uFactor, 4)} · ${tail}`;

      // 3D + graph + legend
      wall3d.update(an, st.climate);
      graph.update(an, keep.sel);
      renderLegend();
    }

    // ---------------------------------------------------------------- store wiring
    let raf = 0;
    const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; refresh(); }); };
    cleanup.push(() => { if (raf) cancelAnimationFrame(raf); raf = 0; });
    const unsub = store.subscribe((s, prev) => {
      if (s.wall !== prev.wall || s.wallId !== prev.wallId) {
        if (s.wallId !== prev.wallId) keep.sel = null;
        refresh();
        renderList();
        wall3d.select(keep.sel);
      } else schedule();
    });
    cleanup.push(unsub);

    let hintEl = null;
    const dismissHint = () => { if (hintEl) { lsSet(HINT_KEY, '1'); hintEl.remove(); hintEl = null; } };
    // 3D hover (wide screens) and tap/click (pinned card). Both guard on part C's API.
    const onPtr = (e) => { lastPtr = { x: e.clientX, y: e.clientY }; };
    stageEl.addEventListener('pointermove', onPtr);
    cleanup.push(() => stageEl.removeEventListener('pointermove', onPtr));
    const onLeave = () => { card.hideHover(); if (wall3d.setHoverLayer) wall3d.setHoverLayer(null); };
    stageEl.addEventListener('pointerleave', onLeave);
    cleanup.push(() => stageEl.removeEventListener('pointerleave', onLeave));
    if (wall3d.onHover) {
      wall3d.onHover((h) => {
        const m = cardFor(h);
        if (!m || !m.id) {
          card.hideHover();
          if (wall3d.setHoverLayer) wall3d.setHoverLayer(null);
          return;
        }
        if (wall3d.setHoverLayer) wall3d.setHoverLayer(h.kind === 'dew_plane' || h.kind === 'condensation' ? null : (h.layerIndex ?? null));
        card.show(m.id, { x: h.clientX, y: h.clientY, extra: m.extra });
        dismissHint();
      });
    }
    wall3d.onSelect((i, payload) => {
      select_(i);
      const h = payload && typeof payload === 'object' ? payload : (i != null ? { kind: 'layer', layerIndex: i } : null);
      const m = cardFor(h);
      if (!m || !m.id) { if (card.isPinned()) card.hide(); return; }
      const x = h.clientX != null ? h.clientX : lastPtr.x;
      const y = h.clientY != null ? h.clientY : lastPtr.y;
      card.show(m.id, { pinned: true, x, y, extra: m.extra });
      dismissHint();
    });
    if (wall3d.setCallouts) wall3d.setCallouts(labelsOn);
    if (/[?&]debug\b/.test(location.search)) { window.__envAssembly = { wall3d, card, getAn: () => an }; cleanup.push(() => { delete window.__envAssembly; }); }

    // first-use hint over the stage
    if (!lsGet(HINT_KEY)) {
      const wide = window.matchMedia('(hover: hover) and (pointer: fine)').matches && window.innerWidth >= 900;
      const x = el('button', { type: 'button', 'aria-label': 'Dismiss hint', text: '\u00d7' });
      const hint = el('div', { class: 'asm-hint', role: 'note' },
        el('span', { text: wide ? 'Hover over any part of the wall to learn what it does. Click to keep the card open.' : 'Tap any part of the wall to learn what it does.' }), x);
      hintEl = hint;
      x.addEventListener('click', dismissHint);
      stageWrap.appendChild(hint);
      cleanup.push(() => { hint.remove(); hintEl = null; });
    }
    wall3d.setShow(keep.show);
    wall3d.setExplode(keep.explode);
    wall3d.setSection(keep.section);
    refresh();
    renderList();
    wall3d.select(keep.sel);
    wall3d.resetView(); // once at mount
  },
  unmount() {
    this._cleanup.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    this._cleanup = [];
  },
};
