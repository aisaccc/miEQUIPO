import { pool } from '../config/db.js';
import { crearNotificacion } from './notificaciones.service.js';

/* =========================================================
   ENVIAR SOLICITUD
   ========================================================= */
export async function enviarSolicitud(usuarioId, amigoId) {
  if (usuarioId === amigoId) {
    const err = new Error('No podés agregarte a vos mismo');
    err.status = 400;
    throw err;
  }

  // Verificar si ya existe una amistad o solicitud
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
    // Si fue rechazada, actualizamos a pendiente
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

  // Notificar al receptor
  const { rows: user } = await pool.query(`SELECT nombre FROM usuarios WHERE id = $1`, [usuarioId]);
  await crearNotificacion(
    amigoId, 
    'solicitud_amistad', 
    `${user[0].nombre} te envió una solicitud de amistad`, 
    '#/perfil'
  );

  return { ok: true, mensaje: 'Solicitud enviada' };
}

/* =========================================================
   RESPONDER SOLICITUD (aceptar / rechazar)
   ========================================================= */
export async function responderSolicitud(usuarioId, solicitanteId, accion) {
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
      `#/perfil` // Podría ser un link al perfil, pero usamos el genérico
    );
  }

  return { ok: true };
}

/* =========================================================
   LISTAR AMIGOS
   ========================================================= */
export async function listarAmigos(usuarioId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre, u.username, u.avatar 
     FROM amistades a
     JOIN usuarios u ON (u.id = a.usuario_id OR u.id = a.amigo_id)
     WHERE (a.usuario_id = $1 OR a.amigo_id = $1) 
       AND a.estado = 'aceptada'
       AND u.id != $1`,
    [usuarioId]
  );
  return rows;
}

/* =========================================================
   LISTAR SOLICITUDES PENDIENTES (recibidas)
   ========================================================= */
export async function listarSolicitudes(usuarioId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre, u.username, u.avatar 
     FROM amistades a
     JOIN usuarios u ON u.id = a.usuario_id
     WHERE a.amigo_id = $1 AND a.estado = 'pendiente'`,
    [usuarioId]
  );
  return rows;
}

/* =========================================================
   OBTENER ESTADO CON UN USUARIO
   ========================================================= */
export async function obtenerEstado(usuarioId, otroId) {
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

  return { estado: 'ninguno' }; // Rechazada
}