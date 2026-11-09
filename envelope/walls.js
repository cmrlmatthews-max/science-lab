/**
 * Wall presets W1 to W4. Layers run interior to exterior and carry no air films.
 * A layer with `framing` is a cavity layer crossed by studs.
 */

/**
 * @typedef {Object} Framing
 * @property {'wood'|'steel'} type
 * @property {number} spacing  Stud spacing, inches on center.
 * @property {number} depth    Stud depth, inches.
 * @property {number} nominalR Nominal R of the batt in the cavity.
 */

/**
 * @typedef {Object} WallLayer
 * @property {string} materialId Key of MATERIALS.
 * @property {number} thickness  Inches.
 * @property {Framing} [framing]
 */

/**
 * @typedef {Object} Wall
 * @property {string} id
 * @property {string} name
 * @property {string} short
 * @property {WallLayer[]} layers
 */

/** @type {Record<string, Wall>} */
export const WALLS = {
  W1: {
    id: 'W1', name: 'Wood stud, base', short: '2x6 wood stud',
    layers: [
      { materialId: 'gyp_050', thickness: 0.5 },
      { materialId: 'batt_r21', thickness: 5.5, framing: { type: 'wood', spacing: 16, depth: 5.5, nominalR: 21 } },
      { materialId: 'osb', thickness: 0.4375 },
      { materialId: 'wrb', thickness: 0.03 },
      { materialId: 'fibercement', thickness: 0.3125 },
    ],
  },
  W2: {
    id: 'W2', name: 'Wood stud + 2" XPS', short: '2x6 + XPS',
    layers: [
      { materialId: 'gyp_050', thickness: 0.5 },
      { materialId: 'batt_r21', thickness: 5.5, framing: { type: 'wood', spacing: 16, depth: 5.5, nominalR: 21 } },
      { materialId: 'osb', thickness: 0.4375 },
      { materialId: 'wrb', thickness: 0.03 },
      { materialId: 'xps', thickness: 2 },
      { materialId: 'fibercement', thickness: 0.3125 },
    ],
  },
  W3: {
    id: 'W3', name: 'Steel stud, mineral wool, brick', short: 'Steel stud + brick',
    layers: [
      { materialId: 'gyp_063', thickness: 0.625 },
      { materialId: 'batt_r19', thickness: 6, framing: { type: 'steel', spacing: 16, depth: 6, nominalR: 19 } },
      { materialId: 'gyp_sheath', thickness: 0.625 },
      { materialId: 'wrb', thickness: 0.03 },
      { materialId: 'minwool', thickness: 2 },
      { materialId: 'airspace', thickness: 2 },
      { materialId: 'brick', thickness: 3.625 },
    ],
  },
  W4: {
    id: 'W4', name: 'CMU, XPS, brick', short: 'CMU + brick',
    layers: [
      { materialId: 'gyp_050', thickness: 0.5 },
      { materialId: 'cmu8', thickness: 7.625 },
      { materialId: 'wrb', thickness: 0.03 },
      { materialId: 'xps', thickness: 2 },
      { materialId: 'airspace', thickness: 2 },
      { materialId: 'brick', thickness: 3.625 },
    ],
  },
};

/**
 * Deep copy of a preset wall that is safe to edit.
 * @param {string} wallId One of 'W1' to 'W4'.
 * @returns {Wall}
 */
export function cloneWall(wallId) {
  const wall = WALLS[wallId];
  if (!wall) throw new Error(`Unknown wall: ${wallId}`);
  return structuredClone(wall);
}
