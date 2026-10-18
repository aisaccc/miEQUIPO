/* =========================================================
   mensajes.service.js — Service de mensajería del frontend
   =========================================================
   Consume:
   - GET    /api/mensajes/no-leidos
   - GET    /api/mensajes/conversaciones
   - POST   /api/mensajes/conversaciones
   - GET    /api/mensajes/conversaciones/:id
   - DELETE /api/mensajes/conversaciones/:id
   - GET    /api/mensajes/conversaciones/:id/mensajes
   - POST   /api/mensajes/conversaciones/:id/mensajes
   - PATCH  /api/mensajes/conversaciones/:id/leidos
   - GET    /api/mensajes/canales
   - GET    /api/mensajes/canales/:id
   - GET    /api/mensajes/canales/:id/mensajes
   - POST   /api/mensajes/canales/:id/mensajes
   - PATCH  /api/mensajes/canales/:id/leidos
   */

import { api } from '../api.js';

/* =========================================================
   NO LEÍDOS (para el badge del header)
   ========================================================= */
export async function contarNoLeidos() {
  const { total } = await api.get('/mensajes/no-leidos');
  return total;
}

/* =========================================================
   CONVERSACIONES 1 A 1
   ========================================================= */

export async function listarConversaciones() {
  const { conversaciones } = await api.get('/mensajes/conversaciones');
  return conversaciones;
}

export async function obtenerConversacion(id) {
  const { conversacion } = await api.get(`/mensajes/conversaciones/${id}`);
  return conversacion;
}

export async function crearConversacion(usuarioId, opciones = {}) {
  const { conversacion } = await api.post('/mensajes/conversaciones', {
    usuarioId,
    vinculadaTipo: opciones.vinculadaTipo || null,
    vinculadaId: opciones.vinculadaId || null,
    vinculadaNombre: opciones.vinculadaNombre || null,
  });
  return conversacion;
}

export async function ocultarConversacion(conversacionId) {
  return api.delete(`/mensajes/conversaciones/${conversacionId}`);
}

export async function listarMensajes(conversacionId, limit = 100) {
  const { mensajes } = await api.get(
    `/mensajes/conversaciones/${conversacionId}/mensajes?limit=${limit}`
  );
  return mensajes;
}

/**
 * Enviar mensaje 1 a 1.
 * @param {string} conversacionId
 * @param {string|null} texto
 * @param {string|null} imagen - dataURL o URL (opcional)
 */
export async function enviarMensaje(conversacionId, texto, imagen = null) {
  const payload = {};

  if (texto && String(texto).trim()) payload.texto = String(texto).trim();
  if (imagen) payload.imagen = imagen;

  const { data } = await api.post(
    `/mensajes/conversaciones/${conversacionId}/mensajes`,
    payload
  );
  return data;
}

export async function marcarLeidos(conversacionId) {
  return api.patch(`/mensajes/conversaciones/${conversacionId}/leidos`, {});
}

/* =========================================================
   CANALES (equipos + torneos)
   ========================================================= */

export async function listarCanales() {
  const { canales } = await api.get('/mensajes/canales');
  return canales;
}

export async function obtenerCanal(canalId) {
  const { canal } = await api.get(`/mensajes/canales/${canalId}`);
  return canal;
}

export async function listarMensajesDeCanal(canalId, limit = 100) {
  const { mensajes } = await api.get(
    `/mensajes/canales/${canalId}/mensajes?limit=${limit}`
  );
  return mensajes;
}

/**
 * Enviar mensaje a un canal (grupo o torneo).
 * @param {string} canalId
 * @param {string|null} texto
 * @param {string|null} imagen - dataURL o URL (opcional)
 */
export async function enviarMensajeACanal(canalId, texto, imagen = null) {
  const payload = {};

  if (texto && String(texto).trim()) payload.texto = String(texto).trim();
  if (imagen) payload.imagen = imagen;

  const { data } = await api.post(
    `/mensajes/canales/${canalId}/mensajes`,
    payload
  );
  return data;
}

export async function marcarCanalLeido(canalId) {
  return api.patch(`/mensajes/canales/${canalId}/leidos`, {});
}