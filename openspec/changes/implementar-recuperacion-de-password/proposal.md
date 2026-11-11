# Proposal

## Why

Hoy, quien olvida su contraseña no tiene forma de volver a entrar: `/ingresar` solo ofrece mail y contraseña, y el cambio de contraseña de `/perfil` (RF-15) exige tener la sesión iniciada y conocer la actual. La única salida es pedirle a un administrador que toque la base, y el panel tampoco lo permite.

**Aclaración de alcance, para que quede escrita:** `docs/requisitos.md` declara la recuperación de contraseña **fuera del MVP** (secciones de alcance y "Fuera del MVP"). Este cambio la incorpora a propósito como **`RF-16`**, con el mismo criterio que el RF-15: se agrega al final, sin renumerar, y en el mismo PR se corrige `requisitos.md` para que deje de figurar como excluida. La verificación de mail al registrarse **sigue fuera**.

## What Changes

- **API: dos operaciones públicas nuevas en el módulo `auth`**:
  - `POST /auth/recuperacion` con `{ email }`: responde **202 siempre**, exista o no la cuenta. Si existe y está activa, le manda un mail con un enlace de un solo uso para elegir una contraseña nueva.
  - `POST /auth/restablecimiento` con `{ token, passwordNueva }`: si el token es válido, cambia la contraseña y responde 204. Si el token no existe, venció o ya se usó, responde 400 con un único `tipo` que no distingue entre esos casos.
- **El enlace vence** a los `RECUPERACION_VIGENCIA_MINUTOS` (60 por defecto), sirve **una sola vez** y, cuando sale el mail con uno nuevo, los anteriores de esa cuenta dejan de servir. Si ese mail no sale, los anteriores siguen sirviendo.
- **El token nunca se guarda en claro**: la base guarda solo su hash, igual que con las contraseñas.
- **Límites contra el abuso**: un límite por IP para las dos operaciones, como el de login y registro, y un máximo de mails de recuperación por cuenta y por hora, para que nadie pueda llenarle la casilla a otra persona. Pasado el máximo por cuenta, la respuesta sigue siendo el mismo 202.
- **Base de datos: una tabla nueva** con los tokens de recuperación. Es una migración aditiva: no toca columnas existentes.
- **Contrato**: pasa de 2.3.0 a **2.4.0**, con dos operaciones más. Es aditivo, así que **no es BREAKING**.
- **Front**:
  - Un link "¿Olvidaste tu contraseña?" en `/ingresar`.
  - `/recuperar`: pide el mail y muestra siempre la misma confirmación.
  - `/restablecer?token=…`: pide la contraseña nueva. Si el cambio se acepta, lleva a `/ingresar` con un aviso de que ya puede entrar con ella.

**Fuera de alcance:**

- **Verificación de mail al registrarse**: sigue fuera del MVP.
- **Revocar las sesiones abiertas al restablecer la contraseña.** Es el mismo límite conocido que dejó el RF-15 (decisión 30): el JWT es autocontenido y no hay almacén de sesiones. Se declara en la spec y en `design.md`.
- **Iniciar sesión automáticamente después de restablecer.** La persona vuelve a `/ingresar`, así la API sigue emitiendo tokens en un solo lugar.
- **Que un administrador dispare la recuperación desde el panel**, o la limpieza periódica de tokens vencidos. Se anota como pendiente en `design.md`.

## Capabilities

### New Capabilities

Ninguna. La recuperación es parte de identificar a quien usa el sistema, así que vive en `autenticacion`, igual que el cambio de contraseña del RF-15.

### Modified Capabilities

- `autenticacion`:
  - Se **agregan** cuatro requisitos: la recuperación por mail en la API, el límite de solicitudes de recuperación, las pantallas `/recuperar` y `/restablecer`, y el link desde `/ingresar`.
  - Se **modifica** "Endpoints protegidos por token", para sumar las dos operaciones nuevas a la lista de públicas.
  - Se **modifica** "Largo máximo de credenciales", para que el máximo de 120 y 72 caracteres alcance también al mail y a la contraseña nueva de estas operaciones.

## Impact

- **`contratos/openapi.yaml`**: dos operaciones, los schemas `RecuperarPasswordRequest` y `RestablecerPasswordRequest`, y la versión 2.4.0. Hay que regenerar `apps/web/lib/api/schema.d.ts` con `npm run generate:api-types`.
- **`apps/api/prisma`**: el modelo `TokenRecuperacion` y su migración.
- **`apps/api/src/auth`**: dos endpoints, sus DTOs, un throttler más y la lógica en el servicio. Se reutilizan sin reescribir: `CorreoModule` (Resend, o el doble en tests), `GuardDeLimiteDeAuth`, `ErrorDeApi`, el hasheo con bcrypt y `frontendUrl` de la configuración para armar el enlace.
- **`apps/api/src/configuracion.ts`**: tres variables nuevas con valor por defecto (`RECUPERACION_VIGENCIA_MINUTOS`, `LIMITE_RECUPERACION_POR_MINUTO` y `MAX_RECUPERACIONES_POR_HORA`). Se documentan en los `.env.example`.
- **`apps/web`**: el link en `app/(auth)/ingresar`, las páginas `app/(auth)/recuperar` y `app/(auth)/restablecer`, y sus Server Functions.
- **Tests**: unitarios del servicio, e2e de la API (uno por escenario, leyendo el enlace del doble de mail) y de navegador con Playwright para las pantallas.
- **CI**: el job `e2e` sube `LIMITE_RECUPERACION_POR_MINUTO`, igual que ya hace con los límites de login y registro.
- **Docs, en el mismo PR**: `docs/requisitos.md` (RF-16, y sacarlo de "Fuera del MVP"), `docs/memoria-proyecto.md` con la decisión y `docs/estado-del-proyecto.md`.
