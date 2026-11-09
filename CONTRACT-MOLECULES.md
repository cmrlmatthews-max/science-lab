# Science Lab — Build Contract, Stage 3: Molecules and Crystals

Every worker reads this file first. It is the source of truth for file ownership and interfaces.
Stages 1 (envelope/) and 2 (orbital/) are finished and live. **Do not change their behavior.** Reuse `shared/style.css`, `shared/ui.js`, `shared/scene.js` as they are (read the comment block at the top of `shared/style.css` and the JSDoc in `ui.js` / `scene.js`). `orbital/index.html` + `orbital/main.js` are the newest example of a module shell.

## 0. Ground rules

- Static site, ES modules, no build step, no runtime dependencies. Three.js r170 is vendored (`vendor/`), import map as in `orbital/index.html`.
- Look: the existing neutral "analysis software" style (cool grays, one blue accent, sentence-case labels, system sans, monospace numbers, hairline borders). Light and dark themes.
- **This stage is an EXPLORER, not a simulator**: the user turns, cuts, measures and compares real structures. No time simulation.
- **Level: concept.** Plain words. The owner is an architect; wherever it is natural, connect a structure to a building material or to indoor air (steel, aluminum, glass, concrete, gypsum, ice, plastics, refrigerants).
- **Units:** lengths in ångström (Å) with a one-time note "1 Å = 0.1 nanometer"; angles in degrees; density in g/cm³; mass in g/mol.
- **Honesty about data:** every structure carries `source` and `quality`: `'reference'` (standard textbook lattice constants / bond lengths), `'approximate'` (reasonable values from memory), or `'schematic'` (a drawing that shows the idea, not measured positions — e.g. glass, liquid water, polymer chains). The UI must show a visible "Schematic" or "Approximate" tag for those.
- Atom colors follow the standard CPK convention (H white, C dark gray, N blue, O red, F green, Na violet, Mg green, Al gray-pink, Si tan, S yellow, Cl green, Ca gray-green, Ti gray, Fe orange-brown, Cu copper, Zn slate, Cs purple). These colors are scientific content and stay bold; UI chrome stays neutral.
- UI text: short plain words, sentence case, no contractions.
- Selection must never move the camera. Frame once at mount and when the structure changes.
- Pure modules (`elements.js`, `chem.js`, `molecule-data.js`, `lattice.js`, `crystal-data.js`, `compare-data.js`) have no DOM and no Three.js and run in Node 22 (`node --test tests/mol-*.test.mjs`).
- Only edit files you own. Never edit `CONTRACT*.md`. Do not commit or push.
- Targets: iPhone (Home Screen web app), iPad, Mac. Must stay smooth with ~2,000 atoms (use InstancedMesh).

## 1. Files and owners

```
molecules/index.html          shell page                                              (C3)
molecules/main.js             store, mode switch, panel tabs                          (C3)
molecules/viewer.js           shared 3D atom/bond renderer + picking + measuring      (C3)
molecules/elements.js         element table                                           (A3)
molecules/chem.js             geometry helpers (pure)                                 (A3)
molecules/molecule-data.js    molecule library                                        (A3)
molecules/lattice.js          crystal math (pure)                                     (B3)
molecules/crystal-data.js     crystal library                                         (B3)
molecules/compare-data.js     comparison pairs + schematic generators (pure)          (F3)
molecules/mode-molecules.js   Molecules mode                                          (D3)  (C3 writes a stub)
molecules/mode-crystals.js    Crystals mode                                           (E3)  (C3 writes a stub)
molecules/mode-compare.js     Compare mode                                            (F3)  (C3 writes a stub)
tests/mol-chem.test.mjs                                                               (A3)
tests/mol-lattice.test.mjs                                                            (B3)
tests/mol-compare.test.mjs                                                            (F3)
index.html (hub)              enable the Molecules and Crystals card → `molecules/`   (C3)
sw.js                         add the molecules files, bump CACHE to v6               (C3)
README.md                     add a short Stage 3 section                             (C3)
```
Modes may add files named `molecules/molecules-*.js`, `molecules/crystals-*.js`, `molecules/compare-*.js` and must report them (they go in `sw.js`).

## 2. Shared data shape — a "structure"

