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
import publicacionesRoutes from './routes/publicaciones.routes.js';
import amistadesRoutes from './routes/amistades.routes.js';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ⚡ CORS: local + Render (Frontend en producción)
const ORIGENES_PERMITIDOS = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL, // Acá va la URL de tu frontend en Render
].filter(Boolean); // El .filter(Boolean) evita errores si FRONTEND_URL no está definida en local

app.use(cors({
  origin: function (origin, callback) {
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
// Las respuestas de la API pueden contener información privada.
// Impedir que el navegador y las cachés compartidas las almacenen.
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(generalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (env.NODE_ENV === 'development') {
  app.use(morgan(':method :status :response-time ms'));
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
app.use('/api/publicaciones', publicacionesRoutes);
app.use('/api/amistades', amistadesRoutes);

/* =========================================================
   404 + ERRORES
   ========================================================= */
app.use(notFound);
app.use(errorHandler);

export default app;