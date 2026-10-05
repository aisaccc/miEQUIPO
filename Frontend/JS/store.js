import { mismoId, incluyeId, filtrarPorId, indicePorId } from './utils/id.js';

const KEY_PARTIDOS = 'miejquipo_partidos';
const KEY_NOTIFS   = 'miejquipo_notificaciones';
const KEY_EQUIPOS  = 'miejquipo_equipos';

/* =========================================================
   PARTIDOS
   ========================================================= */

export function getPartidos() {
  const raw = localStorage.getItem(KEY_PARTIDOS);
  if (raw) {
    const lista = JSON.parse(raw);

    // Migración: agregar tipoPartido a partidos viejos + normalizar
    const migrados = lista.map(p => {
      const cambios = {};

      // Amateur → amistoso
      if (p.nivel === 'amateur') cambios.nivel = 'amistoso';

      // tipoPartido por defecto: 'jugador'
      if (!p.tipoPartido) cambios.tipoPartido = 'jugador';

      // equiposPostulantes e equiposInscritos por defecto
      if (!p.equiposPostulantes) cambios.equiposPostulantes = [];
      if (!p.equiposInscritos) cambios.equiposInscritos = [];

      return { ...p, ...cambios };
    });

    // Solo guardar si hubo cambios reales
    const huboCambios = lista.some((p, i) => {
      const m = migrados[i];
      return (
        p.nivel !== m.nivel ||
        p.tipoPartido !== m.tipoPartido ||
        !Array.isArray(p.equiposPostulantes) ||
        !Array.isArray(p.equiposInscritos)
      );
    });

    if (huboCambios) guardarPartidos(migrados);

    return migrados;
  }
  const iniciales = seedPartidos();
  guardarPartidos(iniciales);
  return iniciales;
}

export function guardarPartidos(lista) {
  localStorage.setItem(KEY_PARTIDOS, JSON.stringify(lista));
}

export function getPartidoPorId(id) {
  return getPartidos().find(p => mismoId(p.id, id));
}

export function guardarPartido(partido) {
  const lista = getPartidos();
  const idx = indicePorId(lista, partido.id);
  if (idx >= 0) lista[idx] = partido;
  else lista.unshift(partido);
  guardarPartidos(lista);
}

export function eliminarPartido(id) {
  const lista = filtrarPorId(getPartidos(), id);
  guardarPartidos(lista);
}

/* =========================================================
   NOTIFICACIONES
   ========================================================= */

export function getNotificaciones() {
  const raw = localStorage.getItem(KEY_NOTIFS);
  return raw ? JSON.parse(raw) : [];
}

export function agregarNotificacion({ para, tipo, mensaje, link }) {
  const lista = getNotificaciones();
  lista.unshift({
    id: Date.now() + Math.random(),
    para,
    tipo,
    mensaje,
    link,
    fecha: new Date().toISOString(),
    leida: false
  });
  localStorage.setItem(KEY_NOTIFS, JSON.stringify(lista));
}

export function notificacionesDe(userId) {
  return getNotificaciones().filter(n => mismoId(n.para, userId));
}

export function marcarNotifLeida(id) {
  const lista = getNotificaciones().map(n =>
    mismoId(n.id, id) ? { ...n, leida: true } : n
  );
  localStorage.setItem(KEY_NOTIFS, JSON.stringify(lista));
}

/* =========================================================
   EQUIPOS (legacy — se mantiene por compatibilidad)
   ========================================================= */

export function getEquipos() {
  const raw = localStorage.getItem(KEY_EQUIPOS);
  if (raw) return JSON.parse(raw);
  const iniciales = seedEquipos();
  guardarEquipos(iniciales);
  return iniciales;
}

export function guardarEquipos(lista) {
  localStorage.setItem(KEY_EQUIPOS, JSON.stringify(lista));
}

export function getEquipoPorId(id) {
  return getEquipos().find(e => mismoId(e.id, id));
}

export function guardarEquipo(equipo) {
  const lista = getEquipos();
  const idx = indicePorId(lista, equipo.id);
  if (idx >= 0) lista[idx] = equipo;
  else lista.unshift(equipo);
  guardarEquipos(lista);
}

export function eliminarEquipo(id) {
  const lista = filtrarPorId(getEquipos(), id);
  guardarEquipos(lista);
}

/* =========================================================
   SEED PARTIDOS
   ========================================================= */

function seedPartidos() {
  return [];   // ← sin datos por defecto
}

/* =========================================================
   SEED EQUIPOS
   ========================================================= */

function seedEquipos() {
  return [];
}
/* =========================================================
   CLUBES DISPONIBLES (catálogo para unirse)
   ========================================================= */

const KEY_CLUBES = 'miejquipo_clubes_catalogo';

export function getClubesDisponibles() {
  const raw = localStorage.getItem(KEY_CLUBES);
  if (raw) return JSON.parse(raw);

  const iniciales = seedClubes();
  localStorage.setItem(KEY_CLUBES, JSON.stringify(iniciales));
  return iniciales;
}

export function guardarClubesDisponibles(lista) {
  localStorage.setItem(KEY_CLUBES, JSON.stringify(lista));
}