Every renderable thing (a molecule, a crystal block, a schematic) is converted to this shape before it reaches `viewer.js`:

```js
structure = {
  atoms: [ { el:'O', pos:[x,y,z] /* Å */, id?:number, tag?:string } ],   // tag: free label, e.g. 'interstitial', 'corner', 'chain-A'
  bonds: [ { a:indexA, b:indexB, order:1|2|3|1.5 } ],                    // may be empty (metals: bonds optional "sticks" to nearest neighbors)
  cell?:  { origin:[x,y,z], a:[x,y,z], b:[x,y,z], c:[x,y,z] },           // unit cell (or supercell) edge vectors for drawing the box
  extras?: { planes?:[ { points:[[x,y,z],...], label } ], arrows?:[ { from:[x,y,z], to:[x,y,z], label } ] },
}
```

## 3. Part A3 — elements, chemistry helpers, molecule library

### 3.1 `molecules/elements.js`
```js
export const ELEMENTS = { H:{ symbol:'H', name:'Hydrogen', Z:1, mass:1.008, color:'#f2f2f2', covalent:0.31, vdw:1.20, metallic:null }, ... };
```
Required: H, C, N, O, F, Na, Mg, Al, Si, S, Cl, Ca, Ti, Fe, Cu, Zn, Cs. `covalent` and `vdw` radii in Å (standard tables; Cordero covalent radii, Bondi/Alvarez vdW). `metallic` = metallic radius in Å for metals (Fe 1.26, Al 1.43, Cu 1.28, Zn 1.34, Ti 1.47, Mg 1.60, Na 1.86, Ca 1.97, Cs 2.65) else null. Colors readable in both themes (the viewer adds a thin outline).

### 3.2 `molecules/chem.js` (pure)
```js
export function dist(p, q)                       // Å
export function angleDeg(p, q, r)                // angle at q
export function dihedralDeg(p, q, r, s)
export function centroid(atoms)                  // -> [x,y,z]
export function centerStructure(structure)       // returns a copy centered on the centroid
export function molarMass(atoms)                 // g/mol
export function formula(atoms)                   // Hill order string, e.g. 'C2H6O'  (plus formulaHtml with <sub>)
export function guessBonds(atoms, tolerance=0.45)// bonds where distance < covalent(a)+covalent(b)+tolerance; order 1
export function boundingRadius(structure)        // max distance from centroid, Å
export function fromZMatrix(rows)                // build cartesian coordinates from internal coordinates
        // rows: [ {el}, {el, ref:[i], d}, {el, ref:[i,j], d, a}, {el, ref:[i,j,k], d, a, t} ]  (d Å, a and t degrees)
```

### 3.3 `molecules/molecule-data.js`
```js
export const MOLECULES = {
  water: {
    id:'water', name:'Water', formula:'H2O', group:'air',        // groups: 'air' | 'fuel' | 'indoor' | 'refrigerant' | 'building'
    atoms:[...], bonds:[...],                                    // structure shape, centered
    shape:'Bent', shapeWhy:'Two lone pairs on oxygen push the two O–H bonds together.',
    polar:true, dipole:1.85 /* debye */, dipoleDir:[x,y,z] /* unit vector, from + toward − end, or null */,
    facts:[ 'short plain sentence', ... ],                       // 2–4 facts; at least one linked to buildings where natural
    keyBonds:[ { label:'O–H', a:0, b:1, length:0.957 } ], keyAngles:[ { label:'H–O–H', a:1, b:0, c:2, angle:104.5 } ],
    source:'CRC Handbook / NIST CCCBDB values', quality:'reference',
  }, ...
};
export const MOLECULE_ORDER = [...]; export const MOLECULE_GROUPS = { air:'Air', fuel:'Fuels', indoor:'Indoor air', refrigerant:'Refrigerants', building:'Building plastics' };
```
Required molecules (build geometry from internal coordinates with these reference values; tests assert key lengths ±0.01 Å and angles ±0.5°):
- air: nitrogen N2 (N≡N 1.098), oxygen O2 (O=O 1.208), carbon dioxide (C=O 1.160, linear 180°), water (O–H 0.957, 104.5°, dipole 1.85 D), argon is NOT needed.
- fuel: methane (C–H 1.087, 109.47°, non-polar), propane (C–C 1.526, C–H ~1.09, C–C–C 112.4°).
- indoor: formaldehyde CH2O (C=O 1.208, C–H 1.116, H–C–H 116.5°, dipole 2.33 D), ammonia (N–H 1.012, H–N–H 106.7°, dipole 1.47 D), carbon monoxide (C≡O 1.128, dipole 0.11 D), ozone (O–O 1.272, 116.8°, dipole 0.53 D), radon is NOT needed.
- refrigerant: difluoromethane R-32 CH2F2 (C–F 1.357, C–H 1.093, F–C–F 108.3°, dipole 1.98 D), R-134a C2H2F4 (approximate geometry; quality 'approximate').
- building (monomers and small pieces of plastics): ethylene C2H4 (C=C 1.339, C–H 1.087, H–C–H 117.4°), vinyl chloride C2H3Cl (approximate; C–Cl 1.73), styrene C8H8 (approximate; benzene ring C–C 1.397), plus benzene C6H6 (C–C 1.397, C–H 1.087, flat hexagon) as the ring reference.
Order double bonds/triple bonds correctly in `bonds`. Dipole directions must be physically right (toward the more electronegative end).

