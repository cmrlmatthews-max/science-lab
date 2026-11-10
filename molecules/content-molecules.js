// molecules/content-molecules.js  words for the Molecules mode, written for a sixth-grade reader.
// Pure data, no DOM. Facts come from molecule-data.js and elements.js so they always match.
//   TEXT  the words for each of the five layers
//   INFO  the cards: one per element, bond type, idea, and molecule in the library
//   getInfo(id)

import { ELEMENTS } from './elements.js';
import { molarMass } from './chem.js';
import { MOLECULES, MOLECULE_ORDER, MOLECULE_GROUPS } from './molecule-data.js';

// ---------- small pure helpers (used by the mode too) ----------
const round = (n, step) => Math.round(n / step) * step;
const group3 = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** How strong the charged side is, from the dipole in debye. */
export function chargeStrength(dipole) {
  if (dipole >= 1.2) return 'strong';
  if (dipole >= 0.4) return 'medium';
  if (dipole >= 0.05) return 'weak';
  return 'none';
}

const ANGLE_WORDS = (a) => {
  if (a >= 179) return 'A perfectly straight line.';
  if (a >= 125) return 'Almost straight.';
  if (a >= 119) return 'A wide, open angle.';
  if (a >= 112) return 'A little wider than the corner of a box.';
  if (a >= 100) return 'A little wider than the corner of a box.';
  return 'Close to the corner of a box.';
};

// ---------- TEXT ----------
/** Level 1 picture buttons switch to these molecules (kept here so level 1 text has no digits). */
export const CHOICE_MOLECULE = { water: 'water', breath: 'co2', gas: 'methane', plastic: 'ethylene' };

