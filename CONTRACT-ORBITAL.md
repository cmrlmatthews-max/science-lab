# Science Lab — Build Contract, Stage 2: Orbital Mechanics

Every worker reads this file first. It is the source of truth for file ownership and interfaces.
Stage 1 (Envelope Lab) is finished and live. **Do not change Stage 1 behavior.** Reuse `shared/style.css`, `shared/ui.js`, `shared/scene.js` as they are (read the comment block at the top of `shared/style.css`, and the JSDoc in `ui.js` / `scene.js`).

## 0. Ground rules

- Static site, ES modules, no build step, no runtime dependencies. Three.js r170 is vendored (`vendor/`), import map as in `envelope/index.html`.
- Look: the existing neutral "analysis software" style (cool grays, one blue accent, sentence-case labels, system sans, monospace numbers, hairline borders). No new accent colors. Light and dark themes via `prefers-color-scheme`.
- **Level: concept.** Plain results and plain words. No equations in the main UI. A formula may appear only inside a source tag popover (e.g. "Vis-viva equation").
- **Units: metric.** km, km/s, and time in s / min / h / days (pick the readable one). No miles.
- UI text: short plain words, sentence case, no contractions.
- Selection or any control change must **never move the camera** (frame once at mount and when the central body or the preset scale changes a lot).
- Pure modules (`bodies.js`, `physics.js`) have no DOM and no Three.js and run in Node 22 (`node --test tests/orbital-*.test.mjs`).
- Only edit files you own. Never edit `CONTRACT*.md`. Do not commit or push.
- Targets: iPhone (Home Screen web app), iPad, Mac. Touch targets ≥ 44 px on narrow screens (the shared CSS already does this for ui.js controls).

## 1. Files and owners

```
orbital/index.html        shell page (same structure as envelope/index.html)         (C2)
orbital/main.js           store, mode switch, panel tabs                              (C2)
orbital/space.js          shared 3D + time helpers for the three modes                (C2)
orbital/bodies.js         real body data                                              (A2)
orbital/physics.js        two-body orbital mechanics (pure)                           (A2)
orbital/mode-launch.js    Launch mode                                                 (D2)  (C2 writes a stub)
orbital/mode-orbits.js    Orbits mode                                                 (E2)  (C2 writes a stub)
orbital/mode-transfer.js  Transfer mode                                               (F2)  (C2 writes a stub)
tests/orbital-physics.test.mjs                                                        (A2)
index.html (hub)          enable the Orbital Mechanics card → link `orbital/`         (C2)
sw.js                     add the orbital files to FILES, bump CACHE to v5            (C2)
README.md                 add a short Stage 2 section                                 (C2)
```
Modes may add files named `orbital/launch-*.js`, `orbital/orbits-*.js`, `orbital/transfer-*.js` and must report them (they go in `sw.js`).

## 2. Part A2 — data and physics

### 2.1 `orbital/bodies.js`

