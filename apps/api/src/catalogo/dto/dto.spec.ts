import { BadRequestException } from '@nestjs/common';
import { crearPipeDeValidacion } from '../../common/validacion';
import { ActualizarCanchaDto } from './actualizar-cancha.dto';
import { CrearCanchaDto } from './crear-cancha.dto';
import { ListarCanchasDto } from './listar-canchas.dto';
import { ListarEquipamientoDto } from './listar-equipamiento.dto';

// El mismo pipe que registra AppModule como APP_PIPE.
const pipe = crearPipeDeValidacion();

const validar = <T>(metatype: new () => T, query: Record<string, string>) =>
  pipe.transform(query, { type: 'query', metatype }) as Promise<T>;

describe('ListarCanchasDto', () => {
  it('convierte los enteros y los booleanos que vienen como texto', async () => {
    const dto = await validar(ListarCanchasDto, {
      disciplinaId: '2',
      techada: 'true',
      incluirInactivas: 'false',
    });
    expect(dto).toEqual({ disciplinaId: 2, techada: true, incluirInactivas: false });
  });

  it('sin parámetros es válido', async () => {
    await expect(validar(ListarCanchasDto, {})).resolves.toEqual({});
  });

  it('rechaza un disciplinaId que no es un entero positivo', async () => {
    for (const disciplinaId of ['abc', '0', '-1', '1.5']) {
      await expect(validar(ListarCanchasDto, { disciplinaId })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });

  it('rechaza un booleano que no sea true o false', async () => {
    for (const techada of ['si', '1', 'TRUE', '']) {
      await expect(validar(ListarCanchasDto, { techada })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });

  it('rechaza parámetros que el contrato no declara', async () => {
    await expect(validar(ListarCanchasDto, { precioMaximo: '1000' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('ListarEquipamientoDto', () => {
  it('acepta fecha y horaInicio con el formato del contrato', async () => {
    await expect(
      validar(ListarEquipamientoDto, { fecha: '2026-09-15', horaInicio: '20:00' }),
    ).resolves.toEqual({ fecha: '2026-09-15', horaInicio: '20:00' });
  });

  it('Hora mal formada: rechaza horaInicio=8pm', async () => {
    await expect(
      validar(ListarEquipamientoDto, { fecha: '2026-09-15', horaInicio: '8pm' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza una fecha mal formada o inexistente', async () => {
    for (const fecha of ['15-09-2026', '2026-02-30']) {
      await expect(
        validar(ListarEquipamientoDto, { fecha, horaInicio: '20:00' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('el mensaje de validación nombra el campo, para que el filtro lo muestre como detalle', async () => {
    const error = await validar(ListarEquipamientoDto, { horaInicio: '8pm' }).catch(
      (e: BadRequestException) => e,
    );
    const { message } = (error as BadRequestException).getResponse() as { message: string[] };
    expect(message[0]).toContain('horaInicio');
  });
});

const validarCuerpo = (metatype: new () => object, valor: unknown) =>
  pipe.transform(valor, { type: 'body', metatype });

const rechaza = async (metatype: new () => object, valor: unknown) =>
  expect(validarCuerpo(metatype, valor)).rejects.toBeInstanceOf(BadRequestException);

const canchaValida = { disciplinaId: 2, nombre: 'Pádel 4', techada: false, precioPorTurno: 15000 };

describe('CrearCanchaDto', () => {
  it('acepta el alta del escenario, con superficie ausente', async () => {
    await expect(validarCuerpo(CrearCanchaDto, canchaValida)).resolves.toBeInstanceOf(CrearCanchaDto);
  });

  it('recorta el nombre antes de validarlo', async () => {
    const dto = (await validarCuerpo(CrearCanchaDto, { ...canchaValida, nombre: '  Pádel 4 ' })) as CrearCanchaDto;
    expect(dto.nombre).toBe('Pádel 4');
  });

  it('Precio inválido: rechaza 0, negativos, más de dos decimales y más que Decimal(10,2)', async () => {
    for (const precioPorTurno of [0, -100, 15000.123, 100_000_000, '15000', null]) {
      await rechaza(CrearCanchaDto, { ...canchaValida, precioPorTurno });
    }
  });

  it('acepta un precio con dos decimales', async () => {
    await expect(
      validarCuerpo(CrearCanchaDto, { ...canchaValida, precioPorTurno: 15000.5 }),
    ).resolves.toBeInstanceOf(CrearCanchaDto);
  });

  it('Nombre vacío: rechaza un nombre de solo espacios o de más de 50 caracteres', async () => {
    await rechaza(CrearCanchaDto, { ...canchaValida, nombre: '   ' });
    await rechaza(CrearCanchaDto, { ...canchaValida, nombre: 'x'.repeat(51) });
  });

  it('rechaza un disciplinaId fuera de rango, techada en null y activa, que no se declara', async () => {
    await rechaza(CrearCanchaDto, { ...canchaValida, disciplinaId: 0 });
    await rechaza(CrearCanchaDto, { ...canchaValida, disciplinaId: 2_147_483_648 });
    await rechaza(CrearCanchaDto, { ...canchaValida, techada: null });
    await rechaza(CrearCanchaDto, { ...canchaValida, activa: false });
  });
});

describe('ActualizarCanchaDto', () => {
  it('acepta un solo campo, y superficie en null para borrarla', async () => {
    await expect(validarCuerpo(ActualizarCanchaDto, { precioPorTurno: 16000 })).resolves.toBeInstanceOf(
      ActualizarCanchaDto,
    );
    await expect(validarCuerpo(ActualizarCanchaDto, { superficie: null })).resolves.toBeInstanceOf(
      ActualizarCanchaDto,
    );
  });

  it('Precio inválido y Nombre vacío también en la edición', async () => {
    await rechaza(ActualizarCanchaDto, { precioPorTurno: 0 });
    await rechaza(ActualizarCanchaDto, { nombre: '   ' });
  });

  it('rechaza null en los campos que no lo admiten, y la disciplina, que no se cambia', async () => {
    for (const campo of ['nombre', 'techada', 'precioPorTurno', 'activa']) {
      await rechaza(ActualizarCanchaDto, { [campo]: null });
    }
    await rechaza(ActualizarCanchaDto, { disciplinaId: 1 });
  });
});
