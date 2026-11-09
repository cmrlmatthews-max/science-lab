# Science Lab — Build Contract (Envelope Lab, Stage 1)

Every worker reads this file first. It is the single source of truth for file ownership and interfaces.
Do not change an interface. If an interface is wrong, keep it working and write a note in your final report.

## 0. Ground rules

- Static web app. **No build step, no framework, no npm dependencies at runtime.** Plain ES modules.
- Three.js r170 is already vendored: `vendor/three.module.min.js`, `vendor/OrbitControls.js`.
  Every HTML page that uses 3D has this import map (path relative to the page):
  ```html
  <script type="importmap">{"imports":{"three":"../vendor/three.module.min.js","three/addons/controls/OrbitControls.js":"../vendor/OrbitControls.js"}}</script>
  ```
- Physics/rule modules (`materials.js`, `walls.js`, `physics.js`, `vapor.js`, `bridge.js`, `water.js`) are **pure**: no DOM, no Three.js, no imports outside `envelope/`. They must run in Node 22 (`node --test tests/`).
- Units: IP only. Lengths in **inches**. Temperatures in **°F**. R in h·ft²·°F/Btu. 3D scene: **1 unit = 1 inch**.
- Scene axes: **x** = along the wall, **y** = up, **z** = through the wall. Interior face of the wall at z = 0. Exterior is +z.
- Only edit files you own (section 1). Never edit `CONTRACT.md`.
- Target devices: iPhone, iPad, Mac (Safari first). Touch and mouse. Must work offline after first load.
- All text in the UI: short, plain words. No contractions.
- Selection of an object must **never move the camera**.

## 1. File ownership

```
science-lab/
  index.html                hub page                               (C)
  manifest.json, sw.js, icons/                                     (C)
  vendor/                   already present — do not edit
  shared/style.css          design tokens + layout + components    (C)
  shared/scene.js           Three.js stage helper                  (C)
  shared/ui.js              DOM helpers + controls                 (C)
  envelope/index.html       app shell                              (C)
  envelope/main.js          store, mode switch, panel tabs         (C)
  envelope/materials.js     material library + permeance           (A)
  envelope/walls.js         presets W1–W4                          (A)
  envelope/physics.js       heat + dew point                       (A)
  envelope/vapor.js         vapor retarder rules                   (A)
  envelope/bridge.js        2D thermal bridge solver               (B)
  envelope/water.js         water rules (pure data + logic)        (F)
  envelope/mode-assembly.js Assembly mode UI + 3D                  (D)  (C writes a stub)
  envelope/mode-bridge.js   Thermal Bridge mode UI + 3D            (E)  (C writes a stub)
  envelope/mode-water.js    Water mode UI + 3D                     (F)  (C writes a stub)
  tests/physics.test.mjs, tests/vapor.test.mjs                     (A)
  tests/bridge.test.mjs                                            (B)
  tests/water.test.mjs                                             (F)
```

## 2. Part A — data and physics

### 2.1 `envelope/materials.js`

```js
export const MATERIALS = {
  // key === id
  gyp_050: {
    id: 'gyp_050', name: 'Gypsum board, 1/2"',
    rFixed: 0.45,            // R for the stated thickness  (use rFixed OR rPerInch)
    // rPerInch: 5.0,
    thickness: 0.5,          // default thickness, inches
    thicknessOptions: null,  // or [1, 1.5, 2, 3, 4] when the user can change it
    permInch: null,          // perm·inch (divide by thickness to get perms) or null
    permFixed: 50,           // perms for the stated thickness or null
    color: '#e9e4d8',        // base color for 3D and legend
    control: 'finish',       // 'finish' | 'structure' | 'thermal' | 'water' | 'air' | 'vapor' | 'cladding' | 'airspace'
    category: 'board',       // 'board' | 'batt' | 'rigid' | 'masonry' | 'membrane' | 'cladding' | 'airspace' | 'framing'
    source: 'BCI 7.40',      // short source tag shown in the UI
  },
  ...
};
export const FILMS = { interior: {r:0.68, source:'Archtoolbox'}, exteriorWinter: {r:0.17,...}, exteriorSummer: {r:0.25,...} };
export const STEEL_STUD_EFFECTIVE_R = {
  // key: `${depth}|${nominalR}|${spacing}`; depth 3.5 or 6
  '3.5|11|16': 5.5, '3.5|13|16': 6.0, '3.5|15|16': 6.4, '3.5|11|24': 6.6, '3.5|13|24': 7.2, '3.5|15|24': 7.8,
  '6|19|16': 7.1, '6|21|16': 7.4, '6|19|24': 8.6, '6|21|24': 9.0,
};  // source: 'ASHRAE 90.1 App. A (via Masonry Advisory Council)'
export const WOOD_FRAMING_FACTOR = { 16: 0.25, 24: 0.22 };   // source tag: 'ASHRAE typical (not checked)'
export function materialR(materialId, thickness)  // -> number
export function materialPerms(materialId, thickness) // -> number | null
```

