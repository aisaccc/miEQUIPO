/* =========================================================
   torneos.service.js — Service de torneos del frontend
   =========================================================
   Consume los endpoints del backend. Normaliza las respuestas
   a camelCase para que las páginas trabajen consistentes.
   ========================================================= */

import { api } from '../api.js';

/* =========================================================
   NORMALIZADORES
   ========================================================= */

function normalizarEquipo(e) {
  if (!e) return null;
  return {
    id: e.id,
    nombre: e.nombre,
    escudo: e.escudo,
    deporte: e.deporte,
    ciudad: e.ciudad,
    capitanId: e.capitan_id ?? e.capitanId ?? null,
    totalJugadores: e.total_jugadores ?? e.totalJugadores ?? 0,
    esIndividual: e.es_individual ?? e.esIndividual ?? false,
  };
}

function normalizarSolicitud(s) {
  if (!s) return null;
  return {
    id: s.id,
    estado: s.estado,
    fecha: s.fecha ?? s.created_at ?? null,
    origen: s.origen ?? null,
    equipoId: s.equipo_id ?? s.equipoId ?? null,
    equipoNombre: s.equipo_nombre ?? s.equipoNombre ?? null,
    equipoEscudo: s.equipo_escudo ?? s.equipoEscudo ?? null,
    equipoDeporte: s.equipo_deporte ?? s.equipoDeporte ?? null,
    capitanId: s.capitan_id ?? s.capitanId ?? null,
    esIndividual: s.es_individual ?? s.esIndividual ?? false,
  };
}

function normalizarInvitacion(i) {
  if (!i) return null;
  return {
    id: i.id,
    estado: i.estado,
    fecha: i.created_at ?? i.fecha ?? null,
    equipoId: i.equipo_id ?? i.equipoId ?? null,
    equipoNombre: i.equipo_nombre ?? i.equipoNombre ?? null,
    equipoEscudo: i.equipo_escudo ?? i.equipoEscudo ?? null,
    equipoDeporte: i.equipo_deporte ?? i.equipoDeporte ?? null,
    capitanId: i.capitan_id ?? i.capitanId ?? null,
    esIndividual: i.es_individual ?? i.esIndividual ?? false,
  };
}

function normalizarOrganizador(o) {
  if (!o) return null;
  return {
    usuarioId: o.usuario_id ?? o.usuarioId ?? null,
    permisos: o.permisos,
    creado: o.creado ?? null,
    nombre: o.nombre,
    username: o.username,
    avatar: o.avatar,
  };
}

function normalizarPartido(p) {
  if (!p) return null;
  return {
    id: p.id,
    torneoId: p.torneo_id ?? p.torneoId ?? null,

    ronda: p.ronda,
    orden: p.orden ?? 0,
    fase: p.fase ?? null,
    posicionEnFase: p.posicion_en_fase ?? p.posicionEnFase ?? null,
    esBye: p.es_bye ?? p.esBye ?? false,

    jornadaId: p.jornada_id ?? p.jornadaId ?? null,
    jornadaNombre: p.jornada_nombre ?? p.jornadaNombre ?? null,
    jornadaNumero: p.jornada_numero ?? p.jornadaNumero ?? null,

    equipoLocalId: p.equipo_local_id ?? p.equipoLocalId ?? null,
    equipoVisitanteId: p.equipo_visitante_id ?? p.equipoVisitanteId ?? null,
    localNombre: p.local_nombre ?? p.localNombre ?? null,
    localEscudo: p.local_escudo ?? p.localEscudo ?? null,
    visitanteNombre: p.visitante_nombre ?? p.visitanteNombre ?? null,
    visitanteEscudo: p.visitante_escudo ?? p.visitanteEscudo ?? null,

    resultado: p.resultado ?? null,
    estadisticas: p.estadisticas ?? null,
    estado: p.estado,
    ganador: p.ganador ?? null,

    siguientePartidoId: p.siguiente_partido_id ?? p.siguientePartidoId ?? null,

    fecha: p.fecha ?? null,
    createdAt: p.created_at ?? p.createdAt ?? null,
    updatedAt: p.updated_at ?? p.updatedAt ?? null,
  };
}

