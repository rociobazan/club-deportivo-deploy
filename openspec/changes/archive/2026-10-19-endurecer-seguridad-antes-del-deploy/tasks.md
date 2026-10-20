# Tasks

Referencias: los deltas en `specs/` de este cambio y las decisiones en `design.md`. Cada tarea lleva su test, escrito antes del código.

## 1. IP real detrás del proxy

- [x] 1.1 `apps/api/src/configurar-app.ts`: `trust proxy` en `1`. Verificar en `contacto.e2e-spec.ts` que con `X-Forwarded-For` el límite se cuenta por IP reenviada (escenario "Visitantes distintos detrás del mismo servidor") y que sin el encabezado se cuenta la del socket (escenario "Sin IP reenviada").
- [x] 1.2 `apps/web/lib/ip-del-visitante.ts`: última entrada válida del `X-Forwarded-For`, con test en `node --test`; `encabezadosDelVisitante()` en `lib/api/client.ts`, usado por las Server Actions de contacto, ingreso y registro. Verificar con el test de Playwright "el sexto envío de un visitante da 429 y otro visitante sigue pudiendo escribir".
- [x] 1.3 Runner unitario del front: script `test` en `apps/web/package.json`, `allowImportingTsExtensions` en el `tsconfig` y el paso "Tests unitarios" en el job `web` de `ci.yml`.

## 2. Límite de intentos en login y registro

- [x] 2.1 `configuracion.ts`: `limiteLoginPorMinuto` (10) y `limiteRegistroPorMinuto` (5), enteros ≥ 1, con unitarios en `configuracion.spec.ts`.
- [x] 2.2 `auth/guard-de-limite.ts` y `ThrottlerModule.forRootAsync` en `AuthModule` con dos throttlers con nombre; cada ruta salta el del otro endpoint con `@SkipThrottle`. Verificar en `auth.e2e-spec.ts` los tres escenarios del requisito nuevo.
- [x] 2.3 `ci.yml`: el job `e2e` exporta los dos límites en un valor alto, con el motivo en un comentario. Documentar las variables en `apps/api/.env.example`, `deploy/.env.example` y README.

## 3. `volver` más estricto

- [x] 3.1 `lib/destino-seguro.test.ts` con `/\evil.com`, `/\t/evil.com`, `//evil.com`, `https://otro.test`, `/mis-reservas?x=1` y `/`. Después `destino-seguro.ts`: rechazo de `\`, controles y `//`, y resolución contra el origen.

## 4. Detalle de reserva y `server-only`

- [x] 4.1 `lib/ids.ts` con `esIdDeBase()` y su test; `mis-reservas/[id]/page.tsx` y `admin/reservas/[id]/page.tsx` lo usan. Verificar con Playwright que `/mis-reservas/abc` da 404 con sesión.
- [x] 4.2 `import "server-only"` en `lib/api/client.ts`; el build del front sigue en verde.

## 5. Caddy

- [x] 5.1 `deploy/Caddyfile`: bloque `header`, HSTS con matcher `not host localhost`, `request_body { max_size 1MB }`. Verificar con `caddy validate` si está disponible; si no, con la imagen `caddy:2` por Docker. **Verificado el 2026-10-19** con `caddy:2` (v2.11.7): `Valid configuration` con `DOMINIO=clubdeploy.online` y con `DOMINIO=localhost`, y `caddy adapt` muestra los encabezados, el HSTS bajo el matcher `not` y el `max_size` de 1 MB.

## 6. Configuración de producción y mails

- [x] 6.1 `configuracion.ts`: `MAIL_CONTACTO` obligatoria en producción, `JWT_SECRET` de 32 como mínimo en producción, defaults `.online`; unitarios en `configuracion.spec.ts`. `apps/api/.env.example`, `deploy/.env.example`, README y `apps/web/lib/club-datos.ts` al día.

## 7. Credenciales

- [x] 7.1 `AuthService.ingresar` rechaza `activo = false` con el 401 genérico; unitario en `auth.service.spec.ts` y escenario "Cuenta inactiva" en `auth.e2e-spec.ts`.
- [x] 7.2 `@MaxLength(120)` en los `email` de Login, Registro, ActualizarPerfil y Contacto; `@MaxLength(72)` en las contraseñas de Login, Registro y CambiarPassword; unitarios en `dto.spec.ts`.

## 8. Cierre

- [x] 8.1 `npm run spec:validate`, lint, build y tests de los dos lados en verde; e2e de la API contra la base local. Al cerrar el #59 quedaron para el CI `auth.e2e-spec.ts` y Playwright, porque Docker Desktop se cayó (socket huérfano) a mitad del trabajo. **Completado el 2026-10-19 sobre `main`**: 195 de 195 e2e de la API contra la base local, y los 38 de navegador contra la pila local, con el doble de correo y los límites altos del job `e2e`. Al correrlos apareció un test intermitente del #59: el del 429 de contacto fallaba 2 de cada 10 veces, porque esperaba la confirmación del envío anterior. Pasó a esperar el formulario re-montado vacío, y pasa 20 de 20.
- [x] 8.2 Decisión 37 (PR #59; era la 36 y se renumeró porque el #58 la tomó primero) y ampliación de la nota del 2026-10-04 en `docs/memoria-proyecto.md`; `docs/estado-del-proyecto.md` al día; PR con base `main`.
