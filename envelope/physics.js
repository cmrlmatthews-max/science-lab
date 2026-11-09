/**
 * Heat flow and dew point analysis for a layered wall.
 * Pure functions, IP units: inches, °F, h·ft²·°F/Btu.
 */
import {
  MATERIALS, FILMS, STEEL_STUD_EFFECTIVE_R, WOOD_FRAMING_FACTOR, materialR,
} from './materials.js';

const MAGNUS_A = 17.625;
const MAGNUS_B = 243.04; // °C
const STEEL_FALLBACK_FACTOR = { 16: 0.40, 24: 0.47 };
/** Layer categories that hold or store little water, so a cold face on them is not a condensation surface. */
const INSULATING_CATEGORIES = new Set(['batt', 'rigid', 'airspace', 'membrane']);

/**
 * Dew point of air using the Magnus formula.
 * @param {number} tF Dry-bulb temperature, °F.
 * @param {number} rhPct Relative humidity, percent (clamped to 0.01 to 100).
 * @returns {number} Dew point, °F.
 */
export function dewPoint(tF, rhPct) {
  const tC = (tF - 32) / 1.8;
  const rh = Math.min(100, Math.max(0.01, rhPct));
  const gamma = Math.log(rh / 100) + (MAGNUS_A * tC) / (MAGNUS_B + tC);
  return ((MAGNUS_B * gamma) / (MAGNUS_A - gamma)) * 1.8 + 32;
}

/**
 * Heat lost by conduction through a wall.
 * @param {number} u U-factor, Btu/h·ft²·°F.
 * @param {number} areaSf Area, ft².
 * @param {number} dT Temperature difference, °F.
 * @returns {number} Btu/h
 */
export function conductionLoss(u, areaSf, dT) {
  return u * areaSf * dT;
}

/**
 * Sensible heat lost by air leakage.
 * @param {number} cfm Air leakage, cubic feet per minute.
 * @param {number} dT Temperature difference, °F.
 * @returns {number} Btu/h
 */
export function infiltrationLoss(cfm, dT) {
  return 1.08 * cfm * dT;
}

/** Ready-made indoor and outdoor conditions. */
export const CLIMATE_PRESETS = {
  bci: { id: 'bci', name: 'BCI drawing', tIn: 70, rhIn: 30, tOut: 0, rhOut: 70 },
  cold: { id: 'cold', name: 'Cold winter', tIn: 70, rhIn: 35, tOut: 0, rhOut: 70 },
  mixed: { id: 'mixed', name: 'Mixed winter', tIn: 70, rhIn: 35, tOut: 20, rhOut: 70 },
  hothumid: { id: 'hothumid', name: 'Hot-humid summer', tIn: 75, rhIn: 50, tOut: 95, rhOut: 55 },
};

/**
 * Finite number or a fallback.
 * @param {*} v
 * @param {number} fallback
 * @returns {number}
 */
