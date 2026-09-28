# Design

## Context

Ver `proposal.md` para la motivación. Lo que condiciona el cómo:

- **Las specs de la API ya fijan el comportamiento** (`openspec/specs/catalogo/spec.md` y `disponibilidad/spec.md`), y el diseño archivado tomó dos decisiones que este cambio implementa: la **5** ("hoy" y "ahora" en la hora local del club, por un reloj inyectable que los tests puedan fijar) y la **6** (grilla anclada a la apertura: `HORA_APERTURA + k × duración` mientras el bloque termine a más tardar en `HORA_CIERRE`).
- **Este cambio se apoya en el #19** (`feature/spec-autenticacion`): guards globales con `@Publico()` y `@Roles()`, `@UsuarioActual()`, `ErrorDeApi`, el filtro con el schema `Error`, `PrismaModule`, `configuracion.ts` y `configurarApp()`. La rama sale de ahí.
- **Hechos verificados en este entorno**: `Intl.DateTimeFormat` resuelve `America/Argentina/Cordoba` sin librerías (Node trae ICU completo), y **`Prisma.Decimal` serializa como string** (`"9000"`) mientras el contrato promete `number`.
- El contrato devuelve **solo los turnos libres** (`DisponibilidadResponse.canchas[].slots`); la pantalla, según la decisión 14 del diseño archivado, dibuja la grilla completa y marca lo que no vino como Ocupada o Pasado.
- Datos del seed: Tenis 60 min (Cancha 1, Cancha 2), Pádel 90 min (Pádel 1, 2 y 3; las dos primeras techadas), Fútbol 5 60 min (Cancha Sur); equipamiento por disciplina. `usuario`, `reserva` y `reserva_equipamiento` ya existen en el esquema.

## Goals / Non-Goals

**Goals:**

- Cumplir los siete requisitos de API (tres de `catalogo`, cuatro de `disponibilidad`) con un test por escenario, más los dos requisitos de pantalla agregados.
- Dejar el `Reloj`, la grilla y los mapeadores Decimal→number listos para que 1.3, 1.4 y 1.6 los reutilicen sin reescribirlos.

**Non-Goals:**

- Cambiar el contrato para que la API devuelva la grilla completa con estados. Es tentador, pero el contrato es el entregable y se amplía solo cuando una feature lo necesita de verdad; hoy alcanza con dibujar en el front.
- Cachear la disponibilidad. Es un cálculo por consulta a propósito (spec): se cachea cuando haya un problema medible.
- El horizonte de reserva (`HORIZONTE_RESERVA_DIAS`): es regla de `reservas` (1.3). La disponibilidad se puede consultar para cualquier fecha futura.

## Decisions

### 1. `Reloj` inyectable, con `Intl` y sin librerías

`common/reloj.ts`: `@Injectable() class Reloj { ahora(): { fecha: 'YYYY-MM-DD'; hora: 'HH:MM' } }`, que formatea `new Date()` con `Intl.DateTimeFormat` en `ZONA_HORARIA_CLUB`. Todo lo que compara contra el presente (hoy, ahora, y en 1.3/1.4 los plazos y `COMPLETADA`) pasa por acá. Los e2e lo reemplazan con `overrideProvider(Reloj).useValue({ ahora: () => ({ fecha, hora }) })`.

*Alternativa descartada*: fijar `TZ` en el proceso o usar `date-fns-tz`/`luxon`. La primera no deja fijar la hora en un test; la segunda agrega una dependencia para dos líneas de `Intl`.

### 2. La grilla es una función pura, en la API y en el front

`common/grilla.ts` en la API: `generarGrilla(apertura, cierre, duracionMin) → [{ horaInicio, horaFin }]`, sin fechas ni base de datos, probada por unitarios (15 turnos de tenis, 10 de pádel, el bloque que no entra antes del cierre). La disponibilidad la usa y le resta las reservas.

El front tiene **su propia copia** en `apps/web/lib/grilla.ts` para dibujar los bloques Ocupada/Pasado que la API no devuelve. Es duplicación consciente: son dos apps y el contrato no expone la grilla. La API es la fuente de verdad; si alguna vez divergen, el síntoma es visible (un bloque "Libre" que no se puede reservar) y la solución de fondo es ampliar el contrato, no acoplar los repos.

