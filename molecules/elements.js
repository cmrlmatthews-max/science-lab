// Element table for Science Lab, Stage 3 (Molecules and Crystals).
// Pure data: no DOM, no Three.js.
//
// Radius tables used:
//   covalent  - Cordero et al. 2008 covalent radii (Dalton Trans., single-bond values; carbon is the sp3 value 0.76,
//               iron is the low-spin value 1.32).
//   vdw       - Bondi 1964 van der Waals radii where Bondi lists the element (H, C, N, O, F, Na, Mg, Si, S, Cl, Cu, Zn),
//               Alvarez 2013 values for the rest (Al, Ca, Ti, Fe, Cs).
//   metallic  - standard metallic (12-coordinate-style) radii from the contract, in angstrom; null for non-metals.
// Atomic masses are IUPAC standard atomic weights (g/mol). Colors follow the CPK convention, softened a little so they
// read on both light and dark themes (the viewer adds a thin outline).

/** @typedef {{symbol:string,name:string,Z:number,mass:number,color:string,covalent:number,vdw:number,metallic:number|null}} Element */

/** @type {Record<string, Element>} */
export const ELEMENTS = {
  H:  { symbol: 'H',  name: 'Hydrogen',  Z: 1,  mass: 1.008,   color: '#f2f2f2', covalent: 0.31, vdw: 1.20, metallic: null },
  C:  { symbol: 'C',  name: 'Carbon',    Z: 6,  mass: 12.011,  color: '#555a60', covalent: 0.76, vdw: 1.70, metallic: null },
  N:  { symbol: 'N',  name: 'Nitrogen',  Z: 7,  mass: 14.007,  color: '#3050f8', covalent: 0.71, vdw: 1.55, metallic: null },
  O:  { symbol: 'O',  name: 'Oxygen',    Z: 8,  mass: 15.999,  color: '#e8312f', covalent: 0.66, vdw: 1.52, metallic: null },
  F:  { symbol: 'F',  name: 'Fluorine',  Z: 9,  mass: 18.998,  color: '#90e050', covalent: 0.57, vdw: 1.47, metallic: null },
  Na: { symbol: 'Na', name: 'Sodium',    Z: 11, mass: 22.990,  color: '#ab5cf2', covalent: 1.66, vdw: 2.27, metallic: 1.86 },
  Mg: { symbol: 'Mg', name: 'Magnesium', Z: 12, mass: 24.305,  color: '#2f9e2f', covalent: 1.41, vdw: 1.73, metallic: 1.60 },
  Al: { symbol: 'Al', name: 'Aluminum',  Z: 13, mass: 26.982,  color: '#bfa6a6', covalent: 1.21, vdw: 1.84, metallic: 1.43 },
  Si: { symbol: 'Si', name: 'Silicon',   Z: 14, mass: 28.085,  color: '#dab88b', covalent: 1.11, vdw: 2.10, metallic: null },
  S:  { symbol: 'S',  name: 'Sulfur',    Z: 16, mass: 32.06,   color: '#f2d22e', covalent: 1.05, vdw: 1.80, metallic: null },
  Cl: { symbol: 'Cl', name: 'Chlorine',  Z: 17, mass: 35.45,   color: '#2bd02b', covalent: 1.02, vdw: 1.75, metallic: null },
  Ca: { symbol: 'Ca', name: 'Calcium',   Z: 20, mass: 40.078,  color: '#8fa68f', covalent: 1.76, vdw: 2.31, metallic: 1.97 },
  Ti: { symbol: 'Ti', name: 'Titanium',  Z: 22, mass: 47.867,  color: '#a0a4aa', covalent: 1.60, vdw: 2.15, metallic: 1.47 },
  Fe: { symbol: 'Fe', name: 'Iron',      Z: 26, mass: 55.845,  color: '#e06633', covalent: 1.32, vdw: 2.04, metallic: 1.26 },
  Cu: { symbol: 'Cu', name: 'Copper',    Z: 29, mass: 63.546,  color: '#c88033', covalent: 1.32, vdw: 1.40, metallic: 1.28 },
  Zn: { symbol: 'Zn', name: 'Zinc',      Z: 30, mass: 65.38,   color: '#7d80b0', covalent: 1.22, vdw: 1.39, metallic: 1.34 },
  Cs: { symbol: 'Cs', name: 'Cesium',    Z: 55, mass: 132.905, color: '#57178f', covalent: 2.44, vdw: 3.43, metallic: 2.65 },
};
