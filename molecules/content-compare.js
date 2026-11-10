// molecules/content-compare.js  words for the Compare mode, in five layers. Pure data, no DOM, runs in Node.
// Levels 1 to 3 are written for a sixth grade reader. Facts in INFO match molecules/compare-data.js.
// Pair ids: iron, carbon, glass, water, metals, plastic. Structure ids (for cards): see STRUCTURE_IDS.

export const PAIR_IDS = ['iron', 'carbon', 'glass', 'water', 'metals', 'plastic'];

// which card opens for each side of each pair (plastic uses the chosen plastic)
export const STRUCTURE_IDS = {
  iron: { left: 'iron-cold', right: 'iron-hot' },
  carbon: { left: 'diamond', right: 'graphite' },
  glass: { left: 'quartz', right: 'glass' },
  water: { left: 'ice', right: 'liquid' },
  metals: { left: 'copper', right: 'zinc' },
  plastic: { left: 'ethylene', right: { pe: 'polyethylene', pvc: 'pvc', ps: 'polystyrene' } },
};

export const TEXT = {
  // ---------------------------------------------------------------- level 1: the big idea, no digits
  l1: {
    question: 'Same atoms. Why so different?',
    sub: 'Pick a pair and watch both turn.',
    pick: 'Pick a pair',
    // a plain name under each structure, and the line on a phone
    labels: {
      iron: { left: 'Cold iron', right: 'Red hot iron' },
      carbon: { left: 'Diamond', right: 'Pencil lead' },
      glass: { left: 'Quartz', right: 'Glass' },
      water: { left: 'Ice', right: 'Water' },
      metals: { left: 'Copper', right: 'Zinc' },
      plastic: { left: 'A gas', right: 'A plastic' },
    },
    summary: {
      iron: 'Cold iron and red hot iron',
      carbon: 'Diamond and pencil lead',
      glass: 'Quartz and glass',
      water: 'Ice and water',
      metals: 'Copper and zinc',
      plastic: 'A gas and a plastic',
    },
    answers: {
      carbon: {
        title: 'The pattern makes the difference',
        text: 'Diamond and pencil lead are both only carbon. In diamond, every atom grips its neighbors in all directions. In pencil lead, the atoms sit in flat sheets that slide.',
      },
      water: {
        title: 'Ice holds its pieces apart',
        text: 'Ice and water are made of the same pieces. Ice holds them in an open pattern, with gaps. Water packs them closer, so ice floats.',
      },
      glass: {
        title: 'One is neat, one is a jumble',
        text: 'Quartz and glass are made of the same atoms. In quartz they sit in a neat pattern. In glass they are frozen in a jumble.',
      },
      iron: {
        title: 'Heat moves the atoms',
        text: 'Cold iron and red hot iron are the same atoms. Heat makes them move into a new pattern. That is how steel gets its strength.',
      },
      metals: {
        title: 'Layers can slide in more ways',
        text: 'Copper and zinc are both metals. In copper, layers of atoms slide in many ways, so it bends. Zinc has only one way, so it is more brittle.',
      },
      plastic: {
        title: 'Long chains make a plastic',
        text: 'A gas has tiny pieces that fly apart. Link thousands of them into long chains and you get a plastic.',
      },
    },
    choices: [
      { id: 'carbon', label: 'Diamond and pencil lead' },
      { id: 'water', label: 'Ice and water' },
      { id: 'glass', label: 'Glass and quartz' },
      { id: 'iron', label: 'Two kinds of iron' },
    ],
  },

  // ---------------------------------------------------------------- level 2: the story, one per pair
  l2: {
    title: 'The story',
    pairs: {
      carbon: {
        steps: [
          { title: 'Look at diamond', text: 'Each carbon atom holds four neighbors. The grip goes in every direction.', life: 'A drill bit with a diamond tip can cut through stone.' },
          { title: 'Look at pencil lead', text: 'Pencil lead is graphite. Its atoms sit in flat sheets, stacked like paper.', life: 'A pencil leaves a mark because sheets rub off onto the page.' },
          { title: 'Find the difference', text: 'The sheets are colored so you can see them. The grip is strong inside a sheet. It is weak between sheets.', life: 'Think of a deck of cards. Each card is strong, but the deck slides.' },
          { title: 'Why they act so different', text: 'Diamond has no weak spot, so it is very hard. Graphite sheets slide apart with a light push.', life: 'That is why graphite powder can free a sticky lock.' },
          { title: 'Where you meet them', text: 'Both are only carbon. One is a jewel and a tool. The other is a pencil.', life: 'Saw blades for concrete use diamond. Your pencil uses graphite.' },
        ],
      },
      water: {
        steps: [
          { title: 'Look at ice', text: 'Each water piece links to four neighbors. The links make open rings with six sides.', life: 'This open pattern is why ice cubes are a little puffy inside.' },
          { title: 'Look at water', text: 'Now the same pieces are a liquid. They tumble past each other and sit closer.', life: 'Water in a glass has no pattern. It takes the shape of the glass.' },
          { title: 'Find the difference', text: 'Both boxes hold the same number of pieces. The ice box is taller, because of the gaps.', life: 'The gaps are like empty seats on a bus.' },
          { title: 'Why ice floats', text: 'Ice needs more room for the same pieces. That makes it lighter than water, so it floats.', life: 'A lake freezes from the top, so fish can live below the ice.' },
          { title: 'Where you meet them', text: 'Water grows when it freezes, and it pushes hard on anything around it.', life: 'A pipe can burst in winter, and concrete can crack and flake.' },
        ],
      },
      glass: {
        steps: [
          { title: 'Look at quartz', text: 'Quartz is the main stuff in sand. Its atoms sit in a neat pattern that repeats.', life: 'Sand on a beach is tiny bits of quartz.' },
          { title: 'Look at glass', text: 'Glass has the same two kinds of atoms. They are frozen in a jumble, with no pattern.', life: 'A window is glass. Light goes straight through it.' },
          { title: 'Find the difference', text: 'Turn on the repeating block. Quartz repeats one block again and again. Glass has none.', life: 'A tile floor repeats. A pile of pebbles does not.' },
          { title: 'Why they act so different', text: 'Glass cools too fast to build a pattern. With no grain edges, light is not scattered.', life: 'That is why a window is clear. A rough crystal is cloudy.' },
          { title: 'Where you meet them', text: 'Window glass starts as sand. It is melted, then cooled before the atoms can settle.', life: 'Sand becomes windows, bottles, and phone screens.' },
        ],
      },
      iron: {
        steps: [
          { title: 'Look at cold iron', text: 'At room temperature, each atom touches eight neighbors. One atom sits in the middle of each block.', life: 'This is the iron in a cold steel beam.' },
          { title: 'Look at red hot iron', text: 'When iron glows red, the atoms move to a new pattern. Now an atom sits in the middle of each face.', life: 'A blacksmith sees the metal glow as the pattern changes.' },
          { title: 'Find the gap for carbon', text: 'Turn on the carbon atom. It is big, but it fits much better in the hot pattern.', life: 'Steel is iron with a little carbon inside it.' },
          { title: 'Why heat matters', text: 'Hot iron can soak up more carbon. Cool it fast and the carbon is trapped. That makes steel hard.', life: 'This is how a knife blade or a steel tool gets its edge.' },
          { title: 'Where you meet it', text: 'Makers heat and cool steel on purpose to get the strength they want.', life: 'Steel beams, car parts, and kitchen knives all get this care.' },
        ],
      },
      metals: {
        steps: [
          { title: 'Look at copper', text: 'The colored sheets mark layers of atoms. Copper has layers that run in four directions.', life: 'Copper wire is easy to bend around a corner.' },
          { title: 'Look at zinc', text: 'Zinc has layers too. They all run in just one direction.', life: 'Zinc is the shiny coat on a galvanized bucket.' },
          { title: 'Find the difference', text: 'Hide the sheets. The atoms still make layers, but zinc has fewer ways to slide.', life: 'Think of sliding a book across a table, then trying a different way.' },
          { title: 'Why they act so different', text: 'When a metal bends, layers slide over each other. Copper has many ways to slide, so it bends instead of breaking.', life: 'That is why a copper wire can bend again and again.' },
          { title: 'Where you meet them', text: 'Copper is rolled and drawn into shapes. Zinc is mostly used as a coat.', life: 'Roofing and water pipes use copper. Zinc protects steel from rust.' },
        ],
      },
      plastic: {
        steps: [
          { title: 'Look at one small piece', text: 'This gas has only six atoms. It is called ethylene.', life: 'Ripening fruit gives off a little of this gas.' },
          { title: 'Look at the chain', text: 'Link many of these pieces and you get a long chain. This is polyethylene.', life: 'This plastic makes bags and many milk jugs.' },
          { title: 'Find the repeating link', text: 'Show one repeat link. One small piece becomes one link in the chain.', life: 'A chain of paper clips is made the same way.' },
          { title: 'Why chains act different', text: 'Long chains tangle like cooked spaghetti. That makes plastic tough. Heat lets the chains slide, so it softens.', life: 'A plastic bottle goes soft in a hot car.' },
          { title: 'Where you meet it', text: 'Swap some atoms and you get other plastics, such as PVC and polystyrene.', life: 'PVC makes pipes and window frames. Polystyrene makes foam cups.' },
        ],
      },
    },
  },

  // ---------------------------------------------------------------- level 3: explore
  l3: {
    controls: {
      pair: 'Pick a pair',
      look: 'Look at',
      left: 'Left',
      both: 'Both',
      right: 'Right',
      labels: 'Show element names',
      view: 'View',
      atoms: 'Atoms',
      tryTitle: 'Try this',
      noticeTitle: 'What to notice',
      lifeTitle: 'In a building',
      cards: 'Cards',
      variant: 'Plastic on the right',
    },
    pairs: {
      iron: {
        name: 'Cold iron and hot iron',
        sub: 'Why does heating change steel?',
        notice: [
          'Cold iron has fewer touching neighbors than hot iron.',
          'The widest gap in hot iron is much wider than in cold iron.',
          'A carbon atom is bigger than either gap, but it fits hot iron better.',
        ],
        building: 'Steel beams get their strength from heating and then cooling.',
        tries: [
          { label: 'Look at room-temperature iron', hint: 'Count the neighbors around one atom.' },
          { label: 'Now heat it', hint: 'The atoms move into a new pattern.' },
          { label: 'Find the gap for carbon', hint: 'The iron fades so the carbon stands out.' },
        ],
      },
      carbon: {
        name: 'Diamond and graphite',
        sub: 'Same atom, opposite materials.',
        notice: [
          'Both are made of carbon atoms and nothing else.',
          'Diamond has strong bonds in every direction.',
          'Graphite has strong bonds in each sheet, but weak ones between sheets.',
        ],
        building: 'Diamond tips cut concrete and stone. Graphite works as a dry oil.',
        tries: [
          { label: 'Look at diamond', hint: 'Bonds run in every direction.' },
          { label: 'Look at graphite', hint: 'The atoms sit in flat layers.' },
          { label: 'Show the sheets', hint: 'Each sheet has its own color.' },
        ],
      },
      glass: {
        name: 'Quartz and glass',
        sub: 'Why is glass clear and shapeless inside?',
        notice: [
          'In both, each silicon atom sits in the middle of four oxygen atoms.',
          'Glass has no grains, so light passes straight through.',
          'A crystal melts at one exact heat. Glass softens slowly as it warms.',
        ],
        building: 'Window glass is made from sand. It cools before a crystal can form.',
        tries: [
          { label: 'Look at quartz', hint: 'Every piece sits in a neat pattern.' },
          { label: 'Look at glass', hint: 'Same pieces, no pattern.' },
          { label: 'Show the repeating block', hint: 'Quartz repeats one block. Glass has none.' },
        ],
      },
      water: {
        name: 'Ice and liquid water',
        sub: 'Why does ice float?',
        notice: [
          'Both boxes hold the same number of water pieces.',
          'In ice, each piece links to four neighbors in open rings.',
          'In water the links keep breaking and forming, so none are drawn.',
        ],
        building: 'Water grows when it freezes. That is why pipes burst and concrete flakes.',
        tries: [
          { label: 'Look at ice', hint: 'The dashed links hold the pieces in open rings.' },
          { label: 'Melt it', hint: 'The pieces pack closer.' },
          { label: 'Compare the boxes', hint: 'Same pieces. The ice box is taller.' },
        ],
      },
      metals: {
        name: 'Copper and zinc',
        sub: 'Why does copper bend and zinc not?',
        notice: [
          'When a metal bends, layers of atoms slide over each other.',
          'Copper has more directions of sliding layers than zinc.',
          'The colored sheets mark the layers that can slide.',
        ],
        building: 'Copper is rolled into roofs and pipes. Zinc coats steel to stop rust.',
        tries: [
          { label: 'Look at copper', hint: 'Count the sheets that run in different directions.' },
          { label: 'Look at zinc', hint: 'The layers all run one way.' },
          { label: 'Hide the sheets', hint: 'Can you still see the layers in the atoms?' },
        ],
      },
      plastic: {
        name: 'A small molecule and a plastic',
        sub: 'What is a plastic?',
        notice: [
          'Ethylene is a gas. Linked into long chains, it becomes a solid plastic.',
          'This chain is short. Real chains are much, much longer.',
          'Swap some hydrogen atoms to make other plastics, such as PVC.',
        ],
        building: 'Polyethylene lines the ground under slabs. PVC makes pipes and window frames.',
        tries: [
          { label: 'Start with one small molecule', hint: 'A gas with very few atoms.' },
          { label: 'Link them into a chain', hint: 'Each piece joins the next.' },
          { label: 'Show one repeat link', hint: 'One small molecule becomes one link.' },
        ],
      },
    },
    notes: [
      'Tap or hover over an atom to learn about it.',
      'Use the info buttons to learn about each structure.',
      'Drag to turn the view. Pinch or scroll to zoom.',
    ],
    cardHint: 'Tap an atom for a card.',
  },

  // ---------------------------------------------------------------- level 4: numbers side by side
  l4: {
    title: 'Side by side',
    left: 'Left',
    right: 'Right',
    // rows per pair. kind: count | gcc | angstrom | plain | text
    // text rows have fixed words for each side. The compare line sits under every row.
    pairs: {
      carbon: { rows: [
        { id: 'neighbors', label: 'Touching neighbors', kind: 'count', compare: 'Diamond holds each atom with four neighbors. Graphite holds it with three.' },
        { id: 'density', label: 'Density', kind: 'gcc', compare: 'Diamond packs more atoms into the same space.' },
        { id: 'hardness', label: 'Hardness', kind: 'text', left: 'Hardest natural material', right: 'Very soft', compare: 'A diamond scratches almost anything. Graphite smears on paper.' },
        { id: 'nearest', label: 'Bond length', kind: 'angstrom', compare: 'Bonds inside graphite sheets are a little shorter than in diamond.' },
      ] },
      iron: { rows: [
        { id: 'neighbors', label: 'Touching neighbors', kind: 'count', compare: 'Hot iron has four more touching neighbors.' },
        { id: 'density', label: 'Density', kind: 'gcc', compare: 'Hot iron is a little less dense, because heat makes metal grow.' },
        { id: 'gap', label: 'Widest gap (radius)', kind: 'angstrom', compare: 'The hot gap is almost three times wider, so carbon fits.' },
        { id: 'nearest', label: 'Bond length', kind: 'angstrom', compare: 'The atoms sit a little farther apart in hot iron.' },
      ] },
      glass: { rows: [
        { id: 'neighbors', label: 'Oxygen around each silicon', kind: 'count', compare: 'Both have four. Only the order is different.' },
        { id: 'density', label: 'Density', kind: 'gcc', compare: 'Glass is a little less dense. A jumble leaves more gaps.' },
        { id: 'repeat', label: 'Repeating block', kind: 'plain', compare: 'Quartz repeats one block. Glass repeats nothing.' },
        { id: 'nearest', label: 'Bond length', kind: 'angstrom', compare: 'The bonds are almost the same length in both.' },
      ] },
      water: { rows: [
        { id: 'neighbors', label: 'Links per water piece', kind: 'count', compare: 'Ice links each piece to four neighbors. Water links keep changing.' },
        { id: 'density', label: 'Density', kind: 'gcc', compare: 'Ice is lighter than water, so it floats.' },
        { id: 'volume', label: 'Box volume', kind: 'plain', unit: 'Å³', compare: 'The same pieces need about 9 percent more room as ice.' },
        { id: 'nearest', label: 'Distance between oxygen atoms', kind: 'angstrom', compare: 'Water has no fixed distance, so none is shown.' },
      ] },
      metals: { rows: [
        { id: 'neighbors', label: 'Closest neighbors', kind: 'count', compare: 'Copper has twice as many close neighbors as zinc.' },
        { id: 'slide', label: 'Directions of sliding layers', kind: 'count', compare: 'More sliding directions means a metal bends instead of breaking.' },
        { id: 'density', label: 'Density', kind: 'gcc', compare: 'Copper is heavier for its size than zinc.' },
        { id: 'nearest', label: 'Bond length', kind: 'angstrom', compare: 'Zinc atoms sit a little farther apart.' },
      ] },
      plastic: { rows: [
        { id: 'carbons', label: 'Carbon atoms', kind: 'count', compare: 'The chain is much longer than the small piece. Real chains are longer still.' },
        { id: 'state', label: 'Normal state', kind: 'text', left: 'A gas', right: 'A solid', compare: 'Linking small pieces into chains turns a gas into a solid.' },
        { id: 'length', label: 'Length of the piece', kind: 'angstrom', compare: 'The chain stretches many times farther than one small piece.' },
        { id: 'nearest', label: 'Carbon to carbon bond', kind: 'angstrom', compare: 'A double bond is shorter than a single bond.' },
      ] },
    },
    glosses: {
      'touching neighbors': 'the atoms that touch one atom',
      density: 'how heavy a block is for its size',
      'bond length': 'the distance between two joined atoms',
      'Å': 'an angstrom, a tiny length of one ten-billionth of a meter',
      hardness: 'how hard it is to scratch',
    },
    none: 'Not fixed',
    tags: {
      reference: 'Reference',
      approximate: 'Approximate',
      schematic: 'Schematic',
    },
  },

  // ---------------------------------------------------------------- level 5: the deep view
  l5: {
    tableTitle: 'All the numbers',
    measure: {
      toggle: 'Measure',
      title: 'Measurement',
      off: 'Turn on Measure, then tap atoms to measure.',
      on: 'Tap two atoms to measure a distance. Tap a third for the angle.',
      distance: 'Distance between the two atoms. 1 Å is 0.1 nanometer.',
      angle: 'Angle at the second atom you tapped.',
      more: 'Tap one more atom to measure a distance.',
      none: 'None',
    },
    tags: {
      reference: 'Reference: real measured positions from a standard source.',
      approximate: 'Approximate: close to real, but simplified.',
      schematic: 'Schematic: a drawing of the idea, not measured positions.',
    },
    schematicNote: 'A drawing of the idea, not measured positions.',
    sourcesTitle: 'Sources',
    pointsTitle: 'What to notice',
    qualityRef: 'Reference data',
    qualityApprox: 'Approximate',
    qualitySchem: 'Schematic',
  },
};

