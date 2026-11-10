// envelope/material-look.js  Realistic PBR looks for wall layers (Envelope Lab).
// 1 scene unit = 1 inch. Every look has a color map, a bump map, a roughness and (for metals) a metalness,
// and a tile size in inches so patterns keep their real-world scale (brick 8" x 2-2/3" courses, CMU 16" x 8", ...).
//
// Texture source, in priority order for each material id:
//   1. assets/materials/<name>.jpg  (photo-like, 1024 x 1024, seamless) when the file exists.
//      It is requested lazily, only for ids that are in use. A missing file is ignored without a message.
//   2. a procedural texture drawn on a canvas once per kind and cached at module level.
// The look always starts procedural and swaps to the photo when it arrives, so a first frame never waits.
//
// UV convention for geometry built by assembly-3d.js: uv is in INCHES and the texture repeat is 1 / tile,
// so one texture is shared by every part (opts.uvInches). Pass opts.widthIn / opts.heightIn instead when you
// use a plain BoxGeometry (uv 0..1 per face): then the look clones its textures with a repeat that gives true size.

import * as THREE from 'three';

// ---------------------------------------------------------------------------------------------- tables
/** Material ids (materials.js) that have a dedicated look. */
export const LOOK_IDS = [
  'gyp_050', 'gyp_063', 'gyp_sheath', 'osb', 'plywood', 'batt_r13', 'batt_r19', 'batt_r21', 'minwool', 'xps', 'eps',
  'polyiso', 'ccspf', 'airspace', 'wrb', 'brick', 'cmu8', 'concrete', 'fibercement', 'vinyl', 'stucco', 'softwood',
  'steel', 'aluminum',
];
/** Extra looks used for cut edges and stud ends (not material ids). */
export const EDGE_IDS = ['gypcore', 'polycore', 'woodend'];

const ID_TO_KEY = {
  gyp_050: 'gyp', gyp_063: 'gyp63', gyp_sheath: 'gypsh', osb: 'osb', plywood: 'ply', batt_r13: 'battY', batt_r19: 'battP',
  batt_r21: 'battR', minwool: 'mwool', xps: 'xps', eps: 'eps', polyiso: 'piso', ccspf: 'spf', airspace: 'air', wrb: 'wrb',
  brick: 'brick', cmu8: 'cmu', concrete: 'conc', fibercement: 'fc', vinyl: 'vinyl', stucco: 'stucco', softwood: 'wood',
  steel: 'steel', aluminum: 'alum', gypcore: 'core', polycore: 'pcore', woodend: 'woodend',
};

// photo file name (assets/materials/<name>.jpg) per material id; null = procedural only
const ASSET_NAME = {
  brick: 'brick', cmu8: 'cmu', concrete: 'concrete', osb: 'osb', plywood: 'plywood', batt_r19: 'batt', batt_r21: 'batt',
  minwool: 'minwool', xps: 'xps', eps: 'eps', polyiso: 'polyiso', gyp_050: 'gypsum', gyp_063: 'gypsum', gyp_sheath: 'gypsum',
  fibercement: 'fibercement', softwood: 'wood', steel: 'steel', stucco: 'stucco', wrb: 'wrb',
};
// the photo covers this many inches on each side (tunable if a photo shows a different patch size)
const ASSET_TILE = {
  brick: 64, cmu: 32, concrete: 48, osb: 20, plywood: 24, batt: 16, minwool: 12, xps: 24, eps: 12, polyiso: 24, gypsum: 24,
  fibercement: 12, wood: 18, steel: 12, stucco: 12, wrb: 12,
};
const MIRROR = new Set(['wood', 'batt', 'concrete']);
// multiply tint applied to a photo, so a shared photo still reads as the swatch of each id
const ASSET_TINT = { gyp_063: '#e6dcc0', gyp_sheath: '#9fc392' };

// kind: size px [w, h], tile in inches [w, h], roughness, metalness, bump scale, env intensity, cut-face color, flat color
const DEFS = {
  brick: { size: [1024, 1024], tile: [32, 32], rough: 0.93, metal: 0, bump: 1.6, env: 0.5, cut: '#a3402f', flat: '#b5382a' },
  cmu: { size: [1024, 512], tile: [32, 16], rough: 0.96, metal: 0, bump: 1.4, env: 0.45, cut: '#8e8e8a', flat: '#8a8d91' },
  conc: { size: [512, 512], tile: [48, 48], rough: 0.92, metal: 0, bump: 1.2, env: 0.45, cut: '#7f8182', flat: '#7a7d80' },
  osb: { size: [1024, 1024], tile: [24, 24], rough: 0.86, metal: 0, bump: 1.2, env: 0.5, cut: '#b98443', flat: '#dba44f' },
  ply: { size: [512, 512], tile: [24, 24], rough: 0.72, metal: 0, bump: 0.6, env: 0.6, cut: '#b9864f', flat: '#a9672e' },
  wood: { size: [512, 512], tile: [12, 12], rough: 0.74, metal: 0, bump: 0.8, env: 0.6, cut: '#d3a468', flat: '#9c6b3c' },
  woodend: { size: [512, 512], tile: [8, 8], rough: 0.85, metal: 0, bump: 0.9, env: 0.5, cut: '#d3a468', flat: '#c99a5e' },
  gyp: { size: [512, 512], tile: [24, 24], rough: 0.9, metal: 0, bump: 0.35, env: 0.5, cut: '#a8a59d', flat: '#e3dccb' },
  gyp63: { size: [512, 512], tile: [24, 24], rough: 0.9, metal: 0, bump: 0.35, env: 0.5, cut: '#a8a59d', flat: '#c9bb94' },
  gypsh: { size: [512, 512], tile: [24, 24], rough: 0.88, metal: 0, bump: 0.4, env: 0.5, cut: '#a8a59d', flat: '#7fa36b' },
  core: { size: [256, 256], tile: [8, 8], rough: 0.95, metal: 0, bump: 0.8, env: 0.4, cut: '#a8a59d', flat: '#a8a59d' },
  battY: { size: [512, 512], tile: [12, 12], rough: 1, metal: 0, bump: 1.8, env: 0.35, cut: '#f2cf55', flat: '#f7d23e' },
  battP: { size: [512, 512], tile: [12, 12], rough: 1, metal: 0, bump: 1.8, env: 0.35, cut: '#f0a0b6', flat: '#f5a3b8' },
  battR: { size: [512, 512], tile: [12, 12], rough: 1, metal: 0, bump: 1.8, env: 0.35, cut: '#e8789f', flat: '#ee6f9b' },
  mwool: { size: [512, 512], tile: [12, 12], rough: 1, metal: 0, bump: 1.5, env: 0.35, cut: '#867640', flat: '#8a7a3a' },
  xps: { size: [512, 512], tile: [24, 24], rough: 0.5, metal: 0, bump: 0.35, env: 0.8, cut: '#5aa0e8', flat: '#2f7de1' },
  eps: { size: [512, 512], tile: [12, 12], rough: 0.88, metal: 0, bump: 1.4, env: 0.5, cut: '#eeeeea', flat: '#5fc7d9' },
  piso: { size: [512, 512], tile: [24, 24], rough: 0.42, metal: 0.92, bump: 0.7, env: 1.0, cut: '#e4d3a0', flat: '#9aa5b8' },
  pcore: { size: [256, 256], tile: [8, 8], rough: 0.85, metal: 0, bump: 1.0, env: 0.5, cut: '#e4d3a0', flat: '#e0cf9a' },
  spf: { size: [512, 512], tile: [12, 12], rough: 0.9, metal: 0, bump: 2.4, env: 0.5, cut: '#e6a560', flat: '#ff7a2f' },
  wrb: { size: [512, 512], tile: [12, 12], rough: 0.78, metal: 0, bump: 1.0, env: 0.6, cut: '#e8e6e0', flat: '#7fe0d2' },
  fc: { size: [512, 512], tile: [12, 12], rough: 0.68, metal: 0, bump: 1.2, env: 0.6, cut: '#8c8f8e', flat: '#6d8fa8' },
  vinyl: { size: [512, 512], tile: [12, 12], rough: 0.42, metal: 0, bump: 0.5, env: 0.8, cut: '#e8d9a8', flat: '#e8d9a8' },
  stucco: { size: [512, 512], tile: [12, 12], rough: 0.95, metal: 0, bump: 2.0, env: 0.4, cut: '#b8a78a', flat: '#c9b79c' },
  steel: { size: [512, 512], tile: [12, 12], rough: 0.4, metal: 0.92, bump: 0.5, env: 1.1, cut: '#8e969e', flat: '#4a5560' },
  alum: { size: [512, 512], tile: [12, 12], rough: 0.36, metal: 0.95, bump: 0.3, env: 1.1, cut: '#b8c0c8', flat: '#b8c0c8' },
  air: { size: [4, 4], tile: [12, 12], rough: 0.05, metal: 0, bump: 0, env: 1.0, cut: '#cfe6ef', flat: '#bfe3f2' },
};

