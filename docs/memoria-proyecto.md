# Memoria del proyecto — Deploy Club

Memoria compartida para cualquier integrante y cualquier agente de IA (Claude Code, Copilot, Codex, Cursor, Gemini CLI u otro), en cualquier computadora. Resume qué pide la consigna, con qué se construye, qué se decidió, en qué estado está el trabajo y qué sigue.

**Última actualización:** 2026-09-23

## Cómo usar este documento

- **Leelo antes de planificar, implementar o commitear.** Si algo de acá contradice un documento más viejo, vale lo de acá; si contradice la consigna, vale la consigna y hay que avisar al equipo.
- **Mantenelo al día.** Cada decisión nueva se registra en "Decisiones vigentes" y en el "Historial", con fecha, en la misma rama y el mismo PR del cambio que la origina.
- **Es un resumen, no la fuente de verdad del detalle.** Cada punto remite al archivo donde está completo.

| Qué | Dónde manda |
|---|---|
| Qué exige el TP | `docs/Consigna TP — Sistema de Reservas con OpenSpec y CI-CD.md` |
| Comportamiento del sistema | `openspec/specs/` después de archivar; mientras tanto, `openspec/changes/<cambio>/specs/` |
| Forma de la API | `contratos/openapi.yaml` |
| Decisiones técnicas del cambio base | `openspec/changes/especificacion-base-reservas/design.md` |
| Aspecto y contenido del front | `docs/claude-design/Deploy Club.dc.html` |
| Relevamiento original | `docs/requisitos.md` (se está corrigiendo; ver "Estado") |
| Guía paso a paso | `docs/plan-de-trabajo.md` (las partes de tarifas quedaron desactualizadas; su `docker-compose.yml` usa `postgres:16` y el puerto 5432: vale la decisión 4 de acá; pide Node 20: vale la decisión 16; su CI, sus checks y OpenSpec global: vale la decisión 17) |

## La consigna, en corto

- MVP de una plataforma de reservas; el equipo eligió **Club Deportivo**: reserva de canchas por disciplina, turnos y alquiler de equipamiento.
- Specs de OpenSpec con esquemas y endpoints de **disponibilidad, creación, consulta y cancelación** de reservas, completas y válidas.
- Repositorio en GitHub con historial de commits y **reparto equitativo** del trabajo entre los cuatro integrantes.
- `main` **protegida**. Cada spec o funcionalidad va en su rama y entra por **PR con al menos una aprobación** de un compañero.
- `.github/workflows/ci.yml` en cada PR y en cada push a `main`: validar OpenSpec, correr tests y **bloquear el merge** si algo falla.
- Entregables: README con arquitectura e instrucciones, specs válidas, PRs cerrados y ejecuciones verdes de GitHub Actions.

## Convenciones del equipo

- **Idioma**: castellano rioplatense en docs, specs, commits y respuestas de los agentes. En las specs de OpenSpec, los encabezados estructurales van en inglés (`## ADDED Requirements`, `#### Scenario:`) y cada requisito lleva `MUST` o `SHALL` literal, porque `openspec validate --strict` falla con "DEBE".
- **Commits**: convencionales y en castellano (`feat(reservas): ...`), cada uno desde la cuenta de su autor.
- **Sin atribución a agentes** en commits, PRs ni issues (ver `AGENTS.md`).
- **Ramas**: `feature/spec-<nombre>`, `fix/<nombre>`, `chore/<nombre>`.
- **OpenSpec**: `/opsx:propose` → revisión entre los cuatro → `/opsx:apply` → merge → `openspec archive <cambio>` en un PR propio. Se archiva **de a uno**, avisando por el grupo.

## Stack

