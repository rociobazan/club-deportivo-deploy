import { Prisma } from '@prisma/client';
import { HorarioDelClub } from '../common/horario';
import {
  calcularPanel,
  CanchaDelPanel,
  diasDeLaSemana,
  EntradaDelPanel,
  ReservaDelPanel,
} from './panel';

/*
 * Un caso por escenario de `openspec/specs/administracion/spec.md`, con sus
 * números exactos, más los bordes de design.md (decisión 5). Las fechas son
 * fijas: 2026-09-21 es lunes, 2026-09-26 sábado y 2026-09-27 domingo.
 */
const LUNES = '2026-09-21';
const SABADO = '2026-09-26';
const DOMINGO = '2026-09-27';

/** El horario real del club: de 8 a 23, sábados hasta las 18, domingos cerrado. */
const HORARIO: HorarioDelClub = {
  apertura: '08:00',
  cierre: '23:00',
  cierreSabado: '18:00',
  diasCerrados: [0],
};

/** Los siete días abiertos y con el mismo horario: para los escenarios que cuentan 70 turnos en la semana. */
const SIEMPRE_ABIERTO: HorarioDelClub = { ...HORARIO, cierreSabado: '23:00', diasCerrados: [] };

/** Las seis canchas del escenario: 15 turnos las de 60 minutos y 10 las de 90; 75 en total. */
const CANCHAS: CanchaDelPanel[] = [
  { id: 1, nombre: 'Tenis 1', disciplina: 'Tenis', duracionTurnoMin: 60 },
  { id: 2, nombre: 'Tenis 2', disciplina: 'Tenis', duracionTurnoMin: 60 },
  { id: 3, nombre: 'Pádel 1', disciplina: 'Pádel', duracionTurnoMin: 90 },
  { id: 4, nombre: 'Pádel 2', disciplina: 'Pádel', duracionTurnoMin: 90 },
  { id: 5, nombre: 'Pádel 3', disciplina: 'Pádel', duracionTurnoMin: 90 },
  { id: 6, nombre: 'Sintética', disciplina: 'Fútbol 5', duracionTurnoMin: 60 },
];

let siguienteId = 0;
const reserva = (datos: Partial<ReservaDelPanel> = {}): ReservaDelPanel => ({
  id: ++siguienteId,
  canchaId: 3,
  cancha: 'Pádel 1',
  disciplina: 'Pádel',
  cliente: 'Bruno Socio',
  fecha: LUNES,
  horaInicio: '08:00',
  cantidadJugadores: 4,
  montoTotal: new Prisma.Decimal(14000),
  ...datos,
});

const entrada = (datos: Partial<EntradaDelPanel> = {}): EntradaDelPanel => ({
  fecha: LUNES,
  // Otro día, para que los próximos turnos no filtren por hora salvo que el caso lo pida.
  ahora: { fecha: '2026-09-01', hora: '12:00' },
  horario: HORARIO,
  plazoCancelacionMin: 120,
  canchas: CANCHAS,
  reservas: [],
  cancelaciones: [],
  ...datos,
});

/** Cinco reservas en Pádel 1, en horarios distintos de la grilla de 90 minutos. */
const cincoEnPadel1 = (fecha: string) =>
  ['08:00', '09:30', '11:00', '12:30', '14:00'].map((horaInicio) => reserva({ fecha, horaInicio }));

