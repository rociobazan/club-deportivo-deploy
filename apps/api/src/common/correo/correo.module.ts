import { Global, Logger, Module } from '@nestjs/common';
import { Resend } from 'resend';

import { CONFIGURACION } from '../../configuracion';
import type { Configuracion } from '../../configuracion';
import { CORREO } from './correo';
import type { Correo } from './correo';
import { CorreoDoble } from './correo-doble';
import { CorreoResend } from './correo-resend';

/**
 * Elige la implementación del cliente de mail (design.md, decisión 1):
 * el doble en test y en desarrollo sin clave, Resend en el resto. En
 * producción la clave es obligatoria, así que `leerConfiguracion` ya cortó el
 * arranque antes de llegar acá si falta.
 */
export function crearCorreo(
  configuracion: Configuracion,
  entorno: NodeJS.ProcessEnv = process.env,
): Correo {
  // En los tests el log solo haría ruido: ahí se verifica contra `enviados`.
  if (entorno.NODE_ENV === 'test') return new CorreoDoble(false);

  if (!configuracion.resendApiKey) {
    new Logger('CorreoModule').warn(
      'No hay RESEND_API_KEY: los mails no se envían, quedan en el log. Configurala para enviar de verdad.',
    );
    return new CorreoDoble();
  }

  const cliente = new Resend(configuracion.resendApiKey);
  return new CorreoResend(
    (opciones) => cliente.emails.send(opciones),
    configuracion.mailFrom,
  );
}

@Global()
@Module({
  providers: [
    {
      provide: CORREO,
      inject: [CONFIGURACION],
      useFactory: (configuracion: Configuracion) => crearCorreo(configuracion),
    },
  ],
  exports: [CORREO],
})
export class CorreoModule {}
