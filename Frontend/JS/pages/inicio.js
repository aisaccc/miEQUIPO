import { getSesion } from '../auth.js';
import { toast, abrirModal, cerrarModal } from '../components.js';
import { api } from '../api.js';
import { listarPartidos } from '../services/partidos.service.js';
import { listarTorneos } from '../services/torneos.service.js';
import { listarGrupos } from '../services/grupos.service.js';
import { obtenerFeed } from '../services/publicaciones.service.js';
import { renderFeedPublicaciones } from '../utils/publicaciones-ui.js';
import { ICONOS } from '../utils/iconos.js';

export async function init() {
  const user = getSesion();
  const feed = document.getElementById('feed');
  if (!feed) return null;

  let publicacionesCache = [];
  let filtroActual = 'todo';
  let publicacionesAmigosCache = [];
  const publicacionesCategoriaCache = new Map();
  let amigosCargados = false;
  const timeouts = []; // ⚡ NUEVO: para cleanup de aside escalonado

  /* ---------- HERO ---------- */
  const eyebrow = document.getElementById('inicio-eyebrow');
  if (eyebrow) {
    const hoy = new Date();
    const dias = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
                   'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    eyebrow.textContent = `${dias[hoy.getDay()]}, ${hoy.getDate()} DE ${meses[hoy.getMonth()]}`;
  }

  const titulo = document.getElementById('inicio-titulo');
  if (titulo) {
    const nombre = user?.nombre?.split(' ')[0] || '';
    titulo.textContent = nombre ? `¡Hola, ${nombre}!` : '¡Hola!';
  }

  const composerAvatar = document.getElementById('composer-avatar');
  if (composerAvatar && user?.avatar) composerAvatar.src = user.avatar;

  /* ---------- RENDER ---------- */
  function renderFeedVacio() {
    feed.innerHTML = `
      <div class="feed-empty">
        <div class="feed-empty__icon">${ICONOS.carpeta}</div>
        <div class="feed-empty__titulo">Aún no hay publicaciones</div>
        <div class="feed-empty__text">${filtroActual === 'amigos' ? 'Todavía no hay publicaciones visibles de tus amigos.' : 'Cuando tú o tu comunidad publiquen algo, aparecerá acá.'}</div>
      </div>`;
  }

  function aplicarFiltro() {
    let lista = publicacionesCache;
    if (filtroActual === 'amigos') {
      lista = publicacionesAmigosCache;
    } else if (['post', 'partido', 'torneo', 'grupo'].includes(filtroActual)) {
      lista = publicacionesCategoriaCache.get(filtroActual) || [];
    }
    if (lista.length === 0) { renderFeedVacio(); return; }
    renderFeedPublicaciones(feed, lista, { onRefrescar: () => cargarFeed(true) });
  }

  /* ---------- CARGAS ---------- */
  // El servidor filtra las publicaciones de amigos ANTES del LIMIT.
  // Se consultan páginas de 100 hasta consumir todo el feed autorizado.
  async function cargarFeedAmigos(mostrarLoader = false, forzar = false) {
    if (amigosCargados && !forzar) {
      aplicarFiltro();
      return;
    }
    if (mostrarLoader && filtroActual === 'amigos') {
      feed.innerHTML = `<div class="page-loader"><div class="spinner"></div><span>Cargando publicaciones de amigos...</span></div>`;
    }
    try {
      const todos = [];
      const limite = 100;
      let offset = 0;
      while (true) {
        const respuesta = await api.get(`/publicaciones/feed?soloAmigos=true&limit=${limite}&offset=${offset}`);
        const lote = Array.isArray(respuesta?.publicaciones) ? respuesta.publicaciones : [];
        todos.push(...lote);
        if (lote.length < limite) break;
        offset += limite;
      }
      publicacionesAmigosCache = todos;
      amigosCargados = true;
      if (filtroActual === 'amigos') aplicarFiltro();
    } catch (err) {
      console.error('[inicio] Error al cargar publicaciones de amigos:', err);
      if (filtroActual === 'amigos') {
        feed.innerHTML = `<div class="feed-empty"><div class="feed-empty__titulo">No se pudo cargar el feed de amigos</div><div class="feed-empty__text">${escapeHtml(err.message || '')}</div></div>`;
      }
    }
  }

  // Los filtros por etiqueta también consultan el servidor antes del LIMIT,
  // así una publicación no desaparece del filtro al superar 100 posts generales.
  async function cargarFeedCategoria(categoria, mostrarLoader = false, forzar = false) {
    if (!forzar && publicacionesCategoriaCache.has(categoria)) {
      aplicarFiltro();
      return;
    }
    if (mostrarLoader && filtroActual === categoria) {
      feed.innerHTML = `<div class="page-loader"><div class="spinner"></div><span>Cargando publicaciones...</span></div>`;
    }
    try {
      const todas = [];
      const limite = 100;
      let offset = 0;
      while (true) {
        const respuesta = await api.get(`/publicaciones/feed?categoria=${encodeURIComponent(categoria)}&limit=${limite}&offset=${offset}`);
        const lote = Array.isArray(respuesta?.publicaciones) ? respuesta.publicaciones : [];
        todas.push(...lote);
        if (lote.length < limite) break;
        offset += limite;
      }
      publicacionesCategoriaCache.set(categoria, todas);
      if (filtroActual === categoria) aplicarFiltro();
    } catch (err) {
      console.error('[inicio] Error al cargar categoría:', err);
      if (filtroActual === categoria) {
        feed.innerHTML = `<div class="feed-empty"><div class="feed-empty__titulo">No se pudo cargar el filtro</div><div class="feed-empty__text">${escapeHtml(err.message || '')}</div></div>`;
      }
    }
  }

  async function cargarFeed(mostrarLoader = false) {
    // Tras crear una publicación, actualizar también el feed de amigos si está activo.
    if (filtroActual === 'amigos') return cargarFeedAmigos(mostrarLoader, true);
    if (['post', 'partido', 'torneo', 'grupo'].includes(filtroActual)) {
      return cargarFeedCategoria(filtroActual, mostrarLoader, true);
    }
    amigosCargados = false;
    publicacionesCategoriaCache.clear();
    if (mostrarLoader) {
      feed.innerHTML = `<div class="page-loader"><div class="spinner"></div><span>Cargando feed...</span></div>`;
    }
    try {
      publicacionesCache = await obtenerFeed();
      aplicarFiltro();
    } catch (err) {
      console.error('[inicio] Error al cargar feed:', err);
      feed.innerHTML = `
        <div class="feed-empty">
          <div class="feed-empty__icon">${ICONOS.alerta}</div>
          <div class="feed-empty__titulo">No se pudo cargar el feed</div>
          <div class="feed-empty__text">${escapeHtml(err.message || '')}</div>
        </div>`;
    }
  }

  const chips = document.querySelectorAll('[data-feed]');
  function handleChip(e) {
    chips.forEach(c => c.classList.remove('chip--active'));
    e.currentTarget.classList.add('chip--active');
    filtroActual = e.currentTarget.dataset.feed;
    if (filtroActual === 'amigos') {
      cargarFeedAmigos(true);
    } else if (['post', 'partido', 'torneo', 'grupo'].includes(filtroActual)) {
      cargarFeedCategoria(filtroActual, true);
    } else {
      aplicarFiltro();
    }
  }
  chips.forEach(c => c.addEventListener('click', handleChip));

  /* ---------- COMPOSER ---------- */
  // Editor de Inicio: los chips son ETIQUETAS de la publicación, no
  // acciones de navegación ni de creación de partidos/equipos/torneos.
  const modalPublicar = document.getElementById('modal-crear-publicacion');
  const abrirComposerBtn = document.getElementById('btn-abrir-composer');
  const tiposPublicacion = new Set(['post', 'partido', 'torneo', 'grupo']);
  let categoriaSeleccionada = 'post';
  let imagenesCodificadas = [];
  let procesandoImagenes = Promise.resolve();
  let generacionImagenes = 0;
  let publicando = false;

  function elegirCategoria(tipo) {
    categoriaSeleccionada = tiposPublicacion.has(tipo) ? tipo : 'post';
    modalPublicar?.querySelectorAll('[data-tipo-pub]').forEach(chip => {
      chip.classList.toggle('subtab--active', chip.dataset.tipoPub === categoriaSeleccionada);
      chip.setAttribute('aria-pressed', String(chip.dataset.tipoPub === categoriaSeleccionada));
    });
  }

  function actualizarVistaPrevia() {
    const img = document.getElementById('crear-pub-preview-img');
    const wrapper = document.getElementById('crear-pub-preview-wrapper');
    if (img && imagenesCodificadas.length) img.src = imagenesCodificadas[0];
    wrapper?.classList.toggle('hidden', imagenesCodificadas.length === 0);
    const contador = document.getElementById('crear-pub-contador-inicio');
    if (contador) contador.textContent = imagenesCodificadas.length > 1
      ? `${imagenesCodificadas.length} imágenes seleccionadas` : '';
  }

  function leerArchivo(archivo) {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(String(lector.result));
      lector.onerror = () => reject(new Error('No se pudo leer la imagen'));
      lector.readAsDataURL(archivo);
    });
  }

  function manejarArchivos(evento) {
    const archivos = Array.from(evento.target.files || []);
    if (archivos.length > 3 || archivos.some(f => f.size > 3 * 1024 * 1024 ||
        !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type))) {
      evento.target.value = '';
      ++generacionImagenes;
      imagenesCodificadas = [];
      actualizarVistaPrevia();
      toast('Elige hasta 3 imágenes JPG, PNG, WebP o GIF de máximo 3 MB cada una', 'warning');
      return;
    }
    const generacion = ++generacionImagenes;
    procesandoImagenes = Promise.all(archivos.map(leerArchivo));
    procesandoImagenes.then(lista => {
      if (generacion !== generacionImagenes) return;
      imagenesCodificadas = lista;
      actualizarVistaPrevia();
    }).catch(err => {
      if (generacion !== generacionImagenes) return;
      imagenesCodificadas = [];
      actualizarVistaPrevia();
      toast(err.message, 'error');
    });
  }


  function asegurarPrivacidad() {
    const textarea = document.getElementById('crear-pub-contenido');
    if (!textarea) return;

    // Eliminar el selector desplegable anterior, si existe.
    const selectAnterior = document.getElementById('crear-pub-privacidad-inicio');
    if (selectAnterior) {
      selectAnterior.closest('.field')?.remove();
    }

    // Evitar crear el selector más de una vez.
    if (document.getElementById('crear-pub-privacidad-container')) return;

    const campo = document.createElement('div');
    campo.id = 'crear-pub-privacidad-container';
    campo.style.cssText =
      'margin-bottom:16px;padding:12px;background:var(--color-surface-2);border-radius:var(--radius-md);';

    const opciones = [
      { valor: 'publico', label: 'Público', icono: ICONOS.globo },
      { valor: 'amigos', label: 'Amigos', icono: ICONOS.usuarios },
      { valor: 'privado', label: 'Privado', icono: ICONOS.candado }
    ];

    campo.innerHTML = `
      <div style="font-size:var(--fs-sm);font-weight:600;margin-bottom:8px;">
        ¿Quién puede verla?
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${opciones.map(op => `
          <button
            type="button"
            class="btn ${op.valor === 'publico' ? 'btn--primary' : 'btn--ghost'}"
            data-priv="${op.valor}"
            style="flex:1;display:flex;flex-direction:column;align-items:center;padding:10px;"
          >
            <span style="width:20px;height:20px;margin-bottom:4px;">
              ${op.icono}
            </span>
            <span style="font-size:12px;font-weight:700;">
              ${op.label}
            </span>
          </button>
        `).join('')}
      </div>
    `;

    textarea.closest('.field')?.insertAdjacentElement('afterend', campo);

    campo.querySelectorAll('[data-priv]').forEach(btn => {
      btn.onclick = () => {
        campo.querySelectorAll('[data-priv]').forEach(b => {
          b.classList.remove('btn--primary');
          b.classList.add('btn--ghost');
        });

        btn.classList.remove('btn--ghost');
        btn.classList.add('btn--primary');
      };
    });
  }


  function abrirComposerInicio() {
    if (!modalPublicar) {
      toast('No se encontró el modal de publicaciones', 'error');
      return;
    }
    elegirCategoria('post');
    ++generacionImagenes;
    imagenesCodificadas = [];
    procesandoImagenes = Promise.resolve();
    const textarea = document.getElementById('crear-pub-contenido');
    if (textarea) textarea.value = '';
    const fileInput = document.getElementById('crear-pub-imagen-file');
    if (fileInput) fileInput.value = '';
    asegurarPrivacidad();
    const chipGrupos = modalPublicar.querySelector('[data-tipo-pub="grupo"]');
    if (chipGrupos) chipGrupos.textContent = 'Equipos / grupos';
    const privacidad = document.getElementById('crear-pub-privacidad-inicio');
    if (privacidad) privacidad.value = 'publico';
    const etiqueta = modalPublicar.querySelector('#crear-pub-tipo-selector')?.closest('.field')?.querySelector('.field__label');
    if (etiqueta) etiqueta.textContent = '¿Sobre qué trata tu publicación?';
    actualizarVistaPrevia();
    abrirModal('modal-crear-publicacion');
  }

  async function publicarDesdeInicio() {
    if (publicando) return;
    publicando = true;
    const boton = document.getElementById('btn-publicar');
    if (boton) boton.disabled = true;
    try {
      await procesandoImagenes;
      const contenido = document.getElementById('crear-pub-contenido')?.value.trim() || '';
      if (!contenido && !imagenesCodificadas.length) {
        toast('Escribe algo o adjunta una imagen para publicar', 'warning');
        return;
      }
      const privacidad = document.getElementById('crear-pub-privacidad-inicio')?.value || 'publico';
      const imagen = imagenesCodificadas.length > 1
        ? JSON.stringify(imagenesCodificadas)
        : (imagenesCodificadas[0] || null);
      await api.post('/publicaciones', {
        contenido: contenido || null,
        imagen,
        tipo: categoriaSeleccionada,
        privacidad,
      });
      cerrarModal('modal-crear-publicacion');
      toast('Publicación creada', 'success');
      amigosCargados = false;
      publicacionesCategoriaCache.clear();
      await cargarFeed(true);
    } catch (err) {
      console.error('[inicio] Error al publicar:', err);
      toast(err.message || 'No se pudo publicar', 'error');
    } finally {
      publicando = false;
      if (boton) boton.disabled = false;
    }
  }

  // Fase de captura: impide las redirecciones implementadas por versiones
  // antiguas del editor compartido si hubo navegación entre páginas.
  function manejarClickModal(e) {
    const chip = e.target.closest('[data-tipo-pub]');
    if (chip && modalPublicar?.contains(chip)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      elegirCategoria(chip.dataset.tipoPub);
      return;
    }
    if (e.target.closest('#btn-publicar')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      publicarDesdeInicio();
      return;
    }
    if (e.target.closest('#crear-pub-quitar-imagen')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      ++generacionImagenes;
      imagenesCodificadas = [];
      procesandoImagenes = Promise.resolve();
      const input = document.getElementById('crear-pub-imagen-file');
      if (input) input.value = '';
      actualizarVistaPrevia();
    }
  }
  const inputFotos = document.getElementById('crear-pub-imagen-file');
  abrirComposerBtn?.addEventListener('click', abrirComposerInicio);
  window.addEventListener('click', manejarClickModal, true);
  inputFotos?.addEventListener('change', manejarArchivos);


  /* ---------- ASIDE: AGENDA ---------- */
  async function cargarAgenda() {
    const cont = document.getElementById('agenda-partidos');
    if (!cont) return;
    cont.innerHTML = `<div class="aside-empty"><div class="aside-empty__icon">${ICONOS.reloj}</div><div class="aside-empty__text">Cargando...</div></div>`;
    try {
      const { data } = await listarPartidos({ limit: 3, estado: 'abierto' });
      if (!data || data.length === 0) {
        cont.innerHTML = `<div class="aside-empty"><div class="aside-empty__icon">${ICONOS.calendario}</div><div class="aside-empty__text">No hay partidos próximos por ahora.</div></div>`;
        return;
      }
      cont.innerHTML = data.map(p => {
        const fecha = p.fecha ? new Date(p.fecha) : null;
        const dia = fecha ? fecha.getDate() : '—';
        const mes = fecha ? fecha.toLocaleDateString('es-CL', { month: 'short' }).toUpperCase() : '—';
        const hora = fecha ? fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '';
        const lugar = p.lugar || 'Sin lugar';
        return `
          <a class="agenda-item" href="#/partido/${encodeURIComponent(p.id)}">
            <div class="agenda-item__fecha"><div class="agenda-item__dia">${dia}</div><div class="agenda-item__mes">${mes}</div></div>
            <div class="agenda-item__info">
              <div class="agenda-item__titulo">${escapeHtml(p.titulo || 'Partido')}</div>
              <div class="agenda-item__meta"><span>${ICONOS.ubicacion}</span><span>${escapeHtml(lugar)}${hora ? ' · ' + hora : ''}</span></div>
            </div>
            <span class="agenda-item__icono">${emojiDeporte(p.deporte)}</span>
          </a>`;
      }).join('');
    } catch (err) {
      console.error('[inicio] Error al cargar agenda:', err);
      cont.innerHTML = `<div class="aside-empty"><div class="aside-empty__icon">${ICONOS.alerta}</div><div class="aside-empty__text">No se pudieron cargar los partidos.</div></div>`;
    }
  }

  /* ---------- ASIDE: TUS EQUIPOS ---------- */
  async function cargarTusEquipos() {
    const cont = document.getElementById('tus-equipos');
    if (!cont) return;
    cont.innerHTML = `<div class="aside-empty"><div class="aside-empty__icon">${ICONOS.reloj}</div><div class="aside-empty__text">Cargando...</div></div>`;
    try {
      const { data } = await listarGrupos({ tipo: 'equipo', soloMios: 'true', limit: 3 });
      if (!data || data.length === 0) {
        cont.innerHTML = `<div class="aside-empty"><div class="aside-empty__icon">${ICONOS.escudo}</div><div class="aside-empty__text">No perteneces a ningún equipo todavía.</div></div>`;
        return;
      }
      cont.innerHTML = data.map(g => `
        <a class="aside-item" href="#/mi-equipo" data-grupo-id="${escapeAttr(g.id)}" data-tipo="equipo">
          <div class="aside-item__icono">${renderIconoSeguro(g.escudo, ICONOS.escudo)}</div>
          <div class="aside-item__info">
            <div class="aside-item__titulo">${escapeHtml(g.nombre)}</div>
            <div class="aside-item__meta">${escapeHtml(g.deporte || 'Sin deporte')}</div>
          </div>
        </a>`).join('');
      
      cont.querySelectorAll('[data-grupo-id]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.preventDefault(); // ⚡ Evita que el <a> salte antes de tiempo
          sessionStorage.setItem('miEquipoTarget', JSON.stringify({ tab: 'equipo', id: el.dataset.grupoId }));
          window.location.hash = '#/mi-equipo';
        });
      });
    } catch (err) {
      console.error('[inicio] Error al cargar equipos:', err);
      cont.innerHTML = `<div class="aside-empty"><div class="aside-empty__icon">${ICONOS.alerta}</div><div class="aside-empty__text">No se pudieron cargar tus equipos.</div></div>`;
    }
  }

  async function cargarComunidades() {
    const cont = document.getElementById('grupos-sugeridos');
    if (!cont) return;
    cont.innerHTML = `<div class="aside-empty"><div class="aside-empty__icon">${ICONOS.reloj}</div><div class="aside-empty__text">Cargando...</div></div>`;
    try {
      const { data } = await listarGrupos({ tipo: 'comunidad', limit: 3 });
      if (!data || data.length === 0) {
        cont.innerHTML = `<div class="aside-empty"><div class="aside-empty__icon">${ICONOS.globo}</div><div class="aside-empty__text">No hay comunidades sugeridas por ahora.</div></div>`;
        return;
      }
      cont.innerHTML = data.map(g => `
        <div class="aside-item" data-grupo-id="${escapeAttr(g.id)}" data-tipo="comunidad" style="cursor:pointer">
          <div class="aside-item__icono">${renderIconoSeguro(g.escudo, ICONOS.globo)}</div>
          <div class="aside-item__info">
            <div class="aside-item__titulo">${escapeHtml(g.nombre)}</div>
            <div class="aside-item__meta">${escapeHtml(g.totalMiembros ?? 0)} miembros · ${escapeHtml(g.deporte || '')}</div>
          </div>
          <button class="btn btn--ghost btn--sm" data-unirse-comunidad="${escapeAttr(g.id)}">Ver</button>
        </div>`).join('');

      cont.querySelectorAll('[data-grupo-id]').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('[data-unirse-comunidad]')) return;
          sessionStorage.setItem('miEquipoTarget', JSON.stringify({ tab: 'comunidad', id: el.dataset.grupoId }));
          window.location.hash = '#/mi-equipo';
        });
      });

      cont.querySelectorAll('[data-unirse-comunidad]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          sessionStorage.setItem('miEquipoTarget', JSON.stringify({ tab: 'comunidad', id: btn.dataset.unirseComunidad }));
          window.location.hash = '#/mi-equipo';
        });
      });
    } catch (err) {
      console.error('[inicio] Error al cargar comunidades:', err);
      cont.innerHTML = `<div class="aside-empty"><div class="aside-empty__icon">${ICONOS.alerta}</div><div class="aside-empty__text">No se pudieron cargar las comunidades.</div></div>`;
    }
  }

  /* ---------- ASIDE: TORNEOS ---------- */
  async function cargarTorneosAbiertos() {
    const cont = document.getElementById('torneos-abiertos');
    if (!cont) return;
    cont.innerHTML = `<div class="aside-empty"><div class="aside-empty__icon">${ICONOS.reloj}</div><div class="aside-empty__text">Cargando...</div></div>`;
    try {
      const { data } = await listarTorneos({ estado: 'inscripcion', limit: 3 });
      if (!data || data.length === 0) {
        cont.innerHTML = `<div class="aside-empty"><div class="aside-empty__icon">${ICONOS.trofeo}</div><div class="aside-empty__text">No hay torneos abiertos por ahora.</div></div>`;
        return;
      }
      cont.innerHTML = data.map(t => `
        <a class="aside-item" href="#/torneo/${encodeURIComponent(t.id)}">
          <div class="aside-item__icono">${renderIconoSeguro(t.emoji, ICONOS.trofeo)}</div>
          <div class="aside-item__info">
            <div class="aside-item__titulo">${escapeHtml(t.nombre)}</div>
            <div class="aside-item__meta">${escapeHtml(t.totalEquipos ?? 0)}/${escapeHtml(t.cuposEquipos ?? 0)} · ${escapeHtml(t.deporte || '')}</div>
          </div>
        </a>`).join('');
    } catch (err) {
      console.error('[inicio] Error al cargar torneos:', err);
      cont.innerHTML = `<div class="aside-empty"><div class="aside-empty__icon">${ICONOS.alerta}</div><div class="aside-empty__text">No se pudieron cargar los torneos.</div></div>`;
    }
  }

  /* ---------- BOTONES ASIDE ---------- */
  document.getElementById('btn-ver-partidos')?.addEventListener('click', () => { window.location.hash = '#/partidos'; });
  
  document.getElementById('btn-ver-mi-equipo')?.addEventListener('click', (e) => {
    e.preventDefault();
    sessionStorage.setItem('miEquipoTarget', JSON.stringify({ tab: 'equipo', id: null }));
    window.location.hash = '#/mi-equipo';
  });
  
  document.getElementById('btn-ver-comunidades')?.addEventListener('click', (e) => {
    e.preventDefault();
    sessionStorage.setItem('miEquipoTarget', JSON.stringify({ tab: 'comunidad', id: null }));
    window.location.hash = '#/mi-equipo';
  });

  // ⚡ FIX: Eliminar el botón de crear comunidad del aside
  const btnCrearComunidadAside = document.getElementById('btn-crear-comunidad');
  if (btnCrearComunidadAside) btnCrearComunidadAside.style.display = 'none';
  document.getElementById('btn-crear-comunidad')?.addEventListener('click', () => {
    window.location.hash = '#/mi-equipo';
    toast('Ve a "Mi Equipo" para crear tu comunidad', 'info');
  });

  /* =========================================================
     ⚡ CARGA INICIAL ESCALONADA (v2)
     - Primero lo crítico: feed + amigos (para filtros)
     - Después el aside, uno cada 300-400ms
     ========================================================= */
  await cargarFeed(true);

  timeouts.push(setTimeout(() => cargarAgenda(),          250));
  timeouts.push(setTimeout(() => cargarTusEquipos(),      600));
  timeouts.push(setTimeout(() => cargarComunidades(),     950));
  timeouts.push(setTimeout(() => cargarTorneosAbiertos(), 1300));

  /* ---------- CLEANUP ---------- */
  return () => {
    chips.forEach(c => c.removeEventListener('click', handleChip));
    abrirComposerBtn?.removeEventListener('click', abrirComposerInicio);
    window.removeEventListener('click', manejarClickModal, true);
    inputFotos?.removeEventListener('change', manejarArchivos);
    timeouts.forEach(clearTimeout);
  };
}