Required materials (id → values):

| id | name | R | thickness | perm | control | source |
|---|---|---|---|---|---|---|
| gyp_050 | Gypsum board, 1/2" | 0.45 fixed | 0.5 | 50 fixed | finish | BCI 7.40 |
| gyp_063 | Gypsum board, 5/8" | 0.56 fixed | 0.625 | 40 fixed | finish | Archtoolbox |
| gyp_sheath | Exterior gypsum sheathing, 5/8" | 0.56 fixed | 0.625 | 40 fixed | structure | Archtoolbox |
| osb | OSB sheathing, 7/16" | 0.62 fixed | 0.4375 | 2 fixed | structure | Archtoolbox |
| plywood | Plywood, 1/2" | 0.62 fixed | 0.5 | 1 fixed | structure | BCI 7.40 |
| batt_r13 | Fiberglass batt R-13 | 13 fixed | 3.5 | 30 fixed | thermal | Archtoolbox |
| batt_r19 | Fiberglass batt R-19 | 19 fixed | 6 | 30 fixed | thermal | Archtoolbox |
| batt_r21 | Fiberglass batt R-21 | 21 fixed | 5.5 | 30 fixed | thermal | Archtoolbox |
| minwool | Mineral wool board | 4.0 /in | 2 (opts 1,1.5,2,3,4) | 30 perm·in | thermal | Archtoolbox |
| xps | XPS board | 5.0 /in | 2 (opts 1,1.5,2,3,4) | 1.2 perm·in | thermal | Archtoolbox · BCI 7.45 |
| eps | EPS board | 3.8 /in | 2 (opts 1,1.5,2,3,4) | 2.0 perm·in | thermal | Archtoolbox · BCI 7.45 |
| polyiso | Polyiso board, foil face | 6.0 /in | 2 (opts 1,1.5,2,3,4) | 0.05 fixed | thermal | Archtoolbox |
| ccspf | Closed-cell spray foam | 6.0 /in | 2 (opts 1,2,3) | 1.0 perm·in | thermal | Archtoolbox |
| airspace | Air space | 0.97 fixed | 2 (opts 1,2,3) | null | airspace | Archtoolbox |
| wrb | Water-resistive barrier | 0 fixed | 0.03 | 30 fixed | water | — |
| brick | Face brick, 3-5/8" | 0.11 /in | 3.625 | 0.8 fixed | cladding | BCI 7.40 |
| cmu8 | CMU, 8" | 1.11 fixed | 7.625 | 2.4 fixed | structure | BCI 7.40 |
| concrete | Concrete, sand and gravel | 0.08 /in | 8 (opts 6,8,10,12) | 3.2 perm·in | structure | BCI 7.40 |
| fibercement | Fiber-cement siding | 0.15 fixed | 0.3125 | 1.5 fixed | cladding | Archtoolbox |
| vinyl | Vinyl siding | 1.00 fixed | 0.5 | 70 fixed | cladding | BCI 7.40 |
| stucco | Stucco, 7/8" | 0.18 fixed | 0.875 | 5 fixed | cladding | not checked |
| softwood | Softwood framing | 1.25 /in | — | — | structure (category framing) | BCI 7.40 |
| steel | Steel | 0.0032 /in | — | — | structure (category framing) | BCI 7.40 |
| aluminum | Aluminum | 0.0007 /in | — | — | structure (category framing) | BCI 7.40 |

