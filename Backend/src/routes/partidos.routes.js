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
   MODO "ORGANIZAR PARTIDO" — Interesados
   =========================================================
   Cuando un partido está en estado_partido='buscando_jugadores',
   los usuarios marcan "Me interesa" en vez de inscribirse.
   ========================================================= */

/* POST /api/partidos/:id/interesarse
   Marca "Me interesa" al usuario autenticado.
   Body opcional: { mensaje } */
router.post('/:id/interesarse', partidosController.interesarse);

/* DELETE /api/partidos/:id/interesarse
   Cancela el "Me interesa" del usuario autenticado. */
router.delete('/:id/interesarse', partidosController.cancelarInteres);

/* GET /api/partidos/:id/interesados
   Lista de interesados (solo organizador). */
router.get('/:id/interesados', partidosController.listarInteresados);

/* PATCH /api/partidos/:id/confirmar
   El organizador PROPONE confirmar el partido con un interesado.
   ⚡ AHORA NO cierra el partido: crea una propuesta.
   Body: { interesadoId, interesadoTipo, equipoId?, lugar, fecha, precio, mensaje? } */
router.patch('/:id/confirmar', partidosController.confirmar);

/* =========================================================
   FLUJO DE DOBLE CONFIRMACIÓN
   =========================================================
   El interesado debe aprobar la propuesta para que el partido
   se cierre definitivamente.
   ========================================================= */

/* POST /api/partidos/:id/confirmaciones/:propuestaId/aprobar
   El interesado aprueba la propuesta. */
router.post(
  '/:id/confirmaciones/:propuestaId/aprobar',
  partidosController.aprobarConfirmacion
);

/* POST /api/partidos/:id/confirmaciones/:propuestaId/rechazar
   El interesado rechaza la propuesta. */
router.post(
  '/:id/confirmaciones/:propuestaId/rechazar',
  partidosController.rechazarConfirmacion
);

/* DELETE /api/partidos/:id/confirmaciones/:propuestaId
   El organizador cancela la propuesta. */
router.delete(
  '/:id/confirmaciones/:propuestaId',
  partidosController.cancelarConfirmacion
);

/* GET /api/partidos/:id/confirmacion-pendiente
   Devuelve la propuesta pendiente (si existe) para el usuario actual. */
router.get(
  '/:id/confirmacion-pendiente',
  partidosController.obtenerConfirmacionPendiente
);


/* =========================================================
   EQUIPOS POSTULANTES (partido de equipos)
   ========================================================= */

/* POST /api/partidos/:id/equipos-postulantes
   Postula un equipo (el usuario debe ser capitán/admin).
   Body: { equipoId: "uuid" } */
router.post('/:id/equipos-postulantes', partidosController.postularEquipo);

/* DELETE /api/partidos/:id/equipos-postulantes/:equipoId
   Cancela la postulación del propio equipo. */
router.delete('/:id/equipos-postulantes/:equipoId', partidosController.cancelarPostulacionEquipo);

/* PATCH /api/partidos/:id/equipos-postulantes/:equipoId
   Aprobar o rechazar un equipo (solo organizador).
   Body: { accion: "aprobar" | "rechazar" } */
router.patch('/:id/equipos-postulantes/:equipoId', partidosController.gestionarEquipoPostulante);

export default router;
/* =========================================================
   HISTORIAL DE PARTIDOS (aunque técnicamente es de usuarios,
   lo dejamos acá porque usa datos de partidos)
   =========================================================
   Se registra bajo /api/usuarios/me/historial-partidos
   pero físicamente vive en este router.
   */