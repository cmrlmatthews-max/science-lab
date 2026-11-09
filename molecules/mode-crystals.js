// molecules/mode-crystals.js  Crystals mode ("How are the atoms stacked inside a solid?").
// Simple-first pattern (shared/simple.js): one question, three controls, one plain answer, "Try this" steps,
// and a "Show numbers" switch that hides the technical tiles until asked.
// Mode default export: { id, label, panelTitles, mount(ctx), unmount() }.
//
// State lives in store.crystals { id, amount, nx, ny, nz, showCell, plane, showBonds, showBoundary, showNumbers }
// and store.view { style, labels, spin }, so it survives a switch to another mode and back.
// Numbers under "Show numbers" are computed live from lattice.js and crystal-data.js.

import { createViewer, viewControls } from './viewer.js';
import { el, toggle, slider, segmented, select, stat, stats, legend, section, sourceTag, button, row } from '../shared/ui.js';
import { question, answer, tryThis, numbersSwitch, note } from '../shared/simple.js';
import { CRYSTALS, CRYSTAL_ORDER, CRYSTAL_GROUPS } from './crystal-data.js';
import { ELEMENTS } from './elements.js';
import {
  buildBlock, cellVectors, planePolygon, neighbors, coordination, density, atomsPerCell, packingFraction,
} from './lattice.js';

// ---------- plain words, one entry per crystal ----------
// name: plain name. tag: one plain line in the picker. shape: short picture for the one-line summary.
// text: one or two plain sentences for the answer. why: facts to show (index into crystal.facts, or a plain string).
const PLAIN = {
  fe_bcc: {
    name: 'Iron at room temperature', tag: 'Structural steel at room temperature', shape: 'cube with a center atom',
    text: 'Iron atoms sit at the corners of a cube with one more in the middle. This open stacking makes room-temperature steel strong but less easy to bend than copper.',
    why: ['Steel is mostly iron. At room temperature the atoms sit in this cube-with-a-center pattern.', 'The gaps between the atoms are small, so very little carbon can hide inside.', 'Heating steel changes the stacking, and that is the basis of heat treatment.'],
  },
  fe_fcc: {
    name: 'Iron when it is red hot', tag: 'Steel when it is red hot', shape: 'cube with face atoms',
    text: 'When iron gets very hot the atoms rearrange. Now one atom sits at each corner and one on every face, so there is more room between the atoms for carbon.',
    why: ['The gaps between the atoms are bigger here, so much more carbon can dissolve in the iron.', 3],
  },
  al_fcc: {
    name: 'Aluminum', tag: 'Window frames and cladding', shape: 'cube with face atoms',
    text: 'Aluminum atoms sit at each corner and on each face of a cube. Layers of atoms slide past each other easily, so aluminum is soft and easy to shape.',
    why: [2, 'Aluminum is soft, so it can be pushed through a die into long window frame shapes.'],
  },
  cu_fcc: {
    name: 'Copper', tag: 'Wiring and roofing', shape: 'cube with face atoms',
    text: 'Copper atoms sit at each corner and on each face of a cube, packed as tightly as equal balls can be. Layers slide easily, so copper can be drawn into wire.',
    why: ['Layers of atoms slide easily, so copper can be drawn into thin wire and rolled into sheet.', 2, 3],
  },
  zn_hcp: {
    name: 'Zinc', tag: 'The coating on galvanized steel', shape: 'stacked flat layers',
    text: 'Zinc atoms form flat layers, and each layer rests in the dips of the one below. The layers sit a little farther apart than in an ideal stack.',
    why: [1],
  },
  ti_hcp: {
    name: 'Titanium', tag: 'Light, strong cladding and roofing', shape: 'stacked flat layers',
    text: 'Titanium atoms form tight flat layers, and each layer rests in the dips of the one below, like oranges in a crate.',
    why: [1],
  },
  mg_hcp: {
    name: 'Magnesium', tag: 'The lightest common metal', shape: 'stacked flat layers',
    text: 'Magnesium atoms form tight flat layers, and each layer rests in the dips of the one below, like oranges in a crate.',
    why: [1],
  },
  nacl: {
    name: 'Table salt', tag: 'Road salt', shape: 'checkerboard of two kinds of atoms',
    text: 'Sodium and chlorine alternate in every direction, like a checkerboard in three dimensions. Opposite charges hold them together, so the crystal is hard but brittle.',
    why: [1, 2, 3],
  },
  cscl: {
    name: 'Cesium chloride', tag: 'A salt that stacks differently', shape: 'cube with a different atom in the middle',
    text: 'A big cesium atom sits in the middle of a cube of chlorine atoms. More neighbors fit around it than in table salt.',
    why: [1, 2],
  },
  diamond: {
    name: 'Diamond', tag: 'The hardest natural material', shape: 'linked four-sided pyramids',
    text: 'Every carbon atom holds four others, pointing to the corners of a small pyramid. Strong bonds in every direction make diamond the hardest natural material.',
    why: [1, 2],
  },
  silicon: {
    name: 'Silicon', tag: 'Solar cells and chips', shape: 'linked four-sided pyramids',
    text: 'Silicon is stacked the same way as diamond. Every atom holds four others. Thin slices of this crystal are the base of solar cells and chips.',
    why: [1, 2],
  },
  graphite: {
    name: 'Graphite', tag: 'Pencil lead. Slippery layers.', shape: 'flat sheets',
    text: 'Carbon atoms form flat sheets of six-sided rings. The bonds inside a sheet are strong, but the sheets are held weakly, so they slide. That is why a pencil writes.',
    why: [1, 2, 3],
  },
  ice_ih: {
    name: 'Ice', tag: 'Frozen water', shape: 'open rings of six',
    text: 'Water molecules link into open rings of six, like a cage. The empty space makes ice lighter than water, so ice floats and water expands when it freezes.',
    why: [1, 2],
  },
  quartz: {
    name: 'Quartz', tag: 'Sand. The ordered form of glass.', shape: 'spirals of linked pyramids',
    text: 'Each silicon atom sits in a small pyramid of four oxygen atoms, and neighboring pyramids share corners in a spiral. Quartz is what sand is made of.',
    why: [1, 2, 3],
  },
  calcite: {
    name: 'Calcite', tag: 'Limestone and marble', shape: 'flat triangles and calcium layers',
    text: 'Each carbon atom sits in a flat triangle of three oxygen atoms, and these triangles alternate with calcium atoms in layers. This is the mineral of limestone and marble.',
    why: [1, 2, 3],
  },
};

