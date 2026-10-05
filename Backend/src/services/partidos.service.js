/* =========================================================
   partidos.service.js — Lógica de negocio de partidos
   ========================================================= */

import { pool } from '../config/db.js';
import {
  crearNotificacion,
  crearNotificacionMultiple,
} from './notificaciones.service.js';

/* =========================================================
   HELPERS
   ========================================================= */

function esUuidValido(str) {
  if (!str) return false;
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(str));
}

function formatearPartido(row, extras = {}) {
  return {
    id: row.id,
    titulo: row.titulo,
    deporte: row.deporte,
    emoji: row.emoji,
    tipoPartido: row.tipo_partido,
    descripcion: row.descripcion,
    lugar: row.lugar,
    fecha: row.fecha,
    cupos: row.cupos,
    precio: row.precio,
    nivel: row.nivel,
    estado: row.estado,
    estadoPartido: row.estado_partido,
    aprobacionRequerida: row.aprobacion_requerida,
    pedirPosiciones: row.pedir_posiciones,
    posiciones: row.posiciones || [],
    organizadorEquipoId: row.organizador_equipo_id,
    organizador: extras.organizador || null,
    totalInscritos: extras.totalInscritos ?? 0,
    totalEquiposInscritos: extras.totalEquiposInscritos ?? 0,
    totalPostulantes: extras.totalPostulantes ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function obtenerPartidoOFallar(client, partidoId) {
  const { rows } = await client.query(
    `SELECT * FROM partidos WHERE id = $1`,
    [partidoId]
  );

  if (!rows[0]) {
    const err = new Error('Partido no encontrado');
    err.status = 404;
    throw err;
  }

  return rows[0];
}

function verificarOrganizador(partido, usuarioId) {
  if (String(partido.organizador_id) !== String(usuarioId)) {
    const err = new Error('No tenés permiso para modificar este partido');
    err.status = 403;
    throw err;
  }
}

/* =========================================================
   ⚡ HELPER: destinatarios de un partido
   =========================================================
   Devuelve un array de usuarioId únicos, incluyendo:
   - Inscritos individuales (partido_inscripciones)
   - Capitán + admins de equipos inscritos
   - Postulantes individuales pendientes
   - Capitán + admins de equipos postulantes pendientes
   - Interesados (modo Organizar)
   ========================================================= */
async function obtenerDestinatariosPartido(client, partidoId) {
  const ids = new Set();

  // 1. Inscritos individuales
  const { rows: inscritos } = await client.query(
    `SELECT usuario_id FROM partido_inscripciones WHERE partido_id = $1`,
    [partidoId]
  );
  inscritos.forEach(r => ids.add(r.usuario_id));

  // 2. Capitán + admins de equipos inscritos
  const { rows: equiposInscritos } = await client.query(
    `SELECT equipo_id FROM partido_equipos_inscritos WHERE partido_id = $1`,
    [partidoId]
  );
  for (const { equipo_id } of equiposInscritos) {
    const { rows: us } = await client.query(
      `SELECT g.capitan_id AS usuario_id
       FROM grupos g WHERE g.id = $1
       UNION
       SELECT gm.usuario_id
       FROM grupo_miembros gm
       WHERE gm.grupo_id = $1 AND gm.rol = 'admin'`,
      [equipo_id]
    );
    us.forEach(r => r.usuario_id && ids.add(r.usuario_id));
  }

  // 3. Postulantes individuales pendientes
  const { rows: postulantes } = await client.query(
    `SELECT usuario_id FROM partido_postulaciones
     WHERE partido_id = $1 AND estado = 'pendiente'`,
    [partidoId]
  );
  postulantes.forEach(r => ids.add(r.usuario_id));

  // 4. Capitán + admins de equipos postulantes pendientes
  const { rows: equiposPostulantes } = await client.query(
    `SELECT equipo_id FROM partido_equipos_postulantes
     WHERE partido_id = $1 AND estado = 'pendiente'`,
    [partidoId]
  );
  for (const { equipo_id } of equiposPostulantes) {
    const { rows: us } = await client.query(
      `SELECT g.capitan_id AS usuario_id
       FROM grupos g WHERE g.id = $1
       UNION
       SELECT gm.usuario_id
       FROM grupo_miembros gm
       WHERE gm.grupo_id = $1 AND gm.rol = 'admin'`,
      [equipo_id]
    );
    us.forEach(r => r.usuario_id && ids.add(r.usuario_id));
  }

  // 5. Interesados
  const { rows: interesados } = await client.query(
    `SELECT usuario_id FROM partido_interesados WHERE partido_id = $1`,
    [partidoId]
  );
  interesados.forEach(r => ids.add(r.usuario_id));

  return [...ids];
}

/* =========================================================
   LISTAR PARTIDOS
   ========================================================= */
export async function listarPartidos(filtros, usuarioId) {
  const {
    deporte, tipo, estado, nivel,
    soloMios, soloInscritos, busqueda,
    page = 1, limit = 20
  } = filtros;

  const condiciones = [];
  const valores = [];
  let i = 1;

  if (deporte) {
    condiciones.push(`p.deporte = $${i}`);
    valores.push(deporte);
    i++;
  }

  if (tipo) {
    condiciones.push(`p.tipo_partido = $${i}`);
    valores.push(tipo);
    i++;
  }

  if (estado) {
    condiciones.push(`p.estado = $${i}`);
    valores.push(estado);
    i++;
  }

  if (nivel) {
    condiciones.push(`p.nivel = $${i}`);
    valores.push(nivel);
    i++;
  }

  if (busqueda) {
    condiciones.push(`(p.titulo ILIKE $${i} OR p.lugar ILIKE $${i})`);
    valores.push(`%${busqueda}%`);
    i++;
  }

  if (soloMios === 'true') {
    condiciones.push(`p.organizador_id = $${i}`);
    valores.push(usuarioId);
    i++;
  }

  if (soloInscritos === 'true') {
    condiciones.push(`EXISTS (
      SELECT 1 FROM partido_inscripciones pi
      WHERE pi.partido_id = p.id AND pi.usuario_id = $${i}
    )`);
    valores.push(usuarioId);
    i++;
  }

  const where = condiciones.length > 0
    ? `WHERE ${condiciones.join(' AND ')}`
    : '';

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM partidos p ${where}`,
    valores
  );
  const total = countRows[0].total;

  const offset = (page - 1) * limit;
  const parametrosFinales = [...valores, limit, offset, usuarioId];

  const idxLimit = i;
  const idxOffset = i + 1;
  const idxUser = i + 2;

  const { rows } = await pool.query(
    `SELECT p.*,
       u.id AS u_id, u.nombre AS u_nombre, u.username AS u_username, u.avatar AS u_avatar,
       (SELECT COUNT(*)::int FROM partido_inscripciones WHERE partido_id = p.id) AS total_inscritos,
       (SELECT COUNT(*)::int FROM partido_equipos_inscritos WHERE partido_id = p.id) AS total_equipos_inscritos,
       (SELECT COUNT(*)::int FROM partido_postulaciones WHERE partido_id = p.id AND estado = 'pendiente') AS total_postulantes,
       EXISTS (
         SELECT 1 FROM partido_inscripciones pi
         WHERE pi.partido_id = p.id AND pi.usuario_id = $${idxUser}
       ) AS yo_inscrito,
       EXISTS (
         SELECT 1 FROM partido_postulaciones pp
         WHERE pp.partido_id = p.id AND pp.usuario_id = $${idxUser} AND pp.estado = 'pendiente'
       ) AS yo_postule,
       EXISTS (
         SELECT 1 FROM partido_equipos_inscritos pei
         JOIN grupo_miembros gm ON gm.grupo_id = pei.equipo_id
         WHERE pei.partido_id = p.id
           AND gm.usuario_id = $${idxUser}
           AND gm.rol IN ('capitan', 'admin')
       ) AS mi_equipo_inscrito,
       EXISTS (
         SELECT 1 FROM partido_interesados pint
         WHERE pint.partido_id = p.id AND pint.usuario_id = $${idxUser}
       ) AS yo_interesado,
       EXISTS (
         SELECT 1 FROM partido_equipos_postulantes pep
         JOIN grupo_miembros gm ON gm.grupo_id = pep.equipo_id
         WHERE pep.partido_id = p.id
           AND gm.usuario_id = $${idxUser}
           AND pep.estado = 'pendiente'
       ) AS mi_equipo_postulado,
       (
         SELECT pep.equipo_id
         FROM partido_equipos_postulantes pep
         JOIN grupo_miembros gm ON gm.grupo_id = pep.equipo_id
         WHERE pep.partido_id = p.id
           AND gm.usuario_id = $${idxUser}
           AND pep.estado = 'pendiente'
         LIMIT 1
       ) AS mi_equipo_postulado_id,
       (
         SELECT pei.equipo_id
         FROM partido_equipos_inscritos pei
         JOIN grupo_miembros gm ON gm.grupo_id = pei.equipo_id
         WHERE pei.partido_id = p.id
           AND gm.usuario_id = $${idxUser}
           AND gm.rol IN ('capitan', 'admin')
         LIMIT 1
       ) AS mi_equipo_inscrito_id
     FROM partidos p
     JOIN usuarios u ON u.id = p.organizador_id
     ${where}
     ORDER BY p.fecha ASC NULLS LAST
     LIMIT $${idxLimit} OFFSET $${idxOffset}`,
    parametrosFinales
  );

  return {
    data: rows.map(row => ({
      ...formatearPartido(row, {
        organizador: {
          id: row.u_id,
          nombre: row.u_nombre,
          username: row.u_username,
          avatar: row.u_avatar,
        },
        totalInscritos: row.total_inscritos,
        totalEquiposInscritos: row.total_equipos_inscritos,
        totalPostulantes: row.total_postulantes,
      }),
      yoInscrito: row.yo_inscrito,
      yoPostule: row.yo_postule,
      miEquipoInscrito: row.mi_equipo_inscrito,
      yoInteresado: row.yo_interesado,
      miEquipoInscritoId: row.mi_equipo_inscrito_id || null,
      miEquipoPostulado: row.mi_equipo_postulado,
      miEquipoPostuladoId: row.mi_equipo_postulado_id || null,
    })),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/* =========================================================
   OBTENER UN PARTIDO (detalle)
   ========================================================= */
export async function obtenerPartido(partidoId, usuarioId) {
  const { rows } = await pool.query(
    `SELECT p.*,
       u.id AS u_id, u.nombre AS u_nombre, u.username AS u_username, u.avatar AS u_avatar
     FROM partidos p
     JOIN usuarios u ON u.id = p.organizador_id
     WHERE p.id = $1`,
    [partidoId]
  );

  if (!rows[0]) {
    const err = new Error('Partido no encontrado');
    err.status = 404;
    throw err;
  }

  const partido = rows[0];
  const esOrganizador = String(partido.organizador_id) === String(usuarioId);

  const { rows: inscritos } = await pool.query(
    `SELECT u.id, u.nombre, u.username, u.avatar, pi.posicion, pi.fecha
     FROM partido_inscripciones pi
     JOIN usuarios u ON u.id = pi.usuario_id
     WHERE pi.partido_id = $1
     ORDER BY pi.fecha ASC`,
    [partidoId]
  );

  const { rows: postulantes } = await pool.query(
    `SELECT u.id, u.nombre, u.username, u.avatar,
            pp.posicion, pp.estado, pp.created_at AS fecha
     FROM partido_postulaciones pp
     JOIN usuarios u ON u.id = pp.usuario_id
     WHERE pp.partido_id = $1
     ORDER BY pp.created_at ASC`,
    [partidoId]
  );

  const { rows: equiposInscritos } = await pool.query(
    `SELECT g.id, g.nombre, g.escudo, g.deporte, g.ciudad,
            (SELECT COUNT(*)::int FROM grupo_miembros WHERE grupo_id = g.id) AS total_jugadores
     FROM partido_equipos_inscritos pei
     JOIN grupos g ON g.id = pei.equipo_id
     WHERE pei.partido_id = $1`,
    [partidoId]
  );

  const { rows: equiposPostulantes } = await pool.query(
    `SELECT g.id AS equipo_id, g.nombre, g.escudo, g.deporte,
            pep.estado, pep.created_at AS fecha
     FROM partido_equipos_postulantes pep
     JOIN grupos g ON g.id = pep.equipo_id
     WHERE pep.partido_id = $1
     ORDER BY pep.created_at ASC`,
    [partidoId]
  );

  const { rows: miInscripcion } = await pool.query(
    `SELECT posicion FROM partido_inscripciones
     WHERE partido_id = $1 AND usuario_id = $2`,
    [partidoId, usuarioId]
  );

  const { rows: miPostulacion } = await pool.query(
    `SELECT posicion, estado FROM partido_postulaciones
     WHERE partido_id = $1 AND usuario_id = $2`,
    [partidoId, usuarioId]
  );

  const { rows: yoInteresadoRows } = await pool.query(
    `SELECT 1 FROM partido_interesados
     WHERE partido_id = $1 AND usuario_id = $2`,
    [partidoId, usuarioId]
  );

  const yoInteresado = yoInteresadoRows.length > 0;

  const { rows: confirmacionRows } = await pool.query(
    `SELECT
       pc.id, pc.organizador_id, pc.interesado_id, pc.interesado_tipo,
       pc.equipo_id, pc.lugar, pc.fecha, pc.precio, pc.mensaje,
       pc.estado, pc.created_at,
       u.nombre AS organizador_nombre,
       ui.nombre AS interesado_nombre
     FROM partido_confirmaciones pc
     JOIN usuarios u ON u.id = pc.organizador_id
     JOIN usuarios ui ON ui.id = pc.interesado_id
     WHERE pc.partido_id = $1 AND pc.estado = 'pendiente'
     LIMIT 1`,
    [partidoId]
  );

  let confirmacionPendiente = null;
  if (confirmacionRows[0]) {
    const prop = confirmacionRows[0];
    const esOrganizadorProp = String(prop.organizador_id) === String(usuarioId);
    const esInteresadoProp = String(prop.interesado_id) === String(usuarioId);

    if (esOrganizadorProp || esInteresadoProp) {
      confirmacionPendiente = {
        id: prop.id,
        organizadorId: prop.organizador_id,
        organizadorNombre: prop.organizador_nombre,
        interesadoId: prop.interesado_id,
        interesadoNombre: prop.interesado_nombre,
        interesadoTipo: prop.interesado_tipo,
        equipoId: prop.equipo_id,
        lugar: prop.lugar,
        fecha: prop.fecha,
        precio: prop.precio,
        mensaje: prop.mensaje,
        estado: prop.estado,
        createdAt: prop.created_at,
        esOrganizador: esOrganizadorProp,
        esInteresado: esInteresadoProp,
      };
    }
  }

  const { rows: misEquiposPostulados } = await pool.query(
    `SELECT pep.equipo_id
     FROM partido_equipos_postulantes pep
     JOIN grupo_miembros gm ON gm.grupo_id = pep.equipo_id
     WHERE pep.partido_id = $1
       AND gm.usuario_id = $2
       AND gm.rol IN ('capitan', 'admin')
       AND pep.estado = 'pendiente'
     LIMIT 1`,
    [partidoId, usuarioId]
  );

  const { rows: misEquiposInscritos } = await pool.query(
    `SELECT pei.equipo_id
     FROM partido_equipos_inscritos pei
     JOIN grupo_miembros gm ON gm.grupo_id = pei.equipo_id
     WHERE pei.partido_id = $1
       AND gm.usuario_id = $2
       AND gm.rol IN ('capitan', 'admin')
     LIMIT 1`,
    [partidoId, usuarioId]
  );

  const miEquipoPostuladoId = misEquiposPostulados[0]?.equipo_id || null;
  const miEquipoInscritoId   = misEquiposInscritos[0]?.equipo_id || null;

  return {
    ...formatearPartido(partido, {
      organizador: {
        id: partido.u_id,
        nombre: partido.u_nombre,
        username: partido.u_username,
        avatar: partido.u_avatar,
      },
      totalInscritos: inscritos.length,
      totalEquiposInscritos: equiposInscritos.length,
      totalPostulantes: postulantes.filter(p => p.estado === 'pendiente').length,
    }),
    inscritos: esOrganizador || miInscripcion.length > 0 ? inscritos : [],
    postulantes: esOrganizador ? postulantes : [],
    equiposInscritos,
    equiposPostulantes: esOrganizador ? equiposPostulantes : [],
    miEquipoPostulado: !!miEquipoPostuladoId,
    miEquipoPostuladoId,
    miEquipoInscrito: !!miEquipoInscritoId,
    miEquipoInscritoId,
    miInscripcion: miInscripcion[0] || null,
    miPostulacion: miPostulacion[0] || null,
    soyOrganizador: esOrganizador,
    yoInteresado: yoInteresado || false,
    confirmacionPendiente: confirmacionPendiente,
  };
}
/* =========================================================
   CREAR PARTIDO
   ========================================================= */
export async function crearPartido(datos, usuarioId) {
  const {
    titulo, deporte, emoji, descripcion, lugar, fecha, cupos, precio,
    nivel, tipoPartido, organizadorEquipoId, aprobacionRequerida,
    pedirPosiciones, posiciones, estadoPartido
  } = datos;

  const esOrganizar = estadoPartido === 'buscando_jugadores';
  if (!esOrganizar) {
    if (!fecha) {
      const err = new Error('La fecha es obligatoria');
      err.status = 400;
      throw err;
    }
    if (!lugar) {
      const err = new Error('El lugar es obligatorio');
      err.status = 400;
      throw err;
    }
  }

  if (organizadorEquipoId) {
    const esUuid = esUuidValido(organizadorEquipoId);

    if (esUuid) {
      const { rows } = await pool.query(
        `SELECT id FROM grupos
         WHERE id = $1 AND tipo = 'equipo'
           AND (capitan_id = $2 OR EXISTS (
             SELECT 1 FROM grupo_miembros
             WHERE grupo_id = grupos.id AND usuario_id = $2 AND rol IN ('capitan', 'admin')
           ))`,
        [organizadorEquipoId, usuarioId]
      );

      if (!rows[0]) {
        const err = new Error('El equipo indicado no existe o no tenés permisos sobre él');
        err.status = 403;
        throw err;
      }
    }
  }

  const esUuid = esUuidValido(organizadorEquipoId);
  const organizadorEquipoIdDB = esUuid ? organizadorEquipoId : null;

  const { rows } = await pool.query(
    `INSERT INTO partidos (
      titulo, deporte, emoji, descripcion, lugar, fecha, cupos, precio,
      nivel, tipo_partido, organizador_equipo_id, organizador_id,
      aprobacion_requerida, pedir_posiciones, posiciones, estado_partido
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *`,
    [
      titulo, deporte, emoji || null, descripcion || null,
      lugar || null, fecha || null, cupos, precio,
      nivel, tipoPartido, organizadorEquipoIdDB, usuarioId,
      aprobacionRequerida, pedirPosiciones, posiciones,
      estadoPartido || 'confirmado'
    ]
  );

  const partido = rows[0];

  if (tipoPartido === 'equipo' && esUuid) {
    await pool.query(
      `INSERT INTO partido_equipos_inscritos (partido_id, equipo_id)
       VALUES ($1, $2)`,
      [partido.id, organizadorEquipoId]
    );
  }

  if (tipoPartido === 'jugador' && !esOrganizar) {
    await pool.query(
      `INSERT INTO partido_inscripciones (partido_id, usuario_id)
       VALUES ($1, $2)`,
      [partido.id, usuarioId]
    );
  }

  return obtenerPartido(partido.id, usuarioId);
}

/* =========================================================
   EDITAR PARTIDO (solo organizador)
   =========================================================
   ⚡ Notifica a inscritos / postulantes / interesados SI cambian
   campos críticos:
   - lugar
   - fecha
   - precio
   - cupos
   ========================================================= */
export async function editarPartido(partidoId, cambios, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partidoAntes = await obtenerPartidoOFallar(client, partidoId);
    verificarOrganizador(partidoAntes, usuarioId);

    if (cambios.cupos !== undefined) {
      const { rows: inscritos } = await client.query(
        `SELECT COUNT(*)::int AS total FROM partido_inscripciones WHERE partido_id = $1`,
        [partidoId]
      );
      const { rows: equipos } = await client.query(
        `SELECT COUNT(*)::int AS total FROM partido_equipos_inscritos WHERE partido_id = $1`,
        [partidoId]
      );

      const totalActual = partidoAntes.tipo_partido === 'equipo'
        ? equipos[0].total
        : inscritos[0].total;

      if (cambios.cupos < totalActual) {
        const err = new Error(`No podés bajar los cupos a menos de ${totalActual} (inscritos actuales)`);
        err.status = 400;
        throw err;
      }
    }

    /* ---------- Detectar cambios críticos ---------- */
    const camposCriticos = ['lugar', 'fecha', 'precio', 'cupos'];

    let cambioCritico = false;
    for (const campo of camposCriticos) {
      if (cambios[campo] !== undefined) {
        const antes = partidoAntes[campo];
        const despues = cambios[campo];
        if (String(antes) !== String(despues)) {
          cambioCritico = true;
          break;
        }
      }
    }

    /* ---------- Armar UPDATE ---------- */
    const permitidos = ['titulo', 'lugar', 'fecha', 'cupos', 'precio', 'descripcion'];
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
      await client.query('COMMIT');
      return obtenerPartido(partidoId, usuarioId);
    }

    valores.push(partidoId);

    await client.query(
      `UPDATE partidos
       SET ${campos.join(', ')}, updated_at = NOW()
       WHERE id = $${i}`,
      valores
    );

    const { rows: conteo } = await client.query(
      `SELECT
        (SELECT COUNT(*)::int FROM partido_inscripciones WHERE partido_id = $1) AS inscritos,
        (SELECT COUNT(*)::int FROM partido_equipos_inscritos WHERE partido_id = $1) AS equipos`,
      [partidoId]
    );

    const nuevosCupos = cambios.cupos ?? partidoAntes.cupos;
    const totalActual = partidoAntes.tipo_partido === 'equipo'
      ? conteo[0].equipos
      : conteo[0].inscritos;

    if (totalActual < nuevosCupos && partidoAntes.estado === 'lleno') {
      await client.query(
        `UPDATE partidos SET estado = 'abierto' WHERE id = $1`,
        [partidoId]
      );
    }

    /* ---------- Notificar si hubo cambios críticos ---------- */
    if (cambioCritico) {
      const destinatarios = await obtenerDestinatariosPartido(client, partidoId);

      if (destinatarios.length > 0) {
        await crearNotificacionMultiple(
          destinatarios,
          'edicion',
          `El partido "${partidoAntes.titulo}" fue modificado. Revisá los cambios.`,
          `#/partido/${partidoId}`
        );
      }
    }

    await client.query('COMMIT');
    return obtenerPartido(partidoId, usuarioId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   ELIMINAR PARTIDO (solo organizador)
   =========================================================
   ⚡ Notifica a TODOS los participantes antes de borrar.
   ========================================================= */
export async function eliminarPartido(partidoId, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);
    verificarOrganizador(partido, usuarioId);

    /* ---------- Destinatarios ANTES de borrar ---------- */
    const destinatarios = await obtenerDestinatariosPartido(client, partidoId);

    /* ---------- Borrar ---------- */
    await client.query(
      `DELETE FROM partidos WHERE id = $1`,
      [partidoId]
    );

    /* ---------- Notificar ---------- */
    if (destinatarios.length > 0) {
      await crearNotificacionMultiple(
        destinatarios,
        'cancelacion',
        `El partido "${partido.titulo}" fue cancelado por el organizador.`,
        null // No link: el partido ya no existe
      );
    }

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Partido eliminado' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   INSCRIBIRSE (partido de jugador)
   =========================================================
   ⚡ BLOQUEADO si el partido ya fue confirmado (doble confirmación).
   ========================================================= */
export async function inscribirse(partidoId, usuarioId, posicion = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);

    // ⚡ Si ya está confirmado por ambas partes → CERRADO
    if (partido.estado_partido === 'confirmado') {
      const err = new Error('Este partido ya fue confirmado y no acepta más participantes');
      err.status = 400;
      throw err;
    }

    if (partido.tipo_partido !== 'jugador') {
      const err = new Error('Este partido es de equipos. Postulá tu equipo.');
      err.status = 400;
      throw err;
    }

    if (partido.estado !== 'abierto') {
      const err = new Error('El partido no está abierto para inscripciones');
      err.status = 400;
      throw err;
    }

    const { rows: existe } = await client.query(
      `SELECT 1 FROM partido_inscripciones
       WHERE partido_id = $1 AND usuario_id = $2`,
      [partidoId, usuarioId]
    );

    if (existe.length > 0) {
      const err = new Error('Ya estás inscrito en este partido');
      err.status = 409;
      throw err;
    }

    if (partido.aprobacion_requerida) {
      const err = new Error('Este partido requiere aprobación. Usá el endpoint de postulación.');
      err.status = 400;
      throw err;
    }

    const { rows: conteo } = await client.query(
      `SELECT COUNT(*)::int AS total FROM partido_inscripciones WHERE partido_id = $1`,
      [partidoId]
    );

    if (conteo[0].total >= partido.cupos) {
      const err = new Error('El partido ya está lleno');
      err.status = 409;
      throw err;
    }

    await client.query(
      `INSERT INTO partido_inscripciones (partido_id, usuario_id, posicion)
       VALUES ($1, $2, $3)`,
      [partidoId, usuarioId, posicion || null]
    );

    const nuevoTotal = conteo[0].total + 1;
    if (nuevoTotal >= partido.cupos) {
      await client.query(
        `UPDATE partidos SET estado = 'lleno' WHERE id = $1`,
        [partidoId]
      );
    }

    await client.query('COMMIT');
    return obtenerPartido(partidoId, usuarioId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   SALIR DE UN PARTIDO
   =========================================================
   ⚡ Si era el único inscrito de un partido confirmado,
   el partido vuelve a modo Organizar y se borran fecha/lugar/precio.
   ========================================================= */
export async function salirDelPartido(partidoId, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);

    if (String(partido.organizador_id) === String(usuarioId)) {
      const err = new Error('El organizador no puede salir del partido. Eliminalo si querés cancelarlo.');
      err.status = 400;
      throw err;
    }

    const { rowCount } = await client.query(
      `DELETE FROM partido_inscripciones
       WHERE partido_id = $1 AND usuario_id = $2`,
      [partidoId, usuarioId]
    );

    if (rowCount === 0) {
      const err = new Error('No estabas inscrito en este partido');
      err.status = 404;
      throw err;
    }

    const { rows: conteo } = await client.query(
      `SELECT COUNT(*)::int AS total FROM partido_inscripciones WHERE partido_id = $1`,
      [partidoId]
    );

    const yaNoQuedanInscritos = conteo[0].total === 0;
    let reversiono = false;

    if (yaNoQuedanInscritos && partido.estado_partido === 'confirmado') {
      await client.query(
        `UPDATE partidos
         SET estado_partido = 'buscando_jugadores',
             estado = 'abierto',
             lugar = NULL,
             fecha = NULL,
             precio = 0,
             updated_at = NOW()
         WHERE id = $1`,
        [partidoId]
      );

      await client.query(
        `UPDATE partido_confirmaciones
         SET estado = 'cancelada', resuelta_en = NOW()
         WHERE partido_id = $1 AND estado = 'pendiente'`,
        [partidoId]
      );

      await crearNotificacion(
        partido.organizador_id,
        'partido_revertido',
        `El partido "${partido.titulo}" volvió a modo Organizar porque el inscrito se desinscribió.`,
        `#/partido/${partidoId}`
      );

      reversiono = true;
    } else if (conteo[0].total < partido.cupos && partido.estado === 'lleno') {
      await client.query(
        `UPDATE partidos SET estado = 'abierto' WHERE id = $1`,
        [partidoId]
      );
    }

    await client.query('COMMIT');
    return {
      ok: true,
      mensaje: reversiono
        ? 'Saliste del partido. Como no queda nadie, volvió a modo Organizar.'
        : 'Saliste del partido'
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
/* =========================================================
   POSTULARSE (partido con aprobación)
   ========================================================= */
export async function postularse(partidoId, usuarioId, posicion = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);

    if (partido.estado_partido === 'confirmado') {
      const err = new Error('Este partido ya fue confirmado y no acepta más postulaciones');
      err.status = 400;
      throw err;
    }

    if (partido.tipo_partido !== 'jugador') {
      const err = new Error('Este partido es de equipos');
      err.status = 400;
      throw err;
    }

    if (!partido.aprobacion_requerida) {
      const err = new Error('Este partido no requiere aprobación. Inscribite directamente.');
      err.status = 400;
      throw err;
    }

    if (partido.estado !== 'abierto') {
      const err = new Error('El partido no acepta postulaciones');
      err.status = 400;
      throw err;
    }

    const { rows: existe } = await client.query(
      `SELECT estado FROM partido_postulaciones
       WHERE partido_id = $1 AND usuario_id = $2`,
      [partidoId, usuarioId]
    );

    if (existe.length > 0) {
      const err = new Error(`Ya tenés una postulación con estado: ${existe[0].estado}`);
      err.status = 409;
      throw err;
    }

    await client.query(
      `INSERT INTO partido_postulaciones (partido_id, usuario_id, posicion)
       VALUES ($1, $2, $3)`,
      [partidoId, usuarioId, posicion || null]
    );

    await client.query('COMMIT');
    return obtenerPartido(partidoId, usuarioId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   CANCELAR POSTULACIÓN (jugador)
   ========================================================= */
export async function cancelarPostulacion(partidoId, usuarioId) {
  const { rowCount } = await pool.query(
    `DELETE FROM partido_postulaciones
     WHERE partido_id = $1 AND usuario_id = $2 AND estado = 'pendiente'`,
    [partidoId, usuarioId]
  );

  if (rowCount === 0) {
    const err = new Error('No tenés una postulación pendiente en este partido');
    err.status = 404;
    throw err;
  }

  return { ok: true, mensaje: 'Postulación cancelada' };
}

/* =========================================================
   APROBAR / RECHAZAR POSTULANTE (organizador)
   ========================================================= */
export async function gestionarPostulante(partidoId, usuarioId, postulanteId, accion) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);
    verificarOrganizador(partido, usuarioId);

    const { rows } = await client.query(
      `SELECT * FROM partido_postulaciones
       WHERE partido_id = $1 AND usuario_id = $2 AND estado = 'pendiente'`,
      [partidoId, postulanteId]
    );

    if (!rows[0]) {
      const err = new Error('No hay una postulación pendiente de ese usuario');
      err.status = 404;
      throw err;
    }

    if (accion === 'rechazar') {
      await client.query(
        `UPDATE partido_postulaciones
         SET estado = 'rechazado', resuelta_en = NOW()
         WHERE partido_id = $1 AND usuario_id = $2`,
        [partidoId, postulanteId]
      );

      await client.query('COMMIT');
      return { ok: true, mensaje: 'Postulación rechazada' };
    }

    const { rows: conteo } = await client.query(
      `SELECT COUNT(*)::int AS total FROM partido_inscripciones WHERE partido_id = $1`,
      [partidoId]
    );

    if (conteo[0].total >= partido.cupos) {
      const err = new Error('El partido ya está lleno');
      err.status = 409;
      throw err;
    }

    await client.query(
      `UPDATE partido_postulaciones
       SET estado = 'aprobado', resuelta_en = NOW()
       WHERE partido_id = $1 AND usuario_id = $2`,
      [partidoId, postulanteId]
    );

    await client.query(
      `INSERT INTO partido_inscripciones (partido_id, usuario_id, posicion)
       VALUES ($1, $2, $3)
       ON CONFLICT (partido_id, usuario_id) DO NOTHING`,
      [partidoId, postulanteId, rows[0].posicion]
    );

    const nuevoTotal = conteo[0].total + 1;
    if (nuevoTotal >= partido.cupos) {
      await client.query(
        `UPDATE partidos SET estado = 'lleno' WHERE id = $1`,
        [partidoId]
      );
      await client.query(
        `UPDATE partido_postulaciones
         SET estado = 'rechazado', resuelta_en = NOW()
         WHERE partido_id = $1 AND estado = 'pendiente'`,
        [partidoId]
      );
    }

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Postulación aprobada' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   POSTULAR EQUIPO (a partido de equipos)
   ========================================================= */
export async function postularEquipo(partidoId, usuarioId, equipoId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);

    if (partido.estado_partido === 'confirmado') {
      const err = new Error('Este partido ya fue confirmado y no acepta más equipos');
      err.status = 400;
      throw err;
    }

    if (partido.tipo_partido !== 'equipo') {
      const err = new Error('Este partido es de jugadores');
      err.status = 400;
      throw err;
    }

    if (partido.estado !== 'abierto') {
      const err = new Error('El partido no está abierto');
      err.status = 400;
      throw err;
    }

    const { rows: equipo } = await client.query(
      `SELECT id FROM grupos
       WHERE id = $1 AND tipo = 'equipo'
         AND (capitan_id = $2 OR EXISTS (
           SELECT 1 FROM grupo_miembros
           WHERE grupo_id = grupos.id AND usuario_id = $2 AND rol IN ('capitan', 'admin')
         ))`,
      [equipoId, usuarioId]
    );

    if (!equipo[0]) {
      const err = new Error('No tenés permisos para postular ese equipo');
      err.status = 403;
      throw err;
    }

    const { rows: existentes } = await client.query(
      `SELECT 'postulado' AS tipo FROM partido_equipos_postulantes
       WHERE partido_id = $1 AND equipo_id = $2
       UNION
       SELECT 'inscrito' AS tipo FROM partido_equipos_inscritos
       WHERE partido_id = $1 AND equipo_id = $2`,
      [partidoId, equipoId]
    );

    if (existentes.length > 0) {
      const err = new Error(`El equipo ya está ${existentes[0].tipo} en este partido`);
      err.status = 409;
      throw err;
    }

    await client.query(
      `INSERT INTO partido_equipos_postulantes (partido_id, equipo_id)
       VALUES ($1, $2)`,
      [partidoId, equipoId]
    );

    await client.query('COMMIT');
    return obtenerPartido(partidoId, usuarioId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   CANCELAR POSTULACIÓN DE EQUIPO
   ========================================================= */
export async function cancelarPostulacionEquipo(partidoId, usuarioId, equipoId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);

    if (partido.tipo_partido !== 'equipo') {
      const err = new Error('Este partido es de jugadores');
      err.status = 400;
      throw err;
    }

    const { rows: equipo } = await client.query(
      `SELECT id FROM grupos
       WHERE id = $1 AND tipo = 'equipo'
         AND (capitan_id = $2 OR EXISTS (
           SELECT 1 FROM grupo_miembros
           WHERE grupo_id = grupos.id AND usuario_id = $2 AND rol IN ('capitan', 'admin')
         ))`,
      [equipoId, usuarioId]
    );

    if (!equipo[0]) {
      const err = new Error('No tenés permisos sobre ese equipo');
      err.status = 403;
      throw err;
    }

    const { rows: existentes } = await client.query(
      `SELECT id FROM partido_equipos_postulantes
       WHERE partido_id = $1 AND equipo_id = $2 AND estado = 'pendiente'`,
      [partidoId, equipoId]
    );

    if (!existentes[0]) {
      const err = new Error('No hay una postulación pendiente de ese equipo');
      err.status = 404;
      throw err;
    }

    await client.query(
      `DELETE FROM partido_equipos_postulantes
       WHERE partido_id = $1 AND equipo_id = $2`,
      [partidoId, equipoId]
    );

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Postulación cancelada' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   APROBAR / RECHAZAR EQUIPO POSTULANTE (organizador)
   ========================================================= */
export async function gestionarEquipoPostulante(partidoId, usuarioId, equipoId, accion) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);
    verificarOrganizador(partido, usuarioId);

    const { rows } = await client.query(
      `SELECT * FROM partido_equipos_postulantes
       WHERE partido_id = $1 AND equipo_id = $2 AND estado = 'pendiente'`,
      [partidoId, equipoId]
    );

    if (!rows[0]) {
      const err = new Error('No hay postulación pendiente de ese equipo');
      err.status = 404;
      throw err;
    }

    if (accion === 'rechazar') {
      await client.query(
        `UPDATE partido_equipos_postulantes
         SET estado = 'rechazado', resuelta_en = NOW()
         WHERE partido_id = $1 AND equipo_id = $2`,
        [partidoId, equipoId]
      );

      await client.query('COMMIT');
      return { ok: true, mensaje: 'Equipo rechazado' };
    }

    const { rows: conteo } = await client.query(
      `SELECT COUNT(*)::int AS total FROM partido_equipos_inscritos WHERE partido_id = $1`,
      [partidoId]
    );

    if (conteo[0].total >= partido.cupos) {
      const err = new Error('El partido ya está lleno');
      err.status = 409;
      throw err;
    }

    await client.query(
      `UPDATE partido_equipos_postulantes
       SET estado = 'aceptado', resuelta_en = NOW()
       WHERE partido_id = $1 AND equipo_id = $2`,
      [partidoId, equipoId]
    );

    await client.query(
      `INSERT INTO partido_equipos_inscritos (partido_id, equipo_id)
       VALUES ($1, $2)
       ON CONFLICT (partido_id, equipo_id) DO NOTHING`,
      [partidoId, equipoId]
    );

    const nuevoTotal = conteo[0].total + 1;
    if (nuevoTotal >= partido.cupos) {
      await client.query(
        `UPDATE partidos SET estado = 'lleno' WHERE id = $1`,
        [partidoId]
      );
    }

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Equipo aprobado' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
/* =========================================================
   MODO "ORGANIZAR PARTIDO" — Interesados
   ========================================================= */

/* ---------- POST /api/partidos/:id/interesarse ---------- */
export async function interesarse(partidoId, usuarioId, mensaje = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);

    if (partido.estado_partido !== 'buscando_jugadores') {
      const err = new Error('Este partido ya fue confirmado y no acepta más interesados');
      err.status = 400;
      throw err;
    }

    if (String(partido.organizador_id) === String(usuarioId)) {
      const err = new Error('El organizador no puede marcar "Me interesa" en su propio partido');
      err.status = 400;
      throw err;
    }

    const { rows: existe } = await client.query(
      `SELECT 1 FROM partido_interesados
       WHERE partido_id = $1 AND usuario_id = $2`,
      [partidoId, usuarioId]
    );

    if (existe.length > 0) {
      const err = new Error('Ya marcaste "Me interesa" en este partido');
      err.status = 409;
      throw err;
    }

    await client.query(
      `INSERT INTO partido_interesados (partido_id, usuario_id, mensaje)
       VALUES ($1, $2, $3)`,
      [partidoId, usuarioId, mensaje || null]
    );

    await client.query('COMMIT');
    return obtenerPartido(partidoId, usuarioId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* ---------- DELETE /api/partidos/:id/interesarse ---------- */
export async function cancelarInteres(partidoId, usuarioId) {
  const { rowCount } = await pool.query(
    `DELETE FROM partido_interesados
     WHERE partido_id = $1 AND usuario_id = $2`,
    [partidoId, usuarioId]
  );

  if (rowCount === 0) {
    const err = new Error('No estabas interesado en este partido');
    err.status = 404;
    throw err;
  }

  return { ok: true, mensaje: 'Interés cancelado' };
}

/* ---------- GET /api/partidos/:id/interesados ---------- */
export async function listarInteresados(partidoId, usuarioId) {
  const { rows: partidoRows } = await pool.query(
    `SELECT organizador_id FROM partidos WHERE id = $1`,
    [partidoId]
  );

  if (!partidoRows[0]) {
    const err = new Error('Partido no encontrado');
    err.status = 404;
    throw err;
  }

  const esOrganizador = String(partidoRows[0].organizador_id) === String(usuarioId);

  if (!esOrganizador) {
    const err = new Error('Solo el organizador puede ver la lista de interesados');
    err.status = 403;
    throw err;
  }

  const { rows } = await pool.query(
    `SELECT
       u.id, u.nombre, u.username, u.avatar, u.ciudad,
       pi.mensaje, pi.estado, pi.created_at AS fecha
     FROM partido_interesados pi
     JOIN usuarios u ON u.id = pi.usuario_id
     WHERE pi.partido_id = $1
     ORDER BY pi.created_at ASC`,
    [partidoId]
  );

  return rows;
}

/* =========================================================
   CONFIRMAR PARTIDO (organizador propone)
   ========================================================= */
export async function confirmarPartido(partidoId, usuarioId, datos) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);
    verificarOrganizador(partido, usuarioId);

    if (partido.estado_partido !== 'buscando_jugadores') {
      const err = new Error('Este partido no está en modo "Organizar partido"');
      err.status = 400;
      throw err;
    }

    const {
      interesadoId,
      interesadoTipo = 'usuario',
      equipoId = null,
      lugar,
      fecha,
      precio = 0,
      mensaje = null,
    } = datos;

    if (!interesadoId) {
      const err = new Error('Falta indicar el interesado');
      err.status = 400;
      throw err;
    }

    if (!lugar || !fecha) {
      const err = new Error('Lugar y fecha son obligatorios para confirmar');
      err.status = 400;
      throw err;
    }

    if (interesadoTipo === 'usuario') {
      const { rows } = await client.query(
        `SELECT 1 FROM partido_interesados
         WHERE partido_id = $1 AND usuario_id = $2`,
        [partidoId, interesadoId]
      );

      if (!rows[0]) {
        const err = new Error('Ese usuario no está interesado en el partido');
        err.status = 404;
        throw err;
      }
    }

    const { rows: yaHay } = await client.query(
      `SELECT id FROM partido_confirmaciones
       WHERE partido_id = $1 AND estado = 'pendiente'`,
      [partidoId]
    );

    if (yaHay[0]) {
      const err = new Error('Ya hay una propuesta de confirmación pendiente. Cancelala antes de proponer otra.');
      err.status = 409;
      throw err;
    }

    const { rows: propuestaRows } = await client.query(
      `INSERT INTO partido_confirmaciones (
        partido_id, organizador_id, interesado_id, interesado_tipo,
        equipo_id, lugar, fecha, precio, mensaje, estado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendiente')
      RETURNING id, created_at`,
      [
        partidoId, usuarioId, interesadoId, interesadoTipo,
        equipoId, lugar, fecha, precio || 0, mensaje,
      ]
    );

    const propuesta = propuestaRows[0];

    const nombreOrganizador = (await client.query(
      'SELECT nombre FROM usuarios WHERE id = $1',
      [usuarioId]
    )).rows[0]?.nombre || 'El organizador';

    await crearNotificacion(
      interesadoId,
      'confirmacion_partido',
      `${nombreOrganizador} quiere confirmar el partido "${partido.titulo}". Revisá la propuesta y aprobala o rechazala.`,
      `#/partido/${partidoId}`
    );

    await client.query('COMMIT');
    return {
      ok: true,
      mensaje: 'Propuesta enviada. El interesado debe aprobarla.',
      propuestaId: propuesta.id,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   APROBAR CONFIRMACIÓN (el interesado acepta)
   ========================================================= */
export async function aprobarConfirmacion(partidoId, usuarioId, propuestaId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);

    const { rows: propRows } = await client.query(
      `SELECT * FROM partido_confirmaciones
       WHERE id = $1 AND partido_id = $2 AND estado = 'pendiente'`,
      [propuestaId, partidoId]
    );

    if (!propRows[0]) {
      const err = new Error('Propuesta de confirmación no encontrada o ya resuelta');
      err.status = 404;
      throw err;
    }

    const propuesta = propRows[0];

    if (String(propuesta.interesado_id) !== String(usuarioId)) {
      const err = new Error('Solo el interesado puede aprobar esta propuesta');
      err.status = 403;
      throw err;
    }

    await client.query(
      `UPDATE partido_confirmaciones
       SET estado = 'aceptada', resuelta_en = NOW()
       WHERE id = $1`,
      [propuestaId]
    );

    await client.query(
      `UPDATE partidos
       SET lugar = $1,
           fecha = $2,
           precio = $3,
           estado_partido = 'confirmado',
           estado = 'abierto',
           updated_at = NOW()
       WHERE id = $4`,
      [propuesta.lugar, propuesta.fecha, propuesta.precio || 0, partidoId]
    );

    if (propuesta.interesado_tipo === 'equipo' && propuesta.equipo_id) {
      await client.query(
        `INSERT INTO partido_equipos_inscritos (partido_id, equipo_id)
         VALUES ($1, $2)
         ON CONFLICT (partido_id, equipo_id) DO NOTHING`,
        [partidoId, propuesta.equipo_id]
      );
    } else {
      await client.query(
        `INSERT INTO partido_inscripciones (partido_id, usuario_id)
         VALUES ($1, $2)
         ON CONFLICT (partido_id, usuario_id) DO NOTHING`,
        [partidoId, propuesta.interesado_id]
      );
    }

    // Notificar a los demás interesados que el partido se confirmó con otro
    const { rows: otrosInteresados } = await client.query(
      `SELECT usuario_id FROM partido_interesados
       WHERE partido_id = $1 AND usuario_id != $2`,
      [partidoId, propuesta.interesado_id]
    );

    const { rows: datosInteresado } = await client.query(
      `SELECT nombre FROM usuarios WHERE id = $1`,
      [propuesta.interesado_id]
    );
    const nombreInteresado = datosInteresado[0]?.nombre || 'El interesado';

    await crearNotificacion(
      propuesta.organizador_id,
      'confirmacion_aceptada',
      `${nombreInteresado} aceptó la confirmación. El partido "${partido.titulo}" quedó confirmado.`,
      `#/partido/${partidoId}`
    );

    if (otrosInteresados.length > 0) {
      const idsOtros = otrosInteresados.map(i => i.usuario_id);
      await crearNotificacionMultiple(
        idsOtros,
        'partido_confirmado',
        `El partido "${partido.titulo}" se confirmó con otro jugador.`,
        `#/partido/${partidoId}`
      );
    }

    await client.query('COMMIT');

    return {
      ok: true,
      mensaje: 'Confirmación aceptada. El partido quedó cerrado.',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   RECHAZAR CONFIRMACIÓN (el interesado rechaza)
   ========================================================= */
export async function rechazarConfirmacion(partidoId, usuarioId, propuestaId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);

    const { rows: propRows } = await client.query(
      `SELECT * FROM partido_confirmaciones
       WHERE id = $1 AND partido_id = $2 AND estado = 'pendiente'`,
      [propuestaId, partidoId]
    );

    if (!propRows[0]) {
      const err = new Error('Propuesta de confirmación no encontrada o ya resuelta');
      err.status = 404;
      throw err;
    }

    const propuesta = propRows[0];

    if (String(propuesta.interesado_id) !== String(usuarioId)) {
      const err = new Error('Solo el interesado puede rechazar esta propuesta');
      err.status = 403;
      throw err;
    }

    await client.query(
      `UPDATE partido_confirmaciones
       SET estado = 'rechazada', resuelta_en = NOW()
       WHERE id = $1`,
      [propuestaId]
    );

    const { rows: datosInteresado } = await client.query(
      `SELECT nombre FROM usuarios WHERE id = $1`,
      [propuesta.interesado_id]
    );
    const nombreInteresado = datosInteresado[0]?.nombre || 'El interesado';

    await crearNotificacion(
      propuesta.organizador_id,
      'confirmacion_rechazada',
      `${nombreInteresado} rechazó la propuesta de confirmación del partido "${partido.titulo}".`,
      `#/partido/${partidoId}`
    );

    await client.query('COMMIT');

    return {
      ok: true,
      mensaje: 'Propuesta rechazada. El partido sigue en modo Organizar.',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   CANCELAR CONFIRMACIÓN (el organizador cancela)
   ========================================================= */
export async function cancelarConfirmacion(partidoId, usuarioId, propuestaId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);
    verificarOrganizador(partido, usuarioId);

    const { rows: propRows } = await client.query(
      `SELECT * FROM partido_confirmaciones
       WHERE id = $1 AND partido_id = $2 AND estado = 'pendiente'`,
      [propuestaId, partidoId]
    );

    if (!propRows[0]) {
      const err = new Error('Propuesta de confirmación no encontrada o ya resuelta');
      err.status = 404;
      throw err;
    }

    const propuesta = propRows[0];

    await client.query(
      `UPDATE partido_confirmaciones
       SET estado = 'cancelada', resuelta_en = NOW()
       WHERE id = $1`,
      [propuestaId]
    );

    await client.query(
      `DELETE FROM notificaciones
       WHERE usuario_id = $1
         AND tipo = 'confirmacion_partido'
         AND link = $2`,
      [propuesta.interesado_id, `#/partido/${partidoId}`]
    );

    await client.query('COMMIT');

    return {
      ok: true,
      mensaje: 'Propuesta cancelada.',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   OBTENER CONFIRMACIÓN PENDIENTE
   ========================================================= */
export async function obtenerConfirmacionPendiente(partidoId, usuarioId) {
  const { rows } = await pool.query(
    `SELECT pc.id, pc.partido_id, pc.organizador_id, pc.interesado_id,
            pc.interesado_tipo, pc.equipo_id, pc.lugar, pc.fecha,
            pc.precio, pc.mensaje, pc.estado, pc.created_at,
            u.nombre AS organizador_nombre,
            ui.nombre AS interesado_nombre
     FROM partido_confirmaciones pc
     JOIN usuarios u ON u.id = pc.organizador_id
     JOIN usuarios ui ON ui.id = pc.interesado_id
     WHERE pc.partido_id = $1
       AND pc.estado = 'pendiente'
     LIMIT 1`,
    [partidoId]
  );

  if (!rows[0]) return null;

  const prop = rows[0];

  const esOrganizador = String(prop.organizador_id) === String(usuarioId);
  const esInteresado = String(prop.interesado_id) === String(usuarioId);

  if (!esOrganizador && !esInteresado) {
    const err = new Error('No tenés permiso para ver esta propuesta');
    err.status = 403;
    throw err;
  }

  return {
    id: prop.id,
    partidoId: prop.partido_id,
    organizadorId: prop.organizador_id,
    organizadorNombre: prop.organizador_nombre,
    interesadoId: prop.interesado_id,
    interesadoNombre: prop.interesado_nombre,
    interesadoTipo: prop.interesado_tipo,
    equipoId: prop.equipo_id,
    lugar: prop.lugar,
    fecha: prop.fecha,
    precio: prop.precio,
    mensaje: prop.mensaje,
    estado: prop.estado,
    createdAt: prop.created_at,
    esOrganizador,
    esInteresado,
  };
}

/* =========================================================
   HISTORIAL DE PARTIDOS (para el perfil)
   =========================================================
   Con paginación. Solo devuelve partidos con estado_partido='confirmado'
   y estado='finalizado'.
   ========================================================= */
export async function obtenerHistorialPartidos(usuarioId, filtros = {}) {
  const { deporte, desde, hasta, tipo, page = 1, limit = 20 } = filtros;

  const condiciones = [
    `p.estado_partido = 'confirmado'`,
    `p.estado = 'finalizado'`,
    `(
      p.organizador_id = $1
      OR EXISTS (
        SELECT 1 FROM partido_inscripciones pi
        WHERE pi.partido_id = p.id AND pi.usuario_id = $1
      )
      OR EXISTS (
        SELECT 1 FROM partido_equipos_inscritos pei
        JOIN grupo_miembros gm ON gm.grupo_id = pei.equipo_id
        WHERE pei.partido_id = p.id AND gm.usuario_id = $1
      )
    )`,
  ];

  const valores = [usuarioId];
  let i = 2;

  if (deporte) {
    condiciones.push(`p.deporte = $${i}`);
    valores.push(deporte);
    i++;
  }

  if (tipo) {
    condiciones.push(`p.tipo_partido = $${i}`);
    valores.push(tipo);
    i++;
  }

  if (desde) {
    condiciones.push(`p.fecha >= $${i}`);
    valores.push(desde);
    i++;
  }

  if (hasta) {
    condiciones.push(`p.fecha <= $${i}`);
    valores.push(hasta);
    i++;
  }

  const where = `WHERE ${condiciones.join(' AND ')}`;

  // Contar total
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM partidos p ${where}`,
    valores
  );
  const total = countRows[0].total;

  const offset = (page - 1) * limit;
  const parametrosFinales = [...valores, limit, offset];

  const idxLimit = i;
  const idxOffset = i + 1;

  const { rows } = await pool.query(
    `SELECT p.id, p.titulo, p.deporte, p.emoji, p.tipo_partido,
            p.lugar, p.fecha, p.cupos, p.precio, p.nivel,
            p.organizador_id,
            u.nombre AS organizador_nombre,
            u.username AS organizador_username,
            u.avatar AS organizador_avatar,
            (
              CASE
                WHEN p.organizador_id = $1 THEN 'organizador'
                WHEN EXISTS (
                  SELECT 1 FROM partido_inscripciones pi
                  WHERE pi.partido_id = p.id AND pi.usuario_id = $1
                ) THEN 'jugador'
                WHEN EXISTS (
                  SELECT 1 FROM partido_equipos_inscritos pei
                  JOIN grupo_miembros gm ON gm.grupo_id = pei.equipo_id
                  WHERE pei.partido_id = p.id AND gm.usuario_id = $1
                ) THEN 'equipo'
                ELSE 'desconocido'
              END
            ) AS rol
     FROM partidos p
     JOIN usuarios u ON u.id = p.organizador_id
     ${where}
     ORDER BY p.fecha DESC
     LIMIT $${idxLimit} OFFSET $${idxOffset}`,
    parametrosFinales
  );

  const data = rows.map(row => ({
    id: row.id,
    titulo: row.titulo,
    deporte: row.deporte,
    emoji: row.emoji,
    tipoPartido: row.tipo_partido,
    lugar: row.lugar,
    fecha: row.fecha,
    cupos: row.cupos,
    precio: row.precio,
    nivel: row.nivel,
    organizador: {
      id: row.organizador_id,
      nombre: row.organizador_nombre,
      username: row.organizador_username,
      avatar: row.organizador_avatar,
    },
    rol: row.rol,
  }));

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hayMas: page * limit < total,
    },
  };
}