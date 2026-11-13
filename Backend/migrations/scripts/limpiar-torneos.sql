-- =========================================================
-- limpiar-torneos.sql
-- Borra TODOS los torneos y dependencias.
-- ⚠️ NO borra usuarios, grupos, mensajes ni notificaciones.
-- =========================================================

BEGIN;

-- 1. Tablas dependientes de torneos (primero las hijas)
DELETE FROM torneo_equipos;
DELETE FROM torneo_lista_espera;
DELETE FROM torneo_invitaciones;
DELETE FROM torneo_organizadores;
DELETE FROM torneo_tabla_posiciones;
DELETE FROM torneo_partidos;
DELETE FROM torneo_jornadas;

-- 2. Torneos
DELETE FROM torneos;

-- 3. Canales de chat de torneos
DELETE FROM canales WHERE tipo = 'torneo' OR id LIKE 'torneo-%';

-- 4. Partidos amistosos (si quieres también)
-- DELETE FROM partidos;

-- 5. Notificaciones relacionadas a torneos
DELETE FROM notificaciones
WHERE tipo IN (
  'inscripcion', 'aprobado', 'rechazado', 'salida', 'expulsado',
  'cierre', 'edicion', 'cancelacion', 'invitacion'
);

COMMIT;

-- =========================================================
-- VERIFICACIÓN
-- =========================================================
SELECT 'torneos'             AS tabla, COUNT(*) AS filas FROM torneos
UNION ALL SELECT 'torneo_equipos',         COUNT(*) FROM torneo_equipos
UNION ALL SELECT 'torneo_lista_espera',    COUNT(*) FROM torneo_lista_espera
UNION ALL SELECT 'torneo_invitaciones',    COUNT(*) FROM torneo_invitaciones
UNION ALL SELECT 'torneo_organizadores',   COUNT(*) FROM torneo_organizadores
UNION ALL SELECT 'torneo_tabla_posiciones',COUNT(*) FROM torneo_tabla_posiciones
UNION ALL SELECT 'torneo_partidos',        COUNT(*) FROM torneo_partidos
UNION ALL SELECT 'torneo_jornadas',        COUNT(*) FROM torneo_jornadas
UNION ALL SELECT 'canales (torneo)',       COUNT(*) FROM canales WHERE tipo = 'torneo';

-- Todas las filas deben dar 0