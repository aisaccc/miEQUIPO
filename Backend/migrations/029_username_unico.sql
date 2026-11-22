-- No aplicar si existen duplicados por mayúsculas/minúsculas.
-- El índice UNIQUE original de username se conserva.
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_username_lower_uidx
  ON usuarios (LOWER(username));
