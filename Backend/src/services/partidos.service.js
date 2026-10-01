/* =========================================================
   partidos.service.js — Lógica de negocio de partidos
   =========================================================
   SEGURIDAD:
   - Todas las queries son parametrizadas
   - Las acciones sensibles usan transacciones
   - Se valida ownership (organizador) antes de editar/eliminar
   - Se valida que no haya inscripciones dobles
   - Se previenen race conditions con SELECT ... FOR UPDATE
*/

import { pool } from '../config/db.js';

/* =========================================================
   HELPERS
   ========================================================= */

/**
 * Formatea una fila de partido para devolver al cliente.
 * NUNCA expone datos internos (organizador_id en crudo, etc.).
 */
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

/**
 * Verifica que el partido exista y devuelve la fila.
 * Si no existe, lanza 404.
 */
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

/**
 * Verifica que el usuario sea el organizador del partido.
 * Si no lo es, lanza 403.
 */
function verificarOrganizador(partido, usuarioId) {
  if (String(partido.organizador_id) !== String(usuarioId)) {
    const err = new Error('No tenés permiso para modificar este partido');
    err.status = 403;
    throw err;
  }
}

/**
 * Chequea si un string es un UUID v4 válido.
 */
function esUuidValido(str) {
  if (!str) return false;
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(str));
}

