import { z } from 'zod';

/* =========================================================
   REGLAS DE VALIDACIÓN REUTILIZABLES
   ========================================================= */

const passwordSegura = z
  .string({ required_error: 'La contraseña es obligatoria' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(100, 'La contraseña no puede superar los 100 caracteres')
  .regex(/[a-z]/, 'La contraseña debe tener al menos una minúscula')
  .regex(/[A-Z]/, 'La contraseña debe tener al menos una mayúscula')
  .regex(/[0-9]/, 'La contraseña debe tener al menos un número')
  .refine(
    password => Buffer.byteLength(password, 'utf8') <= 72,
    'La contraseña no puede superar los 72 bytes'
  );

const usernameValido = z
  .string({ required_error: 'El nombre de usuario es obligatorio' })
  .min(3, 'El usuario debe tener al menos 3 caracteres')
  .max(30, 'El usuario no puede superar los 30 caracteres')
  .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guiones bajos')
  .transform(v => v.trim());

const nombreValido = z
  .string({ required_error: 'El nombre es obligatorio' })
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(100, 'El nombre no puede superar los 100 caracteres')
  .transform(v => v.trim());

const emailValido = z
  .string({ required_error: 'El email es obligatorio' })
  .email('El email no es válido')
  .max(255, 'El email es demasiado largo')
  .transform(v => v.trim().toLowerCase());

const tokenHex = z
  .string({ required_error: 'El token es obligatorio' })
  .length(64, 'El token es inválido')
  .regex(/^[a-f0-9]+$/, 'El token tiene un formato inválido');

/* =========================================================
   ESQUEMA: REGISTRO
   ========================================================= */
export const schemaRegistro = z.object({
  nombre:   nombreValido,
  email:    emailValido,
  username: usernameValido,
  password: passwordSegura,
}).strict();

/* =========================================================
   ESQUEMA: LOGIN
   ========================================================= */
export const schemaLogin = z.object({
  identificador: z
    .string({ required_error: 'Ingresá tu email o usuario' })
    .min(1, 'Ingresá tu email o usuario')
    .max(255, 'Máximo 255 caracteres')
    .transform(v => v.trim()),
  password: z
    .string({ required_error: 'La contraseña es obligatoria' })
    .min(1, 'Ingresá tu contraseña')
    .max(100, 'Máximo 100 caracteres'),
}).strict();

/* =========================================================
   ESQUEMA: VERIFICAR EMAIL
   ========================================================= */
export const schemaVerificarEmail = z.object({
  token: tokenHex,
}).strict();

/* =========================================================
   ESQUEMA: OLVIDÉ MI CONTRASEÑA
   ========================================================= */
export const schemaOlvidePassword = z.object({
  email: emailValido,
}).strict();

/* =========================================================
   ESQUEMA: RESET PASSWORD
   ========================================================= */
export const schemaResetPassword = z.object({
  token: tokenHex,
  password: passwordSegura,
}).strict();

/* =========================================================
   ESQUEMA: REFRESH TOKEN
   ========================================================= */
export const schemaRefresh = z.object({
  refreshToken: z
    .string({ required_error: 'Falta el refresh token' })
    .min(20, 'Token inválido')
    .max(2000, 'Token inválido')
    .regex(/^[A-Za-z0-9._-]+$/, 'Token con formato inválido'),
}).strict();