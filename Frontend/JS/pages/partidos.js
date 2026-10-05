import { formatearFecha, toast, abrirModal, cerrarModal } from '../components.js';
import { deportes, posicionesPorDeporte, nivelesPartido } from '../data-mock.js';
import { getSesion } from '../auth.js';
import { listarGrupos } from '../services/grupos.service.js';
import { api } from '../api.js';
import {
  listarPartidos,
  crearPartido as crearPartidoAPI,
  eliminarPartido as eliminarPartidoAPI,
  inscribirse as inscribirseAPI,
  salirDelPartido as salirDelPartidoAPI,
  postularse as postularseAPI,
  cancelarPostulacion as cancelarPostulacionAPI,
  postularEquipo as postularEquipoAPI,
  interesarse as interesarseAPI,
  cancelarInteres as cancelarInteresAPI,
} from '../services/partidos.service.js';

export async function init() {
  /* ---------- ESTADO ---------- */
  let partidos = [];
  let filtroActual = 'todos';
  let filtroTipoActual = 'todos';
  let tabActual = 'disponibles';
  const user = getSesion();

  /* ---------- CARGAR DESDE EL BACKEND ---------- */
  try {
    const { data } = await listarPartidos({ limit: 50 });
    partidos = data;
  } catch (err) {
    console.error('[partidos] Error al cargar:', err);
    toast('No se pudieron cargar los partidos', 'error');
    partidos = [];
  }

  /* ---------- REFS ---------- */
  const contDisponibles  = document.getElementById('lista-partidos');
  const contCreados      = document.getElementById('lista-creados');
  const contInscritos    = document.getElementById('lista-inscritos');
  const panelDisponibles = document.getElementById('panel-disponibles');
  const panelCreados     = document.getElementById('panel-creados');
  const panelInscritos   = document.getElementById('panel-inscritos');
  const subtabs          = document.querySelectorAll('[data-tab-partidos]');
  const chips            = document.querySelectorAll('[data-filtro]');
  const chipsTipo        = document.querySelectorAll('[data-filtro-tipo]');
  const btnCrear         = document.getElementById('btn-crear-partido');
  const btnCrear2        = document.getElementById('btn-crear-partido-2');

  if (!contDisponibles) return null;

  /* ---------- HELPERS ---------- */
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
      return `<img src="${emoji}" alt="" style="width:32px;height:32px;object-fit:contain;display:block" />`;
    }
    return emoji;
  }

  /* =========================================================
     RENDER DE UNA CARD DE PARTIDO
     ========================================================= */
  function renderCard(p, opciones = {}) {
    const { mostrarAcciones = false, mostrarBadgeRol = null } = opciones;
    const totalInsc = totalInscritosReal(p);
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

    // ⚡ Badge:
    // - Modo Organizar → "Organizando"
    // - Confirmado → "Confirmado"
    // - Lleno → "Lleno"
    // - Finalizado → "Finalizado"
    // - Resto → "Disponible"
    const badgeClase =
      enModoOrganizar ? 'badge--warning' :
      confirmado      ? 'badge--primary' :
      p.estado === 'lleno'      ? 'badge--danger'  :
      p.estado === 'finalizado' ? 'badge--neutral' :
                                  'badge--success';

    const badgeTexto =
      enModoOrganizar ? 'Organizando' :
      confirmado      ? 'Confirmado' :
      p.estado === 'lleno'      ? 'Lleno'      :
      p.estado === 'finalizado' ? 'Finalizado' :
                                  'Disponible';

    const precioHtml = enModoOrganizar
      ? `<span class="match-card__precio match-card__precio--gratis">📢 A coordinar</span>`
      : (p.precio === 0
        ? `<span class="match-card__precio match-card__precio--gratis">🎉 Gratis</span>`
        : `<span class="match-card__precio match-card__precio--pago">💰 $${p.precio.toLocaleString('es-CL')}</span>`);

    const nivelLabel = {
      amistoso: 'Amistoso',
      semiprofesional: 'Semiprofesional',
      profesional: 'Profesional'
    }[p.nivel] || p.nivel;

    const nivelHtml = `<span class="nivel-badge nivel-badge--${p.nivel}">${nivelLabel}</span>`;

    const aprobacionHtml = p.aprobacionRequerida && !enModoOrganizar
      ? `<span class="badge badge--warning">🔒 Con aprobación</span>`
      : '';

    const posicionesBuscadasHtml = (p.pedirPosiciones && p.posiciones && p.posiciones.length > 0)
      ? `<div class="text-xs text-muted" style="margin-bottom:var(--space-3)">
           🎯 Solo se busca: <strong>${p.posiciones.join(', ')}</strong>
         </div>`
      : '';

    const badgeRolHtml = mostrarBadgeRol
      ? `<span class="badge badge--primary" style="margin-left:auto">${mostrarBadgeRol}</span>`
      : '';

    const badgeTipoHtml = deEquipo
      ? `<span class="badge badge--warning">🛡️ De equipos</span>`
      : `<span class="badge badge--info">👤 De jugadores</span>`;

    const badgeModoHtml = enModoOrganizar
      ? `<span class="badge badge--primary">📢 Organizar partido</span>`
      : '';

    const contadorTexto = deEquipo
      ? `${totalInsc}/${p.cupos} equipos`
      : `${totalInsc}/${p.cupos} jugadores`;

    const infoFecha = enModoOrganizar
      ? '<span>📅 A coordinar</span>'
      : `<span>📅 ${formatearFecha(p.fecha)}</span>`;

    const infoLugar = enModoOrganizar
      ? '<span>📍 A coordinar</span>'
      : `<span>📍 ${p.lugar}</span>`;

    /* =========================================================
       BOTÓN DE ACCIÓN SEGÚN ESTADO
       ========================================================= */
    let botonAccion = '';

    if (!user) {
      botonAccion = '';
    } else if (soyOrganizador) {
      // El organizador siempre ve botones de gestión
      botonAccion = mostrarAcciones ? `
        <button class="btn btn--ghost btn--sm" data-accion="editar" data-id="${p.id}">✏️ Editar</button>
        <button class="btn btn--ghost btn--sm" data-accion="postulantes" data-id="${p.id}">👥 ${enModoOrganizar ? 'Interesados' : 'Postulantes'}</button>
        <button class="btn btn--ghost btn--sm" data-accion="eliminar" data-id="${p.id}" style="color:var(--color-danger)">🗑️</button>
      ` : '';
    } else if (enModoOrganizar) {
      // =========================================================
      // MODO ORGANIZAR — otros usuarios
      // =========================================================
      if (yoInteresado) {
        botonAccion = `
          <span class="badge badge--warning" style="padding:8px 12px">🙋 Ya te marcaste interesado</span>
          <button class="btn btn--ghost btn--sm" data-accion="cancelar-interes" data-id="${p.id}" style="color:var(--color-danger)">Cancelar interés</button>
        `;
      } else {
        botonAccion = `<button class="btn btn--primary btn--sm" data-accion="interesarse" data-id="${p.id}">🙋 Me interesa</button>`;
      }
    } else if (confirmado) {
      // =========================================================
      // PARTIDO CONFIRMADO POR AMBAS PARTES → CERRADO
      // =========================================================
      if (deEquipo) {
        if (miEquipoInscrito) {
          // Es mi equipo el que quedó inscrito
          botonAccion = `<span class="badge badge--success" style="padding:8px 12px">✅ Tu equipo está confirmado</span>`;
        } else {
          // No es mi equipo, o soy otro equipo → cerrado
          botonAccion = `<span class="badge badge--neutral" style="padding:8px 12px">🔒 Cerrado</span>`;
        }
      } else {
        if (yoEstoyInscrito) {
          // Soy el jugador confirmado
          botonAccion = `<button class="btn btn--ghost btn--sm" data-accion="desinscribirse" data-id="${p.id}" style="color:var(--color-danger)">❌ Salir del partido</button>`;
        } else {
          // No soy el confirmado → cerrado para mí
          botonAccion = `<span class="badge badge--neutral" style="padding:8px 12px">🔒 Cerrado</span>`;
        }
      }
    } else if (deEquipo) {
      // =========================================================
      // PARTIDO DE EQUIPOS NORMAL
      // =========================================================
      if (miEquipoInscrito) {
        botonAccion = `<span class="badge badge--success" style="padding:8px 12px">✅ Tu equipo está inscrito</span>`;
      } else if (miEquipoPostulado) {
        botonAccion = `
          <button class="btn btn--ghost btn--sm" disabled>⏳ Postulación pendiente</button>
          <button class="btn btn--ghost btn--sm" data-accion="cancelar-postulacion-equipo" data-id="${p.id}" style="color:var(--color-danger)">Cancelar</button>
        `;
      } else if (p.estado === 'abierto' && totalInsc < p.cupos) {
        botonAccion = `<button class="btn btn--primary btn--sm" data-accion="postular-equipo" data-id="${p.id}">📝 Postular mi equipo</button>`;
      } else {
        botonAccion = `<span class="badge badge--neutral" style="padding:8px 12px">🔒 No disponible</span>`;
      }
    } else {
      // =========================================================
      // PARTIDO DE JUGADORES NORMAL
      // =========================================================
      if (yoEstoyInscrito) {
        botonAccion = `<button class="btn btn--ghost btn--sm" data-accion="desinscribirse" data-id="${p.id}" style="color:var(--color-danger)">❌ Desinscribirme</button>`;
      } else if (yoPostule) {
        botonAccion = `
          <button class="btn btn--ghost btn--sm" disabled>⏳ Postulación pendiente</button>
          <button class="btn btn--ghost btn--sm" data-accion="cancelar-postulacion" data-id="${p.id}" style="color:var(--color-danger)">Cancelar</button>
        `;
      } else if (p.estado === 'abierto' && totalInsc < p.cupos) {
        if (p.aprobacionRequerida) {
          botonAccion = `<button class="btn btn--primary btn--sm" data-accion="postularse" data-id="${p.id}">📝 Postularme</button>`;
        } else {
          botonAccion = `<button class="btn btn--primary btn--sm" data-accion="inscribirse" data-id="${p.id}">✅ Inscribirme</button>`;
        }
      } else {
        botonAccion = `<span class="badge badge--neutral" style="padding:8px 12px">🔒 No disponible</span>`;
      }
    }

    const accionesHtml = botonAccion ? `
      <div class="match-card__acciones" style="display:flex; gap:6px; margin-top:var(--space-3); padding-top:var(--space-3); border-top:1px solid var(--color-border); flex-wrap:wrap">
        ${botonAccion}
      </div>
    ` : '';

    return `
      <article class="match-card" data-id="${p.id}">
        <div class="match-card__header">
          <div class="match-card__sport">${renderEmoji(p.emoji)}</div>
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; justify-content:flex-end">
            ${badgeRolHtml}
            <span class="badge ${badgeClase}">${badgeTexto}</span>
          </div>
        </div>

        <h3 class="match-card__title">${p.titulo}</h3>

        <div class="flex gap-2 mb-4" style="flex-wrap:wrap">
          ${badgeTipoHtml}
          ${badgeModoHtml}
          ${nivelHtml}
          ${precioHtml}
          ${aprobacionHtml}
        </div>

        ${posicionesBuscadasHtml}

        <div class="match-card__info">
          ${infoFecha}
          ${infoLugar}
        </div>

        <div class="match-card__footer">
          <div class="match-card__progress">
            <div class="match-card__progress-bar" style="width:${porcentaje}%"></div>
          </div>
          <span class="text-xs text-muted">${contadorTexto}</span>
        </div>

        ${accionesHtml}
      </article>
    `;
  }
    /* =========================================================
     HELPER: Recargar partidos desde el backend
     ========================================================= */
  async function recargarPartidos() {
    try {
      const { data } = await listarPartidos({ limit: 50 });
      partidos = data;
      renderDisponibles();
      renderCreados();
      renderInscritos();
    } catch (err) {
      console.warn('[partidos] No se pudo recargar:', err.message);
    }
  }

  /* =========================================================
     RENDERS DE PANELES
     ========================================================= */
  function renderDisponibles() {
    let lista = partidos;

    if (filtroActual === 'abiertos')      lista = lista.filter(p => p.estado === 'abierto' && !esModoOrganizar(p));
    if (filtroActual === 'llenos')        lista = lista.filter(p => p.estado === 'lleno' && !esModoOrganizar(p));
    if (filtroActual === 'finalizados')   lista = lista.filter(p => p.estado === 'finalizado');
    if (filtroActual === 'organizando')   lista = lista.filter(p => esModoOrganizar(p));
    if (filtroActual === 'confirmados')   lista = lista.filter(p => estaConfirmado(p));

    if (filtroTipoActual === 'jugador')  lista = lista.filter(p => !esDeEquipo(p));
    if (filtroTipoActual === 'equipo')   lista = lista.filter(p => esDeEquipo(p));
    if (filtroTipoActual === 'publico')  lista = lista.filter(p => !p.aprobacionRequerida);
    if (filtroTipoActual === 'privado')  lista = lista.filter(p => p.aprobacionRequerida);

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
  }

  function renderCreados() {
    const misCreados = partidos.filter(p =>
      String(p.organizador?.id) === String(user?.id)
    );

    const countEl = document.getElementById('count-creados');
    if (countEl) countEl.textContent = misCreados.length;

    if (misCreados.length === 0) {
      contCreados.innerHTML = `
        <div class="card" style="grid-column: 1 / -1;">
          <div class="empty-state">
            <div class="empty-state__icon">👑</div>
            <p>Aún no has creado ningún partido.</p>
            <button class="btn btn--primary mt-4" id="btn-vacio-crear">+ Crear mi primer partido</button>
          </div>
        </div>`;
      document.getElementById('btn-vacio-crear')?.addEventListener('click', () => abrirModalCrear());
      return;
    }

    contCreados.innerHTML = misCreados.map(p =>
      renderCard(p, { mostrarAcciones: true, mostrarBadgeRol: '👑 Organizador' })
    ).join('');

    conectarClicksCards(contCreados);
    conectarAccionesCard(contCreados);
  }

  function renderInscritos() {
    const misInscritos = partidos.filter(p => {
      if (String(p.organizador?.id) === String(user?.id)) return false;

      if (!esDeEquipo(p)) {
        return !!p.yoInscrito || !!p.yoPostule;
      }

      return !!p.miEquipoInscrito || !!p.miEquipoPostulado;
    });

    const countEl = document.getElementById('count-inscritos');
    if (countEl) countEl.textContent = misInscritos.length;

    if (misInscritos.length === 0) {
      contInscritos.innerHTML = `
        <div class="card" style="grid-column: 1 / -1;">
          <div class="empty-state">
            <div class="empty-state__icon">✅</div>
            <p>No estás inscrito en ningún partido todavía.</p>
            <button class="btn btn--primary mt-4" id="btn-vacio-disponibles">Ver partidos disponibles</button>
          </div>
        </div>`;
      document.getElementById('btn-vacio-disponibles')?.addEventListener('click', () => {
        cambiarTab('disponibles');
      });
      return;
    }

    contInscritos.innerHTML = misInscritos.map(p =>
      renderCard(p, { mostrarBadgeRol: '✅ Inscrito' })
    ).join('');

    conectarClicksCards(contInscritos);
    conectarAccionesCard(contInscritos);
  }

  /* =========================================================
     CONECTAR CLICKS EN LAS CARDS
     ========================================================= */
  function conectarClicksCards(contenedor) {
    contenedor.querySelectorAll('.match-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-accion]')) return;
        const id = card.dataset.id;
        window.location.hash = `#/partido/${id}`;
      });
    });
  }

  /* =========================================================
     CONECTAR BOTONES DE ACCIÓN EN LAS CARDS
     ========================================================= */
  function conectarAccionesCard(contenedor) {
    contenedor.querySelectorAll('[data-accion]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const accion = btn.dataset.accion;

        try {
          if (accion === 'editar' || accion === 'postulantes') {
            window.location.hash = `#/partido/${id}`;
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
            const resultado = await salirDelPartidoAPI(id);
            toast(resultado?.mensaje || 'Saliste del partido', 'info');
            await recargarPartidos();
            return;
          }

          if (accion === 'postularse') {
            const partido = partidos.find(p => String(p.id) === String(id));
            let posicion = null;
            if (partido?.pedirPosiciones && partido.posiciones?.length > 0) {
              const pos = prompt(`Elegí tu posición:\n${partido.posiciones.join(', ')}`);
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
              return toast('No tenés equipos de ' + partido.deporte, 'error');
            }

            let eqElegido = misEquipos[0];
            if (misEquipos.length > 1) {
              const opciones = misEquipos.map((eq, i) => `${i + 1}. ${eq.nombre}`).join('\n');
              const eleccion = prompt(`¿Con qué equipo?\n\n${opciones}\n\nEscribí el número:`);
              if (!eleccion) return;
              const idx = Number(eleccion) - 1;
              if (isNaN(idx) || !misEquipos[idx]) return toast('Opción inválida', 'error');
              eqElegido = misEquipos[idx];
            }

            await postularEquipoAPI(id, String(eqElegido.id));
            toast('Equipo postulado', 'success');
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

          /* ⚡ MODO ORGANIZAR */
          if (accion === 'interesarse') {
            try {
              await interesarseAPI(id);
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
              await cancelarInteresAPI(id);
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

  /* =========================================================
     SUB-PESTAÑAS Y FILTROS
     ========================================================= */
  function cambiarTab(tab) {
    tabActual = tab;

    subtabs.forEach(st => {
      st.classList.toggle('subtab--active', st.dataset.tabPartidos === tab);
    });

    panelDisponibles.classList.toggle('subpanel--active', tab === 'disponibles');
    panelCreados.classList.toggle('subpanel--active', tab === 'creados');
    panelInscritos.classList.toggle('subpanel--active', tab === 'inscritos');
  }

  subtabs.forEach(st => {
    st.addEventListener('click', () => cambiarTab(st.dataset.tabPartidos));
  });

  function handleChip(e) {
    chips.forEach(c => c.classList.remove('chip--active'));
    e.currentTarget.classList.add('chip--active');
    filtroActual = e.currentTarget.dataset.filtro;
    renderDisponibles();
  }
  chips.forEach(chip => chip.addEventListener('click', handleChip));

  function handleChipTipo(e) {
    chipsTipo.forEach(c => c.classList.remove('chip--active'));
    e.currentTarget.classList.add('chip--active');
    filtroTipoActual = e.currentTarget.dataset.filtroTipo;
    renderDisponibles();
  }
  chipsTipo.forEach(chip => chip.addEventListener('click', handleChipTipo));
    /* =========================================================
     MODAL CREAR PARTIDO — SETUP
     ========================================================= */
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

  function nivelRequiereAprobacion() {
    const nivel = nivelesPartido.find(n => n.valor === nivelSeleccionado);
    if (!nivel) return false;

    if (nivel.eleccionAprobacion) {
      const check = document.getElementById('partido-requiere-aprobacion');
      return check ? check.checked : false;
    }

    return nivel.requiereAprobacion === true;
  }

  function actualizarAvisoAprobacion() {
    if (modoOrganizar) {
      document.getElementById('aviso-aprobacion')?.classList.remove('show');
      document.getElementById('eleccion-aprobacion')?.classList.add('hidden');
      return;
    }

    const nivel = nivelesPartido.find(n => n.valor === nivelSeleccionado);
    const aviso = document.getElementById('aviso-aprobacion');
    const eleccion = document.getElementById('eleccion-aprobacion');

    if (nivel?.eleccionAprobacion) {
      eleccion?.classList.remove('hidden');
    } else {
      eleccion?.classList.add('hidden');
      const check = document.getElementById('partido-requiere-aprobacion');
      if (check) check.checked = false;
    }

    if (nivel?.requiereAprobacion === true) {
      aviso?.classList.add('show');
    } else {
      aviso?.classList.remove('show');
    }
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
        lista.innerHTML = posiciones.map(p => `
          <button type="button" class="posicion-chip" data-posicion="${p}">${p}</button>
        `).join('');

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

  /* =========================================================
     MODO ORGANIZAR — Toggle del checkbox
     ========================================================= */
  const checkModoOrganizar = document.getElementById('partido-modo-organizar');
  const avisoModoOrganizar = document.getElementById('aviso-modo-organizar');

  function aplicarModoOrganizar() {
    const grupos = [
      document.getElementById('partido-fecha')?.closest('.form-row'),
      document.getElementById('partido-lugar')?.closest('.field'),
      document.getElementById('partido-gratis')?.closest('.field'),
      // ❌ NO ocultamos el nivel-grid (el organizador lo elige igual)
    ];

    const avisoAprob = document.getElementById('aviso-aprobacion');
    const eleccionAprob = document.getElementById('eleccion-aprobacion');

    if (modoOrganizar) {
      grupos.forEach(g => g?.classList.add('hidden'));

      avisoAprob?.classList.remove('show');
      eleccionAprob?.classList.add('hidden');

      avisoModoOrganizar?.classList.add('show');

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

  /* =========================================================
     TIPO DE PARTIDO (jugador o equipo)
     ========================================================= */
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

      if (misEq.length === 0) {
        campoEquipoOrg?.classList.add('hidden');
      } else {
        campoEquipoOrg?.classList.remove('hidden');

        equipoOrganizadorSel = null;
        renderEquipoDropdownPlaceholder();

        dropdownPanel.innerHTML = misEq.map(e => {
          const esImagen = typeof e.escudo === 'string' && /\.(png|svg|jpg|jpeg|gif|webp)$/i.test(e.escudo);
          const iconoHtml = esImagen
            ? `<img src="${e.escudo}" alt="" class="equipo-opcion__icono" />`
            : `<span class="equipo-opcion__icono equipo-opcion__icono--emoji">${e.escudo || '🛡️'}</span>`;

          return `
            <button type="button"
                    class="equipo-opcion"
                    data-equipo-id="${e.id}">
              ${iconoHtml}
              <div class="equipo-opcion__nombre">
                <div class="equipo-opcion__nombre-principal">${e.nombre}</div>
                <div class="equipo-opcion__deporte">${e.deporte}${e.ciudad ? ' · ' + e.ciudad : ''}</div>
              </div>
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
            renderEquipoDropdownSeleccionado(misEq.find(e => String(e.id) === String(id)));
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
    const iconoHtml = esImagen
      ? `<img src="${equipo.escudo}" alt="" class="equipo-opcion__icono" />`
      : `<span class="equipo-opcion__icono equipo-opcion__icono--emoji">${equipo.escudo || '🛡️'}</span>`;

    dropdownContent.innerHTML = `
      <div class="equipo-dropdown__selected">
        ${iconoHtml}
        <span class="equipo-dropdown__selected-nombre">${equipo.nombre}</span>
      </div>
    `;
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

  /* ---------- LISTENERS ---------- */
  selectDeporte?.addEventListener('change', () => {
    actualizarPosiciones();
  });

  const checkRequiereAprob = document.getElementById('partido-requiere-aprobacion');
  checkRequiereAprob?.addEventListener('change', () => {
    actualizarAvisoAprobacion();
  });

  const checkGratis = document.getElementById('partido-gratis');
  const precioWrapper = document.getElementById('precio-wrapper');
  checkGratis?.addEventListener('change', () => {
    precioWrapper?.classList.toggle('hidden', checkGratis.checked);
  });

  const checkPedirPos = document.getElementById('partido-pedir-posiciones');
  const selectorPos   = document.getElementById('posiciones-selector');
  checkPedirPos?.addEventListener('change', () => {
    selectorPos?.classList.toggle('hidden', !checkPedirPos.checked);
  });

  /* ---------- RESET FORMULARIO ---------- */
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
    document.getElementById('partido-requiere-aprobacion').checked = false;
    document.getElementById('aviso-aprobacion').classList.remove('show');
    document.getElementById('eleccion-aprobacion').classList.add('hidden');

    nivelSeleccionado = 'amistoso';
    document.querySelectorAll('#nivel-grid .nivel-opcion').forEach((o, i) => {
      o.classList.toggle('active', i === 0);
    });

    posicionesActivas = [];
  }

  /* ---------- ABRIR MODAL ---------- */
  async function abrirModalCrear() {
    await resetearFormulario();
    abrirModal('modal-crear-partido');
  }

  btnCrear?.addEventListener('click', () => abrirModalCrear());
  btnCrear2?.addEventListener('click', () => abrirModalCrear());

  document.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
    btn.addEventListener('click', () => cerrarModal(btn.dataset.cerrarModal));
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.remove('open');
    });
  });

  /* =========================================================
     GUARDAR PARTIDO (crear en backend)
     ========================================================= */
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
      organizadorEquipoId: (tipoPartidoSeleccionado === 'equipo' && equipoOrganizadorSel)
        ? String(equipoOrganizadorSel)
        : null,
      aprobacionRequerida: modoOrganizar
        ? false
        : (nivelRequiereAprobacion() || tipoPartidoSeleccionado === 'equipo'),
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
      toast(
        modoOrganizar
          ? '¡Convocatoria publicada! Los interesados podrán marcar "Me interesa".'
          : '¡Partido publicado!',
        'success'
      );

      cerrarModal('modal-crear-partido');

      const { data } = await listarPartidos({ limit: 50 });
      partidos = data;

      filtroActual = 'todos';
      filtroTipoActual = 'todos';
      chips.forEach(c => c.classList.toggle('chip--active', c.dataset.filtro === 'todos'));
      chipsTipo.forEach(c => c.classList.toggle('chip--active', c.dataset.filtroTipo === 'todos'));

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

  /* =========================================================
     RENDER GLOBAL
     ========================================================= */
  async function renderTodo() {
    try {
      const { data } = await listarPartidos({ limit: 50 });
      partidos = data;
    } catch (err) {
      console.warn('[partidos] No se pudo recargar:', err.message);
    }

    renderDisponibles();
    renderCreados();
    renderInscritos();
  }

  await renderTodo();

  return () => {
    chips.forEach(chip => chip.removeEventListener('click', handleChip));
    chipsTipo.forEach(chip => chip.removeEventListener('click', handleChipTipo));
  };
}