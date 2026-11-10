// envelope/mode-bridge.js  Thermal Bridge mode (Envelope Lab).
// A real piece of building for each detail: the problem version and the better version side by side, both cut open,
// with the solved heat map on the cut face, heat-flow arrows, names on every part and plain-language results.
// 3D: envelope/bridge-scene.js (parts in bridge-model.js, arrows in bridge-flow.js). Solver: envelope/bridge.js.

import { el, slider, segmented, toggle, section, thermalBar, button, fmt } from '../shared/ui.js';
import { solveBridge, describeResult, DETAILS } from './bridge.js';
import { createBridgeScene } from './bridge-scene.js';
import { graphSvg } from './bridge-graph.js';
import { createInfoCard, infoChip, infoButton } from './info-card.js';

const DETAIL_UI = {
  stud: {
    title: 'Steel studs in an insulated wall', desc: 'Heat runs through the framing, around the insulation.',
    name: 'Stud', sumName: 'Stud',
    todo: 'Put continuous insulation outside the studs so the framing is covered. Wood or thermally broken framing also helps.',
  },
  slab: {
    title: 'A concrete slab that runs through the wall', desc: 'Concrete carries heat straight out to the cold.',
    name: 'Slab edge', sumName: 'Slab edge',
    todo: 'Put a thermal break at the slab edge, or keep the slab inside the insulation line.',
  },
  shelf: {
    title: 'A steel angle that holds up the brick', desc: 'Steel carries heat across the insulation to the brick.',
    name: 'Shelf angle', sumName: 'Shelf angle',
    todo: 'Hold the angle off the wall on standoff brackets, or use a stainless or thermally broken support, so the insulation runs behind it.',
  },
};

// pairs: the first variant is the problem, the second the better version
const PAIRS = {
  stud: [
    { id: 'ci', label: 'Steel vs steel with continuous insulation', problem: 'steel', better: 'steel_ci' },
    { id: 'wood', label: 'Steel vs wood', problem: 'steel', better: 'wood' },
  ],
  slab: [{ id: 'break', problem: 'through', better: 'break' }],
  shelf: [{ id: 'standoff', problem: 'continuous', better: 'standoff' }],
};
const VAR_NAME = {
  wood: 'Wood stud', steel: 'Steel stud', steel_ci: 'Steel stud with 2 in. continuous insulation',
  through: 'Slab through the insulation', break: 'Slab with a thermal break',
  continuous: 'Continuous steel angle', standoff: 'Angle on standoff brackets',
};
const VAR_SHORT = {
  wood: 'Wood stud', steel: 'Steel stud', steel_ci: 'Steel + CI', through: 'Slab through', break: 'Slab with break',
  continuous: 'Continuous angle', standoff: 'Standoff angle',
};
const SUBJECT = {
  wood: 'A wood stud', steel: 'A steel stud', through: 'A slab that runs through the insulation', continuous: 'A continuous steel shelf angle',
};
const FIX = {
  wood: 'Switching to a wood stud', steel_ci: 'Adding 2 in. of continuous insulation outside the studs',
  break: 'A thermal break at the slab edge', standoff: 'Standoff brackets',
};
const FIX_SUM = { wood: 'wood', steel_ci: 'CI', break: 'break', standoff: 'standoff' };

const ICONS = {
  stud: '<svg viewBox="0 0 44 30" aria-hidden="true"><rect x="2" y="3" width="40" height="3" fill="var(--line-strong)"/><rect x="2" y="6" width="40" height="14" fill="var(--paper-3)" stroke="var(--line-strong)" stroke-width="1"/><rect x="20" y="6" width="4" height="14" fill="var(--ink-2)"/><rect x="2" y="20" width="40" height="3" fill="var(--line-strong)"/><rect x="2" y="23" width="40" height="3" fill="var(--line)"/></svg>',
  slab: '<svg viewBox="0 0 44 30" aria-hidden="true"><rect x="4" y="2" width="4" height="26" fill="var(--line-strong)"/><rect x="8" y="2" width="12" height="26" fill="var(--paper-3)" stroke="var(--line-strong)" stroke-width="1"/><rect x="20" y="2" width="4" height="26" fill="var(--line)"/><rect x="24" y="2" width="10" height="26" fill="var(--line-strong)"/><rect x="2" y="12" width="40" height="7" fill="var(--ink-2)"/></svg>',
  shelf: '<svg viewBox="0 0 44 30" aria-hidden="true"><rect x="4" y="2" width="4" height="26" fill="var(--line-strong)"/><rect x="8" y="2" width="12" height="26" fill="var(--paper-3)" stroke="var(--line-strong)" stroke-width="1"/><rect x="20" y="2" width="4" height="26" fill="var(--line)"/><rect x="26" y="2" width="12" height="26" fill="var(--line-strong)"/><rect x="20" y="17" width="12" height="3" fill="var(--ink-2)"/><rect x="20" y="10" width="3" height="10" fill="var(--ink-2)"/></svg>',
};

