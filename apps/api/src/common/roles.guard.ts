import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Rol, ROLES_PERMITIDOS } from './decoradores';
import { ErrorDeApi } from './error-de-api';
import { noAutenticado, SolicitudConUsuario } from './usuario-actual';

/**
 * Guard global que corre después del de JWT: si el endpoint declara
 * `@Roles(...)`, el rol del token tiene que estar entre ellos. El rechazo por
 * rol es 403 `SIN_PERMISOS`; el acceso a un recurso ajeno lo decide cada
 * capacidad (por ejemplo `reservas` responde 404), no este guard.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(
      ROLES_PERMITIDOS,
      [contexto.getHandler(), contexto.getClass()],
    );
    if (!roles || roles.length === 0) return true;

    const { usuario } = contexto.switchToHttp().getRequest<SolicitudConUsuario>();
    // `@Roles()` en un endpoint `@Publico()` es contradictorio: se exige token.
    if (!usuario) throw noAutenticado();

    if (!roles.includes(usuario.rol)) {
      throw new ErrorDeApi(
        403,
        'SIN_PERMISOS',
        'No tenés permisos para esta operación',
        `Esta operación requiere rol ${roles.join(' o ')}.`,
      );
    }
    return true;
  }
}
