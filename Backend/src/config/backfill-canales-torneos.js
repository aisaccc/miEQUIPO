/* =========================================================
   backfill-canales-torneos.js
   =========================================================
   Script one-shot: crea el canal del torneo para torneos
   existentes que no lo tengan, y agrega al organizador + a
   los participantes actuales como miembros.

   Ejecutar UNA VEZ con:
     cd backend
     node src/config/backfill-canales-torneos.js
   ========================================================= */

import { pool } from './db.js';

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: torneos } = await client.query(
      `SELECT id, nombre, emoji, canal_chat_id, organizador_id, tipo_participacion
       FROM torneos`
    );

    console.log(`[backfill] Procesando ${torneos.length} torneos...`);

    let creados = 0;
    let yaExistian = 0;
    let orgAgregados = 0;
    let participantesAgregados = 0;

    for (const t of torneos) {
      // 1. Asegurar que el torneo tenga canal_chat_id
      let canalId = t.canal_chat_id;
      if (!canalId) {
        canalId = `torneo-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        await client.query(
          `UPDATE torneos SET canal_chat_id = $1 WHERE id = $2`,
          [canalId, t.id]
        );
      }

      // 2. ¿Existe el canal en la tabla canales?
      const { rows: canalRows } = await client.query(
        `SELECT id FROM canales WHERE id = $1`,
        [canalId]
      );

      if (canalRows.length === 0) {
        await client.query(
          `INSERT INTO canales (id, tipo, ref_id, nombre, icono)
           VALUES ($1, 'torneo', $2, $3, $4)`,
          [canalId, t.id, t.nombre, t.emoji || '🏆']
        );
        creados++;
      } else {
        yaExistian++;
      }

      // 3. Asegurar que el organizador esté como miembro
      const { rowCount: orgRowCount } = await client.query(
        `INSERT INTO canal_miembros (canal_id, usuario_id)
         VALUES ($1, $2)
         ON CONFLICT (canal_id, usuario_id) DO NOTHING`,
        [canalId, t.organizador_id]
      );
      orgAgregados += orgRowCount;

      // 4. Agregar sub-organizadores actuales al canal
      const { rows: subs } = await client.query(
        `SELECT usuario_id FROM torneo_organizadores WHERE torneo_id = $1`,
        [t.id]
      );
      for (const s of subs) {
        const { rowCount } = await client.query(
          `INSERT INTO canal_miembros (canal_id, usuario_id)
           VALUES ($1, $2)
           ON CONFLICT (canal_id, usuario_id) DO NOTHING`,
          [canalId, s.usuario_id]
        );
        orgAgregados += rowCount;
      }

      // 5. Agregar a los participantes actuales
      const { rows: inscritos } = await client.query(
        `SELECT equipo_id FROM torneo_equipos WHERE torneo_id = $1`,
        [t.id]
      );

      const esIndividual = t.tipo_participacion === 'individual';

      for (const ins of inscritos) {
        if (esIndividual) {
          const { rowCount } = await client.query(
            `INSERT INTO canal_miembros (canal_id, usuario_id)
             VALUES ($1, $2)
             ON CONFLICT (canal_id, usuario_id) DO NOTHING`,
            [canalId, ins.equipo_id]
          );
          participantesAgregados += rowCount;
        } else {
          // equipo → todos sus miembros
          const { rows: miembrosEq } = await client.query(
            `SELECT usuario_id FROM grupo_miembros WHERE grupo_id = $1`,
            [ins.equipo_id]
          );
          for (const m of miembrosEq) {
            const { rowCount } = await client.query(
              `INSERT INTO canal_miembros (canal_id, usuario_id)
               VALUES ($1, $2)
               ON CONFLICT (canal_id, usuario_id) DO NOTHING`,
              [canalId, m.usuario_id]
            );
            participantesAgregados += rowCount;
          }
        }
      }
    }

    await client.query('COMMIT');

    console.log('[backfill] ✅ Listo');
    console.log(`  - Canales creados:        ${creados}`);
    console.log(`  - Canales ya existentes:  ${yaExistian}`);
    console.log(`  - Organizadores agregados: ${orgAgregados}`);
    console.log(`  - Participantes agregados: ${participantesAgregados}`);
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