Perm values not from BCI 7.45 are approximate; give them `permSource: 'approximate'`. Pick distinct, bold, readable colors (batt pink/yellow, XPS blue, mineral wool olive-brown, brick red, OSB tan, CMU grey, WRB white-teal, etc.).

### 2.2 `envelope/walls.js`

```js
export const WALLS = {
  W1: { id:'W1', name:'Wood stud, base', short:'2x6 wood stud',
        layers: [   // interior -> exterior, no air films
          { materialId:'gyp_050', thickness:0.5 },
          { materialId:'batt_r21', thickness:5.5, framing:{ type:'wood', spacing:16, depth:5.5, nominalR:21 } },
          { materialId:'osb', thickness:0.4375 },
          { materialId:'wrb', thickness:0.03 },
          { materialId:'fibercement', thickness:0.3125 },
        ] },
  W2: ..., W3: ..., W4: ...
};
export function cloneWall(wallId) // deep copy, safe to edit
```

- W2 = W1 + `xps` 2" between `wrb`... order interior→exterior: gyp_050, batt_r21 (wood framing), osb, wrb, xps 2", fibercement.
- W3: gyp_063, batt_r19 (framing type 'steel', spacing 16, depth 6, nominalR 19), gyp_sheath, wrb, minwool 2", airspace 2", brick.
- W4: gyp_050, cmu8, wrb, xps 2", airspace 2", brick.

### 2.3 `envelope/physics.js`

```js
export function dewPoint(tF, rhPct)            // Magnus: a=17.625, b=243.04 °C. Returns °F.
export function conductionLoss(u, areaSf, dT)   // Btu/h = U·A·ΔT
export function infiltrationLoss(cfm, dT)       // Btu/h = 1.08·CFM·ΔT
export const CLIMATE_PRESETS = {
  bci:        { id:'bci',   name:'BCI drawing',        tIn:70, rhIn:30, tOut:0,  rhOut:70 },
  cold:       { id:'cold',  name:'Cold winter',        tIn:70, rhIn:35, tOut:0,  rhOut:70 },
  mixed:      { id:'mixed', name:'Mixed winter',       tIn:70, rhIn:35, tOut:20, rhOut:70 },
  hothumid:   { id:'hothumid', name:'Hot-humid summer',tIn:75, rhIn:50, tOut:95, rhOut:55 },
};
export function analyzeWall(wall, climate) -> {
  rTotal,          // effective whole-wall R including films (parallel path for wood, effective R for steel)
  uFactor,         // 1 / rTotal
  q,               // Btu/h·ft² = |tIn - tOut| / rTotal
  rCavityPath,     // series R through the cavity (wood) — equals the profile path
  rFramePath,      // series R through the stud (wood) or null
  rNominal,        // series R using nominal batt R (ignores framing)
  framingLossPct,  // (rNominal - rTotal) / rNominal * 100
  season,          // 'winter' when tIn >= tOut else 'summer'
  warmSide,        // 'interior' | 'exterior'
  dewPointF,       // dew point of the warm-side air
  layers: [ { index, materialId, name, thickness, r, rSource, zIn, zOut, tIn, tOut, framing|null } ],
                   // r = R used on the PROFILE path (cavity R for wood, effective R for steel)
                   // zIn/zOut = inches from interior face; tIn/tOut = temperature at inner/outer face
  faces: [ { index, z, tempF, label, belowDew } ],
                   // index 0 = interior surface (after the interior film) ... last = exterior surface
  profile: [ { z, tempF } ],   // polyline incl. room air (z=-1) and outside air (z=total+1)
  dewPlane: { z, layerIndex } | null,     // where the profile crosses the dew point (linear in R within a layer)
  condensation: { faceIndex, z, tempF, label, materialId } | null,
                   // first face, going from the warm side to the cold side, that is at or past the dew plane
                   // AND is the surface of a non-insulating layer (category not batt/rigid/airspace/membrane). null if none.
                   // It also carries `outsideWrb: boolean` — true when the face is on the exterior side of the 'wrb' layer
                   // (winter) i.e. in the drained zone. 
  risk,            // boolean: condensation !== null && !condensation.outsideWrb
                   // (W1, W2 mixed winter: risk true at OSB. W3, W4 mixed winter: risk false.)
                   // Summer (warm side exterior): walk from exterior to interior; `outsideWrb` is false for every face
                   // inboard of the wrb; risk = condensation !== null.
  totalThickness,
}
```

