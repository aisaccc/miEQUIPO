# API de ROSTER

La URL base termina en /api. Las rutas que ya incluyen /api se interpretan desde el origen. Los estados se describen desde el código.

## Contratos documentados en el informe

| ID y operación | Parámetros / acceso | Cuerpo de solicitud |
| --- | --- | --- |
| S01 · GET /api/health | Pública, sin parámetros de ruta ni consulta. | Sin cuerpo. |
| S02 · PATCH /api/usuarios/me/deportes | Sesión Bearer. Sin parámetros de ruta. La edición de estadísticas requiere Premium. | Ejemplo ficticio: {"deportes":[{"deporte":"Ciclismo","posiciones":[],"stats":{"kilometros":{"valor":7.5,"publico":true}}}]} |

| ID | Éxito y ejemplo | Errores y condición |
| --- | --- | --- |
| S01 | 200 previsto. JSON con status: "ok", message: "MiEquipo backend funcionando" y timestamp ISO. | 429 posible por límite general. |
| S02 | 200 previsto, objeto con clave usuario y el perfil actualizado. | 401 sin sesión válida; 403 si el plan básico modifica estadísticas; 404 si el servicio no encuentra al usuario. |

| Método y ruta | Entrada | Respuesta definida por el código |
| --- | --- | --- |
| POST /auth/login | JSON: {"identificador":"jugador_demo","password":"ejemplo"} | 200 con usuario y tokens de sesión. 400 para datos inválidos. |
| GET /grupos/:id | UUID en la ruta. Sin cuerpo. | 200 con el objeto grupo. 400 para UUID inválido. |
| GET /partidos/:id | UUID en la ruta. Sin cuerpo. | 200 con el objeto partido. 400 para UUID inválido. |
| GET /torneos/:id | UUID en la ruta. Sin cuerpo. | 200 con el objeto torneo. 400 para UUID inválido. |
| POST /mensajes/conversaciones | JSON: {"usuarioId":"34237125-bba0-4256-875b-210435622468"} | 201 con mensaje y conversación. 400 por formato inválido; 403 si se aplica la restricción de contactos. |
| GET /notificaciones/no-leidas | Sin parámetros ni cuerpo. | 200 con el total. Ejemplo: {"total":3}. |
| GET /publicaciones/feed | Sin parámetros ni cuerpo. | 200 con publicaciones. Ejemplo sin elementos: {"publicaciones":[]}. |
| GET /amistades | Sin parámetros ni cuerpo. | 200 con amigos. Ejemplo sin elementos: {"amigos":[]}. |

## Inventario de operaciones

Cada línea se refiere a Backend/src/routes/<módulo>.routes.js.

### amistades

| Verbo | Ruta completa | Línea |
| --- | --- | --- |
| GET | /api/amistades | 9 |
| GET | /api/amistades/solicitudes | 10 |
| GET | /api/amistades/bloqueados | 11 |
| GET | /api/amistades/estado/:otroId | 14 |
| POST | /api/amistades/responder/:solicitanteId | 15 |
| POST | /api/amistades/bloquear/:usuarioId | 16 |
| DELETE | /api/amistades/desbloquear/:usuarioId | 17 |
| POST | /api/amistades/:amigoId | 20 |
| DELETE | /api/amistades/:amigoId | 21 |
| GET | /api/amistades/link | 22 |
| POST | /api/amistades/link/:token | 23 |

### auth

| Verbo | Ruta completa | Línea |
| --- | --- | --- |
| POST | /api/auth/registro | 18 |
| POST | /api/auth/login | 19 |
| POST | /api/auth/refresh | 23 |
| POST | /api/auth/logout | 25 |
| POST | /api/auth/verificar-email | 26 |
| GET | /api/auth/me | 32 |
| POST | /api/auth/logout-all | 33 |

### grupos

