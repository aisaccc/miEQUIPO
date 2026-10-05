-- =========================================================
-- 017_torneos_auto_fixture.sql
-- Switch "auto armar fixture" para torneos de eliminación
-- =========================================================
-- Cuando el organizador crea un torneo de eliminación, puede
-- elegir si quiere que el fixture se arme automáticamente
-- (aleatorio) al cerrar las inscripciones.
--
-- - auto_fixture = TRUE  → al cerrar inscripciones se arma
--   el bracket automáticamente con los inscritos.
-- - auto_fixture = FALSE → el organizador arma el bracket
--   manualmente después.
-- =========================================================

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS auto_fixture BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN torneos.auto_fixture IS
  'TRUE si el fixture de eliminación se arma automáticamente al cerrar inscripciones.';