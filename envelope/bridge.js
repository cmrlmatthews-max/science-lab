// envelope/bridge.js
// 2D steady-state heat conduction for thermal bridge details (Part B).
// Pure JavaScript, no imports, no DOM. Runs in the browser and in Node 22.
//
// METHOD
//   Finite-volume grid of square cells (unit depth). Conductivity k is in
//   Btu*in/(h*ft2*F) (= 1 / R-per-inch). Between two neighbouring cell centres the
//   resistance per unit area is R = (c/2)/k1 + (c/2)/k2 (harmonic mean), and the
//   heat flux is dT / R. The cell face length c is common to every face, so the
//   conductance used in the matrix is simply G = 1 / R. Surface cells connect to
//   the air through the film resistance (0.68 inside, 0.17 outside) plus half a
//   cell of material. The two i-edges are adiabatic (symmetry / repeat).
//
//   The matrix is symmetric positive definite, so it is solved with conjugate
//   gradients preconditioned by an incomplete Cholesky factorisation, IC(0).
//   Plain Gauss-Seidel/SOR is also included (opts.method = 'sor', omega 1.9). It
//   works, but it needs many more sweeps once steel (k about 300) touches
//   insulation (k about 0.25), so PCG is the default. Both stop when the largest
//   change in any cell temperature in one iteration is below opts.tol (default 1e-4 F;
//   the default solve actually runs a tighter 2e-5 so that the answer is converged
//   well inside the flux-balance check).
//
//   THIN STEEL. Steel parts thinner than a cell (stud web and flanges, angle legs)
//   use ONE cell with k_eff = k_steel * (real thickness / cell). The in-plane
//   conductance k*t is then exact, and the through-thickness resistance of the
//   cell is negligible either way.
//
//   LAYER R PRESERVED. When a layer thickness is not a whole number of cells, it is
//   rounded to whole cells and its conductivity is rescaled so the layer keeps its
//   true R-value (k_eff = n*c / R_layer).
//
//   qClear. Every cell also stores the "clear field" material that would be there
//   with no bridge. Every column of the clear field is identical, so qClear is the
//   mean of the exact 1D series flux of each column.

const R_IN = 0.68;   // interior air film, h*ft2*F/Btu
const R_OUT = 0.17;  // exterior air film (winter)

// ---------------------------------------------------------------- materials
// k in Btu*in/(h*ft2*F). R per inch = 1 / k.
export const BRIDGE_MATERIALS = {
  gyp:      { name: 'Gypsum board',                      k: 1.11,    color: '#d8d0bb' }, // R 0.45 per 1/2"
  sheath:   { name: 'Gypsum sheathing',                  k: 1.11,    color: '#b7c596' }, // R 0.56 per 5/8"
  batt:     { name: 'Fiberglass batt R-19 (6")',         k: 6 / 19,  color: '#f2a7c3' }, // k 0.316
  softwood: { name: 'Softwood stud',                     k: 0.8,     color: '#c98f4e' }, // R 1.25 per inch
  steel:    { name: 'Steel',                             k: 312.5,   color: '#2f3744' }, // R 0.0032 per inch
  minwool:  { name: 'Mineral wool board',                k: 0.25,    color: '#9a8a3c' }, // R 4 per inch
  air:      { name: 'Air space (2")',                    k: 2 / 0.97, color: '#cfe8ef' }, // k_eff 2.06, R 0.97
  brick:    { name: 'Brick',                             k: 9.09,    color: '#b4503a' }, // R 0.11 per inch
  concrete: { name: 'Concrete',                          k: 12.5,    color: '#8c9096' }, // R 0.08 per inch
  clad:     { name: 'Cladding (stand-in, R 0.15)',       k: 0.5 / 0.15, color: '#e0c88a' }, // 1/2" at R 0.15
  studzone: { name: 'Steel stud wall (effective R-7.1)', k: 6 / 7.1, color: '#e58fb0' }, // 6" at R 7.1
  // Thermal break: insulating core R-5 per inch (k 0.2) plus about 0.5% of the
  // slab section as stainless reinforcing bars (k about 105) acting in parallel:
  // 0.2 + 0.005 * 105 = 0.725, about R 1.4 per inch.
  break:    { name: 'Thermal break (with steel bars)',   k: 0.725,   color: '#1f9d8b' },
};

