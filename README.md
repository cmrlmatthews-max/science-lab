# Science Lab

Science Lab is a set of 3D simulators for building science and general science.
Stage 1 is **Envelope Lab**: a wall simulator with three modes. Stage 2 is **Orbital Mechanics** and Stage 3 is **Molecules and Crystals** (see below).

| Mode | What you do |
|---|---|
| Assembly | Change the wall layers and the climate. See R-value, heat loss, layer temperatures, dew point, and condensation risk. |
| Thermal Bridge | Compare a stud, a slab edge, and a shelf angle. See the temperature map and the added heat loss. |
| Water | See the five forces that move water, the four wall strategies, five flashing errors, and the four control layers. |

Units are IP only. The app is a study tool. Do not use the results for project design.

## Stage 2: Orbital Mechanics

Orbital Mechanics shows launch, orbits, and transfers around real bodies (Earth, Moon, Mars, Sun). Open it from the hub at `orbital/`.

| Mode | What you do |
|---|---|
| Launch | Pick a start altitude, speed, and angle. See if the craft falls back, orbits, or escapes. |
| Orbits | Pick an orbit by its lowest and highest point. See speed, period, and the shape of the path. |
| Transfer | Move a craft from one circular orbit to another. See the burns, the time, and the fuel. |

Units are metric (km, km/s, and s, min, h, or days). Results are two-body, in one plane. Body data comes from the NASA Planetary Fact Sheet. The app is a study tool.

```
orbital/
  index.html, main.js   shell, store, mode switching
  space.js              shared 3D and time helpers
  bodies.js, physics.js body data and two-body orbit math (tested)
  mode-*.js             the three modes
```

## Stage 3: Molecules and Crystals

Molecules and Crystals is an explorer, not a simulator. You turn, cut, measure, and compare real structures. Open it from the hub at `molecules/`.

| Mode | What you do |
|---|---|
| Molecules | Pick a molecule (air, fuels, indoor air, refrigerants, building plastics). See its shape, bonds, and polarity. |
| Crystals | Pick a crystal (metals, salts, diamond, ice, quartz, calcite). Build a block, show the cell and planes, count neighbors. |
| Compare | Put two structures side by side, such as BCC and FCC iron or diamond and graphite, and see why they behave differently. |

Units: lengths in ångström (1 Å = 0.1 nanometer), angles in degrees, density in g/cm³, molar mass in g/mol. Tap two atoms to measure a distance and tap a third for the angle.

Every structure shows how far to trust it:

- **Reference**: standard textbook lattice constants and bond lengths.
- **Approximate**: reasonable values that are not checked against a source.
- **Schematic**: a drawing that shows the idea, not measured positions (glass, liquid water, polymer chains).

```
molecules/
  index.html, main.js   shell, store, mode switching
  viewer.js             shared 3D atom and bond renderer, picking, measuring
  elements.js, chem.js  element table and geometry helpers (tested)
  molecule-data.js      molecule library
  lattice.js, crystal-data.js   crystal math and crystal library (tested)
  compare-data.js       comparison pairs (tested)
  mode-*.js             the three modes
```

## Run the app on your Mac

The app must come from a web server. It does not open correctly from a double-click.

1. Open Terminal.
2. Go to this folder: `cd` then the folder path.
3. Start a server: `python3 -m http.server 8000`
4. Open `http://localhost:8000` in Safari.
5. Press Control-C in Terminal to stop the server.

## Put the app on GitHub Pages

1. Make a public repository with the name `science-lab`.
2. Upload all files in this folder to the repository.
3. In the repository, open Settings, then Pages. Set the source to the `main` branch, root folder.
4. Open the page address on your iPhone in Safari.
5. Tap Share, then Add to Home Screen.

After each change to a file, increase the cache number in `sw.js` (`science-lab-v5` becomes `science-lab-v6`). The installed app then gets the new files.

## Run the tests

`node --test tests/*.test.mjs` (Node 22). The tests check the numbers against the plan.

## Files

```
index.html            hub page
manifest.json, sw.js  Home Screen install and offline cache
vendor/               Three.js r170 (3D engine)
shared/               styles, 3D stage, controls
envelope/
  materials.js        material library and permeance
  walls.js            preset walls W1 to W4
  physics.js          heat flow, dew point, condensation
  vapor.js            vapor retarder rules (BCI 7.46)
  bridge.js           2D heat-flow solver
  water.js            water rules
  mode-*.js           the three modes
  assembly-*.js, bridge-scene.js   3D models and graph
tests/                number checks
CONTRACT.md           build interfaces (for later stages)
```

## Sources

- Ching, *Building Construction Illustrated*, 6th edition (BCI), sections 7.22, 7.23, 7.40, 7.44, 7.45, 7.46.
- Archtoolbox R-value table (secondary source for ASHRAE values).
- ASHRAE 90.1 Appendix A steel stud values, from a Masonry Advisory Council summary.

## Known limits

- Heat flow is steady-state.
- The condensation check uses dew point only. It does not calculate vapor movement.
- Vapor retarder rules come from BCI, which reflects codes from approximately 2018 to 2020.
- The wood framing factors (25% and 22%) are typical values. No source is checked.
- Perm values that are not in BCI 7.45 are approximate.
- The steel stud in Thermal Bridge mode gives a whole-wall R of 10.6. The ASHRAE table value gives approximately 9.2. The model has no stud lips.
- Water mode is a rule-based animation, not a fluid simulation.
