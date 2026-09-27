import { getPartidoPorId, guardarPartido, agregarNotificacion } from '../store.js';
import { getSesion } from '../auth.js';
import { formatearFecha, toast } from '../components.js';

export async function init(params = {}) {
  const id = params.id;
  const user = getSesion();
  const contenedor = document.getElementById('detalle-partido');
  if (!contenedor || !id) return null;

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
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.hash = '#/partidos';
          }
        });
      return;
    }

    const inscritos = partido.inscritos || [];
    const postulantes = partido.postulantes || [];
    const yoEstoyInscrito = user && inscritos.includes(user.id);
    const yoPostule = user && postulantes.find(p => p.userId === user.id);
    const soyOrganizador = user && partido.organizador.id === user.id;
    const cuposDisponibles = partido.cupos - inscritos.length;

    const nivelLabel = {
      amistoso: 'Amistoso',
      semiprofesional: 'Semiprofesional',
      profesional: 'Profesional'
    }[partido.nivel] || partido.nivel;
    const badgeEstado = {
      abierto: 'badge--success', lleno: 'badge--danger', finalizado: 'badge--neutral'
    }[partido.estado] || 'badge--neutral';

    /* ============ BOTÓN DE ACCIÓN ============ */
    let botonAccion = '';

    if (!user) {
      botonAccion = `<button class="btn btn--primary" disabled>Inicia sesión para participar</button>`;
    } else if (soyOrganizador) {
      botonAccion = `
        <button class="btn btn--primary" id="btn-gestionar-postulantes">
          👥 Postulantes (${postulantes.filter(p => p.estado === 'pendiente').length})
        </button>
        <button class="btn btn--ghost" id="btn-editar-partido">✏️ Editar partido</button>
        <button class="btn btn--ghost" id="btn-eliminar-partido" style="color:var(--color-danger)">🗑️ Eliminar</button>
      `;
    } else if (yoEstoyInscrito) {
      botonAccion = `
        <button class="btn btn--ghost" id="btn-salir-partido" style="color:var(--color-danger)">❌ Salir del partido</button>
      `;
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

    /* ============ RENDER ============ */
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
          <span data-autor-id="${partido.organizador.id}" style="cursor:pointer">👤 ${partido.organizador.nombre}</span>        
        </div>
        <div class="detalle__badges">
          <span class="badge ${badgeEstado}">${partido.estado.charAt(0).toUpperCase() + partido.estado.slice(1)}</span>
          <span class="nivel-badge nivel-badge--${partido.nivel}">${nivelLabel}</span>
          ${partido.precio === 0
            ? `<span class="match-card__precio match-card__precio--gratis">🎉 Gratis</span>`
            : `<span class="match-card__precio match-card__precio--pago">💰 $${partido.precio.toLocaleString('es-CL')}</span>`}
          ${partido.aprobacionRequerida
            ? `<span class="badge badge--warning">🔒 Con aprobación</span>` : ''}
        </div>
      </div>

      <div class="detalle__info">
        <div class="detalle__info-item">
          <div class="detalle__info-label">Cupos</div>
          <div class="detalle__info-value">${inscritos.length} / ${partido.cupos}</div>
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

      ${inscritos.length > 0 ? `
        <div class="card mb-4">
          <div class="detalle__seccion-titulo">✅ Inscritos (${inscritos.length})</div>

          ${soyOrganizador ? `
            <!-- Organizador: ve la lista completa -->
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
            <!-- Estás inscrito pero no eres organizador: solo ves tu nombre -->
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
            <!-- Visitante: mensaje informativo -->
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
      ` : ''}

      ${soyOrganizador && postulantes.length > 0 ? `
        <div class="card mb-4">
          <div class="detalle__seccion-titulo">📥 Postulantes (${postulantes.length})</div>
          <div class="detalle__lista">
            ${postulantes.map(p => `
              <div class="jugador-item">
                <img src="${p.avatar}" class="avatar avatar--md" alt="" />
                <div class="jugador-item__info">
                  <div class="jugador-item__nombre">${p.nombre}</div>
                  ${p.posicion ? `<div class="jugador-item__sub">${p.posicion}</div>` : ''}
                </div>
                <span class="estado-postulante estado-postulante--${p.estado}">
                  ${p.estado.charAt(0).toUpperCase() + p.estado.slice(1)}
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    conectarEventos(partido);
  }

  /* =========================================================
     EVENTOS
     ========================================================= */
  function conectarEventos(partido) {
        document.querySelector('[data-autor-id]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      import('../components.js').then(({ verPerfilUsuario }) => {
        verPerfilUsuario(Number(e.currentTarget.dataset.autorId));
      });
    });

    /* ---------- INSCRIBIRSE ---------- */
    document.getElementById('btn-inscribirme')?.addEventListener('click', () => {
      if (!user) return;
      const inscritos = partido.inscritos || [];
      if (inscritos.length >= partido.cupos) return toast('No hay cupos disponibles', 'error');
      if (inscritos.includes(user.id)) return;

      partido.inscritos = [...inscritos, user.id];
      if (partido.inscritos.length >= partido.cupos) partido.estado = 'lleno';
      guardarPartido(partido);

      // Notif al organizador
      agregarNotificacion({
        para: partido.organizador.id,
        tipo: 'inscripcion',
        mensaje: `${user.nombre} se inscribió en "${partido.titulo}"`,
        link: `#/partido/${partido.id}`
      });

      toast('¡Te inscribiste en el partido!', 'success');
      render();
    });

    /* ---------- SALIR DEL PARTIDO ---------- */
    document.getElementById('btn-salir-partido')?.addEventListener('click', () => {
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
    });

    /* ---------- POSTULARSE ---------- */
    document.getElementById('btn-postularme')?.addEventListener('click', () => {
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
    });

    /* ---------- CANCELAR POSTULACIÓN ---------- */
    document.getElementById('btn-cancelar-postulacion')?.addEventListener('click', () => {
      if (!user) return;
      partido.postulantes = (partido.postulantes || []).filter(p => p.userId !== user.id);
      guardarPartido(partido);
      toast('Postulación cancelada', 'info');
      render();
    });

    /* ---------- GESTIONAR POSTULANTES ---------- */
    document.getElementById('btn-gestionar-postulantes')?.addEventListener('click', () => {
      abrirGestionPostulantes(partido);
    });

    /* ---------- EDITAR PARTIDO ---------- */
    document.getElementById('btn-editar-partido')?.addEventListener('click', () => {
      abrirModalEditar(partido);
    });

    /* ---------- ELIMINAR PARTIDO ---------- */
    document.getElementById('btn-eliminar-partido')?.addEventListener('click', () => {
      if (!confirm('¿Eliminar este partido? Se notificará a todos los inscritos.')) return;
      // Notificar a los inscritos
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
  }

  /* =========================================================
     MODAL GESTIONAR POSTULANTES
     ========================================================= */
  function abrirGestionPostulantes(partido) {
    const body = document.getElementById('postulantes-body');
    if (!body) return;

    const postulantes = partido.postulantes || [];
    if (postulantes.length === 0) {
      body.innerHTML = `<p class="text-muted text-center">Aún no hay postulantes.</p>`;
    } else {
      body.innerHTML = postulantes.map(p => `
        <div class="jugador-item mb-4">
          <img src="${p.avatar}" class="avatar avatar--md" alt="" />
          <div class="jugador-item__info">
            <div class="jugador-item__nombre">${p.nombre}</div>
            ${p.posicion ? `<div class="jugador-item__sub">Posición: ${p.posicion}</div>` : ''}
          </div>
          ${p.estado === 'pendiente' ? `
            <button class="btn btn--primary btn--sm" data-aprobar="${p.userId}">Aprobar</button>
            <button class="btn btn--ghost btn--sm" data-rechazar="${p.userId}">Rechazar</button>
          ` : `
            <span class="estado-postulante estado-postulante--${p.estado}">
              ${p.estado.charAt(0).toUpperCase() + p.estado.slice(1)}
            </span>
          `}
        </div>
      `).join('');
    }

    // Conectar botones
    body.querySelectorAll('[data-aprobar]').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = Number(btn.dataset.aprobar);
        aprobarPostulante(partido, uid);
      });
    });
    body.querySelectorAll('[data-rechazar]').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = Number(btn.dataset.rechazar);
        rechazarPostulante(partido, uid);
      });
    });

    import('../components.js').then(({ abrirModal }) => {
      abrirModal('modal-postulantes');
    });
  }

  function aprobarPostulante(partido, userId) {
    const postulante = (partido.postulantes || []).find(p => p.userId === userId);
    if (!postulante) return;

    const inscritos = partido.inscritos || [];
    if (inscritos.length >= partido.cupos) {
      return toast('No quedan cupos', 'error');
    }

    // Aprobar
    postulante.estado = 'aprobado';
    partido.inscritos = [...inscritos, userId];

    // ¿Se llenó?
    if (partido.inscritos.length >= partido.cupos) {
      partido.estado = 'lleno';
      // Avisar a todos los demás postulantes pendientes
      (partido.postulantes || []).forEach(p => {
        if (p.estado === 'pendiente') {
          p.estado = 'rechazado';
          agregarNotificacion({
            para: p.userId,
            tipo: 'cierre',
            mensaje: `El partido "${partido.titulo}" se llenó. No pudiste entrar.`,
            link: `#/partido/${partido.id}`
          });
        }
      });
    }

    guardarPartido(partido);

    agregarNotificacion({
      para: userId,
      tipo: 'aprobado',
      mensaje: `¡Estás dentro de "${partido.titulo}"!`,
      link: `#/partido/${partido.id}`
    });

    toast('Postulante aprobado', 'success');

    // Reabrir el modal con datos actualizados
    abrirGestionPostulantes(partido);
    render();
  }

  function rechazarPostulante(partido, userId) {
    const postulante = (partido.postulantes || []).find(p => p.userId === userId);
    if (!postulante) return;
    postulante.estado = 'rechazado';
    guardarPartido(partido);

    agregarNotificacion({
      para: userId,
      tipo: 'rechazado',
      mensaje: `Tu postulación a "${partido.titulo}" fue rechazada`,
      link: `#/partido/${partido.id}`
    });

    toast('Postulante rechazado', 'info');
    abrirGestionPostulantes(partido);
    render();
  }

  /* =========================================================
     MODAL EDITAR PARTIDO (simple, sin HTML extra)
     ========================================================= */
    /* =========================================================
     MODAL EDITAR PARTIDO
     ========================================================= */
  function abrirModalEditar(partido) {
    const modal = document.getElementById('modal-editar-partido');
    if (!modal) return;

    // Precargar campos
    const [fecha, horaFull] = partido.fecha.split('T');
    const hora = (horaFull || '00:00').slice(0, 5);

    document.getElementById('edit-titulo').value = partido.titulo;
    document.getElementById('edit-fecha').value = fecha;
    document.getElementById('edit-hora').value = hora;
    document.getElementById('edit-lugar').value = partido.lugar;
    document.getElementById('edit-cupos').value = partido.cupos;
    document.getElementById('edit-descripcion').value = partido.descripcion || '';

    // Gratis / precio
    const gratis = partido.precio === 0;
    document.getElementById('edit-gratis').checked = gratis;
    document.getElementById('edit-precio').value = gratis ? '5000' : partido.precio;
    document.getElementById('edit-precio-wrapper').classList.toggle('hidden', gratis);

    // Hint de cupos: no puede bajar por debajo de inscritos actuales
    const inscritosCount = (partido.inscritos || []).length;
    document.getElementById('edit-cupos-hint').textContent =
      `Actualmente hay ${inscritosCount} inscritos. No puedes poner menos de ${inscritosCount}.`;

    // Conectar toggle gratis/precio (una sola vez por click)
    const checkGratis = document.getElementById('edit-gratis');
    checkGratis.onchange = () => {
      document.getElementById('edit-precio-wrapper')
        .classList.toggle('hidden', checkGratis.checked);
    };

    // Conectar botón guardar
    const btnGuardar = document.getElementById('btn-guardar-edicion');
    btnGuardar.onclick = () => guardarEdicion(partido);

    // Conectar cerrar
    modal.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => modal.classList.remove('open');
    });

    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove('open');
    };

    // Abrir
    modal.classList.add('open');
  }

  /* =========================================================
     GUARDAR EDICIÓN + NOTIFICAR INSCRITOS
     ========================================================= */
  function guardarEdicion(partido) {
    const nuevoTitulo      = document.getElementById('edit-titulo').value.trim();
    const nuevaFecha       = document.getElementById('edit-fecha').value;
    const nuevaHora        = document.getElementById('edit-hora').value;
    const nuevoLugar       = document.getElementById('edit-lugar').value.trim();
    const nuevosCupos      = Number(document.getElementById('edit-cupos').value);
    const esGratis         = document.getElementById('edit-gratis').checked;
    const nuevoPrecio      = esGratis ? 0 : Number(document.getElementById('edit-precio').value);
    const nuevaDescripcion = document.getElementById('edit-descripcion').value.trim();

    const inscritosCount = (partido.inscritos || []).length;

    /* ---------- VALIDACIONES ---------- */
    if (!nuevoTitulo)  return toast('El título no puede estar vacío', 'error');
    if (!nuevaFecha)   return toast('Selecciona una fecha', 'error');
    if (!nuevaHora)    return toast('Selecciona una hora', 'error');
    if (!nuevoLugar)   return toast('Ingresa un lugar', 'error');
    if (nuevosCupos < inscritosCount) {
      return toast(`No puedes bajar de ${inscritosCount} cupos (ya hay ${inscritosCount} inscritos)`, 'error');
    }
    if (!esGratis && nuevoPrecio < 0) {
      return toast('El precio no puede ser negativo', 'error');
    }

    /* ---------- DETECTAR CAMBIOS ---------- */
    const fechaHoraOriginal = partido.fecha;
    const fechaHoraNueva    = `${nuevaFecha}T${nuevaHora}:00`;

    const cambios = [];
    if (nuevoTitulo !== partido.titulo)                    cambios.push('título');
    if (fechaHoraNueva !== fechaHoraOriginal)              cambios.push('fecha/hora');
    if (nuevoLugar !== partido.lugar)                      cambios.push('lugar');
    if (nuevosCupos !== partido.cupos)                     cambios.push('cupos');
    if (nuevoPrecio !== partido.precio)                    cambios.push('precio');
    if (nuevaDescripcion !== (partido.descripcion || ''))  cambios.push('descripción');

    if (cambios.length === 0) {
      toast('No hay cambios que guardar', 'info');
      document.getElementById('modal-editar-partido').classList.remove('open');
      return;
    }

    /* ---------- APLICAR CAMBIOS ---------- */
    partido.titulo      = nuevoTitulo;
    partido.fecha       = fechaHoraNueva;
    partido.lugar       = nuevoLugar;
    partido.cupos       = nuevosCupos;
    partido.precio      = nuevoPrecio;
    partido.descripcion = nuevaDescripcion;

    // Si subió los cupos y estaba lleno, reabrir
    if (partido.estado === 'lleno' && partido.inscritos.length < partido.cupos) {
      partido.estado = 'abierto';
    }

    guardarPartido(partido);

    /* ---------- NOTIFICAR A LOS INSCRITOS ---------- */
    const listaCambios = cambios.join(', ');
    (partido.inscritos || []).forEach(uid => {
      if (uid === partido.organizador.id) return;   // no notificar al que editó
      agregarNotificacion({
        para: uid,
        tipo: 'edicion',
        mensaje: `"${partido.titulo}" fue modificado (${listaCambios})`,
        link: `#/partido/${partido.id}`
      });
    });

    /* ---------- NOTIFICAR A LOS POSTULANTES PENDIENTES ---------- */
    (partido.postulantes || []).forEach(p => {
      if (p.estado !== 'pendiente') return;
      agregarNotificacion({
        para: p.userId,
        tipo: 'edicion',
        mensaje: `"${partido.titulo}" fue modificado (${listaCambios})`,
        link: `#/partido/${partido.id}`
      });
    });

    document.getElementById('modal-editar-partido').classList.remove('open');
    toast(`Partido actualizado (${listaCambios})`, 'success');
    render();
  }
  /* ---------- RENDER INICIAL ---------- */
  render();

  return null;
}