-- =========================================================
-- 023_mensajes_imagen.sql
-- Agrega soporte de imágenes a los mensajes (1 a 1 + canales)
-- =========================================================

ALTER TABLE mensajes
  ADD COLUMN IF NOT EXISTS imagen TEXT;

-- Índice opcional para saber cuántos mensajes tienen imagen (por si se necesita en el futuro)
CREATE INDEX IF NOT EXISTS idx_mensajes_con_imagen
  ON mensajes(id) WHERE imagen IS NOT NULL;