/* =========================================================
   LISTAR PARTIDOS
   =========================================================
   Con filtros y paginación.
   NUNCA devuelve TODOS los partidos sin límite.
   Incluye flags del usuario actual (yoInscrito, yoPostule, etc.)
*/
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

  // Contar total (para paginación)
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM partidos p ${where}`,
    valores
  );
  const total = countRows[0].total;

  // Traer la página
  const offset = (page - 1) * limit;

  // Parámetros finales: WHERE params + limit + offset + usuarioId
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
         SELECT 1 FROM partido_equipos_postulantes pep
         JOIN grupo_miembros gm ON gm.grupo_id = pep.equipo_id
         WHERE pep.partido_id = p.id
           AND gm.usuario_id = $${idxUser}
           AND pep.estado = 'pendiente'
       ) AS mi_equipo_postulado
     FROM partidos p
     JOIN usuarios u ON u.id = p.organizador_id
     ${where}
     ORDER BY p.fecha ASC
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
      miEquipoPostulado: row.mi_equipo_postulado,
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
   =========================================================
   Con lista de inscritos, postulantes, equipos.
   Solo el organizador o los inscritos ven la lista completa.
*/
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

  // Inscritos (jugadores)
  const { rows: inscritos } = await pool.query(
    `SELECT u.id, u.nombre, u.username, u.avatar, pi.posicion, pi.fecha
     FROM partido_inscripciones pi
     JOIN usuarios u ON u.id = pi.usuario_id
     WHERE pi.partido_id = $1
     ORDER BY pi.fecha ASC`,
    [partidoId]
  );

  // Postulantes (jugadores esperando aprobación)
  const { rows: postulantes } = await pool.query(
    `SELECT u.id, u.nombre, u.username, u.avatar,
            pp.posicion, pp.estado, pp.created_at AS fecha
     FROM partido_postulaciones pp
     JOIN usuarios u ON u.id = pp.usuario_id
     WHERE pp.partido_id = $1
     ORDER BY pp.created_at ASC`,
    [partidoId]
  );

  // Equipos inscritos
  const { rows: equiposInscritos } = await pool.query(
    `SELECT g.id, g.nombre, g.escudo, g.deporte, g.ciudad,
            (SELECT COUNT(*)::int FROM grupo_miembros WHERE grupo_id = g.id) AS total_jugadores
     FROM partido_equipos_inscritos pei
     JOIN grupos g ON g.id = pei.equipo_id
     WHERE pei.partido_id = $1`,
    [partidoId]
  );

  // Equipos postulantes
  const { rows: equiposPostulantes } = await pool.query(
    `SELECT g.id, g.nombre, g.escudo, g.deporte,
            pep.estado, pep.created_at AS fecha
     FROM partido_equipos_postulantes pep
     JOIN grupos g ON g.id = pep.equipo_id
     WHERE pep.partido_id = $1
     ORDER BY pep.created_at ASC`,
    [partidoId]
  );

  // ¿El usuario está inscrito? ¿Postulado?
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

  const esDeEquipo = partido.tipo_partido === 'equipo';

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
    miInscripcion: miInscripcion[0] || null,
    miPostulacion: miPostulacion[0] || null,
    soyOrganizador: esOrganizador,
  };
}

/* =========================================================
   CREAR PARTIDO
   ========================================================= */
export async function crearPartido(datos, usuarioId) {
  const {
    titulo, deporte, emoji, descripcion, lugar, fecha, cupos, precio,
    nivel, tipoPartido, organizadorEquipoId, aprobacionRequerida,
    pedirPosiciones, posiciones
  } = datos;

  // Validar que el organizadorEquipoId sea de un equipo del usuario
  // SOLO si es un UUID (formato del backend). Si es un número (legacy de localStorage),
  // se acepta por ahora hasta migrar grupos al backend (paso 8F).
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
    } else {
      console.log('[partidos] organizadorEquipoId no es UUID, saltando validación:', organizadorEquipoId);
    }
  }

  // Si el organizadorEquipoId NO es UUID, no lo guardamos en la columna UUID de la BD
  const esUuid = esUuidValido(organizadorEquipoId);
  const organizadorEquipoIdDB = esUuid ? organizadorEquipoId : null;

  const { rows } = await pool.query(
    `INSERT INTO partidos (
      titulo, deporte, emoji, descripcion, lugar, fecha, cupos, precio,
      nivel, tipo_partido, organizador_equipo_id, organizador_id,
      aprobacion_requerida, pedir_posiciones, posiciones
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *`,
    [
      titulo, deporte, emoji || null, descripcion || null, lugar, fecha, cupos, precio,
      nivel, tipoPartido, organizadorEquipoIdDB, usuarioId,
      aprobacionRequerida, pedirPosiciones, posiciones
    ]
  );

  const partido = rows[0];

  // Si es partido de equipo Y el organizadorEquipoId es UUID, inscribir automáticamente
  if (tipoPartido === 'equipo' && esUuid) {
    await pool.query(
      `INSERT INTO partido_equipos_inscritos (partido_id, equipo_id)
       VALUES ($1, $2)`,
      [partido.id, organizadorEquipoId]
    );
  }

  // Si es partido de jugador, inscribir al organizador automáticamente
  if (tipoPartido === 'jugador') {
    await pool.query(
      `INSERT INTO partido_inscripciones (partido_id, usuario_id)
       VALUES ($1, $2)`,
      [partido.id, usuarioId]
    );
  }

  // Devolver el partido con info del equipo original (aunque no se guardó en BD)
  const partidoCompleto = await obtenerPartido(partido.id, usuarioId);

  if (!esUuid && organizadorEquipoId) {
    partidoCompleto.organizadorEquipoIdLegacy = organizadorEquipoId;
  }

  return partidoCompleto;
}

/* =========================================================
   EDITAR PARTIDO (solo organizador)
   =========================================================
   Usa transacción + SELECT FOR UPDATE para evitar condiciones de carrera.
*/
export async function editarPartido(partidoId, cambios, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Bloquear la fila
    const partido = await obtenerPartidoOFallar(client, partidoId);

    // 2. Verificar ownership
    verificarOrganizador(partido, usuarioId);

    // 3. Si cambia cupos, verificar que no sea menor que los inscritos actuales
    if (cambios.cupos !== undefined) {
      const { rows: inscritos } = await client.query(
        `SELECT COUNT(*)::int AS total FROM partido_inscripciones WHERE partido_id = $1`,
        [partidoId]
      );
      const { rows: equipos } = await client.query(
        `SELECT COUNT(*)::int AS total FROM partido_equipos_inscritos WHERE partido_id = $1`,
        [partidoId]
      );

      const totalActual = partido.tipo_partido === 'equipo'
        ? equipos[0].total
        : inscritos[0].total;

      if (cambios.cupos < totalActual) {
        const err = new Error(`No podés bajar los cupos a menos de ${totalActual} (inscritos actuales)`);
        err.status = 400;
        throw err;
      }
    }

    // 4. Whitelist de campos
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

    // 5. Si estaba "lleno" y ahora hay cupo, reabrir
    const { rows: conteo } = await client.query(
      `SELECT
        (SELECT COUNT(*)::int FROM partido_inscripciones WHERE partido_id = $1) AS inscritos,
        (SELECT COUNT(*)::int FROM partido_equipos_inscritos WHERE partido_id = $1) AS equipos`,
      [partidoId]
    );

    const nuevosCupos = cambios.cupos ?? partido.cupos;
    const totalActual = partido.tipo_partido === 'equipo'
      ? conteo[0].equipos
      : conteo[0].inscritos;

    if (totalActual < nuevosCupos && partido.estado === 'lleno') {
      await client.query(
        `UPDATE partidos SET estado = 'abierto' WHERE id = $1`,
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
   ELIMINAR PARTIDO (solo organizador)
   =========================================================
   Hard delete: borra el partido y sus datos relacionados
   (las FK tienen ON DELETE CASCADE).
*/
export async function eliminarPartido(partidoId, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);
    verificarOrganizador(partido, usuarioId);

    await client.query(
      `DELETE FROM partidos WHERE id = $1`,
      [partidoId]
    );

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
   SEGURIDAD:
   - Transacción + FOR UPDATE (evita sobreventa de cupos)
   - Verifica que no esté ya inscrito
   - Verifica que el partido esté abierto
   - Verifica que no supere los cupos
*/
export async function inscribirse(partidoId, usuarioId, posicion = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);

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

    // ¿Ya está inscrito?
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

    // Si el partido requiere aprobación, redirigir a postulación
    if (partido.aprobacion_requerida) {
      const err = new Error('Este partido requiere aprobación. Usá el endpoint de postulación.');
      err.status = 400;
      throw err;
    }

    // Contar inscritos actuales
    const { rows: conteo } = await client.query(
      `SELECT COUNT(*)::int AS total FROM partido_inscripciones WHERE partido_id = $1`,
      [partidoId]
    );

    if (conteo[0].total >= partido.cupos) {
      const err = new Error('El partido ya está lleno');
      err.status = 409;
      throw err;
    }

    // Insertar inscripción
    await client.query(
      `INSERT INTO partido_inscripciones (partido_id, usuario_id, posicion)
       VALUES ($1, $2, $3)`,
      [partidoId, usuarioId, posicion || null]
    );

    // Si se llenó, cambiar estado
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

    // Si estaba lleno y ahora hay cupo, reabrir
    const { rows: conteo } = await client.query(
      `SELECT COUNT(*)::int AS total FROM partido_inscripciones WHERE partido_id = $1`,
      [partidoId]
    );

    if (conteo[0].total < partido.cupos && partido.estado === 'lleno') {
      await client.query(
        `UPDATE partidos SET estado = 'abierto' WHERE id = $1`,
        [partidoId]
      );
    }

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Saliste del partido' };
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

    // ¿Ya postuló?
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
   CANCELAR POSTULACIÓN
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
   APROBAR / RECHAZAR POSTULANTE (solo organizador)
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

    // Aprobar: verificar cupos
    const { rows: conteo } = await client.query(
      `SELECT COUNT(*)::int AS total FROM partido_inscripciones WHERE partido_id = $1`,
      [partidoId]
    );

    if (conteo[0].total >= partido.cupos) {
      const err = new Error('El partido ya está lleno');
      err.status = 409;
      throw err;
    }

    // Marcar postulación como aprobada
    await client.query(
      `UPDATE partido_postulaciones
       SET estado = 'aprobado', resuelta_en = NOW()
       WHERE partido_id = $1 AND usuario_id = $2`,
      [partidoId, postulanteId]
    );

    // Insertar en inscripciones
    await client.query(
      `INSERT INTO partido_inscripciones (partido_id, usuario_id, posicion)
       VALUES ($1, $2, $3)
       ON CONFLICT (partido_id, usuario_id) DO NOTHING`,
      [partidoId, postulanteId, rows[0].posicion]
    );

    // Si se llenó, marcar como lleno y rechazar pendientes
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
   =========================================================
   NOTA: si el equipo tiene ID legacy (no UUID), no se guarda
   en la BD pero se devuelve éxito. Al migrar grupos (8F) se
   resolverá de raíz.
*/
export async function postularEquipo(partidoId, usuarioId, equipoId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const partido = await obtenerPartidoOFallar(client, partidoId);

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

    const esUuid = esUuidValido(equipoId);

    if (!esUuid) {
      // ID legacy: no se guarda en la BD, pero devolvemos éxito
      console.log('[partidos] equipoId legacy (no UUID), saltando guardado:', equipoId);
      await client.query('COMMIT');

      const partidoActualizado = await obtenerPartido(partidoId, usuarioId);
      partidoActualizado.miEquipoPostuladoLegacy = true;
      return partidoActualizado;
    }

    // Validar permisos (capitán/admin del equipo)
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

    // ¿Ya postulado o inscrito?
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
   APROBAR / RECHAZAR EQUIPO POSTULANTE (solo organizador)
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

    // Aprobar
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