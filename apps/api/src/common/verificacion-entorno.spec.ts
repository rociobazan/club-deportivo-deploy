import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { IsEmail, validateSync } from 'class-validator';

// Nest 12 es solo ESM y Jest corre con --experimental-vm-modules: este test
// comprueba que las dependencias de autenticación cargan y funcionan en ese
// entorno, incluido el binario nativo de bcrypt, antes de construir nada encima.
class Prueba {
  @IsEmail()
  email: string;
}

describe('entorno: dependencias de autenticación', () => {
  it('firma y verifica un JWT con @nestjs/jwt', async () => {
    const jwt = new JwtService({
      secret: 'secreto-de-prueba',
      signOptions: { expiresIn: '1h' },
    });
    const token = await jwt.signAsync({ sub: 1, rol: 'SOCIO' });
    const payload = await jwt.verifyAsync<{ sub: number; rol: string }>(token);

    expect(payload.sub).toBe(1);
    expect(payload.rol).toBe('SOCIO');
  });

  it('hashea y compara una clave con bcrypt', async () => {
    const hash = await bcrypt.hash('clave1234', 10);

    expect(hash).not.toBe('clave1234');
    await expect(bcrypt.compare('clave1234', hash)).resolves.toBe(true);
    await expect(bcrypt.compare('otra', hash)).resolves.toBe(false);
  });

  it('valida un DTO con class-validator y class-transformer', () => {
    const valido = plainToInstance(Prueba, { email: 'socio@club.test' });
    const invalido = plainToInstance(Prueba, { email: 'no-es-un-mail' });

    expect(validateSync(valido)).toHaveLength(0);
    expect(validateSync(invalido)).toHaveLength(1);
  });
});