| Parte | Tecnología | Notas que importan |
|---|---|---|
| API | Nest 12, TypeScript 6.0, Jest 30 | Auth con JWT emitido y validado en Nest; errores con el formato `Error` del contrato. Nest 12 es solo ESM: Jest corre con `--experimental-vm-modules` (decisión 16) |
| Front | **Next.js 16.3.4**, React 19.2, Tailwind 4 | Antes de programar, leer `node_modules/next/dist/docs/` (lo exige `apps/web/AGENTS.md`). `middleware` pasó a `proxy.ts`; `cookies()` es asíncrona. Token en cookie `httpOnly` |
| Base | **PostgreSQL 17 en Docker** (`docker-compose.yml`) | Usuario `club` / clave `club`; base `club_reservas`; **puerto 5434** en el host; `npm run db:up` y `npm run db:down` con Docker Desktop abierto. En CI, service container `postgres:17` |
| ORM | **Prisma 6.19.3, versión exacta** | `npm install prisma` sin versión hoy trae 8.0 RC; Prisma 7 cambia la configuración |
| Otros | bcrypt, Resend, `@nestjs/throttler`, `openapi-typescript` | Tipos del front generados desde el contrato |
| Herramientas | **Node 24.21** (`.nvmrc`); OpenSpec CLI 1.13 y Redocly CLI 2.53 como devDependencies de la raíz; schema `spec-driven` | `npm run spec:validate` y `npm run contrato:lint`, con las versiones del `package.json` (decisión 17) |

## Decisiones vigentes

Detalle y alternativas descartadas en `openspec/changes/especificacion-base-reservas/design.md`.

1. **Precio plano por turno** (antes del 2026-09-14). Sin tabla `tarifa`; el precio vive en `cancha.precio_por_turno`. RN-11 y RN-12 se dieron de baja **sin renumerar** las demás reglas.
2. **Se elimina `disciplina.jugadores_permitidos`** (2026-09-14). `cantidadJugadores` es opcional, entero ≥ 1, informativo y no cambia el precio.
3. **Todo el prototipo entra al MVP** (2026-09-14): panel del club (RF-11), administración de canchas (RF-12), administración de equipamiento (RF-13) y reenvío del mail (RF-14). Reglas nuevas: RN-15 (dar de baja cancha o equipamiento no toca reservas existentes) y RN-16 (máximo 3 reenvíos por reserva por hora). El contrato pasa a **2.2.0** con esos endpoints, `Reserva.cliente` y `Equipamiento.activo`.
4. **PostgreSQL 17 en Docker, publicado en el puerto 5434** (2026-09-16; reemplaza la interpretación del 2026-09-14 de PostgreSQL instalado sin Docker). Misma imagen que el CI y una sola `DATABASE_URL` (`postgresql://club:club@localhost:5434/club_reservas`) para los cuatro. Se usa 5434 porque 5432 y 5433 pueden estar ocupados por servidores PostgreSQL instalados en la máquina.
5. **Prisma 6.19.3 fijo**, y los scripts `db:*` del `package.json` raíz corren Prisma dentro del workspace `api`, para que lea `apps/api/.env` y `prisma.seed`.
6. **RN-01 en la base**: índice único parcial `ux_reserva_slot_activo` sobre `(cancha_id, fecha, hora_inicio) WHERE estado <> 'CANCELADA'`, en una migración manual. Toda migración futura se revisa buscando un `DROP INDEX` de ese índice.
7. **Hora local del club**: `ZONA_HORARIA_CLUB=America/Argentina/Cordoba` y un reloj inyectable para tests.
8. **Grilla de turnos anclada a la apertura** (08:00–23:00 configurable). Una `horaInicio` fuera de la grilla responde 422 `HORARIO_FUERA_DE_TURNO`.
9. **Estados**: solo se persisten `CONFIRMADA` y `CANCELADA`; `COMPLETADA` se deriva al leer. Activa = `CONFIRMADA` y no terminada.
10. **Código de reserva**: `PREFIJO_CODIGO_RESERVA` (por defecto `RES`) + `-` + 6 caracteres `[A-Z0-9]`.
11. **Seguridad**: una reserva ajena responde 404 y no 403; los campos que el contrato no declara responden 400; el 401 de login es idéntico exista o no el mail.
12. **Nombre y diseño**: el club se llama **Deploy**. El prototipo de Claude Design reemplaza la paleta y la tipografía de `docs/identidad.md` (fondo `#060807`, acento `#00E58F`, Outfit y DM Sans).
13. **Seed con los datos del prototipo**: Tenis 60 min (Cancha 1 $9000, Cancha 2 $8000), Pádel 90 min (Pádel 1 y 2 techadas $14000, Pádel 3 $12000), Fútbol 5 60 min (Cancha Sur $20000). Equipamiento: paleta de pádel, raqueta de tenis, **tubo de pelotas separado para tenis y para pádel** (para respetar RN-08) y juego de pecheras. Usuarios `admin@club.test` y `socio@club.test` con clave `clave1234`.
14. **Mails**: asuntos `Tu turno en Deploy está confirmado · {codigo}` y `Cancelamos tu turno en Deploy · {codigo}`; se envían después del commit y nunca revierten la operación (RN-14).
15. **Capacidades de OpenSpec**: `autenticacion`, `catalogo`, `disponibilidad`, `reservas`, `notificaciones`, `institucional` y `administracion`.
16. **Node 24 LTS y Jest con `--experimental-vm-modules`** (2026-09-21; reemplaza Node 20.19). Nest 12 se publica solo como ESM, y Jest 30 solo lo carga con `require` si Node expone `vm.SourceTextModule` con `hasAsyncGraph`: eso existe desde Node 24.9 y solo con ese flag. Por eso:
    - `.nvmrc` pide `24.21.0`.
    - `test`, `test:watch`, `test:cov` y `test:e2e` de `apps/api` corren `node --experimental-vm-modules ../../node_modules/jest/bin/jest.js`. La ruta depende de que npm instale Jest en la raíz del monorepo.
    - El CI toma la versión de `.nvmrc` con `node-version-file`.
    - El aviso `ExperimentalWarning: VM Modules` es esperable.

    Alternativas descartadas: transformar `@nestjs` a CommonJS dentro de Jest (lento, frágil y atado a Node 20, que ya no tiene soporte) y migrar la API a ESM con Vitest, como el template `ts-esm` de Nest (más limpio, pero es un cambio estructural y sale del stack acordado).
