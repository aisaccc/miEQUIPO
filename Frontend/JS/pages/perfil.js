import { getSesion } from '../auth.js';
import { toast, abrirModal, cerrarModal } from '../components.js';
import {
  deportes as todosLosDeportes,
  posicionesPorDeporte
} from '../data-mock.js';
import { statsPorDeporte } from '../stats-por-deporte.js';
import {
  getPartidos,
  publicacionesDe,
  actualizarUsuario,
  migrarTodosLosUsuarios
} from '../store.js';

/* ---------- LISTA DE PAÍSES ---------- */
const PAISES = [
  'Argentina', 'Bolivia', 'Brasil', 'Canadá', 'Chile', 'Colombia',
  'Costa Rica', 'Cuba', 'Ecuador', 'El Salvador', 'España', 'Estados Unidos',
  'Guatemala', 'Honduras', 'México', 'Nicaragua', 'Panamá', 'Paraguay',
  'Perú', 'Portugal', 'Puerto Rico', 'República Dominicana', 'Uruguay',
  'Venezuela', 'Otro'
];

export async function init() {
  let user = getSesion();
  if (!user) return null;

  migrarTodosLosUsuarios();
  user = getSesion();

  /* ---------- REFS ---------- */
  const elAvatar          = document.getElementById('perfil-avatar');
  const elNombre          = document.getElementById('perfil-nombre');
  const elUsername        = document.getElementById('perfil-username');
  const elBio             = document.getElementById('perfil-bio');
  const elCiudad          = document.getElementById('perfil-ciudad');
  const elEdad            = document.getElementById('perfil-edad');
  const elPais            = document.getElementById('perfil-pais');
  const elDeportesChips   = document.getElementById('perfil-deportes-chips');
  const elStatsDeportes   = document.getElementById('perfil-stats-deportes');
  const elPublicaciones   = document.getElementById('perfil-publicaciones');
  const elActividad       = document.getElementById('perfil-actividad');

  /* ---------- AVATARES MOCK ---------- */
  const AVATARES = Array.from({ length: 20 }, (_, i) => `https://i.pravatar.cc/150?img=${i + 1}`);

  /* =========================================================
     RENDER PRINCIPAL
     ========================================================= */
  function render() {
    const u = getSesion();
    if (!u) return;

    if (elAvatar) elAvatar.src = u.avatar || `https://i.pravatar.cc/150?u=${u.id}`;
    if (elNombre) elNombre.textContent = u.nombre;
    if (elUsername) elUsername.textContent = '@' + u.username;

    if (elBio) {
      elBio.textContent = u.bio || 'Sin biografía todavía.';
      elBio.style.fontStyle = u.bio ? 'normal' : 'italic';
    }

    if (elCiudad) {
      elCiudad.textContent = '📍 ' + (u.ciudad || 'Sin ciudad');
    }

    if (elEdad) {
      if (u.edad) {
        elEdad.textContent = '🎂 ' + u.edad + ' años';
        elEdad.style.display = '';
      } else {
        elEdad.style.display = 'none';
      }
    }

    if (elPais) {
      if (u.pais) {
        elPais.textContent = '🌎 ' + u.pais;
        elPais.style.display = '';
      } else {
        elPais.style.display = 'none';
      }
    }

    // Chips de deportes
    if (elDeportesChips) {
      const misDeportes = u.deportes || [];
      if (misDeportes.length === 0) {
        elDeportesChips.innerHTML = `
          <span class="badge badge--neutral">Sin deportes todavía</span>`;
      } else {
        elDeportesChips.innerHTML = misDeportes.map(d => {
          const icono = iconoDeporte(d.deporte);
          const posiciones = (d.posiciones || []).join(', ');
          return `
            <span class="badge badge--primary">
              ${icono} ${d.deporte}
            </span>
            ${posiciones ? `<span class="badge badge--info">🎯 ${posiciones}</span>` : ''}
          `;
        }).join('');
      }
    }

    // Stats por deporte
    if (elStatsDeportes) {
      renderStatsDeportes(u);
    }

    // Publicaciones
    if (elPublicaciones) {
      const misPubs = publicacionesDe(u.id);

      if (misPubs.length === 0) {
        elPublicaciones.innerHTML = `
          <div class="empty-state" style="padding:var(--space-5)">
            <div class="empty-state__icon" style="font-size:36px">📝</div>
            <p class="text-sm text-muted">Aún no has publicado nada</p>
            <a href="#/inicio" class="btn btn--primary btn--sm mt-4">Ir al inicio</a>
          </div>`;
      } else {
        elPublicaciones.innerHTML = misPubs.map(p => `
          <div class="feed-item" style="cursor:pointer" data-pub="${p.id}">
            <div style="font-size:24px">
              ${p.tipo === 'partido' ? '⚽' : p.tipo === 'torneo' ? '🏆' : p.tipo === 'grupo' ? '👥' : '📝'}
            </div>
            <div style="flex:1; min-width:0">
              <div class="feed-item__title">${(p.contenido || '').slice(0, 60)}${(p.contenido || '').length > 60 ? '...' : ''}</div>
              <div class="feed-item__subtitle">
                ${new Date(p.fecha).toLocaleDateString('es-CL')} · ❤️ ${p.likes || 0} · 💬 ${(p.comentarios || []).length}
              </div>
            </div>
            ${p.imagen ? `<img src="${p.imagen}" style="width:40px; height:40px; border-radius:var(--radius-sm); object-fit:cover" />` : ''}
            ${p.video ? `<div style="width:40px; height:40px; border-radius:var(--radius-sm); background:var(--color-primary-light); display:grid; place-items:center">🎥</div>` : ''}
          </div>
        `).join('');

        elPublicaciones.querySelectorAll('[data-pub]').forEach(el => {
          el.addEventListener('click', () => {
            window.location.hash = '#/inicio';
          });
        });
      }
    }

    // Actividad
    if (elActividad) {
      const misPartidos = getPartidos().filter(p =>
        p.organizador?.id === u.id || (p.inscritos || []).includes(u.id)
      );
      const recientes = misPartidos.slice(0, 3);

      if (recientes.length === 0) {
        elActividad.innerHTML = `
          <div class="empty-state" style="padding:var(--space-5)">
            <div class="empty-state__icon" style="font-size:36px">📭</div>
            <p class="text-sm text-muted">Sin actividad reciente</p>
          </div>`;
      } else {
        elActividad.innerHTML = recientes.map(p => `
          <div class="feed-item" style="cursor:pointer" data-partido="${p.id}">
            <div style="font-size:24px">${p.emoji}</div>
            <div style="flex:1; min-width:0">
              <div class="feed-item__title">${p.titulo}</div>
              <div class="feed-item__subtitle">
                ${p.organizador?.id === u.id ? '👑 Organizador' : '✅ Inscrito'} · ${p.deporte}
              </div>
            </div>
          </div>
        `).join('');

        elActividad.querySelectorAll('[data-partido]').forEach(el => {
          el.addEventListener('click', () => {
            window.location.hash = `#/partido/${el.dataset.partido}`;
          });
        });
      }
    }
  }

  /* ---------- Render de stats por deporte ---------- */
  function renderStatsDeportes(u) {
    const misDeportes = u.deportes || [];

    if (misDeportes.length === 0) {
      elStatsDeportes.innerHTML = `
        <div class="card mb-4">
          <h3 class="card__title mb-4">📊 Mis estadísticas</h3>
          <div class="empty-state" style="padding:var(--space-5)">
            <div class="empty-state__icon" style="font-size:36px">📊</div>
            <p class="text-sm text-muted">Agrega un deporte en tu perfil para llevar estadísticas</p>
          </div>
        </div>`;
      return;
    }

    elStatsDeportes.innerHTML = misDeportes.map(d => {
      const statsDisponibles = statsPorDeporte[d.deporte] || [];
      const statsUsuario = d.stats || {};
      const icono = iconoDeporte(d.deporte);

      const cargadas = statsDisponibles.filter(s => statsUsuario[s.clave]?.valor > 0);

      return `
        <div class="card mb-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="card__title" style="margin:0">
              ${icono} Estadísticas de ${d.deporte}
            </h3>
            <button class="btn btn--ghost btn--sm" data-editar-stats-deporte="${d.deporte}">
              ✏️ Editar
            </button>
          </div>

          ${cargadas.length === 0 ? `
            <div class="empty-state--sm">
              <div class="empty-state__icon">📊</div>
              <p class="text-sm text-muted">Sin registros cargados todavía</p>
            </div>
          ` : `
            <div class="stats-grid" style="grid-template-columns:repeat(auto-fit, minmax(120px, 1fr))">
              ${statsDisponibles.map(s => {
                const stat = statsUsuario[s.clave];
                if (!stat || !stat.valor) return '';

                const esPrivada = !stat.publico;
                return `
                  <div class="stat-box" style="position:relative">
                    <div class="stat-box__value">${stat.valor}</div>
                    <div class="stat-box__label">${s.nombre}</div>
                    ${esPrivada ? `
                      <span style="position:absolute; top:6px; right:6px; font-size:12px" title="Privado">🔒</span>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      `;
    }).join('');

    elStatsDeportes.querySelectorAll('[data-editar-stats-deporte]').forEach(btn => {
      btn.addEventListener('click', () => {
        abrirModalEditarStatsDeporte(btn.dataset.editarStatsDeporte);
      });
    });
  }

  /* ---------- Helper: icono por deporte ---------- */
  function iconoDeporte(deporte) {
    const map = {
      'Fútbol': 'assets/icons/balon-de-futbol (2).png', 'Básquetbol': 'assets/icons/balocensto.svg', 'Tenis': 'pelota-de-tenis.png', 'Vóleibol': 'assets/icons/voleibol.svg',
      'Pádel': 'assets/icons/raqueta-de-padel.png', 'Golf': 'assets/icons/golf.png', 'Béisbol': 'assets/icons/beisbol.png', 'Hockey': 'assets/icons/disco.png',
      'Boxeo': 'assets/icons/guantes-de-boxeo.png', 'Bádminton': 'assets/icons/volante.png', 'Rugby': 'assets/icons/rugby.png', 'Ciclismo': 'assets/icons/bicicleta.svg',
      'Natación': 'assets/icons/natacion.svg', 'Atletismo': 'assets/icons/corriendo.png', 'Tenis de mesa': 'assets/icons/raqueta-de-tenis-de-mesa.png',
      'Squash': 'assets/icons/tenis-de-squash.png', 'Handball': 'assets/icons/balonmano.png', 
      'Fútbol americano': 'assets/icons/deporte.svg', 'Surf': 'assets/icons/tabla-de-surf.png', 'Escalada': 'assets/icons/escalada.png'
    };
    const valor = map[deporte] || '🏅';
    if (/\.(svg|png|jpg|jpeg|gif|webp)$/i.test(valor)) {
      return `<img src="${valor}" alt="" style="width:20px;height:20px;object-fit:contain;vertical-align:middle;display:inline-block" />`;
    }
    return valor;
  }
    

  /* =========================================================
     MODAL EDITAR PERFIL
     ========================================================= */
  function abrirModalEditar() {
    const u = getSesion();
    if (!u) return;

    /* ---------- Precargar campos ---------- */
    document.getElementById('edit-perf-nombre').value = u.nombre || '';
    document.getElementById('edit-perf-username').value = u.username || '';
    document.getElementById('edit-perf-bio').value = u.bio || '';
    document.getElementById('edit-perf-ciudad').value = u.ciudad || '';

    // Edad
    const inputEdad = document.getElementById('edit-perf-edad');
    if (inputEdad) inputEdad.value = u.edad || '';

    // País
    const selPais = document.getElementById('edit-perf-pais');
    if (selPais) {
      selPais.innerHTML = '<option value="">Selecciona un país...</option>' +
        PAISES.map(p => `<option value="${p}" ${p === u.pais ? 'selected' : ''}>${p}</option>`).join('');
    }

    /* ---------- Preview del avatar ---------- */
    const previewAvatar = document.getElementById('edit-perf-avatar-preview');
    previewAvatar.src = u.avatar || `https://i.pravatar.cc/150?u=${u.id}`;

    let avatarSel = u.avatar || `https://i.pravatar.cc/150?u=${u.id}`;

    /* ---------- Galería de avatares ---------- */
    const contAv = document.getElementById('perfil-galeria-avatares');
    contAv.innerHTML = AVATARES.map(url => `
      <button type="button"
              class="posicion-chip ${url === u.avatar ? 'active' : ''}"
              data-avatar="${url}"
              style="padding:2px; background:transparent; border:none">
        <img src="${url}" alt="" style="width:40px; height:40px; border-radius:50%; display:block" />
      </button>
    `).join('');

    contAv.querySelectorAll('[data-avatar]').forEach(btn => {
      btn.addEventListener('click', () => {
        contAv.querySelectorAll('[data-avatar]').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--color-primary-light)';
        avatarSel = btn.dataset.avatar;
        previewAvatar.src = avatarSel;
      });
    });

    const activo = contAv.querySelector('.posicion-chip.active');
    if (activo) activo.style.background = 'var(--color-primary-light)';

    /* ---------- Subir foto propia ---------- */
    const inputAvatarFile = document.getElementById('edit-perf-avatar-file');
    if (inputAvatarFile) {
      inputAvatarFile.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          return toast('La imagen es muy grande (máx 2 MB)', 'error');
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          avatarSel = ev.target.result;
          previewAvatar.src = avatarSel;
          contAv.querySelectorAll('[data-avatar]').forEach(b => {
            b.classList.remove('active');
            b.style.background = 'transparent';
          });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
      };
    }

    /* ---------- Quitar foto ---------- */
    const btnQuitar = document.getElementById('edit-perf-avatar-quitar');
    if (btnQuitar) {
      btnQuitar.onclick = () => {
        avatarSel = `https://i.pravatar.cc/150?u=${u.id}`;
        previewAvatar.src = avatarSel;
        contAv.querySelectorAll('[data-avatar]').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
        });
      };
    }

    /* ---------- DEPORTES (multi) ---------- */
    let deportesActuales = JSON.parse(JSON.stringify(u.deportes || []));

    const selNuevoDeporte = document.getElementById('edit-perf-nuevo-deporte');
    const contDeportes = document.getElementById('edit-perf-deportes-lista');

    function refrescarSelectDeportes() {
      const elegidos = new Set(deportesActuales.map(d => d.deporte));
      selNuevoDeporte.innerHTML = '<option value="">Agregar deporte...</option>' +
        todosLosDeportes
          .filter(d => !elegidos.has(d))
          .map(d => `<option value="${d}">${iconoDeporte(d)} ${d}</option>`).join('');
    }

    function renderDeportesElegidos() {
      if (deportesActuales.length === 0) {
        contDeportes.innerHTML = `
          <div class="empty-state--sm">
            <div class="empty-state__icon">🏅</div>
            <p class="text-sm text-muted">Aún no agregaste deportes</p>
          </div>`;
        return;
      }

      contDeportes.innerHTML = deportesActuales.map((d, idx) => {
        const posicionesDisponibles = posicionesPorDeporte[d.deporte] || [];
        const tienePosiciones = posicionesDisponibles.length > 0;

        return `
          <div class="card" style="padding:var(--space-3); background:var(--color-surface-2); border:none">
            <div class="flex items-center justify-between mb-2">
              <div style="font-weight:700; font-size:var(--fs-sm)">
                ${iconoDeporte(d.deporte)} ${d.deporte}
              </div>
              <button class="btn btn--ghost btn--sm" data-quitar-deporte="${idx}" style="color:var(--color-danger)">
                ✕
              </button>
            </div>

            ${tienePosiciones ? `
              <div style="font-size:var(--fs-xs); color:var(--color-text-muted); margin-bottom:6px">
                Posiciones (opcional, varias):
              </div>
              <div class="posiciones-lista" style="padding:8px; gap:6px">
                ${posicionesDisponibles.map(p => `
                  <button type="button"
                          class="posicion-chip ${d.posiciones.includes(p) ? 'active' : ''}"
                          data-pos-idx="${idx}"
                          data-pos-nombre="${p}"
                          style="font-size:11px; padding:4px 10px">
                    ${p}
                  </button>
                `).join('')}
              </div>
            ` : `
              <p class="text-xs text-muted">Este deporte no tiene posiciones</p>
            `}
          </div>
        `;
      }).join('');

      // Quitar deporte
      contDeportes.querySelectorAll('[data-quitar-deporte]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.quitarDeporte);
          deportesActuales.splice(idx, 1);
          renderDeportesElegidos();
          refrescarSelectDeportes();
        });
      });

      // Toggle de posiciones
      contDeportes.querySelectorAll('[data-pos-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.posIdx);
          const pos = btn.dataset.posNombre;
          const lista = deportesActuales[idx].posiciones;

          if (lista.includes(pos)) {
            deportesActuales[idx].posiciones = lista.filter(p => p !== pos);
            btn.classList.remove('active');
          } else {
            lista.push(pos);
            btn.classList.add('active');
          }
        });
      });
    }

    renderDeportesElegidos();
    refrescarSelectDeportes();

    // Agregar deporte
    document.getElementById('edit-perf-add-deporte').onclick = () => {
      const dep = selNuevoDeporte.value;
      if (!dep) return;

      if (deportesActuales.some(d => d.deporte === dep)) {
        return toast('Ese deporte ya está agregado', 'error');
      }

      deportesActuales.push({
        deporte: dep,
        posiciones: [],
        stats: {}
      });

      renderDeportesElegidos();
      refrescarSelectDeportes();
    };

    /* ---------- Guardar ---------- */
    document.getElementById('btn-guardar-perfil').onclick = () => {
      const nombre = document.getElementById('edit-perf-nombre').value.trim();
      const username = document.getElementById('edit-perf-username').value.trim();
      const bio = document.getElementById('edit-perf-bio').value.trim();
      const ciudad = document.getElementById('edit-perf-ciudad').value.trim();
      const edad = Number(document.getElementById('edit-perf-edad').value) || null;
      const pais = document.getElementById('edit-perf-pais').value;

      if (!nombre) return toast('El nombre no puede estar vacío', 'error');
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return toast('El usuario debe tener 3-20 caracteres (letras, números, _)', 'error');
      }

      // 🔥 Leer sesión ACTUAL para no perder deportes agregados
      const usuarioActual = getSesion();
      const deportesPrevios = usuarioActual.deportes || [];

      // Construir array final preservando stats existentes
      const deportesFinales = deportesActuales.map(d => {
        const anterior = deportesPrevios.find(x => x.deporte === d.deporte);
        return {
          deporte: d.deporte,
          posiciones: d.posiciones || [],
          stats: anterior?.stats || {}
        };
      });

      console.log('[perfil] Guardando deportes:', deportesFinales.map(d => d.deporte));

      actualizarUsuario(usuarioActual.id, {
        nombre,
        username,
        bio,
        ciudad,
        edad,
        pais,
        avatar: avatarSel,
        deportes: deportesFinales
      });

      cerrarModal('modal-editar-perfil');
      toast('Perfil actualizado', 'success');
      setTimeout(() => render(), 100);
    };

    /* ---------- Cerrar ---------- */
    document.querySelectorAll('#modal-editar-perfil [data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-editar-perfil');
    });
    document.getElementById('modal-editar-perfil').onclick = (e) => {
      if (e.target.id === 'modal-editar-perfil') cerrarModal('modal-editar-perfil');
    };

    abrirModal('modal-editar-perfil');
  }

  /* =========================================================
     MODAL EDITAR STATS DE UN DEPORTE
     ========================================================= */
  function abrirModalEditarStatsDeporte(nombreDeporte) {
    const u = getSesion();
    if (!u) return;

    const deporteData = (u.deportes || []).find(d => d.deporte === nombreDeporte);
    if (!deporteData) {
      console.warn('[stats] No se encontró el deporte:', nombreDeporte);
      return;
    }

    const statsDisponibles = statsPorDeporte[nombreDeporte] || [];
    const statsUsuario = deporteData.stats || {};

    document.getElementById('stats-deporte-titulo').textContent =
      `📊 Stats de ${nombreDeporte}`;

    const contenedor = document.getElementById('stats-deporte-campos');

    if (statsDisponibles.length === 0) {
      contenedor.innerHTML = `
        <p class="text-sm text-muted text-center" style="padding:var(--space-5)">
          Este deporte no tiene estadísticas disponibles
        </p>`;
    } else {
      contenedor.innerHTML = statsDisponibles.map(s => {
        const stat = statsUsuario[s.clave] || { valor: 0, publico: false };
        return `
          <div class="field">
            <div class="flex items-center justify-between mb-2">
              <label class="field__label" style="margin:0" for="stat-${s.clave}">
                ${s.nombre}
              </label>
              <label class="switch" style="margin:0">
                <input type="checkbox" id="stat-publico-${s.clave}" ${stat.publico ? 'checked' : ''} />
                <span class="switch__slider"></span>
                <div>
                  <div class="switch__label" style="font-size:11px">Público</div>
                </div>
              </label>
            </div>
            <input type="number" id="stat-${s.clave}" class="field__input" min="0" value="${stat.valor || 0}" />
          </div>
        `;
      }).join('');
    }

    document.getElementById('btn-guardar-stats-deporte').onclick = () => {
      const nuevasStats = {};

      statsDisponibles.forEach(s => {
        const inputValor = document.getElementById(`stat-${s.clave}`);
        const chkPublico = document.getElementById(`stat-publico-${s.clave}`);
        if (!inputValor) return;

        nuevasStats[s.clave] = {
          valor: Math.max(0, Number(inputValor.value) || 0),
          publico: chkPublico?.checked || false
        };
      });

      // 🔥 Leer sesión ACTUAL y modificar SOLO el deporte que estamos editando
      const usuarioActual = getSesion();
      const deportesActuales = usuarioActual.deportes || [];

      const deportesActualizados = deportesActuales.map(d =>
        d.deporte === nombreDeporte
          ? { ...d, stats: nuevasStats }
          : d
      );

      console.log('[stats] Guardando:', nombreDeporte);
      console.log('[stats] Total deportes:', deportesActualizados.map(d => d.deporte));

      actualizarUsuario(usuarioActual.id, { deportes: deportesActualizados });

      cerrarModal('modal-editar-stats-deporte');
      toast(`Stats de ${nombreDeporte} actualizadas`, 'success');
      setTimeout(() => render(), 100);
    };

    document.querySelectorAll('#modal-editar-stats-deporte [data-cerrar-modal]').forEach(btn => {
      btn.onclick = () => cerrarModal('modal-editar-stats-deporte');
    });
    document.getElementById('modal-editar-stats-deporte').onclick = (e) => {
      if (e.target.id === 'modal-editar-stats-deporte') cerrarModal('modal-editar-stats-deporte');
    };

    abrirModal('modal-editar-stats-deporte');
  }

  /* =========================================================
     CONECTAR BOTONES
     ========================================================= */
  document.getElementById('btn-editar-perfil')?.addEventListener('click', abrirModalEditar);

  /* =========================================================
     INIT
     ========================================================= */
  render();

  return null;
}