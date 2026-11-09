// envelope/water.js  Water rules for Envelope Lab (Part F). Pure data and logic.
// No DOM, no Three.js. Runs in Node. Source: Ching, Building Construction Illustrated 6e.
// All text is short, plain words, no contractions. Lengths in inches (IP).
//
// COORDINATES
// 3D model (Walls and Errors views): inches. x along the wall, y up, z through the wall.
//   Interior face at z = 0, exterior at +z. Defined by WALL (Errors view) and STRAT (Walls view) below.
// 2D joint detail (Forces view): (u, v) in inches.
//   u = distance out from the face of the backup wall (u = 0 is the backup face, +u is outside, -u is the room side).
//   v = height (up is +v). The joint sits at v = 0. JOINT below gives the common dimensions.
//   The mode maps (u, v) to 3D as x = const, y = v, z = u so the section reads in the close-up.

export const SOURCES = { forces: 'BCI 7.23', strategies: 'BCI 7.23', layers: 'BCI 7.48', flashing: 'BCI 7.22' };

export const DIMENSIONS = {
  weepSpacingBrick: 24, // inches o.c., brick (BCI 7.22)
  weepSpacingCmu: 32, // inches o.c., concrete masonry (BCI 7.22)
  headFlashingTurnUp: 2, // inches (BCI 7.22)
  flashingProjection: 0.75, // inches past the wall face, turned down 45 degrees as a drip (BCI 7.22)
  flashingDripAngle: 45, // degrees
  minAirSpace: 2, // inches, when insulation is in the cavity (BCI 7.44)
};

// ---------------------------------------------------------------------------
// Errors view model: a drained brick wall with a window. 60 in by 60 in.
// ---------------------------------------------------------------------------
const FACE = 4.85 + 2.0 + 3.625; // brick outer face
export const WALL = {
  width: 60,
  height: 60,
  window: { x0: 20, x1: 40, y0: 24, y1: 42 }, // rough opening
  zStud0: 0, zStud1: 3.5, // framed backup, 3.5 in studs
  zSheathing0: 3.5, zSheathing1: 4.0, // sheathing 1/2 in
  // The WRB courses are drawn thicker and set apart so the lap reads in the model.
  zWrbBack0: 4.05, zWrbBack1: 4.3, // back course
  zWrbFront0: 4.6, zWrbFront1: 4.85, // front course
  zWrb: 4.85, // outer face of the WRB
  zCavity0: 4.85, zCavity1: 6.85, // drainage gap, 2 in
  zCladding0: 6.85, zCladding1: FACE, // brick, 3-5/8 in
  zFace: FACE,
  zFlashOut: FACE + DIMENSIONS.flashingProjection, // flashing edge, 3/4 in past the face
  zGlass: 3.9, // window glass plane
  lapY: 50, // WRB lap line
  lapOverlap: 3, // lap, inches
  headFlashY: 43, // head flashing, 1 in above the window head
  sillY: 24, // sill pan level
  baseFlashY: 4, // base flashing
  weepY: 5.2, // weep hole centre
  weepX: [6, 30, 54], // 24 in o.c.
  dripZ: 5.0, // z used for water running down the WRB face
};

// ---------------------------------------------------------------------------
// Walls view model: a 48 in by 48 in sample for each strategy (section cut at x = xCut)
// ---------------------------------------------------------------------------
export const STRAT = {
  size: 48,
  xCut: 48, // the section face
  xp: 44, // x used for every path, 4 in inside the section face (a weep hole lines up with it in the rainscreen)
  layers: {
    mass: [{ id: 'block', name: 'Masonry or concrete', z0: 0, z1: 12 }],
    barrier: [
      { id: 'sheathing', name: 'Sheathing', z0: 0, z1: 1 },
      { id: 'foam', name: 'Foam', z0: 1, z1: 4 },
      { id: 'coat', name: 'Finish coat', z0: 4, z1: 4.8 },
    ],
    drainage: [
      { id: 'sheathing', name: 'Sheathing', z0: 0, z1: 1 },
      { id: 'wrb', name: 'WRB', z0: 1, z1: 1.25 },
      { id: 'cladding', name: 'Cladding', z0: 1.25, z1: 2.75 },
    ],
    rainscreen: [
      { id: 'backup', name: 'Airtight backup wall', z0: 0, z1: 4 },
      { id: 'insulation', name: 'Insulation', z0: 4, z1: 6 },
      { id: 'wrb', name: 'WRB', z0: 6, z1: 6.25 },
      { id: 'cavity', name: 'Air cavity', z0: 6.25, z1: 8.25 },
      { id: 'brick', name: 'Brick', z0: 8.25, z1: 11.875 },
    ],
  },
  faceZ: { mass: 12, barrier: 4.8, drainage: 2.75, rainscreen: 11.875 },
  crackY: 30,
  flashY: 6, // rainscreen base flashing
  weepX: [20, 44], // 24 in o.c.
  weepY: 7.2,
};

