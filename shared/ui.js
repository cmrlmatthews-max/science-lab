// shared/ui.js  DOM helpers and controls for Science Lab panels.
// Pure DOM, no Three.js. Class names are documented at the top of shared/style.css.
// Every control returns { el, set(v), get() } (or similar); set() never fires the callback.

/**
 * Create an element.
 * @param {string} tag tag name
 * @param {object} [attrs] class | text | html | dataset | on:{event:fn} | style (string or object) | any attribute. false/null/undefined skip; true sets an empty attribute.
 * @param {...(Node|string|number|null|false|Array)} children appended in order; strings become text nodes; arrays are flattened
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class' || k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
    else if (k === 'style') {
      if (typeof v === 'string') node.setAttribute('style', v);
      else Object.assign(node.style, v);
    } else node.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else node.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return node;
}

/**
 * Format a number with fixed decimals and a real minus sign. Non-finite values show an em dash.
 * @param {number} n
 * @param {number} [digits=1]
 * @returns {string}
 */
export function fmt(n, digits = 1) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  let s = n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
  return s.replace('-', '−');
}

function decimalsOf(step) {
  const s = String(step);
  return s.includes('.') ? s.split('.')[1].length : 0;
}

// ---------- source popover (one shared element) ----------
let pop = null;
let popOwner = null;
let popBound = false;

function closePopover() {
  if (pop) { pop.remove(); pop = null; }
  if (popOwner) { popOwner.setAttribute('aria-expanded', 'false'); popOwner = null; }
}
function openPopover(anchor, text) {
  if (popOwner === anchor) { closePopover(); return; }
  closePopover();
  pop = el('div', { class: 'popover', role: 'tooltip' }, el('span', { class: 'popover-cap', text: 'Source' }), String(text));
  document.body.appendChild(pop);
  popOwner = anchor;
  anchor.setAttribute('aria-expanded', 'true');
  const a = anchor.getBoundingClientRect();
  const p = pop.getBoundingClientRect();
  let left = a.left + a.width / 2 - p.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - p.width - 8));
  let top = a.bottom + 8;
  if (top + p.height > window.innerHeight - 8) top = Math.max(8, a.top - p.height - 8);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  if (!popBound) {
    popBound = true;
    document.addEventListener('pointerdown', (e) => {
      if (pop && !pop.contains(e.target) && !(popOwner && popOwner.contains(e.target))) closePopover();
    }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopover(); });
    window.addEventListener('scroll', closePopover, true);
    window.addEventListener('resize', closePopover);
  }
}

/**
 * Small pill showing where a number comes from. Tap to open a popover with the full source text.
 * @param {string} text source text, for example "BCI 7.40"
 * @returns {HTMLElement} button.src-tag
 */
export function sourceTag(text) {
  const b = el('button', { type: 'button', class: 'src-tag', 'aria-label': `Source: ${text}`, 'aria-expanded': 'false', title: String(text) }, el('span', { text: String(text) }));
  b.addEventListener('click', (e) => { e.stopPropagation(); openPopover(b, text); });
  return b;
}

/**
 * Titled group inside a panel.
 * @param {string} title shown in heavy condensed caps with a rule
 * @param {...(Node|string)} children
 * @returns {HTMLElement}
 */
export function section(title, ...children) {
  return el('section', { class: 'section' }, el('h3', { class: 'section-title', text: title }), el('div', { class: 'section-body' }, children));
}

/**
 * Boxed card with a hard drop shadow, for grouping controls.
 * @param {...(Node|string)} children
 * @returns {HTMLElement}
 */
export function card(...children) {
  return el('div', { class: 'card' }, children);
}

/**
 * Auto-fit grid for stat tiles.
 * @param {...Node} children usually stat().el
 * @returns {HTMLElement}
 */
export function stats(...children) {
  return el('div', { class: 'stats' }, children);
}

/**
 * Flex row with gap that wraps.
 * @param {...Node} children
 * @returns {HTMLElement}
 */
