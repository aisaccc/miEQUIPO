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
  schemaEditarPartidoTorneo,
  schemaEditarCruce,
  schemaCargarResultado,
  schemaCerrarTorneo,
  schemaListarTorneos,
  schemaCrearJornada,
  schemaEditarJornada,
  schemaGuardarJornadaBulk,
  schemaGenerarFixtureLiga,
  schemaArmarFixtureAleatorio,
  schemaArmarFixtureManual,
  schemaConfirmarFixture,
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
   =========================================================
   ⚡ Ahora devuelve también autoFixturado e infoFixture si el
   torneo es de eliminación y se auto-armó el bracket.
   ========================================================= */
export async function cerrar(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    validar(schemaCerrarTorneo, req.body || {});

    const resultado = await torneosService.cerrarTorneo(id, req.usuario.id);

    res.json({
      mensaje: resultado.autoFixturado
        ? 'Inscripciones cerradas. Fixture armado automáticamente.'
        : 'Inscripciones cerradas correctamente',
      torneo: resultado.torneo,
      autoFixturado: resultado.autoFixturado || false,
      infoFixture: resultado.infoFixture || null,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/torneos/:id/inscribir
   ========================================================= */
export async function inscribirEquipo(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const body = validar(schemaInscribirEquipo, req.body);

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
   ========================================================= */
export async function cancelarInscripcion(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);

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
   FIXTURE — CRUD de partidos
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

export async function editarPartidoTorneo(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const partidoId = validar(schemaUuidParam, req.params.partidoId);
    const cambios = validar(schemaEditarPartidoTorneo, req.body);

    const partido = await torneosService.editarPartidoTorneo(
      torneoId,
      partidoId,
      req.usuario.id,
      cambios
    );

    res.json({
      mensaje: 'Partido actualizado',
      partido,
    });
  } catch (err) {
    next(err);
  }
}

export async function eliminarPartidoTorneo(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const partidoId = validar(schemaUuidParam, req.params.partidoId);

    const resultado = await torneosService.eliminarPartidoTorneo(
      torneoId,
      partidoId,
      req.usuario.id
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   ⚡ PATCH /api/torneos/:id/cruces/:partidoId
   =========================================================
   Editar un cruce individual (local/visitante) mientras el
   fixture NO esté confirmado.
   ========================================================= */
export async function editarCruce(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const partidoId = validar(schemaUuidParam, req.params.partidoId);
    const cambios = validar(schemaEditarCruce, req.body);

    const partido = await torneosService.editarCruce(
      torneoId,
      partidoId,
      req.usuario.id,
      cambios
    );

    res.json({
      mensaje: 'Cruce actualizado',
      partido,
    });
  } catch (err) {
    next(err);
  }
}

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

/* =========================================================
   FIXTURE AUTOMÁTICO — LIGA
   ========================================================= */

export async function generarFixtureLiga(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    validar(schemaGenerarFixtureLiga, req.body || {});

    const resultado = await torneosService.generarFixtureLiga(
      torneoId,
      req.usuario.id
    );

    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   FIXTURE — ELIMINACIÓN
   ========================================================= */

export async function armarFixtureAleatorio(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    validar(schemaArmarFixtureAleatorio, req.body || {});

    const resultado = await torneosService.armarFixtureAleatorio(
      torneoId,
      req.usuario.id
    );

    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function armarFixtureManual(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const datos = validar(schemaArmarFixtureManual, req.body);

    const resultado = await torneosService.armarFixtureManual(
      torneoId,
      req.usuario.id,
      datos
    );

    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function confirmarFixture(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    validar(schemaConfirmarFixture, req.body || {});

    const resultado = await torneosService.confirmarFixture(
      torneoId,
      req.usuario.id
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   JORNADAS (liga)
   ========================================================= */

export async function crearJornada(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const datos = validar(schemaCrearJornada, req.body);

    const jornada = await torneosService.crearJornada(
      torneoId,
      req.usuario.id,
      datos
    );

    res.status(201).json({
      mensaje: 'Jornada creada',
      jornada,
    });
  } catch (err) {
    next(err);
  }
}

export async function editarJornada(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const jornadaId = validar(schemaUuidParam, req.params.jornadaId);
    const cambios = validar(schemaEditarJornada, req.body);

    const jornada = await torneosService.editarJornada(
      torneoId,
      jornadaId,
      req.usuario.id,
      cambios
    );

    res.json({
      mensaje: 'Jornada actualizada',
      jornada,
    });
  } catch (err) {
    next(err);
  }
}

export async function eliminarJornada(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const jornadaId = validar(schemaUuidParam, req.params.jornadaId);

    const resultado = await torneosService.eliminarJornada(
      torneoId,
      jornadaId,
      req.usuario.id
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GUARDAR JORNADA BULK
   ========================================================= */

export async function guardarJornadaBulk(req, res, next) {
  try {
    const torneoId = validar(schemaUuidParam, req.params.id);
    const jornadaId = validar(schemaUuidParam, req.params.jornadaId);
    const datos = validar(schemaGuardarJornadaBulk, req.body);

    const resultado = await torneosService.guardarJornadaBulk(
      torneoId,
      jornadaId,
      req.usuario.id,
      datos
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}