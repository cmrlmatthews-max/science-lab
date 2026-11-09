// molecules/mode-molecules.js  Molecules mode ("simple first" pattern).
// One plain question, a molecule picker, a "Show as" switch, one big plain answer, "Try this" steps,
// and a "Show numbers" switch that holds every number, tile and the tap-to-measure tool.
// State lives in store.molecules ({ id, showDipole, showNumbers, ready }) and store.view, so it survives mode switches.
// Mode default export: { id, label, panelTitles, mount(ctx), unmount() }.

import { createViewer, viewControls } from './viewer.js';
import { el, segmented, toggle, stat, section, button } from '../shared/ui.js';
import { question, answer, tryThis, numbersSwitch, note } from '../shared/simple.js';
import { ELEMENTS } from './elements.js';
import { molarMass } from './chem.js';
import { MOLECULES, MOLECULE_ORDER, MOLECULE_GROUPS } from './molecule-data.js';

// Plain words for each molecule. Numbers never appear here; they come from molecule-data.js.
//   name   plain name         tag    one plain line for the picker
//   text   the big answer     shape  the shape in a few everyday words (phone summary)
const PLAIN = {
  water: {
    name: 'Water', tag: 'What comes out of the tap', shape: 'bent',
    text: 'Water is two small hydrogen atoms stuck to one oxygen atom. It is bent like a boomerang.',
  },
  n2: {
    name: 'Nitrogen', tag: 'Most of the air we breathe', shape: 'two atoms in a line',
    text: 'Nitrogen is two nitrogen atoms joined by a very strong link. It is a tiny straight dumbbell, and it makes up most of the air.',
  },
  o2: {
    name: 'Oxygen', tag: 'The part of the air we use', shape: 'two atoms in a line',
    text: 'Oxygen is two oxygen atoms joined side by side. It is the part of the air that we need to breathe.',
  },
  co2: {
    name: 'Carbon dioxide', tag: 'What we breathe out', shape: 'straight line',
    text: 'Carbon dioxide is one carbon atom with an oxygen atom on each side. It is a straight line.',
  },
  methane: {
    name: 'Methane', tag: 'The gas in a kitchen stove', shape: 'pyramid-like',
    text: 'Methane is one carbon atom with four hydrogen atoms around it. The hydrogens spread out evenly, like the corners of a small pyramid.',
  },
  propane: {
    name: 'Propane', tag: 'The fuel in a grill tank', shape: 'zigzag chain',
    text: 'Propane is a short chain of three carbon atoms with hydrogen atoms around them. The chain zigzags instead of lying straight.',
  },
  formaldehyde: {
    name: 'Formaldehyde', tag: 'The smell of new furniture', shape: 'flat',
    text: 'Formaldehyde is one carbon atom joined to one oxygen atom and two hydrogen atoms. All four atoms lie flat, like a small triangle.',
  },
  ammonia: {
    name: 'Ammonia', tag: 'The sharp smell in some cleaners', shape: 'tripod',
    text: 'Ammonia is one nitrogen atom with three hydrogen atoms. It stands like a short tripod, with the nitrogen at the top.',
  },
  co: {
    name: 'Carbon monoxide', tag: 'A harmful gas from poor burning', shape: 'two atoms in a line',
    text: 'Carbon monoxide is one carbon atom joined to one oxygen atom. It is a straight line, and it is a harmful gas that has no smell.',
  },
  ozone: {
    name: 'Ozone', tag: 'A sharp-smelling kind of oxygen', shape: 'bent',
    text: 'Ozone is three oxygen atoms joined in a bent shape. It is a sharp-smelling gas that can irritate the lungs.',
  },
  r32: {
    name: 'R-32 refrigerant', tag: 'Works inside a heat pump', shape: 'pyramid-like',
    text: 'R-32 is one carbon atom with two hydrogen atoms and two fluorine atoms around it. They spread out like the corners of a small pyramid.',
  },
  r134a: {
    name: 'R-134a refrigerant', tag: 'Cools a chiller or a car', shape: 'two linked pyramids',
    text: 'R-134a is two linked carbon atoms with hydrogen and fluorine atoms around them. Most of the fluorine sits on one end.',
  },
  ethylene: {
    name: 'Ethylene', tag: 'The building block of plastic sheet', shape: 'flat',
    text: 'Ethylene is two carbon atoms joined by a double link, with two hydrogen atoms on each. All six atoms lie flat.',
  },
  vinyl_chloride: {
    name: 'Vinyl chloride', tag: 'The building block of PVC pipe', shape: 'flat',
    text: 'Vinyl chloride is two carbon atoms joined by a double link, with three hydrogen atoms and one chlorine atom around them. All the atoms lie flat.',
  },
  styrene: {
    name: 'Styrene', tag: 'The building block of foam insulation', shape: 'ring with a tail',
    text: 'Styrene is a flat ring of six carbon atoms with a short two-carbon tail. The tail is the part that links to other styrene molecules.',
  },
  benzene: {
    name: 'Benzene', tag: 'A flat ring found in many plastics', shape: 'flat ring',
    text: 'Benzene is a flat ring of six carbon atoms, each with one hydrogen atom. The same ring is part of styrene.',
  },
};

