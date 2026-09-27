import { getSesion, cerrarSesion } from '../auth.js';
import { toast, abrirModal, cerrarModal } from '../components.js';
import { deportes, posicionesPorDeporte } from '../data-mock.js';
import {
  getPartidos,
  publicacionesDe,
  actualizarUsuario,
  cambiarPassword
} from '../store.js';

export async function init() {
  const user = getSesion();
  if (!user) return null;

  /* ---------- REFS ---------- */
  const elAvatar     = document.getElementById('perfil-avatar');
  const elNombre     = document.getElementById('perfil-nombre');
  const elUsername   = document.getElementById('perfil-username');
  const elBio        = document.getElementById('perfil-bio');
  const elDeporte    = document.getElementById('perfil-deporte');
  const elPosicion   = document.getElementById('perfil-posicion');
  const elCiudad     = document.getElementById('perfil-ciudad');
  const elStats      = document.getElementById('perfil-stats');
  const elActividad  = document.getElementById('perfil-actividad');
  const elPublicaciones = document.getElementById('perfil-publicaciones');
  const chkStatsPriv = document.getElementById('perfil-stats-privadas');

  /* ---------- AVATARES MOCK ---------- */
  const AVATARES = Array.from({ length: 20 }, (_, i) => `https://i.pravatar.cc/150?img=${i + 1}`);

  /* =========================================================
     RENDER PRINCIPAL
     ========================================================= */
  function render() {
    const u = getSesion();
    if (!u) return;

    /* ---------- Header ---------- */
    if (elAvatar) elAvatar.src = u.avatar || `https://i.pravatar.cc/150?u=${u.id}`;
    if (elNombre) elNombre.textContent = u.nombre;
    if (elUsername) elUsername.textContent = '@' + u.username;

    if (elBio) {
      elBio.textContent = u.bio || 'Sin biografía todavía.';
      elBio.style.fontStyle = u.bio ? 'normal' : 'italic';
    }

    if (elDeporte) {
      elDeporte.textContent = '🏅 ' + (u.deporte_favorito || 'Sin deporte favorito');
      elDeporte.className = 'badge badge--primary';
    }

    if (elPosicion) {
      if (u.posicion_favorita) {
        elPosicion.textContent = '🎯 ' + u.posicion_favorita;
        elPosicion.className = 'badge badge--info';
        elPosicion.style.display = '';
      } else {
        elPosicion.style.display = 'none';
      }
    }

    if (elCiudad) {
      elCiudad.textContent = '📍 ' + (u.ciudad || 'Sin ciudad');
      elCiudad.className = 'badge badge--neutral';
    }

    /* ---------- Toggle stats privadas ---------- */
    if (chkStatsPriv) chkStatsPriv.checked = !!u.statsPrivadas;

    /* ---------- Stats ---------- */
    if (elStats) {
      const stats = u.stats || { partidos: 0, goles: 0, mvps: 0 };
      const misPartidos = getPartidos().filter(p =>
        p.organizador?.id === u.id || (p.inscritos || []).includes(u.id)
      );

      elStats.innerHTML = `
        <div class="stat-box">
          <div class="stat-box__value">${stats.partidos || 0}</div>
          <div class="stat-box__label">Partidos jugados</div>
        </div>
        <div class="stat-box">
          <div class="stat-box__value">${stats.goles || 0}</div>
          <div class="stat-box__label">Goles/Anotaciones</div>
        </div>
        <div class="stat-box">
          <div class="stat-box__value">${stats.mvps || 0}</div>
          <div class="stat-box__label">MVPs</div>
        </div>
        <div class="stat-box">
          <div class="stat-box__value">${misPartidos.length}</div>
          <div class="stat-box__label">Participaciones</div>
        </div>
      `;
    }

    /* ---------- Mis publicaciones ---------- */
    if (elPublicaciones) {
      const misPubs = publicacionesDe(u.id);

      if (misPubs.length === 0) {
        elPublicaciones.innerHTML = `
          <div class="empty-state" style="padding:var(--space-5)">
            <div class="empty-state__icon" style="font-size:36px">📝</div>
            <p class="text-sm text-muted">Aún no has publicado nada</p>
            <a href="#/inicio" class="btn btn--primary btn--sm mt-4">Ir al inicio</a>
          </div>`;
      } else {
        elPublicaciones.innerHTML = misPubs.map(p => `
          <div class="feed-item" style="cursor:pointer" data-pub="${p.id}">
            <div style="font-size:24px">
              ${p.tipo === 'partido' ? '⚽' : p.tipo === 'torneo' ? '🏆' : p.tipo === 'grupo' ? '👥' : '📝'}
            </div>
            <div style="flex:1; min-width:0">
              <div class="feed-item__title">${(p.contenido || '').slice(0, 60)}${(p.contenido || '').length > 60 ? '...' : ''}</div>
              <div class="feed-item__subtitle">
                ${new Date(p.fecha).toLocaleDateString('es-CL')} · ❤️ ${p.likes || 0} · 💬 ${(p.comentarios || []).length}
              </div>
            </div>
            ${p.imagen ? `<img src="${p.imagen}" style="width:40px; height:40px; border-radius:var(--radius-sm); object-fit:cover" />` : ''}
            ${p.video ? `<div style="width:40px; height:40px; border-radius:var(--radius-sm); background:var(--color-primary-light); display:grid; place-items:center">🎥</div>` : ''}
          </div>
        `).join('');

        elPublicaciones.querySelectorAll('[data-pub]').forEach(el => {
          el.addEventListener('click', () => {
            window.location.hash = '#/inicio';
          });
        });
      }
    }

    /* ---------- Actividad reciente ---------- */
    if (elActividad) {
      const misPartidos = getPartidos().filter(p =>
        p.organizador?.id === u.id || (p.inscritos || []).includes(u.id)
      );
      const recientes = misPartidos.slice(0, 3);

      if (recientes.length === 0) {
        elActividad.innerHTML = `
          <div class="empty-state" style="padding:var(--space-5)">
            <div class="empty-state__icon" style="font-size:36px">📭</div>
            <p class="text-sm text-muted">Sin actividad reciente</p>
          </div>`;
      } else {
        elActividad.innerHTML = recientes.map(p => `
          <div class="feed-item" style="cursor:pointer" data-partido="${p.id}">
            <div style="font-size:24px">${p.emoji}</div>
            <div style="flex:1; min-width:0">
              <div class="feed-item__title">${p.titulo}</div>
              <div class="feed-item__subtitle">
                ${p.organizador?.id === u.id ? '👑 Organizador' : '✅ Inscrito'} · ${p.deporte}
              </div>
            </div>
          </div>
        `).join('');

        elActividad.querySelectorAll('[data-partido]').forEach(el => {
          el.addEventListener('click', () => {
            window.location.hash = `#/partido/${el.dataset.partido}`;
          });
        });
      }
    }
  }

  /* =========================================================
     MODAL EDITAR PERFIL
     ========================================================= */
  function abrirModalEditar() {
    const u = getSesion();
    if (!u) return;

    /* ---------- Precargar campos ---------- */
    document.getElementById('edit-perf-nombre').value = u.nombre || '';
    document.getElementById('edit-perf-username').value = u.username || '';
    document.getElementById('edit-perf-bio').value = u.bio || '';
    document.getElementById('edit-perf-ciudad').value = u.ciudad || '';

    /* ---------- Deporte ---------- */
    const selDep = document.getElementById('edit-perf-deporte');
    selDep.innerHTML = '<option value="">Sin definir</option>' +
      deportes.map(d => `<option value="${d}" ${d === u.deporte_favorito ? 'selected' : ''}>${d}</option>`).join('');

    /* ---------- Posición (depende del deporte) ---------- */
    actualizarPosiciones(u.deporte_favorito, u.posicion_favorita);

    selDep.onchange = () => {
      actualizarPosiciones(selDep.value, null);
    };

    /* ---------- Preview del avatar ---------- */
    const previewAvatar = document.getElementById('edit-perf-avatar-preview');
    previewAvatar.src = u.avatar || `https://i.pravatar.cc/150?u=${u.id}`;

    let avatarSel = u.avatar || `https://i.pravatar.cc/150?u=${u.id}`;

    /* ---------- Galería de avatares ---------- */
    const contAv = document.getElementById('perfil-galeria-avatares');
    contAv.innerHTML = AVATARES.map(url => `
      <button type="button"
              class="posicion-chip ${url === u.avatar ? 'active' : ''}"
              data-avatar="${url}"
              style="padding:2px; background:transparent; border:none">
        <img src="${url}" alt="" style="width:40px; height:40px; border-radius:50%; display:block" />
      </button>
    `).join('');

    contAv.querySelectorAll('[data-avatar]').forEach(btn => {
      btn.addEventListener('click', () => {
        contAv.querySelectorAll('[data-avatar]').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--color-primary-light)';
        avatarSel = btn.dataset.avatar;
        previewAvatar.src = avatarSel;
      });
    });

    // Marcar el activo si lo hay
    const activo = contAv.querySelector('.posicion-chip.active');
    if (activo) activo.style.background = 'var(--color-primary-light)';

    /* ---------- Subir foto propia ---------- */
    const inputAvatarFile = document.getElementById('edit-perf-avatar-file');
    if (inputAvatarFile) {
      inputAvatarFile.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
          return toast('La imagen es muy grande (máx 2 MB)', 'error');
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
          avatarSel = ev.target.result;
          previewAvatar.src = avatarSel;
          // Desmarcar galería
          contAv.querySelectorAll('[data-avatar]').forEach(b => {
            b.classList.remove('active');
            b.style.background = 'transparent';
          });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
      };
    }

    /* ---------- Quitar foto ---------- */
    const btnQuitar = document.getElementById('edit-perf-avatar-quitar');
    if (btnQuitar) {
      btnQuitar.onclick = () => {
        avatarSel = `https://i.pravatar.cc/150?u=${u.id}`;
        previewAvatar.src = avatarSel;
        contAv.querySelectorAll('[data-avatar]').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
        });
      };
    }

    /* ---------- Guardar ---------- */
    document.getElementById('btn-guardar-perfil').onclick = () => {
      const nombre = document.getElementById('edit-perf-nombre').value.trim();
      const username = document.getElementById('edit-perf-username').value.trim();
      const bio = document.getElementById('edit-perf-bio').value.trim();
      const deporte = document.getElementById('edit-perf-deporte').value;
      const posicion = document.getElementById('edit-perf-posicion').value;
      const ciudad = document.getElementById('edit-perf-ciudad').value.trim();

      if (!nombre) return toast('El nombre no puede estar vacío', 'error');
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return toast('El usuario debe tener 3-20 caracteres (letras, números, _)', 'error');
      }

      actualizarUsuario(u.id, {
        nombre,
        username,
        bio,
        deporte_favorito: deporte,
        posicion_favorita: posicion,
        ciudad,
        avatar: avatarSel
      });

      cerrarModal('modal-editar-perfil');
      toast('Perfil actualizado', 'success');
      render();
    };

    /* ---------- Cerrar ---------- */
    document.querySelectorAll('#modal-editar-perfil [data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-editar-perfil');
    });
    document.getElementById('modal-editar-perfil').onclick = (e) => {
      if (e.target.id === 'modal-editar-perfil') cerrarModal('modal-editar-perfil');
    };

    abrirModal('modal-editar-perfil');
  }

  /* ---------- Actualizar opciones de posición ---------- */
  function actualizarPosiciones(deporte, posicionActual) {
    const selPos = document.getElementById('edit-perf-posicion');
    if (!selPos) return;

    const posiciones = posicionesPorDeporte[deporte] || [];

    if (posiciones.length === 0) {
      selPos.innerHTML = `<option value="">Este deporte no tiene posiciones</option>`;
      selPos.disabled = true;
      return;
    }

    selPos.disabled = false;
    selPos.innerHTML = '<option value="">Sin definir</option>' +
      posiciones.map(p =>
        `<option value="${p}" ${p === posicionActual ? 'selected' : ''}>${p}</option>`
      ).join('');
  }

  /* =========================================================
     MODAL EDITAR STATS
     ========================================================= */
  function abrirModalEditarStats() {
    const u = getSesion();
    if (!u) return;

    const stats = u.stats || { partidos: 0, goles: 0, mvps: 0 };
    document.getElementById('edit-stats-partidos').value = stats.partidos || 0;
    document.getElementById('edit-stats-goles').value = stats.goles || 0;
    document.getElementById('edit-stats-mvps').value = stats.mvps || 0;

    document.getElementById('btn-guardar-stats').onclick = () => {
      const partidos = Math.max(0, Number(document.getElementById('edit-stats-partidos').value) || 0);
      const goles    = Math.max(0, Number(document.getElementById('edit-stats-goles').value) || 0);
      const mvps     = Math.max(0, Number(document.getElementById('edit-stats-mvps').value) || 0);

      actualizarUsuario(u.id, {
        stats: { partidos, goles, mvps }
      });

      cerrarModal('modal-editar-stats');
      toast('Estadísticas actualizadas', 'success');
      render();
    };

    document.querySelectorAll('#modal-editar-stats [data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-editar-stats');
    });
    document.getElementById('modal-editar-stats').onclick = (e) => {
      if (e.target.id === 'modal-editar-stats') cerrarModal('modal-editar-stats');
    };

    abrirModal('modal-editar-stats');
  }

  /* =========================================================
     CONECTAR BOTONES
     ========================================================= */
  document.getElementById('btn-editar-perfil')?.addEventListener('click', abrirModalEditar);
  document.getElementById('btn-editar-stats')?.addEventListener('click', abrirModalEditarStats);

  // Toggle stats privadas
  chkStatsPriv?.addEventListener('change', () => {
    const u = getSesion();
    if (!u) return;
    actualizarUsuario(u.id, { statsPrivadas: chkStatsPriv.checked });
    toast(chkStatsPriv.checked ? 'Stats privadas' : 'Stats públicas', 'info');
  });

  /* =========================================================
     INIT
     ========================================================= */
  render();

  return null;
}