# Design

## Context

Ver `proposal.md` para la motivación. Lo que condiciona el cómo, verificado en el repositorio y no supuesto:

- **El modelo `Usuario` ya tiene todo lo editable**: `nombre`, `apellido`, `email` (con `@unique`), `telefono` opcional, `passwordHash`, más `rol` y `activo`, que no se tocan acá. **No hace falta migración.**
- **El JWT lleva `sub` (el id) y `rol`, no el mail.** Está verificado en `apps/api/test/auth.e2e-spec.ts`, donde el payload se valida contra `body.usuario.id`. Es lo que permite que cambiar el mail no invalide la sesión.
- **El `ValidationPipe` global ya está en `whitelist: true, forbidNonWhitelisted: true`** (`common/validacion.ts`). Un `rol` o un `activo` de más en el body dan 400 **sin escribir una línea**: el escenario "Intento de cambiar el rol" sale del pipe que ya existe.
- **El registro ya hashea con bcrypt** y ya resuelve el choque de mail duplicado. Este cambio reutiliza las dos piezas en vez de inventarlas.
- **`@UsuarioActual()` y los guards globales ya existen** (decisión 23 de la memoria). El titular sale del token sin código nuevo.
- **El front ya tiene el patrón**: `app/(auth)/acciones.ts` con `useActionState`, `Campo` con la relación ARIA armada, `EstadoError` con reintento, y `proxy.ts` para rutas privadas.

## Goals / Non-Goals

**Goals:**

- Que un socio pueda corregir sus datos y rotar su contraseña sin depender de un administrador.
- Que sea **imposible por construcción** tocar la cuenta de otra persona, no por una validación que alguien pueda olvidar.
- Que el menú del socio deje de ser el del visitante.

**Non-Goals:**

- Recuperar una contraseña olvidada. Quien no puede entrar no llega a esta pantalla; necesita mails con token y vencimiento, y es una feature propia.
- Que un ADMIN edite a otros usuarios. Es del ítem 1.6.
- Revocar sesiones al cambiar la contraseña. Ver los riesgos.

## Decisions

### 1. Las rutas cuelgan de `/auth/`, no de `/usuarios/{id}`

`PATCH /auth/perfil` y `PUT /auth/password`. El usuario afectado es siempre el del token, leído con `@UsuarioActual()`.

El criterio: si la ruta llevara un id, habría que validar en cada operación que ese id es el de quien pide, y esa validación es justo la que alguien se olvida. Sin id en la ruta **no hay nada que validar**: no existe forma de expresar "el perfil de otro". Es el mismo razonamiento por el que el ítem 1.3 saca el titular del token y nunca del body.

*Alternativa descartada*: `PATCH /usuarios/{id}` con chequeo de pertenencia. Es la forma más REST y la que haría falta si un ADMIN pudiera editar a otros, pero eso es 1.6 y esa operación puede sumarse ahí sin tocar esta.

### 2. `PATCH` con todos los campos opcionales, y un body vacío es un error

Es una actualización parcial: quien cambia solo el teléfono manda solo el teléfono. Por eso `PATCH` y no `PUT`, que obligaría a reenviar todo y a que el front conozca datos que no está tocando.

Un body sin ningún campo devuelve **400** en lugar de 200. Un 200 ahí sería un éxito silencioso: la persona cree que guardó algo y no guardó nada.

### 3. El mail es el único caso de unicidad, y se resuelve con la base

El choque se detecta por el `@unique` de la columna, capturando el `P2002` de Prisma, no con un `findFirst` previo. El pre-chequeo no garantiza nada —entre el `SELECT` y el `UPDATE` entra otra solicitud— y la base ya tiene la restricción. Es el mismo criterio que la spec exige para RN-01 en reservas: la garantía la da la base, no la validación previa.

Se devuelve **409 `MAIL_YA_REGISTRADO`**, el mismo tipo que ya usa el registro, para que el front no tenga que aprender un caso nuevo.

