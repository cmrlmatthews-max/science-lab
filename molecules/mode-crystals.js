// molecules/mode-crystals.js  Crystals mode ("How are the atoms stacked inside a solid?").
// Five information layers (shared/layers.js):
//   1 Start    the question, one plain answer, up to four picture choices, a slowly turning block of table salt. No digits.
//   2 Story    a guided story of six steps, each one sets the 3D view, with an "In your life" line.
//   3 Explore  the full crystal list, block size, the repeating block, the sliding layer, neighbors, "Try this". Tap or point at atoms for cards.
//   4 Numbers  stat tiles (touching neighbors, repeating block, how full the space is, density) with comparisons and trust tags.
//   5 Deep     stats, cell constants, Miller planes, a Measure tool, sources, switches.
// All words live in content-crystals.js. Mode default export: { id, label, panelTitles, mount(ctx), unmount() }.
//
// State lives in store.crystals { id, amount, nx, ny, nz, showCell, plane, showBonds, showBoundary }
// and store.view { style, labels, spin }, so it survives a switch to another mode and back.
// The level lives in store.level (shell). Numbers are computed live from lattice.js and crystal-data.js.

import { createViewer, viewControls } from './viewer.js';
import { el, toggle, slider, segmented, select, stat, stats, legend, section, sourceTag, button, row } from '../shared/ui.js';
import { question, answer, tryThis, note } from '../shared/simple.js';
import { story, tile, moreLink } from '../shared/layers.js';
import { infoChip, infoButton } from '../shared/card.js';
import { dual, nice } from '../shared/units.js';
import { CRYSTALS, CRYSTAL_ORDER, CRYSTAL_GROUPS } from './crystal-data.js';
import { ELEMENTS } from './elements.js';
import {
  buildBlock, cellVectors, planePolygon, neighbors, coordination, density, atomsPerCell, packingFraction,
} from './lattice.js';
import { TEXT, getInfo, elementId } from './content-crystals.js';

const L3 = TEXT.l3;
const L4 = TEXT.l4;
const L5 = TEXT.l5;

// Pure metals are drawn as bare metal by the viewer, so the legend uses the same display tints.
const METAL_TINT = { Fe: '#a79f98', Al: '#dde1e6', Cu: '#e08a57', Zn: '#a7aec6', Ti: '#aeb2ba', Mg: '#b9c9b4' };
const SHOW_AS = Object.entries(L3.showAs).map(([value, label]) => ({ value, label }));
const HCP_IDS = ['zn_hcp', 'ti_hcp', 'mg_hcp'];
const PATTERN_CARD = { fe_bcc: 'bcc', fe_fcc: 'fcc', al_fcc: 'fcc', cu_fcc: 'fcc', zn_hcp: 'hcp', ti_hcp: 'hcp', mg_hcp: 'hcp' };

// The first time this mode opens at level 1 it shows table salt, slowly turning.
let firstMount = true;

// ---------- small pure helpers ----------

// ---------- small pure helpers ----------

/** Cells per axis for a slider stop. Big cells (more than 8 atoms) stay small so atom counts stay low. */
function blockCounts(crystal, amount) {
  const big = atomsPerCell(crystal) > 8;
  let counts;
  if (big) counts = [[1, 1, 1], [2, 2, 1], [2, 2, 2]][amount];
  else { const n = amount + 1; counts = [n, n, n]; }
  return counts;
}

function plainOf(c) { return L3.crystals[c.id] || { name: c.short || c.name, tag: '', shape: c.lattice, text: '' }; }

/** First two neighbor shells for HCP metals, else the nearest shell counted from expect. */
function neighborCount(c) {
  const sh = c.expect.shells;
  return sh ? sh[0].n + sh[1].n : c.expect.coordination;
}

function neighborLine(c) {
  const n = c.expect.coordination;
  const N = L3.neighborLines;
  if (HCP_IDS.includes(c.id)) return N.hcp;
  if (N[c.id] && typeof N[c.id] === 'string') return N[c.id];
  if (c.id === 'nacl' || c.id === 'cscl') return N.otherKind(n);
  return N.generic(n);
}

function neighborShort(c) {
  return `${neighborCount(c)} neighbors`;
}

function whyList(c) {
  return c.facts.slice(0, 3);
}


const NB_CACHE = new Map();
/** Neighbor rule for a basis atom: cutoff distance, the only element counted (or null), and the full count in bulk. */
function shellRule(c, bi) {
  const key = `${c.id}:${bi}`;
  let r = NB_CACHE.get(key);
  if (r) return r;
  const elSym = c.basis[bi].el;
  const only = c.expect.neighborEl && elSym === c.expect.neighborEl ? c.expect.neighborEl : null;
  let list = neighbors(c, bi, 6);
  if (only) list = list.filter((n) => n.el === only);
  const d0 = list.length ? list[0].d : 0;
  const cut = c.expect.shells && c.basis[bi].el === c.basis[0].el ? c.expect.shells[1].d * 1.01 : d0 * 1.05;
  r = { cut, only, d0, count: list.filter((n) => n.d <= cut).length };
  NB_CACHE.set(key, r);
  return r;
}

