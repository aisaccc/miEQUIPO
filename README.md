# MiEquipo

Promesa:* La plataforma web/movil que centraliza la conexión entre deportistas para organizar partidos y una comunidad deportiva.

## Integrantes
* Isaac Michea (@aisaccc)
* Benjamín Reyes (@Benjaminreyes51)

## Enlaces
* [Documento](docs\Hito 1 proyecto MiEquipo.pdf)
* [Presentacion](docs\Presentación MiEquipo (1).pdf)
```
MiEquipo
├─ backend
│  ├─ .env
│  ├─ .env.example
│  ├─ migrations
│  │  ├─ 001_extensiones.sql
│  │  ├─ 002_usuarios.sql
│  │  ├─ 003_grupos.sql
│  │  ├─ 004_partidos.sql
│  │  ├─ 005_torneos.sql
│  │  ├─ 006_mensajes.sql
│  │  ├─ 007_notificaciones.sql
│  │  ├─ 008_publicaciones.sql
│  │  ├─ 009_torneos_v2.sql
│  │  ├─ 010_partidos_organizar.sql
│  │  ├─ 011_partido_confirmaciones.sql
│  │  ├─ 012_torneos_fecha_limite.sql
│  │  ├─ 013_torneos_libre_nivel.sql
│  │  ├─ 014_torneos_tipo_participacion.sql
│  │  ├─ 015_torneos_equipo_id_flex.sql
│  │  ├─ 016_torneos_fixture.sql
│  │  ├─ 017_torneos_auto_fixture.sql
│  │  ├─ 018_torneos_sistema_clasificacion.sql
│  │  ├─ 019_stats_privacidad_por_stat.sql
│  │  ├─ 020_usuarios_hero.sql
│  │  ├─ 021_torneo_organizadores_invitaciones.sql
│  │  ├─ 022_publicaciones_scope.sql
│  │  ├─ 023_mensajes_imagen.sql
│  │  ├─ 024_publicaciones_privacidad.sql
│  │  ├─ 025_mensajes_texto_nullable.sql
│  │  ├─ 026_amistades.sql
│  │  ├─ 027_bloqueos.sql
│  │  ├─ 028_invitaciones_links.sql
│  │  └─ scripts
│  │     └─ limpiar-torneos.sql
│  ├─ package-lock.json
│  ├─ package.json
│  └─ src
│     ├─ app.js
│     ├─ config
│     │  ├─ backfill-canales-grupos.js
│     │  ├─ backfill-canales-torneos.js
│     │  ├─ db.js
│     │  ├─ env.js
│     │  └─ migrate.js
│     ├─ controllers
│     │  ├─ amistades.controller.js
│     │  ├─ auth.controller.js
│     │  ├─ grupos.controller.js
│     │  ├─ mensajes.controller.js
│     │  ├─ notificaciones.controller.js
│     │  ├─ partidos.controller.js
│     │  ├─ publicaciones.controller.js
│     │  ├─ torneos.controller.js
│     │  └─ usuarios.controller.js
│     ├─ jobs
│     │  ├─ expirarPremium.job.js
│     │  └─ limpiarEventos.job.js
│     ├─ middlewares
│     │  ├─ auth.middleware.js
│     │  ├─ errorHandler.js
│     │  ├─ rateLimit.js
│     │  └─ requirePremium.middleware.js
│     ├─ routes
│     │  ├─ amistades.routes.js
│     │  ├─ auth.routes.js
│     │  ├─ grupos.routes.js
│     │  ├─ mensajes.routes.js
│     │  ├─ notificaciones.routes.js
│     │  ├─ partidos.routes.js
│     │  ├─ publicaciones.routes.js
│     │  ├─ torneos.routes.js
│     │  └─ usuarios.routes.js
│     ├─ server.js
│     ├─ services
│     │  ├─ amistades.service.js
│     │  ├─ auth.service.js
│     │  ├─ grupos.service.js
│     │  ├─ mensajes.service.js
│     │  ├─ notificaciones.service.js
│     │  ├─ partidos.service.js
│     │  ├─ publicaciones.service.js
│     │  ├─ torneos.service.js
│     │  └─ usuarios.service.js
│     ├─ utils
│     │  ├─ bloqueos.js
│     │  ├─ colores.js
│     │  ├─ jwt.js
│     │  ├─ mailer.js
│     │  ├─ password.js
│     │  ├─ planes.js
│     │  ├─ sesiones.js
│     │  └─ token.js
│     └─ validators
│        ├─ amistades.schema.js
│        ├─ auth.schema.js
│        ├─ grupos.schema.js
│        ├─ index.js
│        ├─ mensajes.schema.js
│        ├─ notificaciones.schema.js
│        ├─ partidos.schema.js
│        ├─ publicaciones.schema.js
│        ├─ torneos.schema.js
│        └─ usuarios.schema.js
├─ db
├─ docs
│  ├─ Hito 1 proyecto MiEquipo.pdf
│  ├─ MapaDelProducto.drawio.png
│  └─ Presentación MiEquipo (1).pdf
├─ Frontend
│  ├─ app.html
│  ├─ assets
│  │  ├─ backgrounds
│  │  │  ├─ Fondo naranja con texto ROSTER.png
│  │  │  ├─ inicio-bg2.jpg
│  │  │  ├─ roster-equipo.png
│  │  │  ├─ roster-futbol.png
│  │  │  ├─ roster-torneos.png
│  │  │  └─ roster_corredor_800.png
│  │  ├─ deportes-cards
│  │  │  ├─ atletismo.jpg
│  │  │  ├─ atletismo2.jpg
│  │  │  ├─ badminton.jpg
│  │  │  ├─ badminton2.jpg
│  │  │  ├─ balonmano.jpg
│  │  │  ├─ balonmano2.jpg
│  │  │  ├─ basquetball2.jpg
│  │  │  ├─ basquetbol.jpg
│  │  │  ├─ beisbol.jpg
│  │  │  ├─ beisbol2.jpg
│  │  │  ├─ boxeo.jpg
│  │  │  ├─ boxeo2.jpg
│  │  │  ├─ boxeo3.jpg
│  │  │  ├─ ciclismo.jpg
│  │  │  ├─ ciclismo2.jpg
│  │  │  ├─ escalada.jpg
│  │  │  ├─ escalada2.jpg
│  │  │  ├─ escalada3.jpg
│  │  │  ├─ futbol-americano.jpg
│  │  │  ├─ futbol-americano2.jpg
│  │  │  ├─ futbol-americano3.jpg
│  │  │  ├─ futbol.jpg
│  │  │  ├─ futboll.jpg
│  │  │  ├─ futbolo.jpg
│  │  │  ├─ golf.jpg
│  │  │  ├─ golf2.jpg
│  │  │  ├─ handball.jpg
│  │  │  ├─ hockey.jpg
│  │  │  ├─ hockey.png
│  │  │  ├─ hockey2.jpg
│  │  │  ├─ hockey3.jpg
│  │  │  ├─ natacion.jpg
│  │  │  ├─ natacion2.jpg
│  │  │  ├─ padel.jpg
│  │  │  ├─ padel2.jpg
│  │  │  ├─ rugby.jpg
│  │  │  ├─ rugby2.jpg
│  │  │  ├─ squash.jpg
│  │  │  ├─ squash2.jpg
│  │  │  ├─ surf.jpg
│  │  │  ├─ surf2.jpg
│  │  │  ├─ tenis-de-mesa.jpg
│  │  │  ├─ tenis-de-mesa2.jpg
│  │  │  ├─ tenis.jpg
│  │  │  ├─ tenis2.jpg
│  │  │  ├─ voleibol.jpg
│  │  │  ├─ voleibol2.jpg
│  │  │  └─ voleyball.jpg
│  │  ├─ icons
│  │  │  ├─ agregar-publicacion.png
│  │  │  ├─ ajustes.svg
│  │  │  ├─ anadir-amigo.png
│  │  │  ├─ asistencia-de-ayuda.png
│  │  │  ├─ balocensto.svg
│  │  │  ├─ balon-de-futbol (2).png
│  │  │  ├─ balonmano.png
│  │  │  ├─ basura.svg
│  │  │  ├─ beisbol.png
│  │  │  ├─ bicicleta.svg
│  │  │  ├─ bloqueado.png
│  │  │  ├─ cancha-de-baloncesto.png
│  │  │  ├─ corriendo.png
│  │  │  ├─ deporte.svg
│  │  │  ├─ disco.png
│  │  │  ├─ escalada.png
│  │  │  ├─ escudo-de-seguridad.png
│  │  │  ├─ estadio.svg
│  │  │  ├─ futbol.png
│  │  │  ├─ futbol.svg
│  │  │  ├─ futbol2.png
│  │  │  ├─ gente.png
│  │  │  ├─ golf (1).png
│  │  │  ├─ golf.png
│  │  │  ├─ growth_8282638.png
│  │  │  ├─ grupo.png
│  │  │  ├─ guantes-de-boxeo.png
│  │  │  ├─ hogar.svg
│  │  │  ├─ icons8-buscar-96.png
│  │  │  ├─ icons8-candado.gif
│  │  │  ├─ icons8-charla-48 (1).png
│  │  │  ├─ icons8-charla-48.png
│  │  │  ├─ icons8-comunidad-64.png
│  │  │  ├─ imagen.svg
│  │  │  ├─ lapiz.svg
│  │  │  ├─ megafono.svg
│  │  │  ├─ mentoring_16059832.gif
│  │  │  ├─ mundo (1).png
│  │  │  ├─ mundo (10).png
│  │  │  ├─ mundo (11).png
│  │  │  ├─ mundo (12).png
│  │  │  ├─ mundo (2).png
│  │  │  ├─ mundo (3).png
│  │  │  ├─ mundo (4).png
│  │  │  ├─ mundo (5).png
│  │  │  ├─ mundo (6).png
│  │  │  ├─ mundo (7).png
│  │  │  ├─ mundo (8).png
│  │  │  ├─ mundo (9).png
│  │  │  ├─ mundo.png
│  │  │  ├─ natacion.svg
│  │  │  ├─ notificacion.png
│  │  │  ├─ ojo.svg
│  │  │  ├─ pelota-de-tenis.png
│  │  │  ├─ pregunta.png
│  │  │  ├─ prohibido.png
│  │  │  ├─ publicacion.png
│  │  │  ├─ raqueta-de-padel.png
│  │  │  ├─ raqueta-de-tenis-de-mesa.png
│  │  │  ├─ redondo (1).png
│  │  │  ├─ redondo (10).png
│  │  │  ├─ redondo (11).png
│  │  │  ├─ redondo (12).png
│  │  │  ├─ redondo (13).png
│  │  │  ├─ redondo (14).png
│  │  │  ├─ redondo (15).png
│  │  │  ├─ redondo (16).png
│  │  │  ├─ redondo (17).png
│  │  │  ├─ redondo (18).png
│  │  │  ├─ redondo (19).png
│  │  │  ├─ redondo (2).png
│  │  │  ├─ redondo (20).png
│  │  │  ├─ redondo (3).png
│  │  │  ├─ redondo (4).png
│  │  │  ├─ redondo (5).png
│  │  │  ├─ redondo (6).png
│  │  │  ├─ redondo (7).png
│  │  │  ├─ redondo (8).png
│  │  │  ├─ redondo (9).png
│  │  │  ├─ redondo.png
│  │  │  ├─ reloj.png
│  │  │  ├─ rugby.png
│  │  │  ├─ salida.svg
│  │  │  ├─ sobre.svg
│  │  │  ├─ suiza.png
│  │  │  ├─ tabla-de-surf.png
│  │  │  ├─ tenis-de-squash.png
│  │  │  ├─ trabajo-en-equipo (1).svg
│  │  │  ├─ translation_314263.png
│  │  │  ├─ trofeo.png
│  │  │  ├─ trofeo.svg
│  │  │  ├─ usuario.svg
│  │  │  ├─ usuarios-alt.svg
│  │  │  ├─ volante.png
│  │  │  └─ voleibol.svg
│  │  └─ images
│  │     ├─ logo.svg
│  │     ├─ Logotipo_deportivo_Roster-removebg-preview.png
│  │     └─ Logotipo_deportivo_Roster-removebg-preview2.png
│  ├─ CSS
│  │  ├─ components.css
│  │  ├─ layout.css
│  │  ├─ pages.css
│  │  ├─ reset.css
│  │  ├─ styles.css
│  │  └─ variables.css
│  ├─ favicon.svg
│  ├─ fields
│  │  ├─ cancha-basquetball.png
│  │  ├─ cancha-beisbol.png
│  │  ├─ cancha-futbol-americano.png
│  │  ├─ cancha-futbol.png
│  │  ├─ cancha-handball.png
│  │  ├─ cancha-hockey.png
│  │  ├─ cancha-rugby.png
│  │  └─ cancha-voleibol.png
│  ├─ index.html
│  ├─ JS
│  │  ├─ api.js
│  │  ├─ auth-page.js
│  │  ├─ auth.js
│  │  ├─ components.js
│  │  ├─ data-mock.js
│  │  ├─ main.js
│  │  ├─ pages
│  │  │  ├─ inicio.js
│  │  │  ├─ mensajes.js
│  │  │  ├─ mi-equipo.js
│  │  │  ├─ partido-detalle.js
│  │  │  ├─ partidos.js
│  │  │  ├─ perfil.js
│  │  │  ├─ torneo-detalle.js
│  │  │  └─ torneos.js
│  │  ├─ router.js
│  │  ├─ services
│  │  │  ├─ amistades.service.js
│  │  │  ├─ auth.service.js
│  │  │  ├─ grupos.service.js
│  │  │  ├─ mensajes.service.js
│  │  │  ├─ notificaciones.service.js
│  │  │  ├─ partidos.service.js
│  │  │  ├─ publicaciones.service.js
│  │  │  ├─ torneos.service.js
│  │  │  └─ usuarios.service.js
│  │  ├─ stats-por-deporte.js
│  │  ├─ store.js
│  │  └─ utils
│  │     ├─ grupo-publico.js
│  │     ├─ iconos.js
│  │     ├─ id.js
│  │     ├─ mensaje-acciones.js
│  │     ├─ publicaciones-ui.js
│  │     └─ reglas-deporte.js
│  ├─ manifest.json
│  ├─ package.json
│  ├─ pages
│  │  ├─ inicio.html
│  │  ├─ mensajes.html
│  │  ├─ mi-equipo.html
│  │  ├─ partido-detalle.html
│  │  ├─ partidos.html
│  │  ├─ perfil.html
│  │  ├─ torneo-detalle.html
│  │  └─ torneos.html
│  └─ service-worker.js
└─ README.md

```