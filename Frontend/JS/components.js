/* =========================================================
   components.js — Header, menú, toasts, notifs, config (v2)
   =========================================================
   Cambios v2:
   - Polling con setTimeout recursivo + jitter (no setInterval)
   - Guards isFetching* para evitar solapamiento
   - Pausa polling si document.hidden
   - Recarga al volver a la pestaña (visibilitychange)
   - Intervalos más largos (30s amigos/notifs, 20s mensajes)
   - Flags para no re-inicializar
*/

import { getSesion, cerrarSesion } from './auth.js';
import { ICONOS } from './utils/iconos.js';
import { contarNoLeidos } from './services/mensajes.service.js';
import { obtenerPerfilPublico } from './services/usuarios.service.js';
import {
  listarPublicacionesDe,
  toggleLike,
  listarComentarios,
  crearComentario,
} from './services/publicaciones.service.js';
import {
  listarNotificaciones,
  contarNoLeidas as contarNoLeidasAPI,
  marcarLeida as marcarLeidaAPI,
  marcarTodasLeidas as marcarTodasLeidasAPI,
  eliminarNotificacion as eliminarNotificacionAPI,
} from './services/notificaciones.service.js';
import {
  listarAmigos as listarAmigosAPI,
  listarSolicitudes as listarSolicitudesAPI,
  enviarSolicitud as enviarSolicitudAPI,
  responderSolicitud as responderSolicitudAPI,
  obtenerEstado as obtenerEstadoAPI,
  eliminarAmistad as eliminarAmistadAPI,
  bloquearUsuario as bloquearUsuarioAPI,
  desbloquearUsuario as desbloquearUsuarioAPI
} from './services/amistades.service.js';

import { renderFeedPublicaciones } from './utils/publicaciones-ui.js';

/* ---------- CONSTANTES DE POLLING ---------- */
const POLL_AMIGOS_MS   = 30000;
const POLL_NOTIFS_MS   = 30000;
const POLL_MENSAJES_MS = 20000;
const JITTER_MS        = 10000;

/* ---------- TEMA ---------- */
const ICONO_SOL = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const ICONO_LUNA = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

const HERO_COLORS = [
  { key: 'navy',    from: '#0F1B2D', to: '#1E2D45', text: 'light' },
  { key: 'black',   from: '#0A0A0A', to: '#1F1F1F', text: 'light' },
  { key: 'carbon',  from: '#1F2937', to: '#374151', text: 'light' },
  { key: 'blue',    from: '#1E3A8A', to: '#2563EB', text: 'light' },
  { key: 'forest',  from: '#064E3B', to: '#047857', text: 'light' },
  { key: 'purple',  from: '#4C1D95', to: '#7C3AED', text: 'light' },
  { key: 'wine',    from: '#7F1D1D', to: '#B91C1C', text: 'light' },
  { key: 'coffee',  from: '#451A03', to: '#78350F', text: 'light' },
  { key: 'mustard', from: '#92400E', to: '#CA8A04', text: 'light' },
  { key: 'red',     from: '#DC2626', to: '#EF4444', text: 'light' },
  { key: 'orange',  from: '#EA580C', to: '#FB923C', text: 'light' },
  { key: 'white',   from: '#FFFFFF', to: '#F5F5F5', text: 'dark'  },
];

export function initTheme() {
  const savedTheme = localStorage.getItem('miEquipoTheme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  actualizarBotonTema(savedTheme);

  document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('miEquipoTheme', next);
    actualizarBotonTema(next);
  });
}

function actualizarBotonTema(theme) {
  const iconCont = document.getElementById('theme-icon-container');
  const label = document.getElementById('theme-label');
  if (!iconCont || !label) return;
  if (theme === 'dark') {
    iconCont.innerHTML = ICONO_SOL;
    label.textContent = 'Modo claro';
  } else {
    iconCont.innerHTML = ICONO_LUNA;
    label.textContent = 'Modo oscuro';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/* ---------- HEADER ---------- */
export function initHeader() {
  const user = getSesion();
  if (!user) return;

  const avatar = document.getElementById('avatar-header');
  if (avatar) avatar.src = user.avatar || 'assets/icons/usuario.svg';

  const trigger = document.getElementById('user-trigger');
  const menu = document.getElementById('user-menu');

  if (trigger && menu) {
    menu.querySelector('.user-menu__name').textContent = user.nombre;
    menu.querySelector('.user-menu__email').textContent = user.email;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) menu.classList.remove('open');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') menu.classList.remove('open');
    });

    menu.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const accion = btn.dataset.action;
        
        if (accion === 'logout') {
          // ⚡ FIX: Si el usuario toca "Cancelar", el return corta la ejecución y no cierra sesión
          if (!confirm('¿Cerrar sesión?')) return; 
          
          cerrarSesion();
          window.location.href = 'index.html';
        } else if (accion === 'perfil') {
          window.location.hash = '#/perfil';
          menu.classList.remove('open');
        } else if (accion === 'config') {
          abrirModal('modal-configuracion');
          menu.classList.remove('open');
        }
      });
    });
  }
}

/* ---------- TOASTS ---------- */
export function toast(mensaje, tipo = 'info') {
  let contenedor = document.querySelector('.toast-container');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.className = 'toast-container';
    document.body.appendChild(contenedor);
  }
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.textContent = mensaje;
  contenedor.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(40px)';
    el.style.transition = 'all 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