export const TEXT = {
  l1: {
    question: 'What is everything made of?',
    sub: 'Pick a thing. Watch it turn.',
    answers: {
      water: {
        title: 'Water',
        text: 'Water is made of tiny balls called atoms. Three atoms hold hands to make one water molecule. It is bent like a boomerang.',
      },
      breath: {
        title: 'Air you breathe out',
        text: 'You breathe out a gas called carbon dioxide. Three atoms sit in a straight line. This one is not bent at all.',
      },
      gas: {
        title: 'Cooking gas',
        text: 'The gas in a stove is made of one big atom with four small ones around it. They spread out like a tiny pyramid.',
      },
      plastic: {
        title: 'Plastic bottle',
        text: 'A plastic bottle is made of very long chains. Each link in a chain is a small molecule like this one.',
      },
    },
    choices: [
      { id: 'water', label: 'Water' },
      { id: 'breath', label: 'Air you breathe out' },
      { id: 'gas', label: 'Cooking gas' },
      { id: 'plastic', label: 'Plastic bottle' },
    ],
  },

  l2: {
    // plain names for the two refrigerants, so no digit shows at levels 1 and 2
    names: { r32: 'Cooling gas', r134a: 'Car and chiller cooling gas' },
    steps: [
      {
        title: 'Atoms are tiny balls',
        text: 'Everything is made of atoms. They are far too small to see. One drop of water holds more molecules than the stars you can see at night.',
        life: 'Your phone, your shoes, and the air are all just atoms.',
      },
      {
        title: 'Atoms join by sharing',
        text: 'Atoms hold on to each other. A group of joined atoms is a molecule. Here one carbon atom holds two oxygen atoms.',
        life: 'The bubbles in a fizzy drink are this gas.',
      },
      {
        title: 'Shape matters',
        text: 'Water has two hydrogen atoms and one oxygen atom. They make a bent shape. Carbon dioxide is straight.',
        life: 'The bend lets water pull salt and sugar apart in a cooking pot.',
      },
      {
        title: 'A charged side makes water sticky',
        text: 'The oxygen side of water has a small charge. Water molecules pull on each other. That makes round drops, and it makes ice float.',
        life: 'Oil has no charged side. That is why oil and water do not mix.',
      },
      {
        title: 'Carbon makes chains',
        text: 'Carbon atoms can join in a row. Short chains are gas fuels. Chains with thousands of links are plastic.',
        life: 'A gas stove burns this fuel. A plastic pipe is made of long chains.',
      },
      {
        title: 'A few atoms, many things',
        text: 'Only a few kinds of atoms build most things. Add fluorine atoms and you get a gas that moves heat.',
        life: 'A refrigerator uses a gas like this to keep your food cold.',
      },
    ],
  },

  l3: {
    controls: {
      molecule: 'Molecule',
      showAs: 'Show as',
      labels: 'Show atom names',
      charged: 'Show the charged side',
      spin: 'Keep turning',
      tapAtom: 'Tap an atom to see what it is.',
      hoverAtom: 'Point at an atom to see what it is.',
    },
    showAs: { 'ball-stick': 'Balls and sticks', 'space-fill': 'Full size', sticks: 'Sticks' },
    tries: [
      { label: 'Look at water', hint: 'It is bent, not straight.' },
      { label: 'Now carbon dioxide', hint: 'It is a straight line.' },
      { label: 'See which side is charged', hint: 'One end pulls on other molecules.' },
      { label: 'A plastic in your walls', hint: 'Thousands of these link into a chain.' },
    ],
    notes: [
      'Tap or point at an atom to learn about it.',
      'Tap a stick to learn about the link between two atoms.',
    ],
    chargedYes: 'One side is a bit negative. It clings to other molecules.',
    chargedNo: 'Its charge is spread out evenly, so it does not stick much.',
    atomsTitle: 'Atoms',
    whereTitle: 'Where you meet it',
    molecules: {
      water: { name: 'Water', tag: 'What comes out of the tap', shape: 'bent', text: 'Water is two small hydrogen atoms stuck to one oxygen atom. It is bent like a boomerang.' },
      n2: { name: 'Nitrogen', tag: 'Most of the air we breathe', shape: 'two atoms in a line', text: 'Nitrogen is two nitrogen atoms joined by a very strong link. It makes up most of the air.' },
      o2: { name: 'Oxygen', tag: 'The part of the air we use', shape: 'two atoms in a line', text: 'Oxygen is two oxygen atoms joined side by side. We need it to breathe.' },
      co2: { name: 'Carbon dioxide', tag: 'What we breathe out', shape: 'straight line', text: 'Carbon dioxide is one carbon atom with an oxygen atom on each side. It is a straight line.' },
      methane: { name: 'Methane', tag: 'The gas in a kitchen stove', shape: 'pyramid-like', text: 'Methane is one carbon atom with four hydrogen atoms around it. They spread out like the corners of a small pyramid.' },
      propane: { name: 'Propane', tag: 'The fuel in a grill tank', shape: 'zigzag chain', text: 'Propane is a short chain of three carbon atoms with hydrogen atoms around them. The chain zigzags.' },
      formaldehyde: { name: 'Formaldehyde', tag: 'The smell of new furniture', shape: 'flat', text: 'Formaldehyde is one carbon atom with one oxygen atom and two hydrogen atoms. All four lie flat.' },
      ammonia: { name: 'Ammonia', tag: 'The sharp smell in some cleaners', shape: 'tripod', text: 'Ammonia is one nitrogen atom with three hydrogen atoms. It stands like a short tripod.' },
      co: { name: 'Carbon monoxide', tag: 'A harmful gas from poor burning', shape: 'two atoms in a line', text: 'Carbon monoxide is one carbon atom joined to one oxygen atom. It is a harmful gas with no smell.' },
      ozone: { name: 'Ozone', tag: 'A sharp-smelling kind of oxygen', shape: 'bent', text: 'Ozone is three oxygen atoms in a bent shape. It is a sharp-smelling gas that can hurt the lungs.' },
      r32: { name: 'R-32 refrigerant', tag: 'Works inside a heat pump', shape: 'pyramid-like', text: 'R-32 has one carbon atom. Two hydrogen atoms and two fluorine atoms sit around it.' },
      r134a: { name: 'R-134a refrigerant', tag: 'Cools a chiller or a car', shape: 'two linked pyramids', text: 'R-134a is two linked carbon atoms with hydrogen and fluorine atoms around them. Most of the fluorine sits on one end.' },
      ethylene: { name: 'Ethylene', tag: 'The building block of plastic sheet', shape: 'flat', text: 'Ethylene is two carbon atoms joined by a double link, with two hydrogen atoms on each. All six atoms lie flat.' },
      vinyl_chloride: { name: 'Vinyl chloride', tag: 'The building block of PVC pipe', shape: 'flat', text: 'Vinyl chloride is two carbon atoms joined by a double link. It has three hydrogen atoms and one chlorine atom. All lie flat.' },
      styrene: { name: 'Styrene', tag: 'The building block of foam insulation', shape: 'ring with a tail', text: 'Styrene is a flat ring of six carbon atoms with a short tail. The tail links to other styrene molecules.' },
      benzene: { name: 'Benzene', tag: 'A flat ring found in many plastics', shape: 'flat ring', text: 'Benzene is a flat ring of six carbon atoms. Each one holds a hydrogen atom. The same ring is part of styrene.' },
    },
  },

  l4: {
    tiles: {
      formula: { label: 'Formula', compare: 'A short way to write which atoms are in the molecule.' },
      atoms: {
        label: 'Atoms in one molecule',
        compare: (n) => (n <= 3 ? 'A very small molecule.' : n <= 6 ? 'A small molecule.' : n <= 12 ? 'A medium-sized molecule.' : 'A larger molecule.'),
      },
      mass: {
        label: 'Weight of one molecule',
        compare: (m) => `About ${Math.max(1, Math.round(m / 1.008))} times as heavy as one hydrogen atom.`,
      },
      bondLength: {
        label: 'Bond length',
        compare: (a) => `About ${group3(round(700000 / a, 10000))} bonds this long would fit across one hair.`,
      },
      bondAngle: { label: 'Bond angle', compare: ANGLE_WORDS },
      charged: {
        label: 'Charged side',
        compare: (strength) => ({
          strong: 'Strong. These molecules cling to each other, like water.',
          medium: 'Medium. These molecules cling a little.',
          weak: 'Weak. It barely clings.',
          none: 'None. The charge is spread out evenly.',
        })[strength] || '',
      },
    },
    glosses: {
      formula: 'a short way to write which atoms are in a molecule',
      'molar mass': 'the weight of a big pile of these molecules, counted in grams',
      'bond length': 'how far apart the middles of two joined atoms sit',
      'bond angle': 'the angle between two links at one atom',
      dipole: 'how strongly one side holds more charge than the other',
      debye: 'the unit chemists use to count that charge pull',
      angstrom: 'a tiny length, one ten-billionth of a meter',
    },
    yes: 'Yes',
    no: 'No',
    strength: { strong: 'strong', medium: 'medium', weak: 'weak', none: 'none' },
    tilesTitle: 'The numbers',
  },

  l5: {
    shape: 'Shape',
    dipoleTile: 'Dipole moment',
    dipoleArrow: 'Show the dipole arrow',
    measureToggle: 'Measure',
    measureTitle: 'Measure',
    measureNone: 'None',
    measureHint: 'Tap two atoms to measure a distance. Tap a third for the angle.',
    measureOne: 'Tap one more atom to measure a distance.',
    clear: 'Clear',
    keyBondsTitle: 'Key bonds and angles',
    unitNote: '1 Å = 0.1 nanometer',
    labels: 'Show element labels',
    sourceTitle: 'Source',
    trust: {
      reference: { tag: 'Reference', gloss: 'Measured values from a standard table.' },
      approximate: { tag: 'Approximate', gloss: 'Typical bond lengths with ideal angles. A good picture, not a measured one.' },
      schematic: { tag: 'Schematic', gloss: 'A drawing of the idea, not a measured structure.' },
    },
  },
};

