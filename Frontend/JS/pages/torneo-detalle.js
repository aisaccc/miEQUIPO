import { getSesion } from '../auth.js';
import { toast, formatearFecha, abrirModal, cerrarModal } from '../components.js';
import { listarGrupos, obtenerGrupo } from '../services/grupos.service.js';
import {
  obtenerTorneo,
  editarTorneo as editarTorneoAPI,
  eliminarTorneo as eliminarTorneoAPI,
  cerrarTorneo as cerrarTorneoAPI,
  inscribirEquipo as inscribirEquipoAPI,
  cancelarInscripcion as cancelarInscripcionAPI,
  gestionarSolicitud as gestionarSolicitudAPI,
  expulsarEquipo as expulsarEquipoAPI,
  invitarEquipo as invitarEquipoAPI,
  responderInvitacion as responderInvitacionAPI,
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

// ⚡ Reglas por deporte
import {
  getReglasDeporte,
  esPorSets,
  permiteDesempate,
  formatearResultado,
  calcularGanador,
  esPorTiempo,
  esPorPuntos,
  getSistemaEfectivo,
  formatearTiempo,
  parsearTiempo,
} from '../utils/reglas-deporte.js';

/* =========================================================
   CONFIG: formato de resultado (derivado de reglas-deporte.js)
   ========================================================= */
function formatoDeDeporte(deporte) {
  const reglas = getReglasDeporte(deporte);

  let campo = 'goles';
  if (reglas.tipo === 'sets') campo = 'sets';
  else if (reglas.labelMarcador === 'Puntos') campo = 'puntos';
  else if (reglas.labelMarcador === 'Carreras') campo = 'carreras';

  return {
    campo,
    label: reglas.labelMarcador || 'Resultado',
  };
}

const FASES_LABEL = {
  '64avos': '64avos',
  '32avos': '32avos',
  '16avos': '16avos',
  '8vos': 'Octavos',
  'cuartos': 'Cuartos',
  'semis': 'Semis',
  'final': 'Final',
  'tercer_puesto': '3er Puesto',
};

const FASES_ORDEN = ['64avos', '32avos', '16avos', '8vos', 'cuartos', 'semis', 'final', 'tercer_puesto'];

export async function init(params = {}) {
  const id = params.id;
  const user = getSesion();
  const contenedor = document.getElementById('detalle-torneo');
  if (!contenedor || !id || !user) return null;

  /* ---------- REFS MODALES ---------- */
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

  /* ---------- ESTADO ---------- */
  let torneo = null;
  let misEquipos = [];
  let partidoActual = null;
  let cruceActual = null;
  let partidoDetalleActual = null;

  /* =========================================================
     HELPERS
     ========================================================= */

  function esOrganizador(t) {
    return t.soyOrganizador || String(t.organizador?.id) === String(user.id);
  }

  function puedeGestionar(t) {
    return t.puedeGestionarFixture || esOrganizador(t);
  }

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
    if (!emoji) return '🏆';
    if (typeof emoji === 'string' && /\.(svg|png|jpg|jpeg|gif|webp)$/i.test(emoji)) {
      return `<img src="${emoji}" alt="" style="width:${size}px;height:${size}px;object-fit:contain;display:block" />`;
    }
    return emoji;
  }

  function renderEscudoParticipante(nombre, escudo, esIndividual) {
    if (esIndividual) {
      return `<img src="${escudo || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--md" />`;
    }
    return escudo || '🛡️';
  }

  function formatearFechaCorta(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-CL', {
      day: 'numeric', month: 'short',
    });
  }

  function formatResultadoPartido(p, formato) {
    if (!p.resultado || !formato) return '';
    const r = p.resultado;
    const local = r[`${formato.campo}_local`] ?? r.goles_local ?? r.puntos_local ?? r.sets_local ?? '-';
    const visitante = r[`${formato.campo}_visitante`] ?? r.goles_visitante ?? r.puntos_visitante ?? r.sets_visitante ?? '-';
    return `${local} - ${visitante}`;
  }

  function faseInicial(fases) {
    return fases[0];
  }

  function fasesDelBracket(t) {
    const partidos = t.partidos || [];
    const fasesSet = new Set();
    partidos.forEach(p => {
      if (p.fase) fasesSet.add(p.fase);
    });

    return FASES_ORDEN.filter(f => fasesSet.has(f));
  }

  /* =========================================================
     RENDER PRINCIPAL
     ========================================================= */
  async function render() {
    try {
      torneo = await obtenerTorneo(id);
    } catch (err) {
      console.error('[torneo-detalle] Error al cargar:', err);
      contenedor.innerHTML = `
        <div class="detalle__top">
          <button class="detalle__back" id="btn-volver">←</button>
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
    const puedeGest = puedeGestionar(t);
    const miEquipo = miEquipoInscrito(t);
    const miSol = miSolicitudPendiente(t);
    const miInv = miInvitacionPendiente(t);

    const pendientesCount = (t.listaEspera || []).filter(l => l.estado === 'pendiente').length;
    const aceptaSolicitudes = !(t.precio === 0 && t.libreInscripcion === true);
    const mostrarBotonSolicitudes = aceptaSolicitudes || pendientesCount > 0;

    const badgeClase = cerrado && !lleno ? 'badge--warning'
                     : lleno              ? 'badge--danger'
                     : t.estado === 'inscripcion' ? 'badge--success'
                     : t.estado === 'en_curso'    ? 'badge--warning'
                                                  : 'badge--neutral';

    const badgeTexto = cerrado && !lleno ? 'Inscripciones cerradas'
                     : lleno              ? 'Lleno'
                     : t.estado === 'inscripcion' ? 'Inscripción abierta'
                     : t.estado === 'en_curso'    ? 'En curso'
                                                  : 'Finalizado';

    const txtParticipante   = esIndividual ? 'participante' : 'equipo';
    const txtParticipantes  = esIndividual ? 'participantes' : 'equipos';
    const txtInscribirme    = esIndividual ? '✅ Inscribirme' : `✅ Inscribir mi equipo (${cuposLibres} cupos)`;
    const txtSeccionLista   = esIndividual ? '👤 Participantes inscritos' : '🏆 Equipos inscritos';

    /* ---------- BOTONES DE ACCIÓN ---------- */
    let acciones = '';

    if (soyOrg) {
      const puedeCerrar = !estaCerrado(t);

      acciones = `
        ${puedeCerrar ? `
          <button class="btn btn--warning" id="btn-cerrar-torneo">
            🔒 Cerrar inscripciones
          </button>
        ` : ''}
        ${mostrarBotonSolicitudes ? `
          <button class="btn btn--primary" id="btn-gestionar-solicitudes">
            👥 Solicitudes ${pendientesCount > 0 ? `<span class="badge badge--neutral" style="margin-left:6px">${pendientesCount}</span>` : ''}
          </button>
        ` : ''}
        ${!esIndividual ? `
          <button class="btn btn--ghost" id="btn-invitar-equipo">+ Invitar equipo</button>
        ` : ''}
        <button class="btn btn--ghost" id="btn-abrir-chat">💬 Chat</button>
        <button class="btn btn--ghost" id="btn-editar-torneo">✏️ Editar</button>
        <button class="btn btn--ghost" id="btn-eliminar-torneo" style="color:var(--color-danger)">🗑️ Eliminar</button>
      `;
    } else if (miEquipo) {
      const nombreMostrado = esIndividual
        ? miEquipo.nombre
        : `${miEquipo.escudo || '🛡️'} ${miEquipo.nombre}`;
      acciones = `
        <button class="btn btn--ghost" id="btn-abrir-chat">💬 Chat del torneo</button>
        <span class="badge badge--success" style="padding:10px 16px; font-size:var(--fs-sm)">
          ✅ Ya estás inscrito: ${nombreMostrado}
        </span>
        <button class="btn btn--ghost" id="btn-salir-torneo" style="color:var(--color-danger)">
          🚪 Salirme del torneo
        </button>
      `;
    } else if (miInv) {
      acciones = `
        <div class="card" style="width:100%; background:var(--color-primary-light); border:none">
          <p class="text-sm" style="margin:0 0 var(--space-3) 0">
            📨 <strong>¡Te invitaron!</strong> El organizador quiere que
            ${miInv.equipoEscudo || '🛡️'} <strong>${miInv.equipoNombre}</strong> participe.
          </p>
          <div class="flex gap-2">
            <button class="btn btn--primary btn--sm" id="btn-aceptar-invitacion">Aceptar</button>
            <button class="btn btn--ghost btn--sm" id="btn-rechazar-invitacion">Rechazar</button>
          </div>
        </div>
      `;
    } else if (miSol) {
      acciones = `
        <span class="badge badge--warning" style="padding:10px 16px; font-size:var(--fs-sm)">
          ⏳ Tu solicitud está en espera de aprobación
        </span>
        <button class="btn btn--ghost btn--sm" id="btn-cancelar-solicitud">Cancelar solicitud</button>
      `;
    } else if (cerrado || lleno) {
      acciones = `
        <span class="badge badge--danger" style="padding:10px 16px; font-size:var(--fs-sm)">
          🔒 Inscripciones cerradas
        </span>
      `;
    } else {
      if (esIndividual) {
        acciones = `
          <button class="btn btn--primary" id="btn-inscribir-equipo">
            ${txtInscribirme}
          </button>
        `;
      } else {
        const misEq = misEquiposComoCapitan();
        if (misEq.length === 0) {
          acciones = `
            <span class="badge badge--neutral" style="padding:10px 16px; font-size:var(--fs-sm)">
              ⚠️ Necesitas ser capitán de un equipo para participar
            </span>
          `;
        } else {
          acciones = `
            <button class="btn btn--primary" id="btn-inscribir-equipo">
              ${txtInscribirme}
            </button>
          `;
        }
      }
    }

    /* ---------- BOTONES DE FIXTURE ---------- */
    let botonesFixture = '';
    if (t.modalidad === 'liga') {
      botonesFixture = `
        <button class="btn btn--primary" id="btn-ver-tabla">
          📊 Tabla de posiciones
        </button>
        <button class="btn btn--ghost" id="btn-ver-resultados">
          📅 Resultados
        </button>
        ${puedeGest ? `
          <button class="btn btn--primary" id="btn-abrir-crear-partido">
            ➕ Crear partido
          </button>
        ` : ''}
      `;
    } else if (t.modalidad === 'eliminacion') {
      botonesFixture = `
        <button class="btn btn--primary" id="btn-ver-fixture">
          🏆 Ver fixture
        </button>
      `;
    }

    /* ---------- BARRA DE PROGRESO ---------- */
    const progreso = Math.min(100, Math.round((inscritos / t.cuposEquipos) * 100));
    const progresoHtml = `
      <div class="torneo-progreso">
        <div class="torneo-progreso__labels">
          <span>Inscripciones</span>
          <span>${inscritos} / ${t.cuposEquipos} ${txtParticipantes}</span>
        </div>
        <div class="torneo-progreso__bar">
          <div class="torneo-progreso__fill" style="width:${progreso}%"></div>
        </div>
      </div>
    `;

    /* ---------- BADGES ---------- */
    const modalidadBadge = {
      liga: '<span class="badge badge--info">⚽ Liga</span>',
      eliminacion: '<span class="badge badge--warning">🏆 Eliminación</span>',
      custom: '<span class="badge badge--neutral">🔧 Custom</span>',
    }[t.modalidad] || '';

    const nivelBadge = {
      amistoso: '<span class="badge badge--success">🟢 Amistoso</span>',
      semiprofesional: '<span class="badge badge--warning">🟡 Semiprofesional</span>',
      profesional: '<span class="badge badge--danger">🔴 Profesional</span>',
    }[t.nivel] || '';

    const tipoBadge = esIndividual
      ? '<span class="badge badge--neutral">👤 Individual</span>'
      : '<span class="badge badge--neutral">👥 Equipos</span>';

    // ⚡ NUEVO D.5: badge de sistema de clasificación
    const sistema = t.sistemaClasificacion || 'simple';
    const sistemaBadge = sistema === 'simple'
      ? ''
      : sistema === 'tiempo'
        ? '<span class="badge badge--info">⏱️ Por tiempo</span>'
        : '<span class="badge badge--info">🏅 Por puntos</span>';

    const idaVueltaBadge = t.idaYVuelta
      ? '<span class="badge badge--info">🔁 Ida y vuelta</span>'
      : '';

    const fechaLimiteHtml = t.fechaLimiteInscripcion
      ? `<span>⏰ Inscripciones hasta ${formatearFecha(t.fechaLimiteInscripcion)}</span>`
      : '';

    /* ---------- PARTICIPANTES INSCRITOS ---------- */
    const equiposHtml = (t.equipos || []).length > 0
      ? `<div class="equipos-grid">
          ${t.equipos.map(e => `
            <div class="equipo-card">
              <div class="equipo-card__escudo">
                ${renderEscudoParticipante(e.nombre, e.escudo, esIndividual)}
              </div>
              <div class="equipo-card__info">
                <div class="equipo-card__nombre">${e.nombre}</div>
                <div class="equipo-card__sub">
                  ${esIndividual ? 'Participante' : `${e.totalJugadores || 0} jugadores`}
                </div>
              </div>
              ${soyOrg ? `
                <button class="btn btn--ghost btn--sm"
                        data-expulsar-equipo="${e.id}"
                        title="Sacar del torneo"
                        style="color:var(--color-danger); margin-left:auto">
                  ✕
                </button>
              ` : ''}
            </div>
          `).join('')}
        </div>`
      : `<div class="empty-state--sm">
          <div class="empty-state__icon">🏅</div>
          <p>Aún no hay ${txtParticipantes} inscritos.</p>
        </div>`;

    /* =========================================================
       RENDER
       ========================================================= */
    contenedor.innerHTML = `
      <div class="detalle__top">
        <button class="detalle__back" id="btn-volver">←</button>
        <h2 class="page-title" style="margin:0; font-size:var(--fs-lg)">Detalle del torneo</h2>
      </div>

      <div class="detalle-torneo__hero">
        <div class="detalle-torneo__hero-emoji">${renderEmoji(t.emoji, 64)}</div>
        <h1 class="detalle-torneo__hero-title">${t.nombre}</h1>
        <div class="detalle-torneo__hero-meta">
          <span>🏅 ${t.deporte}</span>
          <span>📅 ${formatearFecha(t.fechaInicio)}</span>
          ${t.fechaFin ? `<span>🏁 ${formatearFecha(t.fechaFin)}</span>` : ''}
          ${t.lugar ? `<span>📍 ${t.lugar}</span>` : ''}
          ${fechaLimiteHtml}
          <span data-autor-id="${t.organizador.id}" style="cursor:pointer; text-decoration:underline">
            👤 ${t.organizador.nombre}
          </span>
        </div>
        <div class="detalle__badges">
          <span class="badge ${badgeClase}">${badgeTexto}</span>
          ${modalidadBadge}
          ${nivelBadge}
          ${tipoBadge}
          ${sistemaBadge}
          ${idaVueltaBadge}
          ${t.precio === 0
            ? `<span class="match-card__precio match-card__precio--gratis">🎉 Gratis</span>`
            : `<span class="match-card__precio match-card__precio--pago">💰 $${t.precio.toLocaleString('es-CL')}/${txtParticipante}</span>`}
        </div>
      </div>

      ${progresoHtml}

      <div class="detalle__info">
        <div class="detalle__info-item">
          <div class="detalle__info-label">${esIndividual ? 'Participantes' : 'Equipos'}</div>
          <div class="detalle__info-value">${inscritos} / ${t.cuposEquipos}</div>
        </div>
        <div class="detalle__info-item">
          <div class="detalle__info-label">Cupos libres</div>
          <div class="detalle__info-value">${cuposLibres}</div>
        </div>
        <div class="detalle__info-item">
          <div class="detalle__info-label">En lista de espera</div>
          <div class="detalle__info-value">${pendientesCount}</div>
        </div>
      </div>

      ${t.descripcion ? `
        <div class="card mb-4">
          <div class="detalle__seccion-titulo">📝 Descripción</div>
          <p class="text-sm">${t.descripcion}</p>
        </div>
      ` : ''}

      ${botonesFixture ? `
        <div class="card mb-4">
          <div class="detalle__seccion-titulo">🏆 ${t.modalidad === 'liga' ? 'Liga' : 'Fixture'}</div>
          <div class="detalle__acciones" style="margin-bottom:0">
            ${botonesFixture}
          </div>
        </div>
      ` : ''}

      <div class="card mb-4">
        <div class="detalle__seccion-titulo">🎯 Acciones</div>
        <div class="detalle__acciones" style="margin-bottom:0">
          ${acciones}
        </div>
      </div>

      <div class="card">
        <div class="detalle__seccion-titulo">${txtSeccionLista} (${inscritos})</div>
        ${equiposHtml}
      </div>
    `;

    conectarEventos(t);
  }
    /* =========================================================
     CONECTAR EVENTOS
     ========================================================= */
  function conectarEventos(t) {
    const esIndividual = t.tipoParticipacion === 'individual';

    document.getElementById('btn-volver')?.addEventListener('click', () => {
      window.location.hash = '#/torneos';
    });

    document.querySelectorAll('[data-autor-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        import('../components.js').then(({ verPerfilUsuario }) => {
          verPerfilUsuario(el.dataset.autorId);
        });
      });
    });

    document.getElementById('btn-cerrar-torneo')?.addEventListener('click', () => cerrarTorneo(t));
    document.getElementById('btn-gestionar-solicitudes')?.addEventListener('click', () => abrirGestionSolicitudes(t));
    document.getElementById('btn-invitar-equipo')?.addEventListener('click', () => abrirInvitarEquipo(t));
    document.getElementById('btn-abrir-chat')?.addEventListener('click', () => abrirChatTorneo(t));
    document.getElementById('btn-editar-torneo')?.addEventListener('click', () => {
      sessionStorage.setItem('torneoAEditar', String(t.id));
      window.location.hash = '#/torneos';
    });
    document.getElementById('btn-eliminar-torneo')?.addEventListener('click', () => eliminarTorneo(t));

    document.querySelectorAll('[data-expulsar-equipo]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const equipoId = btn.dataset.expulsarEquipo;
        const equipo = (t.equipos || []).find(eq => String(eq.id) === String(equipoId));
        if (!equipo) return;
        expulsarParticipanteDeLista(t, equipo);
      });
    });

    document.getElementById('btn-inscribir-equipo')?.addEventListener('click', () => {
      if (esIndividual) {
        inscribirmeIndividual(t);
      } else {
        abrirInscribirEquipo(t);
      }
    });
    document.getElementById('btn-aceptar-invitacion')?.addEventListener('click', () => aceptarInvitacion(t));
    document.getElementById('btn-rechazar-invitacion')?.addEventListener('click', () => rechazarInvitacion(t));
    document.getElementById('btn-cancelar-solicitud')?.addEventListener('click', () => cancelarSolicitud(t));
    document.getElementById('btn-salir-torneo')?.addEventListener('click', () => salirDelTorneo(t));

    document.getElementById('btn-ver-tabla')?.addEventListener('click', () => abrirTablaPosiciones(t));
    document.getElementById('btn-ver-resultados')?.addEventListener('click', () => abrirResultados(t));
    document.getElementById('btn-abrir-crear-partido')?.addEventListener('click', () => abrirCrearPartido(t));
    document.getElementById('btn-ver-fixture')?.addEventListener('click', () => abrirFixture(t));

    document.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.addEventListener('click', () => cerrarModal(btn.dataset.cerrarModal));
    });

    [
      modalInscribir, modalInvitar, modalSolicitudes, modalChat, modalVerEquipo,
      modalTabla, modalResultados, modalCrearPartido, modalCargar, modalFixture, modalArmar,
      modalEditarJornada, modalEditarCruce, modalVerDetalle,
    ].forEach(m => {
      m?.addEventListener('click', (e) => {
        if (e.target === m) m.classList.remove('open');
      });
    });
  }

  /* =========================================================
     CERRAR TORNEO (con auto-fixture)
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

      if (resultado.autoFixturado) {
        setTimeout(() => abrirFixture(torneo), 300);
      }
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
      : `${equipo.escudo || '🛡️'} ${equipo.nombre}`;

    if (!confirm(`¿Sacar a ${nombreMostrar} del torneo?`)) return;

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
        aceptaSolicitudes
          ? 'Solicitud enviada al organizador'
          : '¡Inscripción exitosa!',
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
        <div class="avatar avatar--md" style="background:var(--color-primary-light); display:grid; place-items:center; font-size:20px">
          ${eq.escudo || '🛡️'}
        </div>
        <div class="amigo-item__info">
          <div class="amigo-item__name">${eq.nombre}</div>
          <div class="amigo-item__sub">${eq.deporte} · ${eq.totalMiembros || 0} jugadores</div>
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
     TABLA DE POSICIONES (liga)
     ========================================================= */
  function abrirTablaPosiciones(t) {
    if (t.modalidad !== 'liga') return;

    const body = document.getElementById('tabla-posiciones-body');
    if (!body) return;

    const filas = t.tablaPosiciones || [];
    const esIndividual = t.tipoParticipacion === 'individual';

    if (filas.length === 0) {
      body.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📊</div>
          <p class="text-sm text-muted">Aún no hay datos. Cargá partidos para ver la tabla.</p>
        </div>`;
      abrirModal('modal-tabla-posiciones');
      return;
    }

    body.innerHTML = `
      <div class="tabla-posiciones-wrapper" style="overflow-x:auto;">
        <table class="tabla-posiciones">
          <thead>
            <tr>
              <th style="width:40px">#</th>
              <th style="text-align:left">${esIndividual ? 'Participante' : 'Equipo'}</th>
              <th>PJ</th>
              <th>PG</th>
              <th>PE</th>
              <th>PP</th>
              <th>GF</th>
              <th>GC</th>
              <th>DG</th>
              <th style="font-weight:700">PTS</th>
            </tr>
          </thead>
          <tbody>
            ${filas.map((f, i) => `
              <tr class="${i % 2 === 0 ? '' : 'tabla-posiciones__fila--alt'}">
                <td>${i + 1}</td>
                <td style="text-align:left">
                  <div style="display:flex; align-items:center; gap:var(--space-2)">
                    ${esIndividual
                      ? `<img src="${f.equipoEscudo || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--sm" style="width:24px;height:24px" />`
                      : `<span style="font-size:20px">${f.equipoEscudo || '🛡️'}</span>`}
                    <span>${f.equipoNombre || 'Sin nombre'}</span>
                  </div>
                </td>
                <td>${f.partidosJugados}</td>
                <td>${f.partidosGanados}</td>
                <td>${f.partidosEmpatados}</td>
                <td>${f.partidosPerdidos}</td>
                <td>${f.puntosFavor}</td>
                <td>${f.puntosContra}</td>
                <td>${f.diferencia > 0 ? '+' : ''}${f.diferencia}</td>
                <td style="font-weight:700">${f.puntosTotales}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    abrirModal('modal-tabla-posiciones');
  }

  /* =========================================================
     RESULTADOS (liga)
     ========================================================= */
  function abrirResultados(t) {
    if (t.modalidad !== 'liga') return;

    const body = document.getElementById('resultados-body');
    if (!body) return;

    const partidos = t.partidos || [];
    const jornadas = t.jornadas || [];
    const puedeGest = puedeGestionar(t);
    const esIndividual = t.tipoParticipacion === 'individual';
    const sistema = t.sistemaClasificacion || 'simple';

    if (jornadas.length === 0 && partidos.length === 0) {
      body.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📅</div>
          <p class="text-sm text-muted">Aún no hay jornadas ni partidos.</p>
          ${puedeGest ? `
            <button class="btn btn--primary mt-4" id="btn-generar-fixture-liga">
              🎲 Generar fixture automático
            </button>
          ` : ''}
        </div>`;

      abrirModal('modal-resultados');

      document.getElementById('btn-generar-fixture-liga')?.addEventListener('click', () => generarFixtureLiga(t));
      return;
    }

    const partidosPorJornada = new Map();
    jornadas.forEach(j => partidosPorJornada.set(String(j.id), []));
    partidos.forEach(p => {
      const key = String(p.jornadaId);
      if (!partidosPorJornada.has(key)) {
        partidosPorJornada.set(key, []);
      }
      partidosPorJornada.get(key).push(p);
    });

    const jornadasOrdenadas = [...jornadas].sort((a, b) => a.numero - b.numero);

    let html = '';

    if (jornadasOrdenadas.length === 0 && partidos.length > 0) {
      html += `
        <div class="card mb-4">
          <div class="detalle__seccion-titulo">Partidos sin jornada</div>
          ${partidos.map(p => renderPartido(p, t.deporte, esIndividual, puedeGest, sistema)).join('')}
        </div>
      `;
    } else {
      for (const j of jornadasOrdenadas) {
        const partidosJ = partidosPorJornada.get(String(j.id)) || [];

        html += `
          <div class="card mb-4 jornada-card" data-jornada-id="${j.id}">
            <div class="jornada-card__header">
              <div>
                <div class="jornada-card__titulo">
                  ${j.nombre || `Jornada ${j.numero}`}
                </div>
                ${j.fecha ? `<div class="jornada-card__fecha text-xs text-muted">${formatearFechaCorta(j.fecha)}</div>` : ''}
              </div>
              ${puedeGest ? `
                <div class="jornada-card__acciones">
                  <button class="btn btn--ghost btn--sm" data-jornada-editar="${j.id}" title="Editar jornada">✏️</button>
                  <button class="btn btn--ghost btn--sm" data-jornada-borrar="${j.id}" title="Borrar jornada" style="color:var(--color-danger)">🗑️</button>
                </div>
              ` : ''}
            </div>

            ${partidosJ.length === 0
              ? `<p class="text-sm text-muted text-center" style="padding:var(--space-4)">Sin partidos cargados.</p>`
              : partidosJ
                  .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
                  .map(p => renderPartido(p, t.deporte, esIndividual, puedeGest, sistema))
                  .join('')}
          </div>
        `;
      }
    }

    body.innerHTML = html;

    if (puedeGest) {
      body.querySelectorAll('[data-partido-id]').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('[data-jornada-editar]')) return;
          if (e.target.closest('[data-jornada-borrar]')) return;

          const partidoId = el.dataset.partidoId;
          const partido = (t.partidos || []).find(p => String(p.id) === String(partidoId));
          if (!partido) return;
          abrirCargarResultado(t, partido);
        });
      });

      body.querySelectorAll('[data-jornada-editar]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const jornadaId = btn.dataset.jornadaEditar;
          const jornada = (t.jornadas || []).find(j => String(j.id) === String(jornadaId));
          if (jornada) abrirEditarJornada(t, jornada);
        });
      });

      body.querySelectorAll('[data-jornada-borrar]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const jornadaId = btn.dataset.jornadaBorrar;
          const jornada = (t.jornadas || []).find(j => String(j.id) === String(jornadaId));
          if (jornada) borrarJornada(t, jornada);
        });
      });
    } else {
      body.querySelectorAll('[data-partido-id]').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('[data-jornada-editar]')) return;
          if (e.target.closest('[data-jornada-borrar]')) return;

          const partidoId = el.dataset.partidoId;
          const partido = (t.partidos || []).find(p => String(p.id) === String(partidoId));
          if (!partido) return;
          if (partido.estado === 'finalizado') {
            abrirVerDetallePartido(t, partido);
          }
        });
      });
    }

    abrirModal('modal-resultados');
  }

  /* ---------- Render de un partido (usa formatearResultado) ---------- */
  function renderPartido(p, deporte, esIndividual, puedeGest, sistema) {
    const finalizado = p.estado === 'finalizado';
    const marcador = finalizado
      ? formatearResultado(deporte, p.resultado, sistema)
      : 'vs';

    const localHtml = esIndividual
      ? `<img src="${p.localEscudo || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--sm" style="width:24px;height:24px" />`
      : `<span style="font-size:20px">${p.localEscudo || '🛡️'}</span>`;

    const visitanteHtml = esIndividual
      ? `<img src="${p.visitanteEscudo || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--sm" style="width:24px;height:24px" />`
      : `<span style="font-size:20px">${p.visitanteEscudo || '🛡️'}</span>`;

    return `
      <div class="resultado-item" data-partido-id="${p.id}" style="cursor:${(puedeGest || finalizado) ? 'pointer' : 'default'}">
        <div class="resultado-item__equipo resultado-item__equipo--local">
          ${localHtml}
          <span class="resultado-item__nombre">${p.localNombre || 'Por definir'}</span>
        </div>
        <div class="resultado-item__marcador ${finalizado ? '' : 'resultado-item__marcador--pendiente'}">
          ${marcador}
          ${finalizado && p.ganador === 'local' ? '<span style="font-size:12px">▲</span>' : ''}
        </div>
        <div class="resultado-item__equipo resultado-item__equipo--visitante">
          <span class="resultado-item__nombre">${p.visitanteNombre || 'Por definir'}</span>
          ${visitanteHtml}
          ${finalizado && p.ganador === 'visitante' ? '<span style="font-size:12px">▲</span>' : ''}
        </div>
        ${p.fecha ? `<div class="resultado-item__fecha text-xs text-muted">${formatearFechaCorta(p.fecha)}</div>` : ''}
      </div>
    `;
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
      abrirResultados(torneo);
    } catch (err) {
      console.error('[torneo-detalle] Error al borrar jornada:', err);
      toast(err.message || 'No se pudo borrar la jornada', 'error');
    }
  }

  /* =========================================================
     EDITAR JORNADA (in-place)
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
      `✏️ Editar ${jornada.nombre || `Jornada ${jornada.numero}`}`;

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

      const localHtml = esIndividual
        ? `<img src="${p.localEscudo || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--sm" style="width:20px;height:20px" />`
        : `<span style="font-size:18px">${p.localEscudo || '🛡️'}</span>`;

      const visHtml = esIndividual
        ? `<img src="${p.visitanteEscudo || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--sm" style="width:20px;height:20px" />`
        : `<span style="font-size:18px">${p.visitanteEscudo || '🛡️'}</span>`;

      let resultadoHtml = '';
      if (finalizado && p.resultado) {
        const marcador = formatearResultado(t.deporte, p.resultado, sistema);
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
              🗑️
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
        `⚠️ ATENCIÓN: Este partido ya tiene un resultado cargado.\n\n` +
        `${nombrePartido}\n\n` +
        `Si lo borrás, se va a recalcular la tabla de posiciones y los puntos de este partido se van a perder.\n\n` +
        `¿Estás seguro de que querés borrarlo?`;

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
      abrirResultados(t);
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
      abrirResultados(torneo);
    } catch (err) {
      console.error('[torneo-detalle] Error al guardar jornada:', err);
      toast(err.message || 'No se pudo guardar la jornada', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar cambios';
    }
  }
    /* =========================================================
     CREAR PARTIDO (con filtro de visitante)
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
      `<option value="${e.id}">${esIndividual ? '' : '🛡️ '}${e.nombre}</option>`
    ).join('');

    function refrescarVisitantes() {
      const localId = tSelLocal.value;
      const opcionesVisitante = inscritos
        .filter(e => String(e.id) !== String(localId))
        .map(e => `<option value="${e.id}">${esIndividual ? '' : '🛡️ '}${e.nombre}</option>`)
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
      abrirResultados(torneo);
    } catch (err) {
      console.error('[torneo-detalle] Error al crear partido:', err);
      toast(err.message || 'No se pudo crear el partido', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Crear partido';
    }
  }

  /* =========================================================
     ⚡ CARGAR RESULTADO — CON 3 MODOS (D.5)
     =========================================================
     1) modo-simple     → goles/puntos/carreras (+ penales)
     2) modo-sets       → sets con puntos
     3) modo-tiempo-puntos → tiempo o puntos por participante
     ========================================================= */
  function abrirCargarResultado(t, partido) {
    if (!puedeGestionar(t)) return;

    partidoActual = partido;

    const deporte = t.deporte;
    const sistema = t.sistemaClasificacion || 'simple';
    const reglas = getReglasDeporte(deporte);
    const esIndividual = t.tipoParticipacion === 'individual';

    document.getElementById('cargar-resultado-titulo').textContent = 'Cargar resultado';

    /* ---------- Cabecera: escudos y nombres ---------- */
    const localEsc = document.getElementById('cargar-resultado-local-escudo');
    const localNom = document.getElementById('cargar-resultado-local-nombre');
    const visEsc   = document.getElementById('cargar-resultado-visitante-escudo');
    const visNom   = document.getElementById('cargar-resultado-visitante-nombre');

    if (esIndividual) {
      localEsc.innerHTML = `<img src="${partido.localEscudo || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--lg" />`;
      visEsc.innerHTML   = `<img src="${partido.visitanteEscudo || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--lg" />`;
    } else {
      localEsc.textContent = partido.localEscudo || '🛡️';
      visEsc.textContent   = partido.visitanteEscudo || '🛡️';
    }

    localNom.textContent = partido.localNombre || 'Local';
    visNom.textContent   = partido.visitanteNombre || 'Visitante';

    /* ---------- Referencias a los 3 modos ---------- */
    const modoSimple  = document.getElementById('cargar-resultado-modo-simple');
    const modoSets    = document.getElementById('cargar-resultado-modo-sets');
    const modoTP      = document.getElementById('cargar-resultado-modo-tiempo-puntos');

    // Ocultar los 3 por defecto y mostrar el que corresponda
    modoSimple?.classList.add('hidden');
    modoSets?.classList.add('hidden');
    modoTP?.classList.add('hidden');

    /* ---------- Selector de estado ---------- */
    const selectEstado = document.getElementById('cargar-resultado-estado');
    selectEstado.value = partido.estado === 'finalizado' ? 'finalizado'
                       : partido.estado === 'en_curso'   ? 'en_curso'
                       : 'finalizado';

    /* =====================================================
       MODO TIEMPO / PUNTOS
       ===================================================== */
    if (sistema === 'tiempo' || sistema === 'puntos') {
      modoTP?.classList.remove('hidden');
      prepararModoTiempoPuntos(t, partido, sistema, esIndividual);
      abrirModal('modal-cargar-resultado');
      return;
    }

    /* =====================================================
       MODO SETS
       ===================================================== */
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
        hintText = reglas.nota || 'Ingresá el resultado de cada set (ej: 6-4, 7-6, 7-5).';
      }
      setsHint.textContent = hintText;

      const setsExistentes = (partido.resultado && Array.isArray(partido.resultado.sets))
        ? partido.resultado.sets
        : [];

      const setsIniciales = setsExistentes.length > 0
        ? setsExistentes
        : [{ local: 0, visitante: 0 }];

      // Sincroniza el DOM actual con el array `sets` (evita perder datos)
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
              <button type="button" class="btn btn--ghost btn--sm set-item__del" data-set-del="${i}" style="color:var(--color-danger)" title="Borrar set">🗑️</button>
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

    /* =====================================================
       MODO SIMPLE (con o sin penales)
       ===================================================== */
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

    abrirModal('modal-cargar-resultado');
  }

  /* =========================================================
     ⚡ PREPARAR MODO TIEMPO/PUNTOS
     =========================================================
     Renderiza dos filas, una por participante, con:
     - Si es tiempo: 3 inputs (min, seg, cent)
     - Si es puntos: 1 input de puntos
     Y muestra en vivo quién va ganando.
     ========================================================= */
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

    /* ---------- Valores iniciales ---------- */
    const partes = Array.isArray(partido.resultado?.participantes)
      ? partido.resultado.participantes
      : [];

    const valLocal  = partes.find(p => String(p.id) === String(localId)) || {};
    const valVisita = partes.find(p => String(p.id) === String(visitaId)) || {};

    /* ---------- Render ---------- */
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

    /* ---------- Actualizar ganador en vivo ---------- */
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
        else if (tL < tV) ganadorTxt = `🏆 ${localNom}`;
        else if (tV < tL) ganadorTxt = `🏆 ${visitaNom}`;
        else ganadorTxt = 'Empate';
      } else {
        const pL = Number(lista.querySelector('[data-tp-local-puntos]')?.value);
        const pV = Number(lista.querySelector('[data-tp-visitante-puntos]')?.value);

        if (!Number.isFinite(pL) && !Number.isFinite(pV)) ganadorTxt = '—';
        else if (Number.isFinite(pL) && (!Number.isFinite(pV) || pL > pV)) ganadorTxt = `🏆 ${localNom}`;
        else if (Number.isFinite(pV) && (!Number.isFinite(pL) || pV > pL)) ganadorTxt = `🏆 ${visitaNom}`;
        else ganadorTxt = 'Empate';
      }

      ganadorEl.textContent = ganadorTxt;
    }

    lista.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', actualizarGanador);
    });
    actualizarGanador();

    /* ---------- Botón guardar ---------- */
    const btnGuardar = document.getElementById('btn-guardar-resultado');
    btnGuardar.textContent = 'Guardar resultado';
    btnGuardar.disabled = false;
    btnGuardar.onclick = () => guardarResultadoTiempoPuntos(
      t, partido, sistema, localId, visitaId, lista
    );
  }

  function localEscDe(partido, lado) {
    if (lado === 'local')  return partido.localEscudo || '🛡️';
    return partido.visitanteEscudo || '🛡️';
  }

  function renderFilaTiempo(participanteId, nombre, esIndividual, escudo, min, seg, cen, lado) {
    const escudoHtml = esIndividual
      ? `<img src="${escudo === '🛡️' ? 'assets/icons/usuario.svg' : escudo}" alt="" class="avatar avatar--md" />`
      : `<span style="font-size:28px">${escudo}</span>`;

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
      ? `<img src="${escudo === '🛡️' ? 'assets/icons/usuario.svg' : escudo}" alt="" class="avatar avatar--md" />`
      : `<span style="font-size:28px">${escudo}</span>`;

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

  /* =========================================================
     GUARDAR RESULTADO — MODO TIEMPO/PUNTOS
     ========================================================= */
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

      if (tL === 0 && tV === 0) {
        return toast('Ingresá al menos un tiempo', 'error');
      }
      if (tL === tV) {
        return toast('Los tiempos no pueden ser iguales', 'error');
      }

      participantes.push({ id: localId,  tiempoSeg: tL });
      participantes.push({ id: visitaId, tiempoSeg: tV });
    } else {
      const pL = Number(lista.querySelector('[data-tp-local-puntos]')?.value);
      const pV = Number(lista.querySelector('[data-tp-visitante-puntos]')?.value);

      if (!Number.isFinite(pL) || !Number.isFinite(pV)) {
        return toast('Ingresá los puntos de ambos participantes', 'error');
      }
      if (pL === pV) {
        return toast('Los puntajes no pueden ser iguales', 'error');
      }

      participantes.push({ id: localId,  puntos: pL });
      participantes.push({ id: visitaId, puntos: pV });
    }

    const resultado = {
      sistema,
      participantes,
    };

    const btn = document.getElementById('btn-guardar-resultado');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      await cargarResultadoAPI(t.id, partido.id, { resultado, estado });

      toast('Resultado cargado', 'success');
      cerrarModal('modal-cargar-resultado');

      torneo = await obtenerTorneo(t.id);
      await render();

      if (t.modalidad === 'liga') {
        abrirResultados(torneo);
      } else if (t.modalidad === 'eliminacion') {
        abrirFixture(torneo);
      }
    } catch (err) {
      console.error('[torneo-detalle] Error al cargar resultado:', err);
      toast(err.message || 'No se pudo cargar el resultado', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar resultado';
    }
  }

  /* =========================================================
     GUARDAR RESULTADO — MODO SIMPLE
     ========================================================= */
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

      if (penLocal === penVisita) {
        return toast('En caso de empate, el desempate también debe tener un ganador', 'error');
      }

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

      if (t.modalidad === 'liga') {
        abrirResultados(torneo);
      } else if (t.modalidad === 'eliminacion') {
        abrirFixture(torneo);
      }
    } catch (err) {
      console.error('[torneo-detalle] Error al cargar resultado:', err);
      toast(err.message || 'No se pudo cargar el resultado', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar resultado';
    }
  }

  /* =========================================================
     GUARDAR RESULTADO — MODO SETS
     ========================================================= */
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

    if (sets.length === 0) {
      return toast('Agregá al menos un set', 'error');
    }

    let setsLocal = 0;
    let setsVisitante = 0;
    sets.forEach(s => {
      if (s.local > s.visitante) setsLocal++;
      else if (s.visitante > s.local) setsVisitante++;
    });

    if (setsLocal === setsVisitante) {
      return toast('Tiene que haber un ganador (no pueden empatar en sets)', 'error');
    }

    const resultado = {
      sets,
      setsLocal,
      setsVisitante,
    };

    const btn = document.getElementById('btn-guardar-resultado');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      await cargarResultadoAPI(t.id, partido.id, { resultado, estado });

      toast('Resultado cargado', 'success');
      cerrarModal('modal-cargar-resultado');

      torneo = await obtenerTorneo(t.id);
      await render();

      if (t.modalidad === 'liga') {
        abrirResultados(torneo);
      } else if (t.modalidad === 'eliminacion') {
        abrirFixture(torneo);
      }
    } catch (err) {
      console.error('[torneo-detalle] Error al cargar resultado:', err);
      toast(err.message || 'No se pudo cargar el resultado', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar resultado';
    }
  }

  /* =========================================================
     NUEVA JORNADA (helper)
     ========================================================= */
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

  /* =========================================================
     GENERAR FIXTURE LIGA (round-robin)
     ========================================================= */
  async function generarFixtureLiga(t) {
    if (!confirm('¿Generar el fixture automático? Esto crea todas las jornadas y partidos. No podrás hacerlo de nuevo hasta borrar los partidos existentes.')) return;

    try {
      const resultado = await generarFixtureLigaAPI(t.id);
      toast(resultado.mensaje || 'Fixture generado', 'success');

      torneo = await obtenerTorneo(t.id);
      abrirResultados(torneo);
    } catch (err) {
      console.error('[torneo-detalle] Error al generar fixture:', err);
      toast(err.message || 'No se pudo generar el fixture', 'error');
    }
  }

  /* =========================================================
     FIXTURE (ELIMINACIÓN) — BRACKET VISUAL
     ========================================================= */
  function abrirFixture(t) {
    if (t.modalidad !== 'eliminacion') return;

    const body = document.getElementById('fixture-body');
    const accionesCont = document.getElementById('fixture-acciones');
    if (!body || !accionesCont) return;

    const puedeGest = puedeGestionar(t);
    const partidos = t.partidos || [];
    const esIndividual = t.tipoParticipacion === 'individual';
    const sistema = t.sistemaClasificacion || 'simple';

    /* ---------- Barra de acciones ---------- */
    if (puedeGest && !t.fixtureBloqueado) {
      const hayPartidos = partidos.length > 0;

      accionesCont.innerHTML = `
        ${!hayPartidos ? `
          <button class="btn btn--primary btn--sm" id="btn-armar-aleatorio">
            🎲 Armar fixture aleatorio
          </button>
          <button class="btn btn--ghost btn--sm" id="btn-armar-manual">
            🛠️ Armar fixture manual
          </button>
        ` : `
          <button class="btn btn--primary btn--sm" id="btn-confirmar-fixture">
            ✅ Confirmar fixture
          </button>
          <button class="btn btn--ghost btn--sm" id="btn-rearmar-fixture" style="color:var(--color-danger)">
            🗑️ Rehacer fixture
          </button>
        `}
      `;
    } else if (puedeGest && t.fixtureBloqueado) {
      accionesCont.innerHTML = `
        <span class="badge badge--success" style="padding:8px 12px">
          🔒 Fixture confirmado
        </span>
      `;
    } else {
      accionesCont.innerHTML = '';
    }

    /* ---------- Bracket vacío ---------- */
    if (partidos.length === 0) {
      body.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🏆</div>
          <p class="text-sm text-muted">El fixture todavía no fue armado.</p>
          ${puedeGest ? `<p class="text-xs text-muted mt-4">Armalo con los botones de arriba.</p>` : ''}
        </div>`;

      document.getElementById('btn-armar-aleatorio')?.addEventListener('click', () => armarAleatorio(t));
      document.getElementById('btn-armar-manual')?.addEventListener('click', () => abrirArmarManual(t));

      abrirModal('modal-fixture');
      return;
    }

    /* ---------- Agrupar por fase ---------- */
    const fases = fasesDelBracket(t);
    if (fases.length === 0) {
      body.innerHTML = `<p class="text-sm text-muted text-center">Sin fases detectadas.</p>`;
      abrirModal('modal-fixture');
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

    /* ---------- Render del bracket ---------- */
    let html = '<div class="fixture-bracket-nuevo">';

    fases.forEach((fase, idxFase) => {
      const partidosFase = partidosPorFase.get(fase) || [];
      if (partidosFase.length === 0) return;

      html += `
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

    html += '</div>';

    body.innerHTML = html;

    /* ---------- Conectar clicks ---------- */
    body.querySelectorAll('[data-partido-id]').forEach(el => {
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

    abrirModal('modal-fixture');
  }

  /* ---------- Render de un cruce del bracket ---------- */
  function renderCruceNuevo(p, deporte, esIndividual, sistema, idxFase, idxCruce, puedeEditar, puedeInteractuar) {
    const finalizado = p.estado === 'finalizado';
    const esBye = p.esBye;

    const localNombre = p.localNombre || 'Por definir';
    const visitanteNombre = p.visitanteNombre || 'Por definir';

    const localEsc = esIndividual
      ? `<img src="${p.localEscudo || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--sm" style="width:20px;height:20px" />`
      : `<span style="font-size:18px">${p.localEscudo || '🛡️'}</span>`;

    const visEsc = esIndividual
      ? `<img src="${p.visitanteEscudo || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--sm" style="width:20px;height:20px" />`
      : `<span style="font-size:18px">${p.visitanteEscudo || '🛡️'}</span>`;

    const ganadorLocal = finalizado && p.ganador === 'local';
    const ganadorVisitante = finalizado && p.ganador === 'visitante';

    let marcador = '';
    if (esBye) {
      marcador = '<span class="badge badge--neutral">BYE</span>';
    } else if (finalizado) {
      marcador = formatearResultado(deporte, p.resultado, sistema);
    }

    const claseCard = [
      'bracket-cruce',
      finalizado ? 'bracket-cruce--finalizado' : '',
      esBye ? 'bracket-cruce--bye' : '',
      puedeInteractuar ? 'bracket-cruce--clickeable' : '',
      idxCruce % 2 === 0 ? 'bracket-cruce--impar' : 'bracket-cruce--par',
    ].filter(Boolean).join(' ');

    const iconoEditar = puedeEditar
      ? `<span class="bracket-cruce__icono" title="Editar cruce">✏️</span>`
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

    const marcadorPrincipal = formatearResultado(t.deporte, partido.resultado, sistema);

    const localEscHtml = esIndividual
      ? `<img src="${partido.localEscudo || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--lg" />`
      : `<div style="font-size:44px">${partido.localEscudo || '🛡️'}</div>`;

    const visEscHtml = esIndividual
      ? `<img src="${partido.visitanteEscudo || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--lg" />`
      : `<div style="font-size:44px">${partido.visitanteEscudo || '🛡️'}</div>`;

    /* ---------- Sets ---------- */
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

    /* ---------- Penales ---------- */
    let penalesHtml = '';
    if (partido.resultado?.penales_local != null && partido.resultado?.penales_visitante != null) {
      penalesHtml = `
        <div class="ver-detalle__penales">
          <div class="badge badge--info">${reglas.labelDesempate || 'Desempate'}: ${partido.resultado.penales_local} - ${partido.resultado.penales_visitante}</div>
        </div>
      `;
    }

    /* ---------- ⚡ Tiempo / Puntos ---------- */
    let tiempoPuntosHtml = '';
    if ((sistema === 'tiempo' || sistema === 'puntos') && Array.isArray(partido.resultado?.participantes)) {
      const partes = partido.resultado.participantes;

      tiempoPuntosHtml = `
        <div class="ver-detalle__tp" style="margin-top:var(--space-4)">
          ${partes.map(p => {
            const esLocal = String(p.id) === String(partido.equipoLocalId);
            const nombre = esLocal ? (partido.localNombre || 'Local') : (partido.visitanteNombre || 'Visitante');
            const escudo = esLocal ? (partido.localEscudo || '🛡️') : (partido.visitanteEscudo || '🛡️');

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
                    ? `<img src="${escudo === '🛡️' ? 'assets/icons/usuario.svg' : escudo}" alt="" class="avatar avatar--md" />`
                    : `<span style="font-size:28px">${escudo}</span>`}
                  <div>
                    <div style="font-weight:600">${nombre}</div>
                    ${esGanador ? `<div class="badge badge--success" style="margin-top:4px">🏆 Ganador</div>` : ''}
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

    /* ---------- Ganador ---------- */
    const ganadorHtml = partido.ganador === 'local'
      ? `<span class="badge badge--success">🏆 Ganó ${partido.localNombre || 'Local'}</span>`
      : partido.ganador === 'visitante'
        ? `<span class="badge badge--success">🏆 Ganó ${partido.visitanteNombre || 'Visitante'}</span>`
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

      ${partido.fecha ? `<p class="text-xs text-muted text-center mt-4">📅 ${formatearFecha(partido.fecha)}</p>` : ''}
    `;

    /* ---------- Botón "Editar resultado" ---------- */
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

    titulo.textContent = `✏️ Editar ${FASES_LABEL[partido.fase] || 'cruce'}`;
    descripcion.textContent = 'Cambiá los participantes de este cruce. Podés dejar uno vacío para dar un BYE.';

    const opciones = inscritos.map(e =>
      `<option value="${e.id}">${esIndividual ? '' : '🛡️ '}${e.nombre}</option>`
    ).join('');

    function refrescar() {
      const localId = selectLocal.value;
      const visitaId = selectVisita.value;

      selectLocal.innerHTML = `
        <option value="">— Vacío (bye) —</option>
        ${inscritos
          .filter(e => String(e.id) !== String(visitaId))
          .map(e => `<option value="${e.id}">${esIndividual ? '' : '🛡️ '}${e.nombre}</option>`)
          .join('')}
      `;
      selectVisita.innerHTML = `
        <option value="">— Vacío (bye) —</option>
        ${inscritos
          .filter(e => String(e.id) !== String(localId))
          .map(e => `<option value="${e.id}">${esIndividual ? '' : '🛡️ '}${e.nombre}</option>`)
          .join('')}
      `;
    }

    selectLocal.innerHTML = `<option value="">— Vacío (bye) —</option>${opciones}`;
    selectVisita.innerHTML = `<option value="">— Vacío (bye) —</option>${opciones}`;
    selectLocal.value = partido.equipoLocalId || '';
    selectVisita.value = partido.equipoVisitanteId || '';

    refrescar();

    selectLocal.onchange = refrescar;
    selectVisita.onchange = refrescar;

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
      if (!confirm('Este cruce va a quedar vacío. ¿Querés borrarlo?')) return;

      try {
        await eliminarPartidoTorneoAPI(t.id, partido.id);
        toast('Cruce eliminado', 'info');
        cerrarModal('modal-editar-cruce');

        torneo = await obtenerTorneo(t.id);
        await render();
        abrirFixture(torneo);
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
      abrirFixture(torneo);
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
      abrirFixture(torneo);
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
      `<option value="${e.id}">${esIndividual ? '' : '🛡️ '}${e.nombre}</option>`
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

      if (!local && !visitante) {
        return toast(`El cruce ${i + 1} está vacío`, 'error');
      }
      if (local && visitante && local === visitante) {
        return toast(`El cruce ${i + 1} tiene el mismo equipo en local y visitante`, 'error');
      }

      cruces.push({
        localId: local || null,
        visitanteId: visitante || null,
      });
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
      abrirFixture(torneo);
    } catch (err) {
      console.error('[torneo-detalle] Error al armar fixture manual:', err);
      toast(err.message || 'No se pudo armar el fixture', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Armar fixture';
    }
  }

  async function confirmarFixture(t) {
    if (!confirm('¿Confirmar el fixture? Ya no podrás editar los cruces, solo cargar resultados.')) return;

    try {
      await confirmarFixtureAPI(t.id);
      toast('Fixture confirmado', 'success');

      torneo = await obtenerTorneo(t.id);
      await render();
      abrirFixture(torneo);
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
        `⚠️ ATENCIÓN\n\n` +
        `Este torneo ya tiene ${partidosConResultado.length} partido(s) con resultado cargado.\n\n` +
        `Si rehacés el fixture, se van a borrar TODOS los cruces Y TODOS los resultados.\n\n` +
        `¿Estás seguro de que querés rehacer el fixture?`;

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
      abrirFixture(torneo);
    } catch (err) {
      console.error('[torneo-detalle] Error al rehacer fixture:', err);
      toast(err.message || 'No se pudo borrar el fixture', 'error');
    }
  }

  /* =========================================================
     GESTIONAR SOLICITUDES
     ========================================================= */
  function abrirGestionSolicitudes(t) {
    renderSolicitudes(t, 'pendientes');
    abrirModal('modal-gestionar-solicitudes');
  }

  function renderSolicitudes(t, tab) {
    const cont = document.getElementById('lista-solicitudes');
    if (!cont) return;

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
          <div class="empty-state__icon">📭</div>
          <p>Sin solicitudes en esta categoría</p>
        </div>`;
      return;
    }

    const lleno = (t.equipos || []).length >= t.cuposEquipos;

    const loteHtml = tab === 'pendientes' && !lleno ? `
      <div class="torneo-lote-acciones">
        <button class="btn btn--ghost btn--sm" id="btn-seleccionar-todas">Seleccionar todas</button>
        <button class="btn btn--accion-lote btn--sm" id="btn-aprobar-lote" disabled>
          ✅ Aprobar seleccionadas
        </button>
        <button class="btn btn--ghost btn--sm" id="btn-rechazar-lote" disabled>
          ❌ Rechazar
        </button>
      </div>
    ` : '';

    cont.innerHTML = statsHtml + loteHtml + lista.map((sol, i) => `
      <div class="solicitud-item">
        ${tab === 'pendientes' && !lleno ? `
          <input type="checkbox" data-sel="${i}" />
        ` : ''}

        <div class="avatar avatar--md" style="background:var(--color-primary-light); display:grid; place-items:center; font-size:20px">
          ${esIndividual
            ? `<img src="${sol.equipoEscudo || 'assets/icons/usuario.svg'}" alt="" class="avatar avatar--md" />`
            : (sol.equipoEscudo || '🛡️')}
        </div>
        <div class="solicitud-item__info" data-ver="${i}" style="cursor:pointer">
          <div class="solicitud-item__nombre">${sol.equipoNombre}</div>
          <div class="solicitud-item__meta">
            ${sol.origen === 'invitacion-aceptada' ? '✅ Aceptó tu invitación' : (esIndividual ? '📩 Solicitó inscribirse' : '📩 Solicitó unirse')} ·
            ${new Date(sol.fecha).toLocaleDateString('es-CL')}
          </div>
        </div>
        <div class="solicitud-item__actions">
          ${!esIndividual ? `<button class="btn btn--ghost btn--sm" data-ver-btn="${i}">👁️ Ver</button>` : ''}
          ${sol.estado === 'pendiente' ? `
            <button class="btn btn--primary btn--sm" data-aceptar="${i}" ${lleno ? 'disabled title="Torneo lleno"' : ''}>Aprobar</button>
            <button class="btn btn--ghost btn--sm" data-rechazar="${i}">✕</button>
          ` : sol.estado === 'aceptado' ? `
            <span class="badge badge--success">Aceptado</span>
            <button class="btn btn--ghost btn--sm" data-expulsar="${i}" style="color:var(--color-danger)">Sacar</button>
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
    const nombre = esIndividual ? sol.equipoNombre : `${sol.equipoEscudo || '🛡️'} ${sol.equipoNombre}`;
    if (!confirm(`¿Sacar a ${nombre} del torneo?`)) return;

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
        <div class="avatar avatar--md" style="background:var(--color-primary-light); display:grid; place-items:center; font-size:20px">
          ${eq.escudo || '🛡️'}
        </div>
        <div class="amigo-item__info">
          <div class="amigo-item__name">${eq.nombre}</div>
          <div class="amigo-item__sub">${eq.deporte || 'Sin deporte'}${eq.ciudad ? ' · ' + eq.ciudad : ''}</div>
        </div>
        <button class="btn btn--primary btn--sm" data-invitar="${eq.id}">+ Invitar</button>
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
    let equipo;
    try {
      equipo = await obtenerGrupo(equipoData.equipoId || equipoData.id);
    } catch (err) {
      console.error('[torneo-detalle] Error al cargar equipo:', err);
      return toast('No se pudo cargar el equipo', 'error');
    }

    if (!equipo) return toast('Equipo no encontrado', 'error');

    document.getElementById('ver-equipo-titulo').textContent =
      `${equipo.escudo || '🛡️'} ${equipo.nombre}`;

    const jugadores = equipo.miembros || [];

    document.getElementById('ver-equipo-body').innerHTML = `
      <div class="ver-equipo__header">
        <div class="ver-equipo__escudo">${equipo.escudo || '🛡️'}</div>
        <div>
          <div class="ver-equipo__nombre">${equipo.nombre}</div>
          <div class="ver-equipo__meta">
            ${equipo.deporte || 'Sin deporte'}${equipo.ciudad ? ' · ' + equipo.ciudad : ''}
          </div>
        </div>
      </div>

      ${equipo.descripcion ? `<p class="text-sm text-muted mb-4">${equipo.descripcion}</p>` : ''}

      <div class="detalle__seccion-titulo mb-4">
        👥 Plantilla (${jugadores.length} jugadores)
      </div>

      ${jugadores.length === 0 ? `
        <p class="text-sm text-muted text-center" style="padding:var(--space-5)">
          Sin información de jugadores
        </p>
      ` : `
        <div class="player-list">
          ${jugadores.map(j => {
            const capitan = String(j.id) === String(equipo.capitanId);
            return `
              <div class="player-row">
                <div class="player-row__pos">${j.posicion ? j.posicion.slice(0, 3).toUpperCase() : '—'}</div>
                <img src="${j.avatar || 'assets/icons/usuario.svg'}" class="avatar avatar--md" alt="" data-autor-id="${j.id}" style="cursor:pointer" />
                <div style="flex:1; min-width:0">
                  <div class="feed-item__title">
                    ${j.nombre}
                    ${capitan ? '<span class="badge badge--primary" style="margin-left:6px">👑 Capitán</span>' : ''}
                  </div>
                  <div class="feed-item__subtitle">
                    ${j.posicion || 'Sin posición'}${j.dorsal ? ' · #' + j.dorsal : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;

    document.getElementById('ver-equipo-body').querySelectorAll('[data-autor-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        import('../components.js').then(({ verPerfilUsuario }) => {
          verPerfilUsuario(el.dataset.autorId);
        });
      });
    });

    document.querySelectorAll('#modal-ver-equipo [data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-ver-equipo');
    });
    document.getElementById('modal-ver-equipo').onclick = (e) => {
      if (e.target.id === 'modal-ver-equipo') cerrarModal('modal-ver-equipo');
    };

    abrirModal('modal-ver-equipo');
  }

  /* =========================================================
     CHAT (LEGACY)
     ========================================================= */
  function abrirChatTorneo(t) {
    document.getElementById('chat-torneo-titulo').textContent = `💬 ${t.nombre}`;

    const cont = document.getElementById('chat-torneo-mensajes');
    if (cont) {
      cont.innerHTML = `
        <div class="chat-mensajes__empty">
          <div style="font-size:48px">🚧</div>
          <p class="mt-4">Chat en migración</p>
          <p class="text-xs" style="margin-top:4px">
            Esta función se activará en la próxima fase.
          </p>
        </div>`;
    }

    abrirModal('modal-chat-torneo');
  }

  /* =========================================================
     INIT
     ========================================================= */
  await render();

  return null;
}