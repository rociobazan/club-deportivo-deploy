# Estado del proyecto — Deploy Club

**Qué es esto:** la foto de en qué está el trabajo hoy y qué falta. Responde *qué hay* y
*quién lo destraba*.

**Qué no es:** el registro de decisiones. El *por qué* de cada elección técnica, el stack y
el historial viven en [`memoria-proyecto.md`](memoria-proyecto.md). Este documento no repite
esas decisiones: las enlaza.

**Última verificación:** 2026-09-26, contra el código y la API de GitHub, no contra lo que
dice la memoria. Los comandos que producen cada número están en la última sección, para que
cualquiera pueda rehacer la cuenta en vez de confiar en esta tabla.

---

## 1. Resumen

| Medida | Estado |
|---|---|
| Ítems del reparto cerrados | **5 de 11** (4 cerrados; el 1.7 espera la captura) |
| Requisitos funcionales implementados | **0 de 15** en `main`; RF-00 en el PR #19 y **RF-01, RF-02, RF-03 y RF-07 en el PR de 1.2** |
| Operaciones del contrato con endpoint | **0 de 18** en `main`; 3 en el PR #19 y 4 más en el PR de 1.2 (7 de 18) |
| Pantallas de producto | **0** en `main`; ingreso y registro (PR #19), canchas y disponibilidad (PR de 1.2) |
| Protección de `main` | ✅ **activa**: 1 aprobación y los tres checks |

Los dos números importan y dicen cosas distintas. Lo cerrado es **toda la infraestructura**:
contrato, specs, base de datos, CI, tests, README y la base del front. Era la condición para
poder trabajar en paralelo, y está lista. **El producto todavía no empezó**: la API no tiene
ni un endpoint de negocio y no hay ninguna pantalla que un usuario pueda usar.

---

## 2. Hito 0 — desbloquear

| # | Qué | Responsable | Estado |
|---|---|---|---|
| 0.1 | Spec y contrato base | — | ✅ PR #3, 17/09 |
| 0.2 | Tests de la API | Jeremías | ✅ PR #5, 21/09 |
| 0.3 | CI y protección de `main` | Jeremías / Rocío | ✅ CI el 21/09; protección activa el 24/09 |
| 0.4 | Archivar la spec base | Adrián | ✅ PR #9, 21/09 |

**El hito 0 está cerrado.** De esa etapa solo queda la captura de la protección para el README,
que pertenece al ítem 1.7.

---

## 3. Hito 1 — las features

Cada ítem es una feature completa: spec, contrato si hace falta, endpoint en Nest, tests y la
pantalla en Next que la consume.

| # | Qué | Requisitos | Responsable | Estado |
|---|---|---|---|---|
| 1.1 | Autenticación: registro, login, JWT, guards | RF-00 | **Jeremías** | 🟡 **implementado en el PR #19**, esperando revisión |
| 1.1b | Login con Google | — | **Jeremías** | ❌ decidido ([ADR 0001](adr/0001-login-con-google.md)), entra después de 1.1 |
| 1.2 | Catálogo y disponibilidad | RF-01 a RF-03 | **Jeremías** | 🟡 **implementado**, PR apilado sobre el #19, esperando que ese entre |
| 1.3 | Crear reserva | RF-04 | **sin asignar (C)** | ❌ sus dos dependencias (1.1 y 1.2) ya están implementadas: puede arrancar |
| 1.4 | Mis reservas, cancelación y mails | RF-05 a RF-08 | **sin asignar (D)** | ❌ |
| 1.5 | Sitio institucional y contacto | RF-09, RF-10 | **Jeremías** | ❌ sin empezar |
| 1.6 | Administración | RF-11 a RF-14 | **sin asignar (C + D)** | ❌ |
| 1.7 | README | — | Jeremías | 🟡 hecho; falta la captura de la protección |

### Lo que falta repartir

Jeremías tomó **1.1, 1.2 y 1.5** el 24/09. Quedan **1.3, 1.4 y 1.6** sin dueño, y son tres
ítems para tres personas: Adrián, Rocío y Renzo. Quien tome una rama reemplaza la letra por su
nombre acá, en `memoria-proyecto.md` y en `requisitos.md` §8, en el mismo PR.

Dos cosas a tener en cuenta al repartir:

- **1.1 es camino crítico.** 1.3 y 1.4 dependen de que existan los guards. Hasta entonces,
  quienes trabajen en esas dos tienen que testear con un token mockeado.
- **1.5 no depende de nadie.** Es lo único que puede arrancar hoy mismo sin esperar a otra
  persona.

---

## 4. Qué hay construido

### API (`apps/api`)

Solo el andamiaje de Nest: `app.controller.ts`, `app.service.ts`, `app.module.ts` y `main.ts`.
**Ningún módulo de negocio en `main`.** El PR #19 trae el módulo `auth` y la base que las demás features reutilizan: guards globales con `@Publico()` y `@Roles()`, `ErrorDeApi`, el filtro con el schema `Error` y `PrismaModule`. Lo que sí está listo alrededor:

- Esquema completo en `prisma/schema.prisma`, con las siete tablas, y migraciones aplicadas.
- Seed con disciplinas, canchas, equipamiento y usuarios de prueba.
- Tests corriendo en verde (Node 24 con `--experimental-vm-modules`).

**0 de 18 operaciones del contrato tienen endpoint en `main`**; el PR #19 suma `POST /auth/registro`, `POST /auth/login` y `GET /auth/perfil`. El contrato define 15 rutas.

### Front (`apps/web`)

Está la base que van a usar todas las pantallas, y ninguna pantalla de producto:

| Hay | No hay |
|---|---|
| Identidad visual y tokens (`globals.css`) | Landing (Inicio, El club, Contacto) |
| Primitivas: `Button`, `Card`, `Input`, `Badge` | Registro e ingreso (en el PR #19) |
| Header con menú de mobile y menús por rol | Formulario de reserva |
| Pie, logo y favicon | Mis reservas y detalle |
| Pantallas de 404, error y carga | Pantallas de administración |
| Tipos generados del contrato y cliente HTTP | Landing (Inicio, El club, Contacto) |
| Página `/estilos` para revisar la identidad | |
| Canchas y precios y Disponibilidad (PR de 1.2) | |

La home (`app/page.tsx`) sigue siendo la plantilla por defecto de Next: la reemplaza 1.5.

### Specs

`openspec/specs/` tiene las siete capacidades vigentes: `administracion`, `autenticacion`,
`catalogo`, `disponibilidad`, `institucional`, `notificaciones` y `reservas`.

**No hay ninguna propuesta en curso**: `openspec/changes/` solo tiene `archive/`. Cada feature
del hito 1 arranca con su propio `/opsx:propose`, que los cuatro revisan antes del `/opsx:apply`.

---

## 5. Infraestructura

### CI

Tres checks obligatorios en cada PR a `main` y en cada push a `main`:

| Check | Qué corre |
|---|---|
| `specs` | OpenSpec en modo estricto y lint del contrato |
| `api` | Migraciones contra `postgres:17`, lint, build y tests de la API |
| `web` | Lint y build del front, que además verifica los tipos |

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

**Falta la captura** de esa pantalla para el README: es la evidencia que pide la consigna y es
lo único que queda abierto del ítem 1.7.

Todos los PRs anteriores al 24/09 entraron sin que GitHub exigiera aprobación, porque la
protección no existía. De acá en adelante la exige solo.

---
## 6. Participación del equipo

Cuenta para la evaluación: la lista de *Contributors* es parte de lo que se mira.

| Persona | Commits en `main` | PRs mergeados |
|---|---|---|
| Jeremías | 28 | 14 |
| Adrián | 17 | 2 |
| Rocío | 2 | 0 |
| Renzo | **0** | **0** |

Dos cosas que conviene mirar de frente:

- **Renzo todavía no es colaborador del repo** y no tiene ninguna contribución. Lo tiene que
  agregar Rocío desde Settings → Collaborators.
- **El reparto está desbalanceado.** `requisitos.md` §8 desaconseja repartir por capas
  justamente porque desbalancea los commits. Repartir el hito 1 es lo que corrige esto, y cada
  feature completa (spec, endpoint, tests, pantalla) da commits parejos a las cuatro personas.

> `git shortlog` muestra a Jeremías con dos nombres (`JereDev` y `Jeremias Fernandez`), pero los
> dos commits salen del mismo email, y GitHub arma *Contributors* por email. Cuenta como una
> sola persona; no hay nada que corregir.

---

## 7. Qué falta, por quién lo destraba

### Rocío (bloquea al resto)

1. **Sacar la captura** de la protección ya activa, para el README. Cierra el 1.7.
2. **Agregar a Renzo** como colaborador.

### Los cuatro

3. **Repartirse 1.3, 1.4 y 1.6** y poner los nombres en las tres tablas.
4. **Confirmar** si Jeremías se lleva el front completo, propuesta abierta desde el 23/09.
5. **Confirmar** que la administración (1.6) va a dos personas.

### Cuando el reparto esté hecho

6. Cada quien: `/opsx:propose` de su feature, revisión de los cuatro, `/opsx:apply`.
7. Arrancar por **1.1**, que es camino crítico, y **1.5** en paralelo, que no depende de nada.

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
