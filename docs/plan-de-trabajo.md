## Cómo usar esta guía

Este documento lleva al equipo desde una máquina sin nada instalado hasta la entrega del trabajo práctico.

Está escrito para seguirse sin conocimientos previos. Cada comando va acompañado de una explicación de qué hace y de qué tiene que ocurrir si se ejecutó correctamente. Los términos técnicos se definen en el glosario.

Cada paso indica **quién** lo ejecuta. Donde dice "los cuatro", es literal: todos, cada uno en su máquina.

Las fases 0 a 4 son secuenciales y cada una depende de la anterior. Recién en la fase 5 el equipo trabaja en paralelo.

### Qué cambió respecto de la versión anterior

Esta versión corrige el plan anterior, que asumía que "OpenSpec" era la especificación OpenAPI. Es una herramienta distinta y concreta, y eso modifica cuatro cosas:

| Fase | Corrección |
|---|---|
| 1 | Node pasa a requerir **20.19.0 o superior**. Se suma la instalación del CLI de OpenSpec y de un asistente de IA para programar. |
| 2 | La estructura del repositorio incorpora la carpeta `openspec/`. |
| 3 | Se agrega `openspec init` y la escritura de las especificaciones. El job de CI que valida las specs cambia de Redocly a `openspec validate`. |
| 5 | El ciclo de cada funcionalidad pasa a ser el flujo de OpenSpec: proponer, aplicar, archivar. |

El documento de requisitos que ya escribieron **no se descarta**: es el insumo directo de las especificaciones, porque el formato de escenarios de OpenSpec es prácticamente el mismo DADO/CUANDO/ENTONCES que ya usaron.

---

## Glosario

Si alguno de estos términos no te resulta familiar, leelo ahora. Vuelven todo el tiempo.

### Control de versiones

| Término | Qué es |
|---|---|
| **Repositorio (repo)** | La carpeta del proyecto versionada con Git. Vive en GitHub y cada uno tiene una copia local. |
| **Rama (branch)** | Una línea de trabajo paralela. Trabajás en tu rama sin romperle nada a los demás. |
| **`main`** | La rama principal. Lo que está ahí se considera funcionando. |
| **Commit** | Una foto de tus cambios con un mensaje que explica qué hiciste. |
| **Push / Pull** | Subir tus commits a GitHub / bajar los de los demás. |
| **Pull Request (PR)** | Un pedido de "quiero meter mi rama en `main`". Se revisa y se aprueba antes de entrar. |
| **Branch protection** | La configuración de GitHub que impide meter cosas en `main` sin PR aprobado y sin pruebas en verde. |

### Estructura del proyecto

| Término | Qué es |
|---|---|
| **Monorepo** | Un solo repositorio que contiene varios proyectos. Acá, el backend y el frontend. |
| **Workspace** | La función de npm que permite que varios proyectos convivan en un repo y compartan dependencias. |
| **API** | El backend. Recibe pedidos por HTTP y devuelve datos en JSON. No tiene pantallas. |
| **Endpoint** | Una dirección concreta de la API. Por ejemplo `GET /canchas`. |

### Base de datos

| Término | Qué es |
|---|---|
| **ORM / Prisma** | Traduce entre las tablas de la base y los objetos de JavaScript, para no escribir SQL a mano. |
| **Migración** | Un archivo que describe un cambio en la estructura de la base. Se versiona igual que el código. |
| **Seed** | Un script que carga datos de prueba en la base vacía. |

### OpenSpec

| Término | Qué es |
|---|---|
| **OpenSpec** | La herramienta de desarrollo guiado por especificaciones que pide la consigna. Guarda las especificaciones en Markdown dentro del repositorio. |
| **Spec** | La descripción permanente de cómo se comporta una parte del sistema. Vive en `openspec/specs/`. |
| **Change (cambio)** | Una propuesta de modificación en curso. Vive en `openspec/changes/`. Cuando se completa, se archiva y sus cambios se incorporan a las specs. |
| **Requirement / Scenario** | El formato de una spec: un requisito con uno o más escenarios en formato `WHEN` / `THEN`. |
| **OpenAPI** | El estándar para describir el contrato de la API: rutas, parámetros y esquemas de datos. Es distinto de OpenSpec y en este proyecto conviven. |
| **CI (Integración Continua)** | Un robot de GitHub que valida y prueba automáticamente cada Pull Request. |
| **Workflow** | El archivo que le dice al robot qué hacer. |

---

## Cómo encaja OpenSpec con la consigna

Antes de instalar nada, conviene entender el modelo mental, porque OpenSpec no se parece a las herramientas que usaron hasta ahora.

### Tiene dos mitades

**La mitad de la terminal.** Comandos que empiezan con `openspec`: instalar, inicializar, listar, validar, archivar. Se escriben en la consola como cualquier otro comando.

**La mitad del chat.** Comandos que empiezan con `/opsx:`: proponer un cambio, aplicarlo, archivarlo. **No se escriben en la terminal.** Se escriben en el chat de un asistente de IA para programar, en la misma caja donde le pedirías que escriba código.

Esto último es la consecuencia práctica más importante: el flujo de OpenSpec está pensado para conducirse desde una herramienta como Claude Code o Cursor. Cada integrante necesita una configurada.

### Cómo organiza los archivos

```
openspec/
├── config.yaml     configuración del proyecto y contexto para la IA
├── specs/          las especificaciones vigentes del sistema
└── changes/        las propuestas de cambio en curso
    └── archive/    las propuestas ya completadas
```

La separación es el corazón de la herramienta. `specs/` describe cómo funciona el sistema **hoy**. `changes/` contiene propuestas de cómo va a funcionar. Cuando una propuesta se termina y se archiva, sus cambios se incorporan a `specs/` y la propuesta se guarda en `archive/` como registro histórico.

### El ciclo de trabajo

```
/opsx:explore    pensar el problema antes de comprometerse (opcional)
/opsx:propose    la IA redacta proposal.md, specs/, design.md y tasks.md
   ↓             ustedes revisan y corrigen lo que redactó
/opsx:apply      se implementa siguiendo la lista de tareas
/opsx:archive    la propuesta se archiva y las specs se actualizan
```

El paso de revisión no es opcional aunque no tenga comando propio. La IA redacta un borrador; el equipo decide si eso es lo que quiere construir. Ahí está el valor de la herramienta.

### Los dos artefactos que pide la consigna

La consigna pide especificaciones de OpenSpec **y** esquemas de datos y endpoints. Son dos cosas y las dos entran:

| Artefacto | Dónde vive | Qué dice |
|---|---|---|
| Specs de OpenSpec | `openspec/specs/` | Qué tiene que pasar, en lenguaje de requisitos y escenarios |
| Contrato OpenAPI | `contratos/openapi.yaml`, referenciado desde el `design.md` de cada cambio | Con qué forma: rutas, parámetros y esquemas de datos |

El `openapi.yaml` que ya tienen no se descarta. OpenSpec espera las decisiones técnicas en el archivo `design.md` de cada cambio, y ahí es donde el contrato encuentra su lugar.

