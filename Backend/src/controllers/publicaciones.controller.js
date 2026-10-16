/* =========================================================
   publicaciones.controller.js — Manejo req/res
   ========================================================= */

import * as publicacionesService from '../services/publicaciones.service.js';
import { validar } from '../validators/index.js';
import {
  schemaCrearPublicacion,
  schemaCrearPublicacionGrupo,
  schemaCrearPublicacionTorneo,
  schemaEditarPublicacion,
  schemaCrearComentario,
  schemaUuidParam,
} from '../validators/publicaciones.schema.js';

/* =========================================================
   GET /api/publicaciones/feed
   =========================================================
   Feed global (perfil + torneos) para el Inicio.
   ========================================================= */
export async function feed(req, res, next) {
  try {
    const publicaciones = await publicacionesService.feedGlobal(req.usuario.id);
    res.json({ publicaciones });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/publicaciones/usuario/:usuarioId
   ========================================================= */
export async function listarPorUsuario(req, res, next) {
  try {
    const usuarioId = validar(schemaUuidParam, req.params.usuarioId);
    const publicaciones = await publicacionesService.listarPorUsuario(
      usuarioId,
      req.usuario.id
    );
    res.json({ publicaciones });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/publicaciones  (perfil)
   ========================================================= */
export async function crear(req, res, next) {
  try {
    const datos = validar(schemaCrearPublicacion, req.body);
    const resultado = await publicacionesService.crear(req.usuario.id, datos);
    res.status(201).json({
      mensaje: 'Publicación creada',
      id: resultado.id,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/grupos/:grupoId/publicaciones
   ========================================================= */
export async function crearEnGrupo(req, res, next) {
  try {
    const grupoId = validar(schemaUuidParam, req.params.grupoId);
    const datos = validar(schemaCrearPublicacionGrupo, req.body);
    const resultado = await publicacionesService.crearEnGrupo(
      grupoId,
      req.usuario.id,
      datos
    );
    res.status(201).json({
      mensaje: 'Publicación creada',
      id: resultado.id,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/torneos/:torneoId/publicaciones
   ========================================================= */
export async function crearEnTorneo(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.torneoId);
    const datos = validar(schemaCrearPublicacionTorneo, req.body);
    const resultado = await publicacionesService.crearEnTorneo(
      torneoId,
      req.usuario.id,
      datos
    );
    res.status(201).json({
      mensaje: 'Publicación creada',
      id: resultado.id,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/grupos/:grupoId/publicaciones
   ========================================================= */
export async function listarPorGrupo(req, res, next) {
  try {
    const grupoId = validar(schemaUuidParam, req.params.grupoId);
    const publicaciones = await publicacionesService.listarPorGrupo(
      grupoId,
      req.usuario.id
    );
    res.json({ publicaciones });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/torneos/:torneoId/publicaciones
   ========================================================= */
export async function listarPorTorneo(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.torneoId);
    const publicaciones = await publicacionesService.listarPorTorneo(
      torneoId,
      req.usuario.id
    );
    res.json({ publicaciones });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/publicaciones/:id
   ========================================================= */
export async function editar(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const datos = validar(schemaEditarPublicacion, req.body);
    const resultado = await publicacionesService.editar(id, req.usuario.id, datos);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   DELETE /api/publicaciones/:id
   ========================================================= */
export async function eliminar(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await publicacionesService.eliminar(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/publicaciones/:id/like
   ========================================================= */
export async function toggleLike(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await publicacionesService.toggleLike(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/publicaciones/:id/comentarios
   ========================================================= */
export async function listarComentarios(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const comentarios = await publicacionesService.listarComentarios(id);
    res.json({ comentarios });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/publicaciones/:id/comentarios
   ========================================================= */
export async function crearComentario(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const { texto } = validar(schemaCrearComentario, req.body);
    const resultado = await publicacionesService.crearComentario(id, req.usuario.id, texto);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}