/* =========================================================
   reglas-deporte.js — Reglas y formato de resultado por deporte
   =========================================================
   Define:
   - tipo: 'simple_sin_empate' | 'simple_con_penales' | 'sets'
           | 'tiempo' | 'puntos'
   - labelMarcador: qué muestra el input simple ('Goles', 'Puntos', ...)
   - labelDesempate: qué muestra el campo de desempate ('Penales', ...)
   - sets: config para deportes por sets (vóley, tenis, etc.)
   - tiempo/puntos: qué input mostrar y cómo se formatea
   ========================================================= */

export const REGLAS_DEPORTE = {
  /* ===================== SIMPLE SIN EMPATE =====================
     El marcador es único (goles/puntos/carreras).
     No se permite empate. Si empatan → hay que ir a prórroga/extra.
     ============================================================== */
  'Básquetbol': {
    tipo: 'simple_sin_empate',
    labelMarcador: 'Puntos',
  },
  'Fútbol americano': {
    tipo: 'simple_sin_empate',
    labelMarcador: 'Puntos',
  },
  'Béisbol': {
    tipo: 'simple_sin_empate',
    labelMarcador: 'Carreras',
  },
  'Rugby': {
    tipo: 'simple_sin_empate',
    labelMarcador: 'Puntos',
  },
  'Golf': {
    tipo: 'simple_sin_empate',
    labelMarcador: 'Hoyos ganados',
    hint: 'Si empatan, se juega hoyo a hoyo hasta que alguien gane.',
  },

  /* ===================== SIMPLE CON PENALES =====================
     El marcador es único (goles).
     Si empatan → aparece campo de penales.
     ============================================================== */
  'Fútbol': {
    tipo: 'simple_con_penales',
    labelMarcador: 'Goles',
    labelDesempate: 'Penales',
  },
  'Hockey': {
    tipo: 'simple_con_penales',
    labelMarcador: 'Goles',
    labelDesempate: 'Penales',
  },
  'Handball': {
    tipo: 'simple_con_penales',
    labelMarcador: 'Goles',
    labelDesempate: 'Penales',
  },

  /* ===================== SETS =====================
     Deportes por sets. Cada set tiene sus puntos.
     - Vóley: mejor de 5 sets. Sets 1-4 a 25 puntos con dif 2.
              5° set (si van 2-2) a 15 puntos con dif 2.
     - Bádminton: mejor de 3 sets. Sets a 21 puntos con dif 2.
                  Cap de 30 (si van 29-29, el que hace 30 gana).
     - Tenis de mesa: mejor de 5 sets. Sets a 11 puntos con dif 2.
     - Tenis/Pádel/Squash: mejor de 3 o 5 sets. Games con tiebreak si 6-6.
     ============================================================== */
  'Vóleibol': {
    tipo: 'sets',
    labelSets: 'Set',
    maxSets: 5,
    setsParaGanar: 3,
    puntosPorSet: [25, 25, 25, 25, 15],
    diferencia: 2,
  },
  'Bádminton': {
    tipo: 'sets',
    labelSets: 'Set',
    maxSets: 3,
    setsParaGanar: 2,
    puntosPorSet: [21, 21, 21],
    diferencia: 2,
    capPuntos: 30,
  },
  'Tenis de mesa': {
    tipo: 'sets',
    labelSets: 'Set',
    maxSets: 5,
    setsParaGanar: 3,
    puntosPorSet: [11, 11, 11, 11, 11],
    diferencia: 2,
  },
  'Tenis': {
    tipo: 'sets',
    labelSets: 'Set',
    maxSets: 3,
    setsParaGanar: 2,
    sistema: 'games',
  },
  'Pádel': {
    tipo: 'sets',
    labelSets: 'Set',
    maxSets: 3,
    setsParaGanar: 2,
    sistema: 'games',
  },
  'Squash': {
    tipo: 'sets',
    labelSets: 'Set',
    maxSets: 5,
    setsParaGanar: 3,
    puntosPorSet: [11, 11, 11, 11, 11],
    diferencia: 2,
  },

  /* ===================== ⚡ POR TIEMPO =====================
     Deportes donde el MENOR tiempo gana.
     El organizador carga tiempo por participante:
       minutos + segundos + centésimas
     Se guarda como `tiempoSeg` (número con decimales).
     ============================================================== */
  'Natación': {
    tipo: 'tiempo',
    labelResultado: 'Tiempo',
    hint: 'El menor tiempo gana. Ingresá minutos, segundos y centésimas.',
  },
  'Atletismo': {
    tipo: 'tiempo',
    labelResultado: 'Tiempo',
    hint: 'El menor tiempo gana. Ingresá minutos, segundos y centésimas.',
  },
  'Ciclismo': {
    tipo: 'tiempo',
    labelResultado: 'Tiempo',
    hint: 'El menor tiempo gana. Ingresá minutos, segundos y centésimas.',
  },

  /* ===================== ⚡ POR PUNTOS =====================
     Deportes donde el MAYOR puntaje gana.
     El organizador carga puntos por participante.
     ============================================================== */
  'Escalada': {
    tipo: 'puntos',
    labelResultado: 'Puntos',
    hint: 'El mayor puntaje gana.',
  },
  'Surf': {
    tipo: 'puntos',
    labelResultado: 'Puntos',
    hint: 'El mayor puntaje gana.',
  },
  'Boxeo': {
    tipo: 'puntos',
    labelResultado: 'Puntos',
    hint: 'El mayor puntaje gana.',
  },
};

