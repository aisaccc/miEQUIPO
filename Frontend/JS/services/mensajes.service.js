/* =========================================================
   mensajes.service.js — Service de mensajería del frontend
   =========================================================
   Consume los endpoints del backend:
   - GET    /api/mensajes/no-leidos
   - GET    /api/mensajes/conversaciones
   - POST   /api/mensajes/conversaciones
   - GET    /api/mensajes/conversaciones/:id
   - DELETE /api/mensajes/conversaciones/:id
   - GET    /api/mensajes/conversaciones/:id/mensajes
   - POST   /api/mensajes/conversaciones/:id/mensajes
   - PATCH  /api/mensajes/conversaciones/:id/leidos
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
   CONVERSACIONES
   ========================================================= */

/** Lista todas mis conversaciones ordenadas por última actividad. */
export async function listarConversaciones() {
  const { conversaciones } = await api.get('/mensajes/conversaciones');
  return conversaciones;
}

/** Obtiene una conversación por ID. */
export async function obtenerConversacion(id) {
  const { conversacion } = await api.get(`/mensajes/conversaciones/${id}`);
  return conversacion;
}

/**
 * Crea (o devuelve) la conversación con otro usuario.
 * @param {string} usuarioId - UUID del otro usuario
 * @param {object} opciones - { vinculadaTipo, vinculadaId, vinculadaNombre }
 */
export async function crearConversacion(usuarioId, opciones = {}) {
  const { conversacion } = await api.post('/mensajes/conversaciones', {
    usuarioId,
    vinculadaTipo: opciones.vinculadaTipo || null,
    vinculadaId: opciones.vinculadaId || null,
    vinculadaNombre: opciones.vinculadaNombre || null,
  });
  return conversacion;
}

/** Oculta la conversación solo para mí (soft delete). */
export async function ocultarConversacion(conversacionId) {
  return api.delete(`/mensajes/conversaciones/${conversacionId}`);
}

/* =========================================================
   MENSAJES
   ========================================================= */

/** Lista los mensajes de una conversación (ordenados ASC). */
export async function listarMensajes(conversacionId, limit = 100) {
  const { mensajes } = await api.get(
    `/mensajes/conversaciones/${conversacionId}/mensajes?limit=${limit}`
  );
  return mensajes;
}

/** Envía un mensaje. */
export async function enviarMensaje(conversacionId, texto) {
  const { data } = await api.post(
    `/mensajes/conversaciones/${conversacionId}/mensajes`,
    { texto }
  );
  return data;
}

/** Marca todos los mensajes de la conversación como leídos por mí. */
export async function marcarLeidos(conversacionId) {
  return api.patch(`/mensajes/conversaciones/${conversacionId}/leidos`, {});
}