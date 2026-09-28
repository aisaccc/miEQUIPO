import { getSesion } from '../auth.js';
import { toast, abrirModal, cerrarModal } from '../components.js';
import { deportes } from '../data-mock.js';
import {
  getGrupos, getGrupoPorId, guardarGrupo, eliminarGrupo,
  esCapitan, esAdmin, esMiembro,
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

            ${!esComunidad ? (
              (!grupo.statsPrivadas || puedeEditarEste || esMiembro(grupo, user.id)) ? `
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
            <button class="btn btn--primary btn--sm" data-accion-grupo="editar">✏️ Editar</button>
            <button class="btn btn--ghost btn--sm" data-accion-grupo="gestionar">
              👥 Gestionar ${solicitudesCount > 0 ? `<span class="badge badge--primary" style="margin-left:4px">${solicitudesCount}</span>` : ''}
            </button>
            ${!esComunidad ? `
              <button class="btn btn--ghost btn--sm" data-accion-grupo="stats">📊 Stats</button>
            ` : ''}
            <button class="btn btn--ghost btn--sm" data-accion-grupo="eliminar" style="color:var(--color-danger)">🗑️ Eliminar</button>
          ` : puedeEditarEste ? `
            <span class="badge badge--warning" style="padding:8px 12px">⭐ Eres admin</span>
            <button class="btn btn--primary btn--sm" data-accion-grupo="editar">✏️ Editar</button>
            <button class="btn btn--ghost btn--sm" data-accion-grupo="gestionar">👥 Gestionar</button>
            ${!esComunidad ? `
              <button class="btn btn--ghost btn--sm" data-accion-grupo="stats">📊 Stats</button>
            ` : ''}
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

      ${esComunidad ? `
        <div class="card mt-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="card__title" style="margin:0">📌 Publicaciones</h3>
            ${esMiembro(grupo, user.id) || capitan || admin ? `
              <button class="btn btn--primary btn--sm" data-nuevo-hilo="${grupo.id}">
                + Crear publicación
              </button>
            ` : ''}
          </div>

          <div id="hilos-grupo-${grupo.id}" class="feed-list"></div>
        </div>
      ` : ''}
    `;

    if (esComunidad) {
      renderHilosGrupo(grupo, contenedor);
    }

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
     CONECTAR BOTONES DE LOS PANELES (crear + buscar)
     ========================================================= */
  function conectarBotonesPanel(tipo) {
    if (tipo === 'equipo') {
      document.getElementById('btn-crear-equipo')?.addEventListener('click', () => {
        abrirModalCrearGrupo('equipo');
      });
      document.getElementById('btn-buscar-equipos')?.addEventListener('click', () => {
        cambiarTab('buscar');
        // Dejar el filtro en "equipo"
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
        // Dejar el filtro en "comunidad"
        setTimeout(() => {
          const chipComunidad = document.querySelector('[data-filtro-clubes="comunidad"]');
          chipComunidad?.click();
        }, 100);
      });
    }
  }

  /* =========================================================
     RENDER: PANEL MI EQUIPO
     ========================================================= */
  function renderPanelEquipo() {
    const equipos = misEquipos();

    // Header siempre visible con botón crear
    let html = `
      <div class="card mb-4" style="background:var(--color-primary-light); border:none">
        <div class="flex items-center justify-between" style="flex-wrap:wrap; gap:var(--space-3)">
          <div>
            <div style="font-weight:700; font-size:var(--fs-base)">🛡️ Tus equipos (${equipos.length})</div>
            <div class="text-xs text-muted">
              ${equipos.length === 0
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
    `;

    if (equipos.length === 0) {
      html += `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state__icon">🛡️</div>
            <p>No perteneces a ningún equipo todavía.</p>
            <p class="text-sm text-muted mt-4">Crea uno o busca uno existente para unirte</p>
          </div>
        </div>`;
      contenedorEquipo.innerHTML = html;
      conectarBotonesPanel('equipo');
      return;
    }

    // Renderizar cada equipo con separador
    equipos.forEach(e => {
      html += `<div id="equipo-${e.id}" style="margin-bottom:var(--space-5)"></div>`;
    });

    contenedorEquipo.innerHTML = html;

    equipos.forEach(e => {
      const cont = document.getElementById(`equipo-${e.id}`);
      if (cont) renderGrupo(e, cont, false);
    });

    conectarBotonesPanel('equipo');
  }

  /* =========================================================
     RENDER: PANEL MI COMUNIDAD
     ========================================================= */
  function renderPanelComunidad() {
    const comunidades = misComunidades();

    // Header siempre visible con botón crear
    let html = `
      <div class="card mb-4" style="background:var(--color-primary-light); border:none">
        <div class="flex items-center justify-between" style="flex-wrap:wrap; gap:var(--space-3)">
          <div>
            <div style="font-weight:700; font-size:var(--fs-base)">🌐 Tus comunidades (${comunidades.length})</div>
            <div class="text-xs text-muted">
              ${comunidades.length === 0
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
    `;

    if (comunidades.length === 0) {
      html += `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state__icon">🌐</div>
            <p>No perteneces a ninguna comunidad todavía.</p>
            <p class="text-sm text-muted mt-4">Crea una o busca una existente para unirte</p>
          </div>
        </div>`;
      contenedorComunidad.innerHTML = html;
      conectarBotonesPanel('comunidad');
      return;
    }

    // Renderizar cada comunidad con separador
    comunidades.forEach(c => {
      html += `<div id="comunidad-${c.id}" style="margin-bottom:var(--space-5)"></div>`;
    });

    contenedorComunidad.innerHTML = html;

    comunidades.forEach(c => {
      const cont = document.getElementById(`comunidad-${c.id}`);
      if (cont) renderGrupo(c, cont, true);
    });

    conectarBotonesPanel('comunidad');
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

            const yaSoyMiembro = estoyEn(g);

            let botonHtml = '';
            if (yaSoyMiembro) {
              botonHtml = `<button class="btn btn--ghost btn--sm" disabled>✓ Ya eres miembro</button>`;
            } else if (yaSolicite) {
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

    // Ocultar toggle de stats privadas al crear
    document.getElementById('editar-stats-privadas-wrapper')?.classList.add('hidden');

    const btnGuardar = document.getElementById('btn-guardar-comunidad');
    btnGuardar.textContent = tipo === 'comunidad' ? 'Crear comunidad' : 'Crear equipo';
    btnGuardar.onclick = () => {
      const nombre = document.getElementById('com-nombre').value.trim();
      const deporte = document.getElementById('com-deporte').value;
      const ciudad = document.getElementById('com-ciudad').value.trim();
      const descripcion = document.getElementById('com-descripcion').value.trim();

      if (!nombre) return toast('Ingresa un nombre', 'error');
      if (!deporte) return toast('Selecciona un deporte', 'error');

      // Evitar nombres duplicados del mismo usuario y tipo
      const yaExiste = getGrupos().some(g =>
        g.nombre.toLowerCase() === nombre.toLowerCase() &&
        g.tipo === tipoGrupoSeleccionado &&
        g.capitanId === user.id
      );
      if (yaExiste) {
        return toast('Ya tienes un grupo con ese nombre', 'error');
      }

      // ID único (evita colisiones al crear varios seguidos)
      const nuevo = {
        id: Date.now() + Math.floor(Math.random() * 100000),
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
        hilos: [],
        creado: new Date().toISOString()
      };

      // Guardar
      guardarGrupo(nuevo);
      cerrarModal('modal-crear-comunidad');

      toast(`¡${tipo === 'comunidad' ? 'Comunidad' : 'Equipo'} "${nombre}" creado!`, 'success');

      // Cambiar a la pestaña correcta y recargar
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

    // Toggle de stats privadas (SOLO visible al editar)
    // Toggle de stats privadas (SOLO visible al editar Y solo si es EQUIPO)
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
    btnGuardar.onclick = () => {
      const nombre = document.getElementById('com-nombre').value.trim();
      const deporte = document.getElementById('com-deporte').value;
      const ciudad = document.getElementById('com-ciudad').value.trim();
      const descripcion = document.getElementById('com-descripcion').value.trim();
      const statsPrivadasNueva = (grupo.tipo === 'equipo' && chkPriv) ? chkPriv.checked : false;

      if (!nombre) return toast('Ingresa un nombre', 'error');
      if (!deporte) return toast('Selecciona un deporte', 'error');

      const cambios = [];
      if (nombre !== grupo.nombre)                cambios.push('nombre');
      if (deporte !== grupo.deporte)              cambios.push('deporte');
      if (ciudad !== (grupo.ciudad || ''))        cambios.push('ciudad');
      if (descripcion !== (grupo.descripcion || '')) cambios.push('descripción');
      if (iconoSel !== grupo.escudo)              cambios.push('ícono');
      if (tipoAccesoSel !== grupo.tipoAcceso)     cambios.push('visibilidad');
      if (statsPrivadasNueva !== grupo.statsPrivadas) cambios.push('privacidad de stats');

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
      grupo.statsPrivadas = statsPrivadasNueva;

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

    const modal = document.getElementById('modal-gestionar-grupo');
    if (!modal) return;

    // Conectar cierre
    modal.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-gestionar-grupo');
    });
    modal.onclick = (e) => {
      if (e.target === modal) cerrarModal('modal-gestionar-grupo');
    };

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
     MODAL: EDITAR STATS DEL GRUPO (nuevo, exclusivo)
     ========================================================= */
  function abrirModalStats(grupo) {
    const modal = document.getElementById('modal-grupo-stats');
    if (!modal) return;

    document.getElementById('grupo-stats-titulo').textContent =
      `📊 Stats de ${grupo.escudo} ${grupo.nombre}`;

    document.getElementById('gs-victorias').value = grupo.stats?.victorias || 0;
    document.getElementById('gs-empates').value   = grupo.stats?.empates || 0;
    document.getElementById('gs-derrotas').value  = grupo.stats?.derrotas || 0;

    document.getElementById('btn-guardar-grupo-stats').onclick = () => {
      const grupoActual = getGrupoPorId(grupo.id);
      if (!grupoActual) return;

      grupoActual.stats = {
        victorias: Math.max(0, Number(document.getElementById('gs-victorias').value) || 0),
        empates:   Math.max(0, Number(document.getElementById('gs-empates').value) || 0),
        derrotas:  Math.max(0, Number(document.getElementById('gs-derrotas').value) || 0)
      };

      guardarGrupo(grupoActual);
      cerrarModal('modal-grupo-stats');
      toast('Stats del grupo actualizadas', 'success');
      recargarPaneles();
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
     HILOS DE COMUNIDAD
     ========================================================= */
  function renderHilosGrupo(grupo, contenedor) {
    const contenedorHilos = contenedor.querySelector(`#hilos-grupo-${grupo.id}`);
    if (!contenedorHilos) return;

    const hilos = grupo.hilos || [];

    if (hilos.length === 0) {
      contenedorHilos.innerHTML = `
        <div class="empty-state--sm">
          <div class="empty-state__icon">📝</div>
          <p>Aún no hay publicaciones en esta comunidad.</p>
          ${esMiembro(grupo, user.id) || esCapitan(grupo, user.id) || esAdmin(grupo, user.id) ? `
            <p class="text-xs text-muted mt-2">¡Sé el primero en publicar!</p>
          ` : ''}
        </div>`;
      return;
    }

    contenedorHilos.innerHTML = hilos.map(h => renderHilo(h, grupo)).join('');
    conectarEventosHilos(contenedorHilos, grupo);
  }

  function renderHilo(h, grupo) {
    const esMio = h.autor.id === user.id;
    const esAdminOGrupo = esCapitan(grupo, user.id) || esAdmin(grupo, user.id);
    const puedeBorrar = esMio || esAdminOGrupo;

    return `
      <article class="post" data-hilo-id="${h.id}">
        <header class="post__header">
          <img
            src="${h.autor.avatar}"
            alt=""
            class="avatar avatar--md"
            data-autor-id="${h.autor.id}"
            style="cursor:pointer"
          />
          <div class="post__author">
            <div class="post__author-name"
                 data-autor-id="${h.autor.id}"
                 style="cursor:pointer">
              ${h.autor.nombre}
            </div>
            <div class="post__meta">
              <span class="post__tipo-icono">📝</span>
              publicó · ${tiempoRelativoHilo(h.fecha)}
            </div>
          </div>
          ${puedeBorrar ? `
            <button class="post__menu" data-menu-hilo="${h.id}" title="Opciones">⋯</button>
          ` : ''}
        </header>

        ${h.contenido ? `<div class="post__body">${escapeHtmlHilo(h.contenido)}</div>` : ''}

        ${h.imagen ? `<img src="${h.imagen}" alt="" class="post__image" loading="lazy" />` : ''}
        ${h.video ? `<video src="${h.video}" controls class="post__image" style="max-height:400px; width:100%"></video>` : ''}

        <div class="post__stats">
          <button class="post__action post__action--like ${h.yoLikee ? 'activo' : ''}" data-accion-hilo="like">
            <span class="post__action-icon">${h.yoLikee ? '❤️' : '🤍'}</span>
            <span class="contador-likes">${h.likes || 0}</span>
          </button>

          <button class="post__action" data-accion-hilo="comentarios">
            <span class="post__action-icon">💬</span>
            <span class="contador-comentarios">${(h.comentarios || []).length}</span>
          </button>

          ${puedeBorrar ? `
            <button class="post__action" data-accion-hilo="eliminar" style="margin-left:auto; color:var(--color-danger)">
              <span class="post__action-icon">🗑️</span>
            </button>
          ` : ''}
        </div>

        <div class="post__comentarios">
          ${(h.comentarios || []).map(c => `
            <div class="comentario">
              <img src="${c.avatar}" alt="" class="avatar avatar--sm" />
              <div class="comentario__cuerpo">
                <div class="comentario__autor">${c.autor}</div>
                <div class="comentario__texto">${escapeHtmlHilo(c.texto)}</div>
                <div class="comentario__fecha">${c.fecha}</div>
              </div>
            </div>
          `).join('')}

          <form class="comentario-form" data-form-comentario-hilo>
            <input type="text" placeholder="Escribe un comentario..." maxlength="200" />
            <button type="submit" class="btn btn--primary btn--sm">Enviar</button>
          </form>
        </div>
      </article>
    `;
  }

  function conectarEventosHilos(contenedor, grupo) {
    // Like
    contenedor.querySelectorAll('[data-accion-hilo="like"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const postEl = btn.closest('[data-hilo-id]');
        const hiloId = Number(postEl.dataset.hiloId);
        toggleLikeHilo(grupo, hiloId, postEl);
      });
    });

    // Comentarios (toggle)
    contenedor.querySelectorAll('[data-accion-hilo="comentarios"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const postEl = btn.closest('[data-hilo-id]');
        postEl.querySelector('.post__comentarios')?.classList.toggle('abierto');
      });
    });

    // Eliminar
    contenedor.querySelectorAll('[data-accion-hilo="eliminar"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const postEl = btn.closest('[data-hilo-id]');
        const hiloId = Number(postEl.dataset.hiloId);
        if (!confirm('¿Eliminar esta publicación?')) return;

        import('../store.js').then(({ eliminarHilo }) => {
          eliminarHilo(grupo.id, hiloId);
          toast('Publicación eliminada', 'info');
          renderHilosGrupo(getGrupoPorId(grupo.id), contenedor);
        });
      });
    });

    // Formulario de comentarios
    contenedor.querySelectorAll('[data-form-comentario-hilo]').forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('input');
        const texto = input.value.trim();
        if (!texto) return;

        const postEl = form.closest('[data-hilo-id]');
        const hiloId = Number(postEl.dataset.hiloId);

        agregarComentarioHilo(grupo, hiloId, texto);
        input.value = '';
        renderHilosGrupo(getGrupoPorId(grupo.id), contenedor);

        const nuevo = contenedor.querySelector(`[data-hilo-id="${hiloId}"]`);
        nuevo?.querySelector('.post__comentarios')?.classList.add('abierto');
      });
    });

    // Click en autor → ver perfil
    contenedor.querySelectorAll('[data-autor-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        import('../components.js').then(({ verPerfilUsuario }) => {
          verPerfilUsuario(Number(el.dataset.autorId));
        });
      });
    });

    // Click en "+ Crear publicación"
    contenedor.parentElement?.querySelector('[data-nuevo-hilo]')?.addEventListener('click', () => {
      abrirModalCrearHilo(grupo);
    });
  }

  function toggleLikeHilo(grupo, hiloId, postEl) {
    const hilo = (grupo.hilos || []).find(h => h.id === hiloId);
    if (!hilo) return;

    hilo.yoLikee = !hilo.yoLikee;
    hilo.likes = (hilo.likes || 0) + (hilo.yoLikee ? 1 : -1);

    import('../store.js').then(({ actualizarHilo }) => {
      actualizarHilo(grupo.id, hiloId, {
        yoLikee: hilo.yoLikee,
        likes: hilo.likes
      });

      const btn = postEl.querySelector('[data-accion-hilo="like"]');
      btn.classList.toggle('activo', hilo.yoLikee);
      btn.querySelector('.post__action-icon').textContent = hilo.yoLikee ? '❤️' : '🤍';
      btn.querySelector('.contador-likes').textContent = hilo.likes;
    });
  }

  function agregarComentarioHilo(grupo, hiloId, texto) {
    const hilo = (grupo.hilos || []).find(h => h.id === hiloId);
    if (!hilo) return;

    hilo.comentarios = hilo.comentarios || [];
    hilo.comentarios.push({
      id: Date.now(),
      autor: user.nombre,
      avatar: user.avatar,
      texto,
      fecha: 'ahora'
    });

    import('../store.js').then(({ actualizarHilo }) => {
      actualizarHilo(grupo.id, hiloId, { comentarios: hilo.comentarios });
    });
  }

  function tiempoRelativoHilo(iso) {
    const dif = (Date.now() - new Date(iso).getTime()) / 1000;
    if (dif < 60) return 'hace unos segundos';
    if (dif < 3600) return `hace ${Math.floor(dif / 60)} min`;
    if (dif < 86400) return `hace ${Math.floor(dif / 3600)} h`;
    if (dif < 604800) return `hace ${Math.floor(dif / 86400)} d`;
    return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  }

  function escapeHtmlHilo(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* =========================================================
     MODAL: CREAR HILO
     ========================================================= */
  let hiloGrupoActual = null;
  let hiloAdjunto = null;

  function abrirModalCrearHilo(grupo) {
    const modal = document.getElementById('modal-crear-hilo');
    if (!modal) return;

    hiloGrupoActual = grupo;
    hiloAdjunto = null;

    document.getElementById('hilo-contenido').value = '';
    document.getElementById('hilo-contador').textContent = '0';
    document.getElementById('hilo-preview-wrapper').classList.add('hidden');
    document.getElementById('hilo-preview').innerHTML = '';
    document.getElementById('hilo-btn-quitar-adjunto').style.display = 'none';

    document.getElementById('crear-hilo-titulo').textContent = `Publicar en ${grupo.escudo} ${grupo.nombre}`;

    const textarea = document.getElementById('hilo-contenido');
    const contador = document.getElementById('hilo-contador');
    textarea.oninput = () => {
      contador.textContent = textarea.value.length;
    };

    const inputImg = document.getElementById('hilo-input-imagen');
    inputImg.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) return toast('Imagen muy grande (máx 5 MB)', 'error');

      const reader = new FileReader();
      reader.onload = (ev) => {
        hiloAdjunto = { tipo: 'imagen', dataUrl: ev.target.result };
        mostrarPreviewHilo();
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    };

    const inputVid = document.getElementById('hilo-input-video');
    inputVid.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) return toast('Video muy grande (máx 5 MB)', 'error');

      const reader = new FileReader();
      reader.onload = (ev) => {
        hiloAdjunto = { tipo: 'video', dataUrl: ev.target.result };
        mostrarPreviewHilo();
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    };

    document.getElementById('hilo-btn-quitar-adjunto').onclick = () => {
      hiloAdjunto = null;
      mostrarPreviewHilo();
    };

    document.getElementById('btn-publicar-hilo').onclick = () => {
      const contenido = textarea.value.trim();

      if (!contenido && !hiloAdjunto) {
        return toast('Escribe algo o adjunta una imagen/video', 'error');
      }

      const nuevo = {
        id: Date.now(),
        autor: {
          id: user.id,
          nombre: user.nombre,
          avatar: user.avatar
        },
        tipo: 'post',
        contenido,
        imagen: hiloAdjunto?.tipo === 'imagen' ? hiloAdjunto.dataUrl : null,
        video:  hiloAdjunto?.tipo === 'video'  ? hiloAdjunto.dataUrl : null,
        fecha: new Date().toISOString(),
        likes: 0,
        yoLikee: false,
        comentarios: []
      };

      import('../store.js').then(({ agregarHilo }) => {
        agregarHilo(grupo.id, nuevo);

        cerrarModal('modal-crear-hilo');
        toast('¡Publicación creada!', 'success');

        const contenedor = document.getElementById(
          grupo.tipo === 'comunidad' ? 'comunidad-contenido' : 'equipo-contenido'
        );
        if (contenedor) {
          renderGrupo(getGrupoPorId(grupo.id), contenedor, grupo.tipo === 'comunidad');
        }
        recargarPaneles();
      });
    };

    modal.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-crear-hilo');
    });
    modal.onclick = (e) => {
      if (e.target === modal) cerrarModal('modal-crear-hilo');
    };

    abrirModal('modal-crear-hilo');
  }

  function mostrarPreviewHilo() {
    const wrapper = document.getElementById('hilo-preview-wrapper');
    const preview = document.getElementById('hilo-preview');
    const btnQuitar = document.getElementById('hilo-btn-quitar-adjunto');

    if (!hiloAdjunto) {
      wrapper.classList.add('hidden');
      preview.innerHTML = '';
      btnQuitar.style.display = 'none';
      return;
    }

    wrapper.classList.remove('hidden');
    btnQuitar.style.display = '';

    if (hiloAdjunto.tipo === 'imagen') {
      preview.innerHTML = `<img src="${hiloAdjunto.dataUrl}" style="width:100%; display:block" />`;
    } else {
      preview.innerHTML = `<video src="${hiloAdjunto.dataUrl}" controls style="width:100%; display:block"></video>`;
    }
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