Rules:
- Exterior film: 0.17 in winter, 0.25 in summer. Interior film 0.68.
- Wood framing: `rTotal = 1 / ((1-f)/Rcav + f/Rframe)`, f from `WOOD_FRAMING_FACTOR[spacing]`, Rframe uses softwood 1.25 × depth in place of the batt. Temperature profile uses the **cavity path**.
- Steel framing: batt R is replaced by `STEEL_STUD_EFFECTIVE_R` (fallback when no key: 0.40 × nominal for 16", 0.47 × nominal for 24"). Profile uses that series path. `rSource` says which.
- A layer with no framing: plain series.

Check values (tests must assert these, tolerance ±0.01 for R, ±0.0001 for U, ±0.1 for °F):

Mixed winter (70/35% in, 20 out), dew point 41.1:
| Wall | rTotal | U | q | key face | condensation |
|---|---|---|---|---|---|
| W1 | 16.54 | 0.0605 | 3.02 | OSB inner face 22.0°F | yes, at OSB |
| W2 | 27.87 | 0.0359 | 1.79 | OSB inner face 36.5°F | yes, at OSB |
| W3 | 18.44 | 0.0542 | 2.71 | gyp_sheath inner face 47.4°F | none inside the stud zone (sheathing inner face is above dew point) |
| W4 | 13.78 | 0.0726 | 3.63 | CMU inner face 65.9°F | (whatever the rule gives; assert the CMU face temp only) |

W1: rCavityPath 23.07, rFramePath 8.945 (≈8.95). W3: rNominal 30.34, framingLossPct ≈ 39.2.
BCI preset (70/30% in, 0 out): dew point 37.1; W1 OSB inner face 2.9°F; W2 OSB inner face 23.2°F.
dewPoint(70,50)=50.5; dewPoint(95,55)=76.3.
conductionLoss(1/16.54, 100, 50) ≈ 302; infiltrationLoss(10, 50) = 540.

### 2.4 `envelope/vapor.js`

