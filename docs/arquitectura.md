# Arquitectura y flujo de trabajo

Complemento del `README.md`, de `requisitos.md` y de `contratos/openapi.yaml`. El README cuenta la
arquitectura en una página; acá va el detalle de cómo se conectan las piezas y por qué.

**Stack:** Nest 12 (API) + Next 16 (front) + PostgreSQL 17 + Prisma 6 + Resend
**Repositorio:** monorepo único con npm workspaces, según pide la consigna (una sola URL de entrega)

> Este documento se puso al día el 2026-10-15 contra el código de `main`. Antes describía el
> diseño inicial de septiembre, con partes que nunca se construyeron; las decisiones tomadas en el
> camino están fechadas en [`memoria-proyecto.md`](memoria-proyecto.md), y el avance en
> [`estado-del-proyecto.md`](estado-del-proyecto.md).

---

## 1. Estructura del repositorio

```
club-deportivo-deploy/
├── apps/
│   ├── api/                       # Nest
│   │   ├── src/
│   │   │   ├── auth/              # RF-00 y RF-15: registro, login, JWT, perfil
│   │   │   ├── catalogo/          # RF-01, RF-02, RF-07, RF-12, RF-13
│   │   │   ├── disponibilidad/    # RF-03
│   │   │   ├── reservas/          # RF-04, RF-05, RF-06, RF-14
│   │   │   ├── notificaciones/    # RF-08: mails de confirmación y cancelación
│   │   │   ├── contacto/          # RF-10, con límite por IP
│   │   │   ├── administracion/    # RF-11: panel del club
│   │   │   ├── common/            # guards, decoradores, filtro de errores, pipe, Reloj, horario y cliente de mail
│   │   │   ├── prisma/            # PrismaService
│   │   │   ├── configuracion.ts   # lee y valida el entorno; corta el arranque si falta algo
│   │   │   └── configurar-app.ts  # prefijo /api/v1, CORS y el 404 fuera del prefijo
│   │   ├── prisma/                # schema.prisma, migrations/, seed.ts y carga-produccion.ts
│   │   ├── test/                  # e2e con Supertest, uno por módulo
│   │   └── Dockerfile
│   └── web/                       # Next (App Router)
│       ├── app/                   # una carpeta por pantalla; las escrituras son Server Actions (acciones.ts)
│       │   ├── (auth)/            # ingresar y registro
│       │   ├── admin/             # panel, reservas con su detalle, canchas y equipamiento
│       │   ├── mis-reservas/      # lista y detalle, con cancelación
│       │   ├── reservar/, perfil/, disponibilidad/, canchas/, contacto/, el-club/
│       │   ├── globals.css        # tokens del prototipo de Claude Design
│       │   └── error.tsx, not-found.tsx, loading.tsx
│       ├── components/            # ui/ (primitivas), layout/ (header, pie, menú) y admin/
│       ├── lib/
│       │   ├── api/schema.d.ts    # GENERADO desde openapi.yaml (npm run generate:api-types)
│       │   ├── api/client.ts      # cliente HTTP, escrito a mano sobre esos tipos; solo del servidor
│       │   └── sesion.ts          # cookie httpOnly con el JWT; solo del servidor
│       ├── proxy.ts               # redirige a /ingresar las rutas privadas sin cookie
│       ├── e2e/                   # tests de navegador con Playwright
│       └── Dockerfile
├── contratos/openapi.yaml         # fuente de verdad del contrato
├── openspec/
│   ├── specs/                     # las siete capacidades vigentes
│   └── changes/archive/           # los cambios ya implementados y archivados
├── deploy/                        # docker-compose.prod.yml y Caddyfile de la instancia EC2
├── docs/
│   ├── adr/                       # decisiones difíciles de revertir
│   ├── estado-del-proyecto.md     # qué hay y qué falta, con los comandos que lo miden
│   ├── memoria-proyecto.md        # decisiones vigentes, convenciones e historial
│   ├── despliegue.md              # puesta en marcha de la instancia, a mano
│   ├── requisitos.md, arquitectura.md, identidad.md
│   └── claude-design/             # prototipo (referencia visual)
├── .github/workflows/ci.yml
├── docker-compose.yml             # PostgreSQL 17 local (puerto 5434)
└── package.json                   # workspaces y scripts de la raíz
```

