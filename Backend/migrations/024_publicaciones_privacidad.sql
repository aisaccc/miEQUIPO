-- =========================================================
-- 024_publicaciones_privacidad.sql
-- Agrega privacidad a las publicaciones de grupo (equipo)
-- =========================================================
-- Valores:
--   'publico'  → cualquiera que vea el equipo
--   'miembros' → solo miembros del equipo
--   'staff'    → solo capitán y sub-capitanes

ALTER TABLE publicaciones
  ADD COLUMN IF NOT EXISTS privacidad VARCHAR(20) NOT NULL DEFAULT 'publico';

-- Constraint de valores válidos
ALTER TABLE publicaciones
  DROP CONSTRAINT IF EXISTS chk_pub_privacidad;

ALTER TABLE publicaciones
  ADD CONSTRAINT chk_pub_privacidad
  CHECK (privacidad IN ('publico', 'miembros', 'staff'));

-- Índice (por si se necesita filtrar por privacidad)
CREATE INDEX IF NOT EXISTS idx_pub_privacidad
  ON publicaciones(grupo_id, privacidad) WHERE grupo_id IS NOT NULL;