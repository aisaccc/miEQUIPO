/* =========================================================
   publicaciones.schema.js — Validación estricta con Zod
   ========================================================= */

import { z } from 'zod';

/* =========================================================
   CAMPOS REUTILIZABLES
   ========================================================= */

const uuidValido = z.string().uuid('El ID debe ser un UUID válido');

const contenidoValido = z
  .string()
  .max(2000, 'Máximo 2000 caracteres')
  .transform(v => v.trim())
  .nullable()
  .optional();

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

/* =========================================================
   SCHEMAS
   ========================================================= */

/* ---------- POST /api/publicaciones  (perfil) ---------- */
export const schemaCrearPublicacion = z.object({
  contenido: contenidoValido,
  imagen: imagenValida,
}).strict().refine(
  data => (data.contenido && data.contenido.length > 0) || data.imagen,
  { message: 'La publicación debe tener texto o imagen' }
);

/* ---------- POST /api/grupos/:id/publicaciones ---------- */
export const schemaCrearPublicacionGrupo = z.object({
  contenido: contenidoValido,
  imagen: imagenValida,
}).strict().refine(
  data => (data.contenido && data.contenido.length > 0) || data.imagen,
  { message: 'La publicación debe tener texto o imagen' }
);

/* ---------- POST /api/torneos/:id/publicaciones ---------- */
export const schemaCrearPublicacionTorneo = z.object({
  contenido: contenidoValido,
  imagen: imagenValida,
}).strict().refine(
  data => (data.contenido && data.contenido.length > 0) || data.imagen,
  { message: 'La publicación debe tener texto o imagen' }
);

/* ---------- PATCH /api/publicaciones/:id ---------- */
export const schemaEditarPublicacion = z.object({
  contenido: contenidoValido,
}).strict();

/* ---------- POST /api/publicaciones/:id/comentarios ---------- */
export const schemaCrearComentario = z.object({
  texto: z
    .string({ required_error: 'El comentario no puede estar vacío' })
    .min(1, 'El comentario no puede estar vacío')
    .max(500, 'Máximo 500 caracteres')
    .transform(v => v.trim()),
}).strict();

/* ---------- Param :id ---------- */
export const schemaUuidParam = uuidValido;