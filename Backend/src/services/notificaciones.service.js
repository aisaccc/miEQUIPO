/* =========================================================
   notificaciones.service.js — Lógica de negocio de notificaciones
   ========================================================= */

import { pool } from '../config/db.js';

/* =========================================================
   HELPERS
   ========================================================= */
/* ---------- MAPEO DE TIPOS A CATEGORÍAS ---------- */
function categoriaNotif(tipo) {
  const partidos = [
    'inscripcion', 'salida', 'postulacion', 'aprobado', 'rechazado', 
    'confirmacion_partido', 'confirmacion_aceptada', 'confirmacion_rechazada', 
    'partido_confirmado', 'partido_revertido', 'nuevo_interesado', 
    'jugador_salio', 'expulsado', 'partido_actualizado', 'partido_eliminado'
  ];
  const torneos = [
    'cierre', 'edicion', 'cancelacion', 'equipo_eliminado', 'torneo_eliminado', 
    'invitacion', 'invitacion_organizador', 'respuesta_invitacion_organizador', 'torneo_actualizado'
  ];
  const mensajes = ['mensaje']; // Por si a futuro agregás notifs de mensajes
  
  if (partidos.includes(tipo)) return 'partidos';
  if (torneos.includes(tipo)) return 'torneos';
  if (mensajes.includes(tipo)) return 'mensajes';
  
  // Si es de amigos (solicitud_amistad, etc.), lo dejamos pasar siempre
  return null; 
}
function formatearNotificacion(row) {
  return {
    id: row.id,
    tipo: row.tipo,
    mensaje: row.mensaje,
    link: row.link,
    leida: row.leida,
    createdAt: row.created_at,
  };
}

/* =========================================================
   LISTAR NOTIFICACIONES
   ========================================================= */