export const DETAILS = {
  stud: {
    id: 'stud', name: 'Stud in wall',
    blurb: 'A plan view of one 16 inch stud bay. The stud is a path around the batt insulation.',
    variants: [
      { id: 'wood', name: 'Wood stud' },
      { id: 'steel', name: 'Steel stud' },
      { id: 'steel_ci', name: 'Steel stud + 2" continuous insulation' },
    ],
  },
  slab: {
    id: 'slab', name: 'Slab edge',
    blurb: 'A vertical section where a concrete floor slab meets a brick veneer wall with continuous insulation.',
    variants: [
      { id: 'through', name: 'Slab through the insulation' },
      { id: 'break', name: 'Slab with a thermal break' },
    ],
  },
  shelf: {
    id: 'shelf', name: 'Shelf angle',
    blurb: 'A vertical section where a steel shelf angle that holds up the brick crosses the continuous insulation.',
    variants: [
      { id: 'continuous', name: 'Continuous steel angle' },
      { id: 'standoff', name: 'Angle on standoff brackets' },
    ],
  },
};

// ---------------------------------------------------------------- dew point
// Magnus formula, a = 17.625, b = 243.04 C. Input and output in F.
function dewPoint(tF, rhPct) {
  const a = 17.625, b = 243.04;
  const tC = (tF - 32) * 5 / 9;
  const rh = Math.min(100, Math.max(0.1, rhPct));
  const g = Math.log(rh / 100) + a * tC / (b + tC);
  const td = b * g / (a - g);
  return td * 9 / 5 + 32;
}

// ---------------------------------------------------------------- grid builder
class Grid {
  constructor(nx, ny, cell) {
    this.nx = nx; this.ny = ny; this.cell = cell;
    const n = nx * ny;
    this.mat = new Uint8Array(n);       // actual palette index
    this.k = new Float64Array(n);       // actual cell conductivity (k_eff for thin parts)
    this.kClear = new Float64Array(n);  // clear-field conductivity
    this.palIds = [];                   // palette ids in order of first use
  }
  pal(id) {
    let x = this.palIds.indexOf(id);
    if (x < 0) { x = this.palIds.length; this.palIds.push(id); }
    return x;
  }
  // Paint the real wall and the clear field together (j0..j1 and i0..i1 are half open).
  layer(i0, i1, j0, j1, id, k) {
    const m = this.pal(id);
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      const p = j * this.nx + i;
      this.mat[p] = m; this.k[p] = k; this.kClear[p] = k;
    }
  }
  // Paint a bridge: changes the real wall only, the clear field stays as it was.
  bridge(i0, i1, j0, j1, id, k) {
    const m = this.pal(id);
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      const p = j * this.nx + i;
      this.mat[p] = m; this.k[p] = (k === undefined ? BRIDGE_MATERIALS[id].k : k);
    }
  }
}

// Fill a through-wall stack of layers {id, t (inches), k} for every column. Returns j starts.
function stack(g, layers) {
  const c = g.cell, starts = [];
  let j = 0;
  for (const L of layers) {
    const n = Math.max(1, Math.round(L.t / c));
    const kEff = (n * c) / (L.t / L.k);   // keep the real layer R
    g.layer(0, g.nx, j, j + n, L.id, kEff);
    starts.push([j, j + n]);
    j += n;
  }
  if (j !== g.ny) throw new Error('stack height mismatch');
  return starts;
}
function stackHeight(layers, c) {
  let n = 0; for (const L of layers) n += Math.max(1, Math.round(L.t / c)); return n;
}

const K = id => BRIDGE_MATERIALS[id].k;

