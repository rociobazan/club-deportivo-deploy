import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Publico, Roles } from '../common/decoradores';
import type { SolicitudConUsuario } from '../common/usuario-actual';
import { PREFIJO_API } from '../configuracion';
import { CatalogoService } from './catalogo.service';
import { ActualizarCanchaDto } from './dto/actualizar-cancha.dto';
import { ActualizarEquipamientoDto } from './dto/actualizar-equipamiento.dto';
import { CrearCanchaDto } from './dto/crear-cancha.dto';
import { CrearEquipamientoDto } from './dto/crear-equipamiento.dto';
import { ListarCanchasDto } from './dto/listar-canchas.dto';
import { ListarEquipamientoDto } from './dto/listar-equipamiento.dto';

/**
 * Los tres listados son públicos. Los parámetros `incluirInactivas` e
 * `incluirInactivos` son la variante de administración: el guard deja al
 * usuario si vino un token válido y el servicio exige ADMIN.
 *
 * El alta y la edición (RF-12 y RF-13) son solo de ADMIN: sin `@Publico()`, el
 * guard global de JWT exige el token, y `@Roles` responde 403 a otro rol.
 */
@Controller()
export class CatalogoController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Publico()
  @Get('disciplinas')
  disciplinas() {
    return this.catalogo.disciplinas();
  }

  @Publico()
  @Get('canchas')
  canchas(@Query() filtros: ListarCanchasDto, @Req() solicitud: SolicitudConUsuario) {
    return this.catalogo.listarCanchas(filtros, solicitud);
  }

  /** `POST /canchas` → 201 con la `Cancha` y el header `Location`. */
  @Roles('ADMIN')
  @Post('canchas')
  async crearCancha(
    @Body() datos: CrearCanchaDto,
    // `passthrough` para setear un header sin tomar el control de la respuesta.
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const cancha = await this.catalogo.crearCancha(datos);
    respuesta.setHeader('Location', `/${PREFIJO_API}/canchas/${cancha.id}`);
    return cancha;
  }

  @Roles('ADMIN')
  @Patch('canchas/:id')
  actualizarCancha(@Param('id', ParseIntPipe) id: number, @Body() datos: ActualizarCanchaDto) {
    return this.catalogo.actualizarCancha(id, datos);
  }

  @Publico()
  @Get('equipamiento')
  equipamiento(@Query() filtros: ListarEquipamientoDto, @Req() solicitud: SolicitudConUsuario) {
    return this.catalogo.listarEquipamiento(filtros, solicitud);
  }

  /** `POST /equipamiento` → 201 con el `Equipamiento` y el header `Location`. */
  @Roles('ADMIN')
  @Post('equipamiento')
  async crearEquipamiento(
    @Body() datos: CrearEquipamientoDto,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const item = await this.catalogo.crearEquipamiento(datos);
    respuesta.setHeader('Location', `/${PREFIJO_API}/equipamiento/${item.id}`);
    return item;
  }

  @Roles('ADMIN')
  @Patch('equipamiento/:id')
  actualizarEquipamiento(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarEquipamientoDto,
  ) {
    return this.catalogo.actualizarEquipamiento(id, datos);
  }
}
