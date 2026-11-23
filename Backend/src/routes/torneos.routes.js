/* =========================================================
   torneos.routes.js — Rutas de torneos
   =========================================================
   Base: /api/torneos
   ========================================================= */

import { Router } from 'express';
import * as torneosController from '../controllers/torneos.controller.js';
import { requiereAuth } from '../middlewares/auth.middleware.js';
import * as publicacionesController from '../controllers/publicaciones.controller.js';
const router = Router();

/* Todas las rutas requieren autenticación */
router.use(requiereAuth);

/* =========================================================
   LISTAR / OBTENER
   ========================================================= */
router.get('/', torneosController.listar);
router.get('/:id', torneosController.obtener);

/* =========================================================
   CRUD (organizador)
   ========================================================= */
router.post('/', torneosController.crear);
router.patch('/:id', torneosController.editar);
router.patch('/:id/guardar', torneosController.guardar);
router.delete('/:id', torneosController.eliminar);

/* =========================================================
   CERRAR INSCRIPCIONES (organizador)
   ========================================================= */
router.patch('/:id/cerrar', torneosController.cerrar);

/* =========================================================
   INSCRIPCIONES
   ========================================================= */
router.post('/:id/inscribir', torneosController.inscribirEquipo);
router.delete('/:id/inscribir/:equipoId', torneosController.cancelarInscripcion);

/* =========================================================
   GESTIÓN DE SOLICITUDES (organizador)
   ========================================================= */
router.patch('/:id/solicitudes/:equipoId', torneosController.gestionarSolicitud);
router.delete('/:id/equipos/:equipoId', torneosController.expulsarEquipo);

/* =========================================================
   INVITACIONES (a equipos)
   ========================================================= */
router.post('/:id/invitaciones', torneosController.invitarEquipo);
router.patch('/:id/invitaciones/:equipoId', torneosController.responderInvitacion);

/* =========================================================
   SUB-ORGANIZADORES (D.3)
   =========================================================
   ⚠️ IMPORTANTE: /invitaciones/responder va ANTES que
   cualquier ruta con /:usuarioId dinámico, si no lo matchea.
   ========================================================= */
router.post('/:id/organizadores/invitaciones', torneosController.invitarOrganizador);
router.patch('/:id/organizadores/invitaciones/responder', torneosController.responderInvitacionOrganizador);
router.delete('/:id/organizadores/invitaciones/:usuarioId', torneosController.cancelarInvitacionOrganizador);

router.delete('/:id/organizadores/:usuarioId', torneosController.quitarOrganizador);

/* =========================================================
   FIXTURE — CRUD de partidos
   ========================================================= */
router.post('/:id/partidos', torneosController.crearPartidoTorneo);
router.patch('/:id/partidos/:partidoId', torneosController.editarPartidoTorneo);
router.delete('/:id/partidos/:partidoId', torneosController.eliminarPartidoTorneo);
router.patch('/:id/partidos/:partidoId/resultado', torneosController.cargarResultado);

/* =========================================================
   FIXTURE — EDITAR CRUCE INDIVIDUAL (eliminación)
   ========================================================= */
router.patch('/:id/cruces/:partidoId', torneosController.editarCruce);

/* =========================================================
   FIXTURE AUTOMÁTICO — LIGA
   ========================================================= */
router.post('/:id/fixture/liga', torneosController.generarFixtureLiga);

/* =========================================================
   FIXTURE — ELIMINACIÓN
   ========================================================= */
router.post('/:id/fixture/aleatorio', torneosController.armarFixtureAleatorio);
router.post('/:id/fixture/manual', torneosController.armarFixtureManual);
router.post('/:id/fixture/confirmar', torneosController.confirmarFixture);

/* =========================================================
   JORNADAS (liga)
   ========================================================= */
router.post('/:id/jornadas', torneosController.crearJornada);
router.patch('/:id/jornadas/:jornadaId', torneosController.editarJornada);
router.delete('/:id/jornadas/:jornadaId', torneosController.eliminarJornada);

/* =========================================================
   GUARDAR JORNADA BULK
   =========================================================
   ⚠️ IMPORTANTE: va DESPUÉS de las rutas de jornadas normales
   para no confundirse con /jornadas/:jornadaId.
   ========================================================= */
router.patch('/:id/jornadas/:jornadaId/bulk', torneosController.guardarJornadaBulk);
/* =========================================================
   PUBLICACIONES DEL TORNEO (Fase E.4)
   ========================================================= */
router.get('/:torneoId/publicaciones', publicacionesController.listarPorTorneo);
router.post('/:torneoId/publicaciones', publicacionesController.crearEnTorneo);
export default router;