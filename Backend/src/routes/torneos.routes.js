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
   FIXTURE / CRUCES
   ========================================================= */
router.post('/:id/partidos', torneosController.crearPartidoTorneo);
router.patch('/:id/partidos/:partidoId/resultado', torneosController.cargarResultado);

export default router;