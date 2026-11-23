/* =========================================================
   partidos.routes.js — Rutas de partidos
   Base: /api/partidos
   ========================================================= */

import { Router } from 'express';
import * as partidosController from '../controllers/partidos.controller.js';
import { requiereAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requiereAuth);

/* =========================================================
   LISTAR Y OBTENER
   ========================================================= */
router.get('/', partidosController.listar);
router.get('/:id', partidosController.obtener);

/* =========================================================
   CRUD (organizador)
   ========================================================= */
router.post('/', partidosController.crear);
router.patch('/:id', partidosController.editar);
router.patch('/:id/guardar', partidosController.guardar);
router.delete('/:id', partidosController.eliminar);

/* =========================================================
   INSCRIPCIONES (partido de jugador)
   ========================================================= */
router.post('/:id/inscribirse', partidosController.inscribirse);
router.delete('/:id/inscribirse', partidosController.salir);
// Capitan/admin puede retirar su equipo inscrito o interesado, incluso confirmado.
router.delete('/:id/salir-equipo/:equipoId', partidosController.salirEquipo);

/* =========================================================
   POSTULACIONES (partido con aprobación)
   ========================================================= */
router.post('/:id/postularse', partidosController.postularse);
router.delete('/:id/postularse', partidosController.cancelarPostulacion);

/* =========================================================
   GESTIÓN DE POSTULANTES (solo organizador)
   ========================================================= */
router.patch('/:id/postulantes/:usuarioId', partidosController.gestionarPostulante);

/* =========================================================
   MODO "ORGANIZAR PARTIDO" — Interesados
   ========================================================= */
router.post('/:id/interesarse', partidosController.interesarse);
router.delete('/:id/interesarse', partidosController.cancelarInteres);
router.get('/:id/interesados', partidosController.listarInteresados);
router.patch('/:id/confirmar', partidosController.confirmar);

/* =========================================================
   FLUJO DE DOBLE CONFIRMACIÓN
   ========================================================= */
router.post(
  '/:id/confirmaciones/:propuestaId/aprobar',
  partidosController.aprobarConfirmacion
);
router.post(
  '/:id/confirmaciones/:propuestaId/rechazar',
  partidosController.rechazarConfirmacion
);
router.delete(
  '/:id/confirmaciones/:propuestaId',
  partidosController.cancelarConfirmacion
);
router.get(
  '/:id/confirmacion-pendiente',
  partidosController.obtenerConfirmacionPendiente
);

/* =========================================================
   ⚡ ECHAR PARTICIPANTES (solo organizador)
   =========================================================
   IMPORTANTE: van ANTES de las rutas genéricas /:id/...
   para no colisionar. En realidad no colisionan porque son
   más específicas, pero las dejamos agrupadas.
   ========================================================= */
router.delete('/:id/inscritos/:usuarioId', partidosController.echarInscrito);
router.delete('/:id/interesados/:usuarioId', partidosController.echarInteresado);
router.delete('/:id/equipos-inscritos/:equipoId', partidosController.echarEquipoInscrito);

/* =========================================================
   EQUIPOS POSTULANTES (partido de equipos)
   ========================================================= */
router.post('/:id/equipos-postulantes', partidosController.postularEquipo);
router.delete('/:id/equipos-postulantes/:equipoId', partidosController.cancelarPostulacionEquipo);
router.patch('/:id/equipos-postulantes/:equipoId', partidosController.gestionarEquipoPostulante);

export default router;