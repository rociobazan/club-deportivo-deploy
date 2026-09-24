# institucional Specification

## Purpose
Presentar el club Deploy a quien todavía no lo conoce y llevarlo a reservar: un sitio público (inicio, El club y Contacto) que se sostiene solo aunque la API esté caída, y un formulario de contacto protegido contra el abuso.

## Requirements

### Requirement: Sitio institucional público
El sitio institucional MUST mostrarse completo a cualquier visitante, sin sesión y sin redirigir al login. MUST incluir, como mínimo:

- **Inicio** (`/`): hero con el nombre del club, una frase que diga qué es y un botón principal que lleve a la disponibilidad; las disciplinas Tenis, Pádel y Fútbol 5 con su duración de turno; las instalaciones; cómo reservar (elegir el día, tocar un horario libre y recibir el mail con el código); y accesos para crear una cuenta de socio y para escribirle al club.
- **El club**: la historia del club, cada disciplina con sus canchas y los servicios.
- **Contacto**: el formulario de contacto, la dirección, el teléfono, el mail y los horarios.
- Un pie, en las páginas públicas, con los horarios, la dirección y los datos de contacto.

La referencia de contenido y aspecto es el prototipo `docs/claude-design/Deploy Club.dc.html`.

#### Scenario: Visitante sin sesión
- **WHEN** un visitante sin sesión entra a `/`
- **THEN** ve el hero, las disciplinas, las instalaciones y cómo reservar, y no es redirigido al login

#### Scenario: Botón principal
- **WHEN** un visitante hace clic en el botón principal del hero
- **THEN** llega a la pantalla de disponibilidad

#### Scenario: Páginas del sitio accesibles desde el header
- **WHEN** un visitante sin sesión usa la navegación del header
- **THEN** puede llegar a El club, a Canchas y precios, a Disponibilidad y a Contacto, y ve un botón para ingresar

#### Scenario: Usuario con sesión
- **WHEN** un usuario autenticado entra a `/`
- **THEN** el header muestra su nombre y un acceso a "Mis reservas" en lugar del botón para ingresar

### Requirement: El sitio institucional no depende de la API
El contenido de Inicio, El club y Contacto MUST ser contenido estático del front, de modo que esas páginas MUST renderizar completas aunque la API no responda. Cualquier dato de la API que muestren, como los precios de las canchas o los turnos libres, MUST degradar en silencio: si la API no responde en 2 segundos, ese dato se omite y no se muestra ningún error.

#### Scenario: API apagada
- **WHEN** la API está detenida y un visitante carga Inicio, El club o Contacto
- **THEN** cada página se muestra completa, con todas sus secciones de contenido

#### Scenario: Precios sin respuesta de la API
- **WHEN** Inicio muestra el precio desde el que se reserva cada disciplina y la API no responde en 2 segundos
- **THEN** las tarjetas de disciplinas se muestran sin el precio y sin ningún mensaje de error

### Requirement: Sitio accesible y adaptable
Las páginas del sitio institucional MUST poder usarse en pantallas de celular sin desbordes y MUST alcanzar un puntaje de accesibilidad de 90 o más en Lighthouse. Las animaciones MUST desactivarse cuando el visitante tiene configurada la preferencia de movimiento reducido.

#### Scenario: Viewport de 375 px
- **WHEN** se navegan Inicio, El club y Contacto en un viewport de 375 px de ancho
- **THEN** no hay desplazamiento horizontal de la página ni texto cortado

#### Scenario: Auditoría de accesibilidad
- **WHEN** se audita `/` con Lighthouse
- **THEN** el puntaje de accesibilidad es 90 o más

#### Scenario: Movimiento reducido
- **WHEN** el visitante tiene activada la preferencia `prefers-reduced-motion` y carga `/`
- **THEN** la página se muestra sin animaciones

### Requirement: Formulario de contacto
`POST /contacto` MUST ser público y, ante datos válidos, MUST reenviar el mensaje por mail a la casilla del club usando el mismo proveedor de notificaciones, respondiendo 202. El nombre, el mail y el mensaje MUST ser obligatorios; el mensaje MUST tener como máximo 1000 caracteres. El campo trampa `sitioWeb` MUST llegar vacío: si viene completo, la solicitud MUST responderse igual con 202 pero sin enviar nada.

#### Scenario: Mensaje válido
- **WHEN** se envía `POST /contacto` con nombre, mail válido y un mensaje de 200 caracteres
- **THEN** se devuelve 202 con un `mensaje` de confirmación y se envía un mail a la casilla del club con el contenido

#### Scenario: Mail mal formado
- **WHEN** se envía `POST /contacto` con `email` `ana@`
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA` y no se envía nada

#### Scenario: Mensaje demasiado largo
- **WHEN** se envía `POST /contacto` con un mensaje de 1001 caracteres
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA` y no se envía nada

#### Scenario: Campo trampa completo
- **WHEN** se envía `POST /contacto` con datos válidos y `sitioWeb` con un valor no vacío
- **THEN** se devuelve 202 y no se envía ningún mail

### Requirement: Límite de envíos de contacto por IP
`POST /contacto` MUST aceptar como máximo 5 solicitudes por minuto desde una misma IP; las que excedan ese límite MUST rechazarse sin enviar mail.

#### Scenario: Sexto envío en un minuto
- **WHEN** desde una misma IP se envían 6 solicitudes válidas a `POST /contacto` dentro del mismo minuto
- **THEN** las primeras 5 devuelven 202 y la sexta devuelve 429 con `tipo` `DEMASIADAS_SOLICITUDES`, sin enviar mail
