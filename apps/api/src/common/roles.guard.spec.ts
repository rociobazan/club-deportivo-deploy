import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Rol } from './decoradores';
import { RolesGuard } from './roles.guard';
import { SolicitudConUsuario, UsuarioAutenticado } from './usuario-actual';

function contextoCon(usuario?: UsuarioAutenticado): ExecutionContext {
  const solicitud = { usuario } as SolicitudConUsuario;
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => solicitud }),
  } as unknown as ExecutionContext;
}

const conRoles = (roles: Rol[] | undefined) =>
  new RolesGuard({ getAllAndOverride: () => roles } as unknown as Reflector);

describe('RolesGuard', () => {
  it('sin @Roles() deja pasar a cualquier autenticado', () => {
    expect(conRoles(undefined).canActivate(contextoCon({ id: 1, rol: 'SOCIO' }))).toBe(true);
    expect(conRoles([]).canActivate(contextoCon({ id: 1, rol: 'SOCIO' }))).toBe(true);
  });

  it('rechaza con 403 SIN_PERMISOS un rol no admitido (escenario "Rol no admitido")', () => {
    expect(() =>
      conRoles(['ADMIN']).canActivate(contextoCon({ id: 1, rol: 'SOCIO' })),
    ).toThrow(expect.objectContaining({ estado: 403, tipo: 'SIN_PERMISOS' }));
  });

  it('deja pasar un rol admitido (escenario "Rol admitido")', () => {
    expect(conRoles(['SOCIO', 'ADMIN']).canActivate(contextoCon({ id: 1, rol: 'SOCIO' }))).toBe(true);
    expect(conRoles(['ADMIN']).canActivate(contextoCon({ id: 2, rol: 'ADMIN' }))).toBe(true);
  });

  it('con @Roles() pero sin usuario responde 401, no 403', () => {
    expect(() => conRoles(['ADMIN']).canActivate(contextoCon(undefined))).toThrow(
      expect.objectContaining({ estado: 401, tipo: 'NO_AUTENTICADO' }),
    );
  });
});
