/* =========================================================
   grupos.routes.js — Rutas de grupos (equipos + comunidades)
   Base: /api/grupos
   ========================================================= */

import { Router } from 'express';
import * as gruposController from '../controllers/grupos.controller.js';
import * as publicacionesController from '../controllers/publicaciones.controller.js';
import { requiereAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requiereAuth);

/* =========================================================
   LISTAR / OBTENER
   ========================================================= */
router.get('/', gruposController.listar);
router.get('/:id', gruposController.obtener);

/* =========================================================
   CRUD
   ========================================================= */
router.post('/', gruposController.crear);
router.patch('/:id', gruposController.editar);
router.delete('/:id', gruposController.eliminar);

/* =========================================================
   STATS
   ========================================================= */
router.patch('/:id/stats', gruposController.editarStats);

/* =========================================================
   UNIRSE / SALIR
   ========================================================= */
router.post('/:id/unirse', gruposController.unirse);
router.delete('/:id/salir', gruposController.salir);
router.delete('/:id/mi-solicitud', gruposController.cancelarMiSolicitud);

/* =========================================================
   MIEMBROS
   ========================================================= */
router.get('/:id/miembros', gruposController.listarMiembros);
router.delete('/:id/miembros/:usuarioId', gruposController.expulsarMiembro);
router.patch('/:id/miembros/:usuarioId/rol', gruposController.cambiarRolMiembro);

/* =========================================================
   SOLICITUDES
   ========================================================= */
router.get('/:id/solicitudes', gruposController.listarSolicitudes);
router.patch('/:id/solicitudes/:usuarioId', gruposController.gestionarSolicitud);

/* =========================================================
   PUBLICACIONES (Fase E.4)
   ========================================================= */
router.get('/:grupoId/publicaciones', publicacionesController.listarPorGrupo);
router.post('/:grupoId/publicaciones', publicacionesController.crearEnGrupo);
/* =========================================================
   MIEMBROS
   ========================================================= */
router.get('/:id/miembros', gruposController.listarMiembros);
router.delete('/:id/miembros/:usuarioId', gruposController.expulsarMiembro);
router.patch('/:id/miembros/:usuarioId/rol', gruposController.cambiarRolMiembro);

// ⚡ NUEVO: Stats por jugador
router.patch('/:id/miembros/:usuarioId/stats', gruposController.editarStatsJugador);

// ⚡ NUEVO: Formación
router.patch('/:id/formacion', gruposController.editarFormacion);
router.patch('/:id/formacion/ajustes', gruposController.editarFormacionAbierta); // ⚡ NUEVO
// ⚡ NUEVOS: Links de invitación
router.get('/:id/link', gruposController.generarLinkInvitacion);
router.post('/link/:token', gruposController.unirsePorLink);
router.post('/:id/invitar/:amigoId', gruposController.invitarAmigo);
export default router;
