# reservas Specification

## Purpose
Gestionar el ciclo de vida de una reserva de cancha: su creación con todas las validaciones de negocio y el cálculo del monto, la consulta acotada según el rol y la cancelación con plazo, sin borrar nunca el registro.

## Requirements

### Requirement: Creación de reserva a nombre del usuario autenticado
El sistema MUST permitir que un usuario con rol `SOCIO` o `ADMIN` cree una reserva indicando cancha, fecha, hora de inicio y, opcionalmente, cantidad de jugadores y equipamiento. El titular de la reserva MUST ser siempre el usuario identificado por el `sub` del token; el cuerpo de la solicitud MUST NOT poder indicar otro titular. La hora de fin MUST calcularse a partir de la duración de turno de la disciplina de la cancha. Toda reserva creada MUST quedar en estado `CONFIRMADA`.

#### Scenario: Reserva de un turno libre
- **WHEN** un SOCIO envía `POST /reservas` para un turno libre de Pádel 1 el día de mañana a las 20:00, con datos válidos
- **THEN** se devuelve 201 con header `Location` apuntando a la reserva, `estado` `CONFIRMADA`, `clienteId` igual a su id, `horaFin` 21:30, un `codigo` y el `montoTotal` calculado

#### Scenario: Creación sin token
- **WHEN** se envía `POST /reservas` sin header `Authorization`
- **THEN** se devuelve 401 con `tipo` `NO_AUTENTICADO` y no se crea ninguna reserva

