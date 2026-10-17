import { Body, Controller, Get, HttpCode, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Publico } from '../common/decoradores';
import { UsuarioActual } from '../common/usuario-actual';
import type { UsuarioAutenticado } from '../common/usuario-actual';
import { AuthService } from './auth.service';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegistroDto } from './dto/registro.dto';
import { GuardDeLimiteDeAuth } from './guard-de-limite';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * `POST /auth/registro` → 201 con el `Usuario` creado. Limitado por IP con
   * el throttler `registro`; el `login` se salta para que no cuente dos veces.
   */
  @Publico()
  @UseGuards(GuardDeLimiteDeAuth)
  @SkipThrottle({ login: true })
  @Post('registro')
  registrar(@Body() datos: RegistroDto) {
    return this.auth.registrar(datos);
  }

  /**
   * `POST /auth/login` → 200 (no el 201 por defecto de POST) con `LoginResponse`.
   * Limitado por IP con el throttler `login`.
   */
  @Publico()
  @UseGuards(GuardDeLimiteDeAuth)
  @SkipThrottle({ registro: true })
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

  /**
   * `PATCH /auth/perfil` → 200 con el usuario ya actualizado.
   *
   * Sin `@Publico()`, así el guard global exige sesión. El id sale del token y
   * nunca del cuerpo ni de la ruta: por eso cuelga de `/auth` y no de
   * `/usuarios/{id}`, donde habría que validar la pertenencia en cada llamada.
   */
  @Patch('perfil')
  actualizarPerfil(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() datos: ActualizarPerfilDto,
  ) {
    return this.auth.actualizarPerfil(usuario.id, datos);
  }

  /** `PUT /auth/password` → 204, sin cuerpo: no hay nada útil que devolver. */
  @HttpCode(204)
  @Put('password')
  cambiarPassword(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() datos: CambiarPasswordDto,
  ) {
    return this.auth.cambiarPassword(usuario.id, datos);
  }
}