/** Trust tag for a molecule: Reference, Approximate or Schematic. */
export function trustOf(id) {
  const m = MOLECULES[id];
  if (!m) return 'approximate';
  if (m.quality === 'reference') return 'reference';
  return /not a measured structure|drawing of the idea/i.test(m.source) ? 'schematic' : 'approximate';
}

// ---------- INFO ----------
const A = (a) => `${a} Å (${(a / 10).toFixed(a < 1 ? 4 : 3).replace(/0+$/, '').replace(/\.$/, '')} nm)`;
const COLORS = { H: 'white', C: 'dark gray', N: 'blue', O: 'red', F: 'light green', Cl: 'green' };

const ELEMENT_TEXT = {
  H: {
    short: 'The lightest atom there is.',
    what: 'Hydrogen is the smallest and lightest atom. It joins with many other atoms.',
    why: 'It is in water, in fuels, and in plastics.',
    life: 'Every drop of water has hydrogen in it. So does the gas in a stove.',
    more: ['Hydrogen has one bond to make. That is why it sits at the edge of a molecule, never in the middle.'],
  },
  C: {
    short: 'The atom that builds chains and rings.',
    what: 'Carbon can make four links at once. It joins with itself in long chains and flat rings.',
    why: 'Fuels, plastics, and living things all rest on carbon.',
    life: 'You meet carbon in cooking gas, in a plastic bottle, and in the air you breathe out.',
    more: ['Carbon can make single, double, and triple bonds. That gives it a huge range of shapes.'],
  },
  N: {
    short: 'The atom that fills most of the air.',
    what: 'Nitrogen is the main gas in air. Two nitrogen atoms hold on with a very strong link.',
    why: 'That strong link makes nitrogen calm. It does not take part in most reactions.',
    life: 'Nearly four of every five breaths you take are nitrogen.',
    more: ['Nitrogen in ammonia keeps one lone pair of electrons. That makes ammonia a pyramid with a charged side.'],
  },
  O: {
    short: 'The atom we need to breathe and to burn fuel.',
    what: 'Oxygen pulls on shared electrons harder than carbon or hydrogen does.',
    why: 'That pull gives water a charged side. Fire and rust both need oxygen too.',
    life: 'Your body uses oxygen from the air. A stove flame needs it too.',
    more: ['Oxygen holds two lone pairs when it sits in water. They push the two hydrogen atoms into a bent shape.'],
  },
  F: {
    short: 'The atom that pulls hardest on electrons.',
    what: 'Fluorine is a small atom that grips shared electrons very tightly.',
    why: 'Carbon and fluorine make strong links. They give refrigerants a charged side.',
    life: 'Fluorine is in the gas inside a refrigerator or a heat pump.',
    more: ['Fluorine is larger than hydrogen, so it stretches the angles in R-32 a little.'],
  },
  Cl: {
    short: 'A larger atom that pulls on electrons.',
    what: 'Chlorine is bigger than carbon and pulls on shared electrons.',
    why: 'One chlorine atom changes a gas into the building block of a tough plastic.',
    life: 'The plastic in a drain pipe is made with chlorine.',
    more: ['The C–Cl bond in vinyl chloride is long, about 1.73 Å.'],
  },
};

