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
  }
}