// ---------------------------------------------------------------------------------------------- drawing helpers
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

/** Periodic value noise (tiles seamlessly). fx, fy = lattice cells across the tile at the first octave. Returns 0..1. */
function noise(w, h, fx, fy, seed, oct = 4, gain = 0.5) {
  const out = new Float32Array(w * h);
  const r = rng(seed);
  let amp = 1;
  let tot = 0;
  for (let o = 0; o < oct; o += 1) {
    const gx = Math.max(1, Math.round(fx * (1 << o)));
    const gy = Math.max(1, Math.round(fy * (1 << o)));
    const lat = new Float32Array(gx * gy);
    for (let i = 0; i < lat.length; i += 1) lat[i] = r();
    for (let y = 0; y < h; y += 1) {
      const v = (y / h) * gy;
      const y0 = Math.floor(v);
      const ty = v - y0;
      const sy = ty * ty * (3 - 2 * ty);
      const ra = (y0 % gy) * gx;
      const rb = ((y0 + 1) % gy) * gx;
      for (let x = 0; x < w; x += 1) {
        const u = (x / w) * gx;
        const x0 = Math.floor(u);
        const tx = u - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const xa = x0 % gx;
        const xb = (x0 + 1) % gx;
        const a = lat[ra + xa];
        const b = lat[ra + xb];
        const c = lat[rb + xa];
        const d = lat[rb + xb];
        out[y * w + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
      }
    }
    tot += amp;
    amp *= gain;
  }
  for (let i = 0; i < out.length; i += 1) out[i] /= tot;
  return out;
}

function newImg(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  const id = g.createImageData(w, h);
  return { c, g, id, d: id.data };
}
function done(img) { img.g.putImageData(img.id, 0, 0); return img.c; }
function grayCanvas(w, h, H) {
  const img = newImg(w, h);
  for (let i = 0; i < w * h; i += 1) {
    const v = clamp(H[i]) * 255;
    img.d[i * 4] = v; img.d[i * 4 + 1] = v; img.d[i * 4 + 2] = v; img.d[i * 4 + 3] = 255;
  }
  return done(img);
}
function put(d, i, r, g, b) {
  d[i * 4] = r < 0 ? 0 : r > 255 ? 255 : r;
  d[i * 4 + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
  d[i * 4 + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  d[i * 4 + 3] = 255;
}
/** Add soft round dimples/bumps into a field, wrapping at the edges. */
function splat(field, w, h, cx, cy, rad, amt) {
  const r2 = rad * rad;
  const R = Math.ceil(rad);
  for (let dy = -R; dy <= R; dy += 1) {
    for (let dx = -R; dx <= R; dx += 1) {
      const q = dx * dx + dy * dy;
      if (q > r2) continue;
      const x = (((cx + dx) % w) + w) % w;
      const y = (((cy + dy) % h) + h) % h;
      field[y * w + x] += amt * (1 - q / r2);
    }
  }
}
function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
/** Draw a closure at the 9 wrapped offsets so shapes crossing an edge tile seamlessly. */
function wrapped(w, h, x, y, margin, fn) {
  const xs = [0]; const ys = [0];
  if (x < margin) xs.push(w); if (x > w - margin) xs.push(-w);
  if (y < margin) ys.push(h); if (y > h - margin) ys.push(-h);
  for (const ox of xs) for (const oy of ys) fn(x + ox, y + oy);
}

// ---------------------------------------------------------------------------------------------- generators
// Each returns { color: canvas, bump: canvas | null }.

function genBrick() {
  const N = 1024; const R = rng(11);
  const COURSE = N / 12; const M = 12; const BL = 256;
  const mid = noise(N, N, 14, 14, 3, 4, 0.55);
  const fine = noise(N, N, 160, 160, 5, 2, 0.5);
  const pal = [[170, 60, 44], [182, 68, 48], [160, 52, 40], [192, 84, 58], [150, 62, 48], [174, 74, 54], [198, 98, 70], [132, 50, 40], [186, 78, 52], [164, 66, 50]];
  const col = [];
  for (let r = 0; r < 12; r += 1) {
    col.push([]);
    for (let c = 0; c < 4; c += 1) { const p = pal[Math.floor(R() * pal.length)]; const k = 0.9 + R() * 0.2; col[r].push([p[0] * k, p[1] * k, p[2] * k]); }
  }
  const img = newImg(N, N); const H = new Float32Array(N * N);
  for (let y = 0; y < N; y += 1) {
    const rr = Math.min(11, Math.floor(y / COURSE));
    const yin = y - rr * COURSE;
    const dy = Math.min(yin - M / 2, COURSE - M / 2 - yin);
    for (let x = 0; x < N; x += 1) {
      const xs = (x + (rr & 1) * 128) % N;
      const c = Math.floor(xs / BL);
      const xin = xs - c * BL;
      const dx = Math.min(xin - M / 2, BL - M / 2 - xin);
      const d = Math.min(dx, dy);
      const i = y * N + x;
      const cov = clamp(d + 0.5);
      const m = mid[i]; const f = fine[i];
      const bc = col[rr][c];
      let sh = 0.84 + 0.3 * m + 0.2 * (f - 0.5);
      const rnd = R();
      if (rnd < 0.004) sh *= 0.58; else if (rnd > 0.994) sh *= 1.22;
      sh *= 0.86 + 0.14 * clamp(d / 5);
      const mm = 0.8 + 0.34 * f + 0.14 * (m - 0.5);
      const mr = 178 * mm; const mg = 172 * mm; const mb = 158 * mm;
      put(img.d, i, mix(mr, bc[0] * sh, cov), mix(mg, bc[1] * sh, cov), mix(mb, bc[2] * sh, cov));
      H[i] = mix(0.1 + 0.14 * f, 0.62 + 0.3 * sstep(0, 6, d) + 0.1 * (f - 0.5) - (rnd < 0.004 ? 0.1 : 0), sstep(-1, 2, d));
    }
  }
  return { color: done(img), bump: grayCanvas(N, N, H) };
}

function genCmu() {
  const W = 1024; const Hh = 512; const R = rng(23);
  const mid = noise(W, Hh, 24, 12, 7, 4, 0.55);
  const fine = noise(W, Hh, 256, 128, 9, 2, 0.5);
  const pits = new Float32Array(W * Hh);
  for (let k = 0; k < 2600; k += 1) splat(pits, W, Hh, Math.floor(R() * W), Math.floor(R() * Hh), 1 + R() * 2.4, 0.5 + R() * 0.6);
  const blocks = [];
  for (let k = 0; k < 4; k += 1) blocks.push(0.93 + R() * 0.14);
  const img = newImg(W, Hh); const Hf = new Float32Array(W * Hh);
  const CH = Hh / 2; const J = 12;
  for (let y = 0; y < Hh; y += 1) {
    const rr = Math.floor(y / CH);
    const yin = y - rr * CH;
    const dy = Math.min(yin - J / 2, CH - J / 2 - yin);
    for (let x = 0; x < W; x += 1) {
      const xs = (x + rr * 512) % W;
      const bi = rr * 2 + Math.floor(xs / 512);
      const xin = xs % 512;
      const dx = Math.min(xin - J / 2, 512 - J / 2 - xin);
      const d = Math.min(dx, dy);
      const i = y * W + x;
      const cov = clamp(d + 0.5);
      const m = mid[i]; const f = fine[i]; const p = pits[i];
      let v = (150 + 40 * (m - 0.5) + 34 * (f - 0.5) - 44 * p) * blocks[bi];
      const rnd = R();
      if (rnd < 0.01) v -= 22; else if (rnd > 0.99) v += 20;
      const mv = (186 + 28 * (f - 0.5) + 14 * (m - 0.5));
      put(img.d, i, mix(mv, v + 1, cov), mix(mv - 2, v, cov), mix(mv - 6, v - 4, cov));
      Hf[i] = mix(0.14 + 0.1 * f, 0.7 + 0.18 * (f - 0.5) + 0.12 * (m - 0.5) - 0.3 * p, sstep(-1, 2.5, d));
    }
  }
  return { color: done(img), bump: grayCanvas(W, Hh, Hf) };
}

function genConc() {
  const N = 512; const R = rng(31);
  const mid = noise(N, N, 3, 3, 13, 5, 0.55);
  const fine = noise(N, N, 96, 96, 17, 2, 0.5);
  const warm = noise(N, N, 2, 2, 19, 2, 0.5);
  const pits = new Float32Array(N * N);
  for (let k = 0; k < 900; k += 1) splat(pits, N, N, Math.floor(R() * N), Math.floor(R() * N), 0.8 + R() * 1.4, 0.5 + R() * 0.5);
  for (let k = 0; k < 26; k += 1) splat(pits, N, N, Math.floor(R() * N), Math.floor(R() * N), 2 + R() * 2.4, 0.9);
  splat(pits, N, N, 256, 256, 5, 1.2); // form tie hole
  const img = newImg(N, N); const H = new Float32Array(N * N);
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const i = y * N + x;
      const m = mid[i]; const f = fine[i]; const p = pits[i];
      let v = 138 + 56 * (m - 0.5) + 22 * (f - 0.5) - 55 * Math.min(1, p);
      let seam = 0;
      const ex = Math.min(x, N - 1 - x); const ey = Math.min(y, N - 1 - y);
      const e = Math.min(ex, ey);
      if (e < 2) { seam = 1 - e / 2; v -= 22 * seam; }
      else if (e < 4) v += 6;
      const w = (warm[i] - 0.5) * 8;
      put(img.d, i, v + 2 + w, v + 2, v - w * 0.6);
      H[i] = 0.62 + 0.25 * (f - 0.5) + 0.18 * (m - 0.5) - 0.5 * Math.min(1, p) - 0.3 * seam;
    }
  }
  return { color: done(img), bump: grayCanvas(N, N, H) };
}

function genOsb() {
  const N = 1024; const R = rng(41);
  const col = newImg(N, N); const hc = newImg(N, N);
  const base = [168, 114, 56];
  col.g.fillStyle = `rgb(${base})`; col.g.fillRect(0, 0, N, N);
  hc.g.fillStyle = '#404040'; hc.g.fillRect(0, 0, N, N);
  const pal = [[219, 164, 79], [205, 146, 66], [190, 128, 56], [232, 185, 100], [172, 112, 50], [214, 172, 100], [240, 205, 130], [158, 100, 44], [226, 176, 92]];
  const g = col.g; const gh = hc.g;
  const STR = 1500;
  for (let s = 0; s < STR; s += 1) {
    const cx = R() * N; const cy = R() * N;
    const len = 90 + R() * 150; const wid = 20 + R() * 34;
    const ang = (R() - 0.5) * 1.0 + (R() < 0.12 ? Math.PI / 2 : 0);
    const p = pal[Math.floor(R() * pal.length)];
    const k = 0.9 + R() * 0.2;
    const fill = `rgb(${p[0] * k | 0},${p[1] * k | 0},${p[2] * k | 0})`;
    const lvl = 0.3 + R() * 0.65;
    const hv = `rgb(${lvl * 255 | 0},${lvl * 255 | 0},${lvl * 255 | 0})`;
    const grains = 3 + Math.floor(R() * 4);
    const grainSeed = R();
    wrapped(N, N, cx, cy, 150, (x, y) => {
      for (const [ctx, f, isH] of [[g, fill, false], [gh, hv, true]]) {
        ctx.save();
        ctx.translate(x, y); ctx.rotate(ang);
        ctx.fillStyle = f;
        ctx.fillRect(-len / 2, -wid / 2, len, wid);
        if (!isH) {
          ctx.strokeStyle = 'rgba(70,40,12,0.35)'; ctx.lineWidth = 1.4;
          ctx.strokeRect(-len / 2, -wid / 2, len, wid);
          ctx.lineWidth = 1;
          for (let q = 0; q < grains; q += 1) {
            const yy = (-0.5 + ((q + 0.5 + grainSeed * 0.4) / grains)) * wid * 0.9;
            ctx.strokeStyle = q % 2 ? 'rgba(90,55,20,0.28)' : 'rgba(255,230,170,0.22)';
            ctx.beginPath(); ctx.moveTo(-len / 2 + 3, yy); ctx.lineTo(len / 2 - 3, yy + (q - grains / 2) * 0.4); ctx.stroke();
          }
        } else {
          ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2.2;
          ctx.strokeRect(-len / 2, -wid / 2, len, wid);
        }
        ctx.restore();
      }
    });
  }
  // dark specks
  for (let k = 0; k < 700; k += 1) {
    const x = R() * N; const y = R() * N; const rr = 1 + R() * 2.5;
    g.fillStyle = `rgba(60,34,10,${0.25 + R() * 0.3})`;
    g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
  }
  return { color: col.c, bump: hc.c };
}

function genPly() {
  const N = 512; const R = rng(53);
  const warp = noise(N, N, 3, 2, 29, 3, 0.5);
  const warp2 = noise(N, N, 6, 4, 31, 2, 0.5);
  const fib = noise(N, N, 140, 5, 33, 2, 0.5);
  const img = newImg(N, N); const H = new Float32Array(N * N);
  const lathe = [];
  for (let k = 0; k < 26; k += 1) lathe.push([R() * N, R() * N, 18 + R() * 70]);
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const i = y * N + x;
      const u = x / N;
      const t = u * 9 + 2.3 * (warp[i] - 0.5) + 0.7 * (warp2[i] - 0.5);
      const ph = t - Math.floor(t);
      const ring = Math.pow(Math.abs(Math.sin(Math.PI * t)), 2.2);
      const fb = fib[i];
      let k = 0.4 + 0.6 * ring;
      k = k * 0.8 + 0.24 * (fb - 0.5) + 0.0 * ph;
      let r = mix(194, 142, k); let g = mix(134, 86, k); let b = mix(72, 38, k);
      const e = 0.92 + 0.16 * fb;
      r *= e; g *= e; b *= e;
      put(img.d, i, r, g, b);
      H[i] = 0.55 + 0.3 * (fb - 0.5) + 0.25 * (ring - 0.5);
    }
  }
  // lathe checks: thin darker vertical streaks
  for (const [cx, cy, len] of lathe) {
    for (let q = 0; q < len; q += 1) {
      const y = ((Math.floor(cy) + q) % N); const x = Math.floor(cx + Math.sin(q * 0.3) * 1.2) % N;
      const i = y * N + (x + N) % N;
      img.d[i * 4] *= 0.8; img.d[i * 4 + 1] *= 0.78; img.d[i * 4 + 2] *= 0.76;
      H[i] -= 0.22;
    }
  }
  return { color: done(img), bump: grayCanvas(N, N, H) };
}

