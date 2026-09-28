import { BadRequestException } from '@nestjs/common';
import { crearPipeDeValidacion } from '../../common/validacion';
import { CrearReservaDto } from './crear-reserva.dto';

// El mismo pipe que registra AppModule como APP_PIPE.
const pipe = crearPipeDeValidacion();

const validar = (body: Record<string, unknown>) =>
  pipe.transform(body, { type: 'body', metatype: CrearReservaDto }) as Promise<CrearReservaDto>;

const valido = { canchaId: 3, fecha: '2026-09-15', horaInicio: '19:00' };

describe('CrearReservaDto', () => {
  it('acepta lo mínimo que pide el contrato', async () => {
    await expect(validar({ ...valido })).resolves.toEqual(valido);
  });

  it('acepta cantidad de jugadores y equipamiento', async () => {
    const dto = await validar({
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
    await expect(validar({ ...valido, clienteId: 99 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza cualquier campo que el contrato no declare', async () => {
    await expect(validar({ ...valido, montoTotal: 0 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  // Escenario "Cantidad de jugadores inválida".
  it('rechaza una cantidad de jugadores que no sea un entero mayor o igual a 1', async () => {
    for (const cantidadJugadores of [0, -1, 1.5, '4']) {
      await expect(validar({ ...valido, cantidadJugadores })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });

  // Escenario "Ítem repetido".
  it('rechaza el mismo equipamientoId dos veces', async () => {
    await expect(
      validar({
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
        validar({ ...valido, equipamiento: [{ equipamientoId: 7, cantidad }] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('rechaza un ítem de equipamiento con campos de más o de menos', async () => {
    await expect(
      validar({ ...valido, equipamiento: [{ equipamientoId: 7 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      validar({ ...valido, equipamiento: [{ equipamientoId: 7, cantidad: 1, precio: 10 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza una fecha que no existe o está mal formada', async () => {
    for (const fecha of ['2026-02-30', '15-09-2026', '2026-9-15', 'mañana']) {
      await expect(validar({ ...valido, fecha })).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('rechaza una hora mal formada', async () => {
    for (const horaInicio of ['8pm', '9:00', '24:00', '19:60']) {
      await expect(validar({ ...valido, horaInicio })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });

  it('rechaza un canchaId que no sea un entero positivo', async () => {
    for (const canchaId of [0, -1, 1.5, '3']) {
      await expect(validar({ ...valido, canchaId })).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});
