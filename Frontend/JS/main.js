/* =========================================================
   main.js — Punto de entrada de la app (app.html) (v3)
   =========================================================
   Cambios v3:
   - Se agregó el auto-refresco de sesión en segundo plano
   - Se mejoró el orden de carga de componentes
*/

import { iniciarRouter, navegar } from './router.js';
import {
  getSesion,
  cerrarSesion,
  obtenerUsuarioActual,
  estaAutenticado,
} from './auth.js';
import {
  initHeader,
  initDropdowns,
  initNotificaciones,
  initConfiguracion,
  initTheme,
  initBadgeMensajes,
  verPerfilUsuario,
} from './components.js';

// ⚡ NUEVO: Importar el auto-refresco
import { iniciarAutoRefresco } from './services/auth.service.js';

if (!estaAutenticado()) {
  window.location.href = 'index.html';
  throw new Error('Sin sesión — redirigiendo a login');
}

function pintarUsuarioEnHeader(usuario) {
  if (!usuario) return;

  const avatar = document.getElementById('avatar-header');
  if (avatar) {
    if (usuario.avatar) {
      avatar.src = usuario.avatar;
      avatar.alt = usuario.nombre || 'Usuario';
    } else {
      avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(usuario.nombre || 'U')}&background=ff6a00&color=fff`;
    }
  }

  const nombreHeader = document.getElementById('nombre-header');
  if (nombreHeader) {
    nombreHeader.textContent = usuario.nombre || usuario.username || 'Usuario';
  }
}

async function cerrarSesionYRedirigir() {
  const { logout } = await import('./services/auth.service.js');
  await logout();
  window.location.href = 'index.html';
}

async function init() {
  // 1. Pintar el usuario guardado (instantáneo, sin request)
  let usuario = getSesion();
  pintarUsuarioEnHeader(usuario);

  // 2. ⚡ Arrancar el router PRIMERO (renderiza HTML y muestra loader)
  iniciarRouter();

  // 3. Refrescar usuario desde backend (1 request)
  try {
    usuario = await obtenerUsuarioActual();
    pintarUsuarioEnHeader(usuario);
  } catch (err) {
    console.warn('[main] No se pudo refrescar el usuario:', err.message);
  }

  // 4. Componentes sin requests — inmediatos
  try {
    initHeader();
    initTheme();
    initConfiguracion();
    initBuscadorRoster();
    iniciarActividadRoster();
  } catch (err) {
    console.warn('[main] Error inicializando componentes básicos:', err.message);
  }

  // 5. ⚡ Componentes CON requests — escalonados para no saturar
  setTimeout(() => {
    try { initBadgeMensajes(); } catch (err) { console.warn('[main] initBadgeMensajes:', err); }
  }, 300);

  setTimeout(() => {
    try { initDropdowns(); } catch (err) { console.warn('[main] initDropdowns:', err); }
  }, 600);

  setTimeout(() => {
    try { initNotificaciones(); } catch (err) { console.warn('[main] initNotificaciones:', err); }
  }, 900);

  // 6. ⚡ NUEVO: Iniciar el auto-refresco de sesión cada 10 minutos
  iniciarAutoRefresco();

  // 7. Logout del sidebar
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!confirm('¿Cerrar sesión?')) return;
      btnLogout.disabled = true;
      btnLogout.textContent = 'Cerrando...';
      try {
        await cerrarSesionYRedirigir();
      } catch (err) {
        console.error('[main] Error al cerrar sesión:', err);
        window.location.href = 'index.html';
      }
    });
  }

  // 8. Logout del menú de usuario
  document.addEventListener('click', async (e) => {
    const item = e.target.closest('[data-action="logout"]');
    if (!item) return;
    if (!confirm('¿Cerrar sesión?')) return;
    try {
      await cerrarSesionYRedirigir();
    } catch {
      window.location.href = 'index.html';
    }
  });
}

init();

/* =========================================================
   SCROLL INTELIGENTE (Ocultar barra inferior en móvil)
   ========================================================= */
let lastScrollY = window.scrollY;
const bottomNav = document.querySelector('.app-bottom-nav');

if (bottomNav) {
  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;

    // Si estamos en la parte de arriba de todo, siempre mostrar
    if (currentScrollY < 50) {
      bottomNav.classList.remove('app-bottom-nav--hidden');
    } 
    // Si scrolleamos hacia abajo, ocultar
    else if (currentScrollY > lastScrollY) {
      bottomNav.classList.add('app-bottom-nav--hidden');
    } 
    // Si scrolleamos hacia arriba, mostrar
    else {
      bottomNav.classList.remove('app-bottom-nav--hidden');
    }

    lastScrollY = currentScrollY;
  }, { passive: true });
}
/* ---------- RESUMEN DE ACTIVIDAD REAL ---------- */
function iniciarActividadRoster() {
  const card = document.querySelector('.roster-activity');
  if (!card) return;
  let ultimaCarga = 0;
  let cargando = false;
  function pintar(clave, valor) {
    const el = document.getElementById(`roster-stat-${clave}`);
    if (el) el.textContent = typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? String(valor) : '—';
  }
  async function actualizar() {
    if (!card.getClientRects().length || cargando || Date.now() - ultimaCarga < 15000) return;
    cargando = true;
    ultimaCarga = Date.now();
    try {
      const [perfil, amigos] = await Promise.allSettled([
        import('./services/usuarios.service.js').then(m => m.obtenerMiPerfil()),
        import('./services/amistades.service.js').then(m => m.listarAmigos())
      ]);
      const stats = perfil.status === 'fulfilled' ? perfil.value?.statsHero : null;
      const actividad = perfil.status === 'fulfilled' ? perfil.value?.actividadRoster : null;
      pintar('partidos', actividad?.partidos);
      pintar('torneos', actividad?.torneos);
      pintar('equipos', stats?.equipos);
      pintar('amigos', amigos.status === 'fulfilled' && Array.isArray(amigos.value) ? amigos.value.length : null);
    } finally {
      cargando = false;
    }
  }
  document.getElementById('roster-stat-amigos-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    document.querySelector('#dropdown-amigos .dropdown__trigger')?.click();
  });
  setTimeout(actualizar, 1500);
  setInterval(() => { if (!document.hidden) actualizar(); }, 30000);
  window.addEventListener('focus', actualizar);
  window.addEventListener('resize', actualizar);
  window.addEventListener('hashchange', actualizar);
}

/* ---------- BUSCADOR GLOBAL EN TIEMPO REAL ---------- */
function initBuscadorRoster() {
  const slot = document.getElementById('roster-search-slot');
  const input = document.getElementById('roster-search-query');
  const panel = document.getElementById('roster-search-panel');
  const estado = document.getElementById('roster-search-status');
  const resultados = document.getElementById('roster-search-results');
  if (!slot || !input || !panel || !estado || !resultados) return;

  let version = 0;
  let temporizador;
  let ultimaConsulta = '';

  function mostrarPanel() {
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  function cerrarPanel() {
    clearTimeout(temporizador);
    version++;
    ultimaConsulta = '';
    panel.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  }
  function seleccionar(accion) {
    cerrarPanel();
    input.value = '';
    resultados.replaceChildren();
    accion();
  }
  function navegarResultado(hash) {
    if (window.location.hash === hash) navegar(hash);
    else window.location.hash = hash;
  }
  function agregarResultado(contenedor, nombre, detalle, accion) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'roster-search-result';
    const titulo = document.createElement('strong');
    titulo.textContent = nombre || 'Sin nombre';
    const sub = document.createElement('span');
    sub.textContent = detalle || '';
    btn.append(titulo, sub);
    btn.addEventListener('click', () => seleccionar(accion));
    contenedor.appendChild(btn);
  }

  async function buscar(q, actual) {
    const tareas = [
      { titulo: 'Usuarios', ejecutar: async () => {
        const termino = q.replace(/^@/, '').trim();
        if (termino.length < 2) return [];
        const { buscarUsuarios } = await import('./services/usuarios.service.js');
        const usuarios = await buscarUsuarios(termino);
        return usuarios.map(u => ({ nombre: u.nombre || u.username, detalle: `@${u.username || ''}`, accion: () => verPerfilUsuario(u.id) }));
      }},
      { titulo: 'Partidos', ejecutar: async () => {
        const { listarPartidos } = await import('./services/partidos.service.js');
        const { data } = await listarPartidos({ busqueda: q, limit: 10 });
        return (data || []).map(p => ({ nombre: p.titulo, detalle: [p.deporte, p.lugar].filter(Boolean).join(' · '), accion: () => navegarResultado(`#/partido/${encodeURIComponent(p.id)}`) }));
      }},
      { titulo: 'Torneos', ejecutar: async () => {
        const { listarTorneos } = await import('./services/torneos.service.js');
        const { data } = await listarTorneos({ busqueda: q, limit: 10 });
        return (data || []).map(t => ({ nombre: t.nombre, detalle: [t.deporte, t.lugar].filter(Boolean).join(' · '), accion: () => navegarResultado(`#/torneo/${encodeURIComponent(t.id)}`) }));
      }},
      ...['equipo', 'comunidad'].map(grupoTipo => ({
        titulo: grupoTipo === 'equipo' ? 'Equipos' : 'Comunidades', ejecutar: async () => {
          const { listarGrupos } = await import('./services/grupos.service.js');
          const { data } = await listarGrupos({ tipo: grupoTipo, busqueda: q, limit: 10 });
          return (data || []).map(g => ({ nombre: g.nombre, detalle: [g.deporte, g.ciudad].filter(Boolean).join(' · '), accion: () => {
            sessionStorage.setItem('miEquipoTarget', JSON.stringify({ tab: grupoTipo, id: g.id }));
            navegarResultado('#/mi-equipo');
          }}));
        }
      }))
    ];
    try {
      const respuestas = await Promise.allSettled(tareas.map(t => t.ejecutar()));
      if (actual !== version || panel.hidden) return;
      resultados.replaceChildren();
      let total = 0;
      let errores = 0;
      respuestas.forEach((respuesta, i) => {
        if (respuesta.status === 'rejected') { errores++; return; }
        if (!respuesta.value.length) return;
        const seccion = document.createElement('section');
        seccion.className = 'roster-search-section';
        const titulo = document.createElement('h4');
        titulo.textContent = tareas[i].titulo;
        seccion.appendChild(titulo);
        respuesta.value.slice(0, 10).forEach(r => {
          agregarResultado(seccion, r.nombre, r.detalle, r.accion);
          total++;
        });
        resultados.appendChild(seccion);
      });
      estado.textContent = (total ? `${total} coincidencias mostradas (hasta 10 por categoría).` : errores === tareas.length ? 'No se pudo realizar la búsqueda.' : 'No se encontraron coincidencias.') + (errores && errores < tareas.length ? ' Algunas categorías no pudieron cargarse.' : '');
    } catch {
      if (actual === version && !panel.hidden) estado.textContent = 'No se pudo realizar la búsqueda.';
    }
  }

  function programarBusqueda() {
    const q = input.value.trim();
    if (q.length < 2) { cerrarPanel(); resultados.replaceChildren(); return; }
    if (q === ultimaConsulta && !panel.hidden) return;
    clearTimeout(temporizador);
    const actual = ++version;
    ultimaConsulta = q;
    mostrarPanel();
    resultados.replaceChildren();
    estado.textContent = 'Buscando...';
    temporizador = setTimeout(() => buscar(q, actual), 350);
  }
  input.addEventListener('input', programarBusqueda);
  input.addEventListener('focus', programarBusqueda);
  document.addEventListener('click', e => { if (!slot.contains(e.target)) cerrarPanel(); });
  window.addEventListener('hashchange', cerrarPanel);
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      if (document.querySelector('.modal-backdrop.open')) return;
      e.preventDefault();
      input.focus();
    }
    if (e.key === 'Escape' && !panel.hidden) { input.focus({ preventScroll: true }); cerrarPanel(); }
  });
}
