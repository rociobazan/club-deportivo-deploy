import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { recortar } from '../../common/transformaciones';

/**
 * `ContactoRequest` del contrato. `sitioWeb` es el campo trampa anti-spam: se
 * declara para que el pipe no lo rechace con un 400 que le daría señal al bot,
 * y su contenido no se valida. Quién decide qué hacer con él es el servicio
 * (design.md, decisión 4).
 *
 * Los textos se recortan antes de validar, igual que en `RegistroDto`: sin
 * eso, un nombre o un mensaje de solo espacios pasaba `@IsNotEmpty()` y le
 * llegaba al club un mail vacío, aunque la spec los declara obligatorios.
 */
export class ContactoDto {
  @IsString()
  @Transform(recortar)
  @IsNotEmpty()
  @MaxLength(60)
  nombre: string;

  @Transform(recortar)
  @IsEmail()
  email: string;

  @IsString()
  @Transform(recortar)
  @IsNotEmpty()
  @MaxLength(30)
  telefono: string;

  @IsString()
  @Transform(recortar)
  @IsNotEmpty()
  @MaxLength(1000)
  mensaje: string;

  @IsOptional()
  @IsString()
  sitioWeb?: string;
}
