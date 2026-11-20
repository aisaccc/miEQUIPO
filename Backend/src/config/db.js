import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

// ⚡ v2: max reducido de 20 → 10 (más conservador con el Pooler de Supabase)
//    y connectionTimeoutMillis subido a 10s para tolerar picos.
export const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
    : {
        host: env.DB.host,
        port: env.DB.port,
        database: env.DB.database,
        user: env.DB.user,
        password: env.DB.password,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
);

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

process.on('SIGINT', () => {
  pool.end(() => {
    console.log('Pool de PostgreSQL cerrado');
    process.exit(0);
  });
});