// ---------------------------------------------------------------------------
// Forces view model: one cladding joint in section (u, v)
// ---------------------------------------------------------------------------
export const JOINT = {
  backU: 0, // backup wall face
  backDepth: 4, // backup wall drawn from u = -4 to 0
  cladInner: 1.5, // cladding inner face
  cladOuter: 4, // cladding outer face
  panelH: 10, // each panel is 10 in tall
  halfGap: 0.25, // joint half height (open joint)
  half: 12, // drawn from v = -12 to 12
};

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------
export const FORCES = [
  {
    id: 'momentum', name: 'Raindrop momentum', short: 'Wind-blown drops',
    problem: 'Wind-blown drops fly straight through an open joint.',
    defense: 'An overlap or an internal baffle absorbs the energy of the drop.',
    defenseName: 'Baffle', source: 'BCI 7.23',
  },
  {
    id: 'gravity', name: 'Gravity', short: 'Water runs down',
    problem: 'Water runs down and into any joint that slopes inward.',
    defense: 'Lap horizontal joints like shingles. Slope ledges down toward the outside.',
    defenseName: 'Lap and slope', source: 'BCI 7.23',
  },
  {
    id: 'tension', name: 'Surface tension', short: 'Water clings',
    problem: 'Water clings to the underside of a level surface and creeps back to the wall.',
    defense: 'A drip edge breaks the water film so the drops fall free.',
    defenseName: 'Drip edge', source: 'BCI 7.23',
  },
  {
    id: 'capillary', name: 'Capillary action', short: 'Water wicks',
    problem: 'Water wicks through a narrow gap, even uphill.',
    defense: 'A capillary break is an air gap wider than the water film, placed in the joint.',
    defenseName: 'Capillary break', source: 'BCI 7.23',
  },
  {
    id: 'pressure', name: 'Air pressure difference', short: 'Wind pushes',
    problem: 'Higher air pressure outside pushes water through any opening.',
    defense: 'A vented cavity matches the pressure inside to the pressure outside. The air barrier sits on the room side.',
    defenseName: 'Vented cavity', source: 'BCI 7.23',
  },
];

export const STRATEGIES = [
  {
    id: 'mass', name: 'Mass', examples: 'Concrete, solid masonry',
    how: 'The wall sheds most rain at the face and absorbs the rest. Then it dries by giving off vapor.',
    weakness: 'It needs a thick wall, and a wet wall takes time to dry.',
    layers: ['Thick masonry or concrete'], source: 'BCI 7.23',
  },
  {
    id: 'barrier', name: 'Barrier', examples: 'EIFS',
    how: 'One unbroken seal on the face keeps the water out.',
    weakness: 'The seal must be maintained. A crack lets water in with no way out.',
    layers: ['Finish coat', 'Foam', 'Sheathing'], source: 'BCI 7.23',
  },
  {
    id: 'drainage', name: 'Drainage', examples: 'Traditional stucco, clapboard',
    how: 'A drainage plane (the WRB) behind the cladding is a second line of defense.',
    weakness: 'The cladding sits tight to the WRB, so drying is slow.',
    layers: ['Cladding', 'WRB', 'Sheathing'], source: 'BCI 7.23',
  },
  {
    id: 'rainscreen', name: 'Rainscreen', examples: 'Brick cavity wall, furred-out clapboard',
    how: 'Cladding, then an air cavity and a drainage plane, on an airtight backup wall. The cavity is too wide for capillary bridging and drains at the bottom.',
    weakness: 'It costs more and needs flashing and weep holes done right.',
    layers: ['Brick', 'Air cavity', 'WRB and insulation', 'Backup wall'], source: 'BCI 7.23',
  },
];

