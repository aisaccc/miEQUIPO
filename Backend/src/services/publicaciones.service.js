/* =========================================================
   publicaciones.service.js — Lógica de negocio
   ========================================================= */

import { pool } from '../config/db.js';

/* =========================================================
   HELPERS
   ========================================================= */

function formatearPublicacion(row, extras = {}) {
  return {
    id: row.id,
    tipo: row.tipo,
    scope: row.scope || 'perfil',
    grupoId: row.grupo_id || null,
    torneoId: row.torneo_id || null,
    contenido: row.contenido,
    imagen: row.imagen,
    video: row.video,
    createdAt: row.created_at,
    autor: extras.autor || null,
    totalLikes: extras.totalLikes ?? 0,
    totalComentarios: extras.totalComentarios ?? 0,
    yoLikee: extras.yoLikee ?? false,
    // Contexto (solo para feed)
    grupo: extras.grupo || null,
    torneo: extras.torneo || null,
  };
}

function formatearComentario(row) {
  return {
    id: row.id,
    texto: row.texto,
    createdAt: row.created_at,
    autor: {
      id: row.autor_id,
      nombre: row.autor_nombre,
      username: row.autor_username,
      avatar: row.autor_avatar,
    },
  };
}

/**
 * SELECT base reutilizable para listar publicaciones.
 * Incluye autor + contadores + flags.
 */
function sqlBasePublicacion(whereClause) {
  return `
    SELECT
      p.id, p.tipo, p.scope, p.grupo_id, p.torneo_id,
      p.contenido, p.imagen, p.video, p.created_at,
      u.id AS autor_id, u.nombre AS autor_nombre,
      u.username AS autor_username, u.avatar AS autor_avatar,
      (SELECT COUNT(*)::int FROM publicacion_likes pl WHERE pl.publicacion_id = p.id) AS total_likes,
      (SELECT COUNT(*)::int FROM publicacion_comentarios pc WHERE pc.publicacion_id = p.id) AS total_comentarios,
      EXISTS (
        SELECT 1 FROM publicacion_likes pl
        WHERE pl.publicacion_id = p.id AND pl.usuario_id = $1
      ) AS yo_likee
    FROM publicaciones p
    JOIN usuarios u ON u.id = p.autor_id
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT 100
  `;
}

function parsearFilas(rows) {
  return rows.map(row => formatearPublicacion(row, {
    autor: {
      id: row.autor_id,
      nombre: row.autor_nombre,
      username: row.autor_username,
      avatar: row.autor_avatar,
    },
    totalLikes: row.total_likes,
    totalComentarios: row.total_comentarios,
    yoLikee: row.yo_likee,
  }));
}

/* =========================================================
   LISTAR POR USUARIO (perfil público)
   ========================================================= */
export async function listarPorUsuario(usuarioId, usuarioActualId) {
  const { rows } = await pool.query(
    sqlBasePublicacion(`WHERE p.autor_id = $2 AND p.scope = 'perfil'`),
    [usuarioActualId, usuarioId]
  );
  return parsearFilas(rows);
}

/* =========================================================
   LISTAR POR GRUPO
   ========================================================= */
export async function listarPorGrupo(grupoId, usuarioActualId) {
  const { rows } = await pool.query(
    sqlBasePublicacion(`WHERE p.grupo_id = $2 AND p.scope = 'grupo'`),
    [usuarioActualId, grupoId]
  );
  return parsearFilas(rows);
}

/* =========================================================
   LISTAR POR TORNEO
   ========================================================= */
export async function listarPorTorneo(torneoId, usuarioActualId) {
  const { rows } = await pool.query(
    sqlBasePublicacion(`WHERE p.torneo_id = $2 AND p.scope = 'torneo'`),
    [usuarioActualId, torneoId]
  );
  return parsearFilas(rows);
}

/* =========================================================
   FEED GLOBAL (Inicio) — perfil + torneos
   =========================================================
   Mezcla publicaciones de perfil y de torneos (para que las
   de torneos aparezcan en el inicio).
   ========================================================= */
export async function feedGlobal(usuarioActualId) {
  const { rows } = await pool.query(
    sqlBasePublicacion(`
      WHERE p.scope IN ('perfil', 'torneo')
    `),
    [usuarioActualId]
  );

  const publicaciones = parsearFilas(rows);

  // Adjuntar datos del torneo (para mostrar contexto)
  const idsTorneo = [...new Set(publicaciones.map(p => p.torneoId).filter(Boolean))];
  if (idsTorneo.length > 0) {
    const { rows: torneos } = await pool.query(
      `SELECT id, nombre, emoji, deporte FROM torneos WHERE id = ANY($1::uuid[])`,
      [idsTorneo]
    );
    const mapTorneos = new Map(torneos.map(t => [String(t.id), t]));

    publicaciones.forEach(p => {
      if (p.torneoId) {
        const t = mapTorneos.get(String(p.torneoId));
        if (t) {
          p.torneo = {
            id: t.id,
            nombre: t.nombre,
            emoji: t.emoji,
            deporte: t.deporte,
          };
        }
      }
    });
  }

  return publicaciones;
}

