# Proposal

## Why

Hoy un socio no puede corregir **ningún** dato propio después de registrarse. Si se equivocó al escribir el apellido, cambió de teléfono o quiere rotar su contraseña, no tiene cómo: las únicas operaciones sobre el usuario son registro, login y `GET /auth/perfil`, que solo lee. La única salida es pedirle a un administrador que lo toque en la base.

Además, el menú del socio logueado sigue siendo casi el del visitante —Inicio, Disponibilidad, Mis reservas, El club, Contacto—, cuando quien ya entró viene a otra cosa: ver turnos, mirar sus reservas y escribirle al club.

**Aclaración de alcance, para que quede escrita:** cuando se escribió esta propuesta, ninguno de los quince requisitos funcionales del TP pedía esto: era alcance nuevo, decidido a propósito por su valor para el usuario final. **El 2026-09-30 el equipo lo incorporó como `RF-15`**, así que ya está dentro de los requisitos y estos pasan de 15 a 16.

## What Changes

- **API — dos operaciones nuevas en el módulo `auth`**, las dos sobre el usuario del token:
  - `PATCH /auth/perfil`: nombre, apellido, teléfono y mail, todos opcionales. Devuelve 200 con el perfil actualizado, con la misma forma que ya devuelve `GET /auth/perfil`.
  - `PUT /auth/password`: contraseña actual y nueva. Devuelve 204.
- **El titular sale del token, nunca del body.** Por eso las rutas cuelgan de `/auth/` y no de `/usuarios/{id}`: no existe forma de pedir el perfil de otra persona. Es el mismo criterio que el repositorio ya usa en reservas con `@UsuarioActual()`.
- **`rol` y `activo` no son editables acá.** Cambiar el rol o dar de baja una cuenta es del panel de administración (ítem 1.6). El `ValidationPipe` global ya los rechaza con 400 por `forbidNonWhitelisted`, sin código nuevo.
- **Contrato**: pasa de 18 a 20 operaciones. Es la primera vez que el proyecto **amplía** el contrato: hasta ahora todos los ítems implementaron operaciones que ya estaban definidas. Es aditivo, así que **no es BREAKING**.
- **Front — pantalla `/perfil`**: muestra los datos actuales, permite editarlos y ofrece el cambio de contraseña. Ruta privada, con el mismo tratamiento que `/mis-reservas`.
- **Front — menú del socio**: pasa a Disponibilidad, Mis reservas, Contacto y Mi perfil. Salen Inicio y El club. Inicio sigue alcanzable por el logo del header, que ya enlaza a `/`. El menú del administrador no cambia.

**Fuera de alcance:**

- **Recuperar una contraseña olvidada.** Necesita mails con token y vencimiento, y es una feature propia: quien no puede entrar no llega a esta pantalla.
- **Dar de baja la cuenta**, foto de perfil y cualquier dato que hoy no exista en el modelo `Usuario`.
- **Que un ADMIN edite a otros usuarios.** Es del ítem 1.6.
- **Revocar las sesiones abiertas al cambiar la contraseña.** El JWT es autocontenido y no hay almacén de sesiones, así que un token ya emitido sigue valiendo hasta que vence. Se declara como límite conocido en `design.md` en lugar de dejarlo implícito.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `autenticacion`: se **agregan** dos requisitos, uno por la API (qué puede modificar el titular de una cuenta y qué pasa cuando falla) y otro por la pantalla `/perfil`.
- `institucional`: se **modifica** el requisito del sitio público para que su escenario "Usuario con sesión" describa el menú personalizado del socio, en vez de solo el acceso a "Mis reservas".

## Impact

- **`contratos/openapi.yaml`**: dos operaciones nuevas y sus schemas de request. `ActualizarPerfilRequest` y `CambiarPasswordRequest`; la respuesta del `PATCH` reutiliza el schema que ya devuelve `GET /auth/perfil`. Hay que regenerar `apps/web/lib/api/schema.d.ts` con `npm run generate:api-types`.
- **`apps/api/src/auth`**: dos endpoints en el controlador, sus DTOs y los métodos del servicio. Se reutiliza sin reescribir: `@UsuarioActual()`, `ErrorDeApi`, el pipe de validación y el hasheo con bcrypt que ya usa el registro.
- **`apps/api/test`**: casos nuevos en `auth.e2e-spec.ts`, uno por escenario.
- **`apps/web`**: `app/perfil/` (página, formularios y server actions) y `components/layout/navegacion.ts`.
- **`apps/web/e2e`**: tests de navegador de la pantalla nueva. El repositorio tiene Playwright y un job `e2e` en el CI desde el 28/09; las dos pantallas del ítem 1.4 entraron sin cobertura y no conviene que esta sea la tercera.
- **Base de datos**: **sin migración**. Todos los campos editables ya existen en el modelo `Usuario`.
- **Docs, en el mismo PR**: `docs/estado-del-proyecto.md`, `docs/memoria-proyecto.md` con la decisión, y `docs/requisitos.md` si el equipo decide numerar esto como un requisito nuevo.
- **Riesgo conocido**: cambiar el mail cambia con qué se inicia sesión. El token sigue valiendo porque lleva el `sub` y el rol, no el mail, pero la persona tiene que enterarse de que a partir de ahí entra con el nuevo. Se trata en `design.md`.
