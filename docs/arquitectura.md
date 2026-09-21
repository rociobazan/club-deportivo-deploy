# Arquitectura y flujo de trabajo

Complemento de `requisitos.md` y `openapi.yaml`. Base para el README del repositorio.

**Stack:** Nest.js (API) + Next.js (front) + PostgreSQL + Prisma + Resend
**Repositorio:** monorepo único, según pide la consigna (una sola URL de entrega)

---

## 1. Estructura del repositorio

```
club-reservas/
├── apps/
│   ├── api/                    # Nest.js
│   │   ├── src/
│   │   │   ├── auth/           # RF-00: JWT, guards, decorador @Roles
│   │   │   ├── catalogo/       # RF-01, RF-02, RF-07, RF-12, RF-13
│   │   │   ├── disponibilidad/ # RF-03
│   │   │   ├── reservas/       # RF-04, RF-05, RF-06
│   │   │   ├── notificaciones/ # RF-08, RF-14 (Resend)
│   │   │   ├── administracion/ # RF-11 (panel del club)
│   │   │   └── comun/          # filtro de excepciones, DTOs base
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   └── test/               # e2e con Supertest
│   └── web/                    # Next.js (App Router)
│       ├── app/
│       │   ├── (institucional)/   # RF-09: landing, el club, contacto
│       │   ├── (app)/             # disponibilidad, reservar, mis reservas
│       │   └── (admin)/           # panel, reservas, canchas y equipamiento
│       ├── components/
│       ├── styles/globals.css     # tokens del prototipo de Claude Design
│       └── lib/api/            # cliente GENERADO desde openapi.yaml
├── contratos/
│   └── openapi.yaml            # fuente de verdad del contrato
├── docs/
│   ├── claude-design/          # prototipo de Claude Design (referencia visual)
│   ├── memoria-proyecto.md     # memoria compartida del equipo y de los agentes
│   ├── requisitos.md
│   ├── arquitectura.md
│   └── identidad.md
├── .github/workflows/ci.yml
├── docker-compose.yml          # PostgreSQL 17 local (puerto 5434)
└── package.json                # workspaces
```

El `openapi.yaml` vive fuera de `apps/`. No es un artefacto del backend: es el contrato que ambas aplicaciones respetan. Ubicarlo dentro de `apps/api` sugiere que pertenece al servidor, que es exactamente la idea contraria al enfoque API-First.

---

## 2. Flujo de autenticación entre los dos servicios

Esta es la decisión de arquitectura más importante del proyecto.

**La autenticación vive en Nest.** Next no emite ni valida tokens: los guarda y los reenvía.

```
  Next.js                          Nest.js                    PostgreSQL
     │                                │                            │
     │  POST /auth/login              │                            │
     │───────────────────────────────►│  verifica bcrypt           │
     │                                │───────────────────────────►│
     │  { accessToken, usuario }      │                            │
     │◄───────────────────────────────│                            │
     │                                │                            │
     │  guarda el token en cookie     │                            │
     │  httpOnly                      │                            │
     │                                │                            │
     │  POST /reservas                │                            │
     │  Authorization: Bearer <jwt>   │  JwtAuthGuard              │
     │───────────────────────────────►│  RolesGuard                │
     │                                │  usuarioId = payload.sub   │
     │  201 Created                   │───────────────────────────►│
     │◄───────────────────────────────│                            │
```

**Por qué no Auth.js en Next.** Es la opción natural para un Next standalone, pero acá el entregable evaluado es el contrato de la API. Si el login vive en el front, los endpoints de Nest quedan sin descripción de seguridad en el `openapi.yaml` y la API no puede defenderse por sí sola. Un `curl` directo contra el backend saltearía toda la autenticación. Con el JWT emitido y validado en Nest, el contrato describe el sistema completo.

**El token va en cookie `httpOnly`, no en `localStorage`.** Una cookie `httpOnly` no es accesible desde JavaScript, así que un XSS no puede robar la sesión. Route Handlers de Next leen la cookie y agregan el header `Authorization` al llamar a la API.

**CORS.** Nest habilita solo el origen del front (`FRONTEND_URL`), con `credentials: true`. Nada de `origin: '*'`.

