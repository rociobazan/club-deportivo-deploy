import { Prisma } from '@prisma/client';
import { ErrorDeApi } from '../common/error-de-api';
import { Reloj } from '../common/reloj';
import type { UsuarioAutenticado } from '../common/usuario-actual';
import { leerConfiguracion } from '../configuracion';
import type { Configuracion } from '../configuracion';
import { PrismaService } from '../prisma/prisma.service';
import { ReservasService } from './reservas.service';

/*
 * Unitarios del servicio, con Prisma y el Reloj reemplazados. Cubren el orden de
 * validaciones (design.md §1) y las tres que viven adentro de la transacción.
 *
 * Fechas fijas y elegidas por su día de la semana, para que el resultado no
 * dependa de cuándo corra el test: el 2026-09-14 es lunes, el 19 sábado y el 20
 * domingo. Con el horizonte por defecto en 30 días, el último día reservable
 * desde el lunes 14 es el 2026-10-14.
 */

const HOY = '2026-09-14';
const AHORA = '10:00';
const SABADO = '2026-09-19';
const DOMINGO = '2026-09-20';
const ULTIMO_DIA_DEL_HORIZONTE = '2026-10-14';
const PASADO_EL_HORIZONTE = '2026-10-15';

const SOCIO: UsuarioAutenticado = { id: 42, rol: 'SOCIO' };
const ADMIN: UsuarioAutenticado = { id: 1, rol: 'ADMIN' };

const TENIS = { id: 1, nombre: 'Tenis', duracionTurnoMin: 60 };
const PADEL = { id: 2, nombre: 'Pádel', duracionTurnoMin: 90 };

const cancha = (disciplina: typeof TENIS, precio: string, nombre = 'Polvo') => ({
  id: 3,
  nombre,
  disciplinaId: disciplina.id,
  superficie: null,
  techada: false,
  precioPorTurno: new Prisma.Decimal(precio),
  activa: true,
  disciplina,
});

const equipamiento = (extra: Partial<Record<string, unknown>> = {}) => ({
  id: 7,
  nombre: 'Paleta de pádel',
  disciplinaId: PADEL.id,
  stockTotal: 6,
  precioPorTurno: new Prisma.Decimal('2500'),
  activo: true,
  ...extra,
});

const p2002 = (target: string[]) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.19.3',
    meta: { modelName: 'Reserva', target },
  });

type Escenario = {
  canchaDb?: ReturnType<typeof cancha> | null;
  equipamientoDb?: ReturnType<typeof equipamiento>[];
  activas?: number;
  alquilado?: { equipamientoId: number; _sum: { cantidad: number | null } }[];
  ocupado?: { id: number } | null;
  entorno?: Record<string, string>;
};

function armar(escenario: Escenario = {}) {
  const canchaDb = escenario.canchaDb === undefined ? cancha(TENIS, '9000') : escenario.canchaDb;

  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    reserva: {
      count: jest.fn().mockResolvedValue(escenario.activas ?? 0),
      findFirst: jest.fn().mockResolvedValue(escenario.ocupado ?? null),
      // Devuelve lo que se le pidió crear: así los montos que se afirman en el
      // test son los que el servicio realmente manda a la base.
      create: jest.fn(async ({ data }: { data: Record<string, never> }) => {
        const datos = data as unknown as Record<string, unknown>;
        const items =
          ((datos.equipamiento as { create?: Record<string, unknown>[] })?.create ?? []);
        return {
          id: 128,
          ...datos,
          creadaEn: new Date('2026-09-14T13:00:00.000Z'),
          canceladaEn: null,
          canceladaPorId: null,
          motivoCancelacion: null,
          cancha: { nombre: canchaDb?.nombre ?? 'Polvo' },
          equipamiento: items.map((item, indice) => ({
            id: indice + 1,
            reservaId: 128,
            ...item,
            equipamiento: { nombre: 'Paleta de pádel' },
          })),
        };
      }),
    },
    reservaEquipamiento: {
      groupBy: jest.fn().mockResolvedValue(escenario.alquilado ?? []),
    },
  };

  const prisma = {
    cancha: { findFirst: jest.fn().mockResolvedValue(canchaDb) },
    equipamiento: { findMany: jest.fn().mockResolvedValue(escenario.equipamientoDb ?? []) },
    $transaction: jest.fn(
      (callback: (cliente: typeof tx) => Promise<unknown>) => callback(tx) as Promise<never>,
    ),
  };

  const configuracion: Configuracion = leerConfiguracion({
    JWT_SECRET: 'secreto',
    JWT_EXPIRES_IN: '1h',
    ...escenario.entorno,
  });

  const reloj = { ahora: () => ({ fecha: HOY, hora: AHORA }) } as Reloj;

  const servicio = new ReservasService(
    prisma as unknown as PrismaService,
    reloj,
    configuracion,
  );

  return { servicio, prisma, tx };
}

