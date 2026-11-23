import { pool } from '../config/db.js';
import { idsBloqueadosTotales, estanBloqueados } from '../utils/bloqueos.js'; // ⚡ NUEVO
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
    bloqueado: row.fecha ? new Date(row.fecha) <= new Date() : false, // Solo restringe edicion si esta definido asi
    guardadoPorCreador: row.guardado_por_creador === true,
    archivoVencido: row.plazo_archivo_cumplido === true,
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

// Bloquea el registro del partido dentro de la transaccion. Evita que una
// propuesta se confirme simultaneamente con un retiro que la cancela.
async function obtenerPartidoBloqueadoOFallar(client, partidoId) {
  const { rows } = await client.query(
    `SELECT * FROM partidos WHERE id = $1 FOR UPDATE`, [partidoId]
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
    const err = new Error('No tienes permiso para modificar este partido');
    err.status = 403;
    throw err;
  }
}

/* =========================================================
   HELPER: destinatarios de un equipo (capitán + admins)
   ========================================================= */
async function obtenerUsuariosDeEquipo(client, equipoId) {
  const { rows } = await client.query(
    `SELECT g.capitan_id AS usuario_id
     FROM grupos g WHERE g.id = $1
     UNION
     SELECT gm.usuario_id
     FROM grupo_miembros gm
     WHERE gm.grupo_id = $1 AND gm.rol = 'admin'`,
    [equipoId]
  );

  return rows.map(r => r.usuario_id).filter(Boolean);
}

/* =========================================================
   HELPER: destinatarios de un partido
   ========================================================= */

/* Integrantes a notificar por cambios en eventos del equipo. */
async function obtenerTodosLosMiembrosEquipo(client, equipoId) {
  const { rows } = await client.query(
    `SELECT capitan_id AS usuario_id FROM grupos WHERE id = $1
     UNION
     SELECT usuario_id FROM grupo_miembros WHERE grupo_id = $1`,
    [equipoId]
  );
  return rows.map(r => r.usuario_id).filter(Boolean);
}

export async function obtenerDestinatariosPartido(client, partidoId) {
  const ids = new Set();

  const { rows: inscritos } = await client.query(
    `SELECT usuario_id FROM partido_inscripciones WHERE partido_id = $1`,
    [partidoId]
  );
  inscritos.forEach(r => ids.add(r.usuario_id));

  const { rows: equiposInscritos } = await client.query(
    `SELECT equipo_id FROM partido_equipos_inscritos WHERE partido_id = $1`,
    [partidoId]
  );
  for (const { equipo_id } of equiposInscritos) {
    const us = await obtenerTodosLosMiembrosEquipo(client, equipo_id);
    us.forEach(u => ids.add(u));
  }

  const { rows: postulantes } = await client.query(
    `SELECT usuario_id FROM partido_postulaciones
     WHERE partido_id = $1 AND estado = 'pendiente'`,
    [partidoId]
  );
  postulantes.forEach(r => ids.add(r.usuario_id));

  const { rows: equiposPostulantes } = await client.query(
    `SELECT equipo_id FROM partido_equipos_postulantes
     WHERE partido_id = $1 AND estado = 'pendiente'`,
    [partidoId]
  );
  for (const { equipo_id } of equiposPostulantes) {
    const us = await obtenerTodosLosMiembrosEquipo(client, equipo_id);
    us.forEach(u => ids.add(u));
  }

  const { rows: interesados } = await client.query(
    `SELECT usuario_id, equipo_id FROM partido_interesados WHERE partido_id = $1`,
    [partidoId]
  );
  for (const interesado of interesados) {
    ids.add(interesado.usuario_id);
    if (interesado.equipo_id) {
      const usuariosEquipo = await obtenerTodosLosMiembrosEquipo(client, interesado.equipo_id);
      usuariosEquipo.forEach(id => ids.add(id));
    }
  }

  return [...ids];
}

/* =========================================================
   LISTAR PARTIDOS
   ========================================================= */
