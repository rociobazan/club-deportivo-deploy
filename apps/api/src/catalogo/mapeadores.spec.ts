import { Prisma } from '@prisma/client';
import { aCancha, aDisciplina, aEquipamiento } from './mapeadores';

const cancha = {
  id: 3,
  disciplinaId: 2,
  nombre: 'Pádel 1',
  superficie: 'sintético',
  techada: true,
  precioPorTurno: new Prisma.Decimal('14000.00'),
  activa: true,
  disciplina: { nombre: 'Pádel' },
};

describe('mapeadores del catálogo', () => {
  it('aCancha convierte el precio a número y desnormaliza la disciplina', () => {
    const json = JSON.parse(JSON.stringify(aCancha(cancha)));

    expect(json.precioPorTurno).toBe(14000);
    expect(typeof json.precioPorTurno).toBe('number');
    expect(json.disciplina).toBe('Pádel');
    expect(json).not.toHaveProperty('disciplina.nombre');
  });

  it('aCancha omite la superficie cuando es null', () => {
    const json = JSON.parse(JSON.stringify(aCancha({ ...cancha, superficie: null })));
    expect(json).not.toHaveProperty('superficie');
  });

  it('aEquipamiento incluye stockDisponible solo cuando se lo pasan', () => {
    const item = {
      id: 7,
      disciplinaId: 2,
      nombre: 'Paleta de pádel',
      stockTotal: 6,
      precioPorTurno: new Prisma.Decimal('2500'),
      activo: true,
    };

    expect(aEquipamiento(item)).not.toHaveProperty('stockDisponible');
    expect(aEquipamiento(item, 4)).toMatchObject({ stockDisponible: 4, precioPorTurno: 2500 });
    expect(aEquipamiento(item, 0)).toHaveProperty('stockDisponible', 0);
  });

  it('aDisciplina expone id, nombre, duración y activa', () => {
    expect(aDisciplina({ id: 1, nombre: 'Tenis', duracionTurnoMin: 60, activa: true })).toEqual({
      id: 1,
      nombre: 'Tenis',
      duracionTurnoMin: 60,
      activa: true,
    });
  });
});
