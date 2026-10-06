import { leerAdmin } from './carga-produccion';

describe('leerAdmin', () => {
  it('toma el mail normalizado y la contraseña del entorno', () => {
    expect(leerAdmin({ ADMIN_EMAIL: '  Admin@ClubDeploy.Online ', ADMIN_PASSWORD: 'una-clave-larga' })).toEqual({
      email: 'admin@clubdeploy.online',
      password: 'una-clave-larga',
    });
  });

  it.each([
    [{ ADMIN_PASSWORD: 'una-clave-larga' }, /ADMIN_EMAIL/],
    [{ ADMIN_EMAIL: 'no-es-un-mail', ADMIN_PASSWORD: 'una-clave-larga' }, /ADMIN_EMAIL/],
    [{ ADMIN_EMAIL: 'admin@clubdeploy.online' }, /ADMIN_PASSWORD/],
    [{ ADMIN_EMAIL: 'admin@clubdeploy.online', ADMIN_PASSWORD: 'corta' }, /ADMIN_PASSWORD/],
  ])('corta con un error que nombra la variable que falla: %j', (entorno, error) => {
    expect(() => leerAdmin(entorno)).toThrow(error);
  });

  it('no pone la contraseña en el mensaje de error', () => {
    expect(() => leerAdmin({ ADMIN_EMAIL: 'admin@clubdeploy.online', ADMIN_PASSWORD: 'corta' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('corta') }),
    );
  });
});
