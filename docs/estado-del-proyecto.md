# Estado del proyecto — Deploy Club

**Qué es esto:** la foto de en qué está el trabajo hoy y qué falta. Responde *qué hay* y
*quién lo destraba*.

**Qué no es:** el registro de decisiones. El *por qué* de cada elección técnica, el stack y
el historial viven en [`memoria-proyecto.md`](memoria-proyecto.md). Este documento no repite
esas decisiones: las enlaza.

**Última verificación:** 2026-09-28, contra el código y la API de GitHub, no contra lo que
dice la memoria. Los comandos que producen cada número están en la última sección, para que
cualquiera pueda rehacer la cuenta en vez de confiar en esta tabla.

> Los números están medidos sobre la rama de este PR, que es la punta de la pila **#25 → #26 →
> #27 → #28**, y valen cuando la pila entre entera. Si estás leyendo esto en `main`, los comandos de la
> última sección tienen que devolver lo mismo.

---

## 1. Resumen

| Medida | Estado |
|---|---|
| Ítems del reparto cerrados | **8 de 11**: todo el hito 0, más 1.1, 1.2, 1.5 y 1.7 |
| Requisitos funcionales implementados | **7 de 15**: RF-00, RF-01, RF-02, RF-03, RF-07, RF-09 y RF-10 |
| Operaciones del contrato con endpoint | **8 de 18** |
| Pantallas de producto | **7**: inicio, El club, contacto, canchas, disponibilidad, ingreso y registro |
| Protección de `main` | ✅ **activa**: 1 aprobación y los tres checks |

**El producto arrancó.** Un visitante ya puede entrar al sitio, ver el club y los precios,
consultar qué turnos hay libres, escribir por el formulario de contacto, registrarse e iniciar
sesión. Lo que todavía no puede es **reservar**: eso es 1.3, y con 1.4 y 1.6 son los tres ítems
que faltan.

La infraestructura estaba lista desde el hito 0 —contrato, specs, base de datos, CI, tests,
README y la base del front—, que era la condición para trabajar en paralelo.

---

## 2. Hito 0 — desbloquear

| # | Qué | Responsable | Estado |
|---|---|---|---|
| 0.1 | Spec y contrato base | — | ✅ PR #3, 17/09 |
| 0.2 | Tests de la API | Jeremías | ✅ PR #5, 21/09 |
| 0.3 | CI y protección de `main` | Jeremías / Rocío | ✅ CI el 21/09; protección activa el 24/09 |
| 0.4 | Archivar la spec base | Adrián | ✅ PR #9, 21/09 |

**El hito 0 está cerrado**, sin nada pendiente de esa etapa.

---

## 3. Hito 1 — las features

Cada ítem es una feature completa: spec, contrato si hace falta, endpoint en Nest, tests y la
pantalla en Next que la consume.

