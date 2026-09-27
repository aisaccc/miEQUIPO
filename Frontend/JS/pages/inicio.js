import { mockPublicaciones } from '../data-mock.js';
import { getSesion } from '../auth.js';
import { toast, abrirModal, cerrarModal } from '../components.js';
import {
  inicializarPublicaciones,
  guardarPublicaciones,
  agregarPublicacion,
  actualizarPublicacion
} from '../store.js';
export async function init() {
  /* ---------- ESTADO LOCAL ---------- */
  let publicaciones = inicializarPublicaciones(mockPublicaciones);
  let filtroActual = 'todo';

  const user = getSesion();
  const feed = document.getElementById('feed');
  const modal = document.getElementById('modal-crear-post');

  if (!feed) return null;

  /* ---------- AVATAR DEL COMPOSER ---------- */
  const composerAvatar = document.getElementById('composer-avatar');
  if (composerAvatar && user) composerAvatar.src = user.avatar;

  /* =========================================================
     RENDER DEL FEED
     ========================================================= */
  function renderFeed() {
    const lista = filtroActual === 'todo'
      ? publicaciones
      : publicaciones.filter(p => p.tipo === filtroActual);

    if (lista.length === 0) {
      feed.innerHTML = `
        <div class="card empty-state">
          <div class="empty-state__icon">📭</div>
          <p>No hay publicaciones con este filtro.</p>
        </div>`;
      return;
    }

    feed.innerHTML = lista.map(p => renderPost(p)).join('');
    conectarEventosPost();
  }

  function renderPost(p) {
    const iconoTipo = {
      post: '📝',
      partido: '⚽',
      torneo: '🏆',
      grupo: '👥'
    }[p.tipo] || '📝';

    const etiquetaTipo = {
      post: 'publicó',
      partido: 'creó un partido',
      torneo: 'creó un torneo',
      grupo: 'creó un grupo'
    }[p.tipo] || 'publicó';

    return `
      <article class="post" data-id="${p.id}">
        <header class="post__header">
          <img src="${p.autor.avatar}" alt="" class="avatar avatar--md" data-autor-id="${p.autor.id}" style="cursor:pointer" />
          <div class="post__author">
            <div class="post__author-name" data-autor-id="${p.autor.id}" style="cursor:pointer">${p.autor.nombre}</div>
            <div class="post__meta">
              <span class="post__tipo-icono">${iconoTipo}</span>
              ${etiquetaTipo} · ${tiempoRelativo(p.fecha)}
            </div>
          </div>
          <button class="post__menu" aria-label="Opciones">⋯</button>
        </header>

        <div class="post__body">${escapeHtml(p.contenido)}</div>

        ${p.imagen ? `<img src="${p.imagen}" alt="" class="post__image" loading="lazy" />` : ''}
        ${p.video  ? `<video src="${p.video}" controls class="post__image" style="max-height:400px; width:100%"></video>` : ''}

        <div class="post__stats">
          <button class="post__action post__action--like ${p.yoLikee ? 'activo' : ''}" data-accion="like">
            <span class="post__action-icon">${p.yoLikee ? '❤️' : '🤍'}</span>
            <span class="contador-likes">${p.likes}</span>
          </button>

          <button class="post__action" data-accion="comentarios">
            <span class="post__action-icon">💬</span>
            <span class="contador-comentarios">${p.comentarios.length}</span>
          </button>

          <button class="post__action" data-accion="compartir">
            <span class="post__action-icon">↗️</span>
            Compartir
          </button>
        </div>

        <div class="post__comentarios">
          ${p.comentarios.map(c => `
            <div class="comentario">
              <img src="${c.avatar}" alt="" class="avatar avatar--sm" />
              <div class="comentario__cuerpo">
                <div class="comentario__autor">${c.autor}</div>
                <div class="comentario__texto">${escapeHtml(c.texto)}</div>
                <div class="comentario__fecha">${c.fecha}</div>
              </div>
            </div>
          `).join('')}

          <form class="comentario-form" data-form-comentario>
            <input type="text" placeholder="Escribe un comentario..." maxlength="200" />
            <button type="submit" class="btn btn--primary btn--sm">Enviar</button>
          </form>
        </div>
      </article>
    `;
  }

  /* =========================================================
     EVENTOS DE LOS POSTS
     ========================================================= */
  function conectarEventosPost() {
    // Likes
    feed.querySelectorAll('[data-accion="like"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const postEl = btn.closest('.post');
        const id = Number(postEl.dataset.id);
        toggleLike(id);
        actualizarPostEnDOM(id, postEl);
      });
    });

    // Click en autor → ver perfil
    feed.querySelectorAll('[data-autor-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        import('../components.js').then(({ verPerfilUsuario }) => {
          verPerfilUsuario(Number(el.dataset.autorId));
        });
      });
    });

    // Mostrar/ocultar comentarios
    feed.querySelectorAll('[data-accion="comentarios"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const postEl = btn.closest('.post');
        const comentarios = postEl.querySelector('.post__comentarios');
        comentarios.classList.toggle('abierto');

        if (comentarios.classList.contains('abierto')) {
          comentarios.querySelector('input')?.focus();
        }
      });
    });

    // Compartir
    feed.querySelectorAll('[data-accion="compartir"]').forEach(btn => {
      btn.addEventListener('click', () => {
        toast('Enlace copiado al portapapeles', 'success');
      });
    });

    // Formulario de comentarios
    feed.querySelectorAll('[data-form-comentario]').forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('input');
        const texto = input.value.trim();
        if (!texto) return;

        const postEl = form.closest('.post');
        const id = Number(postEl.dataset.id);
        agregarComentario(id, texto);

        input.value = '';
        actualizarPostEnDOM(id, postEl);

        postEl.querySelector('.post__comentarios')?.classList.add('abierto');
      });
    });
  }

  /* =========================================================
     ACCIONES DE DATOS
     ========================================================= */
  function toggleLike(id) {
    const p = publicaciones.find(x => x.id === id);
    if (!p) return;
    p.yoLikee = !p.yoLikee;
    p.likes += p.yoLikee ? 1 : -1;
    actualizarPublicacion(id, { yoLikee: p.yoLikee, likes: p.likes });
  }
  function agregarComentario(id, texto) {
    const p = publicaciones.find(x => x.id === id);
    if (!p) return;

    p.comentarios.push({
      id: Date.now(),
      autor: user?.nombre || 'Tú',
      avatar: user?.avatar || 'https://i.pravatar.cc/100',
      texto,
      fecha: 'ahora'
    });

    actualizarPublicacion(id, { comentarios: p.comentarios });
  }

  /* =========================================================
     ACTUALIZACIÓN PUNTUAL DEL DOM
     ========================================================= */
  function actualizarPostEnDOM(id, postEl) {
    const p = publicaciones.find(x => x.id === id);
    if (!p) return;

    const btnLike = postEl.querySelector('[data-accion="like"]');
    btnLike.classList.toggle('activo', p.yoLikee);
    btnLike.querySelector('.post__action-icon').textContent = p.yoLikee ? '❤️' : '🤍';
    btnLike.querySelector('.contador-likes').textContent = p.likes;

    postEl.querySelector('.contador-comentarios').textContent = p.comentarios.length;

    const contenedor = postEl.querySelector('.post__comentarios');
    const form = contenedor.querySelector('[data-form-comentario]');

    contenedor.querySelectorAll('.comentario').forEach(el => el.remove());

    p.comentarios.forEach(c => {
      const div = document.createElement('div');
      div.className = 'comentario';
      div.innerHTML = `
        <img src="${c.avatar}" alt="" class="avatar avatar--sm" />
        <div class="comentario__cuerpo">
          <div class="comentario__autor">${c.autor}</div>
          <div class="comentario__texto">${escapeHtml(c.texto)}</div>
          <div class="comentario__fecha">${c.fecha}</div>
        </div>
      `;
      contenedor.insertBefore(div, form);
    });
  }

  /* =========================================================
     FILTROS DEL FEED
     ========================================================= */
  const chips = document.querySelectorAll('[data-feed]');
  function handleChip(e) {
    chips.forEach(c => c.classList.remove('chip--active'));
    e.currentTarget.classList.add('chip--active');
    filtroActual = e.currentTarget.dataset.feed;
    renderFeed();
  }
  chips.forEach(c => c.addEventListener('click', handleChip));

  /* =========================================================
     COMPOSER / MODAL CREAR POST
     ========================================================= */
  let tipoSeleccionado = 'post';

  document.getElementById('btn-abrir-composer')?.addEventListener('click', () => {
    abrirModal('modal-crear-post');
  });

  document.querySelectorAll('[data-tipo-rapido]').forEach(btn => {
    btn.addEventListener('click', () => {
      tipoSeleccionado = btn.dataset.tipoRapido;
      aplicarTipoActivo();
      abrirModal('modal-crear-post');
    });
  });

  document.querySelectorAll('#selector-tipo [data-tipo]').forEach(op => {
    op.addEventListener('click', () => {
      tipoSeleccionado = op.dataset.tipo;
      aplicarTipoActivo();
    });
  });

  function aplicarTipoActivo() {
    document.querySelectorAll('#selector-tipo [data-tipo]').forEach(op => {
      op.classList.toggle('active', op.dataset.tipo === tipoSeleccionado);
    });
  }

  document.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      cerrarModal(btn.dataset.cerrarModal);
    });
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) cerrarModal('modal-crear-post');
  });

  const textarea = document.getElementById('post-contenido');
  const contador = document.getElementById('contador-chars');
  textarea?.addEventListener('input', () => {
    contador.textContent = textarea.value.length;
  });
    /* ---------- Manejar adjunto (imagen o video) ---------- */
  let adjuntoActual = null; // { tipo: 'imagen'|'video', dataUrl: '...' }

  const previewWrapper = document.getElementById('post-preview-wrapper');
  const previewCont    = document.getElementById('post-preview');
  const btnQuitarAdj   = document.getElementById('post-btn-eliminar-adjunto');
  const inputImagen    = document.getElementById('post-input-imagen');
  const inputVideo     = document.getElementById('post-input-video');

  function mostrarPreview() {
    if (!adjuntoActual) {
      previewWrapper?.classList.add('hidden');
      previewCont.innerHTML = '';
      btnQuitarAdj.style.display = 'none';
      return;
    }

    previewWrapper?.classList.remove('hidden');
    btnQuitarAdj.style.display = '';

    if (adjuntoActual.tipo === 'imagen') {
      previewCont.innerHTML = `<img src="${adjuntoActual.dataUrl}" style="width:100%; display:block" />`;
    } else {
      previewCont.innerHTML = `<video src="${adjuntoActual.dataUrl}" controls style="width:100%; display:block"></video>`;
    }
  }

  function leerArchivo(file, tipo) {
    if (!file) return;

    // Límite de 5 MB para no reventar localStorage
    if (file.size > 5 * 1024 * 1024) {
      toast('El archivo es muy grande (máx 5 MB)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      adjuntoActual = { tipo, dataUrl: e.target.result };
      mostrarPreview();
    };
    reader.readAsDataURL(file);
  }

  inputImagen?.addEventListener('change', (e) => {
    leerArchivo(e.target.files[0], 'imagen');
    e.target.value = ''; // reset
  });

  inputVideo?.addEventListener('change', (e) => {
    leerArchivo(e.target.files[0], 'video');
    e.target.value = '';
  });

  btnQuitarAdj?.addEventListener('click', () => {
    adjuntoActual = null;
    mostrarPreview();
  });

  document.getElementById('btn-publicar')?.addEventListener('click', () => {
    const contenido = textarea.value.trim();
    if (!contenido && !adjuntoActual) {
      toast('Escribe algo o adjunta una imagen/video', 'error');
      return;
    }

    const nueva = {
      id: Date.now(),
      autor: {
        id: user?.id,
        nombre: user?.nombre || 'Tú',
        username: user?.username,
        avatar: user?.avatar
      },
      tipo: tipoSeleccionado,
      contenido,
      imagen: adjuntoActual?.tipo === 'imagen' ? adjuntoActual.dataUrl : null,
      video:  adjuntoActual?.tipo === 'video'  ? adjuntoActual.dataUrl : null,
      fecha: new Date().toISOString(),
      likes: 0,
      yoLikee: false,
      comentarios: []
    };

    publicaciones.unshift(nueva);
    agregarPublicacion(nueva);

    // Reset
    textarea.value = '';
    contador.textContent = '0';
    tipoSeleccionado = 'post';
    adjuntoActual = null;
    mostrarPreview();
    aplicarTipoActivo();

    cerrarModal('modal-crear-post');
    filtroActual = 'todo';
    chips.forEach(c => c.classList.toggle('chip--active', c.dataset.feed === 'todo'));
    renderFeed();
    toast('¡Publicación creada!', 'success');
  });
  /* =========================================================
     ASIDE: COMUNIDADES
     ========================================================= */
  const comunidades = [
    { id: 1, nombre: 'Futboleros Santiago', miembros: 42, icono: '⚽', deporte: 'Fútbol',      ciudad: 'Santiago' },
    { id: 2, nombre: 'Básquet Nocturno',    miembros: 28, icono: '🏀', deporte: 'Básquetbol',  ciudad: 'Providencia' },
    { id: 3, nombre: 'Pádel Weekend',       miembros: 15, icono: '🎾', deporte: 'Pádel',       ciudad: 'Las Condes' },
  ];

  const gruposEl = document.getElementById('grupos-sugeridos');
  if (gruposEl) {
    gruposEl.innerHTML = comunidades.map(g => `
      <div class="feed-item">
        <div style="font-size:24px">${g.icono}</div>
        <div style="flex:1; min-width:0">
          <div class="feed-item__title">${g.nombre}</div>
          <div class="feed-item__subtitle">${g.miembros} miembros · ${g.deporte}</div>
        </div>
        <button class="btn btn--ghost btn--sm" data-unirse-comunidad="${g.id}">Unirme</button>
      </div>
    `).join('');

    gruposEl.querySelectorAll('[data-unirse-comunidad]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.textContent = '✓ Unido';
        btn.disabled = true;
        toast('Te uniste a la comunidad', 'success');
      });
    });
  }

  document.getElementById('btn-ver-comunidades')?.addEventListener('click', () => {
    window.location.hash = '#/mi-equipo';
  });

  document.getElementById('btn-crear-comunidad')?.addEventListener('click', () => {
    window.location.hash = '#/mi-equipo';
    toast('Ve a "Mi Equipo → Buscar" para crear tu comunidad', 'info');
  });

  /* =========================================================
     ASIDE: TORNEOS
     ========================================================= */
  const torneos = [
    { id: 1, nombre: 'Copa Verano 2026', equipos: 8,  icono: '🏆' },
    { id: 2, nombre: 'Liga Fútbol 7',    equipos: 12, icono: '🥇' },
    { id: 3, nombre: 'Copa Basket 3v3',  equipos: 6,  icono: '🏀' },
  ];

  const torneosEl = document.getElementById('torneos-abiertos');
  if (torneosEl) {
    torneosEl.innerHTML = torneos.map(t => `
      <div class="feed-item">
        <div style="font-size:24px">${t.icono}</div>
        <div style="flex:1; min-width:0">
          <div class="feed-item__title">${t.nombre}</div>
          <div class="feed-item__subtitle">${t.equipos} equipos</div>
        </div>
      </div>
    `).join('');
  }

  /* =========================================================
     RENDER INICIAL
     ========================================================= */
  renderFeed();

  /* =========================================================
     CLEANUP
     ========================================================= */
  return () => {
    chips.forEach(c => c.removeEventListener('click', handleChip));
  };
}

/* =========================================================
   HELPERS
   ========================================================= */
function tiempoRelativo(iso) {
  const ahora = Date.now();
  const dif = (ahora - new Date(iso).getTime()) / 1000;

  if (dif < 60) return 'hace unos segundos';
  if (dif < 3600) return `hace ${Math.floor(dif / 60)} min`;
  if (dif < 86400) return `hace ${Math.floor(dif / 3600)} h`;
  if (dif < 604800) return `hace ${Math.floor(dif / 86400)} d`;

  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}