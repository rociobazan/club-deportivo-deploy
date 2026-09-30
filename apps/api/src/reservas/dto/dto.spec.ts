import { BadRequestException } from '@nestjs/common';
import { crearPipeDeValidacion } from '../../common/validacion';
import { CancelarReservaDto } from './cancelar-reserva.dto';
import { ListarReservasDto } from './listar-reservas.dto';

const pipe = crearPipeDeValidacion();

const validarQuery = <T>(metatype: new () => T, query: Record<string, string>) =>
  pipe.transform(query, { type: 'query', metatype }) as Promise<T>;

const validarBody = <T>(metatype: new () => T, body: Record<string, unknown>) =>
  pipe.transform(body, { type: 'body', metatype }) as Promise<T>;

describe('ListarReservasDto', () => {
  it('sin parámetros es válido', async () => {
    await expect(validarQuery(ListarReservasDto, {})).resolves.toEqual({});
  });

  it('convierte clienteId a número y acepta fecha y estado', async () => {
    const dto = await validarQuery(ListarReservasDto, {
      clienteId: '42',
      fecha: '2026-09-15',
      estado: 'CANCELADA',
    });
    expect(dto).toEqual({ clienteId: 42, fecha: '2026-09-15', estado: 'CANCELADA' });
  });

  it('acepta estado=COMPLETADA, aunque no se persista', async () => {
    await expect(validarQuery(ListarReservasDto, { estado: 'COMPLETADA' })).resolves.toEqual({
      estado: 'COMPLETADA',
    });
  });

  it('rechaza un estado que no existe', async () => {
    await expect(validarQuery(ListarReservasDto, { estado: 'PENDIENTE' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza una fecha mal formada', async () => {
    await expect(validarQuery(ListarReservasDto, { fecha: '15-09-2026' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza un clienteId que no es un entero positivo', async () => {
    for (const clienteId of ['abc', '0', '-1']) {
      await expect(validarQuery(ListarReservasDto, { clienteId })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });
});

describe('CancelarReservaDto', () => {
  it('sin body es válido', async () => {
    await expect(validarBody(CancelarReservaDto, {})).resolves.toEqual({});
  });

  it('acepta un motivo de hasta 200 caracteres', async () => {
    const motivo = 'a'.repeat(200);
    await expect(validarBody(CancelarReservaDto, { motivo })).resolves.toEqual({ motivo });
  });

  it('Motivo demasiado largo: rechaza 201 caracteres', async () => {
    const motivo = 'a'.repeat(201);
    await expect(validarBody(CancelarReservaDto, { motivo })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
