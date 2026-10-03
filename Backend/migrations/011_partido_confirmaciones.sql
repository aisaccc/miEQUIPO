-- =========================================================
-- 011_partido_confirmaciones.sql
-- Propuestas de confirmación entre organizador e interesado
-- para el modo "Organizar partido"
-- =========================================================
-- Cuando el organizador y un interesado llegan a un acuerdo
-- (por chat), el organizador propone formalizar la confirmación.
-- El interesado debe aceptar. Solo entonces el partido se cierra.
-- =========================================================

CREATE TABLE partido_confirmaciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partido_id      UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,

  -- Quién propone (siempre el organizador del partido)
  organizador_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- A quién le propone
  interesado_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  interesado_tipo VARCHAR(20) NOT NULL
                  CHECK (interesado_tipo IN ('usuario', 'equipo')),

  -- Si es equipo, guardamos el ID del equipo (grupo)
  equipo_id       UUID REFERENCES grupos(id) ON DELETE CASCADE,

  -- Datos propuestos del partido (fecha/lugar/precio reales)
  lugar           VARCHAR(120),
  fecha           TIMESTAMPTZ,
  precio          INTEGER NOT NULL DEFAULT 0 CHECK (precio >= 0),
  mensaje         VARCHAR(300),

  -- Estado de la propuesta
  -- 'pendiente'  → esperando respuesta del interesado
  -- 'aceptada'   → el interesado aceptó, partido cerrado
  -- 'rechazada'  → el interesado rechazó, partido sigue en modo Organizar
  -- 'cancelada'  → el organizador canceló la propuesta
  estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'cancelada')),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resuelta_en     TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_confirmaciones_partido ON partido_confirmaciones(partido_id, estado);
CREATE INDEX idx_confirmaciones_interesado ON partido_confirmaciones(interesado_id, estado);
CREATE INDEX idx_confirmaciones_org ON partido_confirmaciones(organizador_id);

-- Solo puede haber UNA propuesta pendiente por partido a la vez
CREATE UNIQUE INDEX idx_confirmaciones_pendiente_unica
  ON partido_confirmaciones(partido_id)
  WHERE estado = 'pendiente';