// envelope/content-assembly.js  Words for the Assembly mode of Envelope Lab. Pure data, no DOM, runs in Node.
// Layers: l1 Start, l2 Story, l3 Explore, l4 Numbers. Level 5 is today's view and its text stays in mode-assembly.js.
// Functions in l4.tiles[*].compare take one number: R total (r), Btu/h (q), degrees F (sheathing).

const GLASS_R = 0.88; // one clear glass pane
const BTU_PER_BULB = 341.2; // one 100 watt bulb

const times = (n) => (n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10).replace(/\.0$/, ''));

export const TEXT = {
  l1: {
    question: 'What keeps a home warm and dry?',
    sub: 'This is a slice of a house wall. Pick a wall and see what happens inside it.',
    pick: 'Pick a wall',
    // The mode picks one answer from the real result of the wall that is on screen.
    answers: {
      thin: {
        title: 'Not much stops the heat',
        text: 'A thin wall has little insulation. Heat slips out in winter. The wood in the wall gets cold, so water can form there.',
      },
      thick: {
        title: 'Insulation slows the heat',
        text: 'Thick insulation keeps heat in. But it leaves the wood on the outside cold. Water can form on that cold wood.',
      },
      outside: {
        title: 'Warm and dry',
        text: 'Foam on the outside keeps the wood warm. Warm wood stays dry. The wall keeps heat in and water out.',
      },
      outsideSome: {
        title: 'Warmer, but still a bit cold',
        text: 'Foam on the outside warms the wood. It can still get cold enough for water. A thicker layer of foam would help.',
      },
      wet: {
        title: 'Water can form here',
        text: 'One part of this wall is colder than the air that touches it. Water forms on cold parts, like on a cold drink.',
      },
      dryOutside: {
        title: 'Water stays on the outside',
        text: 'Water can form only outside the rain barrier sheet. It can run down and dry there. The inside of the wall stays dry.',
      },
      dry: {
        title: 'No water forms',
        text: 'No part of this wall is cold enough. The air does not leave water inside the wall.',
      },
    },
    choices: [
      { id: 'thin', label: 'Thin wall' },
      { id: 'thick', label: 'Thick insulation' },
      { id: 'outside', label: 'Insulation outside' },
    ],
    summary: {
      wet: 'Water can form inside',
      dryOutside: 'Water stays outside',
      dry: 'Stays dry',
    },
  },

  l2: {
    steps: [
      {
        title: 'Heat moves to cold',
        text: 'Heat always moves from warm to cold. In winter, the heat in your home tries to leave through the wall. Red is warm and blue is cold.',
        life: 'A hot cup warms your hands. The heat moves from the cup into you.',
      },
      {
        title: 'Insulation slows heat down',
        text: 'Insulation is full of tiny pockets of air. Air lets heat pass very slowly. So the heat takes much longer to get out.',
        life: 'A winter coat does this job for you. So does a foam cup around hot coffee.',
      },
      {
        title: 'Studs are heat shortcuts',
        text: 'Wood and steel studs hold the wall up. They also pass heat faster than insulation does. Steel is the faster one.',
        life: 'A metal spoon in hot soup gets hot fast. A wood spoon stays cool.',
      },
      {
        title: 'Warm air carries hidden water',
        text: 'Air in a home has water in it that you cannot see. When that air meets something cold, the water shows up.',
        life: 'A cold drink sweats on a hot day. A window fogs on a cold morning.',
      },
      {
        title: 'It can happen inside a wall',
        text: 'Warm air can seep into a wall. The wood near the outside is cold. Water forms on it, and wet wood can rot.',
        life: 'A damp basement wall or a musty closet can come from this.',
      },
      {
        title: 'Keep the wall warm',
        text: 'Put foam insulation on the outside. The wood stays warm, so the water has no cold place to form.',
        life: 'Homes with foam outside can have drier walls and lower heating bills.',
      },
    ],
  },

  l3: {
    controls: {
      wall: 'Wall type',
      weather: 'Day',
      peel: 'Pull the layers apart',
      cut: 'Cut through the wall',
      show: 'What to show',
      names: 'Names',
      reset: 'Reset view',
    },
    wallNames: {
      W1: 'Wood wall',
      W2: 'Wood wall with foam outside',
      W3: 'Steel studs and brick',
      W4: 'Block wall with brick',
    },
    weatherNames: {
      bci: 'Drawing day',
      cold: 'Very cold day',
      mixed: 'Cool winter day',
      hothumid: 'Hot and damp day',
      custom: 'Your own day',
    },
    showNames: { materials: 'Layers', temp: 'Warm and cold', control: 'Jobs' },
    legend: {
      temp: 'Red is warm. Blue is cold.',
      control: [
        { key: 'water', text: 'Keeps rain out' },
        { key: 'air', text: 'Stops moving air' },
        { key: 'vapor', text: 'Slows hidden water in the air' },
        { key: 'thermal', text: 'Keeps heat in' },
      ],
    },
    tries: [
      { label: 'Pull the wall apart', hint: 'See each layer on its own.' },
      { label: 'Cut through the wall', hint: 'Look at the inside of the wall.' },
      { label: 'Put foam on the outside', hint: 'Watch the wet spot go away.' },
      { label: 'Try a very cold day', hint: 'The wood gets even colder.' },
    ],
    notes: [
      'Hover over any part of the wall to learn what it does.',
    ],
  },

  l4: {
    tiles: {
      r: {
        label: 'R-value',
        compare: (r) => `About ${times(r / GLASS_R)} times better than one pane of glass.`,
      },
      u: {
        label: 'U-factor',
        compare: 'How fast heat gets through. Lower is better.',
      },
      q: {
        label: 'Heat loss',
        compare: (q) => {
          const bulbs = q / BTU_PER_BULB;
          return bulbs < 0.5
            ? 'Less than one 100-watt light bulb.'
            : `About ${times(bulbs)} 100-watt light bulbs running all the time.`;
        },
      },
      sheathing: {
        label: 'Sheathing temperature',
        alt: 'Coldest layer face',
        compare: (f) => (f <= 32 ? 'Water freezes at 32 °F (0 °C). This is below that.' : 'Water freezes at 32 °F (0 °C). This is above that.'),
      },
      dew: {
        label: 'Dew point',
        compare: 'A surface colder than this gets wet, like a cold drink.',
      },
      cond: {
        label: 'Condensation',
        compare: {
          yes: 'Water forms inside the wall.',
          outside: 'Water forms only outside the rain barrier.',
          no: 'No part of the wall is below the dew point.',
        },
      },
    },
    glosses: {
      r: 'R-value is how well a wall slows heat. RSI is the same idea in metric units.',
      u: 'U-factor is how fast heat gets through. It is 1 divided by R.',
      sheathing: 'Sheathing is the board behind the siding.',
      dew: 'Dew point is the temperature where water starts to form on a surface.',
      cond: 'Condensation is water that forms when moist air meets a cold surface.',
      bridge: 'A thermal bridge is a heat shortcut, like a stud.',
    },
  },
};
