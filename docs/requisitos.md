# Sistema de Reservas — Club Deportivo

> **Nota:** desde el archivado del cambio `especificacion-base-reservas`, el comportamiento vigente del sistema está en `openspec/specs/`, la forma de la API en `contratos/openapi.yaml` y la referencia visual en `docs/claude-design/`. Este documento queda como relevamiento funcional y modelo de datos.

Especificación funcional y modelo de datos. Documento base para el contrato OpenAPI (`openapi.yaml`).

**Equipo:** 4 integrantes
**Dominio:** Club Deportivo Deploy (canchas de Tenis, Fútbol 5 y Pádel)
**Stack:** Nest.js (API) + Next.js (front) + PostgreSQL + Prisma

---

## 1. Alcance

### Dentro del MVP

- Autenticación con JWT y autorización por roles: `ADMIN`, `SOCIO`, `INVITADO`.
- Catálogo de disciplinas, canchas con su precio por turno y equipamiento.
- Consulta de disponibilidad por fecha y disciplina.
- Creación de reservas de cancha con equipamiento opcional.
- Precio plano por turno: cada cancha tiene un único precio, independiente de la cantidad de jugadores.
- Consulta de reservas (listado filtrado y detalle), acotada según el rol.
- Cancelación de reservas con política de anticipación mínima.
- Cálculo automático de precio (cancha + equipamiento).
- Notificaciones por mail vía Resend en confirmación y cancelación.
- Reenvío del mail de una reserva, a pedido del titular o del administrador.
- Panel del club para el administrador: reservas, facturación prevista, cancelaciones, ocupación y próximos turnos.
- Administración de canchas y equipamiento: alta, edición y baja.
- Sitio institucional público (Inicio, El club y Contacto) con la identidad del prototipo de Claude Design.
- Formulario de contacto desde el sitio.

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
| **Disciplina** | Deporte practicable en el club. Define la duración del turno. |
| **Cancha** | Recurso físico reservable. Pertenece a exactamente una disciplina y tiene un único precio por turno. |
| **Turno** | Bloque horario discreto de duración fija según la disciplina. |
| **Slot** | Par (cancha, fecha, horaInicio). Unidad mínima reservable. |
| **Reserva** | Ocupación confirmada de un slot por un usuario. |
| **Equipamiento** | Ítem alquilable con stock limitado (paletas, pelotas, pecheras). |

---

## 3. Roles y permisos

| Acción | INVITADO | SOCIO | ADMIN |
|---|:---:|:---:|:---:|
| Ver catálogo y precios | sí | sí | sí |
| Consultar disponibilidad | sí | sí | sí |
| Crear reserva | no | sí | sí |
| Ver reservas propias | — | sí | sí |
| Ver reservas de terceros | no | no | sí |
| Cancelar reserva propia | — | sí | sí |
| Cancelar reserva de terceros | no | no | sí |
| Cancelar fuera de plazo | no | no | sí |
| Reenviar mail de reserva propia | — | sí | sí |
| Reenviar mail de reserva de terceros | no | no | sí |
| Ver panel del club | no | no | sí |
| ABM de canchas y equipamiento | no | no | sí |

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
| **RN-06** | El precio se congela al momento de crear la reserva. Cambios de precio posteriores no afectan reservas existentes. | Montos persistidos en la reserva. |
| **RN-07** | Un SOCIO puede tener como máximo 3 reservas activas simultáneas. No aplica a ADMIN. | Servicio. |
| **RN-08** | El equipamiento alquilado debe pertenecer a la misma disciplina que la cancha. | Servicio. |
| **RN-09** | Solo se pueden reservar slots dentro del horario de atención del club (08:00–23:00). | Generación de disponibilidad. |
| **RN-10** | Cancelar nunca elimina el registro. Se marca `CANCELADA` y el slot vuelve a estar disponible. | Servicio. |
| **RN-11** | *Dada de baja: precio plano por turno.* | — |
| **RN-12** | *Dada de baja: precio plano por turno.* | — |
| **RN-13** | Un usuario solo opera sobre sus propias reservas, salvo que sea ADMIN. | Guard de autorización. |
| **RN-14** | La notificación por mail se envía **después** de confirmar la transacción y nunca revierte la operación. Un fallo de envío se registra y se loguea. | Capa de notificaciones. |
| **RN-15** | Dar de baja una cancha o un equipamiento no modifica ni cancela las reservas existentes; solo impide reservas nuevas sobre ese recurso. | Servicio de administración. |
| **RN-16** | Una reserva admite como máximo 3 reenvíos de mail por hora. | Capa de notificaciones (cuenta los reenvíos registrados en `notificacion`). |

