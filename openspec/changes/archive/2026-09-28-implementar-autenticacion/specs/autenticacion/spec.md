# Spec Delta

## ADDED Requirements

### Requirement: Ingreso y registro desde el sitio
El sitio MUST ofrecer una pantalla de ingreso en `/ingresar` (mail y contraseña) y una de creación de cuenta en `/registro` (nombre, apellido, mail, contraseña y teléfono opcional), con la identidad del prototipo. Un ingreso o un registro exitoso MUST dejar al usuario con sesión iniciada y llevarlo a la ruta indicada en el parámetro `volver` si es una ruta relativa del propio sitio, o a `/` si no hay parámetro. Los errores de la API MUST mostrarse en la misma pantalla, sin perder lo que la persona ya escribió salvo la contraseña, y el mensaje ante credenciales inválidas MUST ser el mismo exista o no el mail.

#### Scenario: Ingreso con credenciales válidas
- **WHEN** un visitante envía en `/ingresar` el mail y la contraseña de un usuario existente
- **THEN** queda con sesión iniciada, es llevado a `/` y el header muestra su nombre

#### Scenario: Ingreso con credenciales inválidas
- **WHEN** un visitante envía en `/ingresar` una contraseña incorrecta o un mail que no existe
- **THEN** permanece en `/ingresar`, ve el mismo mensaje genérico en los dos casos y no queda ninguna sesión iniciada

#### Scenario: Ingreso con destino
- **WHEN** un visitante llega a `/ingresar?volver=/mis-reservas` e ingresa con credenciales válidas
- **THEN** es llevado a `/mis-reservas`

#### Scenario: Destino externo ignorado
- **WHEN** un visitante llega a `/ingresar?volver=https://otro-sitio.test` e ingresa con credenciales válidas
- **THEN** es llevado a `/` y no al sitio externo

#### Scenario: Registro con mail nuevo
- **WHEN** un visitante completa `/registro` con datos válidos y un mail que no existe
- **THEN** la cuenta se crea con rol `SOCIO`, queda con sesión iniciada y es llevado a `/`

#### Scenario: Registro con mail ya usado
- **WHEN** un visitante completa `/registro` con un mail que ya pertenece a otro usuario
- **THEN** permanece en `/registro`, ve que ese mail ya está registrado y no queda ninguna sesión iniciada

#### Scenario: Registro con datos inválidos
- **WHEN** un visitante envía `/registro` con una contraseña de menos de 8 caracteres o sin un campo obligatorio
- **THEN** permanece en `/registro`, ve el error junto al campo que corresponde y no se crea ninguna cuenta

### Requirement: Sesión del sitio inaccesible desde el navegador
La sesión del sitio MUST guardarse en una cookie con los atributos `HttpOnly`, `SameSite=Lax` y `Path=/`, con `Secure` cuando el sitio se sirve por HTTPS, y con una vigencia igual a la del token que emitió la API. El token MUST NOT quedar accesible al JavaScript del navegador ni guardarse en `localStorage`. Toda llamada a la API en nombre del usuario MUST hacerse desde el servidor del sitio, que agrega el header `Authorization: Bearer`.

#### Scenario: Cookie inaccesible desde JavaScript
- **WHEN** un usuario inicia sesión
- **THEN** la cookie de sesión tiene `HttpOnly` y `document.cookie` no contiene el token

#### Scenario: Sesión vencida
- **WHEN** venció la vigencia del token de un usuario que había iniciado sesión
- **THEN** el sitio lo trata como visitante sin sesión: el header muestra el botón para ingresar y las rutas privadas redirigen a `/ingresar`

### Requirement: Rutas privadas del sitio
Las rutas `/mis-reservas`, `/reservar` y todas las que empiezan con `/admin` MUST redirigir a `/ingresar?volver=<ruta pedida>` cuando no hay cookie de sesión. Cuando hay cookie, la página MUST cargar y la autorización real MUST seguir siendo la respuesta de la API: el sitio MUST NOT decidir por su cuenta qué puede ver un rol.

#### Scenario: Ruta privada sin sesión
- **WHEN** un visitante sin sesión pide `/mis-reservas`
- **THEN** es redirigido a `/ingresar?volver=/mis-reservas`

#### Scenario: Ruta privada con sesión
- **WHEN** un usuario con sesión pide `/mis-reservas`
- **THEN** no es redirigido a `/ingresar`

#### Scenario: Ruta pública no se toca
- **WHEN** un visitante sin sesión pide `/disponibilidad`
- **THEN** la página carga sin redirección

### Requirement: Cierre de sesión
Un usuario con sesión MUST poder cerrarla desde el header. Al cerrarla, la cookie de sesión MUST eliminarse y el sitio MUST volver a tratarlo como visitante.

#### Scenario: Cerrar sesión
- **WHEN** un usuario con sesión elige cerrar sesión en el header
- **THEN** la cookie de sesión se elimina, es llevado a `/` y el header vuelve a mostrar el botón para ingresar

#### Scenario: Ruta privada después de cerrar sesión
- **WHEN** un usuario cerró la sesión y pide `/mis-reservas`
- **THEN** es redirigido a `/ingresar?volver=/mis-reservas`
