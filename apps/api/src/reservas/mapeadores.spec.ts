import { Prisma } from '@prisma/client';
import { aReserva } from './mapeadores';

const reservaDb = (extra: Record<string, unknown> = {}) =>
  ({
    id: 128,
    codigo: 'RES-A7F3K2',
    usuarioId: 42,
    canchaId: 3,
    fecha: new Date('2026-09-15T00:00:00.000Z'),
    horaInicio: '20:00',
    horaFin: '21:30',
    cantidadJugadores: 4,
    estado: 'CONFIRMADA',
    montoCancha: new Prisma.Decimal('14000.00'),
    montoEquipamiento: new Prisma.Decimal('5000.00'),
    montoTotal: new Prisma.Decimal('19000.00'),
    creadaEn: new Date('2026-09-01T14:32:10.000Z'),
    canceladaEn: null,
    canceladaPorId: null,
    motivoCancelacion: null,
    cancha: { nombre: 'Panorámica 1' },
    equipamiento: [
      {
        id: 1,
        reservaId: 128,
        equipamientoId: 7,
        cantidad: 2,
        precioUnitario: new Prisma.Decimal('2500.00'),
        equipamiento: { nombre: 'Paleta de pádel' },
      },
    ],
    ...extra,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe('aReserva', () => {
  it('serializa el dinero como número y no como string', () => {
    const json = JSON.stringify(aReserva(reservaDb()));
    expect(json).toContain('"montoCancha":14000');
    expect(json).toContain('"montoEquipamiento":5000');
    expect(json).toContain('"montoTotal":19000');
    expect(json).not.toContain('"19000"');
  });

  it('arma el desglose de equipamiento con el precio congelado y su subtotal', () => {
    expect(aReserva(reservaDb()).equipamiento).toEqual([
      {
        equipamientoId: 7,
        nombre: 'Paleta de pádel',
        cantidad: 2,
        precioUnitario: 2500,
        subtotal: 5000,
      },
    ]);
  });

  it('pasa la fecha del @db.Date al YYYY-MM-DD del contrato', () => {
    expect(aReserva(reservaDb()).fecha).toBe('2026-09-15');
  });

  it('informa el titular en clienteId y el nombre de la cancha', () => {
    const reserva = aReserva(reservaDb());
    expect(reserva.clienteId).toBe(42);
    expect(reserva.cancha).toBe('Panorámica 1');
  });

  // Escenario "Sin cantidad de jugadores": la clave viaja en null, no ausente.
  it('devuelve cantidadJugadores en null cuando no se informó', () => {
    const reserva = aReserva(reservaDb({ cantidadJugadores: null }));
    expect(reserva.cantidadJugadores).toBeNull();
    expect(JSON.stringify(reserva)).toContain('"cantidadJugadores":null');
  });

  it('una reserva sin equipamiento sale con la lista vacía y monto cero', () => {
    const reserva = aReserva(
      reservaDb({
        equipamiento: [],
        montoEquipamiento: new Prisma.Decimal('0'),
        montoTotal: new Prisma.Decimal('14000.00'),
      }),
    );
    expect(reserva.equipamiento).toEqual([]);
    expect(reserva.montoEquipamiento).toBe(0);
  });
});
