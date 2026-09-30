import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { recortar } from '../../common/transformaciones';

/**
 * `ActualizarPerfilRequest` del contrato. Todos los campos son opcionales:
 * quien cambia solo el teléfono manda solo el teléfono.
 *
 * Sin `rol` ni `activo`, igual que `RegistroDto`: el pipe global está en
 * `forbidNonWhitelisted`, así que cualquier campo no declarado da 400 sin que
 * haya que escribir la validación.
 *
 * Que el cuerpo traiga **al menos un campo** se verifica en el servicio y no
 * acá: `@IsOptional()` corta la validación de una propiedad cuando su valor es
 * `undefined`, así que un decorador de clase apoyado en una propiedad opcional
 * no llegaría a correr justo en el caso que tiene que detectar, el del cuerpo
 * vacío.
 */
export class ActualizarPerfilDto {
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nombre?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  apellido?: string;

  @IsOptional()
  @Transform(recortar)
  @IsEmail()
  email?: string;

  /** `null` borra el teléfono; `@IsOptional()` deja pasar `null` y `undefined`. */
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(30)
  telefono?: string | null;
}
