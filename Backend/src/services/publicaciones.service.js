import { pool } from '../config/db.js';
import { estanBloqueados, idsBloqueadosTotales } from '../utils/bloqueos.js';

/* =========================================================
   HELPERS
   ========================================================= */

/* =========================================================
   HELPERS DE LÍMITES DE PLAN
   ========================================================= */

function contarFotosEnPub(imagenStr) {
  if (!imagenStr) return 0;
  try {
    const arr = JSON.parse(imagenStr);
    if (Array.isArray(arr) && arr.length > 0) return arr.length;
  } catch (e) {
    // Si falla el parse, asumimos Base64 simple (retrocompatibilidad)
  }
  return 1;
}

async function validarLimitePerfil(client, usuarioId, cantidadNuevas) {
  if (cantidadNuevas === 0) return;

  const { rows: uRows } = await client.query(
    'SELECT plan, premium_hasta, perfil_ciclo_inicio, perfil_fotos_usadas FROM usuarios WHERE id = $1',
    [usuarioId]
  );
  const u = uRows[0];
  if (!u) return;

  const esPrem = u.plan === 'premium' && (!u.premium_hasta || new Date(u.premium_hasta) > new Date());
  if (esPrem) return; // Ilimitado

  const DIAS_CICLO = 30;
  const MILIS_DIA = 24 * 60 * 60 * 1000;
  const ahora = new Date();
  let cicloInicio = u.perfil_ciclo_inicio ? new Date(u.perfil_ciclo_inicio) : null;
  let usadas = u.perfil_fotos_usadas || 0;

  // Si no hay ciclo o ya pasaron 30 días, reiniciar
  if (!cicloInicio || (ahora - cicloInicio) > (DIAS_CICLO * MILIS_DIA)) {
    cicloInicio = ahora;
    usadas = 0;
    await client.query(
      'UPDATE usuarios SET perfil_ciclo_inicio = $1, perfil_fotos_usadas = 0 WHERE id = $2',
      [cicloInicio, usuarioId]
    );
  }

  if (usadas + cantidadNuevas > 3) {
    const err = new Error(`Límite de 3 fotos por ciclo alcanzado. Ya usaste ${usadas}. Pasate a Premium para fotos ilimitadas.`);
    err.status = 403;
    throw err;
  }

  await client.query(
    'UPDATE usuarios SET perfil_fotos_usadas = perfil_fotos_usadas + $1 WHERE id = $2',
    [cantidadNuevas, usuarioId]
  );
}

async function validarLimiteGrupo(client, grupoId, cantidadNuevas) {
  if (cantidadNuevas === 0) return;

  const { rows: gRows } = await client.query(
    `SELECT g.capitan_id, u.plan, u.premium_hasta
     FROM grupos g JOIN usuarios u ON u.id = g.capitan_id
     WHERE g.id = $1`,
    [grupoId]
  );
  const g = gRows[0];
  if (!g) return;

  const esPrem = g.plan === 'premium' && (!g.premium_hasta || new Date(g.premium_hasta) > new Date());
  if (esPrem) return; // Ilimitado

  const { rows: pubs } = await client.query(
    `SELECT imagen FROM publicaciones WHERE grupo_id = $1 AND scope = 'grupo' AND imagen IS NOT NULL`,
    [grupoId]
  );
  let fotosActuales = 0;
  pubs.forEach(p => fotosActuales += contarFotosEnPub(p.imagen));

  if (fotosActuales + cantidadNuevas > 4) {
    const err = new Error(`Este grupo alcanzó el límite de 4 fotos concurrentes (el dueño es Básico). El dueño debe pasarse a Premium.`);
    err.status = 403;
    throw err;
  }
}
   

function formatearPublicacion(row, extras = {}) {
  return {
    id: row.id,
    tipo: row.tipo,
    scope: row.scope || 'perfil',
    grupoId: row.grupo_id || null,
    torneoId: row.torneo_id || null,
    privacidad: row.privacidad || 'publico',
    contenido: row.contenido,
    imagen: row.imagen,
    video: row.video,
    createdAt: row.created_at,
    autor: extras.autor || null,
    totalLikes: extras.totalLikes ?? 0,
    totalComentarios: extras.totalComentarios ?? 0,
    yoLikee: extras.yoLikee ?? false,
    grupo: extras.grupo || null,
    torneo: extras.torneo || null,
  };
}

