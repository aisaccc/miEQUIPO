/* =========================================================
   auth.routes.js — Rutas de autenticación
   =========================================================
   Base: /api/auth
*/

import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { requiereAuth } from '../middlewares/auth.middleware.js';
import { authLimiter, refreshLimiter } from '../middlewares/rateLimit.js'; // ⚡ Importamos refreshLimiter

const router = Router();

/* =========================================================
   RUTAS PÚBLICAS
   ========================================================= */

router.post('/registro', authLimiter, authController.registro);
router.post('/login', authLimiter, authController.login);

/* POST /api/auth/refresh
   ⚡ FIX: Aplicamos el limitador para evitar ataques de saturación */
router.post('/refresh', refreshLimiter, authController.refresh);

router.post('/logout', authController.logout);
router.post('/verificar-email', authController.verificarEmail);

/* =========================================================
   RUTAS PROTEGIDAS (requieren JWT)
   ========================================================= */

router.get('/me', requiereAuth, authController.me);
router.post('/logout-all', requiereAuth, authController.logoutAll);

export default router;