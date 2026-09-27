/* =========================================================
   store.js — Estado compartido en localStorage
   ========================================================= */

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
    // Migración: eliminar "amateur" → convertir a "amistoso"
    const migrados = lista.map(p =>
      p.nivel === 'amateur' ? { ...p, nivel: 'amistoso' } : p
    );
    // Si hubo cambios, guardar
    if (migrados.some((p, i) => p.nivel !== lista[i]?.nivel)) {
      guardarPartidos(migrados);
    }
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
  return getPartidos().find(p => p.id === Number(id));
}

export function guardarPartido(partido) {
  const lista = getPartidos();
  const idx = lista.findIndex(p => p.id === partido.id);
  if (idx >= 0) lista[idx] = partido;
  else lista.unshift(partido);
  guardarPartidos(lista);
}

export function eliminarPartido(id) {
  const lista = getPartidos().filter(p => p.id !== Number(id));
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
  return getNotificaciones().filter(n => n.para === Number(userId));
}

export function marcarNotifLeida(id) {
  const lista = getNotificaciones().map(n =>
    n.id === id ? { ...n, leida: true } : n
  );
  localStorage.setItem(KEY_NOTIFS, JSON.stringify(lista));
}

/* =========================================================
   EQUIPOS
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
  return getEquipos().find(e => e.id === Number(id));
}

export function guardarEquipo(equipo) {
  const lista = getEquipos();
  const idx = lista.findIndex(e => e.id === equipo.id);
  if (idx >= 0) lista[idx] = equipo;
  else lista.unshift(equipo);
  guardarEquipos(lista);
}

export function eliminarEquipo(id) {
  const lista = getEquipos().filter(e => e.id !== Number(id));
  guardarEquipos(lista);
}

/* =========================================================
   SEED PARTIDOS
   ========================================================= */

function seedPartidos() {
  return [
    {
      id: 1, deporte: 'Fútbol', emoji: '⚽',
      titulo: 'Fútbol 7 - Cancha Sur',
      fecha: '2026-10-05T18:00:00', lugar: 'Santiago',
      cupos: 14, estado: 'abierto',
      precio: 0, nivel: 'amistoso',
      pedirPosiciones: false, posiciones: [],
      aprobacionRequerida: false,
      descripcion: '',
      organizador: { id: 2, nombre: 'María González', avatar: 'https://i.pravatar.cc/100?img=45' },
      inscritos: [2, 3, 4, 5, 6, 7, 8, 9, 10],
      postulantes: []
    },
    {
      id: 2, deporte: 'Básquetbol', emoji: '🏀',
      titulo: 'Básquet 3v3',
      fecha: '2026-10-06T20:00:00', lugar: 'Providencia',
      cupos: 6, estado: 'abierto',
      precio: 3000, nivel: 'semiprofesional',
      pedirPosiciones: true,
      posiciones: ['Base', 'Alero'],
      aprobacionRequerida: true,
      descripcion: 'Nivel competitivo, buscamos jugadores con experiencia.',
      organizador: { id: 1, nombre: 'Juan Pérez', avatar: 'https://i.pravatar.cc/100?img=12' },
      inscritos: [1, 13, 14, 15, 16],
      postulantes: [
        { userId: 45, nombre: 'María González', avatar: 'https://i.pravatar.cc/100?img=45', posicion: 'Base', estado: 'pendiente' }
      ]
    },
    {
      id: 3, deporte: 'Tenis', emoji: '🎾',
      titulo: 'Tenis dobles - Cancha 2',
      fecha: '2026-10-07T19:30:00', lugar: 'Ñuñoa',
      cupos: 4, estado: 'lleno',
      precio: 8000, nivel: 'profesional',
      pedirPosiciones: false, posiciones: [],
      aprobacionRequerida: true,
      descripcion: '',
      organizador: { id: 5, nombre: 'Camila Torres', avatar: 'https://i.pravatar.cc/100?img=47' },
      inscritos: [5, 20, 21, 22],
      postulantes: []
    }
  ];
}

