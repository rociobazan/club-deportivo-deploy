l# Sistema de Reservas — Club Deportivo

Especificación funcional y modelo de datos. Documento base para el contrato OpenAPI (`openapi.yaml`).

**Equipo:** 4 integrantes
**Dominio:** Club Deportivo (canchas de Tenis, Fútbol 5 y Pádel)
**Stack:** Nest.js (API) + Next.js (front) + PostgreSQL + Prisma

---

## 1. Alcance

### Dentro del MVP

- Autenticación con JWT y autorización por roles: `ADMIN`, `SOCIO`, `INVITADO`.
- Catálogo de disciplinas, canchas, tarifas y equipamiento.
- Consulta de disponibilidad por fecha y disciplina.
- Creación de reservas de cancha con equipamiento opcional.
- Precio plano por turno: cada cancha tiene un único precio, independiente de la cantidad de jugadores.
- Consulta de reservas (listado filtrado y detalle), acotada según el rol.
- Cancelación de reservas con política de anticipación mínima.
- Cálculo automático de precio (cancha + equipamiento).
- Notificaciones por mail vía Resend en confirmación y cancelación.
- Landing page pública institucional con identidad de marca propia.
- Formulario de contacto desde la landing.

### Fuera del MVP (declarado explícitamente)

- Pasarela de pagos real. La reserva registra un monto, no cobra.
- Reservas recurrentes ("todos los martes a las 20").
- Gestión de torneos, ligas o campeonatos.
- Recuperación de contraseña y verificación de mail.
- Notificaciones por WhatsApp o push.
- Reprogramación de una reserva. Se cancela y se crea una nueva.

---

## 2. Glosario

| Término | Definición |
|---|---|
| **Disciplina** | Deporte practicable en el club. Define la duración del turno y las cantidades de jugadores admitidas. |
| **Cancha** | Recurso físico reservable. Pertenece a exactamente una disciplina. |
| **Tarifa** | Precio de un turno de una cancha para una cantidad determinada de jugadores. |
| **Turno** | Bloque horario discreto de duración fija según la disciplina. |
| **Slot** | Par (cancha, fecha, horaInicio). Unidad mínima reservable. |
| **Reserva** | Ocupación confirmada de un slot por un usuario. |
| **Equipamiento** | Ítem alquilable con stock limitado (paletas, pelotas, pecheras). |

---

## 3. Roles y permisos

| Acción | INVITADO | SOCIO | ADMIN |
|---|:---:|:---:|:---:|
| Ver catálogo y tarifas | sí | sí | sí |
| Consultar disponibilidad | sí | sí | sí |
| Crear reserva | no | sí | sí |
| Ver reservas propias | — | sí | sí |
| Ver reservas de terceros | no | no | sí |
| Cancelar reserva propia | — | sí | sí |
| Cancelar reserva de terceros | no | no | sí |
| Cancelar fuera de plazo | no | no | sí |
| ABM de canchas, tarifas y equipamiento | no | no | sí |

`INVITADO` es el usuario no autenticado. No requiere registro: los endpoints de catálogo y disponibilidad son públicos.

**Decisión de seguridad:** cuando un SOCIO pide una reserva que existe pero no le pertenece, la API devuelve **404**, no 403. Un 403 confirmaría que ese ID existe y permitiría enumerar reservas ajenas.

---

## 4. Reglas de negocio

