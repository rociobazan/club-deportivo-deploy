import { Logger } from '@nestjs/common';
import type { CreateEmailOptions, CreateEmailResponse } from 'resend';

import { CorreoNoEnviadoError } from './correo';
import type { Correo, MailEnviado } from './correo';

/**
 * Lo único que este cliente usa del SDK. Recibirlo como dependencia en vez de
 * construir el `Resend` adentro deja un seam tipado con los tipos del propio
 * SDK: los tests le pasan un stub y el código de producción no gana ninguna
 * API que exista solo para ellos.
 */
export type EnviarConResend = (
  opciones: CreateEmailOptions,
) => Promise<CreateEmailResponse>;

/** Cliente real. Lo arma `CorreoModule` cuando hay `RESEND_API_KEY`. */
export class CorreoResend implements Correo {
  private readonly logger = new Logger('CorreoResend');

  constructor(
    private readonly enviarConResend: EnviarConResend,
    private readonly remitente: string,
  ) {}

  async enviar({ para, asunto, texto, responderA }: MailEnviado): Promise<void> {
    let respuesta: CreateEmailResponse;
    try {
      respuesta = await this.enviarConResend({
        from: this.remitente,
        to: para,
        subject: asunto,
        text: texto,
        ...(responderA ? { replyTo: responderA } : {}),
      });
    } catch (causa) {
      // Ni se llegó al proveedor: DNS, red o el timeout del propio SDK.
      throw new CorreoNoEnviadoError(
        causa instanceof Error
          ? causa.message
          : 'No se pudo contactar al proveedor de mail.',
      );
    }

    if (respuesta.error) {
      throw new CorreoNoEnviadoError(
        `${respuesta.error.name}: ${respuesta.error.message}`,
      );
    }

    /*
     * Que Resend acepte el mail no quiere decir que lo entregue: acepta acá y
     * entrega después, así que un rebote —remitente sin verificar, destino que
     * rechaza— ocurre fuera de este proceso y no deja ningún rastro de este
     * lado. El id es lo único que cruza "la API contestó bien" con el mensaje
     * concreto que el panel de Resend lista con su estado real.
     *
     * Va el id y nada más: el destinatario es un dato personal, y el asunto
     * puede llevar el nombre de quien escribió por el formulario de contacto.
     */
    this.logger.log(`Mail aceptado por Resend con id ${respuesta.data.id}.`);
  }
}
