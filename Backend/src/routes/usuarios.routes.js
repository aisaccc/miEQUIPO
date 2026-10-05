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

/* =========================================================
   MIDDLEWARE GLOBAL
   =========================================================
   Todas las rutas de este router requieren autenticación.
   Si el token no es válido → 401 antes de llegar al controller.
*/
router.use(requiereAuth);

/* =========================================================
   RUTAS DEL USUARIO AUTENTICADO (/me)
   ========================================================= */

/* GET /api/usuarios/me
   Devuelve mi perfil completo. */
router.get('/me', usuariosController.getMiPerfil);

/* PATCH /api/usuarios/me
   Actualiza mi perfil (nombre, username, bio, ciudad, país, edad, avatar). */
router.patch('/me', usuariosController.patchMiPerfil);

/* PATCH /api/usuarios/me/deportes
   Reemplaza mi array de deportes. */
router.patch('/me/deportes', usuariosController.patchMisDeportes);

/* PATCH /api/usuarios/me/password
   Cambia mi contraseña. Requiere la actual.
   Rate limit estricto (5 intentos / 15 min) para evitar fuerza bruta. */
router.patch('/me/password', authLimiter, usuariosController.patchMiPassword);

/* DELETE /api/usuarios/me
   Elimina mi cuenta (soft delete).
   Requiere password + escribir "ELIMINAR".
   Rate limit estricto. */
router.delete('/me', authLimiter, usuariosController.deleteMiCuenta);

/* GET /api/usuarios/me/historial-partidos
   Devuelve el historial de partidos del usuario.
   ⚡ El handler vive en partidos.controller.js (porque usa datos de partidos).
   */

router.get('/me/historial-partidos', partidosController.obtenerHistorialPartidos);

/* =========================================================
   RUTAS DE OTROS USUARIOS
   ========================================================= */

/* GET /api/usuarios/me/historial-partidos
   Devuelve el historial de partidos del usuario autenticado.
   El handler vive en partidos.controller.js (porque usa datos de partidos).
   ⚡ Debe ir ANTES de /:id. */
router.get('/me/historial-partidos', partidosController.obtenerHistorialPartidos);

/* GET /api/usuarios/:id
   Devuelve el perfil PÚBLICO de otro usuario.
   
   ⚠️ IMPORTANTE: esta ruta va AL FINAL.
   Si estuviera antes, "me" se tomaría como :id y rompería las rutas /me. */
router.get('/:id', usuariosController.getPerfilPublico);

export default router;
/* GET /api/usuarios/me/historial-partidos
   ⚡ IMPORTANTE: debe ir ANTES de /:id, si no lo toma como un ID.
   Por eso lo agregamos acá como ruta específica.
*/
router.get('/me/historial-partidos', partidosController.obtenerHistorialPartidos);