17. **CI con dos checks obligatorios: `specs` y `api`** (2026-09-21). `.github/workflows/ci.yml` corre en cada PR a `main` y en cada push a `main`. Detalle en `docs/arquitectura.md` §6 y §7.
    - `specs` valida OpenSpec (`--strict`) y el contrato.
    - `api` espera a `specs`, aplica las migraciones contra un service container `postgres:17` y corre lint, build y tests de la API.
    - **OpenSpec 1.13.1 y `@redocly/cli` 2.53.3 son devDependencies de la raíz**, para que el CI y los cuatro usen la misma versión (antes, OpenSpec era global y Redocly bajaba la última en cada corrida). `contrato:lint` usa el `redocly` local, no `npx`.
    - La protección de `main` (1 aprobación, checks `specs` y `api`, ramas al día y sin bypass para admins) la configura `rociobazan`, la única cuenta con admin, con los pasos o el comando `gh api` de `docs/arquitectura.md` §7. Si se renombra un job, hay que actualizar la regla.
18. **Base visual del front, común a todas las pantallas** (2026-09-23). El prototipo (decisión 12) se traduce una sola vez y las pantallas lo consumen; **ninguna pantalla escribe colores, tipografías ni radios a mano**. Vive en:
    - `apps/web/app/globals.css`: los tokens del prototipo como variables CSS y como tema de Tailwind 4 (`@theme`). Fondo `#060807`; superficies `#0B0F0E`, `#0E1211`, `#131817` y `#161C1A`; textos `#F2F5F4`, `#9AA5A1` y `#7F8A85`; acento `#00E58F` con hover `#7BFFCB`; alerta `#FF9B9B`; dorado `#C9A86B`; bordes de blanco translúcido.
    - `apps/web/app/layout.tsx`: **Outfit** para títulos (`font-display`) y **DM Sans** para texto (`font-sans`), cargadas con `next/font`, más `lang="es"` y los metadatos del sitio.
    - `apps/web/components/ui/`: `Button` (`primary`, `secondary`, `ghost`), `Card` con `CardTitle`, `Input` y `Badge` (`neutral`, `accent`, `danger`, `gold`).
    - `apps/web/app/estilos`: página viva con los tokens y los componentes, para revisar la identidad sin abrir una pantalla del producto.

    Los nombres de tokens y componentes van en inglés, como el resto del código. Esto sale de la tarea 1.5 (landing), porque lo necesitan todas las pantallas.
