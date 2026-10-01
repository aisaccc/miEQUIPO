import app from './app.js';
import { env } from './config/env.js';
import { testConnection } from './config/db.js';

const PORT = env.PORT;

async function start() {
  const conectado = await testConnection();
  if (!conectado) {
    console.error('❌ No se pudo conectar a la base de datos. Abortando.');
    process.exit(1);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🚀 ========================================');
    console.log(`   MiEquipo Backend corriendo`);
    console.log(`   URL:    http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   Entorno: ${env.NODE_ENV}`);
    console.log('🚀 ========================================');
    console.log('');
  });
}

start();