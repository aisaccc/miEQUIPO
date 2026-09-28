import { getSesion } from '../auth.js';
import { toast, abrirModal, cerrarModal } from '../components.js';
import { mockUsuarios } from '../data-mock.js';
import {
  conversacionesDe,
  obtenerOCrearConversacion,
  getMensajesPrivados,
  agregarMensajePrivado,
  marcarMensajesLeidos,
  contarNoLeidos,
  idConversacion,
  chatsGrupoDe,
  contarNoLeidosGrupo,
  marcarLeidoGrupo,
  getMensajesDeCanal,
  agregarMensaje,
  ocultarConversacion,
  ocultarCanal,
  estaOculto,
  mostrarConversacion
} from '../store.js';

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

  /* ---------- MAPA DE USUARIOS ---------- */
  const usuariosBase = [...mockUsuarios];

  function buscarUsuarioPorId(id) {
    return usuariosBase.find(u => u.id === Number(id)) || {
      id: Number(id),
      nombre: 'Usuario #' + id,
      username: 'user' + id,
      avatar: `https://i.pravatar.cc/100?u=${id}`
    };
  }

  /* =========================================================
     RENDER: LISTA DE CONVERSACIONES
     ========================================================= */
  function renderListaConversaciones() {
    const convs = conversacionesDe(user.id).filter(c => !estaOculto(user.id, c.id));
    const grupos = chatsGrupoDe(user.id).filter(g => !estaOculto(user.id, g.id));

    if (convs.length === 0 && grupos.length === 0) {
      listaConversaciones.innerHTML = `
        <div class="empty-state" style="padding:var(--space-5)">
          <div class="empty-state__icon" style="font-size:36px">💬</div>
          <p class="text-sm text-muted">No tienes conversaciones</p>
          <button class="btn btn--primary btn--sm mt-4" id="btn-empezar-conv">
            Iniciar una conversación
          </button>
        </div>`;
      document.getElementById('btn-empezar-conv')?.addEventListener('click', abrirModalNuevaConv);
      return;
    }

    // Filtrar privadas por texto
    const privadasFiltradas = filtroTexto
      ? convs.filter(c => {
          const otro = c.participantes.find(p => p !== user.id);
          const u = buscarUsuarioPorId(otro);
          const t = filtroTexto.toLowerCase();
          return u.nombre.toLowerCase().includes(t) || u.username.toLowerCase().includes(t);
        })
      : convs;

    // Filtrar grupos por texto
    const gruposFiltrados = filtroTexto
      ? grupos.filter(g => g.nombre.toLowerCase().includes(filtroTexto.toLowerCase()))
      : grupos;

    let html = '';

    /* ---------- Chats de grupo ---------- */
    if (gruposFiltrados.length > 0) {
      html += `
        <div class="text-xs text-muted" style="padding:var(--space-2) var(--space-3); font-weight:700; text-transform:uppercase; letter-spacing:0.05em">
          📢 Grupos y torneos
        </div>
      `;
      html += gruposFiltrados.map(g => {
        const msgs = getMensajesDeCanal(g.id);
        const ultimo = msgs[msgs.length - 1];
        const preview = ultimo
          ? (ultimo.autorNombre ? ultimo.autorNombre + ': ' : '') + ultimo.texto
          : 'Sin mensajes aún';

        const noLeidos = contarNoLeidosGrupo(g.id, user.id);

        return `
          <div class="conversation ${g.id === convActualId ? 'active' : ''}" data-conv="${g.id}" data-tipo="grupo" style="position:relative">
            <div class="avatar avatar--md"
                 style="background:var(--color-primary-light); display:grid; place-items:center; font-size:20px">
              ${g.icono || '📢'}
            </div>
            <div class="conversation__info">
              <div class="conversation__name">${g.nombre}</div>
              <div class="conversation__preview">${escapeHtml(preview).slice(0, 60)}</div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px">
              ${ultimo ? `<span class="text-xs text-muted">${horaCorta(ultimo.fecha)}</span>` : ''}
              ${noLeidos > 0 ? `<span class="badge badge--primary">${noLeidos}</span>` : ''}
            </div>
            <button class="conversation__delete" data-borrar-canal="${g.id}" title="Silenciar chat" style="position:absolute; top:6px; right:6px; width:24px; height:24px; border-radius:50%; background:rgba(0,0,0,0.5); color:white; display:none; align-items:center; justify-content:center; font-size:12px; cursor:pointer; border:none">🗑️</button>
          </div>
        `;
      }).join('');
    }

    /* ---------- Chats privados ---------- */
    if (privadasFiltradas.length > 0) {
      html += `
        <div class="text-xs text-muted" style="padding:var(--space-3) var(--space-3) var(--space-2); font-weight:700; text-transform:uppercase; letter-spacing:0.05em">
          👤 Conversaciones
        </div>
      `;
      html += privadasFiltradas.map(c => {
        const otroId = c.participantes.find(p => p !== user.id);
        const otro = buscarUsuarioPorId(otroId);
        const msgs = getMensajesPrivados(c.id);
        const ultimo = msgs[msgs.length - 1];
        const preview = ultimo
          ? (ultimo.autorId === user.id ? 'Tú: ' : '') + ultimo.texto
          : 'Sin mensajes aún';
        const noLeidos = contarNoLeidos(c.id, user.id);

        const vinculo = c.vinculadaA;

        return `
          <div class="conversation ${c.id === convActualId ? 'active' : ''}" data-conv="${c.id}" data-tipo="privado" style="position:relative">
            <img src="${otro.avatar}" class="avatar avatar--md" alt="" />
            <div class="conversation__info">
              <div class="conversation__name">
                ${otro.nombre}
                ${vinculo ? `<span class="badge badge--warning" style="margin-left:6px; font-size:9px">📎 ${vinculo.nombre.slice(0, 20)}</span>` : ''}
              </div>
              <div class="conversation__preview">${escapeHtml(preview).slice(0, 60)}</div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px">
              ${ultimo ? `<span class="text-xs text-muted">${horaCorta(ultimo.fecha)}</span>` : ''}
              ${noLeidos > 0 ? `<span class="badge badge--primary">${noLeidos}</span>` : ''}
            </div>
            <button class="conversation__delete" data-borrar-conv="${c.id}" title="Borrar chat" style="position:absolute; top:6px; right:6px; width:24px; height:24px; border-radius:50%; background:rgba(0,0,0,0.5); color:white; display:none; align-items:center; justify-content:center; font-size:12px; cursor:pointer; border:none">🗑️</button>
          </div>
        `;
      }).join('');
    }

    if (privadasFiltradas.length === 0 && gruposFiltrados.length === 0 && filtroTexto) {
      listaConversaciones.innerHTML = `
        <p class="text-sm text-muted text-center" style="padding:var(--space-4)">
          Sin resultados
        </p>`;
      return;
    }

    listaConversaciones.innerHTML = html;
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

    // Borrar conversación privada
    listaConversaciones.querySelectorAll('[data-borrar-conv]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const convId = btn.dataset.borrarConv;
        if (!confirm('¿Borrar este chat? Solo se borrará para ti.')) return;

        ocultarConversacion(user.id, convId);
        if (convActualId === convId) {
          convActualId = null;
          panelMensajes.innerHTML = `
            <div class="chat-empty">
              <div style="font-size:48px">💬</div>
              <p class="text-muted mt-4">Selecciona una conversación</p>
            </div>`;
        }
        toast('Chat borrado', 'info');
        renderListaConversaciones();
      });
    });

    // Silenciar canal de grupo
    listaConversaciones.querySelectorAll('[data-borrar-canal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const canalId = btn.dataset.borrarCanal;
        if (!confirm('¿Silenciar este chat de grupo? Solo se silenciará para ti.')) return;

        ocultarCanal(user.id, canalId);
        if (convActualId === canalId) {
          convActualId = null;
          panelMensajes.innerHTML = `
            <div class="chat-empty">
              <div style="font-size:48px">💬</div>
              <p class="text-muted mt-4">Selecciona una conversación</p>
            </div>`;
        }
        toast('Chat silenciado', 'info');
        renderListaConversaciones();
      });
    });

    // Conectar clicks
    listaConversaciones.querySelectorAll('.conversation').forEach(el => {
      el.addEventListener('click', () => {
        const tipo = el.dataset.tipo;
        if (tipo === 'grupo') {
          abrirConversacionGrupo(el.dataset.conv);
        } else {
          abrirConversacion(el.dataset.conv);
        }
      });
    });
  }

  /* =========================================================
     ABRIR CONVERSACIÓN PRIVADA
     ========================================================= */
  function abrirConversacion(convId) {
    convActualId = chatId;
    mostrarConversacion(user.id, chatId);
    // Si estaba oculto, mostrarlo de nuevo
    mostrarConversacion(user.id, convId);

    convActualId = convId;
    if (intervaloRefresco) clearInterval(intervaloRefresco);

    marcarMensajesLeidos(convId, user.id);
    renderListaConversaciones();
    renderPanelChat(convId);

    intervaloRefresco = setInterval(() => {
      if (convActualId === convId) renderPanelChat(convId, true);
    }, 3000);
  }

  function renderPanelChat(convId, soloMensajes = false) {
    const convs = conversacionesDe(user.id);
    const conv = convs.find(c => c.id === convId);
    if (!conv) return;

    const otroId = conv.participantes.find(p => p !== user.id);
    const otro = buscarUsuarioPorId(otroId);

    if (!soloMensajes) {
      const vinculo = conv.vinculadaA;

      panelMensajes.innerHTML = `
        ${vinculo ? `
          <div style="padding:8px 16px; background:var(--color-primary-light); border-bottom:1px solid var(--color-border); font-size:12px; font-weight:600; color:var(--color-primary-dark); display:flex; align-items:center; gap:6px">
            📎 Hablando sobre: "${vinculo.nombre}"
          </div>
        ` : ''}

        <div class="chat-header">
          <img src="${otro.avatar}" class="avatar avatar--md" alt="" />
          <div class="chat-header__info">
            <div class="chat-header__name">${otro.nombre}</div>
            <div class="chat-header__sub">@${otro.username}</div>
          </div>
        </div>

        <div class="chat-mensajes" id="chat-mensajes"></div>

        <form class="chat-input" id="chat-form">
          <input
            type="text"
            id="chat-input-texto"
            placeholder="Escribe un mensaje..."
            maxlength="500"
            autocomplete="off"
          />
          <button type="submit" class="chat-input__btn">➤</button>
        </form>
      `;

      const form = document.getElementById('chat-form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        enviarMensaje(convId);
      });
    }

    refrescarMensajes(convId);
  }

  function refrescarMensajes(convId) {
    const cont = document.getElementById('chat-mensajes');
    if (!cont) return;

    const msgs = getMensajesPrivados(convId);

    if (msgs.length === 0) {
      cont.innerHTML = `
        <div class="chat-mensajes__empty">
          <div class="chat-mensajes__empty-icon">💬</div>
          <p>Aún no hay mensajes.</p>
          <p class="text-xs" style="margin-top:4px">¡Saluda para empezar!</p>
        </div>`;
      return;
    }

    const estabaAbajo = cont.scrollHeight - cont.scrollTop - cont.clientHeight < 50;

    cont.innerHTML = msgs.map(m => renderMensaje(m)).join('');

    if (estabaAbajo || msgs.length <= 2) {
      cont.scrollTop = cont.scrollHeight;
    }

    marcarMensajesLeidos(convId, user.id);
  }

  function renderMensaje(m) {
    const esMio = m.autorId === user.id;
    return `
      <div class="msg ${esMio ? 'msg--yo' : ''}">
        ${!esMio ? `<img src="${m.avatar}" class="msg__avatar" alt="" />` : ''}
        <div class="msg__burbuja">
          <div class="msg__texto">${escapeHtml(m.texto)}</div>
          <div class="msg__hora">${horaCorta(m.fecha)}</div>
        </div>
      </div>
    `;
  }

  function enviarMensaje(convId) {
    const input = document.getElementById('chat-input-texto');
    if (!input) return;
    const texto = input.value.trim();
    if (!texto) return;

    agregarMensajePrivado(convId, {
      id: Date.now(),
      autorId: user.id,
      texto,
      avatar: user.avatar,
      fecha: new Date().toISOString(),
      leido: false
    });

    input.value = '';
    input.focus();
    refrescarMensajes(convId);
    renderListaConversaciones();
  }

  /* =========================================================
     ABRIR CONVERSACIÓN DE GRUPO
     ========================================================= */
  function abrirConversacionGrupo(chatId) {
    convActualId = chatId;
    if (intervaloRefresco) clearInterval(intervaloRefresco);

    marcarLeidoGrupo(chatId, user.id);
    renderListaConversaciones();

    const grupos = chatsGrupoDe(user.id);
    const grupo = grupos.find(g => g.id === chatId);
    if (!grupo) return;

    panelMensajes.innerHTML = `
      <div class="chat-header">
        <div class="chat-header__icon">${grupo.icono || '📢'}</div>
        <div class="chat-header__info">
          <div class="chat-header__name">${grupo.nombre}</div>
          <div class="chat-header__sub">
            ${grupo.participantes.length} miembros · 
            ${grupo.adminId === user.id ? '👑 Eres el organizador' : 'Grupo'}
          </div>
        </div>
      </div>

      <div class="chat-mensajes" id="chat-mensajes"></div>

      <form class="chat-input" id="chat-form">
        <input type="text" id="chat-input-texto" placeholder="Escribe un mensaje..." maxlength="500" autocomplete="off" />
        <button type="submit" class="chat-input__btn">➤</button>
      </form>
    `;

    document.getElementById('chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      enviarMensajeGrupo(chatId);
    });

    refrescarMensajesGrupo(chatId);
    intervaloRefresco = setInterval(() => {
      if (convActualId === chatId) refrescarMensajesGrupo(chatId);
    }, 3000);
  }

  function refrescarMensajesGrupo(chatId) {
    const cont = document.getElementById('chat-mensajes');
    if (!cont) return;

    const msgs = getMensajesDeCanal(chatId);

    if (msgs.length === 0) {
      cont.innerHTML = `
        <div class="chat-mensajes__empty">
          <div class="chat-mensajes__empty-icon">💬</div>
          <p>Aún no hay mensajes.</p>
          <p class="text-xs" style="margin-top:4px">¡Sé el primero en escribir!</p>
        </div>`;
      return;
    }

    const estabaAbajo = cont.scrollHeight - cont.scrollTop - cont.clientHeight < 50;

    cont.innerHTML = msgs.map(m => {
      const esMio = m.autorId === user.id;
      return `
        <div class="msg ${esMio ? 'msg--yo' : ''}">
          ${!esMio ? `<img src="${m.avatar}" class="msg__avatar" alt="" />` : ''}
          <div class="msg__burbuja">
            ${!esMio ? `<div class="msg__autor">${m.autorNombre}</div>` : ''}
            <div class="msg__texto">${escapeHtml(m.texto)}</div>
            <div class="msg__hora">${horaCorta(m.fecha)}</div>
          </div>
        </div>
      `;
    }).join('');

    if (estabaAbajo || msgs.length <= 2) {
      cont.scrollTop = cont.scrollHeight;
    }

    marcarLeidoGrupo(chatId, user.id);
  }

  function enviarMensajeGrupo(chatId) {
    const input = document.getElementById('chat-input-texto');
    if (!input) return;
    const texto = input.value.trim();
    if (!texto) return;

    agregarMensaje(chatId, {
      id: Date.now(),
      autorId: user.id,
      autorNombre: user.nombre,
      avatar: user.avatar,
      texto,
      fecha: new Date().toISOString(),
      leidoPor: [user.id]
    });

    input.value = '';
    input.focus();
    refrescarMensajesGrupo(chatId);
    renderListaConversaciones();
  }

  /* =========================================================
     MODAL: NUEVA CONVERSACIÓN
     ========================================================= */
  function abrirModalNuevaConv() {
    const input = document.getElementById('buscar-usuario');
    if (input) input.value = '';
    renderUsuariosModal('');
    abrirModal('modal-nueva-conv');
  }

  function renderUsuariosModal(filtro) {
    const cont = document.getElementById('lista-usuarios');
    if (!cont) return;

    const f = filtro.toLowerCase().trim();
    const todos = usuariosBase.filter(u => u.id !== user.id);

    const filtrados = f
      ? todos.filter(u =>
          u.nombre.toLowerCase().includes(f) ||
          u.username.toLowerCase().includes(f))
      : todos;

    if (filtrados.length === 0) {
      cont.innerHTML = `
        <p class="text-sm text-muted text-center" style="padding:var(--space-4)">
          Sin usuarios
        </p>`;
      return;
    }

    cont.innerHTML = filtrados.map(u => `
      <div class="amigo-item" data-user="${u.id}" style="cursor:pointer">
        <img src="${u.avatar}" class="avatar avatar--md" alt="" />
        <div class="amigo-item__info">
          <div class="amigo-item__name">${u.nombre}</div>
          <div class="amigo-item__sub">@${u.username}</div>
        </div>
        <button class="btn btn--primary btn--sm">💬 Mensaje</button>
      </div>
    `).join('');

    cont.querySelectorAll('[data-user]').forEach(el => {
      el.addEventListener('click', () => {
        const otroId = Number(el.dataset.user);
        const conv = obtenerOCrearConversacion(user.id, otroId);
        cerrarModal('modal-nueva-conv');
        renderListaConversaciones();
        abrirConversacion(conv.id);
      });
    });
  }

  /* ---------- Conectar modal ---------- */
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
     HELPERS
     ========================================================= */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function horaCorta(iso) {
    const d = new Date(iso);
    const hoy = new Date();
    const mismoDia = d.toDateString() === hoy.toDateString();

    if (mismoDia) {
      return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  }

  /* =========================================================
     INIT
     ========================================================= */
  renderListaConversaciones();

  return () => {
    if (intervaloRefresco) clearInterval(intervaloRefresco);
  };
}