export function agregarJugadorAEquipo(club, usuario) {
  const equipos = getEquipos();
  const idx = indicePorId(equipos, club.id);

  const jugador = {
    id: usuario.id,
    nombre: usuario.nombre,
    avatar: usuario.avatar,
    posicion: '',
    dorsal: null
  };

  if (idx >= 0) {
    if (!equipos[idx].jugadores.some(j => mismoId(j.id, usuario.id))) {
      equipos[idx].jugadores.push(jugador);
      guardarEquipos(equipos);
    }
    return equipos[idx];
  }

  const nuevoEquipo = {
    id: club.id,
    nombre: club.nombre,
    escudo: club.escudo,
    deporte: club.deporte,
    ciudad: club.ciudad,
    descripcion: club.descripcion,
    capitanId: club.capitanId || null,
    jugadores: [jugador],
    stats: { victorias: 0, empates: 0, derrotas: 0 }
  };
  equipos.push(nuevoEquipo);
  guardarEquipos(equipos);
  return nuevoEquipo;
}

export function quitarJugadorDeEquipo(equipoId, usuarioId) {
  const equipos = getEquipos();
  const idx = indicePorId(equipos, equipoId);
  if (idx < 0) return;

  equipos[idx].jugadores = equipos[idx].jugadores.filter(j => !mismoId(j.id, usuarioId));

  if (equipos[idx].jugadores.length === 0) {
    equipos.splice(idx, 1);
  }
  guardarEquipos(equipos);
}

export function estoyEnEquipo(equipoId, usuarioId) {
  const eq = getEquipos().find(e => mismoId(e.id, equipoId));
  if (!eq) return false;
  return eq.jugadores.some(j => mismoId(j.id, usuarioId));
}

/* =========================================================
   SEED CLUBES DISPONIBLES
   ========================================================= */

function seedClubes() {
  return [];
}

/* =========================================================
   MENSAJES DE CHAT (por canal de equipo)
   ========================================================= */

const KEY_MENSAJES = 'miejquipo_mensajes_chat';

export function getTodosLosMensajes() {
  const raw = localStorage.getItem(KEY_MENSAJES);
  return raw ? JSON.parse(raw) : {};
}

export function getMensajesDeCanal(canalId) {
  const todos = getTodosLosMensajes();
  return todos[canalId] || [];
}

export function agregarMensaje(canalId, mensaje) {
  const todos = getTodosLosMensajes();
  if (!todos[canalId]) todos[canalId] = [];
  todos[canalId].push(mensaje);
  localStorage.setItem(KEY_MENSAJES, JSON.stringify(todos));
}

export function limpiarMensajesCanal(canalId) {
  const todos = getTodosLosMensajes();
  delete todos[canalId];
  localStorage.setItem(KEY_MENSAJES, JSON.stringify(todos));
}

/* =========================================================
   CONVERSACIONES PRIVADAS (chat 1 a 1)
   ========================================================= */

const KEY_CONVERSACIONES = 'miejquipo_conversaciones';
const KEY_MENSAJES_PRIV  = 'miejquipo_mensajes_privados';

/**
 * Estructura de conversaciones:
 * {
 *   [convId]: {
 *     id: string,           // "u1-u2" (IDs ordenados)
 *     participantes: [idA, idB],
 *     creada: ISO,
 *     ultimaActividad: ISO
 *   }
 * }
 */
export function getConversaciones() {
  const raw = localStorage.getItem(KEY_CONVERSACIONES);
  return raw ? JSON.parse(raw) : {};
}

export function guardarConversaciones(obj) {
  localStorage.setItem(KEY_CONVERSACIONES, JSON.stringify(obj));
}

/** Genera un ID estable para la conversación entre 2 usuarios */
export function idConversacion(idA, idB) {
  const [a, b] = [String(idA), String(idB)].sort();
  return `conv-${a}-${b}`;
}

/** Crea (o devuelve) la conversación entre 2 usuarios */
export function obtenerOCrearConversacion(idA, idB) {
  const convs = getConversaciones();
  const id = idConversacion(idA, idB);

  if (!convs[id]) {
    convs[id] = {
      id,
      participantes: [String(idA), String(idB)].sort(),
      creada: new Date().toISOString(),
      ultimaActividad: new Date().toISOString()
    };
    guardarConversaciones(convs);
  }
  return convs[id];
}

/** Todas las conversaciones donde participa un usuario */
export function conversacionesDe(userId) {
  const convs = getConversaciones();
  return Object.values(convs)
    .filter(c => c.participantes.some(p => mismoId(p, userId)))
    .sort((a, b) => new Date(b.ultimaActividad) - new Date(a.ultimaActividad));
}

/**
 * Estructura de mensajes:
 * {
 *   [convId]: [ { id, autorId, texto, fecha, leido } ]
 * }
 */
export function getTodosLosMensajesPriv() {
  const raw = localStorage.getItem(KEY_MENSAJES_PRIV);
  return raw ? JSON.parse(raw) : {};
}

export function getMensajesPrivados(convId) {
  const todos = getTodosLosMensajesPriv();
  return todos[convId] || [];
}

export function agregarMensajePrivado(convId, mensaje) {
  const todos = getTodosLosMensajesPriv();
  if (!todos[convId]) todos[convId] = [];
  todos[convId].push(mensaje);
  localStorage.setItem(KEY_MENSAJES_PRIV, JSON.stringify(todos));

  // Actualizar última actividad
  const convs = getConversaciones();
  if (convs[convId]) {
    convs[convId].ultimaActividad = new Date().toISOString();
    guardarConversaciones(convs);
  }
}

