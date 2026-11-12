# autenticacion Specification

## Purpose
Identificar a quien usa la API y decidir qué puede hacer: registro de socios, inicio de sesión con JWT, perfil, protección de los endpoints privados por token y por rol, y el formato único con que la API informa cualquier error.

## Requirements

### Requirement: Registro de socios
El sistema MUST permitir que cualquier persona sin sesión se registre con nombre, apellido, mail, contraseña y, opcionalmente, teléfono. Todo usuario registrado por esta vía MUST quedar con rol `SOCIO`; el rol MUST NOT poder elegirse desde la solicitud.

#### Scenario: Registro con un mail nuevo
- **WHEN** se envía `POST /auth/registro` con datos válidos y un mail que no existe en el sistema
- **THEN** se devuelve 201 con el usuario creado, con rol `SOCIO`

#### Scenario: Mail ya registrado
- **WHEN** se envía `POST /auth/registro` con un mail que ya pertenece a otro usuario
- **THEN** se devuelve 409 con `tipo` `EMAIL_YA_REGISTRADO` y no se crea ningún usuario

#### Scenario: Datos mal formados
- **WHEN** se envía `POST /auth/registro` con un mail mal formado, una contraseña de menos de 8 caracteres o sin alguno de los campos obligatorios
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA` y no se crea ningún usuario

#### Scenario: Intento de elegir el rol
- **WHEN** se envía `POST /auth/registro` con datos válidos y además un campo `rol` con valor `ADMIN`
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA` y no se crea ningún usuario

### Requirement: Contraseñas protegidas
La contraseña MUST persistirse únicamente como hash bcrypt. Ni la contraseña ni su hash MUST aparecer en ninguna respuesta de la API.

#### Scenario: Contraseña hasheada al registrarse
- **WHEN** se registra un usuario con la contraseña `unaClaveSegura123`
- **THEN** el valor persistido es distinto de `unaClaveSegura123` y verifica como hash bcrypt de esa contraseña

#### Scenario: La contraseña no se expone
- **WHEN** se obtiene la respuesta de `POST /auth/registro`, `POST /auth/login` o `GET /auth/perfil`
- **THEN** el cuerpo no contiene ningún campo con la contraseña ni con su hash

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

### Requirement: Perfil del usuario autenticado
El sistema MUST devolver los datos del usuario identificado por el `sub` del token recibido.

#### Scenario: Consulta del propio perfil
- **WHEN** un usuario envía `GET /auth/perfil` con un token válido
- **THEN** se devuelve 200 con su id, nombre, apellido, mail, teléfono y rol

#### Scenario: Perfil sin token
- **WHEN** se envía `GET /auth/perfil` sin header `Authorization`
- **THEN** se devuelve 401 con `tipo` `NO_AUTENTICADO`

### Requirement: Endpoints protegidos por token
Todo endpoint que no sea público MUST exigir un JWT válido y vigente en el header `Authorization: Bearer <token>`. Son públicos, y MUST responder sin token: `POST /auth/registro`, `POST /auth/login`, `POST /auth/recuperacion`, `POST /auth/restablecimiento`, `GET /disciplinas`, `GET /canchas` y `GET /equipamiento` (sin los parámetros `incluirInactivas` e `incluirInactivos`, que requieren `ADMIN`), `GET /disponibilidad` y `POST /contacto`.

#### Scenario: Token expirado
- **WHEN** se llama a un endpoint protegido con un token cuya vigencia ya venció
- **THEN** se devuelve 401 con `tipo` `NO_AUTENTICADO`

#### Scenario: Token mal formado o con firma inválida
- **WHEN** se llama a un endpoint protegido con un token que no es un JWT o que no fue firmado por la API
- **THEN** se devuelve 401 con `tipo` `NO_AUTENTICADO`

#### Scenario: Endpoint público sin token
- **WHEN** se llama a `GET /disponibilidad?fecha=<hoy>` sin header `Authorization`
- **THEN** la solicitud se procesa normalmente y no se devuelve 401