/* =========================================================
   Helper: obtener reglas de un deporte
   Si el deporte no está en el mapa, devuelve un fallback.
   ========================================================= */
export function getReglasDeporte(deporte) {
  return REGLAS_DEPORTE[deporte] || {
    tipo: 'simple_sin_empate',
    labelMarcador: 'Puntos',
  };
}

/* =========================================================
   Helper: ¿el deporte es por sets?
   ========================================================= */
export function esPorSets(deporte) {
  return getReglasDeporte(deporte).tipo === 'sets';
}

/* =========================================================
   Helper: ¿el deporte permite penales si empatan?
   ========================================================= */
export function permiteDesempate(deporte) {
  return getReglasDeporte(deporte).tipo === 'simple_con_penales';
}

/* =========================================================
   ⚡ Helper: ¿el deporte usa sistema por tiempo/puntos?
   =========================================================
   Acepta también el sistema que viene del torneo. Si el
   organizador forzó 'simple', ignora el tipo intrínseco del
   deporte.
   ========================================================= */
export function esPorTiempo(deporte, sistemaClasificacion = null) {
  if (sistemaClasificacion && sistemaClasificacion !== 'simple') {
    return sistemaClasificacion === 'tiempo';
  }
  return getReglasDeporte(deporte).tipo === 'tiempo';
}

export function esPorPuntos(deporte, sistemaClasificacion = null) {
  if (sistemaClasificacion && sistemaClasificacion !== 'simple') {
    return sistemaClasificacion === 'puntos';
  }
  return getReglasDeporte(deporte).tipo === 'puntos';
}

/* =========================================================
   ⚡ Helper: sistema efectivo del torneo
   =========================================================
   Si el torneo trae `sistemaClasificacion`, ese manda.
   Si no, se infiere del deporte.
   ========================================================= */
export function getSistemaEfectivo(deporte, sistemaClasificacion = null) {
  if (sistemaClasificacion && sistemaClasificacion !== 'simple') {
    return sistemaClasificacion;
  }

  const reglas = getReglasDeporte(deporte);
  if (reglas.tipo === 'tiempo') return 'tiempo';
  if (reglas.tipo === 'puntos') return 'puntos';
  return 'simple';
}

/* =========================================================
   ⚡ Helper: formatear tiempo (segundos → "1:23.45")
   ========================================================= */
export function formatearTiempo(tiempoSeg) {
  const total = Number(tiempoSeg);
  if (!Number.isFinite(total)) return '—';

  const minutos = Math.floor(total / 60);
  const segundos = Math.floor(total % 60);
  const centesimas = Math.round((total - Math.floor(total)) * 100);

  const segStr = String(segundos).padStart(2, '0');
  const centStr = String(centesimas).padStart(2, '0');

  if (minutos > 0) {
    return `${minutos}:${segStr}.${centStr}`;
  }
  return `${segundos}.${centStr}s`;
}

/* =========================================================
   ⚡ Helper: parsear tiempo (min, seg, cent) → segundos
   ========================================================= */
export function parsearTiempo(minutos, segundos, centesimas) {
  const m = Number(minutos) || 0;
  const s = Number(segundos) || 0;
  const c = Number(centesimas) || 0;
  return m * 60 + s + c / 100;
}

/* =========================================================
   Helper: formatear el resultado para mostrar
   - Simple: "2 - 1"
   - Simple con penales: "2 - 2 (4-3)"
   - Sets: "3 - 1"
   - Tiempo: "1:23.45 - 1:24.10"
   - Puntos: "95 - 88"
   ========================================================= */
