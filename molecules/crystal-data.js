/**
 * Crystal library for the Molecules and Crystals explorer (pure module).
 * Shapes follow CONTRACT-MOLECULES.md section 4.2. Lengths in angstrom (A),
 * angles in degrees, density in g/cm3.
 *
 * Extra fields beyond the contract (all optional, all documented here):
 *  - paramNote: a plain sentence about where the lattice constants come from.
 *  - cellNote: a plain sentence about the cell that is drawn.
 *  - hbondRule: { pairs, min, max } for dashed hydrogen bonds (ice only).
 *  - planes[].d: plane offset for planePolygon(vectors, hkl, d), in fractional units.
 *  - expect.neighborEl: when set, coordination and nearest refer to neighbors of that element only.
 *  - expect.coordinationTol: shell width passed to coordination() to reproduce expect.coordination.
 *  - expect.shells: [{n, d}] the first neighbor shells of basis atom 0 (HCP metals).
 *  - expect.sites: [{ el, coordination, nearest }] values for other element sites.
 *  - expect.formulaUnits: number of formula units in the cell (atomsPerCell counts atoms).
 */

const THIRD = 1 / 3;
const TWO_THIRDS = 2 / 3;

/** Wrap a fractional coordinate into [0, 1), snapping values near 0 or 1 to 0. */
function wrap(f) {
  let r = f - Math.floor(f + 1e-9);
  if (r > 1 - 1e-7) r = 0;
  return Math.abs(r) < 1e-9 ? 0 : r;
}

/**
 * Expand symmetry-equivalent positions of one site into distinct basis atoms.
 * @param {string} el element symbol
 * @param {Array<(x:number,y:number,z:number)=>number[]>} ops symmetry operations
 * @param {number[]} site starting position
 * @returns {{el:string, frac:number[]}[]}
 */
function expandSite(el, ops, site) {
  const out = [];
  for (const op of ops) {
    const frac = op(...site).map(wrap);
    const seen = out.some((q) => q.frac.every((v, i) => Math.abs(v - frac[i]) < 1e-6));
    if (!seen) out.push({ el, frac });
  }
  return out;
}

/**
 * Symmetry operations of space group P3(2)21 (No. 154), hexagonal axes.
 * This is the left-handed alpha quartz setting used here (P3(1)21 is the mirror image).
 */
const P3221_OPS = [
  (x, y, z) => [x, y, z],
  (x, y, z) => [-y, x - y, z + TWO_THIRDS],
  (x, y, z) => [-x + y, -x, z + THIRD],
  (x, y, z) => [y, x, -z],
  (x, y, z) => [x - y, -y, -z + THIRD],
  (x, y, z) => [-x, -x + y, -z + TWO_THIRDS],
];

/** Quartz atoms: Si on site 3a (u,0,2/3) with u = 0.4697, O on site 6c at (0.4135, 0.2669, 0.7858). */
const QUARTZ_BASIS = [
  ...expandSite('Si', P3221_OPS, [0.4697, 0, TWO_THIRDS]),
  ...expandSite('O', P3221_OPS, [0.4135, 0.2669, 0.1191 + TWO_THIRDS]),
];

/** Rhombohedral centering translations of the hexagonal R lattice. */
const R_CENTERING = [[0, 0, 0], [TWO_THIRDS, THIRD, THIRD], [THIRD, TWO_THIRDS, TWO_THIRDS]];
const CALCITE_X = 0.2568;

/** Apply the three R-centering translations to a list of positions. */
function centered(el, sites) {
  const out = [];
  for (const t of R_CENTERING) {
    for (const s of sites) out.push({ el, frac: s.map((v, i) => wrap(v + t[i])) });
  }
  return out;
}

/** Calcite atoms in the hexagonal setting of R-3c, 6 CaCO3 per cell. */
const CALCITE_BASIS = [
  ...centered('Ca', [[0, 0, 0], [0, 0, 0.5]]),
  ...centered('C', [[0, 0, 0.25], [0, 0, 0.75]]),
  ...centered('O', [
    [CALCITE_X, 0, 0.25], [0, CALCITE_X, 0.25], [-CALCITE_X, -CALCITE_X, 0.25],
    [-CALCITE_X, 0, 0.75], [0, -CALCITE_X, 0.75], [CALCITE_X, CALCITE_X, 0.75],
  ]),
];

