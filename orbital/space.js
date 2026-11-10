// orbital/space.js  shared 3D and time helpers for the three Orbital Mechanics modes.
//
// CONVENTIONS
//   Orbit plane = scene XZ plane, y is up. A km point [x, y] maps to scene (x / kmPerUnit, 0, -y / kmPerUnit),
//   so +y on the orbit diagram points away from the camera in the default view (up on screen).
//   sceneScale(extentKm) returns kmPerUnit so that extentKm becomes about 100 scene units.
//
//   SPACE IS BLACK IN BOTH PAGE THEMES. spaceTheme() always returns light-on-black values for 3D objects.
//   Panels and the rest of the page keep following the light and dark theme (that is shared/style.css, not this file).
//
//   LIGHTING: one sun. setupSpaceLighting(stage) (called once by orbital/main.js after createStage) replaces the
//   stage's soft lights with a strong directional sun from SUN_DIR plus a very low ambient. Planet shaders read the
//   same direction from a shared uniform, so the day/night terminator always matches the lit craft.
//
//   TEXTURES: real images live in assets/space/ (see CREDITS.md). They load asynchronously, are cached by URL for the
//   whole page life (mode switches are instant) and every body falls back to a flat-color look if a file is missing.

import { THREE } from '../shared/scene.js';
import { el, button, segmented, select as selectCtl, row } from '../shared/ui.js';
import { Line2 } from '../vendor/addons/lines/Line2.js';
import { LineGeometry } from '../vendor/addons/lines/LineGeometry.js';
import { LineMaterial } from '../vendor/addons/lines/LineMaterial.js';

const FONT = '-apple-system, "SF Pro Text", system-ui, "Helvetica Neue", Arial, sans-serif';

// ---------- theme (always light on black) ----------
const THEME = Object.freeze({
  dark: true,
  bg: '#000000',
  ink: '#e8ecf2',
  ink2: '#9aa5b4',
  paper: '#0b0e13',
  line: '#3a4452',
  accent: '#6cb6ff',
  craft: '#ff9a4d',
});

/**
 * Colors for space drawing. Always light-on-black, whatever the page theme is.
 * @returns {{dark:boolean, bg:string, ink:string, ink2:string, paper:string, line:string, accent:string, craft:string}}
 */
export function spaceTheme() {
  return { ...THEME };
}

// The page theme no longer changes 3D colors. Kept so older call sites keep working (returns an unsubscribe).
function onScheme() { return () => {}; }

function disposeMaterial(m) {
  if (!m) return;
  for (const k of Object.keys(m)) { const v = m[k]; if (v && v.isTexture && !v.userData.cached) v.dispose(); }
  if (m.dispose) m.dispose();
}
function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry && o.geometry.dispose) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(disposeMaterial);
  });
}

// ---------- the sun ----------
/** Unit vector from the planet toward the sun, in scene space (orbit plane is XZ). Chosen so the default views show a half-lit planet. */
export const SUN_DIR = new THREE.Vector3(0.85, 0.21, 0.48).normalize();
const SUN_UNIFORM = { value: SUN_DIR.clone() };

let activeStage = null;
function requestRender() { if (activeStage && activeStage.requestRender) activeStage.requestRender(); }

/**
 * Turn the stage into a space scene: strong sun, almost no ambient. Never edits shared/scene.js, it just
 * removes/dims the lights that createStage added. Call once right after createStage.
 * @param {object} stage from createStage
 * @returns {{sun:THREE.DirectionalLight}|null}
 */
export function setupSpaceLighting(stage) {
  if (!stage || !stage.scene) return null;
  const scene = stage.scene;
  activeStage = stage;
  for (const o of Array.from(scene.children)) {
    if (o.isDirectionalLight && !o.userData.space) { scene.remove(o); if (o.dispose) o.dispose(); }
    else if (o.isHemisphereLight) { o.color.set(0x8aa0c8); o.groundColor.set(0x05070a); o.intensity = 0.16; }
  }
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.4);
  sun.position.copy(SUN_DIR).multiplyScalar(300);
  sun.userData.space = true;
  scene.add(sun);
  scene.userData.space = { sun, sunIntensity: sun.intensity };
  return { sun };
}

/**
 * Cinematic renderer defaults for space: ACES tone mapping, sRGB output, opaque black clear.
 * @param {object} stage
 */
export function configureSpaceRenderer(stage) {
  const r = stage && stage.renderer;
  if (!r) return;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.0;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.setClearColor(0x000000, 1);
}

// ---------- texture cache ----------
const assetUrl = (f) => new URL(`../assets/space/${f}`, import.meta.url).href;
const texCache = new Map();

function getTexture(file, { srgb = true } = {}) {
  const url = assetUrl(file);
  let e = texCache.get(url);
  if (e) return e;
  const tex = new THREE.Texture();
  tex.userData.cached = true;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  e = { tex, state: 'loading', waiters: new Set(), url };
  texCache.set(url, e);
  const img = new Image();
  img.decoding = 'async';
  const done = (ok) => {
    e.state = ok ? 'ready' : 'failed';
    const ws = Array.from(e.waiters); e.waiters.clear();
    for (const w of ws) { try { w(ok); } catch (err) { console.error(err); } }
    requestRender();
  };
  img.onload = () => { tex.image = img; tex.needsUpdate = true; done(true); };
  img.onerror = () => done(false);
  img.src = url;
  return e;
}

/** Calls cb(ok) when the cached texture finished (immediately if already done). Returns a cancel function. */
function whenReady(entry, cb) {
  if (entry.state !== 'loading') { cb(entry.state === 'ready'); return () => {}; }
  entry.waiters.add(cb);
  return () => entry.waiters.delete(cb);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { for (const e of texCache.values()) e.tex.dispose(); });
}

// Sprite whose on-screen size stays wPx x hPx whatever the camera distance (sizeAttenuation off).
function constSprite(mat, wPx, hPx) {
  const sprite = new THREE.Sprite(mat);
  const size = new THREE.Vector2();
  const px = { w: wPx, h: hPx };
  sprite.userData.setPx = (w, h) => { px.w = w; px.h = h; };
  sprite.onBeforeRender = (renderer, scene, camera) => {
    renderer.getSize(size);
    if (!size.y || !camera.isPerspectiveCamera) return;
    const k = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / size.y;
    const sx = px.w * k;
    const sy = px.h * k;
    if (Math.abs(sprite.scale.x - sx) > 1e-9 || Math.abs(sprite.scale.y - sy) > 1e-9) {
      sprite.scale.set(sx, sy, 1);
      sprite.updateMatrixWorld(true);
    }
  };
  sprite.frustumCulled = false;
  return sprite;
}

// ---------- scale ----------
/**
 * Kilometres per scene unit so that extentKm maps to about 100 scene units.
 * @param {number} extentKm
 * @returns {number}
 */
export function sceneScale(extentKm) {
  return Math.max(1e-9, extentKm) / 100;
}

