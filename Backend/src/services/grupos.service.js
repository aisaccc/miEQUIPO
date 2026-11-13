/* =========================================================
   grupos.service.js — Lógica de negocio de grupos
   ========================================================= */

import { pool } from '../config/db.js';
import { idsBloqueadosTotales, estanBloqueados } from '../utils/bloqueos.js';
import { crearNotificacion } from './notificaciones.service.js';
import {
  crearCanalParaGrupo,
  agregarMiembroACanal,
  quitarMiembroDeCanal,
} from './mensajes.service.js';

/* =========================================================
   HELPERS
   ========================================================= */

function calcularEsPremium(row) {
  const plan = row.cap_plan || row.plan;
  const premiumHasta = row.cap_premium_hasta || row.premium_hasta;
  
  if (plan !== 'premium') return false;
  if (!premiumHasta) return true;
  return new Date(premiumHasta) > new Date();
}

function formatearGrupo(row, extras = {}) {
  const statsRaw = row.stats || { victorias: 0, empates: 0, derrotas: 0 };
  const victoriasPrivadas = row.stats_victorias_privadas === true;
  const empatesPrivadas   = row.stats_empates_privadas   === true;
  const derrotasPrivadas  = row.stats_derrotas_privadas  === true;

  const esMiembro = extras.esMiembro ?? false;
  const esCapitan = extras.esCapitan ?? false;
  const esAdmin   = extras.esAdmin ?? false;
  const puedeVerTodo = esMiembro || esCapitan || esAdmin;

  const stats = {
    victorias: (victoriasPrivadas && !puedeVerTodo) ? null : (statsRaw.victorias ?? 0),
    empates:   (empatesPrivadas   && !puedeVerTodo) ? null : (statsRaw.empates   ?? 0),
    derrotas:  (derrotasPrivadas  && !puedeVerTodo) ? null : (statsRaw.derrotas  ?? 0),
  };

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
    statsVictoriasPrivadas: victoriasPrivadas,
    statsEmpatesPrivadas: empatesPrivadas,
    statsDerrotasPrivadas: derrotasPrivadas,
    stats,
    hilos: row.hilos || [],
    capitanId: row.capitan_id,
    capitan: extras.capitan || null,
    totalMiembros: extras.totalMiembros ?? 0,
    totalSolicitudes: extras.totalSolicitudes ?? 0,
    esCapitan,
    esAdmin,
    esMiembro,
    esPremium: calcularEsPremium(row),
    // ⚡ Campos visuales
    cardColor: row.card_color || null,
    cardFoto: row.card_foto || null,
    iconoPersonalizado: row.icono_personalizado || null,
    heroColor: row.hero_color || null,
    heroFoto: row.hero_foto || null,
    marcoIcono: row.marco_icono || 'default',
    marcoColorIcono: row.marco_color_icono || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    marcoIcono: row.marco_icono || 'default',
    marcoColorIcono: row.marco_color_icono || null,
    formacion: row.formacion || [],
    formacionAbierta: row.formacion_abierta || false, // ⚡ NUEVO
    createdAt: row.created_at,
  };
  
}

async function obtenerGrupoOFallar(client, grupoId) {
  const { rows } = await client.query(`SELECT * FROM grupos WHERE id = $1`, [grupoId]);
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
  const { rows: capitanRows } = await client.query(`SELECT capitan_id FROM grupos WHERE id = $1`, [grupoId]);
  if (!capitanRows[0]) {
    const err = new Error('Grupo no encontrado');
    err.status = 404;
    throw err;
  }
  if (String(capitanRows[0].capitan_id) === String(usuarioId)) return;

  const { rows: adminRows } = await client.query(
    `SELECT 1 FROM grupo_miembros WHERE grupo_id = $1 AND usuario_id = $2 AND rol IN ('capitan', 'admin')`,
    [grupoId, usuarioId]
  );
  if (adminRows.length === 0) {
    const err = new Error('No tienes permiso para realizar esta acción');
    err.status = 403;
    throw err;
  }
}

/* =========================================================
   LISTAR GRUPOS
   ========================================================= */
