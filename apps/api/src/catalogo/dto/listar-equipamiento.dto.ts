import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { aBooleano } from '../../common/transformaciones';
import { ENTERO_MAXIMO_DB, EsFecha, EsHora } from '../../common/validadores';

export class ListarEquipamientoDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ENTERO_MAXIMO_DB)
  disciplinaId?: number;

  /** Va junto con `horaInicio`; el servicio rechaza uno sin el otro. */
  @IsOptional()
  @EsFecha()
  fecha?: string;

  @IsOptional()
  @EsHora()
  horaInicio?: string;

  /** Solo ADMIN: el servicio exige el rol cuando viene en `true`. */
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  incluirInactivos?: boolean;
}
