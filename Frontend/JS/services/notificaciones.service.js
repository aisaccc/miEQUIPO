/* =========================================================
   notificaciones.service.js — Service de notificaciones del frontend
   =========================================================
   Consume los endpoints del backend:
   - GET    /api/notificaciones
   - GET    /api/notificaciones/no-leidas
   - PATCH  /api/notificaciones/:id/leida
   - PATCH  /api/notificaciones/leidas
   - DELETE /api/notificaciones/:id
   - DELETE /api/notificaciones/leidas
   */

import { api } from '../api.js';

/* =========================================================
   LISTAR
   =========================================================
   @param {object} filtros - { soloNoLeidas, tipo, page, limit }
   @returns {Promise<{ data: Array, meta: object }>}
*/
export async function listarNotificaciones(filtros = {}) {
  const params = new URLSearchParams();

  Object.entries(filtros).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      params.append(key, val);
    }
  });

  const qs = params.toString();
  const endpoint = qs ? `/notificaciones?${qs}` : '/notificaciones';

  return api.get(endpoint);
}

/* =========================================================
   CONTAR NO LEÍDAS (para badge)
   ========================================================= */
export async function contarNoLeidas() {
  const { total } = await api.get('/notificaciones/no-leidas');
  return total;
}

/* =========================================================
   MARCAR UNA COMO LEÍDA
   ========================================================= */
export async function marcarLeida(notificacionId) {
  return api.patch(`/notificaciones/${notificacionId}/leida`, {});
}

/* =========================================================
   MARCAR TODAS COMO LEÍDAS
   ========================================================= */
export async function marcarTodasLeidas() {
  return api.patch('/notificaciones/leidas', {});
}

/* =========================================================
   ELIMINAR UNA
   ========================================================= */
export async function eliminarNotificacion(notificacionId) {
  return api.delete(`/notificaciones/${notificacionId}`);
}

/* =========================================================
   ELIMINAR TODAS LAS LEÍDAS
   ========================================================= */
export async function eliminarLeidas() {
  return api.delete('/notificaciones/leidas');
}