### 3. El guard de JWT identifica al usuario también en los endpoints públicos

`GET /canchas?incluirInactivas=true` es público pero exige `ADMIN`. Con el guard actual, en un endpoint `@Publico()` el token ni se mira, así que el controlador no puede saber quién pide. Se cambia `JwtAuthGuard` para que en los públicos **intente** verificar el `Authorization` si viene: si es válido deja `request.usuario`; si falta o es inválido, sigue como anónimo en vez de rechazar. El controlador resuelve: con `incluirInactivas=true`, sin usuario → 401 `NO_AUTENTICADO`, con rol distinto de `ADMIN` → 403 `SIN_PERMISOS`. Lo mismo para `incluirInactivos` en equipamiento. Es un cambio en un archivo del #19, pequeño y aditivo, y 1.6 lo hereda.

*Alternativa descartada*: verificar el token a mano en el controlador. Duplica lo que ya hace el guard y es el tipo de copia que se desincroniza.

### 4. `stockDisponible` en una sola consulta agrupada

Con `fecha` y `horaInicio`, se cuenta lo alquilado con `prisma.reservaEquipamiento.groupBy({ by: ['equipamientoId'], where: { reserva: { fecha, horaInicio, estado: { not: 'CANCELADA' } } }, _sum: { cantidad: true } })` y se resta al `stockTotal` de cada ítem, con piso en 0. Una consulta para el catálogo y una para el conteo, nunca una por ítem (regla de "nada de queries en loops").

### 5. Disponibilidad: dos consultas y cálculo en memoria

Se traen las canchas activas de disciplinas activas (con la duración de su disciplina) filtradas por `disciplinaId`/`canchaId`, y en una segunda consulta las reservas no canceladas de esa fecha para esas canchas (`select canchaId, horaInicio`). Por cancha: grilla de la decisión 2, menos las `horaInicio` ocupadas, menos —si la fecha es hoy— los bloques con inicio anterior a `reloj.ahora().hora`. Fecha anterior a hoy → 400 `SOLICITUD_INVALIDA` desde el servicio, con `ErrorDeApi`.

### 6. Validación de query con DTOs y transformaciones explícitas

`class-validator` sobre DTOs de query. Como el `ValidationPipe` global no tiene `enableImplicitConversion`, los enteros llevan `@Type(() => Number)` y los booleanos un `@Transform` que acepta `true`/`false` (y rechaza el resto). `fecha` valida el formato `YYYY-MM-DD` y que la fecha exista (no `2026-02-30`); `horaInicio` usa el patrón del contrato. La regla "`fecha` y `horaInicio` van juntos" se valida en el servicio, porque `class-validator` no cruza campos sin un validador propio.

### 7. Los precios salen como número

`Prisma.Decimal` → `Number(...)` en mapeadores `aCancha()` y `aEquipamiento()` del módulo `catalogo`, que además desnormalizan `disciplina` (nombre) como pide el contrato. Reservas (1.3) y administración (1.6) reutilizan los mismos mapeadores.

*Alternativa descartada*: un interceptor global que convierta todo `Decimal`. Resuelve más de lo que hace falta hoy y esconde en qué respuestas hay dinero; se adopta si aparecen más de tres mapeadores iguales.

### 8. Configuración con defaults y validación de formato

`configuracion.ts` suma `horaApertura` (`08:00`), `horaCierre` (`23:00`) y `zonaHoraria` (`America/Argentina/Cordoba`), leídas de `HORA_APERTURA`, `HORA_CIERRE` y `ZONA_HORARIA_CLUB`. Se valida `HH:MM`, que la apertura sea anterior al cierre, y que la zona exista (`Intl.supportedValuesOf('timeZone')` o un `try` sobre `DateTimeFormat`). A diferencia de las de JWT, tienen valor por defecto, así el CI y cada integrante no tienen que agregarlas.

### 9. Front: consulta por URL, sin estado en el cliente

