# Proposal

## Why

La auditoría del 2026-10-15 no encontró nada crítico, pero dejó siete hallazgos de seguridad que conviene cerrar **antes** de activar el despliegue en EC2 (`DEPLOY_HABILITADO`), porque varios solo se manifiestan detrás del proxy de producción: el límite por IP de `POST /contacto` cuenta a todos los visitantes sobre la IP del contenedor `web` (Pendientes de la memoria, 2026-10-05), el login y el registro no tienen ningún límite, el `volver` del ingreso acepta rutas que algunos navegadores resuelven como externas, Caddy no manda encabezados de seguridad, y la configuración de producción no exige `MAIL_CONTACTO` ni un `JWT_SECRET` de largo razonable.

## What Changes

- **IP real detrás del proxy.** La API confía en un salto de proxy (`trust proxy`, 1) y las Server Actions públicas del sitio (contacto, ingreso y registro) reenvían la IP del visitante en `X-Forwarded-For`. El límite de contacto pasa a contarse por visitante.
- **Límite de intentos en `POST /auth/login` y `POST /auth/registro`**, por IP y por minuto, con el mismo 429 `DEMASIADAS_SOLICITUDES` que ya usa contacto. Los dos números son configurables (`LIMITE_LOGIN_POR_MINUTO`, 10; `LIMITE_REGISTRO_POR_MINUTO`, 5).
- **`volver` más estricto**: además de `//` y los esquemas, se rechazan la barra invertida y los caracteres de control, y el destino se valida resolviéndolo contra el origen del sitio.
- **Id de reserva validado** en `/mis-reservas/[id]` igual que en la administración, y el cliente de la API marcado `server-only`.
- **Caddy**: HSTS (fuera de `localhost`), `nosniff`, `X-Frame-Options`, `Referrer-Policy`, sin `Server` ni `X-Powered-By`, y cuerpo de 1 MB como máximo.
- **Configuración de producción**: `MAIL_CONTACTO` obligatoria y `JWT_SECRET` de 32 caracteres como mínimo; los defaults de mail pasan de `.com.ar` a `.online`, el dominio real.
- **Credenciales**: el login rechaza cuentas con `activo = false` con el 401 genérico; largo máximo de 120 en los mails y de 72 (el límite de bcrypt) en las contraseñas.
- **Sin cambios de contrato**: ningún cuerpo, código ni respuesta nueva en `contratos/openapi.yaml`. **No es BREAKING.**

**Fuera de alcance:** paginación, rollback del despliegue, modo standalone del front, `helmet`, bloqueo por cuenta (solo por IP) y límites en otros endpoints.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `institucional`: el requisito *Límite de envíos de contacto por IP* pasa a decir que la IP es la del visitante también cuando el envío llega a través del servidor del sitio.
- `autenticacion`: se **agrega** el requisito *Límite de intentos de ingreso y registro por IP* y el requisito *Largo máximo de credenciales*; se **modifica** *Inicio de sesión con JWT* (cuenta inactiva) e *Ingreso y registro desde el sitio* (destinos con barra invertida o caracteres de control).

## Impact

- **`apps/api/src`**: `configurar-app.ts`, `configuracion.ts`, `auth/` (guard de límite, módulo, servicio y DTOs), `contacto/dto`.
- **`apps/api/test`**: escenarios nuevos en `contacto.e2e-spec.ts` y `auth.e2e-spec.ts`.
- **`apps/web`**: `lib/destino-seguro.ts`, `lib/ids.ts`, `lib/ip-del-visitante.ts`, `lib/api/client.ts`, las Server Actions públicas, las dos páginas de detalle de reserva, y el primer runner unitario del front (`node --test`), con su paso en el job `web` del CI.
- **`deploy/`**: `Caddyfile` y `.env.example`. **`.github/workflows/ci.yml`**: el job `e2e` sube los límites de login y registro, porque la suite de navegador ingresa decenas de veces por minuto desde la misma IP.
- **Docs, en el mismo PR**: README, `apps/api/.env.example`, `docs/memoria-proyecto.md` (decisión 36 y ampliación de la nota del 2026-10-04 sobre usuarios inactivos) y `docs/estado-del-proyecto.md`.
