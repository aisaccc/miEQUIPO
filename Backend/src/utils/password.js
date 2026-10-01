import bcrypt from 'bcrypt';

/* 12 rounds es el estándar actual. Más rounds = más seguro pero más lento.
   Con 12, cada hash tarda ~250ms. Es un buen balance. */
const SALT_ROUNDS = 12;

/**
 * Hashea una contraseña en texto plano.
 * @param {string} passwordPlano
 * @returns {Promise<string>} el hash
 */
export async function hashearPassword(passwordPlano) {
  return bcrypt.hash(passwordPlano, SALT_ROUNDS);
}

/**
 * Compara una contraseña con su hash.
 * @param {string} passwordPlano
 * @param {string} hashGuardado
 * @returns {Promise<boolean>}
 */
export async function verificarPassword(passwordPlano, hashGuardado) {
  if (!passwordPlano || !hashGuardado) return false;
  return bcrypt.compare(passwordPlano, hashGuardado);
}