import { Inject, Injectable, Logger } from '@nestjs/common';

import { CORREO, CorreoNoEnviadoError } from '../common/correo/correo';
import type { Correo } from '../common/correo/correo';
import { ErrorDeApi } from '../common/error-de-api';
import { CONFIGURACION } from '../configuracion';
import type { Configuracion } from '../configuracion';
import { ContactoDto } from './dto/contacto.dto';

/** `ContactoResponse` del contrato. */
export type ContactoRespuesta = { mensaje: string };

/**
 * Deja el nombre en una sola línea para el asunto. `@IsString()` acepta saltos
 * de línea y tabulaciones, y un asunto con un salto en el medio es inválido: el
 * proveedor lo rechazaría y una consulta legítima terminaría en un 502.
 */
const unaLinea = (valor: string) => valor.replace(/\s+/g, ' ').trim();

/** El mismo texto para un envío real y para uno descartado por el campo trampa. */
const CONFIRMACION = 'Recibimos tu consulta. Te respondemos dentro de las 48 horas.';

@Injectable()
export class ContactoService {
  private readonly logger = new Logger(ContactoService.name);

  constructor(
    @Inject(CORREO) private readonly correo: Correo,
    @Inject(CONFIGURACION) private readonly configuracion: Configuracion,
  ) {}

  /**
   * Reenvía el mensaje a la casilla del club y devuelve la confirmación.
   *
   * El campo trampa completo devuelve exactamente la misma respuesta sin
   * enviar nada, para no darle señal al bot, y su contenido no se loguea
   * (design.md, decisiones 4 y 5).
   */
  async enviar(datos: ContactoDto): Promise<ContactoRespuesta> {
    if (datos.sitioWeb?.trim()) {
      this.logger.warn('Mensaje de contacto descartado: el campo trampa vino completo.');
      return { mensaje: CONFIRMACION };
    }

    try {
      await this.correo.enviar({
        para: this.configuracion.mailContacto,
        asunto: `Contacto desde el sitio · ${unaLinea(datos.nombre)}`,
        texto: this.cuerpo(datos),
        // Así el club contesta desde su casilla sin copiar la dirección a mano.
        responderA: datos.email,
      });
    } catch (causa) {
      if (!(causa instanceof CorreoNoEnviadoError)) throw causa;

      // A diferencia de las reservas (RN-14), acá el mail ES la operación: si
      // no salió, la persona tiene que saberlo para escribir o llamar.
      this.logger.error(`No se pudo enviar el mensaje de contacto: ${causa.message}`);
      throw new ErrorDeApi(
        502,
        'CORREO_NO_ENVIADO',
        'No pudimos enviar tu mensaje',
        'Escribinos por mail o llamanos por teléfono y lo resolvemos.',
      );
    }

    return { mensaje: CONFIRMACION };
  }

  private cuerpo({ nombre, email, telefono, mensaje }: ContactoDto): string {
    return [
      `Nombre: ${nombre}`,
      `Mail: ${email}`,
      `Teléfono: ${telefono?.trim() || 'no dejó'}`,
      '',
      mensaje,
    ].join('\n');
  }
}
