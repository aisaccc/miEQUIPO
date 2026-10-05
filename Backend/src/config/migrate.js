/* =========================================================
   migrate.js — Runner de migraciones
   =========================================================
   - Trackea qué migraciones ya se ejecutaron (tabla _migrations)
   - Solo ejecuta las nuevas
   - Cada migración corre en su propia transacción
   - Si una falla, se aborta todo
*/

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

/* =========================================================
   Crear tabla de control de migraciones
   ========================================================= */
async function asegurarTablaMigraciones() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      archivo     VARCHAR(255) NOT NULL UNIQUE,
      ejecutada   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

/* =========================================================
   Obtener migraciones ya ejecutadas
   ========================================================= */
async function obtenerEjecutadas() {
  const { rows } = await pool.query(
    `SELECT archivo FROM _migrations ORDER BY archivo`
  );
  return new Set(rows.map(r => r.archivo));
}

/* =========================================================
   Registrar migración ejecutada
   ========================================================= */
async function registrarEjecutada(archivo, client) {
  await client.query(
    `INSERT INTO _migrations (archivo) VALUES ($1)`,
    [archivo]
  );
}

/* =========================================================
   Ejecutar todas las migraciones pendientes
   ========================================================= */
async function migrar() {
  console.log('🚀 Ejecutando migraciones...\n');

  await asegurarTablaMigraciones();
  const ejecutadas = await obtenerEjecutadas();

  const archivos = (await fs.readdir(MIGRATIONS_DIR))
    .filter(f => f.endsWith('.sql'))
    .sort();

  const pendientes = archivos.filter(a => !ejecutadas.has(a));

  if (pendientes.length === 0) {
    console.log('✨ No hay migraciones pendientes. Todo al día.\n');
    await pool.end();
    return;
  }

  console.log(`📋 ${pendientes.length} migración(es) pendiente(s):\n`);

  for (const archivo of pendientes) {
    const client = await pool.connect();
    try {
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, archivo), 'utf-8');

      await client.query('BEGIN');
      await client.query(sql);
      await registrarEjecutada(archivo, client);
      await client.query('COMMIT');

      console.log(`  ✅ ${archivo}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ❌ ${archivo} falló: ${err.message}`);
      console.error(`\n❌ Migración abortada en: ${archivo}`);
      client.release();
      await pool.end();
      process.exit(1);
    }
    client.release();
  }

  console.log('\n🎉 Todas las migraciones ejecutadas.');
  await pool.end();
}

migrar().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});