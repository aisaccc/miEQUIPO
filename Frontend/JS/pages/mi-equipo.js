import { getSesion } from '../auth.js';
import { toast, abrirModal, cerrarModal } from '../components.js';
import { deportes } from '../data-mock.js';
import {
  listarGrupos,
  obtenerGrupo,
  crearGrupo as crearGrupoAPI,
  editarGrupo as editarGrupoAPI,
  editarStats as editarStatsAPI,
  eliminarGrupo as eliminarGrupoAPI,
  unirseAGrupo as unirseAGrupoAPI,
  salirDeGrupo as salirDeGrupoAPI,
  cancelarMiSolicitud as cancelarMiSolicitudAPI,
  expulsarMiembro as expulsarMiembroAPI,
  cambiarRolMiembro as cambiarRolMiembroAPI,
  listarSolicitudes as listarSolicitudesAPI,
  gestionarSolicitud as gestionarSolicitudAPI,
} from '../services/grupos.service.js';

/* ---------- CONSTANTES ---------- */
const RUTA_ESCUDO = 'assets/icons/escudo-de-seguridad.png';
const AVATAR_FALLBACK = 'assets/icons/usuario.svg';

/* =========================================================
   INIT
   ========================================================= */
export async function init() {
  const user = getSesion();
  if (!user) return null;

  const contenedorEquipo    = document.getElementById('equipo-contenido');
  const contenedorComunidad = document.getElementById('comunidad-contenido');

  if (!contenedorEquipo) return null;

  /* ---------- ESTADO ---------- */
  let misEquipos = [];
  let misComunidades = [];

  /* ---------- REFS ---------- */
  const subtabs        = document.querySelectorAll('[data-tab-equipo]');
  const panelEquipo    = document.getElementById('panel-equipo');
  const panelComunidad = document.getElementById('panel-comunidad');
  const panelChat      = document.getElementById('panel-chat');
  const panelBuscar    = document.getElementById('panel-buscar');

  /* ---------- HELPERS ---------- */
  function esIconoImagen(valor) {
    return typeof valor === 'string' && /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(valor);
  }

  function renderIconoHtml(valor, size = 20) {
    if (esIconoImagen(valor)) {
      return `<img src="${valor}" alt="icono" style="width:${size}px;height:${size}px;object-fit:contain;vertical-align:middle;display:inline-block" />`;
    }
    return `<span style="font-size:${size}px;line-height:1;vertical-align:middle">${valor || '🛡️'}</span>`;
  }

  /* ---------- CARGAR DESDE EL BACKEND ---------- */
  async function recargarGrupos() {
    try {
      const [resEquipos, resComunidades] = await Promise.all([
        listarGrupos({ tipo: 'equipo', soloMios: 'true', limit: 50 }),
        listarGrupos({ tipo: 'comunidad', soloMios: 'true', limit: 50 }),
      ]);

      misEquipos = resEquipos.data || [];
      misComunidades = resComunidades.data || [];
    } catch (err) {
      console.error('[mi-equipo] Error al cargar grupos:', err);
      toast('No se pudieron cargar tus grupos', 'error');
      misEquipos = [];
      misComunidades = [];
    }
  }

  /* =========================================================
     RENDER GENÉRICO DE UN GRUPO
     ========================================================= */
  function renderGrupo(grupo, contenedor, esComunidad) {
    const capitan = grupo.esCapitan;
    const admin   = grupo.esAdmin;
    const puedeEditarEste = capitan || admin;
    const miembrosCount = grupo.totalMiembros || 0;
    const solicitudesCount = grupo.totalSolicitudes || 0;

    const iconoTipo = esComunidad ? '🌐' : renderIconoHtml(RUTA_ESCUDO, 16);
    const labelTipo = esComunidad ? 'Comunidad' : 'Equipo';
    const labelMiembros = esComunidad ? 'miembros' : 'jugadores';

    contenedor.innerHTML = `
      <div class="card mb-4">
        <div class="team-header">
          <div class="team-header__crest">${renderIconoHtml(grupo.escudo, 48)}</div>
          <div style="flex:1; min-width:0">
            <div class="flex items-center gap-2" style="flex-wrap:wrap">
              <h2 class="card__title" style="font-size:var(--fs-xl); margin:0">${grupo.nombre}</h2>
              <span class="badge badge--primary">${iconoTipo} ${labelTipo}</span>
              <span class="badge ${grupo.tipoAcceso === 'privado' ? 'badge--warning' : 'badge--success'}">
                ${grupo.tipoAcceso === 'privado' ? '🔒 Privado' : '🌐 Público'}
              </span>
            </div>
            <p class="card__subtitle" style="margin-top:4px">
              ${grupo.deporte}${grupo.ciudad ? ' · ' + grupo.ciudad : ''} · ${miembrosCount} ${labelMiembros}
            </p>
            ${grupo.descripcion ? `<p class="text-sm text-muted mt-4">${grupo.descripcion}</p>` : ''}

            ${!esComunidad ? (
              (!grupo.statsPrivadas || puedeEditarEste || grupo.esMiembro) ? `
                <div class="stats-grid mt-4" style="grid-template-columns:repeat(3, 1fr); max-width:420px">
                  <div class="stat-box">
                    <div class="stat-box__value" style="color:var(--color-success)">${grupo.stats?.victorias || 0}</div>
                    <div class="stat-box__label">Victorias</div>
                  </div>
                  <div class="stat-box">
                    <div class="stat-box__value" style="color:var(--color-warning)">${grupo.stats?.empates || 0}</div>
                    <div class="stat-box__label">Empates</div>
                  </div>
                  <div class="stat-box">
                    <div class="stat-box__value" style="color:var(--color-danger)">${grupo.stats?.derrotas || 0}</div>
                    <div class="stat-box__label">Derrotas</div>
                  </div>
                </div>
              ` : `
                <div class="mt-4" style="padding:var(--space-3); background:var(--color-surface-2); border-radius:var(--radius-md); display:inline-block">
                  <span class="text-sm text-muted">🔒 Estadísticas privadas</span>
                </div>
              `
            ) : ''}
          </div>
        </div>

        <div class="detalle__acciones mt-4"
             style="padding-top:var(--space-4); border-top:1px solid var(--color-border); margin-bottom:0; flex-wrap:wrap">
          ${capitan ? `
            <button class="btn btn--primary btn--sm" data-accion-grupo="editar" data-id="${grupo.id}">✏️ Editar</button>
            <button class="btn btn--ghost btn--sm" data-accion-grupo="gestionar" data-id="${grupo.id}">
              👥 Gestionar ${solicitudesCount > 0 ? `<span class="badge badge--primary" style="margin-left:4px">${solicitudesCount}</span>` : ''}
            </button>
            ${!esComunidad ? `
              <button class="btn btn--ghost btn--sm" data-accion-grupo="stats" data-id="${grupo.id}">📊 Stats</button>
            ` : ''}
            <button class="btn btn--ghost btn--sm" data-accion-grupo="eliminar" data-id="${grupo.id}" style="color:var(--color-danger)">🗑️ Eliminar</button>
          ` : puedeEditarEste ? `
            <span class="badge badge--warning" style="padding:8px 12px">⭐ Eres admin</span>
            <button class="btn btn--primary btn--sm" data-accion-grupo="editar" data-id="${grupo.id}">✏️ Editar</button>
            <button class="btn btn--ghost btn--sm" data-accion-grupo="gestionar" data-id="${grupo.id}">👥 Gestionar</button>
            ${!esComunidad ? `
              <button class="btn btn--ghost btn--sm" data-accion-grupo="stats" data-id="${grupo.id}">📊 Stats</button>
            ` : ''}
          ` : `
            <button class="btn btn--ghost btn--sm" data-accion-grupo="salir" data-id="${grupo.id}" style="color:var(--color-danger)">🚪 Salir</button>
          `}
        </div>
      </div>

      <div class="card">
        <h3 class="card__title mb-4">
          ${esComunidad ? '👥 Miembros' : '👥 Plantilla'} (${miembrosCount})
        </h3>
        <div id="miembros-grupo-${grupo.id}" class="player-list">
          <div class="empty-state--sm" style="padding:var(--space-4)">
            <p class="text-sm text-muted">Cargando miembros...</p>
          </div>
        </div>
      </div>
    `;

    // Cargar miembros de forma asíncrona
    cargarMiembrosDeGrupo(grupo.id, contenedor);
    conectarEventosGrupo(grupo, contenedor, esComunidad);
  }

  async function cargarMiembrosDeGrupo(grupoId, contenedor) {
    const cont = contenedor.querySelector(`#miembros-grupo-${grupoId}`);
    if (!cont) return;

    try {
      const grupoCompleto = await obtenerGrupo(grupoId);
      const miembros = grupoCompleto.miembros || [];

      if (miembros.length === 0) {
        cont.innerHTML = `
          <div class="empty-state--sm">
            <div class="empty-state__icon">👤</div>
            <p>Aún no hay miembros</p>
          </div>`;
        return;
      }

      const soyCapitan = grupoCompleto.esCapitan;
      const soyAdmin = grupoCompleto.esAdmin;

      cont.innerHTML = miembros.map(j => {
        const esElCapitan = j.rol === 'capitan';
        const esAdminJugador = j.rol === 'admin';
        const puedeExpulsar = (soyCapitan || soyAdmin) && !esElCapitan && String(j.id) !== String(user.id);

        return `
          <div class="player-row">
            <div class="player-row__pos">
              ${j.posicion ? j.posicion.slice(0, 3).toUpperCase() : '—'}
            </div>
            <img src="${j.avatar || AVATAR_FALLBACK}" class="avatar avatar--md" alt="" data-autor-id="${j.id}" style="cursor:pointer" />
            <div style="flex:1; min-width:0">
              <div class="feed-item__title" data-autor-id="${j.id}" style="cursor:pointer">
                ${j.nombre}
                ${esElCapitan ? '<span class="badge badge--primary" style="margin-left:6px">👑 Capitán</span>' : ''}
                ${esAdminJugador && !esElCapitan ? '<span class="badge badge--warning" style="margin-left:6px">⭐ Admin</span>' : ''}
              </div>
              <div class="feed-item__subtitle">
                ${j.posicion || 'Sin posición'}${j.dorsal ? ' · #' + j.dorsal : ''}
              </div>
            </div>
            ${puedeExpulsar ? `
              <button class="btn btn--ghost btn--sm" data-expulsar="${j.id}" style="color:var(--color-danger)">Echar</button>
            ` : ''}
          </div>
        `;
      }).join('');

      // Conectar expulsar
      cont.querySelectorAll('[data-expulsar]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const uid = btn.dataset.expulsar;
          if (!confirm('¿Expulsar a este miembro?')) return;
          try {
            await expulsarMiembroAPI(grupoId, uid);
            toast('Miembro expulsado', 'info');
            await recargarPaneles();
          } catch (err) {
            toast(err.message || 'Error al expulsar', 'error');
          }
        });
      });

      // Conectar click en autor
      cont.querySelectorAll('[data-autor-id]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          import('../components.js').then(({ verPerfilUsuario }) => {
            verPerfilUsuario(el.dataset.autorId);
          });
        });
      });
    } catch (err) {
      console.error('[mi-equipo] Error al cargar miembros:', err);
      cont.innerHTML = `<p class="text-sm text-muted text-center">No se pudieron cargar los miembros</p>`;
    }
  }
  
  /* =========================================================
     CONECTAR EVENTOS DEL GRUPO
     ========================================================= */
  function conectarEventosGrupo(grupo, contenedor, esComunidad) {
    contenedor.querySelectorAll('[data-accion-grupo]').forEach(btn => {
      btn.addEventListener('click', () => {
        const accion = btn.dataset.accionGrupo;
        if (accion === 'editar')     abrirModalEditarGrupo(grupo, esComunidad);
        if (accion === 'gestionar')  abrirModalGestionar(grupo);
        if (accion === 'stats')      abrirModalStats(grupo);
        if (accion === 'eliminar')   confirmarEliminarGrupo(grupo, esComunidad);
        if (accion === 'salir')      confirmarSalirGrupo(grupo, esComunidad);
      });
    });
  }

  async function recargarPaneles() {
    await recargarGrupos();
    await renderPanelEquipo();
    await renderPanelComunidad();
  }

  /* =========================================================
     RENDER: PANEL MI EQUIPO
     ========================================================= */
  async function renderPanelEquipo() {
    contenedorEquipo.innerHTML = `
      <div class="card mb-4" style="background:var(--color-primary-light); border:none">
        <div class="flex items-center justify-between" style="flex-wrap:wrap; gap:var(--space-3)">
          <div>
            <div style="font-weight:700; font-size:var(--fs-base)">
              ${renderIconoHtml(RUTA_ESCUDO, 18)} Tus equipos (${misEquipos.length})
            </div>
            <div class="text-xs text-muted">
              ${misEquipos.length === 0
                ? 'Aún no perteneces a ningún equipo'
                : 'Puedes estar en tantos equipos como quieras'}
            </div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn--primary btn--sm" id="btn-crear-equipo">+ Crear equipo</button>
            <button class="btn btn--ghost btn--sm" id="btn-buscar-equipos">🔍 Buscar</button>
          </div>
        </div>
      </div>
      <div id="equipos-lista"></div>
    `;

    const lista = document.getElementById('equipos-lista');

    if (misEquipos.length === 0) {
      lista.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state__icon">${renderIconoHtml(RUTA_ESCUDO, 48)}</div>
            <p>No perteneces a ningún equipo todavía.</p>
            <p class="text-sm text-muted mt-4">Crea uno o busca uno existente para unirte</p>
          </div>
        </div>`;
    } else {
      // Crear contenedores individuales
      lista.innerHTML = misEquipos.map(e =>
        `<div id="equipo-${e.id}" style="margin-bottom:var(--space-5)"></div>`
      ).join('');

      // Render cada grupo
      for (const e of misEquipos) {
        const cont = document.getElementById(`equipo-${e.id}`);
        if (cont) renderGrupo(e, cont, false);
      }
    }

    conectarBotonesPanel('equipo');
  }

  /* =========================================================
     RENDER: PANEL MI COMUNIDAD
     ========================================================= */
  async function renderPanelComunidad() {
    contenedorComunidad.innerHTML = `
      <div class="card mb-4" style="background:var(--color-primary-light); border:none">
        <div class="flex items-center justify-between" style="flex-wrap:wrap; gap:var(--space-3)">
          <div>
            <div style="font-weight:700; font-size:var(--fs-base)">🌐 Tus comunidades (${misComunidades.length})</div>
            <div class="text-xs text-muted">
              ${misComunidades.length === 0
                ? 'Aún no perteneces a ninguna comunidad'
                : 'Puedes estar en tantas comunidades como quieras'}
            </div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn--primary btn--sm" id="btn-crear-comunidad">+ Crear comunidad</button>
            <button class="btn btn--ghost btn--sm" id="btn-buscar-comunidades">🔍 Buscar</button>
          </div>
        </div>
      </div>
      <div id="comunidades-lista"></div>
    `;

    const lista = document.getElementById('comunidades-lista');

    if (misComunidades.length === 0) {
      lista.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state__icon">🌐</div>
            <p>No perteneces a ninguna comunidad todavía.</p>
            <p class="text-sm text-muted mt-4">Crea una o busca una existente para unirte</p>
          </div>
        </div>`;
    } else {
      lista.innerHTML = misComunidades.map(c =>
        `<div id="comunidad-${c.id}" style="margin-bottom:var(--space-5)"></div>`
      ).join('');

      for (const c of misComunidades) {
        const cont = document.getElementById(`comunidad-${c.id}`);
        if (cont) renderGrupo(c, cont, true);
      }
    }

    conectarBotonesPanel('comunidad');
  }

  /* =========================================================
     CONECTAR BOTONES DE PANELES
     ========================================================= */
  function conectarBotonesPanel(tipo) {
    if (tipo === 'equipo') {
      document.getElementById('btn-crear-equipo')?.addEventListener('click', () => {
        abrirModalCrearGrupo('equipo');
      });
      document.getElementById('btn-buscar-equipos')?.addEventListener('click', () => {
        cambiarTab('buscar');
        setTimeout(() => {
          const chipEquipo = document.querySelector('[data-filtro-clubes="equipo"]');
          chipEquipo?.click();
        }, 100);
      });
    }

    if (tipo === 'comunidad') {
      document.getElementById('btn-crear-comunidad')?.addEventListener('click', () => {
        abrirModalCrearGrupo('comunidad');
      });
      document.getElementById('btn-buscar-comunidades')?.addEventListener('click', () => {
        cambiarTab('buscar');
        setTimeout(() => {
          const chipComunidad = document.querySelector('[data-filtro-clubes="comunidad"]');
          chipComunidad?.click();
        }, 100);
      });
    }
  }

  /* =========================================================
     MODAL: CREAR GRUPO
     ========================================================= */
  const ICONOS_GRUPO = [
    'assets/icons/balon-de-futbol (2).png',
    'assets/icons/balocensto.svg',
    'assets/icons/pelota-de-tenis.png',
    'assets/icons/voleibol.svg',
    'assets/icons/raqueta-de-padel.png',
    'assets/icons/golf.png',
    'assets/icons/beisbol.png',
    'assets/icons/disco.png',
    'assets/icons/guantes-de-boxeo.png',
    'assets/icons/volante.png',
    'assets/icons/rugby.png',
    'assets/icons/bicicleta.svg',
    'assets/icons/natacion.svg',
    'assets/icons/corriendo.png',
    'assets/icons/raqueta-de-tenis-de-mesa.png',
    'assets/icons/tenis-de-squash.png',
    'assets/icons/balonmano.png',
    'assets/icons/deporte.svg',
    'assets/icons/tabla-de-surf.png',
    'assets/icons/escalada.png',
    'assets/icons/escudo-de-seguridad.png',
  ];

  let tipoGrupoSeleccionado = 'equipo';

  function abrirModalCrearGrupo(tipo = 'equipo') {
    const modal = document.getElementById('modal-crear-comunidad');
    if (!modal) return;

    tipoGrupoSeleccionado = tipo;

    document.getElementById('crear-modal-titulo').textContent =
      tipo === 'comunidad' ? 'Crear comunidad' : 'Crear equipo';

    const wrapper = document.getElementById('crear-tipo-wrapper');
    const label = document.getElementById('crear-tipo-label');
    if (wrapper && label) {
      wrapper.classList.remove('hidden');
      label.innerHTML = tipo === 'comunidad'
        ? '<span style="font-size:20px">🌐</span> Comunidad — grupo abierto para compartir y charlar'
        : `<span style="font-size:20px">${renderIconoHtml(RUTA_ESCUDO, 20)}</span> Equipo — para competir con otros`;
    }

    document.getElementById('com-nombre').value = '';
    document.getElementById('com-ciudad').value = '';
    document.getElementById('com-descripcion').value = '';

    const selDep = document.getElementById('com-deporte');
    selDep.innerHTML = '<option value="">Selecciona un deporte...</option>' +
      deportes.map(d => `<option value="${d}">${d}</option>`).join('');

    const contIconos = document.getElementById('com-iconos');
    contIconos.innerHTML = ICONOS_GRUPO.map((ic, i) => `
      <button type="button"
              class="posicion-chip ${i === 0 ? 'active' : ''}"
              data-com-icono="${ic}"
              style="display:inline-flex; align-items:center; justify-content:center">
        ${renderIconoHtml(ic, 20)}
      </button>
    `).join('');

    let iconoSel = ICONOS_GRUPO[0];
    contIconos.querySelectorAll('[data-com-icono]').forEach(btn => {
      btn.addEventListener('click', () => {
        contIconos.querySelectorAll('[data-com-icono]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        iconoSel = btn.dataset.comIcono;
      });
    });

    let tipoAccesoSel = 'publico';
    const tipoOps = modal.querySelectorAll('[data-tipo-com]');
    tipoOps.forEach(op => {
      op.classList.toggle('active', op.dataset.tipoCom === 'publico');
      op.onclick = () => {
        tipoOps.forEach(o => o.classList.remove('active'));
        op.classList.add('active');
        tipoAccesoSel = op.dataset.tipoCom;
      };
    });

    document.getElementById('editar-stats-privadas-wrapper')?.classList.add('hidden');

    const btnGuardar = document.getElementById('btn-guardar-comunidad');
    btnGuardar.textContent = tipo === 'comunidad' ? 'Crear comunidad' : 'Crear equipo';
    btnGuardar.onclick = async () => {
      const nombre = document.getElementById('com-nombre').value.trim();
      const deporte = document.getElementById('com-deporte').value;
      const ciudad = document.getElementById('com-ciudad').value.trim();
      const descripcion = document.getElementById('com-descripcion').value.trim();

      if (!nombre) return toast('Ingresa un nombre', 'error');
      if (!deporte) return toast('Selecciona un deporte', 'error');

      btnGuardar.disabled = true;
      btnGuardar.textContent = 'Creando...';

      try {
        await crearGrupoAPI({
          tipo: tipoGrupoSeleccionado,
          nombre,
          escudo: iconoSel,
          deporte,
          ciudad: ciudad || null,
          descripcion: descripcion || null,
          tipoAcceso: tipoAccesoSel,
        });

        cerrarModal('modal-crear-comunidad');
        toast(`¡${tipo === 'comunidad' ? 'Comunidad' : 'Equipo'} "${nombre}" creado!`, 'success');

        cambiarTab(tipo === 'comunidad' ? 'comunidad' : 'equipo');
        await recargarPaneles();
      } catch (err) {
        console.error('[mi-equipo] Error al crear grupo:', err);
        toast(err.message || 'No se pudo crear el grupo', 'error');
      } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = tipo === 'comunidad' ? 'Crear comunidad' : 'Crear equipo';
      }
    };

    modal.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-crear-comunidad');
    });
    modal.onclick = (e) => {
      if (e.target === modal) cerrarModal('modal-crear-comunidad');
    };

    abrirModal('modal-crear-comunidad');
  }
  
  /* =========================================================
     MODAL: EDITAR GRUPO
     ========================================================= */
  function abrirModalEditarGrupo(grupo, esComunidad) {
    const modal = document.getElementById('modal-crear-comunidad');
    if (!modal) return;

    document.getElementById('crear-modal-titulo').textContent =
      grupo.tipo === 'comunidad' ? 'Editar comunidad' : 'Editar equipo';

    const wrapper = document.getElementById('crear-tipo-wrapper');
    const label = document.getElementById('crear-tipo-label');
    if (wrapper && label) {
      wrapper.classList.remove('hidden');
      label.innerHTML = grupo.tipo === 'comunidad'
        ? '<span style="font-size:20px">🌐</span> Comunidad'
        : `<span style="font-size:20px">${renderIconoHtml(RUTA_ESCUDO, 20)}</span> Equipo`;
    }

    document.getElementById('com-nombre').value = grupo.nombre;
    document.getElementById('com-ciudad').value = grupo.ciudad || '';
    document.getElementById('com-descripcion').value = grupo.descripcion || '';

    const selDep = document.getElementById('com-deporte');
    selDep.innerHTML = deportes.map(d =>
      `<option value="${d}" ${d === grupo.deporte ? 'selected' : ''}>${d}</option>`
    ).join('');

    const contIconos = document.getElementById('com-iconos');
    contIconos.innerHTML = ICONOS_GRUPO.map(ic => `
      <button type="button"
              class="posicion-chip ${ic === grupo.escudo ? 'active' : ''}"
              data-com-icono="${ic}"
              style="display:inline-flex; align-items:center; justify-content:center">
        ${renderIconoHtml(ic, 20)}
      </button>
    `).join('');

    let iconoSel = grupo.escudo;
    contIconos.querySelectorAll('[data-com-icono]').forEach(btn => {
      btn.addEventListener('click', () => {
        contIconos.querySelectorAll('[data-com-icono]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        iconoSel = btn.dataset.comIcono;
      });
    });

    let tipoAccesoSel = grupo.tipoAcceso || 'publico';
    const tipoOps = modal.querySelectorAll('[data-tipo-com]');
    tipoOps.forEach(op => {
      op.classList.toggle('active', op.dataset.tipoCom === tipoAccesoSel);
      op.onclick = () => {
        tipoOps.forEach(o => o.classList.remove('active'));
        op.classList.add('active');
        tipoAccesoSel = op.dataset.tipoCom;
      };
    });

    const wrapperPriv = document.getElementById('editar-stats-privadas-wrapper');
    const chkPriv = document.getElementById('edit-grupo-stats-privadas');
    if (wrapperPriv && chkPriv) {
      if (grupo.tipo === 'equipo') {
        wrapperPriv.classList.remove('hidden');
        chkPriv.checked = !!grupo.statsPrivadas;
      } else {
        wrapperPriv.classList.add('hidden');
        chkPriv.checked = false;
      }
    }

    const btnGuardar = document.getElementById('btn-guardar-comunidad');
    btnGuardar.textContent = 'Guardar cambios';
    btnGuardar.onclick = async () => {
      const nombre = document.getElementById('com-nombre').value.trim();
      const deporte = document.getElementById('com-deporte').value;
      const ciudad = document.getElementById('com-ciudad').value.trim();
      const descripcion = document.getElementById('com-descripcion').value.trim();
      const statsPrivadasNueva = (grupo.tipo === 'equipo' && chkPriv) ? chkPriv.checked : false;

      if (!nombre) return toast('Ingresa un nombre', 'error');
      if (!deporte) return toast('Selecciona un deporte', 'error');

      btnGuardar.disabled = true;
      btnGuardar.textContent = 'Guardando...';

      try {
        await editarGrupoAPI(grupo.id, {
          nombre,
          escudo: iconoSel,
          deporte,
          ciudad: ciudad || null,
          descripcion: descripcion || null,
          tipoAcceso: tipoAccesoSel,
          statsPrivadas: statsPrivadasNueva,
        });

        cerrarModal('modal-crear-comunidad');
        toast('Grupo actualizado', 'success');
        await recargarPaneles();
      } catch (err) {
        console.error('[mi-equipo] Error al editar:', err);
        toast(err.message || 'No se pudo actualizar el grupo', 'error');
      } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = 'Guardar cambios';
      }
    };

    modal.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-crear-comunidad');
    });
    modal.onclick = (e) => {
      if (e.target === modal) cerrarModal('modal-crear-comunidad');
    };

    abrirModal('modal-crear-comunidad');
  }

  /* =========================================================
     MODAL: GESTIONAR MIEMBROS
     ========================================================= */
  let grupoEnGestion = null;

  async function abrirModalGestionar(grupo) {
    grupoEnGestion = grupo;
    await renderGestionMiembros(grupo, 'miembros');

    const modal = document.getElementById('modal-gestionar-grupo');
    if (!modal) return;

    modal.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-gestionar-grupo');
    });
    modal.onclick = (e) => {
      if (e.target === modal) cerrarModal('modal-gestionar-grupo');
    };

    abrirModal('modal-gestionar-grupo');
  }

  async function renderGestionMiembros(grupo, tab) {
    const cont = document.getElementById('lista-gestion-grupo');
    if (!cont) return;

    document.querySelectorAll('[data-tab-gestion]').forEach(el => {
      el.classList.toggle('active', el.dataset.tabGestion === tab);
    });

    cont.innerHTML = '<p class="text-sm text-muted text-center">Cargando...</p>';

    try {
      const grupoCompleto = await obtenerGrupo(grupo.id);
      const miembros = grupoCompleto.miembros || [];
      const solicitudes = grupoCompleto.solicitudes || [];

      document.getElementById('count-gestion-miembros').textContent = miembros.length;
      document.getElementById('count-gestion-solicitudes').textContent = solicitudes.length;

      const lista = tab === 'miembros' ? miembros : solicitudes;

      if (lista.length === 0) {
        cont.innerHTML = `
          <div class="empty-state--sm">
            <div class="empty-state__icon">📭</div>
            <p>Sin ${tab === 'miembros' ? 'miembros' : 'solicitudes'}</p>
          </div>`;
        return;
      }

      if (tab === 'miembros') {
        const soyCapitan = grupoCompleto.esCapitan;

        cont.innerHTML = miembros.map(m => {
          const esElCapitan = m.rol === 'capitan';
          const esAdminJugador = m.rol === 'admin';
          const puedoHacerAlgo = soyCapitan && !esElCapitan;

          return `
            <div class="solicitud-item">
              <img src="${m.avatar || AVATAR_FALLBACK}" class="avatar avatar--md" alt="" />
              <div class="solicitud-item__info">
                <div class="solicitud-item__nombre">
                  ${m.nombre}
                  ${esElCapitan ? '<span class="badge badge--primary" style="margin-left:6px">👑</span>' : ''}
                  ${esAdminJugador && !esElCapitan ? '<span class="badge badge--warning" style="margin-left:6px">⭐ Admin</span>' : ''}
                </div>
                <div class="solicitud-item__meta">${m.posicion || 'Sin posición'}</div>
              </div>
              <div class="solicitud-item__actions">
                ${puedoHacerAlgo && !esAdminJugador ? `
                  <button class="btn btn--ghost btn--sm" data-nombrar-admin="${m.id}" title="Nombrar admin">⭐</button>
                ` : ''}
                ${puedoHacerAlgo && esAdminJugador ? `
                  <button class="btn btn--ghost btn--sm" data-quitar-admin="${m.id}" title="Quitar admin">✕⭐</button>
                ` : ''}
                ${puedoHacerAlgo ? `
                  <button class="btn btn--ghost btn--sm" data-expulsar-miembro="${m.id}" style="color:var(--color-danger)" title="Expulsar">🚫</button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('');

        // Conectar acciones
        cont.querySelectorAll('[data-expulsar-miembro]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const uid = btn.dataset.expulsarMiembro;
            if (!confirm('¿Expulsar a este miembro?')) return;
            try {
              await expulsarMiembroAPI(grupo.id, uid);
              toast('Miembro expulsado', 'info');
              await renderGestionMiembros(grupo, tab);
              await recargarPaneles();
            } catch (err) {
              toast(err.message || 'Error al expulsar', 'error');
            }
          });
        });

        cont.querySelectorAll('[data-nombrar-admin]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const uid = btn.dataset.nombrarAdmin;
            try {
              await cambiarRolMiembroAPI(grupo.id, uid, 'admin');
              toast('Admin nombrado', 'success');
              await renderGestionMiembros(grupo, tab);
              await recargarPaneles();
            } catch (err) {
              toast(err.message || 'Error al nombrar admin', 'error');
            }
          });
        });

        cont.querySelectorAll('[data-quitar-admin]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const uid = btn.dataset.quitarAdmin;
            try {
              await cambiarRolMiembroAPI(grupo.id, uid, 'miembro');
              toast('Admin removido', 'info');
              await renderGestionMiembros(grupo, tab);
              await recargarPaneles();
            } catch (err) {
              toast(err.message || 'Error al quitar admin', 'error');
            }
          });
        });

      } else {
        // Solicitudes
        cont.innerHTML = solicitudes.map(s => `
          <div class="solicitud-item">
            <img src="${s.avatar || AVATAR_FALLBACK}" class="avatar avatar--md" alt="" />
            <div class="solicitud-item__info">
              <div class="solicitud-item__nombre">${s.nombre}</div>
              <div class="solicitud-item__meta">
                Solicitó unirse · ${new Date(s.fecha).toLocaleDateString('es-CL')}
              </div>
            </div>
            <div class="solicitud-item__actions">
              <button class="btn btn--primary btn--sm" data-aceptar-sol="${s.id_usuario}">Aceptar</button>
              <button class="btn btn--ghost btn--sm" data-rechazar-sol="${s.id_usuario}">✕</button>
            </div>
          </div>
        `).join('');

        cont.querySelectorAll('[data-aceptar-sol]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const uid = btn.dataset.aceptarSol;
            try {
              await gestionarSolicitudAPI(grupo.id, uid, 'aprobar');
              toast('Solicitud aceptada', 'success');
              await renderGestionMiembros(grupo, tab);
              await recargarPaneles();
            } catch (err) {
              toast(err.message || 'Error al aceptar', 'error');
            }
          });
        });

        cont.querySelectorAll('[data-rechazar-sol]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const uid = btn.dataset.rechazarSol;
            try {
              await gestionarSolicitudAPI(grupo.id, uid, 'rechazar');
              toast('Solicitud rechazada', 'info');
              await renderGestionMiembros(grupo, tab);
              await recargarPaneles();
            } catch (err) {
              toast(err.message || 'Error al rechazar', 'error');
            }
          });
        });
      }
    } catch (err) {
      console.error('[mi-equipo] Error al cargar gestión:', err);
      cont.innerHTML = `<p class="text-sm text-muted text-center">No se pudo cargar la lista</p>`;
    }
  }

  // Tabs dentro del modal de gestión
  document.querySelectorAll('[data-tab-gestion]').forEach(tab => {
    tab.addEventListener('click', () => {
      if (grupoEnGestion) renderGestionMiembros(grupoEnGestion, tab.dataset.tabGestion);
    });
  });

  /* =========================================================
     MODAL: EDITAR STATS
     ========================================================= */
  function abrirModalStats(grupo) {
    const modal = document.getElementById('modal-grupo-stats');
    if (!modal) return;

    document.getElementById('grupo-stats-titulo').innerHTML =
      `📊 Stats de ${renderIconoHtml(grupo.escudo || RUTA_ESCUDO, 20)} ${grupo.nombre}`;

    document.getElementById('gs-victorias').value = grupo.stats?.victorias || 0;
    document.getElementById('gs-empates').value   = grupo.stats?.empates || 0;
    document.getElementById('gs-derrotas').value  = grupo.stats?.derrotas || 0;

    document.getElementById('btn-guardar-grupo-stats').onclick = async () => {
      const stats = {
        victorias: Math.max(0, Number(document.getElementById('gs-victorias').value) || 0),
        empates:   Math.max(0, Number(document.getElementById('gs-empates').value) || 0),
        derrotas:  Math.max(0, Number(document.getElementById('gs-derrotas').value) || 0),
      };

      try {
        await editarStatsAPI(grupo.id, stats);
        cerrarModal('modal-grupo-stats');
        toast('Stats actualizadas', 'success');
        await recargarPaneles();
      } catch (err) {
        toast(err.message || 'Error al guardar stats', 'error');
      }
    };

    modal.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-grupo-stats');
    });
    modal.onclick = (e) => {
      if (e.target === modal) cerrarModal('modal-grupo-stats');
    };

    abrirModal('modal-grupo-stats');
  }

  /* =========================================================
     CONFIRMAR ELIMINAR / SALIR
     ========================================================= */
  async function confirmarEliminarGrupo(grupo, esComunidad) {
    if (!confirm(`¿Eliminar "${grupo.nombre}"? Esta acción no se puede deshacer.`)) return;

    try {
      await eliminarGrupoAPI(grupo.id);
      toast('Grupo eliminado', 'info');
      await recargarPaneles();
    } catch (err) {
      toast(err.message || 'Error al eliminar', 'error');
    }
  }

  async function confirmarSalirGrupo(grupo, esComunidad) {
    if (!confirm(`¿Salir de "${grupo.nombre}"?`)) return;

    try {
      await salirDeGrupoAPI(grupo.id);
      toast('Saliste del grupo', 'info');
      await recargarPaneles();
    } catch (err) {
      toast(err.message || 'Error al salir', 'error');
    }
  }
  
  /* =========================================================
     RENDER: BUSCAR GRUPOS (equipos + comunidades)
     ========================================================= */
  async function renderBuscar() {
    const input = document.getElementById('input-buscar-clubes');
    const resultados = document.getElementById('resultados-busqueda');
    const chipsFiltro = document.querySelectorAll('[data-filtro-clubes]');
    if (!input || !resultados) return;

    let filtroTipo = 'todos';
    let textoBusqueda = '';

    async function pintar() {
      resultados.innerHTML = '<p class="text-sm text-muted text-center" style="padding:var(--space-4)">Buscando...</p>';

      try {
        const filtros = { limit: 50 };

        if (filtroTipo === 'equipo')     filtros.tipo = 'equipo';
        if (filtroTipo === 'comunidad')  filtros.tipo = 'comunidad';
        if (filtroTipo === 'publico')    filtros.tipoAcceso = 'publico';
        if (filtroTipo === 'privado')    filtros.tipoAcceso = 'privado';
        if (textoBusqueda)               filtros.busqueda = textoBusqueda;

        const { data: lista } = await listarGrupos(filtros);

        if (lista.length === 0) {
          resultados.innerHTML = `
            <div class="card">
              <div class="empty-state">
                <div class="empty-state__icon">🔍</div>
                <p>No se encontraron resultados con esos filtros.</p>
              </div>
            </div>`;
          return;
        }

        resultados.innerHTML = `
          <div class="card-grid">
            ${lista.map(g => {
              const esPrivado = g.tipoAcceso === 'privado';
              const esComunidad = g.tipo === 'comunidad';
              const iconoTipo = esComunidad ? '🌐' : renderIconoHtml(RUTA_ESCUDO, 16);
              const labelTipo = esComunidad ? 'Comunidad' : 'Equipo';
              const yaSoyMiembro = g.esMiembro || g.esCapitan;

              let botonHtml = '';
              if (yaSoyMiembro) {
                botonHtml = `<button class="btn btn--ghost btn--sm" disabled>✓ Ya eres miembro</button>`;
              } else if (esPrivado) {
                botonHtml = `<button class="btn btn--primary btn--sm" data-unirse="${g.id}">Solicitar unirme</button>`;
              } else {
                botonHtml = `<button class="btn btn--primary btn--sm" data-unirse="${g.id}">Unirme</button>`;
              }

              return `
                <article class="match-card" data-grupo="${g.id}">
                  <div class="match-card__header">
                    <div class="match-card__sport">${renderIconoHtml(g.escudo || RUTA_ESCUDO, 36)}</div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end">
                      <span class="badge badge--primary">${iconoTipo} ${labelTipo}</span>
                      <span class="badge ${esPrivado ? 'badge--warning' : 'badge--success'}">
                        ${esPrivado ? '🔒' : '🌐'}
                      </span>
                    </div>
                  </div>

                  <h3 class="match-card__title">${g.nombre}</h3>
                  <p class="text-xs text-muted mb-4">${g.descripcion || ''}</p>

                  <div class="match-card__info">
                    <span>🏅 ${g.deporte}</span>
                    ${g.ciudad ? `<span>📍 ${g.ciudad}</span>` : ''}
                    <span>👥 ${g.totalMiembros} miembros</span>
                  </div>

                  <div class="match-card__footer" style="justify-content:flex-end">
                    ${botonHtml}
                  </div>
                </article>
              `;
            }).join('')}
          </div>`;

        resultados.querySelectorAll('[data-unirse]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const grupoId = btn.dataset.unirse;

            btn.disabled = true;
            btn.textContent = 'Enviando...';

            try {
              const res = await unirseAGrupoAPI(grupoId);

              if (res.tipo === 'solicitud') {
                toast('Solicitud enviada al capitán', 'success');
              } else {
                toast('¡Te uniste al grupo!', 'success');
              }

              await pintar();
              await recargarPaneles();
            } catch (err) {
              toast(err.message || 'Error al unirse', 'error');
              btn.disabled = false;
              btn.textContent = 'Unirme';
            }
          });
        });
      } catch (err) {
        console.error('[mi-equipo] Error al buscar:', err);
        resultados.innerHTML = `<p class="text-sm text-muted text-center">Error al buscar</p>`;
      }
    }

    input.addEventListener('input', () => {
      textoBusqueda = input.value;
      pintar();
    });

    chipsFiltro.forEach(chip => {
      chip.addEventListener('click', () => {
        chipsFiltro.forEach(c => c.classList.remove('chip--active'));
        chip.classList.add('chip--active');
        filtroTipo = chip.dataset.filtroClubes;
        pintar();
      });
    });

    pintar();
  }

  /* =========================================================
     CAMBIAR SUB-PESTAÑA
     ========================================================= */
  function cambiarTab(tab) {
    subtabs.forEach(st => {
      st.classList.toggle('subtab--active', st.dataset.tabEquipo === tab);
    });

    panelEquipo.classList.toggle('subpanel--active', tab === 'equipo');
    panelComunidad.classList.toggle('subpanel--active', tab === 'comunidad');
    panelChat.classList.toggle('subpanel--active', tab === 'chat');
    panelBuscar.classList.toggle('subpanel--active', tab === 'buscar');

    if (tab === 'equipo')     renderPanelEquipo();
    if (tab === 'comunidad')  renderPanelComunidad();
    if (tab === 'buscar')     renderBuscar();
    // El chat queda para después (todavía no está migrado al backend)
  }

  subtabs.forEach(st => {
    st.addEventListener('click', () => cambiarTab(st.dataset.tabEquipo));
  });

  /* =========================================================
     INIT
     ========================================================= */
  await recargarGrupos();
  await renderPanelEquipo();

  return () => {};
}


