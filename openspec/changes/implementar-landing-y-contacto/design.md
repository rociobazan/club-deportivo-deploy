# Design

## Context

Ver `proposal.md` para la motivación. Lo que condiciona el cómo:

- **La spec `institucional` ya fija todo**: contenido mínimo de las tres páginas, que rendericen completas con la API caída (datos de la API solo si degradan en silencio en 2 segundos), accesibilidad (375 px sin desborde, Lighthouse ≥ 90, sin animaciones con `prefers-reduced-motion`), y `POST /contacto` con campo trampa y **5 solicitudes por minuto por IP**.
- **`notificaciones` exige que en test el cliente de mail sea un doble** sin red. Nadie escribió todavía ese cliente: 1.4 (RF-08) no arrancó. Este cambio lo crea y 1.4 lo reutiliza.
- **Este cambio se apoya en el #20** (y por él en el #19): `GET /canchas` para los precios opcionales de Inicio, guards, `ErrorDeApi`, filtro, configuración, `EstadoError`, Server Functions con `useActionState` y el patrón de `acciones.ts` del ingreso.
- **Contenido del prototipo** (`docs/claude-design/Deploy Club.dc.html`): hero "Salí a jugar." / "Tres deportes, un solo turno por reservar"; "Seis canchas de tenis, pádel y fútbol 5 en el corazón de barrio General Paz. Turnos de 8 a 23, todos los días, y la cancha lista cuando llegás."; historia ("Deploy abrió en 2009 con dos canchas de tenis y una parrilla…"); instalaciones ("Vestuarios con agua caliente…"); "Reservá en treinta segundos"; "Un club chico que funciona como uno grande"; "Escribinos o pasá a conocer el club"; datos: Rivadeo 1480, Barrio General Paz, Córdoba · 351 482 7719 · hola@clubdeploy.com.ar · todos los días de 8 a 23 · buffet hasta el último turno. Remitente `turnos@clubdeploy.com.ar`.
- Verificado en este entorno: `@nestjs/throttler` 6.7.1 declara soporte para Nest 12; `resend` 6.30.0 pide Node ≥ 20 (tenemos 24); hay Chrome en `C:\Program Files\Google\Chrome\Application` para correr Lighthouse en headless; `globals.css` no tiene ninguna regla de movimiento reducido.

## Goals / Non-Goals

**Goals:**

- Cumplir los cinco requisitos de `institucional` y el agregado, con un test por escenario del lado de la API y verificación manual más Lighthouse del lado del sitio.
- Dejar `CorreoService` y su doble listos para que 1.4 mande los mails de reserva sin volver a decidir proveedor, remitente ni cómo se testea.

**Non-Goals:**

- Persistir nada del contacto: no hay tabla y la spec no la pide. El mail es el registro.
- Plantillas HTML de mail con React Email. `resend` acepta `text`; alcanza para el contacto y para 1.4 si quiere.
- Rate limiting global. Solo `POST /contacto` lo necesita hoy; el `ThrottlerGuard` se aplica ahí, no como `APP_GUARD`.

## Decisions

### 1. `CorreoService` con Resend, y un doble cuando no hay clave o es test

`common/correo/`: la interfaz `Correo` (`enviar({ para, asunto, texto }): Promise<void>`), `CorreoResend` (SDK `resend`) y `CorreoDoble` (guarda los envíos en `enviados[]`, no toca la red). `CorreoModule` es global y elige la implementación con un factory: **doble** si `NODE_ENV === 'test'` o si no hay `RESEND_API_KEY` fuera de producción (con un aviso en el log al arrancar); **Resend** en el resto. En producción sin clave, el arranque corta.

*Por qué el doble también en desarrollo sin clave*: cada integrante puede levantar la API y probar el formulario sin pedir una clave de Resend; el log muestra el mail que se habría enviado.

*Alternativa descartada*: `nodemailer` con SMTP. El proyecto ya decidió Resend (`arquitectura.md`, memoria) y su SDK es una llamada.

### 2. Configuración del mail con defaults del prototipo

`MAIL_FROM` por defecto `turnos@clubdeploy.com.ar` y **`MAIL_CONTACTO`** (nueva, la casilla del club) por defecto `hola@clubdeploy.com.ar`. `RESEND_API_KEY` opcional fuera de producción (decisión 1). Se validan como mails al arrancar. Van a `.env.example` y al README.

### 3. Límite por IP con `@nestjs/throttler`, solo en `/contacto`

`ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 5 }] })` en `ContactoModule` y `@UseGuards(ThrottlerGuard)` en el handler. El `ThrottlerException` es un `HttpException` 429: el filtro global suma el caso y lo emite como `DEMASIADAS_SOLICITUDES` con el título y el detalle del ejemplo del contrato. La IP la toma el throttler de `req.ip`; detrás de un proxy hace falta `trust proxy` en Express, que se anota como pendiente de despliegue, no de este cambio.

*Alternativa descartada*: un contador en memoria propio. Son veinte líneas fáciles de escribir mal (limpieza de la ventana, IPv6); la librería ya lo resuelve y es lo que `requisitos.md` sugiere.

### 4. El campo trampa se trata en el servicio, no en el DTO