### El formato de una spec

Este es el formato exacto. Los encabezados en inglés son estructurales y **no se traducen**; el contenido va en castellano.

```markdown
## ADDED Requirements

### Requirement: Consulta de disponibilidad
El sistema DEBE devolver los turnos libres de cada cancha para una fecha
dada, calculados como los turnos del horario de atención menos los
ocupados por reservas activas.

#### Scenario: Día sin reservas
- **WHEN** se consulta la disponibilidad de una cancha de tenis para un
  día sin reservas
- **THEN** se devuelven 15 turnos, de 08:00 a 23:00

#### Scenario: Turno ocupado
- **WHEN** existe una reserva CONFIRMADA a las 19:00
- **THEN** el turno de las 19:00 no aparece entre los disponibles
```

Comparen eso con un criterio del documento de requisitos:

> DADO un día sin reservas, CUANDO se consulta la disponibilidad de una cancha de tenis, ENTONCES se devuelven 15 slots.

Es la misma información con otra puntuación. La conversión es casi mecánica.

**La regla que rompe la validación:** cada requisito necesita al menos un bloque `#### Scenario:`. Un requisito sin escenarios hace fallar `openspec validate` y bloquea el archivado.

---

# FASE 0 — Decisiones que hay que cerrar primero

**Quién:** los cuatro, juntos.
**Tiempo:** 40 minutos.
**Por qué primero:** cada decisión afecta archivos que se escriben en las fases siguientes.

## Paso 0.1 — Confirmar el modelo de precios

Ya está decidido que **el precio no depende de la cantidad de jugadores**: un single de tenis con dos personas vale lo mismo que un dobles con cuatro.

Eso simplifica el modelo: desaparece la tabla `tarifa` y el precio vuelve a ser un campo `precio_por_turno` dentro de `cancha`. El schema de la fase 3 ya está escrito así.

**Queda una decisión abierta:** ¿el sistema igual registra cuántos van a jugar? Puede servirle al club para saber cuánta gente espera, aunque no afecte el monto. En el schema de la fase 3 está como campo opcional. Si deciden que no, se borra esa línea.

## Paso 0.2 — Cerrar el nombre del club

Aparece en el header, en el asunto de los mails, en el favicon y en el prefijo del código de reserva. Cambiarlo después toca muchos archivos.

## Paso 0.3 — Repartir los roles

Completen esta tabla. Se usa en todas las fases siguientes.

| Rol | Quién |
|---|---|
| Dueño del repositorio | |
| Integrante 1 — autenticación y permisos | |
| Integrante 2 — catálogo y disponibilidad | |
| Integrante 3 — creación de reservas | |
| Integrante 4 — consulta, cancelación y notificaciones | |

## Paso 0.4 — Elegir el asistente de IA

OpenSpec funciona dentro de un asistente de IA para programar. **Conviene que los cuatro usen el mismo**, porque `openspec init` genera archivos específicos para cada herramienta y unificar evita confusión.

Opciones compatibles: Claude Code, Cursor, GitHub Copilot, Codex, Gemini CLI, entre otras.

## Paso 0.5 — Preguntarle a la profesora

Aunque ya confirmaron que es OpenSpec la herramienta, conviene dejar dos cosas por escrito:

- Si además del `openspec/` esperan el contrato OpenAPI como entregable separado.
- Si el repositorio va público o privado con ella invitada como colaboradora.

## Paso 0.6 — Acordar la logística

- Un día y hora fijos por semana para juntarse, aunque sea media hora por videollamada.
- Un grupo de mensajería solo para el TP.
- La fecha de entrega, escrita en algún lado visible.

---

# FASE 1 — Preparar la máquina

**Quién:** los cuatro, cada uno en la suya, por separado.
**Tiempo:** entre 45 y 90 minutos la primera vez.

## Paso 1.1 — Instalar Node.js

Node es el programa que ejecuta JavaScript fuera del navegador. Nest, Next y OpenSpec lo necesitan.

**OpenSpec requiere la versión 20.19.0 o superior.** No alcanza con "una versión 20 cualquiera".

Descargar la versión **LTS** desde nodejs.org. LTS significa soporte a largo plazo: es la estable.

Verificar:

```bash
node --version
npm --version
```

Tiene que imprimir `v20.19.0` o superior. Si dice "command not found", no quedó instalado o hay que cerrar y volver a abrir la terminal.

**Los cuatro tienen que tener la misma versión mayor de Node.** Si uno usa otra, van a aparecer errores que solo le pasan a esa persona y son difíciles de rastrear.

## Paso 1.2 — Instalar Git

Git es lo que versiona el código. Descargar de git-scm.com. En Windows, dejar las opciones por defecto durante la instalación.

```bash
git --version
```

## Paso 1.3 — Configurar la identidad de Git

Esto es lo que hace que tus commits figuren como tuyos. **Si esto está mal, tu trabajo aparece a nombre de otro y perdés la nota de distribución equitativa.**

```bash
git config --global user.name "Tu Nombre Completo"
git config --global user.email "el-mismo-mail-de-tu-cuenta-github@ejemplo.com"
```

El mail tiene que ser exactamente el de tu cuenta de GitHub. Verificar:

```bash
git config --global user.name
git config --global user.email
```

## Paso 1.4 — Crear la cuenta de GitHub

Si no tenés, crearla en github.com. Usá un nombre de usuario presentable: va a quedar en el historial del TP.

## Paso 1.5 — Instalar Docker Desktop

Docker permite levantar una base de datos PostgreSQL sin instalar PostgreSQL. Es un programa que corre servicios aislados, llamados contenedores.

Descargar de docker.com. Después de instalar, **abrir la aplicación** y dejarla corriendo.

```bash
docker --version
docker ps
```

`docker ps` lista los contenedores activos. Si la lista sale vacía pero sin error, está bien. Si dice que no puede conectarse, Docker Desktop no está abierto.

## Paso 1.6 — Instalar VS Code

Editor de código. Descargar de code.visualstudio.com.

Extensiones recomendadas, desde el ícono de cuadrados del panel izquierdo:

- **Prisma** — colorea el archivo del schema de la base.
- **ESLint** — marca errores de código mientras escribís.
- **OpenAPI (Swagger) Editor** — valida el contrato mientras lo editás.

## Paso 1.7 — Instalar el asistente de IA

El que hayan elegido en el paso 0.4. Si es Claude Code, se instala y se autentica siguiendo su documentación. Es la herramienta desde donde van a ejecutar los comandos `/opsx:`.

## Paso 1.8 — Instalar el CLI de OpenSpec

```bash
npm install -g @fission-ai/openspec@latest
```

El `-g` significa global: se instala una vez por máquina, no por proyecto.

Verificar:

```bash
openspec --version
```

Si imprime un número de versión, quedó en el PATH.

**Advertencia si usás nvm:** una instalación global de npm pertenece a una instalación de Node. Si cambiás de versión de Node con nvm, el comando `openspec` no viaja con vos y hay que instalarlo de nuevo bajo la versión nueva.

