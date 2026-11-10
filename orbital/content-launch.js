// orbital/content-launch.js  Words for Launch mode, in five layers. Pure data, no DOM, runs in Node.
//
// TEXT.l1 .. l3 are written at a sixth-grade reading level (tests/text-launch.test.mjs checks it).
// TEXT.l1 has no digits at all. TEXT.l4 and TEXT.l5 may use technical words and numbers.
// INFO holds the cards for everything the user can hover or tap in the 3D view and for each idea named in the panels.
// Facts in INFO are built from bodies.js and physics.js, so they always match the data.

import { BODIES } from './bodies.js';
import { circularSpeed, escapeSpeed, period } from './physics.js';

// ---------- small local formatting helpers (US unit first, then metric) ----------
const sig3 = (n) => {
  if (!Number.isFinite(n) || n === 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(Math.abs(n))) - 2);
  return Math.round(n / p) * p;
};
const commas = (n) => Math.round(n).toLocaleString('en-US');
const KM_PER_MI = 1.609344;
const MPH_PER_KMPS = 3600 / KM_PER_MI;
const miText = (km) => `${commas(sig3(km / KM_PER_MI))} mi`;
const kmTxt = (km) => `${commas(km)} km`;
const lenText = (km) => `${miText(km)} (${kmTxt(km)})`;
const speedText = (v, d = 2) => `${commas(sig3(v * MPH_PER_KMPS))} mph (${v.toFixed(d)} km/s)`;
const minText = (s) => `${(s / 60).toFixed(1)} min`;

