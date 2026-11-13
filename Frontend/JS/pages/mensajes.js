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
  vaciarConversacionParaMi,
  eliminarMensajeParaMi,
  eliminarMensajeParaTodos
} from '../services/mensajes.service.js';
import { listarGrupos } from '../services/grupos.service.js';
import { conectarAccionesMensaje } from '../utils/mensaje-acciones.js';

export async function init() {
  const user = getSesion();
  if (!user) return null;

  const listaConversaciones = document.getElementById('lista-conversaciones');
  const panelMensajes = document.getElementById('panel-mensajes');
  const buscarConv = document.getElementById('buscar-conversacion');
  const btnNuevaConv = document.getElementById('btn-nueva-conv');
  const layoutLista = document.querySelector('.chat-layout__list'); 

  if (!listaConversaciones) return null;

  /* ---------- ESTADO ---------- */
  let convActualId = null;
  let intervaloRefresco = null;
  let filtroTexto = '';
  let conversaciones = [];
  let menuAbiertoId = null;
  let ultimoHashMensajes = null;
  let ultimaConvRenderizada = null;
  let imagenBase64 = null; 

  /* =========================================================
     HELPERS
     ========================================================= */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
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

  function labelDia(iso) {
    const d = new Date(iso);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    const mismoDia = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (mismoDia(d, hoy))  return 'Hoy';
    if (mismoDia(d, ayer)) return 'Ayer';

    const difDias = Math.floor((hoy - d) / (1000 * 60 * 60 * 24));
    if (difDias < 7) {
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      return dias[d.getDay()];
    }

    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  }

  function volverALista() {
    panelMensajes.classList.remove('chat-layout__panel--abierto');
    layoutLista.classList.remove('chat-layout__list--oculto');
    convActualId = null;
  }

  function abrirModalVerImagen(src) {
    const img = document.getElementById('modal-imagen-img');
    const modal = document.getElementById('modal-ver-imagen');
    if (!img || !modal) return;

    img.src = src;
    abrirModal('modal-ver-imagen');

    modal.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-ver-imagen');
    });

    modal.onclick = (e) => {
      if (e.target.id === 'modal-ver-imagen') cerrarModal('modal-ver-imagen');
    };
  }

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
        <div class="empty-state" style="padding:var(--space-5) var(--space-3)">
          <div class="empty-state__icon" style="font-size:36px">💬</div>
          <p class="text-sm text-muted">No tienes conversaciones</p>
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

    listaConversaciones.innerHTML = filtradas.map(c => {
      const otro = c.otroUsuario || { nombre: 'Usuario', username: 'user', avatar: null };
      const ultimo = c.ultimoMensaje;
      const preview = ultimo
        ? (ultimo.autorId === user.id ? 'Tú: ' : '') + (ultimo.texto || (ultimo.imagen ? '📷 Imagen' : ''))
        : 'Sin mensajes aún';

      const vinculo = c.vinculadaNombre;

      return `
        <div class="conv-item ${c.id === convActualId ? 'conv-item--active' : ''}"
             data-conv="${c.id}">

          <img src="${avatarDe(otro)}" class="conv-item__avatar" alt="" />

          <div class="conv-item__info">
            <div class="conv-item__top">
              <div class="conv-item__name">${escapeHtml(otro.nombre)}</div>
              ${ultimo ? `<span class="conv-item__time">${horaCorta(ultimo.createdAt)}</span>` : ''}
            </div>
            <div class="conv-item__bottom">
              <div class="conv-item__preview">${escapeHtml(preview).slice(0, 60)}</div>
              ${c.noLeidos > 0 ? `<span class="conv-item__badge">${c.noLeidos}</span>` : ''}
            </div>
            ${vinculo ? `<div class="conv-item__vinculo">📎 ${escapeHtml(vinculo).slice(0, 30)}</div>` : ''}
          </div>

          <button class="conv-item__menu-btn" data-menu="${c.id}" title="Opciones">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <circle cx="5" cy="12" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
        </div>
      `;
    }).join('');

    listaConversaciones.querySelectorAll('.conv-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-menu]') || e.target.closest('[data-menu-item]')) return;
        abrirConversacion(el.dataset.conv);
      });
    });

    listaConversaciones.querySelectorAll('[data-menu]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        abrirMenuConv(btn.dataset.menu, btn);
      });
    });
  }

  /* =========================================================
     MENÚ DE OPCIONES (⋯) DE LA LISTA
     ========================================================= */
  function abrirMenuConv(convId, btn) {
    cerrarMenuConv();

    const menu = document.createElement('div');
    menu.className = 'conv-menu';
    menu.innerHTML = `
      <button class="conv-menu__item" data-menu-item="vaciar">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        Vaciar chat
      </button>
      <button class="conv-menu__item conv-menu__item--danger" data-menu-item="borrar">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        Borrar chat
      </button>
    `;

    document.body.appendChild(menu);
    menuAbiertoId = convId;

    const rect = btn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.left = `${rect.right - 160}px`;
    menu.style.zIndex = '1000';

    menu.querySelector('[data-menu-item="vaciar"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      cerrarMenuConv();
      await vaciarConversacion(convId);
    });

    menu.querySelector('[data-menu-item="borrar"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      cerrarMenuConv();
      await borrarConversacion(convId);
    });

    setTimeout(() => {
      document.addEventListener('click', cerrarMenuConv, { once: true });
    }, 10);
  }

  function cerrarMenuConv() {
    document.querySelectorAll('.conv-menu').forEach(m => m.remove());
    menuAbiertoId = null;
  }

  async function borrarConversacion(convId) {
    if (!confirm('¿Borrar este chat? Solo se borrará para ti.')) return;

    try {
      await ocultarConversacion(convId);

      if (convActualId === convId) {
        convActualId = null;
        volverALista();
        panelMensajes.innerHTML = `
          <div class="chat-empty">
            <div class="chat-empty__icon">
              <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h3 class="chat-empty__titulo">Tus mensajes</h3>
            <p class="chat-empty__text">Seleccioná una conversación de la lista o iniciá una nueva.</p>
          </div>`;
      }
      toast('Chat borrado', 'info');
      await recargarConversaciones();
      renderListaConversaciones();
    } catch (err) {
      console.error('[mensajes] Error al borrar:', err);
      toast(err.message || 'No se pudo borrar', 'error');
    }
  }

  async function vaciarConversacion(convId) {
    if (!confirm('¿Vaciar este chat? Los mensajes se van a ocultar SOLO para ti.')) return;

    try {
      await vaciarConversacionParaMi(convId);

      if (convActualId === convId) {
        await refrescarMensajes(convId);
      }
      toast('Chat vaciado', 'success');
      await recargarConversaciones();
      renderListaConversaciones();
    } catch (err) {
      console.error('[mensajes] Error al vaciar:', err);
      toast(err.message || 'No se pudo vaciar', 'error');
    }
  }

  /* =========================================================
     ABRIR CONVERSACIÓN
     ========================================================= */
  async function abrirConversacion(convId) {
    convActualId = convId;
    ultimoHashMensajes = null;
    ultimaConvRenderizada = null;
    imagenBase64 = null;

    layoutLista.classList.add('chat-layout__list--oculto');
    panelMensajes.classList.add('chat-layout__panel--abierto');

    if (intervaloRefresco) clearInterval(intervaloRefresco);

    try {
      await marcarLeidos(convId);
    } catch (err) {
      console.warn('[mensajes] No se pudo marcar como leídos:', err.message);
    }

    await recargarConversaciones();
    renderListaConversaciones();

    await renderPanelChat(convId);

    intervaloRefresco = setInterval(async () => {
      if (convActualId === convId) {
        await refrescarMensajes(convId);
      }
    }, 3000);
  }

  /* =========================================================
     PANEL DE CHAT (1 a 1)
     ========================================================= */
  async function renderPanelChat(convId) {
    let conv;
    try {
      conv = await obtenerConversacion(convId);
    } catch (err) {
      console.error('[mensajes] Error al obtener conversación:', err);
      panelMensajes.innerHTML = `
        <div class="chat-empty">
          <div class="chat-empty__icon">
            <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p class="chat-empty__text">No se pudo cargar la conversación</p>
        </div>`;
      return;
    }

    const otro = conv.otroUsuario || { nombre: 'Usuario', username: 'user', avatar: null };
    const vinculo = conv.vinculadaNombre;

    panelMensajes.innerHTML = `
      <div class="chat-header">
        <button class="chat-back-btn" id="btn-volver-chat">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>

        <img src="${avatarDe(otro)}" class="chat-header__avatar" alt="" data-ver-perfil="${otro.id}" style="cursor:pointer" />
        <div class="chat-header__info" data-ver-perfil="${otro.id}" style="cursor:pointer">
          <div class="chat-header__name">${escapeHtml(otro.nombre)}</div>
          <div class="chat-header__sub">@${escapeHtml(otro.username || 'usuario')}</div>
        </div>
      </div>

      ${vinculo ? `
        <div class="chat-vinculo">
          <div class="chat-vinculo__icon">📎</div>
          <div class="chat-vinculo__texto">
            <div class="chat-vinculo__eyebrow">Conversación sobre</div>
            <div class="chat-vinculo__titulo">${escapeHtml(vinculo)}</div>
          </div>
        </div>
      ` : ''}

      <div class="chat-mensajes" id="chat-mensajes"></div>

      <div class="chat-input-preview hidden" id="chat-input-preview">
        <div class="chat-input-preview__img-wrapper">
          <img id="chat-input-preview-img" src="" alt="" />
          <button type="button" class="chat-input-preview__del" id="chat-input-preview-del" title="Quitar">✕</button>
        </div>
      </div>

      <form class="chat-input" id="chat-form">
        <label class="chat-input__attach" title="Adjuntar imagen">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
          <input type="file" id="chat-input-file" accept="image/*" style="display:none" />
        </label>

        <input type="text" id="chat-input-texto" placeholder="Escribe un mensaje..." maxlength="2000" autocomplete="off" />

        <button type="submit" class="chat-input__btn" title="Enviar">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    `;

    document.getElementById('btn-volver-chat')?.addEventListener('click', volverALista);

    panelMensajes.querySelectorAll('[data-ver-perfil]').forEach(el => {
      el.addEventListener('click', () => {
        import('../components.js').then(({ verPerfilUsuario }) => {
          verPerfilUsuario(el.dataset.verPerfil);
        });
      });
    });

    document.getElementById('chat-input-file')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) { toast('La imagen es muy grande (máx 3MB)', 'error'); e.target.value = ''; return; }
      const reader = new FileReader();
      reader.onload = (ev) => { imagenBase64 = ev.target.result; mostrarPreviewImagen(imagenBase64); };
      reader.readAsDataURL(file);
      e.target.value = '';
    });

    document.getElementById('chat-input-preview-del')?.addEventListener('click', () => {
      imagenBase64 = null; ocultarPreviewImagen();
    });

    document.getElementById('chat-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await enviarMensajeDelPanel(convId);
    });

    await refrescarMensajes(convId);
  }

  /* =========================================================
     PREVIEW DE IMAGEN (arriba del input)
     ========================================================= */
  function mostrarPreviewImagen(src) {
    const wrapper = document.getElementById('chat-input-preview');
    const img = document.getElementById('chat-input-preview-img');
    if (!wrapper || !img) return;
    img.src = src;
    wrapper.classList.remove('hidden');
  }

  function ocultarPreviewImagen() {
    const wrapper = document.getElementById('chat-input-preview');
    const img = document.getElementById('chat-input-preview-img');
    if (!wrapper || !img) return;
    img.src = '';
    wrapper.classList.add('hidden');
  }

  /* =========================================================
     REFRESCAR MENSAJES (1 a 1)
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

    const hash = mensajes.map(m => `${m.id}:${m.texto || ''}:${m.imagen ? 'img' : ''}:${m.createdAt}`).join('|');
    const cambioDeConv = ultimaConvRenderizada !== convId;

    if (!cambioDeConv && hash === ultimoHashMensajes) return;

    ultimoHashMensajes = hash;
    ultimaConvRenderizada = convId;

    if (mensajes.length === 0) {
      cont.innerHTML = `<div class="chat-mensajes__empty"><p>Aún no hay mensajes.</p><p class="text-xs" style="margin-top:4px">¡Saluda para empezar!</p></div>`;
      return;
    }

    const estabaAbajo = cont.scrollHeight - cont.scrollTop - cont.clientHeight < 50;

    let html = '';
    let diaAnterior = null;

    mensajes.forEach((m, idx) => {
      const fecha = new Date(m.createdAt);
      const dia = fecha.toDateString();
      if (dia !== diaAnterior) { html += `<div class="chat-dia">${labelDia(m.createdAt)}</div>`; diaAnterior = dia; }

      const esMio = String(m.autorId) === String(user.id);
      const esUltimoMio = esMio && idx === mensajes.length - 1;
      let leidoHtml = '';
      if (esUltimoMio && m.leidoPorOtro === true) leidoHtml = `<span class="msg__leido">Leído</span>`;

      const tieneTexto = !!m.texto;
      const tieneImagen = !!m.imagen;
      const soloImagen = tieneImagen && !tieneTexto;

      html += `
        <div class="msg ${esMio ? 'msg--yo' : ''} ${m.eliminadoParaTodos ? 'msg--eliminado' : ''}" data-msg-id="${m.id}" data-msg-autor-id="${m.autorId}">
          ${!m.eliminadoParaTodos ? `
          <button class="msg-menu-btn" type="button" data-msg-menu-btn title="Opciones">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1"/>
              <circle cx="12" cy="5" r="1"/>
              <circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
          ` : ''}
          ${!esMio ? `<img src="${avatarDe(m.autor)}" class="msg__avatar" alt="" />` : ''}
          <div class="msg__burbuja ${soloImagen ? 'msg__burbuja--solo-imagen' : ''}">
            ${m.eliminadoParaTodos ? `<div class="msg__eliminado"><img src="assets/icons/prohibido.png" alt="" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;display:inline-block;margin-right:4px;" /> Mensaje eliminado</div>` : (tieneTexto ? `<div class="msg__texto">${escapeHtml(m.texto)}</div>` : '')}
            ${tieneImagen && !m.eliminadoParaTodos ? `<div class="msg__imagen-wrapper" data-ver-imagen="${idx}"><img src="${m.imagen}" alt="" loading="lazy" /></div>` : ''}
            <div class="msg__meta">
              <span class="msg__hora">${horaCorta(m.createdAt)}</span>
              ${esUltimoMio ? leidoHtml : ''}
            </div>
          </div>
        </div>
      `;
    });

    cont.innerHTML = html;

    cont.querySelectorAll('[data-ver-imagen]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.verImagen);
        const m = mensajes[idx];
        if (m?.imagen) abrirModalVerImagen(m.imagen);
      });
    });

    conectarAccionesMensaje(cont, {
      usuarioId: user.id,
      obtenerMensajePorId: (id) => mensajes.find(m => String(m.id) === String(id)),
      onCopiar: (texto) => navigator.clipboard.writeText(texto),
      onEliminarParaMi: (id) => eliminarMensajeParaMi(id),
      onEliminarParaTodos: (id) => eliminarMensajeParaTodos(id),
      onRefrescar: () => refrescarMensajes(convId),
    });

    if (estabaAbajo || mensajes.length <= 2) cont.scrollTop = cont.scrollHeight;
    try { await marcarLeidos(convId); } catch (err) {}
  }

  /* =========================================================
     ENVIAR MENSAJE
     ========================================================= */
  async function enviarMensajeDelPanel(convId) {
    const input = document.getElementById('chat-input-texto');
    if (!input) return;
    const texto = input.value.trim();
    const imagen = imagenBase64;
    if (!texto && !imagen) return;

    input.value = '';
    imagenBase64 = null;
    ocultarPreviewImagen();
    input.focus();

    try {
      await enviarMensaje(convId, texto || null, imagen || null);
      await refrescarMensajes(convId);
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
    await renderUsuariosModal('');
    abrirModal('modal-nueva-conv');
  }

  async function renderUsuariosModal(filtro) {
    const cont = document.getElementById('lista-usuarios');
    if (!cont) return;

    cont.innerHTML = `<p class="text-sm text-muted text-center" style="padding:var(--space-4)">Cargando...</p>`;

    let usuariosDescubiertos = [];
    try {
      const { data: grupos } = await listarGrupos({ limit: 50 });
      const mapaUsuarios = new Map();
      grupos.forEach(g => { if (g.capitan && g.capitan.id !== user.id) mapaUsuarios.set(g.capitan.id, g.capitan); });
      usuariosDescubiertos = Array.from(mapaUsuarios.values());
    } catch (err) {}

    if (usuariosDescubiertos.length === 0) {
      cont.innerHTML = `<p class="text-sm text-muted text-center" style="padding:var(--space-4)">No hay usuarios disponibles todavía</p>`;
      return;
    }

    const f = filtro.toLowerCase().trim();
    const filtrados = f ? usuariosDescubiertos.filter(u => (u.nombre || '').toLowerCase().includes(f) || (u.username || '').toLowerCase().includes(f)) : usuariosDescubiertos;

    if (filtrados.length === 0) {
      cont.innerHTML = `<p class="text-sm text-muted text-center" style="padding:var(--space-4)">Sin usuarios que coincidan con "${escapeHtml(filtro)}"</p>`;
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
        try {
          const conv = await crearConversacion(el.dataset.user);
          cerrarModal('modal-nueva-conv');
          await recargarConversaciones();
          renderListaConversaciones();
          await abrirConversacion(conv.id);
        } catch (err) {
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
    cerrarMenuConv();
  };
}