import { BadRequestException } from '@nestjs/common';
import { crearPipeDeValidacion } from '../../common/validacion';
import { ActualizarPerfilDto } from './actualizar-perfil.dto';
import { CambiarPasswordDto } from './cambiar-password.dto';
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

  it('Solo espacios: rechaza en vez de guardar el nombre vacío', async () => {
    for (const campo of ['nombre', 'apellido']) {
      await expect(
        validar(RegistroDto, { ...registroValido, [campo]: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('recorta los espacios de los extremos antes de validar', async () => {
    const dto = (await validar(RegistroDto, {
      ...registroValido,
      nombre: '  Ana  ',
      apellido: '  Socia ',
      email: ' ana@club.test ',
      telefono: ' 3511234567 ',
    })) as RegistroDto;

    expect(dto.nombre).toBe('Ana');
    expect(dto.apellido).toBe('Socia');
    expect(dto.email).toBe('ana@club.test');
    expect(dto.telefono).toBe('3511234567');
  });

  it('no recorta la contraseña: los espacios son parte de ella', async () => {
    const clave = '  con espacios  ';
    const dto = (await validar(RegistroDto, {
      ...registroValido,
      password: clave,
    })) as RegistroDto;

    expect(dto.password).toBe(clave);
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

  it('acepta un mail pegado con espacios, que es como llega del portapapeles', async () => {
    const dto = (await validar(LoginDto, {
      email: ' ana@club.test ',
      password: 'x',
    })) as LoginDto;

    expect(dto.email).toBe('ana@club.test');
  });
});

describe('ActualizarPerfilDto', () => {
  it('acepta un cambio parcial de un solo campo', async () => {
    await expect(
      validar(ActualizarPerfilDto, { telefono: '351 000 0000' }),
    ).resolves.toBeInstanceOf(ActualizarPerfilDto);
  });

  it('acepta telefono nulo, que es como se borra', async () => {
    await expect(validar(ActualizarPerfilDto, { telefono: null })).resolves.toBeInstanceOf(
      ActualizarPerfilDto,
    );
  });

  it('Intento de cambiar el rol o el estado de la cuenta: 400 por el pipe', async () => {
    for (const caso of [
      { nombre: 'Ana', rol: 'ADMIN' },
      { nombre: 'Ana', activo: false },
      { nombre: 'Ana', password: 'otraClave123' },
    ]) {
      await expect(validar(ActualizarPerfilDto, caso)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('rechaza un mail mal formado o un nombre vacío', async () => {
    for (const caso of [{ email: 'no-es-un-mail' }, { nombre: '' }]) {
      await expect(validar(ActualizarPerfilDto, caso)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  /*
   * El cuerpo vacío pasa el pipe a propósito y lo rechaza el servicio: con
   * todos los campos opcionales, `@IsOptional()` corta la validación de cada
   * propiedad y no queda dónde colgar la regla. El 400 igual llega, y su test
   * está en `auth.service.spec.ts`.
   */
  it('un cuerpo vacío pasa el pipe: lo rechaza el servicio', async () => {
    await expect(validar(ActualizarPerfilDto, {})).resolves.toBeInstanceOf(ActualizarPerfilDto);
  });
});

describe('CambiarPasswordDto', () => {
  it('acepta la actual y una nueva de al menos 8 caracteres', async () => {
    await expect(
      validar(CambiarPasswordDto, { actual: 'clave1234', nueva: 'claveNueva9' }),
    ).resolves.toBeInstanceOf(CambiarPasswordDto);
  });

  it('Contraseña nueva demasiado corta: 400', async () => {
    await expect(
      validar(CambiarPasswordDto, { actual: 'clave1234', nueva: '1234567' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza si falta la actual', async () => {
    await expect(validar(CambiarPasswordDto, { nueva: 'claveNueva9' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
