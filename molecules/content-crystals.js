// molecules/content-crystals.js  Words for the Crystals mode, one place, pure data (no DOM).
// TEXT: the five layers. INFO: card entries for everything the user can hover or tap. getInfo(id).
// Facts in INFO are built from crystal-data.js and elements.js, so they cannot drift from the data.
// Levels 1 to 3 are written for a sixth grade reader (tests/text-crystals.test.mjs checks it).

import { CRYSTALS, CRYSTAL_ORDER } from './crystal-data.js';
import { ELEMENTS } from './elements.js';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const word = (n) => WORDS[n] || String(n);

// ---------- TEXT ----------

export const TEXT = {
  l1: {
    question: 'How are the atoms stacked inside a solid?',
    sub: 'Pick one. A small block of atoms repeats over and over.',
    answers: {
      nacl: { title: 'Table salt', text: 'Two kinds of atoms take turns in every direction. That makes each grain a tiny cube.' },
      ice_ih: { title: 'Ice', text: 'Water links into open rings of six. The gaps make ice light, so it floats.' },
      diamond: { title: 'Diamond', text: 'Each atom holds four others. Strong holds in every direction make diamond very hard.' },
      fe_bcc: { title: 'Steel (iron)', text: 'Iron atoms sit at the corners of a cube, with one in the middle. That stack is strong.' },
    },
    choices: [
      { id: 'nacl', label: 'Table salt' },
      { id: 'ice_ih', label: 'Ice' },
      { id: 'diamond', label: 'Diamond' },
      { id: 'fe_bcc', label: 'Steel (iron)' },
    ],
  },

  l2: {
    steps: [
      {
        title: 'Atoms stack in a pattern',
        text: 'Atoms in a solid do not sit at random. They stack in neat rows, like oranges in a crate.',
        life: 'Look at salt through a magnifier. Each grain is a little cube.',
      },
      {
        title: 'The pattern repeats',
        text: 'One small block of atoms repeats again and again. That block builds the whole grain. The block is about a million times smaller than a grain of sand.',
        life: 'Quartz is a pattern like this. It is in sand, and it keeps time in a watch.',
      },
      {
        title: 'Salt: two kinds take turns',
        text: 'Sodium and chlorine take turns in every direction. Salt splits along flat faces, so the grains are cubes.',
        life: 'Limestone is made of calcite. It splits along flat faces too. It is a main part of concrete.',
      },
      {
        title: 'Metals: layers can slide',
        text: 'Layers of metal atoms can slide a little. The metal changes shape, and it does not shatter.',
        life: 'A paper clip bends because its layers slide. Steel beams hold up buildings the same way: they bend, but do not snap.',
      },
      {
        title: 'Diamond: four holds each',
        text: 'Every carbon atom holds four others. The holds are strong in every direction. That makes diamond very hard.',
        life: 'Saw blades tipped with diamond cut through concrete and stone.',
      },
      {
        title: 'Ice: an open pattern',
        text: 'Water links into open rings of six, with empty space inside. Ice is lighter than water, so it floats.',
        life: 'Snowflakes have six sides because ice has six-sided rings. Water that freezes in a pipe can crack it.',
      },
    ],
  },

  l3: {
    controls: {
      crystal: 'Material',
      amount: 'How much to show',
      showAs: 'Show as',
      cell: 'Show the repeating block',
      plane: 'Show the sliding layer',
      sheet: 'Show one sheet',
      neighbors: 'Show one atom\'s neighbors',
      neighborsOff: 'Hide the neighbors',
    },
    amounts: ['One block', 'A few blocks', 'A chunk'],
    showAs: { 'ball-stick': 'Balls and sticks', 'space-fill': 'Packed', sticks: 'Sticks' },
    groups: { metal: 'Metals', ionic: 'Salts', covalent: 'Carbon and silicon', mineral: 'Minerals', ice: 'Ice' },
    sheetPlain: 'Atoms slide along sheets like this',
    sheetOne: 'One sheet',
    tapHint: 'Tap any atom to see what touches it.',
    tapOff: 'Tap or point at an atom to see what it is.',
    sheetGraphite: 'The sheets slide over each other. That is why pencils write.',
    nbShown: 'The marked atom and its neighbors are bright. The rest of the block is faded.',
    nbPartial: 'Some neighbors lie outside this block, so fewer show.',
    ideasTitle: 'Ideas to explore',
    crystals: {
      fe_bcc: {
        name: 'Iron at room temperature', tag: 'Steel beams at room temperature', shape: 'a cube with a center atom',
        text: 'Iron atoms sit at the corners of a cube. One more sits in the middle. This stack makes steel strong.',
      },
      fe_fcc: {
        name: 'Iron when red hot', tag: 'Steel when it is red hot', shape: 'a cube with face atoms',
        text: 'Hot iron rearranges. An atom sits at each corner and on every face. There is more room for carbon.',
      },
      al_fcc: {
        name: 'Aluminum', tag: 'Window frames and siding', shape: 'a cube with face atoms',
        text: 'Atoms sit at each corner and on each face of a cube. Layers slide easily, so aluminum is soft and easy to shape.',
      },
      cu_fcc: {
        name: 'Copper', tag: 'Wire and roofs', shape: 'a cube with face atoms',
        text: 'Atoms sit at each corner and on each face of a cube. They pack as tight as balls can. Layers slide, so copper can be pulled into wire.',
      },
      zn_hcp: {
        name: 'Zinc', tag: 'The coating on galvanized steel', shape: 'flat stacked layers',
        text: 'Zinc atoms form flat layers. Each layer rests in the dips of the one below. The layers sit a little far apart.',
      },
      ti_hcp: {
        name: 'Titanium', tag: 'Light, strong roofing', shape: 'flat stacked layers',
        text: 'Titanium atoms form tight flat layers. Each layer rests in the dips of the one below, like oranges in a crate.',
      },
      mg_hcp: {
        name: 'Magnesium', tag: 'The lightest common metal', shape: 'flat stacked layers',
        text: 'Magnesium atoms form tight flat layers. Each layer rests in the dips of the one below, like oranges in a crate.',
      },
      nacl: {
        name: 'Table salt', tag: 'The shaker and road salt', shape: 'a checkerboard of two kinds of atoms',
        text: 'Sodium and chlorine take turns in every direction, like a checkerboard in three dimensions. Opposite charges hold them, so salt is hard but breaks.',
      },
      cscl: {
        name: 'Cesium chloride', tag: 'A salt that stacks another way', shape: 'a cube with a different atom in the middle',
        text: 'A big cesium atom sits in the middle of a cube of chlorine atoms. More neighbors fit around it than in table salt.',
      },
      diamond: {
        name: 'Diamond', tag: 'The hardest natural material', shape: 'linked four-sided pyramids',
        text: 'Each carbon atom holds four others, like the corners of a small pyramid. Strong holds in every direction make it very hard.',
      },
      silicon: {
        name: 'Silicon', tag: 'Solar panels and chips', shape: 'linked four-sided pyramids',
        text: 'Silicon stacks the same way as diamond. Each atom holds four others. Thin slices of it make solar cells and chips.',
      },
      graphite: {
        name: 'Graphite', tag: 'Pencil lead', shape: 'flat sheets',
        text: 'Carbon atoms make flat sheets of six-sided rings. The sheets cling to each other only a little, so they slide. That is why a pencil writes.',
      },
      ice_ih: {
        name: 'Ice', tag: 'Frozen water', shape: 'open rings of six',
        text: 'Water links into open rings of six, like a cage. The empty space makes ice light, so it floats.',
      },
      quartz: {
        name: 'Quartz', tag: 'Sand and watches', shape: 'spirals of linked pyramids',
        text: 'Each silicon atom sits in a small pyramid of four oxygen atoms. The pyramids share corners in a spiral. Sand is mostly quartz.',
      },
      calcite: {
        name: 'Calcite', tag: 'Limestone and marble', shape: 'flat triangles and calcium layers',
        text: 'Each carbon atom sits in a flat triangle of three oxygen atoms. The triangles take turns with calcium in layers. Limestone and marble are made of it.',
      },
    },
    // One line about touching neighbors. A number is spelled out in words.
    neighborLines: {
      hcp: 'Each atom touches twelve neighbors. Six of them are a little closer.',
      ice_ih: 'Each water molecule holds four others.',
      quartz: 'Each silicon holds four oxygens.',
      calcite: 'Each calcium holds six oxygens. Each carbon holds three.',
      graphite: 'Each carbon touches three neighbors in its sheet.',
      otherKind: (n) => `Each atom touches ${word(n)} neighbors of the other kind.`,
      generic: (n) => `Each atom touches ${word(n)} neighbors.`,
    },
    tries: [
      { label: 'Iron at room temperature', hint: 'One atom sits in the middle of each cube.' },
      { label: 'Iron when it is red hot', hint: 'The atoms rearrange. Now one sits on each face.' },
      { label: 'See how tightly it packs', hint: 'Each atom touches twelve others.' },
      { label: 'Why pencils write', hint: 'Strong sheets, weakly stacked. They slide.' },
      { label: 'Why salt makes cubes', hint: 'Two kinds of atoms take turns.' },
    ],
    notes: ['Drag to turn the block. Pinch or scroll to zoom. Tap an atom to learn about it.'],
    notesPacked: 'The two kinds of atom are drawn so that unlike neighbors just touch. Their real sizes differ from what is shown.',
    iceNote: 'The hydrogen atoms shown are one tidy way. In real ice they are jumbled.',
  },

  l4: {
    tiles: {
      neighbors: {
        label: 'Touching neighbors',
        compare: (n) => {
          if (n >= 12) return 'Like an orange in a crate: three above, six around, three below.';
          if (n >= 8) return 'Like the corners of a cube: one neighbor at each corner.';
          if (n >= 6) return 'Like the six faces of a die: one neighbor on each side.';
          if (n >= 4) return 'Like a camera tripod with one more leg pointing up.';
          return 'Like a peace sign: three neighbors in one flat sheet.';
        },
      },
      block: {
        label: 'Repeating block, edge length',
        compare: 'About a million blocks side by side would span one grain of sand.',
      },
      packing: {
        label: 'How full the space is',
        compare: (pct) => {
          if (pct >= 70) return 'About like oranges in a crate. This is the tightest stack for equal balls.';
          if (pct >= 60) return 'Almost as tight as oranges in a crate.';
          return 'Like a crate that is mostly air. The holds point in set directions, so the atoms keep apart.';
        },
      },
      density: {
        label: 'Density',
        compare: 'A milk jug of it weighs about as much as a child.',
        perCrystal: {
          fe_bcc: 'A milk jug of it weighs about as much as a child.',
          fe_fcc: 'A milk jug of it weighs about as much as a child.',
          al_fcc: 'A milk jug of it weighs about as much as a big bag of dog food.',
          cu_fcc: 'A milk jug of it weighs about as much as a big dog.',
          zn_hcp: 'A milk jug of it weighs about as much as a child.',
          ti_hcp: 'A milk jug of it weighs about as much as a small child.',
          mg_hcp: 'A milk jug of it weighs about as much as a bowling ball.',
          nacl: 'A milk jug of it weighs about as much as a big turkey.',
          cscl: 'A milk jug of it weighs about as much as a big bag of rice.',
          diamond: 'A milk jug of it weighs about as much as a big bag of rice.',
          silicon: 'A milk jug of it weighs about as much as a big turkey.',
          graphite: 'A milk jug of it weighs about as much as a big turkey.',
          ice_ih: 'A milk jug of it weighs a little less than a jug of water. That is why ice floats.',
          quartz: 'A milk jug of it weighs about as much as a big bag of dog food.',
          calcite: 'A milk jug of it weighs about as much as a big bag of dog food.',
        },
      },
    },
    glosses: {
      'touching neighbors': 'How many atoms touch one atom. Engineers say coordination number.',
      'repeating block': 'The small block that repeats to build the crystal. Scientists say unit cell.',
      packing: 'The share of space the atoms fill, if they were hard balls that touch.',
      density: 'How heavy a material is for its size.',
      angstrom: 'A tiny length. One angstrom is a tenth of a billionth of a meter.',
    },
    packingNote: 'If the atoms were hard balls that touch.',
    whyTitle: 'Why it matters in a building',
    glossTitle: 'Plain words',
    dataLabel: 'Data',
    shellsNote: 'Six in the same layer and six in the layers above and below.',
    trust: { reference: 'Reference values', approximate: 'Approximate values', schematic: 'Schematic' },
  },

  l5: {
    nearest: 'Nearest neighbor distance',
    touching: 'Touching neighbors',
    atomsInBlock: 'Atoms in the repeating block',
    atomsDrawn: 'Atoms drawn',
    packing: 'Space filled',
    density: 'Density',
    pattern: 'Stacking pattern',
    system: 'Crystal system',
    edges: 'Cell edges a, b, c',
    angles: 'Cell angles',
    plane: 'Plane',
    planeNone: 'None',
    planePick: 'Pick a plane to draw it on the block.',
    planeNoneDrawn: 'This crystal has no plane drawn.',
    measureToggle: 'Measure distances and angles',
    measureTitle: 'Measure',
    measureNone: 'None',
    measureHint: 'Tap two atoms to measure a distance. Tap a third for the angle.',
    measureOne: 'Tap one more atom to measure a distance.',
    measureDistance: 'Distance between the two atoms. 1 Å is 0.1 nanometer.',
    measureAngle: 'Angle at the second atom you tapped.',
    clear: 'Clear',
    boundary: 'Show shared corner atoms',
    bonds: 'Show sticks between atoms',
    labels: 'Show element labels',
    unitNote: '1 Å = 0.1 nanometer',
    data: 'Data',
    formulaUnits: (n) => `${n} formula units`,
  },
};