/* ---------- MODALES ---------- */
export function abrirModal(id) { document.getElementById(id)?.classList.add('open'); }
export function cerrarModal(id) { document.getElementById(id)?.classList.remove('open'); }

/* ---------- HELPERS ---------- */
export function formatearFecha(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit'
  });
}

/* =========================================================
   DROPDOWNS & AMIGOS
   ========================================================= */
let dropdownsIniciados = false;
let isFetchingAmigos = false;
let amigosTimerId = null;

export function initDropdowns() {
  if (dropdownsIniciados) return;
  dropdownsIniciados = true;

  const dropdowns = document.querySelectorAll('.dropdown');

  dropdowns.forEach(dd => {
    const trigger = dd.querySelector('.dropdown__trigger');
    const panel = dd.querySelector('.dropdown__panel');
    if (!trigger || !panel) return;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdowns.forEach(other => { if (other !== dd) other.classList.remove('open'); });
      dd.classList.toggle('open');
    });

    panel.addEventListener('click', (e) => e.stopPropagation());
  });

  document.addEventListener('click', () => {
    dropdowns.forEach(dd => dd.classList.remove('open'));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dropdowns.forEach(dd => dd.classList.remove('open'));
  });

  const tabsAmigos = document.querySelectorAll('[data-tab-amigos]');
  tabsAmigos.forEach(tab => {
    tab.addEventListener('click', () => {
      tabsAmigos.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.dropdown__pane[id^="pane-"]').forEach(p => p.classList.remove('active'));
      document.getElementById('pane-' + tab.dataset.tabAmigos)?.classList.add('active');
    });
  });

  // Primera carga (inmediata, main.js ya la retrasó 400ms)
  cargarAmigosHeader();

  // ⚡ Polling recursivo con jitter
  const loop = async () => {
    if (!document.hidden) {
      await cargarAmigosHeader(true);
    }
    amigosTimerId = setTimeout(loop, POLL_AMIGOS_MS + Math.random() * JITTER_MS);
  };
  amigosTimerId = setTimeout(loop, POLL_AMIGOS_MS);

  // ⚡ Al volver a la pestaña, recargar
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) cargarAmigosHeader(true);
  });
}

async function cargarAmigosHeader(desdePolling = false) {
  if (desdePolling && isFetchingAmigos) return;
  isFetchingAmigos = true;

  const user = getSesion();
  if (!user) { isFetchingAmigos = false; return; }

  try {
    const [amigos, solicitudes] = await Promise.all([
      listarAmigosAPI(),
      listarSolicitudesAPI()
    ]);

    const badgeMain = document.getElementById('badge-amigos');
    const countSol = document.getElementById('count-amigos-sol');
    const countList = document.getElementById('count-amigos-lista');

    if (badgeMain) {
      badgeMain.textContent = solicitudes.length;
      badgeMain.classList.toggle('hidden', solicitudes.length === 0);
    }
    if (countSol) countSol.textContent = solicitudes.length;
    if (countList) countList.textContent = amigos.length;

    const paneSol = document.getElementById('pane-solicitudes');
    if (paneSol) {
      if (solicitudes.length === 0) {
        paneSol.innerHTML = `<p class="text-sm text-muted text-center" style="padding:20px">No hay solicitudes pendientes.</p>`;
      } else {
        paneSol.innerHTML = solicitudes.map(s => `
          <div class="amigo-item">
            <img src="${s.avatar || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--md" />
            <div class="amigo-item__info">
              <div class="amigo-item__name">${escapeHtml(s.nombre)}</div>
              <div class="amigo-item__sub">@${escapeHtml(s.username)}</div>
            </div>
            <div class="amigo-item__actions">
              <button class="btn btn--primary btn--sm" data-aceptar="${s.id}">Aceptar</button>
              <button class="btn btn--ghost btn--sm" data-rechazar="${s.id}">✕</button>
            </div>
          </div>`).join('');

        paneSol.querySelectorAll('[data-aceptar]').forEach(btn => {
          btn.addEventListener('click', async () => {
            try {
              await responderSolicitudAPI(btn.dataset.aceptar, 'aceptar');
              toast('Solicitud aceptada', 'success');
              cargarAmigosHeader();
            } catch (err) { toast(err.message, 'error'); }
          });
        });

        paneSol.querySelectorAll('[data-rechazar]').forEach(btn => {
          btn.addEventListener('click', async () => {
            try {
              await responderSolicitudAPI(btn.dataset.rechazar, 'rechazar');
              toast('Solicitud rechazada', 'info');
              cargarAmigosHeader();
            } catch (err) { toast(err.message, 'error'); }
          });
        });
      }
    }

    const paneList = document.getElementById('pane-lista');
    if (paneList) {
      if (amigos.length === 0) {
        paneList.innerHTML = `<p class="text-sm text-muted text-center" style="padding:20px">Aún no tenés amigos.</p>`;
      } else {
        paneList.innerHTML = amigos.map(a => `
          <div class="amigo-item" style="position:relative">
            <img src="${a.avatar || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--md" data-autor-id="${a.id}" style="cursor:pointer" />
            <div class="amigo-item__info" data-autor-id="${a.id}" style="cursor:pointer">
              <div class="amigo-item__name">${escapeHtml(a.nombre)}</div>
              <div class="amigo-item__sub">@${escapeHtml(a.username)}</div>
            </div>
            <button class="btn btn--ghost btn--sm" data-msg-id="${a.id}">Mensaje</button>
            <div style="position:relative">
              <button class="btn btn--ghost btn--sm" data-menu-amigo="${a.id}" title="Opciones" style="padding:4px 8px; font-weight:bold">⋮</button>
              <div class="menu-amigo-dropdown hidden" id="menu-amigo-${a.id}" style="position:absolute; right:0; top:100%; background:var(--color-surface); border:1px solid var(--color-border); border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:100; padding:4px; min-width:150px">
                <button class="btn btn--ghost btn--sm w-full" data-eliminar-amigo="${a.id}" style="color:red; justify-content:flex-start; padding:8px; width:100%">${ICONOS.basura} Eliminar amigo</button>
              </div>
            </div>
          </div>`).join('');

        paneList.querySelectorAll('[data-autor-id]').forEach(el => {
          el.addEventListener('click', () => {
            import('./components.js').then(({ verPerfilUsuario }) => {
              verPerfilUsuario(el.dataset.autorId);
            });
          });
        });

        paneList.querySelectorAll('[data-msg-id]').forEach(btn => {
          btn.addEventListener('click', async () => {
            try {
              const { crearConversacion } = await import('./services/mensajes.service.js');
              const conv = await crearConversacion(btn.dataset.msgId);
              document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
              window.location.hash = '#/mensajes';
              setTimeout(() => { document.querySelector(`[data-conv="${conv.id}"]`)?.click(); }, 400);
            } catch (err) { toast(err.message, 'error'); }
          });
        });

        paneList.querySelectorAll('[data-menu-amigo]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.menuAmigo;
            document.querySelectorAll('.menu-amigo-dropdown').forEach(m => m.classList.add('hidden'));
            document.getElementById(`menu-amigo-${id}`)?.classList.toggle('hidden');
          });
        });

        paneList.querySelectorAll('[data-eliminar-amigo]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm('¿Seguro que querés eliminar a este amigo?')) return;
            try {
              await eliminarAmistadAPI(btn.dataset.eliminarAmigo);
              toast('Amigo eliminado', 'info');
              cargarAmigosHeader();
            } catch (err) { toast(err.message, 'error'); }
          });
        });
      }
    }

    document.addEventListener('click', () => {
      document.querySelectorAll('.menu-amigo-dropdown').forEach(m => m.classList.add('hidden'));
    });

  } catch (err) {
    if (desdePolling) {
      console.warn('[components] Polling amigos falló (silencioso):', err.message);
    } else {
      console.error('[components] Error al cargar amigos header:', err);
    }
  } finally {
    isFetchingAmigos = false;
  }
}
/* =========================================================
   NOTIFICACIONES
   ========================================================= */
