/* =========================================================
   auth.routes.js — Rutas de autenticación
   =========================================================
   Base: /api/auth
*/

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller.js';
import { requiereAuth } from '../middlewares/auth.middleware.js';
import { authLimiter, refreshLimiter } from '../middlewares/rateLimit.js'; // ⚡ Importamos refreshLimiter

const router = Router();

// Independientes del login: pedir enlaces no consume sus intentos.
const opcionesRecuperacion = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta nuevamente más tarde.' },
};
const olvidePasswordLimiter = rateLimit({ ...opcionesRecuperacion, max: 5 });
const resetPasswordLimiter = rateLimit({ ...opcionesRecuperacion, max: 10 });

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
router.post('/olvide-password', olvidePasswordLimiter, authController.olvidePassword);
router.post('/reset-password', resetPasswordLimiter, authController.resetPassword);

/* =========================================================
   RUTAS PROTEGIDAS (requieren JWT)
   ========================================================= */

router.get('/me', requiereAuth, authController.me);
router.post('/logout-all', requiereAuth, authController.logoutAll);

export default router;