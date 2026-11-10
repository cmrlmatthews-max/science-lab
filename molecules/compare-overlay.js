// molecules/compare-overlay.js  extra 3D drawing for the Compare mode (box outlines, dashed hydrogen bonds, quiet labels).
// Everything lives in its own THREE.Group on the stage scene, so viewer.js is not touched. Theme aware, disposable.
//   const overlay = createOverlay(stage);
//   overlay.setScale(R);                      R = bounding radius of the drawn structure (angstrom), sets line thickness and label size
//   overlay.setBoxes([{ origin, a, b, c }])   thin box outlines
//   overlay.setLinks([[p, q], ...])           dashed lines between two points
//   overlay.setLabels([{ text, pos }])        small quiet text under each structure
//   overlay.dispose()

import { THREE } from '../shared/scene.js';

const FONT = '-apple-system, "SF Pro Text", system-ui, "Helvetica Neue", Arial, sans-serif';

function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const get = (n, f) => cs.getPropertyValue(n).trim() || f;
  return {
    ink: get('--ink', '#1c1f23'), ink2: get('--ink-2', '#5b6470'), paper: get('--paper-2', '#ffffff'),
    line: get('--line-strong', '#bcc2cb'), accent: get('--accent', '#1f5fa8'),
  };
}

export function createOverlay(stage) {
  const group = new THREE.Group();
  group.name = 'compare-overlay';
  stage.scene.add(group);
  let theme = readTheme();
  let R = 8;
  let boxes = [];
  let links = [];
  let labels = [];
  let disposed = false;
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);
  const Y = new THREE.Vector3(0, 1, 0);
  const tmpM = new THREE.Matrix4(); const tmpQ = new THREE.Quaternion(); const tmpP = new THREE.Vector3(); const tmpS = new THREE.Vector3(); const tmpD = new THREE.Vector3();
  const live = { boxes: null, links: null, labels: [] };
  const px = () => R / 120;   // angstrom per screen pixel, about

  const dropMesh = (m) => { if (!m) return; group.remove(m); if (m.material) m.material.dispose(); };

  function segments(list, rad, color, opacity) {
    if (!list.length) return null;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false });
    const mesh = new THREE.InstancedMesh(cyl, mat, list.length);
    mesh.frustumCulled = false;
    mesh.renderOrder = 6;
    list.forEach(([a, b], i) => {
      tmpD.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const len = tmpD.length();
      if (len < 1e-6) { tmpM.makeScale(0, 0, 0); mesh.setMatrixAt(i, tmpM); return; }
      tmpQ.setFromUnitVectors(Y, tmpD.normalize());
      tmpM.compose(tmpP.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), tmpQ, tmpS.set(rad, len, rad));
      mesh.setMatrixAt(i, tmpM);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    return mesh;
  }

  function drawBoxes() {
    dropMesh(live.boxes); live.boxes = null;
    const segs = [];
    for (const bx of boxes) {
      const pt = (i, j, k) => [0, 1, 2].map((n) => bx.origin[n] + i * bx.a[n] + j * bx.b[n] + k * bx.c[n]);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        segs.push([pt(0, i, j), pt(1, i, j)], [pt(i, 0, j), pt(i, 1, j)], [pt(i, j, 0), pt(i, j, 1)]);
      }
    }
    live.boxes = segments(segs, px() * 0.7, theme.ink2, 0.8);
  }

  function drawLinks() {
    dropMesh(live.links); live.links = null;
    const segs = [];
    const dashes = 5;
    for (const [p, q] of links) {
      const v = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
      const unitsLen = 2 * dashes - 1;
      for (let k = 0; k < dashes; k++) {
        const t0 = (2 * k) / unitsLen; const t1 = (2 * k + 1) / unitsLen;
        segs.push([[p[0] + v[0] * t0, p[1] + v[1] * t0, p[2] + v[2] * t0], [p[0] + v[0] * t1, p[1] + v[1] * t1, p[2] + v[2] * t1]]);
      }
    }
    live.links = segments(segs, px() * 1.1, theme.accent, 1);
  }

  function makeLabel(text) {
    const canvas = document.createElement('canvas');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 30;
    sprite.userData.draw = () => {
      const scale = 3; const fontPx = 14;
      const ctx = canvas.getContext('2d');
      ctx.font = `600 ${fontPx * scale}px ${FONT}`;
      const w = Math.ceil(ctx.measureText(text).width + 16 * scale);
      const h = Math.ceil(fontPx * scale * 1.9);
      canvas.width = w; canvas.height = h;
      ctx.font = `600 ${fontPx * scale}px ${FONT}`;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      const r = 8 * scale;
      ctx.fillStyle = theme.paper; ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.moveTo(r, 0); ctx.arcTo(w, 0, w, h, r); ctx.arcTo(w, h, 0, h, r); ctx.arcTo(0, h, 0, 0, r); ctx.arcTo(0, 0, w, 0, r); ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1 * scale; ctx.strokeStyle = theme.line; ctx.stroke();
      ctx.fillStyle = theme.ink;
      ctx.fillText(text, w / 2, h / 2 + scale * 0.5);
      tex.needsUpdate = true;
      sprite.userData.aspect = w / h;
    };
    sprite.userData.draw();
    return sprite;
  }

  function drawLabels() {
    for (const s of live.labels) { group.remove(s); if (s.material.map) s.material.map.dispose(); s.material.dispose(); }
    live.labels = [];
    labels.forEach((l) => {
      const s = makeLabel(l.text);
      const h = px() * 13;
      s.scale.set(h * s.userData.aspect, h, 1);
      s.position.set(l.pos[0], l.pos[1] - h * 1.5, l.pos[2]);
      s.userData.text = l.text;
      group.add(s);
      live.labels.push(s);
    });
  }

  function redrawAll() { drawBoxes(); drawLinks(); drawLabels(); stage.requestRender(); }

  const offTheme = stage.onTheme(() => {
    theme = readTheme();
    live.labels.forEach((s) => s.userData.draw());
    drawBoxes(); drawLinks();
    stage.requestRender();
  });

  return {
    group,
    setScale(r) { R = Math.max(1, r); redrawAll(); },
    setBoxes(list) { boxes = Array.isArray(list) ? list : []; drawBoxes(); stage.requestRender(); },
    setLinks(list) { links = Array.isArray(list) ? list : []; drawLinks(); stage.requestRender(); },
    setLabels(list) { labels = Array.isArray(list) ? list : []; drawLabels(); stage.requestRender(); },
    _stats() { return { boxes: boxes.length, links: links.length, labels: labels.length }; },
    dispose() {
      if (disposed) return;
      disposed = true;
      offTheme();
      dropMesh(live.boxes); dropMesh(live.links);
      for (const s of live.labels) { group.remove(s); if (s.material.map) s.material.map.dispose(); s.material.dispose(); }
      live.labels = [];
      cyl.dispose();
      stage.scene.remove(group);
    },
  };
}
