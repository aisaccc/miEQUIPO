-- =========================================================
-- 006_mensajes.sql
-- Conversaciones privadas + mensajes + chats de grupo
-- =========================================================

-- =========================================================
-- CONVERSACIONES PRIVADAS (1 a 1)
-- =========================================================
CREATE TABLE conversaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vínculo opcional a un partido/torneo (para chat contextual)
  vinculada_tipo VARCHAR(20) CHECK (vinculada_tipo IN ('partido', 'torneo')),
  vinculada_id   UUID,
  vinculada_nombre VARCHAR(120),
  
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversaciones_ultima ON conversaciones(ultima_actividad DESC);

-- =========================================================
-- PARTICIPANTES DE CONVERSACIÓN
-- =========================================================
CREATE TABLE conversacion_participantes (
  conversacion_id UUID NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Marca para saber si el user "borró" la conversación
  oculta          BOOLEAN NOT NULL DEFAULT FALSE,
  
  PRIMARY KEY (conversacion_id, usuario_id)
);

CREATE INDEX idx_conv_participantes_usuario ON conversacion_participantes(usuario_id);

-- =========================================================
-- MENSAJES
-- =========================================================
CREATE TABLE mensajes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Un mensaje pertenece a una conversación privada O a un canal de grupo
  conversacion_id UUID REFERENCES conversaciones(id) ON DELETE CASCADE,
  canal_id        VARCHAR(80),     -- para chats de grupo/torneo
  
  autor_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  texto         TEXT NOT NULL,
  
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Al menos uno de los dos tiene que estar
  CHECK (conversacion_id IS NOT NULL OR canal_id IS NOT NULL)
);

CREATE INDEX idx_mensajes_conversacion ON mensajes(conversacion_id, created_at DESC);
CREATE INDEX idx_mensajes_canal ON mensajes(canal_id, created_at DESC);

-- =========================================================
-- LECTURAS DE MENSAJES (para "no leídos")
-- =========================================================
CREATE TABLE mensaje_lecturas (
  mensaje_id    UUID NOT NULL REFERENCES mensajes(id) ON DELETE CASCADE,
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  leido_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (mensaje_id, usuario_id)
);

CREATE INDEX idx_lecturas_usuario ON mensaje_lecturas(usuario_id);

-- =========================================================
-- CANALES (chats de grupo/torneo)
-- =========================================================
CREATE TABLE canales (
  id            VARCHAR(80) PRIMARY KEY,    -- ej: "torneo-abc123" o "grupo-def456"
  
  -- 'torneo' | 'equipo' | 'comunidad' | 'grupo'
  tipo          VARCHAR(20) NOT NULL,
  ref_id        UUID,                       -- referencia al torneo/grupo
  nombre        VARCHAR(120) NOT NULL,
  icono         TEXT,
  
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_canales_ref ON canales(ref_id);

-- =========================================================
-- MIEMBROS DE CANAL
-- =========================================================
CREATE TABLE canal_miembros (
  canal_id      VARCHAR(80) NOT NULL REFERENCES canales(id) ON DELETE CASCADE,
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Marca para saber si el user "silencia" el canal
  silenciado    BOOLEAN NOT NULL DEFAULT FALSE,
  
  PRIMARY KEY (canal_id, usuario_id)
);

CREATE INDEX idx_canal_miembros_usuario ON canal_miembros(usuario_id);