export function row(...children) {
  return el('div', { class: 'row' }, children);
}

function fieldHead(label, valueEl) {
  return el('div', { class: 'field-head' }, el('span', { class: 'field-label', text: label }), valueEl || null);
}

/**
 * Range slider with a large touch thumb (30 px) and a live value readout.
 * @param {object} p
 * @param {string} p.label
 * @param {number} p.min
 * @param {number} p.max
 * @param {number} p.step
 * @param {number} p.value
 * @param {string} [p.unit] shown small after the value
 * @param {(v:number)=>string} [p.format] value formatter (default: fixed decimals from step)
 * @param {(v:number)=>void} [p.onInput] fires while dragging
 * @returns {{el:HTMLElement, set:(v:number)=>void, get:()=>number}}
 */
export function slider({ label, min, max, step = 1, value, unit = '', format, onInput }) {
  const f = format || ((v) => fmt(v, decimalsOf(step)));
  const input = el('input', { type: 'range', class: 'range', min, max, step, value, 'aria-label': label });
  const num = el('span', { class: 'num' });
  const out = el('output', { class: 'field-value' }, num, unit ? el('span', { class: 'unit', text: unit }) : null);
  const paint = () => {
    const v = Number(input.value);
    num.textContent = f(v);
    input.style.setProperty('--pct', `${((v - min) / (max - min || 1)) * 100}%`);
  };
  input.addEventListener('input', () => { paint(); if (onInput) onInput(Number(input.value)); });
  paint();
  return {
    el: el('label', { class: 'field slider' }, fieldHead(label, out), input),
    set(v) { input.value = v; paint(); },
    get() { return Number(input.value); },
  };
}

/**
 * Native select styled for touch (16 px text, 46 px tall).
 * @param {object} p
 * @param {string} p.label
 * @param {Array<{value:string, label:string}>} p.options
 * @param {string} p.value
 * @param {(v:string)=>void} [p.onChange]
 * @returns {{el:HTMLElement, set:(v:string)=>void, get:()=>string, setOptions:(opts:Array)=>void}}
 */
export function select({ label, options, value, onChange }) {
  const input = el('select', { class: 'select-input', 'aria-label': label });
  const fill = (opts, v) => {
    input.textContent = '';
    opts.forEach((o) => input.appendChild(el('option', { value: o.value, text: o.label })));
    if (v !== undefined) input.value = v;
  };
  fill(options, value);
  input.addEventListener('change', () => { if (onChange) onChange(input.value); });
  return {
    el: el('label', { class: 'field select' }, fieldHead(label), input),
    set(v) { input.value = v; },
    get() { return input.value; },
    setOptions(opts) { const v = input.value; fill(opts, v); },
  };
}

/**
 * Segmented control (radio group of buttons).
 * @param {object} p
 * @param {string} [p.label]
 * @param {Array<{value:string, label:string}>} p.options
 * @param {string} p.value
 * @param {(v:string)=>void} [p.onChange]
 * @returns {{el:HTMLElement, set:(v:string)=>void, get:()=>string}}
 */
