# disponibilidad Specification

## Purpose
Mostrar qué turnos se pueden reservar en cada cancha para una fecha. La disponibilidad se calcula en cada consulta a partir del horario de atención, la duración de turno de la disciplina y las reservas activas; no se almacena.

## Requirements

### Requirement: Cálculo de turnos libres por fecha
El sistema MUST devolver, sin requerir autenticación, los turnos libres de cada cancha activa para la fecha pedida. Los turnos del día MUST generarse dividiendo el horario de atención en bloques consecutivos de la duración de turno de la disciplina, empezando en la hora de apertura; los turnos libres MUST ser esos bloques menos los que tienen una reserva no cancelada. Para cada cancha la respuesta MUST incluir `canchaId`, nombre, disciplina, `precioPorTurno` y la lista de turnos con `horaInicio` y `horaFin`.

#### Scenario: Día sin reservas en una cancha de tenis
- **WHEN** se consulta la disponibilidad de una cancha de tenis para un día de semana futuro sin reservas, con horario de atención de 08:00 a 23:00
- **THEN** se devuelven 15 turnos, el primero de 08:00 a 09:00 y el último de 22:00 a 23:00

#### Scenario: Día sin reservas en una cancha de pádel
- **WHEN** se consulta la disponibilidad de una cancha de pádel para un día de semana futuro sin reservas, con horario de atención de 08:00 a 23:00
- **THEN** se devuelven 10 turnos de 90 minutos, el primero de 08:00 a 09:30 y el último de 21:30 a 23:00

#### Scenario: Turno ocupado
- **WHEN** existe una reserva CONFIRMADA a las 19:00 en una cancha y se consulta esa fecha
- **THEN** el turno de las 19:00 de esa cancha no aparece entre los disponibles

#### Scenario: Turno liberado por cancelación
- **WHEN** la reserva de las 19:00 se cancela y se vuelve a consultar esa fecha
- **THEN** el turno de las 19:00 vuelve a aparecer entre los disponibles

#### Scenario: Reserva en otra cancha
- **WHEN** existe una reserva CONFIRMADA a las 19:00 en la Cancha 1 de tenis y se consulta la disponibilidad de la Cancha 2 de tenis para esa fecha
- **THEN** el turno de las 19:00 de la Cancha 2 aparece entre los disponibles

### Requirement: Horario de atención configurable
El horario de atención MUST tomarse de la configuración y MUST poder variar según el día: `HORA_APERTURA` (08:00 por defecto) es la misma todos los días, `HORA_CIERRE` (23:00) rige de lunes a viernes, `HORA_CIERRE_SABADO` (18:00) rige los sábados y `DIAS_CERRADOS` (0, el domingo) enumera los días en los que el club no abre, de 0 domingo a 6 sábado. Ningún turno disponible MUST empezar antes de la apertura ni terminar después del cierre que le corresponde a ese día, y un bloque que no entra completo antes del cierre MUST NOT ofrecerse. En un día cerrado ninguna cancha MUST ofrecer turnos.

#### Scenario: Cierre anticipado
- **WHEN** `HORA_CIERRE` vale 22:00 y se consulta una cancha de tenis para un día sin reservas
- **THEN** el último turno devuelto es de 21:00 a 22:00

#### Scenario: Bloque que no entra antes del cierre
- **WHEN** `HORA_CIERRE` vale 22:00 y se consulta una cancha de pádel para un día sin reservas
- **THEN** el último turno devuelto es de 20:00 a 21:30 y no se ofrece un turno de 21:30 a 23:00

#### Scenario: Sábado con cierre propio
- **WHEN** se consulta una cancha de tenis para un sábado sin reservas, con `HORA_CIERRE_SABADO` en 18:00
- **THEN** se devuelven 10 turnos, el primero de 08:00 a 09:00 y el último de 17:00 a 18:00

#### Scenario: Día cerrado
- **WHEN** se consulta la disponibilidad de un domingo y `DIAS_CERRADOS` incluye el 0
- **THEN** la respuesta trae las canchas activas, todas con la lista de turnos vacía

### Requirement: Filtros de la consulta
La consulta MUST requerir `fecha` y MUST poder acotarse por `disciplinaId` y por `canchaId`. Las canchas inactivas y las de disciplinas inactivas MUST NOT aparecer.

#### Scenario: Filtro por disciplina
- **WHEN** se envía `GET /disponibilidad?fecha=<fecha futura>&disciplinaId=<id de Pádel>`
- **THEN** todas las canchas de la respuesta son de Pádel

#### Scenario: Filtro por cancha
- **WHEN** se envía `GET /disponibilidad?fecha=<fecha futura>&canchaId=<id de la Cancha 1 de tenis>`
- **THEN** la respuesta contiene únicamente la Cancha 1 de tenis

#### Scenario: Fecha ausente o mal formada
- **WHEN** se envía `GET /disponibilidad` sin `fecha`, o con `fecha=15-09-2026`
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA`

### Requirement: Fechas y horarios ya pasados
"Hoy" y "ahora" MUST evaluarse en la hora local del club. Una consulta para una fecha anterior a hoy MUST rechazarse. Una consulta para hoy MUST NOT devolver turnos cuyo inicio sea anterior a la hora actual.

#### Scenario: Fecha anterior a hoy
- **WHEN** se consulta la disponibilidad para ayer
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA`

#### Scenario: Consulta de hoy a media tarde
- **WHEN** son las 14:00 en la hora local del club y se consulta la disponibilidad de una cancha de tenis para hoy sin reservas
- **THEN** no se devuelve ningún turno que empiece antes de las 14:00 y el primero devuelto es el de 14:00 a 15:00
