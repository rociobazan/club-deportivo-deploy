# Design

## Context

Ver `proposal.md`. Hechos verificados en el repo que condicionan el cómo:

- `@nestjs/throttler` 6.7.1 identifica al cliente con `req.ip`, y Express calcula `req.ip` a partir de `X-Forwarded-For` solo si `trust proxy` está activo. Hoy no lo está.
- En la pila de producción (`deploy/docker-compose.prod.yml`) el puerto 3000 de la API no se publica: a la API solo llegan `caddy` (llamadas directas a `/api/v1`) y `web` (Server Actions). Caddy, desde la 2.5, descarta el `X-Forwarded-For` que trae un cliente no confiable y lo reemplaza por su IP real.
- El front no tiene runner unitario: `destino-seguro.ts` dice "para poder probarlo con Node a secas", pero nunca tuvo test. El único que hay es el escenario de Playwright del destino externo.
- La suite de Playwright ingresa unas 25 veces desde `127.0.0.1` en uno o dos minutos (login por API en `admin.spec.ts` y `mis-reservas.spec.ts`, por pantalla en los demás).
- bcrypt usa solo los primeros 72 bytes de la contraseña.

## Decisions

1. **`trust proxy` en `1`, no `true` ni una lista de subredes.** Un salto es exactamente lo que hay en producción, y `true` haría confiar en cualquier `X-Forwarded-For` que llegue por un camino sin proxy. Las Server Actions mandan la **última** entrada del `X-Forwarded-For` que recibió Next (la que puso Caddy), validada como IPv4 o IPv6; sin encabezado no mandan nada y la API cuenta la IP del socket, como en local. Alternativa descartada: `['loopback', 'uniquelocal']`, equivalente en la práctica pero más opaco de leer.
2. **Límites de login y registro con `ThrottlerModule` acotado a `AuthModule`** y un guard propio con su texto, igual que contacto (decisión 25 de la memoria). Los números van a `configuracion.ts` con default (10 y 5 por minuto) porque el check `e2e` del CI se pondría en rojo con los valores reales; el job los sube. Se eligió configurarlos antes que subirlos para todos: 10 intentos por minuto por IP frenan un diccionario sin molestar a una persona que se equivoca de contraseña.
3. **`destinoSeguro` con dos filtros y una resolución.** Primero se rechaza lo que ningún destino legítimo tiene (`\`, caracteres de control, `//`); después `new URL(valor, origen)` y se exige el mismo `origin`. Lo primero cubre lo que los navegadores normalizan antes de resolver (`/\evil.com` → `//evil.com`); lo segundo, cualquier otra forma de escaparse. Se prueba con `node --test`, nativo de Node 24, sin dependencias nuevas; el paso va al job `web`.
4. **Cuenta inactiva: el mismo 401 genérico.** Un 403 propio contaría que la cuenta existe y cambiaría el contrato. Como nada en la API puede poner `activo` en `false` (nota del 2026-10-04), esto es una defensa por si se cambia en la base. La comparación con bcrypt se hace igual, para no cambiar el tiempo de respuesta.
5. **HSTS solo cuando el host no es `localhost`.** El `Caddyfile` se prueba en local con `DOMINIO=localhost` y HSTS se aplica por host, sin mirar el puerto: dejaría al navegador exigiendo HTTPS también en `localhost:3001` de desarrollo durante un año.
6. **Largos máximos en los DTOs y no en la base.** `email` 120 y `password` 72, también en la contraseña actual de `PUT /auth/password`: una más larga nunca pudo coincidir con un hash más allá del byte 72, y bcrypt las comparaba igual. No hay usuarios reales todavía, así que nadie queda afuera.

## Risks / Trade-offs

- Dos visitantes detrás del mismo NAT comparten los límites. Es "por IP"; aceptado.
- En local, `curl` con un `X-Forwarded-For` inventado puede elegir su IP. No hay proxy en local; aceptado.
- El contador del throttler es en memoria: con varias réplicas sería por réplica (ya dicho en la decisión 25).