function genWood() {
  const N = 512; const R = rng(57);
  const warp = noise(N, N, 3, 2, 61, 3, 0.5);
  const warp2 = noise(N, N, 8, 5, 63, 2, 0.5);
  const fib = noise(N, N, 160, 4, 65, 2, 0.5);
  const fib2 = noise(N, N, 50, 3, 67, 2, 0.5);
  const ringAmp = []; for (let k = 0; k < 80; k += 1) ringAmp.push(0.35 + R() * 0.9);
  const knots = [[0.3, 0.3, 0.034], [0.74, 0.78, 0.028]];
  const img = newImg(N, N); const H = new Float32Array(N * N);
  for (let y = 0; y < N; y += 1) {
    const v = y / N;
    for (let x = 0; x < N; x += 1) {
      const i = y * N + x;
      const u = x / N;
      let t = u * 52 + 1.5 * (warp[i] - 0.5) + 0.7 * (warp2[i] - 0.5);
      let kd = 99;
      for (let q = 0; q < 2; q += 1) {
        const kn = knots[q];
        let dx = u - kn[0]; let dy = v - kn[1];
        if (dx > 0.5) dx -= 1; else if (dx < -0.5) dx += 1;
        if (dy > 0.5) dy -= 1; else if (dy < -0.5) dy += 1;
        const d = Math.hypot(dx, dy * 0.8);
        if (d > 0.42) continue;
        t += 12 * Math.exp(-(d * d) / (18 * kn[2] * kn[2]));
        kd = Math.min(kd, d / kn[2]);
      }
      const fl = Math.floor(t);
      const ph = t - fl;
      const late = sstep(0.5, 0.95, ph) * (1 - sstep(0.95, 1.0, ph)) * ringAmp[((fl % 80) + 80) % 80];
      let k = 0.22 + 0.7 * late;
      k = k + 0.26 * (fib[i] - 0.5) + 0.12 * (fib2[i] - 0.5);
      let r = mix(216, 158, k); let g = mix(170, 106, k); let b = mix(108, 58, k);
      if (kd < 1) {
        const kk = 1 - kd; const ringk = 0.5 + 0.5 * Math.sin(kd * 22);
        r = mix(r, 104 + 24 * ringk, kk * 0.92); g = mix(g, 62 + 18 * ringk, kk * 0.92); b = mix(b, 32 + 10 * ringk, kk * 0.92);
      }
      put(img.d, i, r, g, b);
      H[i] = 0.55 - 0.28 * late + 0.24 * (fib[i] - 0.5) + (kd < 1 ? -0.1 : 0);
    }
  }
  return { color: done(img), bump: grayCanvas(N, N, H) };
}

