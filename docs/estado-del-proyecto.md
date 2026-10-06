# Estado del proyecto — Deploy Club

**Qué es esto:** la foto de en qué está el trabajo hoy y qué falta. Responde *qué hay* y
*quién lo destraba*.

**Qué no es:** el registro de decisiones. El *por qué* de cada elección técnica, el stack y
el historial viven en [`memoria-proyecto.md`](memoria-proyecto.md). Este documento no repite
esas decisiones: las enlaza.

**Última verificación:** 2026-10-05, después del #52, contra el código y la API de GitHub, no contra lo que
dice la memoria. Los comandos que producen cada número están en la última sección, para que
cualquiera pueda rehacer la cuenta en vez de confiar en esta tabla. Los endpoints y las
pantallas se contaron sobre `main` el 01/10. **Los tests se volvieron a medir el 2026-10-04,
después del #43**: los unitarios corriéndolos sobre `main`, y los e2e de la API y de navegador
con el verde del CI del #43, que corrió sobre la rama ya al día con `main` —el mismo árbol que
entró—, no con una corrida local.

**Remedido sobre `main` el 2026-10-04, apenas entró el #48** (ítem 1.6), en el mismo PR que lo
archiva: 20 operaciones con endpoint, 353 unitarios y 181 e2e de la API corriéndolos, 36 de
navegador con `playwright test --list`, y la participación con `git shortlog` y `gh pr list`.
Coincidieron con lo que el #48 había medido y declarado sobre su rama: esta vez la regla se
cumplió entera.

**Revisado de nuevo el 2026-10-05, después del #50.** Los ítems, los requisitos, las operaciones,
las pantallas, los 353 unitarios y los 36 de navegador se volvieron a medir y **coinciden todos**.
Los 181 e2e de la API son el conteo real, pero el verde sigue siendo el del CI: corridos en local
sin base levantada fallan los 181, que es lo esperado. Lo único que estaba corrido era la tabla de
participación, por los merges del #49 y el #50; está corregida más abajo, con el motivo.

