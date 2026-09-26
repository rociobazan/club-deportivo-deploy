import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ListarCanchasDto } from './listar-canchas.dto';
import { ListarEquipamientoDto } from './listar-equipamiento.dto';

// La misma configuración que registra AppModule como APP_PIPE.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

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
