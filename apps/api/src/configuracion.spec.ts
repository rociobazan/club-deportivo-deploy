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
      horaCierreSabado: '18:00',
      diasCerrados: [0],
      zonaHoraria: 'America/Argentina/Cordoba',
      mailFrom: 'turnos@clubdeploy.com.ar',
      mailContacto: 'hola@clubdeploy.com.ar',
      resendApiKey: undefined,
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
    expect(() =>
      leerConfiguracion({ ...completo, HORA_APERTURA: '19:00', HORA_CIERRE_SABADO: '18:00' }),
    ).toThrow('HORA_CIERRE_SABADO');
  });

  it('toma el cierre de los sábados y los días cerrados del entorno', () => {
    expect(
      leerConfiguracion({ ...completo, HORA_CIERRE_SABADO: '20:00', DIAS_CERRADOS: '0,6' }),
    ).toMatchObject({ horaCierreSabado: '20:00', diasCerrados: [0, 6] });
  });

  it('DIAS_CERRADOS vacío significa que el club abre todos los días', () => {
    expect(leerConfiguracion({ ...completo, DIAS_CERRADOS: '' })).toMatchObject({
      diasCerrados: [],
    });
  });

  it('DIAS_CERRADOS ignora repetidos y los deja ordenados', () => {
    expect(leerConfiguracion({ ...completo, DIAS_CERRADOS: '6, 0, 6' })).toMatchObject({
      diasCerrados: [0, 6],
    });
  });

  it('corta el arranque si DIAS_CERRADOS no son días de la semana', () => {
    for (const valor of ['7', '-1', 'domingo', '0;6']) {
      expect(() => leerConfiguracion({ ...completo, DIAS_CERRADOS: valor })).toThrow(
        'DIAS_CERRADOS',
      );
    }
  });

  it('corta el arranque si DIAS_CERRADOS deja al club sin abrir nunca', () => {
    expect(() =>
      leerConfiguracion({ ...completo, DIAS_CERRADOS: '0,1,2,3,4,5,6' }),
    ).toThrow('siete días');
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

  it('toma las casillas de mail del entorno', () => {
    expect(
      leerConfiguracion({
        ...completo,
        MAIL_FROM: 'sistema@otroclub.test',
        MAIL_CONTACTO: 'consultas@otroclub.test',
      }),
    ).toMatchObject({
      mailFrom: 'sistema@otroclub.test',
      mailContacto: 'consultas@otroclub.test',
    });
  });

  it('corta el arranque si una casilla no es una dirección de mail', () => {
    expect(() => leerConfiguracion({ ...completo, MAIL_FROM: 'turnos@' })).toThrow('MAIL_FROM');
    expect(() => leerConfiguracion({ ...completo, MAIL_CONTACTO: 'hola' })).toThrow(
      'MAIL_CONTACTO',
    );
  });

  it('fuera de producción deja RESEND_API_KEY sin definir, así el cliente de mail es el doble', () => {
    expect(leerConfiguracion(completo).resendApiKey).toBeUndefined();
    expect(leerConfiguracion({ ...completo, RESEND_API_KEY: 're_algo' }).resendApiKey).toBe(
      're_algo',
    );
  });

  it('en producción exige RESEND_API_KEY', () => {
    const produccion = {
      ...completo,
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://club.test',
    };
    expect(() => leerConfiguracion(produccion)).toThrow('RESEND_API_KEY');
    expect(
      leerConfiguracion({ ...produccion, RESEND_API_KEY: 're_algo' }).resendApiKey,
    ).toBe('re_algo');
  });
});
