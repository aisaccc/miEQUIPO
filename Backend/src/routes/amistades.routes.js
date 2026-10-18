import { Router } from 'express';
import * as amistadesController from '../controllers/amistades.controller.js';
import { requiereAuth } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(requiereAuth);

router.get('/', amistadesController.listar);
router.get('/solicitudes', amistadesController.solicitudes);
router.get('/estado/:otroId', amistadesController.estado);
router.post('/:amigoId', amistadesController.enviar);
router.post('/responder/:solicitanteId', amistadesController.responder);

export default router;