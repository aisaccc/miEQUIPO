/* =========================================================
   requirePremium.middleware.js — Bloquea features premium
   =========================================================
   Uso:
     router.post('/torneos', requiereAuth, requirePremium('crear_torneo'), ctrl)
   
   Asume que `requiereAuth` (o `authOpcional`) ya cargó req.usuario.
   Si es premium: next().
   Si no: 403 con code= PREMIUM_REQUIRED.
*/

import { esPremium } from '../utils/planes.js';

export function requirePremium(feature = 'premium') {
  return (req, res, next) => {
    if (esPremium(req.usuario)) return next();

    const err = new Error('Esta función requiere plan Premium.');
    err.status = 403;
    err.code = 'PREMIUM_REQUIRED';
    err.feature = feature;
    return next(err);
  };
}