```js
export const VAPOR_CLASSES = { none:{...}, I:{name:'Class I', perms:'0.1 or less', examples:'Sheet polyethylene, aluminum foil'}, II:{... 'Above 0.1, up to 1.0', 'Kraft-faced batts, some paints'}, III:{... 'Above 1.0, up to 10.0', 'Latex or enamel paint'} };
export const CLIMATE_ZONES = [ {id:'1',name:'Zone 1'}, ..., {id:'4M',name:'Marine 4'}, ..., {id:'8',name:'Zone 8'} ]; // order 1,2,3,4,4M,5,6,7,8
export function checkVaporRetarder({ cls, zone, wall }) -> {
  ok: boolean,
  warnings: [ { code, text } ],   // codes: 'ZONE_NO_I_II' | 'ZONE_NO_I' | 'ZONE_NEEDS_I_II' | 'FOAM_CLASS_III_ONLY'
  notes: [ string ],              // e.g. 'Put the vapor retarder on the warm side of the insulation.'
  foam: { materialId, perms } | null,   // exterior foam layer found outside the framed/structural layer with perms < 1
  source: 'BCI 7.46',
}
```
Rules (BCI 7.46, interior side of a FRAME wall — apply only when the wall has a framed layer; for W4 return ok with a note "The class rules in BCI 7.46 are for frame walls."):
- Zones 1, 2: Class I or II → warning ZONE_NO_I_II.
- Zones 3, 4: Class I → warning ZONE_NO_I.
- Zones 4M, 5, 6, 7, 8: cls none or III → warning ZONE_NEEDS_I_II. **Exception:** when the foam rule below applies, do not raise ZONE_NEEDS_I_II for Class III.
- Any zone: exterior rigid foam (category 'rigid') outside the framing with `materialPerms < 1` and cls I or II → warning FOAM_CLASS_III_ONLY.
Tests: W1 zone 5 none → warning; W1 zone 2 Class I → warning; W2 (2" XPS = 0.6 perm) any zone Class I or II → FOAM warning; W1 zone 3 Class II → ok.

## 3. Part B — `envelope/bridge.js` (2D steady-state conduction)

```js
export const DETAILS = {
  stud:  { id:'stud',  name:'Stud in wall',  blurb, variants:[ {id:'wood', name:'Wood stud'}, {id:'steel', name:'Steel stud'}, {id:'steel_ci', name:'Steel stud + 2" continuous insulation'} ] },
  slab:  { id:'slab',  name:'Slab edge',     blurb, variants:[ {id:'through', name:'Slab through the insulation'}, {id:'break', name:'Slab with a thermal break'} ] },
  shelf: { id:'shelf', name:'Shelf angle',   blurb, variants:[ {id:'continuous', name:'Continuous steel angle'}, {id:'standoff', name:'Angle on standoff brackets'} ] },
};
export const BRIDGE_MATERIALS = { id: { name, k /* Btu·in/(h·ft²·°F) = 1 / R-per-inch */, color } };
export function solveBridge(detailId, variantId, climate /* {tIn, tOut, rhIn} */, opts = {}) -> {
  detailId, variantId,
  nx, ny,              // grid size. i (0..nx-1) runs along the section's "along the wall" axis (plan: x; vertical section: y).
                       // j (0..ny-1) runs THROUGH the wall, interior (j=0) to exterior (j=ny-1).
  cell,                // cell size in inches (square cells)
  widthIn, depthIn,    // nx*cell, ny*cell
  orientation,         // 'plan' (stud) | 'section' (slab, shelf) — tells the UI how to draw it
  temps,               // Float32Array(nx*ny), index = j*nx + i, °F
  mats,                // Uint8Array(nx*ny) index into `palette`
  palette,             // [ { id, name, color, k } ]
  interiorSurface,     // Float32Array(nx) temperature of the interior surface along i
  minInteriorT, minInteriorAt /* i index */, avgInteriorT,
  q,                   // average heat flow through the section, Btu/h·ft² of wall
  qClear,              // same wall with the bridge material replaced by the clear-field material
  rEffective, rClear,  // (tIn - tOut)/q , (tIn - tOut)/qClear
  increasePct,         // (q - qClear)/qClear*100
  dewPointF, condensationRisk,   // minInteriorT < dewPoint(tIn, rhIn)
  iterations, converged,
}
```
- Finite-volume grid, harmonic-mean conductance between cells, film boundary conditions (interior h = 1/0.68, exterior h = 1/0.17), adiabatic on the two i-edges (symmetry). Gauss-Seidel/SOR until max change < 1e-4 °F or an iteration cap. Each solve must finish in **under 150 ms** in Node on a laptop (keep nx·ny ≤ ~12,000; use a typed-array SOR; warm-start is fine).
- Thin steel (stud web/flanges, angle legs) may be thinner than a cell: use one cell with `k_eff = k_steel × (real thickness / cell)`. Note the method in a comment.
- Geometry (keep simple, document dimensions in comments):
  - **stud** (plan cut, 16" wide = one stud bay centered on the stud): 5/8" gypsum · 6" cavity with R-19 batt (k = 6/19) and a stud at center (wood: 1.5" solid softwood; steel: C-shape, 18 ga ≈ 0.045" web + 1.625" flanges at both faces) · 5/8" gypsum sheathing · (steel_ci: + 2" mineral wool) · 1/2" cladding stand-in (R≈0.15 total). 
  - **slab** (vertical cut, ~40" tall): interior gypsum + 6" steel-stud zone modeled as an effective R-7.1 layer + sheathing + 2" mineral wool continuous insulation + air space + brick; an 8" concrete slab crosses the wall. 'through': the slab runs out to the brick line (balcony-style, cuts the insulation). 'break': a 2"-thick thermal break (R ≈ 5/in... use k = 0.2... document) in line with the insulation, with steel bars modeled as a small k_eff increase.
  - **shelf** (vertical cut, ~32" tall): same wall; slab edge stops at the sheathing line. 'continuous': a 3/8" steel angle leg crosses the full 2" insulation along the whole length (2D-continuous). 'standoff': brackets at 48" o.c. — model as the angle leg with `k_eff` scaled by the bracket fraction (e.g. 4" of bracket per 48") so the insulation is mostly continuous.
- Tests (`tests/bridge.test.mjs`): (1) a no-bridge check — expose `solveClearWall(layers, climate)` or an option so a uniform layered wall gives q within 1% of ΔT/ΣR; (2) steel stud q > wood stud q > clear; (3) steel_ci minInteriorT > steel minInteriorT; (4) 'break' q < 'through' q; (5) 'standoff' q < 'continuous' q; (6) all temps between tOut and tIn; (7) runtime under 150 ms each.

## 4. Part C — shell, shared code, hub

### 4.1 `shared/scene.js`

```js
import * as THREE from 'three';
export { THREE };
export function createStage(containerEl, opts = {}) -> {
  THREE, scene, camera /* PerspectiveCamera */, renderer, controls /* OrbitControls: one finger rotate, two finger zoom/pan, damping */,
  requestRender(),                // render on demand (call after any change)
  onFrame(fn) -> unsubscribe,     // fn(dtSeconds, tSeconds) every animation frame while subscribed; rendering happens automatically
  frame(box3OrObject, opts),      // fit camera to an object ONCE (used at mount; never on selection)
  pick(clientX, clientY, objects) -> intersection | null,   // raycast helper
  onTap(fn) -> unsubscribe,       // fn({clientX, clientY}) for a tap/click that was not a drag (moved < 6 px)
  setClipping(planeOrNull),       // global clipping plane on/off (renderer.localClippingEnabled handled)
  theme,                          // { bg, ink, grid, accent } resolved from CSS variables (updates on light/dark change)
  dispose(),
}
```
- Handles resize (ResizeObserver), devicePixelRatio capped at 2, light/dark theme change, WebGL context checks. Soft key light + fill + hemisphere light so flat-colored boxes read well. Transparent/`--stage-bg` background. `preserveDrawingBuffer: false`.
- Also export `makeLabelSprite(text, opts)` (canvas-texture sprite for 3D labels, readable in both themes) and `tempToColor(tF, tMin, tMax)` → `THREE.Color` AND `tempToCss(tF, tMin, tMax)` → css string, using a cold-blue → white-ish → hot-red scale that works in both themes (export the stops as `TEMP_STOPS`).

### 4.2 `shared/ui.js`

```js
export function el(tag, attrs = {}, ...children)        // attrs: class, text, html, dataset, on:{event:fn}, style, any attribute
export function slider({ label, min, max, step, value, unit, format, onInput }) -> { el, set(v), get() }
export function select({ label, options:[{value,label}], value, onChange }) -> { el, set(v), get() }
export function segmented({ label, options:[{value,label}], value, onChange }) -> { el, set(v), get() }
export function toggle({ label, value, onChange }) -> { el, set(v), get() }
export function stat({ label, value, unit, source, warn, hint }) -> { el, update({value, unit, warn, source, hint}) }
        // big number + small label; `source` renders a tappable source tag that opens a small popover with the source text
export function sourceTag(text) -> HTMLElement
export function banner({ kind:'warn'|'ok'|'info', title, text }) -> HTMLElement
export function legend(items:[{color,label}]) -> HTMLElement
export function section(title, ...children) -> HTMLElement   // titled group inside a panel
export function fmt(n, digits)                           // number formatting, tabular
```

### 4.3 `envelope/index.html` + `envelope/main.js`

Shell layout (see design brief below). Regions: header with app title + mode tabs; `#stage` (3D); `#panel-a` (left), `#panel-b` (right), `#panel-c` (bottom strip: graph + climate controls); `#summary` (compact one-line results, phone only).

Wide (≥ 900 px): A left column · stage center · B right column · C full-width bottom.
Phone/narrow: stage on top (about 45% of the height), `#summary` strip, then a bottom sheet with a tab bar that shows ONE of A / B / C at a time (titles come from the mode). The sheet scrolls; the stage does not.

```js
// main.js
export const store = createStore(initialState)   // { get(), set(patch) /* shallow merge + notify */, update(fn), subscribe(fn) -> unsub }
initialState = {
  mode: 'assembly',
  climate: { tIn:70, rhIn:35, tOut:20, rhOut:70 }, climatePreset: 'mixed',
  wallId: 'W1', wall: cloneWall('W1'),
  vapor: { cls:'none', zone:'3' },
  leakCfm: 0, areaSf: 100,
}
```
Mode module interface (default export of each `mode-*.js`):
```js
export default {
  id: 'assembly', label: 'Assembly',
  panelTitles: { a:'Layers', b:'Results', c:'Climate' },
  mount(ctx) {},     // build DOM + 3D
  unmount() {},      // remove listeners, dispose 3D objects (the stage itself is disposed by main.js)
};
// ctx = { stageEl, panelA, panelB, panelC, summaryEl, store, stage /* from createStage(stageEl), fresh per mount */, isNarrow() }
```
`main.js` imports the three mode modules statically, renders the mode tabs, and on switch: `unmount()` old → dispose stage → clear panels → create a fresh stage → `mount(ctx)` new. The URL hash keeps the mode (`#assembly`, `#bridge`, `#water`). C writes **stub** `mode-*.js` files (a spinning box + placeholder text in each panel) so the shell runs; D/E/F replace them.

### 4.4 Hub, PWA

- `index.html`: hub page titled "Science Lab" with four module cards: Envelope Lab (live link `envelope/`), Orbital Mechanics, Molecules and Crystals, Earth Systems (the last three marked "Stage 2/3/4 — not built"). Small CMRLM mark in the footer.
- `manifest.json` (name "Science Lab", display standalone, start_url `./index.html`, theme colors), icons (generate simple PNG icons 180/192/512 with a script — an abstract layered-wall mark; no text needed), `apple-touch-icon`, `apple-mobile-web-app-capable`, viewport with `viewport-fit=cover`, safe-area insets.
- `sw.js`: cache-first for the app shell with a versioned cache name and an explicit file list covering every file in section 1 + vendor; network-first fallback for navigation. Register from both HTML pages with a relative path. Must work when hosted under a sub-path (GitHub Pages: `https://user.github.io/science-lab/`) — **relative URLs only**.

### 4.5 Design brief (C defines tokens in `shared/style.css`; D/E/F use them)

Subject: a building-science study instrument for an architect. Direction: **drafting-table instrument** — warm paper background, ink-dark text and linework, one bold signal color, and the blue→red thermal scale as the only other strong color. Bold, confident color; not pastel, not generic "dashboard".
- Fonts (Apple devices; no web fonts): display/headings `"Avenir Next Condensed", "DIN Condensed", "Arial Narrow", sans-serif` in heavy weight, upper-case, letter-spaced for labels; body `-apple-system, "SF Pro Text", system-ui`; numbers `ui-monospace, "SF Mono", Menlo` with `font-variant-numeric: tabular-nums`. Use real variation in size and weight (large stat numerals, tiny caps labels).
- Tokens as CSS variables on `:root` with a dark theme under `@media (prefers-color-scheme: dark)`: `--paper, --paper-2, --ink, --ink-2, --line, --accent, --warn, --ok, --cold, --hot, --stage-bg, --radius, --gap, --font-display, --font-body, --font-mono`.
- Components: panel, section title, stat, slider (large touch thumb ≥ 28 px), segmented control, select, banner (warn/ok/info), source tag (small pill; tap → popover), legend, tabs, layer row (drag handle, swatch, name, R value, thickness stepper) — define classes `.layer-row`, `.swatch` etc. so D can use them.
- Touch targets ≥ 44 px. Respect `prefers-reduced-motion`. No horizontal page scroll at 375 px width. `touch-action: none` on the stage canvas only.

## 5. Parts D, E, F — mode UIs (wave 2; details in each worker brief)

Each mode owns its `mode-*.js` (may add extra files prefixed `assembly-`, `bridge-`, `water-` inside `envelope/`, and must report them so they are added to `sw.js`).
