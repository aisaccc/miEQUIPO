-- Ejecutar con psql en una base PostgreSQL vacía. No usar sobre una base en uso.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE _migrations (
id SERIAL PRIMARY KEY, archivo VARCHAR(255) NOT NULL UNIQUE,
ejecutada TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 001_extensiones.sql
-- =========================================================
-- 001_extensiones.sql
-- Extensiones y funciones comunes
-- =========================================================

-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Función que actualiza automáticamente updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
INSERT INTO _migrations (archivo) VALUES ('001_extensiones.sql');
-- 002_usuarios.sql

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
INSERT INTO _migrations (archivo) VALUES ('002_usuarios.sql');
-- 003_grupos.sql
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
INSERT INTO _migrations (archivo) VALUES ('003_grupos.sql');
-- 004_partidos.sql
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
INSERT INTO _migrations (archivo) VALUES ('004_partidos.sql');
-- 005_torneos.sql
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
INSERT INTO _migrations (archivo) VALUES ('005_torneos.sql');
-- 006_mensajes.sql
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
INSERT INTO _migrations (archivo) VALUES ('006_mensajes.sql');
-- 007_notificaciones.sql
-- =========================================================
-- 007_notificaciones.sql
-- Notificaciones del sistema
-- =========================================================

CREATE TABLE notificaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Tipo: 'inscripcion','salida','postulacion','aprobado','rechazado',
  --       'cierre','edicion','cancelacion','invitacion','admin','expulsado', etc.
  tipo          VARCHAR(40) NOT NULL,
  mensaje       VARCHAR(300) NOT NULL,
  link          VARCHAR(200),
  
  leida         BOOLEAN NOT NULL DEFAULT FALSE,
  
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_usuario ON notificaciones(usuario_id, created_at DESC);
CREATE INDEX idx_notif_no_leidas ON notificaciones(usuario_id) WHERE leida = FALSE;
INSERT INTO _migrations (archivo) VALUES ('007_notificaciones.sql');
-- 008_publicaciones.sql
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
INSERT INTO _migrations (archivo) VALUES ('008_publicaciones.sql');
-- 009_torneos_v2.sql
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
INSERT INTO _migrations (archivo) VALUES ('009_torneos_v2.sql');
-- 010_partidos_organizar.sql
-- =========================================================
-- 010_partidos_organizar.sql
-- Permitir NULL en lugar y fecha para el modo "Organizar partido"
-- =========================================================
-- Cuando un partido está en estado 'buscando_jugadores',
-- no tiene fecha ni lugar definidos todavía.

ALTER TABLE partidos
  ALTER COLUMN lugar DROP NOT NULL;

ALTER TABLE partidos
  ALTER COLUMN fecha DROP NOT NULL;
INSERT INTO _migrations (archivo) VALUES ('010_partidos_organizar.sql');
-- 011_partido_confirmaciones.sql
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
INSERT INTO _migrations (archivo) VALUES ('011_partido_confirmaciones.sql');
-- 012_torneos_fecha_limite.sql
-- =========================================================
-- 012_torneos_fecha_limite.sql
-- Fecha límite de inscripción para torneos
-- =========================================================
-- Cuando un torneo tiene fecha límite de inscripción,
-- pasada esa fecha ya no se puede inscribir nadie nuevo.
-- Además, el organizador puede cerrar el torneo manualmente.
-- =========================================================

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS fecha_limite_inscripcion TIMESTAMPTZ DEFAULT NULL;

-- Índice para filtrar/buscar por fecha
CREATE INDEX IF NOT EXISTS idx_torneos_fecha_limite
  ON torneos(fecha_limite_inscripcion)
  WHERE fecha_limite_inscripcion IS NOT NULL;

-- Comentario para documentar
COMMENT ON COLUMN torneos.fecha_limite_inscripcion IS
  'Fecha máxima para inscribirse. NULL = sin límite.';
INSERT INTO _migrations (archivo) VALUES ('012_torneos_fecha_limite.sql');
-- 013_torneos_libre_nivel.sql
-- =========================================================
-- 013_torneos_libre_nivel.sql
-- Nivel del torneo + libre inscripción
-- =========================================================
-- - nivel: 'amistoso' | 'semiprofesional' | 'profesional'
-- - libre_inscripcion: si es TRUE, cualquiera con equipo del deporte
--   se inscribe directo. Si es FALSE, va a lista de espera.
--
-- Reglas de negocio:
-- - Si el torneo es PAGO → siempre va a lista de espera
--   (el organizador coordina el pago con el capitán).
-- - Si es GRATIS:
--   * nivel amistoso → libre inscripción (default TRUE).
--   * nivel semipro/pro → el organizador decide.
-- =========================================================

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS nivel VARCHAR(30) NOT NULL DEFAULT 'amistoso'
    CHECK (nivel IN ('amistoso', 'semiprofesional', 'profesional')),

  ADD COLUMN IF NOT EXISTS libre_inscripcion BOOLEAN NOT NULL DEFAULT TRUE;
INSERT INTO _migrations (archivo) VALUES ('013_torneos_libre_nivel.sql');
-- 014_torneos_tipo_participacion.sql
-- =========================================================
-- 014_torneos_tipo_participacion.sql
-- Tipo de participación del torneo (equipo vs individual)
-- =========================================================
-- - tipo_participacion:
--   * 'equipo'     → se inscriben equipos (default, como estaba)
--   * 'individual' → se inscriben usuarios sueltos (Tenis, Boxeo, etc.)
--
-- - es_individual (en torneo_equipos):
--   * FALSE → la fila referencia a un grupo/equipo
--   * TRUE  → la fila referencia a un usuario (deporte individual)
--
-- Reglas:
-- - Torneos de equipo → validan deporte del equipo contra el torneo.
-- - Torneos individuales → no requieren equipo, se guarda el usuario
--   como "participante" reusando torneo_equipos.
-- - Se mantiene toda la lógica de libre inscripción / lista de espera.
-- =========================================================

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS tipo_participacion VARCHAR(20) NOT NULL DEFAULT 'equipo'
    CHECK (tipo_participacion IN ('equipo', 'individual'));

ALTER TABLE torneo_equipos
  ADD COLUMN IF NOT EXISTS es_individual BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para acelerar consultas por tipo
CREATE INDEX IF NOT EXISTS idx_torneos_tipo_participacion
  ON torneos (tipo_participacion);

CREATE INDEX IF NOT EXISTS idx_torneo_equipos_es_individual
  ON torneo_equipos (torneo_id, es_individual);

-- También aplica a lista de espera e invitaciones (para no mezclar)
ALTER TABLE torneo_lista_espera
  ADD COLUMN IF NOT EXISTS es_individual BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE torneo_invitaciones
  ADD COLUMN IF NOT EXISTS es_individual BOOLEAN NOT NULL DEFAULT FALSE;
INSERT INTO _migrations (archivo) VALUES ('014_torneos_tipo_participacion.sql');
-- 015_torneos_equipo_id_flex.sql
-- =========================================================
-- 015_torneos_equipo_id_flex.sql
-- Flexibilizar FK de equipo_id en tablas de torneos para
-- soportar torneos individuales (donde "equipo_id" guarda
-- un usuario_id).
-- =========================================================
-- Las tablas afectadas son:
--   - torneo_equipos.equipo_id              (a grupos)
--   - torneo_lista_espera.equipo_id         (a grupos)
--   - torneo_invitaciones.equipo_id         (a grupos)
--   - torneo_tabla_posiciones.equipo_id     (a grupos)  ← la que rompía
--   - torneo_partidos.equipo_local_id       (a grupos)
--   - torneo_partidos.equipo_visitante_id   (a grupos)
--
-- Se eliminan SOLO las FK que van a grupos. Las FK hacia
-- torneos se mantienen intactas.
--
-- La integridad queda validada por el service según el tipo
-- de torneo.
-- =========================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Eliminamos cualquier FK desde tablas "torneo_*" hacia grupos.
  -- Esto cubre los 6 casos de arriba de forma automática.
  FOR r IN
    SELECT
      conname              AS constraint_name,
      conrelid::regclass   AS tabla
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid = 'grupos'::regclass
      AND conrelid::regclass::text LIKE 'torneo\_%' ESCAPE '\'
  LOOP
    EXECUTE format(
      'ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I',
      r.tabla,
      r.constraint_name
    );
    RAISE NOTICE 'FK eliminada: % en %', r.constraint_name, r.tabla;
  END LOOP;
END $$;

-- Índices de apoyo
CREATE INDEX IF NOT EXISTS idx_torneo_equipos_equipo
  ON torneo_equipos (equipo_id);

CREATE INDEX IF NOT EXISTS idx_torneo_lista_espera_equipo
  ON torneo_lista_espera (equipo_id);

CREATE INDEX IF NOT EXISTS idx_torneo_invitaciones_equipo
  ON torneo_invitaciones (equipo_id);

CREATE INDEX IF NOT EXISTS idx_torneo_tabla_posiciones_equipo
  ON torneo_tabla_posiciones (equipo_id);

CREATE INDEX IF NOT EXISTS idx_torneo_partidos_local
  ON torneo_partidos (equipo_local_id);

CREATE INDEX IF NOT EXISTS idx_torneo_partidos_visitante
  ON torneo_partidos (equipo_visitante_id);
INSERT INTO _migrations (archivo) VALUES ('015_torneos_equipo_id_flex.sql');
-- 016_torneos_fixture.sql
-- =========================================================
-- 016_torneos_fixture.sql
-- Fixture para torneos (liga y eliminación) + jornadas
-- =========================================================
-- Agrega lo necesario para:
--   - Configurar si la liga es ida simple o ida y vuelta.
--   - Guardar jornadas como filas reales (permite agregar/borrar).
--   - Soporte completo para fixtures de eliminación:
--     * fase (cuartos, semis, final, ...)
--     * posición dentro de la fase (para armar el bracket)
--     * referencia al partido siguiente (para avanzar ganadores)
--     * marca de bye (pasa directo sin jugar)
--   - Bloquear el fixture una vez confirmado.
-- =========================================================

-- =========================================================
-- 1. TORNEOS: columnas nuevas
-- =========================================================

ALTER TABLE torneos
  -- Si TRUE, la liga es ida y vuelta (duplica las jornadas)
  ADD COLUMN IF NOT EXISTS ida_y_vuelta BOOLEAN NOT NULL DEFAULT FALSE,

  -- Si TRUE, el fixture de eliminación ya fue confirmado y
  -- ya no se pueden editar los cruces (solo cargar resultados)
  ADD COLUMN IF NOT EXISTS fixture_bloqueado BOOLEAN NOT NULL DEFAULT FALSE;

-- =========================================================
-- 2. TORNEO_JORNADAS: filas reales
-- =========================================================
-- Cada fila representa una jornada (ej: "Jornada 1").
-- Los partidos de liga se asocian a una jornada por su id.
-- El organizador puede agregar/borrar jornadas mientras el
-- torneo esté en fase de armado.

CREATE TABLE IF NOT EXISTS torneo_jornadas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id     UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,

  numero        SMALLINT NOT NULL,       -- 1, 2, 3...
  nombre        VARCHAR(60) NOT NULL,    -- "Jornada 1", "Fecha 2", etc.
  fecha         DATE,                    -- opcional

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (torneo_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_torneo_jornadas_torneo
  ON torneo_jornadas (torneo_id, numero);

-- =========================================================
-- 3. TORNEO_PARTIDOS: columnas nuevas
-- =========================================================
-- - jornada_id: FK a torneo_jornadas (para liga)
-- - fase: cuartos, semis, final, etc. (para eliminación)
-- - posicion_en_fase: orden dentro de la fase
-- - siguiente_partido_id: a qué partido va el ganador
-- - es_bye: TRUE si el equipo pasa directo sin jugar

ALTER TABLE torneo_partidos
  ADD COLUMN IF NOT EXISTS jornada_id UUID REFERENCES torneo_jornadas(id) ON DELETE SET NULL,

  ADD COLUMN IF NOT EXISTS fase VARCHAR(20),

  ADD COLUMN IF NOT EXISTS posicion_en_fase SMALLINT,

  ADD COLUMN IF NOT EXISTS siguiente_partido_id UUID REFERENCES torneo_partidos(id) ON DELETE SET NULL,

  ADD COLUMN IF NOT EXISTS es_bye BOOLEAN NOT NULL DEFAULT FALSE;

-- CHECK para fases válidas (solo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'torneo_partidos_fase_check'
  ) THEN
    ALTER TABLE torneo_partidos
      ADD CONSTRAINT torneo_partidos_fase_check
      CHECK (fase IS NULL OR fase IN (
        '32avos', '16avos', '8vos', 'cuartos', 'semis', 'final', 'tercer_puesto'
      ));
  END IF;
END $$;

-- Índices de apoyo
CREATE INDEX IF NOT EXISTS idx_torneo_partidos_jornada
  ON torneo_partidos (jornada_id);

CREATE INDEX IF NOT EXISTS idx_torneo_partidos_fase_pos
  ON torneo_partidos (torneo_id, fase, posicion_en_fase);

CREATE INDEX IF NOT EXISTS idx_torneo_partidos_siguiente
  ON torneo_partidos (siguiente_partido_id);

-- =========================================================
-- 4. COMENTARIOS
-- =========================================================
COMMENT ON COLUMN torneos.ida_y_vuelta IS
  'TRUE si la liga es ida y vuelta. Duplica las jornadas.';

COMMENT ON COLUMN torneos.fixture_bloqueado IS
  'TRUE si el fixture de eliminación ya fue confirmado y no se puede editar.';

COMMENT ON COLUMN torneo_partidos.jornada_id IS
  'FK a torneo_jornadas. Solo aplica a partidos de liga.';

COMMENT ON COLUMN torneo_partidos.fase IS
  'Fase del bracket de eliminación: cuartos, semis, final, etc.';

COMMENT ON COLUMN torneo_partidos.posicion_en_fase IS
  'Orden del partido dentro de la fase (0, 1, 2...). Determina a qué partido avanza el ganador.';

COMMENT ON COLUMN torneo_partidos.siguiente_partido_id IS
  'Partido de la siguiente fase donde avanza el ganador.';

COMMENT ON COLUMN torneo_partidos.es_bye IS
  'TRUE si un equipo pasa directo sin jugar (número impar de participantes).';
INSERT INTO _migrations (archivo) VALUES ('016_torneos_fixture.sql');
-- 017_torneos_auto_fixture.sql
-- =========================================================
-- 017_torneos_auto_fixture.sql
-- Switch "auto armar fixture" para torneos de eliminación
-- =========================================================
-- Cuando el organizador crea un torneo de eliminación, puede
-- elegir si quiere que el fixture se arme automáticamente
-- (aleatorio) al cerrar las inscripciones.
--
-- - auto_fixture = TRUE  → al cerrar inscripciones se arma
--   el bracket automáticamente con los inscritos.
-- - auto_fixture = FALSE → el organizador arma el bracket
--   manualmente después.
-- =========================================================

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS auto_fixture BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN torneos.auto_fixture IS
  'TRUE si el fixture de eliminación se arma automáticamente al cerrar inscripciones.';
INSERT INTO _migrations (archivo) VALUES ('017_torneos_auto_fixture.sql');
-- 018_torneos_sistema_clasificacion.sql
-- =========================================================
-- 018_torneos_sistema_clasificacion.sql
-- Sistema de clasificación para deportes por tiempo/puntaje
-- =========================================================
-- Hay deportes que no se puntúan por goles ni por sets, sino
-- por:
--   - TIEMPO  → menor tiempo gana (natación, atletismo, ciclismo).
--   - PUNTOS  → mayor puntaje gana (escalada, surf, boxeo).
--
-- El organizador elige el sistema al crear el torneo.
-- El default 'simple' mantiene el comportamiento actual
-- (goles/puntos/carreras o sets, según el deporte).
--
-- Valores:
--   'simple' → goles, puntos, carreras, sets (lo de siempre)
--   'tiempo' → menor tiempo gana (se guarda en segundos)
--   'puntos' → mayor puntaje gana
-- =========================================================

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS sistema_clasificacion VARCHAR(20) NOT NULL DEFAULT 'simple'
    CHECK (sistema_clasificacion IN ('simple', 'tiempo', 'puntos'));

CREATE INDEX IF NOT EXISTS idx_torneos_sistema_clasificacion
  ON torneos (sistema_clasificacion);

COMMENT ON COLUMN torneos.sistema_clasificacion IS
  'Sistema de clasificación: simple (goles/sets), tiempo (menor gana) o puntos (mayor gana).';
INSERT INTO _migrations (archivo) VALUES ('018_torneos_sistema_clasificacion.sql');
-- 019_stats_privacidad_por_stat.sql
-- =========================================================
-- 019_stats_privacidad_por_stat.sql
-- Privacidad por stat individual (victorias / empates / derrotas)
-- =========================================================
-- Agrega 3 columnas booleanas que indican si cada stat es
-- privada o pública de forma independiente.
-- La columna `stats_privadas` original queda como fallback:
-- si estaba en TRUE, los 3 flags se marcan TRUE (respeta la
-- decisión previa del usuario).
-- =========================================================

-- 1) Agregar columnas
ALTER TABLE grupos
  ADD COLUMN IF NOT EXISTS stats_victorias_privadas BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stats_empates_privadas   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stats_derrotas_privadas  BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) Migrar el flag global a los 3 flags individuales
