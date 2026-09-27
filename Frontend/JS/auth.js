/* =========================================================
   auth.js — Login, registro y manejo de sesión
   =========================================================
   NOTA: por ahora todo pasa por localStorage (mock).
   Cuando exista backend, las funciones login() y registro()
   llamarán a api.js → fetch() → servidor real.
*/

import { mockUsuarios } from './data-mock.js';

const SESSION_KEY = 'miejquipo_session';
const USERS_KEY = 'miejquipo_usuarios';

/* ---------- UTILIDADES DE SESIÓN ---------- */

export function getSesion() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSesion(usuario) {
  // Nunca guardamos la contraseña en la sesión
  const { password, ...safeUser } = usuario;
  localStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
}

export function cerrarSesion() {
  localStorage.removeItem(SESSION_KEY);
}

/* ---------- "BASE DE DATOS" MOCK ---------- */

// Carga los usuarios desde localStorage, o los inicializa con los mock
function cargarUsuarios() {
  const raw = localStorage.getItem(USERS_KEY);
  if (raw) return JSON.parse(raw);

  // Primera vez: se copian los mock a localStorage
  localStorage.setItem(USERS_KEY, JSON.stringify(mockUsuarios));
  return [...mockUsuarios];
}

function guardarUsuarios(usuarios) {
  localStorage.setItem(USERS_KEY, JSON.stringify(usuarios));
}

/* ---------- LOGIN ---------- */

export async function login(emailOCorreo, password) {
  // Simulamos un pequeño delay de red para que se sienta real
  await delay(500);

  const usuarios = cargarUsuarios();
  const user = usuarios.find(
    u => u.email === emailOCorreo || u.username === emailOCorreo
  );

  if (!user) {
    throw new Error('Usuario no encontrado');
  }
  if (user.password !== password) {
    throw new Error('Contraseña incorrecta');
  }

  setSesion(user);
  return user;
}

/* ---------- REGISTRO ---------- */

export async function registro({ nombre, email, username, password }) {
  await delay(600);

  const usuarios = cargarUsuarios();

  if (usuarios.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Ya existe una cuenta con ese email');
  }
  if (usuarios.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('Ese nombre de usuario ya está en uso');
  }

  const nuevoUsuario = {
    id: Date.now(),
    nombre,
    email,
    username,
    password,
    avatar: `https://i.pravatar.cc/150?u=${username}`,
    deporte_favorito: null,
    ciudad: null,
    bio: "",
    stats: { partidos: 0, goles: 0, mvps: 0 }
  };

  usuarios.push(nuevoUsuario);
  guardarUsuarios(usuarios);
  setSesion(nuevoUsuario);
  return nuevoUsuario;
}

/* ---------- HELPERS ---------- */

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}