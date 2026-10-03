/* =========================================================
   mensajes.routes.js — Rutas de mensajería 1 a 1
   =========================================================
   Base: /api/mensajes
   Todas las rutas requieren autenticación.
*/

import { Router } from 'express';
import * as mensajesController from '../controllers/mensajes.controller.js';
import { requiereAuth } from '../middlewares/auth.middleware.js';

const router = Router();

/* Todas las rutas requieren autenticación */
router.use(requiereAuth);

/* =========================================================
   NO LEÍDOS (para el badge)
   ========================================================= */
router.get('/no-leidos', mensajesController.contarNoLeidos);

/* =========================================================
   CONVERSACIONES
   ========================================================= */
router.get('/conversaciones', mensajesController.listarConversaciones);
router.post('/conversaciones', mensajesController.crearConversacion);
router.get('/conversaciones/:id', mensajesController.obtenerConversacion);
router.delete('/conversaciones/:id', mensajesController.ocultarConversacion);

/* =========================================================
   MENSAJES DENTRO DE UNA CONVERSACIÓN
   ========================================================= */
router.get('/conversaciones/:id/mensajes', mensajesController.listarMensajes);
router.post('/conversaciones/:id/mensajes', mensajesController.enviarMensaje);

/* =========================================================
   MARCAR COMO LEÍDOS
   ========================================================= */
router.patch('/conversaciones/:id/leidos', mensajesController.marcarLeidos);

export default router;