/** Marca como leídos todos los mensajes recibidos por `userId` en una conversación */
export function marcarMensajesLeidos(convId, userId) {
  const todos = getTodosLosMensajesPriv();
  if (!todos[convId]) return;

  todos[convId] = todos[convId].map(m =>
    !mismoId(m.autorId, userId) ? { ...m, leido: true } : m
  );
  localStorage.setItem(KEY_MENSAJES_PRIV, JSON.stringify(todos));
}

/** Cuenta mensajes no leídos de un usuario en una conversación */
export function contarNoLeidos(convId, userId) {
  const msgs = getMensajesPrivados(convId);
  return msgs.filter(m => !mismoId(m.autorId, userId) && !m.leido).length;
}

/** Total de no leídos del usuario en todas sus conversaciones */
export function totalNoLeidos(userId) {
  const convs = conversacionesDe(userId);
  return convs.reduce((sum, c) => sum + contarNoLeidos(c.id, userId), 0);
}

/* =========================================================
   ACTUALIZAR USUARIO (perfil) — FIX CRÍTICO
   ========================================================= */

const KEY_USUARIOS = 'miejquipo_usuarios';

export function getUsuariosRegistrados() {
  const raw = localStorage.getItem(KEY_USUARIOS);
  return raw ? JSON.parse(raw) : [];
}

export function guardarUsuariosRegistrados(lista) {
  localStorage.setItem(KEY_USUARIOS, JSON.stringify(lista));
}

/**
 * Actualiza un usuario por ID.
 * También actualiza la sesión activa si es el mismo usuario.
 * FIX: acepta UUID (string) o number.
 */
export function actualizarUsuario(id, cambios) {
  const usuarios = getUsuariosRegistrados();
  const idx = usuarios.findIndex(u => mismoId(u.id, id));

  if (idx >= 0) {
    usuarios[idx] = { ...usuarios[idx], ...cambios };
    guardarUsuariosRegistrados(usuarios);
  }

  // Actualizar SIEMPRE la sesión activa (aunque no exista en usuarios registrados)
  const KEY_SESSION = 'miejquipo_session';
  const raw = localStorage.getItem(KEY_SESSION);
  if (raw) {
    const sesion = JSON.parse(raw);
    if (mismoId(sesion.id, id)) {
      const actualizado = { ...sesion, ...cambios };
      delete actualizado.password;
      delete actualizado.password_hash;
      localStorage.setItem(KEY_SESSION, JSON.stringify(actualizado));
      console.log('[store] Sesión actualizada:', Object.keys(cambios).join(', '));
    }
  }

  return idx >= 0 ? usuarios[idx] : null;
}

/**
 * Cambia la contraseña. Devuelve true si la actual coincide.
 */
export function cambiarPassword(id, passwordActual, passwordNueva) {
  const usuarios = getUsuariosRegistrados();
  const idx = usuarios.findIndex(u => mismoId(u.id, id));
  if (idx < 0) return { ok: false, error: 'Usuario no encontrado' };

  if (usuarios[idx].password !== passwordActual) {
    return { ok: false, error: 'La contraseña actual no es correcta' };
  }

  usuarios[idx].password = passwordNueva;
  guardarUsuariosRegistrados(usuarios);
  return { ok: true };
}

/* =========================================================
   TORNEOS
   ========================================================= */

const KEY_TORNEOS = 'miejquipo_torneos';

export function getTorneos() {
  const raw = localStorage.getItem(KEY_TORNEOS);
  if (raw) return JSON.parse(raw);
  const iniciales = seedTorneos();
  guardarTorneos(iniciales);
  return iniciales;
}

export function guardarTorneos(lista) {
  localStorage.setItem(KEY_TORNEOS, JSON.stringify(lista));
}

export function getTorneoPorId(id) {
  return getTorneos().find(t => mismoId(t.id, id));
}

export function guardarTorneo(torneo) {
  const lista = getTorneos();
  const idx = indicePorId(lista, torneo.id);
  if (idx >= 0) lista[idx] = { ...torneo, actualizado: new Date().toISOString() };
  else lista.unshift(torneo);
  guardarTorneos(lista);
}

export function eliminarTorneo(id) {
  const lista = getTorneos().filter(t => String(t.id) !== String(id));
  guardarTorneos(lista);
}

/* ---------- HELPERS DE INSCRIPCIÓN ---------- */

/** ¿El equipo está en el torneo? (oficial, en lista o invitado) */
export function equipoEnTorneo(torneo, equipoId) {
  const enEquipos = (torneo.equipos || []).some(e => mismoId(e.id, equipoId));
  const enLista = (torneo.listaEspera || []).some(l => mismoId(l.equipo.id, equipoId) && l.estado === 'pendiente');
  const conInvitacion = (torneo.invitaciones || []).some(i => mismoId(i.equipoId, equipoId) && i.estado === 'pendiente');
  return enEquipos || enLista || conInvitacion;
}

/** ¿El torneo está lleno? */
export function torneoLleno(torneo) {
  return (torneo.equipos || []).length >= torneo.cuposEquipos;
}

/** ¿Hay cupos? */
export function cuposTorneoDisponibles(torneo) {
  return torneo.cuposEquipos - (torneo.equipos || []).length;
}