### Configuración parametrizable

Estos valores viven en variables de entorno, no en el código:

| Parámetro | Valor por defecto |
|---|---|
| `CANCELACION_MINUTOS_MINIMOS` | 120 |
| `HORIZONTE_RESERVA_DIAS` | 30 |
| `MAX_RESERVAS_ACTIVAS_SOCIO` | 3 |
| `HORA_APERTURA` / `HORA_CIERRE` | 08:00 / 23:00 |
| `PREFIJO_CODIGO_RESERVA` | `RES` |
| `ZONA_HORARIA_CLUB` | `America/Argentina/Cordoba` |

### Disciplinas y turnos

| Disciplina | Duración |
|---|---|
| Tenis | 60 min |
| Pádel | 90 min |
| Fútbol 5 | 60 min |

**Precio plano por turno.** Cada cancha tiene un único precio por turno, que no depende de la cantidad de jugadores. `cantidadJugadores` es opcional e informativo: si se envía, tiene que ser un entero mayor o igual a 1, y no interviene en el cálculo del monto.

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
- DADO cualquier disciplina, CUANDO se consulta, ENTONCES incluye la duración de turno.

---

### RF-02 — Consultar canchas

`GET /canchas?disciplinaId=&techada=` — público

- DADO el filtro `disciplinaId=1`, CUANDO se consultan las canchas, ENTONCES todas pertenecen a esa disciplina.
- DADO un `disciplinaId` inexistente, CUANDO se consultan las canchas, ENTONCES se devuelve lista vacía con 200 (no 404).
- DADO una cancha de tenis, CUANDO se consulta, ENTONCES incluye un único `precioPorTurno`.

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
- DADO `cantidadJugadores: 3` en una cancha de tenis, ENTONCES se acepta con 201 y la reserva lo registra: la cantidad es informativa.
- DADO una reserva de tenis con 2 jugadores y otra con 4 en la misma cancha, ENTONCES las dos tienen el mismo monto de cancha (precio plano).
- DADO una reserva creada, CUANDO luego cambia el precio de la cancha, ENTONCES el monto de la reserva original no cambia (RN-06).
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
- DADO cualquier reserva del listado o del detalle, ENTONCES incluye el nombre y apellido del titular en `cliente`.

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
| Reserva confirmada | `Tu turno en Deploy está confirmado · {codigo}` | Código, cancha y superficie, día, horario, jugadores si se informaron, equipamiento, total a pagar en el club y plazo de cancelación |
| Reserva cancelada | `Cancelamos tu turno en Deploy · {codigo}` | Datos de la reserva y motivo |

El destinatario es siempre el titular de la reserva, aunque la cancele un ADMIN.

**Criterios de aceptación**
- DADO una reserva creada, CUANDO la transacción commitea, ENTONCES se invoca al proveedor con el mail del usuario.
- DADO que el proveedor devuelve error, CUANDO se crea la reserva, ENTONCES la respuesta sigue siendo 201 y se persiste una notificación en estado `FALLIDA` (RN-14).
- DADO el entorno de test, CUANDO se ejecutan los tests, ENTONCES el cliente de mail está mockeado y no se realiza ninguna llamada de red.

