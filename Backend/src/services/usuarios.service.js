/* =========================================================
   usuarios.service.js — Lógica de negocio de usuarios
   =========================================================
   Este archivo NO sabe de req/res.
   Solo recibe datos, toca la BD y devuelve resultados.

   SEGURIDAD:
   - Filtra por usuario_id en cada query (evita IDOR)
   - Usa queries parametrizadas (evita SQL injection)
   - Nunca expone password_hash ni datos sensibles
   - SELECT explícito (nunca SELECT *)
*/

import { pool } from '../config/db.js';
import { hashearPassword, verificarPassword } from '../utils/password.js';

/* =========================================================
   CAMPOS PÚBLICOS (lo que se devuelve al cliente)
   ========================================================= */

const CAMPOS_PERFIL_PROPIO = `
  id, nombre, username, email, avatar, bio, edad, pais, ciudad,
  deportes, email_verificado, created_at, last_login
`;

const CAMPOS_PERFIL_PUBLICO = `
  id, nombre, username, avatar, bio, edad, pais, ciudad,
  deportes, created_at
`;

/* =========================================================
   HELPERS
   ========================================================= */

function formatearPerfilPropio(row) {
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

function formatearPerfilPublico(row) {
  // Filtra stats privadas de los deportes antes de devolver
  const deportes = (row.deportes || []).map(d => ({
    deporte: d.deporte,
    posiciones: d.posiciones || [],
    // Solo devolver stats públicas
    stats: Object.fromEntries(
      Object.entries(d.stats || {}).filter(([, v]) => v && v.publico)
    )
  }));

  return {
    id: row.id,
    nombre: row.nombre,
    username: row.username,
    avatar: row.avatar,
    bio: row.bio,
    edad: row.edad,
    pais: row.pais,
    ciudad: row.ciudad,
    deportes,
    createdAt: row.created_at,
  };
}

/* =========================================================
   GET /api/usuarios/me
   ========================================================= */
export async function obtenerMiPerfil(usuarioId) {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS_PERFIL_PROPIO}
     FROM usuarios
     WHERE id = $1 AND activo = TRUE`,
    [usuarioId]
  );

  if (!rows[0]) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }

  return formatearPerfilPropio(rows[0]);
}

/* =========================================================
   GET /api/usuarios/:id  (perfil público)
   =========================================================
   SEGURIDAD:
   - Solo devuelve campos públicos
   - Filtra stats privadas
   - No permite listar todos los usuarios
*/
export async function obtenerPerfilPublico(usuarioId) {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS_PERFIL_PUBLICO}
     FROM usuarios
     WHERE id = $1 AND activo = TRUE`,
    [usuarioId]
  );

  if (!rows[0]) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }

  return formatearPerfilPublico(rows[0]);
}

/* =========================================================
   PATCH /api/usuarios/me
   =========================================================
   SEGURIDAD:
   - Solo actualiza campos de la whitelist
   - Ignora silenciosamente cualquier intento de cambiar
     email, password_hash, email_verificado, activo, etc.
   - Valida que username no esté en uso por otro
*/
export async function actualizarMiPerfil(usuarioId, cambios) {
  // 1. Si intenta cambiar username, verificar que no esté tomado
  if (cambios.username) {
    const { rows: existentes } = await pool.query(
      `SELECT id FROM usuarios
       WHERE LOWER(username) = LOWER($1)
         AND id != $2
       LIMIT 1`,
      [cambios.username, usuarioId]
    );

    if (existentes.length > 0) {
      const err = new Error('Ese nombre de usuario ya está en uso');
      err.status = 409;
      throw err;
    }
  }

  // 2. Whitelist de campos permitidos
  const permitidos = ['nombre', 'username', 'bio', 'ciudad', 'pais', 'edad', 'avatar'];
  const campos = [];
  const valores = [];
  let i = 1;

  for (const campo of permitidos) {
    if (cambios[campo] !== undefined) {
      campos.push(`${campo} = $${i}`);
      valores.push(cambios[campo]);
      i++;
    }
  }

  if (campos.length === 0) {
    // Nada que actualizar → devolver el perfil actual
    return obtenerMiPerfil(usuarioId);
  }

  // 3. Actualizar
  valores.push(usuarioId);

  const { rows } = await pool.query(
    `UPDATE usuarios
     SET ${campos.join(', ')}, updated_at = NOW()
     WHERE id = $${i} AND activo = TRUE
     RETURNING ${CAMPOS_PERFIL_PROPIO}`,
    valores
  );

  if (!rows[0]) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }

  return formatearPerfilPropio(rows[0]);
}

