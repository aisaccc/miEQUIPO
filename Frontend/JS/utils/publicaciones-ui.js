import { toast, abrirModal, cerrarModal, abrirModalVerPublicacion } from '../components.js';
import { getSesion } from '../auth.js';
import { ICONOS } from './iconos.js';
import {
  crearPublicacion,
  crearPublicacionEnGrupo,
  crearPublicacionEnTorneo,
  editarPublicacion,
  editarPrivacidadPublicacion,
  eliminarPublicacion,
  toggleLike
} from '../services/publicaciones.service.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function fechaRelativa(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const ahora = new Date();
  const dif = Math.floor((ahora - d) / 1000);
  if (dif < 60) return 'ahora';
  if (dif < 3600) return `hace ${Math.floor(dif / 60)} min`;
  if (dif < 86400) return `hace ${Math.floor(dif / 3600)} h`;
  if (dif < 604800) return `hace ${Math.floor(dif / 86400)} d`;
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function renderContextIcon(icon) {
  if (!icon) return ICONOS.escudo;
  if (typeof icon === 'string' && /\.(svg|png|jpg|jpeg|gif|webp)$/i.test(icon)) {
    return `<img src="${icon}" alt="" style="width:16px;height:16px;object-fit:contain;border-radius:50%;" />`;
  }
  return icon;
}

/* =========================================================
   RENDER FEED TIPO FACEBOOK
   ========================================================= */
