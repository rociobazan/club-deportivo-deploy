import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

import { recortar } from '../../common/transformaciones';

/** `LoginRequest` del contrato. */
export class LoginDto {
  /**
   * Se recorta antes de validar: un mail copiado y pegado suele traer un espacio
   * al final, y sin esto `@IsEmail()` devuelve 400 con un mensaje que no ayuda.
   */
  @Transform(recortar)
  @IsEmail()
  email: string;

  /** La contraseña **no** se recorta: los espacios de los extremos son parte de ella. */
  @IsString()
  @IsNotEmpty()
  password: string;
}