| ID | Regla | Dónde se hace cumplir |
|---|---|---|
| **RN-01** | Una cancha no puede tener dos reservas activas en el mismo slot. | Índice único parcial en BD + validación previa en el servicio. |
| **RN-02** | No se pueden crear reservas para fechas u horarios ya pasados. | Servicio. |
| **RN-03** | El horizonte máximo de reserva es de 30 días desde hoy. | Servicio. |
| **RN-04** | Una reserva solo puede cancelarse hasta **2 horas** antes del inicio. Un ADMIN puede cancelar sin esa restricción. | Servicio. |
| **RN-05** | El stock de equipamiento se valida **por slot**, no de forma global. Disponible = stockTotal − unidades alquiladas en ese mismo slot. | Servicio + query agregada. |
| **RN-06** | El precio se congela al momento de crear la reserva. Cambios de tarifa posteriores no afectan reservas existentes. | Montos persistidos en la reserva. |
| **RN-07** | Un SOCIO puede tener como máximo 3 reservas activas simultáneas. No aplica a ADMIN. | Servicio. |
| **RN-08** | El equipamiento alquilado debe pertenecer a la misma disciplina que la cancha. | Servicio. |
| **RN-09** | Solo se pueden reservar slots dentro del horario de atención del club (08:00–23:00). | Generación de disponibilidad. |
| **RN-10** | Cancelar nunca elimina el registro. Se marca `CANCELADA` y el slot vuelve a estar disponible. | Servicio. |
| **RN-11** | La cantidad de jugadores debe estar entre las admitidas por la disciplina y tener una tarifa cargada para esa cancha. | Servicio. |
| **RN-12** | El precio de la cancha se toma de la tarifa correspondiente a `(cancha, cantidadJugadores)`. | Servicio. |
| **RN-13** | Un usuario solo opera sobre sus propias reservas, salvo que sea ADMIN. | Guard de autorización. |
| **RN-14** | La notificación por mail se envía **después** de confirmar la transacción y nunca revierte la operación. Un fallo de envío se registra y se loguea. | Capa de notificaciones. |

### Configuración parametrizable

Estos valores viven en variables de entorno, no en el código:

| Parámetro | Valor por defecto |
|---|---|
| `CANCELACION_MINUTOS_MINIMOS` | 120 |
| `HORIZONTE_RESERVA_DIAS` | 30 |
| `MAX_RESERVAS_ACTIVAS_SOCIO` | 3 |
| `HORA_APERTURA` / `HORA_CIERRE` | 08:00 / 23:00 |

### Disciplinas, turnos y jugadores

| Disciplina | Duración | Jugadores admitidos |
|---|---|---|
| Tenis | 60 min | 2 (single), 4 (dobles) |
| Pádel | 90 min | 2, 4 |
| Fútbol 5 | 60 min | 10 |

El precio por turno **no** es el mismo para 2 que para 4 jugadores. Un single de tenis y un dobles ocupan la misma cancha el mismo tiempo, pero el club cobra distinto. Ese diferencial es dato del club y se carga en la tabla `tarifa`.

---

## 5. Requisitos funcionales

Formato de criterios de aceptación: `DADO / CUANDO / ENTONCES`. Cada criterio debe tener al menos un test automatizado.

---

### RF-00 — Autenticación

`POST /auth/registro` · `POST /auth/login` · `GET /auth/perfil`

**Criterios de aceptación**
- DADO un mail no registrado, CUANDO se registra un usuario, ENTONCES se crea con rol `SOCIO` y se devuelve 201.
- DADO un mail ya registrado, CUANDO se intenta registrar, ENTONCES se devuelve 409.
- DADO credenciales válidas, CUANDO se hace login, ENTONCES se devuelve un JWT con `sub` y `rol`.
- DADO credenciales inválidas, CUANDO se hace login, ENTONCES se devuelve 401 con un mensaje genérico que no revela si el mail existe.
- DADO un token expirado o mal formado, CUANDO se llama a un endpoint protegido, ENTONCES se devuelve 401.
- DADO un usuario, CUANDO se registra, ENTONCES la contraseña se persiste hasheada con bcrypt y nunca aparece en ninguna respuesta.

---

### RF-01 — Consultar catálogo de disciplinas

`GET /disciplinas` — público

- DADO que existen 3 disciplinas activas, CUANDO se consulta el catálogo, ENTONCES se devuelven 3 elementos con estado 200.
- DADO una disciplina inactiva, CUANDO se consulta el catálogo, ENTONCES no aparece.
- DADO cualquier disciplina, CUANDO se consulta, ENTONCES incluye la lista de cantidades de jugadores admitidas.

---

### RF-02 — Consultar canchas y tarifas

`GET /canchas?disciplinaId=&techada=` — público

- DADO el filtro `disciplinaId=1`, CUANDO se consultan las canchas, ENTONCES todas pertenecen a esa disciplina.
- DADO un `disciplinaId` inexistente, CUANDO se consultan las canchas, ENTONCES se devuelve lista vacía con 200 (no 404).
- DADO una cancha de tenis, CUANDO se consulta, ENTONCES incluye sus tarifas para 2 y para 4 jugadores con precios distintos.

