import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';

import { LARGO_MAXIMO_EMAIL } from '../../common/largos';
import { recortar } from '../../common/transformaciones';

/** `RecuperarPasswordRequest` del contrato. */
export class RecuperarPasswordDto {
  @Transform(recortar)
  @IsEmail()
  @MaxLength(LARGO_MAXIMO_EMAIL)
  email: string;
}
