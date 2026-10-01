/* =========================================================
   auth.routes.js — Rutas de autenticación
   =========================================================
   Base: /api/auth
*/

import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { requiereAuth } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimit.js';

const router = Router();

/* =========================================================
   RUTAS PÚBLICAS
   ========================================================= */

/* POST /api/auth/registro
   Crea un usuario nuevo.
   Rate limit estricto: 5 intentos por 15 min por IP. */
router.post('/registro', authLimiter, authController.registro);

/* POST /api/auth/login
   Login con email O username.
   Rate limit estricto contra fuerza bruta. */
router.post('/login', authLimiter, authController.login);

/* POST /api/auth/refresh
   Renueva el access token usando el refresh token. */
router.post('/refresh', authController.refresh);

/* POST /api/auth/logout
   Cierra la sesión actual (revoca el refresh token). */
router.post('/logout', authController.logout);

/* POST /api/auth/verificar-email
   Activa la cuenta con el token enviado por email. */
router.post('/verificar-email', authController.verificarEmail);

/* =========================================================
   RUTAS PROTEGIDAS (requieren JWT)
   ========================================================= */

/* GET /api/auth/me
   Devuelve el usuario actual. */
router.get('/me', requiereAuth, authController.me);

/* POST /api/auth/logout-all
   Cierra TODAS las sesiones del usuario. */
router.post('/logout-all', requiereAuth, authController.logoutAll);

export default router;