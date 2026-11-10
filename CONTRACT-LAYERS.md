# Science Lab — Information layers (build contract)

Every worker reads this file first. It is the source of truth for file ownership and shared interfaces.
Project root: /home/claude/science-lab (git repo — do NOT commit or push). Static site, ES modules, no build step, Three.js r170 vendored.
This pass changes **Orbital Mechanics** (`orbital/`) and **Molecules and Crystals** (`molecules/`). Envelope Lab (`envelope/`) must not change.

## What the owner said (verbatim intent)

- "I think we need to dumb it down more. I am thinking sixth grade level."
- "Let us give layers of information. We start out with extremely general, then allow the user to dig as far as they want. If we add too much information right off the bat I think it discourages learning about the topic."
- Everyday comparisons: yes. Units: "show both unit formats" (US first, then metric). Guided story: "the more context to modern life the better."
- From the Envelope Lab pass that he approved: "hovering over a layer could give me more information" — he likes hover / tap information cards that say what a thing is and why it matters.
- Each visit starts at layer 1.

## The five layers

One level (1–5) per module, kept in the store as `level` (starts at 1 on every page load; not saved). It stays the same when the user changes mode.
A layer bar (shell, always on screen) has "Simpler", five steps with names, and "Tell me more".

| Level | Name | What is on screen | Words and numbers |
|---|---|---|---|
| 1 | Start | The one question. The 3D view, already moving, on a good default. One large plain answer. At most ONE control, and only if it is a big obvious choice (for example three picture buttons). | No numbers anywhere (panels, stage overlays, 3D labels, phone summary line). Grade 6 or lower. |
| 2 | Story | Adds a guided story: 4–6 steps. Each step sets the 3D view, has a short title, 1–3 short sentences, and an "In your life" line that ties the idea to modern life (GPS, weather satellites, satellite internet, the Space Station, phone batteries, steel, salt, ice, plastic bottles, refrigerators, cooking gas …). | Numbers only as everyday comparisons ("about 10 times faster than a rifle bullet"). Grade 6 or lower. |
| 3 | Explore | Adds the 2–3 main controls and the "Try this" steps (existing `tryThis`). The user plays. | Plain words. Rounded friendly values on controls are fine, US unit first. Grade 6 or lower. |
| 4 | Numbers | Adds the main values as stat tiles: 3–6 tiles. Each value in both unit formats (US first, then metric) and with one everyday comparison line under it. | Technical words allowed if each has a plain gloss the first time. |
| 5 | Deep | Everything the mode has today inside "Show numbers": formulas, tables, source tags, secondary toggles, measuring tools, technical terms. | Full detail. |

Rules:
- Higher levels ADD to lower levels (a level-3 screen still shows the question and the answer). An element may also have a max level when a simpler version is replaced by a richer one (for example the level-1 picture buttons give way to the level-3 controls).
- The existing "Show numbers" switch goes away. `showNumbers` in store slices is replaced by `level >= 4`.
- The physics, chemistry data, and every existing test stay exactly as they are. Check values still hold at level 5 (Orbital: LEO 400 km → 7.67 km/s, 92.6 min; LEO→GEO 2.43 + 1.47 = 3.89 km/s, 5.3 h).
- The space view stays black in both themes. Screen chrome stays the neutral style in shared/style.css (cool grays, one blue accent, sentence case, system sans). No bold all-caps.
- UI text: short plain sentences, sentence case, no contractions, active voice. Sentences in levels 1–3: 15 words or fewer where possible, never more than 20.
- Plain words in levels 1–3: "lowest point / highest point" (not periapsis/apoapsis), "how oval", "speed change" (not delta-v), "touching neighbors" (not coordination number), "repeating block" (not unit cell), "has a charged side" (not polar). At level 4 a technical word may appear with its gloss; at level 5 freely.
- Hover on Mac (pointer: fine) and tap on iPhone/iPad (pointer: coarse) must both work. Cards never move the camera.
- Motion respects `prefers-reduced-motion` as today.

## Parts and file ownership

