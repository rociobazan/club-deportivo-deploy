import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ES_PUBLICO, Rol } from './decoradores';
import { noAutenticado, SolicitudConUsuario } from './usuario-actual';

/**
 * Lo que firma `AuthService` al ingresar: `sub` es el id del usuario y
 * `cambioPassword`, el último cambio de contraseña en milisegundos, si hubo.
 */
export type PayloadJwt = { sub: number; rol: Rol; cambioPassword?: number };

/**
 * Guard global: todo endpoint exige `Authorization: Bearer <jwt>` salvo que
 * esté marcado con `@Publico()` (design.md, decisión 2). Deja `{ id, rol }` en
 * `request.usuario` para el guard de roles y para `@UsuarioActual()`.
 *
 * En un endpoint público el token es opcional: si viene y es válido, el
 * usuario queda disponible (así `GET /canchas?incluirInactivas=true` puede
 * exigir ADMIN); si falta o es inválido, la solicitud sigue como anónima.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);

    const solicitud = contexto.switchToHttp().getRequest<SolicitudConUsuario>();
    const token = extraerBearer(solicitud.headers.authorization);
    if (!token) {
      if (esPublico) return true;
      throw noAutenticado();
    }

    let payload: PayloadJwt;
    try {
      payload = await this.jwt.verifyAsync<PayloadJwt>(token);
    } catch {
      // Vencido, mal formado o con otra firma: para el cliente es lo mismo.
      if (esPublico) return true;
      throw noAutenticado();
    }

    // Fuera del try: si la base falla, es un 500 y no un "no autenticado".
    const id = Number(payload.sub);
    if (await this.anteriorAlCambioDePassword(id, payload.cambioPassword)) {
      if (esPublico) return true;
      throw noAutenticado();
    }

    solicitud.usuario = { id, rol: payload.rol };
    return true;
  }

  /**
   * Un token ya no sirve si la contraseña cambió después de emitirlo
   * (design.md de RF-16, decisión 10). Se compara el cambio que el token trae
   * firmado con el de la base, exacto al milisegundo, y no la fecha de
   * emisión: así no hay ventana entre que el login comprueba la contraseña
   * vieja y firma el token. Sin cambio en la base, sirve el token que no trae
   * ninguno, como todos los emitidos antes de que existiera la columna. Sin
   * usuario, no decide nada.
   *
   * Es una consulta por clave primaria en cada solicitud con token: el lugar
   * para cachear si alguna vez pesa.
   */
  private async anteriorAlCambioDePassword(
    id: number,
    cambioFirmado: number | undefined,
  ): Promise<boolean> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { passwordCambiadaEn: true },
    });
    if (!usuario) return false;
    return (cambioFirmado ?? null) !== (usuario.passwordCambiadaEn?.getTime() ?? null);
  }
}

function extraerBearer(cabecera: string | undefined): string | undefined {
  if (!cabecera) return undefined;
  const [esquema, token] = cabecera.split(' ');
  return esquema === 'Bearer' && token ? token : undefined;
}
