# Memoria del proyecto — Deploy Club

Memoria compartida para cualquier integrante y cualquier agente de IA (Claude Code, Copilot, Codex, Cursor, Gemini CLI u otro), en cualquier computadora. Resume qué pide la consigna, con qué se construye, qué se decidió, en qué estado está el trabajo y qué sigue.

**Última actualización:** 2026-09-16

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
| Guía paso a paso | `docs/plan-de-trabajo.md` (las partes de tarifas quedaron desactualizadas; su `docker-compose.yml` usa `postgres:16` y el puerto 5432: vale la decisión 4 de acá) |

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
| API | Nest 12, TypeScript 6.0, Jest 30 | Auth con JWT emitido y validado en Nest; errores con el formato `Error` del contrato |
| Front | **Next.js 16.3.4**, React 19.2, Tailwind 4 | Antes de programar, leer `node_modules/next/dist/docs/` (lo exige `apps/web/AGENTS.md`). `middleware` pasó a `proxy.ts`; `cookies()` es asíncrona. Token en cookie `httpOnly` |
| Base | **PostgreSQL 17 en Docker** (`docker-compose.yml`) | Usuario `club` / clave `club`; base `club_reservas`; **puerto 5434** en el host; `npm run db:up` y `npm run db:down` con Docker Desktop abierto. En CI, service container `postgres:17` |
| ORM | **Prisma 6.19.3, versión exacta** | `npm install prisma` sin versión hoy trae 8.0 RC; Prisma 7 cambia la configuración |
| Otros | bcrypt, Resend, `@nestjs/throttler`, `openapi-typescript` | Tipos del front generados desde el contrato |
| Herramientas | Node 20.19 (`.nvmrc`), OpenSpec CLI, schema `spec-driven` | `npm run spec:validate` y `npm run contrato:lint` |

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

## Estado al 2026-09-16

- **Cambio `especificacion-base-reservas`**: implementado en la rama **`feature/spec-contrato-base`** (32 de 35 tareas), commiteado y pusheado, todavía sin PR. El `/opsx:apply` se pausó a pedido el 2026-09-16. Ya está hecho:
  - `docs/requisitos.md` corregido a precio plano y ampliado con RF-11 a RF-14, RN-15 y RN-16.
  - `contratos/openapi.yaml` en 2.2.0.
  - `docs/arquitectura.md` y `docs/identidad.md` actualizados, y `uploads/` en `.gitignore`.
  - `docker-compose.yml` con PostgreSQL 17 en el puerto 5434.
  - Prisma 6.19.3 y bcrypt instalados; `apps/api/.env.example`; scripts `db:*`.
  - `apps/api/prisma/` con el schema, las migraciones `init` y `slot_unico_activo`, y el seed.
  - Prueba de humo de RN-01, simulación del CI con `migrate deploy`, `spec:validate` y `contrato:lint` en verde.
- **Faltan tres tareas**:
  - 8.2, la parte que corre `prisma migrate reset --force`.
  - 9.3, que corre `docker compose down -v`.
  - 9.6, la revisión de `git status` antes del commit y la descripción del PR.

  Las dos primeras borran la base local: no se corrieron y esperan la confirmación explícita del integrante que las corra.
- `openspec/specs/` sigue vacío hasta archivar ese cambio.
- `apps/api` todavía no tiene módulos (solo `prisma/`) y `apps/web` no tiene páginas.
- Todavía no existen `.github/workflows/ci.yml`, la protección de `main` ni el README.

### Desvíos y hallazgos de la implementación (2026-09-16)

