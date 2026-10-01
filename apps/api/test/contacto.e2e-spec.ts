import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { CORREO } from '../src/common/correo/correo';
import type { Correo } from '../src/common/correo/correo';
import { CorreoDoble } from '../src/common/correo/correo-doble';
import { configurarApp } from '../src/configurar-app';

/**
 * Un `it` por escenario de los requisitos "Formulario de contacto" y "Límite de
 * envíos de contacto por IP" de `openspec/specs/institucional/spec.md`.
 *
 * No toca la base: el contacto no persiste nada, el mail es el registro. En
 * test `CorreoModule` provee el doble, así que ningún envío sale a la red
 * (spec `notificaciones`, "Sin envíos reales en los tests").
 */
describe('contacto (e2e)', () => {
  let app: INestApplication<App>;
  let correo: CorreoDoble;

  const api = () => request(app.getHttpServer());

  /**
   * El límite es por IP y todos los pedidos salen de 127.0.0.1, así que sin
   * reiniciarlo cada test heredaría los golpes del anterior. Vaciar el mapa que
   * `ThrottlerStorageService` expone en `storage` **no alcanza**: el servicio
   * re-deriva el conteo de un segundo mapa interno de vencimientos, así que los
   * golpes vuelven. Por eso el almacén se reemplaza por uno que delega en una
   * instancia real que se renueva antes de cada test: el conteo de las 5 por
   * minuto se sigue probando de verdad y cada test arranca de cero.
   */
  let almacen = new ThrottlerStorageService();
  const almacenReiniciable: ThrottlerStorage = {
    increment: (...argumentos) => almacen.increment(...argumentos),
  };

  const CASILLA_DEL_CLUB = 'club@e2e.test';
  const valido = {
    nombre: 'Ana Fernández',
    email: 'ana@example.com',
    telefono: '351 482 7719',
    mensaje: 'Hola, quería consultar por el alquiler de canchas para un torneo interno.',
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'secreto-de-prueba';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.MAIL_FROM = 'turnos@e2e.test';
    process.env.MAIL_CONTACTO = CASILLA_DEL_CLUB;
    // Que el cliente de mail no dependa de lo que cada máquina tenga exportado.
    delete process.env.RESEND_API_KEY;

    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue(almacenReiniciable)
      .compile();
    app = modulo.createNestApplication();
    await configurarApp(app);

    const clienteDeMail = app.get<Correo>(CORREO);
    // Si no es el doble, esta suite mandaría mails de verdad: mejor cortar acá
    // con un motivo claro que descubrirlo en la casilla del club.
    if (!(clienteDeMail instanceof CorreoDoble)) {
      throw new Error(
        'El cliente de mail en los tests tiene que ser CorreoDoble: revisá NODE_ENV y RESEND_API_KEY.',
      );
    }
    correo = clienteDeMail;
  });

  beforeEach(() => {
    correo.limpiar();
    // Corta el intervalo de barrido del anterior antes de reemplazarlo.
    almacen.onApplicationShutdown();
    almacen = new ThrottlerStorageService();
  });

  afterAll(async () => {
    almacen.onApplicationShutdown();
    await app.close();
  });

  describe('Formulario de contacto', () => {
    it('Mensaje válido: 202 con la confirmación y un mail a la casilla del club', async () => {
      const respuesta = await api().post('/api/v1/contacto').send(valido).expect(202);

      expect(respuesta.body.mensaje).toContain('Recibimos tu consulta');
      expect(correo.enviados).toHaveLength(1);
      expect(correo.enviados[0]).toMatchObject({
        para: CASILLA_DEL_CLUB,
        asunto: 'Contacto desde el sitio · Ana Fernández',
        responderA: valido.email,
      });
      expect(correo.enviados[0]?.texto).toContain(valido.mensaje);
    });

    it('Mail mal formado: 400 SOLICITUD_INVALIDA y no se envía nada', async () => {
      const respuesta = await api()
        .post('/api/v1/contacto')
        .send({ ...valido, email: 'ana@' })
        .expect(400);

      expect(respuesta.body).toMatchObject({
        tipo: 'SOLICITUD_INVALIDA',
        instancia: '/contacto',
      });
      expect(correo.enviados).toHaveLength(0);
    });

    it('Nombre, teléfono o mensaje de solo espacios: 400 y no se envía nada', async () => {
      for (const campo of ['nombre', 'telefono', 'mensaje']) {
        const respuesta = await api()
          .post('/api/v1/contacto')
          .send({ ...valido, [campo]: '   ' })
          .expect(400);

        expect(respuesta.body.tipo).toBe('SOLICITUD_INVALIDA');
      }
      expect(correo.enviados).toHaveLength(0);
    });

    it('Mensaje demasiado largo: 400 SOLICITUD_INVALIDA y no se envía nada', async () => {
      const respuesta = await api()
        .post('/api/v1/contacto')
        .send({ ...valido, mensaje: 'a'.repeat(1001) })
        .expect(400);

      expect(respuesta.body.tipo).toBe('SOLICITUD_INVALIDA');
      expect(correo.enviados).toHaveLength(0);
    });

    it('Campo trampa completo: 202 y ningún mail', async () => {
      const respuesta = await api()
        .post('/api/v1/contacto')
        .send({ ...valido, sitioWeb: 'http://spam.example' })
        .expect(202);

      expect(respuesta.body.mensaje).toContain('Recibimos tu consulta');
      expect(correo.enviados).toHaveLength(0);
    });
  });

  describe('Límite de envíos de contacto por IP', () => {
    it('Sexto envío en un minuto: las primeras 5 dan 202 y la sexta 429 sin enviar', async () => {
      for (let numero = 1; numero <= 5; numero += 1) {
        await api().post('/api/v1/contacto').send(valido).expect(202);
      }

      const sexta = await api().post('/api/v1/contacto').send(valido).expect(429);

      expect(sexta.body).toMatchObject({
        tipo: 'DEMASIADAS_SOLICITUDES',
        estado: 429,
        instancia: '/contacto',
      });
      expect(sexta.body.detalle).toContain('5 mensajes por minuto');
      expect(correo.enviados).toHaveLength(5);
    });
  });
});
