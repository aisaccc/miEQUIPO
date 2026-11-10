/* =========================================================
   grupos.service.js — Service de grupos del frontend
   =========================================================
   Grupos = equipos + comunidades
   
   Endpoints:
   - GET    /api/grupos
   - GET    /api/grupos/:id
   - POST   /api/grupos
   - PATCH  /api/grupos/:id
   - PATCH  /api/grupos/:id/stats
   - DELETE /api/grupos/:id
   - POST   /api/grupos/:id/unirse
   - DELETE /api/grupos/:id/salir
   - DELETE /api/grupos/:id/mi-solicitud
   - GET    /api/grupos/:id/miembros
   - DELETE /api/grupos/:id/miembros/:usuarioId
   - PATCH  /api/grupos/:id/miembros/:usuarioId/rol
   - GET    /api/grupos/:id/solicitudes
   - PATCH  /api/grupos/:id/solicitudes/:usuarioId
*/

import { api } from '../api.js';

/* =========================================================
   LISTAR
   =========================================================
   @param {object} filtros - { tipo, deporte, ciudad, tipoAcceso, soloMios, busqueda, page, limit }
   @returns {Promise<{ data: Array, meta: object }>}
*/
export async function listarGrupos(filtros = {}) {
  const params = new URLSearchParams();

  Object.entries(filtros).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      params.append(key, val);
    }
  });

  const qs = params.toString();
  const endpoint = qs ? `/grupos?${qs}` : '/grupos';

  return api.get(endpoint);
}

/* =========================================================
   OBTENER UNO
   ========================================================= */
export async function obtenerGrupo(id) {
  const { grupo } = await api.get(`/grupos/${id}`);
  return grupo;
}

/* =========================================================
   CREAR
   =========================================================
   @param {object} datos - { tipo, nombre, escudo, deporte, ciudad, descripcion, tipoAcceso }
*/
export async function crearGrupo(datos) {
  const { grupo } = await api.post('/grupos', datos);
  return grupo;
}

/* =========================================================
   EDITAR
   =========================================================
   @param {object} cambios - { nombre, escudo, deporte, ciudad, descripcion, tipoAcceso, statsPrivadas }
*/
export async function editarGrupo(id, cambios) {
  const { grupo } = await api.patch(`/grupos/${id}`, cambios);
  return grupo;
}

/* =========================================================
   EDITAR STATS
   =========================================================
   @param {object} stats - { victorias, empates, derrotas }
*/
export async function editarStats(id, stats) {
  const { grupo } = await api.patch(`/grupos/${id}/stats`, stats);
  return grupo;
}

/* =========================================================
   ELIMINAR
   ========================================================= */
export async function eliminarGrupo(id) {
  return api.delete(`/grupos/${id}`);
}

/* =========================================================
   UNIRSE
   =========================================================
   Devuelve { ok, tipo: 'solicitud' | 'inscripcion', mensaje }
*/
export async function unirseAGrupo(id) {
  return api.post(`/grupos/${id}/unirse`, {});
}

/* =========================================================
   SALIR
   ========================================================= */
export async function salirDeGrupo(id) {
  return api.delete(`/grupos/${id}/salir`);
}

/* =========================================================
   CANCELAR MI SOLICITUD
   ========================================================= */
export async function cancelarMiSolicitud(id) {
  return api.delete(`/grupos/${id}/mi-solicitud`);
}

/* =========================================================
   LISTAR MIEMBROS
   ========================================================= */
export async function listarMiembros(id) {
  const { miembros } = await api.get(`/grupos/${id}/miembros`);
  return miembros;
}

/* =========================================================
   EXPULSAR MIEMBRO (capitán/admin)
   ========================================================= */
export async function expulsarMiembro(grupoId, usuarioId) {
  return api.delete(`/grupos/${grupoId}/miembros/${usuarioId}`);
}

/* =========================================================
   CAMBIAR ROL (capitán)
   =========================================================
   @param {string} rol - 'admin' | 'miembro'
*/
export async function cambiarRolMiembro(grupoId, usuarioId, rol) {
  return api.patch(`/grupos/${grupoId}/miembros/${usuarioId}/rol`, { rol });
}

/* =========================================================
   LISTAR SOLICITUDES (capitán/admin)
   ========================================================= */
export async function listarSolicitudes(id) {
  const { solicitudes } = await api.get(`/grupos/${id}/solicitudes`);
  return solicitudes;
}

/* =========================================================
   GESTIONAR SOLICITUD (capitán/admin)
   =========================================================
   @param {string} accion - 'aprobar' | 'rechazar'
*/
export async function gestionarSolicitud(grupoId, usuarioId, accion) {
  return api.patch(`/grupos/${grupoId}/solicitudes/${usuarioId}`, { accion });
}
/* =========================================================
   STATS POR JUGADOR
   ========================================================= */
export async function editarStatsJugador(grupoId, usuarioId, stats) {
  return api.patch(`/grupos/${grupoId}/miembros/${usuarioId}/stats`, { stats });
}

/* =========================================================
   FORMACIÓN
   ========================================================= */
export async function editarFormacion(grupoId, formacion) {
  return api.patch(`/grupos/${grupoId}/formacion`, { formacion });
}