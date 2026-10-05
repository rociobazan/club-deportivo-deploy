import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { recortar } from '../../common/transformaciones';
import { enviado, EsPrecio } from '../../common/validadores';

/**
 * `ActualizarCanchaRequest` del contrato: solo se modifican los campos
 * enviados. No declara `disciplinaId`: una cancha no cambia de disciplina, y el
 * pipe rechaza el campo con 400.
 *
 * Que venga **al menos un campo** lo verifica el servicio, por el mismo motivo
 * que en el perfil: un decorador de clase apoyado en propiedades opcionales no
 * corre justo en el caso del cuerpo vacío.
 *
 * Todos usan `@ValidateIf(enviado)` salvo `superficie`, que acepta `null`
 * porque es como se borra.
 */
export class ActualizarCanchaDto {
  @ValidateIf(enviado)
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  nombre?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(30)
  superficie?: string | null;

  @ValidateIf(enviado)
  @IsBoolean()
  techada?: boolean;

  @ValidateIf(enviado)
  @EsPrecio()
  precioPorTurno?: number;

  @ValidateIf(enviado)
  @IsBoolean()
  activa?: boolean;
}