#### Scenario: Intento de reservar a nombre de otro
- **WHEN** un SOCIO envía `POST /reservas` con datos válidos y además un campo `clienteId` con el id de otro usuario
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA` y no se crea ninguna reserva

#### Scenario: Cancha inexistente o inactiva
- **WHEN** se envía `POST /reservas` con un `canchaId` que no existe o que corresponde a una cancha inactiva
- **THEN** se devuelve 404 con `tipo` `NO_ENCONTRADO`

### Requirement: Código de reserva legible
Cada reserva MUST tener un código único con el formato `<prefijo>-XXXXXX`, donde el prefijo MUST tomarse de la configuración `PREFIJO_CODIGO_RESERVA` (por defecto `RES`) y `XXXXXX` MUST ser una secuencia de 6 caracteres alfanuméricos en mayúscula.

#### Scenario: Código con el prefijo por defecto
- **WHEN** `PREFIJO_CODIGO_RESERVA` no está configurado y se crea una reserva
- **THEN** el `codigo` de la reserva cumple el patrón `^RES-[A-Z0-9]{6}$`

#### Scenario: Código con prefijo configurado
- **WHEN** `PREFIJO_CODIGO_RESERVA` vale `CUM` y se crea una reserva
- **THEN** el `codigo` de la reserva cumple el patrón `^CUM-[A-Z0-9]{6}$`

#### Scenario: Códigos distintos
- **WHEN** se crean dos reservas
- **THEN** sus códigos son distintos

### Requirement: Un solo turno activo por cancha (RN-01)
Una cancha MUST NOT tener dos reservas no canceladas con la misma fecha y hora de inicio. Esta garantía MUST sostenerse aun ante solicitudes concurrentes, por lo que MUST estar respaldada por una restricción de la base de datos y no solo por una validación previa. Un turno cuya reserva se canceló MUST poder reservarse de nuevo.

#### Scenario: Turno ya reservado
- **WHEN** existe una reserva CONFIRMADA en la Cancha 1 de tenis mañana a las 19:00 y otro usuario intenta reservar ese mismo turno
- **THEN** se devuelve 409 con `tipo` `SLOT_NO_DISPONIBLE`

#### Scenario: Dos solicitudes simultáneas por el mismo turno
- **WHEN** se envían en paralelo dos `POST /reservas` válidos para la misma cancha, fecha y hora de inicio
- **THEN** exactamente una respuesta es 201, la otra es 409 con `tipo` `SLOT_NO_DISPONIBLE`, y existe una sola reserva no cancelada para ese turno

#### Scenario: Turno liberado por una cancelación
- **WHEN** la reserva de la Cancha 1 de tenis mañana a las 19:00 se cancela y otro usuario reserva ese turno
- **THEN** se devuelve 201

### Requirement: Turno dentro de la grilla y del horario de atención (RN-09)
La hora de inicio pedida MUST coincidir con el inicio de uno de los turnos que el horario de atención genera para la disciplina de la cancha, de modo que la reserva empiece en o después de la apertura, termine en o antes del cierre y no se superponga parcialmente con otro turno de la misma cancha.

#### Scenario: Hora que no coincide con un turno
- **WHEN** se intenta reservar una cancha de tenis a las 19:15, o una cancha de pádel a las 09:00
- **THEN** se devuelve 422 con `tipo` `HORARIO_FUERA_DE_TURNO` y no se crea ninguna reserva

#### Scenario: Hora fuera del horario de atención
- **WHEN** se intenta reservar una cancha de tenis a las 07:00 con apertura a las 08:00
- **THEN** se devuelve 422 con `tipo` `HORARIO_FUERA_DE_TURNO`

### Requirement: Fecha y hora reservables (RN-02, RN-03)
"Hoy" y "ahora" MUST evaluarse en la hora local del club. El sistema MUST rechazar reservas cuyo inicio sea anterior al momento actual y reservas para una fecha posterior a hoy más `HORIZONTE_RESERVA_DIAS` (30 por defecto). El límite del horizonte MUST ser inclusivo.

#### Scenario: Horario ya transcurrido
- **WHEN** son las 14:00 en la hora local del club y se intenta reservar hoy a las 10:00
- **THEN** se devuelve 422 con `tipo` `FECHA_EN_EL_PASADO`

#### Scenario: Fecha más allá del horizonte
- **WHEN** se intenta reservar para dentro de 31 días con `HORIZONTE_RESERVA_DIAS` en 30
- **THEN** se devuelve 422 con `tipo` `HORIZONTE_EXCEDIDO`

#### Scenario: Último día del horizonte
- **WHEN** se intenta reservar un turno libre para dentro de exactamente 30 días con `HORIZONTE_RESERVA_DIAS` en 30
- **THEN** se devuelve 201

### Requirement: Límite de reservas activas por socio (RN-07)
Un usuario con rol `SOCIO` MUST NOT tener más de `MAX_RESERVAS_ACTIVAS_SOCIO` (3 por defecto) reservas activas al mismo tiempo. Una reserva está activa cuando su estado es `CONFIRMADA` y su turno todavía no terminó. El límite MUST NOT aplicarse a usuarios con rol `ADMIN`.

#### Scenario: Cuarta reserva de un socio
- **WHEN** un SOCIO con 3 reservas activas intenta crear una cuarta
- **THEN** se devuelve 422 con `tipo` `LIMITE_RESERVAS_ACTIVAS` y no se crea la reserva

#### Scenario: Administrador sin límite
- **WHEN** un ADMIN con 5 reservas activas crea otra reserva válida
- **THEN** se devuelve 201

#### Scenario: Reservas canceladas y ya jugadas no cuentan
- **WHEN** un SOCIO tiene 2 reservas activas, 1 reserva cancelada y 1 reserva cuyo turno ya terminó, e intenta crear una reserva válida
- **THEN** se devuelve 201

### Requirement: Equipamiento de la reserva (RN-05, RN-08)
Cada ítem de equipamiento pedido MUST pertenecer a la misma disciplina que la cancha y MUST tener stock suficiente en el turno: las unidades pedidas MUST NOT superar `stockTotal` menos las unidades de ese ítem ya alquiladas en reservas no canceladas de la misma fecha y hora de inicio, en cualquier cancha. Si algún ítem no cumple, la reserva completa MUST NOT crearse. Un mismo ítem MUST NOT repetirse en la solicitud.

#### Scenario: Stock insuficiente en el turno
- **WHEN** hay 2 paletas de pádel disponibles mañana a las 20:00 y se intenta reservar ese turno pidiendo 4
- **THEN** se devuelve 409 con `tipo` `STOCK_INSUFICIENTE` y no se crea la reserva

#### Scenario: Stock consumido desde otra cancha
- **WHEN** una reserva en Pádel 1 mañana a las 20:00 alquila 4 de las 6 paletas, y se intenta reservar Pádel 2 en el mismo turno pidiendo 3 paletas
- **THEN** se devuelve 409 con `tipo` `STOCK_INSUFICIENTE`

#### Scenario: Equipamiento de otra disciplina
- **WHEN** se intenta reservar una cancha de tenis pidiendo paletas de pádel
- **THEN** se devuelve 422 con `tipo` `EQUIPAMIENTO_DE_OTRA_DISCIPLINA` y no se crea la reserva

#### Scenario: Equipamiento inexistente o dado de baja
- **WHEN** se intenta reservar pidiendo un `equipamientoId` que no existe o que corresponde a un ítem inactivo
- **THEN** se devuelve 404 con `tipo` `NO_ENCONTRADO`

#### Scenario: Ítem repetido
- **WHEN** la solicitud incluye dos veces el mismo `equipamientoId`
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA`