// ---------------------------------------------------------------- geometries
// STUD (plan cut). One 16" wide bay centred on the stud, cell 0.125".
//   j layers, interior to exterior: 5/8" gypsum, 6" cavity (R-19 batt), 5/8" gypsum
//   sheathing, [2" mineral wool for steel_ci], 1/2" cladding stand-in (R 0.15).
//   wood : 1.5" wide solid softwood stud across the full 6" cavity.
//   steel: C-shape, 18 ga (0.045") steel. Web is 2 cells wide, each at k_eff
//          = k*0.045/(2*cell), so the web section is exactly 0.045". Flanges are
//          one cell thick at both faces, 1.75" wide (1-5/8" rounded to an even
//          number of cells so the section stays symmetric), k_eff = k*0.045/cell.
function buildStud(variantId, cell) {
  const ci = variantId === 'steel_ci';
  const layers = [
    { id: 'gyp', t: 0.625, k: K('gyp') },
    { id: 'batt', t: 6, k: K('batt') },
    { id: 'sheath', t: 0.625, k: K('sheath') },
  ];
  if (ci) layers.push({ id: 'minwool', t: 2, k: K('minwool') });
  layers.push({ id: 'clad', t: 0.5, k: K('clad') });
  const nx = Math.round(16 / cell), ny = stackHeight(layers, cell);
  const g = new Grid(nx, ny, cell);
  const st = stack(g, layers);
  const [c0, c1] = st[1];                    // cavity rows
  const mid = nx / 2;
  if (variantId === 'wood') {
    const half = Math.round(1.5 / cell / 2);
    g.bridge(mid - half, mid + half, c0, c1, 'softwood');
  } else {
    const t = 0.045, ks = K('steel');
    const web = 1;                           // half-width in cells (web = 2 cells)
    g.bridge(mid - web, mid + web, c0, c1, 'steel', ks * t / (2 * web * cell));
    const fh = Math.round(1.625 / cell / 2); // flange half-width in cells
    g.bridge(mid - fh, mid + fh, c0, c0 + 1, 'steel', ks * t / cell);
    g.bridge(mid - fh, mid + fh, c1 - 1, c1, 'steel', ks * t / cell);
  }
  return { g, orientation: 'plan' };
}

// Common wall for the two section details (slab, shelf), cell 0.25":
//   5/8" gypsum, 6" steel-stud zone as one effective R-7.1 layer, 5/8" sheathing,
//   2" mineral wool, 2" air space (R 0.97), 3-5/8" brick. Total 14.875" (rounded to cells).
function sectionLayers() {
  return [
    { id: 'gyp', t: 0.625, k: K('gyp') },
    { id: 'studzone', t: 6, k: K('studzone') },
    { id: 'sheath', t: 0.625, k: K('sheath') },
    { id: 'minwool', t: 2, k: K('minwool') },
    { id: 'air', t: 2, k: K('air') },
    { id: 'brick', t: 3.625, k: K('brick') },
  ];
}

// SLAB (vertical section, 40" tall, i = 0 at the BOTTOM). An 8" concrete slab sits
//   at 16" to 24" and crosses the wall from behind the interior gypsum to the outside face.
//   through: concrete all the way across (balcony style), cutting studzone, sheathing,
//            insulation, air space and brick.
//   break  : same, but a 2" thick thermal break (k 0.725, see BRIDGE_MATERIALS.break)
//            sits in line with the mineral wool.
function buildSlab(variantId, cell) {
  const layers = sectionLayers();
  const ny = stackHeight(layers, cell), nx = Math.round(40 / cell);
  const g = new Grid(nx, ny, cell);
  const st = stack(g, layers);
  const i0 = Math.round(16 / cell), i1 = Math.round(24 / cell);
  const jStart = st[1][0], jEnd = ny;
  if (variantId === 'through') {
    g.bridge(i0, i1, jStart, jEnd, 'concrete');
  } else {
    g.bridge(i0, i1, jStart, st[3][0], 'concrete');
    g.bridge(i0, i1, st[3][0], st[3][1], 'break');
    g.bridge(i0, i1, st[3][1], jEnd, 'concrete');
  }
  return { g, orientation: 'section' };
}