---

### RF-03 — Consultar disponibilidad

`GET /disponibilidad?fecha=&disciplinaId=&canchaId=` — público

La disponibilidad **se calcula**, no se almacena:

```
slots del día = horario de atención dividido por la duración de turno de la disciplina
disponibles   = slots del día − slots con reserva activa
```

- DADO un día sin reservas, CUANDO se consulta una cancha de tenis, ENTONCES se devuelven 15 slots (08:00 a 23:00, turnos de 60 min).
- DADO una reserva CONFIRMADA a las 19:00, CUANDO se consulta, ENTONCES el slot de las 19:00 no aparece.
- DADO que esa reserva se cancela, CUANDO se consulta de nuevo, ENTONCES el slot vuelve a aparecer.
- DADO una fecha anterior a hoy, CUANDO se consulta, ENTONCES se devuelve 400.
- DADO que se consulta hoy y ya son las 14:00, ENTONCES no se devuelven slots anteriores a las 14:00.

---

### RF-04 — Crear reserva

`POST /reservas` — requiere rol SOCIO o ADMIN

El `clienteId` **no** viaja en el body. Se toma del `sub` del JWT.

- DADO un slot libre y datos válidos, CUANDO se crea la reserva, ENTONCES se devuelve 201 con el código y el monto total calculado.
- DADO una petición sin token, CUANDO se intenta crear, ENTONCES se devuelve 401.
- DADO un slot ya reservado, CUANDO se intenta reservar, ENTONCES se devuelve 409 (RN-01).
- DADO un horario pasado, ENTONCES 422 (RN-02).
- DADO una fecha a más de 30 días, ENTONCES 422 (RN-03).
- DADO un SOCIO con 3 reservas activas, CUANDO intenta una cuarta, ENTONCES 422 (RN-07).
- DADO un ADMIN con 5 reservas activas, CUANDO crea otra, ENTONCES se permite (RN-07).
- DADO 4 paletas solicitadas y 2 disponibles en el slot, ENTONCES 409 (RN-05).
- DADO equipamiento de otra disciplina, ENTONCES 422 (RN-08).
- DADO `cantidadJugadores: 3` en una cancha de tenis, ENTONCES 422 (RN-11).
- DADO una reserva de tenis con 2 jugadores y otra con 4 en la misma cancha, ENTONCES los montos de cancha difieren (RN-12).
- DADO una reserva creada, CUANDO luego cambia la tarifa, ENTONCES el monto de la reserva original no cambia (RN-06).
- DADO una reserva creada con éxito, ENTONCES se dispara un mail de confirmación al usuario (RF-08).
- DADO que el proveedor de mail falla, CUANDO se crea la reserva, ENTONCES igual se devuelve 201 y el fallo queda registrado (RN-14).

---

### RF-05 — Consultar reservas

`GET /reservas?clienteId=&fecha=&estado=` y `GET /reservas/{id}` — requiere autenticación

- DADO un SOCIO, CUANDO lista reservas sin filtros, ENTONCES solo obtiene las propias, aunque envíe el `clienteId` de otro.
- DADO un ADMIN con `clienteId=42`, CUANDO lista, ENTONCES obtiene las de ese cliente.
- DADO un SOCIO y el ID de una reserva ajena, CUANDO consulta el detalle, ENTONCES se devuelve **404** (RN-13).
- DADO un ID inexistente, ENTONCES 404.
- DADO una reserva con equipamiento, CUANDO se consulta el detalle, ENTONCES incluye el desglose con cantidad y precio unitario.

---

### RF-06 — Cancelar reserva

`PATCH /reservas/{id}/cancelacion` — requiere autenticación

- DADO una reserva CONFIRMADA a más de 2 horas de su inicio, CUANDO el dueño la cancela, ENTONCES pasa a CANCELADA y se devuelve 200.
- DADO una reserva a 90 minutos de su inicio, CUANDO el SOCIO intenta cancelar, ENTONCES 422 (RN-04).
- DADO una reserva a exactamente 2 horas de su inicio, CUANDO el SOCIO la cancela, ENTONCES se permite. El límite es inclusivo.
- DADO esa misma reserva, CUANDO la cancela un ADMIN, ENTONCES se permite (RN-04).
- DADO una reserva ya CANCELADA, CUANDO se intenta cancelar de nuevo, ENTONCES 409.
- DADO una reserva ajena, CUANDO un SOCIO intenta cancelarla, ENTONCES 404 (RN-13).
- DADO una reserva cancelada, CUANDO se consulta, ENTONCES sigue existiendo con motivo y fecha de cancelación (RN-10).
- DADO una cancelación exitosa, ENTONCES se dispara el mail correspondiente (RF-08).

