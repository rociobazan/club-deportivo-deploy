import { INestApplication } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { ErrorDeApi } from '../common/error-de-api';
import { ConfiguracionModule } from '../configuracion.module';
import { configurarApp } from '../configurar-app';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from './auth.module';
import { GuardDeLimiteDeAuth } from './guard-de-limite';

/** `throwThrottlingException` es protegido: se accede como lo hace el guard. */
type ConLanzar = { throwThrottlingException: () => Promise<void> };

describe('GuardDeLimiteDeAuth', () => {
  it('lanza el error del contrato sin decir cuántos intentos quedan', async () => {
    const guard = Object.create(GuardDeLimiteDeAuth.prototype) as ConLanzar;

    let lanzado: unknown;
    try {
      await guard.throwThrottlingException();
    } catch (error) {
      lanzado = error;
    }

    expect(lanzado).toBeInstanceOf(ErrorDeApi);
    expect(lanzado).toMatchObject({ estado: 429, tipo: 'DEMASIADAS_SOLICITUDES' });
    const { titulo, detalle } = lanzado as ErrorDeApi;
    expect(`${titulo} ${detalle}`).not.toMatch(/\d/);
  });

  /*
   * El módulo de auth entero, con Prisma reemplazado por un doble sin base:
   * lo que se prueba es que cada endpoint cuenta con su propio throttler y
   * que la IP es la reenviada, no el cableado de la base. Los e2e repiten
   * estos escenarios contra la pila real.
   */
  describe('con AuthModule levantado', () => {
    let app: INestApplication<App>;
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: { data: { email: string } }) =>
          Promise.resolve({ id: 1, nombre: 'Ana', apellido: 'Nueva', email: data.email, telefono: null, rol: 'SOCIO' }),
        ),
      },
    };
    const desde = (ip: string, ruta: string, cuerpo: object) =>
      request(app.getHttpServer()).post(`/api/v1/auth/${ruta}`).set('X-Forwarded-For', ip).send(cuerpo);
    const login = { email: 'ana@club.test', password: 'equivocada' };
    const registro = { nombre: 'Ana', apellido: 'Nueva', email: 'ana@club.test', password: 'unaClaveSegura123' };

    beforeAll(async () => {
      process.env.JWT_SECRET = 'secreto-de-prueba';
      process.env.JWT_EXPIRES_IN = '1h';
      delete process.env.LIMITE_LOGIN_POR_MINUTO;
      delete process.env.LIMITE_REGISTRO_POR_MINUTO;

      const modulo = await Test.createTestingModule({
        imports: [
          ConfiguracionModule,
          PrismaModule,
          JwtModule.register({ global: true, secret: 'secreto-de-prueba', signOptions: { expiresIn: '1h' } }),
          AuthModule,
        ],
      })
        .overrideProvider(PrismaService)
        .useValue(prisma)
        .compile();
      app = modulo.createNestApplication();
      await configurarApp(app);
    });

    afterAll(() => app.close());

    it('el login admite 10 intentos por minuto desde una IP y rechaza el 11.º con 429', async () => {
      for (let numero = 1; numero <= 10; numero += 1) {
        await desde('203.0.113.30', 'login', login).expect(401);
      }

      await desde('203.0.113.30', 'login', login).expect(429);
    });

    it('otra IP reenviada no comparte el contador del login', async () => {
      await desde('203.0.113.31', 'login', login).expect(401);
    });

    it('el registro tiene su propio contador: 5 por minuto, y los intentos de login no lo gastan', async () => {
      for (let numero = 1; numero <= 10; numero += 1) {
        await desde('203.0.113.32', 'login', login).expect(401);
      }
      await desde('203.0.113.32', 'login', login).expect(429);

      // Con el login agotado, el registro de la misma IP sigue libre.
      prisma.usuario.create.mockClear();
      for (let numero = 1; numero <= 5; numero += 1) {
        await desde('203.0.113.32', 'registro', { ...registro, email: `ana${numero}@club.test` }).expect(201);
      }

      await desde('203.0.113.32', 'registro', registro).expect(429);
      expect(prisma.usuario.create).toHaveBeenCalledTimes(5);
    });
  });
});