### 4. La contraseña va en su propia operación

`PUT /auth/password` con la actual y la nueva, y **204** sin cuerpo: no hay nada útil que devolver.

Va separada del `PATCH` por dos razones. Una, exige un dato que el resto no necesita —la contraseña actual—, y meterla en el mismo request obligaría a pedirla también para cambiar un teléfono. Dos, el 401 por contraseña actual incorrecta no se confunde con el 409 por mail duplicado: cada operación tiene su modo de fallar.

La verificación reutiliza el mismo `bcrypt.compare` del login.

### 5. Cambiar el mail no reemite el token

El JWT lleva `sub` y `rol`; ninguno cambia al editar el mail, así que el token sigue siendo válido y no hay que reemitirlo ni forzar un login. **La pantalla sí tiene que avisar** que a partir de ahí se entra con el mail nuevo: es el tipo de cambio que la persona olvida y descubre cuando no puede entrar.

### 6. Front: dos formularios separados en una pantalla

`/perfil` es un Server Component que pide `GET /auth/perfil` y pasa los datos a dos Client Components con `useActionState`, uno por operación, siguiendo el patrón de `app/(auth)/acciones.ts`. Separados porque son dos operaciones con dos modos de fallar: un error de contraseña no puede borrar lo que la persona escribió en sus datos, ni al revés.

Los campos de contraseña se vacían después de cada intento, salga bien o mal. No hay `defaultValue` que reponer: nunca se muestran de vuelta.

### 7. El menú del socio

`navegacionPara()` ya decide por rol; solo cambia la lista de `SOCIO`: Disponibilidad, Mis reservas, Contacto y Mi perfil. Inicio y El club salen del menú pero **no del sitio**: las dos páginas siguen respondiendo, e Inicio queda alcanzable desde el logo, que ya enlaza a `/`. El delta de la spec `institucional` lo deja escrito con un escenario propio, para que nadie lo lea como que El club dejó de existir.

## Risks / Trade-offs

- **[Cambiar la contraseña no cierra las sesiones abiertas en otros dispositivos]** → El JWT es autocontenido y no hay almacén de sesiones, así que un token ya emitido sigue valiendo hasta que vence (`JWT_EXPIRES_IN`). Quien cambia su contraseña porque sospecha que alguien la tiene **no** está expulsando a esa persona. Cerrarlo de verdad exige una lista de revocación o versionar el token por usuario, que es un cambio de modelo y no entra acá. Se declara en la spec y se documenta; la mitigación práctica es que la vigencia del token sea corta.
- **[El front deja de ofrecer El club a quien tiene sesión]** → Es la consecuencia buscada del menú acotado, pero es una página que existe y pierde su única vía de acceso desde la interfaz. Si molesta, la alternativa barata es dejarla en el pie, que ya aparece en las páginas públicas.
- **[Es la primera ampliación del contrato del proyecto]** → Hasta acá todos los ítems implementaron operaciones ya definidas. Sumar dos obliga a regenerar `apps/web/lib/api/schema.d.ts` y a que `contrato:lint` pase, y conviene que los cuatro revisen los schemas nuevos antes de implementar.
- **[Alcance nuevo, fuera de los quince RF]** → Decidido a propósito. El riesgo real no es técnico: es de reparto, porque suma trabajo a quien ya tiene la mayor parte de los commits.

## Migration Plan

No hay migración de base: todos los campos editables ya existen en `Usuario`. El contrato crece de forma aditiva, así que ningún consumidor deja de funcionar. Se despliega con el merge del PR; si algo falla se revierte el merge, sin rastros en la base más allá de los datos que los usuarios hayan editado, que son válidos.

## Open Questions

- **¿El equipo quiere numerar esto como un requisito funcional nuevo en `docs/requisitos.md`?** No hace falta para implementar, pero cambia cómo se presenta el TP. Se decide antes del PR.