// ---------- INFO ----------

const lbft3 = (d) => `${Math.round(d * 62.428)} lb/ft³`;
const GROUP_TAG = { metal: 'Metal', ionic: 'Salt', covalent: 'Carbon and silicon', mineral: 'Mineral', ice: 'Ice' };

const ELEMENT_TEXT = {
  H: { short: 'The smallest atom. In ice it sits between two oxygen atoms.', what: 'Hydrogen is the lightest atom there is. In ice each water molecule has two of them.', why: 'The hydrogen atoms make the links that build the open rings of ice.', life: 'Water is hydrogen and oxygen. So is the ice in your freezer.', where: ['ice_ih'] },
  C: { short: 'The atom in diamond, graphite and pencil lead. Also in limestone.', what: 'Carbon can link in different ways. Four holds make diamond. Three holds make graphite.', why: 'Same atom, different stacking. One is the hardest natural material. The other is soft.', life: 'Pencil lead, diamond saw blades and limestone all hold carbon.', where: ['diamond', 'graphite', 'calcite'] },
  O: { short: 'The atom in water, sand and limestone.', what: 'Oxygen links to other atoms in ice, quartz and calcite.', why: 'It is the most common atom in the rocks of the Earth.', life: 'You breathe it. It is also in the sand on the beach.', where: ['ice_ih', 'quartz', 'calcite'] },
  Na: { short: 'A soft metal atom. It teams up with chlorine in table salt.', what: 'In salt, each sodium atom gives one electron to chlorine. It becomes a charged atom.', why: 'The charge pulls it to chlorine. That pull holds the salt crystal.', life: 'Sodium is the salty part of the salt shaker.', where: ['nacl'] },
  Mg: { short: 'The lightest common metal for building things.', what: 'Magnesium atoms stack in flat tight layers.', why: 'A light metal is easy to lift and carry.', life: 'Some laptop cases and car parts are made of magnesium.', where: ['mg_hcp'] },
  Al: { short: 'A light metal atom. It stacks in a cube with face atoms.', what: 'Aluminum atoms sit at the corners and faces of a cube.', why: 'Its layers slide easily, so the metal is soft and easy to shape.', life: 'Window frames, siding and cans are made of aluminum.', where: ['al_fcc'] },
  Si: { short: 'The atom in solar cells, chips and sand.', what: 'Silicon holds four other atoms. It is stacked like diamond. In quartz it holds four oxygens.', why: 'Pure silicon slices make chips. Silicon with oxygen makes sand and glass.', life: 'Solar panels, phone chips and beach sand all hold silicon.', where: ['silicon', 'quartz'] },
  Cl: { short: 'The atom that takes an electron from sodium in table salt.', what: 'Chlorine takes one electron and becomes a charged atom. Then it pulls on sodium.', why: 'Its pull on sodium holds the salt crystal together.', life: 'Chlorine is the other half of the salt shaker.', where: ['nacl', 'cscl'] },
  Ca: { short: 'The metal atom in limestone, marble and chalk.', what: 'In calcite each calcium atom sits among six oxygen atoms.', why: 'Calcium and carbonate layers take turns. That builds the stone.', life: 'Limestone, marble and the cement in concrete come from calcium.', where: ['calcite'] },
  Ti: { short: 'A strong, light metal atom that does not rust.', what: 'Titanium atoms stack in tight flat layers.', why: 'It is strong and about half as heavy as steel.', life: 'Some landmark buildings have titanium roofs.', where: ['ti_hcp'] },
  Fe: { short: 'The main atom in steel.', what: 'Iron atoms stack in a cube with one in the middle. When red hot they stack another way.', why: 'The stacking sets how strong steel is, and heat can change it.', life: 'Steel beams, rebar and nails are mostly iron.', where: ['fe_bcc', 'fe_fcc'] },
  Cu: { short: 'The metal atom in wire and pipes.', what: 'Copper atoms stack in a cube with face atoms, packed very tight.', why: 'Layers slide, so copper bends into wire. It also carries electricity well.', life: 'The wires in your walls are copper.', where: ['cu_fcc'] },
  Zn: { short: 'The metal atom that coats galvanized steel.', what: 'Zinc atoms form flat layers that sit a little far apart.', why: 'Zinc wears away before iron does. That saves the steel under it.', life: 'Galvanized roofing and screws wear a zinc coat.', where: ['zn_hcp'] },
  Cs: { short: 'A big metal atom. It makes a salt with chlorine.', what: 'Cesium is much bigger than sodium. Eight chlorine atoms fit around it.', why: 'Atom size decides how a salt stacks.', life: 'Cesium is rare. Atomic clocks use it.', where: ['cscl'] },
};