---

### RF-07 — Consultar equipamiento

`GET /equipamiento?disciplinaId=&fecha=&horaInicio=` — público

- DADO el catálogo sin filtros de fecha, CUANDO se consulta, ENTONCES cada ítem muestra su `stockTotal`.
- DADO 2 paletas alquiladas de 6 en el slot de las 20:00, CUANDO se consulta con esa fecha y hora, ENTONCES el ítem muestra `stockDisponible: 4`.

---

### RF-08 — Notificaciones por mail

Proveedor: **Resend**. Dos plantillas.

| Evento | Asunto | Contenido |
|---|---|---|
| Reserva confirmada | Reserva confirmada — {codigo} | Cancha, fecha, horario, jugadores, equipamiento, monto total, plazo de cancelación |
| Reserva cancelada | Reserva cancelada — {codigo} | Datos de la reserva y motivo |

**Criterios de aceptación**
- DADO una reserva creada, CUANDO la transacción commitea, ENTONCES se invoca al proveedor con el mail del usuario.
- DADO que el proveedor devuelve error, CUANDO se crea la reserva, ENTONCES la respuesta sigue siendo 201 y se persiste una notificación en estado `FALLIDA` (RN-14).
- DADO el entorno de test, CUANDO se ejecutan los tests, ENTONCES el cliente de mail está mockeado y no se realiza ninguna llamada de red.

**Nota de implementación:** el envío nunca va dentro de la transacción de base de datos. Si Resend está caído, una reserva perfectamente válida no puede fallar por eso.

---

### RF-09 — Landing page institucional

`/` en Next.js. Pública, sin autenticación y sin endpoints propios: es contenido estático.

Secciones mínimas:

1. **Hero.** Nombre del club, una frase que diga qué es, y un botón que lleve directo a reservar.
2. **Quiénes somos.** Historia breve del club y qué lo diferencia.
3. **Disciplinas.** Tenis, Pádel y Fútbol 5, con foto y descripción.
4. **Instalaciones.** Cantidad de canchas, superficies, canchas techadas, horarios.
5. **Cómo reservar.** Tres pasos: elegís horario, reservás, recibís el mail.
6. **Contacto.** Formulario (RF-10), dirección, teléfono y redes.

**Criterios de aceptación**
- DADO un visitante sin sesión, CUANDO entra a `/`, ENTONCES ve la landing completa sin ser redirigido al login.
- DADO un visitante en la landing, CUANDO hace clic en el CTA principal, ENTONCES llega a la pantalla de disponibilidad.
- DADO un usuario ya autenticado, CUANDO entra a `/`, ENTONCES el header muestra su nombre y un acceso a "Mis reservas" en lugar de los botones de login.
- DADO la landing en un viewport de 375 px, CUANDO se navega, ENTONCES no hay desbordamiento horizontal ni texto cortado.
- DADO la landing, CUANDO se audita con Lighthouse, ENTONCES la accesibilidad da 90 o más.

La landing **tiene que renderizar completa sin la API**. Los datos de disciplinas e instalaciones son contenido, no registros. Si se leyeran de `/disciplinas`, la página fallaría cuando la API esté caída, que es justo cuando más importa que el sitio institucional siga en pie. Se admite un widget opcional de disponibilidad en el hero siempre que degrade en silencio: si no responde, se muestra el contenido estático y el visitante no se entera.

La identidad de marca, la paleta, la tipografía y el copy están en `identidad.md`.

---

### RF-10 — Formulario de contacto

`POST /contacto` — público, con rate limiting.

Envía el mensaje por mail a la casilla del club usando el mismo proveedor de notificaciones.

