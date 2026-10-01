import rateLimit from 'express-rate-limit';

/* Límite general: 100 peticiones por 15 minutos por IP */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas peticiones, intentá más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/* Límite estricto para login/registro: 5 intentos por 15 minutos */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos. Esperá 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});