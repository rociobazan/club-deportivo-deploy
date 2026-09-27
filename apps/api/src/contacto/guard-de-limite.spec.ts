import { ErrorDeApi } from '../common/error-de-api';
import { GuardDeLimiteDeContacto, MAXIMO_POR_VENTANA } from './guard-de-limite';

/** `throwThrottlingException` es protegido: se accede como lo hace el guard. */
type ConLanzar = { throwThrottlingException: () => Promise<void> };

describe('GuardDeLimiteDeContacto', () => {
  it('lanza el error del contrato, con el límite que realmente se aplica', async () => {
    const guard = Object.create(GuardDeLimiteDeContacto.prototype) as ConLanzar;

    let lanzado: unknown;
    try {
      await guard.throwThrottlingException();
    } catch (error) {
      lanzado = error;
    }

    expect(lanzado).toBeInstanceOf(ErrorDeApi);
    expect(lanzado).toMatchObject({
      estado: 429,
      tipo: 'DEMASIADAS_SOLICITUDES',
      titulo: 'Superaste el límite de mensajes',
    });
    // El número sale de la misma constante que configura el throttler.
    expect((lanzado as ErrorDeApi).detalle).toContain(`${MAXIMO_POR_VENTANA} mensajes por minuto`);
  });
});
