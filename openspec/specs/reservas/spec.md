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
La hora de inicio pedida MUST coincidir con el inicio de uno de los turnos que el horario de atención genera para la disciplina de la cancha **en el día pedido**, de modo que la reserva empiece en o después de la apertura, termine en o antes del cierre que le corresponde a ese día y no se superponga parcialmente con otro turno de la misma cancha. El cierre MUST ser el del día: `HORA_CIERRE` de lunes a viernes y `HORA_CIERRE_SABADO` los sábados. En un día enumerado en `DIAS_CERRADOS` ninguna cancha MUST admitir reservas, cualquiera sea la hora pedida.

#### Scenario: Hora que no coincide con un turno
- **WHEN** se intenta reservar una cancha de tenis a las 19:15, o una cancha de pádel a las 09:00
- **THEN** se devuelve 422 con `tipo` `HORARIO_FUERA_DE_TURNO` y no se crea ninguna reserva

#### Scenario: Hora fuera del horario de atención
- **WHEN** se intenta reservar una cancha de tenis a las 07:00 con apertura a las 08:00
- **THEN** se devuelve 422 con `tipo` `HORARIO_FUERA_DE_TURNO`

#### Scenario: Sábado después del cierre propio
- **WHEN** se intenta reservar una cancha de tenis un sábado a las 19:00, con `HORA_CIERRE_SABADO` en 18:00
- **THEN** se devuelve 422 con `tipo` `HORARIO_FUERA_DE_TURNO`, aunque ese mismo turno sea reservable de lunes a viernes

#### Scenario: Día cerrado
- **WHEN** se intenta reservar un domingo y `DIAS_CERRADOS` incluye el 0
- **THEN** se devuelve 422 con `tipo` `HORARIO_FUERA_DE_TURNO` y no se crea ninguna reserva

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

### Requirement: Pantalla de mis reservas y su detalle

El sitio MUST ofrecer en `/mis-reservas` un listado de las reservas del usuario con sesión, separado en una pestaña de activas y una de historial (canceladas y completadas), cada una con el código, la cancha, el día y horario, el estado y el monto total. Desde cada reserva MUST poder accederse a su detalle, con el desglose de equipamiento, el monto total y, si la reserva todavía puede cancelarse (RN-04), un botón para cancelarla; si no puede cancelarse, MUST mostrarse el motivo en lugar del botón. El detalle MUST ofrecer además un botón para reenviar el mail de la reserva. Si el usuario no tiene ninguna reserva, la pantalla MUST mostrarlo con un mensaje en lugar de una lista vacía sin explicación. Si la API no responde, la pantalla MUST mostrar un aviso con la opción de reintentar.

#### Scenario: Listado con activas e historial
- **WHEN** un SOCIO con reservas `CONFIRMADA`, `CANCELADA` y `COMPLETADA` entra a `/mis-reservas`
- **THEN** la pestaña de activas muestra solo la `CONFIRMADA` y la de historial muestra la `CANCELADA` y la `COMPLETADA`

#### Scenario: Acceso al detalle
- **WHEN** el usuario elige "Ver detalle" en una de sus reservas
- **THEN** llega a `/mis-reservas/{id}` con el desglose de equipamiento, cantidad, precio unitario y el monto total de esa reserva

#### Scenario: Cancelación dentro del plazo
- **WHEN** el detalle es de una reserva `CONFIRMADA` que empieza en más de `CANCELACION_MINUTOS_MINIMOS`
- **THEN** se ve el botón "Cancelar esta reserva"

#### Scenario: Fuera del plazo de cancelación
- **WHEN** el detalle es de una reserva `CONFIRMADA` que empieza dentro de `CANCELACION_MINUTOS_MINIMOS`
- **THEN** no se ve el botón de cancelar y en su lugar se explica que ya no se puede cancelar

#### Scenario: Cancelación exitosa
- **WHEN** el usuario confirma "Cancelar esta reserva" y la API la cancela con éxito
- **THEN** el detalle pasa a mostrar el estado `CANCELADA` y esa reserva se mueve a la pestaña de historial

#### Scenario: Reenvío del mail
- **WHEN** el usuario elige "Reenviar el mail" en el detalle
- **THEN** se muestra la confirmación de que se reenvió, sin abandonar la pantalla

#### Scenario: Sin reservas
- **WHEN** un usuario sin ninguna reserva entra a `/mis-reservas`
- **THEN** la pantalla explica que todavía no reservó ningún turno, en lugar de mostrar una lista vacía

#### Scenario: API sin respuesta
- **WHEN** la API no responde en 2 segundos al pedir el listado o el detalle
- **THEN** la pantalla muestra un aviso con un botón para reintentar, y el header y el pie siguen visibles

### Requirement: Pantalla de reservas del administrador
El sitio MUST ofrecer en `/admin/reservas` el listado de las reservas de todos los usuarios. Cada reserva MUST mostrar el titular, el código, la cancha, el día y horario, el estado y el monto total. El listado MUST poder filtrarse por estado (todas, activas o canceladas) y por fecha, y MUST poder buscarse por nombre del titular o por código; los filtros y la búsqueda MUST reflejarse en la dirección, para que el listado filtrado se pueda recargar o compartir. Si ninguna reserva coincide, MUST decirlo con un mensaje. Desde cada reserva MUST poder accederse a su detalle en `/admin/reservas/{id}`, con el titular, el desglose de equipamiento y el monto total. Desde el detalle, un ADMIN MUST poder cancelar una reserva `CONFIRMADA` cuyo turno no terminó **sin el plazo mínimo de RN-04**, con un motivo opcional, y MUST poder reenviar el mail de la reserva al titular; el resultado de cada acción MUST mostrarse sin abandonar la pantalla. Las dos pantallas MUST estar disponibles solo para usuarios con rol `ADMIN`, con el mismo comportamiento que el panel ante un visitante sin sesión o una sesión de otro rol. Si la API no responde, MUST mostrar un aviso con la opción de reintentar.

