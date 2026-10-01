/* Manejo global de errores */
export function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.message);

  /* Error de validación (nuestro helper o zod directo) */
  if (err.name === 'ValidationError' || err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: err.detalles || err.errors || [],
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
    // UUID inválido, por ejemplo
    return res.status(400).json({ error: 'Formato inválido' });
  }

  /* Error genérico */
  const status = err.status || 500;
  const mensaje = err.message || 'Error interno del servidor';

  // En producción, no exponer detalles internos
  if (status === 500 && process.env.NODE_ENV === 'production') {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  res.status(status).json({ error: mensaje });
}

/* Middleware para 404 */
export function notFound(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.originalUrl}` });
}