export async function listarPartidos(filtros, usuarioId) {
  const {
    deporte, tipo, estado, nivel,
    soloMios, soloInscritos, busqueda,
    page = 1, limit = 20,
    desde, hasta, // ⚡ NUEVO
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

  // ⚡ NUEVO: filtro por fecha
  if (desde) {
    condiciones.push(`p.fecha >= $${i}::date`);
    valores.push(desde);
    i++;
  }

  if (hasta) {
    condiciones.push(`p.fecha < ($${i}::date + INTERVAL '1 day')`);
    valores.push(hasta);
    i++;
  }

  // ... el resto de la función QUEDA IGUAL desde soloMios en adelante
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

  // Los archivados vencidos solo se ofrecen a la consulta explicita de Mis creados.
  // Asi no reaparecen en el feed, la busqueda ni los listados del inicio.
  if (soloMios === 'true') {
    condiciones.push(`(
      p.fecha IS NULL OR p.fecha + INTERVAL '1 hour' > NOW() OR p.estado_partido = 'en_curso'
      OR (p.guardado_por_creador = TRUE AND p.organizador_id = $${i})
    )`);
    valores.push(usuarioId);
    i++;
  } else {
    condiciones.push(`(p.fecha IS NULL OR p.fecha + INTERVAL '1 hour' > NOW() OR p.estado_partido = 'en_curso')`);
  }

  // ⚡ BLOQUEO: excluir partidos de organizadores bloqueados (en cualquier dirección)
  const bloqueados = await idsBloqueadosTotales(usuarioId);
  if (bloqueados.length > 0) {
    const placeholders = [];
    for (let j = 0; j < bloqueados.length; j++) {
      placeholders.push(`$${i}`);
      valores.push(bloqueados[j]);
      i++;
    }
    condiciones.push(`p.organizador_id NOT IN (${placeholders.join(', ')})`);
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
       (p.fecha IS NOT NULL AND p.fecha + INTERVAL '1 hour' <= NOW() AND p.estado_partido IS DISTINCT FROM 'en_curso') AS plazo_archivo_cumplido,
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
         JOIN grupos g_partido ON g_partido.id = pei.equipo_id
         WHERE pei.partido_id = p.id
           AND (g_partido.capitan_id = $${idxUser} OR EXISTS (
             SELECT 1 FROM grupo_miembros gm
             WHERE gm.grupo_id = pei.equipo_id AND gm.usuario_id = $${idxUser}
               AND gm.rol IN ('capitan', 'admin')
           ))
       ) AS mi_equipo_inscrito,
       EXISTS (
         SELECT 1 FROM partido_interesados pint
         WHERE pint.partido_id = p.id AND pint.usuario_id = $${idxUser}
       ) AS yo_interesado,
       EXISTS (
         SELECT 1 FROM partido_equipos_postulantes pep
         JOIN grupos g_partido ON g_partido.id = pep.equipo_id
         WHERE pep.partido_id = p.id AND pep.estado = 'pendiente'
           AND (g_partido.capitan_id = $${idxUser} OR EXISTS (
             SELECT 1 FROM grupo_miembros gm
             WHERE gm.grupo_id = pep.equipo_id AND gm.usuario_id = $${idxUser}
               AND gm.rol IN ('capitan', 'admin')
           ))
       ) AS mi_equipo_postulado,
       (
         SELECT pep.equipo_id
         FROM partido_equipos_postulantes pep
         JOIN grupos g_partido ON g_partido.id = pep.equipo_id
         WHERE pep.partido_id = p.id AND pep.estado = 'pendiente'
           AND (g_partido.capitan_id = $${idxUser} OR EXISTS (
             SELECT 1 FROM grupo_miembros gm
             WHERE gm.grupo_id = pep.equipo_id AND gm.usuario_id = $${idxUser}
               AND gm.rol IN ('capitan', 'admin')
           ))
         LIMIT 1
       ) AS mi_equipo_postulado_id,
       (
         SELECT pei.equipo_id
         FROM partido_equipos_inscritos pei
         JOIN grupos g_partido ON g_partido.id = pei.equipo_id
         WHERE pei.partido_id = p.id
           AND (g_partido.capitan_id = $${idxUser} OR EXISTS (
             SELECT 1 FROM grupo_miembros gm
             WHERE gm.grupo_id = pei.equipo_id AND gm.usuario_id = $${idxUser}
               AND gm.rol IN ('capitan', 'admin')
           ))
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
       (p.fecha IS NOT NULL AND p.fecha + INTERVAL '1 hour' <= NOW() AND p.estado_partido IS DISTINCT FROM 'en_curso') AS plazo_archivo_cumplido,
       u.id AS u_id, u.nombre AS u_nombre, u.username AS u_username, u.avatar AS u_avatar
     FROM partidos p
     JOIN usuarios u ON u.id = p.organizador_id
     WHERE p.id = $1 AND (
       p.fecha IS NULL OR p.fecha + INTERVAL '1 hour' > NOW() OR p.estado_partido = 'en_curso'
       OR (p.guardado_por_creador = TRUE AND p.organizador_id = $2)
     )`,
    [partidoId, usuarioId]
  );

  if (!rows[0]) {
    const err = new Error('Partido no encontrado');
    err.status = 404;
    throw err;
  }

  const partido = rows[0];

  // ⚡ BLOQUEO: si hay bloqueo con el organizador, no se puede ver el detalle
  if (await estanBloqueados(usuarioId, partido.organizador_id)) {
    const err = new Error('Partido no disponible');
    err.status = 403;
    throw err;
  }

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
     WHERE pp.partido_id = $1 AND pp.estado = 'pendiente'
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
     WHERE pep.partido_id = $1 AND pep.estado = 'pendiente'
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
     WHERE partido_id = $1 AND usuario_id = $2 AND estado = 'pendiente'`,
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
     JOIN grupos g_partido ON g_partido.id = pep.equipo_id
     WHERE pep.partido_id = $1 AND pep.estado = 'pendiente'
       AND (g_partido.capitan_id = $2 OR EXISTS (
         SELECT 1 FROM grupo_miembros gm WHERE gm.grupo_id = pep.equipo_id
           AND gm.usuario_id = $2 AND gm.rol IN ('capitan', 'admin')
       ))
     LIMIT 1`,
    [partidoId, usuarioId]
  );

  const { rows: misEquiposInscritos } = await pool.query(
    `SELECT pei.equipo_id
     FROM partido_equipos_inscritos pei
     JOIN grupos g_partido ON g_partido.id = pei.equipo_id
     WHERE pei.partido_id = $1
       AND (g_partido.capitan_id = $2 OR EXISTS (
         SELECT 1 FROM grupo_miembros gm WHERE gm.grupo_id = pei.equipo_id
           AND gm.usuario_id = $2 AND gm.rol IN ('capitan', 'admin')
       ))
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
        const err = new Error('El equipo indicado no existe o no tienes permisos sobre él');
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
   ========================================================= */
export async function editarPartido(partidoId, cambios, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partidoAntes = await obtenerPartidoOFallar(client, partidoId);
    verificarOrganizador(partidoAntes, usuarioId);
     if (partidoAntes.fecha && new Date(partidoAntes.fecha) <= new Date()) {
      const err = new Error('No puedes modificar un partido que ya ha comenzado.');
      err.status = 400;
      throw err;
    }

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
        const err = new Error(`No puedes bajar los cupos a menos de ${totalActual} (inscritos actuales)`);
        err.status = 400;
        throw err;
      }
    }

    const permitidos = ['titulo', 'lugar', 'fecha', 'cupos', 'precio', 'descripcion'];
    const cambioReal = permitidos.some(campo =>
      cambios[campo] !== undefined &&
      (campo === 'fecha'
        ? new Date(cambios[campo]).getTime() !== new Date(partidoAntes[campo]).getTime()
        : String(cambios[campo] ?? '') !== String(partidoAntes[campo] ?? ''))
    );

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

    if (cambioReal) {
      const destinatarios = await obtenerDestinatariosPartido(client, partidoId);

      if (destinatarios.length > 0) {
        await crearNotificacionMultiple(
          destinatarios,
          'partido_actualizado',
          `El partido "${cambios.titulo ?? partidoAntes.titulo}" fue actualizado. Revisá los cambios.`,
          `#/partido/${partidoId}`,
          { client, obligatoria: true }
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
   GUARDAR PARTIDO COMO HISTORIAL (solo su creador)
   No cambia resultados ni evita la eliminación manual.
   ========================================================= */
export async function guardarPartido(partidoId, usuarioId) {
  const { rows } = await pool.query(
    `UPDATE partidos SET guardado_por_creador = TRUE, updated_at = NOW()
     WHERE id = $1 AND organizador_id = $2
     RETURNING id, guardado_por_creador`,
    [partidoId, usuarioId]
  );
  if (!rows[0]) {
    const { rowCount } = await pool.query('SELECT 1 FROM partidos WHERE id = $1', [partidoId]);
    const err = new Error(rowCount ? 'Solo el creador puede guardar este partido' : 'Partido no encontrado');
    err.status = rowCount ? 403 : 404;
    throw err;
  }
  return { ok: true, guardadoPorCreador: true, mensaje: 'Partido guardado en Mis creados' };
}

/* =========================================================
   ELIMINAR PARTIDO (solo organizador)
   ========================================================= */
export async function eliminarPartido(partidoId, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);
    verificarOrganizador(partido, usuarioId);

    const destinatarios = await obtenerDestinatariosPartido(client, partidoId);

    await client.query(
      `DELETE FROM partidos WHERE id = $1`,
      [partidoId]
    );

    if (destinatarios.length > 0) {
      await crearNotificacionMultiple(
        destinatarios,
        'partido_eliminado',
        `El partido "${partido.titulo}" fue eliminado por el organizador.`,
        null,
        { client, obligatoria: true }
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
   ========================================================= */
export async function inscribirse(partidoId, usuarioId, posicion = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoBloqueadoOFallar(client, partidoId);

    // ⚡ BLOQUEO con el organizador
    if (await estanBloqueados(usuarioId, partido.organizador_id)) {
      const err = new Error('No puedes inscribirte en este partido');
      err.status = 403;
      throw err;
    }

    if (partido.estado_partido === 'en_curso' || partido.estado_partido === 'finalizado') {
      const err = new Error('Este partido ya no acepta más participantes');
      err.status = 400;
      throw err;
    }

    const { rows: confirmAceptada } = await client.query(
      `SELECT 1 FROM partido_confirmaciones
       WHERE partido_id = $1 AND estado = 'aceptada'
       LIMIT 1`,
      [partidoId]
    );
    if (confirmAceptada.length > 0) {
      const err = new Error('Este partido ya fue confirmado con otro participante');
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

    // Si había una postulación antigua (rechazada o pendiente), la inscripción
    // directa prevalece y no debe seguir figurando como solicitud activa.
    await client.query(
      `DELETE FROM partido_postulaciones WHERE partido_id = $1 AND usuario_id = $2`,
      [partidoId, usuarioId]
    );

    const nuevoTotal = conteo[0].total + 1;
    if (nuevoTotal >= partido.cupos) {
      await client.query(
        `UPDATE partidos SET estado = 'lleno' WHERE id = $1`,
        [partidoId]
      );
    }

    if (String(partido.organizador_id) !== String(usuarioId)) {
      const { rows: datos } = await client.query(
        `SELECT nombre FROM usuarios WHERE id = $1`,
        [usuarioId]
      );
      const nombreUsuario = datos[0]?.nombre || 'Alguien';

      await crearNotificacion(
        partido.organizador_id,
        'inscripcion',
        `${nombreUsuario} se inscribió en tu partido "${partido.titulo}".`,
        `#/partido/${partidoId}`
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
   ========================================================= */
export async function salirDelPartido(partidoId, usuarioId) {
  return retirarParticipacionSinEquipoExplicito(partidoId, usuarioId);
}

/* =========================================================
   POSTULARSE (partido con aprobación)
   ========================================================= */
export async function postularse(partidoId, usuarioId, posicion = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoBloqueadoOFallar(client, partidoId);

    // ⚡ BLOQUEO con el organizador
    if (await estanBloqueados(usuarioId, partido.organizador_id)) {
      const err = new Error('No puedes postularte a este partido');
      err.status = 403;
      throw err;
    }

    if (partido.estado_partido === 'en_curso' || partido.estado_partido === 'finalizado') {
      const err = new Error('Este partido ya no acepta más postulaciones');
      err.status = 400;
      throw err;
    }

    const { rows: confirmAceptada } = await client.query(
      `SELECT 1 FROM partido_confirmaciones
       WHERE partido_id = $1 AND estado = 'aceptada'
       LIMIT 1`,
      [partidoId]
    );
    if (confirmAceptada.length > 0) {
      const err = new Error('Este partido ya fue confirmado con otro participante');
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

    const { rows: inscrito } = await client.query(
      `SELECT 1 FROM partido_inscripciones
       WHERE partido_id = $1 AND usuario_id = $2`,
      [partidoId, usuarioId]
    );
    if (inscrito.length) {
      const err = new Error('Ya estás inscrito en este partido');
      err.status = 409;
      throw err;
    }

    // Una postulación rechazada o aprobada en el pasado NO es una solicitud
    // activa. Si el jugador salió o fue expulsado, puede volver a solicitar.
    const { rows: anteriores } = await client.query(
      `SELECT estado FROM partido_postulaciones
       WHERE partido_id = $1 AND usuario_id = $2 FOR UPDATE`,
      [partidoId, usuarioId]
    );
    if (anteriores[0]?.estado === 'pendiente') {
      const err = new Error('Ya tienes una postulación pendiente');
      err.status = 409;
      throw err;
    }

    if (anteriores.length) {
      await client.query(
        `UPDATE partido_postulaciones
         SET estado = 'pendiente', posicion = $3,
             resuelta_en = NULL, created_at = NOW()
         WHERE partido_id = $1 AND usuario_id = $2`,
        [partidoId, usuarioId, posicion || null]
      );
    } else {
      await client.query(
        `INSERT INTO partido_postulaciones (partido_id, usuario_id, posicion)
         VALUES ($1, $2, $3)`,
        [partidoId, usuarioId, posicion || null]
      );
    }

    if (String(partido.organizador_id) !== String(usuarioId)) {
      const { rows: datos } = await client.query(
        `SELECT nombre FROM usuarios WHERE id = $1`,
        [usuarioId]
      );
      const nombreUsuario = datos[0]?.nombre || 'Alguien';

      await crearNotificacion(
        partido.organizador_id,
        'postulacion',
        `${nombreUsuario} se postuló a tu partido "${partido.titulo}".`,
        `#/partido/${partidoId}`
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
   CANCELAR POSTULACIÓN (jugador)
   ========================================================= */
export async function cancelarPostulacion(partidoId, usuarioId) {
  return retirarParticipacion(partidoId, usuarioId);
}

/* =========================================================
   APROBAR / RECHAZAR POSTULANTE (organizador)
   ========================================================= */
export async function gestionarPostulante(partidoId, usuarioId, postulanteId, accion) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoBloqueadoOFallar(client, partidoId);
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

      await crearNotificacion(
        postulanteId,
        'rechazado',
        `Tu postulación al partido "${partido.titulo}" fue rechazada.`,
        `#/partido/${partidoId}`
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

    await crearNotificacion(
      postulanteId,
      'aprobado',
      `¡Te aprobaron en el partido "${partido.titulo}"! Ya estás inscrito.`,
      `#/partido/${partidoId}`
    );

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
    // Serializa inscripciones del mismo partido y evita sobrepasar cupos.
    const partido = await obtenerPartidoBloqueadoOFallar(client, partidoId);

    if (await estanBloqueados(usuarioId, partido.organizador_id)) {
      const err = new Error('No puedes inscribir ese equipo en este partido');
      err.status = 403;
      throw err;
    }
    if (partido.estado_partido === 'en_curso' || partido.estado_partido === 'finalizado') {
      const err = new Error('Este partido ya no acepta equipos');
      err.status = 400;
      throw err;
    }
    if (partido.tipo_partido !== 'equipo') {
      const err = new Error('Este partido es de jugadores');
      err.status = 400;
      throw err;
    }
    if (partido.estado !== 'abierto') {
      const err = new Error('El partido no está abierto para nuevas inscripciones');
      err.status = 400;
      throw err;
    }

    const { rows: equipo } = await client.query(
      `SELECT id, nombre FROM grupos
       WHERE id = $1 AND tipo = 'equipo' AND deporte = $3
         AND (capitan_id = $2 OR EXISTS (
           SELECT 1 FROM grupo_miembros
           WHERE grupo_id = grupos.id AND usuario_id = $2 AND rol IN ('capitan', 'admin')
         ))`,
      [equipoId, usuarioId, partido.deporte]
    );
    if (!equipo[0]) {
      const err = new Error('No tienes permisos sobre un equipo de ese deporte');
      err.status = 403;
      throw err;
    }

    const { rows: inscritos } = await client.query(
      `SELECT 1 FROM partido_equipos_inscritos
       WHERE partido_id = $1 AND equipo_id = $2`,
      [partidoId, equipoId]
    );
    if (inscritos.length) {
      const err = new Error('El equipo ya está inscrito en este partido');
      err.status = 409;
      throw err;
    }

    const { rows: anteriores } = await client.query(
      `SELECT estado FROM partido_equipos_postulantes
       WHERE partido_id = $1 AND equipo_id = $2 FOR UPDATE`,
      [partidoId, equipoId]
    );
    // Sólo una postulación PENDIENTE bloquea una nueva solicitud.
    // Las rechazadas y aceptadas antiguas se pueden reutilizar tras retirarse.
    if (partido.aprobacion_requerida !== false && anteriores[0]?.estado === 'pendiente') {
      const err = new Error('El equipo ya tiene una postulación pendiente');
      err.status = 409;
      throw err;
    }

    const { rows: conteo } = await client.query(
      `SELECT COUNT(*)::int AS total FROM partido_equipos_inscritos WHERE partido_id = $1`,
      [partidoId]
    );
    if (conteo[0].total >= partido.cupos) {
      const err = new Error('No quedan cupos en este partido');
      err.status = 409;
      throw err;
    }

    // ON: equipo entra inmediatamente. OFF: queda en la lista de postulantes.
    const inscripcionDirecta = partido.aprobacion_requerida === false;
    if (inscripcionDirecta) {
      await client.query(
        `INSERT INTO partido_equipos_inscritos (partido_id, equipo_id) VALUES ($1, $2)`,
        [partidoId, equipoId]
      );
      // Al inscribirse directamente deja de existir cualquier postulación previa
      // (rechazada, aceptada o pendiente) para que no se muestre como pendiente.
      await client.query(
        `DELETE FROM partido_equipos_postulantes
         WHERE partido_id = $1 AND equipo_id = $2`,
        [partidoId, equipoId]
      );
      if (conteo[0].total + 1 >= partido.cupos) {
        await client.query(`UPDATE partidos SET estado = 'lleno' WHERE id = $1`, [partidoId]);
      }
    } else if (anteriores.length) {
      await client.query(
        `UPDATE partido_equipos_postulantes
         SET estado = 'pendiente', resuelta_en = NULL, created_at = NOW()
         WHERE partido_id = $1 AND equipo_id = $2`,
        [partidoId, equipoId]
      );
    } else {
      await client.query(
        `INSERT INTO partido_equipos_postulantes (partido_id, equipo_id)
         VALUES ($1, $2)`,
        [partidoId, equipoId]
      );
    }

    await crearNotificacionMultiple(
      [partido.organizador_id],
      inscripcionDirecta ? 'inscripcion' : 'postulacion',
      inscripcionDirecta
        ? `${equipo[0].nombre} se inscribió en tu partido "${partido.titulo}".`
        : `${equipo[0].nombre} solicitó inscribirse en tu partido "${partido.titulo}".`,
      `#/partido/${partidoId}`,
      { client }
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
  return retirarParticipacion(partidoId, usuarioId, equipoId);
}

/* =========================================================
   APROBAR / RECHAZAR EQUIPO POSTULANTE (organizador)
   ========================================================= */
export async function gestionarEquipoPostulante(partidoId, usuarioId, equipoId, accion) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoBloqueadoOFallar(client, partidoId);
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

    const { rows: datosEquipo } = await client.query(
      `SELECT nombre FROM grupos WHERE id = $1`,
      [equipoId]
    );
    const nombreEquipo = datosEquipo[0]?.nombre || 'Tu equipo';

    if (accion === 'rechazar') {
      await client.query(
        `UPDATE partido_equipos_postulantes
         SET estado = 'rechazado', resuelta_en = NOW()
         WHERE partido_id = $1 AND equipo_id = $2`,
        [partidoId, equipoId]
      );

      const usuariosDestino = await obtenerUsuariosDeEquipo(client, equipoId);
      if (usuariosDestino.length > 0) {
        await crearNotificacionMultiple(
          usuariosDestino,
          'rechazado',
          `La postulación de "${nombreEquipo}" al partido "${partido.titulo}" fue rechazada.`,
          `#/partido/${partidoId}`
        );
      }

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

    const usuariosDestino = await obtenerUsuariosDeEquipo(client, equipoId);
    if (usuariosDestino.length > 0) {
      await crearNotificacionMultiple(
        usuariosDestino,
        'aprobado',
        `¡"${nombreEquipo}" fue aprobado en el partido "${partido.titulo}"!`,
        `#/partido/${partidoId}`
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

// Compatibilidad con los endpoints antiguos, que no reciben equipoId.
// Si la persona controla exactamente un equipo con participación en ese
// partido, podemos retirarlo sin modificar la llamada del frontend.
async function retirarParticipacionSinEquipoExplicito(partidoId, usuarioId) {
  const { rows: partidos } = await pool.query(
    `SELECT tipo_partido FROM partidos WHERE id = $1`, [partidoId]
  );
  if (!partidos[0] || partidos[0].tipo_partido === 'jugador') {
    return retirarParticipacion(partidoId, usuarioId);
  }
  const { rows: equipos } = await pool.query(
    `SELECT DISTINCT e.equipo_id
     FROM (
       SELECT equipo_id FROM partido_equipos_inscritos WHERE partido_id = $1
       UNION SELECT equipo_id FROM partido_equipos_postulantes WHERE partido_id = $1
       UNION SELECT equipo_id FROM partido_interesados
         WHERE partido_id = $1 AND equipo_id IS NOT NULL
       UNION SELECT equipo_id FROM partido_confirmaciones
         WHERE partido_id = $1 AND interesado_tipo = 'equipo'
           AND estado IN ('pendiente','aceptada') AND equipo_id IS NOT NULL
     ) e
     JOIN grupos g ON g.id = e.equipo_id
     WHERE g.capitan_id = $2 OR EXISTS (
       SELECT 1 FROM grupo_miembros gm WHERE gm.grupo_id = g.id
       AND gm.usuario_id = $2 AND gm.rol IN ('capitan','admin')
     )`, [partidoId, usuarioId]
  );
  if (equipos.length !== 1) {
    const err = new Error(equipos.length
      ? 'Administra varios equipos: selecciona el que quieres retirar'
      : 'No administras equipos inscritos o interesados en este partido');
    err.status = 400;
    throw err;
  }
  return retirarParticipacion(partidoId, usuarioId, equipos[0].equipo_id);
}

/* =========================================================
   RETIRAR PARTICIPACION EN CUALQUIER ESTADO
   - Jugador: inscrito, postulante, interesado o propuesta
   - Equipo: solo capitan/admin; retira al equipo inscrito,
     postulante o interesado y anula propuestas pendientes/aceptadas.
   - No cambia los resultados de encuentros ya realizados.
   ========================================================= */
export async function retirarParticipacion(partidoId, usuarioId, equipoId = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serializar cambios de participantes/propuestas y una posible eliminación.
    const { rows: partidos } = await client.query(
      `SELECT * FROM partidos WHERE id = $1 FOR UPDATE`, [partidoId]
    );
    const partido = partidos[0];
    if (!partido) {
      const err = new Error('Partido no encontrado');
      err.status = 404;
      throw err;
    }
    if (String(partido.organizador_id) === String(usuarioId)) {
      const err = new Error('El organizador debe eliminar su partido si quiere cancelarlo');
      err.status = 400;
      throw err;
    }
    if (equipoId && partido.tipo_partido !== 'equipo') {
      const err = new Error('Este partido no admite equipos');
      err.status = 400;
      throw err;
    }
    if (!equipoId && partido.tipo_partido !== 'jugador') {
      const err = new Error('Selecciona el equipo que quieres retirar');
      err.status = 400;
      throw err;
    }

    let nombreParticipante = 'Un participante';
    let retirado = 0;
    let habiaAceptada = false;

    if (equipoId) {
      const { rows: equipos } = await client.query(
        `SELECT g.nombre FROM grupos g
         WHERE g.id = $1 AND g.tipo = 'equipo'
           AND (g.capitan_id = $2 OR EXISTS (
             SELECT 1 FROM grupo_miembros gm
             WHERE gm.grupo_id = g.id AND gm.usuario_id = $2
               AND gm.rol IN ('capitan','admin')
           ))`, [equipoId, usuarioId]
      );
      if (!equipos[0]) {
        const err = new Error('Solo el capitán o un administrador puede retirar al equipo');
        err.status = 403;
        throw err;
      }
      nombreParticipante = equipos[0].nombre || 'Un equipo';
      const { rows: aceptadas } = await client.query(
        `SELECT id FROM partido_confirmaciones
         WHERE partido_id = $1 AND equipo_id = $2
           AND interesado_tipo = 'equipo' AND estado = 'aceptada'`,
        [partidoId, equipoId]
      );
      habiaAceptada = aceptadas.length > 0;

      for (const [tabla, columna] of [
        ['partido_equipos_inscritos', 'equipo_id', ''],
        ['partido_equipos_postulantes', 'equipo_id', ''],
        ['partido_interesados', 'equipo_id', '']
      ]) {
        // Solo identificadores internos constantes, sin SQL generado desde entradas.
        const r = await client.query(
          `DELETE FROM ${tabla} WHERE partido_id = $1 AND ${columna} = $2`,
          [partidoId, equipoId]
        );
        retirado += r.rowCount;
      }
      const canceladas = await client.query(
        `UPDATE partido_confirmaciones SET estado = 'cancelada', resuelta_en = NOW()
         WHERE partido_id = $1 AND equipo_id = $2
           AND interesado_tipo = 'equipo' AND estado IN ('pendiente','aceptada')`,
        [partidoId, equipoId]
      );
      retirado += canceladas.rowCount;
    } else {
      const { rows: usuarios } = await client.query(
        `SELECT nombre FROM usuarios WHERE id = $1`, [usuarioId]
      );
      nombreParticipante = usuarios[0]?.nombre || 'Un jugador';
      const { rows: aceptadas } = await client.query(
        `SELECT id FROM partido_confirmaciones
         WHERE partido_id = $1 AND interesado_id = $2
           AND interesado_tipo = 'usuario' AND estado = 'aceptada'`,
        [partidoId, usuarioId]
      );
      habiaAceptada = aceptadas.length > 0;
      for (const tabla of ['partido_inscripciones', 'partido_postulaciones']) {
        const r = await client.query(
          `DELETE FROM ${tabla} WHERE partido_id = $1 AND usuario_id = $2`,
          [partidoId, usuarioId]
        );
        retirado += r.rowCount;
      }
      const rInteres = await client.query(
        `DELETE FROM partido_interesados
         WHERE partido_id = $1 AND usuario_id = $2 AND equipo_id IS NULL`,
        [partidoId, usuarioId]
      );
      retirado += rInteres.rowCount;
      const canceladas = await client.query(
        `UPDATE partido_confirmaciones SET estado = 'cancelada', resuelta_en = NOW()
         WHERE partido_id = $1 AND interesado_id = $2
           AND interesado_tipo = 'usuario' AND estado IN ('pendiente','aceptada')`,
        [partidoId, usuarioId]
      );
      retirado += canceladas.rowCount;
    }

    if (!retirado) {
      const err = new Error('No se encontró una inscripción, interés o propuesta activa para retirar');
      err.status = 404;
      throw err;
    }

    // Revertir solo una confirmación de Organizar que se haya aceptado,
    // siempre que no haya empezado ni queden participantes inscritos.
    const { rows: conteos } = await client.query(
      `SELECT
        (SELECT COUNT(*)::int FROM partido_inscripciones WHERE partido_id = $1) AS jugadores,
        (SELECT COUNT(*)::int FROM partido_equipos_inscritos WHERE partido_id = $1) AS equipos,
        (SELECT COUNT(*)::int FROM partido_confirmaciones
          WHERE partido_id = $1 AND estado = 'aceptada') AS confirmaciones`,
      [partidoId]
    );
    const total = conteos[0].jugadores + conteos[0].equipos;
    const haComenzado = Boolean(partido.fecha && new Date(partido.fecha) <= new Date());
    const volverAOrganizar = habiaAceptada && !haComenzado &&
      conteos[0].confirmaciones === 0 && partido.estado_partido === 'confirmado';
    if (volverAOrganizar) {
      await client.query(
        `UPDATE partidos SET estado_partido = 'buscando_jugadores',
          estado = 'abierto', lugar = NULL, fecha = NULL, precio = 0,
          updated_at = NOW() WHERE id = $1`,
        [partidoId]
      );
    } else if (partido.estado === 'lleno' && total < partido.cupos && !haComenzado) {
      await client.query(
        `UPDATE partidos SET estado = 'abierto', updated_at = NOW() WHERE id = $1`,
        [partidoId]
      );
    }

    await crearNotificacionMultiple(
      [partido.organizador_id], 'jugador_salio',
      `${nombreParticipante} canceló su participación o interés en el partido "${partido.titulo}".`,
      `#/partido/${partidoId}`, { client, obligatoria: true }
    );
    if (volverAOrganizar) {
      const destinatarios = await obtenerDestinatariosPartido(client, partidoId);
      const ids = destinatarios.filter(id => String(id) !== String(usuarioId));
      if (ids.length) {
        await crearNotificacionMultiple(
          ids, 'partido_actualizado',
          `El partido "${partido.titulo}" volvió al modo Organizar después de una cancelación.`,
          `#/partido/${partidoId}`, { client, obligatoria: true }
        );
      }
    }

    await client.query('COMMIT');
    return { ok: true, mensaje: volverAOrganizar
      ? 'Participación cancelada. El partido volvió al modo Organizar.'
      : 'Participación o interés cancelado correctamente.' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* Para retirar un equipo confirmado se utiliza el mismo control de permisos. */
export async function salirEquipoDelPartido(partidoId, usuarioId, equipoId) {
  return retirarParticipacion(partidoId, usuarioId, equipoId);
}

/* =========================================================
   MODO "ORGANIZAR PARTIDO" — Interesados
   ========================================================= */

/* ---------- POST /api/partidos/:id/interesarse ---------- */
export async function interesarse(partidoId, usuarioId, equipoId = null, mensaje = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);

    // ⚡ BLOQUEO con el organizador
    if (await estanBloqueados(usuarioId, partido.organizador_id)) {
      const err = new Error('No puedes interesarte en este partido');
      err.status = 403;
      throw err;
    }

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

    if (partido.tipo_partido === 'equipo' && !equipoId) {
      const err = new Error('Este partido es de equipos. Debes elegir un equipo para interesarte.');
      err.status = 400;
      throw err;
    }

    if (equipoId) {
      const { rows: equipo } = await client.query(
        `SELECT id, nombre FROM grupos
         WHERE id = $1 AND tipo = 'equipo' AND deporte = $2
           AND (capitan_id = $3 OR EXISTS (
             SELECT 1 FROM grupo_miembros
             WHERE grupo_id = grupos.id AND usuario_id = $3 AND rol IN ('capitan', 'admin')
           ))`,
        [equipoId, partido.deporte, usuarioId]
      );

      if (!equipo[0]) {
        const err = new Error(`No tienes permisos sobre ese equipo o no es de ${partido.deporte}`);
        err.status = 403;
        throw err;
      }
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
      `INSERT INTO partido_interesados (partido_id, usuario_id, equipo_id, mensaje)
       VALUES ($1, $2, $3, $4)`,
      [partidoId, usuarioId, equipoId, mensaje || null]
    );

    const { rows: datosInteresado } = await client.query(
      `SELECT nombre FROM usuarios WHERE id = $1`,
      [usuarioId]
    );
    const nombreInteresado = datosInteresado[0]?.nombre || 'Un usuario';

    await crearNotificacion(
      partido.organizador_id,
      'nuevo_interesado',
      `${nombreInteresado} está interesado en tu partido "${partido.titulo}".`,
      `#/partido/${partidoId}`
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
  return retirarParticipacionSinEquipoExplicito(partidoId, usuarioId);
}
/* ---------- GET /api/partidos/:id/interesados ---------- */
export async function listarInteresados(partidoId, usuarioId) {
  const { rows: partidoRows } = await pool.query(
    `SELECT organizador_id, tipo_partido FROM partidos WHERE id = $1`,
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

  // ⚡ FIX: Quitamos pi.created_at del ORDER BY y usamos u.nombre para ordenar
  const { rows } = await pool.query(
    `SELECT
       u.id, u.nombre, u.username, u.avatar, u.ciudad,
       pi.mensaje,
       pi.equipo_id,
       g.nombre AS equipo_nombre,
       g.escudo AS equipo_escudo,
       g.capitan_id
     FROM partido_interesados pi
     JOIN usuarios u ON u.id = pi.usuario_id
     LEFT JOIN grupos g ON g.id = pi.equipo_id
     WHERE pi.partido_id = $1
     ORDER BY u.nombre ASC`,
    [partidoId]
  );

  // ⚡ BLOQUEO: ocultar interesados bloqueados con el organizador
  const bloqueados = await idsBloqueadosTotales(usuarioId);
  return rows.filter(r => !bloqueados.includes(r.id));
}

/* =========================================================
   CONFIRMAR PARTIDO (organizador propone)
   ========================================================= */
export async function confirmarPartido(partidoId, usuarioId, datos) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoBloqueadoOFallar(client, partidoId);
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

    // ⚡ BLOQUEO: no se puede confirmar con un usuario bloqueado
    if (await estanBloqueados(usuarioId, interesadoId)) {
      const err = new Error('No puedes confirmar con este usuario');
      err.status = 403;
      throw err;
    }

    if (!lugar || !fecha) {
      const err = new Error('Lugar y fecha son obligatorios para confirmar');
      err.status = 400;
      throw err;
    }

    // Solo se puede proponer a una persona que se interesó realmente
    // por este partido. Para equipos, el ID debe coincidir con ese interés.
    if ((partido.tipo_partido === 'jugador' && interesadoTipo !== 'usuario') ||
        (partido.tipo_partido === 'equipo' && interesadoTipo !== 'equipo')) {
      const err = new Error('El tipo de destinatario no coincide con el partido');
      err.status = 400;
      throw err;
    }
    if (interesadoTipo === 'equipo' && !equipoId) {
      const err = new Error('Debes indicar el equipo interesado');
      err.status = 400;
      throw err;
    }
    const { rows: interesValidado } = await client.query(
      `SELECT 1 FROM partido_interesados
       WHERE partido_id = $1 AND usuario_id = $2
         AND (($3::uuid IS NULL AND equipo_id IS NULL) OR equipo_id = $3::uuid)`,
      [partidoId, interesadoId, interesadoTipo === 'equipo' ? equipoId : null]
    );
    if (!interesValidado[0]) {
      const err = new Error('El destinatario no consta como interesado en este partido');
      err.status = 404;
      throw err;
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

    // Aviso operativo: no depende de preferencias sociales y se confirma
    // en la misma transacción que la propuesta.
    await crearNotificacionMultiple(
      [interesadoId],
      'confirmacion_partido',
      `${nombreOrganizador} te envió una propuesta para el partido "${partido.titulo}". Puedes aceptarla o rechazarla.`,
      `#/partido/${partidoId}`,
      { client, obligatoria: true }
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

    const partido = await obtenerPartidoBloqueadoOFallar(client, partidoId);

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

    // ⚡ BLOQUEO con el organizador
    if (await estanBloqueados(usuarioId, propuesta.organizador_id)) {
      const err = new Error('No puedes responder a esta propuesta');
      err.status = 403;
      throw err;
    }

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

    const partido = await obtenerPartidoBloqueadoOFallar(client, partidoId);

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

    // ⚡ BLOQUEO con el organizador
    if (await estanBloqueados(usuarioId, propuesta.organizador_id)) {
      const err = new Error('No puedes responder a esta propuesta');
      err.status = 403;
      throw err;
    }

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

    const partido = await obtenerPartidoBloqueadoOFallar(client, partidoId);
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

    await crearNotificacion(
      propuesta.interesado_id,
      'confirmacion_cancelada',
      `El organizador canceló la propuesta de confirmación del partido "${partido.titulo}".`,
      `#/partido/${partidoId}`
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
    const err = new Error('No tienes permiso para ver esta propuesta');
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
   ⚡ ECHAR PARTICIPANTES (solo organizador)
   ========================================================= */

/* ---------- DELETE /api/partidos/:id/inscritos/:usuarioId ---------- */
export async function echarInscrito(partidoId, usuarioId, inscritoId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoBloqueadoOFallar(client, partidoId);
    verificarOrganizador(partido, usuarioId);

    if (String(partido.organizador_id) === String(inscritoId)) {
      const err = new Error('No puedes echarte a ti mismo del partido');
      err.status = 400;
      throw err;
    }

    const { rowCount } = await client.query(
      `DELETE FROM partido_inscripciones
       WHERE partido_id = $1 AND usuario_id = $2`,
      [partidoId, inscritoId]
    );

    if (rowCount === 0) {
      const err = new Error('Ese jugador no está inscrito en este partido');
      err.status = 404;
      throw err;
    }

    const { rows: conteo } = await client.query(
      `SELECT COUNT(*)::int AS total FROM partido_inscripciones WHERE partido_id = $1`,
      [partidoId]
    );

    // Un partido normal que nació confirmado NO debe pasar a Organizar
    // al expulsar al último jugador: debe liberar el cupo para reingresar.
    // Sólo una confirmación real del modo Organizar justifica volver a ese modo.
    const { rowCount: confirmacionCancelada } = await client.query(
      `UPDATE partido_confirmaciones
       SET estado = 'cancelada', resuelta_en = NOW()
       WHERE partido_id = $1 AND interesado_id = $2
         AND interesado_tipo = 'usuario' AND estado = 'aceptada'`,
      [partidoId, inscritoId]
    );
    const yaNoQuedan = conteo[0].total === 0;
    const haComenzado = Boolean(partido.fecha && new Date(partido.fecha) <= new Date());
    let reversiono = false;

    if (confirmacionCancelada > 0) {
      await client.query(
        `DELETE FROM partido_interesados
         WHERE partido_id = $1 AND usuario_id = $2 AND equipo_id IS NULL`,
        [partidoId, inscritoId]
      );
    }

    if (yaNoQuedan && confirmacionCancelada > 0 &&
        partido.estado_partido === 'confirmado' && !haComenzado) {
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
         WHERE partido_id = $1 AND estado IN ('pendiente', 'aceptada')`,
        [partidoId]
      );

      reversiono = true;
    } else if (conteo[0].total < partido.cupos && partido.estado === 'lleno' && !haComenzado) {
      await client.query(
        `UPDATE partidos SET estado = 'abierto' WHERE id = $1`,
        [partidoId]
      );
    }

    await crearNotificacion(
      inscritoId,
      'expulsado',
      `Fuiste retirado del partido "${partido.titulo}" por el organizador.`,
      `#/partido/${partidoId}`
    );

    await client.query('COMMIT');

    return {
      ok: true,
      mensaje: reversiono
        ? 'Jugador retirado. El partido volvió a modo Organizar.'
        : 'Jugador retirado del partido',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* ---------- DELETE /api/partidos/:id/interesados/:usuarioId ---------- */
export async function echarInteresado(partidoId, usuarioId, interesadoId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);
    verificarOrganizador(partido, usuarioId);

    const { rowCount } = await client.query(
      `DELETE FROM partido_interesados
       WHERE partido_id = $1 AND usuario_id = $2`,
      [partidoId, interesadoId]
    );

    if (rowCount === 0) {
      const err = new Error('Ese usuario no está interesado en este partido');
      err.status = 404;
      throw err;
    }

    const { rows: propuestas } = await client.query(
      `SELECT id FROM partido_confirmaciones
       WHERE partido_id = $1 AND interesado_id = $2 AND estado = 'pendiente'`,
      [partidoId, interesadoId]
    );

    if (propuestas.length > 0) {
      await client.query(
        `UPDATE partido_confirmaciones
         SET estado = 'cancelada', resuelta_en = NOW()
         WHERE partido_id = $1 AND interesado_id = $2 AND estado = 'pendiente'`,
        [partidoId, interesadoId]
      );

      await client.query(
        `DELETE FROM notificaciones
         WHERE usuario_id = $1
           AND tipo = 'confirmacion_partido'
           AND link = $2`,
        [interesadoId, `#/partido/${partidoId}`]
      );

      await crearNotificacion(
        interesadoId,
        'confirmacion_cancelada',
        `El organizador canceló la propuesta de confirmación del partido "${partido.titulo}".`,
        `#/partido/${partidoId}`
      );
    }

    await crearNotificacion(
      interesadoId,
      'expulsado',
      `Fuiste retirado de la lista de interesados del partido "${partido.titulo}".`,
      `#/partido/${partidoId}`
    );

    await client.query('COMMIT');

    return {
      ok: true,
      mensaje: 'Interesado retirado del partido',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* ---------- DELETE /api/partidos/:id/equipos-inscritos/:equipoId ---------- */
export async function echarEquipoInscrito(partidoId, usuarioId, equipoId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoBloqueadoOFallar(client, partidoId);
    verificarOrganizador(partido, usuarioId);

    const { rowCount } = await client.query(
      `DELETE FROM partido_equipos_inscritos
       WHERE partido_id = $1 AND equipo_id = $2`,
      [partidoId, equipoId]
    );

    if (rowCount === 0) {
      const err = new Error('Ese equipo no está inscrito en este partido');
      err.status = 404;
      throw err;
    }

    const { rows: conteo } = await client.query(
      `SELECT COUNT(*)::int AS total FROM partido_equipos_inscritos WHERE partido_id = $1`,
      [partidoId]
    );
    const { rowCount: confirmacionCancelada } = await client.query(
      `UPDATE partido_confirmaciones
       SET estado = 'cancelada', resuelta_en = NOW()
       WHERE partido_id = $1 AND equipo_id = $2
         AND interesado_tipo = 'equipo' AND estado = 'aceptada'`,
      [partidoId, equipoId]
    );
    const haComenzado = Boolean(partido.fecha && new Date(partido.fecha) <= new Date());
    const volverAOrganizar = confirmacionCancelada > 0 && conteo[0].total === 0 &&
      partido.estado_partido === 'confirmado' && !haComenzado;
    if (confirmacionCancelada > 0) {
      await client.query(
        `DELETE FROM partido_interesados
         WHERE partido_id = $1 AND equipo_id = $2`,
        [partidoId, equipoId]
      );
    }
    if (volverAOrganizar) {
      await client.query(
        `UPDATE partidos SET estado_partido = 'buscando_jugadores',
           estado = 'abierto', lugar = NULL, fecha = NULL, precio = 0,
           updated_at = NOW() WHERE id = $1`,
        [partidoId]
      );
    } else if (conteo[0].total < partido.cupos && partido.estado === 'lleno' && !haComenzado) {
      await client.query(
        `UPDATE partidos SET estado = 'abierto' WHERE id = $1`,
        [partidoId]
      );
    }

    const { rows: datosEquipo } = await client.query(
      `SELECT nombre FROM grupos WHERE id = $1`,
      [equipoId]
    );
    const nombreEquipo = datosEquipo[0]?.nombre || 'Tu equipo';

    const usuariosDestino = await obtenerUsuariosDeEquipo(client, equipoId);
    if (usuariosDestino.length > 0) {
      await crearNotificacionMultiple(
        usuariosDestino,
        'expulsado',
        `"${nombreEquipo}" fue retirado del partido "${partido.titulo}" por el organizador.`,
        `#/partido/${partidoId}`
      );
    }

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Equipo retirado del partido' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   HISTORIAL DE PARTIDOS (para el perfil)
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