function normalizarFilaTabla(f) {
  if (!f) return null;
  return {
    torneoId: f.torneo_id ?? f.torneoId ?? null,
    equipoId: f.equipo_id ?? f.equipoId ?? null,
    equipoNombre: f.equipo_nombre ?? f.equipoNombre ?? null,
    equipoEscudo: f.equipo_escudo ?? f.equipoEscudo ?? null,
    partidosJugados: f.partidos_jugados ?? f.partidosJugados ?? 0,
    partidosGanados: f.partidos_ganados ?? f.partidosGanados ?? 0,
    partidosEmpatados: f.partidos_empatados ?? f.partidosEmpatados ?? 0,
    partidosPerdidos: f.partidos_perdidos ?? f.partidosPerdidos ?? 0,
    puntosFavor: f.puntos_favor ?? f.puntosFavor ?? 0,
    puntosContra: f.puntos_contra ?? f.puntosContra ?? 0,
    diferencia: f.diferencia ?? 0,
    puntosTotales: f.puntos_totales ?? f.puntosTotales ?? 0,
    actualizado: f.actualizado ?? null,
  };
}

function normalizarJornada(j) {
  if (!j) return null;
  return {
    id: j.id,
    torneoId: j.torneo_id ?? j.torneoId ?? null,
    numero: j.numero,
    nombre: j.nombre,
    fecha: j.fecha ?? null,
    createdAt: j.created_at ?? j.createdAt ?? null,
  };
}

function normalizarTorneo(t) {
  if (!t) return null;

  const organizador = t.organizador
    ? {
        id: t.organizador.id,
        nombre: t.organizador.nombre,
        username: t.organizador.username,
        avatar: t.organizador.avatar,
      }
    : null;

  return {
    // Campos base
    id: t.id,
    nombre: t.nombre,
    deporte: t.deporte,
    emoji: t.emoji,
    descripcion: t.descripcion,
    lugar: t.lugar,
    fechaInicio: t.fechaInicio ?? t.fecha_inicio ?? null,
    fechaFin: t.fechaFin ?? t.fecha_fin ?? null,
    fechaLimiteInscripcion: t.fechaLimiteInscripcion ?? t.fecha_limite_inscripcion ?? null,
    cuposEquipos: t.cuposEquipos ?? t.cupos_equipos ?? 0,
    precio: t.precio ?? 0,
    estado: t.estado,
    modalidad: t.modalidad,
    nivel: t.nivel,
    libreInscripcion: t.libreInscripcion ?? t.libre_inscripcion ?? true,
    tipoParticipacion: t.tipoParticipacion ?? t.tipo_participacion ?? 'equipo',

    // ⚡ NUEVO: sistema de clasificación
    sistemaClasificacion: t.sistemaClasificacion ?? t.sistema_clasificacion ?? 'simple',

    // Flags fixture
    idaYVuelta: t.idaYVuelta ?? t.ida_y_vuelta ?? false,
    fixtureBloqueado: t.fixtureBloqueado ?? t.fixture_bloqueado ?? false,
    autoFixture: t.autoFixture ?? t.auto_fixture ?? false,

    // ⚡ PERSONALIZACIÓN VISUAL (Card, Hero y Marcos)
    cardColor: t.cardColor ?? t.card_color ?? null,
    cardFoto: t.cardFoto ?? t.card_foto ?? null,
    iconoPersonalizado: t.iconoPersonalizado ?? t.icono_personalizado ?? null,
    heroColor: t.heroColor ?? t.hero_color ?? null,
    heroFoto: t.heroFoto ?? t.hero_foto ?? null,
    marcoIcono: t.marcoIcono ?? t.marco_icono ?? 'default',
    marcoColorIcono: t.marcoColorIcono ?? t.marco_color_icono ?? null,

    puntosVictoria: t.puntosVictoria ?? t.puntos_victoria ?? 3,
    idaYVuelta: t.idaYVuelta ?? t.ida_y_vuelta ?? false,
    fixtureBloqueado: t.fixtureBloqueado ?? t.fixture_bloqueado ?? false,
    autoFixture: t.autoFixture ?? t.auto_fixture ?? false,

    puntosVictoria: t.puntosVictoria ?? t.puntos_victoria ?? 3,
    puntosEmpate: t.puntosEmpate ?? t.puntos_empate ?? 1,
    puntosDerrota: t.puntosDerrota ?? t.puntos_derrota ?? 0,
    permiteEmpate: t.permiteEmpate ?? t.permite_empate ?? true,
    incluyeEstadisticas: t.incluyeEstadisticas ?? t.incluye_estadisticas ?? false,
    equiposClasifican: t.equiposClasifican ?? t.equipos_clasifican ?? null,
    canalChatId: t.canalChatId ?? t.canal_chat_id ?? null,
    createdAt: t.createdAt ?? t.created_at ?? null,
    updatedAt: t.updatedAt ?? t.updated_at ?? null,

    organizador,

    // Contadores
    totalEquipos: t.totalEquipos ?? t.total_equipos ?? 0,
    totalListaEspera: t.totalListaEspera ?? t.total_lista_espera ?? 0,
    totalPartidos: t.totalPartidos ?? t.total_partidos ?? 0,

    // Flags del usuario
    soyOrganizador: t.soyOrganizador ?? t.soy_organizador ?? false,
    soySubOrganizador: t.soySubOrganizador ?? t.soy_sub_organizador ?? false,
    puedeGestionarFixture: t.puedeGestionarFixture ?? false,
    miEquipoInscrito: t.miEquipoInscrito ?? t.mi_equipo_inscrito ?? false,
    miSolicitudPendiente: t.miSolicitudPendiente ?? t.mi_solicitud_pendiente ?? false,
    miInvitacionPendiente: t.miInvitacionPendiente ?? t.mi_invitacion_pendiente ?? false,

    // Listas anidadas
    equipos: (t.equipos || []).map(normalizarEquipo),
    listaEspera: (t.listaEspera || t.lista_espera || []).map(normalizarSolicitud),
    invitaciones: (t.invitaciones || []).map(normalizarInvitacion),
    organizadores: (t.organizadores || []).map(normalizarOrganizador),
    invitacionesOrganizador: (t.invitacionesOrganizador || t.invitaciones_organizador || []).map(normalizarOrganizador),   // ⚡ D.3
    partidos: (t.partidos || []).map(normalizarPartido),
    jornadas: (t.jornadas || []).map(normalizarJornada),
    tablaPosiciones: (t.tablaPosiciones || t.tabla_posiciones || []).map(normalizarFilaTabla),

    // Detalles puntuales
    miEquipoInscritoDetalle: t.miEquipoInscritoDetalle
      ? normalizarEquipo(t.miEquipoInscritoDetalle)
      : null,
    miSolicitudPendienteDetalle: t.miSolicitudPendienteDetalle
      ? normalizarSolicitud(t.miSolicitudPendienteDetalle)
      : null,
    miInvitacionPendienteDetalle: t.miInvitacionPendienteDetalle
      ? normalizarInvitacion(t.miInvitacionPendienteDetalle)
      : null,
    miInvitacionOrganizador: t.miInvitacionOrganizador ?? t.mi_invitacion_organizador ?? null,   // ⚡ D.3

    // Helpers calculados
    esIndividual: (t.tipoParticipacion ?? t.tipo_participacion) === 'individual',
  };
}

