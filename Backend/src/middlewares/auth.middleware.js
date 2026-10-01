/* =========================================================
   auth.middleware.js — Verificación de JWT
   =========================================================
   Uso:
     router.get('/ruta-protegida', requiereAuth, controller)
   
   Si el token es válido:
     req.usuario = { id, username }
   
   Si no:
     401 Unauthorized
*/

import { verificarAccessToken } from '../utils/jwt.js';
import { pool } from '../config/db.js';

/* =========================================================
   MIDDLEWARE PRINCIPAL: requiereAuth
   ========================================================= */
export async function requiereAuth(req, res, next) {
  try {
    const header = req.headers.authorization;

    // 1. Verificar que venga el header
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No autenticado',
        mensaje: 'Falta el token de acceso',
      });
    }

    // 2. Extraer el token
    const token = header.slice(7).trim();
    if (!token) {
      return res.status(401).json({
        error: 'No autenticado',
        mensaje: 'Token vacío',
      });
    }

    // 3. Verificar firma y expiración
    const payload = verificarAccessToken(token);
    if (!payload) {
      return res.status(401).json({
        error: 'No autenticado',
        mensaje: 'Token inválido o expirado',
      });
    }

    // 4. Verificar que el usuario siga existiendo y activo
    const { rows } = await pool.query(
      `SELECT id, username, activo
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

    // 5. Inyectar usuario en el request
    req.usuario = {
      id: usuario.id,
      username: usuario.username,
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
   =========================================================
   Si viene token → valida y pone req.usuario.
   Si no viene    → sigue igual, req.usuario = null.
   Útil para rutas públicas que cambian según si estás logueado.
*/
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
      `SELECT id, username, activo
       FROM usuarios
       WHERE id = $1`,
      [payload.sub]
    );

    const usuario = rows[0];

    req.usuario = usuario && usuario.activo
      ? { id: usuario.id, username: usuario.username }
      : null;

    next();
  } catch (err) {
    req.usuario = null;
    next();
  }
}