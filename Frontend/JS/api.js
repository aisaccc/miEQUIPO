/* =========================================================
   api.js — Cliente HTTP centralizado (v2)
   =========================================================
   Cambios v2:
   - Timeout por request con AbortController
   - Retry con backoff exponencial para 429/503 (solo GET)
   - Refresh que distingue 429 (rate limit) de 401 (sesión muerta)
   - Nunca limpia tokens ni redirige si el refresh falla por 429
*/

const API_URL = 'https://miequipo.onrender.com/api';

const KEY_ACCESS  = 'miejquipo_access_token';
const KEY_REFRESH = 'miejquipo_refresh_token';

/* Configuración de reintentos */
const MAX_REINTENTOS_429 = 2;    // 2 reintentos → 2s + 4s
const TIMEOUT_MS         = 20000; // 20s timeout por request

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
let refreshEnCurso = null;

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
      if (res.status === 401 || res.status === 403) {
        limpiarTokens();
        throw new ApiError('Sesión expirada', 401);
      }

      if (!res.ok) {
        throw new ApiError('Error inesperado al renovar sesión', res.status);
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
async function request(endpoint, options = {}, _intento = 1) {
  const {
    method = 'GET',
    body = null,
    headers = {},
    auth = true,
    sinRefresh = false,
    esPolling = false,   // ⚡ NUEVO: si true, no reintenta 429 y no loguea ruido
  } = options;

  const url = `${API_URL}${endpoint}`;

  const finalHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (auth) {
    const token = getAccessToken();
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = { method, headers: finalHeaders };
  if (body !== null) config.body = JSON.stringify(body);

  // ⚡ Timeout con AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  config.signal = controller.signal;

  let res;
  try {
    res = await fetch(url, config);
  } catch (netErr) {
    clearTimeout(timeoutId);
    if (netErr.name === 'AbortError') {
      throw new ApiError('La petición tardó demasiado. Revisá tu conexión.', 0);
    }
    throw new ApiError('No se pudo conectar con el servidor. Verificá tu conexión.', 0);
  }
  clearTimeout(timeoutId);

  // ⚡ Retry con backoff para 429/503 SOLO en GET y si NO es polling
  const puedeReintentar =
    !esPolling &&
    method === 'GET' &&
    (res.status === 429 || res.status === 503) &&
    _intento <= MAX_REINTENTOS_429;

  if (puedeReintentar) {
    const espera = 1000 * Math.pow(2, _intento); // 2s, 4s
    const jitter = Math.random() * 500;
    console.warn(`[api] ${res.status} en ${endpoint} — reintento ${_intento}/${MAX_REINTENTOS_429} en ${Math.round(espera + jitter)}ms`);
    await new Promise(r => setTimeout(r, espera + jitter));
    return request(endpoint, options, _intento + 1);
  }

  // 401 → intentar refresh UNA vez
  // 401 → intentar refresh UNA vez
  if (res.status === 401 && auth && !sinRefresh && getRefreshToken()) {
    try {
      await intentarRefresh();
      return request(endpoint, { ...options, sinRefresh: true });
    } catch (refreshErr) {
      // ⚡ Si el refresh falló por error del servidor, NO limpiamos sesión, solo tiramos el error.
      if (refreshErr.status >= 500 || refreshErr.status === 429) {
        throw refreshErr;
      }
      // Si llegó acá, el token de verdad murió.
      limpiarTokens();
      redirigirALogin();
      throw new ApiError('Sesión expirada. Iniciá sesión de nuevo.', 401);
    }
  }

  // Parsear respuesta
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
  delete: (endpoint, opts = {}) => request(endpoint, {
    ...opts,
    method: 'DELETE',
    body: opts.body ?? null,
  }),
};