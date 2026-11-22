import { api } from './api.js';
import { cerrarSesion } from './auth.js';

const alerta = document.getElementById('recuperacion-alerta');
const panes = ['pane-recuperacion', 'pane-restablecer', 'pane-recuperacion-exito'];
const formRecuperacion = document.getElementById('form-recuperacion');
const formRestablecer = document.getElementById('form-restablecer');
const btnRecuperacion = document.getElementById('btn-recuperacion');
const btnRestablecer = document.getElementById('btn-restablecer');

function mostrarPane(id) {
  panes.forEach(pane => document.getElementById(pane).classList.toggle('active', pane === id));
}
function mostrarAlerta(tipo, mensaje) {
  alerta.className = `auth__alert auth__alert--${tipo} show`;
  alerta.textContent = mensaje;
}
function ocultarAlerta() {
  alerta.className = 'auth__alert';
  alerta.textContent = '';
}
function mostrarError(err) {
  // No mostrar estructuras internas ni valores recibidos en errores de validación.
  if (err.status === 429) return mostrarAlerta('error', 'Demasiadas solicitudes. Intenta nuevamente más tarde.');
  if (err.status === 400 && err.message.startsWith('El enlace es inválido')) return mostrarAlerta('error', err.message);
  if (err.status === 400) return mostrarAlerta('error', 'Revisa los datos ingresados.');
  mostrarAlerta('error', 'No pudimos completar la solicitud. Intenta nuevamente.');
}

// El token existe únicamente en la memoria de esta página. Nunca se guarda en localStorage.
const fragmento = new URLSearchParams(window.location.hash.slice(1));
let token = fragmento.get('token');
const habiaFragmento = !!window.location.hash;
if (habiaFragmento) history.replaceState(null, '', window.location.pathname + window.location.search);
if (token && /^[a-f0-9]{64}$/.test(token)) {
  mostrarPane('pane-restablecer');
  btnRestablecer.disabled = false;
} else {
  token = null;
  mostrarPane('pane-recuperacion');
  btnRecuperacion.disabled = false;
  if (habiaFragmento) mostrarAlerta('error', 'El enlace es inválido. Solicita uno nuevo.');
}

formRecuperacion.addEventListener('submit', async e => {
  e.preventDefault();
  if (btnRecuperacion.disabled || !formRecuperacion.reportValidity()) return;
  ocultarAlerta();
  const email = document.getElementById('recuperacion-email').value.trim();
  btnRecuperacion.disabled = true;
  btnRecuperacion.textContent = 'Enviando...';
  try {
    const data = await api.post('/auth/olvide-password', { email }, { auth: false });
    if (!data?.ok) throw new Error('Respuesta inválida');
    mostrarAlerta('success', 'Si existe una cuenta activa con ese correo verificado, recibirás un enlace. Revisa también el correo no deseado.');
    formRecuperacion.reset();
  } catch (err) {
    mostrarError(err);
  } finally {
    btnRecuperacion.disabled = false;
    btnRecuperacion.textContent = 'Enviar enlace de recuperación';
  }
});

formRestablecer.addEventListener('submit', async e => {
  e.preventDefault();
  if (!token || btnRestablecer.disabled || !formRestablecer.reportValidity()) return;
  ocultarAlerta();
  const password = document.getElementById('reset-password').value;
  const confirmacion = document.getElementById('reset-confirmar').value;
  if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || new TextEncoder().encode(password).length > 72) {
    return mostrarAlerta('error', 'Usa al menos 8 caracteres, con mayúscula, minúscula y número, sin superar los 72 bytes.');
  }
  if (password !== confirmacion) return mostrarAlerta('error', 'Las contraseñas no coinciden.');
  btnRestablecer.disabled = true;
  btnRestablecer.textContent = 'Guardando...';
  try {
    const data = await api.post('/auth/reset-password', { token, password }, { auth: false });
    if (!data?.ok) throw new Error('Respuesta inválida');
    token = null;
    formRestablecer.reset();
    // Limpiar sesión local para no redirigir a app.html con un JWT revocado.
    try { cerrarSesion(); } catch {}
    mostrarPane('pane-recuperacion-exito');
    mostrarAlerta('success', 'Tu contraseña ha sido restablecida correctamente.');
  } catch (err) {
    mostrarError(err);
  } finally {
    btnRestablecer.disabled = !token;
    btnRestablecer.textContent = 'Guardar nueva contraseña';
  }
});