function genWoodEnd() {
  const N = 512;
  const warp = noise(N, N, 3, 3, 71, 3, 0.5);
  const fib = noise(N, N, 90, 90, 73, 2, 0.5);
  const img = newImg(N, N); const H = new Float32Array(N * N);
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const i = y * N + x;
      const dx = (x - 0.3 * N) / N; const dy = (y - 1.35 * N) / N;
      const d = Math.hypot(dx * 1.0, dy * 1.12) + 0.01 * (warp[i] - 0.5);
      const t = d * 46;
      const ph = t - Math.floor(t);
      const late = sstep(0.5, 0.92, ph) * (1 - sstep(0.92, 1, ph));
      const k = 0.2 + 0.7 * late * (0.5 + 0.9 * warp[(i * 7) % (N * N)]) + 0.25 * (fib[i] - 0.5);
      put(img.d, i, mix(222, 176, k), mix(182, 128, k), mix(124, 78, k));
      H[i] = 0.6 - 0.3 * late + 0.2 * (fib[i] - 0.5);
    }
  }
  return { color: done(img), bump: grayCanvas(N, N, H) };
}

function genPaperBoard(base, seed) {
  const N = 512;
  const mid = noise(N, N, 6, 6, seed, 3, 0.5);
  const fib = noise(N, N, 220, 40, seed + 1, 2, 0.5);
  const fib2 = noise(N, N, 40, 200, seed + 2, 2, 0.5);
  const img = newImg(N, N); const H = new Float32Array(N * N);
  const R = rng(seed + 9);
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const i = y * N + x;
      const k = 1 + 0.07 * (mid[i] - 0.5) + 0.05 * (fib[i] - 0.5) + 0.045 * (fib2[i] - 0.5) + (R() - 0.5) * 0.025;
      put(img.d, i, base[0] * k, base[1] * k, base[2] * k);
      H[i] = 0.5 + 0.5 * (fib[i] - 0.5) + 0.4 * (fib2[i] - 0.5) + 0.2 * (R() - 0.5);
    }
  }
  return { color: done(img), bump: grayCanvas(N, N, H) };
}