let notifsIniciadas = false;
let isFetchingNotifs = false;
let notifsTimerId = null;

function iconoNotif(tipo) {
  return {
    inscripcion:   ICONOS.check,
    salida:        ICONOS.salir,
    postulacion:   ICONOS.carta,
    aprobado:      ICONOS.check,
    rechazado:     ICONOS.x,
    cierre:        ICONOS.candado,
    edicion:       ICONOS.lapiz,
    cancelacion:   ICONOS.alerta,
    equipo_eliminado: ICONOS.alerta,
    expulsado:     ICONOS.x,
    jugador_salio: ICONOS.salir,
    invitacion:    ICONOS.correo,
    torneo_eliminado: ICONOS.alerta,
    confirmacion_partido:    ICONOS.diana,
    confirmacion_aceptada:   ICONOS.check,
    confirmacion_rechazada:  ICONOS.x,
    partido_confirmado:      ICONOS.trofeo,
    partido_revertido:       ICONOS.alerta,
    invitacion_organizador:          ICONOS.corona,
    respuesta_invitacion_organizador: ICONOS.correo,
    solicitud_amistad:       ICONOS.usuarios,
    solicitud_aceptada:      ICONOS.check,
  }[tipo] || ICONOS.campana;
}

function tiempoRelativoNotif(iso) {
  const dif = (Date.now() - new Date(iso).getTime()) / 1000;
  if (dif < 60) return 'hace unos segundos';
  if (dif < 3600) return `hace ${Math.floor(dif / 60)} min`;
  if (dif < 86400) return `hace ${Math.floor(dif / 3600)} h`;
  if (dif < 604800) return `hace ${Math.floor(dif / 86400)} d`;
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

export async function renderNotificaciones(desdePolling = false) {
  if (desdePolling && isFetchingNotifs) return;

  const lista = document.getElementById('lista-notificaciones');
  const badge = document.getElementById('badge-notif');
  const btnMarcar = document.getElementById('btn-marcar-leidas');
  if (!lista) return;

  isFetchingNotifs = true;

  let notificaciones = [];
  let noLeidas = 0;

  try {
    const [resultadoLista, totalNoLeidas] = await Promise.all([
      listarNotificaciones({ limit: 30 }),
      contarNoLeidasAPI(),
    ]);
    notificaciones = resultadoLista.data || [];
    noLeidas = totalNoLeidas;
  } catch (err) {
    if (desdePolling) {
      console.warn('[components] Polling notifs falló (silencioso):', err.message);
    } else {
      console.error('[components] Error al cargar notificaciones:', err);
      lista.innerHTML = `<div class="empty-state" style="padding:var(--space-5)"><div class="empty-state__icon" style="font-size:36px">${ICONOS.alerta}</div><p class="text-sm text-muted">No se pudieron cargar las notificaciones</p></div>`;
    }
    isFetchingNotifs = false;
    return;
  }

  if (badge) {
    badge.textContent = noLeidas;
    badge.classList.toggle('hidden', noLeidas === 0);
  }
  if (btnMarcar) btnMarcar.style.display = noLeidas > 0 ? '' : 'none';

  if (notificaciones.length === 0) {
    lista.innerHTML = `<div class="empty-state" style="padding:var(--space-5)"><div class="empty-state__icon" style="font-size:36px">${ICONOS.campana}</div><p class="text-sm text-muted">No tienes notificaciones</p></div>`;
    isFetchingNotifs = false;
    return;
  }

  lista.innerHTML = notificaciones.map(n => `
    <div class="notif-item ${n.leida ? '' : 'notif-item--no-leida'}" data-notif-id="${n.id}" data-link="${n.link || ''}">
      <div class="notif-item__icon">${iconoNotif(n.tipo)}</div>
      <div class="notif-item__info">
        <div class="notif-item__text">${escapeHtml(n.mensaje)}</div>
        <div class="notif-item__time">${tiempoRelativoNotif(n.createdAt)}</div>
      </div>
      ${!n.leida ? `<span class="notif-item__dot"></span>` : ''}
      <button class="notif-item__del" data-del-notif="${n.id}" title="Eliminar notificación" aria-label="Eliminar notificación">${ICONOS.basura}</button>
    </div>
  `).join('');

  lista.querySelectorAll('.notif-item').forEach(el => {
    el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-del-notif]')) return;
      e.stopPropagation();
      const id = el.dataset.notifId;
      const link = el.dataset.link;
      const eraNoLeida = el.classList.contains('notif-item--no-leida');
      if (eraNoLeida) { try { await marcarLeidaAPI(id); } catch (err) {} }
      document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
      await renderNotificaciones();
      if (link && link.startsWith('#/')) window.location.hash = link;
    });
  });

  lista.querySelectorAll('[data-del-notif]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try { await eliminarNotificacionAPI(btn.dataset.delNotif); await renderNotificaciones(); }
      catch (err) { toast(err.message, 'error'); }
    });
  });

  isFetchingNotifs = false;
}

