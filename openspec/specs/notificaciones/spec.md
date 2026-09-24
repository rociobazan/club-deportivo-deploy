# notificaciones Specification

## Purpose
Avisar por mail al titular de una reserva cuando se confirma y cuando se cancela, dejando registro de cada intento de envío, sin que una falla del proveedor de mail pueda deshacer ni impedir la operación que lo originó.

## Requirements

### Requirement: Mail de confirmación de reserva
Después de que una reserva queda persistida, el sistema MUST enviar un mail al titular con asunto `Tu turno en Deploy está confirmado · {codigo}` y con el código, la cancha y su superficie, el día, el horario, la cantidad de jugadores si se informó, el equipamiento, el total a pagar en el club y el plazo de cancelación.

#### Scenario: Reserva creada
- **WHEN** un SOCIO crea una reserva con éxito
- **THEN** se invoca al proveedor de mail una vez, con el mail del SOCIO como destinatario y asunto `Tu turno en Deploy está confirmado · <codigo de la reserva>`

#### Scenario: Contenido del mail de confirmación
- **WHEN** se confirma una reserva de Pádel 1 para 4 jugadores con 2 paletas y `montoTotal` 19000
- **THEN** el cuerpo del mail incluye el código, Pádel 1 y su superficie, el día, el horario de inicio y fin, 4 jugadores, las 2 paletas, el total de 19000 y el plazo de cancelación en horas

#### Scenario: Envío exitoso registrado
- **WHEN** el proveedor acepta el mail de confirmación
- **THEN** queda registrada una notificación de tipo `CONFIRMACION` para esa reserva, en estado `ENVIADA`, con el destinatario y el identificador que devolvió el proveedor

#### Scenario: Operación rechazada
- **WHEN** un intento de crear una reserva termina con 409 o 422
- **THEN** no se invoca al proveedor de mail ni se registra ninguna notificación

### Requirement: Mail de cancelación de reserva
Después de que una cancelación queda persistida, el sistema MUST enviar un mail al titular de la reserva, aunque la haya cancelado un `ADMIN`, con asunto `Cancelamos tu turno en Deploy · {codigo}` y con los datos de la reserva y el motivo si se informó.

#### Scenario: Cancelación por el titular
- **WHEN** el titular cancela su reserva con éxito
- **THEN** se invoca al proveedor de mail con el mail del titular y asunto `Cancelamos tu turno en Deploy · <codigo de la reserva>`, y queda registrada una notificación de tipo `CANCELACION`

#### Scenario: Cancelación por un administrador
- **WHEN** un ADMIN cancela la reserva de un SOCIO
- **THEN** el destinatario del mail de cancelación es el SOCIO titular, no el ADMIN

### Requirement: El envío nunca revierte la operación (RN-14)
El envío MUST intentarse recién cuando la operación de base de datos quedó confirmada, fuera de esa transacción. Una falla del proveedor MUST NOT cambiar la respuesta ni el estado de la reserva; MUST registrarse como notificación en estado `FALLIDA` con el error, y MUST quedar en el log de la aplicación.

#### Scenario: Proveedor caído al crear
- **WHEN** el proveedor de mail devuelve error al enviar la confirmación de una reserva válida
- **THEN** la respuesta sigue siendo 201, la reserva queda CONFIRMADA y se registra una notificación `CONFIRMACION` en estado `FALLIDA` con el error

#### Scenario: Proveedor caído al cancelar
- **WHEN** el proveedor de mail devuelve error al enviar el aviso de una cancelación válida
- **THEN** la respuesta sigue siendo 200, la reserva queda CANCELADA y se registra una notificación `CANCELACION` en estado `FALLIDA` con el error

### Requirement: Reenvío del mail de una reserva
El titular de una reserva o un `ADMIN` MUST poder pedir que se reenvíe el mail que corresponde a su estado actual: el de confirmación si la reserva está activa, o el de cancelación si está `CANCELADA`. El destinatario MUST ser siempre el titular. Una reserva `COMPLETADA` MUST NOT admitir reenvío. Cada reserva MUST admitir como máximo 3 reenvíos por hora. Cada reenvío MUST quedar registrado como notificación marcada como reenvío, con estado `ENVIADA` o `FALLIDA`; una falla del proveedor MUST NOT cambiar la respuesta.

#### Scenario: Reenvío de la confirmación
- **WHEN** el titular envía `POST /reservas/{id}/reenvio-mail` sobre una reserva CONFIRMADA de mañana
- **THEN** se devuelve 202, se invoca al proveedor con el mail del titular y asunto `Tu turno en Deploy está confirmado · <codigo de la reserva>`, y se registra una notificación `CONFIRMACION` marcada como reenvío

#### Scenario: Reenvío del aviso de cancelación
- **WHEN** el titular pide el reenvío de una reserva CANCELADA
- **THEN** se devuelve 202 y se reenvía el mail con asunto `Cancelamos tu turno en Deploy · <codigo de la reserva>`

#### Scenario: Reserva ya jugada
- **WHEN** se pide el reenvío de una reserva cuyo turno ya terminó
- **THEN** se devuelve 409 con `tipo` `REENVIO_NO_DISPONIBLE` y no se envía nada

#### Scenario: Reenvío pedido por un administrador
- **WHEN** un ADMIN pide el reenvío de la reserva activa de un SOCIO
- **THEN** se devuelve 202 y el destinatario es el SOCIO titular

#### Scenario: Reserva ajena
- **WHEN** un SOCIO pide el reenvío de una reserva de otro usuario
- **THEN** se devuelve 404 con `tipo` `NO_ENCONTRADO` y no se envía nada

#### Scenario: Cuarto reenvío en una hora
- **WHEN** ya se hicieron 3 reenvíos de una reserva en la última hora y se pide otro
- **THEN** se devuelve 429 con `tipo` `DEMASIADAS_SOLICITUDES` y no se envía nada

#### Scenario: Proveedor caído al reenviar
- **WHEN** el proveedor de mail devuelve error durante un reenvío válido
- **THEN** se devuelve 202 y queda registrada la notificación en estado `FALLIDA` con el error

### Requirement: Sin envíos reales en los tests
Cuando la aplicación corre en el entorno de test, el cliente de mail MUST estar reemplazado por un doble y MUST NOT realizarse ninguna llamada de red al proveedor.

#### Scenario: Suite de tests
- **WHEN** se ejecutan los tests de la API
- **THEN** ninguna prueba realiza llamadas de red al proveedor de mail y los envíos se verifican contra el doble
