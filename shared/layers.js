// shared/layers.js — the five information layers (Start, Story, Explore, Numbers, Deep).
//
//   const layers = createLayers({ get: () => store.get().level, set: (n) => store.set({ level: n }) });
//   layers.gate(el, 3)            element visible at level 3 and up
//   layers.gateFn((on) => ..., 4) call fn(true/false) now and on every level change
//   story(steps, opts)            guided story widget (level 2)
//   tile({label, us, si, compare})  level-4 stat tile
//   moreLink(layers)              "Tell me more" button
//
// The pure logic (createLayers without bar) needs no DOM and runs in Node. Only bar(), story(), tile()
// and moreLink() build elements. Class names (.sl-*) are in the "Layers" section of shared/style.css.

import { el } from './ui.js';
import { infoButton } from './card.js';

export const LEVELS = [
  { n: 1, id: 'start',   name: 'Start',   hint: 'The big idea' },
  { n: 2, id: 'story',   name: 'Story',   hint: 'A short guided story' },
  { n: 3, id: 'explore', name: 'Explore', hint: 'Try it yourself' },
  { n: 4, id: 'numbers', name: 'Numbers', hint: 'The values, with comparisons' },
  { n: 5, id: 'deep',    name: 'Deep',    hint: 'Formulas and full data' },
];

const clampLevel = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 1;
};

/**
 * Create the layer controller.
 * @param {{get:()=>number, set:(n:number)=>void}} io  get() returns 1–5, set(n) stores it
 */
export function createLayers({ get, set }) {
  const readLevel = () => clampLevel(get());
  let last = readLevel();
  const gates = [];      // { el, min, max }
  const fns = [];        // { fn, min, max }
  const listeners = [];  // mode listeners, forgotten by reset()
  const watchers = [];   // shell listeners, kept by reset()

  const inRange = (lv, min, max) => lv >= min && lv <= max;

  function applyGates() {
    const lv = readLevel();
    for (const g of gates) g.el.hidden = !inRange(lv, g.min, g.max);
  }
  function runFns() {
    const lv = readLevel();
    for (const g of fns.slice()) {
      try { g.fn(inRange(lv, g.min, g.max)); } catch (e) { console.error(e); }
    }
  }
  // Called after any change of the stored level (setLevel, or the store changed elsewhere).
  function commit() {
    const lv = readLevel();
    if (lv === last) return false;
    const prev = last;
    last = lv;
    applyGates();
    for (const w of watchers.slice()) { try { w(lv, prev); } catch (e) { console.error(e); } }
    runFns();
    for (const l of listeners.slice()) { try { l(lv, prev); } catch (e) { console.error(e); } }
    return true;
  }

  let barEl = null;

  const api = {
    level: readLevel,
    setLevel(n) {
      const lv = clampLevel(n);
      if (lv !== readLevel()) set(lv);
      if (!commit()) applyGates();
    },
    /** Re-read the stored level (call when the store may have changed from outside). */
    sync() { commit(); },
    onChange(fn) {
      listeners.push(fn);
      return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },
    /** Shell-only listener that survives reset(). */
    watch(fn) {
      watchers.push(fn);
      return () => { const i = watchers.indexOf(fn); if (i >= 0) watchers.splice(i, 1); };
    },
    gate(node, min = 1, max = 5) {
      gates.push({ el: node, min, max });
      node.hidden = !inRange(readLevel(), min, max);
      return node;
    },
    gateFn(fn, min = 1, max = 5) {
      fns.push({ fn, min, max });
      try { fn(inRange(readLevel(), min, max)); } catch (e) { console.error(e); }
    },
    is: (min, max = 5) => inRange(readLevel(), min, max),
    reset() { gates.length = 0; fns.length = 0; listeners.length = 0; },
    bar() {
      if (!barEl) barEl = buildBar(api, watchers);
      return barEl;
    },
  };
  return api;
}

