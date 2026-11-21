import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* El access token queda asociado al id real de la tabla sesiones. */
export function generarAccessToken(usuario, sesionId) {
  if (!UUID_VALIDO.test(usuario.id) || !UUID_VALIDO.test(sesionId)) {
    throw new Error('Identificador de sesión inválido');
  }

  return jwt.sign(
    {
      sub: usuario.id,
      username: usuario.username,
      sid: sesionId,
      tipo: 'access',
    },
    env.JWT.secret,
    {
      algorithm: 'HS256',
      expiresIn: env.JWT.expiresIn,
      jwtid: crypto.randomUUID(),
    }
  );
}

export function verificarAccessToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT.secret, {
      algorithms: ['HS256'],
    });
    if (
      !payload || typeof payload !== 'object' ||
      payload.tipo !== 'access' ||
      typeof payload.sub !== 'string' || !UUID_VALIDO.test(payload.sub) ||
      typeof payload.sid !== 'string' || !UUID_VALIDO.test(payload.sid) ||
      typeof payload.exp !== 'number'
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

export function generarRefreshToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, tipo: 'refresh' },
    env.JWT.refreshSecret,
    {
      algorithm: 'HS256',
      expiresIn: env.JWT.refreshExpiresIn,
      jwtid: crypto.randomUUID(),
    }
  );
}

export function verificarRefreshToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT.refreshSecret, {
      algorithms: ['HS256'],
    });
    if (
      !payload || typeof payload !== 'object' ||
      payload.tipo !== 'refresh' ||
      typeof payload.sub !== 'string' || !UUID_VALIDO.test(payload.sub) ||
      typeof payload.exp !== 'number'
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashearToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