## Paso 1.9 — Checklist de la fase

Antes de seguir, cada uno tiene que poder ejecutar sin error:

```bash
node --version      # v20.19.0 o superior
git --version
docker ps
openspec --version
```

Y tener `git config --global user.email` apuntando a su cuenta de GitHub, más el asistente de IA instalado y funcionando.

---

# FASE 2 — Crear el repositorio y la estructura base

**Quién:** el **dueño del repo** hace los pasos 2.1 a 2.7. Los otros tres esperan y arrancan en 2.8.
**Tiempo:** 1 hora.

## Paso 2.1 — Crear el repositorio en GitHub

*(Dueño del repo)*

En GitHub, botón **New repository**:

- Nombre: el del club, en minúsculas y con guiones. Por ejemplo `club-reservas`.
- Visibilidad: **Public**. Si va privado, hay que invitar a la docente como colaboradora.
- **No** tildar "Add a README file". El repo tiene que arrancar vacío.

## Paso 2.2 — Invitar a los demás

*(Dueño del repo)*

`Settings` → `Collaborators` → `Add people`. Los otros tres integrantes y, si el repo es privado, la docente.

## Paso 2.3 — Clonar el repositorio

*(Dueño del repo)*

```bash
git clone https://github.com/TU-USUARIO/club-reservas.git
cd club-reservas
```

La primera vez, Git pide usuario y contraseña. **La contraseña de GitHub no funciona**: hay que usar un token. Se genera en `Settings` → `Developer settings` → `Personal access tokens` → `Tokens (classic)` → `Generate new token`, con el permiso `repo` tildado. Copialo y guardalo, porque no se vuelve a mostrar.

## Paso 2.4 — Crear la estructura del monorepo

*(Dueño del repo)*

```bash
npm init -y
mkdir -p apps contratos docs .github/workflows
```

Abrí el `package.json` que se creó y reemplazá su contenido por:

```json
{
  "name": "club-reservas",
  "private": true,
  "workspaces": ["apps/*"]
}
```

`private: true` evita publicar esto por accidente en npm. `workspaces` le dice a npm que `apps/api` y `apps/web` son proyectos que comparten dependencias.

### Copiar los materiales iniciales

En este punto, descomprimí `materiales-iniciales.zip` dentro de `club-reservas/`.
Trae el contrato de la API, los documentos de requisitos, arquitectura e
identidad, y el `.gitignore`. Son los únicos archivos que no tiene sentido
escribir a mano: todo el resto lo vas creando con esta guía.

Copiá también este plan de trabajo a `docs/`, para que quede versionado con el
proyecto.

### Archivos auxiliares

Creá `.nvmrc` en la raíz, para que los cuatro usen la misma versión de Node:

```
20.19.0
```

Y `.editorconfig`, para que nadie mezcle tabulaciones con espacios:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

### Atajos de npm

Opcional pero cómodo. Agregá esta sección al `package.json` de la raíz, para no
tener que recordar los comandos largos:

```json
"scripts": {
  "dev:api": "npm run start:dev --workspace api",
  "dev:web": "npm run dev --workspace web",
  "db:up": "docker compose up -d",
  "db:down": "docker compose down",
  "db:migrate": "npx prisma migrate dev --schema apps/api/prisma/schema.prisma",
  "db:seed": "npx prisma db seed --schema apps/api/prisma/schema.prisma",
  "db:studio": "npx prisma studio --schema apps/api/prisma/schema.prisma",
  "spec:validate": "openspec validate --all --strict",
  "spec:view": "openspec view",
  "contrato:lint": "npx @redocly/cli lint contratos/openapi.yaml",
  "test:api": "npm run test --workspace api"
}
```

La estructura final va a quedar así:

```
club-reservas/
├── apps/
│   ├── api/                # Nest.js
│   └── web/                # Next.js
├── openspec/               # specs y changes (lo crea openspec init)
├── contratos/
│   └── openapi.yaml        # contrato de la API
├── docs/                   # requisitos, arquitectura, identidad
├── .github/workflows/
│   └── ci.yml
├── docker-compose.yml
└── package.json
```

## Paso 2.5 — Crear el backend con Nest

*(Dueño del repo)*

```bash
npm install -g @nestjs/cli
cd apps
nest new api --package-manager npm --skip-git
cd ..
```

`--skip-git` es importante: sin eso, Nest crea un repositorio Git dentro de otro y se arma un lío.

Verificar que arranca:

```bash
npm run start:dev --workspace api
```

En `http://localhost:3000` tiene que decir "Hello World!". Cortalo con `Ctrl+C`.

## Paso 2.6 — Crear el frontend con Next

*(Dueño del repo)*

```bash
cd apps
npx create-next-app@latest web
cd ..
```

Respuestas a las preguntas:

| Pregunta | Respuesta |
|---|---|
| TypeScript | **Yes** |
| ESLint | **Yes** |
| Tailwind CSS | **Yes** |
| `src/` directory | **No** |
| App Router | **Yes** |
| Turbopack | **Yes** |
| Import alias | **No** |

Next también usa el puerto 3000 y va a chocar con Nest. Abrí `apps/web/package.json` y cambiá el script `dev`:

```json
"dev": "next dev -p 3001"
```

Verificar:

```bash
npm run dev --workspace web
```

En `http://localhost:3001` tiene que aparecer la página de bienvenida de Next.

## Paso 2.7 — Primer commit y push

*(Dueño del repo)*

```bash
git add .
git commit -m "chore: estructura inicial del monorepo con Nest y Next"
git push origin main
```

Refrescá GitHub. Tienen que estar los archivos.

## Paso 2.8 — Los otros tres clonan

*(Integrantes que no son el dueño del repo)*

```bash
git clone https://github.com/EL-USUARIO-DEL-DUENIO/club-reservas.git
cd club-reservas
npm install
```

`npm install` descarga las dependencias. Tarda unos minutos la primera vez. La carpeta `node_modules` que aparece **no se sube al repo**: ya está excluida por el `.gitignore`.

---

# FASE 3 — OpenSpec, base de datos e integración continua

Esta es la fase más densa y la que más se presta a confusión sobre quién hace qué. Se divide en dos partes.

**Parte A** es una sesión conjunta: los cuatro en una videollamada, uno compartiendo pantalla y escribiendo, los otros tres siguiendo en sus máquinas. Se hace junta porque establece la base que los cuatro van a usar después, y porque hacerla en paralelo sobre una rama `main` todavía sin proteger genera conflictos.

**Parte B** son tareas individuales, asignadas, que se hacen después.

---

## PARTE A — Sesión conjunta

**Quién:** los cuatro. Escribe el dueño del repo, los demás siguen y opinan.
**Tiempo:** 2 a 3 horas.

### Paso 3.1 — Verificar que la documentación esté en su lugar

La documentación ya se copió en el paso 2.4. Confirmá que estos archivos existen
antes de seguir, porque el paso 3.3 los usa como insumo:

