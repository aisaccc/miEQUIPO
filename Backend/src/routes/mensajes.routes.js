/* =========================================================
   mensajes.routes.js — Rutas de mensajería
   =========================================================
   Base: /api/mensajes
   Todas las rutas requieren autenticación.
*/

import { Router } from 'express';
import * as mensajesController from '../controllers/mensajes.controller.js';
import { requiereAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requiereAuth);

/* =========================================================
   NO LEÍDOS (para el badge)
   ========================================================= */
router.get('/no-leidos', mensajesController.contarNoLeidos);

/* =========================================================
   CONVERSACIONES 1 A 1
   ========================================================= */
router.get('/conversaciones', mensajesController.listarConversaciones);
router.post('/conversaciones', mensajesController.crearConversacion);
router.get('/conversaciones/:id', mensajesController.obtenerConversacion);
router.delete('/conversaciones/:id', mensajesController.ocultarConversacion);

router.get('/conversaciones/:id/mensajes', mensajesController.listarMensajes);
router.post('/conversaciones/:id/mensajes', mensajesController.enviarMensaje);
router.patch('/conversaciones/:id/leidos', mensajesController.marcarLeidos);

/* =========================================================
   CANALES (equipos + torneos)
   ========================================================= */
router.get('/canales', mensajesController.listarCanales);
router.get('/canales/:id', mensajesController.obtenerCanal);
router.get('/canales/:id/mensajes', mensajesController.listarMensajesDeCanal);
router.post('/canales/:id/mensajes', mensajesController.enviarMensajeACanal);
router.patch('/canales/:id/leidos', mensajesController.marcarCanalLeido);
/* =========================================================
   CANALES — acciones por usuario
   ========================================================= */
router.delete('/canales/:id/para-mi', mensajesController.eliminarCanalParaMi);
router.post('/canales/:id/vaciar-para-mi', mensajesController.vaciarCanalParaMi);

export default router;