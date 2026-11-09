// envelope/bridge-scene.js  3D cut model for the Thermal Bridge mode (Part E).
// Builds a block from a solveBridge() result: a flat cut face that carries the
// temperature or material map, plus a body extruded behind it.
//
// Scene axes (1 unit = 1 inch): x along the wall, y up, z through the wall.
// Interior face at z = 0, exterior at +z.
//   'plan' details (stud):    grid plane is horizontal. x = i * cell, z = j * cell.
//                             The cut face is the TOP of the block (y = top).
//   'section' details:        grid plane is vertical. y = i * cell (i = 0 at the bottom),
//                             z = j * cell. The cut face is the END of the block at -x,
//                             so a camera on the exterior side looks at it with the
//                             interior on the left and the exterior on the right.
//
// Texture rule: canvas pixel (i, j) is cell (i, j). flipY is false, so uv = (i / nx, j / ny).

import { THREE, makeLabelSprite, tempToCss } from '../shared/scene.js';

const PLAN_HEIGHT = 20;     // inches the stud block is extruded downward
const SECTION_LENGTH = 24;  // inches the section blocks are extruded along x
const EPS_FACE = 0.04;      // cut plane sits this far in front of the body
const EPS_LINE = 0.09;      // outline lines sit this far in front of the body

// ---------------------------------------------------------------- helpers
function disposeObject(o) {
  o.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    const ms = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : [];
    ms.forEach((m) => {
      if (m.map) m.map.dispose();
      m.dispose();
    });
  });
}

// Greedy rectangle merge of equal-material cells. Returns [{m, i0, i1, j0, j1}] (half open).
function mergeRects(mats, nx, ny) {
  const seen = new Uint8Array(nx * ny);
  const out = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = j * nx + i;
      if (seen[p]) continue;
      const m = mats[p];
      let i1 = i + 1;
      while (i1 < nx && !seen[j * nx + i1] && mats[j * nx + i1] === m) i1++;
      let j1 = j + 1;
      for (; j1 < ny; j1++) {
        let ok = true;
        for (let ii = i; ii < i1; ii++) {
          const q = j1 * nx + ii;
          if (seen[q] || mats[q] !== m) { ok = false; break; }
        }
        if (!ok) break;
      }
      for (let jj = j; jj < j1; jj++) for (let ii = i; ii < i1; ii++) seen[jj * nx + ii] = 1;
      out.push({ m, i0: i, i1, j0: j, j1 });
    }
  }
  return out;
}

