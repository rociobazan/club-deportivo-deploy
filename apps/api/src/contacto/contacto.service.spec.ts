import { Logger } from '@nestjs/common';

import { CorreoNoEnviadoError } from '../common/correo/correo';
import type { Correo } from '../common/correo/correo';
import { CorreoDoble } from '../common/correo/correo-doble';
import { ErrorDeApi } from '../common/error-de-api';
import { leerConfiguracion } from '../configuracion';
import { ContactoService } from './contacto.service';
import { ContactoDto } from './dto/contacto.dto';

const configuracion = leerConfiguracion({
  JWT_SECRET: 'secreto',
  JWT_EXPIRES_IN: '1h',
});

const datos = (extra: Partial<ContactoDto> = {}): ContactoDto =>
  Object.assign(new ContactoDto(), {
    nombre: 'Ana Fernández',
    email: 'ana@example.com',
    telefono: '351 482 7719',
    mensaje: 'Consulta por un torneo interno.',
    ...extra,
  });

describe('ContactoService', () => {
  it('Mensaje válido: manda un mail a la casilla del club, respondible al visitante', async () => {
    const correo = new CorreoDoble(false);
    const servicio = new ContactoService(correo, configuracion);

    const respuesta = await servicio.enviar(datos({ telefono: '351 482 7719' }));

    expect(respuesta.mensaje).toContain('Recibimos tu consulta');
    expect(correo.enviados).toHaveLength(1);
    expect(correo.enviados[0]).toMatchObject({
      para: 'hola@clubdeploy.com.ar',
      asunto: 'Contacto desde el sitio · Ana Fernández',
      responderA: 'ana@example.com',
    });
    expect(correo.enviados[0]?.texto).toContain('Consulta por un torneo interno.');
    expect(correo.enviados[0]?.texto).toContain('351 482 7719');
  });

  it('el teléfono viaja en el cuerpo del mail, para poder devolver la llamada', async () => {
    const correo = new CorreoDoble(false);

    await new ContactoService(correo, configuracion).enviar(datos());

    expect(correo.enviados[0]?.texto).toContain('Teléfono: 351 482 7719');
  });

  it('Campo trampa completo: responde igual y no envía nada', async () => {
    const correo = new CorreoDoble(false);
    const aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const servicio = new ContactoService(correo, configuracion);

    const normal = await servicio.enviar(datos());
    correo.limpiar();
    const conTrampa = await servicio.enviar(datos({ sitioWeb: 'http://spam.example' }));

    expect(conTrampa).toEqual(normal);
    expect(correo.enviados).toHaveLength(0);
    // El contenido del bot no se loguea, solo que se descartó.
    expect(aviso).toHaveBeenCalledWith(expect.not.stringContaining('spam.example'));
    aviso.mockRestore();
  });

  it('un campo trampa en blanco no cuenta como completo', async () => {
    const correo = new CorreoDoble(false);

    await new ContactoService(correo, configuracion).enviar(datos({ sitioWeb: '   ' }));

    expect(correo.enviados).toHaveLength(1);
  });

  it('traduce un fallo del proveedor a 502 CORREO_NO_ENVIADO, sin filtrar el detalle', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const correoQueFalla: Correo = {
      enviar: () => Promise.reject(new CorreoNoEnviadoError('rate_limit_exceeded: too many')),
    };
    const servicio = new ContactoService(correoQueFalla, configuracion);

    await expect(servicio.enviar(datos())).rejects.toMatchObject({
      estado: 502,
      tipo: 'CORREO_NO_ENVIADO',
    });
    await expect(servicio.enviar(datos())).rejects.toBeInstanceOf(ErrorDeApi);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('rate_limit_exceeded'));
    error.mockRestore();
  });
});
