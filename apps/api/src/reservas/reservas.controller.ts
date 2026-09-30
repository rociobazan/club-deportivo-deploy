import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { UsuarioActual } from '../common/usuario-actual';
import type { UsuarioAutenticado } from '../common/usuario-actual';
import { CancelarReservaDto } from './dto/cancelar-reserva.dto';
import { ListarReservasDto } from './dto/listar-reservas.dto';
import { ReservasService } from './reservas.service';

/**
 * Los cuatro endpoints exigen autenticación (no llevan `@Publico()`): el
 * guard global de JWT ya lo garantiza. `POST /reservas` (creación) no vive
 * acá todavía: es el ítem 1.3.
 */
@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservas: ReservasService) {}

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
