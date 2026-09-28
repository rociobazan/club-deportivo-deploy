import { Controller, Get, Query, Req } from '@nestjs/common';
import { Publico } from '../common/decoradores';
import type { SolicitudConUsuario } from '../common/usuario-actual';
import { CatalogoService } from './catalogo.service';
import { ListarCanchasDto } from './dto/listar-canchas.dto';
import { ListarEquipamientoDto } from './dto/listar-equipamiento.dto';

/**
 * Los tres endpoints son públicos. Los parámetros `incluirInactivas` e
 * `incluirInactivos` son la variante de administración: el guard deja al
 * usuario si vino un token válido y el servicio exige ADMIN.
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

  @Publico()
  @Get('equipamiento')
  equipamiento(@Query() filtros: ListarEquipamientoDto, @Req() solicitud: SolicitudConUsuario) {
    return this.catalogo.listarEquipamiento(filtros, solicitud);
  }
}
