# ADR 0003 — Despliegue en una instancia EC2 con Docker Compose

**Fecha:** 2026-10-05
**Estado:** aceptada
**Decide:** Jeremías

## Contexto

La cátedra pide desplegar el sistema en AWS EC2. El repositorio ya es un monorepo con npm
workspaces (`apps/api` y `apps/web`), y eso no cambia.

Lo que condiciona el despliegue sale del código, no de la plataforma:

- **El front necesita un servidor.** La sesión es una cookie `httpOnly` que solo lee el
  servidor de Next (`apps/web/lib/sesion.ts`), las escrituras son Server Actions y `proxy.ts`
  protege las rutas privadas. Un hosting estático (S3) no sirve sin rehacer la autenticación,
  y se descartó por eso.
- **La cookie es `Secure` con `NODE_ENV=production`.** Sin HTTPS el navegador la descarta y
  nadie puede ingresar.
- **La API exige `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL` y `RESEND_API_KEY` en
  producción** (`apps/api/src/configuracion.ts`), o no arranca.
- **Resend solo envía a terceros desde un dominio verificado.** Sin dominio propio, los mails
  de confirmación, cancelación y contacto no llegan.
- **El seed no corre con `NODE_ENV=production`**, a propósito: carga cuentas con una
  contraseña que está en el repositorio. Producción arranca con la base vacía.
- **El build de Next no entra en una instancia chica.** Una `t3.micro` (1 GiB, capa gratuita)
  se queda sin memoria compilando el front.

## Decisión

**Una sola instancia EC2 con Docker Compose: `db`, `api`, `web` y `caddy`, publicada en
`clubdeploy.online`. Las imágenes se construyen en GitHub Actions, se publican en GHCR y la
instancia solo las descarga.**

```
                     ┌──────────────── EC2 (Elastic IP) ────────────────┐
Navegador ──443────► │ caddy ──/api/*──► api (node dist/main :3000)     │
clubdeploy.online    │   │                │                             │
                     │   └──/──────────► web (next start :3001)          │
                     │                    │ API_URL=http://api:3000/api/v1
                     │                  db (postgres:17, volumen, sin puertos)
                     └───────────────────────────────────────────────────┘
```

### Dominio y HTTPS

- **`clubdeploy.online`**, comprado en Porkbun el 2026-10-05 por un año, **sin renovación
  automática**: el proyecto no se mantiene después de la entrega.
- **Los DNS quedan en Porkbun**: un registro `A` a la Elastic IP para el sitio, y los
  registros SPF, DKIM y DMARC que pide Resend. No hace falta delegar a otro proveedor.
- **Caddy saca y renueva solo el certificado de Let's Encrypt** para `clubdeploy.online`.
  Necesita los puertos 80 y 443 abiertos en el security group.

### La API es pública

Caddy expone `/api/*` hacia Nest, así que el contrato se puede probar con `curl` contra
`https://clubdeploy.online/api/v1`. El front no la necesita así: habla con la API por la red
interna de Compose. `FRONTEND_URL` es `https://clubdeploy.online`, el mismo origen.

### Mails

Resend con el dominio verificado. En el `.env` de la instancia, `MAIL_FROM` es
`turnos@clubdeploy.online` y `MAIL_CONTACTO` es una casilla del equipo que pueda leer los
mensajes del formulario. El código no cambia: las dos ya se leen del entorno.

### Datos iniciales

Un script de carga para producción, separado del seed:

- Carga el **catálogo** (disciplinas, canchas y equipamiento) y crea **un administrador** con
  `ADMIN_EMAIL` y `ADMIN_PASSWORD` tomados del entorno. No crea socios de prueba.
- **Volver a correrlo no cambia nada de lo que ya existe.** El catálogo se carga solo si la
  base no tiene ninguna disciplina: a diferencia del seed, no lo pone "al día", porque en
  producción el admin cambia precios, stock y nombres desde el panel y recargar el archivo
  se los pisaría, o crearía una cancha nueva con el nombre viejo de una renombrada. Si el
  administrador ya existe, no le cambia la contraseña.
- Corre **una vez, a mano**, después del primer deploy. No forma parte del deploy automático.
- El seed de desarrollo sigue igual y sigue bloqueado en producción.

### Imágenes y deploy

- **Dos jobs en `ci.yml`**, que corren solo en push a `main` y después de que `e2e` pasa:
  `imagenes` construye `api` y `web` y las publica en GHCR con el SHA del commit como tag, y
  `deploy` entra por SSH a la instancia para hacer `pull` y `up -d`. **Van separados para que
  la clave SSH nunca comparta runner con actions de terceros**: las de Docker corren en
  `imagenes`, que tiene permiso de publicar paquetes pero no la clave; `deploy` tiene la clave
  y solo usa `actions/checkout` y comandos propios. Las actions de Docker además van fijadas
  por SHA.
