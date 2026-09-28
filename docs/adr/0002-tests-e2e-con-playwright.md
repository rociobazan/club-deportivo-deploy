# ADR 0002 — Tests e2e de navegador con Playwright, contra la pila real

**Fecha:** 2026-09-28
**Estado:** aceptada
**Decide:** Jeremías, a pedido de la cátedra

## Contexto

Hasta ahora el front no tenía ni un test automático. Los e2e de la API (Jest más supertest)
cubren los endpoints, y el job `web` del CI corre lint y build, que verifica los tipos pero no
que una pantalla funcione. Todo lo demás —que el formulario de contacto envíe, que el registro
cree la cuenta, que una ruta privada redirija— se verificó **a mano**, pantalla por pantalla, en
cada uno de los ítems 1.1, 1.2 y 1.5.

Eso deja un agujero conocido: si alguien rompe el formulario de contacto, nada lo detecta. Y el
sitio institucional está diseñado para **degradar** cuando la API no responde, así que ni
siquiera un "la página carga" alcanzaría como señal.

Hay un hecho del diseño del front que condiciona todas las opciones: **el navegador nunca llama
a la API**. `API_URL` se lee en un solo lugar, `apps/web/lib/api/client.ts`, del lado del
servidor, y los formularios son Server Functions. Las llamadas salen del proceso de Next, no del
browser.

## Decisión

**Se suma `@playwright/test` como suite de tests de navegador sobre el front, corriendo contra la
pila real: Postgres, la API de Nest y Next servido en modo producción.** Un job `e2e` en el CI la
levanta entera y corre los tests en cada PR.

Los tests viven en `apps/web/e2e/` y cubren cuatro flujos, cada uno atado a un requisito que ya
está en `openspec/specs/`:

| Archivo | Requisito que verifica |
|---|---|
| `institucional.spec.ts` | Sitio institucional público |
| `contacto.spec.ts` | Formulario de contacto en el sitio |
| `autenticacion.spec.ts` | Ingreso y registro · Rutas privadas · Cierre de sesión |
| `disponibilidad.spec.ts` | Pantalla de disponibilidad, con el horario por día |

**Solo Chromium.** Firefox y WebKit triplicarían el tiempo del CI sin cubrir riesgo real en este
proyecto.

**En serie (`workers: 1`)**, por la misma razón que los e2e de la API: comparten una sola base y
en paralelo se pisan. **Reintentos solo en el CI**, porque en local un test que falla tiene que
fallar enseguida.

**Cada test crea sus propios datos** con los prefijos que ya usa la API (`@e2e.test`, `E2E-`). La
excepción es el catálogo, que sale del seed: el job lo corre, a diferencia del job `api`. Sin
catálogo, la pantalla de disponibilidad no tendría canchas que mostrar y el test pasaría sin
comprobar que el front consume la API.

## Alternativas consideradas

**Mockear la API desde el navegador con `page.route()`.** Es la opción barata y la que casi
elegimos. **No funciona acá**: como las llamadas salen del servidor de Next y no del browser,
`page.route()` no tiene nada que interceptar. Habría dado una suite verde que no prueba ningún
flujo.

**Testear solo el sitio institucional, sin levantar la API.** Rápido y simple, pero el sitio
degrada a propósito cuando la API no responde: los tests pasarían con el backend entero roto. Es
peor que no tener tests, porque da confianza falsa.

**Cypress en lugar de Playwright.** La cátedra pidió Playwright. Más allá de eso, Playwright trae
navegadores propios y corre headless en el CI sin configuración extra.

**Dejarlo como está y seguir verificando a mano.** Es lo que veníamos haciendo y funcionó
mientras un solo integrante tocaba el front. Con 1.3, 1.4 y 1.6 repartidas entre tres personas
más, cada una tocando el header y las rutas privadas, deja de escalar.

## Consecuencias

**A favor**

- Los flujos que hoy se prueban a mano pasan a probarse en cada PR, para los cuatro.
- El job levanta la pila completa, así que además verifica que la API y el front se entiendan:
  contrato, tipos generados, cookies de sesión y todo lo del medio.
- Cuando entren las pantallas de reservas y administración, el andamio ya está.

**En contra**

- **El CI tarda entre dos y tres minutos más por PR.** Es el costo real de la decisión.
- El job `e2e` es el más frágil del CI: depende de que la API arranque, de que el build del front
  exista y de tiempos. Por eso espera el health check de la API antes de empezar y sube el
  reporte, los traces y el log de la API como artefactos cuando algo falla.
- **`e2e` todavía no es un check obligatorio** del ruleset de `main`. Agregarlo lo tiene que
  hacer `rociobazan`, la única cuenta con admin. Hasta entonces el job corre e informa, pero no
  bloquea un merge.
- Los tests dependen del texto de la interfaz ("Enviar mensaje", "El club no abre este día"). Un
  cambio de copy los rompe. Es deliberado: se busca por rol y por etiqueta accesible, no por
  clases de CSS, así que lo que se rompe es lo que también cambiaría para quien usa el sitio.

## Fuera de alcance

- Regresión visual y comparación de capturas.
- Pantallas de reservas y administración: no existen todavía (1.3, 1.4 y 1.6).
- Reemplazar los e2e de la API, que siguen en Jest más supertest.
- Accesibilidad automatizada: se sigue midiendo con Lighthouse a mano.

## Referencias

- `apps/web/playwright.config.ts`, `apps/web/e2e/`
- `.github/workflows/ci.yml`, job `e2e`
- `apps/web/lib/api/client.ts`, el único lugar que lee `API_URL`
- `docs/memoria-proyecto.md`, decisiones 24 y 25 (e2e en serie, datos propios por test)
