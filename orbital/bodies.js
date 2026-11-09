// Real body data for Orbital Mechanics. Pure data, no DOM, no Three.js.
// mu in km^3/s^2, radius in km (equatorial), atmosphere = height in km below
// which an orbit is not stable (0 = none). Source: NASA Planetary Fact Sheets.

/** Standard gravity in km/s^2 (used by the rocket equation). */
export const G0 = 9.80665e-3;

/** One astronomical unit in km. */
export const AU = 149597870.7;

/** Real body data keyed by body id. */
export const BODIES = {
  earth: { id: 'earth', name: 'Earth', mu: 398600.4418, radius: 6378.137, atmosphere: 100, rotationHours: 23.934, color: '#3f7fbf', color2: '#5c9a6a', parent: 'sun', orbitRadius: 149597870.7, source: 'NASA Planetary Fact Sheet' },
  moon: { id: 'moon', name: 'Moon', mu: 4902.800, radius: 1737.4, atmosphere: 0, rotationHours: 655.7, color: '#9a9a96', color2: '#77777a', parent: 'earth', orbitRadius: 384400, source: 'NASA Planetary Fact Sheet' },
  mars: { id: 'mars', name: 'Mars', mu: 42828.37, radius: 3396.2, atmosphere: 80, rotationHours: 24.62, color: '#b5593a', color2: '#8f4a34', parent: 'sun', orbitRadius: 227939366, source: 'NASA Planetary Fact Sheet' },
  sun: { id: 'sun', name: 'Sun', mu: 1.32712440018e11, radius: 695700, atmosphere: 0, rotationHours: 609, color: '#e8b54a', color2: '#d99a2b', parent: null, orbitRadius: 0, source: 'NASA Sun Fact Sheet' },
};

/** Body ids in display order. */
export const BODY_ORDER = ['earth', 'moon', 'mars', 'sun'];

/**
 * Orbit presets per body. Planet and moon presets give altitudes above the
 * surface in km (pe, ap). Sun presets give distance from the Sun's center in
 * km (peR, apR). Entries marked approx use standard reference values.
 */
export const ORBIT_PRESETS = {
  earth: [
    { id: 'iss', name: 'Space station', pe: 400, ap: 400 },
    { id: 'gps', name: 'GPS', pe: 20200, ap: 20200 },
    { id: 'geo', name: 'Geostationary', pe: 35786, ap: 35786 },
    { id: 'molniya', name: 'Molniya', pe: 500, ap: 39873 },
    { id: 'moon', name: 'Moon distance', pe: 378022, ap: 378022 },
  ],
  moon: [
    { id: 'llo', name: 'Low lunar orbit', pe: 100, ap: 100 },
    { id: 'apollo', name: 'Apollo parking orbit', pe: 110, ap: 110 },
    { id: 'frozen', name: 'High ellipse', pe: 100, ap: 6000 },
  ],
  mars: [
    { id: 'lmo', name: 'Low Mars orbit', pe: 300, ap: 300 },
    { id: 'phobos', name: 'Phobos distance', pe: 5981, ap: 5981, approx: true },
    { id: 'deimos', name: 'Deimos distance', pe: 20067, ap: 20067, approx: true },
    { id: 'areo', name: 'Areostationary', pe: 17032, ap: 17032, approx: true },
  ],
  sun: [
    { id: 'mercury', name: 'Mercury orbit', peR: 46.0e6, apR: 69.8e6, approx: true },
    { id: 'venus', name: 'Venus orbit', peR: 107.5e6, apR: 108.9e6, approx: true },
    { id: 'earth', name: 'Earth orbit', peR: 147.1e6, apR: 152.1e6, approx: true },
    { id: 'mars', name: 'Mars orbit', peR: 206.6e6, apR: 249.2e6, approx: true },
  ],
};

/**
 * Circular-to-circular transfer presets per body. Give alt1/alt2 (altitude
 * above the surface) or r1/r2 (distance from the body center), all in km.
 */
export const TRANSFER_PRESETS = {
  earth: [
    { id: 'leo-geo', name: 'Low orbit to geostationary', alt1: 300, alt2: 35786 },
    { id: 'leo-gps', name: 'Low orbit to GPS', alt1: 300, alt2: 20200 },
    { id: 'leo-moon', name: 'Low orbit to Moon distance', alt1: 300, r2: 384400 },
  ],
  moon: [
    { id: 'llo-high', name: 'Low orbit to high orbit', alt1: 100, alt2: 5000 },
  ],
  mars: [
    { id: 'lmo-phobos', name: 'Low orbit to Phobos distance', alt1: 300, alt2: 5981, approx: true },
    { id: 'lmo-deimos', name: 'Low orbit to Deimos distance', alt1: 300, alt2: 20067, approx: true },
  ],
  sun: [
    { id: 'earth-mars', name: 'Earth orbit to Mars orbit', r1: 149597870.7, r2: 227939366 },
    { id: 'earth-venus', name: 'Earth orbit to Venus orbit', r1: 149597870.7, r2: 108208000, approx: true },
  ],
};
