import { Prisma } from '@prisma/client';
import type { Momento } from '../common/reloj';
import { aReserva, ReservaConDetalle, turnoTermino } from './mapeadores';

const base: ReservaConDetalle = {
  id: 128,
  codigo: 'RES-A7F3K2',
  usuarioId: 42,
  canchaId: 3,
  fecha: new Date('2026-09-15T00:00:00.000Z'),
  horaInicio: '19:00',
  horaFin: '20:30',
  cantidadJugadores: 4,
  estado: 'CONFIRMADA',
  montoCancha: new Prisma.Decimal('14000'),
  montoEquipamiento: new Prisma.Decimal('5000'),
  montoTotal: new Prisma.Decimal('19000'),
  creadaEn: new Date('2026-09-01T14:32:10.000Z'),
  canceladaEn: null,
  canceladaPorId: null,
  motivoCancelacion: null,
  usuario: { nombre: 'Jeremías', apellido: 'Gómez', email: 'jeremias@e2e.test' },
  cancha: {
    id: 3,
    disciplinaId: 2,
    nombre: 'Pádel 1',
    superficie: null,
    techada: true,
    precioPorTurno: new Prisma.Decimal('14000'),
    activa: true,
    disciplina: { nombre: 'Pádel' },
  },
  equipamiento: [
    {
      id: 1,
      reservaId: 128,
      equipamientoId: 7,
      cantidad: 2,
      precioUnitario: new Prisma.Decimal('2500'),
      equipamiento: { nombre: 'Paleta de pádel' },
    },
  ],
};

describe('aReserva', () => {
  it('da montos numéricos, no Decimal', () => {
    const ahora: Momento = { fecha: '2026-09-01', hora: '10:00' };
    const publica = aReserva(base, ahora);

    expect(JSON.parse(JSON.stringify(publica))).toMatchObject({
      montoCancha: 14000,
      montoEquipamiento: 5000,
      montoTotal: 19000,
    });
    expect(publica.equipamiento[0]).toEqual({
      equipamientoId: 7,
      nombre: 'Paleta de pádel',
      cantidad: 2,
      precioUnitario: 2500,
      subtotal: 5000,
    });
  });

  it('cliente es el nombre y apellido del titular', () => {
    const ahora: Momento = { fecha: '2026-09-01', hora: '10:00' };
    expect(aReserva(base, ahora).cliente).toBe('Jeremías Gómez');
  });

  it('una reserva CONFIRMADA con el turno ya terminado mapea a COMPLETADA', () => {
    const ahora: Momento = { fecha: '2026-09-16', hora: '10:00' };
    expect(aReserva(base, ahora).estado).toBe('COMPLETADA');
  });

  it('una reserva CONFIRMADA con el turno todavía no terminado sigue CONFIRMADA', () => {
    const ahora: Momento = { fecha: '2026-09-15', hora: '19:30' };
    expect(aReserva(base, ahora).estado).toBe('CONFIRMADA');
  });

  it('una reserva CANCELADA nunca deriva a COMPLETADA', () => {
    const cancelada = { ...base, estado: 'CANCELADA' as const };
    const ahora: Momento = { fecha: '2026-09-16', hora: '10:00' };
    expect(aReserva(cancelada, ahora).estado).toBe('CANCELADA');
  });
});

describe('turnoTermino', () => {
  const ahora: Momento = { fecha: '2026-09-15', hora: '20:30' };

  it('una fecha anterior a hoy ya terminó', () => {
    expect(turnoTermino('2026-09-14', '23:00', ahora)).toBe(true);
  });

  it('el límite es inclusivo: termina justo ahora cuenta como terminado', () => {
    expect(turnoTermino('2026-09-15', '20:30', ahora)).toBe(true);
  });

  it('un turno que termina después de ahora no terminó', () => {
    expect(turnoTermino('2026-09-15', '20:31', ahora)).toBe(false);
  });

  it('una fecha futura no terminó', () => {
    expect(turnoTermino('2026-09-16', '08:00', ahora)).toBe(false);
  });
});
