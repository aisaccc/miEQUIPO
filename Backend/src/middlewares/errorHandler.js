/* Manejo global de errores */
export function errorHandler(err, req, res, next) {
  console.error('[ERROR]', {
    name: err.name,
    code: err.code,
  });

  /* Error de validación (Zod) */
  if (
    err.name === 'ZodError' ||
    err.name === 'ValidationError' ||
    Array.isArray(err.errors)
  ) {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: err.errors || err.detalles || [],
    });
  }

  /* Errores de PostgreSQL */
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'Ese registro ya existe',
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      error: 'Referencia inválida',
    });
  }

  if (err.code === '22P02') {
    return res.status(400).json({
      error: 'Formato inválido',
    });
  }

  if (err.code === '23514') {
    return res.status(400).json({
      error: 'Valor no permitido',
    });
  }

  /* JSON inválido */
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Datos inválidos',
    });
  }

  /* Error genérico */
  const status = err.status || 500;
  const mensaje = err.message || 'Error interno del servidor';

  if (status >= 500) {
    return res.status(status).json({
      error: 'Error interno del servidor',
    });
  }

  res.status(status).json({ error: mensaje });
}

/* Middleware para 404 */
export function notFound(req, res) {
  res.status(404).json({
    error: 'Ruta no encontrada',
  });
}