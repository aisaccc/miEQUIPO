import { verificarAccessToken } from '../utils/jwt.js';
import { pool } from '../config/db.js';

function calcularEsPremium(plan, premiumHasta) {
  if (plan !== 'premium') return false;
  if (!premiumHasta) return true;
  return new Date(premiumHasta) > new Date();
}

async function obtenerUsuarioDeCacheOBD(usuarioId, sesionId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.activo, u.plan, u.premium_hasta
     FROM usuarios u
     JOIN sesiones s ON s.usuario_id = u.id
     WHERE u.id = $1
       AND s.id = $2
       AND s.revocado = FALSE
       AND s.expires_at > NOW()`,
    [usuarioId, sesionId]
  );

  const usuario = rows[0];

  if (!usuario) return null;

  return {
    id: usuario.id,
    username: usuario.username,
    activo: usuario.activo,
    plan: usuario.plan || 'basico',
    premiumHasta: usuario.premium_hasta,
    esPremium: calcularEsPremium(
      usuario.plan,
      usuario.premium_hasta
    ),
  };
}

export async function requiereAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autenticado', mensaje: 'Falta el token' });
    }

    const token = header.slice(7).trim();
    const payload = verificarAccessToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'No autenticado', mensaje: 'Token inválido' });
    }

    const usuario = await obtenerUsuarioDeCacheOBD(payload.sub, payload.sid);

    if (!usuario) {
      return res.status(401).json({ error: 'No autenticado', mensaje: 'Sesión inválida o expirada' });
    }
    if (!usuario.activo) {
      return res.status(403).json({ error: 'Cuenta desactivada', mensaje: 'Tu cuenta está desactivada' });
    }

    req.usuario = usuario;
    next();
  } catch (err) {
    console.error('[auth.middleware]', { name: err.name, code: err.code });
    return res.status(500).json({ error: 'Error interno', mensaje: 'Error de autenticación' });
  }
}

// La autenticación opcional comprueba también la sesión en PostgreSQL.
export async function authOpcional(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      req.usuario = null;
      return next();
    }
    const token = header.slice(7).trim();
    const payload = verificarAccessToken(token);
    if (!payload) {
      req.usuario = null;
      return next();
    }

    const usuario = await obtenerUsuarioDeCacheOBD(payload.sub, payload.sid);
    req.usuario = usuario && usuario.activo ? usuario : null;
    next();
  } catch (err) {
    req.usuario = null;
    next();
  }
}