import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { generalLimiter } from './middlewares/rateLimit.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';

// Rutas
import authRoutes from './routes/auth.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import gruposRoutes from './routes/grupos.routes.js';
import partidosRoutes from './routes/partidos.routes.js';
import torneosRoutes from './routes/torneos.routes.js';
import mensajesRoutes from './routes/mensajes.routes.js';
import notificacionesRoutes from './routes/notificaciones.routes.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(generalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'MiEquipo backend funcionando',
    timestamp: new Date().toISOString(),
  });
});

/* =========================================================
   RUTAS DE LA API
   ========================================================= */
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/grupos', gruposRoutes);
app.use('/api/partidos', partidosRoutes);
app.use('/api/torneos', torneosRoutes);
app.use('/api/mensajes', mensajesRoutes);
app.use('/api/notificaciones', notificacionesRoutes);

/* =========================================================
   404 + ERRORES
   ========================================================= */
app.use(notFound);
app.use(errorHandler);

export default app;