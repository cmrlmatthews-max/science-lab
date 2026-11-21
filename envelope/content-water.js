// envelope/content-water.js  Words for the Water mode of Envelope Lab. Pure data, no DOM, runs in Node.
// Layers: l1 Start, l2 Story, l3 Explore, l4 Numbers. Level 5 text stays in mode-water.js and water.js (unchanged).
// See CONTRACT-ENVELOPE-LAYERS.md. Reading level for l1 to l3 is checked by tests/text-water.test.mjs.

export const TEXT = {
  l1: {
    question: 'How does a wall stay dry in the rain?',
    sub: 'Pick a wall. Watch where the rain water goes.',
    pick: 'Pick a wall',
    choices: [
      { id: 'good', label: 'Good wall' },
      { id: 'no_gap', label: 'No drain gap' },
      { id: 'no_head_flashing', label: 'No metal strip over the window' },
      { id: 'no_weeps', label: 'No drain holes' },
    ],
    answers: {
      good: {
        kind: 'ok',
        title: 'Dry and safe',
        text: 'Rain hits the brick. A little water gets behind it. It runs down the gap and out at the bottom. The wall stays dry.',
      },
      no_gap: {
        kind: 'warn',
        title: 'Water gets stuck',
        text: 'The brick touches the rain barrier sheet. Water cannot run down. It soaks in and the wall stays wet.',
      },
      no_head_flashing: {
        kind: 'warn',
        title: 'Water drops into the window',
        text: 'There is no metal strip above the window. Water running down behind the brick lands on the window. Then it leaks inside.',
      },
      no_weeps: {
        kind: 'warn',
        title: 'Water piles up',
        text: 'The small drain holes are missing. Water cannot leave the gap. It fills the bottom of the wall.',
      },
      reverse_lap: {
        kind: 'warn',
        title: 'The sheets overlap the wrong way',
        text: 'The top sheet is tucked behind the lower sheet. Water runs behind the lower sheet and gets in.',
      },
      no_end_dam: {
        kind: 'warn',
        title: 'Water spills past the tray',
        text: 'The tray under the window has no end walls. Water runs off the ends and into the wall.',
      },
      many: {
        kind: 'warn',
        title: 'More than one mistake',
        text: 'Each mistake gives the water a new way in. Fix them one at a time.',
      },
    },
    summary: {
      good: 'Good wall: stays dry',
      no_gap: 'No drain gap: leaks',
      no_head_flashing: 'No metal strip: leaks',
      no_weeps: 'No drain holes: leaks',
      reverse_lap: 'Wrong overlap: leaks',
      no_end_dam: 'No tray end walls: leaks',
      many: 'Several mistakes: leaks',
    },
  },

  l2: {
    steps: [
      {
        title: 'Rain hits the wall',
        text: 'Rain lands on the brick. Most of it runs down the face and drips away.',
        life: 'A raincoat works the same way. Water runs off the outside.',
      },
      {
        title: 'Some water gets behind the brick',
        text: 'Brick is not waterproof. A little rain always gets through the joints.',
        life: 'An old brick wall stays dark and damp for hours after a storm.',
      },
      {
        title: 'The gap lets water run down',
        text: 'Behind the brick is an empty gap. Water runs down the gap and drips out the bottom.',
        life: 'Rain on a car window does not stay. It runs down and off.',
      },
      {
        title: 'The wrap is a raincoat',
        text: 'A thin rain barrier sheet covers the wall. It is called housewrap. The sheets overlap like roof shingles, so water always runs over the next sheet.',
        life: 'Roof shingles work the same way. Each one sheds water onto the next.',
      },
      {
        title: 'Metal strips kick water out',
        text: 'Above the window sits a metal strip. It is called flashing. It catches the water and kicks it out past the brick.',
        life: 'The brim of a hat keeps rain off your face in the same way.',
      },
      {
        title: 'Small holes let water out',
        text: 'At the bottom of the wall are small drain holes. The water runs out through them. Then the wall can dry.',
        life: 'A wet basement wall shows what happens when water has no way out.',
      },
    ],
  },

  l3: {
    // Plain names for the four views. Level 5 keeps the names used today.
    views: { forces: 'Forces', walls: 'Walls', errors: 'Mistakes', layers: 'Layers' },
    sections: {
      forces: 'Five pushes on water',
      defense: 'The fix',
      walls: 'Wall styles',
      fault: 'A problem',
      errors: 'Five mistakes',
      wall: 'Wall',
      layers: 'Four jobs',
      labels: 'Labels and view',
    },
    controls: {
      rain: 'Rain',
      wind: 'Wind',
      clear: 'Clear all',
      crack: 'Add a crack in the face',
      labels: 'Labels',
      reset: 'Reset view',
      fix: 'Fix',
      none: 'No fix',
      allFour: 'All four',
      allFourSub: 'Show every job at once.',
      rainWind: 'Rain and wind',
      pathColors: 'Path colors',
    },
    forces: [
      { id: 'momentum', name: 'Wind-blown drops', problem: 'Wind blows drops straight through an open joint.', fixName: 'Baffle', fix: 'A baffle is a strip inside the joint. It stops the drop.' },
      { id: 'gravity', name: 'Water runs down', problem: 'Water runs down and into any joint that tilts inward.', fixName: 'Overlap and slope', fix: 'Overlap the pieces like shingles. Tilt ledges toward the outside.' },
      { id: 'tension', name: 'Water clings', problem: 'Water sticks to the underside of a flat edge. It creeps back toward the wall.', fixName: 'Drip edge', fix: 'A drip edge makes the water fall free.' },
      { id: 'capillary', name: 'Water creeps', problem: 'Water creeps through a very narrow gap, even uphill.', fixName: 'Wide gap', fix: 'A wider air gap stops the creeping.' },
      { id: 'pressure', name: 'Wind pushes', problem: 'Wind pushes water through any opening.', fixName: 'Vented gap', fix: 'A vented gap evens out the air push. The air barrier sits on the room side.' },
    ],
    walls: [
      { id: 'mass', name: 'Thick wall', examples: 'Concrete, solid brick' },
      { id: 'barrier', name: 'Sealed face', examples: 'Foam walls with a smooth coat' },
      { id: 'drainage', name: 'Drain behind', examples: 'Siding or stucco on a rain sheet' },
      { id: 'rainscreen', name: 'Gap behind brick', examples: 'Brick with an open gap' },
    ],
    errors: [
      { id: 'reverse_lap', name: 'Sheets overlap the wrong way', what: 'The top sheet is tucked behind the lower sheet.' },
      { id: 'no_end_dam', name: 'No end walls on the tray', what: 'The tray under the window has no end walls.' },
      { id: 'no_weeps', name: 'No drain holes', what: 'The bottom of the gap has no drain holes.' },
      { id: 'no_gap', name: 'No drain gap', what: 'The brick touches the rain barrier sheet.' },
      { id: 'no_head_flashing', name: 'No metal strip over the window', what: 'Nothing catches the water above the window.' },
    ],
    layers: [
      { id: 'water', name: 'Water-stopping layer', job: 'Stops rain water. It is the rain barrier sheet and the metal strips.' },
      { id: 'air', name: 'Air-stopping layer', job: 'Stops air from moving through the wall.' },
      { id: 'vapor', name: 'Damp-air layer', job: 'Slows damp air as it moves through the wall.' },
      { id: 'thermal', name: 'Heat-slowing layer', job: 'Keeps heat in. This is the insulation.' },
    ],
    tries: [
      { label: 'Take away the drain gap', hint: 'The brick touches the sheet. Water cannot run down.' },
      { label: 'Add a baffle to the joint', hint: 'Wind-blown drops stop at the strip.' },
      { label: 'Crack the sealed wall', hint: 'A sealed face has no way out for water.' },
    ],
    // Plain answers for the Forces, Walls and Layers views.
    answers: {
      forces: {
        momentum: {
          off: { title: 'Water gets in', text: 'Wind blows a drop straight through the open joint. It wets the wall behind.' },
          on: { title: 'The baffle stops it', text: 'The drop hits the baffle. The water runs down and out of the wall.' },
        },
        gravity: {
          off: { title: 'Water runs inward', text: 'The ledge tilts toward the wall. Water runs down it and into the wall.' },
          on: { title: 'Water runs outward', text: 'The pieces overlap like shingles. The ledge tilts out. The water drips clear.' },
        },
        tension: {
          off: { title: 'Water creeps back', text: 'Water clings to the flat underside. It creeps back into the joint.' },
          on: { title: 'Water falls free', text: 'The drip edge breaks the water film. Drops fall away from the wall.' },
        },
        capillary: {
          off: { title: 'Water creeps in', text: 'The gap is so narrow that water wicks through it.' },
          on: { title: 'The wide gap stops it', text: 'The wider gap is too big for water to climb. The wall stays dry.' },
        },
        pressure: {
          off: { title: 'Wind pushes water in', text: 'The air pressure is higher outside. It pushes water through the sealed joint.' },
          on: { title: 'The vents even it out', text: 'Vents let outside air into the gap. The push is gone. The wall stays dry.' },
        },
      },
      walls: {
        mass: {
          ok: { title: 'Thick and slow', text: 'The wall soaks up some rain. Then it dries slowly in the air.' },
          fault: { title: 'Still fine', text: 'The crack lets in more water. The thick wall soaks it up and dries later.' },
        },
        barrier: {
          ok: { title: 'One sealed skin', text: 'The smooth coat keeps all the water out. This works as long as the coat stays whole.' },
          fault: { title: 'No way out', text: 'Water gets in through the crack. The seal traps it inside. The wall stays wet.' },
        },
        drainage: {
          ok: { title: 'Drain behind', text: 'A rain barrier sheet sits behind the siding. Water that gets in runs down it.' },
          fault: { title: 'The sheet saves it', text: 'Water gets in through the crack. The sheet catches it and sends it down and out.' },
        },
        rainscreen: {
          ok: { title: 'The gap does the work', text: 'Water that gets behind the brick drops into the gap. It drains out the bottom.' },
          fault: { title: 'The gap saves it', text: 'Water gets in through the cracked joint. It drops into the gap and drains out.' },
        },
      },
      layers: {
        water: { title: 'The water-stopping layer', text: 'This layer stops rain water. The glowing parts are the rain barrier sheet and the metal strips.' },
        air: { title: 'The air-stopping layer', text: 'This layer stops air from blowing through the wall. It must have no gaps.' },
        vapor: { title: 'The damp-air layer', text: 'This layer slows damp air. In a cold place it sits on the warm side of the insulation.' },
        thermal: { title: 'The heat-slowing layer', text: 'This layer keeps heat in. It works best when it is one unbroken blanket.' },
        all: { title: 'Four jobs in one wall', text: 'Every wall needs all four layers. Each glowing color is one job.' },
      },
    },
    notes: [
      'Turn each mistake on and off. Watch the blue paths and the dark wet spots.',
      'Rain and wind change how hard the water pushes.',
    ],
  },

  l4: {
    // Values come from water.js DIMENSIONS (inches). The mode makes the "us" and "si" strings.
    tiles: {
      gap: { label: 'Drain gap', compare: 'About the width of two fingers.' },
      lap: { label: 'Housewrap overlap', compare: 'About the width of your palm.' },
      turnup: { label: 'Metal strip turn-up', compare: 'A little taller than a golf ball.' },
      drip: { label: 'Drip past the face', compare: 'About the width of a thumbnail.' },
      weep: { label: 'Drain hole spacing', compare: 'About the length of two rulers.' },
    },
    sectionTiles: 'Key sizes',
    sectionWords: 'Words to know',
    glosses: {
      'Raindrop momentum': 'A fast drop keeps moving in a straight line.',
      'Gravity': 'It pulls water downhill.',
      'Surface tension': 'Water sticks to itself and to the surface.',
      'Capillary action': 'Water creeping through a very narrow gap.',
      'Air pressure difference': 'Wind pushes harder outside than the air inside pushes back.',
      'Water control layer': 'The layer that stops rain water. It is the housewrap and the flashing.',
      'Air control layer': 'The layer that stops air moving through the wall. Also called the air barrier.',
      'Vapor control layer': 'The layer that slows damp air. Also called the vapor retarder.',
      'Thermal control layer': 'The layer that slows heat. It is the insulation.',
      'WRB': 'Water-resistant barrier. Another name for housewrap.',
      'Flashing': 'A metal or sheet strip that kicks water out of the wall.',
      'Weep holes': 'Small drain holes at the bottom of a brick wall.',
    },
  },
};