- **Migración de verificación vacía**: `prisma migrate dev --create-only` crea una migración vacía aunque el schema esté sincronizado. No generó ningún `DROP INDEX` de `ux_reserva_slot_activo`; la carpeta vacía se borró.
- **npm 11 y scripts de instalación**: con Node 24, npm 11 no ejecuta los scripts de instalación sin aprobarlos (`npm install-scripts`). Prisma y bcrypt funcionan igual, porque sus motores y binarios precompilados quedan instalados, así que no se aprobó ninguno. `.nvmrc` sigue pidiendo Node 20.
- **Seed con TypeScript 6**: `ts-node` lo ejecuta sin `--transpile-only`. Prisma avisa que `package.json#prisma` queda obsoleto en Prisma 7; es esperable con la decisión 5.
- **Prisma bloquea `migrate reset` ante agentes de IA**: Prisma 6.19 detecta cuando lo invoca un agente y exige el consentimiento explícito del usuario.
- **Agregados al contrato fuera de la tabla de la decisión 16**:
  - `GET /canchas` declara también la respuesta 400 que usa la spec de `autenticacion`.
  - El 409 de la cancelación describe los dos casos de la spec (ya cancelada o turno terminado).
  - `ReenvioMailResponse` lleva `mensaje`, `tipo` y `destinatario`.
- **Los tests de la API fallan desde antes de este cambio**: `npm run test --workspace api` corta con `TS5011`, porque TypeScript 6 pide `rootDir` explícito en `apps/api/tsconfig.json`. No lo causó la instalación, pero bloquea el job de tests del CI (ver "Pendientes").

## Próximos pasos

1. Retomar `/opsx:apply especificacion-base-reservas` en `feature/spec-contrato-base` (`git pull`, `npm install`, `npm run db:up`, copiar `apps/api/.env.example` a `apps/api/.env`, `npm run db:migrate` y `npm run db:seed`). Quedan 8.2 y 9.3, con confirmación explícita porque borran la base local, y 9.6 al armar la descripción del PR.
2. Revisar entre los cuatro el cambio completo (artefactos, docs, contrato 2.2.0, schema y seed) y abrir el PR base; lo aprueban los cuatro y se mergea.
3. En su propia rama: `ci.yml` (validación de OpenSpec, lint del contrato y tests contra `postgres:17`) y protección de `main` con checks obligatorios y una aprobación, con captura para el README. Antes hay que resolver el `TS5011` de los tests.
4. `openspec archive especificacion-base-reservas` en un PR propio.
5. FASE 5, una rama y un `/opsx:propose` por feature: autenticación; catálogo y disponibilidad; creación de reservas; consulta, cancelación y notificaciones; administración (RF-11 a RF-14); landing y contacto.
6. README con arquitectura e instrucciones con Docker Desktop y `npm run db:up`.

## Pendientes y preguntas abiertas

- **Tests de la API con TypeScript 6** (`TS5011`): fijar `rootDir` en `apps/api/tsconfig.json` o ajustar `ts-jest`, en un `fix/` propio antes del CI.
- **Asignar RF-11 a RF-14** a uno o dos integrantes; `requisitos.md` §8 ya los lista como "A asignar".
- **Casilla de contacto**: variable de entorno para el destino de `POST /contacto` y respuesta si falla el proveedor; lo define el cambio de la landing.
- **Usuarios inactivos**: si pueden iniciar sesión lo define el cambio de autenticación.
- **Prefijo del código**: `RES` por defecto; el equipo puede cambiarlo por configuración.

## Historial

- **2026-09-09**: estructura del monorepo (Nest y Next), plan de trabajo, relevamiento y contrato 2.1.0 con precio plano.
- **2026-09-14**: `openspec init` y propuesta del cambio base. Se generaron specs, diseño y tareas. Se incorporaron la consigna, el prototipo de Claude Design (club Deploy), PostgreSQL 17 local sin Docker y Next.js 16. Se decidió que todo el prototipo, incluida la administración, entra al MVP. Se creó esta memoria.
- **2026-09-16**: el equipo confirmó Docker para la base: PostgreSQL 17 en `docker-compose.yml`, puerto 5434. Se actualizaron `proposal.md`, `design.md` (decisión 13, riesgos y Migration Plan) y `tasks.md` (secciones 4 a 6 y 9). Se implementó el cambio base salvo 8.2, 9.3 y 9.6, se pausó a pedido y se subió a GitHub (ver "Estado").
