/* =========================================================
   components.js — Header, menú, toasts, notifs, config
   ========================================================= */

import { getSesion, cerrarSesion } from './auth.js';
import { mockUsuarios } from './data-mock.js';
import {
  notificacionesDe,
  marcarNotifLeida,
  getNotificaciones,
  totalNoLeidosTodo
} from './store.js';

/* =========================================================
   HEADER
   ========================================================= */
export function initHeader() {
  const user = getSesion();
  if (!user) return;

  const avatar = document.getElementById('avatar-header');
  if (avatar) avatar.src = user.avatar;

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

/* =========================================================
   TOASTS
   ========================================================= */
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

/* =========================================================
   MODALES
   ========================================================= */
export function abrirModal(id) {
  document.getElementById(id)?.classList.add('open');
}

export function cerrarModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

/* =========================================================
   HELPERS
   ========================================================= */
export function formatearFecha(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit'
  });
}

/* =========================================================
   DROPDOWNS
   ========================================================= */
export function initDropdowns() {
  const dropdowns = document.querySelectorAll('.dropdown');

  dropdowns.forEach(dd => {
    const trigger = dd.querySelector('.dropdown__trigger');
    const panel = dd.querySelector('.dropdown__panel');
    if (!trigger || !panel) return;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdowns.forEach(other => {
        if (other !== dd) other.classList.remove('open');
      });
      dd.classList.toggle('open');
    });

    panel.addEventListener('click', (e) => e.stopPropagation());
  });

  document.addEventListener('click', () => {
    dropdowns.forEach(dd => dd.classList.remove('open'));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdowns.forEach(dd => dd.classList.remove('open'));
    }
  });

  // Tabs de amigos
  const tabsAmigos = document.querySelectorAll('[data-tab-amigos]');
  tabsAmigos.forEach(tab => {
    tab.addEventListener('click', () => {
      tabsAmigos.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      document.querySelectorAll('.dropdown__pane[id^="pane-"]').forEach(p => {
        p.classList.remove('active');
      });

      const paneId = 'pane-' + tab.dataset.tabAmigos;
      document.getElementById(paneId)?.classList.add('active');
    });
  });

  // Aceptar / rechazar solicitud
  document.querySelectorAll('[data-aceptar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.amigo-item');
      if (!item) return;
      item.style.transition = 'opacity 0.3s, transform 0.3s';
      item.style.opacity = '0';
      item.style.transform = 'translateX(20px)';
      setTimeout(() => item.remove(), 300);
    });
  });

  document.querySelectorAll('[data-rechazar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.amigo-item');
      if (!item) return;
      item.style.transition = 'opacity 0.3s, transform 0.3s';
      item.style.opacity = '0';
      item.style.transform = 'translateX(20px)';
      setTimeout(() => item.remove(), 300);
    });
  });
}

/* =========================================================
   NOTIFICACIONES
   ========================================================= */
const KEY_NOTIFS = 'miejquipo_notificaciones';

function iconoNotif(tipo) {
  return {
    inscripcion:   '✅',
    salida:        '🚪',
    postulacion:   '📥',
    aprobado:      '🎉',
    rechazado:     '❌',
    cierre:        '🔒',
    edicion:       '✏️',
    cancelacion:   '⚠️',
    equipo_eliminado: '💔',
    expulsado:     '🚫',
    jugador_salio: '👋',
    invitacion:    '📨',
    torneo_eliminado: '⚠️'
  }[tipo] || '🔔';
}