/* =========================================================
   CHAT DE TORNEO (canal propio)
   ========================================================= */

/** ¿Este usuario puede escribir en el chat del torneo? */
export function puedeEscribirEnChatTorneo(torneo, userId) {
  // Organizador siempre puede
  if (mismoId(torneo.organizador?.id, userId)) return true;
  // Algún equipo inscrito tiene al user como capitán o jugador
  return (torneo.equipos || []).some(e =>
    mismoId(e.capitanId, userId) ||
    (e.jugadores || []).some(j => mismoId(j, userId))
  );
}

/* =========================================================
   SEED TORNEOS
   ========================================================= */

function seedTorneos() {
  return [];
}

/* =========================================================
   CHATS DE GRUPO/TORNEO (integrados con Mensajes)
   ========================================================= */

const KEY_CHATS_GRUPO = 'miejquipo_chats_grupo';

/**
 * Estructura:
 * {
 *   [chatId]: {
 *     id, tipo: 'torneo' | 'equipo' | 'grupo',
 *     nombre, icono, refId,
 *     participantes: [userIds],
 *     adminId,
 *     creado
 *   }
 * }
 */
export function getChatsGrupo() {
  const raw = localStorage.getItem(KEY_CHATS_GRUPO);
  return raw ? JSON.parse(raw) : {};
}

export function guardarChatsGrupo(obj) {
  localStorage.setItem(KEY_CHATS_GRUPO, JSON.stringify(obj));
}

/** Crea o actualiza un chat de grupo (torneo, equipo, etc.) */
export function guardarChatGrupo(chat) {
  const chats = getChatsGrupo();
  chats[chat.id] = { ...chat, actualizado: new Date().toISOString() };
  guardarChatsGrupo(chats);
}

export function getChatGrupoPorId(id) {
  return getChatsGrupo()[id] || null;
}

/** Sincroniza los participantes de un chat con la lista actual */
export function actualizarParticipantesChat(chatId, participantes) {
  const chats = getChatsGrupo();
  if (!chats[chatId]) return;
  chats[chatId].participantes = [...new Set(participantes.map(String))];
  guardarChatsGrupo(chats);
}

/** Chats de grupo donde participa un usuario */
export function chatsGrupoDe(userId) {
  const chats = getChatsGrupo();
  return Object.values(chats)
    .filter(c => (c.participantes || []).some(p => mismoId(p, userId)))
    .sort((a, b) => new Date(b.actualizado || b.creado) - new Date(a.actualizado || a.creado));
}

/** Cuenta mensajes no leídos de un usuario en un chat de grupo */
export function contarNoLeidosGrupo(chatId, userId) {
  const msgs = getMensajesDeCanal(chatId);
  return msgs.filter(m =>
    !mismoId(m.autorId, userId) &&
    !(m.leidoPor || []).some(p => mismoId(p, userId))
  ).length;
}

/** Total de no leídos en chats de grupo */
export function totalNoLeidosGrupo(userId) {
  const chats = chatsGrupoDe(userId);
  return chats.reduce((sum, c) => sum + contarNoLeidosGrupo(c.id, userId), 0);
}

/**
 * Marca como leído un chat de grupo para un usuario.
 * Usa `leidoPor: [userIds]` dentro de cada mensaje.
 */
export function marcarLeidoGrupo(chatId, userId) {
  const KEY = 'miejquipo_mensajes_chat';
  const raw = localStorage.getItem(KEY);
  if (!raw) return;
  const todos = JSON.parse(raw);
  if (!todos[chatId]) return;

  todos[chatId] = todos[chatId].map(m => {
    const leidoPor = (m.leidoPor || []).map(String);
    if (!leidoPor.some(id => mismoId(id, userId))) {
      leidoPor.push(String(userId));
    }
    return { ...m, leidoPor };
  });
  localStorage.setItem(KEY, JSON.stringify(todos));
}

/** Total de no leídos (privados + grupos) */
export function totalNoLeidosTodo(userId) {
  return totalNoLeidos(userId) + totalNoLeidosGrupo(userId);
}

/* =========================================================
   GRUPOS UNIFICADOS (equipos + comunidades)
   ========================================================= */

const KEY_GRUPOS = 'miejquipo_grupos';

/** Migra equipos viejos → grupos nuevos */
function migrarEquiposAGrupos() {
  const viejos = localStorage.getItem('miejquipo_equipos');
  if (!viejos) return null;

  try {
    const equipos = JSON.parse(viejos);
    const grupos = equipos.map(e => ({
      ...e,
      tipo: 'equipo',
      tipoAcceso: 'publico',
      admins: [],
      solicitudes: [],
      statsPrivadas: false
    }));
    localStorage.setItem(KEY_GRUPOS, JSON.stringify(grupos));
    return grupos;
  } catch (err) {
    console.warn('[store] No se pudieron migrar equipos:', err);
    return null;
  }
}

/** Devuelve TODOS los grupos (equipos + comunidades) */
export function getGrupos() {
  const raw = localStorage.getItem(KEY_GRUPOS);
  if (raw) return JSON.parse(raw);

  // Migración desde equipos viejos
  const migrados = migrarEquiposAGrupos();
  if (migrados) return migrados;

  // Seed inicial
  const iniciales = seedGrupos();
  localStorage.setItem(KEY_GRUPOS, JSON.stringify(iniciales));
  return iniciales;
}

