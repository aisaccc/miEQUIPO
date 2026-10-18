/* =========================================================
   mensajes.schema.js — Validación con Zod
   ========================================================= */

import { z } from 'zod';

const uuidValido = z.string().uuid('El ID debe ser un UUID válido');

/* IDs de canal son strings tipo "grupo-<uuid>" o "torneo-<timestamp>-<rand>" */
const canalIdValido = z
  .string({ required_error: 'El ID del canal es obligatorio' })
  .min(3, 'ID de canal inválido')
  .max(80, 'ID de canal inválido');

/* ---------- Imagen (opcional) ----------
   Acepta dataURL base64 (png/jpg/gif/webp) o URL http(s).
   Máx ~3MB en base64.
------------------------------------------ */
const imagenValida = z
  .string()
  .max(4_200_000, 'La imagen es demasiado grande (máx ~3MB)')
  .refine(
    val => {
      if (!val) return true;
      return /^https?:\/\//i.test(val) ||
             /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(val);
    },
    { message: 'La imagen debe ser una URL válida o una imagen' }
  )
  .nullable()
  .optional();

/* ---------- POST /api/mensajes/conversaciones ---------- */
export const schemaCrearConversacion = z.object({
  usuarioId: uuidValido,

  vinculadaTipo: z.enum(['partido', 'torneo']).nullable().optional(),
  vinculadaId: uuidValido.nullable().optional(),
  vinculadaNombre: z
    .string()
    .max(120, 'Máximo 120 caracteres')
    .transform(v => v.trim())
    .nullable()
    .optional(),
}).strict();

/* ---------- POST .../conversaciones/:id/mensajes
              POST .../canales/:id/mensajes ----------
   Ahora acepta { texto?, imagen? }. Al menos uno debe estar presente.
--------------------------------------------------------- */
export const schemaEnviarMensaje = z.object({
  texto: z
    .string()
    .max(2000, 'Máximo 2000 caracteres')
    .transform(v => v.trim())
    .nullable()
    .optional(),

  imagen: imagenValida,
}).strict().refine(
  data => (data.texto && data.texto.length > 0) || data.imagen,
  { message: 'El mensaje debe tener texto o imagen' }
);

/* ---------- Param :id (UUID) ---------- */
export const schemaUuidParam = uuidValido;

/* ---------- Param :id (canal) ---------- */
export const schemaCanalIdParam = canalIdValido;