El `openapi.yaml` vive fuera de `apps/`. No es un artefacto del backend: es el contrato que las dos
aplicaciones respetan. Ubicarlo dentro de `apps/api` sugiere que pertenece al servidor, que es
exactamente la idea contraria al enfoque API-First.

---

## 2. Flujo de autenticación entre los dos servicios

Esta es la decisión de arquitectura más importante del proyecto.

**La autenticación vive en Nest.** Next no emite ni valida tokens: los guarda y los reenvía.

```
  Next.js (servidor)               Nest.js                    PostgreSQL
     │                                │                            │
     │  POST /auth/login              │                            │
     │───────────────────────────────►│  verifica bcrypt           │
     │                                │───────────────────────────►│
     │  { accessToken, expiraEn }     │                            │
     │◄───────────────────────────────│                            │
     │                                │                            │
     │  guarda el token en la cookie  │                            │
     │  `sesion`, httpOnly            │                            │
     │                                │                            │
     │  POST /reservas                │                            │
     │  Authorization: Bearer <jwt>   │  JwtAuthGuard              │
     │───────────────────────────────►│  RolesGuard                │
     │                                │  usuarioId = payload.sub   │
     │  201 Created                   │───────────────────────────►│
     │◄───────────────────────────────│                            │
```

**Por qué no Auth.js en Next.** Es la opción natural para un Next standalone, pero acá el
entregable evaluado es el contrato de la API. Si el login vive en el front, los endpoints de Nest
quedan sin descripción de seguridad en el `openapi.yaml` y la API no puede defenderse por sí sola.
Un `curl` directo contra el backend saltearía toda la autenticación. Con el JWT emitido y validado
en Nest, el contrato describe el sistema completo.

**El ingreso con Google quedó descartado el 27/09** y no se implementa
([ADR 0001](adr/0001-login-con-google.md)). Si algún día se retoma, el front obtiene el `id_token`
de Google y se lo manda a la API; Nest lo verifica y emite **su** JWT, el mismo de `/auth/login`.

**Cómo protege la API.** `JwtAuthGuard` es global en `AppModule`: todo endpoint exige token salvo
los marcados con `@Publico()`. `RolesGuard` corre después y mira `@Roles('ADMIN')`. El payload del
JWT es mínimo (`sub` y `rol`), y `@UsuarioActual()` entrega ese usuario al controlador; ningún
endpoint toma el id del usuario del body ni de la URL. Las reservas ajenas responden 404, no 403
(RN-13), para no revelar que existen.

**El token va en una cookie `httpOnly`, no en `localStorage`.** Una cookie `httpOnly` no es
accesible desde JavaScript, así que un XSS no puede robar la sesión. El navegador nunca habla con
la API: las lecturas las hacen los Server Components y las escrituras las Server Actions
(`acciones.ts` de cada pantalla), y las dos pasan por `lib/api/client.ts`, que lee la cookie en
`lib/sesion.ts` y agrega el header `Authorization`. `sesion.ts` importa `server-only`, así un
`import` desde un componente cliente rompe el build, y `API_URL` no lleva el prefijo
`NEXT_PUBLIC`, así que el navegador nunca la ve. `proxy.ts` solo mira si la cookie existe y
redirige a `/ingresar?volver=…`; la autorización real es siempre el 401 o 403 de la API.

**CORS.** Nest habilita solo el origen del front (`FRONTEND_URL`). Nada de `origin: '*'`.

---

## 3. El cliente tipado se genera, no se escribe

