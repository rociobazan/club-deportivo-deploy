import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { RecuperacionService } from '../src/auth/recuperacion.service';
import { CORREO } from '../src/common/correo/correo';
import type { Correo, MailEnviado } from '../src/common/correo/correo';
import { CorreoDoble } from '../src/common/correo/correo-doble';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Los requisitos de RF-16 en `openspec/specs/autenticacion/spec.md`: un
 * `describe` por requisito y un `it` por escenario, con su nombre. Usa el
 * dominio `@e2e.test`, como `auth.e2e-spec.ts`, y borra solo esos usuarios;
 * sus tokens de recuperación se van con ellos por el borrado en cascada.
 */
describe('recuperacion de contraseña (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let correo: CorreoDoble;
  let recuperacion: RecuperacionService;

  const api = () => request(app.getHttpServer());
  const DOMINIO = '@e2e.test';
  const EMAIL = `recupera${DOMINIO}`;
  const PASSWORD = 'unaClaveSegura123';
  const NUEVA = 'otraClaveSegura456';

  const limpiar = async () => {
    await prisma.reserva.deleteMany({ where: { usuario: { email: { endsWith: DOMINIO } } } });
    await prisma.usuario.deleteMany({ where: { email: { endsWith: DOMINIO } } });
  };

  const registrar = () =>
    api()
      .post('/api/v1/auth/registro')
      .send({ nombre: 'Rita', apellido: 'Recupera', email: EMAIL, password: PASSWORD })
      .expect(201);
  const ingresar = (password: string) =>
    api().post('/api/v1/auth/login').send({ email: EMAIL, password });
  const pedir = (email: string, ip = '203.0.113.50') =>
    api().post('/api/v1/auth/recuperacion').set('X-Forwarded-For', ip).send({ email });
  const restablecer = (token: string, passwordNueva = NUEVA) =>
    api().post('/api/v1/auth/restablecimiento').send({ token, passwordNueva });

  /**
   * El envío corre en segundo plano (design.md de RF-16, decisión 3), así que
   * la respuesta llega antes que el mail: se espera a la condición, con un
   * tope, en lugar de dormir un tiempo fijo.
   */
  const esperarHasta = async (condicion: () => boolean, queSeEspera: string) => {
    const tope = Date.now() + 3000;
    while (!condicion()) {
      if (Date.now() > tope) throw new Error(`No llegó a pasar: ${queSeEspera}`);
      await new Promise((resolver) => setTimeout(resolver, 10));
    }
  };

  const mailsPara = (email: string): MailEnviado[] =>
    correo.enviados.filter((mail) => mail.para === email);

  const esperarMail = async (numero = 1): Promise<string> => {
    await esperarHasta(() => mailsPara(EMAIL).length >= numero, `el mail n.º ${numero} a ${EMAIL}`);
    const enlace = /\/restablecer\?token=([A-Za-z0-9_-]+)/.exec(mailsPara(EMAIL)[numero - 1].texto);
    if (!enlace) throw new Error('El mail de recuperación no trae el enlace con el token');
    return enlace[1];
  };

  // Mismo truco que `auth.e2e-spec.ts`: el contador del throttler arranca de cero en cada test.
  let almacen = new ThrottlerStorageService();
  const almacenReiniciable: ThrottlerStorage = {
    increment: (...argumentos) => almacen.increment(...argumentos),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'secreto-de-prueba';
    process.env.JWT_EXPIRES_IN = '1h';

    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue(almacenReiniciable)
      .compile();
    app = modulo.createNestApplication();
    await configurarApp(app);
    /*
     * Escuchando en un puerto propio y no solo `init()`: con el servidor sin
     * escuchar, supertest abre y cierra un puerto efímero en cada pedido, y los
     * pedidos en paralelo de "Solicitudes simultáneas" se pisan y cortan con
     * ECONNRESET (pasó en el CI, no en local).
     */
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    recuperacion = app.get(RecuperacionService);

    const clienteDeMail = app.get<Correo>(CORREO);
    if (!(clienteDeMail instanceof CorreoDoble)) {
      throw new Error(
        'El cliente de mail en los tests tiene que ser CorreoDoble: revisá NODE_ENV y RESEND_API_KEY.',
      );
    }
    correo = clienteDeMail;
  });

  beforeEach(async () => {
    correo.limpiar();
    jest.restoreAllMocks();
    almacen.onApplicationShutdown();
    almacen = new ThrottlerStorageService();
    await limpiar();
  });

  afterAll(async () => {
    almacen.onApplicationShutdown();
    await limpiar();
    await app.close();
  });

  describe('Recuperación de contraseña por mail', () => {
    it('Solicitud para una cuenta activa: 202 y un mail con el enlace para restablecer', async () => {
      await registrar();

      await pedir(EMAIL).expect(202);

      await esperarMail();
      expect(mailsPara(EMAIL)[0]).toMatchObject({ asunto: 'Restablecé tu contraseña de Deploy' });
      expect(mailsPara(EMAIL)[0].texto).toContain('http://localhost:3001/restablecer?token=');
    });

    it('Solicitud para un mail que no existe: el mismo 202 y ningún mail', async () => {
      await registrar();
      const existente = await pedir(EMAIL).expect(202);
      await esperarMail();
      const avisoDeFin = jest.spyOn(recuperacion, 'procesarSolicitud');

      const inexistente = await pedir(`nadie${DOMINIO}`).expect(202);

      await esperarHasta(() => avisoDeFin.mock.results.length === 1, 'que termine la solicitud');
      await avisoDeFin.mock.results[0].value;
      expect(inexistente.text).toBe(existente.text);
      expect(inexistente.headers['content-type']).toBe(existente.headers['content-type']);
      expect(mailsPara(`nadie${DOMINIO}`)).toHaveLength(0);
    });

    it('Solicitud para una cuenta inactiva: el mismo 202 y ningún mail', async () => {
      await registrar();
      await prisma.usuario.update({ where: { email: EMAIL }, data: { activo: false } });
      const procesar = jest.spyOn(recuperacion, 'procesarSolicitud');

      await pedir(EMAIL).expect(202);

      await esperarHasta(() => procesar.mock.results.length === 1, 'que termine la solicitud');
      await procesar.mock.results[0].value;
      expect(mailsPara(EMAIL)).toHaveLength(0);
      expect(await prisma.tokenRecuperacion.count({ where: { usuario: { email: EMAIL } } })).toBe(0);
    });

    it('Mail con mayúsculas o espacios: se trata como el mail de la cuenta', async () => {
      await registrar();

      await pedir(`  RECUPERA${DOMINIO.toUpperCase()} `).expect(202);

      await esperarMail();
    });

    it('Falla el proveedor de mail: el mismo 202 y la falla queda en el log sin el token ni el mail', async () => {
      await registrar();
      let textoQueNoSalio = '';
      jest.spyOn(correo, 'enviar').mockImplementationOnce((mail) => {
        textoQueNoSalio = mail.texto;
        return Promise.reject(new Error(`Resend no pudo enviar a ${mail.para}`));
      });
      const log = jest
        .spyOn(recuperacion['logger'], 'error')
        .mockImplementation(() => undefined);

      await pedir(EMAIL).expect(202);

      await esperarHasta(() => log.mock.calls.length === 1, 'la línea de error en el log');
      const linea = String(log.mock.calls[0][0]);
      expect(linea).not.toContain(/token=(\S+)/.exec(textoQueNoSalio)![1]);
      expect(linea).not.toContain(EMAIL);
    });

    it('Falla el envío con un enlace anterior vigente: el anterior sigue sirviendo y el intento no cuenta', async () => {
      await registrar();
      await pedir(EMAIL).expect(202);
      const anterior = await esperarMail();
      jest.spyOn(correo, 'enviar').mockRejectedValueOnce(new Error('Resend respondió 500'));
      jest.spyOn(recuperacion['logger'], 'error').mockImplementation(() => undefined);
      const procesar = jest.spyOn(recuperacion, 'procesarSolicitud');

      await pedir(EMAIL).expect(202);

      await esperarHasta(() => procesar.mock.results.length === 1, 'que arranque la solicitud');
      await procesar.mock.results[0].value;
      expect(await prisma.tokenRecuperacion.count({ where: { usuario: { email: EMAIL } } })).toBe(1);
      await restablecer(anterior).expect(204);
    });

    it('Restablecimiento con un token válido: 204, la contraseña vieja deja de servir y la nueva sirve', async () => {
      await registrar();
      await pedir(EMAIL).expect(202);
      const token = await esperarMail();

      await restablecer(token).expect(204);

      await ingresar(PASSWORD).expect(401);
      await ingresar(NUEVA).expect(200);
    });

    it('Token usado dos veces: 400 ENLACE_INVALIDO y la contraseña no cambia', async () => {
      await registrar();
      await pedir(EMAIL).expect(202);
      const token = await esperarMail();
      await restablecer(token).expect(204);

      const { body } = await restablecer(token, 'unaTerceraClave789').expect(400);

      expect(body).toMatchObject({ tipo: 'ENLACE_INVALIDO', estado: 400, instancia: '/auth/restablecimiento' });
      await ingresar(NUEVA).expect(200);
    });

    it('Token vencido: 400 ENLACE_INVALIDO y la contraseña no cambia', async () => {
      await registrar();
      await pedir(EMAIL).expect(202);
      const token = await esperarMail();
      // Emitido hace más de RECUPERACION_VIGENCIA_MINUTOS: se corre el vencimiento al pasado.
      await prisma.tokenRecuperacion.updateMany({
        where: { usuario: { email: EMAIL } },
        data: { expiraEn: new Date(Date.now() - 1000) },
      });

      const { body } = await restablecer(token).expect(400);

      expect(body.tipo).toBe('ENLACE_INVALIDO');
      await ingresar(PASSWORD).expect(200);
    });

    it('Token reemplazado por uno más nuevo: el del primer mail da 400 y el del segundo sigue sirviendo', async () => {
      await registrar();
      await pedir(EMAIL).expect(202);
      const primero = await esperarMail(1);
      await pedir(EMAIL).expect(202);
      const segundo = await esperarMail(2);

      const { body } = await restablecer(primero).expect(400);

      expect(body.tipo).toBe('ENLACE_INVALIDO');
      await restablecer(segundo).expect(204);
    });

    it('Token inventado: la misma respuesta que ante un token vencido', async () => {
      await registrar();
      await pedir(EMAIL).expect(202);
      const token = await esperarMail();
      await prisma.tokenRecuperacion.updateMany({
        where: { usuario: { email: EMAIL } },
        data: { expiraEn: new Date(Date.now() - 1000) },
      });
      const vencido = await restablecer(token).expect(400);

      const inventado = await restablecer('a'.repeat(43)).expect(400);

      expect(inventado.body).toEqual(vencido.body);
    });

    it('Contraseña nueva demasiado corta: 400 SOLICITUD_INVALIDA y el token sigue sirviendo', async () => {
      await registrar();
      await pedir(EMAIL).expect(202);
      const token = await esperarMail();

      const { body } = await restablecer(token, '1234567').expect(400);

      expect(body.tipo).toBe('SOLICITUD_INVALIDA');
      await ingresar(PASSWORD).expect(200);
      await restablecer(token).expect(204);
    });
  });

  describe('Límite de solicitudes de recuperación', () => {
    it('Sexta solicitud en un minuto: las primeras 5 dan 202 y la sexta 429', async () => {
      for (let numero = 1; numero <= 5; numero += 1) {
        await pedir(`nadie${numero}${DOMINIO}`, '203.0.113.60').expect(202);
      }

      const { body } = await pedir(`nadie6${DOMINIO}`, '203.0.113.60').expect(429);

      expect(body).toMatchObject({
        tipo: 'DEMASIADAS_SOLICITUDES',
        estado: 429,
        instancia: '/auth/recuperacion',
      });
    });

    it('Cuarta solicitud para la misma cuenta en una hora: 4 respuestas 202, solo 3 mails y el tercer token sigue sirviendo', async () => {
      await registrar();
      for (let numero = 1; numero <= 3; numero += 1) {
        await pedir(EMAIL, `203.0.113.7${numero}`).expect(202);
        await esperarMail(numero);
      }
      const tercero = await esperarMail(3);
      const aviso = jest.spyOn(recuperacion['logger'], 'warn').mockImplementation(() => undefined);

      await pedir(EMAIL, '203.0.113.74').expect(202);

      await esperarHasta(() => aviso.mock.calls.length === 1, 'el aviso del máximo por hora');
      expect(mailsPara(EMAIL)).toHaveLength(3);
      await restablecer(tercero).expect(204);
    });

    it('Solicitudes simultáneas para la misma cuenta: 5 respuestas 202 y como máximo 3 mails', async () => {
      await registrar();
      const procesar = jest.spyOn(recuperacion, 'procesarSolicitud');

      const respuestas = await Promise.all(
        [1, 2, 3, 4, 5].map((numero) => pedir(EMAIL, `203.0.113.8${numero}`)),
      );

      expect(respuestas.map((respuesta) => respuesta.status)).toEqual([202, 202, 202, 202, 202]);
      await esperarHasta(() => procesar.mock.results.length === 5, 'que arranquen las 5 solicitudes');
      await Promise.all(procesar.mock.results.map((resultado) => resultado.value));
      expect(mailsPara(EMAIL)).toHaveLength(3);
      // Terminar casi juntas no las hace invalidarse entre sí: alguno de los enlaces sigue sirviendo.
      const tokens = await Promise.all([1, 2, 3].map((numero) => esperarMail(numero)));
      const estados = [];
      for (const token of tokens) estados.push((await restablecer(token)).status);
      expect(estados).toContain(204);
    });
  });

  describe('Endpoints protegidos por token', () => {
    it('Recuperación sin token: se procesa normalmente y no da 401', async () => {
      await api().post('/api/v1/auth/recuperacion').send({ email: `nadie${DOMINIO}` }).expect(202);
    });
  });

  describe('Largo máximo de credenciales', () => {
    it('Contraseña nueva demasiado larga al restablecer: 400 SOLICITUD_INVALIDA y la contraseña no cambia', async () => {
      await registrar();
      await pedir(EMAIL).expect(202);
      const token = await esperarMail();

      const { body } = await restablecer(token, 'x'.repeat(73)).expect(400);

      expect(body.tipo).toBe('SOLICITUD_INVALIDA');
      await ingresar(PASSWORD).expect(200);
    });
  });
});
