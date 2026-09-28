import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { ErrorDeApi } from '../common/error-de-api';

/** Cinco mensajes por minuto y por IP, como pide la spec `institucional`. */
export const VENTANA_MS = 60_000;
export const MAXIMO_POR_VENTANA = 5;

/**
 * El límite por IP de `POST /contacto`, con el error que promete el contrato.
 *
 * El texto vive acá y no en el filtro global por dos razones: el número sale
 * del mismo lugar que lo aplica, así que no pueden desincronizarse, y el filtro
 * queda genérico para cualquier otro endpoint que se limite más adelante
 * (los reenvíos de mail de RN-16, por ejemplo), que va a querer su propio texto.
 */
@Injectable()
export class GuardDeLimiteDeContacto extends ThrottlerGuard {
  protected throwThrottlingException(): Promise<void> {
    throw new ErrorDeApi(
      429,
      'DEMASIADAS_SOLICITUDES',
      'Superaste el límite de mensajes',
      `Se admiten hasta ${MAXIMO_POR_VENTANA} mensajes por minuto. Volvé a intentar en un rato.`,
    );
  }
}