/* =========================================================
   LISTAR
   ========================================================= */
export async function listarTorneos(filtros = {}) {
  const params = new URLSearchParams();

  Object.entries(filtros).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      params.append(key, val);
    }
  });

  const qs = params.toString();
  const endpoint = qs ? `/torneos?${qs}` : '/torneos';

  const respuesta = await api.get(endpoint);

  return {
    data: (respuesta.data || []).map(normalizarTorneo),
    meta: respuesta.meta || { page: 1, limit: 20, total: 0, totalPages: 0 },
  };
}

/* =========================================================
   OBTENER UNO
   ========================================================= */
export async function obtenerTorneo(id) {
  const { torneo } = await api.get(`/torneos/${id}`);
  return normalizarTorneo(torneo);
}

/* =========================================================
   CREAR
   ========================================================= */
export async function crearTorneo(datos) {
  const { torneo } = await api.post('/torneos', datos);
  return normalizarTorneo(torneo);
}

/* =========================================================
   EDITAR
   ========================================================= */
export async function editarTorneo(id, cambios) {
  const { torneo } = await api.patch(`/torneos/${id}`, cambios);
  return normalizarTorneo(torneo);
}

/* =========================================================
   ELIMINAR
   ========================================================= */
export async function eliminarTorneo(id) {
  return api.delete(`/torneos/${id}`);
}

/* =========================================================
   CERRAR TORNEO
   ========================================================= */
export async function cerrarTorneo(torneoId) {
  const respuesta = await api.patch(`/torneos/${torneoId}/cerrar`, {});

  return {
    torneo: normalizarTorneo(respuesta.torneo),
    autoFixturado: respuesta.autoFixturado ?? false,
    infoFixture: respuesta.infoFixture ?? null,
    mensaje: respuesta.mensaje || 'Inscripciones cerradas',
  };
}

/* =========================================================
   INSCRIBIR
   ========================================================= */
export async function inscribirEquipo(torneoId, equipoId = null) {
  const { torneo } = await api.post(`/torneos/${torneoId}/inscribir`, { equipoId });
  return normalizarTorneo(torneo);
}

/* =========================================================
   CANCELAR INSCRIPCIÓN / SOLICITUD
   ========================================================= */
export async function cancelarInscripcion(torneoId, equipoId = null) {
  const path = equipoId
    ? `/torneos/${torneoId}/inscribir/${equipoId}`
    : `/torneos/${torneoId}/inscribir/me`;
  return api.delete(path);
}

