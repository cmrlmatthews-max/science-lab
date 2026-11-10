// envelope/bridge-flow.js  Heat-flow streamlines and animated arrow ribbons for the Thermal Bridge mock-ups.
//
// The solver result has temperatures but not the cell conductivities, so cellK() rebuilds them with the same
// rules bridge.js uses (layer R kept when a layer is rounded to whole cells, thin steel as k_eff, standoff mix).
// tests/bridge-flow check: the heat balance of each cell is closed to a small residual (see verifyBalance()).
//
// Streamlines start on the warm face at positions that carry equal shares of the heat (with a mild compression),
// so they bunch where the heat goes through a bridge. Ribbons are drawn in a small shader: the arrow glyphs
// are a pattern along the ribbon, so a time uniform makes them flow from warm to cold.

import * as THREE from 'three';

const KS = 312.5;
const THICK = { gyp: 0.625, sheath: 0.625, brick: 3.625, clad: 0.5, batt: 6, studzone: 6, minwool: 2, air: 2 };

/** Per-cell conductivity as used by the solver (Btu*in/(h*ft2*F)). */
export function cellK(r) {
  const { nx, ny, cell: c, mats, palette } = r;
  const kPal = palette.map((p) => p.k);
  const idOf = palette.map((p) => p.id);
  // the clear column (i = 0) gives layer cell counts
  const counts = {};
  const clearRowK = new Float64Array(ny);
  for (let j = 0; j < ny; j++) { const id = idOf[mats[j * nx]]; counts[id] = (counts[id] || 0) + 1; }
  const factor = {};
  Object.keys(counts).forEach((id) => { if (THICK[id]) factor[id] = (counts[id] * c) / THICK[id]; });
  for (let j = 0; j < ny; j++) { const m = mats[j * nx]; clearRowK[j] = kPal[m] * (factor[idOf[m]] || 1); }
  const k = new Float64Array(nx * ny);
  // cavity rows (stud) for flange detection
  let c0 = -1; let c1 = -1;
  for (let j = 0; j < ny; j++) if (idOf[mats[j * nx]] === 'batt') { if (c0 < 0) c0 = j; c1 = j + 1; }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = j * nx + i;
      const id = idOf[mats[p]];
      let v;
      if (id === 'steel') {
        if (r.detailId === 'stud') v = (j === c0 || j === c1 - 1) ? (KS * 0.045) / c : (KS * 0.045) / (2 * 1 * c);
        else {
          const kLeg = KS * 0.375 / c;
          const f = r.variantId === 'standoff' ? 4 / 48 : 1;
          v = f * kLeg + (1 - f) * clearRowK[j];
        }
      } else if (id === 'softwood' || id === 'concrete' || id === 'break') v = kPal[mats[p]];
      else v = kPal[mats[p]] * (factor[id] || 1);
      k[p] = v;
    }
  }
  return k;
}

/** Cell-centred flux vectors (heat flowing toward +i and +j when the first cell is warmer). */
export function fluxField(r, k) {
  const { nx, ny, cell: c, temps } = r;
  const qi = new Float32Array(nx * ny);
  const qj = new Float32Array(nx * ny);
  const R = (p, q) => c / 2 / k[p] + c / 2 / k[q];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = j * nx + i;
      let a = 0; let na = 0; let b = 0; let nb = 0;
      if (i > 0) { const q = p - 1; a += (temps[q] - temps[p]) / R(p, q); na++; }
      if (i < nx - 1) { const q = p + 1; a += (temps[p] - temps[q]) / R(p, q); na++; }
      if (j > 0) { const q = p - nx; b += (temps[q] - temps[p]) / R(p, q); nb++; }
      if (j < ny - 1) { const q = p + nx; b += (temps[p] - temps[q]) / R(p, q); nb++; }
      qi[p] = na ? a / na : 0;
      qj[p] = nb ? b / nb : 0;
    }
  }
  return { qi, qj };
}