// SHELF (vertical section, 32" tall, i = 0 at the BOTTOM). The slab edge (8", 12" to 20")
//   stops at the sheathing line, replacing the stud zone. A 3/8" steel angle is bolted to
//   the outside of the sheathing at 12.5": its vertical leg is 4" tall against the
//   sheathing and its horizontal leg runs out across the 2" mineral wool and the air
//   space to the brick, which sits on it. Both legs are one cell with
//   k_eff = k_steel * (0.375 / cell).
//   continuous: the angle runs the whole length of the wall.
//   standoff  : brackets 4" wide every 48" (fraction 1/12). The angle cells become a
//               parallel mix of steel (k_eff) and the insulation they replace, in the
//               ratio 4 : 44, so the insulation is mostly continuous.
function buildShelf(variantId, cell) {
  const layers = sectionLayers();
  const ny = stackHeight(layers, cell), nx = Math.round(32 / cell);
  const g = new Grid(nx, ny, cell);
  const st = stack(g, layers);
  const si0 = Math.round(12 / cell), si1 = Math.round(20 / cell);
  g.bridge(si0, si1, st[1][0], st[1][1], 'concrete');          // slab edge in the stud zone
  const kLeg = K('steel') * 0.375 / cell;
  const f = variantId === 'standoff' ? 4 / 48 : 1;
  const iLeg = si0 + Math.round(0.5 / cell);                    // horizontal leg row
  const jIns0 = st[3][0], jBrick = st[5][0];
  const iVert1 = iLeg + Math.round(4 / cell);
  // mix with whatever material is already there (mineral wool or air)
  const put = (i, j) => {
    const p = j * nx + i;
    g.bridge(i, i + 1, j, j + 1, 'steel', f * kLeg + (1 - f) * g.k[p]);
  };
  for (let j = jIns0; j < jBrick; j++) put(iLeg, j);
  for (let i = iLeg + 1; i < iVert1; i++) put(i, jIns0);
  return { g, orientation: 'section' };
}

const BUILDERS = {
  stud: { fn: buildStud, cell: 0.125 },
  slab: { fn: buildSlab, cell: 0.25 },
  shelf: { fn: buildShelf, cell: 0.25 },
};

// ---------------------------------------------------------------- solver
// Vectors are padded with nx+1 zeros at both ends so the neighbour lookups need no
// branches. gx[q] joins q and q+1, gy[q] joins q and q+nx (zero on the open edges).
function assemble(nx, ny, k, cell, tIn, tOut) {
  const n = nx * ny, PAD = nx + 1, L = n + 2 * PAD;
  const gx = new Float64Array(L), gy = new Float64Array(L), d = new Float64Array(L), b = new Float64Array(L);
  const gin = new Float64Array(nx), gout = new Float64Array(nx);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const p = j * nx + i, q = p + PAD;
    if (i < nx - 1) gx[q] = 2 * k[p] * k[p + 1] / (cell * (k[p] + k[p + 1]));
    if (j < ny - 1) gy[q] = 2 * k[p] * k[p + nx] / (cell * (k[p] + k[p + nx]));
  }
  for (let i = 0; i < nx; i++) {
    gin[i] = 1 / (R_IN + cell / (2 * k[i]));
    gout[i] = 1 / (R_OUT + cell / (2 * k[(ny - 1) * nx + i]));
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const q = j * nx + i + PAD;
    let s = gx[q] + gx[q - 1] + gy[q] + gy[q - nx];
    if (j === 0) { s += gin[i]; b[q] += gin[i] * tIn; }
    if (j === ny - 1) { s += gout[i]; b[q] += gout[i] * tOut; }
    d[q] = s;
  }
  return { nx, ny, n, PAD, L, gx, gy, d, b, gin, gout };
}

