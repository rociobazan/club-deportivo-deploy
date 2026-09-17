## Context

Motivación y alcance en `proposal.md`. Lo que condiciona el enfoque:

- **Consigna** (`docs/Consigna TP — Sistema de Reservas con OpenSpec y CI-CD.md`): MVP con specs válidas que cubran disponibilidad, creación, consulta y cancelación; `main` protegida con una rama y un PR aprobado por cambio; `.github/workflows/ci.yml` que valide OpenSpec, corra tests y bloquee el merge; README con arquitectura e instrucciones.
- **Repo**: `apps/api` es un Nest 12 recién generado (TypeScript 6.0, `module: nodenext`, Jest 30, `ts-node` 10.9.2 ya instalado). `apps/web` es **Next.js 16.3.4** con React 19.2 y Tailwind 4, sin páginas. No existen `apps/api/prisma/` ni `apps/api/.env.example`. El `package.json` raíz define `db:up`/`db:down` con Docker y `db:migrate`, `db:seed` y `db:studio` con `npx prisma ... --schema apps/api/prisma/schema.prisma`.
- **Base de datos**: el equipo decidió levantar PostgreSQL con Docker (2026-09-16), como el plan, pero con `postgres:17`. Todavía no existe `docker-compose.yml`. En esta máquina están Docker 29.4 y Compose 5.1, y además corren PostgreSQL 17 (puerto 5432) y 18 (puerto 5433) como servicios de Windows, así que esos dos puertos están ocupados.
- **Fuentes**: `contratos/openapi.yaml` (v2.1.0) define la forma de la API con precio plano. `docs/plan-de-trabajo.md` (pasos 3.6 a 3.9) trae el `schema.prisma` y el `seed.ts` para ese modelo. `docs/requisitos.md` sigue describiendo tarifas por cantidad de jugadores.
- **Diseño visual**: el prototipo `docs/claude-design/Deploy Club.dc.html` define el nombre (**Deploy**), las pantallas por rol (visitante, socio y admin), el contenido institucional y los datos de ejemplo. Su sistema visual (fondo `#060807`, acento `#00E58F`, Outfit y DM Sans) reemplaza la paleta y la tipografía de `docs/identidad.md`.
- **Alcance**: el equipo decidió que todas las pantallas del prototipo entran al MVP, incluidas las de administración (panel, canchas, equipamiento) y "Reenviar el mail", que el contrato v2.1.0 no cubre.
- **Herramientas**: `npm view prisma` publica hoy `latest` = `8.0.0-rc.15`; las estables son `7.10.0` y `6.19.3`. `openspec validate --strict` trata como error un requisito sin la palabra `SHALL` o `MUST`.

## Goals / Non-Goals

**Goals:**
- Dejar una base de datos local reproducible en los cuatro equipos y en CI, con la restricción de RN-01 en la base.
- Cerrar ahora las decisiones transversales que las specs presuponen (zona horaria, grilla de turnos, estados, errores, convenciones del front), para que las cuatro ramas de FASE 5 no las resuelvan cada una a su manera.
- Que cada exigencia de la consigna tenga un lugar identificable en specs, contrato o tareas (decisión 2).
- Que el contrato describa todas las pantallas del prototipo antes de implementarlas, fiel al enfoque API-first (decisión 16).

**Non-Goals:**
- Módulos, controladores, guards o pantallas: los implementa FASE 5. Las decisiones marcadas *(FASE 5)* orientan esa implementación, pero no generan tareas acá.
- Cambiar lo que el contrato v2.1.0 ya define: la ampliación a 2.2.0 solo agrega endpoints, parámetros y campos opcionales.
- Escribir `.github/workflows/ci.yml` y el README: son tareas propias del plan (pasos 3.11 y 3.15) que se hacen en su propia rama. Este cambio les deja definidos la imagen de la base y los comandos.

## Decisions

### 1. Precio plano y baja de `jugadores_permitidos`

Se elimina la tabla `tarifa` y también la columna `disciplina.jugadores_permitidos`. `cantidadJugadores` queda como entero opcional ≥ 1, informativo, sin validarse contra la disciplina. El prototipo va en la misma línea: ofrece 2, 3 o 4 jugadores en tenis y pádel, y 8, 10 o 12 en fútbol 5, con la aclaración "No cambia el precio del turno".

