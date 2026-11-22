/* =========================================================
   auth.service.js — Lógica de negocio de autenticación
   ========================================================= */

import { pool } from '../config/db.js';
import { hashearPassword, verificarPassword } from '../utils/password.js';
import {
  generarAccessToken,
  generarRefreshToken,
  verificarRefreshToken,
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
  // ⚡ NUEVO: Calcular esPremium
  const esPremium = row.plan === 'premium' && (!row.premium_hasta || new Date(row.premium_hasta) > new Date());

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
    
    // ⚡ NUEVO: Incluir datos del plan y personalización
    plan: row.plan || 'basico',
    esPremium: esPremium,
    premiumDesde: row.premium_desde,
    premiumHasta: row.premium_hasta,
    premiumOrigen: row.premium_origen,
    marcoPerfil: row.marco_perfil || 'default',
    marcoColor: row.marco_color || null,
    heroColor: row.hero_color || 'navy',
    heroFoto: row.hero_foto || null,
  };
}

/* =========================================================
   REGISTRO
   ========================================================= */
export async function registrarUsuario({ nombre, email, username, password }, meta = {}) {
  const { rows: existentes } = await pool.query(
    `SELECT id, email, username
     FROM usuarios
     WHERE LOWER(email) = LOWER($1)
        OR LOWER(username) = LOWER($2)`,
    [email, username]
  );

  if (existentes.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    const err = new Error('Ese nombre de usuario ya está en uso');
    err.status = 409;
    throw err;
  }
  if (existentes.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    const err = new Error('Ese email ya está registrado');
    err.status = 409;
    throw err;
  }

  const passwordHash = await hashearPassword(password);

  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre, email, username, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nombre, username, email, avatar, bio, edad, pais, ciudad,
               deportes, email_verificado, created_at, last_login,
               plan, premium_desde, premium_hasta, premium_origen, marco_perfil, marco_color, hero_color, hero_foto`,
    [nombre, email.toLowerCase(), username, passwordHash]
  );

  const usuario = rows[0];

  const tokenVerificacion = generarTokenAleatorio(32);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  const tokenHash = hashearToken(tokenVerificacion);

  await pool.query(
    `INSERT INTO tokens_temporales (usuario_id, tipo, token_hash, expires_at)
     VALUES ($1, 'verificar_email', $2, $3)`,
    [usuario.id, tokenHash, expiresAt]
  );

  try {
    await enviarEmailVerificacion(usuario.email, usuario.nombre, tokenVerificacion);
  } catch (mailErr) {
    console.error('[auth.service] No se pudo enviar email de verificación:', mailErr.code || 'MAIL_ERROR');
  }

  const refreshToken = generarRefreshToken(usuario);
  const sesion = await crearSesion(usuario.id, refreshToken, meta);
  const accessToken = generarAccessToken(usuario, sesion.id);

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
  // ⚡ NUEVO: Agregados los campos premium al SELECT
  const { rows } = await pool.query(
    `SELECT id, nombre, username, email, password_hash, avatar, bio,
            edad, pais, ciudad, deportes, email_verificado,
            created_at, last_login, activo,
            plan, premium_desde, premium_hasta, premium_origen, marco_perfil, marco_color, hero_color, hero_foto
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

  const refreshToken = generarRefreshToken(usuario);
  const sesion = await crearSesion(usuario.id, refreshToken, meta);
  const accessToken = generarAccessToken(usuario, sesion.id);

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
  const payload = verificarRefreshToken(refreshToken);
  if (!payload) {
    const err = new Error('Refresh token inválido o expirado');
    err.status = 401;
    throw err;
  }

  const sesion = await buscarSesionPorRefresh(refreshToken);
  if (!sesion || sesion.usuario_id !== payload.sub) {
    const err = new Error('Refresh token inválido o expirado');
    err.status = 401;
    throw err;
  }

  const { rows } = await pool.query(
    `SELECT id, nombre, username, email, avatar, bio, edad, pais, ciudad,
            deportes, email_verificado, created_at, last_login,
            plan, premium_desde, premium_hasta, premium_origen, marco_perfil, marco_color, hero_color, hero_foto
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

  // Fase 1: conservar una única sesión y su vencimiento original.
  // No crear nuevas sesiones al renovar el access token.
  const nuevoAccess = generarAccessToken(usuario, sesion.id);

  return {
    usuario: formatearUsuario(usuario),
    accessToken: nuevoAccess,
    refreshToken,
  };
}

/* =========================================================
   LOGOUT
   ========================================================= */
export async function cerrarSesion(refreshToken) {
  if (typeof refreshToken !== 'string' || !refreshToken || refreshToken.length > 2000) return { ok: true };
  await revocarSesionPorRefresh(refreshToken);
  return { ok: true };
}

export async function cerrarTodasLasSesiones(usuarioId) {
  await revocarTodasLasSesiones(usuarioId);
  return { ok: true };
}

/* =========================================================
   OBTENER USUARIO ACTUAL (Ruta /auth/me)
   ========================================================= */
export async function obtenerUsuarioPorId(usuarioId) {
  // ⚡ NUEVO: Agregados los campos premium al SELECT
  const { rows } = await pool.query(
    `SELECT id, nombre, username, email, avatar, bio, edad, pais, ciudad,
            deportes, email_verificado, created_at, last_login,
            plan, premium_desde, premium_hasta, premium_origen, marco_perfil, marco_color, hero_color, hero_foto
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
    console.error('[auth.service] No se pudo enviar bienvenida:', e.code || 'MAIL_ERROR');
  }

  return { ok: true, mensaje: 'Email verificado correctamente' };
}