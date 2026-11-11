import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

import { LARGO_MAXIMO_PASSWORD } from '../../common/largos';

/** El token real tiene 43 caracteres; el máximo del contrato deja margen y corta los cuerpos absurdos. */
export const LARGO_MAXIMO_TOKEN = 128;

/** `RestablecerPasswordRequest` del contrato. */
export class RestablecerPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(LARGO_MAXIMO_TOKEN)
  token: string;

  /** El mismo mínimo y el mismo máximo que el registro. */
  @IsString()
  @MinLength(8)
  @MaxLength(LARGO_MAXIMO_PASSWORD)
  passwordNueva: string;
}