--    (si stats_privadas era TRUE, ahora los 3 son privados)
UPDATE grupos
SET
  stats_victorias_privadas = TRUE,
  stats_empates_privadas   = TRUE,
  stats_derrotas_privadas  = TRUE
WHERE stats_privadas = TRUE;

-- 3) Comentario documental
COMMENT ON COLUMN grupos.stats_victorias_privadas IS 'Si TRUE, solo miembros ven el conteo de victorias';
COMMENT ON COLUMN grupos.stats_empates_privadas   IS 'Si TRUE, solo miembros ven el conteo de empates';
COMMENT ON COLUMN grupos.stats_derrotas_privadas  IS 'Si TRUE, solo miembros ven el conteo de derrotas';
INSERT INTO _migrations (archivo) VALUES ('019_stats_privacidad_por_stat.sql');
-- 020_usuarios_hero.sql
-- =========================================================
-- 020_usuarios_hero.sql
-- Personalización del hero del perfil + stats base
-- =========================================================
-- Agrega 3 columnas a usuarios:
-- - hero_color: preset de color del hero del perfil.
-- - stats_hero_base: contadores base que el usuario puede editar.
-- - stats_hero_privadas: qué stats del hero son privadas.
-- =========================================================

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS hero_color VARCHAR(20) NOT NULL DEFAULT 'navy';

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS stats_hero_base JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS stats_hero_privadas JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Comentarios
COMMENT ON COLUMN usuarios.hero_color IS 'Preset de color del hero del perfil';
COMMENT ON COLUMN usuarios.stats_hero_base IS 'Contadores base editables: { partidos: N }';
COMMENT ON COLUMN usuarios.stats_hero_privadas IS 'Privacidad por stat: { partidos: bool, torneos: bool, equipos: bool }';
INSERT INTO _migrations (archivo) VALUES ('020_usuarios_hero.sql');
-- 021_torneo_organizadores_invitaciones.sql
-- =========================================================
-- 019_torneo_organizadores_invitaciones.sql
-- Invitaciones a sub-organizadores de torneos
-- =========================================================
-- El organizador principal invita a otro usuario a ser
-- sub-organizador. El invitado acepta o rechaza.
-- Solo al aceptar se inserta en `torneo_organizadores`.
-- =========================================================

