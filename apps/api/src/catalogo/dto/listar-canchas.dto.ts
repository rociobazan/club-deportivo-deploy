import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

/**
 * Los query params llegan como texto. El ValidationPipe global no convierte
 * solo, así que cada campo declara su transformación (design.md, decisión 6):
 * `true`/`false` pasan a booleano y cualquier otra cosa queda para que
 * `@IsBoolean()` la rechace.
 */
export const aBooleano = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

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