**Criterios de aceptación**
- DADO datos válidos, CUANDO se envía el formulario, ENTONCES se devuelve 202 y llega el mail a la casilla del club.
- DADO un mail mal formado, ENTONCES 400.
- DADO un mensaje de más de 1000 caracteres, ENTONCES 400.
- DADO 6 envíos desde la misma IP en un minuto, CUANDO se envía el sexto, ENTONCES 429.
- DADO que el campo oculto anti-spam viene completo, CUANDO se envía, ENTONCES se devuelve 202 pero no se envía nada.

**Nota:** un endpoint público que dispara mails es un blanco de spam. El rate limit no es opcional acá. `@nestjs/throttler` lo resuelve con un decorador.

---

## 6. Modelo de datos (PostgreSQL)

### Diagrama de relaciones

```
disciplina 1 ──< N cancha 1 ──< N tarifa
disciplina 1 ──< N equipamiento
usuario    1 ──< N reserva
cancha     1 ──< N reserva
reserva    1 ──< N reserva_equipamiento >── N equipamiento
reserva    1 ──< N notificacion
```

### Tablas

**usuario**

| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | |
| nombre | varchar(60) | |
| apellido | varchar(60) | |
| email | varchar(120) | UNIQUE |
| password_hash | varchar(120) | bcrypt, nunca se expone |
| telefono | varchar(30) | |
| rol | enum | ADMIN, SOCIO |
| activo | boolean | default true |
| creado_en | timestamptz | |

**disciplina**

| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | |
| nombre | varchar(50) | UNIQUE |
| duracion_turno_min | int | 60, 90 |
| jugadores_permitidos | int[] | `{2,4}` para tenis y pádel, `{10}` para fútbol 5 |
| activa | boolean | default true |

**cancha**

| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | |
| disciplina_id | int FK | → disciplina |
| nombre | varchar(50) | |
| superficie | varchar(30) | |
| techada | boolean | |
| activa | boolean | default true |

El precio ya no vive acá. Pasó a `tarifa`.

**tarifa**

| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | |
| cancha_id | int FK | → cancha, ON DELETE CASCADE |
| cantidad_jugadores | int | |
| precio_por_turno | numeric(10,2) | |

UNIQUE (cancha_id, cantidad_jugadores).

**equipamiento**

| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | |
| disciplina_id | int FK | → disciplina |
| nombre | varchar(60) | |
| stock_total | int | CHECK > 0 |
| precio_por_turno | numeric(10,2) | |

**reserva**

| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | |
| codigo | varchar(12) | UNIQUE. `RES-A7F3K2` |
| usuario_id | int FK | → usuario. Tomado del JWT, nunca del body |
| cancha_id | int FK | → cancha |
| fecha | date | |
| hora_inicio | time | |
| hora_fin | time | derivado de la duración de la disciplina |
| cantidad_jugadores | int | |
| estado | enum | CONFIRMADA, CANCELADA, COMPLETADA |
| monto_cancha | numeric(10,2) | congelado (RN-06) |
| monto_equipamiento | numeric(10,2) | congelado |
| monto_total | numeric(10,2) | |
| creada_en | timestamptz | |
| cancelada_en | timestamptz NULL | |
| cancelada_por | int FK NULL | → usuario. Distingue la cancelación del socio de la del admin |
| motivo_cancelacion | varchar(200) NULL | |

**reserva_equipamiento**

| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | |
| reserva_id | int FK | → reserva, ON DELETE CASCADE |
| equipamiento_id | int FK | → equipamiento |
| cantidad | int | CHECK > 0 |
| precio_unitario | numeric(10,2) | congelado |

UNIQUE (reserva_id, equipamiento_id).

**notificacion**

| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | |
| reserva_id | int FK | → reserva |
| tipo | enum | CONFIRMACION, CANCELACION |
| destinatario | varchar(120) | |
| estado | enum | ENVIADA, FALLIDA |
| proveedor_id | varchar(80) NULL | ID que devuelve Resend |
| error | text NULL | |
| enviada_en | timestamptz | |

---

### La restricción crítica (RN-01)

La regla "una cancha no puede reservarse dos veces en el mismo slot" **no puede vivir solo en el código**. Dos requests concurrentes pasan la validación de aplicación al mismo tiempo y generan la doble reserva. Tiene que estar en la base.

El problema es que una reserva cancelada debe liberar el slot, así que un `UNIQUE (cancha_id, fecha, hora_inicio)` común bloquearía volver a reservar un horario que se canceló.

