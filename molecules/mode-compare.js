// molecules/mode-compare.js  Compare mode: two structures side by side, so you SEE why two materials behave differently.
// "Simple first" pattern (shared/simple.js): one question, three controls, one plain answer, "Try this", then "Show numbers".
// State lives in store.compare and store.view and survives mode switches. Mode default export: { id, label, panelTitles, mount(ctx), unmount() }.

import { createViewer, viewControls } from './viewer.js';
import { createOverlay } from './compare-overlay.js';
import { PAIRS, PAIR_ORDER, combine } from './compare-data.js';
import { ELEMENTS } from './elements.js';
import { el, segmented, toggle, stat, section, legend, fmt } from '../shared/ui.js';
import { question, answer, tryThis, numbersSwitch, note } from '../shared/simple.js';

const STYLE_ID = 'compare-style';
const CSS = `
.cmp-stack { display: flex; flex-direction: column; gap: 14px; }
.cmp-pairs { display: flex; flex-direction: column; gap: 6px; }
.cmp-pair { width: 100%; min-height: 44px; display: flex; flex-direction: column; gap: 1px; text-align: left; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper-2); color: var(--ink); font: inherit; cursor: pointer; }
.cmp-pair:hover { border-color: var(--line-strong); }
.cmp-pair[aria-pressed="true"] { border-color: var(--accent-edge); background: var(--accent-soft); }
.cmp-view .section-title { display: none; }
.cmp-pair-name { font-size: 14px; font-weight: 600; }
.cmp-pair-sub { font-size: 12px; color: var(--ink-2); }
.cmp-label { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.cmp-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
.cmp-card { border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper-3); padding: 10px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.cmp-card-side { font-size: 11px; font-weight: 600; color: var(--ink-2); }
.cmp-card-title { font-size: 14px; font-weight: 600; line-height: 1.25; }
.cmp-card-tag { font-size: 12px; line-height: 1.4; color: var(--ink-2); }
.cmp-pill { align-self: flex-start; font-size: 11px; font-weight: 600; padding: 1px 7px; border: 1px solid var(--accent-edge); border-radius: 999px; background: var(--accent-soft); color: var(--accent); }
.cmp-block { display: flex; flex-direction: column; gap: 6px; }
.cmp-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 5px; font-size: 14px; line-height: 1.45; }
.cmp-helpers { display: flex; flex-direction: column; gap: 2px; }
.cmp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.cmp-table th { text-align: left; font-weight: 600; color: var(--ink-2); font-size: 12px; padding: 4px 4px 6px; }
.cmp-table th:not(:first-child), .cmp-table td:not(:first-child) { text-align: right; }
.cmp-table td { padding: 7px 4px; border-top: 1px solid var(--line); vertical-align: top; }
.cmp-table td:first-child { color: var(--ink-2); padding-right: 8px; }
.cmp-table td:not(:first-child) { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.cmp-unit { color: var(--ink-2); font-size: 11px; margin-left: 2px; }
`;

const DEFAULT_DIR = [0.18, 0.33, 1];   // nearly head-on, so the depth of one block does not spill sideways onto the other
const HINT_OFF = 'Turn on Show numbers to tap atoms and measure.';

