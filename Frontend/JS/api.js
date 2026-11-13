/* =========================================================
   api.js — Cliente HTTP centralizado (v6 - A PRUEBA DE TODO)
   ========================================================= */

const API_URL = 'https://miequipo.onrender.com/api';

const KEY_ACCESS  = 'miejquipo_access_token';
const KEY_REFRESH = 'miejquipo_refresh_token';
const TIMEOUT_MS  = 60000; 

export function getAccessToken() { return localStorage.getItem(KEY_ACCESS); }
export function getRefreshToken() { return localStorage.getItem(KEY_REFRESH); }
export function setTokens({ accessToken, refreshToken }) {
  if (accessToken)  localStorage.setItem(KEY_ACCESS, accessToken);
  if (refreshToken) localStorage.setItem(KEY_REFRESH, refreshToken);
}
export function limpiarTokens() {
  localStorage.removeItem(KEY_ACCESS);
  localStorage.removeItem(KEY_REFRESH);
}

export class ApiError extends Error {
  constructor(mensaje, status, detalles) {
    super(mensaje);
    this.name = 'ApiError';
    this.status = status;
    this.detalles = detalles || null;
  }
}

let refreshEnCurso = null;

async function intentarRefresh() {
  if (refreshEnCurso) return refreshEnCurso;

  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new ApiError('No hay refresh token', 401);

  refreshEnCurso = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      // Errores de servidor o red, NO borramos tokens
      if (res.status === 429 || res.status >= 500) {
        throw new ApiError('Servidor ocupado o despertando. Intentá de nuevo.', res.status);
      }

      // 400 o 404: error del cliente, no de sesión
      if (res.status >= 400 && res.status !== 401 && res.status !== 403) {
        throw new ApiError('Error al renovar sesión', res.status);
      }

      // Solo si el refresh realmente expiró
      if (res.status === 401 || res.status === 403) {
        limpiarTokens();
        throw new ApiError('Sesión expirada', 401);
      }

      const data = await res.json();
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return data;
    } catch (netErr) {
      if (netErr.name === 'AbortError') throw new ApiError('El servidor tardó demasiado.', 0);
      if (netErr instanceof ApiError) throw netErr;
      throw new ApiError('Error de conexión con el servidor.', 0);
    } finally {
      refreshEnCurso = null;
    }
  })();

  return refreshEnCurso;
}

async function request(endpoint, options = {}) {
  const { method = 'GET', body = null, headers = {}, auth = true, sinRefresh = false } = options;

  const url = `${API_URL}${endpoint}`;
  const finalHeaders = { 'Content-Type': 'application/json', ...headers };

  if (auth) {
    const token = getAccessToken();
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = { method, headers: finalHeaders };
  if (body !== null) config.body = JSON.stringify(body);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS); 
  config.signal = controller.signal;

  let res;
  try {
    res = await fetch(url, config);
  } catch (netErr) {
    clearTimeout(timeoutId);
    if (netErr.name === 'AbortError') {
      throw new ApiError('El servidor está despertando (Render). Esperá unos segundos e intentá de nuevo.', 0);
    }
    throw new ApiError('No se pudo conectar con el servidor.', 0);
  }
  clearTimeout(timeoutId);

  // Si es 401, intentamos refrescar el token
  if (res.status === 401 && auth && !sinRefresh && getRefreshToken()) {
    const tokenOriginal = getAccessToken();

    try {
      await intentarRefresh();
      return request(endpoint, { ...options, sinRefresh: true });
    } catch (refreshErr) {
      // Si el fallo es de red o servidor, avisamos pero no te sacamos al login.
      if (refreshErr.status === 0 || refreshErr.status === 429 || refreshErr.status >= 500 || refreshErr.status === 400) {
        throw refreshErr;
      }

      // 🛡️ FIX MULTI-PESTAÑAS: Si otro tab ya refrescó el token exitosamente, 
      // reintentamos la petición con el nuevo token.
      const tokenActual = getAccessToken();
      if (tokenActual && tokenActual !== tokenOriginal) {
        return request(endpoint, { ...options, sinRefresh: true });
      }

      // Si el token es el mismo y falló, el refresh de verdad murió.
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

function redirigirALogin() {
  const path = window.location.pathname;
  if (path.endsWith('index.html') || path.endsWith('/')) return;
  window.location.href = 'index.html';
}

export const api = {
  get:    (endpoint, opts = {}) => request(endpoint, { ...opts, method: 'GET' }),
  post:   (endpoint, body, opts = {}) => request(endpoint, { ...opts, method: 'POST', body }),
  put:    (endpoint, body, opts = {}) => request(endpoint, { ...opts, method: 'PUT', body }),
  patch:  (endpoint, body, opts = {}) => request(endpoint, { ...opts, method: 'PATCH', body }),
  delete: (endpoint, opts = {}) => request(endpoint, { ...opts, method: 'DELETE', body: opts.body ?? null }),
};