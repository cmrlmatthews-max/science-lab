/**
 * Material library for Envelope Lab.
 * Pure data and two lookup helpers. Units: inches, h·ft²·°F/Btu (R), perms.
 *
 * A material gives R either as `rFixed` (for its stated thickness) or as `rPerInch`.
 * It gives permeance either as `permFixed` (perms at its stated thickness) or as
 * `permInch` (perm·inch, divided by thickness to get perms). Values that do not
 * come from BCI 7.45 carry `permSource: 'approximate'`.
 */

/**
 * @typedef {Object} Material
 * @property {string} id            Same as the key in MATERIALS.
 * @property {string} name          Display name.
 * @property {number} [rFixed]      R for the stated thickness.
 * @property {number} [rPerInch]    R per inch of thickness.
 * @property {number|null} thickness        Default thickness in inches (null for framing members).
 * @property {number[]|null} thicknessOptions  Allowed thicknesses when the user can change it.
 * @property {number|null} permInch         Perm·inch, or null.
 * @property {number|null} permFixed        Perms at the stated thickness, or null.
 * @property {string|null} permSource       'approximate', a code section, or null when no perm applies.
 * @property {string} color         Base color for 3D and legend (hex).
 * @property {'finish'|'structure'|'thermal'|'water'|'air'|'vapor'|'cladding'|'airspace'} control
 * @property {'board'|'batt'|'rigid'|'masonry'|'membrane'|'cladding'|'airspace'|'framing'} category
 * @property {string} source        Short source tag shown in the UI.
 */

const OPTIONS_BOARD = [1, 1.5, 2, 3, 4];

