# catalogo Specification

## Purpose
Exponer públicamente lo que el club ofrece para reservar (disciplinas con su duración de turno, canchas con su precio plano por turno y equipamiento alquilable con su stock total o disponible en un turno) y permitir que el administrador dé de alta, edite y dé de baja canchas y equipamiento.

## Requirements

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
Un usuario con rol `ADMIN` MUST poder dar de alta canchas indicando disciplina, nombre, superficie opcional, si es techada y `precioPorTurno` mayor que 0, y MUST poder modificar nombre, superficie, techada, `precioPorTurno` y `activa`. La disciplina del alta MUST existir y estar activa. El nombre MUST recortarse antes de validarse y MUST NOT quedar vacío. Dos canchas de la misma disciplina MUST NOT tener el mismo nombre: un alta o una edición que lo repita MUST responder 409 sin modificar nada. Dar de baja una cancha (`activa` en `false`) MUST quitarla del catálogo público y de la disponibilidad e impedir reservas nuevas, sin modificar ni cancelar las reservas que ya tiene; reactivarla MUST revertirlo. Cambiar el precio MUST NOT modificar los montos de reservas existentes (RN-06). `GET /canchas?incluirInactivas=true` MUST devolver también las canchas inactivas y MUST estar reservado a `ADMIN`. Ninguna de estas operaciones MUST estar disponible para otros roles.

#### Scenario: Alta de una cancha
- **WHEN** un ADMIN envía `POST /canchas` con la disciplina Pádel, nombre "Pádel 4", techada `false` y `precioPorTurno` 15000
- **THEN** se devuelve 201 con la cancha creada y activa, y la cancha aparece en `GET /canchas` y en la disponibilidad

#### Scenario: Precio inválido
- **WHEN** un ADMIN envía `POST /canchas` o `PATCH /canchas/{id}` con `precioPorTurno` 0
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA`

#### Scenario: Nombre vacío
- **WHEN** un ADMIN envía `POST /canchas` o `PATCH /canchas/{id}` con `nombre` "   "
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA`

#### Scenario: Disciplina o cancha inexistente
- **WHEN** un ADMIN envía `POST /canchas` con un `disciplinaId` que no existe o que corresponde a una disciplina inactiva, o `PATCH /canchas/{id}` con un id que no existe
- **THEN** se devuelve 404 con `tipo` `NO_ENCONTRADO`

#### Scenario: Nombre repetido en la disciplina
- **WHEN** un ADMIN envía `POST /canchas` con la disciplina Pádel y el nombre de otra cancha de Pádel, o `PATCH /canchas/{id}` cambiando el nombre por el de otra cancha de la misma disciplina
- **THEN** se devuelve 409 con `tipo` `NOMBRE_DUPLICADO` y ninguna cancha cambia

#### Scenario: Mismo nombre en otra disciplina
- **WHEN** un ADMIN da de alta en Tenis una cancha con el nombre de una cancha de Fútbol 5
- **THEN** se devuelve 201

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
Un usuario con rol `ADMIN` MUST poder dar de alta equipamiento indicando disciplina, nombre, `stockTotal` entero mayor o igual a 0 y `precioPorTurno` mayor que 0, y MUST poder modificar nombre, `stockTotal`, `precioPorTurno` y `activo`. La disciplina del alta MUST existir y estar activa. El nombre MUST recortarse antes de validarse y MUST NOT quedar vacío. Dos ítems de la misma disciplina MUST NOT tener el mismo nombre: un alta o una edición que lo repita MUST responder 409 sin modificar nada. Dar de baja un ítem (`activo` en `false`) MUST quitarlo del catálogo público e impedir alquilarlo en reservas nuevas, sin modificar las reservas que ya lo incluyen. Reducir `stockTotal` MUST NOT modificar reservas existentes. Cambiar el precio MUST NOT modificar el `precioUnitario` de reservas existentes (RN-06). `GET /equipamiento?incluirInactivos=true` MUST devolver también los ítems inactivos y MUST estar reservado a `ADMIN`.

