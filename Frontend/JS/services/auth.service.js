/* =========================================================
   auth.service.js — Service de auth del frontend
   =========================================================
   Envuelve las llamadas al backend y mantiene la sesión en localStorage.
   Mantiene la MISMA interfaz que el auth.js viejo para no romper la UI.
*/

import { api, setTokens, limpiarTokens, getAccessToken, getRefreshToken } from '../api.js';

const SESSION_KEY = 'miejquipo_session';

/* =========================================================
   SESIÓN (usuario en localStorage)
   ========================================================= */
export function getSesion() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSesion(usuario) {
  // Nunca guardar password
  const { password, password_hash, ...safeUser } = usuario;
  localStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
}

export function cerrarSesion() {
  localStorage.removeItem(SESSION_KEY);
  limpiarTokens();
}

/* =========================================================
   ¿HAY SESIÓN ACTIVA?
   ========================================================= */
export function estaAutenticado() {
  return !!getAccessToken() && !!getSesion();
}

/* =========================================================
   LOGIN
   =========================================================
   El backend espera { identificador, password }
   donde identificador = email O username.
*/
export async function login(identificador, password) {
  const data = await api.post('/auth/login', {
    identificador: String(identificador).trim(),
    password,
  }, { auth: false });

  // Guardar tokens
  setTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });

  // Guardar usuario
  setSesion(data.usuario);

  return data.usuario;
}

/* =========================================================
   REGISTRO
   ========================================================= */
export async function registro({ nombre, email, username, password }) {
  const data = await api.post('/auth/registro', {
    nombre: nombre.trim(),
    email: email.trim().toLowerCase(),
    username: username.trim(),
    password,
  }, { auth: false });

  // El registro ya devuelve tokens → el usuario queda logueado
  setTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });

  setSesion(data.usuario);

  return data.usuario;
}

/* =========================================================
   LOGOUT
   =========================================================
   Revoca el refresh token en el backend y limpia todo local.
*/
export async function logout() {
  const refreshToken = getRefreshToken();

  try {
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken }, { auth: false });
    }
  } catch (err) {
    console.warn('[auth.service] No se pudo revocar el refresh token:', err.message);
  } finally {
    cerrarSesion();
  }
}

/* =========================================================
   LOGOUT EN TODOS LOS DISPOSITIVOS
   ========================================================= */
export async function logoutAll() {
  try {
    await api.post('/auth/logout-all', {});
  } finally {
    cerrarSesion();
  }
}

/* =========================================================
   OBTENER USUARIO ACTUAL (refresca desde backend)
   ========================================================= */
export async function obtenerUsuarioActual() {
  const data = await api.get('/auth/me');
  setSesion(data.usuario);
  return data.usuario;
}

/* =========================================================
   REFRESCAR TOKEN MANUALMENTE
   =========================================================
   Normalmente api.js lo hace automático. Esto es para forzar.
*/
export async function refrescarSesion() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No hay sesión para refrescar');

  const data = await api.post('/auth/refresh', { refreshToken }, { auth: false });

  setTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });

  setSesion(data.usuario);
  return data.usuario;
}

/* =========================================================
   VERIFICAR EMAIL
   ========================================================= */
export async function verificarEmail(token) {
  const data = await api.post('/auth/verificar-email', { token }, { auth: false });
  return data;
}
/* =========================================================
   REFRESCO AUTOMÁTICO EN SEGUNDO PLANO
   =========================================================
   Esto evita que la sesión muera si el usuario está inactivo.
*/
let intervaloRefresco = null;

export function iniciarAutoRefresco() {
  if (intervaloRefresco) return;

  // Refresca cada 10 minutos (600,000 ms)
  intervaloRefresco = setInterval(async () => {
    // Solo intentar si hay un usuario logueado
    if (localStorage.getItem('miejquipo_refresh_token')) {
      try {
        await refrescarSesion();
        console.log('[Auth] Token refrescado automáticamente');
      } catch (err) {
        console.warn('[Auth] Falló el refresco automático, esperando al interceptor...');
      }
    }
  }, 10 * 60 * 1000);
}