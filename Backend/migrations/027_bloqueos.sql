-- =========================================================
-- 027_bloqueos.sql
-- Tabla de usuarios bloqueados
-- =========================================================

CREATE TABLE IF NOT EXISTS usuarios_bloqueados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  bloqueado_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- No puedes bloquearte a vos mismo
  CONSTRAINT no_auto_bloqueo CHECK (usuario_id != bloqueado_id),
  -- Un usuario no puede bloquear dos veces al mismo
  CONSTRAINT unique_bloqueo UNIQUE (usuario_id, bloqueado_id)
);

CREATE INDEX IF NOT EXISTS idx_bloqueos_usuario ON usuarios_bloqueados(usuario_id);
CREATE INDEX IF NOT EXISTS idx_bloqueos_bloqueado ON usuarios_bloqueados(bloqueado_id);