#### Scenario: Alta de equipamiento
- **WHEN** un ADMIN envía `POST /equipamiento` con la disciplina Tenis, nombre "Visera", `stockTotal` 8 y `precioPorTurno` 1000
- **THEN** se devuelve 201 con el ítem creado y activo, y el ítem aparece en `GET /equipamiento`

#### Scenario: Stock inválido
- **WHEN** un ADMIN envía `POST /equipamiento` o `PATCH /equipamiento/{id}` con `stockTotal` -1
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA`

#### Scenario: Disciplina o ítem inexistente
- **WHEN** un ADMIN envía `POST /equipamiento` con un `disciplinaId` que no existe o que corresponde a una disciplina inactiva, o `PATCH /equipamiento/{id}` con un id que no existe
- **THEN** se devuelve 404 con `tipo` `NO_ENCONTRADO`

#### Scenario: Nombre repetido en la disciplina
- **WHEN** un ADMIN envía `POST /equipamiento` con la disciplina Pádel y el nombre "Paleta de pádel", que ya existe en Pádel
- **THEN** se devuelve 409 con `tipo` `NOMBRE_DUPLICADO` y no se crea ningún ítem

#### Scenario: Ajuste de stock
- **WHEN** un ADMIN cambia el `stockTotal` de la paleta de pádel de 6 a 8 y se consulta un turno sin alquileres
- **THEN** la paleta de pádel muestra `stockTotal` 8 y `stockDisponible` 8

#### Scenario: Stock reducido por debajo de lo alquilado
- **WHEN** hay reservas que alquilan 4 paletas mañana a las 20:00 y un ADMIN baja el `stockTotal` de la paleta de pádel a 3
- **THEN** esas reservas conservan sus 4 paletas y la consulta de ese turno muestra `stockDisponible` 0

#### Scenario: Cambio de precio del equipamiento
- **WHEN** existe una reserva que alquila 2 paletas a 2500 y un ADMIN cambia el `precioPorTurno` de la paleta a 3000
- **THEN** esa reserva conserva `precioUnitario` 2500 y una reserva nueva con paletas usa 3000

#### Scenario: Baja de un ítem
- **WHEN** un ADMIN envía `PATCH /equipamiento/{id}` con `activo` en `false`
- **THEN** el ítem deja de aparecer en `GET /equipamiento` y un `POST /reservas` que lo pide devuelve 404 con `tipo` `NO_ENCONTRADO`

#### Scenario: Listado con ítems inactivos
- **WHEN** un ADMIN envía `GET /equipamiento?incluirInactivos=true` y hay un ítem dado de baja
- **THEN** la respuesta incluye ese ítem con `activo` en `false`

#### Scenario: Operaciones de administración sin permiso
- **WHEN** un SOCIO envía `POST /equipamiento`, `PATCH /equipamiento/{id}` o `GET /equipamiento?incluirInactivos=true`
- **THEN** se devuelve 403 con `tipo` `SIN_PERMISOS`; y sin token, 401 con `tipo` `NO_AUTENTICADO`

### Requirement: Página Canchas y precios
El sitio MUST ofrecer en `/canchas` una página pública que muestre, agrupadas por disciplina activa, las canchas activas con su superficie, si es techada, su `precioPorTurno` y la duración del turno de la disciplina, y el equipamiento activo de cada disciplina con su `stockTotal` y su precio por turno. La página MUST explicar que el precio es por turno y no por jugador, y que el stock mostrado es el total del club y la disponibilidad real se calcula por turno. Desde cada disciplina MUST poder ir a la consulta de disponibilidad ya filtrada. Si la API no responde, la página MUST mostrar un aviso con la opción de reintentar.

#### Scenario: Catálogo completo
- **WHEN** un visitante entra a `/canchas` con los datos de prueba cargados
- **THEN** ve Tenis, Pádel y Fútbol 5, cada una con sus canchas, precios y turnos de 60, 90 y 60 minutos, y su equipamiento con stock total

#### Scenario: Cancha o equipamiento dados de baja
- **WHEN** una cancha o un ítem de equipamiento están inactivos
- **THEN** no aparecen en la página

#### Scenario: Acceso a la disponibilidad
- **WHEN** el visitante elige "Ver disponibilidad" en la sección de Pádel
- **THEN** llega a `/disponibilidad?disciplinaId=<id de Pádel>`

#### Scenario: API sin respuesta
- **WHEN** la API no responde en 2 segundos
- **THEN** la página muestra un aviso con un botón para reintentar, y el header y el pie siguen visibles

### Requirement: Pantallas de administración de canchas y equipamiento
El sitio MUST ofrecer en `/admin/canchas` y en `/admin/equipamiento` el listado completo de canchas y de equipamiento, **incluidos los dados de baja**, con un indicador visible de cuáles están inactivos. Cada cancha MUST mostrar su nombre, disciplina, superficie, si es techada, la duración del turno de su disciplina y su `precioPorTurno`. Cada ítem de equipamiento MUST mostrar su nombre, disciplina, `stockTotal` y `precioPorTurno`. Desde cada pantalla MUST poder darse de alta un elemento nuevo, editarse cualquiera de los campos que la API admite modificar, y darse de baja o reactivarse cada elemento. Cada pantalla MUST aclarar que cambiar un precio solo afecta a las reservas nuevas, y la de equipamiento que el stock es el total del club y la disponibilidad se calcula por turno. Un error de la API (dato inválido, nombre repetido) MUST mostrarse con su título, sin perder lo que se cargó. Las dos pantallas MUST estar disponibles solo para usuarios con rol `ADMIN`, con el mismo comportamiento que el panel ante un visitante sin sesión o una sesión de otro rol. Si la API no responde, MUST mostrar un aviso con la opción de reintentar.

#### Scenario: Listado con canchas inactivas
- **WHEN** un ADMIN entra a `/admin/canchas` y hay una cancha dada de baja
- **THEN** ve todas las canchas, y la dada de baja aparece marcada como inactiva con la opción de reactivarla

#### Scenario: Alta de una cancha desde la pantalla
- **WHEN** un ADMIN completa el alta con la disciplina Pádel, nombre "Pádel 4", sin techo y precio 15000, y confirma
- **THEN** la cancha aparece en el listado como activa

#### Scenario: Edición de una cancha
- **WHEN** un ADMIN cambia el precio de una cancha de 14000 a 16000 y confirma
- **THEN** el listado muestra el precio nuevo

#### Scenario: Baja y reactivación
- **WHEN** un ADMIN elige "Dar de baja" en una cancha activa y después "Reactivar" en la misma cancha
- **THEN** primero aparece como inactiva y después vuelve a aparecer como activa

#### Scenario: Nombre repetido desde la pantalla
- **WHEN** un ADMIN da de alta un ítem de equipamiento con el nombre de otro ítem de la misma disciplina
- **THEN** la pantalla muestra el título del error de la API y conserva los datos cargados en el formulario

#### Scenario: Ajuste de stock desde la pantalla
- **WHEN** un ADMIN cambia el stock de la paleta de pádel de 6 a 8 y confirma
- **THEN** el listado muestra stock 8

#### Scenario: Socio en las pantallas de administración
- **WHEN** un SOCIO con sesión entra a `/admin/canchas` o a `/admin/equipamiento`
- **THEN** ve un aviso de que la sección es solo para administradores, sin el listado ni los formularios

#### Scenario: API sin respuesta
- **WHEN** la API no responde en 2 segundos al pedir el listado
- **THEN** la pantalla muestra un aviso con un botón para reintentar, y el header y el pie siguen visibles
