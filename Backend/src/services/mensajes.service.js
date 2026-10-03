/* =========================================================
   mensajes.service.js — Lógica de negocio de mensajería 1 a 1
   =========================================================
   SEGURIDAD:
   - Todas las queries parametrizadas
   - Se valida que el usuario sea participante antes de leer/escribir
   - Transacciones en crear conversación
   */

import { pool } from '../config/db.js';

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
    conversacionId: row.conversacion_id,
    autorId: row.autor_id,
    autor: {
      id: row.u_id,
      nombre: row.u_nombre,
      username: row.u_username,
      avatar: row.u_avatar,
    },
    texto: row.texto,
    createdAt: row.created_at,
  };
}

/**
 * Verifica que el usuario sea participante de la conversación.
 * Lanza error 403 si no lo es.
 */
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

/* =========================================================
   LISTAR MIS CONVERSACIONES
   ========================================================= */
export async function listarConversaciones(usuarioId) {
  const { rows } = await pool.query(
    `SELECT
       c.id,
       c.vinculada_tipo,
       c.vinculada_id,
       c.vinculada_nombre,
       c.created_at,
       c.ultima_actividad,
       cp.oculta,

       -- Datos del otro usuario
       u.id AS otro_id,
       u.nombre AS otro_nombre,
       u.username AS otro_username,
       u.avatar AS otro_avatar,

       -- Último mensaje
       m.id AS ultimo_mensaje_id,
       m.texto AS ultimo_mensaje_texto,
       m.created_at AS ultimo_mensaje_fecha,
       m.autor_id AS ultimo_mensaje_autor_id,

       -- Cantidad de no leídos (mensajes que no son míos y que no están en mensaje_lecturas)
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
       SELECT id, texto, created_at, autor_id
       FROM mensajes
       WHERE conversacion_id = c.id
       ORDER BY created_at DESC
       LIMIT 1
     ) m ON TRUE

     WHERE cp.oculta = FALSE
     ORDER BY c.ultima_actividad DESC`,
    [usuarioId]
  );

  return rows.map(row => formatearConversacion(row, {
    otroUsuario: {
      id: row.otro_id,
      nombre: row.otro_nombre,
      username: row.otro_username,
      avatar: row.otro_avatar,
    },
    ultimoMensaje: row.ultimo_mensaje_id ? {
      id: row.ultimo_mensaje_id,
      texto: row.ultimo_mensaje_texto,
      createdAt: row.ultimo_mensaje_fecha,
      autorId: row.ultimo_mensaje_autor_id,
    } : null,
    noLeidos: row.no_leidos,
  }));
}

/* =========================================================
   CREAR O OBTENER CONVERSACIÓN CON OTRO USUARIO
   ========================================================= */
