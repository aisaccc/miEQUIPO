-- =========================================================
-- 019_torneo_organizadores_invitaciones.sql
-- Invitaciones a sub-organizadores de torneos
-- =========================================================
-- El organizador principal invita a otro usuario a ser
-- sub-organizador. El invitado acepta o rechaza.
-- Solo al aceptar se inserta en `torneo_organizadores`.
-- =========================================================

CREATE TABLE IF NOT EXISTS torneo_organizadores_invitaciones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id      UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
  invitado_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  invitado_por   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  permisos       VARCHAR(20) NOT NULL DEFAULT 'completo'
                 CHECK (permisos IN ('resultados', 'completo')),

  estado         VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'cancelada')),

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resuelta_en    TIMESTAMPTZ,

  UNIQUE (torneo_id, invitado_id)
);

CREATE INDEX IF NOT EXISTS idx_torneo_org_inv_torneo
  ON torneo_organizadores_invitaciones (torneo_id, estado);

CREATE INDEX IF NOT EXISTS idx_torneo_org_inv_invitado
  ON torneo_organizadores_invitaciones (invitado_id, estado);

COMMENT ON TABLE torneo_organizadores_invitaciones IS
  'Invitaciones pendientes para ser sub-organizador de un torneo.';
COMMENT ON COLUMN torneo_organizadores_invitaciones.permisos IS
  'Permisos del sub-organizador: "resultados" o "completo".';
COMMENT ON COLUMN torneo_organizadores_invitaciones.estado IS
  'pendiente → aceptada | rechazada | cancelada';