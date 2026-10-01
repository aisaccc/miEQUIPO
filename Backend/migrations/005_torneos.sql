-- =========================================================
-- 005_torneos.sql
-- Torneos + equipos inscritos + lista de espera + invitaciones
-- =========================================================

CREATE TABLE torneos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  nombre            VARCHAR(120) NOT NULL,
  deporte           VARCHAR(50) NOT NULL,
  emoji             TEXT,
  descripcion       VARCHAR(500),
  lugar             VARCHAR(120),
  
  fecha_inicio      DATE NOT NULL,
  fecha_fin         DATE,
  
  cupos_equipos     SMALLINT NOT NULL CHECK (cupos_equipos >= 2),
  precio            INTEGER NOT NULL DEFAULT 0 CHECK (precio >= 0),
  
  -- 'inscripcion' | 'en_curso' | 'finalizado'
  estado            VARCHAR(20) NOT NULL DEFAULT 'inscripcion'
                    CHECK (estado IN ('inscripcion', 'en_curso', 'finalizado')),
  
  -- Canal de chat del torneo (ID interno para mensajes)
  canal_chat_id     VARCHAR(80),
  
  organizador_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_torneos_deporte ON torneos(deporte);
CREATE INDEX idx_torneos_estado ON torneos(estado);
CREATE INDEX idx_torneos_organizador ON torneos(organizador_id);

CREATE TRIGGER trg_torneos_updated_at
  BEFORE UPDATE ON torneos
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- EQUIPOS INSCRITOS EN TORNEO
-- =========================================================
CREATE TABLE torneo_equipos (
  torneo_id     UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
  equipo_id     UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  fecha         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (torneo_id, equipo_id)
);

-- =========================================================
-- LISTA DE ESPERA (pendientes de aprobación)
-- =========================================================
CREATE TABLE torneo_lista_espera (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id     UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
  equipo_id     UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  
  -- 'solicitud' | 'invitacion-aceptada'
  origen        VARCHAR(30) NOT NULL DEFAULT 'solicitud'
                CHECK (origen IN ('solicitud', 'invitacion-aceptada')),
  
  -- 'pendiente' | 'aceptado' | 'rechazado'
  estado        VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente', 'aceptado', 'rechazado')),
  
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resuelta_en   TIMESTAMPTZ,
  
  UNIQUE (torneo_id, equipo_id)
);

CREATE INDEX idx_lista_espera_torneo ON torneo_lista_espera(torneo_id, estado);

-- =========================================================
-- INVITACIONES DEL ORGANIZADOR
-- =========================================================
CREATE TABLE torneo_invitaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id     UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
  equipo_id     UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  
  -- 'pendiente' | 'aceptada' | 'rechazada'
  estado        VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
  
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resuelta_en   TIMESTAMPTZ,
  
  UNIQUE (torneo_id, equipo_id)
);

CREATE INDEX idx_invitaciones_torneo ON torneo_invitaciones(torneo_id, estado);