import { formatearFecha, toast, abrirModal, cerrarModal } from '../components.js';
import { deportes } from '../data-mock.js';
import { getSesion, obtenerUsuarioActual } from '../auth.js';
import { listarGrupos } from '../services/grupos.service.js';
import {
  listarTorneos,
  crearTorneo as crearTorneoAPI,
  editarTorneo as editarTorneoAPI,
  eliminarTorneo as eliminarTorneoAPI,
  inscribirEquipo as inscribirEquipoAPI,
  cancelarInscripcion as cancelarInscripcionAPI,
  gestionarSolicitud as gestionarSolicitudAPI,
  expulsarEquipo as expulsarEquipoAPI,
} from '../services/torneos.service.js';

import { getReglasDeporte, getSistemaEfectivo } from '../utils/reglas-deporte.js';
import { ICONOS } from '../utils/iconos.js';

/* =========================================================
   MAPA DE EMOJIS / ASSETS
   ========================================================= */
const emojiDeporte = {
  'Fútbol': 'assets/icons/balon-de-futbol (2).png',
  'Básquetbol': 'assets/icons/balocensto.svg',
  'Tenis': 'assets/icons/pelota-de-tenis.png',
  'Vóleibol': 'assets/icons/voleibol.svg',
  'Pádel': 'assets/icons/raqueta-de-padel.png',
  'Golf': 'assets/icons/golf.png',
  'Béisbol': 'assets/icons/beisbol.png',
  'Hockey': 'assets/icons/disco.png',
  'Boxeo': 'assets/icons/guantes-de-boxeo.png',
  'Bádminton': 'assets/icons/volante.png',
  'Rugby': 'assets/icons/rugby.png',
  'Ciclismo': 'assets/icons/bicicleta.svg',
  'Natación': 'assets/icons/natacion.svg',
  'Atletismo': 'assets/icons/corriendo.png',
  'Tenis de mesa': 'assets/icons/raqueta-de-tenis-de-mesa.png',
  'Squash': 'assets/icons/tenis-de-squash.png',
  'Handball': 'assets/icons/balonmano.png',
  'Fútbol americano': 'assets/icons/deporte.svg',
  'Surf': 'assets/icons/tabla-de-surf.png',
  'Escalada': 'assets/icons/escalada.png',
};

/* =========================================================
   COLOR ÚNICO POR DEPORTE
   ========================================================= */
const COLOR_DEPORTE = {
  'Fútbol':            { bg: '#FFEDD5', fg: '#C2410C' },
  'Fútbol americano':  { bg: '#FEE2E2', fg: '#991B1B' },
  'Básquetbol':        { bg: '#DBEAFE', fg: '#1E40AF' },
  'Tenis':             { bg: '#DCFCE7', fg: '#166534' },
  'Tenis de mesa':     { bg: '#FCE7F3', fg: '#9D174D' },
  'Vóleibol':          { bg: '#FEF3C7', fg: '#92400E' },
  'Pádel':             { bg: '#E0E7FF', fg: '#3730A3' },
  'Squash':            { bg: '#CFFAFE', fg: '#155E75' },
  'Bádminton':         { bg: '#F3E8FF', fg: '#6B21A8' },
  'Golf':              { bg: '#D1FAE5', fg: '#065F46' },
  'Béisbol':           { bg: '#FEF9C3', fg: '#854D0E' },
  'Hockey':            { bg: '#E0F2FE', fg: '#075985' },
  'Handball':          { bg: '#FFE4E6', fg: '#9F1239' },
  'Rugby':             { bg: '#EDE9FE', fg: '#5B21B6' },
  'Boxeo':             { bg: '#FEE2E2', fg: '#7F1D1D' },
  'Ciclismo':          { bg: '#ECFCCB', fg: '#3F6212' },
  'Natación':          { bg: '#CFFAFE', fg: '#0E7490' },
  'Atletismo':         { bg: '#FFE4E6', fg: '#BE123C' },
  'Surf':              { bg: '#CFFAFE', fg: '#0369A1' },
  'Escalada':          { bg: '#FEF3C7', fg: '#B45309' },
};

const COLOR_DEFAULT = { bg: '#FFEDD5', fg: '#C2410C' };
const PALETA_BASICOS = ['#E8836A', '#3B82F6', '#22C55E', '#F59E0B', '#6366F1', '#EC4899'];

function esIconoImagen(valor) {
  if (typeof valor !== 'string') return false;
  return /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(valor) || valor.startsWith('data:image/');
}

function colorDeporte(deporte) {
  return COLOR_DEPORTE[deporte] || COLOR_DEFAULT;
}

function slugDeporte(deporte) {
  if (!deporte) return '';
  return deporte
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
}

/* =========================================================
   DEPORTES INDIVIDUALES
   ========================================================= */
const DEPORTES_INDIVIDUALES = new Set([
  'Tenis', 'Pádel', 'Squash', 'Tenis de mesa', 'Bádminton',
  'Golf', 'Natación', 'Atletismo', 'Ciclismo', 'Surf',
  'Escalada', 'Boxeo',
]);

const DEPORTES_TIEMPO = new Set(['Natación', 'Atletismo', 'Ciclismo']);
const DEPORTES_PUNTOS = new Set(['Escalada', 'Surf', 'Boxeo']);

/* =========================================================
   MODAL EDITAR — EXPORTADA
   ========================================================= */
export function abrirModalEditarExterno(torneo) {
  if (!torneo) {
    console.error('[torneos] No se recibió torneo para editar');
    return;
  }
  window.dispatchEvent(new CustomEvent('abrir-editar-torneo', { detail: torneo }));
}

/* =========================================================
   INIT
   ========================================================= */
