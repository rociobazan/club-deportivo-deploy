# Design

## Context

El motivo está en `proposal.md` y el comportamiento en `specs/autenticacion/spec.md`. Lo que condiciona el enfoque:

- **Nest es el único emisor de tokens de sesión** (decisión 22 y `arquitectura.md` §2). La recuperación no puede depender de un proveedor de identidad externo ni del front.
- **Ya existe todo lo de alrededor**: `CorreoModule` global con Resend en producción y `CorreoDoble` en test y en desarrollo sin clave (decisión 25), `GuardDeLimiteDeAuth` con throttlers con nombre acotados a `AuthModule` (decisión 37), el reenvío de la IP del visitante desde las Server Actions públicas (decisión 37) y `frontendUrl` en la configuración, que hoy usa CORS.
- **El login ya no revela qué cuentas existen** (decisión 11, con el hash señuelo para igualar tiempos). La recuperación tiene que mantener esa propiedad, y acá el riesgo es mayor: además de la base, hay un mail de por medio que tarda cientos de milisegundos.
- **No hay almacén de sesiones**: el JWT es autocontenido (decisión 30).

## Goals / Non-Goals

**Goals:**

- Que `POST /auth/recuperacion` sea indistinguible desde afuera para un mail registrado, uno inexistente y uno de una cuenta inactiva: mismo código, mismo cuerpo y mismo tiempo.
- Que un token robado de la base no sirva para nada, y que uno interceptado sirva por poco tiempo y una sola vez.
- Reutilizar el cliente de mail, el guard de límite y el patrón de Server Functions sin abstracciones nuevas.

**Non-Goals:**

- Una cola de trabajos persistente. El envío corre en segundo plano dentro del mismo proceso (decisión 3).
- Limpiar los tokens vencidos de la tabla. Ver "Open Questions".
- Un almacén de sesiones o una lista de tokens revocados. El cierre de sesiones de la decisión 10 alcanza con una columna.

## Decisions

### 1. Token aleatorio con hash SHA-256, no un JWT ni bcrypt

El token son 32 bytes de `crypto.randomBytes` codificados en base64url (43 caracteres). En la base se guarda `sha256(token)` en hexadecimal, con índice único, y se busca por ese hash.

- **Por qué no bcrypt**, que es lo que usan las contraseñas: bcrypt sirve para secretos de baja entropía que hay que hacer caros de adivinar. Un token de 256 bits no se puede adivinar, y con bcrypt no se puede buscar por hash (cada uno lleva su sal), así que habría que recorrer todos los tokens vigentes y compararlos de a uno.
- **Por qué no un JWT firmado** con vencimiento: no se puede usar una sola vez ni invalidar al pedir uno nuevo sin guardar estado en la base, y si hay que guardar estado, el JWT no aporta nada. Además alargaría el enlace del mail.
- **Por qué no guardarlo en claro**: con una copia de la base alcanzaría para tomar cualquier cuenta con un pedido de recuperación pendiente.

### 2. Una tabla propia, `token_recuperacion`

```
TokenRecuperacion
  id          Int       PK
  usuarioId   Int       FK → usuario.id, ON DELETE CASCADE, indexado
  tokenHash   Char(64)  UNIQUE
  expiraEn    DateTime
  usadoEn     DateTime? (null = sin usar)
  creadoEn    DateTime  default now(), indexado junto con usuarioId
```

- **Alternativa descartada: dos columnas en `usuario`** (`recuperacion_hash`, `recuperacion_expira`). Alcanzaría para "un token vigente por cuenta", pero no deja contar cuántos mails se mandaron en la última hora (decisión 5) sin una columna más, y mezcla un dato efímero con la cuenta.
- **"Invalidar" es marcar `usadoEn`**, no borrar. Así un token reemplazado y uno usado responden igual (`ENLACE_INVALIDO`) y quedan para contar el límite por hora.
- **El único borrado es el del token cuyo mail no salió**: ese token nunca llegó a nadie, así que no tiene que contar para el límite por hora ni dejar rastro (decisión 3).
- El índice `(usuario_id, creado_en)` es el que usa el conteo de la decisión 5.

### 3. La solicitud responde antes de trabajar: el envío va en segundo plano

`POST /auth/recuperacion` valida el cuerpo y responde 202 sin esperar nada más. La búsqueda de la cuenta, la generación del token y el envío del mail corren después, en una promesa que el controlador no espera, con un `catch` que registra la falla en el log.

