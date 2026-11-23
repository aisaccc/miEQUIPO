import { getSesion } from '../auth.js';
import { toast, formatearFecha, abrirModal, cerrarModal } from '../components.js';
import { listarGrupos, obtenerGrupo } from '../services/grupos.service.js';
import {
  obtenerTorneo,
  editarTorneo as editarTorneoAPI,
  eliminarTorneo as eliminarTorneoAPI,
  guardarTorneo as guardarTorneoAPI,
  cerrarTorneo as cerrarTorneoAPI,
  inscribirEquipo as inscribirEquipoAPI,
  cancelarInscripcion as cancelarInscripcionAPI,
  gestionarSolicitud as gestionarSolicitudAPI,
  expulsarEquipo as expulsarEquipoAPI,
  invitarEquipo as invitarEquipoAPI,
  responderInvitacion as responderInvitacionAPI,
  invitarOrganizador as invitarOrganizadorAPI,
  responderInvitacionOrganizador as responderInvOrgAPI,
  cancelarInvitacionOrganizador as cancelarInvOrgAPI,
  quitarOrganizador as quitarOrganizadorAPI,
  crearPartidoTorneo as crearPartidoTorneoAPI,
  editarPartidoTorneo as editarPartidoTorneoAPI,
  eliminarPartidoTorneo as eliminarPartidoTorneoAPI,
  editarCruce as editarCruceAPI,
  cargarResultado as cargarResultadoAPI,
  generarFixtureLiga as generarFixtureLigaAPI,
  armarFixtureAleatorio as armarFixtureAleatorioAPI,
  armarFixtureManual as armarFixtureManualAPI,
  confirmarFixture as confirmarFixtureAPI,
  crearJornada as crearJornadaAPI,
  eliminarJornada as eliminarJornadaAPI,
  guardarJornadaBulk as guardarJornadaBulkAPI,
} from '../services/torneos.service.js';

import {
  listarCanales as listarCanalesAPI,
  obtenerCanal as obtenerCanalAPI,
  listarMensajesDeCanal as listarMensajesDeCanalAPI,
  enviarMensajeACanal as enviarMensajeACanalAPI,
  marcarCanalLeido as marcarCanalLeidoAPI,
  eliminarMensajeParaMi,
  eliminarMensajeParaTodos,
} from '../services/mensajes.service.js';

import { conectarAccionesMensaje } from '../utils/mensaje-acciones.js';
import { listarPublicacionesDeTorneo as listarPubsTorneoAPI } from '../services/publicaciones.service.js';
import { renderFeedPublicaciones, abrirModalCrearPublicacionCompartido } from '../utils/publicaciones-ui.js';
import { buscarUsuarios as buscarUsuariosAPI } from '../services/usuarios.service.js';
import { ICONOS } from '../utils/iconos.js';
import { deportes } from '../data-mock.js';
import { renderGrupoPublico } from '../utils/grupo-publico.js';
import {
  getReglasDeporte, esPorSets, permiteDesempate, formatearResultado,
  calcularGanador, esPorTiempo, esPorPuntos, getSistemaEfectivo,
  formatearTiempo, parsearTiempo,
} from '../utils/reglas-deporte.js';
import { abrirRecortadorImagen } from '../components.js';

function formatoDeDeporte(deporte) {
  const reglas = getReglasDeporte(deporte);
  let campo = 'goles';
  if (reglas.tipo === 'sets') campo = 'sets';
  else if (reglas.labelMarcador === 'Puntos') campo = 'puntos';
  else if (reglas.labelMarcador === 'Carreras') campo = 'carreras';
  return { campo, label: reglas.labelMarcador || 'Resultado' };
}

// Resultado de boxeo compatible con liga y eliminación (sin tablas nuevas).
function formatearMarcadorTorneo(deporte, resultado, sistema) {
  if (deporte === 'Boxeo' && resultado?.metodo === 'KO') {
    return resultado.ganador === 'local' ? 'KO · Local' : 'KO · Visitante';
  }
  return formatearResultado(deporte, resultado, sistema);
}
/* ⚡ Helper: devuelve { clase, estilo } del marco del ícono */
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

const FASES_LABEL = {
  '64avos': '64avos', '32avos': '32avos', '16avos': '16avos', '8vos': 'Octavos',
  'cuartos': 'Cuartos', 'semis': 'Semis', 'final': 'Final', 'tercer_puesto': '3er Puesto',
};
const FASES_ORDEN = ['64avos', '32avos', '16avos', '8vos', 'cuartos', 'semis', 'final', 'tercer_puesto'];

const DEPORTES_INDIVIDUALES_DET = new Set([
  'Tenis', 'Pádel', 'Squash', 'Tenis de mesa', 'Bádminton',
  'Golf', 'Natación', 'Atletismo', 'Ciclismo', 'Surf', 'Escalada', 'Boxeo',
]);
const DEPORTES_TIEMPO_DET = new Set(['Natación', 'Atletismo', 'Ciclismo']);
const DEPORTES_PUNTOS_DET = new Set(['Escalada', 'Surf', 'Boxeo']);

const NIVELES_TORNEO_DET = [
  { valor: 'amistoso', label: 'Amistoso', descripcion: 'Sin exigencia' },
  { valor: 'medio', label: 'Nivel Medio', descripcion: 'Nivel intermedio' },
  { valor: 'avanzado', label: 'Nivel Avanzado', descripcion: 'Alto nivel' },
];

const COLOR_DEPORTE_TORNEO = {
  'Fútbol': { from: '#FF6B4A', to: '#C2410C' }, 'Fútbol americano': { from: '#DC2626', to: '#7F1D1D' },
  'Básquetbol': { from: '#3B82F6', to: '#1E40AF' }, 'Tenis': { from: '#22C55E', to: '#166534' },
  'Tenis de mesa': { from: '#EC4899', to: '#9D174D' }, 'Vóleibol': { from: '#F59E0B', to: '#92400E' },
  'Pádel': { from: '#6366F1', to: '#3730A3' }, 'Squash': { from: '#06B6D4', to: '#155E75' },
  'Bádminton': { from: '#A855F7', to: '#6B21A8' }, 'Golf': { from: '#10B981', to: '#065F46' },
  'Béisbol': { from: '#EAB308', to: '#854D0E' }, 'Hockey': { from: '#0EA5E9', to: '#075985' },
  'Handball': { from: '#F43F5E', to: '#9F1239' }, 'Rugby': { from: '#8B5CF6', to: '#5B21B6' },
  'Boxeo': { from: '#EF4444', to: '#7F1D1D' }, 'Ciclismo': { from: '#84CC16', to: '#3F6212' },
  'Natación': { from: '#06B6D4', to: '#0E7490' }, 'Atletismo': { from: '#F43F5E', to: '#BE123C' },
  'Surf': { from: '#0EA5E9', to: '#0369A1' }, 'Escalada': { from: '#F59E0B', to: '#B45309' },
};
const COLOR_DEPORTE_TORNEO_DEFAULT = { from: '#FF6B4A', to: '#C2410C' };
const PALETA_BASICOS = ['#E8836A', '#3B82F6', '#22C55E', '#F59E0B', '#6366F1', '#EC4899'];
/* ⚡ Marcos de ícono */
const MARCOS_ICONO = [
  { id: 'default', nombre: 'Normal', clase: '' },
  { id: 'oro', nombre: 'Oro', clase: 'marco-icono-oro' },
  { id: 'fuego', nombre: 'Fuego', clase: 'marco-icono-fuego' },
  { id: 'neon', nombre: 'Neón', clase: 'marco-icono-neon' },
  { id: 'hielo', nombre: 'Hielo', clase: 'marco-icono-hielo' },
  { id: 'galaxia', nombre: 'Galaxia', clase: 'marco-icono-galaxia' },
  { id: 'custom', nombre: 'Personalizado', clase: 'marco-icono-custom' }
];