- **Por qué**: el contrato no expone `jugadoresPermitidos`, el schema del paso 3.7 ya no la tiene y, sin RN-11, ningún flujo la lee ni la escribe.
- **Alternativa descartada**: conservar la columna y validar `cantidadJugadores` con 422. Obligaba a publicar `jugadoresPermitidos` en el contrato y a restituir una regla que el equipo dio de baja.

### 2. Consigna, contrato y specs

**Dónde se cumple cada exigencia de la consigna:**

| Exigencia de la consigna | Dónde queda |
|---|---|
| Esquemas y endpoints de **disponibilidad** | spec `disponibilidad` + `GET /disponibilidad` (`DisponibilidadResponse`) |
| **Creación** de reservas | spec `reservas`, "Creación de reserva…" y reglas asociadas + `POST /reservas` (`CrearReservaRequest`, `Reserva`) |
| **Consulta** de reservas | spec `reservas`, "Listado…" y "Detalle…" + `GET /reservas`, `GET /reservas/{id}` |
| **Cancelación** de reservas | spec `reservas`, "Cancelación…" y "La cancelación conserva el registro" + `PATCH /reservas/{id}/cancelacion` |
| Specs completas y válidas | `npm run spec:validate` en verde (tarea 6.4) |
| CI con validación de OpenSpec, tests y bloqueo del merge | este cambio deja migraciones aplicables con `prisma migrate deploy` contra `postgres:17`; el workflow y la protección de `main` son los pasos 3.11 y 3.12 |
| Rama propia y PR aprobado | este cambio se integra desde `feature/spec-contrato-base` con la aprobación de los cuatro |

**Capacidades y contrato:**

| Capacidad | Rutas en `contratos/openapi.yaml` | Schemas principales |
|---|---|---|
| `autenticacion` | `/auth/registro`, `/auth/login`, `/auth/perfil` | `RegistroRequest`, `LoginRequest`, `LoginResponse`, `Usuario`, `Error` |
| `catalogo` | `/disciplinas`, `/canchas`, `/canchas/{id}`, `/equipamiento`, `/equipamiento/{id}` | `Disciplina`, `Cancha`, `Equipamiento`, `CrearCanchaRequest`, `ActualizarCanchaRequest`, `CrearEquipamientoRequest`, `ActualizarEquipamientoRequest` |
| `disponibilidad` | `/disponibilidad` | `DisponibilidadResponse`, `DisponibilidadCancha`, `SlotDisponible` |
| `reservas` | `/reservas`, `/reservas/{id}`, `/reservas/{id}/cancelacion` | `CrearReservaRequest`, `CancelarReservaRequest`, `Reserva`, `ItemEquipamientoReserva` |
| `notificaciones` | efecto de `POST /reservas` y `PATCH /reservas/{id}/cancelacion`; `/reservas/{id}/reenvio-mail` | `ReenvioMailResponse` |
| `institucional` | `/contacto` (Inicio, El club y Contacto no leen la API salvo datos que degradan) | `ContactoRequest`, `ContactoResponse` |
| `administracion` | `/admin/panel` | `PanelAdmin`, `OcupacionCancha`, `ProximoTurno` |

Los schemas y rutas nuevos se agregan al contrato en este mismo cambio (decisión 16).

**Catálogo de `Error.tipo`** que usan las specs. Los que no aparecen como ejemplo en el contrato son valores nuevos de un campo `string` libre y no requieren cambiarlo:

| Estado | `tipo` |
|---|---|
| 400 | `SOLICITUD_INVALIDA` |
| 401 | `NO_AUTENTICADO` |
| 403 | `SIN_PERMISOS` |
| 404 | `NO_ENCONTRADO` |
| 409 | `EMAIL_YA_REGISTRADO`, `SLOT_NO_DISPONIBLE`, `STOCK_INSUFICIENTE`, `RESERVA_NO_CANCELABLE`, `REENVIO_NO_DISPONIBLE` |
| 422 | `FECHA_EN_EL_PASADO`, `HORIZONTE_EXCEDIDO`, `HORARIO_FUERA_DE_TURNO`, `LIMITE_RESERVAS_ACTIVAS`, `EQUIPAMIENTO_DE_OTRA_DISCIPLINA`, `PLAZO_CANCELACION_VENCIDO` |
| 429 | `DEMASIADAS_SOLICITUDES` |

