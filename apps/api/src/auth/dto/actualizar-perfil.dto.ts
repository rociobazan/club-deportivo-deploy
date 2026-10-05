import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

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
 *
 * `nombre`, `apellido` y `email` usan `@ValidateIf` y no `@IsOptional()`:
 * `@IsOptional()` también deja pasar `null` sin validar, y el servicio
 * terminaba haciendo `null.trim()`, que respondía 500. Con `@ValidateIf`, solo
 * `undefined` significa "no lo cambio", y un `null` es 400. El teléfono sí
 * acepta `null`, porque es como se borra.
 */
const enviado = (_objeto: object, valor: unknown) => valor !== undefined;

export class ActualizarPerfilDto {
  @ValidateIf(enviado)
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nombre?: string;

  @ValidateIf(enviado)
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  apellido?: string;

  @ValidateIf(enviado)
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