export function formatearResultado(deporte, resultado, sistemaClasificacion = null) {
  if (!resultado) return '';

  const sistema = getSistemaEfectivo(deporte, sistemaClasificacion);

  /* ---------- ⚡ TIEMPO ---------- */
  if (sistema === 'tiempo') {
    const partes = Array.isArray(resultado.participantes) ? resultado.participantes : [];
    if (partes.length < 2) return '';

    const tiempos = partes.map(p => formatearTiempo(p.tiempoSeg));
    const min = Math.min(...partes.map(p => Number(p.tiempoSeg)).filter(Number.isFinite));
    const idxGanador = partes.findIndex(p => Number(p.tiempoSeg) === min);

    if (idxGanador === 0) return `${tiempos[0]} - ${tiempos[1]}`;
    return `${tiempos[1]} - ${tiempos[0]}`;
  }

  /* ---------- ⚡ PUNTOS ---------- */
  if (sistema === 'puntos') {
    const partes = Array.isArray(resultado.participantes) ? resultado.participantes : [];
    if (partes.length < 2) return '';

    const p0 = Number(partes[0].puntos) || 0;
    const p1 = Number(partes[1].puntos) || 0;

    if (p0 >= p1) return `${p0} - ${p1}`;
    return `${p1} - ${p0}`;
  }

  /* ---------- SIMPLE ---------- */
  const reglas = getReglasDeporte(deporte);
  if (reglas.tipo === 'simple_sin_empate' || reglas.tipo === 'simple_con_penales') {
    const local = resultado.goles_local ?? resultado.puntos_local ?? resultado.carreras_local ?? 0;
    const visitante = resultado.goles_visitante ?? resultado.puntos_visitante ?? resultado.carreras_visitante ?? 0;

    if (resultado.penales_local != null && resultado.penales_visitante != null) {
      return `${local} - ${visitante} (${resultado.penales_local}-${resultado.penales_visitante} pen.)`;
    }

    return `${local} - ${visitante}`;
  }

  /* ---------- SETS ---------- */
  if (reglas.tipo === 'sets' && Array.isArray(resultado.sets)) {
    const setsLocal = resultado.setsLocal ?? resultado.sets.filter(s => s.local > s.visitante).length;
    const setsVisitante = resultado.setsVisitante ?? resultado.sets.filter(s => s.visitante > s.local).length;
    return `${setsLocal} - ${setsVisitante}`;
  }

  return '';
}

/* =========================================================
   Helper: calcular ganador ('local' | 'visitante' | 'empate' | null)
   según el deporte, el resultado y el sistema del torneo.
   ========================================================= */
export function calcularGanador(deporte, resultado, sistemaClasificacion = null) {
  if (!resultado) return null;

  const sistema = getSistemaEfectivo(deporte, sistemaClasificacion);

  /* ---------- ⚡ TIEMPO ---------- */
  if (sistema === 'tiempo') {
    const partes = Array.isArray(resultado.participantes) ? resultado.participantes : [];
    if (partes.length < 2) return null;

    const t0 = Number(partes[0].tiempoSeg);
    const t1 = Number(partes[1].tiempoSeg);
    if (!Number.isFinite(t0) || !Number.isFinite(t1)) return null;

    if (t0 < t1) return 'local';
    if (t1 < t0) return 'visitante';
    return 'empate';
  }

  /* ---------- ⚡ PUNTOS ---------- */
  if (sistema === 'puntos') {
    const partes = Array.isArray(resultado.participantes) ? resultado.participantes : [];
    if (partes.length < 2) return null;

    const p0 = Number(partes[0].puntos);
    const p1 = Number(partes[1].puntos);
    if (!Number.isFinite(p0) || !Number.isFinite(p1)) return null;

    if (p0 > p1) return 'local';
    if (p1 > p0) return 'visitante';
    return 'empate';
  }

  /* ---------- SIMPLE ---------- */
  const reglas = getReglasDeporte(deporte);

  if (reglas.tipo === 'simple_sin_empate') {
    const local = Number(resultado.goles_local ?? resultado.puntos_local ?? resultado.carreras_local ?? 0);
    const visitante = Number(resultado.goles_visitante ?? resultado.puntos_visitante ?? resultado.carreras_visitante ?? 0);

    if (local > visitante) return 'local';
    if (visitante > local) return 'visitante';
    return null;
  }

  /* ---------- SIMPLE CON PENALES ---------- */
  if (reglas.tipo === 'simple_con_penales') {
    const local = Number(resultado.goles_local ?? 0);
    const visitante = Number(resultado.goles_visitante ?? 0);

    if (local > visitante) return 'local';
    if (visitante > local) return 'visitante';

    const penLocal = Number(resultado.penales_local ?? 0);
    const penVisitante = Number(resultado.penales_visitante ?? 0);

    if (penLocal > penVisitante) return 'local';
    if (penVisitante > penLocal) return 'visitante';

    return 'empate';
  }

  /* ---------- SETS ---------- */
  if (reglas.tipo === 'sets' && Array.isArray(resultado.sets)) {
    const setsLocal = resultado.setsLocal ?? resultado.sets.filter(s => s.local > s.visitante).length;
    const setsVisitante = resultado.setsVisitante ?? resultado.sets.filter(s => s.visitante > s.local).length;

    if (setsLocal > setsVisitante) return 'local';
    if (setsVisitante > setsLocal) return 'visitante';
    return 'empate';
  }

  return null;
}