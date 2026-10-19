/* =========================================================
   usuarios.service.js — Service de usuarios del frontend
   ========================================================= */

import { api } from '../api.js';

const SESSION_KEY = 'miejquipo_session';

function sincronizarSesion(usuario) {
  if (!usuario || !usuario.id) return;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return;

  const sesionActual = JSON.parse(raw);
  const sesionNueva = { ...sesionActual, ...usuario };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sesionNueva));
}

/* =========================================================
   GET /api/usuarios/me
   ========================================================= */
export async function obtenerMiPerfil() {
  const respuesta = await api.get('/usuarios/me');
  
  // ⚡ Acepta { usuario: {...} } o { id, nombre, ... } directo
  const usuario = respuesta?.usuario || respuesta;

  if (usuario && usuario.id) {
    sincronizarSesion(usuario);
    return usuario;
  }
  
  return null;
}

/* =========================================================
   PATCH /api/usuarios/me
   ========================================================= */
export async function actualizarMiPerfil(cambios) {
  const respuesta = await api.patch('/usuarios/me', cambios);
  const usuario = respuesta?.usuario || respuesta;
  
  if (usuario && usuario.id) {
    sincronizarSesion(usuario);
    return usuario;
  }
  return null;
}

/* =========================================================
   PATCH /api/usuarios/me/deportes
   ========================================================= */
export async function actualizarMisDeportes(deportes) {
  const respuesta = await api.patch('/usuarios/me/deportes', { deportes });
  const usuario = respuesta?.usuario || respuesta;

  if (usuario && usuario.id) {
    sincronizarSesion(usuario);
    return usuario;
  }
  return null;
}

/* =========================================================
   PATCH /api/usuarios/me/password
   ========================================================= */
export async function cambiarMiPassword(passwordActual, passwordNueva) {
  return api.patch('/usuarios/me/password', {
    passwordActual,
    passwordNueva,
  });
}

/* =========================================================
   DELETE /api/usuarios/me
   ========================================================= */
export async function eliminarMiCuenta(password, confirmacion = 'ELIMINAR') {
  return api.delete('/usuarios/me', {
    body: { password, confirmacion },
  });
}

/* =========================================================
   GET /api/usuarios/:id
   ========================================================= */
export async function obtenerPerfilPublico(usuarioId) {
  const respuesta = await api.get(`/usuarios/${usuarioId}`);
  return respuesta?.usuario || respuesta;
}

/* =========================================================
   BUSCAR USUARIOS
   ========================================================= */
export async function buscarUsuarios(q) {
  const params = new URLSearchParams();
  params.append('q', q);

  const { usuarios } = await api.get(`/usuarios/buscar?${params.toString()}`);
  return usuarios || [];
}