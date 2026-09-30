import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { recortar } from '../../common/transformaciones';

/** `RegistroRequest` del contrato. Sin `rol`: el pipe rechaza cualquier campo no declarado. */
export class RegistroDto {
  @IsString()
  @Transform(recortar)
  @IsNotEmpty()
  @MaxLength(60)
  nombre: string;

  @IsString()
  @Transform(recortar)
  @IsNotEmpty()
  @MaxLength(60)
  apellido: string;

  @Transform(recortar)
  @IsEmail()
  email: string;

  /** La contraseña **no** se recorta: los espacios de los extremos son parte de ella. */
  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  @Transform(recortar)
  @MaxLength(30)
  telefono?: string;
}