/** Atoms of a block that touch atom i (nearest shell; both shells for HCP). */
function neighborsInBlock(c, atoms, i) {
  const a = atoms[i];
  const rule = shellRule(c, a.basisIndex);
  const out = [];
  for (let j = 0; j < atoms.length; j++) {
    if (j === i) continue;
    const b = atoms[j];
    if (rule.only && b.el !== rule.only) continue;
    const d = Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]);
    if (d <= rule.cut + 1e-6) out.push(j);
  }
  return out;
}

/** An atom near the middle of the block whose whole first shell is inside the block (or the best available). */
function pickCenterAtom(c, structure) {
  const atoms = structure.atoms;
  const defEl = c.expect.neighborEl || (c.expect.sites && c.expect.sites[0] && c.expect.sites[0].el) || c.basis[0].el;
  const cell = structure.cell;
  const mid = [0, 1, 2].map((k) => (cell.a[k] + cell.b[k] + cell.c[k]) / 2);
  let best = -1; let bestN = -1; let bestD = Infinity;
  atoms.forEach((a, i) => {
    if (a.el !== defEl || a._t === 'boundary') return;
    const rule = shellRule(c, a.basisIndex);
    const n = neighborsInBlock(c, atoms, i).length;
    const full = n >= rule.count ? 1 : 0;
    const score = full ? 1000 + n : n;
    const d = Math.hypot(a.pos[0] - mid[0], a.pos[1] - mid[1], a.pos[2] - mid[2]);
    if (score > bestN || (score === bestN && d < bestD - 1e-6)) { best = i; bestN = score; bestD = d; }
  });
  return best;
}

/** Sphere size so touching neighbors just touch in the "Packed" view. */
function packedOptions(c, structure) {
  const first = c.basis[0].el;
  if (c.group === 'metal' && ELEMENTS[first] && ELEMENTS[first].metallic) {
    const nearest = c.expect.shells ? c.expect.shells[0].d : c.expect.nearest;
    return { spaceRadius: 'metallic', radiusScale: nearest / 2 / ELEMENTS[first].metallic };
  }
  // Salts, covalent crystals, minerals and ice: one scale on the covalent radii so the closest bonded pair just touches.
  let scale = Infinity;
  const at = structure.atoms;
  for (const b of structure.bonds) {
    const A = at[b.a]; const B = at[b.b];
    const d = Math.hypot(A.pos[0] - B.pos[0], A.pos[1] - B.pos[1], A.pos[2] - B.pos[2]);
    const rc = (ELEMENTS[A.el].covalent || 1) + (ELEMENTS[B.el].covalent || 1);
    scale = Math.min(scale, d / rc);
  }
  if (!Number.isFinite(scale)) scale = 1;
  return { spaceRadius: 'covalent', radiusScale: Math.max(0.5, scale) };
}

/** The repeating polygon(s) for one plane inside a block. */
function planeShapes(c, p, counts, plain) {
  const unit = cellVectors(c.params);
  const poly = planePolygon(unit, p.hkl, p.d ?? 1);
  if (poly.length < 3) return [];
  const flat = p.hkl[0] === 0 && p.hkl[1] === 0;
  const cells = [];
  if (flat) {
    const k = Math.floor((counts[2] - 1) / 2);
    for (let i = 0; i < counts[0]; i++) for (let j = 0; j < counts[1]; j++) cells.push([i, j, k]);
  } else cells.push([0, 0, 0]);
  return cells.map((cell, n) => ({
    points: poly.map((q) => [0, 1, 2].map((ax) => q[ax] + cell[0] * unit.a[ax] + cell[1] * unit.b[ax] + cell[2] * unit.c[ax])),
    label: n === 0 ? plain : '',
  }));
}

const CSS = `
.xt-pick { display: flex; flex-direction: column; gap: 6px; }
.xt-pick-head { width: 100%; min-height: 52px; display: flex; align-items: center; gap: 10px; text-align: left; padding: 8px 12px; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--paper-2); color: var(--ink); font: inherit; cursor: pointer; }
.xt-pick-head:hover { border-color: var(--accent-edge); }
.xt-pick-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.xt-pick-name { font-size: 15px; font-weight: 600; }
.xt-pick-tag { font-size: 12.5px; color: var(--ink-2); }
.xt-pick-chev { flex: none; font-size: 12px; color: var(--ink-2); transition: transform .15s; }
.xt-pick-head[aria-expanded="true"] .xt-pick-chev { transform: rotate(180deg); }
.xt-list { display: flex; flex-direction: column; gap: 2px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper-2); padding: 4px; }
.xt-list[hidden] { display: none; }
.xt-group { margin: 8px 6px 2px; font-size: 12.5px; font-weight: 500; color: var(--ink-2); }
.xt-group:first-child { margin-top: 4px; }
.xt-row { width: 100%; min-height: 44px; display: flex; flex-direction: column; justify-content: center; gap: 0; text-align: left; padding: 5px 10px; border: 1px solid transparent; border-radius: var(--radius); background: transparent; color: var(--ink); font: inherit; cursor: pointer; }
.xt-row:hover { background: var(--paper-3); }
.xt-row[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent-edge); }
.xt-row:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.xt-row-name { font-size: 14.5px; font-weight: 600; }
.xt-row-tag { font-size: 12.5px; color: var(--ink-2); }
.xt-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.xt-choice { min-height: 60px; padding: 10px 12px; display: flex; align-items: center; justify-content: center; text-align: center; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--paper-2); color: var(--ink); font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; }
.xt-choice:hover { border-color: var(--accent-edge); }
.xt-choice[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); color: var(--ink); }
.xt-choice:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.xt-chip { display: inline-block; align-self: flex-start; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 10px; border: 1px solid var(--line-strong); color: var(--ink-2); background: var(--paper-3); }
.xt-why { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; line-height: 1.45; }
.xt-nb { display: flex; flex-direction: column; gap: 8px; }
.xt-nb-top { display: flex; align-items: flex-start; gap: 8px; }
.xt-nb-line { margin: 0; flex: 1 1 auto; font-size: 15px; line-height: 1.4; font-weight: 500; }
.xt-nb-status { margin: 0; font-size: 13px; color: var(--ink-2); line-height: 1.4; }
.xt-small { margin: 0; font-size: 12.5px; color: var(--ink-2); line-height: 1.45; }
.xt-kv { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; font-size: 13px; }
.xt-kv dt { color: var(--ink-2); }
.xt-kv dd { margin: 0; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.xt-showas .seg-btn { white-space: normal; line-height: 1.15; padding: 4px; font-size: 13px; }
.xt-showas .seg-btn:first-child { flex: 1.5 1 0; }
.xt-body { display: flex; flex-direction: column; gap: 14px; }
.xt-tog { display: flex; align-items: center; gap: 8px; }
.xt-tog > .toggle { flex: 1 1 auto; min-width: 0; }
.xt-chips { display: flex; flex-wrap: wrap; gap: 8px 6px; }
.xt-gloss { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 12.5px; line-height: 1.4; }
.xt-gloss dt { font-weight: 600; color: var(--ink); }
.xt-gloss dd { margin: 0; color: var(--ink-2); }
.xt-trust { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.xt-aboutrow { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; align-items: center; }
`;

