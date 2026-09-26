import type { Configuracion } from '../configuracion';
import { Reloj } from './reloj';

const con = (zonaHoraria: string) =>
  new Reloj({ zonaHoraria } as Configuracion);

describe('Reloj', () => {
  const instante = new Date('2026-09-15T17:30:00Z');

  it('da fecha y hora en la zona del club', () => {
    expect(con('America/Argentina/Cordoba').ahora(instante)).toEqual({
      fecha: '2026-09-15',
      hora: '14:30',
    });
  });

  it('con otra zona cambia la hora, no el formato', () => {
    expect(con('UTC').ahora(instante)).toEqual({ fecha: '2026-09-15', hora: '17:30' });
  });

  it('cambia de día según la zona, no según UTC', () => {
    // 01:30 UTC del 16 todavía es 22:30 del 15 en Córdoba.
    expect(con('America/Argentina/Cordoba').ahora(new Date('2026-09-16T01:30:00Z'))).toEqual({
      fecha: '2026-09-15',
      hora: '22:30',
    });
  });

  it('la medianoche es 00:00, nunca 24:00', () => {
    expect(con('UTC').ahora(new Date('2026-09-16T00:00:00Z')).hora).toBe('00:00');
  });

  it('sin instante usa el momento actual', () => {
    const { fecha, hora } = con('UTC').ahora();
    expect(fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hora).toMatch(/^\d{2}:\d{2}$/);
  });
});
