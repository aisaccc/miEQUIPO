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

// ⚡ Helmet con crossOriginResourcePolicy deshabilitado para permitir
// que el navegador cargue recursos desde otro origen (frontend en 5500).
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ⚡ CORS: acepta tanto localhost como 127.0.0.1 (y el puerto 5500).
const ORIGENES_PERMITIDOS = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: function (origin, callback) {
    // Sin origin (Postman, curl, server-to-server) → permitir
    if (!origin) return callback(null, true);

    if (ORIGENES_PERMITIDOS.includes(origin)) {
      return callback(null, true);
    }

    console.warn('[CORS] Origen bloqueado:', origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
// ⚡ Responder al preflight OPTIONS en el router principal
app.options('*', cors());
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