#### Scenario: Recuperación sin token
- **WHEN** se llama a `POST /auth/recuperacion` sin header `Authorization`
- **THEN** la solicitud se procesa normalmente y no se devuelve 401

### Requirement: Autorización por rol
Los endpoints que declaren roles permitidos MUST rechazar a los usuarios autenticados cuyo rol no esté entre ellos. Este rechazo por rol MUST distinguirse del rechazo por recurso ajeno: el acceso a una reserva de otro usuario se rige por la capacidad `reservas` y responde 404, no 403.

#### Scenario: Rol no admitido
- **WHEN** un usuario con rol `SOCIO` llama a `GET /admin/panel`, que solo admite `ADMIN`
- **THEN** se devuelve 403 con `tipo` `SIN_PERMISOS`

#### Scenario: Rol admitido
- **WHEN** un usuario con rol `SOCIO` llama a `POST /reservas`, que admite `SOCIO` y `ADMIN`
- **THEN** la solicitud no se rechaza por rol

### Requirement: Formato único de errores
Toda respuesta de error de la API MUST tener cuerpo JSON con `tipo`, `titulo` y `estado`, y MUST incluir `detalle` e `instancia` cuando corresponda, según el schema `Error` de `contratos/openapi.yaml`. `estado` MUST coincidir con el código HTTP de la respuesta e `instancia` con la ruta solicitada. Las solicitudes con parámetros o cuerpo mal formados, o con campos que el contrato no declara, MUST rechazarse con 400 y `tipo` `SOLICITUD_INVALIDA`.

#### Scenario: Error de validación
- **WHEN** se envía `GET /canchas?disciplinaId=abc`
- **THEN** se devuelve 400 con un cuerpo que contiene `tipo` `SOLICITUD_INVALIDA`, `estado` 400 e `instancia` `/canchas`

#### Scenario: Error de autenticación con el formato del contrato
- **WHEN** se envía `POST /reservas` sin token
- **THEN** se devuelve 401 con un cuerpo que contiene `tipo`, `titulo` y `estado` 401, y no el formato de error por defecto del framework

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

### Requirement: Datos de la cuenta modificables por su titular
El titular de una cuenta MUST poder modificar su nombre, su apellido, su teléfono y su mail, y MUST poder cambiar su contraseña. El usuario afectado MUST ser siempre el de la sesión: no MUST existir forma de modificar la cuenta de otra persona. El `rol` y el estado de alta de la cuenta MUST NOT ser modificables por su titular; eso es de la administración. Un mail ya usado por otra cuenta MUST rechazarse. El cambio de contraseña MUST exigir la contraseña actual, y la nueva MUST cumplir el mismo mínimo de 8 caracteres que el registro.

#### Scenario: Cambio de datos de contacto
- **WHEN** un socio envía un nombre, un apellido o un teléfono nuevos
- **THEN** se devuelve 200 con el perfil actualizado y los datos quedan guardados

#### Scenario: Cambio de mail
- **WHEN** un socio envía un mail que no usa ninguna otra cuenta
- **THEN** se devuelve 200 con el mail nuevo, y a partir de ahí inicia sesión con ese mail

#### Scenario: La sesión sobrevive al cambio de mail
- **WHEN** un socio cambia su mail y sigue navegando con el mismo token
- **THEN** sus solicitudes siguen siendo aceptadas, sin tener que volver a ingresar

#### Scenario: Mail ya usado por otra cuenta
- **WHEN** un socio envía un mail que ya pertenece a otra cuenta
- **THEN** se devuelve 409 con `tipo` `EMAIL_YA_REGISTRADO` y ningún dato cambia

#### Scenario: Intento de cambiar el rol o el estado de la cuenta
- **WHEN** la solicitud incluye `rol` o `activo`
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA` y ningún dato cambia

#### Scenario: Solicitud sin ningún campo
- **WHEN** un socio envía una actualización sin ningún dato
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA`, en lugar de responder como si hubiera guardado algo

#### Scenario: Cambio de contraseña
- **WHEN** un socio envía su contraseña actual correcta y una nueva de al menos 8 caracteres
- **THEN** se devuelve 204, la contraseña anterior deja de servir para ingresar y la nueva sirve