### Requirement: Monto calculado con precio plano y congelado (RN-06)
El monto MUST calcularse en el servidor: `montoCancha` MUST ser el `precioPorTurno` de la cancha, `montoEquipamiento` la suma de cantidad por precio por turno de cada ítem, y `montoTotal` la suma de ambos. La cantidad de jugadores MUST NOT intervenir en el cálculo; es un dato opcional e informativo que MUST ser un entero mayor o igual a 1 cuando se envía. Los montos y el precio unitario de cada ítem MUST persistirse en la reserva, y cambios posteriores de precios MUST NOT modificarlos.

#### Scenario: Monto con equipamiento
- **WHEN** se reserva Pádel 1, con `precioPorTurno` 14000, pidiendo 2 paletas con `precioPorTurno` 2500
- **THEN** la reserva tiene `montoCancha` 14000, `montoEquipamiento` 5000 y `montoTotal` 19000

#### Scenario: La cantidad de jugadores no cambia el precio
- **WHEN** se crean dos reservas en la misma cancha de tenis, una con `cantidadJugadores` 2 y otra con `cantidadJugadores` 4
- **THEN** ambas tienen el mismo `montoCancha`, igual al `precioPorTurno` de la cancha

#### Scenario: Cantidad de jugadores no habitual
- **WHEN** se reserva una cancha de tenis con `cantidadJugadores` 3
- **THEN** se devuelve 201 y la reserva registra `cantidadJugadores` 3

#### Scenario: Sin cantidad de jugadores
- **WHEN** se reserva un turno libre sin enviar `cantidadJugadores`
- **THEN** se devuelve 201 y la reserva informa `cantidadJugadores` nulo

