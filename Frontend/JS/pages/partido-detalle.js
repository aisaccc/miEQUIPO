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
  echarInscrito as echarInscritoAPI,
  echarInteresado as echarInteresadoAPI,
  echarEquipoInscrito as echarEquipoInscritoAPI,
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
  function esDeEquipo(p) { return p.tipoPartido === 'equipo'; }
  function esModoOrganizar(p) { return p.estadoPartido === 'buscando_jugadores'; }
  function estaConfirmado(p) { return p.estadoPartido === 'confirmado'; }
  function soyOrganizador(p) { return user && String(p.organizador?.id) === String(user.id); }

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
     RENDER: CARD DE PROPUESTA DE CONFIRMACIÓN
     ========================================================= */
  function renderPropuesta(prop, esOrganizador) {
    const fechaTxt = prop.fecha ? formatearFecha(prop.fecha) : 'A coordinar';
    const lugarTxt = prop.lugar || 'A coordinar';
    const precioTxt = prop.precio === 0 ? 'Gratis' : `$${Number(prop.precio).toLocaleString('es-CL')}`;

    const titulo = esOrganizador
      ? `⏳ Propuesta enviada a ${prop.interesadoNombre}`
      : `⏳ ${prop.organizadorNombre} te propone confirmar este partido`;

    const acciones = esOrganizador
      ? `<button class="btn pd-propuesta__btn pd-propuesta__btn--danger" id="btn-cancelar-propuesta">
           ❌ Cancelar propuesta
         </button>`
      : `<button class="btn pd-propuesta__btn pd-propuesta__btn--primary" id="btn-aprobar-propuesta">
           ✅ Aprobar
         </button>
         <button class="btn pd-propuesta__btn pd-propuesta__btn--danger" id="btn-rechazar-propuesta">
           ❌ Rechazar
         </button>`;

    return `
      <div class="pd-propuesta">
        <div class="pd-propuesta__header">
          <div class="pd-propuesta__titulo">${titulo}</div>
        </div>

        <div class="pd-propuesta__datos">
          <div class="pd-propuesta__dato">
            <span class="pd-propuesta__dato-icon">📅</span>
            <div>
              <div class="pd-propuesta__dato-label">Fecha</div>
              <div class="pd-propuesta__dato-valor">${fechaTxt}</div>
            </div>
          </div>

          <div class="pd-propuesta__dato">
            <span class="pd-propuesta__dato-icon">📍</span>
            <div>
              <div class="pd-propuesta__dato-label">Lugar</div>
              <div class="pd-propuesta__dato-valor">${lugarTxt}</div>
            </div>
          </div>

          <div class="pd-propuesta__dato">
            <span class="pd-propuesta__dato-icon">💰</span>
            <div>
              <div class="pd-propuesta__dato-label">Precio</div>
              <div class="pd-propuesta__dato-valor">${precioTxt}</div>
            </div>
          </div>
        </div>

        ${prop.mensaje ? `
          <div class="pd-propuesta__mensaje">
            💬 "${prop.mensaje}"
          </div>
        ` : ''}

        <div class="pd-propuesta__acciones">
          ${acciones}
        </div>
      </div>
    `;
  }

  /* =========================================================
     RENDER: CARD "ORGANIZADO POR"
     ========================================================= */
  function renderOrganizadoPor(partido) {
    const org = partido.organizador;
    if (!org) return '';

    const iconoChat = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

    return `
      <div class="pd-card pd-organizado">
        <div class="pd-organizado__eyebrow">Organizado por</div>
        <div class="pd-organizado__contenido">
          <img src="${avatarDe(org)}" class="pd-organizado__avatar" alt=""
               data-ver-perfil="${org.id}" style="cursor:pointer" />
          <div class="pd-organizado__info" data-ver-perfil="${org.id}" style="cursor:pointer">
            <div class="pd-organizado__nombre">${org.nombre}</div>
            <div class="pd-organizado__sub">Ver perfil</div>
          </div>
          <button class="pd-organizado__chat" id="btn-chat-organizador" title="Enviar mensaje">
            ${iconoChat}
          </button>
        </div>
      </div>
    `;
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

    const yoEstoyInscrito = !!partido.miInscripcion;
    const yoPostule = partido.miPostulacion || null;
    const yoInteresado = !!partido.yoInteresado;

    confirmacionPendiente = partido.confirmacionPendiente || null;

    const soyOrg = soyOrganizador(partido);
    const soyCapitanDelOrg = miEquipoEsOrganizador(partido);
    const soyAdminOGrupo = soyOrg || soyCapitanDelOrg;

    const totalInscritos = deEquipo ? equiposInscritos.length : inscritos.length;
    const cuposDisponibles = partido.cupos - totalInscritos;

    /* ---------- Cantidad de solicitudes pendientes para el badge ---------- */
    let solicitudesPendientes = 0;

    if (soyAdminOGrupo) {
      if (enModoOrganizar) {
        try {
          const pendientes = await listarInteresadosAPI(partido.id);
          solicitudesPendientes = pendientes?.length || 0;
        } catch (e) {
          solicitudesPendientes = 0;
        }
      } else if (deEquipo) {
        solicitudesPendientes = equiposPostulantes.filter(p => p.estado === 'pendiente').length;
      } else if (partido.aprobacionRequerida) {
        solicitudesPendientes = postulantes.filter(p => p.estado === 'pendiente').length;
      }
    }

    /* ---------- ¿Mostrar botón de solicitudes? ---------- */
    const mostrarBotonSolicitudes =
      soyAdminOGrupo && (
        enModoOrganizar ||
        deEquipo ||
        (!deEquipo && partido.aprobacionRequerida)
      );

    const nivelLabel = {
      amistoso: 'Amistoso',
      semiprofesional: 'Semiprofesional',
      profesional: 'Profesional'
    }[partido.nivel] || partido.nivel;

    const badgeEstado = enModoOrganizar ? 'badge--warning' :
      confirmado ? 'badge--primary' :
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
       BOTÓN DE ACCIÓN (NO-ORGANIZADOR)
       ========================================================= */
    let botonAccion = '';

    if (!user) {
      botonAccion = `<button class="btn pd-hero__action pd-hero__action--primary" disabled>Inicia sesión</button>`;
    } else if (soyAdminOGrupo) {
      botonAccion = '';
    } else if (enModoOrganizar) {
      if (confirmacionPendiente && confirmacionPendiente.esInteresado) {
        botonAccion = '';
      } else if (yoInteresado) {
        botonAccion = `
          <span class="pd-hero__action pd-hero__action--badge">🙋 Ya te interesaste</span>
          <button class="btn pd-hero__action" id="btn-cancelar-interes" style="color:#FCA5A5">
            Cancelar interés
          </button>
        `;
      } else {
        botonAccion = `
          <button class="btn pd-hero__action pd-hero__action--primary" id="btn-interesarme">
            🙋 Me interesa
          </button>
        `;
      }
    } else if (deEquipo) {
      const misEqDeEsteDeporte = equiposQuePuedoPostular(partido);
      if (misEqDeEsteDeporte.length === 0) {
        botonAccion = `<span class="pd-hero__action pd-hero__action--badge">No tenés equipos de ${partido.deporte}</span>`;
      } else {
        const yaInscrito = !!partido.miEquipoInscrito;
        const yaPostulado = !!partido.miEquipoPostulado;
        if (yaInscrito) {
          botonAccion = `<span class="pd-hero__action pd-hero__action--badge">✅ Tu equipo está inscrito</span>`;
        } else if (yaPostulado) {
          botonAccion = `
            <span class="pd-hero__action pd-hero__action--badge">⏳ Postulación pendiente</span>
            <button class="btn pd-hero__action" id="btn-cancelar-postulacion-equipo" style="color:#FCA5A5">Cancelar</button>
          `;
        } else if (partido.estado !== 'abierto' || equiposInscritos.length >= partido.cupos) {
          botonAccion = `<span class="pd-hero__action pd-hero__action--badge">🔒 Partido lleno</span>`;
        } else {
          botonAccion = `<button class="btn pd-hero__action pd-hero__action--primary" id="btn-postular-equipo">📝 Postular mi equipo</button>`;
        }
      }
    } else if (yoEstoyInscrito) {
      botonAccion = `<button class="btn pd-hero__action" id="btn-salir-partido" style="color:#FCA5A5">❌ Salir del partido</button>`;
    } else if (yoPostule && yoPostule.estado === 'pendiente') {
      botonAccion = `
        <span class="pd-hero__action pd-hero__action--badge">⏳ Postulación pendiente</span>
        <button class="btn pd-hero__action" id="btn-cancelar-postulacion" style="color:#FCA5A5">Cancelar</button>
      `;
    } else if (yoPostule && yoPostule.estado === 'rechazado') {
      botonAccion = `<span class="pd-hero__action pd-hero__action--badge">❌ Postulación rechazada</span>`;
    } else if (partido.estado !== 'abierto') {
      botonAccion = `<span class="pd-hero__action pd-hero__action--badge">Partido ${partido.estado}</span>`;
    } else if (partido.aprobacionRequerida) {
      botonAccion = `<button class="btn pd-hero__action pd-hero__action--primary" id="btn-postularme">📝 Postularme</button>`;
    } else {
      botonAccion = `<button class="btn pd-hero__action pd-hero__action--primary" id="btn-inscribirme">✅ Inscribirme</button>`;
    }

    /* =========================================================
       INFO HERO
       ========================================================= */
    const infoFechaHero = enModoOrganizar ? `A coordinar` : formatearFecha(partido.fecha);
    const infoLugarHero = enModoOrganizar ? `A coordinar` : (partido.lugar || 'Sin lugar');

    /* =========================================================
       RENDER
       ========================================================= */
    contenedor.innerHTML = `
      <div class="detalle__top">
        <button class="detalle__back" id="btn-volver">←</button>
        <h2 class="page-title" style="margin:0; font-size:var(--fs-lg)">Detalle del partido</h2>
      </div>

      <div class="pd-hero">
        <div class="pd-hero__left">
          <div class="pd-hero__sport">${renderEmoji(partido.emoji, 48)}</div>
          <div class="pd-hero__info">
            <div class="pd-hero__badges">
              <span class="badge ${badgeEstado}">${badgeTexto}</span>
              <span class="badge badge--info">${deEquipo ? '🛡️ De equipos' : '👤 De jugadores'}</span>
              ${enModoOrganizar ? '<span class="badge badge--primary">📢 Organizar</span>' : ''}
            </div>
            <h1 class="pd-hero__title">${partido.titulo}</h1>
            <div class="pd-hero__meta">
              <span>📅 ${infoFechaHero}</span>
              <span>📍 ${infoLugarHero}</span>
              <span class="pd-hero__organizador" data-ver-perfil="${partido.organizador.id}" style="cursor:pointer">
                👤 ${partido.organizador.nombre}
              </span>
            </div>
            ${confirmacionPendiente ? renderPropuesta(confirmacionPendiente, soyOrg) : ''}
          </div>
        </div>

        <div class="pd-hero__actions">
          ${soyAdminOGrupo ? `
            ${mostrarBotonSolicitudes ? `
              <button class="btn pd-hero__action pd-hero__action--primary" id="btn-ver-solicitudes">
                👥 Solicitudes ${solicitudesPendientes > 0 ? `<span class="badge badge--warning" style="margin-left:6px">${solicitudesPendientes}</span>` : ''}
              </button>
            ` : ''}
            <button class="btn pd-hero__action ${mostrarBotonSolicitudes ? '' : 'pd-hero__action--primary'}" id="btn-editar-partido">
              ✏️ Editar partido
            </button>
            <button class="btn pd-hero__action pd-hero__action--danger" id="btn-eliminar-partido">
              🗑️ Eliminar
            </button>
          ` : botonAccion}
          <button class="btn pd-hero__action" id="btn-compartir">
            🔗 Compartir
          </button>
        </div>
      </div>

      <div class="pd-stats">
        <div class="pd-stat">
          <div class="pd-stat__icon">👥</div>
          <div class="pd-stat__texto">
            <div class="pd-stat__value">${totalInscritos} / ${partido.cupos}</div>
            <div class="pd-stat__label">${deEquipo ? 'Equipos' : 'Jugadores'}</div>
          </div>
        </div>

        <div class="pd-stat">
          <div class="pd-stat__icon">💰</div>
          <div class="pd-stat__texto">
            <div class="pd-stat__value">
              ${enModoOrganizar ? 'A coordinar' : (partido.precio === 0 ? 'Gratis' : '$' + partido.precio.toLocaleString('es-CL'))}
            </div>
            <div class="pd-stat__label">Precio</div>
          </div>
        </div>

        <div class="pd-stat">
          <div class="pd-stat__icon">🏆</div>
          <div class="pd-stat__texto">
            <div class="pd-stat__value">${nivelLabel}</div>
            <div class="pd-stat__label">Nivel</div>
          </div>
        </div>

        <div class="pd-stat">
          <div class="pd-stat__icon">🎯</div>
          <div class="pd-stat__texto">
            <div class="pd-stat__value">${partido.deporte}</div>
            <div class="pd-stat__label">Deporte</div>
          </div>
        </div>
      </div>

      <div class="pd-col-main">
        <div class="pd-card">
          <div class="pd-card__eyebrow">Información</div>
          <h3 class="pd-card__title">Sobre el partido</h3>

          ${partido.descripcion ? `
            <p class="pd-card__description">${partido.descripcion}</p>
          ` : `
            <p class="pd-card__description text-muted">El organizador no dejó descripción.</p>
          `}

          <div class="pd-info-grid">
            <div class="pd-info-item">
              <div class="pd-info-item__icon">📍</div>
              <div>
                <div class="pd-info-item__label">Lugar</div>
                <div class="pd-info-item__value">${enModoOrganizar ? 'A coordinar' : (partido.lugar || '—')}</div>
              </div>
            </div>

            <div class="pd-info-item">
              <div class="pd-info-item__icon">📅</div>
              <div>
                <div class="pd-info-item__label">Fecha</div>
                <div class="pd-info-item__value">${enModoOrganizar ? 'A coordinar' : formatearFecha(partido.fecha)}</div>
              </div>
            </div>

            <div class="pd-info-item">
              <div class="pd-info-item__icon">👤</div>
              <div>
                <div class="pd-info-item__label">Organizador</div>
                <div class="pd-info-item__value">${partido.organizador.nombre}</div>
              </div>
            </div>

            <div class="pd-info-item">
              <div class="pd-info-item__icon">${partido.aprobacionRequerida ? '🔒' : '✅'}</div>
              <div>
                <div class="pd-info-item__label">Confirmación</div>
                <div class="pd-info-item__value">
                  ${partido.aprobacionRequerida ? 'Aprobación requerida' : 'Inscripción directa'}
                </div>
              </div>
            </div>
          </div>
        </div>

        ${renderOrganizadoPor(partido)}

        ${!enModoOrganizar && !deEquipo ? renderJugadoresInscritos(partido, soyOrg, yoEstoyInscrito) : ''}
        ${!enModoOrganizar && deEquipo ? renderEquiposInscritos(partido, soyAdminOGrupo) : ''}
      </div>
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
      <div class="pd-card">
        <div class="pd-card__eyebrow">Plantel</div>
        <h3 class="pd-card__title">Equipos inscritos (${equiposInscritos.length})</h3>
        <div class="pd-jugadores">
          ${equiposInscritos.map(eq => `
            <div class="pd-jugador">
              <div class="pd-jugador__avatar" style="font-size:24px">
                ${eq.escudo || '🛡️'}
              </div>
              <div class="pd-jugador__info">
                <div class="pd-jugador__name">${eq.nombre}</div>
                <div class="pd-jugador__sub">${eq.totalJugadores || 0} jugadores</div>
              </div>
              ${soyAdmin ? `
                <button class="pd-jugador__chevron" data-echar-equipo="${eq.id}"
                        title="Eliminar equipo del partido"
                        style="color:var(--color-danger)">🗑️</button>
              ` : ''}
              <button class="pd-jugador__chevron" data-ver-equipo="${eq.id}">›</button>
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
      <div class="pd-card">
        <div class="pd-card__eyebrow">Plantel</div>
        <h3 class="pd-card__title">
          ${inscritos.length} confirmado${inscritos.length !== 1 ? 's' : ''}
        </h3>

        ${soyOrg ? `
          <div class="pd-jugadores">
            ${inscritos.map(j => {
              const nombre = j.nombre || 'Jugador';
              const avatar = j.avatar || 'assets/icons/usuario.svg';
              const posicion = j.posicion || '';
              const esOrganizador = String(j.id) === String(partido.organizador.id);
              return `
                <div class="pd-jugador">
                  <img src="${avatar}" class="pd-jugador__avatar pd-jugador__avatar--img" alt="" />
                  <div class="pd-jugador__info">
                    <div class="pd-jugador__name">
                      ${nombre}
                      ${esOrganizador ? '<span class="badge badge--primary" style="margin-left:6px">👑</span>' : ''}
                    </div>
                    <div class="pd-jugador__sub">${posicion || 'Sin posición'}</div>
                  </div>
                  ${!esOrganizador ? `
                    <button class="pd-jugador__chevron" data-echar-inscrito="${j.id}"
                            title="Eliminar jugador del partido"
                            style="color:var(--color-danger)">🗑️</button>
                  ` : ''}
                  <button class="pd-jugador__chevron" data-ver-perfil="${j.id}">›</button>
                </div>`;
            }).join('')}
          </div>
        ` : yoEstoyInscrito ? `
          <div class="pd-jugadores">
            <div class="pd-jugador">
              <img src="${user.avatar || 'assets/icons/usuario.svg'}" class="pd-jugador__avatar pd-jugador__avatar--img" alt="" />
              <div class="pd-jugador__info">
                <div class="pd-jugador__name">${user.nombre} (tú)</div>
                <div class="pd-jugador__sub">✅ Estás en la lista</div>
              </div>
            </div>
          </div>
        ` : `
          <div class="pd-empty">
            <div class="pd-empty__icon">🔒</div>
            <p class="pd-empty__text">La lista completa solo la ve el organizador.</p>
            <p class="pd-empty__hint">
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

    document.getElementById('btn-compartir')?.addEventListener('click', async () => {
      const url = window.location.href;
      try {
        if (navigator.share) {
          await navigator.share({ title: partido.titulo, url });
        } else {
          await navigator.clipboard.writeText(url);
          toast('Enlace copiado al portapapeles', 'success');
        }
      } catch (e) {
        try {
          await navigator.clipboard.writeText(url);
          toast('Enlace copiado', 'success');
        } catch {
          toast('No se pudo copiar el enlace', 'error');
        }
      }
    });

    document.getElementById('btn-chat-organizador')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const { crearConversacion } = await import('../services/mensajes.service.js');
        const conv = await crearConversacion(partido.organizador.id);
        window.location.hash = '#/mensajes';
        setTimeout(() => {
          document.querySelector(`[data-conv="${conv.id}"]`)?.click();
        }, 400);
      } catch (err) {
        console.error('[partido-detalle] Error al abrir chat:', err);
        toast(err.message || 'No se pudo abrir el chat', 'error');
      }
    });

    document.querySelectorAll('[data-ver-perfil]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        import('../components.js').then(({ verPerfilUsuario }) => {
          verPerfilUsuario(el.dataset.verPerfil);
        });
      });
    });

    document.querySelectorAll('[data-ver-equipo]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await verEquipo(btn.dataset.verEquipo);
      });
    });

    document.querySelectorAll('[data-echar-inscrito]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const usuarioId = btn.dataset.echarInscrito;
        const jugador = (partido.inscritos || []).find(j => String(j.id) === String(usuarioId));
        const nombre = jugador?.nombre || 'este jugador';
        if (!confirm(`¿Eliminar a ${nombre} del partido? Le va a llegar una notificación.`)) return;
        try {
          const r = await echarInscritoAPI(partido.id, usuarioId);
          toast(r?.mensaje || 'Jugador eliminado', 'info');
          await render();
        } catch (err) {
          console.error('[partido-detalle] Error al echar inscrito:', err);
          toast(err.message || 'No se pudo eliminar al jugador', 'error');
        }
      });
    });

    document.querySelectorAll('[data-echar-equipo]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const equipoId = btn.dataset.echarEquipo;
        const equipo = (partido.equiposInscritos || []).find(eq => String(eq.id) === String(equipoId));
        const nombre = equipo?.nombre || 'este equipo';
        if (!confirm(`¿Eliminar a "${nombre}" del partido? El capitán y admins van a recibir una notificación.`)) return;
        try {
          const r = await echarEquipoInscritoAPI(partido.id, equipoId);
          toast(r?.mensaje || 'Equipo eliminado', 'info');
          await render();
        } catch (err) {
          console.error('[partido-detalle] Error al echar equipo:', err);
          toast(err.message || 'No se pudo eliminar al equipo', 'error');
        }
      });
    });

    /* ---------- BOTÓN ÚNICO DE SOLICITUDES ---------- */
    document.getElementById('btn-ver-solicitudes')?.addEventListener('click', () => abrirModalSolicitudes(partido));

    /* ---------- BOTONES MODO ORGANIZAR ---------- */
    document.getElementById('btn-interesarme')?.addEventListener('click', () => interesarse(partido));
    document.getElementById('btn-cancelar-interes')?.addEventListener('click', () => cancelarInteres(partido));
    document.getElementById('btn-aprobar-propuesta')?.addEventListener('click', () => aprobarPropuesta(partido));
    document.getElementById('btn-rechazar-propuesta')?.addEventListener('click', () => rechazarPropuesta(partido));
    document.getElementById('btn-cancelar-propuesta')?.addEventListener('click', () => cancelarPropuesta(partido));

    /* ---------- BOTONES ORGANIZADOR ---------- */
    document.getElementById('btn-editar-partido')?.addEventListener('click', () => abrirModalEditar(partido));

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

    /* ---------- BOTONES JUGADOR ---------- */
    document.getElementById('btn-inscribirme')?.addEventListener('click', () => inscribirme(partido));
    document.getElementById('btn-salir-partido')?.addEventListener('click', () => salirDelPartido(partido));
    document.getElementById('btn-postularme')?.addEventListener('click', () => postularme(partido));
    document.getElementById('btn-cancelar-postulacion')?.addEventListener('click', () => cancelarPostulacion(partido));
    document.getElementById('btn-postular-equipo')?.addEventListener('click', () => abrirModalPostularMiEquipo(partido));
    document.getElementById('btn-cancelar-postulacion-equipo')?.addEventListener('click', () => cancelarPostulacionEquipo(partido));

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
     MODAL ÚNICO: SOLICITUDES
     ========================================================= */
  async function abrirModalSolicitudes(partido) {
    const deEquipo = esDeEquipo(partido);
    const enModoOrganizar = esModoOrganizar(partido);

    if (enModoOrganizar) return abrirModalInteresados(partido);
    if (deEquipo) return abrirModalEquiposPostulantes(partido);
    if (partido.aprobacionRequerida) return abrirModalPostulantesJugadores(partido);

    toast('Este partido no tiene solicitudes pendientes', 'info');
  }

  /* =========================================================
     MODAL: INTERESADOS (modo Organizar)
     ========================================================= */
  async function abrirModalInteresados(partido) {
    const body = document.getElementById('equipos-postulantes-body');
    if (!body) return;

    document.querySelector('#modal-equipos-postulantes .modal__title').textContent = 'Interesados';

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
        </div>`;
    } else {
      body.innerHTML = `
        ${hayPropuesta ? `
          <div class="aviso-aprobacion show mb-4">
            <span class="aviso-aprobacion__icon">⏳</span>
            <div>
              <strong>Ya hay una propuesta enviada a ${confirmacionPendiente.interesadoNombre}.</strong>
            </div>
          </div>
        ` : ''}

        ${interesados.map(int => {
          const esElDeLaPropuesta = hayPropuesta &&
            String(confirmacionPendiente.interesadoId) === String(int.id);

          return `
            <div class="solicitud-item" style="align-items:flex-start">
              <img src="${avatarDe(int)}" class="avatar avatar--md" alt="" />
              <div class="solicitud-item__info">
                <div class="solicitud-item__nombre">
                  ${int.nombre || 'Usuario'}
                  ${esElDeLaPropuesta ? '<span class="badge badge--warning" style="margin-left:6px">⏳ Propuesta</span>' : ''}
                </div>
                <div class="solicitud-item__meta">@${int.username || 'usuario'}</div>
              </div>
              <div class="solicitud-item__actions" style="flex-direction:column; align-items:flex-end; gap:6px">
                <button class="btn btn--ghost btn--sm" data-chat-interesado="${int.id}">💬 Chat</button>
                <button class="btn btn--primary btn--sm"
                        data-confirmar-interesado="${int.id}"
                        ${hayPropuesta ? 'disabled' : ''}>
                  ✅ Confirmar
                </button>
                <button class="btn btn--ghost btn--sm"
                        data-borrar-interesado="${int.id}"
                        style="color:var(--color-danger)">
                  🗑️ Borrar
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

      body.querySelectorAll('[data-borrar-interesado]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const intId = btn.dataset.borrarInteresado;
          const interesado = interesados.find(i => String(i.id) === String(intId));
          const nombre = interesado?.nombre || 'este interesado';
          if (!confirm(`¿Borrar a ${nombre} de la lista de interesados? Le va a llegar una notificación.`)) return;

          try {
            const r = await echarInteresadoAPI(partido.id, intId);
            toast(r?.mensaje || 'Interesado eliminado', 'info');
            cerrarModal('modal-equipos-postulantes');
            await render();
          } catch (err) {
            console.error('[partido-detalle] Error al borrar interesado:', err);
            toast(err.message || 'No se pudo borrar al interesado', 'error');
          }
        });
      });
    }

    modalPostulantes.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-equipos-postulantes');
    });

    abrirModal('modal-equipos-postulantes');
  }

  /* =========================================================
     MODAL: POSTULANTES JUGADORES
     ========================================================= */
  function abrirModalPostulantesJugadores(partido) {
    const body = document.getElementById('equipos-postulantes-body');
    if (!body) return;

    document.querySelector('#modal-equipos-postulantes .modal__title').textContent = 'Postulantes';

    const postulantes = partido.postulantes || [];
    const pendientes = postulantes.filter(p => p.estado === 'pendiente');

    if (postulantes.length === 0) {
      body.innerHTML = `
        <div class="empty-state--sm">
          <div class="empty-state__icon">📝</div>
          <p>Aún no hay postulantes</p>
        </div>`;
    } else {
      body.innerHTML = `
        <p class="text-sm text-muted mb-4">${pendientes.length} postulante(s) esperando aprobación</p>

        ${postulantes.map(post => `
          <div class="solicitud-item" style="align-items:flex-start">
            <img src="${avatarDe(post)}" class="avatar avatar--md" alt="" />
            <div class="solicitud-item__info">
              <div class="solicitud-item__nombre">${post.nombre || 'Jugador'}</div>
              <div class="solicitud-item__meta">
                @${post.username || 'usuario'}
                ${post.posicion ? ` · ${post.posicion}` : ''}
              </div>
            </div>
            <div class="solicitud-item__actions" style="flex-direction:column; align-items:flex-end; gap:6px">
              ${post.estado === 'pendiente' ? `
                <div class="flex gap-2">
                  <button class="btn btn--primary btn--sm" data-aprobar-post="${post.id}">Aprobar</button>
                  <button class="btn btn--ghost btn--sm" data-rechazar-post="${post.id}" style="color:var(--color-danger)">🗑️ Borrar</button>
                </div>
              ` : `<span class="badge badge--${post.estado === 'aprobado' ? 'success' : 'danger'}">${post.estado}</span>`}
            </div>
          </div>
        `).join('')}
      `;

      body.querySelectorAll('[data-aprobar-post]').forEach(btn => {
        btn.addEventListener('click', () => aprobarPostulante(partido, btn.dataset.aprobarPost));
      });
      body.querySelectorAll('[data-rechazar-post]').forEach(btn => {
        btn.addEventListener('click', () => rechazarPostulante(partido, btn.dataset.rechazarPost));
      });
    }

    modalPostulantes.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-equipos-postulantes');
    });

    abrirModal('modal-equipos-postulantes');
  }

  async function aprobarPostulante(partido, postulanteId) {
    try {
      await gestionarPostulanteAPI(partido.id, postulanteId, 'aprobar');
      toast('Postulante aprobado', 'success');
      cerrarModal('modal-equipos-postulantes');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al aprobar postulante:', err);
      toast(err.message || 'No se pudo aprobar', 'error');
    }
  }

  async function rechazarPostulante(partido, postulanteId) {
    const post = (partido.postulantes || []).find(p => String(p.id) === String(postulanteId));
    const nombre = post?.nombre || 'este postulante';
    if (!confirm(`¿Borrar la postulación de ${nombre}? Le va a llegar una notificación.`)) return;
    try {
      await gestionarPostulanteAPI(partido.id, postulanteId, 'rechazar');
      toast('Postulación borrada', 'info');
      cerrarModal('modal-equipos-postulantes');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al rechazar postulante:', err);
      toast(err.message || 'No se pudo borrar la postulación', 'error');
    }
  }

  /* =========================================================
     MODAL: EQUIPOS POSTULANTES
     ========================================================= */
  function abrirModalEquiposPostulantes(partido) {
    const body = document.getElementById('equipos-postulantes-body');
    if (!body) return;

    document.querySelector('#modal-equipos-postulantes .modal__title').textContent = 'Equipos postulantes';

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
        <p class="text-sm text-muted mb-4">${pendientes.length} equipo(s) esperando aprobación</p>

        ${postulantes.map((post) => `
          <div class="solicitud-item" style="align-items:flex-start">
            <div class="avatar avatar--md" style="background:var(--color-primary-light); display:grid; place-items:center; font-size:22px; flex-shrink:0">
              ${post.escudo || '🛡️'}
            </div>
            <div class="solicitud-item__info">
              <div class="solicitud-item__nombre">${post.nombre || 'Equipo'}</div>
              <div class="solicitud-item__meta">${post.deporte ? `🏅 ${post.deporte}` : ''}</div>
            </div>
            <div class="solicitud-item__actions" style="flex-direction:column; align-items:flex-end">
              ${post.estado === 'pendiente' ? `
                <div class="flex gap-2">
                  <button class="btn btn--primary btn--sm" data-aceptar-eq="${post.equipoId || post.equipo_id}">Aprobar</button>
                  <button class="btn btn--ghost btn--sm" data-rechazar-eq="${post.equipoId || post.equipo_id}" style="color:var(--color-danger)">🗑️ Borrar</button>
                </div>
              ` : `<span class="badge badge--${post.estado === 'aceptado' ? 'success' : 'danger'}">${post.estado}</span>`}
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
      cerrarModal('modal-equipos-postulantes');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al aprobar equipo:', err);
      toast(err.message || 'No se pudo aprobar', 'error');
    }
  }

  async function rechazarEquipo(partido, equipoId) {
    const eq = (partido.equiposPostulantes || []).find(e => String(e.equipoId || e.equipo_id) === String(equipoId));
    const nombre = eq?.nombre || 'este equipo';
    if (!confirm(`¿Borrar la postulación de "${nombre}"? El capitán y admins van a recibir una notificación.`)) return;
    try {
      await gestionarEquipoPostulanteAPI(partido.id, equipoId, 'rechazar');
      toast('Postulación borrada', 'info');
      cerrarModal('modal-equipos-postulantes');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al rechazar equipo:', err);
      toast(err.message || 'No se pudo borrar la postulación', 'error');
    }
  }

  /* =========================================================
     MODAL: CONFIRMAR
     ========================================================= */
  function abrirModalConfirmar(partido, interesado) {
    if (!modalConfirmarPartido) return;
    interesadoSeleccionado = interesado;

    document.getElementById('confirmar-titulo').textContent = `Confirmar partido con ${interesado.nombre}`;
    document.getElementById('confirmar-fecha').value = '';
    document.getElementById('confirmar-hora').value = '';
    document.getElementById('confirmar-lugar').value = partido.lugar || '';
    document.getElementById('confirmar-precio').value = partido.precio || 0;
    document.getElementById('confirmar-mensaje').value = '';

    document.getElementById('btn-confirmar-partido').onclick = () => enviarConfirmacion(partido);

    modalConfirmarPartido.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-confirmar-partido');
    });

    abrirModal('modal-confirmar-partido');
  }

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
      toast(`Propuesta enviada a ${interesadoSeleccionado.nombre}.`, 'success');
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
     INTERESARSE / CANCELAR
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
     APROBAR / RECHAZAR / CANCELAR PROPUESTA
     ========================================================= */
  async function aprobarPropuesta(partido) {
    if (!confirmacionPendiente) return;
    if (!confirm('¿Confirmás el partido?')) return;
    try {
      await aprobarConfirmacionAPI(partido.id, confirmacionPendiente.id);
      toast('¡Partido confirmado!', 'success');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al aprobar:', err);
      toast(err.message || 'No se pudo aprobar', 'error');
    }
  }

  async function rechazarPropuesta(partido) {
    if (!confirmacionPendiente) return;
    if (!confirm('¿Rechazar la propuesta?')) return;
    try {
      await rechazarConfirmacionAPI(partido.id, confirmacionPendiente.id);
      toast('Propuesta rechazada', 'info');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al rechazar:', err);
      toast(err.message || 'No se pudo rechazar', 'error');
    }
  }

  async function cancelarPropuesta(partido) {
    if (!confirmacionPendiente) return;
    if (!confirm('¿Cancelar la propuesta enviada?')) return;
    try {
      await cancelarConfirmacionAPI(partido.id, confirmacionPendiente.id);
      toast('Propuesta cancelada', 'info');
      await render();
    } catch (err) {
      console.error('[partido-detalle] Error al cancelar:', err);
      toast(err.message || 'No se pudo cancelar', 'error');
    }
  }

  /* =========================================================
     INSCRIBIRME / SALIR / POSTULARME
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

  async function cancelarPostulacionEquipo(partido) {
    const equipoId = partido.miEquipoPostuladoId;
    if (!equipoId) return toast('No hay postulación pendiente', 'error');
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
     VER EQUIPO
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

    document.getElementById('ver-equipo-titulo').textContent = `${equipo.escudo || '🛡️'} ${equipo.nombre}`;

    const jugadores = equipo.miembros || [];

    document.getElementById('ver-equipo-body').innerHTML = `
      <div class="ver-equipo__header">
        <div class="ver-equipo__escudo">${equipo.escudo || '🛡️'}</div>
        <div>
          <div class="ver-equipo__nombre">${equipo.nombre}</div>
          <div class="ver-equipo__meta">${equipo.deporte}${equipo.ciudad ? ' · ' + equipo.ciudad : ''}</div>
        </div>
      </div>
      <div class="detalle__seccion-titulo mb-4">👥 Plantilla (${jugadores.length} jugadores)</div>
      ${jugadores.length === 0 ? `
        <p class="text-sm text-muted text-center">Sin información de jugadores</p>
      ` : `
        <div class="player-list">
          ${jugadores.map(j => `
            <div class="player-row">
              <div class="player-row__pos">${j.posicion ? j.posicion.slice(0, 3).toUpperCase() : '—'}</div>
              <img src="${j.avatar || 'assets/icons/usuario.svg'}" class="avatar avatar--md" alt="" data-ver-perfil="${j.id}" style="cursor:pointer" />
              <div style="flex:1; min-width:0">
                <div class="feed-item__title">${j.nombre}</div>
                <div class="feed-item__subtitle">${j.posicion || 'Sin posición'}</div>
              </div>
            </div>
          `).join('')}
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
     MODAL EDITAR
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
      `Actualmente hay ${inscritosCount} ${esDeEquipo(partido) ? 'equipos' : 'inscritos'}.`;

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

    const cambios = { titulo: nuevoTitulo, descripcion: nuevaDescripcion || null };

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

  /* ---------- AUTO-ABRIR MODAL DE EDICIÓN ---------- */
  const partidoAEditar = sessionStorage.getItem('partidoAEditar');
  if (partidoAEditar && String(partidoAEditar) === String(id) && soyOrganizador(partido)) {
    sessionStorage.removeItem('partidoAEditar');
    setTimeout(() => abrirModalEditar(partido), 300);
  }

  return null;
}