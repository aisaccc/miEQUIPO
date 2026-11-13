import { getSesion } from '../auth.js';
import { toast, abrirModalVerPublicacion } from '../components.js';
import { listarPartidos } from '../services/partidos.service.js';
import { listarTorneos } from '../services/torneos.service.js';
import { listarGrupos } from '../services/grupos.service.js';
import { obtenerFeed, toggleLike } from '../services/publicaciones.service.js';
import {
  abrirModalCrearPublicacionCompartido,
  renderFeedPublicaciones
} from '../utils/publicaciones-ui.js';
import { ICONOS } from '../utils/iconos.js';
import { listarAmigos } from '../services/amistades.service.js';

export async function init() {
  const user = getSesion();
  const feed = document.getElementById('feed');
  if (!feed) return null;

  let publicacionesCache = [];
  let filtroActual = 'todo';
  let amigosIds = new Set();
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
        <div class="feed-empty__text">Cuando tu o tus equipos y torneos publiquen algo, va a aparecer acá.</div>
      </div>`;
  }

  function aplicarFiltro() {
    let lista = publicacionesCache;
    if (filtroActual === 'post') {
      lista = lista.filter(p => p.scope === 'perfil' && (p.tipo === 'post' || !p.tipo));
    } else if (filtroActual === 'partido') {
      lista = lista.filter(p => p.tipo === 'partido');
    } else if (filtroActual === 'torneo') {
      lista = lista.filter(p => p.scope === 'torneo' || p.tipo === 'torneo');
    } else if (filtroActual === 'grupo') {
      lista = lista.filter(p => p.scope === 'grupo' || p.tipo === 'grupo');
    } else if (filtroActual === 'amigos') {
      lista = lista.filter(p => amigosIds.has(String(p.autor?.id)));
    }
    if (lista.length === 0) { renderFeedVacio(); return; }
    renderFeedPublicaciones(feed, lista, { onRefrescar: () => cargarFeed(true) });
  }

  /* ---------- CARGAS ---------- */
  async function cargarAmigosLista() {
    try {
      const amigos = await listarAmigos();
      amigosIds = new Set(amigos.map(a => String(a.id)));
    } catch (err) {
      console.error('[inicio] Error al cargar amigos:', err);
    }
  }

  async function cargarFeed(mostrarLoader = false) {
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
    aplicarFiltro();
  }
  chips.forEach(c => c.addEventListener('click', handleChip));

  /* ---------- COMPOSER ---------- */
  document.getElementById('btn-abrir-composer')?.addEventListener('click', () => {
    abrirModalCrearPublicacionCompartido('perfil', null, () => cargarFeed(true), { tipo: 'post' });
  });


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
          <a class="agenda-item" href="#/partido/${p.id}">
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
        cont.innerHTML = `<div class="aside-empty"><div class="aside-empty__icon">${ICONOS.escudo}</div><div class="aside-empty__text">No pertenecés a ningún equipo todavía.</div></div>`;
        return;
      }
      cont.innerHTML = data.map(g => `
        <a class="aside-item" href="#/mi-equipo">
          <div class="aside-item__icono">${g.escudo ? (esImagen(g.escudo) ? `<img src="${g.escudo}" alt="" />` : g.escudo) : ICONOS.escudo}</div>
          <div class="aside-item__info">
            <div class="aside-item__titulo">${escapeHtml(g.nombre)}</div>
            <div class="aside-item__meta">${escapeHtml(g.deporte || 'Sin deporte')}</div>
          </div>
        </a>`).join('');
    } catch (err) {
      console.error('[inicio] Error al cargar equipos:', err);
      cont.innerHTML = `<div class="aside-empty"><div class="aside-empty__icon">${ICONOS.alerta}</div><div class="aside-empty__text">No se pudieron cargar tus equipos.</div></div>`;
    }
  }

  /* ---------- ASIDE: COMUNIDADES ---------- */
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
        <div class="aside-item">
          <div class="aside-item__icono">${g.escudo ? (esImagen(g.escudo) ? `<img src="${g.escudo}" alt="" />` : g.escudo) : ICONOS.globo}</div>
          <div class="aside-item__info">
            <div class="aside-item__titulo">${escapeHtml(g.nombre)}</div>
            <div class="aside-item__meta">${g.totalMiembros ?? 0} miembros · ${escapeHtml(g.deporte || '')}</div>
          </div>
          <button class="btn btn--ghost btn--sm" data-unirse-comunidad="${g.id}">Unirme</button>
        </div>`).join('');
      cont.querySelectorAll('[data-unirse-comunidad]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          toast('Próximamente vas a poder unirte a comunidades', 'info');
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
        <a class="aside-item" href="#/torneo/${t.id}">
          <div class="aside-item__icono">${t.emoji ? (esImagen(t.emoji) ? `<img src="${t.emoji}" alt="" />` : t.emoji) : ICONOS.trofeo}</div>
          <div class="aside-item__info">
            <div class="aside-item__titulo">${escapeHtml(t.nombre)}</div>
            <div class="aside-item__meta">${t.totalEquipos ?? 0}/${t.cuposEquipos ?? 0} · ${escapeHtml(t.deporte || '')}</div>
          </div>
        </a>`).join('');
    } catch (err) {
      console.error('[inicio] Error al cargar torneos:', err);
      cont.innerHTML = `<div class="aside-empty"><div class="aside-empty__icon">${ICONOS.alerta}</div><div class="aside-empty__text">No se pudieron cargar los torneos.</div></div>`;
    }
  }

  /* ---------- BOTONES ASIDE ---------- */
  document.getElementById('btn-ver-partidos')?.addEventListener('click', () => { window.location.hash = '#/partidos'; });
  document.getElementById('btn-ver-mi-equipo')?.addEventListener('click', () => { window.location.hash = '#/mi-equipo'; });
  document.getElementById('btn-ver-comunidades')?.addEventListener('click', () => { window.location.hash = '#/mi-equipo'; });
  document.getElementById('btn-crear-comunidad')?.addEventListener('click', () => {
    window.location.hash = '#/mi-equipo';
    toast('Ve a "Mi Equipo" para crear tu comunidad', 'info');
  });

  /* =========================================================
     ⚡ CARGA INICIAL ESCALONADA (v2)
     - Primero lo crítico: feed + amigos (para filtros)
     - Después el aside, uno cada 300-400ms
     ========================================================= */
  await Promise.all([
    cargarAmigosLista(),
    cargarFeed(true),
  ]);

  timeouts.push(setTimeout(() => cargarAgenda(),          250));
  timeouts.push(setTimeout(() => cargarTusEquipos(),      600));
  timeouts.push(setTimeout(() => cargarComunidades(),     950));
  timeouts.push(setTimeout(() => cargarTorneosAbiertos(), 1300));

  /* ---------- CLEANUP ---------- */
  return () => {
    chips.forEach(c => c.removeEventListener('click', handleChip));
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