function colorDeporteTorneo(deporte) {
  return COLOR_DEPORTE_TORNEO[deporte] || COLOR_DEPORTE_TORNEO_DEFAULT;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function horaCortaChat(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) {
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function mismoDiaChat(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function labelDiaChat(iso) {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);

  if (mismoDiaChat(d, hoy))  return 'Hoy';
  if (mismoDiaChat(d, ayer)) return 'Ayer';

  const difDias = Math.floor((hoy - d) / (1000 * 60 * 60 * 24));
  if (difDias < 7) {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[d.getDay()];
  }
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function avatarDeChat(usuario) { return usuario?.avatar || 'assets/icons/usuario.svg'; }

function abrirModalVerImagen(src) {
  const img = document.getElementById('modal-imagen-img');
  const modal = document.getElementById('modal-ver-imagen');
  if (!img || !modal) return;
  img.src = src;
  abrirModal('modal-ver-imagen');
  modal.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
    btn.onclick = () => cerrarModal('modal-ver-imagen');
  });
  modal.onclick = (e) => { if (e.target.id === 'modal-ver-imagen') cerrarModal('modal-ver-imagen'); };
}

function mostrarPreviewImagen(panelId, src) {
  const wrapper = document.getElementById(`${panelId}-preview`);
  const img = document.getElementById(`${panelId}-preview-img`);
  if (!wrapper || !img) return;
  img.src = src;
  wrapper.classList.remove('hidden');
}

function ocultarPreviewImagen(panelId) {
  const wrapper = document.getElementById(`${panelId}-preview`);
  const img = document.getElementById(`${panelId}-preview-img`);
  if (!wrapper || !img) return;
  img.src = '';
  wrapper.classList.add('hidden');
}

export async function init(params = {}) {
  const id = params.id;
  const user = getSesion();
  const contenedor = document.getElementById('detalle-torneo');
  if (!contenedor || !id || !user) return null;

  const modalInscribir      = document.getElementById('modal-inscribir-equipo');
  const modalInvitar        = document.getElementById('modal-invitar-equipo');
  const modalSolicitudes    = document.getElementById('modal-gestionar-solicitudes');
  const modalChat           = document.getElementById('modal-chat-torneo');
  const modalVerEquipo      = document.getElementById('modal-ver-equipo');
  const modalTabla          = document.getElementById('modal-tabla-posiciones');
  const modalResultados     = document.getElementById('modal-resultados');
  const modalCrearPartido   = document.getElementById('modal-crear-partido');
  const modalCargar         = document.getElementById('modal-cargar-resultado');
  const modalFixture        = document.getElementById('modal-fixture');
  const modalArmar          = document.getElementById('modal-armar-fixture');
  const modalEditarJornada  = document.getElementById('modal-editar-jornada');
  const modalEditarCruce    = document.getElementById('modal-editar-cruce');
  const modalVerDetalle     = document.getElementById('modal-ver-detalle-partido');
  const modalEditarTorneo   = document.getElementById('modal-editar-torneo-detalle');
  const modalSubOrganizadores = document.getElementById('modal-sub-organizadores');
  const modalResponderInvOrg  = document.getElementById('modal-responder-invitacion-organizador');

  let torneo = null;
  let misEquipos = [];
  let partidoActual = null;
  let cruceActual = null;
  let partidoDetalleActual = null;
  let tabActual = 'resumen';

  let canalTorneoId = null;
  let canalTorneoActualId = null;
  let intervaloCanalTorneo = null;
  let ultimoHashCanalTorneo = null;
  let ultimaCanalTorneoRenderizado = null;
  let imagenBase64Torneo = null;

  function esOrganizador(t) { return t.soyOrganizador || String(t.organizador?.id) === String(user.id); }
  function puedeGestionar(t) { return t.puedeGestionarFixture || esOrganizador(t); }
  function estaCerrado(t) {
    if (t.estado !== 'inscripcion') return true;
    if ((t.equipos || []).length >= t.cuposEquipos) return true;
    if (t.fechaLimiteInscripcion && new Date(t.fechaLimiteInscripcion) < new Date()) return true;
    return false;
  }
  function miEquipoInscrito(t) { return t.miEquipoInscritoDetalle || null; }
  function miSolicitudPendiente(t) { return t.miSolicitudPendienteDetalle || null; }
  function miInvitacionPendiente(t) { return t.miInvitacionPendienteDetalle || null; }
  function misEquiposComoCapitan() { return misEquipos; }

  function renderEmoji(emoji, size = 32) {
    if (!emoji) return ICONOS.trofeo;
    if (typeof emoji === 'string' && /\.(svg|png|jpg|jpeg|gif|webp)$/i.test(emoji)) {
      return `<img src="${emoji}" alt="" style="width:${size}px;height:${size}px;object-fit:contain;display:block" />`;
    }
    return emoji;
  }

  function renderEscudoCruce(escudo, esIndividual, size = 22) {
    if (esIndividual) {
      return `<img src="${escudo || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--sm" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:50%" />`;
    }
    if (typeof escudo === 'string' && /\.(svg|png|jpg|jpeg|gif|webp)$/i.test(escudo)) {
      return `<img src="${escudo}" alt="" style="width:${size}px;height:${size}px;object-fit:contain;display:block" />`;
    }
    return `<span style="font-size:${Math.round(size * 0.8)}px;line-height:1;display:inline-block">${escudo || ICONOS.escudo}</span>`;
  }

  function renderIconoGenerico(valor, size = 28) {
    if (typeof valor === 'string' && /\.(svg|png|jpg|jpeg|gif|webp)$/i.test(valor)) {
      return `<img src="${valor}" alt="" style="width:${size}px;height:${size}px;object-fit:contain;display:block" />`;
    }
    return `<span style="font-size:${size}px;line-height:1;display:inline-block">${valor || ICONOS.escudo}</span>`;
  }

  function formatearFechaCorta(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  }

  function faseInicial(fases) { return fases[0]; }

  function fasesDelBracket(t) {
    const partidos = t.partidos || [];
    const fasesSet = new Set();
    partidos.forEach(p => { if (p.fase) fasesSet.add(p.fase); });
    return FASES_ORDEN.filter(f => fasesSet.has(f));
  }

  async function render() {
    try {
      torneo = await obtenerTorneo(id);
    } catch (err) {
      console.error('[torneo-detalle] Error al cargar:', err);
      contenedor.innerHTML = `
        <div class="gd-top">
          <button class="gd-top__volver" id="btn-volver">
            ${ICONOS.flechaIzq}
            Volver
          </button>
        </div>
        <div class="card">
          <h2 class="card__title">Torneo no encontrado</h2>
          <p class="card__subtitle">${err.message || 'Puede que haya sido eliminado.'}</p>
        </div>`;
      document.getElementById('btn-volver')?.addEventListener('click', () => {
        window.location.hash = '#/torneos';
      });
      return;
    }

    const esIndividual = torneo.tipoParticipacion === 'individual';

    if (!esIndividual) {
      try {
        const { data } = await listarGrupos({ tipo: 'equipo', soloMios: 'true', limit: 50 });
        misEquipos = data || [];
      } catch (err) {
        console.error('[torneo-detalle] Error al cargar equipos:', err);
        misEquipos = [];
      }
    } else {
      misEquipos = [];
    }

    const t = torneo;
    const inscritos = (t.equipos || []).length;
    const cuposLibres = t.cuposEquipos - inscritos;
    const cerrado = estaCerrado(t);
    const lleno = inscritos >= t.cuposEquipos;
    const soyOrg = esOrganizador(t);
    const miEquipo = miEquipoInscrito(t);
    const miSol = miSolicitudPendiente(t);
    const miInv = miInvitacionPendiente(t);
    const pendientesCount = (t.listaEspera || []).filter(l => l.estado === 'pendiente').length;

    const badgeClase = cerrado && !lleno ? 'badge--warning'
                     : lleno              ? 'badge--danger'
                     : t.estado === 'inscripcion' ? 'badge--success'
                     : t.estado === 'en_curso'    ? 'badge--info'
                                                  : 'badge--neutral';

    const badgeTexto = cerrado && !lleno ? 'Inscripciones cerradas'
                     : lleno              ? 'Lleno'
                     : t.estado === 'inscripcion' ? (t.libreInscripcion === false ? 'Inscripción' : 'Inscripción abierta')
                     : t.estado === 'en_curso'    ? 'En curso'
                                                  : 'Finalizado';

    const modalidadBadge = {
      liga: '<span class="badge badge--info">Liga</span>',
      eliminacion: '<span class="badge badge--warning">Eliminación</span>',
      custom: '<span class="badge badge--neutral">Custom</span>',
    }[t.modalidad] || '';

    const nivelBadge = {
      amistoso: '<span class="badge badge--success">Amistoso</span>',
      medio: '<span class="badge badge--warning">Nivel Medio</span>',
      avanzado: '<span class="badge badge--danger">Nivel Avanzado</span>',
    }[t.nivel] || '';

    const sistema = t.sistemaClasificacion || 'simple';
    const sistemaBadge = sistema === 'simple' ? '' : sistema === 'tiempo' ? '<span class="badge badge--info">Por tiempo</span>' : '<span class="badge badge--info">Por puntos</span>';
    const idaVueltaBadge = t.idaYVuelta ? '<span class="badge badge--info">Ida y vuelta</span>' : '';

    const fechaIni = t.fechaInicio ? formatearFecha(t.fechaInicio) : '';
    const fechaFin = t.fechaFin ? formatearFecha(t.fechaFin) : '';
    const fechaHeroTexto = fechaIni && fechaFin ? `${fechaIni} — ${fechaFin}` : fechaIni;

    const color = colorDeporteTorneo(t.deporte);
    
    // ⚡ Completamente independientes
    const fotoHero = t.heroFoto;
    const colorHero = t.heroColor;
    
    let heroStyle = `background: linear-gradient(135deg, ${color.from} 0%, ${color.to} 100%);`;
    
    if (fotoHero) {
      heroStyle = `background-image: linear-gradient(180deg, rgba(15,27,45,0.20) 0%, rgba(15,27,45,0.65) 100%), url('${fotoHero}'); background-size: cover; background-position: center;`;
    } else if (colorHero) {
      heroStyle = `background: linear-gradient(135deg, ${colorHero} 0%, ${colorHero}DD 100%);`;
    }

    /* ⚡ Marco del ícono del hero */
    const marcoHero = getMarcoData(t.marcoIcono, t.marcoColorIcono);

    // ⚡ Usar ícono personalizado si existe
    const iconoHero = t.iconoPersonalizado 
      ? `<img src="${t.iconoPersonalizado}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block" />` 
      : renderEmoji(t.emoji, 52);

    contenedor.innerHTML = `
      <div class="gd-top">
        <button class="gd-top__volver" id="btn-volver">
          ${ICONOS.flechaIzq}
          Volver
        </button>
      </div>

      <div class="td-hero" style="${heroStyle}">
        <div class="td-hero__left">
          <div class="td-hero__sport ${marcoHero.clase}" style="${marcoHero.estilo}">${iconoHero}</div>
          <div class="td-hero__info">
            <div class="td-hero__badges">
              <span class="badge ${badgeClase}">${badgeTexto}</span>
              ${modalidadBadge}
              ${nivelBadge}
              ${sistemaBadge}
              ${idaVueltaBadge}
              ${t.soySubOrganizador && !soyOrg ? `<span class="badge badge--suborg">${ICONOS.corona} Sub-organizador</span>` : ''}
            </div>
            <h1 class="td-hero__title">${t.nombre}</h1>
            <div class="td-hero__meta">
              ${fechaHeroTexto ? `<span>${ICONOS.calendario} ${fechaHeroTexto}</span>` : ''}
              ${t.lugar ? `<span>${ICONOS.ubicacion} ${t.lugar}</span>` : ''}
              <span class="td-hero__organizador" data-ver-perfil="${t.organizador.id}">
                ${ICONOS.usuario} ${t.organizador.nombre}
              </span>
            </div>
          </div>
        </div>

        ${soyOrg ? `
          <div class="td-hero__actions">
            <button class="btn td-hero__action" id="btn-sub-organizadores">
              ${ICONOS.corona} Sub-organizadores
            </button>
            ${t.guardadoPorCreador
              ? `<span class="badge badge--success">Guardado en Mis creados</span>`
              : `<button class="btn td-hero__action" id="btn-guardar-torneo-historial">Guardar torneo</button>`}
            ${!t.bloqueado ? `
              <button class="btn td-hero__action td-hero__action--primary" id="btn-editar-torneo">
                ${ICONOS.lapiz} Editar torneo
              </button>
            ` : ''}
          </div>
        ` : t.soySubOrganizador ? `
          <div class="td-hero__actions">
            ${!t.bloqueado ? `
              <button class="btn td-hero__action td-hero__action--primary" id="btn-editar-torneo">
                ${ICONOS.lapiz} Editar torneo
              </button>
            ` : ''}
          </div>
        ` : ''}
      </div>

      <div class="subtabs mb-4" id="torneo-tabs">
        <button class="subtab subtab--active" data-tab-torneo="resumen">
          ${ICONOS.copa}
          Resumen
        </button>
        <button class="subtab" data-tab-torneo="participantes">
          ${ICONOS.usuarios}
          Participantes
        </button>
        ${t.modalidad === 'liga' ? `
          <button class="subtab" data-tab-torneo="tabla">
            ${ICONOS.diana}
            Tabla
          </button>
        ` : ''}
        <button class="subtab" data-tab-torneo="resultados">
          ${ICONOS.calendario}
          ${t.modalidad === 'liga' ? 'Resultados' : 'Fixture'}
        </button>
        <button class="subtab" data-tab-torneo="chat">
          ${ICONOS.chat}
          Chat
        </button>
        <button class="subtab" data-tab-torneo="publicaciones">
          ${ICONOS.imagen}
          Publicaciones
        </button>
      </div>

      <div id="torneo-tab-contenido"></div>
    `;

    conectarEventos(t);
    renderTabActual(t);
  }

  function renderTabActual(t) {
    const cont = document.getElementById('torneo-tab-contenido');
    if (!cont) return;

    document.querySelectorAll('[data-tab-torneo]').forEach(btn => {
      btn.classList.toggle('subtab--active', btn.dataset.tabTorneo === tabActual);
    });

    if (tabActual === 'resumen') return renderTabResumen(cont, t);
    if (tabActual === 'participantes') return renderTabParticipantes(cont, t);
    if (tabActual === 'tabla') return renderTabTabla(cont, t);
    if (tabActual === 'resultados') return renderTabResultados(cont, t);
    if (tabActual === 'chat') return renderTabChat(cont, t);
    if (tabActual === 'publicaciones') return renderTabPublicaciones(cont, t);
  }

  function renderTabResumen(cont, t) {
    const esIndividual = t.tipoParticipacion === 'individual';
    const soyOrg = esOrganizador(t);
    const inscritos = (t.equipos || []).length;
    const cuposLibres = t.cuposEquipos - inscritos;
    const lleno = inscritos >= t.cuposEquipos;
    const cerrado = estaCerrado(t);

    const tipoTexto = esIndividual ? 'Individual' : 'Por equipos';
    const modalidadTexto = { liga: 'Liga', eliminacion: 'Eliminación directa', custom: 'Personalizada' }[t.modalidad] || t.modalidad;
    const fechaLimiteTexto = t.fechaLimiteInscripcion ? formatearFecha(t.fechaLimiteInscripcion) : 'Sin límite';
    const progreso = Math.min(100, Math.round((inscritos / t.cuposEquipos) * 100));

    const statsHtml = `
      <div class="pd-stats">
        <div class="pd-stat">
          <div class="pd-stat__icon">${ICONOS.usuarios}</div>
          <div class="pd-stat__texto">
            <div class="pd-stat__value">${inscritos}</div>
            <div class="pd-stat__label">${esIndividual ? 'Participantes' : 'Equipos'}</div>
          </div>
        </div>
        <div class="pd-stat">
          <div class="pd-stat__icon">${ICONOS.mas}</div>
          <div class="pd-stat__texto">
            <div class="pd-stat__value">${cuposLibres}</div>
            <div class="pd-stat__label">Cupos libres</div>
          </div>
        </div>
        <div class="pd-stat">
          <div class="pd-stat__icon">${ICONOS.dinero}</div>
          <div class="pd-stat__texto">
            <div class="pd-stat__value">${t.precio === 0 ? 'Gratis' : '$' + t.precio.toLocaleString('es-CL')}</div>
            <div class="pd-stat__label">Inscripción</div>
          </div>
        </div>
      </div>
    `;

    const descripcionHtml = `
      <div class="pd-card">
        <div class="pd-card__eyebrow">Competencia</div>
        <h3 class="pd-card__title">Sobre el torneo</h3>
        ${t.descripcion ? `<p class="pd-card__description">${t.descripcion}</p>` : `<p class="pd-card__description text-muted">El organizador no dejó descripción.</p>`}
        <div class="torneo-info-grid">
          <div class="torneo-info-item">
            <div class="torneo-info-item__icon">${ICONOS.usuarios}</div>
            <div><div class="torneo-info-item__label">Participación</div><div class="torneo-info-item__value">${tipoTexto}</div></div>
          </div>
          <div class="torneo-info-item">
            <div class="torneo-info-item__icon">${ICONOS.diana}</div>
            <div><div class="torneo-info-item__label">Modalidad</div><div class="torneo-info-item__value">${modalidadTexto}</div></div>
          </div>
          <div class="torneo-info-item">
            <div class="torneo-info-item__icon">${ICONOS.calendario}</div>
            <div><div class="torneo-info-item__label">Fecha límite</div><div class="torneo-info-item__value">${fechaLimiteTexto}</div></div>
          </div>
          <div class="torneo-info-item">
            <div class="torneo-info-item__icon">${ICONOS.trofeo}</div>
            <div><div class="torneo-info-item__label">Deporte</div><div class="torneo-info-item__value">${t.deporte}</div></div>
          </div>
        </div>
      </div>
    `;

    const botonesPanel = construirBotonesInscripcion(t, {
      esIndividual, soyOrg, miEquipo: miEquipoInscrito(t),
      miSol: miSolicitudPendiente(t), miInv: miInvitacionPendiente(t),
      cerrado, lleno, cuposLibres,
    });

    const panelHtml = `
      <div class="torneo-inscripcion-panel">
        <div class="torneo-inscripcion-panel__eyebrow">${cerrado ? 'Inscripciones cerradas' : 'Inscripciones abiertas'}</div>
        <h3 class="torneo-inscripcion-panel__titulo">${cerrado ? 'El torneo ya comenzó' : (esIndividual ? 'Participa en el torneo' : 'Participa con tu equipo')}</h3>
        <p class="torneo-inscripcion-panel__desc">
          ${cuposLibres > 0 ? `Quedan ${cuposLibres} cupos disponibles para este torneo.` : 'No quedan cupos disponibles.'}
          ${t.fechaLimiteInscripcion ? ` Las inscripciones cierran el ${fechaLimiteTexto}.` : ''}
        </p>
        <div style="margin-top:8px">
          <div class="torneo-inscripcion-panel__progreso-labels">
            <span>${inscritos} / ${t.cuposEquipos} ${esIndividual ? 'participantes' : 'equipos'}</span>
            <span style="color:var(--color-primary); font-weight:700">${progreso}%</span>
          </div>
          <div class="torneo-inscripcion-panel__progreso"><div class="torneo-inscripcion-panel__progreso-bar" style="width:${progreso}%"></div></div>
        </div>
        <div class="torneo-inscripcion-panel__acciones">${botonesPanel}</div>
      </div>
    `;

    const miInvOrg = t.miInvitacionOrganizador;
    const cardInvitacionOrg = miInvOrg ? `
      <div class="tso-invitacion-pendiente">
        <div class="tso-invitacion-pendiente__icon">${ICONOS.corona}</div>
        <div class="tso-invitacion-pendiente__info">
          <div class="tso-invitacion-pendiente__titulo">Te invitaron a organizar</div>
          <div class="tso-invitacion-pendiente__desc"><strong>${t.organizador?.nombre || 'El organizador'}</strong> te invitó a ser sub-organizador de <strong>${t.nombre}</strong>.</div>
        </div>
        <div class="tso-invitacion-pendiente__acciones">
          <button class="btn btn--ghost btn--sm" id="btn-rechazar-inv-organizador">Rechazar</button>
          <button class="btn btn--primary btn--sm" id="btn-aceptar-inv-organizador">Aceptar</button>
        </div>
      </div>
    ` : '';

    cont.innerHTML = `
      <div class="torneo-tab-contenido">
        ${cardInvitacionOrg}
        ${statsHtml}
        <div class="torneo-resumen-grid">
          ${descripcionHtml}
          ${panelHtml}
        </div>
      </div>
    `;

    document.getElementById('btn-aceptar-inv-organizador')?.addEventListener('click', () => responderInvitacionOrganizadorUI(t, true));
    document.getElementById('btn-rechazar-inv-organizador')?.addEventListener('click', () => responderInvitacionOrganizadorUI(t, false));

    conectarEventosTab(t);
  }

  function construirBotonesInscripcion(t, ctx) {
    const { esIndividual, soyOrg, miEquipo, miSol, miInv, cerrado, lleno, cuposLibres } = ctx;
    let botones = '';

    if (soyOrg || t.soySubOrganizador) {
      const puedeCerrar = !estaCerrado(t);
      const pendientesCount = (t.listaEspera || []).filter(l => l.estado === 'pendiente').length;

      botones += `
        ${puedeCerrar ? `<button class="btn btn--warning" id="btn-cerrar-torneo">${ICONOS.candado} Cerrar inscripciones</button>` : ''}
        <button class="btn btn--primary" id="btn-gestionar-solicitudes">${ICONOS.usuarios} Solicitudes ${pendientesCount > 0 ? `<span class="badge badge--neutral" style="margin-left:6px">${pendientesCount}</span>` : ''}</button>
        ${!esIndividual && t.estado === 'inscripcion' ? `<button class="btn btn--ghost" id="btn-invitar-equipo">${ICONOS.mas} Invitar equipo</button>` : ''}
        <button class="btn btn--ghost" id="btn-abrir-chat">${ICONOS.chat} Chat del torneo</button>
        <button class="btn btn--ghost" id="btn-compartir-torneo">${ICONOS.compartir} Compartir</button>
        ${soyOrg ? `<button class="btn btn--ghost" id="btn-eliminar-torneo" style="color:var(--color-danger)">${ICONOS.basura} Eliminar torneo</button>` : ''}
      `;
      return botones;
    }
    if (miEquipo) {
      const nombreMostrado = esIndividual ? escapeHtml(miEquipo.nombre) : `${renderEscudoCruce(miEquipo.escudo, false, 20)} ${escapeHtml(miEquipo.nombre)}`;
      return `
        <div class="badge badge--success" style="padding:12px 16px; font-size:14px; text-align:center; width:100%; justify-content:center">${ICONOS.check} Ya estás inscrito: ${nombreMostrado}</div>
        <button class="btn btn--ghost" id="btn-abrir-chat">${ICONOS.chat} Chat del torneo</button>
        <button class="btn btn--ghost" id="btn-compartir-torneo">${ICONOS.compartir} Compartir</button>
        <button class="btn btn--ghost" id="btn-salir-torneo" style="color:var(--color-danger)">${ICONOS.salir} Salirme del torneo</button>
      `;
    }
    if (miInv) {
      return `
        <div class="card" style="width:100%; background:var(--color-primary-light); border:none; padding:14px">
          <p class="text-sm" style="margin:0 0 var(--space-3) 0">${ICONOS.correo} <strong>¡Te invitaron!</strong> El organizador quiere que ${renderEscudoCruce(miInv.equipoEscudo, false, 20)} <strong>${escapeHtml(miInv.equipoNombre)}</strong> participe.</p>
          <div class="flex gap-2"><button class="btn btn--primary btn--sm" id="btn-aceptar-invitacion">Aceptar</button><button class="btn btn--ghost btn--sm" id="btn-rechazar-invitacion">Rechazar</button></div>
        </div>
      `;
    }
    if (miSol) {
      return `
        <div class="badge badge--warning" style="padding:12px 16px; font-size:14px; text-align:center; width:100%; justify-content:center">${ICONOS.reloj} Tu solicitud está en espera</div>
        <button class="btn btn--ghost btn--sm" id="btn-cancelar-solicitud">Cancelar solicitud</button>
        <button class="btn btn--ghost" id="btn-compartir-torneo">${ICONOS.compartir} Compartir</button>
      `;
    }
    if (cerrado || lleno) {
      return `
        <div class="badge badge--danger" style="padding:12px 16px; font-size:14px; text-align:center; width:100%; justify-content:center">${lleno ? 'Torneo lleno' : 'Inscripciones cerradas'}</div>
        <button class="btn btn--ghost" id="btn-compartir-torneo">${ICONOS.compartir} Compartir</button>
      `;
    }
    if (esIndividual) {
      return `<button class="btn btn--primary" id="btn-inscribir-equipo">${ICONOS.check} Inscribirme</button><button class="btn btn--ghost" id="btn-compartir-torneo">${ICONOS.compartir} Compartir</button>`;
    }
    const misEq = misEquiposComoCapitan();
    if (misEq.length === 0) {
      return `<div class="badge badge--neutral" style="padding:12px 16px; font-size:13px; text-align:center; width:100%; justify-content:center">${ICONOS.alerta} Necesitás ser capitán de un equipo</div><button class="btn btn--ghost" id="btn-compartir-torneo">${ICONOS.compartir} Compartir</button>`;
    }
    return `<button class="btn btn--primary" id="btn-inscribir-equipo">${ICONOS.check} Inscribir mi equipo (${cuposLibres} cupos)</button><button class="btn btn--ghost" id="btn-compartir-torneo">${ICONOS.compartir} Compartir</button>`;
  }

  function construirEquiposCard(t, { esIndividual, soyOrg }) {
    const equipos = t.equipos || [];
    if (equipos.length === 0) {
      return `<div class="pd-card"><div class="pd-card__eyebrow">Inscripciones</div><h3 class="pd-card__title">${esIndividual ? 'Participantes' : 'Equipos participantes'}</h3><div class="pd-empty"><div class="pd-empty__icon">${ICONOS.usuarios}</div><p class="pd-empty__text">Aún no hay ${esIndividual ? 'participantes' : 'equipos'} inscritos.</p></div></div>`;
    }
    const items = equipos.map(e => {
      const escudoHtml = renderEscudoCruce(e.escudo, esIndividual, 40);
      const mostrarExpulsar = soyOrg && !t.fixtureBloqueado && t.estado === 'inscripcion';
      const idParticipante = e.equipoId || e.id;
      return `
        <div class="torneo-equipo-item" data-ver-participante="${idParticipante}" data-es-individual="${esIndividual}" role="button" tabindex="0">
          <div class="torneo-equipo-item__escudo">${escudoHtml}</div>
          <div class="torneo-equipo-item__info">
            <div class="torneo-equipo-item__nombre">${e.nombre}</div>
            <div class="torneo-equipo-item__sub">${esIndividual ? 'Participante' : `${e.totalJugadores || 0} jugadores`}</div>
          </div>
          ${mostrarExpulsar ? `<button class="torneo-equipo-item__expulsar" data-expulsar-equipo="${e.id}" title="Eliminar del torneo">${ICONOS.basura}</button>` : ''}
        </div>
      `;
    }).join('');
    return `<div class="pd-card"><div class="pd-card__eyebrow">Inscripciones</div><h3 class="pd-card__title">${esIndividual ? 'Participantes' : 'Equipos participantes'} (${equipos.length})</h3><div class="torneo-equipos-grid">${items}</div></div>`;
  }

  function renderTabParticipantes(cont, t) {
    const esIndividual = t.tipoParticipacion === 'individual';
    const soyOrg = esOrganizador(t);
    cont.innerHTML = `<div class="torneo-tab-contenido">${construirEquiposCard(t, { esIndividual, soyOrg })}</div>`;
    cont.querySelectorAll('[data-ver-participante]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-expulsar-equipo]')) return;
        const id = el.dataset.verParticipante;
        const esInd = el.dataset.esIndividual === 'true';
        if (esInd) {
          import('../components.js').then(({ verPerfilUsuario }) => verPerfilUsuario(id));
        } else {
          const equipo = (t.equipos || []).find(eq => String(eq.id) === String(id));
          if (equipo) verDetalleEquipo(equipo);
        }
      });
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
    });
    conectarEventosTab(t);
  }

  function renderTabTabla(cont, t) {
    if (t.modalidad !== 'liga') {
      cont.innerHTML = `<div class="torneo-tab-vacio"><div class="torneo-tab-vacio__icon">${ICONOS.diana}</div><p class="torneo-tab-vacio__text">Esta modalidad no usa tabla de posiciones.</p></div>`;
      return;
    }
    const filas = t.tablaPosiciones || [];
    const esIndividual = t.tipoParticipacion === 'individual';
    if (filas.length === 0) {
      cont.innerHTML = `<div class="torneo-tab-vacio"><div class="torneo-tab-vacio__icon">${ICONOS.diana}</div><h3 class="torneo-tab-vacio__titulo">Sin datos todavía</h3><p class="torneo-tab-vacio__text">Cuando se carguen los resultados de los partidos, acá vas a ver la tabla de posiciones completa.</p></div>`;
      return;
    }
    cont.innerHTML = `
      <div class="torneo-tab-contenido">
        <div class="pd-card">
          <div class="tabla-posiciones-wrapper" style="overflow-x:auto;">
            <table class="tabla-posiciones">
              <thead><tr><th style="width:40px">#</th><th style="text-align:left">${esIndividual ? 'Participante' : 'Equipo'}</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th style="font-weight:700">PTS</th></tr></thead>
              <tbody>
                ${filas.map((f, i) => `
                  <tr class="${i % 2 === 0 ? '' : 'tabla-posiciones__fila--alt'}">
                    <td>${i + 1}</td>
                    <td style="text-align:left"><div style="display:flex; align-items:center; gap:var(--space-2)">${renderEscudoCruce(f.equipoEscudo, esIndividual, 24)}<span>${escapeHtml(f.equipoNombre || 'Sin nombre')}</span></div></td>
                    <td>${f.partidosJugados}</td><td>${f.partidosGanados}</td><td>${f.partidosEmpatados}</td><td>${f.partidosPerdidos}</td><td>${f.puntosFavor}</td><td>${f.puntosContra}</td><td>${f.diferencia > 0 ? '+' : ''}${f.diferencia}</td><td style="font-weight:700">${f.puntosTotales}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function renderTabResultados(cont, t) {
    if (t.modalidad === 'liga') return renderTabResultadosLiga(cont, t);
    if (t.modalidad === 'eliminacion') return renderTabResultadosFixture(cont, t);
    cont.innerHTML = `<div class="torneo-tab-vacio"><div class="torneo-tab-vacio__icon">${ICONOS.calendario}</div><p class="torneo-tab-vacio__text">Esta modalidad no tiene resultados cargados.</p></div>`;
  }

  function renderTabResultadosLiga(cont, t) {
    const partidos = t.partidos || [];
    const jornadas = t.jornadas || [];
    const puedeGest = puedeGestionar(t);
    const esIndividual = t.tipoParticipacion === 'individual';
    const sistema = t.sistemaClasificacion || 'simple';

    if (jornadas.length === 0 && partidos.length === 0) {
      cont.innerHTML = `
        <div class="torneo-tab-vacio">
          <div class="torneo-tab-vacio__icon">${ICONOS.calendario}</div>
          <h3 class="torneo-tab-vacio__titulo">Sin jornadas todavía</h3>
          <p class="torneo-tab-vacio__text">${puedeGest ? 'Generá el fixture automático y el sistema va a crear todas las jornadas y los cruces entre los participantes inscriptos.' : 'Cuando el organizador arme el fixture, vas a ver acá todas las jornadas con sus partidos.'}</p>
          ${puedeGest ? `<button class="btn btn--primary" id="btn-generar-fixture-liga">Generar fixture automático</button>` : ''}
        </div>
      `;
      document.getElementById('btn-generar-fixture-liga')?.addEventListener('click', () => generarFixtureLiga(t));
      return;
    }

    const partidosPorJornada = new Map();
    jornadas.forEach(j => partidosPorJornada.set(String(j.id), []));
    partidos.forEach(p => {
      const key = String(p.jornadaId);
      if (!partidosPorJornada.has(key)) partidosPorJornada.set(key, []);
      partidosPorJornada.get(key).push(p);
    });

    const jornadasOrdenadas = [...jornadas].sort((a, b) => a.numero - b.numero);
    let html = '';

    if (puedeGest) {
      html += `<div class="flex gap-2 mb-4" style="flex-wrap:wrap"><button class="btn btn--primary btn--sm" id="btn-abrir-crear-partido">${ICONOS.mas} Crear partido</button></div>`;
    }

    if (jornadasOrdenadas.length === 0 && partidos.length > 0) {
      html += `<div class="pd-card mb-4"><div class="pd-card__eyebrow">Partidos</div><h3 class="pd-card__title">Sin jornada</h3>${partidos.map(p => renderPartido(p, t.deporte, esIndividual, puedeGest, sistema)).join('')}</div>`;
    } else {
      for (const j of jornadasOrdenadas) {
        const partidosJ = partidosPorJornada.get(String(j.id)) || [];
        html += `
          <div class="pd-card mb-4 jornada-card" data-jornada-id="${j.id}">
            <div class="jornada-card__header">
              <div>
                <div class="jornada-card__titulo">${j.nombre || `Jornada ${j.numero}`}</div>
                ${j.fecha ? `<div class="jornada-card__fecha text-xs text-muted">${formatearFechaCorta(j.fecha)}</div>` : ''}
              </div>
              ${puedeGest ? `<div class="jornada-card__acciones"><button class="btn btn--ghost btn--sm" data-jornada-editar="${j.id}" title="Editar jornada">${ICONOS.lapiz}</button><button class="btn btn--ghost btn--sm" data-jornada-borrar="${j.id}" title="Borrar jornada" style="color:var(--color-danger)">${ICONOS.basura}</button></div>` : ''}
            </div>
            ${partidosJ.length === 0 ? `<p class="text-sm text-muted text-center" style="padding:var(--space-4)">Sin partidos cargados.</p>` : partidosJ.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).map(p => renderPartido(p, t.deporte, esIndividual, puedeGest, sistema)).join('')}
          </div>
        `;
      }
    }

    cont.innerHTML = `<div class="torneo-tab-contenido">${html}</div>`;

    cont.querySelectorAll('[data-partido-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-jornada-editar]')) return;
        if (e.target.closest('[data-jornada-borrar]')) return;
        const partidoId = el.dataset.partidoId;
        const partido = (t.partidos || []).find(p => String(p.id) === String(partidoId));
        if (!partido) return;
        if (puedeGest) abrirCargarResultado(t, partido);
        else if (partido.estado === 'finalizado') abrirVerDetallePartido(t, partido);
      });
    });

    cont.querySelectorAll('[data-jornada-editar]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const jornadaId = btn.dataset.jornadaEditar;
        const jornada = (t.jornadas || []).find(j => String(j.id) === String(jornadaId));
        if (jornada) abrirEditarJornada(t, jornada);
      });
    });

    cont.querySelectorAll('[data-jornada-borrar]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const jornadaId = btn.dataset.jornadaBorrar;
        const jornada = (t.jornadas || []).find(j => String(j.id) === String(jornadaId));
        if (jornada) borrarJornada(t, jornada);
      });
    });

    document.getElementById('btn-abrir-crear-partido')?.addEventListener('click', () => abrirCrearPartido(t));
  }

  function renderPartido(p, deporte, esIndividual, puedeGest, sistema) {
    const finalizado = p.estado === 'finalizado';
    const marcador = finalizado ? formatearMarcadorTorneo(deporte, p.resultado, sistema) : 'vs';
    const localHtml = renderEscudoCruce(p.localEscudo, esIndividual, 24);
    const visitanteHtml = renderEscudoCruce(p.visitanteEscudo, esIndividual, 24);

    return `
      <div class="resultado-item" data-partido-id="${p.id}" style="cursor:${(puedeGest || finalizado) ? 'pointer' : 'default'}">
        <div class="resultado-item__equipo resultado-item__equipo--local">${localHtml}<span class="resultado-item__nombre">${p.localNombre || 'Por definir'}</span></div>
        <div class="resultado-item__marcador ${finalizado ? '' : 'resultado-item__marcador--pendiente'}">${marcador}${finalizado && p.ganador === 'local' ? '<span style="font-size:12px">▲</span>' : ''}</div>
        <div class="resultado-item__equipo resultado-item__equipo--visitante"><span class="resultado-item__nombre">${p.visitanteNombre || 'Por definir'}</span>${visitanteHtml}${finalizado && p.ganador === 'visitante' ? '<span style="font-size:12px">▲</span>' : ''}</div>
        ${p.fecha ? `<div class="resultado-item__fecha text-xs text-muted">${formatearFechaCorta(p.fecha)}</div>` : ''}
      </div>
    `;
  }
    /* ---------- TAB: RESULTADOS (ELIMINACIÓN) ---------- */
  function renderTabResultadosFixture(cont, t) {
    const puedeGest = puedeGestionar(t);
    const partidos = t.partidos || [];
    const esIndividual = t.tipoParticipacion === 'individual';
    const sistema = t.sistemaClasificacion || 'simple';

    let accionesBarra = '';
    if (puedeGest && !t.fixtureBloqueado) {
      const hayPartidos = partidos.length > 0;
      accionesBarra = `
        ${!hayPartidos ? `
          <button class="btn btn--primary btn--sm" id="btn-armar-aleatorio">
            ${ICONOS.dado} Armar fixture aleatorio
          </button>
          <button class="btn btn--ghost btn--sm" id="btn-armar-manual">
            ${ICONOS.martillo} Armar fixture manual
          </button>
        ` : `
          <button class="btn btn--primary btn--sm" id="btn-confirmar-fixture">
            ${ICONOS.check} Confirmar fixture
          </button>
          <button class="btn btn--ghost btn--sm" id="btn-rearmar-fixture" style="color:var(--color-danger)">
            ${ICONOS.basura} Rehacer fixture
          </button>
        `}
      `;
    } else if (puedeGest && t.fixtureBloqueado) {
      accionesBarra = `
        <span class="badge badge--success" style="padding:8px 12px">
          ${ICONOS.candado} Fixture confirmado
        </span>
      `;
    }

    if (partidos.length === 0) {
      cont.innerHTML = `
        <div class="torneo-tab-contenido">
          ${accionesBarra ? `<div class="flex gap-2 mb-4" style="flex-wrap:wrap">${accionesBarra}</div>` : ''}
          <div class="torneo-tab-vacio">
            <div class="torneo-tab-vacio__icon">${ICONOS.trofeo}</div>
            <h3 class="torneo-tab-vacio__titulo">Sin fixture todavía</h3>
            <p class="torneo-tab-vacio__text">
              ${puedeGest
                ? 'Armá el bracket de eliminación con los botones de arriba. puedes hacerlo automático (aleatorio) o manual (eligiendo cada cruce).'
                : 'Cuando el organizador arme el fixture, vas a ver acá el bracket completo con todos los cruces.'}
            </p>
          </div>
        </div>
      `;

      document.getElementById('btn-armar-aleatorio')?.addEventListener('click', () => armarAleatorio(t));
      document.getElementById('btn-armar-manual')?.addEventListener('click', () => abrirArmarManual(t));
      return;
    }

    const fases = fasesDelBracket(t);
    if (fases.length === 0) {
      cont.innerHTML = `
        <div class="torneo-tab-vacio">
          <div class="torneo-tab-vacio__icon">${ICONOS.trofeo}</div>
          <p class="torneo-tab-vacio__text">Sin fases detectadas.</p>
        </div>
      `;
      return;
    }

    const faseIni = faseInicial(fases);
    const partidosPorFase = new Map();
    fases.forEach(f => partidosPorFase.set(f, []));
    partidos.forEach(p => {
      const fase = p.fase || faseIni;
      if (!partidosPorFase.has(fase)) partidosPorFase.set(fase, []);
      partidosPorFase.get(fase).push(p);
    });

    fases.forEach(f => {
      const lista = partidosPorFase.get(f) || [];
      lista.sort((a, b) => (a.posicionEnFase ?? 0) - (b.posicionEnFase ?? 0));
    });

    let bracketHtml = '<div class="fixture-bracket-nuevo">';

    fases.forEach((fase, idxFase) => {
      const partidosFase = partidosPorFase.get(fase) || [];
      if (partidosFase.length === 0) return;

      bracketHtml += `
        <div class="fixture-bracket-nuevo__columna" data-fase="${fase}">
          <div class="fixture-bracket-nuevo__titulo">${FASES_LABEL[fase] || fase}</div>
          <div class="fixture-bracket-nuevo__cruces">
            ${partidosFase.map((p, idxCruce) => {
              const esPrimeraFase = fase === faseIni;
              const puedeEditar = puedeGest && !t.fixtureBloqueado && esPrimeraFase;
              const puedeInteractuar = puedeGest
                || (p.estado === 'finalizado' && !p.esBye);

              return renderCruceNuevo(
                p,
                t.deporte,
                esIndividual,
                sistema,
                idxFase,
                idxCruce,
                puedeEditar,
                puedeInteractuar,
              );
            }).join('')}
          </div>
        </div>
      `;
    });

    bracketHtml += '</div>';

    cont.innerHTML = `
      <div class="torneo-tab-contenido">
        ${accionesBarra ? `<div class="flex gap-2 mb-4" style="flex-wrap:wrap">${accionesBarra}</div>` : ''}
        <div style="overflow-x:auto;">
          ${bracketHtml}
        </div>
      </div>
    `;

    cont.querySelectorAll('[data-partido-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const partidoId = el.dataset.partidoId;
        const partido = (t.partidos || []).find(p => String(p.id) === String(partidoId));
        if (!partido) return;

        if (partido.esBye) return;

        const esPrimeraFase = partido.fase === faseIni;
        const esGestor = puedeGestionar(t);

        if (esGestor) {
          if (!t.fixtureBloqueado && esPrimeraFase) {
            abrirEditarCruce(t, partido);
            return;
          }
          if (partido.estado === 'finalizado') {
            abrirVerDetallePartido(t, partido);
            return;
          }
          if (partido.equipoLocalId && partido.equipoVisitanteId) {
            abrirCargarResultado(t, partido);
            return;
          }
          toast('Este cruce todavía no tiene los dos participantes', 'info');
          return;
        }

        if (partido.estado === 'finalizado') {
          abrirVerDetallePartido(t, partido);
        }
      });
    });

    document.getElementById('btn-armar-aleatorio')?.addEventListener('click', () => armarAleatorio(t));
    document.getElementById('btn-armar-manual')?.addEventListener('click', () => abrirArmarManual(t));
    document.getElementById('btn-confirmar-fixture')?.addEventListener('click', () => confirmarFixture(t));
    document.getElementById('btn-rearmar-fixture')?.addEventListener('click', () => rearmarFixture(t));
  }

  /* ---------- Render de un cruce del bracket ---------- */
  function renderCruceNuevo(p, deporte, esIndividual, sistema, idxFase, idxCruce, puedeEditar, puedeInteractuar) {
    const finalizado = p.estado === 'finalizado';
    const esBye = p.esBye;

    const localNombre = p.localNombre || 'Por definir';
    const visitanteNombre = p.visitanteNombre || 'Por definir';

    const localEsc = renderEscudoCruce(p.localEscudo, esIndividual);
    const visEsc   = renderEscudoCruce(p.visitanteEscudo, esIndividual);

    const ganadorLocal = finalizado && p.ganador === 'local';
    const ganadorVisitante = finalizado && p.ganador === 'visitante';

    let marcador = '';
    if (esBye) {
      marcador = '<span class="badge badge--neutral">BYE</span>';
    } else if (finalizado) {
      marcador = formatearMarcadorTorneo(deporte, p.resultado, sistema);
    }

    const claseCard = [
      'bracket-cruce',
      finalizado ? 'bracket-cruce--finalizado' : '',
      esBye ? 'bracket-cruce--bye' : '',
      puedeInteractuar ? 'bracket-cruce--clickeable' : '',
      idxCruce % 2 === 0 ? 'bracket-cruce--impar' : 'bracket-cruce--par',
    ].filter(Boolean).join(' ');

    const iconoEditar = puedeEditar
      ? `<span class="bracket-cruce__icono" title="Editar cruce">${ICONOS.lapiz}</span>`
      : '';

    return `
      <div class="${claseCard}" data-partido-id="${p.id}" data-idx-fase="${idxFase}" data-idx-cruce="${idxCruce}">
        ${iconoEditar}
        <div class="bracket-cruce__equipo ${ganadorLocal ? 'bracket-cruce__equipo--ganador' : ''}">
          ${localEsc}
          <span class="bracket-cruce__nombre">${localNombre}</span>
          ${ganadorLocal ? '<span class="bracket-cruce__check">✓</span>' : ''}
        </div>
        <div class="bracket-cruce__marcador">
          ${marcador || '<span class="text-xs text-muted">vs</span>'}
        </div>
        <div class="bracket-cruce__equipo ${ganadorVisitante ? 'bracket-cruce__equipo--ganador' : ''}">
          ${visEsc}
          <span class="bracket-cruce__nombre">${visitanteNombre}</span>
          ${ganadorVisitante ? '<span class="bracket-cruce__check">✓</span>' : ''}
        </div>
      </div>
    `;
  }

  /* =========================================================
     TAB: CHAT DEL TORNEO
     ========================================================= */
  async function renderTabChat(cont, t) {
    cont.innerHTML = `
      <div class="torneo-tab-contenido" style="padding:0">
        <div class="chat-layout chat-layout--torneo">
          <section class="chat-layout__panel" id="panel-canal-torneo">
            <div class="chat-empty">
              <div class="chat-empty__icon">
                <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h3 class="chat-empty__titulo">Chat del torneo</h3>
              <p class="chat-empty__text">Cargando...</p>
            </div>
          </section>
        </div>
      </div>
    `;

    await cargarCanalTorneo(t);
  }

  async function cargarCanalTorneo(t) {
    let canales = [];
    try {
      canales = await listarCanalesAPI();
    } catch (err) {
      console.error('[torneo-detalle] Error al cargar canales:', err);
    }

    const canalDelTorneo = (canales || []).find(c =>
      c.tipo === 'torneo' && String(c.refId) === String(t.id)
    );

    if (!canalDelTorneo) {
      const panel = document.getElementById('panel-canal-torneo');
      if (panel) {
        panel.innerHTML = `
          <div class="chat-empty">
            <div class="chat-empty__icon">
              <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h3 class="chat-empty__titulo">Chat no disponible</h3>
            <p class="chat-empty__text">
              Solo los participantes del torneo pueden ver este chat.
            </p>
          </div>`;
      }
      return;
    }

    canalTorneoId = canalDelTorneo.id;

    try {
      await marcarCanalLeidoAPI(canalTorneoId);
    } catch (err) {
      console.warn('[torneo-detalle] No se pudo marcar el canal como leído:', err.message);
    }

    await renderPanelCanalTorneo(canalTorneoId);

    if (intervaloCanalTorneo) clearInterval(intervaloCanalTorneo);
    intervaloCanalTorneo = setInterval(async () => {
      if (canalTorneoActualId === canalTorneoId) {
        await refrescarMensajesCanalTorneo(canalTorneoId);
      }
    }, 3000);
  }

  async function renderPanelCanalTorneo(canalId) {
    const panel = document.getElementById('panel-canal-torneo');
    if (!panel) return;

    canalTorneoActualId = canalId;
    ultimoHashCanalTorneo = null;
    ultimaCanalTorneoRenderizado = null;
    imagenBase64Torneo = null;

    try {
      await obtenerCanalAPI(canalId);
    } catch (err) {
      console.error('[torneo-detalle] Error al obtener canal:', err);
      panel.innerHTML = `
        <div class="chat-empty">
          <div class="chat-empty__icon">
            <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p class="chat-empty__text">No se pudo cargar el chat</p>
        </div>`;
      return;
    }

    panel.innerHTML = `
      <div class="chat-mensajes" id="chat-mensajes-torneo"></div>

      <div class="chat-input-preview hidden" id="chat-torneo-preview">
        <div class="chat-input-preview__img-wrapper">
          <img id="chat-torneo-preview-img" src="" alt="" />
          <button type="button" class="chat-input-preview__del" id="chat-torneo-preview-del" title="Quitar">✕</button>
        </div>
      </div>

      <form class="chat-input" id="chat-form-torneo">
        <label class="chat-input__attach" title="Adjuntar imagen">
          ${ICONOS.clip}
          <input type="file" id="chat-torneo-file" accept="image/*" style="display:none" />
        </label>

        <input
          type="text"
          id="chat-input-torneo"
          placeholder="Escribe un mensaje..."
          maxlength="2000"
          autocomplete="off"
        />
        <button type="submit" class="chat-input__btn" title="Enviar">
          ${ICONOS.enviar}
        </button>
      </form>
    `;

    document.getElementById('chat-torneo-file')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 3 * 1024 * 1024) {
        toast('La imagen es muy grande (máx 3MB)', 'error');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        imagenBase64Torneo = ev.target.result;
        mostrarPreviewImagen('chat-torneo', imagenBase64Torneo);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });

    document.getElementById('chat-torneo-preview-del')?.addEventListener('click', () => {
      imagenBase64Torneo = null;
      ocultarPreviewImagen('chat-torneo');
    });

    document.getElementById('chat-form-torneo')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await enviarMensajeEnCanalTorneo(canalId);
    });

    await refrescarMensajesCanalTorneo(canalId);
  }

  async function refrescarMensajesCanalTorneo(canalId) {
    const cont = document.getElementById('chat-mensajes-torneo');
    if (!cont) return;

    let mensajes;
    try {
      mensajes = await listarMensajesDeCanalAPI(canalId);
    } catch (err) {
      console.error('[torneo-detalle] Error al cargar mensajes del canal:', err);
      return;
    }

    const hash = mensajes
      .map(m => `${m.id}:${m.texto || ''}:${m.imagen ? 'img' : ''}:${m.createdAt}`)
      .join('|');

    const cambioDeCanal = ultimaCanalTorneoRenderizado !== canalId;

    if (!cambioDeCanal && hash === ultimoHashCanalTorneo) return;

    ultimoHashCanalTorneo = hash;
    ultimaCanalTorneoRenderizado = canalId;

    if (mensajes.length === 0) {
      cont.innerHTML = `
        <div class="chat-mensajes__empty">
          <div class="chat-mensajes__empty-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <p>Aún no hay mensajes.</p>
          <p class="text-xs" style="margin-top:4px">Escribe el primero!</p>
        </div>`;
      return;
    }

    const estabaAbajo = cont.scrollHeight - cont.scrollTop - cont.clientHeight < 50;

    let html = '';
    let diaAnterior = null;

    mensajes.forEach((m, idx) => {
      const fecha = new Date(m.createdAt);
      const dia = fecha.toDateString();

      if (dia !== diaAnterior) {
        html += `<div class="chat-dia">${labelDiaChat(m.createdAt)}</div>`;
        diaAnterior = dia;
      }

      const esMio = String(m.autorId) === String(user.id);

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
          
          <!-- ⚡ AGREGADO: data-autor-id y cursor:pointer -->
          ${!esMio ? `<img src="${avatarDeChat(m.autor)}" class="msg__avatar" alt="" data-autor-id="${m.autorId}" style="cursor:pointer" />` : ''}
          
          <div class="msg__burbuja ${soloImagen ? 'msg__burbuja--solo-imagen' : ''}">
            ${!esMio ? `<div class="msg__autor">${escapeHtml(m.autor?.nombre || 'Usuario')}</div>` : ''}
            ${m.eliminadoParaTodos ? `<div class="msg__eliminado"><img src="assets/icons/prohibido.png" alt="" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;display:inline-block;margin-right:4px;" /> Mensaje eliminado</div>` : (tieneTexto ? `<div class="msg__texto">${escapeHtml(m.texto)}</div>` : '')}
            ${tieneImagen && !m.eliminadoParaTodos ? `
              <div class="msg__imagen-wrapper" data-ver-imagen-torneo="${idx}">
                <img src="${m.imagen}" alt="" loading="lazy" />
              </div>
            ` : ''}
            <div class="msg__meta">
              <span class="msg__hora">${horaCortaChat(m.createdAt)}</span>
            </div>
          </div>
        </div>
      `;
    });

    cont.innerHTML = html;

    cont.querySelectorAll('[data-ver-imagen-torneo]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.verImagenTorneo);
        const m = mensajes[idx];
        if (m?.imagen) abrirModalVerImagen(m.imagen);
      });
    });

    // ⚡ NUEVO: Listener para abrir perfil desde el chat del torneo
    cont.querySelectorAll('[data-autor-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        import('../components.js').then(({ verPerfilUsuario }) => verPerfilUsuario(el.dataset.autorId));
      });
    });

    conectarAccionesMensaje(cont, {
      usuarioId: user.id,
      obtenerMensajePorId: (id) => mensajes.find(m => String(m.id) === String(id)),
      onCopiar: (texto) => navigator.clipboard.writeText(texto),
      onEliminarParaMi: (id) => eliminarMensajeParaMi(id),
      onEliminarParaTodos: (id) => eliminarMensajeParaTodos(id),
      onRefrescar: () => refrescarMensajesCanalTorneo(canalId),
    });

    if (estabaAbajo || mensajes.length <= 2) {
      cont.scrollTop = cont.scrollHeight;
    }

    try {
      await marcarCanalLeidoAPI(canalId);
    } catch (err) {}
  }

  async function enviarMensajeEnCanalTorneo(canalId) {
    const input = document.getElementById('chat-input-torneo');
    if (!input) return;

    const texto = input.value.trim();
    const imagen = imagenBase64Torneo;

    if (!texto && !imagen) return;

    input.value = '';
    imagenBase64Torneo = null;
    ocultarPreviewImagen('chat-torneo');
    input.focus();

    try {
      await enviarMensajeACanalAPI(canalId, texto || null, imagen || null);
      await refrescarMensajesCanalTorneo(canalId);
    } catch (err) {
      console.error('[torneo-detalle] Error al enviar mensaje:', err);
      toast(err.message || 'No se pudo enviar el mensaje', 'error');
    }
  }

  /* =========================================================
     TAB: PUBLICACIONES DEL TORNEO
     ========================================================= */
  async function renderTabPublicaciones(cont, t) {
    const soyOrg = esOrganizador(t);
    const puedePublicar = soyOrg || t.soySubOrganizador === true;

    cont.innerHTML = `
      <div class="torneo-tab-contenido">
        <div class="pubs-subtab-wrapper" id="pubs-torneo-contenido">
          <div class="page-loader">
            <div class="spinner"></div>
            <span>Cargando publicaciones...</span>
          </div>
        </div>
      </div>
    `;

    const wrapper = document.getElementById('pubs-torneo-contenido');
    if (!wrapper) return;

    let publicaciones = [];
    try {
      publicaciones = await listarPubsTorneoAPI(t.id);
    } catch (err) {
      console.error('[torneo-detalle] Error al cargar publicaciones:', err);
      wrapper.innerHTML = `
        <div class="pubs-subtab-empty">
          <div class="pubs-subtab-empty__icon">${ICONOS.alerta}</div>
          <h3 class="pubs-subtab-empty__titulo">No se pudieron cargar</h3>
          <p class="pubs-subtab-empty__text">${err.message || ''}</p>
        </div>`;
      return;
    }

    wrapper.innerHTML = `
      <div class="perfil-pubs-header mb-4" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <h3 class="card__title" style="margin:0">Publicaciones de ${t.nombre}</h3>
        ${puedePublicar ? `
          <button class="btn btn--primary btn--sm" id="btn-nueva-pub-torneo">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nueva publicación
          </button>
        ` : ''}
      </div>
      <div id="feed-torneo-contenido"></div>
    `;

    const feedCont = document.getElementById('feed-torneo-contenido');

    renderFeedPublicaciones(feedCont, publicaciones, {
      onRefrescar: () => renderTabPublicaciones(cont, t)
    });

    document.getElementById('btn-nueva-pub-torneo')?.addEventListener('click', () => {
      abrirModalCrearPublicacionCompartido(
        'torneo',
        t.id,
        () => renderTabPublicaciones(cont, t),
        { tipo: 'post' }
      );
    });
  }

  /* =========================================================
     VER DETALLE DEL PARTIDO
     ========================================================= */
  function abrirVerDetallePartido(t, partido) {
    partidoDetalleActual = partido;

    const reglas = getReglasDeporte(t.deporte);
    const sistema = t.sistemaClasificacion || 'simple';
    const esIndividual = t.tipoParticipacion === 'individual';

    const titulo = document.getElementById('ver-detalle-partido-titulo');
    const body = document.getElementById('ver-detalle-partido-body');
    const btnEditar = document.getElementById('btn-editar-resultado-desde-detalle');

    titulo.textContent = `Detalle · ${t.deporte}`;

    const marcadorPrincipal = formatearMarcadorTorneo(t.deporte, partido.resultado, sistema);

    const localEscHtml = `<div style="display:flex; justify-content:center">${renderEscudoCruce(partido.localEscudo, esIndividual, 64)}</div>`;
    const visEscHtml = `<div style="display:flex; justify-content:center">${renderEscudoCruce(partido.visitanteEscudo, esIndividual, 64)}</div>`;

    let setsHtml = '';
    if (reglas.tipo === 'sets' && Array.isArray(partido.resultado?.sets)) {
      const setsLocal = partido.resultado.setsLocal ?? 0;
      const setsVisitante = partido.resultado.setsVisitante ?? 0;

      setsHtml = `
        <div class="ver-detalle__sets">
          ${partido.resultado.sets.map((s, i) => {
            const local = Number(s.local) || 0;
            const visitante = Number(s.visitante) || 0;
            const localGana = local > visitante;
            const visitaGana = visitante > local;

            return `
              <div class="ver-detalle__set">
                <div class="ver-detalle__set-num">Set ${i + 1}</div>
                <div class="ver-detalle__set-marcador">
                  <span class="${localGana ? 'ver-detalle__set-ganador' : ''}">${local}</span>
                  <span class="ver-detalle__set-sep">-</span>
                  <span class="${visitaGana ? 'ver-detalle__set-ganador' : ''}">${visitante}</span>
                </div>
                <div class="ver-detalle__set-check">
                  ${localGana ? '✓' : visitaGana ? ' ' : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="ver-detalle__resumen-sets">
          <span>Sets ganados: <strong>${setsLocal} - ${setsVisitante}</strong></span>
        </div>
      `;
    }

    let penalesHtml = '';
    if (partido.resultado?.penales_local != null && partido.resultado?.penales_visitante != null) {
      penalesHtml = `
        <div class="ver-detalle__penales">
          <div class="badge badge--info">${reglas.labelDesempate || 'Desempate'}: ${partido.resultado.penales_local} - ${partido.resultado.penales_visitante}</div>
        </div>
      `;
    }

    let tiempoPuntosHtml = '';
    if ((sistema === 'tiempo' || sistema === 'puntos') && Array.isArray(partido.resultado?.participantes)) {
      const partes = partido.resultado.participantes;

      tiempoPuntosHtml = `
        <div class="ver-detalle__tp" style="margin-top:var(--space-4)">
          ${partes.map(p => {
            const esLocal = String(p.id) === String(partido.equipoLocalId);
            const nombre = esLocal ? (partido.localNombre || 'Local') : (partido.visitanteNombre || 'Visitante');
            const escudo = esLocal ? (partido.localEscudo || ICONOS.escudo) : (partido.visitanteEscudo || ICONOS.escudo);

            const valor = sistema === 'tiempo'
              ? formatearTiempo(p.tiempoSeg)
              : (p.puntos != null ? String(p.puntos) + ' pts' : '—');

            const esGanador =
              (sistema === 'tiempo' && String(p.id) === String(partido.equipoLocalId) && partido.ganador === 'local') ||
              (sistema === 'tiempo' && String(p.id) === String(partido.equipoVisitanteId) && partido.ganador === 'visitante') ||
              (sistema === 'puntos' && String(p.id) === String(partido.equipoLocalId) && partido.ganador === 'local') ||
              (sistema === 'puntos' && String(p.id) === String(partido.equipoVisitanteId) && partido.ganador === 'visitante');

            return `
              <div class="ver-detalle__tp-fila" style="display:flex; align-items:center; justify-content:space-between; padding:var(--space-3); background:var(--color-bg-alt); border-radius:var(--radius-md); margin-bottom:var(--space-2); ${esGanador ? 'border:2px solid var(--color-success)' : ''}">
                <div style="display:flex; align-items:center; gap:var(--space-3)">
                  ${esIndividual
                    ? `<img src="${escudo === ICONOS.escudo ? 'assets/icons/usuario.svg' : escudo}" alt="" class="avatar avatar--md" />`
                    : renderEscudoCruce(escudo === ICONOS.escudo ? null : escudo, false, 28)}
                  <div>
                    <div style="font-weight:600">${nombre}</div>
                    ${esGanador ? `<div class="badge badge--success" style="margin-top:4px">${ICONOS.trofeo} Ganador</div>` : ''}
                  </div>
                </div>
                <div style="font-size:var(--fs-lg); font-weight:700; ${esGanador ? 'color:var(--color-success)' : ''}">
                  ${valor}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    const ganadorHtml = partido.ganador === 'local'
      ? `<span class="badge badge--success">${ICONOS.trofeo} Ganó ${partido.localNombre || 'Local'}${t.deporte === 'Boxeo' && partido.resultado?.metodo === 'KO' ? ' por KO' : ''}</span>`
      : partido.ganador === 'visitante'
        ? `<span class="badge badge--success">${ICONOS.trofeo} Ganó ${partido.visitanteNombre || 'Visitante'}${t.deporte === 'Boxeo' && partido.resultado?.metodo === 'KO' ? ' por KO' : ''}</span>`
        : `<span class="badge badge--warning">Empate</span>`;

    body.innerHTML = `
      <div class="ver-detalle__cabecera">
        <div class="ver-detalle__equipo">
          ${localEscHtml}
          <div class="ver-detalle__equipo-nombre">${partido.localNombre || 'Local'}</div>
        </div>
        <div class="ver-detalle__vs">
          <div class="ver-detalle__marcador">${marcadorPrincipal}</div>
          <div class="ver-detalle__vs-txt">VS</div>
        </div>
        <div class="ver-detalle__equipo">
          ${visEscHtml}
          <div class="ver-detalle__equipo-nombre">${partido.visitanteNombre || 'Visitante'}</div>
        </div>
      </div>

      ${setsHtml}
      ${penalesHtml}
      ${tiempoPuntosHtml}

      <div class="ver-detalle__footer-info">
        ${ganadorHtml}
      </div>

      ${partido.fecha ? `<p class="text-xs text-muted text-center mt-4">${ICONOS.calendario} ${formatearFecha(partido.fecha)}</p>` : ''}
    `;

    if (puedeGestionar(t)) {
      btnEditar.style.display = '';
      btnEditar.onclick = () => {
        cerrarModal('modal-ver-detalle-partido');
        setTimeout(() => abrirCargarResultado(t, partido), 200);
      };
    } else {
      btnEditar.style.display = 'none';
    }

    abrirModal('modal-ver-detalle-partido');
  }

  /* =========================================================
     EDITAR CRUCE
     ========================================================= */
  function abrirEditarCruce(t, partido) {
    if (!puedeGestionar(t)) return;
    if (t.fixtureBloqueado) return;

    cruceActual = partido;

    const selectLocal = document.getElementById('editar-cruce-local');
    const selectVisita = document.getElementById('editar-cruce-visitante');
    const titulo = document.getElementById('editar-cruce-titulo');
    const descripcion = document.getElementById('editar-cruce-descripcion');

    const esIndividual = t.tipoParticipacion === 'individual';
    const inscritos = t.equipos || [];

    titulo.textContent = `Editar ${FASES_LABEL[partido.fase] || 'cruce'}`;
    descripcion.textContent = 'Cambia los participantes del cruce. Si eliges uno que está en otro cruce de esta fase, se intercambiarán automáticamente. Puedes dejar una posición vacía para dar un BYE.';

    const opciones = inscritos.map(e =>
      `<option value="${e.id}">${escapeHtml(e.nombre)}</option>`
    ).join('');

    // Las opciones se crean una sola vez. Reconstruir innerHTML en cada cambio
    // borraba el value seleccionado y el backend recibía NULL (bye).
    selectLocal.innerHTML = `<option value="">— Vacío (bye) —</option>${opciones}`;
    selectVisita.innerHTML = `<option value="">— Vacío (bye) —</option>${opciones}`;
    selectLocal.value = partido.equipoLocalId || '';
    selectVisita.value = partido.equipoVisitanteId || '';

    function actualizarOpciones() {
      const localId = selectLocal.value;
      const visitaId = selectVisita.value;
      Array.from(selectLocal.options).forEach(op => {
        op.disabled = Boolean(op.value && op.value === visitaId);
      });
      Array.from(selectVisita.options).forEach(op => {
        op.disabled = Boolean(op.value && op.value === localId);
      });
    }
    selectLocal.onchange = actualizarOpciones;
    selectVisita.onchange = actualizarOpciones;
    actualizarOpciones();

    const btnGuardar = document.getElementById('btn-guardar-cruce');
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar cambios';
    btnGuardar.onclick = () => guardarCruce(t, partido);

    abrirModal('modal-editar-cruce');
  }

  async function guardarCruce(t, partido) {
    const localId = document.getElementById('editar-cruce-local')?.value || null;
    const visitaId = document.getElementById('editar-cruce-visitante')?.value || null;

    if (!localId && !visitaId) {
      if (!confirm('Este cruce va a quedar vacío. ¿Quierés borrarlo?')) return;

      try {
        await eliminarPartidoTorneoAPI(t.id, partido.id);
        toast('Cruce eliminado', 'info');
        cerrarModal('modal-editar-cruce');

        torneo = await obtenerTorneo(t.id);
        await render();
      } catch (err) {
        console.error('[torneo-detalle] Error al borrar cruce:', err);
        toast(err.message || 'No se pudo borrar el cruce', 'error');
      }
      return;
    }

    if (localId && visitaId && localId === visitaId) {
      return toast('Local y visitante no pueden ser el mismo', 'error');
    }

    const btn = document.getElementById('btn-guardar-cruce');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      await editarCruceAPI(t.id, partido.id, {
        equipoLocalId: localId,
        equipoVisitanteId: visitaId,
      });

      toast('Cruce actualizado', 'success');
      cerrarModal('modal-editar-cruce');

      torneo = await obtenerTorneo(t.id);
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al editar cruce:', err);
      toast(err.message || 'No se pudo editar el cruce', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar cambios';
    }
  }

  /* =========================================================
     ARMAR FIXTURE
     ========================================================= */
  async function armarAleatorio(t) {
    if (!confirm('¿Armar el fixture aleatorio? Se mezclarán los participantes en cruces al azar.')) return;

    try {
      const resultado = await armarFixtureAleatorioAPI(t.id);
      toast(resultado.mensaje || 'Fixture aleatorio armado', 'success');

      torneo = await obtenerTorneo(t.id);
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al armar fixture aleatorio:', err);
      toast(err.message || 'No se pudo armar el fixture', 'error');
    }
  }

  function abrirArmarManual(t) {
    const body = document.getElementById('armar-fixture-body');
    if (!body) return;

    const esIndividual = t.tipoParticipacion === 'individual';
    const inscritos = t.equipos || [];

    if (inscritos.length < 2) {
      toast('Necesitás al menos 2 participantes', 'error');
      return;
    }

    const cantidadInscritos = inscritos.length;
    let cantidadSlots;
    if (cantidadInscritos <= 2) cantidadSlots = 2;
    else if (cantidadInscritos <= 4) cantidadSlots = 4;
    else if (cantidadInscritos <= 8) cantidadSlots = 8;
    else if (cantidadInscritos <= 16) cantidadSlots = 16;
    else if (cantidadInscritos <= 32) cantidadSlots = 32;
    else cantidadSlots = 64;

    const cantidadCruces = cantidadSlots / 2;

    const opcionesEquipos = inscritos.map(e =>
      `<option value="${e.id}">${e.nombre}</option>`
    ).join('');

    let html = '';
    for (let i = 0; i < cantidadCruces; i++) {
      html += `
        <div class="form-row mb-4" style="grid-template-columns:1fr 1fr; gap:var(--space-2)">
          <div class="field" style="margin:0">
            <label class="field__label" style="font-size:var(--fs-xs)">Local ${i + 1}</label>
            <select class="field__input" data-cruce-local="${i}">
              <option value="">— Vacío (bye) —</option>
              ${opcionesEquipos}
            </select>
          </div>
          <div class="field" style="margin:0">
            <label class="field__label" style="font-size:var(--fs-xs)">Visitante ${i + 1}</label>
            <select class="field__input" data-cruce-visitante="${i}">
              <option value="">— Vacío (bye) —</option>
              ${opcionesEquipos}
            </select>
          </div>
        </div>
      `;
    }

    body.innerHTML = html;

    const btn = document.getElementById('btn-confirmar-armado');
    btn.disabled = false;
    btn.textContent = 'Armar fixture';
    btn.onclick = () => guardarArmadoManual(t, cantidadCruces);

    abrirModal('modal-armar-fixture');
  }

  async function guardarArmadoManual(t, cantidadCruces) {
    const cruces = [];

    for (let i = 0; i < cantidadCruces; i++) {
      const local = document.querySelector(`[data-cruce-local="${i}"]`)?.value;
      const visitante = document.querySelector(`[data-cruce-visitante="${i}"]`)?.value;

      if (!local && !visitante) return toast(`El cruce ${i + 1} está vacío`, 'error');
      if (local && visitante && local === visitante) return toast(`El cruce ${i + 1} tiene el mismo equipo en local y visitante`, 'error');

      cruces.push({ localId: local || null, visitanteId: visitante || null });
    }

    const btn = document.getElementById('btn-confirmar-armado');
    btn.disabled = true;
    btn.textContent = 'Armando...';

    try {
      await armarFixtureManualAPI(t.id, cruces);
      toast('Fixture armado', 'success');
      cerrarModal('modal-armar-fixture');

      torneo = await obtenerTorneo(t.id);
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al armar fixture manual:', err);
      toast(err.message || 'No se pudo armar el fixture', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Armar fixture';
    }
  }

  async function confirmarFixture(t) {
    if (!confirm('¿Confirmar el fixture? Ya no podrás editar los cruces.')) return;

    try {
      await confirmarFixtureAPI(t.id);
      toast('Fixture confirmado', 'success');

      torneo = await obtenerTorneo(t.id);
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al confirmar fixture:', err);
      toast(err.message || 'No se pudo confirmar el fixture', 'error');
    }
  }

  async function rearmarFixture(t) {
    const partidos = t.partidos || [];
    const partidosConResultado = partidos.filter(p => p.estado === 'finalizado' && p.resultado);

    if (partidosConResultado.length > 0) {
      const msg =
        `ATENCIÓN\n\n` +
        `Este torneo ya tiene ${partidosConResultado.length} partido(s) con resultado cargado.\n\n` +
        `Si rehacés el fixture, se van a borrar TODOS los cruces Y TODOS los resultados.\n\n` +
        `¿Estás seguro de que quieres rehacer el fixture?`;

      if (!confirm(msg)) return;
      if (!confirm('Última confirmación: ¿rehacer el fixture y perder todos los resultados?')) return;
    } else {
      if (!confirm('¿Borrar el fixture actual? Se eliminarán todos los partidos y cruces.')) return;
    }

    try {
      for (const p of partidos) {
        try {
          await eliminarPartidoTorneoAPI(t.id, p.id);
        } catch (e) {
          console.warn('[torneo-detalle] No se pudo borrar partido:', p.id, e.message);
        }
      }

      toast('Fixture borrado', 'info');
      torneo = await obtenerTorneo(t.id);
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al rehacer fixture:', err);
      toast(err.message || 'No se pudo borrar el fixture', 'error');
    }
  }

  /* =========================================================
     GESTIONAR SOLICITUDES
     ========================================================= */
  function abrirGestionSolicitudes(t) {
    if (!(esOrganizador(t) || t.soySubOrganizador === true)) {
      toast('Solo creadores y suborganizadores pueden revisar solicitudes', 'error');
      return;
    }
    renderSolicitudes(t, 'pendientes');
    abrirModal('modal-gestionar-solicitudes');
  }

  function renderSolicitudes(t, tab) {
    const cont = document.getElementById('lista-solicitudes');
    if (!cont) return;
    if (!(esOrganizador(t) || t.soySubOrganizador === true)) {
      cont.textContent = 'No tienes permiso para revisar solicitudes.';
      return;
    }

    const esIndividual = t.tipoParticipacion === 'individual';

    document.querySelectorAll('[data-tab-sol]').forEach(el => {
      el.classList.toggle('active', el.dataset.tabSol === tab);
    });

    const listaEspera = t.listaEspera || [];
    const pendientes = listaEspera.filter(l => l.estado === 'pendiente');
    const aceptados  = listaEspera.filter(l => l.estado === 'aceptado');
    const rechazados = listaEspera.filter(l => l.estado === 'rechazado');

    document.getElementById('count-sol-pendientes').textContent = pendientes.length;
    document.getElementById('count-sol-aceptados').textContent = aceptados.length;
    document.getElementById('count-sol-rechazados').textContent = rechazados.length;

    let lista;
    if (tab === 'pendientes') lista = pendientes;
    else if (tab === 'aceptados') lista = aceptados;
    else lista = rechazados;

    const total = listaEspera.length;
    const statsHtml = `
      <div class="torneo-stats-bar">
        <div class="torneo-stat-mini">
          <div class="torneo-stat-mini__valor">${(t.equipos || []).length}</div>
          <div class="torneo-stat-mini__label">${esIndividual ? 'Particip.' : 'Equipos'}</div>
        </div>
        <div class="torneo-stat-mini">
          <div class="torneo-stat-mini__valor">${t.cuposEquipos - (t.equipos || []).length}</div>
          <div class="torneo-stat-mini__label">Cupos libres</div>
        </div>
        <div class="torneo-stat-mini">
          <div class="torneo-stat-mini__valor">${pendientes.length}</div>
          <div class="torneo-stat-mini__label">Pendientes</div>
        </div>
        <div class="torneo-stat-mini">
          <div class="torneo-stat-mini__valor">${total}</div>
          <div class="torneo-stat-mini__label">Totales</div>
        </div>
      </div>
    `;

    if (lista.length === 0) {
      cont.innerHTML = statsHtml + `
        <div class="empty-state--sm">
          <div class="empty-state__icon">${ICONOS.carpetaAbierta}</div>
          <p>Sin solicitudes en esta categoría</p>
        </div>`;
      return;
    }

    const lleno = (t.equipos || []).length >= t.cuposEquipos;

    const loteHtml = tab === 'pendientes' && !lleno ? `
      <div class="torneo-lote-acciones">
        <button class="btn btn--ghost btn--sm" id="btn-seleccionar-todas">Seleccionar todas</button>
        <button class="btn btn--accion-lote btn--sm" id="btn-aprobar-lote" disabled>
          ${ICONOS.check} Aprobar seleccionadas
        </button>
        <button class="btn btn--ghost btn--sm" id="btn-rechazar-lote" disabled>
          Rechazar
        </button>
      </div>
    ` : '';

    cont.innerHTML = statsHtml + loteHtml + lista.map((sol, i) => `
      <div class="solicitud-item">
        ${tab === 'pendientes' && !lleno ? `
          <input type="checkbox" data-sel="${i}" />
        ` : ''}

        <div class="avatar avatar--md" style="background:var(--color-primary-light); display:grid; place-items:center; overflow:hidden">
          ${renderEscudoCruce(sol.equipoEscudo, esIndividual, 40)}
        </div>
        <div class="solicitud-item__info" data-ver="${i}" style="cursor:pointer">
          <div class="solicitud-item__nombre">${sol.equipoNombre}</div>
          <div class="solicitud-item__meta">
            ${sol.origen === 'invitacion-aceptada'
              ? `${ICONOS.check} Aceptó tu invitación`
              : (esIndividual ? `${ICONOS.carta} Solicitó inscribirse` : `${ICONOS.carta} Solicitó unirse`)} ·
            ${new Date(sol.fecha).toLocaleDateString('es-CL')}
          </div>
        </div>
        <div class="solicitud-item__actions">
          ${!esIndividual ? `<button class="btn btn--ghost btn--sm" data-ver-btn="${i}">Ver</button>` : ''}
          ${!esIndividual ? `<button class="btn btn--ghost btn--sm" data-chat-capitan="${sol.equipoId}" title="Hablar con el capitán">${ICONOS.chat}</button>` : ''}
          ${sol.estado === 'pendiente' ? `
            <button class="btn btn--primary btn--sm" data-aceptar="${i}" ${lleno ? 'disabled title="Torneo lleno"' : ''}>Aprobar</button>
            <button class="btn btn--ghost btn--sm" data-rechazar="${i}">${ICONOS.x}</button>
          ` : sol.estado === 'aceptado' ? `
            <span class="badge badge--success">Aceptado</span>
            <button class="btn btn--ghost btn--sm" data-expulsar="${i}" style="color:var(--color-danger)">${ICONOS.basura}</button>
          ` : `
            <span class="badge badge--danger">Rechazado</span>
          `}
        </div>
      </div>
    `).join('');

    cont.querySelectorAll('[data-ver], [data-ver-btn]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.ver ?? el.dataset.verBtn);
        verDetalleEquipo(lista[idx]);
      });
    });

    cont.querySelectorAll('[data-aceptar]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.aceptar);
        aprobarSolicitud(t, lista[idx]);
      });
    });

    cont.querySelectorAll('[data-rechazar]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.rechazar);
        rechazarSolicitud(t, lista[idx]);
      });
    });

    cont.querySelectorAll('[data-expulsar]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.expulsar);
        expulsarSolicitante(t, lista[idx]);
      });
    });

    cont.querySelectorAll('[data-chat-capitan]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const equipoId = btn.dataset.chatCapitan;
        try {
          const eq = await obtenerGrupo(equipoId);
          const capitanId = eq.capitanId || eq.miembros?.find(m => m.rol === 'capitan')?.id;
          
          if (!capitanId) {
            return toast('No se pudo encontrar al capitán del equipo', 'error');
          }

          const { crearConversacion } = await import('../services/mensajes.service.js');
          const conv = await crearConversacion(capitanId);
          cerrarModal('modal-gestionar-solicitudes');
          window.location.hash = '#/mensajes';
          setTimeout(() => {
            document.querySelector(`[data-conv="${conv.id}"]`)?.click();
          }, 400);
        } catch (err) {
          console.error(err);
          toast('Error al abrir el chat con el capitán', 'error');
        }
      });
    });

    const checkboxes = cont.querySelectorAll('input[data-sel]');
    const btnAprobarLote = document.getElementById('btn-aprobar-lote');
    const btnRechazarLote = document.getElementById('btn-rechazar-lote');
    const btnSeleccionarTodas = document.getElementById('btn-seleccionar-todas');

    function actualizarLote() {
      const marcadas = cont.querySelectorAll('input[data-sel]:checked').length;
      if (btnAprobarLote) btnAprobarLote.disabled = marcadas === 0;
      if (btnRechazarLote) btnRechazarLote.disabled = marcadas === 0;
    }

    checkboxes.forEach(cb => cb.addEventListener('change', actualizarLote));

    btnSeleccionarTodas?.addEventListener('click', () => {
      const todasMarcadas = [...checkboxes].every(cb => cb.checked);
      checkboxes.forEach(cb => cb.checked = !todasMarcadas);
      actualizarLote();
      btnSeleccionarTodas.textContent = todasMarcadas ? 'Seleccionar todas' : 'Deseleccionar todas';
    });

    btnAprobarLote?.addEventListener('click', async () => {
      const marcadas = [...cont.querySelectorAll('input[data-sel]:checked')].map(cb => Number(cb.dataset.sel));
      await aprobarLote(t, marcadas.map(i => lista[i]));
    });

    btnRechazarLote?.addEventListener('click', async () => {
      const marcadas = [...cont.querySelectorAll('input[data-sel]:checked')].map(cb => Number(cb.dataset.sel));
      if (marcadas.length === 0) return;
      if (!confirm(`¿Rechazar ${marcadas.length} solicitud(es)?`)) return;

      for (const i of marcadas) {
        await rechazarSolicitud(t, lista[i], true);
      }

      await render();
      abrirGestionSolicitudes(torneo);
    });
  }

  async function aprobarSolicitud(t, sol) {
    try {
      await gestionarSolicitudAPI(t.id, String(sol.equipoId), 'aprobar');
      toast('Solicitud aprobada', 'success');
      await render();
      abrirGestionSolicitudes(torneo);
    } catch (err) {
      console.error('[torneo-detalle] Error al aprobar:', err);
      toast(err.message || 'No se pudo aprobar', 'error');
    }
  }

  async function rechazarSolicitud(t, sol, silencioso = false) {
    try {
      await gestionarSolicitudAPI(t.id, String(sol.equipoId), 'rechazar');
      if (!silencioso) {
        toast('Solicitud rechazada', 'info');
        await render();
        abrirGestionSolicitudes(torneo);
      }
    } catch (err) {
      console.error('[torneo-detalle] Error al rechazar:', err);
      if (!silencioso) toast(err.message || 'No se pudo rechazar', 'error');
    }
  }

  async function aprobarLote(t, solicitudes) {
    let aprobadas = 0;

    for (const sol of solicitudes) {
      if (sol.estado !== 'pendiente') continue;
      try {
        await gestionarSolicitudAPI(t.id, String(sol.equipoId), 'aprobar');
        aprobadas++;
      } catch (err) {
        console.warn('[torneo-detalle] No se pudo aprobar:', sol.equipoNombre, err.message);
      }
    }

    toast(`Aprobadas ${aprobadas} solicitud(es)`, 'success');
    await render();
    abrirGestionSolicitudes(torneo);
  }

  async function expulsarSolicitante(t, sol) {
    const esIndividual = t.tipoParticipacion === 'individual';
    const nombre = sol.equipoNombre;
    if (!confirm(`¿Eliminar a ${nombre} del torneo? ${esIndividual ? 'Le' : 'El capitán y admins van a recibir'} una notificación.`)) return;

    try {
      await expulsarEquipoAPI(t.id, String(sol.equipoId));
      toast(esIndividual ? 'Participante retirado' : 'Equipo retirado', 'info');
      await render();
      abrirGestionSolicitudes(torneo);
    } catch (err) {
      console.error('[torneo-detalle] Error al expulsar:', err);
      toast(err.message || 'No se pudo expulsar', 'error');
    }
  }

  document.querySelectorAll('[data-tab-sol]').forEach(tab => {
    tab.addEventListener('click', () => {
      if (torneo) renderSolicitudes(torneo, tab.dataset.tabSol);
    });
  });

  /* =========================================================
     INVITAR EQUIPO
     ========================================================= */
  function abrirInvitarEquipo(t) {
    renderEquiposInvitar(t, '');
    abrirModal('modal-invitar-equipo');
  }

  async function renderEquiposInvitar(t, filtro) {
    const cont = document.getElementById('lista-equipos-invitar');
    if (!cont) return;

    cont.innerHTML = `<p class="text-sm text-muted text-center">Cargando equipos...</p>`;

    let todos = [];
    try {
      const { data } = await listarGrupos({ tipo: 'equipo', limit: 50 });
      todos = data || [];
    } catch (err) {
      console.error('[torneo-detalle] Error al cargar equipos:', err);
      cont.innerHTML = `<p class="text-sm text-muted text-center">Error al cargar equipos</p>`;
      return;
    }

    const excluidos = new Set([
      ...(t.equipos || []).map(e => String(e.id)),
      ...(t.listaEspera || []).filter(l => l.estado === 'pendiente').map(l => String(l.equipoId)),
      ...(t.invitaciones || []).filter(i => i.estado === 'pendiente').map(i => String(i.equipoId))
    ]);

    const f = filtro.toLowerCase().trim();
    const filtrados = todos.filter(eq => {
      if (excluidos.has(String(eq.id))) return false;
      if (String(eq.capitanId) === String(user.id)) return false;
      if (f) {
        return eq.nombre.toLowerCase().includes(f) ||
               (eq.deporte || '').toLowerCase().includes(f);
      }
      return true;
    });

    if (filtrados.length === 0) {
      cont.innerHTML = `<p class="text-sm text-muted text-center" style="padding:var(--space-5)">
        No hay equipos disponibles para invitar.
      </p>`;
      return;
    }

    cont.innerHTML = filtrados.map(eq => `
      <div class="amigo-item">
        <div class="avatar avatar--md" style="background:var(--color-primary-light); display:grid; place-items:center; font-size:20px; overflow:hidden">
          ${renderEscudoCruce(eq.escudo, false, 40)}
        </div>
        <div class="amigo-item__info">
          <div class="amigo-item__name">${eq.nombre}</div>
          <div class="amigo-item__sub">${eq.deporte || 'Sin deporte'}${eq.ciudad ? ' · ' + eq.ciudad : ''}</div>
        </div>
        <button class="btn btn--primary btn--sm" data-invitar="${eq.id}">${ICONOS.mas} Invitar</button>
      </div>
    `).join('');

    cont.querySelectorAll('[data-invitar]').forEach(btn => {
      btn.addEventListener('click', () => enviarInvitacion(t, btn.dataset.invitar));
    });
  }

  async function enviarInvitacion(t, equipoId) {
    try {
      await invitarEquipoAPI(t.id, String(equipoId));
      toast('Invitación enviada', 'success');

      torneo = await obtenerTorneo(t.id);

      const input = document.getElementById('buscar-equipo-invitar');
      renderEquiposInvitar(torneo, input?.value || '');
    } catch (err) {
      console.error('[torneo-detalle] Error al invitar:', err);
      toast(err.message || 'No se pudo invitar', 'error');
    }
  }

  document.getElementById('buscar-equipo-invitar')?.addEventListener('input', (e) => {
    if (torneo) renderEquiposInvitar(torneo, e.target.value);
  });

  /* =========================================================
     VER DETALLE DE EQUIPO
     ========================================================= */
  async function verDetalleEquipo(equipoData) {
    const body = document.getElementById('ver-equipo-body');
    if (!body) return;

    document.getElementById('ver-equipo-titulo').textContent = 'Perfil del equipo';
    
    abrirModal('modal-ver-equipo');

    await renderGrupoPublico(body, equipoData.equipoId || equipoData.id, {
      onVolver: () => cerrarModal('modal-ver-equipo')
    });
  }

  function irAlTabChatTorneo() {
    tabActual = 'chat';
    renderTabActual(torneo);
  }

  /* =========================================================
     CONECTAR EVENTOS DEL HERO + TABS
     ========================================================= */
  function conectarEventos(t) {
    document.getElementById('btn-volver')?.addEventListener('click', () => {
      window.location.hash = '#/torneos';
    });

    document.querySelectorAll('[data-ver-perfil]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        import('../components.js').then(({ verPerfilUsuario }) => {
          verPerfilUsuario(el.dataset.verPerfil);
        });
      });
    });

    document.getElementById('btn-sub-organizadores')?.addEventListener('click', () => {
      abrirModalSubOrganizadores(t);
    });

    document.getElementById('btn-guardar-torneo-historial')?.addEventListener('click', async () => {
      if (!confirm('¿Guardar este torneo para conservarlo en Mis creados después de finalizar?')) return;
      try {
        await guardarTorneoAPI(t.id);
        toast('Torneo guardado en Mis creados', 'success');
        await render();
      } catch (err) {
        toast(err.message || 'No se pudo guardar el torneo', 'error');
      }
    });

    document.getElementById('btn-editar-torneo')?.addEventListener('click', () => {
      abrirModalEditarTorneo(t);
    });

    document.querySelectorAll('[data-tab-torneo]').forEach(btn => {
      btn.addEventListener('click', () => {
        const nuevoTab = btn.dataset.tabTorneo;

        if (tabActual === 'chat' && nuevoTab !== 'chat') {
          if (intervaloCanalTorneo) {
            clearInterval(intervaloCanalTorneo);
            intervaloCanalTorneo = null;
          }
        }

        document.querySelectorAll('[data-tab-torneo]').forEach(b => b.classList.remove('subtab--active'));
        btn.classList.add('subtab--active');
        tabActual = nuevoTab;
        renderTabActual(t);
      });
    });

    document.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.addEventListener('click', () => cerrarModal(btn.dataset.cerrarModal));
    });

    [
      modalInscribir, modalInvitar, modalSolicitudes, modalChat, modalVerEquipo,
      modalTabla, modalResultados, modalCrearPartido, modalCargar, modalFixture, modalArmar,
      modalEditarJornada, modalEditarCruce, modalVerDetalle, modalEditarTorneo,
    ].forEach(m => {
      m?.addEventListener('click', (e) => {
        if (e.target === m) m.classList.remove('open');
      });
    });
  }

  /* =========================================================
     CONECTAR EVENTOS DEL TAB ACTIVO
     ========================================================= */
  function conectarEventosTab(t) {
    document.querySelectorAll('[data-expulsar-equipo]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const equipoId = btn.dataset.expulsarEquipo;
        const equipo = (t.equipos || []).find(eq => String(eq.id) === String(equipoId));
        if (!equipo) return;
        expulsarParticipanteDeLista(t, equipo);
      });
    });

    document.getElementById('btn-cerrar-torneo')?.addEventListener('click', () => cerrarTorneo(t));
    document.getElementById('btn-gestionar-solicitudes')?.addEventListener('click', () => abrirGestionSolicitudes(t));
    document.getElementById('btn-invitar-equipo')?.addEventListener('click', () => abrirInvitarEquipo(t));

    document.getElementById('btn-abrir-chat')?.addEventListener('click', () => irAlTabChatTorneo());

    document.getElementById('btn-compartir-torneo')?.addEventListener('click', async () => {
      // ⚡ Forzamos un link limpio usando el ID del torneo actual
      const url = `${window.location.origin}${window.location.pathname}#/torneo/${t.id}`;
      
      try {
        if (navigator.share) {
          await navigator.share({ title: t.nombre, url });
        } else {
          await navigator.clipboard.writeText(url);
          toast('Enlace del torneo copiado', 'success');
        }
      } catch {
        try {
          await navigator.clipboard.writeText(url);
          toast('Enlace del torneo copiado', 'success');
        } catch {
          toast('No se pudo copiar el enlace', 'error');
        }
      }
    });

    document.getElementById('btn-eliminar-torneo')?.addEventListener('click', () => eliminarTorneo(t));

    document.getElementById('btn-inscribir-equipo')?.addEventListener('click', () => {
      if (t.tipoParticipacion === 'individual') {
        inscribirmeIndividual(t);
      } else {
        abrirInscribirEquipo(t);
      }
    });

    document.getElementById('btn-aceptar-invitacion')?.addEventListener('click', () => aceptarInvitacion(t));
    document.getElementById('btn-rechazar-invitacion')?.addEventListener('click', () => rechazarInvitacion(t));
    document.getElementById('btn-cancelar-solicitud')?.addEventListener('click', () => cancelarSolicitud(t));
    document.getElementById('btn-salir-torneo')?.addEventListener('click', () => salirDelTorneo(t));
  }

  /* =========================================================
     CERRAR TORNEO
     ========================================================= */
  async function cerrarTorneo(t) {
    if (!confirm('¿Cerrar las inscripciones? Ya no se podrán inscribir más participantes.')) return;

    try {
      const resultado = await cerrarTorneoAPI(t.id);

      if (resultado.autoFixturado) {
        toast('Inscripciones cerradas. Fixture armado automáticamente.', 'success');
      } else {
        toast('Inscripciones cerradas', 'success');
      }

      torneo = resultado.torneo;
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al cerrar:', err);
      toast(err.message || 'No se pudo cerrar el torneo', 'error');
    }
  }

  /* =========================================================
     ELIMINAR TORNEO
     ========================================================= */
  async function eliminarTorneo(t) {
    if (!confirm(`¿Eliminar "${t.nombre}"? Esta acción no se puede deshacer.`)) return;

    try {
      await eliminarTorneoAPI(t.id);
      toast('Torneo eliminado', 'info');
      window.location.hash = '#/torneos';
    } catch (err) {
      console.error('[torneo-detalle] Error al eliminar:', err);
      toast(err.message || 'No se pudo eliminar el torneo', 'error');
    }
  }

  /* =========================================================
     EXPULSAR PARTICIPANTE
     ========================================================= */
  async function expulsarParticipanteDeLista(t, equipo) {
    const esIndividual = t.tipoParticipacion === 'individual';
    const nombreMostrar = esIndividual
      ? equipo.nombre
      : equipo.nombre;

    if (!confirm(`¿Eliminar a ${nombreMostrar} del torneo? ${esIndividual ? 'Le' : 'El capitán y admins van a recibir'} una notificación.`)) return;

    try {
      await expulsarEquipoAPI(t.id, String(equipo.id));
      toast(esIndividual ? 'Participante retirado' : 'Equipo retirado', 'info');
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al expulsar:', err);
      toast(err.message || 'No se pudo expulsar', 'error');
    }
  }

  /* =========================================================
     INSCRIBIRME / INSCRIBIR EQUIPO
     ========================================================= */
  async function inscribirmeIndividual(t) {
    const aceptaSolicitudes = !(t.precio === 0 && t.libreInscripcion === true);
    const mensaje = aceptaSolicitudes
      ? 'Tu inscripción quedará pendiente hasta que el organizador la apruebe. ¿Continuar?'
      : '¿Confirmar tu inscripción en este torneo?';

    if (!confirm(mensaje)) return;

    try {
      await inscribirEquipoAPI(t.id, null);
      toast(
        aceptaSolicitudes ? 'Solicitud enviada al organizador' : '¡Inscripción exitosa!',
        'success'
      );
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al inscribirme:', err);
      toast(err.message || 'No se pudo inscribir', 'error');
    }
  }

  function abrirInscribirEquipo(t) {
    const misEq = misEquiposComoCapitan();
    const lista = document.getElementById('lista-mis-equipos');
    if (!lista) return;

    if (misEq.length === 0) {
      lista.innerHTML = `<p class="text-sm text-muted text-center">No tienes equipos como capitán.</p>`;
      abrirModal('modal-inscribir-equipo');
      return;
    }

    const disponibles = misEq.filter(eq =>
      !(t.equipos || []).some(e => String(e.id) === String(eq.id)) &&
      !(t.listaEspera || []).some(l => String(l.equipoId) === String(eq.id) && l.estado === 'pendiente') &&
      !(t.invitaciones || []).some(i => String(i.equipoId) === String(eq.id) && i.estado === 'pendiente')
    );

    if (disponibles.length === 0) {
      lista.innerHTML = `<p class="text-sm text-muted text-center">Todos tus equipos ya están en este torneo o en lista de espera.</p>`;
      abrirModal('modal-inscribir-equipo');
      return;
    }

    lista.innerHTML = disponibles.map(eq => `
      <div class="amigo-item" data-equipo="${eq.id}" style="cursor:pointer">
        <div class="avatar avatar--md" style="background:var(--color-primary-light); display:grid; place-items:center; font-size:20px; overflow:hidden;">
          ${renderEscudoCruce(eq.escudo, false, 40)}
        </div>
        <div class="amigo-item__info">
          <div class="amigo-item__name">${escapeHtml(eq.nombre)}</div>
          <div class="amigo-item__sub">${escapeHtml(eq.deporte)} · ${eq.totalMiembros || 0} jugadores</div>
        </div>
        <button class="btn btn--primary btn--sm">Inscribir</button>
      </div>
    `).join('');

    lista.querySelectorAll('[data-equipo]').forEach(el => {
      el.addEventListener('click', () => {
        const eqId = el.dataset.equipo;
        inscribirEquipoDeportivo(t, eqId);
      });
    });

    abrirModal('modal-inscribir-equipo');
  }

  async function inscribirEquipoDeportivo(t, equipoId) {
    try {
      await inscribirEquipoAPI(t.id, String(equipoId));
      cerrarModal('modal-inscribir-equipo');
      toast('Solicitud enviada al organizador', 'success');
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al inscribir:', err);
      toast(err.message || 'No se pudo inscribir', 'error');
    }
  }

  /* =========================================================
     ACEPTAR / RECHAZAR INVITACIÓN
     ========================================================= */
  async function aceptarInvitacion(t) {
    const inv = miInvitacionPendiente(t);
    if (!inv) return;

    try {
      await responderInvitacionAPI(t.id, String(inv.equipoId), true);
      toast('¡Te uniste al torneo!', 'success');
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al aceptar invitación:', err);
      toast(err.message || 'No se pudo aceptar', 'error');
    }
  }

  async function rechazarInvitacion(t) {
    const inv = miInvitacionPendiente(t);
    if (!inv) return;

    try {
      await responderInvitacionAPI(t.id, String(inv.equipoId), false);
      toast('Invitación rechazada', 'info');
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al rechazar invitación:', err);
      toast(err.message || 'No se pudo rechazar', 'error');
    }
  }

  /* =========================================================
     CANCELAR SOLICITUD / SALIR
     ========================================================= */
  async function cancelarSolicitud(t) {
    const sol = miSolicitudPendiente(t);
    if (!sol) return;
    if (!confirm('¿Cancelar tu solicitud de inscripción?')) return;

    try {
      const esIndividual = t.tipoParticipacion === 'individual';
      await cancelarInscripcionAPI(t.id, esIndividual ? null : String(sol.equipoId));
      toast('Solicitud cancelada', 'info');
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al cancelar:', err);
      toast(err.message || 'No se pudo cancelar', 'error');
    }
  }

  async function salirDelTorneo(t) {
    if (!confirm('¿Salirte de este torneo? Tu inscripción se va a eliminar.')) return;

    const esIndividual = t.tipoParticipacion === 'individual';
    const miEquipo = miEquipoInscrito(t);

    try {
      if (esIndividual) {
        await cancelarInscripcionAPI(t.id, null);
      } else {
        if (!miEquipo) {
          return toast('No se encontró tu equipo inscrito', 'error');
        }
        await cancelarInscripcionAPI(t.id, String(miEquipo.id));
      }

      toast('Saliste del torneo', 'info');
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al salir:', err);
      toast(err.message || 'No se pudo salir del torneo', 'error');
    }
  }

  /* =========================================================
     BORRAR JORNADA
     ========================================================= */
  async function borrarJornada(t, jornada) {
    const partidos = (t.partidos || []).filter(p => String(p.jornadaId) === String(jornada.id));

    if (partidos.length > 0) {
      const msg = `La jornada "${jornada.nombre}" tiene ${partidos.length} partido(s). ¿Borrar la jornada y TODOS sus partidos?`;
      if (!confirm(msg)) return;

      for (const p of partidos) {
        try {
          await eliminarPartidoTorneoAPI(t.id, p.id);
        } catch (e) {
          console.warn('[torneo-detalle] No se pudo borrar partido:', p.id, e.message);
        }
      }
    } else {
      if (!confirm(`¿Borrar la jornada "${jornada.nombre}"?`)) return;
    }

    try {
      await eliminarJornadaAPI(t.id, jornada.id);
      toast('Jornada borrada', 'info');

      torneo = await obtenerTorneo(t.id);
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al borrar jornada:', err);
      toast(err.message || 'No se pudo borrar la jornada', 'error');
    }
  }

  /* =========================================================
     EDITAR JORNADA
     ========================================================= */
  function abrirEditarJornada(t, jornada) {
    if (!puedeGestionar(t)) return;

    window.__jornadaEnEdicion = {
      jornada,
      partidos: (t.partidos || []).filter(p => String(p.jornadaId) === String(jornada.id)),
      partidosEliminar: [],
      torneoId: t.id,
    };

    document.getElementById('editar-jornada-titulo').textContent =
      `Editar ${jornada.nombre || `Jornada ${jornada.numero}`}`;

    document.getElementById('editar-jornada-nombre').value = jornada.nombre || '';

    const btnGuardar = document.getElementById('btn-guardar-jornada');
    btnGuardar.onclick = () => guardarJornadaCompleta(t);
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar cambios';

    const btnAgregar = document.getElementById('btn-jornada-agregar-partido');
    btnAgregar.onclick = () => agregarPartidoAJornadaInline(t);

    const btnBorrarTodos = document.getElementById('btn-jornada-borrar-todos');
    btnBorrarTodos.onclick = () => borrarTodosLosPartidosInline(t);

    renderizarEditarJornada(t);

    abrirModal('modal-editar-jornada');
  }

  function renderizarEditarJornada(t) {
    const cont = document.getElementById('editar-jornada-partidos');
    const estado = window.__jornadaEnEdicion;
    if (!cont || !estado) return;

    const esIndividual = t.tipoParticipacion === 'individual';
    const sistema = t.sistemaClasificacion || 'simple';

    if (estado.partidos.length === 0) {
      cont.innerHTML = `
        <p class="text-sm text-muted text-center" style="padding:var(--space-4)">
          Sin partidos en esta jornada.
        </p>
      `;
      return;
    }

    cont.innerHTML = estado.partidos.map((p, i) => {
      const finalizado = p.estado === 'finalizado';
      const fechaVal = p.fecha ? new Date(p.fecha).toISOString().slice(0, 16) : '';

      const localHtml = renderEscudoCruce(p.localEscudo, esIndividual, 20);
      const visHtml = renderEscudoCruce(p.visitanteEscudo, esIndividual, 20);

      let resultadoHtml = '';
      if (finalizado && p.resultado) {
        const marcador = formatearMarcadorTorneo(t.deporte, p.resultado, sistema);
        resultadoHtml = `
          <div class="partido-editable__resultado">
            <span class="badge badge--success">Finalizado: ${marcador}</span>
          </div>
        `;
      }

      return `
        <div class="partido-editable" data-partido-index="${i}">
          <div class="partido-editable__encabezado">
            <div class="partido-editable__equipos">
              <div style="display:flex; align-items:center; gap:6px">
                ${localHtml}
                <span style="font-weight:500">${p.localNombre || 'Local'}</span>
              </div>
              <div style="color:var(--color-text-muted); font-size:12px">vs</div>
              <div style="display:flex; align-items:center; gap:6px">
                ${visHtml}
                <span style="font-weight:500">${p.visitanteNombre || 'Visitante'}</span>
              </div>
            </div>
            <button class="btn btn--ghost btn--sm" data-partido-eliminar="${i}" style="color:var(--color-danger)" title="Borrar partido">
              ${ICONOS.basura}
            </button>
          </div>

          ${resultadoHtml}

          <div class="partido-editable__campos">
            <div class="field" style="margin:0; flex:1">
              <label class="field__label" style="font-size:var(--fs-xs)">Fecha del partido</label>
              <input type="datetime-local" class="field__input" data-partido-fecha="${i}" value="${fechaVal}" />
            </div>
          </div>
        </div>
      `;
    }).join('');

    cont.querySelectorAll('[data-partido-eliminar]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.partidoEliminar);
        eliminarPartidoInline(t, idx);
      });
    });
  }

  function eliminarPartidoInline(t, idx) {
    const estado = window.__jornadaEnEdicion;
    if (!estado) return;

    const partido = estado.partidos[idx];
    if (!partido) return;

    const nombrePartido = `"${partido.localNombre || 'Local'} vs ${partido.visitanteNombre || 'Visitante'}"`;
    const tieneResultado = partido.estado === 'finalizado' && partido.resultado != null;

    if (tieneResultado) {
      const confirmMsg =
        `ATENCIÓN: Este partido ya tiene un resultado cargado.\n\n` +
        `${nombrePartido}\n\n` +
        `Si lo borras, se va a recalcular la tabla de posiciones y los puntos de este partido se van a perder.\n\n` +
        `¿Estás seguro de que quieres borrarlo?`;

      if (!confirm(confirmMsg)) return;
    } else {
      if (!confirm(`¿Borrar el partido ${nombrePartido}?`)) return;
    }

    estado.partidosEliminar.push(partido.id);
    estado.partidos.splice(idx, 1);
    renderizarEditarJornada(t);
  }

  function borrarTodosLosPartidosInline(t) {
    const estado = window.__jornadaEnEdicion;
    if (!estado) return;

    if (estado.partidos.length === 0) {
      return toast('No hay partidos para borrar', 'info');
    }

    if (!confirm(`¿Borrar los ${estado.partidos.length} partidos de esta jornada?`)) return;

    estado.partidos.forEach(p => {
      if (!estado.partidosEliminar.includes(p.id)) {
        estado.partidosEliminar.push(p.id);
      }
    });
    estado.partidos = [];
    renderizarEditarJornada(t);
  }

  function agregarPartidoAJornadaInline(t) {
    const jornadaId = window.__jornadaEnEdicion?.jornada?.id || null;
    cerrarModal('modal-editar-jornada');
    abrirCrearPartido(t, jornadaId);
  }

  async function guardarJornadaCompleta(t) {
    const estado = window.__jornadaEnEdicion;
    if (!estado) return;

    const nombreJ = document.getElementById('editar-jornada-nombre').value.trim();

    const jornadaCambios = {};
    if (nombreJ && nombreJ !== estado.jornada.nombre) {
      jornadaCambios.nombre = nombreJ;
    }

    const partidosCambios = [];

    estado.partidos.forEach((p, i) => {
      const fechaInput = document.querySelector(`[data-partido-fecha="${i}"]`);
      if (!fechaInput) return;

      const fechaStr = fechaInput.value || '';
      const fechaActualStr = p.fecha ? new Date(p.fecha).toISOString().slice(0, 16) : '';

      if (fechaStr !== fechaActualStr) {
        partidosCambios.push({
          id: p.id,
          fecha: fechaStr ? new Date(fechaStr).toISOString() : null,
        });
      }
    });

    const body = {};
    if (Object.keys(jornadaCambios).length > 0) body.jornada = jornadaCambios;
    if (partidosCambios.length > 0) body.partidos = partidosCambios;
    if (estado.partidosEliminar.length > 0) body.partidosEliminar = estado.partidosEliminar;

    if (Object.keys(body).length === 0) {
      toast('No hay cambios para guardar', 'info');
      cerrarModal('modal-editar-jornada');
      window.__jornadaEnEdicion = null;
      return;
    }

    const btn = document.getElementById('btn-guardar-jornada');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      await guardarJornadaBulkAPI(t.id, estado.jornada.id, body);
      toast('Jornada actualizada', 'success');
      cerrarModal('modal-editar-jornada');
      window.__jornadaEnEdicion = null;

      torneo = await obtenerTorneo(t.id);
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al guardar jornada:', err);
      toast(err.message || 'No se pudo guardar la jornada', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar cambios';
    }
  }

  /* =========================================================
     CREAR PARTIDO
     ========================================================= */
  function abrirCrearPartido(t, jornadaPreseleccionada = null) {
    if (t.modalidad !== 'liga') return;
    if (!puedeGestionar(t)) return;

    const tSelJornada = document.getElementById('crear-partido-jornada');
    const tSelLocal    = document.getElementById('crear-partido-local');
    const tSelVisita   = document.getElementById('crear-partido-visitante');
    const inputFecha   = document.getElementById('crear-partido-fecha');
    const wrapperJorn  = document.getElementById('crear-partido-jornada-wrapper');

    const esIndividual = t.tipoParticipacion === 'individual';
    const inscritos = t.equipos || [];
    const jornadas = t.jornadas || [];

    if (inscritos.length < 2) {
      toast('Necesitás al menos 2 participantes inscritos', 'error');
      return;
    }

    const opcionesEquipos = inscritos.map(e =>
      `<option value="${e.id}">${e.nombre}</option>`
    ).join('');

    function refrescarVisitantes() {
      const localId = tSelLocal.value;
      const opcionesVisitante = inscritos
        .filter(e => String(e.id) !== String(localId))
        .map(e => `<option value="${e.id}">${e.nombre}</option>`)
        .join('');
      tSelVisita.innerHTML = '<option value="">Seleccioná el visitante...</option>' + opcionesVisitante;
    }

    tSelLocal.innerHTML = '<option value="">Seleccioná el local...</option>' + opcionesEquipos;
    refrescarVisitantes();
    tSelLocal.onchange = refrescarVisitantes;

    wrapperJorn.style.display = '';
    if (jornadas.length === 0) {
      tSelJornada.innerHTML = '<option value="">Sin jornadas (creá una)</option>';
    } else {
      const opts = jornadas
        .sort((a, b) => a.numero - b.numero)
        .map(j => `<option value="${j.id}">${j.nombre || `Jornada ${j.numero}`}</option>`)
        .join('');
      tSelJornada.innerHTML = '<option value="">Seleccioná una jornada...</option>' + opts;
    }

    if (jornadaPreseleccionada) {
      tSelJornada.value = jornadaPreseleccionada;
    }

    inputFecha.value = '';

    const btnGuardar = document.getElementById('btn-guardar-partido');
    btnGuardar.textContent = 'Crear partido';
    btnGuardar.disabled = false;
    btnGuardar.onclick = () => guardarCrearPartido(t);

    const btnNueva = document.getElementById('btn-nueva-jornada');
    btnNueva.onclick = async () => {
      const jornada = await crearNuevaJornada(t);
      if (jornada) {
        torneo = await obtenerTorneo(t.id);
        abrirCrearPartido(torneo, jornada.id);
      }
    };

    abrirModal('modal-crear-partido');
  }

  async function guardarCrearPartido(t) {
    const jornadaId = document.getElementById('crear-partido-jornada')?.value || null;
    const localId   = document.getElementById('crear-partido-local')?.value;
    const visitaId  = document.getElementById('crear-partido-visitante')?.value;
    const fechaStr  = document.getElementById('crear-partido-fecha')?.value;

    if (!localId || !visitaId) {
      return toast('Seleccioná local y visitante', 'error');
    }
    if (localId === visitaId) {
      return toast('El local y el visitante no pueden ser el mismo', 'error');
    }

    const fecha = fechaStr ? new Date(fechaStr).toISOString() : null;

    let ronda = 'manual';
    if (jornadaId) {
      const jornada = (t.jornadas || []).find(j => String(j.id) === String(jornadaId));
      if (jornada) ronda = `jornada_${jornada.numero}`;
    }

    const btn = document.getElementById('btn-guardar-partido');
    btn.disabled = true;
    btn.textContent = 'Creando...';

    try {
      await crearPartidoTorneoAPI(t.id, {
        ronda,
        orden: 0,
        equipoLocalId: localId,
        equipoVisitanteId: visitaId,
        fecha,
        jornadaId,
      });

      toast('Partido creado', 'success');
      cerrarModal('modal-crear-partido');

      torneo = await obtenerTorneo(t.id);
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al crear partido:', err);
      toast(err.message || 'No se pudo crear el partido', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Crear partido';
    }
  }

  /* =========================================================
     RESULTADOS DE BOXEO — Victoria por puntos o KO
     ========================================================= */
  function limpiarSelectorKO() {
    document.getElementById('roster-boxeo-metodo-victoria')?.remove();
    for (const id of ['cargar-resultado-modo-simple', 'cargar-resultado-modo-tiempo-puntos']) {
      const cont = document.getElementById(id);
      if (!cont) continue;
      Array.from(cont.children).forEach(el => { el.style.display = ''; });
    }
  }

  function instalarSelectorKO(t, partido, modoActivo) {
    if (t.deporte !== 'Boxeo' || !modoActivo) return;
    const panel = document.createElement('div');
    panel.id = 'roster-boxeo-metodo-victoria';
    panel.style.cssText = 'padding:12px; margin-bottom:16px; border:1px solid var(--color-border); border-radius:10px;';
    panel.innerHTML = `
      <div class="field" style="margin-bottom:12px">
        <label class="field__label" for="roster-boxeo-metodo">Tipo de victoria</label>
        <select class="field__input" id="roster-boxeo-metodo">
          <option value="puntos">Victoria por puntos</option>
          <option value="KO">Victoria por KO</option>
        </select>
      </div>
      <div id="roster-boxeo-ganador-wrap" style="display:none">
        <label class="field__label" for="roster-boxeo-ganador">Ganador por KO</label>
        <select class="field__input" id="roster-boxeo-ganador">
          <option value="local">${escapeHtml(partido.localNombre || 'Local')}</option>
          <option value="visitante">${escapeHtml(partido.visitanteNombre || 'Visitante')}</option>
        </select>
        <p class="text-xs text-muted" style="margin:8px 0 0">Un KO finaliza el combate; no necesitas ingresar puntajes.</p>
      </div>`;

    const otrosCampos = Array.from(modoActivo.children);
    modoActivo.prepend(panel);
    const metodo = panel.querySelector('#roster-boxeo-metodo');
    const ganador = panel.querySelector('#roster-boxeo-ganador');
    const wrapGanador = panel.querySelector('#roster-boxeo-ganador-wrap');
    metodo.value = partido.resultado?.metodo === 'KO' ? 'KO' : 'puntos';
    ganador.value = partido.resultado?.ganador === 'visitante' ? 'visitante' : 'local';

    function actualizarMetodo() {
      const esKO = metodo.value === 'KO';
      wrapGanador.style.display = esKO ? '' : 'none';
      otrosCampos.forEach(el => { el.style.display = esKO ? 'none' : ''; });
      if (esKO) document.getElementById('cargar-resultado-estado').value = 'finalizado';
    }
    metodo.addEventListener('change', actualizarMetodo);
    actualizarMetodo();

    const btn = document.getElementById('btn-guardar-resultado');
    const guardarAnterior = btn.onclick;
    btn.onclick = () => {
      if (metodo.value === 'KO') return guardarResultadoKO(t, partido, ganador.value);
      return guardarAnterior?.();
    };
  }

  async function guardarResultadoKO(t, partido, ganador) {
    if (!partido.equipoLocalId || !partido.equipoVisitanteId) {
      return toast('Para registrar un KO deben existir ambos participantes', 'error');
    }
    if (ganador !== 'local' && ganador !== 'visitante') {
      return toast('Selecciona el ganador del combate', 'error');
    }
    const btn = document.getElementById('btn-guardar-resultado');
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    try {
      await cargarResultadoAPI(t.id, partido.id, {
        resultado: { metodo: 'KO', ganador },
        estado: 'finalizado',
      });
      toast('Victoria por KO registrada', 'success');
      cerrarModal('modal-cargar-resultado');
      torneo = await obtenerTorneo(t.id);
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al registrar KO:', err);
      toast(err.message || 'No se pudo registrar el KO', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar resultado';
    }
  }

  /* =========================================================
     CARGAR RESULTADO
     ========================================================= */
  function abrirCargarResultado(t, partido) {
    if (!puedeGestionar(t)) return;

    partidoActual = partido;

    const deporte = t.deporte;
    const sistema = t.sistemaClasificacion || 'simple';
    const reglas = getReglasDeporte(deporte);
    const esIndividual = t.tipoParticipacion === 'individual';

    document.getElementById('cargar-resultado-titulo').textContent = 'Cargar resultado';

    const localEsc = document.getElementById('cargar-resultado-local-escudo');
    const localNom = document.getElementById('cargar-resultado-local-nombre');
    const visEsc   = document.getElementById('cargar-resultado-visitante-escudo');
    const visNom   = document.getElementById('cargar-resultado-visitante-nombre');

    localEsc.innerHTML = renderEscudoCruce(partido.localEscudo, esIndividual, 64);
    visEsc.innerHTML   = renderEscudoCruce(partido.visitanteEscudo, esIndividual, 64);

    localNom.textContent = partido.localNombre || 'Local';
    visNom.textContent   = partido.visitanteNombre || 'Visitante';

    const modoSimple  = document.getElementById('cargar-resultado-modo-simple');
    const modoSets    = document.getElementById('cargar-resultado-modo-sets');
    const modoTP      = document.getElementById('cargar-resultado-modo-tiempo-puntos');

    limpiarSelectorKO();
    modoSimple?.classList.add('hidden');
    modoSets?.classList.add('hidden');
    modoTP?.classList.add('hidden');

    const selectEstado = document.getElementById('cargar-resultado-estado');
    selectEstado.value = partido.estado === 'finalizado' ? 'finalizado'
                       : partido.estado === 'en_curso'   ? 'en_curso'
                       : 'finalizado';

    if (sistema === 'tiempo' || sistema === 'puntos') {
      modoTP?.classList.remove('hidden');
      prepararModoTiempoPuntos(t, partido, sistema, esIndividual);
      instalarSelectorKO(t, partido, modoTP);
      abrirModal('modal-cargar-resultado');
      return;
    }

    if (reglas.tipo === 'sets') {
      modoSets?.classList.remove('hidden');

      const setsHint = document.getElementById('cargar-resultado-sets-hint');
      const setsLista = document.getElementById('cargar-resultado-sets-lista');
      const setsGanados = document.getElementById('cargar-resultado-sets-ganados');
      const btnAgregarSet = document.getElementById('btn-agregar-set');

      let hintText = 'Ingresá los puntos de cada set.';
      if (deporte === 'Vóleibol') {
        hintText = 'Sets 1-4 a 25 puntos (dif. 2). 5° set a 15 puntos.';
      } else if (deporte === 'Bádminton') {
        hintText = 'Sets a 21 puntos (dif. 2). Máx 30.';
      } else if (deporte === 'Tenis de mesa') {
        hintText = 'Sets a 11 puntos (dif. 2).';
      } else if (['Tenis', 'Pádel', 'Squash'].includes(deporte)) {
        hintText = reglas.nota || 'Ingresá el resultado de cada set.';
      }
      setsHint.textContent = hintText;

      const setsExistentes = (partido.resultado && Array.isArray(partido.resultado.sets))
        ? partido.resultado.sets
        : [];

      const setsIniciales = setsExistentes.length > 0
        ? setsExistentes
        : [{ local: 0, visitante: 0 }];

      function sincronizarSetsConDOM(sets) {
        const filas = setsLista.querySelectorAll('[data-set-index]');
        filas.forEach(fila => {
          const idx = Number(fila.dataset.setIndex);
          const local = Number(setsLista.querySelector(`[data-set-local="${idx}"]`)?.value) || 0;
          const visitante = Number(setsLista.querySelector(`[data-set-visitante="${idx}"]`)?.value) || 0;
          if (sets[idx]) {
            sets[idx].local = local;
            sets[idx].visitante = visitante;
          }
        });
      }

      function renderSets(sets) {
        setsLista.innerHTML = sets.map((s, i) => `
          <div class="set-item" data-set-index="${i}">
            <div class="set-item__label">Set ${i + 1}</div>
            <div class="set-item__inputs">
              <input type="number" class="field__input set-item__input" data-set-local="${i}" min="0" value="${s.local || 0}" placeholder="0" />
              <span class="set-item__sep">-</span>
              <input type="number" class="field__input set-item__input" data-set-visitante="${i}" min="0" value="${s.visitante || 0}" placeholder="0" />
            </div>
            ${sets.length > 1 ? `
              <button type="button" class="btn btn--ghost btn--sm set-item__del" data-set-del="${i}" style="color:var(--color-danger)" title="Borrar set">${ICONOS.basura}</button>
            ` : ''}
          </div>
        `).join('');

        setsLista.querySelectorAll('[data-set-local], [data-set-visitante]').forEach(inp => {
          inp.addEventListener('input', () => actualizarSetsGanados());
        });

        setsLista.querySelectorAll('[data-set-del]').forEach(btn => {
          btn.addEventListener('click', () => {
            sincronizarSetsConDOM(sets);
            const idx = Number(btn.dataset.setDel);
            sets.splice(idx, 1);
            renderSets(sets);
          });
        });

        actualizarSetsGanados();
      }

      function actualizarSetsGanados() {
        let setsLocal = 0;
        let setsVisitante = 0;

        setsLista.querySelectorAll('[data-set-index]').forEach(fila => {
          const idx = Number(fila.dataset.setIndex);
          const local = Number(setsLista.querySelector(`[data-set-local="${idx}"]`)?.value) || 0;
          const visitante = Number(setsLista.querySelector(`[data-set-visitante="${idx}"]`)?.value) || 0;

          if (local > visitante) setsLocal++;
          else if (visitante > local) setsVisitante++;
        });

        setsGanados.textContent = `${setsLocal} - ${setsVisitante}`;
      }

      const setsActuales = [...setsIniciales];
      renderSets(setsActuales);

      btnAgregarSet.onclick = () => {
        sincronizarSetsConDOM(setsActuales);
        setsActuales.push({ local: 0, visitante: 0 });
        renderSets(setsActuales);
      };

      const btnGuardar = document.getElementById('btn-guardar-resultado');
      btnGuardar.textContent = 'Guardar resultado';
      btnGuardar.disabled = false;
      btnGuardar.onclick = () => guardarResultadoSets(t, partido, setsLista);

      abrirModal('modal-cargar-resultado');
      return;
    }

    /* MODO SIMPLE */
    modoSimple?.classList.remove('hidden');

    const inputLocal     = document.getElementById('cargar-resultado-local');
    const inputVisitante = document.getElementById('cargar-resultado-visitante');
    const labelLocal     = document.getElementById('cargar-resultado-local-label');
    const labelVisitante = document.getElementById('cargar-resultado-visitante-label');
    const desempWrapper  = document.getElementById('cargar-resultado-desempate-wrapper');
    const desempLabel    = document.getElementById('cargar-resultado-desempate-label');
    const desempLocal    = document.getElementById('cargar-resultado-desempate-local');
    const desempVisita   = document.getElementById('cargar-resultado-desempate-visitante');

    labelLocal.textContent = reglas.labelMarcador || 'Local';
    labelVisitante.textContent = reglas.labelMarcador || 'Visitante';

    const r = partido.resultado || {};
    const campoPrincipal = formatoDeDeporte(deporte).campo;

    const localValor = r[`${campoPrincipal}_local`] ?? r.goles_local ?? r.puntos_local ?? r.carreras_local ?? 0;
    const visitValor = r[`${campoPrincipal}_visitante`] ?? r.goles_visitante ?? r.puntos_visitante ?? r.carreras_visitante ?? 0;

    inputLocal.value = localValor;
    inputVisitante.value = visitValor;

    if (permiteDesempate(deporte)) {
      desempLabel.textContent = (reglas.labelDesempate || 'Penales').toLowerCase();
      desempLocal.value = r.penales_local ?? 0;
      desempVisita.value = r.penales_visitante ?? 0;

      function actualizarDesempate() {
        const local = Number(inputLocal.value) || 0;
        const visitante = Number(inputVisitante.value) || 0;
        if (local === visitante) {
          desempWrapper.classList.remove('hidden');
        } else {
          desempWrapper.classList.add('hidden');
        }
      }

      inputLocal.oninput = actualizarDesempate;
      inputVisitante.oninput = actualizarDesempate;

      actualizarDesempate();
    } else {
      desempWrapper.classList.add('hidden');
    }

    const btnGuardar = document.getElementById('btn-guardar-resultado');
    btnGuardar.textContent = 'Guardar resultado';
    btnGuardar.disabled = false;
    btnGuardar.onclick = () => guardarResultadoSimple(t, partido);
    instalarSelectorKO(t, partido, modoSimple);

    abrirModal('modal-cargar-resultado');
  }

  function prepararModoTiempoPuntos(t, partido, sistema, esIndividual) {
    const hint      = document.getElementById('cargar-resultado-tp-hint');
    const lista     = document.getElementById('cargar-resultado-tp-lista');
    const ganadorEl = document.getElementById('cargar-resultado-tp-ganador');

    if (!lista) return;

    const localId  = partido.equipoLocalId;
    const visitaId = partido.equipoVisitanteId;
    const localNom = partido.localNombre || 'Local';
    const visitaNom = partido.visitanteNombre || 'Visitante';

    hint.textContent = sistema === 'tiempo'
      ? 'El MENOR tiempo gana. Cargá minutos, segundos y centésimas.'
      : 'El MAYOR puntaje gana.';

    const partes = Array.isArray(partido.resultado?.participantes)
      ? partido.resultado.participantes
      : [];

    const valLocal  = partes.find(p => String(p.id) === String(localId)) || {};
    const valVisita = partes.find(p => String(p.id) === String(visitaId)) || {};

    if (sistema === 'tiempo') {
      const tl = Number(valLocal.tiempoSeg);
      const tv = Number(valVisita.tiempoSeg);

      const minLocal = Number.isFinite(tl) ? Math.floor(tl / 60) : '';
      const segLocal = Number.isFinite(tl) ? Math.floor(tl % 60) : '';
      const cenLocal = Number.isFinite(tl) ? Math.round((tl - Math.floor(tl)) * 100) : '';

      const minVis = Number.isFinite(tv) ? Math.floor(tv / 60) : '';
      const segVis = Number.isFinite(tv) ? Math.floor(tv % 60) : '';
      const cenVis = Number.isFinite(tv) ? Math.round((tv - Math.floor(tv)) * 100) : '';

      lista.innerHTML = `
        ${renderFilaTiempo(localId, localNom, esIndividual, localEscDe(partido, 'local'), minLocal, segLocal, cenLocal, 'local')}
        ${renderFilaTiempo(visitaId, visitaNom, esIndividual, localEscDe(partido, 'visitante'), minVis, segVis, cenVis, 'visitante')}
      `;
    } else {
      const pLocal = Number(valLocal.puntos);
      const pVisita = Number(valVisita.puntos);

      lista.innerHTML = `
        ${renderFilaPuntos(localId, localNom, esIndividual, localEscDe(partido, 'local'), Number.isFinite(pLocal) ? pLocal : '', 'local')}
        ${renderFilaPuntos(visitaId, visitaNom, esIndividual, localEscDe(partido, 'visitante'), Number.isFinite(pVisita) ? pVisita : '', 'visitante')}
      `;
    }

    function actualizarGanador() {
      let ganadorTxt = '—';

      if (sistema === 'tiempo') {
        const minL = Number(lista.querySelector('[data-tp-local-min]')?.value) || 0;
        const segL = Number(lista.querySelector('[data-tp-local-seg]')?.value) || 0;
        const cenL = Number(lista.querySelector('[data-tp-local-cen]')?.value) || 0;

        const minV = Number(lista.querySelector('[data-tp-visitante-min]')?.value) || 0;
        const segV = Number(lista.querySelector('[data-tp-visitante-seg]')?.value) || 0;
        const cenV = Number(lista.querySelector('[data-tp-visitante-cen]')?.value) || 0;

        const tL = parsearTiempo(minL, segL, cenL);
        const tV = parsearTiempo(minV, segV, cenV);

        if (tL === 0 && tV === 0) ganadorTxt = '—';
        else if (tL < tV) ganadorTxt = `${localNom}`;
        else if (tV < tL) ganadorTxt = `${visitaNom}`;
        else ganadorTxt = 'Empate';
      } else {
        const pL = Number(lista.querySelector('[data-tp-local-puntos]')?.value);
        const pV = Number(lista.querySelector('[data-tp-visitante-puntos]')?.value);

        if (!Number.isFinite(pL) && !Number.isFinite(pV)) ganadorTxt = '—';
        else if (Number.isFinite(pL) && (!Number.isFinite(pV) || pL > pV)) ganadorTxt = `${localNom}`;
        else if (Number.isFinite(pV) && (!Number.isFinite(pL) || pV > pL)) ganadorTxt = `${visitaNom}`;
        else ganadorTxt = 'Empate';
      }

      ganadorEl.textContent = ganadorTxt;
    }

    lista.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', actualizarGanador);
    });
    actualizarGanador();

    const btnGuardar = document.getElementById('btn-guardar-resultado');
    btnGuardar.textContent = 'Guardar resultado';
    btnGuardar.disabled = false;
    btnGuardar.onclick = () => guardarResultadoTiempoPuntos(
      t, partido, sistema, localId, visitaId, lista
    );
  }

  function localEscDe(partido, lado) {
    if (lado === 'local')  return partido.localEscudo || ICONOS.escudo;
    return partido.visitanteEscudo || ICONOS.escudo;
  }

  function renderFilaTiempo(participanteId, nombre, esIndividual, escudo, min, seg, cen, lado) {
    const escudoHtml = esIndividual
      ? `<img src="${escudo === ICONOS.escudo ? 'assets/icons/usuario.svg' : escudo}" alt="" class="avatar avatar--md" />`
      : renderEscudoCruce(escudo === ICONOS.escudo ? null : escudo, false, 28);

    return `
      <div class="tp-fila" style="display:flex; align-items:center; gap:var(--space-3); padding:var(--space-3); background:var(--color-bg-alt); border-radius:var(--radius-md); margin-bottom:var(--space-3)">
        <div style="text-align:center; min-width:56px">
          ${escudoHtml}
          <div class="text-xs text-muted mt-4" style="font-weight:600">${nombre}</div>
        </div>

        <div style="flex:1; display:flex; gap:var(--space-2); align-items:flex-end">
          <div class="field" style="margin:0; flex:1">
            <label class="field__label" style="font-size:var(--fs-xs)">Min</label>
            <input type="number" class="field__input" min="0" value="${min}" placeholder="0" data-tp-${lado}-min />
          </div>
          <div class="field" style="margin:0; flex:1">
            <label class="field__label" style="font-size:var(--fs-xs)">Seg</label>
            <input type="number" class="field__input" min="0" max="59" value="${seg}" placeholder="0" data-tp-${lado}-seg />
          </div>
          <div class="field" style="margin:0; flex:1">
            <label class="field__label" style="font-size:var(--fs-xs)">Cent</label>
            <input type="number" class="field__input" min="0" max="99" value="${cen}" placeholder="0" data-tp-${lado}-cen />
          </div>
        </div>
      </div>
    `;
  }

  function renderFilaPuntos(participanteId, nombre, esIndividual, escudo, puntos, lado) {
    const escudoHtml = esIndividual
      ? `<img src="${escudo === ICONOS.escudo ? 'assets/icons/usuario.svg' : escudo}" alt="" class="avatar avatar--md" />`
      : renderEscudoCruce(escudo === ICONOS.escudo ? null : escudo, false, 28);

    return `
      <div class="tp-fila" style="display:flex; align-items:center; gap:var(--space-3); padding:var(--space-3); background:var(--color-bg-alt); border-radius:var(--radius-md); margin-bottom:var(--space-3)">
        <div style="text-align:center; min-width:56px">
          ${escudoHtml}
          <div class="text-xs text-muted mt-4" style="font-weight:600">${nombre}</div>
        </div>

        <div style="flex:1">
          <div class="field" style="margin:0">
            <label class="field__label" style="font-size:var(--fs-xs)">Puntos</label>
            <input type="number" class="field__input" min="0" value="${puntos}" placeholder="0" data-tp-${lado}-puntos />
          </div>
        </div>
      </div>
    `;
  }

  async function guardarResultadoTiempoPuntos(t, partido, sistema, localId, visitaId, lista) {
    const estado = document.getElementById('cargar-resultado-estado').value;

    const participantes = [];

    if (sistema === 'tiempo') {
      const minL = Number(lista.querySelector('[data-tp-local-min]')?.value) || 0;
      const segL = Number(lista.querySelector('[data-tp-local-seg]')?.value) || 0;
      const cenL = Number(lista.querySelector('[data-tp-local-cen]')?.value) || 0;

      const minV = Number(lista.querySelector('[data-tp-visitante-min]')?.value) || 0;
      const segV = Number(lista.querySelector('[data-tp-visitante-seg]')?.value) || 0;
      const cenV = Number(lista.querySelector('[data-tp-visitante-cen]')?.value) || 0;

      const tL = parsearTiempo(minL, segL, cenL);
      const tV = parsearTiempo(minV, segV, cenV);

      if (tL === 0 && tV === 0) return toast('Ingresá al menos un tiempo', 'error');
      if (tL === tV) return toast('Los tiempos no pueden ser iguales', 'error');

      participantes.push({ id: localId,  tiempoSeg: tL });
      participantes.push({ id: visitaId, tiempoSeg: tV });
    } else {
      const pL = Number(lista.querySelector('[data-tp-local-puntos]')?.value);
      const pV = Number(lista.querySelector('[data-tp-visitante-puntos]')?.value);

      if (!Number.isFinite(pL) || !Number.isFinite(pV)) return toast('Ingresá los puntos de ambos participantes', 'error');
      if (pL === pV) return toast('Los puntajes no pueden ser iguales', 'error');

      participantes.push({ id: localId,  puntos: pL });
      participantes.push({ id: visitaId, puntos: pV });
    }

    const resultado = { sistema, participantes };

    const btn = document.getElementById('btn-guardar-resultado');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      await cargarResultadoAPI(t.id, partido.id, { resultado, estado });
      toast('Resultado cargado', 'success');
      cerrarModal('modal-cargar-resultado');

      torneo = await obtenerTorneo(t.id);
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al cargar resultado:', err);
      toast(err.message || 'No se pudo cargar el resultado', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar resultado';
    }
  }

  async function guardarResultadoSimple(t, partido) {
    const reglas = getReglasDeporte(t.deporte);
    const campo = formatoDeDeporte(t.deporte).campo;

    const localVal = Number(document.getElementById('cargar-resultado-local').value) || 0;
    const visitaVal = Number(document.getElementById('cargar-resultado-visitante').value) || 0;
    const estado = document.getElementById('cargar-resultado-estado').value;

    const resultado = {
      [`${campo}_local`]: localVal,
      [`${campo}_visitante`]: visitaVal,
      goles_local: localVal,
      goles_visitante: visitaVal,
    };

    if (permiteDesempate(t.deporte) && localVal === visitaVal) {
      const penLocal = Number(document.getElementById('cargar-resultado-desempate-local').value) || 0;
      const penVisita = Number(document.getElementById('cargar-resultado-desempate-visitante').value) || 0;

      if (penLocal === penVisita) return toast('En caso de empate, el desempate también debe tener un ganador', 'error');

      resultado.penales_local = penLocal;
      resultado.penales_visitante = penVisita;
    }

    if (reglas.tipo === 'simple_sin_empate' && localVal === visitaVal) {
      return toast(`Este deporte no permite empates. Ingresá un resultado con ganador.`, 'error');
    }

    const btn = document.getElementById('btn-guardar-resultado');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      await cargarResultadoAPI(t.id, partido.id, { resultado, estado });
      toast('Resultado cargado', 'success');
      cerrarModal('modal-cargar-resultado');

      torneo = await obtenerTorneo(t.id);
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al cargar resultado:', err);
      toast(err.message || 'No se pudo cargar el resultado', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar resultado';
    }
  }

  async function guardarResultadoSets(t, partido, setsLista) {
    const estado = document.getElementById('cargar-resultado-estado').value;

    const sets = [];
    const filas = setsLista.querySelectorAll('[data-set-index]');
    filas.forEach(fila => {
      const idx = Number(fila.dataset.setIndex);
      const local = Number(setsLista.querySelector(`[data-set-local="${idx}"]`)?.value) || 0;
      const visitante = Number(setsLista.querySelector(`[data-set-visitante="${idx}"]`)?.value) || 0;
      sets.push({ local, visitante });
    });

    if (sets.length === 0) return toast('Agregá al menos un set', 'error');

    let setsLocal = 0;
    let setsVisitante = 0;
    sets.forEach(s => {
      if (s.local > s.visitante) setsLocal++;
      else if (s.visitante > s.local) setsVisitante++;
    });

    if (setsLocal === setsVisitante) return toast('Tiene que haber un ganador (no pueden empatar en sets)', 'error');

    const resultado = { sets, setsLocal, setsVisitante };

    const btn = document.getElementById('btn-guardar-resultado');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      await cargarResultadoAPI(t.id, partido.id, { resultado, estado });
      toast('Resultado cargado', 'success');
      cerrarModal('modal-cargar-resultado');

      torneo = await obtenerTorneo(t.id);
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al cargar resultado:', err);
      toast(err.message || 'No se pudo cargar el resultado', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar resultado';
    }
  }

  async function crearNuevaJornada(t) {
    const totalActual = (t.jornadas || []).length;
    const numero = totalActual + 1;
    const nombre = prompt('Nombre de la jornada:', `Jornada ${numero}`);
    if (!nombre) return null;

    try {
      const jornada = await crearJornadaAPI(t.id, { nombre, fecha: null });
      toast('Jornada creada', 'success');
      torneo = await obtenerTorneo(t.id);
      return jornada;
    } catch (err) {
      console.error('[torneo-detalle] Error al crear jornada:', err);
      toast(err.message || 'No se pudo crear la jornada', 'error');
      return null;
    }
  }

  async function generarFixtureLiga(t) {
    if (!confirm('¿Generar el fixture automático? Esto crea todas las jornadas y partidos.')) return;

    try {
      const resultado = await generarFixtureLigaAPI(t.id);
      toast(resultado.mensaje || 'Fixture generado', 'success');

      torneo = await obtenerTorneo(t.id);
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al generar fixture:', err);
      toast(err.message || 'No se pudo generar el fixture', 'error');
    }
  }

  /* =========================================================
     D.3 — SUB-ORGANIZADORES
     ========================================================= */

  async function abrirModalSubOrganizadores(t) {
    if (!esOrganizador(t)) return;

    renderSubOrganizadores(t);
    renderInvitacionesPendientes(t);
    renderBuscadorUsuarios(t, '');

    const input = document.getElementById('tso-buscar');
    if (input) input.value = '';

    abrirModal('modal-sub-organizadores');
  }

  function renderSubOrganizadores(t) {
    const cont = document.getElementById('tso-lista-actuales');
    if (!cont) return;

    const lista = t.organizadores || [];

    if (lista.length === 0) {
      cont.innerHTML = `<div class="tso-empty">Todavía no hay sub-organizadores.</div>`;
      return;
    }

    cont.innerHTML = lista.map(o => `
      <div class="tso-item">
        <img src="${o.avatar || 'assets/icons/usuario.svg'}" alt="" class="tso-item__avatar" />
        <div class="tso-item__info">
          <div class="tso-item__nombre">${o.nombre || 'Usuario'}</div>
          <div class="tso-item__sub">@${o.username || 'usuario'}</div>
        </div>
        <div class="tso-item__acciones">
          <button class="tso-item__btn tso-item__btn--danger"
                  data-tso-quitar="${o.usuarioId}"
                  title="Quitar sub-organizador">
            ${ICONOS.basura}
          </button>
        </div>
      </div>
    `).join('');

    cont.querySelectorAll('[data-tso-quitar]').forEach(btn => {
      btn.addEventListener('click', () => quitarSubOrganizadorUI(t, btn.dataset.tsoQuitar));
    });
  }

  function renderInvitacionesPendientes(t) {
    const cont = document.getElementById('tso-lista-pendientes');
    if (!cont) return;

    const lista = t.invitacionesOrganizador || [];

    if (lista.length === 0) {
      cont.innerHTML = `<div class="tso-empty">Sin invitaciones pendientes.</div>`;
      return;
    }

    cont.innerHTML = lista.map(i => `
      <div class="tso-item">
        <img src="${i.avatar || 'assets/icons/usuario.svg'}" alt="" class="tso-item__avatar" />
        <div class="tso-item__info">
          <div class="tso-item__nombre">${i.nombre || 'Usuario'}</div>
          <div class="tso-item__sub">@${i.username || 'usuario'}</div>
        </div>
        <span class="tso-item__badge tso-item__badge--pendiente">Pendiente</span>
        <div class="tso-item__acciones">
          <button class="tso-item__btn tso-item__btn--danger"
                  data-tso-cancelar="${i.usuarioId}"
                  title="Cancelar invitación">
            ${ICONOS.basura}
          </button>
        </div>
      </div>
    `).join('');

    cont.querySelectorAll('[data-tso-cancelar]').forEach(btn => {
      btn.addEventListener('click', () => cancelarInvitacionOrganizadorUI(t, btn.dataset.tsoCancelar));
    });
  }

  async function renderBuscadorUsuarios(t, query) {
    const cont = document.getElementById('tso-resultados');
    if (!cont) return;

    if (!query || query.trim().length < 2) {
      cont.innerHTML = '';
      return;
    }

    cont.innerHTML = `<p class="text-sm text-muted text-center" style="padding:var(--space-3)">Buscando...</p>`;

    let usuarios = [];
    try {
      usuarios = await buscarUsuariosAPI(query.trim());
    } catch (err) {
      console.error('[torneo-detalle] Error al buscar usuarios:', err);
      cont.innerHTML = `<div class="tso-empty">No se pudo buscar.</div>`;
      return;
    }

    const excluidos = new Set([
      ...(t.organizadores || []).map(o => String(o.usuarioId)),
      ...(t.invitacionesOrganizador || []).map(i => String(i.usuarioId)),
      String(t.organizador?.id),
    ]);

    const filtrados = usuarios.filter(u => !excluidos.has(String(u.id)));

    if (filtrados.length === 0) {
      cont.innerHTML = `<div class="tso-empty">No hay usuarios disponibles.</div>`;
      return;
    }

    cont.innerHTML = filtrados.map(u => `
      <div class="tso-item">
        <img src="${u.avatar || 'assets/icons/usuario.svg'}" alt="" class="tso-item__avatar" />
        <div class="tso-item__info">
          <div class="tso-item__nombre">${u.nombre || 'Usuario'}</div>
          <div class="tso-item__sub">@${u.username || 'usuario'}</div>
        </div>
        <div class="tso-item__acciones">
          <button class="tso-item__btn tso-item__btn--primary"
                  data-tso-invitar="${u.id}">
            Invitar
          </button>
        </div>
      </div>
    `).join('');

    cont.querySelectorAll('[data-tso-invitar]').forEach(btn => {
      btn.addEventListener('click', () => invitarSubOrganizadorUI(t, btn.dataset.tsoInvitar));
    });
  }

  document.getElementById('tso-buscar')?.addEventListener('input', (e) => {
    if (torneo) renderBuscadorUsuarios(torneo, e.target.value);
  });

  async function invitarSubOrganizadorUI(t, usuarioId) {
    if (!confirm('¿Enviar invitación para que sea sub-organizador?')) return;

    try {
      await invitarOrganizadorAPI(t.id, usuarioId, 'completo');
      toast('Invitación enviada', 'success');

      torneo = await obtenerTorneo(t.id);
      renderInvitacionesPendientes(torneo);
      renderSubOrganizadores(torneo);

      const input = document.getElementById('tso-buscar');
      if (input) await renderBuscadorUsuarios(torneo, input.value);
    } catch (err) {
      console.error('[torneo-detalle] Error al invitar:', err);
      toast(err.message || 'No se pudo invitar', 'error');
    }
  }

  async function cancelarInvitacionOrganizadorUI(t, invitadoId) {
    if (!confirm('¿Cancelar la invitación?')) return;

    try {
      await cancelarInvOrgAPI(t.id, invitadoId);
      toast('Invitación cancelada', 'info');

      torneo = await obtenerTorneo(t.id);
      renderInvitacionesPendientes(torneo);
      renderSubOrganizadores(torneo);
    } catch (err) {
      console.error('[torneo-detalle] Error al cancelar:', err);
      toast(err.message || 'No se pudo cancelar', 'error');
    }
  }

  async function quitarSubOrganizadorUI(t, usuarioId) {
    if (!confirm('¿Quitar a este sub-organizador?')) return;

    try {
      await quitarOrganizadorAPI(t.id, usuarioId);
      toast('Sub-organizador removido', 'info');

      torneo = await obtenerTorneo(t.id);
      renderSubOrganizadores(torneo);
      renderInvitacionesPendientes(torneo);
    } catch (err) {
      console.error('[torneo-detalle] Error al quitar:', err);
      toast(err.message || 'No se pudo quitar', 'error');
    }
  }

  async function responderInvitacionOrganizadorUI(t, aceptar) {
    try {
      const res = await responderInvOrgAPI(t.id, aceptar);
      toast(res.mensaje || (aceptar ? 'Ahora eres sub-organizador' : 'Invitación rechazada'),
            aceptar ? 'success' : 'info');

      torneo = await obtenerTorneo(t.id);
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al responder:', err);
      toast(err.message || 'No se pudo responder', 'error');
    }
  }

  document.querySelectorAll('#modal-sub-organizadores [data-cerrar-modal]').forEach(btn => {
    btn.onclick = () => cerrarModal('modal-sub-organizadores');
  });
  modalSubOrganizadores?.addEventListener('click', (e) => {
    if (e.target === modalSubOrganizadores) cerrarModal('modal-sub-organizadores');
  });

  document.querySelectorAll('#modal-responder-invitacion-organizador [data-cerrar-modal]').forEach(btn => {
    btn.onclick = () => cerrarModal('modal-responder-invitacion-organizador');
  });
  modalResponderInvOrg?.addEventListener('click', (e) => {
    if (e.target === modalResponderInvOrg) cerrarModal('modal-responder-invitacion-organizador');
  });

  /* =========================================================
     MODAL EDITAR TORNEO (EN EL DETALLE)
     ========================================================= */
  const estadoModal = {
    modalidad: 'liga',
    tipoParticipacion: 'equipo',
    nivel: 'amistoso',
    sistemaClasificacion: 'simple',
  };

  let modalEditarInicializado = false;

  // ⚡ Variables visuales del modal de edición
  // ⚡ Variables visuales del modal de edición
  let editCardColor = '#E8836A';
  let editHeroColor = '#0F1B2D';
  let editCardFotoBase64 = null;
  let editHeroFotoBase64 = null;
  let editIconoBase64 = null;
  let editMarcoIcono = 'default';
  let editMarcoColorIcono = '#E8836A';

  function renderPaletaDet(containerId, colorSeleccionado, onChange) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    cont.innerHTML = PALETA_BASICOS.map(c => `
      <button type="button" class="perfil-color-btn ${c === colorSeleccionado ? 'active' : ''}" data-color="${c}" style="background:${c}; width:32px; height:32px; border-radius:50%; border:none; cursor:pointer; margin:0 4px;"></button>
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

  function inicializarModalEditar() {
    if (modalEditarInicializado) return;
    if (!modalEditarTorneo) return;
    modalEditarInicializado = true;

    const selectDepDet = document.getElementById('torneo-deporte-det');
    if (selectDepDet) {
      selectDepDet.innerHTML = '<option value="">Selecciona un deporte...</option>' +
        deportes.map(d => `<option value="${d}">${d}</option>`).join('');
    }

    const nivelGrid = document.getElementById('nivel-grid-torneo-det');
    if (nivelGrid) {
      nivelGrid.innerHTML = NIVELES_TORNEO_DET.map((n, i) => `
        <div class="nivel-opcion ${i === 0 ? 'active' : ''}" data-nivel-det="${n.valor}">
          <div class="nivel-opcion__label">${n.label}</div>
          <div class="nivel-opcion__desc">${n.descripcion}</div>
        </div>
      `).join('');

      nivelGrid.querySelectorAll('[data-nivel-det]').forEach(op => {
        op.addEventListener('click', () => {
          nivelGrid.querySelectorAll('[data-nivel-det]').forEach(o => o.classList.remove('active'));
          op.classList.add('active');
          estadoModal.nivel = op.dataset.nivelDet;
          actualizarLibreInscripcionDet();
        });
      });
    }

    document.querySelectorAll('[data-tipo-participacion-det]').forEach(op => {
      op.addEventListener('click', () => {
        document.querySelectorAll('[data-tipo-participacion-det]').forEach(o => o.classList.remove('active'));
        op.classList.add('active');
        estadoModal.tipoParticipacion = op.dataset.tipoParticipacionDet;
        actualizarHintTipoParticipacionDet();
      });
    });

    document.querySelectorAll('[data-modalidad-det]').forEach(op => {
      op.addEventListener('click', () => {
        document.querySelectorAll('[data-modalidad-det]').forEach(o => o.classList.remove('active'));
        op.classList.add('active');
        estadoModal.modalidad = op.dataset.modalidadDet;
        actualizarConfigPorModalidadDet();
        actualizarAutoFixtureVisibilityDet();
      });
    });

    document.querySelectorAll('[data-sistema-clasificacion-det]').forEach(op => {
      op.addEventListener('click', () => {
        document.querySelectorAll('[data-sistema-clasificacion-det]').forEach(o => o.classList.remove('active'));
        op.classList.add('active');
        estadoModal.sistemaClasificacion = op.dataset.sistemaClasificacionDet;
        actualizarHintSistemaDet();
      });
    });

    const checkGratisDet = document.getElementById('torneo-gratis-det');
    const precioWrapperDet = document.getElementById('torneo-precio-wrapper-det');
    checkGratisDet?.addEventListener('change', () => {
      precioWrapperDet?.classList.toggle('hidden', checkGratisDet.checked);
      actualizarLibreInscripcionDet();
    });

    selectDepDet?.addEventListener('change', () => {
      const dep = selectDepDet.value;
      actualizarSistemaClasificacionDet(dep);

      if (DEPORTES_INDIVIDUALES_DET.has(dep)) {
        document.querySelectorAll('[data-tipo-participacion-det]').forEach(op => {
          op.classList.toggle('active', op.dataset.tipoParticipacionDet === 'individual');
        });
        estadoModal.tipoParticipacion = 'individual';
        actualizarHintTipoParticipacionDet();
      }
    });

    // TABS MODAL DETALLE
    const tabsDet = document.querySelectorAll('[data-tab-torneo-det]');
    const tabTecnicosDet = document.getElementById('torneo-det-tab-tecnicos');
    const tabVisualDet = document.getElementById('torneo-det-tab-visual');

    tabsDet.forEach(tab => {
      tab.addEventListener('click', () => {
        tabsDet.forEach(t => {
          t.classList.remove('active');
          t.style.borderBottomColor = 'transparent';
          t.style.color = 'var(--color-text-muted)';
          t.style.fontWeight = '600';
        });
        tab.classList.add('active');
        tab.style.borderBottomColor = 'var(--color-primary)';
        tab.style.color = 'var(--color-primary)';
        tab.style.fontWeight = '700';

        if (tab.dataset.tabTorneoDet === 'tecnicos') {
          tabTecnicosDet.classList.remove('hidden');
          tabVisualDet.classList.add('hidden');
        } else {
          tabTecnicosDet.classList.add('hidden');
          tabVisualDet.classList.remove('hidden');
        }
      });
    });

    document.getElementById('btn-guardar-torneo-det')?.addEventListener('click', guardarEdicionTorneo);

    modalEditarTorneo.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-editar-torneo-detalle');
    });
    modalEditarTorneo.onclick = (e) => {
      if (e.target === modalEditarTorneo) cerrarModal('modal-editar-torneo-detalle');
    };
  }

  function actualizarConfigPorModalidadDet() {
    const configLiga = document.getElementById('config-liga-wrapper-det');
    if (configLiga) {
      configLiga.style.display = estadoModal.modalidad === 'liga' ? '' : 'none';
    }
  }

  function actualizarAutoFixtureVisibilityDet() {
    const wrapper = document.getElementById('auto-fixture-wrapper-det');
    if (!wrapper) return;

    if (estadoModal.modalidad === 'eliminacion') {
      wrapper.classList.remove('hidden');
    } else {
      wrapper.classList.add('hidden');
      const check = document.getElementById('torneo-auto-fixture-det');
      if (check) check.checked = false;
    }
  }

  function actualizarLibreInscripcionDet() {
    const wrapper = document.getElementById('libre-inscripcion-wrapper-det');
    const aviso = document.getElementById('aviso-pago-det');
    const checkGratis = document.getElementById('torneo-gratis-det');
    const checkLibre = document.getElementById('torneo-libre-inscripcion-det');

    if (!wrapper || !aviso) return;

    const esGratis = checkGratis?.checked ?? true;
    const nivelExigente = estadoModal.nivel !== 'amistoso';

    if (!esGratis) {
      wrapper.classList.add('hidden');
      aviso.classList.add('show');
      return;
    }

    if (nivelExigente) {
      wrapper.classList.remove('hidden');
      aviso.classList.remove('show');
      return;
    }

    wrapper.classList.add('hidden');
    aviso.classList.remove('show');
    if (checkLibre) checkLibre.checked = true;
  }

  function actualizarHintTipoParticipacionDet() {
    const hint = document.getElementById('hint-tipo-participacion-det');
    if (!hint) return;
    if (estadoModal.tipoParticipacion === 'individual') {
      hint.innerHTML = `${ICONOS.usuario} Los usuarios se inscriben solos.`;
    } else {
      hint.innerHTML = `${ICONOS.usuarios} Los equipos se inscriben al torneo.`;
    }
  }

  function actualizarSistemaClasificacionDet(deporte) {
    const wrapper = document.getElementById('sistema-clasificacion-wrapper-det');
    if (!wrapper) return;
    wrapper.classList.remove('hidden');

    let sugerido = 'simple';
    if (deporte) {
      if (DEPORTES_TIEMPO_DET.has(deporte)) sugerido = 'tiempo';
      else if (DEPORTES_PUNTOS_DET.has(deporte)) sugerido = 'puntos';
    }

    estadoModal.sistemaClasificacion = sugerido;

    document.querySelectorAll('[data-sistema-clasificacion-det]').forEach(op => {
      op.classList.toggle('active', op.dataset.sistemaClasificacionDet === sugerido);
    });

    actualizarHintSistemaDet();
  }

  function actualizarHintSistemaDet() {
    const hint = document.getElementById('sistema-clasificacion-hint-det');
    if (!hint) return;
    const textos = {
      simple: 'Se juega con marcador (goles, puntos, sets).',
      tiempo: 'El MENOR tiempo gana.',
      puntos: 'El MAYOR puntaje gana.',
    };
    hint.textContent = textos[estadoModal.sistemaClasificacion] || '';
  }

  /* ⚡ NUEVO: Inicializa el selector de marcos del modal de editar torneo */
  function inicializarMarcosDet(torneoData) {
    editMarcoIcono = torneoData?.marcoIcono || 'default';
    editMarcoColorIcono = torneoData?.marcoColorIcono || '#E8836A';

    const contMarcos = document.getElementById('torneo-det-marcos-icono');
    const colorWrapper = document.getElementById('torneo-det-marco-color-wrapper');
    const inputColor = document.getElementById('torneo-det-marco-color-icono');

    if (!contMarcos) return;

    if (inputColor) inputColor.value = editMarcoColorIcono;

    contMarcos.innerHTML = MARCOS_ICONO.map(m => `
      <button type="button" class="posicion-chip ${m.id === editMarcoIcono ? 'active' : ''}" data-marco-det="${m.id}">${m.nombre}</button>
    `).join('');

    if (colorWrapper) {
      colorWrapper.style.display = editMarcoIcono === 'custom' ? 'flex' : 'none';
    }

    contMarcos.querySelectorAll('[data-marco-det]').forEach(btn => {
      btn.addEventListener('click', () => {
        contMarcos.querySelectorAll('[data-marco-det]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        editMarcoIcono = btn.dataset.marcoDet;
        if (colorWrapper) {
          colorWrapper.style.display = editMarcoIcono === 'custom' ? 'flex' : 'none';
        }
      });
    });

    if (inputColor) {
      inputColor.oninput = (e) => {
        editMarcoColorIcono = e.target.value;
      };
    }
  }

  function inicializarVisualesDet(torneoData) {
    editCardColor = torneoData.cardColor || '#E8836A';
    editHeroColor = torneoData.heroColor || '#0F1B2D';
    editCardFotoBase64 = torneoData.cardFoto || null;
    editHeroFotoBase64 = torneoData.heroFoto || null;
    editIconoBase64 = torneoData.iconoPersonalizado || null;

    const wrapperBasico = document.getElementById('torneo-det-visual-basico');
    const wrapperPremium = document.getElementById('torneo-det-visual-premium');

    // ⚡ Mostrar AMBOS wrappers. Bloquear Premium si no lo es.
    wrapperBasico.classList.remove('hidden');
    wrapperPremium.classList.remove('hidden');

    renderPaletaDet('torneo-det-card-color-picker-basico', editCardColor, (c) => editCardColor = c);
    renderPaletaDet('torneo-det-hero-color-picker-basico', editHeroColor, (c) => editHeroColor = c);

    if (user?.esPremium) {
      wrapperPremium.style.opacity = '1';
      wrapperPremium.style.pointerEvents = 'auto';
      const banner = wrapperPremium.querySelector('.premium-banner');
      if (banner) banner.remove();
      wrapperPremium.querySelectorAll('input, button').forEach(el => el.disabled = false);
      wrapperPremium.querySelectorAll('.posiciones-lista').forEach(el => el.style.pointerEvents = 'auto');

      document.getElementById('torneo-card-color-det').value = editCardColor;
      document.getElementById('torneo-hero-color-det').value = editHeroColor;

      const previewCard = document.getElementById('torneo-card-foto-preview-det');
      const wrapCard = document.getElementById('torneo-card-foto-preview-wrapper-det');
      const btnQuitarCard = document.getElementById('torneo-card-foto-quitar-det');
      if (editCardFotoBase64) { previewCard.src = editCardFotoBase64; wrapCard.classList.remove('hidden'); btnQuitarCard.classList.remove('hidden'); }
      else { wrapCard.classList.add('hidden'); btnQuitarCard.classList.add('hidden'); }

      const previewHero = document.getElementById('torneo-hero-foto-preview-det');
      const wrapHero = document.getElementById('torneo-hero-foto-preview-wrapper-det');
      const btnQuitarHero = document.getElementById('torneo-hero-foto-quitar-det');
      if (editHeroFotoBase64) { previewHero.src = editHeroFotoBase64; wrapHero.classList.remove('hidden'); btnQuitarHero.classList.remove('hidden'); }
      else { wrapHero.classList.add('hidden'); btnQuitarHero.classList.add('hidden'); }

      const previewIcono = document.getElementById('torneo-icono-preview-wrapper-det');
      const btnQuitarIcono = document.getElementById('torneo-icono-quitar-det');
      if (editIconoBase64) { previewIcono.innerHTML = `<img src="${editIconoBase64}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />`; btnQuitarIcono.classList.remove('hidden'); }
      else { previewIcono.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-text-muted)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`; btnQuitarIcono.classList.add('hidden'); }

      document.getElementById('torneo-card-foto-file-det').onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        if (file.size > 1.5 * 1024 * 1024) return toast('Máx 1.5 MB', 'error');
        const reader = new FileReader();
        reader.onload = (ev) => { editCardFotoBase64 = ev.target.result; previewCard.src = editCardFotoBase64; wrapCard.classList.remove('hidden'); btnQuitarCard.classList.remove('hidden'); };
        reader.readAsDataURL(file); e.target.value = '';
      };
      document.getElementById('torneo-card-foto-quitar-det').onclick = () => { editCardFotoBase64 = null; wrapCard.classList.add('hidden'); btnQuitarCard.classList.add('hidden'); document.getElementById('torneo-card-foto-file-det').value = ''; };

      document.getElementById('torneo-hero-foto-file-det').onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        if (file.size > 1.5 * 1024 * 1024) return toast('Máx 1.5 MB', 'error');
        const reader = new FileReader();
        reader.onload = (ev) => { editHeroFotoBase64 = ev.target.result; previewHero.src = editHeroFotoBase64; wrapHero.classList.remove('hidden'); btnQuitarHero.classList.remove('hidden'); };
        reader.readAsDataURL(file); e.target.value = '';
      };
      document.getElementById('torneo-hero-foto-quitar-det').onclick = () => { editHeroFotoBase64 = null; wrapHero.classList.add('hidden'); btnQuitarHero.classList.add('hidden'); document.getElementById('torneo-hero-foto-file-det').value = ''; };

      document.getElementById('torneo-icono-file-det').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        abrirRecortadorImagen(file, 'circular', (base64) => {
          editIconoBase64 = base64;

          previewIcono.innerHTML = `
            <img
              src="${base64}"
              style="width:100%; height:100%; object-fit:contain; border-radius:50%;"
            />
          `;

          btnQuitarIcono.classList.remove('hidden');
        });

        e.target.value = '';
      };
      document.getElementById('torneo-icono-quitar-det').onclick = () => { editIconoBase64 = null; previewIcono.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-text-muted)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`; btnQuitarIcono.classList.add('hidden'); document.getElementById('torneo-icono-file-det').value = ''; };

      inicializarMarcosDet(torneoData);

    } else {
      wrapperPremium.style.opacity = '0.6';
      if (!wrapperPremium.querySelector('.premium-banner')) {
        wrapperPremium.insertAdjacentHTML('afterbegin', `
          <div class="premium-banner" style="background: rgba(232, 131, 106, 0.15); border: 1px solid var(--color-primary); padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">🔒</span>
            <span style="font-size: 13px; font-weight: 600; color: var(--color-primary-dark);">Estas opciones son exclusivas del Plan Premium.</span>
          </div>
        `);
      }
      wrapperPremium.querySelectorAll('input, button').forEach(el => el.disabled = true);
      wrapperPremium.querySelectorAll('.posiciones-lista').forEach(el => el.style.pointerEvents = 'none');

      editMarcoIcono = 'default';
      editMarcoColorIcono = '#E8836A';
    }
  }

  function abrirModalEditarTorneo(t) {
    if (!modalEditarTorneo) return;
    inicializarModalEditar();

    document.getElementById('torneo-modal-titulo-detalle').textContent = 'Editar torneo';

    document.getElementById('torneo-nombre-det').value = t.nombre;
    document.getElementById('torneo-deporte-det').value = t.deporte;
    document.getElementById('torneo-fecha-inicio-det').value = (t.fechaInicio || '').split('T')[0];
    document.getElementById('torneo-fecha-fin-det').value = t.fechaFin ? t.fechaFin.split('T')[0] : '';
    document.getElementById('torneo-fecha-limite-det').value = t.fechaLimiteInscripcion ? t.fechaLimiteInscripcion.split('T')[0] : '';
    document.getElementById('torneo-lugar-det').value = t.lugar || '';
    document.getElementById('torneo-equipos-det').value = t.cuposEquipos;
    document.getElementById('torneo-descripcion-det').value = t.descripcion || '';

    const gratis = t.precio === 0;
    document.getElementById('torneo-gratis-det').checked = gratis;
    document.getElementById('torneo-precio-det').value = gratis ? '20000' : t.precio;
    document.getElementById('torneo-precio-wrapper-det').classList.toggle('hidden', gratis);

    estadoModal.modalidad = t.modalidad || 'liga';
    estadoModal.tipoParticipacion = t.tipoParticipacion || 'equipo';
    estadoModal.nivel = t.nivel || 'amistoso';

    document.querySelectorAll('[data-modalidad-det]').forEach(op => {
      op.classList.toggle('active', op.dataset.modalidadDet === estadoModal.modalidad);
    });
    actualizarConfigPorModalidadDet();

    const checkAutoFixture = document.getElementById('torneo-auto-fixture-det');
    if (checkAutoFixture) checkAutoFixture.checked = t.autoFixture === true;
    actualizarAutoFixtureVisibilityDet();

    document.querySelectorAll('[data-tipo-participacion-det]').forEach(op => {
      op.classList.toggle('active', op.dataset.tipoParticipacionDet === estadoModal.tipoParticipacion);
    });
    actualizarHintTipoParticipacionDet();

    actualizarSistemaClasificacionDet(t.deporte);

    const sistemaGuardado = t.sistemaClasificacion || 'simple';
    estadoModal.sistemaClasificacion = sistemaGuardado;

    document.querySelectorAll('[data-sistema-clasificacion-det]').forEach(op => {
      op.classList.toggle('active', op.dataset.sistemaClasificacionDet === sistemaGuardado);
    });
    actualizarHintSistemaDet();

    const nivelGrid = document.getElementById('nivel-grid-torneo-det');
    if (nivelGrid) {
      nivelGrid.querySelectorAll('[data-nivel-det]').forEach(op => {
        op.classList.toggle('active', op.dataset.nivelDet === estadoModal.nivel);
      });
    }

    const checkLibre = document.getElementById('torneo-libre-inscripcion-det');
    if (checkLibre) checkLibre.checked = t.libreInscripcion !== false;
    actualizarLibreInscripcionDet();

    document.getElementById('torneo-puntos-victoria-det').value = String(t.puntosVictoria ?? 3);
    document.getElementById('torneo-puntos-empate-det').value = String(t.puntosEmpate ?? 1);
    document.getElementById('torneo-puntos-derrota-det').value = String(t.puntosDerrota ?? 0);
    document.getElementById('torneo-permite-empate-det').checked = t.permiteEmpate !== false;
    document.getElementById('torneo-ida-vuelta-det').checked = t.idaYVuelta === true;
    document.getElementById('torneo-equipos-clasifican-det').value = t.equiposClasifican ?? '';
    document.getElementById('torneo-incluye-estadisticas-det').checked = !!t.incluyeEstadisticas;

    document.querySelectorAll('[data-tab-torneo-det]')[0].click();
    inicializarVisualesDet(t);

    abrirModal('modal-editar-torneo-detalle');
  }

  async function guardarEdicionTorneo() {
    if (!torneo) return;

    const nombre       = document.getElementById('torneo-nombre-det').value.trim();
    const deporte      = document.getElementById('torneo-deporte-det').value;
    const fechaInicio  = document.getElementById('torneo-fecha-inicio-det').value;
    const fechaFin     = document.getElementById('torneo-fecha-fin-det').value;
    const fechaLimite  = document.getElementById('torneo-fecha-limite-det').value;
    const lugar        = document.getElementById('torneo-lugar-det').value.trim();
    const cuposEquipos = Number(document.getElementById('torneo-equipos-det').value);
    const esGratis     = document.getElementById('torneo-gratis-det').checked;
    const precio       = esGratis ? 0 : Number(document.getElementById('torneo-precio-det').value);
    const descripcion  = document.getElementById('torneo-descripcion-det').value.trim();

    if (!nombre)      return toast('Ingresa un nombre', 'error');
    if (!deporte)     return toast('Selecciona un deporte', 'error');
    if (!fechaInicio) return toast('Selecciona fecha de inicio', 'error');
    if (!lugar)       return toast('Ingresa un lugar', 'error');
    if (cuposEquipos < 2) return toast('Mínimo 2 equipos', 'error');

    const sistemaClasificacion = estadoModal.sistemaClasificacion || 'simple';
    const puntosVictoria = Number(document.getElementById('torneo-puntos-victoria-det').value ?? 3);
    const puntosEmpate   = Number(document.getElementById('torneo-puntos-empate-det').value ?? 1);
    const puntosDerrota  = Number(document.getElementById('torneo-puntos-derrota-det').value ?? 0);
    const permiteEmpate  = document.getElementById('torneo-permite-empate-det').checked;
    const equiposClasificanRaw = document.getElementById('torneo-equipos-clasifican-det').value.trim();
    const equiposClasifican = equiposClasificanRaw ? Number(equiposClasificanRaw) : null;
    const incluyeEstadisticas = document.getElementById('torneo-incluye-estadisticas-det').checked;
    const libreInscripcion = document.getElementById('torneo-libre-inscripcion-det').checked;
    const idaYVuelta = document.getElementById('torneo-ida-vuelta-det').checked;
    const autoFixture = (estadoModal.modalidad === 'eliminacion')
      ? document.getElementById('torneo-auto-fixture-det').checked
      : false;

    const datos = {
      nombre,
      deporte,
      fechaInicio: new Date(`${fechaInicio}T00:00:00`).toISOString(),
      fechaFin: fechaFin ? new Date(`${fechaFin}T00:00:00`).toISOString() : null,
      fechaLimiteInscripcion: fechaLimite ? new Date(`${fechaLimite}T23:59:59`).toISOString() : null,
      lugar,
      cuposEquipos,
      precio,
      descripcion: descripcion || null,
      modalidad: estadoModal.modalidad,
      nivel: estadoModal.nivel,
      libreInscripcion,
      tipoParticipacion: estadoModal.tipoParticipacion,
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

    if (user?.esPremium) {
      datos.cardColor = document.getElementById('torneo-card-color-det').value;
      datos.heroColor = document.getElementById('torneo-hero-color-det').value;
      datos.cardFoto = editCardFotoBase64;
      datos.heroFoto = editHeroFotoBase64;
      datos.iconoPersonalizado = editIconoBase64;
      // ⚡ NUEVO: enviar marcos al backend
      datos.marcoIcono = editMarcoIcono;
      datos.marcoColorIcono = editMarcoColorIcono;
    } else {
      datos.cardColor = editCardColor;
      datos.heroColor = editHeroColor;
    }
    const btn = document.getElementById('btn-guardar-torneo-det');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      await editarTorneoAPI(torneo.id, datos);
      toast('Torneo actualizado', 'success');
      cerrarModal('modal-editar-torneo-detalle');

      torneo = await obtenerTorneo(id);
      await render();
    } catch (err) {
      console.error('[torneo-detalle] Error al editar:', err);
      toast(err.message || 'No se pudo actualizar el torneo', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar cambios';
    }
  }

  /* =========================================================
     INIT
     ========================================================= */
  await render();

  inicializarModalEditar();

  const torneoAEditar = sessionStorage.getItem('torneoAEditar');
  if (torneoAEditar) {
    if (String(torneoAEditar) === String(id) && torneo && esOrganizador(torneo)) {
      sessionStorage.removeItem('torneoAEditar');
      setTimeout(() => abrirModalEditarTorneo(torneo), 300);
    } else {
      sessionStorage.removeItem('torneoAEditar');
    }
  }

  return () => {
    if (intervaloCanalTorneo) clearInterval(intervaloCanalTorneo);
  };
}