#### Scenario: Contraseña actual incorrecta
- **WHEN** un socio envía una contraseña actual que no coincide
- **THEN** se devuelve 401 con `tipo` `CREDENCIALES_INVALIDAS` y la contraseña no cambia

#### Scenario: Contraseña nueva demasiado corta
- **WHEN** la contraseña nueva tiene menos de 8 caracteres
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA` y la contraseña no cambia

#### Scenario: Sin sesión
- **WHEN** se piden estas operaciones sin token o con uno inválido
- **THEN** se devuelve 401 y ningún dato cambia

### Requirement: Pantalla de perfil
El sitio MUST ofrecer en `/perfil` los datos de la cuenta de quien tiene la sesión, disponible solo con sesión iniciada. MUST mostrar el nombre, el apellido, el mail y el teléfono actuales, y permitir modificarlos. MUST ofrecer, por separado, el cambio de contraseña pidiendo la actual y la nueva. Tras un cambio aceptado MUST confirmarlo y mostrar los datos ya actualizados. Ante un rechazo de la API MUST mostrar el error junto al campo que corresponda, o el título que devolvió la API, y MUST conservar lo que la persona había cargado. Si la API no responde, MUST decirlo y ofrecer reintentar, en lugar de mostrar una página rota.

#### Scenario: Socio abre su perfil
- **WHEN** un socio con sesión entra a `/perfil`
- **THEN** ve su nombre, apellido, mail y teléfono actuales en un formulario editable

#### Scenario: Visitante sin sesión
- **WHEN** alguien sin sesión abre `/perfil`
- **THEN** es llevado a ingresar y, después de ingresar, vuelve a esa misma pantalla

#### Scenario: Cambio guardado
- **WHEN** un socio modifica su teléfono y confirma
- **THEN** ve la confirmación y el dato nuevo queda a la vista en el formulario

#### Scenario: Mail ya usado
- **WHEN** un socio intenta cambiar su mail por uno que ya pertenece a otra cuenta
- **THEN** ve el error junto al campo del mail, conserva lo que había escrito y nada se guarda

#### Scenario: Aviso al cambiar el mail
- **WHEN** un socio cambia su mail y el cambio se acepta
- **THEN** la pantalla le avisa que a partir de ahora inicia sesión con el mail nuevo

#### Scenario: Contraseña cambiada
- **WHEN** un socio completa su contraseña actual y una nueva válida
- **THEN** ve la confirmación y los campos de contraseña quedan vacíos

#### Scenario: Contraseña actual incorrecta
- **WHEN** un socio se equivoca al escribir su contraseña actual
- **THEN** ve el error de la API y los campos de contraseña quedan vacíos, sin afectar el resto del formulario

#### Scenario: API sin respuesta
- **WHEN** la API no responde al preparar la pantalla
- **THEN** se muestra un aviso con la opción de reintentar, y el header y el pie siguen visibles

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
Todo `email` que reciba la API MUST tener como máximo 120 caracteres, y toda contraseña (en el registro, el ingreso, el cambio de contraseña y el restablecimiento) como máximo 72, que es lo que bcrypt compara. Lo que exceda esos largos MUST rechazarse con 400 y `tipo` `SOLICITUD_INVALIDA`.

#### Scenario: Mail demasiado largo
- **WHEN** se envía `POST /auth/login` con un mail de 121 caracteres
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA`

#### Scenario: Contraseña demasiado larga
- **WHEN** se envía `POST /auth/registro` con una contraseña de 73 caracteres
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA` y no se crea ninguna cuenta

#### Scenario: Contraseña nueva demasiado larga al restablecer
- **WHEN** se envía `POST /auth/restablecimiento` con una contraseña nueva de 73 caracteres
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA` y la contraseña no cambia

### Requirement: Recuperación de contraseña por mail
Una persona que olvidó su contraseña MUST poder elegir una nueva sin tener sesión iniciada, a través de un enlace que recibe por mail.

