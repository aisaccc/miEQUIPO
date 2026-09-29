import { formatearFecha, toast, abrirModal, cerrarModal } from '../components.js';
import { deportes } from '../data-mock.js';
import { getSesion } from '../auth.js';
import {
  getTorneos, guardarTorneo, eliminarTorneo,
  agregarNotificacion
} from '../store.js';

export async function init() {
  const user = getSesion();

  /* ---------- ESTADO ---------- */
  let torneos = getTorneos();
  let filtroActual = 'todos';

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

  /* ---------- MAPA DE EMOJIS ---------- */
  const emojiDeporte = {
    'Fútbol': 'assets/icons/balon-de-futbol (2).png', 'Básquetbol': 'assets/icons/balocensto.svg', 'Tenis': 'pelota-de-tenis.png', 'Vóleibol': 'assets/icons/voleibol.svg',
    'Pádel': 'assets/icons/raqueta-de-padel.png', 'Golf': 'assets/icons/golf.png', 'Béisbol': 'assets/icons/beisbol.png', 'Hockey': 'assets/icons/disco.png',
    'Boxeo': 'assets/icons/guantes-de-boxeo.png', 'Bádminton': 'assets/icons/volante.png', 'Rugby': 'assets/icons/rugby.png', 'Ciclismo': 'assets/icons/bicicleta.svg',
    'Natación': 'assets/icons/natacion.svg', 'Atletismo': 'assets/icons/corriendo.png', 'Tenis de mesa': 'assets/icons/raqueta-de-tenis-de-mesa.png','Squash': 'assets/icons/tenis-de-squash.png', 'Handball': 'assets/icons/balonmano.png', 
    'Fútbol americano': 'assets/icons/deporte.svg', 'Surf': 'assets/icons/tabla-de-surf.png', 'Escalada': 'assets/icons/escalada.png'
  };

  /* =========================================================
     RENDER CARD
     ========================================================= */
  function renderCard(t, opciones = {}) {
    const { mostrarAcciones = false, mostrarBadgeRol = null } = opciones;

    const inscritosCount = (t.equipos || []).length;
    const enEspera = (t.listaEspera || []).filter(l => l.estado === 'pendiente').length;
    const porcentaje = Math.min(100, Math.round((inscritosCount / t.cuposEquipos) * 100));
    const lleno = inscritosCount >= t.cuposEquipos;

    const badgeClase = lleno ? 'badge--danger' :
      t.estado === 'inscripcion' ? 'badge--success' :
      t.estado === 'en_curso'    ? 'badge--warning' :
                                    'badge--neutral';
    const badgeTexto = lleno ? 'Lleno' :
      t.estado === 'inscripcion' ? 'Inscripción abierta' :
      t.estado === 'en_curso'    ? 'En curso' :
                                    'Finalizado';

    const precioHtml = t.precio === 0
      ? `<span class="match-card__precio match-card__precio--gratis">🎉 Gratis</span>`
      : `<span class="match-card__precio match-card__precio--pago">💰 $${t.precio.toLocaleString('es-CL')}/equipo</span>`;

    const badgeRolHtml = mostrarBadgeRol
      ? `<span class="badge badge--primary" style="margin-left:auto">${mostrarBadgeRol}</span>`
      : '';

    const accionesHtml = mostrarAcciones ? `
      <div class="match-card__acciones" style="display:flex; gap:6px; margin-top:var(--space-3); padding-top:var(--space-3); border-top:1px solid var(--color-border); flex-wrap:wrap">
        <button class="btn btn--ghost btn--sm" data-accion-torneo="editar" data-id="${t.id}">✏️ Editar</button>
        <button class="btn btn--ghost btn--sm" data-accion-torneo="gestionar" data-id="${t.id}">
          👥 Gestionar ${enEspera > 0 ? `<span class="badge badge--primary" style="margin-left:4px">${enEspera}</span>` : ''}
        </button>
        <button class="btn btn--ghost btn--sm" data-accion-torneo="eliminar" data-id="${t.id}" style="color:var(--color-danger)">🗑️</button>
      </div>
    ` : '';

    return `
      <article class="match-card" data-id="${t.id}" style="cursor:pointer">
        <div class="match-card__header">
          <div class="match-card__sport">${t.emoji}</div>
          <div style="display:flex; gap:6px; align-items:center">
            ${badgeRolHtml}
            <span class="badge ${badgeClase}">${badgeTexto}</span>
          </div>
        </div>

        <h3 class="match-card__title">${t.nombre}</h3>

        <div class="flex gap-2 mb-4" style="flex-wrap:wrap">
          ${precioHtml}
        </div>

        <div class="match-card__info">
          <span>🏅 ${t.deporte}</span>
          <span>📅 ${formatearFecha(t.fechaInicio)}</span>
          ${t.lugar ? `<span>📍 ${t.lugar}</span>` : ''}
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
          <span class="text-xs text-muted">${inscritosCount}/${t.cuposEquipos} equipos</span>
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
  }

  function renderCreados() {
    const misCreados = torneos.filter(t => t.organizador?.id === user?.id);

    document.getElementById('count-torneos-creados').textContent = misCreados.length;

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
      if (t.organizador?.id === user?.id) return false;
      return (t.equipos || []).some(e =>
        e.capitanId === user?.id || (e.jugadores || []).includes(user?.id)
      );
    });

    document.getElementById('count-torneos-inscritos').textContent = misInscritos.length;

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
  }

  /* =========================================================
     CONECTAR CLICKS
     ========================================================= */
  function conectarClicksCards(contenedor) {
    contenedor.querySelectorAll('.match-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-accion-torneo]')) return;
        const id = Number(card.dataset.id);
        window.location.hash = `#/torneo/${id}`;
      });
          contenedor.querySelectorAll('[data-autor-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        import('../components.js').then(({ verPerfilUsuario }) => {
          verPerfilUsuario(Number(el.dataset.autorId));
        });
      });
    });
    });
  }

  function conectarAcciones(contenedor) {
    contenedor.querySelectorAll('[data-accion-torneo]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        const accion = btn.dataset.accionTorneo;
        const torneo = torneos.find(t => t.id === id);
        if (!torneo) return;

        if (accion === 'editar') {
          abrirModalEditar(torneo);
        }
        if (accion === 'gestionar') {
          window.location.hash = `#/torneo/${id}`;
        }
        if (accion === 'eliminar') {
          if (!confirm(`¿Eliminar "${torneo.nombre}"? Se notificará a todos.`)) return;
          [...(torneo.equipos || []), ...(torneo.listaEspera || []).map(l => l.equipo)].forEach(eq => {
            agregarNotificacion({
              para: eq.capitanId,
              tipo: 'torneo_eliminado',
              mensaje: `El torneo "${torneo.nombre}" fue eliminado`,
              link: '#/torneos'
            });
          });
          eliminarTorneo(id);
          torneos = getTorneos();
          toast('Torneo eliminado', 'info');
          renderTodo();
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
     MODAL CREAR / EDITAR
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

  function resetearFormulario() {
    document.getElementById('torneo-nombre').value = '';
    document.getElementById('torneo-deporte').value = '';
    document.getElementById('torneo-fecha-inicio').value = '';
    document.getElementById('torneo-fecha-fin').value = '';
    document.getElementById('torneo-lugar').value = '';
    document.getElementById('torneo-equipos').value = '8';
    document.getElementById('torneo-gratis').checked = true;
    document.getElementById('torneo-precio').value = '20000';
    document.getElementById('torneo-descripcion').value = '';
    document.getElementById('torneo-precio-wrapper').classList.add('hidden');
  }

  /* ---------- ABRIR CREAR ---------- */
  function abrirModalCrear() {
    resetearFormulario();
    document.getElementById('torneo-modal-titulo').textContent = 'Crear torneo';
    document.getElementById('btn-guardar-torneo').textContent = 'Crear torneo';
    document.getElementById('btn-guardar-torneo').onclick = guardarNuevo;
    abrirModal('modal-crear-torneo');
  }

  /* ---------- ABRIR EDITAR ---------- */
  function abrirModalEditar(torneo) {
    document.getElementById('torneo-modal-titulo').textContent = 'Editar torneo';
    document.getElementById('btn-guardar-torneo').textContent = 'Guardar cambios';

    document.getElementById('torneo-nombre').value = torneo.nombre;
    document.getElementById('torneo-deporte').value = torneo.deporte;
    document.getElementById('torneo-fecha-inicio').value = torneo.fechaInicio;
    document.getElementById('torneo-fecha-fin').value = torneo.fechaFin || '';
    document.getElementById('torneo-lugar').value = torneo.lugar || '';
    document.getElementById('torneo-equipos').value = torneo.cuposEquipos;
    document.getElementById('torneo-descripcion').value = torneo.descripcion || '';

    const gratis = torneo.precio === 0;
    document.getElementById('torneo-gratis').checked = gratis;
    document.getElementById('torneo-precio').value = gratis ? '20000' : torneo.precio;
    document.getElementById('torneo-precio-wrapper').classList.toggle('hidden', gratis);

    document.getElementById('btn-guardar-torneo').onclick = () => guardarEdicion(torneo);
    abrirModal('modal-crear-torneo');
  }

  /* ---------- GUARDAR NUEVO ---------- */
  function guardarNuevo() {
    const datos = leerFormulario();
    if (!datos) return;

    const nuevo = {
      id: Date.now(),
      ...datos,
      emoji: emojiDeporte[datos.deporte] || '🏆',
      estado: 'inscripcion',
      organizador: {
        id: user?.id,
        nombre: user?.nombre || 'Tú',
        avatar: user?.avatar
      },
      equipos: [],
      listaEspera: [],
      invitaciones: [],
      canalChatId: `torneo-${Date.now()}`,
      creado: new Date().toISOString(),
      actualizado: new Date().toISOString()
    };

    torneos.unshift(nuevo);
    guardarTorneo(nuevo);
        // Crear el chat del torneo
    import('../store.js').then(({ guardarChatGrupo }) => {
      guardarChatGrupo({
        id: nuevo.canalChatId,
        tipo: 'torneo',
        nombre: nuevo.nombre,
        icono: nuevo.emoji,
        refId: nuevo.id,
        participantes: [nuevo.organizador.id],
        adminId: nuevo.organizador.id,
        creado: new Date().toISOString()
      });
    });

    filtroActual = 'todos';
    chips.forEach(c => c.classList.toggle('chip--active', c.dataset.filtroTorneo === 'todos'));
    renderTodo();
    cambiarTab('creados');

    cerrarModal('modal-crear-torneo');
    toast('¡Torneo creado!', 'success');
  }

  /* ---------- GUARDAR EDICIÓN ---------- */
  function guardarEdicion(torneo) {
    const datos = leerFormulario();
    if (!datos) return;

    const inscritosCount = (torneo.equipos || []).length;
    if (datos.cuposEquipos < inscritosCount) {
      return toast(`No puedes bajar de ${inscritosCount} cupos (ya hay ${inscritosCount} equipos)`, 'error');
    }

    const cambios = [];
    if (datos.nombre !== torneo.nombre)                cambios.push('nombre');
    if (datos.deporte !== torneo.deporte)              cambios.push('deporte');
    if (datos.fechaInicio !== torneo.fechaInicio)      cambios.push('fecha inicio');
    if (datos.fechaFin !== (torneo.fechaFin || ''))    cambios.push('fecha fin');
    if (datos.lugar !== torneo.lugar)                  cambios.push('lugar');
    if (datos.cuposEquipos !== torneo.cuposEquipos)    cambios.push('cupos');
    if (datos.precio !== torneo.precio)                cambios.push('precio');
    if (datos.descripcion !== (torneo.descripcion || '')) cambios.push('descripción');

    if (cambios.length === 0) {
      cerrarModal('modal-crear-torneo');
      return toast('No hay cambios que guardar', 'info');
    }

    const actualizado = {
      ...torneo,
      ...datos,
      emoji: emojiDeporte[datos.deporte] || '🏆'
    };

    guardarTorneo(actualizado);
    torneos = getTorneos();

    const listaCambios = cambios.join(', ');
    const equiposAvisar = [
      ...(torneo.equipos || []),
      ...(torneo.listaEspera || []).map(l => l.equipo)
    ];
    equiposAvisar.forEach(eq => {
      if (eq.capitanId === user?.id) return;
      agregarNotificacion({
        para: eq.capitanId,
        tipo: 'edicion',
        mensaje: `El torneo "${datos.nombre}" fue modificado (${listaCambios})`,
        link: `#/torneo/${torneo.id}`
      });
    });

    cerrarModal('modal-crear-torneo');
    toast(`Torneo actualizado (${listaCambios})`, 'success');
    renderTodo();
  }

  /* ---------- LEER FORMULARIO ---------- */
  function leerFormulario() {
    const nombre       = document.getElementById('torneo-nombre').value.trim();
    const deporte      = document.getElementById('torneo-deporte').value;
    const fechaInicio  = document.getElementById('torneo-fecha-inicio').value;
    const fechaFin     = document.getElementById('torneo-fecha-fin').value;
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

    return { nombre, deporte, fechaInicio, fechaFin, lugar, cuposEquipos, precio, descripcion };
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

  /* =========================================================
     RENDER GLOBAL
     ========================================================= */
  function renderTodo() {
    renderDisponibles();
    renderCreados();
    renderInscritos();
  }

  renderTodo();

  return () => {
    chips.forEach(c => c.removeEventListener('click', handleChip));
  };
}