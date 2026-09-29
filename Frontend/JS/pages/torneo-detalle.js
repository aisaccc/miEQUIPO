import { getSesion } from '../auth.js';
import { toast, formatearFecha, abrirModal, cerrarModal } from '../components.js';
import {
  getTorneoPorId, guardarTorneo, eliminarTorneo, getEquipos,
  agregarNotificacion, getClubesDisponibles,
  getMensajesDeCanal, agregarMensaje
} from '../store.js';

export async function init(params = {}) {
  const id = params.id;
  const user = getSesion();
  const contenedor = document.getElementById('detalle-torneo');
  if (!contenedor || !id || !user) return null;

  /* ---------- REFS MODALES ---------- */
  const modalInscribir    = document.getElementById('modal-inscribir-equipo');
  const modalInvitar      = document.getElementById('modal-invitar-equipo');
  const modalSolicitudes  = document.getElementById('modal-gestionar-solicitudes');
  const modalChat         = document.getElementById('modal-chat-torneo');
  const modalVerEquipo    = document.getElementById('modal-ver-equipo');

  /* ---------- HELPERS ---------- */
  function esOrganizador(t) { return t.organizador?.id === user.id; }

  function miEquipoInscrito(t) {
    return (t.equipos || []).find(e =>
      e.capitanId === user.id || (e.jugadores || []).includes(user.id)
    );
  }

  function miSolicitudPendiente(t) {
    return (t.listaEspera || []).find(l =>
      l.estado === 'pendiente' && l.equipo.capitanId === user.id
    );
  }

  function miInvitacionPendiente(t) {
    return (t.invitaciones || []).find(i =>
      i.estado === 'pendiente' && i.equipo.capitanId === user.id
    );
  }

  function misEquiposComoCapitan() {
    return getEquipos().filter(e => e.capitanId === user.id);
  }

  function torneoLleno(t) {
    return (t.equipos || []).length >= t.cuposEquipos;
  }

  function puedeEscribirChat(t) {
    if (esOrganizador(t)) return true;
    return !!miEquipoInscrito(t);
  }

  /* =========================================================
     RENDER PRINCIPAL
     ========================================================= */
  function render() {
    const t = getTorneoPorId(id);
    if (!t) {
      contenedor.innerHTML = `
        <div class="detalle__top">
          <button class="detalle__back" id="btn-volver">←</button>
        </div>
        <div class="card">
          <h2 class="card__title">Torneo no encontrado</h2>
          <p class="card__subtitle">Puede que haya sido eliminado.</p>
        </div>`;
      document.getElementById('btn-volver')?.addEventListener('click', () => {
          if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.hash = '#/torneos';
        }
      });
      return;
    }

    const inscritos = (t.equipos || []).length;
    const cuposLibres = t.cuposEquipos - inscritos;
    const lleno = cuposLibres <= 0;
    const soyOrg = esOrganizador(t);
    const miEquipo = miEquipoInscrito(t);
    const miSol = miSolicitudPendiente(t);
    const miInv = miInvitacionPendiente(t);

    const badgeClase = lleno ? 'badge--danger' :
      t.estado === 'inscripcion' ? 'badge--success' :
      t.estado === 'en_curso'    ? 'badge--warning' :
                                    'badge--neutral';
    const badgeTexto = lleno ? 'Lleno' :
      t.estado === 'inscripcion' ? 'Inscripción abierta' :
      t.estado === 'en_curso'    ? 'En curso' :
                                    'Finalizado';

    /* ---------- BOTONES DE ACCIÓN ---------- */
    let acciones = '';

    if (soyOrg) {
      const pendientes = (t.listaEspera || []).filter(l => l.estado === 'pendiente').length;
      acciones = `
        <button class="btn btn--primary" id="btn-gestionar-solicitudes">
          👥 Solicitudes ${pendientes > 0 ? `<span class="badge badge--neutral" style="margin-left:6px">${pendientes}</span>` : ''}
        </button>
        <button class="btn btn--ghost" id="btn-invitar-equipo">+ Invitar equipo</button>
        <button class="btn btn--ghost" id="btn-abrir-chat">💬 Chat</button>
        <button class="btn btn--ghost" id="btn-editar-torneo">✏️ Editar</button>
        <button class="btn btn--ghost" id="btn-eliminar-torneo" style="color:var(--color-danger)">🗑️ Eliminar</button>
      `;
    } else if (miEquipo) {
      acciones = `
        <button class="btn btn--ghost" id="btn-abrir-chat">💬 Chat del torneo</button>
        <span class="badge badge--success" style="padding:10px 16px; font-size:var(--fs-sm)">
          ✅ Estás inscrito con ${miEquipo.escudo} ${miEquipo.nombre}
        </span>
      `;
    } else if (miInv) {
      acciones = `
        <div class="card" style="width:100%; background:var(--color-primary-light); border:none">
          <p class="text-sm" style="margin:0 0 var(--space-3) 0">
            📨 <strong>¡Te invitaron!</strong> El organizador quiere que
            ${miInv.equipo.escudo} <strong>${miInv.equipo.nombre}</strong> participe.
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
    } else if (lleno) {
      acciones = `
        <span class="badge badge--danger" style="padding:10px 16px; font-size:var(--fs-sm)">
          🔒 Torneo lleno (${inscritos}/${t.cuposEquipos})
        </span>
      `;
    } else {
      // Puede inscribirse (si tiene algún equipo como capitán)
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
            ✅ Inscribir mi equipo (${cuposLibres} cupos)
          </button>
        `;
      }
    }
    /* ---------- BARRA DE PROGRESO ---------- */
    const progreso = Math.min(100, Math.round((inscritos / t.cuposEquipos) * 100));
    const progresoHtml = `
      <div class="torneo-progreso">
        <div class="torneo-progreso__labels">
          <span>Inscripciones</span>
          <span>${inscritos} / ${t.cuposEquipos} equipos</span>
        </div>
        <div class="torneo-progreso__bar">
          <div class="torneo-progreso__fill" style="width:${progreso}%"></div>
        </div>
      </div>
    `;
    /* ---------- EQUIPOS INSCRITOS ---------- */
    const equiposHtml = (t.equipos || []).length > 0
      ? `<div class="equipos-grid">
          ${t.equipos.map(e => `
            <div class="equipo-card">
              <div class="equipo-card__escudo">${e.escudo}</div>
              <div class="equipo-card__info">
                <div class="equipo-card__nombre">${e.nombre}</div>
                <div class="equipo-card__sub">${(e.jugadores || []).length} jugadores</div>
              </div>
            </div>
          `).join('')}
        </div>`
      : `<div class="empty-state--sm">
          <div class="empty-state__icon">🏅</div>
          <p>Aún no hay equipos inscritos.</p>
        </div>`;

    /* ---------- RENDER ---------- */
    contenedor.innerHTML = `
      <div class="detalle__top">
        <button class="detalle__back" id="btn-volver">←</button>
        <h2 class="page-title" style="margin:0; font-size:var(--fs-lg)">Detalle del torneo</h2>
      </div>

      <div class="detalle-torneo__hero">
        <div class="detalle-torneo__hero-emoji">${t.emoji}</div>
        <h1 class="detalle-torneo__hero-title">${t.nombre}</h1>
        <div class="detalle-torneo__hero-meta">
          <span>🏅 ${t.deporte}</span>
          <span>📅 ${formatearFecha(t.fechaInicio)}</span>
          ${t.fechaFin ? `<span>🏁 ${formatearFecha(t.fechaFin)}</span>` : ''}
          ${t.lugar ? `<span>📍 ${t.lugar}</span>` : ''}
          <span data-autor-id="${t.organizador.id}" style="cursor:pointer; text-decoration:underline">
            👤 ${t.organizador.nombre}
          </span>
        </div>
        <div class="detalle__badges">
          <span class="badge ${badgeClase}">${badgeTexto}</span>
          ${t.precio === 0
            ? `<span class="match-card__precio match-card__precio--gratis">🎉 Gratis</span>`
            : `<span class="match-card__precio match-card__precio--pago">💰 $${t.precio.toLocaleString('es-CL')}/equipo</span>`}
        </div>
      </div>

       ${progresoHtml}

      <div class="detalle__info">
        <div class="detalle__info-item">
          <div class="detalle__info-label">Equipos</div>
          <div class="detalle__info-value">${inscritos} / ${t.cuposEquipos}</div>
        </div>
        <div class="detalle__info-item">
          <div class="detalle__info-label">Cupos libres</div>
          <div class="detalle__info-value">${cuposLibres}</div>
        </div>
        <div class="detalle__info-item">
          <div class="detalle__info-label">En lista de espera</div>
          <div class="detalle__info-value">${(t.listaEspera || []).filter(l => l.estado === 'pendiente').length}</div>
        </div>
      </div>

      ${t.descripcion ? `
        <div class="card mb-4">
          <div class="detalle__seccion-titulo">📝 Descripción</div>
          <p class="text-sm">${t.descripcion}</p>
        </div>
      ` : ''}

      <div class="card mb-4">
        <div class="detalle__seccion-titulo">🎯 Acciones</div>
        <div class="detalle__acciones" style="margin-bottom:0">
          ${acciones}
        </div>
      </div>

      <div class="card">
        <div class="detalle__seccion-titulo">🏆 Equipos inscritos (${inscritos})</div>
        ${equiposHtml}
      </div>
    `;

    conectarEventos(t);
  }

  /* =========================================================
     CONECTAR EVENTOS
     ========================================================= */
  function conectarEventos(t) {
    
    document.getElementById('btn-volver')?.addEventListener('click', () => {
      window.location.hash = '#/torneos';
    
    });

    // Botones organizador
    document.getElementById('btn-gestionar-solicitudes')?.addEventListener('click', () => abrirGestionSolicitudes(t));
    document.getElementById('btn-invitar-equipo')?.addEventListener('click', () => abrirInvitarEquipo(t));
    document.getElementById('btn-abrir-chat')?.addEventListener('click', () => abrirChatTorneo(t));
    document.getElementById('btn-editar-torneo')?.addEventListener('click', () => {
      window.location.hash = '#/torneos';
      toast('Usa el botón ✏️ en la card para editar', 'info');
    });
    document.getElementById('btn-eliminar-torneo')?.addEventListener('click', () => {
      if (!confirm(`¿Eliminar "${t.nombre}"? Se notificará a todos.`)) return;
      [...(t.equipos || []), ...(t.listaEspera || []).map(l => l.equipo)].forEach(eq => {
        if (eq.capitanId === user.id) return;
        agregarNotificacion({
          para: eq.capitanId,
          tipo: 'torneo_eliminado',
          mensaje: `El torneo "${t.nombre}" fue eliminado`,
          link: '#/torneos'
        });
      });
      eliminarTorneo(t.id);
      toast('Torneo eliminado', 'info');
      window.location.hash = '#/torneos';
    });

    // Botones jugador
    document.getElementById('btn-inscribir-equipo')?.addEventListener('click', () => abrirInscribirEquipo(t));
    document.getElementById('btn-aceptar-invitacion')?.addEventListener('click', () => aceptarInvitacion(t));
    document.getElementById('btn-rechazar-invitacion')?.addEventListener('click', () => rechazarInvitacion(t));
    document.getElementById('btn-cancelar-solicitud')?.addEventListener('click', () => cancelarSolicitud(t));

    // Cerrar modales
    document.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.addEventListener('click', () => cerrarModal(btn.dataset.cerrarModal));
    });

    // Click backdrop para cerrar
    [modalInscribir, modalInvitar, modalSolicitudes, modalChat].forEach(m => {
      m?.addEventListener('click', (e) => {
        if (e.target === m) m.classList.remove('open');
      });
    });
  }

  /* =========================================================
     INSCRIBIR EQUIPO
     ========================================================= */
  function abrirInscribirEquipo(t) {
    const misEq = misEquiposComoCapitan();
    const lista = document.getElementById('lista-mis-equipos');
    if (!lista) return;

    if (misEq.length === 0) {
      lista.innerHTML = `<p class="text-sm text-muted text-center">No tienes equipos como capitán.</p>`;
      return;
    }

    // Filtrar los que ya están en el torneo
    const disponibles = misEq.filter(eq =>
      !(t.equipos || []).some(e => e.id === eq.id) &&
      !(t.listaEspera || []).some(l => l.equipo.id === eq.id) &&
      !(t.invitaciones || []).some(i => i.equipoId === eq.id && i.estado === 'pendiente')
    );

    if (disponibles.length === 0) {
      lista.innerHTML = `<p class="text-sm text-muted text-center">Todos tus equipos ya están en este torneo o en lista de espera.</p>`;
      return;
    }

    lista.innerHTML = disponibles.map(eq => `
      <div class="amigo-item" data-equipo="${eq.id}" style="cursor:pointer">
        <div class="avatar avatar--md" style="background:var(--color-primary-light); display:grid; place-items:center; font-size:20px">
          ${eq.escudo}
        </div>
        <div class="amigo-item__info">
          <div class="amigo-item__name">${eq.nombre}</div>
          <div class="amigo-item__sub">${eq.deporte} · ${eq.jugadores.length} jugadores</div>
        </div>
        <button class="btn btn--primary btn--sm">Inscribir</button>
      </div>
    `).join('');

    lista.querySelectorAll('[data-equipo]').forEach(el => {
      el.addEventListener('click', () => {
        const eqId = Number(el.dataset.equipo);
        solicitarInscripcion(t, eqId);
      });
    });

    abrirModal('modal-inscribir-equipo');
  }

  function solicitarInscripcion(t, equipoId) {
    const equipo = getEquipos().find(e => e.id === equipoId);
    if (!equipo) return;

    // Re-verificar
    if ((t.equipos || []).length >= t.cuposEquipos) {
      toast('El torneo ya está lleno', 'error');
      return;
    }

    // Agregar a lista de espera
    t.listaEspera = t.listaEspera || [];
    if (t.listaEspera.some(l => l.equipo.id === equipoId && l.estado === 'pendiente')) {
      return toast('Ya tienes una solicitud pendiente', 'error');
    }

    t.listaEspera.push({
      equipo: {
        id: equipo.id,
        nombre: equipo.nombre,
        escudo: equipo.escudo,
        capitanId: equipo.capitanId,
        jugadores: (equipo.jugadores || []).map(j => j.id)
      },
      fecha: new Date().toISOString(),
      tipo: 'solicitud',
      estado: 'pendiente'
    });

    guardarTorneo(t);

    // Notificar al organizador
    agregarNotificacion({
      para: t.organizador.id,
      tipo: 'postulacion',
      mensaje: `${equipo.escudo} ${equipo.nombre} quiere unirse a "${t.nombre}"`,
      link: `#/torneo/${t.id}`
    });

    cerrarModal('modal-inscribir-equipo');
    toast('Solicitud enviada al organizador', 'success');
    render();
  }

  /* =========================================================
     ACEPTAR / RECHAZAR INVITACIÓN
     ========================================================= */
  function aceptarInvitacion(t) {
    const inv = miInvitacionPendiente(t);
    if (!inv) return;

    if ((t.equipos || []).length >= t.cuposEquipos) {
      return toast('El torneo se llenó mientras decidías', 'error');
    }

    // Mover de invitaciones a equipos
    inv.estado = 'aceptada';
    t.equipos = t.equipos || [];
    t.equipos.push(inv.equipo);

    // Quitar de invitaciones
    t.invitaciones = (t.invitaciones || []).filter(i => i !== inv);
    sincronizarChatTorneo(t);
    guardarTorneo(t);

    // Notificar al organizador
    agregarNotificacion({
      para: t.organizador.id,
      tipo: 'aprobado',
      mensaje: `${inv.equipo.escudo} ${inv.equipo.nombre} aceptó la invitación a "${t.nombre}"`,
      link: `#/torneo/${t.id}`
    });

    toast('¡Te uniste al torneo!', 'success');
    render();
  }

  function rechazarInvitacion(t) {
    const inv = miInvitacionPendiente(t);
    if (!inv) return;
    inv.estado = 'rechazada';
    guardarTorneo(t);

    agregarNotificacion({
      para: t.organizador.id,
      tipo: 'rechazado',
      mensaje: `${inv.equipo.escudo} ${inv.equipo.nombre} rechazó la invitación a "${t.nombre}"`,
      link: `#/torneo/${t.id}`
    });

    toast('Invitación rechazada', 'info');
    render();
  }

  /* =========================================================
     CANCELAR SOLICITUD
     ========================================================= */
  function cancelarSolicitud(t) {
    const sol = miSolicitudPendiente(t);
    if (!sol) return;
    if (!confirm('¿Cancelar tu solicitud de inscripción?')) return;

    t.listaEspera = (t.listaEspera || []).filter(l => l !== sol);
    guardarTorneo(t);
    toast('Solicitud cancelada', 'info');
    render();
  }

  /* =========================================================
     GESTIONAR SOLICITUDES (organizador)
     ========================================================= */
  function abrirGestionSolicitudes(t) {
    renderSolicitudes(t, 'pendientes');
    abrirModal('modal-gestionar-solicitudes');
  }

  /* ---------- Selección múltiple de solicitudes ---------- */
  let seleccionadas = new Set();

  function renderSolicitudes(t, tab) {
    const cont = document.getElementById('lista-solicitudes');
    if (!cont) return;

    // Marcar tab activa
    document.querySelectorAll('[data-tab-sol]').forEach(el => {
      el.classList.toggle('active', el.dataset.tabSol === tab);
    });

    // Contadores
    const pendientes = (t.listaEspera || []).filter(l => l.estado === 'pendiente');
    const aceptados  = (t.listaEspera || []).filter(l => l.estado === 'aceptado');
    const rechazados = (t.listaEspera || []).filter(l => l.estado === 'rechazado');

    document.getElementById('count-sol-pendientes').textContent = pendientes.length;
    document.getElementById('count-sol-aceptados').textContent = aceptados.length;
    document.getElementById('count-sol-rechazados').textContent = rechazados.length;

    let lista;
    if (tab === 'pendientes') lista = pendientes;
    else if (tab === 'aceptados') lista = aceptados;
    else lista = rechazados;

    // Stats arriba
    const total = (t.listaEspera || []).length;
    const statsHtml = `
      <div class="torneo-stats-bar">
        <div class="torneo-stat-mini">
          <div class="torneo-stat-mini__valor">${(t.equipos || []).length}</div>
          <div class="torneo-stat-mini__label">Equipos</div>
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

    // Acciones en bloque (solo en pendientes)
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
          ${sol.equipo.escudo}
        </div>
        <div class="solicitud-item__info" data-ver="${i}" style="cursor:pointer">
          <div class="solicitud-item__nombre">${sol.equipo.nombre}</div>
          <div class="solicitud-item__meta">
            ${sol.tipo === 'invitacion-aceptada' ? '✅ Aceptó tu invitación' : '📩 Solicitó unirse'} ·
            ${new Date(sol.fecha).toLocaleDateString('es-CL')}
            · 👥 ${(sol.equipo.jugadores || []).length} jugadores
          </div>
        </div>
        <div class="solicitud-item__actions">
          <button class="btn btn--ghost btn--sm" data-ver-btn="${i}">👁️ Ver</button>
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

    /* ---------- Conectar acciones ---------- */

    // Ver equipo
    cont.querySelectorAll('[data-ver], [data-ver-btn]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.ver ?? el.dataset.verBtn);
        verDetalleEquipo(lista[idx].equipo);
      });
    });

    // Aprobar individual
    cont.querySelectorAll('[data-aceptar]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.aceptar);
        aprobarSolicitud(t, lista[idx]);
      });
    });

    // Rechazar individual
    cont.querySelectorAll('[data-rechazar]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.rechazar);
        rechazarSolicitud(t, lista[idx]);
      });
    });

    // Expulsar equipo ya inscrito
    cont.querySelectorAll('[data-expulsar]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.expulsar);
        expulsarEquipo(t, lista[idx].equipo);
      });
    });

    // ---------- Acciones en bloque ----------
    const checkboxes = cont.querySelectorAll('input[data-sel]');
    const btnAprobarLote = document.getElementById('btn-aprobar-lote');
    const btnRechazarLote = document.getElementById('btn-rechazar-lote');
    const btnSeleccionarTodas = document.getElementById('btn-seleccionar-todas');

    function actualizarLote() {
      const marcadas = cont.querySelectorAll('input[data-sel]:checked').length;
      if (btnAprobarLote) btnAprobarLote.disabled = marcadas === 0;
      if (btnRechazarLote) btnRechazarLote.disabled = marcadas === 0;
    }

    checkboxes.forEach(cb => {
      cb.addEventListener('change', actualizarLote);
    });

    btnSeleccionarTodas?.addEventListener('click', () => {
      const todasMarcadas = [...checkboxes].every(cb => cb.checked);
      checkboxes.forEach(cb => cb.checked = !todasMarcadas);
      actualizarLote();
      btnSeleccionarTodas.textContent = todasMarcadas ? 'Seleccionar todas' : 'Deseleccionar todas';
    });

    btnAprobarLote?.addEventListener('click', () => {
      const marcadas = [...cont.querySelectorAll('input[data-sel]:checked')].map(cb => Number(cb.dataset.sel));
      aprobarLote(t, marcadas.map(i => lista[i]));
    });

    btnRechazarLote?.addEventListener('click', () => {
      const marcadas = [...cont.querySelectorAll('input[data-sel]:checked')].map(cb => Number(cb.dataset.sel));
      if (marcadas.length === 0) return;
      if (!confirm(`¿Rechazar ${marcadas.length} solicitud(es)?`)) return;
      marcadas.forEach(i => rechazarSolicitud(t, lista[i], true));
      renderSolicitudes(t, tab);
      render();
    });
  }

  function aprobarSolicitud(t, sol) {
    if ((t.equipos || []).length >= t.cuposEquipos) {
      return toast('El torneo ya está lleno', 'error');
    }

    sol.estado = 'aceptado';
    t.equipos = t.equipos || [];
    t.equipos.push(sol.equipo);

    // Si se llenó → rechazar automáticamente los pendientes
    if (t.equipos.length >= t.cuposEquipos) {
      (t.listaEspera || []).forEach(l => {
        if (l.estado === 'pendiente') {
          l.estado = 'rechazado';
          agregarNotificacion({
            para: l.equipo.capitanId,
            tipo: 'cierre',
            mensaje: `El torneo "${t.nombre}" se llenó. Tu solicitud fue rechazada.`,
            link: `#/torneo/${t.id}`
          });
        }
      });
    }
        // Sincronizar participantes del chat
    sincronizarChatTorneo(t);

    guardarTorneo(t);

    agregarNotificacion({
      para: sol.equipo.capitanId,
      tipo: 'aprobado',
      mensaje: `¡Tu equipo ${sol.equipo.escudo} ${sol.equipo.nombre} fue aceptado en "${t.nombre}"!`,
      link: `#/torneo/${t.id}`
    });

    toast('Solicitud aprobada', 'success');
    renderSolicitudes(t, 'pendientes');
    render();
  }

  function rechazarSolicitud(t, sol, silencioso = false) {
    sol.estado = 'rechazado';
    guardarTorneo(t);

    agregarNotificacion({
      para: sol.equipo.capitanId,
      tipo: 'rechazado',
      mensaje: `Tu solicitud a "${t.nombre}" fue rechazada`,
      link: `#/torneo/${t.id}`
    });

    if (!silencioso) {
      toast('Solicitud rechazada', 'info');
      renderSolicitudes(t, 'pendientes');
      render();
    }
  }

  /* ---------- Tabs de solicitudes ---------- */
  document.querySelectorAll('[data-tab-sol]').forEach(tab => {
    tab.addEventListener('click', () => {
      const t = getTorneoPorId(id);
      if (t) renderSolicitudes(t, tab.dataset.tabSol);
    });
  });

  /* =========================================================
     INVITAR EQUIPO (organizador)
     ========================================================= */
  function abrirInvitarEquipo(t) {
    renderEquiposInvitar(t, '');
    abrirModal('modal-invitar-equipo');
  }

  function renderEquiposInvitar(t, filtro) {
    const cont = document.getElementById('lista-equipos-invitar');
    if (!cont) return;

    // Fuente de equipos: catálogo + equipos del store
    const catalogo = getClubesDisponibles();
    const propios = getEquipos();
    const todos = [...propios];

    // Agregar los del catálogo que no estén ya
    catalogo.forEach(c => {
      if (!todos.find(e => e.id === c.id)) {
        todos.push({
          id: c.id,
          nombre: c.nombre,
          escudo: c.escudo,
          deporte: c.deporte,
          capitanId: c.capitanId,
          jugadores: []
        });
      }
    });

    // Excluir los que ya están en el torneo o tienen invitación pendiente
    const excluidos = new Set([
      ...(t.equipos || []).map(e => e.id),
      ...(t.listaEspera || []).filter(l => l.estado === 'pendiente').map(l => l.equipo.id),
      ...(t.invitaciones || []).filter(i => i.estado === 'pendiente').map(i => i.equipoId)
    ]);

    const f = filtro.toLowerCase().trim();
    const filtrados = todos.filter(eq => {
      if (excluidos.has(eq.id)) return false;
      if (eq.capitanId === user.id) return false; // no auto-invitarse
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
          ${eq.escudo}
        </div>
        <div class="amigo-item__info">
          <div class="amigo-item__name">${eq.nombre}</div>
          <div class="amigo-item__sub">${eq.deporte || 'Sin deporte'}</div>
        </div>
        <button class="btn btn--primary btn--sm" data-invitar="${eq.id}">+ Invitar</button>
      </div>
    `).join('');

    cont.querySelectorAll('[data-invitar]').forEach(btn => {
      btn.addEventListener('click', () => {
        const eqId = Number(btn.dataset.invitar);
        enviarInvitacion(t, eqId);
      });
    });
  }

  function enviarInvitacion(t, equipoId) {
    const eq = getEquipos().find(e => e.id === equipoId)
      || getClubesDisponibles().find(c => c.id === equipoId);
    if (!eq) return;

    // Verificar que no esté ya
    if ((t.invitaciones || []).some(i => i.equipoId === equipoId && i.estado === 'pendiente')) {
      return toast('Ya invitaste a ese equipo', 'error');
    }

    t.invitaciones = t.invitaciones || [];
    t.invitaciones.push({
      equipoId,
      equipo: {
        id: eq.id,
        nombre: eq.nombre,
        escudo: eq.escudo,
        capitanId: eq.capitanId,
        jugadores: []
      },
      fecha: new Date().toISOString(),
      estado: 'pendiente'
    });

    guardarTorneo(t);

    // Notificar al capitán
    if (eq.capitanId) {
      agregarNotificacion({
        para: eq.capitanId,
        tipo: 'invitacion',
        mensaje: `Te invitaron al torneo "${t.nombre}" con ${eq.escudo} ${eq.nombre}`,
        link: `#/torneo/${t.id}`
      });
    }

    toast(`Invitación enviada a ${eq.nombre}`, 'success');

    // Re-render
    const input = document.getElementById('buscar-equipo-invitar');
    renderEquiposInvitar(t, input?.value || '');
  }

  document.getElementById('buscar-equipo-invitar')?.addEventListener('input', (e) => {
    const t = getTorneoPorId(id);
    if (t) renderEquiposInvitar(t, e.target.value);
  });

  /* =========================================================
     CHAT DEL TORNEO
     ========================================================= */
  function abrirChatTorneo(t) {
    import('../store.js').then(({ marcarLeidoGrupo }) => {
    marcarLeidoGrupo(t.canalChatId, user.id);
    });
    const chatId = t.canalChatId || `torneo-${t.id}`;
    document.getElementById('chat-torneo-titulo').textContent = `💬 ${t.nombre}`;

    renderMensajesChat(t, chatId);

    // Conectar form
    const form = document.getElementById('chat-torneo-form');
    form.onsubmit = (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-torneo-input');
      const texto = input.value.trim();
      if (!texto) return;

      agregarMensaje(chatId, {
        id: Date.now(),
        autorId: user.id,
        autorNombre: user.nombre,
        avatar: user.avatar,
        texto,
        fecha: new Date().toISOString()
      });

      input.value = '';
      renderMensajesChat(t, chatId);
    };

    abrirModal('modal-chat-torneo');
  }

  function renderMensajesChat(t, chatId) {
    const cont = document.getElementById('chat-torneo-mensajes');
    if (!cont) return;

    const msgs = getMensajesDeCanal(chatId);

    if (msgs.length === 0) {
      cont.innerHTML = `
        <div class="chat-mensajes__empty">
          <div style="font-size:48px">💬</div>
          <p class="mt-4">Aún no hay mensajes.</p>
          <p class="text-xs" style="margin-top:4px">¡Sé el primero en escribir!</p>
        </div>`;
      return;
    }

    cont.innerHTML = msgs.map(m => {
      const esMio = m.autorId === user.id;
      return `
        <div class="msg ${esMio ? 'msg--yo' : ''}">
          ${!esMio ? `<img src="${m.avatar}" class="msg__avatar" alt="" />` : ''}
          <div class="msg__burbuja">
            ${!esMio ? `<div class="msg__autor">${m.autorNombre}</div>` : ''}
            <div class="msg__texto">${escapeHtml(m.texto)}</div>
            <div class="msg__hora">${horaCorta(m.fecha)}</div>
          </div>
        </div>
      `;
    }).join('');

    cont.scrollTop = cont.scrollHeight;
  }

  /* =========================================================
     HELPERS
     ========================================================= */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function horaCorta(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  }
    /* =========================================================
     VER DETALLE DE EQUIPO
     ========================================================= */
  function verDetalleEquipo(equipoData) {
    const equipoCompleto = getEquipos().find(e => e.id === equipoData.id)
      || getClubesDisponibles().find(c => c.id === equipoData.id);

    const equipo = equipoCompleto || equipoData;

    document.getElementById('ver-equipo-titulo').textContent = `${equipo.escudo} ${equipo.nombre}`;

    const jugadores = equipo.jugadores || [];

    // 1) Primero pintar el HTML
    document.getElementById('ver-equipo-body').innerHTML = `
      <div class="ver-equipo__header">
        <div class="ver-equipo__escudo">${equipo.escudo || 'assets/icons/escudo-de-seguridad.png'}</div>
        <div>
          <div class="ver-equipo__nombre">${equipo.nombre}</div>
          <div class="ver-equipo__meta">
            ${equipo.deporte || 'Sin deporte'}${equipo.ciudad ? ' · ' + equipo.ciudad : ''}
          </div>
        </div>
      </div>

      ${equipo.descripcion ? `
        <p class="text-sm text-muted mb-4">${equipo.descripcion}</p>
      ` : ''}

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
            const jug = typeof j === 'object' ? j : { id: j, nombre: 'Jugador #' + j, avatar: `https://i.pravatar.cc/100?u=${j}`, posicion: '', dorsal: null };
            const capitan = jug.id === equipo.capitanId;
            return `
              <div class="player-row">
                <div class="player-row__pos">${jug.posicion ? jug.posicion.slice(0, 3).toUpperCase() : '—'}</div>
                <img src="${jug.avatar}" class="avatar avatar--md" alt="" data-autor-id="${jug.id}" style="cursor:pointer" />
                <div style="flex:1; min-width:0">
                  <div class="feed-item__title">
                    ${jug.nombre}
                    ${capitan ? '<span class="badge badge--primary" style="margin-left:6px">👑 Capitán</span>' : ''}
                  </div>
                  <div class="feed-item__subtitle">
                    ${jug.posicion || 'Sin posición'}${jug.dorsal ? ' · #' + jug.dorsal : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;

    // 2) Ahora sí conectar los clicks (DESPUÉS de que el HTML existe)
    document.getElementById('ver-equipo-body').querySelectorAll('[data-autor-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        import('../components.js').then(({ verPerfilUsuario }) => {
          verPerfilUsuario(Number(el.dataset.autorId));
        });
      });
    });

    // Cerrar
    document.querySelectorAll('#modal-ver-equipo [data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-ver-equipo');
    });
    document.getElementById('modal-ver-equipo').onclick = (e) => {
      if (e.target.id === 'modal-ver-equipo') cerrarModal('modal-ver-equipo');
    };

    abrirModal('modal-ver-equipo');
  }

  /* =========================================================
     APROBAR / RECHAZAR EN LOTE
     ========================================================= */
  function aprobarLote(t, solicitudes) {
    const cuposLibres = t.cuposEquipos - (t.equipos || []).length;
    let aprobadas = 0;
    let rechazadasPorFalta = 0;

    solicitudes.forEach(sol => {
      if (sol.estado !== 'pendiente') return;
      if (aprobadas >= cuposLibres) {
        rechazadasPorFalta++;
        return;
      }
      sol.estado = 'aceptado';
      t.equipos.push(sol.equipo);
      aprobadas++;

      agregarNotificacion({
        para: sol.equipo.capitanId,
        tipo: 'aprobado',
        mensaje: `¡Tu equipo ${sol.equipo.escudo} ${sol.equipo.nombre} fue aceptado en "${t.nombre}"!`,
        link: `#/torneo/${t.id}`
      });
    });

    // Si se llenó → rechazar pendientes
    if ((t.equipos || []).length >= t.cuposEquipos) {
      (t.listaEspera || []).forEach(l => {
        if (l.estado === 'pendiente') {
          l.estado = 'rechazado';
          agregarNotificacion({
            para: l.equipo.capitanId,
            tipo: 'cierre',
            mensaje: `El torneo "${t.nombre}" se llenó. Tu solicitud fue rechazada.`,
            link: `#/torneo/${t.id}`
          });
        }
      });
    }
    sincronizarChatTorneo(t);

    guardarTorneo(t);
    toast(`Aprobadas ${aprobadas} solicitud(es)${rechazadasPorFalta > 0 ? `, ${rechazadasPorFalta} sin cupo` : ''}`, 'success');

    renderSolicitudes(t, 'pendientes');
    render();
  }

  /* =========================================================
     EXPULSAR EQUIPO DEL TORNEO
     ========================================================= */
  function expulsarEquipo(t, equipo) {
    if (!confirm(`¿Sacar a ${equipo.escudo} ${equipo.nombre} del torneo? Se le notificará.`)) return;

    t.equipos = (t.equipos || []).filter(e => e.id !== equipo.id);
    t.listaEspera = (t.listaEspera || []).map(l => {
      if (l.equipo.id === equipo.id) {
        return { ...l, estado: 'rechazado' };
      }
      return l;
    });
    sincronizarChatTorneo(t);

    guardarTorneo(t);

    agregarNotificacion({
      para: equipo.capitanId,
      tipo: 'expulsado',
      mensaje: `Tu equipo ${equipo.escudo} ${equipo.nombre} fue retirado del torneo "${t.nombre}"`,
      link: `#/torneo/${t.id}`
    });

    toast('Equipo retirado del torneo', 'info');
    renderSolicitudes(t, 'aceptados');
    render();
  }
    /* =========================================================
     SINCRONIZAR PARTICIPANTES DEL CHAT DEL TORNEO
     ========================================================= */
  function sincronizarChatTorneo(t) {
    import('../store.js').then(({ guardarChatGrupo, getChatGrupoPorId }) => {
      const chatId = t.canalChatId || `torneo-${t.id}`;
      const existente = getChatGrupoPorId(chatId);

      // Juntar todos los que deben estar: organizador + capitanes + jugadores de equipos inscritos
      const participantes = new Set();
      participantes.add(t.organizador.id);

      (t.equipos || []).forEach(eq => {
        if (eq.capitanId) participantes.add(eq.capitanId);
        (eq.jugadores || []).forEach(jid => participantes.add(jid));
      });

      guardarChatGrupo({
        id: chatId,
        tipo: 'torneo',
        nombre: t.nombre,
        icono: t.emoji,
        refId: t.id,
        participantes: [...participantes],
        adminId: t.organizador.id,
        creado: existente?.creado || new Date().toISOString()
      });
    });
  }

  /* =========================================================
     RENDER INICIAL
     ========================================================= */
  render();

  return null;
  
}