`/disponibilidad` es un Server Component que lee `fecha` y `disciplinaId` de la URL, llama a `GET /disciplinas` y `GET /disponibilidad` con `apiFetch` (`timeoutMs: 2000`) y dibuja. El selector de fecha y el filtro son un `<form method="get">` con `<input type="date" min={hoy}>` y un `<select>`: cambiar la consulta es navegar, sin JavaScript de estado. Una fecha pasada en la URL no se manda a la API: la página muestra hoy con un aviso.

El front necesita saber **hoy** (para el `min` del selector y para marcar Pasado) y **apertura/cierre** (para dibujar la grilla). Salen de variables de entorno del workspace `web` con los mismos nombres y defaults que la API (`ZONA_HORARIA_CLUB`, `HORA_APERTURA`, `HORA_CIERRE`), leídas en el servidor. Es la segunda duplicación consciente con la API; queda en riesgos.

### 10. El aviso para visitantes es un `<dialog>` en un Client Component chico

Solo la grilla necesita cliente, y solo para el visitante: `AvisoSocio` envuelve los bloques libres y, al tocar uno sin sesión, abre un `<dialog>` nativo con "Para reservar hay que ser socio" y dos accesos: `/ingresar?volver=<esta consulta>` y `/registro?volver=<esta consulta>`. Con sesión, los bloques libres son `<Link>` a `/reservar?canchaId=&fecha=&horaInicio=` (la pantalla es de 1.3; hasta que exista, da 404 dentro del layout).

### 11. Error de API como estado de la página, no como excepción

Las dos páginas capturan `ApiHttpError` y renderizan un aviso con un botón "Reintentar" (un `<Link>` a la misma URL). El `error.tsx` del layout queda para lo inesperado. Así se cumple "sin una página rota" y no se mezcla un fallo esperable de red con un bug.

### 12. Tests

- **Unitarios**: `grilla.spec.ts` (los escenarios de tenis, pádel y cierre anticipado, sin base), `reloj.spec.ts` (con un `Date` fijo en UTC y la zona del club), validadores de `fecha` y `horaInicio`, y los mapeadores de precio.
- **e2e**: `catalogo.e2e-spec.ts` y `disponibilidad.e2e-spec.ts`, un `describe` por requisito y un `it` por escenario. Los datos se crean con Prisma directamente (disciplinas `e2e-…`, canchas, equipamiento, un usuario `@e2e.test` y reservas), porque `POST /reservas` es de 1.3, y se borran solo esos al terminar. El `Reloj` se reemplaza por uno fijo (`fecha` de mañana, o de hoy a las 14:00 para el escenario de media tarde). Para "cierre anticipado" se arranca una app aparte con `HORA_CIERRE=22:00` en `process.env` antes de compilar el módulo.

## Risks / Trade-offs

- **[Grilla y apertura/cierre duplicados en el front]** → Función pura idéntica en las dos apps y las mismas variables con los mismos defaults; el README documenta que si cambian, cambian en los dos `.env`. Si el equipo lo prefiere, el paso siguiente es exponer la grilla en el contrato (fuera de este cambio).
- **[`groupBy` con filtro por relación en Prisma 6.19]** → Es una consulta soportada, pero se verifica en la primera tarea del módulo con un e2e antes de construir encima; el plan B es un `findMany` sobre `reservaEquipamiento` con `include: { reserva }` y sumar en memoria.
- **[Cambiar `JwtAuthGuard` toca el #19]** → El cambio es aditivo (solo en endpoints públicos) y sus tests unitarios y e2e existentes siguen aplicando; se agregan dos casos: público con token válido deja `usuario`, público con token inválido sigue como anónimo.
- **[Un día con 6 canchas y grilla completa son ~80 botones]** → Es una lista estática por cancha; no hay estado por bloque. Aceptable para el MVP.
- **[Fechas muy lejanas]** → Sin horizonte en la disponibilidad, se puede consultar 2030. Devuelve la grilla completa, que es correcto; el límite lo pone 1.3 al reservar.

## Migration Plan

No hay migración. Las tres variables nuevas tienen valor por defecto, así que ningún `.env` deja de funcionar. Se despliega con el merge del PR, después del #19; si algo falla se revierte el merge.

## Open Questions

Ninguna que cambie la spec o las tareas. Si el equipo prefiere que la API devuelva la grilla completa con estados (decisión 2), es una ampliación del contrato para un cambio posterior.
