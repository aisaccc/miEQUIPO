/* =========================================================
   partidos.service.js — Service de partidos del frontend
   ========================================================= */

import { api } from '../api.js';

/* =========================================================
   LISTAR
   ========================================================= */
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
   ========================================================= */
export async function obtenerPartido(id) {
  const { partido } = await api.get(`/partidos/${id}`);
  return partido;
}

/* =========================================================
   CREAR
   ========================================================= */
export async function crearPartido(datos) {
  const { partido } = await api.post('/partidos', datos);
  return partido;
}

/* =========================================================
   EDITAR
   ========================================================= */
export async function editarPartido(id, cambios) {
  const { partido } = await api.patch(`/partidos/${id}`, cambios);
  return partido;
}

/* =========================================================
   ELIMINAR
   ========================================================= */
export async function eliminarPartido(id) {
  return api.delete(`/partidos/${id}`);
}

/* =========================================================
   INSCRIBIRSE
   ========================================================= */
export async function inscribirse(id, posicion = null) {
  const { partido } = await api.post(`/partidos/${id}/inscribirse`, {
    posicion: posicion || null,
  });
  return partido;
}

/* =========================================================
   SALIR DEL PARTIDO
   ========================================================= */
export async function salirDelPartido(id) {
  return api.delete(`/partidos/${id}/inscribirse`);
}

/* =========================================================
   POSTULARSE
   ========================================================= */
export async function postularse(id, posicion = null) {
  const { partido } = await api.post(`/partidos/${id}/postularse`, {
    posicion: posicion || null,
  });
  return partido;
}

/* =========================================================
   CANCELAR POSTULACIÓN
   ========================================================= */
export async function cancelarPostulacion(id) {
  return api.delete(`/partidos/${id}/postularse`);
}

/* =========================================================
   APROBAR / RECHAZAR POSTULANTE (organizador)
   ========================================================= */
export async function gestionarPostulante(partidoId, postulanteId, accion) {
  return api.patch(`/partidos/${partidoId}/postulantes/${postulanteId}`, {
    accion,
  });
}

/* =========================================================
   POSTULAR EQUIPO
   ========================================================= */
export async function postularEquipo(partidoId, equipoId) {
  const { partido } = await api.post(`/partidos/${partidoId}/equipos-postulantes`, {
    equipoId,
  });
  return partido;
}

/* =========================================================
   APROBAR / RECHAZAR EQUIPO POSTULANTE (organizador)
   ========================================================= */
export async function gestionarEquipoPostulante(partidoId, equipoId, accion) {
  return api.patch(
    `/partidos/${partidoId}/equipos-postulantes/${equipoId}`,
    { accion }
  );
}

/* =========================================================
   CANCELAR POSTULACIÓN DE EQUIPO
   ========================================================= */
export async function cancelarPostulacionEquipo(partidoId, equipoId) {
  return api.delete(`/partidos/${partidoId}/equipos-postulantes/${equipoId}`);
}

/* =========================================================
   MODO "ORGANIZAR PARTIDO"
   ========================================================= */

export async function interesarse(partidoId, mensaje = null) {
  const { partido } = await api.post(`/partidos/${partidoId}/interesarse`, {
    mensaje: mensaje || null,
  });
  return partido;
}

export async function cancelarInteres(partidoId) {
  return api.delete(`/partidos/${partidoId}/interesarse`);
}

export async function listarInteresados(partidoId) {
  const { interesados } = await api.get(`/partidos/${partidoId}/interesados`);
  return interesados;
}

export async function confirmarPartido(partidoId, datos) {
  const { partido } = await api.patch(`/partidos/${partidoId}/confirmar`, datos);
  return partido;
}

/* =========================================================
   FLUJO DE DOBLE CONFIRMACIÓN
   ========================================================= */

export async function aprobarConfirmacion(partidoId, propuestaId) {
  return api.post(
    `/partidos/${partidoId}/confirmaciones/${propuestaId}/aprobar`,
    {}
  );
}

export async function rechazarConfirmacion(partidoId, propuestaId) {
  return api.post(
    `/partidos/${partidoId}/confirmaciones/${propuestaId}/rechazar`,
    {}
  );
}

export async function cancelarConfirmacion(partidoId, propuestaId) {
  return api.delete(
    `/partidos/${partidoId}/confirmaciones/${propuestaId}`
  );
}

export async function obtenerConfirmacionPendiente(partidoId) {
  const { confirmacion } = await api.get(
    `/partidos/${partidoId}/confirmacion-pendiente`
  );
  return confirmacion;
}

/* =========================================================
   ⚡ ECHAR PARTICIPANTES (solo organizador)
   ========================================================= */

export async function echarInscrito(partidoId, usuarioId) {
  return api.delete(`/partidos/${partidoId}/inscritos/${usuarioId}`);
}

export async function echarInteresado(partidoId, usuarioId) {
  return api.delete(`/partidos/${partidoId}/interesados/${usuarioId}`);
}

export async function echarEquipoInscrito(partidoId, equipoId) {
  return api.delete(`/partidos/${partidoId}/equipos-inscritos/${equipoId}`);
}

/* =========================================================
   HISTORIAL DE PARTIDOS
   ========================================================= */
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

  return resultado;
}