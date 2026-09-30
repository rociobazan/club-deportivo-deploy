import { IsString, MinLength } from 'class-validator';

/**
 * `CambiarPasswordRequest` del contrato.
 *
 * La actual no lleva `@MinLength`: se compara con el hash guardado, y exigirle
 * un largo mínimo solo cambiaría un 401 por un 400, contando de paso que la
 * contraseña real no puede ser corta.
 */
export class CambiarPasswordDto {
  @IsString()
  actual: string;

  /** El mismo mínimo que el registro. */
  @IsString()
  @MinLength(8)
  nueva: string;
}