El 401 por credenciales inválidas usa el mismo `tipo` y `titulo` exista o no el mail. El formato de errores quedó como requisito de `autenticacion`, que ya cubre las validaciones previas a cada request, en lugar de abrir una séptima capacidad que la propuesta no contempla.

### 3. Modelo de datos: el schema del paso 3.7 con cinco ajustes

Se toma el `schema.prisma` de `docs/plan-de-trabajo.md` §3.7, con estos cambios (los dos últimos, por las funciones de administración):

1. **Se quita `@@index([canchaId, fecha, horaInicio])`** de `Reserva`. El índice único parcial ya cubre las búsquedas de turnos activos por cancha y `ix_reserva_fecha`, el barrido del día. Así quedan exactamente los dos índices de apoyo que nombra la propuesta.
2. **Los índices de apoyo usan los nombres de `requisitos.md`**: `@@index([usuarioId, estado], map: "ix_reserva_usuario_estado")` y `@@index([fecha], map: "ix_reserva_fecha")`.
3. **`horaInicio` y `horaFin` son `VarChar(5)` en formato `HH:MM`**, no `time`, como explica el plan. Los turnos son bloques discretos de hora local (decisión 5) y el texto con cero a la izquierda ordena y compara bien.
4. **`Equipamiento.activo Boolean @default(true)`**, para dar de baja un ítem sin borrarlo: las reservas que lo alquilaron lo siguen referenciando. `cancha.activa` ya existía.
5. **`Notificacion.reenvio Boolean @default(false)`**, para contar los reenvíos de la última hora (RN-16) sin mezclarlos con los envíos automáticos.

`stock_total >= 0` y `precio_por_turno > 0` se validan en la API con 400; Prisma no expresa `CHECK`.

Tablas resultantes: `usuario`, `disciplina` (sin `jugadores_permitidos`), `cancha` (con `precio_por_turno numeric(10,2)`), `equipamiento` (con `activo`), `reserva` (con `cantidad_jugadores` nulable y montos congelados), `reserva_equipamiento` y `notificacion` (con `reenvio`). Los montos se operan como `Decimal` de Prisma, nunca como `number`, y se serializan como número recién en la respuesta *(FASE 5)*.

### 4. RN-01 en una migración manual

Dos migraciones: `init`, generada desde el schema, y `slot_unico_activo`, creada con `prisma migrate dev --create-only` y escrita a mano:

```sql
CREATE UNIQUE INDEX "ux_reserva_slot_activo"
  ON "reserva" ("cancha_id", "fecha", "hora_inicio")
  WHERE "estado" <> 'CANCELADA';
```

*(FASE 5)* El filtro global traduce `P2002` según el target: `ux_reserva_slot_activo` → 409 `SLOT_NO_DISPONIBLE`; `usuario.email` → 409 `EMAIL_YA_REGISTRADO`; `reserva.codigo` → se reintenta con otro código. El `@@unique([reservaId, equipamientoId])` no debería dispararse nunca, porque los ítems repetidos se rechazan antes con 400.

- **Alternativa descartada**: una restricción de exclusión con rangos (`btree_gist`) para impedir solapamientos parciales. Con la grilla fija de la decisión 6, dos reservas solapadas en la misma cancha tienen la misma hora de inicio.

### 5. "Hoy" y "ahora" en la hora local del club

Nueva variable `ZONA_HORARIA_CLUB` (por defecto `America/Argentina/Cordoba`, donde está el club según el prototipo). `fecha` y `hora_inicio` se guardan como fecha y hora locales del club, sin zona. *(FASE 5)* Toda comparación contra el momento actual (RN-02, RN-03, RN-04, RN-07, el filtro de turnos pasados y el estado `COMPLETADA`) pasa por un único reloj inyectable que devuelve fecha y hora en esa zona, para que los tests puedan fijar "son las 14:00" o "faltan exactamente 120 minutos".

- **Por qué**: los runners de CI corren en UTC. Sin zona explícita, "hoy" cambia de día a las 21:00 de Argentina y los tests de fechas fallan de forma intermitente.
- **Alternativa descartada**: fijar `TZ` en el proceso. Depende de cómo se lance cada entorno y no deja fijar la hora en un test.

