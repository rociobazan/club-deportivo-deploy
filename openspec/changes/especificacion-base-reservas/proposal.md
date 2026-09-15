## Why

El equipo tiene el relevamiento funcional en `docs/requisitos.md` (RF-00 a RF-10, RN-01 a RN-14) y el contrato de la API en `contratos/openapi.yaml`, pero `openspec/specs/` está vacío: hoy no existe ninguna especificación vigente contra la cual validar, revisar o archivar trabajo. Sin esa base, las cuatro ramas de features que arrancan en paralelo no tienen un origen común y cada integrante interpreta las reglas de negocio por su cuenta.

Hay además una divergencia activa entre los dos documentos de entrada. El contrato ya fue corregido a **precio plano** (`Cancha.precioPorTurno`, con la nota explícita "No varía según la cantidad de jugadores"), no define ningún schema `Tarifa`, expone `cantidadJugadores` como campo opcional e informativo, y no publica `jugadoresPermitidos` en `Disciplina`. `docs/requisitos.md` todavía describe el modelo anterior de tarifa por cantidad de jugadores. Mientras las dos versiones convivan, cualquier spec que se escriba hereda la contradicción.

Y el repositorio es un andamio: `apps/api` es un Nest recién generado sin módulos, `apps/web` un Next 16 sin páginas, y no existen `prisma/schema.prisma` ni seed, aunque el `package.json` raíz ya los invoca en sus scripts. Nadie puede escribir un test de reserva mientras no haya base de datos ni el índice único parcial que sostiene RN-01.

Por último, el diseño visual ya está hecho: el prototipo `docs/claude-design/Deploy Club.dc.html` define el nombre del club (**Deploy**), las pantallas, el contenido institucional y los datos de ejemplo. Varias cosas de ese prototipo difieren de `requisitos.md` y de `identidad.md`, y conviene fijar ahora cuáles valen. Además suma funciones que ni el relevamiento ni el contrato tenían: un panel de administración, el alta, la edición y la baja de canchas y equipamiento, y el reenvío del mail de una reserva. El equipo decidió que **todo eso entra al MVP**.

Este es el PR base que aprueban los cuatro antes de abrir cualquier rama de feature. La consigna del TP (`docs/Consigna TP — Sistema de Reservas con OpenSpec y CI-CD.md`) pide specs completas y válidas con esquemas y endpoints de disponibilidad, creación, consulta y cancelación de reservas; este cambio es el que las deja en el repositorio.

## What Changes