| Verbo | Ruta completa | Línea |
| --- | --- | --- |
| GET | /api/grupos | 18 |
| GET | /api/grupos/:id | 19 |
| POST | /api/grupos | 24 |
| PATCH | /api/grupos/:id | 25 |
| DELETE | /api/grupos/:id | 26 |
| PATCH | /api/grupos/:id/stats | 31 |
| POST | /api/grupos/:id/unirse | 36 |
| DELETE | /api/grupos/:id/salir | 37 |
| DELETE | /api/grupos/:id/mi-solicitud | 38 |
| GET | /api/grupos/:id/miembros | 43 |
| DELETE | /api/grupos/:id/miembros/:usuarioId | 44 |
| PATCH | /api/grupos/:id/miembros/:usuarioId/rol | 45 |
| GET | /api/grupos/:id/solicitudes | 50 |
| PATCH | /api/grupos/:id/solicitudes/:usuarioId | 51 |
| GET | /api/grupos/:grupoId/publicaciones | 56 |
| POST | /api/grupos/:grupoId/publicaciones | 57 |
| GET | /api/grupos/:id/miembros | 61 |
| DELETE | /api/grupos/:id/miembros/:usuarioId | 62 |
| PATCH | /api/grupos/:id/miembros/:usuarioId/rol | 63 |
| PATCH | /api/grupos/:id/miembros/:usuarioId/stats | 66 |
| PATCH | /api/grupos/:id/formacion | 69 |
| PATCH | /api/grupos/:id/formacion/ajustes | 70 |
| GET | /api/grupos/:id/link | 72 |

### grupos

| Verbo | Ruta completa | Línea |
| --- | --- | --- |
| POST | /api/grupos/link/:token | 73 |
| POST | /api/grupos/:id/invitar/:amigoId | 74 |

### mensajes

| Verbo | Ruta completa | Línea |
| --- | --- | --- |
| GET | /api/mensajes/no-leidos | 19 |
| GET | /api/mensajes/conversaciones | 24 |
| POST | /api/mensajes/conversaciones | 25 |
| GET | /api/mensajes/conversaciones/:id | 26 |
| DELETE | /api/mensajes/conversaciones/:id | 27 |
| GET | /api/mensajes/conversaciones/:id/mensajes | 29 |
| POST | /api/mensajes/conversaciones/:id/mensajes | 30 |
| PATCH | /api/mensajes/conversaciones/:id/leidos | 31 |
| GET | /api/mensajes/canales | 36 |
| GET | /api/mensajes/canales/:id | 37 |
| GET | /api/mensajes/canales/:id/mensajes | 38 |
| POST | /api/mensajes/canales/:id/mensajes | 39 |
| PATCH | /api/mensajes/canales/:id/leidos | 40 |
| DELETE | /api/mensajes/canales/:id/para-mi | 44 |
| POST | /api/mensajes/canales/:id/vaciar-para-mi | 45 |
| DELETE | /api/mensajes/mensajes/:id/para-mi | 49 |
| DELETE | /api/mensajes/mensajes/:id/para-todos | 50 |
| POST | /api/mensajes/conversaciones/:id/vaciar-para-mi | 55 |

### notificaciones

| Verbo | Ruta completa | Línea |
| --- | --- | --- |
| GET | /api/notificaciones/no-leidas | 20 |
| GET | /api/notificaciones | 25 |
| PATCH | /api/notificaciones/leidas | 33 |
| PATCH | /api/notificaciones/:id/leida | 34 |
| DELETE | /api/notificaciones/leidas | 39 |
| DELETE | /api/notificaciones/:id | 40 |

### partidos

| Verbo | Ruta completa | Línea |
| --- | --- | --- |
| GET | /api/partidos | 17 |
| GET | /api/partidos/:id | 18 |
| POST | /api/partidos | 23 |
| PATCH | /api/partidos/:id | 24 |
| DELETE | /api/partidos/:id | 25 |
| POST | /api/partidos/:id/inscribirse | 30 |
| DELETE | /api/partidos/:id/inscribirse | 31 |
| POST | /api/partidos/:id/postularse | 36 |
| DELETE | /api/partidos/:id/postularse | 37 |
| PATCH | /api/partidos/:id/postulantes/:usuarioId | 42 |
| POST | /api/partidos/:id/interesarse | 47 |
| DELETE | /api/partidos/:id/interesarse | 48 |
| GET | /api/partidos/:id/interesados | 49 |
| PATCH | /api/partidos/:id/confirmar | 50 |
| POST | /api/partidos/:id/confirmaciones/:propuestaId/aprobar | 55 |
| POST | /api/partidos/:id/confirmaciones/:propuestaId/rechazar | 59 |
| DELETE | /api/partidos/:id/confirmaciones/:propuestaId | 63 |
| GET | /api/partidos/:id/confirmacion-pendiente | 67 |
| DELETE | /api/partidos/:id/inscritos/:usuarioId | 79 |
| DELETE | /api/partidos/:id/interesados/:usuarioId | 80 |
| DELETE | /api/partidos/:id/equipos-inscritos/:equipoId | 81 |
| POST | /api/partidos/:id/equipos-postulantes | 86 |
| DELETE | /api/partidos/:id/equipos-postulantes/:equipoId | 87 |

