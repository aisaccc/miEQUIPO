import { z } from 'zod';

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
    val => !val || /^https?:\/\//i.test(val) || /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(val),
    { message: 'La imagen debe ser una URL válida o una imagen' }
  )
  .nullable()
  .optional();

const videoValido = z
  .string()
  .max(6_300_000, 'El video es demasiado grande (máx ~5MB)')
  .refine(
    val => !val || /^https?:\/\//i.test(val) || /^data:video\/(mp4|webm|ogg);base64,/i.test(val),
    { message: 'El video debe ser una URL válida o un video' }
  )
  .nullable()
  .optional();

// ⚡ Nueva regla unificada de privacidad
const privacidadValida = z.enum(['publico', 'amigos', 'privado', 'miembros', 'staff'], {
  errorMap: () => ({ message: 'Privacidad inválida' }),
}).optional().default('publico');

/* ---------- POST /api/publicaciones (perfil / inicio) ---------- */
export const schemaCrearPublicacion = z.object({
  contenido: contenidoValido,
  imagen: imagenValida,
  video: videoValido,
  tipo: z.enum(['post', 'partido', 'torneo', 'grupo']).optional().default('post'),
  privacidad: privacidadValida,
}).strict().refine(
  data => (data.contenido && data.contenido.length > 0) || data.imagen || data.video,
  { message: 'La publicación debe tener texto, imagen o video' }
);

/* ---------- POST /api/grupos/:id/publicaciones ---------- */
export const schemaCrearPublicacionGrupo = z.object({
  contenido: contenidoValido,
  imagen: imagenValida,
  video: videoValido,
  tipo: z.enum(['post', 'partido', 'torneo', 'grupo']).optional().default('post'),
  privacidad: privacidadValida,
}).strict().refine(
  data => (data.contenido && data.contenido.length > 0) || data.imagen || data.video,
  { message: 'La publicación debe tener texto, imagen o video' }
);

/* ---------- POST /api/torneos/:id/publicaciones ---------- */
export const schemaCrearPublicacionTorneo = z.object({
  contenido: contenidoValido,
  imagen: imagenValida,
  video: videoValido,
  tipo: z.enum(['post', 'partido', 'torneo', 'grupo']).optional().default('post'),
  privacidad: privacidadValida,
}).strict().refine(
  data => (data.contenido && data.contenido.length > 0) || data.imagen || data.video,
  { message: 'La publicación debe tener texto, imagen o video' }
);

/* ---------- PATCH /api/publicaciones/:id (contenido) ---------- */
export const schemaEditarPublicacion = z.object({
  contenido: contenidoValido,
}).strict();

/* ---------- PATCH /api/publicaciones/:id/privacidad ---------- */
export const schemaEditarPrivacidad = z.object({
  privacidad: z.enum(['publico', 'amigos', 'privado', 'miembros', 'staff']),
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