## Purpose

Exponer públicamente lo que el club ofrece para reservar (disciplinas con su duración de turno, canchas con su precio plano por turno y equipamiento alquilable con su stock total o disponible en un turno) y permitir que el administrador dé de alta, edite y dé de baja canchas y equipamiento.

## ADDED Requirements

### Requirement: Listado público de disciplinas
El sistema MUST devolver, sin requerir autenticación, las disciplinas activas con su id, nombre y duración de turno en minutos. Las disciplinas inactivas MUST NOT aparecer en el listado.

#### Scenario: Tres disciplinas activas
- **WHEN** existen las disciplinas activas Tenis, Pádel y Fútbol 5 y se envía `GET /disciplinas` sin token
- **THEN** se devuelve 200 con exactamente 3 elementos

#### Scenario: Disciplina inactiva
- **WHEN** una disciplina está marcada como inactiva y se consulta `GET /disciplinas`
- **THEN** esa disciplina no aparece en la respuesta

#### Scenario: Duración de turno informada
- **WHEN** se consulta `GET /disciplinas` con los datos de prueba cargados
- **THEN** Tenis informa `duracionTurnoMin` 60, Pádel 90 y Fútbol 5 60

### Requirement: Listado público de canchas con precio por turno
El sistema MUST devolver, sin requerir autenticación, las canchas activas con su id, nombre, disciplina, superficie, si es techada y su `precioPorTurno`. Cada cancha MUST tener un único precio por turno, que no varía según la cantidad de jugadores. El listado MUST poder filtrarse por `disciplinaId` y por `techada`; un filtro que no coincide con ninguna cancha MUST devolver una lista vacía, no un error.

#### Scenario: Filtro por disciplina
- **WHEN** se envía `GET /canchas?disciplinaId=<id de Pádel>`
- **THEN** se devuelve 200 y todas las canchas de la respuesta pertenecen a Pádel

#### Scenario: Disciplina inexistente
- **WHEN** se envía `GET /canchas?disciplinaId=9999` y no existe una disciplina con ese id
- **THEN** se devuelve 200 con una lista vacía

#### Scenario: Filtro por canchas techadas
- **WHEN** se envía `GET /canchas?techada=true`
- **THEN** todas las canchas de la respuesta tienen `techada` en `true`

#### Scenario: Precio plano por cancha
- **WHEN** se consulta una cancha de tenis en `GET /canchas`
- **THEN** la cancha incluye un único `precioPorTurno` numérico y ninguna lista de precios por cantidad de jugadores

#### Scenario: Cancha inactiva
- **WHEN** una cancha está marcada como inactiva y se consulta `GET /canchas` sin parámetros de administración
- **THEN** esa cancha no aparece en la respuesta

### Requirement: Catálogo de equipamiento con stock por turno
El sistema MUST devolver, sin requerir autenticación, el equipamiento activo con su disciplina, `stockTotal` y `precioPorTurno`, filtrable por `disciplinaId`. Cuando la consulta incluye `fecha` y `horaInicio`, cada ítem MUST incluir además `stockDisponible`, calculado como `stockTotal` menos las unidades de ese ítem alquiladas en reservas no canceladas de esa misma fecha y hora de inicio, en cualquier cancha, y MUST NOT ser menor que 0. `fecha` y `horaInicio` MUST enviarse juntos.

#### Scenario: Catálogo sin fecha
- **WHEN** se envía `GET /equipamiento` sin `fecha` ni `horaInicio`
- **THEN** se devuelve 200 y cada ítem muestra su `stockTotal`, sin un valor numérico de `stockDisponible`

#### Scenario: Stock disponible en un turno con alquileres
- **WHEN** la paleta de pádel tiene `stockTotal` 6, hay reservas confirmadas que alquilan 2 unidades el 2026-09-15 a las 20:00 y se envía `GET /equipamiento?fecha=2026-09-15&horaInicio=20:00`
- **THEN** la paleta de pádel muestra `stockDisponible` 4

#### Scenario: Stock compartido entre canchas de la misma disciplina
- **WHEN** una reserva en Pádel 1 alquila 2 paletas y otra en Pádel 2 alquila 1 paleta, ambas el 2026-09-15 a las 20:00, y se consulta ese turno
- **THEN** la paleta de pádel muestra `stockDisponible` 3

#### Scenario: Alquiler de una reserva cancelada
- **WHEN** la única reserva que alquilaba 2 paletas el 2026-09-15 a las 20:00 se cancela y se consulta ese turno
- **THEN** la paleta de pádel muestra `stockDisponible` 6

#### Scenario: Filtro por disciplina
- **WHEN** se envía `GET /equipamiento?disciplinaId=<id de Tenis>`
- **THEN** todos los ítems de la respuesta pertenecen a Tenis

#### Scenario: Fecha sin hora de inicio
- **WHEN** se envía `GET /equipamiento?fecha=2026-09-15` sin `horaInicio`, o `horaInicio` sin `fecha`
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA`

#### Scenario: Hora mal formada
- **WHEN** se envía `GET /equipamiento?fecha=2026-09-15&horaInicio=8pm`
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA`

### Requirement: Administración de canchas
Un usuario con rol `ADMIN` MUST poder dar de alta canchas indicando disciplina, nombre, superficie opcional, si es techada y `precioPorTurno` mayor que 0, y MUST poder modificar nombre, superficie, techada, `precioPorTurno` y `activa`. Dar de baja una cancha (`activa` en `false`) MUST quitarla del catálogo público y de la disponibilidad e impedir reservas nuevas, sin modificar ni cancelar las reservas que ya tiene; reactivarla MUST revertirlo. Cambiar el precio MUST NOT modificar los montos de reservas existentes (RN-06). `GET /canchas?incluirInactivas=true` MUST devolver también las canchas inactivas y MUST estar reservado a `ADMIN`. Ninguna de estas operaciones MUST estar disponible para otros roles.

