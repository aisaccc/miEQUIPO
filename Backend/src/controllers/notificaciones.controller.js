/* =========================================================
   notificaciones.controller.js — Manejo de req/res
   =========================================================
   Los controllers SOLO:
   - Extraen datos de req
   - Llaman al service
   - Devuelven res
   */

import * as notificacionesService from '../services/notificaciones.service.js';
import { validar } from '../validators/index.js';
import {
  schemaListarNotificaciones,
  schemaUuidParam,
} from '../validators/notificaciones.schema.js';

/* =========================================================
   GET /api/notificaciones
   ========================================================= */
export async function listar(req, res, next) {
  try {
    const filtros = validar(schemaListarNotificaciones, req.query);
    const resultado = await notificacionesService.listarNotificaciones(
      req.usuario.id,
      filtros
    );
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/notificaciones/no-leidas
   ========================================================= */
export async function contarNoLeidas(req, res, next) {
  try {
    const total = await notificacionesService.contarNoLeidas(req.usuario.id);
    res.json({ total });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/notificaciones/:id/leida
   ========================================================= */
export async function marcarLeida(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const notificacion = await notificacionesService.marcarLeida(
      id,
      req.usuario.id
    );
    res.json({
      mensaje: 'Notificación marcada como leída',
      notificacion,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/notificaciones/leidas
   ========================================================= */
export async function marcarTodasLeidas(req, res, next) {
  try {
    const resultado = await notificacionesService.marcarTodasLeidas(req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   DELETE /api/notificaciones/:id
   ========================================================= */
export async function eliminar(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await notificacionesService.eliminarNotificacion(
      id,
      req.usuario.id
    );
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   DELETE /api/notificaciones/leidas
   =========================================================
   Elimina todas las notificaciones leídas del usuario.
   */
export async function eliminarLeidas(req, res, next) {
  try {
    const resultado = await notificacionesService.eliminarLeidas(req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}