# Design

## Context

Ver `proposal.md` para la motivación. Lo que condiciona el cómo:

- **La spec ya fija el comportamiento**: los ocho requisitos de creación de `openspec/specs/reservas/spec.md`, más la pantalla y la corrección de RN-09 que agrega el delta de este cambio. No hay que inventar reglas, hay que implementarlas.
- **`main` ya tiene todo lo transversal**, y este cambio no reescribe nada de eso: los guards globales con `@Publico()` y `@Roles()`, `@UsuarioActual()` y `exigirRol()`, `ErrorDeApi` con el filtro que lo serializa al schema `Error`, `PrismaModule`, y en `common/`: `Reloj`, `horario.ts` (`ventanaDelDia`, `diaDeLaSemana`), `grilla.ts` (`generarGrilla`, `aMinutos`, `aHora`) y `fechas.ts`. `ConfiguracionModule` es `@Global()` y exporta `CONFIGURACION` y `Reloj`, así que `ReservasModule` no importa nada para inyectarlos.
- **Hechos verificados en el repo, no supuestos**:
  - El `ValidationPipe` global ya está en `whitelist: true, forbidNonWhitelisted: true` (`common/validacion.ts`). Un `clienteId` en el body da 400 **sin escribir una línea**: el escenario "Intento de reservar a nombre de otro" sale del pipe que ya existe.
  - El índice de RN-01 es `CREATE UNIQUE INDEX ux_reserva_slot_activo ON reserva (cancha_id, fecha, hora_inicio) WHERE estado <> 'CANCELADA'`, escrito a mano en la migración `slot_unico_activo`. Es único y parcial: una cancelación libera el turno.
  - `reserva.codigo` es `VarChar(12)` y `@unique`. Con `-` y 6 caracteres, el prefijo no puede pasar de 5.
  - `Prisma.Decimal` serializa como string (`"9000"`) y el contrato promete `number`. `catalogo/mapeadores.ts` ya resuelve eso.
  - El enum `EstadoReserva` incluye `COMPLETADA`, pero por la decisión 9 de la memoria **solo se persisten `CONFIRMADA` y `CANCELADA`**: `COMPLETADA` se deriva al leer. Este cambio persiste `CONFIRMADA`.
  - `horaInicio` y `horaFin` son `VarChar(5)` con formato `HH:MM`, así que comparar horas como strings ordena bien.
- **El front ya está enganchado**: `app/disponibilidad/grilla-cancha.tsx` enlaza `/reservar?canchaId=&fecha=&horaInicio=` y `/reservar` ya está en el `matcher` de `apps/web/proxy.ts`. No hay que tocar ninguno de los dos: falta la pantalla.
- **Datos del seed**: Tenis 60 min, Pádel 90 min, Fútbol 5 60 min; equipamiento por disciplina, con el tubo de pelotas separado para tenis y para pádel. Usuarios `admin@club.test` y `socio@club.test`.

## Goals / Non-Goals

**Goals:**

- Cumplir los ocho requisitos de creación con un test por escenario, y que **RN-01 se sostenga de verdad** ante dos solicitudes simultáneas, no por suerte.
- Que el dinero sea exacto: cuentas en `Decimal`, nunca en punto flotante.
- Dejar **señalado y aislado** el punto donde 1.4 engancha el mail, para que sea un agregado y no una cirugía.

**Non-Goals:**

- Reservar equipamiento sin cancha, o más de un turno por solicitud. La spec habla de un turno.
- Cambiar el contrato para devolver el desglose de equipamiento en el 201. El contrato ya define qué devuelve `POST /reservas`; el desglose está en el detalle, que es de 1.4.
- Un módulo `notificaciones`. Es de 1.4.

## Decisions

### 1. Orden de validaciones, fijado a propósito

Cuando fallan dos cosas a la vez, el código de respuesta lo decide este orden, no el azar del control flow:

| # | Qué se valida | Respuesta |
|---|---|---|
| 1 | Forma del body (DTO) | **400** `SOLICITUD_INVALIDA` |
| 2 | Cancha existente y activa; ítems de equipamiento existentes y activos | **404** `NO_ENCONTRADO` |
| 3 | Turno dentro de la grilla y de la ventana del día (RN-09) | **422** `HORARIO_FUERA_DE_TURNO` |
| 4 | Fecha y hora reservables (RN-02, RN-03) | **422** `FECHA_EN_EL_PASADO` / `HORIZONTE_EXCEDIDO` |
| 5 | Equipamiento de la disciplina de la cancha (RN-08) | **422** `EQUIPAMIENTO_DE_OTRA_DISCIPLINA` |
| 6 | Límite de reservas activas del socio (RN-07) | **422** `LIMITE_RESERVAS_ACTIVAS` |
| 7 | Stock del ítem en ese turno (RN-05) | **409** `STOCK_INSUFICIENTE` |
| 8 | Turno libre (RN-01) | **409** `SLOT_NO_DISPONIBLE` |