/* =========================================================
   CREAR (perfil)
   ========================================================= */
export async function crear(usuarioId, datos) {
  const { rows } = await pool.query(
    `INSERT INTO publicaciones (autor_id, tipo, scope, contenido, imagen)
     VALUES ($1, 'post', 'perfil', $2, $3)
     RETURNING id`,
    [usuarioId, datos.contenido || null, datos.imagen || null]
  );

  return { id: rows[0].id };
}

/* =========================================================
   CREAR EN GRUPO
   ========================================================= */
export async function crearEnGrupo(grupoId, usuarioId, datos) {
  const { rows } = await pool.query(
    `INSERT INTO publicaciones (autor_id, tipo, scope, grupo_id, contenido, imagen)
     VALUES ($1, 'grupo', 'grupo', $2, $3, $4)
     RETURNING id`,
    [usuarioId, grupoId, datos.contenido || null, datos.imagen || null]
  );

  return { id: rows[0].id };
}

/* =========================================================
   CREAR EN TORNEO
   ========================================================= */
export async function crearEnTorneo(torneoId, usuarioId, datos) {
  const { rows } = await pool.query(
    `INSERT INTO publicaciones (autor_id, tipo, scope, torneo_id, contenido, imagen)
     VALUES ($1, 'torneo', 'torneo', $2, $3, $4)
     RETURNING id`,
    [usuarioId, torneoId, datos.contenido || null, datos.imagen || null]
  );

  return { id: rows[0].id };
}

/* =========================================================
   OBTENER POR ID (helper interno)
   ========================================================= */
async function obtenerPublicacionOFallar(id) {
  const { rows } = await pool.query(
    `SELECT * FROM publicaciones WHERE id = $1`,
    [id]
  );

  if (!rows[0]) {
    const err = new Error('Publicación no encontrada');
    err.status = 404;
    throw err;
  }

  return rows[0];
}

/* =========================================================
   EDITAR (solo autor, solo descripción)
   ========================================================= */
export async function editar(id, usuarioId, datos) {
  const pub = await obtenerPublicacionOFallar(id);

  if (String(pub.autor_id) !== String(usuarioId)) {
    const err = new Error('No tenés permiso para editar esta publicación');
    err.status = 403;
    throw err;
  }

  if (datos.contenido !== undefined) {
    await pool.query(
      `UPDATE publicaciones SET contenido = $1 WHERE id = $2`,
      [datos.contenido || null, id]
    );
  }

  return { ok: true };
}

/* =========================================================
   ELIMINAR (solo autor)
   ========================================================= */
export async function eliminar(id, usuarioId) {
  const pub = await obtenerPublicacionOFallar(id);

  if (String(pub.autor_id) !== String(usuarioId)) {
    const err = new Error('No tenés permiso para eliminar esta publicación');
    err.status = 403;
    throw err;
  }

  await pool.query(`DELETE FROM publicaciones WHERE id = $1`, [id]);

  return { ok: true };
}

/* =========================================================
   TOGGLE LIKE
   ========================================================= */
export async function toggleLike(id, usuarioId) {
  await obtenerPublicacionOFallar(id);

  const { rows: existentes } = await pool.query(
    `SELECT 1 FROM publicacion_likes
     WHERE publicacion_id = $1 AND usuario_id = $2`,
    [id, usuarioId]
  );

  if (existentes.length > 0) {
    await pool.query(
      `DELETE FROM publicacion_likes
       WHERE publicacion_id = $1 AND usuario_id = $2`,
      [id, usuarioId]
    );
    return { yoLikee: false };
  }

  await pool.query(
    `INSERT INTO publicacion_likes (publicacion_id, usuario_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [id, usuarioId]
  );
  return { yoLikee: true };
}

/* =========================================================
   LISTAR COMENTARIOS
   ========================================================= */
export async function listarComentarios(id) {
  await obtenerPublicacionOFallar(id);

  const { rows } = await pool.query(
    `SELECT
       c.id, c.texto, c.created_at, c.autor_id,
       u.nombre AS autor_nombre,
       u.username AS autor_username,
       u.avatar AS autor_avatar
     FROM publicacion_comentarios c
     JOIN usuarios u ON u.id = c.autor_id
     WHERE c.publicacion_id = $1
     ORDER BY c.created_at ASC`,
    [id]
  );

  return rows.map(formatearComentario);
}

/* =========================================================
   CREAR COMENTARIO
   ========================================================= */
export async function crearComentario(id, usuarioId, texto) {
  await obtenerPublicacionOFallar(id);

  const { rows } = await pool.query(
    `INSERT INTO publicacion_comentarios (publicacion_id, autor_id, texto)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [id, usuarioId, texto]
  );

  return { id: rows[0].id };
}