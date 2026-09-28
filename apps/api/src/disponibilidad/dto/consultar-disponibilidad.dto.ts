import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { EsFecha } from '../../common/validadores';

export class ConsultarDisponibilidadDto {
  /** Obligatoria (escenario "Fecha ausente o mal formada"). */
  @EsFecha()
  fecha: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  disciplinaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  canchaId?: number;
}
