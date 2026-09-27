/* =========================================================
   data-mock.js — Datos de prueba mientras no hay backend
   =========================================================
   Cuando hagamos el backend, este archivo se puede borrar
   (o dejar solo como respaldo). El frontend va a consumir
   datos reales desde api.js.
*/

export const mockUsuarios = [
  {
    id: 1,
    nombre: "Juan Pérez",
    username: "juanpe",
    email: "juan@miejquipo.com",
    password: "123456",           // ⚠️ solo para mock, nunca en real
    avatar: "https://i.pravatar.cc/150?img=12",
    deporte_favorito: "Fútbol",
    ciudad: "Santiago",
    bio: "Delantero los fines de semana ⚽",
    stats: { partidos: 42, goles: 18, mvps: 5 }
  },
  {
    id: 2,
    nombre: "María González",
    username: "mariag",
    email: "maria@miejquipo.com",
    password: "123456",
    avatar: "https://i.pravatar.cc/150?img=45",
    deporte_favorito: "Vóleibol",
    ciudad: "Valparaíso",
    bio: "Armadora 🏐",
    stats: { partidos: 30, goles: 0, mvps: 8 }
  }
];

// Deportes soportados (los usaremos en registro y filtros)
export const deportes = [
  "Fútbol", "Básquetbol", "Tenis", "Vóleibol", "Pádel",
  "Golf", "Béisbol", "Hockey", "Boxeo", "Bádminton",
  "Rugby", "Ciclismo", "Natación", "Atletismo", "Tenis de mesa",
  "Squash", "Handball", "Fútbol americano", "Surf", "Escalada"
];
/* =========================================================
   PUBLICACIONES (feed de inicio)
   ========================================================= */

export const mockPublicaciones = [
  {
    id: 1,
    autor: {
      id: 2,
      nombre: 'María González',
      username: 'mariag',
      avatar: 'https://i.pravatar.cc/100?img=45'
    },
    tipo: 'partido',                    // post | partido | torneo | grupo
    contenido: '¡Se necesitan 3 jugadores para el partido de mañana! Cancha techada en Providencia 🏀',
    imagen: null,
    fecha: new Date(Date.now() - 1000 * 60 * 25).toISOString(), // hace 25 min
    likes: 12,
    yoLikee: false,
    comentarios: [
      { id: 1, autor: 'Carlos Ruiz', avatar: 'https://i.pravatar.cc/100?img=13', texto: '¡Cuenta conmigo!', fecha: 'hace 15 min' },
      { id: 2, autor: 'Andrés Soto', avatar: 'https://i.pravatar.cc/100?img=14', texto: '¿A qué hora?', fecha: 'hace 10 min' }
    ]
  },
  {
    id: 2,
    autor: {
      id: 1,
      nombre: 'Juan Pérez',
      username: 'juanpe',
      avatar: 'https://i.pravatar.cc/100?img=12'
    },
    tipo: 'torneo',
    contenido: 'Inscribí a Los Galácticos FC en la Copa Verano 2026 🏆. ¡Vamos con todo este año!',
    imagen: 'https://images.unsplash.com/photo-1552667466-07770ae110d0?w=800',
    fecha: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // hace 2h
    likes: 34,
    yoLikee: true,
    comentarios: [
      { id: 1, autor: 'María González', avatar: 'https://i.pravatar.cc/100?img=45', texto: '¡Éxito equipo! 💪', fecha: 'hace 1 h' }
    ]
  },
  {
    id: 3,
    autor: {
      id: 4,
      nombre: 'Diego Fernández',
      username: 'diegof',
      avatar: 'https://i.pravatar.cc/100?img=15'
    },
    tipo: 'grupo',
    contenido: 'Acabo de crear el grupo "Pádel Weekend" para organizar partidos los sábados por la mañana. ¡Únanse!',
    imagen: null,
    fecha: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    likes: 8,
    yoLikee: false,
    comentarios: []
  },
  {
    id: 4,
    autor: {
      id: 5,
      nombre: 'Camila Torres',
      username: 'camilat',
      avatar: 'https://i.pravatar.cc/100?img=47'
    },
    tipo: 'post',
    contenido: 'Primer torneo de vóleibol mixto del año ✅. ¡Qué buen nivel el de ayer! Gracias a todos los que participaron 🏐',
    imagen: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800',
    fecha: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 día
    likes: 52,
    yoLikee: false,
    comentarios: [
      { id: 1, autor: 'Juan Pérez', avatar: 'https://i.pravatar.cc/100?img=12', texto: '¡Excelente organización!', fecha: 'hace 20 h' },
      { id: 2, autor: 'María González', avatar: 'https://i.pravatar.cc/100?img=45', texto: 'La próxima no me la pierdo', fecha: 'hace 18 h' },
      { id: 3, autor: 'Andrés Soto', avatar: 'https://i.pravatar.cc/100?img=14', texto: '🔥🔥🔥', fecha: 'hace 12 h' }
    ]
  }
];
/* =========================================================
   POSICIONES POR DEPORTE
   =========================================================
   Si un deporte no está aquí o tiene array vacío → no se
   piden posiciones al inscribirse.
*/
export const posicionesPorDeporte = {
  'Fútbol':            ['Portero', 'Defensa', 'Mediocampista', 'Delantero'],
  'Básquetbol':        ['Base', 'Escolta', 'Alero', 'Ala-Pívot', 'Pívot'],
  'Vóleibol':          ['Armador', 'Opuesto', 'Central', 'Punta', 'Líbero'],
  'Béisbol':           ['Pitcher', 'Catcher', 'Infielder', 'Outfielder'],
  'Hockey':            ['Portero', 'Defensa', 'Medio', 'Delantero'],
  'Rugby':             ['Pilar', 'Hooker', 'Segunda línea', 'Tercera línea', 'Medio scrum', 'Apertura', 'Centro', 'Ala', 'Fullback'],
  'Handball':          ['Portero', 'Extremo', 'Lateral', 'Central', 'Pivote'],
  'Fútbol americano':  ['Quarterback', 'Running back', 'Receptor', 'Línea ofensiva', 'Línea defensiva', 'Linebacker', 'Back'],
  // Deportes SIN posiciones (no se piden al inscribirse)
  'Tenis':             [],
  'Pádel':             [],
  'Squash':            [],
  'Tenis de mesa':     [],
  'Bádminton':         [],
  'Golf':              [],
  'Natación':          [],
  'Atletismo':         [],
  'Ciclismo':          [],
  'Surf':              [],
  'Escalada':          [],
  'Boxeo':             [],
};

/* =========================================================
   NIVELES DE PARTIDO
   ========================================================= */
export const nivelesPartido = [
  { valor: 'amistoso',        label: 'Amistoso',        descripcion: 'No requiere aprobación ',                    requiereAprobacion: false, eleccionAprobacion: false },
  { valor: 'semiprofesional', label: 'Semiprofesional', descripcion: 'Tú decides si requiere aprobación',     requiereAprobacion: false, eleccionAprobacion: true  },
  { valor: 'profesional',     label: 'Profesional',     descripcion: 'Requiere aprobación',           requiereAprobacion: true,  eleccionAprobacion: false },
];