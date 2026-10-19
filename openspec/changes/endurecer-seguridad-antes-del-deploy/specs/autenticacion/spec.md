# Spec Delta

## ADDED Requirements

### Requirement: Límite de intentos de ingreso y registro por IP
`POST /auth/login` MUST aceptar como máximo `LIMITE_LOGIN_POR_MINUTO` solicitudes (10 por defecto) y `POST /auth/registro` como máximo `LIMITE_REGISTRO_POR_MINUTO` (5 por defecto) por minuto desde una misma IP. Las que excedan el límite MUST rechazarse con 429 y `tipo` `DEMASIADAS_SOLICITUDES`, sin consultar credenciales ni crear cuentas. La IP MUST ser la del visitante también cuando la solicitud llega a través del servidor del sitio, igual que en `POST /contacto`.

#### Scenario: Undécimo intento de ingreso en un minuto
- **WHEN** desde una misma IP se envían 11 solicitudes a `POST /auth/login` dentro del mismo minuto
- **THEN** las primeras 10 reciben la respuesta que les corresponde y la undécima devuelve 429 con `tipo` `DEMASIADAS_SOLICITUDES`

#### Scenario: Sexto registro en un minuto
- **WHEN** desde una misma IP se envían 6 solicitudes a `POST /auth/registro` dentro del mismo minuto
- **THEN** las primeras 5 reciben la respuesta que les corresponde y la sexta devuelve 429 con `tipo` `DEMASIADAS_SOLICITUDES`, sin crear ninguna cuenta

#### Scenario: Otro visitante no comparte el límite
- **WHEN** una IP ya recibió 429 en `POST /auth/login` y otra IP envía credenciales válidas
- **THEN** la segunda recibe 200

### Requirement: Largo máximo de credenciales
Todo `email` que reciba la API MUST tener como máximo 120 caracteres, y toda contraseña (en el registro, el ingreso y el cambio de contraseña) como máximo 72, que es lo que bcrypt compara. Lo que exceda esos largos MUST rechazarse con 400 y `tipo` `SOLICITUD_INVALIDA`.

#### Scenario: Mail demasiado largo
- **WHEN** se envía `POST /auth/login` con un mail de 121 caracteres
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA`

#### Scenario: Contraseña demasiado larga
- **WHEN** se envía `POST /auth/registro` con una contraseña de 73 caracteres
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA` y no se crea ninguna cuenta

## MODIFIED Requirements

### Requirement: Inicio de sesión con JWT
El sistema MUST autenticar por mail y contraseña y, ante credenciales válidas, emitir un JWT cuyo payload incluya `sub` (id del usuario) y `rol`. La vigencia del token MUST tomarse de la configuración `JWT_EXPIRES_IN`. Ante credenciales inválidas, la respuesta MUST ser idéntica exista o no el mail, para no revelar qué cuentas están registradas. Una cuenta con `activo` en falso MUST NOT poder iniciar sesión, y la respuesta MUST ser la misma que ante credenciales inválidas.

#### Scenario: Credenciales válidas
- **WHEN** se envía `POST /auth/login` con el mail y la contraseña de un usuario existente
- **THEN** se devuelve 200 con `accessToken`, `expiraEn` y `usuario`, y el payload del token contiene `sub` igual al id del usuario y `rol` igual a su rol

#### Scenario: Vigencia informada
- **WHEN** `JWT_EXPIRES_IN` vale `1h` y se hace login con credenciales válidas
- **THEN** `expiraEn` vale 3600

#### Scenario: Contraseña incorrecta
- **WHEN** se envía `POST /auth/login` con un mail existente y una contraseña incorrecta
- **THEN** se devuelve 401 con un mensaje genérico de credenciales inválidas

#### Scenario: Mail inexistente
- **WHEN** se envía `POST /auth/login` con un mail que no está registrado
- **THEN** se devuelve 401 con el mismo `tipo` y el mismo `titulo` que ante una contraseña incorrecta

#### Scenario: Cuenta inactiva
- **WHEN** se envía `POST /auth/login` con el mail y la contraseña correctos de un usuario con `activo` en falso
- **THEN** se devuelve 401 con el mismo `tipo` y el mismo `titulo` que ante una contraseña incorrecta, y no se emite ningún token

### Requirement: Ingreso y registro desde el sitio
El sitio MUST ofrecer una pantalla de ingreso en `/ingresar` (mail y contraseña) y una de creación de cuenta en `/registro` (nombre, apellido, mail, contraseña y teléfono opcional), con la identidad del prototipo. Un ingreso o un registro exitoso MUST dejar al usuario con sesión iniciada y llevarlo a la ruta indicada en el parámetro `volver` si es una ruta relativa del propio sitio, o a `/` si no hay parámetro. Un `volver` que empiece con `//`, que contenga una barra invertida o un carácter de control, o que resuelto contra el origen del sitio apunte a otro origen, MUST tratarse como ausente. Los errores de la API MUST mostrarse en la misma pantalla, sin perder lo que la persona ya escribió salvo la contraseña, y el mensaje ante credenciales inválidas MUST ser el mismo exista o no el mail.

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

#### Scenario: Destino disfrazado ignorado
- **WHEN** un visitante llega a `/ingresar` con `volver` igual a `/\otro-sitio.test` o a `/<tab>/otro-sitio.test` e ingresa con credenciales válidas
- **THEN** es llevado a `/`

#### Scenario: Registro con mail nuevo
- **WHEN** un visitante completa `/registro` con datos válidos y un mail que no existe
- **THEN** la cuenta se crea con rol `SOCIO`, queda con sesión iniciada y es llevado a `/`

#### Scenario: Registro con mail ya usado
- **WHEN** un visitante completa `/registro` con un mail que ya pertenece a otro usuario
- **THEN** permanece en `/registro`, ve que ese mail ya está registrado y no queda ninguna sesión iniciada

#### Scenario: Registro con datos inválidos
- **WHEN** un visitante envía `/registro` con una contraseña de menos de 8 caracteres o sin un campo obligatorio
- **THEN** permanece en `/registro`, ve el error junto al campo que corresponde y no se crea ninguna cuenta