export const ERRORS = [
  {
    id: 'reverse_lap', name: 'Reverse lap',
    what: 'The upper WRB or flashing layer is tucked behind the lower layer.',
    result: 'Water runs behind the lower layer and onto the sheathing.',
    fix: 'Lap every layer over the one below it, like shingles.',
    source: 'BCI 7.23',
  },
  {
    id: 'no_end_dam', name: 'No end dam',
    what: 'The sill pan has no end dam.',
    result: 'Water runs off the end of the sill pan and into the wall at the jamb.',
    fix: 'Turn up an end dam at each end of the sill pan, at least 2 inches.',
    source: 'BCI 7.22',
  },
  {
    id: 'no_weeps', name: 'No weep holes',
    what: 'The base of the cavity has no weep holes.',
    result: 'Water fills the bottom of the cavity and soaks the base of the wall.',
    fix: 'Add weep holes just above the base flashing, 24 inches o.c. in brick.',
    source: 'BCI 7.22',
  },
  {
    id: 'no_gap', name: 'No drainage gap',
    what: 'The cladding touches the WRB.',
    result: 'Capillary action holds water in the contact and wets the sheathing over a wide area.',
    fix: 'Keep an open gap behind the cladding, at least 2 inches with insulation.',
    source: 'BCI 7.23',
  },
  {
    id: 'no_head_flashing', name: 'No head flashing',
    what: 'There is no flashing above the window.',
    result: 'Water behind the cladding runs onto the window head and into the rough opening.',
    fix: 'Add head flashing that turns up 2 inches and drips 3/4 inch past the face.',
    source: 'BCI 7.22',
  },
];

export const CONTROL_LAYERS = [
  {
    id: 'water', name: 'Water', job: 'Stops liquid water. This is the WRB and the flashing.',
    rule: 'Lap every layer like shingles so water always runs outward.', color: '#0aa6a0',
  },
  {
    id: 'air', name: 'Air', job: 'Stops air from moving through the wall. This is the air barrier.',
    rule: 'It must be continuous. It can be vapor-open.', color: '#7a4fd6',
  },
  {
    id: 'vapor', name: 'Vapor', job: 'Slows vapor moving through the wall. This is the vapor retarder.',
    rule: 'In cold climates put it on the warm side of the insulation.', color: '#d19a00',
  },
  {
    id: 'thermal', name: 'Thermal', job: 'Slows heat flow. This is the insulation.',
    rule: 'Continuous insulation is best.', color: '#e8590c',
  },
];
CONTROL_LAYERS.forEach((c) => { c.source = 'BCI 7.48'; });

/**
 * Which control layers each layer of a wall plays. Interior to exterior, same order as wall.layers.
 * @param {{layers:Array<{materialId:string}>}} wall
 * @param {Record<string, {control:string}>} materials the MATERIALS table
 * @returns {Array<{index:number, materialId:string, roles:string[], cladding:boolean}>}
 */
export function layerRoles(wall, materials) {
  const airIds = ['osb', 'plywood', 'gyp_sheath', 'cmu8', 'concrete'];
  return wall.layers.map((l, index) => {
    const m = materials[l.materialId] || {};
    const roles = [];
    if (m.control === 'water') roles.push('water');
    if (airIds.includes(l.materialId)) roles.push('air');
    if (index === 0 && m.control === 'finish') roles.push('vapor');
    if (m.control === 'thermal') roles.push('thermal');
    return { index, materialId: l.materialId, roles, cladding: m.control === 'cladding' };
  });
}

