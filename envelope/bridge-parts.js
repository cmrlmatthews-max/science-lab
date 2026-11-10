// envelope/bridge-parts.js  Small mesh builder for the Thermal Bridge mock-ups (Envelope Lab).
// Builds real-looking parts out of boxes. 1 unit = 1 inch. Faces are merged per "look id" so a whole
// detail is only a dozen draw calls. UV is planar and in INCHES (the getLook textures repeat 1 / tile).
//
// Face index: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z.

import * as THREE from 'three';
import { getLook } from './material-look.js';

const FACES = [
  { n: [1, 0, 0], a: [0, 1, 0], b: [0, 0, 1] },
  { n: [-1, 0, 0], a: [0, 0, 1], b: [0, 1, 0] },
  { n: [0, 1, 0], a: [0, 0, 1], b: [1, 0, 0] },
  { n: [0, -1, 0], a: [1, 0, 0], b: [0, 0, 1] },
  { n: [0, 0, 1], a: [1, 0, 0], b: [0, 1, 0] },
  { n: [0, 0, -1], a: [0, 1, 0], b: [1, 0, 0] },
];

export class Mesher {
  constructor() { this.by = new Map(); }

  bucket(id) {
    let b = this.by.get(id);
    if (!b) { b = { pos: [], nor: [], uv: [], idx: [] }; this.by.set(id, b); }
    return b;
  }

  /**
   * Add a box.
   * @param {string} lookId look id for all faces
   * @param {number[]} lo [x0, y0, z0]
   * @param {number[]} hi [x1, y1, z1]
   * @param {{cut?:{face:number, look:string}, skip?:number[]}} [o] cut: another look for one face; skip: faces left out
   */
  box(lookId, lo, hi, o = {}) {
    const c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    const s = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
    if (s[0] <= 1e-6 || s[1] <= 1e-6 || s[2] <= 1e-6) return;
    for (let f = 0; f < 6; f += 1) {
      if (o.skip && o.skip.includes(f)) continue;
      const F = FACES[f];
      const id = o.cut && o.cut.face === f ? o.cut.look : lookId;
      const b = this.bucket(id);
      const ext = (v) => Math.abs(v[0]) * s[0] + Math.abs(v[1]) * s[1] + Math.abs(v[2]) * s[2];
      const ea = ext(F.a) / 2; const eb = ext(F.b) / 2;
      const fc = [c[0] + F.n[0] * s[0] / 2, c[1] + F.n[1] * s[1] / 2, c[2] + F.n[2] * s[2] / 2];
      const base = b.pos.length / 3;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([ka, kb]) => {
        const p = [
          fc[0] + F.a[0] * ea * ka + F.b[0] * eb * kb,
          fc[1] + F.a[1] * ea * ka + F.b[1] * eb * kb,
          fc[2] + F.a[2] * ea * ka + F.b[2] * eb * kb,
        ];
        b.pos.push(p[0], p[1], p[2]);
        b.nor.push(F.n[0], F.n[1], F.n[2]);
        if (f < 2) b.uv.push(p[2], p[1]);
        else if (f < 4) b.uv.push(p[0], p[2]);
        else b.uv.push(p[0], p[1]);
      });
      b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  /** Cylinder along an axis ('x' | 'y' | 'z'), flat shaded enough for a small bar. */
  cyl(lookId, axis, center, len, radius, seg = 10) {
    const b = this.bucket(lookId);
    const geo = new THREE.CylinderGeometry(radius, radius, len, seg, 1, false);
    if (axis === 'x') geo.rotateZ(Math.PI / 2);
    else if (axis === 'z') geo.rotateX(Math.PI / 2);
    geo.translate(center[0], center[1], center[2]);
    const p = geo.attributes.position.array; const n = geo.attributes.normal.array; const u = geo.attributes.uv.array;
    const base = b.pos.length / 3;
    for (let i = 0; i < p.length; i += 3) { b.pos.push(p[i], p[i + 1], p[i + 2]); b.nor.push(n[i], n[i + 1], n[i + 2]); }
    for (let i = 0; i < u.length; i += 2) b.uv.push(u[i] * 6, u[i + 1] * 6);
    const ix = geo.index.array;
    for (let i = 0; i < ix.length; i += 1) b.idx.push(ix[i] + base);
    geo.dispose();
  }

  /** @returns {Array<{id:string, geometry:THREE.BufferGeometry}>} */
  geometries() {
    const out = [];
    this.by.forEach((b, id) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setIndex(b.idx);
      out.push({ id, geometry: g });
    });
    return out;
  }
}

/** Plain material for things without a photo-like look (the thermal break core). */
function plainMaterial(id) {
  if (id === '__break') {
    return new THREE.MeshStandardMaterial({ color: '#22a592', roughness: 0.62, metalness: 0.05 });
  }
  if (id === '__stainless') {
    return new THREE.MeshStandardMaterial({ color: '#c9ced4', roughness: 0.3, metalness: 0.95 });
  }
  return new THREE.MeshStandardMaterial({ color: '#cccccc' });
}

/** Cache of looks (one per look id) for one scene. */
export function createLookBank(onUpdate) {
  const looks = new Map();
  return {
    material(id) {
      let l = looks.get(id);
      if (!l) {
        if (id.startsWith('__')) {
          const material = plainMaterial(id);
          l = { material, dispose: () => material.dispose() };
        } else {
          l = getLook(id, { uvInches: true, onUpdate });
        }
        looks.set(id, l);
      }
      return l.material;
    },
    dispose() { looks.forEach((l) => l.dispose()); looks.clear(); },
  };
}
