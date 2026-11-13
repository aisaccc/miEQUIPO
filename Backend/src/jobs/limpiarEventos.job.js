/* =========================================================
   limpiarEventos.job.js — Borra partidos y torneos vencidos
   ========================================================= */
import { pool } from '../config/db.js';

const INTERVALO_MS = 10 * 60 * 1000; // 10 minutos
let intervaloId = null;

async function ejecutarJobLimpiarEventos() {
  try {
    // 1. Borrar partidos que ya pasaron su fecha + 1 hora
    const resPartidos = await pool.query(`
      DELETE FROM partidos 
      WHERE fecha IS NOT NULL 
        AND fecha + INTERVAL '1 hour' <= NOW()
    `);
    
    // 2. Borrar torneos que ya pasaron su fecha_fin (fin del día) + 1 hora
    // Nota: fecha_fin es DATE, así que le sumamos 1 día y 1 hora para que se borre a la 01:00 AM del día siguiente
    const resTorneos = await pool.query(`
      DELETE FROM torneos 
      WHERE fecha_fin IS NOT NULL 
        AND (fecha_fin + INTERVAL '1 day 1 hour') <= NOW()
    `);

    if (resPartidos.rowCount > 0 || resTorneos.rowCount > 0) {
      console.log(`[jobLimpiar] Eliminados ${resPartidos.rowCount} partidos y ${resTorneos.rowCount} torneos vencidos.`);
    }
  } catch (err) {
    console.error('[jobLimpiar] Error general:', err);
  }
}

export function iniciarJobLimpiarEventos() {
  if (intervaloId) return intervaloId;
  console.log('⏰ Job de limpieza de eventos iniciado (cada 10 min)');
  
  // Ejecutar a los 10 segundos de arrancar el server
  setTimeout(() => ejecutarJobLimpiarEventos().catch(console.error), 10000);
  
  intervaloId = setInterval(() => ejecutarJobLimpiarEventos().catch(console.error), INTERVALO_MS);
  return intervaloId;
}