function genCore() {
  const N = 256; const R = rng(81);
  const mid = noise(N, N, 6, 6, 83, 3, 0.5);
  const pits = new Float32Array(N * N);
  for (let k = 0; k < 400; k += 1) splat(pits, N, N, Math.floor(R() * N), Math.floor(R() * N), 0.8 + R() * 1.4, 0.7);
  const img = newImg(N, N); const H = new Float32Array(N * N);
  for (let i = 0; i < N * N; i += 1) {
    const v = 168 + 26 * (mid[i] - 0.5) + (R() - 0.5) * 16 - 38 * Math.min(1, pits[i]);
    put(img.d, i, v, v - 1, v - 5);
    H[i] = 0.55 + 0.25 * (R() - 0.5) - 0.4 * Math.min(1, pits[i]);
  }
  return { color: done(img), bump: grayCanvas(N, N, H) };
}

/** Fibrous insulation: many short soft strands over a mottled base. */
function genFibre(base, o) {
  const N = 512; const R = rng(o.seed);
  const mid = noise(N, N, 5, 5, o.seed + 1, 4, 0.55);
  const col = newImg(N, N); const hc = newImg(N, N);
  for (let i = 0; i < N * N; i += 1) {
    const k = o.base + o.mot * (mid[i] - 0.5);
    put(col.d, i, base[0] * k, base[1] * k, base[2] * k);
    const hv = 0.5 + 0.5 * (mid[i] - 0.5);
    put(hc.d, i, hv * 255, hv * 255, hv * 255);
  }
  col.g.putImageData(col.id, 0, 0); hc.g.putImageData(hc.id, 0, 0);
  const g = col.g; const gh = hc.g;
  for (let s = 0; s < o.strands; s += 1) {
    const cx = R() * N; const cy = R() * N;
    const len = o.len * (0.5 + R()); const ang = o.angle + (R() - 0.5) * o.spread;
    const light = R() < 0.5;
    const a = 0.16 + R() * 0.22;
    const lw = 0.7 + R() * o.thick;
    const bend = (R() - 0.5) * len * 0.5;
    wrapped(N, N, cx, cy, 70, (x, y) => {
      const dx = Math.cos(ang) * len / 2; const dy = Math.sin(ang) * len / 2;
      const nx = -Math.sin(ang) * bend; const ny = Math.cos(ang) * bend;
      for (const [ctx, isH] of [[g, false], [gh, true]]) {
        ctx.strokeStyle = isH ? (light ? `rgba(255,255,255,${a + 0.15})` : `rgba(0,0,0,${a + 0.12})`)
          : (light ? `rgba(${Math.min(255, base[0] * 1.12 + 8) | 0},${Math.min(255, base[1] * 1.2 + 14) | 0},${Math.min(255, base[2] * 1.25 + 14) | 0},${a * 1.1})`
            : `rgba(${base[0] * 0.78 | 0},${base[1] * 0.72 | 0},${base[2] * 0.72 | 0},${a * 0.6})`);
        ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.quadraticCurveTo(x + nx, y + ny, x + dx, y + dy); ctx.stroke();
      }
    });
  }
  return { color: col.c, bump: hc.c };
}

function genXps() {
  const N = 512; const R = rng(91);
  const mid = noise(N, N, 3, 3, 93, 3, 0.5);
  const streak = noise(N, N, 2, 60, 95, 2, 0.5);
  const img = newImg(N, N); const H = new Float32Array(N * N);
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const i = y * N + x;
      let k = 1 + 0.05 * (mid[i] - 0.5) + 0.05 * (streak[i] - 0.5) + (R() - 0.5) * 0.02;
      const e = Math.min(Math.min(x, N - 1 - x), Math.min(y, N - 1 - y));
      let seam = 0;
      if (e < 2) { seam = 1 - e / 2; k *= 1 - 0.28 * seam; }
      // faint printed-looking score marks: a dashed line every half tile
      if (Math.abs(y - N / 2) < 1.2 && (x % 40) < 22) k *= 0.88;
      if (Math.abs(x - N / 2) < 1.2 && (y % 40) < 22) k *= 0.88;
      put(img.d, i, 82 * k * 1.0, 154 * k, 228 * k);
      H[i] = 0.6 + 0.12 * (streak[i] - 0.5) + 0.06 * (R() - 0.5) - 0.5 * seam;
    }
  }
  return { color: done(img), bump: grayCanvas(N, N, H) };
}

