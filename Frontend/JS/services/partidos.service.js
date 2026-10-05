/* =========================================================
   partidos.service.js — Service de partidos del frontend
   =========================================================
   Consume los endpoints del backend:
   - GET    /api/partidos
   - GET    /api/partidos/:id
   - POST   /api/partidos
   - PATCH  /api/partidos/:id
   - DELETE /api/partidos/:id
   - POST   /api/partidos/:id/inscribirse
   - DELETE /api/partidos/:id/inscribirse
   - POST   /api/partidos/:id/postularse
   - DELETE /api/partidos/:id/postularse
   - PATCH  /api/partidos/:id/postulantes/:usuarioId
   - POST   /api/partidos/:id/equipos-postulantes
   - PATCH  /api/partidos/:id/equipos-postulantes/:equipoId
   - POST   /api/partidos/:id/interesarse           (modo Organizar)
   - DELETE /api/partidos/:id/interesarse           (modo Organizar)
   - GET    /api/partidos/:id/interesados           (modo Organizar)
   - PATCH  /api/partidos/:id/confirmar             (modo Organizar)
*/

import { api } from '../api.js';

/* =========================================================
   LISTAR
   =========================================================
   @param {object} filtros - { deporte, tipo, estado, nivel, soloMios, soloInscritos, busqueda, page, limit }
   @returns {Promise<{ data: Array, meta: object }>}
*/
export async function listarPartidos(filtros = {}) {
  const params = new URLSearchParams();

  Object.entries(filtros).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      params.append(key, val);
    }
  });

  const qs = params.toString();
  const endpoint = qs ? `/partidos?${qs}` : '/partidos';

  return api.get(endpoint);
}

/* =========================================================
   OBTENER UNO
   =========================================================
   @returns {Promise<object>} partido completo con inscritos, etc.
*/
export async function obtenerPartido(id) {
  const { partido } = await api.get(`/partidos/${id}`);
  return partido;
}

/* =========================================================
   CREAR
   =========================================================
   @param {object} datos - { titulo, deporte, lugar, fecha, cupos, ..., estadoPartido }
   @returns {Promise<object>} partido creado
*/
export async function crearPartido(datos) {
  const { partido } = await api.post('/partidos', datos);
  return partido;
}

/* =========================================================
   EDITAR
   =========================================================
   @param {string} id - UUID del partido
   @param {object} cambios - { titulo, lugar, fecha, cupos, precio, descripcion }
*/
export async function editarPartido(id, cambios) {
  const { partido } = await api.patch(`/partidos/${id}`, cambios);
  return partido;
}

/* =========================================================
   ELIMINAR (soft delete)
   =========================================================
*/
export async function eliminarPartido(id) {
  return api.delete(`/partidos/${id}`);
}

/* =========================================================
   INSCRIBIRSE
   =========================================================
   @param {string} id - UUID del partido
   @param {string|null} posicion
*/
export async function inscribirse(id, posicion = null) {
  const { partido } = await api.post(`/partidos/${id}/inscribirse`, {
    posicion: posicion || null,
  });
  return partido;
}

/* =========================================================
   SALIR DEL PARTIDO
   =========================================================
*/
export async function salirDelPartido(id) {
  return api.delete(`/partidos/${id}/inscribirse`);
}

/* =========================================================
   POSTULARSE (partidos con aprobación)
   =========================================================
*/
export async function postularse(id, posicion = null) {
  const { partido } = await api.post(`/partidos/${id}/postularse`, {
    posicion: posicion || null,
  });
  return partido;
}

/* =========================================================
   CANCELAR POSTULACIÓN
   =========================================================
*/
export async function cancelarPostulacion(id) {
  return api.delete(`/partidos/${id}/postularse`);
}

/* =========================================================
   APROBAR / RECHAZAR POSTULANTE (organizador)
   =========================================================
   @param {string} accion - "aprobar" | "rechazar"
*/
export async function gestionarPostulante(partidoId, postulanteId, accion) {
  return api.patch(`/partidos/${partidoId}/postulantes/${postulanteId}`, {
    accion,
  });
}