/* =========================================================
   APROBAR / RECHAZAR SOLICITUD
   ========================================================= */
export async function gestionarSolicitud(torneoId, equipoId, accion) {
  return api.patch(`/torneos/${torneoId}/solicitudes/${equipoId}`, { accion });
}

/* =========================================================
   EXPULSAR
   ========================================================= */
export async function expulsarEquipo(torneoId, equipoId) {
  return api.delete(`/torneos/${torneoId}/equipos/${equipoId}`);
}

/* =========================================================
   INVITAR EQUIPO
   ========================================================= */
export async function invitarEquipo(torneoId, equipoId) {
  return api.post(`/torneos/${torneoId}/invitaciones`, { equipoId });
}

/* =========================================================
   RESPONDER INVITACIÓN
   ========================================================= */
export async function responderInvitacion(torneoId, equipoId, aceptar) {
  return api.patch(`/torneos/${torneoId}/invitaciones/${equipoId}`, { aceptar });
}

/* =========================================================
   SUB-ORGANIZADORES (D.3)
   ========================================================= */

/* El organizador invita a alguien a ser sub-organizador */
export async function invitarOrganizador(torneoId, usuarioId, permisos = 'completo') {
  return api.post(`/torneos/${torneoId}/organizadores/invitaciones`, {
    usuarioId,
    permisos,
  });
}

/* El invitado acepta o rechaza */
export async function responderInvitacionOrganizador(torneoId, aceptar) {
  return api.patch(
    `/torneos/${torneoId}/organizadores/invitaciones/responder`,
    { aceptar }
  );
}

/* El organizador cancela una invitación pendiente */
export async function cancelarInvitacionOrganizador(torneoId, invitadoId) {
  return api.delete(
    `/torneos/${torneoId}/organizadores/invitaciones/${invitadoId}`
  );
}

/* El organizador quita a un sub-organizador ya aceptado */
export async function quitarOrganizador(torneoId, usuarioId) {
  return api.delete(`/torneos/${torneoId}/organizadores/${usuarioId}`);
}

/* =========================================================
   FIXTURE — CRUD de partidos
   ========================================================= */
export async function crearPartidoTorneo(torneoId, datos) {
  const { partido } = await api.post(`/torneos/${torneoId}/partidos`, datos);
  return normalizarPartido(partido);
}

export async function editarPartidoTorneo(torneoId, partidoId, cambios) {
  const { partido } = await api.patch(`/torneos/${torneoId}/partidos/${partidoId}`, cambios);
  return normalizarPartido(partido);
}

export async function eliminarPartidoTorneo(torneoId, partidoId) {
  return api.delete(`/torneos/${torneoId}/partidos/${partidoId}`);
}

export async function cargarResultado(torneoId, partidoId, datos) {
  return api.patch(`/torneos/${torneoId}/partidos/${partidoId}/resultado`, datos);
}

/* =========================================================
   EDITAR CRUCE INDIVIDUAL (eliminación)
   ========================================================= */
export async function editarCruce(torneoId, partidoId, cambios) {
  const { partido } = await api.patch(`/torneos/${torneoId}/cruces/${partidoId}`, cambios);
  return normalizarPartido(partido);
}

/* =========================================================
   FIXTURE AUTOMÁTICO — LIGA
   ========================================================= */
export async function generarFixtureLiga(torneoId) {
  return api.post(`/torneos/${torneoId}/fixture/liga`, {});
}

/* =========================================================
   FIXTURE — ELIMINACIÓN
   ========================================================= */
export async function armarFixtureAleatorio(torneoId) {
  return api.post(`/torneos/${torneoId}/fixture/aleatorio`, {});
}

export async function armarFixtureManual(torneoId, cruces) {
  return api.post(`/torneos/${torneoId}/fixture/manual`, { cruces });
}

export async function confirmarFixture(torneoId) {
  return api.post(`/torneos/${torneoId}/fixture/confirmar`, {});
}

/* =========================================================
   JORNADAS (liga)
   ========================================================= */
export async function crearJornada(torneoId, datos) {
  const { jornada } = await api.post(`/torneos/${torneoId}/jornadas`, datos);
  return normalizarJornada(jornada);
}

export async function editarJornada(torneoId, jornadaId, cambios) {
  const { jornada } = await api.patch(`/torneos/${torneoId}/jornadas/${jornadaId}`, cambios);
  return normalizarJornada(jornada);
}

export async function eliminarJornada(torneoId, jornadaId) {
  return api.delete(`/torneos/${torneoId}/jornadas/${jornadaId}`);
}

export async function guardarJornadaBulk(torneoId, jornadaId, datos) {
  return api.patch(`/torneos/${torneoId}/jornadas/${jornadaId}/bulk`, datos);
}