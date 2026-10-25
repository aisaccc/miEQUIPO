/* =========================================================
   planes.js — Helpers de plan (Básico / Premium)
   =========================================================
   Fuente de verdad de permisos: `esPremium(user)`.
   `user.plan` es la "intención" guardada, `esPremium` es "ahora".
   Todos los helpers devuelven { ok: boolean, motivo?: string }.
   No se usan todavía en Fase 1 (solo se crean).
   Se llaman desde servicios en Fase 3.
*/

export const PRECIOS_PREMIUM = {
  mensual: { monto: 2990, moneda: 'CLP', etiqueta: 'Mensual' },
  anual:   { monto: 23990, moneda: 'CLP', etiqueta: 'Anual (2 meses gratis)' },
};

export const LIMITES_BASICO = {
  equipos: 2,
  comunidades: 1,
  fotosPerfilPorCiclo: 3,
  fotosGrupoConcurrentes: 4,
  cicloPerfilDias: 30,
};

/**
 * ¿Este usuario es Premium AHORA?
 * Acepta el objeto tal como viene de la DB (plan, premium_hasta) o
 * el que arma auth.middleware (plan, premiumHasta, esPremium).
 */
export function esPremium(user) {
  if (!user) return false;
  if (typeof user.esPremium === 'boolean') return user.esPremium;
  if (user.plan !== 'premium') return false;
  const hasta = user.premium_hasta ?? user.premiumHasta;
  if (!hasta) return true; // perpetuo
  return new Date(hasta) > new Date();
}

/* ---------- Creación de grupos ---------- */

export function puedeCrearEquipo(user, equiposCreados) {
  if (esPremium(user)) return { ok: true };
  if (equiposCreados < LIMITES_BASICO.equipos) return { ok: true };
  return {
    ok: false,
    motivo: `El plan Básico permite hasta ${LIMITES_BASICO.equipos} equipos. Pasate a Premium para crear más.`,
  };
}

export function puedeCrearComunidad(user, comunidadesCreadas) {
  if (esPremium(user)) return { ok: true };
  if (comunidadesCreadas < LIMITES_BASICO.comunidades) return { ok: true };
  return {
    ok: false,
    motivo: `El plan Básico permite hasta ${LIMITES_BASICO.comunidades} comunidad. Pasate a Premium para crear más.`,
  };
}

export function puedeCrearTorneo(user) {
  if (esPremium(user)) return { ok: true };
  return { ok: false, motivo: 'Crear torneos requiere plan Premium.' };
}

/* ---------- Stats / personalización ---------- */

export function puedeUsarStatsPerfil(user) {
  if (esPremium(user)) return { ok: true };
  return { ok: false, motivo: 'Las estadísticas de perfil requieren plan Premium.' };
}

export function puedeUsarStatsEquipo(user) {
  if (esPremium(user)) return { ok: true };
  return { ok: false, motivo: 'Las estadísticas de equipo requieren plan Premium.' };
}

export function puedePersonalizarCard(user) {
  if (esPremium(user)) return { ok: true };
  return { ok: false, motivo: 'Personalizar cards requiere plan Premium.' };
}

export function puedeCambiarMarco(user) {
  if (esPremium(user)) return { ok: true };
  return { ok: false, motivo: 'Cambiar el marco de perfil requiere plan Premium.' };
}

/* ---------- Publicaciones con foto ---------- */

/**
 * Perfil: 3 fotos por ciclo de 30 días rodantes.
 * @param {object} user
 * @param {number} fotosUsadasEnCiclo - fotos ya publicadas en el ciclo actual
 * @param {number} fotosNuevas - fotos que se intentan publicar ahora
 */
export function puedePublicarPerfil(user, fotosUsadasEnCiclo, fotosNuevas) {
  if (esPremium(user)) return { ok: true };
  const total = fotosUsadasEnCiclo + fotosNuevas;
  if (total <= LIMITES_BASICO.fotosPerfilPorCiclo) return { ok: true };
  const disponibles = Math.max(0, LIMITES_BASICO.fotosPerfilPorCiclo - fotosUsadasEnCiclo);
  return {
    ok: false,
    motivo: `El plan Básico permite ${LIMITES_BASICO.fotosPerfilPorCiclo} fotos en el perfil cada 30 días. Te quedan ${disponibles}.`,
    disponibles,
  };
}

/**
 * Grupo: 4 fotos concurrentes en TODO el grupo (regla del dueño).
 * @param {boolean} duenoEsPremium
 * @param {number} fotosActualesGrupo - fotos publicadas ahora en el grupo
 * @param {number} fotosNuevas - fotos que se intentan publicar ahora
 */
export function puedePublicarGrupo(duenoEsPremium, fotosActualesGrupo, fotosNuevas) {
  if (duenoEsPremium) return { ok: true };
  const total = fotosActualesGrupo + fotosNuevas;
  if (total <= LIMITES_BASICO.fotosGrupoConcurrentes) return { ok: true };
  const disponibles = Math.max(0, LIMITES_BASICO.fotosGrupoConcurrentes - fotosActualesGrupo);
  return {
    ok: false,
    motivo: `El grupo permite ${LIMITES_BASICO.fotosGrupoConcurrentes} fotos concurrentes (plan del dueño). Hay ${fotosActualesGrupo} publicadas, quedan ${disponibles}.`,
    disponibles,
  };
}