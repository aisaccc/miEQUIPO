/* =========================================================
   api.js — Cliente HTTP centralizado
   =========================================================
   Todos los servicios (auth, partidos, grupos...) usan esto.
   NUNCA hacer fetch() directo en componentes/páginas.
*/

/* =========================================================
   CONFIGURACIÓN
   ========================================================= */
const API_URL = 'http://localhost:3000/api';

/* Keys en localStorage */
const KEY_ACCESS  = 'miejquipo_access_token';
const KEY_REFRESH = 'miejquipo_refresh_token';

/* =========================================================
   TOKEN HELPERS
   ========================================================= */
export function getAccessToken() {
  return localStorage.getItem(KEY_ACCESS);
}

export function getRefreshToken() {
  return localStorage.getItem(KEY_REFRESH);
}

export function setTokens({ accessToken, refreshToken }) {
  if (accessToken)  localStorage.setItem(KEY_ACCESS, accessToken);
  if (refreshToken) localStorage.setItem(KEY_REFRESH, refreshToken);
}

export function limpiarTokens() {
  localStorage.removeItem(KEY_ACCESS);
  localStorage.removeItem(KEY_REFRESH);
}

/* =========================================================
   ERROR CUSTOM
   ========================================================= */
export class ApiError extends Error {
  constructor(mensaje, status, detalles) {
    super(mensaje);
    this.name = 'ApiError';
    this.status = status;
    this.detalles = detalles || null;
  }
}

/* =========================================================
   REFRESH AUTOMÁTICO
   =========================================================
   Si el access token expira, intentamos renovarlo UNA vez
   con el refresh token antes de fallar.
*/
let refreshEnCurso = null; // evita múltiples refresh en paralelo

async function intentarRefresh() {
  // Si ya hay un refresh en curso, esperamos a ese
  if (refreshEnCurso) return refreshEnCurso;

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new ApiError('No hay refresh token', 401);
  }

  refreshEnCurso = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        limpiarTokens();
        throw new ApiError('Sesión expirada', 401);
      }

      const data = await res.json();
      setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });

      return data;
    } finally {
      refreshEnCurso = null;
    }
  })();

  return refreshEnCurso;
}

/* =========================================================
   FETCH PRINCIPAL
   ========================================================= */
/**
 * Hace una petición HTTP al backend.
 * @param {string} endpoint - ej: '/auth/login', '/partidos'
 * @param {object} options - { method, body, headers, auth, sinRefresh }
 * @returns {Promise<any>}
 */
async function request(endpoint, options = {}) {
  const {
    method = 'GET',
    body = null,
    headers = {},
    auth = true,        // ¿agregar Authorization?
    sinRefresh = false, // ¿evitar intentar refresh si falla?
  } = options;

  const url = `${API_URL}${endpoint}`;

  const finalHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Agregar token si corresponde
  if (auth) {
    const token = getAccessToken();
    if (token) {
      finalHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const config = {
    method,
    headers: finalHeaders,
  };

  if (body !== null) {
    config.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, config);
  } catch (netErr) {
    throw new ApiError(
      'No se pudo conectar con el servidor. Verificá tu conexión.',
      0
    );
  }

  // Si es 401 y tenemos refresh token, intentamos renovar y reintentar
  if (res.status === 401 && auth && !sinRefresh && getRefreshToken()) {
    try {
      await intentarRefresh();
      // Reintentar con el nuevo token
      return request(endpoint, { ...options, sinRefresh: true });
    } catch {
      // El refresh falló → sesión muerta
      limpiarTokens();
      redirigirALogin();
      throw new ApiError('Sesión expirada. Iniciá sesión de nuevo.', 401);
    }
  }

  // Parsear respuesta
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  // Si la respuesta no es OK, lanzar error
  if (!res.ok) {
    const mensaje = data?.error || data?.mensaje || `Error ${res.status}`;
    throw new ApiError(mensaje, res.status, data?.detalles);
  }

  return data;
}

/* =========================================================
   REDIRIGIR AL LOGIN
   ========================================================= */
function redirigirALogin() {
  // Si ya estamos en index.html, no redirigir
  const path = window.location.pathname;
  if (path.endsWith('index.html') || path.endsWith('/')) return;
  window.location.href = 'index.html';
}

/* =========================================================
   MÉTODOS CORTOS
   ========================================================= */
export const api = {
  get:    (endpoint, opts = {}) => request(endpoint, { ...opts, method: 'GET' }),
  post:   (endpoint, body, opts = {}) => request(endpoint, { ...opts, method: 'POST', body }),
  put:    (endpoint, body, opts = {}) => request(endpoint, { ...opts, method: 'PUT', body }),
  patch:  (endpoint, body, opts = {}) => request(endpoint, { ...opts, method: 'PATCH', body }),
  delete: (endpoint, opts = {}) => request(endpoint, {
    ...opts,
    method: 'DELETE',
    body: opts.body ?? null,  // ← ahora acepta body
  }),
};