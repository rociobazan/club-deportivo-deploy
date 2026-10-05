# Spec Delta

## ADDED Requirements

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