Este es el punto donde el enfoque API-First deja de ser una declaración de intenciones y pasa a
ser verificable.

```bash
npm run generate:api-types   # openapi-typescript contratos/openapi.yaml -o apps/web/lib/api/schema.d.ts
```

`schema.d.ts` está versionado y `lib/api/types.ts` le pone nombres cortos a los esquemas
(`Reserva`, `Cancha`, `ApiError`). El cliente `client.ts` se escribe a mano, pero sobre esos tipos.
La consecuencia: **si alguien cambia el contrato y no el front, el build del front se rompe**,
porque el job `web` del CI corre TypeScript sobre los tipos regenerados.

Lo que ata la API al contrato son los **tests e2e de Supertest** (`apps/api/test/`), uno por
módulo, que piden cada operación contra PostgreSQL real y verifican los códigos, las respuestas y
los errores que el `openapi.yaml` y las specs describen. No hay un *contract drift check*
automático que exporte el OpenAPI de Nest y lo
compare: se evaluó (`@nestjs/swagger` genera uno, pero es *code-first*, lo contrario de lo que pide
la consigna) y quedó a futuro. Si se suma, va como job de CI y como check obligatorio (sección 7).

```
contratos/openapi.yaml  ──genera tipos──►  apps/web (el build verifica)
        │
        └──lo implementa──►  apps/api (los e2e verifican)
```

---

## 4. Manejo de errores

`FiltroDeErrores` (`common/filtro-de-errores.ts`) es el único filtro de excepciones de Nest y
traduce todo al formato `Error` del contrato: `tipo`, `titulo`, `estado`, `detalle` opcional e
`instancia`. Sin él, Nest devuelve su propio formato (`{ statusCode, message, error }`) y la API no
cumple lo que promete.

| Origen | Resultado |
|---|---|
| `ErrorDeApi` lanzado por un servicio (409 `SLOT_NO_DISPONIBLE`, `EMAIL_YA_REGISTRADO`, `NOMBRE_DUPLICADO`, 422 de reglas de negocio, 429 de límites) | Sale tal cual: cada servicio elige `tipo`, `titulo` y `estado` |
| `HttpException` de Nest (400 del `ValidationPipe`, 401 del guard, 403 de roles, 404) | `SOLICITUD_INVALIDA`, `NO_AUTENTICADO`, `SIN_PERMISOS`, `NO_ENCONTRADO`, con el primer mensaje de validación como `detalle` |
| Error del parser del cuerpo (JSON roto, cuerpo de más de 100 KB) | 400 `SOLICITUD_INVALIDA` o 413 `CUERPO_DEMASIADO_GRANDE` |
| Cualquier otra cosa | 500 `ERROR_INTERNO`, genérico; el stack va solo al log |
| Ruta fuera de `/api/v1` | 404 `NO_ENCONTRADO` en JSON, desde `configurar-app.ts`, porque esa ruta no llega al filtro |

Los errores de Prisma no se traducen en el filtro sino donde se saben interpretar: `POST /reservas`
distingue por las columnas del `P2002` si chocó el turno (409 al cliente, RN-01) o el código de
reserva (se genera otro y se reintenta), y el registro traduce el mail repetido a
`EMAIL_YA_REGISTRADO`.

---

## 5. Entornos y variables

Cada aplicación tiene su `.env.example` versionado, con las claves vacías salvo las que son iguales
en todas las máquinas (`DATABASE_URL`, `API_URL`). Los `.env` reales están en `.gitignore` con
comodín (`.env*`), porque una clave de Resend commiteada en un repo público es un problema real,
no una formalidad.