#### Scenario: Alta de una cancha
- **WHEN** un ADMIN envía `POST /canchas` con la disciplina Pádel, nombre "Pádel 4", techada `false` y `precioPorTurno` 15000
- **THEN** se devuelve 201 con la cancha creada y activa, y la cancha aparece en `GET /canchas` y en la disponibilidad

#### Scenario: Precio inválido
- **WHEN** un ADMIN envía `POST /canchas` o `PATCH /canchas/{id}` con `precioPorTurno` 0
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA`

#### Scenario: Disciplina o cancha inexistente
- **WHEN** un ADMIN envía `POST /canchas` con un `disciplinaId` que no existe, o `PATCH /canchas/{id}` con un id que no existe
- **THEN** se devuelve 404 con `tipo` `NO_ENCONTRADO`

#### Scenario: Cambio de precio
- **WHEN** un ADMIN cambia el `precioPorTurno` de Pádel 1 de 14000 a 16000 y luego se crea una reserva en esa cancha
- **THEN** la nueva reserva tiene `montoCancha` 16000 y las reservas creadas antes conservan 14000

#### Scenario: Baja de una cancha con reservas futuras
- **WHEN** un ADMIN envía `PATCH /canchas/{id}` con `activa` en `false` para una cancha que tiene una reserva CONFIRMADA para mañana
- **THEN** la cancha deja de aparecer en `GET /canchas` y en `GET /disponibilidad`, un nuevo `POST /reservas` sobre ella devuelve 404 con `tipo` `NO_ENCONTRADO`, y la reserva de mañana sigue CONFIRMADA

#### Scenario: Reactivación
- **WHEN** un ADMIN vuelve a poner `activa` en `true` en una cancha dada de baja
- **THEN** la cancha vuelve a aparecer en `GET /canchas` y en la disponibilidad

#### Scenario: Listado con canchas inactivas
- **WHEN** un ADMIN envía `GET /canchas?incluirInactivas=true` y hay una cancha dada de baja
- **THEN** la respuesta incluye esa cancha con `activa` en `false`

#### Scenario: Operaciones de administración sin permiso
- **WHEN** un SOCIO envía `POST /canchas`, `PATCH /canchas/{id}` o `GET /canchas?incluirInactivas=true`
- **THEN** se devuelve 403 con `tipo` `SIN_PERMISOS`; y sin token, 401 con `tipo` `NO_AUTENTICADO`

### Requirement: Administración de equipamiento
Un usuario con rol `ADMIN` MUST poder dar de alta equipamiento indicando disciplina, nombre, `stockTotal` entero mayor o igual a 0 y `precioPorTurno` mayor que 0, y MUST poder modificar nombre, `stockTotal`, `precioPorTurno` y `activo`. Dar de baja un ítem (`activo` en `false`) MUST quitarlo del catálogo público e impedir alquilarlo en reservas nuevas, sin modificar las reservas que ya lo incluyen. Reducir `stockTotal` MUST NOT modificar reservas existentes. Cambiar el precio MUST NOT modificar el `precioUnitario` de reservas existentes (RN-06). `GET /equipamiento?incluirInactivos=true` MUST devolver también los ítems inactivos y MUST estar reservado a `ADMIN`.

#### Scenario: Alta de equipamiento
- **WHEN** un ADMIN envía `POST /equipamiento` con la disciplina Tenis, nombre "Visera", `stockTotal` 8 y `precioPorTurno` 1000
- **THEN** se devuelve 201 con el ítem creado y activo, y el ítem aparece en `GET /equipamiento`

#### Scenario: Stock inválido
- **WHEN** un ADMIN envía `POST /equipamiento` o `PATCH /equipamiento/{id}` con `stockTotal` -1
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA`

#### Scenario: Ajuste de stock
- **WHEN** un ADMIN cambia el `stockTotal` de la paleta de pádel de 6 a 8 y se consulta un turno sin alquileres
- **THEN** la paleta de pádel muestra `stockTotal` 8 y `stockDisponible` 8

#### Scenario: Stock reducido por debajo de lo alquilado
- **WHEN** hay reservas que alquilan 4 paletas mañana a las 20:00 y un ADMIN baja el `stockTotal` de la paleta de pádel a 3
- **THEN** esas reservas conservan sus 4 paletas y la consulta de ese turno muestra `stockDisponible` 0

#### Scenario: Baja de un ítem
- **WHEN** un ADMIN envía `PATCH /equipamiento/{id}` con `activo` en `false`
- **THEN** el ítem deja de aparecer en `GET /equipamiento` y un `POST /reservas` que lo pide devuelve 404 con `tipo` `NO_ENCONTRADO`

#### Scenario: Listado con ítems inactivos
- **WHEN** un ADMIN envía `GET /equipamiento?incluirInactivos=true` y hay un ítem dado de baja
- **THEN** la respuesta incluye ese ítem con `activo` en `false`

#### Scenario: Operaciones de administración sin permiso
- **WHEN** un SOCIO envía `POST /equipamiento`, `PATCH /equipamiento/{id}` o `GET /equipamiento?incluirInactivos=true`
- **THEN** se devuelve 403 con `tipo` `SIN_PERMISOS`
