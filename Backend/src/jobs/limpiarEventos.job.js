/* =========================================================
   limpiarEventos.job.js — Eliminacion automatica segura
   - Partido no guardado: fecha programada + 1 hora.
   - Torneo no guardado: 24 horas luego del fin del dia fecha_fin
     (America/Santiago; se ejecuta desde 00:00 del segundo dia posterior).
   - NULL fecha / fecha_fin: no caduca automaticamente.
   - Notifica a inscritos/interesados en la misma transaccion.
   ========================================================= */
import { pool } from '../config/db.js';
import { obtenerDestinatariosPartido } from '../services/partidos.service.js';
import { obtenerDestinatariosTorneo } from '../services/torneos.service.js';
import { crearNotificacionMultiple } from '../services/notificaciones.service.js';

const INTERVALO_MS = 10 * 60 * 1000;
const LOTE_MAXIMO = 50;
let intervaloId = null;
let enEjecucion = false;

async function eliminarVencido(tipo, id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const esPartido = tipo === 'partido';
    // Bloquear el registro y comprobar otra vez la condicion: una persona
    // podria haber pulsado Guardar mientras el job esperaba.
    const { rows } = await client.query(esPartido ? `
      SELECT id, titulo, organizador_id
      FROM partidos WHERE id = $1 AND guardado_por_creador = FALSE
        AND fecha IS NOT NULL AND fecha + INTERVAL '1 hour' <= NOW()
        AND estado_partido IS DISTINCT FROM 'en_curso'
      FOR UPDATE
    ` : `
      SELECT id, nombre, tipo_participacion, canal_chat_id, organizador_id
      FROM torneos WHERE id = $1 AND guardado_por_creador = FALSE
        AND fecha_fin IS NOT NULL AND
        ((fecha_fin::timestamp + INTERVAL '2 days') AT TIME ZONE 'America/Santiago') <= NOW()
      FOR UPDATE
    `, [id]);
    const evento = rows[0];
    if (!evento) {
      await client.query('ROLLBACK');
      return false;
    }

    const destinatarios = esPartido
      ? await obtenerDestinatariosPartido(client, id)
      : await obtenerDestinatariosTorneo(client, id, evento.tipo_participacion || 'equipo');
    const destinatariosSinCreador = destinatarios.filter(uid => String(uid) !== String(evento.organizador_id));

    if (esPartido) {
      await client.query('DELETE FROM partidos WHERE id = $1', [id]);
    } else {
      await client.query('DELETE FROM torneos WHERE id = $1', [id]);
      // Misma limpieza del canal de chat que el borrado manual del torneo.
      if (evento.canal_chat_id) {
        await client.query('DELETE FROM canal_miembros WHERE canal_id = $1', [evento.canal_chat_id]);
        await client.query('DELETE FROM canales WHERE id = $1', [evento.canal_chat_id]);
      }
    }
    if (destinatariosSinCreador.length) {
      const nombre = esPartido ? evento.titulo : evento.nombre;
      await crearNotificacionMultiple(
        destinatariosSinCreador,
        esPartido ? 'partido_eliminado' : 'torneo_eliminado',
        `El ${esPartido ? 'partido' : 'torneo'} "${nombre}" fue eliminado automáticamente al vencer su plazo de conservación.`,
        null, { client, obligatoria: true }
      );
    }
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    // No imprimir datos de usuarios o tokens.
    console.error('[jobLimpiar] No se pudo eliminar evento vencido:', err.code || err.message);
    return false;
  } finally {
    client.release();
  }
}

export async function ejecutarJobLimpiarEventos() {
  if (enEjecucion) return { partidos: 0, torneos: 0, omitido: true };
  enEjecucion = true;
  let eliminadosPartidos = 0, eliminadosTorneos = 0;
  try {
    const { rows: partidos } = await pool.query(`
      SELECT id FROM partidos
      WHERE guardado_por_creador = FALSE
        AND fecha IS NOT NULL AND fecha + INTERVAL '1 hour' <= NOW()
        AND estado_partido IS DISTINCT FROM 'en_curso'
      ORDER BY fecha ASC LIMIT $1
    `, [LOTE_MAXIMO]);
    for (const { id } of partidos) {
      if (await eliminarVencido('partido', id)) eliminadosPartidos++;
    }

    const { rows: torneos } = await pool.query(`
      SELECT id FROM torneos
      WHERE guardado_por_creador = FALSE AND fecha_fin IS NOT NULL
        AND ((fecha_fin::timestamp + INTERVAL '2 days') AT TIME ZONE 'America/Santiago') <= NOW()
      ORDER BY fecha_fin ASC LIMIT $1
    `, [LOTE_MAXIMO]);
    for (const { id } of torneos) {
      if (await eliminarVencido('torneo', id)) eliminadosTorneos++;
    }
    if (eliminadosPartidos || eliminadosTorneos) {
      console.log(`[jobLimpiar] Eliminados ${eliminadosPartidos} partidos y ${eliminadosTorneos} torneos vencidos.`);
    }
    return { partidos: eliminadosPartidos, torneos: eliminadosTorneos };
  } catch (err) {
    console.error('[jobLimpiar] Error general:', err.code || err.message);
    return { partidos: eliminadosPartidos, torneos: eliminadosTorneos, error: true };
  } finally {
    enEjecucion = false;
  }
}

export function iniciarJobLimpiarEventos() {
  if (intervaloId) return intervaloId;
  console.log('Job de limpieza de eventos iniciado (cada 10 min)');
  setTimeout(() => ejecutarJobLimpiarEventos().catch(console.error), 10000);
  intervaloId = setInterval(() => ejecutarJobLimpiarEventos().catch(console.error), INTERVALO_MS);
  return intervaloId;
}