`POST /auth/recuperacion` recibe un `email` y MUST responder 202 con el mismo cuerpo vacío y en un tiempo que no dependa de si la cuenta existe, de si está activa o de si se envió el mail, para no revelar qué cuentas están registradas. Solo cuando el mail pertenece a una cuenta activa, el sistema MUST enviarle un mail con un enlace al sitio que lleva un token. El token MUST ser aleatorio, de al menos 256 bits, MUST persistirse únicamente como hash y MUST NOT aparecer en ninguna respuesta de la API ni en los logs. El token MUST vencer a los `RECUPERACION_VIGENCIA_MINUTOS` minutos (60 por defecto) y MUST servir una sola vez. Cuando el mail con un token nuevo se envía, los tokens que esa cuenta tenía sin usar MUST dejar de servir. Si el envío falla, el token nuevo MUST descartarse, los anteriores MUST seguir sirviendo y ese intento MUST NOT contar para el máximo de mails por hora.

`POST /auth/restablecimiento` recibe el `token` y una `passwordNueva`, que MUST cumplir el mismo mínimo de 8 caracteres que el registro. Con un token válido MUST reemplazar la contraseña de esa cuenta, guardada como hash bcrypt, invalidar todos los tokens de recuperación de la cuenta y responder 204. Un token inexistente, vencido o ya usado MUST rechazarse con 400 y `tipo` `ENLACE_INVALIDO`, con la misma respuesta en los tres casos, y la contraseña MUST NOT cambiar.

Restablecer la contraseña MUST NOT iniciar sesión, y MUST cerrar las sesiones abiertas de la cuenta, como pide "Cierre de sesiones al cambiar la contraseña".

#### Scenario: Solicitud para una cuenta activa
- **WHEN** se envía `POST /auth/recuperacion` con el mail de una cuenta activa
- **THEN** se devuelve 202 y esa cuenta recibe un mail con un enlace para restablecer la contraseña

#### Scenario: Solicitud para un mail que no existe
- **WHEN** se envía `POST /auth/recuperacion` con un mail que no pertenece a ninguna cuenta
- **THEN** se devuelve el mismo 202 que para una cuenta existente y no se envía ningún mail

#### Scenario: Solicitud para una cuenta inactiva
- **WHEN** se envía `POST /auth/recuperacion` con el mail de una cuenta con `activo` en falso
- **THEN** se devuelve el mismo 202 y no se envía ningún mail

#### Scenario: Mail con mayúsculas o espacios
- **WHEN** se envía `POST /auth/recuperacion` con el mail de una cuenta escrito con mayúsculas o con espacios alrededor
- **THEN** se trata como el mismo mail de la cuenta, igual que en el ingreso

#### Scenario: Falla el proveedor de mail
- **WHEN** se pide la recuperación de una cuenta activa y el envío del mail falla
- **THEN** se devuelve el mismo 202 y la falla queda registrada en el log del servidor, sin el token ni el mail

#### Scenario: Falla el envío con un enlace anterior vigente
- **WHEN** una cuenta tiene un enlace vigente, pide otro y el envío del nuevo falla
- **THEN** el enlace anterior sigue sirviendo, y el intento fallido no cuenta para el máximo por hora

#### Scenario: Restablecimiento con un token válido
- **WHEN** se envía `POST /auth/restablecimiento` con el token recibido por mail y una contraseña nueva de al menos 8 caracteres
- **THEN** se devuelve 204, la contraseña anterior deja de servir para ingresar y la nueva sirve

#### Scenario: Token usado dos veces
- **WHEN** se envía `POST /auth/restablecimiento` con un token que ya se usó para restablecer
- **THEN** se devuelve 400 con `tipo` `ENLACE_INVALIDO` y la contraseña no cambia

#### Scenario: Token vencido
- **WHEN** se envía `POST /auth/restablecimiento` con un token emitido hace más de `RECUPERACION_VIGENCIA_MINUTOS` minutos
- **THEN** se devuelve 400 con `tipo` `ENLACE_INVALIDO` y la contraseña no cambia

#### Scenario: Token reemplazado por uno más nuevo
- **WHEN** se pide la recuperación dos veces para la misma cuenta y se usa el token del primer mail
- **THEN** se devuelve 400 con `tipo` `ENLACE_INVALIDO`, y el token del segundo mail sigue sirviendo