```
docs/requisitos.md
docs/arquitectura.md
docs/identidad.md
docs/plan-de-trabajo.md
contratos/openapi.yaml
```

Y que el contrato valida:

```bash
npx @redocly/cli lint contratos/openapi.yaml
```

### Paso 3.2 — Inicializar OpenSpec

Desde la raíz del repositorio:

```bash
openspec init
```

Va a preguntar qué herramientas de IA usan. Elijan la que definieron en el paso 0.4.

La salida esperada es algo así:

```
OpenSpec Setup Complete

Created: Claude Code
6 skills and 6 commands in .claude/
Config: openspec/config.yaml (schema: spec-driven)
```

**Reinicien el editor** para que los comandos `/opsx:` aparezcan.

Qué creó:

- La carpeta `openspec/` con `config.yaml`, `specs/` y `changes/`.
- Los archivos de flujo de trabajo dentro de la carpeta de su herramienta de IA, por ejemplo `.claude/`.

**Todo eso se commitea**, igual que el resto del código fuente. No va al `.gitignore`.

**Los otros tres integrantes también corren `openspec init`** en su copia local después del primer push, o simplemente bajan los archivos con `git pull`. Como la configuración ya queda versionada, alcanza con el pull si eligieron la misma herramienta.

### Paso 3.3 — Escribir la spec base del sistema

Acá es donde el documento de requisitos se convierte en especificaciones.

Con la sesión compartida abierta, en el chat del asistente de IA:

```
/opsx:propose especificacion-base-reservas
```

Y como descripción, algo así:

> Especificación base del sistema de reservas de un club deportivo. Tomá los requisitos funcionales RF-00 a RF-10 y las reglas de negocio RN-01 a RN-14 del archivo docs/requisitos.md y convertilos en specs de OpenSpec. Agrupá los requisitos en capacidades: autenticacion, catalogo, disponibilidad, reservas, notificaciones e institucional. El contrato de la API está en contratos/openapi.yaml y debe quedar referenciado desde el design.md.

La IA va a redactar cuatro artefactos dentro de `openspec/changes/especificacion-base-reservas/`:

| Artefacto | Qué contiene |
|---|---|
| `proposal.md` | Por qué se hace este cambio y qué abarca |
| `specs/` | Los requisitos con sus escenarios, agrupados por capacidad |
| `design.md` | Las decisiones técnicas: stack, modelo de datos, y la referencia al contrato OpenAPI |
| `tasks.md` | La lista de tareas de implementación |

**Ahora viene el paso que no se puede saltear: revisarlo entre los cuatro.** La IA redacta un borrador a partir de sus documentos; ustedes deciden si eso es lo que quieren construir. Lean los escenarios uno por uno. Este es literalmente el trabajo que la consigna evalúa.

Para ver en qué estado va:

```bash
openspec status --change especificacion-base-reservas
```

Imprime un checklist de los cuatro artefactos: `[x]` hecho, `[ ]` listo para escribir, `[-]` bloqueado hasta que exista otro.

### Paso 3.4 — Validar las especificaciones

```bash
openspec validate --all --strict
```

`--strict` trata las advertencias como errores. Devuelve 0 si todo pasa y 1 si algo falla, que es exactamente lo que necesita el CI.

El error más común es un requisito sin escenarios:

```
✗ [ERROR] reservas/spec.md: ADDED "Cancelación" must include at least one scenario
```

Se arregla agregando un bloque `#### Scenario:` al requisito.

Para ver el panorama completo:

```bash
openspec view
```

### Paso 3.5 — Levantar PostgreSQL con Docker

Creá `docker-compose.yml` en la raíz:

```yaml
services:
  db:
    image: postgres:16
    container_name: club-db
    environment:
      POSTGRES_USER: club
      POSTGRES_PASSWORD: club
      POSTGRES_DB: club_reservas
    ports:
      - "5432:5432"
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  db-data:
```

Levantarlo:

```bash
docker compose up -d
docker ps
```

`-d` significa que corre en segundo plano. `docker ps` tiene que mostrar el contenedor `club-db`. El `volume` hace que los datos sobrevivan aunque apagues el contenedor.

Para apagarlo cuando no lo uses: `docker compose down`.

**Los cuatro hacen esto en su máquina**, cada uno con su propia base local.

### Paso 3.6 — Configurar Prisma

```bash
cd apps/api
npm install prisma --save-dev
npm install @prisma/client
npx prisma init
cd ../..
```

Editá `apps/api/.env`:

```env
DATABASE_URL="postgresql://club:club@localhost:5432/club_reservas"
JWT_SECRET="un-secreto-largo-solo-para-desarrollo"
JWT_EXPIRES_IN="1h"
CANCELACION_MINUTOS_MINIMOS=120
HORIZONTE_RESERVA_DIAS=30
MAX_RESERVAS_ACTIVAS_SOCIO=3
HORA_APERTURA="08:00"
HORA_CIERRE="23:00"
FRONTEND_URL="http://localhost:3001"
RESEND_API_KEY=""
MAIL_FROM="reservas@club.test"
```

**Creá también `apps/api/.env.example`** con las mismas claves pero sin valores. Ese sí se sube al repo; el `.env` real no. Verificá que `.env` esté en el `.gitignore`. Una clave de Resend commiteada por accidente es un problema real, no una formalidad.

### Paso 3.7 — Escribir el schema de la base

En `apps/api/prisma/schema.prisma`. Este es el modelo con precio plano, según la decisión del paso 0.1:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Rol {
  ADMIN
  SOCIO
}

enum EstadoReserva {
  CONFIRMADA
  CANCELADA
  COMPLETADA
}

enum TipoNotificacion {
  CONFIRMACION
  CANCELACION
}

enum EstadoNotificacion {
  ENVIADA
  FALLIDA
}

model Usuario {
  id           Int       @id @default(autoincrement())
  nombre       String    @db.VarChar(60)
  apellido     String    @db.VarChar(60)
  email        String    @unique @db.VarChar(120)
  passwordHash String    @map("password_hash") @db.VarChar(120)
  telefono     String?   @db.VarChar(30)
  rol          Rol       @default(SOCIO)
  activo       Boolean   @default(true)
  creadoEn     DateTime  @default(now()) @map("creado_en")

  reservas      Reserva[] @relation("ReservasDelUsuario")
  cancelaciones Reserva[] @relation("CanceladasPor")

  @@map("usuario")
}

model Disciplina {
  id               Int     @id @default(autoincrement())
  nombre           String  @unique @db.VarChar(50)
  duracionTurnoMin Int     @map("duracion_turno_min")
  activa           Boolean @default(true)

  canchas      Cancha[]
  equipamiento Equipamiento[]

  @@map("disciplina")
}