// One merged geometry from a list of boxes {cx,cy,cz,sx,sy,sz}.
function boxesGeometry(boxes) {
  const tpl = new THREE.BoxGeometry(1, 1, 1);
  const tp = tpl.attributes.position.array;
  const tn = tpl.attributes.normal.array;
  const ti = tpl.index.array;
  const vcount = tp.length / 3;
  const pos = new Float32Array(boxes.length * tp.length);
  const nor = new Float32Array(boxes.length * tn.length);
  const idx = new Uint32Array(boxes.length * ti.length);
  boxes.forEach((b, n) => {
    for (let v = 0; v < vcount; v++) {
      const o = n * tp.length + v * 3;
      pos[o] = tp[v * 3] * b.sx + b.cx;
      pos[o + 1] = tp[v * 3 + 1] * b.sy + b.cy;
      pos[o + 2] = tp[v * 3 + 2] * b.sz + b.cz;
      nor[o] = tn[v * 3]; nor[o + 1] = tn[v * 3 + 1]; nor[o + 2] = tn[v * 3 + 2];
    }
    for (let k = 0; k < ti.length; k++) idx[n * ti.length + k] = ti[k] + n * vcount;
  });
  tpl.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// Boundary segments between different materials (and the outer rim), merged into
// straight runs. Each is [a0, b0, a1, b1] in cell-edge coordinates (a = i axis, b = j axis).
function boundarySegments(mats, nx, ny) {
  const segs = [];
  // vertical edges at a = i (between cell i-1 and i), running along b
  for (let i = 0; i <= nx; i++) {
    let start = -1;
    for (let j = 0; j <= ny; j++) {
      let edge = false;
      if (j < ny) {
        const l = i > 0 ? mats[j * nx + i - 1] : -1;
        const r = i < nx ? mats[j * nx + i] : -1;
        edge = l !== r;
      }
      if (edge && start < 0) start = j;
      if (!edge && start >= 0) { segs.push([i, start, i, j]); start = -1; }
    }
  }
  // horizontal edges at b = j, running along a
  for (let j = 0; j <= ny; j++) {
    let start = -1;
    for (let i = 0; i <= nx; i++) {
      let edge = false;
      if (i < nx) {
        const u = j > 0 ? mats[(j - 1) * nx + i] : -1;
        const d = j < ny ? mats[j * nx + i] : -1;
        edge = u !== d;
      }
      if (edge && start < 0) start = i;
      if (!edge && start >= 0) { segs.push([start, j, i, j]); start = -1; }
    }
  }
  return segs;
}

function hexMix(hex, toward, k) {
  const a = new THREE.Color(hex);
  return a.lerp(new THREE.Color(toward), k);
}

// ---------------------------------------------------------------- scene
/**
 * @param {object} stage from createStage()
 * @returns {object} controller
 */
export function createBridgeScene(stage) {
  const root = new THREE.Group();
  stage.scene.add(root);
  const geo = new THREE.Group();     // rebuilt on detail or variant change
  const dyn = new THREE.Group();     // labels and marker, rebuilt when climate changes
  root.add(geo, dyn);

  const st = {
    result: null,
    climate: null,
    view: 'temp',
    arrows: false,
    cutMat: null,
    tempTex: null,
    matTex: null,
    bodyMeshes: [],
    arrowGroup: null,
    L: null,        // layout info
    labels: [],
  };

  // ---- mapping from grid coordinates to world
  function layout(r) {
    const c = r.cell;
    const W = r.nx * c;
    const D = r.ny * c;
    if (r.orientation === 'plan') {
      const H = PLAN_HEIGHT;
      return {
        plan: true, c, W, D, H,
        // point on the cut plane for cell-edge coords (a, b), pushed out by `off`
        P: (a, b, off = 0) => new THREE.Vector3((a - r.nx / 2) * c, H + off, b * c),
        // same point on the far end of the extrusion
        Pfar: (a, b) => new THREE.Vector3((a - r.nx / 2) * c, 0, b * c),
        out: new THREE.Vector3(0, 1, 0),
        center: new THREE.Vector3(0, H / 2, D / 2),
        dirVec: (qi, qj) => new THREE.Vector3(qi, 0, qj),
        cellCenter: (i, j, off = 0) => new THREE.Vector3((i + 0.5 - r.nx / 2) * c, H + off, (j + 0.5) * c),
      };
    }
    const Lx = SECTION_LENGTH;
    return {
      plan: false, c, W, D, H: W, Lx,
      P: (a, b, off = 0) => new THREE.Vector3(-Lx / 2 - off, a * c, b * c),
      Pfar: (a, b) => new THREE.Vector3(Lx / 2, a * c, b * c),
      out: new THREE.Vector3(-1, 0, 0),
      center: new THREE.Vector3(0, W / 2, D / 2),
      dirVec: (qi, qj) => new THREE.Vector3(0, qi, qj),
      cellCenter: (i, j, off = 0) => new THREE.Vector3(-Lx / 2 - off, (i + 0.5) * c, (j + 0.5) * c),
    };
  }

  // ---- textures
  function makeCanvasTexture(canvas, linear) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false;
    t.generateMinmaps = false;
    t.generateMipmaps = false;
    t.minFilter = linear ? THREE.LinearFilter : THREE.NearestFilter;
    t.magFilter = linear ? THREE.LinearFilter : THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }

  function paintTemps(r, climate) {
    const { nx, ny } = r;
    const cv = st.tempTex.image;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(nx, ny);
    const lo = Math.min(climate.tIn, climate.tOut);
    const hi = Math.max(climate.tIn, climate.tOut);
    // cache css->rgb for speed: quantize to 0.25 F
    const cache = new Map();
    for (let p = 0; p < nx * ny; p++) {
      const key = Math.round(r.temps[p] * 4);
      let rgb = cache.get(key);
      if (!rgb) {
        const m = /(\d+), (\d+), (\d+)/.exec(tempToCss(key / 4, lo, hi));
        rgb = [+m[1], +m[2], +m[3]];
        cache.set(key, rgb);
      }
      img.data[p * 4] = rgb[0]; img.data[p * 4 + 1] = rgb[1]; img.data[p * 4 + 2] = rgb[2]; img.data[p * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    st.tempTex.needsUpdate = true;
  }

  function paintMats(r) {
    const { nx, ny } = r;
    const cv = st.matTex.image;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(nx, ny);
    const rgbS = r.palette.map((p) => {
      const n = parseInt(p.color.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    });
    for (let p = 0; p < nx * ny; p++) {
      const c = rgbS[r.mats[p]];
      img.data[p * 4] = c[0]; img.data[p * 4 + 1] = c[1]; img.data[p * 4 + 2] = c[2]; img.data[p * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    st.matTex.needsUpdate = true;
  }

  // ---- body and cut face (rebuilt when detail or variant changes)
  function bodyColor(hex) {
    if (st.view === 'mats') return new THREE.Color(hex);
    return hexMix(hex, stage.theme.dark ? '#3a372f' : '#d9d2bf', 0.62);
  }

  function restyleBody() {
    st.bodyMeshes.forEach((m) => { m.material.color.copy(bodyColor(m.userData.hex)); });
  }

  function buildGeometry(r) {
    // dispose the old
    for (const ch of Array.from(geo.children)) { geo.remove(ch); disposeObject(ch); }
    st.bodyMeshes = [];
    st.arrowGroup = null;
    if (st.tempTex) { st.tempTex.dispose(); st.tempTex = null; }
    if (st.matTex) { st.matTex.dispose(); st.matTex = null; }

    const L = layout(r);
    st.L = L;
    const { nx, ny, mats } = r;

    // body: one merged mesh per material
    const rects = mergeRects(mats, nx, ny);
    const byMat = new Map();
    rects.forEach((q) => { if (!byMat.has(q.m)) byMat.set(q.m, []); byMat.get(q.m).push(q); });
    const c = L.c;
    byMat.forEach((list, m) => {
      const boxes = list.map((q) => {
        const wa = (q.i1 - q.i0) * c;
        const wb = (q.j1 - q.j0) * c;
        const ca = (q.i0 + q.i1) / 2;
        const cb = ((q.j0 + q.j1) / 2) * c;
        if (L.plan) {
          return { cx: (ca - nx / 2) * c, cy: L.H / 2, cz: cb, sx: wa, sy: L.H, sz: wb };
        }
        return { cx: 0, cy: ca * c, cz: cb, sx: L.Lx, sy: wa, sz: wb };
      });
      const hex = r.palette[m].color;
      const mat = new THREE.MeshStandardMaterial({ color: bodyColor(hex), roughness: 0.7, metalness: 0.05 });
      const mesh = new THREE.Mesh(boxesGeometry(boxes), mat);
      mesh.userData.hex = hex;
      st.bodyMeshes.push(mesh);
      geo.add(mesh);
    });

    // outlines at material boundaries: cut face, far face and the extrusion corners
    const segs = boundarySegments(mats, nx, ny);
    const pts = [];
    const ends = new Map();
    const push = (v) => pts.push(v.x, v.y, v.z);
    segs.forEach(([a0, b0, a1, b1]) => {
      push(L.P(a0, b0, EPS_LINE)); push(L.P(a1, b1, EPS_LINE));
      push(L.Pfar(a0, b0)); push(L.Pfar(a1, b1));
      ends.set(`${a0},${b0}`, [a0, b0]);
      ends.set(`${a1},${b1}`, [a1, b1]);
    });
    ends.forEach(([a, b]) => { push(L.P(a, b, EPS_LINE)); push(L.Pfar(a, b)); });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x14120e, transparent: true, opacity: 0.78 }));
    geo.add(lines);

    // cut face
    st.tempTex = makeCanvasTexture(Object.assign(document.createElement('canvas'), { width: nx, height: ny }), true);
    st.matTex = makeCanvasTexture(Object.assign(document.createElement('canvas'), { width: nx, height: ny }), false);
    paintMats(r);
    const quad = new THREE.BufferGeometry();
    const p00 = L.P(0, 0, EPS_FACE), p10 = L.P(nx, 0, EPS_FACE), p01 = L.P(0, ny, EPS_FACE), p11 = L.P(nx, ny, EPS_FACE);
    quad.setAttribute('position', new THREE.Float32BufferAttribute([...p00.toArray(), ...p10.toArray(), ...p01.toArray(), ...p11.toArray()], 3));
    quad.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
    quad.setIndex([0, 1, 2, 1, 3, 2]);
    st.cutMat = new THREE.MeshBasicMaterial({ map: st.view === 'temp' ? st.tempTex : st.matTex, side: THREE.DoubleSide, toneMapped: false });
    const cut = new THREE.Mesh(quad, st.cutMat);
    cut.renderOrder = 1;
    geo.add(cut);
  }

  // ---- arrows
  function fluxField(r) {
    const { nx, ny, cell: c, temps, mats, palette } = r;
    const k = (p) => palette[mats[p]].k;
    // face flux between neighbours, exact for harmonic conductance
    const qi = new Float32Array(nx * ny);
    const qj = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const p = j * nx + i;
        let a = 0, na = 0, b = 0, nb = 0;
        if (i > 0) { const q = p - 1; a += (temps[q] - temps[p]) / (c / 2 / k(q) + c / 2 / k(p)); na++; }
        if (i < nx - 1) { const q = p + 1; a += (temps[p] - temps[q]) / (c / 2 / k(q) + c / 2 / k(p)); na++; }
        if (j > 0) { const q = p - nx; b += (temps[q] - temps[p]) / (c / 2 / k(q) + c / 2 / k(p)); nb++; }
        if (j < ny - 1) { const q = p + nx; b += (temps[p] - temps[q]) / (c / 2 / k(q) + c / 2 / k(p)); nb++; }
        qi[p] = na ? a / na : 0;   // heat flowing toward +i
        qj[p] = nb ? b / nb : 0;   // heat flowing toward +j (interior to exterior when warm inside)
      }
    }
    return { qi, qj };
  }

  function pickSamples(r, mag, qRef) {
    const { nx, ny } = r;
    const s = Math.max(4, Math.sqrt((nx * ny) / 48));
    const out = [];
    const nbx = Math.max(1, Math.floor(nx / s));
    const nby = Math.max(1, Math.floor(ny / s));
    for (let bj = 0; bj < nby; bj++) {
      for (let bi = 0; bi < nbx; bi++) {
        const i = Math.min(nx - 1, Math.floor((bi + 0.5) * (nx / nbx)));
        const j = Math.min(ny - 1, Math.floor((bj + 0.5) * (ny / nby)));
        out.push([i, j]);
      }
    }
    // extras on cells that carry far more heat than the clear wall
    const space = s * 0.55;
    const extra = [];
    for (let j = 0; j < ny && extra.length < 28; j++) {
      for (let i = 0; i < nx && extra.length < 28; i++) {
        if (mag[j * nx + i] < qRef * 6) continue;
        if (extra.some(([ei, ej]) => Math.abs(ei - i) < space && Math.abs(ej - j) < space)) continue;
        extra.push([i, j]);
      }
    }
    // drop regular samples that sit on top of an extra
    const keep = out.filter(([i, j]) => !extra.some(([ei, ej]) => Math.abs(ei - i) < space * 0.8 && Math.abs(ej - j) < space * 0.8));
    return { samples: keep.concat(extra), spacing: s };
  }

  const shaftGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
  shaftGeo.translate(0, 0.5, 0);           // base at origin, along +y
  const headGeo = new THREE.ConeGeometry(1, 1, 10);
  headGeo.translate(0, 0.5, 0);

  function buildArrows(r) {
    if (st.arrowGroup) { geo.remove(st.arrowGroup); disposeObject(st.arrowGroup); st.arrowGroup = null; }
    if (!st.arrows) return;
    const L = st.L;
    const { nx, ny } = r;
    const { qi, qj } = fluxField(r);
    const mag = new Float32Array(nx * ny);
    for (let p = 0; p < nx * ny; p++) mag[p] = Math.hypot(qi[p], qj[p]);
    const qRef = Math.max(1e-6, Math.abs(r.qClear));
    const { samples, spacing } = pickSamples(r, mag, qRef);
    const unit = spacing * L.c;   // world size of one sample block
    const n = samples.length;
    const mk = (g, color, order) => {
      const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color, toneMapped: false, depthWrite: order > 2 }), n);
      m.renderOrder = order;
      m.frustumCulled = false;
      return m;
    };
    const halo = { shaft: mk(shaftGeo.clone(), 0xf6f2e8, 2), head: mk(headGeo.clone(), 0xf6f2e8, 2) };
    const ink = { shaft: mk(shaftGeo.clone(), 0x14120e, 3), head: mk(headGeo.clone(), 0x14120e, 3) };
    const grp = new THREE.Group();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const q4 = new THREE.Quaternion();
    const m4 = new THREE.Matrix4();
    const one = new THREE.Vector3(1, 1, 1);
    const minT = 0.2 * unit, maxT = 0.95 * unit;
    let used = 0;
    samples.forEach(([i, j]) => {
      const p = j * nx + i;
      const mg = mag[p];
      if (mg < 1e-9) return;
      const dir = L.dirVec(qi[p], qj[p]).normalize();
      // log scale: qClear / 10 gives the shortest arrow, 16 x qClear the longest
      const u = Math.min(1, Math.max(0, (Math.log10(mg / qRef) + 1) / 2.2));
      const len = minT + (maxT - minT) * u;
      const headLen = Math.min(len * 0.5, unit * 0.34);
      const shaftLen = len - headLen;
      const w = Math.max(0.06, unit * 0.05) * (0.8 + 0.7 * u);   // shaft radius
      // center the arrow on the cell center
      const c0 = L.cellCenter(i, j, 0.25 + (L.plan ? 0 : 0)).addScaledVector(dir, -len / 2);
      q4.setFromUnitVectors(yAxis, dir);
      [[halo, 1.9], [ink, 1]].forEach(([set, grow]) => {
        const sShaft = new THREE.Vector3(w * grow, shaftLen + (grow > 1 ? w * 0.6 : 0), w * grow);
        m4.compose(c0.clone().addScaledVector(dir, grow > 1 ? -w * 0.3 : 0), q4, sShaft);
        set.shaft.setMatrixAt(used, m4);
        const hp = c0.clone().addScaledVector(dir, shaftLen);
        const sHead = new THREE.Vector3(w * 3.2 * grow, headLen + (grow > 1 ? w * 1.0 : 0), w * 3.2 * grow);
        m4.compose(grow > 1 ? hp.addScaledVector(dir, -w * 0.3) : hp, q4, sHead);
        set.head.setMatrixAt(used, m4);
      });
      used++;
    });
    [halo.shaft, halo.head, ink.shaft, ink.head].forEach((m) => { m.count = used; m.instanceMatrix.needsUpdate = true; grp.add(m); });
    void one;
    st.arrowGroup = grp;
    geo.add(grp);
  }

  // ---- labels and marker (cheap; rebuilt on every climate change)
  function buildLabels(r, climate) {
    for (const ch of Array.from(dyn.children)) { dyn.remove(ch); disposeObject(ch); }
    const L = st.L;
    const size = Math.max(L.W, L.D + 10);
    const hl = L.plan ? 2.1 : Math.max(3.2, size * 0.075);     // label height
    const f = (t) => `${Math.round(t)} °F`;
    const mkLabel = (text, o = {}) => makeLabelSprite(text, { height: hl, ...o });

    const inLab = mkLabel(`INTERIOR ${f(climate.tIn)}`);
    const outLab = mkLabel(`EXTERIOR ${f(climate.tOut)}`);
    const halfIn = inLab.scale.x / 2, halfOut = outLab.scale.x / 2;
    if (L.plan) {
      const coneH0 = L.plan ? 1.6 : Math.max(2.2, size * 0.07);
      inLab.position.set(-L.W / 2 + halfIn, L.H, -(coneH0 + hl * 1.9));
      outLab.position.set(-L.W / 2 + halfOut, L.H, L.D + hl * 0.9);
    } else {
      const y = L.W * 0.86;
      inLab.position.set(-L.Lx / 2, y, -halfIn - 2);
      outLab.position.set(-L.Lx / 2, y, L.D + halfOut + 2);
    }
    dyn.add(inLab, outLab);
    st.labels = [inLab, outLab];

    // coldest spot marker: a cone pointing at the interior surface
    const i = r.minInteriorAt;
    const tip = L.P(i + 0.5, 0, 0.1);
    const coneH = L.plan ? 1.6 : Math.max(2.2, size * 0.07);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(coneH * 0.38, coneH, 16), new THREE.MeshBasicMaterial({ color: climate.tIn >= climate.tOut ? (r.condensationRisk ? 0xc8261a : 0x1d4fd0) : 0xd93a14, toneMapped: false }));
    cone.geometry.translate(0, -coneH / 2, 0);        // tip at origin, pointing +y
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)); // point toward +z
    cone.position.copy(tip).add(new THREE.Vector3(0, 0, -0.0));
    cone.renderOrder = 8;
    cone.material.depthTest = false;
    dyn.add(cone);
    const cold = mkLabel(`COLDEST ${r.minInteriorT.toFixed(1)} °F`, { bg: '#c8261a', color: '#ffffff', border: '#14120e' });
    const tagPos = tip.clone();
    if (L.plan) {
      const halfC = cold.scale.x / 2;
      tagPos.z = -coneH * 0.55;
      tagPos.x += tip.x > 0 ? -(halfC + coneH * 0.5) : (halfC + coneH * 0.5);
    } else {
      tagPos.z -= coneH + cold.scale.x / 2 - hl * 0.2;
    }
    cold.position.copy(tagPos);
    dyn.add(cold);
  }

  // ---------------------------------------------------------------- public
  const ctrl = {
    /** Full rebuild (detail or variant changed). */
    build(r, climate) {
      st.result = r; st.climate = climate;
      buildGeometry(r);
      paintTemps(r, climate);
      buildArrows(r);
      buildLabels(r, climate);
      ctrl.setView(st.view);
    },
    /** Climate changed, same geometry. */
    update(r, climate) {
      st.result = r; st.climate = climate;
      paintTemps(r, climate);
      buildArrows(r);
      buildLabels(r, climate);
      stage.requestRender();
    },
    setView(v) {
      st.view = v;
      if (st.cutMat) { st.cutMat.map = v === 'temp' ? st.tempTex : st.matTex; st.cutMat.needsUpdate = true; }
      restyleBody();
      stage.requestRender();
    },
    setArrows(on) {
      st.arrows = !!on;
      if (st.result) buildArrows(st.result);
      stage.requestRender();
    },
    /** Camera frame for the current geometry. */
    frame() {
      const L = st.L;
      if (!L) return;
      const box = new THREE.Box3();
      if (L.plan) {
        box.min.set(-L.W / 2 - 1, L.H - 9, -9);
        box.max.set(L.W / 2 + 9, L.H, L.D + 5);
      } else {
        box.min.set(-L.Lx / 2, 0, -14);
        box.max.set(-L.Lx / 2 + 2, L.W, L.D + 14);
      }
      const dir = L.plan ? [0.08, 1.0, 0.75] : [-1.5, 0.3, 0.55];
      stage.frame(box, { dir, padding: 1.0 });
    },
    onTheme() {
      if (st.result) { restyleBody(); buildLabels(st.result, st.climate); stage.requestRender(); }
    },
    dispose() {
      stage.scene.remove(root);
      disposeObject(root);
      if (st.tempTex) st.tempTex.dispose();
      if (st.matTex) st.matTex.dispose();
      shaftGeo.dispose();
      headGeo.dispose();
    },
  };
  return ctrl;
}