const BOND_INFO = {
  bond_single: {
    title: 'Single bond',
    kind: 'Bond',
    short: 'One pair of shared electrons holds two atoms.',
    what: 'Two atoms share one pair of electrons. It is the longest kind of link.',
    why: 'Single links can twist, so chains can bend and fold.',
    life: 'Water, methane, and propane use single links only.',
    more: ['A single bond has bond order one. A double bond is shorter and stiffer.'],
  },
  bond_double: {
    title: 'Double bond',
    kind: 'Bond',
    short: 'Two pairs of shared electrons hold two atoms.',
    what: 'Two atoms share two pairs of electrons. The link is shorter and stiffer than a single one.',
    why: 'A double link can open up so that molecules join into long chains.',
    life: 'The double link in ethylene opens up when it turns into plastic.',
    more: ['Carbon dioxide has two C=O double bonds. Ethylene has one C=C double bond.'],
  },
  bond_triple: {
    title: 'Triple bond',
    kind: 'Bond',
    short: 'Three pairs of shared electrons hold two atoms.',
    what: 'Two atoms share three pairs of electrons. It is the shortest and strongest kind of link.',
    why: 'It makes nitrogen very calm, and it makes carbon monoxide hard to break.',
    life: 'The air you breathe is mostly nitrogen with a triple link.',
    more: ['N≡N is 1.098 Å long. C≡O is 1.128 Å long.'],
  },
  bond_shared: {
    title: 'In-between bond',
    kind: 'Bond',
    short: 'The electrons are shared around more than two atoms.',
    what: 'In a ring or in ozone, the link is neither single nor double. It is in between.',
    why: 'Sharing the electrons makes the ring flat and steady.',
    life: 'The ring in styrene is the same kind of link. It is part of foam insulation.',
    more: ['Benzene has six C–C bonds of equal length, 1.397 Å. Chemists call bond order 1.5 an aromatic bond in rings.'],
  },
};