function formatearComentario(row) {
  return {
    id: row.id,
    texto: row.texto,
    createdAt: row.created_at,
    autor: {
      id: row.autor_id,
      nombre: row.autor_nombre,
      username: row.autor_username,
      avatar: row.autor_avatar,
    },
  };
}

function sqlBasePublicacion(whereClause) {
  return `
    SELECT
      p.id, p.tipo, p.scope, p.grupo_id, p.torneo_id, p.privacidad,
      p.contenido, p.imagen, p.video, p.created_at,
      u.id AS autor_id, u.nombre AS autor_nombre,
      u.username AS autor_username, u.avatar AS autor_avatar,
      (SELECT COUNT(*)::int FROM publicacion_likes pl WHERE pl.publicacion_id = p.id) AS total_likes,
      (SELECT COUNT(*)::int FROM publicacion_comentarios pc WHERE pc.publicacion_id = p.id) AS total_comentarios,
      EXISTS (
        SELECT 1 FROM publicacion_likes pl
        WHERE pl.publicacion_id = p.id AND pl.usuario_id = $1
      ) AS yo_likee
    FROM publicaciones p
    JOIN usuarios u ON u.id = p.autor_id
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT 100
  `;
}

function parsearFilas(rows) {
  return rows.map(row => formatearPublicacion(row, {
    autor: {
      id: row.autor_id,
      nombre: row.autor_nombre,
      username: row.autor_username,
      avatar: row.autor_avatar,
    },
    totalLikes: row.total_likes,
    totalComentarios: row.total_comentarios,
    yoLikee: row.yo_likee,
  }));
}

/* =========================================================
   HELPERS DE PRIVACIDAD Y ROLES
   ========================================================= */

async function obtenerRolEnGrupo(grupoId, usuarioId) {
  const { rows: cap } = await pool.query(
    `SELECT capitan_id FROM grupos WHERE id = $1`,
    [grupoId]
  );
  if (!cap[0]) return { esCapitan: false, esAdmin: false, esMiembro: false };

  const esCapitan = String(cap[0].capitan_id) === String(usuarioId);
  const { rows: miem } = await pool.query(
    `SELECT rol FROM grupo_miembros
     WHERE grupo_id = $1 AND usuario_id = $2`,
    [grupoId, usuarioId]
  );
  const rol = miem[0]?.rol;
  const esAdmin = rol === 'admin';
  const esMiembro = miem.length > 0;

  return { esCapitan, esAdmin, esMiembro };
}

const sqlFiltroPrivacidadPerfil = `
  (
    p.privacidad = 'publico'
    OR p.autor_id = $1
    OR (
      p.privacidad = 'amigos' AND EXISTS (
        SELECT 1 FROM amistades a
        WHERE a.estado = 'aceptada'
        AND (
          (a.usuario_id = $1 AND a.amigo_id = p.autor_id)
          OR (a.usuario_id = p.autor_id AND a.amigo_id = $1)
        )
      )
    )
  )
`;

/* =========================================================
   LISTAR POR USUARIO
   ========================================================= */
export async function listarPorUsuario(usuarioId, usuarioActualId) {
  if (await estanBloqueados(usuarioId, usuarioActualId)) return [];

  const { rows } = await pool.query(
    sqlBasePublicacion(`
      WHERE p.autor_id = $2 
      AND p.scope = 'perfil'
      AND ${sqlFiltroPrivacidadPerfil}
    `),
    [usuarioActualId, usuarioId]
  );
  return parsearFilas(rows);
}

/* =========================================================
   LISTAR POR GRUPO
   ========================================================= */
