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

export const mockPublicaciones = [];
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
  { valor: 'amistoso', label: 'Amistoso', descripcion: 'Sin exigencia' },
  { valor: 'medio', label: 'Nivel Medio', descripcion: 'Nivel intermedio' },
  { valor: 'avanzado', label: 'Nivel Avanzado', descripcion: 'Alto nivel' },
];