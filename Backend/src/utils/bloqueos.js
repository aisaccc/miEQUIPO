import { pool } from '../config/db.js';

export async function estanBloqueados(usuarioA, usuarioB) {
  if (String(usuarioA) === String(usuarioB)) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM usuarios_bloqueados
     WHERE (usuario_id = $1 AND bloqueado_id = $2)
        OR (usuario_id = $2 AND bloqueado_id = $1)
     LIMIT 1`,
    [usuarioA, usuarioB]
  );
  return rows.length > 0;
}

export async function idsBloqueadosPorMi(usuarioId) {
  const { rows } = await pool.query(
    `SELECT bloqueado_id FROM usuarios_bloqueados WHERE usuario_id = $1`,
    [usuarioId]
  );
  return rows.map(r => r.bloqueado_id);
}

export async function idsQueMeBloquearon(usuarioId) {
  const { rows } = await pool.query(
    `SELECT usuario_id FROM usuarios_bloqueados WHERE bloqueado_id = $1`,
    [usuarioId]
  );
  return rows.map(r => r.usuario_id);
}

export async function idsBloqueadosTotales(usuarioId) {
  const b = await idsBloqueadosPorMi(usuarioId);
  const m = await idsQueMeBloquearon(usuarioId);
  return [...new Set([...b, ...m])];
}

export async function estadoBloqueo(usuarioActual, otroUsuario) {
  if (String(usuarioActual) === String(otroUsuario)) return 'ninguno';
  const { rows } = await pool.query(
    `SELECT usuario_id, bloqueado_id FROM usuarios_bloqueados
     WHERE (usuario_id = $1 AND bloqueado_id = $2)
        OR (usuario_id = $2 AND bloqueado_id = $1)`,
    [usuarioActual, otroUsuario]
  );
  if (rows.length === 0) return 'ninguno';
  const yoBloquee = rows.some(r => String(r.usuario_id) === String(usuarioActual));
  const meBloquearon = rows.some(r => String(r.usuario_id) === String(otroUsuario));
  if (yoBloquee && meBloquearon) return 'ambos';
  if (yoBloquee) return 'bloqueado_por_mi';
  return 'me_bloqueo';
}