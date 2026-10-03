/* =========================================================
   torneos.service.js — Lógica de negocio de torneos
   ========================================================= */

import { pool } from '../config/db.js';
import { crearNotificacion } from './notificaciones.service.js';

/* =========================================================
   HELPERS
   ========================================================= */

function esUuidValido(str) {
  if (!str) return false;
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(str));
}

function formatearTorneo(row, extras = {}) {
  return {
    id: row.id,
    nombre: row.nombre,
    deporte: row.deporte,
    emoji: row.emoji,
    descripcion: row.descripcion,
    lugar: row.lugar,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    fechaLimiteInscripcion: row.fecha_limite_inscripcion,
    cuposEquipos: row.cupos_equipos,
    precio: row.precio,
    estado: row.estado,
    modalidad: row.modalidad,
    nivel: row.nivel,
    libreInscripcion: row.libre_inscripcion,
    tipoParticipacion: row.tipo_participacion,
    puntosVictoria: row.puntos_victoria,
    puntosEmpate: row.puntos_empate,
    puntosDerrota: row.puntos_derrota,
    permiteEmpate: row.permite_empate,
    incluyeEstadisticas: row.incluye_estadisticas,
    equiposClasifican: row.equipos_clasifican,
    canalChatId: row.canal_chat_id,
    organizador: extras.organizador || null,
    totalEquipos: extras.totalEquipos ?? 0,
    totalListaEspera: extras.totalListaEspera ?? 0,
    totalPartidos: extras.totalPartidos ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function obtenerTorneoOFallar(client, torneoId) {
  const { rows } = await client.query(
    `SELECT * FROM torneos WHERE id = $1`,
    [torneoId]
  );

  if (!rows[0]) {
    const err = new Error('Torneo no encontrado');
    err.status = 404;
    throw err;
  }

  return rows[0];
}

function verificarOrganizador(torneo, usuarioId) {
  if (String(torneo.organizador_id) !== String(usuarioId)) {
    const err = new Error('No tenés permiso para modificar este torneo');
    err.status = 403;
    throw err;
  }
}

/* =========================================================
   HELPER: IDs de equipos donde el usuario es capitán o admin
   ========================================================= */
async function obtenerMisEquipoIds(usuarioId) {
  const { rows } = await pool.query(
    `SELECT g.id
     FROM grupos g
     WHERE g.tipo = 'equipo'
       AND (
         g.capitan_id = $1
         OR EXISTS (
           SELECT 1 FROM grupo_miembros gm
           WHERE gm.grupo_id = g.id
             AND gm.usuario_id = $1
             AND gm.rol IN ('capitan', 'admin')
         )
       )`,
    [usuarioId]
  );

  return new Set(rows.map(r => String(r.id)));
}

/* =========================================================
   HELPER: usuario destino de una notificación
   ========================================================= */
async function obtenerUsuarioDestino(client, equipoId, esIndividual) {
  if (esIndividual) return equipoId;

  const { rows } = await client.query(
    `SELECT capitan_id FROM grupos WHERE id = $1`,
    [equipoId]
  );
  return rows[0]?.capitan_id || null;
}

/* =========================================================
   HELPER: nombre "lindo" para mostrar en notificaciones
   ========================================================= */
async function obtenerNombreMostrar(client, equipoId, esIndividual) {
  if (esIndividual) {
    const { rows } = await client.query(
      `SELECT nombre FROM usuarios WHERE id = $1`,
      [equipoId]
    );
    return rows[0]?.nombre || 'Alguien';
  }

  const { rows } = await client.query(
    `SELECT nombre FROM grupos WHERE id = $1`,
    [equipoId]
  );
  return rows[0]?.nombre || 'Un equipo';
}

/* =========================================================
   HELPER: participantes de un torneo
   ========================================================= */
async function obtenerParticipantes(client, torneoId, tipoParticipacion) {
  if (tipoParticipacion === 'individual') {
    const { rows } = await client.query(
      `SELECT
         u.id                            AS id,
         u.nombre                        AS nombre,
         u.avatar                        AS escudo,
         NULL::varchar                   AS deporte,
         NULL::varchar                   AS ciudad,
         u.id                            AS capitan_id,
         1                               AS total_jugadores,
         TRUE                            AS es_individual
       FROM torneo_equipos te
       JOIN usuarios u ON u.id = te.equipo_id
       WHERE te.torneo_id = $1
       ORDER BY te.fecha ASC`,
      [torneoId]
    );
    return rows;
  }

  const { rows } = await client.query(
    `SELECT g.id, g.nombre, g.escudo, g.deporte, g.ciudad, g.capitan_id,
            (SELECT COUNT(*)::int FROM grupo_miembros WHERE grupo_id = g.id) AS total_jugadores,
            FALSE AS es_individual
     FROM torneo_equipos te
     JOIN grupos g ON g.id = te.equipo_id
     WHERE te.torneo_id = $1
     ORDER BY te.fecha ASC`,
    [torneoId]
  );
  return rows;
}

/* =========================================================
   HELPER: lista de espera (con nombre según tipo)
   ========================================================= */
async function obtenerListaEspera(client, torneoId, tipoParticipacion) {
  if (tipoParticipacion === 'individual') {
    const { rows } = await client.query(
      `SELECT tle.id, tle.estado, tle.created_at AS fecha, tle.origen,
              u.id   AS equipo_id,
              u.nombre AS equipo_nombre,
              u.avatar AS equipo_escudo,
              NULL::varchar AS equipo_deporte,
              u.id   AS capitan_id,
              TRUE   AS es_individual
       FROM torneo_lista_espera tle
       JOIN usuarios u ON u.id = tle.equipo_id
       WHERE tle.torneo_id = $1
       ORDER BY tle.created_at ASC`,
      [torneoId]
    );
    return rows;
  }

  const { rows } = await client.query(
    `SELECT tle.id, tle.estado, tle.created_at AS fecha, tle.origen,
            g.id AS equipo_id, g.nombre AS equipo_nombre, g.escudo AS equipo_escudo,
            g.deporte AS equipo_deporte, g.capitan_id,
            FALSE AS es_individual
     FROM torneo_lista_espera tle
     JOIN grupos g ON g.id = tle.equipo_id
     WHERE tle.torneo_id = $1
     ORDER BY tle.created_at ASC`,
    [torneoId]
  );
  return rows;
}

/* =========================================================
   HELPER: invitaciones (solo torneos de equipo)
   ========================================================= */
async function obtenerInvitaciones(client, torneoId, tipoParticipacion) {
  if (tipoParticipacion === 'individual') return [];

  const { rows } = await client.query(
    `SELECT ti.id, ti.estado, ti.created_at,
            g.id AS equipo_id, g.nombre AS equipo_nombre, g.escudo AS equipo_escudo,
            g.deporte AS equipo_deporte, g.capitan_id,
            FALSE AS es_individual
     FROM torneo_invitaciones ti
     JOIN grupos g ON g.id = ti.equipo_id
     WHERE ti.torneo_id = $1
     ORDER BY ti.created_at ASC`,
    [torneoId]
  );
  return rows;
}

/* =========================================================
   HELPER: partidos (mismo para ambos tipos, cambia JOIN)
   ========================================================= */
async function obtenerPartidos(client, torneoId, tipoParticipacion) {
  if (tipoParticipacion === 'individual') {
    const { rows } = await client.query(
      `SELECT tp.*,
         ul.nombre AS local_nombre, ul.avatar AS local_escudo,
         uv.nombre AS visitante_nombre, uv.avatar AS visitante_escudo
       FROM torneo_partidos tp
       LEFT JOIN usuarios ul ON ul.id = tp.equipo_local_id
       LEFT JOIN usuarios uv ON uv.id = tp.equipo_visitante_id
       WHERE tp.torneo_id = $1
       ORDER BY tp.ronda ASC, tp.orden ASC`,
      [torneoId]
    );
    return rows;
  }

  const { rows } = await client.query(
    `SELECT tp.*,
       el.nombre AS local_nombre, el.escudo AS local_escudo,
       ev.nombre AS visitante_nombre, ev.escudo AS visitante_escudo
     FROM torneo_partidos tp
     LEFT JOIN grupos el ON el.id = tp.equipo_local_id
     LEFT JOIN grupos ev ON ev.id = tp.equipo_visitante_id
     WHERE tp.torneo_id = $1
     ORDER BY tp.ronda ASC, tp.orden ASC`,
    [torneoId]
  );
  return rows;
}

/* =========================================================
   HELPER: tabla de posiciones (mismo esquema, cambia JOIN)
   ========================================================= */
async function obtenerTablaPosiciones(client, torneoId, tipoParticipacion) {
  if (tipoParticipacion === 'individual') {
    const { rows } = await client.query(
      `SELECT ttp.*,
              u.nombre AS equipo_nombre,
              u.avatar AS equipo_escudo
       FROM torneo_tabla_posiciones ttp
       JOIN usuarios u ON u.id = ttp.equipo_id
       WHERE ttp.torneo_id = $1
       ORDER BY ttp.puntos_totales DESC, ttp.diferencia DESC, ttp.puntos_favor DESC`,
      [torneoId]
    );
    return rows;
  }

  const { rows } = await client.query(
    `SELECT ttp.*,
            g.nombre AS equipo_nombre,
            g.escudo AS equipo_escudo
     FROM torneo_tabla_posiciones ttp
     JOIN grupos g ON g.id = ttp.equipo_id
     WHERE ttp.torneo_id = $1
     ORDER BY ttp.puntos_totales DESC, ttp.diferencia DESC, ttp.puntos_favor DESC`,
    [torneoId]
  );
  return rows;
}
/* =========================================================
   LISTAR TORNEOS
   =========================================================
   ⚡ FIX: los flags "mi_equipo_inscrito", "mi_solicitud_pendiente"
   y "mi_invitacion_pendiente" ahora detectan correctamente al
   usuario tanto si es `capitan_id` del grupo COMO si está en
   `grupo_miembros` con rol 'capitan'/'admin'.
   ========================================================= */
export async function listarTorneos(filtros, usuarioId) {
  const {
    deporte, estado, modalidad, nivel, tipoParticipacion,
    soloMios, soloInscritos, busqueda,
    page = 1, limit = 20
  } = filtros;

  const condiciones = [];
  const valores = [];
  let i = 1;

  if (deporte) {
    condiciones.push(`t.deporte = $${i}`);
    valores.push(deporte);
    i++;
  }

  if (estado) {
    condiciones.push(`t.estado = $${i}`);
    valores.push(estado);
    i++;
  }

  if (modalidad) {
    condiciones.push(`t.modalidad = $${i}`);
    valores.push(modalidad);
    i++;
  }

  if (nivel) {
    condiciones.push(`t.nivel = $${i}`);
    valores.push(nivel);
    i++;
  }

  if (tipoParticipacion) {
    condiciones.push(`t.tipo_participacion = $${i}`);
    valores.push(tipoParticipacion);
    i++;
  }

  if (busqueda) {
    condiciones.push(`(t.nombre ILIKE $${i} OR t.lugar ILIKE $${i})`);
    valores.push(`%${busqueda}%`);
    i++;
  }

  if (soloMios === 'true') {
    condiciones.push(`t.organizador_id = $${i}`);
    valores.push(usuarioId);
    i++;
  }

  if (soloInscritos === 'true') {
    condiciones.push(`(
      EXISTS (
        SELECT 1 FROM torneo_equipos te
        WHERE te.torneo_id = t.id
          AND (
            (t.tipo_participacion = 'individual' AND te.equipo_id = $${i})
            OR (
              t.tipo_participacion = 'equipo'
              AND EXISTS (
                SELECT 1 FROM grupos g
                WHERE g.id = te.equipo_id
                  AND (
                    g.capitan_id = $${i}
                    OR EXISTS (
                      SELECT 1 FROM grupo_miembros gm
                      WHERE gm.grupo_id = g.id
                        AND gm.usuario_id = $${i}
                    )
                  )
              )
            )
          )
      )
    )`);
    valores.push(usuarioId);
    i++;
  }

  const where = condiciones.length > 0
    ? `WHERE ${condiciones.join(' AND ')}`
    : '';

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM torneos t ${where}`,
    valores
  );
  const total = countRows[0].total;

  const offset = (page - 1) * limit;
  const parametrosFinales = [...valores, limit, offset, usuarioId];

  const idxLimit = i;
  const idxOffset = i + 1;
  const idxUser = i + 2;

  const { rows } = await pool.query(
    `SELECT t.*,
       u.id AS u_id, u.nombre AS u_nombre, u.username AS u_username, u.avatar AS u_avatar,
       (SELECT COUNT(*)::int FROM torneo_equipos WHERE torneo_id = t.id) AS total_equipos,
       (SELECT COUNT(*)::int FROM torneo_lista_espera WHERE torneo_id = t.id AND estado = 'pendiente') AS total_lista_espera,
       (SELECT COUNT(*)::int FROM torneo_partidos WHERE torneo_id = t.id) AS total_partidos,
       (t.organizador_id = $${idxUser}) AS soy_organizador,

       /* =====================================================
          ⚡ MI EQUIPO INSCRITO
          ===================================================== */
       (
         CASE
           WHEN t.tipo_participacion = 'individual' THEN
             EXISTS (
               SELECT 1 FROM torneo_equipos te
               WHERE te.torneo_id = t.id AND te.equipo_id = $${idxUser}
             )
           ELSE
             EXISTS (
               SELECT 1 FROM torneo_equipos te
               JOIN grupos g ON g.id = te.equipo_id
               WHERE te.torneo_id = t.id
                 AND (
                   g.capitan_id = $${idxUser}
                   OR EXISTS (
                     SELECT 1 FROM grupo_miembros gm
                     WHERE gm.grupo_id = g.id
                       AND gm.usuario_id = $${idxUser}
                       AND gm.rol IN ('capitan', 'admin')
                   )
                 )
             )
         END
       ) AS mi_equipo_inscrito,

       /* =====================================================
          ⚡ MI SOLICITUD PENDIENTE (en lista de espera)
          ===================================================== */
       (
         CASE
           WHEN t.tipo_participacion = 'individual' THEN
             EXISTS (
               SELECT 1 FROM torneo_lista_espera tle
               WHERE tle.torneo_id = t.id
                 AND tle.estado = 'pendiente'
                 AND tle.equipo_id = $${idxUser}
             )
           ELSE
             EXISTS (
               SELECT 1 FROM torneo_lista_espera tle
               JOIN grupos g ON g.id = tle.equipo_id
               WHERE tle.torneo_id = t.id
                 AND tle.estado = 'pendiente'
                 AND (
                   g.capitan_id = $${idxUser}
                   OR EXISTS (
                     SELECT 1 FROM grupo_miembros gm
                     WHERE gm.grupo_id = g.id
                       AND gm.usuario_id = $${idxUser}
                       AND gm.rol IN ('capitan', 'admin')
                   )
                 )
             )
         END
       ) AS mi_solicitud_pendiente,

       /* =====================================================
          ⚡ MI INVITACIÓN PENDIENTE
          ===================================================== */
       (
         CASE
           WHEN t.tipo_participacion = 'individual' THEN FALSE
           ELSE EXISTS (
             SELECT 1 FROM torneo_invitaciones ti
             JOIN grupos g ON g.id = ti.equipo_id
             WHERE ti.torneo_id = t.id
               AND ti.estado = 'pendiente'
               AND (
                 g.capitan_id = $${idxUser}
                 OR EXISTS (
                   SELECT 1 FROM grupo_miembros gm
                   WHERE gm.grupo_id = g.id
                     AND gm.usuario_id = $${idxUser}
                     AND gm.rol IN ('capitan', 'admin')
                 )
               )
           )
         END
       ) AS mi_invitacion_pendiente

     FROM torneos t
     JOIN usuarios u ON u.id = t.organizador_id
     ${where}
     ORDER BY t.fecha_inicio DESC
     LIMIT $${idxLimit} OFFSET $${idxOffset}`,
    parametrosFinales
  );

  return {
    data: rows.map(row => ({
      ...formatearTorneo(row, {
        organizador: {
          id: row.u_id,
          nombre: row.u_nombre,
          username: row.u_username,
          avatar: row.u_avatar,
        },
        totalEquipos: row.total_equipos,
        totalListaEspera: row.total_lista_espera,
        totalPartidos: row.total_partidos,
      }),
      soyOrganizador: row.soy_organizador,
      miEquipoInscrito: row.mi_equipo_inscrito,
      miSolicitudPendiente: row.mi_solicitud_pendiente,
      miInvitacionPendiente: row.mi_invitacion_pendiente,
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
   OBTENER UN TORNEO (detalle)
   =========================================================
   (Sin cambios: ya usaba obtenerMisEquipoIds que maneja bien
   ambos casos.)
   ========================================================= */
export async function obtenerTorneo(torneoId, usuarioId) {
  const { rows } = await pool.query(
    `SELECT t.*,
       u.id AS u_id, u.nombre AS u_nombre, u.username AS u_username, u.avatar AS u_avatar
     FROM torneos t
     JOIN usuarios u ON u.id = t.organizador_id
     WHERE t.id = $1`,
    [torneoId]
  );

  if (!rows[0]) {
    const err = new Error('Torneo no encontrado');
    err.status = 404;
    throw err;
  }

  const torneo = rows[0];
  const tipo = torneo.tipo_participacion || 'equipo';
  const esOrganizador = String(torneo.organizador_id) === String(usuarioId);

  const equipos = await obtenerParticipantes(pool, torneoId, tipo);
  const listaEspera = await obtenerListaEspera(pool, torneoId, tipo);
  const invitaciones = await obtenerInvitaciones(pool, torneoId, tipo);

  const { rows: organizadores } = await pool.query(
    `SELECT to2.usuario_id, to2.permisos, to2.creado,
            u.nombre, u.username, u.avatar
     FROM torneo_organizadores to2
     JOIN usuarios u ON u.id = to2.usuario_id
     WHERE to2.torneo_id = $1`,
    [torneoId]
  );

  const partidos = await obtenerPartidos(pool, torneoId, tipo);

  let tablaPosiciones = [];
  if (torneo.modalidad === 'liga') {
    tablaPosiciones = await obtenerTablaPosiciones(pool, torneoId, tipo);
  }

  let miEquipoInscritoDetalle = null;
  let miSolicitudPendienteDetalle = null;
  let miInvitacionPendienteDetalle = null;

  if (tipo === 'individual') {
    miEquipoInscritoDetalle =
      equipos.find(e => String(e.id) === String(usuarioId)) || null;

    miSolicitudPendienteDetalle =
      listaEspera.find(
        l => l.estado === 'pendiente' && String(l.equipo_id) === String(usuarioId)
      ) || null;

    miInvitacionPendienteDetalle = null;
  } else {
    const misEquipoIds = await obtenerMisEquipoIds(usuarioId);

    miEquipoInscritoDetalle =
      equipos.find(e => misEquipoIds.has(String(e.id))) || null;

    miSolicitudPendienteDetalle =
      listaEspera.find(
        l => l.estado === 'pendiente' && misEquipoIds.has(String(l.equipo_id))
      ) || null;

    miInvitacionPendienteDetalle =
      invitaciones.find(
        i => i.estado === 'pendiente' && misEquipoIds.has(String(i.equipo_id))
      ) || null;
  }

  const miEquipoInscrito = !!miEquipoInscritoDetalle;
  const miSolicitudPendiente = !!miSolicitudPendienteDetalle;
  const miInvitacionPendiente = !!miInvitacionPendienteDetalle;

  const soySubOrganizador = organizadores.some(
    o => String(o.usuario_id) === String(usuarioId)
  );

  let listaEsperaVisible;
  let invitacionesVisibles;

  if (esOrganizador) {
    listaEsperaVisible = listaEspera;
    invitacionesVisibles = invitaciones;
  } else if (tipo === 'individual') {
    listaEsperaVisible = listaEspera.filter(
      l => String(l.equipo_id) === String(usuarioId)
    );
    invitacionesVisibles = [];
  } else {
    const misEquipoIds = await obtenerMisEquipoIds(usuarioId);
    listaEsperaVisible = listaEspera.filter(
      l => misEquipoIds.has(String(l.equipo_id))
    );
    invitacionesVisibles = invitaciones.filter(
      i => misEquipoIds.has(String(i.equipo_id))
    );
  }

  return {
    ...formatearTorneo(torneo, {
      organizador: {
        id: torneo.u_id,
        nombre: torneo.u_nombre,
        username: torneo.u_username,
        avatar: torneo.u_avatar,
      },
      totalEquipos: equipos.length,
      totalListaEspera: listaEspera.filter(l => l.estado === 'pendiente').length,
      totalPartidos: partidos.length,
    }),

    equipos,
    listaEspera: listaEsperaVisible,
    invitaciones: invitacionesVisibles,
    organizadores: esOrganizador ? organizadores : [],
    partidos,
    tablaPosiciones,

    soyOrganizador: esOrganizador,
    soySubOrganizador,
    miEquipoInscrito,
    miEquipoInscritoDetalle,
    miSolicitudPendiente,
    miSolicitudPendienteDetalle,
    miInvitacionPendiente,
    miInvitacionPendienteDetalle,
  };
}
/* =========================================================
   CREAR TORNEO
   ========================================================= */
export async function crearTorneo(datos, usuarioId) {
  const {
    nombre, deporte, emoji, descripcion, lugar,
    fechaInicio, fechaFin, fechaLimiteInscripcion,
    cuposEquipos, precio,
    modalidad, nivel, libreInscripcion,
    tipoParticipacion,
    puntosVictoria, puntosEmpate, puntosDerrota,
    permiteEmpate, incluyeEstadisticas, equiposClasifican,
  } = datos;

  const canalChatId = `torneo-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const { rows } = await pool.query(
    `INSERT INTO torneos (
      nombre, deporte, emoji, descripcion, lugar,
      fecha_inicio, fecha_fin, fecha_limite_inscripcion,
      cupos_equipos, precio,
      modalidad, nivel, libre_inscripcion,
      tipo_participacion,
      puntos_victoria, puntos_empate, puntos_derrota,
      permite_empate, incluye_estadisticas, equipos_clasifican,
      canal_chat_id, organizador_id,
      estado
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8,
      $9, $10,
      $11, $12, $13,
      $14,
      $15, $16, $17,
      $18, $19, $20,
      $21, $22,
      'inscripcion'
    )
    RETURNING *`,
    [
      nombre, deporte, emoji || null, descripcion || null, lugar,
      fechaInicio, fechaFin || null, fechaLimiteInscripcion || null,
      cuposEquipos, precio || 0,
      modalidad || 'liga', nivel || 'amistoso', libreInscripcion ?? true,
      tipoParticipacion || 'equipo',
      puntosVictoria ?? 3, puntosEmpate ?? 1, puntosDerrota ?? 0,
      permiteEmpate ?? true, incluyeEstadisticas ?? false, equiposClasifican || null,
      canalChatId, usuarioId,
    ]
  );

  const torneo = rows[0];

  try {
    await pool.query(
      `INSERT INTO canales (id, tipo, ref_id, nombre, icono)
       VALUES ($1, 'torneo', $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [canalChatId, torneo.id, torneo.nombre, torneo.emoji || '🏆']
    );
  } catch (err) {
    console.warn('[torneos] No se pudo crear canal de chat:', err.message);
  }

  return obtenerTorneo(torneo.id, usuarioId);
}

/* =========================================================
   EDITAR TORNEO (solo organizador)
   ========================================================= */
export async function editarTorneo(torneoId, cambios, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    verificarOrganizador(torneo, usuarioId);

    if (cambios.cuposEquipos !== undefined) {
      const { rows: equipos } = await client.query(
        `SELECT COUNT(*)::int AS total FROM torneo_equipos WHERE torneo_id = $1`,
        [torneoId]
      );
      if (cambios.cuposEquipos < equipos[0].total) {
        const err = new Error(`No podés bajar los cupos a menos de ${equipos[0].total} (equipos ya inscritos)`);
        err.status = 400;
        throw err;
      }
    }

    if (
      cambios.tipoParticipacion !== undefined &&
      cambios.tipoParticipacion !== torneo.tipo_participacion
    ) {
      const { rows: equipos } = await client.query(
        `SELECT COUNT(*)::int AS total FROM torneo_equipos WHERE torneo_id = $1`,
        [torneoId]
      );
      if (equipos[0].total > 0) {
        const err = new Error('No podés cambiar el tipo de participación con equipos ya inscritos');
        err.status = 400;
        throw err;
      }
    }

    const permitidos = {
      nombre: 'nombre',
      deporte: 'deporte',
      emoji: 'emoji',
      descripcion: 'descripcion',
      lugar: 'lugar',
      fechaInicio: 'fecha_inicio',
      fechaFin: 'fecha_fin',
      fechaLimiteInscripcion: 'fecha_limite_inscripcion',
      cuposEquipos: 'cupos_equipos',
      precio: 'precio',
      modalidad: 'modalidad',
      nivel: 'nivel',
      libreInscripcion: 'libre_inscripcion',
      tipoParticipacion: 'tipo_participacion',
      puntosVictoria: 'puntos_victoria',
      puntosEmpate: 'puntos_empate',
      puntosDerrota: 'puntos_derrota',
      permiteEmpate: 'permite_empate',
      incluyeEstadisticas: 'incluye_estadisticas',
      equiposClasifican: 'equipos_clasifican',
    };

    const campos = [];
    const valores = [];
    let i = 1;

    for (const [key, col] of Object.entries(permitidos)) {
      if (cambios[key] !== undefined) {
        campos.push(`${col} = $${i}`);
        valores.push(cambios[key]);
        i++;
      }
    }

    if (campos.length === 0) {
      await client.query('COMMIT');
      return obtenerTorneo(torneoId, usuarioId);
    }

    valores.push(torneoId);

    await client.query(
      `UPDATE torneos
       SET ${campos.join(', ')}, updated_at = NOW()
       WHERE id = $${i}`,
      valores
    );

    await client.query('COMMIT');
    return obtenerTorneo(torneoId, usuarioId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   ELIMINAR TORNEO (solo organizador)
   ========================================================= */
export async function eliminarTorneo(torneoId, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    verificarOrganizador(torneo, usuarioId);

    await client.query(
      `DELETE FROM torneos WHERE id = $1`,
      [torneoId]
    );

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Torneo eliminado' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   CERRAR TORNEO (solo organizador)
   ========================================================= */
export async function cerrarTorneo(torneoId, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    verificarOrganizador(torneo, usuarioId);

    if (torneo.estado !== 'inscripcion') {
      const err = new Error('El torneo no está en período de inscripción');
      err.status = 400;
      throw err;
    }

    await client.query(
      `UPDATE torneos
       SET estado = 'en_curso', updated_at = NOW()
       WHERE id = $1`,
      [torneoId]
    );

    await client.query('COMMIT');
    return obtenerTorneo(torneoId, usuarioId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   INSCRIBIR (equipo o usuario) + NOTIFICACIONES
   ========================================================= */
export async function inscribirEquipo(torneoId, usuarioId, equipoId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    const tipo = torneo.tipo_participacion || 'equipo';
    const esIndividual = tipo === 'individual';

    if (torneo.estado !== 'inscripcion') {
      const err = new Error('El torneo no está en período de inscripción');
      err.status = 400;
      throw err;
    }

    if (torneo.fecha_limite_inscripcion && new Date(torneo.fecha_limite_inscripcion) < new Date()) {
      const err = new Error('El período de inscripción ya cerró');
      err.status = 400;
      throw err;
    }

    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int AS total FROM torneo_equipos WHERE torneo_id = $1`,
      [torneoId]
    );
    const inscritos = countRows[0].total;

    if (inscritos >= torneo.cupos_equipos) {
      const err = new Error('El torneo ya está lleno');
      err.status = 409;
      throw err;
    }

    /* =====================================================
       RAMA INDIVIDUAL
       ===================================================== */
    if (esIndividual) {
      const { rows: yaInscrito } = await client.query(
        `SELECT 1 FROM torneo_equipos WHERE torneo_id = $1 AND equipo_id = $2`,
        [torneoId, usuarioId]
      );
      if (yaInscrito.length > 0) {
        const err = new Error('Ya estás inscrito en este torneo');
        err.status = 409;
        throw err;
      }

      const { rows: yaEnEspera } = await client.query(
        `SELECT 1 FROM torneo_lista_espera
         WHERE torneo_id = $1 AND equipo_id = $2 AND estado = 'pendiente'`,
        [torneoId, usuarioId]
      );
      if (yaEnEspera.length > 0) {
        const err = new Error('Ya tenés una solicitud pendiente');
        err.status = 409;
        throw err;
      }

      const esPago = Number(torneo.precio) > 0;
      const vaDirecto = !esPago && torneo.libre_inscripcion === true;
      const link = `#/torneo/${torneoId}`;

      if (vaDirecto) {
        await client.query(
          `INSERT INTO torneo_equipos (torneo_id, equipo_id, es_individual)
           VALUES ($1, $2, TRUE)`,
          [torneoId, usuarioId]
        );

        if (torneo.modalidad === 'liga') {
          await client.query(
            `INSERT INTO torneo_tabla_posiciones (torneo_id, equipo_id)
             VALUES ($1, $2)
             ON CONFLICT (torneo_id, equipo_id) DO NOTHING`,
            [torneoId, usuarioId]
          );
        }

        if (inscritos + 1 >= torneo.cupos_equipos) {
          await client.query(
            `UPDATE torneos SET estado = 'en_curso' WHERE id = $1`,
            [torneoId]
          );
        }

        await client.query('COMMIT');

        try {
          await crearNotificacion(
            torneo.organizador_id,
            'inscripcion',
            `Nueva inscripción en "${torneo.nombre}"`,
            link
          );
        } catch (e) {
          console.warn('[torneos] No se pudo notificar inscripción:', e.message);
        }

        return obtenerTorneo(torneoId, usuarioId);
      }

      await client.query(
        `INSERT INTO torneo_lista_espera (torneo_id, equipo_id, origen, estado, es_individual)
         VALUES ($1, $2, 'solicitud', 'pendiente', TRUE)`,
        [torneoId, usuarioId]
      );

      await client.query('COMMIT');

      try {
        await crearNotificacion(
          torneo.organizador_id,
          'inscripcion',
          `Nueva solicitud en "${torneo.nombre}"`,
          link
        );
      } catch (e) {
        console.warn('[torneos] No se pudo notificar solicitud:', e.message);
      }

      return obtenerTorneo(torneoId, usuarioId);
    }

    /* =====================================================
       RAMA EQUIPO
       ===================================================== */
    const esUuid = esUuidValido(equipoId);

    if (!esUuid) {
      await client.query('COMMIT');
      const torneoActualizado = await obtenerTorneo(torneoId, usuarioId);
      torneoActualizado.miEquipoInscritoLegacy = true;
      return torneoActualizado;
    }

    const { rows: equipo } = await client.query(
      `SELECT id, deporte FROM grupos
       WHERE id = $1 AND tipo = 'equipo'
         AND (capitan_id = $2 OR EXISTS (
           SELECT 1 FROM grupo_miembros
           WHERE grupo_id = grupos.id AND usuario_id = $2 AND rol IN ('capitan', 'admin')
         ))`,
      [equipoId, usuarioId]
    );

    if (!equipo[0]) {
      const err = new Error('No tenés permisos para inscribir ese equipo');
      err.status = 403;
      throw err;
    }

    if (equipo[0].deporte !== torneo.deporte) {
      const err = new Error(`Este torneo es de ${torneo.deporte}. Tu equipo es de ${equipo[0].deporte}.`);
      err.status = 400;
      throw err;
    }

    const { rows: yaInscrito } = await client.query(
      `SELECT 1 FROM torneo_equipos WHERE torneo_id = $1 AND equipo_id = $2`,
      [torneoId, equipoId]
    );
    if (yaInscrito.length > 0) {
      const err = new Error('El equipo ya está inscrito en este torneo');
      err.status = 409;
      throw err;
    }

    const { rows: yaEnEspera } = await client.query(
      `SELECT 1 FROM torneo_lista_espera
       WHERE torneo_id = $1 AND equipo_id = $2 AND estado = 'pendiente'`,
      [torneoId, equipoId]
    );
    if (yaEnEspera.length > 0) {
      const err = new Error('El equipo ya tiene una solicitud pendiente');
      err.status = 409;
      throw err;
    }

    const esPago = Number(torneo.precio) > 0;
    const vaDirecto = !esPago && torneo.libre_inscripcion === true;
    const link = `#/torneo/${torneoId}`;

    if (vaDirecto) {
      await client.query(
        `INSERT INTO torneo_equipos (torneo_id, equipo_id, es_individual)
         VALUES ($1, $2, FALSE)`,
        [torneoId, equipoId]
      );

      if (torneo.modalidad === 'liga') {
        await client.query(
          `INSERT INTO torneo_tabla_posiciones (torneo_id, equipo_id)
           VALUES ($1, $2)
           ON CONFLICT (torneo_id, equipo_id) DO NOTHING`,
          [torneoId, equipoId]
        );
      }

      if (inscritos + 1 >= torneo.cupos_equipos) {
        await client.query(
          `UPDATE torneos SET estado = 'en_curso' WHERE id = $1`,
          [torneoId]
        );
      }

      await client.query('COMMIT');

      try {
        await crearNotificacion(
          torneo.organizador_id,
          'inscripcion',
          `Nueva inscripción en "${torneo.nombre}"`,
          link
        );
      } catch (e) {
        console.warn('[torneos] No se pudo notificar inscripción:', e.message);
      }

      return obtenerTorneo(torneoId, usuarioId);
    }

    await client.query(
      `INSERT INTO torneo_lista_espera (torneo_id, equipo_id, origen, estado, es_individual)
       VALUES ($1, $2, 'solicitud', 'pendiente', FALSE)`,
      [torneoId, equipoId]
    );

    await client.query('COMMIT');

    try {
      await crearNotificacion(
        torneo.organizador_id,
        'inscripcion',
        `Nueva solicitud en "${torneo.nombre}"`,
        link
      );
    } catch (e) {
      console.warn('[torneos] No se pudo notificar solicitud:', e.message);
    }

    return obtenerTorneo(torneoId, usuarioId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
/* =========================================================
   CANCELAR INSCRIPCIÓN / SOLICITUD + NOTIFICACIÓN
   ========================================================= */
export async function cancelarInscripcion(torneoId, usuarioId, equipoId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    const tipo = torneo.tipo_participacion || 'equipo';
    const esIndividual = tipo === 'individual';

    if (String(torneo.organizador_id) === String(usuarioId)) {
      const err = new Error('El organizador no puede retirarse. Eliminá el torneo si querés cancelarlo.');
      err.status = 400;
      throw err;
    }

    const idEfectivo = esIndividual ? usuarioId : equipoId;
    const esUuid = esUuidValido(idEfectivo);

    if (!esUuid) {
      await client.query('COMMIT');
      return { ok: true, mensaje: 'Inscripción cancelada (legacy)' };
    }

    const { rowCount: r1 } = await client.query(
      `DELETE FROM torneo_equipos WHERE torneo_id = $1 AND equipo_id = $2`,
      [torneoId, idEfectivo]
    );

    const { rowCount: r2 } = await client.query(
      `DELETE FROM torneo_lista_espera WHERE torneo_id = $1 AND equipo_id = $2`,
      [torneoId, idEfectivo]
    );

    if (r1 === 0 && r2 === 0) {
      const err = new Error('No estabas inscrito en este torneo');
      err.status = 404;
      throw err;
    }

    await client.query(
      `DELETE FROM torneo_tabla_posiciones WHERE torneo_id = $1 AND equipo_id = $2`,
      [torneoId, idEfectivo]
    );

    const { rows: conteo } = await client.query(
      `SELECT COUNT(*)::int AS total FROM torneo_equipos WHERE torneo_id = $1`,
      [torneoId]
    );
    if (conteo[0].total < torneo.cupos_equipos && torneo.estado === 'en_curso') {
      await client.query(
        `UPDATE torneos SET estado = 'inscripcion' WHERE id = $1`,
        [torneoId]
      );
    }

    let nombreMostrar = null;
    if (r1 > 0) {
      nombreMostrar = await obtenerNombreMostrar(client, idEfectivo, esIndividual);
    }

    await client.query('COMMIT');

    if (r1 > 0 && nombreMostrar) {
      try {
        await crearNotificacion(
          torneo.organizador_id,
          'salida',
          `${nombreMostrar} se salió de "${torneo.nombre}"`,
          `#/torneo/${torneoId}`
        );
      } catch (e) {
        console.warn('[torneos] No se pudo notificar salida:', e.message);
      }
    }

    return { ok: true, mensaje: 'Inscripción cancelada' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   APROBAR / RECHAZAR SOLICITUD + NOTIFICACIÓN AL SOLICITANTE
   ========================================================= */
export async function gestionarSolicitud(torneoId, usuarioId, equipoId, accion) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    verificarOrganizador(torneo, usuarioId);

    const tipo = torneo.tipo_participacion || 'equipo';
    const esIndividual = tipo === 'individual';

    const { rows } = await client.query(
      `SELECT * FROM torneo_lista_espera
       WHERE torneo_id = $1 AND equipo_id = $2 AND estado = 'pendiente'`,
      [torneoId, equipoId]
    );

    if (!rows[0]) {
      const err = new Error('No hay una solicitud pendiente');
      err.status = 404;
      throw err;
    }

    const usuarioDestino = await obtenerUsuarioDestino(client, equipoId, esIndividual);
    const link = `#/torneo/${torneoId}`;

    if (accion === 'rechazar') {
      await client.query(
        `UPDATE torneo_lista_espera
         SET estado = 'rechazado', resuelta_en = NOW()
         WHERE torneo_id = $1 AND equipo_id = $2`,
        [torneoId, equipoId]
      );
      await client.query('COMMIT');

      if (usuarioDestino) {
        try {
          await crearNotificacion(
            usuarioDestino,
            'rechazado',
            `Tu inscripción en "${torneo.nombre}" fue rechazada`,
            link
          );
        } catch (e) {
          console.warn('[torneos] No se pudo notificar rechazo:', e.message);
        }
      }

      return { ok: true, mensaje: 'Solicitud rechazada' };
    }

    const { rows: conteo } = await client.query(
      `SELECT COUNT(*)::int AS total FROM torneo_equipos WHERE torneo_id = $1`,
      [torneoId]
    );

    if (conteo[0].total >= torneo.cupos_equipos) {
      const err = new Error('El torneo ya está lleno');
      err.status = 409;
      throw err;
    }

    await client.query(
      `UPDATE torneo_lista_espera
       SET estado = 'aceptado', resuelta_en = NOW()
       WHERE torneo_id = $1 AND equipo_id = $2`,
      [torneoId, equipoId]
    );

    await client.query(
      `INSERT INTO torneo_equipos (torneo_id, equipo_id, es_individual)
       VALUES ($1, $2, $3)
       ON CONFLICT (torneo_id, equipo_id) DO NOTHING`,
      [torneoId, equipoId, esIndividual]
    );

    if (torneo.modalidad === 'liga') {
      await client.query(
        `INSERT INTO torneo_tabla_posiciones (torneo_id, equipo_id)
         VALUES ($1, $2)
         ON CONFLICT (torneo_id, equipo_id) DO NOTHING`,
        [torneoId, equipoId]
      );
    }

    if (conteo[0].total + 1 >= torneo.cupos_equipos) {
      await client.query(
        `UPDATE torneos SET estado = 'en_curso' WHERE id = $1`,
        [torneoId]
      );
      await client.query(
        `UPDATE torneo_lista_espera
         SET estado = 'rechazado', resuelta_en = NOW()
         WHERE torneo_id = $1 AND estado = 'pendiente'`,
        [torneoId]
      );
    }

    await client.query('COMMIT');

    if (usuarioDestino) {
      try {
        await crearNotificacion(
          usuarioDestino,
          'aprobado',
          `Tu inscripción en "${torneo.nombre}" fue aprobada`,
          link
        );
      } catch (e) {
        console.warn('[torneos] No se pudo notificar aprobación:', e.message);
      }
    }

    return { ok: true, mensaje: 'Solicitud aprobada' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   EXPULSAR + NOTIFICACIÓN AL EXPULSADO
   ========================================================= */
export async function expulsarEquipo(torneoId, usuarioId, equipoId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    verificarOrganizador(torneo, usuarioId);

    const tipo = torneo.tipo_participacion || 'equipo';
    const esIndividual = tipo === 'individual';

    const usuarioDestino = await obtenerUsuarioDestino(client, equipoId, esIndividual);

    const { rowCount } = await client.query(
      `DELETE FROM torneo_equipos WHERE torneo_id = $1 AND equipo_id = $2`,
      [torneoId, equipoId]
    );

    if (rowCount === 0) {
      const err = new Error('El participante no está inscrito en este torneo');
      err.status = 404;
      throw err;
    }

    await client.query(
      `DELETE FROM torneo_tabla_posiciones WHERE torneo_id = $1 AND equipo_id = $2`,
      [torneoId, equipoId]
    );

    const { rows: conteo } = await client.query(
      `SELECT COUNT(*)::int AS total FROM torneo_equipos WHERE torneo_id = $1`,
      [torneoId]
    );
    if (conteo[0].total < torneo.cupos_equipos && torneo.estado === 'en_curso') {
      await client.query(
        `UPDATE torneos SET estado = 'inscripcion' WHERE id = $1`,
        [torneoId]
      );
    }

    await client.query('COMMIT');

    if (usuarioDestino) {
      try {
        await crearNotificacion(
          usuarioDestino,
          'expulsado',
          `Fuiste expulsado de "${torneo.nombre}"`,
          `#/torneo/${torneoId}`
        );
      } catch (e) {
        console.warn('[torneos] No se pudo notificar expulsión:', e.message);
      }
    }

    return { ok: true, mensaje: 'Participante retirado' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   INVITAR EQUIPO (solo torneos de equipo)
   ========================================================= */
export async function invitarEquipo(torneoId, usuarioId, equipoId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    verificarOrganizador(torneo, usuarioId);

    if ((torneo.tipo_participacion || 'equipo') === 'individual') {
      const err = new Error('Este torneo es individual. No se pueden invitar equipos.');
      err.status = 400;
      throw err;
    }

    const esUuid = esUuidValido(equipoId);

    if (!esUuid) {
      await client.query('COMMIT');
      return { ok: true, mensaje: 'Invitación enviada (legacy)', legacy: true };
    }

    const { rows: yaInvitado } = await client.query(
      `SELECT 1 FROM torneo_invitaciones
       WHERE torneo_id = $1 AND equipo_id = $2 AND estado = 'pendiente'`,
      [torneoId, equipoId]
    );
    if (yaInvitado.length > 0) {
      const err = new Error('Ya invitaste a ese equipo');
      err.status = 409;
      throw err;
    }

    await client.query(
      `INSERT INTO torneo_invitaciones (torneo_id, equipo_id, estado, es_individual)
       VALUES ($1, $2, 'pendiente', FALSE)`,
      [torneoId, equipoId]
    );

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Invitación enviada' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   RESPONDER INVITACIÓN + NOTIFICACIÓN AL ORGANIZADOR
   ========================================================= */
export async function responderInvitacion(torneoId, usuarioId, equipoId, aceptar) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);

    if ((torneo.tipo_participacion || 'equipo') === 'individual') {
      const err = new Error('Este torneo es individual. No maneja invitaciones.');
      err.status = 400;
      throw err;
    }

    const { rows } = await client.query(
      `SELECT * FROM torneo_invitaciones
       WHERE torneo_id = $1 AND equipo_id = $2 AND estado = 'pendiente'`,
      [torneoId, equipoId]
    );

    if (!rows[0]) {
      const err = new Error('No hay una invitación pendiente para ese equipo');
      err.status = 404;
      throw err;
    }

    const nombreEquipo = await obtenerNombreMostrar(client, equipoId, false);
    const link = `#/torneo/${torneoId}`;

    if (!aceptar) {
      await client.query(
        `UPDATE torneo_invitaciones
         SET estado = 'rechazada', resuelta_en = NOW()
         WHERE torneo_id = $1 AND equipo_id = $2`,
        [torneoId, equipoId]
      );
      await client.query('COMMIT');

      try {
        await crearNotificacion(
          torneo.organizador_id,
          'rechazado',
          `${nombreEquipo} rechazó tu invitación en "${torneo.nombre}"`,
          link
        );
      } catch (e) {
        console.warn('[torneos] No se pudo notificar rechazo de invitación:', e.message);
      }

      return { ok: true, mensaje: 'Invitación rechazada' };
    }

    const { rows: conteo } = await client.query(
      `SELECT COUNT(*)::int AS total FROM torneo_equipos WHERE torneo_id = $1`,
      [torneoId]
    );
    if (conteo[0].total >= torneo.cupos_equipos) {
      const err = new Error('El torneo ya está lleno');
      err.status = 409;
      throw err;
    }

    await client.query(
      `UPDATE torneo_invitaciones
       SET estado = 'aceptada', resuelta_en = NOW()
       WHERE torneo_id = $1 AND equipo_id = $2`,
      [torneoId, equipoId]
    );

    await client.query(
      `INSERT INTO torneo_equipos (torneo_id, equipo_id, es_individual)
       VALUES ($1, $2, FALSE)
       ON CONFLICT (torneo_id, equipo_id) DO NOTHING`,
      [torneoId, equipoId]
    );

    if (torneo.modalidad === 'liga') {
      await client.query(
        `INSERT INTO torneo_tabla_posiciones (torneo_id, equipo_id)
         VALUES ($1, $2)
         ON CONFLICT (torneo_id, equipo_id) DO NOTHING`,
        [torneoId, equipoId]
      );
    }

    if (conteo[0].total + 1 >= torneo.cupos_equipos) {
      await client.query(
        `UPDATE torneos SET estado = 'en_curso' WHERE id = $1`,
        [torneoId]
      );
    }

    await client.query('COMMIT');

    try {
      await crearNotificacion(
        torneo.organizador_id,
        'inscripcion',
        `${nombreEquipo} aceptó tu invitación en "${torneo.nombre}"`,
        link
      );
    } catch (e) {
      console.warn('[torneos] No se pudo notificar aceptación de invitación:', e.message);
    }

    return { ok: true, mensaje: 'Invitación aceptada' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   SUB-ORGANIZADORES
   ========================================================= */
export async function agregarOrganizador(torneoId, usuarioId, nuevoUsuarioId, permisos) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    verificarOrganizador(torneo, usuarioId);

    if (String(torneo.organizador_id) === String(nuevoUsuarioId)) {
      const err = new Error('Ese usuario ya es el organizador principal');
      err.status = 400;
      throw err;
    }

    await client.query(
      `INSERT INTO torneo_organizadores (torneo_id, usuario_id, permisos)
       VALUES ($1, $2, $3)
       ON CONFLICT (torneo_id, usuario_id)
       DO UPDATE SET permisos = EXCLUDED.permisos`,
      [torneoId, nuevoUsuarioId, permisos || 'resultados']
    );

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Sub-organizador agregado' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function quitarOrganizador(torneoId, usuarioId, usuarioIdQuitar) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    verificarOrganizador(torneo, usuarioId);

    const { rowCount } = await client.query(
      `DELETE FROM torneo_organizadores
       WHERE torneo_id = $1 AND usuario_id = $2`,
      [torneoId, usuarioIdQuitar]
    );

    if (rowCount === 0) {
      const err = new Error('Ese usuario no es sub-organizador');
      err.status = 404;
      throw err;
    }

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Sub-organizador removido' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   FIXTURE / CRUCES
   ========================================================= */
export async function crearPartidoTorneo(torneoId, usuarioId, datos) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

    const { ronda, orden, equipoLocalId, equipoVisitanteId, fecha } = datos;

    const { rows } = await client.query(
      `INSERT INTO torneo_partidos (
        torneo_id, ronda, orden,
        equipo_local_id, equipo_visitante_id,
        fecha, estado
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
      RETURNING *`,
      [
        torneoId, ronda, orden || 0,
        esUuidValido(equipoLocalId) ? equipoLocalId : null,
        esUuidValido(equipoVisitanteId) ? equipoVisitanteId : null,
        fecha || null,
      ]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function cargarResultado(torneoId, partidoId, usuarioId, datos) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

    const { rows } = await client.query(
      `SELECT * FROM torneo_partidos WHERE id = $1 AND torneo_id = $2`,
      [partidoId, torneoId]
    );

    if (!rows[0]) {
      const err = new Error('Partido no encontrado en este torneo');
      err.status = 404;
      throw err;
    }

    let ganador = null;
    if (datos.resultado) {
      const r = datos.resultado;
      const local = r.goles_local ?? r.puntos_local ?? r.sets_local ?? 0;
      const visitante = r.goles_visitante ?? r.puntos_visitante ?? r.sets_visitante ?? 0;

      if (local > visitante) ganador = 'local';
      else if (visitante > local) ganador = 'visitante';
      else if (local === visitante) ganador = 'empate';
    }

    await client.query(
      `UPDATE torneo_partidos
       SET resultado = $1,
           estadisticas = $2,
           estado = $3,
           ganador = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [
        JSON.stringify(datos.resultado),
        datos.estadisticas ? JSON.stringify(datos.estadisticas) : null,
        datos.estado || 'finalizado',
        ganador,
        partidoId,
      ]
    );

    if (torneo.modalidad === 'liga' && (datos.estado === 'finalizado' || !datos.estado)) {
      await recalcularTablaPosiciones(client, torneoId);
    }

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Resultado cargado' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   HELPERS INTERNOS
   ========================================================= */
async function verificarPermisoResultados(client, torneo, usuarioId) {
  if (String(torneo.organizador_id) === String(usuarioId)) return;

  const { rows } = await client.query(
    `SELECT 1 FROM torneo_organizadores
     WHERE torneo_id = $1 AND usuario_id = $2
       AND permisos IN ('resultados', 'completo')`,
    [torneo.id, usuarioId]
  );

  if (rows.length === 0) {
    const err = new Error('No tenés permiso para cargar resultados en este torneo');
    err.status = 403;
    throw err;
  }
}

async function recalcularTablaPosiciones(client, torneoId) {
  await client.query(
    `UPDATE torneo_tabla_posiciones
     SET partidos_jugados = 0, partidos_ganados = 0, partidos_empatados = 0,
         partidos_perdidos = 0, puntos_favor = 0, puntos_contra = 0,
         diferencia = 0, puntos_totales = 0, actualizado = NOW()
     WHERE torneo_id = $1`,
    [torneoId]
  );

  const { rows: tRows } = await client.query(
    `SELECT puntos_victoria, puntos_empate, puntos_derrota
     FROM torneos WHERE id = $1`,
    [torneoId]
  );
  if (!tRows[0]) return;
  const { puntos_victoria, puntos_empate, puntos_derrota } = tRows[0];

  const { rows: partidos } = await client.query(
    `SELECT equipo_local_id, equipo_visitante_id, resultado, ganador
     FROM torneo_partidos
     WHERE torneo_id = $1 AND estado = 'finalizado'
       AND equipo_local_id IS NOT NULL
       AND equipo_visitante_id IS NOT NULL
       AND resultado IS NOT NULL`,
    [torneoId]
  );

  for (const p of partidos) {
    const r = p.resultado || {};
    const gl = Number(r.goles_local ?? r.puntos_local ?? r.sets_local ?? 0);
    const gv = Number(r.goles_visitante ?? r.puntos_visitante ?? r.sets_visitante ?? 0);

    if (p.ganador === 'local') {
      await actualizarFilaTabla(client, torneoId, p.equipo_local_id, gl, gv, puntos_victoria, 'ganado');
      await actualizarFilaTabla(client, torneoId, p.equipo_visitante_id, gv, gl, puntos_derrota, 'perdido');
    } else if (p.ganador === 'visitante') {
      await actualizarFilaTabla(client, torneoId, p.equipo_local_id, gl, gv, puntos_derrota, 'perdido');
      await actualizarFilaTabla(client, torneoId, p.equipo_visitante_id, gv, gl, puntos_victoria, 'ganado');
    } else if (p.ganador === 'empate') {
      await actualizarFilaTabla(client, torneoId, p.equipo_local_id, gl, gv, puntos_empate, 'empatado');
      await actualizarFilaTabla(client, torneoId, p.equipo_visitante_id, gv, gl, puntos_empate, 'empatado');
    }
  }
}

async function actualizarFilaTabla(client, torneoId, equipoId, gf, gc, puntos, resultado) {
  const campoResultado = resultado === 'ganado' ? 'partidos_ganados'
                       : resultado === 'empatado' ? 'partidos_empatados'
                       : 'partidos_perdidos';

  await client.query(
    `INSERT INTO torneo_tabla_posiciones (torneo_id, equipo_id)
     VALUES ($1, $2)
     ON CONFLICT (torneo_id, equipo_id) DO NOTHING`,
    [torneoId, equipoId]
  );

  await client.query(
    `UPDATE torneo_tabla_posiciones
     SET partidos_jugados = partidos_jugados + 1,
         ${campoResultado} = ${campoResultado} + 1,
         puntos_favor = puntos_favor + $1,
         puntos_contra = puntos_contra + $2,
         diferencia = (puntos_favor + $1) - (puntos_contra + $2),
         puntos_totales = puntos_totales + $3,
         actualizado = NOW()
     WHERE torneo_id = $4 AND equipo_id = $5`,
    [gf, gc, puntos, torneoId, equipoId]
  );
}