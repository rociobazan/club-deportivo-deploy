import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/** `LoginRequest` del contrato. */
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
