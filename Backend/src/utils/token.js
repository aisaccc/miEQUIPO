import crypto from 'crypto';

/**
 * Genera un token aleatorio criptográficamente seguro.
 * @param {number} bytes - cantidad de bytes (32 = 64 caracteres hex)
 * @returns {string}
 */
export function generarTokenAleatorio(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Genera un código de 6 dígitos para verificación rápida (opcional).
 * Útil si quieres que el usuario ingrese un código en vez de clickear un link.
 */
export function generarCodigoNumerico() {
  return String(crypto.randomInt(100000, 999999));
}