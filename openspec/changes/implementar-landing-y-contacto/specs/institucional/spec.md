# Spec Delta

## ADDED Requirements

### Requirement: Formulario de contacto en el sitio
La página `/contacto` MUST ofrecer un formulario con nombre, mail, teléfono y mensaje, los cuatro obligatorios, que envía a `POST /contacto` desde el servidor del sitio. Tras un envío aceptado, la página MUST mostrar la confirmación que devolvió la API y vaciar el formulario. Ante datos inválidos, MUST mostrar el error junto al campo que corresponde y conservar lo escrito. El campo trampa `sitioWeb` MUST existir en el formulario pero MUST NOT ser visible ni alcanzable con el teclado para una persona. Si la API no responde o rechaza el envío por límite, la página MUST decirlo con un mensaje claro y MUST seguir mostrando la dirección, el teléfono, el mail y los horarios del club.

#### Scenario: Envío aceptado
- **WHEN** un visitante completa nombre, mail y mensaje válidos y envía el formulario
- **THEN** ve el texto de confirmación de la API ("Recibimos tu consulta…") y el formulario queda vacío

#### Scenario: Datos inválidos
- **WHEN** un visitante envía el formulario sin mensaje, sin teléfono o con un mail mal formado
- **THEN** ve el error junto a ese campo, el resto de lo escrito se conserva y no se envía nada a la API

#### Scenario: Campo trampa
- **WHEN** un bot completa el campo `sitioWeb` y envía
- **THEN** ve la misma confirmación que un envío normal, para no darle señal

#### Scenario: Límite de envíos
- **WHEN** la API responde 429 porque se superó el límite por IP
- **THEN** la página muestra el título del error de la API y conserva lo escrito

#### Scenario: API sin respuesta
- **WHEN** la API no responde en 2 segundos al enviar
- **THEN** la página avisa que no se pudo enviar y sugiere el teléfono o el mail del club, que siguen visibles