19. **Los tipos del front se generan desde el contrato** (2026-09-23; implementa `docs/arquitectura.md` §3). `openapi-typescript` 7.13.0 es devDependency de la raíz y `npm run generate:api-types` escribe `apps/web/lib/api/schema.d.ts` desde `contratos/openapi.yaml`.
    - **El archivo generado se versiona**, para que `npm ci` y el build funcionen sin generarlo. La regeneración es determinista: con el mismo contrato da un archivo idéntico.
    - **Las pantallas importan de `apps/web/lib/api/types.ts`**, no de `schema.d.ts`: ahí están los alias (`Reserva`, `Cancha`, `Disciplina`, `Equipamiento`, `DisponibilidadResponse`, `PanelAdmin`, `ApiError`, entre otros).
    - Quien toque el contrato **corre `npm run generate:api-types` y commitea el resultado**. Hasta que el CI tenga el job de *drift* (`docs/arquitectura.md` §6), nada lo verifica solo.
20. **Un solo cliente HTTP en el front** (2026-09-23), en `apps/web/lib/api/client.ts`. **Ninguna pantalla llama a `fetch` por su cuenta.**
    - `apiFetch<T>(path, opciones)` arma la URL con `API_URL`, serializa el cuerpo a JSON, agrega `Authorization: Bearer` cuando le pasan un token y acepta `timeoutMs`.
    - Ante cualquier falla lanza **`ApiHttpError`** con el formato `Error` del contrato (`tipo`, `titulo`, `estado`, `detalle`, `instancia`). `titulo` es el texto que se le muestra a la persona. Si la API no responde, el `estado` es `0` y el `tipo` es `SIN_CONEXION`, así se distingue de un error con respuesta HTTP.
    - **La caché va explícita**: por defecto `no-store`, porque disponibilidad y reservas son datos vivos y por usuario. Quien quiera cachear lo pide.
    - **El cliente no sabe de sesión**: recibe el token por parámetro. Leerlo de la cookie `httpOnly` es del cambio de autenticación (RF-00).
    - Si quien llama **aborta su propio pedido**, el `AbortError` se propaga tal cual: cancelar no es una falla de la API. El vencimiento de `timeoutMs` sí llega como `SIN_CONEXION`.
    - `API_URL` sale de `apps/web/.env.local`; hay `apps/web/.env.example` y el README dice cómo copiarlo. Sin esa variable, en desarrollo apunta a `http://localhost:3000/api/v1` y en producción falla al arrancar, a propósito.

    **Shell de navegación** (2026-09-23), en `apps/web/components/layout/`: `SiteHeader` y `SiteFooter`, aplicados en el layout raíz, así que envuelven a todas las pantallas. El header lleva el logo, la navegación que pide la spec de `institucional` (El club, Canchas y precios, Disponibilidad y Contacto) y el botón de ingresar. **En mobile la navegación vive en un panel que abre un botón** (`MobileNav`), con `aria-expanded`, cierre con `Escape` y cierre al navegar; de `sm` para arriba es la fila inline de siempre. Los componentes cliente son solo `NavLink`, que marca el link activo, y `MobileNav`, que maneja abierto/cerrado. El pie lleva los horarios, la dirección y el contacto del prototipo. **El header ya tiene los tres estados**, en `components/layout/navegacion.ts`: sin sesión (El club, Canchas y precios, Disponibilidad, Contacto, más "Ingresar"), **socio** (Disponibilidad, Mis reservas, El club, Contacto, más avatar y nombre) y **administrador** (Panel, Reservas, Canchas y Equipamiento, de RF-11 a RF-13, más avatar, nombre y la etiqueta Admin). Se ven los tres en `/estilos`. **Falta la sesión de verdad**: `SiteHeader` recibe `usuario` por prop y el layout se lo pasa vacío; leer la cookie `httpOnly` y cerrar sesión son del cambio de autenticación (RF-00), que es su dueño. Las rutas del menú todavía no existen: responden 404 hasta que entre cada feature.

    **Pantallas de estado** (2026-09-24), en `apps/web/app/`: `not-found.tsx` (404 con accesos a Inicio y Disponibilidad), `error.tsx` (mensaje genérico, botón de reintentar y el código del error; el detalle va al log, nunca a la pantalla) y `loading.tsx` (esqueleto que respeta `prefers-reduced-motion`). Las tres renderizan dentro del layout, así que llevan header y pie. **Ojo con la versión de Next**: el prop del error boundary es **`retry`**, no `reset`. No se usó `global-not-found`, que es experimental.

