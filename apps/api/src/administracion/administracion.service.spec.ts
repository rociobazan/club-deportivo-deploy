import { Prisma } from '@prisma/client';
import { Reloj } from '../common/reloj';
import type { Configuracion } from '../configuracion';
import { PrismaService } from '../prisma/prisma.service';
import { AdministracionService } from './administracion.service';

const configuracion = {
  zonaHoraria: 'America/Argentina/Cordoba',
  horaApertura: '08:00',
  horaCierre: '23:00',
  horaCierreSabado: '18:00',
  diasCerrados: [0],
  cancelacionMinutosMinimos: 120,
} as unknown as Configuracion;

describe('AdministracionService', () => {
  let canceladas: { fecha: Date; horaInicio: string; canceladaEn: Date }[];
  let noCanceladas: unknown[];
  let prisma: { cancha: { findMany: jest.Mock }; reserva: { findMany: jest.Mock } };
  let servicio: AdministracionService;

  beforeEach(() => {
    canceladas = [];
    noCanceladas = [];
    prisma = {
      cancha: { findMany: jest.fn().mockResolvedValue([]) },
      reserva: {
        // La consulta de las canceladas pide `estado: 'CANCELADA'`; la otra, las que no lo están.
        findMany: jest.fn(({ where }) =>
          Promise.resolve(where.estado === 'CANCELADA' ? canceladas : noCanceladas),
        ),
      },
    };
    servicio = new AdministracionService(
      prisma as unknown as PrismaService,
      new Reloj(configuracion),
      configuracion,
    );
  });

  it('cuenta las cancelaciones por la fecha local del club, no por la fecha UTC', async () => {
    // Córdoba es UTC-3: las dos caen el 21/09 en UTC, pero la primera fue el 20/09 a las 23:30 en el club.
    canceladas = [
      { fecha: new Date('2026-09-22T00:00:00Z'), horaInicio: '20:00', canceladaEn: new Date('2026-09-21T02:30:00Z') },
      { fecha: new Date('2026-09-22T00:00:00Z'), horaInicio: '20:00', canceladaEn: new Date('2026-09-21T03:30:00Z') },
    ];

    const panel = await servicio.panel('2026-09-21');

    expect(panel.cancelacionesDelDia).toBe(1);
  });

  it('pide las cancelaciones en una ventana holgada y las reservas de los 7 días', async () => {
    await servicio.panel('2026-09-21');

    const consultas = prisma.reserva.findMany.mock.calls.map(([args]) => args.where);
    expect(consultas).toContainEqual({
      estado: { not: 'CANCELADA' },
      fecha: { gte: new Date('2026-09-15T00:00:00Z'), lte: new Date('2026-09-21T00:00:00Z') },
    });
    expect(consultas).toContainEqual({
      estado: 'CANCELADA',
      canceladaEn: { gte: new Date('2026-09-20T00:00:00Z'), lt: new Date('2026-09-23T00:00:00Z') },
    });
    expect(prisma.cancha.findMany.mock.calls[0][0].where).toEqual({ activa: true });
  });

  it('arma la reserva para el cálculo con el titular y la facturación en número', async () => {
    noCanceladas = [
      {
        id: 7,
        canchaId: 3,
        fecha: new Date('2026-09-21T00:00:00Z'),
        horaInicio: '20:00',
        cantidadJugadores: null,
        montoTotal: new Prisma.Decimal('19000'),
        cancha: { nombre: 'Pádel 1', disciplina: { nombre: 'Pádel' } },
        usuario: { nombre: 'Bruno', apellido: 'Socio' },
      },
    ];

    const panel = await servicio.panel('2026-09-21');

    expect(panel).toMatchObject({ fecha: '2026-09-21', reservasDelDia: 1, facturacionPrevista: 19000 });
    expect(panel.proximosTurnos[0]).toMatchObject({ reservaId: 7, cliente: 'Bruno Socio', cantidadJugadores: null });
  });
});
