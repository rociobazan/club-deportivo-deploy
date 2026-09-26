import { BadRequestException } from '@nestjs/common';
import { crearPipeDeValidacion } from '../../common/validacion';
import { LoginDto } from './login.dto';
import { RegistroDto } from './registro.dto';

// El mismo pipe que registra AppModule como APP_PIPE.
const pipe = crearPipeDeValidacion();

const validar = (metatype: new () => object, valor: unknown) =>
  pipe.transform(valor, { type: 'body', metatype });

const registroValido = {
  nombre: 'Ana',
  apellido: 'Socia',
  email: 'ana@club.test',
  password: 'unaClaveSegura123',
};

describe('RegistroDto', () => {
  it('acepta un cuerpo válido, con teléfono opcional ausente', async () => {
    await expect(validar(RegistroDto, registroValido)).resolves.toBeInstanceOf(RegistroDto);
  });

  it('Datos mal formados: rechaza mail inválido, clave corta o campo faltante', async () => {
    const casos = [
      { ...registroValido, email: 'no-es-un-mail' },
      { ...registroValido, password: '1234567' },
      { nombre: 'Ana', email: 'ana@club.test', password: 'unaClaveSegura123' },
      { ...registroValido, nombre: '' },
    ];
    for (const caso of casos) {
      await expect(validar(RegistroDto, caso)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('Intento de elegir el rol: rechaza el campo `rol`, que el contrato no declara', async () => {
    const error = await validar(RegistroDto, { ...registroValido, rol: 'ADMIN' }).catch(
      (e: BadRequestException) => e,
    );

    expect(error).toBeInstanceOf(BadRequestException);
    const { message } = (error as BadRequestException).getResponse() as { message: string[] };
    expect(message.join(' ')).toContain('rol');
  });

  it('respeta los largos máximos del contrato', async () => {
    await expect(
      validar(RegistroDto, { ...registroValido, nombre: 'a'.repeat(61) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      validar(RegistroDto, { ...registroValido, telefono: '1'.repeat(31) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('LoginDto', () => {
  it('acepta mail y contraseña', async () => {
    await expect(
      validar(LoginDto, { email: 'ana@club.test', password: 'x' }),
    ).resolves.toBeInstanceOf(LoginDto);
  });

  it('rechaza mail inválido, contraseña vacía o campos de más', async () => {
    for (const caso of [
      { email: 'nope', password: 'x' },
      { email: 'ana@club.test', password: '' },
      { email: 'ana@club.test', password: 'x', recordarme: true },
    ]) {
      await expect(validar(LoginDto, caso)).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});
