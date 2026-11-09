// molecules/mode-molecules.js  STUB. Replaced by the Molecules mode (part D3).
// Shows two hand-typed molecules (water, carbon dioxide) through createViewer so every viewer feature is visible.
// Does not import the data files. Mode default export: { id, label, panelTitles, mount(ctx), unmount() }.

import { createViewer, viewControls } from './viewer.js';
import { el, segmented, toggle, stat, stats, banner, legend, section, sourceTag } from '../shared/ui.js';

const WATER = {
  name: 'Water', formula: 'H2O', mass: '18.015',
  atoms: [{ el: 'O', pos: [0, 0, 0] }, { el: 'H', pos: [0.7568, 0.5859, 0] }, { el: 'H', pos: [-0.7568, 0.5859, 0] }],
  bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }],
};
const CO2 = {
  name: 'Carbon dioxide', formula: 'CO2', mass: '44.009',
  atoms: [{ el: 'C', pos: [0, 0, 0] }, { el: 'O', pos: [1.16, 0, 0] }, { el: 'O', pos: [-1.16, 0, 0] }],
  bonds: [{ a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 2 }],
};
const LIST = { water: WATER, co2: CO2 };
const HINT = 'Tap two atoms to measure a distance. Tap a third for the angle.';

export default {
  id: 'molecules',
  label: 'Molecules',
  panelTitles: { a: 'Structure', b: 'Measure', c: 'Notes' },
  _cleanup: [],
  mount(ctx) {
    const { store, stage, panelA, panelB, panelC } = ctx;
    const viewer = createViewer(stage);
    this._cleanup.push(() => viewer.dispose());
    const cur = () => (LIST[store.get().molecules.id] ? store.get().molecules.id : 'water');

    const measureStat = stat({ label: 'Measurement', value: 'None', hint: HINT });
    const nameStat = stat({ label: 'Molecule', value: '', hint: '' });
    const massStat = stat({ label: 'Molar mass', value: 0, unit: 'g/mol', digits: 2 });

    function paintMeasure(m, mol) {
      if (m.type === 'distance') {
        const [a, b] = m.indices.map((i) => mol.atoms[i].el);
        measureStat.update({ value: m.value, digits: 2, unit: 'Å', hint: `Distance between ${a} and ${b}. 1 Å is 0.1 nanometer.` });
      } else if (m.type === 'angle') {
        measureStat.update({ value: m.value, digits: 1, unit: '°', hint: `Angle at ${mol.atoms[m.indices[1]].el}.` });
      } else if (m.indices.length === 1) {
        measureStat.update({ value: 'None', unit: '', hint: 'Tap one more atom to measure a distance.' });
      } else measureStat.update({ value: 'None', unit: '', hint: HINT });
    }

    const show = () => {
      const id = cur();
      const mol = LIST[id];
      viewer.setStructure({ atoms: mol.atoms, bonds: mol.bonds }, { style: store.get().view.style });
      viewer.setArrows(id === 'water' && store.get().molecules.showDipole
        ? [{ from: [0, 1.05, 0], to: [0, -0.75, 0], label: '1.85 D' }] : []);
      viewer.frame();
      paintMeasure({ type: 'none', indices: [] }, mol);
      nameStat.update({ value: `${mol.name}, ${mol.formula}` });
      massStat.update({ value: Number(mol.mass) });
    };

    const pick = segmented({
      label: 'Molecule', options: [{ value: 'water', label: 'Water' }, { value: 'co2', label: 'Carbon dioxide' }], value: cur(),
      onChange: (v) => { store.set({ molecules: { ...store.get().molecules, id: v } }); show(); },
    });
    const dip = toggle({
      label: 'Show dipole arrow', value: store.get().molecules.showDipole,
      onChange: (v) => { store.set({ molecules: { ...store.get().molecules, showDipole: v } }); show(); },
    });
    panelA.append(section('Choose', pick.el, dip.el), viewControls(store, viewer));
    panelB.append(section('Measure', measureStat.el), section('Facts', stats(nameStat.el, massStat.el)));
    panelC.append(
      section('Notes',
        banner({ kind: 'info', title: 'Stub values', text: 'Hand-typed water and carbon dioxide. The real library arrives in the next step.' }),
        el('div', { class: 'row' }, el('span', { class: 'muted', text: 'Source' }), sourceTag('Schematic stub')),
        legend([{ color: '#e8312f', label: 'Oxygen' }, { color: '#f2f2f2', label: 'Hydrogen' }, { color: '#555a60', label: 'Carbon' }])),
    );

    show();
    const offTap = stage.onTap(({ clientX, clientY }) => {
      const hit = viewer.pickAtom(clientX, clientY);
      if (!hit) { viewer.clearHighlight(); return; }
      const m = viewer.measure.add(hit.index);
      viewer.highlight([hit.index]);
      paintMeasure(m, LIST[cur()]);
    });
    this._cleanup.push(offTap);
  },
  unmount() {
    this._cleanup.splice(0).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  },
};