const SHOW_AS = [
  { value: 'ball-stick', label: 'Balls and sticks' },
  { value: 'space-fill', label: 'Full size' },
  { value: 'sticks', label: 'Sticks' },
];

const JARGON = /dipole|polar|tetrahed|C–H|C–C/i;
const MEASURE_HINT = 'Tap two atoms to measure a distance. Tap a third for the angle.';
const TAP_HINT = 'Tap an atom to see what it is.';

const STYLE_ID = 'molecules-mode-style';
const CSS = `
.mol-pick { display: flex; flex-direction: column; gap: 6px; }
.mol-pick-label { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.mol-pick-scroll { display: flex; flex-direction: column; gap: 12px; }
@media (max-width: 899px) {
  .mol-pick-scroll { max-height: 200px; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; padding: 8px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper-3); }
}
.mol-group { display: flex; flex-direction: column; gap: 4px; }
.mol-group-name { font-size: 11.5px; font-weight: 600; color: var(--ink-2); padding: 0 2px; }
.mol-row { width: 100%; min-height: 44px; display: flex; align-items: center; gap: 10px; text-align: left; padding: 6px 10px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper-2); color: var(--ink); font: inherit; cursor: pointer; }
.mol-row:hover { border-color: var(--line-strong); }
.mol-row:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.mol-row[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); }
.mol-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.mol-row-name { font-size: 14px; font-weight: 500; line-height: 1.25; }
.mol-row-tag { font-size: 12px; line-height: 1.3; color: var(--ink-2); }
.mol-row-formula { flex: none; font-family: var(--font-mono); font-size: 12px; color: var(--ink-2); }
.mol-facts { margin: 0; padding: 0 0 0 18px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; line-height: 1.45; color: var(--ink); }
.mol-pill { align-self: flex-start; display: inline-flex; align-items: center; padding: 2px 9px; border: 1px solid var(--line-strong); border-radius: 999px; font-size: 12px; color: var(--ink-2); background: var(--paper-3); }
.mol-pill[hidden] { display: none; }
.mol-charge-line { margin: 0; font-size: 14px; line-height: 1.45; color: var(--ink); }
.mol-atoms { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 16px; }
.mol-atoms li { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; }
.mol-atoms .swatch { width: 14px; height: 14px; border-radius: 50%; box-shadow: inset 0 0 0 1px var(--line-strong); flex: none; }
.mol-tap-line { margin: 0; font-size: 14px; font-weight: 500; color: var(--ink); min-height: 1.45em; }
.mol-tap-line[data-idle="true"] { font-weight: 400; color: var(--ink-2); font-size: 13px; }
.mol-tap-line[hidden] { display: none; }
.mol-formula-val sub { font-size: 0.7em; }
`;

