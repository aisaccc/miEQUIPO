/* =========================================================
   mensajes.js — Chat 1 a 1 con backend
   =========================================================
   - Lista de conversaciones (izquierda)
   - Panel de chat (derecha)
   - Modal "Nueva conversación"
   */

import { getSesion } from '../auth.js';
import { toast, abrirModal, cerrarModal } from '../components.js';
import {
  listarConversaciones,
  obtenerConversacion,
  crearConversacion,
  ocultarConversacion,
  listarMensajes,
  enviarMensaje,
  marcarLeidos,
} from '../services/mensajes.service.js';
import { listarGrupos } from '../services/grupos.service.js';

export async function init() {
  const user = getSesion();
  if (!user) return null;

  const listaConversaciones = document.getElementById('lista-conversaciones');
  const panelMensajes = document.getElementById('panel-mensajes');
  const buscarConv = document.getElementById('buscar-conversacion');
  const btnNuevaConv = document.getElementById('btn-nueva-conv');

  if (!listaConversaciones) return null;

  /* ---------- ESTADO ---------- */
  let convActualId = null;
  let intervaloRefresco = null;
  let filtroTexto = '';
  let conversaciones = [];

  /* =========================================================
     HELPERS
     ========================================================= */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function horaCorta(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const hoy = new Date();
    const mismoDia = d.toDateString() === hoy.toDateString();

    if (mismoDia) {
      return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  }

  function avatarDe(usuario) {
    return usuario?.avatar || 'assets/icons/usuario.svg';
  }

  /* =========================================================
     CARGAR CONVERSACIONES DESDE EL BACKEND
     ========================================================= */
  async function recargarConversaciones() {
    try {
      conversaciones = await listarConversaciones();
    } catch (err) {
      console.error('[mensajes] Error al cargar conversaciones:', err);
      conversaciones = [];
    }
  }

  /* =========================================================
     RENDER: LISTA DE CONVERSACIONES
     ========================================================= */
  function renderListaConversaciones() {
    // Filtrar por texto
    const filtradas = filtroTexto
      ? conversaciones.filter(c => {
          const otro = c.otroUsuario || {};
          const t = filtroTexto.toLowerCase();
          return (
            (otro.nombre || '').toLowerCase().includes(t) ||
            (otro.username || '').toLowerCase().includes(t)
          );
        })
      : conversaciones;

    if (conversaciones.length === 0) {
      listaConversaciones.innerHTML = `
        <div class="empty-state" style="padding:var(--space-5)">
          <div class="empty-state__icon" style="font-size:36px">💬</div>
          <p class="text-sm text-muted">No tenés conversaciones</p>
          <button class="btn btn--primary btn--sm mt-4" id="btn-empezar-conv">
            Iniciar una conversación
          </button>
        </div>`;
      document.getElementById('btn-empezar-conv')?.addEventListener('click', abrirModalNuevaConv);
      return;
    }

    if (filtradas.length === 0) {
      listaConversaciones.innerHTML = `
        <p class="text-sm text-muted text-center" style="padding:var(--space-4)">
          Sin resultados
        </p>`;
      return;
    }

    listaConversaciones.innerHTML = `
      <div class="text-xs text-muted" style="padding:var(--space-3) var(--space-3) var(--space-2); font-weight:700; text-transform:uppercase; letter-spacing:0.05em">
        👤 Conversaciones
      </div>
      ${filtradas.map(c => {
        const otro = c.otroUsuario || { nombre: 'Usuario', username: 'user', avatar: null };
        const ultimo = c.ultimoMensaje;
        const preview = ultimo
          ? (ultimo.autorId === user.id ? 'Tú: ' : '') + ultimo.texto
          : 'Sin mensajes aún';

        const vinculo = c.vinculadaNombre;

        return `
          <div class="conversation ${c.id === convActualId ? 'active' : ''}"
               data-conv="${c.id}"
               style="position:relative">
            <img src="${avatarDe(otro)}" class="avatar avatar--md" alt="" />
            <div class="conversation__info">
              <div class="conversation__name">
                ${escapeHtml(otro.nombre)}
                ${vinculo ? `<span class="badge badge--warning" style="margin-left:6px; font-size:9px">📎 ${escapeHtml(vinculo).slice(0, 20)}</span>` : ''}
              </div>
              <div class="conversation__preview">${escapeHtml(preview).slice(0, 60)}</div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px">
              ${ultimo ? `<span class="text-xs text-muted">${horaCorta(ultimo.createdAt)}</span>` : ''}
              ${c.noLeidos > 0 ? `<span class="badge badge--primary">${c.noLeidos}</span>` : ''}
            </div>
            <button class="conversation__delete"
                    data-borrar-conv="${c.id}"
                    title="Borrar chat"
                    style="position:absolute; top:6px; right:6px; width:24px; height:24px; border-radius:50%; background:rgba(0,0,0,0.5); color:white; display:none; align-items:center; justify-content:center; font-size:12px; cursor:pointer; border:none">🗑️</button>
          </div>
        `;
      }).join('')}
    `;

    // Mostrar botón al hacer hover
    listaConversaciones.querySelectorAll('.conversation').forEach(el => {
      el.addEventListener('mouseenter', () => {
        const btn = el.querySelector('.conversation__delete');
        if (btn) btn.style.display = 'flex';
      });
      el.addEventListener('mouseleave', () => {
        const btn = el.querySelector('.conversation__delete');
        if (btn) btn.style.display = 'none';
      });
    });

    // Borrar conversación privada (soft delete)
    listaConversaciones.querySelectorAll('[data-borrar-conv]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const convId = btn.dataset.borrarConv;
        if (!confirm('¿Borrar este chat? Solo se borrará para ti.')) return;

        try {
          await ocultarConversacion(convId);

          if (convActualId === convId) {
            convActualId = null;
            panelMensajes.innerHTML = `
              <div class="chat-empty">
                <div style="font-size:48px">💬</div>
                <p class="text-muted mt-4">Selecciona una conversación</p>
              </div>`;
          }
          toast('Chat borrado', 'info');
          await recargarConversaciones();
          renderListaConversaciones();
        } catch (err) {
          console.error('[mensajes] Error al borrar:', err);
          toast(err.message || 'No se pudo borrar', 'error');
        }
      });
    });

    // Conectar clicks para abrir conversación
    listaConversaciones.querySelectorAll('.conversation').forEach(el => {
      el.addEventListener('click', () => {
        abrirConversacion(el.dataset.conv);
      });
    });
  }
    /* =========================================================
     ABRIR CONVERSACIÓN
     ========================================================= */
  async function abrirConversacion(convId) {
    convActualId = convId;
    if (intervaloRefresco) clearInterval(intervaloRefresco);

    // Marcar como leídos en el backend
    try {
      await marcarLeidos(convId);
    } catch (err) {
      console.warn('[mensajes] No se pudo marcar como leídos:', err.message);
    }

    // Recargar la lista para actualizar el badge de no leídos
    await recargarConversaciones();
    renderListaConversaciones();

    // Renderizar el panel
    await renderPanelChat(convId);

    // Polling cada 3s para refrescar el chat
    intervaloRefresco = setInterval(async () => {
      if (convActualId === convId) {
        await refrescarMensajes(convId);
      }
    }, 3000);
  }

  /* =========================================================
     PANEL DE CHAT
     ========================================================= */
  async function renderPanelChat(convId) {
    let conv;
    try {
      conv = await obtenerConversacion(convId);
    } catch (err) {
      console.error('[mensajes] Error al obtener conversación:', err);
      panelMensajes.innerHTML = `
        <div class="chat-empty">
          <div style="font-size:48px">⚠️</div>
          <p class="text-muted mt-4">No se pudo cargar la conversación</p>
        </div>`;
      return;
    }

    const otro = conv.otroUsuario || { nombre: 'Usuario', username: 'user', avatar: null };

    panelMensajes.innerHTML = `
      <div class="chat-header">
        <img src="${avatarDe(otro)}" class="avatar avatar--md" alt="" />
        <div class="chat-header__info">
          <div class="chat-header__name">${escapeHtml(otro.nombre)}</div>
          <div class="chat-header__sub">@${escapeHtml(otro.username)}</div>
        </div>
      </div>

      <div class="chat-mensajes" id="chat-mensajes"></div>

      <form class="chat-input" id="chat-form">
        <input
          type="text"
          id="chat-input-texto"
          placeholder="Escribe un mensaje..."
          maxlength="2000"
          autocomplete="off"
        />
        <button type="submit" class="chat-input__btn">➤</button>
      </form>
    `;

    // Conectar form
    document.getElementById('chat-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await enviarMensajeDelPanel(convId);
    });

    // Cargar mensajes
    await refrescarMensajes(convId);
  }

  /* =========================================================
     REFRESCAR MENSAJES DEL CHAT
     ========================================================= */
  async function refrescarMensajes(convId) {
    const cont = document.getElementById('chat-mensajes');
    if (!cont) return;

    let mensajes;
    try {
      mensajes = await listarMensajes(convId);
    } catch (err) {
      console.error('[mensajes] Error al cargar mensajes:', err);
      return;
    }

    if (mensajes.length === 0) {
      cont.innerHTML = `
        <div class="chat-mensajes__empty">
          <div class="chat-mensajes__empty-icon">💬</div>
          <p>Aún no hay mensajes.</p>
          <p class="text-xs" style="margin-top:4px">¡Saluda para empezar!</p>
        </div>`;
      return;
    }

    const estabaAbajo = cont.scrollHeight - cont.scrollTop - cont.clientHeight < 50;

    cont.innerHTML = mensajes.map(m => {
      const esMio = String(m.autorId) === String(user.id);
      return `
        <div class="msg ${esMio ? 'msg--yo' : ''}">
          ${!esMio ? `<img src="${avatarDe(m.autor)}" class="msg__avatar" alt="" />` : ''}
          <div class="msg__burbuja">
            <div class="msg__texto">${escapeHtml(m.texto)}</div>
            <div class="msg__hora">${horaCorta(m.createdAt)}</div>
          </div>
        </div>
      `;
    }).join('');

    if (estabaAbajo || mensajes.length <= 2) {
      cont.scrollTop = cont.scrollHeight;
    }

    // Marcar como leídos en el backend
    try {
      await marcarLeidos(convId);
    } catch (err) {
      // Silencioso
    }
  }

  /* =========================================================
     ENVIAR MENSAJE
     ========================================================= */
  async function enviarMensajeDelPanel(convId) {
    const input = document.getElementById('chat-input-texto');
    if (!input) return;
    const texto = input.value.trim();
    if (!texto) return;

    // Limpiar input inmediatamente para UX
    input.value = '';
    input.focus();

    try {
      await enviarMensaje(convId, texto);
      // Refrescar chat
      await refrescarMensajes(convId);
      // Refrescar lista (para actualizar el preview)
      await recargarConversaciones();
      renderListaConversaciones();
    } catch (err) {
      console.error('[mensajes] Error al enviar:', err);
      toast(err.message || 'No se pudo enviar el mensaje', 'error');
    }
  }

  /* =========================================================
     MODAL: NUEVA CONVERSACIÓN
     ========================================================= */
  async function abrirModalNuevaConv() {
    const input = document.getElementById('buscar-usuario');
    if (input) input.value = '';

    // Cargar usuarios desde el backend
    await renderUsuariosModal('');

    abrirModal('modal-nueva-conv');
  }

  async function renderUsuariosModal(filtro) {
    const cont = document.getElementById('lista-usuarios');
    if (!cont) return;

    cont.innerHTML = `<p class="text-sm text-muted text-center" style="padding:var(--space-4)">Cargando...</p>`;

    // ⚡ Cargamos TODOS los grupos públicos para descubrir usuarios
    // (el backend no tiene endpoint de "listar usuarios")
    let usuariosDescubiertos = [];
    try {
      const { data: grupos } = await listarGrupos({ limit: 50 });

      // Extraer capitanes únicos de los grupos
      const mapaUsuarios = new Map();
      grupos.forEach(g => {
        if (g.capitan && g.capitan.id !== user.id) {
          mapaUsuarios.set(g.capitan.id, g.capitan);
        }
      });

      usuariosDescubiertos = Array.from(mapaUsuarios.values());
    } catch (err) {
      console.error('[mensajes] Error al cargar usuarios:', err);
    }

    if (usuariosDescubiertos.length === 0) {
      cont.innerHTML = `
        <p class="text-sm text-muted text-center" style="padding:var(--space-4)">
          No hay usuarios disponibles todavía
        </p>`;
      return;
    }

    const f = filtro.toLowerCase().trim();
    const filtrados = f
      ? usuariosDescubiertos.filter(u =>
          (u.nombre || '').toLowerCase().includes(f) ||
          (u.username || '').toLowerCase().includes(f)
        )
      : usuariosDescubiertos;

    if (filtrados.length === 0) {
      cont.innerHTML = `
        <p class="text-sm text-muted text-center" style="padding:var(--space-4)">
          Sin usuarios que coincidan con "${escapeHtml(filtro)}"
        </p>`;
      return;
    }

    cont.innerHTML = filtrados.map(u => `
      <div class="amigo-item" data-user="${u.id}" style="cursor:pointer">
        <img src="${avatarDe(u)}" class="avatar avatar--md" alt="" />
        <div class="amigo-item__info">
          <div class="amigo-item__name">${escapeHtml(u.nombre)}</div>
          <div class="amigo-item__sub">@${escapeHtml(u.username)}</div>
        </div>
        <button class="btn btn--primary btn--sm">💬 Mensaje</button>
      </div>
    `).join('');

    cont.querySelectorAll('[data-user]').forEach(el => {
      el.addEventListener('click', async () => {
        const otroId = el.dataset.user;
        try {
          const conv = await crearConversacion(otroId);
          cerrarModal('modal-nueva-conv');
          await recargarConversaciones();
          renderListaConversaciones();
          await abrirConversacion(conv.id);
        } catch (err) {
          console.error('[mensajes] Error al crear conversación:', err);
          toast(err.message || 'No se pudo crear la conversación', 'error');
        }
      });
    });
  }

  /* =========================================================
     CONECTAR EVENTOS GENERALES
     ========================================================= */
  document.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
    btn.addEventListener('click', () => cerrarModal(btn.dataset.cerrarModal));
  });

  document.getElementById('modal-nueva-conv')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-nueva-conv') cerrarModal('modal-nueva-conv');
  });

  document.getElementById('buscar-usuario')?.addEventListener('input', (e) => {
    renderUsuariosModal(e.target.value);
  });

  btnNuevaConv?.addEventListener('click', abrirModalNuevaConv);

  /* ---------- Búsqueda de conversaciones ---------- */
  buscarConv?.addEventListener('input', (e) => {
    filtroTexto = e.target.value;
    renderListaConversaciones();
  });

  /* =========================================================
     INIT
     ========================================================= */
  await recargarConversaciones();
  renderListaConversaciones();

  return () => {
    if (intervaloRefresco) clearInterval(intervaloRefresco);
  };
}