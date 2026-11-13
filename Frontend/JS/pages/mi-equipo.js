import { getSesion, obtenerUsuarioActual } from '../auth.js';
import { toast, abrirModal, cerrarModal } from '../components.js';
import { deportes } from '../data-mock.js';
import { tieneFormacion } from '../utils/reglas-deporte.js'; // ⚡ NUEVO
import {
  listarGrupos,
  obtenerGrupo,
  crearGrupo as crearGrupoAPI,
  editarGrupo as editarGrupoAPI,
  editarStats as editarStatsAPI,
  eliminarGrupo as eliminarGrupoAPI,
  unirseAGrupo as unirseAGrupoAPI,
  salirDeGrupo as salirDeGrupoAPI,
  expulsarMiembro as expulsarMiembroAPI,
  cambiarRolMiembro as cambiarRolMiembroAPI,
  listarSolicitudes as listarSolicitudesAPI,
  gestionarSolicitud as gestionarSolicitudAPI,
  editarFormacion as editarFormacionAPI,       // ⚡ NUEVO
  editarStatsJugador as editarStatsJugadorAPI, // ⚡ NUEVO
  editarFormacionAbierta as editarFormacionAbiertaAPI
} from '../services/grupos.service.js';

import {
  listarCanales as listarCanalesAPI,
  obtenerCanal as obtenerCanalAPI,
  listarMensajesDeCanal as listarMensajesDeCanalAPI,
  enviarMensajeACanal as enviarMensajeACanalAPI,
  marcarCanalLeido as marcarCanalLeidoAPI,
  eliminarCanalParaMi as eliminarCanalParaMiAPI,
  vaciarCanalParaMi as vaciarCanalParaMiAPI,
  eliminarMensajeParaMi as eliminarMensajeParaMiAPI,
  eliminarMensajeParaTodos as eliminarMensajeParaTodosAPI,
} from '../services/mensajes.service.js';

import { conectarAccionesMensaje } from '../utils/mensaje-acciones.js';
import { listarPublicacionesDeGrupo as listarPubsGrupoAPI } from '../services/publicaciones.service.js';
import { renderFeedPublicaciones, abrirModalCrearPublicacionCompartido } from '../utils/publicaciones-ui.js';
import { renderGrupoPublico } from '../utils/grupo-publico.js';

const RUTA_ESCUDO = 'assets/icons/escudo-de-seguridad.png';
const AVATAR_FALLBACK = 'assets/icons/usuario.svg';
const PALETA_BASICOS = ['#E8836A', '#3B82F6', '#22C55E', '#F59E0B', '#6366F1', '#EC4899'];

const MARCOS_ICONO = [
  { id: 'default', nombre: 'Normal', clase: '' },
  { id: 'oro', nombre: 'Oro', clase: 'marco-icono-oro' },
  { id: 'fuego', nombre: 'Fuego', clase: 'marco-icono-fuego' },
  { id: 'neon', nombre: 'Neón', clase: 'marco-icono-neon' },
  { id: 'hielo', nombre: 'Hielo', clase: 'marco-icono-hielo' },
  { id: 'galaxia', nombre: 'Galaxia', clase: 'marco-icono-galaxia' },
  { id: 'custom', nombre: 'Personalizado', clase: 'marco-icono-custom' }
];

function getMarcoData(marcoIcono, marcoColorIcono) {
  if (!marcoIcono || marcoIcono === 'default') {
    return { clase: '', estilo: '' };
  }
  if (marcoIcono === 'custom') {
    const color = marcoColorIcono || '#E8836A';
    return {
      clase: 'marco-icono-custom',
      estilo: `border:3px solid ${color};box-shadow:0 0 15px ${color}80;`,
    };
  }
  return { clase: `marco-icono-${marcoIcono}`, estilo: '' };
}

