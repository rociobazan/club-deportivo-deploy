import { BadRequestException } from '@nestjs/common';

import { crearPipeDeValidacion } from '../../common/validacion';
import { ContactoDto } from './contacto.dto';

// El mismo pipe que registra AppModule como APP_PIPE.
const pipe = crearPipeDeValidacion();

const validar = (valor: unknown) =>
  pipe.transform(valor, { type: 'body', metatype: ContactoDto });

const valido = {
  nombre: 'Ana Fernández',
  email: 'ana@example.com',
  mensaje: 'Hola, quería consultar por el alquiler de canchas para un torneo.',
};

describe('ContactoDto', () => {
  it('acepta un cuerpo válido, con teléfono opcional ausente', async () => {
    await expect(validar(valido)).resolves.toBeInstanceOf(ContactoDto);
  });

  it('Mail mal formado: rechaza ana@', async () => {
    await expect(validar({ ...valido, email: 'ana@' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('Mensaje demasiado largo: rechaza 1001 caracteres y acepta 1000', async () => {
    await expect(validar({ ...valido, mensaje: 'a'.repeat(1001) })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(validar({ ...valido, mensaje: 'a'.repeat(1000) })).resolves.toBeInstanceOf(
      ContactoDto,
    );
  });

  it('rechaza los cuerpos sin nombre, sin mail o sin mensaje', async () => {
    const casos = [
      { ...valido, nombre: '' },
      { email: valido.email, mensaje: valido.mensaje },
      { nombre: valido.nombre, mensaje: valido.mensaje },
      { nombre: valido.nombre, email: valido.email },
    ];
    for (const caso of casos) {
      await expect(validar(caso)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('deja pasar el campo trampa con cualquier contenido, para no darle señal al bot', async () => {
    await expect(
      validar({ ...valido, sitioWeb: 'http://spam.example' }),
    ).resolves.toBeInstanceOf(ContactoDto);
  });
});