const AMOUNTS = ['One block', 'A few blocks', 'A chunk'];
const MAX_ATOMS = 1500;
const SHOW_AS = [
  { value: 'ball-stick', label: 'Balls and sticks' },
  { value: 'space-fill', label: 'Packed' },
  { value: 'sticks', label: 'Sticks' },
];
const SHEET_PLAIN = 'Atoms slide along sheets like this';

// ---------- small pure helpers ----------

/** Cells per axis for a slider stop. Big cells (more than 8 atoms) stay small so atom counts stay low. */
function blockCounts(crystal, amount) {
  const big = atomsPerCell(crystal) > 8;
  let counts;
  if (big) counts = [[1, 1, 1], [2, 2, 1], [2, 2, 2]][amount];
  else { const n = amount + 1; counts = [n, n, n]; }
  return counts;
}

function plainOf(c) { return PLAIN[c.id] || { name: c.short || c.name, tag: '', shape: c.lattice, text: '', why: [] }; }

/** First two neighbor shells for HCP metals, else the nearest shell counted from expect. */
function neighborCount(c) {
  const sh = c.expect.shells;
  return sh ? sh[0].n + sh[1].n : c.expect.coordination;
}

function neighborLine(c) {
  const n = c.expect.coordination;
  switch (c.id) {
    case 'zn_hcp': case 'ti_hcp': case 'mg_hcp': return 'Each atom touches 12 neighbors, six of them a little closer.';
    case 'ice_ih': return 'Each water molecule holds four others.';
    case 'quartz': return 'Each silicon holds four oxygens.';
    case 'calcite': return 'Each calcium holds six oxygens. Each carbon holds three.';
    case 'graphite': return `Each carbon touches ${n} neighbors in its sheet.`;
    case 'nacl': case 'cscl': return `Each atom touches ${n} neighbors of the other kind.`;
    default: return `Each atom touches ${n} neighbors.`;
  }
}

