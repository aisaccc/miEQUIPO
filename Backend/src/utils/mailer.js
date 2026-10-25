import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

/* Creamos el transporter UNA VEZ y lo reusamos. */
const transporter = nodemailer.createTransport({
  host: env.MAIL.host,
  port: env.MAIL.port,
  auth: {
    user: env.MAIL.user,
    pass: env.MAIL.pass,
  },
});

/**
 * Verifica que la conexión con el servidor SMTP funcione.
 */
export async function verificarMailer() {
  try {
    await transporter.verify();
    console.log('✅ Mailer (SMTP) configurado correctamente');
    return true;
  } catch (err) {
    console.error('❌ Error en Mailer:', err.message);
    return false;
  }
}

/**
 * Envía un email genérico.
 */
async function enviar({ to, subject, html }) {
  return transporter.sendMail({
    from: env.MAIL.from,
    to,
    subject,
    html,
  });
}

/* =========================================================
   PLANTILLAS DE EMAIL
   ========================================================= */

const estilosBase = `
  font-family: 'Segoe UI', Roboto, Arial, sans-serif;
  color: #2b3a38;
  line-height: 1.6;
`;

function plantillaBase(contenido) {
  return `
    <div style="${estilosBase} max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: #ff6a00; color: white;
                    width: 48px; height: 48px; border-radius: 12px;
                    line-height: 48px; font-size: 24px; font-weight: 800;">
          ⚽
        </div>
        <h1 style="color: #ff6a00; margin: 12px 0 0; font-size: 22px;">
          MiEquipo
        </h1>
      </div>

      <div style="background: #ffffff; border: 1px solid #e5e7eb;
                  border-radius: 12px; padding: 32px;">
        ${contenido}
      </div>

      <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
        © 2026 MiEquipo. Todos los derechos reservados.
      </p>
    </div>
  `;
}

/* =========================================================
   EMAILS ESPECÍFICOS
   ========================================================= */

export async function enviarEmailVerificacion(email, nombre, token) {
  const link = `${env.FRONTEND_URL}/verify-email.html?token=${token}`;

  const html = plantillaBase(`
    <h2 style="color: #2b3a38; margin-top: 0;">¡Hola, ${nombre}! 👋</h2>
    <p>Gracias por registrarte en <strong>MiEquipo</strong>. Para activar tu cuenta, confirmá tu email:</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${link}"
         style="background: #ff6a00; color: white; padding: 14px 32px;
                border-radius: 10px; text-decoration: none;
                font-weight: 700; display: inline-block;">
        Verificar mi cuenta
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      O copiá este link en tu navegador:<br>
      <a href="${link}" style="color: #ff6a00; word-break: break-all;">${link}</a>
    </p>

    <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
      Este link expira en <strong>24 horas</strong>.
    </p>

    <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
      Si no creaste esta cuenta, ignorá este mensaje.
    </p>
  `);

  return enviar({
    to: email,
    subject: 'Verificá tu cuenta en MiEquipo',
    html,
  });
}

export async function enviarEmailResetPassword(email, nombre, token) {
  const link = `${env.FRONTEND_URL}/reset-password.html?token=${token}`;

  const html = plantillaBase(`
    <h2 style="color: #2b3a38; margin-top: 0;">Recuperar contraseña 🔐</h2>
    <p>Hola <strong>${nombre}</strong>, recibimos una solicitud para cambiar tu contraseña.</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${link}"
         style="background: #ff6a00; color: white; padding: 14px 32px;
                border-radius: 10px; text-decoration: none;
                font-weight: 700; display: inline-block;">
        Cambiar contraseña
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      O copiá este link:<br>
      <a href="${link}" style="color: #ff6a00; word-break: break-all;">${link}</a>
    </p>

    <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
      Este link expira en <strong>1 hora</strong>.
    </p>

    <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
      Si no solicitaste este cambio, ignorá este mensaje. Tu contraseña actual sigue siendo válida.
    </p>
  `);

  return enviar({
    to: email,
    subject: 'Recuperar contraseña — MiEquipo',
    html,
  });
}

export async function enviarEmailBienvenida(email, nombre) {
  const html = plantillaBase(`
    <h2 style="color: #2b3a38; margin-top: 0;">¡Cuenta verificada! 🎉</h2>
    <p>Hola <strong>${nombre}</strong>, ya podés usar MiEquipo al máximo:</p>

    <ul style="color: #4b5563; font-size: 14px; line-height: 1.8; padding-left: 20px;">
      <li>Unirte a partidos en tu ciudad</li>
      <li>Crear tu propio equipo o comunidad</li>
      <li>Organizar torneos y retar a otros</li>
      <li>Chatear con otros jugadores</li>
    </ul>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${env.FRONTEND_URL}"
         style="background: #ff6a00; color: white; padding: 14px 32px;
                border-radius: 10px; text-decoration: none;
                font-weight: 700; display: inline-block;">
        Ir a MiEquipo
      </a>
    </div>
  `);

  return enviar({
    to: email,
    subject: '¡Bienvenido a MiEquipo!',
    html,
  });
}

/* =========================================================
   PLANES — v13
   ========================================================= */

export async function enviarEmailExpiracionPremium(email, nombre) {
  const html = plantillaBase(`
    <h2 style="color: #2b3a38; margin-top: 0;">Tu plan Premium expiró</h2>
    <p>Hola <strong>${nombre}</strong>, tu suscripción Premium venció y tu cuenta volvió al plan Básico.</p>

    <p>Tus datos, equipos, comunidades y publicaciones existentes siguen disponibles. 
    Pero no podrás usar las funciones premium hasta renovar:</p>

    <ul style="color: #4b5563; font-size: 14px; line-height: 1.8; padding-left: 20px;">
      <li>Crear torneos</li>
      <li>Estadísticas de perfil y de equipo</li>
      <li>Personalizar cards y cambiar el marco de perfil</li>
      <li>Publicaciones con foto ilimitadas</li>
    </ul>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${env.FRONTEND_URL}"
         style="background: #ff6a00; color: white; padding: 14px 32px;
                border-radius: 10px; text-decoration: none;
                font-weight: 700; display: inline-block;">
        Renovar Premium
      </a>
    </div>

    <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
      Plan Básico: 2 equipos, 1 comunidad, 3 fotos por mes en perfil, 4 fotos concurrentes por grupo.
    </p>
  `);

  return enviar({
    to: email,
    subject: 'Tu plan Premium expiró — MiEquipo',
    html,
  });
}

export async function enviarEmailCancelacionPremium(email, nombre) {
  const html = plantillaBase(`
    <h2 style="color: #2b3a38; margin-top: 0;">Suscripción Premium cancelada</h2>
    <p>Hola <strong>${nombre}</strong>, confirmamos la cancelación de tu suscripción Premium.</p>

    <p>Tu cuenta permanecerá en el plan Premium hasta el final del período actual. Después pasará al plan Básico.</p>

    <p>Todo tu contenido existente seguirá visible, pero no podrás usar funciones premium hasta renovar.</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${env.FRONTEND_URL}"
         style="background: #ff6a00; color: white; padding: 14px 32px;
                border-radius: 10px; text-decoration: none;
                font-weight: 700; display: inline-block;">
        Reactivar Premium
      </a>
    </div>
  `);

  return enviar({
    to: email,
    subject: 'Suscripción Premium cancelada — MiEquipo',
    html,
  });
}