/** @type {Record<string, Material>} */
export const MATERIALS = {
  gyp_050: {
    id: 'gyp_050', name: 'Gypsum board, 1/2"',
    rFixed: 0.45, thickness: 0.5, thicknessOptions: null,
    permInch: null, permFixed: 50, permSource: 'approximate',
    color: '#e3dccb', control: 'finish', category: 'board', source: 'BCI 7.40',
  },
  gyp_063: {
    id: 'gyp_063', name: 'Gypsum board, 5/8"',
    rFixed: 0.56, thickness: 0.625, thicknessOptions: null,
    permInch: null, permFixed: 40, permSource: 'approximate',
    color: '#c9bb94', control: 'finish', category: 'board', source: 'Archtoolbox',
  },
  gyp_sheath: {
    id: 'gyp_sheath', name: 'Exterior gypsum sheathing, 5/8"',
    rFixed: 0.56, thickness: 0.625, thicknessOptions: null,
    permInch: null, permFixed: 40, permSource: 'approximate',
    color: '#7fa36b', control: 'structure', category: 'board', source: 'Archtoolbox',
  },
  osb: {
    id: 'osb', name: 'OSB sheathing, 7/16"',
    rFixed: 0.62, thickness: 0.4375, thicknessOptions: null,
    permInch: null, permFixed: 2, permSource: 'approximate',
    color: '#dba44f', control: 'structure', category: 'board', source: 'Archtoolbox',
  },
  plywood: {
    id: 'plywood', name: 'Plywood, 1/2"',
    rFixed: 0.62, thickness: 0.5, thicknessOptions: null,
    permInch: null, permFixed: 1, permSource: 'approximate',
    color: '#a9672e', control: 'structure', category: 'board', source: 'BCI 7.40',
  },
  batt_r13: {
    id: 'batt_r13', name: 'Fiberglass batt R-13',
    rFixed: 13, thickness: 3.5, thicknessOptions: null,
    permInch: null, permFixed: 30, permSource: 'approximate',
    color: '#f7d23e', control: 'thermal', category: 'batt', source: 'Archtoolbox',
  },
  batt_r19: {
    id: 'batt_r19', name: 'Fiberglass batt R-19',
    rFixed: 19, thickness: 6, thicknessOptions: null,
    permInch: null, permFixed: 30, permSource: 'approximate',
    color: '#f5a3b8', control: 'thermal', category: 'batt', source: 'Archtoolbox',
  },
  batt_r21: {
    id: 'batt_r21', name: 'Fiberglass batt R-21',
    rFixed: 21, thickness: 5.5, thicknessOptions: null,
    permInch: null, permFixed: 30, permSource: 'approximate',
    color: '#ee6f9b', control: 'thermal', category: 'batt', source: 'Archtoolbox',
  },
  minwool: {
    id: 'minwool', name: 'Mineral wool board',
    rPerInch: 4.0, thickness: 2, thicknessOptions: OPTIONS_BOARD,
    permInch: 30, permFixed: null, permSource: 'approximate',
    color: '#8a7a3a', control: 'thermal', category: 'rigid', source: 'Archtoolbox',
  },
  xps: {
    id: 'xps', name: 'XPS board',
    rPerInch: 5.0, thickness: 2, thicknessOptions: OPTIONS_BOARD,
    permInch: 1.2, permFixed: null, permSource: 'BCI 7.45',
    color: '#2f7de1', control: 'thermal', category: 'rigid', source: 'Archtoolbox · BCI 7.45',
  },
  eps: {
    id: 'eps', name: 'EPS board',
    rPerInch: 3.8, thickness: 2, thicknessOptions: OPTIONS_BOARD,
    permInch: 2.0, permFixed: null, permSource: 'BCI 7.45',
    color: '#5fc7d9', control: 'thermal', category: 'rigid', source: 'Archtoolbox · BCI 7.45',
  },
  polyiso: {
    id: 'polyiso', name: 'Polyiso board, foil face',
    rPerInch: 6.0, thickness: 2, thicknessOptions: OPTIONS_BOARD,
    permInch: null, permFixed: 0.05, permSource: 'approximate',
    color: '#9aa5b8', control: 'thermal', category: 'rigid', source: 'Archtoolbox',
  },
  ccspf: {
    id: 'ccspf', name: 'Closed-cell spray foam',
    rPerInch: 6.0, thickness: 2, thicknessOptions: [1, 2, 3],
    permInch: 1.0, permFixed: null, permSource: 'approximate',
    color: '#ff7a2f', control: 'thermal', category: 'rigid', source: 'Archtoolbox',
  },
  airspace: {
    id: 'airspace', name: 'Air space',
    rFixed: 0.97, thickness: 2, thicknessOptions: [1, 2, 3],
    permInch: null, permFixed: null, permSource: null,
    color: '#bfe3f2', control: 'airspace', category: 'airspace', source: 'Archtoolbox',
  },
  wrb: {
    id: 'wrb', name: 'Water-resistive barrier',
    rFixed: 0, thickness: 0.03, thicknessOptions: null,
    permInch: null, permFixed: 30, permSource: 'approximate',
    color: '#7fe0d2', control: 'water', category: 'membrane', source: '—',
  },
  brick: {
    id: 'brick', name: 'Face brick, 3-5/8"',
    rPerInch: 0.11, thickness: 3.625, thicknessOptions: null,
    permInch: null, permFixed: 0.8, permSource: 'approximate',
    color: '#b5382a', control: 'cladding', category: 'masonry', source: 'BCI 7.40',
  },
  cmu8: {
    id: 'cmu8', name: 'CMU, 8"',
    rFixed: 1.11, thickness: 7.625, thicknessOptions: null,
    permInch: null, permFixed: 2.4, permSource: 'approximate',
    color: '#8a8d91', control: 'structure', category: 'masonry', source: 'BCI 7.40',
  },
  concrete: {
    id: 'concrete', name: 'Concrete, sand and gravel',
    rPerInch: 0.08, thickness: 8, thicknessOptions: [6, 8, 10, 12],
    permInch: 3.2, permFixed: null, permSource: 'approximate',
    color: '#5f6368', control: 'structure', category: 'masonry', source: 'BCI 7.40',
  },
  fibercement: {
    id: 'fibercement', name: 'Fiber-cement siding',
    rFixed: 0.15, thickness: 0.3125, thicknessOptions: null,
    permInch: null, permFixed: 1.5, permSource: 'approximate',
    color: '#6d8fa8', control: 'cladding', category: 'cladding', source: 'Archtoolbox',
  },
  vinyl: {
    id: 'vinyl', name: 'Vinyl siding',
    rFixed: 1.0, thickness: 0.5, thicknessOptions: null,
    permInch: null, permFixed: 70, permSource: 'approximate',
    color: '#e8d9a8', control: 'cladding', category: 'cladding', source: 'BCI 7.40',
  },
  stucco: {
    id: 'stucco', name: 'Stucco, 7/8"',
    rFixed: 0.18, thickness: 0.875, thicknessOptions: null,
    permInch: null, permFixed: 5, permSource: 'approximate',
    color: '#c9b79c', control: 'cladding', category: 'cladding', source: 'not checked',
  },
  softwood: {
    id: 'softwood', name: 'Softwood framing',
    rPerInch: 1.25, thickness: null, thicknessOptions: null,
    permInch: null, permFixed: null, permSource: null,
    color: '#9c6b3c', control: 'structure', category: 'framing', source: 'BCI 7.40',
  },
  steel: {
    id: 'steel', name: 'Steel',
    rPerInch: 0.0032, thickness: null, thicknessOptions: null,
    permInch: null, permFixed: null, permSource: null,
    color: '#4a5560', control: 'structure', category: 'framing', source: 'BCI 7.40',
  },
  aluminum: {
    id: 'aluminum', name: 'Aluminum',
    rPerInch: 0.0007, thickness: null, thicknessOptions: null,
    permInch: null, permFixed: null, permSource: null,
    color: '#b8c0c8', control: 'structure', category: 'framing', source: 'BCI 7.40',
  },
};

