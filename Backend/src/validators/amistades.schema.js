import { z } from 'zod';

export const schemaUuidParam = z.string().uuid('ID inválido');

export const schemaResponderSolicitud = z.object({
  accion: z.enum(['aceptar', 'rechazar'], {
    errorMap: () => ({ message: 'Acción inválida. Debe ser "aceptar" o "rechazar"' })
  })
}).strict();