export function guardarGrupos(lista) {
  localStorage.setItem(KEY_GRUPOS, JSON.stringify(lista));
}

export function getGrupoPorId(id) {
  return getGrupos().find(g => mismoId(g.id, id));
}

export function guardarGrupo(grupo) {
  const lista = getGrupos();
  const idx = indicePorId(lista, grupo.id);
  if (idx >= 0) lista[idx] = { ...grupo, actualizado: new Date().toISOString() };
  else lista.unshift(grupo);
  guardarGrupos(lista);
}

export function eliminarGrupo(id) {
  const lista = filtrarPorId(getGrupos(), id);
  guardarGrupos(lista);
}

/** Solo equipos */
export function getEquiposNuevos() {
  return getGrupos().filter(g => g.tipo === 'equipo');
}

/** Solo comunidades */
export function getComunidades() {
  return getGrupos().filter(g => g.tipo === 'comunidad');
}

/* =========================================================
   HELPERS DE ROL — FIX CRÍTICO PARA BOTONES ADMIN
   ========================================================= */

export function esCapitan(grupo, userId) {
  return mismoId(grupo.capitanId, userId);
}

export function esAdmin(grupo, userId) {
  return (grupo.admins || []).some(a => mismoId(a, userId));
}

export function puedeEditar(grupo, userId) {
  return esCapitan(grupo, userId) || esAdmin(grupo, userId);
}

export function esMiembro(grupo, userId) {
  return (grupo.jugadores || []).some(j => mismoId(j.id, userId));
}

export function puedoGestionar(grupo, userId) {
  return puedeEditar(grupo, userId);
}

/* =========================================================
   SOLICITUDES
   ========================================================= */

export function agregarSolicitud(grupoId, usuario) {
  const grupo = getGrupoPorId(grupoId);
  if (!grupo) return;
  grupo.solicitudes = grupo.solicitudes || [];

  if (grupo.solicitudes.some(s => mismoId(s.userId, usuario.id))) return;
  if (esMiembro(grupo, usuario.id)) return;

  grupo.solicitudes.push({
    userId: usuario.id,
    nombre: usuario.nombre,
    avatar: usuario.avatar,
    fecha: new Date().toISOString()
  });
  guardarGrupo(grupo);
}

export function aceptarSolicitud(grupoId, userId) {
  const grupo = getGrupoPorId(grupoId);
  if (!grupo) return;

  const solicitud = (grupo.solicitudes || []).find(s => mismoId(s.userId, userId));
  if (!solicitud) return;

  grupo.solicitudes = grupo.solicitudes.filter(s => !mismoId(s.userId, userId));
  grupo.jugadores = grupo.jugadores || [];
  grupo.jugadores.push({
    id: solicitud.userId,
    nombre: solicitud.nombre,
    avatar: solicitud.avatar,
    posicion: '',
    dorsal: null,
    fechaUnion: new Date().toISOString()
  });
  guardarGrupo(grupo);
}

export function rechazarSolicitud(grupoId, userId) {
  const grupo = getGrupoPorId(grupoId);
  if (!grupo) return;
  grupo.solicitudes = (grupo.solicitudes || []).filter(s => !mismoId(s.userId, userId));
  guardarGrupo(grupo);
}

/* =========================================================
   MIEMBROS
   ========================================================= */

export function agregarMiembroDirecto(grupoId, usuario) {
  const grupo = getGrupoPorId(grupoId);
  if (!grupo) return;
  grupo.jugadores = grupo.jugadores || [];
  if (grupo.jugadores.some(j => mismoId(j.id, usuario.id))) return;

  grupo.jugadores.push({
    id: usuario.id,
    nombre: usuario.nombre,
    avatar: usuario.avatar,
    posicion: '',
    dorsal: null,
    fechaUnion: new Date().toISOString()
  });
  guardarGrupo(grupo);
}

export function expulsarMiembro(grupoId, userId) {
  const grupo = getGrupoPorId(grupoId);
  if (!grupo) return;

  // No se puede expulsar al capitán
  if (mismoId(grupo.capitanId, userId)) return;

  grupo.jugadores = (grupo.jugadores || []).filter(j => !mismoId(j.id, userId));
  grupo.admins = (grupo.admins || []).filter(a => !mismoId(a, userId));
  guardarGrupo(grupo);
}

export function salirDeGrupo(grupoId, userId) {
  const grupo = getGrupoPorId(grupoId);
  if (!grupo) return;
  if (mismoId(grupo.capitanId, userId)) return; // capitán debe eliminar el grupo

  grupo.jugadores = (grupo.jugadores || []).filter(j => !mismoId(j.id, userId));
  grupo.admins = (grupo.admins || []).filter(a => !mismoId(a, userId));
  guardarGrupo(grupo);
}

/* =========================================================
   ADMINS
   ========================================================= */

export function nombrarAdmin(grupoId, userId) {
  const grupo = getGrupoPorId(grupoId);
  if (!grupo) return;
  if (mismoId(grupo.capitanId, userId)) return; // capitán ya tiene todos los permisos

  grupo.admins = grupo.admins || [];
  if (!grupo.admins.some(a => mismoId(a, userId))) {
    grupo.admins.push(userId);
    guardarGrupo(grupo);
  }
}