/** Surface air film resistances, h·ft²·°F/Btu. */
export const FILMS = {
  interior: { r: 0.68, source: 'Archtoolbox' },
  exteriorWinter: { r: 0.17, source: 'Archtoolbox' },
  exteriorSummer: { r: 0.25, source: 'Archtoolbox' },
};

/**
 * Effective R of a steel-stud cavity layer that already counts the studs.
 * Key: `${depth}|${nominalR}|${spacing}` (depth 3.5 or 6, spacing in inches o.c.).
 */
export const STEEL_STUD_EFFECTIVE_R = {
  '3.5|11|16': 5.5, '3.5|13|16': 6.0, '3.5|15|16': 6.4,
  '3.5|11|24': 6.6, '3.5|13|24': 7.2, '3.5|15|24': 7.8,
  '6|19|16': 7.1, '6|21|16': 7.4, '6|19|24': 8.6, '6|21|24': 9.0,
};
/** Source tag for STEEL_STUD_EFFECTIVE_R. */
export const STEEL_STUD_SOURCE = 'ASHRAE 90.1 App. A (via Masonry Advisory Council)';

/** Share of the wall area taken by wood framing, by stud spacing in inches. */
export const WOOD_FRAMING_FACTOR = { 16: 0.25, 24: 0.22 };
/** Source tag for WOOD_FRAMING_FACTOR. */
export const WOOD_FRAMING_SOURCE = 'ASHRAE typical (not checked)';

/**
 * Use the given thickness when it is a usable number, else the material default.
 * @param {Material} mat
 * @param {number} [thickness]
 * @returns {number}
 */
function usableThickness(mat, thickness) {
  if (Number.isFinite(thickness) && thickness >= 0) return thickness;
  return mat.thickness ?? 0;
}

/**
 * Thermal resistance of a material layer.
 * @param {string} materialId Key of MATERIALS. An unknown id gives 0.
 * @param {number} [thickness] Inches. Ignored for materials with a fixed R.
 * @returns {number} R in h·ft²·°F/Btu
 */
export function materialR(materialId, thickness) {
  const mat = MATERIALS[materialId];
  if (!mat) return 0;
  if (mat.rFixed != null) return mat.rFixed;
  return mat.rPerInch * usableThickness(mat, thickness);
}

/**
 * Water vapor permeance of a material layer.
 * @param {string} materialId Key of MATERIALS.
 * @param {number} [thickness] Inches. Used only for perm·inch materials.
 * @returns {number|null} Perms, or null when the material has no permeance (air space, framing).
 */
export function materialPerms(materialId, thickness) {
  const mat = MATERIALS[materialId];
  if (!mat) return null;
  if (mat.permFixed != null) return mat.permFixed;
  if (mat.permInch == null) return null;
  const t = usableThickness(mat, thickness);
  return t > 0 ? mat.permInch / t : null;
}
