// orbital/content-transfer.js  Words for the Travel mode (the two-push trip to a higher orbit).
// Pure data, no DOM. Runs in Node. The mode file attaches run() to each story step.
//
// Levels: 1 Start (no digits), 2 Story, 3 Explore, 4 Numbers, 5 Deep.
// Facts match orbital/bodies.js and orbital/physics.js (LEO 300 km to geostationary: 2.43 + 1.47 = 3.89 km/s, 5.3 hours).

// ---------- helpers used by the compare lines (level 4) ----------
const whole = (x) => String(Math.max(1, Math.round(x)));
// "About 3 times the speed of ...", "About half the speed of ..."
function speedLike(x, ref) {
  if (x >= 1.25) return `About ${whole(x)} times the speed of ${ref}.`;
  if (x >= 0.85) return `About the same as the speed of ${ref}.`;
  if (x >= 0.65) return `About three quarters of the speed of ${ref}.`;
  if (x >= 0.4) return `About half the speed of ${ref}.`;
  if (x >= 0.2) return `About a third of the speed of ${ref}.`;
  return `Much slower than ${ref}.`;
}
function timeLike(seconds) {
  const h = seconds / 3600;
  if (h < 1.5) return 'About as long as a movie.';
  if (h < 10) return 'About as long as a school day.';
  if (h < 72) return 'About as long as a long weekend.';
  if (h < 24 * 20) return 'About as long as a school break.';
  if (h < 24 * 120) return 'About as long as a summer.';
  return 'About as long as a school year.';
}
function fuelLike(frac) {
  const n = Math.min(9, Math.max(1, Math.round(frac * 10)));
  return `Out of every 10 parts at the start, about ${n} ${n === 1 ? 'is' : 'are'} fuel.`;
}