### 6. Grilla de turnos anclada a la apertura

Los turnos de una cancha son `HORA_APERTURA + k × duración` mientras terminen a más tardar en `HORA_CIERRE`, que es lo mismo que dibuja la grilla del prototipo. Crear una reserva exige que `horaInicio` sea uno de esos inicios (422 `HORARIO_FUERA_DE_TURNO`).

- **Por qué**: con la grilla garantizada, el índice sobre `(cancha, fecha, hora_inicio)` impide todo solapamiento en una cancha y, como cada equipamiento pertenece a una sola disciplina y todas sus canchas comparten duración, contar stock por `(fecha, hora_inicio)` exacto equivale a contar por solapamiento (RN-05).
- **Consecuencia**: cambiar `HORA_APERTURA` corre la grilla. Para el MVP es un parámetro que no cambia en caliente.

### 7. Estados: solo se persisten `CONFIRMADA` y `CANCELADA`

`COMPLETADA` se deriva al leer (`CONFIRMADA` y `fecha + horaFin <= ahora`), sin job programado; en el prototipo aparece como "jugada". *(FASE 5)* Una reserva es *activa* para RN-07 si está `CONFIRMADA` y no terminó. Solo se cancelan reservas activas: la verificación de estado (409 `RESERVA_NO_CANCELABLE`) va antes que la del plazo (422).

### 8. Código de reserva configurable

`PREFIJO_CODIGO_RESERVA` (por defecto `RES`, como el ejemplo del contrato) + `-` + 6 caracteres de `[A-Z0-9]` generados con `crypto.randomInt`. Los códigos `R-8F4K2` del prototipo son datos de muestra y no fijan formato. Como `reserva.codigo` es `VarChar(12)`, el prefijo admite hasta 5 letras mayúsculas; *(FASE 5)* la API valida `^[A-Z]{1,5}$` al arrancar. Ante colisión (`P2002` sobre `codigo`) se reintenta hasta 3 veces.

### 9. Prisma 6.19 con versión exacta

Se instalan `prisma@6.19.3` (dev) y `@prisma/client@6.19.3`, con versión exacta en `apps/api/package.json`.

- **Por qué**: el schema, `url = env("DATABASE_URL")` en el datasource, el generador `prisma-client-js` y la clave `prisma.seed` son la configuración de Prisma 6, y es la que siguen el plan y el CI. Un `npm install prisma` sin versión hoy instala `8.0.0-rc.15`.
- **Alternativa descartada**: Prisma 7.10. Exige `prisma.config.ts` y un driver adapter (`@prisma/adapter-pg`), y no lee `DATABASE_URL` desde el schema. Suma dependencias que la propuesta excluye. Migrar queda como `chore` posterior.

### 10. Los comandos de Prisma corren dentro del workspace `api`

Los scripts `db:migrate`, `db:seed` y `db:studio` del `package.json` raíz pasan a `npm exec --workspace api -- prisma <comando>`.

- **Por qué**: con `--schema apps/api/prisma/schema.prisma` lanzado desde la raíz, Prisma 6 busca `.env` en la raíz y en `apps/api/prisma/`, no en `apps/api/.env`, que es donde lo lee Nest. Además, `prisma db seed` busca la clave `prisma.seed` en el `package.json` del directorio actual. Al ejecutarse en `apps/api` se resuelven los dos.
- **CI no cambia**: el workflow define `DATABASE_URL` como variable de entorno, así que `npx prisma migrate deploy --schema ...` funciona desde la raíz.

### 11. Seed con los datos del prototipo, idempotente por guardia

`seed.ts` carga los datos de `Deploy Club.dc.html`. El único ajuste es "Tubo de pelotas", que en el prototipo sirve para todas las disciplinas: se separa por disciplina para respetar RN-08 sin cambiar schema ni contrato.

