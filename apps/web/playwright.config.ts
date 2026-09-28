import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de navegador sobre el sitio ya construido.
 *
 * Necesitan la pila entera levantada, no solo el front: `API_URL` se lee del
 * lado del servidor (`lib/api/client.ts`) y los formularios son Server
 * Functions, así que el navegador nunca llama a la API directo y no hay forma
 * de interceptar esas llamadas desde acá. Sin API de Nest y sin base, estos
 * tests no prueban nada. El job `e2e` del CI levanta las tres cosas; en local
 * alcanza con `npm run db:up`, `npm run dev:api` y `npm run dev:web`.
 */

const BASE_URL = process.env.E2E_BASE_URL?.trim() || "http://localhost:3001";

export default defineConfig({
  testDir: "./e2e",

  /*
   * En serie, igual que los e2e de la API: comparten una sola base de datos y
   * en paralelo se pisan entre ellos. Fue el mismo problema que apareció al
   * implementar 1.2 (memoria-proyecto, decisión 24).
   */
  workers: 1,
  fullyParallel: false,

  // Un `test.only` olvidado haría pasar el CI corriendo un solo test.
  forbidOnly: Boolean(process.env.CI),

  /*
   * Reintentos solo en el CI. En local un test que falla tiene que fallar
   * enseguida; reintentar esconde justamente lo que se está depurando.
   */
  retries: process.env.CI ? 2 : 0,

  timeout: 30_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],

  use: {
    baseURL: BASE_URL,
    // Solo cuando algo falla: en verde no sirven y pesan.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  // Solo Chromium: Firefox y WebKit triplican el tiempo del CI sin cubrir
  // riesgo real en este proyecto (ADR 0002).
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  /*
   * `next start` sirve el build de producción, que es lo que corre en el CI.
   * `PORT` va acá y no en el script `start` de package.json para no cambiar
   * cómo arranca el front fuera de los tests. En local reusa el servidor que
   * ya tengas levantado en vez de pelearse por el puerto.
   */
  webServer: {
    command: "npm run start",
    url: BASE_URL,
    env: {
      PORT: "3001",
      /*
       * `next start` corre en modo producción y ahí `lib/api/client.ts` corta
       * el arranque si falta `API_URL`. Se pasa con el mismo default que el
       * `.env.example`, así los tests corren aunque no tengas `.env.local`.
       */
      API_URL: process.env.API_URL?.trim() || "http://localhost:3000/api/v1",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
