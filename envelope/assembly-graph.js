// envelope/assembly-graph.js  inline SVG temperature profile through the wall.
import { MATERIALS } from './materials.js';
import { fmt } from '../shared/ui.js';

const NS = 'http://www.w3.org/2000/svg';
const HEIGHT = 180;

function s(tag, attrs = {}, text) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
}

/** Create the graph. Call update(an, selectedIndex) after any change. */
export function createGraph(container) {
  const svg = s('svg', { role: 'img', 'aria-label': 'Temperature through the wall', width: '100%', height: HEIGHT });
  svg.style.display = 'block';
  svg.style.color = 'var(--ink)';
  svg.style.overflow = 'visible';
  container.appendChild(svg);
  let last = null;
  let sel = null;
  let width = 340;

  function draw() {
    svg.replaceChildren();
    if (!last) return;
    const an = last;
    const w = width;
    svg.setAttribute('viewBox', `0 0 ${w} ${HEIGHT}`);
    const m = { l: 40, r: 12, t: 18, b: 26 };
    const pw = w - m.l - m.r;
    const ph = HEIGHT - m.t - m.b;
    const total = an.totalThickness;
    const x0 = -0.8;
    const x1 = total + 0.8;
    const X = (z) => m.l + ((z - x0) / (x1 - x0)) * pw;
    const temps = an.profile.map((p) => p.tempF).concat([an.dewPointF]);
    const lo = Math.floor((Math.min(...temps) - 4) / 10) * 10;
    const hi = Math.ceil((Math.max(...temps) + 4) / 10) * 10;
    const Y = (t) => m.t + (1 - (t - lo) / (hi - lo)) * ph;
    const tick = hi - lo > 80 ? 20 : 10;

    // layer bands
    an.layers.forEach((L) => {
      const mat = MATERIALS[L.materialId];
      const xa = X(L.zIn);
      const xb = X(L.zOut);
      svg.appendChild(s('rect', { x: xa, y: m.t, width: Math.max(0.5, xb - xa), height: ph, style: `fill:${mat?.color || '#999'};opacity:${L.index === sel ? 0.4 : 0.22}` }));
      svg.appendChild(s('line', { x1: xa, x2: xa, y1: m.t, y2: m.t + ph, style: 'stroke:var(--line);stroke-width:1' }));
    });
    svg.appendChild(s('line', { x1: X(total), x2: X(total), y1: m.t, y2: m.t + ph, style: 'stroke:var(--line);stroke-width:1' }));
    if (sel != null && an.layers[sel]) {
      const L = an.layers[sel];
      svg.appendChild(s('rect', { x: X(L.zIn), y: m.t, width: Math.max(1, X(L.zOut) - X(L.zIn)), height: ph, style: 'fill:none;stroke:var(--accent);stroke-width:1.25' }));
    }

    // y axis
    for (let t = Math.ceil(lo / tick) * tick; t <= hi; t += tick) {
      svg.appendChild(s('line', { x1: m.l, x2: m.l + pw, y1: Y(t), y2: Y(t), style: 'stroke:var(--line);stroke-width:1;opacity:0.7' }));
      svg.appendChild(s('text', { x: m.l - 5, y: Y(t) + 3.5, 'text-anchor': 'end', style: 'fill:var(--ink-2);font:500 10.5px var(--font-mono)' }, String(t)));
    }
    svg.appendChild(s('text', { x: 4, y: 10, style: 'fill:var(--ink-2);font:500 11px var(--font-body)' }, '°F'));
    svg.appendChild(s('line', { x1: m.l, x2: m.l, y1: m.t, y2: m.t + ph, style: 'stroke:var(--line-strong);stroke-width:1' }));
    svg.appendChild(s('line', { x1: m.l, x2: m.l + pw, y1: m.t + ph, y2: m.t + ph, style: 'stroke:var(--line-strong);stroke-width:1' }));
    svg.appendChild(s('text', { x: m.l + 3, y: HEIGHT - 8, style: 'fill:var(--ink-2);font:500 11px var(--font-body)' }, 'Inside'));
    svg.appendChild(s('text', { x: m.l + pw - 3, y: HEIGHT - 8, 'text-anchor': 'end', style: 'fill:var(--ink-2);font:500 11px var(--font-body)' }, 'Outside'));

    // dew point line
    const yd = Y(an.dewPointF);
    svg.appendChild(s('line', { x1: m.l, x2: m.l + pw, y1: yd, y2: yd, style: 'stroke:var(--cold);stroke-width:1.25;stroke-dasharray:6 4' }));
    // put the label where the profile is far from it: above if the line sits low, else below
    const above = yd > m.t + 22;
    const midTemp = (an.profile[0].tempF + an.profile[an.profile.length - 1].tempF) / 2;
    const labelOnRight = an.dewPointF > midTemp ? true : false;
    svg.appendChild(s('text', {
      x: labelOnRight ? m.l + pw - 3 : m.l + 4, y: above ? yd - 4 : yd + 12,
      'text-anchor': labelOnRight ? 'end' : 'start',
      style: 'fill:var(--cold);font:500 11px var(--font-body);paint-order:stroke;stroke:var(--paper-2);stroke-width:3px',
    }, `Dew point ${fmt(an.dewPointF, 1)} °F`));

    // dew plane marker
    if (an.dewPlane) {
      const xp = X(an.dewPlane.z);
      svg.appendChild(s('line', { x1: xp, x2: xp, y1: m.t, y2: m.t + ph, style: 'stroke:var(--cold);stroke-width:1;opacity:0.6' }));
    }

    // profile
    const pts = an.profile.map((p) => `${X(p.z).toFixed(1)},${Y(p.tempF).toFixed(1)}`).join(' ');
    svg.appendChild(s('polyline', { points: pts, style: 'fill:none;stroke:currentColor;stroke-width:1.5;stroke-linejoin:round;stroke-linecap:round' }));

    // condensation point
    if (an.risk && an.condensation) {
      const c = an.condensation;
      const cx = X(c.z);
      const cy = Y(c.tempF);
      svg.appendChild(s('circle', { cx, cy, r: 4.5, style: 'fill:var(--warn);stroke:var(--paper-2);stroke-width:1.5' }));
      const right = cx < m.l + pw * 0.6;
      svg.appendChild(s('text', {
        x: right ? cx + 10 : cx - 10, y: cy + (cy < yd ? -8 : 16), 'text-anchor': right ? 'start' : 'end',
        style: 'fill:var(--warn);font:500 11px var(--font-mono);paint-order:stroke;stroke:var(--paper-2);stroke-width:3px',
      }, `${fmt(c.tempF, 1)} °F`));
    }
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
    const w = Math.round(container.clientWidth);
    if (w > 50 && w !== width) { width = w; draw(); }
  }) : null;
  if (ro) ro.observe(container);
  width = Math.round(container.clientWidth) || 340;

  return {
    update(an, selected) { last = an; sel = selected; draw(); },
    dispose() { if (ro) ro.disconnect(); svg.remove(); },
  };
}
