import { api } from '../api.js';

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

export async function obtenerPartido(id) {
  const { partido } = await api.get(`/partidos/${id}`);
  return partido;
}

export async function crearPartido(datos) {
  const { partido } = await api.post('/partidos', datos);
  return partido;
}

export async function editarPartido(id, cambios) {
  const { partido } = await api.patch(`/partidos/${id}`, cambios);
  return partido;
}

export async function eliminarPartido(id) {
  return api.delete(`/partidos/${id}`);
}

export async function guardarPartido(id) {
  return api.patch(`/partidos/${id}/guardar`, {});
}

export async function inscribirse(id, posicion = null) {
  const { partido } = await api.post(`/partidos/${id}/inscribirse`, {
    posicion: posicion || null,
  });
  return partido;
}

export async function salirDelPartido(id) {
  return api.delete(`/partidos/${id}/inscribirse`);
}

// Para la vista de un equipo inscrito o interesado: solo capitan/admin.
export async function salirEquipoDelPartido(partidoId, equipoId) {
  return api.delete(`/partidos/${partidoId}/salir-equipo/${equipoId}`);
}

export async function postularse(id, posicion = null) {
  const { partido } = await api.post(`/partidos/${id}/postularse`, {
    posicion: posicion || null,
  });
  return partido;
}

export async function cancelarPostulacion(id) {
  return api.delete(`/partidos/${id}/postularse`);
}

export async function gestionarPostulante(partidoId, postulanteId, accion) {
  return api.patch(`/partidos/${partidoId}/postulantes/${postulanteId}`, {
    accion,
  });
}

export async function postularEquipo(partidoId, equipoId) {
  const { partido } = await api.post(`/partidos/${partidoId}/equipos-postulantes`, {
    equipoId,
  });
  return partido;
}

export async function gestionarEquipoPostulante(partidoId, equipoId, accion) {
  return api.patch(
    `/partidos/${partidoId}/equipos-postulantes/${equipoId}`,
    { accion }
  );
}

export async function cancelarPostulacionEquipo(partidoId, equipoId) {
  return api.delete(`/partidos/${partidoId}/equipos-postulantes/${equipoId}`);
}

export async function interesarse(partidoId, equipoId = null, mensaje = null) {
  const { partido } = await api.post(`/partidos/${partidoId}/interesarse`, {
    mensaje: mensaje || null,
    equipoId: equipoId || null,
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

export async function echarInscrito(partidoId, usuarioId) {
  return api.delete(`/partidos/${partidoId}/inscritos/${usuarioId}`);
}

export async function echarInteresado(partidoId, usuarioId) {
  return api.delete(`/partidos/${partidoId}/interesados/${usuarioId}`);
}

export async function echarEquipoInscrito(partidoId, equipoId) {
  return api.delete(`/partidos/${partidoId}/equipos-inscritos/${equipoId}`);
}

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