// ---------- the layers ----------
export const TEXT = {
  l1: {
    question: 'How fast must you go to stay in orbit?',
    sub: 'Throw something sideways. If it is fast enough, it keeps missing the ground.',
    answers: {
      drop: { title: 'It falls straight down', text: 'With no push sideways, gravity pulls it to the ground.' },
      slow: { title: 'Too slow. It falls back', text: 'Gravity pulls it down before it can get around the planet.' },
      up: { title: 'It goes up and comes back', text: 'Aimed up like this, it climbs, slows down, and then falls back.' },
      skim: { title: 'It skims the air and comes down', text: 'It brushes the thin air at the edge of space. The air slows it, so it sinks.' },
      orbit: { title: 'Just right. It stays in orbit', text: 'It falls all the time, but the ground curves away. So it keeps missing.' },
      oval: { title: 'It stays in orbit on an oval path', text: 'It swings far out, then falls back in. It does this again and again.' },
      escape: { title: 'Too fast. It leaves', text: 'Gravity cannot pull it back. It flies away into space.' },
    },
    choices: [
      { id: 'slow', label: 'Too slow' },
      { id: 'orbit', label: 'Just right' },
      { id: 'escape', label: 'Too fast' },
    ],
    // short words for the phone summary line and the label on the 3D view (no digits)
    summary: {
      drop: 'falls straight down', slow: 'too slow, falls back', up: 'goes up and comes back',
      skim: 'skims the air', orbit: 'stays in orbit', oval: 'stays in orbit', escape: 'too fast, leaves',
    },
    live: {
      start: 'At launch', falling: 'Falling', landed: 'It landed', orbiting: 'Going around', flying: 'Flying', gone: 'It left',
    },
    notToScale: 'not to scale',
    again: 'It starts again in a moment.',
  },

  l2: {
    steps: [
      {
        title: 'Let it go',
        text: 'Hold a ball and let go. Gravity pulls it straight down.',
        life: 'A phone slips out of your hand. It falls the same way.',
      },
      {
        title: 'Throw it sideways',
        text: 'Now throw the ball sideways. It still falls, but it lands farther away.',
        life: 'Even a bullet fired level still drops to the ground.',
      },
      {
        title: 'Throw it faster',
        text: 'Throw it much harder. The planet is round, so the ground curves away as the ball falls. It flies a long way.',
        life: 'Rockets go much faster than a bullet to climb above the air.',
      },
      {
        title: 'Fast enough to keep missing',
        text: 'At one special speed, the ground curves away as fast as the ball falls. It never lands. That is an orbit. It is about eight times faster than a rifle bullet. It takes about an hour and a half to go around the world.',
        life: 'The Space Station crew floats because they are always falling around Earth.',
      },
      {
        title: 'A little faster',
        text: 'Go a little faster, and the path stretches into an oval. The craft swings far out, then falls back in.',
        life: 'GPS, weather pictures, and satellite internet all come from craft in orbit.',
      },
      {
        title: 'Too fast: it leaves',
        text: 'Go much faster still, and gravity cannot pull it back. It flies away for good.',
        life: 'Space probes that visit other planets must be this fast to leave Earth.',
      },
    ],
  },

  l3: {
    controls: {
      speed: 'Speed',
      height: 'Start height',
      angle: 'Aim',
      world: 'World',
    },
    speedWords: {
      none: 'no speed, just let go',
      slow: 'slower than orbit speed',
      orbit: 'as fast as an orbit needs',
      fast: 'faster than orbit speed',
      escape: 'fast enough to leave',
    },
    angleWords: {
      down: 'Aimed at the ground',
      level: 'Level with the ground',
      up: 'Up at an angle',
      straight: 'Straight up',
    },
    angleHint: 'Level means sideways. Straight up means it climbs first.',
    heightHint: 'A higher start means a longer fall to the ground.',
    gauge: {
      title: 'Speed gauge',
      you: 'Your speed',
      orbit: 'Orbit speed',
      escape: 'Escape speed',
      slowZone: 'Too slow',
      orbitZone: 'Orbit',
      escapeZone: 'Leaves',
    },
    tries: [
      { label: 'Drop it', hint: 'No speed at all.' },
      { label: 'Throw it sideways, slowly', hint: 'It falls back to the ground.' },
      { label: 'Throw it at orbit speed', hint: 'Just right.' },
      { label: 'Throw it very fast', hint: 'A little over escape speed.' },
    ],
    notes: [
      'Drag the 3D view to look around. Pinch or scroll to zoom.',
      'The blue arrow shows which way it moves right now.',
    ],
    answerMore: 'Try the speed slider to find the speed that keeps it going around.',
  },

  l4: {
    tiles: {
      speed: {
        label: 'Your speed',
        compare: (kmps) => (kmps < 0.01 ? 'Not moving sideways at all.'
          : kmps < 0.9 ? 'Slower than a rifle bullet.'
            : `About ${Math.round(kmps / 0.9)} times faster than a rifle bullet.`),
      },
      height: {
        label: 'Start height',
        compare: (km) => (km < 20 ? 'About as high as a jet airliner flies.'
          : km < 150 ? 'Where the air gets very thin.'
            : km < 1000 ? 'The Space Station flies about 250 miles up.'
              : km < 30000 ? 'Higher than most satellites that take pictures.'
                : 'As high as satellites that hover over one spot.'),
      },
      orbit: {
        label: 'Orbit speed needed',
        compare: (kmps) => `A jet airliner is about ${Math.max(2, Math.round(kmps / 0.25))} times slower.`,
      },
      escape: {
        label: 'Escape speed',
        compare: () => 'Always about 1.4 times the orbit speed at the same height.',
      },
      period: {
        label: 'Time for one trip around',
        compare: (s) => (s < 86400 ? `That is about ${Math.max(1, Math.round(86400 / s))} trips around in one day.` : 'More than a day for each trip.'),
      },
      landing: {
        label: 'Time until it lands',
        compare: (s) => (s < 120 ? 'About as long as brushing your teeth.'
          : s < 1200 ? 'About as long as a short bus ride.' : 'About as long as a TV show.'),
      },
      far: {
        label: 'Speed far away',
        compare: (kmps) => (kmps < 0.9 ? 'Slower than a rifle bullet, but it never stops.'
          : `Still about ${Math.round(kmps / 0.9)} times faster than a rifle bullet.`),
      },
    },
    glosses: {
      'orbit speed': 'the speed that keeps a craft falling around the planet',
      'escape speed': 'the speed that lets a craft leave and never come back',
      'free fall': 'falling with nothing holding you up',
      period: 'how long one full trip around takes',
      ellipse: 'a stretched circle, like an oval',
    },
    glossTitle: 'Words to know',
  },

  l5: {
    sections: { numbers: 'Numbers', why: 'Why', right: 'Right now', quick: 'Quick settings', formulas: 'Formulas', bodies: 'Other worlds' },
    world: 'World',
    height: 'Start height above the surface',
    angle: 'Launch angle',
    angleHint: '0 degrees is level with the ground. 90 degrees is straight up.',
    quick: { drop: 'Drop', circular: 'Circular speed', escape: 'Escape speed' },
    live: { altitude: 'Altitude', speed: 'Speed', time: 'Time' },
    formulas: [
      { id: 'vc', name: 'Circular speed', formula: 'v = √(μ / r)', gloss: 'Gravity pull equals the sideways speed squared over the distance.' },
      { id: 've', name: 'Escape speed', formula: 'v = √(2μ / r)', gloss: 'It is √2, about 1.41, times the circular speed at the same distance.' },
      { id: 'T', name: 'Time for one trip', formula: 'T = 2π √(a³ / μ)', gloss: 'a is the average of the lowest and highest distances from the center.' },
      { id: 'vv', name: 'Speed anywhere on the path', formula: 'v = √(μ (2 / r − 1 / a))', gloss: 'The vis-viva equation.' },
    ],
    bodiesTitle: 'Speeds at the surface of each world',
    bodiesCols: ['World', 'μ (km³/s²)', 'Radius', 'Circular speed', 'Escape speed'],
    source: 'NASA Planetary Fact Sheets',
    legend: { path: 'Predicted path', craft: 'Craft', start: 'Launch point' },
    toggles: { path: 'Show the full path', arrow: 'Show speed arrow' },
    autoSpeed: 'Auto speed',
  },
};