// Start from the 1D series solution of every column (exact for the clear field).
function initialGuess(M, tIn, tOut) {
  const { nx, ny, PAD, gy, gin, gout } = M;
  const x = new Float64Array(M.L);
  for (let i = 0; i < nx; i++) {
    let R = 1 / gin[i];
    for (let j = 0; j < ny - 1; j++) R += 1 / gy[j * nx + i + PAD];
    R += 1 / gout[i];
    const qc = (tIn - tOut) / R;
    let t = tIn - qc / gin[i];
    x[PAD + i] = t;
    for (let j = 1; j < ny; j++) { t -= qc / gy[(j - 1) * nx + i + PAD]; x[j * nx + i + PAD] = t; }
  }
  return x;
}

function solvePCG(M, x, tol, maxIter) {
  const { nx, n, PAD, L, gx, gy, d, b } = M;
  const end = PAD + n;
  const Dt = new Float64Array(L).fill(1);
  for (let q = PAD; q < end; q++) {
    const a = gx[q - 1], c = gy[q - nx];
    Dt[q] = d[q] - a * a / Dt[q - 1] - c * c / Dt[q - nx];
  }
  const r = new Float64Array(L), z = new Float64Array(L), w = new Float64Array(L);
  const p = new Float64Array(L), Ap = new Float64Array(L);
  const prec = () => {
    for (let q = PAD; q < end; q++) w[q] = (r[q] + gx[q - 1] * w[q - 1] + gy[q - nx] * w[q - nx]) / Dt[q];
    for (let q = end - 1; q >= PAD; q--) z[q] = w[q] + (gx[q] * z[q + 1] + gy[q] * z[q + nx]) / Dt[q];
  };
  for (let q = PAD; q < end; q++) {
    r[q] = b[q] - (d[q] * x[q] - gx[q - 1] * x[q - 1] - gx[q] * x[q + 1] - gy[q - nx] * x[q - nx] - gy[q] * x[q + nx]);
  }
  prec();
  let rz = 0;
  for (let q = PAD; q < end; q++) { p[q] = z[q]; rz += r[q] * z[q]; }
  let it = 0, small = 0;
  while (it < maxIter) {
    it++;
    let pAp = 0;
    for (let q = PAD; q < end; q++) {
      const v = d[q] * p[q] - gx[q - 1] * p[q - 1] - gx[q] * p[q + 1] - gy[q - nx] * p[q - nx] - gy[q] * p[q + nx];
      Ap[q] = v; pAp += p[q] * v;
    }
    if (!(pAp > 0)) break;
    const alpha = rz / pAp;
    let pmax = 0;
    for (let q = PAD; q < end; q++) {
      x[q] += alpha * p[q]; r[q] -= alpha * Ap[q];
      const a = p[q] < 0 ? -p[q] : p[q]; if (a > pmax) pmax = a;
    }
    const change = Math.abs(alpha) * pmax;
    // two small steps in a row guards against a lucky tiny CG step
    if (change < tol) { small++; if (small >= 2) return { iterations: it, converged: true }; } else small = 0;
    prec();
    let rzNew = 0;
    for (let q = PAD; q < end; q++) rzNew += r[q] * z[q];
    const beta = rzNew / rz; rz = rzNew;
    for (let q = PAD; q < end; q++) p[q] = z[q] + beta * p[q];
  }
  return { iterations: it, converged: false };
}

function solveSOR(M, x, tol, maxIter, omega) {
  const { n, PAD, nx, gx, gy, d, b } = M;
  const end = PAD + n;
  let it = 0;
  while (it < maxIter) {
    it++;
    let change = 0;
    for (let q = PAD; q < end; q++) {
      const t = (b[q] + gx[q - 1] * x[q - 1] + gx[q] * x[q + 1] + gy[q - nx] * x[q - nx] + gy[q] * x[q + nx]) / d[q];
      const dx = omega * (t - x[q]);
      x[q] += dx;
      const a = dx < 0 ? -dx : dx; if (a > change) change = a;
    }
    if (change < tol) return { iterations: it, converged: true };
  }
  return { iterations: it, converged: false };
}