PostgreSQL lo resuelve con un índice único parcial:

```sql
CREATE UNIQUE INDEX ux_reserva_slot_activo
  ON reserva (cancha_id, fecha, hora_inicio)
  WHERE estado <> 'CANCELADA';
```

Prisma no expresa índices parciales con `@@unique`. Va en una migración manual:

```sql
-- prisma/migrations/xxxx_slot_unico_activo/migration.sql
CREATE UNIQUE INDEX "ux_reserva_slot_activo"
  ON "reserva" ("cancha_id", "fecha", "hora_inicio")
  WHERE "estado" <> 'CANCELADA';
```

El servicio debe capturar el error `P2002` de Prisma y traducirlo a un `409 Conflict`, en lugar de dejar que escale como 500.

**Test obligatorio:** disparar dos `POST /reservas` en paralelo sobre el mismo slot con `Promise.all` y verificar que exactamente uno devuelve 201 y el otro 409. Es el test que demuestra que la restricción está donde tiene que estar.

---

### Índices adicionales

```sql
CREATE INDEX ix_reserva_usuario_estado ON reserva (usuario_id, estado);
CREATE INDEX ix_reserva_fecha ON reserva (fecha);
```

El primero sostiene RN-07 y el listado por usuario; el segundo, el cálculo de disponibilidad.

---

### Estados de la reserva

```
        crear
          │
          ▼
    ┌───────────┐   cancelar (>=2 h antes, o ADMIN)   ┌───────────┐
    │CONFIRMADA │ ──────────────────────────────────► │ CANCELADA │
    └───────────┘                                     └───────────┘
          │
          │ el horario pasó
          ▼
    ┌───────────┐
    │COMPLETADA │
    └───────────┘
```

`COMPLETADA` se resuelve como estado derivado al leer (`fecha + hora_fin < ahora`), sin job programado. Es lo más simple para el MVP.

---

## 7. Formato de errores

Estructura única, inspirada en RFC 7807:

```json
{
  "tipo": "SLOT_NO_DISPONIBLE",
  "titulo": "El horario solicitado ya está reservado",
  "estado": 409,
  "detalle": "La cancha 3 ya tiene una reserva activa el 2026-09-15 a las 19:00.",
  "instancia": "/reservas"
}
```

| Código | Cuándo |
|---|---|
| 400 | Parámetros mal formados. |
| 401 | Falta el token, está vencido o es inválido. |
| 403 | Autenticado pero sin permisos para la operación. |
| 404 | El recurso no existe, o existe pero no pertenece al usuario (RN-13). |
| 409 | Conflicto de estado: slot ocupado, stock insuficiente, mail duplicado, reserva ya cancelada. |
| 422 | Sintaxis válida pero viola una regla de negocio (RN-02, 03, 04, 07, 08, 11). |

---

## 8. Reparto de trabajo

Cada integrante se lleva su feature **completa**: contrato, endpoint en Nest, tests y la pantalla en Next que la consume. Dividir por capas (uno hace back, otro front) genera bloqueos y deja el historial de commits desparejo, que es justo lo que evalúa la consigna.

| Integrante | Alcance | Rama sugerida | Revisa a |
|---|---|---|---|
| Todos | Contrato base, schema Prisma, seed | `feature/spec-contrato-base` | — |
| A | RF-00 auth + guards de rol + login/registro en Next | `feature/spec-autenticacion` | B |
| B | RF-01, RF-02, RF-03 + pantalla de disponibilidad | `feature/spec-disponibilidad` | C |
| C | RF-04 (RN-01, 05, 06, 11, 12) + formulario de reserva | `feature/spec-creacion-reserva` | D |
| D | RF-05, RF-06, RF-07, RF-08 + pantalla de mis reservas | `feature/spec-reservas-notificaciones` | A |
| A + B | RF-09, RF-10 landing y contacto | `feature/landing-institucional` | C y D |

El PR del contrato base va primero y lo aprueban los cuatro. Recién después se abren las ramas en paralelo. A tiene el camino crítico: hasta que los guards no estén, C y D testean con un mock del token.

El CI y el README son responsabilidad compartida: se abren como issues aparte y los toma quien vaya más liviano esa semana.