export async function listarGrupos(filtros, usuarioId) {
  const { tipo, deporte, ciudad, tipoAcceso, soloMios, busqueda, page = 1, limit = 20 } = filtros;

  const condiciones = [];
  const valores = [];
  let i = 1;

  if (tipo) { condiciones.push(`g.tipo = $${i}`); valores.push(tipo); i++; }
  if (deporte) { condiciones.push(`g.deporte = $${i}`); valores.push(deporte); i++; }
  if (ciudad) { condiciones.push(`g.ciudad ILIKE $${i}`); valores.push(`%${ciudad}%`); i++; }
  if (tipoAcceso) { condiciones.push(`g.tipo_acceso = $${i}`); valores.push(tipoAcceso); i++; }
  if (busqueda) {
    condiciones.push(`(g.nombre ILIKE $${i} OR g.descripcion ILIKE $${i} OR g.deporte ILIKE $${i})`);
    valores.push(`%${busqueda}%`);
    i++;
  }
  if (soloMios === 'true') {
    condiciones.push(`(g.capitan_id = $${i} OR EXISTS (SELECT 1 FROM grupo_miembros gm WHERE gm.grupo_id = g.id AND gm.usuario_id = $${i}))`);
    valores.push(usuarioId);
    i++;
  }

  const bloqueados = await idsBloqueadosTotales(usuarioId);
  if (bloqueados.length > 0) {
    const placeholders = [];
    for (let j = 0; j < bloqueados.length; j++) {
      placeholders.push(`$${i}`);
      valores.push(bloqueados[j]);
      i++;
    }
    condiciones.push(`g.capitan_id NOT IN (${placeholders.join(', ')})`);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const { rows: countRows } = await pool.query(`SELECT COUNT(*)::int AS total FROM grupos g ${where}`, valores);
  const total = countRows[0].total;

  const offset = (page - 1) * limit;
  const parametrosFinales = [...valores, limit, offset, usuarioId];
  const idxLimit = i;
  const idxOffset = i + 1;
  const idxUser = i + 2;

  const { rows } = await pool.query(
    `SELECT g.*,
       u.id AS u_id, u.nombre AS u_nombre, u.username AS u_username, u.avatar AS u_avatar,
       u.plan AS cap_plan, u.premium_hasta AS cap_premium_hasta,
       (SELECT COUNT(*)::int FROM grupo_miembros WHERE grupo_id = g.id) AS total_miembros,
       (SELECT COUNT(*)::int FROM grupo_solicitudes WHERE grupo_id = g.id AND estado = 'pendiente') AS total_solicitudes,
       (g.capitan_id = $${idxUser}) AS es_capitan,
       EXISTS (SELECT 1 FROM grupo_miembros gm WHERE gm.grupo_id = g.id AND gm.usuario_id = $${idxUser} AND gm.rol = 'admin') AS es_admin,
       EXISTS (SELECT 1 FROM grupo_miembros gm WHERE gm.grupo_id = g.id AND gm.usuario_id = $${idxUser}) AS es_miembro
     FROM grupos g
     JOIN usuarios u ON u.id = g.capitan_id
     ${where}
     ORDER BY g.created_at DESC
     LIMIT $${idxLimit} OFFSET $${idxOffset}`,
    parametrosFinales
  );

  return {
    data: rows.map(row => formatearGrupo(row, {
      capitan: { id: row.u_id, nombre: row.u_nombre, username: row.u_username, avatar: row.u_avatar },
      totalMiembros: row.total_miembros,
      totalSolicitudes: row.total_solicitudes,
      esCapitan: row.es_capitan,
      esAdmin: row.es_admin,
      esMiembro: row.es_miembro,
    })),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/* =========================================================
   OBTENER UN GRUPO (detalle)
   ========================================================= */
export async function obtenerGrupo(grupoId, usuarioId) {
  const { rows } = await pool.query(
    `SELECT g.*,
       u.id AS u_id, u.nombre AS u_nombre, u.username AS u_username, u.avatar AS u_avatar,
       u.plan AS cap_plan, u.premium_hasta AS cap_premium_hasta
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

  if (await estanBloqueados(usuarioId, grupo.capitan_id)) {
    const err = new Error('Grupo no disponible');
    err.status = 403;
    throw err;
  }

  const esCapitan = String(grupo.capitan_id) === String(usuarioId);

  let miembros = [];
  let esAdmin = false;
  let esMiembro = false;

  const { rows: miembroRows } = await pool.query(
    `SELECT gm.usuario_id AS id, gm.rol, gm.posicion, gm.dorsal, gm.fecha_union, gm.stats, u.nombre, u.username, u.avatar
     FROM grupo_miembros gm
     JOIN usuarios u ON u.id = gm.usuario_id
     WHERE gm.grupo_id = $1
     ORDER BY CASE gm.rol WHEN 'capitan' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, gm.fecha_union ASC`,
    [grupoId]
  );

  esMiembro = miembroRows.some(m => String(m.id) === String(usuarioId));
  esAdmin = miembroRows.some(m => String(m.id) === String(usuarioId) && m.rol === 'admin');

  if (esMiembro || esCapitan || grupo.tipo_acceso === 'publico') {
    miembros = miembroRows;
  }

  let solicitudes = [];
  if (esCapitan || esAdmin) {
    const { rows: solRows } = await pool.query(
      `SELECT gs.id, gs.usuario_id, gs.estado, gs.created_at AS fecha, u.nombre, u.username, u.avatar
       FROM grupo_solicitudes gs
       JOIN usuarios u ON u.id = gs.usuario_id
       WHERE gs.grupo_id = $1 AND gs.estado = 'pendiente'
       ORDER BY gs.created_at ASC`,
      [grupoId]
    );
    const bloqueadosCtx = await idsBloqueadosTotales(usuarioId);
    solicitudes = solRows.filter(s => !bloqueadosCtx.includes(s.usuario_id));
  }

  let miSolicitudPendiente = false;
  if (!esMiembro && !esCapitan) {
    const { rows: miSolRows } = await pool.query(
      `SELECT 1 FROM grupo_solicitudes WHERE grupo_id = $1 AND usuario_id = $2 AND estado = 'pendiente'`,
      [grupoId, usuarioId]
    );
    miSolicitudPendiente = miSolRows.length > 0;
  }

  return {
    ...formatearGrupo(grupo, {
      capitan: { id: grupo.u_id, nombre: grupo.u_nombre, username: grupo.u_username, avatar: grupo.u_avatar },
      totalMiembros: miembroRows.length,
      totalSolicitudes: solicitudes.length,
      esCapitan,
      esAdmin,
      esMiembro,
    }),
    miembros,
    solicitudes,
    miSolicitudPendiente,
  };
}

/* =========================================================
   CREAR GRUPO
   ========================================================= */
export async function crearGrupo(datos, usuarioId) {
  const { 
    tipo, nombre, escudo, deporte, ciudad, descripcion, tipoAcceso,
    cardColor, cardFoto, iconoPersonalizado, heroColor, heroFoto,
    marcoIcono, marcoColorIcono // ⚡ NUEVOS
  } = datos;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ⚡ VALIDACIÓN DE LÍMITES POR PLAN
    const { rows: uRows } = await client.query(
      'SELECT plan, premium_hasta FROM usuarios WHERE id = $1',
      [usuarioId]
    );
    
    const esPrem = calcularEsPremium(uRows[0] || {});

    if (!esPrem) {
      const { rows: countRows } = await client.query(
        'SELECT COUNT(*)::int AS total FROM grupos WHERE capitan_id = $1 AND tipo = $2',
        [usuarioId, tipo]
      );
      const totalActual = countRows[0].total;

      if (tipo === 'equipo' && totalActual >= 2) {
        const err = new Error('Alcanzaste el límite de 2 equipos para el plan Básico. Pasate a Premium para crear más.');
        err.status = 403;
        throw err;
      }

      if (tipo === 'comunidad' && totalActual >= 1) {
        const err = new Error('Alcanzaste el límite de 1 comunidad para el plan Básico. Pasate a Premium para crear más.');
        err.status = 403;
        throw err;
      }

      // ⚡ Bloquear fotos, ícono custom y marcos
      if (
        cardFoto ||
        heroFoto ||
        iconoPersonalizado ||
        (marcoIcono && marcoIcono !== 'default') ||
        (marcoColorIcono != null)
      ) {
        const err = new Error('La personalización visual (fotos, ícono y marcos) es exclusiva del plan Premium.');
        err.status = 403;
        throw err;
      }
    }
    // ⚡ FIN VALIDACIÓN

    const { rows: yaExiste } = await client.query(
      `SELECT 1 FROM grupos WHERE LOWER(nombre) = LOWER($1) AND tipo = $2 AND capitan_id = $3`,
      [nombre, tipo, usuarioId]
    );

    if (yaExiste.length > 0) {
      const err = new Error('Ya tienes un grupo con ese nombre');
      err.status = 409;
      throw err;
    }

    /* ⚡ FIX: agregadas columnas marco_icono y marco_color_icono */
    const { rows } = await client.query(
      `INSERT INTO grupos (
        tipo, nombre, escudo, deporte, ciudad, descripcion, tipo_acceso, capitan_id,
        card_color, card_foto, icono_personalizado, hero_color, hero_foto,
        marco_icono, marco_color_icono
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        tipo, nombre, escudo || null, deporte, ciudad || null, descripcion || null, tipoAcceso || 'publico', usuarioId,
        cardColor || null, cardFoto || null, iconoPersonalizado || null,
        heroColor || null, heroFoto || null,
        marcoIcono || 'default', marcoColorIcono || null, // ⚡ NUEVOS
      ]
    );

    const grupo = rows[0];

    await client.query(
      `INSERT INTO grupo_miembros (grupo_id, usuario_id, rol) VALUES ($1, $2, 'capitan')`,
      [grupo.id, usuarioId]
    );

    await crearCanalParaGrupo(client, grupo, usuarioId);

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
   EDITAR GRUPO
   ========================================================= */
export async function editarGrupo(grupoId, cambios, usuarioId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const grupo = await obtenerGrupoOFallar(client, grupoId);
    await verificarCapitanOAdmin(client, grupoId, usuarioId);

    /* ⚡ VALIDACIÓN PREMIUM PARA PERSONALIZACIÓN
       Ahora incluye marcos (excepto 'default') y marcoColorIcono */
    const pidePersonalizacionPremium =
      (cambios.cardFoto !== undefined && cambios.cardFoto !== null) ||
      (cambios.heroFoto !== undefined && cambios.heroFoto !== null) ||
      (cambios.iconoPersonalizado !== undefined && cambios.iconoPersonalizado !== null) ||
      (cambios.marcoIcono !== undefined && cambios.marcoIcono !== null && cambios.marcoIcono !== 'default') ||
      (cambios.marcoColorIcono !== undefined && cambios.marcoColorIcono !== null);

    if (pidePersonalizacionPremium) {
      const { rows: uRows } = await client.query(
        'SELECT plan, premium_hasta FROM usuarios WHERE id = $1',
        [grupo.capitan_id]
      );
      const esPrem = calcularEsPremium(uRows[0] || {});
      
      if (!esPrem) {
        const err = new Error('La personalización visual (fotos, ícono y marcos) es exclusiva del plan Premium.');
        err.status = 403;
        throw err;
      }
    }

    const permitidos = {
      nombre: 'nombre',
      escudo: 'escudo',
      deporte: 'deporte',
      ciudad: 'ciudad',
      descripcion: 'descripcion',
      tipoAcceso: 'tipo_acceso',
      statsPrivadas: 'stats_privadas',
      cardColor: 'card_color',
      cardFoto: 'card_foto',
      iconoPersonalizado: 'icono_personalizado',
      heroColor: 'hero_color',
      heroFoto: 'hero_foto',
      // ⚡ NUEVOS — antes faltaban acá
      marcoIcono: 'marco_icono',
      marcoColorIcono: 'marco_color_icono',
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
      `UPDATE grupos SET ${campos.join(', ')}, updated_at = NOW() WHERE id = $${i}`,
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
   EDITAR STATS
   ========================================================= */
export async function editarStats(grupoId, datos, usuarioId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const grupo = await obtenerGrupoOFallar(client, grupoId);
    await verificarCapitanOAdmin(client, grupoId, usuarioId);

    const { rows: uRows } = await client.query(
      'SELECT plan, premium_hasta FROM usuarios WHERE id = $1',
      [grupo.capitan_id]
    );
    const capPlan = uRows[0]?.plan;
    const capPremHasta = uRows[0]?.premium_hasta;
    const esPrem = capPlan === 'premium' && (!capPremHasta || new Date(capPremHasta) > new Date());

    if (!esPrem) {
      const err = new Error('La edición de estadísticas es exclusiva de equipos con plan Premium.');
      err.status = 403;
      throw err;
    }

    const stats = { victorias: datos.victorias, empates: datos.empates, derrotas: datos.derrotas };
    const camposFlags = [];
    const valoresFlags = [];
    let i = 1;

    if (datos.victoriasPrivadas !== undefined) { camposFlags.push(`stats_victorias_privadas = $${i}`); valoresFlags.push(datos.victoriasPrivadas); i++; }
    if (datos.empatesPrivadas !== undefined) { camposFlags.push(`stats_empates_privadas = $${i}`); valoresFlags.push(datos.empatesPrivadas); i++; }
    if (datos.derrotasPrivadas !== undefined) { camposFlags.push(`stats_derrotas_privadas = $${i}`); valoresFlags.push(datos.derrotasPrivadas); i++; }

    valoresFlags.push(JSON.stringify(stats), grupoId);

    await client.query(
      `UPDATE grupos SET stats = $${i}::jsonb ${camposFlags.length > 0 ? ', ' + camposFlags.join(', ') : ''}, updated_at = NOW() WHERE id = $${i + 1}`,
      valoresFlags
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
   ELIMINAR GRUPO
   ========================================================= */
/* =========================================================
   ELIMINAR GRUPO
   ========================================================= */
export async function eliminarGrupo(grupoId, usuarioId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const grupo = await obtenerGrupoOFallar(client, grupoId);
    verificarCapitan(grupo, usuarioId);
    
    // ⚡ NUEVO: Eliminar el canal de chat antes de borrar el grupo
    await client.query(
      `DELETE FROM canales WHERE ref_id = $1 AND tipo IN ('equipo', 'comunidad', 'grupo')`, 
      [grupoId]
    );
    
    await client.query(`DELETE FROM grupos WHERE id = $1`, [grupoId]);
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
   UNIRSE A UN GRUPO
   ========================================================= */
export async function unirseAGrupo(grupoId, usuarioId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const grupo = await obtenerGrupoOFallar(client, grupoId);
    if (await estanBloqueados(usuarioId, grupo.capitan_id)) {
      const err = new Error('No puedes unirte a este grupo'); err.status = 403; throw err;
    }
    const { rows: yaEsMiembro } = await client.query(`SELECT 1 FROM grupo_miembros WHERE grupo_id = $1 AND usuario_id = $2`, [grupoId, usuarioId]);
    if (yaEsMiembro.length > 0) { const err = new Error('Ya eres miembro de este grupo'); err.status = 409; throw err; }

    if (grupo.tipo_acceso === 'privado') {
      const { rows: yaSolicito } = await client.query(`SELECT 1 FROM grupo_solicitudes WHERE grupo_id = $1 AND usuario_id = $2 AND estado = 'pendiente'`, [grupoId, usuarioId]);
      if (yaSolicito.length > 0) { const err = new Error('Ya enviaste una solicitud a este grupo'); err.status = 409; throw err; }
      await client.query(
        `INSERT INTO grupo_solicitudes (grupo_id, usuario_id, estado) VALUES ($1, $2, 'pendiente')
         ON CONFLICT (grupo_id, usuario_id) DO UPDATE SET estado = 'pendiente', created_at = NOW()`,
        [grupoId, usuarioId]
      );
      await client.query('COMMIT');
      return { ok: true, tipo: 'solicitud', mensaje: 'Solicitud enviada' };
    }

    await client.query(`INSERT INTO grupo_miembros (grupo_id, usuario_id, rol) VALUES ($1, $2, 'miembro')`, [grupoId, usuarioId]);
    const canalId = `grupo-${grupoId}`;
    await agregarMiembroACanal(client, canalId, usuarioId);
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
    if (await estanBloqueados(usuarioId, grupo.capitan_id)) { const err = new Error('No puedes interactuar con este grupo'); err.status = 403; throw err; }
    if (String(grupo.capitan_id) === String(usuarioId)) { const err = new Error('El capitán no puede salir. Elimina el grupo si quieres cerrarlo.'); err.status = 400; throw err; }

    const { rowCount } = await client.query(`DELETE FROM grupo_miembros WHERE grupo_id = $1 AND usuario_id = $2`, [grupoId, usuarioId]);
    if (rowCount === 0) { const err = new Error('No eres miembro de este grupo'); err.status = 404; throw err; }
    const canalId = `grupo-${grupoId}`;
    await quitarMiembroDeCanal(client, canalId, usuarioId);
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
   CANCELAR SOLICITUD PENDIENTE
   ========================================================= */
export async function cancelarMiSolicitud(grupoId, usuarioId) {
  const { rowCount } = await pool.query(`DELETE FROM grupo_solicitudes WHERE grupo_id = $1 AND usuario_id = $2 AND estado = 'pendiente'`, [grupoId, usuarioId]);
  if (rowCount === 0) { const err = new Error('No tienes una solicitud pendiente en este grupo'); err.status = 404; throw err; }
  return { ok: true, mensaje: 'Solicitud cancelada' };
}

/* =========================================================
   GESTIONAR SOLICITUD
   ========================================================= */
export async function gestionarSolicitud(grupoId, usuarioId, solicitanteId, accion) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await obtenerGrupoOFallar(client, grupoId);
    await verificarCapitanOAdmin(client, grupoId, usuarioId);
    if (await estanBloqueados(usuarioId, solicitanteId)) { const err = new Error('No puedes gestionar solicitudes de este usuario'); err.status = 403; throw err; }

    const { rows } = await client.query(`SELECT * FROM grupo_solicitudes WHERE grupo_id = $1 AND usuario_id = $2 AND estado = 'pendiente'`, [grupoId, solicitanteId]);
    if (!rows[0]) { const err = new Error('No hay una solicitud pendiente de ese usuario'); err.status = 404; throw err; }

    if (accion === 'rechazar') {
      await client.query(`UPDATE grupo_solicitudes SET estado = 'rechazada', resuelta_en = NOW() WHERE grupo_id = $1 AND usuario_id = $2`, [grupoId, solicitanteId]);
      const { rows: datosGrupo } = await client.query(`SELECT nombre FROM grupos WHERE id = $1`, [grupoId]);
      if (datosGrupo[0]) await crearNotificacion(solicitanteId, 'rechazado', `Tu solicitud para unirte a ${datosGrupo[0].nombre} fue rechazada.`, `#/mi-equipo`);
      await client.query('COMMIT');
      return { ok: true, mensaje: 'Solicitud rechazada' };
    }

    await client.query(`UPDATE grupo_solicitudes SET estado = 'aceptada', resuelta_en = NOW() WHERE grupo_id = $1 AND usuario_id = $2`, [grupoId, solicitanteId]);
    await client.query(`INSERT INTO grupo_miembros (grupo_id, usuario_id, rol) VALUES ($1, $2, 'miembro') ON CONFLICT (grupo_id, usuario_id) DO NOTHING`, [grupoId, solicitanteId]);
    const canalId = `grupo-${grupoId}`;
    await agregarMiembroACanal(client, canalId, solicitanteId);
    const { rows: datosGrupo } = await client.query(`SELECT nombre FROM grupos WHERE id = $1`, [grupoId]);
    if (datosGrupo[0]) await crearNotificacion(solicitanteId, 'aprobado', `Tu solicitud para unirte a ${datosGrupo[0].nombre} fue aprobada.`, `#/mi-equipo`);
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
   EXPULSAR MIEMBRO
   ========================================================= */
export async function expulsarMiembro(grupoId, usuarioId, miembroId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const grupo = await obtenerGrupoOFallar(client, grupoId);
    await verificarCapitanOAdmin(client, grupoId, usuarioId);

    if (String(usuarioId) === String(miembroId)) { const err = new Error('No puedes expulsarte a ti mismo. Usá "Salir del equipo".'); err.status = 400; throw err; }
    if (String(grupo.capitan_id) === String(miembroId)) { const err = new Error('No puedes expulsar al capitán'); err.status = 400; throw err; }

    const soyCapitan = String(grupo.capitan_id) === String(usuarioId);
    if (!soyCapitan) {
      const { rows: targetRows } = await client.query(`SELECT rol FROM grupo_miembros WHERE grupo_id = $1 AND usuario_id = $2`, [grupoId, miembroId]);
      if (targetRows[0] && targetRows[0].rol === 'admin') { const err = new Error('No puedes expulsar a otro sub-capitán'); err.status = 403; throw err; }
    }

    const { rowCount } = await client.query(`DELETE FROM grupo_miembros WHERE grupo_id = $1 AND usuario_id = $2`, [grupoId, miembroId]);
    if (rowCount === 0) { const err = new Error('Ese usuario no es miembro del grupo'); err.status = 404; throw err; }
    const canalId = `grupo-${grupoId}`;
    await quitarMiembroDeCanal(client, canalId, miembroId);

    const { rows: datosGrupo } = await client.query(`SELECT nombre FROM grupos WHERE id = $1`, [grupoId]);
    if (datosGrupo[0]) await crearNotificacion(miembroId, 'expulsado', `Fuiste expulsado de ${datosGrupo[0].nombre} por el capitán.`, null);

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
   CAMBIAR ROL DE MIEMBRO
   ========================================================= */
export async function cambiarRolMiembro(grupoId, usuarioId, miembroId, nuevoRol) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const grupo = await obtenerGrupoOFallar(client, grupoId);
    verificarCapitan(grupo, usuarioId);

    if (String(grupo.capitan_id) === String(miembroId)) { const err = new Error('No puedes cambiar el rol del capitán'); err.status = 400; throw err; }
    if (nuevoRol === 'capitan') { const err = new Error('Usá "admin" o "miembro". El capitán no se puede cambiar desde acá.'); err.status = 400; throw err; }

    const { rowCount } = await client.query(`UPDATE grupo_miembros SET rol = $1 WHERE grupo_id = $2 AND usuario_id = $3`, [nuevoRol, grupoId, miembroId]);
    if (rowCount === 0) { const err = new Error('Ese usuario no es miembro del grupo'); err.status = 404; throw err; }

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
   LISTAR MIEMBROS
   ========================================================= */
export async function listarMiembros(grupoId, usuarioId) {
  const grupo = await obtenerGrupoOFallar(pool, grupoId);
  if (await estanBloqueados(usuarioId, grupo.capitan_id)) { const err = new Error('Grupo no disponible'); err.status = 403; throw err; }
  const { rows: miembroRows } = await pool.query(`SELECT 1 FROM grupo_miembros WHERE grupo_id = $1 AND usuario_id = $2`, [grupoId, usuarioId]);
  const esMiembro = miembroRows.length > 0;
  const esCapitan = String(grupo.capitan_id) === String(usuarioId);
  if (!esMiembro && !esCapitan) { const err = new Error('No tienes acceso a los miembros de este grupo'); err.status = 403; throw err; }

  const { rows } = await pool.query(
    `SELECT gm.usuario_id AS id, gm.rol, gm.posicion, gm.dorsal, gm.fecha_union, u.nombre, u.username, u.avatar, u.ciudad
     FROM grupo_miembros gm
     JOIN usuarios u ON u.id = gm.usuario_id
     WHERE gm.grupo_id = $1
     ORDER BY CASE gm.rol WHEN 'capitan' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, gm.fecha_union ASC`,
    [grupoId]
  );
  const bloqueados = await idsBloqueadosTotales(usuarioId);
  return rows.filter(r => !bloqueados.includes(r.id));
}

/* =========================================================
   LISTAR SOLICITUDES
   ========================================================= */
export async function listarSolicitudes(grupoId, usuarioId) {
  const grupo = await obtenerGrupoOFallar(pool, grupoId);
  if (await estanBloqueados(usuarioId, grupo.capitan_id)) { const err = new Error('Grupo no disponible'); err.status = 403; throw err; }
  const esCapitan = String(grupo.capitan_id) === String(usuarioId);
  if (!esCapitan) {
    const { rows: adminRows } = await pool.query(`SELECT 1 FROM grupo_miembros WHERE grupo_id = $1 AND usuario_id = $2 AND rol = 'admin'`, [grupoId, usuarioId]);
    if (adminRows.length === 0) { const err = new Error('Solo el capitán o admin puede ver las solicitudes'); err.status = 403; throw err; }
  }

  const { rows } = await pool.query(
    `SELECT gs.id, gs.usuario_id AS id_usuario, gs.estado, gs.created_at AS fecha, u.nombre, u.username, u.avatar, u.ciudad
     FROM grupo_solicitudes gs
     JOIN usuarios u ON u.id = gs.usuario_id
     WHERE gs.grupo_id = $1
     ORDER BY CASE gs.estado WHEN 'pendiente' THEN 1 ELSE 2 END, gs.created_at ASC`,
    [grupoId]
  );
  const bloqueados = await idsBloqueadosTotales(usuarioId);
  return rows.filter(r => !bloqueados.includes(r.id_usuario));
}

/* =========================================================
   HELPERS EXPORTADOS
   ========================================================= */

export async function esCapitanOAdminDeGrupo(grupoId, usuarioId) {
  const { rows } = await pool.query(`SELECT capitan_id FROM grupos WHERE id = $1`, [grupoId]);
  if (!rows[0]) return false;
  if (String(rows[0].capitan_id) === String(usuarioId)) return true;
  const { rows: adminRows } = await pool.query(`SELECT 1 FROM grupo_miembros WHERE grupo_id = $1 AND usuario_id = $2 AND rol IN ('capitan', 'admin')`, [grupoId, usuarioId]);
  return adminRows.length > 0;
}

export async function esMiembroDeGrupo(grupoId, usuarioId) {
  const { rows } = await pool.query(`SELECT 1 FROM grupo_miembros WHERE grupo_id = $1 AND usuario_id = $2`, [grupoId, usuarioId]);
  return rows.length > 0;
}

export async function obtenerGruposDondeSoyCapitanOAdmin(usuarioId, tipo = null) {
  const condiciones = [];
  const valores = [usuarioId];
  let i = 2;
  if (tipo) { condiciones.push(`g.tipo = $${i}`); valores.push(tipo); i++; }
  const where = condiciones.length > 0 ? `AND ${condiciones.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT g.*, (SELECT COUNT(*)::int FROM grupo_miembros WHERE grupo_id = g.id) AS total_miembros
     FROM grupos g
     WHERE (g.capitan_id = $1 OR EXISTS (SELECT 1 FROM grupo_miembros gm WHERE gm.grupo_id = g.id AND gm.usuario_id = $1 AND gm.rol IN ('capitan', 'admin')))
     ${where}
     ORDER BY g.created_at DESC`,
    valores
  );
  return rows;
}

export async function obtenerGruposDondeSoyMiembro(usuarioId, tipo = null) {
  const condiciones = [];
  const valores = [usuarioId];
  let i = 2;
  if (tipo) { condiciones.push(`g.tipo = $${i}`); valores.push(tipo); i++; }
  const bloqueados = await idsBloqueadosTotales(usuarioId);
  if (bloqueados.length > 0) {
    const placeholders = [];
    for (let j = 0; j < bloqueados.length; j++) { placeholders.push(`$${i}`); valores.push(bloqueados[j]); i++; }
    condiciones.push(`g.capitan_id NOT IN (${placeholders.join(', ')})`);
  }
  const whereConBloqueo = condiciones.length > 0 ? `AND ${condiciones.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT g.*, (SELECT COUNT(*)::int FROM grupo_miembros WHERE grupo_id = g.id) AS total_miembros
     FROM grupos g
     JOIN grupo_miembros gm ON gm.grupo_id = g.id
     WHERE gm.usuario_id = $1
     ${whereConBloqueo}
     ORDER BY g.created_at DESC`,
    valores
  );
  return rows;
}
/* =========================================================
   FORMACIÓN
   ========================================================= */
export async function editarFormacion(grupoId, formacion, usuarioId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const grupo = await obtenerGrupoOFallar(client, grupoId);
    
    // ⚡ VALIDACIÓN: Si está cerrada, solo Cap/Admin. Si está abierta, cualquiera.
    let esCapOAdmin = false;
    try {
      await verificarCapitanOAdmin(client, grupoId, usuarioId);
      esCapOAdmin = true;
    } catch (e) {
      esCapOAdmin = false;
    }

    if (!grupo.formacion_abierta && !esCapOAdmin) {
      const err = new Error('La edición de la formación está cerrada. Solo el capitán o sub-capitán pueden modificarla.');
      err.status = 403;
      throw err;
    }

    await client.query(
      `UPDATE grupos SET formacion = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(formacion), grupoId]
    );

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Formación guardada' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
/* =========================================================
   STATS POR JUGADOR
   ========================================================= */
export async function editarStatsJugador(grupoId, usuarioId, stats, autorId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await obtenerGrupoOFallar(client, grupoId);

    // Solo el propio jugador, o el capitán/admin pueden editar
    const esElMismo = String(usuarioId) === String(autorId);
    if (!esElMismo) {
      await verificarCapitanOAdmin(client, grupoId, autorId);
    }

    await client.query(
      `UPDATE grupo_miembros SET stats = $1::jsonb WHERE grupo_id = $2 AND usuario_id = $3`,
      [JSON.stringify(stats), grupoId, usuarioId]
    );

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Stats actualizadas' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
export async function editarFormacionAbierta(grupoId, formacionAbierta, usuarioId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await obtenerGrupoOFallar(client, grupoId);
    await verificarCapitanOAdmin(client, grupoId, usuarioId);

    await client.query(
      `UPDATE grupos SET formacion_abierta = $1, updated_at = NOW() WHERE id = $2`,
      [formacionAbierta, grupoId]
    );

    await client.query('COMMIT');
    return { ok: true, mensaje: 'Ajuste actualizado' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
/* =========================================================
   GENERAR LINK DE GRUPO
   ========================================================= */
export async function generarLinkGrupo(grupoId, usuarioId) {
  // Verificación directa sin transacciones para evitar el 500
  const { rows: grupoRows } = await pool.query('SELECT capitan_id FROM grupos WHERE id = $1', [grupoId]);
  if (!grupoRows[0]) {
    const err = new Error('Grupo no encontrado'); err.status = 404; throw err;
  }

  const esCapitan = String(grupoRows[0].capitan_id) === String(usuarioId);
  if (!esCapitan) {
    const { rows: adminRows } = await pool.query(
      `SELECT 1 FROM grupo_miembros WHERE grupo_id = $1 AND usuario_id = $2 AND rol IN ('capitan', 'admin')`,
      [grupoId, usuarioId]
    );
    if (adminRows.length === 0) {
      const err = new Error('Solo el capitán o admin puede generar el link'); err.status = 403; throw err;
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO invitaciones_links (tipo, referencia_id, creador_id) 
     VALUES ('grupo', $1, $2) RETURNING token`,
    [grupoId, usuarioId]
  );
  return { token: rows[0].token };
}

/* =========================================================
   UNIRSE POR LINK (Auto-unión)
   ========================================================= */
export async function unirsePorLink(token, usuarioId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { rows: inv } = await client.query(
      `SELECT referencia_id FROM invitaciones_links WHERE token = $1 AND tipo = 'grupo'`,
      [token]
    );

    if (!inv[0]) {
      const err = new Error('Link de invitación inválido o expirado');
      err.status = 404;
      throw err;
    }

    const grupoId = inv[0].referencia_id;
    const grupo = await obtenerGrupoOFallar(client, grupoId);

    // Verificar bloqueos
    if (await estanBloqueados(usuarioId, grupo.capitan_id)) {
      const err = new Error('No puedes unirte a este grupo'); err.status = 403; throw err;
    }

    // Verificar si ya es miembro
    const { rows: yaEsMiembro } = await client.query(
      `SELECT 1 FROM grupo_miembros WHERE grupo_id = $1 AND usuario_id = $2`, 
      [grupoId, usuarioId]
    );
    if (yaEsMiembro.length > 0) {
      await client.query('COMMIT');
      return { ok: true, mensaje: 'Ya eres miembro de este grupo', yaEraMiembro: true, grupoId: grupoId, grupoNombre: grupo.nombre };
    }

    // Unir directamente (ignorando si es privado, porque tiene el link)
    await client.query(
      `INSERT INTO grupo_miembros (grupo_id, usuario_id, rol) VALUES ($1, $2, 'miembro')`, 
      [grupoId, usuarioId]
    );
    
    // Agregar al canal de chat
    const canalId = `grupo-${grupoId}`;
    await agregarMiembroACanal(client, canalId, usuarioId);

    // Notificar al capitán
    const { rows: user } = await client.query(`SELECT nombre FROM usuarios WHERE id = $1`, [usuarioId]);
    await crearNotificacion(
      grupo.capitan_id,
      'aprobado',
      `${user[0].nombre} se unió a tu grupo ${grupo.nombre} mediante un link de invitación.`,
      `#/mi-equipo`
    );

    await client.query('COMMIT');
    return { ok: true, mensaje: '¡Te uniste al grupo exitosamente!', grupoId: grupoId, grupoNombre: grupo.nombre };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   INVITAR AMIGO A GRUPO (Desde la lista de amigos)
   ========================================================= */
export async function invitarAmigoAGrupo(grupoId, amigoId, usuarioId) {
  await obtenerGrupoOFallar(pool, grupoId);
  await verificarCapitanOAdmin(pool, grupoId, usuarioId);

  // Verificar si ya es miembro
  const { rows: yaEsMiembro } = await pool.query(
    `SELECT 1 FROM grupo_miembros WHERE grupo_id = $1 AND usuario_id = $2`, 
    [grupoId, amigoId]
  );
  if (yaEsMiembro.length > 0) {
    const err = new Error('Ese usuario ya es miembro del grupo'); err.status = 400; throw err;
  }

  const { rows: grupoRows } = await pool.query(`SELECT nombre FROM grupos WHERE id = $1`, [grupoId]);
  const { rows: userRows } = await pool.query(`SELECT nombre FROM usuarios WHERE id = $1`, [usuarioId]);

  // Enviar notificación al amigo
  await crearNotificacion(
    amigoId,
    'invitacion_grupo',
    `${userRows[0].nombre} te invitó a unirte al grupo ${grupoRows[0].nombre}`,
    `#/mi-equipo` // El frontend puede leer el ID desde aquí si se mejora a futuro
  );

  return { ok: true, mensaje: 'Invitación enviada' };
}