// Solve a filled grid. Returns everything needed for the result object.
function runGrid(g, climate, opts) {
  const tIn = climate.tIn, tOut = climate.tOut;
  const { nx, ny, cell } = g;
  const M = assemble(nx, ny, g.k, cell, tIn, tOut);
  const x = initialGuess(M, tIn, tOut);
  const tol = opts.tol === undefined ? 2e-5 : opts.tol;
  const maxIter = opts.maxIter || 3000;
  const sol = opts.method === 'sor'
    ? solveSOR(M, x, tol, opts.maxIter || 200000, opts.omega || 1.9)
    : solvePCG(M, x, tol, maxIter);
  const n = nx * ny, PAD = M.PAD;
  const temps = new Float32Array(n);
  for (let p = 0; p < n; p++) temps[p] = x[p + PAD];
  const interiorSurface = new Float32Array(nx);
  let qSum = 0, qExtSum = 0, minT = Infinity, minAt = 0, sumT = 0;
  for (let i = 0; i < nx; i++) {
    const f = M.gin[i] * (tIn - x[PAD + i]);
    qSum += f;
    const ts = tIn - R_IN * f;           // surface temperature on the air side of the film
    interiorSurface[i] = ts; sumT += ts;
    if (ts < minT) { minT = ts; minAt = i; }
    qExtSum += M.gout[i] * (x[PAD + (ny - 1) * nx + i] - tOut);
  }
  return {
    temps, interiorSurface, q: qSum / nx, qExterior: qExtSum / nx,
    minInteriorT: minT, minInteriorAt: minAt, avgInteriorT: sumT / nx,
    iterations: sol.iterations, converged: sol.converged,
  };
}

// Exact 1D series flux of the clear field (every column identical).
function clearFlux(g, climate) {
  const { nx, ny, cell, kClear } = g;
  let sum = 0;
  for (let i = 0; i < nx; i++) {
    let R = R_IN + R_OUT;
    for (let j = 0; j < ny; j++) R += cell / kClear[j * nx + i];
    sum += (climate.tIn - climate.tOut) / R;
  }
  return sum / nx;
}

// ---------------------------------------------------------------- public API
export function solveBridge(detailId, variantId, climate, opts = {}) {
  const det = DETAILS[detailId];
  if (!det) throw new Error('Unknown detail: ' + detailId);
  if (!det.variants.some(v => v.id === variantId)) throw new Error('Unknown variant: ' + variantId);
  const B = BUILDERS[detailId];
  const { g, orientation } = B.fn(variantId, opts.cell || B.cell);
  const s = runGrid(g, climate, opts);
  const dT = climate.tIn - climate.tOut;
  const qClear = clearFlux(g, climate);
  const rhIn = climate.rhIn === undefined ? 35 : climate.rhIn;
  const dp = dewPoint(climate.tIn, rhIn);
  return {
    detailId, variantId,
    nx: g.nx, ny: g.ny, cell: g.cell,
    widthIn: g.nx * g.cell, depthIn: g.ny * g.cell,
    orientation,
    temps: s.temps,
    mats: g.mat,
    palette: g.palIds.map(id => ({ id, name: BRIDGE_MATERIALS[id].name, color: BRIDGE_MATERIALS[id].color, k: BRIDGE_MATERIALS[id].k })),
    interiorSurface: s.interiorSurface,
    minInteriorT: s.minInteriorT, minInteriorAt: s.minInteriorAt, avgInteriorT: s.avgInteriorT,
    q: s.q, qClear,
    rEffective: dT / s.q, rClear: dT / qClear,
    increasePct: (s.q - qClear) / qClear * 100,
    dewPointF: dp, condensationRisk: s.minInteriorT < dp,
    iterations: s.iterations, converged: s.converged,
    qExterior: s.qExterior,   // extra: flux out of the exterior surface, equals q when converged
  };
}