export async function listarPorGrupo(grupoId, usuarioActualId) {
  const { esCapitan, esAdmin, esMiembro } = await obtenerRolEnGrupo(grupoId, usuarioActualId);

  const esStaff = esCapitan || esAdmin;
  const esMiembroReal = esMiembro || esCapitan;

  let filtroPrivacidad;
  if (esStaff) {
    filtroPrivacidad = `TRUE`;
  } else if (esMiembroReal) {
    filtroPrivacidad = `(p.privacidad IN ('publico', 'miembros') OR p.autor_id = $1)`;
  } else {
    filtroPrivacidad = `(p.privacidad = 'publico' OR p.autor_id = $1)`;
  }

  const { rows } = await pool.query(
    sqlBasePublicacion(`
      WHERE p.grupo_id = $2
        AND p.scope = 'grupo'
        AND ${filtroPrivacidad}
    `),
    [usuarioActualId, grupoId]
  );

  const bloqueados = await idsBloqueadosTotales(usuarioActualId);
  return parsearFilas(rows).filter(p => !bloqueados.includes(p.autor.id));
}

/* =========================================================
   LISTAR POR TORNEO
   ========================================================= */
export async function listarPorTorneo(torneoId, usuarioActualId) {
  const { rows: acceso } = await pool.query(`
    SELECT
      EXISTS(SELECT 1 FROM torneos t WHERE t.id = $1 AND t.organizador_id = $2) AS es_org,
      EXISTS(SELECT 1 FROM torneo_organizadores to2 WHERE to2.torneo_id = $1 AND to2.usuario_id = $2) AS es_suborg,
      EXISTS(
        SELECT 1 FROM torneo_equipos te
        LEFT JOIN grupo_miembros gm ON gm.grupo_id = te.equipo_id
        WHERE te.torneo_id = $1 AND (gm.usuario_id = $2 OR te.equipo_id = $2)
      ) AS es_participante,
      EXISTS(
        SELECT 1 FROM torneo_lista_espera tle
        LEFT JOIN grupo_miembros gm ON gm.grupo_id = tle.equipo_id
        WHERE tle.torneo_id = $1 AND (gm.usuario_id = $2 OR tle.equipo_id = $2) AND tle.estado = 'aceptado'
      ) AS es_participante_espera
  `, [torneoId, usuarioActualId]);

  const a = acceso[0];
  const esMiembro = a.es_org || a.es_suborg || a.es_participante || a.es_participante_espera;
  const filtroPrivacidad = esMiembro ? `TRUE` : `(p.privacidad = 'publico' OR p.autor_id = $1)`;

  const { rows } = await pool.query(
    sqlBasePublicacion(`
      WHERE p.torneo_id = $2
        AND p.scope = 'torneo'
        AND ${filtroPrivacidad}
    `),
    [usuarioActualId, torneoId]
  );

  const bloqueados = await idsBloqueadosTotales(usuarioActualId);
  return parsearFilas(rows).filter(p => !bloqueados.includes(p.autor.id));
}

/* =========================================================
   FEED GLOBAL
   ========================================================= */
