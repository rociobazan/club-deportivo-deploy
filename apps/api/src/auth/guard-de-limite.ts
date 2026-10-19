import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { ErrorDeApi } from '../common/error-de-api';

/** Un minuto, como el límite de contacto. Los máximos salen de la configuración. */
export const VENTANA_MS = 60_000;

/**
 * El límite por IP de `POST /auth/login` y `POST /auth/registro` (decisión 37),
 * con el mismo patrón que `contacto/guard-de-limite.ts`: el texto vive junto
 * al límite que lo aplica. Frena un diccionario de contraseñas o un alta
 * masiva de cuentas sin molestar a quien se equivoca de contraseña un par de
 * veces. El 429 no dice cuál es el máximo: a quien prueba contraseñas no hay
 * que contarle cuántas le quedan.
 */
@Injectable()
export class GuardDeLimiteDeAuth extends ThrottlerGuard {
  protected throwThrottlingException(): Promise<void> {
    throw new ErrorDeApi(
      429,
      'DEMASIADAS_SOLICITUDES',
      'Demasiados intentos seguidos',
      'Esperá un minuto y volvé a intentar.',
    );
  }
}
