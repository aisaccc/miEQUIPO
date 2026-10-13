/* =========================================================
   inicio.js — Página de Inicio (Fase 3 rediseño)
   =========================================================
   Todo desde backend, sin mocks.
   - Feed de publicaciones: pendiente (no hay endpoint todavía).
   - Agenda, equipos, comunidades, torneos: reales.
   ========================================================= */

import { getSesion } from '../auth.js';
import { toast, abrirModal, cerrarModal } from '../components.js';
import { listarPartidos } from '../services/partidos.service.js';
import { listarTorneos } from '../services/torneos.service.js';
import { listarGrupos } from '../services/grupos.service.js';

export async function init() {
  const user = getSesion();
  const feed = document.getElementById('feed');
  const modal = document.getElementById('modal-crear-post');

  if (!feed) return null;

  /* =========================================================
     HERO: eyebrow + saludo + avatar del composer
     ========================================================= */

  // Fecha del día: "LUNES, 5 DE OCTUBRE"
  const eyebrow = document.getElementById('inicio-eyebrow');
  if (eyebrow) {
    const hoy = new Date();
    const dias = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
                   'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    eyebrow.textContent =
      `${dias[hoy.getDay()]}, ${hoy.getDate()} DE ${meses[hoy.getMonth()]}`;
  }

  // Saludo: "¡Hola, Isaac!"
  const titulo = document.getElementById('inicio-titulo');
  if (titulo) {
    const nombre = user?.nombre?.split(' ')[0] || '';
    titulo.textContent = nombre ? `¡Hola, ${nombre}!` : '¡Hola!';
  }

  // Avatar del composer
  const composerAvatar = document.getElementById('composer-avatar');
  if (composerAvatar && user?.avatar) {
    composerAvatar.src = user.avatar;
  }

  /* =========================================================
     FEED (vacío por ahora, con empty state)
     ========================================================= */
  const filtroActual = 'todo';

  function renderFeedVacio() {
    feed.innerHTML = `
      <div class="feed-empty">
        <div class="feed-empty__icon">📭</div>
        <div class="feed-empty__titulo">Aún no hay publicaciones</div>
        <div class="feed-empty__text">
          Cuando el feed esté activo vas a poder compartir tus partidos,
          torneos y logros con tu comunidad deportiva.
        </div>
      </div>
    `;
  }

  renderFeedVacio();

  /* =========================================================
     FILTROS DEL FEED (solo visual por ahora)
     ========================================================= */
  const chips = document.querySelectorAll('[data-feed]');
  function handleChip(e) {
    chips.forEach(c => c.classList.remove('chip--active'));
    e.currentTarget.classList.add('chip--active');
    renderFeedVacio();
  }
  chips.forEach(c => c.addEventListener('click', handleChip));

  /* =========================================================
     COMPOSER / MODAL CREAR POST
     ========================================================= */
  document.getElementById('btn-abrir-composer')?.addEventListener('click', () => {
    toast('Las publicaciones estarán disponibles próximamente', 'info');
  });

  document.querySelectorAll('[data-tipo-rapido]').forEach(btn => {
    btn.addEventListener('click', () => {
      toast('Las publicaciones estarán disponibles próximamente', 'info');
    });
  });

  document.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      cerrarModal(btn.dataset.cerrarModal);
    });
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) cerrarModal('modal-crear-post');
  });

  /* =========================================================
     AGENDA: PRÓXIMOS PARTIDOS
     ========================================================= */
  async function cargarAgenda() {
    const cont = document.getElementById('agenda-partidos');
    if (!cont) return;

    cont.innerHTML = `
      <div class="aside-empty">
        <div class="aside-empty__icon">⏳</div>
        <div class="aside-empty__text">Cargando...</div>
      </div>
    `;

    try {
      const { data } = await listarPartidos({ limit: 3, estado: 'abierto' });

      if (!data || data.length === 0) {
        cont.innerHTML = `
          <div class="aside-empty">
            <div class="aside-empty__icon">📅</div>
            <div class="aside-empty__text">
              No hay partidos próximos por ahora.
            </div>
          </div>
        `;
        return;
      }

      cont.innerHTML = data.map(p => {
        const fecha = p.fecha ? new Date(p.fecha) : null;
        const dia = fecha ? fecha.getDate() : '—';
        const mes = fecha
          ? fecha.toLocaleDateString('es-CL', { month: 'short' }).toUpperCase()
          : '—';

        const hora = fecha
          ? fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
          : '';

        const lugar = p.lugar || 'Sin lugar';

        return `
          <a class="agenda-item" href="#/partido/${p.id}">
            <div class="agenda-item__fecha">
              <div class="agenda-item__dia">${dia}</div>
              <div class="agenda-item__mes">${mes}</div>
            </div>
            <div class="agenda-item__info">
              <div class="agenda-item__titulo">${escapeHtml(p.titulo || 'Partido')}</div>
              <div class="agenda-item__meta">
                <span>📍</span>
                <span>${escapeHtml(lugar)}${hora ? ' · ' + hora : ''}</span>
              </div>
            </div>
            <span class="agenda-item__icono">${emojiDeporte(p.deporte)}</span>
          </a>
        `;
      }).join('');
    } catch (err) {
      console.error('[inicio] Error al cargar agenda:', err);
      cont.innerHTML = `
        <div class="aside-empty">
          <div class="aside-empty__icon">⚠️</div>
          <div class="aside-empty__text">No se pudieron cargar los partidos.</div>
        </div>
      `;
    }
  }

  /* =========================================================
     TUS EQUIPOS
     ========================================================= */
  async function cargarTusEquipos() {
    const cont = document.getElementById('tus-equipos');
    if (!cont) return;

    cont.innerHTML = `
      <div class="aside-empty">
        <div class="aside-empty__icon">⏳</div>
        <div class="aside-empty__text">Cargando...</div>
      </div>
    `;

    try {
      const { data } = await listarGrupos({
        tipo: 'equipo',
        soloMios: 'true',
        limit: 3,
      });

      if (!data || data.length === 0) {
        cont.innerHTML = `
          <div class="aside-empty">
            <div class="aside-empty__icon">🛡️</div>
            <div class="aside-empty__text">
              No pertenecés a ningún equipo todavía.
            </div>
          </div>
        `;
        return;
      }

      cont.innerHTML = data.map(g => `
        <a class="aside-item" href="#/mi-equipo">
          <div class="aside-item__icono">
            ${g.escudo
              ? (esImagen(g.escudo)
                  ? `<img src="${g.escudo}" alt="" />`
                  : g.escudo)
              : '🛡️'}
          </div>
          <div class="aside-item__info">
            <div class="aside-item__titulo">${escapeHtml(g.nombre)}</div>
            <div class="aside-item__meta">${escapeHtml(g.deporte || 'Sin deporte')}</div>
          </div>
        </a>
      `).join('');
    } catch (err) {
      console.error('[inicio] Error al cargar equipos:', err);
      cont.innerHTML = `
        <div class="aside-empty">
          <div class="aside-empty__icon">⚠️</div>
          <div class="aside-empty__text">No se pudieron cargar tus equipos.</div>
        </div>
      `;
    }
  }

  /* =========================================================
     COMUNIDADES SUGERIDAS
     ========================================================= */
  async function cargarComunidades() {
    const cont = document.getElementById('grupos-sugeridos');
    if (!cont) return;

    cont.innerHTML = `
      <div class="aside-empty">
        <div class="aside-empty__icon">⏳</div>
        <div class="aside-empty__text">Cargando...</div>
      </div>
    `;

    try {
      const { data } = await listarGrupos({
        tipo: 'comunidad',
        limit: 3,
      });

      if (!data || data.length === 0) {
        cont.innerHTML = `
          <div class="aside-empty">
            <div class="aside-empty__icon">🌐</div>
            <div class="aside-empty__text">
              No hay comunidades sugeridas por ahora.
            </div>
          </div>
        `;
        return;
      }

      cont.innerHTML = data.map(g => `
        <div class="aside-item">
          <div class="aside-item__icono">
            ${g.escudo
              ? (esImagen(g.escudo)
                  ? `<img src="${g.escudo}" alt="" />`
                  : g.escudo)
              : '🌐'}
          </div>
          <div class="aside-item__info">
            <div class="aside-item__titulo">${escapeHtml(g.nombre)}</div>
            <div class="aside-item__meta">
              ${g.totalMiembros ?? 0} miembros · ${escapeHtml(g.deporte || '')}
            </div>
          </div>
          <button class="btn btn--ghost btn--sm" data-unirse-comunidad="${g.id}">
            Unirme
          </button>
        </div>
      `).join('');

      // Botones "Unirme" (solo visual por ahora)
      cont.querySelectorAll('[data-unirse-comunidad]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          toast('Próximamente vas a poder unirte a comunidades', 'info');
        });
      });
    } catch (err) {
      console.error('[inicio] Error al cargar comunidades:', err);
      cont.innerHTML = `
        <div class="aside-empty">
          <div class="aside-empty__icon">⚠️</div>
          <div class="aside-empty__text">No se pudieron cargar las comunidades.</div>
        </div>
      `;
    }
  }

  /* =========================================================
     TORNEOS ABIERTOS
     ========================================================= */
  async function cargarTorneosAbiertos() {
    const cont = document.getElementById('torneos-abiertos');
    if (!cont) return;

    cont.innerHTML = `
      <div class="aside-empty">
        <div class="aside-empty__icon">⏳</div>
        <div class="aside-empty__text">Cargando...</div>
      </div>
    `;

    try {
      const { data } = await listarTorneos({
        estado: 'inscripcion',
        limit: 3,
      });

      if (!data || data.length === 0) {
        cont.innerHTML = `
          <div class="aside-empty">
            <div class="aside-empty__icon">🏆</div>
            <div class="aside-empty__text">
              No hay torneos abiertos por ahora.
            </div>
          </div>
        `;
        return;
      }

      cont.innerHTML = data.map(t => `
        <a class="aside-item" href="#/torneo/${t.id}">
          <div class="aside-item__icono">
            ${t.emoji
              ? (esImagen(t.emoji)
                  ? `<img src="${t.emoji}" alt="" />`
                  : t.emoji)
              : '🏆'}
          </div>
          <div class="aside-item__info">
            <div class="aside-item__titulo">${escapeHtml(t.nombre)}</div>
            <div class="aside-item__meta">
              ${t.totalEquipos ?? 0}/${t.cuposEquipos ?? 0} ·
              ${escapeHtml(t.deporte || '')}
            </div>
          </div>
        </a>
      `).join('');
    } catch (err) {
      console.error('[inicio] Error al cargar torneos:', err);
      cont.innerHTML = `
        <div class="aside-empty">
          <div class="aside-empty__icon">⚠️</div>
          <div class="aside-empty__text">No se pudieron cargar los torneos.</div>
        </div>
      `;
    }
  }

  /* =========================================================
     BOTONES "VER TODOS" DEL ASIDE
     ========================================================= */
  document.getElementById('btn-ver-partidos')?.addEventListener('click', () => {
    window.location.hash = '#/partidos';
  });

  document.getElementById('btn-ver-mi-equipo')?.addEventListener('click', () => {
    window.location.hash = '#/mi-equipo';
  });

  document.getElementById('btn-ver-comunidades')?.addEventListener('click', () => {
    window.location.hash = '#/mi-equipo';
  });

  document.getElementById('btn-crear-comunidad')?.addEventListener('click', () => {
    window.location.hash = '#/mi-equipo';
    toast('Ve a "Mi Equipo" para crear tu comunidad', 'info');
  });

  /* =========================================================
     CARGA INICIAL DE DATOS
     ========================================================= */
  await Promise.all([
    cargarAgenda(),
    cargarTusEquipos(),
    cargarComunidades(),
    cargarTorneosAbiertos(),
  ]);

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
  if (!deporte) return '🏅';
  const map = {
    'Fútbol': '⚽',
    'Básquetbol': '🏀',
    'Tenis': '🎾',
    'Vóleibol': '🏐',
    'Pádel': '🎾',
    'Golf': '⛳',
    'Béisbol': '⚾',
    'Hockey': '🏑',
    'Boxeo': '🥊',
    'Bádminton': '🏸',
    'Rugby': '🏉',
    'Ciclismo': '🚴',
    'Natación': '🏊',
    'Atletismo': '🏃',
    'Tenis de mesa': '🏓',
    'Squash': '🎾',
    'Handball': '🤾',
    'Fútbol americano': '🏈',
    'Surf': '🏄',
    'Escalada': '🧗',
  };
  return map[deporte] || '🏅';
}