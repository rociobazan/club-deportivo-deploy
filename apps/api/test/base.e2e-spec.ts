import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PruebaController } from './fixtures/prueba.controller';

/**
 * Base transversal de la API: Prisma, prefijo, pipe de validación, filtro de
 * errores y guards, sobre la app real más el fixture `PruebaController`.
 */
describe('Base transversal (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  const api = () => request(app.getHttpServer());
  const bearer = (payload: object) => `Bearer ${jwt.sign(payload)}`;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'secreto-de-prueba';
    process.env.JWT_EXPIRES_IN = '1h';

    const modulo = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [PruebaController],
    }).compile();

    app = modulo.createNestApplication();
    await configurarApp(app);
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Prisma', () => {
    it('conecta a la base y consulta la tabla usuario', async () => {
      const prisma = app.get(PrismaService);
      await expect(prisma.usuario.count()).resolves.toEqual(expect.any(Number));
    });
  });

  describe('Prefijo', () => {
    it('sirve las rutas bajo /api/v1', async () => {
      await api().get('/api/v1/').expect(200);
    });

    it('fuera del prefijo responde 404 con el schema Error, no el HTML de Express', async () => {
      const { body, type } = await api().get('/').expect(404);

      expect(type).toBe('application/json');
      expect(body).toMatchObject({ tipo: 'NO_ENCONTRADO', estado: 404, instancia: '/' });
    });
  });

  describe('Formato único de errores', () => {
    it('una ruta inexistente responde 404 con el schema Error, sin el formato de Nest', async () => {
      const { body } = await api().get('/api/v1/no-existe').expect(404);

      expect(body).toMatchObject({
        tipo: 'NO_ENCONTRADO',
        estado: 404,
        instancia: '/no-existe',
      });
      expect(typeof body.titulo).toBe('string');
      expect(body).not.toHaveProperty('statusCode');
      expect(body).not.toHaveProperty('message');
    });

    it('Error de validación: un cuerpo inválido responde 400 SOLICITUD_INVALIDA con instancia', async () => {
      const { body } = await api()
        .post('/api/v1/prueba/validacion')
        .send({ email: 'no-es-un-mail' })
        .expect(400);

      expect(body).toMatchObject({
        tipo: 'SOLICITUD_INVALIDA',
        estado: 400,
        instancia: '/prueba/validacion',
      });
      expect(typeof body.detalle).toBe('string');
    });

    it('un campo que el contrato no declara responde 400 SOLICITUD_INVALIDA', async () => {
      const { body } = await api()
        .post('/api/v1/prueba/validacion')
        .send({ email: 'socio@club.test', rol: 'ADMIN' })
        .expect(400);

      expect(body.tipo).toBe('SOLICITUD_INVALIDA');
      expect(body.detalle).toContain('rol');
    });

    it('un cuerpo válido pasa el pipe', async () => {
      await api()
        .post('/api/v1/prueba/validacion')
        .send({ email: 'socio@club.test' })
        .expect(201, { ok: true, email: 'socio@club.test' });
    });

    it('un error que no es HttpException sale como 500 genérico sin el detalle interno', async () => {
      const { body } = await api().get('/api/v1/prueba/explota').expect(500);

      expect(body).toMatchObject({ tipo: 'ERROR_INTERNO', estado: 500, instancia: '/prueba/explota' });
      expect(JSON.stringify(body)).not.toContain('detalle interno');
    });
  });

  describe('Endpoints protegidos por token', () => {
    it('Error de autenticación con el formato del contrato: sin token responde 401 NO_AUTENTICADO', async () => {
      const { body } = await api().get('/api/v1/prueba/autenticado').expect(401);

      expect(body).toMatchObject({
        tipo: 'NO_AUTENTICADO',
        titulo: 'Se requiere autenticación',
        estado: 401,
        instancia: '/prueba/autenticado',
      });
      expect(body).not.toHaveProperty('statusCode');
    });

    it('Token expirado: responde 401 NO_AUTENTICADO', async () => {
      const vencido = new JwtService({ secret: 'secreto-de-prueba' }).sign({
        sub: 1,
        rol: 'SOCIO',
        exp: Math.floor(Date.now() / 1000) - 60,
      });

      const { body } = await api()
        .get('/api/v1/prueba/autenticado')
        .set('Authorization', `Bearer ${vencido}`)
        .expect(401);
      expect(body.tipo).toBe('NO_AUTENTICADO');
    });

    it('Token mal formado o con firma inválida: responde 401 NO_AUTENTICADO', async () => {
      const otraFirma = new JwtService({ secret: 'otro-secreto' }).sign({ sub: 1, rol: 'SOCIO' });

      for (const cabecera of ['Bearer no-es-un-jwt', `Bearer ${otraFirma}`, 'Basic abc']) {
        const { body } = await api()
          .get('/api/v1/prueba/autenticado')
          .set('Authorization', cabecera)
          .expect(401);
        expect(body.tipo).toBe('NO_AUTENTICADO');
      }
    });

    it('con token válido deja disponible al usuario del payload', async () => {
      const { body } = await api()
        .get('/api/v1/prueba/autenticado')
        .set('Authorization', bearer({ sub: 7, rol: 'SOCIO' }))
        .expect(200);

      expect(body.usuario).toEqual({ id: 7, rol: 'SOCIO' });
    });

    it('Endpoint público sin token: se procesa normalmente', async () => {
      await api().post('/api/v1/prueba/validacion').send({ email: 'a@b.co' }).expect(201);
    });
  });

  describe('Autorización por rol', () => {
    it('Rol no admitido: SOCIO en un endpoint solo ADMIN responde 403 SIN_PERMISOS', async () => {
      const { body } = await api()
        .get('/api/v1/prueba/solo-admin')
        .set('Authorization', bearer({ sub: 1, rol: 'SOCIO' }))
        .expect(403);

      expect(body).toMatchObject({
        tipo: 'SIN_PERMISOS',
        estado: 403,
        instancia: '/prueba/solo-admin',
      });
    });

    it('Rol admitido: ADMIN en un endpoint solo ADMIN responde 200', async () => {
      await api()
        .get('/api/v1/prueba/solo-admin')
        .set('Authorization', bearer({ sub: 2, rol: 'ADMIN' }))
        .expect(200);
    });

    it('un endpoint solo ADMIN sin token responde 401, no 403', async () => {
      const { body } = await api().get('/api/v1/prueba/solo-admin').expect(401);
      expect(body.tipo).toBe('NO_AUTENTICADO');
    });
  });
});
