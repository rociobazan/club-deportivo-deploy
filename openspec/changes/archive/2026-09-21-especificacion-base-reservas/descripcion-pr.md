# Descripción del PR base

Texto para pegar en la descripción del pull request de `feature/spec-contrato-base` (tarea 9.6).
Vive acá para que se archive junto con el cambio.

---

## Especificación base: specs, contrato 2.2.0, schema y seed

Cierra el cambio `especificacion-base-reservas`. Deja la base de la que dependen todas las
ramas de FASE 5: las specs de OpenSpec, el contrato de la API, el schema de la base con sus
migraciones y los datos de prueba. **Requiere la aprobación de los cuatro**, porque fija
decisiones que después son costosas de cambiar.

### Qué entra

- **`docs/requisitos.md`** corregido a precio plano y ampliado con RF-11 a RF-14, RN-15 y RN-16.
- **Specs de OpenSpec** para siete capacidades: `autenticacion`, `catalogo`, `disponibilidad`,
  `reservas`, `notificaciones`, `institucional` y `administracion`.
- **`contratos/openapi.yaml` en 2.2.0** (ver abajo).
- **`docker-compose.yml`** con PostgreSQL 17 en el puerto 5434 del host.
- **`apps/api/prisma/`**: `schema.prisma`, las migraciones `init` y `slot_unico_activo`, y el seed
  con los datos del prototipo.
- **`docs/arquitectura.md`**, **`docs/identidad.md`** y **`docs/memoria-proyecto.md`** al día, más el
  prototipo de Claude Design versionado sin `uploads/`.

### Precisiones que las specs agregan sobre `requisitos.md`

El relevamiento no las decía y las specs las fijan. **Es lo principal a revisar**: si alguna no les
cierra, se discute acá y no después de archivar.

1. **Grilla de turnos obligatoria**: una `horaInicio` que no cae en la grilla anclada a la apertura
   responde 422 `HORARIO_FUERA_DE_TURNO`.
2. **Horizonte de reserva inclusivo**: el último día del horizonte se puede reservar.
3. **`COMPLETADA` no es cancelable**: un turno ya terminado responde 409.
4. **Stock de equipamiento compartido** entre todas las canchas de una disciplina (RN-08).
5. **Canchas inactivas ocultas** en el catálogo público; se ven con `incluirInactivas` y rol ADMIN.
6. **400 ante campos no declarados** en el contrato, en lugar de ignorarlos.
7. **`ZONA_HORARIA_CLUB`** (`America/Argentina/Cordoba`) define la hora local del club, con un reloj
   inyectable para los tests.
8. **Sitio institucional repartido en tres páginas**: Inicio, El club y Contacto.
9. **Asuntos de mail del prototipo**: `Tu turno en Deploy está confirmado · {codigo}` y
   `Cancelamos tu turno en Deploy · {codigo}`.
10. **Una reserva ajena responde 404 y no 403**, para no filtrar la existencia del recurso.

### Ampliación del contrato a 2.2.0

Sale de la decisión de que **todo el prototipo entra al MVP**, incluida la administración.

| Qué se agrega | Endpoints y schemas |
|---|---|
| Panel del club (RF-11) | `GET /admin/panel` con `fecha` opcional; `PanelAdmin`, `OcupacionCancha`, `ProximoTurno` |
| Administración de canchas (RF-12) | `POST /canchas`, `PATCH /canchas/{id}`, parámetro `incluirInactivas` en `GET /canchas` |
| Administración de equipamiento (RF-13) | `POST /equipamiento`, `PATCH /equipamiento/{id}`, `incluirInactivos`, campo `Equipamiento.activo` |
| Reenvío del mail (RF-14) | `POST /reservas/{id}/reenvio-mail` con `ReenvioMailResponse` y 202 / 401 / 404 / 409 / 429 |
| Reservas | campo `Reserva.cliente` con el nombre del titular |
| Tags y roles | tag `Administracion`; `ADMIN` además administra canchas y equipamiento y ve el panel |

Además, fuera de la tabla de la decisión 16: `GET /canchas` declara también el 400 que usa la spec
de `autenticacion`; el 409 de la cancelación describe los dos casos (ya cancelada o turno
terminado); y `ReenvioMailResponse` lleva `mensaje`, `tipo` y `destinatario`.

`npm run contrato:lint` termina en 0 y `npx openapi-typescript` genera los tipos sin errores.

### Verificaciones corridas

- `npm run spec:validate` (`openspec validate --all --strict`) en 0.
- `npm run contrato:lint` en 0.
- `npm run build --workspace api` compila con TypeScript 6.
- **RN-01 a prueba de humo**: dos reservas `CONFIRMADA` para el mismo turno fallan con
  `duplicate key value violates unique constraint "ux_reserva_slot_activo"`; una `CANCELADA` y una
  `CONFIRMADA` para el mismo turno conviven.
- **Simulación del CI**: `prisma migrate deploy` contra una base vacía aplica las dos migraciones y
  deja el índice parcial.
- **Seed idempotente**: la segunda corrida informa que la base ya tiene datos, termina en 0 y no
  cambia ningún conteo.
- **Migration Plan en limpio**: con `docker compose down -v` se borraron el contenedor y el volumen,
  y `npm run db:up`, `npm run db:migrate` y `npm run db:seed` dejaron las 8 tablas, los tres índices
  (`ux_reserva_slot_activo` con su `WHERE`, `ix_reserva_usuario_estado`, `ix_reserva_fecha`) y los
  datos de la decisión 13, sin ningún paso manual extra.

### Al revisar, tener en cuenta

- **Prisma no conoce el índice parcial `ux_reserva_slot_activo`.** `prisma migrate dev --create-only
  --name verificacion` no generó ningún `DROP INDEX`, pero **toda migración futura se revisa en su PR
  buscando ese `DROP`**.
- **Los tests de la API fallan desde antes de este cambio**: `npm run test --workspace api` corta con
  `TS5011` porque TypeScript 6 pide `rootDir` explícito en `apps/api/tsconfig.json`. Se arregla en
  `fix/rootdir-tests-api`, antes de armar el CI.
- `openspec/specs/` sigue vacío: se llena al archivar el cambio, en un PR aparte y después del merge.

### Para probarlo en tu máquina

Con Docker Desktop abierto:

```
git pull
npm install
npm run db:up
cp apps/api/.env.example apps/api/.env
npm run db:migrate
npm run db:seed
```

Usuarios de prueba: `admin@club.test` y `socio@club.test`, clave `clave1234`.