const IDEAS = {
  atom: {
    title: 'Atom',
    kind: 'Idea',
    short: 'The tiny ball that everything is made of.',
    what: 'An atom is a tiny ball. There are only a few dozen kinds that make up most of what you see.',
    why: 'Atoms are the parts. How they join is what makes one thing different from another.',
    life: 'One drop of water holds more molecules than the stars you can see at night.',
    more: ['The balls in the 3D view are scaled to the size of each atom. Colors follow a common chemistry code.'],
    related: ['molecule', 'bond'],
  },
  molecule: {
    title: 'Molecule',
    kind: 'Idea',
    short: 'A group of atoms that hold on to each other.',
    what: 'Atoms join and make a molecule. A molecule has a size, a shape, and a weight.',
    why: 'A thing acts the way its molecules act. Shape decides how they stick or slide.',
    life: 'Water, air, cooking gas, and plastic are all made of molecules.',
    related: ['atom', 'bond', 'shape'],
  },
  bond: {
    title: 'Bond',
    kind: 'Idea',
    short: 'The link that holds two atoms together.',
    what: 'Two atoms hold on by sharing electrons. That link is called a bond.',
    why: 'Bonds set how far apart atoms sit. They also set the angles in a molecule.',
    life: 'A cooking flame breaks bonds in gas and makes new ones. That frees heat.',
    related: ['bond_single', 'bond_double', 'bond_triple', 'bond_shared'],
  },
  shape: {
    title: 'Shape',
    kind: 'Idea',
    short: 'How the atoms sit in space.',
    what: 'Every molecule has a shape. It may be straight, bent, flat, or like a small pyramid.',
    why: 'Shape decides if a molecule has a charged side. That decides how it acts.',
    life: 'Water is bent, so it sticks. Carbon dioxide is straight, so it does not.',
    more: ['Pairs of electrons push each other apart. The shape is the way that push settles. Chemists call this the VSEPR idea.'],
    related: ['charged_side', 'bond'],
  },
  charged_side: {
    title: 'Charged side',
    kind: 'Idea',
    short: 'One end of the molecule holds a little more charge.',
    what: 'In some molecules, one side pulls on the shared electrons harder. That side is slightly negative.',
    why: 'A charged side makes molecules cling to each other, or pull salt apart.',
    life: 'It is why salt melts into water and why oil and water do not mix.',
    more: ['Chemists call this a dipole. They count it in a unit called the debye. Water is 1.85 D.'],
    related: ['hydrogen_bond', 'dipole_arrow', 'shape'],
  },
  dipole_arrow: {
    title: 'Charged side arrow',
    kind: 'Idea',
    short: 'The arrow points toward the slightly negative side.',
    what: 'The arrow starts in the middle of the molecule. It points to the side with extra charge.',
    why: 'It shows which way a molecule pulls on its neighbors.',
    life: 'In water, the arrow points at the oxygen atom.',
    more: ['The arrow shows direction only. The size of the dipole is on the Numbers tile.'],
    related: ['charged_side'],
  },
  hydrogen_bond: {
    title: 'Hydrogen bond',
    kind: 'Idea',
    short: 'A weak pull between a hydrogen atom and a charged side.',
    what: 'The hydrogen in one water molecule is drawn to the oxygen in the next one.',
    why: 'These weak pulls keep water liquid. They also lock ice into an open pattern, so ice floats.',
    life: 'Ice floats in your drink, and that keeps lakes from freezing solid.',
    more: ['A hydrogen bond is much weaker than the bonds inside a molecule. It still adds up over billions of molecules.'],
    related: ['charged_side', 'mol_water'],
  },
  greenhouse_gas: {
    title: 'Greenhouse gas',
    kind: 'Idea',
    short: 'A gas that holds heat near the Earth.',
    what: 'Some gases let light in but slow heat on its way out. They warm the air.',
    why: 'More of these gases means a warmer planet.',
    life: 'Cars, furnaces, and gas stoves all put carbon dioxide into the air. Leaky gas pipes let out methane.',
    more: ['Carbon dioxide, methane, ozone, and many refrigerants are greenhouse gases.'],
    related: ['mol_co2', 'mol_methane', 'refrigerant'],
  },
  refrigerant: {
    title: 'Refrigerant',
    kind: 'Idea',
    short: 'A gas that carries heat from one place to another.',
    what: 'A refrigerant soaks up heat as it turns to gas. It gives the heat back as it turns to liquid.',
    why: 'That trick moves heat out of a cold box or out of a house.',
    life: 'A refrigerator, a car air conditioner, and a heat pump all use one.',
    more: ['R-32 and R-134a are fluorine gases. Their global warming potential is a concern, so makers are phasing some of them down.'],
    related: ['mol_r32', 'mol_r134a', 'greenhouse_gas'],
  },
  polymer: {
    title: 'Polymer',
    kind: 'Idea',
    short: 'A very long chain of small molecules.',
    what: 'A polymer is made when thousands of small molecules link end to end.',
    why: 'Long chains make tough, light, bendy things.',
    life: 'Plastic bottles, PVC pipe, and foam insulation are all polymers.',
    more: ['Ethylene becomes polyethylene. Vinyl chloride becomes PVC. Styrene becomes polystyrene.'],
    related: ['mol_ethylene', 'mol_vinyl_chloride', 'mol_styrene'],
  },
  bond_length: {
    title: 'Bond length',
    kind: 'Idea',
    short: 'How far apart two joined atoms sit.',
    what: 'It is the distance between the middles of two atoms that are joined.',
    why: 'Stronger bonds are shorter. A triple link is shorter than a single one.',
    life: 'A hair is hundreds of thousands of bond lengths wide.',
    more: ['Bond lengths are given in angstroms. One angstrom is 0.1 nanometer.'],
    related: ['bond'],
  },
  bond_angle: {
    title: 'Bond angle',
    kind: 'Idea',
    short: 'The angle between two links at one atom.',
    what: 'Pick an atom with two links. The bond angle is the angle between them.',
    why: 'The angle gives the molecule its shape.',
    life: 'The bend in water is 104.5 degrees. Carbon dioxide is 180, a straight line.',
    related: ['shape', 'bond'],
  },
  molar_mass: {
    title: 'Weight of one molecule',
    kind: 'Idea',
    short: 'How heavy one molecule is, on a special scale.',
    what: 'Chemists count the weight of a huge pile of molecules in grams. The number is the molar mass.',
    why: 'It tells how heavy one kind of molecule is next to another.',
    life: 'Carbon dioxide is heavier than air, so it can pool low in a closed room.',
    related: ['molecule'],
  },
  formula: {
    title: 'Chemical formula',
    kind: 'Idea',
    short: 'A short way to write what atoms are in a molecule.',
    what: 'A formula lists each kind of atom. A small number tells how many.',
    why: 'It names a molecule in just a few letters.',
    life: 'You may know H₂O and CO₂ from school or from a fizzy drink label.',
    related: ['molecule'],
  },
  trust_levels: {
    title: 'Trust level',
    kind: 'Idea',
    short: 'How much to trust the shape you see.',
    what: 'Reference means the values come from a standard table. Approximate means the atoms use typical sizes. Schematic means it is a drawing of the idea.',
    why: 'It tells you which numbers are measured and which are a good picture.',
    life: 'Only the molecules marked Reference should be used for exact work.',
    related: ['bond_length', 'bond_angle'],
  },
  measure_tool: {
    title: 'Measuring tool',
    kind: 'Idea',
    short: 'Tap two atoms for a distance. Tap a third for an angle.',
    what: 'The tool measures from the middle of one atom to the middle of the next.',
    why: 'You can check bond lengths and angles yourself.',
    life: 'Chemists do the same kind of check with computer models.',
    related: ['bond_length', 'bond_angle'],
  },
};

