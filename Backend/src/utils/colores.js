/* =========================================================
   colores.js — Constantes compartidas de color de hero y marcos
   ========================================================= */

export const HERO_COLORS = [
  'navy', 'black', 'carbon', 'blue', 'forest',
  'purple', 'wine', 'coffee', 'mustard', 'red',
  'orange', 'white',
];

export const MARCOS_VALIDOS = [
  'default', 'oro', 'fuego', 'neon', 'hielo', 'galaxia', 'custom',
];

export const MARCOS_PREMIUM = ['oro', 'fuego', 'neon', 'hielo', 'galaxia', 'custom'];

/** ¿Es un color hex válido tipo #RRGGBB? */
export function esColorHex(val) {
  return typeof val === 'string' && /^#[0-9A-Fa-f]{6}$/.test(val);
}