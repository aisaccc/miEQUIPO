/* =========================================================
   torneos.service.js — Lógica de negocio de torneos
   ========================================================= */

import { pool } from '../config/db.js';
import { idsBloqueadosTotales, estanBloqueados } from '../utils/bloqueos.js'; // ⚡ NUEVO
import {
  crearNotificacion,
  crearNotificacionMultiple,
} from './notificaciones.service.js';
import {
  agregarMiembrosACanal,
  quitarMiembrosDeCanal,
  obtenerCanalDeTorneo,
  crearCanalParaTorneo,   // ⚡ NUEVO
} from './mensajes.service.js';

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
    sistemaClasificacion: row.sistema_clasificacion ?? 'simple',
    puntosVictoria: row.puntos_victoria,
    puntosEmpate: row.puntos_empate,
    puntosDerrota: row.puntos_derrota,
    permiteEmpate: row.permite_empate,
    incluyeEstadisticas: row.incluye_estadisticas,
    equiposClasifican: row.equipos_clasifican,
    canalChatId: row.canal_chat_id,
    idaYVuelta: row.ida_y_vuelta ?? false,
    fixtureBloqueado: row.fixture_bloqueado ?? false,
    autoFixture: row.auto_fixture ?? false,
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

async function verificarPermisoResultados(client, torneo, usuarioId) {
  if (String(torneo.organizador_id) === String(usuarioId)) return;

  const { rows } = await client.query(
    `SELECT 1 FROM torneo_organizadores
     WHERE torneo_id = $1 AND usuario_id = $2
       AND permisos IN ('resultados', 'completo')`,
    [torneo.id, usuarioId]
  );

  if (rows.length === 0) {
    const err = new Error('No tenés permiso para gestionar el fixture de este torneo');
    err.status = 403;
    throw err;
  }
}

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

async function obtenerUsuarioDestino(client, equipoId, esIndividual) {
  if (esIndividual) return equipoId;

  const { rows } = await client.query(
    `SELECT capitan_id FROM grupos WHERE id = $1`,
    [equipoId]
  );
  return rows[0]?.capitan_id || null;
}

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

async function obtenerDestinatariosTorneo(client, torneoId, tipoParticipacion) {
  const esIndividual = tipoParticipacion === 'individual';
  const ids = new Set();

  const { rows: inscritos } = await client.query(
    `SELECT equipo_id FROM torneo_equipos WHERE torneo_id = $1`,
    [torneoId]
  );
  for (const row of inscritos) {
    if (esIndividual) {
      ids.add(row.equipo_id);
    } else {
      const us = await obtenerUsuariosDeEquipo(client, row.equipo_id);
      us.forEach(u => ids.add(u));
    }
  }

  const { rows: pendientes } = await client.query(
    `SELECT equipo_id FROM torneo_lista_espera
     WHERE torneo_id = $1 AND estado = 'pendiente'`,
    [torneoId]
  );
  for (const row of pendientes) {
    if (esIndividual) {
      ids.add(row.equipo_id);
    } else {
      const us = await obtenerUsuariosDeEquipo(client, row.equipo_id);
      us.forEach(u => ids.add(u));
    }
  }

  return [...ids];
}

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

