/* =========================================================
   partidos.routes.js — Rutas de partidos
   =========================================================
   Base: /api/partidos

   SEGURIDAD:
   - TODAS las rutas requieren autenticación (requiereAuth)
   - Rate limit en creación (evita spam de partidos)
   - El ownership se valida en el service
*/

import { Router } from 'express';
import * as partidosController from '../controllers/partidos.controller.js';
import { requiereAuth } from '../middlewares/auth.middleware.js';

const router = Router();

/* =========================================================
   MIDDLEWARE GLOBAL
   =========================================================
   Todas las rutas de este router requieren autenticación.
*/
router.use(requiereAuth);

/* =========================================================
   LISTAR Y OBTENER
   ========================================================= */

/* GET /api/partidos
   Lista partidos con filtros y paginación. */
router.get('/', partidosController.listar);

/* GET /api/partidos/:id
   Detalle de un partido. */
router.get('/:id', partidosController.obtener);

/* =========================================================
   CRUD (organizador)
   ========================================================= */

/* POST /api/partidos
   Crea un partido. */
router.post('/', partidosController.crear);

/* PATCH /api/partidos/:id
   Edita un partido (solo organizador). */
router.patch('/:id', partidosController.editar);

/* DELETE /api/partidos/:id
   Elimina (soft delete) un partido (solo organizador). */
router.delete('/:id', partidosController.eliminar);

/* =========================================================
   INSCRIPCIONES (partido de jugador)
   ========================================================= */

/* POST /api/partidos/:id/inscribirse
   Inscribe al usuario autenticado. */
router.post('/:id/inscribirse', partidosController.inscribirse);

/* DELETE /api/partidos/:id/inscribirse
   Saca al usuario autenticado. */
router.delete('/:id/inscribirse', partidosController.salir);

/* =========================================================
   POSTULACIONES (partido con aprobación)
   ========================================================= */

/* POST /api/partidos/:id/postularse
   Postula al usuario autenticado. */
router.post('/:id/postularse', partidosController.postularse);

/* DELETE /api/partidos/:id/postularse
   Cancela la postulación del usuario autenticado. */
router.delete('/:id/postularse', partidosController.cancelarPostulacion);

/* =========================================================
   GESTIÓN DE POSTULANTES (solo organizador)
   ========================================================= */

/* PATCH /api/partidos/:id/postulantes/:usuarioId
   Aprobar o rechazar un postulante.
   Body: { accion: "aprobar" | "rechazar" } */
router.patch('/:id/postulantes/:usuarioId', partidosController.gestionarPostulante);

/* =========================================================
   EQUIPOS POSTULANTES (partido de equipos)
   ========================================================= */

/* POST /api/partidos/:id/equipos-postulantes
   Postula un equipo (el usuario debe ser capitán/admin).
   Body: { equipoId: "uuid" } */
router.post('/:id/equipos-postulantes', partidosController.postularEquipo);

/* PATCH /api/partidos/:id/equipos-postulantes/:equipoId
   Aprobar o rechazar un equipo (solo organizador).
   Body: { accion: "aprobar" | "rechazar" } */
router.patch('/:id/equipos-postulantes/:equipoId', partidosController.gestionarEquipoPostulante);

export default router;