// ---- one card per molecule: why it matters, where you meet it ----
const MOL_TEXT = {
  water: {
    why: 'Its bend and its charged side make water cling to itself. That is why it stays liquid and why it dissolves salt.',
    life: 'You drink it, wash with it, and meet it as steam and as ice.',
    related: ['hydrogen_bond', 'charged_side', 'el_O', 'el_H'],
  },
  n2: {
    why: 'Its strong triple link keeps it calm, so it does not harm your building or your body.',
    life: 'About four of every five breaths are nitrogen.',
    related: ['bond_triple', 'el_N'],
  },
  o2: {
    why: 'Bodies and flames both use it. Rust needs it too.',
    life: 'A stove flame goes out if the air has too little of it.',
    related: ['bond_double', 'el_O'],
  },
  co2: {
    why: 'Its level in a room tells you if the air is stale. It also holds heat in the air.',
    life: 'It makes the bubbles in a fizzy drink, and you breathe it out.',
    related: ['greenhouse_gas', 'bond_double', 'shape'],
  },
  methane: {
    why: 'It burns well and gives lots of heat. A leak lets out a strong greenhouse gas.',
    life: 'It is the gas in most home stoves and furnaces.',
    related: ['greenhouse_gas', 'shape', 'el_C', 'el_H'],
  },
  propane: {
    why: 'It is stored as a liquid in a tank, so it can heat places with no gas pipe.',
    life: 'Look for it in a grill tank or a camp stove. It is heavier than air.',
    related: ['mol_methane', 'el_C', 'bond_single'],
  },
  formaldehyde: {
    why: 'Even a little can sting the eyes and nose. Fresh air brings the level down.',
    life: 'New cabinets and pressed wood can give it off for a while.',
    related: ['charged_side', 'bond_double'],
  },
  ammonia: {
    why: 'It dissolves in water, but mixing it with bleach makes harmful gases.',
    life: 'Many glass cleaners smell of it. Large cold stores use it as a refrigerant too.',
    related: ['refrigerant', 'charged_side', 'el_N'],
  },
  co: {
    why: 'It has no color and no smell. It keeps the blood from carrying oxygen.',
    life: 'A broken furnace or a car in a closed garage can make it. Alarms detect it.',
    related: ['bond_triple', 'charged_side', 'mol_co2'],
  },
  ozone: {
    why: 'High in the sky it blocks harmful sunlight. Near the ground it hurts the lungs.',
    life: 'Some air cleaners and copy machines make a little of it.',
    related: ['bond_shared', 'shape', 'mol_o2'],
  },
  r32: {
    why: 'It moves heat well and has a lower warming effect than older gases. It can burn a little.',
    life: 'It is in many new air conditioners and heat pumps.',
    related: ['refrigerant', 'greenhouse_gas', 'el_F'],
  },
  r134a: {
    why: 'It has a strong warming effect, so makers are replacing it with other gases.',
    life: 'It cooled many refrigerators, chillers, and car air conditioners.',
    related: ['refrigerant', 'greenhouse_gas', 'el_F'],
  },
  ethylene: {
    why: 'Its double link opens up, so molecules can join into very long chains.',
    life: 'It becomes polyethylene, the plastic in bags, bottles, and PEX pipe.',
    related: ['polymer', 'bond_double', 'el_C'],
  },
  vinyl_chloride: {
    why: 'One chlorine atom turns this molecule into a tough, stable plastic.',
    life: 'It becomes PVC, used for drain pipe, siding, and window frames.',
    related: ['polymer', 'el_Cl', 'bond_double'],
  },
  styrene: {
    why: 'Its tail links into chains, and the ring makes the plastic stiff.',
    life: 'It becomes the foam used as insulation board and in packing foam.',
    related: ['polymer', 'mol_benzene', 'bond_shared'],
  },
  benzene: {
    why: 'Its flat ring is very steady. The ring is a part of many plastics.',
    life: 'It is part of styrene. Benzene itself is harmful to breathe.',
    related: ['bond_shared', 'mol_styrene', 'el_C'],
  },
};

