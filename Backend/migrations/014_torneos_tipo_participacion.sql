-- =========================================================
-- 014_torneos_tipo_participacion.sql
-- Tipo de participación del torneo (equipo vs individual)
-- =========================================================
-- - tipo_participacion:
--   * 'equipo'     → se inscriben equipos (default, como estaba)
--   * 'individual' → se inscriben usuarios sueltos (Tenis, Boxeo, etc.)
--
-- - es_individual (en torneo_equipos):
--   * FALSE → la fila referencia a un grupo/equipo
--   * TRUE  → la fila referencia a un usuario (deporte individual)
--
-- Reglas:
-- - Torneos de equipo → validan deporte del equipo contra el torneo.
-- - Torneos individuales → no requieren equipo, se guarda el usuario
--   como "participante" reusando torneo_equipos.
-- - Se mantiene toda la lógica de libre inscripción / lista de espera.
-- =========================================================

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS tipo_participacion VARCHAR(20) NOT NULL DEFAULT 'equipo'
    CHECK (tipo_participacion IN ('equipo', 'individual'));

ALTER TABLE torneo_equipos
  ADD COLUMN IF NOT EXISTS es_individual BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para acelerar consultas por tipo
CREATE INDEX IF NOT EXISTS idx_torneos_tipo_participacion
  ON torneos (tipo_participacion);

CREATE INDEX IF NOT EXISTS idx_torneo_equipos_es_individual
  ON torneo_equipos (torneo_id, es_individual);

-- También aplica a lista de espera e invitaciones (para no mezclar)
ALTER TABLE torneo_lista_espera
  ADD COLUMN IF NOT EXISTS es_individual BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE torneo_invitaciones
  ADD COLUMN IF NOT EXISTS es_individual BOOLEAN NOT NULL DEFAULT FALSE;