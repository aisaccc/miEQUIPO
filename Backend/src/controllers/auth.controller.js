/* =========================================================
   auth.controller.js — Manejo de req/res de autenticación
   =========================================================
   Los controllers SOLO:
   - Extraen datos de req
   - Llaman al service
   - Devuelven res
   
   La lógica de negocio vive en services/auth.service.js
*/

import * as authService from '../services/auth.service.js';
import { validar } from '../validators/index.js';
import {
  schemaRegistro,
  schemaLogin,
  schemaVerificarEmail,
  schemaRefresh,
} from '../validators/auth.schema.js';

/* =========================================================
   HELPERS
   ========================================================= */

/**
 * Extrae metadata del request (user-agent + IP).
 * Se guarda en la sesión para poder listar dispositivos después.
 */
function getMeta(req) {
  return {
    userAgent: req.headers['user-agent'] || null,
    ip: req.ip || req.socket?.remoteAddress || null,
  };
}

/* =========================================================
   POST /api/auth/registro
   ========================================================= */
export async function registro(req, res, next) {
  try {
    const datos = validar(schemaRegistro, req.body);
    const resultado = await authService.registrarUsuario(datos, getMeta(req));

    res.status(201).json({
      mensaje: 'Usuario registrado correctamente. Revisá tu email para verificar tu cuenta.',
      usuario: resultado.usuario,
      accessToken: resultado.accessToken,
      refreshToken: resultado.refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/auth/login
   ========================================================= */
export async function login(req, res, next) {
  try {
    const datos = validar(schemaLogin, req.body);
    const resultado = await authService.loginUsuario(datos, getMeta(req));

    res.json({
      mensaje: 'Sesión iniciada correctamente',
      usuario: resultado.usuario,
      accessToken: resultado.accessToken,
      refreshToken: resultado.refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/auth/refresh
   ========================================================= */
export async function refresh(req, res, next) {
  try {
    const datos = validar(schemaRefresh, req.body);

    const resultado = await authService.refrescarTokens(datos.refreshToken, getMeta(req));

    res.json({
      usuario: resultado.usuario,
      accessToken: resultado.accessToken,
      refreshToken: resultado.refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/auth/logout
   ========================================================= */
export async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body || {};

    await authService.cerrarSesion(refreshToken);

    res.json({ ok: true, mensaje: 'Sesión cerrada' });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/auth/logout-all
   =========================================================
   Requiere auth. Cierra TODAS las sesiones del usuario actual.
*/
export async function logoutAll(req, res, next) {
  try {
    await authService.cerrarTodasLasSesiones(req.usuario.id);

    res.json({ ok: true, mensaje: 'Todas las sesiones cerradas' });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/auth/me
   =========================================================
   Requiere auth. Devuelve el usuario actual.
*/
export async function me(req, res, next) {
  try {
    const usuario = await authService.obtenerUsuarioPorId(req.usuario.id);
    res.json({ usuario });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/auth/verificar-email
   ========================================================= */
export async function verificarEmail(req, res, next) {
  try {
    const datos = validar(schemaVerificarEmail, req.body);
    const resultado = await authService.verificarEmail(datos.token);

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}