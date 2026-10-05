# Proposal

## Why

La administración del club es lo único del MVP que no tiene nada construido. Las cinco operaciones del contrato que todavía no tienen endpoint son de 1.6: `POST /canchas`, `PATCH /canchas/{id}`, `POST /equipamiento`, `PATCH /equipamiento/{id}` y `GET /admin/panel`. Hoy, para cambiar un precio o dar de baja una cancha hay que tocar la base a mano. Además, el header del administrador ya enlaza a `/admin`, `/admin/reservas`, `/admin/canchas` y `/admin/equipamiento` (`components/layout/navegacion.ts`), y las cuatro rutas responden 404: un ADMIN que inicia sesión se encuentra con un menú que no lleva a ningún lado.

Casi todo el comportamiento ya está especificado. `administracion` describe el panel requisito por requisito; `catalogo` describe el ABM de canchas y de equipamiento, y `notificaciones` y `reservas` describen el reenvío y la cancelación por parte de un ADMIN, que **ya están implementados** (PR #32). Este cambio **implementa lo que falta tal como está especificado**, especifica las cuatro pantallas que lo consumen y cierra un hueco del contrato.

## What Changes

- **API — ABM de canchas y equipamiento** (RF-12 y RF-13), en el módulo `catalogo`: `POST /canchas` y `POST /equipamiento` responden 201 con `Location`; `PATCH /canchas/{id}` y `PATCH /equipamiento/{id}` modifican solo los campos enviados. Las cuatro llevan `@Roles('ADMIN')`. Dar de baja es `activa`/`activo` en `false` y no toca reservas (RN-15). Cambiar un precio no toca montos ya congelados (RN-06): eso ya lo garantiza la creación de reservas, que copia el precio al reservar.
- **API — panel del club** (RF-11), en un módulo nuevo `administracion`: `GET /admin/panel?fecha=` calcula en cada consulta, sin tablas agregadas, las reservas del día y del anterior, la facturación prevista, las cancelaciones, la ocupación del día, el promedio de 7 días, la ocupación por cancha y los próximos turnos. Reutiliza `Reloj`, `ventanaDelDia` y `generarGrilla`, así que respeta el horario por día y los días cerrados.
- **Hueco del contrato: nombre repetido.** La base tiene un único `(disciplina_id, nombre)` en `cancha` y en `equipamiento`, pero el contrato no declara qué pasa si se choca con él. Sin tratarlo, un alta o una edición con un nombre que ya existe en la disciplina responde **500**, que es justo lo que la decisión 33 prohíbe. Se agrega **409 `NOMBRE_DUPLICADO`** a las cuatro operaciones. Es un cambio aditivo y **no es BREAKING**. El contrato pasa de 2.2.0 a 2.3.0 y se regenera `apps/web/lib/api/schema.d.ts`.
- **RF-14 sin código nuevo en la API**: `POST /reservas/{id}/reenvio-mail` ya acepta a un ADMIN y manda el mail al titular. Lo que faltaba era la pantalla desde la que un administrador lo pide.
- **Front — cuatro pantallas bajo `/admin`**, con el lenguaje del prototipo (`docs/claude-design/Deploy Club.dc.html`, pantallas "Panel del club", "Reservas de socios", "Canchas y precios" y "Equipamiento y stock"):
  - `/admin`: el panel, con selector de fecha.
  - `/admin/reservas`: todas las reservas, con filtros por estado y fecha, búsqueda por socio o código, y un detalle en `/admin/reservas/{id}` desde el que se cancela **sin el plazo de RN-04** y se reenvía el mail.
  - `/admin/canchas` y `/admin/equipamiento`: listado con activas e inactivas, alta, edición de todos los campos que admite la API, y baja y reactivación.
  - Las cuatro exigen rol ADMIN **en la pantalla**, además de en la API: `proxy.ts` solo mira si hay cookie, así que un SOCIO llega hasta la página.

**Fuera de alcance:**

- **Redirigir al ADMIN a `/admin` al iniciar sesión**: hoy, sin `volver`, el login lleva a `/`. Es de `autenticacion` y se puede sumar después sin tocar nada de esto.
- **Administrar disciplinas** (alta, duración del turno) y **administrar usuarios** (rol, alta y baja): no están en RF-11 a RF-14.
- **Ocupación histórica fiel a las bajas**: la ocupación se calcula sobre las canchas activas **hoy**. Una cancha dada de baja el miércoles deja de contar también para el lunes. Para esto haría falta guardar la historia de las bajas; se explica en `design.md`.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `administracion`: se **agrega** el requisito de la **pantalla del panel** (métricas, ocupación por cancha, próximos turnos, selector de fecha, acceso solo para ADMIN y aviso si la API no responde). Los cuatro requisitos de la API del panel **no cambian**: se implementan tal cual.
- `catalogo`: se **modifican** *Administración de canchas* y *Administración de equipamiento* para sumar el escenario del nombre repetido (409 `NOMBRE_DUPLICADO`). Las dos piden recortar el nombre y no aceptarlo vacío, con el mismo criterio que la decisión 33. Además, a la de equipamiento se le suman los escenarios que la de canchas sí tenía: ítem o disciplina inexistente (404), cambio de precio que no toca reservas existentes (RN-06) y "sin token" (401). Se **agrega** el requisito de las **pantallas de administración de canchas y de equipamiento**.
- `reservas`: se **agrega** el requisito de la **pantalla de reservas del administrador** (listado de todas, filtros, búsqueda, detalle, cancelación sin plazo y reenvío del mail). Los requisitos de la API de reservas **no cambian**.

## Impact

- **`apps/api/src`**:
  - `catalogo/`: controlador y servicio suman alta y edición; DTOs nuevos `crear-cancha`, `actualizar-cancha`, `crear-equipamiento` y `actualizar-equipamiento`.
  - Módulo nuevo `administracion/` (controlador, servicio, DTO del panel y el cálculo de la ocupación como función pura), importado en `AppModule`.
  - `esViolacionDe()` pasa de `reservas/errores-de-prisma.ts` a `common/`, porque ahora la usan dos módulos.
  - Se reutiliza sin reescribir: `Reloj`, `horario.ts`, `grilla.ts`, `fechas.ts`, los mapeadores de `catalogo/`, `ErrorDeApi`, `@Roles()` y la configuración (`cancelacionMinutosMinimos`).
- **`apps/api/test`**: `catalogo.e2e-spec.ts` suma los escenarios del ABM; `administracion.e2e-spec.ts` es nuevo. Siguen corriendo en serie.
- **`contratos/openapi.yaml`**: 409 en cuatro operaciones y versión 2.3.0. **`apps/web/lib/api/schema.d.ts`** regenerado y versionado (decisión 19).
- **`apps/web`**: `app/admin/` con las cuatro pantallas y sus Server Functions. Un guard de rol para las pantallas (`lib/sesion.ts`). Alias nuevos en `lib/api/types.ts` (`OcupacionCancha`, `ProximoTurno`, `CrearCanchaRequest`, `ActualizarCanchaRequest`, `CrearEquipamientoRequest`, `ActualizarEquipamientoRequest`). `proxy.ts` **ya** protege `/admin/:path*`.
- **`apps/web/e2e`**: `admin.spec.ts` nuevo, con un ADMIN del seed.
- **Base de datos**: sin migración. Los índices únicos que generan el 409 ya existen.
- **`.github/workflows/ci.yml`**: sin cambios.
- **Docs, en el mismo PR**: `docs/memoria-proyecto.md` (decisión nueva e historial), `docs/estado-del-proyecto.md` (1.6 cerrado, **20 de 20** operaciones con endpoint, 16 de 16 RF y las pantallas nuevas), `README.md` (cómo entrar como administrador).
