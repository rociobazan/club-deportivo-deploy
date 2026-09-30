# Tasks

Referencias: los dos requisitos nuevos en `specs/autenticacion/spec.md` de este cambio y el requisito modificado en `specs/institucional/spec.md`; las decisiones en `design.md`. Los nombres de los tests citan el escenario que cubren. Son **10 escenarios de API** y **8 de pantalla**, estos últimos con tests de navegador.

## 1. Rama y contrato

- [x] 1.1 Confirmar que `git branch --show-current` devuelve `feature/spec-perfil-de-usuario` y que `git rev-list --left-right --count main...HEAD` no muestra commits de `main` faltantes. Commits en castellano y sin trailers de atribución (`AGENTS.md`).
- [x] 1.2 Sumar a `contratos/openapi.yaml` las dos operaciones: `PATCH /auth/perfil` (request `ActualizarPerfilRequest` con `nombre`, `apellido`, `email` y `telefono`, todos opcionales y con los mismos `maxLength` y formatos que `RegistroRequest`; respuestas 200 con el schema que ya devuelve `GET /auth/perfil`, 400, 401 y 409) y `PUT /auth/password` (request `CambiarPasswordRequest` con `actual` y `nueva`, `minLength: 8` en la nueva; respuestas 204, 400 y 401). Verificar con `npm run contrato:lint` en verde y que `grep -cE "^    (get|post|put|patch|delete):" contratos/openapi.yaml` devuelve **20**.
- [x] 1.3 Regenerar los tipos del front con `npm run generate:api-types`. Verificar que `git diff apps/web/lib/api/schema.d.ts` muestra solo lo agregado y que `npm run build --workspace web` sigue pasando.

## 2. API: modificar los datos del perfil

- [x] 2.1 Crear `apps/api/src/auth/dto/actualizar-perfil.dto.ts`: los cuatro campos opcionales con las mismas validaciones que el registro, más una validación propia que rechace el body sin ningún campo. Verificar con unitarios del pipe: un `rol` de más da 400 por `forbidNonWhitelisted` (escenario "Intento de cambiar el rol o el estado de la cuenta"); un body `{}` da 400 (escenario "Solicitud sin ningún campo"); un mail mal formado da 400.
- [x] 2.2 Implementar `actualizarPerfil()` en `auth.service.ts`: actualiza solo los campos presentes del usuario del token y devuelve el perfil con la misma forma que `obtenerPerfil()`. El choque de mail se detecta capturando el `P2002` de Prisma sobre el índice de `email`, no con un `findFirst` previo (`design.md` §3), y se traduce a 409 `MAIL_YA_REGISTRADO`. Verificar con unitarios con Prisma mockeado: cambio de teléfono devuelve el perfil actualizado (escenario "Cambio de datos de contacto"); un `P2002` de `email` produce 409 (escenario "Mail ya usado por otra cuenta"); cualquier otro error se propaga.
- [x] 2.3 Sumar `PATCH /auth/perfil` a `auth.controller.ts`, con `@UsuarioActual()` y **sin** `@Publico()`, de modo que el guard global exija sesión. Verificar `npm run lint --workspace api` y `npm run build --workspace api` en verde.

## 3. API: cambiar la contraseña

- [x] 3.1 Crear `apps/api/src/auth/dto/cambiar-password.dto.ts` con `actual` y `nueva`, la nueva con el mismo mínimo de 8 caracteres que el registro. Verificar con unitario del pipe que una nueva de 7 caracteres da 400 (escenario "Contraseña nueva demasiado corta").
- [x] 3.2 Implementar `cambiarPassword()` en `auth.service.ts`: verifica la actual con el mismo `bcrypt.compare` que usa el login, hashea la nueva y persiste. Si la actual no coincide, 401 `CREDENCIALES_INVALIDAS`. Verificar con unitarios: contraseña correcta persiste un hash distinto al anterior (escenario "Cambio de contraseña"); contraseña incorrecta da 401 y **no** escribe (escenario "Contraseña actual incorrecta").
- [x] 3.3 Sumar `PUT /auth/password` a `auth.controller.ts` con `@HttpCode(204)` y `@UsuarioActual()`. Verificar lint y build de la API en verde.

## 4. e2e de la API