function genEps() {
  const N = 512; const R = rng(101);
  const col = newImg(N, N); const hc = newImg(N, N);
  col.g.fillStyle = '#d4d4ce'; col.g.fillRect(0, 0, N, N);
  hc.g.fillStyle = '#303030'; hc.g.fillRect(0, 0, N, N);
  const g = col.g; const gh = hc.g;
  for (let s = 0; s < 2400; s += 1) {
    const cx = R() * N; const cy = R() * N; const rad = 5 + R() * 4;
    const v = 236 + R() * 16;
    wrapped(N, N, cx, cy, 14, (x, y) => {
      const gr = g.createRadialGradient(x - rad * 0.2, y - rad * 0.2, rad * 0.1, x, y, rad);
      gr.addColorStop(0, `rgb(${v | 0},${v | 0},${v - 3 | 0})`);
      gr.addColorStop(0.7, `rgb(${v - 8 | 0},${v - 8 | 0},${v - 10 | 0})`);
      gr.addColorStop(1, 'rgba(196,196,190,0.55)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
      const gg = gh.createRadialGradient(x, y, 0, x, y, rad);
      gg.addColorStop(0, '#ffffff'); gg.addColorStop(0.65, '#cfcfcf'); gg.addColorStop(1, '#202020');
      gh.fillStyle = gg; gh.beginPath(); gh.arc(x, y, rad, 0, Math.PI * 2); gh.fill();
    });
  }
  return { color: col.c, bump: hc.c };
}

function genPiso() {
  const N = 512; const R = rng(111);
  const warp = noise(N, N, 5, 5, 113, 4, 0.6);
  const fine = noise(N, N, 120, 120, 115, 2, 0.5);
  const img = newImg(N, N); const H = new Float32Array(N * N);
  for (let i = 0; i < N * N; i += 1) {
    const rid = Math.abs(warp[i] - 0.5) * 2; // ridged
    const k = 0.92 + 0.22 * (warp[i] - 0.5) + 0.08 * (fine[i] - 0.5) + 0.06 * (0.5 - rid);
    put(img.d, i, 182 * k, 189 * k, 200 * k);
    H[i] = 0.5 + 0.5 * (warp[i] - 0.5) + 0.1 * (fine[i] - 0.5);
  }
  const g = img.g; const gh = newImg(N, N);
  gh.g.fillStyle = '#808080'; gh.g.fillRect(0, 0, N, N);
  const hc = grayCanvas(N, N, H);
  img.g.putImageData(img.id, 0, 0);
  // long creases
  const hg = hc.getContext('2d');
  for (let s = 0; s < 46; s += 1) {
    const x = R() * N; const y = R() * N; const len = 40 + R() * 110; const ang = R() * Math.PI;
    const light = R() < 0.5;
    wrapped(N, N, x, y, 220, (px, py) => {
      for (const [ctx, st] of [[g, light ? 'rgba(255,255,255,0.2)' : 'rgba(70,76,88,0.13)'], [hg, light ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)']]) {
        ctx.strokeStyle = st; ctx.lineWidth = 0.8 + R() * 1.3;
        ctx.beginPath(); ctx.moveTo(px - Math.cos(ang) * len / 2, py - Math.sin(ang) * len / 2); ctx.lineTo(px + Math.cos(ang) * len / 2, py + Math.sin(ang) * len / 2); ctx.stroke();
      }
    });
  }
  return { color: img.c, bump: hc };
}

function genPcore() {
  const N = 256; const R = rng(121);
  const img = newImg(N, N); const H = new Float32Array(N * N);
  const cells = new Float32Array(N * N);
  for (let k = 0; k < 900; k += 1) splat(cells, N, N, Math.floor(R() * N), Math.floor(R() * N), 2 + R() * 3, 0.5 + R() * 0.5);
  for (let i = 0; i < N * N; i += 1) {
    const c = Math.min(1, cells[i]);
    const k = 1 - 0.2 * c + (R() - 0.5) * 0.05;
    put(img.d, i, 232 * k, 212 * k, 150 * k);
    H[i] = 0.6 - 0.45 * c + 0.1 * (R() - 0.5);
  }
  return { color: done(img), bump: grayCanvas(N, N, H) };
}

function genSpf() {
  const N = 512; const R = rng(131);
  const a = noise(N, N, 10, 10, 133, 4, 0.6);
  const b = noise(N, N, 28, 28, 135, 3, 0.6);
  const img = newImg(N, N); const H = new Float32Array(N * N);
  for (let i = 0; i < N * N; i += 1) {
    const lump = 0.6 * a[i] + 0.4 * b[i];
    const k = 0.72 + 0.6 * lump + (R() - 0.5) * 0.06;
    put(img.d, i, 232 * k, 150 * k, 70 * k);
    H[i] = lump;
  }
  return { color: done(img), bump: grayCanvas(N, N, H) };
}

function genWrb() {
  const N = 512; const R = rng(141);
  const crease = noise(N, N, 5, 5, 143, 4, 0.55);
  const fine = noise(N, N, 100, 100, 145, 2, 0.5);
  const img = newImg(N, N); const H = new Float32Array(N * N);
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const i = y * N + x;
      const rid = 1 - Math.abs(crease[i] - 0.5) * 2;
      const weave = 0.5 + 0.5 * Math.sin(x * 2.1) * Math.sin(y * 2.1);
      let k = 0.9 + 0.12 * (crease[i] - 0.5) + 0.05 * (fine[i] - 0.5) + 0.03 * weave + (R() - 0.5) * 0.02;
      let r = 238 * k; let g = 238 * k; let b = 234 * k;
      // neutral invented print: a pale blue-gray lattice of small triangles and dashes
      const px = x % 64; const py = y % 64;
      const diag = Math.abs(((x + y) % 128) - 64) < 1.3 ? 1 : 0;
      const tri = (py > 24 && py < 40 && Math.abs(px - 32) < (py - 24) * 0.5 && px > 24 && px < 40) ? 1 : 0;
      const ink = Math.max(diag * 0.5, tri * 0.55);
      r = mix(r, 150, ink); g = mix(g, 172, ink); b = mix(b, 200, ink);
      put(img.d, i, r, g, b);
      H[i] = 0.5 + 0.45 * (crease[i] - 0.5) + 0.2 * (rid - 0.5) + 0.08 * (weave - 0.5);
    }
  }
  return { color: done(img), bump: grayCanvas(N, N, H) };
}

function genBoardGrain(base, o) {
  const N = 512; const R = rng(o.seed);
  const mid = noise(N, N, 3, 3, o.seed + 1, 3, 0.5);
  const peel = noise(N, N, 150, 150, o.seed + 2, 2, 0.5);
  const img = newImg(N, N); const hb = newImg(N, N);
  for (let i = 0; i < N * N; i += 1) {
    const k = 1 + 0.07 * (mid[i] - 0.5) + o.peel * (peel[i] - 0.5) + (R() - 0.5) * o.speck;
    put(img.d, i, base[0] * k, base[1] * k, base[2] * k);
    const hv = (0.5 + 0.5 * (peel[i] - 0.5) + 0.2 * (mid[i] - 0.5)) * 255;
    put(hb.d, i, hv, hv, hv);
  }
  img.g.putImageData(img.id, 0, 0); hb.g.putImageData(hb.id, 0, 0);
  // embossed wood grain: short soft horizontal strokes
  for (let s = 0; s < o.strokes; s += 1) {
    const x = R() * N; const y = R() * N; const len = 50 + R() * 190;
    const dark = R() < 0.55; const a = 0.04 + R() * 0.07;
    wrapped(N, N, x, y, 200, (px, py) => {
      img.g.strokeStyle = dark ? `rgba(30,45,60,${a})` : `rgba(255,255,255,${a})`;
      img.g.lineWidth = 0.8 + R() * 2.2;
      img.g.beginPath(); img.g.moveTo(px - len / 2, py); img.g.quadraticCurveTo(px, py + (R() - 0.5) * 3, px + len / 2, py); img.g.stroke();
      hb.g.strokeStyle = dark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.3)';
      hb.g.lineWidth = 1.2;
      hb.g.beginPath(); hb.g.moveTo(px - len / 2, py); hb.g.lineTo(px + len / 2, py); hb.g.stroke();
    });
  }
  return { color: img.c, bump: hb.c };
}

function genStucco() {
  const N = 512; const R = rng(151);
  const mid = noise(N, N, 5, 5, 153, 4, 0.55);
  const sand = noise(N, N, 170, 170, 155, 2, 0.5);
  const img = newImg(N, N); const H = new Float32Array(N * N);
  const pits = new Float32Array(N * N);
  for (let k = 0; k < 1400; k += 1) splat(pits, N, N, Math.floor(R() * N), Math.floor(R() * N), 0.9 + R() * 1.6, 0.6);
  for (let i = 0; i < N * N; i += 1) {
    const k = 0.9 + 0.16 * (mid[i] - 0.5) + 0.2 * (sand[i] - 0.5) + (R() - 0.5) * 0.1 - 0.16 * Math.min(1, pits[i]);
    put(img.d, i, 208 * k, 190 * k, 160 * k);
    H[i] = 0.5 + 0.5 * (sand[i] - 0.5) + 0.3 * (mid[i] - 0.5) + 0.3 * (R() - 0.5) - 0.4 * Math.min(1, pits[i]);
  }
  return { color: done(img), bump: grayCanvas(N, N, H) };
}

