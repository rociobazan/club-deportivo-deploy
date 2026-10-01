import { generarCodigo } from './codigo';

describe('generarCodigo', () => {
  // Escenarios "Código con el prefijo por defecto" y "Códigos distintos".
  it('genera códigos con el formato del contrato, todos distintos', () => {
    const codigos = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const codigo = generarCodigo('RES');
      expect(codigo).toMatch(/^RES-[A-Z0-9]{6}$/);
      codigos.add(codigo);
    }
    expect(codigos.size).toBe(200);
  });

  // Escenario "Código con prefijo configurado".
  it('usa el prefijo que le pasan', () => {
    expect(generarCodigo('CUM')).toMatch(/^CUM-[A-Z0-9]{6}$/);
  });

  it('nunca pasa los 12 caracteres de la columna, ni con el prefijo más largo', () => {
    expect(generarCodigo('DEPLO').length).toBe(12);
  });
});
