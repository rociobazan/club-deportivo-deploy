import { Logger } from '@nestjs/common';
import type { CreateEmailResponse } from 'resend';

import { CorreoNoEnviadoError } from './correo';
import { CorreoResend } from './correo-resend';
import type { EnviarConResend } from './correo-resend';

/** Respuesta exitosa del SDK, con la forma que declaran sus tipos. */
const aceptado = {
  data: { id: 'mail-1' },
  error: null,
  headers: null,
} as CreateEmailResponse;

describe('CorreoResend', () => {
  let log: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    log.mockRestore();
  });

  it('traduce el mail al payload del SDK, con replyTo cuando corresponde', async () => {
    const enviar = jest.fn<ReturnType<EnviarConResend>, [unknown]>(() =>
      Promise.resolve(aceptado),
    );
    const correo = new CorreoResend(
      enviar as unknown as EnviarConResend,
      'turnos@clubdeploy.com.ar',
    );

    await correo.enviar({
      para: 'hola@clubdeploy.com.ar',
      asunto: 'Contacto desde el sitio · Ana',
      texto: 'Consulta por un torneo.',
      responderA: 'ana@example.com',
    });

    expect(enviar).toHaveBeenCalledWith({
      from: 'turnos@clubdeploy.com.ar',
      to: 'hola@clubdeploy.com.ar',
      subject: 'Contacto desde el sitio · Ana',
      text: 'Consulta por un torneo.',
      replyTo: 'ana@example.com',
    });
  });

  it('omite replyTo cuando el mail no lo trae', async () => {
    const enviar = jest.fn<ReturnType<EnviarConResend>, [unknown]>(() =>
      Promise.resolve(aceptado),
    );
    const correo = new CorreoResend(
      enviar as unknown as EnviarConResend,
      'turnos@clubdeploy.com.ar',
    );

    await correo.enviar({ para: 'ana@test', asunto: 'Hola', texto: 'Texto' });

    expect(enviar.mock.calls[0]?.[0]).not.toHaveProperty('replyTo');
  });

  it('lanza CorreoNoEnviadoError cuando el proveedor devuelve un error', async () => {
    const rechazado = {
      data: null,
      error: { name: 'validation_error', message: 'Invalid to field', statusCode: 422 },
      headers: null,
    } as unknown as CreateEmailResponse;
    const correo = new CorreoResend(
      () => Promise.resolve(rechazado),
      'turnos@clubdeploy.com.ar',
    );

    await expect(
      correo.enviar({ para: 'ana@test', asunto: 'Hola', texto: 'Texto' }),
    ).rejects.toThrow(CorreoNoEnviadoError);
  });

  it('lanza CorreoNoEnviadoError cuando no se llega al proveedor', async () => {
    const correo = new CorreoResend(
      () => Promise.reject(new Error('getaddrinfo ENOTFOUND api.resend.com')),
      'turnos@clubdeploy.com.ar',
    );

    await expect(
      correo.enviar({ para: 'ana@test', asunto: 'Hola', texto: 'Texto' }),
    ).rejects.toThrow(CorreoNoEnviadoError);
  });

  it('registra el id con el que Resend lista el mensaje en su panel', async () => {
    const correo = new CorreoResend(
      () => Promise.resolve(aceptado),
      'turnos@clubdeploy.com.ar',
    );

    await correo.enviar({
      para: 'ana@example.com',
      asunto: 'Contacto desde el sitio · Ana',
      texto: 'Texto',
    });

    expect(log).toHaveBeenCalledWith(expect.stringContaining('mail-1'));
  });

  it('no escribe en el log el destinatario ni el asunto, que son datos personales', async () => {
    const correo = new CorreoResend(
      () => Promise.resolve(aceptado),
      'turnos@clubdeploy.com.ar',
    );

    await correo.enviar({
      para: 'ana@example.com',
      asunto: 'Contacto desde el sitio · Ana',
      texto: 'Texto',
    });

    const escrito = log.mock.calls.flat().join(' ');
    expect(escrito).not.toContain('ana@example.com');
    expect(escrito).not.toContain('Ana');
  });

  it('no rompe el envío si el proveedor acepta el mail sin devolver data', async () => {
    // El tipo del SDK dice que no pasa, pero es JSON de una API ajena: si esta
    // línea explotara, un mail ya enviado se reportaría como fallido.
    const sinData = { data: null, error: null, headers: null } as unknown as CreateEmailResponse;
    const correo = new CorreoResend(
      () => Promise.resolve(sinData),
      'turnos@clubdeploy.com.ar',
    );

    await expect(
      correo.enviar({ para: 'ana@test', asunto: 'Hola', texto: 'Texto' }),
    ).resolves.toBeUndefined();
  });

  it('no registra ningún id cuando el proveedor rechaza el mail', async () => {
    const rechazado = {
      data: null,
      error: { name: 'validation_error', message: 'Domain not verified', statusCode: 403 },
      headers: null,
    } as unknown as CreateEmailResponse;
    const correo = new CorreoResend(
      () => Promise.resolve(rechazado),
      'turnos@clubdeploy.com.ar',
    );

    await expect(
      correo.enviar({ para: 'ana@test', asunto: 'Hola', texto: 'Texto' }),
    ).rejects.toThrow(CorreoNoEnviadoError);
    expect(log).not.toHaveBeenCalled();
  });
});
