import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { EsFecha, EsHora } from '../../common/validadores';
import { aBooleano } from './listar-canchas.dto';

export class ListarEquipamientoDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
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
