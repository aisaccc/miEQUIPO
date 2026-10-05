/* =========================================================
   auth-page.js — Controlador del login/registro (index.html)
   ========================================================= */

import { login, registro, getSesion, estaAutenticado } from './auth.js';

/* ---------- SI YA HAY SESIÓN, REDIRIGIR A LA APP ---------- */
if (estaAutenticado()) {
  window.location.href = 'app.html';
}

/* ---------- REFERENCIAS ---------- */
const tabs        = document.querySelectorAll('.auth__tab');
const paneLogin   = document.getElementById('pane-login');
const paneReg     = document.getElementById('pane-registro');
const formLogin   = document.getElementById('form-login');
const formReg     = document.getElementById('form-registro');
const alerta      = document.getElementById('alerta');

/* ---------- CAMBIO DE TAB ---------- */
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    tabs.forEach(t => t.classList.toggle('active', t === tab));

    paneLogin.classList.toggle('active', target === 'login');
    paneReg.classList.toggle('active', target === 'registro');
    ocultarAlerta();
  });
});

/* ---------- MOSTRAR / OCULTAR CONTRASEÑA ---------- */
document.querySelectorAll('[data-toggle]').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.toggle);
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    btn.textContent = visible ? 'Ver' : 'Ocultar';
  });
});

/* ---------- VALIDACIÓN EN VIVO ---------- */
document.querySelectorAll('.field__input').forEach(input => {
  input.addEventListener('input', () => {
    const field = input.closest('.field');
    if (field) field.classList.remove('has-error');
  });
  input.addEventListener('blur', () => {
    if (input.value.trim() === '' && input.required) {
      input.closest('.field')?.classList.add('has-error');
    }
  });
});

/* ---------- LOGIN ---------- */
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  ocultarAlerta();

  const id   = document.getElementById('login-id');
  const pass = document.getElementById('login-pass');

  let valido = true;
  if (!id.value.trim())   { marcarError(id); valido = false; }
  if (!pass.value.trim()) { marcarError(pass); valido = false; }
  if (!valido) return;

  const btn = formLogin.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Ingresando...';

  try {
    const user = await login(id.value.trim(), pass.value);
    mostrarAlerta('success', `¡Bienvenido, ${user.nombre}! Redirigiendo...`);
    setTimeout(() => { window.location.href = 'app.html'; }, 700);
  } catch (err) {
    mostrarAlerta('error', err.message);
    btn.disabled = false;
    btn.textContent = 'Iniciar sesión';
  }
});

/* ---------- REGISTRO ---------- */
formReg.addEventListener('submit', async (e) => {
  e.preventDefault();
  ocultarAlerta();

  const nombre = document.getElementById('reg-nombre');
  const email  = document.getElementById('reg-email');
  const user   = document.getElementById('reg-user');
  const pass   = document.getElementById('reg-pass');

  let valido = true;
  if (nombre.value.trim().length < 2)      { marcarError(nombre); valido = false; }
  if (!esEmailValido(email.value.trim()))  { marcarError(email);  valido = false; }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(user.value.trim())) { marcarError(user); valido = false; }
  const passwordOk = pass.value.length >= 8
  && /[a-z]/.test(pass.value)
  && /[A-Z]/.test(pass.value)
  && /[0-9]/.test(pass.value);
  if (!passwordOk) { marcarError(pass); valido = false; }
  if (!valido) return;

  const btn = formReg.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Creando cuenta...';

  try {
    const nuevo = await registro({
      nombre: nombre.value.trim(),
      email: email.value.trim(),
      username: user.value.trim(),
      password: pass.value
    });
    mostrarAlerta('success', `¡Cuenta creada, ${nuevo.nombre}! Redirigiendo...`);
    setTimeout(() => { window.location.href = 'app.html'; }, 800);
  } catch (err) {
    mostrarAlerta('error', err.message);
    btn.disabled = false;
    btn.textContent = 'Crear cuenta';
  }
});

/* ---------- HELPERS ---------- */
function marcarError(input) {
  input.closest('.field')?.classList.add('has-error');
}

function mostrarAlerta(tipo, mensaje) {
  alerta.className = `auth__alert auth__alert--${tipo} show`;
  alerta.textContent = mensaje;
}

function ocultarAlerta() {
  alerta.className = 'auth__alert';
  alerta.textContent = '';
}

function esEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}