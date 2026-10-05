import { formatearFecha, toast, abrirModal, cerrarModal } from '../components.js';
import { deportes } from '../data-mock.js';
import { getSesion } from '../auth.js';
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

// ⚡ NUEVO D.5: reglas por deporte
import { getReglasDeporte, getSistemaEfectivo } from '../utils/reglas-deporte.js';

/* =========================================================
   MAPA DE EMOJIS
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
   DEPORTES INDIVIDUALES
   ========================================================= */
const DEPORTES_INDIVIDUALES = new Set([
  'Tenis', 'Pádel', 'Squash', 'Tenis de mesa', 'Bádminton',
  'Golf', 'Natación', 'Atletismo', 'Ciclismo', 'Surf',
  'Escalada', 'Boxeo',
]);

/* =========================================================
   ⚡ DEPORTES CON SISTEMA SUGERIDO (D.5)
   =========================================================
   Cuando el usuario elige uno de estos deportes, se
   preselecciona el sistema correspondiente y se muestra el
   selector. Si elige otro deporte, se oculta.
   ========================================================= */
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
  const user = getSesion();

  /* ---------- ESTADO ---------- */
  let torneos = [];
  let filtroActual = 'todos';
  let modalidadSeleccionada = 'liga';
  let nivelTorneoSeleccionado = 'amistoso';
  let tipoParticipacionSeleccionado = 'equipo';
  let sistemaClasificacionSeleccionado = 'simple';   // ⚡ NUEVO
  let esEdicion = false;

  /* ---------- CARGAR DESDE EL BACKEND ---------- */
  async function recargarTorneos() {
    try {
      const { data } = await listarTorneos({ limit: 50 });
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
  const chips           = document.querySelectorAll('[data-filtro-torneo]');
  const btnCrear        = document.getElementById('btn-crear-torneo');
  const btnCrear2       = document.getElementById('btn-crear-torneo-2');

  if (!contDisponibles) return null;

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

  function renderEmoji(emoji, size = 32) {
    if (!emoji) return '🏆';
    if (typeof emoji === 'string' && /\.(svg|png|jpg|jpeg|gif|webp)$/i.test(emoji)) {
      return `<img src="${emoji}" alt="" style="width:${size}px;height:${size}px;object-fit:contain;display:block" />`;
    }
    return emoji;
  }

  function renderNivelBadge(nivel) {
    const map = {
      amistoso: '<span class="badge badge--success">🟢 Amistoso</span>',
      semiprofesional: '<span class="badge badge--warning">🟡 Semiprofesional</span>',
      profesional: '<span class="badge badge--danger">🔴 Profesional</span>',
    };
    return map[nivel] || '';
  }

  function renderTipoParticipacionBadge(tipo) {
    if (tipo === 'individual') {
      return '<span class="badge badge--neutral">👤 Individual</span>';
    }
    return '<span class="badge badge--neutral">👥 Equipos</span>';
  }

  /* ⚡ NUEVO: badge de sistema de clasificación (solo si no es 'simple') */
  function renderSistemaBadge(sistema) {
    if (!sistema || sistema === 'simple') return '';
    if (sistema === 'tiempo') {
      return '<span class="badge badge--info">⏱️ Por tiempo</span>';
    }
    if (sistema === 'puntos') {
      return '<span class="badge badge--info">🏅 Por puntos</span>';
    }
    return '';
  }

  /* =========================================================
     RENDER CARD
     ========================================================= */
  function renderCard(t, opciones = {}) {
    const { mostrarAcciones = false, mostrarBadgeRol = null } = opciones;

    const inscritosCount = t.totalEquipos ?? 0;
    const enEspera = t.totalListaEspera ?? 0;
    const porcentaje = Math.min(100, Math.round((inscritosCount / t.cuposEquipos) * 100));
    const lleno = inscritosCount >= t.cuposEquipos;

    const fechaLimiteVencida = t.fechaLimiteInscripcion && new Date(t.fechaLimiteInscripcion) < new Date();
    const cerrado = t.estado !== 'inscripcion' || fechaLimiteVencida;

    const soyOrganizador = t.soyOrganizador || String(t.organizador?.id) === String(user?.id);
    const miEquipoInscrito = t.miEquipoInscrito;
    const miSolicitudPendiente = t.miSolicitudPendiente;
    const miInvitacionPendiente = t.miInvitacionPendiente;

    const badgeClase = lleno ? 'badge--danger'
                     : cerrado ? 'badge--warning'
                     : t.estado === 'inscripcion' ? 'badge--success'
                     : t.estado === 'en_curso'    ? 'badge--warning'
                                                  : 'badge--neutral';

    const badgeTexto = lleno ? 'Lleno'
                     : cerrado && t.estado === 'inscripcion' ? 'Inscripciones cerradas'
                     : t.estado === 'inscripcion' ? 'Inscripción abierta'
                     : t.estado === 'en_curso'    ? 'En curso'
                                                  : 'Finalizado';

    const precioHtml = t.precio === 0
      ? `<span class="match-card__precio match-card__precio--gratis">🎉 Gratis</span>`
      : `<span class="match-card__precio match-card__precio--pago">💰 $${t.precio.toLocaleString('es-CL')}/${t.tipoParticipacion === 'individual' ? 'persona' : 'equipo'}</span>`;

    const badgeRolHtml = mostrarBadgeRol
      ? `<span class="badge badge--primary" style="margin-left:auto">${mostrarBadgeRol}</span>`
      : '';

    const modalidadBadge = {
      liga: '<span class="badge badge--info">⚽ Liga</span>',
      eliminacion: '<span class="badge badge--warning">🏆 Eliminación</span>',
      custom: '<span class="badge badge--neutral">🔧 Custom</span>',
    }[t.modalidad] || '';

    const nivelBadge = renderNivelBadge(t.nivel);
    const tipoBadge = renderTipoParticipacionBadge(t.tipoParticipacion);

    // ⚡ NUEVO: badge de sistema
    const sistemaBadge = renderSistemaBadge(t.sistemaClasificacion);

    const fechaLimiteHtml = t.fechaLimiteInscripcion
      ? `<span>⏰ Hasta ${formatearFecha(t.fechaLimiteInscripcion)}</span>`
      : '';

    /* ---------- BOTÓN DE ACCIÓN ---------- */
    let botonAccion = '';

    if (!user) {
      botonAccion = '';
    } else if (soyOrganizador) {
      botonAccion = mostrarAcciones ? `
        <button class="btn btn--ghost btn--sm" data-accion-torneo="editar" data-id="${t.id}">✏️ Editar</button>
        <button class="btn btn--ghost btn--sm" data-accion-torneo="gestionar" data-id="${t.id}">
          👥 Gestionar ${enEspera > 0 ? `<span class="badge badge--primary" style="margin-left:4px">${enEspera}</span>` : ''}
        </button>
        <button class="btn btn--ghost btn--sm" data-accion-torneo="eliminar" data-id="${t.id}" style="color:var(--color-danger)">🗑️</button>
      ` : '';
    } else if (miEquipoInscrito) {
      botonAccion = `
        <span class="badge badge--success" style="padding:8px 12px">✅ Ya estás inscrito</span>
        <button class="btn btn--ghost btn--sm"
                data-accion-torneo="salir"
                data-id="${t.id}"
                style="color:var(--color-danger)">
          🚪 Salirme
        </button>
      `;
    } else if (miSolicitudPendiente) {
      botonAccion = `
        <button class="btn btn--ghost btn--sm" disabled>⏳ Solicitud pendiente</button>
        <button class="btn btn--ghost btn--sm" data-accion-torneo="cancelar-solicitud" data-id="${t.id}" style="color:var(--color-danger)">Cancelar</button>
      `;
    } else if (miInvitacionPendiente) {
      botonAccion = `
        <button class="btn btn--primary btn--sm" data-accion-torneo="aceptar-invitacion" data-id="${t.id}">✅ Aceptar invitación</button>
        <button class="btn btn--ghost btn--sm" data-accion-torneo="rechazar-invitacion" data-id="${t.id}">Rechazar</button>
      `;
    } else if (cerrado || lleno) {
      botonAccion = `<span class="badge badge--neutral" style="padding:8px 12px">🔒 No disponible</span>`;
    } else {
      const textoBoton = t.tipoParticipacion === 'individual'
        ? '📝 Inscribirme'
        : '📝 Inscribir mi equipo';
      botonAccion = `<button class="btn btn--primary btn--sm" data-accion-torneo="inscribir" data-id="${t.id}">${textoBoton}</button>`;
    }

    const accionesHtml = botonAccion ? `
      <div class="match-card__acciones" style="display:flex; gap:6px; margin-top:var(--space-3); padding-top:var(--space-3); border-top:1px solid var(--color-border); flex-wrap:wrap">
        ${botonAccion}
      </div>
    ` : '';

    return `
      <article class="match-card" data-id="${t.id}" style="cursor:pointer">
        <div class="match-card__header">
          <div class="match-card__sport">${renderEmoji(t.emoji, 36)}</div>
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; justify-content:flex-end">
            ${badgeRolHtml}
            <span class="badge ${badgeClase}">${badgeTexto}</span>
          </div>
        </div>

        <h3 class="match-card__title">${t.nombre}</h3>

        <div class="flex gap-2 mb-4" style="flex-wrap:wrap">
          ${precioHtml}
          ${modalidadBadge}
          ${nivelBadge}
          ${tipoBadge}
          ${sistemaBadge}
        </div>

        <div class="match-card__info">
          <span>🏅 ${t.deporte}</span>
          <span>📅 ${formatearFecha(t.fechaInicio)}</span>
          ${t.lugar ? `<span>📍 ${t.lugar}</span>` : ''}
          ${fechaLimiteHtml}
          ${t.organizador?.id ? `
            <span data-autor-id="${t.organizador.id}" style="cursor:pointer; color:var(--color-primary-dark); text-decoration:underline">
              👤 ${t.organizador.nombre}
            </span>
          ` : ''}
        </div>

        <div class="match-card__footer">
          <div class="match-card__progress">
            <div class="match-card__progress-bar" style="width:${porcentaje}%"></div>
          </div>
          <span class="text-xs text-muted">${inscritosCount}/${t.cuposEquipos} ${t.tipoParticipacion === 'individual' ? 'participantes' : 'equipos'}</span>
        </div>

        ${accionesHtml}
      </article>
    `;
  }

  /* =========================================================
     RENDERS DE PANELES
     ========================================================= */
  function renderDisponibles() {
    let lista = torneos;

    if (filtroActual === 'individual')  lista = torneos.filter(t => t.tipoParticipacion === 'individual');
    if (filtroActual === 'equipo')      lista = torneos.filter(t => t.tipoParticipacion === 'equipo');
    if (filtroActual === 'inscripcion') lista = torneos.filter(t => t.estado === 'inscripcion');
    if (filtroActual === 'en_curso')    lista = torneos.filter(t => t.estado === 'en_curso');
    if (filtroActual === 'gratis')      lista = torneos.filter(t => t.precio === 0);

    if (lista.length === 0) {
      contDisponibles.innerHTML = `
        <div class="card" style="grid-column: 1 / -1;">
          <div class="empty-state">
            <div class="empty-state__icon">🏆</div>
            <p>No hay torneos con este filtro.</p>
          </div>
        </div>`;
      return;
    }

    contDisponibles.innerHTML = lista.map(t => renderCard(t)).join('');
    conectarClicksCards(contDisponibles);
    conectarAcciones(contDisponibles);
  }

  function renderCreados() {
    const misCreados = torneos.filter(t =>
      t.soyOrganizador || String(t.organizador?.id) === String(user?.id)
    );

    const countEl = document.getElementById('count-torneos-creados');
    if (countEl) countEl.textContent = misCreados.length;

    if (misCreados.length === 0) {
      contCreados.innerHTML = `
        <div class="card" style="grid-column: 1 / -1;">
          <div class="empty-state">
            <div class="empty-state__icon">👑</div>
            <p>Aún no has creado ningún torneo.</p>
            <button class="btn btn--primary mt-4" id="btn-vacio-crear-torneo">+ Crear mi primer torneo</button>
          </div>
        </div>`;
      document.getElementById('btn-vacio-crear-torneo')?.addEventListener('click', () => abrirModalCrear());
      return;
    }

    contCreados.innerHTML = misCreados.map(t =>
      renderCard(t, { mostrarAcciones: true, mostrarBadgeRol: '👑 Organizador' })
    ).join('');
    conectarClicksCards(contCreados);
    conectarAcciones(contCreados);
  }

  function renderInscritos() {
    const misInscritos = torneos.filter(t => {
      if (t.soyOrganizador || String(t.organizador?.id) === String(user?.id)) return false;
      return t.miEquipoInscrito || t.miSolicitudPendiente || t.miInvitacionPendiente;
    });

    const countEl = document.getElementById('count-torneos-inscritos');
    if (countEl) countEl.textContent = misInscritos.length;

    if (misInscritos.length === 0) {
      contInscritos.innerHTML = `
        <div class="card" style="grid-column: 1 / -1;">
          <div class="empty-state">
            <div class="empty-state__icon">✅</div>
            <p>No estás inscrito en ningún torneo.</p>
            <button class="btn btn--primary mt-4" id="btn-vacio-disponibles-torneos">Ver torneos disponibles</button>
          </div>
        </div>`;
      document.getElementById('btn-vacio-disponibles-torneos')?.addEventListener('click', () => cambiarTab('disponibles'));
      return;
    }

    contInscritos.innerHTML = misInscritos.map(t =>
      renderCard(t, { mostrarBadgeRol: '✅ Inscrito' })
    ).join('');
    conectarClicksCards(contInscritos);
    conectarAcciones(contInscritos);
  }

  /* =========================================================
     CONECTAR CLICKS
     ========================================================= */
  function conectarClicksCards(contenedor) {
    contenedor.querySelectorAll('.match-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-accion-torneo]')) return;
        if (e.target.closest('[data-autor-id]')) return;
        const id = card.dataset.id;
        window.location.hash = `#/torneo/${id}`;
      });
    });

    contenedor.querySelectorAll('[data-autor-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        import('../components.js').then(({ verPerfilUsuario }) => {
          verPerfilUsuario(el.dataset.autorId);
        });
      });
    });
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
          if (accion === 'editar') {
            abrirModalEditar(torneo);
            return;
          }

          if (accion === 'gestionar') {
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

          if (accion === 'inscribir') {
            if (torneo.tipoParticipacion === 'individual') {
              await inscribirEquipoAPI(id, null);
              toast('¡Inscripción exitosa!', 'success');
              await recargarTorneos();
              return;
            }

            const misEq = await misEquiposComoCapitanOAdmin();
            if (misEq.length === 0) {
              return toast('No tenés equipos disponibles', 'error');
            }

            const misEqDelDeporte = misEq.filter(eq => eq.deporte === torneo.deporte);
            if (misEqDelDeporte.length === 0) {
              return toast(`No tenés equipos de ${torneo.deporte}`, 'error');
            }

            let eqElegido = misEqDelDeporte[0];
            if (misEqDelDeporte.length > 1) {
              const opciones = misEqDelDeporte.map((eq, i) => `${i + 1}. ${eq.nombre}`).join('\n');
              const eleccion = prompt(`¿Con qué equipo?\n\n${opciones}\n\nEscribí el número:`);
              if (!eleccion) return;
              const idx = Number(eleccion) - 1;
              if (isNaN(idx) || !misEqDelDeporte[idx]) return toast('Opción inválida', 'error');
              eqElegido = misEqDelDeporte[idx];
            }

            await inscribirEquipoAPI(id, String(eqElegido.id));
            toast('¡Inscripción exitosa!', 'success');
            await recargarTorneos();
            return;
          }

          if (accion === 'cancelar-solicitud') {
            if (!confirm('¿Cancelar tu solicitud?')) return;

            if (torneo.tipoParticipacion === 'individual') {
              await cancelarInscripcionAPI(id, null);
              toast('Solicitud cancelada', 'info');
              await recargarTorneos();
              return;
            }

            const misEq = await misEquiposComoCapitanOAdmin();
            for (const eq of misEq) {
              try {
                await cancelarInscripcionAPI(id, String(eq.id));
              } catch (e) { /* ignora */ }
            }
            toast('Solicitud cancelada', 'info');
            await recargarTorneos();
            return;
          }

          if (accion === 'salir') {
            if (!confirm('¿Salirte de este torneo?')) return;

            if (torneo.tipoParticipacion === 'individual') {
              await cancelarInscripcionAPI(id, null);
              toast('Saliste del torneo', 'info');
              await recargarTorneos();
              return;
            }

            const misEq = await misEquiposComoCapitanOAdmin();
            for (const eq of misEq) {
              try {
                await cancelarInscripcionAPI(id, String(eq.id));
                toast('Saliste del torneo', 'info');
                await recargarTorneos();
                return;
              } catch (e) { /* siguiente */ }
            }
            toast('No se pudo salir del torneo', 'error');
            return;
          }

          if (accion === 'aceptar-invitacion' || accion === 'rechazar-invitacion') {
            const aceptar = accion === 'aceptar-invitacion';
            const misEq = await misEquiposComoCapitanOAdmin();
            for (const eq of misEq) {
              try {
                const { responderInvitacion } = await import('../services/torneos.service.js');
                await responderInvitacion(id, String(eq.id), aceptar);
                toast(aceptar ? 'Invitación aceptada' : 'Invitación rechazada', aceptar ? 'success' : 'info');
                await recargarTorneos();
                return;
              } catch (e) { /* siguiente */ }
            }
            if (aceptar) toast('No se pudo aceptar la invitación', 'error');
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
  }
  subtabs.forEach(st => st.addEventListener('click', () => cambiarTab(st.dataset.tabTorneos)));

  function handleChip(e) {
    chips.forEach(c => c.classList.remove('chip--active'));
    e.currentTarget.classList.add('chip--active');
    filtroActual = e.currentTarget.dataset.filtroTorneo;
    renderDisponibles();
  }
  chips.forEach(c => c.addEventListener('click', handleChip));

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

  // ⚡ Fixture
  const checkIdaVuelta      = document.getElementById('torneo-ida-vuelta');
  const autoFixtureWrapper  = document.getElementById('auto-fixture-wrapper');
  const checkAutoFixture    = document.getElementById('torneo-auto-fixture');

  // ⚡ NUEVO D.5: sistema de clasificación
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

  /* =========================================================
     AUTO-FIXTURE VISIBILITY
     ========================================================= */
  function actualizarAutoFixtureVisibility() {
    if (!autoFixtureWrapper) return;

    if (modalidadSeleccionada === 'eliminacion') {
      autoFixtureWrapper.classList.remove('hidden');
    } else {
      autoFixtureWrapper.classList.add('hidden');
      if (checkAutoFixture) checkAutoFixture.checked = false;
    }
  }

  /* =========================================================
     ⚡ SISTEMA DE CLASIFICACIÓN (D.5)
     =========================================================
     Reglas:
     - Si el deporte es de tiempo o puntos → mostrar selector,
       preseleccionar el sistema correspondiente.
     - Si el deporte es "normal" (fútbol, básquet, vóley, etc.)
       → ocultar selector y forzar 'simple'.
     - El usuario igual puede cambiarlo manualmente si el
       selector está visible.
     ========================================================= */
/* =========================================================
   ⚡ SISTEMA DE CLASIFICACIÓN (D.5)
   =========================================================
   Reglas:
   - El selector SIEMPRE está visible.
   - Se preselecciona el sistema sugerido según el deporte:
     * tiempo  → Natación, Atletismo, Ciclismo
     * puntos  → Escalada, Surf, Boxeo
     * simple  → el resto
   - El usuario puede cambiarlo manualmente cuando quiera.
   ========================================================= */
  function actualizarSistemaClasificacion(deporte) {
    if (!sistemaWrapper || !sistemaGrid) return;

    // Siempre mostrar el wrapper (ya no se oculta por deporte)
    sistemaWrapper.classList.remove('hidden');

    // Determinar el sistema sugerido
    let sistemaSugerido = 'simple';

    if (deporte) {
      if (DEPORTES_TIEMPO.has(deporte)) {
        sistemaSugerido = 'tiempo';
      } else if (DEPORTES_PUNTOS.has(deporte)) {
        sistemaSugerido = 'puntos';
      }
    }

    sistemaClasificacionSeleccionado = sistemaSugerido;

    opcionesSistema.forEach(op => {
      op.classList.toggle(
        'active',
        op.dataset.sistemaClasificacion === sistemaSugerido
      );
    });

    actualizarHintSistema();
  }

  function actualizarHintSistema() {
    if (!sistemaHint) return;

    const textos = {
      simple: '🎯 Se juega con marcador (goles, puntos, sets).',
      tiempo: '⏱️ El MENOR tiempo gana. El organizador carga minutos, segundos y centésimas.',
      puntos: '🏅 El MAYOR puntaje gana.',
    };

    sistemaHint.textContent = textos[sistemaClasificacionSeleccionado] || '';
  }

  /* ---------- Click en cada opción de sistema ---------- */
  opcionesSistema.forEach(op => {
    op.addEventListener('click', () => {
      opcionesSistema.forEach(o => o.classList.remove('active'));
      op.classList.add('active');
      sistemaClasificacionSeleccionado = op.dataset.sistemaClasificacion;
      actualizarHintSistema();
    });
  });

  /* ---------- Cambio de tipo de participación ---------- */
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
      hintTipoParticipacion.textContent = '👤 Los usuarios se inscriben solos, sin necesidad de equipo.';
    } else {
      hintTipoParticipacion.textContent = '👥 Los equipos se inscriben al torneo (capitán o admin).';
    }
  }

  /* ---------- Autoselección por deporte ---------- */
  selectDeporte?.addEventListener('change', () => {
    const deporte = selectDeporte.value;
    if (!deporte) {
      actualizarSistemaClasificacion('');
      return;
    }

    // Auto-seleccionar tipo de participación si el deporte es individual
    if (DEPORTES_INDIVIDUALES.has(deporte)) {
      opcionesTipoParticipacion.forEach(op => {
        op.classList.toggle('active', op.dataset.tipoParticipacion === 'individual');
      });
      tipoParticipacionSeleccionado = 'individual';
      actualizarHintTipoParticipacion();
    }

    // ⚡ NUEVO: actualizar el selector de sistema
    actualizarSistemaClasificacion(deporte);
  });

  /* ---------- NIVEL DEL TORNEO ---------- */
  const NIVELES_TORNEO = [
    { valor: 'amistoso', label: 'Amistoso', descripcion: 'Sin exigencia' },
    { valor: 'semiprofesional', label: 'Semiprofesional', descripcion: 'Nivel intermedio' },
    { valor: 'profesional', label: 'Profesional', descripcion: 'Alto nivel' },
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

  /* ---------- LIBRE INSCRIPCIÓN ---------- */
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

    // Modalidad (default: liga)
    modalidadSeleccionada = 'liga';
    esEdicion = false;
    opcionesModalidad.forEach(op => {
      op.classList.toggle('active', op.dataset.modalidad === 'liga');
    });
    actualizarConfiguracionPorModalidad();
    actualizarAutoFixtureVisibility();

    // Tipo de participación (default: equipo)
    tipoParticipacionSeleccionado = 'equipo';
    opcionesTipoParticipacion.forEach(op => {
      op.classList.toggle('active', op.dataset.tipoParticipacion === 'equipo');
    });
    actualizarHintTipoParticipacion();

    // ⚡ Sistema de clasificación (default: simple, visible siempre)
    sistemaClasificacionSeleccionado = 'simple';
    opcionesSistema.forEach(op => {
      op.classList.toggle('active', op.dataset.sistemaClasificacion === 'simple');
    });
    sistemaWrapper?.classList.remove('hidden');

    // Nivel (default: amistoso)
    nivelTorneoSeleccionado = 'amistoso';
    if (nivelGridTorneo) {
      nivelGridTorneo.querySelectorAll('[data-nivel-torneo]').forEach(op => {
        op.classList.toggle('active', op.dataset.nivelTorneo === 'amistoso');
      });
    }
    if (checkLibreInsc) checkLibreInsc.checked = true;
    actualizarLibreInscripcion();

    // AutoFixture (default: false)
    if (checkAutoFixture) checkAutoFixture.checked = false;

    // Configuración avanzada
    if (inputPuntosVictoria) inputPuntosVictoria.value = '3';
    if (inputPuntosEmpate)   inputPuntosEmpate.value = '1';
    if (inputPuntosDerrota)  inputPuntosDerrota.value = '0';
    if (checkPermiteEmpate)  checkPermiteEmpate.checked = true;
    if (checkIdaVuelta)      checkIdaVuelta.checked = false;
    if (inputEquiposClasif)  inputEquiposClasif.value = '';
    if (checkIncluyeEstad)   checkIncluyeEstad.checked = false;
  }

  /* ---------- Abrir modal crear ---------- */
  function abrirModalCrear() {
    resetearFormulario();
    document.getElementById('torneo-modal-titulo').textContent = 'Crear torneo';
    document.getElementById('btn-guardar-torneo').textContent = 'Crear torneo';
    document.getElementById('btn-guardar-torneo').onclick = guardarNuevo;
    abrirModal('modal-crear-torneo');
  }

  /* ---------- Abrir modal editar ---------- */
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

    // Modalidad
    esEdicion = true;
    modalidadSeleccionada = torneo.modalidad || 'liga';
    opcionesModalidad.forEach(op => {
      op.classList.toggle('active', op.dataset.modalidad === modalidadSeleccionada);
    });
    actualizarConfiguracionPorModalidad();

    // AutoFixture
    if (checkAutoFixture) checkAutoFixture.checked = torneo.autoFixture === true;
    actualizarAutoFixtureVisibility();

    // Tipo de participación
    tipoParticipacionSeleccionado = torneo.tipoParticipacion || 'equipo';
    opcionesTipoParticipacion.forEach(op => {
      op.classList.toggle('active', op.dataset.tipoParticipacion === tipoParticipacionSeleccionado);
    });
    actualizarHintTipoParticipacion();

    // ⚡ Sistema de clasificación: primero sugerido por deporte, después el guardado.
    actualizarSistemaClasificacion(torneo.deporte);

    const sistemaGuardado = torneo.sistemaClasificacion || 'simple';
    sistemaClasificacionSeleccionado = sistemaGuardado;

    opcionesSistema.forEach(op => {
      op.classList.toggle('active', op.dataset.sistemaClasificacion === sistemaGuardado);
    });
    actualizarHintSistema();

    // Nivel
    nivelTorneoSeleccionado = torneo.nivel || 'amistoso';
    if (nivelGridTorneo) {
      nivelGridTorneo.querySelectorAll('[data-nivel-torneo]').forEach(op => {
        op.classList.toggle('active', op.dataset.nivelTorneo === nivelTorneoSeleccionado);
      });
    }
    if (checkLibreInsc) checkLibreInsc.checked = torneo.libreInscripcion !== false;
    actualizarLibreInscripcion();

    // Configuración avanzada
    if (inputPuntosVictoria) inputPuntosVictoria.value = String(torneo.puntosVictoria ?? 3);
    if (inputPuntosEmpate)   inputPuntosEmpate.value = String(torneo.puntosEmpate ?? 1);
    if (inputPuntosDerrota)  inputPuntosDerrota.value = String(torneo.puntosDerrota ?? 0);
    if (checkPermiteEmpate)  checkPermiteEmpate.checked = torneo.permiteEmpate !== false;
    if (checkIdaVuelta)      checkIdaVuelta.checked = torneo.idaYVuelta === true;
    if (inputEquiposClasif)  inputEquiposClasif.value = torneo.equiposClasifican ?? '';
    if (checkIncluyeEstad)   checkIncluyeEstad.checked = !!torneo.incluyeEstadisticas;

    document.getElementById('btn-guardar-torneo').onclick = () => guardarEdicion(torneo);
    abrirModal('modal-crear-torneo');
  }

  /* ---------- Guardar nuevo ---------- */
  async function guardarNuevo() {
    const datos = leerFormulario();
    if (!datos) return;

    const emoji = emojiDeporte[datos.deporte] || '🏆';

    const btn = document.getElementById('btn-guardar-torneo');
    btn.disabled = true;
    btn.textContent = 'Creando...';

    try {
      await crearTorneoAPI({ ...datos, emoji });
      toast('¡Torneo creado!', 'success');

      cerrarModal('modal-crear-torneo');

      filtroActual = 'todos';
      chips.forEach(c => c.classList.toggle('chip--active', c.dataset.filtroTorneo === 'todos'));
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

  /* ---------- Guardar edición ---------- */
  async function guardarEdicion(torneo) {
    const datos = leerFormulario();
    if (!datos) return;

    const emoji = emojiDeporte[datos.deporte] || '🏆';

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

  /* ---------- Leer formulario ---------- */
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

    // ⚡ Sistema de clasificación
    // Ahora siempre está visible, usamos lo que tenga seleccionado.
    const sistemaClasificacion = sistemaClasificacionSeleccionado || 'simple';

    // Coherencia: si el deporte es de tiempo, no permitir 'puntos' salvo override explícito
    // (dejamos override libre, el organizador sabe lo que hace)

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

      // ⚡ NUEVO
      sistemaClasificacion,

      puntosVictoria,
      puntosEmpate,
      puntosDerrota,
      permiteEmpate,
      equiposClasifican,
      incluyeEstadisticas,
    };
  }

  /* ---------- CONECTAR BOTONES CREAR ---------- */
  btnCrear?.addEventListener('click', abrirModalCrear);
  btnCrear2?.addEventListener('click', abrirModalCrear);

  document.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
    btn.addEventListener('click', () => cerrarModal(btn.dataset.cerrarModal));
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.remove('open');
    });
  });

  /* ---------- ESCUCHAR EVENTO PARA ABRIR EDITAR DESDE EL DETALLE ---------- */
  window.addEventListener('abrir-editar-torneo', (e) => {
    const torneo = e.detail;
    if (torneo) abrirModalEditar(torneo);
  });

  /* ---------- SI VENIMOS DEL DETALLE CON TORNEO A EDITAR ---------- */
  const torneoAEditar = sessionStorage.getItem('torneoAEditar');
  if (torneoAEditar) {
    setTimeout(async () => {
      const torneo = torneos.find(t => String(t.id) === String(torneoAEditar));
      if (torneo) {
        sessionStorage.removeItem('torneoAEditar');
        abrirModalEditar(torneo);
      }
    }, 300);
  }

  /* =========================================================
     RENDER INICIAL
     ========================================================= */
  async function renderTodo() {
    await recargarTorneos();
  }

  await renderTodo();

  return () => {
    chips.forEach(c => c.removeEventListener('click', handleChip));
  };
}