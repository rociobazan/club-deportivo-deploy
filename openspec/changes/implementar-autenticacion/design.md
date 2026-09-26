# Design

## Context

Ver `proposal.md` para la motivación. Lo que condiciona el cómo:

- **La sesión la emite y valida Nest** (`docs/arquitectura.md` §2). Next no emite tokens: los guarda en una cookie `httpOnly` y los reenvía. El ADR 0001 (Google) respeta esto y entra después.
- **La spec de `autenticacion` ya fija el comportamiento de la API**, escenario por escenario, incluido el formato único de errores y qué endpoints son públicos. Este diseño no la reinterpreta.
- **El diseño archivado ya tomó decisiones para el front** (decisiones 14 y 15 de `openspec/changes/archive/2026-09-21-especificacion-base-reservas/design.md`): `proxy.ts` para redirigir rutas privadas, `cookies()` asíncrona, el registro con nombre y apellido separados, la autorización real en el 401/403 de la API.
- **Next 16.3.4** (leído en `node_modules/next/dist/docs/`): una cookie solo se puede escribir o borrar desde una Server Function o un Route Handler, nunca durante el render; el `proxy.ts` corre en cada ruta, incluidas las prefetcheadas, así que ahí solo se lee la cookie y no se consulta nada.
- **Nest 12 es solo ESM y Jest corre con `--experimental-vm-modules`** (decisión 16 de la memoria). Cualquier librería nueva tiene que cargar en ese entorno; se verifica en la primera tarea, antes de escribir código encima.
- `apps/api/src` tiene solo el andamiaje. No hay `PrismaService`, ni pipe, ni filtro, ni prefijo, ni CORS. El seed deja `admin@club.test` (ADMIN) y `socio@club.test` (SOCIO) con clave `clave1234`.
- El front ya tiene el cliente HTTP (`apiFetch`, que acepta `token`) y el header con el prop `usuario?: UsuarioDelHeader` esperando la sesión.

## Goals / Non-Goals

**Goals:**

- Cumplir los siete requisitos existentes de `autenticacion` y los cuatro agregados, con un test por escenario del lado de la API.
- Dejar guards y decoradores que 1.3, 1.4 y 1.6 usen sin tocar nada: proteger un endpoint tiene que ser agregar un decorador, y **olvidarse del decorador tiene que dejarlo protegido, no abierto**.
- Que ningún error salga de la API con el formato por defecto de Nest.

**Non-Goals:**

- Refresh tokens, "recordarme", múltiples sesiones, revocación: el token vence y se vuelve a ingresar.
- Tests automatizados del front: el workspace `web` todavía no tiene runner (pendiente del equipo). Las pantallas se verifican a mano en el navegador y con `lint` y `build`.
- Rate limiting del login. Queda anotado en riesgos.

## Decisions

### 1. JWT con `@nestjs/jwt` y guards propios, sin Passport

`@nestjs/jwt` 12.0.2 envuelve `jsonwebtoken` y alcanza para firmar y verificar. El `JwtAuthGuard` lee `Authorization`, verifica con `JwtService.verifyAsync` y deja `{ id, rol }` en `request.usuario`. El `RolesGuard` lee la metadata de `@Roles(...)`.

*Alternativa descartada*: `@nestjs/passport` + `passport-jwt`. Es el camino "clásico" de Nest, pero agrega dos dependencias y una capa de estrategias que solo paga cuando hay varios mecanismos de login. Acá hay uno, y Google (ADR 0001) va a entrar como un endpoint que emite el mismo JWT, no como otra estrategia.

### 2. Protección por defecto: los dos guards son globales y lo público se marca

Se registran `JwtAuthGuard` y `RolesGuard` con `APP_GUARD`. Un endpoint sin decoradores exige token. `@Publico()` lo exime; `@Roles('ADMIN')` restringe. Así, un endpoint nuevo que alguien olvide decorar **falla cerrado**.

*Alternativa descartada*: `@UseGuards(JwtAuthGuard)` endpoint por endpoint. Es lo que muestran los ejemplos de Nest, pero hace que el olvido deje el endpoint abierto, que es el error más caro en un TP donde el contrato describe la seguridad.

Los endpoints públicos con variante privada (`GET /canchas?incluirInactivas=true`, que exige ADMIN) no son de este cambio: quien los implemente marca el endpoint `@Publico()` y resuelve el rol adentro, porque el guard no puede decidir por un query param. Se deja documentado en el decorador.

### 3. Validación con `class-validator` y `ValidationPipe` global

