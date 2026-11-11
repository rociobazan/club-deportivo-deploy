import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../prisma/prisma.service';
import { ErrorDeApi } from './error-de-api';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SolicitudConUsuario } from './usuario-actual';

const SECRETO = 'secreto-de-prueba';

/**
 * Prisma falso que devuelve el último cambio de contraseña del usuario:
 * `null` como fecha es "nunca cambió" y `undefined` es "el usuario no existe".
 */
function prismaCon(passwordCambiadaEn: Date | null | undefined): PrismaService {
  const usuario = passwordCambiadaEn === undefined ? null : { passwordCambiadaEn };
  return { usuario: { findUnique: jest.fn().mockResolvedValue(usuario) } } as unknown as PrismaService;
}

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
    const guard = new JwtAuthGuard(reflector(true), jwt, prismaCon(null));
    const { contexto, solicitud } = contextoCon(undefined);
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(solicitud.usuario).toBeUndefined();
  });

  it('en un endpoint @Publico() con token válido deja al usuario disponible', async () => {
    const guard = new JwtAuthGuard(reflector(true), jwt, prismaCon(null));
    const token = await jwt.signAsync({ sub: 9, rol: 'ADMIN' });
    const { contexto, solicitud } = contextoCon(`Bearer ${token}`);

    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(solicitud.usuario).toEqual({ id: 9, rol: 'ADMIN' });
  });

  it('en un endpoint @Publico() un token inválido no rechaza: sigue como anónimo', async () => {
    const guard = new JwtAuthGuard(reflector(true), jwt, prismaCon(null));
    const { contexto, solicitud } = contextoCon('Bearer no-es-un-jwt');

    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(solicitud.usuario).toBeUndefined();
  });

  it('rechaza con 401 cuando no hay token', async () => {
    const guard = new JwtAuthGuard(reflector(false), jwt, prismaCon(null));
    const { contexto } = contextoCon(undefined);
    await esperar401(guard, contexto);
  });

  it('rechaza con 401 un token vencido (escenario "Token expirado")', async () => {
    const guard = new JwtAuthGuard(reflector(false), jwt, prismaCon(null));
    const vencido = await jwtSinVigencia.signAsync({
      sub: 1,
      rol: 'SOCIO',
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    const { contexto } = contextoCon(`Bearer ${vencido}`);
    await esperar401(guard, contexto);
  });

  it('rechaza con 401 un token que no es un JWT o con otra firma (escenario "Token mal formado o con firma inválida")', async () => {
    const guard = new JwtAuthGuard(reflector(false), jwt, prismaCon(null));
    const otraFirma = await new JwtService({ secret: 'otro' }).signAsync({ sub: 1, rol: 'SOCIO' });

    await esperar401(guard, contextoCon('Bearer no-es-un-jwt').contexto);
    await esperar401(guard, contextoCon(`Bearer ${otraFirma}`).contexto);
    await esperar401(guard, contextoCon('Basic abc').contexto);
  });

  it('con token válido deja { id, rol } en la solicitud', async () => {
    const guard = new JwtAuthGuard(reflector(false), jwt, prismaCon(null));
    const token = await jwt.signAsync({ sub: 42, rol: 'ADMIN' });
    const { contexto, solicitud } = contextoCon(`Bearer ${token}`);

    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(solicitud.usuario).toEqual({ id: 42, rol: 'ADMIN' });
  });

  it('el 401 es un ErrorDeApi con el formato del contrato', async () => {
    const guard = new JwtAuthGuard(reflector(false), jwt, prismaCon(null));
    const { contexto } = contextoCon(undefined);
    const error = await guard.canActivate(contexto).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ErrorDeApi);
    expect((error as ErrorDeApi).getResponse()).toMatchObject({
      tipo: 'NO_AUTENTICADO',
      titulo: 'Se requiere autenticación',
      estado: 401,
    });
  });

  describe('Cierre de sesiones al cambiar la contraseña', () => {
    const CAMBIO = new Date('2026-11-10T15:00:00.500Z');
    /** Un token cuyo `iat` es el instante dado, sin vencimiento para que la fecha fija no lo venza. */
    const tokenEmitidoEn = (instante: Date) =>
      jwtSinVigencia.signAsync({ sub: 5, rol: 'SOCIO', iat: Math.floor(instante.getTime() / 1000) });

    it('rechaza con 401 un token emitido antes del último cambio de contraseña', async () => {
      const guard = new JwtAuthGuard(reflector(false), jwt, prismaCon(CAMBIO));
      const token = await tokenEmitidoEn(new Date('2026-11-10T14:59:59.000Z'));
      const { contexto } = contextoCon(`Bearer ${token}`);

      await esperar401(guard, contexto);
    });

    it('acepta un token emitido en el mismo segundo del cambio, como el del reingreso', async () => {
      const guard = new JwtAuthGuard(reflector(false), jwt, prismaCon(CAMBIO));
      const token = await tokenEmitidoEn(new Date('2026-11-10T15:00:00.000Z'));
      const { contexto, solicitud } = contextoCon(`Bearer ${token}`);

      await expect(guard.canActivate(contexto)).resolves.toBe(true);
      expect(solicitud.usuario).toEqual({ id: 5, rol: 'SOCIO' });
    });

    it('acepta cualquier token si la contraseña nunca cambió', async () => {
      const guard = new JwtAuthGuard(reflector(false), jwt, prismaCon(null));
      const token = await tokenEmitidoEn(new Date('2020-01-01T00:00:00.000Z'));
      const { contexto } = contextoCon(`Bearer ${token}`);

      await expect(guard.canActivate(contexto)).resolves.toBe(true);
    });

    it('no decide nada si el usuario del token no existe', async () => {
      const guard = new JwtAuthGuard(reflector(false), jwt, prismaCon(undefined));
      const token = await tokenEmitidoEn(new Date('2026-11-10T14:00:00.000Z'));
      const { contexto } = contextoCon(`Bearer ${token}`);

      await expect(guard.canActivate(contexto)).resolves.toBe(true);
    });

    it('Token anterior en un endpoint público: sigue como anónimo, sin 401', async () => {
      const guard = new JwtAuthGuard(reflector(true), jwt, prismaCon(CAMBIO));
      const token = await tokenEmitidoEn(new Date('2026-11-10T14:59:59.000Z'));
      const { contexto, solicitud } = contextoCon(`Bearer ${token}`);

      await expect(guard.canActivate(contexto)).resolves.toBe(true);
      expect(solicitud.usuario).toBeUndefined();
    });

    it('si la base falla no lo disfraza de 401: el error sigue de largo', async () => {
      const prisma = {
        usuario: { findUnique: jest.fn().mockRejectedValue(new Error('base caída')) },
      } as unknown as PrismaService;
      const guard = new JwtAuthGuard(reflector(false), jwt, prisma);
      const token = await jwt.signAsync({ sub: 5, rol: 'SOCIO' });
      const { contexto } = contextoCon(`Bearer ${token}`);

      await expect(guard.canActivate(contexto)).rejects.toThrow('base caída');
    });
  });
});
