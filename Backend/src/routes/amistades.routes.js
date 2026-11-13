import { Router } from 'express';
import * as amistadesController from '../controllers/amistades.controller.js';
import { requiereAuth } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(requiereAuth);

// ⚡ RUTAS ESTÁTICAS PRIMERO (Van antes que cualquier /:id)
router.get('/', amistadesController.listar);
router.get('/solicitudes', amistadesController.solicitudes);
router.get('/bloqueados', amistadesController.listarBloqueados);

// ⚡ RUTAS CON PARÁMETROS ESPECÍFICOS
router.get('/estado/:otroId', amistadesController.estado);
router.post('/responder/:solicitanteId', amistadesController.responder);
router.post('/bloquear/:usuarioId', amistadesController.bloquear);
router.delete('/desbloquear/:usuarioId', amistadesController.desbloquear);

// ⚡ RUTAS DINÁMICAS AL FINAL
router.post('/:amigoId', amistadesController.enviar);
router.delete('/:amigoId', amistadesController.eliminar);
router.get('/link', amistadesController.generarLink);
router.post('/link/:token', amistadesController.unirsePorLink);

export default router;