| Disciplina | Duración | Canchas: nombre, superficie, techada, precio por turno | Equipamiento: nombre, stock, precio por turno |
|---|---|---|---|
| Tenis | 60 min | Cancha 1, polvo de ladrillo, no, 9000 · Cancha 2, cemento, no, 8000 | Raqueta de tenis, 4, 2500 · Tubo de pelotas de tenis, 5, 3500 |
| Pádel | 90 min | Pádel 1, sintético, sí, 14000 · Pádel 2, sintético, sí, 14000 · Pádel 3, sintético, no, 12000 | Paleta de pádel, 6, 2500 · Tubo de pelotas de pádel, 5, 3500 |
| Fútbol 5 | 60 min | Cancha Sur, césped sintético, no, 20000 | Juego de pecheras, 3, 3000 |

Usuarios: `admin@club.test` (ADMIN) y `socio@club.test` (SOCIO), con `clave1234` hasheada con bcrypt. Si ya existe alguna disciplina, el seed informa que la base tiene datos y termina con código 0 sin tocar nada; para recargar se usa `prisma migrate reset`.

- **Alternativa descartada para "Tubo de pelotas"**: equipamiento sin disciplina con stock común. Obliga a que `disciplinaId` sea opcional en schema y contrato, cambia RN-08 y rompe la decisión 6, porque turnos de 60 y 90 minutos se solapan sin compartir hora de inicio.
- **Alternativa descartada para la idempotencia**: `upsert` por clave natural. `cancha` y `equipamiento` no tienen clave única natural.

### 12. Decisiones para FASE 5 que las specs presuponen

- **Validación**: un `ValidationPipe` global con `whitelist` y `forbidNonWhitelisted`. Los campos que el contrato no declara, como `clienteId` en `POST /reservas` o `rol` en el registro, responden 400.
- **Stock concurrente (RN-05)**: el índice de RN-01 no protege el stock. La transacción de creación bloquea las filas de `equipamiento` pedidas (`SELECT ... FOR UPDATE`, en orden de id) antes de contar lo alquilado en el turno.
- **Mails (RN-14)**: el envío se hace después del commit, con `await` dentro de un `try/catch` y un timeout acotado, y luego se persiste la `notificacion`. En `NODE_ENV=test` el cliente de Resend se reemplaza por un doble. El remitente del prototipo es `turnos@clubdeploy.com.ar`, que se configura en `MAIL_FROM`.
- **Convención de specs**: encabezados estructurales en inglés, contenido en castellano y el verbo normativo como `MUST` / `MUST NOT` literal, porque el validador estricto no reconoce "DEBE".

### 13. PostgreSQL 17 en Docker, publicado en el puerto 5434

Cada integrante levanta la base con el `docker-compose.yml` de la raíz, el mismo para los cuatro:

```yaml
services:
  db:
    image: postgres:17
    container_name: club-db
    environment:
      POSTGRES_USER: club
      POSTGRES_PASSWORD: club
      POSTGRES_DB: club_reservas
    ports:
      - "5434:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U club -d club_reservas"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  db-data:
```

`DATABASE_URL` queda `postgresql://club:club@localhost:5434/club_reservas`, igual en todas las máquinas. En el `package.json` raíz, `db:up` pasa a `docker compose up -d --wait`, que espera a que el healthcheck dé `healthy` antes de devolver el control, y `db:down` sigue como `docker compose down`, que conserva el volumen. Para entrar a la base no hace falta `psql` instalado: `docker compose exec db psql -U club -d club_reservas`. El CI usa un service container `postgres:17`, la misma imagen. `docs/arquitectura.md` conserva `docker-compose.yml` y cambia `postgres:16` por `postgres:17` y el puerto de `DATABASE_URL` por 5434.

- **Por qué Docker**: la misma versión y la misma configuración en las cuatro máquinas con un solo comando, sin instalar PostgreSQL ni pedir la clave de un superusuario. Además, la base local usa la misma imagen que el CI.
- **Por qué 17**: es la misma imagen del service container del CI y tiene soporte establecido en Prisma 6.19. No verificamos Prisma 6.19 contra PostgreSQL 18.
- **Por qué 5434**: en esta máquina, 5432 y 5433 están ocupados por los servidores instalados. Publicar en 5434 evita el choque sin detenerlos, y usar el mismo puerto en las cuatro máquinas deja una sola `DATABASE_URL` en `.env.example`, el README y las tareas.
- **Por qué no hace falta `CREATEDB`**: `prisma migrate dev` crea y borra una base sombra en cada ejecución (sin permiso falla con `P3014`). La imagen oficial crea `POSTGRES_USER` como superusuario, así que `club` ya puede hacerlo.
- **Alternativas descartadas**:
  - PostgreSQL 17 instalado en cada máquina: cada integrante lo instala, crea el rol y la base con la clave de su superusuario, y las versiones pueden divergir sin que nadie lo note hasta el CI.
  - Mapear `5432:5432` como el plan: choca con los servidores instalados.
  - PostgreSQL 18: sin verificar con Prisma 6.19.

