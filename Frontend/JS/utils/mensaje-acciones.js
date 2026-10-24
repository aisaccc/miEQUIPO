/* =========================================================
   mensaje-acciones.js — Menú de acciones sobre mensajes
   ========================================================= */
import { toast } from '../components.js';

const LONG_PRESS_MS = 600; // 0.6 segundos es más cómodo en móvil
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

// Cerrar al hacer clic fuera
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

  // Evitamos que el menú herede eventos del mensaje
  menu.addEventListener('pointerdown', (e) => e.stopPropagation());
  menu.addEventListener('touchstart', (e) => e.stopPropagation());

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

  // Cerrar si se hace scroll
  const cerrar = () => cerrarMenuActual();
  window.addEventListener('scroll', cerrar, { once: true, capture: true });
  menuAbiertoCerrar = () => {
    window.removeEventListener('scroll', cerrar, { capture: true });
  };
}

export function conectarAccionesMensaje(contenedor, ctx) {
  if (!contenedor) return;

  // 1. Click en el botón ⋯ (Web / Escritorio)
  contenedor.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-msg-menu-btn]');
    if (!btn) return;

    const msgEl = btn.closest('.msg[data-msg-id]');
    if (!msgEl) return;
    if (msgEl.classList.contains('msg--eliminado')) return; // ⚡ IGNORAR ELIMINADOS

    e.stopPropagation();

    const msg = ctx.obtenerMensajePorId?.(msgEl.dataset.msgId);
    if (!msg || msg.eliminadoParaTodos) return; // ⚡ Doble chequeo

    abrirMenuEnMensaje(msgEl, msg, ctx);
  });

  // 2. Long Press Manual (Para móviles que no disparan contextmenu)
  let pressTimer = null;
  let startX = 0, startY = 0;

  const cancelarPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  contenedor.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const msgEl = e.target.closest('.msg[data-msg-id]');
    if (!msgEl) return;
    if (msgEl.classList.contains('msg--eliminado')) return; // ⚡ IGNORAR ELIMINADOS
    if (e.target.closest('[data-msg-menu-btn]')) return;

    startX = e.clientX;
    startY = e.clientY;

    pressTimer = setTimeout(() => {
      const msg = ctx.obtenerMensajePorId?.(msgEl.dataset.msgId);
      if (msg && !msg.eliminadoParaTodos) { // ⚡ Doble chequeo
        abrirMenuEnMensaje(msgEl, msg, ctx);
        if (navigator.vibrate) navigator.vibrate(30);
        window.getSelection()?.removeAllRanges();
      }
      pressTimer = null;
    }, LONG_PRESS_MS);
  }, { passive: true });

  contenedor.addEventListener('pointermove', (e) => {
    if (!pressTimer) return;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    if (dx > MOVE_TOLERANCE_PX || dy > MOVE_TOLERANCE_PX) {
      cancelarPress();
    }
  }, { passive: true });

  contenedor.addEventListener('pointerup', cancelarPress, { passive: true });
  contenedor.addEventListener('pointercancel', cancelarPress, { passive: true });
  contenedor.addEventListener('pointerleave', cancelarPress, { passive: true });

  // 3. Evento ContextMenu (El nativo de long-press en móviles modernos)
  contenedor.addEventListener('contextmenu', (e) => {
    const msgEl = e.target.closest('.msg[data-msg-id]');
    if (!msgEl) return;
    if (msgEl.classList.contains('msg--eliminado')) return; // ⚡ IGNORAR ELIMINADOS

    e.preventDefault();
    e.stopPropagation();

    cancelarPress();

    const msg = ctx.obtenerMensajePorId?.(msgEl.dataset.msgId);
    if (msg && !msg.eliminadoParaTodos) { // ⚡ Doble chequeo
      abrirMenuEnMensaje(msgEl, msg, ctx);
    }
  });
}