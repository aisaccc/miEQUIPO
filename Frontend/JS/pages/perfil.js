import { mismoId } from '../utils/id.js';
import { getSesion } from '../auth.js';
import { toast, abrirModal, cerrarModal, formatearFecha } from '../components.js';
import { deportes as todosLosDeportes, posicionesPorDeporte } from '../data-mock.js';
import { statsPorDeporte } from '../stats-por-deporte.js';
import { ICONOS } from '../utils/iconos.js';
import { obtenerMiPerfil, actualizarMiPerfil, actualizarMisDeportes } from '../services/usuarios.service.js';
import { listarPublicacionesDe } from '../services/publicaciones.service.js';
import { renderFeedPublicaciones, abrirModalCrearPublicacionCompartido } from '../utils/publicaciones-ui.js';

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

const MARCOS_PERFIL = [
  { id: 'default', nombre: 'Normal', clase: '' },
  { id: 'oro', nombre: 'Oro', clase: 'marco-oro' },
  { id: 'fuego', nombre: 'Fuego', clase: 'marco-fuego' },
  { id: 'neon', nombre: 'Neón', clase: 'marco-neon' },
  { id: 'hielo', nombre: 'Hielo', clase: 'marco-hielo' },
  { id: 'galaxia', nombre: 'Galaxia', clase: 'marco-galaxia' },
  { id: 'custom', nombre: 'Personalizado', clase: 'marco-custom' }
];