- [x] 4.1 Sumar a `apps/api/test/auth.e2e-spec.ts` un `describe` por requisito y un `it` por escenario, para los 10 de `Datos de la cuenta modificables por su titular`. Datos propios con `@e2e.test`, creados y borrados por el test. Verificar `npm run test:e2e --workspace api` en verde y que la cuenta de `it` coincide con los `#### Scenario:` del delta.
- [x] 4.2 Cubrir explícitamente los dos escenarios que sostienen las decisiones de `design.md`: **"La sesión sobrevive al cambio de mail"** (cambiar el mail y volver a pedir `GET /auth/perfil` con el **mismo** token, esperando 200) y **"Cambio de contraseña"** verificando las dos mitades: que la contraseña vieja deja de servir para `POST /auth/login` y que la nueva sirve. Verificar que el primero falla si se reemitiera el token, y el segundo si solo se comprobara el 204.

## 5. Front: pantalla `/perfil`

- [x] 5.1 Leer antes de escribir (`apps/web/AGENTS.md`): en `node_modules/next/dist/docs/`, lo de Server Functions y `useActionState`. Verificar anotando en la descripción del PR cualquier convención que difiera de lo que asume `design.md` §6.
- [x] 5.2 Crear `apps/web/app/perfil/page.tsx` (Server Component): pide `GET /auth/perfil` con el token y `timeoutMs: 2000`, y ante `ApiHttpError` muestra `EstadoError` con "Reintentar". Verificar en el navegador el escenario "API sin respuesta" con la API apagada, con header y pie visibles.
- [x] 5.3 Crear `apps/web/app/perfil/formulario-datos.tsx` y `formulario-password.tsx` (Client Components con `useActionState`), y `acciones.ts` (`"use server"`) con las dos server actions, siguiendo el patrón de `app/(auth)/acciones.ts`. Los dos formularios son independientes: un error en uno no toca lo cargado en el otro (`design.md` §6). Los campos de contraseña se vacían después de cada intento, salga bien o mal.
- [x] 5.4 Verificar en el navegador los escenarios de pantalla: "Socio abre su perfil", "Cambio guardado", "Mail ya usado" (el error junto al campo del mail, conservando lo escrito), "Aviso al cambiar el mail", "Contraseña cambiada", "Contraseña actual incorrecta" y "Visitante sin sesión".

## 6. Front: menú y tests de navegador

- [x] 6.1 En `apps/web/components/layout/navegacion.ts`, dejar el menú del `SOCIO` en Disponibilidad, Mis reservas, Contacto y Mi perfil. No tocar el del `ADMIN` ni el público. Sumar `/perfil` al `matcher` de `apps/web/proxy.ts`. Verificar que sin sesión `/perfil` redirige a `/ingresar?volver=/perfil`.
- [x] 6.2 Crear `apps/web/e2e/perfil.spec.ts` con, como mínimo, el redirect sin sesión, "Socio abre su perfil" y "Cambio guardado", reusando el patrón de registro de `autenticacion.spec.ts` (usuario `@e2e.test` por corrida), que no necesita datos sembrados. Verificar `npm run e2e --workspace web` en verde con la pila levantada.
- [x] 6.3 Sumar a `apps/web/e2e/institucional.spec.ts` el escenario "Usuario con sesión": el menú del socio muestra los cuatro ítems y **no** muestra Inicio ni El club. Verificar que el test falla si se deja el menú viejo: es el único que sostiene el cambio de la spec `institucional`.

## 7. Documentación, revisión y PR

- [x] 7.1 `README.md`: sumar `/perfil` al recorrido del sitio. `docs/memoria-proyecto.md`: decisión nueva con lo que este cambio deja fijado (rutas bajo `/auth`, el 409 por la base, la contraseña en operación aparte, el token que sobrevive al cambio de mail y el límite de las sesiones no revocables) y su línea en el historial. `docs/estado-del-proyecto.md`: la pantalla nueva y las operaciones con endpoint actualizadas.
- [x] 7.2 **Preguntarle al equipo si esto se numera como requisito funcional nuevo** en `docs/requisitos.md` (es la *Open Question* de `design.md`). Si dicen que sí, sumarlo ahí y en las tablas; si dicen que no, dejar anotado en la memoria que se decidió no numerarlo. Verificar que la respuesta quedó escrita en algún lado, no solo conversada.
- [x] 7.3 Correr `npm run spec:validate`, `npm run contrato:lint`, `npm run test --workspace api`, `npm run test:e2e --workspace api`, `npm run e2e --workspace web`, lint y build de `web`, y `/code-review` sobre el diff contra `main`; corregir lo que salga. Verificar que todo termina sin errores ni hallazgos abiertos.
- [x] 7.4 Abrir el PR **hacia `main`**, con la lista de escenarios verificados a mano y el límite de las sesiones no revocables declarado. Verificar que el CI muestra `specs`, `api`, `web` y `e2e` en verde y que el PR espera la aprobación de otro integrante.