function genSteel() {
  const N = 512; const R = rng(161);
  const roll = noise(N, N, 2, 90, 163, 2, 0.5);
  const img = newImg(N, N);
  const g = img.g;
  g.fillStyle = 'rgb(160,168,176)'; g.fillRect(0, 0, N, N);
  // galvanized spangle: irregular crystal patches of slightly different brightness
  for (let s = 0; s < 260; s += 1) {
    const cx = R() * N; const cy = R() * N; const rad = 18 + R() * 46;
    const v = 128 + R() * 90;
    const ang = R() * Math.PI;
    wrapped(N, N, cx, cy, 70, (x, y) => {
      g.save(); g.translate(x, y); g.rotate(ang);
      const gr = g.createLinearGradient(-rad, 0, rad, 0);
      gr.addColorStop(0, `rgba(${v | 0},${v + 6 | 0},${v + 14 | 0},0.0)`);
      gr.addColorStop(0.45, `rgba(${v | 0},${v + 6 | 0},${v + 14 | 0},0.3)`);
      gr.addColorStop(1, `rgba(${v - 20 | 0},${v - 14 | 0},${v - 6 | 0},0.0)`);
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(0, 0, rad, rad * (0.5 + R() * 0.5), 0, 0, Math.PI * 2); g.fill();
      g.restore();
    });
  }
  const d = g.getImageData(0, 0, N, N);
  for (let i = 0; i < N * N; i += 1) {
    const k = 0.94 + 0.12 * (roll[i] - 0.5) + (R() - 0.5) * 0.04;
    d.data[i * 4] *= k; d.data[i * 4 + 1] *= k; d.data[i * 4 + 2] *= k;
  }
  g.putImageData(d, 0, 0);
  const H = new Float32Array(N * N);
  for (let i = 0; i < N * N; i += 1) H[i] = 0.5 + 0.3 * (roll[i] - 0.5);
  return { color: img.c, bump: grayCanvas(N, N, H) };
}

function genAlum() {
  const N = 512; const R = rng(171);
  const brush = noise(N, N, 3, 160, 173, 2, 0.5);
  const img = newImg(N, N); const H = new Float32Array(N * N);
  for (let i = 0; i < N * N; i += 1) {
    const k = 0.93 + 0.2 * (brush[i] - 0.5) + (R() - 0.5) * 0.04;
    put(img.d, i, 200 * k, 205 * k, 211 * k);
    H[i] = 0.5 + 0.4 * (brush[i] - 0.5);
  }
  return { color: done(img), bump: grayCanvas(N, N, H) };
}

const GEN = {
  brick: genBrick, cmu: genCmu, conc: genConc, osb: genOsb, ply: genPly, wood: genWood, woodend: genWoodEnd,
  gyp: () => genPaperBoard([232, 225, 208], 201),
  gyp63: () => genPaperBoard([212, 199, 160], 211),
  gypsh: () => genPaperBoard([138, 170, 118], 221),
  core: genCore,
  battY: () => genFibre([246, 208, 78], { seed: 301, base: 0.95, mot: 0.2, strands: 9000, len: 30, angle: 0.0, spread: 6.3, thick: 1.4 }),
  battP: () => genFibre([244, 168, 188], { seed: 311, base: 0.95, mot: 0.2, strands: 9000, len: 30, angle: 0.0, spread: 6.3, thick: 1.4 }),
  battR: () => genFibre([238, 124, 160], { seed: 321, base: 0.95, mot: 0.2, strands: 9000, len: 30, angle: 0.0, spread: 6.3, thick: 1.4 }),
  mwool: () => genFibre([142, 126, 66], { seed: 331, base: 0.92, mot: 0.24, strands: 9000, len: 26, angle: 0.15, spread: 1.0, thick: 1.0 }),
  xps: genXps, eps: genEps, piso: genPiso, pcore: genPcore, spf: genSpf, wrb: genWrb,
  fc: () => genBoardGrain([112, 146, 172], { seed: 401, peel: 0.05, speck: 0.03, strokes: 260 }),
  vinyl: () => genBoardGrain([234, 220, 172], { seed: 411, peel: 0.03, speck: 0.012, strokes: 70 }),
  stucco: genStucco, steel: genSteel, alum: genAlum,
};

// ---------------------------------------------------------------------------------------------- caches
const texCache = new Map(); // key -> { color, bump, bumpFromColor? }
const assetState = new Map(); // asset name -> { status: 'pending'|'ok'|'missing', color, bump, subs:Set }
const liveLooks = new Set();
const ANISO = 4;

function procedural(key) {
  let t = texCache.get(key);
  if (t) return t;
  const gen = GEN[key];
  if (!gen) { t = { color: null, bump: null }; texCache.set(key, t); return t; }
  const out = gen();
  const color = new THREE.CanvasTexture(out.color);
  color.colorSpace = THREE.SRGBColorSpace;
  const bump = out.bump ? new THREE.CanvasTexture(out.bump) : null;
  if (bump) bump.colorSpace = THREE.NoColorSpace;
  for (const x of [color, bump]) {
    if (!x) continue;
    x.wrapS = THREE.RepeatWrapping; x.wrapT = THREE.RepeatWrapping;
    x.anisotropy = ANISO;
  }
  t = { color, bump };
  texCache.set(key, t);
  return t;
}

// Procedural textures are drawn one per timer tick so the first frame never waits on them.
const procQueue = [];
const procSubs = new Map(); // key -> Set<fn>
let procBusy = false;
function ensureProcedural(key, fn) {
  if (texCache.has(key)) { fn(); return; }
  let subs = procSubs.get(key);
  if (!subs) { subs = new Set(); procSubs.set(key, subs); procQueue.push(key); }
  subs.add(fn);
  pump();
}
function pump() {
  if (procBusy || !procQueue.length) return;
  procBusy = true;
  setTimeout(() => {
    const key = procQueue.shift();
    try { procedural(key); } catch (e) { console.error(e); texCache.set(key, { color: null, bump: null }); }
    const subs = procSubs.get(key);
    procSubs.delete(key);
    if (subs) subs.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    procBusy = false;
    pump();
  }, 0);
}

function loadAsset(name) {
  let st = assetState.get(name);
  if (st) return st;
  st = { status: 'pending', color: null, bump: null, subs: new Set() };
  assetState.set(name, st);
  const url = new URL(`../assets/materials/${name}.jpg`, import.meta.url).href;
  new THREE.TextureLoader().load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    const wrap = MIRROR.has(name) ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping; // photos with a visible seam mirror-tile
    tex.wrapS = wrap; tex.wrapT = wrap;
    tex.anisotropy = ANISO;
    tex.generateMipmaps = true;
    const bump = tex.clone();
    bump.wrapS = wrap; bump.wrapT = wrap;
    bump.colorSpace = THREE.NoColorSpace;
    bump.needsUpdate = true;
    st.color = tex; st.bump = bump; st.status = 'ok';
    st.subs.forEach((fn) => fn());
  }, undefined, () => { st.status = 'missing'; st.subs.clear(); });
  return st;
}

