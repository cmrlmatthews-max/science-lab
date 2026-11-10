// envelope/bridge-graph.js  Inside surface temperature graph for the Thermal Bridge mode: both versions on one chart.
// Returns an SVG string. Colors come from CSS variables so it follows the light and dark theme.

import { fmt } from '../shared/ui.js';

const f1 = (v) => fmt(v, 1);

/**
 * @param {object} rP result for the problem version
 * @param {object} rB result for the better version
 * @param {{tIn:number,tOut:number}} climate
 * @param {{problem:string, better:string}} names short names for the direct labels
 */
export function graphSvg(rP, rB, climate, names) {
  const W = 360; const H = 218; const ml = 38; const mr = 12; const mt = 14; const mb = 40;
  const pw = W - ml - mr; const ph = H - mt - mb;
  const dew = rP.dewPointF;
  const clearT = climate.tIn - 0.68 * rP.qClear;
  let lo = Math.min(rP.minInteriorT, rB.minInteriorT, dew, clearT);
  let hi = Math.max(clearT, rP.avgInteriorT, rB.avgInteriorT, dew);
  for (const r of [rP, rB]) for (let i = 0; i < r.interiorSurface.length; i++) { if (r.interiorSurface[i] > hi) hi = r.interiorSurface[i]; }
  const pad = Math.max(2, (hi - lo) * 0.12);
  lo = Math.floor(lo - pad); hi = Math.ceil(hi + pad);
  if (hi - lo < 10) { const m = (hi + lo) / 2; lo = Math.floor(m - 5); hi = Math.ceil(m + 5); }
  const xs = (inch) => ml + (inch / rP.widthIn) * pw;
  const ys = (t) => mt + (1 - (t - lo) / (hi - lo)) * ph;
  const step = (hi - lo) <= 14 ? 2 : (hi - lo) <= 30 ? 5 : 10;
  let g = '';
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) {
    const y = ys(t).toFixed(1);
    g += `<line x1="${ml}" x2="${W - mr}" y1="${y}" y2="${y}" style="stroke:var(--line)" stroke-width="1"/>`;
    g += `<text x="${ml - 5}" y="${(ys(t) + 3.3).toFixed(1)}" text-anchor="end">${t}</text>`;
  }
  const xt = rP.widthIn <= 20 ? 4 : rP.widthIn <= 34 ? 8 : 10;
  for (let x = 0; x <= rP.widthIn + 0.01; x += xt) {
    g += `<line x1="${xs(x).toFixed(1)}" x2="${xs(x).toFixed(1)}" y1="${mt + ph}" y2="${mt + ph + 4}" style="stroke:var(--line-strong)" stroke-width="1"/>`;
    g += `<text x="${xs(x).toFixed(1)}" y="${mt + ph + 15}" text-anchor="middle">${x}</text>`;
  }
  g += `<path d="M${ml} ${mt}V${mt + ph}H${W - mr}" fill="none" style="stroke:var(--line-strong)" stroke-width="1"/>`;
  const axisLabel = rP.orientation === 'section' ? 'Height up the wall (in)' : 'Across the wall (in)';
  g += `<text class="cap" x="${ml + pw / 2}" y="${H - 5}" text-anchor="middle">${axisLabel}</text>`;
  g += `<text class="cap" x="11" y="${mt + ph / 2}" text-anchor="middle" transform="rotate(-90 11 ${mt + ph / 2})">Inside surface (°F)</text>`;
  // dew point
  const yd = ys(dew);
  g += `<line x1="${ml}" x2="${W - mr}" y1="${yd.toFixed(1)}" y2="${yd.toFixed(1)}" style="stroke:var(--accent)" stroke-width="1.25" stroke-dasharray="7 4"/>`;
  const dewBelow = yd < mt + ph * 0.45;
  g += `<text class="cap" x="${W - mr - 3}" y="${(dewBelow ? yd + 12 : yd - 4).toFixed(1)}" text-anchor="end" style="fill:var(--accent)">Dew point ${f1(dew)} °F</text>`;
  const line = (r) => {
    let d = '';
    for (let i = 0; i < r.interiorSurface.length; i++) {
      d += `${i ? 'L' : 'M'}${xs((i + 0.5) * r.cell).toFixed(1)} ${ys(r.interiorSurface[i]).toFixed(1)}`;
    }
    return d;
  };
  g += `<path d="${line(rB)}" fill="none" style="stroke:var(--ink-2)" stroke-width="1.6" stroke-dasharray="5 3" stroke-linejoin="round"/>`;
  g += `<path d="${line(rP)}" fill="none" style="stroke:var(--ink)" stroke-width="1.8" stroke-linejoin="round"/>`;
  // minimum points
  const mark = (r, solid) => {
    const mx = xs((r.minInteriorAt + 0.5) * r.cell); const my = ys(r.minInteriorT);
    const bad = r.minInteriorT < dew;
    const fillc = bad ? 'var(--warn)' : (solid ? 'var(--ink)' : 'var(--paper-2)');
    const strokec = bad ? 'var(--warn)' : (solid ? 'var(--paper-2)' : 'var(--ink-2)');
    return `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="4.2" style="fill:${fillc};stroke:${strokec}" stroke-width="1.6"/>`;
  };
  g += mark(rB, false) + mark(rP, true);
  // direct labels at the minimum points (placed on the roomier side, and apart from each other)
  const label = (r, text, solid, dy) => {
    const mx = xs((r.minInteriorAt + 0.5) * r.cell); const my = ys(r.minInteriorT);
    const right = mx > ml + pw * 0.58;
    const x = right ? mx - 8 : mx + 8;
    const col = r.minInteriorT < dew ? 'var(--warn)' : 'var(--ink)';
    const y = my + dy;
    return `<text class="cap" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${right ? 'end' : 'start'}" style="fill:${col}">${text} ${f1(r.minInteriorT)}${solid ? '' : ''}</text>`;
  };
  const pY = ys(rP.minInteriorT); const bY = ys(rB.minInteriorT);
  const pLow = pY >= bY;     // problem is the lower point on screen
  g += label(rP, names.problem, true, pLow ? 15 : -9);
  g += label(rB, names.better, false, pLow ? -9 : 15);
  const lab = `Inside surface temperature along the detail. ${names.problem}: lowest ${f1(rP.minInteriorT)} degrees F. ${names.better}: lowest ${f1(rB.minInteriorT)} degrees F. Dew point ${f1(dew)} degrees F.`;
  return `<svg class="bt-graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="${lab}">${g}</svg>`;
}
