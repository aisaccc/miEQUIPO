/* =========================================================
   api.js — Cliente HTTP centralizado (v3)
   =========================================================
   Todos los servicios (auth, partidos, grupos...) usan esto.
   NUNCA hacer fetch() directo en componentes/páginas.
*/

const API_URL = 'https://miequipo.onrender.com/api';

const KEY_ACCESS  = 'miejquipo_access_token';
const KEY_REFRESH = 'miejquipo_refresh_token';
const TIMEOUT_MS  = 20000;

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
   ========================================================= */
let refreshEnCurso = null; // evita múltiples refresh en paralelo

async function intentarRefresh() {
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

      // ⚡ Si es rate limit (429) o error del servidor (5xx), NO borramos sesión.
      if (res.status === 429 || res.status >= 500) {
        throw new ApiError('Servidor ocupado. Intentá de nuevo en unos segundos.', res.status);
      }

      // ⚡ Solo si es 401 o 403 significa que el refresh token de verdad murió.
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
async function request(endpoint, options = {}) {
  const {
    method = 'GET',
    body = null,
    headers = {},
    auth = true,
    sinRefresh = false,
  } = options;

  const url = `${API_URL}${endpoint}`;
  const finalHeaders = { 'Content-Type': 'application/json', ...headers };

  if (auth) {
    const token = getAccessToken();
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = { method, headers: finalHeaders };
  if (body !== null) config.body = JSON.stringify(body);

  const controller = new AbortController();
  // ⚡ SUBIMOS A 50 SEGUNDOS PARA QUE RENDER DESPIERTE SIN CORTAR LA PETICIÓN
  const timeoutId = setTimeout(() => controller.abort(), 50000); 
  config.signal = controller.signal;

  let res;
  try {
    res = await fetch(url, config);
  } catch (netErr) {
    clearTimeout(timeoutId);
    if (netErr.name === 'AbortError') {
      throw new ApiError('El servidor tardó demasiado en responder (Render despertando).', 0);
    }
    throw new ApiError('No se pudo conectar con el servidor.', 0);
  }
  clearTimeout(timeoutId);

  // Si es 401 y tenemos refresh token, intentamos renovar y reintentar
  if (res.status === 401 && auth && !sinRefresh && getRefreshToken()) {
    try {
      await intentarRefresh();
      return request(endpoint, { ...options, sinRefresh: true });
    } catch (refreshErr) {
      if (refreshErr.status === 429 || refreshErr.status >= 500) throw refreshErr;
      limpiarTokens();
      redirigirALogin();
      throw new ApiError('Sesión expirada. Iniciá sesión de nuevo.', 401);
    }
  }

  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try { data = await res.json(); } catch { data = null; }
  }

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
    body: opts.body ?? null,
  }),
};