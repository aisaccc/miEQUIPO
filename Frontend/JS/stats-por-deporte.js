/* =========================================================
   stats-por-deporte.js — Registros disponibles por deporte
   =========================================================
   Cada deporte tiene su lista de estadísticas posibles.
   El usuario elige cuáles lleva y cuáles son públicas.
*/

export const statsPorDeporte = {
  'Fútbol': [
    { nombre: 'Goles',       clave: 'goles' },
    { nombre: 'Asistencias', clave: 'asistencias' },
    { nombre: 'Partidos',    clave: 'partidos' },
    { nombre: 'Tarjetas',    clave: 'tarjetas' }
  ],
  'Básquetbol': [
    { nombre: 'Puntos',      clave: 'puntos' },
    { nombre: 'Rebotes',     clave: 'rebotes' },
    { nombre: 'Asistencias', clave: 'asistencias' },
    { nombre: 'Partidos',    clave: 'partidos' }
  ],
  'Vóleibol': [
    { nombre: 'Puntos',      clave: 'puntos' },
    { nombre: 'Aces',        clave: 'aces' },
    { nombre: 'Bloqueos',    clave: 'bloqueos' },
    { nombre: 'Partidos',    clave: 'partidos' }
  ],
  'Béisbol': [
    { nombre: 'Homeruns',    clave: 'homeruns' },
    { nombre: 'Vueltas',     clave: 'vueltas' },
    { nombre: 'Pitcheo',     clave: 'pitcheo' },
    { nombre: 'Partidos',    clave: 'partidos' }
  ],
  'Hockey': [
    { nombre: 'Goles',       clave: 'goles' },
    { nombre: 'Asistencias', clave: 'asistencias' },
    { nombre: 'Partidos',    clave: 'partidos' }
  ],
  'Rugby': [
    { nombre: 'Tries',       clave: 'tries' },
    { nombre: 'Conversiones',clave: 'conversiones' },
    { nombre: 'Partidos',    clave: 'partidos' }
  ],
  'Handball': [
    { nombre: 'Goles',       clave: 'goles' },
    { nombre: 'Asistencias', clave: 'asistencias' },
    { nombre: 'Partidos',    clave: 'partidos' }
  ],
  'Fútbol americano': [
    { nombre: 'Touchdowns',  clave: 'touchdowns' },
    { nombre: 'Yardas',      clave: 'yardas' },
    { nombre: 'Partidos',    clave: 'partidos' }
  ],

  /* ---------- Individuales: Victoria / Derrota ---------- */
  'Tenis': [
    { nombre: 'Victorias',   clave: 'victorias' },
    { nombre: 'Derrotas',    clave: 'derrotas' },
    { nombre: 'Partidos',    clave: 'partidos' }
  ],
  'Pádel': [
    { nombre: 'Victorias',   clave: 'victorias' },
    { nombre: 'Derrotas',    clave: 'derrotas' },
    { nombre: 'Partidos',    clave: 'partidos' }
  ],
  'Squash': [
    { nombre: 'Victorias',   clave: 'victorias' },
    { nombre: 'Derrotas',    clave: 'derrotas' },
    { nombre: 'Partidos',    clave: 'partidos' }
  ],
  'Tenis de mesa': [
    { nombre: 'Victorias',   clave: 'victorias' },
    { nombre: 'Derrotas',    clave: 'derrotas' },
    { nombre: 'Partidos',    clave: 'partidos' }
  ],
  'Bádminton': [
    { nombre: 'Victorias',   clave: 'victorias' },
    { nombre: 'Derrotas',    clave: 'derrotas' },
    { nombre: 'Partidos',    clave: 'partidos' }
  ],
  'Boxeo': [
    { nombre: 'Victorias',   clave: 'victorias' },
    { nombre: 'Derrotas',    clave: 'derrotas' },
    { nombre: 'Empates',     clave: 'empates' }
  ],
  'Golf': [
    { nombre: 'Torneos ganados', clave: 'torneos_ganados' },
    { nombre: 'Mejor score',     clave: 'mejor_score' }
  ],
  'Natación': [
    { nombre: 'Medallas',   clave: 'medallas' },
    { nombre: 'Competencias', clave: 'competencias' }
  ],
  'Atletismo': [
    { nombre: 'Medallas',   clave: 'medallas' },
    { nombre: 'Competencias', clave: 'competencias' }
  ],
  'Ciclismo': [
    { nombre: 'Carreras',   clave: 'carreras' },
    { nombre: 'Kilómetros', clave: 'kilometros' }
  ],
  'Surf': [
    { nombre: 'Sesiones',   clave: 'sesiones' },
    { nombre: 'Mejores olas', clave: 'mejores_olas' }
  ],
  'Escalada': [
    { nombre: 'Rutas',      clave: 'rutas' },
    { nombre: 'Grado máximo', clave: 'grado_maximo' }
  ]
};

/** Helper: devuelve las stats de un deporte (o array vacío) */
export function getStatsDeDeporte(deporte) {
  return statsPorDeporte[deporte] || [];
}

/** Helper: ¿este deporte es individual? (sin posiciones y con victorias/derrotas) */
export function esDeporteIndividual(deporte) {
  const individuales = ['Tenis', 'Pádel', 'Squash', 'Tenis de mesa', 'Bádminton', 'Boxeo', 'Golf', 'Natación', 'Atletismo', 'Ciclismo', 'Surf', 'Escalada'];
  return individuales.includes(deporte);
}