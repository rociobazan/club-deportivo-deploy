# Design

## Context

La motivación está en `proposal.md`. Lo que condiciona el cómo:

- **El comportamiento ya está especificado**: los cuatro requisitos del panel en `openspec/specs/administracion/spec.md`, *Administración de canchas* y *Administración de equipamiento* en `catalogo`, y la cancelación y el reenvío por un ADMIN en `reservas` y `notificaciones`. El delta de este cambio suma las pantallas y el 409 por nombre repetido.
- **Lo que ya existe y no se reescribe**:
  - `GET /canchas?incluirInactivas=true` y `GET /equipamiento?incluirInactivos=true` ya están implementados en `CatalogoService`, con `exigirRol()`.
  - `PATCH /reservas/{id}/cancelacion` ya deja cancelar a un ADMIN sin el plazo de RN-04, y `POST /reservas/{id}/reenvio-mail` ya acepta a un ADMIN y le manda el mail al titular. Las pantallas de admin **consumen** esas operaciones; la API de reservas no cambia.
  - `GET /reservas` ya devuelve todas las reservas a un ADMIN, con filtros `fecha`, `estado` y `clienteId`, y con el nombre del titular en `cliente`. `estado=CONFIRMADA` ya excluye las que terminaron, porque `COMPLETADA` se deriva al leer.
  - En `common/`: `Reloj` (`ahora(instante)` convierte **cualquier** instante a fecha y hora del club, no solo el presente), `ventanaDelDia`, `generarGrilla`, `sumarDias`, `aFechaDb`/`deFechaDb`, `ErrorDeApi`, `@Roles()` y `recortar`. `ConfiguracionModule` es global y trae `horario` y `cancelacionMinutosMinimos`.
  - En el front: `apiFetch` con `timeoutMs`, `obtenerUsuario()` memoizado por request, `EstadoError`, las primitivas de `components/ui/`, y el menú del ADMIN en `navegacion.ts`. `proxy.ts` ya protege `/admin/:path*`.
- **Hechos verificados en el repo, no supuestos**:
  - `cancha` y `equipamiento` tienen `@@unique([disciplinaId, nombre])` (`schema.prisma`). Hoy nada lo captura: un nombre repetido es un `P2002` sin traducir, o sea un 500.
  - `reservas/errores-de-prisma.ts` ya tiene `esViolacionDe(error, columnas)`, que reconoce un `P2002` por el **conjunto de columnas** que informa Prisma, no por el nombre del índice (decisión 32). Para estos índices, las columnas son `["disciplina_id", "nombre"]`. **Se confirma con una sonda antes de escribir el helper**, como se hizo en 1.3.
  - `reserva.cancelada_en` es un `timestamp` en UTC; `reserva.fecha` es `date` y `hora_inicio` es `HH:MM` en la hora del club. La facturación sale de `monto_total` (`Decimal`).
  - El minutero de "cuánto falta para el turno" está hoy como método privado de `ReservasService` (`minutosHastaElTurno`). El panel lo necesita para contar las cancelaciones dentro del plazo.
  - El contrato está en **2.2.0**: el RF-15 sumó dos operaciones sin cambiar la versión.

## Goals / Non-Goals

**Goals:**

- Que **ningún dato de quien llama termine en un 500**, nombre repetido incluido (decisión 33).
- Que el panel sea **coherente con la disponibilidad**: los mismos turnos que `GET /disponibilidad` ofrece son los que el panel cuenta como ofrecidos, incluidos los sábados más cortos y los domingos cerrados.
- Que el cálculo de la ocupación se pueda testear **sin base**, con los números exactos de los escenarios de la spec.
- Que las pantallas de admin **no dupliquen** la lógica de reservas que ya existe.

**Non-Goals:**

- Paginar `GET /reservas`. La pantalla de admin trae el listado filtrado entero; con el volumen de un club alcanza, y paginar cambiaría el contrato.
- Agregados persistidos o caché del panel. RF-11 pide calcular en cada consulta.
- Historia de las bajas de canchas (ver Riesgos).

## Decisions

### 1. ABM en el módulo `catalogo`; panel en un módulo `administracion` aparte