```js
export const G0 = 9.80665e-3;            // km/s², standard gravity (for rocket equation)
export const AU = 149597870.7;           // km
export const BODIES = {
  earth: { id:'earth', name:'Earth', mu:398600.4418, radius:6378.137, atmosphere:100, rotationHours:23.934, color:'#3f7fbf', color2:'#5c9a6a', parent:'sun',  orbitRadius:149597870.7, source:'NASA Planetary Fact Sheet' },
  moon:  { id:'moon',  name:'Moon',  mu:4902.800,    radius:1737.4,   atmosphere:0,   rotationHours:655.7,  color:'#9a9a96', color2:'#77777a', parent:'earth', orbitRadius:384400,      source:'NASA Planetary Fact Sheet' },
  mars:  { id:'mars',  name:'Mars',  mu:42828.37,    radius:3396.2,   atmosphere:80,  rotationHours:24.62,  color:'#b5593a', color2:'#8f4a34', parent:'sun',  orbitRadius:227939366,   source:'NASA Planetary Fact Sheet' },
  sun:   { id:'sun',   name:'Sun',   mu:1.32712440018e11, radius:695700, atmosphere:0, rotationHours:609,  color:'#e8b54a', color2:'#d99a2b', parent:null,   orbitRadius:0,           source:'NASA Sun Fact Sheet' },
};
// mu in km³/s², radius in km (equatorial), atmosphere = height in km below which an orbit is not stable (0 = none).
export const BODY_ORDER = ['earth','moon','mars','sun'];
export const ORBIT_PRESETS = {      // altitudes above the surface, km (periapsis, apoapsis); for the Sun: distance from the Sun's CENTER minus radius
  earth: [ {id:'iss', name:'Space station', pe:400, ap:400}, {id:'gps', name:'GPS', pe:20200, ap:20200}, {id:'geo', name:'Geostationary', pe:35786, ap:35786}, {id:'molniya', name:'Molniya', pe:500, ap:39873}, {id:'moon', name:'Moon distance', pe:378022, ap:378022} ],
  moon:  [ {id:'llo', name:'Low lunar orbit', pe:100, ap:100}, {id:'apollo', name:'Apollo parking orbit', pe:110, ap:110}, {id:'frozen', name:'High ellipse', pe:100, ap:6000} ],
  mars:  [ {id:'lmo', name:'Low Mars orbit', pe:300, ap:300}, {id:'phobos', name:'Phobos distance', pe:5981, ap:5981}, {id:'deimos', name:'Deimos distance', pe:20067, ap:20067}, {id:'areo', name:'Areostationary', pe:17032, ap:17032} ],
  sun:   [ {id:'mercury', name:'Mercury orbit', peR:46.0e6, apR:69.8e6}, {id:'venus', name:'Venus orbit', peR:107.5e6, apR:108.9e6}, {id:'earth', name:'Earth orbit', peR:147.1e6, apR:152.1e6}, {id:'mars', name:'Mars orbit', peR:206.6e6, apR:249.2e6} ],   // peR/apR = distance from center, km
};
export const TRANSFER_PRESETS = {   // circular-to-circular; r values are distance from the body's CENTER in km unless alt is given
  earth: [ {id:'leo-geo', name:'Low orbit to geostationary', alt1:300, alt2:35786}, {id:'leo-gps', name:'Low orbit to GPS', alt1:300, alt2:20200}, {id:'leo-moon', name:'Low orbit to Moon distance', alt1:300, r2:384400} ],
  moon:  [ {id:'llo-high', name:'Low orbit to high orbit', alt1:100, alt2:5000} ],
  mars:  [ {id:'lmo-phobos', name:'Low orbit to Phobos distance', alt1:300, alt2:5981}, {id:'lmo-deimos', name:'Low orbit to Deimos distance', alt1:300, alt2:20067} ],
  sun:   [ {id:'earth-mars', name:'Earth orbit to Mars orbit', r1:149597870.7, r2:227939366}, {id:'earth-venus', name:'Earth orbit to Venus orbit', r1:149597870.7, r2:108208000} ],
};
```
Preset distances for moons and planets other than the checked Earth/Moon/Mars values are standard reference values from memory; give those presets `approx: true`.

### 2.2 `orbital/physics.js` (all pure; state vectors are 2D `[x, y]` in the orbit plane, km and km/s; angles in radians unless a name ends in `Deg`)

