/**
 * Interior vapor retarder rules for frame walls (BCI 7.46).
 * Pure functions, no DOM.
 */
import { MATERIALS, materialPerms } from './materials.js';

const SOURCE = 'BCI 7.46';

/** Vapor retarder classes by permeance. */
export const VAPOR_CLASSES = {
  none: { name: 'None', perms: 'More than 10', examples: 'Unpainted gypsum board' },
  I: { name: 'Class I', perms: '0.1 or less', examples: 'Sheet polyethylene, aluminum foil' },
  II: { name: 'Class II', perms: 'Above 0.1, up to 1.0', examples: 'Kraft-faced batts, some paints' },
  III: { name: 'Class III', perms: 'Above 1.0, up to 10.0', examples: 'Latex or enamel paint' },
};

/** IECC climate zones in map order. */
export const CLIMATE_ZONES = ['1', '2', '3', '4', '4M', '5', '6', '7', '8'].map((id) => ({
  id,
  name: id === '4M' ? 'Marine 4' : `Zone ${id}`,
}));

const WARNING_TEXT = {
  ZONE_NO_I_II: 'In zones 1 and 2 do not use a Class I or Class II vapor retarder on the interior. It would trap moisture that drives inward in summer.',
  ZONE_NO_I: 'In zones 3 and 4 do not use a Class I vapor retarder on the interior.',
  ZONE_NEEDS_I_II: 'In marine 4 and zones 5 to 8 the interior needs a Class I or Class II vapor retarder.',
  FOAM_CLASS_III_ONLY: 'Exterior foam under 1 perm blocks drying to the outside. Use a Class III retarder on the interior so the wall can dry inward.',
};

/**
 * Exterior rigid foam that is less than 1 perm, found outside the framed layer
 * (or outside the last structural layer when nothing is framed).
 * @param {import('./walls.js').WallLayer[]} layers
 * @returns {{materialId: string, perms: number}|null}
 */
function findExteriorFoam(layers) {
  let base = layers.findIndex((l) => l.framing);
  if (base < 0) base = layers.map((l) => MATERIALS[l.materialId]?.control).lastIndexOf('structure');
  if (base < 0) return null;
  for (let i = base + 1; i < layers.length; i += 1) {
    const { materialId, thickness } = layers[i];
    const perms = materialPerms(materialId, thickness);
    if (MATERIALS[materialId]?.category === 'rigid' && perms != null && perms < 1) {
      return { materialId, perms };
    }
  }
  return null;
}

/**
 * Zone rule for an interior vapor retarder class, as a warning code or null.
 * @param {string} cls 'none' | 'I' | 'II' | 'III'
 * @param {string} zone One of CLIMATE_ZONES ids.
 * @param {boolean} hasFoam True when the exterior foam rule applies.
 * @returns {'ZONE_NO_I_II'|'ZONE_NO_I'|'ZONE_NEEDS_I_II'|null}
 */
function zoneWarning(cls, zone, hasFoam) {
  if (zone === '1' || zone === '2') return cls === 'I' || cls === 'II' ? 'ZONE_NO_I_II' : null;
  if (zone === '3' || zone === '4') return cls === 'I' ? 'ZONE_NO_I' : null;
  const needsRetarder = cls === 'none' || cls === 'III';
  if (!needsRetarder || (cls === 'III' && hasFoam)) return null;
  return 'ZONE_NEEDS_I_II';
}

/**
 * Check an interior vapor retarder class against the climate zone and the wall.
 * The class rules apply to frame walls only.
 *
 * @param {{cls: 'none'|'I'|'II'|'III', zone: string, wall: import('./walls.js').Wall}} input
 * @returns {{ok: boolean, warnings: {code: string, text: string}[], notes: string[],
 *   foam: {materialId: string, perms: number}|null, source: string}}
 */
export function checkVaporRetarder({ cls, zone, wall }) {
  const layers = wall?.layers ?? [];
  const foam = findExteriorFoam(layers);
  if (!layers.some((l) => l.framing)) {
    return {
      ok: true,
      warnings: [],
      notes: ['The class rules in BCI 7.46 are for frame walls.'],
      foam,
      source: SOURCE,
    };
  }
  const codes = [];
  const zoneCode = zoneWarning(cls, String(zone), foam !== null);
  if (zoneCode) codes.push(zoneCode);
  if (foam && (cls === 'I' || cls === 'II')) codes.push('FOAM_CLASS_III_ONLY');

  const notes = ['Put the vapor retarder on the warm side of the insulation.'];
  if (foam) notes.push('This wall has exterior foam under 1 perm, so it dries only toward the inside.');
  return {
    ok: codes.length === 0,
    warnings: codes.map((code) => ({ code, text: WARNING_TEXT[code] })),
    notes,
    foam,
    source: SOURCE,
  };
}