CREATE TABLE IF NOT EXISTS torneo_organizadores_invitaciones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id      UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
  invitado_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  invitado_por   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  permisos       VARCHAR(20) NOT NULL DEFAULT 'completo'
                 CHECK (permisos IN ('resultados', 'completo')),

  estado         VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'cancelada')),

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resuelta_en    TIMESTAMPTZ,

  UNIQUE (torneo_id, invitado_id)
);

CREATE INDEX IF NOT EXISTS idx_torneo_org_inv_torneo
  ON torneo_organizadores_invitaciones (torneo_id, estado);

CREATE INDEX IF NOT EXISTS idx_torneo_org_inv_invitado
  ON torneo_organizadores_invitaciones (invitado_id, estado);

COMMENT ON TABLE torneo_organizadores_invitaciones IS
  'Invitaciones pendientes para ser sub-organizador de un torneo.';
COMMENT ON COLUMN torneo_organizadores_invitaciones.permisos IS
  'Permisos del sub-organizador: "resultados" o "completo".';
COMMENT ON COLUMN torneo_organizadores_invitaciones.estado IS
  'pendiente → aceptada | rechazada | cancelada';
INSERT INTO _migrations (archivo) VALUES ('021_torneo_organizadores_invitaciones.sql');
-- 022_publicaciones_scope.sql
-- =========================================================
-- 022_publicaciones_scope.sql
-- Agrega scope (perfil/equipo/torneo) a publicaciones
-- =========================================================

