/* =========================================================
   notificaciones.routes.js — Rutas de notificaciones
   =========================================================
   Base: /api/notificaciones
   Todas las rutas requieren autenticación.
   */

import { Router } from 'express';
import * as notificacionesController from '../controllers/notificaciones.controller.js';
import { requiereAuth } from '../middlewares/auth.middleware.js';

const router = Router();

/* Todas las rutas requieren autenticación */
router.use(requiereAuth);

/* =========================================================
   NO LEÍDAS (para el badge)
   ========================================================= */
router.get('/no-leidas', notificacionesController.contarNoLeidas);

/* =========================================================
   LISTAR
   ========================================================= */
router.get('/', notificacionesController.listar);

/* =========================================================
   MARCAR COMO LEÍDAS
   =========================================================
   IMPORTANTE: /leidas debe ir ANTES que /:id/leida
   para que no lo tome como un :id
   */
router.patch('/leidas', notificacionesController.marcarTodasLeidas);
router.patch('/:id/leida', notificacionesController.marcarLeida);

/* =========================================================
   ELIMINAR
   ========================================================= */
router.delete('/leidas', notificacionesController.eliminarLeidas);
router.delete('/:id', notificacionesController.eliminar);

export default router;