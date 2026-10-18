/* =========================================================
   main.js — Punto de entrada de la app (app.html)
   =========================================================
   Se encarga de:
   - Verificar sesión antes de mostrar la app
   - Refrescar datos del usuario desde el backend
   - Inicializar componentes (header, dropdowns, notificaciones)
   - Conectar el botón de logout
   - Iniciar el router SPA
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
  initTheme, // ⚡ NUEVO
} from './components.js';

/* =========================================================
   GUARD: SI NO HAY SESIÓN → LOGIN
   ========================================================= */

if (!estaAutenticado()) {
  window.location.href = 'index.html';
  throw new Error('Sin sesión — redirigiendo a login');
}

/* =========================================================
   PINTAR USUARIO EN EL HEADER
   ========================================================= */
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

/* =========================================================
   LOGOUT
   ========================================================= */
async function cerrarSesionYRedirigir() {
  const { logout } = await import('./services/auth.service.js');
  await logout();
  window.location.href = 'index.html';
}

/* =========================================================
   INICIALIZACIÓN
   ========================================================= */
async function init() {
  // 1. Pintar el usuario guardado en localStorage (rápido)
  let usuario = getSesion();
  pintarUsuarioEnHeader(usuario);

  // 2. Refrescar datos desde el backend
  try {
    usuario = await obtenerUsuarioActual();
    pintarUsuarioEnHeader(usuario);
  } catch (err) {
    console.warn('[main] No se pudo refrescar el usuario:', err.message);
  }

  // 3. Inicializar componentes de UI (header, dropdowns, etc.)
  try {
    initHeader();
    initDropdowns();
    initNotificaciones();
    initConfiguracion();
    initTheme(); // ⚡ NUEVO
  } catch (err) {
    console.warn('[main] Error inicializando componentes:', err.message);
  }

  // 4. Conectar botón de logout del sidebar
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

  // 5. Conectar logout del menú de usuario (data-action="logout")
  //    Si components.js ya lo maneja, esto no hace nada.
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

  // 6. Iniciar el router
  iniciarRouter();
}

init();