function tiempoRelativoNotif(iso) {
  const dif = (Date.now() - new Date(iso).getTime()) / 1000;
  if (dif < 60) return 'hace unos segundos';
  if (dif < 3600) return `hace ${Math.floor(dif / 60)} min`;
  if (dif < 86400) return `hace ${Math.floor(dif / 3600)} h`;
  if (dif < 604800) return `hace ${Math.floor(dif / 86400)} d`;
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

export function renderNotificaciones() {
  const lista = document.getElementById('lista-notificaciones');
  const badge = document.getElementById('badge-notif');
  const btnMarcar = document.getElementById('btn-marcar-leidas');
  if (!lista) return;

  const user = JSON.parse(localStorage.getItem('miejquipo_session') || 'null');
  if (!user) return;

  const notifs = notificacionesDe(user.id).sort(
    (a, b) => new Date(b.fecha) - new Date(a.fecha)
  );

  const noLeidas = notifs.filter(n => !n.leida).length;

  if (badge) {
    badge.textContent = noLeidas;
    badge.classList.toggle('hidden', noLeidas === 0);
  }

  if (btnMarcar) {
    btnMarcar.style.display = noLeidas > 0 ? '' : 'none';
  }

  if (notifs.length === 0) {
    lista.innerHTML = `
      <div class="empty-state" style="padding:var(--space-5)">
        <div class="empty-state__icon" style="font-size:36px">🔔</div>
        <p class="text-sm text-muted">No tienes notificaciones</p>
      </div>`;
    return;
  }

  lista.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.leida ? '' : 'notif-item--no-leida'}"
         data-notif-id="${n.id}"
         data-link="${n.link || ''}">
      <div class="notif-item__icon">${iconoNotif(n.tipo)}</div>
      <div class="notif-item__info">
        <div class="notif-item__text">${n.mensaje}</div>
        <div class="notif-item__time">${tiempoRelativoNotif(n.fecha)}</div>
      </div>
      ${!n.leida ? `<span class="notif-item__dot"></span>` : ''}
    </div>
  `).join('');

  lista.querySelectorAll('.notif-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.dataset.notifId;
      const link = el.dataset.link;

      marcarNotifLeida(Number(id));
      renderNotificaciones();

      document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));

      if (link && link.startsWith('#/')) {
        window.location.hash = link;
      }
    });
  });
}

export function marcarTodasLeidas() {
  const user = JSON.parse(localStorage.getItem('miejquipo_session') || 'null');
  if (!user) return;

  const todas = getNotificaciones().map(n =>
    n.para === user.id ? { ...n, leida: true } : n
  );
  localStorage.setItem(KEY_NOTIFS, JSON.stringify(todas));
  renderNotificaciones();
}

export function initNotificaciones() {
  const btnMarcar = document.getElementById('btn-marcar-leidas');
  const btnVerTodas = document.getElementById('btn-ver-todas-notif');
  const btnCampana = document.getElementById('btn-campana');

  btnMarcar?.addEventListener('click', (e) => {
    e.stopPropagation();
    marcarTodasLeidas();
  });

  btnVerTodas?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
  });

  btnCampana?.addEventListener('click', () => {
    renderNotificaciones();
  });

  setInterval(renderNotificaciones, 15000);
  renderNotificaciones();
}

/* =========================================================
   VER PERFIL DE OTRO USUARIO
   ========================================================= */
export function verPerfilUsuario(usuario) {
  let u = usuario;

  if (typeof usuario === 'number' || typeof usuario === 'string') {
    u = mockUsuarios.find(x => x.id === Number(usuario));
    if (!u) {
      u = {
        id: Number(usuario),
        nombre: 'Usuario #' + usuario,
        username: 'user' + usuario,
        avatar: `https://i.pravatar.cc/150?u=${usuario}`,
        bio: '',
        deporte_favorito: '',
        ciudad: '',
        stats: { partidos: 0, goles: 0, mvps: 0 }
      };
    }
  }

  if (!u) return;

  const body = document.getElementById('ver-perfil-body');
  if (!body) return;

  const stats = u.stats || { partidos: 0, goles: 0, mvps: 0 };

  body.innerHTML = `
    <div style="text-align:center; margin-bottom:var(--space-5)">
      <img src="${u.avatar}" alt="" class="avatar avatar--xl" style="margin:0 auto var(--space-3)" />
      <h3 style="font-size:var(--fs-lg); font-weight:700">${u.nombre}</h3>
      <p class="text-sm text-muted">@${u.username}</p>
      ${u.bio ? `<p class="text-sm" style="margin-top:var(--space-3)">${u.bio}</p>` : ''}
    </div>

    <div class="flex gap-2 mb-4" style="justify-content:center; flex-wrap:wrap">
      ${u.deporte_favorito ? `<span class="badge badge--primary">🏅 ${u.deporte_favorito}</span>` : ''}
      ${u.posicion_favorita ? `<span class="badge badge--info">🎯 ${u.posicion_favorita}</span>` : ''}
      ${u.ciudad ? `<span class="badge badge--neutral">📍 ${u.ciudad}</span>` : ''}
    </div>

    ${u.statsPrivadas ? `
      <p class="text-sm text-muted text-center" style="padding:var(--space-4)">
        🔒 Este usuario mantiene sus estadísticas privadas
      </p>
    ` : `
      <div class="stats-grid" style="grid-template-columns:repeat(3, 1fr)">
        <div class="stat-box">
          <div class="stat-box__value">${stats.partidos || 0}</div>
          <div class="stat-box__label">Partidos</div>
        </div>
        <div class="stat-box">
          <div class="stat-box__value">${stats.goles || 0}</div>
          <div class="stat-box__label">Goles</div>
        </div>
        <div class="stat-box">
          <div class="stat-box__value">${stats.mvps || 0}</div>
          <div class="stat-box__label">MVPs</div>
        </div>
      </div>
    `}

    <div class="flex gap-2 mt-4" style="justify-content:center; flex-wrap:wrap">
      <button class="btn btn--primary btn--sm" id="btn-perfil-mensaje">💬 Enviar mensaje</button>
      <button class="btn btn--ghost btn--sm" id="btn-perfil-agregar">+ Agregar amigo</button>
    </div>
  `;

  document.getElementById('btn-perfil-mensaje')?.addEventListener('click', () => {
    import('./store.js').then(({ obtenerOCrearConversacion }) => {
      const user = getSesion();
      if (!user) return;
      const conv = obtenerOCrearConversacion(user.id, u.id);
      document.getElementById('modal-ver-perfil').classList.remove('open');
      window.location.hash = '#/mensajes';
      setTimeout(() => {
        document.querySelector(`[data-conv="${conv.id}"]`)?.click();
      }, 300);
    });
  });

  document.getElementById('btn-perfil-agregar')?.addEventListener('click', () => {
    toast('Solicitud de amistad enviada', 'success');
    const btn = document.getElementById('btn-perfil-agregar');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '✓ Solicitud enviada';
    }
  });

  document.querySelectorAll('#modal-ver-perfil [data-cerrar-modal]').forEach(btn => {
    btn.onclick = () => document.getElementById('modal-ver-perfil').classList.remove('open');
  });
  document.getElementById('modal-ver-perfil').onclick = (e) => {
    if (e.target.id === 'modal-ver-perfil') e.target.classList.remove('open');
  };

  abrirModal('modal-ver-perfil');
}

