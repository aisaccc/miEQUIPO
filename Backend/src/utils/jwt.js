import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

/**
 * Genera un ACCESS token (corto, 15 min).
 * El payload NO debe tener datos sensibles (es decodificable por cualquiera).
 */
export function generarAccessToken(usuario) {
  return jwt.sign(
    {
      sub: usuario.id,
      username: usuario.username,
    },
    env.JWT.secret,
    { expiresIn: env.JWT.expiresIn }
  );
}

/**
 * Verifica un ACCESS token.
 * Devuelve el payload o null si es inválido/expirado.
 */
export function verificarAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT.secret, {
      algorithms: ['HS256']
    });
  } catch {
    return null;
  }
}


/**
 * Genera un REFRESH token (largo, 7 días).
 * Este SÍ o SÍ debe guardarse hasheado en la BD, nunca en texto plano.
 */

export function generarRefreshToken(usuario) {
  return jwt.sign(
    {
      sub: String(usuario.id),
      jti: crypto.randomUUID()
    },
    env.JWT.refreshSecret,
    {
      algorithm: 'HS256',
      expiresIn: env.JWT.refreshExpiresIn
    }
  );
}


/**
 * Verifica un REFRESH token.
 */
export function verificarRefreshToken(token) {
  try {
    return jwt.verify(token, env.JWT.refreshSecret, {
      algorithms: ['HS256']
    });
  } catch {
    return null;
  }
}

/**
 * Genera un hash SHA-256 de un token.
 * Se usa para guardar el refresh token en la BD sin exponerlo.
 */
export function hashearToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
