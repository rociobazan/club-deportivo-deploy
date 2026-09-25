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

  // Una ruta fuera de /api/v1 no entra al router de Nest, así que el filtro no
  // la ve y Express respondería su 404 en HTML. Este handler va después de
  // init() para quedar último en la cadena, y responde con el schema Error.
  await app.init();
  // getInstance() devuelve `any`; la anotación tipa los parámetros del handler.
  const express: Express = app.getHttpAdapter().getInstance();
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