Las cuatro operaciones del ABM son rutas de `/canchas` y `/equipamiento`, que ya tiene `CatalogoController`, y devuelven los mismos `Cancha` y `Equipamiento` que arman los mapeadores de `catalogo/`. Ponerlas en otro módulo partiría un mismo recurso en dos controladores. El panel, en cambio, lee reservas, canchas y el horario, y no es de ningún recurso: va a un módulo propio, `administracion`, que coincide con la capacidad de OpenSpec.

*Alternativa descartada*: un módulo `administracion` con todo lo de admin adentro. Tendría dos controladores con rutas de `catalogo` y duplicaría los mapeadores o importaría los de `catalogo`, que es justo el acoplamiento que la separación pretendía evitar.

### 2. El nombre repetido lo decide la base: 409 `NOMBRE_DUPLICADO`

Se captura el `P2002` del único `(disciplina_id, nombre)` en `crear` y en `actualizar`, y se responde **409 `NOMBRE_DUPLICADO`**. No se hace un `findFirst` previo: entre la consulta y la escritura entra otra solicitud, y la base igual tendría la última palabra. Es el mismo criterio que RN-01 (decisión 32) y que el mail del perfil (decisión 30).

- `esViolacionDe()` se mueve de `reservas/errores-de-prisma.ts` a `common/errores-de-prisma.ts`, porque ahora lo usan dos módulos. Las constantes de columnas de `reserva` se quedan en `reservas/`; las de `cancha` y `equipamiento` van con el servicio de catálogo.
- El contrato suma la respuesta `409` a las cuatro operaciones y pasa a **2.3.0**, una versión menor, porque el cambio es aditivo.
- **De paso, el contrato declara lo que la API va a rechazar** (observación de la review del #47), para que no acepte en el papel lo que la API responde con 400: `minLength: 1` en el `nombre` de los cuatro request, `maximum: 99999999.99` en `precioPorTurno` (el máximo de `Decimal(10,2)`), con la aclaración de que admite hasta dos decimales en su `description`, y `maximum: 2147483647` en `stockTotal`. Es más restrictivo en el papel, pero no rompe a nadie: las cuatro operaciones todavía no tienen endpoint, así que no hay ningún cliente que dependa de lo que se restringe.
- **El nombre se recorta** (`@Transform(recortar)`) y debe quedar con al menos un carácter: si no, "Pádel 1" y "Pádel 1 " serían dos canchas distintas para la base, y una de "   " no tendría nombre.

*Alternativa descartada*: 400 `SOLICITUD_INVALIDA` sin tocar el contrato. El dato está bien formado; lo que choca es el estado del sistema. Eso es un conflicto, y el repo ya responde 409 en casos iguales (`EMAIL_YA_REGISTRADO`).

### 3. Alta y edición: qué valida el DTO y qué valida el servicio

- **DTO** (400): `disciplinaId` entero entre 1 y `ENTERO_MAXIMO_DB`; `nombre` recortado de 1 a 50 caracteres (60 en equipamiento); `superficie` hasta 30 y `null` permitido en la edición para borrarla; `techada` y `activa`/`activo` booleanos; `precioPorTurno` número mayor que 0 con hasta dos decimales y por debajo del máximo de `Decimal(10,2)`; `stockTotal` entero entre 0 y `ENTERO_MAXIMO_DB`. En la edición, `nombre` lleva `@ValidateIf(v !== undefined)` y no `@IsOptional()`, para que `null` dé 400 y no un 500, igual que el perfil (decisión 33).
- **Edición sin campos**: un `PATCH` vacío responde 400, contando los valores distintos de `undefined` y no las claves, por la trampa que anotó la decisión 30.
- **Servicio** (404): el alta verifica que la disciplina exista y esté activa; la edición verifica que la cancha o el ítem existan. Una edición **no cambia la disciplina**: el contrato no lo permite, y cambiarla rompería RN-08 en las reservas que ya alquilaron ese equipamiento.
- **201 con `Location`**: `/api/v1/canchas/{id}` y `/api/v1/equipamiento/{id}`, con el mismo `@Res({ passthrough: true })` que `POST /reservas`.
- **Dinero**: el precio entra como `number` y se escribe como `Prisma.Decimal` armado desde el string, para que 15000.1 no termine como 15000.099999.

### 4. El panel: tres consultas y una función pura

`AdministracionService.panel(fecha)` resuelve `fecha` (o hoy, con `Reloj`) y hace **tres consultas**:

1. Las canchas **activas** con la duración del turno de su disciplina.
2. Las reservas no canceladas con `fecha` entre `fecha − 6` y `fecha`, más las del día anterior a `fecha` (que ya entra en ese rango), con cancha, disciplina y titular.
3. Las reservas canceladas con `cancelada_en` en una ventana UTC holgada (`fecha − 1` a `fecha + 2`), que **después** se filtran por `reloj.ahora(canceladaEn).fecha === fecha`.

Con eso, una **función pura** `calcularPanel(entrada)` en `administracion/panel.ts` arma el `PanelAdmin` completo. No toca Prisma ni `Reloj`: recibe `ahora`, el horario, las canchas y las reservas ya leídas. Así los escenarios de la spec (75 turnos y 5 reservas → 7; 70 turnos y 5 reservas → 7; 19:40 → 20:00 y 21:30) son unitarios de entrada y salida, y el e2e queda para el contrato, los permisos y la integración con la base.

**Por qué la ventana UTC holgada y no calcular el día exacto en UTC**: convertir "el 15/09 en Córdoba" a un rango UTC exige saber el huso, y el código ya evita esa cuenta (decisión 27): el día de la semana se calcula en UTC sobre la fecha local. Traer tres días de cancelaciones y filtrar con `Reloj.ahora(instante)`, que ya es la conversión oficial del repo, no agrega una segunda forma de convertir zonas. El costo es leer de más las cancelaciones de dos días, que son pocas.

*Alternativa descartada*: una consulta SQL cruda con `AT TIME ZONE` y `GROUP BY`. Más eficiente, pero dejaría la regla de ocupación en SQL, fuera de los unitarios, y con una segunda definición de "turno ofrecido" distinta de la de la disponibilidad.

### 5. Cómo se cuenta la ocupación

- **Turnos ofrecidos** de una cancha en un día = `generarGrilla(ventana.apertura, ventana.cierre, duracion).length`, con `ventanaDelDia(dia, horario)`. Es **la misma cuenta** que hace la disponibilidad, así que un sábado ofrece menos turnos y un domingo cerrado ofrece cero.
- **Turnos ocupados** = reservas no canceladas de **esa cancha activa** ese día. Una reserva de una cancha dada de baja no se cuenta en el numerador, porque su cancha tampoco está en el denominador: si no, el porcentaje podría pasar de 100.
- **Porcentaje** = `Math.round(100 × ocupados / ofrecidos)`, acotado entre 0 y 100. Si `ofrecidos` es 0, el porcentaje es 0 y no se divide.
- **Ocupación del día** = suma de ocupados sobre suma de ofrecidos de todas las canchas, ese día. No es el promedio de los porcentajes de cada cancha: una cancha de pádel con 10 turnos no pesa lo mismo que una de tenis con 15.
- **Promedio de 7 días** = promedio de la ocupación de cada día, **excluyendo los días cerrados** (los que no ofrecen turnos), como pide la spec. Si los 7 estuvieran cerrados, es 0.
- **Por cancha** = suma de ocupados sobre suma de ofrecidos de esa cancha en los 7 días. Una entrada por cancha activa, ordenada por disciplina y nombre, con las de 0 incluidas.

### 6. Las otras métricas

- **Reservas del día y del anterior**: reservas no canceladas con `fecha` igual, de cualquier cancha, activa o no. Una reserva de una cancha dada de baja **sigue existiendo** (RN-15) y se va a cobrar en el club.
- **Facturación prevista**: suma de `montoTotal` de las reservas no canceladas del día, en `Decimal`, y convertida a `number` al final con `aNumero`.
- **Cancelaciones dentro del plazo**: minutos entre `canceladaEn` (convertida a fecha y hora del club) y el inicio del turno, `>= cancelacionMinutosMinimos`. Para eso, `minutosHastaElTurno` sale de `ReservasService` a `common/fechas.ts` como función pura `minutosEntre(desde, hasta)` y la usan los dos, en lugar de quedar copiada.
- **Próximos turnos**: reservas no canceladas del día, ordenadas por `horaInicio`. Si `fecha` es hoy, solo las de `horaInicio > ahora.hora`: una que empieza justo ahora ya empezó.

### 7. Front: un layout de `/admin` que exige el rol

`app/admin/layout.tsx` (Server Component) llama a `obtenerUsuario()` y **solo chequea el rol**: si hay un usuario con un rol distinto de `ADMIN`, muestra el aviso "Esta sección es solo para administradores" **sin renderizar `children`**. Así ninguna de las cuatro pantallas pide datos para un SOCIO. La autorización de verdad sigue siendo el 403 de la API; esto evita que un SOCIO vea una pantalla rota llena de errores.

**El layout no redirige al login** (observación de la review del #47). Un layout de Next no recibe el pathname ni los `searchParams`, así que no podría armar el `volver=` con la subpágina en la que estaba la persona. Los dos casos sin sesión se resuelven en otro lado:

- **Sin cookie**: ya lo resuelve `proxy.ts`, que sí arma el `volver=` con la ruta completa y su query.
- **Con la cookie vencida o inválida**: `obtenerUsuario()` devuelve `null`, el layout renderiza `children` y **la página** recibe el 401 de la API y redirige a `/ingresar?volver=<su ruta>`, que conoce porque es suya. Es lo que ya hacen `/mis-reservas/[id]` y `/perfil`.

**Cada página distingue el 401 del 403**, a diferencia de `/mis-reservas/[id]`, que manda los dos al login. En `/admin`, un 403 quiere decir que la sesión es de un SOCIO: mandarlo a ingresar lo llevaría a un bucle, porque ya está logueado. Así que **401 → `/ingresar?volver=<ruta>`** y **403 → el mismo aviso del layout**, extraído a un componente `AvisoSoloAdmin` que usan los dos. Hace falta en la página aunque el layout ya lo muestre, porque un layout no se vuelve a renderizar al navegar entre sus páginas y el rol puede cambiar entre una navegación y otra.

- *Por qué no en `proxy.ts`*: corre en cada prefetch y solo mira si la cookie existe (decisión 23). Validar el rol ahí exigiría decodificar el JWT en el borde, que es lo que ese archivo evita a propósito.
- *Por qué no `forbidden()` de Next*: es experimental (`authInterrupts`) en Next 16, el mismo motivo por el que no se usó `global-not-found`.
- *Por qué no leer el pathname con `headers()`*: Next no expone la ruta en un header estable, y depender de uno interno (`x-invoke-path`, `next-url`) se rompe en cualquier actualización. La tarea 5.1 lo confirma contra la documentación de la versión instalada.

### 8. Front: cada pantalla

- **`/admin`**: `?fecha=` en la dirección, con el `<Form>` GET de Next como `/disponibilidad`; sin estado en el cliente. Las métricas son tarjetas, la ocupación por cancha es una barra por cancha (como el prototipo) y los próximos turnos una lista con link al detalle de cada reserva en `/admin/reservas/{id}`.
- **`/admin/reservas`**: `estado`, `fecha` y `q` en la dirección. `estado` y `fecha` van a `GET /reservas` tal cual ("Activas" es `estado=CONFIRMADA`); `q` se aplica **en el Server Component** sobre la respuesta, buscando en `cliente` y `codigo` sin distinguir mayúsculas ni acentos. El contrato no tiene búsqueda de texto y no hace falta sumarla para un listado de este tamaño.
- **`/admin/reservas/[id]`**: reutiliza `badgeDe()` y la presentación del detalle de `/mis-reservas/[id]`, extrayendo a un componente compartido lo que hoy es solo de esa página. El botón de cancelar se muestra si la reserva está `CONFIRMADA` (no `COMPLETADA`), **sin** mirar `CANCELACION_MINUTOS_MINIMOS`. Las Server Functions de cancelar y reenviar son las mismas que usa `/mis-reservas`, con el `revalidatePath` de la ruta de admin.
- **`/admin/canchas` y `/admin/equipamiento`**: el listado sale de `GET /canchas?incluirInactivas=true` y `GET /equipamiento?incluirInactivos=true`, más `GET /disciplinas` para el selector del alta y la duración del turno. Cada fila tiene un formulario de edición que se despliega (`<details>`), y la baja y la reactivación son un botón con su propia Server Function. El alta es un formulario arriba del listado. Los formularios usan `useActionState` y se **re-montan con `key`** después de un envío aceptado, como contacto (decisión 25), y ante un error conservan lo cargado.
- **Tipos**: se regenera `schema.d.ts` por el 409 y se suman a `lib/api/types.ts` los alias `OcupacionCancha`, `ProximoTurno`, `CrearCanchaRequest`, `ActualizarCanchaRequest`, `CrearEquipamientoRequest` y `ActualizarEquipamientoRequest`.

### 9. Tests

- **Unitarios**: `calcularPanel` con los escenarios de la spec y los bordes (día cerrado, sábado, cancha dada de baja con reservas, 7 días cerrados, próximo turno que empieza ahora); los DTOs nuevos con el pipe; `CatalogoService` con Prisma mockeado para el 404 y el 409; `minutosEntre`.
- **e2e de la API**: un `it` por escenario de *Administración de canchas*, *Administración de equipamiento* y los cuatro requisitos del panel, con datos propios con prefijo `e2e` y `Reloj` reemplazado donde el escenario fija la hora. Las canchas que crean los tests van con un nombre `e2e …` y se borran al final, porque **cuentan en la ocupación** de los otros tests de panel.
- **Playwright**: `admin.spec.ts` con el ADMIN del seed (`admin@club.test`): el panel carga, un SOCIO ve el aviso, alta, baja y reactivación de una cancha, y cancelación sin plazo desde `/admin/reservas/{id}`. El resto de los escenarios de pantalla se verifican a mano.
  - **La cancha que crea el test no se puede borrar** (observación de la review del #47): la API no tiene ningún `DELETE`, y las specs de `apps/web/e2e` no tienen acceso a la base. Por eso lleva un **nombre único con timestamp** (`E2E-<Date.now()>`), para no chocar con el 409 en una segunda corrida local, y el test la **deja dada de baja** al terminar: después de "Baja y reactivación" la vuelve a dar de baja en un `afterAll`, por la API. Si quedara activa, como `admin.spec.ts` corre primero (orden alfabético, `workers: 1`), aparecería en el catálogo y en la disponibilidad que prueban las specs siguientes. En el CI la base arranca limpia, así que el problema es sobre todo local, donde se acumula una cancha inactiva por corrida, que no se ve en ninguna pantalla pública.

## Risks / Trade-offs

- **[La ocupación de días pasados usa las canchas activas hoy]** → Si se da de baja una cancha, su historia deja de contar, y el promedio de la semana cambia de un día para otro sin que haya cambiado ninguna reserva. Para que fuera exacto haría falta guardar cuándo se dio de baja cada cancha (una migración y un registro de cambios). Se acepta porque la spec define la ocupación sobre las canchas activas, y queda escrito en la pantalla ("canchas activas").
- **[Tests de panel sensibles a los datos de otros tests]** → La ocupación suma **todas** las canchas activas, incluidas las que crean otros e2e. Mitigación: los e2e de panel fijan una fecha propia lejana con `Reloj`, y los de catálogo borran las canchas que crean. Los e2e ya corren en serie (`maxWorkers: 1`).
- **[Bajar el stock por debajo de lo alquilado]** → Es válido por spec (RN-15) y `stockDisponible` se acota a 0. La pantalla no lo impide, pero tampoco lo avisa; se acepta para el MVP.
- **[Listado de reservas sin paginar]** → Con años de reservas sería pesado. Se acepta para el MVP: la API ya devuelve primero las más nuevas, y el filtro por fecha acota el listado cuando haga falta. No se filtra por hoy de entrada, porque la spec pide ver todas las reservas al entrar. Paginar es un cambio de contrato para otro momento.
- **[El layout de `/admin` no es seguridad]** → Es una comodidad de interfaz. Si alguien lo saltea, la API responde 403. Por eso cada página sigue manejando el 401 y el 403 en lugar de confiar en el layout (§7).

## Migration Plan

Sin migración de base: los índices únicos que producen el 409 ya existen. El orden de despliegue es indiferente, porque el contrato solo suma respuestas. Para volver atrás alcanza con revertir el PR; no deja datos que limpiar.