export default {
  id: 'compare',
  label: 'Compare',
  panelTitles: { a: 'Compare', b: 'What you see', c: 'View' },
  _cleanup: [],
  mount(ctx) {
    const { store, stage, panelA, panelB, panelC, summaryEl } = ctx;
    const cleanup = this._cleanup;

    // ----- style -----
    const styleEl = el('style', { id: STYLE_ID, text: CSS });
    document.head.appendChild(styleEl);
    cleanup.push(() => styleEl.remove());

    // ----- state (store.compare survives mode switches) -----
    const prev = store.get().compare || {};
    store.set({
      compare: {
        look: 'both', showNumbers: false, rightVariant: 'pe',
        ...prev, helpers: { ...(prev.helpers || {}) },
        pairId: PAIRS[prev.pairId] ? prev.pairId : 'iron',
      },
    });
    const cmp = () => store.get().compare;
    const setCmp = (patch) => store.set({ compare: { ...cmp(), ...patch } });
    const pairOf = () => PAIRS[cmp().pairId];
    const helperOn = (pair, h) => {
      const mine = cmp().helpers[pair.id];
      return mine && mine[h.key] != null ? !!mine[h.key] : !!h.on;
    };
    const setHelpers = (pair, patch) => setCmp({ helpers: { ...cmp().helpers, [pair.id]: { ...(cmp().helpers[pair.id] || {}), ...patch } } });

    // ----- 3D -----
    const viewer = createViewer(stage);
    const overlay = createOverlay(stage);
    cleanup.push(() => overlay.dispose());
    cleanup.push(() => viewer.dispose());

    // ----- sides (built on demand, cached for this visit) -----
    const sideCache = new Map();
    const variantOf = (pair) => {
      const vs = pair.right.variants;
      if (!vs) return null;
      return vs.find((v) => v.id === cmp().rightVariant) || vs[0];
    };
    const rightInfo = (pair) => { const v = variantOf(pair); return v ? { ...pair.right, ...v } : pair.right; };
    const getSide = (pair, which) => {
      const info = which === 'left' ? pair.left : rightInfo(pair);
      const key = `${pair.id}:${which}:${which === 'right' && variantOf(pair) ? variantOf(pair).id : ''}`;
      if (!sideCache.has(key)) sideCache.set(key, info.build());
      return sideCache.get(key);
    };

    // ----- stage drawing -----
    let combined = null;
    function render({ reframe = false } = {}) {
      const pair = pairOf();
      const look = cmp().look;
      const parts = [];
      if (look !== 'right') parts.push({ key: 'left', side: getSide(pair, 'left') });
      if (look !== 'left') parts.push({ key: 'right', side: getSide(pair, 'right') });
      combined = combine(parts);

      const hs = pair.helpers.filter((h) => helperOn(pair, h));
      const fx = hs.map((h) => h.effect);
      const keys = Object.keys(combined.sides);
      const tagColors = {};
      const addColors = (map) => keys.forEach((k) => Object.entries(map || {}).forEach(([tag, c]) => { tagColors[`${k}:${tag}`] = c; }));
      addColors(pair.look.colors);
      fx.forEach((e) => addColors(e.colors));
      const fade = {};
      fx.forEach((e) => { if (e.fadeBase != null) keys.forEach((k) => { fade[k] = e.fadeBase; }); });

      const structure = { atoms: combined.atoms, bonds: pair.look.bonds === false ? [] : combined.bonds };
      viewer.setStructure(structure, {
        style: store.get().view.style, radiusScale: pair.look.radiusScale, spaceRadius: pair.look.spaceRadius,
        colorBy: 'tag', tagColors, fade,
      });
      viewer.setCell(null);

      const pick = (field, name) => (name ? combined[field][name] || [] : []);
      viewer.setPlanes(fx.flatMap((e) => pick('planes', e.planes)));
      viewer.setArrows(fx.flatMap((e) => pick('arrows', e.arrows)));
      const lit = fx.flatMap((e) => (e.highlight ? keys.flatMap((k) => combined.groups[k][e.highlight] || []) : []));
      if (lit.length) viewer.highlight(lit); else viewer.clearHighlight();

      overlay.setScale(viewer.boundingRadius());
      overlay.setBoxes([...pick('boxes', pair.look.alwaysBoxes), ...fx.flatMap((e) => pick('boxes', e.boxes))]);
      overlay.setLinks(fx.some((e) => e.links) ? combined.hbonds.map((h) => [combined.atoms[h.a].pos, combined.atoms[h.b].pos]) : []);
      overlay.setLabels(keys.map((k) => {
        const b = combined.sides[k].bounds;
        const info = k === 'left' ? pair.left : rightInfo(pair);
        return { text: info.short, pos: [(b.min[0] + b.max[0]) / 2, b.min[1], b.max[2]] };
      }));

      summaryEl.textContent = look === 'both' ? pair.summary : `${(look === 'left' ? pair.left : rightInfo(pair)).title} · ${pair.name}`;
      measureStat.update({ value: 'None', unit: '', hint: cmp().showNumbers ? 'Tap two atoms to measure a distance. Tap a third for the angle.' : HINT_OFF });
      if (reframe) viewer.frame({ dir: pair.look.dir || DEFAULT_DIR, padding: pair.look.padding || 1.05 });
    }

    // ----- panel A: the question, the pair, the look, try this -----
    const qBox = el('div');
    const pairBox = el('div', { class: 'cmp-pairs' });
    const pairButtons = new Map();
    PAIR_ORDER.forEach((id) => {
      const p = PAIRS[id];
      const b = el('button', { type: 'button', class: 'cmp-pair', 'aria-pressed': 'false' },
        el('span', { class: 'cmp-pair-name', text: p.name }), el('span', { class: 'cmp-pair-sub', text: p.question }));
      b.addEventListener('click', () => choosePair(id));
      pairButtons.set(id, b);
      pairBox.append(b);
    });
    const lookSeg = segmented({
      label: 'Look at',
      options: [{ value: 'left', label: 'Left' }, { value: 'both', label: 'Both' }, { value: 'right', label: 'Right' }],
      value: cmp().look,
      onChange: (v) => { setCmp({ look: v }); render({ reframe: true }); refreshB(); },
    });
    const variantBox = el('div');
    const tryBox = el('div');
    panelA.append(el('div', { class: 'cmp-stack' },
      qBox,
      el('div', { class: 'cmp-block' }, el('div', { class: 'cmp-label', text: 'Pick a pair' }), pairBox),
      lookSeg.el, variantBox, tryBox));

    function buildQuestion(pair) {
      qBox.replaceChildren(question(pair.question, 'Two structures. One idea.'));
    }
    function buildVariant(pair) {
      variantBox.replaceChildren();
      const vs = pair.right.variants;
      if (!vs) return;
      const seg = segmented({
        label: 'Plastic on the right', options: vs.map((v) => ({ value: v.id, label: v.label })), value: variantOf(pair).id,
        onChange: (v) => { setCmp({ rightVariant: v }); render({ reframe: true }); refreshB(); },
      });
      variantBox.append(seg.el);
    }
    function buildTry(pair) {
      tryBox.replaceChildren(tryThis(pair.steps.map((s) => ({
        label: s.label, hint: s.hint,
        run: () => {
          const before = cmp().look;
          setCmp({ look: s.look });
          setHelpers(pair, s.helpers || {});
          lookSeg.set(s.look);
          render({ reframe: before !== s.look });
          refreshB();
        },
      }))));
    }

    // ----- panel B: the plain answer, the two cards, what to notice, numbers -----
    const measureStat = stat({ label: 'Measurement', value: 'None', hint: HINT_OFF });
    const labelsToggle = toggle({
      label: 'Show element names', value: !!store.get().view.labels,
      onChange: (v) => {
        const view = store.get().view;
        store.set({ view: { ...view, labels: v } });
        viewer.setLabels(v);
      },
    });
    const offView = store.subscribe((s) => { if (!!s.view.labels !== labelsToggle.get()) labelsToggle.set(!!s.view.labels); });
    cleanup.push(offView);
    let numbersCtl = null;

    function sideCard(which, pair) {
      const info = which === 'left' ? pair.left : rightInfo(pair);
      const card = el('div', { class: 'cmp-card' },
        el('div', { class: 'cmp-card-side', text: which === 'left' ? 'Left' : 'Right' }),
        el('div', { class: 'cmp-card-title', text: info.title }),
        el('div', { class: 'cmp-card-tag', text: info.tag }));
      if (info.quality === 'schematic') {
        card.append(el('span', { class: 'cmp-pill', text: 'Schematic' }),
          el('div', { class: 'cmp-card-tag', text: 'A drawing of the idea, not measured positions.' }));
      }
      return card;
    }

    function numbersTable(pair) {
      const L = getSide(pair, 'left').numbers; const R = getSide(pair, 'right').numbers;
      const li = pair.left; const ri = rightInfo(pair);
      const cell = (row, v) => {
        const td = el('td');
        if (v == null) { td.textContent = '—'; return td; }
        if (typeof v === 'string') { td.textContent = v; return td; }
        td.append(fmt(v, row.digits == null ? 1 : row.digits));
        if (row.unit) td.append(el('span', { class: 'cmp-unit', text: row.unit }));
        return td;
      };
      const table = el('table', { class: 'cmp-table' },
        el('thead', {}, el('tr', {}, el('th', { text: '' }), el('th', { text: li.short }), el('th', { text: ri.short }))),
        el('tbody', {}, pair.rows.map((row) => el('tr', {}, el('td', { text: row.label }), cell(row, L[row.key]), cell(row, R[row.key])))));
      const hints = pair.rows.filter((r) => r.hint).map((r) => note(`${r.label}: ${r.hint}`));
      const quality = (info) => (info.quality === 'schematic' ? 'Schematic' : info.quality === 'approximate' ? 'Approximate' : 'Reference data');
      return el('div', { class: 'cmp-block' }, table, ...hints,
        note(`${li.short}: ${quality(li)}. ${li.source}.`), note(`${ri.short}: ${quality(ri)}. ${ri.source}`));
    }

    function buildB() {
      const pair = pairOf();
      panelB.replaceChildren();
      const ans = answer({ kind: 'info', title: pair.name, text: pair.lesson });
      const helpers = el('div', { class: 'cmp-helpers' }, pair.helpers.map((h) => toggle({
        label: h.label, value: helperOn(pair, h),
        onChange: (v) => { setHelpers(pair, { [h.key]: v }); render(); },
      }).el));
      // the table needs both sides, so it is only built when the switch is on (the water liquid takes a moment)
      const tableBox = el('div');
      const fillTable = () => { if (!tableBox.firstChild) tableBox.append(numbersTable(pair)); };
      if (cmp().showNumbers) fillTable();
      numbersCtl = numbersSwitch({
        label: 'Show numbers', value: cmp().showNumbers,
        onChange: (v) => { if (v) fillTable(); setCmp({ showNumbers: v }); render(); },
      }, measureStat.el, labelsToggle.el, tableBox);
      panelB.append(el('div', { class: 'cmp-stack' },
        ans.el,
        el('div', { class: 'cmp-cards' }, sideCard('left', pair), sideCard('right', pair)),
        el('div', { class: 'cmp-block' }, el('div', { class: 'cmp-label', text: 'What to notice' }), el('ul', { class: 'cmp-list' }, pair.points.map((t) => el('li', { text: t })))),
        el('div', { class: 'cmp-block' }, el('div', { class: 'cmp-label', text: 'In a building' }), el('p', { class: 'simple-note', text: pair.buildingLink })),
        helpers,
        numbersCtl.el));
    }
    function refreshB() { buildB(); }

    // ----- panel C: view controls and the atom key -----
    const legendBox = el('div');
    function buildLegend(pair) {
      const items = pair.look.legend.map((it) => ({ color: it.color || (ELEMENTS[it.el] ? ELEMENTS[it.el].color : '#999'), label: it.label }));
      legendBox.replaceChildren(section('Atoms', legend(items)));
    }
    panelC.append(el('div', { class: 'cmp-stack' }, el('div', { class: 'cmp-view' }, viewControls(store, viewer)), legendBox));

    // ----- choosing a pair -----
    function choosePair(id, { first = false } = {}) {
      const pair = PAIRS[id];
      if (!first) {
        setCmp({ pairId: id, look: 'both' });
        lookSeg.set('both');
        const view = store.get().view;
        if (pair.look.style && view.style !== pair.look.style) store.set({ view: { ...view, style: pair.look.style } });
      }
      pairButtons.forEach((b, k) => b.setAttribute('aria-pressed', k === id ? 'true' : 'false'));
      buildQuestion(pair); buildVariant(pair); buildTry(pair); buildLegend(pair);
      buildB();
      render({ reframe: true });
    }

    choosePair(cmp().pairId, { first: true });

    // ----- tap to measure (only when numbers are on) -----
    const offTap = stage.onTap(({ clientX, clientY }) => {
      if (!cmp().showNumbers) return;
      const hit = viewer.pickAtom(clientX, clientY);
      if (!hit) { viewer.clearHighlight(); return; }
      const m = viewer.measure.add(hit.index);
      viewer.highlight([hit.index]);
      if (m.type === 'distance') measureStat.update({ value: m.value, digits: 2, unit: 'Å', hint: 'Distance between the two atoms. 1 Å is 0.1 nanometer.' });
      else if (m.type === 'angle') measureStat.update({ value: m.value, digits: 1, unit: '°', hint: 'Angle at the second atom you tapped.' });
      else measureStat.update({ value: 'None', unit: '', hint: 'Tap one more atom to measure a distance.' });
    });
    cleanup.push(offTap);
  },
  unmount() {
    this._cleanup.splice(0).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  },
};
