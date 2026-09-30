import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Recorta antes de validar. Sin esto, `"   "` pasa `@MinLength(1)` —son tres
 * caracteres— y el servicio lo guarda como cadena vacía: se puede borrar el
 * nombre propio mandando espacios.
 */
const recortado = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

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
  @recortado()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nombre?: string;

  @IsOptional()
  @recortado()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  apellido?: string;

  @IsOptional()
  @recortado()
  @IsEmail()
  email?: string;

  /** `null` borra el teléfono; `@IsOptional()` deja pasar `null` y `undefined`. */
  @IsOptional()
  @recortado()
  @IsString()
  @MaxLength(30)
  telefono?: string | null;
}
