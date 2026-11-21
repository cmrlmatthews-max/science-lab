# Science Lab — Envelope Lab information layers + polish pass (build contract)

Every worker reads this file first. It is the source of truth for file ownership and shared interfaces.
Project root: /home/claude/science-lab (git repo — do NOT commit or push). Static site, ES modules, no build step, Three.js r170 vendored.
Also read `CONTRACT-LAYERS.md` (the five-layer system, already built and live in `orbital/` and `molecules/`) and the notes file
`/tmp/claude-0/-home-claude/abe67314-eb63-57b4-b77e-52b988e455f0/scratchpad/layers/API-NOTES.md` (exact API of `shared/layers.js`, `shared/card.js`, `shared/units.js`). If that notes file is missing, read the three shared files directly.

## What the owner said (verbatim intent)

- "Let us give layers of information. We start out with extremely general, then allow the user to dig as far as they want. If we add too much information right off the bat I think it discourages learning about the topic." Sixth-grade level at the start. Everyday comparisons. "Show both unit formats." "The more context to modern life the better."
- About Envelope Lab as it is today (the detailed view): "Envelope lab looks good for now." It is his ARE exam study tool. **So level 5 of every Envelope mode must look and behave exactly like today's view** (same panels, same numbers, same cards, same 3D labels).
- He asked for this pass: (B) the same Start-to-Deep layers for Envelope Lab; (C) a polish pass on the known limits listed below.

## The five layers in Envelope Lab

Same system as `CONTRACT-LAYERS.md` ("The five layers" table and its rules apply here in full): level kept in the store as `level`, starts at 1 on every page load, shared by the three modes, layer bar from `shared/layers.js`.

| Level | Envelope Lab meaning |
|---|---|
| 1 Start | One question, the 3D wall on a good default, one plain answer, at most three or four big picture choices. **No digits anywhere**: panels, phone summary line, stage overlays, 3D callouts and markers (for example "Inside, warm" / "Outside, cold", "Water forms here"). |
| 2 Story | A guided story of 4–6 steps (`story()` from shared/layers.js). Each step sets the 3D view and has an "In your life" line (a cold drink that sweats, a winter coat, a metal spoon in hot soup, a raincoat and roof shingles, a wet basement wall, window fog, high heating bills). Numbers only as everyday comparisons. |
| 3 Explore | The main controls (2–3) and "Try this" steps. Plain names. Hover/tap cards on every part. |
| 4 Numbers | 3–6 stat tiles (`tile()`), each with both unit formats — US first, then metric: °F (°C), R-value (RSI = R × 0.1761), U (W/m²K = U × 5.678), Btu/h (W = × 0.2931), in. (mm), perm — and one everyday comparison line. Technical words with a plain gloss. |
| 5 Deep | **Exactly today's view.** Nothing removed, nothing reworded, nothing moved. |

Reading level for `TEXT.l1`–`l3`: grade 6.0 or lower, enforced by a test exactly like `tests/text-launch.test.mjs` (see CONTRACT-LAYERS.md "tests/text-<mode>.test.mjs"). Plain words at levels 1–3: "keeps heat in" (not thermal resistance), "heat shortcut" (not thermal bridge) with the real term introduced at level 4, "water forms" (not condensation) with the term at level 4, "rain barrier sheet / housewrap", "metal strip that kicks water out" (flashing — the word flashing may be used after it is explained once), "drain gap".
The owner is an architect: levels 4 and 5 use the correct professional terms.

Check values that must hold at level 5 (and in level-4 tiles): Assembly W1, mixed winter: R 16.54, U 0.0605, sheathing (OSB) 22.0 °F, dew point 41.1 °F; W3 R 18.44. Thermal Bridge: stud/steel +99.1 %, slab/through +152.9 % (coldest inside surface 57.8 °F), slab/break +56.1 % (63.8 °F).
No physics, data or rule module changes: `materials.js`, `walls.js`, `physics.js`, `vapor.js`, `bridge.js`, `water.js`, `info-data.js` are read-only for everyone.

## Parts and file ownership

| Part | Owner of | Port |
|---|---|---|
| E — Envelope shell | `envelope/main.js`, `envelope/index.html`, `envelope/info-card.js`, an appended "Envelope layers" section at the end of `shared/style.css` (append only) | 8881 |
| A — Assembly | `envelope/mode-assembly.js`, `envelope/assembly-3d.js`, `envelope/assembly-graph.js`, `envelope/content-assembly.js` (new), `tests/text-assembly.test.mjs` (new) | 8882 |
| B — Thermal Bridge | `envelope/mode-bridge.js`, `envelope/bridge-scene.js`, `envelope/bridge-parts.js`, `envelope/bridge-model.js`, `envelope/bridge-flow.js`, `envelope/bridge-graph.js`, `envelope/content-bridge.js` (new), `tests/text-bridge.test.mjs` (new) | 8883 |
| W — Water | `envelope/mode-water.js`, `envelope/water-gfx.js`, `envelope/water-fx.js`, `envelope/water-build.js`, `envelope/content-water.js` (new), `tests/text-water.test.mjs` (new) | 8884 |
| P — Orbital and Molecules polish | `orbital/mode-launch.js`, `orbital/mode-orbits.js`, `orbital/mode-transfer.js`, `orbital/content-*.js`, `molecules/mode-molecules.js`, `molecules/content-molecules.js` | 8885 |

