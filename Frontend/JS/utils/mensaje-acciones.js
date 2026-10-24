/* =========================================================
   mensaje-acciones.js — Menú de acciones sobre mensajes
   =========================================================
   Usado por:
   - JS/pages/mi-equipo.js (chats de equipos/comunidades)
   - JS/pages/mensajes.js (chats 1 a 1)
   - JS/pages/torneo-detalle.js (chat de torneos)

   Requiere que cada mensaje renderizado tenga:
   - class="msg"
   - data-msg-id="<uuid del mensaje>"
   - data-msg-autor-id="<uuid del autor>"

   Uso:
   import { conectarAccionesMensaje } from '../utils/mensaje-acciones.js';

   conectarAccionesMensaje(contenedor, {
     usuarioId: user.id,
     onCopiar: (texto) => navigator.clipboard.writeText(texto),
     onEliminarParaMi: async (msgId) => { ... },
     onEliminarParaTodos: async (msgId) => { ... },
     onRefrescar: () => { ... }, // opcional: refrescar la lista de mensajes
   });
   ========================================================= */

import { toast } from '../components.js';

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

let menuAbiertoEl = null;
let menuAbiertoCerrar = null;

function cerrarMenuActual() {
  if (menuAbiertoEl && menuAbiertoEl.parentNode) {
    menuAbiertoEl.parentNode.removeChild(menuAbiertoEl);
  }
  menuAbiertoEl = null;
  if (typeof menuAbiertoCerrar === 'function') {
    menuAbiertoCerrar();
    menuAbiertoCerrar = null;
  }
}

document.addEventListener('click', (e) => {
  if (menuAbiertoEl && !menuAbiertoEl.contains(e.target) && !e.target.closest('[data-msg-menu-btn]')) {
    cerrarMenuActual();
  }
});

function crearMenu({ msg, usuarioId, onCopiar, onEliminarParaMi, onEliminarParaTodos, onRefrescar }) {
  const esMio = String(msg.autorId) === String(usuarioId);
  const tieneTexto = !!msg.texto;

  const menu = document.createElement('div');
  menu.className = 'msg-menu';

  menu.innerHTML = `
    ${tieneTexto ? `
      <button class="msg-menu__item" type="button" data-accion-msg="copiar">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Copiar
      </button>
    ` : ''}

    <button class="msg-menu__item" type="button" data-accion-msg="eliminar">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
      Eliminar mensaje
    </button>
  `;

  // Submenú de "Eliminar"
  const submenu = document.createElement('div');
  submenu.className = 'msg-menu__sub';
  submenu.hidden = true;
  submenu.innerHTML = `
    <button class="msg-menu__item" type="button" data-accion-msg="eliminar-para-mi">
      Solo para mí
    </button>
    ${esMio ? `
      <button class="msg-menu__item msg-menu__item--danger" type="button" data-accion-msg="eliminar-para-todos">
        Para todos
      </button>
    ` : ''}
    <button class="msg-menu__item" type="button" data-accion-msg="volver">
      ← Volver
    </button>
  `;

  menu.appendChild(submenu);

  menu.addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn = e.target.closest('[data-accion-msg]');
    if (!btn) return;
    const accion = btn.dataset.accionMsg;

    if (accion === 'copiar') {
      try {
        await onCopiar(msg.texto);
        toast('Copiado', 'success');
      } catch (err) {
        toast('No se pudo copiar', 'error');
      }
      cerrarMenuActual();
      return;
    }

    if (accion === 'eliminar') {
      submenu.hidden = false;
      return;
    }

    if (accion === 'volver') {
      submenu.hidden = true;
      return;
    }

    if (accion === 'eliminar-para-mi') {
      try {
        await onEliminarParaMi(msg.id);
        cerrarMenuActual();
        if (typeof onRefrescar === 'function') await onRefrescar();
      } catch (err) {
        toast(err.message || 'No se pudo eliminar', 'error');
      }
      return;
    }

    if (accion === 'eliminar-para-todos') {
      try {
        await onEliminarParaTodos(msg.id);
        cerrarMenuActual();
        if (typeof onRefrescar === 'function') await onRefrescar();
      } catch (err) {
        toast(err.message || 'No se pudo eliminar', 'error');
      }
      return;
    }
  });

  return menu;
}

function abrirMenuEnMensaje(msgEl, msg, ctx) {
  cerrarMenuActual();

  const menu = crearMenu({ msg, ...ctx });
  msgEl.appendChild(menu);
  menuAbiertoEl = menu;

  // Cerrar al scrollear fuera o resize
  const cerrar = () => cerrarMenuActual();
  window.addEventListener('scroll', cerrar, { once: true, capture: true });
  window.addEventListener('resize', cerrar, { once: true });
  menuAbiertoCerrar = () => {
    window.removeEventListener('scroll', cerrar, { capture: true });
    window.removeEventListener('resize', cerrar);
  };
}

export function conectarAccionesMensaje(contenedor, ctx) {
  if (!contenedor) return;

  const mensajesPorId = new Map();
  contenedor.querySelectorAll('.msg[data-msg-id]').forEach(el => {
    el.dataset.accionesConectadas = '1';
  });

  // Click en el botón ⋯ (desktop)
  contenedor.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-msg-menu-btn]');
    if (!btn) return;
    e.stopPropagation();

    const msgEl = btn.closest('.msg[data-msg-id]');
    if (!msgEl) return;

    const msg = ctx.obtenerMensajePorId?.(msgEl.dataset.msgId);
    if (!msg) return;

    abrirMenuEnMensaje(msgEl, msg, ctx);
  });

  // Long press (mobile)
  let pressTimer = null;
  let startX = 0, startY = 0;
  let pressMsgEl = null;

  contenedor.addEventListener('touchstart', (e) => {
    const msgEl = e.target.closest('.msg[data-msg-id]');
    if (!msgEl) return;
    if (e.touches.length !== 1) return;

    pressMsgEl = msgEl;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;

    pressTimer = setTimeout(() => {
      const msg = ctx.obtenerMensajePorId?.(msgEl.dataset.msgId);
      if (msg) abrirMenuEnMensaje(msgEl, msg, ctx);
      if (navigator.vibrate) navigator.vibrate(30);
      pressTimer = null;
    }, LONG_PRESS_MS);
  }, { passive: true });

  const cancelarPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    pressMsgEl = null;
  };

  contenedor.addEventListener('touchmove', (e) => {
    if (!pressTimer || !e.touches[0]) return;
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dx > MOVE_TOLERANCE_PX || dy > MOVE_TOLERANCE_PX) cancelarPress();
  }, { passive: true });

  contenedor.addEventListener('touchend', cancelarPress, { passive: true });
  contenedor.addEventListener('touchcancel', cancelarPress, { passive: true });
}