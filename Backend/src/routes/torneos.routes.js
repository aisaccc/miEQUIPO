/* =========================================================
   torneos.routes.js — Rutas de torneos
   =========================================================
   Base: /api/torneos
   ========================================================= */

import { Router } from 'express';
import * as torneosController from '../controllers/torneos.controller.js';
import { requiereAuth } from '../middlewares/auth.middleware.js';

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
   INVITACIONES
   ========================================================= */
router.post('/:id/invitaciones', torneosController.invitarEquipo);
router.patch('/:id/invitaciones/:equipoId', torneosController.responderInvitacion);

/* =========================================================
   SUB-ORGANIZADORES
   ========================================================= */
router.post('/:id/organizadores', torneosController.agregarOrganizador);
router.delete('/:id/organizadores/:usuarioId', torneosController.quitarOrganizador);

/* =========================================================
   FIXTURE — CRUD de partidos
   ========================================================= */
router.post('/:id/partidos', torneosController.crearPartidoTorneo);
router.patch('/:id/partidos/:partidoId', torneosController.editarPartidoTorneo);
router.delete('/:id/partidos/:partidoId', torneosController.eliminarPartidoTorneo);
router.patch('/:id/partidos/:partidoId/resultado', torneosController.cargarResultado);

/* =========================================================
   ⚡ FIXTURE — EDITAR CRUCE INDIVIDUAL (eliminación)
   =========================================================
   Permite cambiar local/visitante de un cruce existente
   mientras el fixture NO esté confirmado.
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
   IMPORTANTE: va DESPUÉS de las rutas de jornadas normales
   para no confundirse con /jornadas/:jornadaId.
   ========================================================= */
router.patch('/:id/jornadas/:jornadaId/bulk', torneosController.guardarJornadaBulk);

export default router;