/**
 * Orbit-plane km point to scene position. [x, y] -> (x/k, 0, -y/k).
 * @param {number[]} p [x, y] km
 * @param {number} kmPerUnit
 * @returns {THREE.Vector3}
 */
export function toScene([x, y], kmPerUnit) {
  return new THREE.Vector3(x / kmPerUnit, 0, -y / kmPerUnit);
}

/**
 * Point the camera down at the orbit plane from an oblique angle (about 55 degrees up).
 * Call once at mount and when the central body or preset scale changes a lot, never on selection.
 * @param {object} stage from createStage
 * @param {number} [extentUnits=100] half-width of what must fit, in scene units
 * @param {{elevationDeg?:number, azimuthDeg?:number, padding?:number}} [o]
 */
export function frameSpace(stage, extentUnits = 100, o = {}) {
  const e = extentUnits;
  const box = new THREE.Box3(new THREE.Vector3(-e, -e * 0.04, -e * 0.72), new THREE.Vector3(e, e * 0.04, e * 0.72));
  const el_ = THREE.MathUtils.degToRad(o.elevationDeg ?? 55);
  const az = THREE.MathUtils.degToRad(o.azimuthDeg ?? 10);
  const dir = [Math.sin(az) * Math.cos(el_), Math.sin(el_), Math.cos(az) * Math.cos(el_)];
  stage.frame(box, { dir, padding: o.padding ?? 1.0 });
}

// ---------- body shaders ----------
const VERT = /* glsl */`
varying vec2 vUv; varying vec3 vWN; varying vec3 vWP; varying vec3 vOP;
void main() {
  vUv = uv; vOP = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vWN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const EARTH_FRAG = /* glsl */`