#### Scenario: Token inventado
- **WHEN** se envía `POST /auth/restablecimiento` con un token que el sistema nunca emitió
- **THEN** se devuelve 400 con `tipo` `ENLACE_INVALIDO`, con la misma respuesta que ante un token vencido

#### Scenario: Contraseña nueva demasiado corta
- **WHEN** se envía `POST /auth/restablecimiento` con un token válido y una contraseña de menos de 8 caracteres
- **THEN** se devuelve 400 con `tipo` `SOLICITUD_INVALIDA`, la contraseña no cambia y el token sigue sirviendo

### Requirement: Límite de solicitudes de recuperación
`POST /auth/recuperacion` y `POST /auth/restablecimiento` MUST aceptar, cada una, como máximo `LIMITE_RECUPERACION_POR_MINUTO` solicitudes (5 por defecto) por minuto desde una misma IP. Las que excedan el límite MUST rechazarse con 429 y `tipo` `DEMASIADAS_SOLICITUDES`, sin enviar mails ni cambiar contraseñas. La IP MUST ser la del visitante también cuando la solicitud llega a través del servidor del sitio, igual que en el ingreso y el registro.

Además, una misma cuenta MUST recibir como máximo `MAX_RECUPERACIONES_POR_HORA` mails de recuperación (3 por defecto) en una hora, vengan de la IP que vengan y aunque las solicitudes lleguen al mismo tiempo. Las solicitudes que excedan ese máximo MUST responder el mismo 202, sin enviar el mail ni invalidar los tokens que la cuenta ya tenía.

#### Scenario: Sexta solicitud en un minuto
- **WHEN** desde una misma IP se envían 6 solicitudes a `POST /auth/recuperacion` dentro del mismo minuto
- **THEN** las primeras 5 devuelven 202 y la sexta devuelve 429 con `tipo` `DEMASIADAS_SOLICITUDES`

#### Scenario: Cuarta solicitud para la misma cuenta en una hora
- **WHEN** se pide la recuperación de una misma cuenta 4 veces dentro de una hora, desde IPs distintas
- **THEN** las 4 devuelven 202, la cuenta recibe solo 3 mails y el token del tercero sigue sirviendo

#### Scenario: Solicitudes simultáneas para la misma cuenta
- **WHEN** llegan a la vez 5 solicitudes de recuperación para una misma cuenta que no recibió ninguna en la última hora, desde IPs distintas
- **THEN** las 5 devuelven 202 y la cuenta recibe como máximo 3 mails

### Requirement: Pantallas de recuperación de contraseña
El sitio MUST ofrecer, sin sesión iniciada y con la identidad del prototipo, una pantalla `/recuperar` que pide el mail y una pantalla `/restablecer` que recibe el token en el parámetro `token` del enlace y pide la contraseña nueva dos veces.

Después de enviar `/recuperar`, la pantalla MUST mostrar el mismo mensaje exista o no la cuenta, indicando que si el mail está registrado va a llegar un enlace y cuánto tiempo dura.

En `/restablecer`, si las dos contraseñas no coinciden o la nueva tiene menos de 8 caracteres, la pantalla MUST mostrar el error junto al campo y no enviar nada a la API. Un restablecimiento aceptado MUST llevar a `/ingresar` con un aviso de que la contraseña se cambió y ya se puede ingresar con ella. Si la API responde `ENLACE_INVALIDO`, o si se abre `/restablecer` sin token, la pantalla MUST explicar que el enlace no sirve y ofrecer pedir uno nuevo en `/recuperar`. Los campos de contraseña MUST quedar vacíos después de cualquier error. Si la API no responde, MUST decirlo y permitir reintentar sin perder el mail escrito en `/recuperar`.

#### Scenario: Pedido de enlace
- **WHEN** un visitante escribe su mail en `/recuperar` y envía
- **THEN** ve el mensaje de que, si el mail está registrado, le va a llegar un enlace