const SVG = {
  users: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  trophy: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  percent: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`,
  minus: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  x: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  medal: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  crown: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  user: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  arrowLeft: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  exit: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  userPlus: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  userMinus: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
  send: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  image: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  clip: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  search: `<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  inbox: `<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
};
// ⚡ NUEVO: Diccionario de estadísticas e íconos minimalistas por deporte
const STATS_POR_DEPORTE = {
  'Fútbol': [
    { key: 'goles', label: 'Goles', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/></svg>` },
    { key: 'asistencias', label: 'Asistencias', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>` }
  ],
  'Básquetbol': [
    { key: 'puntos', label: 'Puntos', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5"/></svg>` },
    { key: 'asistencias', label: 'Asistencias', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>` },
    { key: 'rebotes', label: 'Rebotes', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20v-8"/><path d="m8 16 4 4 4-4"/><path d="M20 12H4"/></svg>` }
  ],
  'Béisbol': [
    { key: 'carreras', label: 'Carreras', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg>` },
    { key: 'hits', label: 'Home runs', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 4H6v16h12z"/></svg>` },
    { key: 'rbi', label: 'Ponches', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7z"/></svg>` }
  ],
  'Vóleibol': [
    { key: 'puntos', label: 'Puntos', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/></svg>` },
    { key: 'aces', label: 'Aces', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="m13 2-3 9h8L11 22"/></svg>` },
    { key: 'bloqueos', label: 'Bloqueos', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>` }
  ],
  'Tenis': [
    { key: 'aces', label: 'Aces', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="m13 2-3 9h8L11 22"/></svg>` },
    { key: 'victorias', label: 'Victorias', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>` }
  ],
  'Natación': [
    { key: 'mejor_tiempo', label: 'Mejor Tiempo', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>` }
  ],
  'Atletismo': [
    { key: 'mejor_tiempo', label: 'Mejor Tiempo', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>` }
  ],
  'Ciclismo': [
    { key: 'mejor_tiempo', label: 'Mejor Tiempo', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>` }
  ],
  'Rugby': [
    { key: 'puntos', label: 'Trys', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/></svg>` },
    { key: 'tackles', label: 'Tackles', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2 5 11l4 4L18 6z"/></svg>` }
  ],
  'Hockey': [
    { key: 'goles', label: 'Goles', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/></svg>` },
    { key: 'asistencias', label: 'Asistencias', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>` }
  ],
  'Handball': [
    { key: 'goles', label: 'Goles', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/></svg>` },
    { key: 'asistencias', label: 'Asistencias', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>` }
  ],
  'Fútbol americano': [
    { key: 'tacles', label: 'Tackles', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2 5 11l4 4L18 6z"/></svg>` },
    { key: 'touchdowns', label: 'Touchdowns', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg>` }
  ],
  'Golf': [
    { key: 'birdies', label: 'Birdies', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20"/></svg>` },
    { key: 'mejor_ronda', label: 'Mejor Ronda', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>` }
  ],
  'Boxeo': [
    { key: 'kos', label: 'KOs', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 4H6v16h12z"/></svg>` },
    { key: 'victorias', label: 'Victorias', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>` }
  ]
};
const STATS_DEFAULT = [
  { key: 'partidos', label: 'Partidos', icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>` }
];

const COLOR_DEPORTE = {
  'Fútbol':            { from: '#FF6B4A', to: '#C2410C' },
  'Fútbol americano':  { from: '#DC2626', to: '#7F1D1D' },
  'Básquetbol':        { from: '#3B82F6', to: '#1E40AF' },
  'Tenis':             { from: '#22C55E', to: '#166534' },
  'Tenis de mesa':     { from: '#EC4899', to: '#9D174D' },
  'Vóleibol':          { from: '#F59E0B', to: '#92400E' },
  'Pádel':             { from: '#6366F1', to: '#3730A3' },
  'Squash':            { from: '#06B6D4', to: '#155E75' },
  'Bádminton':         { from: '#A855F7', to: '#6B21A8' },
  'Golf':              { from: '#10B981', to: '#065F46' },
  'Béisbol':           { from: '#EAB308', to: '#854D0E' },
  'Hockey':            { from: '#0EA5E9', to: '#075985' },
  'Handball':          { from: '#F43F5E', to: '#9F1239' },
  'Rugby':             { from: '#8B5CF6', to: '#5B21B6' },
  'Boxeo':             { from: '#EF4444', to: '#7F1D1D' },
  'Ciclismo':          { from: '#84CC16', to: '#3F6212' },
  'Natación':          { from: '#06B6D4', to: '#0E7490' },
  'Atletismo':         { from: '#F43F5E', to: '#BE123C' },
  'Surf':              { from: '#0EA5E9', to: '#0369A1' },
  'Escalada':          { from: '#F59E0B', to: '#B45309' },
};
const COLOR_DEFAULT = { from: '#FF6B4A', to: '#C2410C' };

function colorDeporte(deporte) {
  return COLOR_DEPORTE[deporte] || COLOR_DEFAULT;
}

export async function init() {
  let user = getSesion();
  if (!user) return null;

  if (user.esPremium === undefined) {
    try {
      user = await obtenerUsuarioActual();
    } catch (err) {
      console.error('[mi-equipo] Error al refrescar sesión:', err);
    }
  }

  const contenedorEquipo    = document.getElementById('equipo-contenido');
  const contenedorComunidad = document.getElementById('comunidad-contenido');
  const contenedorBuscar    = document.getElementById('resultados-busqueda');

  if (!contenedorEquipo) return null;

  const eyebrow = document.getElementById('mi-equipo-eyebrow');
  if (eyebrow) {
    const hoy = new Date();
    const dias = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    eyebrow.textContent = `${dias[hoy.getDay()]}, ${hoy.getDate()} DE ${meses[hoy.getMonth()]}`;
  }

  let misEquipos = [];
  let misComunidades = [];
  let filtroBusquedaEquipo = '';
  let filtroBusquedaComunidad = '';

  let grupoAbiertoEquipo = null;
  let grupoAbiertoComunidad = null;
  let subTabDetalleEquipo = 'info';
  let grupoAbiertoBuscar = null;
  let listaBusquedaActual = [];

  let canales = [];
  let canalActualId = null;
  let filtroBusquedaCanal = '';
  let intervaloCanal = null;
  let ultimoHashCanal = null;
  let ultimaCanalRenderizado = null;

  let canalDetalleId = null;
  let intervaloDetalle = null;
  let ultimoHashDetalle = null;
  let ultimaCanalDetalleRenderizado = null;

  let publicacionesEquipoCache = [];

  let imagenBase64Canal = null;
  let imagenBase64Detalle = null;

  const subtabs        = document.querySelectorAll('[data-tab-equipo]');
  const panelEquipo    = document.getElementById('panel-equipo');
  const panelComunidad = document.getElementById('panel-comunidad');
  const panelChat      = document.getElementById('panel-chat');
  const panelBuscar    = document.getElementById('panel-buscar');

  const listaCanalesEl = document.getElementById('lista-canales');
  const panelCanalEl   = document.getElementById('panel-canal');
  const inputBuscarCanal = document.getElementById('buscar-canal-equipo');

  function ocultarChromePagina() {
    document.getElementById('mi-equipo-eyebrow')?.closest('.page-hero')?.classList.add('hidden');
    document.querySelector('[data-tab-equipo]')?.closest('.subtabs')?.classList.add('hidden');
  }

  function mostrarChromePagina() {
    document.getElementById('mi-equipo-eyebrow')?.closest('.page-hero')?.classList.remove('hidden');
    document.querySelector('[data-tab-equipo]')?.closest('.subtabs')?.classList.remove('hidden');
  }

  function esIconoImagen(valor) {
    if (typeof valor !== 'string') return false;
    return /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(valor) || valor.startsWith('data:image/');
  }

  function renderIconoHtml(valor, size = 20) {
    if (esIconoImagen(valor)) {
      const esBase64 = valor.startsWith('data:image/');
      const esBandera = valor.toLowerCase().includes('flag') || 
                        valor.toLowerCase().includes('bandera') || 
                        valor.toLowerCase().includes('pais') ||
                        valor.toLowerCase().includes('redondo') ||
                        valor.toLowerCase().includes('mundo');
      
      const clase = esBase64 ? 'icono-custom' : (esBandera ? 'icono-bandera' : 'icono-deporte');
      const estilo = (esBase64 && size > 30)
        ? 'width:100%;height:100%;object-fit:cover;border-radius:inherit;' 
        : `width:${size}px;height:${size}px;object-fit:contain;`;

      return `<img src="${valor}" alt="icono" class="${clase}" style="${estilo}vertical-align:middle;display:inline-block" />`;
    }
    return `<span style="font-size:${size}px;line-height:1;vertical-align:middle">${valor || SVG.shield}</span>`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function horaCorta(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const hoy = new Date();
    const mismoDia = d.toDateString() === hoy.toDateString();
    if (mismoDia) return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  }

  function mismoDia(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function labelDia(iso) {
    const d = new Date(iso);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    if (mismoDia(d, hoy))  return 'Hoy';
    if (mismoDia(d, ayer)) return 'Ayer';
    const difDias = Math.floor((hoy - d) / (1000 * 60 * 60 * 24));
    if (difDias < 7) {
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      return dias[d.getDay()];
    }
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  }

  function avatarDe(usuario) {
    return usuario?.avatar || AVATAR_FALLBACK;
  }

  function abrirModalVerImagen(src) {
    const img = document.getElementById('modal-imagen-img');
    const modal = document.getElementById('modal-ver-imagen');
    if (!img || !modal) return;
    img.src = src;
    abrirModal('modal-ver-imagen');
    modal.querySelectorAll('[data-cerrar-modal]').forEach(btn => { btn.onclick = () => cerrarModal('modal-ver-imagen'); });
    modal.onclick = (e) => { if (e.target.id === 'modal-ver-imagen') cerrarModal('modal-ver-imagen'); };
  }

  function mostrarPreviewImagen(panelId, src) {
    const wrapper = document.getElementById(`${panelId}-preview`);
    const img = document.getElementById(`${panelId}-preview-img`);
    if (!wrapper || !img) return;
    img.src = src;
    wrapper.classList.remove('hidden');
  }

  function ocultarPreviewImagen(panelId) {
    const wrapper = document.getElementById(`${panelId}-preview`);
    const img = document.getElementById(`${panelId}-preview-img`);
    if (!wrapper || !img) return;
    img.src = '';
    wrapper.classList.add('hidden');
  }

  async function recargarGrupos() {
    try {
      const [resEquipos, resComunidades] = await Promise.all([
        listarGrupos({ tipo: 'equipo', soloMios: 'true', limit: 50 }),
        listarGrupos({ tipo: 'comunidad', soloMios: 'true', limit: 50 }),
      ]);
      misEquipos = resEquipos.data || [];
      misComunidades = resComunidades.data || [];
    } catch (err) {
      console.error('[mi-equipo] Error al cargar grupos:', err);
      toast('No se pudieron cargar tus grupos', 'error');
      misEquipos = [];
      misComunidades = [];
    }
  }

  function filtrarGrupos(lista, texto) {
    if (!texto) return lista;
    const q = texto.toLowerCase().trim();
    return lista.filter(g =>
      (g.nombre || '').toLowerCase().includes(q) ||
      (g.deporte || '').toLowerCase().includes(q) ||
      (g.ciudad || '').toLowerCase().includes(q)
    );
  }

  function formatearFechaCorta(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return '—'; }
  }

  function calcularPartidos(stats) {
    const v = stats?.victorias ?? 0;
    const e = stats?.empates ?? 0;
    const d = stats?.derrotas ?? 0;
    return v + e + d;
  }

  function calcularPorcentaje(stats) {
    const v = stats?.victorias ?? 0;
    const total = calcularPartidos(stats);
    if (total === 0) return null;
    return Math.round((v / total) * 100);
  }

  function statEsVisible(valor) {
    return valor !== null && valor !== undefined;
  }

  const HERO_COLORS = [
    { key: 'navy',    label: 'Navy',     from: '#0F1B2D', to: '#1E2D45', text: 'light' },
    { key: 'black',   label: 'Negro',    from: '#0A0A0A', to: '#1F1F1F', text: 'light' },
    { key: 'carbon',  label: 'Carbón',   from: '#1F2937', to: '#374151', text: 'light' },
    { key: 'blue',    label: 'Azul',     from: '#1E3A8A', to: '#2563EB', text: 'light' },
    { key: 'forest',  label: 'Bosque',   from: '#064E3B', to: '#047857', text: 'light' },
    { key: 'purple',  label: 'Púrpura',  from: '#4C1D95', to: '#7C3AED', text: 'light' },
    { key: 'wine',    label: 'Vino',     from: '#7F1D1D', to: '#B91C1C', text: 'light' },
    { key: 'coffee',  label: 'Café',     from: '#451A03', to: '#78350F', text: 'light' },
    { key: 'mustard', label: 'Mostaza',  from: '#92400E', to: '#CA8A04', text: 'light' },
    { key: 'red',     label: 'Rojo',     from: '#DC2626', to: '#EF4444', text: 'light' },
    { key: 'orange',  label: 'Naranjo',  from: '#EA580C', to: '#FB923C', text: 'light' },
    { key: 'white',   label: 'Blanco',   from: '#FFFFFF', to: '#F5F5F5', text: 'dark'  },
  ];

  function renderPaleta(containerId, colorSeleccionado, onChange) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    cont.innerHTML = HERO_COLORS.map(c => `
      <button type="button" class="perfil-color-btn ${c.from === colorSeleccionado ? 'active' : ''}" data-color="${c.from}" title="${c.label}" style="background: linear-gradient(135deg, ${c.from} 0%, ${c.to} 100%); width:32px; height:32px; border-radius:50%; border:none; cursor:pointer; margin:0 4px;"></button>
    `).join('');

    cont.querySelectorAll('.perfil-color-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        cont.querySelectorAll('.perfil-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onChange(btn.dataset.color);
      });
    });
  }

  function inicializarMarcosGrupo(grupo) {
    let marcoIconoSel = grupo?.marcoIcono || 'default';
    let marcoColorIconoSel = grupo?.marcoColorIcono || '#E8836A';

    const contMarcos = document.getElementById('grupo-marcos-icono');
    const colorWrapper = document.getElementById('grupo-marco-color-wrapper');
    const inputColor = document.getElementById('grupo-marco-color-icono');

    if (inputColor) inputColor.value = marcoColorIconoSel;

    if (contMarcos) {
      contMarcos.innerHTML = MARCOS_ICONO.map(m => `
        <button type="button" class="posicion-chip ${m.id === marcoIconoSel ? 'active' : ''}" data-marco="${m.id}">${m.nombre}</button>
      `).join('');

      if (colorWrapper) {
        colorWrapper.style.display = marcoIconoSel === 'custom' ? 'flex' : 'none';
      }

      contMarcos.querySelectorAll('[data-marco]').forEach(btn => {
        btn.addEventListener('click', () => {
          contMarcos.querySelectorAll('[data-marco]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          marcoIconoSel = btn.dataset.marco;
          if (colorWrapper) {
            colorWrapper.style.display = marcoIconoSel === 'custom' ? 'flex' : 'none';
          }
        });
      });
    }

    if (inputColor) {
      inputColor.oninput = (e) => {
        marcoColorIconoSel = e.target.value;
      };
    }

    return {
      getMarcoIcono: () => marcoIconoSel,
      getMarcoColorIcono: () => marcoColorIconoSel,
    };
  }

  function renderCardGrupo(grupo, esComunidad) {
    const capitan = grupo.esCapitan;
    const admin   = grupo.esAdmin;
    const esMiembro = grupo.esMiembro || capitan || admin;

    const miembrosCount = grupo.totalMiembros || 0;
    const partidos = calcularPartidos(grupo.stats);
    const porcentaje = calcularPorcentaje(grupo.stats);

    const victoriasVisibles = statEsVisible(grupo.stats?.victorias);
    const mostrarPorcentaje = victoriasVisibles && partidos > 0;

    let badgeRolHtml = '';
    if (capitan) {
      badgeRolHtml = `<span class="badge badge--primary" title="Eres capitán">${SVG.crown}</span>`;
    } else if (admin) {
      badgeRolHtml = `<span class="badge badge--warning" title="Sub-capitán">${SVG.crown}</span>`;
    } else {
      badgeRolHtml = `<span class="badge badge--neutral" title="Miembro">${SVG.user}</span>`;
    }

    const puedeEditar = capitan || admin;
    const lapizHtml = puedeEditar ? `
      <button class="grupo-card__edit" data-accion-grupo="editar" data-id="${grupo.id}" title="Editar">
        ${SVG.edit}
      </button>
    ` : '';

    const color = colorDeporte(grupo.deporte);
    const escudoHtml = renderIconoHtml(grupo.iconoPersonalizado || grupo.escudo || RUTA_ESCUDO, 36);
    
    let bannerStyle = `background: linear-gradient(135deg, ${color.from} 0%, ${color.to} 100%);`;
    if (grupo.cardColor) {
      bannerStyle = `background: linear-gradient(135deg, ${grupo.cardColor} 0%, ${grupo.cardColor}DD 100%);`;
    }
    if (grupo.cardFoto) {
      bannerStyle = `background-image: url('${grupo.cardFoto}'); background-size: cover; background-position: center;`;
    }

    const marco = getMarcoData(grupo.marcoIcono, grupo.marcoColorIcono);

    const descripcionHtml = grupo.descripcion
      ? `<p class="grupo-card__desc">${grupo.descripcion}</p>`
      : `<p class="grupo-card__desc grupo-card__desc--vacia">Sin descripción</p>`;

    return `
      <article class="grupo-card" data-grupo-id="${grupo.id}" role="button" tabindex="0">
        <div class="grupo-card__banner" style="${bannerStyle}">
          ${lapizHtml}
        </div>

        <div class="grupo-card__crest ${marco.clase}" style="${marco.estilo}">
          ${escudoHtml}
        </div>

        <div class="grupo-card__body">
          <div class="grupo-card__rol">
            ${badgeRolHtml}
          </div>

          <h3 class="grupo-card__title">${grupo.nombre}</h3>

          <p class="grupo-card__deporte">${grupo.deporte}${grupo.ciudad ? ' · ' + grupo.ciudad : ''}</p>

          ${descripcionHtml}

          ${esComunidad ? `
            <div class="grupo-card__stats grupo-card__stats--1">
              <div class="grupo-stat">
                <div class="grupo-stat__value">${miembrosCount}</div>
                <div class="grupo-stat__label">Miembros</div>
              </div>
            </div>
          ` : `
            <div class="grupo-card__stats ${mostrarPorcentaje ? '' : 'grupo-card__stats--2'}">
              <div class="grupo-stat">
                <div class="grupo-stat__value">${miembrosCount}</div>
                <div class="grupo-stat__label">Miembros</div>
              </div>
              <div class="grupo-stat">
                <div class="grupo-stat__value">${partidos}</div>
                <div class="grupo-stat__label">Partidos</div>
              </div>
              ${mostrarPorcentaje ? `
                <div class="grupo-stat">
                  <div class="grupo-stat__value">${porcentaje}%</div>
                  <div class="grupo-stat__label">Victorias</div>
                </div>
              ` : ''}
            </div>
          `}
        </div>
      </article>
    `;
  }

  async function renderDetalleGrupo(grupo, esComunidad, volverFn, esPublico = false) {
    if (esPublico) {
      const contenedor = document.getElementById('resultados-busqueda');
      if (!contenedor) return;
      ocultarChromePagina();
      const panelBuscar = document.getElementById('panel-buscar');
      const filtrosCard = panelBuscar?.querySelector('.card');
      if (filtrosCard) filtrosCard.classList.add('hidden');
      await renderGrupoPublico(contenedor, grupo.id, {
        onVolver: () => {
          mostrarChromePagina();
          if (filtrosCard) filtrosCard.classList.remove('hidden');
          grupoAbiertoBuscar = null;
          renderPanelBuscar();
        }
      });
      return;
    }

    ocultarChromePagina();

    const capitan = grupo.esCapitan;
    const admin   = grupo.esAdmin;
    const esMiembro = grupo.esMiembro || capitan || admin;

    const color = colorDeporte(grupo.deporte);
    
    // ⚡ Fallback: si no hay Hero configurado, usa la Card
    const fotoHero = grupo.heroFoto || grupo.cardFoto;
    const colorHero = grupo.heroColor || grupo.cardColor;
    
    let heroStyle = `background: linear-gradient(135deg, ${color.from} 0%, ${color.to} 100%);`;
    if (fotoHero) {
      heroStyle = `background-image: linear-gradient(180deg, rgba(15,27,45,0.10) 0%, rgba(15,27,45,0.55) 100%), url('${fotoHero}'); background-size: cover; background-position: center;`;
    } else if (colorHero) {
      heroStyle = `background: linear-gradient(135deg, ${colorHero} 0%, ${colorHero}DD 100%);`;
    }

    const partidos = calcularPartidos(grupo.stats);
    const victorias = grupo.stats?.victorias;
    const empates   = grupo.stats?.empates;
    const derrotas  = grupo.stats?.derrotas;
    const porcentaje = calcularPorcentaje(grupo.stats);

    const victoriasVisibles = statEsVisible(victorias);
    const empatesVisibles   = statEsVisible(empates);
    const derrotasVisibles  = statEsVisible(derrotas);

    const iconoTipoHtml = esComunidad ? SVG.globe : SVG.users;
    const labelTipo = esComunidad ? 'Comunidad' : 'Equipo';
    const labelMiembros = esComunidad ? 'miembros' : 'jugadores';

    const escudoHero = renderIconoHtml(grupo.iconoPersonalizado || grupo.escudo || RUTA_ESCUDO, 48);

    const marcoHero = getMarcoData(grupo.marcoIcono, grupo.marcoColorIcono);

    let botonesHtml = '';

    if (capitan) {
      botonesHtml = `
        <button class="btn gd-hero__action gd-hero__action--primary" data-accion-grupo="invitar" data-id="${grupo.id}">
          ${SVG.userPlus} Invitar
        </button>
        <button class="btn gd-hero__action gd-hero__action--primary" data-accion-grupo="gestionar" data-id="${grupo.id}">
          ${SVG.users} Gestionar miembros
        </button>
          ${(grupo.totalSolicitudes || 0) > 0 ? `<span class="badge badge--primary" style="margin-left:6px">${grupo.totalSolicitudes}</span>` : ''}
        </button>
        <button class="btn gd-hero__action" data-accion-grupo="editar" data-id="${grupo.id}">
          ${SVG.edit} Editar
        </button>
        ${!esComunidad ? `
          <button class="btn gd-hero__action" data-accion-grupo="stats" data-id="${grupo.id}">
            ${SVG.chart} Editar stats
          </button>
        ` : ''}
        <button class="btn gd-hero__action gd-hero__action--danger" data-accion-grupo="eliminar" data-id="${grupo.id}">
          ${SVG.trash} Eliminar
        </button>
      `;
    } else if (admin) {
      botonesHtml = `
        <button class="btn gd-hero__action gd-hero__action--primary" data-accion-grupo="invitar" data-id="${grupo.id}">
          ${SVG.userPlus} Invitar
        </button>
        <button class="btn gd-hero__action gd-hero__action--primary" data-accion-grupo="gestionar" data-id="${grupo.id}">
          ${SVG.users} Gestionar miembros
        </button>
          ${(grupo.totalSolicitudes || 0) > 0 ? `<span class="badge badge--primary" style="margin-left:6px">${grupo.totalSolicitudes}</span>` : ''}
        </button>
        <button class="btn gd-hero__action" data-accion-grupo="editar" data-id="${grupo.id}">
          ${SVG.edit} Editar
        </button>
        ${!esComunidad ? `
          <button class="btn gd-hero__action" data-accion-grupo="stats" data-id="${grupo.id}">
            ${SVG.chart} Editar stats
          </button>
        ` : ''}
      `;
    } else {
      botonesHtml = `
        <button class="btn gd-hero__action gd-hero__action--danger" data-accion-grupo="salir" data-id="${grupo.id}">
          ${SVG.exit} Salir ${esComunidad ? 'de la comunidad' : 'del equipo'}
        </button>
      `;
    }

    const contenedor = esComunidad ? document.getElementById('comunidad-contenido') : document.getElementById('equipo-contenido');
    if (!contenedor) return;

    // ⚡ NUEVA LÓGICA: Añadimos "Formación" si el deporte lo permite
    const botonesSubtabs = esComunidad ? [
      { id: 'publicaciones', icono: SVG.image, label: 'Publicaciones' },
      { id: 'chat', icono: SVG.chat, label: 'Chat' },
      { id: 'plantilla', icono: SVG.users, label: 'Plantilla' },
      { id: 'info', icono: SVG.medal, label: 'Información' }
    ] : [
      { id: 'chat', icono: SVG.chat, label: 'Chat' },
      { id: 'publicaciones', icono: SVG.image, label: 'Publicaciones' },
      { id: 'plantilla', icono: SVG.users, label: 'Plantilla' },
      ...(tieneFormacion(grupo.deporte) ? [{ id: 'formacion', icono: SVG.pin, label: 'Formación' }] : []),
      { id: 'info', icono: SVG.medal, label: 'Información' }
    ];

    const subtabActivo = subTabDetalleEquipo;

    const subtabsDetalleHtml = `
      <div class="subtabs subtabs--detalle mb-4" id="gd-subtabs">
        ${botonesSubtabs.map(btn => `
          <button class="subtab ${subtabActivo === btn.id ? 'subtab--active' : ''}" data-subtab-grupo="${btn.id}">
            ${btn.icono}
            ${btn.label}
          </button>
        `).join('')}
      </div>

      <div id="gd-subtab-contenido"></div>
    `;

    contenedor.innerHTML = `
      <div class="gd-top">
        <button class="gd-top__volver" id="gd-btn-volver">
          ${SVG.arrowLeft}
          Volver
        </button>
      </div>

      <div class="gd-hero" style="${heroStyle}">
        <div class="gd-hero__left">
          <div class="gd-hero__crest ${marcoHero.clase}" style="${marcoHero.estilo}">
            ${escudoHero}
          </div>
          <div class="gd-hero__info">
            <div class="gd-hero__badges">
              <span class="badge">${iconoTipoHtml} ${labelTipo}</span>
              <span class="badge">
                ${grupo.tipoAcceso === 'privado' ? SVG.lock + ' Privado' : SVG.globe + ' Público'}
              </span>
              ${capitan ? `<span class="badge">${SVG.crown} Capitán</span>` : ''}
              ${admin && !capitan ? `<span class="badge">${SVG.crown} Sub-capitán</span>` : ''}
            </div>
            <h1 class="gd-hero__title">${grupo.nombre}</h1>
            ${grupo.descripcion ? `
              <p class="gd-hero__desc">${grupo.descripcion}</p>
            ` : ''}
          </div>
        </div>

        <div class="gd-hero__actions">
          ${botonesHtml}
        </div>
      </div>

      ${subtabActivo === 'info' ? `
        ${esComunidad ? `
          <div class="gd-stats">
            <div class="gd-stat">
              <div class="gd-stat__icon">${SVG.users}</div>
              <div class="gd-stat__texto">
                <div class="gd-stat__value">${grupo.totalMiembros || 0}</div>
                <div class="gd-stat__label">Miembros</div>
              </div>
            </div>
          </div>
        ` : `
          <div class="gd-stats">
            <div class="gd-stat">
              <div class="gd-stat__icon">${SVG.users}</div>
              <div class="gd-stat__texto">
                <div class="gd-stat__value">${grupo.totalMiembros || 0}</div>
                <div class="gd-stat__label">Miembros</div>
              </div>
            </div>

            <div class="gd-stat">
              <div class="gd-stat__icon">${SVG.trophy}</div>
              <div class="gd-stat__texto">
                <div class="gd-stat__value">${partidos}</div>
                <div class="gd-stat__label">Partidos</div>
              </div>
            </div>

            ${victoriasVisibles ? `
              <div class="gd-stat">
                <div class="gd-stat__icon">${SVG.check}</div>
                <div class="gd-stat__texto">
                  <div class="gd-stat__value">${victorias}</div>
                  <div class="gd-stat__label">Victorias</div>
                </div>
              </div>
            ` : ''}

            ${empatesVisibles ? `
              <div class="gd-stat">
                <div class="gd-stat__icon">${SVG.minus}</div>
                <div class="gd-stat__texto">
                  <div class="gd-stat__value">${empates}</div>
                  <div class="gd-stat__label">Empates</div>
                </div>
              </div>
            ` : ''}

            ${derrotasVisibles ? `
              <div class="gd-stat">
                <div class="gd-stat__icon">${SVG.x}</div>
                <div class="gd-stat__texto">
                  <div class="gd-stat__value">${derrotas}</div>
                  <div class="gd-stat__label">Derrotas</div>
                </div>
              </div>
            ` : ''}

            ${victoriasVisibles && porcentaje !== null ? `
              <div class="gd-stat">
                <div class="gd-stat__icon">${SVG.percent}</div>
                <div class="gd-stat__texto">
                  <div class="gd-stat__value">${porcentaje}%</div>
                  <div class="gd-stat__label">Victorias</div>
                </div>
              </div>
            ` : ''}
          </div>
        `}
      ` : ''}

      ${subtabsDetalleHtml}
    `;

    document.getElementById('gd-btn-volver')?.addEventListener('click', volverFn);

    contenedor.querySelectorAll('[data-accion-grupo]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const accion = btn.dataset.accionGrupo;
        if (accion === 'editar')              abrirModalEditarGrupo(grupo, esComunidad);
        if (accion === 'gestionar')           abrirModalGestionar(grupo);
        if (accion === 'stats')               abrirModalStats(grupo);
        if (accion === 'eliminar')            confirmarEliminarGrupo(grupo, esComunidad);
        if (accion === 'salir')               confirmarSalirGrupo(grupo, esComunidad);
        if (accion === 'cancelar-solicitud')  cancelarSolicitudUI(grupo, esComunidad);
        
        // ⚡ SOLO DEJA ESTA LÍNEA:
        if (accion === 'invitar')             abrirModalInvitarGrupo(grupo); 
      });
    });

    contenedor.querySelectorAll('[data-subtab-grupo]').forEach(btn => {
      btn.addEventListener('click', async () => {
        subTabDetalleEquipo = btn.dataset.subtabGrupo;
        if (subTabDetalleEquipo !== 'chat') {
          if (intervaloDetalle) {
            clearInterval(intervaloDetalle);
            intervaloDetalle = null;
          }
        }
        await renderDetalleGrupo(grupo, esComunidad, volverFn, false);
      });
    });

    const contSubtabs = document.getElementById('gd-subtab-contenido');
    if (contSubtabs) {
      if (subTabDetalleEquipo === 'info') {
        await renderSubtabInfo(contSubtabs, grupo, esComunidad, capitan, admin, labelMiembros);
      } else if (subTabDetalleEquipo === 'plantilla') {
        await renderSubtabPlantilla(contSubtabs, grupo);
      } else if (subTabDetalleEquipo === 'chat') {
        await renderSubtabChat(contSubtabs, grupo);
      } else if (subTabDetalleEquipo === 'publicaciones') {
        await renderSubtabPublicaciones(contSubtabs, grupo, esComunidad, esMiembro, capitan, admin);
      } else if (subTabDetalleEquipo === 'formacion') {
        await renderSubtabFormacion(contSubtabs, grupo);
      }
    }
  }

  async function renderSubtabInfo(cont, grupo, esComunidad, capitan, admin, labelMiembros) {
    cont.innerHTML = `
      <div class="gd-col">
        <div class="gd-card">
          <div class="gd-card__eyebrow">Información</div>
          <h3 class="gd-card__title">Sobre ${esComunidad ? 'la comunidad' : 'el equipo'}</h3>

          ${grupo.descripcion ? `
            <p class="gd-card__description">${grupo.descripcion}</p>
          ` : `
            <p class="gd-card__description text-muted">Sin descripción.</p>
          `}

          <div class="gd-info-grid">
            <div class="gd-info-item">
              <div class="gd-info-item__icon">${SVG.medal}</div>
              <div>
                <div class="gd-info-item__label">Deporte</div>
                <div class="gd-info-item__value">${grupo.deporte}</div>
              </div>
            </div>

            <div class="gd-info-item">
              <div class="gd-info-item__icon">${SVG.pin}</div>
              <div>
                <div class="gd-info-item__label">Ciudad</div>
                <div class="gd-info-item__value">${grupo.ciudad || '—'}</div>
              </div>
            </div>

            <div class="gd-info-item">
              <div class="gd-info-item__icon">${grupo.tipoAcceso === 'privado' ? SVG.lock : SVG.globe}</div>
              <div>
                <div class="gd-info-item__label">Visibilidad</div>
                <div class="gd-info-item__value">${grupo.tipoAcceso === 'privado' ? 'Privado' : 'Público'}</div>
              </div>
            </div>

            <div class="gd-info-item">
              <div class="gd-info-item__icon">${SVG.users}</div>
              <div>
                <div class="gd-info-item__label">Miembros</div>
                <div class="gd-info-item__value">${grupo.totalMiembros || 0} ${labelMiembros}</div>
              </div>
            </div>

            <div class="gd-info-item">
              <div class="gd-info-item__icon">${SVG.calendar}</div>
              <div>
                <div class="gd-info-item__label">Creado</div>
                <div class="gd-info-item__value">${formatearFechaCorta(grupo.createdAt)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function renderSubtabPlantilla(cont, grupo) {
    cont.innerHTML = `
      <div class="gd-card">
        <div class="gd-card__eyebrow">Plantilla</div>
        <h3 class="gd-card__title">
          ${grupo.tipo === 'comunidad' ? 'Miembros' : 'Jugadores'} (${grupo.totalMiembros || 0})
        </h3>
        <div id="gd-miembros" class="gd-jugadores">
          <div class="gd-empty">
            <div class="gd-empty__icon">${SVG.user}</div>
            <p class="gd-empty__text">Cargando miembros...</p>
          </div>
        </div>
      </div>
    `;
    await cargarMiembrosDeGrupo(grupo.id);
  }

  async function renderSubtabChat(cont, grupo) {
    cont.innerHTML = `
      <div class="chat-layout chat-layout--torneo">
        <section class="chat-layout__panel" id="panel-canal-detalle">
          <div class="page-loader" style="height: 100%; display: flex; align-items: center; justify-content: center;">
            <div class="spinner"></div>
            <span style="margin-left: 10px; color: var(--color-text-muted);">Cargando chat...</span>
          </div>
        </section>
      </div>
    `;

    const canalId = `grupo-${grupo.id}`;
    canalDetalleId = canalId;
    ultimoHashDetalle = null;
    ultimaCanalDetalleRenderizado = null;
    imagenBase64Detalle = null;

    if (intervaloDetalle) clearInterval(intervaloDetalle);

    try { await marcarCanalLeidoAPI(canalId); } catch (err) {}

    await renderPanelCanalDetalle(canalId, grupo);

    const panel = document.getElementById('panel-canal-detalle');
    if (panel && !panel.querySelector('#chat-mensajes-detalle')) {
      panel.innerHTML = `
        <div class="chat-empty">
          <div class="chat-empty__icon">
            <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <p class="chat-empty__text">No se pudo conectar con el chat en este momento.</p>
        </div>
      `;
      if (intervaloDetalle) { clearInterval(intervaloDetalle); intervaloDetalle = null; }
      return;
    }

    intervaloDetalle = setInterval(async () => {
      if (canalDetalleId === canalId) await refrescarMensajesDetalle(canalId);
    }, 3000);
  }

  async function renderPanelCanalDetalle(canalId, grupo) {
    const panel = document.getElementById('panel-canal-detalle');
    if (!panel) return;

    try { await obtenerCanalAPI(canalId); }
    catch (err) {
      panel.innerHTML = `
        <div class="chat-empty">
          <div class="chat-empty__icon">
            <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <p class="chat-empty__text">No se pudo cargar el chat</p>
        </div>`;
      return;
    }

    panel.innerHTML = `
      <div class="chat-mensajes" id="chat-mensajes-detalle"></div>
      <div class="chat-input-preview hidden" id="chat-detalle-preview">
        <div class="chat-input-preview__img-wrapper">
          <img id="chat-detalle-preview-img" src="" alt="" />
          <button type="button" class="chat-input-preview__del" id="chat-detalle-preview-del" title="Quitar">✕</button>
        </div>
      </div>
      <form class="chat-input" id="chat-form-detalle">
        <label class="chat-input__attach" title="Adjuntar imagen">
          ${SVG.clip}
          <input type="file" id="chat-detalle-file" accept="image/*" style="display:none" />
        </label>
        <input type="text" id="chat-input-detalle" placeholder="Escribí un mensaje..." maxlength="2000" autocomplete="off" />
        <button type="submit" class="chat-input__btn" title="Enviar">${SVG.send}</button>
      </form>
    `;

    document.getElementById('chat-detalle-file')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) { toast('La imagen es muy grande (máx 3MB)', 'error'); e.target.value = ''; return; }
      const reader = new FileReader();
      reader.onload = (ev) => { imagenBase64Detalle = ev.target.result; mostrarPreviewImagen('chat-detalle', imagenBase64Detalle); };
      reader.readAsDataURL(file); e.target.value = '';
    });

    document.getElementById('chat-detalle-preview-del')?.addEventListener('click', () => {
      imagenBase64Detalle = null; ocultarPreviewImagen('chat-detalle');
    });

    document.getElementById('chat-form-detalle')?.addEventListener('submit', async (e) => {
      e.preventDefault(); await enviarMensajeEnDetalle(canalId);
    });

    await refrescarMensajesDetalle(canalId);
  }

  async function refrescarMensajesDetalle(canalId) {
    const cont = document.getElementById('chat-mensajes-detalle');
    if (!cont) return;

    let mensajes;
    try { mensajes = await listarMensajesDeCanalAPI(canalId); }
    catch (err) { return; }

    const hash = mensajes.map(m => `${m.id}:${m.texto || ''}:${m.imagen ? 'img' : ''}:${m.createdAt}`).join('|');
    const cambioDeCanal = ultimaCanalDetalleRenderizado !== canalId;
    if (!cambioDeCanal && hash === ultimoHashDetalle) return;
    ultimoHashDetalle = hash;
    ultimaCanalDetalleRenderizado = canalId;

    if (mensajes.length === 0) {
      cont.innerHTML = `<div class="chat-mensajes__empty"><div class="chat-mensajes__empty-icon"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><p>Aún no hay mensajes.</p><p class="text-xs" style="margin-top:4px">¡Escribí el primero!</p></div>`;
      return;
    }

    const estabaAbajo = cont.scrollHeight - cont.scrollTop - cont.clientHeight < 50;
    let html = ''; let diaAnterior = null;

    mensajes.forEach((m, idx) => {
      const fecha = new Date(m.createdAt); const dia = fecha.toDateString();
      if (dia !== diaAnterior) { html += `<div class="chat-dia">${labelDia(m.createdAt)}</div>`; diaAnterior = dia; }
      const esMio = String(m.autorId) === String(user.id);
      const tieneTexto = !!m.texto; const tieneImagen = !!m.imagen; const soloImagen = tieneImagen && !tieneTexto;

      html += `
        <div class="msg ${esMio ? 'msg--yo' : ''} ${m.eliminadoParaTodos ? 'msg--eliminado' : ''}" data-msg-id="${m.id}" data-msg-autor-id="${m.autorId}">
          ${!m.eliminadoParaTodos ? `<button class="msg-menu-btn" type="button" data-msg-menu-btn title="Opciones"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg></button>` : ''}
          ${!esMio ? `<img src="${avatarDe(m.autor)}" class="msg__avatar" alt="" />` : ''}
          <div class="msg__burbuja ${soloImagen ? 'msg__burbuja--solo-imagen' : ''}">
            ${!esMio ? `<div class="msg__autor">${escapeHtml(m.autor?.nombre || 'Usuario')}</div>` : ''}
            ${m.eliminadoParaTodos ? `<div class="msg__eliminado"><img src="assets/icons/prohibido.png" alt="" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;display:inline-block;margin-right:4px;" /> Mensaje eliminado</div>` : (tieneTexto ? `<div class="msg__texto">${escapeHtml(m.texto)}</div>` : '')}
            ${tieneImagen && !m.eliminadoParaTodos ? `<div class="msg__imagen-wrapper" data-ver-imagen-detalle="${idx}"><img src="${m.imagen}" alt="" loading="lazy" /></div>` : ''}
            <div class="msg__meta"><span class="msg__hora">${horaCorta(m.createdAt)}</span></div>
          </div>
        </div>`;
    });

    cont.innerHTML = html;
    cont.querySelectorAll('[data-ver-imagen-detalle]').forEach(el => {
      el.addEventListener('click', () => { const idx = Number(el.dataset.verImagenDetalle); if (mensajes[idx]?.imagen) abrirModalVerImagen(mensajes[idx].imagen); });
    });

    conectarAccionesMensaje(cont, {
      usuarioId: user.id,
      obtenerMensajePorId: (id) => mensajes.find(m => String(m.id) === String(id)),
      onCopiar: (texto) => navigator.clipboard.writeText(texto),
      onEliminarParaMi: (id) => eliminarMensajeParaMiAPI(id),
      onEliminarParaTodos: (id) => eliminarMensajeParaTodosAPI(id),
      onRefrescar: () => refrescarMensajesDetalle(canalId),
    });

    if (estabaAbajo || mensajes.length <= 2) cont.scrollTop = cont.scrollHeight;
    try { await marcarCanalLeidoAPI(canalId); } catch (err) {}
  }

  async function enviarMensajeEnDetalle(canalId) {
    const input = document.getElementById('chat-input-detalle');
    if (!input) return;
    const texto = input.value.trim(); const imagen = imagenBase64Detalle;
    if (!texto && !imagen) return;

    input.value = ''; imagenBase64Detalle = null; ocultarPreviewImagen('chat-detalle'); input.focus();
    try {
      await enviarMensajeACanalAPI(canalId, texto || null, imagen || null);
      await refrescarMensajesDetalle(canalId);
    } catch (err) { toast(err.message || 'No se pudo enviar el mensaje', 'error'); }
  }

  async function renderSubtabPublicaciones(cont, grupo, esComunidad, esMiembro, capitan, admin) {
    cont.innerHTML = `<div class="pubs-subtab-wrapper" id="pubs-grupo-contenido"><div class="page-loader"><div class="spinner"></div><span>Cargando publicaciones...</span></div></div>`;
    const wrapper = document.getElementById('pubs-grupo-contenido');
    if (!wrapper) return;

    try { publicacionesEquipoCache = await listarPubsGrupoAPI(grupo.id); }
    catch (err) { wrapper.innerHTML = `<div class="pubs-subtab-empty"><div class="pubs-subtab-empty__icon">${SVG.alert}</div><h3 class="pubs-subtab-empty__titulo">No se pudieron cargar</h3><p class="pubs-subtab-empty__text">${err.message || ''}</p></div>`; return; }

    const puedePublicar = esMiembro;
    wrapper.innerHTML = `
      <div class="perfil-pubs-header mb-4" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <h3 class="card__title" style="margin:0">Publicaciones de ${grupo.nombre}</h3>
        ${puedePublicar ? `<button class="btn btn--primary btn--sm" id="btn-nueva-pub-grupo"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nueva publicación</button>` : ''}
      </div>
      <div id="feed-grupo-contenido"></div>
    `;

    const feedCont = document.getElementById('feed-grupo-contenido');
    renderFeedPublicaciones(feedCont, publicacionesEquipoCache, { onRefrescar: () => renderSubtabPublicaciones(cont, grupo, esComunidad, esMiembro, capitan, admin) });

    document.getElementById('btn-nueva-pub-grupo')?.addEventListener('click', () => {
      abrirModalCrearPublicacionCompartido('grupo', grupo.id, () => renderSubtabPublicaciones(cont, grupo, esComunidad, esMiembro, capitan, admin), { tipo: 'post', esComunidad });
    });
  }

  async function cargarMiembrosDeGrupo(grupoId) {
    const cont = document.getElementById('gd-miembros');
    if (!cont) return;

    try {
      const grupoCompleto = await obtenerGrupo(grupoId);
      const miembros = grupoCompleto.miembros || [];

      if (miembros.length === 0) {
        cont.innerHTML = `<div class="gd-empty"><div class="gd-empty__icon">${SVG.user}</div><p class="gd-empty__text">Aún no hay miembros.</p></div>`;
        return;
      }

      const soyCapitan = grupoCompleto.esCapitan; const soyAdmin = grupoCompleto.esAdmin;

      const statsDeEsteDeporte = STATS_POR_DEPORTE[grupoCompleto.deporte] || STATS_DEFAULT;

      cont.innerHTML = miembros.map(j => {
        const esElCapitan = j.rol === 'capitan'; const esSubCapitan = j.rol === 'admin';
        const soyYoMismo = String(j.id) === String(user.id); const avatar = j.avatar || AVATAR_FALLBACK;

        let puedeAbrirMenu = false;
        if (soyCapitan && !soyYoMismo) puedeAbrirMenu = true;
        else if (soyAdmin && !soyYoMismo && !esElCapitan && !esSubCapitan) puedeAbrirMenu = true;

        let opcionesMenu = '';
        if (puedeAbrirMenu) {
          const puedeNombrarSub = soyCapitan && !esSubCapitan; const puedeQuitarSub = soyCapitan && esSubCapitan; const puedeExpulsar = soyCapitan || (!esElCapitan && !esSubCapitan);
          if (puedeNombrarSub) opcionesMenu += `<button class="gd-jugador__dropdown-item" data-nombrar-sub="${j.id}">${SVG.crown} Hacer sub-capitán</button>`;
          if (puedeQuitarSub) opcionesMenu += `<button class="gd-jugador__dropdown-item" data-quitar-sub="${j.id}">${SVG.userMinus} Quitar sub-capitán</button>`;
          if (puedeExpulsar) opcionesMenu += `<button class="gd-jugador__dropdown-item gd-jugador__dropdown-item--danger" data-expulsar-miembro="${j.id}">${SVG.trash} Expulsar del equipo</button>`;
        }

        // ⚡ NUEVO: Generar HTML de las stats del jugador
        const statsJugador = j.stats || {};
        let statsHtml = '';
        statsDeEsteDeporte.forEach(statDef => {
          const valor = statsJugador[statDef.key];
          if (valor !== undefined && valor !== null && valor !== '') {
            // Si es tiempo, formatearlo un poco (opcional, aquí lo dejamos tal cual)
            statsHtml += `<span class="gd-jugador__stat">${statDef.label}: <strong>${valor}</strong></span>`;
          }
        });

        const puedeEditarStats = soyYoMismo || soyCapitan || soyAdmin;
        const statsBtnHtml = puedeEditarStats ? `<button class="gd-jugador__menu-btn" data-stats-jugador="${j.id}" title="Editar estadísticas" style="margin-right: 8px;">${SVG.chart}</button>` : '';

        return `
          <div class="gd-jugador">
            <img src="${avatar}" class="gd-jugador__avatar" alt="" data-autor-id="${j.id}" style="cursor:pointer" />
            <div class="gd-jugador__info">
              <div class="gd-jugador__name" data-autor-id="${j.id}" style="cursor:pointer">
                ${j.nombre}
                ${esElCapitan ? `<span class="badge badge--primary" style="margin-left:6px">${SVG.crown}</span>` : ''}
                ${esSubCapitan && !esElCapitan ? `<span class="badge badge--warning" style="margin-left:6px">${SVG.crown}</span>` : ''}
              </div>
              <div class="gd-jugador__sub">
                ${j.posicion || 'Sin posición'}
                ${statsHtml ? `<div class="gd-jugador__stats-list">${statsHtml}</div>` : ''}
              </div>
            </div>
            ${statsBtnHtml}
            ${puedeAbrirMenu ? `<div class="gd-jugador__menu-wrapper"><button class="gd-jugador__menu-btn" data-jugador-menu="${j.id}" title="Opciones"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg></button><div class="gd-jugador__dropdown" data-dropdown-for="${j.id}" style="display:none">${opcionesMenu}</div></div>` : ''}
          </div>
        `;
      }).join('');

      cont.querySelectorAll('[data-jugador-menu]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const jugadorId = btn.dataset.jugadorMenu; const dropdown = cont.querySelector(`[data-dropdown-for="${jugadorId}"]`);
          const estaAbierto = dropdown && dropdown.style.display !== 'none';
          cont.querySelectorAll('.gd-jugador__dropdown').forEach(d => d.style.display = 'none');
          if (dropdown && !estaAbierto) dropdown.style.display = 'block';
        });
      });

      const cerrarMenusGlobal = (e) => { if (!e.target.closest('.gd-jugador__menu-wrapper')) cont.querySelectorAll('.gd-jugador__dropdown').forEach(d => d.style.display = 'none'); };
      document.addEventListener('click', cerrarMenusGlobal);

      cont.querySelectorAll('[data-nombrar-sub]').forEach(btn => {
        btn.addEventListener('click', async (e) => { e.stopPropagation(); try { await cambiarRolMiembroAPI(grupoId, btn.dataset.nombrarSub, 'admin'); toast('Ahora es sub-capitán', 'success'); await cargarMiembrosDeGrupo(grupoId); } catch (err) { toast(err.message || 'Error', 'error'); } });
      });
      cont.querySelectorAll('[data-quitar-sub]').forEach(btn => {
        btn.addEventListener('click', async (e) => { e.stopPropagation(); try { await cambiarRolMiembroAPI(grupoId, btn.dataset.quitarSub, 'miembro'); toast('Sub-capitán removido', 'info'); await cargarMiembrosDeGrupo(grupoId); } catch (err) { toast(err.message || 'Error', 'error'); } });
      });
      cont.querySelectorAll('[data-expulsar-miembro]').forEach(btn => {
        btn.addEventListener('click', async (e) => { e.stopPropagation(); if (!confirm('¿Expulsar a este miembro del equipo?')) return; try { await expulsarMiembroAPI(grupoId, btn.dataset.expulsarMiembro); toast('Miembro expulsado', 'info'); await cargarMiembrosDeGrupo(grupoId); } catch (err) { toast(err.message || 'Error', 'error'); } });
      });


      cont.querySelectorAll('[data-autor-id]').forEach(el => {
        el.addEventListener('click', (e) => { e.stopPropagation(); import('../components.js').then(({ verPerfilUsuario }) => verPerfilUsuario(el.dataset.autorId)); });
      });
            // ⚡ NUEVO: Listener para el botón de stats
      cont.querySelectorAll('[data-stats-jugador]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const jugadorId = btn.dataset.statsJugador;
          const jugador = miembros.find(m => String(m.id) === String(jugadorId));
          abrirModalStatsJugador(jugador, grupoId, grupoCompleto.deporte, () => cargarMiembrosDeGrupo(grupoId));
        });
      });
    } catch (err) {
      cont.innerHTML = `<p class="text-sm text-muted text-center">No se pudieron cargar los miembros</p>`;
    }
  }

  // ⚡ NUEVO: Modal para editar stats del jugador
  // ⚡ NUEVO: Modal para editar stats del jugador (Dinámico por deporte)
  function abrirModalStatsJugador(jugador, grupoId, deporte, onRefresh) {
    let modal = document.getElementById('modal-stats-jugador');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-stats-jugador';
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal" style="max-width: 440px;">
          <div class="modal__header">
            <h3 class="modal__title" id="modal-sj-titulo">Stats</h3>
            <button class="modal__close" data-cerrar-modal="modal-stats-jugador">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="modal__body">
            <div id="stats-jugador-dinamico"></div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--ghost" data-cerrar-modal="modal-stats-jugador">Cancelar</button>
            <button class="btn btn--primary" id="btn-guardar-stats-jugador">Guardar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    modal.querySelector('#modal-sj-titulo').textContent = `Stats de ${jugador.nombre}`;
    const contDinamico = modal.querySelector('#stats-jugador-dinamico');
    const statsActuales = jugador.stats || {};
    
    // ⚡ Obtener las stats correspondientes al deporte
    const statsDeEsteDeporte = STATS_POR_DEPORTE[deporte] || STATS_DEFAULT;
    
    contDinamico.innerHTML = statsDeEsteDeporte.map(statDef => {
      const valorActual = statsActuales[statDef.key] !== undefined ? statsActuales[statDef.key] : '';
      return `
        <div class="field">
          <label class="field__label">${statDef.label}</label>
          <input type="text" id="sj-${statDef.key}" class="field__input" value="${valorActual}" placeholder="Ej: 5" />
        </div>
      `;
    }).join('');

    modal.querySelectorAll('[data-cerrar-modal]').forEach(b => b.onclick = () => cerrarModal('modal-stats-jugador'));
    modal.onclick = (e) => { if (e.target === modal) cerrarModal('modal-stats-jugador'); };
    
    modal.querySelector('#btn-guardar-stats-jugador').onclick = async () => {
      const btn = modal.querySelector('#btn-guardar-stats-jugador');
      btn.disabled = true; btn.textContent = 'Guardando...';
      try {
        const nuevosStats = {};
        statsDeEsteDeporte.forEach(statDef => {
          const input = document.getElementById(`sj-${statDef.key}`);
          if (input && input.value.trim() !== '') {
            nuevosStats[statDef.key] = input.value.trim(); // Guardamos como texto o número según convenga
          }
        });

        await editarStatsJugadorAPI(grupoId, jugador.id, nuevosStats);
        toast('Stats guardadas', 'success');
        cerrarModal('modal-stats-jugador');
        if (onRefresh) onRefresh();
      } catch (err) {
        toast(err.message || 'Error al guardar', 'error');
      } finally {
        btn.disabled = false; btn.textContent = 'Guardar';
      }
    };

    abrirModal('modal-stats-jugador');
  }

  // ⚡ NUEVO: Pestaña de Formación
  // ⚡ NUEVO: Pestaña de Formación
  // ⚡ NUEVO: Pestaña de Formación
  // ⚡ NUEVO: Pestaña de Formación
  // ⚡ NUEVO: Pestaña de Formación
  async function renderSubtabFormacion(cont, grupo) {
    const mapaCanchas = {
      'Fútbol': 'cancha-futbol.png', 'Fútbol americano': 'cancha-futbol-americano.png',
      'Básquetbol': 'cancha-basquetbol.png', 'Béisbol': 'cancha-beisbol.png',
      'Rugby': 'cancha-rugby.png', 'Hockey': 'cancha-hockey.png',
      'Handball': 'cancha-handball.png', 'Vóleibol': 'cancha-voleibol.png'
    };
    
    const emojisDeporte = {
      'Fútbol': '⚽', 'Fútbol americano': '🏈', 'Básquetbol': '🏀', 'Béisbol': '⚾',
      'Rugby': '🏉', 'Hockey': '🏒', 'Handball': '🤾', 'Vóleibol': '🏐'
    };
    const iconoBalon = emojisDeporte[grupo.deporte] || '⚽';
    const bgUrl = `fields/${mapaCanchas[grupo.deporte] || 'cancha-futbol.png'}`;
    
    const esCapOAdmin = grupo.esCapitan || grupo.esAdmin;
    const puedeEditar = grupo.formacionAbierta || esCapOAdmin;

    cont.innerHTML = `
      <div class="gd-card">
        <div class="gd-card__eyebrow">Formación Táctica</div>
        <h3 class="gd-card__title">Pizarra</h3>
        
        ${esCapOAdmin ? `
          <div class="formacion-toggle-wrapper mb-4">
            <label class="switch">
              <input type="checkbox" id="toggle-formacion-abierta" ${grupo.formacionAbierta ? 'checked' : ''} />
              <span class="switch__slider"></span>
              <div>
                <div class="switch__label">Permitir edición a todos los miembros</div>
                <div class="switch__hint">Si está desactivado, solo capitán y sub-capitanes pueden mover y guardar.</div>
              </div>
            </label>
          </div>
        ` : ''}

        <div class="campo-formacion-wrapper" id="campo-formacion-wrapper">
          <div class="campo-formacion" id="campo-formacion" data-deporte="${grupo.deporte}">
            <img src="${bgUrl}" class="campo-formacion__img" alt="Cancha" />
            <div id="campo-circulos" style="position:absolute; inset:0; z-index: 5;"></div>
          </div>
          
          <div class="campo-formacion-acciones">
            ${puedeEditar ? `
              <button class="btn btn--ghost btn--sm" id="btn-agregar-ficha">+ Añadir Ficha</button>
              <button class="btn btn--ghost btn--sm" id="btn-agregar-rival" style="color: var(--color-danger); border-color: var(--color-danger);">+ Añadir Rival</button>
              <button class="btn btn--ghost btn--sm" id="btn-agregar-balon">+ Añadir Balón</button>
              <button class="btn btn--primary btn--sm" id="btn-guardar-formacion">Guardar Formación</button>
            ` : `
              <div class="aviso-formacion-cerrada">
                🔒 La edición de la formación está cerrada por el capitán.
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    // ⚡ Listener del Switch corregido
    if (esCapOAdmin) {
      document.getElementById('toggle-formacion-abierta').onchange = async (e) => {
        const checked = e.target.checked;
        try {
          await editarFormacionAbiertaAPI(grupo.id, checked);
          toast(`Edición ${checked ? 'abierta' : 'cerrada'} para todos`, 'success');
          
          // ⚡ ACTUALIZAMOS EL OBJETO EN MEMORIA ANTES DE RENDERIZAR
          grupo.formacionAbierta = checked; 
          
          await renderDetalleGrupo(grupo, false, () => {}, false);
        } catch (err) {
          toast(err.message || 'Error al cambiar el ajuste', 'error');
          e.target.checked = !checked; 
        }
      };
    }

    const campo = document.getElementById('campo-formacion');
    const contCirculos = document.getElementById('campo-circulos');
    
    let formacion = grupo.formacion && grupo.formacion.length > 0 ? grupo.formacion : null;
    
    const grupoCompleto = await obtenerGrupo(grupo.id);
    const miembros = grupoCompleto.miembros || [];
    const idsMiembros = new Set(miembros.map(m => String(m.id)));

    if (!formacion) {
      formacion = miembros.map((m, i) => ({
        id: `ficha-${Date.now()}-${i}`,
        nombre: m.nombre,
        usuarioId: m.id,
        x: 20 + (i % 3) * 20,
        y: 20 + Math.floor(i / 3) * 20,
        esPelota: false,
        esRival: false
      }));
    } else {
      formacion = formacion.filter(f => f.esPelota || f.esRival || !f.usuarioId || idsMiembros.has(String(f.usuarioId)));
    }

    function renderCirculos() {
      contCirculos.innerHTML = formacion.map(f => {
        const colorClass = f.esPelota ? 'ficha-jugador--pelota' : (f.esRival ? 'ficha-jugador--rival' : '');
        const inicial = f.nombre && !f.esPelota ? f.nombre.charAt(0).toUpperCase() : '';
        const nombreHtml = f.esPelota ? '' : `<div class="ficha-jugador__nombre">${f.nombre || ''}</div>`;
        
        return `
        <div class="ficha-jugador ${colorClass}" data-id="${f.id}" style="left: ${f.x}%; top: ${f.y}%;">
          <div class="ficha-jugador__inner">${f.esPelota ? iconoBalon : inicial}</div>
          ${nombreHtml}
        </div>
      `;
      }).join('');

      if (!puedeEditar) {
        contCirculos.querySelectorAll('.ficha-jugador').forEach(el => { el.style.cursor = 'default'; });
        return; 
      }

      contCirculos.querySelectorAll('.ficha-jugador').forEach(el => {
        let isDragging = false;
        let hasMoved = false;
        let startX, startY, initialX, initialY, innerHalfW, innerHalfH;

        const onStart = (e) => {
          isDragging = true;
          hasMoved = false;
          const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
          const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
          startX = clientX; startY = clientY;
          initialX = el.offsetLeft; initialY = el.offsetTop;
          
          const innerEl = el.querySelector('.ficha-jugador__inner');
          innerHalfW = innerEl ? (innerEl.clientWidth / 2) : 22;
          innerHalfH = innerEl ? (innerEl.clientHeight / 2) : 22;
          
          el.style.zIndex = 100; el.style.cursor = 'grabbing';
        };

        const onMove = (e) => {
          if (!isDragging) return;
          e.preventDefault();
          const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
          const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
          const dx = clientX - startX; const dy = clientY - startY;

          if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;

          let newX = initialX + dx; let newY = initialY + dy;
          if (newX < innerHalfW) newX = innerHalfW;
          if (newY < innerHalfH) newY = innerHalfH;
          if (newX > campo.clientWidth - innerHalfW) newX = campo.clientWidth - innerHalfW;
          if (newY > campo.clientHeight - innerHalfH) newY = campo.clientHeight - innerHalfH;

          el.style.left = `${newX}px`; el.style.top = `${newY}px`;

          const id = el.dataset.id; const f = formacion.find(x => x.id === id);
          if (f) { f.x = (newX / campo.clientWidth) * 100; f.y = (newY / campo.clientHeight) * 100; }
        };

        const onEnd = () => { 
          if (!isDragging) return;
          isDragging = false; 
          el.style.zIndex = 10; 
          el.style.cursor = 'grab'; 
          
          if (!hasMoved) {
            const id = el.dataset.id;
            const f = formacion.find(x => x.id === id);
            if (f) {
              if (f.esPelota) {
                if (confirm('¿Querés eliminar el balón?')) {
                  formacion = formacion.filter(x => x.id !== f.id);
                  renderCirculos();
                }
              } else {
                abrirOpcionesFicha(f, () => renderCirculos());
              }
            }
          }
        };

        el.addEventListener('mousedown', onStart);
        el.addEventListener('touchstart', onStart, { passive: false });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
      });
    }

    function abrirOpcionesFicha(ficha, onSuccess) {
      const nuevoNombre = window.prompt(`Nombre de la ficha (deja vacío para eliminar):`, ficha.nombre || '');
      if (nuevoNombre === null) return; 
      
      if (nuevoNombre.trim() === '') {
        if (confirm('¿Querés eliminar esta ficha?')) {
          formacion = formacion.filter(f => f.id !== ficha.id);
          onSuccess();
        }
      } else {
        ficha.nombre = nuevoNombre.trim();
        onSuccess();
      }
    }

    renderCirculos();

    if (puedeEditar) {
      document.getElementById('btn-agregar-ficha').onclick = () => {
        formacion.push({ id: `ficha-${Date.now()}`, nombre: '', usuarioId: null, x: 50, y: 50, esPelota: false, esRival: false });
        renderCirculos();
      };

      document.getElementById('btn-agregar-rival').onclick = () => {
        formacion.push({ id: `rival-${Date.now()}`, nombre: '', usuarioId: null, x: 50, y: 50, esPelota: false, esRival: true });
        renderCirculos();
      };

      document.getElementById('btn-agregar-balon').onclick = () => {
        if (formacion.some(f => f.esPelota)) return toast('Ya hay un balón en la pizarra', 'info');
        formacion.push({ id: `balon-${Date.now()}`, nombre: '', usuarioId: null, x: 50, y: 50, esPelota: true });
        renderCirculos();
      };

      document.getElementById('btn-guardar-formacion').onclick = async (e) => {
        const btn = e.target;
        btn.disabled = true; btn.textContent = 'Guardando...';
        
        try {
          const formacionParaGuardar = formacion.map(f => ({
            id: f.id,
            nombre: f.nombre || '',
            x: f.x,
            y: f.y,
            esPelota: f.esPelota === true,
            esRival: f.esRival === true,
            usuarioId: f.usuarioId || null,
          }));

          await editarFormacionAPI(grupo.id, formacionParaGuardar);
          toast('Formación guardada', 'success');
          
          // ⚡ Recargamos los datos del grupo para asegurarnos de que se reflejen
          const grupoActualizado = await obtenerGrupo(grupo.id);
          grupo.formacion = grupoActualizado.formacion;
          
        } catch (err) {
          toast(err.message || 'Error al guardar', 'error');
        } finally {
          btn.disabled = false; btn.textContent = 'Guardar Formación';
        }
      };
    }
  }
  async function renderPanelEquipo() {
    const contenedor = document.getElementById('equipo-contenido');
    if (!contenedor) return;

    if (grupoAbiertoEquipo) {
      const grupo = misEquipos.find(g => String(g.id) === String(grupoAbiertoEquipo));
      if (!grupo) grupoAbiertoEquipo = null;
      else {
        await renderDetalleGrupo(grupo, false, () => {
          grupoAbiertoEquipo = null; subTabDetalleEquipo = 'info';
          if (intervaloDetalle) { clearInterval(intervaloDetalle); intervaloDetalle = null; }
          renderPanelEquipo();
        });
        return;
      }
    }

    if (panelEquipo?.classList.contains('subpanel--active')) mostrarChromePagina();
    const filtrados = filtrarGrupos(misEquipos, filtroBusquedaEquipo);

    const misEquiposCreados = misEquipos.filter(g => g.esCapitan);
    const limiteAlcanzado = misEquiposCreados.length >= 2 && !user?.esPremium;
    const badgeBoton = limiteAlcanzado ? ` <span class="badge badge--warning" style="margin-left:6px; font-size:10px; padding:2px 6px; border-radius:4px; text-transform:uppercase; letter-spacing:0.5px;">Premium</span>` : '';

    contenedor.innerHTML = `
      <div class="grupo-toolbar">
        <div class="grupo-toolbar__search">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="filtro-equipos" class="grupo-toolbar__input" placeholder="Buscar por nombre, deporte o ciudad..." value="${filtroBusquedaEquipo}" />
        </div>
        <button class="btn btn--primary" id="btn-crear-equipo">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> 
          Crear equipo ${badgeBoton}
        </button>
      </div>
      <div id="equipos-lista" class="grupo-grid"></div>
    `;

    const lista = document.getElementById('equipos-lista');

    if (misEquipos.length === 0) {
      lista.innerHTML = `<div class="card" style="grid-column:1 / -1"><div class="empty-state"><div class="empty-state__icon">${SVG.users}</div><p>No perteneces a ningún equipo todavía.</p><button class="btn btn--primary mt-4" id="btn-vacio-crear-equipo">+ Crear mi primer equipo</button></div></div>`;
      document.getElementById('btn-vacio-crear-equipo')?.addEventListener('click', () => abrirModalCrearGrupo('equipo'));
    } else if (filtrados.length === 0) {
      lista.innerHTML = `<div class="card" style="grid-column:1 / -1"><div class="empty-state"><div class="empty-state__icon">${SVG.search}</div><p>No hay equipos que coincidan con "${filtroBusquedaEquipo}".</p></div></div>`;
    } else {
      lista.innerHTML = filtrados.map(g => renderCardGrupo(g, false)).join('');
    }

    document.getElementById('btn-crear-equipo')?.addEventListener('click', () => abrirModalCrearGrupo('equipo'));

    const inputFiltro = document.getElementById('filtro-equipos');
    inputFiltro?.addEventListener('input', (e) => {
      filtroBusquedaEquipo = e.target.value; renderPanelEquipo();
      const nuevoInput = document.getElementById('filtro-equipos');
      if (nuevoInput) { nuevoInput.focus(); nuevoInput.setSelectionRange(nuevoInput.value.length, nuevoInput.value.length); }
    });

    lista.querySelectorAll('.grupo-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-accion-grupo]')) return;
        grupoAbiertoEquipo = card.dataset.grupoId; subTabDetalleEquipo = 'chat'; renderPanelEquipo();
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (e.target.closest('[data-accion-grupo]')) return; grupoAbiertoEquipo = card.dataset.grupoId; subTabDetalleEquipo = 'chat'; renderPanelEquipo(); }
      });
    });

    lista.querySelectorAll('[data-accion-grupo]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id; const accion = btn.dataset.accionGrupo; const grupo = misEquipos.find(g => String(g.id) === String(id));
        if (!grupo) return;
        if (accion === 'editar')     abrirModalEditarGrupo(grupo, false);
        if (accion === 'gestionar')  abrirModalGestionar(grupo);
        if (accion === 'stats')      abrirModalStats(grupo);
        if (accion === 'eliminar')   confirmarEliminarGrupo(grupo, false);
        if (accion === 'salir')      confirmarSalirGrupo(grupo, false);
      });
    });
  }

  async function renderPanelComunidad() {
    const contenedor = document.getElementById('comunidad-contenido');
    if (!contenedor) return;

    if (grupoAbiertoComunidad) {
      const grupo = misComunidades.find(g => String(g.id) === String(grupoAbiertoComunidad));
      if (!grupo) grupoAbiertoComunidad = null;
      else {
        await renderDetalleGrupo(grupo, true, () => {
          grupoAbiertoComunidad = null; subTabDetalleEquipo = 'info';
          if (intervaloDetalle) { clearInterval(intervaloDetalle); intervaloDetalle = null; }
          renderPanelComunidad();
        });
        return;
      }
    }

    if (panelComunidad?.classList.contains('subpanel--active')) mostrarChromePagina();
    const filtrados = filtrarGrupos(misComunidades, filtroBusquedaComunidad);

    const misComunidadesCreadas = misComunidades.filter(g => g.esCapitan);
    const limiteAlcanzado = misComunidadesCreadas.length >= 1 && !user?.esPremium;
    const badgeBoton = limiteAlcanzado ? ` <span class="badge badge--warning" style="margin-left:6px; font-size:10px; padding:2px 6px; border-radius:4px; text-transform:uppercase; letter-spacing:0.5px;">Premium</span>` : '';

    contenedor.innerHTML = `
      <div class="grupo-toolbar">
        <div class="grupo-toolbar__search">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="filtro-comunidades" class="grupo-toolbar__input" placeholder="Buscar por nombre, deporte o ciudad..." value="${filtroBusquedaComunidad}" />
        </div>
        <button class="btn btn--primary" id="btn-crear-comunidad">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> 
          Crear comunidad ${badgeBoton}
        </button>
      </div>
      <div id="comunidades-lista" class="grupo-grid"></div>
    `;

    const lista = document.getElementById('comunidades-lista');

    if (misComunidades.length === 0) {
      lista.innerHTML = `<div class="card" style="grid-column:1 / -1"><div class="empty-state"><div class="empty-state__icon">${SVG.globe}</div><p>No perteneces a ninguna comunidad todavía.</p><button class="btn btn--primary mt-4" id="btn-vacio-crear-comunidad">+ Crear mi primera comunidad</button></div></div>`;
      document.getElementById('btn-vacio-crear-comunidad')?.addEventListener('click', () => abrirModalCrearGrupo('comunidad'));
    } else if (filtrados.length === 0) {
      lista.innerHTML = `<div class="card" style="grid-column:1 / -1"><div class="empty-state"><div class="empty-state__icon">${SVG.search}</div><p>No hay comunidades que coincidan con "${filtroBusquedaComunidad}".</p></div></div>`;
    } else {
      lista.innerHTML = filtrados.map(g => renderCardGrupo(g, true)).join('');
    }

    document.getElementById('btn-crear-comunidad')?.addEventListener('click', () => abrirModalCrearGrupo('comunidad'));

    const inputFiltro = document.getElementById('filtro-comunidades');
    inputFiltro?.addEventListener('input', (e) => {
      filtroBusquedaComunidad = e.target.value; renderPanelComunidad();
      const nuevoInput = document.getElementById('filtro-comunidades');
      if (nuevoInput) { nuevoInput.focus(); nuevoInput.setSelectionRange(nuevoInput.value.length, nuevoInput.value.length); }
    });

    lista.querySelectorAll('.grupo-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-accion-grupo]')) return;
        grupoAbiertoComunidad = card.dataset.grupoId; subTabDetalleEquipo = 'publicaciones'; renderPanelComunidad();
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (e.target.closest('[data-accion-grupo]')) return; grupoAbiertoComunidad = card.dataset.grupoId; subTabDetalleEquipo = 'publicaciones'; renderPanelComunidad(); }
      });
    });

    lista.querySelectorAll('[data-accion-grupo]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id; const accion = btn.dataset.accionGrupo; const grupo = misComunidades.find(g => String(g.id) === String(id));
        if (!grupo) return;
        if (accion === 'editar')     abrirModalEditarGrupo(grupo, true);
        if (accion === 'gestionar')  abrirModalGestionar(grupo);
        if (accion === 'stats')      abrirModalStats(grupo);
        if (accion === 'eliminar')   confirmarEliminarGrupo(grupo, true);
        if (accion === 'salir')      confirmarSalirGrupo(grupo, true);
      });
    });
  }

  async function recargarPaneles() {
    await recargarGrupos();
    await cargarCanales();
    if (panelChat?.classList.contains('subpanel--active')) renderListaCanales();
    await renderPanelEquipo();
    await renderPanelComunidad();

    // Abrir grupo/comunidad si venimos de un link de invitación
    const grupoAInvitacion = sessionStorage.getItem('grupoAInvitacion');
    if (grupoAInvitacion) {
      sessionStorage.removeItem('grupoAInvitacion');
      
      setTimeout(() => {
        // Averiguamos si es equipo o comunidad
        const esEquipo = misEquipos.some(g => String(g.id) === String(grupoAInvitacion));
        
        if (esEquipo) {
          cambiarTab('equipo');
          grupoAbiertoEquipo = grupoAInvitacion;
          subTabDetalleEquipo = 'info';
          renderPanelEquipo();
        } else {
          cambiarTab('comunidad');
          grupoAbiertoComunidad = grupoAInvitacion;
          subTabDetalleEquipo = 'info';
          renderPanelComunidad();
        }
      }, 500);
    }
  }

  async function cargarCanales() {
    try { const todos = await listarCanalesAPI(); canales = (todos || []).filter(c => c.tipo !== 'torneo'); }
    catch (err) { canales = []; }
  }

  function renderListaCanales() {
    if (!listaCanalesEl) return;
    const filtrados = filtroBusquedaCanal ? canales.filter(c => (c.nombre || '').toLowerCase().includes(filtroBusquedaCanal.toLowerCase())) : canales;

    if (canales.length === 0) {
      listaCanalesEl.innerHTML = `<div class="chat-empty" style="padding:var(--space-5) var(--space-3)"><div class="chat-empty__icon"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><h3 class="chat-empty__titulo" style="font-size:var(--fs-base)">Sin chats de equipo</h3><p class="chat-empty__text">Cuando te unas a un equipo, su chat va a aparecer acá.</p></div>`;
      return;
    }

    if (filtrados.length === 0) {
      listaCanalesEl.innerHTML = `<p class="text-sm text-muted text-center" style="padding:var(--space-4)">Sin resultados</p>`;
      return;
    }

    listaCanalesEl.innerHTML = filtrados.map(c => {
      const ultimo = c.ultimoMensaje; const preview = ultimo ? (ultimo.autorId === user.id ? 'Tú: ' : '') + (ultimo.texto || (ultimo.imagen ? 'Imagen' : '')) : 'Sin mensajes aún';
      const iconoHtml = renderIconoHtml(c.icono || RUTA_ESCUDO, 28); const esActivo = c.id === canalActualId;

      return `
        <div class="conv-item ${esActivo ? 'conv-item--active' : ''}" data-canal="${c.id}">
          <div class="conv-item__avatar" style="display:grid;place-items:center;background:var(--color-primary-light);border-radius:50%;overflow:hidden">${iconoHtml}</div>
          <div class="conv-item__info">
            <div class="conv-item__top"><div class="conv-item__name">${escapeHtml(c.nombre)}</div>${ultimo ? `<span class="conv-item__time">${horaCorta(ultimo.createdAt)}</span>` : ''}</div>
            <div class="conv-item__bottom"><div class="conv-item__preview">${escapeHtml(preview).slice(0, 60)}</div>${c.noLeidos > 0 ? `<span class="conv-item__badge">${c.noLeidos}</span>` : ''}</div>
          </div>
          <button class="conv-item__menu-btn" data-menu-canal="${c.id}" title="Opciones" type="button"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg></button>
          <div class="conv-item__dropdown hidden" data-dropdown-canal="${c.id}">
            <button class="conv-item__dropdown-item" type="button" data-accion-canal="vaciar" data-canal-id="${c.id}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Vaciar chat</button>
            <button class="conv-item__dropdown-item conv-item__dropdown-item--danger" type="button" data-accion-canal="eliminar" data-canal-id="${c.id}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Eliminar chat</button>
          </div>
        </div>
      `;
    }).join('');

    listaCanalesEl.querySelectorAll('[data-canal]').forEach(el => { el.addEventListener('click', (e) => { if (e.target.closest('[data-menu-canal]') || e.target.closest('[data-accion-canal]')) return; abrirCanalGlobal(el.dataset.canal); }); });
    listaCanalesEl.querySelectorAll('[data-menu-canal]').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); const canalId = btn.dataset.menuCanal; const dropdown = listaCanalesEl.querySelector(`[data-dropdown-canal="${canalId}"]`); const estaAbierto = dropdown && !dropdown.classList.contains('hidden'); listaCanalesEl.querySelectorAll('[data-dropdown-canal]').forEach(d => d.classList.add('hidden')); if (dropdown && !estaAbierto) dropdown.classList.remove('hidden'); }); });
    document.addEventListener('click', (e) => { if (!e.target.closest('[data-menu-canal]') && !e.target.closest('[data-dropdown-canal]')) listaCanalesEl.querySelectorAll('[data-dropdown-canal]').forEach(d => d.classList.add('hidden')); });

    listaCanalesEl.querySelectorAll('[data-accion-canal]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const accion = btn.dataset.accionCanal; const canalId = btn.dataset.canalId;
        listaCanalesEl.querySelectorAll('[data-dropdown-canal]').forEach(d => d.classList.add('hidden'));

        if (accion === 'vaciar') {
          if (!confirm('¿Vaciar este chat? Los mensajes se van a ocultar SOLO para ti.')) return;
          try { await vaciarCanalParaMiAPI(canalId); toast('Chat vaciado', 'success'); if (canalActualId === canalId) await refrescarMensajesGlobal(canalId); await cargarCanales(); renderListaCanales(); } catch (err) { toast(err.message || 'Error', 'error'); }
        }

        if (accion === 'eliminar') {
          if (!confirm('¿Eliminar este chat de tu lista? Si llega un mensaje nuevo, vuelve a aparecer.')) return;
          try {
            await eliminarCanalParaMiAPI(canalId); toast('Chat eliminado', 'success');
            if (canalActualId === canalId) { canalActualId = null; renderEmptyPanelCanal(); panelCanalEl?.classList.remove('chat-layout__panel--abierto'); document.querySelector('.chat-layout__list')?.classList.remove('chat-layout__list--oculto'); }
            await cargarCanales(); renderListaCanales();
          } catch (err) { toast(err.message || 'Error', 'error'); }
        }
      });
    });
  }

  async function abrirCanalGlobal(canalId) {
    canalActualId = canalId; ultimoHashCanal = null; ultimaCanalRenderizado = null; imagenBase64Canal = null;
    if (intervaloCanal) clearInterval(intervaloCanal);
    try { await marcarCanalLeidoAPI(canalId); } catch (err) {}
    const panelChat = document.getElementById('panel-chat');
    if (panelChat) { const listaCanales = document.querySelector('.chat-layout__list'); if (listaCanales) listaCanales.classList.add('chat-layout__list--oculto'); }
    await cargarCanales(); renderListaCanales(); await renderPanelCanalGlobal(canalId);
    const panelCanalEl = document.getElementById('panel-canal'); if (panelCanalEl) panelCanalEl.classList.add('chat-layout__panel--abierto');
    intervaloCanal = setInterval(async () => { if (canalActualId === canalId) await refrescarMensajesGlobal(canalId); }, 3000);
  }

  async function renderPanelCanalGlobal(canalId) {
    if (!panelCanalEl) return;
    let canal;
    try { canal = await obtenerCanalAPI(canalId); }
    catch (err) { panelCanalEl.innerHTML = `<div class="chat-empty"><div class="chat-empty__icon"><svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><p class="chat-empty__text">No se pudo cargar el canal</p></div>`; return; }

    const iconoHtml = renderIconoHtml(canal.icono || RUTA_ESCUDO, 28);
    const tipoLabel = canal.tipo === 'equipo' ? 'Equipo' : canal.tipo === 'comunidad' ? 'Comunidad' : 'Torneo';

    panelCanalEl.innerHTML = `
      <div class="chat-header">
        <button class="chat-back-btn" id="btn-volver-canal-global"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></button>
        <div class="chat-header__avatar" style="display:grid;place-items:center;background:var(--color-primary-light);border-radius:50%;overflow:hidden">${iconoHtml}</div>
        <div class="chat-header__info"><div class="chat-header__name">${escapeHtml(canal.nombre)}</div><div class="chat-header__sub">${tipoLabel} · ${canal.totalMiembros || 0} miembros</div></div>
      </div>
      <div class="chat-mensajes" id="chat-mensajes-canal"></div>
      <div class="chat-input-preview hidden" id="chat-canal-preview"><div class="chat-input-preview__img-wrapper"><img id="chat-canal-preview-img" src="" alt="" /><button type="button" class="chat-input-preview__del" id="chat-canal-preview-del" title="Quitar">✕</button></div></div>
      <form class="chat-input" id="chat-form-canal">
        <label class="chat-input__attach" title="Adjuntar imagen">${SVG.clip}<input type="file" id="chat-canal-file" accept="image/*" style="display:none" /></label>
        <input type="text" id="chat-input-canal" placeholder="Escribí un mensaje..." maxlength="2000" autocomplete="off" />
        <button type="submit" class="chat-input__btn" title="Enviar">${SVG.send}</button>
      </form>
    `;

    document.getElementById('btn-volver-canal-global')?.addEventListener('click', () => { panelCanalEl.classList.remove('chat-layout__panel--abierto'); const listaCanales = document.querySelector('.chat-layout__list'); if (listaCanales) listaCanales.classList.remove('chat-layout__list--oculto'); canalActualId = null; });

    document.getElementById('chat-canal-file')?.addEventListener('change', (e) => {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 3 * 1024 * 1024) { toast('La imagen es muy grande (máx 3MB)', 'error'); e.target.value = ''; return; }
      const reader = new FileReader(); reader.onload = (ev) => { imagenBase64Canal = ev.target.result; mostrarPreviewImagen('chat-canal', imagenBase64Canal); }; reader.readAsDataURL(file); e.target.value = '';
    });

    document.getElementById('chat-canal-preview-del')?.addEventListener('click', () => { imagenBase64Canal = null; ocultarPreviewImagen('chat-canal'); });
    document.getElementById('chat-form-canal')?.addEventListener('submit', async (e) => { e.preventDefault(); await enviarMensajeGlobal(canalId); });
    await refrescarMensajesGlobal(canalId);
  }

  async function refrescarMensajesGlobal(canalId) {
    const cont = document.getElementById('chat-mensajes-canal');
    if (!cont) return;
    let mensajes;
    try { mensajes = await listarMensajesDeCanalAPI(canalId); } catch (err) { return; }

    const hash = mensajes.map(m => `${m.id}:${m.texto || ''}:${m.imagen ? 'img' : ''}:${m.createdAt}`).join('|');
    const cambioDeCanal = ultimaCanalRenderizado !== canalId;
    if (!cambioDeCanal && hash === ultimoHashCanal) return;
    ultimoHashCanal = hash; ultimaCanalRenderizado = canalId;

    if (mensajes.length === 0) { cont.innerHTML = `<div class="chat-mensajes__empty"><div class="chat-mensajes__empty-icon"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><p>Aún no hay mensajes.</p><p class="text-xs" style="margin-top:4px">¡Escribí el primero!</p></div>`; return; }

    const estabaAbajo = cont.scrollHeight - cont.scrollTop - cont.clientHeight < 50;
    let html = ''; let diaAnterior = null;

    mensajes.forEach((m, idx) => {
      const fecha = new Date(m.createdAt); const dia = fecha.toDateString();
      if (dia !== diaAnterior) { html += `<div class="chat-dia">${labelDia(m.createdAt)}</div>`; diaAnterior = dia; }
      const esMio = String(m.autorId) === String(user.id);
      const tieneTexto = !!m.texto; const tieneImagen = !!m.imagen; const soloImagen = tieneImagen && !tieneTexto;

      html += `
        <div class="msg ${esMio ? 'msg--yo' : ''} ${m.eliminadoParaTodos ? 'msg--eliminado' : ''}" data-msg-id="${m.id}" data-msg-autor-id="${m.autorId}">
          ${!m.eliminadoParaTodos ? `<button class="msg-menu-btn" type="button" data-msg-menu-btn title="Opciones"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg></button>` : ''}
          ${!esMio ? `<img src="${avatarDe(m.autor)}" class="msg__avatar" alt="" />` : ''}
          <div class="msg__burbuja ${soloImagen ? 'msg__burbuja--solo-imagen' : ''}">
            ${!esMio ? `<div class="msg__autor">${escapeHtml(m.autor?.nombre || 'Usuario')}</div>` : ''}
            ${m.eliminadoParaTodos ? `<div class="msg__eliminado"><img src="assets/icons/prohibido.png" alt="" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;display:inline-block;margin-right:4px;" /> Mensaje eliminado</div>` : (tieneTexto ? `<div class="msg__texto">${escapeHtml(m.texto)}</div>` : '')}
            ${tieneImagen && !m.eliminadoParaTodos ? `<div class="msg__imagen-wrapper" data-ver-imagen-global="${idx}"><img src="${m.imagen}" alt="" loading="lazy" /></div>` : ''}
            <div class="msg__meta"><span class="msg__hora">${horaCorta(m.createdAt)}</span></div>
          </div>
        </div>`;
    });

    cont.innerHTML = html;
    cont.querySelectorAll('[data-ver-imagen-global]').forEach(el => { el.addEventListener('click', () => { const idx = Number(el.dataset.verImagenGlobal); if (mensajes[idx]?.imagen) abrirModalVerImagen(mensajes[idx].imagen); }); });

    conectarAccionesMensaje(cont, { usuarioId: user.id, obtenerMensajePorId: (id) => mensajes.find(m => String(m.id) === String(id)), onCopiar: (texto) => navigator.clipboard.writeText(texto), onEliminarParaMi: (id) => eliminarMensajeParaMiAPI(id), onEliminarParaTodos: (id) => eliminarMensajeParaTodosAPI(id), onRefrescar: () => refrescarMensajesGlobal(canalId) });

    if (estabaAbajo || mensajes.length <= 2) cont.scrollTop = cont.scrollHeight;
    try { await marcarCanalLeidoAPI(canalId); } catch (err) {}
  }

  async function enviarMensajeGlobal(canalId) {
    const input = document.getElementById('chat-input-canal');
    if (!input) return;
    const texto = input.value.trim(); const imagen = imagenBase64Canal;
    if (!texto && !imagen) return;
    input.value = ''; imagenBase64Canal = null; ocultarPreviewImagen('chat-canal'); input.focus();
    try { await enviarMensajeACanalAPI(canalId, texto || null, imagen || null); await refrescarMensajesGlobal(canalId); await cargarCanales(); renderListaCanales(); } catch (err) { toast(err.message || 'No se pudo enviar el mensaje', 'error'); }
  }

  function renderEmptyPanelCanal() {
    if (!panelCanalEl) return;
    panelCanalEl.innerHTML = `<div class="chat-empty"><div class="chat-empty__icon"><svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><h3 class="chat-empty__titulo">Chats de equipo</h3><p class="chat-empty__text">Elegí un equipo de la lista para ver su chat.</p></div>`;
  }

  const ICONOS_GRUPO = [
    'assets/icons/balon-de-futbol (2).png', 'assets/icons/balocensto.svg', 'assets/icons/pelota-de-tenis.png', 'assets/icons/voleibol.svg', 'assets/icons/raqueta-de-padel.png', 'assets/icons/golf.png', 'assets/icons/beisbol.png', 'assets/icons/disco.png', 'assets/icons/guantes-de-boxeo.png', 'assets/icons/volante.png', 'assets/icons/rugby.png', 'assets/icons/bicicleta.svg', 'assets/icons/natacion.svg', 'assets/icons/corriendo.png', 'assets/icons/raqueta-de-tenis-de-mesa.png', 'assets/icons/tenis-de-squash.png', 'assets/icons/balonmano.png', 'assets/icons/deporte.svg', 'assets/icons/tabla-de-surf.png', 'assets/icons/escalada.png', 'assets/icons/escudo-de-seguridad.png', 'assets/icons/redondo (20).png', 'assets/icons/redondo (1).png', 'assets/icons/redondo (2).png', 'assets/icons/redondo (3).png', 'assets/icons/redondo (4).png', 'assets/icons/redondo (5).png', 'assets/icons/redondo (6).png', 'assets/icons/redondo (7).png', 'assets/icons/redondo (8).png', 'assets/icons/redondo (9).png', 'assets/icons/redondo (10).png', 'assets/icons/redondo (11).png', 'assets/icons/redondo (12).png', 'assets/icons/redondo (13).png', 'assets/icons/redondo (14).png', 'assets/icons/redondo (15).png', 'assets/icons/redondo (16).png', 'assets/icons/redondo (17).png', 'assets/icons/redondo (18).png', 'assets/icons/redondo (19).png', 'assets/icons/mundo.png', 'assets/icons/mundo (1).png', 'assets/icons/mundo (2).png', 'assets/icons/mundo (3).png', 'assets/icons/mundo (4).png', 'assets/icons/mundo (5).png', 'assets/icons/mundo (6).png', 'assets/icons/mundo (7).png', 'assets/icons/mundo (8).png', 'assets/icons/mundo (9).png', 'assets/icons/mundo (10).png', 'assets/icons/mundo (11).png', 'assets/icons/mundo (12).png'
  ];

  let tipoGrupoSeleccionado = 'equipo';

  function abrirModalCrearGrupo(tipo = 'equipo') {
    const misEquiposCreados = misEquipos.filter(g => g.esCapitan);
    const misComunidadesCreadas = misComunidades.filter(g => g.esCapitan);

    if (!user?.esPremium) {
      if (tipo === 'equipo' && misEquiposCreados.length >= 2) {
        toast('Alcanzaste el límite de 2 equipos creados del plan Básico. Pasate a Premium para crear más.', 'error');
        return;
      }
      if (tipo === 'comunidad' && misComunidadesCreadas.length >= 1) {
        toast('Alcanzaste el límite de 1 comunidad creada del plan Básico. Pasate a Premium para crear más.', 'error');
        return;
      }
    }

    const modal = document.getElementById('modal-crear-comunidad');
    if (!modal) return;

    tipoGrupoSeleccionado = tipo;

    document.getElementById('crear-modal-titulo').textContent = tipo === 'comunidad' ? 'Crear comunidad' : 'Crear equipo';
    const wrapper = document.getElementById('crear-tipo-wrapper');
    const label = document.getElementById('crear-tipo-label');
    if (wrapper && label) {
      wrapper.classList.remove('hidden');
      label.innerHTML = tipo === 'comunidad' ? `<span style="font-size:20px">${SVG.globe}</span> Comunidad — grupo abierto para compartir y charlar` : `<span style="font-size:20px">${renderIconoHtml(RUTA_ESCUDO, 20)}</span> Equipo — para competir con otros`;
    }

    document.getElementById('com-nombre').value = '';
    document.getElementById('com-ciudad').value = '';
    document.getElementById('com-descripcion').value = '';

    const selDep = document.getElementById('com-deporte');
    selDep.innerHTML = '<option value="">Selecciona un deporte...</option>' + deportes.map(d => `<option value="${d}">${d}</option>`).join('');

    const contIconos = document.getElementById('com-iconos');
    contIconos.innerHTML = ICONOS_GRUPO.map((ic, i) => `<button type="button" class="posicion-chip ${i === 0 ? 'active' : ''}" data-com-icono="${ic}" style="display:inline-flex; align-items:center; justify-content:center">${renderIconoHtml(ic, 20)}</button>`).join('');

    let iconoSel = ICONOS_GRUPO[0];
    contIconos.querySelectorAll('[data-com-icono]').forEach(btn => {
      btn.addEventListener('click', () => { contIconos.querySelectorAll('[data-com-icono]').forEach(b => b.classList.remove('active')); btn.classList.add('active'); iconoSel = btn.dataset.comIcono; });
    });

    let tipoAccesoSel = 'publico';
    const tipoOps = modal.querySelectorAll('[data-tipo-com]');
    tipoOps.forEach(op => {
      op.classList.toggle('active', op.dataset.tipoCom === 'publico');
      op.onclick = () => { tipoOps.forEach(o => o.classList.remove('active')); op.classList.add('active'); tipoAccesoSel = op.dataset.tipoCom; };
    });

    document.getElementById('editar-stats-privadas-wrapper')?.classList.add('hidden');

    const tabs = modal.querySelectorAll('[data-tab-grupo]');
    const tabTecnicos = document.getElementById('grupo-tab-tecnicos');
    const tabVisual = document.getElementById('grupo-tab-visual');

    tabs.forEach(tab => {
      tab.onclick = () => {
        tabs.forEach(t => {
          t.classList.remove('active');
          t.style.borderBottomColor = 'transparent';
          t.style.color = 'var(--color-text-muted)';
          t.style.fontWeight = '600';
        });
        tab.classList.add('active');
        tab.style.borderBottomColor = 'var(--color-primary)';
        tab.style.color = 'var(--color-primary)';
        tab.style.fontWeight = '700';

        if (tab.dataset.tabGrupo === 'tecnicos') {
          tabTecnicos.classList.remove('hidden');
          tabVisual.classList.add('hidden');
        } else {
          tabTecnicos.classList.add('hidden');
          tabVisual.classList.remove('hidden');
        }
      };
    });

    const wrapperBasico = document.getElementById('grupo-visual-basico');
    const wrapperPremium = document.getElementById('grupo-visual-premium');
    
    let cardColor = '#E8836A';
    let heroColor = '#0F1B2D';
    let cardFotoBase64 = null;
    let heroFotoBase64 = null;
    let iconoFileBase64 = null;

    let marcoState = null;

    // ⚡ Mostrar AMBOS wrappers. Bloquear Premium si no lo es.
    wrapperBasico.classList.remove('hidden');
    wrapperPremium.classList.remove('hidden');

    renderPaleta('grupo-card-color-picker-basico', cardColor, (c) => cardColor = c);
    renderPaleta('grupo-hero-color-picker-basico', heroColor, (c) => heroColor = c);

    if (user?.esPremium) {
      wrapperPremium.style.opacity = '1';
      wrapperPremium.style.pointerEvents = 'auto';
      const banner = wrapperPremium.querySelector('.premium-banner');
      if (banner) banner.remove();
      wrapperPremium.querySelectorAll('input, button').forEach(el => el.disabled = false);
      wrapperPremium.querySelectorAll('.posiciones-lista').forEach(el => el.style.pointerEvents = 'auto');

      document.getElementById('com-card-color').value = cardColor;
      document.getElementById('com-hero-color').value = heroColor;
      
      document.getElementById('com-card-foto-preview-wrapper').classList.add('hidden');
      document.getElementById('com-card-foto-file').value = '';
      document.getElementById('com-hero-foto-preview-wrapper').classList.add('hidden');
      document.getElementById('com-hero-foto-file').value = '';
      
      const previewIcono = document.getElementById('com-icono-preview-wrapper');
      previewIcono.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-text-muted)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

      document.getElementById('com-card-foto-file').onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          cardFotoBase64 = ev.target.result;
          document.getElementById('com-card-foto-preview').src = cardFotoBase64;
          document.getElementById('com-card-foto-preview-wrapper').classList.remove('hidden');
        };
        reader.readAsDataURL(file); e.target.value = '';
      };
      document.getElementById('com-card-foto-quitar').onclick = () => {
        cardFotoBase64 = null;
        document.getElementById('com-card-foto-preview-wrapper').classList.add('hidden');
        document.getElementById('com-card-foto-file').value = '';
      };

      document.getElementById('com-hero-foto-file').onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          heroFotoBase64 = ev.target.result;
          document.getElementById('com-hero-foto-preview').src = heroFotoBase64;
          document.getElementById('com-hero-foto-preview-wrapper').classList.remove('hidden');
        };
        reader.readAsDataURL(file); e.target.value = '';
      };
      document.getElementById('com-hero-foto-quitar').onclick = () => {
        heroFotoBase64 = null;
        document.getElementById('com-hero-foto-preview-wrapper').classList.add('hidden');
        document.getElementById('com-hero-foto-file').value = '';
      };

      document.getElementById('com-icono-file').onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          iconoFileBase64 = ev.target.result;
          previewIcono.innerHTML = `<img src="${iconoFileBase64}" style="width:100%; height:100%; object-fit:contain;" />`;
        };
        reader.readAsDataURL(file); e.target.value = '';
      };
      document.getElementById('com-icono-quitar').onclick = () => {
        iconoFileBase64 = null;
        previewIcono.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-text-muted)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
        document.getElementById('com-icono-file').value = '';
      };

      marcoState = inicializarMarcosGrupo(null);

    } else {
      wrapperPremium.style.opacity = '0.6';
      if (!wrapperPremium.querySelector('.premium-banner')) {
        wrapperPremium.insertAdjacentHTML('afterbegin', `
          <div class="premium-banner" style="background: rgba(232, 131, 106, 0.15); border: 1px solid var(--color-primary); padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">🔒</span>
            <span style="font-size: 13px; font-weight: 600; color: var(--color-primary-dark);">Estas opciones son exclusivas del Plan Premium.</span>
          </div>
        `);
      }
      wrapperPremium.querySelectorAll('input, button').forEach(el => el.disabled = true);
      wrapperPremium.querySelectorAll('.posiciones-lista').forEach(el => el.style.pointerEvents = 'none');
    }

    tabs[0].click(); // Reset tab

    document.getElementById('btn-guardar-comunidad').onclick = async () => {
      const nombre = document.getElementById('com-nombre').value.trim();
      const deporte = document.getElementById('com-deporte').value;
      const ciudad = document.getElementById('com-ciudad').value.trim();
      const descripcion = document.getElementById('com-descripcion').value.trim();

      if (!nombre) return toast('Ingresa un nombre', 'error');
      if (!deporte) return toast('Selecciona un deporte', 'error');

      const btn = document.getElementById('btn-guardar-comunidad');
      btn.disabled = true; btn.textContent = 'Creando...';

      try {
        const payload = { tipo: tipoGrupoSeleccionado, nombre, escudo: iconoSel, deporte, ciudad: ciudad || null, descripcion: descripcion || null, tipoAcceso: tipoAccesoSel };
        
        if (user?.esPremium) {
          payload.cardColor = document.getElementById('com-card-color').value;
          payload.heroColor = document.getElementById('com-hero-color').value;
          payload.cardFoto = cardFotoBase64;
          payload.heroFoto = heroFotoBase64;
          payload.iconoPersonalizado = iconoFileBase64;
          if (marcoState) {
            payload.marcoIcono = marcoState.getMarcoIcono();
            payload.marcoColorIcono = marcoState.getMarcoColorIcono();
          }
        } else {
          payload.cardColor = cardColor;
          payload.heroColor = heroColor;
        }

        await crearGrupoAPI(payload);
        cerrarModal('modal-crear-comunidad');
        toast(`¡${tipo === 'comunidad' ? 'Comunidad' : 'Equipo'} creado!`, 'success');
        cambiarTab(tipo === 'comunidad' ? 'comunidad' : 'equipo');
        await recargarPaneles();
      } catch (err) { toast(err.message || 'Error', 'error'); }
      finally { btn.disabled = false; btn.textContent = tipo === 'comunidad' ? 'Crear comunidad' : 'Crear equipo'; }
    };

    modal.querySelectorAll('[data-cerrar-modal]').forEach(btn => { btn.onclick = () => cerrarModal('modal-crear-comunidad'); });
    modal.onclick = (e) => { if (e.target === modal) cerrarModal('modal-crear-comunidad'); };
    abrirModal('modal-crear-comunidad');
  }

  function abrirModalEditarGrupo(grupo, esComunidad) {
    const modal = document.getElementById('modal-crear-comunidad');
    if (!modal) return;

    document.getElementById('crear-modal-titulo').textContent = grupo.tipo === 'comunidad' ? 'Editar comunidad' : 'Editar equipo';
    const wrapper = document.getElementById('crear-tipo-wrapper');
    const label = document.getElementById('crear-tipo-label');
    if (wrapper && label) {
      wrapper.classList.remove('hidden');
      label.innerHTML = grupo.tipo === 'comunidad' ? `<span style="font-size:20px">${SVG.globe}</span> Comunidad` : `<span style="font-size:20px">${renderIconoHtml(RUTA_ESCUDO, 20)}</span> Equipo`;
    }

    document.getElementById('com-nombre').value = grupo.nombre;
    document.getElementById('com-ciudad').value = grupo.ciudad || '';
    document.getElementById('com-descripcion').value = grupo.descripcion || '';

    const selDep = document.getElementById('com-deporte');
    selDep.innerHTML = deportes.map(d => `<option value="${d}" ${d === grupo.deporte ? 'selected' : ''}>${d}</option>`).join('');

    const contIconos = document.getElementById('com-iconos');
    contIconos.innerHTML = ICONOS_GRUPO.map(ic => `<button type="button" class="posicion-chip ${ic === grupo.escudo ? 'active' : ''}" data-com-icono="${ic}" style="display:inline-flex; align-items:center; justify-content:center">${renderIconoHtml(ic, 20)}</button>`).join('');

    let iconoSel = grupo.escudo;
    contIconos.querySelectorAll('[data-com-icono]').forEach(btn => {
      btn.addEventListener('click', () => { contIconos.querySelectorAll('[data-com-icono]').forEach(b => b.classList.remove('active')); btn.classList.add('active'); iconoSel = btn.dataset.comIcono; });
    });

    let tipoAccesoSel = grupo.tipoAcceso || 'publico';
    const tipoOps = modal.querySelectorAll('[data-tipo-com]');
    tipoOps.forEach(op => {
      op.classList.toggle('active', op.dataset.tipoCom === tipoAccesoSel);
      op.onclick = () => { tipoOps.forEach(o => o.classList.remove('active')); op.classList.add('active'); tipoAccesoSel = op.dataset.tipoCom; };
    });

    const wrapperPriv = document.getElementById('editar-stats-privadas-wrapper');
    const chkPriv = document.getElementById('edit-grupo-stats-privadas');
    if (wrapperPriv && chkPriv) {
      if (grupo.tipo === 'equipo') { wrapperPriv.classList.remove('hidden'); chkPriv.checked = !!grupo.statsPrivadas; }
      else { wrapperPriv.classList.add('hidden'); chkPriv.checked = false; }
    }

    const tabs = modal.querySelectorAll('[data-tab-grupo]');
    const tabTecnicos = document.getElementById('grupo-tab-tecnicos');
    const tabVisual = document.getElementById('grupo-tab-visual');

    tabs.forEach(tab => {
      tab.onclick = () => {
        tabs.forEach(t => {
          t.classList.remove('active');
          t.style.borderBottomColor = 'transparent';
          t.style.color = 'var(--color-text-muted)';
          t.style.fontWeight = '600';
        });
        tab.classList.add('active');
        tab.style.borderBottomColor = 'var(--color-primary)';
        tab.style.color = 'var(--color-primary)';
        tab.style.fontWeight = '700';

        if (tab.dataset.tabGrupo === 'tecnicos') {
          tabTecnicos.classList.remove('hidden');
          tabVisual.classList.add('hidden');
        } else {
          tabTecnicos.classList.add('hidden');
          tabVisual.classList.remove('hidden');
        }
      };
    });

    const wrapperBasico = document.getElementById('grupo-visual-basico');
    const wrapperPremium = document.getElementById('grupo-visual-premium');
    
    let cardColor = grupo.cardColor || '#E8836A';
    let heroColor = grupo.heroColor || '#0F1B2D';
    let cardFotoBase64 = grupo.cardFoto || null;
    let heroFotoBase64 = grupo.heroFoto || null;
    let iconoFileBase64 = grupo.iconoPersonalizado || null;

    let marcoState = null;

    // ⚡ Mostrar AMBOS wrappers. Bloquear Premium si no lo es.
    wrapperBasico.classList.remove('hidden');
    wrapperPremium.classList.remove('hidden');

    renderPaleta('grupo-card-color-picker-basico', cardColor, (c) => cardColor = c);
    renderPaleta('grupo-hero-color-picker-basico', heroColor, (c) => heroColor = c);

    if (user?.esPremium) {
      wrapperPremium.style.opacity = '1';
      wrapperPremium.style.pointerEvents = 'auto';
      const banner = wrapperPremium.querySelector('.premium-banner');
      if (banner) banner.remove();
      wrapperPremium.querySelectorAll('input, button').forEach(el => el.disabled = false);
      wrapperPremium.querySelectorAll('.posiciones-lista').forEach(el => el.style.pointerEvents = 'auto');

      document.getElementById('com-card-color').value = cardColor;
      document.getElementById('com-hero-color').value = heroColor;

      const previewCard = document.getElementById('com-card-foto-preview');
      const wrapCard = document.getElementById('com-card-foto-preview-wrapper');
      const btnQuitarCard = document.getElementById('com-card-foto-quitar');
      if (cardFotoBase64) { previewCard.src = cardFotoBase64; wrapCard.classList.remove('hidden'); btnQuitarCard.classList.remove('hidden'); }
      else { wrapCard.classList.add('hidden'); btnQuitarCard.classList.add('hidden'); }

      const previewHero = document.getElementById('com-hero-foto-preview');
      const wrapHero = document.getElementById('com-hero-foto-preview-wrapper');
      const btnQuitarHero = document.getElementById('com-hero-foto-quitar');
      if (heroFotoBase64) { previewHero.src = heroFotoBase64; wrapHero.classList.remove('hidden'); btnQuitarHero.classList.remove('hidden'); }
      else { wrapHero.classList.add('hidden'); btnQuitarHero.classList.add('hidden'); }

      const previewIcono = document.getElementById('com-icono-preview-wrapper');
      const btnQuitarIcono = document.getElementById('com-icono-quitar');
      if (iconoFileBase64) { previewIcono.innerHTML = `<img src="${iconoFileBase64}" style="width:100%; height:100%; object-fit:contain;" />`; btnQuitarIcono.classList.remove('hidden'); }
      else { previewIcono.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-text-muted)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`; btnQuitarIcono.classList.add('hidden'); }

      document.getElementById('com-card-foto-file').onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => { cardFotoBase64 = ev.target.result; previewCard.src = cardFotoBase64; wrapCard.classList.remove('hidden'); btnQuitarCard.classList.remove('hidden'); };
        reader.readAsDataURL(file); e.target.value = '';
      };
      document.getElementById('com-card-foto-quitar').onclick = () => { cardFotoBase64 = null; wrapCard.classList.add('hidden'); btnQuitarCard.classList.add('hidden'); document.getElementById('com-card-foto-file').value = ''; };

      document.getElementById('com-hero-foto-file').onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => { heroFotoBase64 = ev.target.result; previewHero.src = heroFotoBase64; wrapHero.classList.remove('hidden'); btnQuitarHero.classList.remove('hidden'); };
        reader.readAsDataURL(file); e.target.value = '';
      };
      document.getElementById('com-hero-foto-quitar').onclick = () => { heroFotoBase64 = null; wrapHero.classList.add('hidden'); btnQuitarHero.classList.add('hidden'); document.getElementById('com-hero-foto-file').value = ''; };

      document.getElementById('com-icono-file').onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => { iconoFileBase64 = ev.target.result; previewIcono.innerHTML = `<img src="${iconoFileBase64}" style="width:100%; height:100%; object-fit:contain;" />`; btnQuitarIcono.classList.remove('hidden'); };
        reader.readAsDataURL(file); e.target.value = '';
      };
      document.getElementById('com-icono-quitar').onclick = () => { iconoFileBase64 = null; previewIcono.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-text-muted)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`; btnQuitarIcono.classList.add('hidden'); document.getElementById('com-icono-file').value = ''; };

      marcoState = inicializarMarcosGrupo(grupo);

    } else {
      wrapperPremium.style.opacity = '0.6';
      if (!wrapperPremium.querySelector('.premium-banner')) {
        wrapperPremium.insertAdjacentHTML('afterbegin', `
          <div class="premium-banner" style="background: rgba(232, 131, 106, 0.15); border: 1px solid var(--color-primary); padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">🔒</span>
            <span style="font-size: 13px; font-weight: 600; color: var(--color-primary-dark);">Estas opciones son exclusivas del Plan Premium.</span>
          </div>
        `);
      }
      wrapperPremium.querySelectorAll('input, button').forEach(el => el.disabled = true);
      wrapperPremium.querySelectorAll('.posiciones-lista').forEach(el => el.style.pointerEvents = 'none');
    }

    tabs[0].click(); // Reset tab

    const btnGuardar = document.getElementById('btn-guardar-comunidad');
    btnGuardar.textContent = 'Guardar cambios';
    btnGuardar.onclick = async () => {
      const nombre = document.getElementById('com-nombre').value.trim();
      const deporte = document.getElementById('com-deporte').value;
      const ciudad = document.getElementById('com-ciudad').value.trim();
      const descripcion = document.getElementById('com-descripcion').value.trim();
      const statsPrivadasNueva = (grupo.tipo === 'equipo' && chkPriv) ? chkPriv.checked : false;

      if (!nombre) return toast('Ingresa un nombre', 'error');
      if (!deporte) return toast('Selecciona un deporte', 'error');

      btnGuardar.disabled = true; btnGuardar.textContent = 'Guardando...';

      try {
        const payload = { nombre, escudo: iconoSel, deporte, ciudad: ciudad || null, descripcion: descripcion || null, tipoAcceso: tipoAccesoSel, statsPrivadas: statsPrivadasNueva };
        
        if (user?.esPremium) {
          payload.cardColor = document.getElementById('com-card-color').value;
          payload.heroColor = document.getElementById('com-hero-color').value;
          payload.cardFoto = cardFotoBase64;
          payload.heroFoto = heroFotoBase64;
          payload.iconoPersonalizado = iconoFileBase64;
          if (marcoState) {
            payload.marcoIcono = marcoState.getMarcoIcono();
            payload.marcoColorIcono = marcoState.getMarcoColorIcono();
          }
        } else {
          payload.cardColor = cardColor;
          payload.heroColor = heroColor;
        }

        await editarGrupoAPI(grupo.id, payload);
        cerrarModal('modal-crear-comunidad');
        toast('Grupo actualizado', 'success');
        await recargarPaneles();
      } catch (err) { toast(err.message || 'Error', 'error'); }
      finally { btnGuardar.disabled = false; btnGuardar.textContent = 'Guardar cambios'; }
    };

    modal.querySelectorAll('[data-cerrar-modal]').forEach(btn => { btn.onclick = () => cerrarModal('modal-crear-comunidad'); });
    modal.onclick = (e) => { if (e.target === modal) cerrarModal('modal-crear-comunidad'); };
    abrirModal('modal-crear-comunidad');
  }

  let grupoEnGestion = null;

  async function abrirModalGestionar(grupo) {
    grupoEnGestion = grupo; await renderGestionMiembros(grupo, 'miembros');
    const modal = document.getElementById('modal-gestionar-grupo');
    if (!modal) return;
    modal.querySelectorAll('[data-cerrar-modal]').forEach(btn => { btn.onclick = () => cerrarModal('modal-gestionar-grupo'); });
    modal.onclick = (e) => { if (e.target === modal) cerrarModal('modal-gestionar-grupo'); };
    abrirModal('modal-gestionar-grupo');
  }

  async function renderGestionMiembros(grupo, tab) {
    const cont = document.getElementById('lista-gestion-grupo');
    if (!cont) return;

    document.querySelectorAll('[data-tab-gestion]').forEach(el => el.classList.toggle('active', el.dataset.tabGestion === tab));
    cont.innerHTML = '<p class="text-sm text-muted text-center">Cargando...</p>';

    try {
      const grupoCompleto = await obtenerGrupo(grupo.id);
      const miembros = grupoCompleto.miembros || [];
      const solicitudes = grupoCompleto.solicitudes || [];

      document.getElementById('count-gestion-miembros').textContent = miembros.length;
      document.getElementById('count-gestion-solicitudes').textContent = solicitudes.length;

      const lista = tab === 'miembros' ? miembros : solicitudes;

      if (lista.length === 0) { cont.innerHTML = `<div class="empty-state--sm"><div class="empty-state__icon">${SVG.inbox}</div><p>Sin ${tab === 'miembros' ? 'miembros' : 'solicitudes'}</p></div>`; return; }

      if (tab === 'miembros') {
        const soyCapitan = grupoCompleto.esCapitan;
        cont.innerHTML = miembros.map(m => {
          const esElCapitan = m.rol === 'capitan'; const esSubCapitan = m.rol === 'admin'; const puedoHacerAlgo = soyCapitan && !esElCapitan;
          return `<div class="solicitud-item"><img src="${m.avatar || AVATAR_FALLBACK}" class="avatar avatar--md" alt="" /><div class="solicitud-item__info"><div class="solicitud-item__nombre">${m.nombre} ${esElCapitan ? `<span class="badge badge--primary" style="margin-left:6px">${SVG.crown}</span>` : ''} ${esSubCapitan && !esElCapitan ? `<span class="badge badge--warning" style="margin-left:6px">${SVG.crown} Sub-capitán</span>` : ''}</div><div class="solicitud-item__meta">${m.posicion || 'Sin posición'}</div></div><div class="solicitud-item__actions">${puedoHacerAlgo && !esSubCapitan ? `<button class="btn btn--ghost btn--sm" data-nombrar-admin="${m.id}" title="Hacer sub-capitán">${SVG.crown}</button>` : ''}${puedoHacerAlgo && esSubCapitan ? `<button class="btn btn--ghost btn--sm" data-quitar-admin="${m.id}" title="Quitar sub-capitán">${SVG.userMinus}</button>` : ''}${puedoHacerAlgo ? `<button class="btn btn--ghost btn--sm" data-expulsar-miembro="${m.id}" style="color:var(--color-danger)" title="Expulsar">${SVG.trash}</button>` : ''}</div></div>`;
        }).join('');

        cont.querySelectorAll('[data-expulsar-miembro]').forEach(btn => { btn.addEventListener('click', async () => { if (!confirm('¿Expulsar a este miembro?')) return; try { await expulsarMiembroAPI(grupo.id, btn.dataset.expulsarMiembro); toast('Miembro expulsado', 'info'); await renderGestionMiembros(grupo, tab); await recargarPaneles(); } catch (err) { toast(err.message || 'Error', 'error'); } }); });
        cont.querySelectorAll('[data-nombrar-admin]').forEach(btn => { btn.addEventListener('click', async () => { try { await cambiarRolMiembroAPI(grupo.id, btn.dataset.nombrarAdmin, 'admin'); toast('Ahora es sub-capitán', 'success'); await renderGestionMiembros(grupo, tab); await recargarPaneles(); } catch (err) { toast(err.message || 'Error', 'error'); } }); });
        cont.querySelectorAll('[data-quitar-admin]').forEach(btn => { btn.addEventListener('click', async () => { try { await cambiarRolMiembroAPI(grupo.id, btn.dataset.quitarAdmin, 'miembro'); toast('Sub-capitán removido', 'info'); await renderGestionMiembros(grupo, tab); await recargarPaneles(); } catch (err) { toast(err.message || 'Error', 'error'); } }); });

      } else {
        cont.innerHTML = solicitudes.map(s => `<div class="solicitud-item"><img src="${s.avatar || AVATAR_FALLBACK}" class="avatar avatar--md" alt="" /><div class="solicitud-item__info"><div class="solicitud-item__nombre">${s.nombre}</div><div class="solicitud-item__meta">Solicitó unirse · ${new Date(s.fecha).toLocaleDateString('es-CL')}</div></div><div class="solicitud-item__actions"><button class="btn btn--primary btn--sm" data-aceptar-sol="${s.id_usuario ?? s.usuario_id}">Aceptar</button><button class="btn btn--ghost btn--sm" data-rechazar-sol="${s.id_usuario ?? s.usuario_id}">✕</button></div></div>`).join('');
        cont.querySelectorAll('[data-aceptar-sol]').forEach(btn => { btn.addEventListener('click', async () => { try { await gestionarSolicitudAPI(grupo.id, btn.dataset.aceptarSol, 'aprobar'); toast('Solicitud aceptada', 'success'); await renderGestionMiembros(grupo, tab); await recargarPaneles(); } catch (err) { toast(err.message || 'Error', 'error'); } }); });
        cont.querySelectorAll('[data-rechazar-sol]').forEach(btn => { btn.addEventListener('click', async () => { try { await gestionarSolicitudAPI(grupo.id, btn.dataset.rechazarSol, 'rechazar'); toast('Solicitud rechazada', 'info'); await renderGestionMiembros(grupo, tab); await recargarPaneles(); } catch (err) { toast(err.message || 'Error', 'error'); } }); });
      }
    } catch (err) { cont.innerHTML = `<p class="text-sm text-muted text-center">No se pudo cargar la lista</p>`; }
  }

  document.querySelectorAll('[data-tab-gestion]').forEach(tab => { tab.addEventListener('click', () => { if (grupoEnGestion) renderGestionMiembros(grupoEnGestion, tab.dataset.tabGestion); }); });

  function abrirModalStats(grupo) {
    if (!grupo.esPremium) {
      toast('La edición de estadísticas es exclusiva de equipos con plan Premium.', 'error');
      return;
    }

    const modal = document.getElementById('modal-grupo-stats');
    if (!modal) return;
    document.getElementById('grupo-stats-titulo').innerHTML = `Stats de ${renderIconoHtml(grupo.escudo || RUTA_ESCUDO, 20)} ${grupo.nombre}`;
    document.getElementById('gs-victorias').value = grupo.stats?.victorias ?? 0;
    document.getElementById('gs-empates').value   = grupo.stats?.empates   ?? 0;
    document.getElementById('gs-derrotas').value  = grupo.stats?.derrotas  ?? 0;
    document.getElementById('gs-victorias-privada').checked = !!grupo.statsVictoriasPrivadas;
    document.getElementById('gs-empates-privada').checked   = !!grupo.statsEmpatesPrivadas;
    document.getElementById('gs-derrotas-privada').checked  = !!grupo.statsDerrotasPrivadas;

    document.getElementById('btn-guardar-grupo-stats').onclick = async () => {
      const datos = { victorias: Math.max(0, Number(document.getElementById('gs-victorias').value) || 0), empates: Math.max(0, Number(document.getElementById('gs-empates').value) || 0), derrotas: Math.max(0, Number(document.getElementById('gs-derrotas').value) || 0), victoriasPrivadas: document.getElementById('gs-victorias-privada').checked, empatesPrivadas: document.getElementById('gs-empates-privada').checked, derrotasPrivadas: document.getElementById('gs-derrotas-privada').checked };
      try { await editarStatsAPI(grupo.id, datos); cerrarModal('modal-grupo-stats'); toast('Stats actualizadas', 'success'); await recargarPaneles(); } catch (err) { toast(err.message || 'Error', 'error'); }
    };

    modal.querySelectorAll('[data-cerrar-modal]').forEach(btn => { btn.onclick = () => cerrarModal('modal-grupo-stats'); });
    modal.onclick = (e) => { if (e.target === modal) cerrarModal('modal-grupo-stats'); };
    abrirModal('modal-grupo-stats');
  }

  async function confirmarEliminarGrupo(grupo, esComunidad) {
    if (!confirm(`¿Eliminar "${grupo.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await eliminarGrupoAPI(grupo.id); toast('Grupo eliminado', 'info');
      if (String(grupoAbiertoEquipo) === String(grupo.id)) grupoAbiertoEquipo = null;
      if (String(grupoAbiertoComunidad) === String(grupo.id)) grupoAbiertoComunidad = null;
      await recargarPaneles();
    } catch (err) { toast(err.message || 'Error', 'error'); }
  }

  async function confirmarSalirGrupo(grupo, esComunidad) {
    if (!confirm(`¿Salir de "${grupo.nombre}"?`)) return;
    try {
      await salirDeGrupoAPI(grupo.id); toast('Saliste del grupo', 'info');
      if (String(grupoAbiertoEquipo) === String(grupo.id)) grupoAbiertoEquipo = null;
      if (String(grupoAbiertoComunidad) === String(grupo.id)) grupoAbiertoComunidad = null;
      await recargarPaneles();
      if (grupoAbiertoBuscar) {
        try {
          const { data: lista } = await listarGrupos({ limit: 50 });
          listaBusquedaActual = lista;
          const grupoActualizado = listaBusquedaActual.find(g => String(g.id) === String(grupoAbiertoBuscar));
          if (grupoActualizado) { await renderDetalleGrupo(grupoActualizado, grupoActualizado.tipo === 'comunidad', () => { grupoAbiertoBuscar = null; renderPanelBuscar(); }, true); }
          else { grupoAbiertoBuscar = null; renderPanelBuscar(); }
        } catch (err) { renderPanelBuscar(); }
      }
    } catch (err) { toast(err.message || 'Error', 'error'); }
  }

  async function cancelarSolicitudUI(grupo, esComunidad) {
    if (!confirm(`¿Cancelar tu solicitud para unirte a "${grupo.nombre}"?`)) return;
    try {
      await cancelarMiSolicitudAPI(grupo.id); toast('Solicitud cancelada', 'info');
      await recargarPaneles();
      if (grupoAbiertoBuscar) {
        try {
          const { data: lista } = await listarGrupos({ limit: 50 });
          listaBusquedaActual = lista;
          const grupoActualizado = listaBusquedaActual.find(g => String(g.id) === String(grupoAbiertoBuscar));
          if (grupoActualizado) { await renderDetalleGrupo(grupoActualizado, grupoActualizado.tipo === 'comunidad', () => { grupoAbiertoBuscar = null; renderPanelBuscar(); }, true); }
          else { grupoAbiertoBuscar = null; renderPanelBuscar(); }
        } catch (err) { renderPanelBuscar(); }
      }
    } catch (err) { toast(err.message || 'Error', 'error'); }
  }

  async function renderPanelBuscar() {
    const contenedor = document.getElementById('resultados-busqueda');
    if (!contenedor) return;

    if (grupoAbiertoBuscar) {
      const grupo = listaBusquedaActual.find(g => String(g.id) === String(grupoAbiertoBuscar));
      if (!grupo) grupoAbiertoBuscar = null;
      else {
        await renderDetalleGrupo(grupo, grupo.tipo === 'comunidad', () => { grupoAbiertoBuscar = null; renderPanelBuscar(); }, true);
        return;
      }
    }

    const input = document.getElementById('input-buscar-clubes');
    const resultados = document.getElementById('resultados-busqueda');
    const chipsTipo = document.querySelectorAll('[data-filtro-tipo]');
    const chipsAcceso = document.querySelectorAll('[data-filtro-acceso]');
    if (!input || !resultados) return;

    let filtroTipo = 'todos'; let filtroAcceso = 'todos'; let textoBusqueda = '';
    const tipoActivo = document.querySelector('[data-filtro-tipo].chip--active'); if (tipoActivo) filtroTipo = tipoActivo.dataset.filtroTipo;
    const accesoActivo = document.querySelector('[data-filtro-acceso].chip--active'); if (accesoActivo) filtroAcceso = accesoActivo.dataset.filtroAcceso;
    input.value = textoBusqueda;

    async function pintar() {
      resultados.innerHTML = '<p class="text-sm text-muted text-center" style="padding:var(--space-4)">Buscando...</p>';
      try {
        const filtros = { limit: 50 };
        if (filtroTipo === 'equipo')     filtros.tipo = 'equipo';
        if (filtroTipo === 'comunidad')  filtros.tipo = 'comunidad';
        if (filtroAcceso === 'publico')  filtros.tipoAcceso = 'publico';
        if (filtroAcceso === 'privado')  filtros.tipoAcceso = 'privado';
        if (textoBusqueda)               filtros.busqueda = textoBusqueda;

        const { data: lista } = await listarGrupos(filtros);
        listaBusquedaActual = lista;

        if (lista.length === 0) { resultados.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-state__icon">${SVG.search}</div><p>No se encontraron resultados con esos filtros.</p></div></div>`; return; }

        resultados.innerHTML = `
          <div class="grupo-grid">
            ${lista.map(g => {
              const esPrivado = g.tipoAcceso === 'privado'; const esComunidad = g.tipo === 'comunidad'; const yaSoyMiembro = g.esMiembro || g.esCapitan;
              const color = colorDeporte(g.deporte);
              const escudoHtml = renderIconoHtml(g.iconoPersonalizado || g.escudo || RUTA_ESCUDO, 36);
              
              let bannerStyle = `background: linear-gradient(135deg, ${color.from} 0%, ${color.to} 100%);`;
              if (g.cardColor) bannerStyle = `background: linear-gradient(135deg, ${g.cardColor} 0%, ${g.cardColor}DD 100%);`;
              if (g.cardFoto) bannerStyle = `background-image: url('${g.cardFoto}'); background-size: cover; background-position: center;`;

              const marco = getMarcoData(g.marcoIcono, g.marcoColorIcono);

              const partidos = calcularPartidos(g.stats); const porcentaje = calcularPorcentaje(g.stats);
              const victoriasVisibles = statEsVisible(g.stats?.victorias); const mostrarPorcentaje = victoriasVisibles && partidos > 0;

              return `
                <article class="grupo-card" data-grupo-id="${g.id}" role="button" tabindex="0">
                  <div class="grupo-card__banner" style="${bannerStyle}"></div>
                  <div class="grupo-card__crest ${marco.clase}" style="${marco.estilo}">${escudoHtml}</div>
                  <div class="grupo-card__body">
                    <div class="grupo-card__rol">
                      <span class="badge badge--neutral" title="${esComunidad ? 'Comunidad' : 'Equipo'}">${esComunidad ? SVG.globe : SVG.users}</span>
                      ${esPrivado ? `<span class="badge badge--warning" title="Privado">${SVG.lock}</span>` : ''}
                      ${yaSoyMiembro ? `<span class="badge badge--success" title="Miembro">${SVG.check}</span>` : ''}
                    </div>
                    <h3 class="grupo-card__title">${g.nombre}</h3>
                    <p class="grupo-card__sub">${g.deporte}${g.ciudad ? ' · ' + g.ciudad : ''}</p>
                    <div class="grupo-card__stats ${mostrarPorcentaje ? '' : 'grupo-card__stats--2'}">
                      <div class="grupo-stat"><div class="grupo-stat__value">${g.totalMiembros || 0}</div><div class="grupo-stat__label">Miembros</div></div>
                      <div class="grupo-stat"><div class="grupo-stat__value">${partidos}</div><div class="grupo-stat__label">Partidos</div></div>
                      ${mostrarPorcentaje ? `<div class="grupo-stat"><div class="grupo-stat__value">${porcentaje}%</div><div class="grupo-stat__label">Victorias</div></div>` : ''}
                    </div>
                  </div>
                </article>
              `;
            }).join('')}
          </div>`;

        resultados.querySelectorAll('.grupo-card').forEach(card => {
          card.addEventListener('click', (e) => { if (e.target.closest('[data-unirse]')) return; grupoAbiertoBuscar = card.dataset.grupoId; subTabDetalleEquipo = 'info'; renderPanelBuscar(); });
          card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (e.target.closest('[data-unirse]')) return; grupoAbiertoBuscar = card.dataset.grupoId; subTabDetalleEquipo = 'info'; renderPanelBuscar(); } });
        });
      } catch (err) { resultados.innerHTML = `<p class="text-sm text-muted text-center">Error al buscar</p>`; }
    }

    input.oninput = () => { textoBusqueda = input.value; pintar(); };
    chipsTipo.forEach(chip => { chip.onclick = () => { chipsTipo.forEach(c => c.classList.remove('chip--active')); chip.classList.add('chip--active'); filtroTipo = chip.dataset.filtroTipo; pintar(); }; });
    chipsAcceso.forEach(chip => { chip.onclick = () => { chipsAcceso.forEach(c => c.classList.remove('chip--active')); chip.classList.add('chip--active'); filtroAcceso = chip.dataset.filtroAcceso; pintar(); }; });
    pintar();
  }

  async function cambiarTab(tab) {
    if (tab !== 'equipo')     grupoAbiertoEquipo = null;
    if (tab !== 'comunidad')  grupoAbiertoComunidad = null;
    if (tab !== 'buscar')     grupoAbiertoBuscar = null;

    subtabs.forEach(st => st.classList.toggle('subtab--active', st.dataset.tabEquipo === tab));
    panelEquipo.classList.toggle('subpanel--active', tab === 'equipo');
    panelComunidad.classList.toggle('subpanel--active', tab === 'comunidad');
    panelChat.classList.toggle('subpanel--active', tab === 'chat');
    panelBuscar.classList.toggle('subpanel--active', tab === 'buscar');

    if (tab === 'equipo')     renderPanelEquipo();
    if (tab === 'comunidad')  renderPanelComunidad();
    if (tab === 'buscar')     renderPanelBuscar();

    if (tab === 'chat') {
      await cargarCanales(); renderListaCanales();
      if (!canalActualId) renderEmptyPanelCanal();
      else await renderPanelCanalGlobal(canalActualId);
    } else { if (intervaloCanal) { clearInterval(intervaloCanal); intervaloCanal = null; } }
  }

  subtabs.forEach(st => { st.addEventListener('click', () => cambiarTab(st.dataset.tabEquipo)); });
  inputBuscarCanal?.addEventListener('input', (e) => { filtroBusquedaCanal = e.target.value; renderListaCanales(); });

  await recargarGrupos();
  await renderPanelEquipo();
  await renderPanelComunidad();

  return () => {
    if (intervaloCanal) clearInterval(intervaloCanal);
    if (intervaloDetalle) clearInterval(intervaloDetalle);
  };
}
// ⚡ FUNCIÓN ÚNICA (Afuera de init) CON EL BOTÓN DE COMPARTIR
async function abrirModalInvitarGrupo(grupo) {
  let modal = document.getElementById('modal-invitar-grupo');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-invitar-grupo';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal" style="max-width: 450px;">
        <div class="modal__header">
          <h3 class="modal__title">Invitar a ${grupo.nombre}</h3>
          <button class="modal__close" data-cerrar-modal="modal-invitar-grupo">✕</button>
        </div>
        <div class="modal__body">
          <p class="text-sm text-muted mb-3">Invita a tus amigos directamente o comparte un enlace.</p>
          <div id="lista-amigos-invitar" style="max-height: 250px; overflow-y: auto; margin-bottom: 16px;">
            <div class="page-loader"><div class="spinner"></div></div>
          </div>
        </div>
        <div class="modal__footer" style="flex-direction: column; gap: 8px;">
          <button class="btn btn--primary w-full" id="btn-compartir-link-grupo" style="display:flex; justify-content:center; gap:8px;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Compartir enlace de invitación
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const contAmigos = modal.querySelector('#lista-amigos-invitar');
  
  modal.querySelectorAll('[data-cerrar-modal]').forEach(b => b.onclick = () => cerrarModal('modal-invitar-grupo'));
  modal.onclick = (e) => { if (e.target === modal) cerrarModal('modal-invitar-grupo'); };
  abrirModal('modal-invitar-grupo');

  // Evento Compartir Link
  modal.querySelector('#btn-compartir-link-grupo').onclick = async () => {
    try {
      const { generarLinkGrupo } = await import('../services/grupos.service.js');
      const { token } = await generarLinkGrupo(grupo.id);
      const url = `${window.location.origin}${window.location.pathname}#/join/grupo/${token}`;
      
      if (navigator.share) {
        await navigator.share({ title: `Únete a ${grupo.nombre}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast('Enlace copiado al portapapeles', 'success');
      }
    } catch (err) {
      toast(err.message || 'Error al generar link', 'error');
    }
  };

  // Cargar lista de amigos
  try {
    const { listarAmigos } = await import('../services/amistades.service.js');
    const { invitarAmigoAGrupo } = await import('../services/grupos.service.js');
    
    const amigos = await listarAmigos();
    const grupoCompleto = await obtenerGrupo(grupo.id);
    const idsMiembros = new Set((grupoCompleto.miembros || []).map(m => String(m.id)));

    const amigosNoMiembros = amigos.filter(a => !idsMiembros.has(String(a.id)));

    if (amigosNoMiembros.length === 0) {
      contAmigos.innerHTML = `<p class="text-sm text-muted text-center">No tienes amigos disponibles para invitar.</p>`;
      return;
    }

    contAmigos.innerHTML = amigosNoMiembros.map(a => `
      <div class="amigo-item">
        <img src="${a.avatar || AVATAR_FALLBACK}" class="avatar avatar--md" />
        <div class="amigo-item__info">
          <div class="amigo-item__name">${a.nombre}</div>
          <div class="amigo-item__sub">@${a.username}</div>
        </div>
        <button class="btn btn--primary btn--sm" data-invitar-amigo="${a.id}">Invitar</button>
      </div>
    `).join('');

    contAmigos.querySelectorAll('[data-invitar-amigo]').forEach(btn => {
      btn.onclick = async () => {
        btn.disabled = true; btn.textContent = 'Invitado';
        try {
          await invitarAmigoAGrupo(grupo.id, btn.dataset.invitarAmigo);
          toast('Invitación enviada', 'success');
        } catch (err) {
          toast(err.message || 'Error al invitar', 'error');
          btn.disabled = false; btn.textContent = 'Invitar';
        }
      };
    });
  } catch (err) {
    contAmigos.innerHTML = `<p class="text-sm text-danger text-center">Error al cargar amigos</p>`;
  }
}