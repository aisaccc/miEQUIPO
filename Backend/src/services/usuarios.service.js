/* =========================================================
   usuarios.service.js — Lógica de negocio de usuarios
   ========================================================= */

import { pool } from '../config/db.js';
import { hashearPassword, verificarPassword } from '../utils/password.js';
import { estadoBloqueo } from '../utils/bloqueos.js';
import { HERO_COLORS, MARCOS_PREMIUM, esColorHex } from '../utils/colores.js';

/* =========================================================
   CAMPOS PÚBLICOS
   ========================================================= */

const CAMPOS_PERFIL_PROPIO = `
  id, nombre, username, email, avatar, bio, edad, pais, ciudad,
  deportes, email_verificado, created_at, last_login,
  hero_color, hero_foto, stats_hero_base, stats_hero_privadas, notificaciones_prefs,
  mensajes_solo_amigos,
  plan, premium_desde, premium_hasta, premium_origen,
  marco_perfil, marco_color, marco_brillante /* ⚡ AGREGADO */
`;

const CAMPOS_PERFIL_PUBLICO = `
  id, nombre, username, avatar, bio, edad, pais, ciudad,
  deportes, created_at,
  hero_color, hero_foto,
  stats_hero_base, stats_hero_privadas,
  plan, premium_hasta,
  marco_perfil, marco_color, marco_brillante /* ⚡ AGREGADO */
`;
/* =========================================================
   HELPERS
   ========================================================= */

function calcularEsPremium(row) {
  if (row.plan !== 'premium') return false;
  if (!row.premium_hasta) return true;
  return new Date(row.premium_hasta) > new Date();
}

function formatearPerfilPropio(row, stats = {}) {
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
    heroColor: row.hero_color || 'navy',
    heroFoto: row.hero_foto || null,
    statsHeroBase: row.stats_hero_base || {},
    statsHeroPrivadas: row.stats_hero_privadas || {},
    notificacionesPrefs: row.notificaciones_prefs || { partidos: true, torneos: true, mensajes: true },
    mensajesSoloAmigos: row.mensajes_solo_amigos ?? false,
    plan: row.plan || 'basico',
    esPremium: calcularEsPremium(row),
    premiumDesde: row.premium_desde,
    premiumHasta: row.premium_hasta,
    premiumOrigen: row.premium_origen,
    marcoPerfil: row.marco_perfil || 'default',
    marcoColor: row.marco_color || null,
    marcoBrillante: row.marco_brillante || false, /* ⚡ AGREGADO */
    statsHero: {
      partidos:  stats.partidos ?? 0,
      torneos:   stats.torneos  ?? 0,
      equipos:   stats.equipos  ?? 0,
    },
  };
}

function formatearPerfilPublico(row, stats = {}) {
  const deportes = (row.deportes || []).map(d => ({
    deporte: d.deporte,
    posiciones: d.posiciones || [],
    stats: Object.fromEntries(
      Object.entries(d.stats || {}).filter(([, v]) => v && v.publico)
    )
  }));

  const privadas = row.stats_hero_privadas || {};
  const base = row.stats_hero_base || {};

  const statsHero = {
    partidos: privadas.partidos ? null : (Number(base.partidos) || 0) + (stats.partidos || 0),
    torneos:  privadas.torneos  ? null : (stats.torneos  || 0),
    equipos:  privadas.equipos  ? null : (stats.equipos  || 0),
  };

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
    heroColor: row.hero_color || 'navy',
    heroFoto: row.hero_foto || null,
    statsHero,
    statsHeroPrivadas: privadas,
    plan: row.plan || 'basico',
    esPremium: calcularEsPremium(row),
    marcoPerfil: row.marco_perfil || 'default',
    marcoColor: row.marco_color || null,
    marcoBrillante: row.marco_brillante || false, /* ⚡ AGREGADO */
  };
}