- **Los dos jobs esperan a la variable del repo `DEPLOY_HABILITADO=true`.** Hasta que la
  instancia y los secretos estén listos, figuran como omitidos y no en rojo: la consigna
  evalúa las ejecuciones en verde, y un deploy contra una instancia que no existe fallaría
  en cada merge a `main`.
- **Las migraciones corren en cada deploy**, con `prisma migrate deploy` antes de levantar la
  API nueva. Si fallan, el deploy se corta y queda corriendo la versión anterior.
- **Después de `up -d`, el job comprueba que `https://clubdeploy.online/api/v1` responda.**
  Si no responde, el job queda en rojo.
- **Volver atrás** es redesplegar el tag de un commit anterior.

### Secretos

- **Los de la aplicación viven solo en la instancia**, en un `.env` con permisos `600`:
  `JWT_SECRET`, `JWT_EXPIRES_IN`, `RESEND_API_KEY`, la contraseña de Postgres y las
  variables de horario.
- **GitHub guarda solo lo necesario para entrar por SSH**: `EC2_HOST`, `EC2_USER`,
  `EC2_SSH_KEY` y `EC2_KNOWN_HOSTS`. El último es la huella de la instancia: el CI no la pide
  con `ssh-keyscan` en cada corrida, así que una máquina que se hiciera pasar por la
  instancia no recibe el deploy. Los carga Rocío, que es la administradora del repositorio,
  igual que la variable `DEPLOY_HABILITADO`.
- **`ADMIN_PASSWORD` no se guarda en el `.env`**: se pide por consola la única vez que se
  corre la carga inicial.

## Alternativas consideradas

| Opción | Por qué no |
|---|---|
| **S3 para el front** | Solo sirve archivos estáticos. Obliga a sacar el JWT de la cookie `httpOnly` y reescribir todas las Server Actions, y la API y la base igual necesitan otro hosting. |
| **Construir las imágenes en la instancia** (`git pull` + `docker compose build`) | Más simple, pero el build de Next no entra en 1 GiB, y una instancia más grande sale de la capa gratuita. |
| **RDS para PostgreSQL** | Más robusto y con backups automáticos, pero suma un servicio, una red y un costo que una demo no necesita. |
| **Amplify para el front + EC2 para la API** | Amplify soporta Next con servidor y monorepos, pero son dos plataformas y dos deploys que coordinar. |
| **Nginx + Certbot** | Funciona, pero hay que renovar el certificado aparte. Caddy lo hace solo. |
| **`sslip.io` en lugar de dominio** | Da HTTPS sin comprar nada, pero no resuelve los mails y la URL depende de la IP. |
| **Gmail por SMTP en lugar de dominio** | Envía a cualquiera sin dominio, pero obliga a sumar una dependencia y un proveedor de mail nuevo en el código. |
| **`clubdeploy.com.ar` en NIC Argentina** | Mejor reputación para los mails, pero más caro que un `.online` para un proyecto de un año. |
| **Cargar el admin por SQL a mano** | No agrega código, pero no es reproducible. Si hay que levantar la base de cero, hay que acordarse los pasos. |

## Consecuencias

- **Archivos nuevos:** un `Dockerfile` por app, `docker-compose.prod.yml`, un `Caddyfile`, el
  script de carga para producción y los jobs `imagenes` y `deploy` en
  `.github/workflows/ci.yml`. El
  `docker-compose.yml` actual sigue siendo solo para desarrollo.
- **`imagenes` y `deploy` no son checks obligatorios** de la protección de `main`: corren después del
  merge, no en los PRs.
- **Variables del front:** todas las páginas son dinámicas (verificado con `next build`), así
  que el servidor de Next lee `API_URL` y las variables de horario en cada request y la
  imagen no depende del entorno. Si una página pasa a ser estática, sus variables quedarían
  fijadas en el build.
- **Memoria:** cuatro contenedores en 1 GiB es justo. La instancia lleva 2 GiB de swap.
- **Spam:** un `.online` tiene peor reputación que un `.com` o un `.com.ar`. Antes de la demo
  hay que mandar una prueba a una casilla de Gmail y revisar que no caiga en spam.
- **Vencimiento:** el dominio vence en octubre de 2027 y no se renueva. Después de esa fecha,
  el sitio y los mails dejan de funcionar.
- **Backups:** no hay automáticos. Un `pg_dump` manual antes de cada migración riesgosa.
- **Lo que hace una persona y no el CI:** crear la cuenta de AWS, lanzar la instancia con su
  Elastic IP, cargar los registros DNS en Porkbun, verificar el dominio en Resend, armar el
  `.env` de la instancia, cargar los secretos de GitHub y correr el script de carga la
  primera vez. Va paso a paso en `docs/despliegue.md`.

## Referencias

- `docs/arquitectura.md` §2: Nest es el único emisor de tokens y el front es intermediario.
- `docs/memoria-proyecto.md`, decisiones 11 y 12 (sesión y autorización) y la del cliente de
  mail (`common/correo/`).
- ADR 0002: los e2e del CI ya levantan la pila entera, así que el deploy depende de ellos.
