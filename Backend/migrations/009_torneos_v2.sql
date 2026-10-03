-- =========================================================
-- 009_torneos_v2.sql
-- Columnas y tablas nuevas para torneos avanzados
-- Diseño pensado para soportar:
--   - Modalidad (liga / eliminación directa / custom)
--   - Sub-organizadores
--   - Fixture / cruces
--   - Resultados
--   - Estadísticas
-- =========================================================

-- =========================================================
-- 1. COLUMNAS NUEVAS EN TORNEOS
-- =========================================================
ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS modalidad VARCHAR(20) NOT NULL DEFAULT 'liga'
    CHECK (modalidad IN ('liga', 'eliminacion', 'custom')),

  -- Puntos para tabla de posiciones (solo modalidad 'liga')
  ADD COLUMN IF NOT EXISTS puntos_victoria SMALLINT NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS puntos_empate SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS puntos_derrota SMALLINT NOT NULL DEFAULT 0,

  -- Configuración de resultados
  ADD COLUMN IF NOT EXISTS permite_empate BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS incluye_estadisticas BOOLEAN NOT NULL DEFAULT FALSE,

  -- Configuración de clasificación (para eliminación directa o liga)
  ADD COLUMN IF NOT EXISTS equipos_clasifican SMALLINT DEFAULT NULL;

-- =========================================================
-- 2. COLUMNAS NUEVAS EN PARTIDOS
-- =========================================================
ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS estado_partido VARCHAR(30) NOT NULL DEFAULT 'confirmado'
    CHECK (estado_partido IN ('buscando_jugadores', 'confirmado', 'en_curso', 'finalizado'));

-- =========================================================
-- 3. COLUMNAS NUEVAS EN USUARIOS
-- =========================================================
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS historial_publico BOOLEAN NOT NULL DEFAULT FALSE;