## 4. Part B3 — crystal math and crystal library

### 4.1 `molecules/lattice.js` (pure)
```js
export function cellVectors({ a, b, c, alpha=90, beta=90, gamma=90 })     // -> { a:[x,y,z], b:[...], c:[...] } Å; a along +x, b in the xy plane
export function cellVolume(cell)                                           // Å³
export function fracToCart(frac, vectors)
export function buildBlock(crystal, { nx=1, ny=1, nz=1, includeBoundary=true }) // -> structure (section 2)
        // Repeats the basis; with includeBoundary, atoms on faces/edges/corners are repeated so cells look complete (tag 'boundary' for the extra copies).
        // Adds `cell` = the whole block's edge vectors and `unitCell` = one cell's vectors. Bonds: from crystal.bondRule (see below) or none.
export function neighbors(crystal, basisIndex, cutoff)                     // periodic neighbor list -> [ { el, d, vec:[x,y,z] } ] sorted by d
export function coordination(crystal, basisIndex, tol=0.08)                // -> { number, distance } counting the nearest shell (within tol·d)
export function density(crystal)                                           // g/cm³ from basis masses and cell volume
export function atomsPerCell(crystal)                                      // number of basis atoms (each basis atom listed once)
export function packingFraction(crystal)                                   // hard spheres touching along nearest neighbors (single-element crystals); else null
export function planePolygon(vectors, [h,k,l], d=1)                        // polygon where the (hkl) plane cuts ONE unit cell -> [[x,y,z],...]
```
### 4.2 `molecules/crystal-data.js`
```js
export const CRYSTALS = {
  fe_bcc: {
    id:'fe_bcc', name:'Iron, room temperature (ferrite)', short:'Iron (BCC)', group:'metal',   // groups: 'metal' | 'ionic' | 'covalent' | 'mineral' | 'ice'
    system:'cubic', lattice:'Body-centered cubic', params:{ a:2.8665, b:2.8665, c:2.8665, alpha:90, beta:90, gamma:90 },
    basis:[ { el:'Fe', frac:[0,0,0] }, { el:'Fe', frac:[0.5,0.5,0.5] } ],     // every atom in ONE conventional cell, listed once
    bondRule:{ pairs:[['Fe','Fe']], max:2.6 } | null,                         // draw sticks between these element pairs closer than max Å
    planes:[ { hkl:[1,1,0], label:'Closest-packed plane (110)', note:'...' } ],
    facts:[ ... 2–4 plain sentences, linked to buildings where natural ... ],
    expect:{ density:7.874, coordination:8, nearest:2.4825, atomsPerCell:2, packing:0.680 },   // used by tests and shown as reference
    source:'Standard lattice constant', quality:'reference',
  }, ...
};
export const CRYSTAL_ORDER = [...]; export const CRYSTAL_GROUPS = { metal:'Metals', ionic:'Salts', covalent:'Carbon and silicon', mineral:'Minerals', ice:'Ice' };
```
Required crystals and check values (tests assert density ±1 %, nearest-neighbor distance ±0.005 Å, coordination exact, packing ±0.002):