```js
export function circularSpeed(mu, r)              // km/s
export function escapeSpeed(mu, r)                // km/s
export function visViva(mu, r, a)                 // speed at distance r on an orbit with semi-major axis a (a < 0 or Infinity allowed)
export function period(mu, a)                     // s (a > 0)
export function elementsFromApsides(mu, rp, ra)   // -> { a, e, rp, ra, period, vp, va, energy, h }
export function elementsFromState(mu, r, v)       // r=[x,y], v=[vx,vy] -> { a, e, rp, ra (Infinity if e>=1), period (Infinity if e>=1), energy, h (signed, + = counter-clockwise),
                                                  //   argPeri (angle of periapsis from +x), nu (true anomaly now), type: 'ellipse'|'parabola'|'hyperbola' }
export function classifyTrajectory(body, el)      // -> 'impact' (rp < body.radius) | 'decay' (rp < body.radius + body.atmosphere) | 'orbit' | 'escape' (e >= 1)
export function launchState(body, altKm, speed, angleDeg)   // start on the +y axis at radius R+alt; angleDeg 0 = horizontal (toward +x), 90 = straight up
                                                  // -> { r:[0, R+alt], v:[speed*cos, speed*sin] }
export function solveKepler(M, e)                 // eccentric anomaly E for elliptic orbits (Newton, |err| < 1e-12)
export function positionAtTime(mu, el, t)         // elliptic: -> { r:[x,y], v:[vx,vy], nu, rMag, speed } at t seconds after periapsis passage (uses el.argPeri and sign of el.h)
export function timeSincePeriapsis(mu, el, nu)    // s, elliptic
export function propagate(mu, r, v, dt)           // one universal step: returns new { r, v } after dt seconds for ANY conic (ellipse or hyperbola).
                                                  // Use an exact method (universal variables / Kepler) OR RK4 with internal sub-steps small enough that
                                                  // energy drift over one LEO period is < 1e-6 relative.
export function samplePath(mu, el, n, opts)       // -> array of [x,y] points along the conic. Ellipse: full closed loop (n points, denser near periapsis is fine).
                                                  // Hyperbola/parabola: from nu=-nuMax to +nuMax limited to opts.rMax. opts.fromNu/toNu limits the arc.
export function impactPoint(body, el, startNu)    // first true anomaly after startNu (in the direction of motion) where r = body.radius, plus time to reach it -> { nu, t, r:[x,y] } | null
export function hohmann(mu, r1, r2)               // -> { dv1, dv2, total, time (s), aT, eT, v1, v2, vT1 (speed on transfer orbit at r1), vT2, direction: 'up'|'down' }
                                                  // dv values are magnitudes (always >= 0). Works for r2 < r1 too.
export function propellantFraction(dv, ispSeconds)// rocket equation: 1 - exp(-dv / (isp * G0)), dv in km/s
export function formatDuration(seconds)           // -> { value, unit } choosing s (<120), min (<180 min), h (<72 h), days
```

Check values (tests must assert, relative tolerance 1e-3 unless stated):
- Surface: Earth circular 7.9054, escape 11.1799. Moon 1.6799 / 2.3757. Mars 3.5512 / 5.0221. Sun escape 617.67.
- Earth, 400 km: circular 7.6686 km/s, period 5553.6 s (92.56 min), escape 10.845.
- Geostationary radius 42164 km: speed 3.0747, period 23.934 h.
- Ellipse Earth 500 × 39873 km altitude: a 26564.6, e 0.7411, period 11.969 h, vp 10.0448, va 1.4938.
- Launch Earth, 400 km, horizontal, 7.0 km/s: a 5809.4, e 0.1668, periapsis altitude −1537.6 → 'impact'. At 9.0 km/s: a 10886.7, e 0.3774, periapsis altitude 400.0, apoapsis altitude 8617.1, period 3.140 h → 'orbit'. At 10.9 km/s → 'escape'. At 7.6686 → circular (e < 1e-3).
- Hohmann Earth 300 km → 42164 km radius: dv1 2.4257, dv2 1.4668, total 3.8926, time 5.275 h.
- Hohmann Earth 300 km → 384400 km: dv1 3.1064, dv2 0.8301, total 3.9365, time 4.98 days.
- Hohmann Sun, Earth orbit → Mars orbit (r2 = 1.523679 AU = 227939366 km): dv1 2.9447, dv2 2.6489, total 5.5936, time 258.9 days. Earth orbit period 365.257 days, speed 29.785.
- propellantFraction(3.8933, 450) = 0.5861; (3.8933, 300) = 0.7338.
- positionAtTime: after exactly one period the position returns to periapsis (1e-6 relative); at half a period it is at apoapsis.
- propagate: 1000 steps around one LEO period returns to the start within 1 km; energy conserved to 1e-6; a hyperbolic case (10.9 km/s at 400 km) keeps energy to 1e-6 and r grows monotonically after periapsis.
- samplePath for an ellipse: every point satisfies the conic equation r = a(1−e²)/(1+e cos ν) to 1e-6.

## 3. Part C2 — shell, shared helpers, hub