function neighborShort(c) {
  if (c.id === 'ice_ih') return '4 neighbors';
  if (c.id === 'quartz') return '4 neighbors';
  if (c.id === 'calcite') return '6 neighbors';
  return `${neighborCount(c)} neighbors`;
}

function whyList(c) {
  const p = plainOf(c);
  const out = [];
  for (const w of p.why) {
    const t = typeof w === 'number' ? c.facts[w] : w;
    if (t && out.length < 3) out.push(t);
  }
  return out;
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
.xt-group { margin: 8px 6px 2px; font-size: 11.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-2); }
.xt-group:first-child { margin-top: 4px; }
.xt-row { width: 100%; min-height: 44px; display: flex; flex-direction: column; justify-content: center; gap: 0; text-align: left; padding: 5px 10px; border: 1px solid transparent; border-radius: var(--radius); background: transparent; color: var(--ink); font: inherit; cursor: pointer; }
.xt-row:hover { background: var(--paper-3); }
.xt-row[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent-edge); }
.xt-row:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.xt-row-name { font-size: 14.5px; font-weight: 600; }
.xt-row-tag { font-size: 12.5px; color: var(--ink-2); }
.xt-chip { display: inline-block; align-self: flex-start; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 10px; border: 1px solid var(--line-strong); color: var(--ink-2); background: var(--paper-3); }
.xt-why { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; line-height: 1.45; }
.xt-nb { display: flex; flex-direction: column; gap: 8px; }
.xt-nb-line { margin: 0; font-size: 15px; line-height: 1.4; font-weight: 500; }
.xt-nb-status { margin: 0; font-size: 13px; color: var(--ink-2); line-height: 1.4; }
.xt-small { margin: 0; font-size: 12.5px; color: var(--ink-2); line-height: 1.45; }
.xt-kv { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; font-size: 13px; }
.xt-kv dt { color: var(--ink-2); }
.xt-kv dd { margin: 0; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.xt-showas .seg-btn { white-space: normal; line-height: 1.15; padding: 4px; font-size: 13px; }
.xt-showas .seg-btn:first-child { flex: 1.5 1 0; }
.xt-body { display: flex; flex-direction: column; gap: 14px; }
`;

export default {
  id: 'crystals',
  label: 'Crystals',
  panelTitles: { a: 'Material', b: 'What it is', c: 'View' },
  _cleanup: [],

  mount(ctx) {
    const { stage, panelA, panelB, panelC, summaryEl, store } = ctx;
    const cleanup = this._cleanup;
    let dead = false;

    const styleEl = document.createElement('style');
    styleEl.id = 'crystals-style';
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
    cleanup.push(() => styleEl.remove());

    const viewer = createViewer(stage);
    cleanup.push(() => { dead = true; viewer.dispose(); });

    // ---------- state ----------
    const cur = () => store.get().crystals;
    const crystalOf = () => CRYSTALS[cur().id] || CRYSTALS.fe_bcc;
    const setCr = (patch) => store.set({ crystals: { ...cur(), ...patch } });
    const setView = (patch) => store.set({ view: { ...store.get().view, ...patch } });

    (function ensureState() {
      const s = cur();
      const c = CRYSTALS[s.id] || CRYSTALS.fe_bcc;
      const amount = s.amount != null ? s.amount : Math.max(0, Math.min(2, (s.nx || 2) - 1));
      const counts = blockCounts(c, amount);
      store.set({
        crystals: {
          showCell: true, showBonds: true, plane: null, ...s,
          id: c.id, amount, nx: counts[0], ny: counts[1], nz: counts[2],
          showBoundary: s.showBoundary !== false, showNumbers: !!s.showNumbers,
        },
      });
    }());

    // ---------- the built block (rebuilt only when the crystal or the amount changes) ----------
    let built = { key: '', structure: null, allBonds: [], counts: [1, 1, 1] };
    let nb = { on: false, center: -1, list: [] };
    let lastStyle = null;
    let planeFor = '';

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
      if (rebuilt) { measureStat.update({ value: 'None', unit: '', hint: MEASURE_HINT }); }
      packNote.textContent = style === 'space-fill' && c.group === 'ionic'
        ? 'The two kinds of atom are drawn so that unlike neighbors just touch. Their real sizes differ from what is shown.'
        : '';
      packNote.style.display = packNote.textContent ? '' : 'none';
      if (reframe) viewer.frame();
    }

    function drawPlanes() {
      const s = cur();
      const c = crystalOf();
      const planes = c.planes || [];
      if (s.plane == null || !planes[s.plane]) { viewer.setPlanes([]); return; }
      const p = planes[s.plane];
      const plain = c.id === 'graphite' ? 'One sheet' : SHEET_PLAIN;
      const label = s.showNumbers ? p.label : plain;
      viewer.setPlanes(planeShapes(c, p, built.counts, label));
    }

    // ---------- panel A: the question and three controls ----------
    const pickerHead = el('button', { type: 'button', class: 'xt-pick-head', 'aria-expanded': 'false', 'aria-label': 'Material' },
      el('span', { class: 'xt-pick-main' }, el('span', { class: 'xt-pick-name' }), el('span', { class: 'xt-pick-tag' })),
      el('span', { class: 'xt-pick-chev', 'aria-hidden': 'true', text: '▼' }));
    const pickerList = el('div', { class: 'xt-list', hidden: true, role: 'group', 'aria-label': 'Pick a material' });
    const rowBtns = {};
    for (const g of Object.keys(CRYSTAL_GROUPS)) {
      const ids = CRYSTAL_ORDER.filter((id) => CRYSTALS[id] && CRYSTALS[id].group === g);
      if (!ids.length) continue;
      pickerList.append(el('div', { class: 'xt-group', text: CRYSTAL_GROUPS[g] }));
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
    }

    const amountSlider = slider({
      label: 'How much to show', min: 0, max: 2, step: 1, value: cur().amount,
      format: (v) => AMOUNTS[v],
      onInput: (v) => setAmount(v),
    });
    const showAs = segmented({
      label: 'Show as', options: SHOW_AS, value: store.get().view.style || 'ball-stick',
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
      setCr({ id, amount, nx: counts[0], ny: counts[1], nz: counts[2], plane: opts.plane != null ? opts.plane : null });
      if (opts.style && opts.style !== store.get().view.style) {
        // draw first with the new style, so the viewer does not refit on a stale structure
        draw(true, opts.style);
        store.set({ view: { ...store.get().view, style: opts.style } });
        paintAll();
      } else afterChange(true);
    }

    const steps = tryThis([
      { label: 'Iron at room temperature', hint: 'One atom sits in the middle of each cube.', run: () => chooseCrystal('fe_bcc', { amount: 0, style: 'ball-stick' }) },
      { label: 'Iron when it is red hot', hint: 'The atoms rearrange. Now one sits on each face.', run: () => chooseCrystal('fe_fcc', { amount: 0, style: 'ball-stick' }) },
      { label: 'See how tightly it packs', hint: 'Each atom touches twelve others.', run: () => chooseCrystal('cu_fcc', { amount: 2, style: 'space-fill' }) },
      { label: 'Why pencils write', hint: 'Strong sheets, weakly stacked. They slide.', run: () => chooseCrystal('graphite', { amount: 1, style: 'ball-stick', plane: 0 }) },
    ]);

    panelA.append(
      question('How are the atoms stacked inside a solid?', 'Pick a material. The same small block repeats over and over.'),
      el('div', { class: 'xt-pick' }, pickerHead, pickerList),
      amountSlider.el,
      el('div', { class: 'xt-showas' }, showAs.el),
      steps,
    );

    // ---------- panel B: what it is ----------
    const ans = answer({ kind: 'info', title: '', text: '' });
    const chipHost = el('div', {});
    const nbLine = el('p', { class: 'xt-nb-line' });
    const nbStatus = el('p', { class: 'xt-nb-status' });
    const nbBtn = button({ label: 'Show one atom\'s neighbors', onClick: () => {
      if (nb.on) { nb = { on: false, center: -1, list: [] }; draw(false); paintNb(); return; }
      const idx = pickCenterAtom(crystalOf(), built.structure);
      if (idx >= 0) setNeighbors(idx);
    } });
    const nbBox = el('div', { class: 'xt-nb' }, nbLine, nbBtn, nbStatus);
    const whyHost = el('ul', { class: 'xt-why' });
    const whyBox = section('Why it matters in a building', whyHost);

    const cellTog = toggle({ label: 'Show the repeating block', value: cur().showCell, onChange: (v) => { setCr({ showCell: v }); draw(false); } });
    const planeTog = toggle({ label: 'Show the sliding layer', value: cur().plane != null, onChange: (v) => {
      setCr({ plane: v ? 0 : null });
      paintPlane();
      draw(false);
    } });
    const planeHint = el('p', { class: 'xt-small', text: SHEET_PLAIN + '.' });
    const toggles = el('div', { class: 'xt-body', style: 'gap:6px' }, cellTog.el, planeTog.el, planeHint);
    const notesHost = el('div', { class: 'xt-body', style: 'gap:6px' });
    const packNote = el('p', { class: 'xt-small' });

    // numbers area
    const tDensity = stat({ label: 'Density', value: 0, unit: 'g/cm³', digits: 3 });
    const tNearest = stat({ label: 'Nearest neighbor distance', value: 0, unit: 'Å', digits: 3 });
    const tTouch = stat({ label: 'Touching neighbors', value: 0, digits: 0 });
    const tAtoms = stat({ label: 'Atoms in the repeating block', value: 0, digits: 0 });
    const tDrawn = stat({ label: 'Atoms drawn', value: 0, digits: 0 });
    const tPack = stat({ label: 'Space filled', value: 0, unit: '%', digits: 1 });
    const kv = el('dl', { class: 'xt-kv' });
    const planePick = select({ label: 'Plane', options: [{ value: 'none', label: 'None' }], value: 'none', onChange: (v) => {
      setCr({ plane: v === 'none' ? null : Number(v) });
      paintPlane();
      draw(false);
    } });
    const planeNote = el('p', { class: 'xt-small' });
    const measureStat = stat({ label: 'Measurement', value: 'None', hint: '' });
    const MEASURE_HINT = 'Tap two atoms to measure a distance. Tap a third for the angle.';
    measureStat.update({ hint: MEASURE_HINT });
    const clearBtn = button({ label: 'Clear', onClick: () => { viewer.measure.clear(); viewer.clearHighlight(); measureStat.update({ value: 'None', unit: '', hint: MEASURE_HINT }); if (nb.on) viewer.highlight([nb.center, ...nb.list]); } });
    const boundTog = toggle({ label: 'Show shared corner atoms', value: cur().showBoundary, onChange: (v) => { setCr({ showBoundary: v }); draw(false); } });
    const bondTog = toggle({ label: 'Show sticks between atoms', value: cur().showBonds, onChange: (v) => { setCr({ showBonds: v }); draw(false); } });
    const labelTog = toggle({ label: 'Show element labels', value: !!store.get().view.labels, onChange: (v) => { viewer.setLabels(v); setView({ labels: v }); } });
    const srcRow = row(el('span', { class: 'muted', text: 'Data' }));

    const numbers = numbersSwitch({
      label: 'Show numbers', value: cur().showNumbers,
      onChange: (v) => {
        setCr({ showNumbers: v });
        if (!v) { viewer.measure.clear(); measureStat.update({ value: 'None', unit: '', hint: MEASURE_HINT }); if (!nb.on) viewer.clearHighlight(); }
        paintPlane();
        drawPlanes();
      },
    },
    stats(tDensity.el, tNearest.el, tTouch.el, tAtoms.el, tDrawn.el, tPack.el),
    kv,
    el('div', { class: 'xt-body', style: 'gap:6px' }, planePick.el, planeNote),
    section('Measure', measureStat.el, row(clearBtn)),
    el('div', { class: 'xt-body', style: 'gap:6px' }, boundTog.el, bondTog.el, labelTog.el),
    note('1 Å = 0.1 nanometer'),
    srcRow);

    panelB.append(ans.el, chipHost, nbBox, whyBox, toggles, packNote, notesHost, numbers.el);

    // ---------- panel C ----------
    const legendHost = el('div', {});
    panelC.append(
      viewControls(store, viewer),
      section('Atoms', legendHost),
      note('Drag to turn the block. Pinch or scroll to zoom. Tap an atom to see what touches it.'),
    );

    // ---------- painting the text that depends on the crystal ----------
    function paintNb() {
      const c = crystalOf();
      nbLine.textContent = neighborLine(c);
      nbBtn.textContent = nb.on ? 'Hide the neighbors' : 'Show one atom\'s neighbors';
      if (!nb.on) { nbStatus.textContent = 'Tap any atom to see what touches it.'; return; }
      const a = built.structure.atoms[nb.center];
      const rule = shellRule(c, a.basisIndex);
      const n = nb.list.length;
      const noun = n === 1 ? 'neighbor' : 'neighbors';
      nbStatus.textContent = n >= rule.count
        ? `Showing ${n} ${noun} of the marked atom. The rest of the block is faded.`
        : `Showing ${n} of ${rule.count} neighbors. The others are outside this block.`;
    }

    function paintPlane() {
      const c = crystalOf();
      const planes = c.planes || [];
      const s = cur();
      planeTog.el.style.display = planes.length ? '' : 'none';
      planeHint.style.display = planes.length ? '' : 'none';
      planeTog.el.querySelector('.toggle-label').textContent = c.id === 'graphite' ? 'Show one sheet' : 'Show the sliding layer';
      planeHint.textContent = c.id === 'graphite' ? 'The sheets slide over each other. That is why pencils write.' : SHEET_PLAIN + '.';
      planeTog.set(s.plane != null && !!planes[s.plane]);
      if (planeFor !== c.id) {
        planePick.setOptions([{ value: 'none', label: 'None' }, ...planes.map((p, i) => ({ value: String(i), label: p.label }))]);
        planeFor = c.id;
      }
      planePick.set(s.plane != null && planes[s.plane] ? String(s.plane) : 'none');
      const p = s.plane != null ? planes[s.plane] : null;
      planeNote.textContent = p ? p.note : (planes.length ? 'Pick a plane to draw it on the block.' : 'This crystal has no plane drawn.');
      planePick.el.style.display = planes.length ? '' : 'none';
    }

    function paintAll() {
      const c = crystalOf();
      const p = plainOf(c);
      const s = cur();
      paintPicker();
      amountSlider.set(s.amount);
      ans.update({ kind: 'info', title: p.name, text: p.text });
      chipHost.replaceChildren();
      if (c.quality !== 'reference') chipHost.append(el('span', { class: 'xt-chip', text: c.quality === 'schematic' ? 'Schematic' : 'Approximate' }));
      whyHost.replaceChildren(...whyList(c).map((t) => el('li', { text: t })));
      cellTog.set(s.showCell);
      boundTog.set(s.showBoundary);
      bondTog.set(s.showBonds);
      notesHost.replaceChildren();
      if (c.paramNote) notesHost.append(el('p', { class: 'xt-small', text: c.paramNote }));
      if (c.cellNote) notesHost.append(el('p', { class: 'xt-small', text: c.cellNote }));
      if (c.id === 'ice_ih') notesHost.append(el('p', { class: 'xt-small', text: 'The hydrogen positions shown are one tidy arrangement. In real ice they are jumbled.' }));
      paintPlane();
      paintNumbers();
      paintNb();
      legendHost.replaceChildren(legend(Array.from(new Set(c.basis.map((b) => b.el))).map((sym) => ({ color: ELEMENTS[sym].color, label: ELEMENTS[sym].name }))));
      summaryEl.textContent = `${p.name.replace(' at room temperature', '').replace(' when it is red hot', ', hot')} · ${p.shape} · ${neighborShort(c)}`;
    }

    function paintNumbers() {
      const c = crystalOf();
      const e = c.expect;
      const rho = density(c);
      tDensity.update({ value: rho, digits: 3, source: c.source, hint: `Reference value ${e.density.toFixed(3)} g/cm³` });
      const bi = 0;
      let nearest; let touching;
      if (e.neighborEl) {
        const list = neighbors(c, bi, 6).filter((n) => n.el === e.neighborEl);
        nearest = list[0].d; touching = list.filter((n) => n.d <= nearest * (1 + (e.coordinationTol ?? 0.08))).length;
      } else {
        const co = coordination(c, bi, e.coordinationTol ?? 0.08);
        nearest = co.distance; touching = co.number;
      }
      tNearest.update({ value: nearest, digits: 3, source: c.source });
      tTouch.update({
        value: e.shells ? `${e.shells[0].n} + ${e.shells[1].n}` : touching,
        digits: 0,
        hint: e.shells ? 'Six in the same layer and six in the layers above and below.' : (e.sites && e.sites.length > 1 ? e.sites.map((x) => `${x.el}: ${x.coordination}`).join(', ') : ''),
      });
      tAtoms.update({ value: atomsPerCell(c), digits: 0, hint: e.formulaUnits ? `${e.formulaUnits} formula units` : '' });
      tDrawn.update({ value: built.structure ? built.structure.atoms.length : 0, digits: 0 });
      const pf = packingFraction(c);
      tPack.el.style.display = pf == null ? 'none' : '';
      if (pf != null) tPack.update({ value: pf * 100, digits: 1, unit: '%', hint: 'If the atoms were hard balls that touch.' });
      const P = c.params;
      kv.replaceChildren(
        ...[
          ['Stacking pattern', c.lattice],
          ['Crystal system', c.system],
          ['Cell edges a, b, c', `${P.a} ${P.b} ${P.c} Å`],
          ['Cell angles', `${P.alpha}° ${P.beta}° ${P.gamma}°`],
        ].flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: String(v) })]),
      );
      srcRow.replaceChildren(el('span', { class: 'muted', text: 'Data' }), sourceTag(c.source), el('span', { class: 'xt-small', text: c.quality === 'reference' ? 'Reference values' : c.quality === 'approximate' ? 'Approximate values' : 'Schematic' }));
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

    // ---------- taps ----------
    const offTap = stage.onTap(({ clientX, clientY }) => {
      if (dead) return;
      const hit = viewer.pickAtom(clientX, clientY);
      if (cur().showNumbers) {
        if (!hit) return;
        const m = viewer.measure.add(hit.index);
        if (m.type === 'distance') measureStat.update({ value: m.value, digits: 2, unit: 'Å', hint: 'Distance between the two atoms. 1 Å is 0.1 nanometer.' });
        else if (m.type === 'angle') measureStat.update({ value: m.value, digits: 1, unit: '°', hint: 'Angle at the second atom you tapped.' });
        else measureStat.update({ value: 'None', unit: '', hint: 'Tap one more atom to measure a distance.' });
        return;
      }
      if (!hit) {
        if (nb.on) { nb = { on: false, center: -1, list: [] }; draw(false); paintNb(); }
        return;
      }
      setNeighbors(hit.index);
    });
    cleanup.push(offTap);

    // ---------- keep controls in step with the store (style changes made in panel C) ----------
    const unsub = store.subscribe((s) => {
      if (dead) return;
      const v = s.view || {};
      if (v.style && showAs.get() !== v.style) showAs.set(v.style);
      if (v.style && v.style !== lastStyle) draw(false);
      if (v.labels != null && !!v.labels !== labelTog.get()) labelTog.set(!!v.labels);
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