El criterio: primero lo que se contesta sin tocar la base, después lo que depende de una consulta, y al final lo que depende del estado de **otras** reservas, que es lo único que puede cambiar entre que se valida y se escribe. Los 404 van antes que los 422 porque no se puede opinar del horario de una cancha que no existe.

*Alternativa descartada*: acumular todos los errores y devolverlos juntos. El schema `Error` del contrato describe un error, no una lista, y cambiarlo para esto ampliaría el contrato por una comodidad.

### 2. RN-01: la base es el árbitro, el pre-chequeo es solo cortesía

El pre-chequeo (`findFirst` del turno) sirve para dar un `detalle` claro y para no escribir de más, pero **no garantiza nada**: entre el `SELECT` y el `INSERT` entra otra solicitud. La garantía es el `INSERT` contra `ux_reserva_slot_activo`. Así que el `INSERT` va dentro de `prisma.$transaction` y se **captura el `P2002`** de ese índice (`PrismaClientKnownRequestError` con `code === 'P2002'`) para devolver 409 `SLOT_NO_DISPONIBLE`.

**Verificado contra la base, no supuesto**: Prisma **no** informa el nombre del índice en `meta.target`, informa las **columnas**: `["cancha_id", "fecha", "hora_inicio"]` para el turno ocupado y `["codigo"]` para el código repetido. Así que el discriminador es el conjunto de columnas, no el nombre.

Esto es exactamente lo que pide el escenario "Dos solicitudes simultáneas por el mismo turno", y se prueba con un e2e que manda los dos `POST` con `Promise.all` y exige un 201, un 409 y **una sola** fila no cancelada.

*Alternativa descartada*: un advisory lock de PostgreSQL por `(cancha, fecha, hora)`. Funciona, pero agrega un mecanismo paralelo para algo que el índice ya garantiza, y el índice sigue siendo necesario igual como última línea.

### 3. RN-05 y RN-07: se cierran con `SELECT … FOR UPDATE`, que es lo que faltaba

El problema, que conviene nombrar: con el aislamiento *read committed* que usa PostgreSQL por defecto, dos transacciones simultáneas que piden el último par de paletas **las dos ven stock libre**, porque ninguna ve las filas todavía no commiteadas de la otra. El stock no tiene ningún índice que lo ataje, así que sin hacer nada más RN-05 queda como una validación de buena fe. Lo mismo vale para RN-07: un socio con 2 reservas activas que manda dos solicitudes a la vez puede terminar con 4.

**Se cierra** tomando un lock de fila al principio de la transacción, con una consulta cruda, y recién después contando:

```sql
SELECT id FROM usuario WHERE id = $1 FOR UPDATE;
SELECT id FROM equipamiento WHERE id = ANY($2) ORDER BY id FOR UPDATE;
```

Con eso, dos solicitudes que compiten por el mismo ítem —o del mismo socio— se serializan: la segunda espera el commit de la primera y su conteo ya ve esas filas. El `ORDER BY id` es para que dos solicitudes con ítems en común pero en distinto orden no se trabe una con otra. Una reserva sin equipamiento no toma el segundo lock: no hay nada que sobrevender.

Por qué vale la pena y no es sobrediseño: el costo es un lock de fila en una transacción que dura milisegundos, y el lock es **por socio y por ítem**, así que dos personas reservando cosas distintas no se cruzan nunca. A cambio, RN-05 y RN-07 pasan de "casi siempre" a "siempre", y una falla acá se paga en el mostrador, con equipamiento prometido que no existe.

*Alternativas descartadas*: (a) `isolationLevel: 'Serializable'` en la transacción — PostgreSQL abortaría una de las dos con un `40001` y habría que envolver todo en una lógica de reintento, para un caso que el lock resuelve sin reintentos; (b) dejarlo documentado y no hacer nada — es la opción que se descarta explícitamente, porque el costo de cerrarlo es una consulta.

**Queda como límite conocido** que `PATCH /equipamiento` (ítem 1.6) va a tomar el mismo lock de fila al editar un ítem: una edición larga podría demorar unas reservas. En la práctica son dos operaciones cortas, y se anota en los riesgos para que 1.6 lo sepa.