export const TEXT = {
  l1: {
    question: 'How does a craft climb to a higher orbit?',
    sub: 'Pick a place to go. Then watch the trip.',
    answers: {
      tv: { title: 'To the TV satellite height', text: 'The craft starts low. It will climb to where TV satellites sit.' },
      moon: { title: 'To the Moon\'s distance', text: 'The craft starts low. It will climb out to where the Moon is.' },
      mars: { title: 'To Mars', text: 'The craft starts on the path of Earth around the Sun. It will go to the path of Mars.' },
      ready: { title: 'Ready to go', text: 'Pick a place to go. The craft makes the trip with two pushes.' },
      push1: { title: 'First push', text: 'The engine fires. The craft speeds up. Its path stretches into a long oval.' },
      coast: { title: 'Coasting', text: 'The engine is off. The craft glides along half of the oval.' },
      far: { title: 'At the far end', text: 'The craft is as far as it will go. Now comes the second push.' },
      done: { title: 'It made it', text: 'The second push made the path round again. The craft stays up there.' },
      fell: { title: 'It fell back', text: 'With no second push, the craft swings back down.' },
      push1Down: { title: 'First push', text: 'The engine fires against the motion. The craft slows. Its path dips down.' },
      coastDown: { title: 'Coasting', text: 'The engine is off. The craft falls and speeds up.' },
      doneDown: { title: 'It made it', text: 'The second push slowed the craft again. It now stays in the lower orbit.' },
      fellDown: { title: 'It swung back up', text: 'With no second push, the craft swings back up.' },
    },
    choices: [
      { id: 'tv', label: 'TV satellite height' },
      { id: 'moon', label: 'The Moon' },
      { id: 'mars', label: 'Mars' },
    ],
    labels: { push1: 'First push', push2: 'Second push', notToScale: 'not to scale' },
    summary: {
      tv: 'Earth · a low orbit to TV satellite height',
      moon: 'Earth · a low orbit to the Moon\'s distance',
      mars: 'The Sun · from Earth\'s path to the path of Mars',
      other: 'A trip with two pushes',
    },
  },

  l2: {
    steps: [
      {
        title: 'Start in a low orbit',
        text: 'The craft circles Earth close to the ground. It moves very fast, but it stays low.',
        life: 'The Space Station flies in a low orbit like this one.',
      },
      {
        title: 'First push: the path stretches',
        text: 'The engine fires for a short time. The craft speeds up. Its path stretches into a long oval.',
        life: 'TV and weather satellites get this push soon after they leave the ground.',
      },
      {
        title: 'Coast with the engine off',
        text: 'Now the engine is off. The craft climbs and slows down, like a ball thrown up. It rides half of the oval.',
        life: 'A trip to Mars takes about as long as a school year. Launches wait for the right month, so Mars is there when the craft arrives.',
      },
      {
        title: 'Second push: stay in the high orbit',
        text: 'At the far end, the engine fires again. This push makes the path round, so the craft stays up high.',
        life: 'This is how a weather satellite ends up above the same spot on Earth.',
      },
      {
        title: 'Why not fly straight up?',
        text: 'A craft that only goes up falls right back down. To stay up, it needs speed sideways. The two pushes give it that speed.',
        life: 'A GPS satellite is not hanging in the sky. It is moving sideways very fast, and that keeps it up.',
      },
      {
        title: 'Most of a rocket is fuel',
        text: 'The pushes need a lot of fuel. For a trip like this, most of the craft at the start is fuel.',
        life: 'This is why rockets are so big. Most of what you see on the launch pad is fuel, and only a small part is the satellite.',
      },
    ],
    tripLine: (seconds) => `The whole trip takes ${timeLike(seconds).replace(/^About/, 'about')}`,
  },

  l3: {
    controls: {
      world: 'World',
      trip: 'Trip',
      startHeight: 'Start height',
      startDistance: 'Start distance from the Sun',
      targetHeight: 'End height',
      targetDistance: 'End distance from the Sun',
      swap: 'Swap start and end',
      push1: 'Fire the first push',
      push2: 'Fire the second push',
      again: 'Done. Start again',
      showMe: 'Show me',
      startAgain: 'Start again',
      stage: 'Flight stage',
      low: 'Low orbit',
      high: 'High orbit',
      inner: 'Inner path',
      outer: 'Outer path',
      coast: 'Coast',
      tripTime: 'Trip time',
      fuelHead: 'Fuel needed',
      fuelBarFuel: 'Fuel',
      fuelBarRest: 'Everything else',
    },
    tries: [
      { label: 'Watch the whole trip', hint: 'Two pushes and one long coast.' },
      { label: 'Skip the second push', hint: 'The craft swings out, then falls back.' },
      { label: 'Go to the Moon\'s distance', hint: 'A longer trip takes days, not hours.' },
      { label: 'Come back down', hint: 'Now both pushes slow the craft down.' },
    ],
    notes: [
      'Push once to stretch the path. Coast. Push again to make the path round.',
      'The push has to come at the far end. Try it a little early or late.',
      'A higher orbit takes a longer coast.',
    ],
    status: {
      same: 'Both orbits are the same, so no push is needed. Pick a different trip.',
      ready: 'The first push speeds the craft up.',
      readyDown: 'The first push slows the craft down.',
      near: 'Near the far end. Fire the second push now.',
      missed: 'The second push was missed. The craft will come back to the far end.',
    },
  },

  l4: {
    tiles: {
      push1: { label: 'First push', compare: (v) => speedLike(v / 0.9, 'a rifle bullet') },
      push2: { label: 'Second push', compare: (v) => speedLike(v / 0.343, 'sound') },
      total: { label: 'Total speed change', compare: (v) => speedLike(v / 7.66, 'the Space Station') },
      time: { label: 'Trip time', compare: (seconds) => timeLike(seconds) },
      fuel: { label: 'Fuel share of the rocket', compare: (frac) => fuelLike(frac) },
    },
    glosses: {
      'speed change': 'Speed change is how much faster or slower the craft gets. Engineers say delta-v.',
      push: 'A push is a short engine firing. Engineers call it a burn.',
      'transfer path': 'The transfer path is the oval that links the low orbit to the high orbit.',
      'fuel share': 'Fuel share is the part of the rocket at the start that is fuel.',
    },
    headings: {
      plan: 'The trip in numbers',
      glossLine: 'speed change (engineers say delta-v)',
    },
  },

  l5: {
    labels: {
      where: 'Where the craft is',
      plan: 'The plan',
      fuelNumbers: 'Fuel in numbers',
      display: 'Display',
      legend: 'What you see',
      engine: 'Engine type',
      showBoth: 'Show both orbits',
      showArrow: 'Show speed arrow',
      height: 'Height above the surface',
      distance: 'Distance from the Sun',
      speedNow: 'Speed now',
      coastLeft: 'Coast time left',
      burn1: 'Burn 1 speed change',
      burn2: 'Burn 2 speed change',
      total: 'Total speed change',
      coastTime: 'Coast time',
      fuel: 'Fuel share of the craft mass',
      v1: 'Speed in the start orbit',
      v2: 'Speed in the target orbit',
      formulasTitle: 'Formulas',
      sourcesTitle: 'Sources',
    },
    engines: [
      { value: '280', label: 'Solid rocket' },
      { value: '340', label: 'Kerosene' },
      { value: '450', label: 'Hydrogen' },
    ],
    formulas: [
      'Circular speed: v = sqrt(mu / r)',
      'Speed on the transfer ellipse (vis-viva): v = sqrt(mu (2 / r - 1 / a)), with a = (r1 + r2) / 2',
      'Burn 1: dv1 = |v_transfer(r1) - v_circle(r1)|.  Burn 2: dv2 = |v_circle(r2) - v_transfer(r2)|',
      'Coast time: t = pi sqrt(a^3 / mu), half of the period of the transfer ellipse',
      'Rocket equation: fuel share = 1 - exp(-dv / (Isp g0)), with g0 = 9.80665 m/s^2',
    ],
    sources: {
      fuel: 'Fuel share from the rocket equation. Higher engine efficiency needs less fuel.',
      window: 'Synodic period of Earth and Mars, about 780 days',
      bodies: 'NASA Planetary Fact Sheets',
    },
    notes: {
      up: 'Burn 1 adds speed, so the far side of the path rises to the target orbit. Burn 2 adds speed again to make the path round.',
      down: 'Burn 1 slows the craft, so the far side of the path dips down to the target orbit. Burn 2 slows the craft again to make the path round.',
      window: 'A real trip must leave when Mars will be at the meeting point. That launch window comes about every 26 months.',
      paradox: 'The craft ends up moving slower in the high orbit than in the low orbit, even though it pushed forward twice.',
    },
  },
};

