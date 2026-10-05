/* =========================================================
   id.js — Utilidades para comparar IDs de forma segura
   =========================================================
   Con el backend los IDs son UUID (string), pero los datos
   viejos en localStorage pueden tener números (Date.now()).
   Estas helpers normalizan a string para comparar SIEMPRE bien.

   Uso:
     import { mismoId, incluyeId, filtrarPorId } from '../utils/id.js';

     if (mismoId(user.id, grupo.capitanId)) { ... }
     if (incluyeId(partido.inscritos, user.id)) { ... }
     const restantes = filtrarPorId(partido.inscritos, user.id);
*/

/**
 * Compara dos IDs. Devuelve true si representan lo mismo.
 * Acepta mezcla de string/number.
 */
export function mismoId(a, b) {
  if (a === null || a === undefined) return false;
  if (b === null || b === undefined) return false;
  return String(a) === String(b);
}

/**
 * ¿La lista incluye este ID?
 * Funciona con arrays de strings, de números o mixtos.
 */
export function incluyeId(lista, id) {
  if (!Array.isArray(lista)) return false;
  return lista.some(x => mismoId(x, id));
}

/**
 * Devuelve la lista sin el ID dado.
 */
export function filtrarPorId(lista, id) {
  if (!Array.isArray(lista)) return [];
  return lista.filter(x => !mismoId(x, id));
}

/**
 * Busca en un array de objetos por propiedad id.
 * Ej: buscarPorId(usuarios, user.id)
 */
export function buscarPorId(lista, id, campo = 'id') {
  if (!Array.isArray(lista)) return null;
  return lista.find(x => mismoId(x[campo], id)) || null;
}

/**
 * Devuelve el índice del objeto en el array con ese ID, o -1.
 */
export function indicePorId(lista, id, campo = 'id') {
  if (!Array.isArray(lista)) return -1;
  return lista.findIndex(x => mismoId(x[campo], id));
}