const CSS = `
.bt-intro{margin:0;font-size:14px;line-height:1.5;color:var(--ink)}
.bt-intro .ic-chip{margin-left:2px}
.bt-cards{display:flex;flex-direction:column;gap:8px}
.bt-dcard{display:grid;grid-template-columns:44px minmax(0,1fr);column-gap:12px;align-items:center;width:100%;min-height:calc(var(--ctl) + 20px);padding:8px 12px 8px 10px;text-align:left;background:var(--paper-3);color:var(--ink);border:1px solid var(--line);border-radius:var(--radius)}
.bt-pair{grid-template-columns:minmax(0,1fr);min-height:var(--ctl)}
.bt-dcard svg{width:44px;height:30px;display:block}
.bt-dcard .t{display:block;font:500 13.5px/1.3 var(--font-body)}
.bt-dcard .d{display:block;margin-top:2px;font:400 12.5px/1.35 var(--font-body);color:var(--ink-2)}
.bt-dcard[aria-pressed="true"]{border-color:var(--accent-edge);background:var(--accent-soft);box-shadow:inset 3px 0 0 var(--accent)}
.bt-chips{display:flex;flex-wrap:wrap;gap:6px 8px}
.bt-big{margin:0;font:500 17px/1.38 var(--font-body);color:var(--ink);letter-spacing:0}
.bt-big-sub{margin:6px 0 0;font-size:13px;line-height:1.45;color:var(--ink-2)}
.bt-warnline{margin:8px 0 0;padding:7px 10px;border:1px solid var(--warn-edge);background:var(--warn-soft);border-radius:var(--radius);font-size:13px;line-height:1.4;color:var(--ink)}
.bt-table{display:grid;grid-template-columns:minmax(0,1fr) 78px 78px;column-gap:8px;align-items:stretch;border:1px solid var(--line);border-radius:var(--radius);background:var(--paper-3);overflow:hidden}
.bt-table > *{padding:8px 8px;border-top:1px solid var(--line);min-width:0}
.bt-table > .h{border-top:0;font:500 12px var(--font-body);color:var(--ink-2);background:var(--paper-2)}
.bt-table > .h.p{text-align:right}
.bt-table > .lab{display:flex;align-items:center;gap:6px;font:400 12.5px/1.3 var(--font-body);color:var(--ink)}
.bt-table > .lab span{min-width:0}
.bt-table > .v{display:flex;align-items:center;justify-content:flex-end;font:500 13.5px var(--font-mono);font-variant-numeric:tabular-nums;white-space:nowrap}
.bt-table > .v[data-warn="true"]{color:var(--warn)}
.bt-table > .v.better{background:var(--ok-soft)}
.bt-note{margin:0;font-size:12px;line-height:1.4;color:var(--ink-2)}
.bt-todo{margin:0;font-size:13.5px;line-height:1.45}
.bt-more summary{cursor:pointer;font:500 13px var(--font-body);color:var(--accent);min-height:30px;display:flex;align-items:center}
.bt-more ul{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:7px}
.bt-more li{font-size:13px;line-height:1.45;padding-left:10px;border-left:1px solid var(--line-strong)}
.bt-more h4{margin:10px 0 0;font:500 12px var(--font-body);color:var(--ink-2)}
.bt-graph{display:block;width:100%;max-width:560px;height:auto;max-height:250px;color:var(--ink)}
.bt-graph text{font-family:var(--font-mono);font-size:10px;fill:var(--ink-2)}
.bt-graph .cap{font-family:var(--font-body);font-weight:500;font-size:11px}
.bt-key{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--ink-2);align-items:center}
.bt-key i{display:inline-block;width:22px;height:0;border-top:2px solid var(--ink);vertical-align:middle;margin-right:6px}
.bt-key i.b{border-top:2px dashed var(--ink-2)}
.bt-key i.d{border-top:1.5px dashed var(--accent)}
.bt-reset{position:absolute;top:10px;right:10px;z-index:3;min-height:var(--ctl);padding:0 12px;font-size:13px}
.bt-overlay{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2}
.bt-title{position:absolute;transform:translate(-50%,0);display:flex;align-items:center;gap:7px;max-width:min(46%,420px);padding:4px 10px;background:color-mix(in srgb,var(--paper-2) 94%,transparent);border:1px solid var(--line-strong);border-radius:16px;font:400 12.5px/1.25 var(--font-body);color:var(--ink);white-space:normal;text-align:left}
.bt-badge{font-weight:600;font-size:12px;flex:none}
.bt-title[data-side="problem"] .bt-badge{color:var(--warn)}
.bt-title[data-side="better"] .bt-badge{color:var(--ok)}
.bt-title-text{min-width:0}
.bt-inset{position:absolute;left:8px;top:8px;z-index:3;display:none;gap:10px;padding:4px 9px;background:color-mix(in srgb,var(--paper-2) 94%,transparent);border:1px solid var(--line-strong);border-radius:999px;font:500 12px var(--font-mono);font-variant-numeric:tabular-nums;color:var(--ink);pointer-events:none}
.bt-inset b{font-weight:500;font-family:var(--font-body)}
.bt-inset .p b{color:var(--warn)}
.bt-inset .b b{color:var(--ok)}
.bt-switch{position:absolute;left:50%;transform:translateX(-50%);bottom:8px;z-index:3;display:none;gap:0;border:1px solid var(--line-strong);border-radius:999px;overflow:hidden;background:var(--paper-2)}
.bt-switch button{min-height:40px;min-width:92px;padding:0 16px;border:0;background:transparent;color:var(--ink-2);font:500 14px var(--font-body)}
.bt-switch button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink)}
[data-narrow="true"] .bt-inset{display:flex}
[data-narrow="true"] .bt-switch{display:flex}
@media (max-width:899px){.bt-reset{min-height:36px;padding:0 10px}}
`;