export default {
  id: 'crystals',
  label: 'Crystals',
  panelTitles: { a: 'Material', b: 'What it is', c: 'View' },
  _cleanup: [],

  mount(ctx) {
    const { stage, panelA, panelB, panelC, summaryEl, store, layers, card, setPanelMin } = ctx;
    const cleanup = this._cleanup;
    let dead = false;

    // Panels B and C hold the explore, numbers and deep content; at levels 1 and 2 the 3D view is the hero.
    setPanelMin('b', 3);
    setPanelMin('c', 3);
    card.setSource(getInfo);

    const styleEl = document.createElement('style');
    styleEl.id = 'crystals-style';
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
    cleanup.push(() => styleEl.remove());

    const viewer = createViewer(stage);
    cleanup.push(() => { dead = true; viewer.dispose(); });
    viewer.setTapMode('info');

    // ---------- state ----------
    const cur = () => store.get().crystals;
    const crystalOf = () => CRYSTALS[cur().id] || CRYSTALS.fe_bcc;
    const setCr = (patch) => store.set({ crystals: { ...cur(), ...patch } });
    const setView = (patch) => store.set({ view: { ...store.get().view, ...patch } });
    const lvl = () => layers.level();

    (function ensureState() {
      let s = cur();
      let startSpin = false;
      if (firstMount) {
        firstMount = false;
        if (lvl() === 1) { s = { ...s, id: 'nacl', amount: 1, plane: null, showCell: true }; startSpin = true; }
      }
      const c = CRYSTALS[s.id] || CRYSTALS.fe_bcc;
      const amount = s.amount != null ? s.amount : Math.max(0, Math.min(2, (s.nx || 2) - 1));
      const counts = blockCounts(c, amount);
      store.set({
        crystals: {
          showCell: true, showBonds: true, plane: null, ...s,
          id: c.id, amount, nx: counts[0], ny: counts[1], nz: counts[2],
          showBoundary: s.showBoundary !== false, spin: startSpin || !!s.spin,
        },
      });
      // Blocks are easier to read when still, so spin stays off in the deeper levels unless the user turned it on.
      // At the start the table salt block turns slowly.
      if (!!store.get().view.spin !== !!store.get().crystals.spin) store.set({ view: { ...store.get().view, spin: !!store.get().crystals.spin } });
    }());

    // ---------- the built block (rebuilt only when the crystal or the amount changes) ----------
    let built = { key: '', structure: null, allBonds: [], counts: [1, 1, 1] };
    let nb = { on: false, center: -1, list: [] };
    let lastStyle = null;
    let planeFor = '';
    let measureOn = false;

    function ensureBuilt() {
      const s = cur();
      const c = crystalOf();
      const key = `${c.id}|${s.nx},${s.ny},${s.nz}`;
      if (built.key === key) return false;
      const structure = buildBlock(c, { nx: s.nx, ny: s.ny, nz: s.nz });
      structure.atoms.forEach((a) => { a._t = a.tag; });
      built = { key, structure, allBonds: structure.bonds, counts: [s.nx, s.ny, s.nz] };
      nb = { on: false, center: -1, list: [] };
      return true;
    }

    // ---------- 3D ----------
    function draw(reframe, styleOverride) {
      if (dead) return;
      const rebuilt = ensureBuilt();
      const s = cur();
      const c = crystalOf();
      const { structure } = built;
      const style = styleOverride || store.get().view.style || 'ball-stick';
      lastStyle = style;
      structure.bonds = s.showBonds ? built.allBonds : [];
      // fade: boundary copies can be hidden; in neighbor view everything except the chosen atom and its neighbors is faded
      const keep = nb.on ? new Set([nb.center, ...nb.list]) : null;
      structure.atoms.forEach((a, i) => {
        if (keep) a.tag = keep.has(i) ? undefined : 'dim';
        else a.tag = a._t;
      });
      const fade = { dim: 0.14 };
      if (!s.showBoundary) fade.boundary = 0;
      const opts = { style, fade };
      if (style === 'space-fill') Object.assign(opts, packedOptions(c, structure));
      viewer.setStructure(structure, opts);
      viewer.setCell(s.showCell ? structure.unitCell : null);
      drawPlanes();
      if (nb.on) viewer.highlight([nb.center, ...nb.list]); else viewer.clearHighlight();
      if (rebuilt) clearMeasureUi();
      packNote.textContent = style === 'space-fill' && c.group === 'ionic' ? L3.notesPacked : '';
      packNote.hidden = !packNote.textContent;
      if (reframe) viewer.frame();
    }

    function drawPlanes() {
      const s = cur();
      const c = crystalOf();
      const planes = c.planes || [];
      if (s.plane == null || !planes[s.plane]) { viewer.setPlanes([]); return; }
      const p = planes[s.plane];
      const plain = c.id === 'graphite' ? L3.sheetOne : L3.sheetPlain;
      const label = lvl() >= 5 ? p.label : plain;
      viewer.setPlanes(planeShapes(c, p, built.counts, label));
    }

    // ---------- panel A: question, answer, choices, story, then the Explore controls ----------
    const pickerHead = el('button', { type: 'button', class: 'xt-pick-head', 'aria-expanded': 'false', 'aria-label': L3.controls.crystal },
      el('span', { class: 'xt-pick-main' }, el('span', { class: 'xt-pick-name' }), el('span', { class: 'xt-pick-tag' })),
      el('span', { class: 'xt-pick-chev', 'aria-hidden': 'true', text: '▼' }));
    const pickerList = el('div', { class: 'xt-list', hidden: true, role: 'group', 'aria-label': 'Pick a material' });
    const rowBtns = {};
    for (const g of Object.keys(CRYSTAL_GROUPS)) {
      const ids = CRYSTAL_ORDER.filter((id) => CRYSTALS[id] && CRYSTALS[id].group === g);
      if (!ids.length) continue;
      pickerList.append(el('div', { class: 'xt-group', text: L3.groups[g] || CRYSTAL_GROUPS[g] }));
      for (const id of ids) {
        const p = plainOf(CRYSTALS[id]);
        const b = el('button', { type: 'button', class: 'xt-row', 'aria-pressed': 'false' },
          el('span', { class: 'xt-row-name', text: p.name }), el('span', { class: 'xt-row-tag', text: p.tag }));
        b.dataset.id = id;
        b.addEventListener('click', () => { chooseCrystal(id); setPickerOpen(false); });
        rowBtns[id] = b;
        pickerList.append(b);
      }
    }
    function setPickerOpen(open) {
      pickerList.hidden = !open;
      pickerHead.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    pickerHead.addEventListener('click', () => setPickerOpen(pickerList.hidden));
    function paintPicker() {
      const p = plainOf(crystalOf());
      pickerHead.querySelector('.xt-pick-name').textContent = p.name;
      pickerHead.querySelector('.xt-pick-tag').textContent = p.tag;
      for (const [id, b] of Object.entries(rowBtns)) b.setAttribute('aria-pressed', id === cur().id ? 'true' : 'false');
      for (const [id, b] of Object.entries(choiceBtns)) b.setAttribute('aria-pressed', id === cur().id ? 'true' : 'false');
    }

    // level 1 and 2: a few big choices
    const choiceBtns = {};
    const choices = el('div', { class: 'xt-choices', role: 'group', 'aria-label': 'Pick a material' });
    for (const ch of TEXT.l1.choices) {
      const b = el('button', { type: 'button', class: 'xt-choice', 'aria-pressed': 'false', text: ch.label });
      b.dataset.id = ch.id;
      b.addEventListener('click', () => chooseCrystal(ch.id, { amount: 1, style: 'ball-stick', plane: null }));
      choiceBtns[ch.id] = b;
      choices.append(b);
    }

    const amountSlider = slider({
      label: L3.controls.amount, min: 0, max: 2, step: 1, value: cur().amount,
      format: (v) => L3.amounts[v],
      onInput: (v) => setAmount(v),
    });
    const showAs = segmented({
      label: L3.controls.showAs, options: SHOW_AS, value: store.get().view.style || 'ball-stick',
      onChange: (v) => setView({ style: v }),
    });

    function setAmount(amount, quiet) {
      if (amount === cur().amount && built.key) return;
      const counts = blockCounts(crystalOf(), amount);
      setCr({ amount, nx: counts[0], ny: counts[1], nz: counts[2] });
      if (!quiet) { afterChange(true); }
    }

    function chooseCrystal(id, opts = {}) {
      const c = CRYSTALS[id];
      if (!c) return;
      const amount = opts.amount != null ? opts.amount : cur().amount;
      const counts = blockCounts(c, amount);
      const patch = { id, amount, nx: counts[0], ny: counts[1], nz: counts[2], plane: opts.plane != null ? opts.plane : null };
      if (opts.cell != null) patch.showCell = opts.cell;
      setCr(patch);
      if (opts.style && opts.style !== store.get().view.style) {
        // draw first with the new style, so the viewer does not refit on a stale structure
        draw(true, opts.style);
        store.set({ view: { ...store.get().view, style: opts.style } });
        paintAll();
      } else afterChange(true);
      if (opts.neighbors) {
        const idx = pickCenterAtom(c, built.structure);
        if (idx >= 0) setNeighbors(idx);
      }
    }

    const TRY_RUN = [
      () => chooseCrystal('fe_bcc', { amount: 0, style: 'ball-stick' }),
      () => chooseCrystal('fe_fcc', { amount: 0, style: 'ball-stick' }),
      () => chooseCrystal('cu_fcc', { amount: 2, style: 'space-fill' }),
      () => chooseCrystal('graphite', { amount: 1, style: 'ball-stick', plane: 0 }),
      () => chooseCrystal('nacl', { amount: 1, style: 'ball-stick', plane: 0 }),
    ];
    const tries = tryThis(L3.tries.map((t, i) => ({ ...t, run: TRY_RUN[i] })));

    const STORY_RUN = [
      () => chooseCrystal('nacl', { amount: 1, style: 'ball-stick', cell: false }),
      () => chooseCrystal('quartz', { amount: 1, style: 'ball-stick', cell: true }),
      () => chooseCrystal('nacl', { amount: 1, style: 'ball-stick', cell: true, plane: 0 }),
      () => chooseCrystal('cu_fcc', { amount: 1, style: 'ball-stick', cell: true, plane: 0 }),
      () => chooseCrystal('diamond', { amount: 1, style: 'ball-stick', cell: false, neighbors: true }),
      () => chooseCrystal('ice_ih', { amount: 1, style: 'ball-stick', cell: false }),
    ];
    const storyW = story(TEXT.l2.steps.map((s, i) => ({ ...s, run: STORY_RUN[i] })), { title: 'The story', autoRun: true });

    const ans = answer({ kind: 'info', title: '', text: '' });
    const aboutHost = el('div', { class: 'xt-aboutrow' });
    const ansBox = el('div', { class: 'xt-body', style: 'gap:8px' }, ans.el, layers.gate(aboutHost, 2), moreLink(layers));
    const tapNote = layers.gate(note(L3.tapOff), 1, 2);
    const pickBox = layers.gate(el('div', { class: 'xt-pick' }, pickerHead, pickerList), 3);

    panelA.append(
      question(TEXT.l1.question, TEXT.l1.sub),
      ansBox,
      layers.gate(storyW.el, 2, 2),
      layers.gate(choices, 1, 2),
      tapNote,
      pickBox,
      layers.gate(amountSlider.el, 3),
      layers.gate(el('div', { class: 'xt-showas' }, showAs.el), 3),
      layers.gate(tries, 3),
    );

    // ---------- panel B: explore, numbers, deep ----------
    // level 4 tiles
    const tNeighbors = tile({ label: L4.tiles.neighbors.label, us: '', compare: '', infoId: 'neighbors' });
    const tBlock = tile({ label: L4.tiles.block.label, us: null, si: '', compare: '', infoId: 'cell' });
    const tPack = tile({ label: L4.tiles.packing.label, us: '', compare: '', infoId: 'packing' });
    const tDens = tile({ label: L4.tiles.density.label, us: '', si: '', compare: '', infoId: 'density' });
    const tilesWrap = layers.gate(el('div', { class: 'sl-tiles' }, tNeighbors.el, tBlock.el, tPack.el, tDens.el), 4);
    const srcRow = row(el('span', { class: 'muted', text: L4.dataLabel }));
    const trustRow = layers.gate(el('div', { class: 'xt-trust' }, srcRow), 4);
    const glossBox = layers.gate(section(L4.glossTitle, el('dl', { class: 'xt-gloss' },
      ...Object.entries(L4.glosses).flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]))), 4, 4);

    // level 3 explore
    const nbLine = el('p', { class: 'xt-nb-line' });
    const nbStatus = el('p', { class: 'xt-nb-status' });
    const nbBtn = button({ label: L3.controls.neighbors, onClick: () => {
      if (nb.on) { nb = { on: false, center: -1, list: [] }; draw(false); paintNb(); return; }
      const idx = pickCenterAtom(crystalOf(), built.structure);
      if (idx >= 0) setNeighbors(idx);
    } });
    const nbBox = layers.gate(el('div', { class: 'xt-nb' },
      el('div', { class: 'xt-nb-top' }, nbLine, infoButton(card, 'neighbors', { label: 'touching neighbors' })), nbBtn, nbStatus), 3);

    const cellTog = toggle({ label: L3.controls.cell, value: cur().showCell, onChange: (v) => { setCr({ showCell: v }); draw(false); } });
    const planeTog = toggle({ label: L3.controls.plane, value: cur().plane != null, onChange: (v) => {
      setCr({ plane: v ? 0 : null });
      paintPlane();
      draw(false);
    } });
    const planeHint = el('p', { class: 'xt-small', text: L3.sheetPlain + '.' });
    const planeRow = el('div', { class: 'xt-tog' }, planeTog.el, infoButton(card, 'plane', { label: 'plane' }));
    const toggles = layers.gate(el('div', { class: 'xt-body', style: 'gap:6px' },
      el('div', { class: 'xt-tog' }, cellTog.el, infoButton(card, 'cell', { label: 'repeating block' })), planeRow, planeHint), 3);
    const packNote = el('p', { class: 'xt-small' });
    const iceNote = el('p', { class: 'xt-small', text: L3.iceNote });
    const notes3 = layers.gate(el('div', { class: 'xt-body', style: 'gap:6px' }, packNote, iceNote), 3);

    const ideaChips = el('div', { class: 'xt-chips' });
    const ideasBox = layers.gate(section(L3.ideasTitle, ideaChips), 3);
    const whyHost = el('ul', { class: 'xt-why' });
    const whyBox = layers.gate(section(L4.whyTitle, whyHost), 4);

    // level 5 deep
    const tNearest = stat({ label: L5.nearest, value: 0, unit: 'Å', digits: 3 });
    const tTouch = stat({ label: L5.touching, value: 0, digits: 0 });
    const tAtoms = stat({ label: L5.atomsInBlock, value: 0, digits: 0 });
    const tDrawn = stat({ label: L5.atomsDrawn, value: 0, digits: 0 });
    const kv = el('dl', { class: 'xt-kv' });
    const planePick = select({ label: L5.plane, options: [{ value: 'none', label: L5.planeNone }], value: 'none', onChange: (v) => {
      setCr({ plane: v === 'none' ? null : Number(v) });
      paintPlane();
      draw(false);
    } });
    const planeNote = el('p', { class: 'xt-small' });
    const measureStat = stat({ label: L5.measureTitle, value: L5.measureNone, hint: L5.measureHint });
    const clearBtn = button({ label: L5.clear, onClick: () => { viewer.measure.clear(); viewer.clearHighlight(); measureStat.update({ value: L5.measureNone, unit: '', hint: L5.measureHint }); if (nb.on) viewer.highlight([nb.center, ...nb.list]); } });
    const measureBody = el('div', { class: 'xt-body', style: 'gap:8px' }, measureStat.el, row(clearBtn));
    measureBody.hidden = true;
    const measureTog = toggle({ label: L5.measureToggle, value: false, onChange: (v) => {
      measureOn = v;
      measureBody.hidden = !v;
      if (!v) { clearMeasureUi(); if (!nb.on) viewer.clearHighlight(); }
      applyTapMode();
    } });
    const boundTog = toggle({ label: L5.boundary, value: cur().showBoundary, onChange: (v) => { setCr({ showBoundary: v }); draw(false); } });
    const bondTog = toggle({ label: L5.bonds, value: cur().showBonds, onChange: (v) => { setCr({ showBonds: v }); draw(false); } });
    const labelTog = toggle({ label: L5.labels, value: !!store.get().view.labels, onChange: (v) => { viewer.setLabels(v); setView({ labels: v }); } });
    const notesHost = el('div', { class: 'xt-body', style: 'gap:6px' });
    const deep = layers.gate(el('div', { class: 'xt-body' },
      stats(tNearest.el, tTouch.el, tAtoms.el, tDrawn.el),
      el('div', { class: 'xt-body', style: 'gap:6px' }, kv, el('div', { class: 'xt-chips' }, infoChip(card, 'lattice_constant', 'cell edges'))),
      el('div', { class: 'xt-body', style: 'gap:6px' }, planePick.el, planeNote, el('div', { class: 'xt-chips' }, infoChip(card, 'miller', 'Miller planes'))),
      section(L5.measureTitle, measureTog.el, measureBody),
      el('div', { class: 'xt-body', style: 'gap:6px' }, boundTog.el, bondTog.el, labelTog.el),
      notesHost,
      note(L5.unitNote)), 5);

    panelB.append(tilesWrap, trustRow, glossBox, nbBox, toggles, notes3, ideasBox, whyBox, deep);

    // ---------- panel C ----------
    const legendHost = el('div', {});
    panelC.append(
      viewControls(store, viewer),
      section('Atoms', legendHost),
      note(L3.notes[0]),
    );

    // ---------- painting the text that depends on the crystal ----------
    function clearMeasureUi() {
      viewer.measure.clear();
      measureStat.update({ value: L5.measureNone, unit: '', hint: L5.measureHint });
    }

    function applyTapMode() {
      const m = lvl() >= 5 && measureOn;
      viewer.setTapMode(m ? 'measure' : 'info');
      if (m) card.hide();
    }

    function paintAnswer() {
      const c = crystalOf();
      const p = plainOf(c);
      const l1 = TEXT.l1.answers[c.id];
      if (lvl() < 3 && l1) ans.update({ kind: 'info', title: l1.title, text: l1.text });
      else ans.update({ kind: 'info', title: p.name, text: p.text });
    }

    function paintSummary() {
      const c = crystalOf();
      const p = plainOf(c);
      const name = p.name.replace(' at room temperature', '').replace(' when red hot', ', hot');
      summaryEl.textContent = lvl() >= 4 ? `${name} · ${p.shape} · ${neighborShort(c)}` : `${name} · ${p.shape}`;
    }

    function paintNb() {
      const c = crystalOf();
      nbLine.textContent = neighborLine(c);
      nbBtn.textContent = nb.on ? L3.controls.neighborsOff : L3.controls.neighbors;
      if (!nb.on) { nbStatus.textContent = L3.tapHint; return; }
      const a = built.structure.atoms[nb.center];
      const rule = shellRule(c, a.basisIndex);
      nbStatus.textContent = nb.list.length >= rule.count ? L3.nbShown : L3.nbPartial;
    }

    function paintPlane() {
      const c = crystalOf();
      const planes = c.planes || [];
      const s = cur();
      planeRow.style.display = planes.length ? '' : 'none';
      planeHint.style.display = planes.length ? '' : 'none';
      planeTog.el.querySelector('.toggle-label').textContent = c.id === 'graphite' ? L3.controls.sheet : L3.controls.plane;
      planeHint.textContent = c.id === 'graphite' ? L3.sheetGraphite : L3.sheetPlain + '.';
      planeTog.set(s.plane != null && !!planes[s.plane]);
      if (planeFor !== c.id) {
        planePick.setOptions([{ value: 'none', label: L5.planeNone }, ...planes.map((p, i) => ({ value: String(i), label: p.label }))]);
        planeFor = c.id;
      }
      planePick.set(s.plane != null && planes[s.plane] ? String(s.plane) : 'none');
      const p = s.plane != null ? planes[s.plane] : null;
      planeNote.textContent = p ? p.note : (planes.length ? L5.planePick : L5.planeNoneDrawn);
      planePick.el.style.display = planes.length ? '' : 'none';
    }

    function paintIdeas() {
      const c = crystalOf();
      const ids = ['crystal', 'cell'];
      if (PATTERN_CARD[c.id]) ids.push(PATTERN_CARD[c.id]);
      ids.push('neighbors', 'packing', 'slip', 'cleavage', 'grain');
      const labels = { crystal: 'Crystal', cell: 'Repeating block', bcc: 'Body-centered cube', fcc: 'Face-centered cube', hcp: 'Hexagonal pattern', neighbors: 'Touching neighbors', packing: 'Packing', slip: 'Slip', cleavage: 'Cleavage', grain: 'Grain' };
      ideaChips.replaceChildren(...ids.map((id) => infoChip(card, id, labels[id])));
    }

    function paintAll() {
      const c = crystalOf();
      const p = plainOf(c);
      const s = cur();
      paintPicker();
      amountSlider.set(s.amount);
      paintAnswer();
      aboutHost.replaceChildren(infoChip(card, c.id, p.name));
      whyHost.replaceChildren(...whyList(c).map((t) => el('li', { text: t })));
      cellTog.set(s.showCell);
      boundTog.set(s.showBoundary);
      bondTog.set(s.showBonds);
      iceNote.hidden = c.id !== 'ice_ih';
      notesHost.replaceChildren();
      if (c.paramNote) notesHost.append(el('p', { class: 'xt-small', text: c.paramNote }));
      if (c.cellNote) notesHost.append(el('p', { class: 'xt-small', text: c.cellNote }));
      paintPlane();
      paintNumbers();
      paintNb();
      paintIdeas();
      legendHost.replaceChildren(legend(Array.from(new Set(c.basis.map((b) => b.el))).map((sym) => ({ color: (c.group === 'metal' && METAL_TINT[sym]) || ELEMENTS[sym].color, label: ELEMENTS[sym].name }))));
      paintSummary();
    }

    function paintNumbers() {
      const c = crystalOf();
      const e = c.expect;
      const rho = density(c);
      const P = c.params;

      // level 4 tiles, each value in US units first, then metric, with one everyday comparison
      const n = neighborCount(c);
      tNeighbors.update({
        us: e.shells ? `${n}` : String(n), si: null,
        compare: L4.tiles.neighbors.compare(n) + (e.shells ? ` ${L4.shellsNote}` : ''),
      });
      const ang = dual.angstrom(P.a);
      tBlock.update({
        us: null, si: ang.si,
        compare: `${ang.alt}. ${L4.tiles.block.compare}${P.c !== P.a ? ` Its other edge is ${nice(P.c)} Å.` : ''}`,
      });
      const pf = packingFraction(c);
      tPack.el.style.display = pf == null ? 'none' : '';
      if (pf != null) tPack.update({ us: `${Math.round(pf * 100)}%`, si: null, compare: L4.tiles.packing.compare(pf * 100) });
      const rd = dual.gcc(rho);
      tDens.update({ us: rd.us, si: rd.si, compare: L4.tiles.density.perCrystal[c.id] || L4.tiles.density.compare });

      // level 5 deep numbers (same values as before this pass)
      let nearest; let touching;
      if (e.neighborEl) {
        const list = neighbors(c, 0, 6).filter((x) => x.el === e.neighborEl);
        nearest = list[0].d; touching = list.filter((x) => x.d <= nearest * (1 + (e.coordinationTol ?? 0.08))).length;
      } else {
        const co = coordination(c, 0, e.coordinationTol ?? 0.08);
        nearest = co.distance; touching = co.number;
      }
      tNearest.update({ value: nearest, digits: 3, source: c.source });
      tTouch.update({
        value: e.shells ? `${e.shells[0].n} + ${e.shells[1].n}` : touching,
        digits: 0,
        hint: e.shells ? L4.shellsNote : (e.sites && e.sites.length > 1 ? e.sites.map((x) => `${x.el}: ${x.coordination}`).join(', ') : ''),
      });
      tAtoms.update({ value: atomsPerCell(c), digits: 0, hint: e.formulaUnits ? L5.formulaUnits(e.formulaUnits) : '' });
      tDrawn.update({ value: built.structure ? built.structure.atoms.length : 0, digits: 0 });
      const rows = [
        [L5.pattern, c.lattice],
        [L5.system, c.system],
        [L5.edges, `${P.a} ${P.b} ${P.c} Å`],
        [L5.angles, `${P.alpha}° ${P.beta}° ${P.gamma}°`],
        [`${L5.density} (computed)`, `${rho.toFixed(3)} g/cm³`],
        [`${L5.density} (reference)`, `${e.density.toFixed(3)} g/cm³`],
      ];
      if (pf != null) rows.push([L5.packing, `${(pf * 100).toFixed(1)}%`]);
      kv.replaceChildren(...rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: String(v) })]));
      srcRow.replaceChildren(el('span', { class: 'muted', text: L4.dataLabel }), sourceTag(c.source), el('span', { class: 'xt-small', text: L4.trust[c.quality] || L4.trust.reference }));
    }

    function setNeighbors(idx) {
      const c = crystalOf();
      let center = idx;
      const atoms = built.structure.atoms;
      // in ice a tap on a hydrogen picks the oxygen of its molecule
      if (c.expect.neighborEl && atoms[idx].el !== c.expect.neighborEl) {
        let bd = Infinity;
        atoms.forEach((a, j) => {
          if (a.el !== c.expect.neighborEl) return;
          const d = Math.hypot(a.pos[0] - atoms[idx].pos[0], a.pos[1] - atoms[idx].pos[1], a.pos[2] - atoms[idx].pos[2]);
          if (d < bd) { bd = d; center = j; }
        });
      }
      nb = { on: true, center, list: neighborsInBlock(c, atoms, center) };
      draw(false);
      paintNb();
    }

    // unified "something changed" path for crystal or amount changes
    function afterChange(reframe) {
      draw(reframe);
      paintAll();
    }

    // ---------- cards: point at an atom or a stick (wide screens), tap (phone, tablet) ----------
    function atomExtra(p) {
      if (lvl() < 4) return undefined;
      try {
        const a = built.structure.atoms[p.index];
        return [{ label: L5.touching, value: String(shellRule(crystalOf(), a.basisIndex).count) }];
      } catch (e) { return undefined; }
    }
    const cardIdOf = (p) => (p.kind === 'atom' ? elementId(p.element) : (p.hbond ? 'hbond' : 'bond'));
    const offHover = viewer.onHover((p) => {
      if (dead) return;
      if (viewer.tapMode === 'measure' || !p.kind) { card.hideHover(); return; }
      if (card.isPinned()) return;
      card.show(cardIdOf(p), { x: p.clientX, y: p.clientY, extra: p.kind === 'atom' ? atomExtra(p) : undefined });
    });
    cleanup.push(offHover);
    const offTapInfo = viewer.onTapInfo((p) => {
      if (dead) return;
      if (!p.kind) {
        card.hide();
        if (nb.on) { nb = { on: false, center: -1, list: [] }; draw(false); paintNb(); }
        return;
      }
      card.show(cardIdOf(p), { x: p.clientX, y: p.clientY, pinned: true, extra: p.kind === 'atom' ? atomExtra(p) : undefined });
      if (p.kind === 'atom' && lvl() >= 3) setNeighbors(p.index);
    });
    cleanup.push(offTapInfo);

    // measuring (level 5, Measure switch on)
    const offTap = stage.onTap(({ clientX, clientY }) => {
      if (dead || viewer.tapMode !== 'measure') return;
      const hit = viewer.pickAtom(clientX, clientY);
      if (!hit) return;
      const m = viewer.measure.add(hit.index);
      if (m.type === 'distance') measureStat.update({ value: m.value, digits: 2, unit: 'Å', hint: L5.measureDistance });
      else if (m.type === 'angle') measureStat.update({ value: m.value, digits: 1, unit: '°', hint: L5.measureAngle });
      else measureStat.update({ value: L5.measureNone, unit: '', hint: L5.measureOne });
    });
    cleanup.push(offTap);

    // ---------- a level change repaints the words and the plane label, and picks the tap mode ----------
    const offLevel = layers.onChange(() => {
      if (dead) return;
      if (lvl() < 5 && measureOn) { measureOn = false; measureTog.set(false); measureBody.hidden = true; clearMeasureUi(); if (!nb.on) viewer.clearHighlight(); }
      paintAnswer();
      paintSummary();
      drawPlanes();
      applyTapMode();
    });
    cleanup.push(offLevel);

    // ---------- keep controls in step with the store (style changes made in panel C) ----------
    const unsub = store.subscribe((s) => {
      if (dead) return;
      const v = s.view || {};
      if (v.style && showAs.get() !== v.style) showAs.set(v.style);
      if (v.style && v.style !== lastStyle) draw(false);
      if (v.labels != null && !!v.labels !== labelTog.get()) labelTog.set(!!v.labels);
      if (v.spin != null && !!v.spin !== !!s.crystals.spin) setCr({ spin: !!v.spin });
    });
    cleanup.push(unsub);

    // ---------- first draw ----------
    draw(true);
    paintAll();
  },

  unmount() {
    this._cleanup.splice(0).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  },
};
