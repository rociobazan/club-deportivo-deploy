# Spec Delta

## ADDED Requirements

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
