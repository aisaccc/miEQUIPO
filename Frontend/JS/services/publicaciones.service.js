/* =========================================================
   publicaciones.service.js — Service de publicaciones
   ========================================================= */

import { api } from '../api.js';

/* =========================================================
   FEED GLOBAL (Inicio)
   ========================================================= */
export async function obtenerFeed() {
  const { publicaciones } = await api.get('/publicaciones/feed');
  return publicaciones;
}

/* =========================================================
   LISTAR POR USUARIO
   ========================================================= */
export async function listarPublicacionesDe(usuarioId) {
  const { publicaciones } = await api.get(`/publicaciones/usuario/${usuarioId}`);
  return publicaciones;
}

/* =========================================================
   LISTAR POR GRUPO
   ========================================================= */
export async function listarPublicacionesDeGrupo(grupoId) {
  const { publicaciones } = await api.get(`/grupos/${grupoId}/publicaciones`);
  return publicaciones;
}

/* =========================================================
   LISTAR POR TORNEO
   ========================================================= */
export async function listarPublicacionesDeTorneo(torneoId) {
  const { publicaciones } = await api.get(`/torneos/${torneoId}/publicaciones`);
  return publicaciones;
}

/* =========================================================
   CREAR
   ========================================================= */
export async function crearPublicacion(datos) {
  return api.post('/publicaciones', datos);
}

export async function crearPublicacionEnGrupo(grupoId, datos) {
  return api.post(`/grupos/${grupoId}/publicaciones`, datos);
}

export async function crearPublicacionEnTorneo(torneoId, datos) {
  return api.post(`/torneos/${torneoId}/publicaciones`, datos);
}

/* =========================================================
   EDITAR / ELIMINAR
   ========================================================= */
export async function editarPublicacion(id, datos) {
  return api.patch(`/publicaciones/${id}`, datos);
}

export async function editarPrivacidadPublicacion(id, privacidad) {
  return api.patch(`/publicaciones/${id}/privacidad`, { privacidad });
}

export async function eliminarPublicacion(id) {
  return api.delete(`/publicaciones/${id}`);
}

/* =========================================================
   LIKE / COMENTARIOS
   ========================================================= */
export async function toggleLike(id) {
  return api.post(`/publicaciones/${id}/like`, {});
}

export async function listarComentarios(id) {
  const { comentarios } = await api.get(`/publicaciones/${id}/comentarios`);
  return comentarios;
}

export async function crearComentario(id, texto) {
  return api.post(`/publicaciones/${id}/comentarios`, { texto });
}