// ---------------------------------------------------------------------------
// traceForce: 2D joint detail
// ---------------------------------------------------------------------------
const FORCE_TRACE = {
  momentum: {
    off: {
      steps: [
        'Wind drives a raindrop at the joint.',
        'The joint is open and straight, so the drop flies straight through it.',
        'The drop hits the backup wall and wets it.',
      ],
      path: [{ kind: 'leak', points: [[9, 0.1], [4, 0.1], [1.5, 0.1], [0, 0.1]] }],
    },
    on: {
      steps: [
        'Wind drives a raindrop at the joint.',
        'The drop flies through the joint.',
        'The baffle stops the drop and takes its energy.',
        'The water runs down the baffle and out of the wall.',
      ],
      path: [
        { kind: 'water', points: [[9, 0.1], [4, 0.1], [1.5, 0.1], [1.1, 0.1]] },
        { kind: 'blocked', points: [[1.1, 0.1], [0.95, 0]] },
        { kind: 'water', points: [[1.0, -0.1], [1.0, -3.2], [1.0, -9]] },
      ],
    },
  },
  gravity: {
    off: {
      steps: [
        'Rain runs down the face of the upper panel.',
        'The ledge below the joint slopes inward.',
        'Gravity pulls the water down the slope and into the wall.',
        'The water reaches the backup wall.',
      ],
      path: [{ kind: 'leak', points: [[4.3, 8], [4.3, 0.7], [3.7, 0.2], [3.0, -0.1], [2.0, -0.5], [1.5, -0.8], [0.8, -1.3], [0.1, -1.8]] }],
    },
    on: {
      steps: [
        'Rain runs down the face of the upper panel.',
        'The upper panel laps over the lower panel like a shingle.',
        'The ledge slopes down toward the outside.',
        'The water drips clear and runs down the lower panel.',
      ],
      path: [{ kind: 'water', points: [[5.3, 8], [5.3, -1.6], [4.9, -2.3], [4.5, -2.5], [4.2, -3.5], [4.2, -9]] }],
    },
  },
  tension: {
    off: {
      steps: [
        'Rain runs down the face of the upper panel.',
        'The water wraps around the bottom edge.',
        'Surface tension holds the water to the level underside.',
        'The water creeps back along the underside and into the joint.',
      ],
      path: [{ kind: 'leak', points: [[4.3, 6], [4.3, 0.7], [4.0, 0.3], [3.5, 0.15], [3.0, 0.1], [2.5, 0.1], [2.0, 0.05], [1.6, 0], [0.8, -0.2], [0.1, -0.3]] }],
    },
    on: {
      steps: [
        'Rain runs down the face of the upper panel.',
        'The water wraps around the bottom edge.',
        'The drip edge cuts a groove in the underside and breaks the water film.',
        'The drops fall free and do not reach the joint.',
      ],
      path: [
        { kind: 'water', points: [[4.3, 6], [4.3, 0.7], [4.0, 0.3], [3.5, 0.18]] },
        { kind: 'water', points: [[3.45, 0.1], [3.45, -4], [3.45, -9]] },
      ],
    },
  },
  capillary: {
    off: {
      steps: [
        'Water reaches a very narrow joint.',
        'Capillary action pulls the water into the gap, even uphill.',
        'The water wicks all the way through the joint.',
        'The water reaches the backup wall.',
      ],
      path: [{ kind: 'leak', points: [[4.4, -0.7], [4.0, 0], [3.0, 0], [2.0, 0], [1.5, 0.05], [0.8, 0.15], [0.1, 0.3]] }],
    },
    on: {
      steps: [
        'Water reaches a very narrow joint.',
        'Capillary action pulls the water into the gap.',
        'The gap opens into an air space wider than the water film.',
        'The water cannot cross the air space, so it stops.',
      ],
      path: [
        { kind: 'water', points: [[4.4, -0.7], [4.0, 0], [3.6, 0], [3.3, 0]] },
        { kind: 'blocked', points: [[3.3, 0], [3.15, 0]] },
      ],
    },
  },
  pressure: {
    off: {
      steps: [
        'Wind raises the air pressure outside the wall.',
        'The cavity behind the joint is sealed, so its pressure stays low.',
        'The pressure difference pushes water through the joint.',
        'The water is pushed through the backup wall and into the room.',
      ],
      path: [{ kind: 'leak', points: [[9, 0.1], [4, 0.1], [1.5, 0.1], [0, 0.1], [-2, 0.1], [-4, 0.1]] }],
    },
    on: {
      steps: [
        'Wind raises the air pressure outside the wall.',
        'Vents let the cavity reach the same pressure. P out equals P cavity.',
        'With no pressure difference, nothing pushes the water inward.',
        'The airtight backup wall holds the room air. The water drains down the cavity.',
      ],
      path: [
        { kind: 'water', points: [[9, 0.1], [4, 0.1], [1.5, 0.1], [1.2, 0.1]] },
        { kind: 'blocked', points: [[1.2, 0.1], [1.05, 0]] },
        { kind: 'water', points: [[1.1, -0.1], [1.1, -4], [1.1, -9.5]] },
      ],
    },
  },
};

