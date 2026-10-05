import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/* =========================================================
   CONFIGURACIÓN DE LÍMITES
   =========================================================
   En DESARROLLO los límites son muy altos (o desactivados)
   porque el polling del frontend genera muchas peticiones.
   En PRODUCCIÓN se aplican límites estrictos.
*/

const esDev = env.NODE_ENV === 'development';

/* Límite general:
   - En producción: 100 peticiones por 15 minutos por IP
   - En desarrollo: 10000 peticiones por 15 minutos por IP
*/
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: esDev ? 10000 : 100,
  message: { error: 'Demasiadas peticiones, intentá más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  // No contar las peticiones OPTIONS (preflight de CORS)
  skip: (req) => req.method === 'OPTIONS',
});

/* Límite estricto para login/registro:
   - En producción: 5 intentos por 15 minutos
   - En desarrollo: 100 intentos por 15 minutos (para no bloquearnos al testear)
*/
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: esDev ? 100 : 5,
  message: { error: 'Demasiados intentos. Esperá 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});