### partidos

| Verbo | Ruta completa | Línea |
| --- | --- | --- |
| PATCH | /api/partidos/:id/equipos-postulantes/:equipoId | 88 |

### publicaciones

| Verbo | Ruta completa | Línea |
| --- | --- | --- |
| GET | /api/publicaciones/feed | 17 |
| GET | /api/publicaciones/usuario/:usuarioId | 22 |
| POST | /api/publicaciones | 27 |
| PATCH | /api/publicaciones/:id | 28 |
| PATCH | /api/publicaciones/:id/privacidad | 29 |
| DELETE | /api/publicaciones/:id | 30 |
| POST | /api/publicaciones/:id/like | 35 |
| GET | /api/publicaciones/:id/comentarios | 40 |
| POST | /api/publicaciones/:id/comentarios | 41 |

### torneos

| Verbo | Ruta completa | Línea |
| --- | --- | --- |
| GET | /api/torneos | 19 |
| GET | /api/torneos/:id | 20 |
| POST | /api/torneos | 25 |
| PATCH | /api/torneos/:id | 26 |
| DELETE | /api/torneos/:id | 27 |
| PATCH | /api/torneos/:id/cerrar | 32 |
| POST | /api/torneos/:id/inscribir | 37 |
| DELETE | /api/torneos/:id/inscribir/:equipoId | 38 |
| PATCH | /api/torneos/:id/solicitudes/:equipoId | 43 |
| DELETE | /api/torneos/:id/equipos/:equipoId | 44 |
| POST | /api/torneos/:id/invitaciones | 49 |
| PATCH | /api/torneos/:id/invitaciones/:equipoId | 50 |
| POST | /api/torneos/:id/organizadores/invitaciones | 58 |
| PATCH | /api/torneos/:id/organizadores/invitaciones/responder | 59 |
| DELETE | /api/torneos/:id/organizadores/invitaciones/:usuarioId | 60 |
| DELETE | /api/torneos/:id/organizadores/:usuarioId | 62 |
| POST | /api/torneos/:id/partidos | 67 |
| PATCH | /api/torneos/:id/partidos/:partidoId | 68 |
| DELETE | /api/torneos/:id/partidos/:partidoId | 69 |
| PATCH | /api/torneos/:id/partidos/:partidoId/resultado | 70 |
| PATCH | /api/torneos/:id/cruces/:partidoId | 75 |
| POST | /api/torneos/:id/fixture/liga | 80 |
| POST | /api/torneos/:id/fixture/aleatorio | 85 |

### torneos

| Verbo | Ruta completa | Línea |
| --- | --- | --- |
| POST | /api/torneos/:id/fixture/manual | 86 |
| POST | /api/torneos/:id/fixture/confirmar | 87 |
| POST | /api/torneos/:id/jornadas | 92 |
| PATCH | /api/torneos/:id/jornadas/:jornadaId | 93 |
| DELETE | /api/torneos/:id/jornadas/:jornadaId | 94 |
| PATCH | /api/torneos/:id/jornadas/:jornadaId/bulk | 102 |
| GET | /api/torneos/:torneoId/publicaciones | 106 |
| POST | /api/torneos/:torneoId/publicaciones | 107 |

### usuarios

| Verbo | Ruta completa | Línea |
| --- | --- | --- |
| GET | /api/usuarios/me | 27 |
| GET | /api/usuarios/me/plan | 28 |
| PATCH | /api/usuarios/me | 29 |
| PATCH | /api/usuarios/me/deportes | 30 |
| PATCH | /api/usuarios/me/password | 31 |
| DELETE | /api/usuarios/me | 32 |
| GET | /api/usuarios/me/historial-partidos | 34 |
| GET | /api/usuarios/buscar | 40 |
| GET | /api/usuarios/:id | 47 |