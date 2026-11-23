import { formatearFecha, toast, abrirModal, cerrarModal } from '../components.js';
import { deportes, posicionesPorDeporte, nivelesPartido } from '../data-mock.js';
import { getSesion } from '../auth.js';
import { listarGrupos } from '../services/grupos.service.js';
import { api } from '../api.js';
import { ICONOS } from '../utils/iconos.js';
import {
  listarPartidos,
  crearPartido as crearPartidoAPI,
  eliminarPartido as eliminarPartidoAPI,
  guardarPartido as guardarPartidoAPI,
  salirEquipoDelPartido as salirEquipoDelPartidoAPI,
  inscribirse as inscribirseAPI,
  salirDelPartido as salirDelPartidoAPI,
  postularse as postularseAPI,
  cancelarPostulacion as cancelarPostulacionAPI,
  postularEquipo as postularEquipoAPI,
  interesarse as interesarseAPI,
  cancelarInteres as cancelarInteresAPI,
} from '../services/partidos.service.js';

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

export async function init() {
  console.log('[partidos] init() arrancó');

  let partidos = [];
  let filtroActual = 'todos';
  let filtroTipoActual = 'todos';
  let filtroBusqueda = '';
  let filtroFechaDesde = ''; // ⚡ NUEVO
  let filtroFechaHasta = ''; // ⚡ NUEVO
  let filtroFechaRapido = 'todos'; // ⚡ NUEVO
  let tabActual = 'disponibles';
  const user = getSesion();

  try {
    const { data } = await listarPartidos({ limit: 50 });
    partidos = data;
    // Mis creados deben verse aunque no esten entre los 50 primeros del feed.
    if (user) {
      try {
        const { data: creados } = await listarPartidos({ soloMios: 'true', limit: 50 });
        const ids = new Set(partidos.map(p => String(p.id)));
        for (const creado of creados || []) {
          if (!ids.has(String(creado.id))) { partidos.push(creado); ids.add(String(creado.id)); }
        }
      } catch (err) { console.warn('[partidos] No se pudieron ampliar Mis creados:', err.message); }
    }
    console.log('[partidos] Cargados desde backend:', partidos.length);
  } catch (err) {
    console.error('[partidos] Error al cargar:', err);
    toast('No se pudieron cargar los partidos', 'error');
    partidos = [];
  }

  const contDisponibles  = document.getElementById('lista-partidos');
  const contCreados      = document.getElementById('lista-creados');
  const contInscritos    = document.getElementById('lista-inscritos');
  const panelDisponibles = document.getElementById('panel-disponibles');
  const panelCreados     = document.getElementById('panel-creados');
  const panelInscritos   = document.getElementById('panel-inscritos');
  const subtabs          = document.querySelectorAll('[data-tab-partidos]');
  const selectEstado     = document.getElementById('select-filtro-estado');
  const selectTipo       = document.getElementById('select-filtro-tipo');
  const btnCrear         = document.getElementById('btn-crear-partido');
  const inputBuscar      = document.getElementById('buscar-partidos');

  if (!contDisponibles) return null;

  const eyebrow = document.getElementById('partidos-eyebrow');
  if (eyebrow) {
    const hoy = new Date();
    const dias = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
                   'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    eyebrow.textContent =
      `${dias[hoy.getDay()]}, ${hoy.getDate()} DE ${meses[hoy.getMonth()]}`;
  }

  async function misEquiposComoCapitanOAdmin() {
    try {
      const { data } = await listarGrupos({ tipo: 'equipo', soloMios: 'true', limit: 50 });
      return data || [];
    } catch (err) {
      console.error('[partidos] Error al cargar equipos:', err);
      return [];
    }
  }

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

  function cantidadInscritos(p) {
    return Array.isArray(p.inscritos) ? p.inscritos.length : (p.inscritos || 0);
  }

  function esDeEquipo(p) {
    return p.tipoPartido === 'equipo';
  }

  function esModoOrganizar(p) {
    return p.estadoPartido === 'buscando_jugadores';
  }

  function estaConfirmado(p) {
    return p.estadoPartido === 'confirmado';
  }

  function totalInscritosReal(p) {
    if (esDeEquipo(p)) {
      return p.totalEquiposInscritos ?? (p.equiposInscritos || []).length;
    }
    return p.totalInscritos ?? cantidadInscritos(p);
  }

  function renderEmoji(emoji) {
    if (!emoji) return '🏅';
    if (typeof emoji === 'string' && /\.(svg|png|jpg|jpeg|gif|webp)$/i.test(emoji)) {
      return `<img src="${emoji}" alt="" />`;
    }
    return emoji;
  }

  function renderCard(p, opciones = {}) {
    try {
      const { mostrarBadgeRol = null } = opciones;
      const color = colorDeporte(p.deporte);
      
      const totalInsc = totalInscritosReal(p);
      const esLleno = totalInsc >= p.cupos;
      const porcentaje = Math.min(100, Math.round((totalInsc / p.cupos) * 100));
      
      const deEquipo = esDeEquipo(p);
      const enModoOrganizar = esModoOrganizar(p);
      const confirmado = estaConfirmado(p);
      const soyOrganizador = String(p.organizador?.id) === String(user?.id);

      const yoEstoyInscrito = !!p.yoInscrito;
      const yoPostule = !!p.yoPostule;
      const miEquipoInscrito = !!p.miEquipoInscrito;
      const miEquipoPostulado = !!p.miEquipoPostulado;
      const yoInteresado = !!p.yoInteresado;

      // ⚡ Usamos esLleno calculado dinámicamente
      const badgeClase = enModoOrganizar ? 'badge--warning' : esLleno ? 'badge--danger' : p.estado === 'finalizado' ? 'badge--neutral' : 'badge--success';
      const badgeTexto = enModoOrganizar ? 'Organizando' : esLleno ? 'Lleno' : p.estado === 'finalizado' ? 'Finalizado' : 'Abierto';
      
      const nivelLabel = { amistoso: 'Amistoso', medio: 'Nivel Medio', avanzado: 'Nivel Avanzado' }[p.nivel] || p.nivel;
      const precioTexto = enModoOrganizar ? 'A coordinar' : (p.precio === 0 ? 'Gratis' : `$${p.precio.toLocaleString('es-CL')}`);
      const cuposLibres = Math.max(0, p.cupos - totalInsc);
      const fechaTexto = enModoOrganizar ? 'A coordinar' : formatearFecha(p.fecha);
      const lugarTexto = enModoOrganizar ? 'A coordinar' : (p.lugar || 'Sin lugar');
      const orgNombre = p.organizador?.nombre || 'Organizador';

      let botonPrincipal = '';
      let botonSecundario = '';

      if (!user) {
        botonPrincipal = '';
      } else if (soyOrganizador) {
        botonPrincipal = `<button class="btn btn--primary btn--sm" data-accion="ver" data-id="${p.id}">Ver partido</button>`;
        botonSecundario = p.guardadoPorCreador
          ? `<span class="badge badge--success" style="padding:6px">Guardado</span>`
          : `<button class="btn btn--ghost btn--sm" data-accion="guardar" data-id="${p.id}">Guardar partido</button>`;
      } else if (enModoOrganizar) {
        if (yoInteresado) {
          botonPrincipal = `<span class="badge badge--warning" style="padding:8px 12px">${ICONOS.mano} Interesado</span>`;
          botonSecundario = `<button class="btn btn--ghost btn--sm" data-accion="cancelar-interes" data-id="${p.id}">Cancelar interés</button>`;
        } else {
          if (deEquipo) {
            botonPrincipal = `<button class="btn btn--primary btn--sm" data-accion="interesarse" data-id="${p.id}">${ICONOS.mano} Interesarse con equipo</button>`;
          } else {
            botonPrincipal = `<button class="btn btn--primary btn--sm" data-accion="interesarse" data-id="${p.id}">${ICONOS.mano} Me interesa</button>`;
          }
        }
      } else if (deEquipo) {
        if (miEquipoInscrito) {
          botonPrincipal = `<span class="badge badge--success" style="padding:8px 12px">${ICONOS.check} Tu equipo está inscrito</span>`;
          botonSecundario = `<button class="btn btn--ghost btn--sm" data-accion="desinscribirse" data-id="${p.id}" style="color:var(--color-danger)">Salir</button>`;
        } else if (miEquipoPostulado) {
          botonPrincipal = `<button class="btn btn--ghost btn--sm" disabled>${ICONOS.reloj} Pendiente</button>`;
          botonSecundario = `<button class="btn btn--ghost btn--sm" data-accion="cancelar-postulacion-equipo" data-id="${p.id}" style="color:var(--color-danger)">Cancelar</button>`;
        } else if (yoInteresado) {
          botonPrincipal = `<span class="badge badge--warning">Interesado</span>`;
          botonSecundario = `<button class="btn btn--ghost btn--sm" data-accion="cancelar-interes" data-id="${p.id}">Cancelar interés</button>`;
        } else if (p.estado !== 'finalizado' && !esLleno) {
          botonPrincipal = `<button class="btn btn--primary btn--sm" data-accion="postular-equipo" data-id="${p.id}">${p.aprobacionRequerida ? ICONOS.documento : ICONOS.check} ${p.aprobacionRequerida ? 'Solicitar inscripción' : 'Inscribir equipo'}</button>`;
        } else {
          botonPrincipal = `<span class="badge badge--neutral" style="padding:8px 12px">${ICONOS.candado} No disponible</span>`;
        }
      } else {
        if (yoEstoyInscrito) {
          botonPrincipal = `<span class="badge badge--success" style="padding:8px 12px">${ICONOS.check} Inscrito</span>`;
          botonSecundario = `<button class="btn btn--ghost btn--sm" data-accion="desinscribirse" data-id="${p.id}" style="color:var(--color-danger)">Salir</button>`;
        } else if (yoPostule) {
          botonPrincipal = `<button class="btn btn--ghost btn--sm" disabled>${ICONOS.reloj} Pendiente</button>`;
          botonSecundario = `<button class="btn btn--ghost btn--sm" data-accion="cancelar-postulacion" data-id="${p.id}" style="color:var(--color-danger)">Cancelar</button>`;
        } else if (yoInteresado) {
          botonPrincipal = `<span class="badge badge--warning">Interesado</span>`;
          botonSecundario = `<button class="btn btn--ghost btn--sm" data-accion="cancelar-interes" data-id="${p.id}">Cancelar interés</button>`;
        } else if (p.estado !== 'finalizado' && !esLleno) {
          botonPrincipal = p.aprobacionRequerida ? `<button class="btn btn--primary btn--sm" data-accion="postularse" data-id="${p.id}">${ICONOS.documento} Postularme</button>` : `<button class="btn btn--primary btn--sm" data-accion="inscribirse" data-id="${p.id}">${ICONOS.check} Inscribirme</button>`;
        } else {
          botonPrincipal = `<span class="badge badge--neutral" style="padding:8px 12px">${ICONOS.candado} No disponible</span>`;
        }
      }

      const botonesHtml = (botonPrincipal || botonSecundario) ? `
        <div class="match-card__acciones-col">
          ${botonPrincipal}
          <div class="match-card__precio-corner">${precioTexto}</div>
          ${botonSecundario}
        </div>
      ` : '';

      const lapizHtml = (soyOrganizador && !p.bloqueado) ? `<button class="match-card__edit" data-accion="editar" data-id="${p.id}" title="Editar partido">${ICONOS.lapiz}</button>` : '';
      const deporteSlug = slugDeporte(p.deporte);

      return `
        <article class="match-card" data-id="${p.id}" data-deporte="${deporteSlug}" style="--deporte-bg: ${color.bg}; --deporte-fg: ${color.fg};">
          ${lapizHtml}
          <div class="match-card__badges-top">
            <span class="badge ${badgeClase}">${badgeTexto}</span>
            <span class="badge badge--neutral">${nivelLabel}</span>
            ${mostrarBadgeRol ? `<span class="badge badge--primary">${mostrarBadgeRol}</span>` : ''}
          </div>

          <div class="match-card__left">
            <div class="match-card__sport">${renderEmoji(p.emoji)}</div>
            <div class="match-card__content">
              <h3 class="match-card__title">${p.titulo}</h3>
              <div class="match-card__meta">
                <span>${ICONOS.calendario} ${fechaTexto}</span>
                <span>${ICONOS.ubicacion} ${lugarTexto}</span>
                <span>${ICONOS.usuario} Organiza ${orgNombre}</span>
              </div>
              <div class="match-card__progress-row">
                <span class="match-card__progress-label">${totalInsc} de ${p.cupos} ${deEquipo ? 'equipos' : 'jugadores'}</span>
                ${cuposLibres > 0 ? `<span class="match-card__cupos match-card__cupos--disponibles">${cuposLibres} cupos libres</span>` : `<span class="match-card__cupos match-card__cupos--lleno">Sin cupos</span>`}
              </div>
              <div class="match-card__progress"><div class="match-card__progress-bar" style="width:${porcentaje}%"></div></div>
            </div>
          </div>
          ${botonesHtml}
        </article>
      `;
    } catch (err) {
      console.error('[partidos] Error renderizando card:', err, p);
      return '';
    }
  }

  async function recargarPartidos() {
    try {
      const filtros = { limit: 50 };
      // ⚡ NUEVO: enviar filtros de fecha al backend
      if (filtroFechaDesde) filtros.desde = filtroFechaDesde;
      if (filtroFechaHasta) filtros.hasta = filtroFechaHasta;

      const { data } = await listarPartidos(filtros);
      partidos = data;
      if (user) {
        try {
          const { data: creados } = await listarPartidos({ soloMios: 'true', limit: 50 });
          const ids = new Set(partidos.map(p => String(p.id)));
          for (const creado of creados || []) {
            if (!ids.has(String(creado.id))) { partidos.push(creado); ids.add(String(creado.id)); }
          }
        } catch (err) { console.warn('[partidos] No se pudieron ampliar Mis creados:', err.message); }
      }
      renderDisponibles();
      renderCreados();
      renderInscritos();
    } catch (err) {
      console.warn('[partidos] No se pudo recargar:', err.message);
    }
  }

  function renderDisponibles() {
    try {
      let lista = partidos.filter(p => !(p.guardadoPorCreador && p.archivoVencido));

      // ⚡ Lógica de filtros robusta usando totalInscritosReal
      if (filtroActual === 'abiertos') {
        lista = lista.filter(p => totalInscritosReal(p) < p.cupos && p.estado !== 'finalizado' && !esModoOrganizar(p));
      }
      if (filtroActual === 'llenos') {
        lista = lista.filter(p => totalInscritosReal(p) >= p.cupos && p.estado !== 'finalizado' && !esModoOrganizar(p));
      }
      if (filtroActual === 'finalizados') {
        lista = lista.filter(p => p.estado === 'finalizado');
      }
      if (filtroActual === 'organizando') {
        lista = lista.filter(p => esModoOrganizar(p));
      }
      if (filtroActual === 'confirmados') {
        lista = lista.filter(p => estaConfirmado(p));
      }

      if (filtroTipoActual === 'jugador')  lista = lista.filter(p => !esDeEquipo(p));
      if (filtroTipoActual === 'equipo')   lista = lista.filter(p => esDeEquipo(p));

      if (filtroBusqueda.trim()) {
        const q = filtroBusqueda.toLowerCase().trim();
        lista = lista.filter(p =>
          (p.titulo || '').toLowerCase().includes(q) ||
          (p.deporte || '').toLowerCase().includes(q) ||
          (p.lugar || '').toLowerCase().includes(q)
        );
      }

      if (lista.length === 0) {
        contDisponibles.innerHTML = `
          <div class="card" style="grid-column: 1 / -1;">
            <div class="empty-state">
              <div class="empty-state__icon">🔍</div>
              <p>No hay partidos con estos filtros.</p>
            </div>
          </div>`;
        return;
      }

      contDisponibles.innerHTML = lista.map(p => renderCard(p)).join('');
      conectarClicksCards(contDisponibles);
      conectarAccionesCard(contDisponibles);
    } catch (err) {
      console.error('[partidos] ERROR en renderDisponibles:', err);
    }
  }

  function renderCreados() {
    try {
      const misCreados = partidos.filter(p => String(p.organizador?.id) === String(user?.id));
      const countEl = document.getElementById('count-creados');
      if (countEl) countEl.textContent = misCreados.length;

      if (!contCreados) return;

      if (misCreados.length === 0) {
        contCreados.innerHTML = `
          <div class="card" style="grid-column: 1 / -1;">
            <div class="empty-state">
              <div class="empty-state__icon">${ICONOS.corona}</div>
              <p>Aún no has creado ningún partido.</p>
              <button class="btn btn--primary mt-4" id="btn-vacio-crear">+ Crear mi primer partido</button>
            </div>
          </div>`;
        document.getElementById('btn-vacio-crear')?.addEventListener('click', () => abrirModalCrear());
        return;
      }

      contCreados.innerHTML = misCreados.map(p => renderCard(p, { mostrarBadgeRol: `${ICONOS.corona} Organizador` })).join('');
      conectarClicksCards(contCreados);
      conectarAccionesCard(contCreados);
    } catch (err) {
      console.error('[partidos] ERROR en renderCreados:', err);
    }
  }

  function renderInscritos() {
    try {
      const misInscritos = partidos.filter(p => {
        if (String(p.organizador?.id) === String(user?.id)) return false;
        if (!esDeEquipo(p)) return !!p.yoInscrito || !!p.yoPostule || !!p.yoInteresado;
        return !!p.miEquipoInscrito || !!p.miEquipoPostulado || !!p.yoInteresado;
      });

      const countEl = document.getElementById('count-inscritos');
      if (countEl) countEl.textContent = misInscritos.length;

      if (!contInscritos) return;

      if (misInscritos.length === 0) {
        contInscritos.innerHTML = `
          <div class="card" style="grid-column: 1 / -1;">
            <div class="empty-state">
              <div class="empty-state__icon">${ICONOS.check}</div>
              <p>No estás inscrito en ningún partido todavía.</p>
              <button class="btn btn--primary mt-4" id="btn-vacio-disponibles">Ver partidos disponibles</button>
            </div>
          </div>`;
        document.getElementById('btn-vacio-disponibles')?.addEventListener('click', () => cambiarTab('disponibles'));
        return;
      }

      contInscritos.innerHTML = misInscritos.map(p => renderCard(p, { mostrarBadgeRol: `${ICONOS.check} Inscrito` })).join('');
      conectarClicksCards(contInscritos);
      conectarAccionesCard(contInscritos);
    } catch (err) {
      console.error('[partidos] ERROR en renderInscritos:', err);
    }
  }

  function conectarClicksCards(contenedor) {
    contenedor.querySelectorAll('.match-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-accion]')) return;
        window.location.hash = `#/partido/${card.dataset.id}`;
      });
    });
  }

  function conectarAccionesCard(contenedor) {
    contenedor.querySelectorAll('[data-accion]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const accion = btn.dataset.accion;

        try {
          if (accion === 'ver') {
            window.location.hash = `#/partido/${id}`;
            return;
          }

          if (accion === 'editar') {
            sessionStorage.setItem('partidoAEditar', String(id));
            window.location.hash = `#/partido/${id}`;
            return;
          }

          if (accion === 'guardar') {
            if (!confirm('¿Conservar este partido en Mis creados cuando venza?')) return;
            await guardarPartidoAPI(id);
            toast('Partido guardado en Mis creados', 'success');
            await recargarPartidos();
            return;
          }

          if (accion === 'eliminar') {
            if (!confirm('¿Eliminar este partido?')) return;
            await eliminarPartidoAPI(id);
            toast('Partido eliminado', 'info');
            await recargarPartidos();
            return;
          }

          if (accion === 'inscribirse') {
            await inscribirseAPI(id);
            toast('¡Te inscribiste!', 'success');
            await recargarPartidos();
            return;
          }

          if (accion === 'desinscribirse') {
            if (!confirm('¿Salir del partido?')) return;
            const partido = partidos.find(p => String(p.id) === String(id));
            const equipoId = partido?.tipoPartido === 'equipo' ? partido.miEquipoInscritoId : null;
            const resultado = equipoId
              ? await salirEquipoDelPartidoAPI(id, equipoId)
              : await salirDelPartidoAPI(id);
            toast(resultado?.mensaje || 'Saliste del partido', 'info');
            await recargarPartidos();
            return;
          }

          if (accion === 'postularse') {
            const partido = partidos.find(p => String(p.id) === String(id));
            let posicion = null;
            if (partido?.pedirPosiciones && partido.posiciones?.length > 0) {
              const pos = prompt(`Ellge tu posición:\n${partido.posiciones.join(', ')}`);
              if (!pos) return;
              posicion = pos;
            }
            await postularseAPI(id, posicion);
            toast('Postulación enviada', 'success');
            await recargarPartidos();
            return;
          }

          if (accion === 'cancelar-postulacion') {
            if (!confirm('¿Cancelar tu postulación?')) return;
            await cancelarPostulacionAPI(id);
            toast('Postulación cancelada', 'info');
            await recargarPartidos();
            return;
          }

          if (accion === 'postular-equipo') {
            const partido = partidos.find(p => String(p.id) === String(id));
            const { data: todosEquipos } = await listarGrupos({ tipo: 'equipo', soloMios: 'true', limit: 50 });
            const misEquipos = (todosEquipos || []).filter(g => g.deporte === partido.deporte);

            if (misEquipos.length === 0) {
              return toast('No tienes equipos de ' + partido.deporte, 'error');
            }

            let eqElegido = misEquipos[0];
            if (misEquipos.length > 1) {
              const opciones = misEquipos.map((eq, i) => `${i + 1}. ${eq.nombre}`).join('\n');
              const eleccion = prompt(`¿Con qué equipo?\n\n${opciones}\n\Escribe el número:`);
              if (!eleccion) return;
              const idx = Number(eleccion) - 1;
              if (isNaN(idx) || !misEquipos[idx]) return toast('Opción inválida', 'error');
              eqElegido = misEquipos[idx];
            }

            await postularEquipoAPI(id, String(eqElegido.id));
            toast(partido.aprobacionRequerida ? 'Solicitud enviada a la lista de espera' : 'Equipo inscrito correctamente', 'success');
            await recargarPartidos();
            return;
          }

          if (accion === 'cancelar-postulacion-equipo') {
            if (!confirm('¿Cancelar la postulación del equipo?')) return;
            const partido = partidos.find(p => String(p.id) === String(id));
            if (!partido) return toast('Partido no encontrado', 'error');
            const equipoId = partido.miEquipoPostuladoId;
            if (!equipoId) return toast('No hay postulación pendiente para cancelar', 'error');
            await api.delete(`/partidos/${id}/equipos-postulantes/${equipoId}`);
            toast('Postulación cancelada', 'info');
            await recargarPartidos();
            return;
          }

          if (accion === 'interesarse') {
            const partido = partidos.find(p => String(p.id) === String(id));
            if (!partido) return;

            let equipoId = null;
            if (partido.tipoPartido === 'equipo') {
              const { data: todosEquipos } = await listarGrupos({ tipo: 'equipo', soloMios: 'true', limit: 50 });
              const misEquiposDeporte = (todosEquipos || []).filter(g => g.deporte === partido.deporte);

              if (misEquiposDeporte.length === 0) {
                return toast('No tienes equipos de ' + partido.deporte, 'error');
              }

              let eqElegido = misEquiposDeporte[0];
              if (misEquiposDeporte.length > 1) {
                const opciones = misEquiposDeporte.map((eq, i) => `${i + 1}. ${eq.nombre}`).join('\n');
                const eleccion = prompt(`¿Con qué equipo quieres interesarte?\n\n${opciones}\n\nEscribe el número:`);
                if (!eleccion) return;
                const idx = Number(eleccion) - 1;
                if (isNaN(idx) || !misEquiposDeporte[idx]) return toast('Opción inválida', 'error');
                eqElegido = misEquiposDeporte[idx];
              }
              equipoId = eqElegido.id;
            }

            try {
              await interesarseAPI(id, equipoId);
              toast('¡Te marcaste como interesado!', 'success');
              await recargarPartidos();
            } catch (err) {
              console.error('[partidos] Error al interesarse:', err);
              toast(err.message || 'No se pudo marcar interés', 'error');
            }
            return;
          }

          if (accion === 'cancelar-interes') {
            if (!confirm('¿Cancelar tu interés en este partido?')) return;
            try {
              const partido = partidos.find(p => String(p.id) === String(id));
              if (partido?.tipoPartido === 'equipo') {
                const { data: equipos } = await listarGrupos({ tipo: 'equipo', soloMios: 'true', limit: 50 });
                const opciones = (equipos || []).filter(eq => eq.deporte === partido.deporte);
                let equipoId = partido.miEquipoInscritoId || partido.miEquipoPostuladoId;
                if (!equipoId && opciones.length === 1) equipoId = opciones[0].id;
                if (!equipoId && opciones.length > 1) {
                  const respuesta = prompt('¿Qué equipo deseas retirar?\n\n' + opciones.map((e, i) => `${i+1}. ${e.nombre}`).join('\n'));
                  if (respuesta === null) return;
                  const n = Number(respuesta) - 1;
                  if (!Number.isInteger(n) || !opciones[n]) return toast('Equipo inválido', 'error');
                  equipoId = opciones[n].id;
                }
                if (equipoId) await salirEquipoDelPartidoAPI(id, equipoId);
                else await cancelarInteresAPI(id);
              } else {
                await cancelarInteresAPI(id);
              }
              toast('Interés cancelado', 'info');
              await recargarPartidos();
            } catch (err) {
              console.error('[partidos] Error al cancelar interés:', err);
              toast(err.message || 'No se pudo cancelar el interés', 'error');
            }
            return;
          }

        } catch (err) {
          console.error('[partidos] Error en acción:', accion, err);
          toast(err.message || 'Error al ejecutar la acción', 'error');
        }
      });
    });
  }

  function cambiarTab(tab) {
    tabActual = tab;
    subtabs.forEach(st => st.classList.toggle('subtab--active', st.dataset.tabPartidos === tab));
    panelDisponibles?.classList.toggle('subpanel--active', tab === 'disponibles');
    panelCreados?.classList.toggle('subpanel--active', tab === 'creados');
    panelInscritos?.classList.toggle('subpanel--active', tab === 'inscritos');
    if (tab !== 'disponibles') {
      filtroBusqueda = '';
      if (inputBuscar) inputBuscar.value = '';
    }
  }

  subtabs.forEach(st => st.addEventListener('click', () => cambiarTab(st.dataset.tabPartidos)));

  selectEstado?.addEventListener('change', (e) => {
    filtroActual = e.target.value;
    renderDisponibles();
  });

  selectTipo?.addEventListener('change', (e) => {
    filtroTipoActual = e.target.value;
    renderDisponibles();
  });

  inputBuscar?.addEventListener('input', (e) => {
    filtroBusqueda = e.target.value;
    renderDisponibles();
  });

  const selectDeporte = document.getElementById('partido-deporte');
  if (selectDeporte) {
    selectDeporte.innerHTML = '<option value="">Selecciona un deporte...</option>' +
      deportes.map(d => `<option value="${d}">${d}</option>`).join('');
  }

  const nivelGrid = document.getElementById('nivel-grid');
  if (nivelGrid) {
    nivelGrid.innerHTML = nivelesPartido.map((n, i) => `
      <div class="nivel-opcion ${i === 0 ? 'active' : ''}" data-nivel="${n.valor}">
        <div class="nivel-opcion__label">${n.label}</div>
        <div class="nivel-opcion__desc">${n.descripcion}</div>
      </div>
    `).join('');
  }

  // La inscripción abierta es independiente del nivel y del tipo de partido.
  // Se crea aquí para funcionar con el HTML actual sin introducir nuevos archivos.
  const anclaInscripcion = document.getElementById('eleccion-aprobacion') || nivelGrid;
  const modalCrearPartido = document.getElementById('modal-crear-partido');
  let panelInscripcion = document.getElementById('panel-partido-inscripcion-abierta');
  if (!panelInscripcion && anclaInscripcion && modalCrearPartido) {
    panelInscripcion = document.createElement('div');
    panelInscripcion.id = 'panel-partido-inscripcion-abierta';
    panelInscripcion.className = 'field';
    panelInscripcion.style.margin = '16px 0';
    panelInscripcion.innerHTML = `
      <label class="field__label" for="partido-inscripcion-abierta">Inscripción abierta</label>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;min-height:42px">
        <input type="checkbox" id="partido-inscripcion-abierta" checked
          style="width:20px;height:20px;accent-color:var(--color-primary);flex:none" />
        <span>Permitir que se inscriban sin aprobación</span>
      </label>
      <small id="partido-inscripcion-ayuda" style="display:block;color:var(--color-text-muted);margin-top:4px">
        Activada: inscripción directa. Desactivada: solicitudes pendientes de aprobación.
      </small>`;
    if (anclaInscripcion.id === 'eleccion-aprobacion') {
      anclaInscripcion.insertAdjacentElement('beforebegin', panelInscripcion);
    } else {
      anclaInscripcion.insertAdjacentElement('afterend', panelInscripcion);
    }
  }
  const checkInscripcionAbierta = document.getElementById('partido-inscripcion-abierta');

  let nivelSeleccionado = 'amistoso';
  let posicionesActivas = [];
  let modoOrganizar = false;

  document.querySelectorAll('#nivel-grid .nivel-opcion').forEach(op => {
    op.addEventListener('click', () => {
      document.querySelectorAll('#nivel-grid .nivel-opcion').forEach(o => o.classList.remove('active'));
      op.classList.add('active');
      nivelSeleccionado = op.dataset.nivel;
      actualizarAvisoAprobacion();
    });
  });

  function actualizarAvisoAprobacion() {
    // Sustituimos la aprobación automática dependiente del nivel.
    // Los campos antiguos se ocultan y su valor no se envía.
    document.getElementById('aviso-aprobacion')?.classList.remove('show');
    document.getElementById('eleccion-aprobacion')?.classList.add('hidden');
    panelInscripcion?.classList.toggle('hidden', modoOrganizar);
  }

  function actualizarPosiciones() {
    const deporte = document.getElementById('partido-deporte').value;
    const posiciones = posicionesPorDeporte[deporte] || [];
    const wrapper = document.getElementById('posiciones-wrapper');
    const lista = document.getElementById('posiciones-lista');
    const checkPedir = document.getElementById('partido-pedir-posiciones');

    posicionesActivas = [];
    if (checkPedir) checkPedir.checked = false;
    document.getElementById('posiciones-selector')?.classList.add('hidden');

    if (posiciones.length > 0) {
      wrapper?.classList.remove('hidden');
      if (lista) {
        lista.innerHTML = posiciones.map(p => `<button type="button" class="posicion-chip" data-posicion="${p}">${p}</button>`).join('');
        lista.querySelectorAll('.posicion-chip').forEach(chip => {
          chip.addEventListener('click', () => {
            const pos = chip.dataset.posicion;
            if (posicionesActivas.includes(pos)) {
              posicionesActivas = posicionesActivas.filter(x => x !== pos);
              chip.classList.remove('active');
            } else {
              posicionesActivas.push(pos);
              chip.classList.add('active');
            }
          });
        });
      }
    } else {
      wrapper?.classList.add('hidden');
    }
  }

  const checkModoOrganizar = document.getElementById('partido-modo-organizar');
  const avisoModoOrganizar = document.getElementById('aviso-modo-organizar');

  function aplicarModoOrganizar() {
    const grupos = [
      document.getElementById('partido-fecha')?.closest('.form-row'),
      document.getElementById('partido-lugar')?.closest('.field'),
      document.getElementById('partido-gratis')?.closest('.field'),
    ];

    const avisoAprob = document.getElementById('aviso-aprobacion');
    const eleccionAprob = document.getElementById('eleccion-aprobacion');

    if (modoOrganizar) {
      grupos.forEach(g => g?.classList.add('hidden'));
      avisoAprob?.classList.remove('show');
      eleccionAprob?.classList.add('hidden');
      avisoModoOrganizar?.classList.add('show');
      panelInscripcion?.classList.add('hidden');

      const btnGuardar = document.getElementById('btn-guardar-partido');
      if (btnGuardar) btnGuardar.textContent = '📢 Publicar convocatoria';

      const labelCupos = document.getElementById('label-partido-cupos');
      if (labelCupos) labelCupos.textContent = 'Cupos estimados *';
    } else {
      grupos.forEach(g => g?.classList.remove('hidden'));
      avisoModoOrganizar?.classList.remove('show');
      actualizarAvisoAprobacion();

      const btnGuardar = document.getElementById('btn-guardar-partido');
      if (btnGuardar) btnGuardar.textContent = 'Publicar partido';

      const labelCupos = document.getElementById('label-partido-cupos');
      if (labelCupos) labelCupos.textContent = 'Cupos totales *';
    }
  }

  checkModoOrganizar?.addEventListener('change', () => {
    modoOrganizar = checkModoOrganizar.checked;
    aplicarModoOrganizar();
  });

  let tipoPartidoSeleccionado = 'jugador';
  let equipoOrganizadorSel = null;

  const campoEquipoOrg   = document.getElementById('campo-equipo-organizador');
  const dropdownTrigger  = document.getElementById('equipo-dropdown-trigger');
  const dropdownPanel    = document.getElementById('equipo-dropdown-panel');
  const dropdownContent  = document.getElementById('equipo-dropdown-content');

  async function actualizarTipoPartido() {
    document.querySelectorAll('[data-tipo-partido]').forEach(op => {
      op.classList.toggle('active', op.dataset.tipoPartido === tipoPartidoSeleccionado);
    });

    if (tipoPartidoSeleccionado === 'equipo') {
      const misEq = await misEquiposComoCapitanOAdmin();
      const deporteSeleccionado = document.getElementById('partido-deporte')?.value || '';
      const misEqDelDeporte = deporteSeleccionado ? misEq.filter(e => String(e.deporte) === String(deporteSeleccionado)) : [];

      if (misEqDelDeporte.length === 0) {
        campoEquipoOrg?.classList.remove('hidden');
        dropdownContent.innerHTML = `<span class="equipo-dropdown__placeholder">${deporteSeleccionado ? `No tienes equipos de ${deporteSeleccionado}` : 'Elige un deporte primero'}</span>`;
        dropdownPanel.innerHTML = `<div style="padding:16px; text-align:center; color:var(--color-text-muted); font-size:13px">${deporteSeleccionado ? `No eres capitán de ningún equipo de ${deporteSeleccionado}.` : 'Primero elige un deporte.'}</div>`;
        equipoOrganizadorSel = null;
      } else {
        campoEquipoOrg?.classList.remove('hidden');
        equipoOrganizadorSel = null;
        renderEquipoDropdownPlaceholder();

        dropdownPanel.innerHTML = misEqDelDeporte.map(e => {
          const esImagen = typeof e.escudo === 'string' && /\.(png|svg|jpg|jpeg|gif|webp)$/i.test(e.escudo);
          const iconoHtml = esImagen ? `<img src="${e.escudo}" alt="" class="equipo-opcion__icono" />` : `<span class="equipo-opcion__icono equipo-opcion__icono--emoji">${e.escudo || '🛡️'}</span>`;
          return `
            <button type="button" class="equipo-opcion" data-equipo-id="${e.id}">
              ${iconoHtml}
              <div class="equipo-opcion__nombre"><div class="equipo-opcion__nombre-principal">${e.nombre}</div><div class="equipo-opcion__deporte">${e.deporte}${e.ciudad ? ' · ' + e.ciudad : ''}</div></div>
            </button>
          `;
        }).join('');

        dropdownPanel.querySelectorAll('[data-equipo-id]').forEach(btn => {
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const id = btn.dataset.equipoId;
            dropdownPanel.querySelectorAll('.equipo-opcion').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            equipoOrganizadorSel = id;
            renderEquipoDropdownSeleccionado(misEqDelDeporte.find(e => String(e.id) === String(id)));
            cerrarEquipoDropdown();
          });
        });
      }

      const labelCupos = document.getElementById('label-partido-cupos');
      const hintCupos = document.getElementById('hint-partido-cupos');
      if (labelCupos) labelCupos.textContent = modoOrganizar ? 'Cupos estimados de equipos *' : 'Cupos de equipos *';
      if (hintCupos) hintCupos.textContent = 'Ej: 2 equipos (uno es el tuyo, el otro se postula)';

      const inputCupos = document.getElementById('partido-cupos');
      if (inputCupos) inputCupos.value = '2';
    } else {
      campoEquipoOrg?.classList.add('hidden');
      equipoOrganizadorSel = null;
      cerrarEquipoDropdown();

      const labelCupos = document.getElementById('label-partido-cupos');
      const hintCupos = document.getElementById('hint-partido-cupos');
      if (labelCupos) labelCupos.textContent = modoOrganizar ? 'Cupos estimados *' : 'Cupos totales *';
      if (hintCupos) hintCupos.textContent = '';

      const inputCupos = document.getElementById('partido-cupos');
      if (inputCupos) inputCupos.value = '14';
    }
  }

  function renderEquipoDropdownPlaceholder() {
    dropdownContent.innerHTML = `<span class="equipo-dropdown__placeholder">Selecciona un equipo...</span>`;
  }

  function renderEquipoDropdownSeleccionado(equipo) {
    if (!equipo) {
      renderEquipoDropdownPlaceholder();
      return;
    }
    const esImagen = typeof equipo.escudo === 'string' && /\.(png|svg|jpg|jpeg|gif|webp)$/i.test(equipo.escudo);
    const iconoHtml = esImagen ? `<img src="${equipo.escudo}" alt="" class="equipo-opcion__icono" />` : `<span class="equipo-opcion__icono equipo-opcion__icono--emoji">${equipo.escudo || '🛡️'}</span>`;
    dropdownContent.innerHTML = `<div class="equipo-dropdown__selected">${iconoHtml}<span class="equipo-dropdown__selected-nombre">${equipo.nombre}</span></div>`;
  }

  function abrirEquipoDropdown() {
    dropdownTrigger?.classList.add('open');
    dropdownPanel?.classList.add('open');
  }

  function cerrarEquipoDropdown() {
    dropdownTrigger?.classList.remove('open');
    dropdownPanel?.classList.remove('open');
  }

  function toggleEquipoDropdown() {
    if (dropdownPanel?.classList.contains('open')) {
      cerrarEquipoDropdown();
    } else {
      abrirEquipoDropdown();
    }
  }

  dropdownTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleEquipoDropdown();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.equipo-dropdown')) {
      cerrarEquipoDropdown();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cerrarEquipoDropdown();
    }
  });

  const opcionEquipo = document.querySelector('[data-tipo-partido="equipo"]');
  if (opcionEquipo) {
    const misEq = await misEquiposComoCapitanOAdmin();
    opcionEquipo.style.display = misEq.length > 0 ? '' : 'none';
  }

  document.querySelectorAll('[data-tipo-partido]').forEach(op => {
    op.addEventListener('click', async () => {
      tipoPartidoSeleccionado = op.dataset.tipoPartido;
      await actualizarTipoPartido();
    });
  });

  selectDeporte?.addEventListener('change', async () => {
    actualizarPosiciones();
    if (tipoPartidoSeleccionado === 'equipo') {
      equipoOrganizadorSel = null;
      await actualizarTipoPartido();
    }
  });

  const checkRequiereAprob = document.getElementById('partido-requiere-aprobacion');
  checkRequiereAprob?.addEventListener('change', () => actualizarAvisoAprobacion());

  const checkGratis = document.getElementById('partido-gratis');
  const precioWrapper = document.getElementById('precio-wrapper');
  checkGratis?.addEventListener('change', () => precioWrapper?.classList.toggle('hidden', checkGratis.checked));

  const checkPedirPos = document.getElementById('partido-pedir-posiciones');
  const selectorPos   = document.getElementById('posiciones-selector');
  checkPedirPos?.addEventListener('change', () => selectorPos?.classList.toggle('hidden', !checkPedirPos.checked));

  async function resetearFormulario() {
    tipoPartidoSeleccionado = 'jugador';
    equipoOrganizadorSel = null;
    modoOrganizar = false;
    if (checkModoOrganizar) checkModoOrganizar.checked = false;
    aplicarModoOrganizar();
    await actualizarTipoPartido();
    document.getElementById('partido-deporte').value = '';
    document.getElementById('partido-titulo').value = '';
    document.getElementById('partido-fecha').value = '';
    document.getElementById('partido-hora').value = '';
    document.getElementById('partido-lugar').value = '';
    document.getElementById('partido-cupos').value = '14';
    document.getElementById('partido-descripcion').value = '';
    document.getElementById('partido-gratis').checked = true;
    document.getElementById('partido-precio').value = '5000';
    document.getElementById('precio-wrapper').classList.add('hidden');
    document.getElementById('posiciones-wrapper').classList.add('hidden');
    document.getElementById('posiciones-selector').classList.add('hidden');
    document.getElementById('partido-pedir-posiciones').checked = false;
    const checkAnterior = document.getElementById('partido-requiere-aprobacion');
    if (checkAnterior) checkAnterior.checked = false;
    if (checkInscripcionAbierta) checkInscripcionAbierta.checked = true;
    document.getElementById('aviso-aprobacion').classList.remove('show');
    document.getElementById('eleccion-aprobacion').classList.add('hidden');

    nivelSeleccionado = 'amistoso';
    document.querySelectorAll('#nivel-grid .nivel-opcion').forEach((o, i) => o.classList.toggle('active', i === 0));
    posicionesActivas = [];
  }

  async function abrirModalCrear() {
    await resetearFormulario();
    abrirModal('modal-crear-partido');
  }

  btnCrear?.addEventListener('click', () => abrirModalCrear());

  document.querySelectorAll('[data-cerrar-modal]').forEach(btn => btn.addEventListener('click', () => cerrarModal(btn.dataset.cerrarModal)));
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.classList.remove('open'); }));

  document.getElementById('btn-guardar-partido')?.addEventListener('click', async () => {
    const deporte     = document.getElementById('partido-deporte').value;
    const titulo      = document.getElementById('partido-titulo').value.trim();
    const fecha       = document.getElementById('partido-fecha').value;
    const hora        = document.getElementById('partido-hora').value;
    const lugar       = document.getElementById('partido-lugar').value.trim();
    const cupos       = Number(document.getElementById('partido-cupos').value);
    const esGratis    = document.getElementById('partido-gratis').checked;
    const precio      = esGratis ? 0 : Number(document.getElementById('partido-precio').value);
    const descripcion = document.getElementById('partido-descripcion').value.trim();
    const pedirPos    = document.getElementById('partido-pedir-posiciones').checked;

    if (!deporte)   return toast('Selecciona un deporte', 'error');
    if (!titulo)    return toast('Ingresa un título', 'error');
    if (cupos < 2)  return toast('Los cupos deben ser al menos 2', 'error');

    if (!modoOrganizar) {
      if (!fecha)     return toast('Selecciona una fecha', 'error');
      if (!hora)      return toast('Selecciona una hora', 'error');
      if (!lugar)     return toast('Ingresa un lugar', 'error');
      if (!esGratis && precio < 0) return toast('El precio no puede ser negativo', 'error');
    }

    if (pedirPos && posicionesActivas.length === 0) {
      return toast('Selecciona al menos una posición', 'error');
    }

    if (tipoPartidoSeleccionado === 'equipo' && !equipoOrganizadorSel) {
      return toast('Selecciona con qué equipo publicás', 'error');
    }

    let fechaISO = null;
    if (!modoOrganizar && fecha && hora) {
      fechaISO = new Date(`${fecha}T${hora}:00`).toISOString();
    }

    const payload = {
      titulo,
      deporte,
      emoji: emojiDeporte[deporte] || null,
      descripcion: descripcion || null,
      lugar: modoOrganizar ? null : lugar,
      fecha: modoOrganizar ? null : fechaISO,
      cupos,
      precio: modoOrganizar ? 0 : precio,
      nivel: nivelSeleccionado,
      tipoPartido: tipoPartidoSeleccionado,
      organizadorEquipoId: (tipoPartidoSeleccionado === 'equipo' && equipoOrganizadorSel) ? String(equipoOrganizadorSel) : null,
      aprobacionRequerida: modoOrganizar ? false : !(checkInscripcionAbierta?.checked ?? true),
      pedirPosiciones: pedirPos,
      posiciones: pedirPos ? [...posicionesActivas] : [],
      estadoPartido: modoOrganizar ? 'buscando_jugadores' : 'confirmado',
    };

    const btn = document.getElementById('btn-guardar-partido');
    btn.disabled = true;
    const textoOriginal = btn.textContent;
    btn.textContent = modoOrganizar ? 'Publicando convocatoria...' : 'Publicando...';

    try {
      await crearPartidoAPI(payload);
      toast(modoOrganizar ? '¡Convocatoria publicada! Los interesados podrán marcar "Me interesa".' : '¡Partido publicado!', 'success');
      cerrarModal('modal-crear-partido');

      const { data } = await listarPartidos({ limit: 50 });
      partidos = data;

      filtroActual = 'todos';
      filtroTipoActual = 'todos';
      if (selectEstado) selectEstado.value = 'todos';
      if (selectTipo) selectTipo.value = 'todos';

      renderDisponibles();
      renderCreados();
      renderInscritos();
      cambiarTab('creados');
    } catch (err) {
      console.error('[partidos] Error al crear:', err);
      toast(err.message || 'No se pudo crear el partido', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  });

  async function renderTodo() {
    try {
      const { data } = await listarPartidos({ limit: 50 });
      partidos = data;
      console.log('[partidos] renderTodo: partidos cargados:', partidos.length);
    } catch (err) {
      console.warn('[partidos] No se pudo recargar:', err.message);
    }
    renderDisponibles();
    renderCreados();
    renderInscritos();
  }

  await renderTodo();

  console.log('[partidos] init() terminó OK');
    // ⚡ NUEVO: Lógica de filtros de fecha
  // ⚡ NUEVO: Lógica de filtros de fecha
  const chipsFecha = document.querySelectorAll('[data-filtro-fecha]');
  const inputFechaDesde = document.getElementById('filtro-fecha-desde');
  const inputFechaHasta = document.getElementById('filtro-fecha-hasta');

  function calcularFechaRapida(tipo) {
    const hoy = new Date();
    let desde = '';
    let hasta = '';

    // ⚡ FIX timezone: usar fecha LOCAL, no UTC (evita bug nocturno en Chile)
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
    if (inputFechaDesde) inputFechaDesde.value = desde;
    if (inputFechaHasta) inputFechaHasta.value = hasta;
  }

  function handleChipFechaClick(e) {
    chipsFecha.forEach(c => c.classList.remove('chip--active'));
    e.currentTarget.classList.add('chip--active');
    filtroFechaRapido = e.currentTarget.dataset.filtroFecha;
    calcularFechaRapida(filtroFechaRapido);
    recargarPartidos(); // ⚡ refetch al backend con fechas
  }

  function handleInputDesdeChange(e) {
    filtroFechaDesde = e.target.value;
    chipsFecha.forEach(c => c.classList.remove('chip--active'));
    recargarPartidos();
  }

  function handleInputHastaChange(e) {
    filtroFechaHasta = e.target.value;
    chipsFecha.forEach(c => c.classList.remove('chip--active'));
    recargarPartidos();
  }

  chipsFecha.forEach(chip => chip.addEventListener('click', handleChipFechaClick));
  inputFechaDesde?.addEventListener('change', handleInputDesdeChange);
  inputFechaHasta?.addEventListener('change', handleInputHastaChange);

  return () => {
    // ⚡ FIX memory leak: remover también los listeners de fecha
    chipsFecha.forEach(chip => chip.removeEventListener('click', handleChipFechaClick));
    inputFechaDesde?.removeEventListener('change', handleInputDesdeChange);
    inputFechaHasta?.removeEventListener('change', handleInputHastaChange);
  };
}