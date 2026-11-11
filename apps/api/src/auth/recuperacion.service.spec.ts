import * as bcrypt from 'bcrypt';

import { CorreoDoble } from '../common/correo/correo-doble';
import type { Correo } from '../common/correo/correo';
import { ErrorDeApi } from '../common/error-de-api';
import type { Reloj } from '../common/reloj';
import { leerConfiguracion } from '../configuracion';
import type { PrismaService } from '../prisma/prisma.service';
import { generarToken, hashDeToken, RecuperacionService } from './recuperacion.service';

const AHORA = new Date('2026-11-10T15:00:00.000Z');
const configuracion = leerConfiguracion({
  JWT_SECRET: 'secreto',
  JWT_EXPIRES_IN: '1h',
  FRONTEND_URL: 'https://club.test',
});

/** Prisma falso: solo lo que usa el servicio. La transacción interactiva corre contra el mismo doble. */
function crearPrisma() {
  const tablas = {
    usuario: { findUnique: jest.fn(), update: jest.fn() },
    tokenRecuperacion: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 99 }),
      delete: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn(),
    },
    // El bloqueo de la fila del usuario: el efecto real lo prueba el e2e de solicitudes simultáneas.
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  const $transaction = jest.fn(
    (fn: (tx: typeof tablas) => unknown): Promise<unknown> => Promise.resolve(fn(tablas)),
  );
  return { ...tablas, $transaction };
}

const socio = { id: 42, nombre: 'Bruno', email: 'socio@club.test', activo: true };

describe('generarToken y hashDeToken', () => {
  it('genera tokens de 43 caracteres base64url distintos en cada llamada', () => {
    const primero = generarToken();
    const segundo = generarToken();

    expect(primero).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(primero).not.toBe(segundo);
  });

  it('el hash es SHA-256 en hexadecimal y no contiene el token', () => {
    const token = generarToken();

    const hash = hashDeToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
  });
});

