// shared/units.js — dual unit text (US first, then metric). Pure functions, no DOM; runs in Node.
//
// Rounding rule: every number is rounded to 3 significant figures (nice(n, 3)) and shown with thousands
// separators. So 400 km is 249 mi (248.5 rounds up), and 7.67 km/s is 17,200 mph.
// For the metric side, a `digits` argument means "this many decimal places"; without it, 3 significant figures.
//
//   dual.km(km, digits)   -> { us: '249 mi', si: '400 km', text: '249 mi (400 km)' }
//   dual.kmps(v, digits)  -> { us: '17,200 mph', si: '7.67 km/s', text: '17,200 mph (7.67 km/s)' }
//   dual.mps(v)           m/s  -> mph
//   dual.kg(m)            kg   -> lb
//   dual.celsius(c)       °C   -> °F
//   dual.gcc(d)           g/cm³ -> lb/ft³
//   dual.angstrom(a)      Å (and nm); no US value
//   friendlyDuration(seconds), nice(n, sig)

export const KM_PER_MILE = 1.609344;
export const MPH_PER_KMPS = 2236.936;
export const LB_PER_KG = 2.20462;
export const LBFT3_PER_GCC = 62.428;
export const MPH_PER_MPS = 2.236936;

/**
 * Round to `sig` significant figures and add thousands separators. Trailing zeros after the point are dropped.
 * @param {number} n
 * @param {number} [sig=3]
 * @returns {string}
 */
export function nice(n, sig = 3) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const mag = Math.floor(Math.log10(Math.abs(n)));
  const rounded = Number(n.toPrecision(sig));
  const dec = Math.max(0, sig - 1 - mag);
  let s = rounded.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: Math.min(dec, 20) });
  if (/^-0$/.test(s)) s = '0';
  return s.replace('-', '−');
}

function fixed(n, digits) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  const s = n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return s.replace('-', '−');
}

// metric number: fixed decimals when `digits` is given, else 3 significant figures
const si = (n, digits) => (digits == null ? nice(n, 3) : fixed(n, digits));

function make(usNum, usUnit, siNum, siUnit, digits) {
  const us = `${nice(usNum, 3)} ${usUnit}`;
  const m = `${si(siNum, digits)} ${siUnit}`;
  return { us, si: m, text: `${us} (${m})` };
}

export const dual = {
  km: (km, digits) => make(km / KM_PER_MILE, 'mi', km, 'km', digits),
  kmps: (v, digits) => make(v * MPH_PER_KMPS, 'mph', v, 'km/s', digits),
  mps: (v, digits) => make(v * MPH_PER_MPS, 'mph', v, 'm/s', digits),
  kg: (m, digits) => make(m * LB_PER_KG, 'lb', m, 'kg', digits),
  celsius(c, digits) {
    const f = (c * 9) / 5 + 32;
    const us = `${nice(f, 3)}°F`;
    const m = `${si(c, digits)}°C`;
    return { us, si: m, text: `${us} (${m})` };
  },
  gcc: (d, digits) => make(d * LBFT3_PER_GCC, 'lb/ft³', d, 'g/cm³', digits),
  angstrom(a, digits) {
    const s = `${digits == null ? nice(a, 3) : fixed(a, digits)} Å`;
    const alt = `${nice(a / 10, 3)} nm`;
    return { us: null, si: s, alt, text: `${s} (${alt})` };
  },
};

/**
 * Plain-word duration: '45 seconds', '93 minutes', '5.3 hours', '12 days', '8.5 months', '2.4 years'.
 * Seconds under 2 minutes; minutes under 2 hours; hours under 2 days; days under 2 months; months under 2 years.
 * @param {number} seconds
 * @returns {string}
 */
export function friendlyDuration(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '—';
  const s = Math.abs(seconds);
  const word = (v, one, many, sig) => {
    const t = sig ? nice(v, sig) : String(Math.round(v));
    return `${t} ${t === '1' ? one : many}`;
  };
  if (s < 120) return word(s, 'second', 'seconds');
  if (s < 7200) return word(s / 60, 'minute', 'minutes');
  if (s < 172800) return word(s / 3600, 'hour', 'hours', 2);
  const days = s / 86400;
  if (days < 61) return word(days, 'day', 'days', 2);
  const months = days / 30.4375;
  if (months < 24) return word(months, 'month', 'months', 2);
  return word(months / 12, 'year', 'years', 2);
}
