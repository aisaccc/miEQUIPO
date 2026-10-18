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