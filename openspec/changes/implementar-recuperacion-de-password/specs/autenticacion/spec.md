# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