// ---------- plain 3D labels (levels 1 to 3), never with digits ----------
const EXACT = {
  'Brick cladding': 'Brick',
  'Housewrap (WRB)': 'Rain barrier sheet',
  'Housewrap lap': 'Sheets overlap',
  'Reverse lap': 'Overlap the wrong way',
  'Sheathing': 'Wall board',
  'Wood framing': 'Wood frame',
  'Drip edge, 3/4 in. out': 'Water drips off here',
  'Window': 'Window',
  'Sealant joint': 'Seal',
  'No end dam': 'No tray end wall',
  'End dam': 'Tray end wall',
  'Sill pan': 'Tray under the window',
  'No weep holes': 'No drain holes',
  'Base flashing': 'Metal strip at the bottom',
  'Air cavity': 'Drain gap',
  'No head flashing': 'No metal strip',
  'No gap: brick touches the wrap': 'No gap: brick touches the sheet',
  'Leak': 'Leak',
  // forces view
  'Baffle strip': 'Baffle strip',
  'Open joint': 'Open joint',
  'Lap joint, like shingles': 'Overlap, like shingles',
  'Ledge slopes out': 'Ledge tilts out',
  'Ledge slopes in': 'Ledge tilts in',
  'Drip edge groove': 'Drip edge groove',
  'Level underside': 'Flat underside',
  'Capillary break': 'Wide gap',
  'Narrow gap': 'Narrow gap',
  'Vent equalizes pressure': 'Vent evens out the push',
  'Air barrier': 'Air barrier',
  'Sealed cavity': 'Sealed gap',
  'Cladding panel': 'Wall panel',
  'Backup wall': 'Back wall',
  // walls view
  'Foam insulation': 'Foam insulation',
  'Sealed finish coat': 'Sealed smooth coat',
  'Lap siding': 'Siding',
  'Lap joint': 'Overlap',
  'Airtight backup wall': 'Airtight back wall',
  'Insulation': 'Insulation',
  'Brick': 'Brick',
  'Crack: no way out': 'Crack: no way out',
  'Crack in the face': 'Crack in the face',
  'Water path': 'Water path',
  // layers view
  'Gypsum board': 'Wall board',
  'Gypsum sheathing': 'Wall board',
  'OSB sheathing': 'Wall board',
  'Plywood sheathing': 'Wall board',
  'Fiberglass batt': 'Insulation',
  'Mineral wool board': 'Insulation',
  'XPS foam board': 'Foam insulation',
  'EPS foam board': 'Foam insulation',
  'Polyiso board': 'Foam insulation',
  'Spray foam': 'Spray foam',
  'Air space': 'Air space',
  'Vinyl siding': 'Siding',
  'Concrete block': 'Concrete block',
  'Concrete': 'Concrete',
  'Stucco': 'Stucco',
  'Steel framing': 'Steel frame',
  'Aluminum': 'Aluminum',
  'Water control layer': 'Water-stopping layer',
  'Air control layer': 'Air-stopping layer',
  'Vapor control layer': 'Damp-air layer',
  'Thermal control layer': 'Heat-slowing layer',
  'Outside · rain': 'Outside, rain',
  'Inside · dry': 'Inside, dry',
};
const PATTERNS = [
  [/^Drainage gap, .*$/, 'Drain gap'],
  [/^Head flashing, .*$/, 'Metal strip over the window'],
  [/^Weep holes, .*$/, 'Small drain holes'],
  [/^Solid masonry, .*$/, 'Solid masonry'],
  [/^Air cavity, .*$/, 'Drain gap'],
];

/** Plain version of a 3D label for levels 1 to 3. Unknown text is returned unchanged. No digits in the result. */
export function plainLabel(text) {
  return String(text).split('\n').map((line) => {
    if (EXACT[line]) return EXACT[line];
    for (const [re, out] of PATTERNS) if (re.test(line)) return out;
    return line;
  }).join('\n');
}

/** Which key of TEXT.l1.answers fits a list of error ids. */
export function answerKey(errors) {
  if (!errors || !errors.length) return 'good';
  if (errors.length > 1) return 'many';
  return errors[0];
}
