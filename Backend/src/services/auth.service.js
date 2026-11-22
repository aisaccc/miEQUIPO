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
  enviarEmailResetPassword,
  enviarEmailPasswordActualizada,
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

// Evita crear una sesión con una contraseña que acaba de ser restablecida.
// Comparte el bloqueo de fila con la operación de recuperación.
async function crearSesionConPasswordVigente(usuario, passwordHash, meta, actualizarLogin = false) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT activo, password_hash FROM usuarios WHERE id = $1 FOR UPDATE`,
      [usuario.id]
    );
    if (!rows[0]?.activo || rows[0].password_hash !== passwordHash) {
      const err = new Error('Credenciales inválidas. Intenta iniciar sesión nuevamente.');
      err.status = 401;
      throw err;
    }
    if (actualizarLogin) {
      await client.query(`UPDATE usuarios SET last_login = NOW() WHERE id = $1`, [usuario.id]);
    }
    const refreshToken = generarRefreshToken(usuario);
    const sesion = await crearSesion(usuario.id, refreshToken, meta, undefined, client);
    const accessToken = generarAccessToken(usuario, sesion.id);
    await client.query('COMMIT');
    return { accessToken, refreshToken };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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

  const { accessToken, refreshToken } = await crearSesionConPasswordVigente(usuario, passwordHash, meta);

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

  const { accessToken, refreshToken } = await crearSesionConPasswordVigente(usuario, usuario.password_hash, meta, true);

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
/* =========================================================
   RECUPERACIÓN DE CONTRASEÑA
   ========================================================= */
const MENSAJE_RECUPERACION = 'Si existe una cuenta activa con ese correo verificado, recibirás un enlace de recuperación.';

function errorResetInvalido() {
  const err = new Error('El enlace es inválido, ya fue utilizado o ha expirado. Solicita uno nuevo.');
  err.status = 400;
  return err;
}

export async function solicitarResetPassword(email) {
  const inicio = Date.now();
  let envio = null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Bloqueo por usuario para serializar solicitudes de recuperación.
    const { rows } = await client.query(
      `SELECT id, email FROM usuarios
       WHERE LOWER(email) = LOWER($1) AND activo = TRUE AND email_verificado = TRUE
       FOR UPDATE`,
      [email]
    );
    if (rows.length === 1) {
      const usuario = rows[0];
      const reciente = await client.query(
        `SELECT 1 FROM tokens_temporales
         WHERE usuario_id = $1 AND tipo = 'reset_password'
           AND created_at > NOW() - INTERVAL '60 seconds'
         LIMIT 1`,
        [usuario.id]
      );
      if (!reciente.rows.length) {
        const token = generarTokenAleatorio(32);
        await client.query(
          `UPDATE tokens_temporales SET usado = TRUE
           WHERE usuario_id = $1 AND tipo = 'reset_password' AND usado = FALSE`,
          [usuario.id]
        );
        await client.query(
          `INSERT INTO tokens_temporales (usuario_id, tipo, token_hash, expires_at)
           VALUES ($1, 'reset_password', $2, NOW() + INTERVAL '15 minutes')`,
          [usuario.id, hashearToken(token)]
        );
        envio = { email: usuario.email, token };
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  // No esperar al SMTP en la respuesta pública: evita revelar si se envió un correo.
  // En este MVP el envío no usa una cola persistente. Un fallo permite volver a solicitarlo.
  if (envio) {
    void enviarEmailResetPassword(envio.email, '', envio.token).catch(() => {
      console.error('[auth.service] No se pudo enviar el correo de recuperación');
    });
  }
  // Reduce diferencias observables de tiempo; no es una garantía de tiempo constante.
  await new Promise(resolve => setTimeout(resolve, Math.max(0, 400 - (Date.now() - inicio))));
  return { ok: true, mensaje: MENSAJE_RECUPERACION };
}

export async function restablecerPassword(token, password) {
  const tokenHash = hashearToken(token);
  // Rechazar tokens inválidos antes de realizar bcrypt.
  const candidato = await pool.query(
    `SELECT usuario_id FROM tokens_temporales
     WHERE token_hash = $1 AND tipo = 'reset_password'
       AND usado = FALSE AND expires_at > NOW()`,
    [tokenHash]
  );
  if (!candidato.rows[0]) throw errorResetInvalido();
  const usuarioId = candidato.rows[0].usuario_id;
  const passwordHash = await hashearPassword(password);
  const client = await pool.connect();
  let email;
  try {
    await client.query('BEGIN');
    // Mismo orden de bloqueo que solicitarResetPassword y las operaciones sobre usuarios.
    const { rows } = await client.query(
      `SELECT email FROM usuarios WHERE id = $1 AND activo = TRUE
       AND email_verificado = TRUE FOR UPDATE`,
      [usuarioId]
    );
    if (!rows[0]) throw errorResetInvalido();
    email = rows[0].email;
    // El consumo se comprueba y se realiza de forma atómica, incluso con solicitudes simultáneas.
    const consumo = await client.query(
      `UPDATE tokens_temporales SET usado = TRUE
       WHERE token_hash = $1 AND usuario_id = $2 AND tipo = 'reset_password'
         AND usado = FALSE AND expires_at > clock_timestamp()
       RETURNING id`,
      [tokenHash, usuarioId]
    );
    if (!consumo.rowCount) throw errorResetInvalido();
    await client.query(
      `UPDATE usuarios SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, usuarioId]
    );
    await client.query(
      `UPDATE tokens_temporales SET usado = TRUE
       WHERE usuario_id = $1 AND tipo = 'reset_password' AND usado = FALSE`,
      [usuarioId]
    );
    // En la misma transacción: nunca cambiar la contraseña sin revocar las sesiones.
    await client.query(
      `UPDATE sesiones SET revocado = TRUE WHERE usuario_id = $1 AND revocado = FALSE`,
      [usuarioId]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  void enviarEmailPasswordActualizada(email).catch(() => {
    console.error('[auth.service] No se pudo enviar el aviso de cambio de contraseña');
  });
  return { ok: true, mensaje: 'Contraseña actualizada. Vuelve a iniciar sesión.' };
}
