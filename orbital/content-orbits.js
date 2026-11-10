// orbital/content-orbits.js  Words and card entries for the Orbits mode. Pure data, no DOM, runs in Node.
// Layers: l1 Start, l2 Story, l3 Explore, l4 Numbers, l5 Deep. See CONTRACT-LAYERS.md.
// Functions in l4.tiles[*].compare take one number: km (lowest, highest), km/s (speed), seconds (period), or how oval (shape).

import { dual } from '../shared/units.js';

const DAY = 86164; // seconds, one turn of Earth
const MOON_KM = 384400;
const EARTH_WIDTH_KM = 12742;
const JET_KM = 11;
const BULLET_KMS = 0.9;

const K = (km) => dual.km(km, 0).text;
const V = (v, d = 2) => dual.kmps(v, d).text;

const group = (n, digits = 0) => n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const roundNice = (n) => (n >= 10 ? group(Math.round(n)) : group(Math.round(n * 10) / 10).replace(/\.0$/, ''));

/** Height comparison for a lowest or highest point (km above the surface). */
function compareHeight(km) {
  if (km >= 1e6) return `About ${roundNice(km / MOON_KM)} times the distance to the Moon.`;
  if (km >= 20000) return `About ${roundNice(km / EARTH_WIDTH_KM)} times the width of Earth.`;
  const times = km / JET_KM;
  if (times < 1.5) return 'About as high as a jet plane.';
  return `About ${roundNice(times)} times higher than a jet plane.`;
}

/** Speed comparison (km/s). */
function compareSpeed(v) {
  const r = v / BULLET_KMS;
  if (r < 1.4) return 'About as fast as a rifle bullet.';
  return `About ${roundNice(r)} times faster than a rifle bullet.`;
}

/** Trip time comparison (seconds). */
function comparePeriod(s) {
  if (Math.abs(s - DAY) / DAY < 0.02) return 'The same as one Earth day, so it stays over one spot.';
  if (s < DAY) return `About ${roundNice(DAY / s)} trips around each Earth day.`;
  return `About ${roundNice(s / DAY)} Earth days for one trip.`;
}

/** How oval comparison (0 is a circle). */
function compareShape(e) {
  if (e < 0.02) return 'A perfect circle has a zero here.';
  if (e < 0.2) return 'Close to a circle. A circle has a zero.';
  if (e < 0.6) return 'A clear oval. A circle has a zero.';
  return 'A very long oval. A circle has a zero.';
}