// ---------- layer bar ----------
function buildBar(layers, watchers) {
  const less = el('button', { type: 'button', class: 'sl-btn sl-less', 'aria-label': 'Show simpler information' },
    el('span', { class: 'sl-arrow', 'aria-hidden': 'true', text: '‹' }), el('span', { text: 'Simpler' }));
  const more = el('button', { type: 'button', class: 'sl-btn sl-more', 'aria-label': 'Show more information' },
    el('span', { text: 'Tell me more' }), el('span', { class: 'sl-arrow', 'aria-hidden': 'true', text: '›' }));
  const steps = LEVELS.map((L) => el('button', {
    type: 'button', class: 'sl-step', 'data-level': String(L.n),
    'aria-label': `Level ${L.n} of 5, ${L.name}. ${L.hint}`,
  }, el('span', { class: 'sl-num', 'aria-hidden': 'true', text: String(L.n) }), el('span', { class: 'sl-name', 'aria-hidden': 'true', text: L.name })));
  const list = el('ol', { class: 'sl-steps' }, steps.map((b) => el('li', {}, b)));
  const nowName = el('span', { class: 'sl-now-name' });
  const nowHint = el('span', { class: 'sl-now-hint' });
  const now = el('div', { class: 'sl-now', 'aria-hidden': 'true' }, nowName, nowHint);
  const live = el('span', { class: 'sl-live', role: 'status', 'aria-live': 'polite' });
  const mid = el('div', { class: 'sl-mid' }, now, list);
  const bar = el('nav', { class: 'sl-bar', 'aria-label': 'Level of detail' }, less, mid, more, live);

  less.addEventListener('click', () => layers.setLevel(layers.level() - 1));
  more.addEventListener('click', () => layers.setLevel(layers.level() + 1));
  steps.forEach((b, i) => {
    b.addEventListener('click', () => layers.setLevel(i + 1));
    b.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const n = Math.min(5, Math.max(1, i + 1 + d));
      layers.setLevel(n);
      steps[n - 1].focus();
    });
  });

  function paint() {
    const lv = layers.level();
    const L = LEVELS[lv - 1];
    steps.forEach((b, i) => {
      const on = i + 1 === lv;
      if (on) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.dataset.state = i + 1 < lv ? 'past' : on ? 'now' : 'next';
    });
    nowName.textContent = L.name;
    nowHint.textContent = L.hint;
    less.disabled = lv <= 1;
    more.disabled = lv >= 5;
    live.textContent = `Level ${lv} of 5: ${L.name}. ${L.hint}.`;
    bar.dataset.level = String(lv);
  }
  paint();
  watchers.push(paint);
  return bar;
}

/**
 * Put the layer bar where it is always visible: wide screens, a strip under the header;
 * phone, directly under the 3D view (before the summary line). Moves when the screen size changes.
 * @param {object} layers
 * @param {{header:HTMLElement, shell:HTMLElement, summary:HTMLElement, query?:string}} o
 * @returns {()=>void} dispose
 */
export function mountBar(layers, { header, shell, summary, query = '(max-width: 899px)' }) {
  const bar = layers.bar();
  const mq = window.matchMedia(query);
  const place = () => {
    if (mq.matches) { if (bar.parentNode !== shell || bar.nextSibling !== summary) shell.insertBefore(bar, summary); }
    else if (bar.previousSibling !== header) header.after(bar);
  };
  place();
  if (mq.addEventListener) mq.addEventListener('change', place); else mq.addListener(place);
  return () => {
    if (mq.removeEventListener) mq.removeEventListener('change', place); else mq.removeListener(place);
    bar.remove();
  };
}

// ---------- story ----------
/**
 * Guided story. Each step may set the 3D view and the controls through run().
 * @param {{title:string, text:string, life?:string, run?:()=>void}[]} steps
 * @param {{title?:string, onStep?:(i:number)=>void, autoRun?:boolean}} [opts]
 * @returns {{el:HTMLElement, go:(i:number)=>void, index:()=>number, reset:()=>void}}
 */
