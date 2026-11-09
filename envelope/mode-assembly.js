// envelope/mode-assembly.js  Assembly mode: layer editor, results, climate, 3D stepped cutaway.
import {
  el, slider, select, segmented, toggle, stat, stats, banner, legend, section, layerRow, thermalBar, button, fmt, sourceTag,
} from '../shared/ui.js';
import { MATERIALS } from './materials.js';
import { WALLS, cloneWall } from './walls.js';
import { analyzeWall, CLIMATE_PRESETS, conductionLoss, infiltrationLoss } from './physics.js';
import { checkVaporRetarder, CLIMATE_ZONES } from './vapor.js';
import { createWall3D, CONTROL_LEGEND } from './assembly-3d.js';
import { createGraph } from './assembly-graph.js';

const CSS = `
.asm-editor{display:flex;flex-direction:column;gap:12px;padding:12px;margin:-4px 0 8px 10px;background:var(--paper-2);border:1.5px solid var(--ink);border-top:0;border-radius:0 0 var(--radius) var(--radius)}
.asm-end{font:800 11px var(--font-display);letter-spacing:.16em;text-transform:uppercase;color:var(--ink-2);padding:2px 2px}
.asm-list{display:flex;flex-direction:column;gap:6px}
.asm-bar-row{display:flex;flex-direction:column;gap:3px}
.asm-bar-head{display:flex;justify-content:space-between;font:700 12px var(--font-display);letter-spacing:.1em;text-transform:uppercase}
.asm-bar-head .num{font-size:14px;letter-spacing:0}
.asm-track{height:16px;background:var(--paper-3);border:1.5px solid var(--ink)}
.asm-fill{height:100%;background:var(--ink);width:0}
.asm-fill.alt{background:var(--accent);box-shadow:inset 0 0 0 1px var(--ink)}
.asm-note{font-size:13px;color:var(--ink-2);line-height:1.35}
.asm-graph{width:100%;min-width:0}
.asm-show .seg-btn{font-size:11px;letter-spacing:0;padding:0 2px}
.asm-btns{display:flex;gap:8px;flex-wrap:wrap}
.asm-btns .btn{flex:1 1 auto;padding:0 10px}
`;

// Module-level view state so it survives a mode switch.
const keep = { sel: null, show: 'materials', explode: 0, section: false };

const ROLE = {
  water: 'Water control', air: 'Air control', vapor: 'Vapor control', thermal: 'Thermal control',
  structure: 'Structure', finish: 'Finish', cladding: 'Cladding', airspace: 'Air space',
};
const SHORT = (n) => n.split(',')[0];
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
    const { stage, panelA, panelB, panelC, summaryEl, store } = ctx;
    const cleanup = [];
    this._cleanup = cleanup;

    const styleEl = el('style', { id: 'assembly-style', text: CSS });
    document.head.appendChild(styleEl);
    cleanup.push(() => styleEl.remove());

    const wall3d = createWall3D(stage);
    cleanup.push(() => wall3d.dispose());
    let an = analyzeWall(store.get().wall, store.get().climate);

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
    const condBox = el('div', { class: 'section-body' });
    const vaporBox = el('div', { class: 'section-body' });
    const leakBox = el('div', { class: 'section-body' });
    panelB.append(
      section('Numbers', stats(sR.el, sU.el, sQ.el, sBig.el, sDew.el, sFrame.el)),
      section('Condensation', condBox),
      section('Vapor retarder', vaporBox),
      section('Air leakage', leakBox),
    );

    // ---------------------------------------------------------------- panel C
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
    cleanup.push(() => graph.dispose());
    panelC.append(
      section('View', showSeg.el, exSl.el, secTg.el, el('div', { class: 'asm-btns' }, resetView)),
      section('Climate', presetSel.el, slTin.el, slRhIn.el, slTout.el, slRhOut.el),
      section('Air and area', slLeak.el, slArea.el),
      section('Temperature through the wall', graphBox, legendBox),
    );

    function renderLegend() {
      const c = store.get().climate;
      legendBox.replaceChildren();
      if (keep.show === 'temp') {
        const lo = Math.min(c.tIn, c.tOut);
        const hi = Math.max(c.tIn, c.tOut);
        legendBox.append(thermalBar({ min: `${fmt(lo, 0)} °F`, mid: `${fmt((lo + hi) / 2, 0)} °F`, max: `${fmt(hi, 0)} °F` }));
      } else if (keep.show === 'control') {
        legendBox.append(legend(CONTROL_LEGEND));
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
      if (framedWall) sFrame.update({ value: an.framingLossPct, hint: `Studs remove ${fmt(an.framingLossPct, 0)}% of the nominal R`, source: 'Nominal R vs effective R' });

      // condensation banner
      condBox.replaceChildren();
      const c = an.condensation;
      if (an.risk && c) {
        const nm = SHORT(MATERIALS[c.materialId].name);
        const face = an.season === 'winter' ? 'inner face' : 'outer face';
        condBox.append(banner({ kind: 'warn', title: 'Condensation risk', text: `${nm} ${face} is ${fmt(c.tempF, 1)} °F. Dew point is ${fmt(an.dewPointF, 1)} °F.` }));
      } else if (c && c.outsideWrb) {
        condBox.append(banner({ kind: 'ok', title: 'No risk inside the wall', text: 'The dew point is outside the water barrier, in the drained zone.' }));
      } else {
        condBox.append(banner({ kind: 'ok', title: 'No condensation', text: 'No layer is below the dew point.' }));
      }

      // vapor banners
      vaporBox.replaceChildren();
      const vr = checkVaporRetarder({ cls: st.vapor.cls, zone: st.vapor.zone, wall: st.wall });
      vr.warnings.forEach((w) => vaporBox.append(banner({ kind: 'warn', title: 'Vapor retarder', text: w.text })));
      if (vr.ok) vaporBox.append(banner({ kind: 'ok', title: 'Vapor retarder', text: 'This class works for this zone and wall.' }));
      vr.notes.forEach((n) => vaporBox.append(el('div', { class: 'asm-note', text: n })));
      vaporBox.append(el('div', {}, sourceTag(vr.source)));

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
        el('div', {}, sourceTag('Q = 1.08 × CFM × ΔT — ARE formula sheet')),
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

    wall3d.onSelect((i) => select_(i));
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
