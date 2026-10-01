/* =========================================================
   auth.service.js — Lógica de negocio de autenticación
   =========================================================
   Este archivo NO sabe nada de req/res.
   Solo recibe datos, toca la BD y devuelve resultados.
*/

import { pool } from '../config/db.js';
import { hashearPassword, verificarPassword } from '../utils/password.js';
import {
  generarAccessToken,
  generarRefreshToken,
  hashearToken,
} from '../utils/jwt.js';
import { generarTokenAleatorio } from '../utils/token.js';
import {
  crearSesion,
  buscarSesionPorRefresh,
  revocarSesionPorRefresh,
  revocarTodasLasSesiones,
} from '../utils/sesiones.js';
import {
  enviarEmailVerificacion,
  enviarEmailBienvenida,
} from '../utils/mailer.js';

/* =========================================================
   HELPERS
   ========================================================= */
function formatearUsuario(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    username: row.username,
    email: row.email,
    avatar: row.avatar,
    bio: row.bio,
    edad: row.edad,
    pais: row.pais,
    ciudad: row.ciudad,
    deportes: row.deportes || [],
    emailVerificado: row.email_verificado,
    createdAt: row.created_at,
    lastLogin: row.last_login,
  };
}

/* =========================================================
   REGISTRO
   ========================================================= */