-- ---------- Nuevas columnas ----------
ALTER TABLE publicaciones
  ADD COLUMN scope       VARCHAR(20) NOT NULL DEFAULT 'perfil'
                         CHECK (scope IN ('perfil', 'grupo', 'torneo')),
  ADD COLUMN grupo_id    UUID REFERENCES grupos(id) ON DELETE CASCADE,
  ADD COLUMN torneo_id   UUID REFERENCES torneos(id) ON DELETE CASCADE;

-- ---------- Constraint: coherencia entre scope y ref ----------
ALTER TABLE publicaciones
  ADD CONSTRAINT chk_pub_scope_ref CHECK (
    (scope = 'perfil' AND grupo_id IS NULL AND torneo_id IS NULL) OR
    (scope = 'grupo'  AND grupo_id IS NOT NULL AND torneo_id IS NULL) OR
    (scope = 'torneo' AND torneo_id IS NOT NULL AND grupo_id IS NULL)
  );

-- ---------- Índices ----------
CREATE INDEX idx_pub_scope_grupo   ON publicaciones(grupo_id, created_at DESC) WHERE grupo_id IS NOT NULL;
CREATE INDEX idx_pub_scope_torneo  ON publicaciones(torneo_id, created_at DESC) WHERE torneo_id IS NOT NULL;
CREATE INDEX idx_pub_scope_perfil  ON publicaciones(autor_id, created_at DESC) WHERE scope = 'perfil';
INSERT INTO _migrations (archivo) VALUES ('022_publicaciones_scope.sql');
-- 023_mensajes_imagen.sql
-- =========================================================
-- 023_mensajes_imagen.sql
-- Agrega soporte de imágenes a los mensajes (1 a 1 + canales)
-- =========================================================

