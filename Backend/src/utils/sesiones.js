/* =========================================================
   sesiones.js — Helpers para manejar sesiones (refresh tokens)
   =========================================================
   Las sesiones viven en la tabla `sesiones`.
   El refresh token NUNCA se guarda en texto plano: se hashea.
*/

import { pool } from '../config/db.js';
import { hashearToken } from './jwt.js';
import { verificarRefreshToken } from './jwt.js';

/* =========================================================
   CREAR SESIÓN
   ========================================================= */
/**
 * Guarda una nueva sesión en la BD.
 * @param {string} usuarioId - UUID del usuario
 * @param {string} refreshToken - el token en texto plano (para hashear)
 * @param {object} meta - { userAgent, ip }
 * @param {number} diasValidez - días que dura el refresh (default 7)
 * @returns {Promise<object>} la fila creada
 */
export async function crearSesion(usuarioId, refreshToken, meta = {}, diasValidez = 7) {
  const refreshHash = hashearToken(refreshToken);
  const payload = verificarRefreshToken(refreshToken);

  if (!payload || !Number.isFinite(payload.exp)) {
    const err = new Error('Refresh token inválido');
    err.status = 401;
    throw err;
  }

  if (String(payload.sub) !== String(usuarioId)) {
    const err = new Error('Usuario del token incorrecto');
    err.status = 401;
    throw err;
  }

  const expiresAt = new Date(payload.exp * 1000);

  const { rows } = await pool.query(
    `INSERT INTO sesiones (usuario_id, refresh_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, usuario_id, expires_at, created_at`,
    [usuarioId, refreshHash, meta.userAgent || null, meta.ip || null, expiresAt]
  );

  return rows[0];
}

/* =========================================================
   BUSCAR SESIÓN POR REFRESH TOKEN
   ========================================================= */
/**
 * Verifica que el refresh token sea válido y devuelve la sesión.
 * @param {string} refreshToken
 * @returns {Promise<object|null>}
 */
export async function buscarSesionPorRefresh(refreshToken) {
  const refreshHash = hashearToken(refreshToken);

  const { rows } = await pool.query(
    `SELECT id, usuario_id, expires_at, revocado
     FROM sesiones
     WHERE refresh_hash = $1
       AND revocado = FALSE
       AND expires_at > NOW()`,
    [refreshHash]
  );

  return rows[0] || null;
}

/* =========================================================
   REVOCAR SESIÓN
   ========================================================= */
export async function revocarSesionPorRefresh(refreshToken) {
  const refreshHash = hashearToken(refreshToken);
  await pool.query(
    `UPDATE sesiones SET revocado = TRUE WHERE refresh_hash = $1`,
    [refreshHash]
  );
}

export async function revocarSesionPorId(sesionId) {
  await pool.query(
    `UPDATE sesiones SET revocado = TRUE WHERE id = $1`,
    [sesionId]
  );
}

/* =========================================================
   LIMPIAR SESIONES EXPIRADAS (para un cron o manual)
   ========================================================= */
export async function limpiarSesionesExpiradas() {
  const { rowCount } = await pool.query(
    `DELETE FROM sesiones
     WHERE expires_at < NOW() OR revocado = TRUE`
  );
  return rowCount;
}

/* =========================================================
   REVOCAR TODAS LAS SESIONES DE UN USUARIO
   ========================================================= */
export async function revocarTodasLasSesiones(usuarioId) {
  await pool.query(
    `UPDATE sesiones SET revocado = TRUE
     WHERE usuario_id = $1 AND revocado = FALSE`,
    [usuarioId]
  );
}


export async function rotarSesion(
  refreshTokenAnterior,
  refreshTokenNuevo,
  meta = {}
) {
  const payloadAnterior =
    verificarRefreshToken(refreshTokenAnterior);

  const payloadNuevo =
    verificarRefreshToken(refreshTokenNuevo);

  if (
    !payloadAnterior ||
    !payloadNuevo ||
    !Number.isFinite(payloadNuevo.exp) ||
    typeof payloadAnterior.sub !== 'string' ||
    payloadAnterior.sub !== payloadNuevo.sub
  ) {
    const err = new Error('Refresh token inválido');
    err.status = 401;
    throw err;
  }

  const hashAnterior = hashearToken(refreshTokenAnterior);
  const hashNuevo = hashearToken(refreshTokenNuevo);
  const expiresAt = new Date(payloadNuevo.exp * 1000);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE sesiones
       SET revocado = TRUE
       WHERE refresh_hash = $1
         AND usuario_id = $2
         AND revocado = FALSE
         AND expires_at > NOW()
       RETURNING usuario_id`,
      [hashAnterior, payloadAnterior.sub]
    );

    if (rows.length === 0) {
      const err = new Error(
        'Sesión inválida, expirada o ya utilizada'
      );
      err.status = 401;
      throw err;
    }

    const usuarioId = rows[0].usuario_id;

    const { rows: usuarios } = await client.query(
      `SELECT id FROM usuarios
       WHERE id = $1 AND activo = TRUE
       FOR SHARE`,
      [usuarioId]
    );

    if (usuarios.length === 0) {
      const err = new Error('Usuario inactivo');
      err.status = 401;
      throw err;
    }

    const { rows: nuevas } = await client.query(
      `INSERT INTO sesiones (
        usuario_id,
        refresh_hash,
        user_agent,
        ip_address,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, usuario_id, expires_at`,
      [
        usuarioId,
        hashNuevo,
        meta.userAgent || null,
        meta.ip || null,
        expiresAt
      ]
    );

    await client.query('COMMIT');
    return nuevas[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

