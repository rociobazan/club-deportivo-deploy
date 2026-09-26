import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Publico } from '../common/decoradores';
import { UsuarioActual } from '../common/usuario-actual';
import type { UsuarioAutenticado } from '../common/usuario-actual';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegistroDto } from './dto/registro.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** `POST /auth/registro` → 201 con el `Usuario` creado. */
  @Publico()
  @Post('registro')
  registrar(@Body() datos: RegistroDto) {
    return this.auth.registrar(datos);
  }

  /** `POST /auth/login` → 200 (no el 201 por defecto de POST) con `LoginResponse`. */
  @Publico()
  @HttpCode(200)
  @Post('login')
  ingresar(@Body() datos: LoginDto) {
    return this.auth.ingresar(datos);
  }

  /** `GET /auth/perfil` → 200 con el usuario del token. */
  @Get('perfil')
  perfil(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.auth.perfil(usuario.id);
  }
}
