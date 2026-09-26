# Spec Delta

## ADDED Requirements

### Requirement: Pantalla de disponibilidad
El sitio MUST ofrecer en `/disponibilidad` una consulta de turnos por fecha, abierta a cualquier visitante. MUST tener un selector de fecha que arranca en hoy (hora local del club) y no permite fechas anteriores, y un filtro por disciplina. Para cada cancha MUST mostrar la grilla completa del club para esa fecha, desde la hora de apertura hasta la de cierre en bloques de la duración de turno de su disciplina, y cada bloque MUST verse en uno de tres estados: **Libre** si la API lo devolvió como disponible, **Pasado** si la fecha es hoy y el bloque ya empezó, y **Ocupada** en cualquier otro caso. Solo los bloques libres MUST poder elegirse. Si la API no responde, la pantalla MUST mostrar un aviso con la opción de reintentar en lugar de una página rota.

#### Scenario: Consulta por defecto
- **WHEN** un visitante entra a `/disponibilidad` sin parámetros
- **THEN** ve la fecha de hoy seleccionada y la grilla de todas las canchas activas para hoy

#### Scenario: Cambio de fecha y de disciplina
- **WHEN** el visitante elige otra fecha y la disciplina Pádel
- **THEN** la grilla muestra solo las canchas de Pádel para esa fecha, con bloques de 90 minutos

#### Scenario: Estados de los bloques
- **WHEN** son las 14:00 en el club, se consulta hoy y una cancha de tenis tiene una reserva a las 19:00
- **THEN** los bloques anteriores a las 14:00 se ven como Pasado, el de las 19:00 como Ocupada y el resto como Libre

#### Scenario: Fecha anterior a hoy
- **WHEN** el visitante llega a `/disponibilidad?fecha=<ayer>` por un link viejo
- **THEN** la pantalla muestra la consulta de hoy y explica que esa fecha ya pasó, sin mostrar un error de la API

#### Scenario: Visitante elige un turno libre
- **WHEN** un visitante sin sesión toca un bloque Libre
- **THEN** ve el aviso "Para reservar hay que ser socio" con accesos para ingresar y para crear una cuenta, y al ingresar vuelve a la misma consulta

#### Scenario: Socio elige un turno libre
- **WHEN** un usuario con sesión toca el bloque Libre de las 19:00 de la Cancha 1 para una fecha
- **THEN** es llevado a `/reservar?canchaId=<id>&fecha=<fecha>&horaInicio=19:00`

#### Scenario: API sin respuesta
- **WHEN** la API no responde en 2 segundos
- **THEN** la pantalla muestra un aviso con un botón para reintentar la consulta, y el header y el pie siguen visibles
