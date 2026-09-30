# API — Deploy Club

API REST del sistema de reservas, en NestJS con Prisma y PostgreSQL.

**La documentación del proyecto está en el [README de la raíz](../../README.md)**: arquitectura,
cómo levantarlo, usuarios de prueba, flujo de trabajo e integración continua.

El contrato que esta API implementa es [`contratos/openapi.yaml`](../../contratos/openapi.yaml), y
las capacidades que describe su comportamiento están en [`openspec/specs/`](../../openspec/specs/).

## Comandos

Se corren desde la raíz del repositorio, con `--workspace api`.

| Comando | Qué hace |
|---|---|
| `npm run start:dev --workspace api` | Levanta la API con recarga en caliente |
| `npm run test --workspace api` | Tests unitarios |
| `npm run test:e2e --workspace api` | Tests de integración, en serie contra la base |
| `npm run lint --workspace api` | Lint con oxlint |
| `npm run build --workspace api` | Compila a `dist/` |

La base se levanta con `npm run db:up` desde la raíz. Los comandos de Prisma —`db:migrate`,
`db:seed`— también viven ahí, porque el schema es del repositorio y no de este workspace.
