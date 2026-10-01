-- =========================================================
-- 004_partidos.sql
-- Partidos (jugador / equipo) + inscripciones + postulaciones
-- =========================================================

-- =========================================================
-- PARTIDOS
-- =========================================================
CREATE TABLE partidos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  titulo            VARCHAR(120) NOT NULL,
  deporte           VARCHAR(50) NOT NULL,
  emoji             TEXT,
  
  -- 'jugador' | 'equipo'
  tipo_partido      VARCHAR(20) NOT NULL DEFAULT 'jugador'
                    CHECK (tipo_partido IN ('jugador', 'equipo')),
  
  descripcion       VARCHAR(500),
  lugar             VARCHAR(120) NOT NULL,
  fecha             TIMESTAMPTZ NOT NULL,
  cupos             SMALLINT NOT NULL CHECK (cupos >= 2),
  
  -- Precio en CLP. 0 = gratis
  precio            INTEGER NOT NULL DEFAULT 0 CHECK (precio >= 0),
  
  -- 'amistoso' | 'semiprofesional' | 'profesional'
  nivel             VARCHAR(30) NOT NULL DEFAULT 'amistoso'
                    CHECK (nivel IN ('amistoso', 'semiprofesional', 'profesional')),
  
  -- 'abierto' | 'lleno' | 'finalizado'
  estado            VARCHAR(20) NOT NULL DEFAULT 'abierto'
                    CHECK (estado IN ('abierto', 'lleno', 'finalizado')),
  
  -- Configuración
  aprobacion_requerida BOOLEAN NOT NULL DEFAULT FALSE,
  pedir_posiciones     BOOLEAN NOT NULL DEFAULT FALSE,
  posiciones           TEXT[] DEFAULT '{}',
  
  -- Equipo organizador (solo si tipo_partido = 'equipo')
  organizador_equipo_id UUID REFERENCES grupos(id) ON DELETE SET NULL,
  
  -- Organizador (usuario)
  organizador_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_partidos_deporte ON partidos(deporte);
CREATE INDEX idx_partidos_estado ON partidos(estado);
CREATE INDEX idx_partidos_fecha ON partidos(fecha);
CREATE INDEX idx_partidos_organizador ON partidos(organizador_id);
CREATE INDEX idx_partidos_tipo ON partidos(tipo_partido);

CREATE TRIGGER trg_partidos_updated_at
  BEFORE UPDATE ON partidos
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- INSCRIPCIONES (partidos de jugador)
-- =========================================================
CREATE TABLE partido_inscripciones (
  partido_id    UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  posicion      VARCHAR(50),
  fecha         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (partido_id, usuario_id)
);

CREATE INDEX idx_inscripciones_usuario ON partido_inscripciones(usuario_id);

-- =========================================================
-- POSTULACIONES (partidos con aprobación)
-- =========================================================
CREATE TABLE partido_postulaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partido_id    UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  posicion      VARCHAR(50),
  
  -- 'pendiente' | 'aprobado' | 'rechazado'
  estado        VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resuelta_en   TIMESTAMPTZ,
  
  UNIQUE (partido_id, usuario_id)
);

CREATE INDEX idx_postulaciones_partido ON partido_postulaciones(partido_id, estado);

-- =========================================================
-- EQUIPOS POSTULANTES (partidos de equipo)
-- =========================================================
CREATE TABLE partido_equipos_postulantes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partido_id    UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  equipo_id     UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  
  -- 'pendiente' | 'aceptado' | 'rechazado'
  estado        VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente', 'aceptado', 'rechazado')),
  
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resuelta_en   TIMESTAMPTZ,
  
  UNIQUE (partido_id, equipo_id)
);

CREATE INDEX idx_equipos_postulantes_partido ON partido_equipos_postulantes(partido_id, estado);

-- =========================================================
-- EQUIPOS INSCRITOS (confirmados)
-- =========================================================
CREATE TABLE partido_equipos_inscritos (
  partido_id    UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  equipo_id     UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  fecha         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (partido_id, equipo_id)
);