/* =========================================================
   POSTULAR EQUIPO (a partido de equipos)
   =========================================================
*/
export async function postularEquipo(partidoId, equipoId) {
  const { partido } = await api.post(`/partidos/${partidoId}/equipos-postulantes`, {
    equipoId,
  });
  return partido;
}

/* =========================================================
   APROBAR / RECHAZAR EQUIPO POSTULANTE (organizador)
   =========================================================
*/
export async function gestionarEquipoPostulante(partidoId, equipoId, accion) {
  return api.patch(
    `/partidos/${partidoId}/equipos-postulantes/${equipoId}`,
    { accion }
  );
}

/* =========================================================
   CANCELAR POSTULACIÓN DE EQUIPO (el propio capitán)
   =========================================================
   @param {string} partidoId
   @param {string} equipoId
*/
export async function cancelarPostulacionEquipo(partidoId, equipoId) {
  return api.delete(`/partidos/${partidoId}/equipos-postulantes/${equipoId}`);
}

/* =========================================================
   MODO "ORGANIZAR PARTIDO"
   =========================================================
   Cuando un partido está en estado_partido = 'buscando_jugadores',
   los usuarios marcan "Me interesa" en vez de inscribirse.
*/

/* ---------- MARCAR "ME INTERESA" ---------- */
export async function interesarse(partidoId, mensaje = null) {
  const { partido } = await api.post(`/partidos/${partidoId}/interesarse`, {
    mensaje: mensaje || null,
  });
  return partido;
}

/* ---------- CANCELAR INTERÉS ---------- */
export async function cancelarInteres(partidoId) {
  return api.delete(`/partidos/${partidoId}/interesarse`);
}

/* ---------- LISTAR INTERESADOS (solo organizador) ---------- */
export async function listarInteresados(partidoId) {
  const { interesados } = await api.get(`/partidos/${partidoId}/interesados`);
  return interesados;
}

/* ---------- CONFIRMAR PARTIDO (organizador propone) ---------- */
export async function confirmarPartido(partidoId, datos) {
  const { partido } = await api.patch(`/partidos/${partidoId}/confirmar`, datos);
  return partido;
}
/* =========================================================
   FLUJO DE DOBLE CONFIRMACIÓN (modo Organizar)
   =========================================================
   Cuando el organizador propone confirmar, se crea una
   propuesta que el interesado debe aprobar o rechazar.
   */

/* ---------- APROBAR CONFIRMACIÓN (el interesado acepta) ---------- */
export async function aprobarConfirmacion(partidoId, propuestaId) {
  return api.post(
    `/partidos/${partidoId}/confirmaciones/${propuestaId}/aprobar`,
    {}
  );
}

/* ---------- RECHAZAR CONFIRMACIÓN (el interesado rechaza) ---------- */
export async function rechazarConfirmacion(partidoId, propuestaId) {
  return api.post(
    `/partidos/${partidoId}/confirmaciones/${propuestaId}/rechazar`,
    {}
  );
}

/* ---------- CANCELAR CONFIRMACIÓN (el organizador cancela) ---------- */
export async function cancelarConfirmacion(partidoId, propuestaId) {
  return api.delete(
    `/partidos/${partidoId}/confirmaciones/${propuestaId}`
  );
}

/* ---------- OBTENER CONFIRMACIÓN PENDIENTE ---------- */
export async function obtenerConfirmacionPendiente(partidoId) {
  const { confirmacion } = await api.get(
    `/partidos/${partidoId}/confirmacion-pendiente`
  );
  return confirmacion;
}

/* ---------- HISTORIAL DE PARTIDOS (para el perfil) ---------- */
export async function obtenerHistorialPartidos(filtros = {}) {
  const params = new URLSearchParams();

  Object.entries(filtros).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      params.append(key, val);
    }
  });

  const qs = params.toString();
  const endpoint = qs
    ? `/usuarios/me/historial-partidos?${qs}`
    : '/usuarios/me/historial-partidos';

  const resultado = await api.get(endpoint);

  // El backend devuelve { data, meta }. Mantenemos compatibilidad
  // devolviendo la data y el meta por separado.
  return resultado;
}