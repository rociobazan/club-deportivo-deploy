import { Transform } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { recortar } from '../../common/transformaciones';
import { ENTERO_MAXIMO_DB, EsPrecio } from '../../common/validadores';

/**
 * `CrearEquipamientoRequest` del contrato. El ítem se crea activo: `activo` no
 * se declara, así que el pipe lo rechaza con 400. El nombre se recorta por el
 * mismo motivo que en `CrearCanchaDto`.
 */
export class CrearEquipamientoDto {
  @IsInt()
  @Min(1)
  @Max(ENTERO_MAXIMO_DB)
  disciplinaId!: number;

  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nombre!: string;

  /** 0 es válido: un ítem puede estar en el catálogo sin unidades por ahora. */
  @IsInt()
  @Min(0)
  @Max(ENTERO_MAXIMO_DB)
  stockTotal!: number;

  @EsPrecio()
  precioPorTurno!: number;
}