describe('RecuperacionService', () => {
  let prisma: ReturnType<typeof crearPrisma>;
  let correo: CorreoDoble;
  let servicio: RecuperacionService;

  const crearServicio = (conCorreo: Correo) =>
    new RecuperacionService(
      prisma as unknown as PrismaService,
      { instante: () => AHORA } as unknown as Reloj,
      conCorreo,
      configuracion,
    );

  /** El token que viajó en el enlace del último mail enviado. */
  const tokenDelMail = () => {
    const enlace = /https:\/\/club\.test\/restablecer\?token=(\S+)/.exec(correo.enviados.at(-1)!.texto);
    return enlace![1];
  };

  beforeEach(() => {
    prisma = crearPrisma();
    correo = new CorreoDoble(false);
    servicio = crearServicio(correo);
  });

  describe('procesarSolicitud', () => {
    it('Solicitud para una cuenta activa: envía un mail con un enlace cuyo token es el que se guardó hasheado', async () => {
      prisma.usuario.findUnique.mockResolvedValue(socio);

      await servicio.procesarSolicitud('socio@club.test');

      expect(correo.enviados).toHaveLength(1);
      expect(correo.enviados[0]).toMatchObject({
        para: 'socio@club.test',
        asunto: 'Restablecé tu contraseña de Deploy',
      });
      const { data } = prisma.tokenRecuperacion.create.mock.calls[0][0];
      expect(data.tokenHash).toBe(hashDeToken(tokenDelMail()));
    });

    it('guarda el token con vencimiento a los 60 minutos del Reloj', async () => {
      prisma.usuario.findUnique.mockResolvedValue(socio);

      await servicio.procesarSolicitud('socio@club.test');

      const { data } = prisma.tokenRecuperacion.create.mock.calls[0][0];
      expect(data.creadoEn).toEqual(AHORA);
      expect(data.expiraEn).toEqual(new Date('2026-11-10T16:00:00.000Z'));
    });

    it('nunca guarda el token en claro', async () => {
      prisma.usuario.findUnique.mockResolvedValue(socio);

      await servicio.procesarSolicitud('socio@club.test');

      const guardado = JSON.stringify(prisma.tokenRecuperacion.create.mock.calls[0][0]);
      expect(guardado).not.toContain(tokenDelMail());
    });

    it('Token reemplazado por uno más nuevo: con el mail enviado, invalida solo los tokens anteriores al nuevo', async () => {
      prisma.usuario.findUnique.mockResolvedValue(socio);

      await servicio.procesarSolicitud('socio@club.test');

      expect(prisma.tokenRecuperacion.updateMany).toHaveBeenCalledWith({
        where: { usuarioId: 42, usadoEn: null, id: { lt: 99 } },
        data: { usadoEn: AHORA },
      });
    });

    it('invalida los anteriores recién después de enviar el mail', async () => {
      prisma.usuario.findUnique.mockResolvedValue(socio);
      const orden: string[] = [];
      const correoQueAnota: Correo = {
        enviar: () => {
          orden.push('envío');
          return Promise.resolve();
        },
      };
      prisma.tokenRecuperacion.updateMany.mockImplementation(() => {
        orden.push('invalidación');
        return Promise.resolve({ count: 1 });
      });
      servicio = crearServicio(correoQueAnota);

      await servicio.procesarSolicitud('socio@club.test');

      expect(orden).toEqual(['envío', 'invalidación']);
    });

    it('Mail con mayúsculas o espacios: busca la cuenta por el mail normalizado', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      await servicio.procesarSolicitud('  Socio@Club.TEST ');

      expect(prisma.usuario.findUnique.mock.calls[0][0].where).toEqual({ email: 'socio@club.test' });
    });

    it('Solicitud para un mail que no existe: no crea token ni envía mail', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      await servicio.procesarSolicitud('nadie@club.test');

      expect(prisma.tokenRecuperacion.create).not.toHaveBeenCalled();
      expect(correo.enviados).toHaveLength(0);
    });

    it('Solicitud para una cuenta inactiva: no crea token ni envía mail', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ ...socio, activo: false });

      await servicio.procesarSolicitud('socio@club.test');

      expect(prisma.tokenRecuperacion.create).not.toHaveBeenCalled();
      expect(correo.enviados).toHaveLength(0);
    });

    it('Cuarta solicitud para la misma cuenta en una hora: no envía ni invalida los tokens que ya tenía', async () => {
      prisma.usuario.findUnique.mockResolvedValue(socio);
      prisma.tokenRecuperacion.count.mockResolvedValue(3);

      await servicio.procesarSolicitud('socio@club.test');

      expect(prisma.tokenRecuperacion.updateMany).not.toHaveBeenCalled();
      expect(prisma.tokenRecuperacion.create).not.toHaveBeenCalled();
      expect(correo.enviados).toHaveLength(0);
    });

    it('cuenta los tokens de la última hora según el Reloj', async () => {
      prisma.usuario.findUnique.mockResolvedValue(socio);

      await servicio.procesarSolicitud('socio@club.test');

      expect(prisma.tokenRecuperacion.count).toHaveBeenCalledWith({
        where: { usuarioId: 42, creadoEn: { gt: new Date('2026-11-10T14:00:00.000Z') } },
      });
    });

    describe('Falla el proveedor de mail', () => {
      let textoEnviado: string;
      let log: jest.SpyInstance;

      beforeEach(() => {
        prisma.usuario.findUnique.mockResolvedValue(socio);
        textoEnviado = '';
        servicio = crearServicio({
          enviar: (mail) => {
            textoEnviado = mail.texto;
            return Promise.reject(new Error('Resend: no se puede enviar a socio@club.test'));
          },
        });
        log = jest.spyOn(servicio['logger'], 'error').mockImplementation(() => undefined);
      });

      it('no rechaza', async () => {
        await expect(servicio.procesarSolicitud('socio@club.test')).resolves.toBeUndefined();
      });

      it('el log lleva el id del usuario, sin el token, el mail ni el mensaje del proveedor', async () => {
        await servicio.procesarSolicitud('socio@club.test');

        const linea = String(log.mock.calls[0][0]);
        expect(linea).toContain('usuario 42');
        expect(linea).not.toContain(/token=(\S+)/.exec(textoEnviado)![1]);
        expect(linea).not.toContain('socio@club.test');
      });

      it('Falla el envío con un enlace anterior vigente: descarta el token nuevo y no toca los anteriores', async () => {
        await servicio.procesarSolicitud('socio@club.test');

        expect(prisma.tokenRecuperacion.delete).toHaveBeenCalledWith({ where: { id: 99 } });
        expect(prisma.tokenRecuperacion.updateMany).not.toHaveBeenCalled();
      });
    });
  });

  describe('solicitar', () => {
    it('no rechaza aunque falle la base, y el log no repite el mensaje del error', async () => {
      prisma.usuario.findUnique.mockRejectedValue(
        new Error('Invalid `prisma.usuario.findUnique()` invocation: where: { email: "socio@club.test" }'),
      );
      const log = jest.spyOn(servicio['logger'], 'error').mockImplementation(() => undefined);

      servicio.solicitar('socio@club.test');
      await new Promise((resolver) => setImmediate(resolver));

      expect(log).toHaveBeenCalledTimes(1);
      expect(String(log.mock.calls[0][0])).not.toContain('socio@club.test');
    });
  });

  describe('restablecer', () => {
    const vigente = {
      id: 7,
      usuarioId: 42,
      expiraEn: new Date('2026-11-10T15:30:00.000Z'),
      usadoEn: null,
      usuario: { activo: true },
    };

    it('Restablecimiento con un token válido: guarda un hash bcrypt de la nueva contraseña', async () => {
      prisma.tokenRecuperacion.findUnique.mockResolvedValue(vigente);

      await servicio.restablecer('token-del-mail', 'nuevaClave123');

      const { where, data } = prisma.usuario.update.mock.calls[0][0];
      expect(where).toEqual({ id: 42 });
      await expect(bcrypt.compare('nuevaClave123', data.passwordHash)).resolves.toBe(true);
    });

    it('Restablecer cierra las sesiones abiertas: marca la fecha del cambio con el Reloj', async () => {
      prisma.tokenRecuperacion.findUnique.mockResolvedValue(vigente);

      await servicio.restablecer('token-del-mail', 'nuevaClave123');

      expect(prisma.usuario.update.mock.calls[0][0].data.passwordCambiadaEn).toEqual(AHORA);
    });

    it('busca el token por su hash, no en claro', async () => {
      prisma.tokenRecuperacion.findUnique.mockResolvedValue(vigente);

      await servicio.restablecer('token-del-mail', 'nuevaClave123');

      expect(prisma.tokenRecuperacion.findUnique.mock.calls[0][0].where).toEqual({
        tokenHash: hashDeToken('token-del-mail'),
      });
    });

    it('invalida todos los tokens de la cuenta al restablecer', async () => {
      prisma.tokenRecuperacion.findUnique.mockResolvedValue(vigente);

      await servicio.restablecer('token-del-mail', 'nuevaClave123');

      expect(prisma.tokenRecuperacion.updateMany).toHaveBeenCalledWith({
        where: { usuarioId: 42, usadoEn: null },
        data: { usadoEn: AHORA },
      });
    });

    it.each([
      ['Token inventado', null],
      ['Token usado dos veces', { ...vigente, usadoEn: new Date('2026-11-10T14:50:00.000Z') }],
      ['Token vencido', { ...vigente, expiraEn: new Date('2026-11-10T14:59:59.000Z') }],
      ['cuenta inactiva', { ...vigente, usuario: { activo: false } }],
    ])('%s: responde ENLACE_INVALIDO y la contraseña no cambia', async (_caso, token) => {
      prisma.tokenRecuperacion.findUnique.mockResolvedValue(token);

      const error = await servicio.restablecer('token', 'nuevaClave123').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ErrorDeApi);
      expect(error).toMatchObject({ estado: 400, tipo: 'ENLACE_INVALIDO' });
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('vence justo en el instante de expiración', async () => {
      prisma.tokenRecuperacion.findUnique.mockResolvedValue({ ...vigente, expiraEn: AHORA });

      await expect(servicio.restablecer('token', 'nuevaClave123')).rejects.toMatchObject({
        tipo: 'ENLACE_INVALIDO',
      });
    });

    it('dos restablecimientos simultáneos con el mismo token: el que no marca la fila no cambia la contraseña', async () => {
      prisma.tokenRecuperacion.findUnique.mockResolvedValue(vigente);
      prisma.tokenRecuperacion.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(servicio.restablecer('token', 'nuevaClave123')).rejects.toMatchObject({
        tipo: 'ENLACE_INVALIDO',
      });
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });
  });
});
