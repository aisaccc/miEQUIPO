/* =========================================================
   grupos.schema.js — Validación estricta con Zod
   =========================================================
   Grupos = equipos + comunidades
   .strict() = rechaza campos extra (bloquea mass assignment)
*/

import { z } from 'zod';

/* =========================================================
   HELPERS Y CAMPOS REUTILIZABLES
   ========================================================= */

const uuidValido = z.string().uuid('El ID debe ser un UUID válido');

const nombreValido = z
  .string({ required_error: 'El nombre es obligatorio' })
  .min(3, 'Mínimo 3 caracteres')
  .max(80, 'Máximo 80 caracteres')
  .transform(v => v.trim());

const deporteValido = z
  .string({ required_error: 'El deporte es obligatorio' })
  .min(2, 'Deporte inválido')
  .max(50, 'Máximo 50 caracteres')
  .transform(v => v.trim());

const descripcionValida = z
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

const escudoValido = z
  .string()
  .max(500, 'Escudo inválido')
  .nullable()
  .optional();

const tipoValido = z.enum(['equipo', 'comunidad'], {
  errorMap: () => ({ message: 'Tipo inválido. Debe ser "equipo" o "comunidad"' })
});

const tipoAccesoValido = z.enum(['publico', 'privado'], {
  errorMap: () => ({ message: 'Tipo de acceso inválido' })
}).default('publico');

/* =========================================================
   SCHEMAS
   ========================================================= */

/* ---------- POST /api/grupos ---------- */
export const schemaCrearGrupo = z.object({
  tipo: tipoValido,
  nombre: nombreValido,
  escudo: escudoValido,
  deporte: deporteValido,
  ciudad: ciudadValida,
  descripcion: descripcionValida,
  tipoAcceso: tipoAccesoValido,
}).strict();

/* ---------- PATCH /api/grupos/:id ---------- */
export const schemaEditarGrupo = z.object({
  nombre: nombreValido.optional(),
  escudo: escudoValido,
  deporte: deporteValido.optional(),
  ciudad: ciudadValida,
  descripcion: descripcionValida,
  tipoAcceso: tipoAccesoValido.optional(),
  statsPrivadas: z.boolean().optional(),
}).strict();

/* ---------- PATCH /api/grupos/:id/stats ---------- */
export const schemaEditarStats = z.object({
  victorias: z.number().int().min(0).max(10000),
  empates: z.number().int().min(0).max(10000),
  derrotas: z.number().int().min(0).max(10000),
}).strict();

/* ---------- POST /api/grupos/:id/unirse ---------- */
/* Sin body, solo la ruta */

/* ---------- PATCH /api/grupos/:id/solicitudes/:usuarioId ---------- */
export const schemaGestionarSolicitud = z.object({
  accion: z.enum(['aprobar', 'rechazar'], {
    errorMap: () => ({ message: 'Acción inválida. Debe ser "aprobar" o "rechazar"' })
  }),
}).strict();

/* ---------- PATCH /api/grupos/:id/miembros/:usuarioId/rol ---------- */
export const schemaCambiarRol = z.object({
  rol: z.enum(['capitan', 'admin', 'miembro'], {
    errorMap: () => ({ message: 'Rol inválido' })
  }),
}).strict();

/* ---------- GET /api/grupos (query params) ---------- */
export const schemaListarGrupos = z.object({
  tipo: z.enum(['equipo', 'comunidad']).optional(),
  deporte: z.string().max(50).optional(),
  ciudad: z.string().max(60).optional(),
  tipoAcceso: z.enum(['publico', 'privado']).optional(),
  soloMios: z.enum(['true', 'false']).optional(),
  busqueda: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

/* ---------- Param :id ---------- */
export const schemaUuidParam = uuidValido;