export async function init() {
  let user = getSesion();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }

  try {
    const perfilBackend = await obtenerMiPerfil();
    if (perfilBackend && perfilBackend.id) user = perfilBackend;
  } catch (err) {
    console.warn('[perfil] Error del backend. Manteniendo sesión local:', err.message);
  }

  const elHero = document.getElementById('perfil-hero');
  const elAvatar = document.getElementById('perfil-avatar');
  const elNombre = document.getElementById('perfil-nombre');
  const elUsername = document.getElementById('perfil-username');
  const elBio = document.getElementById('perfil-bio');
  const elMetaChips = document.getElementById('perfil-meta-chips');
  const elDeportesChips = document.getElementById('perfil-deportes-chips');
  const elStatsHero = document.getElementById('perfil-stats-hero');
  const elDeportesLista = document.getElementById('perfil-deportes-lista');
  const elStatsDeportes = document.getElementById('perfil-stats-deportes');
  const elPubsGrid = document.getElementById('perfil-publicaciones-grid');

  const subtabsPerfil = document.querySelectorAll('[data-tab-perfil]');
  const panelPublicaciones = document.getElementById('panel-perfil-publicaciones');
  const panelActividad = document.getElementById('panel-perfil-actividad');

  let tabActual = 'publicaciones';
  let publicacionesCache = [];

  async function render(u) {
    if (!u || !u.id) u = getSesion();
    if (!u) u = { nombre: 'Usuario', username: 'usuario', id: null, heroColor: 'navy' };

    if (elHero) {
      if (u.heroFoto) {
        elHero.style.backgroundImage = `linear-gradient(180deg, rgba(15,27,45,0.10) 0%, rgba(15,27,45,0.55) 100%), url('${u.heroFoto}')`;
        elHero.style.backgroundSize = 'cover';
        elHero.style.backgroundPosition = 'center';
        elHero.style.backgroundRepeat = 'no-repeat';
      } else if (u.heroColor && u.heroColor.startsWith('#')) {
        elHero.style.backgroundImage = `linear-gradient(135deg, ${u.heroColor} 0%, ${u.heroColor}DD 100%)`;
        elHero.style.backgroundSize = '';
        elHero.style.backgroundPosition = '';
        elHero.style.backgroundRepeat = '';
      } else {
        const preset = HERO_COLORS.find(c => c.key === (u.heroColor || 'navy')) || HERO_COLORS[0];
        elHero.style.backgroundImage = `linear-gradient(135deg, ${preset.from} 0%, ${preset.to} 100%)`;
        elHero.style.backgroundSize = '';
        elHero.style.backgroundPosition = '';
        elHero.style.backgroundRepeat = '';
      }
    }

    if (elAvatar) {
      elAvatar.src = u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre || 'U')}&background=ff6a00&color=fff&size=200`;
      
      const marco = MARCOS_PERFIL.find(m => m.id === (u.marcoPerfil || 'default'));
      elAvatar.className = 'perfil-header-card__avatar ' + (marco?.clase || '');
      
      if (u.marcoPerfil === 'custom' && u.marcoColor) {
        elAvatar.style.borderColor = u.marcoColor;
        elAvatar.style.boxShadow = `0 0 15px ${u.marcoColor}80`;
      } else {
        elAvatar.style.borderColor = '';
        elAvatar.style.boxShadow = '';
      }
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
      elDeportesChips.innerHTML = misDeportes.length === 0 ? '' : misDeportes.map(d => `<span class="perfil-hero__chip perfil-hero__chip--deporte">${d.deporte}</span>`).join('');
    }

    renderStatsHero(u);
    await renderPublicaciones(u);
    renderDeportesLista(u);
    renderStatsDeportes(u);
    cambiarTabPerfil(tabActual);
  }

  function cambiarTabPerfil(tab) {
    tabActual = tab;
    subtabsPerfil.forEach(st => st.classList.toggle('subtab--active', st.dataset.tabPerfil === tab));
    panelPublicaciones?.classList.toggle('subpanel--active', tab === 'publicaciones');
    panelActividad?.classList.toggle('subpanel--active', tab === 'actividad');
  }

  subtabsPerfil.forEach(st => st.addEventListener('click', () => cambiarTabPerfil(st.dataset.tabPerfil)));

  function renderStatsHero(u) {
    if (!elStatsHero) return;
    const base = u.statsHeroBase || {};
    const auto = u.statsHero || { partidos: 0, torneos: 0, equipos: 0 };
    const partidos = (Number(base.partidos) || 0) + (auto.partidos || 0);
    const torneos = auto.torneos || 0;
    const equipos = auto.equipos || 0;

    elStatsHero.innerHTML = `
      <div class="profile-stat-card"><div class="profile-stat-card__value">${partidos}</div><div class="profile-stat-card__label">Partidos</div></div>
      <div class="profile-stat-card"><div class="profile-stat-card__value">${torneos}</div><div class="profile-stat-card__label">Torneos</div></div>
      <div class="profile-stat-card"><div class="profile-stat-card__value">${equipos}</div><div class="profile-stat-card__label">Equipos</div></div>
    `;
  }

  async function renderPublicaciones(u) {
    if (!elPubsGrid) return;
    if (!u.id) {
      elPubsGrid.innerHTML = `<div class="card"><div class="empty-state" style="padding:var(--space-5)"><div class="empty-state__icon" style="font-size:36px">${ICONOS.carpeta}</div><p class="text-sm text-muted">Inicia sesión para ver tus publicaciones.</p></div></div>`;
      return;
    }
    elPubsGrid.innerHTML = `<div class="page-loader"><div class="spinner"></div><span>Cargando publicaciones...</span></div>`;

    try {
      publicacionesCache = await listarPublicacionesDe(u.id);
    } catch (err) {
      elPubsGrid.innerHTML = `<div class="card"><div class="empty-state" style="padding:var(--space-5)"><div class="empty-state__icon" style="font-size:36px">${ICONOS.alerta}</div><p class="text-sm text-muted">No se pudieron cargar las publicaciones</p></div></div>`;
      return;
    }

    const esMiPerfil = String(u.id) === String(getSesion()?.id);
    const headerHtml = esMiPerfil ? `
      <div class="perfil-pubs-header mb-4" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <h3 class="card__title" style="margin:0">Mis publicaciones</h3>
        <button class="btn btn--primary btn--sm" id="btn-nueva-publicacion">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nueva publicación
        </button>
      </div>` : '';

    elPubsGrid.innerHTML = `${headerHtml}<div id="perfil-feed-container"></div>`;
    const feedCont = document.getElementById('perfil-feed-container');
    renderFeedPublicaciones(feedCont, publicacionesCache, { onRefrescar: () => renderPublicaciones(u) });

    document.getElementById('btn-nueva-publicacion')?.addEventListener('click', () => {
      abrirModalCrearPublicacionCompartido('perfil', null, () => renderPublicaciones(u), { tipo: 'post' });
    });
  }

  function renderDeportesLista(u) {
    if (!elDeportesLista) return;
    const misDeportes = u.deportes || [];
    if (misDeportes.length === 0) {
      elDeportesLista.innerHTML = `<div class="empty-state--sm"><div class="empty-state__icon">${ICONOS.medalla}</div><p class="text-sm text-muted">Aún no agregaste deportes</p></div>`;
      return;
    }
    elDeportesLista.innerHTML = misDeportes.map(d => {
      const posiciones = (d.posiciones || []).join(', ') || 'Sin posiciones';
      return `<div class="feed-item" style="cursor:default"><div class="feed-item__icon">${iconoDeporte(d.deporte)}</div><div style="flex:1; min-width:0"><div class="feed-item__title">${d.deporte}</div><div class="feed-item__subtitle">${posiciones}</div></div></div>`;
    }).join('');
  }

// Busca la función renderStatsDeportes y cámbiala por esta:
  function renderStatsDeportes(u) {
    if (!elStatsDeportes) return;
    const misDeportes = u.deportes || [];
    if (misDeportes.length === 0) {
      elStatsDeportes.innerHTML = `<div class="card"><h3 class="card__title mb-4" style="display:flex; align-items:center; gap:6px">${ICONOS.grafico} Mis estadísticas</h3><div class="empty-state" style="padding:var(--space-5)"><div class="empty-state__icon" style="font-size:36px">${ICONOS.grafico}</div><p class="text-sm text-muted">Agrega un deporte en tu perfil para llevar estadísticas</p></div></div>`;
      return;
    }
    elStatsDeportes.innerHTML = misDeportes.map(d => {
      const statsDisponibles = statsPorDeporte[d.deporte] || [];
      const statsUsuario = d.stats || {};
      const icono = iconoDeporte(d.deporte);
      
      // ⚡ FIX: Chequeo flexible para strings y números
      const cargadas = statsDisponibles.filter(s => {
        const val = statsUsuario[s.clave]?.valor;
        return val !== undefined && val !== null && val !== '' && val !== 0 && val !== '0';
      });

      return `
        <div class="card mb-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="card__title" style="margin:0; display:flex; align-items:center; gap:6px">${icono} Estadísticas de ${d.deporte}</h3>
            <button class="btn btn--ghost btn--sm" data-editar-stats-deporte="${d.deporte}" style="display:flex; align-items:center; gap:6px">
              ${ICONOS.lapiz} Editar 
              ${!u.esPremium ? '<span class="badge badge--warning" style="margin-left:4px; font-size:10px; padding:2px 6px;">Premium</span>' : ''}
            </button>
          </div>
          ${cargadas.length === 0 ? `<div class="empty-state--sm"><div class="empty-state__icon">${ICONOS.grafico}</div><p class="text-sm text-muted">Sin registros cargados todavía</p></div>` : `
            <div class="stats-grid" style="grid-template-columns:repeat(auto-fit, minmax(120px, 1fr))">
              ${statsDisponibles.map(s => {
                const stat = statsUsuario[s.clave];
                if (!stat || stat.valor === undefined || stat.valor === null || stat.valor === '' || stat.valor === 0 || stat.valor === '0') return '';
                const esPrivada = !stat.publico;
                return `<div class="stat-box" style="position:relative"><div class="stat-box__value">${stat.valor}</div><div class="stat-box__label">${s.nombre}</div>${esPrivada ? `<span style="position:absolute; top:6px; right:6px; color:var(--color-text-muted)" title="Privado">${ICONOS.candado}</span>` : ''}</div>`;
              }).join('')}
            </div>
          `}
        </div>`;
    }).join('');

    elStatsDeportes.querySelectorAll('[data-editar-stats-deporte]').forEach(btn => {
      btn.addEventListener('click', () => abrirModalEditarStatsDeporte(btn.dataset.editarStatsDeporte));
    });
  }

// Busca la función abrirModalEditarStatsDeporte y cámbiala por esta:
  function abrirModalEditarStatsDeporte(nombreDeporte) {
    const u = getSesion();
    if (!u) return;
    
    if (!u.esPremium) {
      toast('La edición de estadísticas por deporte es exclusiva de Premium.', 'error');
      return;
    }

    const deporteData = (u.deportes || []).find(d => d.deporte === nombreDeporte);
    if (!deporteData) return;

    const statsDisponibles = statsPorDeporte[nombreDeporte] || [];
    const statsUsuario = deporteData.stats || {};
    document.getElementById('stats-deporte-titulo').textContent = `Stats de ${nombreDeporte}`;
    const contenedor = document.getElementById('stats-deporte-campos');

    if (statsDisponibles.length === 0) {
      contenedor.innerHTML = `<p class="text-sm text-muted text-center" style="padding:var(--space-5)">Este deporte no tiene estadísticas disponibles</p>`;
    } else {
      contenedor.innerHTML = statsDisponibles.map(s => {
        const stat = statsUsuario[s.clave] || { valor: '', publico: false };
        
        // ⚡ NUEVO: Renderizado dinámico según el tipo
        let inputHtml = '';
        if (s.tipo === 'entero') {
          inputHtml = `<input type="number" step="1" min="0" id="stat-${s.clave}" class="field__input" value="${stat.valor || ''}" placeholder="Ej: 5" />`;
        } else if (s.tipo === 'decimal') {
          inputHtml = `<input type="number" step="0.01" min="0" id="stat-${s.clave}" class="field__input" value="${stat.valor || ''}" placeholder="Ej: 10.5" />`;
        } else {
          // Tiempos o textos
          inputHtml = `<input type="text" id="stat-${s.clave}" class="field__input" value="${stat.valor || ''}" placeholder="${s.tipo === 'tiempo' ? 'Ej: 10:30' : 'Ej: V5'}" />`;
        }

        return `
          <div class="field">
            <div class="flex items-center justify-between mb-2">
              <label class="field__label" style="margin:0" for="stat-${s.clave}">${s.nombre}</label>
              <label class="switch" style="margin:0"><input type="checkbox" id="stat-publico-${s.clave}" ${stat.publico ? 'checked' : ''} /><span class="switch__slider"></span><div><div class="switch__label" style="font-size:11px">Público</div></div></label>
            </div>
            ${inputHtml}
          </div>`;
      }).join('');
    }

    document.getElementById('btn-guardar-stats-deporte').onclick = async () => {
      const nuevasStats = {};
      statsDisponibles.forEach(s => {
        const inputValor = document.getElementById(`stat-${s.clave}`);
        const chkPublico = document.getElementById(`stat-publico-${s.clave}`);
        if (!inputValor) return;

        let valorFinal = inputValor.value.trim();
        
        // ⚡ NUEVO: Validación según el tipo al guardar
        if (s.tipo === 'entero') {
          valorFinal = Math.max(0, parseInt(valorFinal) || 0);
        } else if (s.tipo === 'decimal') {
          valorFinal = valorFinal === '' ? '' : Math.max(0, parseFloat(valorFinal) || 0);
        }
        // Si es 'tiempo' o 'texto', se guarda el string tal cual (ej. "10:30")

        nuevasStats[s.clave] = { valor: valorFinal, publico: chkPublico?.checked || false };
      });

      const usuarioActual = getSesion();
      const deportesActuales = usuarioActual.deportes || [];
      const deportesActualizados = deportesActuales.map(d => d.deporte === nombreDeporte ? { ...d, stats: nuevasStats } : d);

      const btn = document.getElementById('btn-guardar-stats-deporte');
      btn.disabled = true; btn.textContent = 'Guardando...';

      try {
        await actualizarMisDeportes(deportesActualizados);
        cerrarModal('modal-editar-stats-deporte');
        toast(`Stats de ${nombreDeporte} actualizadas`, 'success');
        user = getSesion(); await render(user);
      } catch (err) {
        toast(err.message || 'No se pudieron guardar las stats', 'error');
      } finally {
        btn.disabled = false; btn.textContent = 'Guardar';
      }
    };

    document.querySelectorAll('#modal-editar-stats-deporte [data-cerrar-modal]').forEach(btn => btn.onclick = () => cerrarModal('modal-editar-stats-deporte'));
    document.getElementById('modal-editar-stats-deporte').onclick = (e) => { if (e.target.id === 'modal-editar-stats-deporte') cerrarModal('modal-editar-stats-deporte'); };
    abrirModal('modal-editar-stats-deporte');
  }

  function iconoDeporte(deporte) {
    const map = {
      'Fútbol': 'assets/icons/balon-de-futbol (2).png', 'Básquetbol': 'assets/icons/balocensto.svg',
      'Tenis': 'assets/icons/pelota-de-tenis.png', 'Vóleibol': 'assets/icons/voleibol.svg',
      'Pádel': 'assets/icons/raqueta-de-padel.png', 'Golf': 'assets/icons/golf.png',
      'Béisbol': 'assets/icons/beisbol.png', 'Hockey': 'assets/icons/disco.png',
      'Boxeo': 'assets/icons/guantes-de-boxeo.png', 'Bádminton': 'assets/icons/volante.png',
      'Rugby': 'assets/icons/rugby.png', 'Ciclismo': 'assets/icons/bicicleta.svg',
      'Natación': 'assets/icons/natacion.svg', 'Atletismo': 'assets/icons/corriendo.png',
      'Tenis de mesa': 'assets/icons/raqueta-de-tenis-de-mesa.png', 'Squash': 'assets/icons/tenis-de-squash.png',
      'Handball': 'assets/icons/balonmano.png', 'Fútbol americano': 'assets/icons/deporte.svg',
      'Surf': 'assets/icons/tabla-de-surf.png', 'Escalada': 'assets/icons/escalada.png'
    };
    const valor = map[deporte] || ICONOS.medalla;
    if (/\.(svg|png|jpg|jpeg|gif|webp)$/i.test(valor)) {
      return `<img src="${valor}" alt="" style="width:20px;height:20px;object-fit:contain;vertical-align:middle;display:inline-block" />`;
    }
    return valor;
  }

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
    if (selPais) selPais.innerHTML = '<option value="">Selecciona un país...</option>' + PAISES.map(p => `<option value="${p}" ${p === u.pais ? 'selected' : ''}>${p}</option>`).join('');

    const previewAvatar = document.getElementById('edit-perf-avatar-preview');
    previewAvatar.src = u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre || 'U')}&background=ff6a00&color=fff&size=200`;
    let avatarSel = u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre || 'U')}&background=ff6a00&color=fff&size=200`;

    const inputAvatarFile = document.getElementById('edit-perf-avatar-file');
    if (inputAvatarFile) {
      inputAvatarFile.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) return toast('La imagen es muy grande (máx 2 MB)', 'error');
        const reader = new FileReader();
        reader.onload = (ev) => {
          avatarSel = ev.target.result; previewAvatar.src = avatarSel;
        };
        reader.readAsDataURL(file); e.target.value = '';
      };
    }

    const btnQuitar = document.getElementById('edit-perf-avatar-quitar');
    if (btnQuitar) {
      btnQuitar.onclick = () => {
        avatarSel = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre || 'U')}&background=ff6a00&color=fff&size=200`;
        previewAvatar.src = avatarSel;
      };
    }

    // ⚡ HERO COLOR
    let colorSel = u.heroColor || 'navy';
    const contColores = document.getElementById('edit-perf-hero-colores');
    const customHeroColorWrapper = document.getElementById('edit-perf-hero-color-custom-wrapper');
    const inputCustomHeroColor = document.getElementById('edit-perf-hero-color-custom');
    
    if (customHeroColorWrapper) {
      customHeroColorWrapper.style.display = u.esPremium ? 'flex' : 'none';
    }
    if (colorSel.startsWith('#') && inputCustomHeroColor) {
      inputCustomHeroColor.value = colorSel;
    }

    if (contColores) {
      contColores.innerHTML = HERO_COLORS.map(c => `
        <button type="button" class="perfil-color-btn ${c.key === colorSel ? 'active' : ''}" data-color="${c.key}" title="${c.label}" style="background: linear-gradient(135deg, ${c.from} 0%, ${c.to} 100%)"></button>
      `).join('');
      
      contColores.querySelectorAll('[data-color]').forEach(btn => {
        btn.addEventListener('click', () => {
          contColores.querySelectorAll('[data-color]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          colorSel = btn.dataset.color;
          if (inputCustomHeroColor) {
            const preset = HERO_COLORS.find(x => x.key === colorSel);
            if (preset) inputCustomHeroColor.value = preset.from;
          }
        });
      });
    }

    if (inputCustomHeroColor) {
      inputCustomHeroColor.addEventListener('input', (e) => {
        colorSel = e.target.value;
        contColores.querySelectorAll('[data-color]').forEach(b => b.classList.remove('active'));
      });
    }

    // ⚡ MARCO
    let marcoSel = u.marcoPerfil || 'default';
    let marcoColorSel = u.marcoColor || '#E8836A';
    const contMarcos = document.getElementById('edit-perf-marcos');
    const marcoCustomWrapper = document.getElementById('edit-perf-marco-custom-wrapper');
    const inputMarcoColor = document.getElementById('edit-perf-marco-color');
    const badgeMarcoPremium = document.getElementById('badge-marco-premium');

    if (badgeMarcoPremium) badgeMarcoPremium.style.display = u.esPremium ? 'none' : 'inline-block';
    if (inputMarcoColor) inputMarcoColor.value = marcoColorSel;

    function actualizarPreviewAvatar() {
      const marco = MARCOS_PERFIL.find(m => m.id === marcoSel);
      previewAvatar.className = 'perfil-header-card__avatar'; 
      previewAvatar.style.borderColor = '';
      previewAvatar.style.boxShadow = '';
      
      if (marco?.clase) {
        previewAvatar.classList.add(marco.clase);
      }
      
      if (marcoSel === 'custom') {
        previewAvatar.style.borderColor = marcoColorSel;
        previewAvatar.style.boxShadow = `0 0 15px ${marcoColorSel}80`;
      }
    }

    if (contMarcos) {
      contMarcos.innerHTML = MARCOS_PERFIL.map(m => {
        const isPremium = m.id !== 'default';
        const locked = isPremium && !u.esPremium;
        return `
          <button type="button" class="posicion-chip ${m.id === marcoSel ? 'active' : ''}" data-marco="${m.id}" style="opacity: ${locked ? 0.5 : 1};">
            ${m.nombre} ${locked ? '🔒' : ''}
          </button>
        `;
      }).join('');

      contMarcos.querySelectorAll('[data-marco]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.marco !== 'default' && !u.esPremium) {
            return toast('Los marcos son exclusivos de Premium.', 'error');
          }
          contMarcos.querySelectorAll('[data-marco]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          marcoSel = btn.dataset.marco;
          
          if (marcoSel === 'custom') {
            if (marcoCustomWrapper) marcoCustomWrapper.style.display = 'flex';
          } else {
            if (marcoCustomWrapper) marcoCustomWrapper.style.display = 'none';
          }
          actualizarPreviewAvatar();
        });
      });
    }

    if (inputMarcoColor) {
      inputMarcoColor.addEventListener('input', (e) => {
        marcoColorSel = e.target.value;
        actualizarPreviewAvatar();
      });
    }

    if (marcoSel === 'custom' && marcoCustomWrapper) marcoCustomWrapper.style.display = 'flex';
    actualizarPreviewAvatar();

    // ⚡ Banner Foto
    let heroFotoSel = u.heroFoto || null;
    const previewHeroWrapper = document.getElementById('edit-perf-hero-foto-preview-wrapper');
    const previewHeroImg = document.getElementById('edit-perf-hero-foto-preview');
    
    const heroFotoWrapperCompleto = document.querySelector('.perfil-hero-foto');
    
    if (heroFotoWrapperCompleto) {
      heroFotoWrapperCompleto.style.display = 'block';
      
      const labelEl = heroFotoWrapperCompleto.querySelector('.perfil-hero-foto__label');
      const btnSubir = heroFotoWrapperCompleto.querySelector('label.btn');

      if (!u.esPremium) {
        heroFotoWrapperCompleto.style.opacity = '0.6';
        
        if (labelEl) {
          labelEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-bottom: 8px;">
              <span>Foto de portada</span>
              <span class="badge badge--warning" style="font-size:10px; padding:2px 6px; border-radius:4px;">Premium</span>
            </div>
          `;
        }
        
        if (btnSubir && !btnSubir.innerHTML.includes('🔒')) {
          btnSubir.innerHTML = btnSubir.innerHTML.replace('Subir foto', 'Subir foto 🔒');
        }

        heroFotoWrapperCompleto.querySelectorAll('input, button, label').forEach(el => {
          el.disabled = true;
          el.style.pointerEvents = 'none';
        });
        
      } else {
        heroFotoWrapperCompleto.style.opacity = '1';
        
        if (labelEl && labelEl.innerHTML.includes('badge--warning')) {
          labelEl.innerHTML = 'O subí una foto (opcional, máx 1.5 MB)';
        }
        
        if (btnSubir && btnSubir.innerHTML.includes('🔒')) {
          btnSubir.innerHTML = btnSubir.innerHTML.replace('Subir foto 🔒', 'Subir foto');
        }
        
        heroFotoWrapperCompleto.querySelectorAll('input, button, label').forEach(el => {
          el.disabled = false;
          el.style.pointerEvents = 'auto';
        });
      }
    }

    function actualizarPreviewHeroFoto() {
      if (heroFotoSel) { if (previewHeroImg) previewHeroImg.src = heroFotoSel; previewHeroWrapper?.classList.remove('hidden'); }
      else { if (previewHeroImg) previewHeroImg.src = ''; previewHeroWrapper?.classList.add('hidden'); }
    }
    actualizarPreviewHeroFoto();

    const inputHeroFile = document.getElementById('edit-perf-hero-foto-file');
    if (inputHeroFile) {
      inputHeroFile.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 1.5 * 1024 * 1024) return toast('La foto es muy grande (máx 1.5 MB)', 'error');
        const reader = new FileReader();
        reader.onload = (ev) => { heroFotoSel = ev.target.result; actualizarPreviewHeroFoto(); };
        reader.readAsDataURL(file); e.target.value = '';
      };
    }
    document.getElementById('edit-perf-hero-foto-quitar')?.addEventListener('click', () => { heroFotoSel = null; actualizarPreviewHeroFoto(); });

    const base = u.statsHeroBase || {};
    const inputBasePartidos = document.getElementById('edit-perf-base-partidos');
    if (inputBasePartidos) inputBasePartidos.value = base.partidos || 0;

    let deportesActuales = JSON.parse(JSON.stringify(u.deportes || []));
    const selNuevoDeporte = document.getElementById('edit-perf-nuevo-deporte');
    const contDeportes = document.getElementById('edit-perf-deportes-lista');

    function refrescarSelectDeportes() {
      const elegidos = new Set(deportesActuales.map(d => d.deporte));
      selNuevoDeporte.innerHTML = '<option value="">Agregar deporte...</option>' + todosLosDeportes.filter(d => !elegidos.has(d)).map(d => `<option value="${d}">${d}</option>`).join('');
    }

    function renderDeportesElegidos() {
      if (deportesActuales.length === 0) {
        contDeportes.innerHTML = `<div class="empty-state--sm"><div class="empty-state__icon">${ICONOS.medalla}</div><p class="text-sm text-muted">Aún no agregaste deportes</p></div>`;
        return;
      }
      contDeportes.innerHTML = deportesActuales.map((d, idx) => {
        const posicionesDisponibles = posicionesPorDeporte[d.deporte] || [];
        const tienePosiciones = posicionesDisponibles.length > 0;
        return `
          <div class="card" style="padding:var(--space-3); background:var(--color-surface-2); border:none">
            <div class="flex items-center justify-between mb-2"><div style="font-weight:700; font-size:var(--fs-sm)">${d.deporte}</div><button class="btn btn--ghost btn--sm" data-quitar-deporte="${idx}" style="color:var(--color-danger)">✕</button></div>
            ${tienePosiciones ? `<div style="font-size:var(--fs-xs); color:var(--color-text-muted); margin-bottom:6px">Posiciones (opcional, varias):</div><div class="posiciones-lista" style="padding:8px; gap:6px">${posicionesDisponibles.map(p => `<button type="button" class="posicion-chip ${(d.posiciones || []).includes(p) ? 'active' : ''}" data-pos-idx="${idx}" data-pos-nombre="${p}" style="font-size:11px; padding:4px 10px">${p}</button>`).join('')}</div>` : `<p class="text-xs text-muted">Este deporte no tiene posiciones</p>`}
          </div>`;
      }).join('');

      contDeportes.querySelectorAll('[data-quitar-deporte]').forEach(btn => {
        btn.addEventListener('click', () => { deportesActuales.splice(Number(btn.dataset.quitarDeporte), 1); renderDeportesElegidos(); refrescarSelectDeportes(); });
      });
      contDeportes.querySelectorAll('[data-pos-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.posIdx); const pos = btn.dataset.posNombre;
          const lista = deportesActuales[idx].posiciones || (deportesActuales[idx].posiciones = []);
          if (lista.includes(pos)) { deportesActuales[idx].posiciones = lista.filter(p => p !== pos); btn.classList.remove('active'); }
          else { lista.push(pos); btn.classList.add('active'); }
        });
      });
    }

    renderDeportesElegidos(); refrescarSelectDeportes();

    document.getElementById('edit-perf-add-deporte').onclick = () => {
      const dep = selNuevoDeporte.value;
      if (!dep) return;
      if (deportesActuales.some(d => d.deporte === dep)) return toast('Ese deporte ya está agregado', 'error');
      deportesActuales.push({ deporte: dep, posiciones: [], stats: {} });
      renderDeportesElegidos(); refrescarSelectDeportes();
    };

    document.getElementById('btn-guardar-perfil').onclick = async () => {
      const nombre = document.getElementById('edit-perf-nombre').value.trim();
      const username = document.getElementById('edit-perf-username').value.trim();
      const bio = document.getElementById('edit-perf-bio').value.trim();
      const ciudad = document.getElementById('edit-perf-ciudad').value.trim();
      const edad = Number(document.getElementById('edit-perf-edad').value) || null;
      const pais = document.getElementById('edit-perf-pais').value;

      if (!nombre) return toast('El nombre no puede estar vacío', 'error');
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return toast('El usuario debe tener 3-20 caracteres (letras, números, _)', 'error');

      const btn = document.getElementById('btn-guardar-perfil');
      btn.disabled = true; btn.textContent = 'Guardando...';

      try {
        await actualizarMiPerfil({
          nombre, username, bio: bio || null, ciudad: ciudad || null, edad, pais: pais || null,
          avatar: avatarSel || null, heroColor: colorSel, heroFoto: heroFotoSel,
          marcoPerfil: marcoSel,
          marcoColor: marcoSel === 'custom' ? marcoColorSel : null,
          statsHeroBase: { partidos: Math.max(0, Number(inputBasePartidos?.value) || 0) },
        });

        const usuarioActual = getSesion();
        const deportesPrevios = usuarioActual.deportes || [];
        const deportesFinales = deportesActuales.map(d => {
          const anterior = deportesPrevios.find(x => x.deporte === d.deporte);
          return { deporte: d.deporte, posiciones: d.posiciones || [], stats: anterior?.stats || {} };
        });

        await actualizarMisDeportes(deportesFinales);
        cerrarModal('modal-editar-perfil');
        toast('Perfil actualizado', 'success');
        user = getSesion(); 
        await render(user); 
      } catch (err) {
        console.error('[perfil] Error al guardar:', err);
        toast(err.message || 'No se pudo guardar el perfil', 'error');
      } finally {
        btn.disabled = false; btn.textContent = 'Guardar cambios';
      }
    };

    document.querySelectorAll('#modal-editar-perfil [data-cerrar-modal]').forEach(btn => btn.onclick = () => cerrarModal('modal-editar-perfil'));
    document.getElementById('modal-editar-perfil').onclick = (e) => { if (e.target.id === 'modal-editar-perfil') cerrarModal('modal-editar-perfil'); };
    abrirModal('modal-editar-perfil');
  }

  function abrirModalEditarStatsDeporte(nombreDeporte) {
    const u = getSesion();
    if (!u) return;
    
    if (!u.esPremium) {
      toast('La edición de estadísticas por deporte es exclusiva de Premium.', 'error');
      return;
    }

    const deporteData = (u.deportes || []).find(d => d.deporte === nombreDeporte);
    if (!deporteData) return;

    const statsDisponibles = statsPorDeporte[nombreDeporte] || [];
    const statsUsuario = deporteData.stats || {};
    document.getElementById('stats-deporte-titulo').textContent = `Stats de ${nombreDeporte}`;
    const contenedor = document.getElementById('stats-deporte-campos');

    if (statsDisponibles.length === 0) {
      contenedor.innerHTML = `<p class="text-sm text-muted text-center" style="padding:var(--space-5)">Este deporte no tiene estadísticas disponibles</p>`;
    } else {
      contenedor.innerHTML = statsDisponibles.map(s => {
        const stat = statsUsuario[s.clave] || { valor: 0, publico: false };
        return `
          <div class="field">
            <div class="flex items-center justify-between mb-2">
              <label class="field__label" style="margin:0" for="stat-${s.clave}">${s.nombre}</label>
              <label class="switch" style="margin:0"><input type="checkbox" id="stat-publico-${s.clave}" ${stat.publico ? 'checked' : ''} /><span class="switch__slider"></span><div><div class="switch__label" style="font-size:11px">Público</div></div></label>
            </div>
            <input type="text" id="stat-${s.clave}" class="field__input" value="${stat.valor || ''}" placeholder="" />
          </div>`;
      }).join('');
    }

    document.getElementById('btn-guardar-stats-deporte').onclick = async () => {
      const nuevasStats = {};
      statsDisponibles.forEach(s => {
        const inputValor = document.getElementById(`stat-${s.clave}`);
        const chkPublico = document.getElementById(`stat-publico-${s.clave}`);
        if (!inputValor) return;
        nuevasStats[s.clave] = { valor: Math.max(0, Number(inputValor.value) || 0), publico: chkPublico?.checked || false };
      });

      const usuarioActual = getSesion();
      const deportesActuales = usuarioActual.deportes || [];
      const deportesActualizados = deportesActuales.map(d => d.deporte === nombreDeporte ? { ...d, stats: nuevasStats } : d);

      const btn = document.getElementById('btn-guardar-stats-deporte');
      btn.disabled = true; btn.textContent = 'Guardando...';

      try {
        await actualizarMisDeportes(deportesActualizados);
        cerrarModal('modal-editar-stats-deporte');
        toast(`Stats de ${nombreDeporte} actualizadas`, 'success');
        user = getSesion(); await render(user);
      } catch (err) {
        toast(err.message || 'No se pudieron guardar las stats', 'error');
      } finally {
        btn.disabled = false; btn.textContent = 'Guardar';
      }
    };

    document.querySelectorAll('#modal-editar-stats-deporte [data-cerrar-modal]').forEach(btn => btn.onclick = () => cerrarModal('modal-editar-stats-deporte'));
    document.getElementById('modal-editar-stats-deporte').onclick = (e) => { if (e.target.id === 'modal-editar-stats-deporte') cerrarModal('modal-editar-stats-deporte'); };
    abrirModal('modal-editar-stats-deporte');
  }

  document.getElementById('btn-editar-perfil')?.addEventListener('click', abrirModalEditar);
  await render(user);
  return null;
}