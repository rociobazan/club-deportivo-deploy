# administracion Specification

## Purpose
Darle al administrador del club un panel con la actividad de un día: reservas, facturación prevista, cancelaciones, ocupación de las canchas y los próximos turnos, calculados a partir de las reservas y del horario de atención.

## Requirements

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
El panel MUST informar la ocupación del día, la ocupación promedio de los 7 días que terminan en la fecha consultada y la ocupación de cada cancha activa en esos 7 días. La ocupación MUST calcularse como turnos con reserva no cancelada sobre turnos ofrecidos por las canchas activas según el horario de atención de ese día, expresada como porcentaje entero redondeado al más cercano. Un día en el que el club no abre no ofrece turnos: su ocupación MUST informarse como 0 y MUST NOT contarse en el promedio de los 7 días.

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

### Requirement: Pantalla del panel del club
El sitio MUST ofrecer en `/admin` la pantalla del panel. MUST mostrar, para la fecha consultada, las reservas del día comparadas con las del día anterior, la facturación prevista, las cancelaciones con cuántas fueron dentro del plazo, la ocupación del día con el promedio de 7 días, la ocupación de cada cancha activa en esos 7 días y la lista de próximos turnos. Cada próximo turno MUST mostrar la hora, la cancha, la disciplina, el titular y la cantidad de jugadores si se informó. Sin `fecha` en la dirección, la pantalla MUST mostrar el día de hoy en la hora local del club; MUST ofrecer elegir otra fecha, que se refleja en la dirección como `?fecha=YYYY-MM-DD`. Si no hay próximos turnos, MUST decirlo con un mensaje en lugar de una lista vacía. La pantalla MUST estar disponible solo para usuarios con rol `ADMIN`: sin sesión MUST redirigir a `/ingresar`, y con una sesión de otro rol MUST mostrar un aviso de que no tiene permisos, sin datos del club. Si la API no responde, la pantalla MUST mostrar un aviso con la opción de reintentar.

#### Scenario: Panel de hoy
- **WHEN** un ADMIN entra a `/admin`
- **THEN** ve el panel del día de hoy, con las métricas, la ocupación de cada cancha activa y los turnos que todavía no empezaron

#### Scenario: Panel de otra fecha
- **WHEN** un ADMIN elige el día de mañana en el selector de fecha
- **THEN** la dirección pasa a `/admin?fecha=<mañana>` y el panel muestra las métricas y todos los turnos de ese día

#### Scenario: Día sin próximos turnos
- **WHEN** la fecha consultada no tiene reservas no canceladas que falten empezar
- **THEN** la sección de próximos turnos explica que no hay turnos por delante, en lugar de mostrar una lista vacía

#### Scenario: Visitante sin sesión
- **WHEN** alguien sin sesión entra a `/admin`
- **THEN** es redirigido a `/ingresar` y, al ingresar como ADMIN, vuelve al panel

#### Scenario: Socio en el panel
- **WHEN** un SOCIO con sesión entra a `/admin`
- **THEN** ve un aviso de que la sección es solo para administradores, sin ninguna métrica del club

#### Scenario: API sin respuesta
- **WHEN** la API no responde en 2 segundos al pedir el panel
- **THEN** la pantalla muestra un aviso con un botón para reintentar, y el header y el pie siguen visibles