/* =========================================================
   SEED EQUIPOS
   ========================================================= */

function seedEquipos() {
  return [
    {
      id: 1,
      nombre: 'Los Galácticos FC',
      deporte: 'Fútbol',
      escudo: '🛡️',
      ciudad: 'Santiago',
      descripcion: 'Equipo amateur de fútbol 7',
      capitanId: 1,
      jugadores: [
        { id: 1, nombre: 'Juan Pérez',       avatar: 'https://i.pravatar.cc/100?img=12', posicion: 'Delantero',     dorsal: 9 },
        { id: 13, nombre: 'Carlos Ruiz',     avatar: 'https://i.pravatar.cc/100?img=13', posicion: 'Mediocampista', dorsal: 10 },
        { id: 14, nombre: 'Andrés Soto',     avatar: 'https://i.pravatar.cc/100?img=14', posicion: 'Defensa',       dorsal: 4 },
        { id: 15, nombre: 'Diego Fernández', avatar: 'https://i.pravatar.cc/100?img=15', posicion: 'Portero',       dorsal: 1 },
        { id: 16, nombre: 'Matías López',    avatar: 'https://i.pravatar.cc/100?img=16', posicion: 'Delantero',     dorsal: 11 }
      ],
      stats: { victorias: 10, empates: 3, derrotas: 2 }
    }
  ];
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
  const idx = equipos.findIndex(e => e.id === club.id);

  const jugador = {
    id: usuario.id,
    nombre: usuario.nombre,
    avatar: usuario.avatar,
    posicion: '',
    dorsal: null
  };

  if (idx >= 0) {
    if (!equipos[idx].jugadores.some(j => j.id === usuario.id)) {
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
  const idx = equipos.findIndex(e => e.id === equipoId);
  if (idx < 0) return;

  equipos[idx].jugadores = equipos[idx].jugadores.filter(j => j.id !== usuarioId);

  if (equipos[idx].jugadores.length === 0) {
    equipos.splice(idx, 1);
  }
  guardarEquipos(equipos);
}

export function estoyEnEquipo(equipoId, usuarioId) {
  const eq = getEquipos().find(e => e.id === equipoId);
  if (!eq) return false;
  return eq.jugadores.some(j => j.id === usuarioId);
}

/* =========================================================
   SEED CLUBES DISPONIBLES
   ========================================================= */

function seedClubes() {
  return [
    { id: 101, nombre: 'Los Tigres FC',      escudo: '🐯', deporte: 'Fútbol',     ciudad: 'Santiago',     miembros: 18, tipo: 'publico', descripcion: 'Equipo amateur de fútbol 7',      capitanId: 30 },
    { id: 102, nombre: 'Cóndores Básquet',   escudo: '🦅', deporte: 'Básquetbol', ciudad: 'Valparaíso',   miembros: 12, tipo: 'publico', descripcion: 'Básquet mixto los martes',        capitanId: 31 },
    { id: 103, nombre: 'Halcones Vóley',     escudo: '🏐', deporte: 'Vóleibol',   ciudad: 'Concepción',   miembros: 15, tipo: 'privado', descripcion: 'Solo por invitación',             capitanId: 32 },
    { id: 104, nombre: 'Racquet Club Pádel', escudo: '🎾', deporte: 'Pádel',      ciudad: 'Las Condes',   miembros: 24, tipo: 'publico', descripcion: 'Pádel nivel intermedio-avanzado', capitanId: 33 },
    { id: 105, nombre: 'Titanes Rugby',      escudo: '🏉', deporte: 'Rugby',      ciudad: 'Santiago',     miembros: 30, tipo: 'privado', descripcion: 'Rugby XV, competimos en liga',    capitanId: 34 },
    { id: 106, nombre: 'Águilas Tenis',      escudo: '🎾', deporte: 'Tenis',      ciudad: 'Ñuñoa',        miembros: 8,  tipo: 'publico', descripcion: 'Tenis singles y dobles',          capitanId: 35 },
    { id: 107, nombre: 'Lobos Handball',     escudo: '🐺', deporte: 'Handball',   ciudad: 'Maipú',        miembros: 14, tipo: 'publico', descripcion: 'Handball mixto',                  capitanId: 36 },
    { id: 108, nombre: 'Dragones Hockey',    escudo: '🏒', deporte: 'Hockey',     ciudad: 'Punta Arenas', miembros: 16, tipo: 'privado', descripcion: 'Hockey sobre patines',            capitanId: 37 }
  ];
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
  const [a, b] = [Number(idA), Number(idB)].sort((x, y) => x - y);
  return `conv-${a}-${b}`;
}

/** Crea (o devuelve) la conversación entre 2 usuarios */
export function obtenerOCrearConversacion(idA, idB) {
  const convs = getConversaciones();
  const id = idConversacion(idA, idB);

  if (!convs[id]) {
    convs[id] = {
      id,
      participantes: [Number(idA), Number(idB)].sort((x, y) => x - y),
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
    .filter(c => c.participantes.includes(Number(userId)))
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
    m.autorId !== Number(userId) ? { ...m, leido: true } : m
  );
  localStorage.setItem(KEY_MENSAJES_PRIV, JSON.stringify(todos));
}

/** Cuenta mensajes no leídos de un usuario en una conversación */
export function contarNoLeidos(convId, userId) {
  const msgs = getMensajesPrivados(convId);
  return msgs.filter(m => m.autorId !== Number(userId) && !m.leido).length;
}

/** Total de no leídos del usuario en todas sus conversaciones */
export function totalNoLeidos(userId) {
  const convs = conversacionesDe(userId);
  return convs.reduce((sum, c) => sum + contarNoLeidos(c.id, userId), 0);
}
/* =========================================================
   ACTUALIZAR USUARIO (perfil)
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
 */
export function actualizarUsuario(id, cambios) {
  const usuarios = getUsuariosRegistrados();
  const idx = usuarios.findIndex(u => u.id === Number(id));

  if (idx >= 0) {
    usuarios[idx] = { ...usuarios[idx], ...cambios };
    guardarUsuariosRegistrados(usuarios);

    // Actualizar sesión si es el mismo usuario
    const KEY_SESSION = 'miejquipo_session';
    const raw = localStorage.getItem(KEY_SESSION);
    if (raw) {
      const sesion = JSON.parse(raw);
      if (sesion.id === Number(id)) {
        const actualizado = { ...sesion, ...cambios };
        // No guardar password en la sesión
        delete actualizado.password;
        localStorage.setItem(KEY_SESSION, JSON.stringify(actualizado));
      }
    }
  }
  return usuarios[idx];
}

/**
 * Cambia la contraseña. Devuelve true si la actual coincide.
 */
export function cambiarPassword(id, passwordActual, passwordNueva) {
  const usuarios = getUsuariosRegistrados();
  const idx = usuarios.findIndex(u => u.id === Number(id));
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
  return getTorneos().find(t => t.id === Number(id));
}

export function guardarTorneo(torneo) {
  const lista = getTorneos();
  const idx = lista.findIndex(t => t.id === torneo.id);
  if (idx >= 0) lista[idx] = { ...torneo, actualizado: new Date().toISOString() };
  else lista.unshift(torneo);
  guardarTorneos(lista);
}

export function eliminarTorneo(id) {
  const lista = getTorneos().filter(t => t.id !== Number(id));
  guardarTorneos(lista);
}

/* ---------- HELPERS DE INSCRIPCIÓN ---------- */

/** ¿El equipo está en el torneo? (oficial, en lista o invitado) */
export function equipoEnTorneo(torneo, equipoId) {
  const enEquipos = (torneo.equipos || []).some(e => e.id === equipoId);
  const enLista = (torneo.listaEspera || []).some(l => l.equipo.id === equipoId && l.estado === 'pendiente');
  const conInvitacion = (torneo.invitaciones || []).some(i => i.equipoId === equipoId && i.estado === 'pendiente');
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
  if (torneo.organizador?.id === userId) return true;
  // Algún equipo inscrito tiene al user como capitán o jugador
  return (torneo.equipos || []).some(e =>
    e.capitanId === userId || (e.jugadores || []).includes(userId)
  );
}

/* =========================================================
   SEED TORNEOS
   ========================================================= */

function seedTorneos() {
  return [
    {
      id: 1,
      nombre: 'Copa Verano 2026',
      deporte: 'Fútbol',
      emoji: '⚽',
      fechaInicio: '2026-12-01',
      fechaFin: '2026-12-20',
      lugar: 'Santiago',
      cuposEquipos: 8,
      precio: 20000,
      descripcion: 'Torneo de fútbol 7 con fase de grupos y eliminación directa.',
      estado: 'inscripcion',
      organizador: { id: 2, nombre: 'María González', avatar: 'https://i.pravatar.cc/100?img=45' },
      equipos: [],
      listaEspera: [],
      invitaciones: [],
      canalChatId: 'torneo-1',
      creado: new Date().toISOString()
    },
    {
      id: 2,
      nombre: 'Liga Fútbol 7',
      deporte: 'Fútbol',
      emoji: '⚽',
      fechaInicio: '2026-10-15',
      fechaFin: '2026-11-30',
      lugar: 'Providencia',
      cuposEquipos: 12,
      precio: 0,
      descripcion: 'Liga regular todos los miércoles.',
      estado: 'en_curso',
      organizador: { id: 3, nombre: 'Carlos Ruiz', avatar: 'https://i.pravatar.cc/100?img=13' },
      equipos: [],
      listaEspera: [],
      invitaciones: [],
      canalChatId: 'torneo-2',
      creado: new Date().toISOString()
    }
  ];
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
 *     nombre, icono, refId,           // refId = id del torneo/equipo
 *     participantes: [userIds],        // quiénes pueden verlo
 *     adminId,                         // organizador
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
  chats[chatId].participantes = [...new Set(participantes)];
  guardarChatsGrupo(chats);
}

/** Chats de grupo donde participa un usuario */
export function chatsGrupoDe(userId) {
  const chats = getChatsGrupo();
  return Object.values(chats)
    .filter(c => (c.participantes || []).includes(Number(userId)))
    .sort((a, b) => new Date(b.actualizado || b.creado) - new Date(a.actualizado || a.creado));
}

/** Cuenta mensajes no leídos de un usuario en un chat de grupo */
export function contarNoLeidosGrupo(chatId, userId) {
  const msgs = getMensajesDeCanal(chatId);
  return msgs.filter(m => m.autorId !== Number(userId) && !m.leidoPor?.includes(Number(userId))).length;
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
    const leidoPor = m.leidoPor || [];
    if (!leidoPor.includes(Number(userId))) {
      leidoPor.push(Number(userId));
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
   =========================================================
   Reemplaza el concepto de "equipo" y "club" por uno solo
   que puede ser tipo: 'equipo' | 'comunidad'.
   Migra automáticamente los equipos existentes.
*/

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
  return getGrupos().find(g => g.id === Number(id));
}

export function guardarGrupo(grupo) {
  const lista = getGrupos();
  const idx = lista.findIndex(g => g.id === grupo.id);
  if (idx >= 0) lista[idx] = { ...grupo, actualizado: new Date().toISOString() };
  else lista.unshift(grupo);
  guardarGrupos(lista);
}

export function eliminarGrupo(id) {
  const lista = getGrupos().filter(g => g.id !== Number(id));
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

/* ---------- HELPERS DE ROL ---------- */

export function esCapitan(grupo, userId) {
  return grupo.capitanId === Number(userId);
}

export function esAdmin(grupo, userId) {
  return (grupo.admins || []).includes(Number(userId));
}

export function puedeEditar(grupo, userId) {
  return esCapitan(grupo, userId) || esAdmin(grupo, userId);
}

export function esMiembro(grupo, userId) {
  return (grupo.jugadores || []).some(j => j.id === Number(userId));
}

export function puedoGestionar(grupo, userId) {
  return puedeEditar(grupo, userId);
}

/* ---------- SOLICITUDES ---------- */

export function agregarSolicitud(grupoId, usuario) {
  const grupo = getGrupoPorId(grupoId);
  if (!grupo) return;
  grupo.solicitudes = grupo.solicitudes || [];

  if (grupo.solicitudes.some(s => s.userId === usuario.id)) return;
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

  const solicitud = (grupo.solicitudes || []).find(s => s.userId === userId);
  if (!solicitud) return;

  grupo.solicitudes = grupo.solicitudes.filter(s => s.userId !== userId);
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
  grupo.solicitudes = (grupo.solicitudes || []).filter(s => s.userId !== userId);
  guardarGrupo(grupo);
}

/* ---------- MIEMBROS ---------- */

export function agregarMiembroDirecto(grupoId, usuario) {
  const grupo = getGrupoPorId(grupoId);
  if (!grupo) return;
  grupo.jugadores = grupo.jugadores || [];
  if (grupo.jugadores.some(j => j.id === usuario.id)) return;

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
  if (grupo.capitanId === userId) return;

  grupo.jugadores = (grupo.jugadores || []).filter(j => j.id !== userId);
  grupo.admins = (grupo.admins || []).filter(a => a !== userId);
  guardarGrupo(grupo);
}

export function salirDeGrupo(grupoId, userId) {
  const grupo = getGrupoPorId(grupoId);
  if (!grupo) return;
  if (grupo.capitanId === userId) return; // capitán debe eliminar el grupo

  grupo.jugadores = (grupo.jugadores || []).filter(j => j.id !== userId);
  grupo.admins = (grupo.admins || []).filter(a => a !== userId);
  guardarGrupo(grupo);
}

/* ---------- ADMINS ---------- */

export function nombrarAdmin(grupoId, userId) {
  const grupo = getGrupoPorId(grupoId);
  if (!grupo) return;
  if (grupo.capitanId === userId) return; // capitán ya tiene todos los permisos

  grupo.admins = grupo.admins || [];
  if (!grupo.admins.includes(userId)) {
    grupo.admins.push(userId);
    guardarGrupo(grupo);
  }
}

export function quitarAdmin(grupoId, userId) {
  const grupo = getGrupoPorId(grupoId);
  if (!grupo) return;
  grupo.admins = (grupo.admins || []).filter(a => a !== userId);
  guardarGrupo(grupo);
}

/* =========================================================
   SEED DE GRUPOS
   ========================================================= */

function seedGrupos() {
  return [
    {
      id: 1,
      tipo: 'equipo',
      nombre: 'Los Galácticos FC',
      deporte: 'Fútbol',
      escudo: '🛡️',
      ciudad: 'Santiago',
      descripcion: 'Equipo amateur de fútbol 7',
      tipoAcceso: 'publico',
      capitanId: 1,
      admins: [],
      solicitudes: [],
      statsPrivadas: false,
      jugadores: [
        { id: 1,  nombre: 'Juan Pérez',       avatar: 'https://i.pravatar.cc/100?img=12', posicion: 'Delantero',     dorsal: 9 },
        { id: 13, nombre: 'Carlos Ruiz',      avatar: 'https://i.pravatar.cc/100?img=13', posicion: 'Mediocampista', dorsal: 10 },
        { id: 14, nombre: 'Andrés Soto',      avatar: 'https://i.pravatar.cc/100?img=14', posicion: 'Defensa',       dorsal: 4 },
        { id: 15, nombre: 'Diego Fernández',  avatar: 'https://i.pravatar.cc/100?img=15', posicion: 'Portero',       dorsal: 1 },
        { id: 16, nombre: 'Matías López',     avatar: 'https://i.pravatar.cc/100?img=16', posicion: 'Delantero',     dorsal: 11 }
      ],
      stats: { victorias: 10, empates: 3, derrotas: 2 }
    },
    {
      id: 101,
      tipo: 'comunidad',
      nombre: 'Futboleros Santiago',
      deporte: 'Fútbol',
      escudo: '⚽',
      ciudad: 'Santiago',
      descripcion: 'Comunidad abierta para armar partidos en la semana',
      tipoAcceso: 'publico',
      capitanId: 30,
      admins: [],
      solicitudes: [],
      statsPrivadas: false,
      jugadores: [],
      stats: { victorias: 0, empates: 0, derrotas: 0 }
    },
    {
      id: 102,
      tipo: 'comunidad',
      nombre: 'Básquet Nocturno',
      deporte: 'Básquetbol',
      escudo: '🏀',
      ciudad: 'Providencia',
      descripcion: 'Partidos de básquet los martes y jueves',
      tipoAcceso: 'publico',
      capitanId: 31,
      admins: [],
      solicitudes: [],
      statsPrivadas: false,
      jugadores: [],
      stats: { victorias: 0, empates: 0, derrotas: 0 }
    },
    {
      id: 103,
      tipo: 'comunidad',
      nombre: 'Pádel Weekend',
      deporte: 'Pádel',
      escudo: '🎾',
      ciudad: 'Las Condes',
      descripcion: 'Pádel los sábados por la mañana',
      tipoAcceso: 'publico',
      capitanId: 33,
      admins: [],
      solicitudes: [],
      statsPrivadas: false,
      jugadores: [],
      stats: { victorias: 0, empates: 0, derrotas: 0 }
    },
    {
      id: 104,
      tipo: 'comunidad',
      nombre: 'Titanes Rugby',
      deporte: 'Rugby',
      escudo: '🏉',
      ciudad: 'Santiago',
      descripcion: 'Comunidad privada, solo por invitación',
      tipoAcceso: 'privado',
      capitanId: 34,
      admins: [],
      solicitudes: [],
      statsPrivadas: true,
      jugadores: [],
      stats: { victorias: 0, empates: 0, derrotas: 0 }
    }
  ];
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
  const idx = lista.findIndex(p => p.id === Number(id));
  if (idx >= 0) {
    lista[idx] = { ...lista[idx], ...cambios };
    guardarPublicaciones(lista);
  }
  return lista[idx];
}

export function eliminarPublicacion(id) {
  const lista = (getPublicaciones() || []).filter(p => p.id !== Number(id));
  guardarPublicaciones(lista);
}

export function publicacionesDe(userId) {
  return (getPublicaciones() || []).filter(p => p.autor?.id === Number(userId));
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
  const usuarios = getUsuariosRegistrados().filter(u => u.id !== Number(userId));
  guardarUsuariosRegistrados(usuarios);

  // Limpiar sesión
  localStorage.removeItem('miejquipo_session');

  // Otras limpiezas opcionales:
  // - quitarlo de grupos
  const grupos = getGrupos();
  grupos.forEach(g => {
    g.jugadores = (g.jugadores || []).filter(j => j.id !== Number(userId));
    g.admins = (g.admins || []).filter(a => a !== Number(userId));
    g.solicitudes = (g.solicitudes || []).filter(s => s.userId !== Number(userId));
  });
  guardarGrupos(grupos);

  // - quitarlo de partidos
  const partidos = getPartidos();
  partidos.forEach(p => {
    p.inscritos = (p.inscritos || []).filter(uid => uid !== Number(userId));
    p.postulantes = (p.postulantes || []).filter(pp => pp.userId !== Number(userId));
  });
  guardarPartidos(partidos);
}