`ContactoDto` declara `sitioWeb` opcional (si no, el pipe lo rechazaría con 400 y le daría señal al bot). `ContactoService.enviar()` responde el mismo `ContactoResponse` en los dos casos y **solo llama a `Correo` cuando `sitioWeb` está vacío**. No se loguea el intento con el contenido del bot.

### 5. El mail de contacto va a la casilla del club con el remitente del sistema

`para: MAIL_CONTACTO`, `de: MAIL_FROM`, `replyTo: email del visitante`, asunto `Contacto desde el sitio · {nombre}`, y el texto con nombre, mail, teléfono y mensaje. Con `replyTo`, el club responde desde su casilla sin copiar nada. Si Resend falla, `POST /contacto` responde 502 `CORREO_NO_ENVIADO` con un título apto para la persona: a diferencia de RN-14 (reservas), acá el mail **es** la operación; si no salió, la persona tiene que saberlo.

### 6. Inicio, El club y Contacto son Server Components con contenido estático

El contenido vive en `lib/contenido-institucional.ts` (disciplinas con duración y canchas, instalaciones, servicios, pasos para reservar, historia), no en la API: RF-09 lo pide así para que el sitio se sostenga con la API caída. Los datos del club (dirección, teléfono, mail, horarios) pasan a `lib/club-datos.ts` y **el pie deja de tenerlos hardcodeados**: una sola fuente para el pie y para Contacto.

### 7. El precio "desde" en Inicio degrada en silencio

Inicio llama a `GET /canchas` con `timeoutMs: 2000`; por disciplina toma el mínimo `precioPorTurno` y lo muestra como "Desde $ 8.000 el turno". Cualquier `ApiHttpError` (timeout incluido) deja las tarjetas sin precio y no muestra nada (spec: "Precios sin respuesta de la API"). Es el único dato de la API en las tres páginas.

### 8. El formulario de contacto sigue el patrón de `acciones.ts`

Server Function `enviarContacto` con `useActionState`: valida en el servidor del sitio (nombre, mail, mensaje obligatorios; mensaje ≤ 1000), llama a `apiFetch('/contacto', { method: 'POST', timeoutMs: 2000 })`, y devuelve `{ enviado: true, mensaje }` o `{ errores, valores }` / `{ error, valores }`. El 429 se muestra con el `titulo` de la API. El campo trampa es un `<input name="sitioWeb">` fuera del flujo visual y del teclado (`aria-hidden`, `tabIndex={-1}`, `autoComplete="off"`), y el sitio lo reenvía tal cual a la API, que decide.

### 9. Movimiento reducido con una regla global

En `globals.css`: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important } }`. Cubre las animaciones de hoy (el esqueleto de carga) y las que vengan, sin recordar `motion-reduce:` en cada clase.

### 10. Lighthouse se corre en headless con el Chrome de la máquina

`npx lighthouse http://localhost:3001/ --only-categories=accessibility --chrome-flags="--headless=new" --output=json` contra el build de producción (`next build` + `next start`), no contra `next dev`, que inyecta overlays. Se deja el puntaje en la descripción del PR. No se agrega al CI: necesita Chrome y un servidor levantado, y la spec lo pide como auditoría, no como check.

### 11. Tests

- **API unitarios**: `ContactoDto` (mail `ana@` → rechaza; mensaje de 1001 → rechaza; `sitioWeb` opcional pasa), `ContactoService` con `CorreoDoble` (envío válido llama una vez con `para`, `replyTo` y el contenido; campo trampa responde 202 sin llamar; fallo del correo → 502), `CorreoModule` elige el doble en test.
- **API e2e** (`contacto.e2e-spec.ts`): "Mensaje válido" (202 y el doble tiene un envío a `MAIL_CONTACTO`), "Mail mal formado", "Mensaje demasiado largo", "Campo trampa completo" (202 y cero envíos), "Sexto envío en un minuto" (5×202 y el sexto 429 `DEMASIADAS_SOLICITUDES` sin envío). El doble se obtiene con `app.get(CORREO)` y se limpia entre tests.
- **Front**: verificación manual de los cinco escenarios del delta y de los tres de "Sitio institucional público" y "Sitio accesible y adaptable"; Lighthouse en `/`; las tres páginas con la API apagada.

## Risks / Trade-offs

- **[`resend` o `@nestjs/throttler` no cargan bajo ESM + `--experimental-vm-modules`]** → La primera tarea instala y corre un test que importa las dos y construye un `Resend` con clave falsa (sin red) antes de escribir nada encima.
- **[Throttler en memoria: el límite es por instancia de la API]** → Con una sola instancia (MVP) es exacto; con varias sería por réplica. Aceptable; se anota.
- **[Lighthouse depende del entorno local]** → Se documenta el comando; el resultado va al PR, no al CI.
- **[Mail real en desarrollo]** → Sin `RESEND_API_KEY` no se envía nada y el log lo dice; con clave, un integrante puede mandar mails reales a `hola@clubdeploy.com.ar` desde su máquina. Es lo esperado; se avisa en el README.

## Migration Plan

Sin migración. Las tres variables nuevas tienen valor por defecto (la clave es opcional fuera de producción), así que ningún `.env` deja de funcionar. Se despliega mergeando el PR después del #19 y el #20.

## Open Questions

Ninguna que cambie la spec o las tareas. `trust proxy` para que el límite por IP funcione detrás de un balanceador es un pendiente de despliegue (queda anotado en la memoria), no de este cambio.
