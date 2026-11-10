// molecules/mode-molecules.js  Molecules mode, five information layers.
//   1 Start    the question, four big picture choices, one plain answer (water, slowly turning)
//   2 Story    a six-step guided story and a row of idea chips
//   3 Explore  all 16 molecules by group, view style, atom names, charged side, "Try this", tap or point at atoms
//   4 Numbers  stat tiles (atoms, weight, bond length, bond angle, charged side) with comparisons, trust tags
//   5 Deep     shape, dipole, every key bond and angle with trust tags, the measuring tool, sources
// Words live in content-molecules.js. State lives in store.molecules ({ id, showDipole, ready, spin }) and store.view.
// Mode default export: { id, label, panelTitles, mount(ctx), unmount() }.

import { createViewer, viewControls } from './viewer.js';
import { el, segmented, toggle, stat, section, button } from '../shared/ui.js';
import { question, answer, tryThis, note } from '../shared/simple.js';
import { story, tile, moreLink } from '../shared/layers.js';
import { infoChip, infoButton } from '../shared/card.js';
import { dual } from '../shared/units.js';
import { ELEMENTS } from './elements.js';
import { molarMass, dist } from './chem.js';
import { MOLECULES, MOLECULE_ORDER, MOLECULE_GROUPS } from './molecule-data.js';
import { TEXT, CHOICE_MOLECULE, getInfo, trustOf, chargeStrength, bondInfoId } from './content-molecules.js';

const L3 = TEXT.l3;
const L4 = TEXT.l4;
const L5 = TEXT.l5;

const SHOW_AS = ['ball-stick', 'space-fill', 'sticks'].map((value) => ({ value, label: L3.showAs[value] }));

const ICONS = {
  water: '<path d="M12 3C12 3 5.5 10.5 5.5 15a6.5 6.5 0 0 0 13 0C18.5 10.5 12 3 12 3z"/>',
  breath: '<path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 9.5z"/><path d="M4 21h6M14 21h6"/>',
  gas: '<path d="M12 2.5c.7 3.8 5 5.6 5 10.5a5 5 0 0 1-10 0c0-2 1-3.4 2.2-4.4.1 1.8.9 2.9 2 3.4C10.6 8.6 10.7 5.4 12 2.5z"/>',
  plastic: '<path d="M10 2.5h4v3l2.2 3.2V19a2.5 2.5 0 0 1-2.5 2.5h-3.4A2.5 2.5 0 0 1 7.8 19V8.7L10 5.5z"/><path d="M8 12h8"/>',
};
const icon = (key) => el('span', { class: 'mol-choice-icon', html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key]}</svg>` });

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
.mol-formula-val sub { font-size: 0.7em; }

.mol-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.mol-choice { min-height: 84px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 10px 8px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper-2); color: var(--ink); font: inherit; font-size: 15px; font-weight: 500; line-height: 1.25; text-align: center; cursor: pointer; }
.mol-choice svg { width: 30px; height: 30px; flex: none; color: var(--accent); }
.mol-choice:hover { border-color: var(--line-strong); }
.mol-choice:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.mol-choice[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); }
.mol-ans-info { margin-top: 6px; }
.mol-ans-info:empty { display: none; }
.mol-ideas { display: flex; flex-direction: column; gap: 6px; }
.mol-ideas-row { display: flex; flex-wrap: wrap; gap: 6px; }
.mol-gloss { margin: 0; padding: 0 0 0 18px; display: flex; flex-direction: column; gap: 3px; font-size: 13px; line-height: 1.4; color: var(--ink-2); }
.mol-trust { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.mol-trust-gloss { font-size: 13px; line-height: 1.4; color: var(--ink-2); flex: 1 1 200px; margin: 0; }
.mol-pill[data-trust="schematic"] { border-style: dashed; }
`;

const prefersReducedMotion = () => {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
};
const canHover = () => {
  try { return !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches); } catch (e) { return false; }
};

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const subscripts = (f) => f.replace(/\d/g, (d) => SUB[+d]);

