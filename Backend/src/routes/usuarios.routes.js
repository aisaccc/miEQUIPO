/* =========================================================
   usuarios.routes.js — Rutas de usuarios
   =========================================================
   Base: /api/usuarios

   SEGURIDAD:
   - TODAS las rutas requieren autenticación (requiereAuth)
   - Rate limit específico en cambio de contraseña
   - El :id siempre se valida en el controller
*/

import { Router } from 'express';
import * as usuariosController from '../controllers/usuarios.controller.js';
import * as partidosController from '../controllers/partidos.controller.js';
import { requiereAuth } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimit.js';

const router = Router();

/* Todas las rutas requieren autenticación */
router.use(requiereAuth);

/* =========================================================
   RUTAS DEL USUARIO AUTENTICADO (/me)
   ========================================================= */

router.get('/me', usuariosController.obtenerMiPerfil);
router.get('/me/plan', usuariosController.obtenerMiPlan); // ⚡ NUEVO
router.patch('/me', usuariosController.actualizarMiPerfil);
router.patch('/me/deportes', usuariosController.actualizarMisDeportes);
router.patch('/me/password', authLimiter, usuariosController.cambiarMiPassword);
router.delete('/me', authLimiter, usuariosController.eliminarMiCuenta);

router.get('/me/historial-partidos', partidosController.obtenerHistorialPartidos);

/* =========================================================
   BÚSQUEDA DE USUARIOS
   ⚠️ IMPORTANTE: va ANTES de /:id, si no lo toma como UUID.
*/
router.get('/buscar', usuariosController.buscar);

/* =========================================================
   RUTAS DE OTROS USUARIOS
   GET /api/usuarios/:id → perfil público.
   ⚠️ Va AL FINAL.
*/
router.get('/:id', usuariosController.obtener);

export default router;