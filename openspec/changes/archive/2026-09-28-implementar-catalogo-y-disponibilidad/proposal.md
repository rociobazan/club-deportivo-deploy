# Proposal

## Why

El ítem 1.3 (crear reserva) no puede empezar sin canchas que listar ni turnos libres contra qué reservar: `catalogo` y `disponibilidad` son sus dos dependencias y hoy `apps/api` no tiene ninguno de sus endpoints. Las dos capacidades ya están especificadas escenario por escenario; este cambio **las implementa tal como están** y especifica lo único que falta, que es el comportamiento de las dos pantallas del sitio que las consumen.

## What Changes

- **API — módulo `catalogo`**: `GET /disciplinas`, `GET /canchas` (filtros `disciplinaId` y `techada`; `disciplina` desnormalizada) y `GET /equipamiento` (filtro `disciplinaId`; con `fecha` y `horaInicio`, que van juntos, cada ítem suma `stockDisponible`). Los parámetros `incluirInactivas` / `incluirInactivos` exigen token con rol `ADMIN`, como pide la spec; los endpoints siguen siendo públicos sin ellos.
- **API — módulo `disponibilidad`**: `GET /disponibilidad` con `fecha` obligatoria y filtros `disciplinaId` y `canchaId`. Genera la grilla desde `HORA_APERTURA` en bloques de la duración de la disciplina hasta `HORA_CIERRE`, resta las reservas no canceladas, rechaza fechas pasadas y, para hoy, omite los turnos ya empezados.
- **Reloj del club**: un provider `Reloj` que da "hoy" y "ahora" en `ZONA_HORARIA_CLUB`, para que la API y los tests hablen de la misma hora. Lo van a reutilizar 1.3 y 1.4 (RN-02, RN-03, RN-04, RN-07 y el estado `COMPLETADA`).
- **Configuración**: `HORA_APERTURA`, `HORA_CIERRE` y `ZONA_HORARIA_CLUB`, con los valores por defecto de `requisitos.md` §4 y validación de formato al arrancar. `HORIZONTE_RESERVA_DIAS` no entra: es una regla de reservas (1.3).
- **Front**: página `/disponibilidad` (selector de fecha, filtro por disciplina y una grilla por cancha con turnos **Libre / Ocupada / Pasado**; tocar un turno libre lleva a reservar o, sin sesión, avisa que hace falta ser socio) y página `/canchas` "Canchas y precios" (canchas con superficie, techo, precio y duración del turno, y el equipamiento con su stock). Las dos rutas ya están enlazadas en el header.
- **Precios como número**: `Prisma.Decimal` serializa como string y el contrato promete `number`; la API convierte al salir. Se establece el patrón para 1.3 y 1.6.
- No hay cambios de esquema de base ni de contrato. No es **BREAKING**.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `disponibilidad`: se **agrega** el requisito de la pantalla del sitio: grilla con turnos libres, ocupados y pasados, selector de fecha, filtro por disciplina y qué pasa al elegir un turno con y sin sesión. Los cuatro requisitos existentes de la API **no cambian**.
- `catalogo`: se **agrega** el requisito de la página "Canchas y precios". Los tres requisitos públicos existentes **no cambian** y se implementan tal cual; los dos de administración (alta, edición y baja) son del ítem 1.6 y **no se tocan**, salvo la parte de sus `GET` que ya está en los requisitos públicos (`incluirInactivas` reservado a `ADMIN`).

## Impact

- **Depende del PR #19** (`feature/spec-autenticacion`): reutiliza los guards globales, `@UsuarioActual()`, `ErrorDeApi`, el filtro de errores, `PrismaModule` y `configuracion.ts`. La rama `feature/spec-disponibilidad` sale de ahí; el PR apunta a esa rama y se retargetea a `main` cuando el #19 entre.
- `apps/api/src`: módulos nuevos `catalogo/`, `disponibilidad/` y `common/reloj.ts`; `configuracion.ts` suma tres variables. `apps/api/test`: e2e por escenario de las dos specs, con datos propios creados por Prisma (crear reservas por la API es de 1.3).
- `apps/web/app`: `disponibilidad/` y `canchas/`. `apps/web/lib`: un helper para armar la grilla en el front. Los tipos del contrato ya existen en `lib/api/types.ts`.
- `.github/workflows/ci.yml`: sin cambios; las variables nuevas tienen valor por defecto.
- `README.md`, `docs/estado-del-proyecto.md` y `docs/memoria-proyecto.md`: variables nuevas, avance de 1.2 y la decisión del reloj y de los precios, en el mismo PR.
- **Fuera de alcance**: crear reservas (1.3), ABM de canchas y equipamiento (1.6), la landing (1.5), el horizonte de reserva y el `stockDisponible` del formulario de reserva (lo consume 1.3 con este mismo endpoint).
