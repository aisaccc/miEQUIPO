/* =========================================================
   backfill-canales-grupos.js
   =========================================================
   Script one-shot: crea el canal para cada grupo existente
   y agrega a TODOS sus miembros actuales.

   Ejecutar UNA VEZ con:
     cd backend
     node src/config/backfill-canales-grupos.js
   ========================================================= */

import { pool } from './db.js';

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: grupos } = await client.query(
      `SELECT id, nombre, escudo, tipo FROM grupos`
    );

    console.log(`[backfill] Procesando ${grupos.length} grupos...`);

    let canalesCreados = 0;
    let miembrosAgregados = 0;

    for (const g of grupos) {
      const canalId = `grupo-${g.id}`;

      // 1. Asegurar que el canal exista
      const { rows: canalRows } = await client.query(
        `SELECT id FROM canales WHERE id = $1`,
        [canalId]
      );

      if (canalRows.length === 0) {
        await client.query(
          `INSERT INTO canales (id, tipo, ref_id, nombre, icono)
           VALUES ($1, $2, $3, $4, $5)`,
          [canalId, g.tipo || 'equipo', g.id, g.nombre, g.escudo || '🛡️']
        );
        canalesCreados++;
      }

      // 2. Agregar a TODOS los miembros del grupo
      const { rows: miembros } = await client.query(
        `SELECT usuario_id FROM grupo_miembros WHERE grupo_id = $1`,
        [g.id]
      );

      for (const m of miembros) {
        const { rowCount } = await client.query(
          `INSERT INTO canal_miembros (canal_id, usuario_id)
           VALUES ($1, $2)
           ON CONFLICT (canal_id, usuario_id) DO NOTHING`,
          [canalId, m.usuario_id]
        );
        miembrosAgregados += rowCount;
      }

      // 3. Agregar al capitán (por si no está en grupo_miembros por algún motivo)
      const { rowCount: capRowCount } = await client.query(
        `INSERT INTO canal_miembros (canal_id, usuario_id)
         SELECT $1, capitan_id FROM grupos WHERE id = $2
         ON CONFLICT (canal_id, usuario_id) DO NOTHING`,
        [canalId, g.id]
      );
      miembrosAgregados += capRowCount;
    }

    await client.query('COMMIT');

    console.log('[backfill] ✅ Listo');
    console.log(`  - Canales creados:      ${canalesCreados}`);
    console.log(`  - Miembros agregados:   ${miembrosAgregados}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[backfill] ❌ Error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