## Estado al 2026-09-21

- **Cambio `especificacion-base-reservas`**: implementado y verificado por completo (**35 de 35 tareas**) y **mergeado a `main`** con el PR #3 el 2026-09-17 (ítem 0.1). Incluye:
  - `docs/requisitos.md` corregido a precio plano y ampliado con RF-11 a RF-14, RN-15 y RN-16.
  - `contratos/openapi.yaml` en 2.2.0.
  - `docs/arquitectura.md` y `docs/identidad.md` actualizados, y `uploads/` en `.gitignore`.
  - `docker-compose.yml` con PostgreSQL 17 en el puerto 5434.
  - Prisma 6.19.3 y bcrypt instalados; `apps/api/.env.example`; scripts `db:*`.
  - `apps/api/prisma/` con el schema, las migraciones `init` y `slot_unico_activo`, y el seed.
  - Prueba de humo de RN-01, simulación del CI con `migrate deploy`, `spec:validate` y `contrato:lint` en verde.
  - Seed idempotente (tarea 8.2): la segunda corrida informa "La base ya tiene datos; no se cargó nada", termina en 0 y deja los conteos iguales (3 disciplinas, 6 canchas activas, 5 ítems de equipamiento activos, 2 usuarios, 0 reservas).
  - Migration Plan en limpio (tarea 9.3): con `docker compose down -v` se borraron el contenedor y el volumen, y `npm run db:up`, `npm run db:migrate` y `npm run db:seed` dejaron las 8 tablas, los tres índices (`ux_reserva_slot_activo` con su `WHERE`, `ix_reserva_usuario_estado`, `ix_reserva_fecha`) y los datos de la decisión 13, sin ningún paso manual extra.
  - Tarea 9.6: `git status` revisado contra la lista esperada (coincide, sin ningún `.env`) y descripción del PR redactada en `openspec/changes/especificacion-base-reservas/descripcion-pr.md`.
- **PR #4 (`chore/audit-fix`)**: `npm audit fix` sin `--force` (de 10 a 8 vulnerabilidades); las restantes solo se corrigen bajando Prisma, así que quedan. Se actualizó con main el 2026-09-21, pasó el CI y se mergeó.
- **Ítems 0.2 y 0.3 hechos**: el PR #5 (tests de la API con Node 24, decisión 16) y el PR #6 (`ci.yml` con los checks `specs` y `api`, decisión 17) se mergearon el 2026-09-21, y el CI ya corrió en verde en `main`.
- **Ítem 1.7 hecho**: el `README.md` (arquitectura, instrucciones de ejecución verificadas de punta a punta, usuarios de prueba, flujos de trabajo, CI y equipo) entró con el PR #7 el 2026-09-21. Falta la captura de la protección, que se suma cuando esté activa.
- **Base visual del front (decisión 18)**: PR #10, con el CI en verde; espera aprobación. Tokens, tipografías, las cuatro primitivas y la página `/estilos`. `apps/web/app/page.tsx` sigue siendo la home por defecto de Next: la reemplaza la landing (1.5).
- **Tipos del contrato (decisión 19), en `feature/tipos-contrato-web`**, que sale de la rama del #10: script `generate:api-types`, `schema.d.ts` versionado y los alias de `lib/api/types.ts`. Lint y build del workspace `web` en verde.
- **Shell de navegación (decisión 18)**: PR #12, que sale de la rama del #10. Header con menú de mobile, footer, y el **logo del club** en los dos, más el favicon. Lint y build en verde; verificado a 375 px (header de 69 px, panel que abre y cierra, sin desborde) y en escritorio.
- **Pantallas de estado (decisión 18), en `feature/pantallas-de-estado`**, que sale de la rama del #12: `not-found.tsx`, `error.tsx` y `loading.tsx`. Las tres se verificaron en el navegador con rutas temporales que después se borraron.
- **Logo y favicon** (2026-09-23), en el mismo PR #12: el original del prototipo (`apps/web/public/logo-deploy-original.png`) es un cuadrado con fondo negro y la palabra "Deploy" adentro. De ahí se derivaron `apps/web/public/logo-deploy.png` (512 px, el que usan el header y el pie) y `apps/web/app/icon.png` (256 px, el favicon de Next), recortados al ícono y con fondo transparente. Se borró el `favicon.ico` de la plantilla, que si no le ganaba al ícono nuevo.
- **#4, #5, #6 y #7 se mergearon sin ninguna aprobación registrada en GitHub**, porque la protección de `main` todavía no está activa.
- `openspec/specs/` tiene las siete capacidades vigentes desde el archivado de `especificacion-base-reservas` (PR de `chore/archivar-especificacion-base`, 2026-09-21).
- `apps/api` todavía no tiene módulos (solo `prisma/`) y `apps/web` no tiene páginas.
- Todavía no existe la protección de `main`.