function crystalName(id) { return TEXT.l3.crystals[id].name; }

function elementEntry(sym) {
  const e = ELEMENTS[sym];
  const t = ELEMENT_TEXT[sym];
  return {
    id: `el_${sym}`,
    title: e.name,
    kind: 'Atom',
    short: t.short,
    what: t.what,
    why: t.why,
    life: t.life,
    facts: [
      { label: 'Symbol', value: sym },
      { label: 'Atomic number', value: String(e.Z) },
      { label: 'Atomic mass', value: `${e.mass} g/mol` },
      { label: 'Found here in', value: t.where.map(crystalName).join(', ') },
    ],
    more: ['An atom is drawn as a ball. A real atom has no hard edge. It is a cloud of electrons around a tiny center.'],
    related: ['crystal', ...t.where],
    source: 'Standard atomic weights (IUPAC)',
  };
}

const IDEAS = {
  crystal: {
    title: 'Crystal', kind: 'Idea',
    short: 'A solid whose atoms sit in a pattern that repeats.',
    what: 'In a crystal the atoms are stacked in order. The same small pattern repeats over and over, like bricks in a wall.',
    why: 'The pattern decides if a solid is hard, soft, bendy, or splits along flat faces.',
    life: 'Salt, ice, sand, steel and diamond are all crystals.',
    more: ['Glass is not a crystal. Its atoms are joined at random.', 'Most real solids are made of many tiny crystals joined together. Each tiny crystal is called a grain.'],
    related: ['cell', 'grain', 'slip', 'cleavage'],
  },
  cell: {
    title: 'Repeating block', kind: 'Idea',
    short: 'The small block of atoms that repeats to build the crystal.',
    what: 'Stack copies of this block in every direction and you build the whole grain. Scientists call it the unit cell.',
    why: 'If you know one block, you know the whole crystal.',
    life: 'A tile floor works the same way. One tile repeats.',
    facts: [{ label: 'Also called', value: 'Unit cell' }],
    more: ['The block is drawn as a thin box. Atoms on its edges and corners are shared with the blocks next to it.', 'The edge lengths and angles of the block are called lattice constants.'],
    related: ['crystal', 'lattice_constant', 'grain'],
  },
  neighbors: {
    title: 'Touching neighbors', kind: 'Idea',
    short: 'How many atoms touch one atom.',
    what: 'Pick one atom and count the atoms that touch it. Engineers call this the coordination number.',
    why: 'More touching neighbors means a tighter stack. Fewer means more open space.',
    life: 'In a crate of oranges, each orange touches twelve others.',
    facts: [{ label: 'Also called', value: 'Coordination number' }, { label: 'Tight metals', value: '12' }, { label: 'Diamond', value: '4' }],
    related: ['packing', 'fcc', 'bcc'],
  },
  packing: {
    title: 'Packing', kind: 'Idea',
    short: 'How much of the space the atoms fill.',
    what: 'Picture the atoms as hard balls that touch. The packing is the share of space the balls fill. The rest is gaps.',
    why: 'Tight stacks are dense and hard to squash. Open stacks are light.',
    life: 'A crate of oranges is about three quarters orange. The rest is air.',
    facts: [{ label: 'Tightest for equal balls', value: '74 percent' }, { label: 'Body-centered cube', value: '68 percent' }, { label: 'Diamond', value: '34 percent' }],
    related: ['neighbors', 'density', 'fcc'],
  },
  slip: {
    title: 'Slip', kind: 'Idea',
    short: 'Layers of metal atoms sliding past each other.',
    what: 'In a metal the layers of atoms can slide a short step. The metal changes shape. It does not crack.',
    why: 'This is why metal bends. Salt or glass cannot do it, so they break.',
    life: 'A paper clip bends because its layers slide. Copper is pulled into wire the same way.',
    more: ['Tight stacks with many flat layers slide most easily. Copper and aluminum are good examples.', 'Strong holds in every direction, as in diamond, stop slip. Diamond breaks instead of bending.'],
    related: ['plane', 'fcc', 'cleavage'],
  },
  cleavage: {
    title: 'Cleavage', kind: 'Idea',
    short: 'A crystal splitting along flat faces.',
    what: 'Some crystals have weak flat planes inside. Hit them and they split along those planes. The faces are smooth.',
    why: 'This is why salt breaks into tiny cubes. Gem cutters use it to split diamonds.',
    life: 'Calcite from limestone splits into slanted blocks. Salt grains are cubes.',
    related: ['plane', 'slip', 'nacl'],
  },
  grain: {
    title: 'Grain', kind: 'Idea',
    short: 'One tiny crystal with one steady pattern.',
    what: 'A real lump of metal or rock is made of many tiny crystals joined together. Each one is a grain. Inside a grain the pattern runs straight.',
    why: 'The size of the grains and the edges between them change how strong a metal is.',
    life: 'A steel beam is made of many billions of tiny grains.',
    related: ['crystal', 'cell'],
  },
  bcc: {
    title: 'Body-centered cube', kind: 'Idea',
    short: 'A cube with an atom at each corner and one in the middle.',
    what: 'Eight atoms sit at the corners of a cube. One more sits in the center. Engineers say body-centered cubic, or BCC.',
    why: 'Iron at room temperature stacks this way. Each atom touches eight neighbors.',
    life: 'Steel beams are mostly iron in this pattern.',
    facts: [{ label: 'Touching neighbors', value: '8' }, { label: 'Space filled', value: '68 percent' }, { label: 'Example', value: 'Iron at room temperature' }],
    related: ['fe_bcc', 'fcc', 'hcp'],
  },
  fcc: {
    title: 'Face-centered cube', kind: 'Idea',
    short: 'A cube with an atom at each corner and one on each face.',
    what: 'Atoms sit at the corners of a cube and in the middle of every face. Engineers say face-centered cubic, or FCC.',
    why: 'This is the tightest stack for equal balls. Many flat layers slide easily, so these metals bend.',
    life: 'Copper wire and aluminum window frames use this pattern.',
    facts: [{ label: 'Touching neighbors', value: '12' }, { label: 'Space filled', value: '74 percent' }, { label: 'Examples', value: 'Copper, aluminum, hot iron' }],
    related: ['cu_fcc', 'al_fcc', 'slip', 'bcc'],
  },
  hcp: {
    title: 'Hexagonal pattern', kind: 'Idea',
    short: 'Flat layers that stack in a repeating A, B, A, B way.',
    what: 'Each flat layer rests in the dips of the layer below. The third layer sits right above the first. Engineers say hexagonal close-packed, or HCP.',
    why: 'Each atom touches twelve neighbors, like in the face-centered cube. The layers stack in a different order.',
    life: 'Titanium roofing and the zinc coat on galvanized steel use this pattern.',
    facts: [{ label: 'Touching neighbors', value: '12' }, { label: 'Examples', value: 'Titanium, magnesium, zinc' }],
    related: ['ti_hcp', 'mg_hcp', 'zn_hcp', 'fcc'],
  },
  density: {
    title: 'Density', kind: 'Idea',
    short: 'How heavy a material is for its size.',
    what: 'Take two blocks of the same size. The denser one weighs more.',
    why: 'The weight of the atoms and how tight they pack decide it.',
    life: 'A jug of iron weighs far more than a jug of water.',
    facts: [{ label: 'Water', value: '1 g/cm³ (62 lb/ft³)' }],
    related: ['packing', 'ice_ih'],
  },
  ionic: {
    title: 'Opposite charges', kind: 'Idea',
    short: 'Atoms with opposite charges pull on each other.',
    what: 'In salt, sodium gives one electron to chlorine. Now one atom has a plus charge and the other has a minus charge. They attract.',
    why: 'The pull holds the crystal together. It is strong, but a hard hit can split the crystal.',
    life: 'Salt melts ice on a road. It also dissolves in water, because water pulls on the charges.',
    related: ['nacl', 'cscl', 'cleavage'],
  },
  miller: {
    title: 'Miller planes', kind: 'Idea',
    short: 'Three small numbers that name a flat plane in a crystal.',
    what: 'The numbers tell which way a plane is tilted inside the repeating block. (100) is a cube face.',
    why: 'They let scientists say which plane slides or splits.',
    life: 'Chip makers cut silicon along a named plane.',
    more: ['Miller indices h, k, l are the reciprocals of where the plane cuts the three block edges.'],
    related: ['plane', 'cell'],
  },
  lattice_constant: {
    title: 'Cell edges', kind: 'Idea',
    short: 'The lengths of the edges of the repeating block.',
    what: 'They are measured in angstroms. One angstrom is a tenth of a billionth of a meter.',
    why: 'They set the size of every gap and every distance in the crystal.',
    life: 'A bigger tile covers more floor.',
    facts: [{ label: '1 Å', value: '0.1 nanometer' }],
    related: ['cell'],
  },
  plane: {
    title: 'Plane', kind: 'Plane',
    short: 'A flat sheet of atoms cut through the crystal.',
    what: 'The drawn sheet shows one layer of atoms. Layers slide, or the crystal splits, along planes like this.',
    why: 'Which plane matters depends on how the atoms are stacked.',
    life: 'A deck of cards slides along its layers.',
    related: ['slip', 'cleavage', 'miller'],
  },
  bond: {
    title: 'Stick', kind: 'Bond',
    short: 'A stick shows a strong hold between two atoms.',
    what: 'Sticks join atoms that sit close and hold each other. They are only a drawing aid.',
    why: 'They help you see the pattern and count the neighbors.',
    life: 'Think of a model made with balls and sticks.',
    more: ['A real hold between atoms is a cloud of electrons shared or moved between them.'],
    related: ['neighbors', 'crystal'],
  },
  hbond: {
    title: 'Hydrogen bond', kind: 'Bond',
    short: 'A weak hold between two water molecules.',
    what: 'A dashed line joins a hydrogen of one water molecule to the oxygen of the next. It is weaker than a stick.',
    why: 'These holds build the open rings of ice.',
    life: 'They are why ice floats, and why water that freezes in a pipe can crack it.',
    related: ['ice_ih', 'el_H', 'el_O'],
  },
};

