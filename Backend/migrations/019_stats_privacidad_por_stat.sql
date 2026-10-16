-- =========================================================
-- 019_stats_privacidad_por_stat.sql
-- Privacidad por stat individual (victorias / empates / derrotas)
-- =========================================================
-- Agrega 3 columnas booleanas que indican si cada stat es
-- privada o pública de forma independiente.
-- La columna `stats_privadas` original queda como fallback:
-- si estaba en TRUE, los 3 flags se marcan TRUE (respeta la
-- decisión previa del usuario).
-- =========================================================

-- 1) Agregar columnas
ALTER TABLE grupos
  ADD COLUMN IF NOT EXISTS stats_victorias_privadas BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stats_empates_privadas   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stats_derrotas_privadas  BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) Migrar el flag global a los 3 flags individuales
--    (si stats_privadas era TRUE, ahora los 3 son privados)
UPDATE grupos
SET
  stats_victorias_privadas = TRUE,
  stats_empates_privadas   = TRUE,
  stats_derrotas_privadas  = TRUE
WHERE stats_privadas = TRUE;

-- 3) Comentario documental
COMMENT ON COLUMN grupos.stats_victorias_privadas IS 'Si TRUE, solo miembros ven el conteo de victorias';
COMMENT ON COLUMN grupos.stats_empates_privadas   IS 'Si TRUE, solo miembros ven el conteo de empates';
COMMENT ON COLUMN grupos.stats_derrotas_privadas  IS 'Si TRUE, solo miembros ven el conteo de derrotas';