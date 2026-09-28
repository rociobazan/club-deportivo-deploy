# Proposal

## Why

Crear una reserva es lo único del MVP que todavía no se puede hacer, y es la razón de ser del sistema: hoy las reservas solo existen si alguien las inserta con Prisma, como hacen los e2e de `catalogo` y `disponibilidad`. La pantalla de disponibilidad **ya manda a reservar**: su spec fija que un socio que toca un turno libre termina en `/reservar?canchaId=&fecha=&horaInicio=`, y esa ruta devuelve 404. Además 1.4 (mis reservas, detalle y cancelación) y 1.6 (administración y reenvío) operan sobre reservas que alguien tiene que haber creado.

La capacidad `reservas` ya está especificada requisito por requisito; este cambio **implementa los ocho requisitos de creación tal como están**, especifica la pantalla que los consume y cierra un hueco que dejó el horario por día.

## What Changes

- **API — módulo `reservas`**: `POST /reservas`, con rol `SOCIO` o `ADMIN`. El titular sale del `sub` del token y nunca del body. El servidor calcula `horaFin` con la duración de turno de la disciplina, congela los montos y devuelve 201 con `Location`. Cubre los ocho requisitos de creación de `openspec/specs/reservas/spec.md`: titular autenticado, código legible, RN-01, RN-09, RN-02 y RN-03, RN-07, RN-05 y RN-08, y RN-06.
- **RN-01 respaldado por la base**: la garantía contra dos solicitudes simultáneas es el índice único parcial `ux_reserva_slot_activo`. El pre-chequeo mejora el mensaje; el que decide es el `P2002` capturado dentro de la transacción.
- **Configuración**: `configuracion.ts` pasa a leer las cuatro variables que ya están en `apps/api/.env.example` pero que nadie lee todavía: `HORIZONTE_RESERVA_DIAS` (30), `MAX_RESERVAS_ACTIVAS_SOCIO` (3), `PREFIJO_CODIGO_RESERVA` (`RES`) y `CANCELACION_MINUTOS_MINIMOS` (120), con default y validación al arrancar, igual que se hizo con `HORA_APERTURA`. Las tres primeras las consume este cambio; la cuarta la consume 1.4 y se suma acá para que no tenga que volver a tocar este archivo.
- **Corrección de spec — el horario por día no llegó a `reservas`**: cuando entró el horario por día (cierre propio del sábado y `DIAS_CERRADOS`), se actualizó la spec de `disponibilidad` pero no la de `reservas`. Hoy `RN-09` habla de "el cierre" como si fuera uno solo y no dice qué pasa al reservar un domingo. Se **modifica** ese requisito para que hable de la ventana del día, con dos escenarios nuevos (sábado después del cierre propio, y día cerrado).
- **Front — pantalla `/reservar`**: toma la cancha, la fecha y la hora del turno de la URL, muestra el turno y su precio, deja elegir cantidad de jugadores y equipamiento acotado al stock **de ese turno**, calcula el total a la vista y confirma mostrando el código. La ruta ya está protegida en `apps/web/proxy.ts`, así que sin sesión redirige a `/ingresar`.
- **Sin cambios de contrato ni de esquema de base**: `POST /reservas`, `CrearReservaRequest`, los modelos `Reserva` y `ReservaEquipamiento` y el índice `ux_reserva_slot_activo` ya existen. **No es BREAKING.**

**Fuera de alcance:**

- **El mail de confirmación** (RF-08): es del ítem 1.4, dueño de la capacidad `notificaciones`. Mandarlo desde acá además obligaría a cambiar la interfaz `Correo`, porque `enviar()` hoy devuelve `void` y la spec de `notificaciones` pide guardar el identificador que devolvió el proveedor. `design.md` deja señalado el punto exacto donde 1.4 engancha el envío. **Hueco consciente**: entre que entra este cambio y entra 1.4, crear una reserva no manda mail.
- `GET /reservas`, el detalle y la cancelación (1.4). El ABM de canchas y equipamiento y el reenvío (1.6).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `reservas`: se **agrega** el requisito de la **pantalla de reserva** (turno tomado de la URL, equipamiento con el stock del turno, total a la vista, errores de negocio mostrados sin perder lo cargado, confirmación con el código) y se **modifica** el requisito *Turno dentro de la grilla y del horario de atención (RN-09)* para que contemple la ventana de cada día y los días cerrados, como ya hace `disponibilidad`. Los otros siete requisitos de creación **no cambian**: se implementan tal cual. Los cuatro de listado, detalle y cancelación son del ítem 1.4 y **no se tocan**.

## Impact

- **`apps/api/src`**: módulo nuevo `reservas/` (controlador, servicio, DTO, generador de código y mapeadores). `configuracion.ts` suma cuatro variables. Se reutiliza sin reescribir: `common/usuario-actual.ts`, `common/decoradores.ts`, `common/error-de-api.ts`, `common/reloj.ts`, `common/horario.ts`, `common/grilla.ts`, `common/fechas.ts` y los mapeadores de `catalogo/`.
- **`apps/api/test`**: `reservas.e2e-spec.ts`, con un caso por escenario, incluido el de dos `POST` en paralelo. Los e2e siguen corriendo en serie.
- **`apps/web`**: `app/reservar/` (página, formulario y server action). `lib/api/types.ts` puede sumar alias del contrato. **No se regenera `schema.d.ts`**: el contrato no cambia.
- **`contratos/openapi.yaml`**: sin cambios.
- **Base de datos**: sin migración.
- **`.github/workflows/ci.yml`**: sin cambios; las cuatro variables tienen default.
- **Docs, en el mismo PR**: `README.md` y `apps/api/.env.example` documentan las variables; `docs/estado-del-proyecto.md` marca el ítem 1.3 con su responsable y pasa las operaciones con endpoint a 9 de 18; `docs/memoria-proyecto.md` suma la decisión y la línea del historial; `docs/requisitos.md` §8 reemplaza la letra por el nombre.
- **Riesgo conocido**: RN-05 (stock de equipamiento) no tiene restricción en la base. Se trata en `design.md`.
