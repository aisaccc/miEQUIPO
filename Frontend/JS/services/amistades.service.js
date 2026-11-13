import { api } from '../api.js';

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
  return api.post(`/amistades/${amigoId}`, {});
}

export async function responderSolicitud(solicitanteId, accion) {
  return api.post(`/amistades/responder/${solicitanteId}`, { accion });
}

export async function eliminarAmistad(amigoId) {
  return api.delete(`/amistades/${amigoId}`);
}

export async function bloquearUsuario(usuarioId) {
  return api.post(`/amistades/bloquear/${usuarioId}`, {});
}

export async function desbloquearUsuario(usuarioId) {
  return api.delete(`/amistades/desbloquear/${usuarioId}`);
}
export async function listarBloqueados() {
  return await api.get('/amistades/bloqueados');
}
export async function generarLinkAmistad() {
  return api.get('/amistades/link');
}

export async function unirsePorLinkAmistad(token) {
  return api.post(`/amistades/link/${token}`, {});
}