/* =========================================================
   PATCH /api/usuarios/me/deportes
   =========================================================
   Reemplaza TODO el array de deportes.
   Los deportes se guardan como JSONB.
*/
export async function actualizarMisDeportes(usuarioId, deportes) {
  const { rows } = await pool.query(
    `UPDATE usuarios
     SET deportes = $1::jsonb, updated_at = NOW()
     WHERE id = $2 AND activo = TRUE
     RETURNING ${CAMPOS_PERFIL_PROPIO}`,
    [JSON.stringify(deportes), usuarioId]
  );

  if (!rows[0]) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }

  return formatearPerfilPropio(rows[0]);
}

/* =========================================================
   PATCH /api/usuarios/me/password
   =========================================================
   SEGURIDAD:
   - Requiere la contraseña actual
   - Hashea la nueva con bcrypt
   - Revoca TODAS las sesiones activas (buena práctica)
*/
export async function cambiarMiPassword(usuarioId, passwordActual, passwordNueva) {
  // 1. Traer el hash actual
  const { rows } = await pool.query(
    `SELECT password_hash FROM usuarios WHERE id = $1 AND activo = TRUE`,
    [usuarioId]
  );

  if (!rows[0]) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }

  // 2. Verificar contraseña actual
  const ok = await verificarPassword(passwordActual, rows[0].password_hash);
  if (!ok) {
    const err = new Error('La contraseña actual es incorrecta');
    err.status = 401;
    throw err;
  }

  // 3. Hashear la nueva
  const nuevoHash = await hashearPassword(passwordNueva);

  // 4. Actualizar
  await pool.query(
    `UPDATE usuarios
     SET password_hash = $1, updated_at = NOW()
     WHERE id = $2`,
    [nuevoHash, usuarioId]
  );

  // 5. Revocar todas las sesiones (por seguridad)
  await pool.query(
    `UPDATE sesiones
     SET revocado = TRUE
     WHERE usuario_id = $1 AND revocado = FALSE`,
    [usuarioId]
  );

  return {
    ok: true,
    mensaje: 'Contraseña actualizada. Volvé a iniciar sesión en todos tus dispositivos.'
  };
}

/* =========================================================
   DELETE /api/usuarios/me
   =========================================================
   Soft delete: marca activo = false.
   SEGURIDAD:
   - Requiere confirmar con la contraseña
   - Requiere escribir "ELIMINAR"
   - Revoca todas las sesiones
   - NO borra datos físicamente (permite recuperación)
*/
export async function eliminarMiCuenta(usuarioId, password) {
  // 1. Verificar contraseña
  const { rows } = await pool.query(
    `SELECT password_hash FROM usuarios WHERE id = $1 AND activo = TRUE`,
    [usuarioId]
  );

  if (!rows[0]) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }

  const ok = await verificarPassword(password, rows[0].password_hash);
  if (!ok) {
    const err = new Error('Contraseña incorrecta');
    err.status = 401;
    throw err;
  }

  // 2. Soft delete
  await pool.query(
    `UPDATE usuarios
     SET activo = FALSE, updated_at = NOW()
     WHERE id = $1`,
    [usuarioId]
  );

  // 3. Revocar todas las sesiones
  await pool.query(
    `UPDATE sesiones
     SET revocado = TRUE
     WHERE usuario_id = $1`,
    [usuarioId]
  );

  return {
    ok: true,
    mensaje: 'Cuenta eliminada correctamente'
  };
}