/**
 * Ice Ih, one proton arrangement that obeys the ice rules inside a single
 * 4-molecule hexagonal cell. Oxygen positions come from the contract; each
 * hydrogen sits 0.985 Å from its oxygen along an O...O link. The hydrogen
 * fractions are not wrapped into [0,1) so every water molecule stays whole.
 */
const ICE_BASIS = [
  { el: 'O', frac: [THIRD, TWO_THIRDS, 0.0625] },
  { el: 'O', frac: [TWO_THIRDS, THIRD, 0.5625] },
  { el: 'O', frac: [THIRD, TWO_THIRDS, 0.4375] },
  { el: 'O', frac: [TWO_THIRDS, THIRD, 0.9375] },
  { el: 'H', frac: [0.095909, 0.547954, 0.017983] },
  { el: 'H', frac: [0.452046, 0.904091, 0.017983] },
  { el: 'H', frac: [0.904091, 0.452046, 0.517983] },
  { el: 'H', frac: [0.547954, 0.095909, 0.517983] },
  { el: 'H', frac: [0.333333, 0.666667, 0.303596] },
  { el: 'H', frac: [0.452046, 0.547954, 0.482017] },
  { el: 'H', frac: [0.547954, 0.452046, 0.982017] },
  { el: 'H', frac: [0.666667, 0.333333, 0.803596] },
];

const CUBIC = (a) => ({ a, b: a, c: a, alpha: 90, beta: 90, gamma: 90 });
const HEX = (a, c) => ({ a, b: a, c, alpha: 90, beta: 90, gamma: 120 });
const HCP_BASIS = (el) => [
  { el, frac: [THIRD, TWO_THIRDS, 0.25] },
  { el, frac: [TWO_THIRDS, THIRD, 0.75] },
];
const FCC_BASIS = (el) => [
  { el, frac: [0, 0, 0] }, { el, frac: [0.5, 0.5, 0] },
  { el, frac: [0.5, 0, 0.5] }, { el, frac: [0, 0.5, 0.5] },
];
const DIAMOND_BASIS = (el) => [
  ...FCC_BASIS(el),
  { el, frac: [0.25, 0.25, 0.25] }, { el, frac: [0.75, 0.75, 0.25] },
  { el, frac: [0.75, 0.25, 0.75] }, { el, frac: [0.25, 0.75, 0.75] },
];

/** Planes shown for cubic close-packed metals. d is the plane offset for planePolygon. */
const FCC_PLANES = [
  { hkl: [1, 1, 1], d: 1, label: 'Closest-packed plane (111)', note: 'Every atom touches six neighbors in this plane. Layers of this plane stack as A, B, C.' },
  { hkl: [1, 0, 0], d: 1, label: 'Cube face (100)', note: 'A square arrangement with four neighbors. It is less crowded than the (111) plane.' },
];
const HCP_PLANES = [
  { hkl: [0, 0, 1], d: 0.25, label: 'Basal plane (0001)', note: 'Closest-packed layer. Layers stack as A, B, A, B.' },
];

/**
 * The crystal library, keyed by id.
 * @type {Record<string, object>}
 */
