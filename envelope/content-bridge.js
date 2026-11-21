// envelope/content-bridge.js  Words for the Thermal Bridge mode (Envelope Lab), levels 1 to 4. Pure data, no DOM, runs in Node.
// Level 5 text stays in mode-bridge.js exactly as it was. See CONTRACT-ENVELOPE-LAYERS.md.
// Functions in l4.tiles[*].compare take one number: percent extra heat loss (loss), degrees F (cold), or R-value (r).

// Plain names for the six versions (levels 1 to 3). No digits.
export const PLAIN_NAME = {
  wood: 'Wood stud',
  steel: 'Metal stud',
  steel_ci: 'Metal stud, insulation outside',
  through: 'Floor runs through the wall',
  break: 'Floor with an insulating gap',
  continuous: 'Shelf on one long steel strip',
  standoff: 'Shelf on small spaced brackets',
};

// Plain words for the 3D labels at levels 1 and 2 (the part names, with no technical words and no digits).
export const PLAIN_LABEL = {
  'Gypsum board': 'Wallboard',
  'Gypsum sheathing': 'Sheathing board',
  'Fiberglass batt': 'Insulation between studs',
  'Mineral wool': 'Insulation',
  'Steel stud': 'Metal stud',
  'Steel stud wall with batt': 'Metal stud wall',
  'Steel shelf angle': 'Steel shelf',
  'Standoff bracket': 'Small bracket',
  'Thermal break': 'Insulating gap',
  'Brick veneer': 'Brick',
  'Air space': 'Air gap',
  'Concrete slab': 'Concrete floor',
  'Balcony slab': 'Balcony floor',
  Cladding: 'Outside covering',
};
export const PLAIN_MARKER = { inside: 'Inside, warm', outside: 'Outside, cold' };
export const PLAIN_COLD = { cold: 'Coldest spot', wet: 'Coldest spot\nWater forms here' };

/** Percent extra heat loss, in words. Used at levels 1 to 3 (no digits). */
export function lossWords(p) {
  const ratio = 1 + p / 100;
  if (p < 3) return 'about the same heat';
  if (ratio < 1.22) return 'a little more heat';
  if (ratio < 1.4) return 'about a third more heat';
  if (ratio < 1.6) return 'about half again as much heat';
  if (ratio < 1.85) return 'about two thirds more heat';
  if (ratio < 1.95) return 'nearly twice the heat';
  if (ratio < 2.1) return 'twice the heat';
  if (ratio < 2.4) return 'more than twice the heat';
  if (ratio < 2.65) return 'two and a half times the heat';
  if (ratio < 3.3) return 'three times the heat';
  return 'many times the heat';
}

function compareLoss(p) {
  const ratio = 1 + p / 100;
  if (p < 3) return 'Almost no extra heat escapes.';
  if (ratio < 1.22) return 'A little extra heat escapes, like a small draft.';
  if (ratio < 1.4) return 'About a third more heat escapes than through a clear wall.';
  if (ratio < 1.6) return 'About half again as much heat escapes as through a clear wall.';
  if (ratio < 1.85) return 'About two thirds more heat escapes than through a clear wall.';
  if (ratio < 2.1) return 'About twice the heat escapes as through a clear wall.';
  if (ratio < 2.4) return 'More than twice the heat escapes as through a clear wall.';
  if (ratio < 2.65) return 'Two and a half times the heat escapes as through a clear wall.';
  return 'Three times the heat escapes as through a clear wall, like an open window.';
}

function compareCold(t, dew = 41.1) {
  if (t <= dew) return 'Below the dew point, so water forms. Like a cold drink on a hot day.';
  if (t >= 64) return 'Close to room temperature. The wall feels fine and stays dry.';
  if (t >= 55) return 'Cool to the touch, like a basement wall. Still above the dew point.';
  return 'Cold to the touch, like a window in winter. Above the dew point, but close.';
}

function compareR(r) {
  if (r < 3) return 'About like a window. Not much help.';
  if (r < 8) return 'Better than a window, but a weak wall.';
  if (r < 14) return 'Like an older wall with some insulation.';
  if (r < 22) return 'Like a new wall that meets many building codes.';
  return 'Like a very well insulated wall.';
}

