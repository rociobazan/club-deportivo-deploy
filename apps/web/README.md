# Front — Deploy Club

Sitio del club y pantallas del socio, en Next.js con App Router.

**La documentación del proyecto está en el [README de la raíz](../../README.md)**: arquitectura,
cómo levantarlo, usuarios de prueba, flujo de trabajo e integración continua.

Los tipos de `lib/api/` se generan del contrato con `npm run generate:api-types` desde la raíz: no
se editan a mano. La identidad visual se puede revisar en `/estilos` con el sitio levantado.

## Comandos

Se corren desde la raíz del repositorio, con `--workspace web`.

| Comando | Qué hace |
|---|---|
| `npm run dev --workspace web` | Levanta el sitio en desarrollo |
| `npm run build --workspace web` | Compila, y de paso verifica los tipos |
| `npm run lint --workspace web` | Lint con ESLint |
| `npm run e2e --workspace web` | Tests de navegador con Playwright |
| `npm run e2e:ui --workspace web` | Los mismos, en el modo interactivo |

Los e2e levantan el sitio solos, pero **necesitan la API y la base andando**. El puerto sale de
`E2E_BASE_URL`: si el 3001 está ocupado por otra cosa, `reuseExistingServer` corre la suite contra
esa otra aplicación y falla entera. Para evitarlo, `E2E_BASE_URL=http://localhost:3010`.
