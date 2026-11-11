# Tasks

Referencias: los requisitos nuevos y modificados de `specs/autenticacion/spec.md` de este cambio, y las decisiones de `design.md`. Los nombres de los tests citan el escenario que cubren. Son **15 escenarios nuevos de API** (11 de la recuperación, 2 del límite, 1 de endpoints públicos y 1 de largo máximo) y **8 de pantalla**.

## 1. Rama, contrato y modelo

- [x] 1.1 Confirmar que `git branch --show-current` devuelve `feature/spec-recuperar-password` y que `git rev-list --left-right --count origin/main...HEAD` no muestra commits de `main` faltantes. Commits en castellano y sin trailers de atribución (`AGENTS.md`).
- [x] 1.2 Sumar a `contratos/openapi.yaml` `POST /auth/recuperacion` (request `RecuperarPasswordRequest` con `email`, `maxLength: 120`; respuestas 202 sin cuerpo, 400 y 429; `security: []`) y `POST /auth/restablecimiento` (request `RestablecerPasswordRequest` con `token` y `passwordNueva`, `minLength: 8` y `maxLength: 72`; respuestas 204, 400 con `SOLICITUD_INVALIDA` o `ENLACE_INVALIDO`, y 429; `security: []`). Subir `info.version` a 2.4.0. Verificar con `npm run contrato:lint` en verde y que `grep -cE "^    (get|post|put|patch|delete):" contratos/openapi.yaml` da dos más que antes.
- [x] 1.3 Regenerar los tipos del front con `npm run generate:api-types` y sumar los alias en `apps/web/lib/api/types.ts`. Verificar que `git diff apps/web/lib/api/schema.d.ts` muestra solo lo agregado.
- [x] 1.4 Sumar el modelo `TokenRecuperacion` a `apps/api/prisma/schema.prisma` (`design.md` §2: FK con `onDelete: Cascade`, `tokenHash` `Char(64)` único, índice `(usuarioId, creadoEn)`) y generar la migración con `npm run db:migrate`. Verificar que el SQL generado solo tiene `CREATE TABLE`, `CREATE INDEX` y la FK, y que **no** contiene `DROP INDEX` de `ux_reserva_slot_activo` (decisión 6).

## 2. Configuración

- [x] 2.1 Sumar a `apps/api/src/configuracion.ts` `recuperacionVigenciaMinutos` (60), `limiteRecuperacionPorMinuto` (5) y `maxRecuperacionesPorHora` (3), leídas con `entero()` y mínimo 1. Documentarlas en `apps/api/.env.example`. Verificar con los unitarios de configuración: los valores por defecto y un valor inválido que corta el arranque.
- [x] 2.2 Sumar `LIMITE_RECUPERACION_POR_MINUTO: 1000` al job `e2e` de `.github/workflows/ci.yml`, junto a los otros dos límites, y la variable a `deploy/docker-compose.prod.yml` si ese archivo lista las de login y registro. Verificar leyendo el diff.

## 3. API: solicitud de recuperación

- [x] 3.1 Crear `dto/recuperar-password.dto.ts` con `email` (formato de mail, máximo 120). Verificar con unitarios del pipe que un mail de 121 caracteres y un campo de más dan 400.
- [x] 3.2 Implementar en `auth.service.ts` la emisión del token (`design.md` §1, §2 y §5): busca la cuenta por mail normalizado; si no existe o no está activa, no hace nada; si la cuenta ya tiene `MAX_RECUPERACIONES_POR_HORA` tokens creados en la última hora según `Reloj`, no hace nada; si no, marca como usados los tokens sin usar de la cuenta, crea uno nuevo con su hash SHA-256 y vencimiento, y envía el mail de `design.md` §7 con el enlace a `frontendUrl`. Verificar con unitarios con Prisma, `Reloj` y `CorreoDoble`: mail enviado con un enlace cuyo token hashea al guardado; mail inexistente e inactiva sin envío; cuarto pedido en la hora sin envío ni invalidación.
- [x] 3.3 Sumar `POST /auth/recuperacion` al controlador con `@Publico()`, `@HttpCode(202)` y `GuardDeLimiteDeAuth`. Responde sin esperar el trabajo del punto 3.2 y lo dispara con un `catch` que loguea la falla con el id de usuario y sin el token (`design.md` §3). Verificar con un unitario que una falla del correo no rechaza la respuesta y deja una línea de log sin el token.

## 4. API: restablecimiento