**Nota de implementación:** el envío nunca va dentro de la transacción de base de datos. Si Resend está caído, una reserva perfectamente válida no puede fallar por eso.

---

### RF-09 — Sitio institucional

Inicio (`/`), El club y Contacto en Next.js. Públicas, sin autenticación y sin endpoints propios: son contenido estático.

Secciones mínimas:

1. **Inicio** (`/`). Hero con el nombre del club, una frase que diga qué es y un botón que lleve a la disponibilidad; las disciplinas Tenis, Pádel y Fútbol 5 con su duración de turno; las instalaciones; cómo reservar (elegís el día, tocás un horario libre y recibís el mail con el código); y accesos para crear una cuenta de socio y para escribirle al club.
2. **El club.** Historia del club, cada disciplina con sus canchas y los servicios.
3. **Contacto.** Formulario (RF-10), dirección, teléfono, mail y horarios. Sin redes sociales.

Las páginas públicas llevan un pie con los horarios, la dirección y los datos de contacto.

**Criterios de aceptación**
- DADO un visitante sin sesión, CUANDO entra a `/`, ENTONCES ve el hero, las disciplinas, las instalaciones y cómo reservar, sin ser redirigido al login.
- DADO un visitante en Inicio, CUANDO hace clic en el botón principal, ENTONCES llega a la pantalla de disponibilidad.
- DADO un visitante sin sesión, CUANDO usa la navegación del header, ENTONCES llega a El club, Canchas y precios, Disponibilidad y Contacto, y ve un botón para ingresar.
- DADO un usuario ya autenticado, CUANDO entra a `/`, ENTONCES el header muestra su nombre y un acceso a "Mis reservas" en lugar del botón para ingresar.
- DADO la API apagada, CUANDO se cargan Inicio, El club o Contacto, ENTONCES cada página se muestra completa.
- DADO el sitio en un viewport de 375 px, CUANDO se navega, ENTONCES no hay desbordamiento horizontal ni texto cortado.
- DADO `/`, CUANDO se audita con Lighthouse, ENTONCES la accesibilidad da 90 o más.
- DADO un visitante con `prefers-reduced-motion` activado, CUANDO carga `/`, ENTONCES la página se muestra sin animaciones.

El sitio **tiene que renderizar completo sin la API**. Los datos de disciplinas e instalaciones son contenido, no registros. Si se leyeran de `/disciplinas`, la página fallaría cuando la API esté caída, que es justo cuando más importa que el sitio institucional siga en pie. Se admiten datos opcionales de la API, como el precio desde el que se reserva cada disciplina, siempre que degraden en silencio: si la API no responde en 2 segundos, el dato se omite y no se muestra ningún error.

La referencia de contenido y aspecto es el prototipo `docs/claude-design/Deploy Club.dc.html`.

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

### RF-11 — Panel del club

`GET /admin/panel?fecha=` — solo ADMIN

Resume la actividad de un día; sin `fecha`, la de hoy en la hora local del club. Se calcula en cada consulta, sin tablas agregadas:

- **Reservas** no canceladas del día y del día anterior.
- **Facturación prevista**: suma de `montoTotal` de las reservas no canceladas del día.
- **Cancelaciones** del día, según la fecha local de `cancelada_en`, y cuántas se hicieron con al menos `CANCELACION_MINUTOS_MINIMOS` de anticipación.
- **Ocupación** del día, promedio de los 7 días que terminan en la fecha y de cada cancha activa en esos 7 días: turnos con reserva no cancelada sobre turnos ofrecidos, como porcentaje entero redondeado.
- **Próximos turnos**: las reservas no canceladas del día por hora de inicio, con cancha, disciplina, titular y cantidad de jugadores. Si la fecha es hoy, solo las que todavía no empezaron.