/** Un turno de tenis válido el lunes: 11:00 a 12:00. */
const turno = { canchaId: 3, fecha: HOY, horaInicio: '11:00' };

const fallaCon = async (promesa: Promise<unknown>, estado: number, tipo: string) => {
  await expect(promesa).rejects.toBeInstanceOf(ErrorDeApi);
  await promesa.catch((error: ErrorDeApi) => {
    expect(error.estado).toBe(estado);
    expect(error.tipo).toBe(tipo);
  });
};

describe('ReservasService: la cancha y el turno (RN-09)', () => {
  // Escenario "Cancha inexistente o inactiva".
  it('responde 404 si la cancha no existe o está inactiva', async () => {
    const { servicio, prisma } = armar({ canchaDb: null });
    await fallaCon(servicio.crear(turno, SOCIO), 404, 'NO_ENCONTRADO');
    expect(prisma.cancha.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ activa: true }) }),
    );
  });

  // Escenario "Hora que no coincide con un turno".
  it('responde 422 si la hora no es el inicio de un turno de la grilla', async () => {
    const tenis = armar();
    await fallaCon(
      tenis.servicio.crear({ ...turno, horaInicio: '19:15' }, SOCIO),
      422,
      'HORARIO_FUERA_DE_TURNO',
    );

    // En pádel los turnos son de 90 minutos desde las 08:00, así que 09:00 no existe.
    const padel = armar({ canchaDb: cancha(PADEL, '14000', 'Panorámica 1') });
    await fallaCon(
      padel.servicio.crear({ ...turno, horaInicio: '09:00' }, SOCIO),
      422,
      'HORARIO_FUERA_DE_TURNO',
    );
  });

  // Escenario "Hora fuera del horario de atención".
  it('responde 422 antes de la apertura', async () => {
    const { servicio } = armar();
    await fallaCon(
      servicio.crear({ ...turno, horaInicio: '07:00' }, SOCIO),
      422,
      'HORARIO_FUERA_DE_TURNO',
    );
  });

  // Escenario "Sábado después del cierre propio": el mismo turno sirve un lunes.
  it('responde 422 un sábado después del cierre del sábado', async () => {
    const { servicio } = armar();
    await fallaCon(
      servicio.crear({ ...turno, fecha: SABADO, horaInicio: '19:00' }, SOCIO),
      422,
      'HORARIO_FUERA_DE_TURNO',
    );

    const lunes = armar();
    await expect(
      lunes.servicio.crear({ ...turno, horaInicio: '19:00' }, SOCIO),
    ).resolves.toMatchObject({ horaInicio: '19:00' });
  });

  // Escenario "Día cerrado".
  it('responde 422 un domingo, que el club no abre', async () => {
    const { servicio, prisma } = armar();
    await fallaCon(
      servicio.crear({ ...turno, fecha: DOMINGO, horaInicio: '11:00' }, SOCIO),
      422,
      'HORARIO_FUERA_DE_TURNO',
    );
    // No llegó a abrir la transacción.
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('la hora de fin sale del bloque y respeta la duración de la disciplina', async () => {
    const tenis = await armar().servicio.crear(turno, SOCIO);
    expect(tenis.horaFin).toBe('12:00');

    const padel = await armar({
      canchaDb: cancha(PADEL, '14000', 'Panorámica 1'),
    }).servicio.crear({ ...turno, horaInicio: '11:00' }, SOCIO);
    expect(padel.horaFin).toBe('12:30');
  });
});

