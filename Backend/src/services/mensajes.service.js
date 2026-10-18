/* =========================================================
   mensajes.service.js — Lógica de negocio de mensajería
   ========================================================= */

import { pool } from '../config/db.js';
import { estanBloqueados, idsBloqueadosTotales } from '../utils/bloqueos.js';

/* =========================================================
   HELPERS
   ========================================================= */

function formatearConversacion(row, extras = {}) {
  return {
    id: row.id,
    vinculadaTipo: row.vinculada_tipo,
    vinculadaId: row.vinculada_id,
    vinculadaNombre: row.vinculada_nombre,
    createdAt: row.created_at,
    ultimaActividad: row.ultima_actividad,
    otroUsuario: extras.otroUsuario || null,
    ultimoMensaje: extras.ultimoMensaje || null,
    noLeidos: extras.noLeidos ?? 0,
  };
}

function formatearMensaje(row) {
  return {
    id: row.id,
    conversacionId: row.conversacion_id || null,
    canalId: row.canal_id || null,
    autorId: row.autor_id,
    autor: {
      id: row.u_id,
      nombre: row.u_nombre,
      username: row.u_username,
      avatar: row.u_avatar,
    },
    texto: row.texto,
    imagen: row.imagen || null,
    createdAt: row.created_at,
  };
}

function formatearCanal(row, extras = {}) {
  return {
    id: row.id,
    tipo: row.tipo,
    refId: row.ref_id,
    nombre: row.nombre,
    icono: row.icono,
    createdAt: row.created_at,
    ultimoMensaje: extras.ultimoMensaje || null,
    noLeidos: extras.noLeidos ?? 0,
    totalMiembros: extras.totalMiembros ?? 0,
  };
}

async function verificarParticipante(client, conversacionId, usuarioId) {
  const { rows } = await client.query(
    `SELECT 1 FROM conversacion_participantes
     WHERE conversacion_id = $1 AND usuario_id = $2`,
    [conversacionId, usuarioId]
  );
  if (rows.length === 0) {
    const err = new Error('No tenés acceso a esta conversación');
    err.status = 403;
    throw err;
  }
}

async function verificarMiembroCanal(client, canalId, usuarioId) {
  const { rows } = await client.query(
    `SELECT 1 FROM canal_miembros
     WHERE canal_id = $1 AND usuario_id = $2`,
    [canalId, usuarioId]
  );
  if (rows.length === 0) {
    const err = new Error('No sos miembro de este canal');
    err.status = 403;
    throw err;
  }
}

/* =========================================================
   LISTAR MIS CONVERSACIONES (1 a 1)
   ========================================================= */
export async function listarConversaciones(usuarioId) {
  const bloqueados = await idsBloqueadosTotales(usuarioId);

  const { rows } = await pool.query(
    `SELECT
       c.id, c.vinculada_tipo, c.vinculada_id, c.vinculada_nombre,
       c.created_at, c.ultima_actividad, cp.oculta,
       u.id AS otro_id, u.nombre AS otro_nombre,
       u.username AS otro_username, u.avatar AS otro_avatar,
       m.id AS ultimo_mensaje_id, m.texto AS ultimo_mensaje_texto,
       m.imagen AS ultimo_mensaje_imagen, m.created_at AS ultimo_mensaje_fecha,
       m.autor_id AS ultimo_mensaje_autor_id,
       (
         SELECT COUNT(*)::int
         FROM mensajes m2
         WHERE m2.conversacion_id = c.id
           AND m2.autor_id != $1
           AND NOT EXISTS (
             SELECT 1 FROM mensaje_lecturas ml
             WHERE ml.mensaje_id = m2.id AND ml.usuario_id = $1
           )
       ) AS no_leidos
     FROM conversaciones c
     JOIN conversacion_participantes cp
       ON cp.conversacion_id = c.id AND cp.usuario_id = $1
     JOIN conversacion_participantes cp2
       ON cp2.conversacion_id = c.id AND cp2.usuario_id != $1
     JOIN usuarios u ON u.id = cp2.usuario_id
     LEFT JOIN LATERAL (
       SELECT id, texto, imagen, created_at, autor_id
       FROM mensajes
       WHERE conversacion_id = c.id
       ORDER BY created_at DESC
       LIMIT 1
     ) m ON TRUE
     WHERE cp.oculta = FALSE
     ORDER BY c.ultima_actividad DESC`,
    [usuarioId]
  );

  return rows
    .filter(row => !bloqueados.includes(row.otro_id))
    .map(row => formatearConversacion(row, {
      otroUsuario: {
        id: row.otro_id,
        nombre: row.otro_nombre,
        username: row.otro_username,
        avatar: row.otro_avatar,
      },
      ultimoMensaje: row.ultimo_mensaje_id ? {
        id: row.ultimo_mensaje_id,
        texto: row.ultimo_mensaje_texto,
        imagen: row.ultimo_mensaje_imagen || null,
        createdAt: row.ultimo_mensaje_fecha,
        autorId: row.ultimo_mensaje_autor_id,
      } : null,
      noLeidos: row.no_leidos,
    }));
}