uniform sampler2D tDay; uniform sampler2D tNight; uniform sampler2D tSpec; uniform sampler2D tNorm;
uniform vec3 uSun; uniform vec3 uFlat;
uniform float uHasDay; uniform float uHasNight; uniform float uHasSpec; uniform float uHasNorm;
varying vec2 vUv; varying vec3 vWN; varying vec3 vWP;
vec3 perturbN(vec3 N, vec3 pos, vec2 uv, vec3 mapN) {
  vec3 q0 = dFdx(pos); vec3 q1 = dFdy(pos); vec2 st0 = dFdx(uv); vec2 st1 = dFdy(uv);
  vec3 q1p = cross(q1, N); vec3 q0p = cross(N, q0);
  vec3 T = q1p * st0.x + q0p * st1.x; vec3 B = q1p * st0.y + q0p * st1.y;
  float det = max(dot(T, T), dot(B, B)); float sc = det == 0.0 ? 0.0 : inversesqrt(det);
  return normalize(T * (mapN.x * sc) + B * (mapN.y * sc) + N * mapN.z);
}
void main() {
  vec3 Ng = normalize(vWN); vec3 V = normalize(cameraPosition - vWP); vec3 L = normalize(uSun);
  vec3 N = Ng;
  if (uHasNorm > 0.5) { vec3 m = texture2D(tNorm, vUv).xyz * 2.0 - 1.0; m.xy *= 0.8; N = perturbN(Ng, vWP, vUv, m); }
  float ndlG = dot(Ng, L); float ndl = dot(N, L);
  vec3 day = uHasDay > 0.5 ? texture2D(tDay, vUv).rgb : uFlat;
  float lit = smoothstep(-0.2, 0.6, ndl);
  float tw = exp(-pow(ndlG / 0.16, 2.0));
  vec3 col = day * lit * 1.5 + vec3(0.015, 0.04, 0.10) * lit;
  col *= mix(vec3(1.0), vec3(1.0, 0.72, 0.52), tw * 0.5);
  float sp = uHasSpec > 0.5 ? texture2D(tSpec, vUv).r : 0.0;
  vec3 H = normalize(L + V); float nh = max(dot(N, H), 0.0);
  float glint = (pow(nh, 300.0) * 0.65 + pow(nh, 40.0) * 0.05) * sp * smoothstep(0.0, 0.25, ndlG);
  col += vec3(1.0, 0.93, 0.82) * glint;
  float nightAmt = smoothstep(0.10, -0.20, ndlG);
  if (uHasNight > 0.5) {
    vec3 n = texture2D(tNight, vUv).rgb;
    vec3 l = max(n - vec3(0.05, 0.05, 0.13), 0.0);
    float lum = dot(l, vec3(0.30, 0.59, 0.11));
    col += vec3(1.0, 0.72, 0.40) * pow(lum, 0.75) * 4.2 * nightAmt;
  }
  col += day * vec3(0.55, 0.65, 1.0) * 0.010;
  float fr = pow(1.0 - max(dot(Ng, V), 0.0), 3.0);
  col += vec3(0.26, 0.50, 1.0) * fr * 0.85 * smoothstep(-0.25, 0.45, ndlG);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const CLOUD_FRAG = /* glsl */`
uniform sampler2D tCloud; uniform float uHas; uniform vec3 uSun;
varying vec2 vUv; varying vec3 vWN; varying vec3 vWP;
void main() {
  vec3 Ng = normalize(vWN); vec3 L = normalize(uSun);
  float ndl = dot(Ng, L);
  float a = uHas > 0.5 ? texture2D(tCloud, vUv).r : 0.0;
  float lit = smoothstep(-0.10, 0.55, ndl);
  float tw = exp(-pow(ndl / 0.16, 2.0));
  vec3 col = mix(vec3(0.012, 0.016, 0.028), vec3(1.0, 0.99, 0.97), lit);
  col *= mix(vec3(1.0), vec3(1.0, 0.72, 0.52), tw * 0.5);
  gl_FragColor = vec4(col, a * mix(0.55, 0.92, lit));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const ATMO_FRAG = /* glsl */`
uniform vec3 uSun; uniform vec3 uCol; uniform float uStr; uniform float uLimb;
varying vec2 vUv; varying vec3 vWN; varying vec3 vWP;
void main() {
  vec3 N = normalize(vWN); vec3 V = normalize(cameraPosition - vWP); vec3 L = normalize(uSun);
  float f = clamp(-dot(N, V), 0.0, 1.0);
  float g = clamp(f / uLimb, 0.0, 1.0);
  float rim = pow(g, 2.4);
  float ndl = dot(N, L);
  float sunlit = smoothstep(-0.45, 0.55, ndl);
  float tw = exp(-pow(ndl / 0.2, 2.0));
  vec3 col = uCol * rim * sunlit * uStr;
  col += vec3(1.0, 0.55, 0.22) * rim * tw * 0.10 * uStr;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const ROCK_FRAG = /* glsl */`
uniform sampler2D tMap; uniform float uHas; uniform vec3 uFlat; uniform vec3 uSun; uniform vec3 uTint;
uniform float uGain; uniform float uWrap; uniform vec3 uRim; uniform float uRimStr;
varying vec2 vUv; varying vec3 vWN; varying vec3 vWP;
void main() {
  vec3 Ng = normalize(vWN); vec3 V = normalize(cameraPosition - vWP); vec3 L = normalize(uSun);
  vec3 alb = (uHas > 0.5 ? texture2D(tMap, vUv).rgb : uFlat) * uTint;
  float ndl = dot(Ng, L);
  float lit = clamp((ndl + uWrap) / (1.0 + uWrap), 0.0, 1.0);
  vec3 col = alb * lit * uGain + alb * 0.006;
  float fr = pow(1.0 - max(dot(Ng, V), 0.0), 3.5);
  col += uRim * fr * uRimStr * smoothstep(-0.2, 0.5, ndl);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const SUN_FRAG = /* glsl */`
uniform float uTime;
varying vec2 vUv; varying vec3 vWN; varying vec3 vWP; varying vec3 vOP;
float hash(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5; float s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  vec3 p = normalize(vOP);
  float t = uTime;
  vec3 drift = vec3(0.0, t * 0.020, t * 0.012);
  float big = fbm(p * 2.4 + drift);
  float gran = fbm(p * 14.0 + drift * 2.6 + big * 1.5);
  float v = 0.55 * gran + 0.45 * big;
  v = 0.20 + 0.62 * smoothstep(0.22, 0.85, v);
  vec3 c0 = vec3(0.80, 0.20, 0.02); vec3 c1 = vec3(1.00, 0.52, 0.07); vec3 c2 = vec3(1.00, 0.82, 0.36); vec3 c3 = vec3(1.00, 0.96, 0.80);
  vec3 col = mix(c0, c1, smoothstep(0.0, 0.35, v));
  col = mix(col, c2, smoothstep(0.30, 0.70, v));
  col = mix(col, c3, smoothstep(0.65, 1.0, v));
  float spots = smoothstep(0.62, 0.78, fbm(p * 3.2 - drift * 0.5 + 7.0));
  col *= 1.0 - 0.30 * spots;
  vec3 V = normalize(cameraPosition - vWP);
  float mu = clamp(dot(normalize(vWN), V), 0.0, 1.0);
  col *= 0.30 + 0.70 * pow(mu, 0.55);
  col = mix(col * vec3(1.0, 0.62, 0.32), col, pow(mu, 0.35));
  gl_FragColor = vec4(col * 0.95, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function shaderMat(frag, uniforms, extra = {}) {
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, ...extra });
}

function radialSpriteTexture(stops, px = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad; g.fillRect(0, 0, px, px);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function graticuleGeometry() {
  const pts = [];
  const seg = 72;
  for (let m = 0; m < 12; m++) {
    const lon = (m * Math.PI) / 6;
    const cl = Math.cos(lon); const sl = Math.sin(lon);
    for (let i = 0; i < seg / 2; i++) {
      const a0 = -Math.PI / 2 + (i * Math.PI) / (seg / 2);
      const a1 = -Math.PI / 2 + ((i + 1) * Math.PI) / (seg / 2);
      pts.push(Math.cos(a0) * cl, Math.sin(a0), Math.cos(a0) * sl, Math.cos(a1) * cl, Math.sin(a1), Math.cos(a1) * sl);
    }
  }
  for (const latDeg of [-60, -30, 0, 30, 60]) {
    const lat = (latDeg * Math.PI) / 180;
    const r = Math.cos(lat); const y = Math.sin(lat);
    for (let i = 0; i < seg; i++) {
      const a0 = (i * 2 * Math.PI) / seg; const a1 = ((i + 1) * 2 * Math.PI) / seg;
      pts.push(r * Math.cos(a0), y, r * Math.sin(a0), r * Math.cos(a1), y, r * Math.sin(a1));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

const TILT = { earth: 23.4, mars: 25.2, moon: 1.5, sun: 7.25 };

/**
 * A realistic body from bodies.js: textured Earth (day, night city lights, ocean glint, relief, clouds, atmosphere),
 * Moon, Mars, and an animated unlit Sun with a soft corona. Textures load in the background; until they arrive (or if a
 * file is missing) the body shows a flat shaded color. group.userData.spin(dt) turns the body slowly.
 * @param {object} body entry of BODIES
 * @param {number} kmPerUnit
 * @param {{minRadiusUnits?:number, graticule?:boolean}} [opts] minRadiusUnits draws the body at least this big (exaggerated: true); graticule:true adds a faint lat/long grid (off by default)
 * @returns {{group:THREE.Group, radiusUnits:number, exaggerated:boolean, setScale:(kmPerUnit:number)=>void, dispose:()=>void}}
 */
export function createBody(body, kmPerUnit, opts = {}) {
  const group = new THREE.Group();
  group.name = `body-${body.id}`;
  const tiltGroup = new THREE.Group();
  tiltGroup.rotation.z = THREE.MathUtils.degToRad(TILT[body.id] ?? 0);
  const spinGroup = new THREE.Group();
  group.add(tiltGroup);
  tiltGroup.add(spinGroup);

  const isSun = body.id === 'sun';
  const flat = new THREE.Color(body.color);
  const disposables = [];
  const cancels = [];
  let disposed = false;
  const track = (o) => { disposables.push(o); return o; };

  let sphereGeo;
  let sphereMat;
  let cloudMesh = null;
  let sunLight = null;
  let sunUniforms = null;
  let lightRestore = null;

  const loadInto = (file, uniforms, texKey, hasKey, srgb = true) => {
    const e = getTexture(file, { srgb });
    uniforms[texKey] = { value: e.tex };
    uniforms[hasKey] = { value: 0 };
    cancels.push(whenReady(e, (ok) => { if (!disposed && ok) { uniforms[hasKey].value = 1; requestRender(); } }));
  };

  if (isSun) {
    sphereGeo = track(new THREE.SphereGeometry(1, 80, 40));
    sunUniforms = { uTime: { value: 0 } };
    sphereMat = track(shaderMat(SUN_FRAG, sunUniforms));
  } else if (body.id === 'earth') {
    sphereGeo = track(new THREE.SphereGeometry(1, 96, 48));
    const u = { uSun: SUN_UNIFORM, uFlat: { value: new THREE.Color('#2f6aa8') } };
    loadInto('earth_day_2048.jpg', u, 'tDay', 'uHasDay');
    loadInto('earth_night_2048.jpg', u, 'tNight', 'uHasNight');
    loadInto('earth_spec_1024.jpg', u, 'tSpec', 'uHasSpec', false);
    loadInto('earth_normal_1024.jpg', u, 'tNorm', 'uHasNorm', false);
    sphereMat = track(shaderMat(EARTH_FRAG, u));
  } else {
    sphereGeo = track(new THREE.SphereGeometry(1, 80, 40));
    const isMars = body.id === 'mars';
    const u = {
      uSun: SUN_UNIFORM, uFlat: { value: flat },
      uTint: { value: isMars ? new THREE.Color(0.92, 0.80, 0.74) : new THREE.Color(1, 1, 1) },
      uGain: { value: isMars ? 1.25 : 1.7 },
      uWrap: { value: isMars ? 0.04 : 0.0 },
      uRim: { value: isMars ? new THREE.Color(0.85, 0.52, 0.40) : new THREE.Color(0, 0, 0) },
      uRimStr: { value: isMars ? 0.38 : 0 },
    };
    if (body.id === 'moon') loadInto('moon_1024.jpg', u, 'tMap', 'uHas');
    else if (isMars) loadInto('mars_1440.jpg', u, 'tMap', 'uHas');
    else { u.tMap = { value: new THREE.Texture() }; u.uHas = { value: 0 }; }
    sphereMat = track(shaderMat(ROCK_FRAG, u));
  }

  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.frustumCulled = false;
  spinGroup.add(sphere);

  // Slow spin: driven by the mode's spin(dt) hook; drifts by itself when nobody calls the hook.
  const SPIN = isSun ? 0.02 : 0.08;
  let lastHook = -1e9;
  let lastT = performance.now();
  let clock = 0;
  sphere.onBeforeRender = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    if (now - lastHook > 600) { spinGroup.rotation.y += dt * SPIN * 0.6; }
    if (cloudMesh) cloudMesh.rotation.y += dt * 0.004;
    if (sunUniforms) {
      clock += dt;
      sunUniforms.uTime.value = clock;
    }
  };
  group.userData.spin = (dt) => {
    lastHook = performance.now();
    spinGroup.rotation.y += dt * SPIN;
    if (cloudMesh) cloudMesh.rotation.y += dt * SPIN * 0.12;
  };

  // ----- Earth clouds + atmosphere -----
  const addAtmosphere = (radius, col, strength) => {
    const geo = track(new THREE.SphereGeometry(1, 64, 32));
    const mat = track(new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: ATMO_FRAG,
      uniforms: { uSun: SUN_UNIFORM, uCol: { value: new THREE.Color(col) }, uStr: { value: strength }, uLimb: { value: Math.sqrt(1 - 1 / (radius * radius)) } },
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    const m = new THREE.Mesh(geo, mat);
    m.scale.setScalar(radius);
    m.frustumCulled = false;
    group.add(m);
    return m;
  };

  if (body.id === 'earth') {
    const cu = { uSun: SUN_UNIFORM };
    loadInto('earth_clouds_1024.jpg', cu, 'tCloud', 'uHas');
    const cloudGeo = track(new THREE.SphereGeometry(1, 64, 32));
    const cloudMat = track(shaderMat(CLOUD_FRAG, cu, { transparent: true, depthWrite: false }));
    cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    cloudMesh.scale.setScalar(1.006);
    cloudMesh.frustumCulled = false;
    spinGroup.add(cloudMesh);
    addAtmosphere(1.075, '#4d8dff', 1.5);
  } else if (body.id === 'mars') {
    addAtmosphere(1.045, '#d98a6c', 0.9);
  }

  // ----- Sun corona + point light -----
  if (isSun) {
    const coronaTex = track(radialSpriteTexture([
      [0.0, 'rgba(255,240,200,1)'], [0.34, 'rgba(255,225,150,0.95)'], [0.395, 'rgba(255,190,90,0.62)'],
      [0.46, 'rgba(255,150,50,0.30)'], [0.60, 'rgba(255,110,30,0.11)'], [0.82, 'rgba(255,80,20,0.03)'], [1.0, 'rgba(255,60,10,0)'],
    ]));
    const coronaMat = track(new THREE.SpriteMaterial({ map: coronaTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    const corona = new THREE.Sprite(coronaMat);
    corona.scale.set(5.2, 5.2, 1);
    corona.renderOrder = 1;
    group.add(corona);
    sunLight = new THREE.PointLight(0xfff0d8, 3.2, 0, 0);
    group.add(sunLight);
    // When the Sun is the central body it is the only light: switch the fixed directional sun off while it is drawn.
    const prevBefore = sphere.onBeforeRender;
    sphere.onBeforeRender = (renderer, scene, camera, geo, mat, grp) => {
      prevBefore(renderer, scene, camera, geo, mat, grp);
      const sp = scene.userData && scene.userData.space;
      if (sp && !lightRestore) { lightRestore = sp; sp.sun.intensity = 0.0; }
    };
  }

  if (opts.graticule === true) {
    const gg = track(new THREE.LineSegments(graticuleGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false })));
    gg.scale.setScalar(1.003);
    spinGroup.add(gg);
  }

  const api = { group, radiusUnits: 0, exaggerated: false };
  api.setScale = (k) => {
    const real = body.radius / k;
    const r = Math.max(real, opts.minRadiusUnits || 0);
    api.radiusUnits = r;
    api.exaggerated = r > real * 1.0001;
    group.scale.setScalar(r);
  };
  api.dispose = () => {
    disposed = true;
    for (const c of cancels) c();
    if (lightRestore) lightRestore.sun.intensity = lightRestore.sunIntensity;
    for (const d of disposables) { if (d && d.dispose) d.dispose(); }
    group.traverse((o) => { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); });
    group.removeFromParent();
  };
  api.setScale(kmPerUnit);
  return api;
}

// ---------- path ----------
/**
 * An orbit line in the XZ plane. A thin bright line over a wide faint additive line, so it glows softly on black.
 * object.material is a small shim (opacity and depthTest settable) so the modes can change them directly.
 * @param {number[][]} points [[x, y], ...] km
 * @param {number} kmPerUnit
 * @param {{color?:string, dashed?:boolean, opacity?:number, closed?:boolean, width?:number, dashSize?:number}} [opts]
 * @returns {{object:THREE.Group, setPoints:(points:number[][], kmPerUnit?:number)=>void, setScale:(kmPerUnit:number)=>void, setColor:(css:string)=>void, dispose:()=>void}}
 */
export function createPath(points, kmPerUnit, opts = {}) {
  const dashed = !!opts.dashed;
  const color = new THREE.Color(opts.color || THEME.accent);
  const coreW = opts.width ? Math.max(1, opts.width) : 1.7;
  const dashSize = opts.dashSize || 1.6;
  let baseOpacity = opts.opacity ?? 0.95;
  const mk = (w, op, glowPass) => new LineMaterial({
    color, linewidth: w, transparent: true, opacity: glowPass ? 1 : op, depthWrite: false, toneMapped: false,
    dashed, dashSize, gapSize: dashSize * 0.75, dashScale: 1,
  });
  // The wide halo is a fully opaque (alpha 1), pre-dimmed copy of the color: on black it reads like a soft glow, and overlapping
  // segment caps replace each other instead of stacking into a beaded look the way translucent wide lines do.
  const coreMat = mk(coreW, baseOpacity, false);
  const glowMat = mk(coreW * 4.2, 1, true);
  const GLOW = 0.04;
  const paintGlow = () => glowMat.color.copy(color).multiplyScalar(GLOW * baseOpacity);
  paintGlow();
  const empty = () => new LineGeometry();
  let geo = empty();
  const glow = new Line2(geo, glowMat);
  const core = new Line2(geo, coreMat);
  glow.frustumCulled = false; core.frustumCulled = false;
  glow.renderOrder = 0; core.renderOrder = 1;
  const object = new THREE.Group();
  object.add(glow, core);
  object.frustumCulled = false;

  const shim = {
    get opacity() { return baseOpacity; },
    set opacity(v) { baseOpacity = v; coreMat.opacity = v; paintGlow(); },
    get depthTest() { return coreMat.depthTest; },
    set depthTest(v) { coreMat.depthTest = v; glowMat.depthTest = v; },
    get transparent() { return true; },
    set transparent(v) { /* always transparent */ },
    get color() { return color; },
    dispose() { /* real materials are disposed by path.dispose() */ },
  };
  Object.defineProperty(object, 'material', { value: shim, configurable: true });

  let pts = points;
  let k = kmPerUnit;
  function rebuild() {
    const n = pts.length;
    const closed = !!opts.closed && n > 2;
    const total = n + (closed ? 1 : 0);
    const old = geo;
    geo = new LineGeometry();
    if (total >= 2) {
      const arr = new Float32Array(total * 3);
      for (let i = 0; i < total; i++) {
        const p = pts[i % n];
        arr[i * 3] = p[0] / k; arr[i * 3 + 1] = 0; arr[i * 3 + 2] = -p[1] / k;
      }
      geo.setPositions(arr);
    }
    glow.geometry = geo; core.geometry = geo;
    old.dispose();
    if (dashed && total >= 2) core.computeLineDistances(); // shared geometry
    core.visible = total >= 2;
    glow.visible = total >= 2 && !dashed; // wide dashes look blocky, so dashed lines get no halo
  }
  rebuild();
  return {
    object,
    setPoints(p, kk) { pts = p; if (kk) k = kk; rebuild(); },
    setScale(kk) { k = kk; rebuild(); },
    setColor(css) { color.set(css); coreMat.color.set(css); paintGlow(); },
    dispose() { geo.dispose(); coreMat.dispose(); glowMat.dispose(); object.removeFromParent(); },
  };
}

// ---------- polar reference rings ----------
/**
 * A very faint polar reference: a few concentric circles (and optional crossing axes) in the orbit plane.
 * @param {{radiusUnits?:number, count?:number, axes?:boolean}} [opts] outermost ring radius in scene units (default 100)
 * @returns {{object:THREE.Group, dispose:()=>void}}
 */
export function createRings(opts = {}) {
  const R = opts.radiusUnits || 100;
  const count = opts.count || 4;
  const group = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: THEME.line, transparent: true, opacity: 0.14, depthWrite: false, toneMapped: false });
  for (let i = 1; i <= count; i++) {
    const r = (R * i) / count;
    const n = 160;
    const arr = new Float32Array(n * 3);
    for (let j = 0; j < n; j++) { const a = (j / n) * Math.PI * 2; arr[j * 3] = r * Math.cos(a); arr[j * 3 + 2] = r * Math.sin(a); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    group.add(new THREE.LineLoop(g, mat));
  }
  if (opts.axes !== false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-R, 0, 0, R, 0, 0, 0, 0, -R, 0, 0, R], 3));
    group.add(new THREE.LineSegments(g, mat));
  }
  group.renderOrder = -1;
  return { object: group, dispose() { disposeTree(group); group.removeFromParent(); } };
}

// ---------- craft ----------
function glowTexture(px = 64) {
  return radialSpriteTexture([
    [0.0, 'rgba(255,255,255,1)'], [0.12, 'rgba(255,255,255,0.95)'], [0.22, 'rgba(255,255,255,0.45)'],
    [0.5, 'rgba(255,255,255,0.12)'], [1.0, 'rgba(255,255,255,0)'],
  ], px);
}

function panelTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#1b3f86'; g.fillRect(0, 0, 128, 64);
  const gr = g.createLinearGradient(0, 0, 128, 64);
  gr.addColorStop(0, 'rgba(120,170,255,0.35)'); gr.addColorStop(0.5, 'rgba(40,80,170,0)'); gr.addColorStop(1, 'rgba(120,170,255,0.2)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
  g.strokeStyle = 'rgba(190,215,255,0.65)'; g.lineWidth = 1.5;
  for (let x = 0; x <= 128; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }
  for (let y = 0; y <= 64; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * A small spacecraft (gold foil body, two blue solar panels, a dish) that keeps a readable on-screen size, a bright marker
 * dot so it is never lost, and a glowing fading trail. The craft is always drawn in front of the planet.
 * Optional setHeading([vx, vy]) points the craft along a velocity (orbit-plane km/s, any scale); nothing happens if it is never called.
 * @param {{color?:string, size?:number, trail?:number}} [opts] size scales the on-screen craft (default 13, about 48 px wide), trail = number of remembered positions (default 0 = none)
 * @returns {{object:THREE.Group, setPosition:(posKm:number[], kmPerUnit:number)=>void, setHeading:(v:number[])=>void, clearTrail:()=>void, setColor:(css:string)=>void, dispose:()=>void}}
 */
export function createCraft(opts = {}) {
  const size = opts.size || 13;
  const trailN = opts.trail || 0;
  const spanPx = size * 3.7;
  let color = opts.color || THEME.craft;
  const object = new THREE.Group();
  const craftGroup = new THREE.Group(); // positioned at the craft
  object.add(craftGroup);

  const disposables = [];
  const keep = (o) => { disposables.push(o); return o; };
  // Keep depth testing for our own meshes even when a mode sets material.depthTest = false (we clear depth once instead).
  const pin = (m) => { Object.defineProperty(m, 'depthTest', { get() { return true; }, set() {}, configurable: true }); return m; };

  // soft glow behind the craft, never lost
  const glowTex = keep(glowTexture(64));
  const glowMat = keep(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const glowSprite = constSprite(glowMat, 32, 32);
  glowSprite.renderOrder = 10;
  craftGroup.add(glowSprite);
  const dotMat = keep(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const dotSprite = constSprite(dotMat, 11, 11);
  dotSprite.renderOrder = 14;
  craftGroup.add(dotSprite);

  // depth reset sentinel + model
  const model = new THREE.Group();
  const heading = new THREE.Group();
  heading.add(model);
  craftGroup.add(heading);
  const sentinelGeo = keep(new THREE.PlaneGeometry(1e-4, 1e-4));
  const sentinelMat = keep(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, transparent: true }));
  const sentinel = new THREE.Mesh(sentinelGeo, sentinelMat);
  sentinel.renderOrder = 11;
  sentinel.frustumCulled = false;
  craftGroup.add(sentinel);

  const gold = keep(pin(new THREE.MeshStandardMaterial({ color: 0xd9a944, metalness: 0.35, roughness: 0.38, emissive: 0x4a3410, emissiveIntensity: 0.55, transparent: true })));
  const goldDark = keep(pin(new THREE.MeshStandardMaterial({ color: 0xa8762a, metalness: 0.35, roughness: 0.45, emissive: 0x2e1d08, emissiveIntensity: 0.5, transparent: true })));
  const grey = keep(pin(new THREE.MeshStandardMaterial({ color: 0xcfd4dc, metalness: 0.3, roughness: 0.4, emissive: 0x2a2e34, emissiveIntensity: 0.5, transparent: true, side: THREE.DoubleSide })));
  const darkM = keep(pin(new THREE.MeshStandardMaterial({ color: 0x23272d, metalness: 0.2, roughness: 0.6, transparent: true })));
  const panelTex = keep(panelTexture());
  const panelM = keep(pin(new THREE.MeshStandardMaterial({ color: 0xffffff, map: panelTex, emissive: 0x1a3a80, emissiveMap: panelTex, emissiveIntensity: 0.55, metalness: 0.45, roughness: 0.35, transparent: true })));

  const part = (geo, mat, x, y, z, order = 12) => {
    keep(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.renderOrder = order;
    m.frustumCulled = false;
    model.add(m);
    return m;
  };
  part(new THREE.BoxGeometry(1.0, 0.55, 0.55), gold, 0, 0, 0);
  part(new THREE.BoxGeometry(0.1, 0.6, 0.6), goldDark, -0.18, 0, 0);
  part(new THREE.BoxGeometry(0.1, 0.6, 0.6), goldDark, 0.18, 0, 0);
  part(new THREE.CylinderGeometry(0.1, 0.16, 0.2, 14), darkM, -0.58, 0, 0).rotation.z = Math.PI / 2;
  part(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 14), darkM, 0.54, 0, 0).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) {
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 8), grey, 0, 0, s * 0.42).rotation.x = Math.PI / 2;
    part(new THREE.BoxGeometry(0.74, 0.035, 1.3), panelM, 0, 0, s * 1.2);
  }
  part(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 8), grey, 0.05, 0.4, 0);
  const dish = part(new THREE.SphereGeometry(0.36, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), grey, 0.05, 0.62, 0);
  dish.rotation.x = Math.PI; dish.rotation.z = 0.35; dish.position.y = 0.62 + 0.1;
  part(new THREE.SphereGeometry(0.045, 8, 6), darkM, 0.05, 0.62, 0.0, 12);

  // On-screen size, depth reset and heading, all done just before the sentinel draws
  const size2 = new THREE.Vector2();
  let hasHeading = false;
  sentinel.onBeforeRender = (renderer, scene, camera) => {
    renderer.getSize(size2);
    if (size2.y && camera.isPerspectiveCamera) {
      craftGroup.updateWorldMatrix(true, false);
      const wp = new THREE.Vector3().setFromMatrixPosition(craftGroup.matrixWorld);
      const dist = wp.distanceTo(camera.position);
      const k = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / size2.y;
      const s = THREE.MathUtils.clamp((spanPx * k * dist) / 3.4, 0.005, 14);
      model.scale.setScalar(s);
      model.updateMatrixWorld(true);
    }
    renderer.clearDepth();
  };

  // trail (fat additive line, fading to black)
  let trailGeo = null; let trailMat = null; let trailLine = null;
  const hist = [];
  let lastK = 1;
  const tmpC = new THREE.Color();
  function writeTrail() {
    if (!trailGeo) return;
    const n = hist.length;
    const iPos = trailGeo.attributes.instanceStart.data;
    const iCol = trailGeo.attributes.instanceColorStart.data;
    tmpC.set(color);
    for (let s = 0; s < trailN - 1; s++) {
      const a = hist[Math.min(s, n - 1)] || [0, 0];
      const b = hist[Math.min(s + 1, n - 1)] || [0, 0];
      const o = s * 6;
      iPos.array[o] = a[0] / lastK; iPos.array[o + 1] = 0; iPos.array[o + 2] = -a[1] / lastK;
      iPos.array[o + 3] = b[0] / lastK; iPos.array[o + 4] = 0; iPos.array[o + 5] = -b[1] / lastK;
      const ua = n > 1 ? Math.min(s, n - 1) / (n - 1) : 1;
      const ub = n > 1 ? Math.min(s + 1, n - 1) / (n - 1) : 1;
      const fa = ua * ua; const fb = ub * ub;
      iCol.array[o] = tmpC.r * fa; iCol.array[o + 1] = tmpC.g * fa; iCol.array[o + 2] = tmpC.b * fa;
      iCol.array[o + 3] = tmpC.r * fb; iCol.array[o + 4] = tmpC.g * fb; iCol.array[o + 5] = tmpC.b * fb;
    }
    iPos.needsUpdate = true; iCol.needsUpdate = true;
    trailGeo.instanceCount = Math.max(0, n - 1);
    trailLine.visible = n > 1;
  }
  if (trailN > 1) {
    trailGeo = new LineGeometry();
    trailGeo.setPositions(new Float32Array(trailN * 3));
    trailGeo.setColors(new Float32Array(trailN * 3));
    trailMat = new LineMaterial({ vertexColors: true, linewidth: 3, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    trailLine = new Line2(trailGeo, trailMat);
    trailLine.frustumCulled = false;
    trailLine.renderOrder = 9;
    trailLine.visible = false;
    object.add(trailLine);
  }

  const applyColor = () => { glowMat.color.set(color); writeTrail(); };
  applyColor();

  return {
    object,
    setPosition(posKm, kmPerUnit) {
      craftGroup.position.set(posKm[0] / kmPerUnit, 0, -posKm[1] / kmPerUnit);
      if (!trailLine) return;
      lastK = kmPerUnit;
      const step = 0.4 * kmPerUnit; // ignore moves smaller than 0.4 scene units
      const last = hist[hist.length - 1];
      if (last) {
        const d = Math.hypot(posKm[0] - last[0], posKm[1] - last[1]);
        if (d > 40 * step) hist.length = 0; // a jump (restart): drop the trail
        else if (d < step) return;
      }
      hist.push([posKm[0], posKm[1]]);
      if (hist.length > trailN) hist.shift();
      writeTrail();
    },
    setHeading(v) {
      if (!v || (Math.abs(v[0]) < 1e-30 && Math.abs(v[1]) < 1e-30)) return;
      hasHeading = true;
      heading.rotation.y = Math.atan2(v[1], v[0]);
    },
    clearTrail() { hist.length = 0; writeTrail(); },
    setColor(css) { color = css; applyColor(); },
    dispose() {
      for (const d of disposables) if (d && d.dispose) d.dispose();
      if (trailGeo) trailGeo.dispose();
      if (trailMat) trailMat.dispose();
      object.removeFromParent();
    },
  };
}

// ---------- arrow ----------
/**
 * A vector arrow (shaft and head, unlit). Its length is fixed in scene units; only the direction follows the vector.
 * @param {{color?:string, radius?:number}} [opts] radius = shaft radius in scene units (default 0.32)
 * @returns {{object:THREE.Group, set:(originKm:number[], vectorKm:number[], kmPerUnit:number, lengthUnits?:number)=>void, setVisible:(v:boolean)=>void, dispose:()=>void}}
 */
export function createArrow(opts = {}) {
  const rad = opts.radius || 0.32;
  const mat = new THREE.MeshBasicMaterial({ color: opts.color || THEME.accent, depthWrite: true, toneMapped: false });
  const shaftGeo = new THREE.CylinderGeometry(rad, rad, 1, 10, 1);
  shaftGeo.translate(0, 0.5, 0);
  const headGeo = new THREE.ConeGeometry(rad * 2.8, 1, 16, 1);
  headGeo.translate(0, 0.5, 0);
  const shaft = new THREE.Mesh(shaftGeo, mat);
  const head = new THREE.Mesh(headGeo, mat);
  const object = new THREE.Group();
  object.add(shaft, head);
  object.visible = false;
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  return {
    object,
    set(originKm, vectorKm, kmPerUnit, lengthUnits = 12) {
      dir.set(vectorKm[0], 0, -vectorKm[1]);
      if (dir.lengthSq() < 1e-30) { object.visible = false; return; }
      dir.normalize();
      const L = lengthUnits;
      const hl = Math.min(L * 0.35, rad * 7);
      object.visible = true;
      object.position.set(originKm[0] / kmPerUnit, 0, -originKm[1] / kmPerUnit);
      object.quaternion.setFromUnitVectors(up, dir);
      shaft.scale.set(1, Math.max(0.001, L - hl), 1);
      head.position.set(0, L - hl, 0);
      head.scale.set(1, hl, 1);
    },
    setVisible(v) { object.visible = !!v; },
    dispose() { shaftGeo.dispose(); headGeo.dispose(); mat.dispose(); object.removeFromParent(); },
  };
}

// ---------- marker / label ----------
function dotTexture(canvas, color, ring, px) {
  const s = 2;
  canvas.width = canvas.height = px * s;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);
  const m = canvas.width / 2;
  c.beginPath(); c.arc(m, m, m - 1, 0, Math.PI * 2); c.fillStyle = ring; c.fill();
  c.beginPath(); c.arc(m, m, m * 0.68, 0, Math.PI * 2); c.fillStyle = color; c.fill();
}

/**
 * A small dot with a quiet text label (sentence case as given, system sans, regular weight, soft dark halo for black space).
 * Constant on-screen size.
 * @param {string} label
 * @param {{color?:string, fontPx?:number, boxed?:boolean, dot?:boolean, side?:'right'|'left'|'above'}} [opts] boxed draws a hairline box
 * @returns {{object:THREE.Group, setPosition:(posKm:number[], kmPerUnit:number)=>void, setLabel:(text:string)=>void, dispose:()=>void}}
 */
export function createMarker(label, opts = {}) {
  const fontPx = opts.fontPx || 12;
  const side = opts.side || 'right';
  const S = 3; // texture oversampling
  const object = new THREE.Group();
  let text = String(label ?? '');

  const labelCanvas = document.createElement('canvas');
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  labelTex.anisotropy = 4;
  const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, sizeAttenuation: false, depthTest: false, depthWrite: false, toneMapped: false });
  const labelSprite = constSprite(labelMat, 10, 10);
  labelSprite.renderOrder = 30;
  object.add(labelSprite);

  const showDot = opts.dot !== false;
  let dotCanvas = null; let dotTex = null; let dotMat = null; let dotSprite = null;
  if (showDot) {
    dotCanvas = document.createElement('canvas');
    dotTex = new THREE.CanvasTexture(dotCanvas);
    dotTex.colorSpace = THREE.SRGBColorSpace;
    dotMat = new THREE.SpriteMaterial({ map: dotTex, transparent: true, sizeAttenuation: false, depthTest: false, depthWrite: false, toneMapped: false });
    dotSprite = constSprite(dotMat, 7, 7);
    dotSprite.renderOrder = 29;
    object.add(dotSprite);
  }

  function draw() {
    const th = THEME;
    const ink = opts.color || th.ink;
    const pad = 4;
    const ctx = labelCanvas.getContext('2d');
    const font = `400 ${fontPx * S}px ${FONT}`;
    ctx.font = font;
    const tw = Math.ceil(ctx.measureText(text).width);
    const wPx = Math.ceil(tw / S) + pad * 2 + 6;
    const hPx = Math.ceil(fontPx * 1.5) + 2;
    labelCanvas.width = wPx * S;
    labelCanvas.height = hPx * S;
    const c = labelCanvas.getContext('2d');
    c.font = font;
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    const x0 = (side === 'left' ? pad : 6 + pad) * S;
    if (opts.boxed) {
      c.fillStyle = th.paper; c.globalAlpha = 0.85;
      c.fillRect((side === 'left' ? 0 : 6) * S + 1, 1, (wPx - 6) * S - 2, hPx * S - 2);
      c.globalAlpha = 1;
      c.strokeStyle = th.line; c.lineWidth = 1;
      c.strokeRect((side === 'left' ? 0 : 6) * S + 1, 1, (wPx - 6) * S - 2, hPx * S - 2);
    } else {
      c.lineJoin = 'round';
      c.strokeStyle = 'rgba(0,0,0,0.85)';
      c.lineWidth = 5 * S; c.globalAlpha = 0.45;
      c.strokeText(text, x0, (hPx * S) / 2 + 1);
      c.lineWidth = 2.6 * S; c.globalAlpha = 0.9;
      c.strokeText(text, x0, (hPx * S) / 2 + 1);
      c.globalAlpha = 1;
    }
    c.fillStyle = ink;
    c.fillText(text, x0, (hPx * S) / 2 + 1);
    labelTex.dispose(); labelTex.needsUpdate = true /* dispose forces a re-upload at the new canvas size */;
    labelSprite.userData.setPx(wPx, hPx);
    if (side === 'right') labelSprite.center.set(0, 0.5);
    else if (side === 'left') labelSprite.center.set(1, 0.5);
    else labelSprite.center.set(0.5, -0.1);
    if (dotCanvas) {
      dotTexture(dotCanvas, ink, 'rgba(0,0,0,0.85)', 14);
      dotTex.needsUpdate = true;
    }
  }
  draw();
  return {
    object,
    setPosition(posKm, kmPerUnit) { object.position.set(posKm[0] / kmPerUnit, 0, -posKm[1] / kmPerUnit); },
    setLabel(t) { const n = String(t ?? ''); if (n !== text) { text = n; draw(); } },
    dispose() {
      labelTex.dispose(); labelMat.dispose();
      if (dotTex) { dotTex.dispose(); dotMat.dispose(); }
      object.removeFromParent();
    },
  };
}

