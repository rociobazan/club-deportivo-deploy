import { SetMetadata } from '@nestjs/common';

export type Rol = 'ADMIN' | 'SOCIO';

export const ES_PUBLICO = 'esPublico';
export const ROLES_PERMITIDOS = 'rolesPermitidos';

/**
 * Exime al endpoint del guard de JWT. Los guards son globales, así que un
 * endpoint sin este decorador exige token: olvidarlo deja el endpoint cerrado,
 * no abierto (design.md, decisión 2).
 *
 * Los endpoints públicos con variante privada (por ejemplo
 * `GET /canchas?incluirInactivas=true`, que exige ADMIN) se marcan públicos y
 * resuelven el rol adentro: el guard no puede decidir por un query param.
 */
export const Publico = () => SetMetadata(ES_PUBLICO, true);

/**
 * Restringe el endpoint a los roles indicados. Sin este decorador alcanza con
 * estar autenticado.
 */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_PERMITIDOS, roles);