export async function marcarTodasLeidas() {
  try {
    const resultado = await marcarTodasLeidasAPI();
    toast(resultado.mensaje || 'Notificaciones marcadas como leídas', 'info');
    await renderNotificaciones();
  } catch (err) {
    console.error('[components] Error al marcar todas:', err);
    toast(err.message || 'No se pudo marcar las notificaciones', 'error');
  }
}

export function initNotificaciones() {
  if (notifsIniciadas) return;
  notifsIniciadas = true;

  document.getElementById('btn-marcar-leidas')?.addEventListener('click', (e) => { e.stopPropagation(); marcarTodasLeidas(); });
  document.getElementById('btn-ver-todas-notif')?.addEventListener('click', (e) => { e.stopPropagation(); document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open')); });
  document.getElementById('btn-campana')?.addEventListener('click', () => { renderNotificaciones(); });

  // Primera carga
  renderNotificaciones();

  // ⚡ Polling recursivo con jitter
  const loop = async () => {
    if (!document.hidden) await renderNotificaciones(true);
    notifsTimerId = setTimeout(loop, POLL_NOTIFS_MS + Math.random() * JITTER_MS);
  };
  notifsTimerId = setTimeout(loop, POLL_NOTIFS_MS);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderNotificaciones(true);
  });
}

/* =========================================================
   VER PERFIL DE OTRO USUARIO
   ========================================================= */
let perfilPublicoActual = null;
let pubsCacheVerPerfil = [];

