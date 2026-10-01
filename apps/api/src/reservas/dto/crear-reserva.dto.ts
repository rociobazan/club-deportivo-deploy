import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ENTERO_MAXIMO_DB, EsFecha, EsHora } from '../../common/validadores';

/*
 * `CrearReservaRequest` del contrato. El body es JSON, así que los enteros ya
 * llegan como número y no hace falta el `@Type(() => Number)` que sí llevan los
 * DTOs de query.
 *
 * `clienteId` no está acá a propósito: el titular sale del `sub` del token. El
 * ValidationPipe global corre con `forbidNonWhitelisted`, así que mandarlo
 * responde 400 sin que este archivo lo mencione (escenario "Intento de reservar
 * a nombre de otro").
 */

export class ItemEquipamientoDto {
  @IsInt()
  @Min(1)
  @Max(ENTERO_MAXIMO_DB)
  equipamientoId!: number;

  @IsInt()
  @Min(1)
  @Max(ENTERO_MAXIMO_DB)
  cantidad!: number;
}

export class CrearReservaDto {
  @IsInt()
  @Min(1)
  @Max(ENTERO_MAXIMO_DB)
  canchaId!: number;

  @EsFecha()
  fecha!: string;

  @EsHora()
  horaInicio!: string;

  /** Informativa: no interviene en el precio (RN-06). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(ENTERO_MAXIMO_DB)
  cantidadJugadores?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemEquipamientoDto)
  // Un ítem repetido es 400 y no una suma silenciosa de cantidades: la spec lo
  // pide explícitamente (escenario "Ítem repetido").
  @ArrayUnique((item: ItemEquipamientoDto) => item.equipamientoId, {
    message: 'equipamiento no puede repetir el mismo equipamientoId',
  })
  equipamiento?: ItemEquipamientoDto[];
}
