import { exigirRol, SolicitudConUsuario, UsuarioAutenticado } from './usuario-actual';

const solicitudCon = (usuario?: UsuarioAutenticado) =>
  ({ usuario }) as SolicitudConUsuario;

describe('exigirRol', () => {
  it('sin usuario responde 401 NO_AUTENTICADO', () => {
    expect(() => exigirRol(solicitudCon(undefined), 'ADMIN')).toThrow(
      expect.objectContaining({ estado: 401, tipo: 'NO_AUTENTICADO' }),
    );
  });

  it('con otro rol responde 403 SIN_PERMISOS', () => {
    expect(() => exigirRol(solicitudCon({ id: 1, rol: 'SOCIO' }), 'ADMIN')).toThrow(
      expect.objectContaining({ estado: 403, tipo: 'SIN_PERMISOS' }),
    );
  });

  it('con el rol pedido devuelve al usuario', () => {
    expect(exigirRol(solicitudCon({ id: 2, rol: 'ADMIN' }), 'ADMIN')).toEqual({ id: 2, rol: 'ADMIN' });
  });
});
