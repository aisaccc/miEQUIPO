/* =========================================================
   torneos.schema.js — Validación estricta con Zod
   ========================================================= */

import { z } from 'zod';

/* =========================================================
   CAMPOS REUTILIZABLES
   ========================================================= */

const uuidValido = z.string().uuid('El ID debe ser un UUID válido');

const nombreValido = z
  .string({ required_error: 'El nombre es obligatorio' })
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
  .refine(val => !isNaN(Date.parse(val)), { message: 'Fecha inválida' })
  .transform(val => new Date(val).toISOString());

const fechaOpcional = z
  .string()
  .refine(val => !val || !isNaN(Date.parse(val)), { message: 'Fecha inválida' })
  .transform(val => val ? new Date(val).toISOString() : null)
  .nullable()
  .optional();

const cuposValidos = z
  .number({ required_error: 'Los cupos son obligatorios' })
  .int('Debe ser un número entero')
  .min(2, 'Mínimo 2 equipos')
  .max(64, 'Máximo 64 equipos');

const precioValido = z
  .number()
  .int('Debe ser un número entero')
  .min(0, 'El precio no puede ser negativo')
  .max(10_000_000, 'Precio demasiado alto')
  .default(0);

const emojiValido = z
  .string()
  .max(500, 'Emoji inválido')
  .nullable()
  .optional();

const modalidadValida = z
  .enum(['liga', 'eliminacion', 'custom'], {
    errorMap: () => ({ message: 'Modalidad inválida. Debe ser "liga", "eliminacion" o "custom"' })
  })
  .default('liga');

const nivelValido = z
  .enum(['amistoso', 'semiprofesional', 'profesional'], {
    errorMap: () => ({ message: 'Nivel inválido. Debe ser "amistoso", "semiprofesional" o "profesional"' })
  })
  .default('amistoso');

// ⚡ NUEVO: tipo de participación
const tipoParticipacionValido = z
  .enum(['equipo', 'individual'], {
    errorMap: () => ({ message: 'Tipo de participación inválido. Debe ser "equipo" o "individual"' })
  })
  .default('equipo');

const permisosValidos = z
  .enum(['resultados', 'completo'], {
    errorMap: () => ({ message: 'Permisos inválidos. Debe ser "resultados" o "completo"' })
  })
  .default('resultados');

/* =========================================================
   SCHEMAS
   ========================================================= */

/* ---------- POST /api/torneos ---------- */
export const schemaCrearTorneo = z.object({
  nombre: nombreValido,
  deporte: deporteValido,
  emoji: emojiValido,
  descripcion: descripcionValida,
  lugar: lugarValido,
  fechaInicio: fechaValida,
  fechaFin: fechaOpcional,
  fechaLimiteInscripcion: fechaOpcional,
  cuposEquipos: cuposValidos,
  precio: precioValido,

  modalidad: modalidadValida,
  nivel: nivelValido,
  libreInscripcion: z.boolean().default(true),

  // ⚡ NUEVO: tipo de participación (equipo o individual)
  tipoParticipacion: tipoParticipacionValido,

  puntosVictoria: z.number().int().min(0).max(10).default(3),
  puntosEmpate: z.number().int().min(0).max(10).default(1),
  puntosDerrota: z.number().int().min(0).max(10).default(0),
  permiteEmpate: z.boolean().default(true),
  incluyeEstadisticas: z.boolean().default(false),
  equiposClasifican: z.number().int().min(0).max(64).nullable().optional(),
}).strict();