// ---------- stars ----------
const STAR_VERT = /* glsl */`
attribute float aSize; attribute vec3 aColor;
uniform float uPx;
varying vec3 vC;
void main() {
  vC = aColor;
  gl_PointSize = aSize * uPx;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const STAR_FRAG = /* glsl */`
varying vec3 vC;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float a = smoothstep(1.0, 0.0, r);
  a = a * a * (0.35 + 0.65 * smoothstep(0.55, 0.0, r));
  gl_FragColor = vec4(vC * a, 1.0);
}`;

/**
 * A rich star sky: a few thousand colored stars (some brighter with a soft halo), a faint Milky Way band, and a very dim
 * far dome. Follows the camera position (not its rotation) so it never swims. The count argument only scales the density a little.
 * @param {number} [count=260]
 * @returns {THREE.Points} with points.dispose()
 */
export function createStars(count = 260) {
  const n = Math.round(9000 + count * 4);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const sz = new Float32Array(n);
  let s = 987654321;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  // Milky Way plane normal chosen so the band crosses the default oblique views.
  const nPlane = new THREE.Vector3(0.25, -0.62, 0.74).normalize();
  const basisU = new THREE.Vector3(1, 0, 0).cross(nPlane).normalize();
  const basisV = new THREE.Vector3().crossVectors(nPlane, basisU).normalize();
  const R = 400;
  const tmp = new THREE.Vector3();
  const tint = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const inBand = i >= n * 0.62;
    if (!inBand) {
      const u = rnd() * 2 - 1; const a = rnd() * Math.PI * 2; const r = Math.sqrt(1 - u * u);
      tmp.set(r * Math.cos(a), u, r * Math.sin(a));
    } else {
      // gaussian spread around the great circle
      const g = (rnd() + rnd() + rnd() + rnd() - 2) * 0.17;
      const a = rnd() * Math.PI * 2;
      tmp.copy(basisU).multiplyScalar(Math.cos(a)).addScaledVector(basisV, Math.sin(a)).multiplyScalar(Math.sqrt(Math.max(0, 1 - g * g))).addScaledVector(nPlane, g);
    }
    pos[i * 3] = tmp.x * R; pos[i * 3 + 1] = tmp.y * R; pos[i * 3 + 2] = tmp.z * R;
    const m = rnd();
    const bright = inBand ? 0.16 + 0.55 * m * m : 0.24 + 0.9 * Math.pow(m, 4);
    const t = rnd();
    if (t < 0.22) tint.setRGB(0.70, 0.80, 1.0); else if (t < 0.72) tint.setRGB(1.0, 0.98, 0.96); else if (t < 0.9) tint.setRGB(1.0, 0.90, 0.72); else tint.setRGB(1.0, 0.76, 0.58);
    col[i * 3] = tint.r * bright; col[i * 3 + 1] = tint.g * bright; col[i * 3 + 2] = tint.b * bright;
    sz[i] = (inBand ? 1.1 : 1.3) + Math.pow(m, 6) * 3.4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
    uniforms: { uPx: { value: 1 } },
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = -90;

  // faint Milky Way dome (texture loads in the background)
  const e = getTexture('milkyway_2048.jpg');
  const domeMat = new THREE.MeshBasicMaterial({ color: 0x000000, map: e.tex, side: THREE.BackSide, depthTest: false, depthWrite: false, toneMapped: false });
  const domeGeo = new THREE.SphereGeometry(300, 48, 24);
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.frustumCulled = false;
  dome.renderOrder = -100;
  // Rotate the baked band (normal (-0.3, 0.85, 0.43) after three's u mapping) onto the star band plane.
  dome.quaternion.setFromUnitVectors(new THREE.Vector3(-0.3, 0.85, 0.43).normalize(), nPlane);
  const cancel = whenReady(e, (ok) => { if (ok) { domeMat.color.setScalar(0.24); domeMat.needsUpdate = true; requestRender(); } });
  points.add(dome);
  const follow = (renderer, scene, camera) => {
    points.position.copy(camera.position);
    points.updateMatrixWorld(true);
  };
  dome.onBeforeRender = follow;
  const v2 = new THREE.Vector2();
  points.onBeforeRender = (renderer, scene, camera) => {
    follow(renderer, scene, camera);
    renderer.getSize(v2);
    mat.uniforms.uPx.value = Math.min(2, renderer.getPixelRatio()) * (v2.x > 700 ? 1.1 : 0.9);
  };
  points.dispose = () => { cancel(); geo.dispose(); mat.dispose(); domeGeo.dispose(); domeMat.dispose(); points.removeFromParent(); };
  return points;
}

// ---------- time ----------
/**
 * Compact time control: play/pause, speed and restart. Fits 340 px.
 * @param {{warps:Array<{value:number,label:string}>, value:number, playing:boolean, onChange?:(s:{playing:boolean,warp:number})=>void, onReset?:()=>void, label?:string}} p
 * @returns {{el:HTMLElement, set:(s:{playing?:boolean,warp?:number})=>void}}
 */
export function timeControl({ warps, value, playing, onChange, onReset, label = 'Speed' }) {
  let state = { playing: !!playing, warp: value };
  const fire = () => { if (onChange) onChange({ ...state }); };
  const playBtn = button({ label: state.playing ? 'Pause' : 'Play', kind: 'primary', onClick: () => { state.playing = !state.playing; paint(); fire(); } });
  playBtn.style.minWidth = '84px';
  const resetBtn = button({ label: 'Restart', onClick: () => { if (onReset) onReset(); } });
  const opts = warps.map((w) => ({ value: String(w.value), label: w.label }));
  const speed = warps.length <= 5
    ? segmented({ label, options: opts, value: String(value), onChange: (v) => { state.warp = Number(v); fire(); } })
    : selectCtl({ label, options: opts, value: String(value), onChange: (v) => { state.warp = Number(v); fire(); } });
  function paint() { playBtn.textContent = state.playing ? 'Pause' : 'Play'; }
  const root = el('div', { class: 'field', style: { gap: '10px' } }, row(playBtn, resetBtn), speed.el);
  return {
    el: root,
    set(p = {}) {
      if (p.playing != null) state.playing = !!p.playing;
      if (p.warp != null) { state.warp = p.warp; speed.set(String(p.warp)); }
      paint();
    },
  };
}

/**
 * Simulation clock. t is simulation seconds.
 * @returns {{t:number, tick:(dtReal:number, warp:number, playing:boolean)=>number, reset:(t?:number)=>void}}
 */
export function createClock() {
  const c = {
    t: 0,
    tick(dtReal, warp = 1, playing = true) { if (playing) c.t += dtReal * warp; return c.t; },
    reset(t = 0) { c.t = t; },
  };
  return c;
}
