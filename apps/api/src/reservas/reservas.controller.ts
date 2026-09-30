import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../common/decoradores';
import { UsuarioActual } from '../common/usuario-actual';
import type { UsuarioAutenticado } from '../common/usuario-actual';
import { PREFIJO_API } from '../configuracion';
import { CancelarReservaDto } from './dto/cancelar-reserva.dto';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { ListarReservasDto } from './dto/listar-reservas.dto';
import { ReservasService } from './reservas.service';

/**
 * Los cinco endpoints exigen autenticación (ninguno lleva `@Publico()`): el
 * guard global de JWT ya lo garantiza. La creación además acota por rol.
 */
@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservas: ReservasService) {}

  /**
   * `POST /reservas` → 201 con la `Reserva` y el header `Location` (RF-04).
   *
   * `@Roles` acota a SOCIO o ADMIN. El titular sale de `@UsuarioActual()`,
   * nunca del body: el DTO no declara `clienteId` y el pipe rechaza los campos
   * de más.
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

  @Get()
  listar(@Query() filtros: ListarReservasDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.reservas.listar(filtros, usuario);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.reservas.obtener(id, usuario);
  }

  @Patch(':id/cancelacion')
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CancelarReservaDto = {},
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.reservas.cancelar(id, usuario, body);
  }

  @Post(':id/reenvio-mail')
  @HttpCode(202)
  reenviarMail(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.reservas.reenviarMail(id, usuario);
  }
}