export const CRYSTALS = {
  fe_bcc: {
    id: 'fe_bcc', name: 'Iron, room temperature (ferrite)', short: 'Iron (BCC)', group: 'metal',
    system: 'cubic', lattice: 'Body-centered cubic', params: CUBIC(2.8665),
    basis: [{ el: 'Fe', frac: [0, 0, 0] }, { el: 'Fe', frac: [0.5, 0.5, 0.5] }],
    bondRule: { pairs: [['Fe', 'Fe']], max: 2.4825 * 1.05 },
    planes: [
      { hkl: [1, 1, 0], d: 1, label: 'Closest-packed plane (110)', note: 'The most crowded plane in BCC iron. Each atom has four neighbors in it.' },
      { hkl: [1, 0, 0], d: 1, label: 'Cube face (100)', note: 'A square arrangement. The body-center atom is not on this plane.' },
    ],
    facts: [
      'Each iron atom has 8 nearest neighbors, and the atoms fill 68 percent of the space.',
      'Iron is BCC at room temperature. This form is called ferrite and it makes up much of the structure of steel.',
      'The gaps between atoms in BCC iron are small, so it can hold only a tiny amount of carbon.',
      'Heated steel changes to the FCC form, where carbon fits much better. This is the basis of heat treatment of steel.',
    ],
    expect: { density: 7.874, coordination: 8, nearest: 2.4825, atomsPerCell: 2, packing: 0.680 },
    source: 'Standard lattice constant for alpha iron at room temperature', quality: 'reference',
  },

  fe_fcc: {
    id: 'fe_fcc', name: 'Iron, hot (austenite)', short: 'Iron (FCC)', group: 'metal',
    system: 'cubic', lattice: 'Face-centered cubic', params: CUBIC(3.647),
    paramNote: 'The constant 3.647 Å is the high-temperature value, measured on hot iron above about 912 degrees C. Pure iron is not FCC at room temperature.',
    basis: FCC_BASIS('Fe'),
    bondRule: { pairs: [['Fe', 'Fe']], max: 2.5788 * 1.05 },
    planes: FCC_PLANES,
    facts: [
      'Each iron atom has 12 nearest neighbors, and the atoms fill 74 percent of the space, the most that equal spheres can achieve.',
      'Pure iron takes this FCC form (austenite) above about 912 degrees C. The lattice constant here is the high-temperature value.',
      'The gaps between atoms are larger in FCC iron than in BCC iron, so much more carbon can dissolve in it.',
      'Steel is heated into this form and then cooled in a controlled way. This heat treatment sets the hardness of structural steel.',
    ],
    expect: { density: 7.647, coordination: 12, nearest: 2.5788, atomsPerCell: 4, packing: 0.740 },
    source: 'Standard lattice constant for gamma iron at high temperature', quality: 'reference',
  },

  al_fcc: {
    id: 'al_fcc', name: 'Aluminum', short: 'Aluminum (FCC)', group: 'metal',
    system: 'cubic', lattice: 'Face-centered cubic', params: CUBIC(4.0495),
    basis: FCC_BASIS('Al'),
    bondRule: { pairs: [['Al', 'Al']], max: 2.8634 * 1.05 },
    planes: FCC_PLANES,
    facts: [
      'Aluminum is face-centered cubic, with 12 nearest neighbors for every atom.',
      'FCC crystals have many close-packed planes that can slide over each other, so aluminum is soft and easy to extrude and bend.',
      'Aluminum has about one third of the density of steel, which is why it is used for window frames, curtain walls and cladding.',
    ],
    expect: { density: 2.699, coordination: 12, nearest: 2.8634, atomsPerCell: 4, packing: 0.740 },
    source: 'Standard lattice constant at room temperature', quality: 'reference',
  },

  cu_fcc: {
    id: 'cu_fcc', name: 'Copper', short: 'Copper (FCC)', group: 'metal',
    system: 'cubic', lattice: 'Face-centered cubic', params: CUBIC(3.6149),
    basis: FCC_BASIS('Cu'),
    bondRule: { pairs: [['Cu', 'Cu']], max: 2.5561 * 1.05 },
    planes: FCC_PLANES,
    facts: [
      'Copper is face-centered cubic, with 12 nearest neighbors for every atom.',
      'The close-packed planes slide easily, so copper can be drawn into thin wire and rolled into sheet.',
      'Copper carries electricity very well, so it is the standard metal for building wiring.',
      'Copper sheet is used for roofing and flashing, and copper tube for plumbing.',
    ],
    expect: { density: 8.935, coordination: 12, nearest: 2.5561, atomsPerCell: 4, packing: 0.740 },
    source: 'Standard lattice constant at room temperature', quality: 'reference',
  },

  zn_hcp: {
    id: 'zn_hcp', name: 'Zinc', short: 'Zinc (HCP)', group: 'metal',
    system: 'hexagonal', lattice: 'Hexagonal close-packed', params: HEX(2.6649, 4.9468),
    paramNote: 'The ratio c/a is 1.856, well above the ideal 1.633 for touching spheres. The layers are stretched apart.',
    basis: HCP_BASIS('Zn'),
    bondRule: { pairs: [['Zn', 'Zn']], max: 2.95 },
    planes: HCP_PLANES,
    facts: [
      'Zinc is hexagonal close-packed, but the layers are stretched apart. Each atom has 6 close neighbors in its own layer and 6 a little farther away in the layers above and below.',
      'Steel is coated with zinc by galvanizing. The zinc corrodes before the iron does, so it protects the steel in roofing, studs, fasteners and cladding.',
    ],
    expect: {
      density: 7.137, coordination: 6, coordinationTol: 0.001, nearest: 2.6649, atomsPerCell: 2, packing: null,
      shells: [{ n: 6, d: 2.6649 }, { n: 6, d: 2.9129 }],
    },
    source: 'Standard lattice constants at room temperature', quality: 'reference',
  },

  ti_hcp: {
    id: 'ti_hcp', name: 'Titanium', short: 'Titanium (HCP)', group: 'metal',
    system: 'hexagonal', lattice: 'Hexagonal close-packed', params: HEX(2.9508, 4.6855),
    basis: HCP_BASIS('Ti'),
    bondRule: { pairs: [['Ti', 'Ti']], max: 3.0 },
    planes: HCP_PLANES,
    facts: [
      'Titanium is hexagonal close-packed at room temperature. Six neighbors lie in the same layer and six lie in the layers above and below, at almost the same distance.',
      'Titanium is strong and has only about half the density of steel. It does not rust, so it is used for cladding and roofing on landmark buildings.',
    ],
    expect: {
      density: 4.499, coordination: 6, coordinationTol: 0.001, nearest: 2.8967, atomsPerCell: 2, packing: null,
      shells: [{ n: 6, d: 2.8967 }, { n: 6, d: 2.9508 }],
    },
    source: 'Standard lattice constants at room temperature', quality: 'reference',
  },

  mg_hcp: {
    id: 'mg_hcp', name: 'Magnesium', short: 'Magnesium (HCP)', group: 'metal',
    system: 'hexagonal', lattice: 'Hexagonal close-packed', params: HEX(3.2094, 5.2108),
    basis: HCP_BASIS('Mg'),
    bondRule: { pairs: [['Mg', 'Mg']], max: 3.3 },
    planes: HCP_PLANES,
    facts: [
      'Magnesium is hexagonal close-packed, close to the ideal arrangement. Six neighbors lie in the same layer and six lie in the layers above and below, at almost the same distance.',
      'Magnesium is the lightest common structural metal, with a density of 1.74 g/cm3, about a quarter of the density of steel.',
    ],
    expect: {
      density: 1.737, coordination: 6, coordinationTol: 0.001, nearest: 3.1971, atomsPerCell: 2, packing: null,
      shells: [{ n: 6, d: 3.1971 }, { n: 6, d: 3.2094 }],
    },
    source: 'Standard lattice constants at room temperature', quality: 'reference',
  },

  nacl: {
    id: 'nacl', name: 'Table salt (rock salt)', short: 'Salt (NaCl)', group: 'ionic',
    system: 'cubic', lattice: 'Rock salt (two interlocking FCC lattices)', params: CUBIC(5.6402),
    basis: [
      { el: 'Na', frac: [0, 0, 0] }, { el: 'Na', frac: [0.5, 0.5, 0] },
      { el: 'Na', frac: [0.5, 0, 0.5] }, { el: 'Na', frac: [0, 0.5, 0.5] },
      { el: 'Cl', frac: [0.5, 0, 0] }, { el: 'Cl', frac: [0, 0.5, 0] },
      { el: 'Cl', frac: [0, 0, 0.5] }, { el: 'Cl', frac: [0.5, 0.5, 0.5] },
    ],
    bondRule: { pairs: [['Na', 'Cl']], max: 3.0 },
    planes: [
      { hkl: [1, 0, 0], d: 1, label: 'Cube face (100)', note: 'Sodium and chlorine alternate like a checkerboard.' },
      { hkl: [1, 1, 1], d: 1, label: 'Plane (111)', note: 'Each (111) plane holds only one kind of ion, and the planes alternate.' },
    ],
    facts: [
      'Every sodium ion has 6 chlorine neighbors, and every chlorine ion has 6 sodium neighbors. The ions alternate in all three directions.',
      'The strong pull between opposite charges makes the crystal hard but brittle. It splits along cube faces.',
      'Rock salt is spread on roads and walkways to melt ice. The brine it makes can damage concrete and corrode reinforcing steel.',
      'The white crust called efflorescence on brick and concrete looks like salt. It is also dissolved mineral salts left behind when water dries.',
    ],
    expect: {
      density: 2.164, coordination: 6, nearest: 2.8201, atomsPerCell: 8, packing: null, formulaUnits: 4,
      sites: [{ el: 'Na', coordination: 6, nearest: 2.8201 }, { el: 'Cl', coordination: 6, nearest: 2.8201 }],
    },
    source: 'Standard lattice constant at room temperature', quality: 'reference',
  },

  cscl: {
    id: 'cscl', name: 'Cesium chloride', short: 'CsCl', group: 'ionic',
    system: 'cubic', lattice: 'Cesium chloride (two interlocking simple cubic lattices)', params: CUBIC(4.123),
    basis: [{ el: 'Cs', frac: [0, 0, 0] }, { el: 'Cl', frac: [0.5, 0.5, 0.5] }],
    bondRule: { pairs: [['Cs', 'Cl']], max: 3.7 },
    planes: [
      { hkl: [1, 1, 0], d: 1, label: 'Plane (110)', note: 'Cesium and chlorine both lie in this plane.' },
      { hkl: [1, 0, 0], d: 1, label: 'Cube face (100)', note: 'Only one kind of ion lies on the cube face.' },
    ],
    facts: [
      'Every cesium ion has 8 chlorine neighbors and every chlorine ion has 8 cesium neighbors.',
      'Cesium ions are much larger than sodium ions, so more chlorine ions fit around them. Compare this with table salt, which has 6 neighbors.',
      'The size ratio of the two ions decides the structure of a salt. This is a general rule for ionic solids, including many ceramic minerals.',
    ],
    expect: {
      density: 3.989, coordination: 8, nearest: 3.5706, atomsPerCell: 2, packing: null, formulaUnits: 1,
      sites: [{ el: 'Cs', coordination: 8, nearest: 3.5706 }, { el: 'Cl', coordination: 8, nearest: 3.5706 }],
    },
    source: 'Standard lattice constant at room temperature', quality: 'reference',
  },

  diamond: {
    id: 'diamond', name: 'Diamond', short: 'Diamond', group: 'covalent',
    system: 'cubic', lattice: 'Diamond cubic', params: CUBIC(3.5669),
    basis: DIAMOND_BASIS('C'),
    bondRule: { pairs: [['C', 'C']], max: 1.6 },
    planes: [
      { hkl: [1, 1, 1], d: 1, label: 'Plane (111)', note: 'Diamond splits easily along this plane, which is how gem cutters shape it.' },
      { hkl: [1, 0, 0], d: 1, label: 'Cube face (100)', note: 'The cube face of the conventional cell.' },
    ],
    facts: [
      'Every carbon atom bonds to 4 others, arranged as a tetrahedron. The bond angle is 109.5 degrees.',
      'These strong bonds run in every direction, so diamond is the hardest natural material. Diamond-tipped blades and bits cut concrete and stone.',
      'Graphite is also pure carbon. The two differ only in how the atoms are bonded.',
    ],
    expect: { density: 3.516, coordination: 4, nearest: 1.5445, atomsPerCell: 8, packing: 0.340 },
    source: 'Standard lattice constant at room temperature', quality: 'reference',
  },

  silicon: {
    id: 'silicon', name: 'Silicon', short: 'Silicon', group: 'covalent',
    system: 'cubic', lattice: 'Diamond cubic', params: CUBIC(5.4310),
    basis: DIAMOND_BASIS('Si'),
    bondRule: { pairs: [['Si', 'Si']], max: 2.5 },
    planes: [
      { hkl: [1, 1, 1], d: 1, label: 'Plane (111)', note: 'A puckered layer of atoms, each bonded to three atoms in the next layer.' },
      { hkl: [1, 0, 0], d: 1, label: 'Cube face (100)', note: 'The cube face. Chip wafers are most often cut along this plane.' },
    ],
    facts: [
      'Silicon has the same structure as diamond. Every atom bonds to 4 others in a tetrahedron.',
      'Pure silicon crystals are cut into wafers for solar cells and computer chips. Solar panels on roofs and facades are made of it.',
      'In nature silicon is bonded to oxygen, as in quartz, sand and glass.',
    ],
    expect: { density: 2.329, coordination: 4, nearest: 2.3517, atomsPerCell: 8, packing: 0.340 },
    source: 'Standard lattice constant at room temperature', quality: 'reference',
  },

  graphite: {
    id: 'graphite', name: 'Graphite', short: 'Graphite', group: 'covalent',
    system: 'hexagonal', lattice: 'Hexagonal layers, AB stacking', params: HEX(2.461, 6.708),
    basis: [
      { el: 'C', frac: [0, 0, 0.25] }, { el: 'C', frac: [THIRD, TWO_THIRDS, 0.25] },
      { el: 'C', frac: [0, 0, 0.75] }, { el: 'C', frac: [TWO_THIRDS, THIRD, 0.75] },
    ],
    bondRule: { pairs: [['C', 'C']], max: 1.5 },
    planes: [
      { hkl: [0, 0, 1], d: 0.25, label: 'Carbon layer (0001)', note: 'One flat sheet of carbon rings. Sheets are 3.354 Å apart and held only by weak forces.' },
    ],
    facts: [
      'Each carbon atom bonds to 3 neighbors in a flat sheet of six-sided rings. The bond angle is 120 degrees.',
      'The sheets are 3.354 Å apart and held together only by weak forces, so they slide over each other. This is why graphite works as a pencil lead and a dry lubricant.',
      'Graphite is pure carbon, like diamond, yet it is soft and conducts electricity along the sheets.',
      'Carbon fiber, used to strengthen concrete and structural parts, is made of carbon in graphite-like sheets.',
    ],
    expect: { density: 2.267, coordination: 3, nearest: 1.4209, atomsPerCell: 4, packing: null },
    source: 'Standard lattice constants at room temperature', quality: 'reference',
  },

  ice_ih: {
    id: 'ice_ih', name: 'Ice (ordinary hexagonal ice)', short: 'Ice Ih', group: 'ice',
    system: 'hexagonal', lattice: 'Hexagonal, open cage of water molecules', params: HEX(4.518, 7.356),
    cellNote: 'One cell holds 4 water molecules. The hydrogen atoms are placed in one orderly arrangement that obeys the ice rules. Real ice has the same oxygen positions but the hydrogen atoms are arranged at random.',
    basis: ICE_BASIS,
    bondRule: { pairs: [['O', 'H']], max: 1.1 },
    hbondRule: { pairs: [['O', 'H']], min: 1.4, max: 2.1 },
    planes: [],
    facts: [
      'Each water molecule bonds to 4 others through hydrogen bonds, drawn as dashed lines. The 4 neighbors form a tetrahedron.',
      'The bonds build open rings of six molecules with empty space in the middle. This open cage makes ice about 8 percent less dense than liquid water.',
      'Water expands by about 9 percent when it freezes. This is why water that freezes in pipes, cracks and masonry causes frost damage.',
      'The ice rules say that every oxygen has two close hydrogen atoms and two far ones, and that every link between oxygen atoms carries exactly one hydrogen atom.',
    ],
    expect: {
      density: 0.920, coordination: 4, nearest: 2.76, atomsPerCell: 12, packing: null, formulaUnits: 4, neighborEl: 'O',
    },
    source: 'Standard lattice constants of ice Ih near 0 degrees C; hydrogen positions chosen to obey the ice rules', quality: 'reference',
  },

  quartz: {
    id: 'quartz', name: 'Quartz (alpha quartz)', short: 'Quartz', group: 'mineral',
    system: 'trigonal', lattice: 'Trigonal, space group P3(2)21 (left-handed quartz)', params: HEX(4.9133, 5.4053),
    cellNote: 'The cell holds 3 SiO2 units (3 silicon and 6 oxygen atoms). Every silicon sits in the middle of a tetrahedron of 4 oxygen atoms, and every oxygen joins 2 silicon atoms.',
    basis: QUARTZ_BASIS,
    bondRule: { pairs: [['Si', 'O']], max: 1.7 },
    planes: [],
    facts: [
      'Every silicon atom sits at the center of a tetrahedron of 4 oxygen atoms, and every oxygen atom is shared by 2 tetrahedra. The tetrahedra link into spirals.',
      'Quartz is the main mineral in sand. Sand is a basic ingredient of concrete, mortar and glass.',
      'Glass is made by melting sand. Glass has the same silicon-oxygen tetrahedra, but they are joined at random, while quartz is the ordered form.',
      'Quartz is hard and does not dissolve in water, so it survives weathering and fills beaches and riverbeds.',
    ],
    expect: {
      density: 2.649, coordination: 4, nearest: 1.604, atomsPerCell: 9, packing: null, formulaUnits: 3,
      sites: [{ el: 'Si', coordination: 4, nearest: 1.604 }, { el: 'O', coordination: 2, nearest: 1.604 }],
    },
    source: 'Alpha quartz at room temperature after Levien, Prewitt and Weidner (1980), positions expanded from the space-group operations', quality: 'reference',
  },

  calcite: {
    id: 'calcite', name: 'Calcite', short: 'Calcite', group: 'mineral',
    system: 'trigonal', lattice: 'Trigonal, space group R-3c (hexagonal setting)', params: HEX(4.989, 17.062),
    cellNote: 'The hexagonal cell holds 6 CaCO3 units (6 calcium, 6 carbon and 18 oxygen atoms).',
    basis: CALCITE_BASIS,
    bondRule: { pairs: [['C', 'O']], max: 1.4 },
    planes: [],
    facts: [
      'Each carbon atom bonds to 3 oxygen atoms in a flat triangle with 120 degree angles. Each calcium ion is surrounded by 6 oxygen atoms.',
      'Calcite is calcium carbonate, the main mineral of limestone and marble. Both are used as building stone.',
      'Heating limestone drives off carbon dioxide and leaves lime. Lime is the raw material of cement, and this step releases a large share of the carbon dioxide from concrete.',
      'Calcite dissolves slowly in acid, so acid rain wears carved limestone and marble.',
    ],
    expect: {
      density: 2.711, coordination: 6, nearest: 2.36, atomsPerCell: 30, packing: null, formulaUnits: 6,
      sites: [{ el: 'Ca', coordination: 6, nearest: 2.36 }, { el: 'C', coordination: 3, nearest: 1.28 }],
    },
    source: 'Standard calcite structure, space group R-3c, positions expanded from the symmetry operations and R centering', quality: 'reference',
  },
};

/** Display order of the crystals. */
export const CRYSTAL_ORDER = [
  'fe_bcc', 'fe_fcc', 'al_fcc', 'cu_fcc', 'zn_hcp', 'ti_hcp', 'mg_hcp',
  'nacl', 'cscl', 'diamond', 'silicon', 'graphite', 'ice_ih', 'quartz', 'calcite',
];

/** Group labels for the crystal picker. */
export const CRYSTAL_GROUPS = {
  metal: 'Metals', ionic: 'Salts', covalent: 'Carbon and silicon', mineral: 'Minerals', ice: 'Ice',
};