**Criterios de aceptación**
- DADO un ADMIN, CUANDO consulta el panel sin `fecha`, ENTONCES se devuelve 200 con el panel de hoy en la hora local del club.
- DADO un SOCIO, CUANDO consulta el panel, ENTONCES 403.
- DADO una petición sin token, CUANDO se consulta el panel, ENTONCES 401.
- DADO `fecha=14-09-2026`, CUANDO un ADMIN consulta el panel, ENTONCES 400.
- DADO un día con 3 reservas no canceladas de 14000, 9000 y 23000, una cancelada, y un día anterior con 2 reservas no canceladas, CUANDO se consulta, ENTONCES informa 3 reservas del día, 2 del día anterior y facturación prevista 46000.
- DADO dos cancelaciones en el día, una 5 horas antes del inicio y otra de un ADMIN 30 minutos antes, CUANDO se consulta, ENTONCES informa 2 cancelaciones, 1 dentro del plazo.
- DADO 6 canchas activas que ofrecen 75 turnos en el día y 5 reservas no canceladas, todas en Pádel 1, CUANDO se consulta, ENTONCES la ocupación del día es 7.
- DADO que Pádel 1 tuvo 5 reservas no canceladas sobre 70 turnos ofrecidos en los 7 días que terminan en la fecha, CUANDO se consulta, ENTONCES su ocupación es 7.
- DADO un día sin reservas no canceladas, CUANDO se consulta, ENTONCES la ocupación del día es 0.
- DADO que son las 19:40 y hoy hay reservas a las 18:30, 20:00 y 21:30, CUANDO se consulta hoy, ENTONCES los próximos turnos son el de las 20:00 y el de las 21:30, en ese orden.
- DADO que mañana hay reservas a las 09:00 y a las 18:30, CUANDO un ADMIN consulta el panel de mañana, ENTONCES lista las dos en ese orden.

---

### RF-12 — Administración de canchas

`POST /canchas` · `PATCH /canchas/{id}` · `GET /canchas?incluirInactivas=true` — solo ADMIN

Alta con disciplina, nombre, superficie opcional, techada y `precioPorTurno` mayor que 0. Edición de nombre, superficie, techada, `precioPorTurno` y `activa`. Dar de baja es `activa: false`: la cancha sale del catálogo y de la disponibilidad, pero sus reservas no cambian (RN-15).

**Criterios de aceptación**
- DADO un ADMIN, CUANDO da de alta "Pádel 4" en Pádel, sin techo y con `precioPorTurno` 15000, ENTONCES se devuelve 201 con la cancha activa, que aparece en `GET /canchas` y en la disponibilidad.
- DADO `precioPorTurno: 0` en el alta o en la edición, ENTONCES 400.
- DADO un `disciplinaId` inexistente en el alta, o un id de cancha inexistente en la edición, ENTONCES 404.
- DADO que un ADMIN cambia el precio de Pádel 1 de 14000 a 16000, CUANDO se crea una reserva nueva en esa cancha, ENTONCES tiene `montoCancha` 16000 y las anteriores conservan 14000 (RN-06).
- DADO una cancha con una reserva CONFIRMADA para mañana, CUANDO un ADMIN la da de baja, ENTONCES deja de aparecer en `GET /canchas` y en `GET /disponibilidad`, una reserva nueva sobre ella da 404 y la de mañana sigue CONFIRMADA (RN-15).
- DADO una cancha dada de baja, CUANDO un ADMIN la reactiva, ENTONCES vuelve a aparecer en `GET /canchas` y en la disponibilidad.
- DADO una cancha dada de baja, CUANDO un ADMIN lista con `incluirInactivas=true`, ENTONCES la respuesta la incluye con `activa: false`.
- DADO un SOCIO, CUANDO intenta el alta, la edición o el listado con `incluirInactivas=true`, ENTONCES 403; sin token, 401.

---

### RF-13 — Administración de equipamiento

`POST /equipamiento` · `PATCH /equipamiento/{id}` · `GET /equipamiento?incluirInactivos=true` — solo ADMIN