### 14. El prototipo como referencia del front: qué endpoint usa cada pantalla

| Pantalla del prototipo | Capacidad | Endpoints | Nota |
|---|---|---|---|
| Inicio, El club | `institucional` | ninguno obligatorio; precios opcionales de `GET /canchas` | contenido estático; los precios degradan (spec) |
| Canchas y precios | `catalogo` | `GET /disciplinas`, `GET /canchas`, `GET /equipamiento` | la duración del turno sale de `/disciplinas` |
| Disponibilidad | `disponibilidad` | `GET /disponibilidad`, `GET /disciplinas` | la API devuelve solo turnos libres; el front arma la grilla de 08 a 23 y marca como "Ocupada" o "Pasado" lo que no vino |
| Reservar (2 pasos) | `reservas` | `GET /equipamiento?fecha&horaInicio`, `POST /reservas` | 409 `SLOT_NO_DISPONIBLE` → "Alguien te ganó de mano"; 422 `LIMITE_RESERVAS_ACTIVAS` → modal de límite |
| Modal "Para reservar hay que ser socio" | `autenticacion` | — | visitante sin sesión |
| Turno confirmado, Mail automático | `reservas`, `notificaciones` | respuesta de `POST /reservas` | — |
| Mis reservas (Activas / Historial) | `reservas` | `GET /reservas?estado=` | "jugada" = `COMPLETADA` |
| Detalle | `reservas`, `notificaciones` | `GET /reservas/{id}`, `PATCH /reservas/{id}/cancelacion`, `POST /reservas/{id}/reenvio-mail` | con 429, el front avisa que se alcanzó el límite de reenvíos |
| Ingresar / Crear cuenta | `autenticacion` | `POST /auth/login`, `POST /auth/registro`, `GET /auth/perfil` | el registro usa dos campos, nombre y apellido, como pide `RegistroRequest`, en vez del campo único del prototipo |
| Contacto | `institucional` | `POST /contacto` | — |
| Admin · panel | `administracion` | `GET /admin/panel` | "Facturación prevista" = suma de `montoTotal` a cobrar en el club |
| Admin · reservas | `reservas` | `GET /reservas` como ADMIN, `PATCH` de cancelación | el nombre sale de `Reserva.cliente`; la búsqueda por socio o código se hace en el front sobre el listado |
| Admin · canchas | `catalogo` | `GET /canchas?incluirInactivas=true`, `POST /canchas`, `PATCH /canchas/{id}` | "Dar de baja" y "Reactivar" = `PATCH` con `activa`; "Fuera de servicio" = `activa: false` |
| Admin · equipamiento | `catalogo` | `GET /equipamiento?incluirInactivos=true`, `POST /equipamiento`, `PATCH /equipamiento/{id}` | los botones − y + mandan el `stockTotal` resultante; el prototipo no dibuja "Nuevo ítem" ni "Dar de baja": el front los agrega con el mismo estilo que en canchas |

### 15. Front en Next.js 16 *(FASE 5 y 6)*

- **Leer primero la documentación incluida**: `apps/web/AGENTS.md` exige consultar `node_modules/next/dist/docs/` antes de escribir código, porque Next 16 cambia convenciones.
- **Sesión**: un Route Handler llama a `POST /auth/login` y guarda el token en una cookie `httpOnly`; en Next 16, `cookies()` es asíncrona (`await cookies()`).
- **Rutas privadas**: la redirección al login de "Reservar" y "Mis reservas" va en `proxy.ts`. La convención `middleware` quedó deprecada y renombrada a `proxy`. La autorización real sigue siendo el 401 de la API.
- **Tipos**: `openapi-typescript` genera `apps/web/lib/api/schema.d.ts` desde el contrato, como indica `docs/arquitectura.md`.
- **Estilo**: los colores y las fuentes del prototipo (Outfit y DM Sans con `next/font/google`) se definen una vez en `app/globals.css` con `@theme` de Tailwind 4.
- **Rutas de administración**: `proxy.ts` también redirige las pantallas de admin cuando no hay sesión; si el rol no es ADMIN, el front muestra el 403 de la API en lugar de la pantalla.