// ---------- cards ----------
function bodyFacts(b) {
  const g = (b.mu / (b.radius * b.radius)) * 1000;
  const facts = [
    { label: 'Radius', value: lenText(b.radius) },
    { label: 'Gravity at the surface', value: `${g.toFixed(2)} m/s²` },
    { label: 'Circular speed at the surface', value: speedText(circularSpeed(b.mu, b.radius)) },
    { label: 'Escape speed at the surface', value: speedText(escapeSpeed(b.mu, b.radius)) },
    { label: 'One turn', value: b.rotationHours >= 48 ? `${(b.rotationHours / 24).toFixed(1)} days` : `${b.rotationHours.toFixed(1)} hours` },
  ];
  if (b.atmosphere) facts.push({ label: 'Air slows a craft below', value: lenText(b.atmosphere) });
  return facts;
}

const ISS_R = BODIES.earth.radius + 400;
const ISS_V = circularSpeed(BODIES.earth.mu, ISS_R);
const ISS_T = period(BODIES.earth.mu, ISS_R);
const ISS_VE = escapeSpeed(BODIES.earth.mu, ISS_R);

export const INFO = {
  // ----- bodies -----
  earth: {
    id: 'earth', title: 'Earth', kind: 'Planet',
    short: 'The planet we live on. You launch from high above it.',
    what: 'Earth is a big ball of rock and water. Its gravity pulls everything toward its middle.',
    why: 'Its size and weight set how fast a craft must go to stay in orbit.',
    life: 'The Space Station, GPS, and weather satellites all go around Earth.',
    facts: bodyFacts(BODIES.earth),
    more: ['Earth turns once about every day. A launch toward the east gets a small free boost from that turn.'],
    related: ['gravity', 'orbit', 'escape_speed', 'air_drag'],
    source: BODIES.earth.source,
  },
  moon: {
    id: 'moon', title: 'Moon', kind: 'Moon',
    short: 'Earth has one moon. It is small, so its gravity is weak.',
    what: 'The Moon is a ball of rock with no air. Its pull is about one sixth of Earth’s pull.',
    why: 'Weak gravity means a much lower speed keeps a craft in orbit.',
    life: 'Moon missions use a lower speed to land and to leave.',
    facts: bodyFacts(BODIES.moon),
    more: ['With no air, a craft can fly very low over the Moon without slowing down.'],
    related: ['gravity', 'orbit', 'escape_speed'],
    source: BODIES.moon.source,
  },
  mars: {
    id: 'mars', title: 'Mars', kind: 'Planet',
    short: 'A cold, red, rocky planet with thin air.',
    what: 'Mars is smaller than Earth, so its gravity is weaker. Its air is very thin.',
    why: 'A craft needs less speed to orbit Mars than to orbit Earth.',
    life: 'Robot rovers and orbiters study Mars from orbit and from the ground.',
    facts: bodyFacts(BODIES.mars),
    more: ['Mars has two tiny moons that orbit it, Phobos and Deimos.'],
    related: ['gravity', 'orbit', 'escape_speed', 'air_drag'],
    source: BODIES.mars.source,
  },
  sun: {
    id: 'sun', title: 'Sun', kind: 'Star',
    short: 'The star at the center of our solar system.',
    what: 'The Sun is a huge ball of hot gas. Its gravity holds all the planets in orbit.',
    why: 'Its pull is so strong that orbit speeds are very high, even from far away.',
    life: 'Earth goes around the Sun once a year, in the same way a craft goes around Earth.',
    facts: bodyFacts(BODIES.sun),
    more: ['Starting heights here are measured from the Sun’s surface and are very large.'],
    related: ['gravity', 'orbit', 'escape_speed'],
    source: BODIES.sun.source,
  },

  // ----- things in the 3D view -----
  craft: {
    id: 'craft', title: 'The craft', kind: 'Craft',
    short: 'A small craft that you launch. It has no engine after the start.',
    what: 'After launch, only gravity pulls on the craft. It coasts.',
    why: 'Because nothing pushes it, the path depends only on the start speed, the aim, and the height.',
    life: 'The Space Station works the same way. It coasts around Earth and falls all the time.',
    facts: [
      { label: 'Station height', value: lenText(400) },
      { label: 'Station speed', value: speedText(ISS_V) },
      { label: 'Station time around', value: minText(ISS_T) },
    ],
    more: ['The craft is drawn larger than real life so that you can see it.'],
    related: ['free_fall', 'orbit', 'path'],
    source: 'Two-body model (point craft, no air)',
  },
  path: {
    id: 'path', title: 'The path', kind: 'Path',
    short: 'The line the craft will follow, from start to finish.',
    what: 'It is drawn before the craft moves. It shows where gravity will take the craft.',
    why: 'A closed loop means orbit. A line that hits the ground means a fall. An open line means escape.',
    life: 'Space teams draw paths like this before every launch.',
    facts: [
      { label: 'Round path', value: 'Circle' },
      { label: 'Stretched path', value: 'Ellipse' },
      { label: 'Escape path', value: 'Open curve' },
    ],
    more: ['An orbit is an ellipse. A circle is an ellipse that is not stretched at all.'],
    related: ['orbit', 'oval', 'escape_speed'],
    source: 'Two-body model',
  },
  start: {
    id: 'start', title: 'Start point', kind: 'Marker',
    short: 'Where the craft begins its trip.',
    what: 'The craft starts here, at the height you chose.',
    why: 'A higher start gives a longer fall and a slower orbit.',
    life: 'Rockets climb above the air first, and then they turn sideways.',
    related: ['speed_vs_height', 'launch_arrow'],
  },
  impact: {
    id: 'impact', title: 'Impact point', kind: 'Marker',
    short: 'Where the craft hits the ground.',
    what: 'The path dips below the surface here, so the craft lands.',
    why: 'This shows the speed was too low to keep missing the ground.',
    life: 'A thrown ball lands in the same way, only much closer.',
    related: ['gravity', 'orbit_speed'],
  },
  low: {
    id: 'low', title: 'Lowest point', kind: 'Marker',
    short: 'The place on the path closest to the surface.',
    what: 'The craft is closest to the planet here.',
    why: 'The craft moves fastest at its lowest point, because gravity has pulled it the longest.',
    life: 'A swing moves fastest at the bottom of its arc, too.',
    related: ['oval', 'high'],
  },
  high: {
    id: 'high', title: 'Highest point', kind: 'Marker',
    short: 'The place on the path farthest from the surface.',
    what: 'The craft is farthest from the planet here.',
    why: 'The craft moves slowest at its highest point.',
    life: 'A ball thrown up slows down to a stop at the top.',
    related: ['oval', 'low'],
  },
  launch_arrow: {
    id: 'launch_arrow', title: 'Launch arrow', kind: 'Arrow',
    short: 'It shows which way the craft is aimed at the start.',
    what: 'The arrow points the way the craft is thrown.',
    why: 'Aim sideways to go around. Aim up and part of the speed goes into climbing.',
    life: 'A pitcher aims a ball in the same way.',
    related: ['launch_angle', 'speed_arrow'],
  },
  speed_arrow: {
    id: 'speed_arrow', title: 'Speed arrow', kind: 'Arrow',
    short: 'It shows which way the craft moves right now.',
    what: 'The arrow points along the path, the way the craft is moving.',
    why: 'It turns as gravity bends the path.',
    life: 'A car’s direction changes the same way when it goes around a curve.',
    related: ['free_fall', 'launch_arrow'],
  },

  // ----- ideas -----
  orbit: {
    id: 'orbit', title: 'Orbit', kind: 'Idea',
    short: 'Falling around a planet, and always missing it.',
    what: 'A craft in orbit moves sideways so fast that the ground curves away as it falls.',
    why: 'This is how satellites stay up with no engine running.',
    life: 'The Space Station goes around Earth about sixteen times every day.',
    facts: [
      { label: 'Station height', value: lenText(400) },
      { label: 'Station speed', value: speedText(ISS_V) },
      { label: 'Time for one trip', value: minText(ISS_T) },
    ],
    more: ['Isaac Newton pictured a cannon on a tall mountain. Fire it faster and the ball lands farther away. Fire it fast enough and it never lands.'],
    related: ['free_fall', 'orbit_speed', 'gravity', 'curved_ground'],
    source: 'Newton’s cannonball idea',
  },
  gravity: {
    id: 'gravity', title: 'Gravity', kind: 'Idea',
    short: 'The pull between everything that has weight.',
    what: 'Big things like planets pull other things toward them.',
    why: 'Gravity bends the path of the craft. It is the reason for every orbit.',
    life: 'Gravity keeps your feet on the floor and the Moon near Earth.',
    facts: [
      { label: 'Earth surface', value: `${((BODIES.earth.mu / BODIES.earth.radius ** 2) * 1000).toFixed(2)} m/s²` },
      { label: 'Moon surface', value: `${((BODIES.moon.mu / BODIES.moon.radius ** 2) * 1000).toFixed(2)} m/s²` },
      { label: 'Mars surface', value: `${((BODIES.mars.mu / BODIES.mars.radius ** 2) * 1000).toFixed(2)} m/s²` },
    ],
    more: ['Gravity gets weaker with distance. Twice as far means one fourth of the pull.'],
    related: ['free_fall', 'orbit'],
    source: 'NASA Planetary Fact Sheets',
  },
  free_fall: {
    id: 'free_fall', title: 'Free fall', kind: 'Idea',
    short: 'Falling with nothing to hold you up.',
    what: 'In free fall, the only pull on you is gravity. You and your surroundings fall together.',
    why: 'This is why a crew in orbit floats. Gravity is still there, but everything falls at the same rate.',
    life: 'You feel it for a moment at the top of a roller coaster hill.',
    more: ['At the height of the Space Station, gravity is still about nine tenths as strong as on the ground.'],
    related: ['orbit', 'gravity'],
  },
  orbit_speed: {
    id: 'orbit_speed', title: 'Orbit speed', kind: 'Idea',
    short: 'The speed that keeps a craft falling around the planet.',
    what: 'At this speed, the ground curves away as fast as the craft falls.',
    why: 'Slower, and the craft lands. Faster, and the path stretches out.',
    life: 'Low satellites circle Earth about eight times faster than a rifle bullet flies.',
    facts: [
      { label: 'At 400 km (249 mi) above Earth', value: speedText(ISS_V) },
      { label: 'Formula', value: 'v = √(μ / r)' },
    ],
    more: ['The speed gets lower as the height goes up. A high orbit is slower, and it takes longer to go around.'],
    related: ['orbit', 'escape_speed', 'speed_vs_height'],
  },
  escape_speed: {
    id: 'escape_speed', title: 'Escape speed', kind: 'Idea',
    short: 'The speed that lets a craft leave and never come back.',
    what: 'Above this speed, gravity slows the craft down but never stops it.',
    why: 'It is always about forty percent more than the orbit speed at the same height.',
    life: 'Probes that go to other planets must reach this speed.',
    facts: [
      { label: 'At 400 km (249 mi) above Earth', value: speedText(ISS_VE) },
      { label: 'Formula', value: 'v = √(2μ / r)' },
    ],
    more: ['Escape speed does not depend on the weight of the craft. A feather and a truck need the same speed.'],
    related: ['orbit_speed', 'gravity'],
  },
  speed_vs_height: {
    id: 'speed_vs_height', title: 'Speed and height', kind: 'Idea',
    short: 'A higher orbit is slower, and it takes longer to go around.',
    what: 'Far from the planet, gravity is weaker, so a lower speed is enough to stay in orbit.',
    why: 'To go higher, a craft first speeds up, and then it slows down at the top.',
    life: 'GPS satellites are much higher than the Station. They take about twelve hours to go around.',
    facts: [
      { label: 'Station, 400 km (249 mi)', value: `${speedText(ISS_V)}, ${minText(ISS_T)}` },
      {
        label: 'GPS, 20,200 km (12,600 mi)',
        value: `${speedText(circularSpeed(BODIES.earth.mu, BODIES.earth.radius + 20200))}, ${((period(BODIES.earth.mu, BODIES.earth.radius + 20200)) / 3600).toFixed(1)} h`,
      },
    ],
    related: ['orbit_speed', 'orbit'],
  },
  oval: {
    id: 'oval', title: 'Oval orbit', kind: 'Idea',
    short: 'A stretched loop. The craft is fast when low and slow when high.',
    what: 'If the speed is a bit more than orbit speed, the path stretches into an oval.',
    why: 'The start point is the lowest point of the oval. The craft swings far out and comes back.',
    life: 'Some satellites use ovals to stay over far northern lands for hours.',
    more: ['Its shape is called an ellipse. The more stretched it is, the more oval it looks.'],
    related: ['orbit', 'low', 'high'],
  },
  curved_ground: {
    id: 'curved_ground', title: 'Curved ground', kind: 'Idea',
    short: 'The planet is round, so the ground falls away from a straight line.',
    what: 'A level line drops away from the surface as you go farther along it.',
    why: 'A fast craft goes so far that the ground curves away beneath it.',
    life: 'A ship seems to sink below the sea’s edge as it sails away, for the same reason.',
    related: ['orbit', 'orbit_speed'],
  },
  air_drag: {
    id: 'air_drag', title: 'Air drag', kind: 'Idea',
    short: 'Thin air still slows a craft that flies low.',
    what: 'Even high up there are a few bits of air. Each trip through them takes away a little speed.',
    why: 'A craft that flies too low sinks and burns up.',
    life: 'The Space Station uses small engine burns to stay high.',
    facts: [
      { label: 'Earth: air slows a craft below', value: lenText(BODIES.earth.atmosphere) },
      { label: 'Mars: air slows a craft below', value: lenText(BODIES.mars.atmosphere) },
    ],
    more: ['This model draws no air. It only warns you when the path dips into the air.'],
    related: ['orbit', 'earth'],
  },
  launch_angle: {
    id: 'launch_angle', title: 'Aim', kind: 'Idea',
    short: 'The way the craft points when it starts.',
    what: 'Level is sideways along the ground. Straight up is away from the ground.',
    why: 'Only the sideways part of the speed helps the craft go around.',
    life: 'Real rockets go up first, and then they tip over to build up sideways speed.',
    related: ['launch_arrow', 'orbit'],
  },
};

export function getInfo(id) {
  return Object.prototype.hasOwnProperty.call(INFO, id) ? INFO[id] : null;
}

/** Which card belongs to a body id. */
export const BODY_INFO_ID = { earth: 'earth', moon: 'moon', mars: 'mars', sun: 'sun' };
