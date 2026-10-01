/* =========================================================
   validators/index.js
   Helper para validar datos con zod y devolver errores limpios
   ========================================================= */

/**
 * Valida datos con un schema de zod.
 * Si falla, lanza un error con formato consistente.
 * Si pasa, devuelve los datos validados y transformados.
 *
 * @param {z.ZodSchema} schema - el schema de zod
 * @param {any} data - los datos a validar (req.body, req.params, req.query)
 * @returns {any} datos validados y transformados
 */
export function validar(schema, data) {
  const resultado = schema.safeParse(data);

  if (!resultado.success) {
    // Construir un mensaje legible desde los errores de zod
    const errores = resultado.error.issues.map(e => ({
      campo: e.path.join('.') || 'general',
      mensaje: e.message,
    }));

    const err = new Error('Datos inválidos');
    err.status = 400;
    err.name = 'ValidationError';
    err.detalles = errores;
    throw err;
  }

  return resultado.data;
}