// ---------------------------------------------------------------- cards
const gl = (us, si) => `${us} lb/ft³ (${si} g/cm³)`;

export const INFO = {
  // ----- atoms
  'el-C': {
    id: 'el-C', title: 'Carbon', kind: 'Atom',
    short: 'The atom behind diamond, pencil lead, and all plastics.',
    what: 'Carbon is a small atom that can hold up to four neighbors at once.',
    why: 'How the neighbors are arranged changes everything. Four in all directions make diamond. Three in a flat sheet make graphite.',
    life: 'Pencils, diamond saw blades, steel, and plastic bags all use carbon.',
    facts: [{ label: 'Symbol', value: 'C' }, { label: 'Atomic number', value: '6' }, { label: 'Mass', value: '12.011 u' }],
    related: ['diamond', 'graphite', 'same-atoms'],
  },
  'el-Fe': {
    id: 'el-Fe', title: 'Iron', kind: 'Atom',
    short: 'The main atom in steel.',
    what: 'Iron is a metal atom. It can sit in two different patterns, one cold and one hot.',
    why: 'The hot pattern has wider gaps, so it can soak up carbon. That is the secret of hard steel.',
    life: 'Steel beams, car bodies, and kitchen knives are mostly iron.',
    facts: [{ label: 'Symbol', value: 'Fe' }, { label: 'Atomic number', value: '26' }, { label: 'Mass', value: '55.845 u' }],
    related: ['iron-cold', 'iron-hot', 'carbon-gap'],
  },
  'el-Cu': {
    id: 'el-Cu', title: 'Copper', kind: 'Atom',
    short: 'A metal atom that makes bendy wire.',
    what: 'Copper atoms pack into layers that can slide in many directions.',
    why: 'Because layers slide easily, copper bends without breaking.',
    life: 'Electric wire, water pipes, and roofing use copper.',
    facts: [{ label: 'Symbol', value: 'Cu' }, { label: 'Atomic number', value: '29' }, { label: 'Mass', value: '63.546 u' }],
    related: ['copper', 'sliding-layers'],
  },
  'el-Zn': {
    id: 'el-Zn', title: 'Zinc', kind: 'Atom',
    short: 'A metal atom that guards steel from rust.',
    what: 'Zinc atoms pack into layers that slide in only one direction.',
    why: 'With fewer ways to slide, zinc is more brittle than copper at room temperature.',
    life: 'A galvanized bucket or a steel roof screw wears a thin coat of zinc.',
    facts: [{ label: 'Symbol', value: 'Zn' }, { label: 'Atomic number', value: '30' }, { label: 'Mass', value: '65.38 u' }],
    related: ['zinc', 'sliding-layers'],
  },
  'el-Si': {
    id: 'el-Si', title: 'Silicon', kind: 'Atom',
    short: 'The atom at the heart of sand and glass.',
    what: 'Each silicon atom sits in the middle of four oxygen atoms.',
    why: 'That same shape builds both neat quartz and jumbled glass.',
    life: 'Sand, windows, bottles, and computer chips all use silicon.',
    facts: [{ label: 'Symbol', value: 'Si' }, { label: 'Atomic number', value: '14' }, { label: 'Mass', value: '28.085 u' }],
    related: ['quartz', 'glass', 'crystal-vs-glass'],
  },
  'el-O': {
    id: 'el-O', title: 'Oxygen', kind: 'Atom',
    short: 'An atom in water, sand, and the air.',
    what: 'Oxygen joins to other atoms to make water and quartz.',
    why: 'In water, oxygen is the part that makes links to neighbors. In quartz, it joins two silicon atoms.',
    life: 'You breathe it, and it is in every drop of water.',
    facts: [{ label: 'Symbol', value: 'O' }, { label: 'Atomic number', value: '8' }, { label: 'Mass', value: '15.999 u' }],
    related: ['ice', 'quartz', 'hydrogen-link'],
  },
  'el-H': {
    id: 'el-H', title: 'Hydrogen', kind: 'Atom',
    short: 'The smallest and lightest atom.',
    what: 'Hydrogen sits on the outside of water pieces and plastic chains.',
    why: 'In ice, hydrogen helps make the links that hold the open rings together.',
    life: 'Every water drop and every plastic bag has hydrogen in it.',
    facts: [{ label: 'Symbol', value: 'H' }, { label: 'Atomic number', value: '1' }, { label: 'Mass', value: '1.008 u' }],
    related: ['hydrogen-link', 'ice'],
  },
  'el-Cl': {
    id: 'el-Cl', title: 'Chlorine', kind: 'Atom',
    short: 'The atom that turns a plastic into PVC.',
    what: 'In PVC, a chlorine atom sits on every second carbon.',
    why: 'Swapping hydrogen for chlorine changes how stiff and tough the plastic is.',
    life: 'PVC pipes and window frames get their strength from this swap.',
    facts: [{ label: 'Symbol', value: 'Cl' }, { label: 'Atomic number', value: '17' }, { label: 'Mass', value: '35.45 u' }],
    related: ['pvc', 'plastic-chain'],
  },
  'carbon-gap': {
    id: 'carbon-gap', title: 'Carbon in a gap', kind: 'Atom',
    short: 'A carbon atom tucked between iron atoms.',
    what: 'It is colored blue so it stands out. In real steel it is the same gray as other carbon.',
    why: 'Carbon in the gaps stops layers of iron from sliding. That makes steel hard.',
    life: 'Every steel knife and beam has a little carbon hiding in its gaps.',
    facts: [{ label: 'Carbon radius', value: '0.77 Å (0.077 nm)' }, { label: 'Widest gap in cold iron', value: '0.19 Å' }, { label: 'Widest gap in hot iron', value: '0.53 Å' }],
    related: ['el-C', 'iron-hot', 'iron-cold'],
  },

  // ----- structures, one for each side of each pair
  diamond: {
    id: 'diamond', title: 'Diamond', kind: 'Structure',
    short: 'Every carbon atom grips four neighbors, in all directions.',
    what: 'Diamond is a single giant network of carbon atoms. Each atom is bonded to four others.',
    why: 'No weak direction means nothing slides. That makes diamond the hardest natural material.',
    life: 'Diamond tips on drill bits and saw blades cut stone and concrete.',
    facts: [{ label: 'Touching neighbors', value: '4' }, { label: 'Density', value: gl('219', '3.52') }, { label: 'Bond length', value: '1.54 Å (0.154 nm)' }],
    more: ['Diamond is a network solid. You cannot pull out one piece without breaking strong bonds.'],
    related: ['graphite', 'network-solid', 'same-atoms'],
    source: 'Standard lattice constant of diamond. Reference data.',
  },
  graphite: {
    id: 'graphite', title: 'Graphite', kind: 'Structure',
    short: 'Carbon atoms in flat sheets that slide over each other.',
    what: 'Each carbon atom holds three neighbors inside its sheet. Only weak forces hold the sheets together.',
    why: 'The sheets slide with a light push, so graphite is soft and slippery.',
    life: 'Pencil lead is graphite. It leaves a mark because sheets rub off onto the paper.',
    facts: [{ label: 'Touching neighbors', value: '3 (inside a sheet)' }, { label: 'Density', value: gl('142', '2.27') }, { label: 'Bond length', value: '1.42 Å (0.142 nm)' }, { label: 'Distance between sheets', value: '3.35 Å (0.335 nm)' }],
    more: ['The weak forces between sheets are much weaker than the bonds inside a sheet.'],
    related: ['diamond', 'sliding-layers', 'same-atoms'],
    source: 'Standard lattice constants of graphite, AB stacking. Reference data.',
  },
  quartz: {
    id: 'quartz', title: 'Quartz', kind: 'Structure',
    short: 'A crystal of silicon and oxygen in a neat repeating pattern.',
    what: 'Each silicon atom sits in the middle of four oxygen atoms. The same block repeats again and again.',
    why: 'The neat pattern gives quartz its flat faces, and it melts at one set heat.',
    life: 'Sand is mostly tiny bits of quartz. Some watches use a quartz crystal to keep time.',
    facts: [{ label: 'Oxygen around each silicon', value: '4' }, { label: 'Density', value: gl('165', '2.65') }, { label: 'Silicon to oxygen distance', value: '1.60 Å (0.160 nm)' }, { label: 'Repeating block', value: '4.9 × 5.4 Å' }],
    related: ['glass', 'crystal-vs-glass', 'repeating-block'],
    source: 'Alpha quartz at room temperature (Levien, Prewitt and Weidner, 1980). Reference data.',
  },
  glass: {
    id: 'glass', title: 'Glass', kind: 'Structure',
    short: 'The same atoms as quartz, frozen in a jumble.',
    what: 'In glass, each silicon still has four oxygen neighbors. But no block repeats anywhere.',
    why: 'With no grains, light passes straight through. With no pattern to break, it softens slowly as it warms.',
    life: 'Windows, bottles, and phone screens are glass.',
    facts: [{ label: 'Oxygen around each silicon', value: '4' }, { label: 'Density', value: gl('141', '2.26') }, { label: 'Silicon to oxygen distance', value: '1.61 Å (0.161 nm)' }, { label: 'Repeating block', value: 'None' }],
    more: ['This picture is a drawing of a random network, made to show the idea. It is not a measured glass.'],
    related: ['quartz', 'crystal-vs-glass', 'network-solid'],
    source: 'A random network of silicon and oxygen, drawn to show the idea. Schematic.',
  },
  ice: {
    id: 'ice', title: 'Ice', kind: 'Structure',
    short: 'Water pieces held in an open cage by links.',
    what: 'Each water piece links to four neighbors. The links make open rings with six sides.',
    why: 'The open cage holds the pieces apart. That makes ice lighter than water, so it floats.',
    life: 'Ice cubes float in your drink. A lake freezes from the top.',
    facts: [{ label: 'Links per water piece', value: '4' }, { label: 'Density', value: gl('57.4', '0.92') }, { label: 'Distance between oxygen atoms', value: '2.76 Å (0.276 nm)' }, { label: 'Box volume', value: '1040 Å³ for 32 molecules' }],
    related: ['liquid', 'open-ice', 'hydrogen-link'],
    source: 'Standard lattice constants of ice Ih near 0 degrees C. Reference data.',
  },
  liquid: {
    id: 'liquid', title: 'Liquid water', kind: 'Structure',
    short: 'The same water pieces, packed closer in a jumble.',
    what: 'The pieces tumble past each other. Links keep breaking and forming.',
    why: 'Without a cage, the pieces sit closer together. Water is denser than ice.',
    life: 'The water in your glass and in every river.',
    facts: [{ label: 'Density', value: gl('62.4', '1.00') }, { label: 'Box volume', value: '957 Å³ for 32 molecules' }],
    more: ['This picture is a drawing. The molecules have the true shape but are placed at random.'],
    related: ['ice', 'open-ice', 'packing'],
    source: 'Molecules with the true shape, placed at random at the density of liquid water. Schematic.',
  },
  'iron-cold': {
    id: 'iron-cold', title: 'Cold iron', kind: 'Structure',
    short: 'Iron at room temperature. One atom sits in the middle of each block.',
    what: 'Each atom touches eight neighbors. Scientists call this body-centered cubic.',
    why: 'The gaps between atoms are tiny, so cold iron can hold very little carbon.',
    life: 'This is the iron in a steel beam at room temperature.',
    facts: [{ label: 'Touching neighbors', value: '8' }, { label: 'Density', value: gl('492', '7.87') }, { label: 'Nearest distance', value: '2.48 Å (0.248 nm)' }, { label: 'Widest gap (radius)', value: '0.19 Å' }, { label: 'Space filled by atoms', value: '68%' }],
    related: ['iron-hot', 'carbon-gap', 'packing'],
    source: 'Standard lattice constant of iron at room temperature (alpha iron). Reference data.',
  },
  'iron-hot': {
    id: 'iron-hot', title: 'Hot iron', kind: 'Structure',
    short: 'Red hot iron. An atom sits in the middle of each face.',
    what: 'Each atom touches twelve neighbors. Scientists call this face-centered cubic.',
    why: 'It has wider gaps, so it can soak up far more carbon. Cooling fast traps that carbon.',
    life: 'Makers heat steel to this form before they quench it to make it hard.',
    facts: [{ label: 'Touching neighbors', value: '12' }, { label: 'Density', value: gl('477', '7.65') }, { label: 'Nearest distance', value: '2.58 Å (0.258 nm)' }, { label: 'Widest gap (radius)', value: '0.53 Å' }, { label: 'Space filled by atoms', value: '74%' }],
    related: ['iron-cold', 'carbon-gap', 'packing'],
    source: 'Standard lattice constant of iron above about 912 degrees C (gamma iron). Reference data.',
  },
  copper: {
    id: 'copper', title: 'Copper', kind: 'Structure',
    short: 'Layers of atoms that can slide in many directions.',
    what: 'Each atom touches twelve neighbors. The closely packed layers run in four directions.',
    why: 'When you bend it, layers slide over each other. Many ways to slide means it bends without breaking.',
    life: 'Wire and pipe are drawn from copper because it bends so well.',
    facts: [{ label: 'Closest neighbors', value: '12' }, { label: 'Density', value: gl('558', '8.94') }, { label: 'Nearest distance', value: '2.56 Å (0.256 nm)' }, { label: 'Directions of sliding layers', value: '4' }],
    related: ['zinc', 'sliding-layers', 'el-Cu'],
    source: 'Standard lattice constant of copper at room temperature. Reference data.',
  },
  zinc: {
    id: 'zinc', title: 'Zinc', kind: 'Structure',
    short: 'Layers of atoms that can slide in only one direction.',
    what: 'Each atom has six close neighbors. Six more sit a little farther away.',
    why: 'With only one way for layers to slide, zinc tends to crack when bent at room temperature.',
    life: 'Zinc coats steel, such as roofing nails, to guard it from rust.',
    facts: [{ label: 'Closest neighbors', value: '6' }, { label: 'Density', value: gl('446', '7.14') }, { label: 'Nearest distance', value: '2.66 Å (0.266 nm)' }, { label: 'Directions of sliding layers', value: '1' }],
    related: ['copper', 'sliding-layers', 'el-Zn'],
    source: 'Standard lattice constants of zinc at room temperature. Reference data.',
  },
  ethylene: {
    id: 'ethylene', title: 'Ethylene', kind: 'Structure',
    short: 'A small gas piece with two carbon atoms and four hydrogen atoms.',
    what: 'Two carbon atoms share a double bond. Each holds two hydrogen atoms.',
    why: 'Many of these pieces can link up to build a plastic.',
    life: 'Ripening fruit gives off a little ethylene. Factories make it by the ton.',
    facts: [{ label: 'Atoms', value: '6' }, { label: 'Carbon to carbon bond', value: '1.34 Å (0.134 nm)' }],
    related: ['polyethylene', 'plastic-chain'],
    source: 'Ethylene bond lengths and angles from the CRC Handbook and NIST. Reference data.',
  },
  polyethylene: {
    id: 'polyethylene', title: 'Polyethylene', kind: 'Structure',
    short: 'A long chain made from many ethylene pieces.',
    what: 'Carbon atoms join in a long line, each with two hydrogen atoms.',
    why: 'Long chains tangle like cooked spaghetti. That makes the plastic tough and bendy.',
    life: 'Shopping bags, milk jugs, and pipe called PEX are polyethylene.',
    facts: [{ label: 'Carbon atoms in this chain', value: '14' }, { label: 'Carbon to carbon bond', value: '1.54 Å (0.154 nm)' }, { label: 'Length of the piece', value: '17.8 Å' }],
    more: ['Real chains have thousands of carbon atoms and coil up. This one is short and straight to show the idea.'],
    related: ['ethylene', 'plastic-chain', 'pvc'],
    source: 'An all-trans chain drawn with standard bond lengths and angles. Schematic.',
  },
  pvc: {
    id: 'pvc', title: 'PVC', kind: 'Structure',
    short: 'A plastic chain with a chlorine atom on every second carbon.',
    what: 'It is built like polyethylene, but chlorine takes the place of some hydrogen.',
    why: 'The chlorine atoms make the plastic stiffer and tougher.',
    life: 'Drain pipes and window frames are often PVC.',
    facts: [{ label: 'Carbon atoms in this chain', value: '14' }],
    related: ['polyethylene', 'el-Cl', 'plastic-chain'],
    source: 'A drawn chain with standard bond lengths and angles. Schematic.',
  },
  polystyrene: {
    id: 'polystyrene', title: 'Polystyrene', kind: 'Structure',
    short: 'A plastic chain with a ring on every second carbon.',
    what: 'It is built like polyethylene, but a ring of six carbon atoms hangs off every second carbon.',
    why: 'The rings get in each other\'s way, so the plastic is stiff and clear.',
    life: 'Foam cups, takeout boxes, and clear CD cases can be polystyrene.',
    facts: [{ label: 'Carbon atoms in the backbone', value: '14' }],
    related: ['polyethylene', 'plastic-chain'],
    source: 'A drawn chain with standard bond lengths and angles. Schematic.',
  },

  // ----- bonds and drawing marks
  'hydrogen-link': {
    id: 'hydrogen-link', title: 'Water link', kind: 'Bond',
    short: 'A dashed link between two water pieces.',
    what: 'A hydrogen atom on one water piece is pulled toward the oxygen on its neighbor. This pull is called a hydrogen bond.',
    why: 'These links hold ice in its open cage. They are much weaker than the bonds inside a water piece.',
    life: 'They are why water boils at a high heat for its size.',
    facts: [{ label: 'In ice', value: '4 links for each piece' }],
    related: ['ice', 'open-ice'],
  },
  'covalent-bond': {
    id: 'covalent-bond', title: 'Shared bond', kind: 'Bond',
    short: 'Two atoms share electrons and stay joined.',
    what: 'The stick between two atoms is a bond. The atoms share a pair of electrons.',
    why: 'These bonds are strong. Diamond, quartz, and plastic chains are all held by them.',
    life: 'Cooking breaks and makes these bonds all the time.',
    related: ['diamond', 'quartz', 'network-solid'],
  },
  'metal-bond': {
    id: 'metal-bond', title: 'Metal bond', kind: 'Bond',
    short: 'Metal atoms share a sea of electrons, so no sticks are drawn.',
    what: 'In a metal, the outer electrons roam freely between all the atoms.',
    why: 'The roaming electrons hold layers together while still letting them slide.',
    life: 'That is why metals bend, and why wire carries electric current.',
    related: ['sliding-layers', 'copper', 'iron-cold'],
  },
  'sheet-arrow': {
    id: 'sheet-arrow', title: 'Sheet arrow', kind: 'Mark',
    short: 'An arrow showing which way a graphite sheet can slide.',
    what: 'The arrows sit between the colored sheets of graphite.',
    why: 'The sheets slide along the arrows because the force between sheets is weak.',
    life: 'This slide is what puts a pencil mark on paper.',
    related: ['graphite', 'sliding-layers'],
  },
  'slip-plane': {
    id: 'slip-plane', title: 'Sliding layer', kind: 'Mark',
    short: 'A colored sheet that marks a layer of atoms that can slide.',
    what: 'Each sheet lies along a closely packed layer of metal atoms.',
    why: 'When a metal bends, layers slide along these sheets.',
    life: 'Bending a paper clip back and forth slides these layers.',
    related: ['sliding-layers', 'copper', 'zinc'],
  },
  'repeating-block': {
    id: 'repeating-block', title: 'Repeating block', kind: 'Mark',
    short: 'A thin box around the block that repeats in a crystal.',
    what: 'Copy the block, slide it over, and it fits exactly next to the first. A crystal is built from many such blocks.',
    why: 'Glass has no such block. That is the main difference between a crystal and a glass.',
    life: 'Think of the repeating pattern on wallpaper.',
    related: ['quartz', 'crystal-vs-glass'],
  },

  // ----- ideas
  'same-atoms': {
    id: 'same-atoms', title: 'Same atoms, different pattern', kind: 'Idea',
    short: 'What a material does depends on how its atoms are arranged.',
    what: 'Two materials can have the very same atoms. If the atoms sit in different patterns, the materials behave in very different ways.',
    why: 'This is why materials scientists care about patterns, not only ingredients.',
    life: 'Diamond and pencil lead are both only carbon.',
    more: ['Heating, cooling, and pressure can all move atoms into a new pattern.'],
    related: ['diamond', 'graphite', 'iron-cold', 'iron-hot'],
  },
  'sliding-layers': {
    id: 'sliding-layers', title: 'Layers that slide', kind: 'Idea',
    short: 'Many materials bend or smear because layers of atoms slide.',
    what: 'In graphite, whole sheets slide. In a metal, layers of atoms slide when you bend it.',
    why: 'The more ways layers can slide, the easier the material bends without breaking.',
    life: 'A copper wire bends. A pencil leaves a mark.',
    related: ['graphite', 'copper', 'zinc', 'slip-plane'],
  },
  'network-solid': {
    id: 'network-solid', title: 'Network solid', kind: 'Idea',
    short: 'One giant web of bonds with no loose pieces.',
    what: 'In diamond, quartz, and glass, every atom is bonded to its neighbors, and those to theirs, all the way through.',
    why: 'To break the solid, you must break many strong bonds. That is why these materials are hard and melt at high heat.',
    life: 'Sand, glass, and diamond all stay solid in a hot oven.',
    related: ['diamond', 'quartz', 'glass'],
  },
  'crystal-vs-glass': {
    id: 'crystal-vs-glass', title: 'Crystal or glass', kind: 'Idea',
    short: 'A crystal repeats a pattern. A glass is a frozen jumble.',
    what: 'When a liquid cools slowly, atoms can settle into a neat repeating pattern. Cool it fast and they freeze in place, in a jumble.',
    why: 'A jumble has no grain edges to scatter light, so glass is clear. It softens slowly instead of melting at one heat.',
    life: 'Window glass is melted sand that was cooled quickly.',
    related: ['quartz', 'glass', 'repeating-block'],
  },
  'open-ice': {
    id: 'open-ice', title: 'The open pattern of ice', kind: 'Idea',
    short: 'Ice holds water pieces apart in rings with empty space.',
    what: 'Each water piece in ice links to four neighbors in open six-sided rings.',
    why: 'The empty space makes ice take up about 9 percent more room than the same water as a liquid.',
    life: 'Pipes burst in winter because freezing water pushes outward.',
    facts: [{ label: 'Ice box', value: '1040 Å³' }, { label: 'Liquid box', value: '957 Å³' }],
    related: ['ice', 'liquid', 'hydrogen-link'],
  },
  packing: {
    id: 'packing', title: 'Packing', kind: 'Idea',
    short: 'How tightly the atoms fill the space they sit in.',
    what: 'Imagine filling a box with balls. Some patterns leave more empty space than others.',
    why: 'Tighter packing means more touching neighbors. It also changes how big the gaps are.',
    life: 'Oranges stacked in a shop are packed as tight as balls can be.',
    facts: [{ label: 'Cold iron', value: '68% filled' }, { label: 'Hot iron', value: '74% filled' }, { label: 'Copper', value: '74% filled' }, { label: 'Zinc', value: '65% filled' }],
    related: ['iron-cold', 'iron-hot', 'copper'],
  },
  'plastic-chain': {
    id: 'plastic-chain', title: 'Plastic chain', kind: 'Idea',
    short: 'A plastic is made of very long chains of linked pieces.',
    what: 'Small pieces called monomers link end to end. The result is a long chain called a polymer.',
    why: 'Chains tangle like spaghetti, which makes plastic tough. Heat lets them slide, so plastics soften.',
    life: 'Bags, bottles, pipes, and foam cups are made of chains.',
    related: ['ethylene', 'polyethylene', 'pvc', 'polystyrene'],
  },
};

export function getInfo(id) {
  return INFO[id] || null;
}
