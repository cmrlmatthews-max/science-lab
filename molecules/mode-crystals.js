// molecules/mode-crystals.js  STUB. Replaced by the Crystals mode (part E3).
// Shows a hand-typed 3 x 3 x 3 simple-cubic block (a = 3 Å) with its cell box, one (111) plane polygon and
// tag-faded boundary atoms. Does not import the data files.
// Mode default export: { id, label, panelTitles, mount(ctx), unmount() }.

import { createViewer, viewControls } from './viewer.js';
import { el, toggle, slider, stat, stats, banner, legend, section, sourceTag } from '../shared/ui.js';

const A = 3;
const N = 3;
const HALF = (A * N) / 2;
const HINT = 'Tap two atoms to measure a distance. Tap a third for the angle.';

function buildBlock() {
  const atoms = [];
  const index = {};
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) for (let k = 0; k <= N; k++) {
    index[`${i},${j},${k}`] = atoms.length;
    atoms.push({ el: 'Fe', pos: [i * A - HALF, j * A - HALF, k * A - HALF], tag: i === N || j === N || k === N ? 'boundary' : 'inner' });
  }
  const bonds = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) for (let k = 0; k <= N; k++) {
    const a = index[`${i},${j},${k}`];
    if (i < N) bonds.push({ a, b: index[`${i + 1},${j},${k}`], order: 1 });
    if (j < N) bonds.push({ a, b: index[`${i},${j + 1},${k}`], order: 1 });
    if (k < N) bonds.push({ a, b: index[`${i},${j},${k + 1}`], order: 1 });
  }
  const cell = { origin: [-HALF, -HALF, -HALF], a: [A * N, 0, 0], b: [0, A * N, 0], c: [0, 0, A * N] };
  return { atoms, bonds, cell };
}

// polygon where x + y + z = s cuts the cube [-HALF, HALF]^3 (edge intersections, deliberately unordered)
function planePolygon(s) {
  const pts = [];
  const c = [-HALF, HALF];
  for (const axis of [0, 1, 2]) for (const u of c) for (const v of c) {
    const other = u + v;
    const t = s - other;
    if (t >= -HALF - 1e-9 && t <= HALF + 1e-9) {
      const p = [0, 0, 0];
      const o = [0, 1, 2].filter((q) => q !== axis);
      p[axis] = t; p[o[0]] = u; p[o[1]] = v;
      if (!pts.some((q) => q.every((x, n) => Math.abs(x - p[n]) < 1e-9))) pts.push(p);
    }
  }
  return pts;
}

export default {
  id: 'crystals',
  label: 'Crystals',
  panelTitles: { a: 'Crystal', b: 'Measure', c: 'Notes' },
  _cleanup: [],
  mount(ctx) {
    const { store, stage, panelA, panelB, panelC } = ctx;
    const viewer = createViewer(stage);
    this._cleanup.push(() => viewer.dispose());
    const block = buildBlock();
    const local = { fade: true, plane: true, scale: 1 };

    const measureStat = stat({ label: 'Measurement', value: 'None', hint: HINT });
    const countStat = stat({ label: 'Atoms drawn', value: block.atoms.length, digits: 0 });
    const spacingStat = stat({ label: 'Spacing', value: A, unit: 'Å', digits: 2 });

    const apply = (reframe) => {
      const cr = store.get().crystals;
      viewer.setStructure(
        { atoms: block.atoms, bonds: cr.showBonds ? block.bonds : [], cell: block.cell },
        { style: store.get().view.style, fade: local.fade ? { boundary: 0.3 } : {}, radiusScale: local.scale },
      );
      viewer.setCell(cr.showCell ? block.cell : null);
      viewer.setPlanes(local.plane ? [{ points: planePolygon(-1.5), label: '(111) plane' }] : []);
      if (reframe) viewer.frame();
    };

    const setCr = (patch) => store.set({ crystals: { ...store.get().crystals, ...patch } });
    panelA.append(
      section('Show',
        toggle({ label: 'Cell box', value: store.get().crystals.showCell, onChange: (v) => { setCr({ showCell: v }); apply(false); } }).el,
        toggle({ label: 'Bonds', value: store.get().crystals.showBonds, onChange: (v) => { setCr({ showBonds: v }); apply(false); } }).el,
        toggle({ label: '(111) plane', value: local.plane, onChange: (v) => { local.plane = v; apply(false); } }).el,
        toggle({ label: 'Fade boundary atoms', value: local.fade, onChange: (v) => { local.fade = v; apply(false); } }).el,
        slider({ label: 'Atom size', min: 0.6, max: 2.2, step: 0.1, value: 1, onInput: (v) => { local.scale = v; apply(false); } }).el),
      viewControls(store, viewer),
    );
    panelB.append(section('Measure', measureStat.el), section('Block', stats(countStat.el, spacingStat.el)));
    panelC.append(section('Notes',
      banner({ kind: 'info', title: 'Stub values', text: 'A hand-typed simple cubic block. Faded atoms are copies on the outer faces. Real crystals arrive in the next step.' }),
      el('div', { class: 'row' }, el('span', { class: 'muted', text: 'Source' }), sourceTag('Schematic stub')),
      legend([{ color: '#e06633', label: 'Iron atom' }])));

    apply(true);
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
