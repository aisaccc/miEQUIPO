-- =========================================================
-- 027_invitaciones_links.sql
-- Tabla para guardar tokens de links de invitación (amistad / equipo)
-- =========================================================

CREATE TABLE IF NOT EXISTS invitaciones_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('amistad', 'grupo')),
  referencia_id UUID NOT NULL, -- Si es 'amistad', es el ID del creador. Si es 'grupo', es el ID del grupo.
  creador_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitaciones_token ON invitaciones_links(token);