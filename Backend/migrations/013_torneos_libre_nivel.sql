-- =========================================================
-- 013_torneos_libre_nivel.sql
-- Nivel del torneo + libre inscripción
-- =========================================================
-- - nivel: 'amistoso' | 'semiprofesional' | 'profesional'
-- - libre_inscripcion: si es TRUE, cualquiera con equipo del deporte
--   se inscribe directo. Si es FALSE, va a lista de espera.
--
-- Reglas de negocio:
-- - Si el torneo es PAGO → siempre va a lista de espera
--   (el organizador coordina el pago con el capitán).
-- - Si es GRATIS:
--   * nivel amistoso → libre inscripción (default TRUE).
--   * nivel semipro/pro → el organizador decide.
-- =========================================================

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS nivel VARCHAR(30) NOT NULL DEFAULT 'amistoso'
    CHECK (nivel IN ('amistoso', 'semiprofesional', 'profesional')),

  ADD COLUMN IF NOT EXISTS libre_inscripcion BOOLEAN NOT NULL DEFAULT TRUE;