Nobody edits: `CONTRACT*.md`, `sw.js`, `shared/layers.js`, `shared/card.js`, `shared/units.js`, `shared/scene.js`, `shared/ui.js`, `shared/simple.js`, `envelope/labels3d.js`, `envelope/material-look.js`, the read-only modules named above, existing tests, `tests/helpers/*`, and anything in `orbital/` or `molecules/` not listed for part P.
If you need something in a file you do not own, work around it in your own files and say so in the report.

## Order of work (parts run in parallel)

- Part E first makes the Envelope shell match the Orbital shell (read `orbital/main.js`): store `level: 1`; `createLayers`; `mountBar(layers, { header, shell, summary })`; `document.body.classList.add('sl-layers')`; `ctx.layers`, `ctx.setPanelMin(panel, min)`; `layers.reset()` on mode switch. When the shell works with the current (unconverted) modes, E creates the empty marker file
  `/tmp/claude-0/-home-claude/abe67314-eb63-57b4-b77e-52b988e455f0/scratchpad/layers2/READY`
  and writes any API detail that differs from the Orbital shell to `.../scratchpad/layers2/API-NOTES.md` BEFORE the marker.
- Parts A, B, W start with their `content-<mode>.js` and its reading-level test, then wait for the marker (poll every 30 s, up to 25 minutes), then wire. If the marker does not appear, wire against the Orbital shell's API as documented and say so.
- Part P does not depend on E.

## Interfaces

### Envelope ctx (part E)

`mode.mount(ctx)`: `ctx = { stageEl, panelA, panelB, panelC, summaryEl, store, stage, isNarrow(), layers, setPanelMin }` — the same `layers` controller and `setPanelMin` as Orbital. There is **no `ctx.card`** in Envelope: the modes keep their own `createInfoCard(...)` from `envelope/info-card.js` exactly as today.

### envelope/info-card.js level awareness (part E)

```js
export function setCardLayers(layers | null)   // the shell calls it once with the controller
```
With layers set: at levels 1–3 a pinned card shows title, tags, `extra` live values **only if the caller passed them**, short, "What it does" (job), "If it goes wrong" (ifWrong), "What to do" (doThis), related chips, and a "Tell me more" button that raises the level by one and keeps the card open; "What it is", products, facts, common mistake, "For the ARE", More and source appear at level 4 and above. At level 5 the card is **identical to today**. The card re-renders when the level changes. Hover cards are unchanged. Mode workers must not pass numeric `extra` values at level 1.

### content-<mode>.js (parts A, B, W) — pure data, runs in Node

```js
export const TEXT = { l1: { question, sub, answers: {...}, choices: [{ id, label }] }, l2: { steps: [{ title, text, life }] }, l3: { ... }, l4: { tiles: {...}, glosses: {...} } };
```
Level 5 text stays where it is today (in the mode file). Cards use the existing `envelope/info-data.js` ids (read-only); if you need a new idea card, say so in the report instead of adding one.

## Part notes

### A — Assembly
- Level 1 question in the direction of "What keeps a home warm and dry?"; default wall W1 in the mixed winter climate; choices such as "Thin wall", "Thick insulation", "Insulation outside" (map them to existing walls or to layer changes that the current controls can already make — no new physics). 3D: at levels 1–2 the callouts show names only and the markers show "Inside, warm" / "Outside, cold"; the dew-point line and the wet patch stay but with plain labels and no numbers. Add what you need to `assembly-3d.js` as additive options (for example `setPlainLabels(on)`); default behavior unchanged.
- Level 2 story: heat moves from warm to cold → insulation slows it down → wood and steel studs are heat shortcuts → warm air carries hidden water; a cold surface makes it show (cold drink) → that can happen inside a wall → insulation on the outside keeps the wall warm and dry.
- Level 3: wall presets, climate presets, the peel/explode/section controls, Try this.
- Level 4 tiles: whole-wall R-value, U-factor, heat loss, sheathing temperature, dew point, condensation yes/no.
- Polish: on wide screens a pinned card must not cover the 3D wall when there is room beside it — work with what `info-card.js` offers (`show` options `x`, `y`, `anchor`) and say what you could not do.

