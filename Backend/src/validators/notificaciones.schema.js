/* =========================================================
   notificaciones.schema.js — Validación con Zod
   ========================================================= */

import { z } from 'zod';

const uuidValido = z.string().uuid('El ID debe ser un UUID válido');

/* ---------- GET /api/notificaciones (query params) ---------- */
export const schemaListarNotificaciones = z.object({
  soloNoLeidas: z.enum(['true', 'false']).optional(),
  tipo: z
    .string()
    .max(40, 'Tipo inválido')
    .optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

/* ---------- Param :id ---------- */
export const schemaUuidParam = uuidValido;