// Uniform layered wall through the same solver. layers = [{k, thickness}] interior to exterior.
export function solveClearWall(layers, climate, opts = {}) {
  const cell = opts.cell || 0.25, nx = opts.nx || 6;
  const counts = layers.map(L => Math.max(1, Math.round(L.thickness / cell)));
  const ny = counts.reduce((a, b) => a + b, 0);
  const g = new Grid(nx, ny, cell);
  let j = 0, rLayers = 0;
  layers.forEach((L, idx) => {
    const R = L.thickness / L.k;
    rLayers += R;
    const kEff = counts[idx] * cell / R;     // keep the layer R
    g.layer(0, nx, j, j + counts[idx], 'gyp', kEff);
    j += counts[idx];
  });
  const s = runGrid(g, climate, opts);
  const dT = climate.tIn - climate.tOut;
  const rTotal = rLayers + R_IN + R_OUT;
  return {
    q: s.q, qExterior: s.qExterior, rEffective: dT / s.q,
    rExpected: rTotal, qExpected: dT / rTotal,
    temps: s.temps, nx, ny, cell,
    iterations: s.iterations, converged: s.converged,
  };
}

// ---------------------------------------------------------------- plain English
const SUBJECT = {
  'stud:wood': 'The wood stud',
  'stud:steel': 'The steel stud',
  'stud:steel_ci': 'The steel stud behind continuous insulation',
  'slab:through': 'The slab that runs through the insulation',
  'slab:break': 'The slab with a thermal break',
  'shelf:continuous': 'The continuous steel angle',
  'shelf:standoff': 'The angle on standoff brackets',
};
const NOUN = { stud: 'stud', slab: 'slab', shelf: 'shelf angle' };
const LESSON = {
  'stud:wood': 'Wood conducts about three times more heat than the batt around it, so each stud is a small shortcut.',
  'stud:steel': 'Steel carries heat about 390 times better than wood, so even a thin web and flange act like a heat fin across the insulation.',
  'stud:steel_ci': 'The continuous layer outside the studs covers the steel, so heat has to cross it before it can use the stud shortcut.',
  'slab:through': 'Concrete carries heat about 50 times better than mineral wool, so a slab through the insulation is a large shortcut.',
  'slab:break': 'The thermal break cuts the concrete path with a layer of insulation, but the steel bars inside it still let some heat through.',
  'shelf:continuous': 'A steel angle crossing the insulation along its whole length gives heat a fast path to the brick.',
  'shelf:standoff': 'Short brackets leave the insulation almost continuous, so only a small part of the length gives heat a fast path.',
};

export function describeResult(r) {
  const key = r.detailId + ':' + r.variantId;
  const noun = NOUN[r.detailId] || 'bridge';
  const subject = SUBJECT[key] || 'The bridge';
  const out = [];
  const pct = r.increasePct;
  if (Math.abs(pct) < 0.5) {
    out.push(subject + ' barely changes heat loss against the same wall with no ' + noun + '.');
  } else if (pct > 0) {
    out.push(subject + ' raises heat loss by ' + Math.round(pct) + '% against the same wall with no ' + noun + '.');
  } else {
    out.push(subject + ' lowers heat loss by ' + Math.round(-pct) + '% against the same wall with no ' + noun + '.');
  }
  out.push('The whole wall performs like R-' + r.rEffective.toFixed(1) + ', while the same wall with no ' + noun +
    ' would be R-' + r.rClear.toFixed(1) + '.');
  const cold = r.minInteriorT.toFixed(1), dp = r.dewPointF.toFixed(1);
  out.push(r.condensationRisk
    ? 'The coldest spot on the inside surface is ' + cold + ' F, which is below the room dew point of ' + dp + ' F, so water can condense there.'
    : 'The coldest spot on the inside surface is ' + cold + ' F, which is above the room dew point of ' + dp + ' F, so condensation on that surface is unlikely.');
  if (LESSON[key]) out.push(LESSON[key]);
  return out;
}
