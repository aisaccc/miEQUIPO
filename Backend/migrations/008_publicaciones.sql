-- =========================================================
-- 008_publicaciones.sql
-- Publicaciones del feed de Inicio + likes + comentarios
-- =========================================================

CREATE TABLE publicaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- 'post' | 'partido' | 'torneo' | 'grupo'
  tipo          VARCHAR(20) NOT NULL DEFAULT 'post'
                CHECK (tipo IN ('post', 'partido', 'torneo', 'grupo')),
  
  contenido     TEXT,
  imagen        TEXT,           -- por ahora: dataURL o URL
  video         TEXT,
  
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_publicaciones_autor ON publicaciones(autor_id, created_at DESC);
CREATE INDEX idx_publicaciones_tipo ON publicaciones(tipo);

-- =========================================================
-- LIKES
-- =========================================================
CREATE TABLE publicacion_likes (
  publicacion_id UUID NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
  usuario_id     UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (publicacion_id, usuario_id)
);

CREATE INDEX idx_likes_usuario ON publicacion_likes(usuario_id);

-- =========================================================
-- COMENTARIOS
-- =========================================================
CREATE TABLE publicacion_comentarios (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacion_id UUID NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
  autor_id       UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  texto          TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comentarios_publicacion ON publicacion_comentarios(publicacion_id, created_at);