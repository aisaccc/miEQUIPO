/* =========================================================
   mensajes.controller.js — Manejo de req/res de mensajería
   ========================================================= */

import * as mensajesService from '../services/mensajes.service.js';
import { validar } from '../validators/index.js';
import {
  schemaCrearConversacion,
  schemaEnviarMensaje,
  schemaUuidParam,
  schemaCanalIdParam,
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
   ========================================================= */
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
    const { texto, imagen } = validar(schemaEnviarMensaje, req.body);

    const mensaje = await mensajesService.enviarMensaje(
      id,
      req.usuario.id,
      texto || null,
      imagen || null
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
   ========================================================= */
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
   ========================================================= */
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
   ========================================================= */
export async function contarNoLeidos(req, res, next) {
  try {
    const total = await mensajesService.contarNoLeidos(req.usuario.id);
    res.json({ total });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/mensajes/canales
   ========================================================= */
export async function listarCanales(req, res, next) {
  try {
    const canales = await mensajesService.listarCanales(req.usuario.id);
    res.json({ canales });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/mensajes/canales/:id
   ========================================================= */
export async function obtenerCanal(req, res, next) {
  try {
    const id = validar(schemaCanalIdParam, req.params.id);
    const canal = await mensajesService.obtenerCanal(id, req.usuario.id);
    res.json({ canal });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/mensajes/canales/:id/mensajes
   ========================================================= */
export async function listarMensajesDeCanal(req, res, next) {
  try {
    const id = validar(schemaCanalIdParam, req.params.id);
    const limit = Math.min(Number(req.query.limit) || 100, 200);

    const mensajes = await mensajesService.listarMensajesDeCanal(
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
   POST /api/mensajes/canales/:id/mensajes
   ========================================================= */
export async function enviarMensajeACanal(req, res, next) {
  try {
    const id = validar(schemaCanalIdParam, req.params.id);
    const { texto, imagen } = validar(schemaEnviarMensaje, req.body);

    const mensaje = await mensajesService.enviarMensajeACanal(
      id,
      req.usuario.id,
      texto || null,
      imagen || null
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
   PATCH /api/mensajes/canales/:id/leidos
   ========================================================= */
export async function marcarCanalLeido(req, res, next) {
  try {
    const id = validar(schemaCanalIdParam, req.params.id);
    const resultado = await mensajesService.marcarCanalLeido(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}
/* =========================================================
   DELETE /api/mensajes/canales/:id/para-mi
   ========================================================= */
export async function eliminarCanalParaMi(req, res, next) {
  try {
    const id = validar(schemaCanalIdParam, req.params.id);
    const resultado = await mensajesService.eliminarCanalParaMi(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/mensajes/canales/:id/vaciar-para-mi
   ========================================================= */
export async function vaciarCanalParaMi(req, res, next) {
  try {
    const id = validar(schemaCanalIdParam, req.params.id);
    const resultado = await mensajesService.vaciarCanalParaMi(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}
/* =========================================================
   DELETE /api/mensajes/mensajes/:id/para-mi
   ========================================================= */
export async function eliminarMensajeParaMi(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await mensajesService.eliminarMensajeParaMi(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   DELETE /api/mensajes/mensajes/:id/para-todos
   ========================================================= */
export async function eliminarMensajeParaTodos(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await mensajesService.eliminarMensajeParaTodos(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/mensajes/conversaciones/:id/vaciar-para-mi
   ========================================================= */
export async function vaciarConversacionParaMi(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await mensajesService.vaciarConversacionParaMi(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}