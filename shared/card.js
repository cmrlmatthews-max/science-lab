// shared/card.js — the information card shared by the layered modules (Orbital Mechanics, Molecules and Crystals).
// Same behavior as envelope/info-card.js, generalized (free-form `kind` tag, level-aware, "Tell me more").
//
//   const card = createCard(hostEl, { getInfo, layers })
//   card.show(id, { x, y, anchor, pinned, extra, opener })
//   infoChip(card, id, label)     inline term + "i" mark; opens the card pinned
//   infoButton(card, id, opts)    compact round "i" button
//
// Options: getInfo(id) -> entry | null;  layers (controller from createLayers) OR level: () => number (+ onMore: () => void).
// Entry: { id, title, kind, short, what, why, life, facts:[{label,value}], more:[...], related:[ids], source }
//
// Wide screens (fine pointer, width 900+): unpinned = compact hover card (pointer-events none); pinned = full card with a close
// button. Touch or narrow: only pinned, as a bottom card. Escape or the close button hides it. Cards never move the camera.
// Levels 1–3 show title, short, what, why, life and a "Tell me more" line. Level 4+ adds facts, More and source.
// No DOM access at import time.

const STYLE_ID = 'sl-card-style';
const CSS = `
.sl-card{position:fixed;z-index:120;left:0;top:0;box-sizing:border-box;width:max-content;max-width:320px;background:var(--paper-2);color:var(--ink);border:1px solid var(--line-strong);border-radius:var(--radius);box-shadow:0 4px 16px rgba(0,0,0,.28);font:400 14px/1.4 var(--font-body);padding:12px 14px;overflow:hidden auto;overscroll-behavior:contain;outline:none}
.sl-card[hidden]{display:none}
.sl-card[data-pinned="false"]{pointer-events:none}
.sl-card[data-pinned="true"]{max-width:380px;max-height:70vh;max-height:70dvh}
.sl-card[data-mode="narrow"]{max-width:none;width:auto}
.sl-c-head{display:flex;align-items:flex-start;gap:8px}
.sl-c-headmain{flex:1 1 auto;min-width:0}
.sl-c-title{margin:0;font:600 15px/1.3 var(--font-body);color:var(--ink)}
.sl-c-tags{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;margin-top:5px}
.sl-c-kind{display:inline-flex;align-items:center;min-height:18px;padding:0 7px;border:1px solid var(--line);border-radius:999px;font:500 11px/1.2 var(--font-body);color:var(--ink-2);background:var(--paper-3)}
.sl-c-x,.sl-c-back{flex:none;position:relative;width:26px;height:26px;border:1px solid var(--line-strong);border-radius:50%;background:var(--paper-3);color:var(--ink-2);display:grid;place-items:center;padding:0;font:500 15px/1 var(--font-body)}
.sl-c-x::after,.sl-c-back::after{content:"";position:absolute;inset:-9px}
.sl-c-x:hover,.sl-c-back:hover{color:var(--ink);border-color:var(--ink-2)}
.sl-c-extra{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:10px}
.sl-card[data-mode="narrow"] .sl-c-extra{grid-template-columns:repeat(auto-fit,minmax(96px,1fr))}
.sl-c-tile{background:var(--paper-3);border:1px solid var(--line);border-radius:var(--radius);padding:5px 8px;min-width:0}
.sl-c-tile-l{font:500 11px/1.25 var(--font-body);color:var(--ink-2)}
.sl-c-tile-v{font:500 13px/1.25 var(--font-mono);font-variant-numeric:tabular-nums;color:var(--ink);margin-top:1px;overflow-wrap:anywhere}
.sl-c-short{margin:10px 0 0;color:var(--ink);font-size:14px}
.sl-c-sec{margin-top:11px}
.sl-c-h{margin:0 0 2px;font:500 12px/1.3 var(--font-body);color:var(--ink-2)}
.sl-c-p{margin:0;font-size:14px;line-height:1.45}
.sl-c-p + .sl-c-p{margin-top:6px}
.sl-c-sec[data-life="true"]{padding:7px 10px;border-left:3px solid var(--accent);background:var(--accent-soft);border-radius:0 var(--radius) var(--radius) 0}
.sl-c-facts{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:3px 0 0;font-size:13px}
.sl-c-facts dt{color:var(--ink-2)}
.sl-c-facts dd{margin:0;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.sl-c-link{margin-top:11px;padding:0;border:0;background:none;color:var(--accent);font:500 13px var(--font-body);cursor:pointer;position:relative}
.sl-c-link::after{content:"";position:absolute;inset:-10px -6px}
.sl-c-link:hover{text-decoration:underline}
.sl-c-more{margin-top:6px;display:flex;flex-direction:column;gap:6px}
.sl-c-more p{margin:0;font-size:14px;line-height:1.45}
.sl-c-rel{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.sl-c-source{margin-top:12px;padding-top:8px;border-top:1px solid var(--line);font-size:12px;color:var(--ink-2)}
.sl-c-hint{margin-top:10px;font-size:12px;color:var(--ink-2)}
.sl-c-empty{margin:10px 0 0;color:var(--ink-2)}
.sl-chip{display:inline-flex;align-items:center;gap:5px;min-height:22px;padding:1px 9px 1px 6px;border:1px solid var(--line-strong);border-radius:999px;background:transparent;color:var(--ink-2);font:500 12px/1.2 var(--font-body);position:relative;vertical-align:middle;white-space:nowrap;max-width:100%}
.sl-chip > span{overflow:hidden;text-overflow:ellipsis}
.sl-chip::before,.sl-ibtn::before{content:"i";font:italic 600 9px serif;width:12px;height:12px;border-radius:50%;border:1px solid currentColor;display:inline-grid;place-items:center;flex:none;line-height:1}
.sl-chip::after{content:"";position:absolute;inset:-11px -3px}
.sl-chip:hover,.sl-ibtn:hover{color:var(--ink);border-color:var(--ink-2)}
.sl-chip[aria-expanded="true"],.sl-ibtn[aria-expanded="true"]{background:var(--accent-soft);color:var(--accent);border-color:var(--accent-edge)}
.sl-c-rel .sl-chip::before{content:none}
.sl-c-rel .sl-chip{padding:1px 9px}
.sl-ibtn{display:inline-grid;place-items:center;flex:none;width:20px;height:20px;padding:0;border:1px solid var(--line-strong);border-radius:50%;background:transparent;color:var(--ink-2);position:relative;vertical-align:middle}
.sl-ibtn::before{border:0;width:auto;height:auto;font-size:12px}
.sl-ibtn::after{content:"";position:absolute;inset:-12px}
`;

