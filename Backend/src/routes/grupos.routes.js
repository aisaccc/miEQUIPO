/* =========================================================
   grupos.routes.js — Rutas de grupos (equipos + comunidades)
   =========================================================
   Base: /api/grupos
*/

import { Router } from 'express';
import * as gruposController from '../controllers/grupos.controller.js';
import { requiereAuth } from '../middlewares/auth.middleware.js';

const router = Router();

/* Todas las rutas requieren autenticación */
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

export default router;