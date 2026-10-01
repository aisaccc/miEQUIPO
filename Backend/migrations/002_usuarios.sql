bacje-- =========================================================
-- 002_usuarios.sql
-- Tabla de usuarios + sesiones
-- =========================================================

-- =========================================================
-- USUARIOS
-- =========================================================
CREATE TABLE usuarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        VARCHAR(100) NOT NULL,
  username      VARCHAR(30)  NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  
  -- Seguridad
  password_hash VARCHAR(255) NOT NULL,
  email_verificado BOOLEAN NOT NULL DEFAULT FALSE,
  verificado_en TIMESTAMPTZ,
  
  -- Perfil
  avatar        TEXT,
  bio           VARCHAR(300),
  edad          SMALLINT CHECK (edad IS NULL OR (edad >= 10 AND edad <= 100)),
  pais          VARCHAR(60),
  ciudad        VARCHAR(60),
  
  -- Multi-deporte (JSONB)
  -- Ejemplo: [{"deporte":"Fútbol","posiciones":["Delantero"],"stats":{"goles":{"valor":18,"publico":true}}}]
  deportes      JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Metadata
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login    TIMESTAMPTZ,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Constraints adicionales
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Índices para búsquedas frecuentes
CREATE INDEX idx_usuarios_email ON usuarios(LOWER(email));
CREATE INDEX idx_usuarios_username ON usuarios(LOWER(username));
CREATE INDEX idx_usuarios_activo ON usuarios(activo) WHERE activo = TRUE;

-- Trigger para actualizar updated_at
CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- SESIONES (refresh tokens)
-- =========================================================
CREATE TABLE sesiones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- El refresh token se guarda hasheado (nunca en texto plano)
  refresh_hash  VARCHAR(255) NOT NULL UNIQUE,
  
  -- Metadata del dispositivo
  user_agent    TEXT,
  ip_address    INET,
  
  -- Expiración
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revocado      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX idx_sesiones_expira ON sesiones(expires_at) WHERE revocado = FALSE;

-- =========================================================
-- TOKENS DE VERIFICACIÓN (email y recuperar contraseña)
-- =========================================================
CREATE TABLE tokens_temporales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Tipo: 'verificar_email' | 'reset_password'
  tipo          VARCHAR(30) NOT NULL,
  
  -- El token se guarda hasheado
  token_hash    VARCHAR(255) NOT NULL UNIQUE,
  
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  usado         BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_tokens_usuario ON tokens_temporales(usuario_id);
CREATE INDEX idx_tokens_tipo ON tokens_temporales(tipo);

-- Solo un token activo por tipo por usuario
CREATE UNIQUE INDEX idx_tokens_un_activo
  ON tokens_temporales(usuario_id, tipo)
  WHERE usado = FALSE;