### B — Thermal Bridge
- Level 1 question in the direction of "Where does heat sneak out?"; default the balcony slab, Problem and Better side by side with heat arrows; choices = the three cases with everyday names ("Wall stud", "Balcony floor", "Brick shelf"). No digits: coldest-surface marker reads "Coldest spot" without a temperature at levels 1–2; result sentence in plain words.
- Level 2 story: metal spoon in hot soup → a stud or slab does the same in a wall → cold spot inside can get wet and moldy → the fix: wrap it or break it.
- Level 3: case and variant controls, Show Both/Problem/Better, arrows toggle, Try this. Level 4 tiles: extra heat loss in percent with a comparison, coldest inside surface °F (°C), effective R (RSI) for both versions.
- Polish 1: the shelf-angle "standoff bracket" version must look different from the continuous angle in 3D: separate brackets at intervals with insulation passing between them (geometry only; the solver values do not change).
- Polish 2: at 1440×900 the two models are small and the callouts between them are crowded. Make the models fill the stage better (camera framing, spacing) and lay out callouts so that none overlap.

### W — Water
- Level 1 question in the direction of "How does a wall stay dry in the rain?"; default the brick wall with the window in rain, correct detail; choices such as "Good wall", "No drain gap", "No metal strip over the window" that switch to the matching error. No digits.
- Level 2 story: rain hits the wall → some water always gets behind the brick → the gap lets it run down → the housewrap is the raincoat; sheets overlap like roof shingles → metal strips kick water out above windows and at the bottom → small holes let it out.
- Level 3: the four views (Forces, Walls, Errors, Layers) with their toggles and Try this, plain names. Level 4: tiles with the key dimensions the mode already states (gap width, lap, flashing turn-up, and similar) in in. (mm) with comparisons; the names of the forces and control layers with glosses.
- Polish 1: "No drainage gap" must look clearly different from the correct detail in the peeled view (for example mortar or cladding filling the gap, brick tight to the wrap, water bridging across, a stronger stain).
- Polish 2: in the Layers view the selected control layer must stand out strongly (clear color and outline; the rest quiet).
- Polish 3: at 390 px the "Inside" and "Outside" markers must not sit on top of the wall.

### P — Orbital and Molecules polish
- Orbits: the answer box is hidden at level 2 today; show it at every level (remove that gate) unless it truly repeats the story step word for word — then shorten it instead.
- Launch, Orbits, Travel: orbits are now drawn farther from the planet than true scale (`setOrbitLift` in `space.js`, `GAP` in Travel). Add a quiet note "Heights are not to scale" at levels 4 and 5 only (stage note area that each mode already has), never at levels 1–3, and one sentence in the level-5 notes that says the picture pushes low orbits outward so that they read and the numbers are true.
- Molecules: at 390×844, level 1, the plain answer is below the picture buttons and off screen. Make the answer visible without scrolling (for example answer first, or compact buttons). Check Crystals and Compare for the same problem and report; fix only files you own.
- No other changes. Tests and reading-level tests must still pass.

## Rules for all workers

- Only edit files you own. Do not commit or push. Report every new file (it goes into `sw.js`).
- `cd /home/claude/science-lab && node --test tests/*.test.mjs` must pass (326 existing + new). The bridge timing test can fail under load; re-run once before you report a failure.
- Verify with Playwright (Node module `/opt/npm-tools/node_modules/playwright`; `chromium.launch({executablePath:'/usr/bin/google-chrome', args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']})`; contexts with `serviceWorkers:'block'`, `reducedMotion:'reduce'` is allowed for speed). Screenshots at 390×844 (hasTouch, isMobile), 820×1180, 1440×900; light and dark; each of the five levels; and LOOK at them. Pass `timeout: 90000` to screenshots and retry. A vertical clip of the 3D view next to a fixed card in a screenshot is a capture artifact; ignore it.
- **Level-5 proof (parts A, B, W):** before you change anything, save the visible text of all three panels and the summary at the default state of your mode (`git stash` is not allowed — take it from the live site copy in git: `git show HEAD:envelope/...` is the baseline; simplest is to capture the text with Playwright first thing). At the end, at level 5, the same capture must give the same text. Report the result.
- Scratch files go under `/tmp/claude-0/-home-claude/abe67314-eb63-57b4-b77e-52b988e455f0/scratchpad/layers2/<your part letter>/` — never in the project. Use ONLY your assigned port (`python3 -m http.server <port>` from the project root) and stop it when done.
- Console must be clean (ignore SwiftShader "GPU stall" and service-worker-blocked messages).
- Check: level 1 shows no digits anywhere outside the layer bar; "Tell me more" and "Simpler" walk 1→5→1 with no error and no leftover elements; mode switch keeps the level; hover card (wide) and tap card (phone) still open; nothing overflows at 390 px.

## Report format (final message of every worker)

```
STATUS: DONE | PARTIAL
FILES: changed … / new …
TESTS: <pass>/<total>
LEVELS: one line per level — what the user sees        (part P: POLISH: one line per item)
LEVEL-5 PROOF: same text as before | differences …      (parts A, B, W)
POLISH: one line per polish item — what changed
SCREENSHOTS LOOKED AT: list
CONSOLE: clean | messages
WORKAROUNDS / NOT DONE / RISKS: list
```
