/* =========================================================
   usuarios.schema.js — Validación estricta con Zod
   ========================================================= */

import { z } from 'zod';
import { HERO_COLORS, MARCOS_VALIDOS, esColorHex } from '../utils/colores.js';

/* =========================================================
   CAMPOS REUTILIZABLES
   ========================================================= */

const nombreValido = z
  .string({ required_error: 'El nombre es obligatorio' })
  .min(2, 'Mínimo 2 caracteres')
  .max(100, 'Máximo 100 caracteres')
  .regex(/^[\p{L}\p{N}\s'.-]+$/u, 'El nombre contiene caracteres inválidos')
  .transform(v => v.trim());

const usernameValido = z
  .string({ required_error: 'El usuario es obligatorio' })
  .min(3, 'Mínimo 3 caracteres')
  .max(30, 'Máximo 30 caracteres')
  .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guiones bajos')
  .transform(v => v.trim());

const bioValida = z
  .string()
  .max(300, 'Máximo 300 caracteres')
  .transform(v => v.trim())
  .nullable()
  .optional();

const ciudadValida = z
  .string()
  .max(60, 'Máximo 60 caracteres')
  .transform(v => v.trim())
  .nullable()
  .optional();

const paisValido = z
  .string()
  .max(60, 'Máximo 60 caracteres')
  .transform(v => v.trim())
  .nullable()
  .optional();

const edadValida = z
  .number()
  .int('Debe ser un número entero')
  .min(10, 'Mínimo 10 años')
  .max(100, 'Máximo 100 años')
  .nullable()
  .optional();

/* Avatar: solo URL http(s) o data URL de imagen, máx 2 MB en base64 */
const avatarValido = z
  .string()
  .max(2_800_000, 'El avatar es demasiado grande')
  .refine(
    val => {
      if (!val) return true;
      return /^https?:\/\//i.test(val) ||
             /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(val);
    },
    { message: 'El avatar debe ser una URL válida o una imagen' }
  )

/* Foto de banner: mismo formato que avatar, límite más generoso */
const heroFotoValida = z
  .string()
  .max(2_100_000, 'La foto de banner es demasiado grande')
  .refine(
    val => {
      if (!val) return true;
      return /^https?:\/\//i.test(val) ||
             /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(val);
    },
    { message: 'La foto debe ser una URL válida o una imagen' }
  )
  .nullable()
  .optional();

/* =========================================================
   DEPORTES — array con estructura controlada
   ========================================================= */

const posicionValida = z
  .string()
  .min(1, 'Posición vacía')
  .max(50, 'Máximo 50 caracteres')
  .transform(v => v.trim());

const statValor = z.object({
  valor: z.union([
    z.number().min(0).max(1_000_000),  // Acepta números (enteros y decimales)
    z.string().max(50)                 // Acepta strings (tiempos, textos, etc.)
  ]),
  publico: z.boolean().default(false)
}).strict();

const deporteItem = z.object({
  deporte: z
    .string()
    .min(2, 'Deporte inválido')
    .max(50, 'Máximo 50 caracteres')
    .transform(v => v.trim()),
  posiciones: z
    .array(posicionValida)
    .max(20, 'Máximo 20 posiciones')
    .default([]),
  stats: z
    .record(z.string().max(50), statValor)
    .default({})
}).strict();

/* =========================================================
   SCHEMAS
   ========================================================= */

/* Acepta: predefinido ('navy', 'black', ...) o hex custom ('#FF5722') */
const heroColorValido = z.union([
  z.enum(HERO_COLORS, {
    errorMap: () => ({ message: 'Color de hero inválido' }),
  }),
  z.string().refine(esColorHex, {
    message: 'Color hexadecimal inválido (formato #RRGGBB)',
  }),
]);

const statsHeroBaseSchema = z.object({
  partidos: z.number().int().min(0).max(1_000_000).optional(),
}).strict();

const statsHeroPrivadasSchema = z.object({
  partidos: z.boolean().optional(),
  torneos:  z.boolean().optional(),
  equipos:  z.boolean().optional(),
}).strict();

const notificacionesPrefsSchema = z.object({
  partidos: z.boolean().optional(),
  torneos:  z.boolean().optional(),
  mensajes: z.boolean().optional(),
}).strict();

/* ---------- PATCH /api/usuarios/me ---------- */
export const schemaActualizarPerfil = z.object({
  nombre: nombreValido.optional(),
  username: usernameValido.optional(),
  bio: bioValida,
  ciudad: ciudadValida,
  pais: paisValido,
  edad: edadValida,
  avatar: avatarValido,
  heroColor: heroColorValido.optional(),
  heroFoto: heroFotoValida,
  statsHeroBase: statsHeroBaseSchema.optional(),
  statsHeroPrivadas: statsHeroPrivadasSchema.optional(),
  notificacionesPrefs: notificacionesPrefsSchema.optional(),
  mensajesSoloAmigos: z.boolean().optional(),
  
  // Marco de perfil (solo Premium)
  marcoPerfil: z.enum(MARCOS_VALIDOS, {
    errorMap: () => ({ message: 'Marco inválido' }),
  }).optional(),
  // Color del marco custom (#RRGGBB). Solo se usa si marcoPerfil === 'custom'.
  marcoColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido (formato #RRGGBB)').nullable().optional(),
}).strict();

/* ---------- PATCH /api/usuarios/me/deportes ---------- */
export const schemaActualizarDeportes = z.object({
  deportes: z
    .array(deporteItem)
    .max(20, 'Máximo 20 deportes')
}).strict();

/* ---------- PATCH /api/usuarios/me/password ---------- */
const passwordSegura = z
  .string({ required_error: 'La contraseña es obligatoria' })
  .min(8, 'Mínimo 8 caracteres')
  .max(100, 'Máximo 100 caracteres')
  .regex(/[a-z]/, 'Debe tener una minúscula')
  .regex(/[A-Z]/, 'Debe tener una mayúscula')
  .regex(/[0-9]/, 'Debe tener un número');

export const schemaCambiarPassword = z.object({
  passwordActual: z
    .string({ required_error: 'La contraseña actual es obligatoria' })
    .min(1, 'Ingresa tu contraseña actual'),
  passwordNueva: passwordSegura,
}).strict();

/* ---------- DELETE /api/usuarios/me ---------- */
export const schemaEliminarCuenta = z.object({
  password: z
    .string({ required_error: 'Confirmá tu contraseña' })
    .min(1, 'Ingresa tu contraseña'),
  confirmacion: z
    .literal('ELIMINAR', {
      errorMap: () => ({ message: 'Escribe exactamente "ELIMINAR"' })
    }),
}).strict();

/* =========================================================
   BUSCAR USUARIOS
   ========================================================= */
export const schemaBuscarUsuarios = z.object({
  q: z
    .string({ required_error: 'Ingresá un término de búsqueda' })
    .min(2, 'Mínimo 2 caracteres')
    .max(80, 'Máximo 80 caracteres')
    .transform(v => v.trim()),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

/* ---------- Param :id (UUID) ---------- */
export const schemaUuidParam = z
  .string()
  .uuid('El ID debe ser un UUID válido');