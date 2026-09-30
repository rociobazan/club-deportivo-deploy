# Spec Delta

## ADDED Requirements

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
