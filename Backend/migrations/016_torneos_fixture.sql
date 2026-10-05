-- =========================================================
-- 016_torneos_fixture.sql
-- Fixture para torneos (liga y eliminación) + jornadas
-- =========================================================
-- Agrega lo necesario para:
--   - Configurar si la liga es ida simple o ida y vuelta.
--   - Guardar jornadas como filas reales (permite agregar/borrar).
--   - Soporte completo para fixtures de eliminación:
--     * fase (cuartos, semis, final, ...)
--     * posición dentro de la fase (para armar el bracket)
--     * referencia al partido siguiente (para avanzar ganadores)
--     * marca de bye (pasa directo sin jugar)
--   - Bloquear el fixture una vez confirmado.
-- =========================================================

-- =========================================================
-- 1. TORNEOS: columnas nuevas
-- =========================================================

ALTER TABLE torneos
  -- Si TRUE, la liga es ida y vuelta (duplica las jornadas)
  ADD COLUMN IF NOT EXISTS ida_y_vuelta BOOLEAN NOT NULL DEFAULT FALSE,

  -- Si TRUE, el fixture de eliminación ya fue confirmado y
  -- ya no se pueden editar los cruces (solo cargar resultados)
  ADD COLUMN IF NOT EXISTS fixture_bloqueado BOOLEAN NOT NULL DEFAULT FALSE;

-- =========================================================
-- 2. TORNEO_JORNADAS: filas reales
-- =========================================================
-- Cada fila representa una jornada (ej: "Jornada 1").
-- Los partidos de liga se asocian a una jornada por su id.
-- El organizador puede agregar/borrar jornadas mientras el
-- torneo esté en fase de armado.

CREATE TABLE IF NOT EXISTS torneo_jornadas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id     UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,

  numero        SMALLINT NOT NULL,       -- 1, 2, 3...
  nombre        VARCHAR(60) NOT NULL,    -- "Jornada 1", "Fecha 2", etc.
  fecha         DATE,                    -- opcional

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (torneo_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_torneo_jornadas_torneo
  ON torneo_jornadas (torneo_id, numero);

-- =========================================================
-- 3. TORNEO_PARTIDOS: columnas nuevas
-- =========================================================
-- - jornada_id: FK a torneo_jornadas (para liga)
-- - fase: cuartos, semis, final, etc. (para eliminación)
-- - posicion_en_fase: orden dentro de la fase
-- - siguiente_partido_id: a qué partido va el ganador
-- - es_bye: TRUE si el equipo pasa directo sin jugar

ALTER TABLE torneo_partidos
  ADD COLUMN IF NOT EXISTS jornada_id UUID REFERENCES torneo_jornadas(id) ON DELETE SET NULL,

  ADD COLUMN IF NOT EXISTS fase VARCHAR(20),

  ADD COLUMN IF NOT EXISTS posicion_en_fase SMALLINT,

  ADD COLUMN IF NOT EXISTS siguiente_partido_id UUID REFERENCES torneo_partidos(id) ON DELETE SET NULL,

  ADD COLUMN IF NOT EXISTS es_bye BOOLEAN NOT NULL DEFAULT FALSE;

-- CHECK para fases válidas (solo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'torneo_partidos_fase_check'
  ) THEN
    ALTER TABLE torneo_partidos
      ADD CONSTRAINT torneo_partidos_fase_check
      CHECK (fase IS NULL OR fase IN (
        '32avos', '16avos', '8vos', 'cuartos', 'semis', 'final', 'tercer_puesto'
      ));
  END IF;
END $$;

-- Índices de apoyo
CREATE INDEX IF NOT EXISTS idx_torneo_partidos_jornada
  ON torneo_partidos (jornada_id);

CREATE INDEX IF NOT EXISTS idx_torneo_partidos_fase_pos
  ON torneo_partidos (torneo_id, fase, posicion_en_fase);

CREATE INDEX IF NOT EXISTS idx_torneo_partidos_siguiente
  ON torneo_partidos (siguiente_partido_id);

-- =========================================================
-- 4. COMENTARIOS
-- =========================================================
COMMENT ON COLUMN torneos.ida_y_vuelta IS
  'TRUE si la liga es ida y vuelta. Duplica las jornadas.';

COMMENT ON COLUMN torneos.fixture_bloqueado IS
  'TRUE si el fixture de eliminación ya fue confirmado y no se puede editar.';

COMMENT ON COLUMN torneo_partidos.jornada_id IS
  'FK a torneo_jornadas. Solo aplica a partidos de liga.';

COMMENT ON COLUMN torneo_partidos.fase IS
  'Fase del bracket de eliminación: cuartos, semis, final, etc.';

COMMENT ON COLUMN torneo_partidos.posicion_en_fase IS
  'Orden del partido dentro de la fase (0, 1, 2...). Determina a qué partido avanza el ganador.';

COMMENT ON COLUMN torneo_partidos.siguiente_partido_id IS
  'Partido de la siguiente fase donde avanza el ganador.';

COMMENT ON COLUMN torneo_partidos.es_bye IS
  'TRUE si un equipo pasa directo sin jugar (número impar de participantes).';