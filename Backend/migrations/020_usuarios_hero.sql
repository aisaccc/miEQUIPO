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