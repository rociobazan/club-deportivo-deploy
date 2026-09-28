# Design

## Context

El contrato ya declara `GET /reservas`, `GET /reservas/{id}`, `PATCH /reservas/{id}/cancelacion` y `POST /reservas/{id}/reenvio-mail` (`contratos/openapi.yaml`, sin cambios en este ítem) y el schema de Prisma ya tiene las tablas `reserva`, `reserva_equipamiento` y `notificacion` con todo lo que estos endpoints necesitan. No hace falta ninguna migración. El cliente de mail `Correo`/`CorreoModule` (`common/correo/`) ya existe, con doble para test/desarrollo sin `RESEND_API_KEY`. Ver `proposal.md` para el porqué.

El punto delicado es que **el mail de confirmación se dispara al crear la reserva (1.3), no al cancelarla (1.4)**, y 1.3 todavía no arrancó.

## Goals / Non-Goals

**Goals:**
- Implementar los cuatro endpoints de arriba en un módulo `reservas` nuevo.
- Componer y enviar los mails de confirmación y cancelación según la spec `notificaciones`, en un módulo separado que 1.3 pueda importar sin depender de que este cambio esté mergeado.
- Construir `/mis-reservas` y su detalle en el front, consumiendo esos endpoints.

**Non-Goals:**
- `POST /reservas` (creación): es 1.3, a cargo de Adrián.
- Cambios al contrato o a la spec `notificaciones`: ya describen exactamente este comportamiento.
- El reenvío o la administración de canchas/equipamiento (1.6).

## Decisions

1. **Módulo `notificaciones` aparte del módulo `reservas`** (confirmado con el equipo). `NotificacionesModule` expone `NotificacionesService` con `enviarConfirmacion(reserva)` y `enviarCancelacion(reserva)`, que arman el asunto y el cuerpo según la spec, llaman a `Correo.enviar()` y persisten la fila en `notificacion` (`ENVIADA` o `FALLIDA`, con `reenvio` en `false`). El reenvío (`POST /reservas/{id}/reenvio-mail`) vive en el módulo `reservas`, porque necesita el estado actual de la reserva para decidir qué plantilla reenviar, pero reutiliza `NotificacionesService` para no duplicar la composición del mail, con un parámetro que marca `reenvio` en `true`.

   Alternativa descartada: un solo `ReservasService` con todo (creación, listado, cancelación, mails). Es más simple, pero acopla los archivos de 1.3 y 1.4: quien mergee segundo arrastra un conflicto en el mismo service. Separar notificaciones deja que Adrián importe `NotificacionesService.enviarConfirmacion()` desde su propio código de creación sin tocar el módulo `reservas` que este cambio construye, así los dos PRs pueden abrirse en paralelo.

2. **`ReservasService` no conoce el envío de mail directamente**: expone `listar()`, `obtener()`, `cancelar()` y `reenviarMail()`, y estos dos últimos llaman a `NotificacionesService` después de persistir el cambio (RN-14: el envío nunca revierte la operación, así que va después del `await` a Prisma, no dentro de la misma transacción).

3. **El límite de reenvíos (RN-16, 3 por hora)** se valida contando filas de `notificacion` con `reservaId` igual y `reenvio` en `true` de la última hora, usando `Reloj` para "ahora" — el mismo patrón que ya usan `catalogo` y `disponibilidad` para no comparar contra el reloj del sistema directamente.

4. **Front**: `/mis-reservas` y `/mis-reservas/[id]` son Server Components que llaman a la API con la cookie de sesión (como `/canchas` y `/disponibilidad`); cancelar y reenviar son Server Functions con `useActionState`, igual que el resto del front (decisión 23 de la memoria). Las pestañas de activas/historial se resuelven en el cliente sobre la misma respuesta de `GET /reservas`, sin pedirla dos veces.

## Risks / Trade-offs

- **Orden de merge con 1.3** → aunque los módulos están separados, si Adrián abre su rama antes de que este PR se mergee, su código de creación no va a poder importar `NotificacionesService` todavía. Mitigación: avisarle por el grupo apenas este PR esté abierto, para que arranque su rama después, o que dejen la integración del mail de confirmación para el final de su PR si tiene que arrancar antes.
- **No hay reservas reales todavía** → los tests e2e de listado/cancelación siembran reservas directamente con Prisma (mismo patrón que usan los e2e de catálogo con canchas y equipamiento), sin pasar por `POST /reservas`. Cuando 1.3 esté en `main`, valdría la pena un e2e de punta a punta, pero no es parte de este cambio.