model Cancha {
  id             Int     @id @default(autoincrement())
  disciplinaId   Int     @map("disciplina_id")
  nombre         String  @db.VarChar(50)
  superficie     String? @db.VarChar(30)
  techada        Boolean @default(false)
  precioPorTurno Decimal @map("precio_por_turno") @db.Decimal(10, 2)
  activa         Boolean @default(true)

  disciplina Disciplina @relation(fields: [disciplinaId], references: [id])
  reservas   Reserva[]

  @@map("cancha")
}

model Equipamiento {
  id             Int     @id @default(autoincrement())
  disciplinaId   Int     @map("disciplina_id")
  nombre         String  @db.VarChar(60)
  stockTotal     Int     @map("stock_total")
  precioPorTurno Decimal @map("precio_por_turno") @db.Decimal(10, 2)

  disciplina Disciplina            @relation(fields: [disciplinaId], references: [id])
  reservas   ReservaEquipamiento[]

  @@map("equipamiento")
}

model Reserva {
  id                Int           @id @default(autoincrement())
  codigo            String        @unique @db.VarChar(12)
  usuarioId         Int           @map("usuario_id")
  canchaId          Int           @map("cancha_id")
  fecha             DateTime      @db.Date
  horaInicio        String        @map("hora_inicio") @db.VarChar(5)
  horaFin           String        @map("hora_fin") @db.VarChar(5)
  cantidadJugadores Int?          @map("cantidad_jugadores")
  estado            EstadoReserva @default(CONFIRMADA)
  montoCancha       Decimal       @map("monto_cancha") @db.Decimal(10, 2)
  montoEquipamiento Decimal       @default(0) @map("monto_equipamiento") @db.Decimal(10, 2)
  montoTotal        Decimal       @map("monto_total") @db.Decimal(10, 2)
  creadaEn          DateTime      @default(now()) @map("creada_en")
  canceladaEn       DateTime?     @map("cancelada_en")
  canceladaPorId    Int?          @map("cancelada_por")
  motivoCancelacion String?       @map("motivo_cancelacion") @db.VarChar(200)

  usuario      Usuario               @relation("ReservasDelUsuario", fields: [usuarioId], references: [id])
  canceladaPor Usuario?              @relation("CanceladasPor", fields: [canceladaPorId], references: [id])
  cancha       Cancha                @relation(fields: [canchaId], references: [id])
  equipamiento ReservaEquipamiento[]
  notificaciones Notificacion[]

  @@index([canchaId, fecha, horaInicio])
  @@index([usuarioId, estado])
  @@index([fecha])
  @@map("reserva")
}

model ReservaEquipamiento {
  id             Int     @id @default(autoincrement())
  reservaId      Int     @map("reserva_id")
  equipamientoId Int     @map("equipamiento_id")
  cantidad       Int
  precioUnitario Decimal @map("precio_unitario") @db.Decimal(10, 2)

  reserva      Reserva      @relation(fields: [reservaId], references: [id], onDelete: Cascade)
  equipamiento Equipamiento @relation(fields: [equipamientoId], references: [id])

  @@unique([reservaId, equipamientoId])
  @@map("reserva_equipamiento")
}

model Notificacion {
  id           Int                @id @default(autoincrement())
  reservaId    Int                @map("reserva_id")
  tipo         TipoNotificacion
  destinatario String             @db.VarChar(120)
  estado       EstadoNotificacion
  proveedorId  String?            @map("proveedor_id") @db.VarChar(80)
  error        String?
  enviadaEn    DateTime           @default(now()) @map("enviada_en")

  reserva Reserva @relation(fields: [reservaId], references: [id], onDelete: Cascade)

  @@map("notificacion")
}
```

**Dos decisiones del schema que conviene entender:**

`horaInicio` se guarda como texto de 5 caracteres, `"19:00"`, y no como tipo hora. Los turnos son bloques discretos y tratarlos como texto evita toda la complejidad de zonas horarias, que en un sistema de turnos de un club no aporta nada.

`cantidadJugadores` es opcional. Es el campo que quedó pendiente en el paso 0.1. Si deciden no registrarlo, se borra la línea.

Crear la primera migración:

```bash
cd apps/api
npx prisma migrate dev --name init
```

Verificar:

```bash
npx prisma studio
```

Abre una interfaz web en `http://localhost:5555` donde se ven las tablas creadas, vacías.

### Paso 3.8 — La migración del índice único parcial

**Este es el paso más delicado de toda la fase y no se puede saltear.**

La regla "una cancha no puede tener dos reservas en el mismo horario" tiene que estar en la base de datos, no solo en el código. Si está solo en el código, dos personas que reservan al mismo tiempo pasan las dos la validación y se genera la doble reserva.

Prisma no sabe expresar este tipo de índice, así que va escrito a mano:

```bash
npx prisma migrate dev --create-only --name slot_unico_activo
```

`--create-only` crea el archivo de migración pero **no** lo aplica. Abrí el archivo generado en `prisma/migrations/xxxxx_slot_unico_activo/migration.sql` y escribí adentro:

```sql
CREATE UNIQUE INDEX "ux_reserva_slot_activo"
  ON "reserva" ("cancha_id", "fecha", "hora_inicio")
  WHERE "estado" <> 'CANCELADA';
```

La cláusula `WHERE` es lo que hace que una reserva cancelada libere el horario. Sin ella, un turno cancelado quedaría bloqueado para siempre.

Aplicarla:

```bash
npx prisma migrate dev
```

### Paso 3.9 — Cargar datos de prueba

Sin datos no hay nada que probar. Creá `apps/api/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const tenis = await prisma.disciplina.create({
    data: { nombre: 'Tenis', duracionTurnoMin: 60 },
  });
  const padel = await prisma.disciplina.create({
    data: { nombre: 'Pádel', duracionTurnoMin: 90 },
  });
  const futbol = await prisma.disciplina.create({
    data: { nombre: 'Fútbol 5', duracionTurnoMin: 60 },
  });

  await prisma.cancha.createMany({
    data: [
      { disciplinaId: tenis.id, nombre: 'Tenis 1', superficie: 'polvo de ladrillo', techada: false, precioPorTurno: 12000 },
      { disciplinaId: tenis.id, nombre: 'Tenis 2', superficie: 'cemento', techada: false, precioPorTurno: 10000 },
      { disciplinaId: padel.id, nombre: 'Pádel 1', superficie: 'sintético', techada: true, precioPorTurno: 18000 },
      { disciplinaId: padel.id, nombre: 'Pádel 2', superficie: 'sintético', techada: true, precioPorTurno: 18000 },
      { disciplinaId: futbol.id, nombre: 'Fútbol 1', superficie: 'césped sintético', techada: false, precioPorTurno: 25000 },
    ],
  });

  await prisma.equipamiento.createMany({
    data: [
      { disciplinaId: padel.id, nombre: 'Paleta de pádel', stockTotal: 6, precioPorTurno: 2500 },
      { disciplinaId: tenis.id, nombre: 'Raqueta de tenis', stockTotal: 4, precioPorTurno: 2500 },
      { disciplinaId: futbol.id, nombre: 'Juego de pecheras', stockTotal: 2, precioPorTurno: 1500 },
    ],
  });

  const hash = await bcrypt.hash('clave1234', 10);

  await prisma.usuario.createMany({
    data: [
      { nombre: 'Ana', apellido: 'Admin', email: 'admin@club.test', passwordHash: hash, rol: 'ADMIN' },
      { nombre: 'Bruno', apellido: 'Socio', email: 'socio@club.test', passwordHash: hash, rol: 'SOCIO' },
    ],
  });

  console.log('Datos de prueba cargados.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

Instalar lo que falta y registrar el script:

```bash
npm install bcrypt
npm install -D @types/bcrypt ts-node
```

En `apps/api/package.json`:

```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

