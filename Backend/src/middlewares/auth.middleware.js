import { verificarAccessToken } from '../utils/jwt.js';
import { pool } from '../config/db.js';

// ⚡ CACHÉ EN MEMORIA: Guarda los datos del usuario por 5 minutos
const cacheUsuarios = new Map();
const TIEMPO_CACHE_MS = 5 * 60 * 1000; // 5 minutos

function calcularEsPremium(plan, premiumHasta) {
  if (plan !== 'premium') return false;
  if (!premiumHasta) return true;
  return new Date(premiumHasta) > new Date();
}

async function obtenerUsuarioDeCacheOBD(usuarioId) {
  const ahora = Date.now();
  const enCache = cacheUsuarios.get(usuarioId);

  // Si está en caché y no expiró, lo devolvemos
  if (enCache && (ahora - enCache.timestamp) < TIEMPO_CACHE_MS) {
    return enCache.data;
  }

  // Si no, consultamos la BD
  const { rows } = await pool.query(
    `SELECT id, username, activo, plan, premium_hasta 
     FROM usuarios WHERE id = $1`,
    [usuarioId]
  );

  const usuario = rows[0];
  if (!usuario) return null;

  // Lo guardamos en caché
  const dataParaCache = {
    id: usuario.id,
    username: usuario.username,
    activo: usuario.activo,
    plan: usuario.plan || 'basico',
    premiumHasta: usuario.premium_hasta,
    esPremium: calcularEsPremium(usuario.plan, usuario.premium_hasta),
  };

  cacheUsuarios.set(usuarioId, { data: dataParaCache, timestamp: ahora });
  return dataParaCache;
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

    const usuario = await obtenerUsuarioDeCacheOBD(payload.sub);

    if (!usuario) {
      return res.status(401).json({ error: 'No autenticado', mensaje: 'Usuario no encontrado' });
    }
    if (!usuario.activo) {
      return res.status(403).json({ error: 'Cuenta desactivada', mensaje: 'Tu cuenta está desactivada' });
    }

    req.usuario = usuario;
    next();
  } catch (err) {
    console.error('[auth.middleware]', err);
    return res.status(500).json({ error: 'Error interno', mensaje: 'Error de autenticación' });
  }
}

// authOpcional se queda igual (o puedes usar la misma caché si quieres)
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

    const usuario = await obtenerUsuarioDeCacheOBD(payload.sub);
    req.usuario = usuario && usuario.activo ? usuario : null;
    next();
  } catch (err) {
    req.usuario = null;
    next();
  }
}