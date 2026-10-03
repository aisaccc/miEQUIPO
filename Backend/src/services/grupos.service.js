/* =========================================================
   grupos.service.js — Lógica de negocio de grupos
   =========================================================
   Grupos = equipos + comunidades
   SEGURIDAD:
   - Todas las queries parametrizadas
   - Ownership validado
   - Transacciones en acciones sensibles
*/

import { pool } from '../config/db.js';

/* =========================================================
   HELPERS
   ========================================================= */

function esUuidValido(str) {
  if (!str) return false;
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(str));
}

function formatearGrupo(row, extras = {}) {
  return {
    id: row.id,
    tipo: row.tipo,
    nombre: row.nombre,
    escudo: row.escudo,
    deporte: row.deporte,
    ciudad: row.ciudad,
    descripcion: row.descripcion,
    tipoAcceso: row.tipo_acceso,
    statsPrivadas: row.stats_privadas,
    stats: row.stats || { victorias: 0, empates: 0, derrotas: 0 },
    hilos: row.hilos || [],
    capitanId: row.capitan_id,
    capitan: extras.capitan || null,
    totalMiembros: extras.totalMiembros ?? 0,
    totalSolicitudes: extras.totalSolicitudes ?? 0,
    esCapitan: extras.esCapitan ?? false,
    esAdmin: extras.esAdmin ?? false,
    esMiembro: extras.esMiembro ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function obtenerGrupoOFallar(client, grupoId) {
  const { rows } = await client.query(
    `SELECT * FROM grupos WHERE id = $1`,
    [grupoId]
  );

  if (!rows[0]) {
    const err = new Error('Grupo no encontrado');
    err.status = 404;
    throw err;
  }

  return rows[0];
}

function verificarCapitan(grupo, usuarioId) {
  if (String(grupo.capitan_id) !== String(usuarioId)) {
    const err = new Error('Solo el capitán puede realizar esta acción');
    err.status = 403;
    throw err;
  }
}

async function verificarCapitanOAdmin(client, grupoId, usuarioId) {
  const { rows: capitanRows } = await client.query(
    `SELECT capitan_id FROM grupos WHERE id = $1`,
    [grupoId]
  );

  if (!capitanRows[0]) {
    const err = new Error('Grupo no encontrado');
    err.status = 404;
    throw err;
  }

  if (String(capitanRows[0].capitan_id) === String(usuarioId)) return;

  const { rows: adminRows } = await client.query(
    `SELECT 1 FROM grupo_miembros
     WHERE grupo_id = $1 AND usuario_id = $2 AND rol IN ('capitan', 'admin')`,
    [grupoId, usuarioId]
  );

  if (adminRows.length === 0) {
    const err = new Error('No tenés permiso para realizar esta acción');
    err.status = 403;
    throw err;
  }
}

/* =========================================================
   LISTAR GRUPOS
   ========================================================= */
export async function listarGrupos(filtros, usuarioId) {
  const {
    tipo, deporte, ciudad, tipoAcceso,
    soloMios, busqueda,
    page = 1, limit = 20
  } = filtros;

  const condiciones = [];
  const valores = [];
  let i = 1;

  if (tipo) {
    condiciones.push(`g.tipo = $${i}`);
    valores.push(tipo);
    i++;
  }

  if (deporte) {
    condiciones.push(`g.deporte = $${i}`);
    valores.push(deporte);
    i++;
  }

  if (ciudad) {
    condiciones.push(`g.ciudad ILIKE $${i}`);
    valores.push(`%${ciudad}%`);
    i++;
  }

  if (tipoAcceso) {
    condiciones.push(`g.tipo_acceso = $${i}`);
    valores.push(tipoAcceso);
    i++;
  }

  if (busqueda) {
    condiciones.push(`(g.nombre ILIKE $${i} OR g.descripcion ILIKE $${i} OR g.deporte ILIKE $${i})`);
    valores.push(`%${busqueda}%`);
    i++;
  }

  if (soloMios === 'true') {
    condiciones.push(`(
      g.capitan_id = $${i} OR EXISTS (
        SELECT 1 FROM grupo_miembros gm
        WHERE gm.grupo_id = g.id AND gm.usuario_id = $${i}
      )
    )`);
    valores.push(usuarioId);
    i++;
  }

  const where = condiciones.length > 0
    ? `WHERE ${condiciones.join(' AND ')}`
    : '';

  // Contar total
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM grupos g ${where}`,
    valores
  );
  const total = countRows[0].total;

  const offset = (page - 1) * limit;
  const parametrosFinales = [...valores, limit, offset, usuarioId];

  const idxLimit = i;
  const idxOffset = i + 1;
  const idxUser = i + 2;

  const { rows } = await pool.query(
    `SELECT g.*,
       u.id AS u_id, u.nombre AS u_nombre, u.username AS u_username, u.avatar AS u_avatar,
       (SELECT COUNT(*)::int FROM grupo_miembros WHERE grupo_id = g.id) AS total_miembros,
       (SELECT COUNT(*)::int FROM grupo_solicitudes WHERE grupo_id = g.id AND estado = 'pendiente') AS total_solicitudes,
       (g.capitan_id = $${idxUser}) AS es_capitan,
       EXISTS (
         SELECT 1 FROM grupo_miembros gm
         WHERE gm.grupo_id = g.id AND gm.usuario_id = $${idxUser} AND gm.rol = 'admin'
       ) AS es_admin,
       EXISTS (
         SELECT 1 FROM grupo_miembros gm
         WHERE gm.grupo_id = g.id AND gm.usuario_id = $${idxUser}
       ) AS es_miembro
     FROM grupos g
     JOIN usuarios u ON u.id = g.capitan_id
     ${where}
     ORDER BY g.created_at DESC
     LIMIT $${idxLimit} OFFSET $${idxOffset}`,
    parametrosFinales
  );

  return {
    data: rows.map(row => formatearGrupo(row, {
      capitan: {
        id: row.u_id,
        nombre: row.u_nombre,
        username: row.u_username,
        avatar: row.u_avatar,
      },
      totalMiembros: row.total_miembros,
      totalSolicitudes: row.total_solicitudes,
      esCapitan: row.es_capitan,
      esAdmin: row.es_admin,
      esMiembro: row.es_miembro,
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
   OBTENER UN GRUPO (detalle)
   ========================================================= */
export async function obtenerGrupo(grupoId, usuarioId) {
  const { rows } = await pool.query(
    `SELECT g.*,
       u.id AS u_id, u.nombre AS u_nombre, u.username AS u_username, u.avatar AS u_avatar
     FROM grupos g
     JOIN usuarios u ON u.id = g.capitan_id
     WHERE g.id = $1`,
    [grupoId]
  );

  if (!rows[0]) {
    const err = new Error('Grupo no encontrado');
    err.status = 404;
    throw err;
  }

  const grupo = rows[0];
  const esCapitan = String(grupo.capitan_id) === String(usuarioId);

  // Miembros
  const { rows: miembros } = await pool.query(
    `SELECT gm.usuario_id AS id, gm.rol, gm.posicion, gm.dorsal, gm.fecha_union,
            u.nombre, u.username, u.avatar
     FROM grupo_miembros gm
     JOIN usuarios u ON u.id = gm.usuario_id
     WHERE gm.grupo_id = $1
     ORDER BY 
       CASE gm.rol WHEN 'capitan' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
       gm.fecha_union ASC`,
    [grupoId]
  );

  // ¿Es admin?
  const esAdmin = miembros.some(m =>
    String(m.id) === String(usuarioId) && m.rol === 'admin'
  );
  const esMiembro = miembros.some(m => String(m.id) === String(usuarioId));

  // Solicitudes (solo capitan/admin)
  let solicitudes = [];
  if (esCapitan || esAdmin) {
    const { rows } = await pool.query(
      `SELECT gs.id, gs.usuario_id, gs.estado, gs.created_at AS fecha,
              u.nombre, u.username, u.avatar
       FROM grupo_solicitudes gs
       JOIN usuarios u ON u.id = gs.usuario_id
       WHERE gs.grupo_id = $1 AND gs.estado = 'pendiente'
       ORDER BY gs.created_at ASC`,
      [grupoId]
    );
    solicitudes = rows;
  }

  return {
    ...formatearGrupo(grupo, {
      capitan: {
        id: grupo.u_id,
        nombre: grupo.u_nombre,
        username: grupo.u_username,
        avatar: grupo.u_avatar,
      },
      totalMiembros: miembros.length,
      totalSolicitudes: solicitudes.length,
      esCapitan,
      esAdmin,
      esMiembro,
    }),
    miembros,
    solicitudes,
  };
}

/* =========================================================
   CREAR GRUPO (equipo o comunidad)
   ========================================================= */
export async function crearGrupo(datos, usuarioId) {
  const {
    tipo, nombre, escudo, deporte, ciudad, descripcion, tipoAcceso,
  } = datos;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar que no tenga ya un grupo del mismo tipo con el mismo nombre
    const { rows: yaExiste } = await client.query(
      `SELECT 1 FROM grupos
       WHERE LOWER(nombre) = LOWER($1)
         AND tipo = $2
         AND capitan_id = $3`,
      [nombre, tipo, usuarioId]
    );

    if (yaExiste.length > 0) {
      const err = new Error('Ya tenés un grupo con ese nombre');
      err.status = 409;
      throw err;
    }

    // Crear grupo
    const { rows } = await client.query(
      `INSERT INTO grupos (
        tipo, nombre, escudo, deporte, ciudad, descripcion,
        tipo_acceso, capitan_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        tipo, nombre, escudo || null, deporte, ciudad || null,
        descripcion || null, tipoAcceso || 'publico', usuarioId,
      ]
    );

    const grupo = rows[0];

    // Agregar al creador como capitán en grupo_miembros
    await client.query(
      `INSERT INTO grupo_miembros (grupo_id, usuario_id, rol)
       VALUES ($1, $2, 'capitan')`,
      [grupo.id, usuarioId]
    );

    await client.query('COMMIT');
    return obtenerGrupo(grupo.id, usuarioId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   EDITAR GRUPO (solo capitán o admin)
   ========================================================= */
export async function editarGrupo(grupoId, cambios, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const grupo = await obtenerGrupoOFallar(client, grupoId);
    await verificarCapitanOAdmin(client, grupoId, usuarioId);

    // Whitelist
    const permitidos = {
      nombre: 'nombre',
      escudo: 'escudo',
      deporte: 'deporte',
      ciudad: 'ciudad',
      descripcion: 'descripcion',
      tipoAcceso: 'tipo_acceso',
      statsPrivadas: 'stats_privadas',
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
      return obtenerGrupo(grupoId, usuarioId);
    }

    valores.push(grupoId);

    await client.query(
      `UPDATE grupos
       SET ${campos.join(', ')}, updated_at = NOW()
       WHERE id = $${i}`,
      valores
    );

    await client.query('COMMIT');
    return obtenerGrupo(grupoId, usuarioId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   EDITAR STATS (solo capitán o admin)
   ========================================================= */
export async function editarStats(grupoId, stats, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await obtenerGrupoOFallar(client, grupoId);
    await verificarCapitanOAdmin(client, grupoId, usuarioId);

    await client.query(
      `UPDATE grupos
       SET stats = $1::jsonb, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(stats), grupoId]
    );

    await client.query('COMMIT');
    return obtenerGrupo(grupoId, usuarioId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   ELIMINAR GRUPO (solo capitán)
   ========================================================= */
export async function eliminarGrupo(grupoId, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const grupo = await obtenerGrupoOFallar(client, grupoId);
    verificarCapitan(grupo, usuarioId);

    await client.query(
      `DELETE FROM grupos WHERE id = $1`,
      [grupoId]
    );

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Grupo eliminado' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   UNIRSE A UN GRUPO (o solicitar si es privado)
   ========================================================= */
export async function unirseAGrupo(grupoId, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const grupo = await obtenerGrupoOFallar(client, grupoId);

    // ¿Ya es miembro?
    const { rows: yaEsMiembro } = await client.query(
      `SELECT 1 FROM grupo_miembros
       WHERE grupo_id = $1 AND usuario_id = $2`,
      [grupoId, usuarioId]
    );

    if (yaEsMiembro.length > 0) {
      const err = new Error('Ya sos miembro de este grupo');
      err.status = 409;
      throw err;
    }

    // Si es privado → crear solicitud pendiente
    if (grupo.tipo_acceso === 'privado') {
      // ¿Ya tiene solicitud pendiente?
      const { rows: yaSolicito } = await client.query(
        `SELECT 1 FROM grupo_solicitudes
         WHERE grupo_id = $1 AND usuario_id = $2 AND estado = 'pendiente'`,
        [grupoId, usuarioId]
      );

      if (yaSolicito.length > 0) {
        const err = new Error('Ya enviaste una solicitud a este grupo');
        err.status = 409;
        throw err;
      }

      await client.query(
        `INSERT INTO grupo_solicitudes (grupo_id, usuario_id, estado)
         VALUES ($1, $2, 'pendiente')`,
        [grupoId, usuarioId]
      );

      await client.query('COMMIT');
      return { ok: true, tipo: 'solicitud', mensaje: 'Solicitud enviada' };
    }

    // Si es público → unirse directo
    await client.query(
      `INSERT INTO grupo_miembros (grupo_id, usuario_id, rol)
       VALUES ($1, $2, 'miembro')`,
      [grupoId, usuarioId]
    );

    await client.query('COMMIT');
    return { ok: true, tipo: 'inscripcion', mensaje: 'Te uniste al grupo' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   SALIR DEL GRUPO
   ========================================================= */
export async function salirDeGrupo(grupoId, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const grupo = await obtenerGrupoOFallar(client, grupoId);

    if (String(grupo.capitan_id) === String(usuarioId)) {
      const err = new Error('El capitán no puede salir. Eliminá el grupo si querés cerrarlo.');
      err.status = 400;
      throw err;
    }

    const { rowCount } = await client.query(
      `DELETE FROM grupo_miembros
       WHERE grupo_id = $1 AND usuario_id = $2`,
      [grupoId, usuarioId]
    );

    if (rowCount === 0) {
      const err = new Error('No sos miembro de este grupo');
      err.status = 404;
      throw err;
    }

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Saliste del grupo' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   CANCELAR SOLICITUD PENDIENTE (el propio usuario)
   ========================================================= */
export async function cancelarMiSolicitud(grupoId, usuarioId) {
  const { rowCount } = await pool.query(
    `DELETE FROM grupo_solicitudes
     WHERE grupo_id = $1 AND usuario_id = $2 AND estado = 'pendiente'`,
    [grupoId, usuarioId]
  );

  if (rowCount === 0) {
    const err = new Error('No tenés una solicitud pendiente en este grupo');
    err.status = 404;
    throw err;
  }

  return { ok: true, mensaje: 'Solicitud cancelada' };
}

/* =========================================================
   GESTIONAR SOLICITUD (solo capitán o admin)
   ========================================================= */
export async function gestionarSolicitud(grupoId, usuarioId, solicitanteId, accion) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const grupo = await obtenerGrupoOFallar(client, grupoId);
    await verificarCapitanOAdmin(client, grupoId, usuarioId);

    const { rows } = await client.query(
      `SELECT * FROM grupo_solicitudes
       WHERE grupo_id = $1 AND usuario_id = $2 AND estado = 'pendiente'`,
      [grupoId, solicitanteId]
    );

    if (!rows[0]) {
      const err = new Error('No hay una solicitud pendiente de ese usuario');
      err.status = 404;
      throw err;
    }

    if (accion === 'rechazar') {
      await client.query(
        `UPDATE grupo_solicitudes
         SET estado = 'rechazada', resuelta_en = NOW()
         WHERE grupo_id = $1 AND usuario_id = $2`,
        [grupoId, solicitanteId]
      );

      await client.query('COMMIT');
      return { ok: true, mensaje: 'Solicitud rechazada' };
    }

    // Aprobar: agregar como miembro
    await client.query(
      `UPDATE grupo_solicitudes
       SET estado = 'aceptada', resuelta_en = NOW()
       WHERE grupo_id = $1 AND usuario_id = $2`,
      [grupoId, solicitanteId]
    );

    await client.query(
      `INSERT INTO grupo_miembros (grupo_id, usuario_id, rol)
       VALUES ($1, $2, 'miembro')
       ON CONFLICT (grupo_id, usuario_id) DO NOTHING`,
      [grupoId, solicitanteId]
    );

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Solicitud aprobada' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   EXPULSAR MIEMBRO (solo capitán o admin)
   ========================================================= */
export async function expulsarMiembro(grupoId, usuarioId, miembroId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const grupo = await obtenerGrupoOFallar(client, grupoId);
    await verificarCapitanOAdmin(client, grupoId, usuarioId);

    if (String(grupo.capitan_id) === String(miembroId)) {
      const err = new Error('No podés expulsar al capitán');
      err.status = 400;
      throw err;
    }

    const { rowCount } = await client.query(
      `DELETE FROM grupo_miembros
       WHERE grupo_id = $1 AND usuario_id = $2`,
      [grupoId, miembroId]
    );

    if (rowCount === 0) {
      const err = new Error('Ese usuario no es miembro del grupo');
      err.status = 404;
      throw err;
    }

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Miembro expulsado' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   NOMBRAR / QUITAR ADMIN (solo capitán)
   ========================================================= */
export async function cambiarRolMiembro(grupoId, usuarioId, miembroId, nuevoRol) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const grupo = await obtenerGrupoOFallar(client, grupoId);
    verificarCapitan(grupo, usuarioId);

    if (String(grupo.capitan_id) === String(miembroId)) {
      const err = new Error('No podés cambiar el rol del capitán');
      err.status = 400;
      throw err;
    }

    if (nuevoRol === 'capitan') {
      const err = new Error('Usá "admin" o "miembro". El capitán no se puede cambiar desde acá.');
      err.status = 400;
      throw err;
    }

    const { rowCount } = await client.query(
      `UPDATE grupo_miembros
       SET rol = $1
       WHERE grupo_id = $2 AND usuario_id = $3`,
      [nuevoRol, grupoId, miembroId]
    );

    if (rowCount === 0) {
      const err = new Error('Ese usuario no es miembro del grupo');
      err.status = 404;
      throw err;
    }

    await client.query('COMMIT');
    return { ok: true, mensaje: `Rol cambiado a ${nuevoRol}` };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   LISTAR MIEMBROS (paginado, con búsqueda)
   ========================================================= */
export async function listarMiembros(grupoId, usuarioId) {
  const grupo = await obtenerGrupoOFallar(pool, grupoId);

  // ¿Es miembro o capitan?
  const { rows: miembroRows } = await pool.query(
    `SELECT 1 FROM grupo_miembros
     WHERE grupo_id = $1 AND usuario_id = $2`,
    [grupoId, usuarioId]
  );

  const esMiembro = miembroRows.length > 0;
  const esCapitan = String(grupo.capitan_id) === String(usuarioId);

  if (!esMiembro && !esCapitan) {
    const err = new Error('No tenés acceso a los miembros de este grupo');
    err.status = 403;
    throw err;
  }

  const { rows } = await pool.query(
    `SELECT gm.usuario_id AS id, gm.rol, gm.posicion, gm.dorsal, gm.fecha_union,
            u.nombre, u.username, u.avatar, u.ciudad
     FROM grupo_miembros gm
     JOIN usuarios u ON u.id = gm.usuario_id
     WHERE gm.grupo_id = $1
     ORDER BY 
       CASE gm.rol WHEN 'capitan' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
       gm.fecha_union ASC`,
    [grupoId]
  );

  return rows;
}

/* =========================================================
   LISTAR SOLICITUDES (solo capitán/admin)
   ========================================================= */
export async function listarSolicitudes(grupoId, usuarioId) {
  const grupo = await obtenerGrupoOFallar(pool, grupoId);

  const esCapitan = String(grupo.capitan_id) === String(usuarioId);

  if (!esCapitan) {
    const { rows: adminRows } = await pool.query(
      `SELECT 1 FROM grupo_miembros
       WHERE grupo_id = $1 AND usuario_id = $2 AND rol = 'admin'`,
      [grupoId, usuarioId]
    );
    if (adminRows.length === 0) {
      const err = new Error('Solo el capitán o admin puede ver las solicitudes');
      err.status = 403;
      throw err;
    }
  }

  const { rows } = await pool.query(
    `SELECT gs.id, gs.usuario_id AS id_usuario, gs.estado, gs.created_at AS fecha,
            u.nombre, u.username, u.avatar, u.ciudad
     FROM grupo_solicitudes gs
     JOIN usuarios u ON u.id = gs.usuario_id
     WHERE gs.grupo_id = $1
     ORDER BY 
       CASE gs.estado WHEN 'pendiente' THEN 1 ELSE 2 END,
       gs.created_at ASC`,
    [grupoId]
  );

  return rows;
}

/* =========================================================
   HELPERS EXPORTADOS (para usar desde otros servicios)
   ========================================================= */

/**
 * Verifica si un usuario es capitán/admin de un grupo.
 * Útil para partidos y torneos.
 */
export async function esCapitanOAdminDeGrupo(grupoId, usuarioId) {
  const { rows } = await pool.query(
    `SELECT capitan_id FROM grupos WHERE id = $1`,
    [grupoId]
  );

  if (!rows[0]) return false;
  if (String(rows[0].capitan_id) === String(usuarioId)) return true;

  const { rows: adminRows } = await pool.query(
    `SELECT 1 FROM grupo_miembros
     WHERE grupo_id = $1 AND usuario_id = $2 AND rol IN ('capitan', 'admin')`,
    [grupoId, usuarioId]
  );

  return adminRows.length > 0;
}

/**
 * Verifica si un usuario es miembro de un grupo (cualquier rol).
 */
export async function esMiembroDeGrupo(grupoId, usuarioId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM grupo_miembros
     WHERE grupo_id = $1 AND usuario_id = $2`,
    [grupoId, usuarioId]
  );
  return rows.length > 0;
}

/**
 * Obtiene todos los grupos donde un usuario es capitán o admin.
 * Útil para listar "mis equipos".
 */
export async function obtenerGruposDondeSoyCapitanOAdmin(usuarioId, tipo = null) {
  const condiciones = [];
  const valores = [usuarioId];
  let i = 2;

  if (tipo) {
    condiciones.push(`g.tipo = $${i}`);
    valores.push(tipo);
    i++;
  }

  const where = condiciones.length > 0
    ? `AND ${condiciones.join(' AND ')}`
    : '';

  const { rows } = await pool.query(
    `SELECT g.*,
       (SELECT COUNT(*)::int FROM grupo_miembros WHERE grupo_id = g.id) AS total_miembros
     FROM grupos g
     WHERE (
       g.capitan_id = $1 OR EXISTS (
         SELECT 1 FROM grupo_miembros gm
         WHERE gm.grupo_id = g.id AND gm.usuario_id = $1 AND gm.rol IN ('capitan', 'admin')
       )
     )
     ${where}
     ORDER BY g.created_at DESC`,
    valores
  );

  return rows;
}

/**
 * Obtiene los grupos donde un usuario es miembro (cualquier rol).
 */
export async function obtenerGruposDondeSoyMiembro(usuarioId, tipo = null) {
  const condiciones = [];
  const valores = [usuarioId];
  let i = 2;

  if (tipo) {
    condiciones.push(`g.tipo = $${i}`);
    valores.push(tipo);
    i++;
  }

  const where = condiciones.length > 0
    ? `AND ${condiciones.join(' AND ')}`
    : '';

  const { rows } = await pool.query(
    `SELECT g.*,
       (SELECT COUNT(*)::int FROM grupo_miembros WHERE grupo_id = g.id) AS total_miembros
     FROM grupos g
     JOIN grupo_miembros gm ON gm.grupo_id = g.id
     WHERE gm.usuario_id = $1
     ${where}
     ORDER BY g.created_at DESC`,
    valores
  );

  return rows;
}