| Dónde | Qué hay | Detalle |
|---|---|---|
| `apps/api/.env.example` | `DATABASE_URL`; `JWT_SECRET` y `JWT_EXPIRES_IN` (obligatorias siempre); `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_CONTACTO`, `FRONTEND_URL`; horario (`HORA_APERTURA`, `HORA_CIERRE`, `HORA_CIERRE_SABADO`, `DIAS_CERRADOS`, `ZONA_HORARIA_CLUB`); reglas de reserva (`HORIZONTE_RESERVA_DIAS`, `MAX_RESERVAS_ACTIVAS_SOCIO`, `PREFIJO_CODIGO_RESERVA`, `CANCELACION_MINUTOS_MINIMOS`) | `configuracion.ts` las lee una vez y **corta el arranque** si falta una obligatoria o un valor es inválido. En producción además exige `FRONTEND_URL` y `RESEND_API_KEY`. Sin `RESEND_API_KEY` fuera de producción, el mail es un doble que escribe al log |
| `apps/web/.env.example` | `API_URL` y las variables de horario y cancelación, con los mismos nombres y valores que la API | El sitio dibuja la grilla y decide si muestra el botón de cancelar; la API decide de verdad. Si cambian, cambian en los dos |
| `deploy/.env.example` | Lo mismo para la instancia, más `POSTGRES_PASSWORD`, `DOMINIO`, `GHCR_OWNER` e `IMAGE_TAG` | Vive solo en la instancia, con permisos `600`; GitHub guarda únicamente lo que hace falta para entrar por SSH ([ADR 0003](adr/0003-despliegue-en-ec2.md)) |

El README lista cada variable con su valor por defecto y qué hace.

---

## 6. Integración continua

`.github/workflows/ci.yml` corre en cada PR y en cada push a `main`. Ese archivo es la fuente de
verdad; acá va el resumen.

| Job | Qué hace |
|---|---|
| `specs` | `npm ci`, `npm run spec:validate` (`openspec validate --all --strict`) y `npm run contrato:lint` (Redocly) |
| `api` | Espera a `specs`. Con un service container `postgres:17`: `prisma migrate deploy` sobre una base vacía, y lint, build, tests unitarios y e2e de la API. El `JWT_SECRET` se genera al azar en cada corrida: nunca hay uno escrito en el repo. La clave de la base sale del secreto `CI_POSTGRES_PASSWORD` |
| `web` | Espera a `specs`. Lint y build de Next; el build corre TypeScript, así que también verifica los tipos generados desde el contrato |
| `e2e` | Espera a `api` y `web`. Levanta la pila entera (Postgres con el seed, la API con `start:prod` y el front construido) y corre los tests de navegador con Playwright ([ADR 0002](adr/0002-tests-e2e-con-playwright.md)). Si falla, sube el reporte como artefacto |
| `imagenes` y `deploy` | Solo en push a `main`, después de `e2e`, y solo si la variable del repo `DEPLOY_HABILITADO` es `true`. Construyen las imágenes, las publican en GHCR y despliegan por SSH en la instancia ([ADR 0003](adr/0003-despliegue-en-ec2.md)). No son checks obligatorios porque corren después del merge |

- Node sale de `.nvmrc` (`node-version-file`), y OpenSpec y Redocly son devDependencies de la
  raíz: el CI usa las mismas versiones que las máquinas del equipo.
- `specs` va primero. Si la especificación no valida, no tiene sentido gastar minutos corriendo
  tests contra un contrato roto.
- La base de datos del CI es un **service container**, no un mock. `migrate deploy` confirma que
  las migraciones, incluido el índice único parcial de RN-01, se aplican desde cero, y los tests
  corren contra PostgreSQL real, que es la única forma de verificar que ese índice hace lo que dice.
- `api` y `web` corren en paralelo; `e2e` espera a los dos porque necesita el build de cada uno.
- Los cuatro checks son obligatorios para mergear (sección 7). Al sumar un job que deba bloquear,
  hay que agregarlo también al ruleset.

---

## 7. Bloqueo del merge (esto no está en el YAML)

El workflow por sí solo no bloquea nada. Pinta la ejecución de rojo y el botón de merge sigue
disponible. **El bloqueo se configura en GitHub** y es un requisito explícito de la consigna.

