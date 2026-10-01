import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ENTERO_MAXIMO_DB, EsFecha } from '../../common/validadores';

export class ConsultarDisponibilidadDto {
  /** Obligatoria (escenario "Fecha ausente o mal formada"). */
  @EsFecha()
  fecha: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ENTERO_MAXIMO_DB)
  disciplinaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ENTERO_MAXIMO_DB)
  canchaId?: number;
}