export const TEXT = {
  l1: {
    question: 'Why do some satellites go fast and others slow?',
    sub: 'Pick something that circles Earth. Watch how high it flies.',
    pick: 'Pick one',
    answers: {
      iss: {
        title: 'Low and very fast',
        text: 'The Space Station flies close to Earth. It races around the world in about an hour and a half.',
      },
      gps: {
        title: 'Higher and slower',
        text: 'GPS satellites fly much higher than the Space Station. They move slower. One trip takes about half a day.',
      },
      geo: {
        title: 'So high it seems to stand still',
        text: 'A TV satellite goes around once a day. Earth also turns once a day. So the satellite stays over one spot.',
      },
      moon: {
        title: 'The Moon is an orbit too',
        text: 'The Moon is very far away, so it moves slowly. One trip around Earth takes about a month.',
      },
      molniya: {
        title: 'Fast when low, slow when high',
        text: 'This orbit is a long oval. The craft speeds up as it falls close to Earth. It slows down as it climbs away.',
      },
      round: {
        title: 'A steady circle',
        text: 'The craft moves at the same speed all the way around. A higher circle is slower and takes longer.',
      },
      oval: {
        title: 'Fast when low, slow when high',
        text: 'Gravity pulls the craft in and speeds it up. As it climbs away, it slows down again.',
      },
      slices: {
        title: 'Equal slices, equal time',
        text: 'Each slice takes the same time to cross. Low down it is short and wide. High up it is long and thin. The area is the same.',
      },
    },
    choices: [
      { id: 'iss', label: 'Space Station' },
      { id: 'gps', label: 'GPS' },
      { id: 'geo', label: 'TV satellite' },
      { id: 'moon', label: 'Moon' },
    ],
  },

  l2: {
    steps: [
      {
        title: 'Low and fast: the Space Station',
        text: 'The Space Station flies low, close to Earth. It moves very fast. One trip around the world takes about an hour and a half.',
        life: 'The crew sees sixteen sunrises every day.',
      },
      {
        title: 'Higher and slower: GPS',
        text: 'GPS satellites fly much higher. Higher orbits are slower. One trip takes about half a day.',
        life: 'Your phone map listens to GPS satellites to find where you are.',
      },
      {
        title: 'The special height: TV dishes',
        text: 'At one special height, a trip takes exactly one day. Earth turns once a day too. So the satellite stays over one spot.',
        life: 'A satellite TV dish never needs to move. Many weather pictures come from satellites parked at this height.',
      },
      {
        title: 'Oval orbits: fast low, slow high',
        text: 'An orbit can be an oval. The craft speeds up when it is low. It slows down when it is high.',
        life: 'Some satellites for far northern lands use long ovals. They hang high over the north for hours.',
      },
      {
        title: 'The Moon is in orbit too',
        text: 'The Moon circles Earth just like a satellite. It is very high, so it is very slow. One trip takes about a month.',
        life: 'The Moon pulls on the oceans. That makes the tides rise and fall.',
      },
    ],
  },

  l3: {
    controls: {
      orbits: 'Orbits',
      lowest: 'Lowest point',
      highest: 'Highest point',
      round: 'Make it round',
      playback: 'Playback speed',
    },
    presetNames: {
      iss: 'Space Station',
      gps: 'GPS',
      geo: 'TV satellite',
      molniya: 'Long oval',
      moon: 'The Moon',
    },
    tries: [
      { label: 'A low orbit', hint: 'Close in. Very fast.' },
      { label: 'A high orbit', hint: 'Far out. Slow. One trip takes a day.' },
      { label: 'A long oval', hint: 'It speeds up when it comes close.' },
    ],
    notes: [
      'The craft moves fastest at the lowest point and slowest at the highest point.',
      'A higher orbit is slower and takes longer.',
      'The speed stays the same all the way around.',
      'One trip takes one Earth day, so the craft stays above the same place.',
    ],
    ideas: {
      orbit: 'Orbit',
      gravity: 'Gravity',
      oval: 'Oval orbit',
      period: 'Time for one trip',
      geostationary: 'Geostationary orbit',
      lowest: 'Lowest point',
      highest: 'Highest point',
    },
    messages: {
      air: 'Too low. The air drags it down.',
      slowest: 'Slowest',
      fastest: 'Fastest',
      barLabel: 'Current speed between the slowest and the fastest',
      markerLow: 'Lowest point',
      markerHigh: 'Highest point',
      right: 'Right now',
      upText: 'up',
      tripTime: 'Trip time',
      speed: 'Speed',
    },
  },

  l4: {
    tiles: {
      lowest: { label: 'Lowest point', compare: compareHeight },
      highest: { label: 'Highest point', compare: compareHeight },
      speed: { label: 'Speed', compare: compareSpeed },
      period: { label: 'Time for one trip', compare: comparePeriod },
      shape: { label: 'How oval', compare: compareShape },
    },
    glosses: {
      altitude: 'Height above the surface.',
      period: 'The time for one trip all the way around.',
      eccentricity: 'A number for how oval an orbit is. Zero is a circle.',
      periapsis: 'The lowest point of an orbit.',
      apoapsis: 'The highest point of an orbit.',
    },
  },

  l5: {
    world: 'World',
    kepler: "Kepler's ideas",
    extraTry: { label: 'See the equal slices', hint: 'Each slice takes the same time.' },
    sections: {
      your: 'Your orbit',
      key: 'Key numbers',
      now: 'Right now',
      shows: 'What this shows',
      show3d: 'Show on the 3D view',
      compare: 'Compare orbits',
      graph: 'Speed around the orbit',
      slices: 'Equal slices',
    },
    labels: {
      lowestAlt: 'Lowest point (altitude)',
      highestAlt: 'Highest point (altitude)',
      period: 'Time for one orbit',
      vLow: 'Speed at the lowest point',
      vHigh: 'Speed at the highest point',
      avg: 'Average distance',
      shape: 'Shape',
      altNow: 'Altitude now',
      speedNow: 'Speed now',
      arrow: 'Show speed arrow',
      slices: 'Show equal slices',
      slicesCaption: 'Each slice takes the same time.',
      tableOrbit: 'Orbit',
      tableHeight: 'Height',
      tableTrip: 'One orbit',
      tableSpeed: 'Speed (km/s)',
      graphTitle: 'Speed (km/s)',
      graphX: 'Time through one orbit',
    },
    sources: {
      period: "Kepler's third law",
      speed: 'Vis-viva equation',
      avg: 'Semi-major axis',
      shape: 'Eccentricity',
    },
    formulas: [
      'Time for one orbit: T = 2 pi times the square root of (a cubed divided by mu).',
      'Speed at any distance r: v = the square root of mu times (2 over r minus 1 over a).',
      'How oval: e = (highest distance minus lowest distance) divided by (highest distance plus lowest distance).',
    ],
  },
};