- Se convierte el relevamiento funcional, más las funciones de administración del prototipo, en especificaciones de OpenSpec agrupadas en siete capacidades. Cada requisito funcional pasa a `### Requirement:` y cada criterio `DADO/CUANDO/ENTONCES` a un `#### Scenario:` con `WHEN`/`THEN`.
- Se registran las reglas de negocio vigentes como escenarios verificables dentro de la capacidad que las hace cumplir, no como una lista suelta de prosa.
- **BREAKING (respecto del relevamiento previo, no de código en producción): se adopta precio plano por turno.** Desaparece la tabla `tarifa`; el precio pasa a `cancha.precio_por_turno`. Se eliminan **RN-11** y **RN-12**, y la numeración del resto **no se recorre**: las reglas siguen siendo RN-01 a RN-10, RN-13 y RN-14, con el hueco a la vista para que las referencias cruzadas existentes sigan siendo válidas. `cantidadJugadores` queda como dato opcional e informativo que no interviene en el cálculo del monto.
- Se alinea `docs/requisitos.md` con el contrato, que es la fuente de verdad ya corregida, y se le suman **RF-11** (panel del club), **RF-12** (administración de canchas), **RF-13** (administración de equipamiento) y **RF-14** (reenvío del mail), con dos reglas nuevas: **RN-15** (dar de baja una cancha o un equipamiento no altera las reservas existentes) y **RN-16** (máximo 3 reenvíos de mail por reserva por hora).
- Como el enfoque es API-first, **se amplía `contratos/openapi.yaml`** (versión 2.2.0) antes de implementar: `GET /admin/panel`, `POST /canchas`, `PATCH /canchas/{id}`, `POST /equipamiento`, `PATCH /equipamiento/{id}`, `POST /reservas/{id}/reenvio-mail`, los parámetros `incluirInactivas` e `incluirInactivos`, y los campos `Reserva.cliente` y `Equipamiento.activo`.
- Se levanta la fundación de datos compartida sobre **PostgreSQL 17 instalado en cada máquina, sin Docker**: un rol y una base locales, `apps/api/prisma/schema.prisma`, la migración manual del índice único parcial de RN-01, los dos índices de apoyo y el seed con las disciplinas, canchas, precios y equipamiento del prototipo, más usuarios de prueba.
- Se adopta el prototipo de Claude Design como referencia visual y de contenido del front. Las specs de `institucional` y `notificaciones` se alinean con él (secciones del sitio, asuntos de los mails) y `docs/identidad.md` queda como antecedente, con una nota que remite al prototipo.
- El prefijo del código de reserva sale a la configuración como `PREFIJO_CODIGO_RESERVA` (default `RES`, que es el que ejemplifica el contrato). Así el código legible no queda atado al branding y el prefijo puede cambiarse sin tocar specs, seed ni tests.
- Se deja `npm run spec:validate` (`openspec validate --all --strict`) y `npm run contrato:lint` pasando en verde, que es lo que después consume el CI que exige la consigna.

**No** entra en este cambio la implementación de endpoints ni pantallas: RF-00 a RF-14 se implementan en los cambios de FASE 5, cada uno con su rama y su revisor. Este cambio les deja la spec, el contrato ampliado y la base de datos sobre la que trabajar.

### Punto abierto

Al eliminar RN-11 desaparece la única regla que validaba `cantidadJugadores` contra la disciplina, y el contrato tampoco expone `jugadoresPermitidos`. La columna `disciplina.jugadores_permitidos` queda entonces sin lector ni escritor. Se resuelve al corregir `docs/requisitos.md`, antes de escribir las specs.

**Resuelto** (ver `design.md`, decisión 1): se elimina la columna. `cantidadJugadores` solo se valida como entero mayor o igual a 1, igual que en el contrato.

## Capabilities

### New Capabilities

- `autenticacion`: registro, login con JWT, perfil, hasheo con bcrypt y el guard de roles que sostiene RN-13. Cubre RF-00.
- `catalogo`: consulta pública de disciplinas, canchas con su precio por turno y equipamiento con stock calculado por turno, más el alta, la edición y la baja de canchas y equipamiento por el administrador. Cubre RF-01, RF-02, RF-07, RF-12, RF-13 y RN-15.
- `disponibilidad`: cálculo de turnos libres a partir del horario de atención y las reservas activas, sin almacenarlos. Cubre RF-03 y RN-09.
- `reservas`: creación con todas sus validaciones de negocio, consulta filtrada por rol y cancelación con plazo. Cubre RF-04, RF-05, RF-06 y el grueso de las reglas vigentes (RN-01 a RN-08, RN-10 y RN-13).
- `notificaciones`: mails de confirmación y cancelación vía Resend, fuera de la transacción y sin poder revertirla, y reenvío a pedido del titular o del administrador. Cubre RF-08, RF-14, RN-14 y RN-16.
- `institucional`: sitio público del club (inicio, El club y Contacto) que renderiza sin la API, y formulario de contacto con rate limiting. Cubre RF-09 y RF-10.
- `administracion`: panel del club con reservas, facturación prevista, cancelaciones, ocupación y próximos turnos de un día. Cubre RF-11.

### Modified Capabilities

Ninguna. `openspec/specs/` está vacío: las siete capacidades son nuevas.

## Impact

