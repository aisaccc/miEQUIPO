-- =========================================================
-- 015_torneos_equipo_id_flex.sql
-- Flexibilizar FK de torneo_equipos.equipo_id, torneo_lista_espera
-- y torneo_invitaciones para soportar torneos individuales.
-- =========================================================
-- En torneos de equipo, equipo_id → grupos(id).
-- En torneos individuales, equipo_id → usuarios(id).
--
-- Se elimina la FK estricta a grupos.id y se deja la columna
-- sin constraint. La integridad se valida en el service.
-- =========================================================

-- torneo_equipos
ALTER TABLE torneo_equipos
  DROP CONSTRAINT IF EXISTS torneo_equipos_equipo_id_fkey;

-- torneo_lista_espera
ALTER TABLE torneo_lista_espera
  DROP CONSTRAINT IF EXISTS torneo_lista_espera_equipo_id_fkey;

-- torneo_invitaciones
ALTER TABLE torneo_invitaciones
  DROP CONSTRAINT IF EXISTS torneo_invitaciones_equipo_id_fkey;

-- Índices de apoyo para las queries por equipo_id
CREATE INDEX IF NOT EXISTS idx_torneo_equipos_equipo
  ON torneo_equipos (equipo_id);

CREATE INDEX IF NOT EXISTS idx_torneo_lista_espera_equipo
  ON torneo_lista_espera (equipo_id);

CREATE INDEX IF NOT EXISTS idx_torneo_invitaciones_equipo
  ON torneo_invitaciones (equipo_id);