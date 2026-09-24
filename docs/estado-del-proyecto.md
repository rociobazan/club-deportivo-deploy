# Estado del proyecto — Deploy Club

**Qué es esto:** la foto de en qué está el trabajo hoy y qué falta. Responde *qué hay* y
*quién lo destraba*.

**Qué no es:** el registro de decisiones. El *por qué* de cada elección técnica, el stack y
el historial viven en [`memoria-proyecto.md`](memoria-proyecto.md). Este documento no repite
esas decisiones: las enlaza.

**Última verificación:** 2026-09-24, contra el código y la API de GitHub, no contra lo que
dice la memoria. Los comandos que producen cada número están en la última sección, para que
cualquiera pueda rehacer la cuenta en vez de confiar en esta tabla.

---

## 1. Resumen

| Medida | Estado |
|---|---|
| Ítems del reparto cerrados | **5 de 11** (3 cerrados, 2 esperando a otra persona) |
| Requisitos funcionales implementados | **0 de 15** (RF-00 a RF-14) |
| Operaciones del contrato con endpoint | **0 de 18** |
| Pantallas de producto | **0** |
| Protección de `main` | ❌ **creada pero desactivada** |

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
| 0.3 | CI y protección de `main` | Jeremías / **Rocío** | 🟡 CI listo; **falta activar la protección** |
| 0.4 | Archivar la spec base | Adrián | ✅ PR #9, 21/09 |

El único resto del hito 0 es la protección de `main`, y no la puede hacer cualquiera: hace
falta permiso de admin, que hoy solo tiene `rociobazan`. Detalle en la sección 5.

---

## 3. Hito 1 — las features

Cada ítem es una feature completa: spec, contrato si hace falta, endpoint en Nest, tests y la
pantalla en Next que la consume.

| # | Qué | Requisitos | Responsable | Estado |
|---|---|---|---|---|
| 1.1 | Autenticación: registro, login, JWT, guards | RF-00 | **sin asignar (A)** | ❌ |
| 1.2 | Catálogo y disponibilidad | RF-01 a RF-03 | **sin asignar (B)** | ❌ |
| 1.3 | Crear reserva | RF-04 | **sin asignar (C)** | ❌ |
| 1.4 | Mis reservas, cancelación y mails | RF-05 a RF-08 | **sin asignar (D)** | ❌ |
| 1.5 | Sitio institucional y contacto | RF-09, RF-10 | **sin asignar (A + B)** | ❌ |
| 1.6 | Administración | RF-11 a RF-14 | **sin asignar (C + D)** | ❌ |
| 1.7 | README | — | Jeremías | 🟡 hecho; falta la captura de la protección |

### El bloqueo no es técnico

Mirá la columna de responsables: **siguen siendo letras**. Nadie reclamó su ítem. El reparto
pide que, al tomar una rama, se reemplace la letra por el nombre acá, en `memoria-proyecto.md`
y en `requisitos.md` §8, en el mismo PR.

Dos cosas a tener en cuenta al repartir:

- **1.1 es camino crítico.** 1.3 y 1.4 dependen de que existan los guards. Hasta entonces,
  quienes trabajen en esas dos tienen que testear con un token mockeado.
- **1.5 no depende de nadie.** Es lo único que puede arrancar hoy mismo sin esperar a otra
  persona.

---

## 4. Qué hay construido

### API (`apps/api`)

Solo el andamiaje de Nest: `app.controller.ts`, `app.service.ts`, `app.module.ts` y `main.ts`.
**Ningún módulo de negocio.** Lo que sí está listo alrededor:

- Esquema completo en `prisma/schema.prisma`, con las siete tablas, y migraciones aplicadas.
- Seed con disciplinas, canchas, equipamiento y usuarios de prueba.
- Tests corriendo en verde (Node 24 con `--experimental-vm-modules`).

**0 de 18 operaciones del contrato tienen endpoint.** El contrato define 15 rutas.

### Front (`apps/web`)

Está la base que van a usar todas las pantallas, y ninguna pantalla de producto:

| Hay | No hay |
|---|---|
| Identidad visual y tokens (`globals.css`) | Landing (Inicio, El club, Contacto) |
| Primitivas: `Button`, `Card`, `Input`, `Badge` | Registro e ingreso |
| Header con menú de mobile y menús por rol | Disponibilidad |
| Pie, logo y favicon | Formulario de reserva |
| Pantallas de 404, error y carga | Mis reservas y detalle |
| Tipos generados del contrato y cliente HTTP | Pantallas de administración |
| Página `/estilos` para revisar la identidad | |

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

### Protección de `main` — el pendiente más importante

**Hoy `main` no está protegida.** Cualquiera puede pushear directo y saltear el CI.

Existe un ruleset llamado `main`, creado el 21/09, pero está en **`enforcement: "disabled"`**,
así que GitHub no le aplica nada a la rama. Además, aunque se active tal como está, quedó con
los valores por defecto y tampoco alcanzaría:

| Configuración | Está | Tiene que estar |
|---|---|---|
| Enforcement | `disabled` | `active` |
| Aprobaciones | `0` | `1` |
| Checks obligatorios | ninguno | `specs`, `api`, `web` |
| Ramas al día | no | sí |
| Bypass de administradores | ya bloqueado ✅ | — |

Lo tiene que hacer `rociobazan`, la única cuenta con admin. Los pasos y el comando están en
[`arquitectura.md` §7](arquitectura.md).

Para verificar si quedó activa, sin necesidad de ser admin:

```bash
gh api repos/rociobazan/club-deportivo-deploy/rules/branches/main
```

Si devuelve `[]`, sigue sin proteger nada.

**Por qué importa para la nota:** la consigna pide explícitamente el bloqueo del merge. Mientras
no esté, los PRs se mergean sin aprobación registrada, que es exactamente lo que pasó con los
#4, #5, #6 y #7.

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

1. **Activar la protección de `main`** con los tres checks y una aprobación. Cierra el 0.3.
2. **Sacar la captura** de la protección ya activa, para el README. Cierra el 1.7.
3. **Agregar a Renzo** como colaborador.

### Los cuatro

4. **Repartir 1.1 a 1.6** y poner los nombres en las tres tablas. Sin esto no arranca nada.
5. **Confirmar** si Jeremías se lleva el front completo, propuesta abierta desde el 23/09.
6. **Confirmar** que la administración (1.6) va a dos personas.

### Cuando el reparto esté hecho

7. Cada quien: `/opsx:propose` de su feature, revisión de los cuatro, `/opsx:apply`.
8. Arrancar por **1.1**, que es camino crítico, y **1.5** en paralelo, que no depende de nada.

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
