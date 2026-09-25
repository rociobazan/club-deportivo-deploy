import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Un `describe` por requisito de `openspec/specs/autenticacion/spec.md` y un
 * `it` por escenario, con su nombre. Los usuarios que crea usan el dominio
 * `@e2e.test` y solo se borran esos, para no tocar los del seed en la base local.
 */
describe('autenticacion (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const api = () => request(app.getHttpServer());
  const DOMINIO = '@e2e.test';

  const registro = {
    nombre: 'Ana',
    apellido: 'Nueva',
    email: `ana${DOMINIO}`,
    password: 'unaClaveSegura123',
  };

  const limpiar = () =>
    prisma.usuario.deleteMany({ where: { email: { endsWith: DOMINIO } } });

  const registrar = (datos: object = registro) => api().post('/api/v1/auth/registro').send(datos);
  const ingresar = (email: string, password: string) =>
    api().post('/api/v1/auth/login').send({ email, password });

  beforeAll(async () => {
    process.env.JWT_SECRET = 'secreto-de-prueba';
    process.env.JWT_EXPIRES_IN = '1h';

    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(limpiar);

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  describe('Registro de socios', () => {
    it('Registro con un mail nuevo: 201 con el usuario creado, con rol SOCIO', async () => {
      const { body } = await registrar().expect(201);

      expect(body).toMatchObject({
        nombre: 'Ana',
        apellido: 'Nueva',
        email: `ana${DOMINIO}`,
        telefono: null,
        rol: 'SOCIO',
      });
      expect(body.id).toEqual(expect.any(Number));
    });

    it('Mail ya registrado: 409 EMAIL_YA_REGISTRADO y no se crea ningún usuario', async () => {
      await registrar().expect(201);
      const antes = await prisma.usuario.count();

      const { body } = await registrar({ ...registro, nombre: 'Otra' }).expect(409);

      expect(body).toMatchObject({ tipo: 'EMAIL_YA_REGISTRADO', estado: 409, instancia: '/auth/registro' });
      await expect(prisma.usuario.count()).resolves.toBe(antes);
    });

    it('el mail se compara sin distinguir mayúsculas', async () => {
      await registrar().expect(201);
      await registrar({ ...registro, email: `ANA${DOMINIO}` }).expect(409);
    });

    it('Datos mal formados: 400 SOLICITUD_INVALIDA y no se crea ningún usuario', async () => {
      const antes = await prisma.usuario.count();

      for (const caso of [
        { ...registro, email: 'no-es-un-mail' },
        { ...registro, password: '1234567' },
        { nombre: 'Ana', email: registro.email, password: registro.password },
      ]) {
        const { body } = await registrar(caso).expect(400);
        expect(body).toMatchObject({ tipo: 'SOLICITUD_INVALIDA', estado: 400, instancia: '/auth/registro' });
      }
      await expect(prisma.usuario.count()).resolves.toBe(antes);
    });

    it('Intento de elegir el rol: 400 SOLICITUD_INVALIDA y no se crea ningún usuario', async () => {
      const antes = await prisma.usuario.count();

      const { body } = await registrar({ ...registro, rol: 'ADMIN' }).expect(400);

      expect(body.tipo).toBe('SOLICITUD_INVALIDA');
      await expect(prisma.usuario.count()).resolves.toBe(antes);
    });
  });

  describe('Contraseñas protegidas', () => {
    it('Contraseña hasheada al registrarse: lo persistido es un hash bcrypt distinto de la clave', async () => {
      await registrar().expect(201);

      const guardado = await prisma.usuario.findUnique({ where: { email: registro.email } });

      expect(guardado?.passwordHash).not.toBe(registro.password);
      await expect(bcrypt.compare(registro.password, guardado!.passwordHash)).resolves.toBe(true);
    });

    it('La contraseña no se expone: ni registro, ni login, ni perfil devuelven la clave o su hash', async () => {
      const { body: creado } = await registrar().expect(201);
      const { body: sesion } = await ingresar(registro.email, registro.password).expect(200);
      const { body: perfil } = await api()
        .get('/api/v1/auth/perfil')
        .set('Authorization', `Bearer ${sesion.accessToken}`)
        .expect(200);

      for (const cuerpo of [creado, sesion, sesion.usuario, perfil]) {
        const texto = JSON.stringify(cuerpo);
        expect(texto).not.toContain('password');
        expect(texto).not.toContain('$2b$');
      }
    });
  });

  describe('Inicio de sesión con JWT', () => {
    beforeEach(() => registrar().expect(201));

    it('Credenciales válidas: 200 con accessToken, expiraEn y usuario; el payload lleva sub y rol', async () => {
      const { body } = await ingresar(registro.email, registro.password).expect(200);

      expect(body).toMatchObject({
        expiraEn: expect.any(Number),
        usuario: { email: registro.email, rol: 'SOCIO' },
      });
      const payload = new JwtService({ secret: 'secreto-de-prueba' }).verify<{ sub: number; rol: string }>(
        body.accessToken,
      );
      expect(payload.sub).toBe(body.usuario.id);
      expect(payload.rol).toBe('SOCIO');
    });

    it('Vigencia informada: con JWT_EXPIRES_IN=1h, expiraEn vale 3600', async () => {
      const { body } = await ingresar(registro.email, registro.password).expect(200);
      expect(body.expiraEn).toBe(3600);
    });

    it('Contraseña incorrecta: 401 con un mensaje genérico', async () => {
      const { body } = await ingresar(registro.email, 'incorrecta').expect(401);

      expect(body).toMatchObject({ tipo: 'CREDENCIALES_INVALIDAS', estado: 401, instancia: '/auth/login' });
      expect(body.titulo).not.toMatch(/contraseña incorrecta|mail no existe/i);
    });

    it('Mail inexistente: 401 con el mismo tipo y el mismo titulo que ante contraseña incorrecta', async () => {
      const { body: porClave } = await ingresar(registro.email, 'incorrecta').expect(401);
      const { body: porMail } = await ingresar(`nadie${DOMINIO}`, 'incorrecta').expect(401);

      expect(porMail.tipo).toBe(porClave.tipo);
      expect(porMail.titulo).toBe(porClave.titulo);
      expect(porMail.detalle).toBe(porClave.detalle);
    });

    it('acepta el mail con otras mayúsculas', async () => {
      await ingresar(`ANA${DOMINIO.toUpperCase()}`, registro.password).expect(200);
    });
  });

  describe('Perfil del usuario autenticado', () => {
    it('Consulta del propio perfil: 200 con id, nombre, apellido, mail, teléfono y rol', async () => {
      const { body: creado } = await registrar({ ...registro, telefono: '+5493541000000' }).expect(201);
      const { body: sesion } = await ingresar(registro.email, registro.password).expect(200);

      const { body } = await api()
        .get('/api/v1/auth/perfil')
        .set('Authorization', `Bearer ${sesion.accessToken}`)
        .expect(200);

      expect(body).toEqual({
        id: creado.id,
        nombre: 'Ana',
        apellido: 'Nueva',
        email: registro.email,
        telefono: '+5493541000000',
        rol: 'SOCIO',
      });
    });

    it('Perfil sin token: 401 NO_AUTENTICADO', async () => {
      const { body } = await api().get('/api/v1/auth/perfil').expect(401);

      expect(body).toMatchObject({ tipo: 'NO_AUTENTICADO', estado: 401, instancia: '/auth/perfil' });
    });

    it('si el usuario del token fue borrado, el perfil responde 401', async () => {
      await registrar().expect(201);
      const { body: sesion } = await ingresar(registro.email, registro.password).expect(200);
      await limpiar();

      await api()
        .get('/api/v1/auth/perfil')
        .set('Authorization', `Bearer ${sesion.accessToken}`)
        .expect(401);
    });
  });
});