async function contarStatsHero(usuarioId) {
  const [partidosRes, torneosRes, equiposRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(DISTINCT p.id)::int AS total
       FROM partidos p
       WHERE p.estado = 'finalizado'
         AND (
           EXISTS (
             SELECT 1 FROM partido_inscripciones pi
             WHERE pi.partido_id = p.id AND pi.usuario_id = $1
           )
           OR EXISTS (
             SELECT 1
             FROM partido_equipos_inscritos pei
             JOIN grupo_miembros gm ON gm.grupo_id = pei.equipo_id
             WHERE pei.partido_id = p.id AND gm.usuario_id = $1
           )
         )`,
      [usuarioId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total FROM torneos WHERE organizador_id = $1`,
      [usuarioId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM grupo_miembros gm
       JOIN grupos g ON g.id = gm.grupo_id
       WHERE gm.usuario_id = $1 AND g.tipo = 'equipo'`,
      [usuarioId]
    ),
  ]);

  return {
    partidos: partidosRes.rows[0].total,
    torneos:  torneosRes.rows[0].total,
    equipos:  equiposRes.rows[0].total,
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

  const stats = await contarStatsHero(usuarioId);
  return formatearPerfilPropio(rows[0], stats);
}

/* =========================================================
   GET /api/usuarios/me/plan
   ========================================================= */
export async function obtenerMiPlan(usuarioId) {
  const { rows } = await pool.query(
    `SELECT plan, premium_desde, premium_hasta, premium_origen
     FROM usuarios
     WHERE id = $1 AND activo = TRUE`,
    [usuarioId]
  );

  if (!rows[0]) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }

  const row = rows[0];
  return {
    plan: row.plan || 'basico',
    esPremium: calcularEsPremium(row),
    premiumDesde: row.premium_desde,
    premiumHasta: row.premium_hasta,
    premiumOrigen: row.premium_origen,
  };
}

/* =========================================================
   GET /api/usuarios/:id  (perfil público)
   ========================================================= */
export async function obtenerPerfilPublico(usuarioId, usuarioActualId) {
  if (usuarioActualId) {
    const estado = await estadoBloqueo(usuarioActualId, usuarioId);
    if (estado === 'me_bloqueo' || estado === 'ambos') {
      const err = new Error('Usuario no disponible');
      err.status = 403;
      throw err;
    }
  }

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

  const stats = await contarStatsHero(usuarioId);
  return formatearPerfilPublico(rows[0], stats);
}

/* =========================================================
   PATCH /api/usuarios/me
   ========================================================= */
export async function actualizarMiPerfil(usuarioId, cambios) {
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

  const cambiosFinales = { ...cambios };

  // Traemos plan si es necesario validar
  const necesitaPlan =
    (cambiosFinales.marcoPerfil !== undefined && cambiosFinales.marcoPerfil !== 'default') ||
    (cambiosFinales.heroColor !== undefined && !HERO_COLORS.includes(cambiosFinales.heroColor)) ||
    (cambiosFinales.heroFoto !== undefined && cambiosFinales.heroFoto !== null); // ⚡ NUEVO

  let esPrem = false;
  if (necesitaPlan) {
    const { rows: uRows } = await pool.query(
      'SELECT plan, premium_hasta FROM usuarios WHERE id = $1',
      [usuarioId]
    );
    esPrem = calcularEsPremium(uRows[0] || {});
  }

  // Validación: MARCO DE PERFIL
  if (cambiosFinales.marcoPerfil !== undefined) {
    const esMarcoPremium = cambiosFinales.marcoPerfil !== 'default';
    if (esMarcoPremium && !esPrem) {
      const err = new Error('Los marcos de perfil son exclusivos del plan Premium.');
      err.status = 403;
      throw err;
    }
    if (cambiosFinales.marcoPerfil === 'custom') {
      if (!cambiosFinales.marcoColor) {
        const err = new Error('Ellge un color para tu marco custom.');
        err.status = 400;
        throw err;
      }
      if (!esColorHex(cambiosFinales.marcoColor)) {
        const err = new Error('El color del marco debe ser un hexadecimal válido (#RRGGBB).');
        err.status = 400;
        throw err;
      }
    } else {
      cambiosFinales.marcoColor = null;
    }
  }

  // Validación: HERO COLOR CUSTOM
  // Validación: HERO COLOR CUSTOM
  if (cambiosFinales.heroColor !== undefined) {
    const esPredefinido = HERO_COLORS.includes(cambiosFinales.heroColor);
    if (!esPredefinido && !esPrem) {
      const err = new Error('Los colores personalizados son exclusivos del plan Premium.');
      err.status = 403;
      throw err;
    }
  }

  // ⚡ NUEVO: Validación: HERO FOTO
  if (cambiosFinales.heroFoto !== undefined && cambiosFinales.heroFoto !== null) {
    if (!esPrem) {
      const err = new Error('La foto de portada es exclusiva del plan Premium.');
      err.status = 403;
      throw err;
    }
  }

  const mapaCampos = {
    nombre: 'nombre',
    username: 'username',
    bio: 'bio',
    ciudad: 'ciudad',
    pais: 'pais',
    edad: 'edad',
    avatar: 'avatar',
    heroColor: 'hero_color',
    heroFoto: 'hero_foto',
    statsHeroBase: 'stats_hero_base',
    statsHeroPrivadas: 'stats_hero_privadas',
    notificacionesPrefs: 'notificaciones_prefs',
    mensajesSoloAmigos: 'mensajes_solo_amigos',
    marcoPerfil: 'marco_perfil',
    marcoColor: 'marco_color',
    marcoBrillante: 'marco_brillante', /* ⚡ AGREGADO */
  };

  const campos = [];
  const valores = [];
  let i = 1;

  for (const [key, col] of Object.entries(mapaCampos)) {
    if (cambiosFinales[key] === undefined) continue;

    if (key === 'statsHeroBase' || key === 'statsHeroPrivadas' || key === 'notificacionesPrefs') {
      campos.push(`${col} = $${i}::jsonb`);
      valores.push(JSON.stringify(cambiosFinales[key]));
    } else {
      campos.push(`${col} = $${i}`);
      valores.push(cambiosFinales[key]);
    }
    i++;
  }

  if (campos.length === 0) {
    return obtenerMiPerfil(usuarioId);
  }

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

  return obtenerMiPerfil(usuarioId);
}

/* =========================================================
   PATCH /api/usuarios/me/deportes
   ========================================================= */
export async function actualizarMisDeportes(usuarioId, deportes) {
  const { rows: uRows } = await pool.query(
    'SELECT plan, premium_hasta, deportes FROM usuarios WHERE id = $1',
    [usuarioId]
  );
  
  if (!uRows[0]) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }

  const esPrem = calcularEsPremium(uRows[0]);
  const deportesActuales = uRows[0].deportes || [];

  // ⚡ VALIDACIÓN PREMIUM
  if (!esPrem) {
    for (const depNuevo of deportes) {
      const depViejo = deportesActuales.find(d => d.deporte === depNuevo.deporte);
      // Si las stats que envía son distintas a las que ya tenía, rebotamos
      if (JSON.stringify(depNuevo.stats || {}) !== JSON.stringify(depViejo?.stats || {})) {
        const err = new Error('Las estadísticas por deporte son exclusivas del plan Premium.');
        err.status = 403;
        throw err;
      }
    }
  }

  const { rows } = await pool.query(
    `UPDATE usuarios
     SET deportes = $1::jsonb, updated_at = NOW()
     WHERE id = $2 AND activo = TRUE
     RETURNING ${CAMPOS_PERFIL_PROPIO}`,
    [JSON.stringify(deportes), usuarioId]
  );

  return formatearPerfilPropio(rows[0]);
}

/* =========================================================
   PATCH /api/usuarios/me/password
   ========================================================= */
export async function cambiarMiPassword(usuarioId, passwordActual, passwordNueva) {
  const { rows } = await pool.query(
    `SELECT password_hash FROM usuarios WHERE id = $1 AND activo = TRUE`,
    [usuarioId]
  );

  if (!rows[0]) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }

  const ok = await verificarPassword(passwordActual, rows[0].password_hash);
  if (!ok) {
    const err = new Error('La contraseña actual es incorrecta');
    err.status = 401;
    throw err;
  }

  const nuevoHash = await hashearPassword(passwordNueva);

  await pool.query(
    `UPDATE usuarios
     SET password_hash = $1, updated_at = NOW()
     WHERE id = $2`,
    [nuevoHash, usuarioId]
  );

  await pool.query(
    `UPDATE sesiones
     SET revocado = TRUE
     WHERE usuario_id = $1 AND revocado = FALSE`,
    [usuarioId]
  );

  return {
    ok: true,
    mensaje: 'Contraseña actualizada. Vuelve a iniciar sesión en todos tus dispositivos.'
  };
}

/* =========================================================
   DELETE /api/usuarios/me
   ========================================================= */
export async function eliminarMiCuenta(usuarioId, password) {
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

  await pool.query(
    `UPDATE usuarios
     SET activo = FALSE, updated_at = NOW()
     WHERE id = $1`,
    [usuarioId]
  );

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

/* =========================================================
   BUSCAR USUARIOS (Mejorado para invitaciones)
   ========================================================= */
export async function buscarUsuarios(query, usuarioExcluirId, limit = 20) {
  const q = `%${String(query).trim()}%`;
  if (cambiosFinales.marcoBrillante === true && !esPrem) {
  const err = new Error(
    'El marco brillante requiere plan Premium.'
  );
  err.status = 403;
  throw err;
}

  const { rows } = await pool.query(
    `SELECT u.id, u.nombre, u.username, u.avatar,
            a.estado AS estado_amistad,
            (a.usuario_id = $1) AS solicitud_enviada_por_mi
     FROM usuarios u
     LEFT JOIN amistades a ON (a.usuario_id = $1 AND a.amigo_id = u.id) OR (a.amigo_id = $1 AND a.usuario_id = u.id)
     WHERE u.activo = TRUE
       AND u.id != $1
       AND (u.nombre ILIKE $2 OR u.username ILIKE $2)
     ORDER BY u.nombre ASC
     LIMIT $3`,
    [usuarioExcluirId, q, limit]
  );

  return rows;
}
const necesitaPlan =
  (cambiosFinales.marcoPerfil !== undefined &&
   cambiosFinales.marcoPerfil !== 'default') ||

  (cambiosFinales.heroColor !== undefined &&
   !HERO_COLORS.includes(cambiosFinales.heroColor)) ||

  (cambiosFinales.heroFoto !== undefined &&
   cambiosFinales.heroFoto !== null) ||

  cambiosFinales.marcoBrillante === true;