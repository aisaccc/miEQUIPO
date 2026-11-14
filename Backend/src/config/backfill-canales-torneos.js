import { pool } from './db.js';
import crypto from 'crypto';

async function backfill() {
  console.log('🔄 Backfill de canales de torneos...');

  const { rows: torneos } = await pool.query(
    `SELECT id, nombre, emoji, organizador_id, canal_chat_id
     FROM torneos
     WHERE canal_chat_id IS NULL`
  );

  console.log(`📋 ${torneos.length} torneos sin canal`);

  for (const torneo of torneos) {
    const canalId = `torneo-${crypto.randomUUID()}`;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE torneos SET canal_chat_id = $1 WHERE id = $2`,
        [canalId, torneo.id]
      );

      await client.query(
        `INSERT INTO canales (id, tipo, ref_id, nombre, icono)
         VALUES ($1, 'torneo', $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [canalId, torneo.id, torneo.nombre, torneo.emoji || '🏆']
      );

      // Organizador
      await client.query(
        `INSERT INTO canal_miembros (canal_id, usuario_id)
         VALUES ($1, $2) ON CONFLICT (canal_id, usuario_id) DO NOTHING`,
        [canalId, torneo.organizador_id]
      );

      // Sub-organizadores
      const { rows: subs } = await client.query(
        `SELECT usuario_id FROM torneo_organizadores WHERE torneo_id = $1`,
        [torneo.id]
      );
      for (const sub of subs) {
        await client.query(
          `INSERT INTO canal_miembros (canal_id, usuario_id)
           VALUES ($1, $2) ON CONFLICT (canal_id, usuario_id) DO NOTHING`,
          [canalId, sub.usuario_id]
        );
      }

      // Inscritos
      const { rows: inscritos } = await client.query(
        `SELECT equipo_id FROM torneo_equipos WHERE torneo_id = $1`,
        [torneo.id]
      );
      for (const ins of inscritos) {
        const { rows: miembros } = await client.query(
          `SELECT gm.usuario_id FROM grupo_miembros gm WHERE gm.grupo_id = $1`,
          [ins.equipo_id]
        );
        const { rows: userRows } = await client.query(
          `SELECT id FROM usuarios WHERE id = $1`,
          [ins.equipo_id]
        );
        const ids = new Set([
          ...miembros.map(m => m.usuario_id),
          ...userRows.map(u => u.id),
        ]);
        for (const uid of ids) {
          await client.query(
            `INSERT INTO canal_miembros (canal_id, usuario_id)
             VALUES ($1, $2) ON CONFLICT (canal_id, usuario_id) DO NOTHING`,
            [canalId, uid]
          );
        }
      }

      await client.query('COMMIT');
      console.log(`✅ Canal creado: ${torneo.nombre}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ Error en ${torneo.nombre}:`, err.message);
    } finally {
      client.release();
    }
  }

  console.log('✅ Backfill completado');
  process.exit(0);
}

backfill();