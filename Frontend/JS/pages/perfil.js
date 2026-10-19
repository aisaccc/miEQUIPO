import { mismoId } from '../utils/id.js';
import { getSesion } from '../auth.js';
import {
  toast,
  abrirModal,
  cerrarModal,
  formatearFecha,
} from '../components.js';
import {
  deportes as todosLosDeportes,
  posicionesPorDeporte
} from '../data-mock.js';
import { statsPorDeporte } from '../stats-por-deporte.js';
import { getPartidos } from '../store.js';
import { ICONOS } from '../utils/iconos.js';
import {
  obtenerMiPerfil,
  actualizarMiPerfil,
  actualizarMisDeportes,
} from '../services/usuarios.service.js';
import { obtenerHistorialPartidos } from '../services/partidos.service.js';
import { listarPublicacionesDe } from '../services/publicaciones.service.js';

import {
  renderFeedPublicaciones,
  abrirModalCrearPublicacionCompartido
} from '../utils/publicaciones-ui.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

const PAISES = [
  'Argentina', 'Bolivia', 'Brasil', 'Canadá', 'Chile', 'Colombia',
  'Costa Rica', 'Cuba', 'Ecuador', 'El Salvador', 'España', 'Estados Unidos',
  'Guatemala', 'Honduras', 'México', 'Nicaragua', 'Panamá', 'Paraguay',
  'Perú', 'Portugal', 'Puerto Rico', 'República Dominicana', 'Uruguay',
  'Venezuela', 'Otro'
];

const HERO_COLORS = [
  { key: 'navy',    label: 'Navy',     from: '#0F1B2D', to: '#1E2D45', text: 'light' },
  { key: 'black',   label: 'Negro',    from: '#0A0A0A', to: '#1F1F1F', text: 'light' },
  { key: 'carbon',  label: 'Carbón',   from: '#1F2937', to: '#374151', text: 'light' },
  { key: 'blue',    label: 'Azul',     from: '#1E3A8A', to: '#2563EB', text: 'light' },
  { key: 'forest',  label: 'Bosque',   from: '#064E3B', to: '#047857', text: 'light' },
  { key: 'purple',  label: 'Púrpura',  from: '#4C1D95', to: '#7C3AED', text: 'light' },
  { key: 'wine',    label: 'Vino',     from: '#7F1D1D', to: '#B91C1C', text: 'light' },
  { key: 'coffee',  label: 'Café',     from: '#451A03', to: '#78350F', text: 'light' },
  { key: 'mustard', label: 'Mostaza',  from: '#92400E', to: '#CA8A04', text: 'light' },
  { key: 'red',     label: 'Rojo',     from: '#DC2626', to: '#EF4444', text: 'light' },
  { key: 'orange',  label: 'Naranjo',  from: '#EA580C', to: '#FB923C', text: 'light' },
  { key: 'white',   label: 'Blanco',   from: '#FFFFFF', to: '#F5F5F5', text: 'dark'  },
];