export function quitarAdmin(grupoId, userId) {
  const grupo = getGrupoPorId(grupoId);
  if (!grupo) return;
  grupo.admins = (grupo.admins || []).filter(a => !mismoId(a, userId));
  guardarGrupo(grupo);
}

/* =========================================================
   SEED DE GRUPOS
   ========================================================= */

function seedGrupos() {
  return [];
}
/* =========================================================
   PUBLICACIONES (feed del inicio)
   ========================================================= */

const KEY_PUBLICACIONES = 'miejquipo_publicaciones';

export function getPublicaciones() {
  const raw = localStorage.getItem(KEY_PUBLICACIONES);
  return raw ? JSON.parse(raw) : null;
}

export function guardarPublicaciones(lista) {
  localStorage.setItem(KEY_PUBLICACIONES, JSON.stringify(lista));
}

export function agregarPublicacion(pub) {
  const lista = getPublicaciones() || [];
  lista.unshift(pub);
  guardarPublicaciones(lista);
}

export function actualizarPublicacion(id, cambios) {
  const lista = getPublicaciones() || [];
  const idx = indicePorId(lista, id);
  if (idx >= 0) {
    lista[idx] = { ...lista[idx], ...cambios };
    guardarPublicaciones(lista);
  }
  return idx >= 0 ? lista[idx] : null;
}

export function eliminarPublicacion(id) {
  const lista = filtrarPorId(getPublicaciones() || [], id);
  guardarPublicaciones(lista);
}

export function publicacionesDe(userId) {
  return (getPublicaciones() || []).filter(p =>
    mismoId(p.autor?.id, userId)
  );
}

/** Inicializa el feed con las publicaciones mock la primera vez */
export function inicializarPublicaciones(mockPublicaciones) {
  const existentes = getPublicaciones();
  if (existentes) return existentes;

  guardarPublicaciones(mockPublicaciones);
  return mockPublicaciones;
}

/* =========================================================
   ELIMINAR CUENTA
   ========================================================= */

export function eliminarCuenta(userId) {
  // Eliminar de usuarios registrados
  const usuarios = getUsuariosRegistrados().filter(u => !mismoId(u.id, userId));
  guardarUsuariosRegistrados(usuarios);

  // Limpiar sesión
  localStorage.removeItem('miejquipo_session');

  // Quitarlo de grupos
  const grupos = getGrupos();
  grupos.forEach(g => {
    g.jugadores = (g.jugadores || []).filter(j => !mismoId(j.id, userId));
    g.admins = (g.admins || []).filter(a => !mismoId(a, userId));
    g.solicitudes = (g.solicitudes || []).filter(s => !mismoId(s.userId, userId));
  });
  guardarGrupos(grupos);

  // Quitarlo de partidos
  const partidos = getPartidos();
  partidos.forEach(p => {
    p.inscritos = (p.inscritos || []).filter(uid => !mismoId(uid, userId));
    p.postulantes = (p.postulantes || []).filter(pp => !mismoId(pp.userId, userId));
  });
  guardarPartidos(partidos);
}

/* =========================================================
   HILOS DE COMUNIDAD (posts dentro de cada grupo)
   ========================================================= */

/**
 * Los hilos se guardan dentro de cada grupo en `grupo.hilos`.
 * Estructura:
 *   grupo.hilos = [
 *     {
 *       id,
 *       autor: { id, nombre, avatar },
 *       tipo: 'post' | 'partido' | 'torneo',
 *       contenido,
 *       imagen, video,
 *       fecha,
 *       likes, yoLikee,
 *       comentarios: [...]
 *     }
 *   ]
 */

export function getHilosDeGrupo(grupoId) {
  const grupo = getGrupoPorId(grupoId);
  return grupo?.hilos || [];
}

export function agregarHilo(grupoId, hilo) {
  const grupo = getGrupoPorId(grupoId);
  if (!grupo) return;

  grupo.hilos = grupo.hilos || [];
  grupo.hilos.unshift(hilo);
  guardarGrupo(grupo);
}

export function actualizarHilo(grupoId, hiloId, cambios) {
  const grupo = getGrupoPorId(grupoId);
  if (!grupo) return;

  grupo.hilos = (grupo.hilos || []).map(h =>
    mismoId(h.id, hiloId) ? { ...h, ...cambios } : h
  );
  guardarGrupo(grupo);
}

export function eliminarHilo(grupoId, hiloId) {
  const grupo = getGrupoPorId(grupoId);
  if (!grupo) return;

  grupo.hilos = (grupo.hilos || []).filter(h => !mismoId(h.id, hiloId));
  guardarGrupo(grupo);
}

