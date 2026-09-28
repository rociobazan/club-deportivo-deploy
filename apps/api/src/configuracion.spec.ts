import { leerConfiguracion } from './configuracion';

describe('leerConfiguracion', () => {
  const completo = { JWT_SECRET: 'secreto', JWT_EXPIRES_IN: '1h' };

  it('devuelve la configuración cuando están las variables obligatorias, con los defaults del club', () => {
    expect(leerConfiguracion(completo)).toEqual({
      jwtSecret: 'secreto',
      jwtExpiresIn: '1h',
      frontendUrl: 'http://localhost:3001',
      horaApertura: '08:00',
      horaCierre: '23:00',
      zonaHoraria: 'America/Argentina/Cordoba',
    });
  });

  it('toma el horario de atención y la zona del entorno', () => {
    const configuracion = leerConfiguracion({
      ...completo,
      HORA_APERTURA: '09:00',
      HORA_CIERRE: '22:00',
      ZONA_HORARIA_CLUB: 'America/Montevideo',
    });
    expect(configuracion).toMatchObject({
      horaApertura: '09:00',
      horaCierre: '22:00',
      zonaHoraria: 'America/Montevideo',
    });
  });

  it('corta el arranque si una hora no tiene formato HH:MM', () => {
    expect(() => leerConfiguracion({ ...completo, HORA_CIERRE: '7pm' })).toThrow('HORA_CIERRE');
    expect(() => leerConfiguracion({ ...completo, HORA_APERTURA: '8:00' })).toThrow('HORA_APERTURA');
  });

  it('corta el arranque si la apertura no es anterior al cierre', () => {
    expect(() =>
      leerConfiguracion({ ...completo, HORA_APERTURA: '23:00', HORA_CIERRE: '08:00' }),
    ).toThrow('anterior');
    expect(() =>
      leerConfiguracion({ ...completo, HORA_APERTURA: '10:00', HORA_CIERRE: '10:00' }),
    ).toThrow('anterior');
  });

  it('corta el arranque si la zona horaria no existe', () => {
    expect(() => leerConfiguracion({ ...completo, ZONA_HORARIA_CLUB: 'Marte/Base' })).toThrow(
      'ZONA_HORARIA_CLUB',
    );
  });

  it('corta el arranque si falta JWT_SECRET', () => {
    expect(() => leerConfiguracion({ JWT_EXPIRES_IN: '1h' })).toThrow(
      'JWT_SECRET',
    );
  });

  it('corta el arranque si falta JWT_EXPIRES_IN', () => {
    expect(() => leerConfiguracion({ JWT_SECRET: 'secreto' })).toThrow(
      'JWT_EXPIRES_IN',
    );
  });

  it('corta el arranque si JWT_EXPIRES_IN no es una duración válida', () => {
    expect(() =>
      leerConfiguracion({ ...completo, JWT_EXPIRES_IN: 'una hora' }),
    ).toThrow('JWT_EXPIRES_IN');
  });

  it('acepta duraciones con unidad en JWT_EXPIRES_IN tal cual', () => {
    for (const valor of ['30m', '7d', '1.5h', '2 days']) {
      expect(leerConfiguracion({ ...completo, JWT_EXPIRES_IN: valor }).jwtExpiresIn).toBe(valor);
    }
  });

  it('convierte los dígitos sueltos a número, porque como string jsonwebtoken los lee en milisegundos', () => {
    expect(leerConfiguracion({ ...completo, JWT_EXPIRES_IN: '3600' }).jwtExpiresIn).toBe(3600);
  });

  it('trata una variable en blanco como ausente', () => {
    expect(() =>
      leerConfiguracion({ ...completo, JWT_SECRET: '   ' }),
    ).toThrow('JWT_SECRET');
  });

  it('fuera de producción usa FRONTEND_URL si está definida', () => {
    expect(
      leerConfiguracion({ ...completo, FRONTEND_URL: 'https://club.test' })
        .frontendUrl,
    ).toBe('https://club.test');
  });

  it('en producción exige FRONTEND_URL', () => {
    expect(() =>
      leerConfiguracion({ ...completo, NODE_ENV: 'production' }),
    ).toThrow('FRONTEND_URL');
  });
});
