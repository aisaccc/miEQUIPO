-- 030_eventos_guardados.sql
-- El organizador puede conservar partidos/torneos en "Mis creados".
-- No modifica el estado ni elimina registros existentes.
ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS guardado_por_creador BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS guardado_por_creador BOOLEAN NOT NULL DEFAULT FALSE;

-- Índices parciales para el job de limpieza.
CREATE INDEX IF NOT EXISTS idx_partidos_limpieza
  ON partidos (fecha) WHERE guardado_por_creador = FALSE AND fecha IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_torneos_limpieza
  ON torneos (fecha_fin) WHERE guardado_por_creador = FALSE AND fecha_fin IS NOT NULL;