**Specs y documentación**
- `openspec/changes/especificacion-base-reservas/specs/{autenticacion,catalogo,disponibilidad,reservas,notificaciones,institucional,administracion}/spec.md` — nuevos.
- `contratos/openapi.yaml` — ampliado a la versión 2.2.0 con los endpoints, parámetros y campos de administración y reenvío (ver `design.md`, decisión 16).
- `docs/requisitos.md` — corregido a precio plano (se elimina la tabla `tarifa`, `precio_por_turno` vuelve a `cancha`, se dan de baja RN-11 y RN-12 sin renumerar y se ajustan RF-01, RF-02 y RF-04) y ampliado con RF-11 a RF-14, RN-15 y RN-16.
- `docs/memoria-proyecto.md` — nuevo: memoria compartida del proyecto para cualquier agente de IA y cualquier integrante, referenciada desde `AGENTS.md` y desde el `context` de `openspec/config.yaml`, que OpenSpec inyecta al redactar artefactos.
- `docs/arquitectura.md` — sin `docker-compose.yml` en la estructura, con PostgreSQL 17 local y `postgres:17` como service container del CI.
- `docs/identidad.md` — nota al inicio: el nombre es Deploy y la referencia visual vigente es `docs/claude-design/`.
- `docs/claude-design/` — se versiona el prototipo (`Deploy Club.dc.html`, `support.js`, `assets/`) sin `uploads/`, que contiene copias de `assets/` y una imagen que el canvas no usa; `.gitignore` suma `docs/claude-design/uploads/`.
- `docs/Consigna TP — Sistema de Reservas con OpenSpec y CI-CD.md` — se versiona junto al resto de la documentación.
- A partir del archivado, la fuente de verdad del comportamiento pasa a ser `openspec/specs/`; la forma de la API sigue siendo `contratos/openapi.yaml`; la referencia visual, `docs/claude-design/`.

**Código y configuración**
- Base local (fuera del repo) — cada integrante crea en su PostgreSQL 17 el rol `club`, con permiso para crear bases (Prisma lo necesita para la base sombra), y la base `club_reservas`.
- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `apps/api/prisma/seed.ts` — nuevos. Respecto del schema del plan se suman `equipamiento.activo` y `notificacion.reenvio`.
- `apps/api/package.json` — se suman las dependencias de abajo y la clave `prisma.seed`.
- `apps/api/.env.example` — nuevo, con las claves del entorno vacías, incluidas `PREFIJO_CODIGO_RESERVA` y `ZONA_HORARIA_CLUB`. Los `.env` reales no se versionan.
- `package.json` (raíz) — `db:migrate`, `db:seed` y `db:studio` pasan a ejecutar Prisma dentro del workspace `api`, para que lean `apps/api/.env` y la clave `prisma.seed`; se quitan `db:up` y `db:down`, que dependían de Docker (ver `design.md`, decisiones 10 y 13).

**Dependencias**
- `prisma` y `@prisma/client` — el ORM y su cliente generado, fijados en `6.19.3` (ver `design.md`, decisión 9).
- `bcrypt` y `@types/bcrypt` — el seed crea usuarios de prueba y sus contraseñas se persisten hasheadas desde el primer registro, no en texto plano. La capacidad `autenticacion` los reutiliza después.
- `ts-node` — necesario para que `prisma db seed` ejecute un seed escrito en TypeScript. **Ya presente** como devDependency en `apps/api`; no requiere instalación, se documenta porque el seed depende de él.
- Ninguna otra: JWT, Resend y throttler entran con los cambios de FASE 5 que los usan.

**Lo que queda bloqueado hasta que esto se mergee**
- Las ramas de feature de FASE 5, incluida la de administración. Sin schema, migraciones ni contrato ampliado no hay tests de integración ni tipos generados para el front.
- El job de tests del CI, que corre `prisma migrate deploy` contra un service container `postgres:17`.