/** One card per crystal in the library. */
const CRYSTAL_TEXT = {
  fe_bcc: {
    short: 'Iron at room temperature. This is the stack inside steel.',
    what: 'Iron atoms sit at the corners of a cube, with one more in the middle.',
    why: 'The gaps are small, so very little carbon fits. When steel is heated, the stack changes and carbon fits better.',
    life: 'Steel beams hold up buildings. Most of their iron has this pattern.',
    related: ['el_Fe', 'bcc', 'fe_fcc', 'grain'],
  },
  fe_fcc: {
    short: 'Iron when it is red hot.',
    what: 'When iron gets very hot, its atoms rearrange. Now an atom sits on every face of the cube.',
    why: 'The gaps are bigger, so much more carbon can dissolve in the iron. This is the base of heat treatment.',
    life: 'Steel mills heat steel into this form. Then they cool it a set way to make it hard.',
    related: ['el_Fe', 'fcc', 'fe_bcc'],
  },
  al_fcc: {
    short: 'Aluminum. Light and soft.',
    what: 'Aluminum atoms sit at the corners and on the faces of a cube.',
    why: 'Layers slide easily, so aluminum is soft and easy to shape. It is about one third as heavy as steel.',
    life: 'Window frames and siding are made of aluminum pushed through a die.',
    related: ['el_Al', 'fcc', 'slip'],
  },
  cu_fcc: {
    short: 'Copper. The metal of wire.',
    what: 'Copper atoms sit at the corners and on the faces of a cube. They pack as tight as balls can.',
    why: 'Layers slide easily, so copper can be pulled into thin wire or rolled flat. It also carries electricity well.',
    life: 'The wires in your walls are copper. So are many pipes and roofs.',
    related: ['el_Cu', 'fcc', 'slip'],
  },
  zn_hcp: {
    short: 'Zinc. The coat on galvanized steel.',
    what: 'Zinc atoms form flat layers. The layers sit a little farther apart than in a perfect stack.',
    why: 'Zinc wears away before iron does, so a zinc coat protects the steel under it.',
    life: 'Galvanized roofing and screws wear a zinc coat.',
    related: ['el_Zn', 'hcp', 'el_Fe'],
  },
  ti_hcp: {
    short: 'Titanium. Strong, light and rust free.',
    what: 'Titanium atoms form tight flat layers. Each layer rests in the dips of the one below.',
    why: 'It is strong and only about half as heavy as steel. It does not rust.',
    life: 'Some landmark buildings have titanium roofs and walls.',
    related: ['el_Ti', 'hcp'],
  },
  mg_hcp: {
    short: 'Magnesium. The lightest common metal for building things.',
    what: 'Magnesium atoms form tight flat layers, close to a perfect stack.',
    why: 'It is about one fourth as heavy as steel, so it is easy to carry.',
    life: 'Some laptop cases and car parts are made of magnesium.',
    related: ['el_Mg', 'hcp'],
  },
  nacl: {
    short: 'Table salt. A checkerboard of two kinds of atoms.',
    what: 'Sodium and chlorine take turns in all three directions. Each one has six of the other kind around it.',
    why: 'Opposite charges hold it together, so salt is hard but brittle. It splits along cube faces.',
    life: 'Look at salt through a magnifier. You will see tiny cubes. Road salt melts ice, but it can harm concrete.',
    related: ['el_Na', 'el_Cl', 'ionic', 'cleavage'],
  },
  cscl: {
    short: 'A salt that stacks in a different way from table salt.',
    what: 'A big cesium atom sits in the middle of a cube of chlorine atoms. Eight chlorines touch each cesium.',
    why: 'Cesium is much bigger than sodium, so more chlorines fit around it. Atom size decides how a salt stacks.',
    life: 'It is rare. It shows why the size of atoms matters in rocks and ceramics.',
    related: ['el_Cs', 'el_Cl', 'nacl', 'ionic'],
  },
  diamond: {
    short: 'Diamond. The hardest natural material.',
    what: 'Each carbon atom holds four others, at the corners of a small pyramid.',
    why: 'The holds are strong in every direction, so no layers can slide. Diamond is very hard.',
    life: 'Saw blades and drill bits tipped with diamond cut concrete and stone.',
    related: ['el_C', 'graphite', 'neighbors', 'cleavage'],
  },
  silicon: {
    short: 'Silicon. The base of solar cells and chips.',
    what: 'Silicon is stacked just like diamond. Each atom holds four others.',
    why: 'Thin slices of pure silicon are cut from one big crystal. They make solar cells and chips.',
    life: 'Solar panels on roofs and the chip in your phone are made of silicon.',
    related: ['el_Si', 'diamond', 'quartz', 'miller'],
  },
  graphite: {
    short: 'Graphite. Pencil lead.',
    what: 'Carbon atoms make flat sheets of six-sided rings. Each atom holds three others in its sheet.',
    why: 'The sheets are held to each other only weakly, so they slide. That is why a pencil writes.',
    life: 'Pencils use graphite. Carbon fiber, which strengthens concrete and parts, is made of graphite-like sheets.',
    related: ['el_C', 'diamond', 'slip', 'plane'],
  },
  ice_ih: {
    short: 'Ice. An open cage of water molecules.',
    what: 'Water molecules link into open rings of six. Each one holds four others by hydrogen bonds.',
    why: 'The empty space inside the rings makes ice lighter than water, so it floats. Water grows as it freezes.',
    life: 'Ice floats in your drink. Snowflakes have six sides. Water that freezes in a pipe or in brick can crack it.',
    related: ['el_O', 'el_H', 'hbond', 'density'],
  },
  quartz: {
    short: 'Quartz. The main mineral in sand.',
    what: 'Each silicon atom sits in a small pyramid of four oxygen atoms. The pyramids share corners and wind in a spiral.',
    why: 'Quartz is hard and does not dissolve in water. It lasts, so it fills beaches and riverbeds.',
    life: 'Sand goes into concrete and glass. Quartz also keeps time in a watch.',
    related: ['el_Si', 'el_O', 'silicon'],
  },
  calcite: {
    short: 'Calcite. The mineral of limestone and marble.',
    what: 'Each carbon atom sits in a flat triangle of three oxygen atoms. Triangles and calcium atoms take turns in layers.',
    why: 'It splits along flat planes, and acid slowly dissolves it. Acid rain wears carved stone.',
    life: 'Limestone and marble are building stone. Heated limestone becomes lime, which goes into cement.',
    related: ['el_Ca', 'el_C', 'el_O', 'cleavage'],
  },
};

