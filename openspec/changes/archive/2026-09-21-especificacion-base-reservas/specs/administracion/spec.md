## Purpose

Darle al administrador del club un panel con la actividad de un día: reservas, facturación prevista, cancelaciones, ocupación de las canchas y los próximos turnos, calculados a partir de las reservas y del horario de atención.

## ADDED Requirements

### Requirement: Panel exclusivo del administrador
`GET /admin/panel` MUST estar disponible solo para usuarios con rol `ADMIN`. MUST aceptar un parámetro opcional `fecha`; si no se envía, MUST usar el día de hoy en la hora local del club.

#### Scenario: Consulta del panel por un administrador
- **WHEN** un ADMIN envía `GET /admin/panel` sin `fecha`
- **THEN** se devuelve 200 con el panel del día de hoy y `fecha` igual a la fecha local del club

#### Scenario: Socio sin permiso
- **WHEN** un SOCIO envía `GET /admin/panel`
- **THEN** se devuelve 403 con `tipo` `SIN_PERMISOS`

#### Scenario: Sin token
- **WHEN** se envía `GET /admin/panel` sin header `Authorization`
- **THEN** se devuelve 401 con `tipo` `NO_AUTENTICADO`

#### Scenario: Fecha mal formada
- **WHEN** un ADMIN envía `GET /admin/panel?fecha=14-09-2026`
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA`

### Requirement: Métricas del día
El panel MUST informar, para la fecha consultada: la cantidad de reservas no canceladas cuyo turno es ese día y la misma cantidad para el día anterior; la facturación prevista, igual a la suma de `montoTotal` de esas reservas; y la cantidad de reservas canceladas ese día, según la fecha local de `canceladaEn`, junto con cuántas de ellas se cancelaron con al menos `CANCELACION_MINUTOS_MINIMOS` de anticipación.

#### Scenario: Reservas y facturación
- **WHEN** la fecha consultada tiene 3 reservas no canceladas con `montoTotal` 14000, 9000 y 23000, una reserva cancelada, y el día anterior tuvo 2 reservas no canceladas
- **THEN** el panel informa 3 reservas del día, 2 del día anterior y facturación prevista 46000

#### Scenario: Cancelaciones dentro y fuera del plazo
- **WHEN** ese día se cancelaron dos reservas, una 5 horas antes de su inicio y otra, por un ADMIN, 30 minutos antes
- **THEN** el panel informa 2 cancelaciones, 1 de ellas dentro del plazo

### Requirement: Ocupación de las canchas
El panel MUST informar la ocupación del día, la ocupación promedio de los 7 días que terminan en la fecha consultada y la ocupación de cada cancha activa en esos 7 días. La ocupación MUST calcularse como turnos con reserva no cancelada sobre turnos ofrecidos por las canchas activas según el horario de atención, expresada como porcentaje entero redondeado al más cercano.

#### Scenario: Ocupación del día
- **WHEN** hay 6 canchas activas (2 de tenis y 1 de fútbol 5 con 15 turnos, 3 de pádel con 10 turnos; 75 turnos en total) y las únicas reservas no canceladas del día son 5 en Pádel 1
- **THEN** el panel informa ocupación del día 7

#### Scenario: Ocupación de una cancha en la semana
- **WHEN** Pádel 1 tuvo 5 reservas no canceladas en los 7 días que terminan en la fecha consultada, sobre 70 turnos ofrecidos
- **THEN** la ocupación de Pádel 1 en el panel es 7

#### Scenario: Día sin reservas
- **WHEN** la fecha consultada no tiene reservas no canceladas
- **THEN** el panel informa ocupación del día 0

### Requirement: Próximos turnos
El panel MUST listar las reservas no canceladas de la fecha consultada ordenadas por hora de inicio, con hora de inicio, cancha, disciplina, nombre del titular y cantidad de jugadores. Si la fecha consultada es hoy, MUST incluir solo los turnos que todavía no empezaron.

#### Scenario: Turnos restantes de hoy
- **WHEN** son las 19:40 en la hora local del club y hoy hay reservas no canceladas a las 18:30, 21:30 y 20:00
- **THEN** el panel lista primero la de las 20:00 y después la de las 21:30, y no incluye la de las 18:30

#### Scenario: Otra fecha
- **WHEN** un ADMIN consulta el panel de mañana, que tiene reservas a las 09:00 y a las 18:30
- **THEN** el panel lista las dos, en ese orden