describe('ReservasService: fecha y hora reservables (RN-02, RN-03)', () => {
  // Escenario "Horario ya transcurrido".
  it('responde 422 para un turno de hoy que ya empezó', async () => {
    const { servicio } = armar();
    await fallaCon(
      servicio.crear({ ...turno, horaInicio: '09:00' }, SOCIO),
      422,
      'FECHA_EN_EL_PASADO',
    );
  });

  // El viernes anterior y no el domingo 13: en un dia cerrado ganaria RN-09, que
  // se valida antes, y el test no probaria lo que dice probar.
  it('responde 422 para una fecha anterior a hoy', async () => {
    const { servicio } = armar();
    await fallaCon(
      servicio.crear({ ...turno, fecha: '2026-09-11' }, SOCIO),
      422,
      'FECHA_EN_EL_PASADO',
    );
  });

  // Escenario "Fecha más allá del horizonte".
  it('responde 422 pasado el horizonte de reserva', async () => {
    const { servicio } = armar();
    await fallaCon(
      servicio.crear({ ...turno, fecha: PASADO_EL_HORIZONTE }, SOCIO),
      422,
      'HORIZONTE_EXCEDIDO',
    );
  });

  // Escenario "Último día del horizonte": el límite es inclusivo.
  it('acepta el último día del horizonte', async () => {
    const { servicio } = armar();
    await expect(
      servicio.crear({ ...turno, fecha: ULTIMO_DIA_DEL_HORIZONTE }, SOCIO),
    ).resolves.toMatchObject({ fecha: ULTIMO_DIA_DEL_HORIZONTE });
  });

  it('el horizonte se mueve con la configuración', async () => {
    const { servicio } = armar({ entorno: { HORIZONTE_RESERVA_DIAS: '7' } });
    await fallaCon(
      servicio.crear({ ...turno, fecha: '2026-09-22' }, SOCIO),
      422,
      'HORIZONTE_EXCEDIDO',
    );
  });
});

describe('ReservasService: equipamiento (RN-08)', () => {
  const enPadel = { canchaDb: cancha(PADEL, '14000', 'Panorámica 1') };
  const pide = (equipamientoId: number, cantidad = 1) => ({
    ...turno,
    horaInicio: '11:00',
    equipamiento: [{ equipamientoId, cantidad }],
  });

  // Escenario "Equipamiento inexistente o dado de baja": el findMany filtra por
  // activo, así que un ítem de baja llega como inexistente.
  it('responde 404 si un ítem no existe o está inactivo', async () => {
    const { servicio } = armar({ ...enPadel, equipamientoDb: [] });
    await fallaCon(servicio.crear(pide(7), SOCIO), 404, 'NO_ENCONTRADO');
  });

  // Escenario "Equipamiento de otra disciplina".
  it('responde 422 si el ítem es de otra disciplina que la cancha', async () => {
    const { servicio } = armar({
      canchaDb: cancha(TENIS, '9000'),
      equipamientoDb: [equipamiento()],
    });
    await fallaCon(servicio.crear(pide(7), SOCIO), 422, 'EQUIPAMIENTO_DE_OTRA_DISCIPLINA');
  });

  it('acepta un ítem de la disciplina de la cancha', async () => {
    const { servicio } = armar({ ...enPadel, equipamientoDb: [equipamiento()] });
    await expect(servicio.crear(pide(7, 2), SOCIO)).resolves.toMatchObject({
      montoEquipamiento: 5000,
    });
  });
});