ALTER TABLE mensajes
  ADD COLUMN IF NOT EXISTS imagen TEXT;

-- Índice opcional para saber cuántos mensajes tienen imagen (por si se necesita en el futuro)
CREATE INDEX IF NOT EXISTS idx_mensajes_con_imagen
  ON mensajes(id) WHERE imagen IS NOT NULL;
INSERT INTO _migrations (archivo) VALUES ('023_mensajes_imagen.sql');
-- 024_publicaciones_privacidad.sql
-- =========================================================
-- 024_publicaciones_privacidad.sql
-- Agrega privacidad a las publicaciones de grupo (equipo)
-- =========================================================
-- Valores:
--   'publico'  → cualquiera que vea el equipo
--   'miembros' → solo miembros del equipo
--   'staff'    → solo capitán y sub-capitanes

ALTER TABLE publicaciones
  ADD COLUMN IF NOT EXISTS privacidad VARCHAR(20) NOT NULL DEFAULT 'publico';

-- Constraint de valores válidos
ALTER TABLE publicaciones
  DROP CONSTRAINT IF EXISTS chk_pub_privacidad;

ALTER TABLE publicaciones
  ADD CONSTRAINT chk_pub_privacidad
  CHECK (privacidad IN ('publico', 'miembros', 'staff'));

