# Envelope Lab — Context and clarity pass (build contract)

Every worker reads this file first. It is the source of truth for file ownership and shared interfaces.
Project root: /home/claude/science-lab (git repo — do NOT commit or push). Static site, ES modules, no build step, Three.js r170 vendored.
Envelope Lab is a building-science wall simulator for an architect who studies for the ARE exam. Units IP. It runs on iPhone (Home Screen web app), iPad, Mac.

## What the owner said (verbatim intent)

- "Specifically for the Envelope Lab I want as much context as you can give me."
- "Hovering over a layer could give me more information about that product and its layer, some functionality of the product or the layer."
- "When I look at dew point, what tells me why that is important."
- "We need to update the 3D graphics for both Thermal Bridge and envelope; they are unclear. Maybe adding more detail would help."
- "Thermal Bridging seems incomplete, it is very hard to read."
- From his screenshot of the Assembly wall: no layer has a name on it, the stud reads as a flat plank, the siding is almost hidden, the label "DEW POINT" is bold all-caps and says what it is but not why it matters.

## Rules for all workers

- Only edit files you own. Never edit CONTRACT*.md, shared/*, sw.js, physics/data modules (materials.js, walls.js, physics.js, vapor.js, bridge.js solver math, water.js rules) or tests you do not own.
- All numbers and calculations stay exactly as they are. `node --test tests/*.test.mjs` must still pass (212, plus any you add).
- Screen chrome stays the neutral "analysis software" style from shared/style.css (cool grays, one blue accent, sentence case, system sans). No bold all-caps labels anywhere, including 3D labels.
- UI text: short plain sentences, sentence case, no contractions. Generic product types, not brands ("self-adhered membrane", "housewrap"); a brand name only where it is the common word for the thing.
- Hover on Mac (pointer: fine) and tap on iPhone/iPad (pointer: coarse) must both work. Selection, hover and cards never move the camera.
- Report every new file (goes into sw.js).
- Verify with Playwright (Node module /opt/npm-tools/node_modules/playwright; chromium.launch({executablePath:'/usr/bin/google-chrome', args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']}); contexts with serviceWorkers:'block'), screenshots at 390×844 (deviceScaleFactor 2, hasTouch, isMobile), 820×1180, 1440×900, light and dark, and LOOK at them. Scratch files go under /tmp/claude-0/-home-claude/abe67314-eb63-57b4-b77e-52b988e455f0/scratchpad/<your part>/ — never in the project. Use ONLY your assigned port for the test server and stop it when done. Console must be clean (ignore SwiftShader "GPU stall" and service-worker-blocked messages).

## Shared interfaces (parts are built in parallel; the owner of each file writes it FIRST so the others can import it; importers poll for the file for up to 10 minutes rather than writing a fake)

### envelope/info-data.js (owner: part A) — pure data, no DOM, runs in Node

```js
export const INFO = {
  // key === id
  osb: {
    id: 'osb', kind: 'layer',                 // 'layer' | 'concept' | 'part'
    title: 'OSB sheathing',
    short: 'Wood panel that braces the wall.', // one line, <= 12 words, plain
    what: '...',        // 1–2 sentences: what it is
    job: '...',         // 1–2 sentences: what it does in the wall / why it matters
    control: 'structure',   // layers only: 'water' | 'air' | 'vapor' | 'thermal' | 'structure' | 'finish' | 'cladding' | 'airspace'
    ifWrong: '...',     // what goes wrong when it is missing, wet, or in the wrong place
    doThis: '...',      // what to do about it (design or field action)
    products: ['...'],  // layers/parts: 1–4 generic product types
    facts: [ { label: 'R-value', value: '0.62' }, ... ],   // 0–4 short label/value facts (numbers must match envelope/materials.js where they exist)
    mistake: '...',     // one common field or design error
    are: '...',         // one exam-relevant point (which ARE division where clear: PPD, PDD, CE)
    more: ['...', '...'],   // 1–4 extra short paragraphs for the "More" section
    related: ['dew_point', 'vapor_retarder'],              // ids of other INFO entries
    source: 'BCI 5.46' | 'BCI 7.45, building science practice' | 'Building science practice',
    sourceKind: 'ching' | 'mixed' | 'general',
  }, ...
};
export function getInfo(id)            // -> entry | null
export const LAYER_IDS, CONCEPT_IDS, PART_IDS
export function infoForMaterial(materialId)   // maps every id in envelope/materials.js MATERIALS to an INFO entry (batt_r13/r19/r21 may share one entry 'batt')
```
Required ids — layers: every material id in envelope/materials.js (gyp_050, gyp_063, gyp_sheath, osb, plywood, batt (shared by batt_r13/r19/r21), minwool, xps, eps, polyiso, ccspf, airspace, wrb, brick, cmu8, concrete, fibercement, vinyl, stucco, softwood (wood stud), steel (steel stud), aluminum).
Concepts: dew_point, condensation, r_value, u_factor, heat_flow, heat_loss_q, vapor_retarder, vapor_classes, air_leakage, air_barrier, control_layers, thermal_bridge, continuous_insulation, framing_effect, thermal_break, drainage_gap, rainscreen, wrb_concept, flashing, weep_holes, capillary_break, climate_zone, relative_humidity, interior_surface_temp, parallel_path, steady_state, drying, exploded_view, section_cut.
Parts (Thermal Bridge and Water modes): wood_stud, steel_stud, slab_edge, balcony_slab, shelf_angle, standoff_bracket, thermal_break_unit, brick_tie, head_flashing, sill_pan, end_dam, base_flashing, drip_edge, lap_joint, window_opening, mortar_joint, cavity.

### envelope/info-card.js (owner: part B) — DOM component

```js
export function createInfoCard(hostEl /* the stage wrapper element or document.body */) -> {
  show(id, opts = {}),   // opts: { x, y (client coords; card floats near them on wide screens), pinned:boolean, extra:[{label,value}] live values to show at the top (e.g. "This layer now: 22.0 °F") }
  hide(), isOpen(), isPinned(), currentId(),
  onClose(fn), dispose(),
}
export function infoChip(id, labelOverride)   // -> HTMLElement: a small inline button (term + "i" mark) that opens the shared card for that id, pinned; uses the card created last (module-level registry) 
export function infoButton(id)                // -> HTMLElement: a compact round "i" button for use next to stat tiles
```
Behavior: wide screens (pointer fine): hover → an unpinned card floats near the pointer (does not cover the hovered object; stays inside the viewport; follows nothing — repositions only when the id changes); click → pins it (stays open, gets a close button, scrolls inside if long). Narrow / touch: tap → a pinned bottom card (max ~55 % of the screen height, scrolls inside, close button, swipe not required). One card at a time. Escape closes. Content order: title + kind tag + control-layer tag (layers) → `extra` live values → short → What it is → What it does → If it goes wrong → What to do → Products → Facts → Common mistake → For the ARE → "More" (collapsed; `more` paragraphs) → Related (chips that open the related card) → source tag. Sections with empty text are skipped. Styling: one injected <style id="info-card-style"> using existing CSS tokens; quiet, readable, 14 px body; never bold all-caps.

### envelope/labels3d.js (owner: part C) — 3D callouts

```js
export function createCallout(stage, opts) -> { object /* THREE.Group */, setText(t), setAnchor(vec3), setOffset(vec3), setVisible(b), setActive(b) /* highlight */, userData, dispose() }
   // opts: { text, anchor: THREE.Vector3 (point on the object), offset: THREE.Vector3 (where the label sits relative to the anchor, scene units), id (INFO id, stored in object.userData.infoId), side:'left'|'right'|'auto' }
   // A quiet label: sentence case, system sans, regular weight, small pill with a hairline border in the panel color, a thin leader line from the label to a small dot on the anchor. Constant on-screen text size. Readable in light and dark (re-render on theme change). depthTest off so it is never buried. Pickable: `pickCallout(stage, clientX, clientY, callouts)` returns the callout under the pointer.
export function pickCallout(stage, clientX, clientY, callouts) -> callout | null
export function createSideMarker(stage, opts) -> { object, setVisible(b), dispose() }
   // opts: { text: 'Inside · warm 70 °F', position: Vector3, tone: 'warm'|'cold' } a slightly larger quiet tag with a small colored dot (warm = the thermal-scale red, cold = the thermal-scale blue).
export function layoutCallouts(callouts, stage)   // optional: nudges offsets so labels do not overlap on screen; call after camera changes settle (not every frame)
```

### envelope/assembly-3d.js additions (owner: part C) — used by part B's wiring

```js
wall3d.onHover(fn)          // fn({ kind:'layer'|'stud'|'dew_plane'|'condensation'|'callout'|null, layerIndex, infoId, clientX, clientY })  — pointer move over the 3D wall (wide screens); null when over nothing
wall3d.onSelect(fn)         // existing; extend the payload the same way for taps (keep the old first argument = layerIndex working)
wall3d.setCallouts(on)      // layer name labels on/off (default on)
wall3d.setHoverLayer(i|null)// soft highlight of a hovered layer (distinct from the selected highlight)
```
