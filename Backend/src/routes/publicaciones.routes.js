/* =========================================================
   publicaciones.routes.js — Rutas de publicaciones
   Base: /api/publicaciones
   ========================================================= */

import { Router } from 'express';
import * as publicacionesController from '../controllers/publicaciones.controller.js';
import { requiereAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requiereAuth);

/* =========================================================
   FEED GLOBAL (Inicio) — antes de /:id
   ========================================================= */
router.get('/feed', publicacionesController.feed);

/* =========================================================
   LISTAR POR USUARIO
   ========================================================= */
router.get('/usuario/:usuarioId', publicacionesController.listarPorUsuario);

/* =========================================================
   CRUD
   ========================================================= */
router.post('/', publicacionesController.crear);
router.patch('/:id', publicacionesController.editar);
router.patch('/:id/privacidad', publicacionesController.editarPrivacidad);
router.delete('/:id', publicacionesController.eliminar);

/* =========================================================
   LIKE
   ========================================================= */
router.post('/:id/like', publicacionesController.toggleLike);

/* =========================================================
   COMENTARIOS
   ========================================================= */
router.get('/:id/comentarios', publicacionesController.listarComentarios);
router.post('/:id/comentarios', publicacionesController.crearComentario);

export default router;