## Why

El equipo tiene el relevamiento funcional en `docs/requisitos.md` (RF-00 a RF-10, RN-01 a RN-14) y el contrato de la API en `contratos/openapi.yaml`, pero `openspec/specs/` está vacío: hoy no existe ninguna especificación vigente contra la cual validar, revisar o archivar trabajo. Sin esa base, las cuatro ramas de features que arrancan en paralelo no tienen un origen común y cada integrante interpreta las reglas de negocio por su cuenta.

Hay además una divergencia activa entre los dos documentos de entrada. El contrato ya fue corregido a **precio plano** (`Cancha.precioPorTurno`, con la nota explícita "No varía según la cantidad de jugadores"), no define ningún schema `Tarifa`, expone `cantidadJugadores` como campo opcional e informativo, y no publica `jugadoresPermitidos` en `Disciplina`. `docs/requisitos.md` todavía describe el modelo anterior de tarifa por cantidad de jugadores. Mientras las dos versiones convivan, cualquier spec que se escriba hereda la contradicción.

Y el repositorio es un andamio: `apps/api` es un Nest recién generado sin módulos, `apps/web` un Next sin páginas, y no existen `prisma/schema.prisma`, `docker-compose.yml` ni seed, aunque el `package.json` raíz ya los invoca en sus scripts. Nadie puede escribir un test de reserva mientras no haya base de datos ni el índice único parcial que sostiene RN-01.

Este es el PR base que aprueban los cuatro antes de abrir cualquier rama de feature.

## What Changes

- Se convierte el relevamiento funcional en especificaciones de OpenSpec, agrupadas en seis capacidades. Cada requisito funcional pasa a `### Requirement:` y cada criterio `DADO/CUANDO/ENTONCES` a un `#### Scenario:` con `WHEN`/`THEN`.
- Se registran las reglas de negocio vigentes como escenarios verificables dentro de la capacidad que las hace cumplir, no como una lista suelta de prosa.
- **BREAKING (respecto del relevamiento previo, no de código en producción): se adopta precio plano por turno.** Desaparece la tabla `tarifa`; el precio pasa a `cancha.precio_por_turno`. Se eliminan **RN-11** y **RN-12**, y la numeración del resto **no se recorre**: las reglas siguen siendo RN-01 a RN-10, RN-13 y RN-14, con el hueco a la vista para que las referencias cruzadas existentes sigan siendo válidas. `cantidadJugadores` queda como dato opcional e informativo que no interviene en el cálculo del monto.
- Se alinea `docs/requisitos.md` con el contrato, que es la fuente de verdad ya corregida.
- Se levanta la fundación de datos compartida: `docker-compose.yml` con PostgreSQL 16, `apps/api/prisma/schema.prisma`, la migración manual del índice único parcial de RN-01, los dos índices de apoyo y el seed con disciplinas, canchas, equipamiento y usuarios de prueba.
- El prefijo del código de reserva sale a la configuración como `PREFIJO_CODIGO_RESERVA` (default `RES`, que es el que ejemplifica el contrato). Así el código legible no queda acoplado a una decisión de branding todavía abierta y el nombre del club puede cerrarse más adelante sin tocar specs, seed ni tests.
- Se deja `npm run spec:validate` (`openspec validate --all --strict`) y `npm run contrato:lint` pasando en verde, que es lo que después consume el job `contrato` del CI.

**No** entra en este cambio la implementación de endpoints ni pantallas: RF-00 a RF-10 se implementan en los cuatro cambios de FASE 5, cada uno con su rama y su revisor. Este cambio les deja la spec y la base de datos sobre la que trabajar.

### Punto abierto

Al eliminar RN-11 desaparece la única regla que validaba `cantidadJugadores` contra la disciplina, y el contrato tampoco expone `jugadoresPermitidos`. La columna `disciplina.jugadores_permitidos` queda entonces sin lector ni escritor. Se resuelve al corregir `docs/requisitos.md`, antes de escribir las specs.

## Capabilities

### New Capabilities

- `autenticacion`: registro, login con JWT, perfil, hasheo con bcrypt y el guard de roles que sostiene RN-13. Cubre RF-00.
- `catalogo`: consulta pública de disciplinas, canchas con su precio por turno, y equipamiento con stock calculado por turno. Cubre RF-01, RF-02 y RF-07.
- `disponibilidad`: cálculo de turnos libres a partir del horario de atención y las reservas activas, sin almacenarlos. Cubre RF-03 y RN-09.
- `reservas`: creación con todas sus validaciones de negocio, consulta filtrada por rol y cancelación con plazo. Cubre RF-04, RF-05, RF-06 y el grueso de las reglas vigentes (RN-01 a RN-08, RN-10 y RN-13).
- `notificaciones`: mails de confirmación y cancelación vía Resend, fuera de la transacción y sin poder revertirla. Cubre RF-08 y RN-14.
- `institucional`: landing pública que renderiza sin la API y formulario de contacto con rate limiting. Cubre RF-09 y RF-10.

### Modified Capabilities

Ninguna. `openspec/specs/` está vacío: las seis capacidades son nuevas.

## Impact

**Specs y documentación**
- `openspec/changes/especificacion-base-reservas/specs/{autenticacion,catalogo,disponibilidad,reservas,notificaciones,institucional}/spec.md` — nuevos.
- `docs/requisitos.md` — corregido a precio plano: se elimina la tabla `tarifa` del modelo de datos y del diagrama, `precio_por_turno` vuelve a `cancha`, se dan de baja RN-11 y RN-12 sin renumerar, y se ajustan los criterios de RF-01, RF-02 y RF-04 que dependían del modelo anterior.
- A partir del archivado, la fuente de verdad del comportamiento pasa a ser `openspec/specs/`; la forma de la API sigue siendo `contratos/openapi.yaml`.

**Código y configuración**
- `docker-compose.yml` (raíz) — nuevo.
- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `apps/api/prisma/seed.ts` — nuevos.
- `apps/api/package.json` — se suman las dependencias de abajo y la clave `prisma.seed`.
- `apps/api/.env.example` — nuevo, con las claves del entorno vacías, incluida `PREFIJO_CODIGO_RESERVA`. Los `.env` reales no se versionan.

**Dependencias**
- `prisma` y `@prisma/client` — el ORM y su cliente generado.
- `bcrypt` y `@types/bcrypt` — el seed crea usuarios de prueba y sus contraseñas se persisten hasheadas desde el primer registro, no en texto plano. La capacidad `autenticacion` los reutiliza después.
- `ts-node` — necesario para que `prisma db seed` ejecute un seed escrito en TypeScript. **Ya presente** como devDependency en `apps/api`; no requiere instalación, se documenta porque el seed depende de él.
- Ninguna otra: JWT, Resend y throttler entran con los cambios de FASE 5 que los usan.

**Lo que queda bloqueado hasta que esto se mergee**
- Las cuatro ramas de feature de FASE 5. Sin schema ni migración no hay tests de integración posibles.
- El job `api` del CI, que corre `prisma migrate deploy` contra el service container.