function num(v, fallback) {
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Effective R of a steel-framed cavity layer.
 * @param {import('./walls.js').Framing} framing
 * @param {number} nominalR
 * @returns {{r: number, source: string}}
 */
function steelEffectiveR(framing, nominalR) {
  const tabled = STEEL_STUD_EFFECTIVE_R[`${framing.depth}|${framing.nominalR}|${framing.spacing}`];
  if (tabled != null) return { r: tabled, source: 'steel effective R (table)' };
  const factor = STEEL_FALLBACK_FACTOR[framing.spacing] ?? (framing.spacing >= 20 ? 0.47 : 0.40);
  return { r: factor * nominalR, source: 'steel effective R (fallback factor)' };
}

/**
 * Stud area share for wood framing.
 * @param {number} spacing Inches on center.
 * @returns {number}
 */
function woodFraction(spacing) {
  return WOOD_FRAMING_FACTOR[spacing] ?? (spacing >= 20 ? WOOD_FRAMING_FACTOR[24] : WOOD_FRAMING_FACTOR[16]);
}

/**
 * Resolve one wall layer into the R values used on each path.
 * `r` is the profile path (cavity for wood, effective R for steel).
 * `rFrame` is the path through the stud. `rNominal` ignores framing losses.
 * @param {import('./walls.js').WallLayer} layer
 * @param {number} index
 * @param {number} zIn Distance of the inner face from the interior face, inches.
 */
function resolveLayer(layer, index, zIn) {
  const mat = MATERIALS[layer.materialId];
  const thickness = Math.max(0, num(layer.thickness, mat?.thickness ?? 0));
  const base = materialR(layer.materialId, thickness);
  const framing = layer.framing && (layer.framing.type === 'wood' || layer.framing.type === 'steel')
    ? layer.framing : null;
  const resolved = {
    index,
    materialId: layer.materialId,
    name: mat?.name ?? layer.materialId,
    category: mat?.category ?? null,
    thickness,
    r: base,
    rSource: mat?.rPerInch != null ? 'per inch' : 'fixed',
    rFrame: base,
    rNominal: base,
    zIn,
    zOut: zIn + thickness,
    framing: layer.framing ? { ...layer.framing } : null,
  };
  if (!framing) return resolved;
  const nominal = num(framing.nominalR, base);
  resolved.rNominal = nominal;
  if (framing.type === 'steel') {
    const eff = steelEffectiveR(framing, nominal);
    Object.assign(resolved, { r: eff.r, rSource: eff.source, rFrame: eff.r });
  } else {
    resolved.rFrame = MATERIALS.softwood.rPerInch * num(framing.depth, thickness);
  }
  return resolved;
}

/**
 * Face label for the active season. Faces are numbered from the interior surface (0)
 * to the exterior surface (layers.length). In winter the label names the layer on the
 * cold side (outside) of the face, in summer the layer on the cold side (inside).
 */
function faceLabel(i, layers, season) {
  if (i === 0) return 'Interior surface';
  if (i === layers.length) return 'Exterior surface';
  return season === 'winter' ? `${layers[i].name} inner face` : `${layers[i - 1].name} outer face`;
}

/**
 * Index of the layer on the cold side of face i.
 * @param {number} i Face index.
 * @param {number} n Layer count.
 * @param {'winter'|'summer'} season
 */
function coldSideLayer(i, n, season) {
  return season === 'winter' ? Math.min(i, n - 1) : Math.max(i - 1, 0);
}

/**
 * Find where the temperature profile first reaches the dew point, walking from the warm side.
 * @param {{z:number,tempF:number}[]} profile Polyline from room air to outside air.
 * @param {number} dewPointF
 * @param {'interior'|'exterior'} warmSide
 * @param {object[]} layers Resolved layers.
 * @returns {{z:number, layerIndex:number}|null}
 */
function findDewPlane(profile, dewPointF, warmSide, layers) {
  if (layers.length === 0) return null;
  const pts = warmSide === 'interior' ? profile : [...profile].reverse();
  const k = pts.findIndex((p) => p.tempF <= dewPointF);
  if (k < 0) return null;
  let z = pts[k].z;
  if (k > 0) {
    const a = pts[k - 1];
    const b = pts[k];
    z = a.z + ((a.tempF - dewPointF) / (a.tempF - b.tempF)) * (b.z - a.z);
  }
  const total = layers[layers.length - 1].zOut;
  z = Math.min(total, Math.max(0, z));
  const ordered = warmSide === 'interior' ? layers : [...layers].reverse();
  const hit = ordered.find((l) => z >= l.zIn && z <= l.zOut);
  return { z, layerIndex: hit.index };
}

/**
 * First face from the warm side that is at or below the dew point and belongs to a
 * non-insulating layer.
 * @returns {object|null} Condensation record including `outsideWrb`.
 */
function findCondensation(faces, layers, season) {
  const n = layers.length;
  if (n === 0) return null;
  const order = faces.map((f) => f.index);
  if (season === 'summer') order.reverse();
  const wrbIndex = layers.findIndex((l) => l.materialId === 'wrb');
  for (const i of order) {
    if (!faces[i].belowDew) continue;
    const layer = layers[coldSideLayer(i, n, season)];
    if (INSULATING_CATEGORIES.has(layer.category)) continue;
    return {
      faceIndex: i,
      z: faces[i].z,
      tempF: faces[i].tempF,
      label: faces[i].label,
      materialId: layer.materialId,
      outsideWrb: season === 'winter' && wrbIndex >= 0 && i > wrbIndex,
    };
  }
  return null;
}

/**
 * Analyze a wall in a given climate: effective R, U, heat flow, temperature at every
 * layer face, dew plane and condensation risk. Never throws and never returns NaN for
 * any list of layers; bad numbers fall back to material defaults.
 *
 * Wood framing uses the parallel path method for rTotal. The temperature profile always
 * follows the cavity path (wood) or the effective-R path (steel).
 *
 * @param {import('./walls.js').Wall} wall
 * @param {{tIn:number, rhIn:number, tOut:number, rhOut:number}} [climate] Defaults to the mixed winter preset.
 * @returns {object} See the field list in CONTRACT.md section 2.3.
 */
export function analyzeWall(wall, climate = CLIMATE_PRESETS.mixed) {
  const tIn = num(climate.tIn, 70);
  const tOut = num(climate.tOut, 20);
  const rhIn = num(climate.rhIn, 35);
  const rhOut = num(climate.rhOut, 70);
  const season = tIn >= tOut ? 'winter' : 'summer';
  const warmSide = season === 'winter' ? 'interior' : 'exterior';
  const dewPointF = warmSide === 'interior' ? dewPoint(tIn, rhIn) : dewPoint(tOut, rhOut);

  let zCursor = 0;
  const layers = (wall?.layers ?? []).map((layer, i) => {
    const resolved = resolveLayer(layer, i, zCursor);
    zCursor = resolved.zOut;
    return resolved;
  });
  const totalThickness = zCursor;

  const rInt = FILMS.interior.r;
  const rExt = season === 'winter' ? FILMS.exteriorWinter.r : FILMS.exteriorSummer.r;
  const sum = (key) => layers.reduce((acc, l) => acc + l[key], 0);
  const rCavityPath = rInt + sum('r') + rExt;
  const rNominal = rInt + sum('rNominal') + rExt;
  const woodLayer = layers.find((l) => l.framing?.type === 'wood');
  const rFramePath = woodLayer ? rInt + sum('rFrame') + rExt : null;
  const rTotal = woodLayer
    ? 1 / ((1 - woodFraction(woodLayer.framing.spacing)) / rCavityPath
      + woodFraction(woodLayer.framing.spacing) / rFramePath)
    : rCavityPath;

  const tempAt = (cumR) => tIn + ((tOut - tIn) * cumR) / rCavityPath;
  let cum = rInt;
  const faces = [];
  for (let i = 0; i <= layers.length; i += 1) {
    const tempF = tempAt(cum);
    faces.push({
      index: i,
      z: i < layers.length ? layers[i].zIn : totalThickness,
      tempF,
      label: faceLabel(i, layers, season),
      belowDew: tempF <= dewPointF,
    });
    if (i < layers.length) cum += layers[i].r;
  }

  const profile = [
    { z: -1, tempF: tIn },
    ...faces.map((f) => ({ z: f.z, tempF: f.tempF })),
    { z: totalThickness + 1, tempF: tOut },
  ];
  const condensation = findCondensation(faces, layers, season);

  return {
    rTotal,
    uFactor: 1 / rTotal,
    q: Math.abs(tIn - tOut) / rTotal,
    rCavityPath,
    rFramePath,
    rNominal,
    framingLossPct: ((rNominal - rTotal) / rNominal) * 100,
    season,
    warmSide,
    dewPointF,
    layers: layers.map((l) => ({
      index: l.index,
      materialId: l.materialId,
      name: l.name,
      thickness: l.thickness,
      r: l.r,
      rSource: l.rSource,
      zIn: l.zIn,
      zOut: l.zOut,
      tIn: faces[l.index].tempF,
      tOut: faces[l.index + 1].tempF,
      framing: l.framing,
    })),
    faces,
    profile,
    dewPlane: findDewPlane(profile, dewPointF, warmSide, layers),
    condensation,
    risk: condensation !== null && !condensation.outsideWrb,
    totalThickness,
  };
}