export async function init() {
  let user = getSesion(); // ⚡ Cambiamos const por let
  
  // ⚡ NUEVO: Actualizamos la sesión si no tiene el campo esPremium
  if (user && user.esPremium === undefined) {
    try {
      user = await obtenerUsuarioActual();
    } catch (err) {
      console.error('[torneos] Error al refrescar sesión:', err);
    }
  }

  /* ---------- ESTADO ---------- */
  let torneos = [];
  let filtroActual = 'todos';
  let filtroBusqueda = '';
  let filtroFechaDesde = '';
  let filtroFechaHasta = '';
  let campoFechaActual = 'inscripcion';
  let modalidadSeleccionada = 'liga';
  let nivelTorneoSeleccionado = 'amistoso';
  let tipoParticipacionSeleccionado = 'equipo';
  let sistemaClasificacionSeleccionado = 'simple';
  let filtroTipoActual = 'todos';
  let esEdicion = false;

  // Variables visuales
  let visualCardColor = '#E8836A';
  let visualHeroColor = '#0F1B2D';
  let visualCardFotoBase64 = null;
  let visualHeroFotoBase64 = null;
  let visualIconoBase64 = null;

  /* ---------- FECHA DEL DÍA EN EL HERO ---------- */
  const eyebrow = document.getElementById('torneos-eyebrow');
  if (eyebrow) {
    const hoy = new Date();
    const dias = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    eyebrow.textContent = `${dias[hoy.getDay()]}, ${hoy.getDate()} DE ${meses[hoy.getMonth()]}`;
  }

  /* ---------- CARGAR DESDE EL BACKEND ---------- */
  async function recargarTorneos() {
    try {
      const filtros = { limit: 50 };
      if (filtroFechaDesde) filtros.desde = filtroFechaDesde;
      if (filtroFechaHasta) filtros.hasta = filtroFechaHasta;
      if (filtroFechaDesde || filtroFechaHasta) {
        filtros.campoFecha = campoFechaActual;
      }

      const { data } = await listarTorneos(filtros);
      torneos = data;
      renderDisponibles();
      renderCreados();
      renderInscritos();
    } catch (err) {
      console.error('[torneos] Error al recargar:', err);
      toast('No se pudieron cargar los torneos', 'error');
      torneos = [];
    }
  }

  try {
    const { data } = await listarTorneos({ limit: 50 });
    torneos = data;
  } catch (err) {
    console.error('[torneos] Error al cargar:', err);
    toast('No se pudieron cargar los torneos', 'error');
    torneos = [];
  }

  /* ---------- REFS ---------- */
  const contDisponibles = document.getElementById('lista-torneos');
  const contCreados     = document.getElementById('lista-torneos-creados');
  const contInscritos   = document.getElementById('lista-torneos-inscritos');
  const panelDisponibles= document.getElementById('panel-torneos-disponibles');
  const panelCreados    = document.getElementById('panel-torneos-creados');
  const panelInscritos  = document.getElementById('panel-torneos-inscritos');
  const subtabs         = document.querySelectorAll('[data-tab-torneos]');
  const selectTipoTorneo   = document.getElementById('select-filtro-tipo-torneo');
  const selectEstadoTorneo = document.getElementById('select-filtro-estado-torneo');
  const btnCrear        = document.getElementById('btn-crear-torneo-hero');
  const inputBuscar     = document.getElementById('buscar-torneos');

  if (!contDisponibles) return null;

  if (btnCrear && user && !user.esPremium) {
    btnCrear.innerHTML += ` <span class="badge badge--warning" style="margin-left:8px; font-size:10px; padding:2px 6px; border-radius:4px; text-transform:uppercase; letter-spacing:0.5px;">Premium</span>`;
  }

  /* ---------- HELPERS ---------- */
  async function misEquiposComoCapitanOAdmin() {
    try {
      const { data } = await listarGrupos({ tipo: 'equipo', soloMios: 'true', limit: 50 });
      return data || [];
    } catch (err) {
      console.error('[torneos] Error al cargar equipos:', err);
      return [];
    }
  }

  /* =========================================================
     RENDER CARD (VERTICAL)
     ========================================================= */
  function renderCard(t, opciones = {}) {
    const { mostrarBadgeRol = null } = opciones;

    const inscritosCount = t.totalEquipos ?? 0;
    const porcentaje = Math.min(100, Math.round((inscritosCount / t.cuposEquipos) * 100));
    const lleno = inscritosCount >= t.cuposEquipos;

    const fechaLimiteVencida = t.fechaLimiteInscripcion && new Date(t.fechaLimiteInscripcion) < new Date();
    const cerrado = t.estado !== 'inscripcion' || fechaLimiteVencida;

    const soyOrganizador = t.soyOrganizador || String(t.organizador?.id) === String(user?.id);

    const badgeClase = lleno ? 'badge--danger'
                    : t.estado === 'en_curso' ? 'badge--info'
                    : cerrado ? 'badge--warning'
                    : 'badge--success';

    const badgeTexto = lleno ? 'Lleno'
                    : t.estado === 'en_curso' ? 'En curso'
                    : cerrado && t.estado === 'inscripcion' ? 'Inscripciones cerradas'
                    : t.estado === 'inscripcion' ? (t.libreInscripcion === false ? 'Inscripción' : 'Inscripción abierta')
                    : 'Finalizado';

    const precioHtml = t.precio === 0 ? 'Gratis' : `$${t.precio.toLocaleString('es-CL')}`;

    const cuposLibres = t.cuposEquipos - inscritosCount;
    const cuposTexto = lleno
      ? '<span style="color:var(--color-danger); font-weight:700">Lleno</span>'
      : `<span style="color:var(--color-success); font-weight:700">${cuposLibres} cupos</span>`;

    const fechaLimiteTexto = t.fechaLimiteInscripcion
      ? `Cierra el ${formatearFecha(t.fechaLimiteInscripcion)}`
      : 'Sin fecha límite';

    const color = colorDeporte(t.deporte);
    const iconoDeporte = emojiDeporte[t.deporte];
    
    // ⚡ Ícono personalizado o por defecto
    let iconoHtml = '';
    let esCustomIcono = false;
    if (t.iconoPersonalizado) {
      iconoHtml = `<img src="${t.iconoPersonalizado}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block" />`;
      esCustomIcono = true;
    } else {
      iconoHtml = iconoDeporte
        ? `<img src="${iconoDeporte}" alt="" style="width:30px;height:30px;object-fit:contain;display:block" />`
        : (t.emoji || ICONOS.trofeo);
    }

    // ⚡ Fondo de la Card (cardColor / cardFoto)
    let bgStyle = `background:${color.bg}; color:${color.fg}`;
    let imageBgStyle = '';
    if (t.cardFoto) {
      imageBgStyle = `background-image: url('${t.cardFoto}'); background-size: cover; background-position: center;`;
    } else if (t.cardColor) {
      bgStyle = `background: linear-gradient(135deg, ${t.cardColor} 0%, ${t.cardColor}DD 100%); color: #fff;`;
      imageBgStyle = `background: linear-gradient(135deg, ${t.cardColor} 0%, ${t.cardColor}DD 100%);`;
    }

    const tipoTexto = t.tipoParticipacion === 'individual' ? 'POR PERSONA' : 'POR EQUIPOS';
    const deporteUpper = (t.deporte || '').toUpperCase();

    const lapizHtml = soyOrganizador ? `
      <button class="tournament-card__edit" data-accion-torneo="editar" data-id="${t.id}" title="Editar torneo">
        ${ICONOS.lapiz}
      </button>
    ` : '';

    const badgeRolHtml = mostrarBadgeRol ? `<span class="badge badge--primary">${mostrarBadgeRol}</span>` : '';
    const deporteSlug = slugDeporte(t.deporte);

    return `
      <article class="tournament-card" data-id="${t.id}" data-deporte="${deporteSlug}">
        <div class="tournament-card__image">
          <div class="tournament-card__image-bg" style="${imageBgStyle}"></div>
          <button class="tournament-card__view" data-accion-torneo="ver" data-id="${t.id}">Ver detalles</button>
        </div>

        <div class="tournament-card__body">
          <div class="tournament-card__top">
            <div class="tournament-card__sport" style="${bgStyle}">
              ${iconoHtml}
            </div>
            <div class="tournament-card__top-right">
              ${badgeRolHtml}
              <span class="badge ${badgeClase}">${badgeTexto}</span>
              ${lapizHtml}
            </div>
          </div>

          <div class="tournament-card__eyebrow">${deporteUpper} · ${tipoTexto}</div>
          <h3 class="tournament-card__title">${t.nombre}</h3>

          <div class="tournament-card__meta">
            <span>${ICONOS.calendario} ${fechaLimiteTexto}</span>
            ${t.lugar ? `<span>${ICONOS.ubicacion} ${t.lugar}</span>` : ''}
          </div>

          <div class="tournament-card__progress-row">
            <span class="text-xs">${inscritosCount} / ${t.cuposEquipos} ${t.tipoParticipacion === 'individual' ? 'participantes' : 'equipos'}</span>
            ${cuposTexto}
          </div>
          <div class="tournament-card__progress">
            <div class="tournament-card__progress-bar" style="width:${porcentaje}%"></div>
          </div>

          <div class="tournament-card__bottom">
            <div class="tournament-card__price">${precioHtml}</div>
          </div>
        </div>
      </article>
    `;
  }

  /* =========================================================
     RENDERS DE PANELES
     ========================================================= */
  function renderDisponibles() {
    let lista = torneos;

    if (filtroTipoActual === 'individual') lista = lista.filter(t => t.tipoParticipacion === 'individual');
    if (filtroTipoActual === 'equipo')     lista = lista.filter(t => t.tipoParticipacion === 'equipo');
    if (filtroActual === 'inscripcion')    lista = lista.filter(t => t.estado === 'inscripcion');
    if (filtroActual === 'gratis')         lista = lista.filter(t => t.precio === 0);

    if (filtroBusqueda.trim()) {
      const q = filtroBusqueda.toLowerCase().trim();
      lista = lista.filter(t =>
        (t.nombre || '').toLowerCase().includes(q) ||
        (t.deporte || '').toLowerCase().includes(q) ||
        (t.lugar || '').toLowerCase().includes(q)
      );
    }

    if (lista.length === 0) {
      contDisponibles.innerHTML = `
        <div class="card" style="grid-column: 1 / -1;">
          <div class="empty-state">
            <div class="empty-state__icon">${ICONOS.buscar}</div>
            <p>No hay torneos con estos filtros.</p>
          </div>
        </div>`;
      return;
    }

    contDisponibles.innerHTML = lista.map(t => renderCard(t)).join('');
    conectarAcciones(contDisponibles);
  }

  function renderCreados() {
    const misCreados = torneos.filter(t =>
      t.soyOrganizador || t.soySubOrganizador || String(t.organizador?.id) === String(user?.id)
    );

    const countEl = document.getElementById('count-torneos-creados');
    if (countEl) countEl.textContent = misCreados.length;

    if (misCreados.length === 0) {
      const badgeHtml = !user?.esPremium 
        ? `<span class="badge badge--warning" style="margin-left:6px; font-size:10px; padding:2px 6px; border-radius:4px; text-transform:uppercase; letter-spacing:0.5px;">Premium</span>` 
        : '';

      contCreados.innerHTML = `
        <div class="card" style="grid-column: 1 / -1;">
          <div class="empty-state">
            <div class="empty-state__icon">👑</div>
            <p>Aún no has creado ningún torneo.</p>
            <button class="btn btn--primary mt-4" id="btn-vacio-crear-torneo">+ Crear mi primer torneo ${badgeHtml}</button>
          </div>
        </div>`;
      document.getElementById('btn-vacio-crear-torneo')?.addEventListener('click', () => abrirModalCrear());
      return;
    }

    contCreados.innerHTML = misCreados.map(t => {
      const esSubOrg = t.soySubOrganizador && !t.soyOrganizador;
      return renderCard(t, {
        mostrarBadgeRol: esSubOrg ? `${ICONOS.escudo} Sub-organizador` : `${ICONOS.corona} Creado por vos`,
      });
    }).join('');
    conectarAcciones(contCreados);
  }

  function renderInscritos() {
    const misInscritos = torneos.filter(t => {
      if (t.soyOrganizador || t.soySubOrganizador || String(t.organizador?.id) === String(user?.id)) return false;
      return t.miEquipoInscrito || t.miSolicitudPendiente || t.miInvitacionPendiente;
    });

    const countEl = document.getElementById('count-torneos-inscritos');
    if (countEl) countEl.textContent = misInscritos.length;

    if (misInscritos.length === 0) {
      contInscritos.innerHTML = `
        <div class="card" style="grid-column: 1 / -1;">
          <div class="empty-state">
            <div class="empty-state__icon">${ICONOS.check}</div>
            <p>No estás inscrito en ningún torneo.</p>
            <button class="btn btn--primary mt-4" id="btn-vacio-disponibles-torneos">Ver torneos disponibles</button>
          </div>
        </div>`;
      document.getElementById('btn-vacio-disponibles-torneos')?.addEventListener('click', () => cambiarTab('disponibles'));
      return;
    }

    contInscritos.innerHTML = misInscritos.map(t =>
      renderCard(t, { mostrarBadgeRol: `${ICONOS.check} Inscrito` })
    ).join('');
    conectarAcciones(contInscritos);
  }

  /* =========================================================
     CONECTAR ACCIONES
     ========================================================= */
  function conectarAcciones(contenedor) {
    contenedor.querySelectorAll('[data-accion-torneo]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const accion = btn.dataset.accionTorneo;
        const torneo = torneos.find(t => String(t.id) === String(id));
        if (!torneo) return;

        try {
          if (accion === 'ver') {
            window.location.hash = `#/torneo/${id}`;
            return;
          }

          if (accion === 'editar') {
            sessionStorage.setItem('torneoAEditar', String(id));
            window.location.hash = `#/torneo/${id}`;
            return;
          }

          if (accion === 'eliminar') {
            if (!confirm(`¿Eliminar "${torneo.nombre}"?`)) return;
            await eliminarTorneoAPI(id);
            toast('Torneo eliminado', 'info');
            await recargarTorneos();
            return;
          }

        } catch (err) {
          console.error('[torneos] Error en acción:', accion, err);
          toast(err.message || 'Error al ejecutar la acción', 'error');
        }
      });
    });
  }

  /* =========================================================
     SUB-PESTAÑAS Y FILTROS
     ========================================================= */
  function cambiarTab(tab) {
    subtabs.forEach(st => {
      st.classList.toggle('subtab--active', st.dataset.tabTorneos === tab);
    });
    panelDisponibles.classList.toggle('subpanel--active', tab === 'disponibles');
    panelCreados.classList.toggle('subpanel--active', tab === 'creados');
    panelInscritos.classList.toggle('subpanel--active', tab === 'inscritos');

    if (tab !== 'disponibles') {
      filtroBusqueda = '';
      if (inputBuscar) inputBuscar.value = '';

      filtroFechaDesde = '';
      filtroFechaHasta = '';
      if (inputFechaDesdeTorneo) inputFechaDesdeTorneo.value = '';
      if (inputFechaHastaTorneo) inputFechaHastaTorneo.value = '';
      chipsFechaTorneo.forEach(c => {
        c.classList.toggle('chip--active', c.dataset.filtroFechaTorneo === 'todos');
      });
    }
  }
  subtabs.forEach(st => st.addEventListener('click', () => cambiarTab(st.dataset.tabTorneos)));

  selectTipoTorneo?.addEventListener('change', (e) => {
    filtroTipoActual = e.target.value;
    renderDisponibles();
  });

  selectEstadoTorneo?.addEventListener('change', (e) => {
    filtroActual = e.target.value;
    renderDisponibles();
  });

  inputBuscar?.addEventListener('input', (e) => {
    filtroBusqueda = e.target.value;
    renderDisponibles();
  });

  const chipsFechaTorneo = document.querySelectorAll('[data-filtro-fecha-torneo]');
  const inputFechaDesdeTorneo = document.getElementById('filtro-fecha-desde-torneo');
  const inputFechaHastaTorneo = document.getElementById('filtro-fecha-hasta-torneo');

  function calcularFechaRapidaTorneo(tipo) {
    const hoy = new Date();
    let desde = '';
    let hasta = '';

    const formatear = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (tipo === 'hoy') {
      desde = formatear(hoy);
      hasta = formatear(hoy);
    } else if (tipo === 'manana') {
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);
      desde = formatear(manana);
      hasta = formatear(manana);
    } else if (tipo === 'semana') {
      desde = formatear(hoy);
      const finSemana = new Date(hoy);
      finSemana.setDate(finSemana.getDate() + 7);
      hasta = formatear(finSemana);
    }

    filtroFechaDesde = desde;
    filtroFechaHasta = hasta;
    if (inputFechaDesdeTorneo) inputFechaDesdeTorneo.value = desde;
    if (inputFechaHastaTorneo) inputFechaHastaTorneo.value = hasta;
  }

  function handleChipFechaTorneoClick(e) {
    chipsFechaTorneo.forEach(c => c.classList.remove('chip--active'));
    e.currentTarget.classList.add('chip--active');
    calcularFechaRapidaTorneo(e.currentTarget.dataset.filtroFechaTorneo);
    recargarTorneos();
  }

  function handleInputDesdeTorneoChange(e) {
    filtroFechaDesde = e.target.value;
    chipsFechaTorneo.forEach(c => c.classList.remove('chip--active'));
    recargarTorneos();
  }

  function handleInputHastaTorneoChange(e) {
    filtroFechaHasta = e.target.value;
    chipsFechaTorneo.forEach(c => c.classList.remove('chip--active'));
    recargarTorneos();
  }

  chipsFechaTorneo.forEach(chip => chip.addEventListener('click', handleChipFechaTorneoClick));
  inputFechaDesdeTorneo?.addEventListener('change', handleInputDesdeTorneoChange);
  inputFechaHastaTorneo?.addEventListener('change', handleInputHastaTorneoChange);

  const botonesCampoFecha = document.querySelectorAll('[data-campo-fecha]');

  function handleCampoFechaClick(e) {
    const nuevo = e.currentTarget.dataset.campoFecha;
    if (nuevo === campoFechaActual) return;

    campoFechaActual = nuevo;
    botonesCampoFecha.forEach(b => {
      b.classList.toggle('campo-fecha-btn--active', b.dataset.campoFecha === nuevo);
    });

    if (filtroFechaDesde || filtroFechaHasta) {
      recargarTorneos();
    }
  }

  botonesCampoFecha.forEach(b => b.addEventListener('click', handleCampoFechaClick));

  /* =========================================================
     MODAL CREAR / EDITAR — REFS
     ========================================================= */
  const selectDeporte = document.getElementById('torneo-deporte');
  if (selectDeporte) {
    selectDeporte.innerHTML = '<option value="">Selecciona un deporte...</option>' +
      deportes.map(d => `<option value="${d}">${d}</option>`).join('');
  }

  const checkGratis = document.getElementById('torneo-gratis');
  const precioWrapper = document.getElementById('torneo-precio-wrapper');
  checkGratis?.addEventListener('change', () => {
    precioWrapper?.classList.toggle('hidden', checkGratis.checked);
  });

  const opcionesModalidad   = document.querySelectorAll('[data-modalidad]');
  const configLigaWrapper   = document.getElementById('config-liga-wrapper');
  const inputPuntosVictoria = document.getElementById('torneo-puntos-victoria');
  const inputPuntosEmpate   = document.getElementById('torneo-puntos-empate');
  const inputPuntosDerrota  = document.getElementById('torneo-puntos-derrota');
  const checkPermiteEmpate  = document.getElementById('torneo-permite-empate');
  const inputEquiposClasif  = document.getElementById('torneo-equipos-clasifican');
  const checkIncluyeEstad   = document.getElementById('torneo-incluye-estadisticas');
  const inputFechaLimite    = document.getElementById('torneo-fecha-limite');

  const checkIdaVuelta      = document.getElementById('torneo-ida-vuelta');
  const autoFixtureWrapper  = document.getElementById('auto-fixture-wrapper');
  const checkAutoFixture    = document.getElementById('torneo-auto-fixture');

  const sistemaWrapper   = document.getElementById('sistema-clasificacion-wrapper');
  const sistemaGrid      = document.getElementById('sistema-clasificacion-grid');
  const sistemaHint      = document.getElementById('sistema-clasificacion-hint');
  const opcionesSistema  = sistemaGrid
    ? sistemaGrid.querySelectorAll('[data-sistema-clasificacion]')
    : [];

  const nivelGridTorneo     = document.getElementById('nivel-grid-torneo');
  const libreInscWrapper    = document.getElementById('libre-inscripcion-wrapper');
  const checkLibreInsc      = document.getElementById('torneo-libre-inscripcion');
  const avisoPago           = document.getElementById('aviso-pago');

  const opcionesTipoParticipacion = document.querySelectorAll('[data-tipo-participacion]');
  const hintTipoParticipacion     = document.getElementById('hint-tipo-participacion');

  /* ---------- LÓGICA DE PESTAÑAS MODAL ---------- */
  const tabsModal = document.querySelectorAll('[data-tab-torneo]');
  const tabTecnicos = document.getElementById('torneo-tab-tecnicos');
  const tabVisual = document.getElementById('torneo-tab-visual');

  tabsModal.forEach(tab => {
    tab.addEventListener('click', () => {
      tabsModal.forEach(t => {
        t.classList.remove('active');
        t.style.borderBottomColor = 'transparent';
        t.style.color = 'var(--color-text-muted)';
        t.style.fontWeight = '600';
      });
      tab.classList.add('active');
      tab.style.borderBottomColor = 'var(--color-primary)';
      tab.style.color = 'var(--color-primary)';
      tab.style.fontWeight = '700';

      if (tab.dataset.tabTorneo === 'tecnicos') {
        tabTecnicos.classList.remove('hidden');
        tabVisual.classList.add('hidden');
      } else {
        tabTecnicos.classList.add('hidden');
        tabVisual.classList.remove('hidden');
      }
    });
  });

  // ⚡ Paleta idéntica a la de Perfil
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

  function renderPaleta(containerId, colorSeleccionado, onChange) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    cont.innerHTML = HERO_COLORS.map(c => `
      <button type="button" class="perfil-color-btn ${c.from === colorSeleccionado ? 'active' : ''}" data-color="${c.from}" title="${c.label}" style="background: linear-gradient(135deg, ${c.from} 0%, ${c.to} 100%); width:32px; height:32px; border-radius:50%; border:none; cursor:pointer; margin:0 4px;"></button>
    `).join('');

    cont.querySelectorAll('.perfil-color-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        cont.querySelectorAll('.perfil-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onChange(btn.dataset.color);
      });
    });
  }

  function inicializarVisuales(torneo = null) {
    visualCardColor = torneo?.cardColor || '#E8836A';
    visualHeroColor = torneo?.heroColor || '#0F1B2D';
    visualCardFotoBase64 = torneo?.cardFoto || null;
    visualHeroFotoBase64 = torneo?.heroFoto || null;
    visualIconoBase64 = torneo?.iconoPersonalizado || null;

    const wrapperBasico = document.getElementById('torneo-visual-basico');
    const wrapperPremium = document.getElementById('torneo-visual-premium');

    // ⚡ FIX: Si no encuentra los contenedores, avisa y sale sin romper
    if (!wrapperBasico || !wrapperPremium) {
      console.warn('[torneos] No se encontraron los divs de la pestaña Visual. Verificá que el HTML del modal esté actualizado.');
      return;
    }

    if (user?.esPremium) {
      wrapperBasico.classList.add('hidden');
      wrapperPremium.classList.remove('hidden');

      document.getElementById('torneo-card-color').value = visualCardColor;
      document.getElementById('torneo-hero-color').value = visualHeroColor;

      const previewCard = document.getElementById('torneo-card-foto-preview');
      const wrapCard = document.getElementById('torneo-card-foto-preview-wrapper');
      const btnQuitarCard = document.getElementById('torneo-card-foto-quitar');
      if (visualCardFotoBase64) { previewCard.src = visualCardFotoBase64; wrapCard.classList.remove('hidden'); btnQuitarCard.classList.remove('hidden'); }
      else { wrapCard.classList.add('hidden'); btnQuitarCard.classList.add('hidden'); }

      const previewHero = document.getElementById('torneo-hero-foto-preview');
      const wrapHero = document.getElementById('torneo-hero-foto-preview-wrapper');
      const btnQuitarHero = document.getElementById('torneo-hero-foto-quitar');
      if (visualHeroFotoBase64) { previewHero.src = visualHeroFotoBase64; wrapHero.classList.remove('hidden'); btnQuitarHero.classList.remove('hidden'); }
      else { wrapHero.classList.add('hidden'); btnQuitarHero.classList.add('hidden'); }

      const previewIcono = document.getElementById('torneo-icono-preview-wrapper');
      const btnQuitarIcono = document.getElementById('torneo-icono-quitar');
      if (visualIconoBase64) { previewIcono.innerHTML = `<img src="${visualIconoBase64}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />`; btnQuitarIcono.classList.remove('hidden'); }
      else { previewIcono.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-text-muted)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`; btnQuitarIcono.classList.add('hidden'); }

      document.getElementById('torneo-card-foto-file').onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        if (file.size > 1.5 * 1024 * 1024) return toast('Máx 1.5 MB', 'error');
        const reader = new FileReader();
        reader.onload = (ev) => { visualCardFotoBase64 = ev.target.result; previewCard.src = visualCardFotoBase64; wrapCard.classList.remove('hidden'); btnQuitarCard.classList.remove('hidden'); };
        reader.readAsDataURL(file); e.target.value = '';
      };
      document.getElementById('torneo-card-foto-quitar').onclick = () => { visualCardFotoBase64 = null; wrapCard.classList.add('hidden'); btnQuitarCard.classList.add('hidden'); document.getElementById('torneo-card-foto-file').value = ''; };

      document.getElementById('torneo-hero-foto-file').onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        if (file.size > 1.5 * 1024 * 1024) return toast('Máx 1.5 MB', 'error');
        const reader = new FileReader();
        reader.onload = (ev) => { visualHeroFotoBase64 = ev.target.result; previewHero.src = visualHeroFotoBase64; wrapHero.classList.remove('hidden'); btnQuitarHero.classList.remove('hidden'); };
        reader.readAsDataURL(file); e.target.value = '';
      };
      document.getElementById('torneo-hero-foto-quitar').onclick = () => { visualHeroFotoBase64 = null; wrapHero.classList.add('hidden'); btnQuitarHero.classList.add('hidden'); document.getElementById('torneo-hero-foto-file').value = ''; };

      document.getElementById('torneo-icono-file').onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        if (file.size > 1 * 1024 * 1024) return toast('Máx 1 MB', 'error');
        const reader = new FileReader();
        reader.onload = (ev) => { visualIconoBase64 = ev.target.result; previewIcono.innerHTML = `<img src="${visualIconoBase64}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />`; btnQuitarIcono.classList.remove('hidden'); };
        reader.readAsDataURL(file); e.target.value = '';
      };
      document.getElementById('torneo-icono-quitar').onclick = () => { visualIconoBase64 = null; previewIcono.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-text-muted)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`; btnQuitarIcono.classList.add('hidden'); document.getElementById('torneo-icono-file').value = ''; };

    } else {
      wrapperPremium.classList.add('hidden');
      wrapperBasico.classList.remove('hidden');
      renderPaleta('torneo-card-color-picker-basico', visualCardColor, (c) => visualCardColor = c);
      renderPaleta('torneo-hero-color-picker-basico', visualHeroColor, (c) => visualHeroColor = c);
    }
  }

  /* ---------- Cambio de modalidad ---------- */
  opcionesModalidad.forEach(op => {
    op.addEventListener('click', () => {
      opcionesModalidad.forEach(o => o.classList.remove('active'));
      op.classList.add('active');
      modalidadSeleccionada = op.dataset.modalidad;
      actualizarConfiguracionPorModalidad();
      actualizarAutoFixtureVisibility();
    });
  });

  function actualizarConfiguracionPorModalidad() {
    if (configLigaWrapper) {
      configLigaWrapper.style.display = modalidadSeleccionada === 'liga' ? '' : 'none';
    }
  }

  function actualizarAutoFixtureVisibility() {
    if (!autoFixtureWrapper) return;

    if (modalidadSeleccionada === 'eliminacion') {
      autoFixtureWrapper.classList.remove('hidden');
    } else {
      autoFixtureWrapper.classList.add('hidden');
      if (checkAutoFixture) checkAutoFixture.checked = false;
    }
  }

  function actualizarSistemaClasificacion(deporte) {
    if (!sistemaWrapper || !sistemaGrid) return;

    sistemaWrapper.classList.remove('hidden');

    let sistemaSugerido = 'simple';
    if (deporte) {
      if (DEPORTES_TIEMPO.has(deporte)) sistemaSugerido = 'tiempo';
      else if (DEPORTES_PUNTOS.has(deporte)) sistemaSugerido = 'puntos';
    }

    sistemaClasificacionSeleccionado = sistemaSugerido;

    opcionesSistema.forEach(op => {
      op.classList.toggle('active', op.dataset.sistemaClasificacion === sistemaSugerido);
    });

    actualizarHintSistema();
  }

  function actualizarHintSistema() {
    if (!sistemaHint) return;
    const textos = {
      simple: 'Se juega con marcador (goles, puntos, sets).',
      tiempo: 'El MENOR tiempo gana. El organizador carga minutos, segundos y centésimas.',
      puntos: 'El MAYOR puntaje gana.',
    };
    sistemaHint.textContent = textos[sistemaClasificacionSeleccionado] || '';
  }

  opcionesSistema.forEach(op => {
    op.addEventListener('click', () => {
      opcionesSistema.forEach(o => o.classList.remove('active'));
      op.classList.add('active');
      sistemaClasificacionSeleccionado = op.dataset.sistemaClasificacion;
      actualizarHintSistema();
    });
  });

  opcionesTipoParticipacion.forEach(op => {
    op.addEventListener('click', () => {
      opcionesTipoParticipacion.forEach(o => o.classList.remove('active'));
      op.classList.add('active');
      tipoParticipacionSeleccionado = op.dataset.tipoParticipacion;
      actualizarHintTipoParticipacion();
    });
  });

  function actualizarHintTipoParticipacion() {
    if (!hintTipoParticipacion) return;
    if (tipoParticipacionSeleccionado === 'individual') {
      hintTipoParticipacion.innerHTML = `${ICONOS.usuario} Los usuarios se inscriben solos, sin necesidad de equipo.`;
    } else {
      hintTipoParticipacion.innerHTML = `${ICONOS.usuarios} Los equipos se inscriben al torneo (capitán o admin).`;
    }
  }

  selectDeporte?.addEventListener('change', () => {
    const deporte = selectDeporte.value;
    if (!deporte) {
      actualizarSistemaClasificacion('');
      return;
    }

    if (DEPORTES_INDIVIDUALES.has(deporte)) {
      opcionesTipoParticipacion.forEach(op => {
        op.classList.toggle('active', op.dataset.tipoParticipacion === 'individual');
      });
      tipoParticipacionSeleccionado = 'individual';
      actualizarHintTipoParticipacion();
    }

    actualizarSistemaClasificacion(deporte);
  });

  const NIVELES_TORNEO = [
    { valor: 'amistoso', label: 'Amistoso', descripcion: 'Sin exigencia' },
    { valor: 'medio', label: 'Nivel Medio', descripcion: 'Nivel intermedio' },
    { valor: 'avanzado', label: 'Nivel Avanzado', descripcion: 'Alto nivel' },
  ];

  if (nivelGridTorneo) {
    nivelGridTorneo.innerHTML = NIVELES_TORNEO.map((n, i) => `
      <div class="nivel-opcion ${i === 0 ? 'active' : ''}" data-nivel-torneo="${n.valor}">
        <div class="nivel-opcion__label">${n.label}</div>
        <div class="nivel-opcion__desc">${n.descripcion}</div>
      </div>
    `).join('');

    nivelGridTorneo.querySelectorAll('[data-nivel-torneo]').forEach(op => {
      op.addEventListener('click', () => {
        nivelGridTorneo.querySelectorAll('[data-nivel-torneo]').forEach(o => o.classList.remove('active'));
        op.classList.add('active');
        nivelTorneoSeleccionado = op.dataset.nivelTorneo;
        actualizarLibreInscripcion();
      });
    });
  }

  function actualizarLibreInscripcion() {
    const esGratis = checkGratis?.checked ?? true;
    const nivelExigente = nivelTorneoSeleccionado !== 'amistoso';

    if (!libreInscWrapper || !avisoPago) return;

    if (!esGratis) {
      libreInscWrapper.classList.add('hidden');
      avisoPago.classList.add('show');
      return;
    }

    if (nivelExigente) {
      libreInscWrapper.classList.remove('hidden');
      avisoPago.classList.remove('show');
      return;
    }

    libreInscWrapper.classList.add('hidden');
    avisoPago.classList.remove('show');
    if (checkLibreInsc) checkLibreInsc.checked = true;
  }

  checkGratis?.addEventListener('change', () => {
    actualizarLibreInscripcion();
  });

  /* ---------- Reset formulario ---------- */
  function resetearFormulario() {
    document.getElementById('torneo-nombre').value = '';
    document.getElementById('torneo-deporte').value = '';
    document.getElementById('torneo-fecha-inicio').value = '';
    document.getElementById('torneo-fecha-fin').value = '';
    document.getElementById('torneo-fecha-limite').value = '';
    document.getElementById('torneo-lugar').value = '';
    document.getElementById('torneo-equipos').value = '8';
    document.getElementById('torneo-gratis').checked = true;
    document.getElementById('torneo-precio').value = '20000';
    document.getElementById('torneo-descripcion').value = '';
    document.getElementById('torneo-precio-wrapper').classList.add('hidden');

    modalidadSeleccionada = 'liga';
    esEdicion = false;
    opcionesModalidad.forEach(op => {
      op.classList.toggle('active', op.dataset.modalidad === 'liga');
    });
    actualizarConfiguracionPorModalidad();
    actualizarAutoFixtureVisibility();

    tipoParticipacionSeleccionado = 'equipo';
    opcionesTipoParticipacion.forEach(op => {
      op.classList.toggle('active', op.dataset.tipoParticipacion === 'equipo');
    });
    actualizarHintTipoParticipacion();

    sistemaClasificacionSeleccionado = 'simple';
    opcionesSistema.forEach(op => {
      op.classList.toggle('active', op.dataset.sistemaClasificacion === 'simple');
    });
    sistemaWrapper?.classList.remove('hidden');

    nivelTorneoSeleccionado = 'amistoso';
    if (nivelGridTorneo) {
      nivelGridTorneo.querySelectorAll('[data-nivel-torneo]').forEach(op => {
        op.classList.toggle('active', op.dataset.nivelTorneo === 'amistoso');
      });
    }
    if (checkLibreInsc) checkLibreInsc.checked = true;
    actualizarLibreInscripcion();

    if (checkAutoFixture) checkAutoFixture.checked = false;

    if (inputPuntosVictoria) inputPuntosVictoria.value = '3';
    if (inputPuntosEmpate)   inputPuntosEmpate.value = '1';
    if (inputPuntosDerrota)  inputPuntosDerrota.value = '0';
    if (checkPermiteEmpate)  checkPermiteEmpate.checked = true;
    if (checkIdaVuelta)      checkIdaVuelta.checked = false;
    if (inputEquiposClasif)  inputEquiposClasif.value = '';
    if (checkIncluyeEstad)   checkIncluyeEstad.checked = false;
  }

  function abrirModalCrear() {
    if (!user?.esPremium) {
      toast('La creación de torneos es exclusiva del plan Premium.', 'error');
      return;
    }

    resetearFormulario();
    document.getElementById('torneo-modal-titulo').textContent = 'Crear torneo';
    document.getElementById('btn-guardar-torneo').textContent = 'Crear torneo';
    
    // ⚡ FIX: Buscar las pestañas dinámicamente para que no falle
    const tabs = document.querySelectorAll('[data-tab-torneo]');
    if (tabs.length > 0) {
      tabs[0].click(); 
    }
    
    inicializarVisuales(null); // ⚡ Enviar null porque es un torneo nuevo

    document.getElementById('btn-guardar-torneo').onclick = () => guardarNuevo();
    abrirModal('modal-crear-torneo');
  }

  function abrirModalEditar(torneo) {
    document.getElementById('torneo-modal-titulo').textContent = 'Editar torneo';
    document.getElementById('btn-guardar-torneo').textContent = 'Guardar cambios';

    document.getElementById('torneo-nombre').value = torneo.nombre;
    document.getElementById('torneo-deporte').value = torneo.deporte;
    document.getElementById('torneo-fecha-inicio').value = (torneo.fechaInicio || '').split('T')[0];
    document.getElementById('torneo-fecha-fin').value = torneo.fechaFin ? torneo.fechaFin.split('T')[0] : '';
    document.getElementById('torneo-fecha-limite').value = torneo.fechaLimiteInscripcion ? torneo.fechaLimiteInscripcion.split('T')[0] : '';
    document.getElementById('torneo-lugar').value = torneo.lugar || '';
    document.getElementById('torneo-equipos').value = torneo.cuposEquipos;
    document.getElementById('torneo-descripcion').value = torneo.descripcion || '';

    const gratis = torneo.precio === 0;
    document.getElementById('torneo-gratis').checked = gratis;
    document.getElementById('torneo-precio').value = gratis ? '20000' : torneo.precio;
    document.getElementById('torneo-precio-wrapper').classList.toggle('hidden', gratis);

    esEdicion = true;
    modalidadSeleccionada = torneo.modalidad || 'liga';
    opcionesModalidad.forEach(op => op.classList.toggle('active', op.dataset.modalidad === modalidadSeleccionada));
    actualizarConfiguracionPorModalidad();

    if (checkAutoFixture) checkAutoFixture.checked = torneo.autoFixture === true;
    actualizarAutoFixtureVisibility();

    tipoParticipacionSeleccionado = torneo.tipoParticipacion || 'equipo';
    opcionesTipoParticipacion.forEach(op => op.classList.toggle('active', op.dataset.tipoParticipacion === tipoParticipacionSeleccionado));
    actualizarHintTipoParticipacion();

    actualizarSistemaClasificacion(torneo.deporte);
    const sistemaGuardado = torneo.sistemaClasificacion || 'simple';
    sistemaClasificacionSeleccionado = sistemaGuardado;
    opcionesSistema.forEach(op => op.classList.toggle('active', op.dataset.sistemaClasificacion === sistemaGuardado));
    actualizarHintSistema();

    nivelTorneoSeleccionado = torneo.nivel || 'amistoso';
    if (nivelGridTorneo) {
      nivelGridTorneo.querySelectorAll('[data-nivel-torneo]').forEach(op => op.classList.toggle('active', op.dataset.nivelTorneo === nivelTorneoSeleccionado));
    }
    if (checkLibreInsc) checkLibreInsc.checked = torneo.libreInscripcion !== false;
    actualizarLibreInscripcion();

    if (inputPuntosVictoria) inputPuntosVictoria.value = String(torneo.puntosVictoria ?? 3);
    if (inputPuntosEmpate)   inputPuntosEmpate.value = String(torneo.puntosEmpate ?? 1);
    if (inputPuntosDerrota)  inputPuntosDerrota.value = String(torneo.puntosDerrota ?? 0);
    if (checkPermiteEmpate)  checkPermiteEmpate.checked = torneo.permiteEmpate !== false;
    if (checkIdaVuelta)      checkIdaVuelta.checked = torneo.idaYVuelta === true;
    if (inputEquiposClasif)  inputEquiposClasif.value = torneo.equiposClasifican ?? '';
    if (checkIncluyeEstad)   checkIncluyeEstad.checked = !!torneo.incluyeEstadisticas;

    // ⚡ FIX: Buscar las pestañas dinámicamente
    const tabs = document.querySelectorAll('[data-tab-torneo]');
    if (tabs.length > 0) {
      tabs[0].click(); 
    }
    
    inicializarVisuales(torneo);

    document.getElementById('btn-guardar-torneo').onclick = () => guardarEdicion(torneo);
    abrirModal('modal-crear-torneo');
  }

  function leerFormulario() {
    const nombre       = document.getElementById('torneo-nombre').value.trim();
    const deporte      = document.getElementById('torneo-deporte').value;
    const fechaInicio  = document.getElementById('torneo-fecha-inicio').value;
    const fechaFin     = document.getElementById('torneo-fecha-fin').value;
    const fechaLimite  = document.getElementById('torneo-fecha-limite').value;
    const lugar        = document.getElementById('torneo-lugar').value.trim();
    const cuposEquipos = Number(document.getElementById('torneo-equipos').value);
    const esGratis     = document.getElementById('torneo-gratis').checked;
    const precio       = esGratis ? 0 : Number(document.getElementById('torneo-precio').value);
    const descripcion  = document.getElementById('torneo-descripcion').value.trim();

    if (!nombre)   { toast('Ingresa un nombre', 'error'); return null; }
    if (!deporte)  { toast('Selecciona un deporte', 'error'); return null; }
    if (!fechaInicio) { toast('Selecciona fecha de inicio', 'error'); return null; }
    if (!lugar)    { toast('Ingresa un lugar', 'error'); return null; }
    if (cuposEquipos < 2) { toast('Mínimo 2 equipos', 'error'); return null; }
    if (!esGratis && precio < 0) { toast('El precio no puede ser negativo', 'error'); return null; }

    const puntosVictoria = Number(inputPuntosVictoria?.value ?? 3);
    const puntosEmpate   = Number(inputPuntosEmpate?.value ?? 1);
    const puntosDerrota  = Number(inputPuntosDerrota?.value ?? 0);
    const permiteEmpate  = checkPermiteEmpate?.checked ?? true;
    const equiposClasificanRaw = inputEquiposClasif?.value?.trim() || '';
    const equiposClasifican = equiposClasificanRaw ? Number(equiposClasificanRaw) : null;
    const incluyeEstadisticas = checkIncluyeEstad?.checked ?? false;

    const libreInscripcion = checkLibreInsc ? checkLibreInsc.checked : true;
    const idaYVuelta = checkIdaVuelta ? checkIdaVuelta.checked : false;
    const autoFixture = (modalidadSeleccionada === 'eliminacion' && checkAutoFixture)
      ? checkAutoFixture.checked
      : false;

    const sistemaClasificacion = sistemaClasificacionSeleccionado || 'simple';

    return {
      nombre,
      deporte,
      fechaInicio: new Date(`${fechaInicio}T00:00:00`).toISOString(),
      fechaFin: fechaFin ? new Date(`${fechaFin}T00:00:00`).toISOString() : null,
      fechaLimiteInscripcion: fechaLimite ? new Date(`${fechaLimite}T23:59:59`).toISOString() : null,
      lugar,
      cuposEquipos,
      precio,
      descripcion: descripcion || null,
      modalidad: modalidadSeleccionada,
      nivel: nivelTorneoSeleccionado,
      libreInscripcion,
      tipoParticipacion: tipoParticipacionSeleccionado,
      idaYVuelta,
      autoFixture,
      sistemaClasificacion,
      puntosVictoria,
      puntosEmpate,
      puntosDerrota,
      permiteEmpate,
      equiposClasifican,
      incluyeEstadisticas,
    };
  }

  async function guardarNuevo() {
    const datos = leerFormulario();
    if (!datos) return;

    const emoji = emojiDeporte[datos.deporte] || ICONOS.trofeo;

    if (user?.esPremium) {
      datos.cardColor = document.getElementById('torneo-card-color').value;
      datos.heroColor = document.getElementById('torneo-hero-color').value;
      datos.cardFoto = visualCardFotoBase64;
      datos.heroFoto = visualHeroFotoBase64;
      datos.iconoPersonalizado = visualIconoBase64;
    } else {
      datos.cardColor = visualCardColor;
      datos.heroColor = visualHeroColor;
    }

    const btn = document.getElementById('btn-guardar-torneo');
    btn.disabled = true;
    btn.textContent = 'Creando...';

    try {
      await crearTorneoAPI({ ...datos, emoji });
      toast('¡Torneo creado!', 'success');

      cerrarModal('modal-crear-torneo');

      filtroActual = 'todos';
      filtroTipoActual = 'todos';
      if (selectEstadoTorneo) selectEstadoTorneo.value = 'todos';
      if (selectTipoTorneo) selectTipoTorneo.value = 'todos';
      await recargarTorneos();
      cambiarTab('creados');
    } catch (err) {
      console.error('[torneos] Error al crear:', err);
      toast(err.message || 'No se pudo crear el torneo', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Crear torneo';
    }
  }

  async function guardarEdicion(torneo) {
    const datos = leerFormulario();
    if (!datos) return;

    const emoji = emojiDeporte[datos.deporte] || ICONOS.trofeo;

    if (user?.esPremium) {
      datos.cardColor = document.getElementById('torneo-card-color').value;
      datos.heroColor = document.getElementById('torneo-hero-color').value;
      datos.cardFoto = visualCardFotoBase64;
      datos.heroFoto = visualHeroFotoBase64;
      datos.iconoPersonalizado = visualIconoBase64;
    } else {
      datos.cardColor = visualCardColor;
      datos.heroColor = visualHeroColor;
    }

    const btn = document.getElementById('btn-guardar-torneo');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      await editarTorneoAPI(torneo.id, { ...datos, emoji });
      toast('Torneo actualizado', 'success');

      cerrarModal('modal-crear-torneo');
      await recargarTorneos();

      const torneoAEditar = sessionStorage.getItem('torneoAEditar');
      if (torneoAEditar) {
        sessionStorage.removeItem('torneoAEditar');
        window.location.hash = `#/torneo/${torneoAEditar}`;
      }
    } catch (err) {
      console.error('[torneos] Error al editar:', err);
      toast(err.message || 'No se pudo actualizar el torneo', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar cambios';
    }
  }

  btnCrear?.addEventListener('click', abrirModalCrear);

  document.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
    btn.addEventListener('click', () => cerrarModal(btn.dataset.cerrarModal));
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => { 
      if (e.target === backdrop) cerrarModal(backdrop.id); 
    });
  });

  window.addEventListener('abrir-editar-torneo', (e) => {
    const torneo = e.detail;
    if (torneo) abrirModalEditar(torneo);
  });

  await recargarTorneos();

  return () => {
    chipsFechaTorneo.forEach(chip => chip.removeEventListener('click', handleChipFechaTorneoClick));
    inputFechaDesdeTorneo?.removeEventListener('change', handleInputDesdeTorneoChange);
    inputFechaHastaTorneo?.removeEventListener('change', handleInputHastaTorneoChange);
    botonesCampoFecha.forEach(b => b.removeEventListener('click', handleCampoFechaClick));
  };
}