describe('ReservasService: montos con precio plano y congelado (RN-06)', () => {
  // Escenario "Monto con equipamiento".
  it('suma el precio de la cancha más cantidad por precio de cada ítem', async () => {
    const { servicio } = armar({
      canchaDb: cancha(PADEL, '14000', 'Panorámica 1'),
      equipamientoDb: [equipamiento()],
    });
    const reserva = await servicio.crear(
      { ...turno, horaInicio: '11:00', equipamiento: [{ equipamientoId: 7, cantidad: 2 }] },
      SOCIO,
    );
    expect(reserva.montoCancha).toBe(14000);
    expect(reserva.montoEquipamiento).toBe(5000);
    expect(reserva.montoTotal).toBe(19000);
  });

  // Escenario "La cantidad de jugadores no cambia el precio".
  it('cobra lo mismo con 2 y con 4 jugadores', async () => {
    const dos = await armar().servicio.crear({ ...turno, cantidadJugadores: 2 }, SOCIO);
    const cuatro = await armar().servicio.crear({ ...turno, cantidadJugadores: 4 }, SOCIO);
    expect(dos.montoCancha).toBe(9000);
    expect(cuatro.montoCancha).toBe(dos.montoCancha);
    expect(cuatro.montoTotal).toBe(dos.montoTotal);
  });

  // Escenario "Cantidad de jugadores no habitual".
  it('acepta y registra una cantidad de jugadores no habitual', async () => {
    const reserva = await armar().servicio.crear({ ...turno, cantidadJugadores: 3 }, SOCIO);
    expect(reserva.cantidadJugadores).toBe(3);
  });

  // Escenario "Sin cantidad de jugadores".
  it('deja cantidadJugadores en null si no se informó', async () => {
    const reserva = await armar().servicio.crear(turno, SOCIO);
    expect(reserva.cantidadJugadores).toBeNull();
  });

  it('persiste el precio unitario del ítem, no una referencia al precio actual', async () => {
    const { servicio, tx } = armar({
      canchaDb: cancha(PADEL, '14000', 'Panorámica 1'),
      equipamientoDb: [equipamiento()],
    });
    await servicio.crear(
      { ...turno, horaInicio: '11:00', equipamiento: [{ equipamientoId: 7, cantidad: 2 }] },
      SOCIO,
    );

    const { data } = tx.reserva.create.mock.calls[0][0] as unknown as {
      data: { equipamiento: { create: { precioUnitario: Prisma.Decimal }[] } };
    };
    expect(Number(data.equipamiento.create[0].precioUnitario)).toBe(2500);
  });

  it('la reserva se persiste CONFIRMADA', async () => {
    const { servicio, tx } = armar();
    await servicio.crear(turno, SOCIO);
    const { data } = tx.reserva.create.mock.calls[0][0] as unknown as {
      data: { estado: string };
    };
    expect(data.estado).toBe('CONFIRMADA');
  });
});

