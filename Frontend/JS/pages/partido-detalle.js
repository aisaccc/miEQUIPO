import { getSesion } from '../auth.js';
import { formatearFecha, toast, abrirModal, cerrarModal } from '../components.js';
import { listarGrupos, obtenerGrupo } from '../services/grupos.service.js';
import { api } from '../api.js';
import {
  obtenerPartido,
  editarPartido as editarPartidoAPI,
  eliminarPartido as eliminarPartidoAPI,
  inscribirse as inscribirseAPI,
  salirDelPartido as salirDelPartidoAPI,
  postularse as postularseAPI,
  cancelarPostulacion as cancelarPostulacionAPI,
  gestionarPostulante as gestionarPostulanteAPI,
  postularEquipo as postularEquipoAPI,
  gestionarEquipoPostulante as gestionarEquipoPostulanteAPI,
  interesarse as interesarseAPI,
  cancelarInteres as cancelarInteresAPI,
  listarInteresados as listarInteresadosAPI,
  confirmarPartido as confirmarPartidoAPI,
  aprobarConfirmacion as aprobarConfirmacionAPI,
  rechazarConfirmacion as rechazarConfirmacionAPI,
  cancelarConfirmacion as cancelarConfirmacionAPI,
} from '../services/partidos.service.js';

export async function init(params = {}) {
  const id = params.id;
  const user = getSesion();
  const contenedor = document.getElementById('detalle-partido');
  if (!contenedor || !id) return null;

  /* ---------- MODALES ---------- */
  const modalEditar            = document.getElementById('modal-editar-partido');
  const modalPostulantes       = document.getElementById('modal-equipos-postulantes');
  const modalVerEquipo         = document.getElementById('modal-ver-equipo');
  const modalConfirmarPartido  = document.getElementById('modal-confirmar-partido');

  /* ---------- ESTADO LOCAL ---------- */
  let partido = null;
  let misEquipos = [];
  let interesados = [];
  let interesadoSeleccionado = null;
  let confirmacionPendiente = null;

  /* ---------- HELPERS ---------- */
  function esDeEquipo(p) {
    return p.tipoPartido === 'equipo';
  }

  function esModoOrganizar(p) {
    return p.estadoPartido === 'buscando_jugadores';
  }

  function estaConfirmado(p) {
    return p.estadoPartido === 'confirmado';
  }

  function soyOrganizador(p) {
    return user && String(p.organizador?.id) === String(user.id);
  }

  function miEquipoEsOrganizador(p) {
    if (!user) return false;
    if (!p.organizadorEquipoId) return false;
    return misEquipos.some(eq => String(eq.id) === String(p.organizadorEquipoId));
  }

  function equiposQuePuedoPostular(p) {
    return misEquipos.filter(eq => eq.deporte === p.deporte);
  }

  function miEquipoEstaPostulado(p, eqId) {
    return (p.equiposPostulantes || []).some(e =>
      String(e.equipoId ?? e.equipo_id ?? e.id) === String(eqId)
    );
  }

  function miEquipoEstaInscrito(p, eqId) {
    return (p.equiposInscritos || []).some(e =>
      String(e.equipoId ?? e.equipo_id ?? e.id) === String(eqId)
    );
  }

  function renderEmoji(emoji, size = 32) {
    if (!emoji) return '🏅';
    if (typeof emoji === 'string' && /\.(svg|png|jpg|jpeg|gif|webp)$/i.test(emoji)) {
      return `<img src="${emoji}" alt="" style="width:${size}px;height:${size}px;object-fit:contain;display:block" />`;
    }
    return emoji;
  }

  function avatarDe(u) {
    return u?.avatar || 'assets/icons/usuario.svg';
  }
    /* =========================================================
     RENDER PRINCIPAL
     ========================================================= */
  async function render() {
    try {
      partido = await obtenerPartido(id);
    } catch (err) {
      console.error('[partido-detalle] Error al cargar:', err);
      contenedor.innerHTML = `
        <div class="detalle__top">
          <button class="detalle__back" id="btn-volver">←</button>
        </div>
        <div class="card">
          <h2 class="card__title">Partido no encontrado</h2>
          <p class="card__subtitle">${err.message || 'Puede que haya sido eliminado.'}</p>
        </div>`;
      document.getElementById('btn-volver')?.addEventListener('click', () => {
        if (window.history.length > 1) window.history.back();
        else window.location.hash = '#/partidos';
      });
      return;
    }

    // Cargar mis equipos
    try {
      const { data } = await listarGrupos({ tipo: 'equipo', soloMios: 'true', limit: 50 });
      misEquipos = data || [];
    } catch (err) {
      console.error('[partido-detalle] Error al cargar equipos:', err);
      misEquipos = [];
    }

    const deEquipo = esDeEquipo(partido);
    const enModoOrganizar = esModoOrganizar(partido);
    const confirmado = estaConfirmado(partido);

    const inscritos = partido.inscritos || [];
    const postulantes = partido.postulantes || [];
    const equiposPostulantes = partido.equiposPostulantes || [];
    const equiposInscritos = partido.equiposInscritos || [];

    // Flags
    const yoEstoyInscrito = !!partido.miInscripcion;
    const yoPostule = partido.miPostulacion || null;
    const yoInteresado = !!partido.yoInteresado;

    confirmacionPendiente = partido.confirmacionPendiente || null;

    const soyOrg = soyOrganizador(partido);
    const soyCapitanDelOrg = miEquipoEsOrganizador(partido);
    const soyAdminOGrupo = soyOrg || soyCapitanDelOrg;

    const cuposDisponibles = partido.cupos - (deEquipo ? equiposInscritos.length : inscritos.length);

    const nivelLabel = {
      amistoso: 'Amistoso',
      semiprofesional: 'Semiprofesional',
      profesional: 'Profesional'
    }[partido.nivel] || partido.nivel;

    const badgeEstado = enModoOrganizar ? 'badge--warning' :
      confirmado      ? 'badge--primary' :
      {
        abierto: 'badge--success',
        lleno: 'badge--danger',
        finalizado: 'badge--neutral'
      }[partido.estado] || 'badge--neutral';

    const badgeTexto = enModoOrganizar
      ? '📢 Organizando'
      : confirmado
        ? '✅ Confirmado'
        : partido.estado.charAt(0).toUpperCase() + partido.estado.slice(1);

    /* =========================================================
       BOTÓN DE ACCIÓN PRINCIPAL
       ========================================================= */
    let botonAccion = '';

    if (!user) {
      botonAccion = `<button class="btn btn--primary" disabled>Inicia sesión para participar</button>`;
    } else if (enModoOrganizar) {
      // =========================================================
      // MODO ORGANIZAR
      // =========================================================
      if (soyOrg || soyCapitanDelOrg) {
        const bloquePropuesta = confirmacionPendiente
          ? `
            <div class="aviso-aprobacion show" style="width:100%; margin-bottom:var(--space-3)">
              <span class="aviso-aprobacion__icon">⏳</span>
              <div>
                <strong>Propuesta enviada a ${confirmacionPendiente.interesadoNombre}.</strong>
                Esperando respuesta. Podés cancelarla si querés proponerle a otro.
              </div>
            </div>
          `
          : '';

        const botonCancelarPropuesta = confirmacionPendiente
          ? `<button class="btn btn--ghost" id="btn-cancelar-propuesta" style="color:var(--color-danger)">❌ Cancelar propuesta</button>`
          : '';

        botonAccion = `
          ${bloquePropuesta}
          <button class="btn btn--primary" id="btn-ver-interesados">
            👥 Ver interesados
          </button>
          ${botonCancelarPropuesta}
          <button class="btn btn--ghost" id="btn-editar-partido">✏️ Editar convocatoria</button>
          <button class="btn btn--ghost" id="btn-eliminar-partido" style="color:var(--color-danger)">🗑️ Eliminar</button>
        `;
      } else {
        if (confirmacionPendiente && confirmacionPendiente.esInteresado) {
          const fechaProp = confirmacionPendiente.fecha
            ? new Date(confirmacionPendiente.fecha).toLocaleString('es-CL', {
                day: 'numeric', month: 'long',
                hour: '2-digit', minute: '2-digit'
              })
            : 'Sin fecha';

          botonAccion = `
            <div class="card" style="width:100%; background:var(--color-primary-light); border:none; margin-bottom:var(--space-3)">
              <div style="font-weight:700; font-size:var(--fs-base); margin-bottom:var(--space-3)">
                📢 El organizador quiere confirmar el partido contigo
              </div>

              <div class="detalle__lista" style="gap:var(--space-2)">
                <div class="jugador-item" style="background:white">
                  <div class="jugador-item__info">
                    <div class="jugador-item__sub">📅 Fecha</div>
                    <div class="jugador-item__nombre">${fechaProp}</div>
                  </div>
                </div>
                <div class="jugador-item" style="background:white">
                  <div class="jugador-item__info">
                    <div class="jugador-item__sub">📍 Lugar</div>
                    <div class="jugador-item__nombre">${confirmacionPendiente.lugar || '—'}</div>
                  </div>
                </div>
                <div class="jugador-item" style="background:white">
                  <div class="jugador-item__info">
                    <div class="jugador-item__sub">💰 Precio</div>
                    <div class="jugador-item__nombre">${confirmacionPendiente.precio === 0 ? 'Gratis' : '$' + confirmacionPendiente.precio.toLocaleString('es-CL')}</div>
                  </div>
                </div>
              </div>

              ${confirmacionPendiente.mensaje ? `
                <div class="text-sm" style="margin-top:var(--space-3); padding:var(--space-3); background:white; border-radius:var(--radius-md); font-style:italic">
                  💬 "${confirmacionPendiente.mensaje}"
                </div>
              ` : ''}

              <div class="flex gap-2 mt-4" style="flex-wrap:wrap">
                <button class="btn btn--primary" id="btn-aprobar-propuesta">
                  ✅ Aprobar y confirmar
                </button>
                <button class="btn btn--ghost" id="btn-rechazar-propuesta" style="color:var(--color-danger)">
                  ❌ Rechazar
                </button>
              </div>
            </div>
          `;
        } else if (yoInteresado) {
          botonAccion = `
            <span class="badge badge--warning" style="padding:10px 16px">
              🙋 Ya te marcaste interesado
            </span>
            <button class="btn btn--ghost" id="btn-cancelar-interes" style="color:var(--color-danger)">
              Cancelar interés
            </button>
            <p class="text-xs text-muted" style="width:100%; margin-top:var(--space-2)">
              Esperando que el organizador te contacte por chat.
            </p>
          `;
        } else {
          botonAccion = `
            <button class="btn btn--primary" id="btn-interesarme">
              🙋 Me interesa
            </button>
            <p class="text-xs text-muted" style="width:100%; margin-top:var(--space-2)">
              El organizador verá tu interés y podrá contactarte por chat.
            </p>
          `;
        }
      }
    } else if (confirmado) {
      // =========================================================
      // PARTIDO CONFIRMADO POR AMBAS PARTES → CERRADO
      // =========================================================
      if (soyAdminOGrupo) {
        // El organizador sigue viendo sus botones de gestión
        if (deEquipo) {
          botonAccion = `
            <button class="btn btn--primary" id="btn-gestionar-equipos">
              🛡️ Ver equipos inscritos
            </button>
            <button class="btn btn--ghost" id="btn-editar-partido">✏️ Editar partido</button>
            <button class="btn btn--ghost" id="btn-eliminar-partido" style="color:var(--color-danger)">🗑️ Eliminar</button>
          `;
        } else {
          botonAccion = `
            <button class="btn btn--ghost" id="btn-editar-partido">✏️ Editar partido</button>
            <button class="btn btn--ghost" id="btn-eliminar-partido" style="color:var(--color-danger)">🗑️ Eliminar</button>
          `;
        }
      } else {
        // No soy organizador
        if (deEquipo) {
          if (partido.miEquipoInscrito) {
            botonAccion = `<span class="badge badge--success" style="padding:10px 16px">✅ Tu equipo está confirmado en este partido</span>`;
          } else {
            botonAccion = `<span class="badge badge--neutral" style="padding:10px 16px">🔒 Este partido ya fue confirmado con otro equipo</span>`;
          }
        } else {
          if (yoEstoyInscrito) {
            botonAccion = `<button class="btn btn--ghost" id="btn-salir-partido" style="color:var(--color-danger)">❌ Salir del partido</button>`;
          } else {
            botonAccion = `<span class="badge badge--neutral" style="padding:10px 16px">🔒 Este partido ya fue confirmado con otro jugador</span>`;
          }
        }
      }
    } else if (soyAdminOGrupo) {
      // Modo normal - organizador
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
      const misEqDeEsteDeporte = equiposQuePuedoPostular(partido);

      if (misEqDeEsteDeporte.length === 0) {
        botonAccion = `<span class="badge badge--neutral" style="padding:10px 16px">No tenés equipos de ${partido.deporte}</span>`;
      } else {
        const yaInscrito = !!partido.miEquipoInscrito;
        const yaPostulado = !!partido.miEquipoPostulado;

        if (yaInscrito) {
          botonAccion = `<span class="badge badge--success" style="padding:10px 16px">✅ Tu equipo está inscrito</span>`;
        } else if (yaPostulado) {
          botonAccion = `
            <span class="badge badge--warning" style="padding:10px 16px">⏳ Tu equipo está postulado, esperando aprobación</span>
            <button class="btn btn--ghost btn--sm" id="btn-cancelar-postulacion-equipo" style="color:var(--color-danger)">Cancelar postulación</button>
          `;
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
       INFO DE FECHA / LUGAR
       ========================================================= */
    const infoFecha = enModoOrganizar
      ? `<span>📅 A coordinar</span>`
      : `<span>📅 ${formatearFecha(partido.fecha)}</span>`;

    const infoLugar = enModoOrganizar
      ? `<span>📍 A coordinar</span>`
      : `<span>📍 ${partido.lugar}</span>`;

    const badgeModoHtml = enModoOrganizar
      ? `<span class="badge badge--primary">📢 Organizar partido</span>`
      : '';

    const precioHtml = enModoOrganizar
      ? `<span class="match-card__precio match-card__precio--gratis">📢 A coordinar</span>`
      : (partido.precio === 0
        ? `<span class="match-card__precio match-card__precio--gratis">🎉 Gratis</span>`
        : `<span class="match-card__precio match-card__precio--pago">💰 $${partido.precio.toLocaleString('es-CL')}</span>`);

    const aprobacionHtml = partido.aprobacionRequerida && !enModoOrganizar
      ? `<span class="badge badge--warning">🔒 Con aprobación</span>`
      : '';

    /* =========================================================
       RENDER
       ========================================================= */
    contenedor.innerHTML = `
      <div class="detalle__top">
        <button class="detalle__back" id="btn-volver">←</button>
        <h2 class="page-title" style="margin:0; font-size:var(--fs-lg)">Detalle del partido</h2>
      </div>

      <div class="detalle__hero">
        <div class="detalle__hero-emoji">${renderEmoji(partido.emoji, 52)}</div>
        <h1 class="detalle__hero-title">${partido.titulo}</h1>
        <div class="detalle__hero-meta">
          ${infoFecha}
          ${infoLugar}
          <span data-autor-id="${partido.organizador.id}" style="cursor:pointer; text-decoration:underline">
            👤 ${partido.organizador.nombre}
          </span>
        </div>
        <div class="detalle__badges">
          <span class="badge ${badgeEstado}">${badgeTexto}</span>
          <span class="badge badge--${deEquipo ? 'warning' : 'info'}">
            ${deEquipo ? '🛡️ De equipos' : '👤 De jugadores'}
          </span>
          ${badgeModoHtml}
          <span class="nivel-badge nivel-badge--${partido.nivel}">${nivelLabel}</span>
          ${precioHtml}
          ${aprobacionHtml}
        </div>
      </div>

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

      ${!enModoOrganizar && deEquipo ? renderEquiposInscritos(partido, soyAdminOGrupo) : ''}
      ${!enModoOrganizar && !deEquipo ? renderJugadoresInscritos(partido, soyOrg, yoEstoyInscrito) : ''}
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
              <div class="equipo-card__escudo">${eq.escudo || '🛡️'}</div>
              <div class="equipo-card__info">
                <div class="equipo-card__nombre">${eq.nombre}</div>
                <div class="equipo-card__sub">${eq.totalJugadores || 0} jugadores</div>
              </div>
              <button class="btn btn--ghost btn--sm" data-ver-equipo="${eq.id}" title="Ver equipo">👁️</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* =========================================================
     RENDER: JUGADORES INSCRITOS
     ========================================================= */
  function renderJugadoresInscritos(partido, soyOrg, yoEstoyInscrito) {
    const inscritos = partido.inscritos || [];
    if (inscritos.length === 0) return '';

    return `
      <div class="card mb-4">
        <div class="detalle__seccion-titulo">✅ Inscritos (${inscritos.length})</div>
        ${soyOrg ? `
          <div class="detalle__lista">
            ${inscritos.map(j => {
              const nombre = j.nombre || 'Jugador';
              const avatar = j.avatar || 'assets/icons/usuario.svg';
              const posicion = j.posicion || '';
              const esOrganizador = String(j.id) === String(partido.organizador.id);
              return `
                <div class="jugador-item">
                  <img src="${avatar}" class="avatar avatar--md" alt="" />
                  <div class="jugador-item__info">
                    <div class="jugador-item__nombre">${nombre}</div>
                    ${posicion ? `<div class="jugador-item__sub">${posicion}</div>` : ''}
                  </div>
                  ${esOrganizador ? `<span class="badge badge--primary">👑 Organizador</span>` : ''}
                </div>`;
            }).join('')}
          </div>
        ` : yoEstoyInscrito ? `
          <div class="detalle__lista">
            <div class="jugador-item">
              <img src="${user.avatar || 'assets/icons/usuario.svg'}" class="avatar avatar--md" alt="" />
              <div class="jugador-item__info">
                <div class="jugador-item__nombre">${user.nombre} (tú)</div>
                <div class="jugador-item__sub">✅ Estás en la lista</div>
              </div>
            </div>
          </div>
          <p class="text-xs text-muted mt-4">La lista completa solo la puede ver el organizador.</p>
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

    document.querySelector('[data-autor-id]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      import('../components.js').then(({ verPerfilUsuario }) => {
        verPerfilUsuario(e.currentTarget.dataset.autorId);
      });
    });

    document.querySelectorAll('[data-ver-equipo]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await verEquipo(btn.dataset.verEquipo);
      });
    });

    /* ---------- BOTONES MODO ORGANIZAR ---------- */
    document.getElementById('btn-interesarme')?.addEventListener('click', () => {
      interesarse(partido);
    });

    document.getElementById('btn-cancelar-interes')?.addEventListener('click', () => {
      cancelarInteres(partido);
    });

    document.getElementById('btn-ver-interesados')?.addEventListener('click', () => {
      abrirModalInteresados(partido);
    });

    /* ---------- BOTONES DE CONFIRMACIÓN ---------- */
    document.getElementById('btn-aprobar-propuesta')?.addEventListener('click', () => {
      aprobarPropuesta(partido);
    });

    document.getElementById('btn-rechazar-propuesta')?.addEventListener('click', () => {
      rechazarPropuesta(partido);
    });

    document.getElementById('btn-cancelar-propuesta')?.addEventListener('click', () => {
      cancelarPropuesta(partido);
    });

    /* ---------- BOTONES ORGANIZADOR (modo normal) ---------- */
    document.getElementById('btn-gestionar-equipos')?.addEventListener('click', () => {
      abrirModalPostulantesEquipos(partido);
    });

    document.getElementById('btn-gestionar-postulantes')?.addEventListener('click', () => {
      abrirGestionPostulantes(partido);
    });

    document.getElementById('btn-editar-partido')?.addEventListener('click', () => {
      abrirModalEditar(partido);
    });

    document.getElementById('btn-eliminar-partido')?.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este partido? Esta acción no se puede deshacer.')) return;
      try {
        await eliminarPartidoAPI(partido.id);
        toast('Partido eliminado', 'info');
        window.location.hash = '#/partidos';
      } catch (err) {
        console.error('[partido-detalle] Error al eliminar:', err);
        toast(err.message || 'No se pudo eliminar el partido', 'error');
      }
    });

    /* ---------- BOTONES JUGADOR (modo normal) ---------- */
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

    document.getElementById('btn-postular-equipo')?.addEventListener('click', () => {
      abrirModalPostularMiEquipo(partido);
    });

    document.getElementById('btn-cancelar-postulacion-equipo')?.addEventListener('click', () => {
      cancelarPostulacionEquipo(partido);
    });

    document.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.addEventListener('click', () => cerrarModal(btn.dataset.cerrarModal));
    });

    [modalEditar, modalPostulantes, modalVerEquipo, modalConfirmarPartido].forEach(m => {
      m?.addEventListener('click', (e) => {
        if (e.target === m) m.classList.remove('open');
      });
    });
  }

  /* =========================================================
     INTERESARSE
     ========================================================= */
  async function interesarse(partido) {
    if (!user) return;

    try {
      await interesarseAPI(partido.id);
      toast('¡Te marcaste como interesado! El organizador podrá contactarte.', 'success');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al interesarse:', err);
      toast(err.message || 'No se pudo marcar interés', 'error');
    }
  }

  /* =========================================================
     CANCELAR INTERÉS
     ========================================================= */
  async function cancelarInteres(partido) {
    if (!user) return;
    if (!confirm('¿Cancelar tu interés en este partido?')) return;

    try {
      await cancelarInteresAPI(partido.id);
      toast('Interés cancelado', 'info');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al cancelar interés:', err);
      toast(err.message || 'No se pudo cancelar el interés', 'error');
    }
  }

  /* =========================================================
     MODAL: INTERESADOS (organizador)
     ========================================================= */
  async function abrirModalInteresados(partido) {
    const body = document.getElementById('equipos-postulantes-body');
    if (!body) return;

    try {
      interesados = await listarInteresadosAPI(partido.id);
    } catch (err) {
      console.error('[partido-detalle] Error al cargar interesados:', err);
      toast(err.message || 'No se pudieron cargar los interesados', 'error');
      return;
    }

    const hayPropuesta = !!confirmacionPendiente;

    if (interesados.length === 0) {
      body.innerHTML = `
        <div class="empty-state--sm">
          <div class="empty-state__icon">🙋</div>
          <p>Aún no hay interesados</p>
          <p class="text-xs text-muted mt-2">Compartí el partido para que se anoten</p>
        </div>`;
    } else {
      body.innerHTML = `
        ${hayPropuesta ? `
          <div class="aviso-aprobacion show mb-4">
            <span class="aviso-aprobacion__icon">⏳</span>
            <div>
              <strong>Ya hay una propuesta enviada a ${confirmacionPendiente.interesadoNombre}.</strong>
              Esperando respuesta. Podés cancelarla desde el detalle si querés proponerle a otro.
            </div>
          </div>
        ` : ''}

        <p class="text-sm text-muted mb-4">
          ${interesados.length} persona${interesados.length !== 1 ? 's' : ''} interesada${interesados.length !== 1 ? 's' : ''}.
          Hablá con ellos por chat y cuando llegues a un acuerdo, proponé la confirmación.
        </p>

        ${interesados.map(int => {
          const esElDeLaPropuesta = hayPropuesta &&
            String(confirmacionPendiente.interesadoId) === String(int.id);

          return `
            <div class="solicitud-item" style="align-items:flex-start">
              <img src="${avatarDe(int)}" class="avatar avatar--md" alt="" />
              <div class="solicitud-item__info">
                <div class="solicitud-item__nombre">
                  ${int.nombre || 'Usuario'}
                  ${esElDeLaPropuesta ? '<span class="badge badge--warning" style="margin-left:6px">⏳ Propuesta enviada</span>' : ''}
                </div>
                <div class="solicitud-item__meta">
                  @${int.username || 'usuario'}
                  ${int.ciudad ? ` · 📍 ${int.ciudad}` : ''}
                </div>
                ${int.mensaje ? `
                  <div class="text-xs text-muted mt-2" style="font-style:italic">
                    💬 "${int.mensaje}"
                  </div>
                ` : ''}
              </div>
              <div class="solicitud-item__actions" style="flex-direction:column; align-items:flex-end; gap:6px">
                <button class="btn btn--ghost btn--sm" data-chat-interesado="${int.id}">💬 Chat</button>
                <button class="btn btn--primary btn--sm"
                        data-confirmar-interesado="${int.id}"
                        ${hayPropuesta ? 'disabled title="Ya hay una propuesta pendiente"' : ''}>
                  ✅ Confirmar
                </button>
              </div>
            </div>
          `;
        }).join('')}
      `;

      body.querySelectorAll('[data-chat-interesado]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const otroId = btn.dataset.chatInteresado;
          try {
            const { crearConversacion } = await import('../services/mensajes.service.js');
            const conv = await crearConversacion(otroId);
            cerrarModal('modal-equipos-postulantes');
            window.location.hash = '#/mensajes';
            setTimeout(() => {
              document.querySelector(`[data-conv="${conv.id}"]`)?.click();
            }, 400);
          } catch (err) {
            console.error('[partido-detalle] Error al crear conversación:', err);
            toast(err.message || 'No se pudo abrir el chat', 'error');
          }
        });
      });

      body.querySelectorAll('[data-confirmar-interesado]').forEach(btn => {
        btn.addEventListener('click', () => {
          const intId = btn.dataset.confirmarInteresado;
          const interesado = interesados.find(i => String(i.id) === String(intId));
          if (!interesado) return;
          cerrarModal('modal-equipos-postulantes');
          abrirModalConfirmar(partido, interesado);
        });
      });
    }

    modalPostulantes.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-equipos-postulantes');
    });

    abrirModal('modal-equipos-postulantes');
  }

  /* =========================================================
     MODAL: CONFIRMAR PARTIDO
     ========================================================= */
  function abrirModalConfirmar(partido, interesado) {
    if (!modalConfirmarPartido) return;

    interesadoSeleccionado = interesado;

    document.getElementById('confirmar-titulo').textContent =
      `Confirmar partido con ${interesado.nombre}`;

    document.getElementById('confirmar-fecha').value = '';
    document.getElementById('confirmar-hora').value = '';
    document.getElementById('confirmar-lugar').value = partido.lugar || '';
    document.getElementById('confirmar-precio').value = partido.precio || 0;
    document.getElementById('confirmar-mensaje').value = '';

    const btnConfirmar = document.getElementById('btn-confirmar-partido');
    btnConfirmar.onclick = () => enviarConfirmacion(partido);

    modalConfirmarPartido.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-confirmar-partido');
    });

    abrirModal('modal-confirmar-partido');
  }

  /* =========================================================
     ENVIAR PROPUESTA DE CONFIRMACIÓN
     ========================================================= */
  async function enviarConfirmacion(partido) {
    if (!interesadoSeleccionado) return;

    const fechaVal = document.getElementById('confirmar-fecha').value;
    const horaVal  = document.getElementById('confirmar-hora').value;
    const lugarVal = document.getElementById('confirmar-lugar').value.trim();
    const precioVal = Number(document.getElementById('confirmar-precio').value) || 0;
    const mensajeVal = document.getElementById('confirmar-mensaje').value.trim();

    if (!fechaVal) return toast('Selecciona una fecha', 'error');
    if (!horaVal)  return toast('Selecciona una hora', 'error');
    if (!lugarVal) return toast('Ingresa un lugar', 'error');
    if (precioVal < 0) return toast('El precio no puede ser negativo', 'error');

    const fechaISO = new Date(`${fechaVal}T${horaVal}:00`).toISOString();

    const btn = document.getElementById('btn-confirmar-partido');
    btn.disabled = true;
    btn.textContent = 'Confirmando...';

    try {
      await confirmarPartidoAPI(partido.id, {
        interesadoId: interesadoSeleccionado.id,
        interesadoTipo: 'usuario',
        equipoId: null,
        lugar: lugarVal,
        fecha: fechaISO,
        precio: precioVal,
        mensaje: mensajeVal || null,
      });

      cerrarModal('modal-confirmar-partido');
      toast(`Propuesta enviada a ${interesadoSeleccionado.nombre}. Debe aprobarla.`, 'success');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al confirmar:', err);
      toast(err.message || 'No se pudo confirmar el partido', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '✅ Confirmar partido';
    }
  }

  /* =========================================================
     APROBAR PROPUESTA
     ========================================================= */
  async function aprobarPropuesta(partido) {
    if (!confirmacionPendiente) return;

    if (!confirm('¿Confirmás el partido con estos datos? El partido se cerrará y quedarás inscrito.')) {
      return;
    }

    try {
      await aprobarConfirmacionAPI(partido.id, confirmacionPendiente.id);
      toast('¡Partido confirmado! Ya estás inscrito.', 'success');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al aprobar:', err);
      toast(err.message || 'No se pudo aprobar la propuesta', 'error');
    }
  }

  /* =========================================================
     RECHAZAR PROPUESTA
     ========================================================= */
  async function rechazarPropuesta(partido) {
    if (!confirmacionPendiente) return;

    if (!confirm('¿Rechazar la propuesta? El organizador podrá proponerte otra o elegir a otro.')) {
      return;
    }

    try {
      await rechazarConfirmacionAPI(partido.id, confirmacionPendiente.id);
      toast('Propuesta rechazada', 'info');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al rechazar:', err);
      toast(err.message || 'No se pudo rechazar la propuesta', 'error');
    }
  }

  /* =========================================================
     CANCELAR PROPUESTA (organizador)
     ========================================================= */
  async function cancelarPropuesta(partido) {
    if (!confirmacionPendiente) return;

    if (!confirm('¿Cancelar la propuesta enviada? El interesado ya no podrá verla.')) {
      return;
    }

    try {
      await cancelarConfirmacionAPI(partido.id, confirmacionPendiente.id);
      toast('Propuesta cancelada', 'info');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al cancelar:', err);
      toast(err.message || 'No se pudo cancelar la propuesta', 'error');
    }
  }
    /* =========================================================
     INSCRIBIRSE
     ========================================================= */
  async function inscribirme(partido) {
    if (!user) return;
    try {
      await inscribirseAPI(partido.id);
      toast('¡Te inscribiste en el partido!', 'success');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al inscribirse:', err);
      toast(err.message || 'No se pudo inscribir', 'error');
    }
  }

  /* =========================================================
     SALIR DEL PARTIDO
     ========================================================= */
  async function salirDelPartido(partido) {
    if (!user) return;
    if (!confirm('¿Seguro que querés salir del partido?')) return;
    try {
      const resultado = await salirDelPartidoAPI(partido.id);
      toast(resultado?.mensaje || 'Saliste del partido', 'info');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al salir:', err);
      toast(err.message || 'No se pudo salir del partido', 'error');
    }
  }

  /* =========================================================
     POSTULARME (jugador individual)
     ========================================================= */
  async function postularme(partido) {
    if (!user) return;

    const selectPos = document.getElementById('postular-posicion');
    let posicion = null;
    if (selectPos) {
      posicion = selectPos.value.trim();
      if (!posicion) return toast('Selecciona tu posición', 'error');
    }

    try {
      await postularseAPI(partido.id, posicion);
      toast('Postulación enviada', 'success');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al postularse:', err);
      toast(err.message || 'No se pudo enviar la postulación', 'error');
    }
  }

  /* =========================================================
     CANCELAR POSTULACIÓN (jugador)
     ========================================================= */
  async function cancelarPostulacion(partido) {
    if (!user) return;
    try {
      await cancelarPostulacionAPI(partido.id);
      toast('Postulación cancelada', 'info');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al cancelar postulación:', err);
      toast(err.message || 'No se pudo cancelar', 'error');
    }
  }

  /* =========================================================
     POSTULAR MI EQUIPO
     ========================================================= */
  function abrirModalPostularMiEquipo(partido) {
    const misEqDisponibles = equiposQuePuedoPostular(partido).filter(eq =>
      !miEquipoEstaPostulado(partido, eq.id) &&
      !miEquipoEstaInscrito(partido, eq.id)
    );

    if (misEqDisponibles.length === 0) {
      return toast('No tenés equipos disponibles para postular', 'error');
    }

    if (misEqDisponibles.length === 1) {
      return postularEquipo(partido, misEqDisponibles[0]);
    }

    const opciones = misEqDisponibles.map((eq, i) =>
      `${i + 1}. ${eq.escudo || '🛡️'} ${eq.nombre}`
    ).join('\n');

    const elegido = prompt(`¿Con cuál equipo querés postular?\n\n${opciones}\n\nEscribí el número:`);
    if (!elegido) return;

    const idx = Number(elegido) - 1;
    if (isNaN(idx) || !misEqDisponibles[idx]) {
      return toast('Opción inválida', 'error');
    }

    postularEquipo(partido, misEqDisponibles[idx]);
  }

  async function postularEquipo(partido, equipo) {
    try {
      await postularEquipoAPI(partido.id, String(equipo.id));
      toast(`Postulación enviada con ${equipo.nombre}`, 'success');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al postular equipo:', err);
      toast(err.message || 'No se pudo postular el equipo', 'error');
    }
  }

  /* =========================================================
     CANCELAR POSTULACIÓN DE MI EQUIPO
     ========================================================= */
  async function cancelarPostulacionEquipo(partido) {
    const equipoId = partido.miEquipoPostuladoId;
    if (!equipoId) {
      return toast('No hay postulación pendiente para cancelar', 'error');
    }

    const equipo = misEquipos.find(eq => String(eq.id) === String(equipoId));

    if (!confirm(`¿Cancelar la postulación de "${equipo?.nombre || 'tu equipo'}"?`)) return;

    try {
      await api.delete(`/partidos/${partido.id}/equipos-postulantes/${equipoId}`);
      toast('Postulación cancelada', 'info');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al cancelar:', err);
      toast(err.message || 'No se pudo cancelar', 'error');
    }
  }

  /* =========================================================
     MODAL: EQUIPOS POSTULANTES (organizador)
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

        ${postulantes.map((post) => `
          <div class="solicitud-item" style="align-items:flex-start">
            <div class="avatar avatar--md" style="background:var(--color-primary-light); display:grid; place-items:center; font-size:22px; flex-shrink:0">
              ${post.escudo || '🛡️'}
            </div>
            <div class="solicitud-item__info">
              <div class="solicitud-item__nombre">${post.nombre || 'Equipo'}</div>
              <div class="solicitud-item__meta">
                ${post.deporte ? `🏅 ${post.deporte}` : ''}
                ${post.fecha ? ` · Postuló el ${new Date(post.fecha).toLocaleDateString('es-CL')}` : ''}
              </div>
              ${post.estado !== 'pendiente' ? `
                <span class="badge badge--${post.estado === 'aceptado' ? 'success' : 'danger'}" style="margin-top:4px">
                  ${post.estado === 'aceptado' ? '✅ Aceptado' : '❌ Rechazado'}
                </span>
              ` : ''}
            </div>
            <div class="solicitud-item__actions" style="flex-direction:column; align-items:flex-end">
              ${post.estado === 'pendiente' ? `
                <div class="flex gap-2" style="margin-top:4px">
                  <button class="btn btn--primary btn--sm" data-aceptar-eq="${post.equipoId || post.equipo_id}">Aprobar</button>
                  <button class="btn btn--ghost btn--sm" data-rechazar-eq="${post.equipoId || post.equipo_id}">✕</button>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      `;

      body.querySelectorAll('[data-aceptar-eq]').forEach(btn => {
        btn.addEventListener('click', () => aprobarEquipo(partido, btn.dataset.aceptarEq));
      });

      body.querySelectorAll('[data-rechazar-eq]').forEach(btn => {
        btn.addEventListener('click', () => rechazarEquipo(partido, btn.dataset.rechazarEq));
      });
    }

    modalPostulantes.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-equipos-postulantes');
    });

    abrirModal('modal-equipos-postulantes');
  }

  async function aprobarEquipo(partido, equipoId) {
    try {
      await gestionarEquipoPostulanteAPI(partido.id, equipoId, 'aprobar');
      toast('Equipo aprobado', 'success');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al aprobar equipo:', err);
      toast(err.message || 'No se pudo aprobar el equipo', 'error');
    }
  }

  async function rechazarEquipo(partido, equipoId) {
    try {
      await gestionarEquipoPostulanteAPI(partido.id, equipoId, 'rechazar');
      toast('Equipo rechazado', 'info');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al rechazar equipo:', err);
      toast(err.message || 'No se pudo rechazar el equipo', 'error');
    }
  }

  /* =========================================================
     MODAL: VER EQUIPO
     ========================================================= */
  async function verEquipo(equipoId) {
    let equipo;
    try {
      equipo = await obtenerGrupo(equipoId);
    } catch (err) {
      console.error('[partido-detalle] Error al cargar equipo:', err);
      return toast('Equipo no encontrado', 'error');
    }

    if (!equipo) return toast('Equipo no encontrado', 'error');

    document.getElementById('ver-equipo-titulo').textContent =
      `${equipo.escudo || '🛡️'} ${equipo.nombre}`;

    const jugadores = equipo.miembros || [];

    document.getElementById('ver-equipo-body').innerHTML = `
      <div class="ver-equipo__header">
        <div class="ver-equipo__escudo">${equipo.escudo || '🛡️'}</div>
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
        <p class="text-sm text-muted text-center" style="padding:var(--space-5)">Sin información de jugadores</p>
      ` : `
        <div class="player-list">
          ${jugadores.map(j => {
            const capitan = String(j.id) === String(equipo.capitanId);
            return `
              <div class="player-row">
                <div class="player-row__pos">${j.posicion ? j.posicion.slice(0, 3).toUpperCase() : '—'}</div>
                <img src="${j.avatar || 'assets/icons/usuario.svg'}" class="avatar avatar--md" alt="" data-ver-perfil="${j.id}" style="cursor:pointer" />
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

    document.getElementById('ver-equipo-body').querySelectorAll('[data-ver-perfil]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        import('../components.js').then(({ verPerfilUsuario }) => {
          verPerfilUsuario(el.dataset.verPerfil);
        });
      });
    });

    modalVerEquipo.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-ver-equipo');
    });

    abrirModal('modal-ver-equipo');
  }

  /* =========================================================
     GESTIONAR POSTULANTES (jugadores)
     ========================================================= */
  function abrirGestionPostulantes(partido) {
    const postulantes = partido.postulantes || [];

    if (postulantes.length === 0) {
      return toast('No hay postulantes todavía', 'info');
    }

    const pendientes = postulantes.filter(p => p.estado === 'pendiente');

    if (pendientes.length === 0) {
      return toast('No hay postulantes pendientes', 'info');
    }

    const opciones = pendientes.map((p, i) =>
      `${i + 1}. ${p.nombre} ${p.posicion ? '(' + p.posicion + ')' : ''}`
    ).join('\n');

    const elegido = prompt(`Postulantes pendientes:\n\n${opciones}\n\nEscribí el número para aprobar:`);
    if (!elegido) return;

    const idx = Number(elegido) - 1;
    const post = pendientes[idx];
    if (!post) return toast('Opción inválida', 'error');

    gestionarPostulanteAPI(partido.id, post.id, 'aprobar')
      .then(() => {
        toast('Postulante aprobado', 'success');
        return render();
      })
      .catch(err => {
        console.error('[partido-detalle] Error:', err);
        toast(err.message || 'No se pudo aprobar', 'error');
      });
  }

  /* =========================================================
     MODAL EDITAR PARTIDO
     ========================================================= */
  function abrirModalEditar(partido) {
    if (!modalEditar) return;

    document.getElementById('edit-titulo').value = partido.titulo;
    document.getElementById('edit-descripcion').value = partido.descripcion || '';

    if (!esModoOrganizar(partido) && partido.fecha) {
      const [fecha, horaFull] = partido.fecha.split('T');
      const hora = (horaFull || '00:00').slice(0, 5);
      document.getElementById('edit-fecha').value = fecha;
      document.getElementById('edit-hora').value = hora;
      document.getElementById('edit-lugar').value = partido.lugar || '';
      document.getElementById('edit-cupos').value = partido.cupos;
      const gratis = partido.precio === 0;
      document.getElementById('edit-gratis').checked = gratis;
      document.getElementById('edit-precio').value = gratis ? '5000' : partido.precio;
      document.getElementById('edit-precio-wrapper').classList.toggle('hidden', gratis);
    }

    const inscritosCount = esDeEquipo(partido)
      ? (partido.equiposInscritos || []).length
      : (partido.inscritos || []).length;

    document.getElementById('edit-cupos-hint').textContent =
      `Actualmente hay ${inscritosCount} ${esDeEquipo(partido) ? 'equipos' : 'inscritos'}. No puedes poner menos de ${inscritosCount}.`;

    const checkGratis = document.getElementById('edit-gratis');
    checkGratis.onchange = () => {
      document.getElementById('edit-precio-wrapper').classList.toggle('hidden', checkGratis.checked);
    };

    document.getElementById('btn-guardar-edicion').onclick = () => guardarEdicion(partido);

    modalEditar.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-editar-partido');
    });
    modalEditar.onclick = (e) => {
      if (e.target === modalEditar) cerrarModal('modal-editar-partido');
    };

    abrirModal('modal-editar-partido');
  }

  async function guardarEdicion(partido) {
    const nuevoTitulo = document.getElementById('edit-titulo').value.trim();
    const nuevaDescripcion = document.getElementById('edit-descripcion').value.trim();

    const cambios = {
      titulo: nuevoTitulo,
      descripcion: nuevaDescripcion || null,
    };

    if (!esModoOrganizar(partido)) {
      const nuevaFecha = document.getElementById('edit-fecha').value;
      const nuevaHora  = document.getElementById('edit-hora').value;
      const nuevoLugar = document.getElementById('edit-lugar').value.trim();
      const nuevosCupos = Number(document.getElementById('edit-cupos').value);
      const esGratis = document.getElementById('edit-gratis').checked;
      const nuevoPrecio = esGratis ? 0 : Number(document.getElementById('edit-precio').value);

      if (!nuevaFecha) return toast('Selecciona una fecha', 'error');
      if (!nuevaHora)  return toast('Selecciona una hora', 'error');
      if (!nuevoLugar) return toast('Ingresa un lugar', 'error');

      cambios.lugar = nuevoLugar;
      cambios.fecha = new Date(`${nuevaFecha}T${nuevaHora}:00`).toISOString();
      cambios.cupos = nuevosCupos;
      cambios.precio = nuevoPrecio;
    }

    if (!nuevoTitulo) return toast('El título no puede estar vacío', 'error');

    try {
      await editarPartidoAPI(partido.id, cambios);
      cerrarModal('modal-editar-partido');
      toast('Partido actualizado', 'success');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al editar:', err);
      toast(err.message || 'No se pudo actualizar el partido', 'error');
    }
  }

  /* =========================================================
     INIT
     ========================================================= */
  await render();

  return null;
}