export async function feedGlobal(usuarioActualId) {
  const filtroPrivacidad = `
    (
      (p.scope = 'perfil' AND (
        p.privacidad = 'publico'
        OR p.autor_id = $1
        OR (
          p.privacidad = 'amigos' AND EXISTS (
            SELECT 1 FROM amistades a
            WHERE a.estado = 'aceptada'
            AND (
              (a.usuario_id = $1 AND a.amigo_id = p.autor_id)
              OR (a.usuario_id = p.autor_id AND a.amigo_id = $1)
            )
          )
        )
      ))
      OR
      (p.scope = 'torneo' AND p.privacidad = 'publico')
      OR
      (p.scope = 'grupo' AND EXISTS (
        SELECT 1 FROM grupos g
        WHERE g.id = p.grupo_id AND (
          (g.tipo = 'equipo' AND p.privacidad = 'publico')
          OR
          (g.tipo = 'comunidad' AND (
            g.tipo_acceso = 'publico'
            OR (
              g.tipo_acceso = 'privado' AND (
                EXISTS (SELECT 1 FROM grupo_miembros gm WHERE gm.grupo_id = p.grupo_id AND gm.usuario_id = $1)
                OR g.capitan_id = $1
              )
            )
          ))
        )
      ))
    )
  `;

  const { rows } = await pool.query(
    sqlBasePublicacion(`WHERE ${filtroPrivacidad}`),
    [usuarioActualId]
  );

  const bloqueados = await idsBloqueadosTotales(usuarioActualId);
  const publicaciones = parsearFilas(rows).filter(p => !bloqueados.includes(p.autor.id));

  const idsTorneo = [...new Set(publicaciones.map(p => p.torneoId).filter(Boolean))];
  if (idsTorneo.length > 0) {
    const { rows: torneos } = await pool.query(
      `SELECT id, nombre, emoji, deporte FROM torneos WHERE id = ANY($1::uuid[])`,
      [idsTorneo]
    );
    const mapTorneos = new Map(torneos.map(t => [String(t.id), t]));
    publicaciones.forEach(p => {
      if (p.torneoId) {
        const t = mapTorneos.get(String(p.torneoId));
        if (t) p.torneo = { id: t.id, nombre: t.nombre, emoji: t.emoji, deporte: t.deporte };
      }
    });
  }

  const idsGrupo = [...new Set(publicaciones.map(p => p.grupoId).filter(Boolean))];
  if (idsGrupo.length > 0) {
    const { rows: grupos } = await pool.query(
      `SELECT id, nombre, escudo, tipo, deporte FROM grupos WHERE id = ANY($1::uuid[])`,
      [idsGrupo]
    );
    const mapGrupos = new Map(grupos.map(g => [String(g.id), g]));
    publicaciones.forEach(p => {
      if (p.grupoId) {
        const g = mapGrupos.get(String(p.grupoId));
        if (g) p.grupo = { id: g.id, nombre: g.nombre, escudo: g.escudo, tipo: g.tipo, deporte: g.deporte };
      }
    });
  }

  return publicaciones;
}

/* =========================================================
   CREAR
   ========================================================= */