DTOs con decoradores (`RegistroDto`, `LoginDto`) y `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. Un campo no declarado —como `rol` en el registro— produce 400 `SOLICITUD_INVALIDA`, que es exactamente el escenario "Intento de elegir el rol". Versiones verificadas: `class-validator` 0.15.1, `class-transformer` 0.5.1.

*Alternativa descartada*: `zod` con un pipe propio. Funciona igual de bien, pero mezclar dos estilos de validación en una API de cuatro personas es peor que elegir el idiomático de Nest. Si el equipo prefiere `zod`, se cambia en este mismo cambio, no después.

### 4. Un solo filtro de excepciones que habla el contrato

`FiltroDeErrores` (`@Catch()`) convierte todo en el schema `Error`: `tipo`, `titulo`, `estado`, `detalle` opcional e `instancia` con la ruta **sin** el prefijo `/api/v1`, como ejemplifica la spec (`/canchas`). Los errores de negocio se lanzan con una excepción propia `ErrorDeApi(estado, tipo, titulo, detalle?)`. Lo que no es `HttpException` sale como 500 `ERROR_INTERNO` con título genérico, y el detalle real va al log del servidor, nunca a la respuesta.

Los 400 del `ValidationPipe` se remapean acá a `SOLICITUD_INVALIDA` con el primer mensaje de validación como `detalle`; los 401 y 403 de los guards salen como `NO_AUTENTICADO` y `SIN_PERMISOS`.

### 5. Login que no revela si el mail existe

Ante mail inexistente, el servicio compara la contraseña recibida contra un hash bcrypt fijo antes de responder, para que el tiempo de respuesta sea el mismo que ante contraseña incorrecta. Las dos ramas lanzan el mismo `ErrorDeApi(401, 'CREDENCIALES_INVALIDAS', ...)`. El mail se normaliza en minúsculas al registrar y al ingresar, porque `usuario.email` es `UNIQUE` y `Ana@club.test` y `ana@club.test` son la misma persona.

### 6. `expiraEn` sale del token, no de parsear la configuración

Después de firmar, se decodifica el token y `expiraEn = exp - iat`. Así `JWT_EXPIRES_IN` acepta cualquier formato que entienda `jsonwebtoken` (`1h`, `30m`, `3600`) y el número que ve el front es exactamente la vigencia real.

*Alternativa descartada*: parsear `1h` a mano. Duplica la lógica de la librería y se desincroniza el día que alguien escribe `90m`.

### 7. Configuración: fallar al arrancar si falta algo, sin `@nestjs/config`

Un módulo `configuracion.ts` lee `process.env` una vez, exige `JWT_SECRET` y `JWT_EXPIRES_IN` y corta el arranque con un mensaje claro si faltan. `@nestjs/config` se puede adoptar cuando haya más variables con validación de forma (las de reservas, por ejemplo); hoy sería más maquinaria que valor.

### 8. Prisma como módulo global

`PrismaService extends PrismaClient`, conecta en `onModuleInit` y se desconecta en `onModuleDestroy`; `PrismaModule` es `@Global()`. Es el patrón que documenta Prisma para Nest y el que van a reutilizar las otras features.

### 9. Prefijo `/api/v1` y CORS solo para `FRONTEND_URL`

`app.setGlobalPrefix('api/v1')`, que es lo que declara `servers` en el contrato y lo que el front ya asume en `API_URL`. `enableCors({ origin: FRONTEND_URL, credentials: true })`. Como el front llama a la API desde su servidor, CORS casi no interviene hoy, pero es lo que el contrato y `arquitectura.md` prometen y evita que alguien pruebe con `origin: '*'` después.

### 10. Front: Server Functions para ingresar, registrarse y cerrar sesión *(desviación a revisar)*

El diseño archivado (decisión 15) decía "un Route Handler llama a `POST /auth/login` y guarda el token en una cookie". Este diseño propone **Server Functions** (`"use server"`) con `useActionState` en el formulario. Son los dos únicos lugares donde Next permite escribir cookies, así que la cookie queda idéntica; lo que cambia es que el formulario no necesita código de `fetch` del lado del cliente, tiene estado de "enviando" y errores por campo sin librerías, y funciona sin JavaScript. Es la forma que la guía de autenticación de Next 16 recomienda para formularios.

Si el equipo prefiere mantener el Route Handler literal, el cambio es local a dos archivos y no toca la spec.

### 11. La cookie guarda solo el token; el usuario se pide a la API

Cookie `sesion`: `httpOnly`, `sameSite: 'lax'`, `path: '/'`, `secure` cuando `NODE_ENV === 'production'`, `maxAge = expiraEn`. Para saber quién es, `lib/sesion.ts` (marcado `server-only`) lee la cookie y llama a `GET /auth/perfil`, memoizado por request con `cache()` de React para que el layout y las páginas compartan la misma llamada. Un 401 se trata como "sin sesión".

*Alternativa descartada*: guardar también nombre y rol en la cookie. Ahorra una llamada por render, pero desincroniza el nombre si alguna vez se edita el perfil, y sobre todo hace que el sitio muestre datos que la API no acaba de confirmar. `GET /auth/perfil` existe en la spec exactamente para esto.

### 12. `proxy.ts` solo mira si la cookie existe

Con `matcher` sobre `/mis-reservas`, `/reservar` y `/admin/:path*`. Si no hay cookie, redirige a `/ingresar?volver=<ruta>`. No verifica la firma ni llama a la API: corre en cada navegación y en cada prefetch, y la guía de Next pide chequeos optimistas ahí. Si la cookie existe pero el token venció, la página carga, `GET /auth/perfil` devuelve 401 y la página lo trata como visitante, que es lo que exige el escenario "Sesión vencida".

### 13. `volver` solo acepta rutas relativas del sitio

Se acepta si empieza con `/` y no con `//`; cualquier otra cosa se reemplaza por `/`. Es el guard contra *open redirect* del escenario "Destino externo ignorado".