-- =========================================================
-- 4. TABLA: TORNEO_ORGANIZADORES (sub-organizadores)
-- =========================================================
CREATE TABLE IF NOT EXISTS torneo_organizadores (
  torneo_id     UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- 'resultados' = solo puede cargar resultados
  -- 'completo'   = puede editar todo el torneo
  permisos      VARCHAR(20) NOT NULL DEFAULT 'resultados'
                CHECK (permisos IN ('resultados', 'completo')),

  creado        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (torneo_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_torneo_org_usuario ON torneo_organizadores(usuario_id);

-- =========================================================
-- 5. TABLA: TORNEO_PARTIDOS (fixture / cruces)
-- =========================================================
CREATE TABLE IF NOT EXISTS torneo_partidos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id           UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,

  -- 'fecha_1', 'fecha_2'... (liga)
  -- '8vos', 'cuartos', 'semis', 'final' (eliminación)
  -- 'custom_1', 'custom_2'... (custom)
  ronda               VARCHAR(30) NOT NULL,

  -- Posición del partido dentro de la ronda (para ordenar el bracket)
  orden               SMALLINT NOT NULL DEFAULT 0,

  -- Equipos participantes
  equipo_local_id     UUID REFERENCES grupos(id) ON DELETE SET NULL,
  equipo_visitante_id UUID REFERENCES grupos(id) ON DELETE SET NULL,

  -- Resultado: { "goles_local": 2, "goles_visitante": 1, ... }
  -- Según el deporte y config del torneo, los campos varían
  resultado           JSONB,

  -- Estadísticas por jugador (opcional)
  -- { "jugadores": [{ "id": "...", "goles": 1, ... }] }
  estadisticas        JSONB,

  -- 'pendiente' | 'en_curso' | 'finalizado' | 'cancelado'
  estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente', 'en_curso', 'finalizado', 'cancelado')),

  -- Fecha programada (puede ser null si todavía no se sabe)
  fecha               TIMESTAMPTZ,

  -- Quién ganó: 'local' | 'visitante' | 'empate' | NULL (sin definir)
  ganador             VARCHAR(20) CHECK (ganador IN ('local', 'visitante', 'empate')),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_torneo_partidos_torneo ON torneo_partidos(torneo_id, ronda, orden);
CREATE INDEX IF NOT EXISTS idx_torneo_partidos_equipos ON torneo_partidos(equipo_local_id, equipo_visitante_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_torneo_partidos_updated_at ON torneo_partidos;
CREATE TRIGGER trg_torneo_partidos_updated_at
  BEFORE UPDATE ON torneo_partidos
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- 6. TABLA: TORNEO_TABLA_POSICIONES (para ligas)
-- =========================================================
-- Cache de la tabla de posiciones. Se recalcula cuando se carga un resultado.
CREATE TABLE IF NOT EXISTS torneo_tabla_posiciones (
  torneo_id       UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
  equipo_id       UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,

  -- Estadísticas acumuladas
  partidos_jugados SMALLINT NOT NULL DEFAULT 0,
  partidos_ganados SMALLINT NOT NULL DEFAULT 0,
  partidos_empatados SMALLINT NOT NULL DEFAULT 0,
  partidos_perdidos SMALLINT NOT NULL DEFAULT 0,

  puntos_favor    INTEGER NOT NULL DEFAULT 0,
  puntos_contra   INTEGER NOT NULL DEFAULT 0,
  diferencia      INTEGER NOT NULL DEFAULT 0,
  puntos_totales  INTEGER NOT NULL DEFAULT 0,

  actualizado     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (torneo_id, equipo_id)
);

CREATE INDEX IF NOT EXISTS idx_tabla_posiciones_puntos ON torneo_tabla_posiciones(torneo_id, puntos_totales DESC);

-- =========================================================
-- 7. TABLA: PARTIDO_INTERESADOS (modo "conversable")
-- =========================================================
-- Cuando un partido está en modo 'buscando_jugadores', los usuarios
-- pueden marcar "Me interesa" en lugar de inscribirse.
CREATE TABLE IF NOT EXISTS partido_interesados (
  partido_id    UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- 'interesado' | 'confirmado' | 'rechazado' | 'cancelado'
  estado        VARCHAR(20) NOT NULL DEFAULT 'interesado'
                CHECK (estado IN ('interesado', 'confirmado', 'rechazado', 'cancelado')),

  mensaje       VARCHAR(300),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (partido_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_interesados_partido ON partido_interesados(partido_id, estado);
CREATE INDEX IF NOT EXISTS idx_interesados_usuario ON partido_interesados(usuario_id);

-- =========================================================
-- 8. TABLA: HISTORIAL_PARTIDOS (para el perfil)
-- =========================================================
-- Registro histórico de partidos en los que participó un usuario
-- (ya sea como jugador individual o como parte de un equipo).
-- Se llena automáticamente cuando se confirma un partido.
CREATE TABLE IF NOT EXISTS historial_partidos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  partido_id    UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,

  -- 'jugador' | 'capitan' | 'admin' | 'organizador'
  rol           VARCHAR(20) NOT NULL DEFAULT 'jugador',

  -- Snapshot de datos al momento de la inscripción
  -- (para que si el partido cambia, el historial siga siendo fiel)
  partido_snapshot JSONB,

  -- Resultado personal (opcional, lo puede cargar el organizador)
  -- { "goles": 2, "asistencias": 1, "mvp": false, ... }
  stats_personales JSONB,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (usuario_id, partido_id)
);

CREATE INDEX IF NOT EXISTS idx_historial_usuario ON historial_partidos(usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_historial_partido ON historial_partidos(partido_id);

-- =========================================================
-- 9. MENSAJES PRIVADOS ORGANIZADOR ↔ INTERESADO
-- =========================================================
-- Reutilizamos la tabla 'conversaciones' y 'mensajes' que ya existen.
-- No hace falta tabla nueva: el vínculo se hace con conversaciones.vinculada_tipo
-- (ya existe el campo en la migración 006).

-- =========================================================
-- FIN
-- =========================================================