export function segmented({ label, options, value, onChange }) {
  let cur = value;
  const group = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label || 'Options' });
  const btns = options.map((o) => {
    const b = el('button', { type: 'button', class: 'seg-btn', role: 'radio', 'data-value': o.value, text: o.label });
    b.addEventListener('click', () => { if (cur !== o.value) { set(o.value); if (onChange) onChange(o.value); } });
    b.addEventListener('keydown', (e) => {
      const i = btns.indexOf(b);
      const n = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : null;
      if (n == null) return;
      e.preventDefault();
      const t = btns[(n + btns.length) % btns.length];
      t.focus(); t.click();
    });
    group.appendChild(b);
    return b;
  });
  function set(v) {
    cur = v;
    btns.forEach((b) => {
      const on = b.dataset.value === v;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
  }
  set(value);
  return {
    el: el('div', { class: 'field' }, label ? fieldHead(label) : null, group),
    set,
    get() { return cur; },
  };
}

/**
 * On/off switch.
 * @param {object} p
 * @param {string} p.label
 * @param {boolean} p.value
 * @param {(v:boolean)=>void} [p.onChange]
 * @returns {{el:HTMLElement, set:(v:boolean)=>void, get:()=>boolean}}
 */
export function toggle({ label, value, onChange }) {
  let cur = !!value;
  const b = el('button', { type: 'button', class: 'toggle', role: 'switch' },
    el('span', { class: 'toggle-label', text: label }),
    el('span', { class: 'toggle-track' }, el('span', { class: 'toggle-knob' })));
  const paint = () => b.setAttribute('aria-checked', cur ? 'true' : 'false');
  b.addEventListener('click', () => { cur = !cur; paint(); if (onChange) onChange(cur); });
  paint();
  return { el: b, set(v) { cur = !!v; paint(); }, get() { return cur; } };
}

/**
 * Plus / minus stepper with a value readout. Buttons are 44 px.
 * @param {object} p
 * @param {number} p.value
 * @param {number} [p.min]
 * @param {number} [p.max]
 * @param {number} [p.step=1]
 * @param {(v:number)=>string} [p.format]
 * @param {string} [p.label] accessible label, for example "Thickness"
 * @param {(v:number)=>void} [p.onChange]
 * @returns {{el:HTMLElement, set:(v:number)=>void, get:()=>number}}
 */
export function stepper({ value, min = -Infinity, max = Infinity, step = 1, format, label = 'Value', onChange }) {
  let cur = value;
  const f = format || ((v) => fmt(v, decimalsOf(step)));
  const dec = el('button', { type: 'button', class: 'stepper-btn', 'aria-label': `Decrease ${label}`, text: '−' });
  const inc = el('button', { type: 'button', class: 'stepper-btn', 'aria-label': `Increase ${label}`, text: '+' });
  const val = el('span', { class: 'stepper-val', 'aria-live': 'polite' });
  const paint = () => { val.textContent = f(cur); dec.disabled = cur <= min; inc.disabled = cur >= max; };
  const bump = (d) => {
    const n = Math.min(max, Math.max(min, +(cur + d * step).toFixed(6)));
    if (n !== cur) { cur = n; paint(); if (onChange) onChange(cur); }
  };
  dec.addEventListener('click', (e) => { e.stopPropagation(); bump(-1); });
  inc.addEventListener('click', (e) => { e.stopPropagation(); bump(1); });
  paint();
  return { el: el('div', { class: 'stepper', role: 'group', 'aria-label': label }, dec, val, inc), set(v) { cur = v; paint(); }, get() { return cur; } };
}

/**
 * Big-number result tile with optional source tag, warn state and hint.
 * @param {object} p
 * @param {string} p.label small caps label
 * @param {number|string} p.value a number is formatted with `digits` (default 1); a string is shown as is
 * @param {string} [p.unit]
 * @param {string} [p.source] source tag text
 * @param {boolean} [p.warn] red treatment
 * @param {string} [p.hint] small line below
 * @param {number} [p.digits=1]
 * @returns {{el:HTMLElement, update:(p:{value?:number|string, unit?:string, warn?:boolean, source?:string, hint?:string, digits?:number})=>void}}
 */
export function stat({ label, value, unit = '', source, warn = false, hint, digits = 1 }) {
  const root = el('div', { class: 'stat' });
  const head = el('div', { class: 'stat-head' }, el('span', { class: 'stat-label', text: label }));
  const valNum = el('span');
  const valUnit = el('span', { class: 'stat-unit' });
  const val = el('div', { class: 'stat-value' }, valNum, valUnit);
  const hintEl = el('div', { class: 'stat-hint' });
  root.append(head, val, hintEl);
  let srcEl = null;
  const state = { value, unit, source, warn, hint, digits };
  function paint() {
    valNum.textContent = typeof state.value === 'number' ? fmt(state.value, state.digits) : (state.value == null ? '—' : String(state.value));
    valUnit.textContent = state.unit || '';
    root.dataset.warn = state.warn ? 'true' : 'false';
    hintEl.textContent = state.hint || '';
    hintEl.style.display = state.hint ? '' : 'none';
    if (srcEl) { srcEl.remove(); srcEl = null; }
    if (state.source) { srcEl = sourceTag(state.source); head.appendChild(srcEl); }
  }
  paint();
  return { el: root, update(p = {}) { Object.assign(state, p); paint(); } };
}

/**
 * Callout banner.
 * @param {object} p
 * @param {'warn'|'ok'|'info'} [p.kind='info']
 * @param {string} [p.title]
 * @param {string} [p.text]
 * @returns {HTMLElement}
 */
export function banner({ kind = 'info', title, text }) {
  const icon = { warn: '!', ok: '✓', info: 'i' }[kind] || 'i';
  return el('div', { class: `banner banner-${kind}`, role: kind === 'warn' ? 'alert' : 'status' },
    el('span', { class: 'banner-icon', 'aria-hidden': 'true', text: icon }),
    el('div', {}, title ? el('div', { class: 'banner-title', text: title }) : null, text ? el('div', { class: 'banner-text', text }) : null));
}

/**
 * Color key.
 * @param {Array<{color:string, label:string}>} items color is any CSS color
 * @returns {HTMLElement} ul.legend
 */
export function legend(items) {
  return el('ul', { class: 'legend' }, items.map((it) => el('li', { class: 'legend-item' }, el('span', { class: 'swatch', style: { background: it.color } }), it.label)));
}

/**
 * Thermal scale bar (cold blue to hot red) with end labels.
 * @param {object} p
 * @param {string} p.min label at the cold end, for example "0 F"
 * @param {string} p.max label at the hot end
 * @param {string} [p.mid] optional middle label
 * @returns {HTMLElement}
 */
export function thermalBar({ min, max, mid }) {
  return el('div', { class: 'thermal' }, el('div', { class: 'thermal-bar' }), el('div', { class: 'thermal-labels' }, el('span', { text: min }), mid ? el('span', { text: mid }) : null, el('span', { text: max })));
}

/**
 * Tab bar (role tablist). Used by the shell for modes and panels; modes may use it for sub-views.
 * @param {object} p
 * @param {Array<{value:string, label:string}>} p.items
 * @param {string} p.value
 * @param {(v:string)=>void} [p.onChange]
 * @param {string} [p.className] extra class such as "tabs-modes" or "tabs-sheet"
 * @param {string} [p.label] aria-label
 * @returns {{el:HTMLElement, set:(v:string)=>void, get:()=>string, setLabels:(items:Array<{value:string,label:string}>)=>void}}
 */
export function tabs({ items, value, onChange, className = '', label = 'Tabs' }) {
  let cur = value;
  const root = el('div', { class: `tabs ${className}`.trim(), role: 'tablist', 'aria-label': label });
  const btns = new Map();
  const paint = () => btns.forEach((b, v) => { b.setAttribute('aria-selected', v === cur ? 'true' : 'false'); b.tabIndex = v === cur ? 0 : -1; });
  items.forEach((it) => {
    const b = el('button', { type: 'button', class: 'tab', role: 'tab', 'data-value': it.value, text: it.label });
    b.addEventListener('click', () => { if (cur !== it.value) { cur = it.value; paint(); if (onChange) onChange(cur); } });
    btns.set(it.value, b);
    root.appendChild(b);
  });
  paint();
  return {
    el: root,
    set(v) { cur = v; paint(); },
    get() { return cur; },
    setLabels(list) { list.forEach((it) => { const b = btns.get(it.value); if (b) b.textContent = it.label; }); },
  };
}

/**
 * Layer row: drag handle, swatch, name, R value and a thickness stepper.
 * Selecting a row never moves the 3D camera; that is up to the mode.
 * @param {object} p
 * @param {string} p.color swatch color (CSS)
 * @param {string} p.name
 * @param {string} [p.sub] small line under the name
 * @param {number|string} p.r R-value (number is shown as fixed 1 decimal)
 * @param {string} [p.rLabel='R'] prefix
 * @param {number} [p.thickness] current thickness in inches (shows a stepper when onStep is given)
 * @param {(v:number)=>string} [p.thicknessFormat] default: 2" style text
 * @param {(dir:-1|1)=>void} [p.onStep] called with -1 or +1 when a stepper button is pressed
 * @param {boolean} [p.canDec=true]
 * @param {boolean} [p.canInc=true]
 * @param {boolean} [p.draggable=false] show the drag handle (class .handle; the mode wires the drag)
 * @param {boolean} [p.selected]
 * @param {boolean} [p.warn]
 * @param {()=>void} [p.onSelect] row tap
 * @returns {{el:HTMLElement, handle:HTMLElement|null, update:(p:object)=>void}}
 */
export function layerRow(p) {
  const state = { rLabel: 'R', canDec: true, canInc: true, thicknessFormat: (v) => `${fmt(v, v % 1 ? 3 : 1).replace(/0+$/, '').replace(/\.$/, '')}"`, ...p };
  const root = el('div', { class: 'layer-row', role: 'group' });
  const handle = state.draggable ? el('span', { class: 'handle', 'aria-hidden': 'true', title: 'Drag to reorder' }) : null;
  const sw = el('span', { class: 'swatch' });
  const name = el('div', { class: 'layer-name' });
  const sub = el('div', { class: 'layer-sub' });
  const r = el('div', { class: 'layer-r' });
  root.append(...[handle, sw, el('div', { class: 'layer-main' }, name, sub), r].filter(Boolean));
  let foot = null;
  let stepEl = null;
  if (state.onStep) {
    stepEl = { dec: el('button', { type: 'button', class: 'stepper-btn', 'aria-label': 'Thinner', text: '−' }), inc: el('button', { type: 'button', class: 'stepper-btn', 'aria-label': 'Thicker', text: '+' }), val: el('span', { class: 'stepper-val' }) };
    stepEl.dec.addEventListener('click', (e) => { e.stopPropagation(); state.onStep(-1); });
    stepEl.inc.addEventListener('click', (e) => { e.stopPropagation(); state.onStep(1); });
    foot = el('div', { class: 'layer-foot' }, el('span', { class: 'layer-sub', text: 'Thickness' }), el('div', { class: 'stepper', role: 'group', 'aria-label': 'Thickness' }, stepEl.dec, stepEl.val, stepEl.inc));
    root.appendChild(foot);
  }
  root.addEventListener('click', () => { if (state.onSelect) state.onSelect(); });
  function paint() {
    sw.style.background = state.color || '';
    name.textContent = state.name || '';
    sub.textContent = state.sub || '';
    sub.style.display = state.sub ? '' : 'none';
    r.textContent = `${state.rLabel} ${typeof state.r === 'number' ? fmt(state.r, 2) : state.r ?? '—'}`;
    root.dataset.selected = state.selected ? 'true' : 'false';
    root.dataset.warn = state.warn ? 'true' : 'false';
    root.dataset.clickable = state.onSelect ? 'true' : 'false';
    if (stepEl) {
      stepEl.val.textContent = state.thickness == null ? '—' : state.thicknessFormat(state.thickness);
      stepEl.dec.disabled = !state.canDec;
      stepEl.inc.disabled = !state.canInc;
    }
  }
  paint();
  return { el: root, handle, update(np = {}) { Object.assign(state, np); paint(); } };
}

/**
 * Push button.
 * @param {object} p
 * @param {string} p.label
 * @param {'primary'|'default'|'ghost'} [p.kind='default']
 * @param {()=>void} [p.onClick]
 * @returns {HTMLElement}
 */
export function button({ label, kind = 'default', onClick }) {
  const b = el('button', { type: 'button', class: `btn${kind === 'primary' ? ' btn-primary' : kind === 'ghost' ? ' btn-ghost' : ''}`, text: label });
  if (onClick) b.addEventListener('click', onClick);
  return b;
}