let active = null; // the card created last; chips and buttons use it when no card is passed

/** The most recently created card (used by tiles and chips when no card is given). */
export function activeCard() { return active; }

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
 * @param {HTMLElement} hostEl stage wrapper (narrow screens put the bottom card below it) or document.body
 * @param {{getInfo:(id:string)=>object|null, layers?:object, level?:()=>number, onMore?:()=>void, topEl?:HTMLElement}} opts
 */
export function createCard(hostEl, opts = {}) {
  ensureStyle();
  const host = hostEl || document.body;
  let getInfo = opts.getInfo || (() => null);
  const layers = opts.layers || null;
  const levelFn = opts.level || (layers ? () => layers.level() : () => 5);
  const moreFn = opts.onMore || (layers ? () => layers.setLevel(layers.level() + 1) : null);
  const topEl = opts.topEl || null;

  const root = h('div', 'sl-card');
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
  let anchorRect = null;
  let opener = null;
  const closeFns = [];

  function sec(heading, ...nodes) {
    const s = h('div', 'sl-c-sec');
    s.append(h('h3', 'sl-c-h', heading), ...nodes);
    return s;
  }
  function paras(text) {
    return String(text).split(/\n+/).filter(Boolean).map((t) => h('p', 'sl-c-p', t));
  }

  function render() {
    root.replaceChildren();
    const info = getInfo(id);
    const title = info ? info.title : id;
    const lv = levelFn();
    root.setAttribute('role', pinned ? 'dialog' : 'tooltip');
    root.setAttribute('aria-label', title);
    root.dataset.pinned = pinned ? 'true' : 'false';
    root.dataset.id = id;
    root.dataset.level = String(lv);

    const head = h('div', 'sl-c-head');
    if (pinned && history.length) {
      const b = h('button', 'sl-c-back', '←');
      b.type = 'button';
      b.setAttribute('aria-label', 'Back');
      b.addEventListener('click', () => { const prev = history.pop(); if (prev) swap(prev, true); });
      head.append(b);
    }
    const main = h('div', 'sl-c-headmain');
    main.append(h('h2', 'sl-c-title', title));
    if (info && info.kind) {
      const tags = h('div', 'sl-c-tags');
      tags.append(h('span', 'sl-c-kind', info.kind));
      main.append(tags);
    }
    head.append(main);
    if (pinned) {
      const x = h('button', 'sl-c-x', '×');
      x.type = 'button';
      x.setAttribute('aria-label', 'Close');
      x.addEventListener('click', () => hide());
      head.append(x);
    }
    root.append(head);

    if (extra && extra.length) {
      const g = h('div', 'sl-c-extra');
      extra.forEach((e) => {
        const t = h('div', 'sl-c-tile');
        t.append(h('div', 'sl-c-tile-l', e.label), h('div', 'sl-c-tile-v', e.value));
        g.append(t);
      });
      root.append(g);
    }

    if (!info) { root.append(h('p', 'sl-c-empty', 'No information yet.')); return; }

    if (info.short) root.append(h('p', 'sl-c-short', info.short));

    if (!pinned) {
      if (info.why) root.append(sec('Why it matters', ...paras(info.why)));
      root.append(h('div', 'sl-c-hint', 'Click to keep open and read more'));
      return;
    }

    if (info.what) root.append(sec('What it is', ...paras(info.what)));
    if (info.why) root.append(sec('Why it matters', ...paras(info.why)));
    if (info.life) {
      const s = sec('In your life', ...paras(info.life));
      s.dataset.life = 'true';
      root.append(s);
    }
    if (lv >= 4) {
      if (info.facts && info.facts.length) {
        const dl = h('dl', 'sl-c-facts');
        info.facts.forEach((f) => dl.append(h('dt', null, f.label), h('dd', null, f.value)));
        root.append(sec('Facts', dl));
      }
      if (info.more && info.more.length) {
        const wrap = h('div');
        const btn = h('button', 'sl-c-link', moreOpen ? 'Less' : 'More detail');
        btn.type = 'button';
        btn.setAttribute('aria-expanded', moreOpen ? 'true' : 'false');
        const body = h('div', 'sl-c-more');
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
    } else if (moreFn) {
      const b = h('button', 'sl-c-link', 'Tell me more');
      b.type = 'button';
      b.dataset.action = 'more';
      b.addEventListener('click', () => {
        const sc = root.scrollTop;
        moreFn();             // raises the level; the card stays open
        if (!root.hidden) { render(); root.scrollTop = sc; place(); }
      });
      root.append(b);
    }
    const rel = (info.related || []).filter((r) => r !== id && getInfo(r));
    if (rel.length) {
      const box = h('div', 'sl-c-rel');
      rel.forEach((r) => {
        const c = h('button', 'sl-chip');
        c.type = 'button';
        c.append(h('span', null, getInfo(r).title));
        c.addEventListener('click', () => swap(r, false));
        box.append(c);
      });
      root.append(sec('Related', box));
    }
    if (lv >= 4 && info.source) root.append(h('div', 'sl-c-source', `Source: ${info.source}`));
  }

  function place() {
    if (root.hidden) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const M = 8;
    if (pinned && !isWide()) {
      root.dataset.mode = 'narrow';
      // Bottom card. It sits below the stage (and the layer bar) so the 3D view stays visible.
      const r = host.getBoundingClientRect();
      const hostOk = r.width > 100 && r.height > 100 && r.bottom > 0 && host !== document.body;
      const left0 = hostOk ? Math.max(M, r.left + M) : M;
      const right0 = hostOk ? Math.min(vw - M, r.right - M) : vw - M;
      const width = Math.min(right0 - left0, 600);
      const left = left0 + (right0 - left0 - width) / 2;
      let topEdge = hostOk ? r.bottom : vh * 0.45;
      if (topEl && topEl.isConnected) {
        const tr = topEl.getBoundingClientRect();
        if (tr.height > 0 && tr.bottom > topEdge) topEdge = tr.bottom;
      }
      const below = vh - topEdge - 2 * M;
      const cap = Math.max(200, Math.min(vh * 0.6, below));
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
    let x; let y;
    if (pinned && pos.keep) { x = pos.x; y = pos.y; }
    else if (anchorRect) {
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
    if (pinned) pos = { x, y, keep: true };
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

  function show(nid, o = {}) {
    const wantPin = !!o.pinned;
    const wide = isWide();
    if (!wantPin && (!wide || pinned)) return; // no hover on touch; never replace a pinned card by hover
    const ex = typeof o.extra === 'function' ? o.extra() : o.extra;
    const wasOpen = !root.hidden;
    const same = wasOpen && id === nid;
    const upgrade = wasOpen && !pinned && wantPin && same;
    if (same && pinned === wantPin) {
      extra = ex || [];
      const sc = root.scrollTop;
      render();
      root.scrollTop = sc;
      if (!pinned && o.x != null && o.y != null) {
        const r = root.getBoundingClientRect();
        if (o.x >= r.left - 6 && o.x <= r.right + 6 && o.y >= r.top - 6 && o.y <= r.bottom + 6) pos = { x: o.x, y: o.y };
      }
      place();
      return;
    }
    if (!upgrade) history = [];
    id = nid;
    extra = ex || [];
    pinned = wantPin;
    moreOpen = false;
    if (o.anchor && o.anchor.getBoundingClientRect) anchorRect = o.anchor.getBoundingClientRect();
    else anchorRect = null;
    if (!upgrade) {
      pos = { x: o.x != null ? o.x : (anchorRect ? anchorRect.right : window.innerWidth / 2), y: o.y != null ? o.y : (anchorRect ? anchorRect.top : window.innerHeight / 2) };
    } else {
      const r = root.getBoundingClientRect();
      pos = { x: r.left, y: r.top, keep: true };
    }
    if (wantPin) setOpener(o.opener || null); else setOpener(null);
    root.hidden = false;
    render();
    root.scrollTop = 0;
    place();
    if (wantPin) { try { root.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
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

  const onKey = (e) => { if (e.key === 'Escape' && !root.hidden) hide(); };
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
    setSource(fn) { getInfo = fn || (() => null); if (!root.hidden) { render(); place(); } },
    /** Re-draw the open card (the shell calls this when the level changes). */
    refresh() { if (!root.hidden) { const sc = root.scrollTop; render(); root.scrollTop = sc; place(); } },
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

function open(card, id, btn, o) {
  const c = card || active;
  if (!c) return;
  if (c.isPinned() && c.currentId() === id) { c.hide(); return; }
  const r = btn.getBoundingClientRect();
  c.show(id, { pinned: true, anchor: btn, x: r.right, y: r.top, opener: btn, extra: o && o.extra });
}

/**
 * Small inline button: term plus an "i" mark. Opens the card for `id`, pinned.
 * @param {object|null} card from createCard (null: the most recent card)
 * @param {string} id entry id
 * @param {string} label text shown
 * @param {{extra?:Array|Function}} [o]
 */
export function infoChip(card, id, label, o) {
  const b = h('button', 'sl-chip');
  b.type = 'button';
  b.dataset.infoId = id;
  b.setAttribute('aria-haspopup', 'dialog');
  b.setAttribute('aria-label', `About ${label || id}`);
  b.append(h('span', null, label || id));
  b.addEventListener('click', (e) => { e.stopPropagation(); open(card, id, b, o); });
  return b;
}

/**
 * Compact round "i" button for tiles and rows.
 * @param {object|null} card from createCard (null: the most recent card)
 * @param {string} id
 * @param {{extra?:Array|Function, label?:string}} [o]
 */
export function infoButton(card, id, o) {
  const b = h('button', 'sl-ibtn');
  b.type = 'button';
  b.dataset.infoId = id;
  b.setAttribute('aria-haspopup', 'dialog');
  b.setAttribute('aria-label', `About ${(o && o.label) || id}`);
  b.addEventListener('click', (e) => { e.stopPropagation(); open(card, id, b, o); });
  return b;
}
