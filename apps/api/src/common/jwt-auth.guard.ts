import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ES_PUBLICO, Rol } from './decoradores';
import { noAutenticado, SolicitudConUsuario } from './usuario-actual';

/** Lo que firma `AuthService` al ingresar: `sub` es el id del usuario. */
export type PayloadJwt = { sub: number; rol: Rol };

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

    try {
      const payload = await this.jwt.verifyAsync<PayloadJwt>(token);
      solicitud.usuario = { id: Number(payload.sub), rol: payload.rol };
      return true;
    } catch {
      // Vencido, mal formado o con otra firma: para el cliente es lo mismo.
      if (esPublico) return true;
      throw noAutenticado();
    }
  }
}

function extraerBearer(cabecera: string | undefined): string | undefined {
  if (!cabecera) return undefined;
  const [esquema, token] = cabecera.split(' ');
  return esquema === 'Bearer' && token ? token : undefined;
}