| # | Qué | Requisitos | Responsable | Estado |
|---|---|---|---|---|
| 1.1 | Autenticación: registro, login, JWT, guards | RF-00 | **Jeremías** | ✅ en `main` (PR #19, 28/09) |
| 1.1b | Login con Google | — | — | ⛔ **descartado el 27/09**: el equipo decidió no hacerlo ([ADR 0001](adr/0001-login-con-google.md), marcada como descartada) |
| 1.2 | Catálogo y disponibilidad | RF-01 a RF-03 | **Jeremías** | ✅ en `main` (PR #25, 28/09) |
| 1.3 | Crear reserva | RF-04 | **sin asignar (C)** | ❌ sus dos dependencias (1.1 y 1.2) ya están en `main`: puede arrancar |
| 1.4 | Mis reservas, cancelación y mails | RF-05 a RF-08 | **sin asignar (D)** | ❌ puede arrancar |
| 1.5 | Sitio institucional y contacto | RF-09, RF-10 | **Jeremías** | ✅ en `main` (PR #26, 28/09) |
| 1.6 | Administración | RF-11 a RF-14 | **sin asignar (C + D)** | ❌ puede arrancar |
| 1.7 | README | — | Jeremías | ✅ hecho el 27/09: la captura de la protección se reemplazó por una tabla con el estado real del ruleset, leída de la API de GitHub y reproducible con un comando |

### Lo que falta repartir

Jeremías tomó **1.1, 1.2 y 1.5** el 24/09. Quedan **1.3, 1.4 y 1.6** sin dueño, y son tres
ítems para tres personas: Adrián, Rocío y Renzo. Quien tome una rama reemplaza la letra por su
nombre acá, en `memoria-proyecto.md` y en `requisitos.md` §8, en el mismo PR.

Dos cosas a tener en cuenta al repartir:

- **Ya no hay camino crítico.** 1.1 lo era, porque 1.3 y 1.4 dependen de los guards; está en
  `main`, así que nadie necesita mockear el token.
- **1.3, 1.4 y 1.6 pueden arrancar las tres hoy.** Sus dependencias (1.1, 1.2 y el cliente de
  mail que trajo 1.5) están en `main`. 1.4 reutiliza `Correo`/`Correo.enviar()` de
  `common/correo/` y su doble, sin volver a decidir proveedor ni cómo se testea.

**Al abrir un PR apilado, ponele `main` de base, no la rama de abajo.** El 28/09 la pila de
Jeremías se mergeó con las bases apiladas puestas y cuatro PRs terminaron adentro de su rama
base en vez de en `main`; hubo que rehacerlos como #25 a #28. La nota "retargetear antes de
mergear" en el cuerpo del PR no alcanza, porque quien la tiene que ejecutar es quien mergea.

---

## 4. Qué hay construido

### API (`apps/api`)

Cuatro módulos de negocio: `auth`, `catalogo`, `disponibilidad` y `contacto`, más la base
transversal que las features nuevas reutilizan sin volver a decidir nada:

- **`common/`**: guards globales con `@Publico()`, `@Roles()` y `@UsuarioActual()`, `ErrorDeApi`
  y el filtro que responde con el schema `Error` del contrato, el pipe de validación, `Reloj`
  (todo lo que compara contra el presente pasa por ahí) y el cliente de mail `Correo`.
- Esquema completo en `prisma/schema.prisma`, con las siete tablas, y migraciones aplicadas.
- Seed idempotente con disciplinas, canchas, equipamiento y usuarios de prueba.
- Tests en verde (Node 24 con `--experimental-vm-modules`): 138 unitarios y los e2e en serie.

**8 de 18 operaciones del contrato tienen endpoint**: las tres de `auth` (registro, login y
perfil), las de catálogo y disponibilidad, y `POST /contacto`. Faltan las de reservas (1.3 y
1.4) y las de administración (1.6).

### Front (`apps/web`)

Siete pantallas de producto y la base que usan todas:

| Hay | No hay |
|---|---|
| Inicio, El club y Contacto | Formulario de reserva |
| Canchas y precios, y Disponibilidad | Mis reservas y detalle |
| Registro e ingreso, con sesión en cookie | Pantallas de administración |
| Identidad visual y tokens (`globals.css`) | |
| Primitivas: `Button`, `Card`, `Input`, `Textarea`, `Badge` | |
| Header con menú de mobile y menús por rol | |
| Pie, logo y favicon | |
| Pantallas de 404, error y carga | |
| Tipos generados del contrato y cliente HTTP | |
| Página `/estilos` para revisar la identidad | |

La home dejó de ser la plantilla por defecto de Next en el PR de 1.5.

### Specs

`openspec/specs/` tiene las siete capacidades vigentes: `administracion`, `autenticacion`,
`catalogo`, `disponibilidad`, `institucional`, `notificaciones` y `reservas`.

**No hay cambios en curso en `openspec/changes/`.** Los tres de Jeremías se archivaron el 28/09
—`implementar-autenticacion` (1.1), `implementar-catalogo-y-disponibilidad` (1.2) e
`implementar-landing-y-contacto` (1.5)— y sus deltas pasaron a `openspec/specs/`: siete requisitos
nuevos, cuatro en `autenticacion` y uno en `catalogo`, `disponibilidad` e `institucional`. **Las
specs ya describen lo que la API y el sitio hacen.**

Cada feature del hito 1 arranca con su propio `/opsx:propose`, que los cuatro revisan antes del
`/opsx:apply`.

---

## 5. Infraestructura

### CI

Cuatro jobs en cada PR a `main` y en cada push a `main`. Los tres primeros son los checks
**obligatorios** del ruleset; `e2e` todavía no lo es:

| Check | Qué corre |
|---|---|
| `specs` | OpenSpec en modo estricto y lint del contrato |
| `api` | Migraciones contra `postgres:17`, lint, build y tests de la API |
| `web` | Lint y build del front, que además verifica los tipos |
| `e2e` | 14 tests de navegador con Playwright contra la pila entera: Postgres, la API y el front servido en producción ([ADR 0002](adr/0002-tests-e2e-con-playwright.md)) |

**`e2e` no bloquea todavía.** Corre e informa, pero sumarlo como cuarto check obligatorio lo tiene
que hacer `rociobazan`, la única cuenta con admin. Hasta entonces, un PR con los e2e en rojo se
puede mergear igual.

### Protección de `main` — activa desde el 24/09

`main` ya no acepta pushes directos ni merges sin revisión:

| Regla | Estado |
|---|---|
| Pull request obligatorio | ✅ con **1 aprobación** |
| Checks obligatorios | ✅ `specs`, `api` y `web` |
| Rama al día antes de mergear | ✅ |
| Borrado y force-push | ✅ bloqueados |
| Bypass de administradores | ✅ nadie puede saltearla |

Está implementada como **ruleset** (`Settings → Rules`), no como la regla clásica de
`Settings → Branches` que describe [`arquitectura.md` §7](arquitectura.md). Las dos sirven; lo
que cambia es dónde se edita.

Se verifica sin ser admin:

```bash
gh api repos/rociobazan/club-deportivo-deploy/rules/branches/main
```

Tiene que devolver las cuatro reglas. Si devuelve `[]`, no está protegiendo nada.

El README lleva esa misma tabla con el estado real del *ruleset*, no una captura: se puede
volver a verificar con el comando de arriba y no envejece sin que nadie se entere. Con eso quedó
cerrado el ítem 1.7 el 27/09.

Todos los PRs anteriores al 24/09 entraron sin que GitHub exigiera aprobación, porque la
protección no existía. De acá en adelante la exige solo.

---
## 6. Participación del equipo

Cuenta para la evaluación: la lista de *Contributors* es parte de lo que se mira.

| Persona | Commits en `main` | PRs mergeados |
|---|---|---|
| Jeremías | 77 | 26 |
| Adrián | 17 | 2 |
| Rocío | 2 | 0 |
| Renzo | **0** | **0** |

Dos cosas que conviene mirar de frente:

- **Renzo todavía no es colaborador del repo** y no tiene ninguna contribución. Lo tiene que
  agregar Rocío desde Settings → Collaborators.
- **El reparto está muy desbalanceado, y se agrandó.** Jeremías cerró sus tres ítems del hito 1
  y eso le sumó casi cincuenta commits. `requisitos.md` §8 desaconseja repartir por capas
  justamente porque desbalancea los commits, y esto se evalúa. Lo único que lo corrige es que
  1.3, 1.4 y 1.6 las tomen los otros tres: cada feature completa (spec, endpoint, tests,
  pantalla) da un volumen parecido al de las que ya entraron.

> `git shortlog` muestra a Jeremías con dos nombres (`JereDev` y `Jeremias Fernandez`), pero los
> dos commits salen del mismo email, y GitHub arma *Contributors* por email. Cuenta como una
> sola persona; no hay nada que corregir.

---

## 7. Qué falta, por quién lo destraba

### Rocío (bloquea al resto)

1. **Agregar a Renzo** como colaborador. Es lo único que bloquea al resto.

> También suyo, pero sin apuro: **sumar `e2e` a los checks obligatorios** del ruleset, cuando el
> job lleve unas corridas estables. Hoy corre e informa, así que un PR con los tests de navegador
> en rojo se puede mergear igual.

### Los cuatro

2. **Repartirse 1.3, 1.4 y 1.6** y poner los nombres en las tres tablas. Es lo que equilibra la
   participación, que hoy está muy despareja.
3. **Confirmar** si Jeremías se lleva el front completo, propuesta abierta desde el 23/09.
4. **Confirmar** que la administración (1.6) va a dos personas.

### Cuando el reparto esté hecho

5. Cada quien: `/opsx:propose` de su feature, revisión de los cuatro, `/opsx:apply`.
6. Al abrir los PRs, **base `main` siempre**, incluso si la rama se apila sobre otra feature.
7. Al mergear, `/opsx:archive <cambio>` desde `main`: ahí los deltas pasan a `openspec/specs/`.
   Si no se hace, las specs dejan de describir lo que el código hace.

---

## 8. Cómo se actualiza este documento

Se actualiza **en el mismo PR** que cambia el estado, igual que `memoria-proyecto.md`. Quien
cierra un ítem lo marca acá.

Los números no se escriben de memoria. Estos comandos los regeneran:

```bash
git shortlog -sn --no-merges main
```

```bash
gh pr list --state merged --limit 50 --json number,author --jq '.[].author.login' | sort | uniq -c | sort -rn
```

```bash
grep -cE "^    (get|post|put|patch|delete):" contratos/openapi.yaml
```

```bash
gh api repos/rociobazan/club-deportivo-deploy/rules/branches/main
```

Para lo demás alcanza con mirar: `apps/api/src` (módulos de la API), `apps/web/app` (pantallas)
y `openspec/changes` (propuestas en curso).
