import dotenv from 'dotenv';
dotenv.config();

/* Validar que existan las variables críticas */
const required = [
  'PORT',
  'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER',
  'JWT_SECRET', 'JWT_REFRESH_SECRET',
];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error('❌ Faltan variables de entorno:', missing.join(', '));
  process.exit(1);
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 3000,

  DB: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },

  JWT: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  MAIL: {
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    from: process.env.MAIL_FROM,
  },

  FRONTEND_URL: process.env.FRONTEND_URL || 'http://127.0.0.1:5500',
};