### Desvíos y hallazgos de la implementación (2026-09-16)

- **Migración de verificación vacía**: `prisma migrate dev --create-only` crea una migración vacía aunque el schema esté sincronizado. No generó ningún `DROP INDEX` de `ux_reserva_slot_activo`; la carpeta vacía se borró.
- **npm 11 y scripts de instalación**: con Node 24, npm 11 no ejecuta los scripts de instalación sin aprobarlos (`npm install-scripts`). Prisma y bcrypt funcionan igual, porque sus motores y binarios precompilados quedan instalados, así que no se aprobó ninguno. Desde el 2026-09-21, `.nvmrc` pide Node 24 (decisión 16).
- **Seed con TypeScript 6**: `ts-node` lo ejecuta sin `--transpile-only`. Prisma avisa que `package.json#prisma` queda obsoleto en Prisma 7; es esperable con la decisión 5.
- **`migrate reset` y `down -v` los corre una persona, no un agente**: Prisma 6.19 detecta cuando lo invoca un agente y exige el consentimiento explícito del usuario, y Claude Code además bloquea por su cuenta los comandos que destruyen datos locales de forma irreversible. La idempotencia del seed y el Migration Plan desde cero se verificaron sin borrar nada: se creó la base aparte `club_reservas_limpia`, se corrieron `prisma migrate deploy` y `prisma db seed` apuntando a ella con `DATABASE_URL` en línea, se compararon tablas, índices y conteos, y se la eliminó. Esa vía sirve para cualquier integrante que no quiera perder su base local.
- **Agregados al contrato fuera de la tabla de la decisión 16 del `design.md`**:
  - `GET /canchas` declara también la respuesta 400 que usa la spec de `autenticacion`.
  - El 409 de la cancelación describe los dos casos de la spec (ya cancelada o turno terminado).
  - `ReenvioMailResponse` lleva `mensaje`, `tipo` y `destinatario`.
- **Los tests de la API fallan desde antes de este cambio**: `npm run test --workspace api` corta con `TS5011`, porque TypeScript 6 pide `rootDir` explícito en `apps/api/tsconfig.json`. No lo causó la instalación, pero bloquea el job de tests del CI. Se resolvió el 2026-09-21 en `fix/rootdir-tests-api` con `"rootDir": "./"`. Arreglado eso, apareció el problema de Nest 12 solo ESM que resuelve la decisión 16.

## Reparto del trabajo restante

Cada integrante se lleva su feature **completa**: spec, contrato si hace falta, endpoint en Nest,
tests y la pantalla en Next que la consume (`requisitos.md` §8). Una rama por ítem, un PR por rama,
al menos una aprobación de quien figura en "Revisa".

**Los integrantes son A, B, C y D**: al tomar cada rama, reemplazar la letra por el nombre en esta
tabla y en `requisitos.md` §8, en el mismo PR.

### Hito 0 — desbloquear (antes de abrir ramas en paralelo)