/** Devuelve TODOS los hilos públicos (de comunidades públicas) para el feed de Inicio */
export function getTodosLosHilos() {
  const grupos = getGrupos().filter(g => g.tipo === 'comunidad' && g.tipoAcceso === 'publico');
  const todos = [];

  grupos.forEach(g => {
    (g.hilos || []).forEach(h => {
      todos.push({
        ...h,
        _grupoId: g.id,
        _grupoNombre: g.nombre,
        _grupoEscudo: g.escudo
      });
    });
  });

  // Ordenar por fecha descendente
  return todos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

/* =========================================================
   HELPER: ¿un usuario puede unirse a un grupo?
   =========================================================
   Regla: SÍ puede estar en MÚLTIPLES equipos Y comunidades.
   Solo se bloquea si YA es miembro.
*/

export function puedeUnirseAGrupo(grupo, userId) {
  if (esMiembro(grupo, userId)) {
    return { ok: false, motivo: 'Ya eres miembro' };
  }
  return { ok: true };
}

/* =========================================================
   MIGRACIÓN DE PERFIL: multi-deporte
   =========================================================
   Convierte usuarios con:
     deporte_favorito: 'Fútbol'
     posicion_favorita: 'Delantero'
   a:
     deportes: [{ deporte: 'Fútbol', posiciones: ['Delantero'], stats: {} }]
*/

export function migrarUsuarioAMultiDeporte(usuario) {
  if (!usuario) return usuario;
  if (Array.isArray(usuario.deportes)) return usuario; // ya migrado

  const deportes = [];

  if (usuario.deporte_favorito) {
    deportes.push({
      deporte: usuario.deporte_favorito,
      posiciones: usuario.posicion_favorita ? [usuario.posicion_favorita] : [],
      stats: {}
    });
  }

  return {
    ...usuario,
    deportes,
    // Mantener los viejos por compatibilidad, pero ya no se usan
    deporte_favorito: undefined,
    posicion_favorita: undefined
  };
}

/** Migra todos los usuarios del store */
export function migrarTodosLosUsuarios() {
  const usuarios = getUsuariosRegistrados();
  let huboCambios = false;

  const migrados = usuarios.map(u => {
    const m = migrarUsuarioAMultiDeporte(u);
    if (m !== u) huboCambios = true;
    return m;
  });

  if (huboCambios) {
    guardarUsuariosRegistrados(migrados);

    // Actualizar también la sesión activa
    const KEY_SESSION = 'miejquipo_session';
    const raw = localStorage.getItem(KEY_SESSION);
    if (raw) {
      const sesion = JSON.parse(raw);
      const sesionMigrada = migrarUsuarioAMultiDeporte(sesion);
      localStorage.setItem(KEY_SESSION, JSON.stringify(sesionMigrada));
    }
  }

  return migrados;
}

/* =========================================================
   HELPERS DE MULTI-DEPORTE
   ========================================================= */

/** Devuelve la lista de deportes del usuario (o []) */
export function getDeportesDeUsuario(usuario) {
  if (!usuario) return [];
  if (Array.isArray(usuario.deportes)) return usuario.deportes;
  return [];
}

/** Devuelve un deporte específico del usuario o null */
export function getDeporteDeUsuario(usuario, deporteNombre) {
  const deportes = getDeportesDeUsuario(usuario);
  return deportes.find(d => d.deporte === deporteNombre) || null;
}

/** Agrega un deporte nuevo al usuario (si no existe) */
export function agregarDeporteAUsuario(usuario, deporteNombre) {
  const deportes = getDeportesDeUsuario(usuario);
  if (deportes.find(d => d.deporte === deporteNombre)) return usuario;

  deportes.push({
    deporte: deporteNombre,
    posiciones: [],
    stats: {}
  });

  return { ...usuario, deportes };
}

/** Quita un deporte del usuario */
export function quitarDeporteAUsuario(usuario, deporteNombre) {
  const deportes = getDeportesDeUsuario(usuario).filter(d => d.deporte !== deporteNombre);
  return { ...usuario, deportes };
}

/** Actualiza las posiciones de un deporte */
export function actualizarPosicionesDeporte(usuario, deporteNombre, posiciones) {
  const deportes = getDeportesDeUsuario(usuario).map(d =>
    d.deporte === deporteNombre ? { ...d, posiciones } : d
  );
  return { ...usuario, deportes };
}

/** Actualiza las stats de un deporte */
export function actualizarStatsDeporte(usuario, deporteNombre, stats) {
  const deportes = getDeportesDeUsuario(usuario).map(d =>
    d.deporte === deporteNombre ? { ...d, stats } : d
  );
  return { ...usuario, deportes };
}

/* =========================================================
   HELPERS PARA VISUALIZACIÓN PÚBLICA
   ========================================================= */

/** Devuelve solo las stats públicas de un deporte */
export function getStatsPublicasDeDeporte(deporteData) {
  if (!deporteData || !deporteData.stats) return [];
  return Object.entries(deporteData.stats)
    .filter(([, v]) => v && v.publico)
    .map(([clave, v]) => ({ clave, valor: v.valor }));
}

/* =========================================================
   PARTIDOS DE EQUIPO (extensión)
   ========================================================= */

/** ¿Este partido es de equipos? */
export function esPartidoDeEquipo(partido) {
  return partido?.tipoPartido === 'equipo';
}

/** ¿Este partido es de jugadores? */
export function esPartidoDeJugador(partido) {
  return !partido?.tipoPartido || partido.tipoPartido === 'jugador';
}

/** Equipos postulantes pendientes */
export function equiposPostulantesPendientes(partido) {
  return (partido.equiposPostulantes || []).filter(e => e.estado === 'pendiente');
}

/** ¿Este equipo ya se postuló? */
export function equipoYaSePostulo(partido, equipoId) {
  return (partido.equiposPostulantes || []).some(e => mismoId(e.equipoId, equipoId));
}

/** ¿Este equipo ya está inscrito? */
export function equipoYaEstaInscrito(partido, equipoId) {
  return (partido.equiposInscritos || []).some(e => mismoId(e.equipoId, equipoId));
}

/** Agregar un equipo como postulante */
export function postularEquipoAPartido(partidoId, equipo) {
  const partido = getPartidoPorId(partidoId);
  if (!partido) return;
  if (esPartidoDeJugador(partido)) return;

  partido.equiposPostulantes = partido.equiposPostulantes || [];
  if (equipoYaSePostulo(partido, equipo.id)) return;

  partido.equiposPostulantes.push({
    equipoId: equipo.id,
    equipo: {
      id: equipo.id,
      nombre: equipo.nombre,
      escudo: equipo.escudo,
      capitanId: equipo.capitanId,
      jugadores: (equipo.jugadores || []).map(j => j.id)
    },
    estado: 'pendiente',
    fecha: new Date().toISOString()
  });

  guardarPartido(partido);
}

/** Aceptar equipo postulante */
export function aceptarEquipoPostulante(partidoId, equipoId) {
  const partido = getPartidoPorId(partidoId);
  if (!partido) return;

  const post = (partido.equiposPostulantes || []).find(e => mismoId(e.equipoId, equipoId));
  if (!post) return;

  post.estado = 'aceptado';
  partido.equiposInscritos = partido.equiposInscritos || [];
  partido.equiposInscritos.push(post.equipo);

  if (partido.equiposInscritos.length >= partido.cupos) {
    partido.estado = 'lleno';
  }

  guardarPartido(partido);
}

/** Rechazar equipo postulante */
export function rechazarEquipoPostulante(partidoId, equipoId) {
  const partido = getPartidoPorId(partidoId);
  if (!partido) return;

  const post = (partido.equiposPostulantes || []).find(e => mismoId(e.equipoId, equipoId));
  if (!post) return;

  post.estado = 'rechazado';
  guardarPartido(partido);
}

/* =========================================================
   CHAT CONTEXTUAL (vincular conversación a partido/torneo)
   ========================================================= */

/** Vincula una conversación a un partido o torneo */
export function vincularConversacion(convId, vinculo) {
  const convs = getConversaciones();
  if (!convs[convId]) return;

  convs[convId].vinculadaA = vinculo; // { tipo, id, nombre }
  guardarConversaciones(convs);
}

/** Devuelve el vínculo de una conversación (si existe) */
export function getVinculoConversacion(convId) {
  const convs = getConversaciones();
  return convs[convId]?.vinculadaA || null;
}

/**
 * Abre (o crea) una conversación entre dos usuarios vinculada a un partido.
 * Devuelve el ID de la conversación.
 */
export function obtenerOCrearConversacionVinculada(idA, idB, vinculo) {
  const conv = obtenerOCrearConversacion(idA, idB);
  // Si no tiene vínculo, o el vínculo es diferente, actualizar
  if (!conv.vinculadaA || !mismoId(conv.vinculadaA.id, vinculo.id) || conv.vinculadaA.tipo !== vinculo.tipo) {
    vincularConversacion(conv.id, vinculo);
  }
  return conv;
}

/* =========================================================
   BORRAR CHATS (solo del lado del usuario)
   =========================================================
   El chat se marca como "oculto para X usuario".
   Los mensajes NO se borran para los demás.
*/

const KEY_CHATS_OCULTOS = 'miejquipo_chats_ocultos';

/**
 * Estructura:
 * {
 *   [userId]: {
 *     conversaciones: [convId1, convId2],
 *     canales: [canalId1, canalId2]
 *   }
 * }
 */
export function getChatsOcultos() {
  const raw = localStorage.getItem(KEY_CHATS_OCULTOS);
  return raw ? JSON.parse(raw) : {};
}

export function guardarChatsOcultos(obj) {
  localStorage.setItem(KEY_CHATS_OCULTOS, JSON.stringify(obj));
}

export function ocultarConversacion(userId, convId) {
  const todos = getChatsOcultos();
  const key = String(userId);
  if (!todos[key]) todos[key] = { conversaciones: [], canales: [] };
  if (!todos[key].conversaciones.some(c => mismoId(c, convId))) {
    todos[key].conversaciones.push(convId);
  }
  guardarChatsOcultos(todos);
}

export function ocultarCanal(userId, canalId) {
  const todos = getChatsOcultos();
  const key = String(userId);
  if (!todos[key]) todos[key] = { conversaciones: [], canales: [] };
  if (!todos[key].canales.some(c => mismoId(c, canalId))) {
    todos[key].canales.push(canalId);
  }
  guardarChatsOcultos(todos);
}

export function estaOculto(userId, convId) {
  const todos = getChatsOcultos();
  const user = todos[String(userId)];
  if (!user) return false;
  return (user.conversaciones || []).some(c => mismoId(c, convId)) ||
         (user.canales || []).some(c => mismoId(c, convId));
}

/** Cuando llega un mensaje nuevo, el chat vuelve a aparecer */
export function mostrarConversacion(userId, convId) {
  const todos = getChatsOcultos();
  const key = String(userId);
  if (!todos[key]) return;

  todos[key].conversaciones = (todos[key].conversaciones || []).filter(c => !mismoId(c, convId));
  todos[key].canales = (todos[key].canales || []).filter(c => !mismoId(c, convId));

  guardarChatsOcultos(todos);
}