import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { recortar } from '../../common/transformaciones';
import { ENTERO_MAXIMO_DB, enviado, EsPrecio } from '../../common/validadores';

/**
 * `CrearCanchaRequest` del contrato. La cancha se crea activa: `activa` no se
 * declara, así que el pipe la rechaza con 400 por `forbidNonWhitelisted`.
 *
 * El nombre se recorta antes de validar: si no, "Pádel 1" y "Pádel 1 " serían
 * dos canchas distintas para el único `(disciplina_id, nombre)` de la base.
 */
export class CrearCanchaDto {
  @IsInt()
  @Min(1)
  @Max(ENTERO_MAXIMO_DB)
  disciplinaId!: number;

  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  nombre!: string;

  /** Opcional: `null`, ausente o solo espacios se guardan como "sin superficie". */
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(30)
  superficie?: string | null;

  /**
   * `@ValidateIf` y no `@IsOptional()`: la columna no admite `null`, así que un
   * `null` tiene que dar 400 y no llegar a la base como un 500.
   */
  @ValidateIf(enviado)
  @IsBoolean()
  techada?: boolean;

  @EsPrecio()
  precioPorTurno!: number;
}
