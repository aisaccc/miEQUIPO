/* =========================================================
   usuarios.service.js — Service de usuarios del frontend
   =========================================================
   Consume los endpoints del backend:
   - GET    /api/usuarios/me
   - PATCH  /api/usuarios/me
   - PATCH  /api/usuarios/me/deportes
   - PATCH  /api/usuarios/me/password
   - DELETE /api/usuarios/me
   - GET    /api/usuarios/:id

   SEGURIDAD:
   - Delega todo a api.js (que ya maneja los tokens)
   - Actualiza la sesión en localStorage al recibir respuestas
   - Nunca expone password_hash
*/

import { api } from '../api.js';

const SESSION_KEY = 'miejquipo_session';

/* =========================================================
   HELPERS
   ========================================================= */

/**
 * Actualiza la sesión en localStorage después de modificar
 * el perfil. Evita que quede desincronizada.
 */
function sincronizarSesion(usuario) {
  if (!usuario) return;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return;

  const sesionActual = JSON.parse(raw);
  // Mantener el token (no viene en `usuario`) y actualizar el resto
  const sesionNueva = { ...sesionActual, ...usuario };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sesionNueva));
}

/* =========================================================
   GET /api/usuarios/me
   ========================================================= */
export async function obtenerMiPerfil() {
  const { usuario } = await api.get('/usuarios/me');
  sincronizarSesion(usuario);
  return usuario;
}

/* =========================================================
   PATCH /api/usuarios/me
   =========================================================
   @param {object} cambios - { nombre, username, bio, ciudad, pais, edad, avatar }
*/
export async function actualizarMiPerfil(cambios) {
  const { usuario } = await api.patch('/usuarios/me', cambios);
  sincronizarSesion(usuario);
  return usuario;
}

/* =========================================================
   PATCH /api/usuarios/me/deportes
   =========================================================
   @param {Array} deportes - [{ deporte, posiciones, stats }]
*/
export async function actualizarMisDeportes(deportes) {
  const { usuario } = await api.patch('/usuarios/me/deportes', { deportes });
  sincronizarSesion(usuario);
  return usuario;
}

/* =========================================================
   PATCH /api/usuarios/me/password
   =========================================================
   @param {string} passwordActual
   @param {string} passwordNueva
*/
export async function cambiarMiPassword(passwordActual, passwordNueva) {
  return api.patch('/usuarios/me/password', {
    passwordActual,
    passwordNueva,
  });
}

/* =========================================================
   DELETE /api/usuarios/me
   =========================================================
   @param {string} password
   @param {string} confirmacion - debe ser "ELIMINAR"
*/
export async function eliminarMiCuenta(password, confirmacion = 'ELIMINAR') {
  return api.delete('/usuarios/me', {
    body: { password, confirmacion },
  });
}

/* =========================================================
   GET /api/usuarios/:id
   =========================================================
   Perfil PÚBLICO (sin email, sin stats privadas).
*/
export async function obtenerPerfilPublico(usuarioId) {
  const { usuario } = await api.get(`/usuarios/${usuarioId}`);
  return usuario;
}
/* =========================================================
   BUSCAR USUARIOS (D.3)
   =========================================================
   @param {string} q - término de búsqueda (mín 2 caracteres)
   @returns {Promise<Array>} [{ id, nombre, username, avatar }]
*/
export async function buscarUsuarios(q) {
  const params = new URLSearchParams();
  params.append('q', q);

  const { usuarios } = await api.get(`/usuarios/buscar?${params.toString()}`);
  return usuarios || [];
}