const clampv = (v, a, b) => Math.min(b, Math.max(a, v));
const signed = (v, d = 1) => `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v), d)}`;

function lossPhrase(p) {
  const ratio = 1 + p / 100;
  if (p < 3) return 'barely changes the heat loss';
  if (ratio < 1.22) return `adds about ${Math.round(p)} % to the heat loss`;
  if (ratio < 1.4) return 'adds about a third to the heat loss';
  if (ratio < 1.6) return 'adds about half again to the heat loss';
  if (ratio < 1.85) return 'adds about two thirds to the heat loss';
  if (ratio < 1.95) return 'nearly doubles the heat loss';
  if (ratio < 2.1) return 'doubles the heat loss';
  if (ratio < 2.4) return 'more than doubles the heat loss';
  if (ratio < 2.65) return 'multiplies the heat loss by about two and a half';
  if (ratio < 3.3) return 'triples the heat loss';
  return `multiplies the heat loss by about ${Math.round(ratio)}`;
}

export default {
  id: 'bridge',
  label: 'Thermal Bridge',
  panelTitles: { a: 'Detail', b: 'Result', c: 'Climate' },
  _cleanup: [],

  mount(ctx) {
    const { stage, stageEl, panelA, panelB, panelC, summaryEl, store } = ctx;
    const cleanup = this._cleanup = [];

    // ---------- state (kept in store.bridge so it survives a mode switch)
    const defaults = { detailId: 'stud', studPair: 'ci', show: 'heat', arrows: true, labels: true, side: 'problem' };
    const b = { ...defaults, ...(store.get().bridge || {}) };
    if (!DETAILS[b.detailId]) b.detailId = defaults.detailId;
    if (!PAIRS.stud.some((p) => p.id === b.studPair)) b.studPair = defaults.studPair;
    if (!['heat', 'mats', 'both'].includes(b.show)) b.show = defaults.show;
    b.arrows = b.arrows !== false; b.labels = b.labels !== false;
    if (b.side !== 'better') b.side = 'problem';
    const save = () => store.set({ bridge: { detailId: b.detailId, studPair: b.studPair, show: b.show, arrows: b.arrows, labels: b.labels, side: b.side } });
    save();

    const climate = (() => {
      const c = store.get().climate || {};
      return {
        tIn: clampv(Number.isFinite(c.tIn) ? c.tIn : 70, 60, 80),
        rhIn: clampv(Number.isFinite(c.rhIn) ? c.rhIn : 35, 20, 70),
        tOut: clampv(Number.isFinite(c.tOut) ? c.tOut : 20, -20, 110),
      };
    })();
    const writeClimate = () => store.set({ climate: { ...store.get().climate, tIn: climate.tIn, rhIn: climate.rhIn, tOut: climate.tOut }, climatePreset: null });
    const solve = (d, v) => solveBridge(d, v, { tIn: climate.tIn, tOut: climate.tOut, rhIn: climate.rhIn });
    const pairOf = () => (b.detailId === 'stud' ? PAIRS.stud.find((p) => p.id === b.studPair) : PAIRS[b.detailId][0]);

    // ---------- style
    const styleEl = el('style', { id: 'bridge-style' });
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
    cleanup.push(() => styleEl.remove());

    // ---------- 3D + info card
    const wrap = stageEl.parentElement || document.body;
    const card = createInfoCard(wrap);
    cleanup.push(() => card.dispose());
    const scene3d = createBridgeScene(stage, stageEl);
    cleanup.push(() => scene3d.dispose());
    if (stage.onTheme) { const off = stage.onTheme(() => scene3d.onTheme()); cleanup.push(off); }

    const resetBtn = button({ label: 'Reset view', kind: 'ghost', onClick: () => scene3d.frame() });
    resetBtn.classList.add('bt-reset');
    resetBtn.style.background = 'var(--paper-3)';
    stageEl.appendChild(resetBtn);
    cleanup.push(() => resetBtn.remove());

    // phone helpers: results inset and Problem / Better switch
    const inset = el('div', { class: 'bt-inset' });
    const sw = el('div', { class: 'bt-switch', role: 'group', 'aria-label': 'Version shown' });
    const swBtns = ['problem', 'better'].map((v) => {
      const bt = el('button', { type: 'button', 'data-v': v, 'aria-pressed': 'false', text: v === 'problem' ? 'Problem' : 'Better' });
      bt.addEventListener('click', () => { b.side = v; save(); paintSwitch(); scene3d.setSingle(v === 'problem' ? 0 : 1); });
      sw.appendChild(bt);
      return bt;
    });
    stageEl.append(inset, sw);
    cleanup.push(() => { inset.remove(); sw.remove(); });
    function paintSwitch() { swBtns.forEach((bt) => bt.setAttribute('aria-pressed', bt.dataset.v === b.side ? 'true' : 'false')); }
    paintSwitch();

    const mq = window.matchMedia('(max-width: 899px)');
    const applyNarrow = () => {
      stageEl.dataset.narrow = mq.matches ? 'true' : 'false';
      scene3d.setSingle(mq.matches ? (b.side === 'better' ? 1 : 0) : null);
    };
    mq.addEventListener('change', applyNarrow);
    cleanup.push(() => mq.removeEventListener('change', applyNarrow));

    let results = [null, null];

    // ---------- Panel A
    const detailBtns = {};
    const cards = el('div', { class: 'bt-cards', role: 'group', 'aria-label': 'Detail' });
    Object.keys(DETAIL_UI).forEach((id) => {
      const u = DETAIL_UI[id];
      const bt = el('button', {
        type: 'button', class: 'bt-dcard', 'data-detail': id, 'aria-pressed': 'false',
        on: { click: () => { if (b.detailId !== id) { b.detailId = id; save(); refreshAll(); } } },
      }, el('span', { html: ICONS[id] }), el('span', {}, el('span', { class: 't', text: u.title }), el('span', { class: 'd', text: u.desc })));
      detailBtns[id] = bt;
      cards.appendChild(bt);
    });
    const pairHolder = el('div');
    const pairBtns = PAIRS.stud.map((p) => el('button', {
      type: 'button', class: 'bt-dcard bt-pair', 'data-pair': p.id, 'aria-pressed': 'false',
      on: { click: () => { if (b.studPair !== p.id) { b.studPair = p.id; save(); refreshAll(); } } },
    }, el('span', { class: 't', text: p.label })));
    const pairSeg = { set: (v) => pairBtns.forEach((bt) => bt.setAttribute('aria-pressed', bt.dataset.pair === v ? 'true' : 'false')) };
    pairHolder.append(el('div', { class: 'bt-cards', role: 'group', 'aria-label': 'Compare' }, pairBtns));
    const pairNote = el('p', { class: 'bt-note' });
    const showSeg = segmented({
      options: [{ value: 'heat', label: 'Heat map' }, { value: 'mats', label: 'Materials' }, { value: 'both', label: 'Both' }],
      value: b.show,
      onChange: (v) => { b.show = v; save(); scene3d.setShow(v); },
    });
    const arrowTg = toggle({ label: 'Heat flow arrows', value: b.arrows, onChange: (v) => { b.arrows = v; save(); scene3d.setArrows(v); } });
    const labelTg = toggle({ label: 'Labels', value: b.labels, onChange: (v) => { b.labels = v; save(); scene3d.setLabels(v); } });
    panelA.append(
      el('p', { class: 'bt-intro' }, 'A thermal bridge is a shortcut for heat around the insulation. ', infoChip('thermal_bridge')),
      section('Detail', cards),
      section('Compare', pairHolder, pairNote),
      section('Show', showSeg.el, arrowTg.el, labelTg.el),
      section('Learn more', el('div', { class: 'bt-chips' }, infoChip('continuous_insulation'), infoChip('thermal_break'), infoChip('framing_effect'))),
    );
    const comparesection = pairHolder.closest('.section');

    // ---------- Panel B
    const bigEl = el('p', { class: 'bt-big', 'data-k': 'sentence', 'aria-live': 'polite' });
    const subEl = el('p', { class: 'bt-big-sub' });
    const condEl = el('div', { 'data-k': 'condline' });
    const tbl = el('div', { class: 'bt-table', 'data-k': 'table' });
    const rows = [
      { key: 'loss', label: 'Heat loss vs. a wall with no bridge', info: 'thermal_bridge' },
      { key: 'r', label: 'Effective R-value', info: 'r_value' },
      { key: 'min', label: 'Coldest inside surface', info: 'interior_surface_temp' },
      { key: 'cond', label: 'Condensation risk', info: 'dew_point' },
    ];
    const cellEls = {};
    tbl.append(el('div', { class: 'h' }, ''), el('div', { class: 'h p', 'data-k': 'head-p', text: 'Problem' }), el('div', { class: 'h p', 'data-k': 'head-b', text: 'Better' }));
    rows.forEach((rw) => {
      tbl.append(el('div', { class: 'lab' }, el('span', { text: rw.label }), infoButton(rw.info)));
      const p = el('div', { class: 'v', 'data-k': `${rw.key}-p` });
      const q = el('div', { class: 'v better', 'data-k': `${rw.key}-b` });
      cellEls[rw.key] = [p, q];
      tbl.append(p, q);
    });
    const dewEl = el('p', { class: 'bt-note', 'data-k': 'dew' });
    const todoEl = el('p', { class: 'bt-todo' });
    const moreBody = el('div');
    const more = el('details', { class: 'bt-more' }, el('summary', { text: 'More detail' }), moreBody);
    panelB.append(
      el('div', {}, bigEl, subEl, condEl),
      section('Problem and better', tbl, dewEl),
      section('What to do', todoEl),
      more,
      el('p', { class: 'bt-note', text: '2D steady-state heat flow. Results are for study, not design.' }),
    );

    // ---------- Panel C
    const graphHolder = el('div');
    const keyHolder = el('div', { class: 'bt-key' });
    const barHolder = el('div');
    const sIn = slider({ label: 'Inside temperature', min: 60, max: 80, step: 1, value: climate.tIn, unit: '°F', onInput: (v) => onClimate('tIn', v) });
    const sRh = slider({ label: 'Inside humidity', min: 20, max: 70, step: 1, value: climate.rhIn, unit: '%', onInput: (v) => onClimate('rhIn', v) });
    const sOut = slider({ label: 'Outside temperature', min: -20, max: 110, step: 1, value: climate.tOut, unit: '°F', onInput: (v) => onClimate('tOut', v) });
    panelC.append(
      section('Inside surface temperature', graphHolder, keyHolder, el('div', { class: 'bt-chips' }, infoChip('dew_point'), infoChip('interior_surface_temp'))),
      section('Climate', sIn.el, sRh.el, sOut.el, el('p', { class: 'bt-note', text: 'Humidity only moves the dew point.' })),
      section('Temperature scale', barHolder),
    );

    // ---------- painting
    function paintStatic() {
      const pr = pairOf();
      Object.entries(detailBtns).forEach(([id, bt]) => bt.setAttribute('aria-pressed', id === b.detailId ? 'true' : 'false'));
      comparesection.style.display = b.detailId === 'stud' ? '' : 'none';
      pairSeg.set(b.studPair);
      pairNote.textContent = '';
      const names = [VAR_NAME[pr.problem], VAR_NAME[pr.better]];
      scene3d.setTitles(names);
      todoEl.textContent = DETAIL_UI[b.detailId].todo;
    }

    function paintResults() {
      const [rP, rB] = results;
      const pr = pairOf();
      const flow = Math.abs(climate.tIn - climate.tOut) >= 1;
      // big sentence
      if (!flow) {
        bigEl.textContent = 'There is no temperature difference, so no heat flows.';
        subEl.textContent = 'Move the outside temperature away from the inside temperature.';
      } else {
        bigEl.textContent = `${SUBJECT[pr.problem]} ${lossPhrase(rP.increasePct)}.`;
        const cut = rP.increasePct > 3 ? Math.round(((rP.increasePct - rB.increasePct) / rP.increasePct) * 100) : 0;
        subEl.textContent = cut > 0 ? `${FIX[pr.better]} cuts that extra loss by about ${cut} %.` : `${FIX[pr.better]} changes little here.`;
      }
      const wet = [rP.condensationRisk, rB.condensationRisk];
      condEl.replaceChildren();
      if (flow && (wet[0] || wet[1])) {
        const who = wet[0] && wet[1] ? 'both versions' : wet[0] ? 'the problem version' : 'the better version';
        condEl.appendChild(el('p', { class: 'bt-warnline', role: 'alert', text: `At this humidity, water forms on the coldest inside surface of ${who}. The surface is below the dew point of ${fmt(rP.dewPointF, 1)} °F.` }));
      }
      // table
      const put = (key, i, text, warn) => { cellEls[key][i].textContent = text; cellEls[key][i].dataset.warn = warn ? 'true' : 'false'; };
      [rP, rB].forEach((r, i) => {
        put('loss', i, flow ? `${signed(r.increasePct)} %` : '—', flow && r.increasePct > 25);
        put('r', i, flow ? `R-${fmt(r.rEffective, 1)}` : '—', false);
        put('min', i, `${fmt(r.minInteriorT, 1)} °F`, flow && r.condensationRisk);
        put('cond', i, flow && r.condensationRisk ? 'Yes' : 'No', flow && r.condensationRisk);
      });
      dewEl.textContent = `Dew point of the room air: ${fmt(rP.dewPointF, 1)} °F`;
      // more detail
      const li = (r) => describeResult(r).map((t) => el('li', { text: t.replace(/ F([ ,.])/g, ' °F$1') }));
      moreBody.replaceChildren(
        el('h4', { text: `Problem: ${VAR_NAME[pr.problem].toLowerCase()}` }), el('ul', {}, flow ? li(rP) : []),
        el('h4', { text: `Better: ${VAR_NAME[pr.better].toLowerCase()}` }), el('ul', {}, flow ? li(rB) : []),
      );
      // summary line (phone) and inset
      const sum = `${DETAIL_UI[b.detailId].sumName} · ${flow ? `${signed(rP.increasePct, 0)} % heat loss` : 'no flow'} · ${FIX_SUM[pr.better]}: ${flow ? `${signed(rB.increasePct, 0)} %` : 'no flow'}`;
      summaryEl.textContent = sum;
      inset.replaceChildren(
        el('span', { class: 'p' }, el('b', { text: 'Problem ' }), flow ? `${signed(rP.increasePct, 0)} %` : '—'),
        el('span', { class: 'b' }, el('b', { text: 'Better ' }), flow ? `${signed(rB.increasePct, 0)} %` : '—'),
      );
    }

    function paintClimateViews() {
      const pr = pairOf();
      graphHolder.innerHTML = graphSvg(results[0], results[1], climate, { problem: 'Problem', better: 'Better' });
      keyHolder.replaceChildren(
        el('span', {}, el('i'), 'Problem'), el('span', {}, el('i', { class: 'b' }), 'Better'), el('span', {}, el('i', { class: 'd' }), 'Dew point'),
      );
      void pr;
      const lo = Math.min(climate.tIn, climate.tOut); const hi = Math.max(climate.tIn, climate.tOut);
      barHolder.replaceChildren(thermalBar({ min: `${fmt(lo, 0)} °F`, max: `${fmt(hi, 0)} °F`, mid: `${fmt((lo + hi) / 2, 0)} °F` }));
    }

    function solvePair() {
      const pr = pairOf();
      results = [solve(b.detailId, pr.problem), solve(b.detailId, pr.better)];
    }

    // detail or pair changed: rebuild geometry
    function refreshAll() {
      solvePair();
      paintStatic();
      paintResults();
      paintClimateViews();
      scene3d.setLabels(b.labels);
      scene3d.setDetail(b.detailId, results, climate);
      scene3d.setLabels(b.labels);
      applyNarrow();
    }

    // climate sliders: re-solve in rAF, geometry stays
    let raf = 0;
    function onClimate(key, v) {
      climate[key] = v;
      writeClimate();
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        solvePair();
        paintResults();
        paintClimateViews();
        scene3d.setResults(results, climate);
      });
    }
    cleanup.push(() => { if (raf) cancelAnimationFrame(raf); });

    // ---------- hover and tap
    const canvas = stage.renderer ? stage.renderer.domElement : null;
    const finePointer = () => { try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches && window.innerWidth >= 900; } catch (e) { return false; } };
    const extrasFor = (hit) => {
      const r = results[hit.side];
      const out = [{ label: 'Shown in', value: hit.side === 0 ? 'Problem version' : 'Better version' }];
      if (hit.tempF != null) out.push({ label: 'Temperature here', value: `${fmt(hit.tempF, 1)} °F` });
      out.push({ label: 'Coldest inside surface', value: `${fmt(r.minInteriorT, 1)} °F` });
      out.push({ label: 'Heat loss vs. clear wall', value: `${signed(r.increasePct)} %` });
      return out;
    };
    let hoverKey = ''; let hoverRaf = 0; let lastMove = null;
    const onMove = (e) => {
      if (e.pointerType === 'touch' || e.buttons || !finePointer()) return;
      lastMove = { x: e.clientX, y: e.clientY };
      if (hoverRaf) return;
      hoverRaf = requestAnimationFrame(() => {
        hoverRaf = 0;
        if (!lastMove) return;
        const hit = scene3d.pickAt(lastMove.x, lastMove.y);
        scene3d.setHover(hit);
        if (canvas) canvas.style.cursor = hit && hit.infoId ? 'help' : '';
        if (card.isPinned()) return;
        if (hit && hit.infoId) {
          const k = `${hit.side}:${hit.infoId}`;
          if (k !== hoverKey || !card.isOpen()) { hoverKey = k; card.show(hit.infoId, { x: lastMove.x, y: lastMove.y, extra: extrasFor(hit) }); }
        } else if (card.isOpen()) { hoverKey = ''; card.hide(); }
      });
    };
    const onLeave = () => { lastMove = null; scene3d.setHover(null); hoverKey = ''; if (canvas) canvas.style.cursor = ''; if (!card.isPinned() && card.isOpen()) card.hide(); };
    if (canvas) {
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerleave', onLeave);
      cleanup.push(() => { canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerleave', onLeave); });
    }
    cleanup.push(() => { if (hoverRaf) cancelAnimationFrame(hoverRaf); });
    const offTap = stage.onTap(({ clientX, clientY }) => {
      const hit = scene3d.pickAt(clientX, clientY);
      scene3d.setHover(hit);
      if (hit && hit.infoId) { hoverKey = `${hit.side}:${hit.infoId}`; card.show(hit.infoId, { x: clientX, y: clientY, pinned: true, extra: extrasFor(hit) }); }
      else if (card.isOpen()) card.hide();
    });
    cleanup.push(offTap);
    card.onClose(() => { hoverKey = ''; scene3d.setHover(null); });

    scene3d.setShow(b.show);
    scene3d.setArrows(b.arrows);
    refreshAll();
  },

  unmount() {
    const fns = this._cleanup || [];
    this._cleanup = [];
    fns.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  },
};