### 4. `horaFin` y RN-09 salen del mismo paso

En vez de sumar minutos y validar aparte, se calcula la grilla del día con las piezas que ya existen —`ventanaDelDia(fecha, horario)` para la apertura y el cierre que le toca a ese día, y `generarGrilla(apertura, cierre, duracion)` para los bloques— y **se busca el bloque cuya `horaInicio` coincide** con la pedida. Si no hay bloque, es 422 `HORARIO_FUERA_DE_TURNO`; si hay, su `horaFin` es la de la reserva. Un día cerrado devuelve ventana nula y por lo tanto ningún bloque: el mismo 422 sin un caso especial.

Esto hace que la reserva y la disponibilidad no puedan discrepar: las dos derivan del mismo par de funciones. Es también la razón por la que RN-09 necesitaba la corrección de spec que trae el delta.

### 5. El dinero se calcula en `Decimal`

`montoCancha` es el `precioPorTurno` de la cancha. `montoEquipamiento` es la suma de `cantidad × precioPorTurno` de cada ítem, hecha con la aritmética de `Prisma.Decimal` (`.mul()`, `.add()`), **no con `number`**, y `montoTotal` la suma de los dos. El `precioUnitario` de cada ítem se copia a `reserva_equipamiento`: eso es RN-06, el precio congelado. La conversión a `number` pasa recién al salir, en el mapeador, reutilizando el criterio de `catalogo/mapeadores.ts`.

`cantidadJugadores` no entra en ninguna cuenta. Es un entero opcional ≥ 1 que se guarda y se devuelve.

### 6. Código de reserva: generar y reintentar

`codigo.ts` expone `generarCodigo(prefijo)`, que devuelve `<prefijo>-XXXXXX` con 6 caracteres `[A-Z0-9]` tomados de `crypto.randomInt`. La unicidad la garantiza la columna: si el `INSERT` falla con `P2002` sobre `codigo`, se regenera y se reintenta, hasta 3 veces. Con 36⁶ combinaciones la colisión es anecdótica, pero el reintento es más barato que razonar sobre probabilidades.

Discriminar los dos `P2002` por el índice que los causó es lo que hace que una colisión de código no se confunda con un turno ocupado.

### 7. Configuración: cuatro variables con default y validación

`configuracion.ts` suma, con el mismo patrón que `HORA_APERTURA` (default, validación al arrancar y mensaje que dice qué poner):

| Variable | Default | Validación |
|---|---|---|
| `HORIZONTE_RESERVA_DIAS` | `30` | entero ≥ 1 |
| `MAX_RESERVAS_ACTIVAS_SOCIO` | `3` | entero ≥ 1 |
| `PREFIJO_CODIGO_RESERVA` | `RES` | `^[A-Z]{2,5}$`, para que `prefijo + '-' + 6` entre en el `VarChar(12)` |
| `CANCELACION_MINUTOS_MINIMOS` | `120` | entero ≥ 0 |

Las tres primeras las usa este cambio. `CANCELACION_MINUTOS_MINIMOS` **no la consume nadie todavía**: la consume 1.4. Se suma acá igual porque ya está en `apps/api/.env.example` sin que nadie la lea, y así 1.4 no tiene que volver a tocar este archivo ni su test. Queda anotado para que no parezca código muerto.

### 8. Una transacción, y el mail queda afuera con el lugar marcado

La transacción hace: locks de la decisión 3 → conteos de stock y de reservas activas → `INSERT` de la reserva → `INSERT` de las filas de `reserva_equipamiento` (en una sola llamada). Todo lo que no es escritura —cancha, disciplina, ítems, reglas de tiempo— se resuelve antes, para que la transacción sea lo más corta posible.

**El punto de enganche de 1.4** queda en `ReservasService.crear()`, inmediatamente después de que `$transaction` resuelve y antes del `return`, con un comentario que lo nombra. Ahí, y solo ahí, va el envío del mail de confirmación: **después** del commit, porque RN-14 exige que una falla del proveedor no revierta la reserva ni cambie la respuesta. Este cambio dejó el lugar y la razón escritos y no mandaba nada. **Al integrar 1.4 el mail quedó cableado:** `crear()` llama a `NotificacionesService.enviarConfirmacion()` en ese punto, después del commit, y como ese servicio no propaga y devuelve el estado del envío, una falla del proveedor no revierte la reserva ni cambia la respuesta (RN-14).