/** Largest relative heat-balance residual over interior cells (for tests). */
export function verifyBalance(r) {
  const k = cellK(r);
  const { nx, ny, cell: c, temps } = r;
  const R = (p, q) => c / 2 / k[p] + c / 2 / k[q];
  let worst = 0;
  for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const p = j * nx + i;
    let net = 0; let mag = 0;
    [p - 1, p + 1, p - nx, p + nx].forEach((q) => { const f = (temps[q] - temps[p]) / R(p, q); net += f; mag += Math.abs(f); });
    if (mag > 1e-9) worst = Math.max(worst, Math.abs(net) / mag);
  }
  return worst;
}

function bilerp(arr, nx, ny, a, b) {
  const x = Math.min(nx - 1, Math.max(0, a - 0.5));
  const y = Math.min(ny - 1, Math.max(0, b - 0.5));
  const x0 = Math.floor(x); const y0 = Math.floor(y);
  const x1 = Math.min(nx - 1, x0 + 1); const y1 = Math.min(ny - 1, y0 + 1);
  const tx = x - x0; const ty = y - y0;
  const v00 = arr[y0 * nx + x0]; const v10 = arr[y0 * nx + x1];
  const v01 = arr[y1 * nx + x0]; const v11 = arr[y1 * nx + x1];
  return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
}

/**
 * Streamlines of the heat flux. Each is an array of [a, b, mag] in cell-edge coordinates (a along i, b along j).
 * @param {object} r solveBridge result
 * @param {{tIn:number,tOut:number}} climate
 * @param {number} count number of lines
 */
export function streamlines(r, climate, count) {
  const dT = climate.tIn - climate.tOut;
  if (Math.abs(dT) < 1) return [];
  const { nx, ny } = r;
  const k = cellK(r);
  const { qi, qj } = fluxField(r, k);
  const hotIn = dT > 0;
  // flux entering through the hot face, per column
  const w = new Float64Array(nx);
  let tot = 0;
  for (let i = 0; i < nx; i++) {
    let f;
    if (hotIn) f = Math.abs(climate.tIn - r.interiorSurface[i]) / 0.68;
    else f = Math.abs(qj[(ny - 1) * nx + i]);
    w[i] = Math.pow(Math.max(f, 1e-6), 0.72);
    tot += w[i];
  }
  const lines = [];
  const ds = 0.45;
  for (let m = 0; m < count; m++) {
    const target = ((m + 0.5) / count) * tot;
    let acc = 0; let a = nx / 2;
    for (let i = 0; i < nx; i++) {
      if (acc + w[i] >= target) { a = i + (target - acc) / w[i]; break; }
      acc += w[i];
    }
    let b = hotIn ? 0 : ny;
    const pts = [];
    const sg = 1;
    for (let it = 0; it < 4000; it++) {
      const vi = bilerp(qi, nx, ny, a, b); const vj = bilerp(qj, nx, ny, a, b);
      const mag = Math.hypot(vi, vj);
      pts.push([a, b, mag]);
      if (mag < 1e-9) break;
      // midpoint step
      const a1 = a + (sg * vi / mag) * ds * 0.5; const b1 = b + (sg * vj / mag) * ds * 0.5;
      const ui = bilerp(qi, nx, ny, a1, b1); const uj = bilerp(qj, nx, ny, a1, b1);
      const um = Math.hypot(ui, uj) || 1;
      a += (sg * ui / um) * ds; b += (sg * uj / um) * ds;
      if (a < 0.2) a = 0.2; if (a > nx - 0.2) a = nx - 0.2;
      if (hotIn ? b >= ny : b <= 0) { pts.push([a, hotIn ? ny : 0, mag]); break; }
    }
    if (pts.length > 3) lines.push(pts);
  }
  return lines;
}

const VERT = `
attribute float aS;
attribute float aV;
attribute float aW;
varying float vS;
varying float vV;
varying float vW;
void main() {
  vS = aS; vV = aV; vW = aW;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = `
precision highp float;
uniform float uTime;
uniform float uPeriod;
uniform float uSpeed;
uniform float uHalo;
uniform vec3 uCore;
uniform vec3 uHaloCol;
varying float vS;
varying float vV;
varying float vW;
void main() {
  float P = uPeriod;
  float hw = vW;
  float lat = abs(vV) * (hw + uHalo);
  float x = mod(vS - uTime * uSpeed, P);
  // shaft and head, as signed "inside" distances (positive inside)
  float shaft = min(0.30 * hw - lat, min(x - 0.05 * P, 0.66 * P - x));
  float headW = hw * (0.98 * P - x) / (0.36 * P);
  float head = min(headW - lat, min(x - 0.62 * P, 0.98 * P - x));
  float core = max(shaft, head);
  float fw = max(fwidth(core), 1e-4);
  float aCore = clamp(core / fw + 0.5, 0.0, 1.0);
  float aHalo = clamp((core + uHalo) / fw + 0.5, 0.0, 1.0);
  if (aHalo < 0.02) discard;
  vec3 col = mix(uHaloCol, uCore, aCore);
  gl_FragColor = vec4(col, aHalo * 0.94);
}`;

/** Build the arrow ribbons for one mock-up. Returns { group, update(time), dispose() }. */
export function createArrows(model, r, climate, opts = {}) {
  const lines = streamlines(r, climate, opts.count || 16);
  const group = new THREE.Group();
  if (!lines.length) return { group, update() {}, dispose() {}, empty: true };
  const period = opts.period || 2.4;
  const halo = period * 0.05;
  // reference flux: clear wall
  const qRef = Math.max(1e-6, Math.abs(r.qClear));
  const pos = []; const aS = []; const aV = []; const aW = []; const idx = [];
  const OFF = opts.offset || 0.12;
  lines.forEach((pts) => {
    // resample to world points
    const wp = pts.map(([a, b, mag]) => ({ p: model.P(a, b, OFF), mag }));
    // drop near-duplicates
    const keep = [wp[0]];
    for (let n = 1; n < wp.length; n++) if (wp[n].p.distanceTo(keep[keep.length - 1].p) > 0.02) keep.push(wp[n]);
    if (keep.length < 3) return;
    // smooth the width over a few points so the glyph does not flicker
    const mags = keep.map((q) => q.mag);
    const sm = mags.map((_, n) => {
      let s = 0; let c = 0;
      for (let d = -4; d <= 4; d++) { const v = mags[n + d]; if (v != null) { s += v; c++; } }
      return s / c;
    });
    let s = 0;
    const base = pos.length / 3;
    keep.forEach((q, n) => {
      if (n > 0) s += q.p.distanceTo(keep[n - 1].p);
      const prev = keep[Math.max(0, n - 1)].p; const next = keep[Math.min(keep.length - 1, n + 1)].p;
      const t = next.clone().sub(prev).normalize();
      const perp = new THREE.Vector3().crossVectors(model.normalOut, t).normalize();
      const hw = period * 0.2 * Math.min(2.1, Math.max(0.55, 0.8 * Math.sqrt(sm[n] / qRef)));
      const ext = hw + halo;
      [-1, 1].forEach((sgn) => {
        const v = q.p.clone().addScaledVector(perp, sgn * ext);
        pos.push(v.x, v.y, v.z);
        aS.push(s); aV.push(sgn); aW.push(hw);
      });
      if (n > 0) {
        const o = base + (n - 1) * 2;
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
    });
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
  geo.setAttribute('aV', new THREE.Float32BufferAttribute(aV, 1));
  geo.setAttribute('aW', new THREE.Float32BufferAttribute(aW, 1));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uPeriod: { value: period },
      uSpeed: { value: period * 0.42 },
      uHalo: { value: halo },
      uCore: { value: new THREE.Color(opts.core || '#15181d') },
      uHaloCol: { value: new THREE.Color(opts.haloColor || '#fbf9f2') },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 6;
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  group.add(mesh);
  return {
    group,
    update(t) { mat.uniforms.uTime.value = t; },
    dispose() { geo.dispose(); mat.dispose(); },
    empty: false,
  };
}
