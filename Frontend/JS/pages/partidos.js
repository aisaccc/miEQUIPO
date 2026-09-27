import { formatearFecha, toast, abrirModal, cerrarModal } from '../components.js';
import { deportes, posicionesPorDeporte, nivelesPartido } from '../data-mock.js';
import { getSesion } from '../auth.js';
import { getPartidos, guardarPartidos } from '../store.js';

export async function init() {
  /* ---------- ESTADO ---------- */
  let partidos = getPartidos();
  let filtroActual = 'todos';
  let tabActual = 'disponibles';
  const user = getSesion();

  /* ---------- REFS ---------- */
  const contDisponibles  = document.getElementById('lista-partidos');
  const contCreados      = document.getElementById('lista-creados');
  const contInscritos    = document.getElementById('lista-inscritos');
  const panelDisponibles = document.getElementById('panel-disponibles');
  const panelCreados     = document.getElementById('panel-creados');
  const panelInscritos   = document.getElementById('panel-inscritos');
  const subtabs          = document.querySelectorAll('[data-tab-partidos]');
  const chips            = document.querySelectorAll('[data-filtro]');
  const btnCrear         = document.getElementById('btn-crear-partido');
  const btnCrear2        = document.getElementById('btn-crear-partido-2');

  if (!contDisponibles) return null;

  /* ---------- MAPA DE EMOJIS ---------- */
  const emojiDeporte = {
    'Fútbol': '⚽', 'Básquetbol': '🏀', 'Tenis': '🎾', 'Vóleibol': '🏐',
    'Pádel': '🎾', 'Golf': '⛳', 'Béisbol': '⚾', 'Hockey': '🏒',
    'Boxeo': '🥊', 'Bádminton': '🏸', 'Rugby': '🏉', 'Ciclismo': '🚴',
    'Natación': '🏊', 'Atletismo': '🏃', 'Tenis de mesa': '🏓',
    'Squash': '🎾', 'Handball': '🤾', 'Fútbol americano': '🏈',
    'Surf': '🏄', 'Escalada': '🧗'
  };

  function cantidadInscritos(p) {
    return Array.isArray(p.inscritos) ? p.inscritos.length : (p.inscritos || 0);
  }

  /* =========================================================
     RENDER DE UNA CARD DE PARTIDO
     ========================================================= */
  function renderCard(p, opciones = {}) {
    const { mostrarAcciones = false, mostrarBadgeRol = null } = opciones;
    const inscritosCount = cantidadInscritos(p);
    const porcentaje = Math.min(100, Math.round((inscritosCount / p.cupos) * 100));

    const badgeClase =
      p.estado === 'lleno'      ? 'badge--danger'  :
      p.estado === 'finalizado' ? 'badge--neutral' :
                                  'badge--success';
    const badgeTexto =
      p.estado === 'lleno'      ? 'Lleno'      :
      p.estado === 'finalizado' ? 'Finalizado' :
                                  'Abierto';

    const precioHtml = p.precio === 0
      ? `<span class="match-card__precio match-card__precio--gratis">🎉 Gratis</span>`
      : `<span class="match-card__precio match-card__precio--pago">💰 $${p.precio.toLocaleString('es-CL')}</span>`;

    const nivelLabel = {
      amistoso: 'Amistoso',
      semiprofesional: 'Semiprofesional',
      profesional: 'Profesional'
    }[p.nivel] || p.nivel;

    const nivelHtml = `<span class="nivel-badge nivel-badge--${p.nivel}">${nivelLabel}</span>`;

    const aprobacionHtml = p.aprobacionRequerida
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

    const accionesHtml = mostrarAcciones ? `
      <div class="match-card__acciones" style="display:flex; gap:6px; margin-top:var(--space-3); padding-top:var(--space-3); border-top:1px solid var(--color-border);">
        <button class="btn btn--ghost btn--sm" data-accion="editar" data-id="${p.id}">✏️ Editar</button>
        <button class="btn btn--ghost btn--sm" data-accion="postulantes" data-id="${p.id}">👥 Postulantes</button>
        <button class="btn btn--ghost btn--sm" data-accion="eliminar" data-id="${p.id}" style="color:var(--color-danger)">🗑️</button>
      </div>
    ` : '';

    return `
      <article class="match-card" data-id="${p.id}">
        <div class="match-card__header">
          <div class="match-card__sport">${p.emoji}</div>
          <div style="display:flex; gap:6px; align-items:center">
            ${badgeRolHtml}
            <span class="badge ${badgeClase}">${badgeTexto}</span>
          </div>
        </div>

        <h3 class="match-card__title">${p.titulo}</h3>

        <div class="flex gap-2 mb-4" style="flex-wrap:wrap">
          ${nivelHtml}
          ${precioHtml}
          ${aprobacionHtml}
        </div>

        ${posicionesBuscadasHtml}

        <div class="match-card__info">
          <span>📅 ${formatearFecha(p.fecha)}</span>
          <span>📍 ${p.lugar}</span>
          ${p.organizador?.id ? `
            <span data-autor-id="${p.organizador.id}" style="cursor:pointer; color:var(--color-primary-dark); text-decoration:underline">
              👤 ${p.organizador.nombre}
            </span>
          ` : ''}
        </div>
        <div class="match-card__footer">
          <div class="match-card__progress">
            <div class="match-card__progress-bar" style="width:${porcentaje}%"></div>
          </div>
          <span class="text-xs text-muted">${inscritosCount}/${p.cupos}</span>
        </div>

        ${accionesHtml}
      </article>
    `;
  }

  /* =========================================================
     RENDERS DE PANELES
     ========================================================= */
  function renderDisponibles() {
    let lista = partidos;
    if (filtroActual === 'abiertos')    lista = partidos.filter(p => p.estado === 'abierto');
    if (filtroActual === 'llenos')      lista = partidos.filter(p => p.estado === 'lleno');

    if (lista.length === 0) {
      contDisponibles.innerHTML = `
        <div class="card" style="grid-column: 1 / -1;">
          <div class="empty-state">
            <div class="empty-state__icon">🔍</div>
            <p>No hay partidos con este filtro.</p>
          </div>
        </div>`;
      return;
    }

    contDisponibles.innerHTML = lista.map(p => renderCard(p)).join('');
    conectarClicksCards(contDisponibles);
  }

  function renderCreados() {
    const misCreados = partidos.filter(p => p.organizador?.id === user?.id);

    document.getElementById('count-creados').textContent = misCreados.length;

    if (misCreados.length === 0) {
      contCreados.innerHTML = `
        <div class="card" style="grid-column: 1 / -1;">
          <div class="empty-state">
            <div class="empty-state__icon">👑</div>
            <p>Aún no has creado ningún partido.</p>
            <button class="btn btn--primary mt-4" id="btn-vacio-crear">+ Crear mi primer partido</button>
          </div>
        </div>`;
      document.getElementById('btn-vacio-crear')?.addEventListener('click', abrirModalCrear);
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
      if (p.organizador?.id === user?.id) return false;
      return (p.inscritos || []).includes(user?.id);
    });

    document.getElementById('count-inscritos').textContent = misInscritos.length;

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
  }

  /* =========================================================
     CONECTAR CLICKS
     ========================================================= */
  function conectarClicksCards(contenedor) {
    contenedor.querySelectorAll('.match-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-accion]')) return;
        const id = Number(card.dataset.id);
        window.location.hash = `#/partido/${id}`;
      });
    });
        contenedor.querySelectorAll('[data-autor-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        import('../components.js').then(({ verPerfilUsuario }) => {
          verPerfilUsuario(Number(el.dataset.autorId));
        });
      });
    });
  }

  function conectarAccionesCard(contenedor) {
    contenedor.querySelectorAll('[data-accion]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        const accion = btn.dataset.accion;

        if (accion === 'editar' || accion === 'postulantes') {
          window.location.hash = `#/partido/${id}`;
        }
        if (accion === 'eliminar') {
          if (!confirm('¿Eliminar este partido? Se notificará a todos los inscritos.')) return;
          import('../store.js').then(({ eliminarPartido, agregarNotificacion }) => {
            const partido = partidos.find(p => p.id === id);
            (partido?.inscritos || []).forEach(uid => {
              if (uid === partido.organizador.id) return;
              agregarNotificacion({
                para: uid,
                tipo: 'cancelacion',
                mensaje: `El partido "${partido.titulo}" fue cancelado por el organizador`,
                link: '#/partidos'
              });
            });
            eliminarPartido(id);
            partidos = getPartidos();
            toast('Partido eliminado', 'info');
            renderTodo();
          });
        }
      });
    });
  }

  /* =========================================================
     SUB-PESTAÑAS + FILTROS
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

  /* =========================================================
     MODAL CREAR PARTIDO — SETUP
     ========================================================= */

  // Select de deportes
  const selectDeporte = document.getElementById('partido-deporte');
  if (selectDeporte) {
    selectDeporte.innerHTML = '<option value="">Selecciona un deporte...</option>' +
      deportes.map(d => `<option value="${d}">${d}</option>`).join('');
  }

  // Grid de niveles
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

  // Click en nivel
  document.querySelectorAll('.nivel-opcion').forEach(op => {
    op.addEventListener('click', () => {
      document.querySelectorAll('.nivel-opcion').forEach(o => o.classList.remove('active'));
      op.classList.add('active');
      nivelSeleccionado = op.dataset.nivel;
      actualizarAvisoAprobacion();
    });
  });

  /* ---------- HELPERS DE NIVEL ---------- */
  function nivelRequiereAprobacion() {
    const nivel = nivelesPartido.find(n => n.valor === nivelSeleccionado);
    if (!nivel) return false;

    if (nivel.eleccionAprobacion) {
      const check = document.getElementById('partido-requiere-aprobacion');
      return check ? check.checked : false;
    }

    return nivel.requiereAprobacion === true;
  }

  /* ---------- ACTUALIZAR AVISO / ELECCIÓN DE APROBACIÓN ---------- */
  function actualizarAvisoAprobacion() {
    const nivel = nivelesPartido.find(n => n.valor === nivelSeleccionado);
    const aviso = document.getElementById('aviso-aprobacion');
    const eleccion = document.getElementById('eleccion-aprobacion');

    // 1) Bloque elección (solo semi-pro)
    if (nivel?.eleccionAprobacion) {
      eleccion?.classList.remove('hidden');
    } else {
      eleccion?.classList.add('hidden');
      const check = document.getElementById('partido-requiere-aprobacion');
      if (check) check.checked = false;
    }

    // 2) Aviso naranjo (solo profesional)
    if (nivel?.requiereAprobacion === true) {
      aviso?.classList.add('show');
    } else {
      aviso?.classList.remove('show');
    }
  }

  /* ---------- ACTUALIZAR POSICIONES (según DEPORTE, independiente del nivel) ---------- */
  function actualizarPosiciones() {
    const deporte = document.getElementById('partido-deporte').value;
    const posiciones = posicionesPorDeporte[deporte] || [];
    const wrapper = document.getElementById('posiciones-wrapper');
    const lista = document.getElementById('posiciones-lista');
    const checkPedir = document.getElementById('partido-pedir-posiciones');

    // Reset
    posicionesActivas = [];
    if (checkPedir) checkPedir.checked = false;
    document.getElementById('posiciones-selector')?.classList.add('hidden');

    // Mostrar si el deporte tiene posiciones
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

  /* ---------- LISTENERS DEL MODAL ---------- */

  // Cambio de deporte → actualizar posiciones
  selectDeporte?.addEventListener('change', () => {
    actualizarPosiciones();
  });

  // Switch "Requiere aprobación" (semi-pro)
  const checkRequiereAprob = document.getElementById('partido-requiere-aprobacion');
  checkRequiereAprob?.addEventListener('change', () => {
    actualizarAvisoAprobacion();
  });

  // Switch "Gratis"
  const checkGratis = document.getElementById('partido-gratis');
  const precioWrapper = document.getElementById('precio-wrapper');
  checkGratis?.addEventListener('change', () => {
    precioWrapper?.classList.toggle('hidden', checkGratis.checked);
  });

  // Switch "Pedir posición"
  const checkPedirPos = document.getElementById('partido-pedir-posiciones');
  const selectorPos   = document.getElementById('posiciones-selector');
  checkPedirPos?.addEventListener('change', () => {
    selectorPos?.classList.toggle('hidden', !checkPedirPos.checked);
  });

  /* ---------- RESET FORMULARIO ---------- */
  function resetearFormulario() {
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
    document.querySelectorAll('.nivel-opcion').forEach((o, i) => {
      o.classList.toggle('active', i === 0);
    });

    posicionesActivas = [];
  }

  /* ---------- ABRIR MODAL ---------- */
  function abrirModalCrear() {
    resetearFormulario();
    abrirModal('modal-crear-partido');
  }

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
     GUARDAR PARTIDO
     ========================================================= */
  document.getElementById('btn-guardar-partido')?.addEventListener('click', () => {
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
    if (!fecha)     return toast('Selecciona una fecha', 'error');
    if (!hora)      return toast('Selecciona una hora', 'error');
    if (!lugar)     return toast('Ingresa un lugar', 'error');
    if (cupos < 2)  return toast('Los cupos deben ser al menos 2', 'error');
    if (!esGratis && precio < 0) return toast('El precio no puede ser negativo', 'error');
    if (pedirPos && posicionesActivas.length === 0) {
      return toast('Selecciona al menos una posición', 'error');
    }

    const nuevo = {
      id: Date.now(),
      deporte,
      emoji: emojiDeporte[deporte] || '🏅',
      titulo,
      fecha: `${fecha}T${hora}:00`,
      lugar,
      cupos,
      estado: 'abierto',
      precio,
      nivel: nivelSeleccionado,
      pedirPosiciones: pedirPos,
      posiciones: pedirPos ? [...posicionesActivas] : [],
      aprobacionRequerida: nivelRequiereAprobacion(),
      descripcion,
      organizador: {
        id: user?.id,
        nombre: user?.nombre || 'Tú',
        avatar: user?.avatar
      },
      inscritos: user?.id ? [user.id] : [],
      postulantes: []
    };

    partidos.unshift(nuevo);
    guardarPartidos(partidos);

    filtroActual = 'todos';
    chips.forEach(c => c.classList.toggle('chip--active', c.dataset.filtro === 'todos'));
    renderTodo();
    cambiarTab('creados');

    cerrarModal('modal-crear-partido');
    toast('¡Partido publicado!', 'success');
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
    chips.forEach(chip => chip.removeEventListener('click', handleChip));
  };
}