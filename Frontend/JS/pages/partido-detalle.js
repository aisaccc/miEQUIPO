import {
  getPartidoPorId, guardarPartido, agregarNotificacion,
  getGrupos, getGrupoPorId,
  postularEquipoAPartido, aceptarEquipoPostulante, rechazarEquipoPostulante,
  equipoYaSePostulo, equipoYaEstaInscrito,
  obtenerOCrearConversacionVinculada
} from '../store.js';
import { getSesion } from '../auth.js';
import { formatearFecha, toast, abrirModal, cerrarModal } from '../components.js';

export async function init(params = {}) {
  const id = params.id;
  const user = getSesion();
  const contenedor = document.getElementById('detalle-partido');
  if (!contenedor || !id) return null;

  /* ---------- MODALES ---------- */
  const modalEditar         = document.getElementById('modal-editar-partido');
  const modalPostulantes    = document.getElementById('modal-equipos-postulantes');
  const modalVerEquipo      = document.getElementById('modal-ver-equipo');

  /* ---------- HELPERS ---------- */
  function esDeEquipo(p) {
    return p.tipoPartido === 'equipo';
  }

  function soyOrganizador(p) {
    return user && p.organizador.id === user.id;
  }

  function miEquipoEsOrganizador(p) {
    return user && p.organizadorEquipo?.capitanId === user.id;
  }

  function equiposQuePuedoPostular(p) {
    if (!user) return [];
    return getGrupos().filter(g =>
      g.tipo === 'equipo' &&
      g.deporte === p.deporte &&
      (g.capitanId === user.id || (g.admins || []).includes(user.id))
    );
  }

  function miEquipoEstaPostulado(p, eqId) {
    return equipoYaSePostulo(p, eqId);
  }

  function miEquipoEstaInscrito(p, eqId) {
    return equipoYaEstaInscrito(p, eqId);
  }

  /* =========================================================
     RENDER PRINCIPAL
     ========================================================= */
  function render() {
    const partido = getPartidoPorId(id);
    if (!partido) {
      contenedor.innerHTML = `
        <div class="detalle__top">
          <button class="detalle__back" id="btn-volver">←</button>
        </div>
        <div class="card">
          <h2 class="card__title">Partido no encontrado</h2>
          <p class="card__subtitle">Puede que haya sido eliminado.</p>
        </div>`;
      document.getElementById('btn-volver')?.addEventListener('click', () => {
        if (window.history.length > 1) window.history.back();
        else window.location.hash = '#/partidos';
      });
      return;
    }

    const deEquipo = esDeEquipo(partido);
    const inscritos = partido.inscritos || [];
    const postulantes = partido.postulantes || [];
    const equiposPostulantes = partido.equiposPostulantes || [];
    const equiposInscritos = partido.equiposInscritos || [];

    const yoEstoyInscrito = user && !deEquipo && inscritos.includes(user.id);
    const yoPostule = user && !deEquipo && postulantes.find(p => p.userId === user.id);
    const soyOrg = soyOrganizador(partido);
    const soyCapitanDelOrg = miEquipoEsOrganizador(partido);
    const soyAdminOGrupo = soyOrg || soyCapitanDelOrg;

    const cuposDisponibles = partido.cupos - (deEquipo ? equiposInscritos.length : inscritos.length);

    const nivelLabel = {
      amistoso: 'Amistoso',
      semiprofesional: 'Semiprofesional',
      profesional: 'Profesional'
    }[partido.nivel] || partido.nivel;

    const badgeEstado = {
      abierto: 'badge--success', lleno: 'badge--danger', finalizado: 'badge--neutral'
    }[partido.estado] || 'badge--neutral';

    /* =========================================================
       BOTÓN DE ACCIÓN PRINCIPAL
       ========================================================= */
    let botonAccion = '';

    if (!user) {
      botonAccion = `<button class="btn btn--primary" disabled>Inicia sesión para participar</button>`;
    } else if (soyAdminOGrupo) {
      if (deEquipo) {
        const pendientes = equiposPostulantes.filter(e => e.estado === 'pendiente').length;
        botonAccion = `
          <button class="btn btn--primary" id="btn-gestionar-equipos">
            🛡️ Equipos postulantes ${pendientes > 0 ? `<span class="badge badge--neutral" style="margin-left:6px">${pendientes}</span>` : ''}
          </button>
          <button class="btn btn--ghost" id="btn-editar-partido">✏️ Editar partido</button>
          <button class="btn btn--ghost" id="btn-eliminar-partido" style="color:var(--color-danger)">🗑️ Eliminar</button>
        `;
      } else {
        botonAccion = `
          <button class="btn btn--primary" id="btn-gestionar-postulantes">
            👥 Postulantes (${postulantes.filter(p => p.estado === 'pendiente').length})
          </button>
          <button class="btn btn--ghost" id="btn-editar-partido">✏️ Editar partido</button>
          <button class="btn btn--ghost" id="btn-eliminar-partido" style="color:var(--color-danger)">🗑️ Eliminar</button>
        `;
      }
    } else if (deEquipo) {
      // Es de equipo y NO soy organizador → puedo postular mi equipo
      const misEq = equiposQuePuedoPostular(partido);
      
      if (misEq.length === 0) {
        botonAccion = `<span class="badge badge--neutral" style="padding:10px 16px">No tenés equipos de ${partido.deporte}</span>`;
      } else {
        // Ver si ya postulé o estoy inscrito
        const yaInscrito = misEq.some(eq => miEquipoEstaInscrito(partido, eq.id));
        const yaPostulado = misEq.some(eq => miEquipoEstaPostulado(partido, eq.id));

        if (yaInscrito) {
          botonAccion = `<span class="badge badge--success" style="padding:10px 16px">✅ Tu equipo está inscrito</span>`;
        } else if (yaPostulado) {
          botonAccion = `<span class="badge badge--warning" style="padding:10px 16px">⏳ Tu equipo está postulado, esperando aprobación</span>`;
        } else if (partido.estado !== 'abierto' || equiposInscritos.length >= partido.cupos) {
          botonAccion = `<span class="badge badge--danger" style="padding:10px 16px">🔒 Partido lleno</span>`;
        } else {
          botonAccion = `<button class="btn btn--primary" id="btn-postular-equipo">📝 Postular mi equipo (${cuposDisponibles} cupos)</button>`;
        }
      }
    } else if (yoEstoyInscrito) {
      botonAccion = `<button class="btn btn--ghost" id="btn-salir-partido" style="color:var(--color-danger)">❌ Salir del partido</button>`;
    } else if (yoPostule && yoPostule.estado === 'pendiente') {
      botonAccion = `
        <button class="btn btn--ghost" disabled>⏳ Postulación pendiente</button>
        <button class="btn btn--ghost" id="btn-cancelar-postulacion">Cancelar postulación</button>
      `;
    } else if (yoPostule && yoPostule.estado === 'rechazado') {
      botonAccion = `<span class="badge badge--danger">❌ Postulación rechazada</span>`;
    } else if (partido.estado !== 'abierto') {
      botonAccion = `<button class="btn btn--ghost" disabled>Partido ${partido.estado}</button>`;
    } else if (partido.aprobacionRequerida) {
      let selectPosiciones = '';
      if (partido.pedirPosiciones && partido.posiciones.length > 0) {
        selectPosiciones = `
          <div class="field" style="margin-bottom:var(--space-3)">
            <label class="field__label">Tu posición</label>
            <select id="postular-posicion" class="field__input">
              <option value="">Selecciona tu posición...</option>
              ${partido.posiciones.map(p => `<option value="${p}">${p}</option>`).join('')}
            </select>
          </div>`;
      }
      botonAccion = `
        <div style="width:100%">
          ${selectPosiciones}
          <button class="btn btn--primary" id="btn-postularme">
            📝 Postularme (${cuposDisponibles} cupos)
          </button>
        </div>`;
    } else {
      botonAccion = `
        <button class="btn btn--primary" id="btn-inscribirme">
          ✅ Inscribirme (${cuposDisponibles} cupos disponibles)
        </button>`;
    }

    /* =========================================================
       RENDER
       ========================================================= */
    contenedor.innerHTML = `
      <div class="detalle__top">
        <button class="detalle__back" id="btn-volver">←</button>
        <h2 class="page-title" style="margin:0; font-size:var(--fs-lg)">Detalle del partido</h2>
      </div>

      <div class="detalle__hero">
        <div class="detalle__hero-emoji">${partido.emoji}</div>
        <h1 class="detalle__hero-title">${partido.titulo}</h1>
        <div class="detalle__hero-meta">
          <span>📅 ${formatearFecha(partido.fecha)}</span>
          <span>📍 ${partido.lugar}</span>
          <span data-autor-id="${partido.organizador.id}" style="cursor:pointer; text-decoration:underline">
            👤 ${partido.organizador.nombre}
          </span>
        </div>
        <div class="detalle__badges">
          <span class="badge ${badgeEstado}">${partido.estado.charAt(0).toUpperCase() + partido.estado.slice(1)}</span>
          <span class="badge badge--${deEquipo ? 'warning' : 'info'}">
            ${deEquipo ? '🛡️ De equipos' : '👤 De jugadores'}
          </span>
          <span class="nivel-badge nivel-badge--${partido.nivel}">${nivelLabel}</span>
          ${partido.precio === 0
            ? `<span class="match-card__precio match-card__precio--gratis">🎉 Gratis</span>`
            : `<span class="match-card__precio match-card__precio--pago">💰 $${partido.precio.toLocaleString('es-CL')}</span>`}
          ${partido.aprobacionRequerida
            ? `<span class="badge badge--warning">🔒 Con aprobación</span>` : ''}
        </div>
      </div>

      ${deEquipo && partido.organizadorEquipo ? `
        <div class="card mb-4" style="background:var(--color-primary-light); border:none">
          <div class="flex items-center gap-3">
            <div style="font-size:32px">${partido.organizadorEquipo.escudo}</div>
            <div style="flex:1">
              <div class="text-xs text-muted">Organizado por el equipo</div>
              <div style="font-weight:700; font-size:var(--fs-base)">${partido.organizadorEquipo.nombre}</div>
            </div>
            <button class="btn btn--ghost btn--sm" data-ver-equipo="${partido.organizadorEquipo.id}">👁️ Ver equipo</button>
          </div>
        </div>
      ` : ''}

      <div class="detalle__info">
        <div class="detalle__info-item">
          <div class="detalle__info-label">${deEquipo ? 'Equipos' : 'Cupos'}</div>
          <div class="detalle__info-value">
            ${deEquipo
              ? `${equiposInscritos.length} / ${partido.cupos}`
              : `${inscritos.length} / ${partido.cupos}`}
          </div>
        </div>
        <div class="detalle__info-item">
          <div class="detalle__info-label">Deporte</div>
          <div class="detalle__info-value">${partido.deporte}</div>
        </div>
        ${partido.pedirPosiciones && partido.posiciones.length > 0 ? `
          <div class="detalle__info-item">
            <div class="detalle__info-label">Posiciones buscadas</div>
            <div class="detalle__info-value">${partido.posiciones.join(', ')}</div>
          </div>
        ` : ''}
      </div>

      ${partido.descripcion ? `
        <div class="card mb-4">
          <div class="detalle__seccion-titulo">📝 Descripción</div>
          <p class="text-sm">${partido.descripcion}</p>
        </div>
      ` : ''}

      <div class="card mb-4">
        <div class="detalle__seccion-titulo">🎯 Acciones</div>
        <div class="detalle__acciones">${botonAccion}</div>
      </div>

      ${/* SECCIÓN INSCRITOS (varía según tipo) */ ''}
      ${deEquipo ? renderEquiposInscritos(partido, soyAdminOGrupo) : renderJugadoresInscritos(partido, soyOrg, yoEstoyInscrito)}
    `;

    conectarEventos(partido);
  }

  /* =========================================================
     RENDER: EQUIPOS INSCRITOS
     ========================================================= */
  function renderEquiposInscritos(partido, soyAdmin) {
    const equiposInscritos = partido.equiposInscritos || [];

    if (equiposInscritos.length === 0) return '';

    return `
      <div class="card mb-4">
        <div class="detalle__seccion-titulo">🏆 Equipos inscritos (${equiposInscritos.length})</div>
        <div class="equipos-grid">
          ${equiposInscritos.map(eq => `
            <div class="equipo-card">
              <div class="equipo-card__escudo">${eq.escudo}</div>
              <div class="equipo-card__info">
                <div class="equipo-card__nombre">${eq.nombre}</div>
                <div class="equipo-card__sub">${(eq.jugadores || []).length} jugadores</div>
              </div>
              <button class="btn btn--ghost btn--sm" data-ver-equipo="${eq.id}" title="Ver equipo">👁️</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* =========================================================
     RENDER: JUGADORES INSCRITOS (comportamiento viejo)
     ========================================================= */
  function renderJugadoresInscritos(partido, soyOrg, yoEstoyInscrito) {
    const inscritos = partido.inscritos || [];

    if (inscritos.length === 0) return '';

    return `
      <div class="card mb-4">
        <div class="detalle__seccion-titulo">✅ Inscritos (${inscritos.length})</div>

        ${soyOrg ? `
          <div class="detalle__lista">
            ${inscritos.map(uid => {
              const jugador = partido.jugadores?.find(j => j.id === uid)
                || {
                  nombre: uid === partido.organizador.id ? partido.organizador.nombre : 'Jugador #' + uid,
                  avatar: `https://i.pravatar.cc/100?u=${uid}`,
                  posicion: ''
                };
              return `
                <div class="jugador-item">
                  <img src="${jugador.avatar}" class="avatar avatar--md" alt="" />
                  <div class="jugador-item__info">
                    <div class="jugador-item__nombre">${jugador.nombre}</div>
                    ${jugador.posicion ? `<div class="jugador-item__sub">${jugador.posicion}</div>` : ''}
                  </div>
                  ${uid === partido.organizador.id ? `<span class="badge badge--primary">👑 Organizador</span>` : ''}
                </div>`;
            }).join('')}
          </div>
        ` : yoEstoyInscrito ? `
          <div class="detalle__lista">
            <div class="jugador-item">
              <img src="${user.avatar}" class="avatar avatar--md" alt="" />
              <div class="jugador-item__info">
                <div class="jugador-item__nombre">${user.nombre} (tú)</div>
                <div class="jugador-item__sub">✅ Estás en la lista</div>
              </div>
            </div>
          </div>
          <p class="text-xs text-muted mt-4">
            La lista completa solo la puede ver el organizador.
          </p>
        ` : `
          <div class="empty-state--sm">
            <div class="empty-state__icon">🔒</div>
            <p class="text-sm text-muted">
              La lista de inscritos solo la puede ver el organizador y los inscritos.
            </p>
            <p class="text-xs text-muted mt-2">
              Hay <strong>${inscritos.length}</strong> de <strong>${partido.cupos}</strong> cupos ocupados.
            </p>
          </div>
        `}
      </div>
    `;
  }
  
  /* =========================================================
     CONECTAR EVENTOS
     ========================================================= */
  function conectarEventos(partido) {
    document.getElementById('btn-volver')?.addEventListener('click', () => {
      if (window.history.length > 1) window.history.back();
      else window.location.hash = '#/partidos';
    });

    // Ver perfil del organizador
    document.querySelector('[data-autor-id]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      import('../components.js').then(({ verPerfilUsuario }) => {
        verPerfilUsuario(Number(e.currentTarget.dataset.autorId));
      });
    });

    // Ver equipo (desde cualquier botón "Ver equipo")
    document.querySelectorAll('[data-ver-equipo]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        verEquipo(Number(btn.dataset.verEquipo));
      });
    });

    /* ---------- BOTONES DEL ORGANIZADOR ---------- */
    document.getElementById('btn-gestionar-equipos')?.addEventListener('click', () => {
      abrirModalPostulantesEquipos(partido);
    });

    document.getElementById('btn-gestionar-postulantes')?.addEventListener('click', () => {
      abrirGestionPostulantes(partido);
    });

    document.getElementById('btn-editar-partido')?.addEventListener('click', () => {
      abrirModalEditar(partido);
    });

    document.getElementById('btn-eliminar-partido')?.addEventListener('click', () => {
      if (!confirm('¿Eliminar este partido? Se notificará a todos los inscritos.')) return;
      (partido.inscritos || []).forEach(uid => {
        if (uid === partido.organizador.id) return;
        agregarNotificacion({
          para: uid,
          tipo: 'cancelacion',
          mensaje: `El partido "${partido.titulo}" fue cancelado por el organizador`,
          link: '#/partidos'
        });
      });
      import('../store.js').then(({ eliminarPartido }) => {
        eliminarPartido(partido.id);
        toast('Partido eliminado', 'info');
        window.location.hash = '#/partidos';
      });
    });

    /* ---------- BOTONES DEL JUGADOR ---------- */
    document.getElementById('btn-inscribirme')?.addEventListener('click', () => {
      inscribirme(partido);
    });

    document.getElementById('btn-salir-partido')?.addEventListener('click', () => {
      salirDelPartido(partido);
    });

    document.getElementById('btn-postularme')?.addEventListener('click', () => {
      postularme(partido);
    });

    document.getElementById('btn-cancelar-postulacion')?.addEventListener('click', () => {
      cancelarPostulacion(partido);
    });

    /* ---------- BOTONES DEL EQUIPO ---------- */
    document.getElementById('btn-postular-equipo')?.addEventListener('click', () => {
      abrirModalPostularMiEquipo(partido);
    });

    // Cerrar modales
    document.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.addEventListener('click', () => cerrarModal(btn.dataset.cerrarModal));
    });

    [modalEditar, modalPostulantes, modalVerEquipo].forEach(m => {
      m?.addEventListener('click', (e) => {
        if (e.target === m) m.classList.remove('open');
      });
    });
  }

  /* =========================================================
     INSCRIBIRSE (jugador)
     ========================================================= */
  function inscribirme(partido) {
    if (!user) return;
    const inscritos = partido.inscritos || [];
    if (inscritos.length >= partido.cupos) return toast('No hay cupos disponibles', 'error');
    if (inscritos.includes(user.id)) return;

    partido.inscritos = [...inscritos, user.id];
    if (partido.inscritos.length >= partido.cupos) partido.estado = 'lleno';
    guardarPartido(partido);

    agregarNotificacion({
      para: partido.organizador.id,
      tipo: 'inscripcion',
      mensaje: `${user.nombre} se inscribió en "${partido.titulo}"`,
      link: `#/partido/${partido.id}`
    });

    toast('¡Te inscribiste en el partido!', 'success');
    render();
  }

  /* =========================================================
     SALIR DEL PARTIDO
     ========================================================= */
  function salirDelPartido(partido) {
    if (!user) return;
    if (!confirm('¿Seguro que quieres salir del partido?')) return;

    partido.inscritos = (partido.inscritos || []).filter(uid => uid !== user.id);
    if (partido.estado === 'lleno') partido.estado = 'abierto';
    guardarPartido(partido);

    agregarNotificacion({
      para: partido.organizador.id,
      tipo: 'salida',
      mensaje: `${user.nombre} salió de "${partido.titulo}"`,
      link: `#/partido/${partido.id}`
    });

    toast('Saliste del partido', 'info');
    render();
  }

  /* =========================================================
     POSTULARME (jugador individual)
     ========================================================= */
  function postularme(partido) {
    if (!user) return;

    const selectPos = document.getElementById('postular-posicion');
    let posicion = '';
    if (selectPos) {
      posicion = selectPos.value.trim();
      if (!posicion) return toast('Selecciona tu posición', 'error');
    }

    partido.postulantes = partido.postulantes || [];
    if (partido.postulantes.find(p => p.userId === user.id)) {
      return toast('Ya te postulaste', 'error');
    }

    partido.postulantes.push({
      userId: user.id,
      nombre: user.nombre,
      avatar: user.avatar,
      posicion,
      estado: 'pendiente',
      fecha: new Date().toISOString()
    });
    guardarPartido(partido);

    agregarNotificacion({
      para: partido.organizador.id,
      tipo: 'postulacion',
      mensaje: `${user.nombre} quiere unirse a "${partido.titulo}"`,
      link: `#/partido/${partido.id}`
    });

    toast('Postulación enviada', 'success');
    render();
  }

  function cancelarPostulacion(partido) {
    if (!user) return;
    partido.postulantes = (partido.postulantes || []).filter(p => p.userId !== user.id);
    guardarPartido(partido);
    toast('Postulación cancelada', 'info');
    render();
  }

  /* =========================================================
     POSTULAR MI EQUIPO (a un partido de equipos)
     ========================================================= */
  function abrirModalPostularMiEquipo(partido) {
    const misEq = equiposQuePuedoPostular(partido).filter(eq =>
      !miEquipoEstaPostulado(partido, eq.id) && !miEquipoEstaInscrito(partido, eq.id)
    );

    if (misEq.length === 0) {
      return toast('No tenés equipos disponibles para postular', 'error');
    }

    // Si tiene solo 1, postular directo
    if (misEq.length === 1) {
      postularEquipo(partido, misEq[0]);
      return;
    }

    // Si tiene varios, mostrar prompt simple (podés hacer un modal después)
    const opciones = misEq.map((eq, i) => `${i + 1}. ${eq.escudo} ${eq.nombre}`).join('\n');
    const elegido = prompt(`¿Con cuál equipo querés postular?\n\n${opciones}\n\nEscribí el número:`);
    if (!elegido) return;

    const idx = Number(elegido) - 1;
    if (isNaN(idx) || !misEq[idx]) return toast('Opción inválida', 'error');

    postularEquipo(partido, misEq[idx]);
  }

  function postularEquipo(partido, equipo) {
    postularEquipoAPartido(partido.id, equipo);

    agregarNotificacion({
      para: partido.organizador.id,
      tipo: 'postulacion',
      mensaje: `${equipo.escudo} ${equipo.nombre} quiere unirse a "${partido.titulo}"`,
      link: `#/partido/${partido.id}`
    });

    toast(`Postulación enviada con ${equipo.nombre}`, 'success');
    render();
  }

  /* =========================================================
     MODAL: EQUIPOS POSTULANTES (para el organizador)
     ========================================================= */
  function abrirModalPostulantesEquipos(partido) {
    const body = document.getElementById('equipos-postulantes-body');
    if (!body) return;

    const postulantes = partido.equiposPostulantes || [];
    const pendientes = postulantes.filter(p => p.estado === 'pendiente');

    if (postulantes.length === 0) {
      body.innerHTML = `
        <div class="empty-state--sm">
          <div class="empty-state__icon">🛡️</div>
          <p>Aún no hay equipos postulantes</p>
        </div>`;
    } else {
      body.innerHTML = `
        <p class="text-sm text-muted mb-4">
          ${pendientes.length} equipo${pendientes.length !== 1 ? 's' : ''} esperando aprobación
        </p>

        ${postulantes.map((post, i) => `
          <div class="solicitud-item" style="align-items:flex-start">
            <div class="avatar avatar--md" style="background:var(--color-primary-light); display:grid; place-items:center; font-size:22px; flex-shrink:0">
              ${post.equipo.escudo}
            </div>
            <div class="solicitud-item__info">
              <div class="solicitud-item__nombre">${post.equipo.nombre}</div>
              <div class="solicitud-item__meta">
                👥 ${(post.equipo.jugadores || []).length} jugadores · 
                Postuló el ${new Date(post.fecha).toLocaleDateString('es-CL')}
              </div>
              ${post.estado !== 'pendiente' ? `
                <span class="badge badge--${post.estado === 'aceptado' ? 'success' : 'danger'}" style="margin-top:4px">
                  ${post.estado === 'aceptado' ? '✅ Aceptado' : '❌ Rechazado'}
                </span>
              ` : ''}
            </div>
            <div class="solicitud-item__actions" style="flex-direction:column; align-items:flex-end">
              <button class="btn btn--ghost btn--sm" data-ver-eq="${post.equipoId}" style="margin-bottom:4px">
                👁️ Ver equipo
              </button>
              ${post.estado === 'pendiente' ? `
                <button class="btn btn--ghost btn--sm" data-msj-eq="${post.equipo.capitanId}" style="margin-bottom:4px">
                  💬 Mensaje
                </button>
                <div class="flex gap-2" style="margin-top:4px">
                  <button class="btn btn--primary btn--sm" data-aceptar-eq="${post.equipoId}">Aprobar</button>
                  <button class="btn btn--ghost btn--sm" data-rechazar-eq="${post.equipoId}">✕</button>
                </div>
              ` : `
                <button class="btn btn--ghost btn--sm" data-msj-eq="${post.equipo.capitanId}" style="margin-top:4px">
                  💬 Mensaje al capitán
                </button>
              `}
            </div>
          </div>
        `).join('')}
      `;

      // Conectar: ver equipo
      body.querySelectorAll('[data-ver-eq]').forEach(btn => {
        btn.addEventListener('click', () => {
          verEquipo(Number(btn.dataset.verEq));
        });
      });

      // Conectar: mensaje al capitán
      body.querySelectorAll('[data-msj-eq]').forEach(btn => {
        btn.addEventListener('click', () => {
          abrirChatConCapitan(partido, Number(btn.dataset.msjEq));
        });
      });

      // Conectar: aprobar
      body.querySelectorAll('[data-aceptar-eq]').forEach(btn => {
        btn.addEventListener('click', () => {
          const eqId = Number(btn.dataset.aceptarEq);
          aprobarEquipo(partido, eqId);
        });
      });

      // Conectar: rechazar
      body.querySelectorAll('[data-rechazar-eq]').forEach(btn => {
        btn.addEventListener('click', () => {
          const eqId = Number(btn.dataset.rechazarEq);
          rechazarEquipo(partido, eqId);
        });
      });
    }

    modalPostulantes.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-equipos-postulantes');
    });

    abrirModal('modal-equipos-postulantes');
  }

  function aprobarEquipo(partido, equipoId) {
    const post = (partido.equiposPostulantes || []).find(p => p.equipoId === equipoId);
    if (!post) return;

    aceptarEquipoPostulante(partido.id, equipoId);
    const actualizado = getPartidoPorId(partido.id);

    // Notificar al capitán
    agregarNotificacion({
      para: post.equipo.capitanId,
      tipo: 'aprobado',
      mensaje: `¡Tu equipo ${post.equipo.escudo} ${post.equipo.nombre} fue aceptado en "${actualizado.titulo}"!`,
      link: `#/partido/${actualizado.id}`
    });

    toast('Equipo aprobado', 'success');
    abrirModalPostulantesEquipos(actualizado);
    render();
  }

  function rechazarEquipo(partido, equipoId) {
    const post = (partido.equiposPostulantes || []).find(p => p.equipoId === equipoId);
    if (!post) return;

    rechazarEquipoPostulante(partido.id, equipoId);

    agregarNotificacion({
      para: post.equipo.capitanId,
      tipo: 'rechazado',
      mensaje: `Tu equipo ${post.equipo.escudo} ${post.equipo.nombre} fue rechazado en "${partido.titulo}"`,
      link: `#/partido/${partido.id}`
    });

    toast('Equipo rechazado', 'info');
    abrirModalPostulantesEquipos(getPartidoPorId(partido.id));
    render();
  }

  /* =========================================================
     CHAT CONTEXTUAL: organizador ↔ capitán
     ========================================================= */
  function abrirChatConCapitan(partido, capitanId) {
    if (!user) return;
    if (capitanId === user.id) {
      return toast('Ese es tu propio equipo', 'info');
    }

    // Crear conversación vinculada al partido
    const conv = obtenerOCrearConversacionVinculada(user.id, capitanId, {
      tipo: 'partido',
      id: partido.id,
      nombre: partido.titulo
    });

    cerrarModal('modal-equipos-postulantes');
    window.location.hash = '#/mensajes';

    // Intentar abrir la conversación al llegar
    setTimeout(() => {
      const el = document.querySelector(`[data-conv="${conv.id}"]`);
      el?.click();
    }, 400);

    toast('Chat abierto con el capitán', 'success');
  }

  /* =========================================================
     VER EQUIPO (con plantilla)
     ========================================================= */
  function verEquipo(equipoId) {
    const equipo = getGrupoPorId(equipoId);
    if (!equipo) return toast('Equipo no encontrado', 'error');

    document.getElementById('ver-equipo-titulo').textContent = `${equipo.escudo} ${equipo.nombre}`;

    const jugadores = equipo.jugadores || [];

    document.getElementById('ver-equipo-body').innerHTML = `
      <div class="ver-equipo__header">
        <div class="ver-equipo__escudo">${equipo.escudo}</div>
        <div>
          <div class="ver-equipo__nombre">${equipo.nombre}</div>
          <div class="ver-equipo__meta">
            ${equipo.deporte}${equipo.ciudad ? ' · ' + equipo.ciudad : ''}
          </div>
          ${equipo.stats ? `
            <div class="flex gap-2 mt-2" style="flex-wrap:wrap">
              <span class="badge badge--success">${equipo.stats.victorias || 0} V</span>
              <span class="badge badge--warning">${equipo.stats.empates || 0} E</span>
              <span class="badge badge--danger">${equipo.stats.derrotas || 0} D</span>
            </div>
          ` : ''}
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
            const capitan = j.id === equipo.capitanId;
            return `
              <div class="player-row">
                <div class="player-row__pos">${j.posicion ? j.posicion.slice(0, 3).toUpperCase() : '—'}</div>
                <img src="${j.avatar}" class="avatar avatar--md" alt="" data-ver-perfil="${j.id}" style="cursor:pointer" />
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

    // Conectar clicks en jugadores
    document.getElementById('ver-equipo-body').querySelectorAll('[data-ver-perfil]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        import('../components.js').then(({ verPerfilUsuario }) => {
          verPerfilUsuario(Number(el.dataset.verPerfil));
        });
      });
    });

    modalVerEquipo.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-ver-equipo');
    });

    abrirModal('modal-ver-equipo');
  }

  /* =========================================================
     GESTIONAR POSTULANTES (jugadores) - VERSION SIMPLE
     ========================================================= */
  function abrirGestionPostulantes(partido) {
    const postulantes = partido.postulantes || [];

    if (postulantes.length === 0) {
      return toast('No hay postulantes todavía', 'info');
    }

    // Listado simple en consola + prompt
    const opciones = postulantes.map((p, i) =>
      `${i + 1}. ${p.nombre} ${p.posicion ? '(' + p.posicion + ')' : ''} - ${p.estado}`
    ).join('\n');

    const elegido = prompt(`Postulantes:\n\n${opciones}\n\nEscribí el número para aprobar (o cancelá):`);
    if (!elegido) return;

    const idx = Number(elegido) - 1;
    const post = postulantes[idx];
    if (!post) return toast('Opción inválida', 'error');

    if (post.estado === 'pendiente') {
      if ((partido.inscritos || []).length >= partido.cupos) {
        return toast('No quedan cupos', 'error');
      }
      post.estado = 'aprobado';
      partido.inscritos = [...(partido.inscritos || []), post.userId];

      if (partido.inscritos.length >= partido.cupos) {
        partido.estado = 'lleno';
      }

      guardarPartido(partido);

      agregarNotificacion({
        para: post.userId,
        tipo: 'aprobado',
        mensaje: `¡Estás dentro de "${partido.titulo}"!`,
        link: `#/partido/${partido.id}`
      });

      toast('Postulante aprobado', 'success');
      render();
    }
  }

  /* =========================================================
     MODAL EDITAR PARTIDO
     ========================================================= */
  function abrirModalEditar(partido) {
    if (!modalEditar) return;

    const [fecha, horaFull] = partido.fecha.split('T');
    const hora = (horaFull || '00:00').slice(0, 5);

    document.getElementById('edit-titulo').value = partido.titulo;
    document.getElementById('edit-fecha').value = fecha;
    document.getElementById('edit-hora').value = hora;
    document.getElementById('edit-lugar').value = partido.lugar;
    document.getElementById('edit-cupos').value = partido.cupos;
    document.getElementById('edit-descripcion').value = partido.descripcion || '';

    const gratis = partido.precio === 0;
    document.getElementById('edit-gratis').checked = gratis;
    document.getElementById('edit-precio').value = gratis ? '5000' : partido.precio;
    document.getElementById('edit-precio-wrapper').classList.toggle('hidden', gratis);

    const inscritosCount = esDeEquipo(partido)
      ? (partido.equiposInscritos || []).length
      : (partido.inscritos || []).length;

    document.getElementById('edit-cupos-hint').textContent =
      `Actualmente hay ${inscritosCount} ${esDeEquipo(partido) ? 'equipos' : 'inscritos'}. No puedes poner menos de ${inscritosCount}.`;

    const checkGratis = document.getElementById('edit-gratis');
    checkGratis.onchange = () => {
      document.getElementById('edit-precio-wrapper').classList.toggle('hidden', checkGratis.checked);
    };

    const btnGuardar = document.getElementById('btn-guardar-edicion');
    btnGuardar.onclick = () => guardarEdicion(partido);

    modalEditar.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-editar-partido');
    });
    modalEditar.onclick = (e) => {
      if (e.target === modalEditar) cerrarModal('modal-editar-partido');
    };

    abrirModal('modal-editar-partido');
  }

  function guardarEdicion(partido) {
    const nuevoTitulo      = document.getElementById('edit-titulo').value.trim();
    const nuevaFecha       = document.getElementById('edit-fecha').value;
    const nuevaHora        = document.getElementById('edit-hora').value;
    const nuevoLugar       = document.getElementById('edit-lugar').value.trim();
    const nuevosCupos      = Number(document.getElementById('edit-cupos').value);
    const esGratis         = document.getElementById('edit-gratis').checked;
    const nuevoPrecio      = esGratis ? 0 : Number(document.getElementById('edit-precio').value);
    const nuevaDescripcion = document.getElementById('edit-descripcion').value.trim();

    const inscritosCount = esDeEquipo(partido)
      ? (partido.equiposInscritos || []).length
      : (partido.inscritos || []).length;

    if (!nuevoTitulo)  return toast('El título no puede estar vacío', 'error');
    if (!nuevaFecha)   return toast('Selecciona una fecha', 'error');
    if (!nuevaHora)    return toast('Selecciona una hora', 'error');
    if (!nuevoLugar)   return toast('Ingresa un lugar', 'error');
    if (nuevosCupos < inscritosCount) {
      return toast(`No puedes bajar de ${inscritosCount} cupos`, 'error');
    }
    if (!esGratis && nuevoPrecio < 0) {
      return toast('El precio no puede ser negativo', 'error');
    }

    const fechaHoraNueva = `${nuevaFecha}T${nuevaHora}:00`;
    const cambios = [];
    if (nuevoTitulo !== partido.titulo)                    cambios.push('título');
    if (fechaHoraNueva !== partido.fecha)                  cambios.push('fecha/hora');
    if (nuevoLugar !== partido.lugar)                      cambios.push('lugar');
    if (nuevosCupos !== partido.cupos)                     cambios.push('cupos');
    if (nuevoPrecio !== partido.precio)                    cambios.push('precio');
    if (nuevaDescripcion !== (partido.descripcion || ''))  cambios.push('descripción');

    if (cambios.length === 0) {
      toast('No hay cambios que guardar', 'info');
      cerrarModal('modal-editar-partido');
      return;
    }

    partido.titulo      = nuevoTitulo;
    partido.fecha       = fechaHoraNueva;
    partido.lugar       = nuevoLugar;
    partido.cupos       = nuevosCupos;
    partido.precio      = nuevoPrecio;
    partido.descripcion = nuevaDescripcion;

    if (partido.estado === 'lleno' && inscritosCount < partido.cupos) {
      partido.estado = 'abierto';
    }

    guardarPartido(partido);

    // Notificar
    const listaCambios = cambios.join(', ');
    (partido.inscritos || []).forEach(uid => {
      if (uid === partido.organizador.id) return;
      agregarNotificacion({
        para: uid,
        tipo: 'edicion',
        mensaje: `"${partido.titulo}" fue modificado (${listaCambios})`,
        link: `#/partido/${partido.id}`
      });
    });

    (partido.postulantes || []).forEach(p => {
      if (p.estado !== 'pendiente') return;
      agregarNotificacion({
        para: p.userId,
        tipo: 'edicion',
        mensaje: `"${partido.titulo}" fue modificado (${listaCambios})`,
        link: `#/partido/${partido.id}`
      });
    });

    cerrarModal('modal-editar-partido');
    toast(`Partido actualizado (${listaCambios})`, 'success');
    render();
  }

  /* =========================================================
     INIT
     ========================================================= */
  render();

  return null;
}