- **Por qué**: si la respuesta esperara al mail, un mail registrado tardaría cientos de milisegundos más que uno inexistente, y eso revela la cuenta igual que un mensaje distinto. El hash señuelo del login (decisión 11) iguala una comparación de bcrypt, pero no puede igualar una llamada a Resend.
- **Alternativa descartada: esperar un tiempo fijo** antes de responder. Sigue filtrando cuando el proveedor tarda más que ese tiempo, y frena cada solicitud.
- **Alternativa descartada: una cola persistente**. Resuelve también los reintentos, pero es infraestructura nueva para un mail que la persona puede volver a pedir con un clic.
- **Costo aceptado**: si el proceso se cae entre la respuesta y el envío, el mail se pierde. La persona no recibe nada y lo vuelve a pedir. Una falla del proveedor tampoco se le informa a la persona: a diferencia de contacto (decisión 25, 502 `CORREO_NO_ENVIADO`), acá informarla revelaría que la cuenta existe.
- **Consecuencia para los tests**: los e2e de la API esperan a que el mail aparezca en `CorreoDoble.enviados` con un helper de espera acotada, en vez de leerlo apenas vuelve la respuesta.
- **Orden: crear, enviar y recién después invalidar los anteriores.** Si se invalidaran antes de enviar y el proveedor fallara, la persona se quedaría sin ningún enlace que sirva: el viejo ya no anda y el nuevo nunca llegó. Si el envío falla, el token nuevo se borra y los anteriores siguen como estaban.
- **Los anteriores son los de `id` menor**, no "todos menos el nuevo". Con "todos menos el nuevo", dos solicitudes que terminan casi juntas se invalidarían una a la otra y la persona quedaría con dos mails y ningún enlace válido. Con `id` menor, el `serial` decide cuál es el más nuevo y ese sobrevive.
- **El log no lleva el mensaje de la excepción**, solo su nombre y el id del usuario: el texto de un error de Prisma puede repetir los argumentos de la consulta (el mail), y el de Resend trae direcciones.

### 4. El restablecimiento es una sola transacción

`POST /auth/restablecimiento` busca el token por hash con `usadoEn IS NULL` y `expiraEn > ahora`, y dentro de una transacción marca como usados **todos** los tokens sin usar de esa cuenta y actualiza el `password_hash`.

- La marca se hace con un `updateMany` condicionado a `usadoEn IS NULL` sobre el token recibido, y se verifica que haya afectado una fila: dos solicitudes simultáneas con el mismo token no pueden cambiar la contraseña dos veces.
- "Ahora" sale de `Reloj` (decisión 24), así los e2e pueden probar el vencimiento sin esperar una hora.
- Una cuenta que pasó a inactiva después de pedir el enlace responde `ENLACE_INVALIDO`: no tiene sentido restablecer una contraseña con la que no se puede ingresar.

### 5. Dos límites: por IP y por cuenta

- **Por IP**: un throttler con nombre `recuperacion` en el `ThrottlerModule` de `AuthModule`, con `LIMITE_RECUPERACION_POR_MINUTO` (5 por defecto), aplicado a las dos operaciones con `GuardDeLimiteDeAuth`. Las rutas existentes suman `@SkipThrottle({ recuperacion: true })`, como ya hacen login y registro entre sí. El job `e2e` del CI lo sube a 1000, como los otros dos.
- **Por cuenta**: antes de emitir un token, se cuentan los tokens de esa cuenta creados en la última hora. Si llegan a `MAX_RECUPERACIONES_POR_HORA` (3 por defecto), no se emite ni se envía nada. Como la respuesta ya salió (decisión 3), no hace falta ningún cuidado extra para que sea idéntica.
- **El conteo y la creación van en una transacción que bloquea la fila del usuario** (`SELECT … FOR UPDATE`). Sin el bloqueo, cinco solicitudes simultáneas leen todas el mismo conteo antes de que ninguna inserte, y la cuenta recibe cinco mails. Se bloquea la fila de `usuario` y no la tabla de tokens: serializa solo las solicitudes de esa cuenta.
- **Alternativa descartada: un índice único** que impida el cuarto token. No hay forma de expresar "como máximo 3 por hora" con una restricción, y un `pg_advisory_xact_lock` haría lo mismo que el `FOR UPDATE` con una clave que hay que inventar.
- **Por qué los dos**: el límite por IP frena a quien prueba mails en masa, pero alguien con varias IPs igual podría llenarle la casilla a una víctima. El límite por cuenta es el mismo criterio que RN-16 para el reenvío de mails de reserva.

