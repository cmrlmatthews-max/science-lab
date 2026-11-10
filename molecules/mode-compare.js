// molecules/mode-compare.js  Compare mode: two structures side by side, so you SEE why two materials behave differently.
// Five information layers (shared/layers.js):
//   1 Start    one pair, both turning, plain names, one answer, four picture choices (no digits)
//   2 Story    a short guided story for the chosen pair
//   3 Explore  all pairs, look, helpers, Try this, tap or hover an atom for a card
//   4 Numbers  side-by-side tiles for the pair, trust tags, plain glosses
//   5 Deep     the full table, the measuring tool, sources
// State lives in store.compare and store.view and survives mode switches. Mode default export: { id, label, panelTitles, mount(ctx), unmount() }.

import { createViewer, viewControls } from './viewer.js';
import { createOverlay } from './compare-overlay.js';
import { PAIRS, PAIR_ORDER, combine } from './compare-data.js';
import { ELEMENTS } from './elements.js';
import { el, segmented, toggle, stat, section, legend, fmt } from '../shared/ui.js';
import { question, answer, tryThis, note } from '../shared/simple.js';
import { story, tile, moreLink } from '../shared/layers.js';
import { infoButton, infoChip } from '../shared/card.js';
import { dual } from '../shared/units.js';
import { TEXT, getInfo, STRUCTURE_IDS } from './content-compare.js';

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
.cmp-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.cmp-choice { min-height: 76px; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 6px; text-align: left; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper-2); color: var(--ink); font: inherit; font-size: 15px; font-weight: 600; line-height: 1.25; cursor: pointer; }
.cmp-choice:hover { border-color: var(--line-strong); }
.cmp-choice[aria-pressed="true"] { border-color: var(--accent-edge); background: var(--accent-soft); }
.cmp-choice svg { width: 30px; height: 30px; color: var(--accent); flex: none; }
.cmp-card-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.cmp-trow { display: flex; flex-direction: column; gap: 6px; }
.cmp-trow-label { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.cmp-trow-compare { font-size: 13px; line-height: 1.4; color: var(--ink-2); }
.cmp-tiles-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cmp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.cmp-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.cmp-gloss { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.4; color: var(--ink-2); }
`;

const DEFAULT_DIR = [0.18, 0.33, 1];   // nearly head-on, so the depth of one block does not spill sideways onto the other

// the story's view for each step of each pair: which side to look at and which helpers are on
const STORY_VIEW = {
  carbon: [{ look: 'left', h: { sheets: false } }, { look: 'right', h: { sheets: false } }, { look: 'both', h: { sheets: true } }, { look: 'both', h: { sheets: true } }, { look: 'both', h: { sheets: false } }],
  water: [{ look: 'left' }, { look: 'right' }, { look: 'both' }, { look: 'both' }, { look: 'both' }].map((v) => ({ ...v, h: { boxes: true, links: true } })),
  glass: [{ look: 'left', h: { block: false } }, { look: 'right', h: { block: false } }, { look: 'both', h: { block: true } }, { look: 'both', h: { block: true } }, { look: 'both', h: { block: false } }],
  iron: [{ look: 'left', h: { carbon: false } }, { look: 'right', h: { carbon: false } }, { look: 'both', h: { carbon: true } }, { look: 'both', h: { carbon: true } }, { look: 'both', h: { carbon: false } }],
  metals: [{ look: 'left', h: { layers: true } }, { look: 'right', h: { layers: true } }, { look: 'both', h: { layers: false } }, { look: 'both', h: { layers: true } }, { look: 'both', h: { layers: false } }],
  plastic: [{ look: 'left', h: { unit: false } }, { look: 'right', h: { unit: false }, variant: 'pe' }, { look: 'both', h: { unit: true } }, { look: 'both', h: { unit: true } }, { look: 'both', h: { unit: false } }],
};

// ideas to open as cards, for each pair
const IDEAS = {
  carbon: [['same-atoms', 'Same atoms, different pattern'], ['sliding-layers', 'Layers that slide'], ['network-solid', 'Network solid']],
  water: [['open-ice', 'The open pattern of ice'], ['hydrogen-link', 'Water links'], ['packing', 'Packing']],
  glass: [['crystal-vs-glass', 'Crystal or glass'], ['repeating-block', 'Repeating block'], ['network-solid', 'Network solid']],
  iron: [['same-atoms', 'Same atoms, different pattern'], ['packing', 'Packing'], ['carbon-gap', 'Carbon in a gap']],
  metals: [['sliding-layers', 'Layers that slide'], ['slip-plane', 'Sliding layer'], ['metal-bond', 'Metal bond']],
  plastic: [['plastic-chain', 'Plastic chain'], ['covalent-bond', 'Shared bond']],
};

// small picture for each big choice (level 1)
const ICONS = {
  carbon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M8 5h16l5 7-13 15L3 12z"/><path d="M3 12h26M12 5l4 7 4-7M16 12v15"/></svg>',
  water: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l8-6h14v14l-8 6H5z"/><path d="M5 12h14v14M19 12l8-6"/></svg>',
  glass: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="22" height="24" rx="1.5"/><path d="M16 4v24M5 16h22"/></svg>',
  iron: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h24v8H4z"/><path d="M10 12v8M16 12v8M22 12v8"/><path d="M8 24h16" /></svg>',
};

const prefersReduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

export default {
  id: 'compare',
  label: 'Compare',
  panelTitles: { a: 'Compare', b: 'What you see', c: 'View' },
  _cleanup: [],
  mount(ctx) {
    const { store, stage, panelA, panelB, panelC, summaryEl, layers, card } = ctx;
    const cleanup = this._cleanup;
    card.setSource(getInfo);
    ctx.setPanelMin('c', 3);   // the view controls and the atom key start at Explore

    // ----- style -----
    const styleEl = el('style', { id: STYLE_ID, text: CSS });
    document.head.appendChild(styleEl);
    cleanup.push(() => styleEl.remove());

    // ----- state (store.compare survives mode switches) -----
    const prev = store.get().compare || {};
    store.set({
      compare: {
        look: 'both', rightVariant: 'pe',
        ...prev, helpers: { ...(prev.helpers || {}) },
        // the shell starts with iron in the store; the first visit opens on diamond and pencil lead
        pairId: PAIRS[prev.pairId] && prev.touched ? prev.pairId : 'carbon',
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
    const lv = () => layers.level();
    let measuring = false;   // the Measure toggle (level 5)

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
    // the card id for a side of the chosen pair
    const structureId = (pair, which) => {
      const s = STRUCTURE_IDS[pair.id][which];
      if (typeof s === 'string') return s;
      const v = variantOf(pair);
      return s[v ? v.id : 'pe'];
    };

    // ----- stage drawing -----
    let combined = null;
    const sideName = (pair, which) => {
      const info = which === 'left' ? pair.left : rightInfo(pair);
      return lv() <= 2 ? TEXT.l1.labels[pair.id][which] : info.short;
    };
    function updateSummary() {
      const pair = pairOf(); const look = cmp().look;
      if (lv() <= 2) { summaryEl.textContent = TEXT.l1.summary[pair.id]; return; }
      summaryEl.textContent = look === 'both' ? pair.summary : `${(look === 'left' ? pair.left : rightInfo(pair)).title} · ${pair.name}`;
    }
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
        metalInCompounds: pair.id === 'iron' || pair.id === 'metals',
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
        return { text: sideName(pair, k), pos: [(b.min[0] + b.max[0]) / 2, b.min[1], b.max[2]] };
      }));

      updateSummary();
      measureStat.update({ value: TEXT.l5.measure.none, unit: '', hint: measuring ? TEXT.l5.measure.on : TEXT.l5.measure.off });
      if (reframe) viewer.frame({ dir: pair.look.dir || DEFAULT_DIR, padding: pair.look.padding || 1.05 });
    }

    // ===== panel A: the question, the choices, the pair list, the look, try this =====
    const q12 = layers.gate(el('div', {}, question(TEXT.l1.question, TEXT.l1.sub)), 1, 2);
    const q3 = layers.gate(el('div'), 3);
    // level 1 and 2: four big picture choices
    const choiceBox = el('div', { class: 'cmp-choices' });
    const choiceButtons = new Map();
    TEXT.l1.choices.forEach((c) => {
      const b = el('button', { type: 'button', class: 'cmp-choice', 'aria-pressed': 'false' });
      const icon = el('span'); icon.innerHTML = ICONS[c.id] || '';
      b.append(icon.firstChild || icon, el('span', { text: c.label }));
      b.addEventListener('click', () => choosePair(c.id));
      choiceButtons.set(c.id, b);
      choiceBox.append(b);
    });
    const choiceWrap = layers.gate(el('div', { class: 'cmp-block' }, choiceBox), 1, 2);
    // level 3 and up: every pair
    const pairBox = el('div', { class: 'cmp-pairs' });
    const pairButtons = new Map();
    PAIR_ORDER.forEach((id) => {
      const p = TEXT.l3.pairs[id];
      const b = el('button', { type: 'button', class: 'cmp-pair', 'aria-pressed': 'false' },
        el('span', { class: 'cmp-pair-name', text: p.name }), el('span', { class: 'cmp-pair-sub', text: p.sub }));
      b.addEventListener('click', () => choosePair(id));
      pairButtons.set(id, b);
      pairBox.append(b);
    });
    const lookSeg = segmented({
      label: TEXT.l3.controls.look,
      options: [{ value: 'left', label: TEXT.l3.controls.left }, { value: 'both', label: TEXT.l3.controls.both }, { value: 'right', label: TEXT.l3.controls.right }],
      value: cmp().look,
      onChange: (v) => { setCmp({ look: v }); render({ reframe: true }); buildHelpers(); },
    });
    const variantBox = el('div');
    const tryBox = el('div');
    const controls3 = layers.gate(el('div', { class: 'cmp-stack' },
      el('div', { class: 'cmp-block' }, el('div', { class: 'cmp-label', text: TEXT.l3.controls.pair }), pairBox),
      lookSeg.el, variantBox, tryBox), 3);
    panelA.append(el('div', { class: 'cmp-stack' }, q12, q3, choiceWrap, controls3));

    function buildVariant(pair) {
      variantBox.replaceChildren();
      const vs = pair.right.variants;
      if (!vs) return;
      const seg = segmented({
        label: TEXT.l3.controls.variant, options: vs.map((v) => ({ value: v.id, label: v.label })), value: variantOf(pair).id,
        onChange: (v) => { setCmp({ rightVariant: v }); render({ reframe: true }); buildSides(); buildHelpers(); buildTiles(); buildDeep(); },
      });
      variantBox.append(seg.el);
    }
    function applyView(pair, v) {
      if (v.variant && pair.right.variants) setCmp({ rightVariant: v.variant });
      const before = cmp().look;
      setCmp({ look: v.look });
      if (v.h) setHelpers(pair, v.h);
      lookSeg.set(v.look);
      render({ reframe: before !== v.look });
      buildSides(); buildHelpers(); buildVariant(pair); buildTiles(); buildDeep();
    }
    function buildTry(pair) {
      const t = TEXT.l3.pairs[pair.id].tries;
      tryBox.replaceChildren(tryThis(pair.steps.map((s, i) => ({
        label: t[i].label, hint: t[i].hint,
        run: () => applyView(pair, { look: s.look, h: s.helpers || {} }),
      })), { title: TEXT.l3.controls.tryTitle }));
    }

    // ===== panel B: answer, story, the two structures, numbers =====
    const measureStat = stat({ label: TEXT.l5.measure.title, value: TEXT.l5.measure.none, hint: TEXT.l5.measure.off });
    const labelsToggle = toggle({
      label: TEXT.l3.controls.labels, value: !!store.get().view.labels,
      onChange: (v) => {
        const view = store.get().view;
        store.set({ view: { ...view, labels: v } });
        viewer.setLabels(v);
      },
    });
    cleanup.push(store.subscribe((s) => { if (!!s.view.labels !== labelsToggle.get()) labelsToggle.set(!!s.view.labels); }));
    const measureToggle = toggle({
      label: TEXT.l5.measure.toggle, value: false,
      onChange: (v) => { measuring = v; syncTapMode(); viewer.clearHighlight(); viewer.measure.clear(); card.hide(); render(); },
    });

    const ans = answer({ kind: 'info', title: '', text: '' });
    const more = moreLink(layers);
    const ansBox = el('div', { class: 'cmp-block' }, ans.el, more);
    const storyBox = layers.gate(el('div'), 2, 2);
    const sidesBox = layers.gate(el('div', { class: 'cmp-cards' }), 3);
    const ideasBox = layers.gate(el('div', { class: 'cmp-block' }), 3);
    const noticeBox = layers.gate(el('div', { class: 'cmp-block' }), 3, 4);
    const pointsBox = layers.gate(el('div', { class: 'cmp-block' }), 5, 5);
    const helpersBox = layers.gate(el('div', { class: 'cmp-helpers' }), 3);
    const tilesBox = layers.gate(el('div', { class: 'cmp-block' }), 4);
    const glossBox = layers.gate(el('div', { class: 'cmp-block' }), 4, 4);
    const deepBox = layers.gate(el('div', { class: 'cmp-block' }), 5);
    panelB.append(el('div', { class: 'cmp-stack' }, ansBox, storyBox, sidesBox, helpersBox, tilesBox, glossBox, ideasBox, noticeBox, pointsBox, deepBox));

    const qualityLabel = (info) => TEXT.l4.tags[info.quality] || TEXT.l4.tags.reference;
    function buildAnswer(pair) {
      const a = TEXT.l1.answers[pair.id];
      ans.update({ kind: 'info', title: a.title, text: a.text });
    }

    // the story, rebuilt for the chosen pair
    let theStory = null;
    function buildStory(pair) {
      const views = STORY_VIEW[pair.id];
      const steps = TEXT.l2.pairs[pair.id].steps.map((s, i) => ({ ...s, run: () => applyView(pair, views[Math.min(i, views.length - 1)]) }));
      theStory = story(steps, { title: TEXT.l2.title });
      storyBox.replaceChildren(theStory.el);
    }

    function sideCard(which, pair) {
      const info = which === 'left' ? pair.left : rightInfo(pair);
      const sid = structureId(pair, which);
      const c = el('div', { class: 'cmp-card' },
        el('div', { class: 'cmp-card-head' }, el('div', { class: 'cmp-card-side', text: which === 'left' ? TEXT.l3.controls.left : TEXT.l3.controls.right }), infoButton(card, sid, { label: info.title })),
        el('div', { class: 'cmp-card-title', text: info.title }),
        el('div', { class: 'cmp-card-tag', text: info.tag }));
      // trust tag, from level 4 on
      const tag = layers.gate(el('div', { class: 'cmp-tags' }, el('span', { class: 'cmp-pill', text: qualityLabel(info) })), 4);
      c.append(tag);
      if (info.quality === 'schematic') {
        c.append(layers.gate(el('div', { class: 'cmp-card-tag', text: TEXT.l5.schematicNote }), 4));
      }
      return c;
    }
    function buildSides() {
      const pair = pairOf();
      sidesBox.replaceChildren(sideCard('left', pair), sideCard('right', pair));
    }
    function buildIdeas(pair) {
      ideasBox.replaceChildren(el('div', { class: 'cmp-label', text: TEXT.l3.controls.cards }),
        el('div', { class: 'cmp-chips' }, (IDEAS[pair.id] || []).map(([id, label]) => infoChip(card, id, label))));
    }
    function buildNotice(pair) {
      const t = TEXT.l3.pairs[pair.id];
      noticeBox.replaceChildren(
        el('div', { class: 'cmp-label', text: TEXT.l3.controls.noticeTitle }), el('ul', { class: 'cmp-list' }, t.notice.map((x) => el('li', { text: x }))),
        el('div', { class: 'cmp-label', text: TEXT.l3.controls.lifeTitle }), el('p', { class: 'simple-note', text: t.building }));
      pointsBox.replaceChildren(
        el('div', { class: 'cmp-label', text: TEXT.l5.pointsTitle }), el('ul', { class: 'cmp-list' }, pair.points.map((x) => el('li', { text: x }))),
        el('div', { class: 'cmp-label', text: TEXT.l3.controls.lifeTitle }), el('p', { class: 'simple-note', text: pair.buildingLink }));
    }
    function buildHelpers() {
      const pair = pairOf();
      helpersBox.replaceChildren(...pair.helpers.map((h) => toggle({
        label: h.label, value: helperOn(pair, h),
        onChange: (v) => { setHelpers(pair, { [h.key]: v }); render(); },
      }).el));
    }

    // level 4: the pair side by side, a row at a time
    function cellValue(row, v, which) {
      if (row.kind === 'text') return { us: row[which], si: null };
      if (v == null) return { us: TEXT.l4.none, si: null };
      if (row.kind === 'count') return { us: String(v), si: null };
      if (row.kind === 'gcc') { const d = dual.gcc(v, 2); return { us: d.us, si: d.si }; }
      if (row.kind === 'angstrom') { const d = dual.angstrom(v, 2); return { us: null, si: `${d.si} (${d.alt})` }; }
      if (typeof v === 'string') return { us: v, si: null };
      return { us: `${fmt(v, row.digits == null ? 0 : row.digits)}${row.unit ? ` ${row.unit}` : ''}`, si: null };
    }
    let tilesFor = null;
    function buildTiles() {
      if (!layers.is(4)) { tilesFor = null; return; }   // built when the level is reached (the liquid takes a moment)
      const pair = pairOf();
      const key = `${pair.id}:${variantOf(pair) ? variantOf(pair).id : ''}`;
      const L = getSide(pair, 'left').numbers; const R = getSide(pair, 'right').numbers;
      const li = pair.left; const ri = rightInfo(pair);
      const rows = TEXT.l4.pairs[pair.id].rows.map((row) => {
        const a = cellValue(row, L[row.id], 'left'); const b = cellValue(row, R[row.id], 'right');
        return el('div', { class: 'cmp-trow' },
          el('div', { class: 'cmp-trow-label', text: row.label }),
          el('div', { class: 'sl-tiles cmp-tiles-2' }, tile({ label: li.short, us: a.us, si: a.si }).el, tile({ label: ri.short, us: b.us, si: b.si }).el),
          el('div', { class: 'cmp-trow-compare', text: row.compare }));
      });
      tilesBox.replaceChildren(el('div', { class: 'cmp-label', text: TEXT.l4.title }), ...rows);
      tilesFor = key;
    }
    function buildGloss() {
      glossBox.replaceChildren(el('div', { class: 'cmp-label', text: 'Words' }),
        el('ul', { class: 'cmp-gloss' }, Object.entries(TEXT.l4.glosses).map(([k, v]) => el('li', { text: `${k.charAt(0).toUpperCase()}${k.slice(1)}: ${v}.` }))));
    }

    // level 5: the full table, the measuring tool, the sources
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
      const quality = (info) => (info.quality === 'schematic' ? TEXT.l5.qualitySchem : info.quality === 'approximate' ? TEXT.l5.qualityApprox : TEXT.l5.qualityRef);
      return el('div', { class: 'cmp-block' }, table, ...hints,
        note(`${li.short}: ${quality(li)}. ${li.source}.`), note(`${ri.short}: ${quality(ri)}. ${ri.source}`));
    }
    function buildDeep() {
      if (!layers.is(5)) { deepBox.replaceChildren(); return; }
      const pair = pairOf();
      deepBox.replaceChildren(
        el('div', { class: 'cmp-label', text: TEXT.l5.tableTitle }), numbersTable(pair),
        el('div', { class: 'cmp-tags' }, ...['reference', 'approximate', 'schematic'].map((k) => note(TEXT.l5.tags[k]))),
        measureToggle.el, measureStat.el, labelsToggle.el);
    }

    // ===== panel C: view controls and the atom key =====
    const legendBox = el('div');
    function buildLegend(pair) {
      const items = pair.look.legend.map((it) => ({ color: it.color || (ELEMENTS[it.el] ? ELEMENTS[it.el].color : '#999'), label: it.label }));
      legendBox.replaceChildren(section(TEXT.l3.controls.atoms, legend(items)));
    }
    panelC.append(el('div', { class: 'cmp-stack' }, el('div', { class: 'cmp-view' }, viewControls(store, viewer)), legendBox));

    // ===== choosing a pair =====
    function choosePair(id, { first = false } = {}) {
      const pair = PAIRS[id];
      if (!first) {
        setCmp({ pairId: id, look: 'both', touched: true });
        lookSeg.set('both');
        const view = store.get().view;
        if (pair.look.style && view.style !== pair.look.style) store.set({ view: { ...view, style: pair.look.style } });
        card.hide();
      }
      pairButtons.forEach((b, k) => b.setAttribute('aria-pressed', k === id ? 'true' : 'false'));
      choiceButtons.forEach((b, k) => b.setAttribute('aria-pressed', k === id ? 'true' : 'false'));
      q3.replaceChildren(question(TEXT.l3.pairs[id].sub));
      buildAnswer(pair); buildVariant(pair); buildTry(pair); buildLegend(pair);
      buildStory(pair); buildSides(); buildIdeas(pair); buildNotice(pair); buildHelpers(); buildTiles(); buildDeep();
      render({ reframe: true });
      if (!first && layers.is(2, 2) && theStory) theStory.go(0);
    }
    buildGloss();
    choosePair(cmp().pairId, { first: true });

    // ===== layers =====
    // level 1 and 2 keep both structures in view; level 1 turns slowly
    const syncSpin = () => viewer.setSpin(layers.is(1, 1) || (!!store.get().view.spin && !prefersReduced()));
    layers.gateFn((on) => {
      if (on && (cmp().look !== 'both')) { setCmp({ look: 'both' }); lookSeg.set('both'); render({ reframe: true }); }
      syncSpin();
    }, 1, 1);
    const syncTapMode = () => viewer.setTapMode(layers.is(5) && measuring ? 'measure' : 'info');
    layers.gateFn(() => syncTapMode(), 1, 5);
    let lastLevel = lv();
    cleanup.push(layers.onChange((now, was) => {
      card.hideHover();
      if (now < 5 && measuring) { measuring = false; measureToggle.set(false); viewer.measure.clear(); }
      if (now === 2 && was !== 2 && theStory) theStory.go(0);
      if (was === 2 && now >= 3 && cmp().look !== 'both') { setCmp({ look: 'both' }); lookSeg.set('both'); render({ reframe: true }); }
      if ((now <= 2) !== (was <= 2)) render();   // plain names below Explore, short names from Explore up
      else updateSummary();
      if (now >= 4) buildTiles();
      buildDeep();
      syncSpin(); syncTapMode();
      lastLevel = now;
    }));
    cleanup.push(store.subscribe((s, p) => { if (s.view.spin !== p.view.spin) syncSpin(); }));

    // ===== cards: hover (Mac) and tap (iPhone, iPad) on an atom or a bond =====
    const sideOfAtom = (index) => {
      const a = combined && combined.atoms[index];
      if (!a) return null;
      const m = String(a.tag || '').match(/^(left|right)(?::(.*))?$/);
      return m ? { side: m[1], tag: m[2] || '' } : null;
    };
    function cardFor(p) {
      if (!p || !p.kind) return null;
      const pair = pairOf();
      if (p.kind === 'atom') {
        const where = sideOfAtom(p.index);
        const sid = where ? structureId(pair, where.side) : null;
        const part = sid && getInfo(sid) ? { label: 'Part of', value: getInfo(sid).title } : null;
        const id = where && where.tag === 'interstitial' ? 'carbon-gap' : `el-${p.element}`;
        return { id, extra: part ? [part] : [] };
      }
      if (p.kind === 'bond') return { id: p.hbond ? 'hydrogen-link' : 'covalent-bond', extra: [] };
      return null;
    }
    cleanup.push(viewer.onHover((p) => {
      if (measuring) return;
      const c = cardFor(p);
      if (!c) { card.hideHover(); return; }
      card.show(c.id, { x: p.clientX, y: p.clientY, extra: c.extra });
    }));
    cleanup.push(viewer.onTapInfo((p) => {
      const c = cardFor(p);
      if (!c) { if (!card.isPinned()) card.hide(); return; }
      card.show(c.id, { pinned: true, x: p.clientX, y: p.clientY, extra: c.extra });
    }));

    // ===== tap to measure (level 5, Measure on) =====
    const offTap = stage.onTap(({ clientX, clientY }) => {
      if (!measuring || !layers.is(5)) return;
      const hit = viewer.pickAtom(clientX, clientY);
      if (!hit) { viewer.clearHighlight(); return; }
      const m = viewer.measure.add(hit.index);
      viewer.highlight([hit.index]);
      if (m.type === 'distance') measureStat.update({ value: m.value, digits: 2, unit: 'Å', hint: TEXT.l5.measure.distance });
      else if (m.type === 'angle') measureStat.update({ value: m.value, digits: 1, unit: '°', hint: TEXT.l5.measure.angle });
      else measureStat.update({ value: TEXT.l5.measure.none, unit: '', hint: TEXT.l5.measure.more });
    });
    cleanup.push(offTap);
  },
  unmount() {
    this._cleanup.splice(0).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  },
};
