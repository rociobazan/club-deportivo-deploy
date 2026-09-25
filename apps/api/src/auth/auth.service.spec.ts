import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

type PrismaFalso = {
  usuario: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
};

const socio = {
  id: 42,
  nombre: 'Bruno',
  apellido: 'Socio',
  email: 'socio@club.test',
  telefono: null,
  rol: 'SOCIO' as const,
  activo: true,
  creadoEn: new Date('2026-09-01T00:00:00Z'),
  passwordHash: bcrypt.hashSync('clave1234', 10),
};

const publico = {
  id: 42,
  nombre: 'Bruno',
  apellido: 'Socio',
  email: 'socio@club.test',
  telefono: null,
  rol: 'SOCIO',
};

describe('AuthService', () => {
  let prisma: PrismaFalso;
  let servicio: AuthService;

  beforeEach(() => {
    prisma = { usuario: { findUnique: jest.fn(), create: jest.fn() } };
    const jwt = new JwtService({ secret: 'secreto-de-prueba', signOptions: { expiresIn: '1h' } });
    servicio = new AuthService(prisma as unknown as PrismaService, jwt);
  });

  describe('registrar', () => {
    const datos = {
      nombre: 'Ana',
      apellido: 'Nueva',
      email: 'Ana@Club.test',
      password: 'unaClaveSegura123',
    };

    it('Registro con un mail nuevo: crea con rol SOCIO y devuelve el usuario sin la contraseña', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockResolvedValue({
        ...publico,
        id: 7,
        nombre: 'Ana',
        apellido: 'Nueva',
        email: 'ana@club.test',
      });

      const resultado = await servicio.registrar(datos);

      expect(resultado).not.toHaveProperty('passwordHash');
      expect(resultado).not.toHaveProperty('password');
      expect(resultado.email).toBe('ana@club.test');
      const { data } = prisma.usuario.create.mock.calls[0][0];
      expect(data).not.toHaveProperty('rol');
      expect(data.email).toBe('ana@club.test');
    });

    it('Contraseña hasheada al registrarse: persiste un hash bcrypt distinto de la clave', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockResolvedValue(publico);

      await servicio.registrar(datos);

      const { passwordHash } = prisma.usuario.create.mock.calls[0][0].data;
      expect(passwordHash).not.toBe(datos.password);
      await expect(bcrypt.compare(datos.password, passwordHash)).resolves.toBe(true);
    });

    it('Mail ya registrado: responde 409 EMAIL_YA_REGISTRADO y no crea nada', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ id: 1 });

      await expect(servicio.registrar(datos)).rejects.toMatchObject({
        estado: 409,
        tipo: 'EMAIL_YA_REGISTRADO',
      });
      expect(prisma.usuario.create).not.toHaveBeenCalled();
    });

    it('si dos registros compiten y el índice único rechaza el segundo, también responde 409', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(servicio.registrar(datos)).rejects.toMatchObject({ estado: 409 });
    });
  });

  describe('ingresar', () => {
    it('Credenciales válidas: devuelve accessToken con sub y rol, expiraEn y el usuario sin hash', async () => {
      prisma.usuario.findUnique.mockResolvedValue(socio);

      const respuesta = await servicio.ingresar({ email: 'socio@club.test', password: 'clave1234' });

      const payload = new JwtService({ secret: 'secreto-de-prueba' }).verify<{ sub: number; rol: string }>(
        respuesta.accessToken,
      );
      expect(payload.sub).toBe(42);
      expect(payload.rol).toBe('SOCIO');
      expect(respuesta.usuario).toEqual(publico);
      expect(respuesta.usuario).not.toHaveProperty('passwordHash');
    });

    it('Vigencia informada: con JWT_EXPIRES_IN de 1h, expiraEn vale 3600', async () => {
      prisma.usuario.findUnique.mockResolvedValue(socio);

      const { expiraEn } = await servicio.ingresar({ email: 'socio@club.test', password: 'clave1234' });

      expect(expiraEn).toBe(3600);
    });

    it('Contraseña incorrecta: 401 con mensaje genérico', async () => {
      prisma.usuario.findUnique.mockResolvedValue(socio);

      await expect(
        servicio.ingresar({ email: 'socio@club.test', password: 'incorrecta' }),
      ).rejects.toMatchObject({ estado: 401, tipo: 'CREDENCIALES_INVALIDAS' });
    });

    it('Mail inexistente: el mismo tipo y el mismo titulo que ante contraseña incorrecta', async () => {
      prisma.usuario.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(socio);

      const porMail = await servicio
        .ingresar({ email: 'nadie@club.test', password: 'clave1234' })
        .catch((e: { getResponse(): object }) => e.getResponse());
      const porClave = await servicio
        .ingresar({ email: 'socio@club.test', password: 'incorrecta' })
        .catch((e: { getResponse(): object }) => e.getResponse());

      expect(porMail).toEqual(porClave);
    });

    it('normaliza el mail antes de buscar', async () => {
      prisma.usuario.findUnique.mockResolvedValue(socio);

      await servicio.ingresar({ email: '  Socio@Club.test ', password: 'clave1234' });

      expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { email: 'socio@club.test' },
      });
    });
  });

  describe('perfil', () => {
    it('Consulta del propio perfil: devuelve los datos públicos por id', async () => {
      prisma.usuario.findUnique.mockResolvedValue(publico);

      await expect(servicio.perfil(42)).resolves.toEqual(publico);
    });

    it('si el usuario del token ya no existe responde 401', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      await expect(servicio.perfil(99)).rejects.toMatchObject({ estado: 401 });
    });
  });
});
