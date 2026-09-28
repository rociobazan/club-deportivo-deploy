import { Logger } from '@nestjs/common';

import { leerConfiguracion } from '../../configuracion';
import { CorreoDoble } from './correo-doble';
import { CorreoResend } from './correo-resend';
import { crearCorreo } from './correo.module';

const base = { JWT_SECRET: 'secreto', JWT_EXPIRES_IN: '1h' };

describe('crearCorreo', () => {
  it('en test usa el doble, sin llamadas de red', () => {
    const correo = crearCorreo(leerConfiguracion(base), { NODE_ENV: 'test' });
    expect(correo).toBeInstanceOf(CorreoDoble);
  });

  it('en desarrollo sin RESEND_API_KEY usa el doble y avisa en el log', () => {
    const aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const correo = crearCorreo(leerConfiguracion(base), { NODE_ENV: 'development' });

    expect(correo).toBeInstanceOf(CorreoDoble);
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('RESEND_API_KEY'));
    aviso.mockRestore();
  });

  it('con RESEND_API_KEY usa Resend', () => {
    const configuracion = leerConfiguracion({ ...base, RESEND_API_KEY: 're_clave_falsa' });

    const correo = crearCorreo(configuracion, { NODE_ENV: 'development' });

    expect(correo).toBeInstanceOf(CorreoResend);
  });
});