---

## 3. El cliente tipado se genera, no se escribe

Este es el punto donde el enfoque API-First deja de ser una declaración de intenciones y pasa a ser verificable.

```bash
npx openapi-typescript contratos/openapi.yaml -o apps/web/lib/api/schema.d.ts
```

Next importa esos tipos y los usa en cada llamada. La consecuencia: **si alguien cambia un endpoint en Nest sin actualizar el contrato, el build del front se rompe.** El contrato deja de ser documentación que se desactualiza y pasa a ser código que se compila.

### La trampa de `@nestjs/swagger`

Nest puede generar un OpenAPI a partir de los decoradores del código. Eso es **code-first**, exactamente lo contrario de lo que pide la consigna.

Se usa igual, pero al revés: el spec generado no se publica, se **compara**. Un job de CI levanta la app, exporta su OpenAPI y lo confronta contra `contratos/openapi.yaml`. Si difieren, falla el build. Se llama contract drift check y demuestra que la implementación no se despegó de la especificación.

```
contratos/openapi.yaml  ──►  fuente de verdad
        │                          ▲
        │ genera tipos             │ se compara contra
        ▼                          │
   apps/web                   spec generado por Nest
```

---

## 4. Manejo de errores

Un `ExceptionFilter` global en Nest traduce todo al formato único de `Error` definido en el contrato. Sin él, Nest devuelve su propio formato (`{ statusCode, message, error }`) y la API no cumple lo que promete.

Traducciones obligatorias:

| Origen | Resultado |
|---|---|
| Prisma `P2002` (violación de unicidad) sobre el índice del slot | 409 `SLOT_NO_DISPONIBLE` |
| Prisma `P2002` sobre el mail | 409 `EMAIL_YA_REGISTRADO` |
| Prisma `P2025` (registro no encontrado) | 404 `NO_ENCONTRADO` |
| `ForbiddenException` sobre reserva ajena | 404, no 403 (RN-13) |
| Fallo de `class-validator` | 400 `SOLICITUD_INVALIDA` |

---

## 5. Entornos y variables

```env
# apps/api/.env
# Apunta al contenedor de docker-compose.yml (npm run db:up)
DATABASE_URL=postgresql://club:club@localhost:5434/club_reservas
JWT_SECRET=
JWT_EXPIRES_IN=1h
RESEND_API_KEY=
MAIL_FROM=reservas@club.test
FRONTEND_URL=http://localhost:3001
CANCELACION_MINUTOS_MINIMOS=120
HORIZONTE_RESERVA_DIAS=30
MAX_RESERVAS_ACTIVAS_SOCIO=3
HORA_APERTURA=08:00
HORA_CIERRE=23:00
PREFIJO_CODIGO_RESERVA=RES
ZONA_HORARIA_CLUB=America/Argentina/Cordoba

# apps/web/.env.local
API_URL=http://localhost:3000/api/v1
```

Se versiona un `.env.example` con las claves vacías, salvo `DATABASE_URL`, que es la misma en todas las máquinas y no es secreta. El `.env` real va en `.gitignore`. Una clave de Resend commiteada por accidente es un problema real, no una formalidad.

---

## 6. Integración continua

`.github/workflows/ci.yml` corre en cada PR hacia `main` y en cada push a `main`. Ese archivo es la fuente de verdad; acá va el resumen.

| Job (check) | Qué hace |
|---|---|
| `specs` | `npm ci`, `npm run spec:validate` (`openspec validate --all --strict`) y `npm run contrato:lint` (Redocly) |
| `api` | Espera a `specs`. Con un service container `postgres:17`: `prisma migrate deploy` sobre una base vacía, y lint, build, `test` y `test:e2e` de la API |

