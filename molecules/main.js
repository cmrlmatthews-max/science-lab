// molecules/main.js  store, mode switching and panel tabs for Molecules and Crystals.
// Each mode default-exports { id, label, panelTitles, mount(ctx), unmount() }.
// ctx = { stageEl, panelA, panelB, panelC, summaryEl, store, stage, isNarrow(),
//         layers (shared/layers.js controller), card (shared/card.js), setPanelMin(panel, min) }
// The store holds `level` (1–5, always 1 on page load). The layer bar is always on screen.

import { createStage } from '../shared/scene.js';
import { tabs } from '../shared/ui.js';
import { createLayers, mountBar } from '../shared/layers.js';
import { createCard } from '../shared/card.js';
import { configureRenderer } from './viewer.js';
import molecules from './mode-molecules.js';
import crystals from './mode-crystals.js';
import compare from './mode-compare.js';

/**
 * Tiny observable store.
 * @template T
 * @param {T} initialState
 * @returns {{get:()=>T, set:(patch:Partial<T>)=>void, update:(fn:(s:T)=>Partial<T>|void)=>void, subscribe:(fn:(s:T, prev:T)=>void)=>(()=>void)}}
 */
export function createStore(initialState) {
  let state = initialState;
  const subs = new Set();
  const notify = (prev) => { for (const fn of Array.from(subs)) fn(state, prev); };
  return {
    get: () => state,
    set(patch) { const prev = state; state = { ...state, ...patch }; notify(prev); },
    update(fn) {
      const prev = state;
      const next = fn(state);
      state = next && next !== state ? { ...state, ...next } : { ...state };
      notify(prev);
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

export const store = createStore({
  mode: 'molecules',
  level: 1,                              // information layer 1–5 (not saved; every visit starts at 1)
  view: { style: 'ball-stick', labels: false, spin: false },
  molecules: { id: 'water', showDipole: true },
  crystals: { id: 'fe_bcc', nx: 2, ny: 2, nz: 2, showCell: true, plane: null, showBonds: true },
  compare: { pairId: 'iron' },
});

const MODES = [molecules, crystals, compare];
const byId = Object.fromEntries(MODES.map((m) => [m.id, m]));
const narrowMq = window.matchMedia('(max-width: 899px)');

const stageEl = document.getElementById('stage');
const panelA = document.getElementById('panel-a');
const panelB = document.getElementById('panel-b');
const panelC = document.getElementById('panel-c');
const summaryEl = document.getElementById('summary');
const titleEls = { a: document.getElementById('title-a'), b: document.getElementById('title-b'), c: document.getElementById('title-c') };
const wraps = Array.from(document.querySelectorAll('.panel-wrap'));
const appEl = document.querySelector('.app');
const shellEl = document.querySelector('.shell');
const headerEl = document.querySelector('.app-header');
const stageWrap = document.querySelector('.stage-wrap');
document.body.classList.add('sl-layers');

let current = null;
let stage = null;
let activePanel = 'a';

// ----- mode tabs (header) -----
const modeTabs = tabs({
  items: MODES.map((m) => ({ value: m.id, label: m.label })),
  value: store.get().mode,
  className: 'tabs-modes',
  label: 'Mode',
  onChange: (id) => { if (location.hash !== `#${id}`) location.hash = id; else switchMode(id); },
});
document.querySelector('.app-header').appendChild(modeTabs.el);

// ----- panel tabs (narrow bottom sheet) -----
const panelTabs = tabs({
  items: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }],
  value: 'a',
  className: 'tabs-sheet',
  label: 'Panels',
  onChange: showPanel,
});
document.getElementById('sheet').prepend(panelTabs.el);
panelTabs.el.classList.add('sheet-tabs');

// ----- information layers: bar, card, hidden panels -----
const layers = createLayers({ get: () => store.get().level, set: (n) => store.set({ level: n }) });
store.subscribe(() => layers.sync());
mountBar(layers, { header: headerEl, shell: shellEl, summary: summaryEl });
const card = createCard(stageWrap, { getInfo: () => null, layers, topEl: layers.bar() });
const panelMin = { b: 1, c: 1 };

function applyPanels() {
  const lv = layers.level();
  appEl.dataset.level = String(lv);
  for (const p of ['b', 'c']) {
    const off = lv < panelMin[p];
    wraps.forEach((w) => { if (w.dataset.panel === p) w.hidden = off; });
    const tabBtn = panelTabs.el.querySelector(`[data-value="${p}"]`);
    if (tabBtn) tabBtn.hidden = off;
    shellEl.classList.toggle(`sl-no-${p}`, off);
    if (off && activePanel === p) showPanel('a');
  }
}
/** Hide panel 'b' or 'c' (and its phone tab) below level `min`; the 3D view uses the space on wide screens. */
function setPanelMin(panel, min) {
  if (panel !== 'b' && panel !== 'c') return;
  panelMin[panel] = Math.max(1, Math.min(5, Math.round(min) || 1));
  applyPanels();
}
layers.watch(() => { applyPanels(); card.refresh(); });


function showPanel(which) {
  activePanel = which;
  wraps.forEach((w) => w.classList.toggle('is-active', w.dataset.panel === which));
  panelTabs.set(which);
}

function clearPanels() {
  for (const p of [panelA, panelB, panelC]) { p.replaceChildren(); p.scrollTop = 0; }
  summaryEl.replaceChildren();
  stageEl.replaceChildren();
}

function showError(err) {
  console.error(err);
  const box = document.createElement('div');
  box.className = 'banner banner-warn';
  box.setAttribute('role', 'alert');
  box.innerHTML = '<span class="banner-icon" aria-hidden="true">!</span><div><div class="banner-title">This mode could not start</div><div class="banner-text"></div></div>';
  box.querySelector('.banner-text').textContent = String(err && err.message ? err.message : err);
  panelA.replaceChildren(box);
}

function switchMode(id) {
  const mode = byId[id] || byId.molecules;
  if (current === mode && stage) return;
  if (current) {
    try { current.unmount(); } catch (e) { console.error(e); }
  }
  layers.reset();          // forget the old mode's gates and listeners
  card.hide();
  card.setSource(() => null);
  panelMin.b = 1; panelMin.c = 1;
  if (stage) { stage.dispose(); stage = null; }
  clearPanels();
  current = mode;
  store.set({ mode: mode.id });
  modeTabs.set(mode.id);
  const t = mode.panelTitles;
  titleEls.a.textContent = t.a;
  titleEls.b.textContent = t.b;
  titleEls.c.textContent = t.c;
  panelTabs.setLabels([{ value: 'a', label: t.a }, { value: 'b', label: t.b }, { value: 'c', label: t.c }]);
  document.title = `${mode.label} · Molecules and Crystals`;
  showPanel('a');
  applyPanels();
  stage = createStage(stageEl, { fov: 25 });
  configureRenderer(stage);   // ACES filmic tone mapping, sRGB output, soft shadow map
  try {
    mode.mount({ stageEl, panelA, panelB, panelC, summaryEl, store, stage, isNarrow: () => narrowMq.matches, layers, card, setPanelMin });
  } catch (e) {
    showError(e);
  }
  stage.requestRender();
}

function modeFromHash() {
  const id = location.hash.replace('#', '');
  return byId[id] ? id : 'molecules';
}
window.addEventListener('hashchange', () => switchMode(modeFromHash()));

if (!byId[location.hash.replace('#', '')]) history.replaceState(null, '', `#${modeFromHash()}`);
switchMode(modeFromHash());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../sw.js').catch((e) => console.warn('Service worker not registered', e));
  });
}