- [x] 4.1 Crear `dto/restablecer-password.dto.ts` con `token` (string no vacío, largo máximo acotado) y `passwordNueva` (mínimo 8, máximo 72). Verificar con unitarios del pipe los dos límites de la contraseña.
- [x] 4.2 Implementar el restablecimiento (`design.md` §4): busca por hash un token sin usar y vigente según `Reloj` de una cuenta activa; en una transacción marca usado ese token con un `updateMany` condicionado y verifica una fila afectada, marca usados los demás de la cuenta y guarda el hash bcrypt de la nueva. Cualquier otro caso es 400 `ENLACE_INVALIDO`. Verificar con unitarios: token válido, vencido, usado e inventado.
- [x] 4.3 Sumar `POST /auth/restablecimiento` al controlador con `@Publico()`, `@HttpCode(204)` y `GuardDeLimiteDeAuth`. Registrar el throttler `recuperacion` en `auth.module.ts` y sumar `@SkipThrottle({ recuperacion: true })` a login y registro, y viceversa. Verificar `npm run lint --workspace api` y `npm run build --workspace api` en verde y los unitarios de `guard-de-limite.spec.ts`.

## 5. e2e de la API

- [x] 5.1 Crear un helper de espera acotada que lea `CorreoDoble.enviados` hasta encontrar el mail de una dirección, para el envío en segundo plano (`design.md` §3). Verificar que falla con un mensaje claro si el mail no llega en el tiempo límite.
- [x] 5.2 Sumar a `apps/api/test/auth.e2e-spec.ts` un `describe` por requisito y un `it` por escenario de la API, con usuarios `@e2e.test` creados y borrados por el test y `overrideProvider(Reloj)` para el vencimiento. Verificar `npm run test:e2e --workspace api` en verde y que la cantidad de `it` nuevos coincide con los escenarios de API del delta.
- [x] 5.3 Cubrir explícitamente las dos mitades de "Restablecimiento con un token válido" (la contraseña vieja ya no ingresa y la nueva sí) y que las respuestas de "Solicitud para un mail que no existe" y "Solicitud para una cuenta activa" tienen el mismo código y el mismo cuerpo. Verificar que el primero falla si solo se comprobara el 204.

## 6. Front: pantallas

- [x] 6.1 Leer antes de escribir (`apps/web/AGENTS.md`): en `node_modules/next/dist/docs/`, lo de `searchParams` asíncronos, Server Functions y `redirect`. Anotar en la descripción del PR cualquier convención que difiera de lo que asume `design.md` §8.
- [x] 6.2 Sumar las Server Functions `pedirRecuperacion` y `restablecerPassword` a `app/(auth)/acciones.ts`, con `encabezadosDelVisitante()`. Validan el mail y la coincidencia de las dos contraseñas antes de llamar a la API, y `restablecerPassword` redirige a `/ingresar?restablecida=1`. Verificar con `npm run lint --workspace web`.
- [x] 6.3 Crear `app/(auth)/recuperar/page.tsx` y su formulario, con la tarjeta de `/ingresar`. Verificar a mano los escenarios "Pedido de enlace", "Pedido con un mail no registrado" y "Mail mal escrito".
- [x] 6.4 Crear `app/(auth)/restablecer/page.tsx` y su formulario: sin `token` muestra el aviso de enlace inválido y el acceso a `/recuperar`; con `token` lo manda en un campo oculto. Verificar a mano "Contraseñas que no coinciden", "Enlace vencido o usado" y "Enlace sin token".
- [x] 6.5 Sumar a `/ingresar` el link "¿Olvidaste tu contraseña?" y el aviso cuando llega `restablecida=1`. Verificar a mano "Link desde el ingreso" y el aviso.
- [x] 6.6 Verificar `npm run build --workspace web` en verde y que `/recuperar` y `/restablecer` no quedaron en el `matcher` de `proxy.ts`.

## 7. Tests de navegador

- [x] 7.1 Crear `apps/web/e2e/recuperacion.spec.ts` con un test por escenario de pantalla, salvo "Contraseña restablecida", que cubre el e2e de la API (`design.md` §9). Verificar `npx playwright test` en verde contra la pila local.

## 8. Docs y cierre

- [x] 8.1 `docs/requisitos.md`: sumar `RF-16 — Recuperación de contraseña` al final, sin renumerar, y sacar la recuperación de las líneas de alcance y de "Fuera del MVP" (la verificación de mail queda fuera). Verificar con `grep -n "Recuperación de contraseña" docs/requisitos.md`.
- [x] 8.2 `docs/memoria-proyecto.md`: decisión nueva con lo que deja fijado este cambio y una línea en el historial; `docs/estado-del-proyecto.md`: el RF-16, los conteos de tests y la limpieza de tokens como pendiente. Verificar que los números salen de los comandos del propio documento.
- [x] 8.3 Correr lint, build y tests de `api` y `web`, `npm run spec:validate` y `npm run contrato:lint`. Verificar todo en verde antes de abrir el PR.
