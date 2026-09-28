import { HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';

import { ErrorDeApi } from './error-de-api';
import { FiltroDeErrores } from './filtro-de-errores';

/** Cuerpo que el filtro terminó escribiendo en la respuesta. */
function capturar(excepcion: unknown, ruta = '/api/v1/contacto') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ path: ruta, method: 'POST' }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;

  new FiltroDeErrores().catch(excepcion, host);

  return { estado: status.mock.calls[0]?.[0] as number, cuerpo: json.mock.calls[0]?.[0] };
}

describe('FiltroDeErrores', () => {
  // El filtro loguea todo 5xx; en los tests eso solo sería ruido.
  let log: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    log.mockRestore();
  });

  it('emite un 429 sin personalizar como DEMASIADAS_SOLICITUDES, sin filtrar el mensaje interno', () => {
    // Un 429 que nadie tradujo: el texto interno de la excepción no se muestra.
    const { estado, cuerpo } = capturar(
      new HttpException('ThrottlerException: Too Many Requests', 429),
    );

    expect(estado).toBe(429);
    expect(cuerpo).toEqual({
      tipo: 'DEMASIADAS_SOLICITUDES',
      titulo: 'Hiciste demasiadas solicitudes',
      estado: 429,
      instancia: '/contacto',
    });
  });

  it('respeta un ErrorDeApi tal como lo armó el servicio y le agrega la instancia', () => {
    const { cuerpo } = capturar(
      new ErrorDeApi(502, 'CORREO_NO_ENVIADO', 'No pudimos enviar tu mensaje'),
    );

    expect(cuerpo).toMatchObject({
      tipo: 'CORREO_NO_ENVIADO',
      estado: 502,
      instancia: '/contacto',
    });
  });

  it('un error que no es HTTP sale como 500 genérico, sin filtrar el detalle', () => {
    const { estado, cuerpo } = capturar(new Error('connect ECONNREFUSED 127.0.0.1:5434'));

    expect(estado).toBe(500);
    expect(cuerpo).toEqual({
      tipo: 'ERROR_INTERNO',
      titulo: 'Algo salió mal de nuestro lado',
      estado: 500,
      instancia: '/contacto',
    });
    expect(log).toHaveBeenCalled();
  });
});
