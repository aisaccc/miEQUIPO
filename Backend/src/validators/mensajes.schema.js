/* =========================================================
   mensajes.schema.js — Validación con Zod
   ========================================================= */

import { z } from 'zod';

const uuidValido = z.string().uuid('El ID debe ser un UUID válido');

/* ---------- POST /api/mensajes/conversaciones ---------- */
export const schemaCrearConversacion = z.object({
  usuarioId: uuidValido,

  // Opcional: vincular a partido o torneo
  vinculadaTipo: z.enum(['partido', 'torneo']).nullable().optional(),
  vinculadaId: uuidValido.nullable().optional(),
  vinculadaNombre: z
    .string()
    .max(120, 'Máximo 120 caracteres')
    .transform(v => v.trim())
    .nullable()
    .optional(),
}).strict();

/* ---------- POST /api/mensajes/conversaciones/:id/mensajes ---------- */
export const schemaEnviarMensaje = z.object({
  texto: z
    .string({ required_error: 'El mensaje no puede estar vacío' })
    .min(1, 'El mensaje no puede estar vacío')
    .max(2000, 'Máximo 2000 caracteres')
    .transform(v => v.trim()),
}).strict();

/* ---------- Param :id ---------- */
export const schemaUuidParam = uuidValido;