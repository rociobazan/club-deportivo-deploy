import { INestApplication } from '@nestjs/common';
import { CONFIGURACION, Configuracion, PREFIJO_API } from './configuracion';

/**
 * Lo que no se puede registrar por DI: prefijo y CORS. La usan `main.ts` y los
 * tests e2e, así los dos arrancan exactamente la misma app (design.md, 9 y 14).
 * Pipe, filtro y guards van como providers en `AppModule`.
 */
export function configurarApp(app: INestApplication): void {
  const configuracion = app.get<Configuracion>(CONFIGURACION);

  app.setGlobalPrefix(PREFIJO_API);
  app.enableCors({ origin: configuracion.frontendUrl, credentials: true });
}