describe('ReservasService: los locks de la transacción', () => {
  it('toma el lock del usuario antes de contar sus reservas activas', async () => {
    const { servicio, tx } = armar();
    await servicio.crear(turno, SOCIO);

    expect(tx.$queryRaw).toHaveBeenCalled();
    // Lo que Jeremías señaló en la revisión: si el conteo corriera antes del
    // lock, el lock no protegería nada.
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.reserva.count.mock.invocationCallOrder[0],
    );
  });

  it('toma también el lock del equipamiento cuando se pide equipamiento', async () => {
    const { servicio, tx } = armar({
      canchaDb: cancha(PADEL, '14000', 'Panorámica 1'),
      equipamientoDb: [equipamiento()],
    });
    await servicio.crear(
      { ...turno, horaInicio: '11:00', equipamiento: [{ equipamientoId: 7, cantidad: 1 }] },
      SOCIO,
    );

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
      tx.reservaEquipamiento.groupBy.mock.invocationCallOrder[0],
    );
  });

  it('sin equipamiento no toma el segundo lock: no hay nada que sobrevender', async () => {
    const { servicio, tx } = armar();
    await servicio.crear(turno, SOCIO);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe('ReservasService: límite de reservas activas del socio (RN-07)', () => {
  // Escenario "Cuarta reserva de un socio".
  it('responde 422 cuando el socio ya está en el tope', async () => {
    const { servicio } = armar({ activas: 3 });
    await fallaCon(servicio.crear(turno, SOCIO), 422, 'LIMITE_RESERVAS_ACTIVAS');
  });

  // Escenario "Administrador sin límite".
  it('un ADMIN no tiene límite y no se cuentan sus reservas', async () => {
    const { servicio, tx } = armar({ activas: 5 });
    await expect(servicio.crear(turno, ADMIN)).resolves.toMatchObject({ clienteId: 1 });
    expect(tx.reserva.count).not.toHaveBeenCalled();
  });

  // Escenario "Reservas canceladas y ya jugadas no cuentan".
  it('cuenta solo las CONFIRMADA cuyo turno no terminó', async () => {
    const { servicio, tx } = armar({ activas: 2 });
    await expect(servicio.crear(turno, SOCIO)).resolves.toBeDefined();

    const { where } = tx.reserva.count.mock.calls[0][0] as unknown as {
      where: { estado: string; usuarioId: number; OR: unknown[] };
    };
    expect(where.estado).toBe('CONFIRMADA');
    expect(where.usuarioId).toBe(42);
    // Hoy solo cuenta si el turno todavía no terminó; los días futuros, siempre.
    expect(where.OR).toEqual([
      { fecha: { gt: new Date(`${HOY}T00:00:00.000Z`) } },
      { fecha: new Date(`${HOY}T00:00:00.000Z`), horaFin: { gt: AHORA } },
    ]);
  });

  it('el tope se mueve con la configuración', async () => {
    const { servicio } = armar({ activas: 3, entorno: { MAX_RESERVAS_ACTIVAS_SOCIO: '5' } });
    await expect(servicio.crear(turno, SOCIO)).resolves.toBeDefined();
  });
});

describe('ReservasService: stock de equipamiento por turno (RN-05)', () => {
  const enPadel = {
    canchaDb: cancha(PADEL, '14000', 'Panorámica 1'),
    equipamientoDb: [equipamiento()],
  };
  const pide = (cantidad: number) => ({
    ...turno,
    horaInicio: '11:00',
    equipamiento: [{ equipamientoId: 7, cantidad }],
  });

  // Escenario "Stock insuficiente en el turno".
  it('responde 409 cuando se piden más unidades de las disponibles', async () => {
    const { servicio } = armar({
      ...enPadel,
      alquilado: [{ equipamientoId: 7, _sum: { cantidad: 4 } }],
    });
    const promesa = servicio.crear(pide(4), SOCIO);
    await fallaCon(promesa, 409, 'STOCK_INSUFICIENTE');
    await promesa.catch((error: ErrorDeApi) => {
      // El cuerpo es el schema `Error` del contrato, con el detalle de su ejemplo.
      expect(error.getResponse()).toMatchObject({
        tipo: 'STOCK_INSUFICIENTE',
        titulo: 'No hay stock de equipamiento para ese horario',
        detalle: 'Se solicitaron 4 unidades de "Paleta de pádel" y hay 2 disponibles.',
      });
    });
  });

  it('acepta exactamente las unidades que quedan', async () => {
    const { servicio } = armar({
      ...enPadel,
      alquilado: [{ equipamientoId: 7, _sum: { cantidad: 4 } }],
    });
    await expect(servicio.crear(pide(2), SOCIO)).resolves.toBeDefined();
  });

  // Escenario "Stock consumido desde otra cancha": el conteo no filtra por cancha.
  it('cuenta lo alquilado en cualquier cancha del mismo turno', async () => {
    const { servicio, tx } = armar({ ...enPadel });
    await servicio.crear(pide(1), SOCIO);

    const { where } = tx.reservaEquipamiento.groupBy.mock.calls[0][0] as unknown as {
      where: { reserva: Record<string, unknown> };
    };
    expect(where.reserva).not.toHaveProperty('canchaId');
    expect(where.reserva.horaInicio).toBe('11:00');
    // Escenario "Alquiler de una reserva cancelada": no consume stock.
    expect(where.reserva.estado).toEqual({ not: 'CANCELADA' });
  });

  it('un ítem sin alquileres ofrece todo su stock', async () => {
    const { servicio } = armar({ ...enPadel, alquilado: [] });
    await expect(servicio.crear(pide(6), SOCIO)).resolves.toBeDefined();
    const sinStock = armar({ ...enPadel, alquilado: [] });
    await fallaCon(sinStock.servicio.crear(pide(7), SOCIO), 409, 'STOCK_INSUFICIENTE');
  });
});

describe('ReservasService: un solo turno activo por cancha (RN-01)', () => {
  // Escenario "Turno ya reservado", por el pre-chequeo.
  it('responde 409 si el pre-chequeo encuentra el turno ocupado', async () => {
    const { servicio, tx } = armar({ ocupado: { id: 99 } });
    await fallaCon(servicio.crear(turno, SOCIO), 409, 'SLOT_NO_DISPONIBLE');
    expect(tx.reserva.create).not.toHaveBeenCalled();
  });

  /*
   * El caso que importa: las dos solicitudes pasaron el pre-chequeo y el índice
   * único parcial rechaza una. Sin este catch, el error saldría como 500.
   */
  it('responde 409 cuando el índice rechaza el INSERT', async () => {
    const { servicio, tx } = armar();
    tx.reserva.create.mockRejectedValueOnce(p2002(['cancha_id', 'fecha', 'hora_inicio']));
    await fallaCon(servicio.crear(turno, SOCIO), 409, 'SLOT_NO_DISPONIBLE');
  });

  it('el 409 del índice y el del pre-chequeo dicen lo mismo', async () => {
    const porIndice = armar();
    porIndice.tx.reserva.create.mockRejectedValueOnce(
      p2002(['cancha_id', 'fecha', 'hora_inicio']),
    );
    const unoMasUno = await Promise.all([
      porIndice.servicio.crear(turno, SOCIO).catch((error: ErrorDeApi) => error.getResponse()),
      armar({ ocupado: { id: 99 } })
        .servicio.crear(turno, SOCIO)
        .catch((error: ErrorDeApi) => error.getResponse()),
    ]);
    expect(unoMasUno[0]).toEqual(unoMasUno[1]);
  });
});

describe('ReservasService: colisión de código', () => {
  it('reintenta con otro código y termina creando la reserva', async () => {
    const { servicio, prisma, tx } = armar();
    tx.reserva.create
      .mockRejectedValueOnce(p2002(['codigo']))
      .mockRejectedValueOnce(p2002(['codigo']));

    await expect(servicio.crear(turno, SOCIO)).resolves.toMatchObject({ id: 128 });
    // Cada reintento es una transacción nueva: en PostgreSQL una transacción que
    // falló no se puede seguir usando.
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(tx.reserva.create).toHaveBeenCalledTimes(3);
  });

  it('cada intento genera un código distinto', async () => {
    const { servicio, tx } = armar();
    tx.reserva.create.mockRejectedValueOnce(p2002(['codigo']));
    await servicio.crear(turno, SOCIO);

    const codigos = tx.reserva.create.mock.calls.map(
      (llamada) => (llamada[0] as unknown as { data: { codigo: string } }).data.codigo,
    );
    expect(codigos).toHaveLength(2);
    expect(codigos[0]).not.toBe(codigos[1]);
    expect(codigos[0]).toMatch(/^RES-[A-Z0-9]{6}$/);
  });

  it('se rinde después de tres intentos y propaga el error', async () => {
    const { servicio, tx } = armar();
    tx.reserva.create.mockRejectedValue(p2002(['codigo']));
    await expect(servicio.crear(turno, SOCIO)).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
    expect(tx.reserva.create).toHaveBeenCalledTimes(3);
  });

  it('usa el prefijo configurado', async () => {
    const { servicio, tx } = armar({ entorno: { PREFIJO_CODIGO_RESERVA: 'CUM' } });
    await servicio.crear(turno, SOCIO);
    const { data } = tx.reserva.create.mock.calls[0][0] as unknown as {
      data: { codigo: string };
    };
    expect(data.codigo).toMatch(/^CUM-[A-Z0-9]{6}$/);
  });

  it('un error que no es de unicidad se propaga tal cual', async () => {
    const { servicio, tx } = armar();
    const caida = new Error('se cayó la base');
    tx.reserva.create.mockRejectedValueOnce(caida);
    await expect(servicio.crear(turno, SOCIO)).rejects.toBe(caida);
    expect(tx.reserva.create).toHaveBeenCalledTimes(1);
  });
});

describe('ReservasService: el titular sale del token', () => {
  it('guarda como cliente al usuario autenticado', async () => {
    const { servicio, tx } = armar();
    const reserva = await servicio.crear(turno, SOCIO);
    expect(reserva.clienteId).toBe(42);
    const { data } = tx.reserva.create.mock.calls[0][0] as unknown as {
      data: { usuarioId: number };
    };
    expect(data.usuarioId).toBe(42);
  });
});