Ejecutar:

```bash
npx prisma db seed
```

Volvé a abrir `npx prisma studio` y verificá que los datos están.

### Paso 3.10 — Commit conjunto

```bash
cd club-reservas
git add .
git commit -m "chore: openspec, especificacion base y modelo de datos"
git push origin main
```

Fin de la parte A. Los otros tres hacen `git pull origin main` y siguen con sus tareas individuales.

---

## PARTE B — Tareas individuales

Se hacen después de la sesión conjunta, en el orden que indica la columna. **El orden importa**: el CI tiene que correr al menos una vez antes de poder configurar la protección de rama, porque los checks no aparecen en el buscador de GitHub hasta que existieron.

| Orden | Quién | Tarea | Paso |
|---|---|---|---|
| 1º | Integrante 4 | Escribir y subir el workflow de CI | 3.11 |
| 2º | Dueño del repo | Activar y probar la protección de `main` | 3.12 y 3.13 |
| 3º | Integrante 2 | Revisar el contrato OpenAPI y sacar lo que quedó de tarifas | 3.14 |
| 4º | Integrante 3 | Escribir el esqueleto del README | 3.15 |
| 5º | Integrante 1 | Verificar que los cuatro entornos levantan igual | 3.16 |

### Paso 3.11 — El workflow de CI

*(Integrante 4)*

Creá `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:

  specs:
    name: Validar especificaciones OpenSpec
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Validar specs y changes
        run: npx -y @fission-ai/openspec@latest validate --all --strict

  contrato:
    name: Validar contrato OpenAPI
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx @redocly/cli lint contratos/openapi.yaml

  api:
    name: Tests de la API
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: club
          POSTGRES_PASSWORD: club
          POSTGRES_DB: club_reservas_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://club:club@localhost:5432/club_reservas_test
      JWT_SECRET: secreto-de-test
      CANCELACION_MINUTOS_MINIMOS: 120
      HORIZONTE_RESERVA_DIAS: 30
      MAX_RESERVAS_ACTIVAS_SOCIO: 3
      HORA_APERTURA: "08:00"
      HORA_CIERRE: "23:00"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
      - run: npm run test --workspace api

  web:
    name: Build del front
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint --workspace web
      - run: npm run build --workspace web
```

El job `specs` es el que la consigna pide explícitamente como "validación / linter de los archivos de OpenSpec". El job `contrato` cubre los esquemas de datos y endpoints.

La base de datos de CI es un **service container**, no un simulacro. Los tests corren contra PostgreSQL real, que es la única forma de verificar que el índice único parcial del paso 3.8 hace lo que dice.

Subilo:

```bash
git add .github/workflows/ci.yml
git commit -m "chore: workflow de integracion continua"
git push origin main
```

Andá a la pestaña **Actions** del repo. Tiene que aparecer la ejecución. Esperá a que termine y verificá que los cuatro jobs están en verde. Si alguno falla, hacé clic para ver el error y corregilo antes de avisar que terminaste.

### Paso 3.12 — Activar la protección de `main`

*(Dueño del repo, después de que el CI corrió al menos una vez)*

**Este paso no está en ningún archivo. Se hace a mano en GitHub y es un requisito explícito de la consigna.** El workflow por sí solo pinta el check de rojo; sin esta configuración, el botón de merge sigue disponible.

`Settings` → `Branches` → `Add branch protection rule`:

- **Branch name pattern:** `main`
- Tildar **Require a pull request before merging**
  - **Require approvals:** 1
- Tildar **Require status checks to pass before merging**
  - Tildar **Require branches to be up to date before merging**
  - En el buscador, agregar los cuatro checks: `specs`, `contrato`, `api`, `web`
- Tildar **Do not allow bypassing the above settings**
  - Sin esto, el dueño del repo puede saltearse todo y la protección es decorativa.
- **Create**

**Sacá una captura de pantalla de esta configuración.** Va en el README como evidencia. El historial de PRs no demuestra por sí solo que la protección existía.

### Paso 3.13 — Probar que la protección funciona

*(Dueño del repo)*

Comprobación de dos minutos que evita una sorpresa el día de la entrega:

```bash
git checkout -b prueba/proteccion
echo "prueba" >> README.md
git add . && git commit -m "test: verificar proteccion de rama"
git push origin prueba/proteccion
```

Abrí el PR en GitHub. El botón de merge tiene que estar **deshabilitado** hasta que alguien apruebe y los cuatro checks pasen. Si podés mergear solo, algo del paso 3.12 quedó sin tildar.

Cerrá el PR sin mergear y borrá la rama.

### Paso 3.14 — Revisar el contrato OpenAPI

*(Integrante 2)*

El contrato todavía tiene restos del modelo de precios por cantidad de jugadores, que quedó descartado. Hay que:

- Eliminar el schema `Tarifa` y el array `tarifas` del schema `Cancha`.
- Devolver `precioPorTurno` a `Cancha` y a `DisponibilidadCancha`.
- Decidir qué pasa con `cantidadJugadores` en `CrearReservaRequest` según el paso 0.1: si se registra, queda como opcional; si no, se elimina.
- Eliminar la regla RN-12 de las descripciones que la mencionan.

Verificar:

```bash
npx @redocly/cli lint contratos/openapi.yaml
```

Va por rama y PR, porque `main` ya está protegida.

### Paso 3.14 bis — Plantilla de Pull Request

*(Integrante 2, en la misma rama del contrato)*

Creá `.github/pull_request_template.md`. Hace que cada PR salga con la misma
estructura sin que nadie tenga que acordarse, y eso se nota en la revisión:

```markdown
## Qué resuelve

Cierra #<numero-de-issue>. Implementa RF-XX.

Cambio de OpenSpec asociado: `openspec/changes/<nombre-del-cambio>/`

## Reglas de negocio cubiertas

- [ ] RN-XX —
- [ ] RN-YY —

## Cómo lo probé

<!-- Qué escenarios corriste y qué devolvieron -->

## Checklist

- [ ] Las specs del cambio están escritas y `openspec validate --all --strict` pasa
- [ ] El contrato en `contratos/openapi.yaml` refleja los endpoints que toqué
- [ ] Cada escenario WHEN/THEN de la spec tiene su test
- [ ] Los cuatro jobs de CI están en verde
- [ ] No commiteé archivos `.env` ni claves de ningún servicio
- [ ] Los commits salen a nombre de mi cuenta de GitHub

## Para quien revisa

<!-- Dónde mirar primero, qué decisión te gustaría que te discutan -->
```

