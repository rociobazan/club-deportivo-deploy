import { diaDeLaSemana, ventanaDelDia, type HorarioDelClub } from './horario';

const horario: HorarioDelClub = {
  apertura: '08:00',
  cierre: '23:00',
  cierreSabado: '18:00',
  diasCerrados: [0],
};

describe('diaDeLaSemana', () => {
  it('lee la fecha como fecha del club y no por el huso del servidor', () => {
    // 2026-09-20 es domingo; armada con `new Date("2026-09-20")` local, en un
    // servidor al oeste de UTC daría sábado.
    expect(diaDeLaSemana('2026-09-20')).toBe(0);
    expect(diaDeLaSemana('2026-09-21')).toBe(1);
    expect(diaDeLaSemana('2026-09-19')).toBe(6);
  });
});

describe('ventanaDelDia', () => {
  it('De lunes a viernes abre hasta la hora de cierre', () => {
    expect(ventanaDelDia('2026-09-21', horario)).toEqual({
      apertura: '08:00',
      cierre: '23:00',
    });
  });

  it('El sábado cierra antes', () => {
    expect(ventanaDelDia('2026-09-19', horario)).toEqual({
      apertura: '08:00',
      cierre: '18:00',
    });
  });

  it('Un día cerrado no tiene ventana', () => {
    expect(ventanaDelDia('2026-09-20', horario)).toBeNull();
  });

  it('Sin días cerrados, el domingo abre como un día de semana', () => {
    expect(ventanaDelDia('2026-09-20', { ...horario, diasCerrados: [] })).toEqual({
      apertura: '08:00',
      cierre: '23:00',
    });
  });

  it('El sábado cerrado gana sobre su horario propio', () => {
    expect(ventanaDelDia('2026-09-19', { ...horario, diasCerrados: [0, 6] })).toBeNull();
  });
});
