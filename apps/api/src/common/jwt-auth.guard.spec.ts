import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ErrorDeApi } from './error-de-api';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SolicitudConUsuario } from './usuario-actual';

const SECRETO = 'secreto-de-prueba';

function contextoCon(authorization: string | undefined): {
  contexto: ExecutionContext;
  solicitud: SolicitudConUsuario;
} {
  const solicitud = { headers: { authorization } } as SolicitudConUsuario;
  const contexto = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => solicitud }),
  } as unknown as ExecutionContext;
  return { contexto, solicitud };
}

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({ secret: SECRETO, signOptions: { expiresIn: '1h' } });
  // Sin expiresIn por defecto, para poder fijar `exp` a mano en el payload.
  const jwtSinVigencia = new JwtService({ secret: SECRETO });
  const reflector = (esPublico: boolean) =>
    ({ getAllAndOverride: () => esPublico }) as unknown as Reflector;

  const esperar401 = async (guard: JwtAuthGuard, contexto: ExecutionContext) => {
    await expect(guard.canActivate(contexto)).rejects.toMatchObject({
      estado: 401,
      tipo: 'NO_AUTENTICADO',
    });
  };

  it('deja pasar un endpoint @Publico() sin token', async () => {
    const guard = new JwtAuthGuard(reflector(true), jwt);
    const { contexto } = contextoCon(undefined);
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
  });

  it('rechaza con 401 cuando no hay token', async () => {
    const guard = new JwtAuthGuard(reflector(false), jwt);
    const { contexto } = contextoCon(undefined);
    await esperar401(guard, contexto);
  });

  it('rechaza con 401 un token vencido (escenario "Token expirado")', async () => {
    const guard = new JwtAuthGuard(reflector(false), jwt);
    const vencido = await jwtSinVigencia.signAsync({
      sub: 1,
      rol: 'SOCIO',
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    const { contexto } = contextoCon(`Bearer ${vencido}`);
    await esperar401(guard, contexto);
  });

  it('rechaza con 401 un token que no es un JWT o con otra firma (escenario "Token mal formado o con firma inválida")', async () => {
    const guard = new JwtAuthGuard(reflector(false), jwt);
    const otraFirma = await new JwtService({ secret: 'otro' }).signAsync({ sub: 1, rol: 'SOCIO' });

    await esperar401(guard, contextoCon('Bearer no-es-un-jwt').contexto);
    await esperar401(guard, contextoCon(`Bearer ${otraFirma}`).contexto);
    await esperar401(guard, contextoCon('Basic abc').contexto);
  });

  it('con token válido deja { id, rol } en la solicitud', async () => {
    const guard = new JwtAuthGuard(reflector(false), jwt);
    const token = await jwt.signAsync({ sub: 42, rol: 'ADMIN' });
    const { contexto, solicitud } = contextoCon(`Bearer ${token}`);

    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(solicitud.usuario).toEqual({ id: 42, rol: 'ADMIN' });
  });

  it('el 401 es un ErrorDeApi con el formato del contrato', async () => {
    const guard = new JwtAuthGuard(reflector(false), jwt);
    const { contexto } = contextoCon(undefined);
    const error = await guard.canActivate(contexto).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ErrorDeApi);
    expect((error as ErrorDeApi).getResponse()).toMatchObject({
      tipo: 'NO_AUTENTICADO',
      titulo: 'Se requiere autenticación',
      estado: 401,
    });
  });
});
