import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { Rol } from './decoradores';
import { ErrorDeApi } from './error-de-api';

/** Lo que el guard de JWT deja en la solicitud a partir del payload del token. */
export type UsuarioAutenticado = { id: number; rol: Rol };

export type SolicitudConUsuario = Request & { usuario?: UsuarioAutenticado };

export const noAutenticado = () =>
  new ErrorDeApi(
    401,
    'NO_AUTENTICADO',
    'Se requiere autenticación',
    'El token no fue enviado o ya expiró.',
  );

/**
 * Para endpoints públicos con una variante privada (`GET /canchas?incluirInactivas=true`):
 * el guard dejó al usuario si vino un token válido; acá se exige el rol.
 * Sin usuario → 401; con otro rol → 403.
 */
export function exigirRol(solicitud: SolicitudConUsuario, rol: Rol): UsuarioAutenticado {
  const { usuario } = solicitud;
  if (!usuario) throw noAutenticado();
  if (usuario.rol !== rol) {
    throw new ErrorDeApi(
      403,
      'SIN_PERMISOS',
      'No tenés permisos para esta operación',
      `Esta operación requiere rol ${rol}.`,
    );
  }
  return usuario;
}

/**
 * Inyecta el usuario autenticado en un handler: `perfil(@UsuarioActual() usuario)`.
 * Si no hay usuario es porque el endpoint es público; usarlo ahí es un error de
 * programación y se responde como 401 en vez de romper con un undefined.
 */
export const UsuarioActual = createParamDecorator(
  (_datos: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
    const { usuario } = contexto.switchToHttp().getRequest<SolicitudConUsuario>();
    if (!usuario) throw noAutenticado();
    return usuario;
  },
);
