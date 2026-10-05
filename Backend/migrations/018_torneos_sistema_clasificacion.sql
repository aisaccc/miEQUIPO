-- =========================================================
-- 018_torneos_sistema_clasificacion.sql
-- Sistema de clasificación para deportes por tiempo/puntaje
-- =========================================================
-- Hay deportes que no se puntúan por goles ni por sets, sino
-- por:
--   - TIEMPO  → menor tiempo gana (natación, atletismo, ciclismo).
--   - PUNTOS  → mayor puntaje gana (escalada, surf, boxeo).
--
-- El organizador elige el sistema al crear el torneo.
-- El default 'simple' mantiene el comportamiento actual
-- (goles/puntos/carreras o sets, según el deporte).
--
-- Valores:
--   'simple' → goles, puntos, carreras, sets (lo de siempre)
--   'tiempo' → menor tiempo gana (se guarda en segundos)
--   'puntos' → mayor puntaje gana
-- =========================================================

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS sistema_clasificacion VARCHAR(20) NOT NULL DEFAULT 'simple'
    CHECK (sistema_clasificacion IN ('simple', 'tiempo', 'puntos'));

CREATE INDEX IF NOT EXISTS idx_torneos_sistema_clasificacion
  ON torneos (sistema_clasificacion);

COMMENT ON COLUMN torneos.sistema_clasificacion IS
  'Sistema de clasificación: simple (goles/sets), tiempo (menor gana) o puntos (mayor gana).';