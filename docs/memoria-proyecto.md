# Memoria del proyecto — Deploy Club

Memoria compartida para cualquier integrante y cualquier agente de IA (Claude Code, Copilot, Codex, Cursor, Gemini CLI u otro), en cualquier computadora. Resume qué pide la consigna, con qué se construye, qué se decidió, en qué estado está el trabajo y qué sigue.

**Última actualización:** 2026-09-14

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
| Guía paso a paso | `docs/plan-de-trabajo.md` (partes con Docker y tarifas quedaron desactualizadas) |

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
| Base | **PostgreSQL 17 instalado localmente, sin Docker** | Rol `club` / clave `club` con `CREATEDB`; base `club_reservas`; puerto 5432. En CI, service container `postgres:17` |
| ORM | **Prisma 6.19.3, versión exacta** | `npm install prisma` sin versión hoy trae 8.0 RC; Prisma 7 cambia la configuración |
| Otros | bcrypt, Resend, `@nestjs/throttler`, `openapi-typescript` | Tipos del front generados desde el contrato |
| Herramientas | Node 20.19 (`.nvmrc`), OpenSpec CLI, schema `spec-driven` | `npm run spec:validate` y `npm run contrato:lint` |

## Decisiones vigentes

Detalle y alternativas descartadas en `openspec/changes/especificacion-base-reservas/design.md`.

1. **Precio plano por turno** (antes del 2026-09-14). Sin tabla `tarifa`; el precio vive en `cancha.precio_por_turno`. RN-11 y RN-12 se dieron de baja **sin renumerar** las demás reglas.
2. **Se elimina `disciplina.jugadores_permitidos`** (2026-09-14). `cantidadJugadores` es opcional, entero ≥ 1, informativo y no cambia el precio.
3. **Todo el prototipo entra al MVP** (2026-09-14): panel del club (RF-11), administración de canchas (RF-12), administración de equipamiento (RF-13) y reenvío del mail (RF-14). Reglas nuevas: RN-15 (dar de baja cancha o equipamiento no toca reservas existentes) y RN-16 (máximo 3 reenvíos por reserva por hora). El contrato pasa a **2.2.0** con esos endpoints, `Reserva.cliente` y `Equipamiento.activo`.
4. **PostgreSQL 17 local sin Docker** (2026-09-14). Así se interpretó "ahora lo vamos a hacer con postgres"; ver "Pendientes".
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

## Estado al 2026-09-14

- **Cambio `especificacion-base-reservas`**: planificación completa (`proposal.md`, specs de las 7 capacidades, `design.md`, `tasks.md`), válida con `openspec validate --strict`, commiteada y pusheada en la rama **`feature/spec-contrato-base`** junto con la consigna, el prototipo y esta memoria. **Todavía no se implementó** (ninguna tarea de `tasks.md` está hecha) y todavía no hay PR.
- `openspec/specs/` sigue vacío hasta archivar ese cambio.
- `apps/api` y `apps/web` son los proyectos recién generados, sin módulos ni páginas.
- Todavía no existen `apps/api/prisma/`, `.github/workflows/ci.yml`, la protección de `main` ni el README.
- `docs/requisitos.md`, `docs/arquitectura.md`, `docs/identidad.md` y el contrato se actualizan como parte de las tareas del cambio base.
- `docs/claude-design/uploads/` no se versiona: son copias de `assets/` y una imagen sin usar.

## Próximos pasos

1. Revisar entre los cuatro los artefactos de `especificacion-base-reservas`.
2. Trabajar sobre la rama `feature/spec-contrato-base` (`git fetch` y `git switch feature/spec-contrato-base` en cada computadora).
3. `/opsx:apply` sobre ese cambio: corregir y ampliar docs, ampliar el contrato a 2.2.0, crear rol y base en PostgreSQL 17, Prisma, migraciones, seed y verificaciones.
4. PR base aprobado por los cuatro y merge.
5. En su propia rama: `ci.yml` (validación de OpenSpec, lint del contrato y tests contra `postgres:17`) y protección de `main` con checks obligatorios y una aprobación, con captura para el README.
6. `openspec archive especificacion-base-reservas` en un PR propio.
7. FASE 5, una rama y un `/opsx:propose` por feature: autenticación; catálogo y disponibilidad; creación de reservas; consulta, cancelación y notificaciones; administración (RF-11 a RF-14); landing y contacto.
8. README con arquitectura e instrucciones con PostgreSQL 17 local.

## Pendientes y preguntas abiertas

- **Confirmar la base de datos**: la interpretación "PostgreSQL 17 local, sin Docker, con Prisma" no fue confirmada explícitamente.
- **Asignar RF-11 a RF-14** a uno o dos integrantes; el reparto de `requisitos.md` §8 no los incluía.
- **Casilla de contacto**: variable de entorno para el destino de `POST /contacto` y respuesta si falla el proveedor; lo define el cambio de la landing.
- **Usuarios inactivos**: si pueden iniciar sesión lo define el cambio de autenticación.
- **Prefijo del código**: `RES` por defecto; el equipo puede cambiarlo por configuración.

## Historial

- **2026-09-09**: estructura del monorepo (Nest y Next), plan de trabajo, relevamiento y contrato 2.1.0 con precio plano.
- **2026-09-14**: `openspec init` y propuesta del cambio base. Se generaron specs, diseño y tareas. Se incorporaron la consigna, el prototipo de Claude Design (club Deploy), PostgreSQL 17 local sin Docker y Next.js 16. Se decidió que todo el prototipo, incluida la administración, entra al MVP. Se creó esta memoria.
