# Materiales iniciales

Estos son los únicos archivos que conviene traer ya hechos. Todo lo demás
—`package.json`, `docker-compose.yml`, `schema.prisma`, `seed.ts`, `ci.yml`,
`README.md`— se crea siguiendo el plan de trabajo, que trae el contenido
completo de cada uno en el paso donde corresponde.

## Qué hay acá

| Archivo | Por qué viene hecho |
|---|---|
| `contratos/openapi.yaml` | 900 líneas. Es el contrato de la API, ya corregido para precio plano. Nadie lo escribe a mano |
| `docs/requisitos.md` | El relevamiento del equipo. Es el insumo directo de las specs de OpenSpec |
| `docs/arquitectura.md` | Decisiones de arquitectura y convenciones |
| `docs/identidad.md` | Identidad de marca y dirección de diseño |
| `.gitignore` | Puro andamiaje. Equivocarse acá significa commitear un `.env` con claves |

## Cuándo copiarlos

En el **paso 2.4** del plan, con el repositorio ya clonado y antes del primer
commit. Copiá las tres carpetas dentro de `club-reservas/` y seguí con el plan
desde donde quedaste.

El `plan-de-trabajo` también conviene copiarlo a `docs/`, para que quede
versionado con el resto del proyecto.

## Qué NO hay acá, a propósito

- `apps/api/` y `apps/web/` los generan `nest new` y `create-next-app`
  en los pasos 2.5 y 2.6.
- `openspec/` la crea `openspec init` en el paso 3.2.
- Los `.env` reales los completa cada uno en su máquina.
