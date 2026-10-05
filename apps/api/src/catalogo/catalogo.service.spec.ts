import { Prisma } from '@prisma/client';
import { SolicitudConUsuario } from '../common/usuario-actual';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogoService } from './catalogo.service';

type PrismaFalso = {
  disciplina: { findMany: jest.Mock; findUnique: jest.Mock };
  cancha: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  equipamiento: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  reservaEquipamiento: { groupBy: jest.Mock };
};

const anonimo = {} as SolicitudConUsuario;
const socio = { usuario: { id: 1, rol: 'SOCIO' } } as SolicitudConUsuario;
const admin = { usuario: { id: 2, rol: 'ADMIN' } } as SolicitudConUsuario;

const paleta = {
  id: 7,
  disciplinaId: 2,
  nombre: 'Paleta de pádel',
  stockTotal: 6,
  precioPorTurno: new Prisma.Decimal('2500'),
  activo: true,
};

describe('CatalogoService', () => {
  let prisma: PrismaFalso;
  let servicio: CatalogoService;

  beforeEach(() => {
    prisma = {
      disciplina: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
      cancha: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      equipamiento: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      reservaEquipamiento: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    servicio = new CatalogoService(prisma as unknown as PrismaService);
  });

  describe('disciplinas', () => {
    it('pide solo las activas, ordenadas por id', async () => {
      await servicio.disciplinas();
      expect(prisma.disciplina.findMany).toHaveBeenCalledWith({
        where: { activa: true },
        orderBy: { id: 'asc' },
      });
    });
  });

  describe('listarCanchas', () => {
    it('sin parámetros de administración filtra por activa e incluye la disciplina', async () => {
      await servicio.listarCanchas({}, anonimo);
      expect(prisma.cancha.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { activa: true },
          include: { disciplina: { select: { nombre: true } } },
        }),
      );
    });

    it('aplica los filtros disciplinaId y techada', async () => {
      await servicio.listarCanchas({ disciplinaId: 2, techada: true }, anonimo);
      expect(prisma.cancha.findMany.mock.calls[0][0].where).toEqual({
        activa: true,
        disciplinaId: 2,
        techada: true,
      });
    });

    it('incluirInactivas sin usuario responde 401 y no consulta', async () => {
      await expect(servicio.listarCanchas({ incluirInactivas: true }, anonimo)).rejects.toMatchObject({
        estado: 401,
      });
      expect(prisma.cancha.findMany).not.toHaveBeenCalled();
    });

    it('incluirInactivas con SOCIO responde 403 y no consulta', async () => {
      await expect(servicio.listarCanchas({ incluirInactivas: true }, socio)).rejects.toMatchObject({
        estado: 403,
        tipo: 'SIN_PERMISOS',
      });
      expect(prisma.cancha.findMany).not.toHaveBeenCalled();
    });

    it('incluirInactivas con ADMIN consulta sin el filtro activa', async () => {
      await servicio.listarCanchas({ incluirInactivas: true }, admin);
      expect(prisma.cancha.findMany.mock.calls[0][0].where).toEqual({});
    });
  });

  describe('listarEquipamiento', () => {
    it('Catálogo sin fecha: devuelve stockTotal sin stockDisponible y no cuenta alquileres', async () => {
      prisma.equipamiento.findMany.mockResolvedValue([paleta]);

      const [item] = await servicio.listarEquipamiento({}, anonimo);

      expect(item).toMatchObject({ stockTotal: 6, precioPorTurno: 2500 });
      expect(item).not.toHaveProperty('stockDisponible');
      expect(prisma.reservaEquipamiento.groupBy).not.toHaveBeenCalled();
    });

    it('Stock disponible en un turno con alquileres: 6 menos 2 alquiladas da 4', async () => {
      prisma.equipamiento.findMany.mockResolvedValue([paleta]);
      prisma.reservaEquipamiento.groupBy.mockResolvedValue([
        { equipamientoId: 7, _sum: { cantidad: 2 } },
      ]);

      const [item] = await servicio.listarEquipamiento(
        { fecha: '2026-09-15', horaInicio: '20:00' },
        anonimo,
      );

      expect(item.stockDisponible).toBe(4);
      expect(prisma.reservaEquipamiento.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['equipamientoId'],
          where: {
            reserva: {
              fecha: new Date('2026-09-15T00:00:00.000Z'),
              horaInicio: '20:00',
              estado: { not: 'CANCELADA' },
            },
          },
        }),
      );
    });

    it('el stock disponible nunca baja de 0', async () => {
      prisma.equipamiento.findMany.mockResolvedValue([paleta]);
      prisma.reservaEquipamiento.groupBy.mockResolvedValue([
        { equipamientoId: 7, _sum: { cantidad: 9 } },
      ]);

      const [item] = await servicio.listarEquipamiento(
        { fecha: '2026-09-15', horaInicio: '20:00' },
        anonimo,
      );
      expect(item.stockDisponible).toBe(0);
    });

    it('un ítem sin alquileres en el turno tiene todo el stock disponible', async () => {
      prisma.equipamiento.findMany.mockResolvedValue([paleta]);

      const [item] = await servicio.listarEquipamiento(
        { fecha: '2026-09-15', horaInicio: '20:00' },
        anonimo,
      );
      expect(item.stockDisponible).toBe(6);
    });

    it('Fecha sin hora de inicio: 400 SOLICITUD_INVALIDA, en los dos sentidos', async () => {
      for (const filtros of [{ fecha: '2026-09-15' }, { horaInicio: '20:00' }]) {
        await expect(servicio.listarEquipamiento(filtros, anonimo)).rejects.toMatchObject({
          estado: 400,
          tipo: 'SOLICITUD_INVALIDA',
        });
      }
      expect(prisma.equipamiento.findMany).not.toHaveBeenCalled();
    });

    it('incluirInactivos exige ADMIN igual que en canchas', async () => {
      await expect(servicio.listarEquipamiento({ incluirInactivos: true }, socio)).rejects.toMatchObject({
        estado: 403,
      });
      await servicio.listarEquipamiento({ incluirInactivos: true }, admin);
      expect(prisma.equipamiento.findMany.mock.calls[0][0].where).toEqual({});
    });
  });

  describe('administración de canchas', () => {
    const padel = { id: 2, nombre: 'Pádel', duracionTurnoMin: 90, activa: true };
    const pista = {
      id: 9,
      disciplinaId: 2,
      nombre: 'Pádel 4',
      superficie: null,
      techada: false,
      precioPorTurno: new Prisma.Decimal('15000'),
      activa: true,
      disciplina: { nombre: 'Pádel' },
    };
    const alta = { disciplinaId: 2, nombre: 'Pádel 4', techada: false, precioPorTurno: 15000 };
    const duplicado = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.19.3',
      meta: { modelName: 'Cancha', target: ['disciplina_id', 'nombre'] },
    });

    it('Alta de una cancha: la crea activa, sin superficie y con el precio como Decimal exacto', async () => {
      prisma.disciplina.findUnique.mockResolvedValue(padel);
      prisma.cancha.create.mockResolvedValue(pista);

      const cancha = await servicio.crearCancha({ ...alta, precioPorTurno: 15000.1 });

      const { data } = prisma.cancha.create.mock.calls[0][0];
      expect(data).toMatchObject({ disciplinaId: 2, nombre: 'Pádel 4', superficie: null, techada: false });
      expect(data.precioPorTurno.toString()).toBe('15000.1');
      expect(cancha).toMatchObject({ id: 9, disciplina: 'Pádel', precioPorTurno: 15000, activa: true });
    });

    it('Disciplina inexistente o inactiva: 404 sin intentar crear', async () => {
      for (const disciplina of [null, { ...padel, activa: false }]) {
        prisma.disciplina.findUnique.mockResolvedValue(disciplina);
        await expect(servicio.crearCancha(alta)).rejects.toMatchObject({ estado: 404, tipo: 'NO_ENCONTRADO' });
      }
      expect(prisma.cancha.create).not.toHaveBeenCalled();
    });

    it('Nombre repetido en la disciplina: el P2002 del único pasa a 409 NOMBRE_DUPLICADO', async () => {
      prisma.disciplina.findUnique.mockResolvedValue(padel);
      prisma.cancha.create.mockRejectedValue(duplicado);
      await expect(servicio.crearCancha(alta)).rejects.toMatchObject({
        estado: 409,
        tipo: 'NOMBRE_DUPLICADO',
      });
    });

    it('otro error de Prisma no se disfraza de 409', async () => {
      prisma.disciplina.findUnique.mockResolvedValue(padel);
      const otro = new Error('se cayó la conexión');
      prisma.cancha.create.mockRejectedValue(otro);
      await expect(servicio.crearCancha(alta)).rejects.toBe(otro);
    });

    it('la edición cambia solo lo que vino, y superficie en null la borra', async () => {
      prisma.cancha.findUnique.mockResolvedValue(pista);
      prisma.cancha.update.mockResolvedValue(pista);

      await servicio.actualizarCancha(9, { precioPorTurno: 16000, superficie: null });

      const { where, data } = prisma.cancha.update.mock.calls[0][0];
      expect(where).toEqual({ id: 9 });
      expect(Object.keys(data).sort()).toEqual(['precioPorTurno', 'superficie']);
      expect(data.superficie).toBeNull();
      expect(data.precioPorTurno.toString()).toBe('16000');
    });

    it('un PATCH sin ningún valor es 400 antes de buscar la cancha', async () => {
      await expect(
        servicio.actualizarCancha(9, { nombre: undefined, activa: undefined }),
      ).rejects.toMatchObject({ estado: 400, tipo: 'SOLICITUD_INVALIDA' });
      expect(prisma.cancha.findUnique).not.toHaveBeenCalled();
    });

    it('Cancha inexistente: 404, también con un id fuera del rango de la columna', async () => {
      prisma.cancha.findUnique.mockResolvedValue(null);
      for (const id of [999, 0, -1, 2_147_483_648]) {
        await expect(servicio.actualizarCancha(id, { activa: false })).rejects.toMatchObject({
          estado: 404,
          tipo: 'NO_ENCONTRADO',
        });
      }
      expect(prisma.cancha.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.cancha.update).not.toHaveBeenCalled();
    });

    it('Nombre repetido al editar: 409 NOMBRE_DUPLICADO', async () => {
      prisma.cancha.findUnique.mockResolvedValue(pista);
      prisma.cancha.update.mockRejectedValue(duplicado);
      await expect(servicio.actualizarCancha(9, { nombre: 'Pádel 1' })).rejects.toMatchObject({
        estado: 409,
        tipo: 'NOMBRE_DUPLICADO',
      });
    });
  });

  describe('administración de equipamiento', () => {
    const tenis = { id: 1, nombre: 'Tenis', duracionTurnoMin: 60, activa: true };
    const visera = {
      id: 12,
      disciplinaId: 1,
      nombre: 'Visera',
      stockTotal: 8,
      precioPorTurno: new Prisma.Decimal('1000'),
      activo: true,
      disciplina: { nombre: 'Tenis' },
    };
    const alta = { disciplinaId: 1, nombre: 'Visera', stockTotal: 8, precioPorTurno: 1000 };
    const duplicado = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.19.3',
      meta: { modelName: 'Equipamiento', target: ['disciplina_id', 'nombre'] },
    });

    it('Alta de equipamiento: lo crea con el stock y el precio, y responde con la forma del contrato', async () => {
      prisma.disciplina.findUnique.mockResolvedValue(tenis);
      prisma.equipamiento.create.mockResolvedValue(visera);

      const item = await servicio.crearEquipamiento(alta);

      const { data } = prisma.equipamiento.create.mock.calls[0][0];
      expect(data).toMatchObject({ disciplinaId: 1, nombre: 'Visera', stockTotal: 8 });
      expect(data.precioPorTurno.toString()).toBe('1000');
      expect(item).toEqual({
        id: 12,
        nombre: 'Visera',
        disciplinaId: 1,
        stockTotal: 8,
        precioPorTurno: 1000,
        activo: true,
      });
    });

    it('Disciplina o ítem inexistente: 404 en el alta y en la edición', async () => {
      prisma.disciplina.findUnique.mockResolvedValue({ ...tenis, activa: false });
      await expect(servicio.crearEquipamiento(alta)).rejects.toMatchObject({ estado: 404 });

      prisma.equipamiento.findUnique.mockResolvedValue(null);
      await expect(servicio.actualizarEquipamiento(99, { stockTotal: 3 })).rejects.toMatchObject({
        estado: 404,
        tipo: 'NO_ENCONTRADO',
      });
      expect(prisma.equipamiento.create).not.toHaveBeenCalled();
      expect(prisma.equipamiento.update).not.toHaveBeenCalled();
    });

    it('Nombre repetido en la disciplina: 409 en el alta y en la edición', async () => {
      prisma.disciplina.findUnique.mockResolvedValue(tenis);
      prisma.equipamiento.create.mockRejectedValue(duplicado);
      await expect(servicio.crearEquipamiento(alta)).rejects.toMatchObject({ estado: 409, tipo: 'NOMBRE_DUPLICADO' });

      prisma.equipamiento.findUnique.mockResolvedValue(visera);
      prisma.equipamiento.update.mockRejectedValue(duplicado);
      await expect(servicio.actualizarEquipamiento(12, { nombre: 'Raqueta' })).rejects.toMatchObject({
        estado: 409,
        tipo: 'NOMBRE_DUPLICADO',
      });
    });

    it('la edición cambia solo lo que vino', async () => {
      prisma.equipamiento.findUnique.mockResolvedValue(visera);
      prisma.equipamiento.update.mockResolvedValue({ ...visera, stockTotal: 3 });

      const item = await servicio.actualizarEquipamiento(12, { stockTotal: 3 });

      expect(prisma.equipamiento.update.mock.calls[0][0]).toEqual({ where: { id: 12 }, data: { stockTotal: 3 } });
      expect(item.stockTotal).toBe(3);
    });

    it('un PATCH sin ningún valor es 400', async () => {
      await expect(servicio.actualizarEquipamiento(12, {})).rejects.toMatchObject({
        estado: 400,
        tipo: 'SOLICITUD_INVALIDA',
      });
    });
  });
});