export async function registrarUsuario({ nombre, email, username, password }, meta = {}) {
  // 1. Verificar duplicados
  const { rows: existentes } = await pool.query(
    `SELECT id, email, username
     FROM usuarios
     WHERE LOWER(email) = LOWER($1)
        OR LOWER(username) = LOWER($2)`,
    [email, username]
  );

  if (existentes.length > 0) {
    const dup = existentes[0];
    if (dup.email.toLowerCase() === email.toLowerCase()) {
      const err = new Error('Ese email ya está registrado');
      err.status = 409;
      throw err;
    }
    if (dup.username.toLowerCase() === username.toLowerCase()) {
      const err = new Error('Ese nombre de usuario ya está en uso');
      err.status = 409;
      throw err;
    }
  }

  // 2. Hashear password
  const passwordHash = await hashearPassword(password);

  // 3. Insertar usuario
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre, email, username, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nombre, username, email, avatar, bio, edad, pais, ciudad,
               deportes, email_verificado, created_at, last_login`,
    [nombre, email.toLowerCase(), username, passwordHash]
  );

  const usuario = rows[0];

  // 4. Token de verificación de email
  const tokenVerificacion = generarTokenAleatorio(32);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  const tokenHash = hashearToken(tokenVerificacion);

  await pool.query(
    `INSERT INTO tokens_temporales (usuario_id, tipo, token_hash, expires_at)
     VALUES ($1, 'verificar_email', $2, $3)`,
    [usuario.id, tokenHash, expiresAt]
  );

  // 5. Enviar email (no bloquea si falla)
  try {
    await enviarEmailVerificacion(usuario.email, usuario.nombre, tokenVerificacion);
  } catch (mailErr) {
    console.error('[auth.service] No se pudo enviar email de verificación:', mailErr.message);
  }

  // 6. Tokens de sesión
  const accessToken = generarAccessToken(usuario);
  const refreshToken = generarRefreshToken(usuario);

  // 7. Guardar sesión
  await crearSesion(usuario.id, refreshToken, meta);

  return {
    usuario: formatearUsuario(usuario),
    accessToken,
    refreshToken,
  };
}

/* =========================================================
   LOGIN
   ========================================================= */
export async function loginUsuario({ identificador, password }, meta = {}) {
  const { rows } = await pool.query(
    `SELECT id, nombre, username, email, password_hash, avatar, bio,
            edad, pais, ciudad, deportes, email_verificado,
            created_at, last_login, activo
     FROM usuarios
     WHERE LOWER(email) = LOWER($1)
        OR LOWER(username) = LOWER($1)
     LIMIT 1`,
    [identificador]
  );

  const usuario = rows[0];

  if (!usuario) {
    const err = new Error('Credenciales inválidas');
    err.status = 401;
    throw err;
  }

  if (!usuario.activo) {
    const err = new Error('Cuenta desactivada');
    err.status = 403;
    throw err;
  }

  const passwordOk = await verificarPassword(password, usuario.password_hash);
  if (!passwordOk) {
    const err = new Error('Credenciales inválidas');
    err.status = 401;
    throw err;
  }

  await pool.query(
    `UPDATE usuarios SET last_login = NOW() WHERE id = $1`,
    [usuario.id]
  );

  const accessToken = generarAccessToken(usuario);
  const refreshToken = generarRefreshToken(usuario);

  await crearSesion(usuario.id, refreshToken, meta);

  const { password_hash, activo, ...usuarioLimpio } = usuario;

  return {
    usuario: formatearUsuario(usuarioLimpio),
    accessToken,
    refreshToken,
  };
}

/* =========================================================
   REFRESH TOKEN
   ========================================================= */
export async function refrescarTokens(refreshToken, meta = {}) {
  const sesion = await buscarSesionPorRefresh(refreshToken);
  if (!sesion) {
    const err = new Error('Refresh token inválido o expirado');
    err.status = 401;
    throw err;
  }

  const { rows } = await pool.query(
    `SELECT id, nombre, username, email, avatar, bio, edad, pais, ciudad,
            deportes, email_verificado, created_at, last_login
     FROM usuarios
     WHERE id = $1 AND activo = TRUE`,
    [sesion.usuario_id]
  );

  const usuario = rows[0];
  if (!usuario) {
    const err = new Error('Usuario no encontrado o inactivo');
    err.status = 401;
    throw err;
  }

  await revocarSesionPorRefresh(refreshToken);

  const nuevoAccess = generarAccessToken(usuario);
  const nuevoRefresh = generarRefreshToken(usuario);

  await crearSesion(usuario.id, nuevoRefresh, meta);

  return {
    usuario: formatearUsuario(usuario),
    accessToken: nuevoAccess,
    refreshToken: nuevoRefresh,
  };
}

/* =========================================================
   LOGOUT
   ========================================================= */
export async function cerrarSesion(refreshToken) {
  if (!refreshToken) return { ok: true };
  await revocarSesionPorRefresh(refreshToken);
  return { ok: true };
}

export async function cerrarTodasLasSesiones(usuarioId) {
  await revocarTodasLasSesiones(usuarioId);
  return { ok: true };
}

/* =========================================================
   OBTENER USUARIO ACTUAL
   ========================================================= */
export async function obtenerUsuarioPorId(usuarioId) {
  const { rows } = await pool.query(
    `SELECT id, nombre, username, email, avatar, bio, edad, pais, ciudad,
            deportes, email_verificado, created_at, last_login
     FROM usuarios
     WHERE id = $1 AND activo = TRUE`,
    [usuarioId]
  );

  if (!rows[0]) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }

  return formatearUsuario(rows[0]);
}

/* =========================================================
   VERIFICAR EMAIL
   ========================================================= */
export async function verificarEmail(token) {
  const tokenHash = hashearToken(token);

  const { rows } = await pool.query(
    `SELECT tt.id, tt.usuario_id, u.nombre, u.email
     FROM tokens_temporales tt
     JOIN usuarios u ON u.id = tt.usuario_id
     WHERE tt.token_hash = $1
       AND tt.tipo = 'verificar_email'
       AND tt.usado = FALSE
       AND tt.expires_at > NOW()`,
    [tokenHash]
  );

  const registro = rows[0];
  if (!registro) {
    const err = new Error('Token inválido o expirado');
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE tokens_temporales SET usado = TRUE WHERE id = $1`,
      [registro.id]
    );
    await client.query(
      `UPDATE usuarios
       SET email_verificado = TRUE, verificado_en = NOW()
       WHERE id = $1`,
      [registro.usuario_id]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  try {
    await enviarEmailBienvenida(registro.email, registro.nombre);
  } catch (e) {
    console.error('[auth.service] No se pudo enviar bienvenida:', e.message);
  }

  return { ok: true, mensaje: 'Email verificado correctamente' };
}