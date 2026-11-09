# Science Lab — Rework contract (simple content + realistic 3D)

The owner reviewed Stages 1–2 and asked for two changes. Every rework worker reads this file first.

## A. Simpler content (Orbital Mechanics and Molecules and Crystals — NOT Envelope Lab)

The owner said the modules are too technical. Each mode follows the "simple first" pattern in `shared/simple.js`
(read it; classes are at the end of `shared/style.css`):

1. **One plain question** at the top of panel A — `question('How fast must you go to stay in orbit?', 'one short line')`.
2. **Two or three controls only** in the main view (the most important ones). Any other existing control moves into the
   "Show numbers" area or is removed. Presets and body/structure pickers count as ONE control (a select or a short list).
3. **One large plain answer** at the top of panel B — `answer({kind, title, text})`: a short title ("Stays in orbit")
   and one or two plain sentences that say what happens and why. No symbols, no jargon. A 12-year-old should follow it.
4. **"Try this"** — `tryThis([...])`: three or four guided steps; each button sets the controls and the 3D view shows the result.
   Steps tell a small story in order (e.g. "Drop it", "Throw it sideways", "Throw it faster", "Throw it too fast").
5. **"Show numbers" switch** — `numbersSwitch({...}, ...detail)`: OFF by default. All stat tiles, tables, graphs, source tags and
   secondary toggles live inside it. The numbers keep working exactly as before when the switch is on (tests and check values still hold).
   Keep the switch state in the mode's store slice (`showNumbers`).

Words: short, everyday, sentence case, no contractions. Replace jargon in the main view: "periapsis/apoapsis" → "lowest point / highest point";
"eccentricity" → "how oval"; "delta-v" → "speed change"; "coordination number" → "touching neighbors"; "unit cell" → "repeating block";
"dipole" → "charge direction" (say "one side is slightly negative"); "polar" → "has a charged side". Technical words may appear inside "Show numbers".
The phone one-line `#summary` stays, in plain words.

## B. Realistic 3D (all three modules)

The screen chrome stays neutral (cool grays, one blue accent). The 3D objects become rich and realistic:
- **Space (orbital/):** real surface images, clouds, atmosphere glow, day and night sides with city lights, a dense star sky,
  a spacecraft model. The space view is **black in both color themes**.
- **Molecules (molecules/):** glossy atoms with reflections, soft shadows, depth.
- **Walls (envelope/):** real material surfaces (brick, wood grain, insulation fiber, foam, block, gypsum paper), light and shadow.
  Envelope Lab keeps all its numbers and layout.

Performance: must stay smooth on an iPhone. Textures ≤ 2048 px wide (1024 preferred), JPEG where possible, total new assets per module ≤ ~6 MB.
Everything must work offline (files are local; report every new file so it can be added to `sw.js`). No CDN, no external requests at runtime.

## C. Rules for every rework worker

- Only edit files you own (your brief lists them). Never edit `CONTRACT*.md`, `shared/*`, `sw.js`, or another worker's files. Do not commit or push.
- Do not change physics/data modules or their tests. `node --test tests/*.test.mjs` must still pass (202).
- Report every new file (assets and code) with its size.
- Selection or control changes never move the camera, except the one-time framing at mount / structure change / "Try this" steps that change scale a lot.
- Verify with Playwright screenshots in light and dark at 390×844, 820×1180, 1440×900, and LOOK at them.
