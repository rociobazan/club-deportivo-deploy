import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decoradores';
import { AdministracionService } from './administracion.service';
import { ConsultarPanelDto } from './dto/panel.dto';

/** Solo ADMIN: sin token, 401 del guard global; con otro rol, 403 de `@Roles`. */
@Controller('admin')
export class AdministracionController {
  constructor(private readonly administracion: AdministracionService) {}

  @Roles('ADMIN')
  @Get('panel')
  panel(@Query() { fecha }: ConsultarPanelDto) {
    return this.administracion.panel(fecha);
  }
}