export function story(steps, opts = {}) {
  let idx = 0;
  const count = el('span', { class: 'sl-story-count' });
  const head = el('div', { class: 'sl-story-head' }, el('span', { class: 'sl-story-kicker', text: opts.title || 'The story' }), count);
  const title = el('h3', { class: 'sl-story-title' });
  const text = el('p', { class: 'sl-story-text' });
  const lifeText = el('span', { class: 'sl-story-life-text' });
  const life = el('div', { class: 'sl-story-life' }, el('span', { class: 'sl-story-life-h', text: 'In your life' }), lifeText);
  const back = el('button', { type: 'button', class: 'btn sl-story-btn', text: 'Back' });
  const next = el('button', { type: 'button', class: 'btn btn-primary sl-story-btn', text: 'Next' });
  const dots = el('div', { class: 'sl-story-dots', 'aria-hidden': 'true' }, steps.map(() => el('span', { class: 'sl-story-dot' })));
  const box = el('section', { class: 'sl-story', 'aria-label': opts.title || 'The story' },
    head, title, text, life, el('div', { class: 'sl-story-nav' }, back, dots, next));

  function paint() {
    const s = steps[idx];
    count.textContent = `${idx + 1} of ${steps.length}`;
    title.textContent = s.title || '';
    text.textContent = s.text || '';
    lifeText.textContent = s.life || '';
    life.hidden = !s.life;
    back.disabled = idx === 0;
    const last = idx === steps.length - 1;
    next.textContent = last ? 'Start again' : 'Next';
    Array.from(dots.children).forEach((d, i) => { d.dataset.on = i <= idx ? 'true' : 'false'; });
  }
  function go(i, run = true) {
    if (!steps.length) return;
    idx = Math.min(steps.length - 1, Math.max(0, Math.round(i) || 0));
    paint();
    if (run) {
      const s = steps[idx];
      try { if (s.run) s.run(); } catch (e) { console.error(e); }
      if (opts.onStep) { try { opts.onStep(idx); } catch (e) { console.error(e); } }
    }
  }
  back.addEventListener('click', () => go(idx - 1));
  next.addEventListener('click', () => go(idx === steps.length - 1 ? 0 : idx + 1));
  paint();

  if (opts.autoRun && typeof IntersectionObserver !== 'undefined') {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); go(0); }
    });
    io.observe(box);
  } else if (opts.autoRun) go(0);

  return { el: box, go: (i) => go(i), index: () => idx, reset() { idx = 0; paint(); } };
}

// ---------- stat tile ----------
/**
 * Level-4 stat tile: the US value large, the metric value after it, one comparison line under it.
 * @param {{label:string, us?:string|null, si?:string|null, compare?:string, infoId?:string}} p
 * @returns {{el:HTMLElement, update:(p:{us?:string|null, si?:string|null, compare?:string})=>void}}
 */
export function tile({ label, us, si, compare, infoId }) {
  const state = { us, si, compare };
  const head = el('div', { class: 'sl-tile-head' }, el('span', { class: 'sl-tile-label', text: label }));
  if (infoId) head.append(infoButton(null, infoId, { label }));
  const usEl = el('span', { class: 'sl-tile-us' });
  const siEl = el('span', { class: 'sl-tile-si' });
  const cmpEl = el('div', { class: 'sl-tile-compare' });
  const box = el('div', { class: 'sl-tile' }, head, el('div', { class: 'sl-tile-value' }, usEl, siEl), cmpEl);
  function paint() {
    const main = state.us || state.si || '—';
    usEl.textContent = main;
    const second = state.us && state.si ? state.si : '';
    siEl.textContent = second ? `(${second})` : '';
    siEl.hidden = !second;
    cmpEl.textContent = state.compare || '';
    cmpEl.hidden = !state.compare;
  }
  paint();
  return { el: box, update(p = {}) { Object.assign(state, p); paint(); } };
}

// ---------- "Tell me more" ----------
/**
 * Button that shows the next layer. Hidden at level 5. Registered with layers.onChange (cleared by reset()).
 * @param {object} layers
 * @param {string} [text]
 */
export function moreLink(layers, text = 'Tell me more') {
  const b = el('button', { type: 'button', class: 'sl-more-link' }, el('span', { text }), el('span', { 'aria-hidden': 'true', text: '›' }));
  b.addEventListener('click', () => layers.setLevel(layers.level() + 1));
  layers.gate(b, 1, 4);
  return b;
}
