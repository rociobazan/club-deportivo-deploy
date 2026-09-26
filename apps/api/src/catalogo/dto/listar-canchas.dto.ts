import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { aBooleano } from '../../common/transformaciones';

/** Los query params llegan como texto: cada campo declara su transformación (decisión 6). */
export class ListarCanchasDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  disciplinaId?: number;

  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  techada?: boolean;

  /** Solo ADMIN: el servicio exige el rol cuando viene en `true`. */
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  incluirInactivas?: boolean;
}