Está implementado como un **ruleset** sobre `main` (`Settings → Rules → Rulesets`), activo desde
el 24/09 y con `e2e` como cuarto check desde el 30/09. Solo puede editarlo una cuenta con permisos
de admin (hoy, `rociobazan`). Lo que exige:

- Pull request obligatorio, con **1 aprobación** mínima.
- Los checks `specs`, `api`, `web` y `e2e` en verde, y la rama al día con `main` antes de mergear.
- Borrar `main` y hacer *force push* están bloqueados.
- **Nadie puede saltearla**: la lista de *bypass* está vacía, administradores incluidos. Sin eso,
  el dueño del repo podría ignorar todo y la protección sería decorativa.

Se verifica sin ser admin, y es lo que el README muestra como tabla en vez de una captura, porque
una captura no se puede reproducir y envejece sin que nadie se entere:

```bash
gh api repos/rociobazan/club-deportivo-deploy/rules/branches/main
```

Tiene que devolver las cuatro reglas (`deletion`, `non_fast_forward`, `pull_request` y
`required_status_checks`). Si devuelve `[]`, no está protegiendo nada.

Los PRs anteriores al 24/09 entraron sin aprobación registrada, porque la protección no existía.
Desde entonces GitHub la exige sola; lo que sigue siendo manual es **pedir la review** en GitHub,
porque avisar por el grupo no crea la solicitud.

---

## 8. Convenciones de Git

**Ramas:** `feature/spec-<nombre>` para especificaciones y funcionalidades, `fix/<nombre>` para
correcciones, `chore/<nombre>` para configuración y `docs/<nombre>` para documentación.

**Commits:** formato convencional, en castellano.

```
feat(reservas): validar stock de equipamiento por slot
fix(auth): devolver 401 genérico ante credenciales inválidas
test(disponibilidad): cubrir slots pasados del día actual
docs(contrato): declarar el 409 de nombre duplicado
```

**Cada integrante commitea desde su propia cuenta.** La consigna evalúa la distribución del trabajo
en el historial. Si uno sube todo "porque es más rápido", el repositorio muestra un solo autor y
ese punto se pierde entero.

**Sin atribución a agentes de IA** en commits, PRs ni issues: la lista de *Contributors* es parte de
la evaluación. El detalle está en [`AGENTS.md`](../AGENTS.md).

**Un PR apilado sobre otra rama lleva `main` de base igual.** El 28/09 se mergeó una pila con las
bases apiladas y cuatro PRs terminaron adentro de su rama base en vez de en `main`; hubo que
rehacerlos. Quien mergea no siempre lee la nota del cuerpo del PR, así que la base se pone bien
desde el principio.

**Una feature, un cambio de OpenSpec.** `/opsx:propose` → revisión de los cuatro → `/opsx:apply`
en la rama → merge → `openspec archive <cambio>` en un PR propio, de a uno. Si no se archiva, las
specs dejan de describir lo que el código hace.

No hay plantilla de PR en el repo. El cuerpo de cada PR dice qué resuelve, qué requisitos y
reglas cubre, y qué queda fuera; el CI y el ruleset se encargan del resto.

---

## 9. Cómo se repartió el trabajo

El orden de trabajo que planteaba este documento en septiembre (contrato base y CI primero,
después las features en ramas paralelas, con autenticación como camino crítico) se cumplió. El
reparto final, quién hizo qué y con qué PR, está en la sección 3 de
[`estado-del-proyecto.md`](estado-del-proyecto.md), y las decisiones que lo fueron cambiando, en
[`memoria-proyecto.md`](memoria-proyecto.md).

La lección que vale la pena conservar: el CI y la protección de `main` fueron antes que las
features a propósito. Si se configuran al final, los PRs anteriores se mergean sin validación y el
historial de ejecuciones verdes queda vacío justo donde se lo va a mirar.
