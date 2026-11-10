// envelope/info-card.js  one shared information card for Envelope Lab (all modes).
//
//   const card = createInfoCard(hostEl);          // hostEl = the stage wrapper (narrow: the card sits over its lower part)
//   card.show(id, { x, y, anchor, pinned, extra, opener })
//   infoChip(id, label?, { extra })   inline term + "i" button, opens the card pinned
//   infoButton(id, { extra })         small round "i" button
//
// Wide screens (fine pointer, width 900+): unpinned = compact hover card (pointer-events none),
// pinned = full card with a close button. Narrow or touch: only pinned, as a bottom card.
// Escape or the close button hides it. One card at a time (the last one created is the one chips use).

import { getInfo } from './info-data.js';

const STYLE_ID = 'info-card-style';
const CSS = `
.ic-card{position:fixed;z-index:120;left:0;top:0;box-sizing:border-box;width:max-content;max-width:320px;background:var(--paper-2);color:var(--ink);border:1px solid var(--line-strong);border-radius:var(--radius);box-shadow:0 4px 16px rgba(0,0,0,.22);font:400 14px/1.4 var(--font-body);padding:12px 14px 12px;overflow:hidden auto;overscroll-behavior:contain;outline:none}
.ic-card[hidden]{display:none}
.ic-card[data-pinned="false"]{pointer-events:none}
.ic-card[data-pinned="true"]{max-width:380px;max-height:70vh;max-height:70dvh}
.ic-card[data-mode="narrow"]{max-width:none;width:auto}
.ic-head{display:flex;align-items:flex-start;gap:8px}
.ic-headmain{flex:1 1 auto;min-width:0}
.ic-title{margin:0;font:600 15px/1.3 var(--font-body);color:var(--ink)}
.ic-tags{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;margin-top:5px}
.ic-kind,.ic-ctl{display:inline-flex;align-items:center;gap:5px;min-height:18px;padding:0 7px;border:1px solid var(--line);border-radius:999px;font:500 11px/1.2 var(--font-body);color:var(--ink-2);background:var(--paper-3)}
.ic-dot{width:8px;height:8px;border-radius:50%;flex:none;box-shadow:0 0 0 1px rgba(0,0,0,.18)}
.ic-x,.ic-back{flex:none;position:relative;width:26px;height:26px;border:1px solid var(--line-strong);border-radius:50%;background:var(--paper-3);color:var(--ink-2);display:grid;place-items:center;padding:0;font:500 15px/1 var(--font-body)}
.ic-x::after,.ic-back::after{content:"";position:absolute;inset:-9px}
.ic-x:hover,.ic-back:hover{color:var(--ink);border-color:var(--ink-2)}
.ic-extra{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:10px}
.ic-card[data-mode="narrow"] .ic-extra{grid-template-columns:repeat(auto-fit,minmax(96px,1fr))}
.ic-tile{background:var(--paper-3);border:1px solid var(--line);border-radius:var(--radius);padding:5px 8px;min-width:0}
.ic-tile-l{font:500 11px/1.25 var(--font-body);color:var(--ink-2)}
.ic-tile-v{font:500 13px/1.25 var(--font-mono);font-variant-numeric:tabular-nums;color:var(--ink);margin-top:1px;overflow-wrap:anywhere}
.ic-short{margin:10px 0 0;color:var(--ink);font-size:14px}
.ic-sec{margin-top:11px}
.ic-h{margin:0 0 2px;font:500 12px/1.3 var(--font-body);color:var(--ink-2)}
.ic-p{margin:0;font-size:14px;line-height:1.45}
.ic-p + .ic-p{margin-top:6px}
.ic-prods{display:flex;flex-wrap:wrap;gap:4px 6px;margin:3px 0 0;padding:0;list-style:none}
.ic-prods li{padding:1px 8px;border:1px solid var(--line);border-radius:999px;font-size:12.5px;background:var(--paper-3)}
.ic-facts{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:3px 0 0;font-size:13px}
.ic-facts dt{color:var(--ink-2)}
.ic-facts dd{margin:0;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.ic-more-btn{margin-top:11px;padding:0;border:0;background:none;color:var(--accent);font:500 13px var(--font-body);cursor:pointer;position:relative}
.ic-more-btn::after{content:"";position:absolute;inset:-10px -6px}
.ic-more-btn:hover{text-decoration:underline}
.ic-more{margin-top:6px;display:flex;flex-direction:column;gap:6px}
.ic-more p{margin:0;font-size:14px;line-height:1.45}
.ic-rel{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.ic-source{margin-top:12px;padding-top:8px;border-top:1px solid var(--line);font-size:12px;color:var(--ink-2);display:flex;flex-direction:column;gap:1px}
.ic-hint{margin-top:10px;font-size:12px;color:var(--ink-2)}
.ic-empty{margin:10px 0 0;color:var(--ink-2)}
.ic-chip{display:inline-flex;align-items:center;gap:5px;min-height:22px;padding:1px 9px 1px 6px;border:1px solid var(--line-strong);border-radius:999px;background:transparent;color:var(--ink-2);font:500 12px/1.2 var(--font-body);position:relative;vertical-align:middle;white-space:nowrap;max-width:100%}
.ic-chip > span{overflow:hidden;text-overflow:ellipsis}
.ic-chip::before,.ic-btn::before{content:"i";font:italic 600 9px serif;width:12px;height:12px;border-radius:50%;border:1px solid currentColor;display:inline-grid;place-items:center;flex:none;line-height:1}
.ic-chip::after{content:"";position:absolute;inset:-11px -3px}
.ic-chip:hover,.ic-btn:hover{color:var(--ink);border-color:var(--ink-2)}
.ic-chip[aria-expanded="true"],.ic-btn[aria-expanded="true"]{background:var(--accent-soft);color:var(--accent);border-color:var(--accent-edge)}
.ic-btn{display:inline-grid;place-items:center;flex:none;width:20px;height:20px;padding:0;border:1px solid var(--line-strong);border-radius:50%;background:transparent;color:var(--ink-2);position:relative;vertical-align:middle}
.ic-btn::before{border:0;width:auto;height:auto;font-size:12px}
.ic-btn::after{content:"";position:absolute;inset:-12px}
`;

