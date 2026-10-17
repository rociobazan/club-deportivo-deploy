# Spec Delta

## MODIFIED Requirements

### Requirement: Límite de envíos de contacto por IP
`POST /contacto` MUST aceptar como máximo 5 solicitudes por minuto desde una misma IP; las que excedan ese límite MUST rechazarse sin enviar mail. La IP MUST ser la del visitante también cuando la solicitud llega a través del servidor del sitio o de un proxy: el sitio MUST reenviarla en `X-Forwarded-For` y la API MUST tomarla de ese encabezado solo desde el salto inmediato de confianza.

#### Scenario: Sexto envío en un minuto
- **WHEN** desde una misma IP se envían 6 solicitudes válidas a `POST /contacto` dentro del mismo minuto
- **THEN** las primeras 5 devuelven 202 y la sexta devuelve 429 con `tipo` `DEMASIADAS_SOLICITUDES`, sin enviar mail

#### Scenario: Visitantes distintos detrás del mismo servidor
- **WHEN** un visitante ya recibió 429 y otro visitante, con otra IP reenviada en `X-Forwarded-For`, envía una solicitud válida a `POST /contacto`
- **THEN** la del segundo visitante devuelve 202

#### Scenario: Sin IP reenviada
- **WHEN** las solicitudes llegan sin `X-Forwarded-For`
- **THEN** el límite se cuenta sobre la IP de quien se conectó, como en desarrollo local
