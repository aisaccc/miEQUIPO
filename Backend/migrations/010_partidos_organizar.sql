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