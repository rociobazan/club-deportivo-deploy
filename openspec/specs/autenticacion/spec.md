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
El sistema MUST autenticar por mail y contraseña y, ante credenciales válidas, emitir un JWT cuyo payload incluya `sub` (id del usuario) y `rol`. La vigencia del token MUST tomarse de la configuración `JWT_EXPIRES_IN`. Ante credenciales inválidas, la respuesta MUST ser idéntica exista o no el mail, para no revelar qué cuentas están registradas.

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

### Requirement: Perfil del usuario autenticado
El sistema MUST devolver los datos del usuario identificado por el `sub` del token recibido.

#### Scenario: Consulta del propio perfil
- **WHEN** un usuario envía `GET /auth/perfil` con un token válido
- **THEN** se devuelve 200 con su id, nombre, apellido, mail, teléfono y rol

#### Scenario: Perfil sin token
- **WHEN** se envía `GET /auth/perfil` sin header `Authorization`
- **THEN** se devuelve 401 con `tipo` `NO_AUTENTICADO`

### Requirement: Endpoints protegidos por token
Todo endpoint que no sea público MUST exigir un JWT válido y vigente en el header `Authorization: Bearer <token>`. Son públicos, y MUST responder sin token: `POST /auth/registro`, `POST /auth/login`, `GET /disciplinas`, `GET /canchas` y `GET /equipamiento` (sin los parámetros `incluirInactivas` e `incluirInactivos`, que requieren `ADMIN`), `GET /disponibilidad` y `POST /contacto`.

#### Scenario: Token expirado
- **WHEN** se llama a un endpoint protegido con un token cuya vigencia ya venció
- **THEN** se devuelve 401 con `tipo` `NO_AUTENTICADO`

#### Scenario: Token mal formado o con firma inválida
- **WHEN** se llama a un endpoint protegido con un token que no es un JWT o que no fue firmado por la API
- **THEN** se devuelve 401 con `tipo` `NO_AUTENTICADO`

#### Scenario: Endpoint público sin token
- **WHEN** se llama a `GET /disponibilidad?fecha=<hoy>` sin header `Authorization`
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
