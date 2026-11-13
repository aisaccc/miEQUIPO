/* =========================================================
   grupo-publico.js — Vista pública de un equipo/comunidad
   ========================================================= */

import { toast } from '../components.js';
import { obtenerGrupo, unirseAGrupo, salirDeGrupo, cancelarMiSolicitud } from '../services/grupos.service.js';
import { listarPublicacionesDeGrupo as listarPubsGrupoAPI } from '../services/publicaciones.service.js';
import { renderFeedPublicaciones } from '../utils/publicaciones-ui.js';

const RUTA_ESCUDO = 'assets/icons/escudo-de-seguridad.png';
const AVATAR_FALLBACK = 'assets/icons/usuario.svg';

/* ⚡ Helper: devuelve { clase, estilo } del marco */
function getMarcoData(marcoIcono, marcoColorIcono) {
  if (!marcoIcono || marcoIcono === 'default') {
    return { clase: '', estilo: '' };
  }
  if (marcoIcono === 'custom') {
    const color = marcoColorIcono || '#E8836A';
    return {
      clase: 'marco-icono-custom',
      estilo: `border:3px solid ${color};box-shadow:0 0 15px ${color}80;`,
    };
  }
  return { clase: `marco-icono-${marcoIcono}`, estilo: '' };
}

const SVG = {
  users: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  trophy: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  percent: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`,
  minus: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  x: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  medal: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  image: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  userPlus: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
  exit: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  arrowLeft: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  crown: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  user: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
};

const COLOR_DEPORTE = {
  'Fútbol':            { from: '#FF6B4A', to: '#C2410C' },
  'Fútbol americano':  { from: '#DC2626', to: '#7F1D1D' },
  'Básquetbol':        { from: '#3B82F6', to: '#1E40AF' },
  'Tenis':             { from: '#22C55E', to: '#166534' },
  'Tenis de mesa':     { from: '#EC4899', to: '#9D174D' },
  'Vóleibol':          { from: '#F59E0B', to: '#92400E' },
  'Pádel':             { from: '#6366F1', to: '#3730A3' },
  'Squash':            { from: '#06B6D4', to: '#155E75' },
  'Bádminton':         { from: '#A855F7', to: '#6B21A8' },
  'Golf':              { from: '#10B981', to: '#065F46' },
  'Béisbol':           { from: '#EAB308', to: '#854D0E' },
  'Hockey':            { from: '#0EA5E9', to: '#075985' },
  'Handball':          { from: '#F43F5E', to: '#9F1239' },
  'Rugby':             { from: '#8B5CF6', to: '#5B21B6' },
  'Boxeo':             { from: '#EF4444', to: '#7F1D1D' },
  'Ciclismo':          { from: '#84CC16', to: '#3F6212' },
  'Natación':          { from: '#06B6D4', to: '#0E7490' },
  'Atletismo':         { from: '#F43F5E', to: '#BE123C' },
  'Surf':              { from: '#0EA5E9', to: '#0369A1' },
  'Escalada':          { from: '#F59E0B', to: '#B45309' },
};
const COLOR_DEFAULT = { from: '#FF6B4A', to: '#C2410C' };

function colorDeporte(deporte) {
  return COLOR_DEPORTE[deporte] || COLOR_DEFAULT;
}

export async function renderGrupoPublico(contenedor, grupoId, { onVolver } = {}) {
  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="page-loader" style="padding: 60px 20px;">
      <div class="spinner"></div>
      <span>Cargando equipo...</span>
    </div>`;

  let grupo;
  let publicaciones = [];

  try {
    grupo = await obtenerGrupo(grupoId);
    publicaciones = await listarPubsGrupoAPI(grupoId);
  } catch (err) {
    console.error('[grupo-publico] Error al cargar:', err);
    contenedor.innerHTML = `
      <div class="empty-state" style="padding: 40px 20px;">
        <div class="empty-state__icon" style="font-size:36px; color:var(--color-danger)">${SVG.x}</div>
        <p class="text-sm text-muted">No se pudo cargar el equipo.</p>
        <button class="btn btn--ghost mt-4" id="gpub-btn-volver-error">Volver</button>
      </div>`;
    document.getElementById('gpub-btn-volver-error')?.addEventListener('click', () => {
      if (onVolver) onVolver();
    });
    return;
  }

  const esComunidad = grupo.tipo === 'comunidad';
  const esCapitanGrupo = grupo.esCapitan === true;
  const esAdminGrupo = grupo.esAdmin === true;
  const esMiembroGrupo = grupo.esMiembro === true;
  const miembroReal = esMiembroGrupo || esCapitanGrupo || esAdminGrupo;

  const color = colorDeporte(grupo.deporte);
  
  // ⚡ Fallback: si no hay Hero configurado, usa la Card
  const fotoHero = grupo.heroFoto || grupo.cardFoto;
  const colorHero = grupo.heroColor || grupo.cardColor;
  
  let heroStyle = `background: linear-gradient(135deg, ${color.from} 0%, ${color.to} 100%);`;
  if (fotoHero) {
    heroStyle = `background-image: linear-gradient(180deg, rgba(15,27,45,0.10) 0%, rgba(15,27,45,0.55) 100%), url('${fotoHero}'); background-size: cover; background-position: center;`;
  } else if (colorHero) {
    heroStyle = `background: linear-gradient(135deg, ${colorHero} 0%, ${colorHero}DD 100%);`;
  }

  const escudoHero = renderIconoHtml(grupo.iconoPersonalizado || grupo.escudo || RUTA_ESCUDO, 48);

  /* ⚡ Marco del ícono del hero */
  const marcoHero = getMarcoData(grupo.marcoIcono, grupo.marcoColorIcono);

  const partidos = calcularPartidos(grupo.stats);
  const victorias = grupo.stats?.victorias;
  const empates = grupo.stats?.empates;
  const derrotas = grupo.stats?.derrotas;
  const porcentaje = calcularPorcentaje(grupo.stats);

  const victoriasVisibles = statEsVisible(victorias);
  const empatesVisibles = statEsVisible(empates);
  const derrotasVisibles = statEsVisible(derrotas);

  const iconoTipoHtml = esComunidad ? SVG.globe : SVG.users;
  const labelTipo = esComunidad ? 'Comunidad' : 'Equipo';
  const labelMiembros = esComunidad ? 'miembros' : 'jugadores';

  let miSolicitudPendiente = false;
  try {
    const grupoCompleto = await obtenerGrupo(grupo.id);
    miSolicitudPendiente = grupoCompleto.miSolicitudPendiente === true;
  } catch (err) {}

  let botonesHtml = '';
  const esPrivado = grupo.tipoAcceso === 'privado';

  if (miembroReal) {
    if (!esCapitanGrupo) {
      botonesHtml = `
        <button class="btn gd-hero__action gd-hero__action--danger" data-accion-grupo="salir" data-id="${grupo.id}">
          ${SVG.exit} Salir ${esComunidad ? 'de la comunidad' : 'del equipo'}
        </button>
      `;
    } else {
      botonesHtml = `
        <span class="badge" style="padding:11px 16px;justify-content:center;background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.25)">
          ${SVG.crown} Eres el ${esComunidad ? 'creador' : 'capitán'}
        </span>
      `;
    }
  } else if (miSolicitudPendiente) {
    botonesHtml = `
      <span class="badge" style="padding:11px 16px;justify-content:center;background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.25)">
        ${SVG.lock} Solicitud pendiente
      </span>
      <button class="btn gd-hero__action gd-hero__action--danger" data-accion-grupo="cancelar-solicitud" data-id="${grupo.id}">
        ${SVG.x} Cancelar solicitud
      </button>
    `;
  } else {
    botonesHtml = `
      <button class="btn gd-hero__action gd-hero__action--primary" id="gpub-btn-unirse">
        ${SVG.userPlus} ${esPrivado ? 'Solicitar unirme' : 'Unirme'}
      </button>
    `;
  }

  const botonesSubtabs = [
    { id: 'publicaciones', icono: SVG.image, label: 'Publicaciones' },
    { id: 'miembros', icono: SVG.users, label: 'Plantilla' },
    { id: 'info', icono: SVG.medal, label: 'Información' }
  ];

  let subtabActivo = 'publicaciones';

  const renderSubtabs = () => `
    <div class="subtabs subtabs--detalle mb-4" id="gpub-subtabs">
      ${botonesSubtabs.map(btn => `
        <button class="subtab ${subtabActivo === btn.id ? 'subtab--active' : ''}" data-subtab-grupo="${btn.id}">
          ${btn.icono}
          ${btn.label}
        </button>
      `).join('')}
    </div>
    <div id="gpub-subtab-contenido"></div>
  `;

  contenedor.innerHTML = `
    ${onVolver ? `
      <div class="gd-top">
        <button class="gd-top__volver" id="gpub-btn-volver">
          ${SVG.arrowLeft}
          Volver
        </button>
      </div>
    ` : ''}

    <div class="gd-hero" style="${heroStyle}">
      <div class="gd-hero__left">
        <div class="gd-hero__crest ${marcoHero.clase}" style="${marcoHero.estilo}">
          ${escudoHero}
        </div>
        <div class="gd-hero__info">
          <div class="gd-hero__badges">
            <span class="badge">${iconoTipoHtml} ${labelTipo}</span>
            <span class="badge">
              ${grupo.tipoAcceso === 'privado' ? SVG.lock + ' Privado' : SVG.globe + ' Público'}
            </span>
            ${esCapitanGrupo ? `<span class="badge">${SVG.crown} Capitán</span>` : ''}
            ${esAdminGrupo && !esCapitanGrupo ? `<span class="badge">${SVG.crown} Sub-capitán</span>` : ''}
          </div>
          <h1 class="gd-hero__title">${grupo.nombre}</h1>
          ${grupo.descripcion ? `
            <p class="gd-hero__desc">${grupo.descripcion}</p>
          ` : ''}
        </div>
      </div>
      <div class="gd-hero__actions">
        ${botonesHtml}
      </div>
    </div>

    <!-- STATS -->
    <div class="gd-stats">
      <div class="gd-stat">
        <div class="gd-stat__icon">${SVG.users}</div>
        <div class="gd-stat__texto">
          <div class="gd-stat__value">${grupo.totalMiembros || 0}</div>
          <div class="gd-stat__label">Miembros</div>
        </div>
      </div>

      ${!esComunidad ? `
        <div class="gd-stat">
          <div class="gd-stat__icon">${SVG.trophy}</div>
          <div class="gd-stat__texto">
            <div class="gd-stat__value">${partidos}</div>
            <div class="gd-stat__label">Partidos</div>
          </div>
        </div>

        ${victoriasVisibles ? `
          <div class="gd-stat">
            <div class="gd-stat__icon">${SVG.check}</div>
            <div class="gd-stat__texto">
              <div class="gd-stat__value">${victorias}</div>
              <div class="gd-stat__label">Victorias</div>
            </div>
          </div>
        ` : ''}

        ${empatesVisibles ? `
          <div class="gd-stat">
            <div class="gd-stat__icon">${SVG.minus}</div>
            <div class="gd-stat__texto">
              <div class="gd-stat__value">${empates}</div>
              <div class="gd-stat__label">Empates</div>
            </div>
          </div>
        ` : ''}

        ${derrotasVisibles ? `
          <div class="gd-stat">
            <div class="gd-stat__icon">${SVG.x}</div>
            <div class="gd-stat__texto">
              <div class="gd-stat__value">${derrotas}</div>
              <div class="gd-stat__label">Derrotas</div>
            </div>
          </div>
        ` : ''}

        ${victoriasVisibles && porcentaje !== null ? `
          <div class="gd-stat">
            <div class="gd-stat__icon">${SVG.percent}</div>
            <div class="gd-stat__texto">
              <div class="gd-stat__value">${porcentaje}%</div>
              <div class="gd-stat__label">% Victorias</div>
            </div>
          </div>
        ` : ''}
      ` : ''}

      <!-- ⚡ Solo para comunidades, mostramos el Deporte -->
      ${esComunidad ? `
        <div class="gd-stat">
          <div class="gd-stat__icon">${SVG.medal}</div>
          <div class="gd-stat__texto">
            <div class="gd-stat__value" style="font-size: 16px; margin-top: 4px;">${grupo.deporte}</div>
            <div class="gd-stat__label">Deporte</div>
          </div>
        </div>
      ` : ''}
    </div>

    ${renderSubtabs()}
  `;

  if (onVolver) {
    document.getElementById('gpub-btn-volver')?.addEventListener('click', onVolver);
  }

  document.getElementById('gpub-btn-unirse')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = 'Enviando...';

    try {
      const res = await unirseAGrupo(grupo.id);
      if (res.tipo === 'solicitud') {
        toast('Solicitud enviada al capitán', 'success');
      } else {
        toast('¡Te uniste al grupo!', 'success');
      }
      await renderGrupoPublico(contenedor, grupoId, { onVolver });
    } catch (err) {
      toast(err.message || 'Error al unirse', 'error');
      btn.disabled = false;
      btn.innerHTML = textoOriginal;
    }
  });

  contenedor.querySelectorAll('[data-accion-grupo]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const accion = btn.dataset.accionGrupo;

      if (accion === 'salir') {
        if (!confirm(`¿Salir de "${grupo.nombre}"?`)) return;
        try {
          await salirDeGrupo(grupo.id);
          toast('Saliste del grupo', 'info');
          await renderGrupoPublico(contenedor, grupoId, { onVolver });
        } catch (err) {
          toast(err.message || 'Error al salir', 'error');
        }
      }

      if (accion === 'cancelar-solicitud') {
        if (!confirm(`¿Cancelar tu solicitud para unirte a "${grupo.nombre}"?`)) return;
        try {
          await cancelarMiSolicitud(grupo.id);
          toast('Solicitud cancelada', 'info');
          await renderGrupoPublico(contenedor, grupoId, { onVolver });
        } catch (err) {
          toast(err.message || 'Error al cancelar', 'error');
        }
      }
    });
  });

  const contSubtabs = document.getElementById('gpub-subtab-contenido');

  const renderTab = () => {
    contenedor.querySelectorAll('[data-subtab-grupo]').forEach(btn => {
      btn.classList.toggle('subtab--active', btn.dataset.subtabGrupo === subtabActivo);
    });

    if (subtabActivo === 'publicaciones') {
      contSubtabs.innerHTML = `<div id="gpub-feed-contenido"></div>`;
      const feedCont = document.getElementById('gpub-feed-contenido');
      renderFeedPublicaciones(feedCont, publicaciones, {
        onRefrescar: async () => {
          publicaciones = await listarPubsGrupoAPI(grupoId);
          renderTab();
        }
      });
    } else if (subtabActivo === 'miembros') {
      contSubtabs.innerHTML = `
        <div class="gd-card">
          <div class="gd-card__eyebrow">Plantilla</div>
          <h3 class="gd-card__title">
            ${esComunidad ? 'Miembros' : 'Jugadores'} (${grupo.totalMiembros || 0})
          </h3>
          <div class="gd-jugadores" id="gpub-miembros-lista">
            <div class="gd-empty">
              <div class="gd-empty__icon">${SVG.user}</div>
              <p class="gd-empty__text">Cargando miembros...</p>
            </div>
          </div>
        </div>
      `;
      renderMiembros();
    } else if (subtabActivo === 'info') {
      contSubtabs.innerHTML = `
        <div class="gd-col">
          <div class="gd-card">
            <div class="gd-card__eyebrow">Información</div>
            <h3 class="gd-card__title">Sobre ${esComunidad ? 'la comunidad' : 'el equipo'}</h3>

            ${grupo.descripcion ? `
              <p class="gd-card__description">${grupo.descripcion}</p>
            ` : `
              <p class="gd-card__description text-muted">Sin descripción.</p>
            `}

            <div class="gd-info-grid">
              <div class="gd-info-item">
                <div class="gd-info-item__icon">${SVG.medal}</div>
                <div>
                  <div class="gd-info-item__label">Deporte</div>
                  <div class="gd-info-item__value">${grupo.deporte}</div>
                </div>
              </div>

              <div class="gd-info-item">
                <div class="gd-info-item__icon">${SVG.pin}</div>
                <div>
                  <div class="gd-info-item__label">Ciudad</div>
                  <div class="gd-info-item__value">${grupo.ciudad || '—'}</div>
                </div>
              </div>

              <div class="gd-info-item">
                <div class="gd-info-item__icon">${grupo.tipoAcceso === 'privado' ? SVG.lock : SVG.globe}</div>
                <div>
                  <div class="gd-info-item__label">Visibilidad</div>
                  <div class="gd-info-item__value">${grupo.tipoAcceso === 'privado' ? 'Privado' : 'Público'}</div>
                </div>
              </div>

              <div class="gd-info-item">
                <div class="gd-info-item__icon">${SVG.users}</div>
                <div>
                  <div class="gd-info-item__label">Miembros</div>
                  <div class="gd-info-item__value">${grupo.totalMiembros || 0} ${labelMiembros}</div>
                </div>
              </div>

              <div class="gd-info-item">
                <div class="gd-info-item__icon">${SVG.calendar}</div>
                <div>
                  <div class="gd-info-item__label">Creado</div>
                  <div class="gd-info-item__value">${formatearFechaCorta(grupo.createdAt)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  };

  const renderMiembros = () => {
    const lista = document.getElementById('gpub-miembros-lista');
    if (!lista) return;
    
    let miembros = grupo.miembros || [];
    
    if (miembros.length === 0 && grupo.capitan) {
      miembros = [{
        id: grupo.capitan.id,
        nombre: grupo.capitan.nombre || 'Capitán del equipo',
        avatar: grupo.capitan.avatar || AVATAR_FALLBACK,
        posicion: 'Capitán',
        rol: 'capitan'
      }];
    }

    if (miembros.length === 0) {
      lista.innerHTML = `
        <div class="gd-empty">
          <div class="gd-empty__icon">${SVG.user}</div>
          <p class="gd-empty__text">Aún no hay miembros.</p>
        </div>`;
      return;
    }
    
    lista.innerHTML = miembros.map(j => {
      const esElCapitan = j.rol === 'capitan';
      const esSubCapitan = j.rol === 'admin';
      const avatar = j.avatar || AVATAR_FALLBACK;

      return `
        <div class="gd-jugador">
          <img src="${avatar}" class="gd-jugador__avatar" alt="" data-autor-id="${j.id}" style="cursor:pointer" />
          <div class="gd-jugador__info">
            <div class="gd-jugador__name" data-autor-id="${j.id}" style="cursor:pointer">
              ${j.nombre}
              ${esElCapitan ? `<span class="badge badge--primary" style="margin-left:6px">${SVG.crown}</span>` : ''}
              ${esSubCapitan && !esElCapitan ? `<span class="badge badge--warning" style="margin-left:6px">${SVG.crown}</span>` : ''}
            </div>
            <div class="gd-jugador__sub">${j.posicion || 'Sin posición'}</div>
          </div>
        </div>
      `;
    }).join('');

    lista.querySelectorAll('[data-autor-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        import('../components.js').then(({ verPerfilUsuario }) => {
          verPerfilUsuario(el.dataset.autorId);
        });
      });
    });
  };

  contenedor.querySelectorAll('[data-subtab-grupo]').forEach(btn => {
    btn.addEventListener('click', () => {
      subtabActivo = btn.dataset.subtabGrupo;
      renderTab();
    });
  });

  renderTab();

  function esIconoImagen(valor) {
    if (typeof valor !== 'string') return false;
    return /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(valor) || valor.startsWith('data:image/');
  }

  function renderIconoHtml(valor, size = 20) {
    if (esIconoImagen(valor)) {
      const esBase64 = valor.startsWith('data:image/');
      const esBandera = valor.toLowerCase().includes('flag') || 
                        valor.toLowerCase().includes('bandera') || 
                        valor.toLowerCase().includes('pais') ||
                        valor.toLowerCase().includes('redondo') ||
                        valor.toLowerCase().includes('mundo');
      const clase = esBase64 ? 'icono-custom' : (esBandera ? 'icono-bandera' : 'icono-deporte');
      const estilo = (esBase64 && size > 30)
        ? 'width:100%;height:100%;object-fit:cover;border-radius:inherit;' 
        : `width:${size}px;height:${size}px;object-fit:contain;`;
      return `<img src="${valor}" alt="icono" class="${clase}" style="${estilo}vertical-align:middle;display:inline-block" />`;
    }
    return `<span style="font-size:${size}px;line-height:1;vertical-align:middle">${valor || ''}</span>`;
  }

  function calcularPartidos(stats) {
    const v = stats?.victorias ?? 0;
    const e = stats?.empates ?? 0;
    const d = stats?.derrotas ?? 0;
    return v + e + d;
  }

  function calcularPorcentaje(stats) {
    const v = stats?.victorias ?? 0;
    const total = calcularPartidos(stats);
    if (total === 0) return null;
    return Math.round((v / total) * 100);
  }

  function statEsVisible(valor) {
    return valor !== null && valor !== undefined;
  }

  function formatearFechaCorta(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  }
}