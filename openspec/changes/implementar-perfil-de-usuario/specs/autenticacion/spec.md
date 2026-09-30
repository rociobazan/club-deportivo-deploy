# Spec Delta

## ADDED Requirements

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