| Part | Owner of | Port |
|---|---|---|
| S — shared layer system | `shared/layers.js`, `shared/card.js`, `shared/units.js`, the new "Layers" section at the end of `shared/style.css` (append only; do not change existing rules except where this contract says), `orbital/main.js`, `orbital/index.html`, `molecules/main.js`, `molecules/index.html`, small additive hooks in `molecules/viewer.js` (see below), `tests/units.test.mjs`, `tests/layers.test.mjs` | 8871 |
| L — Launch | `orbital/mode-launch.js`, `orbital/content-launch.js`, `tests/text-launch.test.mjs` (may read but not edit `launch-model.js`) | 8872 |
| O — Orbits | `orbital/mode-orbits.js`, `orbital/content-orbits.js`, `tests/text-orbits.test.mjs` | 8873 |
| T — Travel | `orbital/mode-transfer.js`, `orbital/content-transfer.js`, `tests/text-transfer.test.mjs` | 8874 |
| M — Molecules | `molecules/mode-molecules.js`, `molecules/content-molecules.js`, `tests/text-molecules.test.mjs` | 8875 |
| C — Crystals | `molecules/mode-crystals.js`, `molecules/content-crystals.js`, `tests/text-crystals.test.mjs` | 8876 |
| X — Compare | `molecules/mode-compare.js`, `molecules/content-compare.js`, `tests/text-compare.test.mjs` (may read but not edit `compare-*.js`) | 8877 |

Nobody edits: `CONTRACT*.md`, `sw.js`, `envelope/*`, `shared/scene.js`, `shared/ui.js`, `shared/simple.js`, `orbital/space.js`, `orbital/physics.js`, `orbital/bodies.js`, `orbital/launch-model.js`, data files in `molecules/` (`*-data.js`, `lattice.js`, `chem.js`, `elements.js`), existing tests, `tests/helpers/*`.
If a mode worker needs something in a file it does not own, it works around it inside its own files and says so in its report.

## Order of work (parts run in parallel)

- Part S writes its shared files FIRST, then the shells. When `shared/layers.js`, `shared/card.js`, `shared/units.js`, the CSS, both shells and the viewer hooks all work, S creates the empty marker file
  `/tmp/claude-0/-home-claude/abe67314-eb63-57b4-b77e-52b988e455f0/scratchpad/layers/READY`.
- Mode workers start with their `content-<mode>.js` and its reading-level test (independent of S). Then they wait for the READY marker (poll every 30 s, up to 25 minutes) before wiring. They never write a fake of a shared file. If READY does not appear in 25 minutes, wire against the interfaces below as written and say so in the report.

## Shared interfaces

### shared/layers.js (part S)

```js
export const LEVELS = [
  { n: 1, id: 'start',   name: 'Start',   hint: 'The big idea' },
  { n: 2, id: 'story',   name: 'Story',   hint: 'A short guided story' },
  { n: 3, id: 'explore', name: 'Explore', hint: 'Try it yourself' },
  { n: 4, id: 'numbers', name: 'Numbers', hint: 'The values, with comparisons' },
  { n: 5, id: 'deep',    name: 'Deep',    hint: 'Formulas and full data' },
];
export function createLayers({ get, set })   // get(): number 1–5, set(n): stores it. Returns the controller below. Pure logic + DOM helpers; importable in Node without a DOM for the pure parts.
// controller:
//   level()                      -> current level
//   setLevel(n)                  -> clamps 1–5, stores, re-applies gates, calls listeners
//   onChange(fn)                 -> fn(level, prevLevel); returns unsubscribe
//   gate(el, min = 1, max = 5)   -> returns el; el.hidden is kept true whenever level < min or level > max. Works for any HTMLElement.
//   gateFn(fn, min = 1, max = 5) -> calls fn(isOn:boolean) now and on every change (for 3D objects, overlays, timers)
//   is(min, max = 5)             -> boolean for the current level
//   reset()                      -> forgets all gates and listeners registered by a mode (the shell calls it on mode switch)
//   bar()                        -> the layer bar element (shell use)
export function story(steps, opts = {})  // -> { el, go(i), index(), reset() }
//   steps: [{ title, text, life, run() }]   text: 1–3 short sentences; life: the "In your life" line (optional); run(): sets the controls / 3D view
//   opts: { title = 'The story', onStep(i) }
//   UI: step counter ("2 of 5"), title, text, a quiet "In your life" block, Back and Next buttons (44 px touch targets). Step 1 runs when the story first becomes visible only if opts.autoRun is true.
export function tile({ label, us, si, compare, infoId })  // -> { el, update({us, si, compare}) }   a level-4 stat tile: label, the US value large, the metric value after it, the comparison line under it; optional info button (uses the active shared card)
export function moreLink(layers, text = 'Tell me more')   // -> button that calls layers.setLevel(level+1); hidden at level 5. Modes may put one under the answer.
```