### Paso 3.15 — Esqueleto del README

*(Integrante 3)*

Crear el `README.md` con los títulos vacíos, para que después se complete de a pedazos en lugar de escribirlo entero la noche anterior:

```markdown
# Club [nombre] — Sistema de Reservas

## Qué es
## Arquitectura
## Requisitos previos
## Cómo levantarlo
## Flujo de trabajo con OpenSpec
## Flujo de trabajo con Git
## Integración continua
## Equipo
```

### Paso 3.16 — Verificar que los cuatro entornos levantan igual

*(Integrante 1)*

Que cada uno confirme, en su máquina, que todo esto funciona:

```bash
docker compose up -d
npm install
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npx prisma db seed --schema apps/api/prisma/schema.prisma
npm run start:dev --workspace api
npm run dev --workspace web
openspec validate --all --strict
```

Si a alguno le falla algo, se resuelve ahora. Un entorno roto descubierto en medio de una funcionalidad cuesta el triple.

---

# FASE 4 — Ensayo del flujo de trabajo

**Quién:** los cuatro, cada uno el suyo.
**Tiempo:** 20 minutos.
**Por qué:** es mejor equivocarse con el flujo de Git en un cambio trivial que en medio de una funcionalidad.

Cada integrante hace este ciclo completo, con un cambio mínimo: agregar su nombre a la sección "Equipo" del README.

```bash
# 1. Traer lo último de main
git checkout main
git pull origin main

# 2. Crear tu rama
git checkout -b chore/agregar-nombre-TUNOMBRE

# 3. Editar el README y guardarlo

# 4. Ver qué cambió
git status
git diff

# 5. Preparar y confirmar
git add README.md
git commit -m "chore: agregar TUNOMBRE al equipo"

# 6. Subir la rama
git push origin chore/agregar-nombre-TUNOMBRE
```

Después, en GitHub: **Compare & pull request** → título y descripción → **Create pull request** → pedirle a un compañero que lo revise y apruebe → **Merge**.

Cuando termina, todos vuelven a `main` y bajan los cambios:

```bash
git checkout main
git pull origin main
```

**Al terminar la fase**, el README tiene los cuatro nombres, hay cuatro PR cerrados y cada uno pasó por ser autor y revisor al menos una vez.

---

# FASE 5 — Desarrollo de las funcionalidades

**Cuándo:** el grueso del trabajo.
**Orden:** la autenticación va primera porque todo lo demás la necesita. Las otras tres van en paralelo.

## El ciclo que se repite en cada funcionalidad

Este es el patrón completo, con OpenSpec integrado. Se repite igual para las cuatro.

### 1. Actualizar `main` y crear la rama

```bash
git checkout main
git pull origin main
git checkout -b feature/spec-nombre-de-la-feature
```

### 2. Proponer el cambio

En el chat del asistente de IA:

```
/opsx:propose implementar-nombre-de-la-feature
```

Describí qué querés construir y señalá los requisitos correspondientes de `docs/requisitos.md` y las rutas correspondientes de `contratos/openapi.yaml`.

La IA redacta `proposal.md`, las specs, el `design.md` y `tasks.md` dentro de `openspec/changes/implementar-nombre-de-la-feature/`.

### 3. Revisar lo que redactó

Léelo. Corregí lo que no sea lo que querías. Este paso es el trabajo, no un trámite.

```bash
openspec status --change implementar-nombre-de-la-feature
openspec show implementar-nombre-de-la-feature
openspec validate implementar-nombre-de-la-feature --strict
```

### 4. Implementar

```
/opsx:apply
```

Trabaja sobre la lista de tareas y va marcándolas a medida que las completa. No es automático de punta a punta: revisá cada paso.

### 5. Verificar contra las pruebas

Cada criterio de aceptación de tu requisito, y cada escenario `WHEN`/`THEN` de tu spec, tiene que tener un test:

```bash
npm run test --workspace api
```

### 6. Commits chicos y frecuentes

No un commit gigante al final. Uno por paso lógico:

```
feat(reservas): validar que el turno esté libre
test(reservas): cubrir el caso de turno ocupado
fix(reservas): traducir el error P2002 a 409
docs(specs): agregar escenario de stock insuficiente
```

### 7. Abrir el PR

```bash
git push origin feature/spec-nombre-de-la-feature
```

En GitHub, crear el PR describiendo qué requisito implementa y qué reglas cubre. Esperar a que los cuatro checks pasen y pedir la revisión al compañero que corresponde.

### 8. Revisar el PR de otro

Revisar no es apretar "Approve". Es leer el código y las specs, correr la rama en tu máquina si hay dudas, y dejar al menos un comentario. La consigna evalúa las revisiones.

### 9. Archivar el cambio, después del merge

**Este paso se hace después de que el PR se mergeó, no antes.**

```bash
git checkout main
git pull origin main
openspec archive implementar-nombre-de-la-feature -y
```

Archivar mueve la propuesta a `openspec/changes/archive/` con la fecha adelante, e incorpora sus cambios a `openspec/specs/`. Eso deja las specs vigentes actualizadas.

**Coordinación importante:** archivar escribe en `openspec/specs/`. Si dos personas archivan al mismo tiempo, hay conflicto. **Archiven de a uno**, avisando por el grupo. El resultado del archivado se sube por su propio PR chico.

## Paso 5.1 — Autenticación

*(Integrante 1)* · Rama: `feature/spec-autenticacion` · Revisa: Integrante 2

- Registro con contraseña hasheada con bcrypt, login que devuelve un JWT, endpoint de perfil.
- Un guard que rechaza pedidos sin token válido.
- Un decorador de roles que restringe endpoints según `ADMIN` o `SOCIO`.
- Pantallas de registro y login en Next, guardando el token en una cookie `httpOnly`.

**Bloquea a los demás.** Mientras esto no esté, los integrantes 3 y 4 trabajan con un token simulado en sus tests.

## Paso 5.2 — Catálogo y disponibilidad

*(Integrante 2)* · Rama: `feature/spec-disponibilidad` · Revisa: Integrante 3

- Endpoints de disciplinas, canchas y equipamiento.
- El cálculo de disponibilidad: generar los turnos del día según la duración de la disciplina y restar los ocupados.
- Pantalla de disponibilidad en Next.

El cálculo es la parte con más lógica. Ojo con dos casos: el día de hoy no debe mostrar turnos que ya pasaron, y una reserva cancelada debe volver a aparecer como disponible.

## Paso 5.3 — Creación de reservas

*(Integrante 3)* · Rama: `feature/spec-creacion-reserva` · Revisa: Integrante 4

- Todas las validaciones: turno libre, fecha no pasada, dentro del mes, límite de reservas activas, stock de equipamiento en ese turno.
- El cálculo del monto y su congelamiento en la reserva.
- Capturar el error `P2002` de Prisma y devolver `409`.
- Formulario de reserva en Next.

