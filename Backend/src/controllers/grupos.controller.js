/* =========================================================
   grupos.controller.js — Manejo de req/res de grupos
   =========================================================
   Los controllers SOLO:
   - Extraen datos de req
   - Llaman al service
   - Devuelven res
*/

import * as gruposService from '../services/grupos.service.js';
import { validar } from '../validators/index.js';
import {
  schemaCrearGrupo,
  schemaEditarGrupo,
  schemaEditarStats,
  schemaGestionarSolicitud,
  schemaCambiarRol,
  schemaListarGrupos,
  schemaUuidParam,
} from '../validators/grupos.schema.js';
import { schemaEditarStatsJugador } from '../validators/grupos.schema.js';
import { schemaEditarFormacionAbierta } from '../validators/grupos.schema.js';

/* =========================================================
   GET /api/grupos
   ========================================================= */
export async function listar(req, res, next) {
  try {
    const filtros = validar(schemaListarGrupos, req.query);
    const resultado = await gruposService.listarGrupos(filtros, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/grupos/:id
   ========================================================= */
export async function obtener(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const grupo = await gruposService.obtenerGrupo(id, req.usuario.id);
    res.json({ grupo });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/grupos
   ========================================================= */
export async function crear(req, res, next) {
  try {
    const datos = validar(schemaCrearGrupo, req.body);
    const grupo = await gruposService.crearGrupo(datos, req.usuario.id);
    res.status(201).json({
      mensaje: 'Grupo creado correctamente',
      grupo,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/grupos/:id
   ========================================================= */
export async function editar(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const cambios = validar(schemaEditarGrupo, req.body);

    const grupo = await gruposService.editarGrupo(id, cambios, req.usuario.id);

    res.json({
      mensaje: 'Grupo actualizado',
      grupo,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/grupos/:id/stats
   ========================================================= */
export async function editarStats(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const stats = validar(schemaEditarStats, req.body);

    const grupo = await gruposService.editarStats(id, stats, req.usuario.id);

    res.json({
      mensaje: 'Stats actualizadas',
      grupo,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   DELETE /api/grupos/:id
   ========================================================= */
export async function eliminar(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await gruposService.eliminarGrupo(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/grupos/:id/unirse
   ========================================================= */
export async function unirse(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await gruposService.unirseAGrupo(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   DELETE /api/grupos/:id/salir
   ========================================================= */
export async function salir(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await gruposService.salirDeGrupo(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   DELETE /api/grupos/:id/mi-solicitud
   ========================================================= */
export async function cancelarMiSolicitud(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await gruposService.cancelarMiSolicitud(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/grupos/:id/miembros
   ========================================================= */
export async function listarMiembros(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const miembros = await gruposService.listarMiembros(id, req.usuario.id);
    res.json({ miembros });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/grupos/:id/solicitudes
   ========================================================= */
export async function listarSolicitudes(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const solicitudes = await gruposService.listarSolicitudes(id, req.usuario.id);
    res.json({ solicitudes });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/grupos/:id/solicitudes/:usuarioId
   ========================================================= */
export async function gestionarSolicitud(req, res, next) {
  try {
    const grupoId = validar(schemaUuidParam, req.params.id);
    const solicitanteId = validar(schemaUuidParam, req.params.usuarioId);
    const { accion } = validar(schemaGestionarSolicitud, req.body);

    const resultado = await gruposService.gestionarSolicitud(
      grupoId,
      req.usuario.id,
      solicitanteId,
      accion
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   DELETE /api/grupos/:id/miembros/:usuarioId
   ========================================================= */
export async function expulsarMiembro(req, res, next) {
  try {
    const grupoId = validar(schemaUuidParam, req.params.id);
    const miembroId = validar(schemaUuidParam, req.params.usuarioId);

    const resultado = await gruposService.expulsarMiembro(
      grupoId,
      req.usuario.id,
      miembroId
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/grupos/:id/miembros/:usuarioId/rol
   ========================================================= */
export async function cambiarRolMiembro(req, res, next) {
  try {
    const grupoId = validar(schemaUuidParam, req.params.id);
    const miembroId = validar(schemaUuidParam, req.params.usuarioId);
    const { rol } = validar(schemaCambiarRol, req.body);

    const resultado = await gruposService.cambiarRolMiembro(
      grupoId,
      req.usuario.id,
      miembroId,
      rol
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}
// Al inicio importa el schema

// ... (al final del archivo)
export async function editarStatsJugador(req, res, next) {
  try {
    const grupoId = validar(schemaUuidParam, req.params.id);
    const miembroId = validar(schemaUuidParam, req.params.usuarioId);
    const { stats } = validar(schemaEditarStatsJugador, req.body);
    
    const resultado = await gruposService.editarStatsJugador(grupoId, miembroId, stats, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function editarFormacion(req, res, next) {
  try {
    const grupoId = validar(schemaUuidParam, req.params.id);
    const { formacion } = validar(schemaEditarGrupo, req.body);
    
    // ⚡ DEBUG: Mira la consola del backend para ver si llegan las fichas
    console.log('📥 Recibiendo formación:', formacion?.length, 'fichas');

    const resultado = await gruposService.editarFormacion(grupoId, formacion, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}
export async function editarFormacionAbierta(req, res, next) {
  try {
    const grupoId = validar(schemaUuidParam, req.params.id);
    const { formacionAbierta } = validar(schemaEditarFormacionAbierta, req.body);
    
    const resultado = await gruposService.editarFormacionAbierta(grupoId, formacionAbierta, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}
export async function generarLinkInvitacion(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await gruposService.generarLinkGrupo(id, req.usuario.id);
    res.json(resultado);
  } catch (err) { next(err); }
}

export async function unirsePorLink(req, res, next) {
  try {
    const { token } = req.params;
    const resultado = await gruposService.unirsePorLink(token, req.usuario.id);
    res.json(resultado);
  } catch (err) { next(err); }
}

export async function invitarAmigo(req, res, next) {
  try {
    const grupoId = validar(schemaUuidParam, req.params.id);
    const amigoId = validar(schemaUuidParam, req.params.amigoId);
    const resultado = await gruposService.invitarAmigoAGrupo(grupoId, amigoId, req.usuario.id);
    res.json(resultado);
  } catch (err) { next(err); }
}