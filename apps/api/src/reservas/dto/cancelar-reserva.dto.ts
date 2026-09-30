import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelarReservaDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}