// ---------- card entries ----------
export const INFO = {
  earth: {
    id: 'earth', title: 'Earth', kind: 'Planet',
    short: 'The planet we live on. The craft goes around it.',
    what: 'Earth is a big ball of rock and water. Its pull, called gravity, holds the craft in orbit.',
    why: 'Gravity bends the craft path into a curve. That is why it circles Earth and does not fly off straight.',
    life: 'Phone maps, weather pictures and satellite TV all use craft that circle Earth.',
    facts: [
      { label: 'Width', value: K(12756) },
      { label: 'One day', value: '23.9 hours' },
      { label: 'Air drag below', value: K(100) },
    ],
    more: ['Earth turns once in about a day. A satellite that goes around in the same time stays over one spot.'],
    related: ['gravity', 'orbit', 'geostationary'],
    source: 'NASA Planetary Fact Sheet',
  },
  moon: {
    id: 'moon', title: 'Moon', kind: 'Moon',
    short: 'Earth has one natural moon. It is an orbit too.',
    what: 'The Moon is a ball of rock that circles Earth. It is much smaller than Earth.',
    why: 'The Moon follows the same rules as any satellite. It is so high that it moves slowly.',
    life: 'The Moon pulls on the oceans. That makes the tides rise and fall.',
    facts: [
      { label: 'Width', value: K(3475) },
      { label: 'One turn', value: '27.3 days' },
      { label: 'Distance from Earth', value: K(384400) },
    ],
    more: ['One trip around Earth takes about a month. The same side always faces Earth.'],
    related: ['orbit', 'period', 'earth'],
    source: 'NASA Planetary Fact Sheet',
  },
  mars: {
    id: 'mars', title: 'Mars', kind: 'Planet',
    short: 'The red planet. It is smaller than Earth.',
    what: 'Mars is a cold, dry world of red rock. It has a thin layer of air.',
    why: 'Craft can circle Mars just like Earth. Its pull is weaker, so the speeds are lower.',
    life: 'Robot craft circle Mars now. They take pictures and send messages home.',
    facts: [
      { label: 'Width', value: K(6792) },
      { label: 'One day', value: '24.6 hours' },
      { label: 'Air drag below', value: K(80) },
    ],
    more: ['Mars has two tiny moons, Phobos and Deimos. They go around Mars like small satellites.'],
    related: ['orbit', 'gravity'],
    source: 'NASA Planetary Fact Sheet',
  },
  sun: {
    id: 'sun', title: 'Sun', kind: 'Star',
    short: 'The star at the center of our system. Planets circle it.',
    what: 'The Sun is a huge ball of hot gas. Its pull holds all the planets in orbit.',
    why: 'Each planet is a satellite of the Sun. A planet far from the Sun takes longer to go around.',
    life: 'One trip of Earth around the Sun is one year.',
    facts: [
      { label: 'Width', value: K(1391400) },
      { label: 'One turn', value: '25.4 days' },
    ],
    more: ['The Sun is drawn larger than true size here so that you can see it.'],
    related: ['orbit', 'kepler'],
    source: 'NASA Sun Fact Sheet',
  },
  craft: {
    id: 'craft', title: 'The craft', kind: 'Satellite',
    short: 'A small spacecraft that circles the planet.',
    what: 'The craft is falling around the planet all the time. It moves sideways so fast that it keeps missing.',
    why: 'This is how every satellite stays up. It needs no engine to keep going around.',
    life: 'The Space Station, GPS satellites and weather satellites all do this.',
    facts: [
      { label: 'Space Station speed', value: V(7.669) },
    ],
    more: ['Higher up, gravity is weaker, so the craft needs less speed to stay in orbit.'],
    related: ['orbit', 'gravity', 'speed'],
    source: 'Vis-viva equation',
  },
  path: {
    id: 'path', title: 'The orbit path', kind: 'Path',
    short: 'The line the craft follows around the planet.',
    what: 'An orbit is the path of one object around another. The craft repeats it again and again.',
    why: 'The shape and size of the path set how fast the craft goes and how long a trip takes.',
    life: 'The Space Station follows its path again and again, sixteen times a day.',
    facts: [
      { label: 'Shape', value: 'A circle or an oval' },
    ],
    more: ['Every orbit is a circle or an oval. Kepler found this by studying the planets.'],
    related: ['orbit', 'oval', 'kepler'],
    source: "Kepler's first law",
  },
  lowest: {
    id: 'lowest', title: 'Lowest point', kind: 'Marker',
    short: 'The spot where the craft comes closest to the planet.',
    what: 'On an oval orbit, this is the place nearest the planet. Experts call it the periapsis.',
    why: 'Gravity pulls hardest here, so the craft is fastest at this spot.',
    life: 'A craft on a long oval whips past Earth here, then climbs away.',
    facts: [
      { label: 'Space Station', value: `${K(400)} up` },
      { label: 'Molniya orbit', value: `${K(500)} up` },
    ],
    more: ['The lowest point and the highest point sit on opposite sides of the planet.'],
    related: ['highest', 'oval', 'speed'],
    source: 'Orbit geometry',
  },
  highest: {
    id: 'highest', title: 'Highest point', kind: 'Marker',
    short: 'The spot where the craft is farthest from the planet.',
    what: 'On an oval orbit, this is the place farthest from the planet. Experts call it the apoapsis.',
    why: 'The craft is slowest here. It spends the most time near this spot.',
    life: 'Some satellites hang near their highest point for hours. They stay in view of far northern lands.',
    facts: [
      { label: 'Molniya orbit', value: `${K(39873)} up` },
    ],
    more: ['A craft on a long oval spends most of its trip near the highest point.'],
    related: ['lowest', 'oval', 'speed'],
    source: 'Orbit geometry',
  },
  arrow: {
    id: 'arrow', title: 'Speed arrow', kind: 'Arrow',
    short: 'It points the way the craft is moving.',
    what: 'The arrow shows the direction of motion. A long arrow means fast. A short arrow means slow.',
    why: 'Watch the arrow grow as the craft falls toward the planet. It shrinks as the craft climbs.',
    life: 'A car speedometer shows the same idea with a number.',
    facts: [
      { label: 'Direction', value: 'Along the path (tangent)' },
    ],
    more: ['The arrow always points along the path. The craft never moves straight at the planet.'],
    related: ['speed', 'oval'],
    source: 'Velocity vector',
  },
  slices: {
    id: 'slices', title: 'Equal slices', kind: 'Idea',
    short: 'Slices of the orbit that each take the same time.',
    what: 'The orbit is cut into pieces. The craft needs the same time to cross each piece.',
    why: 'Low down, a slice is short and wide. High up, it is long and thin. The area stays the same.',
    life: 'This rule helps experts predict where a satellite will be at any time.',
    facts: [
      { label: 'Rule', value: 'Equal areas in equal times' },
    ],
    more: ['This is the second of Kepler laws. It comes from the way gravity pulls toward the center.'],
    related: ['kepler', 'oval'],
    source: "Kepler's second law",
  },
  orbit: {
    id: 'orbit', title: 'Orbit', kind: 'Idea',
    short: 'The path of one object around another.',
    what: 'An orbit happens when something falls around a bigger thing and keeps missing it.',
    why: 'Orbits explain how the Moon circles Earth, how Earth circles the Sun, and how satellites stay up.',
    life: 'Every GPS, TV and weather satellite is in an orbit.',
    facts: [
      { label: 'Space Station', value: `${K(400)} up, 92.6 min per trip` },
    ],
    more: ['Throw a ball harder and it lands farther away. Throw it fast enough and the ground curves away as it falls. Then it never lands.'],
    related: ['gravity', 'period', 'oval'],
    source: 'Newton',
  },
  oval: {
    id: 'oval', title: 'Oval orbit', kind: 'Idea',
    short: 'An orbit shaped like a squashed circle.',
    what: 'On an oval orbit the craft is sometimes close to the planet and sometimes far away.',
    why: 'The craft is fast when it is low and slow when it is high. A circle has the same speed everywhere.',
    life: 'Some satellites for far northern lands use a long oval to stay in view for hours.',
    facts: [
      { label: 'How oval', value: '0 is a circle, near 1 is very long' },
      { label: 'Molniya orbit', value: '0.74' },
    ],
    more: ['Experts call the number for how oval an orbit is the eccentricity.'],
    related: ['lowest', 'highest', 'speed'],
    source: 'Orbit geometry',
  },
  period: {
    id: 'period', title: 'Time for one trip', kind: 'Idea',
    short: 'How long the craft takes to go all the way around.',
    what: 'Experts call this time the period. A higher orbit has a longer trip.',
    why: 'A higher orbit is longer, and the craft moves slower there. Both make the trip take more time.',
    life: 'The Space Station circles Earth about sixteen times a day.',
    facts: [
      { label: 'Space Station', value: '92.6 min' },
      { label: 'GPS', value: '12.0 hours' },
      { label: 'TV satellite', value: '23.9 hours' },
      { label: 'Moon', value: 'about 27 days' },
    ],
    more: ['Kepler found that the time squared grows like the average distance cubed.'],
    related: ['kepler', 'orbit', 'geostationary'],
    source: "Kepler's third law",
  },
  geostationary: {
    id: 'geostationary', title: 'Geostationary orbit', kind: 'Idea',
    short: 'A very high orbit where a satellite stays over one spot.',
    what: 'At this special height, one trip takes one day. Earth turns once a day too.',
    why: 'The satellite seems to hang still in the sky. A dish on the ground can point at it and stay put.',
    life: 'Satellite TV dishes and many weather satellites use this orbit.',
    facts: [
      { label: 'Height', value: K(35786) },
      { label: 'Speed', value: V(3.0747) },
      { label: 'One trip', value: '23.9 hours' },
    ],
    more: ['The orbit must be a circle above the equator. Then the satellite stays over one point.'],
    related: ['period', 'orbit', 'earth'],
    source: 'Kepler\'s third law',
  },
  kepler: {
    id: 'kepler', title: "Kepler's ideas", kind: 'Idea',
    short: 'Three simple rules about how things orbit.',
    what: 'One: an orbit is a circle or an oval. Two: the craft sweeps equal areas in equal times. Three: a higher orbit takes longer.',
    why: 'These rules work for planets, moons and satellites. They let experts plan every launch.',
    life: 'Mission teams use these rules to point a dish at a satellite.',
    facts: [
      { label: 'First law', value: 'Orbits are ellipses' },
      { label: 'Second law', value: 'Equal areas in equal times' },
      { label: 'Third law', value: 'T squared grows like a cubed' },
    ],
    more: ['Johannes Kepler found these rules from careful sky measurements, long before anyone had a rocket.'],
    related: ['slices', 'period', 'oval'],
    source: 'Kepler, 1609 and 1619',
  },
  gravity: {
    id: 'gravity', title: 'Gravity', kind: 'Idea',
    short: 'The pull between two things. It holds the craft in orbit.',
    what: 'Every object pulls on every other object. A big planet pulls much harder than a small rock.',
    why: 'Gravity bends the path of the craft toward the planet. That bend makes the orbit.',
    life: 'Gravity keeps your feet on the floor and the Moon near Earth.',
    facts: [
      { label: 'Pull gets weaker', value: 'with distance squared' },
    ],
    more: ['Close to the planet the pull is strong, so the craft must go fast to stay up.'],
    related: ['orbit', 'speed'],
    source: 'Newton',
  },
  speed: {
    id: 'speed', title: 'Fast low, slow high', kind: 'Idea',
    short: 'A craft moves faster near the planet and slower far away.',
    what: 'Close in, gravity is strong. The craft needs high speed to stay up. Far out, it can go slower.',
    why: 'This is why a high orbit takes much longer. The path is longer and the craft is slower.',
    life: 'The Space Station moves much faster than a GPS satellite.',
    facts: [
      { label: 'Space Station', value: V(7.669) },
      { label: 'GPS', value: V(3.873) },
      { label: 'TV satellite', value: V(3.0747) },
    ],
    more: ['On an oval orbit, the same craft is fast at the lowest point and slow at the highest point.'],
    related: ['gravity', 'oval', 'period'],
    source: 'Vis-viva equation',
  },
  iss: {
    id: 'iss', title: 'Space Station', kind: 'Satellite',
    short: 'A home in space where astronauts live and work.',
    what: 'The Space Station flies in a low, round orbit. It is big enough to see from the ground.',
    why: 'It flies low and fast. A trip around Earth takes about an hour and a half.',
    life: 'The crew sees sixteen sunrises every day.',
    facts: [
      { label: 'Height', value: K(400) },
      { label: 'Speed', value: V(7.669) },
      { label: 'One trip', value: '92.6 min' },
    ],
    more: ['Thin air at this height drags on the station. It fires small engines now and then to climb back up.'],
    related: ['orbit', 'period', 'speed'],
    source: 'Orbit presets in this app',
  },
  gps: {
    id: 'gps', title: 'GPS satellite', kind: 'Satellite',
    short: 'A satellite that sends signals so a phone can find its place.',
    what: 'GPS satellites fly in high, round orbits. Many of them circle Earth together.',
    why: 'They fly higher than the Space Station and move slower. One trip takes about half a day.',
    life: 'Your phone map uses GPS to show where you are.',
    facts: [
      { label: 'Height', value: K(20200) },
      { label: 'Speed', value: V(3.873) },
      { label: 'One trip', value: '12.0 hours' },
    ],
    more: ['A phone needs signals from at least four GPS satellites to work out its place.'],
    related: ['orbit', 'period', 'speed'],
    source: 'Orbit presets in this app',
  },
  molniya: {
    id: 'molniya', title: 'Long oval orbit', kind: 'Satellite',
    short: 'A very long oval that goes from low to very high.',
    what: 'This orbit is called Molniya. It dips close to Earth, then swings far out.',
    why: 'The craft is fast when low and slow when high. It spends hours near the top.',
    life: 'Some satellites for far northern lands use this orbit.',
    facts: [
      { label: 'Lowest point', value: K(500) },
      { label: 'Highest point', value: K(39873) },
      { label: 'Speed', value: `${dual.kmps(10.045, 1).us.replace(' mph', '')} to ${dual.kmps(1.494).text}` },
      { label: 'One trip', value: '12.0 hours' },
    ],
    more: ['The name is Russian for lightning. The first satellites on this orbit served far northern Russia.'],
    related: ['oval', 'lowest', 'highest'],
    source: 'Orbit presets in this app',
  },
};

export function getInfo(id) {
  return INFO[id] || null;
}
