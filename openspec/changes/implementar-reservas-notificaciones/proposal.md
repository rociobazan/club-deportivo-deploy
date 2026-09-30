# Proposal

## Why

Con 1.1 (autenticación) y 1.2 (catálogo y disponibilidad) ya en `main`, un socio puede ver qué turnos hay libres pero no tiene ninguna manera de ver, cancelar ni recibir un mail sobre sus propias reservas: las capacidades `reservas` (consulta y cancelación) y `notificaciones` están completamente especificadas desde el cambio base, pero la API no tiene ningún endpoint que las implemente y el front no tiene la pantalla "Mis reservas". Este cambio cierra el ítem 1.4 del reparto.

## What Changes

- Nuevo módulo `reservas` en la API con `GET /reservas`, `GET /reservas/{id}`, `PATCH /reservas/{id}/cancelacion` y `POST /reservas/{id}/reenvio-mail`, ya declarados en `contratos/openapi.yaml`. **No incluye `POST /reservas`** (creación): es el ítem 1.3, a cargo de Adrián, y no arrancó todavía.
- Servicio de notificaciones de reserva que compone los mails de confirmación y cancelación según la spec `notificaciones`, reutilizando `Correo`/`Correo.enviar()` de `common/correo/` sin volver a decidir proveedor ni cómo se testea (ya lo trajo el ítem 1.5). Expone la función que 1.3 va a tener que invocar al confirmar una reserva; ese enganche es responsabilidad del PR de 1.3, no de este cambio.
- Pantallas Next en `/mis-reservas` (listado con reservas activas e historial) y su detalle, con los botones "Cancelar esta reserva" y "Reenviar el mail", según el prototipo `docs/claude-design/Deploy Club.dc.html`. La ruta ya está cableada en el header (`components/layout/navegacion.ts`) para la sesión de socio.
- Agrega el requisito de esa pantalla a la spec `reservas`, que hoy no tiene ninguno (a diferencia de `catalogo` y `disponibilidad`, que sí describen su pantalla).

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `reservas`: se agrega el requisito "Pantalla de mis reservas y su detalle" (RF-05, RF-06). Los requisitos de backend de consulta y cancelación (RN-04, RN-10, RN-13) ya están completos en la spec desde el cambio base y no cambian de redacción; este cambio los implementa.

## Impact

- **API**: nuevo `apps/api/src/reservas/` (controller, service, DTOs) y el servicio de notificaciones de reserva; reutiliza los guards globales, `@UsuarioActual()`, `Reloj` y `Correo` que ya existen.
- **Contrato**: sin cambios. Las cuatro rutas ya están en `contratos/openapi.yaml` 2.2.0 y los tipos ya están generados en `apps/web/lib/api/types.ts`.
- **Front**: nuevas rutas `apps/web/app/mis-reservas/` (listado y detalle).
- **Coordinación con 1.3**: el módulo `reservas` va a recibir `POST /reservas` en un PR aparte de Adrián. Antes de que abra esa rama hay que avisarle qué función del servicio de notificaciones tiene que llamar al confirmar una reserva, para no pisar archivos ni duplicar la integración con `Correo`.
