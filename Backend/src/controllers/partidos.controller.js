/* =========================================================
   partidos.controller.js — Manejo de req/res de partidos
   =========================================================
   Los controllers SOLO:
   - Extraen datos de req
   - Llaman al service
   - Devuelven res

   La lógica de negocio vive en services/partidos.service.js
*/

import * as partidosService from '../services/partidos.service.js';
import { validar } from '../validators/index.js';
import {
  schemaCrearPartido,
  schemaEditarPartido,
  schemaInscribirse,
  schemaPostularEquipo,
  schemaAprobarPostulante,
  schemaAprobarEquipo,
  schemaListarPartidos,
  schemaUuidParam,
  schemaInteresarse,
  schemaConfirmarPartido,
  schemaHistorialPartidos,
} from '../validators/partidos.schema.js';

/* =========================================================
   GET /api/partidos
   =========================================================
   Requiere auth.
   Lista partidos con filtros y paginación.
*/
export async function listar(req, res, next) {
  try {
    const filtros = validar(schemaListarPartidos, req.query);
    const resultado = await partidosService.listarPartidos(filtros, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   GET /api/partidos/:id
   =========================================================
   Requiere auth.
   Devuelve el detalle de un partido.
*/
export async function obtener(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const partido = await partidosService.obtenerPartido(id, req.usuario.id);
    res.json({ partido });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/partidos
   =========================================================
   Requiere auth.
   Crea un partido. El organizador es el usuario autenticado.
*/
export async function crear(req, res, next) {
  try {
    const datos = validar(schemaCrearPartido, req.body);
    const partido = await partidosService.crearPartido(datos, req.usuario.id);
    res.status(201).json({
      mensaje: 'Partido creado correctamente',
      partido,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/partidos/:id
   =========================================================
   Requiere auth.
   Solo el organizador puede editar.
*/
export async function editar(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const cambios = validar(schemaEditarPartido, req.body);

    const partido = await partidosService.editarPartido(id, cambios, req.usuario.id);

    res.json({
      mensaje: 'Partido actualizado correctamente',
      partido,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   DELETE /api/partidos/:id
   =========================================================
   Requiere auth.
   Solo el organizador puede eliminar (soft delete).
*/
export async function eliminar(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await partidosService.eliminarPartido(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/partidos/:id/inscribirse
   =========================================================
   Requiere auth.
   Inscribe al usuario en un partido de jugador sin aprobación.
*/
export async function inscribirse(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const { posicion } = validar(schemaInscribirse, req.body || {});

    const partido = await partidosService.inscribirse(id, req.usuario.id, posicion);

    res.json({
      mensaje: 'Te inscribiste correctamente',
      partido,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   DELETE /api/partidos/:id/inscribirse
   =========================================================
   Requiere auth.
   Saca al usuario del partido.
*/
export async function salir(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await partidosService.salirDelPartido(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/partidos/:id/postularse
   =========================================================
   Requiere auth.
   Postula al usuario a un partido que requiere aprobación.
*/
export async function postularse(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const { posicion } = validar(schemaInscribirse, req.body || {});

    const partido = await partidosService.postularse(id, req.usuario.id, posicion);

    res.json({
      mensaje: 'Postulación enviada',
      partido,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   DELETE /api/partidos/:id/postularse
   =========================================================
   Requiere auth.
   Cancela la postulación del usuario.
*/
export async function cancelarPostulacion(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await partidosService.cancelarPostulacion(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/partidos/:id/postulantes/:usuarioId
   =========================================================
   Requiere auth.
   Solo el organizador puede aprobar/rechazar postulantes.
*/
export async function gestionarPostulante(req, res, next) {
  try {
    const partidoId = validar(schemaUuidParam, req.params.id);
    const postulanteId = validar(schemaUuidParam, req.params.usuarioId);
    const { accion } = validar(schemaAprobarPostulante, req.body);

    const resultado = await partidosService.gestionarPostulante(
      partidoId,
      req.usuario.id,
      postulanteId,
      accion
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   POST /api/partidos/:id/equipos-postulantes
   =========================================================
   Requiere auth.
   Postula un equipo (que el usuario capitanea o administra).
*/
export async function postularEquipo(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const { equipoId } = validar(schemaPostularEquipo, req.body);

    const partido = await partidosService.postularEquipo(id, req.usuario.id, equipoId);

    res.json({
      mensaje: 'Equipo postulado correctamente',
      partido,
    });
  } catch (err) {
    next(err);
  }
}

/* =========================================================
   PATCH /api/partidos/:id/equipos-postulantes/:equipoId
   =========================================================
   Requiere auth.
   Solo el organizador puede aprobar/rechazar equipos.
*/
export async function gestionarEquipoPostulante(req, res, next) {
  try {
    const partidoId = validar(schemaUuidParam, req.params.id);
    const equipoId = validar(schemaUuidParam, req.params.equipoId);
    const { accion } = validar(schemaAprobarEquipo, req.body);

    const resultado = await partidosService.gestionarEquipoPostulante(
      partidoId,
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
   DELETE /api/partidos/:id/equipos-postulantes/:equipoId
   =========================================================
   Requiere auth.
   Cancela la postulación del propio equipo.
*/
export async function cancelarPostulacionEquipo(req, res, next) {
  try {
    const partidoId = validar(schemaUuidParam, req.params.id);
    const equipoId = validar(schemaUuidParam, req.params.equipoId);

    const resultado = await partidosService.cancelarPostulacionEquipo(
      partidoId,
      req.usuario.id,
      equipoId
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}
/* =========================================================
   MODO "ORGANIZAR PARTIDO" — Interesados
   ========================================================= */

/* ---------- POST /api/partidos/:id/interesarse ---------- */
export async function interesarse(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const { mensaje } = validar(schemaInteresarse, req.body || {});

    const partido = await partidosService.interesarse(id, req.usuario.id, mensaje);

    res.json({
      mensaje: 'Te marcaste como interesado',
      partido,
    });
  } catch (err) {
    next(err);
  }
}

/* ---------- DELETE /api/partidos/:id/interesarse ---------- */
export async function cancelarInteres(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const resultado = await partidosService.cancelarInteres(id, req.usuario.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* ---------- GET /api/partidos/:id/interesados ---------- */
export async function listarInteresados(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const interesados = await partidosService.listarInteresados(id, req.usuario.id);
    res.json({ interesados });
  } catch (err) {
    next(err);
  }
}

/* ---------- PATCH /api/partidos/:id/confirmar ---------- */
export async function confirmar(req, res, next) {
  try {
    const id = validar(schemaUuidParam, req.params.id);
    const datos = validar(schemaConfirmarPartido, req.body);

    const partido = await partidosService.confirmarPartido(id, req.usuario.id, datos);

    res.json({
      mensaje: 'Partido confirmado correctamente',
      partido,
    });
  } catch (err) {
    next(err);
  }
}
/* =========================================================
   FLUJO DE DOBLE CONFIRMACIÓN (modo Organizar)
   =========================================================
   Cuando el organizador propone confirmar, se crea una
   propuesta que el interesado debe aprobar o rechazar.
   */

/* ---------- POST /api/partidos/:id/confirmaciones/:propuestaId/aprobar ---------- */
export async function aprobarConfirmacion(req, res, next) {
  try {
    const partidoId = validar(schemaUuidParam, req.params.id);
    const propuestaId = validar(schemaUuidParam, req.params.propuestaId);

    const resultado = await partidosService.aprobarConfirmacion(
      partidoId,
      req.usuario.id,
      propuestaId
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* ---------- POST /api/partidos/:id/confirmaciones/:propuestaId/rechazar ---------- */
export async function rechazarConfirmacion(req, res, next) {
  try {
    const partidoId = validar(schemaUuidParam, req.params.id);
    const propuestaId = validar(schemaUuidParam, req.params.propuestaId);

    const resultado = await partidosService.rechazarConfirmacion(
      partidoId,
      req.usuario.id,
      propuestaId
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* ---------- DELETE /api/partidos/:id/confirmaciones/:propuestaId ---------- */
export async function cancelarConfirmacion(req, res, next) {
  try {
    const partidoId = validar(schemaUuidParam, req.params.id);
    const propuestaId = validar(schemaUuidParam, req.params.propuestaId);

    const resultado = await partidosService.cancelarConfirmacion(
      partidoId,
      req.usuario.id,
      propuestaId
    );

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

/* ---------- GET /api/partidos/:id/confirmacion-pendiente ---------- */
export async function obtenerConfirmacionPendiente(req, res, next) {
  try {
    const partidoId = validar(schemaUuidParam, req.params.id);

    const confirmacion = await partidosService.obtenerConfirmacionPendiente(
      partidoId,
      req.usuario.id
    );

    res.json({ confirmacion });
  } catch (err) {
    next(err);
  }
}

/* ---------- GET /api/usuarios/me/historial-partidos ---------- */
export async function obtenerHistorialPartidos(req, res, next) {
  try {
    const filtros = validar(schemaHistorialPartidos, req.query);
    const resultado = await partidosService.obtenerHistorialPartidos(
      req.usuario.id,
      filtros
    );
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}