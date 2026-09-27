import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * `ContactoRequest` del contrato. `sitioWeb` es el campo trampa anti-spam: se
 * declara para que el pipe no lo rechace con un 400 que le daría señal al bot,
 * y su contenido no se valida. Quién decide qué hacer con él es el servicio
 * (design.md, decisión 4).
 */
export class ContactoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nombre: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  mensaje: string;

  @IsOptional()
  @IsString()
  sitioWeb?: string;
}
