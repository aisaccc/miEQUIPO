import { getSesion } from '../auth.js';
import { toast, abrirModal, cerrarModal } from '../components.js';
import { deportes } from '../data-mock.js';
import {
  getGrupos, getGrupoPorId, guardarGrupo, eliminarGrupo,
  getEquiposNuevos, getComunidades,
  esCapitan, esAdmin, puedeEditar, esMiembro,
  agregarSolicitud, aceptarSolicitud, rechazarSolicitud,
  agregarMiembroDirecto, expulsarMiembro, salirDeGrupo,
  nombrarAdmin, quitarAdmin,
  agregarNotificacion,
  getMensajesDeCanal, agregarMensaje
} from '../store.js';

export async function init() {
  const user = getSesion();
  if (!user) return null;

  const contenedorEquipo    = document.getElementById('equipo-contenido');
  const contenedorComunidad = document.getElementById('comunidad-contenido');

  if (!contenedorEquipo) return null;

  /* ---------- REFS ---------- */
  const subtabs        = document.querySelectorAll('[data-tab-equipo]');
  const panelEquipo    = document.getElementById('panel-equipo');
  const panelComunidad = document.getElementById('panel-comunidad');
  const panelChat      = document.getElementById('panel-chat');
  const panelBuscar    = document.getElementById('panel-buscar');

  /* ---------- HELPERS ---------- */
  function misGruposDeTipo(tipo) {
    return getGrupos().filter(g =>
      g.tipo === tipo && (g.capitanId === user.id || esMiembro(g, user.id))
    );
  }

  function misEquipos()     { return misGruposDeTipo('equipo'); }
  function misComunidades() { return misGruposDeTipo('comunidad'); }

  /* =========================================================
     RENDER GENÉRICO DE UN GRUPO
     ========================================================= */
  function renderGrupo(grupo, contenedor, esComunidad) {
    const capitan = esCapitan(grupo, user.id);
    const admin   = esAdmin(grupo, user.id);
    const puedeEditarEste = capitan || admin;
    const miembrosCount = (grupo.jugadores || []).length;
    const solicitudesCount = (grupo.solicitudes || []).length;

    const iconoTipo = esComunidad ? '🌐' : '🛡️';
    const labelTipo = esComunidad ? 'Comunidad' : 'Equipo';
    const labelMiembros = esComunidad ? 'miembros' : 'jugadores';

    contenedor.innerHTML = `
      <div class="card mb-4">
        <div class="team-header">
          <div class="team-header__crest">${grupo.escudo}</div>
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

            ${!grupo.statsPrivadas || puedeEditarEste || esMiembro(grupo, user.id) ? `
              <div class="flex gap-3 mt-4" style="flex-wrap:wrap">
                <span class="badge badge--success">${grupo.stats?.victorias || 0} V</span>
                <span class="badge badge--warning">${grupo.stats?.empates || 0} E</span>
                <span class="badge badge--danger">${grupo.stats?.derrotas || 0} D</span>
              </div>
            ` : `
              <p class="text-xs text-muted mt-4">🔒 Estadísticas privadas</p>
            `}
          </div>
        </div>

        <div class="detalle__acciones mt-4"
             style="padding-top:var(--space-4); border-top:1px solid var(--color-border); margin-bottom:0; flex-wrap:wrap">
          ${capitan ? `
            <button class="btn btn--primary btn--sm" data-accion-grupo="editar">✏️ Editar</button>
            <button class="btn btn--ghost btn--sm" data-accion-grupo="gestionar">
              👥 Gestionar ${solicitudesCount > 0 ? `<span class="badge badge--primary" style="margin-left:4px">${solicitudesCount}</span>` : ''}
            </button>
            <button class="btn btn--ghost btn--sm" data-accion-grupo="stats">📊 Stats</button>
            <button class="btn btn--ghost btn--sm" data-accion-grupo="eliminar" style="color:var(--color-danger)">🗑️ Eliminar</button>
          ` : puedeEditarEste ? `
            <span class="badge badge--warning" style="padding:8px 12px">⭐ Eres admin</span>
            <button class="btn btn--primary btn--sm" data-accion-grupo="editar">✏️ Editar</button>
            <button class="btn btn--ghost btn--sm" data-accion-grupo="gestionar">👥 Gestionar</button>
            <button class="btn btn--ghost btn--sm" data-accion-grupo="stats">📊 Stats</button>
          ` : `
            <button class="btn btn--ghost btn--sm" data-accion-grupo="salir" style="color:var(--color-danger)">🚪 Salir</button>
          `}
        </div>
      </div>

      <div class="card">
        <h3 class="card__title mb-4">
          ${esComunidad ? '👥 Miembros' : '👥 Plantilla'} (${miembrosCount})
        </h3>
        ${miembrosCount === 0 ? `
          <div class="empty-state--sm">
            <div class="empty-state__icon">👤</div>
            <p>Aún no hay ${labelMiembros}</p>
          </div>
        ` : `
          <div class="player-list">
            ${(grupo.jugadores || []).map(j => {
              const esElCapitan = j.id === grupo.capitanId;
              const esAdminJugador = (grupo.admins || []).includes(j.id);
              const puedeExpulsar = (capitan || admin) && !esElCapitan && j.id !== user.id;

              return `
                <div class="player-row">
                  <div class="player-row__pos">
                    ${j.posicion ? j.posicion.slice(0, 3).toUpperCase() : '—'}
                  </div>
                  <img src="${j.avatar}" class="avatar avatar--md" alt="" data-autor-id="${j.id}" style="cursor:pointer" />
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
            }).join('')}
          </div>
        `}
      </div>
    `;

    conectarEventosGrupo(grupo, contenedor, esComunidad);
  }

  /* ---------- Conectar eventos del grupo ---------- */
  function conectarEventosGrupo(grupo, contenedor, esComunidad) {
    contenedor.querySelectorAll('[data-accion-grupo]').forEach(btn => {
      btn.addEventListener('click', () => {
        const accion = btn.dataset.accionGrupo;
        if (accion === 'editar')     abrirModalEditarGrupo(grupo);
        if (accion === 'gestionar')  abrirModalGestionar(grupo);
        if (accion === 'stats')      abrirModalStats(grupo);
        if (accion === 'eliminar')   confirmarEliminarGrupo(grupo);
        if (accion === 'salir')      confirmarSalirGrupo(grupo);
      });
    });

    contenedor.querySelectorAll('[data-expulsar]').forEach(btn => {
      btn.addEventListener('click', () => {
        const userId = Number(btn.dataset.expulsar);
        if (!confirm('¿Expulsar a este miembro?')) return;
        expulsarMiembro(grupo.id, userId);

        agregarNotificacion({
          para: userId,
          tipo: 'expulsado',
          mensaje: `Fuiste expulsado de "${grupo.nombre}"`,
          link: '#/mi-equipo'
        });

        toast('Miembro expulsado', 'info');
        recargarPaneles();
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

  function recargarPaneles() {
    renderPanelEquipo();
    renderPanelComunidad();
  }

  /* =========================================================
     RENDER: PANEL MI EQUIPO
     ========================================================= */
  function renderPanelEquipo() {
    const equipos = misEquipos();

    if (equipos.length === 0) {
      contenedorEquipo.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state__icon">🛡️</div>
            <p>No perteneces a ningún equipo todavía.</p>
            <div class="flex gap-3 mt-4" style="justify-content:center">
              <button class="btn btn--primary" id="btn-crear-equipo">+ Crear equipo</button>
              <button class="btn btn--ghost" id="btn-buscar-equipos">Buscar</button>
            </div>
          </div>
        </div>`;
      document.getElementById('btn-crear-equipo')?.addEventListener('click', () => abrirModalCrearGrupo('equipo'));
      document.getElementById('btn-buscar-equipos')?.addEventListener('click', () => cambiarTab('buscar'));
      return;
    }

    let selectorHtml = '';
    if (equipos.length > 1) {
      selectorHtml = `
        <div class="card mb-4">
          <label class="field__label">Tus equipos</label>
          <div class="posiciones-lista" style="justify-content:flex-start">
            ${equipos.map((e, i) => `
              <button class="posicion-chip ${i === 0 ? 'active' : ''}" data-elegir-equipo="${e.id}">
                ${e.escudo} ${e.nombre}
              </button>
            `).join('')}
          </div>
        </div>`;
      contenedorEquipo.innerHTML = selectorHtml + '<div id="equipo-detalle"></div>';
      contenedorEquipo.querySelectorAll('[data-elegir-equipo]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = Number(btn.dataset.elegirEquipo);
          const eq = getGrupoPorId(id);
          if (eq) renderGrupo(eq, document.getElementById('equipo-detalle'), false);
        });
      });
      renderGrupo(equipos[0], document.getElementById('equipo-detalle'), false);
    } else {
      renderGrupo(equipos[0], contenedorEquipo, false);
    }
  }

  /* =========================================================
     RENDER: PANEL MI COMUNIDAD
     ========================================================= */
  function renderPanelComunidad() {
    const comunidades = misComunidades();

    if (comunidades.length === 0) {
      contenedorComunidad.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state__icon">🌐</div>
            <p>No perteneces a ninguna comunidad todavía.</p>
            <div class="flex gap-3 mt-4" style="justify-content:center">
              <button class="btn btn--primary" id="btn-crear-comunidad-nueva">+ Crear comunidad</button>
              <button class="btn btn--ghost" id="btn-buscar-comunidades">Buscar</button>
            </div>
          </div>
        </div>`;
      document.getElementById('btn-crear-comunidad-nueva')?.addEventListener('click', () => abrirModalCrearGrupo('comunidad'));
      document.getElementById('btn-buscar-comunidades')?.addEventListener('click', () => cambiarTab('buscar'));
      return;
    }

    let selectorHtml = '';
    if (comunidades.length > 1) {
      selectorHtml = `
        <div class="card mb-4">
          <label class="field__label">Tus comunidades</label>
          <div class="posiciones-lista" style="justify-content:flex-start">
            ${comunidades.map((c, i) => `
              <button class="posicion-chip ${i === 0 ? 'active' : ''}" data-elegir-comunidad="${c.id}">
                ${c.escudo} ${c.nombre}
              </button>
            `).join('')}
          </div>
        </div>`;
      contenedorComunidad.innerHTML = selectorHtml + '<div id="comunidad-detalle"></div>';
      contenedorComunidad.querySelectorAll('[data-elegir-comunidad]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = Number(btn.dataset.elegirComunidad);
          const c = getGrupoPorId(id);
          if (c) renderGrupo(c, document.getElementById('comunidad-detalle'), true);
        });
      });
      renderGrupo(comunidades[0], document.getElementById('comunidad-detalle'), true);
    } else {
      renderGrupo(comunidades[0], contenedorComunidad, true);
    }
  }
    /* =========================================================
     RENDER: CHAT
     ========================================================= */
  function renderChat() {
    const listaCanales = document.getElementById('lista-canales');
    const panelChat    = document.querySelector('.chat-layout__panel');
    if (!listaCanales || !panelChat) return;

    const misGrupos = [
      ...misEquipos().map(e => ({ ...e, _tipo: 'equipo' })),
      ...misComunidades().map(c => ({ ...c, _tipo: 'comunidad' }))
    ];

    if (misGrupos.length === 0) {
      listaCanales.innerHTML = `
        <p class="text-muted text-sm text-center" style="padding:var(--space-5)">
          Únete a un equipo o comunidad para usar el chat.
        </p>`;
      panelChat.innerHTML = `
        <div class="chat-empty">
          <div style="font-size:48px">💬</div>
          <p class="text-muted mt-4">Sin canales disponibles</p>
        </div>`;
      return;
    }

    const canales = misGrupos.flatMap(g => [
      {
        id: `general-${g.id}`,
        nombre: 'General',
        icono: '💬',
        sub: `${(g.jugadores || []).length} miembros`,
        soloLectura: false,
        grupo: g
      },
      {
        id: `avisos-${g.id}`,
        nombre: 'Avisos',
        icono: '📢',
        sub: 'Solo capitán/admin escribe',
        soloLectura: true,
        grupo: g
      }
    ]);

    listaCanales.innerHTML = canales.map(c => `
      <div class="conversation" data-canal="${c.id}">
        <div class="avatar avatar--md"
             style="background:var(--color-primary-light); display:grid; place-items:center; font-size:18px">
          ${c.icono}
        </div>
        <div class="conversation__info">
          <div class="conversation__name">${c.grupo.escudo} ${c.grupo.nombre} · ${c.nombre}</div>
          <div class="conversation__preview">${c.sub}</div>
        </div>
      </div>
    `).join('');

    let intervaloRefresco = null;

    function abrirCanal(canal) {
      listaCanales.querySelectorAll('.conversation').forEach(el => {
        el.classList.toggle('active', el.dataset.canal === canal.id);
      });

      const puedeEscribir = !canal.soloLectura ||
        esCapitan(canal.grupo, user.id) ||
        esAdmin(canal.grupo, user.id);

      panelChat.innerHTML = `
        <div class="chat-header">
          <div class="chat-header__icon">${canal.icono}</div>
          <div class="chat-header__info">
            <div class="chat-header__name">${canal.grupo.escudo} ${canal.grupo.nombre} · ${canal.nombre}</div>
            <div class="chat-header__sub">${canal.sub}</div>
          </div>
        </div>

        <div class="chat-mensajes" id="chat-mensajes"></div>

        ${puedeEscribir ? `
          <form class="chat-input" id="chat-form">
            <input type="text" id="chat-input-texto" placeholder="Escribe un mensaje..." maxlength="300" autocomplete="off" />
            <button type="submit" class="chat-input__btn">➤</button>
          </form>
        ` : `
          <div class="chat-solo-lectura">📢 Solo el capitán o admin puede escribir</div>
        `}
      `;

      refrescar(canal);

      document.getElementById('chat-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-input-texto');
        const texto = input.value.trim();
        if (!texto) return;

        agregarMensaje(canal.id, {
          id: Date.now(),
          autorId: user.id,
          autorNombre: user.nombre,
          avatar: user.avatar,
          texto,
          fecha: new Date().toISOString()
        });

        input.value = '';
        refrescar(canal);
      });

      if (intervaloRefresco) clearInterval(intervaloRefresco);
      intervaloRefresco = setInterval(() => refrescar(canal), 3000);
    }

    function refrescar(canal) {
      const cont = document.getElementById('chat-mensajes');
      if (!cont) return;

      const mensajes = getMensajesDeCanal(canal.id);

      if (mensajes.length === 0) {
        cont.innerHTML = `
          <div class="chat-mensajes__empty">
            <div class="chat-mensajes__empty-icon">💬</div>
            <p>Aún no hay mensajes.</p>
          </div>`;
        return;
      }

      const estabaAbajo = cont.scrollHeight - cont.scrollTop - cont.clientHeight < 50;
      cont.innerHTML = mensajes.map(m => {
        const esMio = m.autorId === user.id;
        return `
          <div class="msg ${esMio ? 'msg--yo' : ''}">
            ${!esMio ? `<img src="${m.avatar}" class="msg__avatar" alt="" />` : ''}
            <div class="msg__burbuja">
              ${!esMio ? `<div class="msg__autor">${m.autorNombre}</div>` : ''}
              <div class="msg__texto">${escapeHtmlChat(m.texto)}</div>
              <div class="msg__hora">${horaCortaChat(m.fecha)}</div>
            </div>
          </div>
        `;
      }).join('');

      if (estabaAbajo || mensajes.length <= 2) cont.scrollTop = cont.scrollHeight;
    }

    listaCanales.querySelectorAll('.conversation').forEach(el => {
      el.addEventListener('click', () => {
        const canal = canales.find(c => c.id === el.dataset.canal);
        if (canal) abrirCanal(canal);
      });
    });

    abrirCanal(canales[0]);

    window.__chatCleanup = () => {
      if (intervaloRefresco) clearInterval(intervaloRefresco);
    };
  }

  function escapeHtmlChat(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function horaCortaChat(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  }

  /* =========================================================
     RENDER: BUSCAR (equipos + comunidades)
     ========================================================= */
  function renderBuscar() {
    const input = document.getElementById('input-buscar-clubes');
    const resultados = document.getElementById('resultados-busqueda');
    const chipsFiltro = document.querySelectorAll('[data-filtro-clubes]');
    if (!input || !resultados) return;

    let filtroTipo = 'todos';
    let textoBusqueda = '';

    function estoyEn(grupo) {
      return grupo.capitanId === user.id || esMiembro(grupo, user.id);
    }

    function tengoSolicitudPendiente(grupo) {
      return (grupo.solicitudes || []).some(s => s.userId === user.id);
    }

    function pintar() {
      const f = textoBusqueda.toLowerCase().trim();

      let lista = getGrupos();
      lista = lista.filter(g => !estoyEn(g));

      if (filtroTipo === 'equipo')     lista = lista.filter(g => g.tipo === 'equipo');
      if (filtroTipo === 'comunidad')  lista = lista.filter(g => g.tipo === 'comunidad');
      if (filtroTipo === 'publico')    lista = lista.filter(g => g.tipoAcceso === 'publico');
      if (filtroTipo === 'privado')    lista = lista.filter(g => g.tipoAcceso === 'privado');

      if (f) {
        lista = lista.filter(g =>
          g.nombre.toLowerCase().includes(f) ||
          (g.deporte || '').toLowerCase().includes(f) ||
          (g.ciudad || '').toLowerCase().includes(f)
        );
      }

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
            const yaSolicite = tengoSolicitudPendiente(g);
            const esPrivado = g.tipoAcceso === 'privado';
            const esComunidad = g.tipo === 'comunidad';

            const iconoTipo = esComunidad ? '🌐' : '🛡️';
            const labelTipo = esComunidad ? 'Comunidad' : 'Equipo';

            let botonHtml = '';
            if (yaSolicite) {
              botonHtml = `<button class="btn btn--ghost btn--sm" disabled>⏳ Solicitud enviada</button>`;
            } else if (esPrivado) {
              botonHtml = `<button class="btn btn--primary btn--sm" data-unirse="${g.id}">Solicitar unirme</button>`;
            } else {
              botonHtml = `<button class="btn btn--primary btn--sm" data-unirse="${g.id}">Unirme</button>`;
            }

            return `
              <article class="match-card" data-grupo="${g.id}">
                <div class="match-card__header">
                  <div class="match-card__sport" style="font-size:36px">${g.escudo}</div>
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
                  <span>👥 ${(g.jugadores || []).length} miembros</span>
                </div>

                <div class="match-card__footer" style="justify-content:flex-end">
                  ${botonHtml}
                </div>
              </article>
            `;
          }).join('')}
        </div>`;

      resultados.querySelectorAll('[data-unirse]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const grupoId = Number(btn.dataset.unirse);
          const grupo = getGrupoPorId(grupoId);
          if (!grupo) return;

          if (estoyEn(grupo)) {
            return toast('Ya perteneces a este grupo', 'error');
          }

          if (grupo.tipoAcceso === 'privado') {
            agregarSolicitud(grupoId, user);

            agregarNotificacion({
              para: grupo.capitanId,
              tipo: 'postulacion',
              mensaje: `${user.nombre} quiere unirse a "${grupo.nombre}"`,
              link: '#/mi-equipo'
            });

            toast(`Solicitud enviada a "${grupo.nombre}"`, 'success');
            pintar();
            return;
          }

          agregarMiembroDirecto(grupoId, user);

          agregarNotificacion({
            para: grupo.capitanId,
            tipo: 'inscripcion',
            mensaje: `${user.nombre} se unió a "${grupo.nombre}"`,
            link: '#/mi-equipo'
          });

          toast(`¡Te uniste a "${grupo.nombre}"!`, 'success');
          pintar();
          recargarPaneles();
        });
      });
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

    document.getElementById('btn-crear-equipo-panel')?.addEventListener('click', () => {
      abrirModalCrearGrupo('equipo');
    });

    document.getElementById('btn-crear-comunidad-panel')?.addEventListener('click', () => {
      abrirModalCrearGrupo('comunidad');
    });

    pintar();
  }

  /* =========================================================
     MODAL: CREAR GRUPO
     ========================================================= */
  const ICONOS_GRUPO = [
    '⚽','🏀','🎾','🏐','🏈','⚾','🏒','🥊','🏸','🏉',
    '🚴','🏊','🏃','🏓','🤾','🏄','🧗','🌐','🔥','⭐',
    '🛡️','🦁','🐯','🦅','🐺','👑','⚡','💪','🏆','🎯'
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
        : '<span style="font-size:20px">🛡️</span> Equipo — para competir con otros';
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
              style="font-size:18px">${ic}</button>
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

    const btnGuardar = document.getElementById('btn-guardar-comunidad');
    btnGuardar.textContent = tipo === 'comunidad' ? 'Crear comunidad' : 'Crear equipo';
    btnGuardar.onclick = () => {
      const nombre = document.getElementById('com-nombre').value.trim();
      const deporte = document.getElementById('com-deporte').value;
      const ciudad = document.getElementById('com-ciudad').value.trim();
      const descripcion = document.getElementById('com-descripcion').value.trim();

      if (!nombre) return toast('Ingresa un nombre', 'error');
      if (!deporte) return toast('Selecciona un deporte', 'error');

      const nuevo = {
        id: Date.now(),
        tipo: tipoGrupoSeleccionado,
        nombre,
        escudo: iconoSel,
        deporte,
        ciudad,
        descripcion,
        tipoAcceso: tipoAccesoSel,
        capitanId: user.id,
        admins: [],
        solicitudes: [],
        jugadores: [
          {
            id: user.id,
            nombre: user.nombre,
            avatar: user.avatar,
            posicion: '',
            dorsal: null,
            fechaUnion: new Date().toISOString()
          }
        ],
        stats: { victorias: 0, empates: 0, derrotas: 0 },
        statsPrivadas: false,
        creado: new Date().toISOString()
      };

      guardarGrupo(nuevo);
      cerrarModal('modal-crear-comunidad');

      toast(`¡${tipo === 'comunidad' ? 'Comunidad' : 'Equipo'} "${nombre}" creado!`, 'success');

      cambiarTab(tipo === 'comunidad' ? 'comunidad' : 'equipo');
      recargarPaneles();
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
  function abrirModalEditarGrupo(grupo) {
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
        : '<span style="font-size:20px">🛡️</span> Equipo';
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
              style="font-size:18px">${ic}</button>
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

    const btnGuardar = document.getElementById('btn-guardar-comunidad');
    btnGuardar.textContent = 'Guardar cambios';
    btnGuardar.onclick = () => {
      const nombre = document.getElementById('com-nombre').value.trim();
      const deporte = document.getElementById('com-deporte').value;
      const ciudad = document.getElementById('com-ciudad').value.trim();
      const descripcion = document.getElementById('com-descripcion').value.trim();

      if (!nombre) return toast('Ingresa un nombre', 'error');
      if (!deporte) return toast('Selecciona un deporte', 'error');

      const cambios = [];
      if (nombre !== grupo.nombre)                cambios.push('nombre');
      if (deporte !== grupo.deporte)              cambios.push('deporte');
      if (ciudad !== (grupo.ciudad || ''))        cambios.push('ciudad');
      if (descripcion !== (grupo.descripcion || '')) cambios.push('descripción');
      if (iconoSel !== grupo.escudo)              cambios.push('ícono');
      if (tipoAccesoSel !== grupo.tipoAcceso)     cambios.push('visibilidad');

      if (cambios.length === 0) {
        cerrarModal('modal-crear-comunidad');
        return toast('No hay cambios que guardar', 'info');
      }

      grupo.nombre = nombre;
      grupo.escudo = iconoSel;
      grupo.deporte = deporte;
      grupo.ciudad = ciudad;
      grupo.descripcion = descripcion;
      grupo.tipoAcceso = tipoAccesoSel;

      guardarGrupo(grupo);

      (grupo.jugadores || []).forEach(j => {
        if (j.id === user.id) return;
        agregarNotificacion({
          para: j.id,
          tipo: 'edicion',
          mensaje: `"${grupo.nombre}" fue modificado (${cambios.join(', ')})`,
          link: '#/mi-equipo'
        });
      });

      cerrarModal('modal-crear-comunidad');
      toast(`Grupo actualizado (${cambios.join(', ')})`, 'success');
      recargarPaneles();
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
  function abrirModalGestionar(grupo) {
    window.__grupoEditando = grupo.id;
    renderGestionMiembros(grupo, 'miembros');
    abrirModal('modal-gestionar-grupo');
  }

  function renderGestionMiembros(grupo, tab) {
    const cont = document.getElementById('lista-gestion-grupo');
    if (!cont) return;

    document.querySelectorAll('[data-tab-gestion]').forEach(el => {
      el.classList.toggle('active', el.dataset.tabGestion === tab);
    });

    const miembros = grupo.jugadores || [];
    const solicitudes = grupo.solicitudes || [];

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
      const soyCapitan = esCapitan(grupo, user.id);

      cont.innerHTML = miembros.map(m => {
        const esElCapitan = m.id === grupo.capitanId;
        const esAdminJugador = (grupo.admins || []).includes(m.id);
        const puedoHacerAlgo = soyCapitan && !esElCapitan;

        return `
          <div class="solicitud-item">
            <img src="${m.avatar}" class="avatar avatar--md" alt="" />
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

      cont.querySelectorAll('[data-expulsar-miembro]').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = Number(btn.dataset.expulsarMiembro);
          if (!confirm('¿Expulsar a este miembro?')) return;
          expulsarMiembro(grupo.id, uid);

          agregarNotificacion({
            para: uid,
            tipo: 'expulsado',
            mensaje: `Fuiste expulsado de "${grupo.nombre}"`,
            link: '#/mi-equipo'
          });

          toast('Miembro expulsado', 'info');
          renderGestionMiembros(getGrupoPorId(grupo.id), tab);
          recargarPaneles();
        });
      });

      cont.querySelectorAll('[data-nombrar-admin]').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = Number(btn.dataset.nombrarAdmin);
          nombrarAdmin(grupo.id, uid);

          agregarNotificacion({
            para: uid,
            tipo: 'admin',
            mensaje: `¡Eres admin de "${grupo.nombre}"!`,
            link: '#/mi-equipo'
          });

          toast('Admin nombrado', 'success');
          renderGestionMiembros(getGrupoPorId(grupo.id), tab);
          recargarPaneles();
        });
      });

      cont.querySelectorAll('[data-quitar-admin]').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = Number(btn.dataset.quitarAdmin);
          quitarAdmin(grupo.id, uid);
          toast('Admin removido', 'info');
          renderGestionMiembros(getGrupoPorId(grupo.id), tab);
          recargarPaneles();
        });
      });

    } else {
      cont.innerHTML = solicitudes.map(s => `
        <div class="solicitud-item">
          <img src="${s.avatar}" class="avatar avatar--md" alt="" />
          <div class="solicitud-item__info">
            <div class="solicitud-item__nombre">${s.nombre}</div>
            <div class="solicitud-item__meta">
              Solicitó unirse · ${new Date(s.fecha).toLocaleDateString('es-CL')}
            </div>
          </div>
          <div class="solicitud-item__actions">
            <button class="btn btn--primary btn--sm" data-aceptar-sol="${s.userId}">Aceptar</button>
            <button class="btn btn--ghost btn--sm" data-rechazar-sol="${s.userId}">✕</button>
          </div>
        </div>
      `).join('');

      cont.querySelectorAll('[data-aceptar-sol]').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = Number(btn.dataset.aceptarSol);
          aceptarSolicitud(grupo.id, uid);

          agregarNotificacion({
            para: uid,
            tipo: 'aprobado',
            mensaje: `¡Fuiste aceptado en "${grupo.nombre}"!`,
            link: '#/mi-equipo'
          });

          toast('Solicitud aceptada', 'success');
          renderGestionMiembros(getGrupoPorId(grupo.id), tab);
          recargarPaneles();
        });
      });

      cont.querySelectorAll('[data-rechazar-sol]').forEach(btn => {
        btn.addEventListener('click', () => {
          const uid = Number(btn.dataset.rechazarSol);
          rechazarSolicitud(grupo.id, uid);
          toast('Solicitud rechazada', 'info');
          renderGestionMiembros(getGrupoPorId(grupo.id), tab);
          recargarPaneles();
        });
      });
    }
  }

  // Tabs dentro del modal de gestión
  document.querySelectorAll('[data-tab-gestion]').forEach(tab => {
    tab.addEventListener('click', () => {
      const grupoId = window.__grupoEditando || null;
      if (!grupoId) return;
      const grupo = getGrupoPorId(grupoId);
      if (grupo) renderGestionMiembros(grupo, tab.dataset.tabGestion);
    });
  });

  /* =========================================================
     MODAL: EDITAR STATS
     ========================================================= */
  function abrirModalStats(grupo) {
    // Guardar grupo para después
    window.__grupoStatsId = grupo.id;

    // Precargar
    document.getElementById('edit-stats-partidos').value = grupo.stats?.victorias || 0;
    document.getElementById('edit-stats-goles').value = grupo.stats?.empates || 0;
    document.getElementById('edit-stats-mvps').value = grupo.stats?.derrotas || 0;

    // Cambiar labels del modal para indicar V/E/D
    const modal = document.getElementById('modal-editar-stats');
    modal.querySelector('.modal__title').textContent = 'Editar estadísticas del grupo';
    modal.querySelectorAll('.field__label')[0].textContent = 'Victorias';
    modal.querySelectorAll('.field__label')[1].textContent = 'Empates';
    modal.querySelectorAll('.field__label')[2].textContent = 'Derrotas';

    document.getElementById('btn-guardar-stats').onclick = () => {
      const grupoActual = getGrupoPorId(grupo.id);
      if (!grupoActual) return;

      grupoActual.stats = {
        victorias: Math.max(0, Number(document.getElementById('edit-stats-partidos').value) || 0),
        empates:   Math.max(0, Number(document.getElementById('edit-stats-goles').value) || 0),
        derrotas:  Math.max(0, Number(document.getElementById('edit-stats-mvps').value) || 0)
      };

      guardarGrupo(grupoActual);
      cerrarModal('modal-editar-stats');

      // Restaurar labels originales
      modal.querySelector('.modal__title').textContent = 'Editar estadísticas';
      modal.querySelectorAll('.field__label')[0].textContent = 'Partidos jugados';
      modal.querySelectorAll('.field__label')[1].textContent = 'Goles / Anotaciones';
      modal.querySelectorAll('.field__label')[2].textContent = 'MVPs';

      toast('Stats del grupo actualizadas', 'success');
      recargarPaneles();
    };

    document.querySelectorAll('#modal-editar-stats [data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-editar-stats');
    });
    modal.onclick = (e) => {
      if (e.target.id === 'modal-editar-stats') cerrarModal('modal-editar-stats');
    };

    abrirModal('modal-editar-stats');
  }

  /* =========================================================
     CONFIRMAR ELIMINAR / SALIR
     ========================================================= */
  function confirmarEliminarGrupo(grupo) {
    if (!confirm(`¿Eliminar "${grupo.nombre}"? Se notificará a todos los miembros.`)) return;

    (grupo.jugadores || []).forEach(j => {
      if (j.id === user.id) return;
      agregarNotificacion({
        para: j.id,
        tipo: 'equipo_eliminado',
        mensaje: `El grupo "${grupo.nombre}" fue eliminado por el capitán`,
        link: '#/mi-equipo'
      });
    });

    eliminarGrupo(grupo.id);
    toast('Grupo eliminado', 'info');
    recargarPaneles();
  }

  function confirmarSalirGrupo(grupo) {
    if (!confirm(`¿Salir de "${grupo.nombre}"?`)) return;

    salirDeGrupo(grupo.id, user.id);

    if (grupo.capitanId && grupo.capitanId !== user.id) {
      agregarNotificacion({
        para: grupo.capitanId,
        tipo: 'jugador_salio',
        mensaje: `${user.nombre} salió de "${grupo.nombre}"`,
        link: '#/mi-equipo'
      });
    }

    toast('Saliste del grupo', 'info');
    recargarPaneles();
  }

  /* =========================================================
     CAMBIAR SUB-PESTAÑA
     ========================================================= */
  function cambiarTab(tab) {
    if (tab !== 'chat' && window.__chatCleanup) {
      try { window.__chatCleanup(); } catch (e) {}
      window.__chatCleanup = null;
    }

    subtabs.forEach(st => {
      st.classList.toggle('subtab--active', st.dataset.tabEquipo === tab);
    });

    panelEquipo.classList.toggle('subpanel--active', tab === 'equipo');
    panelComunidad.classList.toggle('subpanel--active', tab === 'comunidad');
    panelChat.classList.toggle('subpanel--active', tab === 'chat');
    panelBuscar.classList.toggle('subpanel--active', tab === 'buscar');

    if (tab === 'equipo')     renderPanelEquipo();
    if (tab === 'comunidad')  renderPanelComunidad();
    if (tab === 'chat')       renderChat();
    if (tab === 'buscar')     renderBuscar();
  }

  subtabs.forEach(st => {
    st.addEventListener('click', () => cambiarTab(st.dataset.tabEquipo));
  });

  /* =========================================================
     INIT
     ========================================================= */
  renderPanelEquipo();

  return () => {};
}