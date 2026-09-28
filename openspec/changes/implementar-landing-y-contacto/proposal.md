# Proposal

## Why

La home del sitio sigue siendo la plantilla por defecto de Next: quien entra a `/` no ve el club. El ítem 1.5 (RF-09 y RF-10) es lo único que queda del reparto del usuario, y la capacidad `institucional` ya está especificada de punta a punta: las tres páginas, que el sitio se sostenga con la API caída, accesibilidad, el formulario de contacto y su límite por IP. Este cambio **implementa esa spec tal como está** y especifica lo único que falta: cómo se comporta el formulario de contacto del lado del sitio.

## What Changes

- **API — `POST /contacto`**: público, valida `ContactoRequest`, responde 202 y **reenvía el mensaje por mail a la casilla del club**. El campo trampa `sitioWeb` completo responde 202 sin enviar nada. **Límite de 5 solicitudes por minuto por IP** con `@nestjs/throttler`, respondiendo 429 `DEMASIADAS_SOLICITUDES` con el schema `Error`.
- **API — `CorreoService`**: el cliente de mail del proyecto, con Resend, que **1.4 reutiliza** para los mails de reserva (RF-08). En test, y en desarrollo sin `RESEND_API_KEY`, se reemplaza por un doble que registra los envíos y no toca la red (spec `notificaciones`, "Sin envíos reales en los tests"). Configuración: `RESEND_API_KEY`, `MAIL_FROM` y la nueva `MAIL_CONTACTO` (la casilla del club).
- **Front — Inicio (`/`)**: hero con el nombre del club, la frase y el botón a la disponibilidad; las tres disciplinas con su duración de turno y, si la API responde en 2 segundos, el precio desde el que se reserva; las instalaciones; cómo reservar en tres pasos; accesos para crear cuenta y para escribir al club. Reemplaza la plantilla de Next.
- **Front — El club (`/el-club`)**: historia, cada disciplina con sus canchas y los servicios. Contenido estático, como pide RF-09.
- **Front — Contacto (`/contacto`)**: formulario con Server Function hacia `POST /contacto`, con estado de enviado, errores por campo y campo trampa invisible; más dirección, teléfono, mail y horarios. Los datos del club pasan a un único módulo que también usa el pie.
- **Accesibilidad**: regla global para `prefers-reduced-motion` (hoy no existe) y auditoría de `/` con Lighthouse.
- No hay cambios de esquema ni de contrato. No es **BREAKING**.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `institucional`: se **agrega** el requisito del formulario de contacto del lado del sitio (qué ve la persona al enviar, ante errores y con la API caída). Los cinco requisitos existentes **no cambian** y se implementan tal cual.

## Impact

- **Depende del PR #20** (`feature/spec-disponibilidad`), que a su vez depende del #19: usa `GET /canchas` para los precios opcionales de Inicio y toda la base de la API. La rama `feature/landing-institucional` sale del #20; el PR apunta a esa rama y se retargetea cuando la pila avance.
- `apps/api/src`: módulos nuevos `contacto/` y `common/correo/`; `configuracion.ts` suma tres variables; `filtro-de-errores.ts` suma el 429; dependencias nuevas `@nestjs/throttler` y `resend`.
- `apps/web/app`: `page.tsx` reescrito, `el-club/`, `contacto/`; `lib/club-datos.ts` compartido con el pie; `globals.css` (movimiento reducido).
- `README.md`, `docs/estado-del-proyecto.md` y `docs/memoria-proyecto.md`: variables nuevas, avance de 1.5 y la decisión del cliente de mail, en el mismo PR.
- **Fuera de alcance**: los mails de confirmación y cancelación de reservas y la tabla `notificacion` (1.4), el panel y el ABM (1.6), login con Google (ADR 0001).