**El test que no puede faltar:** disparar dos reservas del mismo turno en paralelo y verificar que una devuelve 201 y la otra 409.

```typescript
const [a, b] = await Promise.all([
  crearReserva(datos),
  crearReserva(datos),
]);
// exactamente una tiene que ser 201 y la otra 409
```

Es la prueba de que la restricción está en la base y no solo en el código.

## Paso 5.4 — Consulta, cancelación y notificaciones

*(Integrante 4)* · Rama: `feature/spec-reservas-notificaciones` · Revisa: Integrante 1

- Listado y detalle de reservas, filtrando por usuario según el rol.
- Cancelación con el plazo de 2 horas, y sin plazo para el administrador.
- Los mails de confirmación y cancelación con Resend.
- Pantalla de "Mis reservas".

**Dos cosas que se pasan por alto:**

Una reserva ajena devuelve `404`, no `403`. Un `403` le confirmaría a alguien que ese ID existe y permitiría enumerar reservas de otros.

El mail se manda **después** de que la reserva quedó guardada, nunca dentro de la misma operación. Si Resend está caído, la reserva tiene que guardarse igual y la respuesta seguir siendo `201`. En los tests, el cliente de mail va simulado: no se hacen llamadas reales.

**Sobre Resend:** al crear la cuenta arranca en modo de prueba y solo deja mandar mails a direcciones verificadas. Verifiquen las casillas de los cuatro. Si en la demostración el mail no llega, casi seguro es por esto y no por un error del código.

---

# FASE 6 — Landing e identidad

**Quién:** integrantes 1 y 2, cuando terminan su parte.
**Rama:** `feature/landing-institucional`

- Definir los tokens de color y tipografía en `apps/web/app/globals.css`, según `docs/identidad.md`.
- Armar las secciones: presentación, quiénes somos, disciplinas, instalaciones, cómo reservar y contacto.
- El endpoint `POST /contacto` en Nest, con límite de solicitudes por IP.

La landing tiene que verse completa aunque el backend esté apagado. Probalo: apagá la API y recargá la página.

**El endpoint de contacto es público y dispara mails.** Sin límite de solicitudes es un imán de spam. `@nestjs/throttler` lo resuelve con un decorador.

---

# FASE 7 — Cierre y entrega

## Paso 7.1 — Archivar todo lo que quede pendiente

*(Los cuatro, de a uno)*

```bash
openspec list
```

Lista los cambios activos. No debería quedar ninguno sin archivar. Para ver el panorama:

```bash
openspec view
```

Las specs vigentes en `openspec/specs/` tienen que describir el sistema tal como quedó.

## Paso 7.2 — Escribir el README

*(Compartido, sobre el esqueleto del paso 3.15)*

Es un entregable explícito de la consigna. Tiene que tener:

- Qué es el proyecto y qué dominio eligieron.
- Cómo está organizado el repositorio y por qué.
- **Instrucciones de ejecución que funcionen desde cero.** Alguien que clona el repo tiene que poder levantarlo siguiendo solo el README.
- Cómo usaron OpenSpec: dónde viven las specs, cómo se propone un cambio, cómo se archiva.
- El flujo de trabajo de Git que usaron.
- La captura de la configuración de protección de rama.
- Los cuatro integrantes con sus usuarios de GitHub.

## Paso 7.3 — Probar las instrucciones en frío

*(Un integrante que no escribió el README)*

Clonar el repo en una carpeta nueva y seguir el README al pie de la letra, sin usar nada de lo que ya tiene configurado. Casi siempre falta un paso.

## Paso 7.4 — Revisión final contra la consigna

*(Los cuatro)*

Punto por punto, con la consigna al lado:

| Requisito de la consigna | Cómo se verifica |
|---|---|
| Especificaciones de OpenSpec completas y válidas | `openspec validate --all --strict` sin errores |
| Esquemas de datos y endpoints | `contratos/openapi.yaml` valida y cubre disponibilidad, creación, consulta y cancelación |
| Repositorio con README | Existe y las instrucciones funcionan desde cero |
| Historial de commits equitativo | `Insights` → `Contributors`: los cuatro con actividad |
| Rama `main` protegida | Captura en el README |
| Una rama por funcionalidad | Los nombres de las ramas en los PR cerrados |
| PR con al menos una revisión aprobada | Cada PR tiene aprobación de otro integrante |
| Workflow en `.github/workflows/ci.yml` | Existe |
| Validación de OpenSpec en CI | El job `specs` |
| Pruebas ejecutándose en CI | El job `api` |
| Merge bloqueado si algo falla | La configuración de protección |
| Historial de ejecuciones verdes | Pestaña `Actions` |

## Paso 7.5 — Entregar

*(Dueño del repo)*

La URL del repositorio. Si es privado, confirmar que la docente aceptó la invitación de colaboradora.

---

# Errores frecuentes

| Síntoma | Causa habitual |
|---|---|
| `openspec: command not found` después de cambiar de versión de Node | La instalación global pertenece a una instalación de Node. Reinstalar bajo la versión nueva |
| Los comandos `/opsx:` no aparecen en el asistente | Falta reiniciar el editor después de `openspec init` |
| `must include at least one scenario` | Un requisito quedó sin bloque `#### Scenario:` |
| Conflicto en `openspec/specs/` | Dos personas archivaron al mismo tiempo. Archivar de a uno |
| "Cannot connect to the Docker daemon" | Docker Desktop no está abierto |
| "Port 3000 is already in use" | Nest y Next peleando por el puerto, o quedó un proceso viejo |
| "Can't reach database server" | El contenedor no está levantado: `docker compose up -d` |
| Los commits aparecen a nombre de otro | El `user.email` de Git no coincide con el de GitHub |
| El CI falla solo en GitHub y en local anda | Falta una variable de entorno en el bloque `env` del workflow |
| Los checks no aparecen en branch protection | El workflow todavía no corrió ninguna vez |
| "Your branch is behind main" | Falta `git pull origin main` antes de crear la rama |

---

# Resumen del orden

```
FASE 0  Decisiones                    → los 4, 40 min
FASE 1  Preparar máquinas             → cada uno, 1 a 1.5 h
FASE 2  Repo y estructura             → dueño del repo, 1 h
FASE 3A OpenSpec, specs y base        → los 4 juntos, 2 a 3 h
FASE 3B CI, protección y ajustes      → tareas individuales, en orden
FASE 4  Ensayo del flujo de Git       → los 4, 20 min
FASE 5  Funcionalidades               → en paralelo, el grueso
FASE 6  Landing                       → integrantes 1 y 2
FASE 7  Cierre y entrega              → los 4
```

Las fases 0 a 4 son secuenciales: cada una necesita la anterior. Recién en la 5 se trabaja en paralelo.

La tentación es saltar directo a programar. El costo de hacerlo es rehacer la base de datos, o descubrir el día de la entrega que la protección de rama nunca estuvo activa y que el historial de ejecuciones verdes está vacío.
