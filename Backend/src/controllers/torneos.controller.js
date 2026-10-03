/* =========================================================
   torneos.controller.js — Manejo de req/res de torneos
   ========================================================= */

import * as torneosService from '../services/torneos.service.js';
import { validar } from '../validators/index.js';
import {
  schemaCrearTorneo,
  schemaEditarTorneo,
  schemaInscribirEquipo,
  schemaAprobarSolicitud,
  schemaInvitarEquipo,
  schemaAgregarOrganizador,
  schemaCrearPartidoTorneo,
  schemaCargarResultado,
  schemaCerrarTorneo,
  schemaListarTorneos,
  schemaUuidParam,
  schemaEquipoIdParam,
} from '../validators/torneos.schema.js';

/* =========================================================
   GET /api/torneos
   ========================================================= */
export async function listar(req, res, next) {
  try {
    const filtros = validar(schemaListarTorneos, req.query);
    const resultado = await torneosService.listarTorneos(filtros, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/torneos/:id
   ========================================================= */
export async function obtener(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const torneo = await torneosService.obtenerTorneo(id, req.usuario.id);
    res.json({ torneo });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/torneos
   ========================================================= */
export async function crear(req, res, next) {
  try {
    const datos = validar(schemaCrearTorneo, req.body);
    const torneo = await torneosService.crearTorneo(datos, req.usuario.id);
    res.status(201).json({
      mensaje: 'Torneo creado correctamente',
      torneo,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/torneos/:id
   ========================================================= */
export async function editar(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const cambios = validar(schemaEditarTorneo, req.body);

    const torneo = await torneosService.editarTorneo(id, cambios, req.usuario.id);

    res.json({
      mensaje: 'Torneo actualizado correctamente',
      torneo,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   DELETE /api/torneos/:id
   ========================================================= */
export async function eliminar(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await torneosService.eliminarTorneo(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/torneos/:id/cerrar
   ========================================================= */
export async function cerrar(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    validar(schemaCerrarTorneo, req.body || {});

    const torneo = await torneosService.cerrarTorneo(id, req.usuario.id);

    res.json({
      mensaje: 'Inscripciones cerradas correctamente',
      torneo,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/torneos/:id/inscribir
   =========================================================
   Torneos de equipo: equipoId obligatorio.
   Torneos individuales: equipoId puede venir null/undefined.
   ========================================================= */
export async function inscribirEquipo(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const body = validar(schemaInscribirEquipo, req.body);

    // Normalizamos: si viene null o undefined, mandamos null al service
    const equipoId = body.equipoId ?? null;

    const torneo = await torneosService.inscribirEquipo(
      torneoId,
      req.usuario.id,
      equipoId
    );

    res.json({
      mensaje: body.equipoId
        ? 'Equipo inscrito correctamente'
        : 'Inscripción procesada',
      torneo,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   DELETE /api/torneos/:id/inscribir/:equipoId
   =========================================================
   Acepta:
   - UUID → cancela esa inscripción específica (equipo)
   - 'me' → cancela mi propia inscripción (individual)
   ========================================================= */
export async function cancelarInscripcion(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);

    // ⚡ 'me' → el backend usa mi usuarioId
    const equipoId = req.params.equipoId === 'me'
      ? req.usuario.id
      : validar(schemaEquipoIdParam, req.params.equipoId);

    const resultado = await torneosService.cancelarInscripcion(
      torneoId,
      req.usuario.id,
      equipoId
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/torneos/:id/solicitudes/:equipoId
   ========================================================= */
export async function gestionarSolicitud(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const equipoId = validar(schemaEquipoIdParam, req.params.equipoId);
    const { accion } = validar(schemaAprobarSolicitud, req.body);

    const resultado = await torneosService.gestionarSolicitud(
      torneoId,
      req.usuario.id,
      equipoId,
      accion
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   DELETE /api/torneos/:id/equipos/:equipoId
   ========================================================= */
export async function expulsarEquipo(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const equipoId = validar(schemaEquipoIdParam, req.params.equipoId);

    const resultado = await torneosService.expulsarEquipo(
      torneoId,
      req.usuario.id,
      equipoId
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/torneos/:id/invitaciones
   ========================================================= */
export async function invitarEquipo(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const { equipoId } = validar(schemaInvitarEquipo, req.body);

    const resultado = await torneosService.invitarEquipo(
      torneoId,
      req.usuario.id,
      equipoId
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/torneos/:id/invitaciones/:equipoId
   ========================================================= */
export async function responderInvitacion(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const equipoId = validar(schemaEquipoIdParam, req.params.equipoId);
    const { aceptar } = req.body;

    const resultado = await torneosService.responderInvitacion(
      torneoId,
      req.usuario.id,
      equipoId,
      aceptar === true
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/torneos/:id/organizadores
   ========================================================= */
export async function agregarOrganizador(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const { usuarioId, permisos } = validar(schemaAgregarOrganizador, req.body);

    const resultado = await torneosService.agregarOrganizador(
      torneoId,
      req.usuario.id,
      usuarioId,
      permisos
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   DELETE /api/torneos/:id/organizadores/:usuarioId
   ========================================================= */
export async function quitarOrganizador(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const usuarioId = validar(schemaUuidParam, req.params.usuarioId);

    const resultado = await torneosService.quitarOrganizador(
      torneoId,
      req.usuario.id,
      usuarioId
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/torneos/:id/partidos
   ========================================================= */
export async function crearPartidoTorneo(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const datos = validar(schemaCrearPartidoTorneo, req.body);

    const partido = await torneosService.crearPartidoTorneo(
      torneoId,
      req.usuario.id,
      datos
    );

    res.status(201).json({
      mensaje: 'Partido creado',
      partido,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/torneos/:id/partidos/:partidoId/resultado
   ========================================================= */
export async function cargarResultado(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const partidoId = validar(schemaUuidParam, req.params.partidoId);
    const datos = validar(schemaCargarResultado, req.body);

    const resultado = await torneosService.cargarResultado(
      torneoId,
      partidoId,
      req.usuario.id,
      datos
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}