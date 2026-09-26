import { Prisma } from '@prisma/client';
import { SolicitudConUsuario } from '../common/usuario-actual';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogoService } from './catalogo.service';

type PrismaFalso = {
  disciplina: { findMany: jest.Mock };
  cancha: { findMany: jest.Mock };
  equipamiento: { findMany: jest.Mock };
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
      disciplina: { findMany: jest.fn().mockResolvedValue([]) },
      cancha: { findMany: jest.fn().mockResolvedValue([]) },
      equipamiento: { findMany: jest.fn().mockResolvedValue([]) },
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
});
