/* Manejo global de errores */
export function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.message);

  /* Error de validación (Zod) */
  if (err.name === 'ZodError' || err.name === 'ValidationError' || Array.isArray(err.errors)) {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: err.errors || err.detalles || [],
    });
  }

  /* Errores de PostgreSQL */
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Ese registro ya existe' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referencia inválida' });
  }
  if (err.code === '22P02') {
    return res.status(400).json({ error: 'Formato inválido' });
  }
  if (err.code === '23514') {
    console.error('[CHECK VIOLATION]', err.message);

    return res.status(400).json({
      error: 'Valor no permitido'
    });
  }

  const status =
    Number.isInteger(err.status) &&
    err.status >= 400 &&
    err.status < 500
      ? err.status
      : 500;

  if (status === 500) {
    return res.status(500).json({
      error: 'Error interno del servidor'
    });
  }

  return res.status(status).json({
    error: err.message || 'Solicitud inválida'
  });
}
export function notFound(req, res) {
  return res.status(404).json({
    error: 'Ruta no encontrada'
  });
}