-- =========================================================
-- 025_mensajes_texto_nullable.sql
-- Permite que un mensaje tenga solo imagen (sin texto)
-- =========================================================

ALTER TABLE mensajes
  ALTER COLUMN texto DROP NOT NULL;