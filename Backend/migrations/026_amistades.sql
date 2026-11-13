-- =========================================================
-- 026_amistades.sql
-- Tabla de amigos (solicitudes, aceptados, rechazados)
-- =========================================================

CREATE TABLE IF NOT EXISTS amistades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  amigo_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Un usuario no puede tener dos registros de amistad con la misma persona
  CONSTRAINT unique_amistad UNIQUE (usuario_id, amigo_id),
  -- No puedes ser amigo de vos mismo
  CONSTRAINT no_autoamistad CHECK (usuario_id != amigo_id)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_amistades_usuario ON amistades(usuario_id);
CREATE INDEX IF NOT EXISTS idx_amistades_amigo ON amistades(amigo_id);
CREATE INDEX IF NOT EXISTS idx_amistades_estado ON amistades(estado);