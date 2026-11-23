import { api } from '../api.js';

// Notifica a los componentes de esta pestaña cuando una amistad cambia
// correctamente en el servidor. No requiere Socket.IO ni recargar la página.
function avisarCambioAmistad(accion, usuarioId = null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('roster:amistad-actualizada', {
    detail: { accion, usuarioId }
  }));
}

export async function listarAmigos() {
  const { amigos } = await api.get('/amistades');
  return amigos;
}

export async function listarSolicitudes() {
  const { solicitudes } = await api.get('/amistades/solicitudes');
  return solicitudes;
}

export async function obtenerEstado(otroId) {
  return api.get(`/amistades/estado/${otroId}`);
}

export async function enviarSolicitud(amigoId) {
  const resultado = await api.post(`/amistades/${amigoId}`, {});
  avisarCambioAmistad('enviar', amigoId);
  return resultado;
}

export async function responderSolicitud(solicitanteId, accion) {
  const resultado = await api.post(`/amistades/responder/${solicitanteId}`, { accion });
  avisarCambioAmistad(accion, solicitanteId);
  return resultado;
}

export async function eliminarAmistad(amigoId) {
  const resultado = await api.delete(`/amistades/${amigoId}`);
  avisarCambioAmistad('eliminar', amigoId);
  return resultado;
}

export async function bloquearUsuario(usuarioId) {
  const resultado = await api.post(`/amistades/bloquear/${usuarioId}`, {});
  avisarCambioAmistad('bloquear', usuarioId);
  return resultado;
}

export async function desbloquearUsuario(usuarioId) {
  const resultado = await api.delete(`/amistades/desbloquear/${usuarioId}`);
  avisarCambioAmistad('desbloquear', usuarioId);
  return resultado;
}
export async function listarBloqueados() {
  return await api.get('/amistades/bloqueados');
}
export async function generarLinkAmistad() {
  return api.get('/amistades/link');
}

export async function unirsePorLinkAmistad(token) {
  const resultado = await api.post(`/amistades/link/${token}`, {});
  avisarCambioAmistad('unirse');
  return resultado;
}