| # | Rama | Qué entra | Responsable | Revisa | Depende de |
|---|---|---|---|---|---|
| 0.1 | `feature/spec-contrato-base` | **Hecho**: PR #3, mergeado el 2026-09-17 | Quien lo implementó | **Los cuatro** | — |
| 0.2 | `fix/rootdir-tests-api` | **Hecho**: PR #5, mergeado el 2026-09-21. `"rootDir": "./"` en `apps/api/tsconfig.json` (`TS5011`), y Node 24 con Jest en `--experimental-vm-modules` (decisión 16) | JereDev | Cualquiera | 0.1 mergeado |
| 0.3 | `chore/ci-y-proteccion-main` | **CI hecho**: PR #6, mergeado el 2026-09-21, con los checks `specs` y `api` (decisión 17). **Falta** la protección de `main` con esos checks obligatorios y una aprobación, y la captura para el README | JereDev; la protección, `rociobazan` (única cuenta con admin) | Cualquiera | 0.2 |
| 0.4 | `chore/archivar-especificacion-base` | `openspec archive especificacion-base-reservas`, que llena `openspec/specs/` | Quien lo implementó | Cualquiera | 0.1 mergeado; se archiva de a uno, avisando por el grupo |

### Hito 1 — features en paralelo (FASE 5)

Cada una arranca con su propio `/opsx:propose`, que las cuatro personas revisan antes del
`/opsx:apply`.

| # | Rama | Qué entra | Responsable | Revisa | Depende de |
|---|---|---|---|---|---|
| 1.1 | `feature/spec-autenticacion` | RF-00: registro, login, JWT, guards de rol, y las pantallas de registro e ingreso en Next | **A** | B | 0.1. **Camino crítico**: hasta que estén los guards, C y D testean con un mock del token |
| 1.2 | `feature/spec-disponibilidad` | RF-01, RF-02, RF-03: disciplinas, canchas, equipamiento y consulta de disponibilidad, más la pantalla de disponibilidad | **B** | C | 0.1 |
| 1.3 | `feature/spec-creacion-reserva` | RF-04 con RN-01, RN-05 y RN-06: creación de reservas y formulario | **C** | D | 1.1 y 1.2 |
| 1.4 | `feature/spec-reservas-notificaciones` | RF-05 a RF-08: mis reservas, detalle, cancelación y mails de confirmación y cancelación, más la pantalla de mis reservas | **D** | A | 1.1 y 1.3 |
| 1.5 | `feature/landing-institucional` | RF-09 y RF-10: Inicio, El club y Contacto, con el prototipo como referencia | **A + B** | C y D | 0.1 |
| 1.6 | `feature/spec-administracion` | RF-11 a RF-14: panel del club, ABM de canchas y equipamiento, reenvío del mail y pantallas de admin | **C + D** (propuesto el 2026-09-17; confirmar) | A y B | 1.1 y 1.2 |
| 1.7 | `docs/readme` | **Hecho**: PR #7, mergeado el 2026-09-21 (README con arquitectura, instrucciones con Docker Desktop y `npm run db:up` y usuarios de prueba). **Falta** la captura de la protección de `main`, cuando esté activa | JereDev | Cualquiera | 0.3 |

Queda **RF-11 a RF-14 asignado a C y D** para equilibrar, porque A y B se llevan además la landing
(1.5). Era la *Open Question* "quién implementa la administración" del `design.md`; cuando el equipo
lo confirme, se cierra ahí y en `requisitos.md` §8.

## Pendientes y preguntas abiertas

