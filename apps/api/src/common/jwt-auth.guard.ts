import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
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

    let payload: PayloadJwt & { iat: number };
    try {
      payload = await this.jwt.verifyAsync<PayloadJwt & { iat: number }>(token);
    } catch {
      // Vencido, mal formado o con otra firma: para el cliente es lo mismo.
      if (esPublico) return true;
      throw noAutenticado();
    }

    // Fuera del try: si la base falla, es un 500 y no un "no autenticado".
    const id = Number(payload.sub);
    if (await this.emitidoAntesDelCambioDePassword(id, payload.iat)) {
      if (esPublico) return true;
      throw noAutenticado();
    }

    solicitud.usuario = { id, rol: payload.rol };
    return true;
  }

  /**
   * Un token emitido antes del último cambio de contraseña ya no sirve
   * (design.md de RF-16, decisión 10). En segundos enteros, porque `iat` no
   * tiene más precisión: el token del reingreso, en el mismo segundo del
   * cambio, sigue sirviendo. Sin usuario o sin cambio, no decide nada.
   *
   * Es una consulta por clave primaria en cada solicitud con token: el lugar
   * para cachear si alguna vez pesa.
   */
  private async emitidoAntesDelCambioDePassword(id: number, iat: number): Promise<boolean> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { passwordCambiadaEn: true },
    });
    const cambio = usuario?.passwordCambiadaEn;
    if (!cambio) return false;
    return iat < Math.floor(cambio.getTime() / 1000);
  }
}

function extraerBearer(cabecera: string | undefined): string | undefined {
  if (!cabecera) return undefined;
  const [esquema, token] = cabecera.split(' ');
  return esquema === 'Bearer' && token ? token : undefined;
}