-- Índice (por si se necesita filtrar por privacidad)
CREATE INDEX IF NOT EXISTS idx_pub_privacidad
  ON publicaciones(grupo_id, privacidad) WHERE grupo_id IS NOT NULL;
INSERT INTO _migrations (archivo) VALUES ('024_publicaciones_privacidad.sql');
-- 025_mensajes_texto_nullable.sql
-- =========================================================
-- 025_mensajes_texto_nullable.sql
-- Permite que un mensaje tenga solo imagen (sin texto)
-- =========================================================

ALTER TABLE mensajes
  ALTER COLUMN texto DROP NOT NULL;
INSERT INTO _migrations (archivo) VALUES ('025_mensajes_texto_nullable.sql');
-- 026_amistades.sql
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
INSERT INTO _migrations (archivo) VALUES ('026_amistades.sql');
-- 027_bloqueos.sql
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
INSERT INTO _migrations (archivo) VALUES ('027_bloqueos.sql');
-- 028_invitaciones_links.sql
-- =========================================================
-- 027_invitaciones_links.sql
-- Tabla para guardar tokens de links de invitación (amistad / equipo)
-- =========================================================

CREATE TABLE IF NOT EXISTS invitaciones_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('amistad', 'grupo')),
  referencia_id UUID NOT NULL, -- Si es 'amistad', es el ID del creador. Si es 'grupo', es el ID del grupo.
  creador_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitaciones_token ON invitaciones_links(token);
INSERT INTO _migrations (archivo) VALUES ('028_invitaciones_links.sql');
COMMIT;