/** "2 hydrogen, 1 oxygen" style counts, carbon first, then hydrogen, then alphabetical (Hill order). */
function atomCounts(mol) {
  const counts = new Map();
  for (const a of mol.atoms) counts.set(a.el, (counts.get(a.el) || 0) + 1);
  const rank = (s) => (s === 'C' ? 0 : s === 'H' ? 1 : 2);
  return Array.from(counts.entries())
    .sort((x, y) => rank(x[0]) - rank(y[0]) || x[0].localeCompare(y[0]))
    .map(([sym, n]) => ({ sym, n, name: (ELEMENTS[sym] ? ELEMENTS[sym].name : sym).toLowerCase(), color: ELEMENTS[sym] ? ELEMENTS[sym].color : '#b0b6bd' }));
}

const JARGON = /dipole|polar|tetrahed|C–H|C–C/i;
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

const IDEA_CHIPS = [
  ['atom', 'Atom'], ['molecule', 'Molecule'], ['bond', 'Bond'], ['shape', 'Shape'], ['charged_side', 'Charged side'],
  ['hydrogen_bond', 'Hydrogen bond'], ['greenhouse_gas', 'Greenhouse gas'], ['refrigerant', 'Refrigerant'], ['polymer', 'Polymer'],
];

export default {
  id: 'molecules',
  label: 'Molecules',
  panelTitles: { a: 'Molecule', b: 'What it is', c: 'View' },
  _cleanup: [],
  mount(ctx) {
    const { store, stage, panelA, panelB, panelC, summaryEl, layers, card, setPanelMin } = ctx;

    // ----- style tag (layout glue only, existing tokens) -----
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
    this._cleanup.push(() => styleEl.remove());

    card.setSource(getInfo);
    setPanelMin('b', 3);
    setPanelMin('c', 3);

    // ----- first-visit defaults (survive mode switches afterwards) -----
    if (!store.get().molecules.ready) {
      store.set({ molecules: { ...store.get().molecules, showDipole: false, spin: !prefersReducedMotion(), ready: true } });
    }
    // Other modes may turn spin off; this mode keeps its own spin choice and restores it.
    if (!!store.get().view.spin !== !!store.get().molecules.spin) store.set({ view: { ...store.get().view, spin: !!store.get().molecules.spin } });
    const M = () => store.get().molecules;
    const setM = (patch) => store.set({ molecules: { ...store.get().molecules, ...patch } });
    const cur = () => (MOLECULES[M().id] ? M().id : 'water');
    const mol = () => MOLECULES[cur()];
    const lv = () => layers.level();

    const viewer = createViewer(stage, { style: store.get().view.style });
    this._cleanup.push(() => viewer.dispose());
    viewer.setTapMode('info');

    // names and text that never show a digit at levels 1 and 2
    const nameOf = (id) => (lv() < 3 && TEXT.l2.names[id]) || L3.molecules[id].name;
    const textOf = (id) => {
      const t = L3.molecules[id].text;
      return lv() < 3 ? t.replace(/\bR-\d+[a-z]?\b/g, 'This gas') : t;
    };

    // answer with an "About ..." chip under it
    function makeAnswer() {
      const a = answer({ kind: 'info', title: '', text: '' });
      const holder = el('div', { class: 'mol-ans-info' });
      return {
        el: el('div', {}, a.el, holder),
        update(id) {
          a.update({ title: nameOf(id), text: textOf(id) });
          holder.replaceChildren(infoChip(card, `mol_${id}`, `About ${nameOf(id).toLowerCase()}`));
        },
      };
    }

    // ===== Panel A =====
    // level 1: four picture choices
    const choiceBtns = new Map();
    const choices = el('div', { class: 'mol-choices', role: 'group', 'aria-label': 'Pick something' });
    for (const c of TEXT.l1.choices) {
      const b = el('button', { type: 'button', class: 'mol-choice', 'aria-pressed': 'false', 'data-choice': c.id }, icon(c.id), el('span', { text: c.label }));
      b.addEventListener('click', () => go(CHOICE_MOLECULE[c.id], { dipole: false }));
      choiceBtns.set(c.id, b);
      choices.append(b);
    }

    const ansA = makeAnswer();
    const hint = el('p', { class: 'simple-note', text: canHover() ? L3.controls.hoverAtom : L3.controls.tapAtom });
    const moreBox = el('div', {}, moreLink(layers));

    const tellStory = story(TEXT.l2.steps.map((s, i) => ({ ...s, run: () => STEP_RUN[i]() })), { title: 'The story' });

    const ideas = el('div', { class: 'mol-ideas' },
      el('div', { class: 'mol-pick-label', text: 'Words to know' }),
      el('div', { class: 'mol-ideas-row' }, ...IDEA_CHIPS.map(([id, label]) => infoChip(card, id, label))));

    // level 3: the whole library
    const rows = new Map();
    const pickList = el('div', { class: 'mol-pick-scroll' });
    for (const gid of Object.keys(MOLECULE_GROUPS)) {
      const ids = MOLECULE_ORDER.filter((id) => MOLECULES[id] && MOLECULES[id].group === gid);
      if (!ids.length) continue;
      const g = el('div', { class: 'mol-group', role: 'group', 'aria-label': MOLECULE_GROUPS[gid] }, el('div', { class: 'mol-group-name', text: MOLECULE_GROUPS[gid] }));
      for (const id of ids) {
        const t = L3.molecules[id];
        const formulaEl = el('span', { class: 'mol-row-formula', text: subscripts(MOLECULES[id].formulaDisplay) });
        layers.gate(formulaEl, 4);
        const b = el('button', { type: 'button', class: 'mol-row', 'aria-pressed': 'false', 'data-id': id },
          el('span', { class: 'mol-row-main' },
            el('span', { class: 'mol-row-name', text: t.name }),
            el('span', { class: 'mol-row-tag', text: t.tag })),
          formulaEl);
        b.addEventListener('click', () => choose(id));
        rows.set(id, b);
        g.append(b);
      }
      pickList.append(g);
    }
    const picker = el('div', { class: 'mol-pick' }, el('div', { class: 'mol-pick-label', text: L3.controls.molecule }), pickList);

    const showAs = segmented({
      label: L3.controls.showAs, options: SHOW_AS, value: store.get().view.style || 'ball-stick',
      onChange: (v) => { store.set({ view: { ...store.get().view, style: v } }); viewer.setStyle(v); drawArrows(); },
    });

    const trySteps = tryThis([
      { ...L3.tries[0], run: () => go('water', { style: 'ball-stick', dipole: false }) },
      { ...L3.tries[1], run: () => go('co2', { style: 'ball-stick', dipole: false }) },
      { ...L3.tries[2], run: () => go('water', { style: 'space-fill', dipole: true }) },
      { ...L3.tries[3], run: () => go('styrene', { style: 'ball-stick', dipole: false }) },
    ]);

    panelA.append(
      question(TEXT.l1.question, TEXT.l1.sub),
      layers.gate(choices, 1, 1),
      layers.gate(ansA.el, 1, 2),
      layers.gate(hint, 1, 2),
      layers.gate(moreBox, 1, 2),
      layers.gate(tellStory.el, 2, 2),
      layers.gate(picker, 3),
      layers.gate(showAs.el, 3),
      layers.gate(trySteps, 3),
      layers.gate(ideas, 2),
    );

    // ===== Panel B (level 3 and up) =====
    const ansB = makeAnswer();
    const qualityPill = el('span', { class: 'mol-pill', hidden: true });
    const trustGloss = el('p', { class: 'mol-trust-gloss' });
    const trustInfo = infoButton(card, 'trust_levels', { label: 'trust levels' });
    const trustRow = el('div', { class: 'mol-trust' }, qualityPill, trustInfo, trustGloss);

    const factsList = el('ul', { class: 'mol-facts' });
    const factsSection = section(L3.whereTitle, factsList);

    const chargeLine = el('p', { class: 'mol-charge-line' });
    const chargeToggle = toggle({
      label: L3.controls.charged, value: M().showDipole,
      onChange: (v) => { setM({ showDipole: v }); drawArrows(); },
    });
    const chargeSection = section('Charged side', chargeLine, chargeToggle.el);

    const atomList = el('ul', { class: 'mol-atoms' });
    const atomsSection = section(L3.atomsTitle, atomList, note(canHover() ? L3.controls.hoverAtom : L3.controls.tapAtom));

    // level 4
    const tileGrid = el('div', { class: 'sl-tiles' });
    const glossList = el('ul', { class: 'mol-gloss' });
    for (const k of ['formula', 'molar mass', 'bond length', 'bond angle', 'dipole']) {
      glossList.append(el('li', { text: `${k.charAt(0).toUpperCase()}${k.slice(1)}: ${L4.glosses[k]}.` }));
    }
    const numbersSection = section(L4.tilesTitle, tileGrid, glossList);

    // level 5
    const deepTiles = el('div', { class: 'stats' });
    const keyTiles = el('div', { class: 'stats' });
    const measureStat = stat({ label: 'Measurement', value: L5.measureNone, hint: L5.measureHint });
    const clearBtn = button({ label: L5.clear, onClick: () => { viewer.measure.clear(); viewer.clearHighlight(); paintMeasure({ type: 'none', indices: [] }); } });
    let measuring = false;
    const measureToggle = toggle({
      label: L5.measureToggle, value: false,
      onChange: (v) => setMeasuring(v),
    });
    const measureBox = el('div', {}, measureStat.el, el('div', { class: 'row' }, clearBtn));
    measureBox.hidden = true;
    const sourceLine = el('p', { class: 'simple-note' });
    const unitNote = note(L5.unitNote);
    const deepSection = section('Full data',
      deepTiles,
      el('div', { class: 'mol-pick-label', text: L5.keyBondsTitle }),
      keyTiles,
      section(L5.measureTitle, el('div', {}, measureToggle.el, infoButton(card, 'measure_tool', { label: 'the measuring tool' })), measureBox),
      unitNote,
      sourceLine);

    panelB.append(
      ansB.el,
      layers.gate(trustRow, 4),
      layers.gate(numbersSection, 4),
      layers.gate(deepSection, 5),
      factsSection,
      chargeSection,
      atomsSection,
    );

    // ===== Panel C =====
    const vc = viewControls(store, viewer);
    const vcTitle = vc.querySelector && vc.querySelector('.section-title');
    if (vcTitle) vcTitle.textContent = 'Turn and look';
    panelC.append(vc);
    this._cleanup.push(() => { try { if (vc.dispose) vc.dispose(); } catch (e) { console.error(e); } });

    // ===== behaviour that follows the level =====
    // atom names in 3D only from level 3 up
    layers.gateFn((on) => viewer.setLabels(on && !!store.get().view.labels), 3);
    // the measuring tool is a level-5 toggle; below that taps open cards
    layers.gateFn((on) => {
      measureToggle.el.hidden = !on;
      if (!on) setMeasuring(false);
    }, 5);

    function setMeasuring(v) {
      measuring = !!v;
      measureToggle.set(measuring);
      measureBox.hidden = !measuring;
      viewer.setTapMode(measuring ? 'measure' : 'info');
      viewer.measure.clear();
      viewer.clearHighlight();
      paintMeasure({ type: 'none', indices: [] });
      if (measuring) card.hide();
    }

    function keepMoving() {
      if (lv() < 3 && !prefersReducedMotion() && !store.get().view.spin) store.set({ view: { ...store.get().view, spin: true } });
    }
    keepMoving();

    // ===== drawing helpers =====
    function drawArrows() {
      const m = mol();
      if (lv() < 2 || !M().showDipole || !m.polar || !m.dipoleDir) { viewer.setArrows([]); return; }
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
        measureStat.update({ value: L5.measureNone, unit: '', hint: L5.measureOne });
      } else {
        measureStat.update({ value: L5.measureNone, unit: '', hint: L5.measureHint });
      }
    }

    function paintTiles(id, m) {
      const t4 = L4.tiles;
      const counts = atomCounts(m);
      const first = m.keyBonds[0];
      const ang = m.keyAngles[0];
      const strength = chargeStrength(m.dipole);
      const mass = molarMass(m.atoms);
      const tiles = [
        tile({ label: t4.formula.label, us: subscripts(m.formulaDisplay), compare: t4.formula.compare, infoId: 'formula' }),
        tile({ label: t4.atoms.label, us: String(m.atoms.length), compare: `${counts.map((c) => `${c.n} ${c.name}`).join(', ')}. ${t4.atoms.compare(m.atoms.length)}`, infoId: 'atom' }),
        tile({ label: `${t4.mass.label} (molar mass)`, us: null, si: `${mass.toFixed(2)} g/mol`, compare: t4.mass.compare(mass), infoId: 'molar_mass' }),
      ];
      if (first) {
        tiles.push(tile({ label: `${t4.bondLength.label} (${first.label})`, us: null, si: dual.angstrom(first.length, 3).text, compare: t4.bondLength.compare(first.length), infoId: 'bond_length' }));
      }
      if (ang) {
        tiles.push(tile({ label: `${t4.bondAngle.label} (${ang.label})`, us: null, si: `${ang.angle}°`, compare: t4.bondAngle.compare(ang.angle), infoId: 'bond_angle' }));
      }
      tiles.push(tile({
        label: t4.charged.label, us: null,
        si: m.polar ? `${L4.yes}, ${L4.strength[strength]}` : (strength === 'weak' ? `${L4.no}, ${L4.strength.weak}` : L4.no),
        compare: t4.charged.compare(strength), infoId: 'charged_side',
      }));
      tileGrid.replaceChildren(...tiles.map((t) => t.el));
    }

    function paintDeep(id, m) {
      const shapeTile = stat({ label: L5.shape, value: m.shape, hint: m.shapeWhy });
      const dipoleTile = stat({ label: L5.dipoleTile, value: m.dipole, unit: 'debye', digits: 2, hint: m.polar ? 'One side is slightly negative.' : 'Close to zero, so the charge is spread evenly.' });
      deepTiles.replaceChildren(shapeTile.el, dipoleTile.el);

      const tag = L5.trust[trustOf(id)].tag;
      const bonds = dedupe(m.keyBonds, (b) => `${b.label}|${b.length}`)
        .map((b) => stat({ label: `${b.label} bond length`, value: b.length, unit: 'Å', digits: 3, source: tag }).el);
      const angles = dedupe(m.keyAngles, (a) => `${a.label}|${a.angle}`)
        .map((a) => stat({ label: `${a.label} angle`, value: a.angle, unit: '°', digits: Math.abs(a.angle * 10 - Math.round(a.angle * 10)) < 1e-9 ? 1 : 2, source: tag }).el);
      keyTiles.replaceChildren(...bonds, ...angles);
      keyTiles.hidden = !bonds.length && !angles.length;
      sourceLine.textContent = `Source: ${m.source}. Quality: ${m.quality}.`;
    }

    function paintMolecule() {
      const id = cur();
      const m = mol();
      const p = L3.molecules[id];

      ansA.update(id);
      ansB.update(id);
      const trust = trustOf(id);
      qualityPill.textContent = L5.trust[trust].tag;
      qualityPill.dataset.trust = trust;
      qualityPill.hidden = false;
      trustGloss.textContent = L5.trust[trust].gloss;
      summaryEl.textContent = lv() < 3
        ? `${nameOf(id)} · ${p.shape}`
        : `${nameOf(id)} · ${p.shape} · ${m.polar ? 'has a charged side' : 'no charged side'}`;

      for (const [rid, b] of rows) b.setAttribute('aria-pressed', rid === id ? 'true' : 'false');
      for (const [cid, b] of choiceBtns) b.setAttribute('aria-pressed', CHOICE_MOLECULE[cid] === id ? 'true' : 'false');

      factsList.replaceChildren(...plainFacts(m).map((f) => el('li', { text: f })));

      chargeLine.textContent = m.polar ? L3.chargedYes : L3.chargedNo;
      chargeToggle.el.hidden = !m.polar;
      chargeToggle.set(M().showDipole && m.polar);

      atomList.replaceChildren(...atomCounts(m).map((c) => el('li', {}, el('span', { class: 'swatch', style: { background: c.color } }), `${c.n} ${c.name}`)));

      paintTiles(id, m);
      paintDeep(id, m);
      paintMeasure({ type: 'none', indices: [] });
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
      if (row && row.scrollIntoView && lv() >= 3) row.scrollIntoView({ block: 'nearest' });
    }

    const STEP_RUN = [
      () => go('water', { style: 'ball-stick', dipole: false }),
      () => go('co2', { style: 'ball-stick', dipole: false }),
      () => go('water', { style: 'ball-stick', dipole: false }),
      () => go('water', { style: 'space-fill', dipole: true }),
      () => go('propane', { style: 'ball-stick', dipole: false }),
      () => go('r32', { style: 'ball-stick', dipole: false }),
    ];

    // ----- first draw -----
    viewer.setStructure({ atoms: mol().atoms, bonds: mol().bonds }, { style: store.get().view.style });
    drawArrows();
    viewer.frame();
    paintMolecule();

    // ----- level changes -----
    layers.onChange((level, prev) => {
      keepMoving();
      drawArrows();
      viewer.setLabels(level >= 3 && !!store.get().view.labels);
      paintMolecule();
      if (level === 2 && prev !== 2) tellStory.go(0);
    });

    // keep my controls in step with the ones in the View panel
    const unsub = store.subscribe((s) => {
      const vw = s.view || {};
      if (vw.style && vw.style !== showAs.get()) { showAs.set(vw.style); drawArrows(); }
      if (vw.spin != null && !!vw.spin !== !!s.molecules.spin) setM({ spin: !!vw.spin });
    });
    this._cleanup.push(unsub);

    // ----- hover and tap on atoms and bonds: open the information card -----
    const bondLen = (p) => {
      const atoms = mol().atoms;
      return atoms[p.a] && atoms[p.b] ? dist(atoms[p.a].pos, atoms[p.b].pos) : null;
    };
    const infoFor = (p) => {
      if (p.kind === 'atom') return { id: `el_${p.element}`, extra: undefined };
      if (p.kind === 'bond') {
        if (p.hbond) return { id: 'hydrogen_bond' };
        const len = bondLen(p);
        const extra = lv() >= 4 && len ? [{ label: 'Length', value: dual.angstrom(len, 3).text }, { label: 'Between', value: `${p.elementA} and ${p.elementB}` }] : undefined;
        return { id: bondInfoId(p.order), extra };
      }
      return null;
    };
    const offHover = viewer.onHover((p) => {
      if (card.isPinned()) return;
      const hit = infoFor(p);
      if (hit) card.show(hit.id, { x: p.clientX, y: p.clientY, extra: hit.extra });
      else card.hideHover();
    });
    const offTapInfo = viewer.onTapInfo((p) => {
      const hit = infoFor(p);
      if (!hit) { viewer.clearHighlight(); if (card.isOpen()) card.hide(); return; }
      viewer.highlight(p.kind === 'atom' ? [p.index] : [p.a, p.b]);
      card.show(hit.id, { x: p.clientX, y: p.clientY, pinned: true, extra: hit.extra });
    });
    this._cleanup.push(offHover, offTapInfo);
    let alive = true;
    this._cleanup.push(() => { alive = false; });
    card.onClose(() => { if (alive) viewer.clearHighlight(); });

    // ----- tapping atoms with the measuring tool (level 5) -----
    const offTap = stage.onTap(({ clientX, clientY }) => {
      if (!measuring) return;
      const hit = viewer.pickAtom(clientX, clientY);
      if (!hit) { viewer.clearHighlight(); return; }
      const r = viewer.measure.add(hit.index);
      viewer.highlight([hit.index]);
      paintMeasure(r);
    });
    this._cleanup.push(offTap);
  },
  unmount() {
    this._cleanup.splice(0).reverse().forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  },
};