Alta con disciplina, nombre, `stockTotal` entero mayor o igual a 0 y `precioPorTurno` mayor que 0. Edición de nombre, `stockTotal`, `precioPorTurno` y `activo`. Dar de baja es `activo: false`: el ítem sale del catálogo y no se puede alquilar en reservas nuevas, pero las reservas que ya lo incluyen no cambian (RN-15). Cambiar el precio no modifica el `precioUnitario` de reservas existentes (RN-06).

**Criterios de aceptación**
- DADO un ADMIN, CUANDO da de alta "Visera" en Tenis con `stockTotal` 8 y `precioPorTurno` 1000, ENTONCES se devuelve 201 con el ítem activo, que aparece en `GET /equipamiento`.
- DADO `stockTotal: -1` en el alta o en la edición, ENTONCES 400.
- DADO que un ADMIN cambia el stock de la paleta de pádel de 6 a 8, CUANDO se consulta un turno sin alquileres, ENTONCES muestra `stockTotal` 8 y `stockDisponible` 8.
- DADO reservas que alquilan 4 paletas mañana a las 20:00, CUANDO un ADMIN baja el stock a 3, ENTONCES esas reservas conservan sus 4 paletas y ese turno muestra `stockDisponible` 0 (RN-15).
- DADO un ítem que un ADMIN da de baja, ENTONCES deja de aparecer en `GET /equipamiento` y una reserva que lo pide da 404.
- DADO un ítem dado de baja, CUANDO un ADMIN lista con `incluirInactivos=true`, ENTONCES la respuesta lo incluye con `activo: false`.
- DADO un SOCIO, CUANDO intenta el alta, la edición o el listado con `incluirInactivos=true`, ENTONCES 403.

---

### RF-14 — Reenvío del mail

`POST /reservas/{id}/reenvio-mail` — titular o ADMIN

Reenvía el mail que corresponde al estado actual de la reserva: el de confirmación si está activa, el de cancelación si está CANCELADA. El destinatario es siempre el titular. Cada reenvío se registra en `notificacion` con `reenvio = true`, en estado `ENVIADA` o `FALLIDA`.

**Criterios de aceptación**
- DADO una reserva CONFIRMADA de mañana, CUANDO el titular pide el reenvío, ENTONCES se devuelve 202, se reenvía la confirmación al titular y queda registrada como reenvío.
- DADO una reserva CANCELADA, CUANDO el titular pide el reenvío, ENTONCES se devuelve 202 y se reenvía el aviso de cancelación.
- DADO una reserva cuyo turno ya terminó, CUANDO se pide el reenvío, ENTONCES 409 y no se envía nada.
- DADO la reserva activa de un SOCIO, CUANDO un ADMIN pide el reenvío, ENTONCES se devuelve 202 y el destinatario es el SOCIO.
- DADO una reserva ajena, CUANDO un SOCIO pide el reenvío, ENTONCES 404 y no se envía nada (RN-13).
- DADO 3 reenvíos de una reserva en la última hora, CUANDO se pide otro, ENTONCES 429 y no se envía nada (RN-16).
- DADO que el proveedor falla durante un reenvío válido, CUANDO se pide, ENTONCES igual se devuelve 202 y la notificación queda `FALLIDA` (RN-14).

---

## 6. Modelo de datos (PostgreSQL)

### Diagrama de relaciones

