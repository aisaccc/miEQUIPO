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