### 16. Ampliación del contrato a 2.2.0

El contrato se amplía en este cambio, antes de que FASE 5 implemente, porque es la fuente de verdad de la forma de la API y de él se generan los tipos del front. Solo se agrega; nada de lo existente cambia de forma.

| Agregado | Seguridad | Respuestas |
|---|---|---|
| Tag `Administracion` | — | — |
| `GET /admin/panel?fecha=` → `PanelAdmin` | bearer, ADMIN | 200, 400, 401, 403 |
| `POST /canchas` (`CrearCanchaRequest`) → `Cancha` | bearer, ADMIN | 201 con `Location`, 400, 401, 403, 404 |
| `PATCH /canchas/{id}` (`ActualizarCanchaRequest`, todos los campos opcionales) → `Cancha` | bearer, ADMIN | 200, 400, 401, 403, 404 |
| `GET /canchas?incluirInactivas=` | pública; con `true` exige ADMIN | se suman 401 y 403 |
| `POST /equipamiento` (`CrearEquipamientoRequest`) → `Equipamiento` | bearer, ADMIN | 201 con `Location`, 400, 401, 403, 404 |
| `PATCH /equipamiento/{id}` (`ActualizarEquipamientoRequest`) → `Equipamiento` | bearer, ADMIN | 200, 400, 401, 403, 404 |
| `GET /equipamiento?incluirInactivos=` | pública; con `true` exige ADMIN | se suman 401 y 403 |
| `POST /reservas/{id}/reenvio-mail` → `ReenvioMailResponse` | bearer, titular o ADMIN | 202, 401, 404, 409, 429 |
| `Reserva.cliente` (string, nombre y apellido) | — | — |
| `Equipamiento.activo` (boolean) | — | — |

`PanelAdmin` = `fecha`, `reservasDelDia`, `reservasDiaAnterior`, `facturacionPrevista`, `cancelacionesDelDia`, `cancelacionesDentroDelPlazo`, `ocupacionDelDia`, `ocupacionPromedioSemanal`, `ocupacionPorCancha[]` (`OcupacionCancha`: `canchaId`, `nombre`, `disciplina`, `porcentaje`) y `proximosTurnos[]` (`ProximoTurno`: `reservaId`, `horaInicio`, `cancha`, `disciplina`, `cliente`, `cantidadJugadores`).

*(FASE 5)* El panel se calcula en cada consulta, sin tablas agregadas: reutiliza el generador de turnos de `disponibilidad` para contar los turnos ofrecidos, y usa el índice `ix_reserva_fecha` para leer las reservas de los 7 días. Los reenvíos de la última hora se cuentan en `notificacion` (`reenvio = true` y `enviada_en` dentro de la hora), usando el mismo reloj inyectable de la decisión 5.

## Risks / Trade-offs

