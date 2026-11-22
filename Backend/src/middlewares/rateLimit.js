import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const esDev = env.NODE_ENV === 'development';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: esDev ? 10000 : 5000,
  message: { error: 'Demasiadas peticiones, intentá más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: esDev ? 100 : 10,
  message: { error: 'Demasiados intentos. Esperá 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});

// ⚡ NUEVO: Límite específico para el refresco de tokens
// Evita que alguien sature la base de datos creando sesiones sin parar.
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: esDev ? 100 : 30, // Máximo 30 refrescos cada 15 min (el frontend hace 1 cada 10 min)
  message: { error: 'Demasiadas solicitudes de renovación. Intentá más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});