**Remedido sobre `main` el 2026-10-05, en el mismo PR que archiva 1.3.** La rama estaba al día con
`main` (mismo árbol salvo el archivado), así que vale como medida de `main`. Coincidieron las 20
operaciones, las 16 pantallas de producto, los 181 e2e de la API (el conteo real; el verde es el
del CI, que pasó en todos los push a `main` hasta el #52) y los 36 de navegador. **No coincidió un
número: los unitarios son 357, no 353.** El #53 (el log del id de Resend) sumó cuatro tests a
`correo-resend.spec.ts` y entró después de la última medición. Además el comando de los PRs
mergeados traía `--limit 50` y hay 53, así que cortaba los más viejos y le quitaba un PR a Adrián;
quedó en `--limit 200`.

**Medido sobre la rama del #54 (despliegue en EC2) el 2026-10-05, no sobre `main`.** La rama
tenía `main` al día, con el archivado de 1.3 incluido. El #54 suma la carga de producción con
sus tests: **363 unitarios** (357 + 6) y **187 e2e de la API** (181 + 6), y dos jobs al CI,
`imagenes` y `deploy`. Las 20 operaciones y los 36 de navegador no cambian. **Hay que volver a
medir sobre `main` cuando entre el #54.**

> Todos los números de este documento están medidos sobre `main`, con los comandos de la última
> sección. Si alguna vez se miden sobre la rama de un PR todavía abierto, hay que decirlo acá y
> **volver a medirlos cuando entre**. La vez anterior quedaron medidos sobre la rama del #34 con
> la nota "valen cuando entre", el #34 entró y nadie los volvió a medir: el documento siguió
> afirmando en presente un estado que ya era viejo. Pasó dos veces: con el #34 y con el #42,
> que declaró sus números como de rama —eso es lo que la regla pide— pero entró sin que nadie
> los remidiera. **Declararlos es la mitad; la otra mitad es volver**.

---

## 1. Resumen

| Medida | Estado |
|---|---|
| Ítems del reparto cerrados | **12 de 12**: todo el hito 0 y todo el hito 1 |
| Requisitos funcionales implementados | **16 de 16**: RF-00 a RF-15 |
| Operaciones del contrato con endpoint | **20 de 20**: las cinco de administración entraron con el #48 |
| Pantallas de producto | **16**: inicio, El club, contacto, canchas, disponibilidad, ingreso, registro, reservar, mis reservas con su detalle, mi perfil, y **las cinco de `/admin`**: panel, reservas con su detalle, canchas y equipamiento |
| Protección de `main` | ✅ **activa**: 1 aprobación y los cuatro checks |

**El recorrido principal está completo.** Un visitante ya puede entrar al sitio, ver el club y
los precios, consultar qué turnos hay libres, escribir por el formulario de contacto, registrarse
e iniciar sesión, **reservar un turno**, y después ver sus reservas y cancelarlas. De punta a
punta: elige el turno en `/disponibilidad`, lo confirma en `/reservar` y recibe el código.
**Con 1.6 el MVP está completo**: el administrador ve el panel del día, administra las reservas
de todos, y da de alta, edita y da de baja canchas y equipamiento.

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
| 1.3 | Crear reserva | RF-04 | **Adrián** | ✅ en `main` (PR #42, 01/10); archivado el 05/10 |
| 1.4 | Mis reservas, cancelación y mails | RF-05 a RF-08 | **Rocío** | ✅ en `main` (PR #32, 30/09) |
| 1.5 | Sitio institucional y contacto | RF-09, RF-10 | **Jeremías** | ✅ en `main` (PR #26, 28/09) |
| 1.6 | Administración | RF-11 a RF-14 | **Renzo** | ✅ en `main` (propuesta en el PR #47 e implementación en el #48, 04/10); archivado |
| 1.7 | README | — | Jeremías | ✅ hecho el 27/09: la captura de la protección se reemplazó por una tabla con el estado real del ruleset, leída de la API de GitHub y reproducible con un comando |
| 1.8 | Mi perfil: datos de la cuenta | RF-15 | Jeremías | ✅ en `main` (PR #34, 30/09) |

### El reparto, ya cerrado

Jeremías tomó **1.1, 1.2 y 1.5** el 24/09, y después el RF-15. El 30/09 se cerró el resto:
**1.3 es de Adrián, 1.4 de Rocío y 1.6 de Renzo**. No queda ningún ítem sin dueño.

Dos cosas a tener en cuenta:

- **Ya no hay camino crítico.** 1.1 lo era, porque 1.3 y 1.4 dependen de los guards; está en
  `main`, así que nadie necesita mockear el token.
- **1.3 y 1.4 escribieron los mismos cinco archivos.** El #32 trajo `reservas.service.ts`,
  `reservas.controller.ts`, `reservas.module.ts`, `mapeadores.ts` y `dto/dto.spec.ts`, que el
  `tasks.md` de 1.3 mandaba **crear**. Se resolvió **combinando** las dos implementaciones, no
  eligiendo una: un solo servicio con `crear()` y con el listado y la cancelación, un controlador
  con los cinco endpoints, y todos los tests de los dos lados. El detalle, en la decisión 32 de
  [`memoria-proyecto.md`](memoria-proyecto.md). Que no se pisaran fue por el orden de merge, no
  porque estuviera planificado: conviene no repetirlo con 1.6.

**Al abrir un PR apilado, ponele `main` de base, no la rama de abajo.** El 28/09 la pila de
Jeremías se mergeó con las bases apiladas puestas y cuatro PRs terminaron adentro de su rama
base en vez de en `main`; hubo que rehacerlos como #25 a #28. La nota "retargetear antes de
mergear" en el cuerpo del PR no alcanza, porque quien la tiene que ejecutar es quien mergea.

**1.4 está en `main` desde el 30/09** (módulos `reservas` y `notificaciones`, pantalla
`/mis-reservas`), con 24 unitarios de `ReservasService` y 30 e2e propios, y sus deltas ya
pasaron a `openspec/specs/reservas`. Entró con el PR #32 y se archivó con el #40.

---

## 4. Qué hay construido

### API (`apps/api`)

Siete módulos de negocio: `auth`, `catalogo`, `disponibilidad`, `contacto`, `reservas`,
`notificaciones` y **`administracion`**, más la base
transversal que las features nuevas reutilizan sin volver a decidir nada:

- **`common/`**: guards globales con `@Publico()`, `@Roles()` y `@UsuarioActual()`, `ErrorDeApi`
  y el filtro que responde con el schema `Error` del contrato, el pipe de validación, `Reloj`
  (todo lo que compara contra el presente pasa por ahí) y el cliente de mail `Correo`.
- Esquema completo en `prisma/schema.prisma`, con las siete tablas, y migraciones aplicadas.
- Seed idempotente con disciplinas, canchas, equipamiento y usuarios de prueba.
- Carga de producción aparte (`npm run carga:produccion`): catálogo, si la base no tiene, y un
  administrador desde el entorno ([ADR 0003](adr/0003-despliegue-en-ec2.md)).
- Tests en verde (Node 24 con `--experimental-vm-modules`): 363 unitarios y 187 e2e en serie.

**Las 20 operaciones del contrato tienen endpoint**: las cinco de `auth` (registro,
login, ver el perfil, editarlo y cambiar la contraseña), las de catálogo y disponibilidad,
`POST /contacto`, las cuatro que trajo 1.4 (listar reservas, ver una, cancelarla y reenviar el
mail), **`POST /reservas`**, que trae 1.3, y las cinco de administración que trae 1.6: el alta y
la edición de canchas y de equipamiento, y `GET /admin/panel`. El contrato pasa a **2.3.0**: las
cuatro del ABM declaran el 409 `NOMBRE_DUPLICADO`.

El módulo `reservas` cubre el ciclo de vida completo en un solo servicio: la creación, con sus
ocho reglas de negocio, más el listado, el detalle, la cancelación y el reenvío. Las cinco
operaciones comparten el mismo `include` y el mismo mapeador, así que todas devuelven la misma
forma de `Reserva`.

### Front (`apps/web`)

Dieciséis pantallas de producto y la base que usan todas:

| Hay | No hay |
|---|---|
| Inicio, El club y Contacto | |
| Administración: panel, reservas de todos con su detalle, canchas y equipamiento | |
| Canchas y precios, y Disponibilidad | |
| Reservar un turno, con el total a la vista | |
| Registro e ingreso, con sesión en cookie | |
| Mis reservas y su detalle, con cancelación | |
| Mi perfil: datos y cambio de contraseña | |
| Identidad visual y tokens (`globals.css`) | |
| Primitivas: `Button`, `Card`, `Input`, `Textarea`, `Select`, `Badge` | |
| Header con menú de mobile y menús por rol | |
| Pie, logo y favicon | |
| Pantallas de 404, error y carga | |
| Tipos generados del contrato y cliente HTTP | |
| Página `/estilos` para revisar la identidad | |

La home dejó de ser la plantilla por defecto de Next en el PR de 1.5.

### Specs

`openspec/specs/` tiene las siete capacidades vigentes: `administracion`, `autenticacion`,
`catalogo`, `disponibilidad`, `institucional`, `notificaciones` y `reservas`.

`implementar-administracion` (1.6) **se archivó el 04/10**, en el PR que siguió al #48: sumó un
requisito de pantalla a `administracion`, `catalogo` y `reservas`, y modificó los dos de
administración de `catalogo` (nombre repetido, disciplina inactiva).

`implementar-creacion-de-reserva` (1.3) **se archivó el 05/10**, con sus 31 tareas cerradas: sumó
el requisito de pantalla de `/reservar` a `reservas` y **corrigió** RN-09, que no decía nada del
horario por día (el cierre del sábado y `DIAS_CERRADOS`) aunque el código y sus tests ya lo
cumplían. Con eso **no queda ningún cambio en curso en `openspec/changes/`**: el de 1.4 se había
archivado con el PR #40 y el de 1.6 con el #49.

Los tres de Jeremías se archivaron el 28/09
—`implementar-autenticacion` (1.1), `implementar-catalogo-y-disponibilidad` (1.2) e
`implementar-landing-y-contacto` (1.5)— y sus deltas pasaron a `openspec/specs/`: siete requisitos
nuevos, cuatro en `autenticacion` y uno en `catalogo`, `disponibilidad` e `institucional`. El 30/09
se archivó `implementar-perfil-de-usuario` (RF-15), que sumó dos requisitos más a `autenticacion`
y modificó el de `institucional`, y también `implementar-reservas-notificaciones` (1.4), que sumó
un requisito a `reservas`.

**Las specs describen lo que la API y el sitio hacen.**

Cada feature del hito 1 arranca con su propio `/opsx:propose`, que los cuatro revisan antes del
`/opsx:apply`.

---

## 5. Infraestructura

### CI

Cuatro jobs en cada PR a `main` y en cada push a `main`. Los cuatro son checks **obligatorios**
del ruleset:

| Check | Qué corre |
|---|---|
| `specs` | OpenSpec en modo estricto y lint del contrato |
| `api` | Migraciones contra `postgres:17`, lint, build y tests de la API |
| `web` | Lint y build del front, que además verifica los tipos |
| `e2e` | 36 tests de navegador con Playwright contra la pila entera: Postgres, la API y el front servido en producción ([ADR 0002](adr/0002-tests-e2e-con-playwright.md)) |

**`e2e` bloquea desde el 30/09.** Hasta esa fecha corría e informaba, así que un PR con los e2e en
rojo se podía mergear igual. Lo sumó `rociobazan`, porque editar un *ruleset* pide permiso de admin
y es la única cuenta que lo tiene —el resto figura como `write`—.

Ese mismo día se activaron en el repo **Allow auto-merge** y **Automatically delete head
branches**: se puede dejar un PR con auto-merge para que entre solo cuando tenga la aprobación y
los checks en verde, y la rama se borra sola al mergear.

**Dos jobs más desde el #54, que no son checks obligatorios:** `imagenes` y `deploy` corren solo
en push a `main`, después de `e2e`, y publican el sistema en `https://clubdeploy.online`
([ADR 0003](adr/0003-despliegue-en-ec2.md)). Esperan a la variable del repo
`DEPLOY_HABILITADO=true`; mientras no esté, figuran como omitidos.

### Despliegue

| Qué | Estado |
|---|---|
| Código del despliegue (Dockerfiles, compose, CI, carga) | En el #54 |
| Dominio `clubdeploy.online` | ✅ comprado en Porkbun, sin renovación automática |
| Instancia EC2, DNS y Resend | ⏳ pendiente, a mano ([`despliegue.md`](despliegue.md)) |
| Secretos `EC2_*` y `DEPLOY_HABILITADO` | ⏳ pendiente: los carga Rocío, única admin del repo |

### Protección de `main` — activa desde el 24/09

`main` ya no acepta pushes directos ni merges sin revisión:

| Regla | Estado |
|---|---|
| Pull request obligatorio | ✅ con **1 aprobación** |
| Checks obligatorios | ✅ `specs`, `api`, `web` y `e2e` |
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
| Jeremías | 103 | 40 |
| Adrián | 28 | 4 |
| Rocío | 18 | 6 |
| Renzo | 17 | 3 |

Medido sobre `main` el 2026-10-05, después del #52. Los 103 de Jeremías suman sus dos nombres de
`git shortlog` (100 y 3), que salen del mismo email. El archivado de 1.3 suma un commit y un PR de
Adrián que esta tabla no puede ver.

**Esta tabla nace desactualizada, y no hay forma de evitarlo: un PR no puede contar su propio
merge.** El #49 la remidió bien sobre `main`, pero su propio merge sumó un commit y un PR que ya
no podía ver, y después entró el #50. Así que o se mide en un PR que no cambie nada más, o se
acepta el desfasaje y se lo fecha, que es lo que hace la línea de arriba. Si el número tiene que
estar exacto para la entrega, hay que medirlo **después** del último merge.

Dos cosas que conviene mirar de frente:

- ~~**Renzo sin ninguna contribución.**~~ **Resuelto el 04/10**: la propuesta de 1.6 (#47), su
  implementación (#48) y el archivado (#49) le dan 17 commits y 3 PRs. Se commiteó por paso, un
  commit por grupo de tareas, que es lo que recomienda el punto de abajo.
- **El reparto quedó desbalanceado, y ya no hay nada pendiente que lo corrija.** Jeremías tiene
  103 commits contra 28, 18 y 17 del resto. `requisitos.md` §8 desaconseja repartir por capas
  justamente porque desbalancea los commits, y esto se evalúa. Con el hito 1 cerrado, lo que
  quedaba por entrar ya entró: 1.3 el 01/10 y 1.6 el 04/10. Dicho de otro modo, **la diferencia
  que se ve es la final**, y no el retrato de un trabajo a medio terminar.

  Dos cosas que la explican, y que conviene saber leer:

  - **El volumen de *commits* depende de cómo se parta el trabajo, no solo de cuánto se hace.**
    1.4 es una feature completa —spec, dos módulos de API, pantalla y tests— y le dio a Rocío
    **cuatro commits**. 1.6 es de tamaño parecido y le dio a Renzo **16**, porque commiteó por
    grupo de tareas. El trabajo fue comparable; el número no.
  - Jeremías se llevó **cuatro ítems** del hito 1 (1.1, 1.2, 1.5 y el RF-15) más el hito 0 y los
    arreglos sueltos, contra uno por cabeza del resto. Eso es reparto, no ritmo.

> `git shortlog` muestra a Jeremías con dos nombres (`JereDev` y `Jeremias Fernandez`), pero los
> dos commits salen del mismo email, y GitHub arma *Contributors* por email. Cuenta como una
> sola persona; no hay nada que corregir.

---

## 7. Qué falta, por quién lo destraba

### Lo que quedó abierto

1. ~~**Archivar `implementar-reservas-notificaciones`.**~~ **Resuelto el 30/09**: sus deltas
   pasaron a `openspec/specs/reservas`.
1. ~~**1.4 entró sin un solo test de navegador.**~~ **Resuelto el 30/09**: `mis-reservas.spec.ts`
   suma cinco casos y la suite pasa de 20 a **25**, y con los tres de `/reservar` a **28**. El
   hueco que quedaba —la lista **con** reservas, las pestañas con contenido y la cancelación— se
   cerró el 01/10: Rocío sumó cuatro casos más, que crean las reservas con `POST /reservas` y
   prueban solo la pantalla, y la suite llega a **32**.

### Cada quien con su ítem

2. ~~**Adrián — 1.3.**~~ **Resuelto el 05/10**: entró con el #42 el 01/10, con las 31 tareas
   cerradas, y el cambio se archivó en un PR aparte, que también remidió este documento sobre
   `main`. El archivado agregó el requisito "Pantalla de reserva" y **modificó RN-09**, que hasta
   entonces contradecía al código por omisión: no decía que el sábado cierra con
   `HORA_CIERRE_SABADO` ni que `DIAS_CERRADOS` cierra el domingo. Los dos escenarios que lo fijan
   ("Sábado después del cierre propio" y "Día cerrado") ya están en `openspec/specs/reservas`.

   Las dos cosas que se habían marcado para revisar a mano, porque el CI no puede verlas,
   **quedaron verificadas el 01/10 y las dos están bien**:
   - El conteo de reservas activas (RN-07) corre **adentro de `$transaction` y después del lock**.
     El orden en `enLaTransaccion()` es `tomarLocks` → RN-07 → stock → turno libre → `insertar`, y
     el conteo usa el cliente de la transacción, no el global. Contarlo antes habría dejado el
     `SELECT … FOR UPDATE` sin efecto, y **ninguna suite de este repo podría haberlo detectado**:
     los e2e corren con `maxWorkers: 1` y Playwright con `workers: 1`, así que nunca hay dos
     solicitudes a la vez. Se verifica leyendo el orden de los `await`, no corriendo tests.
   - La rama mergeó `main` y no la rama de 1.4, así que no se repitió el enredo del 28/09.
3. ~~**Renzo — 1.6.**~~ **Resuelto el 04/10**: la propuesta entró con el #47, aprobada por
   Jeremías y Rocío, con las cinco observaciones de Rocío incorporadas antes de implementar; la
   implementación entró con el #48, aprobada por Rocío, y el cambio se archivó en el PR siguiente,
   que también remidió este documento sobre `main`. Lo que deja fijado está en la decisión 34 de
   [`memoria-proyecto.md`](memoria-proyecto.md).
4. ~~**Rocío — el ruleset.**~~ **Resuelto el 30/09**: `e2e` es el cuarto check obligatorio.

### Para todos, en cada feature

5. `/opsx:propose`, revisión de los cuatro, `/opsx:apply`.
6. Al abrir el PR, **base `main` siempre**, incluso si la rama se apila sobre otra feature.
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
gh pr list --state merged --limit 200 --json number,author --jq '.[].author.login' | sort | uniq -c | sort -rn
```

```bash
grep -cE "^    (get|post|put|patch|delete):" contratos/openapi.yaml
```

```bash
gh api repos/rociobazan/club-deportivo-deploy/rules/branches/main
```

Para lo demás alcanza con mirar: `apps/api/src` (módulos de la API), `apps/web/app` (pantallas)
y `openspec/changes` (propuestas en curso).
