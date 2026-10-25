/* =========================================================
   expirarPremium.job.js — Degrada premium vencido + avisa
   =========================================================
   Corre 30s después del arranque y luego cada 24h.
   No usa node-cron (evita dependencia nueva).
   Cuando entre MercadoPago, esto pasa a ser un webhook.
*/

import { pool } from '../config/db.js';
import { enviarEmailExpiracionPremium } from '../utils/mailer.js';

const INTERVALO_MS        = 24 * 60 * 60 * 1000; // 24h
const ESPERA_INICIAL_MS   = 30 * 1000;           // 30s

let intervaloId = null;

async function ejecutarJobExpirarPremium() {
  try {
    const { rows } = await pool.query(`
      UPDATE usuarios
      SET plan = 'basico', updated_at = NOW()
      WHERE plan = 'premium'
        AND premium_hasta IS NOT NULL
        AND premium_hasta <= NOW()
      RETURNING id, nombre, email
    `);

    if (rows.length === 0) return;

    console.log(`[jobExpirarPremium] ${rows.length} usuario(s) degradados a Básico`);

    for (const u of rows) {
      // Historial (best-effort)
      try {
        await pool.query(
          `INSERT INTO suscripciones
             (usuario_id, plan_anterior, plan_nuevo, origen)
           VALUES ($1, 'premium', 'basico', 'expiracion')`,
          [u.id]
        );
      } catch (err) {
        console.error('[jobExpirarPremium] Error registrando suscripción:', err.message);
      }

      // Correo (best-effort)
      try {
        if (u.email) {
          await enviarEmailExpiracionPremium(u.email, u.nombre);
        }
      } catch (err) {
        console.error(`[jobExpirarPremium] Error enviando mail a ${u.email}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[jobExpirarPremium] Error general:', err);
  }
}

export function iniciarJobExpirarPremium() {
  if (intervaloId) return intervaloId;

  console.log('⏰ Job de expiración premium iniciado (cada 24h)');

  setTimeout(() => {
    ejecutarJobExpirarPremium().catch(err =>
      console.error('[jobExpirarPremium] Error inicial:', err)
    );
  }, ESPERA_INICIAL_MS);

  intervaloId = setInterval(() => {
    ejecutarJobExpirarPremium().catch(err =>
      console.error('[jobExpirarPremium] Error periódico:', err)
    );
  }, INTERVALO_MS);

  return intervaloId;
}