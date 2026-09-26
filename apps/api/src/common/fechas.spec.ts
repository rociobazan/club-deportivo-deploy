import { aFechaDb, comparar, deFechaDb, esFechaValida, esHoraValida } from './fechas';

describe('aFechaDb y deFechaDb', () => {
  it('van y vuelven sin que la zona horaria se meta en el medio', () => {
    const fecha = aFechaDb('2026-09-15');
    expect(fecha.toISOString()).toBe('2026-09-15T00:00:00.000Z');
    expect(deFechaDb(fecha)).toBe('2026-09-15');
  });
});

describe('esFechaValida', () => {
  it('acepta YYYY-MM-DD de fechas reales', () => {
    expect(esFechaValida('2026-09-15')).toBe(true);
    expect(esFechaValida('2028-02-29')).toBe(true);
  });

  it('rechaza otros formatos (escenario "Fecha ausente o mal formada")', () => {
    for (const valor of ['15-09-2026', '2026/09/15', '2026-9-15', '', 'hoy']) {
      expect(esFechaValida(valor)).toBe(false);
    }
  });

  it('rechaza fechas que no existen', () => {
    for (const valor of ['2026-02-30', '2026-13-01', '2026-04-31', '2027-02-29']) {
      expect(esFechaValida(valor)).toBe(false);
    }
  });
});

describe('esHoraValida', () => {
  it('acepta HH:MM de 00:00 a 23:59', () => {
    for (const valor of ['00:00', '08:00', '19:30', '23:59']) {
      expect(esHoraValida(valor)).toBe(true);
    }
  });

  it('rechaza horas mal formadas (escenario "Hora mal formada")', () => {
    for (const valor of ['8pm', '8:00', '24:00', '19:60', '19.30', '']) {
      expect(esHoraValida(valor)).toBe(false);
    }
  });
});

describe('comparar', () => {
  it('ordena fechas y horas como texto ISO', () => {
    expect(comparar('2026-09-14', '2026-09-15')).toBeLessThan(0);
    expect(comparar('2026-09-15', '2026-09-15')).toBe(0);
    expect(comparar('14:00', '09:30')).toBeGreaterThan(0);
  });
});
