import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { LARGO_MAXIMO_EMAIL, LARGO_MAXIMO_PASSWORD } from '../../common/largos';

import { recortar } from '../../common/transformaciones';

/** `LoginRequest` del contrato. */
export class LoginDto {
  /**
   * Se recorta antes de validar: un mail copiado y pegado suele traer un espacio
   * al final, y sin esto `@IsEmail()` devuelve 400 con un mensaje que no ayuda.
   */
  @Transform(recortar)
  @IsEmail()
  @MaxLength(LARGO_MAXIMO_EMAIL)
  email: string;

  /** La contraseña **no** se recorta: los espacios de los extremos son parte de ella. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(LARGO_MAXIMO_PASSWORD)
  password: string;
}