- **Cada integrante pasa a Node 24.21** (`nvm install 24.21.0`): con Node 20, los tests de la API no corren (decisión 16).
- **Protección de `main`**: 0.3 ya está mergeado; falta que `rociobazan` la configure con los pasos de `docs/arquitectura.md` §7. Después, la captura va al README.
- **Aprobar cada PR en GitHub antes de mergear**: #4 a #7 entraron sin aprobación registrada, y la consigna evalúa al menos una por PR. Con la protección activa, GitHub lo exige solo.
- **El cuarto integrante, Renzo Bazán, no figura como colaborador del repo** y no tiene commits; lo agrega `rociobazan` en *Settings → Collaborators*.
- **`prisma generate` en el CI**: npm 11 no ejecuta el `postinstall` de `@prisma/client`. Cuando la API importe `PrismaClient`, hay que sumar `prisma generate` al job `api`.
- **`test:debug` de `apps/api`** apunta a `node_modules/.bin/jest`, que no existe dentro del workspace porque Jest se instala en la raíz; quedó como estaba.
- **Asignar RF-11 a RF-14** a uno o dos integrantes; `requisitos.md` §8 ya los lista como "A asignar".
- **Propuesta abierta: que JereDev se lleve el front completo** (2026-09-23), porque tiene más disponibilidad. Cada integrante seguiría siendo dueño de su spec, su endpoint y sus tests, y revisaría la pantalla de su feature. **La tienen que aprobar los otros tres**, y si sale, se actualizan este reparto y `requisitos.md` §8 en el mismo PR. A tener en cuenta: `requisitos.md` §8 desaconseja repartir por capas, porque desbalancea los commits y eso se evalúa. El front no depende del back: las pantallas se arman contra el contrato y se conectan cuando cada endpoint existe.
- **Casilla de contacto**: variable de entorno para el destino de `POST /contacto` y respuesta si falla el proveedor; lo define el cambio de la landing.
- **Usuarios inactivos**: si pueden iniciar sesión lo define el cambio de autenticación.
- **Prefijo del código**: `RES` por defecto; el equipo puede cambiarlo por configuración.

## Historial

- **2026-09-09**: estructura del monorepo (Nest y Next), plan de trabajo, relevamiento y contrato 2.1.0 con precio plano.
- **2026-09-14**: `openspec init` y propuesta del cambio base. Se generaron specs, diseño y tareas. Se incorporaron la consigna, el prototipo de Claude Design (club Deploy), PostgreSQL 17 local sin Docker y Next.js 16. Se decidió que todo el prototipo, incluida la administración, entra al MVP. Se creó esta memoria.
- **2026-09-16**: el equipo confirmó Docker para la base: PostgreSQL 17 en `docker-compose.yml`, puerto 5434. Se actualizaron `proposal.md`, `design.md` (decisión 13, riesgos y Migration Plan) y `tasks.md` (secciones 4 a 6 y 9). Se implementó el cambio base salvo 8.2, 9.3 y 9.6, se pausó a pedido y se subió a GitHub (ver "Estado").
- **2026-09-17**: se cerraron las tres tareas que faltaban (8.2, 9.3 y 9.6), así que el cambio base queda verificado de punta a punta y listo para el PR, con su descripción en `descripcion-pr.md`. Se reemplazaron los "Próximos pasos" por el "Reparto del trabajo restante", con una rama y un responsable por ítem, y se propuso asignar la administración (RF-11 a RF-14) a C y D.
- **2026-09-21**: el PR base (#3) ya estaba mergeado desde el 2026-09-17 y quedó abierto el #4 (`npm audit fix`). En el ítem 0.2, fijar `rootDir` dejó ver que Jest no carga Nest 12, que es solo ESM. Se pasó a **Node 24.21** y a correr Jest con `--experimental-vm-modules` (decisión 16), y el CI de ejemplo de `docs/arquitectura.md` toma la versión de `.nvmrc`. En el ítem 0.3 se escribió `ci.yml` con los checks `specs` y `api`, y OpenSpec y Redocly pasaron a devDependencies de la raíz (decisión 17). Rocío mergeó #5 y #6; el #4 se actualizó con `main`, pasó el CI y se mergeó; y entró el README (1.7) con el #7. Todos sin aprobación registrada, porque la protección todavía no está activa. Se borró `LEEME.md` (los "materiales iniciales" para armar el repo), que quedó obsoleto con el README.
- **2026-09-23**: Adrián abrió el #9 con el archivado del cambio base; se le pidieron cambios porque la memoria quedaba con links rotos al `design.md` movido. Se limpiaron las ramas ya mergeadas. Se armó la **base visual del front** (decisión 18) en el PR #10, y quedó propuesto que JereDev se lleve el front completo, a confirmar por el equipo. Después se generaron los **tipos del contrato** (decisión 19).
