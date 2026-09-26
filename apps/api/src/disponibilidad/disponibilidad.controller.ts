import { Controller, Get, Query } from '@nestjs/common';
import { Publico } from '../common/decoradores';
import { DisponibilidadService } from './disponibilidad.service';
import { ConsultarDisponibilidadDto } from './dto/consultar-disponibilidad.dto';

@Controller('disponibilidad')
export class DisponibilidadController {
  constructor(private readonly disponibilidad: DisponibilidadService) {}

  /** `GET /disponibilidad?fecha=&disciplinaId=&canchaId=`, público. */
  @Publico()
  @Get()
  consultar(@Query() filtros: ConsultarDisponibilidadDto) {
    return this.disponibilidad.consultar(filtros);
  }
}
