// shared/simple.js — the "simple first" pattern used by the concept-level modules
// (Orbital Mechanics, Molecules and Crystals).
//
// Every mode built with this pattern shows, in this order:
//   1. question()       one plain question the mode answers
//   2. two or three controls (from shared/ui.js)
//   3. answer()         one large plain statement that updates
//   4. tryThis()        three or four guided steps the user can tap
//   5. numbersSwitch()  a "Show numbers" switch; the detailed tiles stay hidden until it is on
//
// Classes are defined at the end of shared/style.css (section "Simple pattern").

import { el, toggle } from './ui.js';

/**
 * The one plain question a mode answers. Put it first in panel A.
 * @param {string} text  e.g. "How fast must you go to stay in orbit?"
 * @param {string} [sub] one short supporting line
 * @returns {HTMLElement}
 */
export function question(text, sub) {
  const box = el('div', { class: 'simple-q' }, el('h3', { class: 'simple-q-text', text }));
  if (sub) box.append(el('p', { class: 'simple-q-sub', text: sub }));
  return box;
}

/**
 * One large plain-word answer. Put it first in panel B.
 * @param {{kind?:'ok'|'warn'|'info', title:string, text?:string}} opts
 * @returns {{el:HTMLElement, update:(patch:{kind?:string,title?:string,text?:string})=>void}}
 */
export function answer(opts = {}) {
  const titleEl = el('div', { class: 'simple-answer-title' });
  const textEl = el('p', { class: 'simple-answer-text' });
  const box = el('div', { class: 'simple-answer', role: 'status', 'aria-live': 'polite' }, titleEl, textEl);
  const state = { kind: 'info', title: '', text: '' };
  function update(patch = {}) {
    Object.assign(state, patch);
    box.dataset.kind = state.kind || 'info';
    titleEl.textContent = state.title || '';
    textEl.textContent = state.text || '';
    textEl.hidden = !state.text;
  }
  update(opts);
  return { el: box, update };
}

/**
 * Guided steps. Each step is a button that sets the controls for the user.
 * A step shows a check mark after it is used.
 * @param {{label:string, hint?:string, run:()=>void}[]} steps
 * @param {{title?:string}} [opts]
 * @returns {HTMLElement}
 */
export function tryThis(steps, opts = {}) {
  const list = el('ol', { class: 'simple-try-list' });
  steps.forEach((step, i) => {
    const num = el('span', { class: 'simple-try-num', text: String(i + 1) });
    const body = el('span', { class: 'simple-try-body' }, el('span', { class: 'simple-try-label', text: step.label }));
    if (step.hint) body.append(el('span', { class: 'simple-try-hint', text: step.hint }));
    const btn = el('button', { class: 'simple-try-btn', type: 'button' }, num, body);
    btn.addEventListener('click', () => {
      step.run();
      btn.dataset.done = 'true';
      num.textContent = '✓';
    });
    list.append(el('li', {}, btn));
  });
  return el('div', { class: 'simple-try' }, el('div', { class: 'simple-try-title', text: opts.title || 'Try this' }), list);
}

/**
 * "Show numbers" switch. The content stays hidden until the switch is on.
 * @param {{label?:string, value?:boolean, onChange?:(v:boolean)=>void}} opts
 * @param {...HTMLElement} content  the detailed tiles, tables, and graphs
 * @returns {{el:HTMLElement, set:(v:boolean)=>void, get:()=>boolean}}
 */
export function numbersSwitch(opts = {}, ...content) {
  const body = el('div', { class: 'simple-numbers-body' }, ...content);
  let on = !!opts.value;
  const t = toggle({
    label: opts.label || 'Show numbers',
    value: on,
    onChange: (v) => { on = !!v; body.hidden = !on; if (opts.onChange) opts.onChange(on); },
  });
  body.hidden = !on;
  const box = el('div', { class: 'simple-numbers' }, t.el, body);
  return {
    el: box,
    set(v) { on = !!v; t.set(on); body.hidden = !on; },
    get() { return on; },
  };
}

/**
 * A short plain-word note.
 * @param {string} text
 * @returns {HTMLElement}
 */
export function note(text) {
  return el('p', { class: 'simple-note', text });
}