/**
 * Trace one force through one cladding joint.
 * @param {string} forceId
 * @param {boolean} defenseOn
 * @returns {{ok:boolean, steps:string[], path:Array<{kind:'water'|'blocked'|'leak', points:number[][]}>}}
 *   points are [u, v] in the joint close-up (see the header).
 */
export function traceForce(forceId, defenseOn) {
  const f = FORCE_TRACE[forceId];
  if (!f) throw new Error(`Unknown force: ${forceId}`);
  const t = defenseOn ? f.on : f.off;
  return {
    ok: !t.path.some((p) => p.kind === 'leak'),
    steps: t.steps.slice(),
    path: t.path.map((p) => ({ kind: p.kind, points: p.points.map((q) => q.slice()) })),
  };
}

// ---------------------------------------------------------------------------
// traceStrategy: 48 in sample
// ---------------------------------------------------------------------------
/**
 * Trace rain through one of the four wall strategies.
 * @param {string} strategyId
 * @param {boolean} fault a crack in the face or a failed seal
 * @returns {{ok:boolean, steps:string[], paths:Array<{id:string, kind:'shed'|'absorb'|'dry'|'drain'|'leak', points:number[][], label:string, patch?:object}>}}
 */
export function traceStrategy(strategyId, fault) {
  const x = STRAT.xp;
  const cy = STRAT.crackY;
  const fz = STRAT.faceZ[strategyId];
  if (fz == null) throw new Error(`Unknown strategy: ${strategyId}`);
  const top = 46;
  const shedZ = fz + 0.45;
  const shed = (label) => ({ id: 'shed', kind: 'shed', points: [[x, top, shedZ], [x, 2.5, shedZ]], label });
  const ok = true;
  if (strategyId === 'mass') {
    const depth = fault ? 3 : 7;
    return {
      ok,
      steps: [
        'Rain hits the thick wall face.',
        'Most of it runs off the face.',
        fault ? 'A crack lets more water in. The thick wall absorbs it.' : 'The wall absorbs the rest.',
        'Later the wall dries. It gives the water off as vapor.',
      ],
      paths: [
        shed('Runs off the face'),
        { id: 'absorb', kind: 'absorb', points: [[x, cy, fz], [x, cy, fz - 1.5], [x, cy - 0.5, depth]], label: 'Absorbed' },
        { id: 'dry', kind: 'dry', points: [[x, cy - 0.5, depth], [x, cy - 3, depth + 2.5], [x, cy - 4, fz + 0.6]], label: 'Dries as vapor' },
      ],
    };
  }
  if (strategyId === 'barrier') {
    if (!fault) {
      return {
        ok,
        steps: ['Rain hits the finish coat.', 'The unbroken seal sheds all of the water.', 'The wall stays dry as long as the seal holds.'],
        paths: [shed('Sheds off the seal')],
      };
    }
    return {
      ok: false,
      steps: [
        'Rain hits the finish coat.',
        'Water runs into the crack.',
        'It soaks the foam and reaches the sheathing.',
        'There is no way out, so the sheathing stays wet.',
      ],
      paths: [
        { id: 'shed', kind: 'shed', points: [[x, top, shedZ], [x, cy + 1, shedZ]], label: 'Runs down the face' },
        {
          id: 'leak', kind: 'leak', label: 'Trapped behind the seal',
          points: [[x, cy + 1, shedZ], [x, cy, fz], [x, cy - 0.5, 3.2], [x, cy - 3, 2], [x, cy - 7, 1.1]],
          patch: { x0: x - 6, x1: x + 6, y0: cy - 12, y1: cy - 1, z: 1.02 },
        },
      ],
    };
  }
  if (strategyId === 'drainage') {
    const zw = 1.4;
    return {
      ok,
      steps: [
        'Rain hits the cladding.',
        fault ? 'Water gets in through a crack.' : 'Some water gets through the cladding.',
        'The WRB catches it. The water runs down the drainage plane.',
        'It leaves the wall at the base.',
      ],
      paths: [
        fault ? { id: 'shed', kind: 'shed', points: [[x, top, shedZ], [x, cy + 1, shedZ]], label: 'Runs down the face' } : shed('Runs off the face'),
        {
          id: 'drain', kind: 'drain', label: 'Drains down the WRB',
          points: [[x, cy, fz], [x, cy, 2], [x, cy - 0.5, zw], [x, cy - 3, zw], [x, 4, zw], [x, 2.4, 2], [x, 2, 3.2]],
        },
      ],
    };
  }
  // rainscreen
  const zc = 7.0;
  const fy = STRAT.flashY;
  return {
    ok,
    steps: [
      'Rain hits the brick.',
      fault ? 'Water gets in through a cracked joint.' : 'Some water gets through the brick joints.',
      'It falls into the 2 inch air cavity. The cavity is too wide for water to bridge.',
      'The water runs down the WRB to the base flashing.',
      'The flashing turns it out through the weep holes.',
    ],
    paths: [
      fault ? { id: 'shed', kind: 'shed', points: [[x, top, shedZ], [x, cy + 1, shedZ]], label: 'Runs down the face' } : shed('Runs off the face'),
      {
        id: 'drain', kind: 'drain', label: 'Drains in the cavity',
        points: [[x, cy, fz], [x, cy, 10], [x, cy - 0.5, zc], [x, cy - 4, zc], [x, fy + 1.4, zc], [x, fy + 0.3, 8.6], [x, fy + 0.2, 11], [x, fy + 0.2, STRAT.faceZ.rainscreen + 0.8]],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// traceErrors: the drained wall with a window
// ---------------------------------------------------------------------------
const W_ = WALL;
const zd = W_.dripZ;
const Z_BEHIND = 4.03; // water on the sheathing face
const LEAKS = {
  reverse_lap: {
    where: 'wrb_lap',
    text: 'The upper WRB layer is behind the lower layer. Water runs behind it onto the sheathing.',
    label: 'Behind the lapped layer',
    points: [[12, 58, zd], [12, 54, 4.95], [12, 53.2, 4.5], [12, 50, 4.33], [12, 46, Z_BEHIND], [12, 39, Z_BEHIND]],
    patch: { x0: 6.5, x1: 17.5, y0: 37, y1: 51, z: 4.02 },
  },
  no_end_dam: {
    where: 'sill_end',
    text: 'The sill pan has no end dam. Water runs off the end of the pan and into the wall at the jamb.',
    label: 'Off the end of the sill pan',
    points: [[25, 24.3, 6], [21.5, 24.2, 6], [19.8, 24.0, 5.4], [19.2, 21, 4.1], [19.2, 15, Z_BEHIND], [19.2, 9, Z_BEHIND]],
    patch: { x0: 14.5, x1: 19.9, y0: 8, y1: 24, z: 4.02 },
  },
  no_weeps: {
    where: 'base_weeps',
    text: 'There are no weep holes. Water fills the bottom of the cavity and soaks the base of the wall.',
    label: 'Backs up at the base',
    points: [[54, 58, zd], [54, 9, zd], [54, 6.2, 5.3], [54, 4.6, 5.3], [54, 3.2, 4.4], [54, 1.6, Z_BEHIND], [54, 0.6, Z_BEHIND]],
    patch: { x0: 43, x1: 59.6, y0: 0.4, y1: 9, z: 4.02 },
  },
  no_gap: {
    where: 'cavity_contact',
    text: 'The cladding touches the WRB. Capillary action holds water there and wets the sheathing over a wide area.',
    label: 'Held against the WRB',
    points: [[48, 58, 5.2], [48.8, 53, 4.9], [47, 48, 4.6], [49.2, 43, 4.3], [47, 38, Z_BEHIND], [49, 33, Z_BEHIND], [48, 28, Z_BEHIND]],
    patch: { x0: 41.5, x1: 59, y0: 26, y1: 52, z: 4.02 },
  },
  no_head_flashing: {
    where: 'window_head',
    text: 'There is no head flashing. Water behind the cladding runs onto the window head and into the rough opening.',
    label: 'Into the window head',
    points: [[30, 58, zd], [30, 47, zd], [30, 43.4, 5.05], [30, 42.4, 4.7], [30, 41.9, 3.6], [30, 40.6, 2.2]],
    patch: { x0: 21.5, x1: 38.5, y0: 42.2, y1: 50, z: 4.9 },
  },
};

const wx = W_.weepX;
const weepExit = (x) => [[x, 58, zd], [x, 8, zd], [x, 6.4, 5.1], [x, W_.weepY, 6], [x, W_.weepY - 0.1, 8.5], [x, W_.weepY - 0.2, W_.zFace + 0.1], [x, W_.weepY - 0.9, W_.zFace + 0.7]];

/**
 * Trace water on a drained brick wall with a window and any of the five errors.
 * @param {string[]} errorIds
 * @returns {{ok:boolean, steps:string[], paths:Array<{id:string, kind:'shed'|'drain'|'leak', points:number[][], label:string, errorId:string|null}>, leaks:Array<{errorId:string, where:string, text:string, patch:object}>}}
 */
export function traceErrors(errorIds) {
  const set = new Set(errorIds || []);
  for (const id of set) if (!LEAKS[id]) throw new Error(`Unknown error: ${id}`);
  const paths = [];
  const leaks = [];
  const add = (id, kind, label, points, errorId = null) => paths.push({ id, kind, label, errorId, points });
  const win = W_.window;

  // Shed paths: rain runs down the face and the window glass.
  add('shed_left', 'shed', 'Runs off the face', [[13, 58, W_.zFace + 0.45], [13, 2.5, W_.zFace + 0.45]]);
  add('shed_right', 'shed', 'Runs off the face', [[47, 58, W_.zFace + 0.45], [47, 2.5, W_.zFace + 0.45]]);
  add('shed_window', 'shed', 'Runs off the glass and the sill', [[30, win.y1 - 1, W_.zGlass], [30, win.y0 + 0.6, W_.zGlass], [30, win.y0 + 0.3, 5], [30, win.y0 + 0.15, W_.zFace + 0.2], [30, win.y0 - 0.6, W_.zFlashOut + 0.1]]);

  // Drain paths inside the cavity.
  if (!set.has('no_gap')) {
    if (!set.has('no_weeps')) {
      add('drain_left', 'drain', 'Drains out of the weep hole', weepExit(wx[0]));
      add('drain_right', 'drain', 'Drains out of the weep hole', weepExit(wx[2]));
      add('drain_mid', 'drain', 'Drains out of the weep hole', [[30, 22, zd], [30, 8, zd], [30, 6.4, 5.1], [30, W_.weepY, 6], [30, W_.weepY - 0.1, 8.5], [30, W_.weepY - 0.2, W_.zFace + 0.1], [30, W_.weepY - 0.9, W_.zFace + 0.7]]);
    }
    if (!set.has('no_head_flashing')) {
      add('drain_head', 'drain', 'Turned out by the head flashing', [[30, 58, zd], [30, 45, zd], [30, W_.headFlashY + 0.3, 5.05], [30, W_.headFlashY + 0.15, 8], [30, W_.headFlashY + 0.05, W_.zFace + 0.1], [30, W_.headFlashY - 0.6, W_.zFlashOut + 0.1]]);
    }
  }

  // Leak paths.
  for (const e of ERRORS) {
    if (!set.has(e.id)) continue;
    const L = LEAKS[e.id];
    add(`leak_${e.id}`, 'leak', L.label, L.points, e.id);
    leaks.push({ errorId: e.id, where: L.where, text: L.text, patch: { ...L.patch } });
  }

  // Steps: the order of the water journey. A fault replaces the good step.
  const lk = (id) => LEAKS[id].text;
  const steps = [];
  steps.push('Rain hits the brick. Most of it runs down the face and drips off the head flashing and the sill.');
  steps.push('A little water gets through the brick joints.');
  steps.push(set.has('no_gap') ? `Leak: ${lk('no_gap')}` : 'It runs down the drainage gap on the face of the WRB.');
  steps.push(set.has('reverse_lap') ? `Leak: ${lk('reverse_lap')}` : 'The WRB layers lap like shingles, so the water stays on the outside of every layer.');
  steps.push(set.has('no_head_flashing') ? `Leak: ${lk('no_head_flashing')}` : 'The head flashing catches the water above the window and sends it out through a drip.');
  steps.push(set.has('no_end_dam') ? `Leak: ${lk('no_end_dam')}` : 'The sill pan with end dams sends the window water out the front.');
  steps.push(set.has('no_weeps') ? `Leak: ${lk('no_weeps')}` : 'Weep holes at the base let the rest of the water out.');
  return { ok: leaks.length === 0, steps, paths, leaks };
}
