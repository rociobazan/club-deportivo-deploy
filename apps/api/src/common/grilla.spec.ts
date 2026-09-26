import { aHora, aMinutos, generarGrilla } from './grilla';

describe('generarGrilla', () => {
  it('Día sin reservas en una cancha de tenis: 15 turnos de 08:00-09:00 a 22:00-23:00', () => {
    const grilla = generarGrilla('08:00', '23:00', 60);

    expect(grilla).toHaveLength(15);
    expect(grilla[0]).toEqual({ horaInicio: '08:00', horaFin: '09:00' });
    expect(grilla[14]).toEqual({ horaInicio: '22:00', horaFin: '23:00' });
  });

  it('Día sin reservas en una cancha de pádel: 10 turnos de 90 minutos, el último 21:30-23:00', () => {
    const grilla = generarGrilla('08:00', '23:00', 90);

    expect(grilla).toHaveLength(10);
    expect(grilla[0]).toEqual({ horaInicio: '08:00', horaFin: '09:30' });
    expect(grilla[9]).toEqual({ horaInicio: '21:30', horaFin: '23:00' });
  });

  it('Cierre anticipado: con cierre a las 22:00 el último turno de tenis es 21:00-22:00', () => {
    const grilla = generarGrilla('08:00', '22:00', 60);

    expect(grilla[grilla.length - 1]).toEqual({ horaInicio: '21:00', horaFin: '22:00' });
  });

  it('Bloque que no entra antes del cierre: pádel con cierre a las 22:00 termina en 20:00-21:30', () => {
    const grilla = generarGrilla('08:00', '22:00', 90);

    expect(grilla[grilla.length - 1]).toEqual({ horaInicio: '20:00', horaFin: '21:30' });
    expect(grilla.some((b) => b.horaInicio === '21:30')).toBe(false);
  });

  it('los bloques son consecutivos y ninguno empieza antes de la apertura ni termina después del cierre', () => {
    const grilla = generarGrilla('09:15', '12:00', 45);

    expect(grilla.map((b) => b.horaInicio)).toEqual(['09:15', '10:00', '10:45']);
    expect(grilla.every((b) => b.horaFin <= '12:00')).toBe(true);
  });

  it('rechaza una duración que no sea un entero positivo', () => {
    expect(() => generarGrilla('08:00', '23:00', 0)).toThrow('duración');
    expect(() => generarGrilla('08:00', '23:00', 12.5)).toThrow('duración');
  });
});

describe('aMinutos y aHora', () => {
  it('van y vuelven', () => {
    expect(aMinutos('19:30')).toBe(1170);
    expect(aHora(1170)).toBe('19:30');
    expect(aHora(480)).toBe('08:00');
    expect(aHora(0)).toBe('00:00');
  });
});
