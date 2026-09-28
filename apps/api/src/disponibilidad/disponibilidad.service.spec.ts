import { Prisma } from '@prisma/client';
import { Momento, Reloj } from '../common/reloj';
import type { Configuracion } from '../configuracion';
import { PrismaService } from '../prisma/prisma.service';
import { DisponibilidadService } from './disponibilidad.service';

type PrismaFalso = {
  cancha: { findMany: jest.Mock };
  reserva: { findMany: jest.Mock };
};

const configuracion = {
  horaApertura: '08:00',
  horaCierre: '23:00',
  horaCierreSabado: '18:00',
  diasCerrados: [0],
} as Configuracion;

// 2026-09-20 es domingo y 2026-09-19 sábado: las pruebas de la grilla completa
// usan el lunes, para no depender de a qué día cae la fecha elegida.
const LUNES = '2026-09-21';
const SABADO = '2026-09-19';
const DOMINGO = '2026-09-20';

const tenis1 = {
  id: 1,
  disciplinaId: 1,
  nombre: 'Cancha 1',
  superficie: null,
  techada: false,
  precioPorTurno: new Prisma.Decimal('9000'),
  activa: true,
  disciplina: { nombre: 'Tenis', duracionTurnoMin: 60 },
};
const tenis2 = { ...tenis1, id: 2, nombre: 'Cancha 2' };

describe('DisponibilidadService', () => {
  let prisma: PrismaFalso;
  let momento: Momento;
  let servicio: DisponibilidadService;

  beforeEach(() => {
    prisma = {
      cancha: { findMany: jest.fn().mockResolvedValue([tenis1, tenis2]) },
      reserva: { findMany: jest.fn().mockResolvedValue([]) },
    };
    momento = { fecha: '2026-09-15', hora: '10:00' };
    const reloj = { ahora: () => momento } as Reloj;
    servicio = new DisponibilidadService(prisma as unknown as PrismaService, reloj, configuracion);
  });

  it('Fecha anterior a hoy: 400 SOLICITUD_INVALIDA sin consultar la base', async () => {
    await expect(servicio.consultar({ fecha: '2026-09-14' })).rejects.toMatchObject({
      estado: 400,
      tipo: 'SOLICITUD_INVALIDA',
    });
    expect(prisma.cancha.findMany).not.toHaveBeenCalled();
  });

  it('un día futuro sin reservas devuelve la grilla completa con el precio como número', async () => {
    const { fecha, canchas } = await servicio.consultar({ fecha: LUNES });

    expect(fecha).toBe(LUNES);
    expect(canchas).toHaveLength(2);
    expect(canchas[0]).toMatchObject({ canchaId: 1, nombre: 'Cancha 1', disciplina: 'Tenis', precioPorTurno: 9000 });
    expect(canchas[0].slots).toHaveLength(15);
    expect(canchas[0].slots[0]).toEqual({ horaInicio: '08:00', horaFin: '09:00' });
  });

  it('Domingo: el club no abre, así que ninguna cancha ofrece turnos', async () => {
    const { canchas } = await servicio.consultar({ fecha: DOMINGO });

    expect(canchas).toHaveLength(2);
    for (const cancha of canchas) expect(cancha.slots).toEqual([]);
  });

  it('Sábado: cierra a las 18, así que el último turno termina ahí', async () => {
    const { canchas } = await servicio.consultar({ fecha: SABADO });

    expect(canchas[0].slots).toHaveLength(10);
    expect(canchas[0].slots[0]).toEqual({ horaInicio: '08:00', horaFin: '09:00' });
    expect(canchas[0].slots.at(-1)).toEqual({ horaInicio: '17:00', horaFin: '18:00' });
  });

  it('Turno ocupado: una reserva a las 19:00 quita solo ese bloque de esa cancha', async () => {
    prisma.reserva.findMany.mockResolvedValue([{ canchaId: 1, horaInicio: '19:00' }]);

    const { canchas } = await servicio.consultar({ fecha: LUNES });

    expect(canchas[0].slots.map((s) => s.horaInicio)).not.toContain('19:00');
    expect(canchas[0].slots).toHaveLength(14);
    expect(canchas[1].slots.map((s) => s.horaInicio)).toContain('19:00');
  });

  it('Consulta de hoy a media tarde: a las 14:00 el primer turno es 14:00-15:00', async () => {
    momento = { fecha: '2026-09-15', hora: '14:00' };

    const { canchas } = await servicio.consultar({ fecha: '2026-09-15' });

    expect(canchas[0].slots[0]).toEqual({ horaInicio: '14:00', horaFin: '15:00' });
    expect(canchas[0].slots.some((s) => s.horaInicio < '14:00')).toBe(false);
  });

  it('hoy a las 14:30 tampoco ofrece el turno de las 14:00, que ya empezó', async () => {
    momento = { fecha: '2026-09-15', hora: '14:30' };

    const { canchas } = await servicio.consultar({ fecha: '2026-09-15' });

    expect(canchas[0].slots[0].horaInicio).toBe('15:00');
  });

  it('solo trae canchas activas de disciplinas activas y aplica los filtros', async () => {
    await servicio.consultar({ fecha: LUNES, disciplinaId: 1, canchaId: 2 });

    expect(prisma.cancha.findMany.mock.calls[0][0].where).toEqual({
      activa: true,
      disciplina: { activa: true },
      disciplinaId: 1,
      id: 2,
    });
  });

  it('busca las reservas de la fecha solo para esas canchas y sin las canceladas', async () => {
    await servicio.consultar({ fecha: LUNES });

    expect(prisma.reserva.findMany).toHaveBeenCalledWith({
      where: {
        fecha: new Date(`${LUNES}T00:00:00.000Z`),
        estado: { not: 'CANCELADA' },
        canchaId: { in: [1, 2] },
      },
      select: { canchaId: true, horaInicio: true },
    });
  });

  it('sin canchas no consulta reservas y devuelve una lista vacía', async () => {
    prisma.cancha.findMany.mockResolvedValue([]);

    const { canchas } = await servicio.consultar({ fecha: LUNES, disciplinaId: 9999 });

    expect(canchas).toEqual([]);
    expect(prisma.reserva.findMany).not.toHaveBeenCalled();
  });
});
