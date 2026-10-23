/* =========================================================
   main.js — Punto de entrada de la app (app.html) (v2)
   =========================================================
   Cambios v2:
   - El router arranca PRIMERO (UI más rápida)
   - Componentes con requests escalonados (no todos en el ms 0)
   - Componentes sin requests, inmediatos
*/

import { iniciarRouter } from './router.js';
import {
  getSesion,
  cerrarSesion,
  obtenerUsuarioActual,
  estaAutenticado,
} from './auth.js';
import {
  initHeader,
  initDropdowns,
  initNotificaciones,
  initConfiguracion,
  initTheme,
  initBadgeMensajes, // ⚡ AGREGAR ESTO
} from './components.js';

if (!estaAutenticado()) {
  window.location.href = 'index.html';
  throw new Error('Sin sesión — redirigiendo a login');
}

function pintarUsuarioEnHeader(usuario) {
  if (!usuario) return;

  const avatar = document.getElementById('avatar-header');
  if (avatar) {
    if (usuario.avatar) {
      avatar.src = usuario.avatar;
      avatar.alt = usuario.nombre || 'Usuario';
    } else {
      avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(usuario.nombre || 'U')}&background=ff6a00&color=fff`;
    }
  }

  const nombreHeader = document.getElementById('nombre-header');
  if (nombreHeader) {
    nombreHeader.textContent = usuario.nombre || usuario.username || 'Usuario';
  }
}

async function cerrarSesionYRedirigir() {
  const { logout } = await import('./services/auth.service.js');
  await logout();
  window.location.href = 'index.html';
}

async function init() {
  // 1. Pintar el usuario guardado (instantáneo, sin request)
  let usuario = getSesion();
  pintarUsuarioEnHeader(usuario);

  // 2. ⚡ Arrancar el router PRIMERO (renderiza HTML y muestra loader)
  iniciarRouter();

  // 3. Refrescar usuario desde backend (1 request)
  try {
    usuario = await obtenerUsuarioActual();
    pintarUsuarioEnHeader(usuario);
  } catch (err) {
    console.warn('[main] No se pudo refrescar el usuario:', err.message);
  }

  // 4. Componentes sin requests — inmediatos
  try {
    initHeader();
    initTheme();
    initConfiguracion();
  } catch (err) {
    console.warn('[main] Error inicializando componentes básicos:', err.message);
  }

  // 5. ⚡ Componentes CON requests — escalonados para no saturar
  setTimeout(() => {
    try { initDropdowns(); } catch (err) { console.warn('[main] initDropdowns:', err); }
  }, 400);

  setTimeout(() => {
    try { initNotificaciones(); } catch (err) { console.warn('[main] initNotificaciones:', err); }
  }, 900);

  // ⚡ AGREGAR ESTO:
  setTimeout(() => {
    try { initBadgeMensajes(); } catch (err) { console.warn('[main] initBadgeMensajes:', err); }
  }, 500);
  

  // 6. Logout del sidebar
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!confirm('¿Cerrar sesión?')) return;
      btnLogout.disabled = true;
      btnLogout.textContent = 'Cerrando...';
      try {
        await cerrarSesionYRedirigir();
      } catch (err) {
        console.error('[main] Error al cerrar sesión:', err);
        window.location.href = 'index.html';
      }
    });
  }

  // 7. Logout del menú de usuario
  document.addEventListener('click', async (e) => {
    const item = e.target.closest('[data-action="logout"]');
    if (!item) return;
    if (!confirm('¿Cerrar sesión?')) return;
    try {
      await cerrarSesionYRedirigir();
    } catch {
      window.location.href = 'index.html';
    }
  });
}

init();
/* =========================================================
   SCROLL INTELIGENTE (Ocultar barra inferior en móvil)
   ========================================================= */
let lastScrollY = window.scrollY;
const bottomNav = document.querySelector('.app-bottom-nav');

if (bottomNav) {
  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;

    // Si estamos en la parte de arriba de todo, siempre mostrar
    if (currentScrollY < 50) {
      bottomNav.classList.remove('app-bottom-nav--hidden');
    } 
    // Si scrolleamos hacia abajo, ocultar
    else if (currentScrollY > lastScrollY) {
      bottomNav.classList.add('app-bottom-nav--hidden');
    } 
    // Si scrolleamos hacia arriba, mostrar
    else {
      bottomNav.classList.remove('app-bottom-nav--hidden');
    }

    lastScrollY = currentScrollY;
  }, { passive: true });
}