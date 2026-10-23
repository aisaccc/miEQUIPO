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
  .enum(['amistoso', 'medio', 'avanzado'], {
    errorMap: () => ({ message: 'Nivel inválido. Debe ser "amistoso", "medio" o "avanzado"' })
  })
  .default('amistoso');

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

const faseValida = z.enum(
  ['32avos', '16avos', '8vos', 'cuartos', 'semis', 'final', 'tercer_puesto'],
  { errorMap: () => ({ message: 'Fase inválida' }) }
);

/* ⚡ NUEVO: sistema de clasificación */
const sistemaClasificacionValido = z
  .enum(['simple', 'tiempo', 'puntos'], {
    errorMap: () => ({
      message: 'Sistema inválido. Debe ser "simple", "tiempo" o "puntos"'
    })
  })
  .default('simple');

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
  tipoParticipacion: tipoParticipacionValido,
  idaYVuelta: z.boolean().default(false),

  // Auto-fixture para eliminación
  autoFixture: z.boolean().default(false),

  // ⚡ NUEVO: sistema de clasificación
  sistemaClasificacion: sistemaClasificacionValido,

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
  tipoParticipacion: tipoParticipacionValido.optional(),
  idaYVuelta: z.boolean().optional(),

  autoFixture: z.boolean().optional(),

  // ⚡ NUEVO
  sistemaClasificacion: sistemaClasificacionValido.optional(),

  puntosVictoria: z.number().int().min(0).max(10).optional(),
  puntosEmpate: z.number().int().min(0).max(10).optional(),
  puntosDerrota: z.number().int().min(0).max(10).optional(),
  permiteEmpate: z.boolean().optional(),
  incluyeEstadisticas: z.boolean().optional(),
  equiposClasifican: z.number().int().min(0).max(64).nullable().optional(),
}).strict();

/* ---------- POST /api/torneos/:id/inscribir ---------- */
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

/* =========================================================
   FIXTURE / CRUCES
   ========================================================= */

export const schemaCrearPartidoTorneo = z.object({
  ronda: z.string().min(1).max(30).transform(v => v.trim()),
  orden: z.number().int().min(0).max(1000).default(0),
  equipoLocalId: z.string().max(100).nullable().optional(),
  equipoVisitanteId: z.string().max(100).nullable().optional(),
  fecha: fechaOpcional,
  jornadaId: uuidValido.nullable().optional(),
}).strict();

/* ---------- PATCH /api/torneos/:id/partidos/:partidoId/resultado ---------- */
export const schemaCargarResultado = z.object({
  resultado: z.record(z.any()),
  estadisticas: z.record(z.any()).nullable().optional(),
  estado: z.enum(['pendiente', 'en_curso', 'finalizado', 'cancelado']).optional(),
}).strict();

export const schemaEditarPartidoTorneo = z.object({
  equipoLocalId: z.string().max(100).nullable().optional(),
  equipoVisitanteId: z.string().max(100).nullable().optional(),
  fecha: fechaOpcional,
  jornadaId: uuidValido.nullable().optional(),
  orden: z.number().int().min(0).max(1000).optional(),
}).strict();

export const schemaCerrarTorneo = z.object({}).strict();

export const schemaListarTorneos = z.object({
  deporte: z.string().max(50).optional(),
  estado: z.enum(['inscripcion', 'en_curso', 'finalizado']).optional(),
  modalidad: z.enum(['liga', 'eliminacion', 'custom']).optional(),
  nivel: z.enum(['amistoso', 'medio', 'avanzado']).optional(),
  tipoParticipacion: z.enum(['equipo', 'individual']).optional(),
  sistemaClasificacion: z.enum(['simple', 'tiempo', 'puntos']).optional(),
  soloMios: z.enum(['true', 'false']).optional(),
  soloInscritos: z.enum(['true', 'false']).optional(),
  busqueda: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

/* =========================================================
   JORNADAS (liga)
   ========================================================= */

export const schemaCrearJornada = z.object({
  nombre: z.string().min(1).max(60).transform(v => v.trim()),
  fecha: fechaOpcional,
}).strict();

export const schemaEditarJornada = z.object({
  nombre: z.string().min(1).max(60).transform(v => v.trim()).optional(),
  fecha: fechaOpcional,
}).strict();

/* =========================================================
   GUARDAR JORNADA BULK
   ========================================================= */
const schemaPartidoBulk = z.object({
  id: uuidValido,
  fecha: z
    .union([
      z.string().refine(val => !isNaN(Date.parse(val)), { message: 'Fecha inválida' })
        .transform(val => new Date(val).toISOString()),
      z.null(),
    ])
    .optional(),
  resultado: z.record(z.any()).nullable().optional(),
  estado: z.enum(['pendiente', 'en_curso', 'finalizado', 'cancelado']).optional(),
}).strict();

export const schemaGuardarJornadaBulk = z.object({
  jornada: z
    .object({
      nombre: z.string().min(1).max(60).transform(v => v.trim()).optional(),
      fecha: z
        .union([
          z.string().refine(val => !isNaN(Date.parse(val)), { message: 'Fecha inválida' })
            .transform(val => new Date(val).toISOString()),
          z.null(),
        ])
        .optional(),
    })
    .strict()
    .optional(),
  partidos: z.array(schemaPartidoBulk).optional(),
  partidosEliminar: z.array(uuidValido).optional(),
}).strict();

/* =========================================================
   FIXTURE AUTOMÁTICO — LIGA
   ========================================================= */
export const schemaGenerarFixtureLiga = z.object({}).strict();

/* =========================================================
   FIXTURE — ELIMINACIÓN
   ========================================================= */

export const schemaArmarFixtureAleatorio = z.object({}).strict();

export const schemaArmarFixtureManual = z.object({
  cruces: z.array(
    z.object({
      localId: z.string().uuid('ID local inválido'),
      visitanteId: z.string().uuid('ID visitante inválido').nullable(),
    })
  ).min(1, 'Mínimo 1 cruce'),
}).strict();

export const schemaConfirmarFixture = z.object({}).strict();

/* =========================================================
   EDITAR CRUCE INDIVIDUAL
   ========================================================= */
export const schemaEditarCruce = z.object({
  equipoLocalId: z.string().max(100).nullable().optional(),
  equipoVisitanteId: z.string().max(100).nullable().optional(),
}).strict();

/* =========================================================
   PARAMS
   ========================================================= */
export const schemaUuidParam = uuidValido;

export const schemaEquipoIdParam = z
  .string()
  .max(100, 'ID de equipo inválido');


/* =========================================================
   SUB-ORGANIZADORES — INVITACIÓN (D.3)
   ========================================================= */

/* POST /api/torneos/:id/organizadores/invitaciones */
export const schemaInvitarOrganizador = z.object({
  usuarioId: uuidValido,
  permisos: permisosValidos,
}).strict();

/* PATCH /api/torneos/:id/organizadores/invitaciones/responder */
export const schemaResponderInvitacionOrganizador = z.object({
  aceptar: z.boolean({
    required_error: 'Tenés que indicar si aceptás o rechazás',
  }),
}).strict();