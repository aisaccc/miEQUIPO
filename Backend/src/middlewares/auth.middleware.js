/* =========================================================
   auth.middleware.js — Verificación de JWT
   =========================================================
   Uso:
     router.get('/ruta-protegida', requiereAuth, controller)
   
   Si el token es válido:
     req.usuario = { id, username, plan, premiumHasta, esPremium }
   Si no:
     401 Unauthorized
*/

import { verificarAccessToken } from '../utils/jwt.js';
import { pool } from '../config/db.js';

/* Helper: calcula premium real (considera vencimiento) */
function calcularEsPremium(plan, premiumHasta) {
  if (plan !== 'premium') return false;
  if (!premiumHasta) return true; // perpetuo
  return new Date(premiumHasta) > new Date();
}

/* =========================================================
   MIDDLEWARE PRINCIPAL: requiereAuth
   ========================================================= */
export async function requiereAuth(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No autenticado',
        mensaje: 'Falta el token de acceso',
      });
    }

    const token = header.slice(7).trim();
    if (!token) {
      return res.status(401).json({
        error: 'No autenticado',
        mensaje: 'Token vacío',
      });
    }

    const payload = verificarAccessToken(token);
    if (!payload) {
      return res.status(401).json({
        error: 'No autenticado',
        mensaje: 'Token inválido o expirado',
      });
    }

    // ⚡ Ahora traemos también plan + premium_hasta
    const { rows } = await pool.query(
      `SELECT id, username, activo, plan, premium_hasta
       FROM usuarios
       WHERE id = $1`,
      [payload.sub]
    );

    const usuario = rows[0];

    if (!usuario) {
      return res.status(401).json({
        error: 'No autenticado',
        mensaje: 'Usuario no encontrado',
      });
    }

    if (!usuario.activo) {
      return res.status(403).json({
        error: 'Cuenta desactivada',
        mensaje: 'Tu cuenta está desactivada',
      });
    }

    req.usuario = {
      id: usuario.id,
      username: usuario.username,
      plan: usuario.plan || 'basico',
      premiumHasta: usuario.premium_hasta,
      esPremium: calcularEsPremium(usuario.plan, usuario.premium_hasta),
    };

    next();
  } catch (err) {
    console.error('[auth.middleware]', err);
    return res.status(500).json({
      error: 'Error interno',
      mensaje: 'Error verificando autenticación',
    });
  }
}

/* =========================================================
   MIDDLEWARE OPCIONAL: authOpcional
   ========================================================= */
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

    const { rows } = await pool.query(
      `SELECT id, username, activo, plan, premium_hasta
       FROM usuarios
       WHERE id = $1`,
      [payload.sub]
    );

    const usuario = rows[0];

    req.usuario = usuario && usuario.activo
      ? {
          id: usuario.id,
          username: usuario.username,
          plan: usuario.plan || 'basico',
          premiumHasta: usuario.premium_hasta,
          esPremium: calcularEsPremium(usuario.plan, usuario.premium_hasta),
        }
      : null;

    next();
  } catch (err) {
    req.usuario = null;
    next();
  }
}