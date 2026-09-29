import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../common/decoradores';
import { UsuarioActual } from '../common/usuario-actual';
import type { UsuarioAutenticado } from '../common/usuario-actual';
import { PREFIJO_API } from '../configuracion';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { ReservasService } from './reservas.service';

@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservas: ReservasService) {}

  /**
   * `POST /reservas` → 201 con la `Reserva` y el header `Location`.
   *
   * Sin `@Publico()`, así que el guard global exige token, y `@Roles` acota a
   * SOCIO o ADMIN. El titular sale de `@UsuarioActual()`, nunca del body: el
   * DTO no declara `clienteId` y el pipe rechaza los campos de más.
   */
  @Roles('SOCIO', 'ADMIN')
  @Post()
  async crear(
    @Body() datos: CrearReservaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
    // `passthrough` para setear un header sin tomar el control de la respuesta:
    // el cuerpo lo sigue serializando Nest.
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const reserva = await this.reservas.crear(datos, usuario);
    respuesta.setHeader('Location', `/${PREFIJO_API}/reservas/${reserva.id}`);
    return reserva;
  }
}