#### Scenario: Listado de todas las reservas
- **WHEN** un ADMIN entra a `/admin/reservas` y hay reservas de dos socios distintos
- **THEN** ve las reservas de los dos, cada una con el nombre de su titular

#### Scenario: Filtro por estado
- **WHEN** un ADMIN elige el filtro "Canceladas"
- **THEN** el listado muestra solo reservas `CANCELADA` y la dirección refleja el filtro

#### Scenario: Búsqueda por código
- **WHEN** un ADMIN busca el código de una reserva existente
- **THEN** el listado muestra solo esa reserva

#### Scenario: Sin resultados
- **WHEN** la búsqueda o los filtros no coinciden con ninguna reserva
- **THEN** la pantalla explica que no hay reservas que coincidan, en lugar de mostrar una lista vacía

#### Scenario: Cancelación fuera del plazo del socio
- **WHEN** un ADMIN abre el detalle de una reserva `CONFIRMADA` de un socio que empieza dentro de 30 minutos y la cancela
- **THEN** el detalle pasa a mostrar el estado `CANCELADA`

#### Scenario: Reserva que ya no se puede cancelar
- **WHEN** un ADMIN abre el detalle de una reserva `CANCELADA` o `COMPLETADA`
- **THEN** no se ve el botón de cancelar

#### Scenario: Reenvío del mail desde la administración
- **WHEN** un ADMIN elige "Reenviar el mail" en el detalle de la reserva de un socio
- **THEN** se muestra la confirmación con el mail del titular como destinatario, sin abandonar la pantalla

#### Scenario: Socio en la administración de reservas
- **WHEN** un SOCIO con sesión entra a `/admin/reservas` o a `/admin/reservas/{id}`
- **THEN** ve un aviso de que la sección es solo para administradores, sin ninguna reserva

#### Scenario: API sin respuesta
- **WHEN** la API no responde en 2 segundos al pedir el listado o el detalle
- **THEN** la pantalla muestra un aviso con un botón para reintentar, y el header y el pie siguen visibles

### Requirement: Pantalla de reserva
El sitio MUST ofrecer en `/reservar` la confirmación de un turno elegido, disponible solo para quien tenga sesión. El turno MUST tomarse de la dirección (cancha, fecha y hora de inicio), y la pantalla MUST mostrar la cancha con su disciplina, el día, el horario de inicio y fin y el precio del turno antes de confirmar. MUST permitir informar una cantidad de jugadores opcional y elegir equipamiento, ofreciendo de cada ítem como máximo las unidades disponibles en ese turno. MUST mostrar el total a pagar actualizado con lo que se va eligiendo, aclarando que el monto que vale es el que confirma la API. Cuando la API rechaza la reserva, la pantalla MUST mostrar el título del error y conservar lo que la persona había cargado. Cuando la acepta, MUST mostrar el código de la reserva. Si faltan datos del turno en la dirección o la API no responde, la pantalla MUST orientar a la persona en lugar de mostrar una página rota.

#### Scenario: Turno elegido desde la disponibilidad
- **WHEN** un socio llega a `/reservar?canchaId=<id>&fecha=<fecha>&horaInicio=20:00` desde la grilla de disponibilidad
- **THEN** ve la cancha con su disciplina, el día, el turno de 20:00 a su hora de fin y el precio del turno, con un botón para confirmar

#### Scenario: Visitante sin sesión
- **WHEN** alguien sin sesión abre `/reservar` con un turno en la dirección
- **THEN** es llevado a ingresar y, después de ingresar, vuelve a esa misma pantalla de reserva

#### Scenario: Equipamiento acotado al stock del turno
- **WHEN** en ese turno quedan 2 unidades de un ítem de equipamiento de la disciplina de la cancha
- **THEN** la pantalla ofrece ese ítem con un máximo de 2 unidades, y no ofrece equipamiento de otras disciplinas

#### Scenario: Total a la vista
- **WHEN** el socio elige 2 unidades de un ítem que cuesta 2500 por turno, en una cancha de 14000
- **THEN** la pantalla muestra un total de 19000 antes de confirmar

#### Scenario: Reserva confirmada
- **WHEN** el socio confirma un turno libre con datos válidos
- **THEN** ve la confirmación con el código de la reserva, la cancha, el día, el horario y el total, y un acceso para volver a la disponibilidad

#### Scenario: El turno se ocupó mientras completaba
- **WHEN** el socio confirma un turno que otra persona reservó mientras él completaba el formulario
- **THEN** ve el título del error que devolvió la API, sigue viendo lo que había elegido y puede volver a la disponibilidad a elegir otro turno

#### Scenario: Regla de negocio rechazada
- **WHEN** un socio que ya tiene el máximo de reservas activas confirma una más
- **THEN** ve el título del error que devolvió la API y la pantalla no muestra ninguna reserva creada

#### Scenario: Turno ausente o mal formado en la dirección
- **WHEN** se abre `/reservar` sin cancha, sin fecha o con una hora mal formada
- **THEN** la pantalla explica que hay que elegir un turno y ofrece ir a la disponibilidad, sin mostrar un error de la API

#### Scenario: API sin respuesta
- **WHEN** la API no responde al preparar la pantalla
- **THEN** se muestra un aviso con la opción de reintentar, y el header y el pie siguen visibles
