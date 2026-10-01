import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
  host: env.DB.host,
  port: env.DB.port,
  database: env.DB.database,
  user: env.DB.user,
  password: env.DB.password,// ← si está vacío, no lo pasa
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/* Test de conexión al arrancar */
export async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Conectado a PostgreSQL:', result.rows[0].now);
    return true;
  } catch (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
    return false;
  }
}

/* Cerrar pool al apagar el servidor */
process.on('SIGINT', () => {
  pool.end(() => {
    console.log('Pool de PostgreSQL cerrado');
    process.exit(0);
  });
});