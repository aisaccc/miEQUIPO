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
import partidosRoutes from './routes/partidos.routes.js';

const app = express();

/* =========================================================
   SEGURIDAD
   ========================================================= */
app.use(helmet());

app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));

app.use(generalLimiter);

/* =========================================================
   PARSERS
   ========================================================= */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   LOGS
   ========================================================= */
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

/* =========================================================
   HEALTH CHECK
   ========================================================= */
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
app.use('/api/partidos', partidosRoutes);

/* =========================================================
   404 + ERRORES (SIEMPRE al final)
   ========================================================= */
app.use(notFound);
app.use(errorHandler);

export default app;