async function obtenerPartidos(client, torneoId, tipoParticipacion) {
  if (tipoParticipacion === 'individual') {
    const { rows } = await client.query(
      `SELECT tp.*,
         tj.nombre AS jornada_nombre,
         tj.numero AS jornada_numero,
         ul.nombre AS local_nombre,
         ul.avatar AS local_escudo,
         uv.nombre AS visitante_nombre,
         uv.avatar AS visitante_escudo
       FROM torneo_partidos tp
       LEFT JOIN torneo_jornadas tj ON tj.id = tp.jornada_id
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
       tj.nombre AS jornada_nombre,
       tj.numero AS jornada_numero,
       el.nombre AS local_nombre, el.escudo AS local_escudo,
       ev.nombre AS visitante_nombre, ev.escudo AS visitante_escudo
     FROM torneo_partidos tp
     LEFT JOIN torneo_jornadas tj ON tj.id = tp.jornada_id
     LEFT JOIN grupos el ON el.id = tp.equipo_local_id
     LEFT JOIN grupos ev ON ev.id = tp.equipo_visitante_id
     WHERE tp.torneo_id = $1
     ORDER BY tp.ronda ASC, tp.orden ASC`,
    [torneoId]
  );
  return rows;
}

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

async function obtenerJornadas(client, torneoId) {
  const { rows } = await client.query(
    `SELECT id, numero, nombre, fecha, created_at
     FROM torneo_jornadas
     WHERE torneo_id = $1
     ORDER BY numero ASC`,
    [torneoId]
  );
  return rows;
}

function calcularFasesEliminacionPorInscritos(cantidadInscritos) {
  if (cantidadInscritos <= 2)  return ['final'];
  if (cantidadInscritos <= 4)  return ['semis', 'final'];
  if (cantidadInscritos <= 8)  return ['cuartos', 'semis', 'final'];
  if (cantidadInscritos <= 16) return ['8vos', 'cuartos', 'semis', 'final'];
  if (cantidadInscritos <= 32) return ['16avos', '8vos', 'cuartos', 'semis', 'final'];
  if (cantidadInscritos <= 64) return ['32avos', '16avos', '8vos', 'cuartos', 'semis', 'final'];
  return ['64avos', '32avos', '16avos', '8vos', 'cuartos', 'semis', 'final'];
}

function calcularJornadasLiga(cupos, idaYVuelta) {
  const base = Math.max(1, cupos - 1);
  return idaYVuelta ? base * 2 : base;
}

function mezclarArray(arr) {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function generarRoundRobin(equipoIds, idaYVuelta = false) {
  const equipos = [...equipoIds];
  const esImpar = equipos.length % 2 !== 0;
  if (esImpar) equipos.push(null);

  const n = equipos.length;
  const jornadas = [];

  const fijo = equipos[0];
  const rotativos = equipos.slice(1);

  for (let ronda = 0; ronda < n - 1; ronda++) {
    const pares = [];

    const rival = rotativos[0];
    if (fijo && rival) {
      pares.push(ronda % 2 === 0 ? [fijo, rival] : [rival, fijo]);
    }

    for (let i = 1; i < n / 2; i++) {
      const a = rotativos[i];
      const b = rotativos[rotativos.length - i];
      if (a && b) {
        pares.push(i % 2 === 0 ? [a, b] : [b, a]);
      }
    }

    jornadas.push(pares);
    rotativos.unshift(rotativos.pop());
  }

  if (idaYVuelta) {
    const espejadas = jornadas.map(jornada =>
      jornada.map(([local, visitante]) => [visitante, local])
    );
    return [...jornadas, ...espejadas];
  }

  return jornadas;
}

async function armarFixtureAleatorioInterno(client, torneoId, torneo) {
  if (torneo.modalidad !== 'eliminacion') {
    const err = new Error('Solo los torneos de eliminación tienen bracket');
    err.status = 400;
    throw err;
  }

  if (torneo.fixture_bloqueado) {
    const err = new Error('El fixture ya fue confirmado');
    err.status = 400;
    throw err;
  }

  await client.query(
    `DELETE FROM torneo_partidos WHERE torneo_id = $1`,
    [torneoId]
  );

  const { rows: inscritos } = await client.query(
    `SELECT equipo_id FROM torneo_equipos WHERE torneo_id = $1 ORDER BY fecha ASC`,
    [torneoId]
  );

  if (inscritos.length < 2) {
    const err = new Error('Necesitás al menos 2 inscritos para armar el bracket');
    err.status = 400;
    throw err;
  }

  let equipoIds = inscritos.map(r => r.equipo_id);
  const cantidadInscritos = equipoIds.length;

  equipoIds = mezclarArray(equipoIds);

  const fases = calcularFasesEliminacionPorInscritos(cantidadInscritos);

  const cantidadSlots = Math.pow(2, fases.length);
  const cantidadByes = cantidadSlots - cantidadInscritos;

  const participantes = [...equipoIds];
  for (let i = 0; i < cantidadByes; i++) {
    participantes.push(null);
  }

  const primeraFase = fases[0];
  const partidosPrimeraFase = participantes.length / 2;

  for (let i = 0; i < partidosPrimeraFase; i++) {
    const local = participantes[i * 2];
    const visitante = participantes[i * 2 + 1];

    const esBye = (local === null) !== (visitante === null);

    await client.query(
      `INSERT INTO torneo_partidos (
        torneo_id, ronda, orden, fase, posicion_en_fase,
        equipo_local_id, equipo_visitante_id, es_bye, estado, ganador
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        torneoId,
        primeraFase,
        i,
        primeraFase,
        i,
        local,
        visitante,
        esBye,
        esBye ? 'finalizado' : 'pendiente',
        esBye ? (local ? 'local' : 'visitante') : null,
      ]
    );
  }

  for (let f = 1; f < fases.length; f++) {
    const faseActual = fases[f];
    const posicionesEnFase = Math.pow(2, fases.length - f - 1);

    for (let p = 0; p < posicionesEnFase; p++) {
      await client.query(
        `INSERT INTO torneo_partidos (
          torneo_id, ronda, orden, fase, posicion_en_fase, estado
        )
        VALUES ($1, $2, $3, $4, $5, 'pendiente')`,
        [torneoId, faseActual, p, faseActual, p]
      );
    }
  }

  for (let f = 0; f < fases.length - 1; f++) {
    const faseActual = fases[f];
    const faseSiguiente = fases[f + 1];

    const { rows: partidosActuales } = await client.query(
      `SELECT id, posicion_en_fase FROM torneo_partidos
       WHERE torneo_id = $1 AND fase = $2
       ORDER BY posicion_en_fase ASC`,
      [torneoId, faseActual]
    );

    const { rows: partidosSiguientes } = await client.query(
      `SELECT id, posicion_en_fase FROM torneo_partidos
       WHERE torneo_id = $1 AND fase = $2
       ORDER BY posicion_en_fase ASC`,
      [torneoId, faseSiguiente]
    );

    for (const p of partidosActuales) {
      const siguientePos = Math.floor(p.posicion_en_fase / 2);
      const siguiente = partidosSiguientes.find(s => s.posicion_en_fase === siguientePos);
      if (siguiente) {
        await client.query(
          `UPDATE torneo_partidos SET siguiente_partido_id = $1 WHERE id = $2`,
          [siguiente.id, p.id]
        );
      }
    }
  }

  const { rows: byes } = await client.query(
    `SELECT * FROM torneo_partidos
     WHERE torneo_id = $1 AND es_bye = TRUE AND siguiente_partido_id IS NOT NULL`,
    [torneoId]
  );

  for (const bye of byes) {
    const ganadorId = bye.ganador === 'local' ? bye.equipo_local_id : bye.equipo_visitante_id;
    if (!ganadorId) continue;

    const esLocal = bye.posicion_en_fase % 2 === 0;
    const campo = esLocal ? 'equipo_local_id' : 'equipo_visitante_id';

    await client.query(
      `UPDATE torneo_partidos
       SET ${campo} = $1, updated_at = NOW()
       WHERE id = $2`,
      [ganadorId, bye.siguiente_partido_id]
    );
  }

  return {
    fases,
    totalPartidos: partidosPrimerasFase,
  };
}

/* =========================================================
   LISTAR TORNEOS
   ========================================================= */
export async function listarTorneos(filtros, usuarioId) {
  const {
    deporte, estado, modalidad, nivel, tipoParticipacion,
    sistemaClasificacion,
    soloMios, soloInscritos, busqueda,
    page = 1, limit = 20,
    desde, hasta,
    campoFecha, // ⚡ NUEVO
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

  if (sistemaClasificacion) {
    condiciones.push(`t.sistema_clasificacion = $${i}`);
    valores.push(sistemaClasificacion);
    i++;
  }

  if (busqueda) {
    condiciones.push(`(t.nombre ILIKE $${i} OR t.lugar ILIKE $${i})`);
    valores.push(`%${busqueda}%`);
    i++;
  }

  // ⚡ NUEVO: filtro por fecha con columna dinámica
  const columnaFecha = campoFecha === 'torneo'
    ? 't.fecha_inicio'
    : 't.fecha_limite_inscripcion';

  if (desde) {
    condiciones.push(`${columnaFecha} IS NOT NULL AND ${columnaFecha} >= $${i}::date`);
    valores.push(desde);
    i++;
  }

  if (hasta) {
    condiciones.push(`${columnaFecha} IS NOT NULL AND ${columnaFecha} < ($${i}::date + INTERVAL '1 day')`);
    valores.push(hasta);
    i++;
  }

  if (soloMios === 'true') {
    condiciones.push(`(
      t.organizador_id = $${i}
      OR EXISTS (
        SELECT 1 FROM torneo_organizadores to2
        WHERE to2.torneo_id = t.id AND to2.usuario_id = $${i}
      )
    )`);
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

  // ⚡ BLOQUEO: excluir torneos de organizadores bloqueados (en cualquier dirección)
  const bloqueados = await idsBloqueadosTotales(usuarioId);
  if (bloqueados.length > 0) {
    const placeholders = [];
    for (let j = 0; j < bloqueados.length; j++) {
      placeholders.push(`$${i}`);
      valores.push(bloqueados[j]);
      i++;
    }
    condiciones.push(`t.organizador_id NOT IN (${placeholders.join(', ')})`);
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
       EXISTS (
         SELECT 1 FROM torneo_organizadores to2
         WHERE to2.torneo_id = t.id AND to2.usuario_id = $${idxUser}
       ) AS soy_sub_organizador,
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
      soySubOrganizador: row.soy_sub_organizador,
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

  // ⚡ BLOQUEO: si hay bloqueo con el organizador, no se puede ver el detalle
  if (await estanBloqueados(usuarioId, torneo.organizador_id)) {
    const err = new Error('Torneo no disponible');
    err.status = 403;
    throw err;
  }

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

  /* ⚡ D.3: invitaciones pendientes a sub-organizadores (solo para el org principal) */
  let invitacionesOrganizador = [];
  if (esOrganizador) {
    const { rows: invRows } = await pool.query(
      `SELECT toi.invitado_id AS usuario_id, toi.permisos, toi.created_at AS creado,
              u.nombre, u.username, u.avatar
       FROM torneo_organizadores_invitaciones toi
       JOIN usuarios u ON u.id = toi.invitado_id
       WHERE toi.torneo_id = $1 AND toi.estado = 'pendiente'
       ORDER BY toi.created_at DESC`,
      [torneoId]
    );
    invitacionesOrganizador = invRows;
  }

  /* ⚡ D.3: ¿tengo yo una invitación pendiente? */
  const { rows: miInvRows } = await pool.query(
    `SELECT id, permisos, created_at AS creado
     FROM torneo_organizadores_invitaciones
     WHERE torneo_id = $1 AND invitado_id = $2 AND estado = 'pendiente'`,
    [torneoId, usuarioId]
  );
  const miInvitacionOrganizador = miInvRows[0] || null;

  const partidos = await obtenerPartidos(pool, torneoId, tipo);
  const jornadas = await obtenerJornadas(pool, torneoId);

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

  const misPermisosSub = organizadores.find(
    o => String(o.usuario_id) === String(usuarioId)
  )?.permisos;
  const puedeGestionarFixture = esOrganizador
    || misPermisosSub === 'resultados'
    || misPermisosSub === 'completo';

  let listaEsperaVisible;
  let invitacionesVisibles;

  if (esOrganizador || soySubOrganizador) {
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
    invitacionesOrganizador,
    partidos,
    jornadas,
    tablaPosiciones,

    soyOrganizador: esOrganizador,
    soySubOrganizador,
    puedeGestionarFixture,
    miEquipoInscrito,
    miEquipoInscritoDetalle,
    miSolicitudPendiente,
    miSolicitudPendienteDetalle,
    miInvitacionPendiente,
    miInvitacionPendienteDetalle,
    miInvitacionOrganizador,
  };
}

/* =========================================================
   CREAR TORNEO
   ========================================================= */
export async function crearTorneo(datos, usuarioId) {
  // ⚡ VALIDACIÓN PREMIUM EN BACKEND
  const { rows: uRows } = await pool.query(
    'SELECT plan, premium_hasta FROM usuarios WHERE id = $1',
    [usuarioId]
  );
  
  if (!uRows[0]) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }

  const capPlan = uRows[0].plan;
  const capPremHasta = uRows[0].premium_hasta;
  const esPrem = capPlan === 'premium' && (!capPremHasta || new Date(capPremHasta) > new Date());

  if (!esPrem) {
    const err = new Error('La creación de torneos es exclusiva del plan Premium.');
    err.status = 403;
    throw err;
  }
  // ⚡ FIN VALIDACIÓN PREMIUM

  const {
    nombre, deporte, emoji, descripcion, lugar,
    fechaInicio, fechaFin, fechaLimiteInscripcion,
    cuposEquipos, precio,
    modalidad, nivel, libreInscripcion,
    tipoParticipacion, idaYVuelta, autoFixture,
    sistemaClasificacion,
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
      tipo_participacion, ida_y_vuelta, auto_fixture,
      sistema_clasificacion,
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
      $14, $15, $16,
      $17,
      $18, $19, $20,
      $21, $22, $23,
      $24, $25,
      'inscripcion'
    )
    RETURNING *`,
    [
      nombre, deporte, emoji || null, descripcion || null, lugar,
      fechaInicio, fechaFin || null, fechaLimiteInscripcion || null,
      cuposEquipos, precio || 0,
      modalidad || 'liga', nivel || 'amistoso', libreInscripcion ?? true,
      tipoParticipacion || 'equipo', idaYVuelta ?? false, autoFixture ?? false,
      sistemaClasificacion || 'simple',
      puntosVictoria ?? 3, puntosEmpate ?? 1, puntosDerrota ?? 0,
      permiteEmpate ?? true, incluyeEstadisticas ?? false, equiposClasifican || null,
      canalChatId, usuarioId,
    ]
  );

  const torneo = rows[0];

  // ⚡ Crear el canal del torneo + agregar al organizador como miembro
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await crearCanalParaTorneo(client, torneo, usuarioId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.warn('[torneos] No se pudo crear canal de chat:', err.message);
  } finally {
    client.release();
  }

  return obtenerTorneo(torneo.id, usuarioId);
}

/* =========================================================
   EDITAR TORNEO
   ========================================================= */
export async function editarTorneo(torneoId, cambios, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneoAntes = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneoAntes, usuarioId);

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
      cambios.tipoParticipacion !== torneoAntes.tipo_participacion
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

    if (
      cambios.idaYVuelta !== undefined &&
      cambios.idaYVuelta !== torneoAntes.ida_y_vuelta
    ) {
      const { rows: jornadas } = await client.query(
        `SELECT COUNT(*)::int AS total FROM torneo_jornadas WHERE torneo_id = $1`,
        [torneoId]
      );
      if (jornadas[0].total > 0) {
        const err = new Error('No podés cambiar ida/vuelta con jornadas ya creadas');
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
      idaYVuelta: 'ida_y_vuelta',
      autoFixture: 'auto_fixture',
      sistemaClasificacion: 'sistema_clasificacion',
      puntosVictoria: 'puntos_victoria',
      puntosEmpate: 'puntos_empate',
      puntosDerrota: 'puntos_derrota',
      permiteEmpate: 'permite_empate',
      incluyeEstadisticas: 'incluye_estadisticas',
      equiposClasifican: 'equipos_clasifican',
    };

    const camposCriticos = [
      ['fechaInicio', 'fecha_inicio'],
      ['fechaLimiteInscripcion', 'fecha_limite_inscripcion'],
      ['lugar', 'lugar'],
      ['precio', 'precio'],
      ['cuposEquipos', 'cupos_equipos'],
    ];

    let cambioCritico = false;
    for (const [camel, snake] of camposCriticos) {
      if (cambios[camel] !== undefined) {
        if (String(torneoAntes[snake]) !== String(cambios[camel])) {
          cambioCritico = true;
          break;
        }
      }
    }

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

    if (cambioCritico) {
      const tipo = torneoAntes.tipo_participacion || 'equipo';
      const destinatarios = await obtenerDestinatariosTorneo(client, torneoId, tipo);

      if (destinatarios.length > 0) {
        await crearNotificacionMultiple(
          destinatarios,
          'edicion',
          `El organizador editó "${torneoAntes.nombre}". Revisá los cambios.`,
          `#/torneo/${torneoId}`
        );
      }
    }

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
   ELIMINAR TORNEO
   ========================================================= */
export async function eliminarTorneo(torneoId, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    verificarOrganizador(torneo, usuarioId);

    const tipo = torneo.tipo_participacion || 'equipo';
    const destinatarios = await obtenerDestinatariosTorneo(client, torneoId, tipo);

    await client.query(
      `DELETE FROM torneos WHERE id = $1`,
      [torneoId]
    );
        // ⚡ Borrar el canal del torneo y sus miembros
    if (torneo.canal_chat_id) {
      await client.query(
        `DELETE FROM canal_miembros WHERE canal_id = $1`,
        [torneo.canal_chat_id]
      );
      await client.query(
        `DELETE FROM canales WHERE id = $1`,
        [torneo.canal_chat_id]
      );
    }

    if (destinatarios.length > 0) {
      await crearNotificacionMultiple(
        destinatarios,
        'cancelacion',
        `El torneo "${torneo.nombre}" fue cancelado por el organizador.`,
        null
      );
    }

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
   CERRAR TORNEO + AUTO-FIXTURE
   ========================================================= */
export async function cerrarTorneo(torneoId, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

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

    let autoFixturado = false;
    let infoFixture = null;

    if (torneo.modalidad === 'eliminacion' && torneo.auto_fixture === true) {
      const { rows: countPartidos } = await client.query(
        `SELECT COUNT(*)::int AS total FROM torneo_partidos WHERE torneo_id = $1`,
        [torneoId]
      );

      if (countPartidos[0].total === 0) {
        try {
          infoFixture = await armarFixtureAleatorioInterno(client, torneoId, torneo);
          autoFixturado = true;
        } catch (err) {
          console.warn('[torneos] No se pudo auto-armar fixture:', err.message);
        }
      }
    }

    const tipo = torneo.tipo_participacion || 'equipo';
    const destinatarios = await obtenerDestinatariosTorneo(client, torneoId, tipo);

    if (destinatarios.length > 0) {
      await crearNotificacionMultiple(
        destinatarios,
        'cierre',
        `Las inscripciones de "${torneo.nombre}" fueron cerradas.`,
        `#/torneo/${torneoId}`
      );
    }

    await client.query('COMMIT');

    const torneoActualizado = await obtenerTorneo(torneoId, usuarioId);

    return {
      torneo: torneoActualizado,
      autoFixturado,
      infoFixture,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   INSCRIBIR EQUIPO / USUARIO
   ========================================================= */
export async function inscribirEquipo(torneoId, usuarioId, equipoId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);

    // ⚡ BLOQUEO con el organizador
    if (await estanBloqueados(usuarioId, torneo.organizador_id)) {
      const err = new Error('No podés inscribirte en este torneo');
      err.status = 403;
      throw err;
    }

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

    /* ---------- RAMA INDIVIDUAL ---------- */
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

        // ⚡ Agregar al canal del torneo (individual → solo él)
        const canalIdInd = await obtenerCanalDeTorneo(torneoId);
        if (canalIdInd) {
          await agregarMiembrosACanal(client, canalIdInd, [usuarioId]);
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

    /* ---------- RAMA EQUIPO ---------- */
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

      // ⚡ Agregar al canal del torneo (equipo → todos sus miembros)
      const canalIdEq = await obtenerCanalDeTorneo(torneoId);
      if (canalIdEq) {
        const { rows: miembrosEq } = await client.query(
          `SELECT gm.usuario_id
           FROM grupo_miembros gm
           WHERE gm.grupo_id = $1`,
          [equipoId]
        );
        const uids = miembrosEq.map(r => r.usuario_id);
        if (uids.length > 0) {
          await agregarMiembrosACanal(client, canalIdEq, uids);
        }
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
   CANCELAR INSCRIPCIÓN / SOLICITUD
   ========================================================= */
export async function cancelarInscripcion(torneoId, usuarioId, equipoId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);

    // ⚡ BLOQUEO con el organizador
    if (await estanBloqueados(usuarioId, torneo.organizador_id)) {
      const err = new Error('No podés interactuar con este torneo');
      err.status = 403;
      throw err;
    }

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

    // ⚡ Quitar del canal del torneo
    const canalIdCancel = await obtenerCanalDeTorneo(torneoId);
    if (canalIdCancel && r1 > 0) {
      if (esIndividual) {
        await quitarMiembrosDeCanal(client, canalIdCancel, [usuarioId]);
      } else {
        const { rows: miembrosEq } = await client.query(
          `SELECT gm.usuario_id
           FROM grupo_miembros gm
           WHERE gm.grupo_id = $1`,
          [idEfectivo]
        );
        const uids = miembrosEq.map(r => r.usuario_id);
        if (uids.length > 0) {
          await quitarMiembrosDeCanal(client, canalIdCancel, uids);
        }
      }
    }

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
   APROBAR / RECHAZAR SOLICITUD
   ========================================================= */
export async function gestionarSolicitud(torneoId, usuarioId, equipoId, accion) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

    // ⚡ BLOQUEO: si hay bloqueo con el solicitante, no gestionar
    // (usuarioId puede ser el organizador y no se bloquea a sí mismo, pero por si acaso)
    if (await estanBloqueados(usuarioId, equipoId)) {
      const err = new Error('No podés gestionar solicitudes de este usuario');
      err.status = 403;
      throw err;
    }

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

    // ⚡ Agregar al canal del torneo
    const canalIdApr = await obtenerCanalDeTorneo(torneoId);
    if (canalIdApr) {
      if (esIndividual) {
        await agregarMiembrosACanal(client, canalIdApr, [equipoId]);
      } else {
        const { rows: miembrosEq } = await client.query(
          `SELECT gm.usuario_id
           FROM grupo_miembros gm
           WHERE gm.grupo_id = $1`,
          [equipoId]
        );
        const uids = miembrosEq.map(r => r.usuario_id);
        if (uids.length > 0) {
          await agregarMiembrosACanal(client, canalIdApr, uids);
        }
      }
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
   EXPULSAR PARTICIPANTE (organizador)
   ========================================================= */
export async function expulsarEquipo(torneoId, usuarioId, equipoId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

    const tipo = torneo.tipo_participacion || 'equipo';
    const esIndividual = tipo === 'individual';

    if (torneo.estado !== 'inscripcion') {
      const err = new Error('No podés expulsar participantes con el torneo ya iniciado o finalizado');
      err.status = 400;
      throw err;
    }

    if (torneo.fixture_bloqueado === true) {
      const err = new Error('No podés expulsar participantes con el fixture confirmado');
      err.status = 400;
      throw err;
    }

    const { rows: partidosConEquipo } = await client.query(
      `SELECT 1 FROM torneo_partidos
       WHERE torneo_id = $1
         AND (equipo_local_id = $2 OR equipo_visitante_id = $2)
       LIMIT 1`,
      [torneoId, equipoId]
    );

    if (partidosConEquipo.length > 0) {
      const err = new Error('No podés expulsar a un participante que ya tiene partidos generados');
      err.status = 400;
      throw err;
    }

    const nombreMostrar = await obtenerNombreMostrar(client, equipoId, esIndividual);

    let usuariosDestino = [];
    if (esIndividual) {
      usuariosDestino = [equipoId];
    } else {
      usuariosDestino = await obtenerUsuariosDeEquipo(client, equipoId);
    }

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

    await client.query(
      `DELETE FROM torneo_lista_espera WHERE torneo_id = $1 AND equipo_id = $2`,
      [torneoId, equipoId]
    );

    await client.query(
      `DELETE FROM torneo_invitaciones WHERE torneo_id = $1 AND equipo_id = $2`,
      [torneoId, equipoId]
    );

    // ⚡ Quitar del canal del torneo
    const canalIdExp = await obtenerCanalDeTorneo(torneoId);
    if (canalIdExp) {
      if (esIndividual) {
        await quitarMiembrosDeCanal(client, canalIdExp, [equipoId]);
      } else {
        const { rows: miembrosEq } = await client.query(
          `SELECT gm.usuario_id
           FROM grupo_miembros gm
           WHERE gm.grupo_id = $1`,
          [equipoId]
        );
        const uids = miembrosEq.map(r => r.usuario_id);
        if (uids.length > 0) {
          await quitarMiembrosDeCanal(client, canalIdExp, uids);
        }
      }
    }

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

    if (usuariosDestino.length > 0) {
      try {
        const mensaje = esIndividual
          ? `Fuiste retirado del torneo "${torneo.nombre}" por el organizador.`
          : `"${nombreMostrar}" fue retirado del torneo "${torneo.nombre}" por el organizador.`;

        await crearNotificacionMultiple(
          usuariosDestino,
          'expulsado',
          mensaje,
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
   INVITAR EQUIPO
   ========================================================= */
export async function invitarEquipo(torneoId, usuarioId, equipoId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

    // ⚡ BLOQUEO: el organizador no puede invitar a un equipo cuyo capitán lo tenga bloqueado
    const { rows: capRows } = await client.query(
      `SELECT capitan_id FROM grupos WHERE id = $1`,
      [equipoId]
    );
    if (capRows[0] && await estanBloqueados(usuarioId, capRows[0].capitan_id)) {
      const err = new Error('No podés invitar a ese equipo');
      err.status = 403;
      throw err;
    }

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

    const usuariosDestino = await obtenerUsuariosDeEquipo(client, equipoId);
    const nombreEquipo = await obtenerNombreMostrar(client, equipoId, false);

    await client.query('COMMIT');

    if (usuariosDestino.length > 0) {
      try {
        await crearNotificacionMultiple(
          usuariosDestino,
          'invitacion',
          `${nombreEquipo} fue invitado a "${torneo.nombre}"`,
          `#/torneo/${torneoId}`
        );
      } catch (e) {
        console.warn('[torneos] No se pudo notificar invitación:', e.message);
      }
    }

    return { ok: true, mensaje: 'Invitación enviada' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   RESPONDER INVITACIÓN (a equipo)
   ========================================================= */
export async function responderInvitacion(torneoId, usuarioId, equipoId, aceptar) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);

    // ⚡ BLOQUEO con el organizador
    if (await estanBloqueados(usuarioId, torneo.organizador_id)) {
      const err = new Error('No podés responder a esta invitación');
      err.status = 403;
      throw err;
    }

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

    // ⚡ Agregar al canal del torneo
    const canalIdInv = await obtenerCanalDeTorneo(torneoId);
    if (canalIdInv) {
      const { rows: miembrosEq } = await client.query(
        `SELECT gm.usuario_id
         FROM grupo_miembros gm
         WHERE gm.grupo_id = $1`,
        [equipoId]
      );
      const uids = miembrosEq.map(r => r.usuario_id);
      if (uids.length > 0) {
        await agregarMiembrosACanal(client, canalIdInv, uids);
      }
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
   SUB-ORGANIZADORES — INVITAR
   ========================================================= */
export async function invitarOrganizador(torneoId, usuarioId, invitadoId, permisos) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    verificarOrganizador(torneo, usuarioId);

    if (String(torneo.organizador_id) === String(invitadoId)) {
      const err = new Error('Ese usuario ya es el organizador principal');
      err.status = 400;
      throw err;
    }

    // ⚡ BLOQUEO: no invitar a un usuario bloqueado
    if (await estanBloqueados(usuarioId, invitadoId)) {
      const err = new Error('No podés invitar a este usuario');
      err.status = 403;
      throw err;
    }

    const { rows: yaSub } = await client.query(
      `SELECT 1 FROM torneo_organizadores
       WHERE torneo_id = $1 AND usuario_id = $2`,
      [torneoId, invitadoId]
    );
    if (yaSub.length > 0) {
      const err = new Error('Ese usuario ya es sub-organizador del torneo');
      err.status = 409;
      throw err;
    }

    const { rows: yaInvitado } = await client.query(
      `SELECT 1 FROM torneo_organizadores_invitaciones
       WHERE torneo_id = $1 AND invitado_id = $2 AND estado = 'pendiente'`,
      [torneoId, invitadoId]
    );
    if (yaInvitado.length > 0) {
      const err = new Error('Ya le enviaste una invitación a ese usuario');
      err.status = 409;
      throw err;
    }

    const { rows: existe } = await client.query(
      `SELECT id FROM usuarios WHERE id = $1 AND activo = TRUE`,
      [invitadoId]
    );
    if (!existe[0]) {
      const err = new Error('El usuario invitado no existe');
      err.status = 404;
      throw err;
    }

    await client.query(
      `INSERT INTO torneo_organizadores_invitaciones
         (torneo_id, invitado_id, invitado_por, permisos)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (torneo_id, invitado_id)
       DO UPDATE SET
         estado = 'pendiente',
         permisos = EXCLUDED.permisos,
         invitado_por = EXCLUDED.invitado_por,
         created_at = NOW(),
         resuelta_en = NULL`,
      [torneoId, invitadoId, usuarioId, permisos || 'completo']
    );
        // ⚡ Agregar al sub-organizador al canal del torneo
    const canalIdSubOrg = await obtenerCanalDeTorneo(torneoId);
    if (canalIdSubOrg) {
      await agregarMiembrosACanal(client, canalIdSubOrg, [usuarioId]);
    }

    await client.query('COMMIT');

    try {
      await crearNotificacion(
        invitadoId,
        'invitacion_organizador',
        `Te invitaron a ser sub-organizador de "${torneo.nombre}"`,
        `#/torneo/${torneoId}`
      );
    } catch (e) {
      console.warn('[torneos] No se pudo notificar invitación a organizador:', e.message);
    }

    return { ok: true, mensaje: 'Invitación enviada' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   SUB-ORGANIZADORES — RESPONDER INVITACIÓN
   ========================================================= */
export async function responderInvitacionOrganizador(torneoId, usuarioId, aceptar) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);

    if (String(torneo.organizador_id) === String(usuarioId)) {
      const err = new Error('Vos ya sos el organizador principal');
      err.status = 400;
      throw err;
    }

    // ⚡ BLOQUEO con el organizador
    if (await estanBloqueados(usuarioId, torneo.organizador_id)) {
      const err = new Error('No podés responder a esta invitación');
      err.status = 403;
      throw err;
    }

    const { rows } = await client.query(
      `SELECT * FROM torneo_organizadores_invitaciones
       WHERE torneo_id = $1 AND invitado_id = $2 AND estado = 'pendiente'`,
      [torneoId, usuarioId]
    );

    if (!rows[0]) {
      const err = new Error('No tenés una invitación pendiente para este torneo');
      err.status = 404;
      throw err;
    }

    const inv = rows[0];

    if (!aceptar) {
      await client.query(
        `UPDATE torneo_organizadores_invitaciones
         SET estado = 'rechazada', resuelta_en = NOW()
         WHERE id = $1`,
        [inv.id]
      );
      await client.query('COMMIT');

      try {
        await crearNotificacion(
          torneo.organizador_id,
          'respuesta_invitacion_organizador',
          `Rechazaron tu invitación a organizar "${torneo.nombre}"`,
          `#/torneo/${torneoId}`
        );
      } catch (e) {
        console.warn('[torneos] No se pudo notificar rechazo:', e.message);
      }

      return { ok: true, mensaje: 'Invitación rechazada' };
    }

    await client.query(
      `UPDATE torneo_organizadores_invitaciones
       SET estado = 'aceptada', resuelta_en = NOW()
       WHERE id = $1`,
      [inv.id]
    );

    await client.query(
      `INSERT INTO torneo_organizadores (torneo_id, usuario_id, permisos)
       VALUES ($1, $2, $3)
       ON CONFLICT (torneo_id, usuario_id)
       DO UPDATE SET permisos = EXCLUDED.permisos`,
      [torneoId, usuarioId, inv.permisos || 'completo']
    );

    await client.query('COMMIT');

    try {
      await crearNotificacion(
        torneo.organizador_id,
        'respuesta_invitacion_organizador',
        `Aceptaron tu invitación a organizar "${torneo.nombre}"`,
        `#/torneo/${torneoId}`
      );
    } catch (e) {
      console.warn('[torneos] No se pudo notificar aceptación:', e.message);
    }

    return { ok: true, mensaje: 'Ahora sos sub-organizador' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   SUB-ORGANIZADORES — CANCELAR INVITACIÓN
   ========================================================= */
export async function cancelarInvitacionOrganizador(torneoId, usuarioId, invitadoId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    verificarOrganizador(torneo, usuarioId);

    const { rowCount } = await client.query(
      `UPDATE torneo_organizadores_invitaciones
       SET estado = 'cancelada', resuelta_en = NOW()
       WHERE torneo_id = $1 AND invitado_id = $2 AND estado = 'pendiente'`,
      [torneoId, invitadoId]
    );

    if (rowCount === 0) {
      const err = new Error('No hay una invitación pendiente para ese usuario');
      err.status = 404;
      throw err;
    }

    await client.query('COMMIT');

    try {
      await crearNotificacion(
        invitadoId,
        'respuesta_invitacion_organizador',
        `El organizador de "${torneo.nombre}" canceló tu invitación`,
        `#/torneo/${torneoId}`
      );
    } catch (e) {
      console.warn('[torneos] No se pudo notificar cancelación:', e.message);
    }

    return { ok: true, mensaje: 'Invitación cancelada' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   SUB-ORGANIZADORES — QUITAR
   ========================================================= */
export async function quitarOrganizador(torneoId, usuarioId, usuarioIdQuitar) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    verificarOrganizador(torneo, usuarioId);

    if (String(torneo.organizador_id) === String(usuarioIdQuitar)) {
      const err = new Error('No podés quitarte a vos mismo del torneo');
      err.status = 400;
      throw err;
    }

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
   JORNADAS (liga)
   ========================================================= */
export async function crearJornada(torneoId, usuarioId, datos) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

    if (torneo.modalidad !== 'liga') {
      const err = new Error('Solo los torneos de liga tienen jornadas');
      err.status = 400;
      throw err;
    }

    const { rows: maxRows } = await client.query(
      `SELECT COALESCE(MAX(numero), 0) + 1 AS siguiente
       FROM torneo_jornadas WHERE torneo_id = $1`,
      [torneoId]
    );
    const siguiente = maxRows[0].siguiente;

    const { rows } = await client.query(
      `INSERT INTO torneo_jornadas (torneo_id, numero, nombre, fecha)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        torneoId,
        siguiente,
        datos.nombre || `Jornada ${siguiente}`,
        datos.fecha || null,
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

export async function editarJornada(torneoId, jornadaId, usuarioId, cambios) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

    const { rows: existe } = await client.query(
      `SELECT id FROM torneo_jornadas WHERE id = $1 AND torneo_id = $2`,
      [jornadaId, torneoId]
    );
    if (!existe[0]) {
      const err = new Error('Jornada no encontrada');
      err.status = 404;
      throw err;
    }

    const campos = [];
    const valores = [];
    let i = 1;

    if (cambios.nombre !== undefined) {
      campos.push(`nombre = $${i}`);
      valores.push(cambios.nombre);
      i++;
    }
    if (cambios.fecha !== undefined) {
      campos.push(`fecha = $${i}`);
      valores.push(cambios.fecha);
      i++;
    }

    if (campos.length === 0) {
      await client.query('COMMIT');
      return { ok: true, mensaje: 'Sin cambios' };
    }

    valores.push(jornadaId);

    const { rows } = await client.query(
      `UPDATE torneo_jornadas
       SET ${campos.join(', ')}
       WHERE id = $${i}
       RETURNING *`,
      valores
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

export async function eliminarJornada(torneoId, jornadaId, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

    const { rows: partidos } = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM torneo_partidos
       WHERE jornada_id = $1`,
      [jornadaId]
    );

    if (partidos[0].total > 0) {
      const err = new Error('No podés borrar una jornada que tiene partidos');
      err.status = 400;
      throw err;
    }

    const { rowCount } = await client.query(
      `DELETE FROM torneo_jornadas WHERE id = $1 AND torneo_id = $2`,
      [jornadaId, torneoId]
    );

    if (rowCount === 0) {
      const err = new Error('Jornada no encontrada');
      err.status = 404;
      throw err;
    }

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Jornada eliminada' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function guardarJornadaBulk(torneoId, jornadaId, usuarioId, datos) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

    const { rows: jornadaRows } = await client.query(
      `SELECT * FROM torneo_jornadas WHERE id = $1 AND torneo_id = $2`,
      [jornadaId, torneoId]
    );
    if (!jornadaRows[0]) {
      const err = new Error('Jornada no encontrada');
      err.status = 404;
      throw err;
    }

    if (datos.jornada) {
      const campos = [];
      const valores = [];
      let i = 1;

      if (datos.jornada.nombre !== undefined) {
        campos.push(`nombre = $${i}`);
        valores.push(datos.jornada.nombre);
        i++;
      }
      if (datos.jornada.fecha !== undefined) {
        campos.push(`fecha = $${i}`);
        valores.push(datos.jornada.fecha);
        i++;
      }

      if (campos.length > 0) {
        valores.push(jornadaId);
        await client.query(
          `UPDATE torneo_jornadas
           SET ${campos.join(', ')}
           WHERE id = $${i}`,
          valores
        );
      }
    }

    if (Array.isArray(datos.partidosEliminar) && datos.partidosEliminar.length > 0) {
      await client.query(
        `DELETE FROM torneo_partidos
         WHERE torneo_id = $1 AND jornada_id = $2
           AND id = ANY($3::uuid[])`,
        [torneoId, jornadaId, datos.partidosEliminar]
      );
    }

    let partidosCambiados = 0;

    if (Array.isArray(datos.partidos)) {
      for (const p of datos.partidos) {
        if (!p.id) continue;

        const { rows: existeRows } = await client.query(
          `SELECT * FROM torneo_partidos
           WHERE id = $1 AND torneo_id = $2 AND jornada_id = $3`,
          [p.id, torneoId, jornadaId]
        );
        if (!existeRows[0]) continue;

        if (p.fecha !== undefined) {
          await client.query(
            `UPDATE torneo_partidos SET fecha = $1, updated_at = NOW() WHERE id = $2`,
            [p.fecha, p.id]
          );
        }

        if (p.resultado !== undefined) {
          const ganadorCalc = calcularGanadorPorDeporte(
            torneo.deporte,
            p.resultado,
            torneo.sistema_clasificacion || 'simple'
          );
          const nuevoEstado = p.estado || (p.resultado ? 'finalizado' : 'pendiente');

          await client.query(
            `UPDATE torneo_partidos
             SET resultado = $1,
                 estado = $2,
                 ganador = $3,
                 updated_at = NOW()
             WHERE id = $4`,
            [
              p.resultado ? JSON.stringify(p.resultado) : null,
              nuevoEstado,
              ganadorCalc,
              p.id,
            ]
          );

          partidosCambiados++;
        }
      }
    }

    if (torneo.modalidad === 'liga') {
      await recalcularTablaPosiciones(client, torneoId);
    }

    await client.query('COMMIT');

    return {
      ok: true,
      mensaje: 'Jornada actualizada',
      partidosCambiados,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   FIXTURE — CRUD de partidos
   ========================================================= */
export async function crearPartidoTorneo(torneoId, usuarioId, datos) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

    if (torneo.modalidad === 'custom') {
      const err = new Error('Los torneos custom no manejan fixture automático');
      err.status = 400;
      throw err;
    }

    if (torneo.modalidad === 'eliminacion' && torneo.fixture_bloqueado) {
      const err = new Error('El fixture ya fue confirmado. No se pueden agregar partidos.');
      err.status = 400;
      throw err;
    }

    const { ronda, orden, equipoLocalId, equipoVisitanteId, fecha, jornadaId } = datos;

    if (jornadaId) {
      const { rows } = await client.query(
        `SELECT id FROM torneo_jornadas WHERE id = $1 AND torneo_id = $2`,
        [jornadaId, torneoId]
      );
      if (!rows[0]) {
        const err = new Error('Jornada no encontrada');
        err.status = 404;
        throw err;
      }
    }

    const { rows } = await client.query(
      `INSERT INTO torneo_partidos (
        torneo_id, ronda, orden,
        equipo_local_id, equipo_visitante_id,
        fecha, estado, jornada_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pendiente', $7)
      RETURNING *`,
      [
        torneoId, ronda, orden || 0,
        esUuidValido(equipoLocalId) ? equipoLocalId : null,
        esUuidValido(equipoVisitanteId) ? equipoVisitanteId : null,
        fecha || null,
        jornadaId || null,
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

export async function editarPartidoTorneo(torneoId, partidoId, usuarioId, cambios) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

    const { rows: existe } = await client.query(
      `SELECT * FROM torneo_partidos WHERE id = $1 AND torneo_id = $2`,
      [partidoId, torneoId]
    );
    if (!existe[0]) {
      const err = new Error('Partido no encontrado en este torneo');
      err.status = 404;
      throw err;
    }

    if (torneo.modalidad === 'eliminacion' && torneo.fixture_bloqueado) {
      const camposPermitidos = ['fecha'];
      const camposPedidos = Object.keys(cambios).filter(k => cambios[k] !== undefined);
      const invalidos = camposPedidos.filter(k => !camposPermitidos.includes(k));
      if (invalidos.length > 0) {
        const err = new Error('El fixture ya fue confirmado. Solo podés editar la fecha.');
        err.status = 400;
        throw err;
      }
    }

    const campos = [];
    const valores = [];
    let i = 1;

    if (cambios.equipoLocalId !== undefined) {
      campos.push(`equipo_local_id = $${i}`);
      valores.push(esUuidValido(cambios.equipoLocalId) ? cambios.equipoLocalId : null);
      i++;
    }
    if (cambios.equipoVisitanteId !== undefined) {
      campos.push(`equipo_visitante_id = $${i}`);
      valores.push(esUuidValido(cambios.equipoVisitanteId) ? cambios.equipoVisitanteId : null);
      i++;
    }
    if (cambios.fecha !== undefined) {
      campos.push(`fecha = $${i}`);
      valores.push(cambios.fecha);
      i++;
    }
    if (cambios.jornadaId !== undefined) {
      campos.push(`jornada_id = $${i}`);
      valores.push(cambios.jornadaId);
      i++;
    }
    if (cambios.orden !== undefined) {
      campos.push(`orden = $${i}`);
      valores.push(cambios.orden);
      i++;
    }

    if (campos.length === 0) {
      await client.query('COMMIT');
      return { ok: true, mensaje: 'Sin cambios' };
    }

    valores.push(partidoId);

    const { rows } = await client.query(
      `UPDATE torneo_partidos
       SET ${campos.join(', ')}, updated_at = NOW()
       WHERE id = $${i}
       RETURNING *`,
      valores
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

export async function eliminarPartidoTorneo(torneoId, partidoId, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

    if (torneo.modalidad === 'eliminacion' && torneo.fixture_bloqueado) {
      const err = new Error('El fixture ya fue confirmado. No se pueden borrar partidos.');
      err.status = 400;
      throw err;
    }

    const { rowCount } = await client.query(
      `DELETE FROM torneo_partidos WHERE id = $1 AND torneo_id = $2`,
      [partidoId, torneoId]
    );

    if (rowCount === 0) {
      const err = new Error('Partido no encontrado');
      err.status = 404;
      throw err;
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

export async function editarCruce(torneoId, partidoId, usuarioId, cambios) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

    if (torneo.modalidad !== 'eliminacion') {
      const err = new Error('Solo aplica a torneos de eliminación');
      err.status = 400;
      throw err;
    }

    if (torneo.fixture_bloqueado) {
      const err = new Error('El fixture ya fue confirmado. No se pueden editar los cruces.');
      err.status = 400;
      throw err;
    }

    const { rows: existe } = await client.query(
      `SELECT * FROM torneo_partidos WHERE id = $1 AND torneo_id = $2`,
      [partidoId, torneoId]
    );
    if (!existe[0]) {
      const err = new Error('Cruce no encontrado');
      err.status = 404;
      throw err;
    }

    const partido = existe[0];

    const { rows: primerPartido } = await client.query(
      `SELECT fase FROM torneo_partidos
       WHERE torneo_id = $1
       ORDER BY
         CASE fase
           WHEN '64avos' THEN 1
           WHEN '32avos' THEN 2
           WHEN '16avos' THEN 3
           WHEN '8vos' THEN 4
           WHEN 'cuartos' THEN 5
           WHEN 'semis' THEN 6
           WHEN 'final' THEN 7
           WHEN 'tercer_puesto' THEN 8
         END ASC
       LIMIT 1`,
      [torneoId]
    );

    if (primerPartido[0] && partido.fase !== primerPartido[0].fase) {
      const err = new Error('Solo se pueden editar los cruces de la primera fase');
      err.status = 400;
      throw err;
    }

    const campos = [];
    const valores = [];
    let i = 1;

    if (cambios.equipoLocalId !== undefined) {
      campos.push(`equipo_local_id = $${i}`);
      valores.push(esUuidValido(cambios.equipoLocalId) ? cambios.equipoLocalId : null);
      i++;
    }
    if (cambios.equipoVisitanteId !== undefined) {
      campos.push(`equipo_visitante_id = $${i}`);
      valores.push(esUuidValido(cambios.equipoVisitanteId) ? cambios.equipoVisitanteId : null);
      i++;
    }

    if (campos.length === 0) {
      await client.query('COMMIT');
      return { ok: true, mensaje: 'Sin cambios' };
    }

    valores.push(partidoId);

    const { rows } = await client.query(
      `UPDATE torneo_partidos
       SET ${campos.join(', ')}, updated_at = NOW()
       WHERE id = $${i}
       RETURNING *`,
      valores
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

/* =========================================================
   FIXTURE AUTOMÁTICO — LIGA
   ========================================================= */
export async function generarFixtureLiga(torneoId, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

    if (torneo.modalidad !== 'liga') {
      const err = new Error('Solo los torneos de liga tienen fixture round-robin');
      err.status = 400;
      throw err;
    }

    const { rows: countPartidos } = await client.query(
      `SELECT COUNT(*)::int AS total FROM torneo_partidos WHERE torneo_id = $1`,
      [torneoId]
    );
    if (countPartidos[0].total > 0) {
      const err = new Error('Ya hay partidos creados. Borralos antes de generar el fixture.');
      err.status = 400;
      throw err;
    }

    const { rows: inscritos } = await client.query(
      `SELECT equipo_id FROM torneo_equipos WHERE torneo_id = $1 ORDER BY fecha ASC`,
      [torneoId]
    );

    if (inscritos.length < 2) {
      const err = new Error('Necesitás al menos 2 inscritos para generar el fixture');
      err.status = 400;
      throw err;
    }

    const equipoIds = inscritos.map(r => r.equipo_id);
    const jornadasGeneradas = generarRoundRobin(equipoIds, torneo.ida_y_vuelta);

    for (let i = 0; i < jornadasGeneradas.length; i++) {
      const numero = i + 1;
      const { rows: jornadaRows } = await client.query(
        `INSERT INTO torneo_jornadas (torneo_id, numero, nombre)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [torneoId, numero, `Jornada ${numero}`]
      );
      const jornadaId = jornadaRows[0].id;

      const partidos = jornadasGeneradas[i];
      for (let j = 0; j < partidos.length; j++) {
        const [localId, visitanteId] = partidos[j];
        await client.query(
          `INSERT INTO torneo_partidos (
             torneo_id, ronda, orden, jornada_id,
             equipo_local_id, equipo_visitante_id, estado
           )
           VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')`,
          [torneoId, `jornada_${numero}`, j, jornadaId, localId, visitanteId]
        );
      }
    }

    await client.query('COMMIT');

    return {
      ok: true,
      mensaje: `Fixture generado: ${jornadasGeneradas.length} jornadas`,
      totalJornadas: jornadasGeneradas.length,
      totalPartidos: jornadasGeneradas.reduce((acc, j) => acc + j.length, 0),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function armarFixtureAleatorio(torneoId, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

    const info = await armarFixtureAleatorioInterno(client, torneoId, torneo);

    await client.query('COMMIT');

    return {
      ok: true,
      mensaje: 'Fixture aleatorio armado',
      fases: info.fases,
      totalPartidos: info.totalPartidos,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function armarFixtureManual(torneoId, usuarioId, datos) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

    if (torneo.modalidad !== 'eliminacion') {
      const err = new Error('Solo los torneos de eliminación tienen bracket');
      err.status = 400;
      throw err;
    }

    if (torneo.fixture_bloqueado) {
      const err = new Error('El fixture ya fue confirmado');
      err.status = 400;
      throw err;
    }

    const { cruces } = datos;

    await client.query(
      `DELETE FROM torneo_partidos WHERE torneo_id = $1`,
      [torneoId]
    );

    const { rows: inscritos } = await client.query(
      `SELECT COUNT(*)::int AS total FROM torneo_equipos WHERE torneo_id = $1`,
      [torneoId]
    );
    const cantidadInscritos = inscritos[0].total;

    if (cantidadInscritos < 2) {
      const err = new Error('Necesitás al menos 2 inscritos');
      err.status = 400;
      throw err;
    }

    const fases = calcularFasesEliminacionPorInscritos(cantidadInscritos);

    const cantidadSlots = Math.pow(2, fases.length);
    if (cruces.length !== cantidadSlots / 2) {
      const err = new Error(
        `Se esperaban ${cantidadSlots / 2} cruces para la primera fase, recibí ${cruces.length}`
      );
      err.status = 400;
      throw err;
    }

    const primeraFase = fases[0];

    for (let i = 0; i < cruces.length; i++) {
      const cruce = cruces[i];
      const esBye = !cruce.visitanteId;

      await client.query(
        `INSERT INTO torneo_partidos (
          torneo_id, ronda, orden, fase, posicion_en_fase,
          equipo_local_id, equipo_visitante_id, es_bye, estado, ganador
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          torneoId,
          primeraFase,
          i,
          primeraFase,
          i,
          cruce.localId,
          cruce.visitanteId || null,
          esBye,
          esBye ? 'finalizado' : 'pendiente',
          esBye ? 'local' : null,
        ]
      );
    }

    for (let f = 1; f < fases.length; f++) {
      const faseActual = fases[f];
      const posicionesEnFase = Math.pow(2, fases.length - f - 1);

      for (let p = 0; p < posicionesEnFase; p++) {
        await client.query(
          `INSERT INTO torneo_partidos (
            torneo_id, ronda, orden, fase, posicion_en_fase, estado
          )
          VALUES ($1, $2, $3, $4, $5, 'pendiente')`,
          [torneoId, faseActual, p, faseActual, p]
        );
      }
    }

    for (let f = 0; f < fases.length - 1; f++) {
      const faseActual = fases[f];
      const faseSiguiente = fases[f + 1];

      const { rows: partidosActuales } = await client.query(
        `SELECT id, posicion_en_fase FROM torneo_partidos
         WHERE torneo_id = $1 AND fase = $2
         ORDER BY posicion_en_fase ASC`,
        [torneoId, faseActual]
      );

      const { rows: partidosSiguientes } = await client.query(
        `SELECT id, posicion_en_fase FROM torneo_partidos
         WHERE torneo_id = $1 AND fase = $2
         ORDER BY posicion_en_fase ASC`,
        [torneoId, faseSiguiente]
      );

      for (const p of partidosActuales) {
        const siguientePos = Math.floor(p.posicion_en_fase / 2);
        const siguiente = partidosSiguientes.find(s => s.posicion_en_fase === siguientePos);
        if (siguiente) {
          await client.query(
            `UPDATE torneo_partidos SET siguiente_partido_id = $1 WHERE id = $2`,
            [siguiente.id, p.id]
          );
        }
      }
    }

    const { rows: byes } = await client.query(
      `SELECT * FROM torneo_partidos
       WHERE torneo_id = $1 AND es_bye = TRUE AND siguiente_partido_id IS NOT NULL`,
      [torneoId]
    );

    for (const bye of byes) {
      const ganadorId = bye.ganador === 'local' ? bye.equipo_local_id : bye.equipo_visitante_id;
      if (!ganadorId) continue;

      const esLocal = bye.posicion_en_fase % 2 === 0;
      const campo = esLocal ? 'equipo_local_id' : 'equipo_visitante_id';

      await client.query(
        `UPDATE torneo_partidos
         SET ${campo} = $1, updated_at = NOW()
         WHERE id = $2`,
        [ganadorId, bye.siguiente_partido_id]
      );
    }

    await client.query('COMMIT');

    return {
      ok: true,
      mensaje: 'Fixture manual armado',
      fases,
      totalPartidos: cruces.length,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function confirmarFixture(torneoId, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const torneo = await obtenerTorneoOFallar(client, torneoId);
    await verificarPermisoResultados(client, torneo, usuarioId);

    if (torneo.modalidad !== 'eliminacion') {
      const err = new Error('Solo los torneos de eliminación se pueden confirmar');
      err.status = 400;
      throw err;
    }

    const { rows: countPartidos } = await client.query(
      `SELECT COUNT(*)::int AS total FROM torneo_partidos WHERE torneo_id = $1`,
      [torneoId]
    );

    if (countPartidos[0].total === 0) {
      const err = new Error('No hay partidos. Armá el fixture primero.');
      err.status = 400;
      throw err;
    }

    await client.query(
      `UPDATE torneos
       SET fixture_bloqueado = TRUE,
           estado = CASE
             WHEN estado = 'inscripcion' THEN 'en_curso'
             ELSE estado
           END,
           updated_at = NOW()
       WHERE id = $1`,
      [torneoId]
    );

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Fixture confirmado y bloqueado' };
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

    const partido = rows[0];

    const resultadoFinal = calcularGanadorPorDeporte(
      torneo.deporte,
      datos.resultado,
      torneo.sistema_clasificacion || 'simple'
    );

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
        resultadoFinal,
        partidoId,
      ]
    );

    if (torneo.modalidad === 'liga' && (datos.estado === 'finalizado' || !datos.estado)) {
      await recalcularTablaPosiciones(client, torneoId);
    }

    if (
      torneo.modalidad === 'eliminacion' &&
      (datos.estado === 'finalizado' || !datos.estado) &&
      partido.siguiente_partido_id &&
      (resultadoFinal === 'local' || resultadoFinal === 'visitante')
    ) {
      const ganadorId = resultadoFinal === 'local' ? partido.equipo_local_id : partido.equipo_visitante_id;

      if (ganadorId) {
        const { rows: siguiente } = await client.query(
          `SELECT * FROM torneo_partidos WHERE id = $1`,
          [partido.siguiente_partido_id]
        );

        if (siguiente[0]) {
          const esLocal = partido.posicion_en_fase % 2 === 0;
          const campo = esLocal ? 'equipo_local_id' : 'equipo_visitante_id';

          await client.query(
            `UPDATE torneo_partidos
             SET ${campo} = $1, updated_at = NOW()
             WHERE id = $2`,
            [ganadorId, partido.siguiente_partido_id]
          );
        }
      }
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

function calcularGanadorPorDeporte(deporte, resultado, sistemaClasificacion = 'simple') {
  if (!resultado) return null;

  if (sistemaClasificacion === 'tiempo') {
    return calcularGanadorPorTiempo(resultado);
  }

  if (sistemaClasificacion === 'puntos') {
    return calcularGanadorPorPuntos(resultado);
  }

  const DEPORTES_SETS = new Set([
    'Vóleibol', 'Bádminton', 'Tenis de mesa', 'Tenis', 'Pádel', 'Squash',
  ]);

  const DEPORTES_PENALES = new Set([
    'Fútbol', 'Hockey', 'Handball',
  ]);

  if (DEPORTES_SETS.has(deporte) && Array.isArray(resultado.sets)) {
    let setsLocal = 0;
    let setsVisitante = 0;

    for (const s of resultado.sets) {
      const local = Number(s.local) || 0;
      const visitante = Number(s.visitante) || 0;
      if (local > visitante) setsLocal++;
      else if (visitante > local) setsVisitante++;
    }

    if (resultado.setsLocal != null) setsLocal = Number(resultado.setsLocal);
    if (resultado.setsVisitante != null) setsVisitante = Number(resultado.setsVisitante);

    if (setsLocal > setsVisitante) return 'local';
    if (setsVisitante > setsLocal) return 'visitante';
    return 'empate';
  }

  const local = Number(
    resultado.goles_local ??
    resultado.puntos_local ??
    resultado.carreras_local ??
    0
  );
  const visitante = Number(
    resultado.goles_visitante ??
    resultado.puntos_visitante ??
    resultado.carreras_visitante ??
    0
  );

  if (local > visitante) return 'local';
  if (visitante > local) return 'visitante';

  if (DEPORTES_PENALES.has(deporte)) {
    const penLocal = Number(resultado.penales_local ?? 0);
    const penVisitante = Number(resultado.penales_visitante ?? 0);

    if (penLocal > penVisitante) return 'local';
    if (penVisitante > penLocal) return 'visitante';
  }

  return 'empate';
}

function calcularGanadorPorTiempo(resultado) {
  const partes = Array.isArray(resultado.participantes) ? resultado.participantes : [];
  if (partes.length < 2) return null;

  const validos = partes
    .map(p => ({
      id: p.id,
      tiempo: Number(p.tiempoSeg),
    }))
    .filter(p => Number.isFinite(p.tiempo));

  if (validos.length < 2) return null;

  const ordenados = [...validos].sort((a, b) => a.tiempo - b.tiempo);

  const primero = ordenados[0];
  const segundo = ordenados[1];

  if (primero.tiempo === segundo.tiempo) return 'empate';

  const idLocal = partes[0]?.id;
  const idGanador = primero.id;

  if (String(idGanador) === String(idLocal)) return 'local';
  return 'visitante';
}

function calcularGanadorPorPuntos(resultado) {
  const partes = Array.isArray(resultado.participantes) ? resultado.participantes : [];
  if (partes.length < 2) return null;

  const validos = partes
    .map(p => ({
      id: p.id,
      puntos: Number(p.puntos),
    }))
    .filter(p => Number.isFinite(p.puntos));

  if (validos.length < 2) return null;

  const ordenados = [...validos].sort((a, b) => b.puntos - a.puntos);

  const primero = ordenados[0];
  const segundo = ordenados[1];

  if (primero.puntos === segundo.puntos) return 'empate';

  const idLocal = partes[0]?.id;
  const idGanador = primero.id;

  if (String(idGanador) === String(idLocal)) return 'local';
  return 'visitante';
}

async function recalcularTablaPosiciones(client, torneoId) {
  const { rows: metaRows } = await client.query(
    `SELECT sistema_clasificacion FROM torneos WHERE id = $1`,
    [torneoId]
  );
  if (
    metaRows[0]?.sistema_clasificacion === 'tiempo' ||
    metaRows[0]?.sistema_clasificacion === 'puntos'
  ) {
    return;
  }

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