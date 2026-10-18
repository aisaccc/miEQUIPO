import * as amistadesService from '../services/amistades.service.js';
import { validar } from '../validators/index.js';
import { schemaUuidParam } from '../validators/publicaciones.schema.js'; // Reutilizamos el validador de UUID

export async function enviar(req, res, next) {
  try {
    const amigoId = validar(schemaUuidParam, req.params.amigoId);
    const resultado = await amistadesService.enviarSolicitud(req.usuario.id, amigoId);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function responder(req, res, next) {
  try {
    const solicitanteId = validar(schemaUuidParam, req.params.solicitanteId);
    const { accion } = req.body; // 'aceptar' | 'rechazar'
    const resultado = await amistadesService.responderSolicitud(req.usuario.id, solicitanteId, accion);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function listar(req, res, next) {
  try {
    const amigos = await amistadesService.listarAmigos(req.usuario.id);
    res.json({ amigos });
  } catch (err) {
    next(err);
  }
}

export async function solicitudes(req, res, next) {
  try {
    const solicitudes = await amistadesService.listarSolicitudes(req.usuario.id);
    res.json({ solicitudes });
  } catch (err) {
    next(err);
  }
}

export async function estado(req, res, next) {
  try {
    const otroId = validar(schemaUuidParam, req.params.otroId);
    const estado = await amistadesService.obtenerEstado(req.usuario.id, otroId);
    res.json(estado);
  } catch (err) {
    next(err);
  }
}