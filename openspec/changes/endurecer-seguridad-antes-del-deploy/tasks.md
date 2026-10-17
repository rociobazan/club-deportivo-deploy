# Tasks

Referencias: los deltas en `specs/` de este cambio y las decisiones en `design.md`. Cada tarea lleva su test, escrito antes del código.

## 1. IP real detrás del proxy

- [x] 1.1 `apps/api/src/configurar-app.ts`: `trust proxy` en `1`. Verificar en `contacto.e2e-spec.ts` que con `X-Forwarded-For` el límite se cuenta por IP reenviada (escenario "Visitantes distintos detrás del mismo servidor") y que sin el encabezado se cuenta la del socket (escenario "Sin IP reenviada").
- [x] 1.2 `apps/web/lib/ip-del-visitante.ts`: última entrada válida del `X-Forwarded-For`, con test en `node --test`; `encabezadosDelVisitante()` en `lib/api/client.ts`, usado por las Server Actions de contacto, ingreso y registro. Verificar con el test de Playwright "el sexto envío de un visitante da 429 y otro visitante sigue pudiendo escribir".
- [x] 1.3 Runner unitario del front: script `test` en `apps/web/package.json`, `allowImportingTsExtensions` en el `tsconfig` y el paso "Tests unitarios" en el job `web` de `ci.yml`.

## 2. Límite de intentos en login y registro

- [ ] 2.1 `configuracion.ts`: `limiteLoginPorMinuto` (10) y `limiteRegistroPorMinuto` (5), enteros ≥ 1, con unitarios en `configuracion.spec.ts`.
- [ ] 2.2 `auth/guard-de-limite.ts` y `ThrottlerModule.forRootAsync` en `AuthModule`, con `@Throttle` por ruta. Verificar en `auth.e2e-spec.ts` los tres escenarios del requisito nuevo.
- [ ] 2.3 `ci.yml`: el job `e2e` exporta los dos límites en un valor alto, con el motivo en un comentario. Documentar las variables en `apps/api/.env.example`, `deploy/.env.example` y README.

## 3. `volver` más estricto

- [ ] 3.1 `lib/destino-seguro.test.ts` con `/\evil.com`, `/\t/evil.com`, `//evil.com`, `https://otro.test`, `/mis-reservas?x=1` y `/`. Después `destino-seguro.ts`: rechazo de `\`, controles y `//`, y resolución contra el origen.

## 4. Detalle de reserva y `server-only`

- [ ] 4.1 `lib/ids.ts` con `esIdDeBase()` y su test; `mis-reservas/[id]/page.tsx` y `admin/reservas/[id]/page.tsx` lo usan. Verificar con Playwright que `/mis-reservas/abc` da 404 con sesión.
- [x] 4.2 `import "server-only"` en `lib/api/client.ts`; el build del front sigue en verde.

## 5. Caddy

- [ ] 5.1 `deploy/Caddyfile`: bloque `header`, HSTS con matcher `not host localhost`, `request_body { max_size 1MB }`. Verificar con `caddy validate` si está disponible; si no, con la imagen `caddy:2` por Docker.

## 6. Configuración de producción y mails

- [ ] 6.1 `configuracion.ts`: `MAIL_CONTACTO` obligatoria en producción, `JWT_SECRET` de 32 como mínimo en producción, defaults `.online`; unitarios en `configuracion.spec.ts`. `apps/api/.env.example`, `deploy/.env.example`, README y `apps/web/lib/club-datos.ts` al día.

## 7. Credenciales

- [ ] 7.1 `AuthService.ingresar` rechaza `activo = false` con el 401 genérico; unitario en `auth.service.spec.ts` y escenario "Cuenta inactiva" en `auth.e2e-spec.ts`.
- [ ] 7.2 `@MaxLength(120)` en los `email` de Login, Registro, ActualizarPerfil y Contacto; `@MaxLength(72)` en las contraseñas de Login, Registro y CambiarPassword; unitarios en `dto.spec.ts`.

## 8. Cierre

- [ ] 8.1 `npm run spec:validate`, lint, build y tests de los dos lados en verde; e2e de la API contra la base local.
- [ ] 8.2 Decisión 36 y ampliación de la nota del 2026-10-04 en `docs/memoria-proyecto.md`; `docs/estado-del-proyecto.md` al día; PR con base `main`.