describe('calcularPanel', () => {
  describe('Métricas del día', () => {
    it('Reservas y facturación: 3 del día, 2 del anterior y 46000 previstos', () => {
      const domingoAnterior = '2026-09-20';
      const panel = calcularPanel(
        entrada({
          reservas: [
            reserva({ montoTotal: new Prisma.Decimal(14000), horaInicio: '08:00' }),
            reserva({ montoTotal: new Prisma.Decimal(9000), horaInicio: '09:30' }),
            reserva({ montoTotal: new Prisma.Decimal(23000), horaInicio: '11:00' }),
            reserva({ fecha: domingoAnterior }),
            reserva({ fecha: domingoAnterior, horaInicio: '09:30' }),
          ],
          // La cancelada no llega en `reservas`: el servicio solo trae las no canceladas.
          cancelaciones: [{ fecha: LUNES, horaInicio: '12:30', canceladaEn: { fecha: LUNES, hora: '08:00' } }],
        }),
      );

      expect(panel).toMatchObject({ reservasDelDia: 3, reservasDiaAnterior: 2, facturacionPrevista: 46000 });
    });

    it('la facturación suma con Decimal: 0.1 + 0.2 da 0.3 exacto', () => {
      const panel = calcularPanel(
        entrada({
          reservas: [
            reserva({ montoTotal: new Prisma.Decimal('0.1') }),
            reserva({ montoTotal: new Prisma.Decimal('0.2'), horaInicio: '09:30' }),
          ],
        }),
      );
      expect(panel.facturacionPrevista).toBe(0.3);
    });

    it('Cancelaciones dentro y fuera del plazo: 2 cancelaciones, 1 dentro del plazo', () => {
      const panel = calcularPanel(
        entrada({
          cancelaciones: [
            // 5 horas antes de un turno de las 20:00.
            { fecha: LUNES, horaInicio: '20:00', canceladaEn: { fecha: LUNES, hora: '15:00' } },
            // Un ADMIN, 30 minutos antes de un turno de las 18:30.
            { fecha: LUNES, horaInicio: '18:30', canceladaEn: { fecha: LUNES, hora: '18:00' } },
          ],
        }),
      );
      expect(panel).toMatchObject({ cancelacionesDelDia: 2, cancelacionesDentroDelPlazo: 1 });
    });

    it('una cancelación justo en el plazo cuenta como dentro, y una de otro día también', () => {
      const panel = calcularPanel(
        entrada({
          cancelaciones: [
            { fecha: LUNES, horaInicio: '20:00', canceladaEn: { fecha: LUNES, hora: '18:00' } },
            { fecha: '2026-09-22', horaInicio: '09:00', canceladaEn: { fecha: LUNES, hora: '10:00' } },
          ],
        }),
      );
      expect(panel.cancelacionesDentroDelPlazo).toBe(2);
    });
  });

  describe('Ocupación de las canchas', () => {
    it('Ocupación del día: 5 reservas sobre 75 turnos dan 7', () => {
      const panel = calcularPanel(entrada({ reservas: cincoEnPadel1(LUNES) }));
      expect(panel.ocupacionDelDia).toBe(7);
    });

    it('Ocupación de una cancha en la semana: Pádel 1 con 5 reservas sobre 70 turnos da 7', () => {
      const semana = diasDeLaSemana(LUNES);
      const reservas = semana.slice(0, 5).map((fecha) => reserva({ fecha }));
      const panel = calcularPanel(entrada({ horario: SIEMPRE_ABIERTO, reservas }));

      expect(panel.ocupacionPorCancha.find((c) => c.canchaId === 3)).toEqual({
        canchaId: 3,
        nombre: 'Pádel 1',
        disciplina: 'Pádel',
        porcentaje: 7,
      });
    });

    it('Día sin reservas: ocupación del día 0', () => {
      expect(calcularPanel(entrada()).ocupacionDelDia).toBe(0);
    });

    it('una entrada por cancha activa, también las de 0, ordenadas por disciplina y nombre', () => {
      const panel = calcularPanel(entrada());
      expect(panel.ocupacionPorCancha.map((c) => c.nombre)).toEqual([
        'Sintética',
        'Pádel 1',
        'Pádel 2',
        'Pádel 3',
        'Tenis 1',
        'Tenis 2',
      ]);
      expect(panel.ocupacionPorCancha.every((c) => c.porcentaje === 0)).toBe(true);
    });

    it('un domingo cerrado informa ocupación 0 aunque tenga reservas viejas cargadas', () => {
      const panel = calcularPanel(entrada({ fecha: DOMINGO, reservas: cincoEnPadel1(DOMINGO) }));
      expect(panel.ocupacionDelDia).toBe(0);
    });

    it('el domingo cerrado no entra en el promedio de los 7 días', () => {
      // Semana del lunes 21 al domingo 27: seis días abiertos y el domingo cerrado.
      // Un único día con 5 de 75 (6,67 %) promediado sobre 6 días abiertos da 1,11 → 1.
      // Si el domingo entrara como 0, daría 0,95 → 1 igual; por eso el caso de abajo.
      const panel = calcularPanel(entrada({ fecha: DOMINGO, reservas: cincoEnPadel1(LUNES) }));
      expect(panel.ocupacionPromedioSemanal).toBe(1);
    });

    it('el promedio cambia si el día cerrado se contara como 0: 100 % en 6 días abiertos da 100', () => {
      const lleno = CANCHAS.slice(0, 1); // Una sola cancha de tenis: 15 turnos de lunes a viernes.
      const semana = diasDeLaSemana(DOMINGO);
      const horas = (cantidad: number) =>
        Array.from({ length: cantidad }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`);
      const reservas = semana.flatMap((fecha) => {
        const turnos = fecha === SABADO ? 10 : fecha === DOMINGO ? 0 : 15;
        return horas(turnos).map((horaInicio) => reserva({ canchaId: 1, fecha, horaInicio }));
      });

      const panel = calcularPanel(entrada({ fecha: DOMINGO, canchas: lleno, reservas }));
      expect(panel.ocupacionPromedioSemanal).toBe(100);
    });

    it('un sábado ofrece menos turnos: 5 reservas sobre 48 dan 10', () => {
      // Sábado de 8 a 18: 10 turnos de 60 minutos y 6 de 90. 3 × 10 + 3 × 6 = 48 turnos.
      const panel = calcularPanel(entrada({ fecha: SABADO, reservas: cincoEnPadel1(SABADO) }));
      expect(panel.ocupacionDelDia).toBe(Math.round((100 * 5) / 48));
    });

    it('el promedio no pasa de 100 aunque un día tenga más reservas que turnos', () => {
      // Se reservó con un horario largo y después se achicó el cierre a las 10:
      // Tenis 1 ofrece 2 turnos por día y tiene 3 reservas cada día de la
      // semana. Sin tope, el promedio daría 150.
      const corto = { ...SIEMPRE_ABIERTO, cierre: '10:00', cierreSabado: '10:00' };
      const reservas = diasDeLaSemana(LUNES).flatMap((fecha) =>
        ['08:00', '09:00', '20:00'].map((horaInicio) => reserva({ canchaId: 1, fecha, horaInicio })),
      );
      const panel = calcularPanel(entrada({ horario: corto, canchas: CANCHAS.slice(0, 1), reservas }));
      expect(panel).toMatchObject({ ocupacionDelDia: 100, ocupacionPromedioSemanal: 100 });
    });

    it('si los 7 días están cerrados, el promedio es 0', () => {
      const cerrado = { ...HORARIO, diasCerrados: [0, 1, 2, 3, 4, 5, 6] };
      const panel = calcularPanel(entrada({ horario: cerrado, reservas: cincoEnPadel1(LUNES) }));
      expect(panel).toMatchObject({ ocupacionDelDia: 0, ocupacionPromedioSemanal: 0 });
    });

    it('la reserva de una cancha dada de baja cuenta en reservas y facturación, no en la ocupación', () => {
      const deBaja = reserva({ canchaId: 99, cancha: 'Vieja', montoTotal: new Prisma.Decimal(5000) });
      const panel = calcularPanel(entrada({ reservas: [deBaja] }));

      expect(panel).toMatchObject({ reservasDelDia: 1, facturacionPrevista: 5000, ocupacionDelDia: 0 });
      expect(panel.ocupacionPorCancha.some((c) => c.canchaId === 99)).toBe(false);
    });
  });

  describe('Próximos turnos', () => {
    const tresDeHoy = [
      reserva({ horaInicio: '18:30', cancha: 'Pádel 1' }),
      reserva({ horaInicio: '21:30', cancha: 'Pádel 2', canchaId: 4 }),
      reserva({ horaInicio: '20:00', cancha: 'Pádel 3', canchaId: 5 }),
    ];

    it('Turnos restantes de hoy: a las 19:40 lista las 20:00 y las 21:30, en ese orden', () => {
      const panel = calcularPanel(entrada({ ahora: { fecha: LUNES, hora: '19:40' }, reservas: tresDeHoy }));
      expect(panel.proximosTurnos.map((t) => t.horaInicio)).toEqual(['20:00', '21:30']);
    });

    it('Otra fecha: lista todos los turnos del día, ordenados', () => {
      const manana = '2026-09-22';
      const panel = calcularPanel(
        entrada({
          fecha: manana,
          ahora: { fecha: LUNES, hora: '19:40' },
          reservas: [reserva({ fecha: manana, horaInicio: '18:30' }), reserva({ fecha: manana, horaInicio: '09:00' })],
        }),
      );
      expect(panel.proximosTurnos.map((t) => t.horaInicio)).toEqual(['09:00', '18:30']);
    });

    it('un turno que empieza justo ahora ya empezó y no se lista', () => {
      const panel = calcularPanel(entrada({ ahora: { fecha: LUNES, hora: '20:00' }, reservas: tresDeHoy }));
      expect(panel.proximosTurnos.map((t) => t.horaInicio)).toEqual(['21:30']);
    });

    it('cada turno lleva la forma del contrato', () => {
      const panel = calcularPanel(entrada({ reservas: [reserva({ id: 128, horaInicio: '20:00' })] }));
      expect(panel.proximosTurnos).toEqual([
        {
          reservaId: 128,
          horaInicio: '20:00',
          cancha: 'Pádel 1',
          disciplina: 'Pádel',
          cliente: 'Bruno Socio',
          cantidadJugadores: 4,
        },
      ]);
    });
  });
});
