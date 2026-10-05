-- =========================================================
-- 015_torneos_equipo_id_flex.sql
-- Flexibilizar FK de equipo_id en tablas de torneos para
-- soportar torneos individuales (donde "equipo_id" guarda
-- un usuario_id).
-- =========================================================
-- Las tablas afectadas son:
--   - torneo_equipos.equipo_id              (a grupos)
--   - torneo_lista_espera.equipo_id         (a grupos)
--   - torneo_invitaciones.equipo_id         (a grupos)
--   - torneo_tabla_posiciones.equipo_id     (a grupos)  ← la que rompía
--   - torneo_partidos.equipo_local_id       (a grupos)
--   - torneo_partidos.equipo_visitante_id   (a grupos)
--
-- Se eliminan SOLO las FK que van a grupos. Las FK hacia
-- torneos se mantienen intactas.
--
-- La integridad queda validada por el service según el tipo
-- de torneo.
-- =========================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Eliminamos cualquier FK desde tablas "torneo_*" hacia grupos.
  -- Esto cubre los 6 casos de arriba de forma automática.
  FOR r IN
    SELECT
      conname              AS constraint_name,
      conrelid::regclass   AS tabla
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid = 'grupos'::regclass
      AND conrelid::regclass::text LIKE 'torneo\_%' ESCAPE '\'
  LOOP
    EXECUTE format(
      'ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I',
      r.tabla,
      r.constraint_name
    );
    RAISE NOTICE 'FK eliminada: % en %', r.constraint_name, r.tabla;
  END LOOP;
END $$;

-- Índices de apoyo
CREATE INDEX IF NOT EXISTS idx_torneo_equipos_equipo
  ON torneo_equipos (equipo_id);

CREATE INDEX IF NOT EXISTS idx_torneo_lista_espera_equipo
  ON torneo_lista_espera (equipo_id);

CREATE INDEX IF NOT EXISTS idx_torneo_invitaciones_equipo
  ON torneo_invitaciones (equipo_id);

CREATE INDEX IF NOT EXISTS idx_torneo_tabla_posiciones_equipo
  ON torneo_tabla_posiciones (equipo_id);

CREATE INDEX IF NOT EXISTS idx_torneo_partidos_local
  ON torneo_partidos (equipo_local_id);

CREATE INDEX IF NOT EXISTS idx_torneo_partidos_visitante
  ON torneo_partidos (equipo_visitante_id);