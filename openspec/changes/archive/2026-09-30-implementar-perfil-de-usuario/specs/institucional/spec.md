# Spec Delta

## MODIFIED Requirements

### Requirement: Sitio institucional público
El sitio institucional MUST mostrarse completo a cualquier visitante, sin sesión y sin redirigir al login. MUST incluir, como mínimo:

- **Inicio** (`/`): hero con el nombre del club, una frase que diga qué es y un botón principal que lleve a la disponibilidad; las disciplinas Tenis, Pádel y Fútbol 5 con su duración de turno; las instalaciones; cómo reservar (elegir el día, tocar un horario libre y recibir el mail con el código); y accesos para crear una cuenta de socio y para escribirle al club.
- **El club**: la historia del club, cada disciplina con sus canchas y los servicios.
- **Contacto**: el formulario de contacto, la dirección, el teléfono, el mail y los horarios.
- Un pie, en las páginas públicas, con los horarios, la dirección y los datos de contacto.

**Con la sesión iniciada la navegación del header MUST personalizarse**: deja de ofrecer el recorrido de quien está conociendo el club y pasa a lo que le sirve a quien ya es socio. Todas las páginas institucionales MUST seguir existiendo y respondiendo por su dirección, e **Inicio MUST seguir alcanzable desde el logo del header**, que enlaza a `/`.

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
- **THEN** el header muestra su nombre y su navegación es Disponibilidad, Mis reservas, Contacto y Mi perfil, en lugar del botón para ingresar y del recorrido del visitante

#### Scenario: El club sigue disponible con sesión
- **WHEN** un usuario autenticado abre `/el-club` por su dirección
- **THEN** la página responde con su contenido completo, aunque no figure en su menú