### 6. El enlace va al sitio, con el token en la query

El mail lleva `${frontendUrl}/restablecer?token=<token>`. El sitio lee el token del `searchParams` en el Server Component y lo manda en un campo oculto del formulario; la Server Function lo reenvía a la API.

- **Riesgo de la query**: el token puede quedar en el historial del navegador y en los logs de acceso. Se mitiga con la vigencia corta y el uso único, y Caddy ya manda `Referrer-Policy: strict-origin-when-cross-origin` (decisión 37), así que el token no sale en el `Referer` hacia otros orígenes. La página no carga recursos de terceros.
- **Alternativa descartada: el token en el fragmento** (`#token=`). No viaja al servidor ni queda en logs, pero obliga a leerlo con JavaScript en un componente cliente, y el resto del flujo de sesión está hecho con Server Components y Server Functions sin JavaScript obligatorio (decisión 23).
- `frontendUrl` ya es obligatoria en producción para CORS, así que no hace falta una variable nueva para armar el enlace.

### 7. El mail

- Asunto: `Restablecé tu contraseña de Deploy`. Texto plano, como los de reserva: saludo con el nombre, el enlace, cuánto dura, y la aclaración de que si no lo pidió puede ignorarlo y su contraseña no cambia.
- Remitente: `MAIL_FROM`, el mismo de todos los mails del sistema.
- El log registra el envío y las fallas con el id del usuario, nunca con el token ni con el enlace.

### 8. Front: dos pantallas en el grupo `(auth)`, sin sesión

- `app/(auth)/recuperar` y `app/(auth)/restablecer`, con la misma tarjeta que `/ingresar` y `/registro`, y Server Functions con `useActionState` en `app/(auth)/acciones.ts`, junto a las de ingreso y registro.
- **`/restablecer` pide la contraseña dos veces** y compara en la Server Function, sin llamar a la API si no coinciden. La API recibe una sola: la repetición es una ayuda de la pantalla, porque a diferencia de `/perfil` acá la persona no tiene otra forma de entrar si se equivoca al tipear.
- Después de un restablecimiento aceptado, la Server Function redirige a `/ingresar?restablecida=1` y la página de ingreso muestra el aviso. Es un flag de presentación: no da acceso a nada.
- Las dos rutas no van en el `matcher` de `proxy.ts`: son públicas.
- Las Server Functions reenvían la IP del visitante con `encabezadosDelVisitante()`, igual que ingreso y registro, para que el límite por IP sea por visitante.

### 9. Qué cubre cada tipo de test

- **Unitarios del servicio**: generación y hash del token, vencimiento contra `Reloj`, invalidación de los anteriores y límite por cuenta.
- **e2e de la API**: un `it` por escenario de la spec. Leen el enlace del `CorreoDoble`, así que prueban el camino completo, incluido el mail.
- **Playwright**: el link desde `/ingresar`, el pedido en `/recuperar` (mismo mensaje con mail registrado y sin registrar), las contraseñas que no coinciden, un token inválido y `/restablecer` sin token. **El camino feliz de punta a punta no va en Playwright**: el navegador no tiene cómo leer el mail del doble, que vive en el proceso de la API, y abrirle un endpoint de test o darle acceso a la base sería sumar superficie solo para esto. Ese camino lo cubre el e2e de la API.

### 10. Cerrar sesiones firmando en el token el último cambio de contraseña

Sumado durante la revisión del PR, a pedido del equipo. `usuario` suma `password_cambiada_en` (timestamp con milisegundos, nullable). `PUT /auth/password` y `POST /auth/restablecimiento` la ponen en "ahora" en la misma escritura que el hash nuevo. El login lee esa columna **en la misma consulta que el hash** y, si tiene valor, la firma en el token como `cambioPassword` (milisegundos). El guard global de JWT, después de verificar la firma, lee la columna por clave primaria y **rechaza el token si el valor firmado no es exactamente el de la base**.

