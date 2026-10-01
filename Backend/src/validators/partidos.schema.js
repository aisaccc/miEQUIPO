/* =========================================================
   partidos.schema.js — Validación estricta con Zod
   =========================================================
   .strict() = rechaza campos extra (bloquea mass assignment)
   Cada campo tiene límites para evitar DoS
*/

import { z } from 'zod';

/* =========================================================
   CAMPOS REUTILIZABLES
   ========================================================= */

const uuidValido = z
  .string()
  .uuid('El ID debe ser un UUID válido');

const tituloValido = z
  .string({ required_error: 'El título es obligatorio' })
  .min(3, 'Mínimo 3 caracteres')
  .max(120, 'Máximo 120 caracteres')
  .transform(v => v.trim());

const deporteValido = z
  .string({ required_error: 'El deporte es obligatorio' })
  .min(2, 'Deporte inválido')
  .max(50, 'Máximo 50 caracteres')
  .transform(v => v.trim());

const descripcionValida = z
  .string()
  .max(500, 'Máximo 500 caracteres')
  .transform(v => v.trim())
  .nullable()
  .optional();

const lugarValido = z
  .string({ required_error: 'El lugar es obligatorio' })
  .min(2, 'Mínimo 2 caracteres')
  .max(120, 'Máximo 120 caracteres')
  .transform(v => v.trim());

const fechaValida = z
  .string({ required_error: 'La fecha es obligatoria' })
  .refine(
    val => !isNaN(Date.parse(val)),
    { message: 'La fecha no es válida' }
  )
  .refine(
    val => new Date(val).getTime() > Date.now() - 60_000,
    { message: 'La fecha no puede ser en el pasado' }
  )
  .transform(val => new Date(val).toISOString());

const cuposValidos = z
  .number({ required_error: 'Los cupos son obligatorios' })
  .int('Debe ser un número entero')
  .min(2, 'Mínimo 2 cupos')
  .max(100, 'Máximo 100 cupos');

const precioValido = z
  .number()
  .int('Debe ser un número entero')
  .min(0, 'El precio no puede ser negativo')
  .max(10_000_000, 'Precio demasiado alto')
  .default(0);

const nivelValido = z
  .enum(['amistoso', 'semiprofesional', 'profesional'])
  .default('amistoso');

const tipoPartidoValido = z
  .enum(['jugador', 'equipo'])
  .default('jugador');

const emojiValido = z
  .string()
  .max(500, 'Emoji inválido')
  .nullable()
  .optional();

const posicionesValidas = z
  .array(
    z.string().min(1).max(50).transform(v => v.trim())
  )
  .max(20, 'Máximo 20 posiciones')
  .default([]);

/* =========================================================
   SCHEMAS
   ========================================================= */

/* ---------- POST /api/partidos ---------- */
export const schemaCrearPartido = z.object({
  titulo: tituloValido,
  deporte: deporteValido,
  emoji: emojiValido,
  descripcion: descripcionValida,
  lugar: lugarValido,
  fecha: fechaValida,
  cupos: cuposValidos,
  precio: precioValido,
  nivel: nivelValido,
  tipoPartido: tipoPartidoValido,
  organizadorEquipoId: z
  .string()
  .max(100, 'ID de equipo demasiado largo')
  .nullable()
  .optional(),
  aprobacionRequerida: z.boolean().default(false),
  pedirPosiciones: z.boolean().default(false),
  posiciones: posicionesValidas,
}).strict();

/* ---------- PATCH /api/partidos/:id ---------- */
export const schemaEditarPartido = z.object({
  titulo: tituloValido.optional(),
  lugar: lugarValido.optional(),
  fecha: fechaValida.optional(),
  cupos: cuposValidos.optional(),
  precio: precioValido.optional(),
  descripcion: descripcionValida,
}).strict();

/* ---------- POST /api/partidos/:id/inscribirse ---------- */
export const schemaInscribirse = z.object({
  posicion: z
    .string()
    .max(50, 'Máximo 50 caracteres')
    .transform(v => v.trim())
    .nullable()
    .optional(),
}).strict();

/* ---------- POST /api/partidos/:id/equipos-postulantes ---------- */
export const schemaPostularEquipo = z.object({
  equipoId: z.string().max(100, 'ID de equipo demasiado largo'),
}).strict();

/* ---------- PATCH /api/partidos/:id/postulantes/:userId ---------- */
export const schemaAprobarPostulante = z.object({
  accion: z.enum(['aprobar', 'rechazar'], {
    errorMap: () => ({ message: 'Acción inválida. Debe ser "aprobar" o "rechazar"' })
  }),
}).strict();

/* ---------- PATCH /api/partidos/:id/equipos-postulantes/:equipoId ---------- */
export const schemaAprobarEquipo = z.object({
  accion: z.enum(['aprobar', 'rechazar'], {
    errorMap: () => ({ message: 'Acción inválida. Debe ser "aprobar" o "rechazar"' })
  }),
}).strict();

/* ---------- GET /api/partidos (query params) ---------- */
export const schemaListarPartidos = z.object({
  deporte: z.string().max(50).optional(),
  tipo: z.enum(['jugador', 'equipo']).optional(),
  estado: z.enum(['abierto', 'lleno', 'finalizado']).optional(),
  nivel: z.enum(['amistoso', 'semiprofesional', 'profesional']).optional(),
  soloMios: z.enum(['true', 'false']).optional(),
  soloInscritos: z.enum(['true', 'false']).optional(),
  busqueda: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

/* ---------- Param :id ---------- */
export const schemaUuidParam = uuidValido;