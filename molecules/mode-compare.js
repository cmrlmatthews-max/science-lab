// molecules/mode-compare.js  STUB. Replaced by the Compare mode (part F3).
// Two small hand-typed structures (simple cubic and body-centered cubic, a = 3 Å) toggled by a segmented control.
// Does not import the data files. Mode default export: { id, label, panelTitles, mount(ctx), unmount() }.

import { createViewer, viewControls } from './viewer.js';
import { el, segmented, stat, stats, banner, legend, section, sourceTag } from '../shared/ui.js';

const A = 3;
const HALF = A;   // 2 x 2 cells, centered
const HINT = 'Tap two atoms to measure a distance. Tap a third for the angle.';

function simpleCubic() {
  const atoms = []; const idx = {};
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
    idx[`${i}${j}${k}`] = atoms.length;
    atoms.push({ el: 'Cu', pos: [i * A - HALF, j * A - HALF, k * A - HALF] });
  }
  const bonds = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
    const a = idx[`${i}${j}${k}`];
    if (i < 2) bonds.push({ a, b: idx[`${i + 1}${j}${k}`], order: 1 });
    if (j < 2) bonds.push({ a, b: idx[`${i}${j + 1}${k}`], order: 1 });
    if (k < 2) bonds.push({ a, b: idx[`${i}${j}${k + 1}`], order: 1 });
  }
  return { atoms, bonds, cell: { origin: [-HALF, -HALF, -HALF], a: [2 * A, 0, 0], b: [0, 2 * A, 0], c: [0, 0, 2 * A] } };
}
function bodyCentered() {
  const s = simpleCubic();
  const atoms = s.atoms.map((a) => ({ ...a, el: 'Fe' }));
  const bonds = [];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
    const c = atoms.length;
    atoms.push({ el: 'Fe', pos: [(i + 0.5) * A - HALF, (j + 0.5) * A - HALF, (k + 0.5) * A - HALF] });
    for (const di of [0, 1]) for (const dj of [0, 1]) for (const dk of [0, 1]) bonds.push({ a: c, b: (i + di) * 9 + (j + dj) * 3 + (k + dk), order: 1 });
  }
  return { atoms, bonds, cell: s.cell };
}
const SETS = {
  sc: { label: 'Simple cubic', build: simpleCubic, coord: 6, packing: '52 %', color: '#c88033', name: 'Copper-colored atoms' },
  bcc: { label: 'Body-centered', build: bodyCentered, coord: 8, packing: '68 %', color: '#e06633', name: 'Iron-colored atoms' },
};

export default {
  id: 'compare',
  label: 'Compare',
  panelTitles: { a: 'Pair', b: 'Measure', c: 'Notes' },
  _cleanup: [],
  mount(ctx) {
    const { store, stage, panelA, panelB, panelC } = ctx;
    const viewer = createViewer(stage);
    this._cleanup.push(() => viewer.dispose());
    let key = 'sc';

    const measureStat = stat({ label: 'Measurement', value: 'None', hint: HINT });
    const atomsStat = stat({ label: 'Atoms drawn', value: 0, digits: 0 });
    const coordStat = stat({ label: 'Neighbors', value: 0, digits: 0 });
    const packStat = stat({ label: 'Packing', value: '' });

    const show = () => {
      const set = SETS[key];
      const st = set.build();
      viewer.setStructure(st, { style: store.get().view.style });
      viewer.setCell(st.cell);
      viewer.setPlanes([]);
      viewer.frame();
      measureStat.update({ value: 'None', unit: '', hint: HINT });
      atomsStat.update({ value: st.atoms.length });
      coordStat.update({ value: set.coord });
      packStat.update({ value: set.packing });
    };
    const pick = segmented({
      label: 'Structure', options: Object.entries(SETS).map(([value, s]) => ({ value, label: s.label })), value: key,
      onChange: (v) => { key = v; show(); },
    });
    panelA.append(section('Compare', pick.el), viewControls(store, viewer));
    panelB.append(section('Measure', measureStat.el), section('Numbers', stats(atomsStat.el, coordStat.el, packStat.el)));
    panelC.append(section('Notes',
      banner({ kind: 'info', title: 'Stub values', text: 'Two hand-typed 2 x 2 x 2 blocks. Real comparison pairs arrive in the next step.' }),
      el('div', { class: 'row' }, el('span', { class: 'muted', text: 'Source' }), sourceTag('Schematic stub')),
      legend([{ color: '#c88033', label: 'Simple cubic atom' }, { color: '#e06633', label: 'Body-centered atom' }])));

    show();
    const offTap = stage.onTap(({ clientX, clientY }) => {
      const hit = viewer.pickAtom(clientX, clientY);
      if (!hit) { viewer.clearHighlight(); return; }
      const m = viewer.measure.add(hit.index);
      viewer.highlight([hit.index]);
      if (m.type === 'distance') measureStat.update({ value: m.value, digits: 2, unit: 'Å', hint: 'Distance between the two atoms. 1 Å is 0.1 nanometer.' });
      else if (m.type === 'angle') measureStat.update({ value: m.value, digits: 1, unit: '°', hint: 'Angle at the second atom you tapped.' });
      else measureStat.update({ value: 'None', unit: '', hint: 'Tap one more atom to measure a distance.' });
    });
    this._cleanup.push(offTap);
  },
  unmount() {
    this._cleanup.splice(0).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  },
};