### ctx additions (part S, in both `main.js` shells)

`mode.mount(ctx)` now also gets `ctx.layers` (the controller) and `ctx.card` (a shared card, see below, created by the shell on the stage wrapper's parent). The store has `level`. The shell:
- draws the layer bar where it is always visible: wide screens — a strip under the header or in the header row; phone — directly under the 3D view (above the summary line and the sheet tabs). Tapping a step jumps to it. The bar shows the current name and hint.
- calls `layers.reset()` and `card.hide()` on mode switch.
- hides a whole panel when the mode asks: `ctx.setPanelMin('c', 3)` hides panel C (and its phone tab) below level 3 and lets the 3D view use the space on wide screens. Same for 'b'. Panel A is always shown.
- at level 1 on wide screens the 3D view should be the hero: S may narrow or restyle panels as it sees fit, as long as nothing overlaps at 1440×900, 820×1180, 390×844.

### shared/card.js (part S) — the information card, same behavior as `envelope/info-card.js` (read it; copy and generalize; do not import it)

```js
export function createCard(hostEl, { getInfo })  // getInfo(id) -> entry | null. Returns { show(id, {x, y, pinned, extra, opener}), hide(), hideHover(), isOpen(), isPinned(), currentId(), setSource(getInfo), onClose(fn), dispose(), element }
export function infoChip(card, id, label)    // inline term + "i" mark; opens the card pinned
export function infoButton(card, id, opts)   // compact round "i" button
```
Entry shape (all text fields optional except title and short):
`{ id, title, kind /* short tag, e.g. 'Planet', 'Idea', 'Atom', 'Bond' */, short, what, why, life, facts: [{label, value}], more: [..paragraphs], related: [ids], source }`
Card order: title + kind tag → `extra` live values → short → "What it is" (what) → "Why it matters" (why) → "In your life" (life) → facts → "More" (collapsed) → related chips → source. Empty sections are skipped.
**The card respects the level:** S gives `createCard` an option `level: () => number`; at levels 1–3 the card shows only title, short, what, why, life and a "Tell me more" hint line; facts, More and source show at level 4 and above.
Each mode calls `ctx.card.setSource(getInfo)` in `mount` with the `getInfo` from its content file.

### shared/units.js (part S) — pure, runs in Node, tested

```js
export const dual = {
  km(km, digits)        // -> { us: '250 mi', si: '400 km', text: '250 mi (400 km)' }
  kmps(v, digits)       // -> { us: '17,200 mph', si: '7.67 km/s', text: '17,200 mph (7.67 km/s)' }   mph rounded to 3 significant figures
  mps(v), kg(m), celsius(c), gcc(d) /* lb/ft³ (g/cm³) */, angstrom(a) /* us: 'x billionths of an inch' is NOT used; returns { us: null, si: '0.96 Å', alt: '0.096 nm', text: '0.96 Å (0.096 nm)' } */
};
export function friendlyDuration(seconds)   // '93 minutes', '5.3 hours', '8.5 months' — words, not symbols
export function nice(n, sig = 3)             // rounded number with thousands separators
```

### molecules/viewer.js hooks (part S, additive only; existing API and behavior unchanged by default)

```js
viewer.onHover(fn)   // fn({ kind: 'atom'|'bond'|null, index, element /* symbol */, a, b /* bond atom indices */, clientX, clientY }) on pointer move (pointer: fine). Returns unsubscribe.
viewer.onTapInfo(fn) // same payload on tap/click. Returns unsubscribe.
viewer.setTapMode('info' | 'measure')   // 'measure' = today's behavior (tap atoms to measure). 'info' = taps call onTapInfo listeners and do not measure. Default 'measure' so nothing changes until a mode opts in.
```
Molecules-side modes use `setTapMode('info')` at levels 1–3 and offer the measuring tool at level 5 (level 4 optional).

### content-<mode>.js (each mode worker) — pure data, no DOM, runs in Node

```js
export const TEXT = {
  l1: { question, sub, answers: { <key>: { title, text } , ... }, choices: [{ id, label }] },
  l2: { steps: [{ title, text, life }] },          // the story (run() is attached in the mode file)
  l3: { controls: { <key>: label }, tries: [{ label, hint }], notes: [..] },
  l4: { tiles: { <key>: { label, compare /* string or (value) => string */ } }, glosses: { term: 'plain meaning' } },
  l5: { ... }                                        // labels for the deep view (free form)
};
export const INFO = { <id>: entry, ... };            // card entries for everything the user can hover or tap in this mode's 3D view, and for each idea named in the panels
export function getInfo(id)
```
Minimum INFO: every 3D object type in the mode (Orbital: each body used, the craft, the path, each marker type, arrows; Molecules: each element that appears, each bond type, hydrogen bond, charged side arrow, repeating block, plane, each structure in the mode's library) plus 6 or more ideas. Facts must match the module's data files.

### tests/text-<mode>.test.mjs (each mode worker)

Uses `tests/helpers/readability.mjs` (`gradeOf`, `strings`, `longestSentence`). Asserts:
- all strings of `TEXT.l1`, `TEXT.l2`, `TEXT.l3` joined per level: Flesch-Kincaid grade ≤ 6.0;
- every single string in those levels: grade ≤ 8.0 when it has 8 words or more, and no sentence longer than 20 words;
- `INFO` `short`, `what`, `why`, `life` fields joined: grade ≤ 7.0;
- no digit characters in any `TEXT.l1` string;
- every `related` id resolves; every entry has `title` and `short`.
Function-valued fields are called with a typical value before grading. Write to the grade — rewrite the text until the test passes; never loosen the limits.

## Rules for all workers

- Only edit files you own. Do not commit or push. Report every new file (it goes into `sw.js`).
- `cd /home/claude/science-lab && node --test tests/*.test.mjs` must pass (232 existing + new). The bridge timing test can fail under load; re-run once before you report a failure.
- Verify with Playwright (Node module `/opt/npm-tools/node_modules/playwright`; `chromium.launch({executablePath:'/usr/bin/google-chrome', args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']})`; contexts with `serviceWorkers:'block'`). Screenshots at 390×844 (deviceScaleFactor 2, hasTouch, isMobile), 820×1180, 1440×900; light and dark; **each of the five levels**; and LOOK at them. Screenshot timeouts happen with the software renderer: pass `timeout: 90000` and retry. A vertical clip of the 3D view next to a fixed card in a screenshot is a capture artifact; ignore it.
- Scratch files go under `/tmp/claude-0/-home-claude/abe67314-eb63-57b4-b77e-52b988e455f0/scratchpad/layers/<your part letter>/` — never in the project. Use ONLY your assigned port (`python3 -m http.server <port>` from the project root) and stop it when done.
- Console must be clean (ignore SwiftShader "GPU stall" and service-worker-blocked messages).
- Check: level 1 shows no digits anywhere on screen; "Tell me more" and "Simpler" walk 1→5→1 with no error and no leftover elements; mode switch keeps the level; hover card (wide) and tap card (phone) open on 3D objects; nothing overflows at 390 px.

## Report format (final message of every worker)

```
STATUS: DONE | PARTIAL
FILES: changed … / new …
TESTS: <pass>/<total>
LEVELS: one line per level — what the user sees
CARDS: count of INFO entries; what was checked
SCREENSHOTS LOOKED AT: list
CONSOLE: clean | messages
WORKAROUNDS / NOT DONE / RISKS: list
```
