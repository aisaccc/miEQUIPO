import { pool } from '../config/db.js';
import { crearNotificacion } from './notificaciones.service.js';
import { estanBloqueados, idsBloqueadosTotales, estadoBloqueo } from '../utils/bloqueos.js';

export async function enviarSolicitud(usuarioId, amigoId) {
  if (usuarioId === amigoId) {
    const err = new Error('No podés agregarte a vos mismo');
    err.status = 400;
    throw err;
  }

  if (await estanBloqueados(usuarioId, amigoId)) {
    const err = new Error('No podés enviar solicitudes a este usuario');
    err.status = 403;
    throw err;
  }

  const { rows: existe } = await pool.query(
    `SELECT id, estado FROM amistades 
     WHERE (usuario_id = $1 AND amigo_id = $2) OR (usuario_id = $2 AND amigo_id = $1)`,
    [usuarioId, amigoId]
  );

  if (existe.length > 0) {
    if (existe[0].estado === 'aceptada') {
      const err = new Error('Ya son amigos');
      err.status = 400;
      throw err;
    }
    if (existe[0].estado === 'pendiente') {
      const err = new Error('Ya hay una solicitud pendiente');
      err.status = 400;
      throw err;
    }
    await pool.query(
      `UPDATE amistades SET estado = 'pendiente', usuario_id = $1, amigo_id = $2, updated_at = NOW() WHERE id = $3`,
      [usuarioId, amigoId, existe[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO amistades (usuario_id, amigo_id, estado) VALUES ($1, $2, 'pendiente')`,
      [usuarioId, amigoId]
    );
  }

  const { rows: user } = await pool.query(`SELECT nombre FROM usuarios WHERE id = $1`, [usuarioId]);
  await crearNotificacion(
    amigoId, 
    'solicitud_amistad', 
    `${user[0].nombre} te envió una solicitud de amistad`, 
    '#/perfil'
  );

  return { ok: true, mensaje: 'Solicitud enviada' };
}

export async function responderSolicitud(usuarioId, solicitanteId, accion) {
  // Validar bloqueo al responder
  if (await estanBloqueados(usuarioId, solicitanteId)) {
    const err = new Error('No podés responder a este usuario');
    err.status = 403;
    throw err;
  }

  const estado = accion === 'aceptar' ? 'aceptada' : 'rechazada';
  
  const { rows } = await pool.query(
    `UPDATE amistades 
     SET estado = $1, updated_at = NOW() 
     WHERE usuario_id = $2 AND amigo_id = $3 AND estado = 'pendiente'
     RETURNING id`,
    [estado, solicitanteId, usuarioId]
  );

  if (rows.length === 0) {
    const err = new Error('Solicitud no encontrada');
    err.status = 404;
    throw err;
  }

  if (accion === 'aceptar') {
    const { rows: user } = await pool.query(`SELECT nombre FROM usuarios WHERE id = $1`, [usuarioId]);
    await crearNotificacion(
      solicitanteId,
      'solicitud_aceptada',
      `${user[0].nombre} aceptó tu solicitud de amistad`,
      `#/perfil`
    );
  }

  return { ok: true };
}

export async function listarAmigos(usuarioId) {
  const bloqueados = await idsBloqueadosTotales(usuarioId);
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre, u.username, u.avatar 
     FROM amistades a
     JOIN usuarios u ON (u.id = a.usuario_id OR u.id = a.amigo_id)
     WHERE (a.usuario_id = $1 OR a.amigo_id = $1) 
       AND a.estado = 'aceptada'
       AND u.id != $1`,
    [usuarioId]
  );
  return rows.filter(r => !bloqueados.includes(r.id));
}

export async function listarSolicitudes(usuarioId) {
  const bloqueados = await idsBloqueadosTotales(usuarioId);
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre, u.username, u.avatar 
     FROM amistades a
     JOIN usuarios u ON u.id = a.usuario_id
     WHERE a.amigo_id = $1 AND a.estado = 'pendiente'`,
    [usuarioId]
  );
  return rows.filter(r => !bloqueados.includes(r.id));
}

export async function obtenerEstado(usuarioId, otroId) {
  const b = await estadoBloqueo(usuarioId, otroId);
  if (b === 'me_bloqueo' || b === 'ambos') return { estado: 'bloqueado' };
  if (b === 'bloqueado_por_mi') return { estado: 'bloqueado_por_mi' };

  const { rows } = await pool.query(
    `SELECT usuario_id, amigo_id, estado FROM amistades 
     WHERE (usuario_id = $1 AND amigo_id = $2) OR (usuario_id = $2 AND amigo_id = $1)`,
    [usuarioId, otroId]
  );

  if (rows.length === 0) return { estado: 'ninguno' };

  const rel = rows[0];
  if (rel.estado === 'aceptada') return { estado: 'amigos' };
  if (rel.estado === 'pendiente') {
    return {
      estado: String(rel.usuario_id) === String(usuarioId) ? 'pendiente_enviada' : 'pendiente_recibida'
    };
  }
  return { estado: 'ninguno' };
}

export async function eliminarAmistad(usuarioId, amigoId) {
  const { rowCount } = await pool.query(
    `DELETE FROM amistades 
     WHERE (usuario_id = $1 AND amigo_id = $2) 
        OR (usuario_id = $2 AND amigo_id = $1)`,
    [usuarioId, amigoId]
  );
  if (rowCount === 0) {
    const err = new Error('No son amigos');
    err.status = 404;
    throw err;
  }
  return { ok: true, mensaje: 'Amigo eliminado' };
}

export async function bloquearUsuario(usuarioId, bloqueadoId) {
  if (usuarioId === bloqueadoId) {
    const err = new Error('No podés bloquearte a vos mismo');
    err.status = 400;
    throw err;
  }
  await pool.query(
    `INSERT INTO usuarios_bloqueados (usuario_id, bloqueado_id) 
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [usuarioId, bloqueadoId]
  );
  await pool.query(
    `DELETE FROM amistades 
     WHERE (usuario_id = $1 AND amigo_id = $2) 
        OR (usuario_id = $2 AND amigo_id = $1)`,
    [usuarioId, bloqueadoId]
  );
  return { ok: true, mensaje: 'Usuario bloqueado' };
}

export async function desbloquearUsuario(usuarioId, bloqueadoId) {
  const { rowCount } = await pool.query(
    `DELETE FROM usuarios_bloqueados 
     WHERE usuario_id = $1 AND bloqueado_id = $2`,
    [usuarioId, bloqueadoId]
  );
  if (rowCount === 0) {
    const err = new Error('Ese usuario no está bloqueado');
    err.status = 404;
    throw err;
  }
  return { ok: true, mensaje: 'Usuario desbloqueado' };
}
export async function listarBloqueados(usuarioId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre, u.username, u.avatar
     FROM usuarios_bloqueados ub
     JOIN usuarios u ON u.id = ub.bloqueado_id
     WHERE ub.usuario_id = $1`,
    [usuarioId]
  );
  return rows;
}
/* =========================================================
   GENERAR LINK DE AMISTAD
   ========================================================= */
export async function generarLinkAmistad(usuarioId) {
  const { rows } = await pool.query(
    `INSERT INTO invitaciones_links (tipo, referencia_id, creador_id) 
     VALUES ('amistad', $1, $1) RETURNING token`,
    [usuarioId]
  );
  return { token: rows[0].token };
}

/* =========================================================
   CONSUMIR LINK DE AMISTAD (Auto-amistad)
   ========================================================= */
export async function aceptarLinkAmistad(token, usuarioId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { rows: inv } = await client.query(
      `SELECT referencia_id FROM invitaciones_links WHERE token = $1 AND tipo = 'amistad'`,
      [token]
    );

    if (!inv[0]) {
      const err = new Error('Link de invitación inválido o expirado');
      err.status = 404;
      throw err;
    }

    const amigoId = inv[0].referencia_id;

    if (amigoId === usuarioId) {
      const err = new Error('No podés hacerte amigo de vos mismo');
      err.status = 400;
      throw err;
    }

    // Revisar si ya son amigos o hay pendiente
    const { rows: existe } = await client.query(
      `SELECT id, estado FROM amistades WHERE (usuario_id = $1 AND amigo_id = $2) OR (usuario_id = $2 AND amigo_id = $1)`,
      [usuarioId, amigoId]
    );

    if (existe.length > 0) {
      if (existe[0].estado === 'aceptada') {
        await client.query('COMMIT');
        return { ok: true, mensaje: 'Ya son amigos', yaEranAmigos: true };
      }
      // Si ya hay una solicitud pendiente, la aceptamos directamente
      await client.query(
        `UPDATE amistades SET estado = 'aceptada', updated_at = NOW() WHERE id = $1`,
        [existe[0].id]
      );
    } else {
      // Crear amistad directa (aceptada)
      await client.query(
        `INSERT INTO amistades (usuario_id, amigo_id, estado) VALUES ($1, $2, 'aceptada')`,
        [amigoId, usuarioId]
      );
    }

    // Notificar al creador del link
    const { rows: user } = await client.query(`SELECT nombre FROM usuarios WHERE id = $1`, [usuarioId]);
    await crearNotificacion(
      amigoId,
      'solicitud_aceptada',
      `${user[0].nombre} aceptó tu link y ahora son amigos`,
      `#/perfil`
    );

    await client.query('COMMIT');
    return { ok: true, mensaje: '¡Ahora son amigos!' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}