export async function init() {
  // 1. Intentar obtener datos frescos del backend
  let user = getSesion();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }

  try {
    user = await obtenerMiPerfil();
  } catch (err) {
    console.warn('[perfil] No se pudo obtener el perfil del backend, usando sesión local:', err.message);
    // Mantenemos el `user` que sacamos de getSesion()
  }

  // Referencias al DOM...
  const elHero            = document.getElementById('perfil-hero');
  const elAvatar          = document.getElementById('perfil-avatar');
  const elNombre          = document.getElementById('perfil-nombre');
  const elUsername        = document.getElementById('perfil-username');
  const elBio             = document.getElementById('perfil-bio');
  const elMetaChips       = document.getElementById('perfil-meta-chips');
  const elDeportesChips   = document.getElementById('perfil-deportes-chips');
  const elStatsHero       = document.getElementById('perfil-stats-hero');
  const elDeportesLista   = document.getElementById('perfil-deportes-lista');
  const elStatsDeportes   = document.getElementById('perfil-stats-deportes');
  const elPubsGrid        = document.getElementById('perfil-publicaciones-grid');

  const elHistorial       = document.getElementById('perfil-historial');
  const elHistorialCount  = document.getElementById('historial-count');
  const elHistorialCargar = document.getElementById('historial-cargar-mas-wrapper');
  const chipsHistRol      = document.querySelectorAll('[data-hist-rol]');
  const selHistDeporte    = document.getElementById('historial-deporte');
  const inputHistDesde    = document.getElementById('historial-desde');
  const inputHistHasta    = document.getElementById('historial-hasta');
  const btnHistLimpiar    = document.getElementById('btn-limpiar-filtros');
  const btnHistCargarMas  = document.getElementById('btn-historial-cargar-mas');

  const subtabsPerfil      = document.querySelectorAll('[data-tab-perfil]');
  const panelPublicaciones = document.getElementById('panel-perfil-publicaciones');
  const panelActividad     = document.getElementById('panel-perfil-actividad');
  const panelHistorial     = document.getElementById('panel-perfil-historial');

  const AVATARES = Array.from({ length: 20 }, (_, i) => `https://i.pravatar.cc/150?img=${i + 1}`);

  let histFiltros = { rol: 'todos', deporte: '', desde: '', hasta: '' };
  let histPagina = 1;
  let histPartidos = [];
  let histCargando = false;
  let tabActual = 'publicaciones';
  let publicacionesCache = [];

  function aplicarColorHero(colorKey) {
    if (!elHero) return;
    const preset = HERO_COLORS.find(c => c.key === colorKey) || HERO_COLORS[0];
    elHero.dataset.heroColor = preset.key;
    elHero.style.background = `linear-gradient(135deg, ${preset.from} 0%, ${preset.to} 100%)`;
    elHero.classList.toggle('perfil-hero--dark-text', preset.text === 'dark');
  }

  // ⚡ FIX: render ahora recibe el usuario por parámetro para no volver a pedirlo
  async function render(u) {
    if (!u) {
      u = { nombre: 'Usuario', username: 'usuario', id: null, heroColor: 'navy' };
    }

    aplicarColorHero(u.heroColor || 'navy');

    if (elAvatar) {
      elAvatar.src = u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre || 'U')}&background=ff6a00&color=fff&size=200`;
    }
    
    if (elNombre) elNombre.textContent = u.nombre || 'Usuario';
    
    if (elUsername) {
      const partes = ['@' + (u.username || 'usuario')];
      if (u.ciudad || u.pais) {
        const lugar = [u.ciudad, u.pais].filter(Boolean).join(', ');
        partes.push(lugar);
      }
      elUsername.textContent = partes.join(' · ');
    }

    if (elBio) {
      elBio.textContent = u.bio || 'Sin biografía todavía.';
      elBio.style.opacity = u.bio ? '0.85' : '0.55';
      elBio.style.fontStyle = u.bio ? 'normal' : 'italic';
    }

    if (elMetaChips) {
      const chips = [];
      if (u.edad) chips.push(`${ICONOS.calendario} ${u.edad} años`);
      if (u.pais) chips.push(`${ICONOS.mundo} ${u.pais}`);
      elMetaChips.innerHTML = chips.map(t => `<span class="perfil-hero__chip">${t}</span>`).join('');
    }

    if (elDeportesChips) {
      const misDeportes = u.deportes || [];
      if (misDeportes.length === 0) {
        elDeportesChips.innerHTML = '';
      } else {
        elDeportesChips.innerHTML = misDeportes.map(d =>
          `<span class="perfil-hero__chip perfil-hero__chip--deporte">${d.deporte}</span>`
        ).join('');
      }
    }

    renderStatsHero(u);
    await renderPublicaciones(u);
    renderDeportesLista(u);
    renderStatsDeportes(u);

    await cargarHistorial(true);
    poblarSelectDeportesHistorial();

    cambiarTabPerfil(tabActual);
  }

  // ... (las funciones cambiarTabPerfil, renderStatsHero, iconoDeporte, iconoDeporteHistorial, cargarHistorial, renderHistorial, renderCardHistorial, poblarSelectDeportesHistorial, conectarEventosHistorial, abrirModalEditarStatsDeporte quedan exactamente igual) ...

  async function renderPublicaciones(u) {
    if (!elPubsGrid) return;

    // ⚡ FIX: Si no hay ID válido (es null o undefined), no consultamos el backend
    if (!u.id) {
      elPubsGrid.innerHTML = `
        <div class="card">
          <div class="empty-state" style="padding:var(--space-5)">
            <div class="empty-state__icon" style="font-size:36px">${ICONOS.carpeta}</div>
            <p class="text-sm text-muted">Inicia sesión para ver tus publicaciones.</p>
          </div>
        </div>`;
      return;
    }

    elPubsGrid.innerHTML = `
      <div class="page-loader">
        <div class="spinner"></div>
        <span>Cargando publicaciones...</span>
      </div>`;

    try {
      publicacionesCache = await listarPublicacionesDe(u.id);
    } catch (err) {
      console.error('[perfil] Error al cargar publicaciones:', err);
      elPubsGrid.innerHTML = `
        <div class="card">
          <div class="empty-state" style="padding:var(--space-5)">
            <div class="empty-state__icon" style="font-size:36px">${ICONOS.alerta}</div>
            <p class="text-sm text-muted">No se pudieron cargar las publicaciones</p>
          </div>
        </div>`;
      return;
    }

    const esMiPerfil = String(u.id) === String(getSesion()?.id);

    const headerHtml = esMiPerfil ? `
      <div class="perfil-pubs-header mb-4" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <h3 class="card__title" style="margin:0">Mis publicaciones</h3>
        <button class="btn btn--primary btn--sm" id="btn-nueva-publicacion">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva publicación
        </button>
      </div>
    ` : '';

    elPubsGrid.innerHTML = `${headerHtml}<div id="perfil-feed-container"></div>`;
    const feedCont = document.getElementById('perfil-feed-container');

    renderFeedPublicaciones(feedCont, publicacionesCache, {
      onRefrescar: () => renderPublicaciones(u)
    });

    document.getElementById('btn-nueva-publicacion')?.addEventListener('click', () => {
      abrirModalCrearPublicacionCompartido('perfil', null, () => renderPublicaciones(u), { tipo: 'post' });
    });
  }

  // ... (las funciones renderDeportesLista, renderStatsDeportes quedan igual) ...

  function abrirModalEditar() {
    const u = getSesion();
    if (!u) return;

    document.getElementById('edit-perf-nombre').value = u.nombre || '';
    document.getElementById('edit-perf-username').value = u.username || '';
    document.getElementById('edit-perf-bio').value = u.bio || '';
    document.getElementById('edit-perf-ciudad').value = u.ciudad || '';

    const inputEdad = document.getElementById('edit-perf-edad');
    if (inputEdad) inputEdad.value = u.edad || '';

    const selPais = document.getElementById('edit-perf-pais');
    if (selPais) {
      selPais.innerHTML = '<option value="">Selecciona un país...</option>' +
        PAISES.map(p => `<option value="${p}" ${p === u.pais ? 'selected' : ''}>${p}</option>`).join('');
    }

    const previewAvatar = document.getElementById('edit-perf-avatar-preview');
    previewAvatar.src = u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre || 'U')}&background=ff6a00&color=fff&size=200`;
    let avatarSel = u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre || 'U')}&background=ff6a00&color=fff&size=200`;

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

    const activo = contAv.querySelector('.posicion-chip.active');
    if (activo) activo.style.background = 'var(--color-primary-light)';

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
          contAv.querySelectorAll('[data-avatar]').forEach(b => {
            b.classList.remove('active');
            b.style.background = 'transparent';
          });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
      };
    }

    const btnQuitar = document.getElementById('edit-perf-avatar-quitar');
    if (btnQuitar) {
      btnQuitar.onclick = () => {
        avatarSel = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre || 'U')}&background=ff6a00&color=fff&size=200`;
        previewAvatar.src = avatarSel;
        contAv.querySelectorAll('[data-avatar]').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
        });
      };
    }

    let colorSel = u.heroColor || 'navy';
    const contColores = document.getElementById('edit-perf-hero-colores');
    if (contColores) {
      contColores.innerHTML = HERO_COLORS.map(c => `
        <button type="button"
                class="perfil-color-btn ${c.key === colorSel ? 'active' : ''}"
                data-color="${c.key}"
                title="${c.label}"
                style="background: linear-gradient(135deg, ${c.from} 0%, ${c.to} 100%)"></button>
      `).join('');

      contColores.querySelectorAll('[data-color]').forEach(btn => {
        btn.addEventListener('click', () => {
          contColores.querySelectorAll('[data-color]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          colorSel = btn.dataset.color;
        });
      });
    }

    const base = u.statsHeroBase || {};
    const privadas = u.statsHeroPrivadas || {};

    const inputBasePartidos = document.getElementById('edit-perf-base-partidos');
    if (inputBasePartidos) inputBasePartidos.value = base.partidos || 0;

    const chkPrivPartidos = document.getElementById('edit-perf-priv-partidos');
    const chkPrivTorneos  = document.getElementById('edit-perf-priv-torneos');
    const chkPrivEquipos  = document.getElementById('edit-perf-priv-equipos');

    if (chkPrivPartidos) chkPrivPartidos.checked = privadas.partidos === true;
    if (chkPrivTorneos)  chkPrivTorneos.checked  = privadas.torneos === true;
    if (chkPrivEquipos)  chkPrivEquipos.checked  = privadas.equipos === true;

    let deportesActuales = JSON.parse(JSON.stringify(u.deportes || []));

    const selNuevoDeporte = document.getElementById('edit-perf-nuevo-deporte');
    const contDeportes = document.getElementById('edit-perf-deportes-lista');

    function refrescarSelectDeportes() {
      const elegidos = new Set(deportesActuales.map(d => d.deporte));
      selNuevoDeporte.innerHTML = '<option value="">Agregar deporte...</option>' +
        todosLosDeportes
          .filter(d => !elegidos.has(d))
          .map(d => `<option value="${d}">${d}</option>`).join('');
    }

    function renderDeportesElegidos() {
      if (deportesActuales.length === 0) {
        contDeportes.innerHTML = `
          <div class="empty-state--sm">
            <div class="empty-state__icon">${ICONOS.medalla}</div>
            <p class="text-sm text-muted">Aún no agregaste deportes</p>
          </div>`;
        return;
      }

      contDeportes.innerHTML = deportesActuales.map((d, idx) => {
        const posicionesDisponibles = posicionesPorDeporte[d.deporte] || [];
        const tienePosiciones = posicionesDisponibles.length > 0;

        return `
          <div class="card" style="padding:var(--space-3); background:var(--color-surface-2); border:none">
            <div class="flex items-center justify-between mb-2">
              <div style="font-weight:700; font-size:var(--fs-sm)">${d.deporte}</div>
              <button class="btn btn--ghost btn--sm" data-quitar-deporte="${idx}" style="color:var(--color-danger)">✕</button>
            </div>

            ${tienePosiciones ? `
              <div style="font-size:var(--fs-xs); color:var(--color-text-muted); margin-bottom:6px">
                Posiciones (opcional, varias):
              </div>
              <div class="posiciones-lista" style="padding:8px; gap:6px">
                ${posicionesDisponibles.map(p => `
                  <button type="button"
                          class="posicion-chip ${(d.posiciones || []).includes(p) ? 'active' : ''}"
                          data-pos-idx="${idx}"
                          data-pos-nombre="${p}"
                          style="font-size:11px; padding:4px 10px">
                    ${p}
                  </button>
                `).join('')}
              </div>
            ` : `<p class="text-xs text-muted">Este deporte no tiene posiciones</p>`}
          </div>
        `;
      }).join('');

      contDeportes.querySelectorAll('[data-quitar-deporte]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.quitarDeporte);
          deportesActuales.splice(idx, 1);
          renderDeportesElegidos();
          refrescarSelectDeportes();
        });
      });

      contDeportes.querySelectorAll('[data-pos-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.posIdx);
          const pos = btn.dataset.posNombre;
          const lista = deportesActuales[idx].posiciones || (deportesActuales[idx].posiciones = []);

          if (lista.includes(pos)) {
            deportesActuales[idx].posiciones = lista.filter(p => p !== pos);
            btn.classList.remove('active');
          } else {
            lista.push(pos);
            btn.classList.add('active');
          }
        });
      });
    }

    renderDeportesElegidos();
    refrescarSelectDeportes();

    document.getElementById('edit-perf-add-deporte').onclick = () => {
      const dep = selNuevoDeporte.value;
      if (!dep) return;

      if (deportesActuales.some(d => d.deporte === dep)) {
        return toast('Ese deporte ya está agregado', 'error');
      }

      deportesActuales.push({ deporte: dep, posiciones: [], stats: {} });
      renderDeportesElegidos();
      refrescarSelectDeportes();
    };

    document.getElementById('btn-guardar-perfil').onclick = async () => {
      const nombre = document.getElementById('edit-perf-nombre').value.trim();
      const username = document.getElementById('edit-perf-username').value.trim();
      const bio = document.getElementById('edit-perf-bio').value.trim();
      const ciudad = document.getElementById('edit-perf-ciudad').value.trim();
      const edad = Number(document.getElementById('edit-perf-edad').value) || null;
      const pais = document.getElementById('edit-perf-pais').value;

      if (!nombre) return toast('El nombre no puede estar vacío', 'error');
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return toast('El usuario debe tener 3-20 caracteres (letras, números, _)', 'error');
      }

      const btn = document.getElementById('btn-guardar-perfil');
      btn.disabled = true;
      btn.textContent = 'Guardando...';

      try {
        await actualizarMiPerfil({
          nombre,
          username,
          bio: bio || null,
          ciudad: ciudad || null,
          edad,
          pais: pais || null,
          avatar: avatarSel || null,
          heroColor: colorSel,
          statsHeroBase: {
            partidos: Math.max(0, Number(inputBasePartidos?.value) || 0),
          },
          statsHeroPrivadas: {
            partidos: !!chkPrivPartidos?.checked,
            torneos:  !!chkPrivTorneos?.checked,
            equipos:  !!chkPrivEquipos?.checked,
          },
        });

        const usuarioActual = getSesion();
        const deportesPrevios = usuarioActual.deportes || [];

        const deportesFinales = deportesActuales.map(d => {
          const anterior = deportesPrevios.find(x => x.deporte === d.deporte);
          return {
            deporte: d.deporte,
            posiciones: d.posiciones || [],
            stats: anterior?.stats || {},
          };
        });

        await actualizarMisDeportes(deportesFinales);

        cerrarModal('modal-editar-perfil');
        toast('Perfil actualizado', 'success');

        // ⚡ FIX: Actualizamos la variable local `user` con los nuevos datos y volvemos a renderizar
        user = getSesion(); 
        await render(user); 
      } catch (err) {
        console.error('[perfil] Error al guardar:', err);
        toast(err.message || 'No se pudo guardar el perfil', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar cambios';
      }
    };

    document.querySelectorAll('#modal-editar-perfil [data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-editar-perfil');
    });
    document.getElementById('modal-editar-perfil').onclick = (e) => {
      if (e.target.id === 'modal-editar-perfil') cerrarModal('modal-editar-perfil');
    };

    abrirModal('modal-editar-perfil');
  }

  function abrirModalEditarStatsDeporte(nombreDeporte) {
    // ... (igual que antes)
    const u = getSesion();
    if (!u) return;

    const deporteData = (u.deportes || []).find(d => d.deporte === nombreDeporte);
    if (!deporteData) return;

    const statsDisponibles = statsPorDeporte[nombreDeporte] || [];
    const statsUsuario = deporteData.stats || {};

    document.getElementById('stats-deporte-titulo').textContent = `Stats de ${nombreDeporte}`;

    const contenedor = document.getElementById('stats-deporte-campos');

    if (statsDisponibles.length === 0) {
      contenedor.innerHTML = `
        <p class="text-sm text-muted text-center" style="padding:var(--space-5)">
          Este deporte no tiene estadísticas disponibles
        </p>`;
    } else {
      contenedor.innerHTML = statsDisponibles.map(s => {
        const stat = statsUsuario[s.clave] || { valor: 0, publico: false };
        return `
          <div class="field">
            <div class="flex items-center justify-between mb-2">
              <label class="field__label" style="margin:0" for="stat-${s.clave}">
                ${s.nombre}
              </label>
              <label class="switch" style="margin:0">
                <input type="checkbox" id="stat-publico-${s.clave}" ${stat.publico ? 'checked' : ''} />
                <span class="switch__slider"></span>
                <div>
                  <div class="switch__label" style="font-size:11px">Público</div>
                </div>
              </label>
            </div>
            <input type="number" id="stat-${s.clave}" class="field__input" min="0" value="${stat.valor || 0}" />
          </div>
        `;
      }).join('');
    }

    document.getElementById('btn-guardar-stats-deporte').onclick = async () => {
      const nuevasStats = {};
      statsDisponibles.forEach(s => {
        const inputValor = document.getElementById(`stat-${s.clave}`);
        const chkPublico = document.getElementById(`stat-publico-${s.clave}`);
        if (!inputValor) return;

        nuevasStats[s.clave] = {
          valor: Math.max(0, Number(inputValor.value) || 0),
          publico: chkPublico?.checked || false,
        };
      });

      const usuarioActual = getSesion();
      const deportesActuales = usuarioActual.deportes || [];
      const deportesActualizados = deportesActuales.map(d =>
        d.deporte === nombreDeporte ? { ...d, stats: nuevasStats } : d
      );

      const btn = document.getElementById('btn-guardar-stats-deporte');
      btn.disabled = true;
      btn.textContent = 'Guardando...';

      try {
        await actualizarMisDeportes(deportesActualizados);
        cerrarModal('modal-editar-stats-deporte');
        toast(`Stats de ${nombreDeporte} actualizadas`, 'success');
        
        // ⚡ FIX: Actualizamos variable local
        user = getSesion();
        await render(user);
      } catch (err) {
        console.error('[perfil] Error al guardar stats:', err);
        toast(err.message || 'No se pudieron guardar las stats', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar';
      }
    };

    document.querySelectorAll('#modal-editar-stats-deporte [data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-editar-stats-deporte');
    });
    document.getElementById('modal-editar-stats-deporte').onclick = (e) => {
      if (e.target.id === 'modal-editar-stats-deporte') cerrarModal('modal-editar-stats-deporte');
    };

    abrirModal('modal-editar-stats-deporte');
  }

  // ... (las funciones renderDeportesLista, renderStatsDeportes que no cambian) ...

  document.getElementById('btn-editar-perfil')?.addEventListener('click', abrirModalEditar);
  document.getElementById('btn-editar-deportes')?.addEventListener('click', abrirModalEditar);

  conectarEventosHistorial();

  // ⚡ Arrancamos el render con el usuario que ya obtuvimos
  await render(user);

  return null;
}