- **Por qué el valor firmado y no la fecha de emisión (`iat`).** La primera versión comparaba `iat` con la columna y tenía dos huecos, que marcó una revisión de seguridad: `iat` va en segundos, así que un token emitido en el mismo segundo pero antes del cambio sobrevivía; y, peor, había una carrera en el login: si comprobaba la contraseña vieja justo antes de un restablecimiento y firmaba el token justo después, ese token tenía un `iat` posterior al cambio y pasaba. Con el valor leído junto con el hash, el token dice **qué contraseña** se comprobó, no cuándo se firmó, y no hay ventana.
- **El reingreso del perfil sirve** porque lee el valor nuevo junto con el hash nuevo.
- **`null` es "nunca cambió"**: sirve el token que no trae `cambioPassword`, que es como son todos los emitidos antes de esta columna. Por eso el deploy no desloguea a nadie, la migración no necesita completar datos y los e2e que firman tokens a mano sin ese dato siguen andando.
- **Si el usuario del token no existe, el guard no decide**: deja pasar como hasta ahora y la operación responde lo que corresponda (`GET /auth/perfil` ya devuelve 401). Rechazarlo en el guard cambiaría el comportamiento de los endpoints de prueba de `base.e2e-spec.ts`, que firman tokens de usuarios inventados, sin ganar nada: no hay forma de borrar un usuario desde la API.
- **En un endpoint público**, un token anterior al cambio se trata como anónimo, igual que uno vencido (decisión 24 del cambio de catálogo).
- **Costo**: una consulta por clave primaria en cada solicitud con token. Es el punto donde conviene cachear si alguna vez pesa, por ejemplo con una caché en memoria de pocos segundos por usuario; hoy no hay un problema medido que lo justifique.
- **Alternativa descartada: un contador de versión** (`ver` en el payload, comparado con un entero en `usuario`). Es la misma idea que la elegida, pero un contador que arranca en 0 obliga a que todo token traiga la versión: los ya emitidos no la tienen, así que el deploy deslogueaba a todos y había que reescribir el armado de tokens de cuatro suites e2e. Con la fecha, la ausencia del dato coincide con `null` y nada de eso pasa.
- **Alternativa descartada: una lista de tokens revocados.** Hay que guardar cada token emitido o un identificador por token, y limpiarla. Es un almacén de sesiones, que el proyecto evitó a propósito (decisión 23).
- **El perfil no pierde la sesión**: la Server Function de `/perfil`, que tiene la contraseña nueva en la mano, vuelve a llamar a `POST /auth/login` después del 204 y reemplaza la cookie. No hace falta cambiar el contrato de `PUT /auth/password` para que devuelva un token. El mail para ese reingreso se lee del perfil **antes** del cambio, porque después el token viejo ya no sirve.

## Risks / Trade-offs

- [El envío en segundo plano se pierde si el proceso se reinicia] → La persona lo vuelve a pedir. Se loguea el inicio y el fin de cada envío para poder diagnosticarlo.
- [Un token interceptado sirve hasta que vence o se usa] → Vigencia de 60 minutos, uso único, y un enlace nuevo enviado invalida los anteriores.
- [El throttler en memoria cuenta por réplica] → Igual que contacto, login y registro: hoy hay una sola instancia. El límite por cuenta vive en la base y no tiene este problema.
- [Una consulta más por cada solicitud autenticada] → Por clave primaria y de una sola columna. Ver decisión 10 sobre cuándo cachear.
- [Un token emitido con la contraseña nueva queda atado a ese cambio] → Es lo buscado: un cambio posterior lo cierra. La comparación es por igualdad de un valor guardado, no por relojes, así que varias réplicas con relojes distintos no la afectan.
- [La tabla crece con tokens vencidos] → Con 3 por cuenta y por hora como máximo, crece despacio. Ver "Open Questions".

## Migration Plan

1. Migración aditiva de Prisma: crea `token_recuperacion` con su FK y sus índices. No toca datos existentes, así que el deploy la aplica con el `prisma migrate deploy` de siempre (decisión 38).
2. Otra migración aditiva suma `usuario.password_cambiada_en`, nullable y sin valor por defecto: las cuentas existentes quedan en `null` y ninguna sesión abierta se cierra al desplegar.
3. Las tres variables nuevas tienen valor por defecto: no hace falta tocar el `.env` de producción para desplegar. Se documentan en `apps/api/.env.example` y en `deploy/.env.example`.
4. Rollback: revertir el PR. La tabla y la columna quedan sin uso y se pueden borrar con una migración posterior; no hay datos de negocio que migrar de vuelta.

## Open Questions

- **Limpieza de tokens viejos**: un borrado periódico de los vencidos hace más de un día. No cambia el comportamiento ni la spec, y hoy el volumen no lo justifica; se anota como pendiente en `estado-del-proyecto.md`.
