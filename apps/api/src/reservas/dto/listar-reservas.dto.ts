import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { EstadoReserva } from '@prisma/client';
import { EsFecha } from '../../common/validadores';

export class ListarReservasDto {
  /** Solo tiene efecto para ADMIN: un SOCIO recibe siempre las propias (RN-13). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clienteId?: number;

  @IsOptional()
  @EsFecha()
  fecha?: string;

  /** Incluye `COMPLETADA`, que no se persiste: se deriva al leer (decisión 9). */
  @IsOptional()
  @IsEnum(EstadoReserva)
  estado?: EstadoReserva;
}
