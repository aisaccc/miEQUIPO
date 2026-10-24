/* =========================================================
   router.js — Navegación SPA basada en hash
   =========================================================
   Carga dinámicamente el HTML de cada "página" en <main>
   y luego ejecuta el módulo JS correspondiente.
*/

// Tabla de rutas: hash → { html, script, titulo }
const RUTAS = {
  '#/inicio':    { html: 'pages/inicio.html',    script: 'inicio',    titulo: 'Inicio' },
  '#/partidos':  { html: 'pages/partidos.html',  script: 'partidos',  titulo: 'Partidos' },
  '#/torneos':   { html: 'pages/torneos.html',   script: 'torneos',   titulo: 'Torneos' },
  '#/mi-equipo': { html: 'pages/mi-equipo.html', script: 'mi-equipo', titulo: 'Mi Equipo' },
  '#/mensajes':  { html: 'pages/mensajes.html',  script: 'mensajes',  titulo: 'Mensajes' },
  '#/perfil':    { html: 'pages/perfil.html',    script: 'perfil',    titulo: 'Perfil' },
};

// Rutas dinámicas (con parámetros)
// Acepta UUIDs completos: 8-4-4-4-12 caracteres hex con guiones
const REGEX_UUID = /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;

const RUTAS_DINAMICAS = [
  {
    // Acepta UUIDs Y números (compatibilidad con datos viejos)
    regex: /^#\/partido\/([a-zA-Z0-9-]+)$/,
    html: 'pages/partido-detalle.html',
    script: 'partido-detalle',
    tituloFn: () => 'Detalle del partido',
    params: (m) => ({ id: m[1] })
  },
  {
    regex: /^#\/torneo\/([a-zA-Z0-9-]+)$/,
    html: 'pages/torneo-detalle.html',
    script: 'torneo-detalle',
    tituloFn: () => 'Detalle del torneo',
    params: (m) => ({ id: m[1] })
  },
];

// Módulos ya cargados (cache)
const modulosCargados = {};

// Cleanup de la página actual
let cleanupActual = null;

/* ---------- NAVEGAR A UNA RUTA ---------- */
export async function navegar(hash) {
  let ruta = RUTAS[hash];
  let params = {};

  if (!ruta) {
    for (const r of RUTAS_DINAMICAS) {
      const match = hash.match(r.regex);
      if (match) {
        ruta = { html: r.html, script: r.script, titulo: r.tituloFn() };
        params = r.params ? r.params(match) : {};
        break;
      }
    }
  }

  if (!ruta) ruta = { ...RUTAS['#/inicio'], titulo: 'Inicio' };

  const contenedor = document.getElementById('page-content');
  if (!contenedor) {
    console.warn('[router] No se encontró #page-content en el HTML');
    return;
  }

  /* ⚡ Fondo por pestaña: seteamos data-page en .app-main.
     El CSS usa este atributo para elegir la foto de fondo. */
  const appMain = document.querySelector('.app-main');
  if (appMain) {
    appMain.dataset.page = ruta.script;   // 'inicio', 'partidos', 'torneos', etc.
  }

// Actualizar menú lateral
  document.querySelectorAll('.sidebar-nav__item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('href') === hash);
  });

  // ⚡ Actualizar barra inferior
  document.querySelectorAll('.app-bottom-nav__item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('href') === hash);
  });

  document.title = `MiEquipo — ${ruta.titulo}`;

  if (typeof cleanupActual === 'function') {
    try { cleanupActual(); } catch (e) { /* ignore */ }
    cleanupActual = null;
  }

  contenedor.innerHTML = `
    <div class="page-loader">
      <div class="spinner"></div>
      <span>Cargando...</span>
    </div>`;

  try {
    const res = await fetch(ruta.html);
    if (!res.ok) throw new Error(`No se pudo cargar ${ruta.html}`);
    const html = await res.text();
    contenedor.innerHTML = html;

    let modulo = modulosCargados[ruta.script];
    if (!modulo) {
      modulo = await import(`./pages/${ruta.script}.js?v=122`);
      modulosCargados[ruta.script] = modulo;
    }

    if (typeof modulo.init === 'function') {
      const resultado = await modulo.init(params);
      if (typeof resultado === 'function') cleanupActual = resultado;
    }
  } catch (err) {
    console.error('[router]', err);
    contenedor.innerHTML = `
      <div class="card">
        <h2 class="card__title">⚠️ No se pudo cargar la página</h2>
        <p class="card__subtitle">${err.message}</p>
      </div>`;
  }
}

/* ---------- INICIAR ROUTER ---------- */
export function iniciarRouter() {
  if (!window.location.hash) {
    window.location.hash = '#/inicio';
  }

  window.addEventListener('hashchange', () => navegar(window.location.hash));

  navegar(window.location.hash);
}