function crystalEntry(id) {
  const c = CRYSTALS[id];
  const t = CRYSTAL_TEXT[id];
  const e = c.expect;
  const touching = e.shells ? `${e.shells[0].n} + ${e.shells[1].n}` : String(e.coordination);
  const facts = [
    { label: 'Stacking pattern', value: c.lattice },
    { label: 'Touching neighbors', value: touching },
    { label: 'Nearest distance', value: `${e.nearest} Å` },
    { label: 'Density', value: `${e.density} g/cm³ (${lbft3(e.density)})` },
    { label: 'Atoms in the repeating block', value: String(e.atomsPerCell) },
  ];
  if (e.packing != null) facts.push({ label: 'Space filled', value: `${Math.round(e.packing * 100)} percent` });
  return {
    id,
    title: TEXT.l3.crystals[id].name,
    kind: GROUP_TAG[c.group] || 'Crystal',
    short: t.short,
    what: t.what,
    why: t.why,
    life: t.life,
    facts,
    more: c.facts.slice(),
    related: t.related,
    source: c.source,
  };
}

export const INFO = {};
for (const sym of Object.keys(ELEMENT_TEXT)) INFO[`el_${sym}`] = elementEntry(sym);
for (const [id, e] of Object.entries(IDEAS)) INFO[id] = { id, ...e };
for (const id of CRYSTAL_ORDER) INFO[id] = crystalEntry(id);

export function getInfo(id) { return INFO[id] || null; }

/** Card id for a hovered or tapped atom symbol. */
export const elementId = (sym) => `el_${sym}`;
