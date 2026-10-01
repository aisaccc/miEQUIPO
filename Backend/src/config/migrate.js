import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

async function migrar() {
  console.log('🚀 Ejecutando migraciones...\n');

  const archivos = (await fs.readdir(MIGRATIONS_DIR))
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const archivo of archivos) {
    try {
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, archivo), 'utf-8');

      // Ejecutar en una transacción
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`  ✅ ${archivo}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ❌ ${archivo} falló:`, err.message);
        // Si falla, no seguimos
        client.release();
        throw err;
      }
      client.release();
    } catch (err) {
      console.error(`\n❌ Migración abortada en: ${archivo}`);
      process.exit(1);
    }
  }

  console.log('\n🎉 Todas las migraciones ejecutadas.');
  await pool.end();
}

migrar().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});