```
disciplina 1 ──< N cancha
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
| telefono | varchar(30) NULL | |
| rol | enum | ADMIN, SOCIO. Default SOCIO |
| activo | boolean | default true |
| creado_en | timestamptz | |

**disciplina**

| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | |
| nombre | varchar(50) | UNIQUE |
| duracion_turno_min | int | 60, 90 |
| activa | boolean | default true |

**cancha**

| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | |
| disciplina_id | int FK | → disciplina |
| nombre | varchar(50) | |
| superficie | varchar(30) NULL | |
| techada | boolean | default false |
| precio_por_turno | numeric(10,2) | único por turno, no depende de la cantidad de jugadores. > 0, validado en la API |
| activa | boolean | default true. Dar de baja no toca reservas (RN-15) |

**equipamiento**

| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | |
| disciplina_id | int FK | → disciplina |
| nombre | varchar(60) | |
| stock_total | int | >= 0, validado en la API |
| precio_por_turno | numeric(10,2) | > 0, validado en la API |
| activo | boolean | default true. Dar de baja no toca reservas (RN-15) |

**reserva**

| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | |
| codigo | varchar(12) | UNIQUE. `PREFIJO_CODIGO_RESERVA` + `-` + 6 caracteres `[A-Z0-9]`, por ejemplo `RES-A7F3K2` |
| usuario_id | int FK | → usuario. Tomado del JWT, nunca del body |
| cancha_id | int FK | → cancha |
| fecha | date | |
| hora_inicio | varchar(5) | `HH:MM`, hora local del club |
| hora_fin | varchar(5) | `HH:MM`, derivado de la duración de la disciplina |
| cantidad_jugadores | int NULL | opcional e informativo, no cambia el monto |
| estado | enum | CONFIRMADA, CANCELADA, COMPLETADA. Solo se persisten las dos primeras; COMPLETADA se deriva al leer |
| monto_cancha | numeric(10,2) | congelado (RN-06) |
| monto_equipamiento | numeric(10,2) | congelado. Default 0 |
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
| cantidad | int | > 0, validado en la API |
| precio_unitario | numeric(10,2) | congelado |

UNIQUE (reserva_id, equipamiento_id).

**notificacion**

| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | |
| reserva_id | int FK | → reserva, ON DELETE CASCADE |
| tipo | enum | CONFIRMACION, CANCELACION |
| destinatario | varchar(120) | |
| estado | enum | ENVIADA, FALLIDA |
| proveedor_id | varchar(80) NULL | ID que devuelve Resend |
| error | text NULL | |
| reenvio | boolean | default false. Marca los reenvíos pedidos (RF-14, RN-16) |
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

El primero sostiene RN-07 y el listado por usuario; el segundo, el cálculo de disponibilidad y el panel del club.

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
| 409 | Conflicto de estado: slot ocupado, stock insuficiente, mail duplicado, reserva no cancelable, reenvío no disponible. |
| 422 | Sintaxis válida pero viola una regla de negocio (RN-02, 03, 04, 07, 08, 09). |
| 429 | Se superó un límite: envíos de contacto por IP (RF-10) o reenvíos de mail por reserva (RN-16). |

---

## 8. Reparto de trabajo

Cada integrante se lleva su feature **completa**: contrato, endpoint en Nest, tests y la pantalla en Next que la consume. Dividir por capas (uno hace back, otro front) genera bloqueos y deja el historial de commits desparejo, que es justo lo que evalúa la consigna.

| Integrante | Alcance | Rama sugerida | Revisa a |
|---|---|---|---|
| Todos | Contrato base, schema Prisma, seed | `feature/spec-contrato-base` | — |
| A | RF-00 auth + guards de rol + login/registro en Next | `feature/spec-autenticacion` | B |
| B | RF-01, RF-02, RF-03 + pantalla de disponibilidad | `feature/spec-disponibilidad` | C |
| C | RF-04 (RN-01, 05, 06) + formulario de reserva | `feature/spec-creacion-reserva` | D |
| D | RF-05, RF-06, RF-07, RF-08 + pantalla de mis reservas | `feature/spec-reservas-notificaciones` | A |
| A + B | RF-09, RF-10 sitio institucional y contacto | `feature/landing-institucional` | C y D |
| A asignar | RF-11 a RF-14, administración y reenvío + pantallas de admin | `feature/spec-administracion` | A definir |

El PR del contrato base va primero y lo aprueban los cuatro. Recién después se abren las ramas en paralelo. A tiene el camino crítico: hasta que los guards no estén, C y D testean con un mock del token.

El CI y el README son responsabilidad compartida: se abren como issues aparte y los toma quien vaya más liviano esa semana.