const CONTROL = {
  water: ['Water control', '#2f7de1'],
  air: ['Air control', '#14b8a6'],
  vapor: ['Vapor control', '#8e44ad'],
  thermal: ['Thermal control', '#f08a24'],
  structure: ['Structure', '#6e6a62'],
  finish: ['Finish', '#b9b4a8'],
  cladding: ['Cladding', '#948f84'],
  airspace: ['Air space', '#14b8a6'],
};
const KIND = { layer: 'Layer', concept: 'Idea', part: 'Part' };

let active = null; // the card created last; chips and buttons use it

function h(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

function isWide() {
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches && window.innerWidth >= 900;
  } catch (e) { return window.innerWidth >= 900; }
}

/**
 * Create the shared card.
 * @param {HTMLElement} hostEl stage wrapper (narrow screens put the bottom card over its lower part) or document.body
 */
export function createInfoCard(hostEl) {
  ensureStyle();
  const host = hostEl || document.body;
  const root = h('div', 'ic-card');
  root.hidden = true;
  root.tabIndex = -1;
  root.dataset.pinned = 'false';
  document.body.appendChild(root);

  let id = null;
  let pinned = false;
  let extra = [];
  let moreOpen = false;
  let history = [];
  let pos = { x: 0, y: 0 };
  let anchorEl = null;
  let anchorRect = null;
  let opener = null;
  const closeFns = [];

  function controlTag(info) {
    const c = CONTROL[info.control];
    if (!c) return null;
    const t = h('span', 'ic-ctl');
    const d = h('span', 'ic-dot');
    d.style.background = c[1];
    t.append(d, document.createTextNode(c[0]));
    return t;
  }

  function sec(heading, ...nodes) {
    const s = h('div', 'ic-sec');
    s.append(h('h3', 'ic-h', heading), ...nodes);
    return s;
  }

  function paras(text) {
    return String(text).split(/\n+/).filter(Boolean).map((t) => h('p', 'ic-p', t));
  }

  function render() {
    root.replaceChildren();
    const info = getInfo(id);
    const title = info ? info.title : id;
    root.setAttribute('role', pinned ? 'dialog' : 'tooltip');
    root.setAttribute('aria-label', title);
    root.dataset.pinned = pinned ? 'true' : 'false';
    root.dataset.id = id;

    const head = h('div', 'ic-head');
    if (pinned && history.length) {
      const b = h('button', 'ic-back', '←');
      b.type = 'button';
      b.setAttribute('aria-label', 'Back');
      b.addEventListener('click', () => {
        const prev = history.pop();
        if (prev) swap(prev, true);
      });
      head.append(b);
    }
    const main = h('div', 'ic-headmain');
    main.append(h('h2', 'ic-title', title));
    const tags = h('div', 'ic-tags');
    if (info) {
      tags.append(h('span', 'ic-kind', KIND[info.kind] || 'Idea'));
      const ct = info.kind === 'layer' ? controlTag(info) : null;
      if (ct) tags.append(ct);
    }
    if (tags.childNodes.length) main.append(tags);
    head.append(main);
    if (pinned) {
      const x = h('button', 'ic-x', '×');
      x.type = 'button';
      x.setAttribute('aria-label', 'Close');
      x.addEventListener('click', () => hide());
      head.append(x);
    }
    root.append(head);

    if (extra && extra.length) {
      const g = h('div', 'ic-extra');
      extra.forEach((e) => {
        const t = h('div', 'ic-tile');
        t.append(h('div', 'ic-tile-l', e.label), h('div', 'ic-tile-v', e.value));
        g.append(t);
      });
      root.append(g);
    }

    if (!info) {
      root.append(h('p', 'ic-empty', 'No information yet.'));
      return;
    }

    if (info.short) root.append(h('p', 'ic-short', info.short));
    const jobHeading = info.kind === 'concept' ? 'Why it matters' : 'What it does';

    if (!pinned) {
      if (info.job) root.append(sec(jobHeading, ...paras(info.job)));
      root.append(h('div', 'ic-hint', 'Click to keep open and read more'));
      return;
    }

    if (info.what) root.append(sec('What it is', ...paras(info.what)));
    if (info.job) root.append(sec(jobHeading, ...paras(info.job)));
    if (info.ifWrong) root.append(sec('If it goes wrong', ...paras(info.ifWrong)));
    if (info.doThis) root.append(sec('What to do', ...paras(info.doThis)));
    if (info.products && info.products.length) {
      const ul = h('ul', 'ic-prods');
      info.products.forEach((p) => ul.append(h('li', null, p)));
      root.append(sec('Typical products', ul));
    }
    if (info.facts && info.facts.length) {
      const dl = h('dl', 'ic-facts');
      info.facts.forEach((f) => { dl.append(h('dt', null, f.label), h('dd', null, f.value)); });
      root.append(sec('Quick facts', dl));
    }
    if (info.mistake) root.append(sec('Common mistake', ...paras(info.mistake)));
    if (info.are) root.append(sec('For the ARE', ...paras(info.are)));
    if (info.more && info.more.length) {
      const wrap = h('div');
      const btn = h('button', 'ic-more-btn', moreOpen ? 'Less' : 'More detail');
      btn.type = 'button';
      btn.setAttribute('aria-expanded', moreOpen ? 'true' : 'false');
      const body = h('div', 'ic-more');
      info.more.forEach((m) => body.append(h('p', null, m)));
      body.hidden = !moreOpen;
      btn.addEventListener('click', () => {
        moreOpen = !moreOpen;
        body.hidden = !moreOpen;
        btn.textContent = moreOpen ? 'Less' : 'More detail';
        btn.setAttribute('aria-expanded', moreOpen ? 'true' : 'false');
        place();
      });
      wrap.append(btn, body);
      root.append(wrap);
    }
    const rel = (info.related || []).filter((r) => r !== id && getInfo(r));
    if (rel.length) {
      const box = h('div', 'ic-rel');
      rel.forEach((r) => {
        const c = h('button', 'ic-chip');
        c.type = 'button';
        c.append(h('span', null, getInfo(r).title));
        c.addEventListener('click', () => swap(r, false));
        box.append(c);
      });
      root.append(sec('Related', box));
    }
    if (info.source || info.sourceKind) {
      const s = h('div', 'ic-source');
      if (info.source) s.append(h('span', null, `Source: ${info.source}`));
      const k = info.sourceKind;
      const notes = [];
      if (k === 'ching' || k === 'mixed') notes.push('From your Ching notes');
      if (k === 'general' || k === 'mixed') notes.push('General building science');
      if (notes.length) s.append(h('span', null, notes.join(' · ')));
      root.append(s);
    }
  }

  function place() {
    if (root.hidden) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const M = 8;
    if (pinned && !isWide()) {
      root.dataset.mode = 'narrow';
      // Bottom card. It sits below the stage (over the panels) so the wall stays visible.
      const r = host.getBoundingClientRect();
      const hostOk = r.width > 100 && r.height > 100 && r.bottom > 0 && host !== document.body;
      const left0 = hostOk ? Math.max(M, r.left + M) : M;
      const right0 = hostOk ? Math.min(vw - M, r.right - M) : vw - M;
      const width = Math.min(right0 - left0, 600);
      const left = left0 + (right0 - left0 - width) / 2;
      const below = hostOk ? vh - r.bottom - 2 * M : vh * 0.55;
      const cap = Math.max(240, Math.min(vh * 0.55, below));
      root.style.left = `${left}px`;
      root.style.top = 'auto';
      root.style.bottom = 'calc(8px + env(safe-area-inset-bottom, 0px))';
      root.style.width = `${width}px`;
      root.style.maxHeight = `${cap}px`;
      return;
    }
    root.dataset.mode = 'wide';
    root.style.bottom = 'auto';
    root.style.width = '';
    root.style.maxHeight = '';
    const w = root.offsetWidth;
    const hgt = root.offsetHeight;
    let x;
    let y;
    if (pinned && pos.keep) {
      x = pos.x; y = pos.y;
    } else if (anchorRect) {
      const a = anchorRect;
      x = a.right + 10;
      if (x + w > vw - M) x = a.left - 10 - w;
      y = a.top;
    } else {
      x = pos.x + 22;
      y = pos.y + 18;
      if (x + w > vw - M) x = pos.x - 22 - w;
      if (y + hgt > vh - M) y = pos.y - 18 - hgt;
    }
    x = Math.max(M, Math.min(x, vw - w - M));
    y = Math.max(M, Math.min(y, vh - hgt - M));
    root.style.left = `${x}px`;
    root.style.top = `${y}px`;
    if (pinned) { pos = { x, y, keep: true }; }
  }

  function swap(nid, isBack) {
    if (!isBack && id && id !== nid) history.push(id);
    id = nid;
    extra = [];
    moreOpen = false;
    render();
    root.scrollTop = 0;
    place();
  }

  function setOpener(el) {
    if (opener && opener !== el) opener.removeAttribute('aria-expanded');
    opener = el || null;
    if (opener) opener.setAttribute('aria-expanded', 'true');
  }

  function show(nid, opts = {}) {
    const wantPin = !!opts.pinned;
    const wide = isWide();
    if (!wantPin && (!wide || pinned)) return; // no hover on touch; never replace a pinned card by hover
    const ex = typeof opts.extra === 'function' ? opts.extra() : opts.extra;
    const wasOpen = !root.hidden;
    const same = wasOpen && id === nid;
    const upgrade = wasOpen && !pinned && wantPin && same;
    if (same && pinned === wantPin) {
      // refresh live values without moving the card
      extra = ex || [];
      const sc = root.scrollTop;
      render();
      root.scrollTop = sc;
      if (!pinned && opts.x != null && opts.y != null) {
        // pointer drifted under the hover card: move the card away from it
        const r = root.getBoundingClientRect();
        if (opts.x >= r.left - 6 && opts.x <= r.right + 6 && opts.y >= r.top - 6 && opts.y <= r.bottom + 6) pos = { x: opts.x, y: opts.y };
      }
      place();
      return;
    }
    if (!upgrade) history = [];
    id = nid;
    extra = ex || [];
    pinned = wantPin;
    moreOpen = false;
    if (opts.anchor && opts.anchor.getBoundingClientRect) {
      anchorEl = opts.anchor;
      anchorRect = anchorEl.getBoundingClientRect();
    } else { anchorEl = null; anchorRect = null; }
    if (!upgrade) {
      pos = { x: opts.x != null ? opts.x : (anchorRect ? anchorRect.right : window.innerWidth / 2), y: opts.y != null ? opts.y : (anchorRect ? anchorRect.top : window.innerHeight / 2) };
    } else {
      const r = root.getBoundingClientRect();
      pos = { x: r.left, y: r.top, keep: true };
    }
    if (wantPin) setOpener(opts.opener || null); else setOpener(null);
    root.hidden = false;
    render();
    root.scrollTop = 0;
    place();
    if (wantPin) {
      try { root.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
  }

  function hide() {
    if (root.hidden) return;
    const op = opener;
    const wasPinned = pinned;
    root.hidden = true;
    pinned = false;
    id = null;
    history = [];
    setOpener(null);
    if (wasPinned && op && op.isConnected) { try { op.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    closeFns.slice().forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  }

  function hideHover() { if (!root.hidden && !pinned) hide(); }

  const onKey = (e) => { if (e.key === 'Escape' && !root.hidden) { hide(); } };
  const onResize = () => { if (!root.hidden) { if (pinned) pos.keep = pos.keep && isWide(); place(); } };
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);

  const api = {
    show,
    hide,
    hideHover,
    isOpen: () => !root.hidden,
    isPinned: () => !root.hidden && pinned,
    currentId: () => (root.hidden ? null : id),
    onClose(fn) { closeFns.push(fn); },
    element: root,
    dispose() {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      root.remove();
      closeFns.length = 0;
      if (active === api) active = null;
    },
  };
  active = api;
  return api;
}

function open(id, btn, opts) {
  if (!active) return;
  if (active.isPinned() && active.currentId() === id) { active.hide(); return; }
  const r = btn.getBoundingClientRect();
  active.show(id, { pinned: true, anchor: btn, x: r.right, y: r.top, opener: btn, extra: opts && opts.extra });
}

/**
 * Small inline button: term plus an "i" mark. Opens the shared card for `id`, pinned.
 * @param {string} id INFO id
 * @param {string} [labelOverride] text shown (default: the entry title)
 * @param {{extra?: Array|Function}} [opts] live values for the card (array, or a function returning one)
 */
export function infoChip(id, labelOverride, opts) {
  const info = getInfo(id);
  const label = labelOverride || (info ? info.title : id);
  const b = h('button', 'ic-chip');
  b.type = 'button';
  b.dataset.infoId = id;
  b.setAttribute('aria-haspopup', 'dialog');
  b.setAttribute('aria-label', `About ${label}`);
  b.append(h('span', null, label));
  b.addEventListener('click', (e) => { e.stopPropagation(); open(id, b, opts); });
  return b;
}

/**
 * Compact round "i" button for tiles and rows.
 * @param {string} id INFO id
 * @param {{extra?: Array|Function, label?: string}} [opts]
 */
export function infoButton(id, opts) {
  const info = getInfo(id);
  const b = h('button', 'ic-btn');
  b.type = 'button';
  b.dataset.infoId = id;
  b.setAttribute('aria-haspopup', 'dialog');
  b.setAttribute('aria-label', `About ${(opts && opts.label) || (info ? info.title : id)}`);
  b.addEventListener('click', (e) => { e.stopPropagation(); open(id, b, opts); });
  return b;
}