#### Scenario: Cantidad de jugadores inválida
- **WHEN** se intenta reservar con `cantidadJugadores` 0
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA`

#### Scenario: Cambio de precio posterior
- **WHEN** después de crear una reserva se modifica el `precioPorTurno` de su cancha y de su equipamiento
- **THEN** la reserva conserva su `montoCancha`, `montoEquipamiento`, `montoTotal` y el `precioUnitario` de cada ítem originales

### Requirement: Listado de reservas acotado por rol (RN-13)
El sistema MUST listar reservas solo a usuarios autenticados. Un `SOCIO` MUST recibir únicamente sus propias reservas, aunque envíe `clienteId` de otro usuario. Un `ADMIN` MUST recibir las de todos, o solo las del cliente indicado en `clienteId`. El listado MUST poder filtrarse por `fecha` y `estado`. Cada reserva del listado y del detalle MUST incluir el nombre y apellido del titular en `cliente`. Una reserva `CONFIRMADA` cuyo turno ya terminó MUST informarse con estado `COMPLETADA`.

#### Scenario: Socio sin filtros
- **WHEN** un SOCIO envía `GET /reservas`
- **THEN** se devuelve 200 y todas las reservas de la respuesta tienen `clienteId` igual a su id

#### Scenario: Socio que pide reservas de otro
- **WHEN** un SOCIO envía `GET /reservas?clienteId=<id de otro usuario>`
- **THEN** se devuelve 200 y la respuesta contiene solo las reservas del propio SOCIO

#### Scenario: Administrador filtra por cliente
- **WHEN** un ADMIN envía `GET /reservas?clienteId=42`
- **THEN** se devuelve 200 con las reservas cuyo `clienteId` es 42

#### Scenario: Nombre del titular en el listado
- **WHEN** un ADMIN lista reservas y una pertenece al socio Bruno Socio
- **THEN** esa reserva incluye `cliente` "Bruno Socio"

#### Scenario: Filtro por estado
- **WHEN** un usuario envía `GET /reservas?estado=CANCELADA`
- **THEN** todas las reservas de la respuesta tienen `estado` `CANCELADA`

#### Scenario: Reserva ya jugada
- **WHEN** una reserva CONFIRMADA tiene su turno terminado y el titular lista sus reservas
- **THEN** esa reserva aparece con `estado` `COMPLETADA`, y aparece al filtrar por `estado=COMPLETADA` pero no al filtrar por `estado=CONFIRMADA`

#### Scenario: Listado sin token
- **WHEN** se envía `GET /reservas` sin header `Authorization`
- **THEN** se devuelve 401 con `tipo` `NO_AUTENTICADO`

### Requirement: Detalle de reserva sin revelar reservas ajenas (RN-13)
El sistema MUST devolver el detalle de una reserva a su titular o a un `ADMIN`, incluyendo el desglose de equipamiento con cantidad, precio unitario y subtotal de cada ítem. Cuando un `SOCIO` pide una reserva que existe pero no le pertenece, la respuesta MUST ser indistinguible de la de una reserva inexistente.

#### Scenario: Detalle con equipamiento
- **WHEN** el titular consulta `GET /reservas/{id}` de una reserva con 2 paletas
- **THEN** se devuelve 200 y `equipamiento` incluye el ítem con `cantidad` 2, `precioUnitario` y `subtotal`

#### Scenario: Reserva ajena
- **WHEN** un SOCIO consulta `GET /reservas/{id}` de una reserva de otro usuario
- **THEN** se devuelve 404 con `tipo` `NO_ENCONTRADO`, el mismo cuerpo que ante un id inexistente salvo `instancia`

#### Scenario: Reserva inexistente
- **WHEN** se consulta `GET /reservas/{id}` con un id que no existe
- **THEN** se devuelve 404 con `tipo` `NO_ENCONTRADO`

#### Scenario: Administrador consulta una reserva ajena
- **WHEN** un ADMIN consulta `GET /reservas/{id}` de una reserva de otro usuario
- **THEN** se devuelve 200 con el detalle

### Requirement: Cancelación con plazo mínimo (RN-04, RN-13)
El titular de una reserva o un `ADMIN` MUST poder cancelarla, con un motivo opcional de hasta 200 caracteres. Un `SOCIO` MUST cancelar con al menos `CANCELACION_MINUTOS_MINIMOS` (120 por defecto) minutos de anticipación respecto del inicio del turno; el límite MUST ser inclusivo. Un `ADMIN` MUST poder cancelar sin ese plazo, incluso reservas de otros usuarios. Solo las reservas `CONFIRMADA` cuyo turno no terminó MUST poder cancelarse.

#### Scenario: Cancelación con anticipación suficiente
- **WHEN** el titular cancela una reserva CONFIRMADA que empieza dentro de 3 horas
- **THEN** se devuelve 200 con `estado` `CANCELADA`

#### Scenario: Socio fuera de plazo
- **WHEN** un SOCIO intenta cancelar su reserva 90 minutos antes del inicio
- **THEN** se devuelve 422 con `tipo` `PLAZO_CANCELACION_VENCIDO` y la reserva sigue CONFIRMADA

#### Scenario: Límite exacto
- **WHEN** un SOCIO cancela su reserva exactamente 120 minutos antes del inicio
- **THEN** se devuelve 200 con `estado` `CANCELADA`

#### Scenario: Administrador fuera de plazo
- **WHEN** un ADMIN cancela una reserva de otro usuario 90 minutos antes del inicio
- **THEN** se devuelve 200 con `estado` `CANCELADA`

#### Scenario: Reserva ya cancelada
- **WHEN** se intenta cancelar una reserva que ya está CANCELADA
- **THEN** se devuelve 409 con `tipo` `RESERVA_NO_CANCELABLE`

#### Scenario: Reserva ya jugada
- **WHEN** un ADMIN intenta cancelar una reserva cuyo turno ya terminó
- **THEN** se devuelve 409 con `tipo` `RESERVA_NO_CANCELABLE`

#### Scenario: Socio cancela una reserva ajena
- **WHEN** un SOCIO envía `PATCH /reservas/{id}/cancelacion` sobre una reserva de otro usuario
- **THEN** se devuelve 404 con `tipo` `NO_ENCONTRADO` y la reserva no cambia

#### Scenario: Motivo demasiado largo
- **WHEN** se intenta cancelar con un `motivo` de 201 caracteres
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA`

### Requirement: La cancelación conserva el registro (RN-10)
Cancelar MUST NOT eliminar la reserva: MUST marcarla `CANCELADA`, registrar la fecha y hora de cancelación, el motivo si se informó y el usuario que canceló, y liberar el turno y el equipamiento para nuevas reservas.

#### Scenario: Reserva cancelada consultable
- **WHEN** el titular cancela una reserva con `motivo` "Se suspendió por lluvia" y luego consulta su detalle
- **THEN** se devuelve 200 con `estado` `CANCELADA`, `canceladaEn` con la fecha y hora de la cancelación y `motivoCancelacion` "Se suspendió por lluvia"

#### Scenario: Registro de quién canceló
- **WHEN** un ADMIN cancela la reserva de un SOCIO
- **THEN** la reserva queda persistida con el ADMIN como usuario que canceló