export async function verPerfilUsuario(usuarioOId) {
  const body = document.getElementById('ver-perfil-body');
  if (!body) return;

  const usuarioId = typeof usuarioOId === 'object' ? usuarioOId?.id : usuarioOId;
  if (!usuarioId) return;

  const user = getSesion();
  const esMiPerfil = String(usuarioId) === String(user.id);

  body.innerHTML = `<div class="page-loader"><div class="spinner"></div><span>Cargando perfil...</span></div>`;
  abrirModal('modal-ver-perfil');

  let estadoAmistad = 'ninguno';
  if (!esMiPerfil) {
    try {
      const res = await obtenerEstadoAPI(usuarioId);
      estadoAmistad = res.estado;
    } catch (err) {}
  }

  if (estadoAmistad === 'bloqueado') {
    body.innerHTML = `
      <div class="empty-state" style="padding:var(--space-5)">
        <div class="empty-state__icon" style="font-size:36px">${ICONOS.candado}</div>
        <p class="text-sm text-muted">Este usuario no está disponible.</p>
      </div>`;
    return;
  }

  const yoLoBloquee = estadoAmistad === 'bloqueado_por_mi';

  let u;
  try {
    u = await obtenerPerfilPublico(usuarioId);
    perfilPublicoActual = u;
  } catch (err) {
    console.error('[components] Error al cargar perfil:', err);
    body.innerHTML = `<div class="empty-state" style="padding:var(--space-5)"><div class="empty-state__icon" style="font-size:36px">${err.status === 403 ? ICONOS.candado : ICONOS.alerta}</div><p class="text-sm text-muted">${err.status === 403 ? 'Usuario no disponible.' : 'No se pudo cargar el perfil.'}</p></div>`;
    return;
  }

  if (yoLoBloquee) {
    body.innerHTML = `
      <div class="empty-state" style="padding:var(--space-5)">
        <div class="empty-state__icon" style="font-size:36px">${ICONOS.candado}</div>
        <p class="text-sm text-muted" style="margin-bottom:16px">Bloqueaste a este usuario.</p>
        <button class="btn btn--primary" id="btn-desbloquear-unico">Desbloquear usuario</button>
      </div>`;
    document.getElementById('btn-desbloquear-unico')?.addEventListener('click', async () => {
      try {
        await desbloquearUsuarioAPI(usuarioId);
        toast('Usuario desbloqueado', 'success');
        cerrarModal('modal-ver-perfil');
        cargarAmigosHeader();
      } catch (err) { toast(err.message, 'error'); }
    });
    document.querySelectorAll('#modal-ver-perfil [data-cerrar-modal]').forEach(btn => { btn.onclick = () => cerrarModal('modal-ver-perfil'); });
    document.getElementById('modal-ver-perfil').onclick = (e) => { if (e.target.id === 'modal-ver-perfil') cerrarModal('modal-ver-perfil'); };
    return;
  }

  try { pubsCacheVerPerfil = await listarPublicacionesDe(usuarioId); } catch (err) { pubsCacheVerPerfil = []; }

  const colorKey = u.heroColor || 'navy';
  const preset = HERO_COLORS.find(c => c.key === colorKey) || HERO_COLORS[0];
  const heroStyle = `background: linear-gradient(135deg, ${preset.from} 0%, ${preset.to} 100%);`;
  const isDarkText = preset.text === 'dark';

  let opcionesMenu = '';
  if (estadoAmistad === 'amigos') {
    opcionesMenu += `<button class="btn btn--ghost btn--sm w-full" id="btn-eliminar-amigo" style="color:var(--color-danger); justify-content:flex-start; padding:8px 10px; width:100%; text-align:left">${ICONOS.basura} Eliminar amigo</button>`;
  }
  opcionesMenu += `<button class="btn btn--ghost btn--sm w-full" id="btn-bloquear-usuario" style="color:var(--color-danger); justify-content:flex-start; padding:8px 10px; width:100%; text-align:left">${ICONOS.candado} Bloquear usuario</button>`;

  body.innerHTML = `
    <div class="perfil-hero perfil-hero--modal ${isDarkText ? 'perfil-hero--dark-text' : ''}" style="${heroStyle}">
      <div class="perfil-hero__inner">
        <div class="perfil-hero__left">
          <img src="${u.avatar || 'assets/icons/usuario.svg'}" alt="" class="perfil-hero__avatar perfil-hero__avatar--sm" />
          <div class="perfil-hero__info">
            <h1 class="perfil-hero__nombre perfil-hero__nombre--sm">${escapeHtml(u.nombre || 'Usuario')}</h1>
            <p class="perfil-hero__sub">@${escapeHtml(u.username || 'usuario')}${u.ciudad ? ' · ' + escapeHtml(u.ciudad) : ''}${u.pais ? ', ' + escapeHtml(u.pais) : ''}</p>
            ${u.bio ? `<p class="perfil-hero__bio perfil-hero__bio--sm">${escapeHtml(u.bio)}</p>` : ''}
            <div class="perfil-hero__chips">
              ${(u.deportes || []).slice(0, 4).map(d => `<span class="perfil-hero__chip perfil-hero__chip--deporte">${escapeHtml(d.deporte)}</span>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>

    ${renderStatsHeroPublico(u)}

    <div class="subtabs mt-4" id="subtabs-ver-perfil">
      <button class="subtab subtab--active" data-ver-tab="publicaciones">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        Publicaciones
      </button>
      <button class="subtab" data-ver-tab="actividad">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
        Actividad
      </button>
    </div>

    <div class="subpanel subpanel--active" id="panel-ver-publicaciones"><div id="ver-perfil-pubs-feed"></div></div>
    <div class="subpanel" id="panel-ver-actividad"><div id="ver-perfil-actividad"></div></div>

    ${!esMiPerfil ? `
    <div class="flex gap-2 mt-4" style="justify-content:center; flex-wrap:wrap; align-items:center;">
      <button class="btn btn--primary btn--sm" id="btn-perfil-mensaje">${ICONOS.chat} Enviar mensaje</button>
      ${estadoAmistad === 'ninguno' ? `<button class="btn btn--ghost btn--sm" id="btn-perfil-amigo">${ICONOS.usuarios} Agregar amigo</button>` : ''}
      ${estadoAmistad === 'amigos' ? `<span class="badge badge--success" style="padding:10px 16px; display:flex; align-items:center; gap:6px">${ICONOS.check} Amigos</span>` : ''}
      ${estadoAmistad === 'pendiente_enviada' ? `<span class="badge badge--warning" style="padding:10px 16px; display:flex; align-items:center; gap:6px">${ICONOS.reloj} Solicitud enviada</span>` : ''}
      ${estadoAmistad === 'pendiente_recibida' ? `<button class="btn btn--primary btn--sm" id="btn-aceptar-amigo">${ICONOS.check} Aceptar amistad</button>` : ''}

      <div style="position:relative; margin-left:auto;">
        <button class="btn btn--ghost btn--sm" id="btn-perfil-opciones" style="padding:8px 12px; font-weight:bold" title="Más opciones">⋮</button>
        <div id="menu-perfil-opciones" class="hidden" style="position:absolute; right:0; top:100%; background:var(--color-surface); border:1px solid var(--color-border); border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.15); z-index:100; padding:6px; min-width:200px; margin-top:6px; display:flex; flex-direction:column; gap:2px;">
          ${opcionesMenu}
        </div>
      </div>
    </div>
    ` : ''}
  `;

  renderPubsVerPerfil();
  renderActividadVerPerfil(u);

  const subtabs = body.querySelectorAll('[data-ver-tab]');
  const panelPubs = document.getElementById('panel-ver-publicaciones');
  const panelAct = document.getElementById('panel-ver-actividad');

  subtabs.forEach(st => {
    st.addEventListener('click', () => {
      subtabs.forEach(s => s.classList.toggle('subtab--active', s === st));
      const tab = st.dataset.verTab;
      panelPubs?.classList.toggle('subpanel--active', tab === 'publicaciones');
      panelAct?.classList.toggle('subpanel--active', tab === 'actividad');
    });
  });

  document.getElementById('btn-perfil-mensaje')?.addEventListener('click', async () => {
    try {
      const { crearConversacion } = await import('./services/mensajes.service.js');
      const conv = await crearConversacion(u.id);
      document.getElementById('modal-ver-perfil')?.classList.remove('open');
      window.location.hash = '#/mensajes';
      setTimeout(() => { document.querySelector(`[data-conv="${conv.id}"]`)?.click(); }, 400);
    } catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('btn-perfil-amigo')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await enviarSolicitudAPI(u.id);
      toast('Solicitud enviada', 'success');
      btn.outerHTML = `<span class="badge badge--warning" style="padding:10px 16px; display:flex; align-items:center; gap:6px">${ICONOS.reloj} Solicitud enviada</span>`;
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
  });

  document.getElementById('btn-aceptar-amigo')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await responderSolicitudAPI(u.id, 'aceptar');
      toast('Ahora son amigos', 'success');
      btn.outerHTML = `<span class="badge badge--success" style="padding:10px 16px; display:flex; align-items:center; gap:6px">${ICONOS.check} Amigos</span>`;
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
  });

  document.getElementById('btn-perfil-opciones')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('menu-perfil-opciones')?.classList.toggle('hidden');
  });

  document.getElementById('btn-eliminar-amigo')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm(`¿Seguro que querés eliminar a ${u.nombre} de tus amigos?`)) return;
    try {
      await eliminarAmistadAPI(u.id);
      toast('Amigo eliminado', 'info');
      cerrarModal('modal-ver-perfil');
      cargarAmigosHeader();
    } catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('btn-bloquear-usuario')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm(`¿Seguro que querés bloquear a ${u.nombre}? No podrá interactuar con vos.`)) return;
    try {
      await bloquearUsuarioAPI(u.id);
      toast('Usuario bloqueado', 'success');
      cerrarModal('modal-ver-perfil');
      cargarAmigosHeader();
    } catch (err) { toast(err.message, 'error'); }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#menu-perfil-opciones') && !e.target.closest('#btn-perfil-opciones')) {
      document.getElementById('menu-perfil-opciones')?.classList.add('hidden');
    }
  });

  document.querySelectorAll('#modal-ver-perfil [data-cerrar-modal]').forEach(btn => { btn.onclick = () => cerrarModal('modal-ver-perfil'); });
  document.getElementById('modal-ver-perfil').onclick = (e) => { if (e.target.id === 'modal-ver-perfil') cerrarModal('modal-ver-perfil'); };
}

function renderStatsHeroPublico(u) {
  const stats = u.statsHero || { partidos: null, torneos: null, equipos: null };
  if (stats.partidos === null && stats.torneos === null && stats.equipos === null) return '';
  const filas = [];
  if (stats.partidos !== null) filas.push(`<div class="perfil-stat"><div class="perfil-stat__value">${stats.partidos}</div><div class="perfil-stat__label">Partidos</div></div>`);
  if (stats.torneos !== null) filas.push(`<div class="perfil-stat"><div class="perfil-stat__value">${stats.torneos}</div><div class="perfil-stat__label">Torneos</div></div>`);
  if (stats.equipos !== null) filas.push(`<div class="perfil-stat"><div class="perfil-stat__value">${stats.equipos}</div><div class="perfil-stat__label">Equipos</div></div>`);
  return `<div class="perfil-stats mt-4">${filas.join('')}</div>`;
}

function renderPubsVerPerfil() {
  const cont = document.getElementById('ver-perfil-pubs-feed');
  if (!cont) return;
  renderFeedPublicaciones(cont, pubsCacheVerPerfil, { onRefrescar: () => {} });
}

function renderActividadVerPerfil(u) {
  const cont = document.getElementById('ver-perfil-actividad');
  if (!cont) return;
  const deportes = u.deportes || [];
  if (deportes.length === 0) {
    cont.innerHTML = `<div class="empty-state" style="padding:var(--space-5)"><div class="empty-state__icon" style="font-size:36px">${ICONOS.medalla}</div><p class="text-sm text-muted">Este usuario aún no agregó deportes</p></div>`;
    return;
  }
  cont.innerHTML = deportes.map(d => {
    const posiciones = (d.posiciones || []).join(', ') || 'Sin posiciones';
    const stats = Object.entries(d.stats || {});
    return `
      <div class="card mb-4">
        <h3 class="card__title mb-4">${ICONOS.medalla} ${escapeHtml(d.deporte)}</h3>
        <div class="text-sm text-muted mb-3"><strong>Posiciones:</strong> ${escapeHtml(posiciones)}</div>
        ${stats.length > 0 ? `<div class="stats-grid" style="grid-template-columns:repeat(auto-fit, minmax(110px, 1fr))">${stats.map(([clave, v]) => `<div class="stat-box"><div class="stat-box__value">${v.valor || 0}</div><div class="stat-box__label">${escapeHtml(clave)}</div></div>`).join('')}</div>` : `<p class="text-xs text-muted">Sin estadísticas públicas</p>`}
      </div>`;
  }).join('');
}

export async function abrirModalVerPublicacion(pubId, cache) {
  const body = document.getElementById('ver-publicacion-body');
  if (!body) return;
  const lista = cache || [];
  const pub = lista.find(p => String(p.id) === String(pubId));
  if (!pub) { toast('Publicación no encontrada', 'error'); return; }

  body.innerHTML = `
    <div class="ver-pub">
      <div class="ver-pub__header">
        <img src="${pub.autor?.avatar || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--md" />
        <div style="flex:1; min-width:0">
          <div class="ver-pub__autor">${escapeHtml(pub.autor?.nombre || 'Usuario')}</div>
          <div class="ver-pub__fecha">${new Date(pub.createdAt).toLocaleDateString('es-CL')}</div>
        </div>
      </div>
      ${pub.imagen ? `<img src="${pub.imagen}" alt="" class="ver-pub__img" />` : ''}
      ${pub.contenido ? `<p class="ver-pub__contenido">${escapeHtml(pub.contenido)}</p>` : ''}
      <div class="ver-pub__acciones">
        <button class="ver-pub__like ${pub.yoLikee ? 'activo' : ''}" id="ver-pub-btn-like">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="${pub.yoLikee ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span id="ver-pub-like-count">${pub.totalLikes || 0}</span>
        </button>
      </div>
      <div class="ver-pub__comentarios" id="ver-pub-comentarios"><p class="text-sm text-muted text-center" style="padding:var(--space-3)">Cargando comentarios...</p></div>
      <form class="ver-pub__form" id="ver-pub-form">
        <input type="text" id="ver-pub-input" placeholder="Escribí un comentario..." maxlength="500" autocomplete="off" />
        <button type="submit" class="btn btn--primary btn--sm">Enviar</button>
      </form>
    </div>`;

  document.getElementById('ver-pub-btn-like').onclick = async (e) => {
    e.preventDefault();
    try {
      const res = await toggleLike(pubId);
      pub.yoLikee = res.yoLikee;
      pub.totalLikes = (pub.totalLikes || 0) + (res.yoLikee ? 1 : -1);
      const btn = document.getElementById('ver-pub-btn-like');
      btn.classList.toggle('activo', res.yoLikee);
      btn.querySelector('svg').setAttribute('fill', res.yoLikee ? 'currentColor' : 'none');
      document.getElementById('ver-pub-like-count').textContent = pub.totalLikes;
    } catch (err) { toast(err.message || 'No se pudo dar like', 'error'); }
  };

  await cargarComentariosVerPub(pubId);

  document.getElementById('ver-pub-form').onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('ver-pub-input');
    const texto = input.value.trim();
    if (!texto) return;
    try {
      await crearComentario(pubId, texto);
      input.value = '';
      pub.totalComentarios = (pub.totalComentarios || 0) + 1;
      await cargarComentariosVerPub(pubId);
    } catch (err) { toast(err.message || 'No se pudo comentar', 'error'); }
  };

  document.querySelectorAll('#modal-ver-publicacion [data-cerrar-modal]').forEach(btn => { btn.onclick = () => cerrarModal('modal-ver-publicacion'); });
  document.getElementById('modal-ver-publicacion').onclick = (e) => { if (e.target.id === 'modal-ver-publicacion') cerrarModal('modal-ver-publicacion'); };
  abrirModal('modal-ver-publicacion');
}

async function cargarComentariosVerPub(pubId) {
  const cont = document.getElementById('ver-pub-comentarios');
  if (!cont) return;
  try {
    const comentarios = await listarComentarios(pubId);
    if (comentarios.length === 0) {
      cont.innerHTML = `<p class="text-sm text-muted text-center" style="padding:var(--space-3)">Aún no hay comentarios. ¡Sé el primero!</p>`;
      return;
    }
    cont.innerHTML = comentarios.map(c => `<div class="ver-pub__comentario"><img src="${c.autor?.avatar || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--sm" /><div style="flex:1; min-width:0"><div class="ver-pub__comentario-autor">${escapeHtml(c.autor?.nombre || 'Usuario')}</div><div class="ver-pub__comentario-texto">${escapeHtml(c.texto)}</div></div></div>`).join('');
  } catch (err) {
    cont.innerHTML = `<p class="text-sm text-muted text-center" style="padding:var(--space-3)">No se pudieron cargar los comentarios</p>`;
  }
}

/* =========================================================
   BADGE MENSAJES
   ========================================================= */
let isFetchingMensajes = false;

export async function actualizarBadgeMensajes() {
  if (isFetchingMensajes) return;
  const user = getSesion();
  if (!user) return;
  const badge = document.getElementById('badge-mensajes');
  if (!badge) return;

  isFetchingMensajes = true;
  try {
    const total = await contarNoLeidos();
    badge.textContent = total;
    badge.classList.toggle('hidden', total === 0);
  } catch (err) {
    console.warn('[components] No se pudo actualizar badge mensajes:', err.message);
  } finally {
    isFetchingMensajes = false;
  }
}

export async function initBadgeMensajes() {
  document.getElementById('btn-header-mensajes')?.addEventListener('click', () => { window.location.hash = '#/mensajes'; });
  await actualizarBadgeMensajes();

  // ⚡ Polling recursivo cada 20s + jitter, pausado si la pestaña está oculta
  const loop = async () => {
    if (!document.hidden) await actualizarBadgeMensajes();
    setTimeout(loop, POLL_MENSAJES_MS + Math.random() * JITTER_MS);
  };
  setTimeout(loop, POLL_MENSAJES_MS);

  window.addEventListener('hashchange', () => { setTimeout(actualizarBadgeMensajes, 200); });
}

/* =========================================================
   CONFIGURACIÓN (sin cambios funcionales)
   ========================================================= */
export function initConfiguracion() {
  document.querySelectorAll('[data-toggle-pass]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.togglePass;
      const input = document.getElementById(id);
      if (!input) return;
      const esPassword = input.type === 'password';
      input.type = esPassword ? 'text' : 'password';
      btn.innerHTML = esPassword ? ICONOS.ojo : ICONOS.ojo;
      btn.title = esPassword ? 'Ocultar contraseña' : 'Ver contraseña';
    });
  });

  document.querySelectorAll('[data-config-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const accion = btn.dataset.configAction;
      cerrarModal('modal-configuracion');
      if (accion === 'perfil') window.location.hash = '#/perfil';
      if (accion === 'editar-perfil') { window.location.hash = '#/perfil'; setTimeout(() => { document.getElementById('btn-editar-perfil')?.click(); }, 400); }
      if (accion === 'cambiar-pass') {
        document.getElementById('pass-actual').value = '';
        document.getElementById('pass-nueva').value = '';
        document.getElementById('pass-confirmar').value = '';
        ['pass-actual', 'pass-nueva', 'pass-confirmar'].forEach(id => { const input = document.getElementById(id); if (input) input.type = 'password'; });
        document.querySelectorAll('[data-toggle-pass]').forEach(b => { b.innerHTML = ICONOS.ojo; b.title = 'Ver contraseña'; });
        abrirModal('modal-cambiar-pass');
      }
      if (accion === 'notificaciones') toast('Notificaciones: próximamente', 'info');
      if (accion === 'privacidad') toast('Privacidad: próximamente', 'info');
      if (accion === 'ayuda') toast('Ayuda: próximamente', 'info');
      if (accion === 'cerrar-sesion') { if (confirm('¿Cerrar sesión?')) { cerrarSesion(); window.location.href = 'index.html'; } }
      if (accion === 'eliminar-cuenta') {
        if (!confirm('⚠️ ¿Eliminar tu cuenta? Esta acción no se puede deshacer.')) return;
        if (!confirm('⚠️ Última confirmación: ¿estás seguro?')) return;
        toast('Eliminar cuenta: próximamente', 'info');
      }
    });
  });

  document.querySelectorAll('#modal-cambiar-pass [data-cerrar-modal]').forEach(btn => { btn.onclick = () => cerrarModal('modal-cambiar-pass'); });
  document.getElementById('modal-cambiar-pass')?.addEventListener('click', (e) => { if (e.target.id === 'modal-cambiar-pass') cerrarModal('modal-cambiar-pass'); });

  document.getElementById('btn-confirmar-pass')?.addEventListener('click', async () => {
    const actual = document.getElementById('pass-actual').value;
    const nueva = document.getElementById('pass-nueva').value;
    const confirmar = document.getElementById('pass-confirmar').value;
    const user = getSesion();
    if (!user) return;
    if (!actual) return toast('Ingresa tu contraseña actual', 'error');
    if (nueva.length < 8) return toast('La nueva debe tener al menos 8 caracteres', 'error');
    if (!/[A-Z]/.test(nueva)) return toast('La nueva debe tener una mayúscula', 'error');
    if (!/[a-z]/.test(nueva)) return toast('La nueva debe tener una minúscula', 'error');
    if (!/[0-9]/.test(nueva)) return toast('La nueva debe tener un número', 'error');
    if (nueva !== confirmar) return toast('Las contraseñas no coinciden', 'error');

    const btn = document.getElementById('btn-confirmar-pass');
    btn.disabled = true;
    btn.textContent = 'Cambiando...';

    try {
      const { cambiarMiPassword } = await import('./services/usuarios.service.js');
      const resultado = await cambiarMiPassword(actual, nueva);
      cerrarModal('modal-cambiar-pass');
      toast(resultado.mensaje || 'Contraseña actualizada', 'success');
      setTimeout(() => { cerrarSesion(); window.location.href = 'index.html'; }, 2000);
    } catch (err) {
      console.error('[components] Error al cambiar contraseña:', err);
      toast(err.message || 'No se pudo cambiar la contraseña', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Cambiar contraseña';
    }
  });
}