export function renderFeedPublicaciones(contenedor, publicaciones, { onRefrescar = null } = {}) {
  if (!contenedor) return;
  const user = getSesion();

  if (publicaciones.length === 0) {
    contenedor.innerHTML = `
      <div class="feed-empty">
        <div class="feed-empty__icon">${ICONOS.carpeta}</div>
        <div class="feed-empty__titulo">Aún no hay publicaciones</div>
        <div class="feed-empty__text">Sé el primero en compartir algo.</div>
      </div>`;
    return;
  }

  contenedor.innerHTML = publicaciones.map(p => {
    const fechaTxt = fechaRelativa(p.createdAt);
    const puedeEditar = String(p.autor?.id) === String(user?.id);

    const contextoHtml = p.scope === 'torneo' && p.torneo ? `
      <a class="feed-post__contexto" href="#/torneo/${p.torneo.id}">
        <span class="feed-post__contexto-emoji">${renderContextIcon(p.torneo.emoji)}</span>
        <span class="feed-post__contexto-texto">Publicado en <strong>${escapeHtml(p.torneo.nombre)}</strong></span>
      </a>
    ` : p.scope === 'grupo' && p.grupo ? `
      <a class="feed-post__contexto" href="#/mi-equipo">
        <span class="feed-post__contexto-emoji">${renderContextIcon(p.grupo.escudo)}</span>
        <span class="feed-post__contexto-texto">Publicado en <strong>${escapeHtml(p.grupo.nombre)}</strong></span>
      </a>
    ` : '';

    // ⚡ Iconos de privacidad minimalistas
    let privacidadHtml = '';
    if (p.scope === 'perfil') {
      if (p.privacidad === 'amigos') privacidadHtml = `<span title="Solo amigos" style="display:inline-flex;vertical-align:middle;margin-top:-2px;width:14px;height:14px;color:var(--color-text-muted)">${ICONOS.usuarios}</span>`;
      if (p.privacidad === 'privado') privacidadHtml = `<span title="Privado" style="display:inline-flex;vertical-align:middle;margin-top:-2px;width:14px;height:14px;color:var(--color-text-muted)">${ICONOS.candado}</span>`;
    } else if (p.scope === 'grupo' && p.grupo?.tipo === 'equipo') {
      if (p.privacidad === 'miembros') privacidadHtml = `<span title="Miembros del equipo" style="display:inline-flex;vertical-align:middle;margin-top:-2px;width:14px;height:14px;color:var(--color-text-muted)">${ICONOS.usuarios}</span>`;
      if (p.privacidad === 'staff') privacidadHtml = `<span title="Staff del equipo" style="display:inline-flex;vertical-align:middle;margin-top:-2px;width:14px;height:14px;color:var(--color-text-muted)">${ICONOS.corona}</span>`;
    } else if (p.scope === 'torneo') {
      if (p.privacidad === 'miembros') privacidadHtml = `<span title="Participantes del torneo" style="display:inline-flex;vertical-align:middle;margin-top:-2px;width:14px;height:14px;color:var(--color-text-muted)">${ICONOS.usuarios}</span>`;
    }

    // ⚡ MEDIA: Adaptado para múltiples fotos (Array JSON) o foto única
    let mediaHtml = '';
    if (p.video) {
      mediaHtml = `<div class="feed-post__media"><video src="${p.video}" controls></video></div>`;
    } else if (p.imagen) {
      try {
        const arr = JSON.parse(p.imagen);
        if (Array.isArray(arr) && arr.length > 0) {
          mediaHtml = `<div class="feed-post__media feed-post__media--multi">${arr.map(img => `<img src="${img}" alt="" loading="lazy" data-ver-foto="${img}" style="cursor:zoom-in" />`).join('')}</div>`;
        } else {
           mediaHtml = `<div class="feed-post__media"><img src="${p.imagen}" alt="" loading="lazy" data-ver-foto="${p.imagen}" style="cursor:zoom-in" /></div>`;
        }
      } catch (e) {
        // Retrocompatibilidad: Si falla el JSON.parse, es un string de Base64 antiguo
        mediaHtml = `<div class="feed-post__media"><img src="${p.imagen}" alt="" loading="lazy" data-ver-foto="${p.imagen}" style="cursor:zoom-in" /></div>`;
      }
    }

    // ⚡ Verificamos si es pública para mostrar el botón de compartir
    const esPublica = p.privacidad === 'publico' || p.privacidad === undefined;

    return `
      <article class="feed-post" data-pub-id="${p.id}">
        <div class="feed-post__header">
          <img class="feed-post__avatar" src="${p.autor?.avatar || 'assets/icons/usuario.svg'}" alt="" data-autor-id="${p.autor?.id}" style="cursor:pointer" />
          <div class="feed-post__autor">
            <div class="feed-post__nombre" data-autor-id="${p.autor?.id}" style="cursor:pointer">${escapeHtml(p.autor?.nombre || 'Usuario')}</div>
            ${(() => {
              // Determinamos el tipo de contexto (Amigo, Equipo, Torneo, etc.)
              let tipoContexto = 'Amigo';
              let iconoContexto = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-top:-2px;margin-right:3px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

              if (p.scope === 'grupo') {
                tipoContexto = p.grupo?.tipo === 'comunidad' ? 'Comunidad' : 'Equipo';
                iconoContexto = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-top:-2px;margin-right:3px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
              } else if (p.scope === 'torneo') {
                tipoContexto = 'Torneo';
                iconoContexto = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-top:-2px;margin-right:3px"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`;
              }

              return `<div class="feed-post__meta">${fechaTxt} · ${iconoContexto} ${tipoContexto} ${privacidadHtml}</div>`;
            })()}
          </div>
          ${puedeEditar ? `<button class="feed-post__menu" data-menu-feed="${p.id}"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>` : ''}
        </div>

        ${contextoHtml}
        ${p.contenido ? `<div class="feed-post__contenido">${escapeHtml(p.contenido)}</div>` : ''}
        ${mediaHtml}

        <div class="feed-post__acciones">
          <button class="feed-post__btn ${p.yoLikee ? 'feed-post__btn--activo' : ''}" data-like="${p.id}" title="Me gusta">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="${p.yoLikee ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span class="feed-post__btn-count">${p.totalLikes || 0}</span>
          </button>

          <button class="feed-post__btn" data-ver-pub="${p.id}" title="Comentar">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span class="feed-post__btn-count">${p.totalComentarios || 0}</span>
          </button>

          ${esPublica ? `
          <button class="feed-post__btn" data-share="${p.id}" title="Compartir">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
          ` : ''}
        </div>
      </article>
    `;
  }).join('');

  contenedor.querySelectorAll('[data-autor-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      import('../components.js').then(({ verPerfilUsuario }) => verPerfilUsuario(el.dataset.autorId));
    });
  });

  contenedor.querySelectorAll('[data-like]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.like;
      try {
        const res = await toggleLike(id);
        const pub = publicaciones.find(p => String(p.id) === String(id));
        if (pub) {
          pub.yoLikee = res.yoLikee;
          pub.totalLikes = Math.max(0, (pub.totalLikes || 0) + (res.yoLikee ? 1 : -1));
        }
        btn.classList.toggle('feed-post__btn--activo', res.yoLikee);
        btn.querySelector('svg').setAttribute('fill', res.yoLikee ? 'currentColor' : 'none');
        const count = btn.querySelector('.feed-post__btn-count');
        if (count && pub) count.textContent = pub.totalLikes;
      } catch (err) {
        toast(err.message || 'No se pudo dar like', 'error');
      }
    });
  });

  contenedor.querySelectorAll('[data-ver-pub]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      abrirModalVerPublicacion(btn.dataset.verPub, publicaciones);
    });
  });

  // ⚡ NUEVO: Lógica para compartir
  contenedor.querySelectorAll('[data-share]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.share;
      const pub = publicaciones.find(p => String(p.id) === String(id));
      if (!pub) return;

      const appUrl = window.location.origin + window.location.pathname + '#/inicio';
      const text = pub.contenido ? `"${pub.contenido}" - Publicado por ${pub.autor?.nombre} en MiEquipo` : `Publicación de ${pub.autor?.nombre} en MiEquipo`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: 'MiEquipo',
            text: text,
            url: appUrl
          });
        } catch (err) {
          console.warn('Error al compartir', err);
        }
      } else {
        try {
          await navigator.clipboard.writeText(`${text}\n\nVer en: ${appUrl}`);
          toast('Enlace copiado al portapapeles', 'success');
        } catch (err) {
          toast('No se pudo copiar el enlace', 'error');
        }
      }
    });
  });

  // ⚡ NUEVO: Abrir foto en grande
  contenedor.querySelectorAll('[data-ver-foto]').forEach(img => {
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      const modalImg = document.getElementById('modal-imagen-img');
      if (modalImg) {
        modalImg.src = img.dataset.verFoto;
        abrirModal('modal-ver-imagen');
      }
    });
  });

  contenedor.querySelectorAll('.feed-post').forEach(card => {
    card.addEventListener('click', (e) => {
      // ⚡ Excluimos clicks en botones, contexto y foto
      if (
        e.target.closest('[data-like]') || 
        e.target.closest('[data-ver-pub]') || 
        e.target.closest('[data-menu-feed]') || 
        e.target.closest('[data-autor-id]') || 
        e.target.closest('.feed-post__contexto') || 
        e.target.closest('[data-share]') ||
        e.target.closest('[data-ver-foto]') // ⚡ Importante
      ) return;
      
      abrirModalVerPublicacion(card.dataset.pubId, publicaciones);
    });
  });

  contenedor.querySelectorAll('[data-menu-feed]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      abrirMenuPublicacion(btn.dataset.menuFeed, btn, { publicacionesCache: publicaciones, onRefrescar });
    });
  });
}

/* =========================================================
   MODAL CREAR PUBLICACIÓN CON SELECTOR DE TIPO
   ========================================================= */
let mediaBase64Crear = []; // ⚡ AHORA ES UN ARRAY
let tipoMediaCrear = null;
let privacidadCrear = 'publico';

export function abrirModalCrearPublicacionCompartido(scope, refId, onRefrescar, opciones = {}) {
  const textareaCont = document.getElementById('crear-pub-contenido');
  if (!textareaCont) return toast('Error interno: falta el modal', 'error');

  let tipoPublicacion = opciones.tipo || 'post';
  const esComunidad = opciones.esComunidad === true;
  
  mediaBase64Crear = []; tipoMediaCrear = null;
  privacidadCrear = 'publico';

  textareaCont.value = '';
  document.getElementById('crear-pub-preview-wrapper').classList.add('hidden');
  document.getElementById('crear-pub-preview-img').src = '';
  document.getElementById('crear-pub-imagen-file').value = '';
  document.getElementById('crear-pub-label-imagen').classList.remove('hidden');

  // ⚡ SELECTOR DE TIPO (Publicación / Partido / Torneo / Grupo)
  const selector = document.getElementById('crear-pub-tipo-selector');
  const btnPublicar = document.getElementById('btn-publicar');
  const textareaWrapper = textareaCont.parentElement;
  const imagenWrapper = document.getElementById('crear-pub-label-imagen').parentElement;
  let avisoRedir = document.getElementById('aviso-redireccion');

  if (selector) {
    selector.querySelectorAll('[data-tipo-pub]').forEach(btn => {
      btn.classList.toggle('subtab--active', btn.dataset.tipoPub === tipoPublicacion);
      btn.onclick = () => {
        selector.querySelectorAll('[data-tipo-pub]').forEach(b => b.classList.remove('subtab--active'));
        btn.classList.add('subtab--active');
        tipoPublicacion = btn.dataset.tipoPub;
        
        if (tipoPublicacion !== 'post') {
          textareaWrapper.classList.add('hidden');
          imagenWrapper.classList.add('hidden');
          
          if (!avisoRedir) {
            avisoRedir = document.createElement('div');
            avisoRedir.id = 'aviso-redireccion';
            avisoRedir.className = 'aviso-aprobacion show mb-4';
            document.getElementById('modal-crear-publicacion').querySelector('.modal__body').prepend(avisoRedir);
          }
          avisoRedir.style.display = 'flex';
          avisoRedir.innerHTML = `<span class="aviso-aprobacion__icon">ℹ️</span><div>Al presionar el botón, serás redirigido para crear un <strong>${tipoPublicacion}</strong>.</div>`;
          
          btnPublicar.textContent = `Ir a ${tipoPublicacion.charAt(0).toUpperCase() + tipoPublicacion.slice(1)}`;
        } else {
          textareaWrapper.classList.remove('hidden');
          imagenWrapper.classList.remove('hidden');
          if (avisoRedir) avisoRedir.style.display = 'none';
          btnPublicar.textContent = 'Publicar';
        }
      };
    });
    // Forzar el estado inicial
    selector.querySelector(`[data-tipo-pub="${tipoPublicacion}"]`)?.click();
  }

  // ⚡ INYECTAR SELECTOR DE PRIVACIDAD
  let privCont = document.getElementById('crear-pub-privacidad-container');
  if (!privCont) {
    privCont = document.createElement('div');
    privCont.id = 'crear-pub-privacidad-container';
    privCont.style.cssText = 'margin-bottom: 16px; padding: 12px; background: var(--color-surface-2); border-radius: var(--radius-md);';
    textareaCont.parentElement.appendChild(privCont);
  }

  let opcionesPrivacidad = [];
  
  if (scope === 'perfil') {
    opcionesPrivacidad = [
      { valor: 'publico', icono: ICONOS.globo, label: 'Público', desc: 'Todos' },
      { valor: 'amigos', icono: ICONOS.usuarios, label: 'Amigos', desc: 'Solo amigos' },
      { valor: 'privado', icono: ICONOS.candado, label: 'Privado', desc: 'Solo tú' }
    ];
  } else if (scope === 'grupo' && !esComunidad) {
    opcionesPrivacidad = [
      { valor: 'publico', icono: ICONOS.globo, label: 'Público', desc: 'Todos' },
      { valor: 'miembros', icono: ICONOS.usuarios, label: 'Miembros', desc: 'Del equipo' },
      { valor: 'staff', icono: ICONOS.corona, label: 'Staff', desc: 'Capitanes' }
    ];
  } else if (scope === 'torneo') {
    opcionesPrivacidad = [
      { valor: 'publico', icono: ICONOS.globo, label: 'Público', desc: 'Todos' },
      { valor: 'miembros', icono: ICONOS.usuarios, label: 'Participantes', desc: 'Del torneo' }
    ];
  }

  if (esComunidad) {
    privCont.innerHTML = `
      <p class="text-xs text-muted" style="margin:0; display:flex; align-items:center; gap:6px;">
        ${ICONOS.globo} Esta publicación será visible según la privacidad de la comunidad.
      </p>
    `;
  } else {
    privCont.innerHTML = `
      <div style="font-size:var(--fs-sm); font-weight:600; margin-bottom:8px;">¿Quién puede verla?</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        ${opcionesPrivacidad.map(op => `
          <button type="button" class="btn ${privacidadCrear === op.valor ? 'btn--primary' : 'btn--ghost'}" 
                  data-priv="${op.valor}" style="flex:1; display:flex; flex-direction:column; align-items:center; padding:10px;">
            <span style="width:20px; height:20px; margin-bottom:4px;">${op.icono}</span>
            <span style="font-size:12px; font-weight:700">${op.label}</span>
          </button>
        `).join('')}
      </div>
    `;

    privCont.querySelectorAll('[data-priv]').forEach(btn => {
      btn.onclick = () => {
        privCont.querySelectorAll('[data-priv]').forEach(b => {
          b.classList.remove('btn--primary');
          b.classList.add('btn--ghost');
        });
        btn.classList.remove('btn--ghost');
        btn.classList.add('btn--primary');
        privacidadCrear = btn.dataset.priv;
      };
    });
  }
    // ⚡ Aviso de límite de fotos (solo perfil y grupo, no torneo)
  let avisoLimite = document.getElementById('crear-pub-aviso-limite');
  if (!avisoLimite) {
    avisoLimite = document.createElement('div');
    avisoLimite.id = 'crear-pub-aviso-limite';
    avisoLimite.style.cssText = 'margin-bottom:12px; padding:10px 12px; background: var(--color-primary-light); border-radius:8px; font-size:12px; color: var(--color-primary-dark); font-weight:600; display:none;';
    document.getElementById('crear-pub-label-imagen').parentElement.prepend(avisoLimite);
  }
  avisoLimite.style.display = 'none';

  const sesion = getSesion();
  if (!sesion?.esPremium && tipoPublicacion === 'post') {
    if (scope === 'perfil') {
      avisoLimite.innerHTML = `ℹ️ Plan Básico: máximo 3 fotos por ciclo de 30 días.`;
      avisoLimite.style.display = 'block';
    } else if (scope === 'grupo' && !esComunidad) {
      avisoLimite.innerHTML = `ℹ️ Si el dueño del equipo es Básico, el grupo tiene un tope de 4 fotos en total.`;
      avisoLimite.style.display = 'block';
    }
  }

  // ⚡ LÓGICA PARA MÚLTIPLES IMÁGENES
  document.getElementById('crear-pub-imagen-file').onchange = (e) => {
    const files = Array.from(e.target.files).slice(0, 3); // Máximo 3
    if (files.length === 0) return;
    
    mediaBase64Crear = [];
    let procesadas = 0;

    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast(`La foto ${file.name} es muy grande (máx 5MB)`, 'error');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        mediaBase64Crear.push(ev.target.result);
        procesadas++;
        
        if (procesadas === files.length) {
          tipoMediaCrear = 'imagen';
          const imgPreview = document.getElementById('crear-pub-preview-img');
          imgPreview.src = mediaBase64Crear[0]; // Mostramos la primera
          
          document.getElementById('crear-pub-preview-wrapper').classList.remove('hidden');
          document.getElementById('crear-pub-label-imagen').classList.add('hidden');
        }
      };
      reader.readAsDataURL(file);
    });
  };

  document.getElementById('crear-pub-quitar-imagen').onclick = () => {
    mediaBase64Crear = []; tipoMediaCrear = null;
    document.getElementById('crear-pub-preview-wrapper').classList.add('hidden');
    document.getElementById('crear-pub-preview-img').src = '';
    document.getElementById('crear-pub-imagen-file').value = '';
    document.getElementById('crear-pub-label-imagen').classList.remove('hidden');
  };

  document.getElementById('btn-publicar').onclick = async () => {
    // ⚡ Validación de redirección según el tipo
    if (tipoPublicacion === 'partido') {
      cerrarModal('modal-crear-publicacion');
      window.location.hash = '#/partidos';
      return toast('Ve a la sección Partidos para crear uno nuevo', 'info');
    } else if (tipoPublicacion === 'torneo') {
      cerrarModal('modal-crear-publicacion');
      window.location.hash = '#/torneos';
      return toast('Ve a la sección Torneos para crear uno nuevo', 'info');
    } else if (tipoPublicacion === 'grupo') {
      cerrarModal('modal-crear-publicacion');
      window.location.hash = '#/mi-equipo';
      return toast('Ve a Mi Equipo para crear un nuevo grupo', 'info');
    }

    const contenido = document.getElementById('crear-pub-contenido').value.trim();

    if (!contenido && mediaBase64Crear.length === 0) {
      return toast('Escribe algo o subí un archivo', 'error');
    }

    const btn = document.getElementById('btn-publicar');
    btn.disabled = true; btn.textContent = 'Publicando...';

    try {
      const datos = { contenido: contenido || null, tipo: 'post', privacidad: privacidadCrear };
      
      // ⚡ Guardamos como JSON string para la base de datos
      if (mediaBase64Crear.length > 0) {
        datos.imagen = JSON.stringify(mediaBase64Crear); 
      }

      if (scope === 'grupo') await crearPublicacionEnGrupo(refId, datos);
      else if (scope === 'torneo') await crearPublicacionEnTorneo(refId, datos);
      else await crearPublicacion(datos);

      cerrarModal('modal-crear-publicacion');
      toast('Publicación creada', 'success');
      if (onRefrescar) await onRefrescar();
    } catch (err) {
      toast(err.message || 'No se pudo publicar', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Publicar';
    }
  };

  document.querySelectorAll('#modal-crear-publicacion [data-cerrar-modal]').forEach(btn => btn.onclick = () => cerrarModal('modal-crear-publicacion'));
  document.getElementById('modal-crear-publicacion').onclick = (e) => { if (e.target.id === 'modal-crear-publicacion') cerrarModal('modal-crear-publicacion'); };

  abrirModal('modal-crear-publicacion');
}

/* =========================================================
   MENÚ ⋯ y EDITAR PUBLICACIÓN
   ========================================================= */
export function abrirMenuPublicacion(pubId, btn, { publicacionesCache = [], esStaffDelGrupo = false, onRefrescar } = {}) {
  cerrarMenuPublicacion();
  const pub = publicacionesCache.find(p => String(p.id) === String(pubId));
  const user = getSesion();

  const esAutor = pub && String(pub.autor?.id) === String(user?.id);
  const esGrupo = pub?.scope === 'grupo';
  const puedeEditarContenido = esAutor;
  const puedeEditarPrivacidad = esGrupo ? (esAutor || esStaffDelGrupo) : esAutor;
  const puedeBorrar = esAutor || (esGrupo && esStaffDelGrupo);

  const items = [];
  if (puedeEditarContenido) items.push(`<button class="pub-menu__item" data-menu-item="editar"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Editar descripción</button>`);
  if (puedeEditarPrivacidad) items.push(`<button class="pub-menu__item" data-menu-item="privacidad"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Cambiar visibilidad</button>`);
  if (puedeBorrar) items.push(`<button class="pub-menu__item pub-menu__item--danger" data-menu-item="borrar"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg> Borrar publicación</button>`);
  if (items.length === 0) return;

  const menu = document.createElement('div');
  menu.className = 'pub-menu';
  menu.innerHTML = items.join('');
  document.body.appendChild(menu);

  const rect = btn.getBoundingClientRect();
  menu.style.position = 'fixed'; menu.style.top = `${rect.bottom + 6}px`; menu.style.left = `${rect.right - 200}px`; menu.style.zIndex = '1000';

  menu.querySelector('[data-menu-item="editar"]')?.addEventListener('click', (e) => {
    e.stopPropagation(); cerrarMenuPublicacion();
    abrirModalEditarPublicacion(pubId, { publicacionesCache, esStaffDelGrupo, onRefrescar });
  });
  menu.querySelector('[data-menu-item="privacidad"]')?.addEventListener('click', (e) => {
    e.stopPropagation(); cerrarMenuPublicacion();
    abrirModalEditarPublicacion(pubId, { publicacionesCache, esStaffDelGrupo, onRefrescar });
  });
  menu.querySelector('[data-menu-item="borrar"]')?.addEventListener('click', async (e) => {
    e.stopPropagation(); cerrarMenuPublicacion();
    if (!confirm('¿Borrar esta publicación? No se puede deshacer.')) return;
    try { await eliminarPublicacion(pubId); toast('Publicación borrada', 'info'); if (onRefrescar) await onRefrescar(); } catch (err) { toast(err.message || 'No se pudo borrar', 'error'); }
  });

  setTimeout(() => document.addEventListener('click', cerrarMenuPublicacion, { once: true }), 10);
}

export function cerrarMenuPublicacion() {
  document.querySelectorAll('.pub-menu').forEach(m => m.remove());
}

export function abrirModalEditarPublicacion(pubId, { publicacionesCache = [], esStaffDelGrupo = false, onRefrescar } = {}) {
  const pub = publicacionesCache.find(p => String(p.id) === String(pubId));
  const textarea = document.getElementById('editar-pub-contenido');
  if (!textarea) return toast('Error interno: falta el modal', 'error');

  const user = getSesion();
  const esAutor = pub && String(pub.autor?.id) === String(user?.id);
  const esGrupo = pub?.scope === 'grupo';
  const puedeEditarContenido = esAutor;
  const puedeEditarPrivacidad = esGrupo ? (esAutor || esStaffDelGrupo) : esAutor;

  if (!puedeEditarContenido && !puedeEditarPrivacidad) return toast('No tienes permiso', 'error');

  textarea.value = pub?.contenido || '';
  const textareaWrapper = textarea.closest('.field');
  if (textareaWrapper) textareaWrapper.classList.toggle('hidden', !puedeEditarContenido);
  textarea.disabled = !puedeEditarContenido;

  const wrapperPriv = document.getElementById('editar-pub-privacidad-wrapper');
  const gridPriv = document.getElementById('editar-pub-privacidad-grid');
  let privacidadSeleccionada = pub?.privacidad || 'publico';

  if (wrapperPriv && gridPriv) {
    if (puedeEditarPrivacidad) {
      wrapperPriv.classList.remove('hidden');
      
      let opciones = [];
      if (pub.scope === 'perfil') {
        opciones = [
          { val: 'publico', label: 'Público', desc: 'Todos', icono: ICONOS.globo },
          { val: 'amigos', label: 'Amigos', desc: 'Solo amigos', icono: ICONOS.usuarios },
          { val: 'privado', label: 'Privado', desc: 'Solo tú', icono: ICONOS.candado }
        ];
      } else if (pub.scope === 'torneo') {
        opciones = [
          { val: 'publico', label: 'Público', desc: 'Todos', icono: ICONOS.globo },
          { val: 'miembros', label: 'Participantes', desc: 'Del torneo', icono: ICONOS.usuarios }
        ];
      } else {
        opciones = [
          { val: 'publico', label: 'Público', desc: 'Todos', icono: ICONOS.globo },
          { val: 'miembros', label: 'Miembros', desc: 'Del equipo', icono: ICONOS.usuarios },
          { val: 'staff', label: 'Staff', desc: 'Capitanes', icono: ICONOS.corona }
        ];
      }

      gridPriv.innerHTML = opciones.map(op => `
        <div class="privacidad-opcion ${privacidadSeleccionada === op.val ? 'active' : ''}" data-privacidad="${op.val}">
          <div class="privacidad-opcion__icono" style="width:20px; height:20px; margin-bottom:4px;">${op.icono}</div>
          <div class="privacidad-opcion__label">${op.label}</div>
          <div class="privacidad-opcion__desc">${op.desc}</div>
        </div>
      `).join('');

      gridPriv.querySelectorAll('[data-privacidad]').forEach(op => {
        op.classList.toggle('active', op.dataset.privacidad === privacidadSeleccionada);
        op.onclick = () => {
          gridPriv.querySelectorAll('[data-privacidad]').forEach(o => o.classList.remove('active'));
          op.classList.add('active');
          privacidadSeleccionada = op.dataset.privacidad;
        };
      });
    } else {
      wrapperPriv.classList.add('hidden');
    }
  }

  const btn = document.getElementById('btn-guardar-edicion-pub');
  btn.disabled = false; btn.textContent = 'Guardar';

  btn.onclick = async () => {
    const contenido = puedeEditarContenido ? document.getElementById('editar-pub-contenido').value.trim() : null;
    btn.disabled = true; btn.textContent = 'Guardando...';

    try {
      if (puedeEditarContenido && contenido !== (pub?.contenido || '')) {
        await editarPublicacion(pubId, { contenido: contenido || null });
      }
      if (puedeEditarPrivacidad && privacidadSeleccionada !== (pub?.privacidad || 'publico')) {
        await editarPrivacidadPublicacion(pubId, privacidadSeleccionada);
      }
      cerrarModal('modal-editar-publicacion'); toast('Publicación actualizada', 'success');
      if (onRefrescar) await onRefrescar();
    } catch (err) {
      toast(err.message || 'No se pudo actualizar', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Guardar';
    }
  };

  document.querySelectorAll('#modal-editar-publicacion [data-cerrar-modal]').forEach(b => b.onclick = () => cerrarModal('modal-editar-publicacion'));
  document.getElementById('modal-editar-publicacion').onclick = (e) => { if (e.target.id === 'modal-editar-publicacion') cerrarModal('modal-editar-publicacion'); };

  abrirModal('modal-editar-publicacion');
}