### 14. Tests de la API por escenario, contra la base del CI

- **Unitarios** de `AuthService` con `PrismaService` mockeado y `bcrypt` y `JwtService` reales: hash distinto de la clave y verificable, `sub` y `rol` en el payload, `expiraEn` con `JWT_EXPIRES_IN=1h`, y el mismo error para mail inexistente y contraseña incorrecta.
- **e2e** con `supertest` sobre la app completa (prefijo, pipe, filtro y guards reales) y la base de `DATABASE_URL`, borrando `usuario` antes de cada test. Un `describe` por requisito de la spec y un `it` por escenario, con el mismo nombre, para que la cobertura se pueda leer contra la spec.
- Los tests fijan `JWT_SECRET` y `JWT_EXPIRES_IN` explícitamente antes de crear la app, así son deterministas en cualquier máquina; el CI las define igual para que el arranque real también quede cubierto.

## Risks / Trade-offs

- **[`class-validator` o `@nestjs/jwt` no cargan bajo ESM + `--experimental-vm-modules`]** → La tarea 1 instala las dependencias y corre un test mínimo que importa las tres y firma un token, antes de escribir nada más. Si falla, se decide ahí (por ejemplo, `zod`), no a mitad del cambio.
- **[`bcrypt` necesita binario nativo en el CI]** → El seed ya lo usa, pero el CI nunca lo ejecutó. La misma tarea 1 hashea en un test que corre en el job `api`. Si el binario no está, el plan B es `bcryptjs`, que es JavaScript puro y compatible con los hashes existentes.
- **[Sin rate limiting, el login admite fuerza bruta]** → Fuera de alcance de RF-00; queda registrado en la memoria como pendiente. La respuesta en tiempo constante evita al menos enumerar mails.
- **[El front no tiene tests automatizados]** → Las cuatro pantallas y los redirects se verifican a mano en el navegador siguiendo los escenarios del delta, y `lint` y `build` corren en el job `web`. El runner del front es decisión del equipo (pendiente).
- **[Una llamada a `GET /auth/perfil` por render para usuarios con sesión]** → Memoizada por request; una sola por página. Si alguna vez pesa, se cachea la respuesta unos segundos en la cookie o en memoria, sin cambiar la spec.
- **[La cookie no lleva `Secure` en desarrollo]** → Es intencional: en `localhost` sin HTTPS el navegador la rechazaría. En producción se sirve por HTTPS y el atributo se activa por `NODE_ENV`.

## Migration Plan

No hay migración de datos ni de contrato. Se despliega mergeando el PR; si algo falla, se revierte el merge y la API vuelve al andamiaje anterior sin dejar estado. Las variables `JWT_SECRET` y `JWT_EXPIRES_IN` pasan a ser obligatorias: cada integrante las completa en su `apps/api/.env` (el `.env.example` ya las lista) y el README lo recuerda en la misma PR.

## Open Questions

- ¿El equipo prefiere Server Functions (decisión 10) o el Route Handler literal del diseño archivado? No cambia la spec ni las tareas más allá de dos archivos del front; se resuelve en la revisión de esta propuesta.
