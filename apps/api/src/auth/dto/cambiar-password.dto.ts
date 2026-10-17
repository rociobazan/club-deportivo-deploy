import { IsString, MaxLength, MinLength } from 'class-validator';

import { LARGO_MAXIMO_PASSWORD } from '../../common/largos';

/**
 * `CambiarPasswordRequest` del contrato.
 *
 * La actual no lleva `@MinLength`: se compara con el hash guardado, y exigirle
 * un largo mínimo solo cambiaría un 401 por un 400, contando de paso que la
 * contraseña real no puede ser corta. El máximo sí: más allá de 72 bytes
 * bcrypt no compara nada, así que una más larga nunca pudo ser la correcta.
 */
export class CambiarPasswordDto {
  @IsString()
  @MaxLength(LARGO_MAXIMO_PASSWORD)
  actual: string;

  /** El mismo mínimo y el mismo máximo que el registro. */
  @IsString()
  @MinLength(8)
  @MaxLength(LARGO_MAXIMO_PASSWORD)
  nueva: string;
}