- Node sale de `.nvmrc` (`node-version-file`), y OpenSpec y Redocly son devDependencies de la raíz: el CI usa las mismas versiones que las máquinas del equipo.
- `specs` va primero. Si la especificación no valida, no tiene sentido gastar minutos corriendo tests contra un contrato roto.
- La base de datos de CI es un **service container**, no un mock. `migrate deploy` confirma que las migraciones, incluido el índice único parcial de RN-01, se aplican desde cero, y los tests que usen la base van a correr contra PostgreSQL real, que es la única forma de verificar que ese índice hace lo que dice.
- Las variables de entorno de cada feature (`JWT_SECRET`, `RESEND_API_KEY`, etc.) se suman al job `api` en el PR que las introduce.
- **A futuro**, cuando existan sus scripts: un job `web` (`generate:api-types`, lint y build de Next) y un job `drift` que compare el contrato con el OpenAPI que exporta Nest. Al sumarlos, hay que agregarlos también como checks obligatorios (sección 7).

---

## 7. Bloqueo del merge (esto no está en el YAML)

El workflow por sí solo no bloquea nada. Pinta la ejecución de rojo y el botón de merge sigue disponible. **El bloqueo se configura a mano en GitHub** y es un requisito explícito de la consigna:

Solo puede hacerlo alguien con permisos de admin sobre el repo (hoy, `rociobazan`). En `Settings → Branches → Add branch protection rule`, sobre `main`:

- Require a pull request before merging → **1 approval mínimo**
- Require status checks to pass before merging → seleccionar `specs` y `api`
- Require branches to be up to date before merging
- Do not allow bypassing the above settings (incluye a los administradores)

Sin ese último punto, el dueño del repo puede saltearse todo y la protección es decorativa.

Lo mismo por API, con `gh` autenticado como admin:

```bash
gh api -X PUT repos/rociobazan/club-deportivo-deploy/branches/main/protection --input - <<'EOF'
{
  "required_status_checks": { "strict": true, "checks": [{ "context": "specs" }, { "context": "api" }] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null
}
EOF
```

**Sacar captura de esta pantalla** y sumarla al README. Es la evidencia de que el bloqueo existe, algo que el historial de PRs por sí solo no demuestra. Sin permisos de admin, sirve también la captura de un PR donde se vean `specs` y `api` como *Required* y el merge bloqueado.

---

## 8. Convenciones de Git

**Ramas:** `feature/spec-<nombre>` para especificaciones y funcionalidades, `fix/<nombre>` para correcciones, `chore/<nombre>` para configuración.

**Commits:** formato convencional, en español.

```
feat(reservas): validar stock de equipamiento por slot
fix(auth): devolver 401 genérico ante credenciales inválidas
test(disponibilidad): cubrir slots pasados del día actual
docs(contrato): documentar tarifa por cantidad de jugadores
```

**Cada integrante commitea desde su propia cuenta.** La consigna evalúa la distribución del trabajo en el historial. Si uno sube todo "porque es más rápido", el repositorio muestra un solo autor y ese punto se pierde entero.

**Plantilla de PR** en `.github/pull_request_template.md`:

```markdown
## Qué resuelve
Cierra #<issue>. Implementa RF-XX.

## Reglas de negocio cubiertas
- [ ] RN-XX
- [ ] RN-YY

## Checklist
- [ ] El contrato en `contratos/openapi.yaml` está actualizado
- [ ] Hay tests para cada criterio de aceptación del RF
- [ ] Los cuatro jobs de CI están en verde
- [ ] No se commitearon secretos ni archivos `.env`
```

---

## 9. Orden de trabajo sugerido

| Etapa | Qué se hace | Quién |
|---|---|---|
| 1 | Contrato base, `schema.prisma`, seed, docker-compose, esqueleto del monorepo | Los cuatro, un solo PR aprobado por todos |
| 2 | `ci.yml` + branch protection | Un integrante, antes de abrir ramas en paralelo |
| 3 | RF-00 autenticación | A (camino crítico) |
| 4 | RF-01 a RF-08 en ramas paralelas | B, C, D |
| 5 | RF-11 a RF-14, administración y reenvío, cuando autenticación y catálogo estén mergeados | A asignar |
| 6 | RF-09 sitio institucional + RF-10 contacto, con el prototipo de Claude Design | A y B |
| 7 | README con arquitectura, instrucciones y capturas | Compartido |

La etapa 2 va antes que las features a propósito. Si el CI se configura al final, los PRs anteriores se mergean sin validación y el historial de ejecuciones verdes queda vacío justo donde se lo va a mirar.
