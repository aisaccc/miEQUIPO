-- =========================================================
-- 003_grupos.sql
-- Grupos (equipos + comunidades) + miembros + solicitudes + hilos
-- =========================================================

-- =========================================================
-- GRUPOS
-- =========================================================
CREATE TABLE grupos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 'equipo' | 'comunidad'
  tipo          VARCHAR(20) NOT NULL CHECK (tipo IN ('equipo', 'comunidad')),
  
  nombre        VARCHAR(80) NOT NULL,
  escudo        TEXT,
  deporte       VARCHAR(50) NOT NULL,
  ciudad        VARCHAR(60),
  descripcion   VARCHAR(300),
  
  -- 'publico' | 'privado'
  tipo_acceso   VARCHAR(20) NOT NULL DEFAULT 'publico'
                CHECK (tipo_acceso IN ('publico', 'privado')),
  
  -- Solo equipos tienen stats; comunidades no
  stats_privadas BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Stats de equipos (JSONB): {"victorias":10,"empates":3,"derrotas":2}
  stats         JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Hilos de comunidades (JSONB): array de publicaciones
  hilos         JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Capitán (creador)
  capitan_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grupos_tipo ON grupos(tipo);
CREATE INDEX idx_grupos_deporte ON grupos(deporte);
CREATE INDEX idx_grupos_ciudad ON grupos(ciudad);
CREATE INDEX idx_grupos_capitan ON grupos(capitan_id);

CREATE TRIGGER trg_grupos_updated_at
  BEFORE UPDATE ON grupos
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- MIEMBROS DE GRUPOS
-- =========================================================
CREATE TABLE grupo_miembros (
  grupo_id      UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- 'capitan' | 'admin' | 'miembro'
  rol           VARCHAR(20) NOT NULL DEFAULT 'miembro'
                CHECK (rol IN ('capitan', 'admin', 'miembro')),
  
  posicion      VARCHAR(50),
  dorsal        SMALLINT,
  
  fecha_union   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (grupo_id, usuario_id)
);

CREATE INDEX idx_grupo_miembros_usuario ON grupo_miembros(usuario_id);
CREATE INDEX idx_grupo_miembros_rol ON grupo_miembros(grupo_id, rol);

-- =========================================================
-- SOLICITUDES A GRUPOS (privados)
-- =========================================================
CREATE TABLE grupo_solicitudes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id      UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- 'pendiente' | 'aceptada' | 'rechazada'
  estado        VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
  
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resuelta_en   TIMESTAMPTZ,
  
  -- Solo una solicitud por usuario/grupo
  UNIQUE (grupo_id, usuario_id)
);

CREATE INDEX idx_solicitudes_grupo ON grupo_solicitudes(grupo_id, estado);
CREATE INDEX idx_solicitudes_usuario ON grupo_solicitudes(usuario_id);