export async function crear(usuarioId, datos) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fotosNuevas = contarFotosEnPub(datos.imagen);
    await validarLimitePerfil(client, usuarioId, fotosNuevas);

    const { rows } = await client.query(
      `INSERT INTO publicaciones (autor_id, tipo, scope, contenido, imagen, video, privacidad)
       VALUES ($1, $2, 'perfil', $3, $4, $5, $6)
       RETURNING id`,
      [usuarioId, datos.tipo || 'post', datos.contenido || null, datos.imagen || null, datos.video || null, datos.privacidad || 'publico']
    );
    await client.query('COMMIT');
    return { id: rows[0].id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function crearEnGrupo(grupoId, usuarioId, datos) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fotosNuevas = contarFotosEnPub(datos.imagen);
    await validarLimiteGrupo(client, grupoId, fotosNuevas);

    const { rows } = await client.query(
      `INSERT INTO publicaciones (autor_id, tipo, scope, grupo_id, contenido, imagen, video, privacidad)
       VALUES ($1, $2, 'grupo', $3, $4, $5, $6, $7)
       RETURNING id`,
      [usuarioId, datos.tipo || 'post', grupoId, datos.contenido || null, datos.imagen || null, datos.video || null, datos.privacidad || 'publico']
    );
    await client.query('COMMIT');
    return { id: rows[0].id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   OBTENER POR ID
   ========================================================= */
async function obtenerPublicacionOFallar(id) {
  const { rows } = await pool.query(`SELECT * FROM publicaciones WHERE id = $1`, [id]);
  if (!rows[0]) {
    const err = new Error('Publicación no encontrada');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

/* =========================================================
   EDITAR
   ========================================================= */
export async function editar(id, usuarioId, datos) {
  const pub = await obtenerPublicacionOFallar(id);
  if (String(pub.autor_id) !== String(usuarioId)) {
    const err = new Error('No tenés permiso para editar esta publicación');
    err.status = 403;
    throw err;
  }
  if (datos.contenido !== undefined) {
    await pool.query(
      `UPDATE publicaciones SET contenido = $1 WHERE id = $2`,
      [datos.contenido || null, id]
    );
  }
  return { ok: true };
}

/* =========================================================
   EDITAR PRIVACIDAD
   ========================================================= */
export async function editarPrivacidad(id, usuarioId, datos) {
  const pub = await obtenerPublicacionOFallar(id);
  
  if (pub.scope === 'perfil') {
    if (String(pub.autor_id) !== String(usuarioId)) {
      const err = new Error('No tenés permiso');
      err.status = 403;
      throw err;
    }
  } else if (pub.scope === 'grupo' && pub.grupo_id) {
    const { esCapitan, esAdmin } = await obtenerRolEnGrupo(pub.grupo_id, usuarioId);
    if (!esCapitan && !esAdmin && String(pub.autor_id) !== String(usuarioId)) {
      const err = new Error('Solo el capitán o sub-capitán puede cambiar la privacidad');
      err.status = 403;
      throw err;
    }
  } else {
    const err = new Error('No se puede cambiar la privacidad de esta publicación');
    err.status = 400;
    throw err;
  }

  await pool.query(
    `UPDATE publicaciones SET privacidad = $1 WHERE id = $2`,
    [datos.privacidad, id]
  );

  return { ok: true, privacidad: datos.privacidad };
}

/* =========================================================
   ELIMINAR
   ========================================================= */
export async function eliminar(id, usuarioId) {
  const pub = await obtenerPublicacionOFallar(id);
  const esAutor = String(pub.autor_id) === String(usuarioId);
  let puedeBorrar = esAutor;

  if (!esAutor && pub.scope === 'grupo' && pub.grupo_id) {
    const { esCapitan, esAdmin } = await obtenerRolEnGrupo(pub.grupo_id, usuarioId);
    puedeBorrar = esCapitan || esAdmin;
  }

  if (!puedeBorrar) {
    const err = new Error('No tenés permiso para eliminar esta publicación');
    err.status = 403;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Si es del perfil y tenía fotos, liberamos cupo del ciclo rodante
    if (pub.scope === 'perfil' && pub.imagen) {
      const fotosLiberadas = contarFotosEnPub(pub.imagen);
      if (fotosLiberadas > 0) {
        await client.query(
          'UPDATE usuarios SET perfil_fotos_usadas = GREATEST(0, perfil_fotos_usadas - $1) WHERE id = $2',
          [fotosLiberadas, pub.autor_id]
        );
      }
    }

    // Si es de grupo, no hace falta liberar cupo porque es concurrente
    await client.query(`DELETE FROM publicaciones WHERE id = $1`, [id]);
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* =========================================================
   TOGGLE LIKE
   ========================================================= */
export async function toggleLike(id, usuarioId) {
  await obtenerPublicacionOFallar(id);

  const { rows: existentes } = await pool.query(
    `SELECT 1 FROM publicacion_likes WHERE publicacion_id = $1 AND usuario_id = $2`,
    [id, usuarioId]
  );

  if (existentes.length > 0) {
    await pool.query(
      `DELETE FROM publicacion_likes WHERE publicacion_id = $1 AND usuario_id = $2`,
      [id, usuarioId]
    );
    return { yoLikee: false };
  }

  await pool.query(
    `INSERT INTO publicacion_likes (publicacion_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [id, usuarioId]
  );
  return { yoLikee: true };
}

/* =========================================================
   COMENTARIOS
   ========================================================= */
export async function listarComentarios(id) {
  await obtenerPublicacionOFallar(id);

  const { rows } = await pool.query(
    `SELECT
       c.id, c.texto, c.created_at, c.autor_id,
       u.nombre AS autor_nombre,
       u.username AS autor_username,
       u.avatar AS autor_avatar
     FROM publicacion_comentarios c
     JOIN usuarios u ON u.id = c.autor_id
     WHERE c.publicacion_id = $1
     ORDER BY c.created_at ASC`,
    [id]
  );

  return rows.map(formatearComentario);
}

export async function crearComentario(id, usuarioId, texto) {
  await obtenerPublicacionOFallar(id);

  const { rows } = await pool.query(
    `INSERT INTO publicacion_comentarios (publicacion_id, autor_id, texto)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [id, usuarioId, texto]
  );

  return { id: rows[0].id };
}