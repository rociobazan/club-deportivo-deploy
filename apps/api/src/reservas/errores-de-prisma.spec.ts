import { Prisma } from '@prisma/client';
import { esViolacionDe } from '../common/errores-de-prisma';
import { COLUMNAS_CODIGO, COLUMNAS_SLOT_ACTIVO } from './errores-de-prisma';

/** Los `meta.target` son los que devolvió la base de verdad, no inventados. */
const p2002 = (target: unknown) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.19.3',
    meta: { modelName: 'Reserva', target },
  });

describe('esViolacionDe', () => {
  it('reconoce el choque contra ux_reserva_slot_activo', () => {
    const error = p2002(['cancha_id', 'fecha', 'hora_inicio']);
    expect(esViolacionDe(error, COLUMNAS_SLOT_ACTIVO)).toBe(true);
    expect(esViolacionDe(error, COLUMNAS_CODIGO)).toBe(false);
  });

  it('reconoce el choque contra el único de codigo', () => {
    const error = p2002(['codigo']);
    expect(esViolacionDe(error, COLUMNAS_CODIGO)).toBe(true);
    expect(esViolacionDe(error, COLUMNAS_SLOT_ACTIVO)).toBe(false);
  });

  it('acepta una columna informada como string suelto', () => {
    expect(esViolacionDe(p2002('codigo'), COLUMNAS_CODIGO)).toBe(true);
  });

  it('no confunde un subconjunto de las columnas', () => {
    expect(esViolacionDe(p2002(['cancha_id', 'fecha']), COLUMNAS_SLOT_ACTIVO)).toBe(false);
  });

  it('ignora otros errores de Prisma y cualquier otra cosa', () => {
    const noEncontrado = new Prisma.PrismaClientKnownRequestError('not found', {
      code: 'P2025',
      clientVersion: '6.19.3',
    });
    expect(esViolacionDe(noEncontrado, COLUMNAS_SLOT_ACTIVO)).toBe(false);
    expect(esViolacionDe(new Error('cualquiera'), COLUMNAS_SLOT_ACTIVO)).toBe(false);
    expect(esViolacionDe(undefined, COLUMNAS_SLOT_ACTIVO)).toBe(false);
    expect(esViolacionDe(p2002(undefined), COLUMNAS_SLOT_ACTIVO)).toBe(false);
  });
});
