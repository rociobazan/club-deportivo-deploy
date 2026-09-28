import { Logger } from '@nestjs/common';

import type { Correo, MailEnviado } from './correo';

/**
 * Cliente de mail que no toca la red. Los tests verifican los envíos contra
 * `enviados` (spec `notificaciones`, "Sin envíos reales en los tests") y en
 * desarrollo sin `RESEND_API_KEY` el log muestra lo que se habría enviado, así
 * cualquiera del equipo puede probar el formulario sin pedir una clave.
 */
export class CorreoDoble implements Correo {
  private readonly logger = new Logger('CorreoDoble');
  readonly enviados: MailEnviado[] = [];

  /** En los tests el log solo haría ruido: ahí se verifica `enviados`. */
  constructor(private readonly registrarEnElLog = true) {}

  enviar(mail: MailEnviado): Promise<void> {
    this.enviados.push(mail);
    if (this.registrarEnElLog) {
      this.logger.log(
        `Mail NO enviado (no hay RESEND_API_KEY) a ${mail.para}: "${mail.asunto}"`,
      );
    }
    return Promise.resolve();
  }

  limpiar(): void {
    this.enviados.length = 0;
  }
}