### 9. Front: la URL es el estado, el total es lo único que hace el cliente

`/reservar` es un Server Component que lee `canchaId`, `fecha` y `horaInicio` de `searchParams` (asíncronos en esta versión de Next) y pide con `apiFetch` y el token de `leerToken()` la cancha y `GET /equipamiento?disciplinaId=&fecha=&horaInicio=`, que **ya devuelve `stockDisponible` por turno**: el máximo de cada selector sale de ahí, no de una cuenta propia. Parámetros faltantes o mal formados no se mandan a la API: la pantalla explica que hay que elegir un turno y ofrece ir a la disponibilidad.

El formulario es un Client Component con `useActionState` sobre una server action, siguiendo el patrón de `app/(auth)/acciones.ts`: `ApiHttpError.message` —que es el `titulo`, el texto apto para la persona— va al estado, junto con los valores para no perder lo cargado. El único cálculo del cliente es el total a la vista, con la aclaración de que el monto que vale es el que confirma la API.

**La confirmación se muestra en la misma pantalla**, con el código, la cancha, el día, el horario y el total. No redirige a `/mis-reservas` porque esa pantalla es de 1.4 y hoy daría 404; cuando 1.4 entre, se cambia el acceso.

*Alternativa descartada*: que el front recalcule la grilla para validar la hora antes de mandar. Duplica la regla y no evita el 422, porque el turno puede ocuparse igual. La pantalla confía en la API y muestra bien el error.

### 10. Tests

- **Unitarios** (`reservas.service.spec.ts`, `codigo.spec.ts`, `dto/dto.spec.ts`), con Prisma y `Reloj` mockeados: el orden de validaciones de la decisión 1 caso por caso, el cálculo de montos en `Decimal`, el formato del código con el prefijo por defecto y con uno configurado, y los rechazos del DTO (`clienteId` de más, `cantidadJugadores: 0`, ítem repetido).
- **e2e** (`apps/api/test/reservas.e2e-spec.ts`), un `describe` por requisito y un `it` por `#### Scenario:`, incluido el de las dos solicitudes en paralelo con `Promise.all`. `Reloj` se reemplaza con `overrideProvider` para los escenarios de hoy, del pasado y del horizonte; los de sábado y domingo se fijan eligiendo la fecha. Datos propios con prefijo `e2e-…` y usuario `@e2e.test`, borrados al terminar, y **en serie**: el ítem 1.2 ya descubrió que en paralelo los e2e se pisan contra la misma base.

## Risks / Trade-offs

- **[El lock de `equipamiento` lo va a compartir `PATCH /equipamiento` (1.6)]** → Las dos transacciones son cortas y el lock es por fila; se documenta en la memoria para que 1.6 no lo descubra depurando. Si alguna vez molesta, la alternativa es mover el lock a una tabla de stock por turno, que es un cambio de modelo y no entra acá.
- **[Discriminar `P2002` depende de `meta.target`, que es un detalle de Prisma]** → Se aísla en una función con nombre (`esViolacionDe(error, COLUMNAS_SLOT_ACTIVO)`) y se cubre con el e2e de concurrencia, que es el que fallaría si Prisma cambiara la forma del error. Que informe columnas y no el nombre del índice se comprobó con una sonda contra la base antes de escribir el helper.
- **[La spec de RN-09 se modifica y la implementación se escribe en el mismo cambio]** → Es el motivo por el que el delta va en este PR y no aparte: hoy la spec no dice qué pasa un domingo y la API tiene que responder algo. Los dos escenarios nuevos son los que el equipo revisa en la propuesta.
- **[`CANCELACION_MINUTOS_MINIMOS` entra sin consumidor]** → Queda con default, validación y su unitario, y anotada como insumo de 1.4. Es código que no se ejecuta en ninguna ruta de este cambio; la alternativa era dejar la variable en el `.env.example` sin que nadie la lea, que es peor.
- **[El total del front puede diferir del de la API si alguien cambia un precio en el medio]** → Es RN-06 funcionando: el monto que vale es el que devuelve el 201, y la pantalla lo dice y muestra el confirmado.

## Migration Plan

No hay migración de base: las tablas, el enum y el índice de RN-01 ya existen. Las cuatro variables tienen default, así que ningún `.env` ni el CI dejan de funcionar. Se despliega con el merge del PR a `main`; si algo falla se revierte el merge, sin rastros en la base más allá de las reservas creadas, que son datos válidos.

## Open Questions

Ninguna que cambie la spec, el enfoque o las tareas.
