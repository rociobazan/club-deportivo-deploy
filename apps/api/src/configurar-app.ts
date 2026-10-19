import { INestApplication } from '@nestjs/common';
import type { Express } from 'express';
import { CONFIGURACION, Configuracion, PREFIJO_API } from './configuracion';

/**
 * Lo que no se puede registrar por DI: prefijo, CORS y el 404 de fuera del
 * prefijo. La usan `main.ts` y los tests e2e, así los dos arrancan exactamente
 * la misma app (design.md, 9 y 14). Pipe, filtro y guards van como providers
 * en `AppModule`.
 */
export async function configurarApp(app: INestApplication): Promise<void> {
  const configuracion = app.get<Configuracion>(CONFIGURACION);

  app.setGlobalPrefix(PREFIJO_API);
  app.enableCors({ origin: configuracion.frontendUrl, credentials: true });

  /*
   * Un salto de proxy de confianza, y no `true`: `req.ip` pasa a ser la última
   * entrada de `X-Forwarded-For`, la que agregó quien se conectó al socket. En
   * producción el puerto de la API no está publicado, así que ese salto es
   * siempre `caddy` (llamadas directas a /api/v1, y Caddy pisa el encabezado
   * que traiga el cliente) o `web` (Server Actions, que reenvían la IP del
   * visitante). Sin esto, el límite por IP de `POST /contacto` contaba a todos
   * los visitantes sobre la IP del contenedor `web` (decisión 37).
   */
  // getInstance() devuelve `any`; la anotación tipa `set` y el handler del 404.
  const express: Express = app.getHttpAdapter().getInstance();
  express.set('trust proxy', 1);

  // Una ruta fuera de /api/v1 no entra al router de Nest, así que el filtro no
  // la ve y Express respondería su 404 en HTML. Este handler va después de
  // init() para quedar último en la cadena, y responde con el schema Error.
  await app.init();
  express.use((solicitud, respuesta) => {
    respuesta.status(404).json({
      tipo: 'NO_ENCONTRADO',
      titulo: 'No encontramos lo que pediste',
      estado: 404,
      detalle: `La API vive bajo /${PREFIJO_API}.`,
      instancia: solicitud.path,
    });
  });
}