/* ---------- HELPERS ---------- */
function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function esImagen(str) {
  return typeof str === 'string' && /\.(svg|png|jpg|jpeg|gif|webp)$/i.test(str);
}

function emojiDeporte(deporte) {
  if (!deporte) return ICONOS.medalla;
  const map = {
    'Fútbol': 'assets/icons/balon-de-futbol (2).png',
    'Básquetbol': 'assets/icons/balocensto.svg',
    'Tenis': 'assets/icons/pelota-de-tenis.png',
    'Vóleibol': 'assets/icons/voleibol.svg',
    'Pádel': 'assets/icons/raqueta-de-padel.png',
    'Golf': 'assets/icons/golf.png',
    'Béisbol': 'assets/icons/beisbol.png',
    'Hockey': 'assets/icons/disco.png',
    'Boxeo': 'assets/icons/guantes-de-boxeo.png',
    'Bádminton': 'assets/icons/volante.png',
    'Rugby': 'assets/icons/rugby.png',
    'Ciclismo': 'assets/icons/bicicleta.svg',
    'Natación': 'assets/icons/natacion.svg',
    'Atletismo': 'assets/icons/corriendo.png',
    'Tenis de mesa': 'assets/icons/raqueta-de-tenis-de-mesa.png',
    'Squash': 'assets/icons/tenis-de-squash.png',
    'Handball': 'assets/icons/balonmano.png',
    'Fútbol americano': 'assets/icons/deporte.svg',
    'Surf': 'assets/icons/tabla-de-surf.png',
    'Escalada': 'assets/icons/escalada.png'
  };
  const valor = map[deporte] || ICONOS.medalla;
  if (esImagen(valor)) {
    return `<img src="${valor}" alt="" style="width:20px;height:20px;object-fit:contain;vertical-align:middle;display:inline-block" />`;
  }
  return valor;
}
/* Valores externos: nunca insertar texto o atributos sin escapar. */
function escapeAttr(valor) {
  return escapeHtml(valor).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderIconoSeguro(valor, fallback) {
  if (typeof valor !== 'string' || !valor) return fallback;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(valor)) {
    return `<img src="${escapeAttr(valor)}" alt="" />`;
  }
  if (/^assets\/[^?#]+\.(svg|png|jpe?g|gif|webp)$/i.test(valor)) {
    return `<img src="${escapeAttr(valor)}" alt="" />`;
  }
  try {
    const url = new URL(valor);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return `<img src="${escapeAttr(url.href)}" alt="" />`;
    }
  } catch { /* No es una URL absoluta: tratar como texto. */ }
  return escapeHtml(valor);
}