/* ---------- PATCH /api/torneos/:id ---------- */
export const schemaEditarTorneo = z.object({
  nombre: nombreValido.optional(),
  deporte: deporteValido.optional(),
  emoji: emojiValido,
  descripcion: descripcionValida,
  lugar: lugarValido.optional(),
  fechaInicio: fechaValida.optional(),
  fechaFin: fechaOpcional,
  fechaLimiteInscripcion: fechaOpcional,
  cuposEquipos: cuposValidos.optional(),
  precio: precioValido.optional(),

  modalidad: modalidadValida.optional(),
  nivel: nivelValido.optional(),
  libreInscripcion: z.boolean().optional(),

  // ⚡ NUEVO: se puede editar el tipo de participación
  tipoParticipacion: tipoParticipacionValido.optional(),

  puntosVictoria: z.number().int().min(0).max(10).optional(),
  puntosEmpate: z.number().int().min(0).max(10).optional(),
  puntosDerrota: z.number().int().min(0).max(10).optional(),
  permiteEmpate: z.boolean().optional(),
  incluyeEstadisticas: z.boolean().optional(),
  equiposClasifican: z.number().int().min(0).max(64).nullable().optional(),
}).strict();

/* ---------- POST /api/torneos/:id/inscribir ---------- */
/*
  En torneos de EQUIPO:
    - equipoId es obligatorio y debe ser UUID válido.
  En torneos INDIVIDUALES:
    - equipoId puede venir null, undefined o ausente.
    - El backend ignora ese valor y usa el usuario autenticado.
*/
export const schemaInscribirEquipo = z.object({
  equipoId: z
    .union([
      z.string().max(100, 'ID de equipo inválido'),
      z.null(),
      z.undefined(),
    ])
    .optional(),
}).strict();

/* ---------- PATCH /api/torneos/:id/solicitudes/:equipoId ---------- */
export const schemaAprobarSolicitud = z.object({
  accion: z.enum(['aprobar', 'rechazar'], {
    errorMap: () => ({ message: 'Acción inválida. Debe ser "aprobar" o "rechazar"' })
  }),
}).strict();

/* ---------- POST /api/torneos/:id/invitaciones ---------- */
/*
  Solo aplica a torneos de EQUIPO.
  Los torneos individuales no permiten invitar equipos.
*/
export const schemaInvitarEquipo = z.object({
  equipoId: z
    .string({ required_error: 'El ID del equipo es obligatorio' })
    .max(100, 'ID de equipo inválido'),
}).strict();

/* ---------- POST /api/torneos/:id/organizadores ---------- */
export const schemaAgregarOrganizador = z.object({
  usuarioId: uuidValido,
  permisos: permisosValidos,
}).strict();

/* ---------- POST /api/torneos/:id/partidos ---------- */
export const schemaCrearPartidoTorneo = z.object({
  ronda: z.string().min(1).max(30).transform(v => v.trim()),
  orden: z.number().int().min(0).max(1000).default(0),
  equipoLocalId: z.string().max(100).nullable().optional(),
  equipoVisitanteId: z.string().max(100).nullable().optional(),
  fecha: fechaOpcional,
}).strict();

/* ---------- PATCH /api/torneos/:id/partidos/:partidoId ---------- */
export const schemaCargarResultado = z.object({
  resultado: z.record(z.any()),
  estadisticas: z.record(z.any()).nullable().optional(),
  estado: z.enum(['pendiente', 'en_curso', 'finalizado', 'cancelado']).optional(),
}).strict();

/* ---------- PATCH /api/torneos/:id/cerrar ---------- */
export const schemaCerrarTorneo = z.object({}).strict();

/* ---------- GET /api/torneos ---------- */
export const schemaListarTorneos = z.object({
  deporte: z.string().max(50).optional(),
  estado: z.enum(['inscripcion', 'en_curso', 'finalizado']).optional(),
  modalidad: z.enum(['liga', 'eliminacion', 'custom']).optional(),
  nivel: z.enum(['amistoso', 'semiprofesional', 'profesional']).optional(),
  tipoParticipacion: z.enum(['equipo', 'individual']).optional(),
  soloMios: z.enum(['true', 'false']).optional(),
  soloInscritos: z.enum(['true', 'false']).optional(),
  busqueda: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

/* ---------- Params ---------- */
export const schemaUuidParam = uuidValido;

export const schemaEquipoIdParam = z
  .string()
  .max(100, 'ID de equipo inválido');