export const TEXT = {
  l1: {
    question: 'Where does heat sneak out of a building?',
    sub: 'Pick a part of the wall. Watch the arrows. Heat takes the easy way out.',
    pick: 'Pick one',
    answers: {
      stud: {
        title: 'Metal studs let heat slip past',
        text: 'A metal stud carries heat out of the wall. The insulation next to it cannot stop that. Wrap the stud and much less heat escapes.',
      },
      slab: {
        title: 'A balcony floor is a heat highway',
        text: 'The concrete floor reaches from the warm room to the cold outside. Heat runs along it. An insulating gap in the floor slows the heat a lot.',
      },
      shelf: {
        title: 'A steel shelf lets heat reach the brick',
        text: 'A steel shelf holds up the brick. Heat runs through the steel and across the insulation. Small spaced brackets leave room for insulation.',
      },
    },
    choices: [
      { id: 'stud', label: 'Wall stud' },
      { id: 'slab', label: 'Balcony floor' },
      { id: 'shelf', label: 'Brick shelf' },
    ],
    coldNote: 'The coldest spot inside is next to the shortcut.',
  },

  l2: {
    steps: [
      {
        title: 'A metal spoon in hot soup',
        text: 'Leave a metal spoon in hot soup. Soon the handle is hot. Metal passes heat along fast.',
        life: 'A wooden spoon stays cool because wood passes heat slowly.',
      },
      {
        title: 'A stud does the same',
        text: 'A metal stud in a wall works like the spoon. Heat from the room runs along it and out to the cold air.',
        life: 'On a winter day, the wall next to a stud can feel cooler than the rest.',
      },
      {
        title: 'A balcony floor does it too',
        text: 'A concrete balcony floor reaches from inside to outside. Concrete passes heat much better than insulation does.',
        life: 'The room beside a balcony can feel cold and cost more to heat.',
      },
      {
        title: 'The coldest spot can get wet',
        text: 'Inside, the wall is coldest next to the shortcut. Water can form there, like on a cold drink. Wet spots can grow mold.',
        life: 'You may have seen dark mold in the corner of a cold outside wall.',
      },
      {
        title: 'The fix: wrap it or break it',
        text: 'Wrap the shortcut in insulation, or cut it with a layer that stops heat. Then heat has no easy path.',
        life: 'Good window frames use the same idea. A plastic strip inside the metal stops heat.',
      },
    ],
  },

  l3: {
    controls: {
      detail: 'Part of the wall',
      fix: 'Compare with',
      view: 'Show',
      arrows: 'Heat arrows',
      labels: 'Names',
    },
    plainIntro: 'A heat shortcut is a path where heat slips around the insulation.',
    parts: {
      stud: { title: 'A metal stud in the wall', desc: 'Heat runs through the metal, around the insulation.' },
      slab: { title: 'A concrete balcony floor', desc: 'Concrete carries heat straight out to the cold.' },
      shelf: { title: 'A steel shelf for the brick', desc: 'Steel carries heat across the insulation to the brick.' },
    },
    pairs: {
      ci: 'Insulation wrapped outside the studs',
      wood: 'A wood stud instead of metal',
    },
    views: { both: 'Both', problem: 'Problem', better: 'Better' },
    result: {
      problemHead: 'The problem',
      betterHead: 'The better way',
      flat: 'There is no temperature difference, so no heat flows.',
      flatHint: 'Make the outside colder or warmer than the inside.',
      wet: 'Water forms on the coldest spot inside.',
      dry: 'The coldest spot inside stays dry.',
    },
    fixes: {
      ci: 'wrapping the studs in insulation',
      wood: 'using a wood stud',
      break: 'putting an insulating gap in the floor',
      standoff: 'using small spaced brackets',
    },
    subjects: {
      steel: 'A metal stud',
      through: 'A balcony floor that runs through the wall',
      continuous: 'A long steel shelf',
    },
    todo: {
      stud: 'Wrap the studs in insulation on the outside. A wood stud also helps.',
      slab: 'Put an insulating gap in the floor, or keep the floor inside the insulation.',
      shelf: 'Hold the shelf off the wall on small brackets. Then insulation fits behind it.',
    },
    tries: [
      { label: 'Find the heat shortcut', hint: 'Pick Wall stud. Look at where the arrows bunch up along the metal.' },
      { label: 'Wrap it or swap it', hint: 'With Wall stud, switch between wrapping and a wood stud. Watch the arrows spread out.' },
      { label: 'Look at one at a time', hint: 'Choose Problem, then Better. Which one has fewer arrows leaving?' },
      { label: 'Hide the names', hint: 'Turn the names off to see the heat colors. Red is warm. Blue is cold.' },
    ],
    notes: [
      'Red means warm. Blue means cold. The arrows show where heat flows.',
      'Tap or hover a part to learn what it does.',
    ],
  },

  l4: {
    tiles: {
      lossP: { label: 'Extra heat loss, problem', compare: compareLoss },
      lossB: { label: 'Extra heat loss, better', compare: compareLoss },
      coldP: { label: 'Coldest inside surface, problem', compare: compareCold },
      coldB: { label: 'Coldest inside surface, better', compare: compareCold },
      rP: { label: 'Effective R-value, problem', compare: compareR },
      rB: { label: 'Effective R-value, better', compare: compareR },
    },
    glosses: {
      'thermal bridge': 'A heat shortcut. A part that passes heat around the insulation.',
      'effective R-value': 'The R-value of the whole wall with the shortcut counted. Higher is better.',
      RSI: 'The metric R-value. It is the R-value times 0.1761.',
      'dew point': 'The surface temperature below which water forms from room air.',
      condensation: 'Water forming on a cold surface.',
      'thermal break': 'A layer that stops heat, placed in the shortcut.',
      'continuous insulation': 'An unbroken layer of insulation outside the framing.',
    },
    glossTitle: 'Words to know',
    note: 'Extra heat loss is compared with the same wall that has no shortcut.',
  },
};
