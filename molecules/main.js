// molecules/main.js  store, mode switching and panel tabs for Molecules and Crystals.
// Each mode default-exports { id, label, panelTitles, mount(ctx), unmount() }.
// ctx = { stageEl, panelA, panelB, panelC, summaryEl, store, stage, isNarrow() }

import { createStage } from '../shared/scene.js';
import { tabs } from '../shared/ui.js';
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
  stage = createStage(stageEl, { fov: 25 });
  try {
    mode.mount({ stageEl, panelA, panelB, panelC, summaryEl, store, stage, isNarrow: () => narrowMq.matches });
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
