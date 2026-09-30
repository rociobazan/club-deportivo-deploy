import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Rol } from '../common/decoradores';
import { ErrorDeApi } from '../common/error-de-api';
import { noAutenticado } from '../common/usuario-actual';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegistroDto } from './dto/registro.dto';

/** El mismo costo que usa el seed, así los hashes son comparables. */
const COSTO_BCRYPT = 10;

/** `Usuario` del contrato: nunca lleva la contraseña ni su hash. */
export type UsuarioPublico = {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  rol: Rol;
};

/** `LoginResponse` del contrato. */
export type RespuestaLogin = {
  accessToken: string;
  expiraEn: number;
  usuario: UsuarioPublico;
};

const SELECCION_PUBLICA = {
  id: true,
  nombre: true,
  apellido: true,
  email: true,
  telefono: true,
  rol: true,
} satisfies Prisma.UsuarioSelect;

/** Un único error para mail inexistente y contraseña incorrecta: no revela qué cuentas existen. */
const credencialesInvalidas = () =>
  new ErrorDeApi(401, 'CREDENCIALES_INVALIDAS', 'El mail o la contraseña no son correctos');

const emailYaRegistrado = () =>
  new ErrorDeApi(
    409,
    'EMAIL_YA_REGISTRADO',
    'Ese mail ya está registrado',
    'Si es tuyo, ingresá con tu contraseña.',
  );

/** `usuario.email` es UNIQUE: `Ana@club.test` y `ana@club.test` son la misma persona. */
const normalizarEmail = (email: string) => email.trim().toLowerCase();

@Injectable()
export class AuthService {
  /**
   * Hash contra el que se compara cuando el mail no existe, para que la
   * respuesta tarde lo mismo que ante una contraseña incorrecta (design.md, 5).
   */
  private static readonly HASH_SENUELO = bcrypt.hashSync(
    'senuelo-para-tiempo-constante',
    COSTO_BCRYPT,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async registrar(datos: RegistroDto): Promise<UsuarioPublico> {
    const email = normalizarEmail(datos.email);

    const existente = await this.prisma.usuario.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existente) throw emailYaRegistrado();

    const passwordHash = await bcrypt.hash(datos.password, COSTO_BCRYPT);

    try {
      return await this.prisma.usuario.create({
        data: {
          nombre: datos.nombre.trim(),
          apellido: datos.apellido.trim(),
          email,
          passwordHash,
          telefono: datos.telefono?.trim() || null,
        },
        select: SELECCION_PUBLICA,
      });
    } catch (error) {
      // Dos registros simultáneos con el mismo mail: el índice único gana la carrera.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw emailYaRegistrado();
      }
      throw error;
    }
  }

  async ingresar(datos: LoginDto): Promise<RespuestaLogin> {
    // La misma selección pública que registrar y perfil, más el hash para comparar:
    // una columna nueva en `usuario` no sale por el login sin decidirlo acá.
    const encontrado = await this.prisma.usuario.findUnique({
      where: { email: normalizarEmail(datos.email) },
      select: { ...SELECCION_PUBLICA, passwordHash: true },
    });

    const coincide = await bcrypt.compare(
      datos.password,
      encontrado?.passwordHash ?? AuthService.HASH_SENUELO,
    );
    if (!encontrado || !coincide) throw credencialesInvalidas();

    const { passwordHash: _hash, ...usuario } = encontrado;
    const accessToken = await this.jwt.signAsync({ sub: usuario.id, rol: usuario.rol });
    // La vigencia real sale del token firmado, no de parsear JWT_EXPIRES_IN (design.md, 6).
    const { exp, iat } = this.jwt.decode<{ exp: number; iat: number }>(accessToken);

    return { accessToken, expiraEn: exp - iat, usuario };
  }

  async perfil(id: number): Promise<UsuarioPublico> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: SELECCION_PUBLICA,
    });
    // El token era válido pero el usuario ya no existe: para el cliente es no estar autenticado.
    if (!usuario) throw noAutenticado();
    return usuario;
  }

  /**
   * Modifica los datos del usuario del token. El id lo pone el controlador
   * desde `@UsuarioActual()`: no hay forma de expresar "el perfil de otro".
   */
  async actualizarPerfil(id: number, datos: ActualizarPerfilDto): Promise<UsuarioPublico> {
    /*
     * Un cuerpo sin ningún campo devuelve 400 y no 200: responder que sí
     * habiendo guardado nada es un éxito silencioso, y quien lo mandó se va
     * creyendo que cambió algo.
     *
     * Se cuentan los valores distintos de `undefined` y no las claves: la
     * instancia que arma el pipe trae las cuatro propiedades declaradas, con
     * `undefined` las que no vinieron, así que `Object.keys` nunca da cero.
     * `null` sí cuenta como enviado, porque es como se borra el teléfono.
     */
    const enviados = Object.values(datos).filter((valor) => valor !== undefined);
    if (enviados.length === 0) {
      throw new ErrorDeApi(
        400,
        'SOLICITUD_INVALIDA',
        'No hay nada para cambiar',
        'Mandá al menos uno de nombre, apellido, email o telefono.',
      );
    }

    // Solo lo que vino: `undefined` deja el campo como está, `null` borra el teléfono.
    const cambios: Prisma.UsuarioUpdateInput = {};
    if (datos.nombre !== undefined) cambios.nombre = datos.nombre.trim();
    if (datos.apellido !== undefined) cambios.apellido = datos.apellido.trim();
    if (datos.email !== undefined) cambios.email = normalizarEmail(datos.email);
    if (datos.telefono !== undefined) cambios.telefono = datos.telefono?.trim() || null;

    try {
      return await this.prisma.usuario.update({
        where: { id },
        data: cambios,
        select: SELECCION_PUBLICA,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        /*
         * El mail ya es de otra cuenta. Lo decide el índice único de la
         * columna y no un `findUnique` previo: entre el SELECT y el UPDATE
         * entra otra solicitud, y la base ya tiene la restricción.
         */
        if (error.code === 'P2002') throw emailYaRegistrado();
        // El token era válido pero el usuario ya no existe, igual que en `perfil`.
        if (error.code === 'P2025') throw noAutenticado();
      }
      throw error;
    }
  }

  /**
   * Cambia la contraseña previa verificación de la actual.
   *
   * No reemite ni revoca nada: el token es autocontenido, así que las sesiones
   * abiertas en otros dispositivos siguen valiendo hasta que vencen. Está
   * declarado en la spec como límite conocido.
   */
  async cambiarPassword(id: number, datos: CambiarPasswordDto): Promise<void> {
    const encontrado = await this.prisma.usuario.findUnique({
      where: { id },
      select: { passwordHash: true },
    });
    if (!encontrado) throw noAutenticado();

    const coincide = await bcrypt.compare(datos.actual, encontrado.passwordHash);
    if (!coincide) throw credencialesInvalidas();

    const passwordHash = await bcrypt.hash(datos.nueva, COSTO_BCRYPT);
    await this.prisma.usuario.update({ where: { id }, data: { passwordHash } });
  }
}
