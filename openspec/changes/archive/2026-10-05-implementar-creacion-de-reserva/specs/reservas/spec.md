# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