export async function crearObtenerConversacion(usuarioId, datos) {
  const { usuarioId: otroUsuarioId, vinculadaTipo, vinculadaId, vinculadaNombre } = datos;

  if (String(usuarioId) === String(otroUsuarioId)) {
    const err = new Error('No podés crear una conversación contigo mismo');
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar que el otro usuario exista
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

    // Buscar si ya existe una conversación entre los dos
    const { rows: existente } = await client.query(
      `SELECT c.id, c.vinculada_tipo, c.vinculada_id, c.vinculada_nombre,
              c.created_at, c.ultima_actividad
       FROM conversaciones c
       WHERE EXISTS (
         SELECT 1 FROM conversacion_participantes
         WHERE conversacion_id = c.id AND usuario_id = $1
       )
       AND EXISTS (
         SELECT 1 FROM conversacion_participantes
         WHERE conversacion_id = c.id AND usuario_id = $2
       )
       AND (SELECT COUNT(*) FROM conversacion_participantes WHERE conversacion_id = c.id) = 2
       LIMIT 1`,
      [usuarioId, otroUsuarioId]
    );

    let conversacion;

    if (existente[0]) {
      conversacion = existente[0];

      // Si estaba oculta para mí, mostrarla de nuevo
      await client.query(
        `UPDATE conversacion_participantes
         SET oculta = FALSE
         WHERE conversacion_id = $1 AND usuario_id = $2`,
        [conversacion.id, usuarioId]
      );
    } else {
      // Crear nueva conversación
      const { rows: nueva } = await client.query(
        `INSERT INTO conversaciones (vinculada_tipo, vinculada_id, vinculada_nombre)
         VALUES ($1, $2, $3)
         RETURNING id, vinculada_tipo, vinculada_id, vinculada_nombre, created_at, ultima_actividad`,
        [vinculadaTipo || null, vinculadaId || null, vinculadaNombre || null]
      );

      conversacion = nueva[0];

      // Agregar los 2 participantes
      await client.query(
        `INSERT INTO conversacion_participantes (conversacion_id, usuario_id)
         VALUES ($1, $2), ($1, $3)`,
        [conversacion.id, usuarioId, otroUsuarioId]
      );
    }

    await client.query('COMMIT');

    // Devolver con datos del otro usuario y último mensaje
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
       c.created_at, c.ultima_actividad,
       cp.oculta,
       u.id AS otro_id, u.nombre AS otro_nombre,
       u.username AS otro_username, u.avatar AS otro_avatar,
       (
         SELECT COUNT(*)::int
         FROM mensajes m2
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
   =========================================================
   Devuelve los últimos 100 mensajes (ordenados ASC).
   */
export async function listarMensajes(conversacionId, usuarioId, opciones = {}) {
  const { limit = 100 } = opciones;

  await verificarParticipante(pool, conversacionId, usuarioId);

  const { rows } = await pool.query(
    `SELECT m.id, m.conversacion_id, m.autor_id, m.texto, m.created_at,
            u.id AS u_id, u.nombre AS u_nombre,
            u.username AS u_username, u.avatar AS u_avatar
     FROM mensajes m
     JOIN usuarios u ON u.id = m.autor_id
     WHERE m.conversacion_id = $1
     ORDER BY m.created_at DESC
     LIMIT $2`,
    [conversacionId, limit]
  );

  // Invertir para que queden en orden ASC (más viejo → más nuevo)
  return rows.reverse().map(formatearMensaje);
}

/* =========================================================
   ENVIAR MENSAJE
   ========================================================= */
export async function enviarMensaje(conversacionId, usuarioId, texto) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await verificarParticipante(client, conversacionId, usuarioId);

    // Insertar mensaje
    const { rows } = await client.query(
      `INSERT INTO mensajes (conversacion_id, autor_id, texto)
       VALUES ($1, $2, $3)
       RETURNING id, conversacion_id, autor_id, texto, created_at`,
      [conversacionId, usuarioId, texto]
    );

    // Actualizar ultima_actividad de la conversación
    await client.query(
      `UPDATE conversaciones
       SET ultima_actividad = NOW()
       WHERE id = $1`,
      [conversacionId]
    );

    // Si el otro participante había ocultado la conversación, mostrarla de nuevo
    await client.query(
      `UPDATE conversacion_participantes
       SET oculta = FALSE
       WHERE conversacion_id = $1 AND usuario_id != $2`,
      [conversacionId, usuarioId]
    );

    // Marcar como leído por el autor (no le aparece su propio mensaje como no leído)
    await client.query(
      `INSERT INTO mensaje_lecturas (mensaje_id, usuario_id)
       VALUES ($1, $2)
       ON CONFLICT (mensaje_id, usuario_id) DO NOTHING`,
      [rows[0].id, usuarioId]
    );

    await client.query('COMMIT');

    // Devolver con datos del autor
    const { rows: mensajeCompleto } = await pool.query(
      `SELECT m.id, m.conversacion_id, m.autor_id, m.texto, m.created_at,
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
   MARCAR MENSAJES COMO LEÍDOS
   =========================================================
   Marca todos los mensajes de la conversación (que no son míos)
   como leídos por mí.
   */
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
   OCULTAR CONVERSACIÓN (soft delete para el usuario)
   =========================================================
   Marca `oculta = TRUE` para el usuario actual.
   NO borra los mensajes para el otro.
   */
export async function ocultarConversacion(conversacionId, usuarioId) {
  const { rowCount } = await pool.query(
    `UPDATE conversacion_participantes
     SET oculta = TRUE
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
export async function contarNoLeidos(usuarioId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM mensajes m
     JOIN conversacion_participantes cp
       ON cp.conversacion_id = m.conversacion_id AND cp.usuario_id = $1
     WHERE m.autor_id != $1
       AND cp.oculta = FALSE
       AND NOT EXISTS (
         SELECT 1 FROM mensaje_lecturas ml
         WHERE ml.mensaje_id = m.id AND ml.usuario_id = $1
       )`,
    [usuarioId]
  );

  return rows[0].total;
}