| id | lattice / params (Å) | basis | density | coordination, nearest | packing |
|---|---|---|---|---|---|
| fe_bcc | BCC a 2.8665 | 2 Fe | 7.874 | 8, 2.4825 | 0.680 |
| fe_fcc | FCC a 3.647 (austenite, hot) | 4 Fe | 7.647 | 12, 2.5788 | 0.740 |
| al_fcc | FCC a 4.0495 | 4 Al | 2.699 | 12, 2.8634 | 0.740 |
| cu_fcc | FCC a 3.6149 | 4 Cu | 8.935 | 12, 2.5561 | 0.740 |
| zn_hcp | HCP a 2.6649 c 4.9468 (γ 120°) | 2 Zn at (1/3,2/3,1/4),(2/3,1/3,3/4) | 7.137 | 6 nearest at 2.6649 (+6 a little farther: zinc is stretched) | — |
| ti_hcp | HCP a 2.9508 c 4.6855 | 2 Ti | 4.499 | 6 at ~2.896 + 6 at 2.9508 (report the nearest shell) | — |
| mg_hcp | HCP a 3.2094 c 5.2108 | 2 Mg | 1.737 | 6 at ~3.197 + 6 at 3.2094 | — |
| nacl | rock salt a 5.6402 | 4 Na + 4 Cl | 2.164 | 6, 2.8201 | — |
| cscl | CsCl a 4.123 | 1 Cs + 1 Cl | 3.989 | 8, 3.5706 | — |
| diamond | diamond cubic a 3.5669 | 8 C | 3.516 | 4, 1.5445 | 0.340 |
| silicon | diamond cubic a 5.4310 | 8 Si | 2.329 | 4, 2.3517 | 0.340 |
| graphite | hexagonal a 2.461 c 6.708 (AB stacking) | 4 C | 2.267 | 3, 1.4209 (layers 3.354 apart) | — |
| ice_ih | hexagonal a 4.518 c 7.356; O at (1/3,2/3,0.0625),(2/3,1/3,0.5625),(1/3,2/3,0.4375),(2/3,1/3,0.9375); H: one arrangement that obeys the ice rules (2 near + 2 far H per O, O–H 0.985 along O···O) | 4 H2O | 0.920 | each O has 4 O neighbors at 2.76 ± 0.02 | — |
| quartz | α-quartz, trigonal P3₂21 (or P3₁21), a 4.9133 c 5.4053; Si at (u,0,2/3)-type sites with u ≈ 0.4697; O at general position ≈ (0.4135, 0.2669, 0.1191 + offset per setting) | 3 SiO2 | 2.649 | each Si has 4 O at 1.61 ± 0.02; each O has 2 Si | — |
| calcite | hexagonal setting a 4.989 c 17.062, R-3c: Ca at (0,0,0), C at (0,0,1/4), O at (0.2568,0,1/4) + symmetry + rhombohedral centering | 6 CaCO3 | 2.711 | C–O 1.28 ± 0.02 (3 O per C, flat triangle); Ca has 6 O at ~2.36 | — |

For quartz and calcite the symmetry expansion must be done carefully and VERIFIED by the coordination tests above. If a structure cannot be made to pass its coordination test, replace it with a simpler correct one (quartz → idealized β-cristobalite, cubic Fd-3m a 7.16 Å: Si on a diamond lattice, O at bond midpoints, quality 'approximate') and report it. Never ship a structure that fails its own test.
Facts must include the building links: BCC vs FCC iron (carbon fits better in FCC → heat treatment of steel), aluminum FCC (soft, easy to form), zinc (galvanizing), titanium, copper (wiring, roofing), NaCl (de-icing salt, efflorescence look-alike), diamond vs graphite, silicon (solar cells, chips), ice (open cage → ice is less dense than water → frost damage), quartz (sand, the ordered form of glass), calcite (limestone, marble, cement feedstock).

## 5. Part C3 — shell, viewer, hub

