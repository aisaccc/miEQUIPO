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