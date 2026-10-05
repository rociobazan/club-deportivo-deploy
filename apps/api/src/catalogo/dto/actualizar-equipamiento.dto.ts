import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { recortar } from '../../common/transformaciones';
import { ENTERO_MAXIMO_DB, enviado, EsPrecio } from '../../common/validadores';

/**
 * `ActualizarEquipamientoRequest` del contrato: solo se modifican los campos
 * enviados, y ninguno admite `null`. Sin `disciplinaId`: cambiarle la
 * disciplina a un ítem rompería RN-08 en las reservas que ya lo alquilaron.
 * Que venga al menos un campo lo verifica el servicio, como en las canchas.
 */
export class ActualizarEquipamientoDto {
  @ValidateIf(enviado)
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nombre?: string;

  /** Bajarlo por debajo de lo alquilado es válido: las reservas no cambian (RN-15). */
  @ValidateIf(enviado)
  @IsInt()
  @Min(0)
  @Max(ENTERO_MAXIMO_DB)
  stockTotal?: number;

  @ValidateIf(enviado)
  @EsPrecio()
  precioPorTurno?: number;

  @ValidateIf(enviado)
  @IsBoolean()
  activo?: boolean;
}