// ---------------------------------------------------------------------------------------------- materials
const CUT_VERT_FIX = '';
function attachCut(mat, cutHex) {
  const c = hex(cutHex);
  const u = { uCut: { value: new THREE.Vector3(c[0] / 255 * 0.94, c[1] / 255 * 0.94, c[2] / 255 * 0.94) }, uCutOn: { value: 0 } };
  mat.userData.cutU = u;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCut = u.uCut; sh.uniforms.uCutOn = u.uCutOn;
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `uniform vec3 uCut;\nuniform float uCutOn;\nvoid main() {${CUT_VERT_FIX}`)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n\tif (uCutOn > 0.5 && !gl_FrontFacing) gl_FragColor = vec4(uCut, 1.0);');
  };
  mat.customProgramCacheKey = () => 'lookcut1';
}

/**
 * A realistic PBR material for a wall layer.
 * @param {string} materialId  a key of MATERIALS (or 'gypcore' | 'polycore' | 'woodend')
 * @param {{widthIn?:number, heightIn?:number, depthIn?:number, uvInches?:boolean, onUpdate?:()=>void}} [opts]
 *   uvInches: the geometry uv is in inches (assembly-3d.js); the shared texture repeat is 1 / tile.
 *   widthIn / heightIn: use with a plain BoxGeometry; textures are cloned with a repeat that gives true size.
 *   onUpdate: called after a photo arrives and replaces the procedural texture.
 * @returns {{material: THREE.MeshStandardMaterial, tile:[number,number], cut:string, dispose():void}}
 */
export function getLook(materialId, opts = {}) {
  const key = ID_TO_KEY[materialId] || 'core';
  const def = DEFS[key];
  const assetName = ASSET_NAME[materialId] || null;
  const glass = key === 'air';

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: def.rough, metalness: def.metal, envMapIntensity: def.env,
  });
  if (glass) {
    mat.color.set('#dff0f6'); mat.transparent = true; mat.opacity = 0.1; mat.depthWrite = false; mat.side = THREE.DoubleSide;
    mat.envMapIntensity = 1.4;
  }
  attachCut(mat, def.cut);
  mat.userData.look = { id: materialId, key, flat: def.flat };

  const clones = [];
  const uvInches = opts.uvInches !== false && !(opts.widthIn || opts.heightIn);
  const useTex = (t) => {
    if (!t) return null;
    if (uvInches) { t.repeat.set(1 / tileW, 1 / tileH); t.updateMatrix(); return t; }
    const c = t.clone();
    c.repeat.set((opts.widthIn || tileW) / tileW, (opts.heightIn || tileH) / tileH);
    c.needsUpdate = true;
    clones.push(c);
    return c;
  };
  let tileW = def.tile[0];
  let tileH = def.tile[1];
  let mode = 'real';
  let usingAsset = false;

  function apply() {
    if (glass) { mat.needsUpdate = true; return; }
    const st = assetName ? assetState.get(assetName) : null;
    const photo = st && st.status === 'ok';
    usingAsset = !!photo;
    let color; let bump;
    if (photo) {
      tileW = ASSET_TILE[assetName] || def.tile[0]; tileH = tileW;
      color = st.color; bump = st.bump;
      color.repeat.set(1 / tileW, 1 / tileH); bump.repeat.set(1 / tileW, 1 / tileH);
    } else {
      tileW = def.tile[0]; tileH = def.tile[1];
      const p = texCache.get(key) || { color: null, bump: null };
      color = p.color; bump = p.bump;
      if (color) color.repeat.set(1 / tileW, 1 / tileH);
      if (bump) bump.repeat.set(1 / tileW, 1 / tileH);
    }
    if (mode === 'real') {
      mat.map = useTex(color);
      mat.bumpMap = useTex(bump);
      mat.bumpScale = def.bump * (photo ? 0.9 : 1);
      mat.color.set(!color ? def.flat : photo && ASSET_TINT[materialId] ? ASSET_TINT[materialId] : '#ffffff');
    } else {
      mat.map = null; mat.bumpMap = null; mat.color.set(def.flat);
    }
    mat.needsUpdate = true;
  }

  const refresh = () => { clones.forEach((c) => c.dispose()); clones.length = 0; apply(); if (opts.onUpdate) opts.onUpdate(); };
  apply();
  if (!glass && !texCache.has(key)) ensureProcedural(key, () => { if (!disposed) refresh(); });
  let disposed = false;
  let sub = null;
  if (assetName && !glass) {
    const st = loadAsset(assetName);
    if (st.status === 'pending') { sub = refresh; st.subs.add(sub); } else if (st.status === 'ok' && !usingAsset) apply();
  }
  const look = {
    material: mat,
    get tile() { return [tileW, tileH]; },
    cut: def.cut,
    setMode(m) { mode = m; apply(); },
    /** Turn the section-cut look on: back faces show the flat cut color, and the plane clips the part (and its shadow). */
    setSection(on, plane) {
      if (!glass) mat.side = on ? THREE.DoubleSide : THREE.FrontSide;
      mat.userData.cutU.uCutOn.value = on ? 1 : 0;
      mat.clippingPlanes = on && plane ? [plane] : null;
      mat.clipShadows = !!on;
      mat.needsUpdate = true;
    },
    dispose() {
      disposed = true;
      if (sub && assetName) { const st = assetState.get(assetName); if (st) st.subs.delete(sub); }
      clones.forEach((c) => c.dispose()); clones.length = 0;
      mat.dispose();
      liveLooks.delete(look);
    },
  };
  liveLooks.add(look);
  return look;
}

/** Switch a look material between realistic textures and a flat swatch color (cheap fallback path). */
export function setLookMode(material, mode) {
  const info = material && material.userData && material.userData.look;
  if (!info) return;
  if (mode === 'flat') { material.map = null; material.bumpMap = null; material.color.set(info.flat); material.needsUpdate = true; return; }
  const key = info.key;
  const p = procedural(key);
  const def = DEFS[key];
  if (p.color) { p.color.repeat.set(1 / def.tile[0], 1 / def.tile[1]); material.map = p.color; }
  if (p.bump) { p.bump.repeat.set(1 / def.tile[0], 1 / def.tile[1]); material.bumpMap = p.bump; }
  material.color.set('#ffffff');
  material.needsUpdate = true;
}

/** Tile size (inches), cut-face color and flat swatch for a material id. */
export function lookInfo(materialId) {
  const d = DEFS[ID_TO_KEY[materialId] || 'core'];
  return { tile: d.tile, cut: d.cut, flat: d.flat };
}

/** Debug helper: the procedural color canvas for a material id (not cached for callers to keep). */
export function proceduralCanvas(materialId) {
  const p = procedural(ID_TO_KEY[materialId] || 'core');
  return p.color ? p.color.image : null;
}
