import { BadRequestException } from '@nestjs/common';
import { crearPipeDeValidacion } from '../../common/validacion';
import { CancelarReservaDto } from './cancelar-reserva.dto';
import { CrearReservaDto } from './crear-reserva.dto';
import { ListarReservasDto } from './listar-reservas.dto';

const pipe = crearPipeDeValidacion();

const validarQuery = <T>(metatype: new () => T, query: Record<string, string>) =>
  pipe.transform(query, { type: 'query', metatype }) as Promise<T>;

const validarBody = <T>(metatype: new () => T, body: Record<string, unknown>) =>
  pipe.transform(body, { type: 'body', metatype }) as Promise<T>;

const valido = { canchaId: 3, fecha: '2026-09-15', horaInicio: '19:00' };

describe('CrearReservaDto', () => {
  it('acepta lo mínimo que pide el contrato', async () => {
    await expect(validarBody(CrearReservaDto, { ...valido })).resolves.toEqual(valido);
  });

  it('acepta cantidad de jugadores y equipamiento', async () => {
    const dto = await validarBody(CrearReservaDto, {
      ...valido,
      cantidadJugadores: 4,
      equipamiento: [
        { equipamientoId: 7, cantidad: 2 },
        { equipamientoId: 8, cantidad: 1 },
      ],
    });
    expect(dto.cantidadJugadores).toBe(4);
    expect(dto.equipamiento).toHaveLength(2);
  });

  // Escenario "Intento de reservar a nombre de otro": el titular sale del token,
  // así que un clienteId en el body es 400 y no un campo que se ignora.
  it('rechaza un clienteId en el body', async () => {
    await expect(validarBody(CrearReservaDto, { ...valido, clienteId: 99 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza cualquier campo que el contrato no declare', async () => {
    await expect(validarBody(CrearReservaDto, { ...valido, montoTotal: 0 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  // Escenario "Cantidad de jugadores inválida".
  it('rechaza una cantidad de jugadores que no sea un entero mayor o igual a 1', async () => {
    for (const cantidadJugadores of [0, -1, 1.5, '4']) {
      await expect(validarBody(CrearReservaDto, { ...valido, cantidadJugadores })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });

  // Escenario "Ítem repetido".
  it('rechaza el mismo equipamientoId dos veces', async () => {
    await expect(
      validarBody(CrearReservaDto, {
        ...valido,
        equipamiento: [
          { equipamientoId: 7, cantidad: 1 },
          { equipamientoId: 7, cantidad: 2 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza una cantidad de equipamiento menor a 1', async () => {
    for (const cantidad of [0, -2]) {
      await expect(
        validarBody(CrearReservaDto, { ...valido, equipamiento: [{ equipamientoId: 7, cantidad }] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('rechaza un ítem de equipamiento con campos de más o de menos', async () => {
    await expect(
      validarBody(CrearReservaDto, { ...valido, equipamiento: [{ equipamientoId: 7 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      validarBody(CrearReservaDto, { ...valido, equipamiento: [{ equipamientoId: 7, cantidad: 1, precio: 10 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza una fecha que no existe o está mal formada', async () => {
    for (const fecha of ['2026-02-30', '15-09-2026', '2026-9-15', 'mañana']) {
      await expect(validarBody(CrearReservaDto, { ...valido, fecha })).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('rechaza una hora mal formada', async () => {
    for (const horaInicio of ['8pm', '9:00', '24:00', '19:60']) {
      await expect(validarBody(CrearReservaDto, { ...valido, horaInicio })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });

  it('rechaza un canchaId que no sea un entero positivo', async () => {
    for (const canchaId of [0, -1, 1.5, '3']) {
      await expect(validarBody(CrearReservaDto, { ...valido, canchaId })).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});

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