### 5.1 `molecules/index.html` + `molecules/main.js`
Same structure as `orbital/index.html` / `orbital/main.js`: regions `#stage`, `#panel-a/b/c`, `#summary`, mode tabs, hash routing `#molecules` / `#crystals` / `#compare`, service-worker registration (relative path). Title "Molecules and Crystals", back link "Lab".
```js
initialState = {
  mode: 'molecules',
  view: { style:'ball-stick' /* 'ball-stick' | 'space-fill' | 'sticks' */, labels:false, spin:false },
  molecules: { id:'water', showDipole:true },
  crystals:  { id:'fe_bcc', nx:2, ny:2, nz:2, showCell:true, plane:null, showBonds:true },
  compare:   { pairId:'iron' },
}
// ctx = { stageEl, panelA, panelB, panelC, summaryEl, store, stage, isNarrow() }
// mode module: export default { id, label, panelTitles:{a,b,c}, mount(ctx), unmount() }
```
### 5.2 `molecules/viewer.js`
```js
import { THREE } from '../shared/scene.js';
export function createViewer(stage, opts = {}) -> {
  group,                                   // THREE.Group added to stage.scene
  setStructure(structure, { style, radiusScale, colorBy:'element'|'tag', tagColors, fade:{ tag:opacity } }),
        // style 'ball-stick': atom radius ≈ 0.3–0.45 × covalent/metallic radius scaled for clarity + cylinder bonds (double/triple shown as 2/3 thin cylinders, 1.5 as one + dashed);
        // 'space-fill': van der Waals (molecules) or touching radii (metals/ionic: pass radiusScale); 'sticks': bonds only + small joints.
        // Uses InstancedMesh per element for atoms and one InstancedMesh for bonds. Smooth with 2,000 atoms.
  setStyle(style), setLabels(on),          // labels = element symbols as small quiet sprites (only when atom count ≤ 150)
  setCell(cellOrNull),                     // draws the cell box as thin lines (hairline color from the theme)
  setPlanes(planes /* [{points,label,color?}] */), setArrows(arrows /* [{from,to,label,color?}] */),
  highlight(indices /* atom indices */, { color } ), clearHighlight(),
  pickAtom(clientX, clientY) -> { index, atom } | null,
  measure: { add(index) -> { type:'none'|'distance'|'angle', value, indices }, clear(), get() },
        // tap 2 atoms → distance (Å, drawn as a dashed line + label); 3 atoms → angle (degrees, drawn as an arc/label); a 4th tap starts over.
  frame(),                                 // fit the camera to the current structure ONCE (call at mount and when the structure changes — never on selection)
  setSpin(on),                             // slow turntable (off when prefers-reduced-motion)
  boundingRadius(),
  dispose(),
}
export const STYLE_OPTIONS = [ {value:'ball-stick', label:'Ball and stick'}, {value:'space-fill', label:'Space filling'}, {value:'sticks', label:'Sticks'} ];
export function viewControls(store, viewer) -> HTMLElement   // a compact section built from ui.js: Style segmented, Labels toggle, Spin toggle, "Clear measure" and "Reset view" buttons — bound to store.view
```
Rendering rules: MeshStandardMaterial with soft lighting from the stage; each atom sphere gets a subtle dark rim (e.g. a slightly larger back-face shell or an outline pass substitute) so white hydrogen reads on the light theme and dark carbon reads on the dark theme; bonds neutral gray (split-colored half/half by element is fine). Label sprites quiet (sentence case, system sans, small). Orthographic-looking perspective (narrow FOV ~25°) so cubes look like cubes.

### 5.3 Stubs, hub, service worker, README
- Stub `mode-*.js`: each shows one hard-coded structure through `createViewer` (molecules stub: a hand-typed water molecule; crystals stub: a hand-typed 2×2×2 block of simple-cubic atoms with a cell box; compare stub: both side by side or toggled), the `viewControls`, tap-to-measure wired to a `ui.stat`, and a few ui.js components per panel. Stubs must not import A3/B3 data files (they may not exist yet).
- Hub `index.html`: make the Molecules and Crystals card a live link to `molecules/` (same compact card style as Orbital Mechanics; description "Molecules, crystal lattices, and why materials behave as they do."; chips Molecules / Crystals / Compare). Leave Earth Systems as "not built".
- `sw.js`: add every `molecules/*` file listed in section 1 to FILES; bump CACHE to `science-lab-v6`.
- `README.md`: add a short "Stage 3: Molecules and Crystals" section (three modes in a small table, units, the reference / approximate / schematic labels).

## 6. Parts D3, E3, F3 — the three modes (wave 2; details in each worker brief)