#### Scenario: Pedido con un mail no registrado
- **WHEN** un visitante escribe en `/recuperar` un mail que no pertenece a ninguna cuenta
- **THEN** ve exactamente el mismo mensaje que con un mail registrado

#### Scenario: Mail mal escrito
- **WHEN** un visitante envía `/recuperar` con un texto que no es un mail
- **THEN** ve el error junto al campo, conserva lo que escribió y no se envía nada a la API

#### Scenario: Contraseña restablecida
- **WHEN** un visitante abre el enlace del mail, escribe dos veces una contraseña nueva válida y envía
- **THEN** es llevado a `/ingresar`, ve que la contraseña se cambió e ingresa con la nueva

#### Scenario: Contraseñas que no coinciden
- **WHEN** un visitante escribe en `/restablecer` dos contraseñas distintas
- **THEN** ve el error junto al campo de repetición, los campos quedan vacíos y no se envía nada a la API

#### Scenario: Enlace vencido o usado
- **WHEN** un visitante envía `/restablecer` con un token vencido o ya usado
- **THEN** ve que el enlace no sirve y un acceso a `/recuperar` para pedir uno nuevo

#### Scenario: Enlace sin token
- **WHEN** alguien abre `/restablecer` sin el parámetro `token`
- **THEN** ve que el enlace no sirve y un acceso a `/recuperar`, sin formulario de contraseña

### Requirement: Cierre de sesiones al cambiar la contraseña
Cuando la contraseña de una cuenta cambia, sea con `PUT /auth/password` o con `POST /auth/restablecimiento`, todo token de sesión de esa cuenta emitido antes del cambio MUST dejar de servir. En un endpoint protegido, uno de esos tokens MUST rechazarse con 401 y `tipo` `NO_AUTENTICADO`, igual que un token vencido; en un endpoint público, la solicitud MUST tratarse como anónima. Los tokens emitidos después del cambio MUST seguir sirviendo. Un cambio de mail o de otros datos de la cuenta MUST NOT cerrar ninguna sesión.

Quien cambia su contraseña desde `/perfil` MUST seguir con la sesión iniciada en ese navegador: el sitio MUST volver a ingresar con la contraseña nueva. Si ese reingreso falla, MUST cerrar la sesión del sitio y avisar que la contraseña se cambió y que hay que ingresar de nuevo.

#### Scenario: Restablecer cierra las sesiones abiertas
- **WHEN** alguien tiene una sesión abierta en una cuenta y el titular restablece la contraseña con un enlace de recuperación
- **THEN** las solicitudes con el token de esa sesión reciben 401 `NO_AUTENTICADO`

#### Scenario: Cambiar la contraseña cierra las otras sesiones
- **WHEN** un socio tiene dos sesiones abiertas y cambia su contraseña desde una de ellas con `PUT /auth/password`
- **THEN** las solicitudes con el token de la otra sesión reciben 401 `NO_AUTENTICADO`

#### Scenario: Un ingreso posterior al cambio sirve
- **WHEN** después de cambiar la contraseña se ingresa con la nueva
- **THEN** el token nuevo es aceptado

#### Scenario: Token anterior en un endpoint público
- **WHEN** se llama a `GET /disponibilidad` con un token emitido antes del último cambio de contraseña
- **THEN** la solicitud se procesa como anónima y no se devuelve 401

#### Scenario: Cambiar el mail no cierra sesiones
- **WHEN** un socio cambia su mail con `PATCH /auth/perfil`
- **THEN** su token sigue siendo aceptado

#### Scenario: La sesión del perfil sigue abierta
- **WHEN** un socio cambia su contraseña en `/perfil`
- **THEN** ve la confirmación y sigue con la sesión iniciada, sin que le pidan ingresar de nuevo

### Requirement: Acceso a la recuperación desde el ingreso
La pantalla `/ingresar` MUST ofrecer un link "¿Olvidaste tu contraseña?" que lleve a `/recuperar`.

#### Scenario: Link desde el ingreso
- **WHEN** un visitante en `/ingresar` sigue el link "¿Olvidaste tu contraseña?"
- **THEN** llega a `/recuperar`