// ---------- card entries ----------
const SRC = 'NASA Planetary Fact Sheets';

export const INFO = {
  // ----- the bodies -----
  earth: {
    id: 'earth', title: 'Earth', kind: 'Planet',
    short: 'Our home planet. The craft circles it.',
    what: 'Earth is the planet we live on. Its pull is what keeps the craft in orbit.',
    why: 'Most satellites circle Earth. The pull gets weaker the higher you go.',
    life: 'GPS, TV and weather satellites all circle Earth.',
    facts: [
      { label: 'Radius', value: '3,963 mi (6,378 km)' },
      { label: 'One day', value: '23.9 hours' },
    ],
    more: ['A low orbit sits just above the air. A high orbit can be many Earth widths away.'],
    related: ['lowOrbit', 'highOrbit', 'orbit'],
    source: SRC,
  },
  moon: {
    id: 'moon', title: 'Moon', kind: 'Moon',
    short: 'Earth\'s moon. A good place to aim for.',
    what: 'The Moon circles Earth about once a month. It is about thirty Earth widths away.',
    why: 'A craft that coasts out to the Moon\'s distance takes about five days.',
    life: 'Apollo crews made this kind of trip.',
    facts: [
      { label: 'Radius', value: '1,080 mi (1,737 km)' },
      { label: 'Distance from Earth', value: '238,900 mi (384,400 km)' },
    ],
    related: ['transferPath', 'coast'],
    source: SRC,
  },
  mars: {
    id: 'mars', title: 'Mars', kind: 'Planet',
    short: 'The red planet. A craft can circle it too.',
    what: 'Mars is the fourth planet from the Sun. It is about half as wide as Earth.',
    why: 'The same two-push idea works around Mars.',
    life: 'Mars rovers and orbiters use trips like this.',
    facts: [
      { label: 'Radius', value: '2,110 mi (3,396 km)' },
      { label: 'Distance from the Sun', value: '141.6 million mi (227.9 million km)' },
    ],
    related: ['launchWindow', 'transferPath'],
    source: SRC,
  },
  sun: {
    id: 'sun', title: 'Sun', kind: 'Star',
    short: 'The Sun. Planets circle it.',
    what: 'The Sun is the star at the center of our solar system. Its pull holds the planets in their paths.',
    why: 'A trip from Earth to Mars is a trip around the Sun. The craft rides an oval between the two paths.',
    life: 'Every Mars mission follows an oval around the Sun.',
    facts: [
      { label: 'Radius', value: '432,300 mi (695,700 km)' },
    ],
    related: ['transferPath', 'launchWindow'],
    source: 'NASA Sun Fact Sheet',
  },

  // ----- the craft, the paths, the markers -----
  craft: {
    id: 'craft', title: 'The craft', kind: 'Craft',
    short: 'The craft that makes the trip.',
    what: 'It could be a satellite or a ship. It only has a small engine for the two pushes.',
    why: 'The craft shows how speed and height are linked. Faster means a bigger orbit.',
    life: 'A TV satellite or a Mars rover ship moves like this.',
    related: ['push', 'coast', 'fuelShare'],
  },
  lowOrbit: {
    id: 'lowOrbit', title: 'The low orbit', kind: 'Orbit',
    short: 'The round path where the trip starts.',
    what: 'A low orbit is a round path close to the planet. The craft moves very fast here.',
    why: 'This is the easy place to reach from the ground.',
    life: 'The Space Station is in a low orbit.',
    facts: [
      { label: 'Start height here', value: '186 mi (300 km)' },
    ],
    related: ['orbit', 'push', 'highOrbit'],
  },
  highOrbit: {
    id: 'highOrbit', title: 'The high orbit', kind: 'Orbit',
    short: 'The round path where the trip ends.',
    what: 'A high orbit is a round path far from the planet. The craft moves slower here.',
    why: 'The craft needs more energy to get here, but it moves slower once it arrives.',
    life: 'TV satellites sit in a high orbit so they stay above one spot.',
    facts: [
      { label: 'TV satellite height', value: '22,236 mi (35,786 km)' },
      { label: 'GPS height', value: '12,552 mi (20,200 km)' },
    ],
    related: ['orbit', 'push', 'lowOrbit'],
    source: SRC,
  },
  transferPath: {
    id: 'transferPath', title: 'The transfer path', kind: 'Path',
    short: 'The oval that links the two orbits.',
    what: 'The transfer path is half of a long oval. It touches the low orbit at one end and the high orbit at the other.',
    why: 'It is the cheapest simple way to change orbits. Engineers call it a Hohmann transfer.',
    life: 'Many TV satellites and Mars ships ride this kind of path.',
    facts: [
      { label: 'Low orbit to TV satellite height', value: '5.3 hours' },
      { label: 'Low orbit to the Moon\'s distance', value: '5 days' },
      { label: 'Earth to Mars', value: '259 days' },
    ],
    more: ['The craft rides only half of the oval. The second push turns the far end into a round orbit.'],
    related: ['coast', 'push', 'hohmann'],
  },
  push1: {
    id: 'push1', title: 'First push', kind: 'Engine push',
    short: 'The first engine push. It stretches the path.',
    what: 'Here the engine fires along the way the craft is moving. The craft speeds up.',
    why: 'More speed makes the path swing out to a higher point on the far side.',
    life: 'A rocket does this soon after it reaches its first low orbit.',
    facts: [
      { label: 'Low orbit to TV height', value: '5,430 mph (2.43 km/s)' },
    ],
    related: ['push', 'speedChange', 'transferPath'],
  },
  push2: {
    id: 'push2', title: 'Second push', kind: 'Engine push',
    short: 'The second engine push. It makes the path round.',
    what: 'At the far end the engine fires again. The craft speeds up once more.',
    why: 'Without it, the craft would swing back down. With it, the craft stays in the high orbit.',
    life: 'A TV satellite fires its engine like this to park above one spot.',
    facts: [
      { label: 'Low orbit to TV height', value: '3,280 mph (1.47 km/s)' },
    ],
    related: ['push', 'speedChange', 'highOrbit'],
  },
  flame: {
    id: 'flame', title: 'Engine flame', kind: 'Engine push',
    short: 'The flash that shows an engine push.',
    what: 'The arrow shows where the engine fires and which way it pushes.',
    why: 'The push goes along the path of the craft. That is what changes its speed.',
    life: 'A rocket flame points one way and pushes the rocket the other way.',
    related: ['push', 'speedChange'],
  },
  speedArrow: {
    id: 'speedArrow', title: 'Speed arrow', kind: 'Arrow',
    short: 'The arrow shows how fast and which way the craft moves.',
    what: 'A longer arrow means a faster craft. It always points along the path.',
    why: 'Watch it shrink on the way up and grow on the way down.',
    life: 'It is like the needle on a car speedometer, but it also shows the direction.',
    related: ['speedChange', 'coast'],
  },

  // ----- ideas -----
  orbit: {
    id: 'orbit', title: 'Orbit', kind: 'Idea',
    short: 'An orbit is a path around a planet. The craft falls around it and never lands.',
    what: 'The craft moves sideways so fast that as it falls, the planet curves away below it.',
    why: 'Every satellite stays up this way. A higher orbit is bigger and slower.',
    life: 'The Space Station circles Earth about every hour and a half.',
    more: ['At the Space Station height the speed is about 17,200 mph (7.67 km/s). At TV satellite height it is about 6,880 mph (3.07 km/s).'],
    related: ['lowOrbit', 'highOrbit', 'push'],
  },
  push: {
    id: 'push', title: 'Push (burn)', kind: 'Idea',
    short: 'A push is a short engine firing that changes speed.',
    what: 'The engine fires for a few minutes. Engineers call this a burn.',
    why: 'Speed sets the size of the orbit. A push forward makes the orbit bigger on the far side.',
    life: 'GPS satellites need small pushes now and then to stay on course.',
    facts: [
      { label: 'Pushes in a transfer', value: '2' },
    ],
    related: ['speedChange', 'coast', 'transferPath'],
  },
  coast: {
    id: 'coast', title: 'Coast', kind: 'Idea',
    short: 'To coast is to fly with the engine off.',
    what: 'After the first push, the craft needs no more fuel. Gravity bends its path.',
    why: 'Coasting is free. It saves fuel, but it can take a long time.',
    life: 'A trip to Mars takes about as long as a school year, and almost all of it is coasting.',
    facts: [
      { label: 'Low orbit to TV height', value: '5.3 hours' },
      { label: 'Earth to Mars', value: '8.5 months (259 days)' },
    ],
    related: ['transferPath', 'push', 'launchWindow'],
  },
  speedChange: {
    id: 'speedChange', title: 'Speed change (delta-v)', kind: 'Idea',
    short: 'Speed change is how much faster or slower the craft gets.',
    what: 'Engineers say delta-v. It adds up the speed gained in every push.',
    why: 'It tells how hard a trip is. A bigger speed change needs far more fuel.',
    life: 'It is like a trip budget. Each push spends some.',
    facts: [
      { label: 'Low orbit to TV height', value: '8,710 mph (3.89 km/s)' },
      { label: 'Low orbit to the Moon\'s distance', value: '8,810 mph (3.94 km/s)' },
      { label: 'Earth to Mars', value: '12,500 mph (5.59 km/s)' },
    ],
    related: ['push', 'fuelShare', 'rocketEquation'],
  },
  fuelShare: {
    id: 'fuelShare', title: 'Fuel share', kind: 'Idea',
    short: 'Fuel share is the part of the rocket at the start that is fuel.',
    what: 'Take the whole craft at the start. Fuel share is how much of it is fuel.',
    why: 'A big speed change needs a big share. That is why rockets are so large for a small payload.',
    life: 'Most of a rocket on the launch pad is fuel, not the satellite.',
    facts: [
      { label: 'Low orbit to TV height, kerosene engine', value: 'about 69 percent' },
    ],
    related: ['rocketEquation', 'engineEfficiency', 'speedChange'],
  },
  launchWindow: {
    id: 'launchWindow', title: 'Launch window', kind: 'Idea',
    short: 'A launch window is the time when a trip can start.',
    what: 'Mars moves too. The craft must leave when Mars will be at the meeting point.',
    why: 'If it leaves at the wrong time, Mars is somewhere else when the craft arrives.',
    life: 'Mars missions leave about every two years.',
    facts: [
      { label: 'Time between windows', value: 'about 780 days' },
    ],
    related: ['coast', 'transferPath', 'mars'],
  },
  hohmann: {
    id: 'hohmann', title: 'Hohmann transfer', kind: 'Idea',
    short: 'The two-push trip between two round orbits.',
    what: 'It uses an oval that touches both orbits. It was named for Walter Hohmann, a German engineer.',
    why: 'It is the simplest way to change orbits with two pushes. It uses very little fuel.',
    life: 'Many satellites reach a high orbit this way.',
    more: ['The pushes happen at the two ends of the oval, where they work best.'],
    related: ['transferPath', 'push', 'speedChange'],
  },
  rocketEquation: {
    id: 'rocketEquation', title: 'Rocket equation', kind: 'Idea',
    short: 'The rule that links speed change to fuel.',
    what: 'Fuel share is one minus e to the power of minus delta-v over exhaust speed.',
    why: 'A little more speed change needs a lot more fuel.',
    life: 'It is why rockets use stages.',
    more: ['Exhaust speed is engine efficiency (Isp) times standard gravity, 9.80665 m/s squared.'],
    related: ['fuelShare', 'engineEfficiency', 'speedChange'],
  },
  engineEfficiency: {
    id: 'engineEfficiency', title: 'Engine efficiency (Isp)', kind: 'Idea',
    short: 'How much push an engine gets from its fuel.',
    what: 'It is measured in seconds. A higher number means less fuel is needed.',
    why: 'A better engine means a smaller fuel share for the same trip.',
    life: 'Hydrogen engines are the most efficient, but they need big, cold tanks.',
    facts: [
      { label: 'Solid rocket', value: '280 seconds' },
      { label: 'Kerosene', value: '340 seconds' },
      { label: 'Hydrogen', value: '450 seconds' },
    ],
    related: ['rocketEquation', 'fuelShare'],
  },
};

export function getInfo(id) {
  return INFO[id] || null;
}
