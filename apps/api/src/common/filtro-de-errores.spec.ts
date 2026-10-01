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

  /** Así llegan los errores de `body-parser`: no son `HttpException`. */
  const errorDelParser = (status: number, type: string) =>
    Object.assign(new Error('request entity too large'), { status, statusCode: status, expose: true, type });

  it('un cuerpo demasiado grande sale como 413 y no como 500', () => {
    const { estado, cuerpo } = capturar(errorDelParser(413, 'entity.too.large'));

    expect(estado).toBe(413);
    expect(cuerpo).toEqual({
      tipo: 'CUERPO_DEMASIADO_GRANDE',
      titulo: 'La solicitud es demasiado grande',
      estado: 413,
      instancia: '/contacto',
    });
    expect(log).not.toHaveBeenCalled();
  });

  it('otro error 4xx del parser sale con su estado como SOLICITUD_INVALIDA', () => {
    const { estado, cuerpo } = capturar(errorDelParser(415, 'charset.unsupported'));

    expect(estado).toBe(415);
    expect(cuerpo).toMatchObject({ tipo: 'SOLICITUD_INVALIDA', estado: 415 });
  });

  it('un error con status pero sin la marca del parser sigue siendo 500', () => {
    const { estado } = capturar(Object.assign(new Error('x'), { status: 404 }));

    expect(estado).toBe(500);
  });
});