export async function listarNotificaciones(usuarioId, filtros = {}) {
  const { soloNoLeidas, tipo, page = 1, limit = 50 } = filtros;

  const condiciones = ['usuario_id = $1'];
  const valores = [usuarioId];
  let i = 2;

  if (soloNoLeidas === 'true') {
    condiciones.push(`leida = FALSE`);
  }

  if (tipo) {
    condiciones.push(`tipo = $${i}`);
    valores.push(tipo);
    i++;
  }

  const where = `WHERE ${condiciones.join(' AND ')}`;

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM notificaciones ${where}`,
    valores
  );
  const total = countRows[0].total;

  const offset = (page - 1) * limit;
  const parametrosFinales = [...valores, limit, offset];

  const { rows } = await pool.query(
    `SELECT id, tipo, mensaje, link, leida, created_at
     FROM notificaciones
     ${where}
     ORDER BY created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    parametrosFinales
  );

  return {
    data: rows.map(formatearNotificacion),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/* =========================================================
   CONTAR NO LEÍDAS (para badge)
   ========================================================= */
export async function contarNoLeidas(usuarioId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM notificaciones
     WHERE usuario_id = $1 AND leida = FALSE`,
    [usuarioId]
  );

  return rows[0].total;
}

/* =========================================================
   MARCAR UNA COMO LEÍDA
   ========================================================= */
export async function marcarLeida(notificacionId, usuarioId) {
  const { rows } = await pool.query(
    `UPDATE notificaciones
     SET leida = TRUE
     WHERE id = $1 AND usuario_id = $2
     RETURNING id, tipo, mensaje, link, leida, created_at`,
    [notificacionId, usuarioId]
  );

  if (!rows[0]) {
    const err = new Error('Notificación no encontrada');
    err.status = 404;
    throw err;
  }

  return formatearNotificacion(rows[0]);
}

/* =========================================================
   MARCAR TODAS COMO LEÍDAS
   ========================================================= */
export async function marcarTodasLeidas(usuarioId) {
  const { rowCount } = await pool.query(
    `UPDATE notificaciones
     SET leida = TRUE
     WHERE usuario_id = $1 AND leida = FALSE`,
    [usuarioId]
  );

  return {
    ok: true,
    marcadas: rowCount,
    mensaje: rowCount > 0
      ? `${rowCount} notificación${rowCount !== 1 ? 'es' : ''} marcada${rowCount !== 1 ? 's' : ''} como leída${rowCount !== 1 ? 's' : ''}`
      : 'No había notificaciones sin leer',
  };
}

/* =========================================================
   ELIMINAR UNA NOTIFICACIÓN
   ========================================================= */
export async function eliminarNotificacion(notificacionId, usuarioId) {
  const { rowCount } = await pool.query(
    `DELETE FROM notificaciones
     WHERE id = $1 AND usuario_id = $2`,
    [notificacionId, usuarioId]
  );

  if (rowCount === 0) {
    const err = new Error('Notificación no encontrada');
    err.status = 404;
    throw err;
  }

  return { ok: true, mensaje: 'Notificación eliminada' };
}

/* =========================================================
   ELIMINAR TODAS LAS LEÍDAS (limpieza)
   ========================================================= */
export async function eliminarLeidas(usuarioId) {
  const { rowCount } = await pool.query(
    `DELETE FROM notificaciones
     WHERE usuario_id = $1 AND leida = TRUE`,
    [usuarioId]
  );

  return {
    ok: true,
    eliminadas: rowCount,
    mensaje: `${rowCount} notificación${rowCount !== 1 ? 'es' : ''} eliminada${rowCount !== 1 ? 's' : ''}`,
  };
}

/* =========================================================
   CREAR NOTIFICACIÓN (uso interno desde otros services)
   ========================================================= */
export async function crearNotificacion(usuarioId, tipo, mensaje, link = null) {
  if (!usuarioId) {
    console.warn('[notificaciones] crearNotificacion sin usuarioId');
    return null;
  }

  // ⚡ Verificar si el usuario quiere esta categoría
  const cat = categoriaNotif(tipo);
  if (cat) {
    const { rows } = await pool.query(
      `SELECT notificaciones_prefs->>$1 AS pref FROM usuarios WHERE id = $2`,
      [cat, usuarioId]
    );
    // Si la preferencia es exactamente 'false', abortamos el envío
    if (rows[0] && rows[0].pref === 'false') {
      return null;
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO notificaciones (usuario_id, tipo, mensaje, link)
     VALUES ($1, $2, $3, $4)
     RETURNING id, tipo, mensaje, link, leida, created_at`,
    [usuarioId, tipo, mensaje, link]
  );

  return formatearNotificacion(rows[0]);
}

/* =========================================================
   CREAR NOTIFICACIÓN A MÚLTIPLES USUARIOS
   ========================================================= */
export async function crearNotificacionMultiple(usuarioIds, tipo, mensaje, link = null, opciones = {}) {
  if (!Array.isArray(usuarioIds) || usuarioIds.length === 0) return [];

  // El cliente opcional permite que las notificaciones sean atómicas con el cambio.
  const db = opciones.client || pool;
  const idsUnicos = [...new Set(usuarioIds.filter(Boolean).map(String))];
  if (!idsUnicos.length) return [];

  const categoria = categoriaNotif(tipo);
  const obligatoria = opciones.obligatoria === true;

  // Una sola inserción, sin duplicados y sin límite de parámetros por destinatario.
  // Los avisos de cambios/cancelaciones son operativos y no se silencian
  // mediante la preferencia de notificaciones sociales.
  const { rows } = await db.query(
    `INSERT INTO notificaciones (usuario_id, tipo, mensaje, link)
     SELECT u.id, $2, $3, $4
     FROM usuarios u
     JOIN (SELECT DISTINCT UNNEST($1::uuid[]) AS usuario_id) d ON d.usuario_id = u.id
     WHERE u.activo = TRUE
       AND (
         $5::boolean = TRUE
         OR $6::text IS NULL
         OR (u.notificaciones_prefs ->> $6::text) IS DISTINCT FROM 'false'
       )
     RETURNING id, tipo, mensaje, link, leida, created_at`,
    [idsUnicos, tipo, mensaje, link, obligatoria, categoria]
  );

  return rows.map(formatearNotificacion);
}
