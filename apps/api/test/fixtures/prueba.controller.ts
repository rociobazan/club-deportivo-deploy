import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsEmail } from 'class-validator';
import { Publico, Roles } from '../../src/common/decoradores';
import { UsuarioActual } from '../../src/common/usuario-actual';
// `import type`: con emitDecoratorMetadata, un tipo en una firma decorada no puede ser import de valor.
import type { UsuarioAutenticado } from '../../src/common/usuario-actual';

/**
 * FIXTURE SOLO PARA LOS E2E. Se registra en el módulo de prueba, nunca en
 * AppModule. Existe porque los endpoints reales que ejercitan pipe, filtro y
 * guards (`GET /admin/panel`, `GET /canchas`) son de otros ítems del reparto.
 */
class PruebaDto {
  @IsEmail()
  email: string;
}

@Controller('prueba')
export class PruebaController {
  /** Solo ADMIN: reemplaza a `GET /admin/panel` (ítem 1.6) en los escenarios de rol. */
  @Roles('ADMIN')
  @Get('solo-admin')
  soloAdmin(@UsuarioActual() usuario: UsuarioAutenticado) {
    return { ok: true, usuario };
  }

  /** Cualquier autenticado, sin `@Roles()`. */
  @Get('autenticado')
  autenticado(@UsuarioActual() usuario: UsuarioAutenticado) {
    return { ok: true, usuario };
  }

  /** Público con DTO: ejercita el ValidationPipe y el filtro sin depender de `auth`. */
  @Publico()
  @Post('validacion')
  validacion(@Body() cuerpo: PruebaDto) {
    return { ok: true, email: cuerpo.email };
  }

  /** Un error que no es HttpException: tiene que salir como 500 genérico. */
  @Publico()
  @Get('explota')
  explota(): never {
    throw new Error('detalle interno que no debe llegar al cliente');
  }
}