/* =========================================================
   CREAR O OBTENER CONVERSACIÓN 1 A 1
   ========================================================= */
export async function crearObtenerConversacion(usuarioId, datos) {
  const { usuarioId: otroUsuarioId, vinculadaTipo, vinculadaId, vinculadaNombre } = datos;

  if (String(usuarioId) === String(otroUsuarioId)) {
    const err = new Error('No podés crear una conversación contigo mismo');
    err.status = 400;
    throw err;
  }

  if (await estanBloqueados(usuarioId, otroUsuarioId)) {
    const err = new Error('No podés enviar mensajes a este usuario');
    err.status = 403;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: usuarioExiste } = await client.query(
      `SELECT id, nombre, username, avatar FROM usuarios
       WHERE id = $1 AND activo = TRUE`,
      [otroUsuarioId]
    );
    if (!usuarioExiste[0]) {
      const err = new Error('Usuario no encontrado');
      err.status = 404;
      throw err;
    }

    const { rows: existente } = await client.query(
      `SELECT c.id, c.vinculada_tipo, c.vinculada_id, c.vinculada_nombre,
              c.created_at, c.ultima_actividad
       FROM conversaciones c
       WHERE EXISTS (SELECT 1 FROM conversacion_participantes WHERE conversacion_id = c.id AND usuario_id = $1)
       AND EXISTS (SELECT 1 FROM conversacion_participantes WHERE conversacion_id = c.id AND usuario_id = $2)
       AND (SELECT COUNT(*) FROM conversacion_participantes WHERE conversacion_id = c.id) = 2
       LIMIT 1`,
      [usuarioId, otroUsuarioId]
    );

    let conversacion;
    if (existente[0]) {
      conversacion = existente[0];
      await client.query(
        `UPDATE conversacion_participantes SET oculta = FALSE
         WHERE conversacion_id = $1 AND usuario_id = $2`,
        [conversacion.id, usuarioId]
      );
    } else {
      const { rows: nueva } = await client.query(
        `INSERT INTO conversaciones (vinculada_tipo, vinculada_id, vinculada_nombre)
         VALUES ($1, $2, $3)
         RETURNING id, vinculada_tipo, vinculada_id, vinculada_nombre, created_at, ultima_actividad`,
        [vinculadaTipo || null, vinculadaId || null, vinculadaNombre || null]
      );
      conversacion = nueva[0];
      await client.query(
        `INSERT INTO conversacion_participantes (conversacion_id, usuario_id)
         VALUES ($1, $2), ($1, $3)`,
        [conversacion.id, usuarioId, otroUsuarioId]
      );
    }

    await client.query('COMMIT');
    return obtenerConversacion(conversacion.id, usuarioId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   OBTENER UNA CONVERSACIÓN
   ========================================================= */
export async function obtenerConversacion(conversacionId, usuarioId) {
  await verificarParticipante(pool, conversacionId, usuarioId);

  const { rows } = await pool.query(
    `SELECT
       c.id, c.vinculada_tipo, c.vinculada_id, c.vinculada_nombre,
       c.created_at, c.ultima_actividad, cp.oculta,
       u.id AS otro_id, u.nombre AS otro_nombre,
       u.username AS otro_username, u.avatar AS otro_avatar,
       (
         SELECT COUNT(*)::int FROM mensajes m2
         WHERE m2.conversacion_id = c.id
           AND m2.autor_id != $2
           AND NOT EXISTS (
             SELECT 1 FROM mensaje_lecturas ml
             WHERE ml.mensaje_id = m2.id AND ml.usuario_id = $2
           )
       ) AS no_leidos
     FROM conversaciones c
     JOIN conversacion_participantes cp
       ON cp.conversacion_id = c.id AND cp.usuario_id = $2
     JOIN conversacion_participantes cp2
       ON cp2.conversacion_id = c.id AND cp2.usuario_id != $2
     JOIN usuarios u ON u.id = cp2.usuario_id
     WHERE c.id = $1`,
    [conversacionId, usuarioId]
  );

  if (!rows[0]) {
    const err = new Error('Conversación no encontrada');
    err.status = 404;
    throw err;
  }

  const row = rows[0];
  return formatearConversacion(row, {
    otroUsuario: {
      id: row.otro_id,
      nombre: row.otro_nombre,
      username: row.otro_username,
      avatar: row.otro_avatar,
    },
    noLeidos: row.no_leidos,
  });
}

/* =========================================================
   LISTAR MENSAJES DE UNA CONVERSACIÓN
   ========================================================= */
export async function listarMensajes(conversacionId, usuarioId, opciones = {}) {
  const { limit = 100 } = opciones;
  await verificarParticipante(pool, conversacionId, usuarioId);

  const { rows } = await pool.query(
    `SELECT m.id, m.conversacion_id, m.canal_id, m.autor_id, m.texto, m.imagen, m.created_at,
            u.id AS u_id, u.nombre AS u_nombre,
            u.username AS u_username, u.avatar AS u_avatar
     FROM mensajes m
     JOIN usuarios u ON u.id = m.autor_id
     WHERE m.conversacion_id = $1
     ORDER BY m.created_at DESC
     LIMIT $2`,
    [conversacionId, limit]
  );

  return rows.reverse().map(formatearMensaje);
}

/* =========================================================
   ENVIAR MENSAJE A CONVERSACIÓN
   ========================================================= */
export async function enviarMensaje(conversacionId, usuarioId, texto, imagen = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await verificarParticipante(client, conversacionId, usuarioId);

    const { rows: otroRows } = await client.query(
      `SELECT usuario_id FROM conversacion_participantes
       WHERE conversacion_id = $1 AND usuario_id != $2`,
      [conversacionId, usuarioId]
    );
    if (otroRows[0] && await estanBloqueados(usuarioId, otroRows[0].usuario_id)) {
      const err = new Error('No podés enviar mensajes a este usuario');
      err.status = 403;
      throw err;
    }

    const { rows } = await client.query(
      `INSERT INTO mensajes (conversacion_id, autor_id, texto, imagen)
       VALUES ($1, $2, $3, $4)
       RETURNING id, conversacion_id, canal_id, autor_id, texto, imagen, created_at`,
      [conversacionId, usuarioId, texto || null, imagen || null]
    );

    await client.query(
      `UPDATE conversaciones SET ultima_actividad = NOW() WHERE id = $1`,
      [conversacionId]
    );

    await client.query(
      `UPDATE conversacion_participantes SET oculta = FALSE
       WHERE conversacion_id = $1 AND usuario_id != $2`,
      [conversacionId, usuarioId]
    );

    await client.query(
      `INSERT INTO mensaje_lecturas (mensaje_id, usuario_id)
       VALUES ($1, $2) ON CONFLICT (mensaje_id, usuario_id) DO NOTHING`,
      [rows[0].id, usuarioId]
    );

    await client.query('COMMIT');

    const { rows: mensajeCompleto } = await pool.query(
      `SELECT m.id, m.conversacion_id, m.canal_id, m.autor_id, m.texto, m.imagen, m.created_at,
              u.id AS u_id, u.nombre AS u_nombre,
              u.username AS u_username, u.avatar AS u_avatar
       FROM mensajes m
       JOIN usuarios u ON u.id = m.autor_id
       WHERE m.id = $1`,
      [rows[0].id]
    );

    return formatearMensaje(mensajeCompleto[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   MARCAR MENSAJES COMO LEÍDOS (conversación)
   ========================================================= */
export async function marcarLeidos(conversacionId, usuarioId) {
  await verificarParticipante(pool, conversacionId, usuarioId);

  const { rowCount } = await pool.query(
    `INSERT INTO mensaje_lecturas (mensaje_id, usuario_id)
     SELECT m.id, $2
     FROM mensajes m
     WHERE m.conversacion_id = $1
       AND m.autor_id != $2
       AND NOT EXISTS (
         SELECT 1 FROM mensaje_lecturas ml
         WHERE ml.mensaje_id = m.id AND ml.usuario_id = $2
       )
     ON CONFLICT (mensaje_id, usuario_id) DO NOTHING`,
    [conversacionId, usuarioId]
  );

  return { ok: true, marcados: rowCount };
}

/* =========================================================
   OCULTAR CONVERSACIÓN (soft delete)
   ========================================================= */
export async function ocultarConversacion(conversacionId, usuarioId) {
  const { rowCount } = await pool.query(
    `UPDATE conversacion_participantes SET oculta = TRUE
     WHERE conversacion_id = $1 AND usuario_id = $2`,
    [conversacionId, usuarioId]
  );

  if (rowCount === 0) {
    const err = new Error('No sos participante de esta conversación');
    err.status = 404;
    throw err;
  }

  return { ok: true, mensaje: 'Conversación ocultada' };
}

/* =========================================================
   CONTAR MENSAJES NO LEÍDOS (total, para badge)
   ========================================================= */
/* =========================================================
   CONTAR MENSAJES NO LEÍDOS (total, para badge)
   ========================================================= */
export async function contarNoLeidos(usuarioId) {
  const bloqueados = await idsBloqueadosTotales(usuarioId);

  // 1. Contar mensajes no leídos de conversaciones 1 a 1 (SIN bloqueados)
  const { rows: rowsConv } = await pool.query(
    `SELECT m.id, cp2.usuario_id AS otro_id
     FROM mensajes m
     JOIN conversacion_participantes cp
       ON cp.conversacion_id = m.conversacion_id AND cp.usuario_id = $1
     JOIN conversacion_participantes cp2
       ON cp2.conversacion_id = m.conversacion_id AND cp2.usuario_id != $1
     WHERE m.autor_id != $1
       AND cp.oculta = FALSE
       AND NOT EXISTS (
         SELECT 1 FROM mensaje_lecturas ml
         WHERE ml.mensaje_id = m.id AND ml.usuario_id = $1
       )`,
    [usuarioId]
  );

  // Filtramos en JS para ignorar a los usuarios bloqueados
  const totalConv = rowsConv.filter(row => !bloqueados.includes(row.otro_id)).length;

  // 2. Contar mensajes no leídos de canales (equipos + torneos)
  const { rows: rowsCanal } = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM mensajes m
     JOIN canal_miembros cm
       ON cm.canal_id = m.canal_id AND cm.usuario_id = $1
     WHERE m.autor_id != $1
       AND m.canal_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM mensaje_lecturas ml
         WHERE ml.mensaje_id = m.id AND ml.usuario_id = $1
       )`,
    [usuarioId]
  );

  return totalConv + (rowsCanal[0].total || 0);
}

/* =========================================================
   LISTAR MIS CANALES (equipos + torneos)
   ========================================================= */
export async function listarCanales(usuarioId) {
  const { rows } = await pool.query(
    `SELECT
       c.id, c.tipo, c.ref_id, c.nombre, c.icono, c.created_at,
       (SELECT COUNT(*)::int FROM canal_miembros cm2 WHERE cm2.canal_id = c.id) AS total_miembros,
       m.id AS ultimo_mensaje_id, m.texto AS ultimo_mensaje_texto,
       m.imagen AS ultimo_mensaje_imagen, m.created_at AS ultimo_mensaje_fecha,
       m.autor_id AS ultimo_mensaje_autor_id, um.nombre AS ultimo_mensaje_autor_nombre,
       (
         SELECT COUNT(*)::int FROM mensajes m2
         WHERE m2.canal_id = c.id
           AND m2.autor_id != $1
           AND NOT EXISTS (
             SELECT 1 FROM mensaje_lecturas ml
             WHERE ml.mensaje_id = m2.id AND ml.usuario_id = $1
           )
       ) AS no_leidos
     FROM canales c
     JOIN canal_miembros cm
       ON cm.canal_id = c.id AND cm.usuario_id = $1
     LEFT JOIN LATERAL (
       SELECT id, texto, imagen, created_at, autor_id
       FROM mensajes
       WHERE canal_id = c.id
       ORDER BY created_at DESC
       LIMIT 1
     ) m ON TRUE
     LEFT JOIN usuarios um ON um.id = m.autor_id
     ORDER BY COALESCE(m.created_at, c.created_at) DESC`,
    [usuarioId]
  );

  return rows.map(row => formatearCanal(row, {
    totalMiembros: row.total_miembros,
    ultimoMensaje: row.ultimo_mensaje_id ? {
      id: row.ultimo_mensaje_id,
      texto: row.ultimo_mensaje_texto,
      imagen: row.ultimo_mensaje_imagen || null,
      createdAt: row.ultimo_mensaje_fecha,
      autorId: row.ultimo_mensaje_autor_id,
      autorNombre: row.ultimo_mensaje_autor_nombre,
    } : null,
    noLeidos: row.no_leidos,
  }));
}

/* =========================================================
   OBTENER UN CANAL
   ========================================================= */
export async function obtenerCanal(canalId, usuarioId) {
  await verificarMiembroCanal(pool, canalId, usuarioId);

  const { rows } = await pool.query(
    `SELECT
       c.id, c.tipo, c.ref_id, c.nombre, c.icono, c.created_at,
       (SELECT COUNT(*)::int FROM canal_miembros cm2 WHERE cm2.canal_id = c.id) AS total_miembros,
       (
         SELECT COUNT(*)::int FROM mensajes m2
         WHERE m2.canal_id = c.id
           AND m2.autor_id != $2
           AND NOT EXISTS (
             SELECT 1 FROM mensaje_lecturas ml
             WHERE ml.mensaje_id = m2.id AND ml.usuario_id = $2
           )
       ) AS no_leidos
     FROM canales c
     WHERE c.id = $1`,
    [canalId, usuarioId]
  );

  if (!rows[0]) {
    const err = new Error('Canal no encontrado');
    err.status = 404;
    throw err;
  }

  const row = rows[0];
  return formatearCanal(row, {
    totalMiembros: row.total_miembros,
    noLeidos: row.no_leidos,
  });
}

/* =========================================================
   LISTAR MENSAJES DE UN CANAL
   ========================================================= */
export async function listarMensajesDeCanal(canalId, usuarioId, opciones = {}) {
  const { limit = 100 } = opciones;
  await verificarMiembroCanal(pool, canalId, usuarioId);

  const { rows } = await pool.query(
    `SELECT m.id, m.conversacion_id, m.canal_id, m.autor_id, m.texto, m.imagen, m.created_at,
            u.id AS u_id, u.nombre AS u_nombre,
            u.username AS u_username, u.avatar AS u_avatar
     FROM mensajes m
     JOIN usuarios u ON u.id = m.autor_id
     WHERE m.canal_id = $1
     ORDER BY m.created_at DESC
     LIMIT $2`,
    [canalId, limit]
  );

  return rows.reverse().map(formatearMensaje);
}

/* =========================================================
   ENVIAR MENSAJE A UN CANAL
   ========================================================= */
export async function enviarMensajeACanal(canalId, usuarioId, texto, imagen = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await verificarMiembroCanal(client, canalId, usuarioId);

    const { rows } = await client.query(
      `INSERT INTO mensajes (canal_id, autor_id, texto, imagen)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [canalId, usuarioId, texto || null, imagen || null]
    );

    await client.query(
      `INSERT INTO mensaje_lecturas (mensaje_id, usuario_id)
       VALUES ($1, $2) ON CONFLICT (mensaje_id, usuario_id) DO NOTHING`,
      [rows[0].id, usuarioId]
    );

    await client.query('COMMIT');

    const { rows: mensajeCompleto } = await pool.query(
      `SELECT m.id, m.conversacion_id, m.canal_id, m.autor_id, m.texto, m.imagen, m.created_at,
              u.id AS u_id, u.nombre AS u_nombre,
              u.username AS u_username, u.avatar AS u_avatar
       FROM mensajes m
       JOIN usuarios u ON u.id = m.autor_id
       WHERE m.id = $1`,
      [rows[0].id]
    );

    return formatearMensaje(mensajeCompleto[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   MARCAR MENSAJES DE UN CANAL COMO LEÍDOS
   ========================================================= */
export async function marcarCanalLeido(canalId, usuarioId) {
  await verificarMiembroCanal(pool, canalId, usuarioId);

  const { rowCount } = await pool.query(
    `INSERT INTO mensaje_lecturas (mensaje_id, usuario_id)
     SELECT m.id, $2
     FROM mensajes m
     WHERE m.canal_id = $1
       AND m.autor_id != $2
       AND NOT EXISTS (
         SELECT 1 FROM mensaje_lecturas ml
         WHERE ml.mensaje_id = m.id AND ml.usuario_id = $2
       )
     ON CONFLICT (mensaje_id, usuario_id) DO NOTHING`,
    [canalId, usuarioId]
  );

  return { ok: true, marcados: rowCount };
}

/* =========================================================
   HELPERS PARA USAR DESDE OTROS SERVICIOS
   ========================================================= */

export async function crearCanalParaGrupo(client, grupo, capitanId) {
  const canalId = `grupo-${grupo.id}`;
  await client.query(
    `INSERT INTO canales (id, tipo, ref_id, nombre, icono)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [canalId, grupo.tipo || 'equipo', grupo.id, grupo.nombre, grupo.escudo || '🛡️']
  );
  await client.query(
    `INSERT INTO canal_miembros (canal_id, usuario_id)
     VALUES ($1, $2) ON CONFLICT (canal_id, usuario_id) DO NOTHING`,
    [canalId, capitanId]
  );
  return canalId;
}

export async function agregarMiembroACanal(client, canalId, usuarioId) {
  await client.query(
    `INSERT INTO canal_miembros (canal_id, usuario_id)
     VALUES ($1, $2) ON CONFLICT (canal_id, usuario_id) DO NOTHING`,
    [canalId, usuarioId]
  );
}

export async function agregarMiembrosACanal(client, canalId, usuarioIds) {
  if (!Array.isArray(usuarioIds) || usuarioIds.length === 0) return;
  const values = [];
  const placeholders = [];
  let i = 1;
  usuarioIds.forEach(uid => {
    placeholders.push(`($${i}, $${i + 1})`);
    values.push(canalId, uid);
    i += 2;
  });
  await client.query(
    `INSERT INTO canal_miembros (canal_id, usuario_id)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (canal_id, usuario_id) DO NOTHING`,
    values
  );
}

export async function quitarMiembroDeCanal(client, canalId, usuarioId) {
  await client.query(
    `DELETE FROM canal_miembros WHERE canal_id = $1 AND usuario_id = $2`,
    [canalId, usuarioId]
  );
}

export async function quitarMiembrosDeCanal(client, canalId, usuarioIds) {
  if (!Array.isArray(usuarioIds) || usuarioIds.length === 0) return;
  await client.query(
    `DELETE FROM canal_miembros
     WHERE canal_id = $1 AND usuario_id = ANY($2::uuid[])`,
    [canalId, usuarioIds]
  );
}

export async function obtenerCanalDeGrupo(grupoId) {
  const { rows } = await pool.query(
    `SELECT id FROM canales
     WHERE ref_id = $1 AND tipo IN ('equipo', 'comunidad', 'grupo')
     LIMIT 1`,
    [grupoId]
  );
  return rows[0]?.id || null;
}

export async function obtenerCanalDeTorneo(torneoId) {
  const { rows } = await pool.query(
    `SELECT id FROM canales WHERE ref_id = $1 AND tipo = 'torneo' LIMIT 1`,
    [torneoId]
  );
  return rows[0]?.id || null;
}

export async function crearCanalParaTorneo(client, torneo, organizadorId) {
  const canalId = torneo.canal_chat_id;
  if (!canalId) throw new Error('El torneo no tiene canal_chat_id asignado');
  await client.query(
    `INSERT INTO canales (id, tipo, ref_id, nombre, icono)
     VALUES ($1, 'torneo', $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [canalId, torneo.id, torneo.nombre, torneo.emoji || '🏆']
  );
  await client.query(
    `INSERT INTO canal_miembros (canal_id, usuario_id)
     VALUES ($1, $2) ON CONFLICT (canal_id, usuario_id) DO NOTHING`,
    [canalId, organizadorId]
  );
  return canalId;
}