/* =========================================================
   BADGE DE MENSAJES
   ========================================================= */
export function actualizarBadgeMensajes() {
  const user = JSON.parse(localStorage.getItem('miejquipo_session') || 'null');
  if (!user) return;

  const badge = document.getElementById('badge-mensajes');
  if (!badge) return;

  const total = totalNoLeidosTodo(user.id);
  badge.textContent = total;
  badge.classList.toggle('hidden', total === 0);
}

export function initBadgeMensajes() {
  document.getElementById('btn-header-mensajes')?.addEventListener('click', () => {
    window.location.hash = '#/mensajes';
  });

  actualizarBadgeMensajes();
  setInterval(actualizarBadgeMensajes, 5000);

  window.addEventListener('hashchange', () => {
    setTimeout(actualizarBadgeMensajes, 200);
  });
}

/* =========================================================
   CONFIGURACIÓN
   ========================================================= */
export function initConfiguracion() {
  document.querySelectorAll('[data-config-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const accion = btn.dataset.configAction;

      document.getElementById('modal-configuracion')?.classList.remove('open');

      if (accion === 'perfil') {
        window.location.hash = '#/perfil';
      }

      if (accion === 'editar-perfil') {
        window.location.hash = '#/perfil';
        setTimeout(() => {
          document.getElementById('btn-editar-perfil')?.click();
        }, 400);
      }

      if (accion === 'cambiar-pass') {
        abrirModal('modal-cambiar-pass');
      }

      if (accion === 'notificaciones') {
        toast('Notificaciones: próximamente', 'info');
      }

      if (accion === 'privacidad') {
        toast('Privacidad: próximamente', 'info');
      }

      if (accion === 'ayuda') {
        toast('Ayuda: próximamente', 'info');
      }

      if (accion === 'cerrar-sesion') {
        if (confirm('¿Cerrar sesión?')) {
          cerrarSesion();
          window.location.href = 'index.html';
        }
      }

      if (accion === 'eliminar-cuenta') {
        if (!confirm('⚠️ ¿Eliminar tu cuenta? Esta acción no se puede deshacer.')) return;
        if (!confirm('⚠️ Última confirmación: ¿estás seguro?')) return;

        const user = getSesion();
        if (!user) return;

        import('./store.js').then(({ eliminarCuenta }) => {
          eliminarCuenta(user.id);
          toast('Cuenta eliminada', 'info');
          setTimeout(() => {
            window.location.href = 'index.html';
          }, 800);
        });
      }
    });
  });

  document.querySelectorAll('#modal-cambiar-pass [data-cerrar-modal]').forEach(btn => {
    btn.onclick = () => document.getElementById('modal-cambiar-pass').classList.remove('open');
  });

  document.getElementById('btn-confirmar-pass')?.addEventListener('click', () => {
    const actual = document.getElementById('pass-actual').value;
    const nueva = document.getElementById('pass-nueva').value;
    const confirmar = document.getElementById('pass-confirmar').value;

    const user = getSesion();
    if (!user) return;

    if (!actual) return toast('Ingresa tu contraseña actual', 'error');
    if (nueva.length < 6) return toast('La nueva debe tener al menos 6 caracteres', 'error');
    if (nueva !== confirmar) return toast('Las contraseñas no coinciden', 'error');

    import('./store.js').then(({ cambiarPassword }) => {
      const res = cambiarPassword(user.id, actual, nueva);
      if (!res.ok) return toast(res.error, 'error');
      document.getElementById('modal-cambiar-pass').classList.remove('open');
      toast('Contraseña cambiada', 'success');
    });
  });

  document.querySelectorAll('#modal-configuracion [data-cerrar-modal]').forEach(btn => {
    btn.onclick = () => document.getElementById('modal-configuracion').classList.remove('open');
  });
}