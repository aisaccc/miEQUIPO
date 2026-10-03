/* =========================================================
   mensajes.controller.js — Manejo de req/res de mensajería
   =========================================================
   Los controllers SOLO:
   - Extraen datos de req
   - Llaman al service
   - Devuelven res
*/

import * as mensajesService from '../services/mensajes.service.js';
import { validar } from '../validators/index.js';
import {
  schemaCrearConversacion,
  schemaEnviarMensaje,
  schemaUuidParam,
} from '../validators/mensajes.schema.js';

/* =========================================================
   GET /api/mensajes/conversaciones
   ========================================================= */
export async function listarConversaciones(req, res, next) {
  try {
    const conversaciones = await mensajesService.listarConversaciones(req.usuario.id);
    res.json({ conversaciones });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/mensajes/conversaciones
   =========================================================
   Crea (o devuelve) la conversación entre el usuario autenticado
   y el usuario indicado en el body.
   */
export async function crearConversacion(req, res, next) {
  try {
    const datos = validar(schemaCrearConversacion, req.body);
    const conversacion = await mensajesService.crearObtenerConversacion(
      req.usuario.id,
      datos
    );
    res.status(201).json({
      mensaje: 'Conversación lista',
      conversacion,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/mensajes/conversaciones/:id
   ========================================================= */
export async function obtenerConversacion(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const conversacion = await mensajesService.obtenerConversacion(
      id,
      req.usuario.id
    );
    res.json({ conversacion });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/mensajes/conversaciones/:id/mensajes
   ========================================================= */
export async function listarMensajes(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const limit = Math.min(Number(req.query.limit) || 100, 200);

    const mensajes = await mensajesService.listarMensajes(
      id,
      req.usuario.id,
      { limit }
    );

    res.json({ mensajes });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/mensajes/conversaciones/:id/mensajes
   ========================================================= */
export async function enviarMensaje(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const { texto } = validar(schemaEnviarMensaje, req.body);

    const mensaje = await mensajesService.enviarMensaje(
      id,
      req.usuario.id,
      texto
    );

    res.status(201).json({
      mensaje: 'Mensaje enviado',
      data: mensaje,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/mensajes/conversaciones/:id/leidos
   =========================================================
   Marca todos los mensajes de la conversación como leídos por mí.
   */
export async function marcarLeidos(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await mensajesService.marcarLeidos(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   DELETE /api/mensajes/conversaciones/:id
   =========================================================
   Oculta la conversación para el usuario (soft delete).
   */
export async function ocultarConversacion(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await mensajesService.ocultarConversacion(
      id,
      req.usuario.id
    );
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/mensajes/no-leidos
   =========================================================
   Cuenta total de mensajes no leídos (para el badge del header).
   */
export async function contarNoLeidos(req, res, next) {
  try {
    const total = await mensajesService.contarNoLeidos(req.usuario.id);
    res.json({ total });
  } catch (err) {
    next(err);
  }
}