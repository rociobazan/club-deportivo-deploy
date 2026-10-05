# Despliegue en AWS EC2

Paso a paso para dejar el sistema publicado en `https://clubdeploy.online`. El porqué de cada
decisión está en el [ADR 0003](adr/0003-despliegue-en-ec2.md).

Una vez hecha la puesta en marcha, **cada merge a `main` con el CI en verde se despliega solo**
(jobs `imagenes` y `deploy` de [`ci.yml`](../.github/workflows/ci.yml)). Lo de abajo se hace una sola vez, a
mano, porque son cuentas, credenciales y recursos que el CI no puede crear.

```
GitHub Actions ──build──► GHCR (imágenes api y web, tag = SHA)
      │                          │ pull
      └──ssh──► EC2 /opt/club: docker compose ─ caddy ─┬─ web ─┐
                                                       └─ api ─┴─ db (volumen)
```

## 1. Instancia EC2

1. En la consola de AWS, **EC2 → Launch instance**:
   - Imagen: **Ubuntu Server 24.04 LTS**.
   - Tipo: el que la consola marque como elegible para la capa gratuita (`t3.micro` o similar).
   - Par de claves: crear uno nuevo y guardar el `.pem`. Es para entrar a mano, no para el CI.
   - Disco: 20 GiB. Las imágenes y la base no entran cómodas en los 8 GiB por defecto.
2. **Security group**, reglas de entrada:

   | Puerto | Origen | Para qué |
   |---|---|---|
   | 22/tcp | 0.0.0.0/0 | SSH. Los runners de GitHub no tienen IP fija; la seguridad la da que solo se entra con clave |
   | 80/tcp | 0.0.0.0/0 | Let's Encrypt valida el dominio por acá, y Caddy redirige a HTTPS |
   | 443/tcp | 0.0.0.0/0 | HTTPS |
   | 443/udp | 0.0.0.0/0 | HTTP/3 |

   El 5432 de Postgres **no se abre**: la base no publica puertos.
3. **Elastic IP**: EC2 → Elastic IPs → Allocate, y después *Associate* con la instancia. Sin
   esto la IP cambia cada vez que la instancia se reinicia.

## 2. Preparar la instancia

```bash
ssh -i clave.pem ubuntu@<elastic-ip>
```

```bash
# Docker y el plugin de Compose, con el script oficial de Docker.
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu

# 2 GiB de swap: cuatro contenedores en 1 GiB de RAM quedan justos.
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Carpeta de la pila.
sudo install -d -o ubuntu -g ubuntu /opt/club
exit
```

Volver a entrar para que tome el grupo `docker`.

## 3. Dominio y mails

En **Porkbun → Domain Management → clubdeploy.online → DNS**:

1. Un registro **A**, host vacío (`@`), apuntando a la Elastic IP.
2. En **Resend → Domains → Add domain**, cargar `clubdeploy.online`. Resend muestra los
   registros (SPF, DKIM y DMARC): copiarlos tal cual en Porkbun y esperar a que Resend los
   marque como verificados.
3. En **Resend → API Keys**, crear una clave con permiso de envío. Va en el `.env` del paso 4.

Verificar que el dominio resuelve antes de seguir:

```bash
nslookup clubdeploy.online
```

## 4. El `.env` de producción

En la instancia, a partir de [`deploy/.env.example`](../deploy/.env.example):

```bash
nano /opt/club/.env
chmod 600 /opt/club/.env
```

Generar los secretos **en la instancia**, no copiarlos de otro lado:

```bash
openssl rand -hex 24   # POSTGRES_PASSWORD
openssl rand -hex 32   # JWT_SECRET
```

`IMAGE_TAG` lo escribe el job `deploy`: se deja vacío.

## 5. Acceso del CI

Una clave SSH **solo para el CI**, distinta del `.pem`. Desde una máquina propia:

```bash
ssh-keygen -t ed25519 -f deploy_ci -N "" -C "github-actions-deploy"
ssh-copy-id -i deploy_ci.pub -o IdentityFile=clave.pem ubuntu@<elastic-ip>
ssh-keyscan -t ed25519 <elastic-ip>
```

Comparar la huella que imprime `ssh-keyscan` con la de la primera conexión por SSH. Después,
**una administradora del repo** carga en *Settings → Secrets and variables → Actions*:

| Secreto | Valor |
|---|---|
| `EC2_HOST` | La Elastic IP |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | El contenido de `deploy_ci` (la privada) |
| `EC2_KNOWN_HOSTS` | La línea que imprimió `ssh-keyscan` |

Borrar `deploy_ci` de la máquina local cuando quede cargado.

## 6. Primer deploy

1. Mergear a `main` (o re-ejecutar el último workflow de `main`). El job `imagenes`
   construye y publica las imágenes, y `deploy` las levanta en la instancia.
2. **Imágenes públicas.** Si el job falla en `docker compose pull` con *denied*, los paquetes
   quedaron privados. En GitHub → perfil de la dueña del repo → *Packages* →
   `club-deploy-api` y `club-deploy-web` → *Package settings* → *Change visibility* →
   **Public**, y re-ejecutar el job. No tienen secretos: el `.dockerignore` deja afuera todos
   los `.env`.
3. **Carga inicial**, una sola vez. `read -s` pide la contraseña sin mostrarla ni dejarla en
   el historial:

   ```bash
   cd /opt/club
   read -rp "Mail del admin: " ADMIN_EMAIL && read -rsp "Contraseña: " ADMIN_PASSWORD && echo
   export ADMIN_EMAIL ADMIN_PASSWORD
   docker compose run --rm -e ADMIN_EMAIL -e ADMIN_PASSWORD api npm run carga:produccion
   unset ADMIN_PASSWORD
   ```

   Carga el catálogo y crea el administrador. Correrla de nuevo no le cambia la contraseña.
4. Abrir `https://clubdeploy.online`, ingresar con el admin y hacer una reserva de prueba.
5. **Probar los mails**: reservar con una casilla de Gmail y revisar que la confirmación no
   caiga en spam.

## Operación

Todo se corre en `/opt/club`, que ya tiene `COMPOSE_FILE` en el `.env`.

| Para | Comando |
|---|---|
| Ver el estado | `docker compose ps` |
| Ver los logs de la API | `docker compose logs -f api` |
| Backup de la base | `docker compose exec db pg_dump -U club club_reservas > backup-$(date +%F).sql` |
| Volver a un commit anterior | En GitHub, re-ejecutar solo el job `deploy` del workflow de ese commit: sus imágenes ya están en GHCR |

Antes de mergear una migración riesgosa, hacer el backup.

Volver atrás no deshace migraciones: Prisma solo aplica hacia adelante. Si entre el commit
bueno y el actual hubo una migración, el código viejo corre contra el esquema nuevo. Para esos
casos, el camino es un PR que arregle hacia adelante, o restaurar el backup.