### 3.1 `orbital/index.html` + `orbital/main.js`
Copy the structure of `envelope/index.html` and `envelope/main.js` (same regions `#stage`, `#panel-a/b/c`, `#summary`, same mode-tab behavior, same ctx shape, hash routing `#launch` / `#orbits` / `#transfer`, service-worker registration with a relative path). Title "Orbital Mechanics", back link "Lab" → `../index.html`.

```js
initialState = {
  mode: 'launch',
  bodyId: 'earth',
  time: { playing: true, warp: 1 },      // warp is a multiplier chosen by the mode's time control
  launch:   { alt: 400, speed: 7.67, angleDeg: 0 },
  orbits:   { pe: 400, ap: 400, presetId: 'iss', showVelocity: true, showAreas: false },
  transfer: { alt1: 300, r2: 42164, presetId: 'leo-geo', isp: 450, phase: 'orbit1' },
}
// ctx = { stageEl, panelA, panelB, panelC, summaryEl, store, stage, isNarrow() }   (same as Envelope Lab)
// mode module: export default { id, label, panelTitles:{a,b,c}, mount(ctx), unmount() }
```

### 3.2 `orbital/space.js` — helpers the three modes share

```js
import { THREE } from '../shared/scene.js';
export function sceneScale(extentKm)                 // -> km per scene unit so that extentKm maps to ~100 scene units
export function createBody(body, kmPerUnit, opts)    // -> { group, setScale(kmPerUnit), dispose() }
      // A shaded sphere in body.color with a subtle latitude/longitude graticule (thin lines), a faint atmosphere shell when body.atmosphere > 0,
      // and a slow visual rotation hook `group.userData.spin(dt)`. opts.minRadiusUnits: draw at least this big and report `exaggerated: true`
      // (used for the Sun, which is tiny next to planet orbits). No image textures.
export function createPath(points /* [[x,y],...] km */, kmPerUnit, opts /* {color, dashed, opacity, closed, width} */) -> { object, setPoints(points), dispose() }
      // Orbit plane = scene XZ plane (y up): km [x, y] -> scene (x, 0, -y). A crisp line (Line2-free: THREE.Line / LineLoop is fine).
export function createCraft(opts /* {color, size} */) -> { object, setPosition([x,y] km, kmPerUnit), dispose() }
      // A small marker that stays a constant size on screen (sprite or scaled each frame), with an optional short trail.
export function createArrow(opts /* {color} */) -> { object, set(originKm [x,y], vectorKm [x,y], kmPerUnit, lengthUnits), dispose() }   // velocity vector
export function createMarker(label, opts) -> { object, setPosition([x,y] km, kmPerUnit), setLabel(text), dispose() }   // dot + small label sprite (quiet style, sentence case, NOT all caps)
export function createStars(count)                   // -> THREE.Points, very subtle, fixed; hidden in light theme if it looks dirty
export function toScene([x, y], kmPerUnit)           // -> THREE.Vector3
export function timeControl({ warps:[{value,label}], value, playing, onChange({playing, warp}), onReset }) -> { el, set({playing, warp}) }
      // A compact control row built from shared/ui.js helpers: play/pause button, a "Speed" segmented or select with the warps, and a "Restart" button.
export function createClock()                        // -> { t, tick(dtReal, warp, playing) } simulation seconds accumulator
```
Label sprites in this module are quiet: sentence case, system sans, regular weight (do not use the bold all-caps look of Envelope Lab's 3D labels; write a local sprite helper if `makeLabelSprite` upper-cases).

### 3.3 Stubs, hub, service worker, README
- Stub `mode-*.js` files: each shows the Earth from `createBody`, one circular orbit path and a moving craft using `physics.js` + `space.js` + `timeControl`, and a few ui.js controls in each panel. This proves the helpers.
- Hub `index.html`: make the Orbital Mechanics card a live link to `orbital/` (same card style as Envelope Lab, short description "Launch, orbits, and transfers around real bodies."). Leave the other two cards as "not built".
- `sw.js`: add every `orbital/*` file (including the three mode files) to FILES; bump CACHE to `science-lab-v5`.
- `README.md`: add a short "Stage 2: Orbital Mechanics" section (three modes in a small table, units metric, sources: NASA Planetary Fact Sheet).

## 4. Parts D2, E2, F2 — the three modes (wave 2; details in each worker brief)