- **Prisma no conoce el índice parcial** → un `prisma migrate dev` posterior puede generar un `DROP INDEX "ux_reserva_slot_activo"`. Mitigación: tras aplicar las migraciones se corre `prisma migrate dev --create-only --name verificacion` y se confirma que no genera nada; cada migración futura se revisa en el PR buscando ese `DROP`; el test de concurrencia de FASE 5 falla si el índice desaparece.
- **Docker Desktop cerrado o sin instalar** → `npm run db:up` falla con "Cannot connect to the Docker daemon" y, en Windows, Docker Desktop necesita WSL2. Mitigación: el README pide instalar Docker Desktop y dejarlo abierto (paso 1.5 del plan) y lista ese error con su solución.
- **Un PostgreSQL instalado en la máquina** → si `DATABASE_URL` queda con el puerto 5432, Prisma se conecta a ese servidor y no al contenedor. Mitigación: `.env.example` trae la URL con 5434, y la tarea 7.2 verifica que Prisma se conectó a `localhost:5434`. Un servidor instalado no tiene el rol `club`, así que el error salta enseguida.
- **El 5434 ocupado en alguna máquina** → `db:up` falla con "port is already allocated". Mitigación: se elige otro puerto libre para los cuatro y se cambia en `docker-compose.yml` y `.env.example` con un PR.
- **`ts-node` 10.9 con TypeScript 6.0** → `ts-node` no se actualiza desde 2023 y podría no ejecutar `seed.ts`. Mitigación: probar `ts-node prisma/seed.ts` y después `ts-node --transpile-only`; si ninguno funciona, actualizar la propuesta para sumar `tsx`.
- **`bcrypt` es un módulo nativo** → puede fallar la instalación en algún equipo o en CI. Mitigación: verificarlo en los cuatro equipos y en el primer run de CI; si no se resuelve, discutir `bcryptjs` en la propuesta.
- **Credenciales de prueba conocidas** (`clave1234`) → Mitigación: el seed solo corre en desarrollo y CI; el README lo aclara.
- **El prototipo pesa 28 MB** → la mitad son copias. Mitigación: versionar `docs/claude-design/` sin `uploads/`, que el canvas no referencia.
- **Las specs precisan cosas que `requisitos.md` no decía**: grilla obligatoria (422), horizonte inclusivo, `COMPLETADA` no cancelable, stock compartido entre canchas de una disciplina, canchas inactivas ocultas, 400 ante campos no declarados, `ZONA_HORARIA_CLUB`, sitio institucional repartido en tres páginas y asuntos de mail del prototipo. Mitigación: se enumeran en la descripción del PR para que los cuatro las aprueben; desde el archivado, la fuente de verdad del comportamiento es `openspec/specs/`.
- **La grilla del front asume 08 a 23** mientras la API lo toma de la configuración → Mitigación: aceptable para el MVP; si cambia el horario se actualizan ambos.
- **El MVP crece cuatro requisitos (RF-11 a RF-14)** por encima de lo que pide la consigna → las cuatro ramas planificadas no alcanzan y el calendario se aprieta. Mitigación: una rama propia de administración en FASE 5, que arranca después de autenticación y catálogo, de los que depende; primero se cierran disponibilidad, creación, consulta y cancelación, que son lo que evalúa la consigna.
- **El contrato cambia dentro del PR base** → un error ahí se propaga a los tipos del front y al chequeo de desvío del contrato. Mitigación: `contrato:lint` en verde, y la ampliación se revisa entre los cuatro junto con las specs antes del merge.
- **Las métricas del panel son consultas agregadas en cada request** → podrían ser lentas con muchos datos. Mitigación: el volumen de un club con seis canchas es chico; `ix_reserva_fecha` acota la lectura a 8 días; si hiciera falta, se cachea después.

## Migration Plan

Proyecto nuevo, sin datos productivos.

1. Trabajar en la rama `feature/spec-contrato-base` y abrir el PR con specs, documentación, prototipo, schema, migraciones y seed; lo aprueban los cuatro.
2. Cada integrante, con Docker Desktop abierto: `git pull`, `npm install`, `npm run db:up` (decisión 13), copiar `apps/api/.env.example` a `apps/api/.env` y completarlo, `npm run db:migrate`, `npm run db:seed`.
3. CI (paso 3.11): `prisma migrate deploy` contra el service container `postgres:17`.
4. Después del merge, `openspec archive especificacion-base-reservas` en un PR propio, avisando por el grupo.

**Rollback**: revertir el PR. En local, `npm exec --workspace api -- prisma migrate reset --force` deja la base vacía y vuelve a sembrarla, o `docker compose down -v` elimina el contenedor y el volumen con la base.

## Open Questions

- **Casilla que recibe los mensajes de contacto**: el prototipo publica `hola@clubdeploy.com.ar`. El nombre de la variable (por ejemplo `MAIL_CONTACTO_CLUB`) y la respuesta ante una falla del proveedor en `/contacto` los define el cambio de la landing.
- **Quién implementa la administración**: el reparto de `requisitos.md` §8 no incluye RF-11 a RF-14. Se asigna a un integrante (o a dos) al abrir FASE 5; no cambia specs ni tareas de este cambio.
- **Usuarios con `activo = false`**: si pueden iniciar sesión lo define el cambio de autenticación; el seed no crea usuarios inactivos.