const prefersReducedMotion = () => {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** "2 hydrogen, 1 oxygen" style counts, carbon first, then hydrogen, then alphabetical (Hill order). */
function atomCounts(mol) {
  const counts = new Map();
  for (const a of mol.atoms) counts.set(a.el, (counts.get(a.el) || 0) + 1);
  const rank = (s) => (s === 'C' ? 0 : s === 'H' ? 1 : 2);
  return Array.from(counts.entries())
    .sort((x, y) => rank(x[0]) - rank(y[0]) || x[0].localeCompare(y[0]))
    .map(([sym, n]) => ({ sym, n, name: (ELEMENTS[sym] ? ELEMENTS[sym].name : sym).toLowerCase(), color: ELEMENTS[sym] ? ELEMENTS[sym].color : '#b0b6bd' }));
}

function plainFacts(mol) {
  const clean = mol.facts.filter((f) => !JARGON.test(f));
  const rest = mol.facts.filter((f) => JARGON.test(f));
  const out = clean.slice(0, 3);
  while (out.length < 2 && rest.length) out.push(rest.shift());
  return out;
}

const dedupe = (items, keyOf) => {
  const seen = new Set();
  return items.filter((it) => { const k = keyOf(it); if (seen.has(k)) return false; seen.add(k); return true; });
};

export default {
  id: 'molecules',
  label: 'Molecules',
  panelTitles: { a: 'Molecule', b: 'What it is', c: 'View' },
  _cleanup: [],
  mount(ctx) {
    const { store, stage, panelA, panelB, panelC, summaryEl } = ctx;

    // ----- style tag (layout glue only, existing tokens) -----
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
    this._cleanup.push(() => styleEl.remove());

    // ----- first-visit defaults (survive mode switches afterwards) -----
    if (!store.get().molecules.ready) {
      store.set({ molecules: { ...store.get().molecules, showDipole: false, showNumbers: false, ready: true } });
      if (!prefersReducedMotion()) store.set({ view: { ...store.get().view, spin: true } });
    }
    const M = () => store.get().molecules;
    const setM = (patch) => store.set({ molecules: { ...store.get().molecules, ...patch } });
    const cur = () => (MOLECULES[M().id] ? M().id : 'water');
    const mol = () => MOLECULES[cur()];

    const viewer = createViewer(stage, { style: store.get().view.style });
    this._cleanup.push(() => viewer.dispose());

    // ===== Panel A =====
    // picker
    const rows = new Map();
    const pickList = el('div', { class: 'mol-pick-scroll' });
    for (const gid of Object.keys(MOLECULE_GROUPS)) {
      const ids = MOLECULE_ORDER.filter((id) => MOLECULES[id] && MOLECULES[id].group === gid);
      if (!ids.length) continue;
      const g = el('div', { class: 'mol-group', role: 'group', 'aria-label': MOLECULE_GROUPS[gid] }, el('div', { class: 'mol-group-name', text: MOLECULE_GROUPS[gid] }));
      for (const id of ids) {
        const m = MOLECULES[id];
        const p = PLAIN[id];
        const b = el('button', { type: 'button', class: 'mol-row', 'aria-pressed': 'false', 'data-id': id },
          el('span', { class: 'mol-row-main' },
            el('span', { class: 'mol-row-name', text: p.name }),
            el('span', { class: 'mol-row-tag', text: p.tag })),
          el('span', { class: 'mol-row-formula', html: m.formulaDisplayHtml }));
        b.addEventListener('click', () => choose(id));
        rows.set(id, b);
        g.append(b);
      }
      pickList.append(g);
    }
    const picker = el('div', { class: 'mol-pick' }, el('div', { class: 'mol-pick-label', text: 'Molecule' }), pickList);

    const showAs = segmented({
      label: 'Show as', options: SHOW_AS, value: store.get().view.style || 'ball-stick',
      onChange: (v) => { store.set({ view: { ...store.get().view, style: v } }); viewer.setStyle(v); drawArrows(); },
    });

    const trySteps = tryThis([
      { label: 'Look at water', hint: 'It is bent, not straight.', run: () => go('water', { style: 'ball-stick', dipole: false }) },
      { label: 'Now carbon dioxide', hint: 'It is a straight line.', run: () => go('co2', { style: 'ball-stick', dipole: false }) },
      { label: 'See which side is charged', hint: 'One end pulls on other molecules.', run: () => go('water', { style: 'space-fill', dipole: true }) },
      { label: 'A plastic in your walls', hint: 'Thousands of these link into a chain.', run: () => go('styrene', { style: 'ball-stick', dipole: false }) },
    ]);

    panelA.append(
      question('What are the things in the air and in our buildings made of?', 'Pick a molecule. Turn it around.'),
      picker,
      showAs.el,
      trySteps,
    );

    // ===== Panel B =====
    const ans = answer({ kind: 'info', title: '', text: '' });
    const qualityPill = el('span', { class: 'mol-pill', text: 'Approximate shape', title: 'The atoms are placed from typical bond lengths, so the shape is a good picture, not a measured one.', hidden: true });

    const factsList = el('ul', { class: 'mol-facts' });
    const factsSection = section('Where you meet it', factsList);

    const chargeLine = el('p', { class: 'mol-charge-line' });
    const chargeToggle = toggle({
      label: 'Show the charged side', value: M().showDipole,
      onChange: (v) => { setM({ showDipole: v }); drawArrows(); },
    });
    const chargeSection = section('Charged side', chargeLine, chargeToggle.el);

    const atomList = el('ul', { class: 'mol-atoms' });
    const tapLine = el('p', { class: 'mol-tap-line', 'aria-live': 'polite', text: TAP_HINT });
    tapLine.dataset.idle = 'true';
    const atomsSection = section('Atoms', atomList, tapLine);

    // numbers area
    const bigTiles = el('div', { class: 'stats' });
    const keyTiles = el('div', { class: 'stats' });
    const measureStat = stat({ label: 'Measurement', value: 'None', hint: MEASURE_HINT });
    const clearBtn = button({ label: 'Clear', onClick: () => { viewer.measure.clear(); viewer.clearHighlight(); paintMeasure({ type: 'none', indices: [] }); } });
    const labelsToggle = toggle({
      label: 'Show element labels', value: !!store.get().view.labels,
      onChange: (v) => { viewer.setLabels(v); store.set({ view: { ...store.get().view, labels: v } }); },
    });
    const sourceLine = el('p', { class: 'simple-note' });
    const unitNote = note('1 Å = 0.1 nanometer');

    const numbers = numbersSwitch(
      {
        label: 'Show numbers', value: !!M().showNumbers,
        onChange: (v) => {
          setM({ showNumbers: v });
          if (!v) { viewer.measure.clear(); viewer.clearHighlight(); paintMeasure({ type: 'none', indices: [] }); }
          else viewer.clearHighlight();
          paintTap(null);
        },
      },
      bigTiles,
      keyTiles,
      section('Measure', measureStat.el, el('div', { class: 'row' }, clearBtn)),
      labelsToggle.el,
      unitNote,
      sourceLine,
    );

    panelB.append(ans.el, qualityPill, factsSection, chargeSection, atomsSection, numbers.el);

    // ===== Panel C =====
    const vc = viewControls(store, viewer);
    const vcTitle = vc.querySelector && vc.querySelector('.section-title');
    if (vcTitle) vcTitle.textContent = 'Turn and look';
    panelC.append(vc);
    this._cleanup.push(() => { try { if (vc.dispose) vc.dispose(); } catch (e) { console.error(e); } });

    // ===== drawing helpers =====
    function drawArrows() {
      const m = mol();
      if (!M().showDipole || !m.polar || !m.dipoleDir) { viewer.setArrows([]); return; }
      const d = m.dipoleDir;
      let far = 0;
      for (const a of m.atoms) far = Math.max(far, Math.hypot(a.pos[0], a.pos[1], a.pos[2]));
      const len = far + (store.get().view.style === 'space-fill' ? 1.9 : 1.0);
      viewer.setArrows([{ from: [0, 0, 0], to: [d[0] * len, d[1] * len, d[2] * len], label: 'slightly negative' }]);
    }

    function paintMeasure(m) {
      const atoms = mol().atoms;
      if (m.type === 'distance') {
        const [a, b] = m.indices.map((i) => atoms[i].el);
        measureStat.update({ value: m.value, digits: 2, unit: 'Å', hint: `Distance between ${a} and ${b}. Tap another atom for an angle.` });
      } else if (m.type === 'angle') {
        measureStat.update({ value: m.value, digits: 1, unit: '°', hint: `Angle at ${atoms[m.indices[1]].el}. Tap again to start over.` });
      } else if (m.indices && m.indices.length === 1) {
        measureStat.update({ value: 'None', unit: '', hint: 'Tap one more atom to measure a distance.' });
      } else {
        measureStat.update({ value: 'None', unit: '', hint: MEASURE_HINT });
      }
    }

    function paintTap(atom) {
      const numbersOn = M().showNumbers;
      tapLine.hidden = numbersOn;
      if (atom) { tapLine.textContent = ELEMENTS[atom.el] ? ELEMENTS[atom.el].name : atom.el; tapLine.dataset.idle = 'false'; }
      else { tapLine.textContent = TAP_HINT; tapLine.dataset.idle = 'true'; }
    }

    function paintMolecule() {
      const id = cur();
      const m = mol();
      const p = PLAIN[id];

      ans.update({ kind: 'info', title: p.name, text: p.text });
      qualityPill.hidden = m.quality !== 'approximate';
      summaryEl.textContent = `${p.name} · ${p.shape} · ${m.polar ? 'has a charged side' : 'no charged side'}`;

      for (const [rid, b] of rows) b.setAttribute('aria-pressed', rid === id ? 'true' : 'false');

      factsList.replaceChildren(...plainFacts(m).map((f) => el('li', { text: f })));

      chargeLine.textContent = m.polar
        ? 'One side is slightly negative, so it sticks to other molecules.'
        : 'Its charge is spread evenly, so it does not stick much.';
      chargeToggle.el.hidden = !m.polar;
      chargeToggle.set(M().showDipole && m.polar);

      atomList.replaceChildren(...atomCounts(m).map((c) => el('li', {}, el('span', { class: 'swatch', style: { background: c.color } }), `${c.n} ${c.name}`)));
      paintTap(null);

      // numbers
      const formulaTile = el('div', { class: 'stat' },
        el('div', { class: 'stat-head' }, el('span', { class: 'stat-label', text: 'Formula' })),
        el('div', { class: 'stat-value mol-formula-val', html: m.formulaDisplayHtml }));
      const massTile = stat({ label: 'Mass', value: molarMass(m.atoms), unit: 'g/mol', digits: 2 });
      const shapeTile = stat({ label: 'Shape', value: m.shape, hint: m.shapeWhy });
      const dipoleTile = stat({ label: 'Charge pull (dipole)', value: m.dipole, unit: 'debye', digits: 2, hint: m.polar ? 'One side is slightly negative.' : 'Close to zero, so the charge is spread evenly.' });
      bigTiles.replaceChildren(formulaTile, massTile.el, shapeTile.el, dipoleTile.el);

      const tag = m.quality === 'approximate' ? 'Approximate' : 'Reference';
      const bonds = dedupe(m.keyBonds, (b) => `${b.label}|${b.length}`)
        .map((b) => stat({ label: `${b.label} bond length`, value: b.length, unit: 'Å', digits: 3, source: tag }).el);
      const angles = dedupe(m.keyAngles, (a) => `${a.label}|${a.angle}`)
        .map((a) => stat({ label: `${a.label} angle`, value: a.angle, unit: '°', digits: Math.abs(a.angle * 10 - Math.round(a.angle * 10)) < 1e-9 ? 1 : 2, source: tag }).el);
      keyTiles.replaceChildren(...bonds, ...angles);
      keyTiles.hidden = !bonds.length && !angles.length;

      paintMeasure({ type: 'none', indices: [] });
      sourceLine.textContent = `Source: ${m.source}. Quality: ${m.quality}.`;
    }

    // ----- choosing, going to a step -----
    function showStructure() {
      const m = mol();
      viewer.measure.clear();
      viewer.clearHighlight();
      viewer.setStructure({ atoms: m.atoms, bonds: m.bonds }, { style: store.get().view.style });
      drawArrows();
      viewer.frame();
    }

    function choose(id) {
      if (!MOLECULES[id]) return;
      if (id !== cur()) {
        setM({ id });
        showStructure();
      }
      paintMolecule();
    }

    function go(id, { style, dipole }) {
      if (style && style !== store.get().view.style) {
        store.set({ view: { ...store.get().view, style } });
        showAs.set(style);
        viewer.setStyle(style);
      }
      setM({ showDipole: !!dipole });
      if (id !== cur()) { setM({ id }); showStructure(); } else drawArrows();
      paintMolecule();
      const row = rows.get(id);
      if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
    }

    // ----- first draw -----
    viewer.setStructure({ atoms: mol().atoms, bonds: mol().bonds }, { style: store.get().view.style });
    drawArrows();
    viewer.frame();
    paintMolecule();

    // keep my controls in step with the ones in the View panel
    const unsub = store.subscribe((s) => {
      const vw = s.view || {};
      if (vw.style && vw.style !== showAs.get()) { showAs.set(vw.style); drawArrows(); }
      if (vw.labels != null && !!vw.labels !== labelsToggle.get()) labelsToggle.set(vw.labels);
    });
    this._cleanup.push(unsub);

    // ----- tapping atoms -----
    const offTap = stage.onTap(({ clientX, clientY }) => {
      const hit = viewer.pickAtom(clientX, clientY);
      if (M().showNumbers) {
        if (!hit) { viewer.clearHighlight(); return; }
        const r = viewer.measure.add(hit.index);
        viewer.highlight([hit.index]);
        paintMeasure(r);
      } else if (hit) {
        viewer.highlight([hit.index]);
        paintTap(hit.atom);
      } else {
        viewer.clearHighlight();
        paintTap(null);
      }
    });
    this._cleanup.push(offTap);
  },
  unmount() {
    this._cleanup.splice(0).reverse().forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  },
};
