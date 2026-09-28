import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Rol } from '../common/decoradores';
import { ErrorDeApi } from '../common/error-de-api';
import { noAutenticado } from '../common/usuario-actual';
import { PrismaService } from '../prisma/prisma.service';
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
}
