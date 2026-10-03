-- =========================================================
-- 012_torneos_fecha_limite.sql
-- Fecha límite de inscripción para torneos
-- =========================================================
-- Cuando un torneo tiene fecha límite de inscripción,
-- pasada esa fecha ya no se puede inscribir nadie nuevo.
-- Además, el organizador puede cerrar el torneo manualmente.
-- =========================================================

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS fecha_limite_inscripcion TIMESTAMPTZ DEFAULT NULL;

-- Índice para filtrar/buscar por fecha
CREATE INDEX IF NOT EXISTS idx_torneos_fecha_limite
  ON torneos(fecha_limite_inscripcion)
  WHERE fecha_limite_inscripcion IS NOT NULL;

-- Comentario para documentar
COMMENT ON COLUMN torneos.fecha_limite_inscripcion IS
  'Fecha máxima para inscribirse. NULL = sin límite.';