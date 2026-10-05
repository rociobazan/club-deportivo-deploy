import { IsOptional } from 'class-validator';
import { EsFecha } from '../../common/validadores';

export class ConsultarPanelDto {
  /** Sin `fecha`, el panel es el de hoy en la hora local del club. */
  @IsOptional()
  @EsFecha()
  fecha?: string;
}