function bondFacts(m) {
  const out = [];
  const seen = new Set();
  for (const b of m.keyBonds) {
    const k = `${b.label}|${b.length}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ label: `${b.label} bond length`, value: A(b.length) });
  }
  const seenA = new Set();
  for (const a of m.keyAngles) {
    const k = `${a.label}|${a.angle}`;
    if (seenA.has(k)) continue;
    seenA.add(k);
    out.push({ label: `${a.label} angle`, value: `${a.angle}°` });
  }
  return out;
}

function counts(m) {
  const c = new Map();
  for (const a of m.atoms) c.set(a.el, (c.get(a.el) || 0) + 1);
  return c;
}

function buildMoleculeEntry(id) {
  const m = MOLECULES[id];
  const t = TEXT.l3.molecules[id];
  const x = MOL_TEXT[id];
  const tag = TEXT.l5.trust[trustOf(id)].tag;
  const strength = chargeStrength(m.dipole);
  return {
    id: `mol_${id}`,
    title: t.name,
    kind: 'Molecule',
    short: t.tag + '.',
    what: t.text,
    why: x.why,
    life: x.life,
    facts: [
      { label: 'Formula', value: m.formulaDisplay },
      { label: 'Atoms', value: String(m.atoms.length) },
      { label: 'Weight of one molecule', value: `${molarMass(m.atoms).toFixed(2)} g/mol` },
      { label: 'Shape', value: m.shape },
      { label: 'Charged side', value: `${m.polar ? 'Yes' : 'No'} (${strength}), ${m.dipole} debye` },
      ...bondFacts(m),
      { label: 'Trust level', value: tag },
    ],
    more: m.facts.slice(),
    related: x.related,
    source: `${m.source}. Quality: ${m.quality}.`,
    group: MOLECULE_GROUPS[m.group],
  };
}

function buildElementEntry(sym) {
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
      { label: 'Single-bond radius', value: A(e.covalent) },
      { label: 'Color in the 3D view', value: COLORS[sym] || 'gray' },
    ],
    more: t.more,
    related: ['atom', 'bond'],
    source: 'IUPAC atomic weights; Cordero 2008 covalent radii.',
  };
}

export const INFO = {};
for (const sym of Object.keys(ELEMENT_TEXT)) INFO[`el_${sym}`] = buildElementEntry(sym);
for (const [id, e] of Object.entries(BOND_INFO)) INFO[id] = { id, ...e, related: e.related || ['bond'] };
for (const [id, e] of Object.entries(IDEAS)) INFO[id] = { id, ...e };
for (const id of MOLECULE_ORDER) INFO[`mol_${id}`] = buildMoleculeEntry(id);

// bond cards point back at the idea
for (const id of ['bond_single', 'bond_double', 'bond_triple', 'bond_shared']) INFO[id].related = ['bond', 'bond_length'];

export function getInfo(id) {
  return INFO[id] || null;
}

/** Card id for a bond of a given order. */
export function bondInfoId(order) {
  return order >= 3 ? 'bond_triple' : order === 2 ? 'bond_double' : order === 1.5 ? 'bond_shared' : 'bond_single';
}

/** Card id for a molecule in the library. */
export const moleculeInfoId = (id) => `mol_${id}`;
